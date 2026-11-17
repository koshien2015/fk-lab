/**
 * ボールに働く力を、色分けした矢印で表示する。回転軸も細い棒で示す。
 */
import * as THREE from 'three';
import { FORCE_STYLES } from '../analysis/forces.ts';
import type { BallSample } from '../playback/sample.ts';
import type { Vec3 } from '../physics/types.ts';

/** 力 1 N を何 m の矢印にするか */
const METERS_PER_NEWTON = 0.28;
const SHAFT_RADIUS = 0.035;
const HEAD_LENGTH = 0.2;
const HEAD_RADIUS = 0.09;
/** これより小さい力 [N] は描かない */
const MIN_FORCE = 0.03;
const SPIN_AXIS_COLOR = '#d6a2ff';
const UP = new THREE.Vector3(0, 1, 0);

interface Arrow {
  readonly group: THREE.Group;
  point(vector: Vec3): void;
}

function createArrow(color: string): Arrow {
  const material = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_RADIUS, SHAFT_RADIUS, 1, 10), material);
  const head = new THREE.Mesh(new THREE.ConeGeometry(HEAD_RADIUS, HEAD_LENGTH, 14), material);
  shaft.renderOrder = 20;
  head.renderOrder = 20;
  const group = new THREE.Group();
  group.add(shaft, head);
  const direction = new THREE.Vector3();

  return {
    group,
    point(vector) {
      const force = Math.hypot(vector[0], vector[1], vector[2]);
      group.visible = force > MIN_FORCE;
      if (!group.visible) return;
      const length = force * METERS_PER_NEWTON;
      const shaftLength = Math.max(0.01, length - HEAD_LENGTH);
      shaft.scale.y = shaftLength;
      shaft.position.y = shaftLength / 2;
      head.position.y = shaftLength + HEAD_LENGTH / 2;
      direction.set(vector[0] / force, vector[1] / force, vector[2] / force);
      group.quaternion.setFromUnitVectors(UP, direction);
    },
  };
}

export interface ForceArrows {
  readonly object: THREE.Group;
  update(sample: BallSample): void;
  setVisible(visible: boolean): void;
}

export function createForceArrows(ballRadius: number): ForceArrows {
  const object = new THREE.Group();
  const arrows = FORCE_STYLES.map((style) => ({ style, arrow: createArrow(style.color) }));
  const spinAxis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, ballRadius * 5, 8),
    new THREE.MeshBasicMaterial({ color: SPIN_AXIS_COLOR, depthTest: false, transparent: true, opacity: 0.9 }),
  );
  spinAxis.renderOrder = 19;
  object.add(spinAxis, ...arrows.map(({ arrow }) => arrow.group));
  const axis = new THREE.Vector3();

  return {
    object,
    update(sample) {
      object.position.set(sample.position[0], sample.position[1], sample.position[2]);
      for (const { style, arrow } of arrows) arrow.point(sample.forces[style.key]);
      const spin = Math.hypot(sample.omega[0], sample.omega[1], sample.omega[2]);
      spinAxis.visible = spin > 1;
      if (spinAxis.visible) {
        axis.set(sample.omega[0] / spin, sample.omega[1] / spin, sample.omega[2] / spin);
        spinAxis.quaternion.setFromUnitVectors(UP, axis);
      }
    },
    setVisible(visible) {
      object.visible = visible;
    },
  };
}
