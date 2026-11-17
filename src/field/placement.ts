/**
 * ボールを置ける場所と、そこからゴールを見た向き。
 */
import { FIELD } from './dimensions.ts';

export interface Spot {
  readonly x: number;
  readonly z: number;
}

/** ゴールラインからこれより近くには置けない [m] */
const MIN_DISTANCE_FROM_GOAL_LINE = 6;
/** タッチラインからの余白 [m] */
const SIDE_MARGIN = 1;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** 攻撃側の半分に収める */
export function clampBallSpot(spot: Spot): Spot {
  const halfW = FIELD.width / 2 - SIDE_MARGIN;
  return {
    x: clamp(spot.x, -FIELD.length / 2, -MIN_DISTANCE_FROM_GOAL_LINE),
    z: clamp(spot.z, -halfW, halfW),
  };
}

/** ゴール中央を向く方位角 [度]（+x が 0、右が正） */
export function aimAzimuthDeg(spot: Spot): number {
  return (Math.atan2(-spot.z, -spot.x) * 180) / Math.PI;
}

export function distanceToGoal(spot: Spot): number {
  return Math.hypot(spot.x, spot.z);
}
