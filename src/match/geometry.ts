/**
 * 衝突判定の幾何。
 */
import type { Vec3 } from '../physics/types.ts';

/** 両端が半球の円柱（ポスト、選手の体） */
export interface Capsule {
  readonly a: Vec3;
  readonly b: Vec3;
  readonly radius: number;
}

/** 接触の情報。法線は相手からボールへ向かう単位ベクトル。 */
export interface Contact {
  readonly normal: Vec3;
  /** めり込みの深さ [m] */
  readonly depth: number;
}

/** 球（中心 c、半径 r）とカプセルの接触。離れていれば null。 */
export function sphereCapsuleContact(c: Vec3, r: number, capsule: Capsule): Contact | null {
  const { a, b } = capsule;
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const lengthSq = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const along = (c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2];
  const k = lengthSq > 0 ? Math.min(1, Math.max(0, along / lengthSq)) : 0;
  const dx = c[0] - (a[0] + ab[0] * k);
  const dy = c[1] - (a[1] + ab[1] * k);
  const dz = c[2] - (a[2] + ab[2] * k);
  const distance = Math.hypot(dx, dy, dz);
  const depth = r + capsule.radius - distance;
  if (depth <= 0) return null;
  // 中心が軸の真上にあるときは、キッカーの側へ押し返す
  const normal: Vec3 = distance > 1e-9 ? [dx / distance, dy / distance, dz / distance] : [-1, 0, 0];
  return { normal, depth };
}
