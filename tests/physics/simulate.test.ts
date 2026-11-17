import { describe, expect, it } from 'vitest';
import { defaultParams } from '../../src/physics/params.ts';
import { simulate } from '../../src/physics/simulate.ts';
import type { KickState } from '../../src/physics/types.ts';

/**
 * 座標系: x = ゴール方向（前）, y = 上, z = キッカーから見て右（右手系）
 */
const G = 9.81;
const R = 0.11;

const kick = (over: Partial<KickState> = {}): KickState => ({
  position: [0, R, 0],
  velocity: [28, 9, 0],
  omega: [0, 0, 0],
  ...over,
});

const lastZ = (tr: ReturnType<typeof simulate>) => tr.pos[(tr.count - 1) * 3 + 2];
const maxAbsZ = (tr: ReturnType<typeof simulate>) => {
  let m = 0;
  for (let i = 0; i < tr.count; i++) m = Math.max(m, Math.abs(tr.pos[i * 3 + 2]));
  return m;
};

describe('解析解との一致', () => {
  it('空気をなくすと、回転があっても放物線と一致する', () => {
    const p = defaultParams({ airDensity: 0 });
    const k = kick({ position: [1, R, -2], velocity: [20, 10, 3], omega: [5, -40, 12] });
    const tr = simulate(k, p, { seed: 3 });
    expect(tr.count).toBeGreaterThan(100);
    for (let i = 0; i < tr.count; i++) {
      const t = tr.t[i];
      expect(tr.pos[i * 3]).toBeCloseTo(1 + 20 * t, 9);
      expect(tr.pos[i * 3 + 1]).toBeCloseTo(R + 10 * t - 0.5 * G * t * t, 9);
      expect(tr.pos[i * 3 + 2]).toBeCloseTo(-2 + 3 * t, 9);
    }
    // 滞空時間 2·vy/g の直後で止まる
    expect(tr.final.t).toBeGreaterThanOrEqual((2 * 10) / G);
    expect(tr.final.t).toBeLessThan((2 * 10) / G + 0.002);
  });
});

describe('対称性', () => {
  it('無回転でナックル振幅ゼロなら、横に一切曲がらない', () => {
    const p = defaultParams({ knuckleCoefficient: 0 });
    const tr = simulate(kick(), p, { seed: 9 });
    expect(maxAbsZ(tr)).toBe(0);
    for (let i = 0; i < tr.count * 3; i++) expect(tr.omega[i]).toBe(0);
  });
  it('左右を反転した蹴り方は、左右を反転した軌道になる', () => {
    const p = defaultParams({ knuckleCoefficient: 0 });
    const a = simulate(kick({ velocity: [25, 8, 2], omega: [3, -50, 10] }), p);
    // z の鏡映: 極ベクトルは z を反転、軸ベクトル ω は x, y を反転
    const b = simulate(kick({ velocity: [25, 8, -2], omega: [-3, 50, 10] }), p);
    expect(a.count).toBe(b.count);
    for (let i = 0; i < a.count; i++) {
      expect(b.pos[i * 3]).toBeCloseTo(a.pos[i * 3], 10);
      expect(b.pos[i * 3 + 1]).toBeCloseTo(a.pos[i * 3 + 1], 10);
      expect(b.pos[i * 3 + 2]).toBeCloseTo(-a.pos[i * 3 + 2], 10);
    }
  });
});

describe('マグヌス力の向き', () => {
  const p = defaultParams({ knuckleCoefficient: 0 });
  const flat = simulate(kick(), p);
  const SPIN = 60; // rad/s ≈ 9.5 rps

  it('バックスピン（上面が手前へ動く, ω_z > 0）は揚力が上向き', () => {
    const tr = simulate(kick({ omega: [0, 0, SPIN] }), p);
    expect(tr.forces.magnus[1]).toBeGreaterThan(0);
    expect(tr.forces.magnus[2]).toBeCloseTo(0, 12);
    expect(tr.final.t).toBeGreaterThan(flat.final.t);
    expect(maxAbsZ(tr)).toBeLessThan(1e-9);
  });
  it('トップスピン（ω_z < 0）は下向きで、早く落ちる', () => {
    const tr = simulate(kick({ omega: [0, 0, -SPIN] }), p);
    expect(tr.forces.magnus[1]).toBeLessThan(0);
    expect(tr.final.t).toBeLessThan(flat.final.t);
  });
  it('上から見て時計回り（ω_y < 0）は右（+z）へ曲がる', () => {
    const tr = simulate(kick({ omega: [0, -SPIN, 0] }), p);
    expect(tr.forces.magnus[2]).toBeGreaterThan(0);
    expect(lastZ(tr)).toBeGreaterThan(1);
  });
  it('上から見て反時計回り（ω_y > 0）は左（−z）へ曲がる', () => {
    const tr = simulate(kick({ omega: [0, SPIN, 0] }), p);
    expect(tr.forces.magnus[2]).toBeLessThan(0);
    expect(lastZ(tr)).toBeLessThan(-1);
  });
  it('回転軸が進行方向と平行（ジャイロ回転）なら力はゼロ', () => {
    const tr = simulate(kick({ velocity: [28, 0, 0], position: [0, 2, 0], omega: [SPIN, 0, 0] }), p);
    expect(Math.hypot(tr.forces.magnus[0], tr.forces.magnus[1], tr.forces.magnus[2])).toBeLessThan(
      1e-12,
    );
  });
  it('マグヌス力は速度に垂直', () => {
    const tr = simulate(kick({ velocity: [22, 7, 3], omega: [10, -40, 25] }), p);
    for (let i = 0; i < tr.count; i += 20) {
      const dot =
        tr.forces.magnus[i * 3] * tr.vel[i * 3] +
        tr.forces.magnus[i * 3 + 1] * tr.vel[i * 3 + 1] +
        tr.forces.magnus[i * 3 + 2] * tr.vel[i * 3 + 2];
      expect(Math.abs(dot)).toBeLessThan(1e-9);
    }
  });
});

describe('ナックル（無回転）', () => {
  const p = defaultParams();
  it('無回転なら横に揺れる', () => {
    const tr = simulate(kick(), p, { seed: 1 });
    expect(maxAbsZ(tr)).toBeGreaterThan(0.05);
  });
  it('同じシードなら完全に同じ結果になる', () => {
    const a = simulate(kick(), p, { seed: 1234 });
    const b = simulate(kick(), p, { seed: 1234 });
    expect(a.count).toBe(b.count);
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
    expect(Array.from(a.forces.knuckle)).toEqual(Array.from(b.forces.knuckle));
    expect(a.final).toEqual(b.final);
  });
  it('シードが違えば揺れ方が違う', () => {
    const a = simulate(kick(), p, { seed: 1 });
    const b = simulate(kick(), p, { seed: 2 });
    expect(Math.abs(lastZ(a) - lastZ(b))).toBeGreaterThan(1e-3);
  });
  it('強い回転をかけるとナックル横力は消える', () => {
    const tr = simulate(kick({ omega: [0, -60, 0] }), p, { seed: 1 });
    for (let i = 0; i < tr.count * 3; i++) expect(tr.forces.knuckle[i]).toBe(0);
  });
  it('ナックル横力は速度に垂直', () => {
    const tr = simulate(kick({ velocity: [26, 8, 2] }), p, { seed: 5 });
    for (let i = 0; i < tr.count; i += 20) {
      const dot =
        tr.forces.knuckle[i * 3] * tr.vel[i * 3] +
        tr.forces.knuckle[i * 3 + 1] * tr.vel[i * 3 + 1] +
        tr.forces.knuckle[i * 3 + 2] * tr.vel[i * 3 + 2];
      expect(Math.abs(dot)).toBeLessThan(1e-9);
    }
  });
});

describe('抗力とドラッグクライシス', () => {
  const p = defaultParams({ knuckleCoefficient: 0 });
  it('抗力は速度の逆向き', () => {
    const tr = simulate(kick({ velocity: [20, 6, -4] }), p);
    for (let i = 0; i < tr.count; i += 25) {
      const [fx, fy, fz] = [tr.forces.drag[i * 3], tr.forces.drag[i * 3 + 1], tr.forces.drag[i * 3 + 2]];
      const [vx, vy, vz] = [tr.vel[i * 3], tr.vel[i * 3 + 1], tr.vel[i * 3 + 2]];
      const cos = (fx * vx + fy * vy + fz * vz) / (Math.hypot(fx, fy, fz) * Math.hypot(vx, vy, vz));
      expect(cos).toBeCloseTo(-1, 10);
    }
  });
  it('空気があると飛距離が縮む', () => {
    const vac = simulate(kick(), defaultParams({ airDensity: 0 }));
    const air = simulate(kick(), p);
    expect(air.final.position[0]).toBeLessThan(vac.final.position[0] * 0.9);
  });
  it('減速して臨界域を通ると C_D が上がる', () => {
    const tr = simulate(kick({ velocity: [22, 14, 0] }), p);
    expect(tr.cd[tr.count - 1]).toBeGreaterThan(tr.cd[0] * 1.3);
    expect(tr.re[tr.count - 1]).toBeLessThan(tr.re[0]);
  });
});

describe('回転の減衰と姿勢', () => {
  it('回転数は単調に減る', () => {
    const tr = simulate(kick({ omega: [0, -60, 20] }), defaultParams());
    let prev = Infinity;
    for (let i = 0; i < tr.count; i++) {
      const w = Math.hypot(tr.omega[i * 3], tr.omega[i * 3 + 1], tr.omega[i * 3 + 2]);
      expect(w).toBeLessThanOrEqual(prev);
      prev = w;
    }
    expect(prev).toBeLessThan(Math.hypot(60, 20));
    expect(prev).toBeGreaterThan(Math.hypot(60, 20) * 0.5);
  });
  it('減衰係数ゼロなら回転は変わらない', () => {
    const tr = simulate(kick({ omega: [0, -60, 20] }), defaultParams({ spinDecayCoefficient: 0 }));
    const i = tr.count - 1;
    expect(tr.omega[i * 3 + 1]).toBeCloseTo(-60, 12);
    expect(tr.omega[i * 3 + 2]).toBeCloseTo(20, 12);
  });
  it('クォータニオンは常に単位長', () => {
    const tr = simulate(kick({ omega: [15, -60, 20] }), defaultParams());
    for (let i = 0; i < tr.count; i++) {
      const n = Math.hypot(tr.quat[i * 4], tr.quat[i * 4 + 1], tr.quat[i * 4 + 2], tr.quat[i * 4 + 3]);
      expect(n).toBeCloseTo(1, 12);
    }
  });
  it('一定の角速度なら、姿勢は 軸まわりに |ω|·t だけ回る', () => {
    const w = [0, 12, 0] as const;
    const tr = simulate(kick({ omega: w }), defaultParams({ spinDecayCoefficient: 0 }));
    const i = tr.count - 1;
    const half = (12 * tr.t[i]) / 2;
    // q と −q は同じ姿勢なので符号をそろえて比べる
    const sign = Math.sign(tr.quat[i * 4 + 3]) === Math.sign(Math.cos(half)) ? 1 : -1;
    expect(sign * tr.quat[i * 4]).toBeCloseTo(0, 8);
    expect(sign * tr.quat[i * 4 + 1]).toBeCloseTo(Math.sin(half), 8);
    expect(sign * tr.quat[i * 4 + 2]).toBeCloseTo(0, 8);
    expect(sign * tr.quat[i * 4 + 3]).toBeCloseTo(Math.cos(half), 8);
  });
});

describe('力ごとの寄与（「なぜ曲がった？」の元データ）', () => {
  it('初速による移動 + 各力の寄与 = 実際の変位', () => {
    const k = kick({ velocity: [26, 9, 1], omega: [4, -45, 15] });
    const tr = simulate(k, defaultParams(), { seed: 11 });
    const T = tr.final.t;
    const c = tr.contributions;
    for (let a = 0; a < 3; a++) {
      const sum =
        k.position[a] + k.velocity[a] * T + c.gravity[a] + c.drag[a] + c.magnus[a] + c.knuckle[a];
      expect(sum).toBeCloseTo(tr.final.position[a], 3);
    }
    expect(c.gravity[1]).toBeCloseTo(-0.5 * G * T * T, 9);
    expect(c.gravity[0]).toBe(0);
    expect(c.magnus[2]).toBeGreaterThan(0.5); // ω_y < 0 → 右
    expect(c.drag[0]).toBeLessThan(0);
  });
});

describe('堅牢性と性能', () => {
  it('速度ゼロ・回転ゼロから始めても NaN にならない（自由落下）', () => {
    const tr = simulate({ position: [0, 5, 0], velocity: [0, 0, 0], omega: [0, 0, 0] }, defaultParams());
    for (let i = 0; i < tr.count * 3; i++) {
      expect(Number.isFinite(tr.pos[i])).toBe(true);
      expect(Number.isFinite(tr.forces.knuckle[i])).toBe(true);
    }
    expect(tr.final.position[1]).toBeLessThanOrEqual(R);
  });
  it('入力を書き換えない', () => {
    const k = kick({ omega: [1, 2, 3] });
    const p = defaultParams();
    const snapshot = JSON.stringify([k, p]);
    simulate(k, p);
    expect(JSON.stringify([k, p])).toBe(snapshot);
  });
  it('maxTime で打ち切る', () => {
    const tr = simulate(kick(), defaultParams(), { maxTime: 0.5 });
    expect(tr.final.t).toBeCloseTo(0.5, 9);
  });
  it('3秒分のシミュレーションが 50ms 以内', () => {
    const k = kick({ velocity: [20, 22, 0], omega: [0, -50, 0] });
    const opts = { maxTime: 3, stopAtGround: false };
    for (let i = 0; i < 5; i++) simulate(k, defaultParams(), opts); // JIT を温める
    const t0 = performance.now();
    const tr = simulate(k, defaultParams(), opts);
    const ms = performance.now() - t0;
    expect(tr.final.t).toBeCloseTo(3, 9);
    // CI の共有マシンは遅いことがあるので、余裕を持たせる（手元では 約 3 ms）
    expect(ms).toBeLessThan(process.env.CI ? 500 : 50);
  });
});
