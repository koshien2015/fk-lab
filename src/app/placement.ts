/**
 * ボールを置く位置を、ピッチをクリックまたはドラッグして選ぶ。
 */
import * as THREE from 'three';
import { clampBallSpot, type Spot } from '../field/placement.ts';
import type { Stage } from '../scene/stage.ts';

export interface Placement {
  /** ボールの位置を示す輪 */
  readonly marker: THREE.Object3D;
  setActive(active: boolean): void;
  isActive(): boolean;
  showAt(spot: Spot): void;
}

export function createPlacement(stage: Stage, onPick: (spot: Spot) => void): Placement {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.0, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.9, depthTest: false }),
  );
  marker.renderOrder = 10;
  marker.visible = false;
  let active = false;

  const pick = (event: PointerEvent): void => {
    const point = stage.groundPoint(event.clientX, event.clientY);
    if (point) onPick(clampBallSpot(point));
  };
  stage.canvas.addEventListener('pointerdown', (event) => {
    if (!active) return;
    stage.canvas.setPointerCapture(event.pointerId);
    pick(event);
  });
  stage.canvas.addEventListener('pointermove', (event) => {
    if (active && stage.canvas.hasPointerCapture(event.pointerId)) pick(event);
  });

  return {
    marker,
    setActive(next) {
      active = next;
      marker.visible = next;
      stage.controls.enabled = !next;
    },
    isActive: () => active,
    showAt(spot) {
      marker.position.set(spot.x, 0.03, spot.z);
    },
  };
}
