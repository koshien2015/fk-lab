import { describe, expect, it } from 'vitest';
import { FIELD } from '../../src/field/dimensions.ts';
import { createNetSim, getNetModel, NET } from '../../src/match/netCloth.ts';
import { defaultParams } from '../../src/physics/params.ts';

const p = defaultParams();
const model = getNetModel();

/** ボールの状態ベクトル（位置 0-2、速度 3-5、角速度 6-8） */
const ballState = (pos: number[], vel: number[]): Float64Array =>
  Float64Array.of(...pos, ...vel, 0, 0, 0, 0, 0, 0, 1, 0);
const FAR = ballState([-30, 1, 0], [0, 0, 0]);

describe('ネットの網（質点とバネ）', () => {
  it('節点とバネがあり、枠・地面・後ろの梁に結んだ節点は固定されている', () => {
    expect(model.count).toBeGreaterThan(800);
    expect(model.springs.length / 2).toBeGreaterThan(model.count);
    let pinned = 0;
    for (let i = 0; i < model.count; i++) if (model.pinned[i]) pinned++;
    expect(pinned).toBeGreaterThan(100);
    expect(pinned).toBeLessThan(model.count / 2);
  });
  it('たるみがある（バネの自然長が、張ったときの長さより長い）ので、天井は重みで垂れる', () => {
    let lowestRoof = Infinity;
    const top = FIELD.goalHeight + FIELD.postRadius;
    for (let i = 0; i < model.count; i++) {
      const x = model.rest[i * 3], y = model.rest[i * 3 + 1], z = model.rest[i * 3 + 2];
      if (Math.abs(z) < 1 && x > 0.3 && x < 0.6 && y > top - 0.6) lowestRoof = Math.min(lowestRoof, y);
    }
    expect(lowestRoof).toBeLessThan(top - 0.03);
    expect(lowestRoof).toBeGreaterThan(top - 0.6);
  });
  it('何も当たらなければ、ほぼ静止したまま。固定した節点は動かない', () => {
    const sim = createNetSim(model, p);
    // 網の近くにボールを置いて、計算が休まないようにする（網には触れない）
    const parked = ballState([-0.9, 3.3, 0], [0, 0, 0]);
    for (let i = 0; i < 200; i++) sim.step(NET.dt, parked);
    let worst = 0;
    for (let i = 0; i < model.count; i++) {
      const moved = Math.hypot(
        sim.positions[i * 3] - model.rest[i * 3],
        sim.positions[i * 3 + 1] - model.rest[i * 3 + 1],
        sim.positions[i * 3 + 2] - model.rest[i * 3 + 2],
      );
      if (model.pinned[i]) expect(moved).toBe(0);
      worst = Math.max(worst, moved);
    }
    expect(worst).toBeLessThan(0.03);
  });
  it('ゴールへ飛び込んだボールを、網が伸びながら受け止める', () => {
    const sim = createNetSim(model, p);
    const y = ballState([0.3, 1.2, 0.5], [22, 0, 1]);
    let deepest = 0;
    let touched = 0;
    for (let i = 0; i < 350; i++) {
      // ボールは自由に進む（重力は省く）。網との接触だけが速度を変える。
      y[0] += y[3] * NET.dt;
      y[1] += y[4] * NET.dt;
      y[2] += y[5] * NET.dt;
      touched += sim.step(NET.dt, y);
      deepest = Math.max(deepest, y[0]);
    }
    expect(touched).toBeGreaterThan(0);
    // 背面の位置（高さ 1.2 m で奥行き 約 1.5 m）より奥まで押し込むが、突き抜けない
    expect(deepest).toBeGreaterThan(1.5);
    expect(deepest).toBeLessThan(3.2);
    expect(Math.hypot(y[3], y[4], y[5])).toBeLessThan(6);
    expect(Number.isFinite(y[0])).toBe(true);
  });
  it('ボールが当たった所の節点は、ボールの表面より内側に入らない', () => {
    const sim = createNetSim(model, p);
    const y = ballState([0.3, 1.0, -1], [18, 0, 0]);
    for (let i = 0; i < 60; i++) {
      y[0] += y[3] * NET.dt;
      sim.step(NET.dt, y);
    }
    for (let i = 0; i < model.count; i++) {
      const d = Math.hypot(sim.positions[i * 3] - y[0], sim.positions[i * 3 + 1] - y[1], sim.positions[i * 3 + 2] - y[2]);
      expect(d).toBeGreaterThan(p.radius - 1e-3);
    }
  });
  it('ボールが遠く、網が静まっていれば、計算を休む', () => {
    const sim = createNetSim(model, p);
    expect(sim.isAsleep()).toBe(true);
    expect(sim.step(NET.dt, FAR)).toBe(0);
    expect(sim.isAsleep()).toBe(true);
    // ボールが来れば起きる
    sim.step(NET.dt, ballState([0.3, 1, 0], [10, 0, 0]));
    expect(sim.isAsleep()).toBe(false);
  });
  it('同じ条件なら同じ結果', () => {
    const run = (): number[] => {
      const sim = createNetSim(model, p);
      const y = ballState([0.3, 1.5, 2], [20, 1, 2]);
      for (let i = 0; i < 150; i++) {
        y[0] += y[3] * NET.dt;
        sim.step(NET.dt, y);
      }
      return [y[0], y[3], sim.positions[300], sim.positions[901]];
    };
    expect(run()).toEqual(run());
  });
});
