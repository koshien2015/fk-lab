/**
 * お手本の蹴り方が、ゴールラインのどこを通るかを確かめる。
 * `node scripts/preset-check.ts` で実行する。引数で設定を上書きできる:
 *   node scripts/preset-check.ts curve '{"aimDeg":-7,"elevationDeg":12}'
 */
import { DEFAULT_SETUP, SETUP_PRESETS, toKickState, type KickSetup } from '../src/app/setup.ts';
import { defaultParams } from '../src/physics/params.ts';
import { simulate } from '../src/physics/simulate.ts';

const params = defaultParams();
const [onlyId, overrideJson] = process.argv.slice(2);
const override: Partial<KickSetup> = overrideJson ? JSON.parse(overrideJson) : {};

for (const preset of SETUP_PRESETS) {
  if (onlyId && preset.id !== onlyId) continue;
  const setup: KickSetup = { ...DEFAULT_SETUP, ...preset.patch, ...override };
  const tr = simulate(toKickState(setup, params), params, { seed: setup.seed });
  const rps = Math.hypot(...toKickState(setup, params).omega) / (2 * Math.PI);
  let line = `着地 x=${tr.final.position[0].toFixed(1)}（ゴールラインに届かない）`;
  for (let i = 1; i < tr.count; i++) {
    const x0 = tr.pos[(i - 1) * 3], x1 = tr.pos[i * 3];
    if (x0 < 0 && x1 >= 0) {
      const k = -x0 / (x1 - x0);
      const y = tr.pos[(i - 1) * 3 + 1] + k * (tr.pos[i * 3 + 1] - tr.pos[(i - 1) * 3 + 1]);
      const z = tr.pos[(i - 1) * 3 + 2] + k * (tr.pos[i * 3 + 2] - tr.pos[(i - 1) * 3 + 2]);
      line = `ゴールライン: 高さ ${y.toFixed(2)} m, 横 ${z.toFixed(2)} m, t=${tr.t[i].toFixed(2)} s`;
      break;
    }
  }
  console.log(`${preset.label.padEnd(6)} ${rps.toFixed(1)} rps  ${line}`);
}
