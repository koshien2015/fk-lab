/**
 * サッカーボールのパネル模様（切頂二十面体: 五角形 12 枚 + 六角形 20 枚）を計算で作る。
 * 画像は使わない。
 *
 * 球の中心から方向 d へ伸ばした半直線が、切頂二十面体のどの面に当たるかで決める。
 * 面 i の法線を n_i、中心からの距離を h_i とすると、当たる面は d·n_i / h_i が最大の面。
 */
import type { Vec3 } from '../physics/types.ts';

const PHI = (1 + Math.sqrt(5)) / 2;

const normalize = (v: Vec3): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
};
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 正二十面体の頂点 = 五角形パネルの中心 */
export const ICOSAHEDRON_VERTICES: readonly Vec3[] = [-1, 1].flatMap((a) =>
  [-PHI, PHI].flatMap((b): Vec3[] => [
    normalize([0, a, b]),
    normalize([a, b, 0]),
    normalize([b, 0, a]),
  ]),
);

/** 隣り合う頂点どうしの内積（辺の両端） */
const EDGE_DOT = 1 / Math.sqrt(5);
const isEdge = (a: Vec3, b: Vec3): boolean => Math.abs(dot(a, b) - EDGE_DOT) < 1e-9;

/** 正二十面体の面の中心 = 六角形パネルの中心 */
export const ICOSAHEDRON_FACE_CENTERS: readonly Vec3[] = ICOSAHEDRON_VERTICES.flatMap((a, i) =>
  ICOSAHEDRON_VERTICES.flatMap((b, j) =>
    ICOSAHEDRON_VERTICES.flatMap((c, k): Vec3[] =>
      i < j && j < k && isEdge(a, b) && isEdge(b, c) && isEdge(a, c)
        ? [normalize([a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]])]
        : [],
    ),
  ),
);

// 辺の長さを 1 とした切頂二十面体の、中心から各面までの距離
const PENTAGON_DISTANCE = 0.5 * Math.sqrt((125 + 41 * Math.sqrt(5)) / 10);
const HEXAGON_DISTANCE = 0.5 * Math.sqrt(1.5 * (7 + 3 * Math.sqrt(5)));

export interface Panel {
  readonly kind: 'pentagon' | 'hexagon';
  /** パネルの境目からの離れ具合（0 が境目。縫い目を描くのに使う） */
  readonly edgeDistance: number;
}

export function panelAt(direction: Vec3): Panel {
  let best = -Infinity;
  let second = -Infinity;
  let kind: Panel['kind'] = 'hexagon';
  const consider = (center: Vec3, distance: number, candidate: Panel['kind']): void => {
    const score = dot(direction, center) / distance;
    if (score > best) {
      second = best;
      best = score;
      kind = candidate;
    } else if (score > second) {
      second = score;
    }
  };
  for (const v of ICOSAHEDRON_VERTICES) consider(v, PENTAGON_DISTANCE, 'pentagon');
  for (const c of ICOSAHEDRON_FACE_CENTERS) consider(c, HEXAGON_DISTANCE, 'hexagon');
  return { kind, edgeDistance: best - second };
}
