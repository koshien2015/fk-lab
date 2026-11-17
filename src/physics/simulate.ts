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

export function simulate(
  kick: KickState,
  params: PhysicsParams,
  options: SimOptions = {},
): Trajectory {
  const { dt, maxTime, sampleEvery, seed, stopAtGround } = { ...DEFAULTS, ...options };
  const rk4 = createRk4(createDerivative(params, seed));
  const maxSteps = Math.round(maxTime / dt);
  const recorder = createRecorder(Math.floor(maxSteps / sampleEvery) + 2, dt, params.mass);

  const y = Float64Array.of(...kick.position, ...kick.velocity, ...kick.omega, 0, 0, 0, 1, 0);
  const fPrev = new Float64Array(FORCE_SIZE);
  recorder.record(0, y, rk4.forcesAt(y));

  let step = 0;
  while (step < maxSteps) {
    fPrev.set(rk4.step(y, dt));
    step++;
    const landed = stopAtGround && y[1] <= params.radius && y[4] < 0;
    const finished = landed || step >= maxSteps;
    const fNow = rk4.forcesAt(y);
    recorder.accumulate(fPrev, fNow);
    if (finished || step % sampleEvery === 0) recorder.record(step * dt, y, fNow);
    if (finished) break;
  }
  return recorder.finish(step * dt, y);
}
