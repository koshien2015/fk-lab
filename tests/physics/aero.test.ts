import { describe, expect, it } from 'vitest';
import {
  dragCoefficient,
  knuckleAmplitude,
  liftCoefficient,
  reynolds,
  spinParameter,
} from '../../src/physics/aero.ts';
import { defaultParams } from '../../src/physics/params.ts';

const p = defaultParams();

describe('reynolds', () => {
  it('Re = |v|·2R/ν', () => {
    expect(reynolds(30, p)).toBeCloseTo((30 * 2 * 0.11) / 1.5e-5, 6);
  });
});

describe('dragCoefficient（ドラッグクライシス）', () => {
  it('亜臨界域では cdSubcritical に近い', () => {
    expect(dragCoefficient(0.5e5, p)).toBeCloseTo(p.cdSubcritical, 2);
  });
  it('超臨界域では cdSupercritical に近い', () => {
    expect(dragCoefficient(6e5, p)).toBeCloseTo(p.cdSupercritical, 2);
  });
  it('臨界レイノルズ数ではちょうど中間になる', () => {
    expect(dragCoefficient(p.criticalReynolds, p)).toBeCloseTo(
      (p.cdSubcritical + p.cdSupercritical) / 2,
      10,
    );
  });
  it('Re に対して単調に減る', () => {
    let prev = Infinity;
    for (let re = 0; re <= 8e5; re += 1e4) {
      const cd = dragCoefficient(re, p);
      expect(cd).toBeLessThanOrEqual(prev);
      prev = cd;
    }
  });
  it('遅い球（12 m/s）は速い球（30 m/s）より C_D が大きい', () => {
    expect(dragCoefficient(reynolds(12, p), p)).toBeGreaterThan(
      dragCoefficient(reynolds(30, p), p) * 2,
    );
  });
});

describe('spinParameter', () => {
  it('S = R·|ω|/|v|', () => {
    expect(spinParameter(25, 50, p)).toBeCloseTo((0.11 * 50) / 25, 12);
  });
  it('速度ゼロでも NaN にならない', () => {
    expect(spinParameter(0, 50, p)).toBe(0);
  });
});

describe('liftCoefficient', () => {
  it('S = 0 でゼロ', () => {
    expect(liftCoefficient(0, p)).toBe(0);
  });
  it('単調に増え、上限 a を超えない', () => {
    let prev = -1;
    for (let s = 0; s <= 3; s += 0.01) {
      const cl = liftCoefficient(s, p);
      expect(cl).toBeGreaterThan(prev);
      expect(cl).toBeLessThan(p.liftSaturation);
      prev = cl;
    }
  });
});

describe('knuckleAmplitude', () => {
  const reSuper = 5e5;
  it('回転が小さいほど大きい', () => {
    const a0 = knuckleAmplitude(0, reSuper, p);
    const a1 = knuckleAmplitude(p.knuckleSpinThreshold, reSuper, p);
    expect(a0).toBeGreaterThan(a1);
    expect(a1).toBeGreaterThan(0);
  });
  it('閾値の2倍以上の回転ではゼロになる', () => {
    expect(knuckleAmplitude(p.knuckleSpinThreshold * 2, reSuper, p)).toBe(0);
    expect(knuckleAmplitude(0.3, reSuper, p)).toBe(0);
  });
  it('超臨界域のほうが亜臨界域より大きい', () => {
    expect(knuckleAmplitude(0, 5e5, p)).toBeGreaterThan(knuckleAmplitude(0, 1e5, p) * 2);
  });
  it('無回転・超臨界での最大値は knuckleCoefficient', () => {
    expect(knuckleAmplitude(0, 1e7, p)).toBeCloseTo(p.knuckleCoefficient, 6);
  });
});
