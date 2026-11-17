/**
 * ゴールネットを、質点とバネの格子として計算する。
 *
 * - 網はたるんでいる（バネの自然長が、枠に張ったときの長さより長い）。重みで垂れ下がる。
 * - バネは引っぱられたときだけ力を出す（糸は押し返さない）。
 * - ボールとは互いに力を及ぼし合う。ボールが節点や糸を押し、押された網が張ってボールを止める。
 *   運動量のやり取りは、節点の速度をボールに合わせたぶんの反作用をボールに返すことで行う。
 *
 * 糸の硬さ、節点の質量、たるみの量などは仮定値。
 * 毎ステップ全節点を更新するので、配列はその場で書き換える（このモジュールの内側に閉じた状態）。
 */
import { FIELD } from '../field/dimensions.ts';
import type { PhysicsParams } from '../physics/params.ts';
import type { Vec3 } from '../physics/types.ts';

const r = FIELD.postRadius;
const TOP = FIELD.goalHeight + r;
const HALF_WIDTH = FIELD.goalWidth / 2 + r;
const DEPTH_TOP = FIELD.goalDepthTop;
const DEPTH_BOTTOM = FIELD.goalDepthBottom;

/** 格子の点の数（幅・高さ・奥行き）。網目は 約 16 cm。 */
const NZ = 47;
const NY = 17;
const NX = 9;

export const NET = {
  /** たるみ: 自然長 ÷ 枠に張ったときの長さ */
  slack: 1.1,
  /** 糸 1 本のバネ定数 [N/m]。糸はほとんど伸びないので硬くする。 */
  stiffness: 2000,
  /** 糸の伸び縮みの速さに対する減衰 [N·s/m] */
  springDamping: 1.5,
  /** 計算の刻み [s]。ボールの刻み（1 ms）より粗くして、計算を軽くする。 */
  dt: 0.002,
  /**
   * 節点 1 つの質量 [kg]。実物の網より重い（全体で 約 23 kg）。
   * 刻み 2 ms で硬い糸を安定に計算するための値。
   */
  nodeMass: 0.016,
  /** 空気と糸どうしの摩擦による減衰 [1/s] */
  airDamping: 6,
  /**
   * ボールの半径に足す、当たり判定の余白 [m]。
   * 網目（約 16 cm）は実物（約 12 cm）より粗いので、ボールが網目を抜けないよう広めに取る。
   */
  thread: 0.03,
  /** ボールと網の摩擦（接線方向の速度差を 1 回の接触で詰める割合） */
  grip: 0.25,
  /** 網に触れている間、ボールの勢いが網の擦れで失われる速さ [1/s] */
  contactLoss: 12,
} as const;

export interface NetModel {
  readonly count: number;
  /** たるんで落ち着いた状態の節点の位置（x, y, z の並び） */
  readonly rest: Float32Array;
  /** 1 なら固定（枠、地面、後ろの梁に結んである） */
  readonly pinned: Uint8Array;
  /** バネの両端の節点の番号（2 つずつ） */
  readonly springs: Uint16Array;
  readonly restLength: Float32Array;
}

/** 高さ y での、背面の奥行き（張った状態） */
const backX = (y: number): number => DEPTH_BOTTOM + ((DEPTH_TOP - DEPTH_BOTTOM) * y) / TOP;

/** 張った状態の網を、4 枚の格子（背面・天井・両側面）から作る。継ぎ目の節点は共有する。 */
function buildTaut(): { points: number[]; pairs: number[] } {
  const points: number[] = [];
  const pairs: number[] = [];
  const index = new Map<string, number>();
  const node = ([x, y, z]: Vec3): number => {
    const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    const found = index.get(key);
    if (found !== undefined) return found;
    index.set(key, points.length / 3);
    points.push(x, y, z);
    return points.length / 3 - 1;
  };
  const seen = new Set<number>();
  const link = (a: number, b: number): void => {
    const key = a < b ? a * 65536 + b : b * 65536 + a;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    pairs.push(a, b);
  };
  const grid = (columns: number, rows: number, at: (s: number, t: number) => Vec3): void => {
    const ids: number[] = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        ids.push(node(at(column / (columns - 1), row / (rows - 1))));
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const i = row * columns + column;
        if (column + 1 < columns) link(ids[i], ids[i + 1]);
        if (row + 1 < rows) link(ids[i], ids[i + columns]);
      }
    }
  };
  const z = (s: number): number => (2 * s - 1) * HALF_WIDTH;
  grid(NZ, NY, (s, t) => [backX(t * TOP), t * TOP, z(s)]);
  grid(NZ, NX, (s, t) => [t * DEPTH_TOP, TOP, z(s)]);
  for (const side of [-1, 1]) grid(NX, NY, (s, t) => [s * backX(t * TOP), t * TOP, side * HALF_WIDTH]);
  return { points, pairs };
}

function buildModel(): NetModel {
  const { points, pairs } = buildTaut();
  const count = points.length / 3;
  const pinned = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const x = points[i * 3], y = points[i * 3 + 1];
    const onFrame = x < 1e-6;
    const onGround = y < 1e-6;
    const onBackBeam = Math.abs(y - TOP) < 1e-6 && Math.abs(x - DEPTH_TOP) < 1e-6;
    pinned[i] = onFrame || onGround || onBackBeam ? 1 : 0;
  }
  const springs = Uint16Array.from(pairs);
  const restLength = new Float32Array(pairs.length / 2);
  for (let s = 0; s < restLength.length; s++) {
    const a = pairs[s * 2] * 3, b = pairs[s * 2 + 1] * 3;
    restLength[s] = NET.slack * Math.hypot(points[a] - points[b], points[a + 1] - points[b + 1], points[a + 2] - points[b + 2]);
  }
  return { count, rest: Float32Array.from(points), pinned, springs, restLength };
}

export interface NetSim {
  /** いまの節点の位置（x, y, z の並び） */
  readonly positions: Float32Array;
  /**
   * dt だけ進める。ball は状態ベクトル（位置 0-2、速度 3-5、角速度 6-8）で、
   * 網との接触に応じて速度と角速度を書き換える。
   * 戻り値は、このステップでボールが網から受けた力積の大きさ [N·s]。
   * ボールが遠く、網も静まっている間は、計算を休む。
   */
  step(dt: number, ball: Float64Array): number;
  /** 計算を休んでいるか */
  isAsleep(): boolean;
}

export function createNetSim(model: NetModel, params: PhysicsParams): NetSim {
  const { count, pinned, springs, restLength } = model;
  const pos = Float32Array.from(model.rest);
  const vel = new Float32Array(count * 3);
  const force = new Float32Array(count * 3);
  /** ボールの近くにある節点の印（糸との接触を調べる範囲を絞る） */
  const near = new Uint8Array(count);
  const R = params.radius + NET.thread;
  /** 静まっているステップが続いた数。SLEEP_AFTER を超えたら休む。 */
  let quietSteps = 0;
  let asleep = true;
  const massRatio = NET.nodeMass / params.mass;
  const weight = -NET.nodeMass * params.gravity;

  const applySprings = (): void => {
    force.fill(0);
    for (let s = 0; s < restLength.length; s++) {
      const a = springs[s * 2] * 3, b = springs[s * 2 + 1] * 3;
      const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
      // Math.hypot は遅いので、ここ（いちばん回数の多いループ）では使わない
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const stretch = length - restLength[s];
      // 糸は引っぱられたときだけ力を出す
      if (stretch <= 0 || length < 1e-9) continue;
      const nx = dx / length, ny = dy / length, nz = dz / length;
      const closing = (vel[b] - vel[a]) * nx + (vel[b + 1] - vel[a + 1]) * ny + (vel[b + 2] - vel[a + 2]) * nz;
      const tension = Math.max(0, NET.stiffness * stretch + NET.springDamping * closing);
      force[a] += tension * nx;
      force[a + 1] += tension * ny;
      force[a + 2] += tension * nz;
      force[b] -= tension * nx;
      force[b + 1] -= tension * ny;
      force[b + 2] -= tension * nz;
    }
  };

  /**
   * 節点 i を、ボールから見て法線 (nx, ny, nz) の向きへ depth だけ押し出し、
   * ボールへ食い込む向きの速度を消す。そのぶんの反作用をボールに返す。
   */
  const pushNode = (i: number, nx: number, ny: number, nz: number, depth: number, ball: Float64Array): number => {
    if (pinned[i]) return 0;
    const k = i * 3;
    pos[k] += nx * depth;
    pos[k + 1] += ny * depth;
    pos[k + 2] += nz * depth;
    const rx = vel[k] - ball[3], ry = vel[k + 1] - ball[4], rz = vel[k + 2] - ball[5];
    const normal = rx * nx + ry * ny + rz * nz;
    // 法線方向: 食い込む向きの速度差をなくす。接線方向: 摩擦で一部を詰める。
    const fix = normal < 0 ? -normal : 0;
    const tx = rx - normal * nx, ty = ry - normal * ny, tz = rz - normal * nz;
    const dvx = fix * nx - NET.grip * tx;
    const dvy = fix * ny - NET.grip * ty;
    const dvz = fix * nz - NET.grip * tz;
    vel[k] += dvx;
    vel[k + 1] += dvy;
    vel[k + 2] += dvz;
    ball[3] -= massRatio * dvx;
    ball[4] -= massRatio * dvy;
    ball[5] -= massRatio * dvz;
    return NET.nodeMass * Math.hypot(dvx, dvy, dvz);
  };

  /** ボールが網の近く（張った位置から 1 m 以内）にいるか */
  const ballIsClose = (ball: Float64Array): boolean =>
    ball[0] > -1 && ball[0] < DEPTH_BOTTOM + 1.5 && Math.abs(ball[2]) < HALF_WIDTH + 1 && ball[1] < TOP + 1;

  /** ボールと節点・糸の接触 */
  const collide = (ball: Float64Array): number => {
    const cx = ball[0], cy = ball[1], cz = ball[2];
    const reach = R + 0.35;
    let impulse = 0;
    let anyNear = false;
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      const dx = pos[k] - cx, dy = pos[k + 1] - cy, dz = pos[k + 2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      near[i] = d2 < reach * reach ? 1 : 0;
      if (!near[i]) continue;
      anyNear = true;
      if (d2 >= R * R || d2 < 1e-12) continue;
      const d = Math.sqrt(d2);
      impulse += pushNode(i, dx / d, dy / d, dz / d, R - d, ball);
    }
    if (!anyNear) return 0;
    // 節点の間をすり抜けないよう、糸（節点どうしを結ぶ線分）との接触も見る
    for (let s = 0; s < restLength.length; s++) {
      const i = springs[s * 2], j = springs[s * 2 + 1];
      if (!near[i] || !near[j]) continue;
      const a = i * 3, b = j * 3;
      const ex = pos[b] - pos[a], ey = pos[b + 1] - pos[a + 1], ez = pos[b + 2] - pos[a + 2];
      const e2 = ex * ex + ey * ey + ez * ez;
      if (e2 < 1e-12) continue;
      const t = Math.min(1, Math.max(0, ((cx - pos[a]) * ex + (cy - pos[a + 1]) * ey + (cz - pos[a + 2]) * ez) / e2));
      const dx = pos[a] + ex * t - cx, dy = pos[a + 1] + ey * t - cy, dz = pos[a + 2] + ez * t - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R * R || d2 < 1e-12) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d, nz = dz / d;
      impulse += pushNode(i, nx, ny, nz, (R - d) * (1 - t), ball);
      impulse += pushNode(j, nx, ny, nz, (R - d) * t, ball);
    }
    return impulse;
  };

  return {
    positions: pos,
    isAsleep: () => asleep,
    step(dt, ball) {
      const close = ballIsClose(ball);
      if (asleep && !close) return 0;
      asleep = false;
      applySprings();
      const keep = Math.exp(-NET.airDamping * dt);
      const scale = dt / NET.nodeMass;
      let fastest = 0;
      for (let i = 0; i < count; i++) {
        if (pinned[i]) continue;
        const k = i * 3;
        vel[k] = (vel[k] + force[k] * scale) * keep;
        vel[k + 1] = (vel[k + 1] + (force[k + 1] + weight) * scale) * keep;
        vel[k + 2] = (vel[k + 2] + force[k + 2] * scale) * keep;
        fastest = Math.max(fastest, Math.abs(vel[k]), Math.abs(vel[k + 1]), Math.abs(vel[k + 2]));
        pos[k] += vel[k] * dt;
        pos[k + 1] = Math.max(0, pos[k + 1] + vel[k + 1] * dt);
        pos[k + 2] += vel[k + 2] * dt;
      }
      const impulse = close ? collide(ball) : 0;
      quietSteps = !close && fastest < SLEEP_SPEED ? quietSteps + 1 : 0;
      if (quietSteps > SLEEP_AFTER) asleep = true;
      if (impulse > 0) {
        // 糸どうしの擦れなど、バネでは表せない損失
        const lose = Math.exp(-NET.contactLoss * dt);
        for (let a = 3; a < 9; a++) ball[a] *= lose;
      }
      return impulse;
    },
  };
}

/** 節点の速さがこれより小さいステップが SLEEP_AFTER 回続いたら、計算を休む */
const SLEEP_SPEED = 0.03;
const SLEEP_AFTER = 40;
/** 落ち着くまで計算する時間 [s] */
const SETTLE_TIME = 4;
let cached: NetModel | null = null;

/** たるんで落ち着いた状態の網。最初に呼ばれたときに作り、あとは使い回す。 */
export function getNetModel(): NetModel {
  if (cached) return cached;
  const taut = buildModel();
  // ボールのない状態でしばらく進めて、重みで垂れた形にする（質量と重力だけを使う）
  const sim = createNetSim(taut, { mass: 0.43, radius: 0.11, gravity: 9.81 } as PhysicsParams);
  // 網の近くに「ボール」を置いて計算を起こしておく（速度ゼロで、網には触れない高さ）
  const parked = Float64Array.of(-0.9, TOP + 0.9, 0, 0, 0, 0, 0, 0, 0);
  for (let i = 0; i < SETTLE_TIME / NET.dt; i++) sim.step(NET.dt, parked);
  cached = { ...taut, rest: Float32Array.from(sim.positions) };
  return cached;
}
