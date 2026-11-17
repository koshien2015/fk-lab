/**
 * アプリ本体。場面を組み立て、設定 → 予測線 → 蹴る → 再生 の流れをつなぐ。
 */
import { keeperStartZ, type KeeperPose } from '../match/keeper.ts';
import type { ShotResult } from '../match/shot.ts';
import { OUTCOME_LABELS, verdictTime } from '../match/verdict.ts';
import { jumpHeight, wallPlayers } from '../match/wall.ts';
import { defaultParams } from '../physics/params.ts';
import { sampleTrajectory } from '../playback/sample.ts';
import { createActors } from '../scene/actors.ts';
import { createBall } from '../scene/ball.ts';
import { kickerView, overviewView } from '../scene/cameraViews.ts';
import { createGoal } from '../scene/goal.ts';
import { createPitch } from '../scene/pitch.ts';
import { createStage } from '../scene/stage.ts';
import { createTrail } from '../scene/trail.ts';
import { h } from '../ui/dom.ts';
import { createPanel } from '../ui/panel.ts';
import { createSimClient } from '../worker/simClient.ts';
import { createHud } from './hud.ts';
import { createPlacement } from './placement.ts';
import { createPreviewer } from './previewer.ts';
import { DEFAULT_SETUP, toKickState, toScenario, type KickSetup } from './setup.ts';
import { createStore } from './store.ts';

/** 再生中のキックと、いまの再生時刻。null なら構えている最中。 */
interface Flight {
  readonly result: ShotResult;
  readonly setup: KickSetup;
  readonly time: number;
}

/** 記録点 index での GK の姿勢 */
function keeperPoseAt(result: ShotResult, index: number): KeeperPose | null {
  if (!result.keeper.config) return null;
  const i = Math.min(index, result.keeper.z.length - 1);
  return { z: result.keeper.z[i], lean: result.keeper.lean[i] };
}

const AIM_HINT = '蹴る点・向き・強さを決めて「蹴る」。視点はドラッグで回せます。';
const PLACE_HINT = 'ピッチをクリックまたはドラッグして、ボールを置く位置を選びます。';

export function startApp(root: HTMLElement): void {
  const params = defaultParams();
  const store = createStore<KickSetup>(DEFAULT_SETUP);
  const viewport = h('div', { class: 'viewport' });
  root.append(viewport);

  const stage = createStage(viewport);
  const ball = createBall(params.radius);
  const trail = createTrail();
  const preview = createTrail({ width: 2, opacity: 0.4 });
  const hud = createHud();
  const sim = createSimClient();
  let flight: Flight | null = null;

  const actors = createActors();
  const banner = h('div', { class: 'overlay banner' });
  const placement = createPlacement(stage, (spot) => store.set({ spot }));
  stage.scene.add(
    createPitch(),
    createGoal(),
    ball.mesh,
    trail.object,
    preview.object,
    placement.marker,
    actors.object,
  );

  const title = h('div', { class: 'overlay title' }, 'FK Lab');
  title.append(
    h('small', {}, '空力係数は仮定値です（実測ではありません）。', h('a', { href: './graphs.html' }, '物理コアのグラフ')),
  );
  viewport.append(title, hud.element, banner);

  /** 構えの姿に戻す（ボールを置き、予測線を出す） */
  const showAim = (setup: KickSetup): void => {
    flight = null;
    trail.reveal(0);
    preview.object.visible = true;
    ball.show({ position: [setup.spot.x, params.radius, setup.spot.z], quaternion: [0, 0, 0, 1] });
    placement.showAt(setup.spot);
    const players = wallPlayers(setup.spot, setup.wall);
    actors.setWall(players, setup.spot);
    actors.setWallLift(0);
    actors.setKeeper(
      setup.keeper === 'none' ? null : { z: keeperStartZ(setup.spot, players.length > 0), lean: 0 },
    );
    banner.classList.remove('show');
  };

  const previewer = createPreviewer(sim, params, (trajectory, setup) => {
    if (setup !== store.get() || flight) return;
    preview.setTrajectory(trajectory);
    preview.reveal(trajectory.count);
    hud.update(sampleTrajectory(trajectory, 0));
  });

  const panel = createPanel(store, params, {
    onKick: () => void kick(),
    onTogglePlacing: () => setPlacing(!placement.isActive()),
  });
  root.append(panel.element);

  const setPlacing = (placing: boolean): void => {
    placement.setActive(placing);
    panel.setPlacing(placing);
    panel.setStatus(placing ? PLACE_HINT : AIM_HINT);
    showAim(store.get());
    stage.setView(placing ? overviewView() : kickerView(store.get().spot));
  };

  const kick = async (): Promise<void> => {
    if (placement.isActive()) setPlacing(false);
    const setup = store.get();
    showAim(setup);
    try {
      const result = await sim.shot(toKickState(setup, params), params, toScenario(setup));
      if (setup !== store.get()) return;
      trail.setTrajectory(result.trajectory);
      preview.object.visible = false;
      banner.textContent = OUTCOME_LABELS[result.outcome];
      banner.dataset.outcome = result.outcome;
      flight = { result, setup, time: 0 };
      panel.setStatus('設定を変えると、構え直します。');
    } catch (error) {
      console.error('キックの計算に失敗しました', error);
      panel.setStatus('計算に失敗しました。もう一度試してください。');
    }
  };

  store.subscribe((setup, previous) => {
    showAim(setup);
    previewer.request(setup);
    if (setup.spot !== previous.spot && !placement.isActive()) stage.setView(kickerView(setup.spot));
    if (!placement.isActive()) panel.setStatus(AIM_HINT);
  });

  stage.onFrame((dt) => {
    if (!flight) return;
    const { result, setup } = flight;
    const time = Math.min(flight.time + dt, result.trajectory.final.t);
    flight = { ...flight, time };
    const sample = sampleTrajectory(result.trajectory, time);
    ball.show(sample);
    trail.reveal(sample.index);
    hud.update(sample);
    actors.setKeeper(keeperPoseAt(result, sample.index));
    actors.setWallLift(jumpHeight(time, setup.wall));
    banner.classList.toggle('show', time >= verdictTime(result));
  });

  showAim(store.get());
  previewer.request(store.get());
  stage.setView(kickerView(store.get().spot));
  panel.setStatus(AIM_HINT);
}
