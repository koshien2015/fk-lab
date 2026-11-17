import { describe, expect, it } from 'vitest';
import { PARAM_DEFS, defaultParams, inertia, crossSection } from '../../src/physics/params.ts';

describe('params', () => {
  it('既定値は SPEC 3.1 の値', () => {
    const p = defaultParams();
    expect(p.mass).toBe(0.43);
    expect(p.radius).toBe(0.11);
    expect(p.airDensity).toBe(1.2);
    expect(p.kinematicViscosity).toBe(1.5e-5);
  });
  it('上書きしても既定の定義は変わらない', () => {
    const p = defaultParams({ airDensity: 0 });
    expect(p.airDensity).toBe(0);
    expect(defaultParams().airDensity).toBe(1.2);
  });
  it('すべての定義が仮定値フラグ・単位・ラベルを持つ', () => {
    for (const def of Object.values(PARAM_DEFS)) {
      expect(typeof def.assumed).toBe('boolean');
      expect(typeof def.unit).toBe('string');
      expect(def.label.length).toBeGreaterThan(0);
    }
  });
  it('空力係数はすべて仮定値として印が付いている', () => {
    expect(PARAM_DEFS.cdSubcritical.assumed).toBe(true);
    expect(PARAM_DEFS.liftSaturation.assumed).toBe(true);
    expect(PARAM_DEFS.knuckleCoefficient.assumed).toBe(true);
    expect(PARAM_DEFS.strouhal.assumed).toBe(true);
    expect(PARAM_DEFS.spinDecayCoefficient.assumed).toBe(true);
    expect(PARAM_DEFS.mass.assumed).toBe(false);
  });
  it('慣性モーメントは薄い球殻 (2/3)·m·R²', () => {
    const p = defaultParams();
    expect(inertia(p)).toBeCloseTo((2 / 3) * 0.43 * 0.11 ** 2, 12);
    expect(crossSection(p)).toBeCloseTo(Math.PI * 0.11 ** 2, 12);
  });
});
