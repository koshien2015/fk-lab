import { describe, expect, it } from 'vitest';
import { explainFlight, forceShares, spinMix } from '../../src/analysis/explain.ts';
import { defaultParams } from '../../src/physics/params.ts';
import { simulate } from '../../src/physics/simulate.ts';
import type { KickState } from '../../src/physics/types.ts';

const R = 0.11;
const share = (shares: ReturnType<typeof forceShares>, key: string) => shares.find((s) => s.key === key)!;

describe('forceShares（力ごとの寄与を、蹴った向きを基準に分ける）', () => {
  it('右へ曲がる回転なら、マグヌス力の横の寄与は右（正）', () => {
    const kick: KickState = { position: [-25, R, 0], velocity: [26, 8, 0], omega: [0, -50, 0] };
    const tr = simulate(kick, defaultParams({ knuckleCoefficient: 0 }));
    const shares = forceShares(tr.contributions, kick);
    expect(share(shares, 'magnus').lateral).toBeGreaterThan(1);
    expect(share(shares, 'gravity').vertical).toBeLessThan(-3);
    expect(share(shares, 'gravity').lateral).toBeCloseTo(0, 9);
    expect(share(shares, 'drag').forward).toBeLessThan(-1);
    expect(share(shares, 'knuckle').lateral).toBe(0);
  });
  it('斜めに蹴っても、横は「蹴った向きに対して右」で測る', () => {
    // 同じ蹴り方を鉛直軸まわりに 90° 回す（+x → +z）。横の寄与は変わらない。
    const a: KickState = { position: [0, R, 0], velocity: [26, 8, 0], omega: [0, -50, 0] };
    const b: KickState = { position: [0, R, 0], velocity: [0, 8, 26], omega: [0, -50, 0] };
    const p = defaultParams({ knuckleCoefficient: 0 });
    const sa = forceShares(simulate(a, p).contributions, a);
    const sb = forceShares(simulate(b, p).contributions, b);
    expect(share(sb, 'magnus').lateral).toBeCloseTo(share(sa, 'magnus').lateral, 6);
    expect(share(sb, 'drag').forward).toBeCloseTo(share(sa, 'drag').forward, 6);
  });
});

describe('explainFlight（言葉での説明）', () => {
  const p = defaultParams();
  it('カーブは、マグヌス力が曲げたと説明する', () => {
    const kick: KickState = { position: [-25, R, 0], velocity: [26, 8, -2], omega: [0, -55, 10] };
    const lines = explainFlight(simulate(kick, p), kick, p);
    expect(lines.some((line) => line.includes('マグヌス力') && line.includes('右へ'))).toBe(true);
  });
  it('無回転は、ナックル横力と「簡易モデル」であることに触れる', () => {
    const kick: KickState = { position: [-25, R, 0], velocity: [28, 7, 0], omega: [0, 0, 0] };
    const lines = explainFlight(simulate(kick, p, { seed: 8 }), kick, p);
    expect(lines.some((line) => line.includes('ナックル横力') && line.includes('簡易モデル'))).toBe(true);
    expect(lines.some((line) => line.includes('マグヌス力'))).toBe(false);
  });
  it('減速して臨界域に入ったら、ドラッグクライシスに触れる', () => {
    const kick: KickState = { position: [-30, R, 0], velocity: [20, 15, 0], omega: [0, 0, 30] };
    const lines = explainFlight(simulate(kick, p), kick, p);
    expect(lines.some((line) => line.includes('ドラッグクライシス'))).toBe(true);
  });
  it('flightTime より後の記録（当たったあとの転がりなど）は見ない', () => {
    const kick: KickState = { position: [-30, R, 0], velocity: [20, 15, 0], omega: [0, 0, 30] };
    const lines = explainFlight(simulate(kick, p), kick, p, 0.2);
    expect(lines.some((line) => line.includes('ドラッグクライシス'))).toBe(false);
  });
  it('重力には必ず触れる', () => {
    const kick: KickState = { position: [-25, R, 0], velocity: [26, 8, 0], omega: [0, 0, 0] };
    expect(explainFlight(simulate(kick, p), kick, p)[0]).toContain('重力');
  });
});

describe('spinMix（回転の内訳）', () => {
  it('水平に飛ぶ球が鉛直軸まわりに回るなら横回転 100%', () => {
    const mix = spinMix([0, -40, 0], [20, 0, 0]);
    expect(mix.side).toBeCloseTo(1, 12);
    expect(mix.vertical).toBeCloseTo(0, 12);
    expect(mix.gyro).toBeCloseTo(0, 12);
  });
  it('進行方向に垂直で水平な軸まわりなら縦回転 100%', () => {
    const mix = spinMix([0, 0, 30], [20, 0, 0]);
    expect(mix.vertical).toBeCloseTo(1, 12);
    expect(mix.side).toBeCloseTo(0, 12);
  });
  it('進行方向が軸ならジャイロ 100%、回転なしは全部 0', () => {
    expect(spinMix([30, 0, 0], [20, 0, 0]).gyro).toBeCloseTo(1, 12);
    expect(spinMix([0, 0, 0], [20, 0, 0])).toEqual({ side: 0, vertical: 0, gyro: 0 });
  });
  it('3 つの和は 1', () => {
    const mix = spinMix([3, -20, 12], [22, 6, -4]);
    expect(mix.side + mix.vertical + mix.gyro).toBeCloseTo(1, 12);
  });
});
