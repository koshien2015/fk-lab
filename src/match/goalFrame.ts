/**
 * ゴールの枠（ポスト、クロスバー）と、ゴールに入ったかどうかの判定。ネットは netCloth.ts で計算する。
 */
import { FIELD } from '../field/dimensions.ts';
import type { Vec3 } from '../physics/types.ts';
import type { Capsule } from './geometry.ts';

const r = FIELD.postRadius;
const HALF_MOUTH = FIELD.goalWidth / 2;
/** ネットの上端の高さと、左右の面の z */
const NET_TOP = FIELD.goalHeight + r;
const NET_HALF_WIDTH = HALF_MOUTH + r;

/** ポスト 2 本とクロスバー */
export const FRAME_CAPSULES: readonly Capsule[] = [
  { a: [0, 0, -NET_HALF_WIDTH], b: [0, NET_TOP, -NET_HALF_WIDTH], radius: r },
  { a: [0, 0, NET_HALF_WIDTH], b: [0, NET_TOP, NET_HALF_WIDTH], radius: r },
  { a: [0, NET_TOP, -NET_HALF_WIDTH], b: [0, NET_TOP, NET_HALF_WIDTH], radius: r },
];

/** ボール全体がゴールラインを越えて、枠の中にあるか */
export function isInsideGoal(c: Vec3, radius: number): boolean {
  return (
    c[0] > radius &&
    c[0] < FIELD.goalDepthBottom + radius &&
    Math.abs(c[2]) < HALF_MOUTH &&
    c[1] < FIELD.goalHeight
  );
}
