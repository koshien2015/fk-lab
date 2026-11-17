/**
 * ピッチ（芝の縞模様とライン）。画像を使わず、すべてコードで描く。
 */
import * as THREE from 'three';
import { FIELD } from '../field/dimensions.ts';
import { createRng } from '../physics/rng.ts';

const LINE_Y = 0.006;
const SURROUND = 14;

function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D が使えません');
  const stripes = 20;
  const stripeWidth = canvas.width / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2f7d32' : '#35893a';
    ctx.fillRect(i * stripeWidth, 0, stripeWidth + 1, canvas.height);
  }
  // 芝のざらつき
  const rng = createRng(20240601);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (rng() - 0.5) * 26;
    image.data[i] += noise * 0.6;
    image.data[i + 1] += noise;
    image.data[i + 2] += noise * 0.5;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  return texture;
}

const lineMaterial = new THREE.MeshStandardMaterial({
  color: 0xf4f7f2,
  roughness: 0.9,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});

/** 2 点を結ぶ白線 */
function strip(x0: number, z0: number, x1: number, z1: number): THREE.Mesh {
  const length = Math.hypot(x1 - x0, z1 - z0) + FIELD.lineWidth;
  const geometry = new THREE.PlaneGeometry(length, FIELD.lineWidth).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, lineMaterial);
  mesh.position.set((x0 + x1) / 2, LINE_Y, (z0 + z1) / 2);
  mesh.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  return mesh;
}

/** 長方形の枠線 */
function box(x0: number, z0: number, x1: number, z1: number): THREE.Mesh[] {
  return [strip(x0, z0, x1, z0), strip(x1, z0, x1, z1), strip(x1, z1, x0, z1), strip(x0, z1, x0, z0)];
}

/** 円弧。角度 φ の点は (cx + r·cos φ, cz − r·sin φ)。 */
function arc(cx: number, cz: number, radius: number, start: number, sweep: number): THREE.Mesh {
  const half = FIELD.lineWidth / 2;
  const geometry = new THREE.RingGeometry(radius - half, radius + half, 64, 1, start, sweep);
  const mesh = new THREE.Mesh(geometry.rotateX(-Math.PI / 2), lineMaterial);
  mesh.position.set(cx, LINE_Y, cz);
  return mesh;
}

function spot(x: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24).rotateX(-Math.PI / 2), lineMaterial);
  mesh.position.set(x, LINE_Y, z);
  return mesh;
}

/** ゴールライン x = goalX の側のペナルティエリアまわり。inward はピッチの内側へ向かう向き（±1）。 */
function goalEnd(goalX: number, inward: 1 | -1): THREE.Mesh[] {
  const spotX = goalX + inward * FIELD.penaltySpotDistance;
  const reach = Math.acos((FIELD.penaltyAreaDepth - FIELD.penaltySpotDistance) / FIELD.circleRadius);
  const center = inward === 1 ? 0 : Math.PI;
  return [
    ...box(goalX, -FIELD.penaltyAreaWidth / 2, goalX + inward * FIELD.penaltyAreaDepth, FIELD.penaltyAreaWidth / 2),
    ...box(goalX, -FIELD.goalAreaWidth / 2, goalX + inward * FIELD.goalAreaDepth, FIELD.goalAreaWidth / 2),
    spot(spotX, 0),
    arc(spotX, 0, FIELD.circleRadius, center - reach, 2 * reach),
  ];
}

export function createPitch(): THREE.Group {
  const group = new THREE.Group();
  const halfW = FIELD.width / 2;
  const midX = -FIELD.length / 2;

  const surround = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.length + SURROUND * 2, FIELD.width + SURROUND * 2).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1f5a24, roughness: 1 }),
  );
  surround.position.set(midX, -0.01, 0);
  surround.receiveShadow = true;

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.length, FIELD.width).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: createGrassTexture(), roughness: 0.95 }),
  );
  grass.position.set(midX, 0, 0);
  grass.receiveShadow = true;

  const quarter = Math.PI / 2;
  const r = FIELD.cornerArcRadius;
  group.add(
    surround,
    grass,
    ...box(-FIELD.length, -halfW, 0, halfW),
    strip(midX, -halfW, midX, halfW),
    arc(midX, 0, FIELD.circleRadius, 0, Math.PI * 2),
    spot(midX, 0),
    ...goalEnd(0, -1),
    ...goalEnd(-FIELD.length, 1),
    arc(0, halfW, r, quarter, quarter),
    arc(0, -halfW, r, Math.PI, quarter),
    arc(-FIELD.length, halfW, r, 0, quarter),
    arc(-FIELD.length, -halfW, r, 3 * quarter, quarter),
  );
  return group;
}
