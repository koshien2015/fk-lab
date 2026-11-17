import { describe, expect, it } from 'vitest';
import { FIELD } from '../../src/field/dimensions.ts';
import { WALL, jumpHeight, wallPlayers, type WallSetup } from '../../src/match/wall.ts';

const setup = (over: Partial<WallSetup> = {}): WallSetup => ({
  count: 4,
  offset: 0,
  jump: false,
  jumpDelay: 0.15,
  ...over,
});

describe('壁の配置', () => {
  it('人数ぶんの選手が、ボールから 9.15 m の円の接線上に等間隔で並ぶ', () => {
    const spot = { x: -25, z: 4 };
    const players = wallPlayers(spot, setup());
    expect(players).toHaveLength(4);
    for (let i = 1; i < players.length; i++) {
      const gap = Math.hypot(players[i].x - players[i - 1].x, players[i].z - players[i - 1].z);
      expect(gap).toBeCloseTo(WALL.spacing, 9);
    }
    // 並びの線はボールから 9.15 m 離れている
    const [a, b] = players;
    const tx = b.x - a.x, tz = b.z - a.z;
    const cross = Math.abs((a.x - spot.x) * tz - (a.z - spot.z) * tx) / Math.hypot(tx, tz);
    expect(cross).toBeCloseTo(WALL.distance, 6);
  });
  it('0 人なら空', () => {
    expect(wallPlayers({ x: -25, z: 0 }, setup({ count: 0 }))).toEqual([]);
  });
  it('ニアポストへの直線を塞ぐ', () => {
    for (const z of [-8, 5, 12]) {
      const spot = { x: -24, z };
      const players = wallPlayers(spot, setup());
      const post = { x: 0, z: Math.sign(z) * (FIELD.goalWidth / 2) };
      const len = Math.hypot(post.x - spot.x, post.z - spot.z);
      const dx = (post.x - spot.x) / len, dz = (post.z - spot.z) / len;
      const nearest = Math.min(
        ...players.map((p) => Math.abs((p.x - spot.x) * dz - (p.z - spot.z) * dx)),
      );
      expect(nearest).toBeLessThan(WALL.radius + 0.2);
    }
  });
  it('壁はゴール中央の側へ伸びる', () => {
    const players = wallPlayers({ x: -24, z: 10 }, setup());
    // ニアポスト（z > 0 の側）から中央へ: z が小さくなっていく
    expect(players[3].z).toBeLessThan(players[0].z);
  });
  it('offset で横にずれる', () => {
    const a = wallPlayers({ x: -25, z: 0 }, setup());
    const b = wallPlayers({ x: -25, z: 0 }, setup({ offset: 1 }));
    expect(Math.hypot(b[0].x - a[0].x, b[0].z - a[0].z)).toBeCloseTo(1, 9);
  });
  it('ゴールに近い位置では、壁をゴールラインの手前に収める', () => {
    const players = wallPlayers({ x: -7, z: 0 }, setup());
    for (const p of players) expect(p.x).toBeLessThan(-0.5);
  });
});

describe('壁のジャンプ', () => {
  it('ジャンプしない設定なら常に 0', () => {
    expect(jumpHeight(0.3, setup({ jump: false }))).toBe(0);
  });
  it('遅れの時間までは地面、そのあと放物線で跳んで着地する', () => {
    const s = setup({ jump: true, jumpDelay: 0.2 });
    expect(jumpHeight(0.1, s)).toBe(0);
    expect(jumpHeight(0.2 + WALL.jumpSpeed / 9.81, s)).toBeCloseTo(WALL.jumpSpeed ** 2 / (2 * 9.81), 6);
    expect(jumpHeight(5, s)).toBe(0);
  });
});
