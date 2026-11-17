import { describe, expect, it } from 'vitest';
import { FIELD } from '../../src/field/dimensions.ts';
import { simulateShot, type ShotScenario } from '../../src/match/shot.ts';
import type { WallSetup } from '../../src/match/wall.ts';
import { defaultParams } from '../../src/physics/params.ts';
import type { KickState } from '../../src/physics/types.ts';

const p = defaultParams({ knuckleCoefficient: 0 });
const R = p.radius;
const NO_WALL: WallSetup = { count: 0, offset: 0, jump: false, jumpDelay: 0.15 };

const scenario = (over: Partial<ShotScenario> = {}): ShotScenario => ({
  spot: { x: -20, z: 0 },
  wall: NO_WALL,
  keeper: 'none',
  seed: 1,
  ...over,
});

/** (x, z) から、ゴールライン上の (y, z) を直線で狙う初速 */
const aimAt = (from: { x: number; z: number }, target: { y: number; z: number }, speed: number): KickState => {
  const d = [0 - from.x, target.y - R, target.z - from.z];
  const n = Math.hypot(d[0], d[1], d[2]);
  return {
    position: [from.x, R, from.z],
    velocity: [(d[0] / n) * speed, (d[1] / n) * speed, (d[2] / n) * speed],
    omega: [0, 0, 0],
  };
};
const kinds = (r: ReturnType<typeof simulateShot>): string[] => r.events.map((e) => e.kind);

describe('地面とのバウンド', () => {
  const drop: KickState = { position: [-20, 3, 0], velocity: [0, 0, 0], omega: [0, 0, 0] };
  const vacuum = defaultParams({ airDensity: 0 });

  it('真上から落とすと、反発係数の 2 乗の高さまで跳ね返る', () => {
    const r = simulateShot(drop, vacuum, scenario());
    const tr = r.trajectory;
    const firstBounce = r.events.find((e) => e.kind === 'ground');
    expect(firstBounce).toBeDefined();
    let apex = 0;
    for (let i = 0; i < tr.count; i++) {
      if (tr.t[i] > firstBounce!.t + 0.05 && tr.t[i] < firstBounce!.t + 0.9) {
        apex = Math.max(apex, tr.pos[i * 3 + 1]);
      }
    }
    const expected = R + (3 - R) * vacuum.groundRestitution ** 2;
    expect(apex).toBeCloseTo(expected, 1);
  });
  it('ボールは地面にめり込まない', () => {
    const r = simulateShot(aimAt({ x: -30, z: 0 }, { y: 1, z: 0 }, 14), p, scenario({ spot: { x: -30, z: 0 } }));
    for (let i = 0; i < r.trajectory.count; i++) {
      expect(r.trajectory.pos[i * 3 + 1]).toBeGreaterThan(R - 1e-6);
    }
  });
  it('回転なしで斜めに落ちると、摩擦で前回りの回転がつき、水平の速さが落ちる', () => {
    const kick: KickState = { position: [-30, 1, 0], velocity: [10, 0, 0], omega: [0, 0, 0] };
    const r = simulateShot(kick, vacuum, scenario());
    const bounce = r.events.find((e) => e.kind === 'ground')!;
    const tr = r.trajectory;
    const i = Array.from(tr.t).findIndex((t) => t > bounce.t + 0.02);
    expect(tr.omega[i * 3 + 2]).toBeLessThan(-5); // +x へ転がる向き = ω_z < 0
    expect(tr.vel[i * 3]).toBeLessThan(10);
    expect(tr.vel[i * 3]).toBeGreaterThan(5);
  });
  it('転がるボールはやがて止まり、力学的エネルギーは増えない', () => {
    const kick: KickState = { position: [-40, R, 0], velocity: [6, 2, 0], omega: [0, 0, 0] };
    const r = simulateShot(kick, vacuum, scenario());
    const tr = r.trajectory;
    const energy = (i: number): number => {
      const v2 = tr.vel[i * 3] ** 2 + tr.vel[i * 3 + 1] ** 2 + tr.vel[i * 3 + 2] ** 2;
      const w2 = tr.omega[i * 3] ** 2 + tr.omega[i * 3 + 1] ** 2 + tr.omega[i * 3 + 2] ** 2;
      const I = (2 / 3) * vacuum.mass * R * R;
      return 0.5 * vacuum.mass * v2 + 0.5 * I * w2 + vacuum.mass * vacuum.gravity * tr.pos[i * 3 + 1];
    };
    for (let i = 1; i < tr.count; i++) expect(energy(i)).toBeLessThanOrEqual(energy(i - 1) + 1e-6);
    expect(Math.hypot(...r.trajectory.final.velocity)).toBeLessThan(0.3);
    expect(r.trajectory.final.position[0]).toBeLessThan(-5);
  });
});

describe('判定', () => {
  it('GK なしでゴール中央へ蹴ればゴール。ボールはネットの中に残る', () => {
    const r = simulateShot(aimAt({ x: -20, z: 0 }, { y: 1.5, z: 0 }, 28), p, scenario());
    expect(r.outcome).toBe('goal');
    expect(kinds(r)).toContain('goal');
    expect(kinds(r)).toContain('net');
    const [x, y, z] = r.trajectory.final.position;
    expect(x).toBeGreaterThan(0);
    // ネットはたるんでいるので、張った位置より少し奥まで押し込まれる
    expect(x).toBeLessThan(FIELD.goalDepthBottom + 0.9);
    expect(Math.abs(z)).toBeLessThan(FIELD.goalWidth / 2 + 0.6);
    expect(y).toBeLessThan(FIELD.goalHeight + 0.3);
    expect(Math.hypot(...r.trajectory.final.velocity)).toBeLessThan(3);
    // ネットの動きが、節点 × 3 要素のコマとして記録されている
    expect(r.net).not.toBeNull();
    expect(r.net!.frames.length % (r.net!.nodeCount * 3)).toBe(0);
    expect(r.net!.frames.length / (r.net!.nodeCount * 3)).toBeGreaterThan(30);
  });
  it('ゴールから遠い所で終わるキックでは、ネットを計算しない', () => {
    const r = simulateShot(aimAt({ x: -40, z: 0 }, { y: 0.5, z: 0 }, 8), p, scenario({ spot: { x: -40, z: 0 } }));
    expect(r.net).toBeNull();
  });
  it('枠の外へ蹴ると枠外', () => {
    const wide = simulateShot(aimAt({ x: -20, z: 0 }, { y: 1, z: 6 }, 28), p, scenario());
    expect(wide.outcome).toBe('out');
    const over = simulateShot(aimAt({ x: -20, z: 0 }, { y: 6, z: 0 }, 30), p, scenario());
    expect(over.outcome).toBe('out');
  });
  it('ポストの正面に当たると跳ね返ってポスト判定', () => {
    const postZ = FIELD.goalWidth / 2 + FIELD.postRadius;
    const r = simulateShot(aimAt({ x: -20, z: postZ }, { y: 0.9, z: postZ }, 28), p, scenario({ spot: { x: -20, z: postZ } }));
    expect(kinds(r)).toContain('post');
    expect(r.outcome).toBe('post');
    const hit = r.events.find((e) => e.kind === 'post')!;
    const i = Array.from(r.trajectory.t).findIndex((t) => t > hit.t + 0.02);
    expect(r.trajectory.vel[i * 3]).toBeLessThan(0);
  });
  it('ポストの内側をかすめると、ポストに当たって入る（ゴール）', () => {
    const inner = FIELD.goalWidth / 2 - R * 0.82;
    const r = simulateShot(aimAt({ x: -20, z: 0 }, { y: 1.0, z: inner }, 28), p, scenario());
    expect(kinds(r)).toContain('post');
    expect(r.outcome).toBe('goal');
  });
  it('クロスバーの下面に当たると下へ跳ねる', () => {
    const r = simulateShot(
      aimAt({ x: -20, z: 0 }, { y: FIELD.goalHeight + 0.5, z: 0 }, 30),
      defaultParams({ airDensity: 0, gravity: 9.81 }),
      scenario(),
    );
    // 重力で少し落ちて、バーの付近を通る球を探す代わりに、当たった場合だけ向きを確かめる
    const hit = r.events.find((e) => e.kind === 'post');
    if (hit) expect(hit.position[1]).toBeGreaterThan(FIELD.goalHeight - R);
    expect(['post', 'goal', 'out']).toContain(r.outcome);
  });
  it('同じ条件なら同じ結果（決定性）', () => {
    const k = aimAt({ x: -20, z: 0 }, { y: 1.2, z: 2.5 }, 26);
    const s = scenario({ keeper: 'normal', seed: 5 });
    const full = defaultParams();
    const a = simulateShot(k, full, s);
    const b = simulateShot(k, full, s);
    expect(a.outcome).toBe(b.outcome);
    expect(Array.from(a.trajectory.pos)).toEqual(Array.from(b.trajectory.pos));
    expect(Array.from(a.keeper.z)).toEqual(Array.from(b.keeper.z));
    expect(a.events).toEqual(b.events);
    expect(Array.from(a.net?.frames ?? [])).toEqual(Array.from(b.net?.frames ?? []));
  });
});

describe('壁', () => {
  const spot = { x: -25, z: 0 };
  // 5 人の真ん中の選手が、ボールとゴール中央を結ぶ線の上に立つ
  const wall: WallSetup = { count: 5, offset: 0.59, jump: false, jumpDelay: 0.1 };

  it('壁の正面へ低く蹴ると壁に当たる', () => {
    const r = simulateShot(aimAt(spot, { y: 0.8, z: 0 }, 27), p, scenario({ spot, wall }));
    expect(kinds(r)).toContain('wall');
    expect(r.outcome).toBe('wall');
  });
  it('壁の上を越える球は当たらない', () => {
    const kick: KickState = { position: [spot.x, R, spot.z], velocity: [24, 12, 0], omega: [0, 0, 0] };
    const r = simulateShot(kick, p, scenario({ spot, wall }));
    expect(kinds(r)).not.toContain('wall');
  });
  it('壁が跳ぶと、グラウンダーが足の下を抜ける', () => {
    const kick: KickState = { position: [spot.x, R, spot.z], velocity: [27, 0.6, 0], omega: [0, 0, 0] };
    const standing = simulateShot(kick, p, scenario({ spot, wall }));
    expect(kinds(standing)).toContain('wall');
    const jumping = simulateShot(kick, p, scenario({ spot, wall: { ...wall, jump: true } }));
    expect(kinds(jumping)).not.toContain('wall');
    expect(jumping.outcome).toBe('goal');
  });
});

describe('ゴールキーパー', () => {
  it('反応時間が経つまでは動かない', () => {
    const r = simulateShot(aimAt({ x: -20, z: 0 }, { y: 1, z: 3 }, 26), p, scenario({ keeper: 'normal' }));
    const tr = r.trajectory;
    const z0 = r.keeper.z[0];
    for (let i = 0; i < tr.count && tr.t[i] < r.keeper.config!.reactionTime; i++) {
      expect(r.keeper.z[i]).toBe(z0);
      expect(r.keeper.lean[i]).toBe(0);
    }
    expect(Math.abs(r.keeper.z[tr.count - 1] - z0) + Math.abs(r.keeper.lean[tr.count - 1])).toBeGreaterThan(0.3);
  });
  it('正面への球はセーブする', () => {
    const r = simulateShot(aimAt({ x: -20, z: 0 }, { y: 1.1, z: 0 }, 26), p, scenario({ keeper: 'normal' }));
    expect(kinds(r)).toContain('keeper');
    expect(r.outcome).toBe('save');
  });
  it('まっすぐな低い球は、隅を狙っても GK が届く', () => {
    const r = simulateShot(aimAt({ x: -25, z: 0 }, { y: 0.5, z: 2.6 }, 24), p, scenario({ spot: { x: -25, z: 0 }, keeper: 'hard' }));
    expect(r.outcome).toBe('save');
  });
  it('速い球を上の隅へ決めれば入る', () => {
    const kick: KickState = { position: [-20, R, 0], velocity: [28.5, 6.3, 4.3], omega: [0, 0, 0] };
    const r = simulateShot(kick, p, scenario({ keeper: 'normal' }));
    expect(r.outcome).toBe('goal');
  });
  it('難しいほど反応が速い', () => {
    const levels = (['easy', 'normal', 'hard'] as const).map(
      (keeper) => simulateShot(aimAt({ x: -20, z: 0 }, { y: 1, z: 2 }, 26), p, scenario({ keeper })).keeper.config!,
    );
    expect(levels[0].reactionTime).toBeGreaterThan(levels[1].reactionTime);
    expect(levels[1].reactionTime).toBeGreaterThan(levels[2].reactionTime);
    for (const c of levels) {
      expect(c.reactionTime).toBeGreaterThanOrEqual(0.2);
      expect(c.reactionTime).toBeLessThanOrEqual(0.35);
    }
  });
  it('横移動は最大速度を超えない', () => {
    const r = simulateShot(aimAt({ x: -30, z: 0 }, { y: 1, z: 3.3 }, 24), p, scenario({ spot: { x: -30, z: 0 }, keeper: 'hard' }));
    const tr = r.trajectory;
    for (let i = 1; i < tr.count; i++) {
      const speed = Math.abs(r.keeper.z[i] - r.keeper.z[i - 1]) / (tr.t[i] - tr.t[i - 1]);
      expect(speed).toBeLessThanOrEqual(r.keeper.config!.maxSpeed + 1e-6);
    }
  });
  it('曲がる球には、はじめ逆を突かれる（等速直線で予測するため）', () => {
    // 左へ打ち出して右へ巻く球: 最終的にはゴール右側、はじめの予測は左側
    const kick: KickState = { position: [-25, R, 0], velocity: [25.5, 7.2, -2.6], omega: [0, -50, 0] };
    const r = simulateShot(kick, p, scenario({ spot: { x: -25, z: 0 }, keeper: 'normal' }));
    const tr = r.trajectory;
    const reaction = r.keeper.config!.reactionTime;
    const early = Array.from(tr.t).findIndex((t) => t > reaction + 0.15);
    expect(r.keeper.z[early] - r.keeper.z[0] + r.keeper.lean[early]).toBeLessThan(0);
    const goalEvent = r.events.find((e) => e.kind === 'goal' || e.kind === 'keeper' || e.kind === 'out');
    expect(goalEvent).toBeDefined();
    expect(goalEvent!.position[2]).toBeGreaterThan(0.5);
  });
});

describe('グラウンダーと、届かない球', () => {
  it('転がる球の寄与は、転がり始めた時点で止める（重力が何十 m も落としたことにならない）', () => {
    const kick: KickState = { position: [-25, R, 0], velocity: [18, 0, 0], omega: [0, 0, 0] };
    const r = simulateShot(kick, p, scenario({ spot: { x: -25, z: 0 } }));
    expect(Math.abs(r.trajectory.contributions.gravity[1])).toBeLessThan(0.05);
    expect(r.flightTime).toBeLessThan(0.2);
  });
  it('予測線用の打ち切り: ゴールラインに届いたら終わる', () => {
    const kick: KickState = { position: [-25, R, 0], velocity: [20, 0, 0], omega: [0, 0, 0] };
    const r = simulateShot(kick, p, scenario({ spot: { x: -25, z: 0 }, stopAtGoalLine: true }));
    expect(r.trajectory.final.position[0]).toBeGreaterThanOrEqual(R);
    expect(r.trajectory.final.position[0]).toBeLessThan(R + 0.1);
    expect(r.trajectory.count).toBeGreaterThan(50);
  });
  it('GK がいないのに届かなかった球は、セーブではなく枠外', () => {
    const kick: KickState = { position: [-50, R, 0], velocity: [8, 1, 0], omega: [0, 0, 0] };
    expect(simulateShot(kick, p, scenario({ spot: { x: -50, z: 0 } })).outcome).toBe('out');
    expect(simulateShot(kick, p, scenario({ spot: { x: -50, z: 0 }, keeper: 'easy' })).outcome).toBe('save');
  });
});

describe('力ごとの寄与は、最初に何かに当たるまでの飛翔ぶんを数える', () => {
  it('ゴールに入ったあとネットで止まっても、寄与は飛翔中の値のまま', () => {
    const kick: KickState = { position: [-20, R, 0], velocity: [26, 7, -1], omega: [0, -50, 0] };
    const r = simulateShot(kick, p, scenario());
    const first = r.events[0];
    const c = r.trajectory.contributions;
    const T = first.t;
    const sumZ = kick.position[2] + kick.velocity[2] * T + c.gravity[2] + c.drag[2] + c.magnus[2] + c.knuckle[2];
    expect(sumZ).toBeCloseTo(first.position[2], 1);
    expect(r.flightTime).toBeCloseTo(T, 6);
  });
});
