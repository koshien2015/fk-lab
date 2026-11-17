/**
 * 逆算の途中で試した軌道を、薄い線で順に重ねて見せる。
 */
import * as THREE from 'three';

/** すべての線を出し終えるまでの時間と、そのあと消えるまでの時間 [s] */
const REVEAL = 0.9;
const LINGER = 0.9;
const OPACITY = 0.22;

export interface SearchLines {
  readonly object: THREE.Group;
  play(paths: readonly Float32Array[]): void;
  clear(): void;
  /** 毎フレーム呼ぶ */
  update(dt: number): void;
}

export function createSearchLines(): SearchLines {
  const object = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: OPACITY });
  let elapsed = 0;

  const clear = (): void => {
    for (const line of [...object.children]) {
      (line as THREE.Line).geometry.dispose();
      object.remove(line);
    }
  };

  return {
    object,
    clear,
    play(paths) {
      clear();
      elapsed = 0;
      material.opacity = OPACITY;
      for (const path of paths) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(path, 3));
        const line = new THREE.Line(geometry, material);
        line.visible = false;
        line.frustumCulled = false;
        object.add(line);
      }
    },
    update(dt) {
      const count = object.children.length;
      if (count === 0) return;
      elapsed += dt;
      const shown = Math.ceil((Math.min(elapsed, REVEAL) / REVEAL) * count);
      object.children.forEach((line, i) => (line.visible = i < shown));
      const fade = (elapsed - REVEAL) / LINGER;
      material.opacity = OPACITY * (1 - Math.min(1, Math.max(0, fade)));
      if (fade >= 1) clear();
    },
  };
}
