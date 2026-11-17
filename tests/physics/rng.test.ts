import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/physics/rng.ts';

describe('createRng', () => {
  it('同じシードなら同じ列', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('シードが違えば列が違う', () => {
    const a = createRng(1);
    const b = createRng(2);
    const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
    expect(same).toBeLessThan(2);
  });
  it('[0, 1) に収まり、偏らない', () => {
    const r = createRng(7);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1);
  });
});
