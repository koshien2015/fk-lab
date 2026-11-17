/**
 * 固定ステップの 4 次ルンゲ＝クッタ法。
 * 結果を決定的にするため、適応ステップは使わない。
 */
import { FORCE_SIZE, STATE_SIZE, type Derivative } from './dynamics.ts';

export interface Rk4 {
  /**
   * 状態 y を dt だけ進める（y を書き換える）。
   * 戻り値はステップの始点での力（次に呼ぶまで有効な作業用バッファ）。
   */
  step(y: Float64Array, dt: number): Float64Array;
  /** 状態 y での力だけを求める（y は進めない） */
  forcesAt(y: Float64Array): Float64Array;
}

export function createRk4(derivative: Derivative): Rk4 {
  const tmp = new Float64Array(STATE_SIZE);
  const k1 = new Float64Array(STATE_SIZE), k2 = new Float64Array(STATE_SIZE);
  const k3 = new Float64Array(STATE_SIZE), k4 = new Float64Array(STATE_SIZE);
  const fStart = new Float64Array(FORCE_SIZE), fScratch = new Float64Array(FORCE_SIZE);

  return {
    step(y, dt) {
      derivative(y, k1, fStart);
      for (let i = 0; i < STATE_SIZE; i++) tmp[i] = y[i] + 0.5 * dt * k1[i];
      derivative(tmp, k2, fScratch);
      for (let i = 0; i < STATE_SIZE; i++) tmp[i] = y[i] + 0.5 * dt * k2[i];
      derivative(tmp, k3, fScratch);
      for (let i = 0; i < STATE_SIZE; i++) tmp[i] = y[i] + dt * k3[i];
      derivative(tmp, k4, fScratch);
      for (let i = 0; i < STATE_SIZE; i++) {
        y[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
      }
      // 姿勢のクォータニオンを単位長に戻す
      const norm = Math.hypot(y[9], y[10], y[11], y[12]);
      for (let a = 9; a < 13; a++) y[a] /= norm;
      return fStart;
    },
    forcesAt(y) {
      derivative(y, k1, fStart);
      return fStart;
    },
  };
}
