import { describe, expect, it } from 'vitest';
import { createMembrane, pokeMembrane, stepMembrane, type MembraneSpec } from '../../src/fx/membrane.ts';

const spec: MembraneSpec = { columns: 21, rows: 11, spacing: 0.15, waveSpeed: 5, damping: 2.5 };
const energy = (m: ReturnType<typeof createMembrane>): number =>
  m.offset.reduce((sum, u) => sum + u * u, 0) + m.velocity.reduce((sum, v) => sum + v * v, 0);

describe('ネットの膜モデル', () => {
  it('何もしなければ動かない', () => {
    const m = createMembrane(spec);
    for (let i = 0; i < 100; i++) stepMembrane(m, 1 / 60);
    expect(energy(m)).toBe(0);
  });
  it('つつくと膨らみ、つついた所がいちばん大きく動く', () => {
    const m = createMembrane(spec);
    pokeMembrane(m, 10, 5, 6, 0.4);
    for (let i = 0; i < 6; i++) stepMembrane(m, 1 / 60);
    const center = m.offset[5 * spec.columns + 10];
    expect(center).toBeGreaterThan(0.1);
    expect(center).toBeGreaterThan(m.offset[5 * spec.columns + 3]);
  });
  it('ふち（枠に結んである所）は動かない', () => {
    const m = createMembrane(spec);
    pokeMembrane(m, 1, 1, 8, 0.6);
    for (let i = 0; i < 120; i++) stepMembrane(m, 1 / 60);
    for (let c = 0; c < spec.columns; c++) {
      expect(m.offset[c]).toBe(0);
      expect(m.offset[(spec.rows - 1) * spec.columns + c]).toBe(0);
    }
    for (let r = 0; r < spec.rows; r++) {
      expect(m.offset[r * spec.columns]).toBe(0);
      expect(m.offset[r * spec.columns + spec.columns - 1]).toBe(0);
    }
  });
  it('揺れはやがて収まる（発散しない）', () => {
    const m = createMembrane(spec);
    pokeMembrane(m, 10, 5, 10, 0.4);
    stepMembrane(m, 1 / 60);
    const early = energy(m);
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      stepMembrane(m, 1 / 60);
      peak = Math.max(peak, Math.max(...m.offset.map(Math.abs)));
    }
    expect(energy(m)).toBeLessThan(early * 1e-3);
    expect(peak).toBeLessThan(2);
  });
  it('コマ落ちで dt が大きくても発散しない', () => {
    const m = createMembrane(spec);
    pokeMembrane(m, 10, 5, 10, 0.4);
    for (let i = 0; i < 100; i++) stepMembrane(m, 0.1);
    expect(Number.isFinite(energy(m))).toBe(true);
    expect(Math.max(...m.offset.map(Math.abs))).toBeLessThan(3);
  });
});
