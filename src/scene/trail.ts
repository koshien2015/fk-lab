/**
 * 軌道のトレイル。速さに応じて色を変える（遅い = 青、速い = 黄）。
 */
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Trajectory } from '../physics/types.ts';

const SLOW = 12;
const FAST = 32;

/** 速さを色にする */
export function speedColor(speed: number, target = new THREE.Color()): THREE.Color {
  const k = Math.min(1, Math.max(0, (speed - SLOW) / (FAST - SLOW)));
  // 色相: 青 (0.62) → 黄 (0.12)
  return target.setHSL(0.62 - 0.5 * k, 0.95, 0.56);
}

export interface TrailView {
  readonly object: THREE.Object3D;
  /** 軌道を差し替える */
  setTrajectory(tr: Trajectory): void;
  /** 記録点 index まで描く */
  reveal(index: number): void;
}

export interface TrailStyle {
  /** 線の太さ [px] */
  readonly width?: number;
  readonly opacity?: number;
}

export function createTrail({ width = 3.5, opacity = 0.95 }: TrailStyle = {}): TrailView {
  const material = new LineMaterial({ linewidth: width, vertexColors: true, transparent: true, opacity });
  const line = new Line2(new LineGeometry(), material);
  line.frustumCulled = false;
  line.visible = false;
  let segments = 0;

  return {
    object: line,
    setTrajectory(tr) {
      const colors = new Float32Array(tr.count * 3);
      const color = new THREE.Color();
      for (let i = 0; i < tr.count; i++) {
        speedColor(Math.hypot(tr.vel[i * 3], tr.vel[i * 3 + 1], tr.vel[i * 3 + 2]), color);
        color.toArray(colors, i * 3);
      }
      const geometry = new LineGeometry();
      geometry.setPositions(Float32Array.from(tr.pos));
      geometry.setColors(colors);
      geometry.instanceCount = 0;
      line.geometry.dispose();
      line.geometry = geometry;
      segments = tr.count - 1;
      line.visible = true;
    },
    reveal(index) {
      line.geometry.instanceCount = Math.min(Math.max(index, 0), segments);
    },
  };
}
