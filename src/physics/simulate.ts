/**
 * ボールの飛翔シミュレーション（6 自由度、固定ステップ RK4）。
 *
 * Three.js にも DOM にも依存しない。Vitest、Web Worker、逆算モードの最適化ループから
 * 同じコードを呼ぶ。入力（kick, params）は書き換えず、結果は新しく作って返す。
 */
import { createDerivative, FORCE_SIZE } from './dynamics.ts';
import { createRk4 } from './integrator.ts';
import type { PhysicsParams } from './params.ts';
import { createRecorder } from './recorder.ts';
import type { KickState, SimOptions, Trajectory } from './types.ts';

const DEFAULTS = { dt: 0.001, maxTime: 6, sampleEvery: 5, seed: 1, stopAtGround: true };

export interface StepControl {
  /** これ以降、力ごとの寄与を積まない（何かに当たったあとは飛翔ではないため） */
  freezeContributions(): void;
}

export interface StepHooks {
  /**
   * 1 ステップ進めた直後に呼ばれる。衝突の処理のために状態 y を書き換えてよい。
   * true を返すとそこで終わる。
   */
  afterStep?(y: Float64Array, time: number, control: StepControl): boolean;
  /** 記録点を 1 つ書いた直後に呼ばれる */
  onSample?(index: number, time: number): void;
}

/** 飛翔を積分する。衝突や打ち切りの条件は hooks で差し込む。 */
export function integrate(
  kick: KickState,
  params: PhysicsParams,
  options: SimOptions,
  hooks: StepHooks,
): Trajectory {
  const { dt, maxTime, sampleEvery, seed } = { ...DEFAULTS, ...options };
  const rk4 = createRk4(createDerivative(params, seed));
  const maxSteps = Math.round(maxTime / dt);
  const recorder = createRecorder(Math.floor(maxSteps / sampleEvery) + 2, dt, params.mass);
  let frozen = false;
  const control: StepControl = { freezeContributions: () => void (frozen = true) };

  const y = Float64Array.of(...kick.position, ...kick.velocity, ...kick.omega, 0, 0, 0, 1, 0);
  const fPrev = new Float64Array(FORCE_SIZE);
  // 注意: `hooks.onSample?.(recorder.record(...))` と書くと、onSample が無いとき記録自体が飛ばされる
  const first = recorder.record(0, y, rk4.forcesAt(y));
  hooks.onSample?.(first, 0);

  let step = 0;
  while (step < maxSteps) {
    fPrev.set(rk4.step(y, dt));
    step++;
    const time = step * dt;
    const stopped = hooks.afterStep?.(y, time, control) === true;
    const finished = stopped || step >= maxSteps;
    const fNow = rk4.forcesAt(y);
    if (!frozen) recorder.accumulate(fPrev, fNow);
    if (finished || step % sampleEvery === 0) {
      const index = recorder.record(time, y, fNow);
      hooks.onSample?.(index, time);
    }
    if (finished) break;
  }
  return recorder.finish(step * dt, y);
}

/** 何にも当たらない飛翔だけを計算する（地面に落ちるか、指定の x に届くまで） */
export function simulate(
  kick: KickState,
  params: PhysicsParams,
  options: SimOptions = {},
): Trajectory {
  const { stopAtGround, stopAtX } = { ...DEFAULTS, ...options };
  return integrate(kick, params, options, {
    afterStep: (y) =>
      (stopAtGround && y[1] <= params.radius && y[4] < 0) ||
      (stopAtX !== undefined && y[0] >= stopAtX),
  });
}
