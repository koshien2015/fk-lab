import { describe, expect, it } from 'vitest';
import { describeSpin, kickToState, type KickInput } from '../../src/physics/kick.ts';
import { defaultParams, inertia } from '../../src/physics/params.ts';
import { simulate } from '../../src/physics/simulate.ts';

const p = defaultParams();
const START = [0, p.radius, 0] as const;
const input = (over: Partial<KickInput> = {}): KickInput => ({
  contact: [0, 0],
  azimuthDeg: 0,
  elevationDeg: 15,
  power: 0.8,
  ...over,
});
const mag = (v: readonly number[]): number => Math.hypot(...v);

describe('kickToState（蹴る点 → 初速と回転）', () => {
  it('強さ 100% で初速は e·J_max/m（約 35 m/s）', () => {
    const k = kickToState(input({ power: 1 }), START, p);
    expect(mag(k.velocity)).toBeCloseTo((p.kickEfficiency * p.maxImpulse) / p.mass, 10);
    expect(mag(k.velocity)).toBeGreaterThan(33);
    expect(mag(k.velocity)).toBeLessThan(37);
  });
  it('初速は強さに比例し、向きは方位角と仰角で決まる', () => {
    const k = kickToState(input({ power: 0.5, azimuthDeg: 10, elevationDeg: 20 }), START, p);
    const v = (0.5 * p.kickEfficiency * p.maxImpulse) / p.mass;
    const el = (20 * Math.PI) / 180, az = (10 * Math.PI) / 180;
    expect(k.velocity[0]).toBeCloseTo(v * Math.cos(el) * Math.cos(az), 10);
    expect(k.velocity[1]).toBeCloseTo(v * Math.sin(el), 10);
    expect(k.velocity[2]).toBeCloseTo(v * Math.cos(el) * Math.sin(az), 10);
    expect(k.position).toEqual(START);
  });
  it('中心を蹴ると回転はゼロ（ナックル）', () => {
    const k = kickToState(input(), START, p);
    expect(mag(k.omega)).toBe(0);
  });
  it('初速の大きさは接触点によらない', () => {
    const a = kickToState(input(), START, p);
    const b = kickToState(input({ contact: [0.5, -0.3] }), START, p);
    expect(mag(b.velocity)).toBeCloseTo(mag(a.velocity), 10);
  });
  it('回転は ω = κ·(r × J)/I で、ずれに比例する', () => {
    const k1 = kickToState(input({ contact: [-0.2, 0], elevationDeg: 0 }), START, p);
    const k2 = kickToState(input({ contact: [-0.4, 0], elevationDeg: 0 }), START, p);
    const J = 0.8 * p.maxImpulse;
    expect(mag(k1.omega)).toBeCloseTo((p.spinTransfer * 0.2 * p.radius * J) / inertia(p), 9);
    expect(mag(k2.omega)).toBeCloseTo(2 * mag(k1.omega), 9);
  });
  it('ボールの左側を蹴ると、上から見て時計回り（ω_y < 0）で右へ曲がる', () => {
    const k = kickToState(input({ contact: [-0.4, 0] }), START, p);
    expect(k.omega[1]).toBeLessThan(0);
    const tr = simulate(k, defaultParams({ knuckleCoefficient: 0 }));
    expect(tr.final.position[2]).toBeGreaterThan(1);
  });
  it('ボールの右側を蹴ると左へ曲がる', () => {
    const k = kickToState(input({ contact: [0.4, 0] }), START, p);
    const tr = simulate(k, defaultParams({ knuckleCoefficient: 0 }));
    expect(tr.final.position[2]).toBeLessThan(-1);
  });
  it('下を蹴るとバックスピン（揚力が上向き）、上を蹴るとトップスピン', () => {
    const flat = defaultParams({ knuckleCoefficient: 0 });
    const center = simulate(kickToState(input(), START, p), flat);
    const low = simulate(kickToState(input({ contact: [0, -0.4] }), START, p), flat);
    const high = simulate(kickToState(input({ contact: [0, 0.4] }), START, p), flat);
    expect(low.forces.magnus[1]).toBeGreaterThan(0);
    expect(high.forces.magnus[1]).toBeLessThan(0);
    expect(low.final.t).toBeGreaterThan(center.final.t);
    expect(high.final.t).toBeLessThan(center.final.t);
  });
  it('回転軸は蹴る向きに垂直（ジャイロ成分を持たない）', () => {
    const k = kickToState(input({ contact: [0.3, -0.5], azimuthDeg: -12, elevationDeg: 25 }), START, p);
    const dot = k.omega[0] * k.velocity[0] + k.omega[1] * k.velocity[1] + k.omega[2] * k.velocity[2];
    expect(Math.abs(dot)).toBeLessThan(1e-9);
  });
  it('方位角を変えると、初速と回転が同じだけ鉛直軸まわりに回る', () => {
    const a = kickToState(input({ contact: [-0.3, 0.2], azimuthDeg: 0 }), START, p);
    const b = kickToState(input({ contact: [-0.3, 0.2], azimuthDeg: 30 }), START, p);
    const th = (30 * Math.PI) / 180;
    // +x から +z（右）へ θ 回す
    const rot = (v: readonly number[]): number[] => [
      v[0] * Math.cos(th) - v[2] * Math.sin(th),
      v[1],
      v[0] * Math.sin(th) + v[2] * Math.cos(th),
    ];
    const rv = rot(a.velocity), rw = rot(a.omega);
    for (let i = 0; i < 3; i++) {
      expect(b.velocity[i]).toBeCloseTo(rv[i], 9);
      expect(b.omega[i]).toBeCloseTo(rw[i], 9);
    }
  });
  it('接触点はボールの縁を越えない（縁の外は縁に丸める）', () => {
    const k = kickToState(input({ contact: [3, 4] }), START, p);
    expect(Number.isFinite(mag(k.omega))).toBe(true);
    const edge = kickToState(input({ contact: [0.54, 0.72] }), START, p);
    expect(mag(k.omega)).toBeCloseTo(mag(edge.omega), 9);
  });
  it('入力を書き換えない', () => {
    const i = input({ contact: [0.2, 0.1] });
    const snapshot = JSON.stringify(i);
    kickToState(i, START, p);
    expect(JSON.stringify(i)).toBe(snapshot);
  });
});

describe('describeSpin（回転の読み方）', () => {
  it('中心はナックル', () => {
    const d = describeSpin(input(), p);
    expect(d.rps).toBe(0);
    expect(d.knuckle).toBe(true);
    expect(d.curve).toBe('none');
    expect(d.vertical).toBe('none');
  });
  it('左下を蹴ると 右へ曲がる + バックスピン', () => {
    const d = describeSpin(input({ contact: [-0.4, -0.3] }), p);
    expect(d.curve).toBe('right');
    expect(d.vertical).toBe('backspin');
    expect(d.knuckle).toBe(false);
    expect(d.rps).toBeGreaterThan(3);
  });
  it('右上を蹴ると 左へ曲がる + トップスピン', () => {
    const d = describeSpin(input({ contact: [0.4, 0.3], azimuthDeg: 20 }), p);
    expect(d.curve).toBe('left');
    expect(d.vertical).toBe('topspin');
  });
});
