/**
 * 運動方程式（3.2〜3.5）。状態から力と導関数を求める。
 *
 * 座標系（右手系、Three.js と同じ向き）:
 *   x = ゴール方向（前）, y = 上, z = キッカーから見て右
 *
 * 不変性について: 導関数は 1 回のキックで 1 万回以上呼ばれるので、
 * 結果は呼び出し側が用意した Float64Array に書き込む（配列を作り直さない）。
 * この書き込みは積分器の内側に閉じていて、外へ出る値はすべて新しく作る。
 */
import {
  dragCoefficient,
  knuckleAmplitude,
  liftCoefficient,
  reynolds,
  spinParameter,
} from './aero.ts';
import { createKnuckleNoise, knuckleSignal } from './knuckle.ts';
import { crossSection, inertia, type PhysicsParams } from './params.ts';

/** 状態ベクトルの並び: 位置 0-2, 速度 3-5, 角速度 6-8, 姿勢 9-12 (x,y,z,w), ナックル位相 13 */
export const STATE_SIZE = 14;
/** 力バッファの並び: 重力 0-2, 抗力 3-5, マグヌス 6-8, ナックル 9-11, Re 12, C_D 13, S 14 */
export const FORCE_SIZE = 15;
const EPS = 1e-9;

/** 状態 y での力 f と導関数 dy を書き込む */
export type Derivative = (y: Float64Array, dy: Float64Array, f: Float64Array) => void;

export function createDerivative(params: PhysicsParams, seed: number): Derivative {
  const m = params.mass;
  const halfRhoA = 0.5 * params.airDensity * crossSection(params);
  const weight = -m * params.gravity;
  const spinDecayRate =
    (params.spinDecayCoefficient * halfRhoA * params.radius * params.radius) / inertia(params);
  const phaseRate = (2 * Math.PI * params.strouhal) / (2 * params.radius);
  const noise = createKnuckleNoise(seed);

  /** 空気から受ける力（抗力・マグヌス力・ナックル横力）を f に書く */
  const writeAeroForces = (y: Float64Array, f: Float64Array, speed: number): void => {
    const vx = y[3], vy = y[4], vz = y[5];
    const wx = y[6], wy = y[7], wz = y[8];
    const ux = vx / speed, uy = vy / speed, uz = vz / speed;
    const q = halfRhoA * speed * speed; // 動圧 × 断面積
    const re = reynolds(speed, params);
    const cd = dragCoefficient(re, params);
    const wMag = Math.hypot(wx, wy, wz);
    const s = spinParameter(speed, wMag, params);
    f[12] = re;
    f[13] = cd;
    f[14] = s;

    // 抗力: 速度の逆向き
    f[3] = -q * cd * ux;
    f[4] = -q * cd * uy;
    f[5] = -q * cd * uz;

    // マグヌス力: ω̂ × v̂ の向き（回転軸が進行方向と平行なら働かない）
    if (wMag > EPS) {
      const k = (q * liftCoefficient(s, params)) / wMag;
      f[6] = k * (wy * uz - wz * uy);
      f[7] = k * (wz * ux - wx * uz);
      f[8] = k * (wx * uy - wy * ux);
    }

    // ナックル横力: 速度に垂直な平面内で向きが変わる
    const amp = knuckleAmplitude(s, re, params);
    if (amp > 0) {
      // e1 = 水平な横方向, e2 = e1 × v̂（v が +x なら e1 = 右, e2 = 上）
      const h = Math.hypot(vx, vz);
      const e1x = h > EPS ? -vz / h : 0;
      const e1z = h > EPS ? vx / h : 1;
      const c1 = q * amp * knuckleSignal(noise, 0, y[13]);
      const c2 = q * amp * knuckleSignal(noise, 1, y[13]);
      f[9] = c1 * e1x - c2 * e1z * uy;
      f[10] = c2 * (e1z * ux - e1x * uz);
      f[11] = c1 * e1z + c2 * e1x * uy;
    }
  };

  return (y, dy, f) => {
    const speed = Math.hypot(y[3], y[4], y[5]);
    f.fill(0);
    f[1] = weight;
    if (speed > EPS) writeAeroForces(y, f, speed);

    dy[0] = y[3];
    dy[1] = y[4];
    dy[2] = y[5];
    dy[3] = (f[0] + f[3] + f[6] + f[9]) / m;
    dy[4] = (f[1] + f[4] + f[7] + f[10]) / m;
    dy[5] = (f[2] + f[5] + f[8] + f[11]) / m;
    // 空力トルクによる回転の減衰
    const wx = y[6], wy = y[7], wz = y[8];
    const decay = -spinDecayRate * speed;
    dy[6] = decay * wx;
    dy[7] = decay * wy;
    dy[8] = decay * wz;
    // 姿勢: dq/dt = ½·(ω, 0) ⊗ q
    const qx = y[9], qy = y[10], qz = y[11], qw = y[12];
    dy[9] = 0.5 * (wx * qw + wy * qz - wz * qy);
    dy[10] = 0.5 * (-wx * qz + wy * qw + wz * qx);
    dy[11] = 0.5 * (wx * qy - wy * qx + wz * qw);
    dy[12] = 0.5 * (-wx * qx - wy * qy - wz * qz);
    // ナックルの位相は速度に比例して進む
    dy[13] = phaseRate * speed;
  };
}
