/**
 * アプリ本体。場面を組み立て、設定 → 予測線 → 蹴る → 再生 → 解説 の流れをつなぐ。
 */
import { keeperStartZ, type KeeperPose } from '../match/keeper.ts';
import type { ShotResult } from '../match/shot.ts';
import { OUTCOME_LABELS, verdictTime } from '../match/verdict.ts';
import { jumpHeight, wallPlayers } from '../match/wall.ts';
import { describeSpin } from '../physics/kick.ts';
import { defaultParams, type PhysicsParams } from '../physics/params.ts';
import type { KickState } from '../physics/types.ts';
import { sampleTrajectory } from '../playback/sample.ts';
import { createActors } from '../scene/actors.ts';
import { createBall } from '../scene/ball.ts';
import { kickerView, overviewView } from '../scene/cameraViews.ts';
import { createForceArrows } from '../scene/forceArrows.ts';
import { createGoal } from '../scene/goal.ts';
import { createPitch } from '../scene/pitch.ts';
import { createSearchLines } from '../scene/searchLines.ts';
import { createStage } from '../scene/stage.ts';
import { createTrail } from '../scene/trail.ts';
import { h } from '../ui/dom.ts';
import { createPanel } from '../ui/panel.ts';
import { createTimeline } from '../ui/timeline.ts';
import { createWhyPanel } from '../ui/whyPanel.ts';
import type { GoalTarget, SpinStyle } from '../solver/inverse.ts';
import { createSimClient } from '../worker/simClient.ts';
import { createCompare } from './compare.ts';
import { advance, seek, setRate, startFlight, togglePlay, type Flight } from './flight.ts';
import { createHud } from './hud.ts';
import { createInverseMode } from './inverseMode.ts';
import { createPlacement } from './placement.ts';
import { createPreviewer } from './previewer.ts';
import { DEFAULT_SETUP, toKickInput, toKickState, toScenario, type KickSetup } from './setup.ts';
import { createStore } from './store.ts';

/** 蹴った 1 本ぶんの記録 */
interface Shot {
  readonly result: ShotResult;
  readonly setup: KickSetup;
  readonly kick: KickState;
}

const AIM_HINT = '蹴る点・向き・強さを決めて「蹴る」。視点はドラッグで回せます。';
const PLACE_HINT = 'ピッチをクリックまたはドラッグして、ボールを置く位置を選びます。';
const INVERSE_HINT = 'ゴールの中の狙いたい点をクリックすると、そこに入る蹴り方を探します。';
const FLIGHT_HINT = '下のバーでスロー再生や巻き戻しができます。設定を変えると構え直します。';

/** 記録点 index での GK の姿勢 */
function keeperPoseAt(result: ShotResult, index: number): KeeperPose | null {
  if (!result.keeper.config) return null;
  const i = Math.min(index, result.keeper.z.length - 1);
  return { z: result.keeper.z[i], lean: result.keeper.lean[i] };
}

/** 比較の一覧に出す、蹴り方の短い説明 */
function shotLabel({ setup, result }: Shot, params: PhysicsParams): string {
  const spin = describeSpin(toKickInput(setup), params);
  const kind = spin.knuckle ? 'ナックル' : `${spin.rps.toFixed(1)} rps`;
  return `${kind}・${Math.round(setup.power * 100)}% → ${OUTCOME_LABELS[result.outcome]}`;
}

export function startApp(root: HTMLElement): void {
  const params = defaultParams();
  const store = createStore<KickSetup>(DEFAULT_SETUP);
  const viewport = h('div', { class: 'viewport' });
  root.append(viewport);

  const stage = createStage(viewport);
  const sim = createSimClient();
  const ball = createBall(params.radius);
  const trail = createTrail();
  const preview = createTrail({ width: 2, opacity: 0.4 });
  const arrows = createForceArrows(params.radius);
  const actors = createActors();
  const compare = createCompare();
  const hud = createHud(params);
  const why = createWhyPanel(params);
  const banner = h('div', { class: 'overlay banner' });
  const placement = createPlacement(stage, (spot) => store.set({ spot }));
  const searchLines = createSearchLines();
  const inverse = createInverseMode(stage, (target) => void solve(target));
  let inverseStyle: SpinStyle = 'curve';

  let flight: Flight<Shot> | null = null;
  let view = { arrows: true, preview: true };
  let rate = 1;
  /** 解説パネルを出し終えたキック（同じキックで何度も開き直さない） */
  let explained: Shot | null = null;

  const timeline = createTimeline({
    onTogglePlay: () => void (flight = flight && togglePlay(flight)),
    onSeek: (time) => void (flight = flight && seek(flight, time)),
    onRate: (next) => {
      rate = next;
      flight = flight && setRate(flight, next);
    },
  });

  stage.scene.add(
    createPitch(),
    createGoal(),
    ball.mesh,
    trail.object,
    preview.object,
    arrows.object,
    placement.marker,
    actors.object,
    compare.object,
    searchLines.object,
    inverse.marker,
  );
  const title = h('div', { class: 'overlay title' }, 'FK Lab');
  title.append(
    h('small', {}, '空力係数は仮定値です（実測ではありません）。', h('a', { href: './graphs.html' }, '物理コアのグラフ')),
  );
  viewport.append(title, compare.element, hud.element, banner, why.element, timeline.element);

  const syncView = (): void => {
    preview.object.visible = view.preview && !flight;
    arrows.setVisible(view.arrows && flight !== null);
    panel.setView({ ...view, canPin: flight !== null, pinCount: compare.count() });
  };

  /** 構えの姿に戻す（ボールを置き、壁と GK を並べ、予測線を出す） */
  const showAim = (setup: KickSetup): void => {
    flight = null;
    trail.reveal(0);
    ball.show({ position: [setup.spot.x, params.radius, setup.spot.z], quaternion: [0, 0, 0, 1] });
    placement.showAt(setup.spot);
    const players = wallPlayers(setup.spot, setup.wall);
    actors.setWall(players, setup.spot);
    actors.setWallLift(0);
    actors.setKeeper(
      setup.keeper === 'none' ? null : { z: keeperStartZ(setup.spot, players.length > 0), lean: 0 },
    );
    banner.classList.remove('show');
    why.hide();
    timeline.setVisible(false);
    syncView();
  };

  const previewer = createPreviewer(sim, params, (trajectory, setup) => {
    if (setup !== store.get() || flight) return;
    preview.setTrajectory(trajectory);
    preview.reveal(trajectory.count);
    hud.update(sampleTrajectory(trajectory, 0));
  });

  const setInverse = (active: boolean): void => {
    if (active && placement.isActive()) setPlacing(false);
    inverse.setActive(active);
    if (!active) inverse.showTarget(null);
    panel.setInverse({ active, style: inverseStyle });
    panel.setStatus(active ? INVERSE_HINT : AIM_HINT);
    if (active) showAim(store.get());
  };

  /** 逆算: 狙う点に入る蹴り方を Worker で探し、設定に反映する */
  const solve = async (target: GoalTarget): Promise<void> => {
    const setup = store.get();
    inverse.showTarget(target);
    panel.setStatus('蹴り方を探しています…');
    try {
      const solution = await sim.solve({ setup, target, style: inverseStyle }, params);
      if (setup !== store.get()) return;
      searchLines.play(solution.candidates);
      store.set(solution.patch);
      const found = solution.miss < 0.3;
      const wall = solution.clearsWall ? '' : '壁を避けきれていません。';
      panel.setStatus(
        found
          ? `${solution.evaluations} 通りを試して、狙った点から ${(solution.miss * 100).toFixed(0)} cm の蹴り方を見つけました。${wall}`
          : `この球種では届く蹴り方が見つかりませんでした（いちばん近い蹴り方を表示）。${wall}`,
      );
    } catch (error) {
      console.error('逆算に失敗しました', error);
      panel.setStatus('逆算に失敗しました。もう一度試してください。');
    }
  };

  const setPlacing = (placing: boolean): void => {
    if (placing && inverse.isActive()) setInverse(false);
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
      const state = toKickState(setup, params);
      const result = await sim.shot(state, params, toScenario(setup));
      if (setup !== store.get()) return;
      trail.setTrajectory(result.trajectory);
      banner.textContent = OUTCOME_LABELS[result.outcome];
      banner.dataset.outcome = result.outcome;
      const shot: Shot = { result, setup, kick: state };
      flight = startFlight({ duration: result.trajectory.final.t, payload: shot }, rate);
      timeline.setVisible(true);
      panel.setStatus(FLIGHT_HINT);
      syncView();
    } catch (error) {
      console.error('キックの計算に失敗しました', error);
      panel.setStatus('計算に失敗しました。もう一度試してください。');
    }
  };

  const panel = createPanel(store, params, {
    onKick: () => void kick(),
    onTogglePlacing: () => setPlacing(!placement.isActive()),
    onToggleArrows: () => {
      view = { ...view, arrows: !view.arrows };
      syncView();
    },
    onTogglePreview: () => {
      view = { ...view, preview: !view.preview };
      syncView();
    },
    onPin: () => {
      if (flight) compare.pin(flight.payload.result.trajectory, shotLabel(flight.payload, params));
      syncView();
    },
    onClearPins: () => {
      compare.clear();
      syncView();
    },
    onToggleInverse: () => setInverse(!inverse.isActive()),
    onInverseStyle: (style) => {
      inverseStyle = style;
      panel.setInverse({ active: inverse.isActive(), style });
    },
    onLegend: (legend) => {
      if (placement.isActive()) setPlacing(false);
      if (inverse.isActive()) setInverse(false);
      store.set(legend.setup);
      panel.setStatus(`${legend.scene}。パラメータは推定値で、実際の記録ではありません。`);
    },
  });
  root.append(panel.element);

  store.subscribe((setup, previous) => {
    showAim(setup);
    previewer.request(setup);
    if (setup.spot !== previous.spot && !placement.isActive()) stage.setView(kickerView(setup.spot));
    if (inverse.isActive()) panel.setStatus(INVERSE_HINT);
    else if (!placement.isActive()) panel.setStatus(AIM_HINT);
  });

  /** 再生中の 1 コマを画面に反映する */
  const renderFlight = (current: Flight<Shot>): void => {
    const { result, setup, kick: state } = current.payload;
    const sample = sampleTrajectory(result.trajectory, current.time);
    ball.show(sample);
    trail.reveal(sample.index);
    hud.update(sample);
    arrows.update(sample);
    actors.setKeeper(keeperPoseAt(result, sample.index));
    actors.setWallLift(jumpHeight(current.time, setup.wall));
    timeline.render(current);

    const decided = current.time >= verdictTime(result);
    banner.classList.toggle('show', decided);
    if (decided && explained !== current.payload) {
      explained = current.payload;
      why.show(result.trajectory, state, result.flightTime);
    }
  };

  stage.onFrame((dt) => {
    searchLines.update(dt);
    if (!flight) return;
    flight = advance(flight, dt);
    renderFlight(flight);
  });

  showAim(store.get());
  previewer.request(store.get());
  stage.setView(kickerView(store.get().spot));
  panel.setStatus(AIM_HINT);
  panel.setInverse({ active: false, style: inverseStyle });
}
