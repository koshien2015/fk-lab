import { describe, expect, it } from 'vitest';
import { DEFAULT_SETUP, toKickState, toScenario, type KickSetup } from '../../src/app/setup.ts';
import { FIELD } from '../../src/field/dimensions.ts';
import { simulateShot } from '../../src/match/shot.ts';
import { defaultParams } from '../../src/physics/params.ts';
import { clampTarget, solveKick } from '../../src/solver/inverse.ts';

const p = defaultParams();
const base: KickSetup = { ...DEFAULT_SETUP, spot: { x: -25, z: 0 }, keeper: 'none', seed: 3 };

/** 求めた蹴り方で実際に蹴る（GK なし） */
const shoot = (setup: KickSetup) => simulateShot(toKickState(setup, p), p, toScenario(setup));

describe('逆算（狙った点に入る蹴り方を求める）', () => {
  it('カーブ: 壁を越えて、狙った点から 15 cm 以内に入る', () => {
    const target = { y: 1.8, z: 2.6 };
    const solution = solveKick({ setup: base, target, style: 'curve' }, p);
    expect(solution.miss).toBeLessThan(0.15);
    expect(solution.clearsWall).toBe(true);
    expect(Math.abs(solution.patch.contact[0])).toBeGreaterThan(0.1);
    const result = shoot({ ...base, ...solution.patch });
    expect(result.events.map((e) => e.kind)).not.toContain('wall');
    expect(result.outcome).toBe('goal');
    const goal = result.events.find((e) => e.kind === 'goal')!;
    expect(goal.position[2]).toBeGreaterThan(1.8);
  });
  it('ナックル: 接触点は中心のまま', () => {
    const solution = solveKick({ setup: base, target: { y: 1.2, z: -2 }, style: 'knuckle' }, p);
    expect(solution.patch.contact).toEqual([0, 0]);
    expect(solution.miss).toBeLessThan(0.15);
    expect(shoot({ ...base, ...solution.patch }).outcome).toBe('goal');
  });
  it('ドライブ: ボールの上をこする（トップスピン）', () => {
    const solution = solveKick({ setup: base, target: { y: 1.0, z: 0.5 }, style: 'drive' }, p);
    expect(solution.patch.contact[0]).toBe(0);
    expect(solution.patch.contact[1]).toBeGreaterThan(0.05);
    expect(solution.miss).toBeLessThan(0.15);
  });
  it('求めた設定は、操作できる範囲に収まる', () => {
    const solution = solveKick({ setup: base, target: { y: 2.2, z: -3.3 }, style: 'curve' }, p);
    expect(solution.patch.power).toBeLessThanOrEqual(1);
    expect(solution.patch.power).toBeGreaterThanOrEqual(0.3);
    expect(solution.patch.elevationDeg).toBeGreaterThanOrEqual(0);
    expect(solution.patch.elevationDeg).toBeLessThanOrEqual(40);
    expect(Math.abs(solution.patch.aimDeg)).toBeLessThanOrEqual(25);
  });
  it('探索の途中で試した軌道を返す（表示用）', () => {
    const solution = solveKick({ setup: base, target: { y: 1.5, z: 1 }, style: 'knuckle' }, p);
    expect(solution.candidates.length).toBeGreaterThan(5);
    expect(solution.candidates.length).toBeLessThanOrEqual(60);
    for (const path of solution.candidates) expect(path.length % 3).toBe(0);
    expect(solution.evaluations).toBeGreaterThan(20);
  });
  it('同じ条件なら同じ答え', () => {
    const request = { setup: base, target: { y: 1.5, z: 2 }, style: 'curve' } as const;
    expect(solveKick(request, p).patch).toEqual(solveKick(request, p).patch);
  });
});

describe('clampTarget', () => {
  it('ボールがまるごと枠に収まる範囲へ丸める', () => {
    const t = clampTarget({ y: 9, z: -9 }, p.radius);
    expect(t.y).toBeLessThan(FIELD.goalHeight - p.radius);
    expect(t.z).toBeGreaterThan(-FIELD.goalWidth / 2 + p.radius);
    expect(clampTarget({ y: 1, z: 1 }, p.radius)).toEqual({ y: 1, z: 1 });
  });
});
