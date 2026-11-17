import { describe, expect, it } from 'vitest';
import { FIELD } from '../../src/field/dimensions.ts';
import { aimAzimuthDeg, clampBallSpot, distanceToGoal } from '../../src/field/placement.ts';

describe('ボールを置く位置', () => {
  it('攻撃側の半分の中ならそのまま', () => {
    expect(clampBallSpot({ x: -25, z: 6 })).toEqual({ x: -25, z: 6 });
  });
  it('自陣側・ピッチの外・ゴールに近すぎる位置は丸める', () => {
    expect(clampBallSpot({ x: -80, z: 0 }).x).toBe(-FIELD.length / 2);
    expect(clampBallSpot({ x: -20, z: 99 }).z).toBeLessThan(FIELD.width / 2);
    expect(clampBallSpot({ x: -20, z: -99 }).z).toBeGreaterThan(-FIELD.width / 2);
    expect(clampBallSpot({ x: 3, z: 0 }).x).toBeLessThanOrEqual(-6);
  });
  it('ゴール中央への向き: 正面なら 0°、左にいれば右向き（正）', () => {
    expect(aimAzimuthDeg({ x: -25, z: 0 })).toBeCloseTo(0, 12);
    expect(aimAzimuthDeg({ x: -20, z: -20 })).toBeCloseTo(45, 10);
    expect(aimAzimuthDeg({ x: -20, z: 20 })).toBeCloseTo(-45, 10);
  });
  it('ゴール中央までの距離', () => {
    expect(distanceToGoal({ x: -3, z: 4 })).toBeCloseTo(5, 12);
  });
});
