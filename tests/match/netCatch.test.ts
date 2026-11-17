import { describe, expect, it } from 'vitest';
import { FIELD } from '../../src/field/dimensions.ts';
import { simulateShot } from '../../src/match/shot.ts';
import { defaultParams } from '../../src/physics/params.ts';
import type { KickState } from '../../src/physics/types.ts';

const p = defaultParams({ knuckleCoefficient: 0 });
const R = p.radius;
const NO_WALL = { count: 0, offset: 0, jump: false, jumpDelay: 0.15 };
const HALF = FIELD.goalWidth / 2;

/** ゴールライン上の (y, z) へ、近い距離からまっすぐ打ち込む（ほぼ減速せずに届く） */
function drive(target: { y: number; z: number }, speed: number, fromX = -6): KickState {
  const start = [fromX, Math.max(R, target.y), target.z * 0.8];
  const d = [0 - start[0], target.y - start[1] + 0.12, target.z - start[2]];
  const n = Math.hypot(d[0], d[1], d[2]);
  return {
    position: [start[0], start[1], start[2]],
    velocity: [(d[0] / n) * speed, (d[1] / n) * speed, (d[2] / n) * speed],
    omega: [0, 0, 0],
  };
}

const ENTRIES = [
  { name: '中央', y: 1.2, z: 0 },
  { name: '右上の隅', y: 2.1, z: HALF - 0.35 },
  { name: '左上の隅', y: 2.1, z: -HALF + 0.35 },
  { name: '右ポストの脇の低い所', y: 0.3, z: HALF - 0.3 },
  { name: '左ポストの脇の低い所', y: 0.3, z: -HALF + 0.3 },
  { name: '地面すれすれ', y: R + 0.02, z: 1 },
  { name: 'バーの下', y: 2.25, z: 0.5 },
];
const SPEEDS = [8, 18, 26, 33];

describe('ネットがボールを受け止める（速さと当たる場所を変えて）', () => {
  for (const entry of ENTRIES) {
    for (const speed of SPEEDS) {
      it(`${entry.name}へ ${speed} m/s`, () => {
        const r = simulateShot(drive(entry, speed), p, { spot: { x: -6, z: 0 }, wall: NO_WALL, keeper: 'none', seed: 1 });
        expect(r.outcome).toBe('goal');
        const tr = r.trajectory;
        // 飛んでいる間ずっと、網の外へ突き抜けない
        let deepest = -Infinity, widest = 0, highest = 0;
        for (let i = 0; i < tr.count; i++) {
          expect(Number.isFinite(tr.pos[i * 3])).toBe(true);
          deepest = Math.max(deepest, tr.pos[i * 3]);
          if (tr.pos[i * 3] > R) {
            widest = Math.max(widest, Math.abs(tr.pos[i * 3 + 2]));
            highest = Math.max(highest, tr.pos[i * 3 + 1]);
          }
        }
        expect(deepest).toBeLessThan(FIELD.goalDepthBottom + 1.0);
        expect(widest).toBeLessThan(HALF + 1.0);
        expect(highest).toBeLessThan(FIELD.goalHeight + 0.9);
        expect(Math.hypot(...tr.final.velocity)).toBeLessThan(4);
      });
    }
  }
  it('外からサイドネットに当たった球は、網を突き抜けず枠外のまま', () => {
    // ゴールラインの 1 m 奥で、右のサイドネットに外から当たる向き
    const kick: KickState = { position: [-6, 1, HALF + 2.2], velocity: [24, 0.5, -7.4], omega: [0, 0, 0] };
    const r = simulateShot(kick, p, { spot: { x: -6, z: HALF + 2.2 }, wall: NO_WALL, keeper: 'none', seed: 1 });
    expect(r.outcome).toBe('out');
    expect(r.events.map((e) => e.kind)).toContain('net');
    const tr = r.trajectory;
    for (let i = 0; i < tr.count; i++) {
      const x = tr.pos[i * 3], z = tr.pos[i * 3 + 2];
      // 網はたるみのぶんだけ内へ押されるが、ボールはゴールの内側までは入らない
      if (x > 0.2 && x < 1.3) expect(z).toBeGreaterThan(HALF - 0.9);
    }
  });
});
