/**
 * ネットの揺れを表す膜モデル。格子の各点が、面に垂直な向きへどれだけずれているかだけを持つ。
 *
 * 質点とバネの格子を、面に垂直な 1 方向の変位に絞ったもの（2 次元の波動方程式）。
 * 隣の点との高さの差がバネの力になり、ふちは枠に結んであるので動かない。
 * 演出用であり、ボールの軌道には影響しない。
 *
 * 毎フレーム全点を更新するので、配列はその場で書き換える（描画の内側に閉じた状態）。
 */
export interface MembraneSpec {
  readonly columns: number;
  readonly rows: number;
  /** 格子の間隔 [m] */
  readonly spacing: number;
  /** 波が伝わる速さ [m/s] */
  readonly waveSpeed: number;
  /** 揺れが収まる速さ [1/s] */
  readonly damping: number;
}

export interface Membrane {
  readonly spec: MembraneSpec;
  /** 面に垂直な向きのずれ [m]（行 × 列） */
  readonly offset: Float32Array;
  readonly velocity: Float32Array;
}

export function createMembrane(spec: MembraneSpec): Membrane {
  const size = spec.columns * spec.rows;
  return { spec, offset: new Float32Array(size), velocity: new Float32Array(size) };
}

/** 1 回の更新で進める時間の上限。これを超えるぶんは細かく分ける。 */
function stableStep(spec: MembraneSpec): number {
  return (0.5 * spec.spacing) / spec.waveSpeed;
}

/** dt だけ進める */
export function stepMembrane(m: Membrane, dt: number): void {
  const { columns, rows, spacing, waveSpeed, damping } = m.spec;
  const steps = Math.min(8, Math.max(1, Math.ceil(dt / stableStep(m.spec))));
  const h = Math.min(dt / steps, stableStep(m.spec));
  const k = (waveSpeed * waveSpeed) / (spacing * spacing);
  const keep = Math.exp(-damping * h);
  for (let s = 0; s < steps; s++) {
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < columns - 1; c++) {
        const i = r * columns + c;
        const laplacian =
          m.offset[i - 1] + m.offset[i + 1] + m.offset[i - columns] + m.offset[i + columns] - 4 * m.offset[i];
        m.velocity[i] = (m.velocity[i] + k * laplacian * h) * keep;
      }
    }
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < columns - 1; c++) {
        const i = r * columns + c;
        m.offset[i] += m.velocity[i] * h;
      }
    }
  }
}

/** 格子上の点 (column, row) のまわりを、速さ speed [m/s] で押す。radius は押す範囲 [m]。 */
export function pokeMembrane(m: Membrane, column: number, row: number, speed: number, radius: number): void {
  const { columns, rows, spacing } = m.spec;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < columns - 1; c++) {
      const d2 = ((c - column) ** 2 + (r - row) ** 2) * spacing * spacing;
      m.velocity[r * columns + c] += speed * Math.exp(-d2 / (2 * radius * radius));
    }
  }
}
