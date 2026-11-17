/**
 * ナックル（無回転）の横力を表す、帯域を制限したノイズ。
 *
 * 後流の渦が不規則に剥離することで生じる横力を、位相がランダムな数本の正弦波の和で
 * 近似する簡易モデル。流れを解いているわけではない。
 *
 * - 乱数はここで位相のずれを決めるときに一度だけ引く。力の評価中には引かない
 *   （RK4 は 1 ステップに 4 回評価するので、評価のたびに引くと結果が決定的でなくなる）。
 * - 周波数は速度に比例して変わるので、時刻ではなく「積分した位相」Φ を状態として持つ
 *   （dΦ/dt = 2π·St·|v|/(2R)）。sin(2π·f(t)·t) と書くと周波数がうねってしまう。
 */
import { createRng } from './rng.ts';

/**
 * 正弦波の束。ratio は代表周波数 f = St·|v|/(2R) に対する比。
 * 代表周波数（30 m/s で約 14 Hz）だけでは揺れ幅が数 mm にしかならないので、
 * 軌道を実際に動かす低い周波数の成分に重みを置いている（仮定）。
 */
export const KNUCKLE_BANDS: ReadonlyArray<{ readonly ratio: number; readonly weight: number }> = [
  { ratio: 0.08, weight: 0.9 },
  { ratio: 0.19, weight: 1.0 },
  { ratio: 0.43, weight: 0.45 },
  { ratio: 1.0, weight: 0.2 },
];

const WEIGHT_SUM = KNUCKLE_BANDS.reduce((sum, band) => sum + band.weight, 0);

export interface KnuckleNoise {
  /** 横方向 2 軸 × 正弦波の本数ぶんの位相のずれ [rad] */
  readonly offsets: readonly [readonly number[], readonly number[]];
}

export function createKnuckleNoise(seed: number): KnuckleNoise {
  const rng = createRng(seed);
  const draw = (): number[] => KNUCKLE_BANDS.map(() => rng() * 2 * Math.PI);
  const first = draw();
  const second = draw();
  return { offsets: [first, second] };
}

/** 位相 Φ での信号値。−1〜1 に収まる。 */
export function knuckleSignal(noise: KnuckleNoise, axis: 0 | 1, phase: number): number {
  const offsets = noise.offsets[axis];
  let sum = 0;
  for (let i = 0; i < KNUCKLE_BANDS.length; i++) {
    const band = KNUCKLE_BANDS[i];
    sum += band.weight * Math.sin(band.ratio * phase + offsets[i]);
  }
  return sum / WEIGHT_SUM;
}
