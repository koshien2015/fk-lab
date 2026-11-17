import { describe, expect, it } from 'vitest';
import { minimize } from '../../src/solver/nelderMead.ts';

describe('Nelder-Mead 法', () => {
  it('2 次関数の最小点を見つける', () => {
    const r = minimize(([x, y]) => (x - 3) ** 2 + 2 * (y + 1) ** 2, [0, 0], [1, 1]);
    expect(r.x[0]).toBeCloseTo(3, 3);
    expect(r.x[1]).toBeCloseTo(-1, 3);
    expect(r.value).toBeLessThan(1e-6);
  });
  it('ローゼンブロック関数（曲がった谷）でも最小点 (1, 1) に着く', () => {
    const f = ([x, y]: readonly number[]): number => (1 - x) ** 2 + 100 * (y - x * x) ** 2;
    const r = minimize(f, [-1.2, 1], [0.5, 0.5], { maxEvaluations: 2000, tolerance: 1e-12 });
    expect(r.x[0]).toBeCloseTo(1, 2);
    expect(r.x[1]).toBeCloseTo(1, 2);
  });
  it('評価回数の上限を守り、評価のたびに通知する', () => {
    let calls = 0;
    const seen: number[] = [];
    const r = minimize(
      ([x]) => {
        calls++;
        return Math.abs(x - 5);
      },
      [0],
      [1],
      { maxEvaluations: 30, onEvaluate: (_x, value) => seen.push(value) },
    );
    expect(calls).toBeLessThanOrEqual(30);
    expect(r.evaluations).toBe(calls);
    expect(seen).toHaveLength(calls);
  });
  it('初期値を書き換えない', () => {
    const x0 = [0, 0];
    minimize(([x, y]) => x * x + y * y, x0, [1, 1]);
    expect(x0).toEqual([0, 0]);
  });
});
