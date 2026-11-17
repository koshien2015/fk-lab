import { describe, expect, it } from 'vitest';
import { defaultParams } from '../../src/physics/params.ts';
import { simulate } from '../../src/physics/simulate.ts';
import { sampleTrajectory } from '../../src/playback/sample.ts';

const tr = simulate(
  { position: [0, 0.11, 0], velocity: [25, 9, 1], omega: [0, -40, 10] },
  defaultParams(),
  { seed: 2 },
);

describe('sampleTrajectory', () => {
  it('記録した時刻では、記録した値をそのまま返す', () => {
    const i = 40;
    const s = sampleTrajectory(tr, tr.t[i]);
    expect(s.position[0]).toBeCloseTo(tr.pos[i * 3], 12);
    expect(s.position[1]).toBeCloseTo(tr.pos[i * 3 + 1], 12);
    expect(s.velocity[2]).toBeCloseTo(tr.vel[i * 3 + 2], 12);
    expect(s.quaternion[3]).toBeCloseTo(tr.quat[i * 4 + 3], 12);
    expect(s.index).toBe(i);
  });
  it('記録点の間は線形に補間する', () => {
    const i = 10;
    const s = sampleTrajectory(tr, (tr.t[i] + tr.t[i + 1]) / 2);
    expect(s.position[0]).toBeCloseTo((tr.pos[i * 3] + tr.pos[(i + 1) * 3]) / 2, 12);
    expect(s.forces.magnus[2]).toBeCloseTo(
      (tr.forces.magnus[i * 3 + 2] + tr.forces.magnus[(i + 1) * 3 + 2]) / 2,
      12,
    );
    expect(s.cd).toBeCloseTo((tr.cd[i] + tr.cd[i + 1]) / 2, 12);
  });
  it('補間した姿勢も単位クォータニオン', () => {
    for (let k = 0; k < 50; k++) {
      const s = sampleTrajectory(tr, (tr.final.t * (k + 0.37)) / 50);
      expect(Math.hypot(...s.quaternion)).toBeCloseTo(1, 12);
    }
  });
  it('範囲の外は端の値に丸める', () => {
    const before = sampleTrajectory(tr, -1);
    const after = sampleTrajectory(tr, tr.final.t + 10);
    expect(before.position).toEqual([tr.pos[0], tr.pos[1], tr.pos[2]]);
    expect(after.position[0]).toBeCloseTo(tr.final.position[0], 12);
    expect(after.time).toBe(tr.final.t);
    expect(before.time).toBe(0);
  });
  it('軌道を書き換えない', () => {
    const copy = Array.from(tr.pos);
    sampleTrajectory(tr, 0.3);
    expect(Array.from(tr.pos)).toEqual(copy);
  });
});
