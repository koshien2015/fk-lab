/**
 * ゴールネットの表示。節点の位置は物理計算（match/netCloth.ts）の結果をそのまま使う。
 * 再生の時刻に合わせてコマを補間するので、スローや巻き戻しでも網の動きがボールと合う。
 */
import * as THREE from 'three';
import type { NetMotion } from '../match/shot.ts';

/** 表示に必要な網の形（Worker から受け取る） */
export interface NetShape {
  /** たるんで落ち着いた状態の節点の位置 */
  readonly rest: Float32Array;
  /** 糸の両端の節点の番号（2 つずつ） */
  readonly springs: Uint16Array;
}

export interface NetView {
  readonly object: THREE.LineSegments;
  /** 落ち着いた状態を表示する */
  showRest(): void;
  /** 記録した動きの、時刻 time の姿を表示する */
  showMotion(motion: NetMotion | null, time: number): void;
}

export function createNet(shape: NetShape): NetView {
  const positions = new THREE.BufferAttribute(Float32Array.from(shape.rest), 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setIndex(new THREE.BufferAttribute(shape.springs, 1));
  const object = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xe8eef8, transparent: true, opacity: 0.45 }),
  );
  object.frustumCulled = false;
  const out = positions.array as Float32Array;
  let resting = true;

  const showRest = (): void => {
    if (resting) return;
    out.set(shape.rest);
    positions.needsUpdate = true;
    resting = true;
  };

  return {
    object,
    showRest,
    showMotion(motion, time) {
      if (!motion || time <= motion.startTime) {
        showRest();
        return;
      }
      const size = motion.nodeCount * 3;
      const last = motion.frames.length / size - 1;
      const at = Math.min(last, (time - motion.startTime) / motion.frameDt);
      const i = Math.min(last, Math.floor(at));
      const j = Math.min(last, i + 1);
      const k = at - i;
      const a = i * size, b = j * size;
      for (let n = 0; n < size; n++) {
        out[n] = motion.frames[a + n] + k * (motion.frames[b + n] - motion.frames[a + n]);
      }
      positions.needsUpdate = true;
      resting = false;
    },
  };
}
