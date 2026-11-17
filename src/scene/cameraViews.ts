/**
 * カメラの置き方（プリセット）。
 */
import type { Spot } from '../field/placement.ts';
import type { Vec3 } from '../physics/types.ts';

export interface CameraView {
  readonly position: Vec3;
  readonly target: Vec3;
}

export type CameraMode = 'kicker' | 'keeper' | 'top' | 'side' | 'follow';

export const CAMERA_MODES: ReadonlyArray<{ readonly value: CameraMode; readonly label: string }> = [
  { value: 'kicker', label: 'キッカー' },
  { value: 'keeper', label: 'GK' },
  { value: 'top', label: '真上' },
  { value: 'side', label: '真横' },
  { value: 'follow', label: '追従' },
];

/** ボールを追い続ける視点か（追う視点では、ドラッグでの視点操作を止める） */
export function isTracking(mode: CameraMode): boolean {
  return mode === 'keeper' || mode === 'follow';
}

/** ボールの位置と速度（視点を決めるのに使う） */
export interface BallMotion {
  readonly position: Vec3;
  readonly velocity: Vec3;
}

/** キッカーの後ろから、ボール越しにゴールを見る */
export function kickerView(spot: Spot): CameraView {
  const distance = Math.hypot(spot.x, spot.z);
  const fx = -spot.x / distance;
  const fz = -spot.z / distance;
  // 右手方向へ少しずらして、ボールとゴールが重ならないようにする
  const rx = -fz;
  const rz = fx;
  return {
    position: [spot.x - fx * 7 + rx * 1.6, 2.1, spot.z - fz * 7 + rz * 1.6],
    target: [spot.x + fx * distance * 0.65, 1.2, spot.z + fz * distance * 0.65],
  };
}

/** 攻撃側の半分を斜め上から見渡す（ボールの位置を選ぶとき） */
export function overviewView(): CameraView {
  return { position: [-58, 40, 0], target: [-20, 0, 0] };
}

/** GK の目の高さから、飛んでくるボールを見る */
export function keeperView(ball: BallMotion): CameraView {
  return { position: [0.9, 1.7, 0], target: [ball.position[0], Math.max(0.6, ball.position[1]), ball.position[2]] };
}

/** 真上から、ボールとゴールの間を見下ろす（画面の上がゴール方向） */
export function topView(spot: Spot): CameraView {
  const midX = spot.x / 2;
  const height = Math.max(26, Math.abs(spot.x) * 1.15);
  return { position: [midX - 0.05, height, spot.z / 2], target: [midX, 0, spot.z / 2] };
}

/** 真横（右のタッチライン側）から、軌道の高さを見る */
export function sideView(spot: Spot): CameraView {
  const midX = spot.x / 2;
  return { position: [midX, 2.2, Math.max(24, Math.abs(spot.x) * 0.95)], target: [midX, 2, 0] };
}

/** ボールのすぐ後ろを追いかける。止まっているときは heading（前回の進行方向）を使う。 */
export function followView(ball: BallMotion, heading: readonly [number, number]): CameraView {
  const [px, py, pz] = ball.position;
  return {
    position: [px - heading[0] * 4.6, Math.max(0.9, py + 1.1), pz - heading[1] * 4.6],
    target: [px + heading[0] * 5, Math.max(0.6, py * 0.8), pz + heading[1] * 5],
  };
}

/** ゴールの瞬間を、ボールに近い側のゴール前から寄って見る（奥にネットが入る） */
export function goalView(ball: BallMotion): CameraView {
  const side = ball.position[2] >= 0 ? 1 : -1;
  return {
    position: [-7.5, 1.6, ball.position[2] + side * 3.4],
    target: [Math.min(ball.position[0], 1.2), Math.max(0.7, ball.position[1]), ball.position[2]],
  };
}
