import { describe, expect, it } from 'vitest';
import { LEGENDS } from '../../src/app/legends.ts';
import { SETUP_LIMITS, toKickState, toScenario } from '../../src/app/setup.ts';
import { simulateShot } from '../../src/match/shot.ts';
import { describeSpin } from '../../src/physics/kick.ts';
import { defaultParams } from '../../src/physics/params.ts';
import { toKickInput } from '../../src/app/setup.ts';

const p = defaultParams();

describe('伝説の FK のプリセット', () => {
  it('2〜3 本ある', () => {
    expect(LEGENDS.length).toBeGreaterThanOrEqual(2);
    expect(LEGENDS.length).toBeLessThanOrEqual(3);
  });
  it.each(LEGENDS)('$label は、壁に当たらずゴールに入る', (legend) => {
    const result = simulateShot(toKickState(legend.setup, p), p, toScenario(legend.setup));
    expect(result.events.map((e) => e.kind)).not.toContain('wall');
    expect(result.outcome).toBe('goal');
  });
  it.each(LEGENDS)('$label の設定は、操作できる範囲に収まる', ({ setup }) => {
    expect(setup.power).toBeLessThanOrEqual(SETUP_LIMITS.power.max);
    expect(Math.abs(setup.aimDeg)).toBeLessThanOrEqual(SETUP_LIMITS.aimDeg.max);
    expect(setup.elevationDeg).toBeLessThanOrEqual(SETUP_LIMITS.elevationDeg.max);
  });
  it('アウトサイドの FK は左へ曲がる回転、無回転の FK はナックル', () => {
    const [outside, knuckle] = LEGENDS;
    expect(describeSpin(toKickInput(outside.setup), p).curve).toBe('left');
    expect(describeSpin(toKickInput(knuckle.setup), p).knuckle).toBe(true);
  });
});
