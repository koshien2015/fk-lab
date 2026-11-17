import * as THREE from 'three';
import type { BallSample } from '../playback/sample.ts';
import { createBallTexture } from './ballTexture.ts';

export interface BallView {
  readonly mesh: THREE.Mesh;
  /** 再生中の状態を見た目に反映する */
  show(sample: Pick<BallSample, 'position' | 'quaternion'>): void;
}

export function createBall(radius: number): BallView {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 32),
    new THREE.MeshStandardMaterial({ map: createBallTexture(), roughness: 0.38, metalness: 0.02 }),
  );
  mesh.castShadow = true;
  return {
    mesh,
    show({ position, quaternion }) {
      mesh.position.set(position[0], position[1], position[2]);
      mesh.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
    },
  };
}
