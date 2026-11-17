/**
 * ゴールの瞬間に舞う紙吹雪。
 */
import * as THREE from 'three';
import { createRng } from '../physics/rng.ts';
import type { Vec3 } from '../physics/types.ts';

const COUNT = 320;
const LIFETIME = 3.2;
const GRAVITY = 3.2;
const COLORS = [0xffd166, 0xffffff, 0x5ad1ff, 0xff8fab];

export interface Confetti {
  readonly object: THREE.Points;
  /** origin から吹き出す */
  burst(origin: Vec3): void;
  update(dt: number): void;
}

export function createConfetti(): Confetti {
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const rng = createRng(77);
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    color.setHex(COLORS[i % COLORS.length]).toArray(colors, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.11,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;
  object.visible = false;
  let age = LIFETIME;

  return {
    object,
    burst(origin) {
      age = 0;
      object.visible = true;
      for (let i = 0; i < COUNT; i++) {
        // ゴールの上へ向けて、扇形に吹き出す
        const angle = rng() * Math.PI * 2;
        const spread = 1.5 + rng() * 4.5;
        positions[i * 3] = origin[0] + (rng() - 0.5) * 0.6;
        positions[i * 3 + 1] = origin[1] + rng() * 0.6;
        positions[i * 3 + 2] = origin[2] + (rng() - 0.5) * 5;
        velocities[i * 3] = Math.cos(angle) * spread * 0.6 - 1.2;
        velocities[i * 3 + 1] = 4 + rng() * 6;
        velocities[i * 3 + 2] = Math.sin(angle) * spread;
      }
    },
    update(dt) {
      if (age >= LIFETIME) return;
      age += dt;
      const drag = Math.exp(-1.4 * dt);
      for (let i = 0; i < COUNT; i++) {
        velocities[i * 3] *= drag;
        velocities[i * 3 + 1] = velocities[i * 3 + 1] * drag - GRAVITY * dt;
        velocities[i * 3 + 2] *= drag;
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] = Math.max(0.02, positions[i * 3 + 1] + velocities[i * 3 + 1] * dt);
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = Math.min(1, (LIFETIME - age) / 0.8);
      object.visible = age < LIFETIME;
    },
  };
}
