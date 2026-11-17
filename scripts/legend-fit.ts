/**
 * 伝説の FK のプリセットを決めるための下調べ。
 * 状況（位置、壁、狙う点、球種）を与えて逆算し、GK「つよい」を相手にゴールになるシードを探す。
 * `node scripts/legend-fit.ts` で実行する。
 */
import { DEFAULT_SETUP, toKickState, toScenario, type KickSetup } from '../src/app/setup.ts';
import { simulateShot } from '../src/match/shot.ts';
import { defaultParams } from '../src/physics/params.ts';
import { solveKick, type InverseRequest } from '../src/solver/inverse.ts';

const params = defaultParams();

const CASES: ReadonlyArray<{ name: string; setup: Partial<KickSetup>; request: Omit<InverseRequest, 'setup'> }> = [
  {
    name: 'アウトサイドで大きく曲がる FK（約 35 m）',
    setup: { spot: { x: -35, z: 2 }, wall: { count: 4, offset: 0, jump: false, jumpDelay: 0.15 } },
    request: { target: { y: 0.9, z: 3.35 }, style: 'curve', curveDirection: 1 },
  },
  {
    name: '無回転 FK（約 30 m）',
    setup: { spot: { x: -29, z: 6 }, wall: { count: 4, offset: 0, jump: true, jumpDelay: 0.2 } },
    request: { target: { y: 2.0, z: -3.1 }, style: 'knuckle' },
  },
];

for (const c of CASES) {
  console.log(`\n■ ${c.name}`);
  for (let seed = 1; seed <= 8; seed++) {
    const setup: KickSetup = { ...DEFAULT_SETUP, ...c.setup, keeper: 'hard', seed };
    const t0 = performance.now();
    const solution = solveKick({ setup, ...c.request }, params);
    const ms = performance.now() - t0;
    const solved = { ...setup, ...solution.patch };
    const result = simulateShot(toKickState(solved, params), params, toScenario(solved));
    const patch = JSON.stringify(solution.patch, (_k, v) => (typeof v === 'number' ? Number(v.toFixed(3)) : v));
    console.log(`  seed ${seed}: ${result.outcome.padEnd(5)} ずれ ${solution.miss.toFixed(2)} m, 壁 ${solution.clearsWall ? '○' : '×'}, ${solution.evaluations} 回 ${ms.toFixed(0)} ms  ${patch}`);
  }
}
