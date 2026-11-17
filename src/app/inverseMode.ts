/**
 * 逆算モードの操作。ゴールの中をクリックして、狙う点を選ぶ。
 */
import * as THREE from 'three';
import { FIELD } from '../field/dimensions.ts';
import type { Stage } from '../scene/stage.ts';
import type { GoalTarget } from '../solver/inverse.ts';

export interface InverseMode {
  /** 狙う点の印 */
  readonly marker: THREE.Object3D;
  setActive(active: boolean): void;
  isActive(): boolean;
  showTarget(target: GoalTarget | null): void;
}

/** これより大きく動いたら、クリックではなく視点のドラッグとみなす [px] */
const CLICK_SLOP = 6;
/** 枠の少し外をクリックしても、近くの枠内を狙ったものとして受ける [m] */
const TOLERANCE = 0.6;

export function createInverseMode(stage: Stage, onPick: (target: GoalTarget) => void): InverseMode {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.24, 40).rotateY(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, depthTest: false, transparent: true }),
  );
  marker.renderOrder = 15;
  marker.visible = false;
  let active = false;
  let down: { readonly x: number; readonly y: number } | null = null;

  stage.canvas.addEventListener('pointerdown', (event) => {
    down = { x: event.clientX, y: event.clientY };
  });
  stage.canvas.addEventListener('pointerup', (event) => {
    const start = down;
    down = null;
    if (!active || !start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP) return;
    const point = stage.goalPlanePoint(event.clientX, event.clientY);
    if (!point) return;
    const inside =
      Math.abs(point.z) < FIELD.goalWidth / 2 + TOLERANCE &&
      point.y > -TOLERANCE &&
      point.y < FIELD.goalHeight + TOLERANCE;
    if (inside) onPick(point);
  });

  return {
    marker,
    setActive(next) {
      active = next;
      stage.canvas.style.cursor = next ? 'crosshair' : '';
    },
    isActive: () => active,
    showTarget(target) {
      marker.visible = target !== null;
      if (target) marker.position.set(-0.05, target.y, target.z);
    },
  };
}
