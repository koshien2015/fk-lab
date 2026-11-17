/**
 * ゴール（ポスト、クロスバー、ネット）。ゴールラインは x = 0、ネットは x > 0 の側。
 * ネットはここでは動かない線の格子。揺れる表現はマイルストーン 7 で入れる。
 */
import * as THREE from 'three';
import { FIELD } from '../field/dimensions.ts';

const NET_SPACING = 0.15;

/** lo から hi までを、およそ spacing ごとに等分した値の並び */
function divide(lo: number, hi: number, spacing: number): number[] {
  const count = Math.max(1, Math.round((hi - lo) / spacing));
  return Array.from({ length: count + 1 }, (_, i) => lo + ((hi - lo) * i) / count);
}

type Point = readonly [number, number, number];

/** ネットを作る線分の端点を集める */
function netSegments(): number[] {
  const r = FIELD.postRadius;
  const top = FIELD.goalHeight + r;
  const halfW = FIELD.goalWidth / 2 + r;
  const { goalDepthTop: dTop, goalDepthBottom: dBottom } = FIELD;
  /** 高さ y での、ネット背面の奥行き */
  const backX = (y: number): number => dBottom + ((dTop - dBottom) * y) / top;
  const out: number[] = [];
  const push = (a: Point, b: Point): void => void out.push(...a, ...b);

  const zs = divide(-halfW, halfW, NET_SPACING);
  const ys = divide(0, top, NET_SPACING);
  const roofXs = divide(0, dTop, NET_SPACING);
  const sideXs = divide(0, dBottom, NET_SPACING);

  // 背面と天井
  for (const z of zs) {
    push([dBottom, 0, z], [dTop, top, z]);
    push([dTop, top, z], [0, top, z]);
  }
  for (const y of ys) push([backX(y), y, -halfW], [backX(y), y, halfW]);
  for (const x of roofXs) push([x, top, -halfW], [x, top, halfW]);

  // 両側面（台形）
  for (const z of [-halfW, halfW]) {
    for (const y of ys) push([0, y, z], [backX(y), y, z]);
    for (const x of sideXs) {
      const height = x <= dTop ? top : (top * (dBottom - x)) / (dBottom - dTop);
      push([x, 0, z], [x, height, z]);
    }
  }
  return out;
}

export function createGoal(): THREE.Group {
  const group = new THREE.Group();
  const r = FIELD.postRadius;
  const frame = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
  const postHeight = FIELD.goalHeight + r;

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(r, r, postHeight, 20), frame);
    post.position.set(0, postHeight / 2, side * (FIELD.goalWidth / 2 + r));
    post.castShadow = true;
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, FIELD.goalWidth + 4 * r, 20), frame);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, postHeight, 0);
  bar.castShadow = true;
  group.add(bar);

  const netGeometry = new THREE.BufferGeometry();
  netGeometry.setAttribute('position', new THREE.Float32BufferAttribute(netSegments(), 3));
  const net = new THREE.LineSegments(
    netGeometry,
    new THREE.LineBasicMaterial({ color: 0xe8eef8, transparent: true, opacity: 0.38 }),
  );
  group.add(net);
  return group;
}
