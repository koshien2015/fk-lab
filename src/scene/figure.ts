/**
 * 箱を組み合わせた選手の人形（ボクセル調）。足もとが原点で、−x の側（キッカー）を向く。
 */
import * as THREE from 'three';

export interface FigureStyle {
  readonly shirt: number;
  readonly shorts: number;
  readonly socks: number;
  /** 腕を上へ伸ばす（GK）か、体の前で組む（壁）か */
  readonly arms: 'up' | 'guard';
  readonly gloves?: number;
}

const SKIN = 0xe0b08c;
const HAIR = 0x2a2018;

function box(
  size: readonly [number, number, number],
  center: readonly [number, number, number],
  color: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  mesh.position.set(center[0], center[1], center[2]);
  mesh.castShadow = true;
  return mesh;
}

/** 身長 約 1.8 m の人形。腕を上げると指先まで 約 2.35 m。 */
export function createFigure(style: FigureStyle): THREE.Group {
  const group = new THREE.Group();
  const hands = style.gloves ?? SKIN;
  for (const side of [-1, 1]) {
    group.add(
      box([0.16, 0.42, 0.17], [0, 0.21, side * 0.11], style.socks),
      box([0.17, 0.44, 0.19], [0, 0.63, side * 0.11], style.shorts),
    );
    if (style.arms === 'up') {
      group.add(
        box([0.13, 0.62, 0.13], [0, 1.72, side * 0.27], style.shirt),
        box([0.16, 0.2, 0.16], [0, 2.13, side * 0.27], hands),
      );
    } else {
      group.add(
        box([0.13, 0.5, 0.13], [0, 1.15, side * 0.3], style.shirt),
        box([0.14, 0.14, 0.2], [-0.13, 0.9, side * 0.1], hands),
      );
    }
  }
  group.add(
    box([0.26, 0.6, 0.46], [0, 1.15, 0], style.shirt),
    box([0.12, 0.1, 0.14], [0, 1.5, 0], SKIN),
    box([0.24, 0.25, 0.24], [0, 1.67, 0], SKIN),
    box([0.25, 0.07, 0.25], [0.01, 1.8, 0], HAIR),
  );
  return group;
}
