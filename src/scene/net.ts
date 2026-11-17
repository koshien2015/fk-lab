/**
 * ゴールネット。背面・天井・両側面の 4 枚を、それぞれ膜モデルで揺らす。
 * ボールが当たった位置を中心に押し出され、波が広がって収まる（演出用）。
 */
import * as THREE from 'three';
import { FIELD } from '../field/dimensions.ts';
import { createMembrane, pokeMembrane, stepMembrane, type Membrane } from '../fx/membrane.ts';
import { NET_HALF_WIDTH, NET_TOP, netBackX } from '../match/goalFrame.ts';
import type { Vec3 } from '../physics/types.ts';

const SPACING = 0.15;
/** ぶつかった速さ [m/s] を、ネットを押す速さへ換算する係数と、押す範囲 [m] */
const POKE_GAIN = 0.42;
const POKE_RADIUS = 0.38;
/** 当たった点からこれより遠い面は揺らさない [m] */
const POKE_REACH = 0.7;
/** これより揺れが小さくなったら、頂点の更新を止める */
const REST = 1e-4;

interface PanelShape {
  /** 面上の点。s は横、t は縦（どちらも 0〜1） */
  at(s: number, t: number): Vec3;
  /** ゴールの外へ向かう法線 */
  readonly normal: Vec3;
  readonly width: number;
  readonly height: number;
}

const slope = Math.hypot(NET_TOP, FIELD.goalDepthBottom - FIELD.goalDepthTop);

const SHAPES: readonly PanelShape[] = [
  {
    // 背面
    at: (s, t) => [netBackX(t * NET_TOP), t * NET_TOP, (2 * s - 1) * NET_HALF_WIDTH],
    normal: [NET_TOP / slope, (FIELD.goalDepthBottom - FIELD.goalDepthTop) / slope, 0],
    width: 2 * NET_HALF_WIDTH,
    height: slope,
  },
  {
    // 天井
    at: (s, t) => [t * FIELD.goalDepthTop, NET_TOP, (2 * s - 1) * NET_HALF_WIDTH],
    normal: [0, 1, 0],
    width: 2 * NET_HALF_WIDTH,
    height: FIELD.goalDepthTop,
  },
  ...[-1, 1].map(
    (side): PanelShape => ({
      // 側面（台形）
      at: (s, t) => [s * netBackX(t * NET_TOP), t * NET_TOP, side * NET_HALF_WIDTH],
      normal: [0, 0, side],
      width: FIELD.goalDepthBottom,
      height: NET_TOP,
    }),
  ),
];

interface Panel {
  readonly shape: PanelShape;
  readonly membrane: Membrane;
  /** 揺れていないときの頂点の位置 */
  readonly rest: Float32Array;
  readonly positions: THREE.BufferAttribute;
  /** 揺れが残っているか */
  active: boolean;
}

function createPanel(shape: PanelShape, material: THREE.Material): { panel: Panel; lines: THREE.LineSegments } {
  const columns = Math.max(3, Math.round(shape.width / SPACING) + 1);
  const rows = Math.max(3, Math.round(shape.height / SPACING) + 1);
  const rest = new Float32Array(columns * rows * 3);
  const indices: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      rest.set(shape.at(c / (columns - 1), r / (rows - 1)), i * 3);
      if (c + 1 < columns) indices.push(i, i + 1);
      if (r + 1 < rows) indices.push(i, i + columns);
    }
  }
  const positions = new THREE.BufferAttribute(Float32Array.from(rest), 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setIndex(indices);
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  const membrane = createMembrane({ columns, rows, spacing: SPACING, waveSpeed: 4.2, damping: 2.2 });
  return { panel: { shape, membrane, rest, positions, active: false }, lines };
}

/** 面の中で、点 p にいちばん近い格子点と、そこまでの距離 */
function nearestNode(panel: Panel, p: Vec3): { column: number; row: number; distance: number } {
  const { columns } = panel.membrane.spec;
  let best = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < panel.rest.length / 3; i++) {
    const d2 =
      (panel.rest[i * 3] - p[0]) ** 2 + (panel.rest[i * 3 + 1] - p[1]) ** 2 + (panel.rest[i * 3 + 2] - p[2]) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return { column: best % columns, row: Math.floor(best / columns), distance: Math.sqrt(bestD2) };
}

export interface NetView {
  readonly object: THREE.Group;
  /** ボールが position に speed [m/s] で当たった */
  poke(position: Vec3, speed: number): void;
  update(dt: number): void;
}

export function createNet(): NetView {
  const object = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0xe8eef8, transparent: true, opacity: 0.4 });
  const panels = SHAPES.map((shape) => {
    const { panel, lines } = createPanel(shape, material);
    object.add(lines);
    return panel;
  });

  return {
    object,
    poke(position, speed) {
      for (const panel of panels) {
        const node = nearestNode(panel, position);
        if (node.distance > POKE_REACH) continue;
        // ボールが面の内側（ゴールの中）にいれば外へ、外側にいれば中へ押す
        const [nx, ny, nz] = panel.shape.normal;
        const i = (node.row * panel.membrane.spec.columns + node.column) * 3;
        const side =
          (position[0] - panel.rest[i]) * nx + (position[1] - panel.rest[i + 1]) * ny + (position[2] - panel.rest[i + 2]) * nz;
        pokeMembrane(panel.membrane, node.column, node.row, (side <= 0 ? 1 : -1) * speed * POKE_GAIN, POKE_RADIUS);
        panel.active = true;
      }
    },
    update(dt) {
      for (const panel of panels) {
        if (!panel.active) continue;
        stepMembrane(panel.membrane, dt);
        const [nx, ny, nz] = panel.shape.normal;
        const out = panel.positions.array as Float32Array;
        let largest = 0;
        for (let i = 0; i < panel.membrane.offset.length; i++) {
          const u = panel.membrane.offset[i];
          largest = Math.max(largest, Math.abs(u), Math.abs(panel.membrane.velocity[i]) * 0.1);
          out[i * 3] = panel.rest[i * 3] + nx * u;
          out[i * 3 + 1] = panel.rest[i * 3 + 1] + ny * u;
          out[i * 3 + 2] = panel.rest[i * 3 + 2] + nz * u;
        }
        panel.positions.needsUpdate = true;
        panel.active = largest > REST;
      }
    },
  };
}
