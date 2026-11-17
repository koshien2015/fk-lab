/**
 * GK の強さの確認。ゴールの各所を狙った球（まっすぐ / カーブ / ナックル）を
 * 20 通りのシードで蹴り、難易度ごとのセーブ率を表にする。
 * `node scripts/keeper-check.ts` で実行する。
 */
import { simulateShot } from '../src/match/shot.ts';
import { kickToState, type KickInput } from '../src/physics/kick.ts';
import { defaultParams } from '../src/physics/params.ts';
import { simulate } from '../src/physics/simulate.ts';

const params = defaultParams();
const spot = { x: -25, z: 0 };
const start = [spot.x, params.radius, spot.z] as const;
const NO_WALL = { count: 0, offset: 0, jump: false, jumpDelay: 0.15 };

/** ゴールラインを通る位置 (y, z)。届かなければ null。 */
function crossing(input: KickInput, seed: number): { y: number; z: number } | null {
  const tr = simulate(kickToState(input, start, params), params, { seed, stopAtX: 0 });
  return tr.final.position[0] >= 0 ? { y: tr.final.position[1], z: tr.final.position[2] } : null;
}

/** 向きと高さを少しずつ直して、(y, z) を通る蹴り方を探す */
function aimFor(base: KickInput, target: { y: number; z: number }, seed: number): KickInput {
  let input = base;
  for (let i = 0; i < 12; i++) {
    const hit = crossing(input, seed);
    if (!hit) {
      input = { ...input, elevationDeg: input.elevationDeg + 2 };
      continue;
    }
    input = {
      ...input,
      azimuthDeg: input.azimuthDeg + (Math.atan2(target.z - hit.z, 25) * 180) / Math.PI,
      elevationDeg: input.elevationDeg + (Math.atan2(target.y - hit.y, 25) * 180) / Math.PI,
    };
  }
  return input;
}

const STYLES: ReadonlyArray<{ label: string; base: KickInput }> = [
  { label: 'まっすぐ', base: { contact: [0, -0.12], azimuthDeg: 0, elevationDeg: 12, power: 0.8 } },
  { label: '右カーブ', base: { contact: [-0.42, -0.1], azimuthDeg: 0, elevationDeg: 12, power: 0.78 } },
  { label: 'ナックル', base: { contact: [0, 0], azimuthDeg: 0, elevationDeg: 12, power: 0.85 } },
];
const TARGETS = [0.4, 1.3, 2.1].flatMap((y) => [-3.2, -2.2, -1.1, 0, 1.1, 2.2, 3.2].map((z) => ({ y, z })));
const SEEDS = 20;

for (const style of STYLES) {
  console.log(`\n■ ${style.label}（数字はセーブ率 %。列は狙う横位置 z [m]、行は高さ y [m]）`);
  for (const keeper of ['easy', 'normal', 'hard'] as const) {
    console.log(`  GK ${keeper}        z= -3.2  -2.2  -1.1   0.0   1.1   2.2   3.2`);
    let saves = 0;
    let total = 0;
    for (const y of [2.1, 1.3, 0.4]) {
      const cells = TARGETS.filter((t) => t.y === y).map((target) => {
        let saved = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
          // ナックルは揺れ方がシードで変わるので、シードごとに狙い直す
          const input = aimFor(style.base, target, seed);
          const result = simulateShot(kickToState(input, start, params), params, { spot, wall: NO_WALL, keeper, seed });
          if (result.outcome === 'save') saved++;
        }
        saves += saved;
        total += SEEDS;
        return String(Math.round((saved / SEEDS) * 100)).padStart(5);
      });
      console.log(`    y=${y.toFixed(1)}        ${cells.join(' ')}`);
    }
    console.log(`    全体のセーブ率 ${Math.round((saves / total) * 100)}%`);
  }
}
