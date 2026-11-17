import { describe, expect, it } from 'vitest';
import { cornerSetup, DEFAULT_SETUP, toKickState, toScenario, type KickSetup } from '../../src/app/setup.ts';
import { FIELD } from '../../src/field/dimensions.ts';
import { aimAzimuthDeg, cornerSpot, isNearGoalLine } from '../../src/field/placement.ts';
import { KEEPER, keeperLineX, keeperStartZ } from '../../src/match/keeper.ts';
import { simulateShot } from '../../src/match/shot.ts';
import { defaultParams } from '../../src/physics/params.ts';
import { solveKick } from '../../src/solver/inverse.ts';

const p = defaultParams();
const NO_WALL = { count: 0, offset: 0, jump: false, jumpDelay: 0.15 };
const corner = (side: 1 | -1, over: Partial<KickSetup> = {}): KickSetup => ({
  ...DEFAULT_SETUP,
  spot: cornerSpot(side),
  wall: NO_WALL,
  keeper: 'none',
  seed: 4,
  ...over,
});

describe('コーナーの位置', () => {
  it('コーナーアークの中（ゴールラインとタッチラインの角から 1 m 以内）に置く', () => {
    for (const side of [1, -1] as const) {
      const spot = cornerSpot(side);
      expect(Math.hypot(spot.x, spot.z - side * (FIELD.width / 2))).toBeLessThan(FIELD.cornerArcRadius);
      expect(spot.x).toBeLessThan(0);
      expect(Math.abs(spot.z)).toBeLessThan(FIELD.width / 2);
      expect(isNearGoalLine(spot)).toBe(true);
    }
    expect(isNearGoalLine({ x: -25, z: 0 })).toBe(false);
  });
  it('狙いの 0° は、ほぼゴールラインに沿ってゴール中央を向く', () => {
    expect(Math.abs(aimAzimuthDeg(cornerSpot(1)) + 90)).toBeLessThan(1);
    expect(Math.abs(aimAzimuthDeg(cornerSpot(-1)) - 90)).toBeLessThan(1);
  });
});

describe('コーナーキックのときの GK', () => {
  it('ゴールの中に立つ（ボールとゴール中央を結ぶ線の延長で、枠の外へ出ない）', () => {
    for (const side of [1, -1] as const) {
      const z = keeperStartZ(cornerSpot(side), false);
      expect(Math.abs(z)).toBeLessThan(FIELD.goalWidth / 2);
      expect(Number.isFinite(z)).toBe(true);
    }
  });
  it('正面の FK より、ゴールラインの近くに立つ', () => {
    expect(keeperLineX(cornerSpot(1))).toBeGreaterThan(KEEPER.lineX);
    expect(keeperLineX({ x: -25, z: 0 })).toBe(KEEPER.lineX);
  });
});

describe('コーナーから直接ゴールを狙う', () => {
  it('逆算で、ゴールへ巻いて入る蹴り方が見つかる（GK なし）', () => {
    for (const side of [1, -1] as const) {
      const setup = corner(side);
      // ファーポスト寄りの高い所を狙う
      const solution = solveKick({ setup, target: { y: 1.7, z: -side * 1.5 }, style: 'curve' }, p);
      expect(solution.miss).toBeLessThan(0.3);
      const solved = { ...setup, ...solution.patch };
      const result = simulateShot(toKickState(solved, p), p, toScenario(solved));
      expect(result.outcome).toBe('goal');
      // ゴールの側へ曲げる回転。右コーナーから見るとゴールは右手にあるので、
      // 右へ曲げる（ボールの左をこする）。左コーナーからはその逆。
      expect(Math.sign(solution.patch.contact[0])).toBe(-side);
    }
  });
  it('コーナーのボタンの初期設定は、左右どちらからも、GK がいても入る。壁は置かない', () => {
    for (const side of [1, -1] as const) {
      for (const keeper of ['none', 'normal', 'hard'] as const) {
        const setup = cornerSetup(side, { ...DEFAULT_SETUP, keeper });
        expect(setup.wall.count).toBe(0);
        expect(simulateShot(toKickState(setup, p), p, toScenario(setup)).outcome).toBe('goal');
      }
    }
  });
  it('ファー側へ流す球は GK の正面を通るので、止められる', () => {
    const setup = corner(1, { keeper: 'normal' });
    const solution = solveKick({ setup, target: { y: 1.7, z: -1.5 }, style: 'curve' }, p);
    const solved = { ...setup, ...solution.patch };
    expect(simulateShot(toKickState(solved, p), p, toScenario(solved)).outcome).toBe('save');
  });
  it('GK に当たった球は前へ弾かれ、ゴールへ押し込まれない', () => {
    // 逆算は重いので 1 回だけ行い、GK の読み違い（シード）だけを変えて蹴る
    const aimed = corner(1, { keeper: 'hard' });
    const solution = solveKick({ setup: aimed, target: { y: 1.5, z: -1 }, style: 'curve' }, p);
    let touched = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const setup = { ...aimed, ...solution.patch, seed };
      const r = simulateShot(toKickState(setup, p), p, toScenario(setup));
      const hit = r.events.find((e) => e.kind === 'keeper');
      if (!hit) continue;
      touched++;
      const i = Array.from(r.trajectory.t).findIndex((t) => t > hit.t + 0.01);
      expect(r.trajectory.vel[i * 3]).toBeLessThanOrEqual(0.5);
    }
    expect(touched).toBeGreaterThan(0);
  });
  it('回転をかけずにゴールラインと平行に蹴ると、入らない', () => {
    const setup = corner(1, { contact: [0, 0], aimDeg: 0, elevationDeg: 14, power: 0.8 });
    const result = simulateShot(toKickState(setup, p), p, toScenario({ ...setup, seed: 1 }));
    expect(result.outcome).not.toBe('goal');
  });
  it('GK がいれば、ボールに反応して動く', () => {
    const setup = corner(1, { keeper: 'normal' });
    const solution = solveKick({ setup, target: { y: 1.7, z: -1.5 }, style: 'curve' }, p);
    const solved = { ...setup, ...solution.patch };
    const result = simulateShot(toKickState(solved, p), p, toScenario(solved));
    const { z, lean } = result.keeper;
    const moved = Math.max(...Array.from(z, (v, i) => Math.abs(v - z[0]) + Math.abs(lean[i])));
    expect(moved).toBeGreaterThan(0.3);
    expect(['goal', 'save', 'post', 'out']).toContain(result.outcome);
    for (const v of z) expect(Number.isFinite(v)).toBe(true);
  });
});
