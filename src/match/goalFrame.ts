/**
 * ゴールの形（ポスト、クロスバー、ネットの面）と、ゴールに入ったかどうかの判定。
 */
import { FIELD } from '../field/dimensions.ts';
import type { Vec3 } from '../physics/types.ts';
import type { Capsule, Contact } from './geometry.ts';

const r = FIELD.postRadius;
const HALF_MOUTH = FIELD.goalWidth / 2;
/** ネットの上端の高さと、左右の面の z */
export const NET_TOP = FIELD.goalHeight + r;
export const NET_HALF_WIDTH = HALF_MOUTH + r;

/** ポスト 2 本とクロスバー */
export const FRAME_CAPSULES: readonly Capsule[] = [
  { a: [0, 0, -NET_HALF_WIDTH], b: [0, NET_TOP, -NET_HALF_WIDTH], radius: r },
  { a: [0, 0, NET_HALF_WIDTH], b: [0, NET_TOP, NET_HALF_WIDTH], radius: r },
  { a: [0, NET_TOP, -NET_HALF_WIDTH], b: [0, NET_TOP, NET_HALF_WIDTH], radius: r },
];

/** 高さ y での、ネット背面の奥行き */
export function netBackX(y: number): number {
  return FIELD.goalDepthBottom + ((FIELD.goalDepthTop - FIELD.goalDepthBottom) * y) / NET_TOP;
}

interface NetSurface {
  readonly point: Vec3;
  readonly normal: Vec3;
  /** 面に下ろした足が、ネットの張られた範囲にあるか */
  contains(x: number, y: number, z: number): boolean;
}

const slope = Math.hypot(NET_TOP, FIELD.goalDepthBottom - FIELD.goalDepthTop);
const within = (v: number, lo: number, hi: number): boolean => v >= lo && v <= hi;

const NET_SURFACES: readonly NetSurface[] = [
  {
    // 背面（上へ行くほど手前に傾く）
    point: [FIELD.goalDepthBottom, 0, 0],
    normal: [NET_TOP / slope, (FIELD.goalDepthBottom - FIELD.goalDepthTop) / slope, 0],
    contains: (_x, y, z) => within(y, 0, NET_TOP) && within(z, -NET_HALF_WIDTH, NET_HALF_WIDTH),
  },
  {
    // 天井
    point: [0, NET_TOP, 0],
    normal: [0, 1, 0],
    contains: (x, _y, z) => within(x, r, FIELD.goalDepthTop) && within(z, -NET_HALF_WIDTH, NET_HALF_WIDTH),
  },
  ...[-1, 1].map(
    (side): NetSurface => ({
      // 側面
      point: [0, 0, side * NET_HALF_WIDTH],
      normal: [0, 0, side],
      contains: (x, y) => within(y, 0, NET_TOP) && within(x, r, netBackX(y)),
    }),
  ),
];

/** 球とネットの接触（どちらの面からでも当たる）。最初に見つかった面を返す。 */
export function netContact(c: Vec3, radius: number): Contact | null {
  for (const surface of NET_SURFACES) {
    const [nx, ny, nz] = surface.normal;
    const signed =
      (c[0] - surface.point[0]) * nx + (c[1] - surface.point[1]) * ny + (c[2] - surface.point[2]) * nz;
    const depth = radius - Math.abs(signed);
    if (depth <= 0) continue;
    if (!surface.contains(c[0] - signed * nx, c[1] - signed * ny, c[2] - signed * nz)) continue;
    const sign = signed >= 0 ? 1 : -1;
    return { normal: [sign * nx, sign * ny, sign * nz], depth };
  }
  return null;
}

/** ボール全体がゴールラインを越えて、枠の中にあるか */
export function isInsideGoal(c: Vec3, radius: number): boolean {
  return (
    c[0] > radius &&
    c[0] < FIELD.goalDepthBottom + radius &&
    Math.abs(c[2]) < HALF_MOUTH &&
    c[1] < FIELD.goalHeight
  );
}
