/**
 * 物理コアの結果をコンソールで確かめる。`npm run sim` で実行する。
 */
import { defaultParams } from '../src/physics/params.ts';
import { DEMO_KICKS } from '../src/physics/presets.ts';
import { simulate } from '../src/physics/simulate.ts';
import type { Trajectory } from '../src/physics/types.ts';

const fmt = (x: number, digits = 2): string => x.toFixed(digits).padStart(7);

/** x がこの距離に達したときの (y, z, 速さ) を線形補間で求める */
function at(tr: Trajectory, x: number): { y: number; z: number; speed: number; t: number } | null {
  for (let i = 1; i < tr.count; i++) {
    const x0 = tr.pos[(i - 1) * 3], x1 = tr.pos[i * 3];
    if (x0 <= x && x <= x1) {
      const k = (x - x0) / (x1 - x0);
      const lerp = (arr: Float64Array, a: number): number =>
        arr[(i - 1) * 3 + a] + k * (arr[i * 3 + a] - arr[(i - 1) * 3 + a]);
      return {
        y: lerp(tr.pos, 1),
        z: lerp(tr.pos, 2),
        speed: Math.hypot(lerp(tr.vel, 0), lerp(tr.vel, 1), lerp(tr.vel, 2)),
        t: tr.t[i - 1] + k * (tr.t[i] - tr.t[i - 1]),
      };
    }
  }
  return null;
}

const params = defaultParams();
const GOAL_DISTANCE = 25;

for (const demo of DEMO_KICKS) {
  const isBaseline = demo.id === 'straight';
  const p = isBaseline ? defaultParams({ knuckleCoefficient: 0 }) : params;
  const t0 = performance.now();
  const tr = simulate(demo.kick, p, { seed: 7 });
  const ms = performance.now() - t0;
  const v0 = Math.hypot(...demo.kick.velocity);
  const w0 = Math.hypot(...demo.kick.omega) / (2 * Math.PI);

  console.log(`\n■ ${demo.label}：${demo.description}`);
  console.log(`  初速 ${v0.toFixed(1)} m/s (${(v0 * 3.6).toFixed(0)} km/h), 回転 ${w0.toFixed(1)} rps, 計算 ${ms.toFixed(1)} ms`);
  console.log('     x[m]    t[s]    y[m]    z[m]  v[m/s]');
  for (let x = 5; x <= 30; x += 5) {
    const s = at(tr, x);
    if (!s) break;
    console.log(`  ${fmt(x, 0)} ${fmt(s.t)} ${fmt(s.y)} ${fmt(s.z)} ${fmt(s.speed, 1)}`);
  }
  const goal = at(tr, GOAL_DISTANCE);
  if (goal) {
    console.log(`  ${GOAL_DISTANCE} m 先での位置: 高さ ${goal.y.toFixed(2)} m, 横 ${goal.z.toFixed(2)} m`);
  }
  console.log(`  着地: x=${tr.final.position[0].toFixed(1)} m, t=${tr.final.t.toFixed(2)} s, C_D ${tr.cd[0].toFixed(2)} → ${tr.cd[tr.count - 1].toFixed(2)}`);
  const c = tr.contributions;
  console.log('  変位への寄与 [m]    前後      上下      左右');
  for (const key of ['gravity', 'drag', 'magnus', 'knuckle'] as const) {
    console.log(`    ${key.padEnd(8)} ${fmt(c[key][0])}  ${fmt(c[key][1])}  ${fmt(c[key][2])}`);
  }
}

console.log('\n■ ナックルの揺れ方（シードごとの 25 m 先での横ずれ [m]）');
const knuckle = DEMO_KICKS.find((d) => d.id === 'knuckle')!;
const offsets = Array.from({ length: 12 }, (_, seed) => {
  const s = at(simulate(knuckle.kick, params, { seed }), GOAL_DISTANCE);
  return s ? s.z : NaN;
});
console.log('  ' + offsets.map((z) => z.toFixed(2)).join('  '));
