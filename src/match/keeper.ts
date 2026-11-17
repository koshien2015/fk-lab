/**
 * ゴールキーパー（一定のプログラム）。
 *
 * 1. キックの瞬間から、反応時間が経つまでは動かない。
 * 2. 反応したら、ボールの現在の位置と速度から「このまま等速直線で飛ぶ」と仮定して、
 *    自分の立つ線への到達点を予測する（予測には誤差を加える）。
 * 3. 予測点へ横に動き、遠ければ体を倒して飛びつく。予測は一定の間隔で更新する。
 *
 * ボールが遠いうちは予測を少しだけ信じて寄り、近づくほど大きく動く（早く決めつけない）。
 * 飛びつくのは、到達までの時間が短くなってから。いったん飛んだら、狙いは変えられない。
 * 飛んだあとに曲がる・揺れるぶんには対応できない。
 *
 * 予測が等速直線なので、大きく曲がる球や揺れる球ほど逆を突かれる。
 * 数値はどれも仮定値。
 */
import { FIELD } from '../field/dimensions.ts';
import type { Spot } from '../field/placement.ts';
import { createRng } from '../physics/rng.ts';
import type { Capsule } from './geometry.ts';

export type KeeperLevel = 'easy' | 'normal' | 'hard';

export interface KeeperConfig {
  /** 反応時間 [s] */
  readonly reactionTime: number;
  /** 横移動の最大速度 [m/s] と加速度 [m/s²] */
  readonly maxSpeed: number;
  readonly acceleration: number;
  /** 体を倒す速さ [rad/s] */
  readonly leanRate: number;
  /** 予測の誤差の大きさ [m]（ボールが遠いときの標準偏差。近づくと NEAR_DOUBT 倍まで減る） */
  readonly predictionNoise: number;
}

/** 体の動き（横移動と倒れ込みの速さ）は、難易度によらず共通 */
const BODY = { maxSpeed: 2.6, acceleration: 11, leanRate: 4.2 };

/** 難易度は、反応時間と予測の誤差の大きさで変える */
export const KEEPER_LEVELS: Readonly<Record<KeeperLevel, KeeperConfig>> = {
  easy: { ...BODY, reactionTime: 0.35, predictionNoise: 0.9 },
  normal: { ...BODY, reactionTime: 0.27, predictionNoise: 0.45 },
  hard: { ...BODY, reactionTime: 0.2, predictionNoise: 0.15 },
};

export const KEEPER = {
  /** 立つ線の x（ゴールラインの少し前） */
  lineX: -0.6,
  /** 腕を伸ばしたときの、足先から指先までの長さ [m] */
  reach: 2.35,
  bodyRadius: 0.28,
  /** 予測を更新する間隔 [s] */
  updateInterval: 0.1,
  /** 壁があるとき、壁に任せた側と逆へ寄る量 [m]（ポジショニングの癖） */
  positioningBias: 0.5,
  /** 予測点がこれより近ければ、倒れずに立ったまま寄る [m] */
  standRange: 0.45,
  maxLean: 1.45,
  /** 到達までの時間がこれより短くなったら、飛びつく [s] */
  diveWindow: 0.32,
  /** 予測をどれだけ信じて動くか。到達まで farTime 秒以上なら farTrust、nearTime 秒以下なら 1。 */
  farTime: 1.0,
  nearTime: 0.3,
  farTrust: 0.3,
  /** ボールが目の前まで来ても残る、読み違いの割合 */
  nearDoubt: 0.35,
} as const;

/** GK の姿勢。z は足の位置、lean は体の倒れ角 [rad]（+z の側へ倒れると正） */
export interface KeeperPose {
  readonly z: number;
  readonly lean: number;
}

/** キック前の立ち位置 */
export function keeperStartZ(spot: Spot, hasWall: boolean): number {
  // ボールとゴール中央を結ぶ線の上
  const onLine = spot.z * (KEEPER.lineX / spot.x);
  if (!hasWall) return onLine;
  // 壁はニアポスト側を塞ぐので、GK は逆の側へ寄る
  const nearSide = spot.z > 0 ? 1 : -1;
  return onLine - nearSide * KEEPER.positioningBias;
}

export function keeperCapsule(pose: KeeperPose): Capsule {
  const r = KEEPER.bodyRadius;
  const span = KEEPER.reach - 2 * r;
  return {
    a: [KEEPER.lineX, r, pose.z],
    b: [KEEPER.lineX, r + span * Math.cos(pose.lean), pose.z + span * Math.sin(pose.lean)],
    radius: r,
  };
}

export interface Keeper {
  pose(): KeeperPose;
  /** ボールの状態 y を見て、dt だけ動く */
  step(time: number, y: Float64Array, dt: number): void;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** 標準正規分布の乱数（ボックス＝ミュラー法） */
function gaussian(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

interface Prediction {
  readonly z: number;
  readonly y: number;
  /** 到達までの時間 [s] */
  readonly arrival: number;
}

/** 予測をどれだけ信じて動くか（0〜1） */
function trust(arrival: number): number {
  const k = (KEEPER.farTime - arrival) / (KEEPER.farTime - KEEPER.nearTime);
  return KEEPER.farTrust + (1 - KEEPER.farTrust) * clamp(k, 0, 1);
}

export function createKeeper(config: KeeperConfig, startZ: number, seed: number): Keeper {
  const rng = createRng(seed ^ 0x9e3779b9);
  // 読み違いの向きと大きさは、1 本のキックの間は変わらない
  const errorZ = gaussian(rng) * config.predictionNoise;
  const errorY = gaussian(rng) * config.predictionNoise;
  const limitZ = FIELD.goalWidth / 2 + 0.6;
  let z = startZ;
  let lean = 0;
  let speed = 0;
  let prediction: Prediction | null = null;
  let nextUpdate = config.reactionTime;
  /** 飛びついたら true。それ以降は予測を更新しない。 */
  let committed = false;

  /** 等速直線運動を仮定した、立つ線への到達点 */
  const predict = (y: Float64Array): Prediction => {
    const arrival = (KEEPER.lineX - y[0]) / y[3];
    const doubt = KEEPER.nearDoubt + (1 - KEEPER.nearDoubt) * Math.min(1, arrival / 0.8);
    return {
      z: clamp(y[2] + y[5] * arrival + errorZ * doubt, -limitZ, limitZ),
      y: clamp(y[1] + y[4] * arrival + errorY * doubt, 0.3, 2.6),
      arrival,
    };
  };

  return {
    pose: () => ({ z, lean }),
    step(time, y, dt) {
      if (time < config.reactionTime) return;
      // ボールが自分の線を過ぎたか、跳ね返って離れていくなら、その場で止まる
      const incoming = y[3] > 1 && y[0] < KEEPER.lineX;
      if (!incoming) {
        speed = 0;
        return;
      }
      if (!committed && time >= nextUpdate) {
        prediction = predict(y);
        nextUpdate += KEEPER.updateInterval;
      }
      if (!prediction) return;

      // 横移動: 行き過ぎないよう、止まれる速さまでしか出さない
      const goal = startZ + (prediction.z - startZ) * trust(prediction.arrival);
      const gap = goal - z;
      const cruise = Math.min(config.maxSpeed, Math.sqrt(2 * config.acceleration * Math.abs(gap)));
      const wanted = Math.sign(gap) * cruise;
      speed += clamp(wanted - speed, -config.acceleration * dt, config.acceleration * dt);
      z += speed * dt;

      // 飛びつき: 到達が近く、立ったままでは届かないときだけ体を倒す
      const reachGap = prediction.z - z;
      if (prediction.arrival <= KEEPER.diveWindow && Math.abs(reachGap) > KEEPER.standRange) {
        committed = true;
      }
      const leanTarget = committed
        ? clamp(Math.atan2(reachGap, prediction.y), -KEEPER.maxLean, KEEPER.maxLean)
        : 0;
      lean += clamp(leanTarget - lean, -config.leanRate * dt, config.leanRate * dt);
    },
  };
}
