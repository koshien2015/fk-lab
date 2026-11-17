/**
 * Nelder-Mead 法（滑降シンプレックス法）。勾配を使わずに関数の最小点を探す。
 * 目的関数がシミュレーションの結果で、微分が手に入らないときに使う。
 */
export interface MinimizeOptions {
  /** 目的関数を呼ぶ回数の上限 */
  readonly maxEvaluations?: number;
  /** シンプレックスの最良と最悪の値の差がこれより小さくなったら終わる */
  readonly tolerance?: number;
  /** 目的関数を評価するたびに呼ばれる（途中経過の表示用） */
  readonly onEvaluate?: (x: readonly number[], value: number) => void;
}

export interface MinimizeResult {
  readonly x: readonly number[];
  readonly value: number;
  readonly evaluations: number;
}

interface Vertex {
  readonly x: readonly number[];
  readonly value: number;
}

const REFLECT = 1;
const EXPAND = 2;
const CONTRACT = 0.5;
const SHRINK = 0.5;

/** a + k·(b − a) */
const lerp = (a: readonly number[], b: readonly number[], k: number): number[] =>
  a.map((v, i) => v + k * (b[i] - v));

export function minimize(
  f: (x: readonly number[]) => number,
  start: readonly number[],
  /** 初めのシンプレックスの大きさ（変数ごとの歩幅） */
  steps: readonly number[],
  { maxEvaluations = 400, tolerance = 1e-8, onEvaluate }: MinimizeOptions = {},
): MinimizeResult {
  let evaluations = 0;
  const evaluate = (x: readonly number[]): Vertex => {
    const value = f(x);
    evaluations++;
    onEvaluate?.(x, value);
    return { x, value };
  };
  const byValue = (a: Vertex, b: Vertex): number => a.value - b.value;

  let simplex: Vertex[] = [
    evaluate([...start]),
    ...start.map((_, i) => evaluate(start.map((v, j) => (i === j ? v + steps[j] : v)))),
  ].sort(byValue);

  while (evaluations < maxEvaluations) {
    const best = simplex[0];
    const worst = simplex[simplex.length - 1];
    const secondWorst = simplex[simplex.length - 2];
    if (worst.value - best.value < tolerance) break;

    // 最悪の点を除いた重心
    const others = simplex.slice(0, -1);
    const centroid = start.map((_, i) => others.reduce((sum, v) => sum + v.x[i], 0) / others.length);

    const reflected = evaluate(lerp(centroid, worst.x, -REFLECT));
    let replacement: Vertex | null = null;
    if (reflected.value < best.value) {
      const expanded = evaluate(lerp(centroid, worst.x, -EXPAND));
      replacement = expanded.value < reflected.value ? expanded : reflected;
    } else if (reflected.value < secondWorst.value) {
      replacement = reflected;
    } else {
      const toward = reflected.value < worst.value ? reflected : worst;
      const contracted = evaluate(lerp(centroid, toward.x, CONTRACT));
      if (contracted.value < toward.value) replacement = contracted;
    }

    simplex = (
      replacement
        ? [...others, replacement]
        : // どれも良くならなければ、最良の点へ向けて全体を縮める
          [best, ...simplex.slice(1).map((v) => evaluate(lerp(best.x, v.x, SHRINK)))]
    ).sort(byValue);
  }

  return { x: simplex[0].x, value: simplex[0].value, evaluations };
}
