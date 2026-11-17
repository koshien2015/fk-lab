/**
 * アプリ本体。場面を組み立て、蹴る → 計算（Worker）→ 再生 の流れをつなぐ。
 * マイルストーン 2 の時点では、決まった 3 種類の蹴り方を再生する。
 */
import { defaultParams, type PhysicsParams } from '../physics/params.ts';
import { DEMO_KICKS, type DemoKick } from '../physics/presets.ts';
import type { KickState, Trajectory } from '../physics/types.ts';
import { sampleTrajectory } from '../playback/sample.ts';
import { createBall } from '../scene/ball.ts';
import { createGoal } from '../scene/goal.ts';
import { createPitch } from '../scene/pitch.ts';
import { createStage, type Stage } from '../scene/stage.ts';
import { createTrail } from '../scene/trail.ts';
import { createSimClient } from '../worker/simClient.ts';
import { createHud } from './hud.ts';

const KICKS = DEMO_KICKS.filter((demo) => demo.id !== 'straight');
/** 再生が終わってから、最後の姿を見せておく時間 [s] */
const HOLD_AFTER = 1.2;

interface Playback {
  readonly trajectory: Trajectory;
  readonly time: number;
}

/** デモの蹴り方を、ピッチ上の位置（ゴール正面、distance m 手前）に置く */
function placeOnPitch(demo: DemoKick, params: PhysicsParams): KickState {
  return { ...demo.kick, position: [-demo.distance, params.radius, 0] };
}

function aimCamera(stage: Stage, ballX: number): void {
  stage.camera.position.set(ballX - 7, 2.1, 1.8);
  stage.controls.target.set(ballX * 0.35, 1.2, 0);
  stage.controls.update();
}

function overlay(className: string, html: string): HTMLElement {
  const element = document.createElement('div');
  element.className = `overlay ${className}`;
  element.innerHTML = html;
  return element;
}

export function startApp(container: HTMLElement): void {
  const params = defaultParams();
  const stage = createStage(container);
  const ball = createBall(params.radius);
  const trail = createTrail();
  const hud = createHud();
  const sim = createSimClient();
  stage.scene.add(createPitch(), createGoal(), ball.mesh, trail.object);

  const status = document.createElement('p');
  const buttons = KICKS.map((demo) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${demo.label}を蹴る`;
    return { demo, button };
  });
  const row = document.createElement('div');
  row.className = 'row';
  row.append(...buttons.map(({ button }) => button));
  const controls = overlay('controls', '');
  controls.append(row, status);
  container.append(
    overlay(
      'title',
      'FK Lab<small>空力係数は仮定値です（実測ではありません）。<a href="./graphs.html">物理コアのグラフ</a></small>',
    ),
    hud.element,
    controls,
  );

  let playback: Playback | null = null;
  let seed = 1;

  const ready = (demo: DemoKick): void => {
    ball.show({ position: [-demo.distance, params.radius, 0], quaternion: [0, 0, 0, 1] });
    aimCamera(stage, -demo.distance);
  };

  const kick = async (demo: DemoKick): Promise<void> => {
    for (const entry of buttons) entry.button.setAttribute('aria-pressed', String(entry.demo === demo));
    ready(demo);
    status.textContent = `${demo.description}（シード ${seed}）`;
    try {
      const trajectory = await sim.simulate(placeOnPitch(demo, params), params, { seed });
      seed += 1;
      trail.setTrajectory(trajectory);
      playback = { trajectory, time: 0 };
    } catch (error) {
      console.error('キックの計算に失敗しました', error);
      status.textContent = '計算に失敗しました。もう一度試してください。';
    }
  };
  for (const { demo, button } of buttons) button.addEventListener('click', () => void kick(demo));

  stage.onFrame((dt) => {
    if (!playback) return;
    const time = Math.min(playback.time + dt, playback.trajectory.final.t + HOLD_AFTER);
    playback = { ...playback, time };
    const sample = sampleTrajectory(playback.trajectory, time);
    ball.show(sample);
    trail.reveal(sample.index);
    hud.update(sample);
  });

  ready(KICKS[0]);
  status.textContent = '蹴り方を選んでください。ドラッグで視点を回せます。';
}
