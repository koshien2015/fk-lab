/**
 * カメラの置き方。
 */
import type { Spot } from '../field/placement.ts';
import type { Vec3 } from '../physics/types.ts';

export interface CameraView {
  readonly position: Vec3;
  readonly target: Vec3;
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
