/**
 * ナイターのスタジアム（照明塔、スタンド、広告ボード、照明）。すべてコードで作る。
 */
import * as THREE from 'three';
import { FIELD } from '../field/dimensions.ts';
import { createRng } from '../physics/rng.ts';

const MID_X = -FIELD.length / 2;
/** ピッチの端からスタンドまでの距離と、スタンドの奥行き・高さ [m] */
const STAND_GAP = 13;
const STAND_DEPTH = 24;
const STAND_HEIGHT = 11;
const TOWER_HEIGHT = 34;
const BOARD_LENGTH = 64;
const BOARD_HEIGHT = 0.9;

/** 観客席の模様（席の列と、色とりどりの観客の点） */
function createCrowdTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D が使えません');
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rng = createRng(1997);
  const rows = 34;
  const rowHeight = canvas.height / rows;
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < canvas.width; x += 3) {
      if (rng() < 0.3) continue;
      // 暗がりの観客: 彩度と明るさを抑える
      const hue = rng() < 0.6 ? 205 + rng() * 40 : rng() * 360;
      ctx.fillStyle = `hsl(${hue} ${10 + rng() * 30}% ${9 + rng() * 17}%)`;
      ctx.fillRect(x, row * rowHeight + 1.5, 2, rowHeight - 3);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/** ピッチの外へ向かって高くなる、斜めのスタンド 1 面 */
function stand(length: number, material: THREE.Material): THREE.Mesh {
  const slant = Math.hypot(STAND_DEPTH, STAND_HEIGHT);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, slant), material);
  // 板を寝かせてから、奥が高くなるよう起こす
  mesh.rotation.x = -Math.PI / 2 + Math.atan2(STAND_HEIGHT, STAND_DEPTH);
  return mesh;
}

function createStands(): THREE.Group {
  const group = new THREE.Group();
  const texture = createCrowdTexture();
  const halfW = FIELD.width / 2 + STAND_GAP + STAND_DEPTH / 2;
  const halfL = FIELD.length / 2 + STAND_GAP + STAND_DEPTH / 2;
  const sides: ReadonlyArray<{ length: number; x: number; z: number; turn: number }> = [
    { length: FIELD.length + 50, x: MID_X, z: -halfW, turn: 0 },
    { length: FIELD.length + 50, x: MID_X, z: halfW, turn: Math.PI },
    { length: FIELD.width + 50, x: MID_X + halfL, z: 0, turn: -Math.PI / 2 },
    { length: FIELD.width + 50, x: MID_X - halfL, z: 0, turn: Math.PI / 2 },
  ];
  for (const side of sides) {
    const map = texture.clone();
    map.repeat.set(side.length / 45, 1);
    map.needsUpdate = true;
    const pivot = new THREE.Group();
    // 照明はピッチに向いているので、スタンドは光を受けない暗い面として描く
    pivot.add(stand(side.length, new THREE.MeshBasicMaterial({ map })));
    pivot.position.set(side.x, STAND_HEIGHT / 2 + 0.5, side.z);
    pivot.rotation.y = side.turn;
    group.add(pivot);
  }
  return group;
}

/** 光の玉に見える、中心が明るい円の模様 */
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D が使えません');
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.25, 'rgba(235, 244, 255, 0.55)');
  gradient.addColorStop(1, 'rgba(200, 220, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createTowers(): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.MeshStandardMaterial({ color: 0x30384a, roughness: 0.7 });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
  const glow = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const offsetX = FIELD.length / 2 + STAND_GAP + STAND_DEPTH + 4;
  const offsetZ = FIELD.width / 2 + STAND_GAP + STAND_DEPTH + 4;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tower = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1, TOWER_HEIGHT, 1), pole);
      mast.position.y = TOWER_HEIGHT / 2;
      const head = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 0.6), lamp);
      head.position.y = TOWER_HEIGHT + 1.5;
      const halo = new THREE.Sprite(glow);
      halo.scale.set(26, 26, 1);
      halo.position.y = TOWER_HEIGHT + 1.5;
      tower.add(mast, head, halo);
      tower.position.set(MID_X + sx * offsetX, 0, sz * offsetZ);
      // 照明の面をピッチの中央へ向ける
      tower.rotation.y = Math.atan2(-sx * offsetX, -sz * offsetZ);
      group.add(tower);
    }
  }
  return group;
}

/** ゴール裏の広告ボード。文字も模様もコードで描く。 */
function createBoards(): THREE.Group {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D が使えません');
  const labels = ['FK LAB', 'PHYSICS', 'MAGNUS', 'KNUCKLE', 'DRAG CRISIS'];
  const tones = ['#12305a', '#5a1230', '#0f4a3a', '#4a3a0f', '#2a1a5a'];
  const width = canvas.width / labels.length;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  labels.forEach((label, i) => {
    ctx.fillStyle = tones[i];
    ctx.fillRect(i * width, 0, width, canvas.height);
    ctx.fillStyle = '#eaf2ff';
    ctx.fillText(label, (i + 0.5) * width, canvas.height / 2 + 2);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  // 文字が横に伸びないよう、板の縦横比に合わせて繰り返す
  texture.repeat.set(BOARD_LENGTH / BOARD_HEIGHT / (canvas.width / canvas.height), 1);
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: 0x223355, emissiveIntensity: 0.25 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_LENGTH, BOARD_HEIGHT), material);
  board.position.set(6.5, BOARD_HEIGHT / 2, 0);
  board.rotation.y = -Math.PI / 2;
  group.add(board);
  return group;
}

/** ナイターの照明。影を落とすのは主光源の 1 灯だけ（スマホでも 60fps を保つため）。 */
function createLights(): THREE.Object3D[] {
  const sky = new THREE.HemisphereLight(0x8fa8e0, 0x16301a, 0.55);
  const key = new THREE.DirectionalLight(0xf2f6ff, 2.0);
  key.position.set(-52, 44, 34);
  key.target.position.set(-14, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -36;
  key.shadow.camera.right = 36;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 140;
  key.shadow.bias = -0.0004;
  // 残りの 3 本の照明塔からの光（影なし）
  const fills = [
    [30, 40, 40],
    [30, 40, -40],
    [-52, 44, -34],
  ].map(([x, y, z]) => {
    const light = new THREE.DirectionalLight(0xdfe8ff, 0.55);
    light.position.set(x, y, z);
    light.target.position.set(-14, 0, 0);
    return light;
  });
  return [sky, key, key.target, ...fills.flatMap((light) => [light, light.target])];
}

export function createStadium(): THREE.Group {
  const group = new THREE.Group();
  group.add(createStands(), createTowers(), createBoards(), ...createLights());
  return group;
}
