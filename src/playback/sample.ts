/**
 * 記録した軌道から、任意の時刻の状態を補間して取り出す（再生とスクラブ用）。
 */
import type { ForceKey, Trajectory, Vec3 } from '../physics/types.ts';

export type Quat = readonly [number, number, number, number];

export interface BallSample {
  readonly time: number;
  /** 直前の記録点の番号 */
  readonly index: number;
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly omega: Vec3;
  readonly quaternion: Quat;
  readonly forces: Readonly<Record<ForceKey, Vec3>>;
  readonly re: number;
  readonly cd: number;
  readonly spin: number;
}

/** time 以下で最大の記録点の番号（二分探索） */
function indexBefore(t: Float64Array, count: number, time: number): number {
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function sampleTrajectory(tr: Trajectory, time: number): BallSample {
  const clamped = Math.min(Math.max(time, tr.t[0]), tr.t[tr.count - 1]);
  const i = Math.min(indexBefore(tr.t, tr.count, clamped), tr.count - 2);
  const span = tr.t[i + 1] - tr.t[i];
  const k = span > 0 ? (clamped - tr.t[i]) / span : 0;

  const lerp = (arr: Float64Array, stride: number, a: number): number =>
    arr[i * stride + a] + k * (arr[(i + 1) * stride + a] - arr[i * stride + a]);
  const vec3 = (arr: Float64Array): Vec3 => [lerp(arr, 3, 0), lerp(arr, 3, 1), lerp(arr, 3, 2)];

  // 姿勢は成分ごとに補間して正規化する（記録の間隔が短いので球面補間との差は小さい）。
  // q と −q は同じ姿勢なので、近いほうの符号にそろえてから混ぜる。
  const q0 = [0, 1, 2, 3].map((a) => tr.quat[i * 4 + a]);
  const q1 = [0, 1, 2, 3].map((a) => tr.quat[(i + 1) * 4 + a]);
  const sign = q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3] < 0 ? -1 : 1;
  const mixed = q0.map((v, a) => v + k * (sign * q1[a] - v));
  const norm = Math.hypot(mixed[0], mixed[1], mixed[2], mixed[3]);

  return {
    time: clamped,
    index: i + (k >= 1 ? 1 : 0),
    position: vec3(tr.pos),
    velocity: vec3(tr.vel),
    omega: vec3(tr.omega),
    quaternion: [mixed[0] / norm, mixed[1] / norm, mixed[2] / norm, mixed[3] / norm],
    forces: {
      gravity: vec3(tr.forces.gravity),
      drag: vec3(tr.forces.drag),
      magnus: vec3(tr.forces.magnus),
      knuckle: vec3(tr.forces.knuckle),
    },
    re: lerp(tr.re, 1, 0),
    cd: lerp(tr.cd, 1, 0),
    spin: lerp(tr.spin, 1, 0),
  };
}
