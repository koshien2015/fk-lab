/**
 * お手本の蹴り方が、GK の強さごとにどう判定されるかを確かめる。
 * `node scripts/shot-check.ts` で実行する。
 */
import { DEFAULT_SETUP, SETUP_PRESETS, toKickState, type KickSetup } from '../src/app/setup.ts';
import { simulateShot } from '../src/match/shot.ts';
import { defaultParams } from '../src/physics/params.ts';

const params = defaultParams();
const wall = { count: 4, offset: 0, jump: false, jumpDelay: 0.15 };

for (const preset of SETUP_PRESETS) {
  const setup: KickSetup = { ...DEFAULT_SETUP, ...preset.patch };
  for (const keeper of ['none', 'easy', 'normal', 'hard'] as const) {
    const tally: Record<string, number> = {};
    let ms = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const t0 = performance.now();
      const result = simulateShot(toKickState(setup, params), params, { spot: setup.spot, wall, keeper, seed });
      ms += performance.now() - t0;
      tally[result.outcome] = (tally[result.outcome] ?? 0) + 1;
    }
    const summary = Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ');
    console.log(`${preset.label.padEnd(5)} GK ${keeper.padEnd(6)} ${summary}  (${(ms / 20).toFixed(1)} ms/本)`);
  }
}
