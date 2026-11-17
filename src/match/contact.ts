/**
 * 接触の応答。法線方向は反発係数で跳ね返し、接線方向は摩擦で滑りを止める。
 * ボールは薄い球殻として扱う（I = 2/3·m·R²）。
 */
import { inertia, type PhysicsParams } from '../physics/params.ts';
import type { Contact } from './geometry.ts';

export interface Surface {
  readonly restitution: number;
  readonly friction: number;
}

/** これより遅い衝突は跳ね返さない（静止・転がりの接触として扱う）[m/s] */
export const REST_SPEED = 0.6;

/**
 * 状態 y（位置 0-2、速度 3-5、角速度 6-8）に接触の応答を書き込む。
 * 戻り値はぶつかった速さ（法線方向、離れていく向きなら 0）。
 */
export function applyContact(
  y: Float64Array,
  contact: Contact,
  surface: Surface,
  params: PhysicsParams,
): number {
  const [nx, ny, nz] = contact.normal;
  // めり込みを戻す
  y[0] += nx * contact.depth;
  y[1] += ny * contact.depth;
  y[2] += nz * contact.depth;

  const vn = y[3] * nx + y[4] * ny + y[5] * nz;
  if (vn >= 0) return 0;
  const impact = -vn;
  const m = params.mass;
  const R = params.radius;
  const e = impact < REST_SPEED ? 0 : surface.restitution;
  const jn = (1 + e) * m * impact;

  // 接触点の滑り速度 = 接線方向の速度 + ω × (−R·n)
  const sx = y[3] - vn * nx - R * (y[7] * nz - y[8] * ny);
  const sy = y[4] - vn * ny - R * (y[8] * nx - y[6] * nz);
  const sz = y[5] - vn * nz - R * (y[6] * ny - y[7] * nx);
  const slip = Math.hypot(sx, sy, sz);

  y[3] += (jn / m) * nx;
  y[4] += (jn / m) * ny;
  y[5] += (jn / m) * nz;

  if (slip > 1e-9) {
    const I = inertia(params);
    // 滑りをちょうど止める力積と、摩擦が出せる力積の小さいほう
    const jt = Math.min(surface.friction * jn, (m * slip) / (1 + (m * R * R) / I));
    const tx = -sx / slip, ty = -sy / slip, tz = -sz / slip;
    y[3] += (jt / m) * tx;
    y[4] += (jt / m) * ty;
    y[5] += (jt / m) * tz;
    // トルク = (−R·n) × (jt·t)
    const k = (-R * jt) / I;
    y[6] += k * (ny * tz - nz * ty);
    y[7] += k * (nz * tx - nx * tz);
    y[8] += k * (nx * ty - ny * tx);
  }
  return impact;
}
