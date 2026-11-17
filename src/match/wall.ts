/**
 * 壁（守備側の選手の並び）。
 */
import { FIELD } from '../field/dimensions.ts';
import type { Spot } from '../field/placement.ts';
import type { Capsule } from './geometry.ts';

export interface WallSetup {
  /** 人数 0〜5 */
  readonly count: number;
  /** 自動配置からの横ずれ [m]（ゴール中央の側が正） */
  readonly offset: number;
  readonly jump: boolean;
  /** キックからジャンプまでの遅れ [s] */
  readonly jumpDelay: number;
}

export const WALL = {
  /** ボールから壁までの距離（規則） */
  distance: FIELD.circleRadius,
  /** 選手の間隔（肩を寄せて並ぶ） */
  spacing: 0.55,
  /** 体の半径と身長（仮定） */
  radius: 0.22,
  height: 1.8,
  /** ジャンプの初速 [m/s]（最高点 約 0.4 m。仮定） */
  jumpSpeed: 2.8,
  /** いちばん外側の選手を、ニアポストへの直線より外へ出す量 [m] */
  overlap: 0.35,
  /** ゴールラインからこれより近くには立たない [m] */
  minDistanceFromGoalLine: 1.5,
  maxCount: 5,
} as const;

const GRAVITY = 9.81;

export interface WallPlayer {
  readonly x: number;
  readonly z: number;
}

/**
 * 壁の選手の立ち位置。ボールに近いほうのポスト（ニアポスト）への直線を塞ぎ、
 * そこからゴール中央の側へ並ぶ。
 */
export function wallPlayers(spot: Spot, setup: WallSetup): WallPlayer[] {
  const count = Math.min(WALL.maxCount, Math.max(0, Math.round(setup.count)));
  const side = spot.z > 0 ? 1 : -1;
  const postZ = side * (FIELD.goalWidth / 2);
  const toPost = Math.hypot(-spot.x, postZ - spot.z);
  const dx = -spot.x / toPost;
  const dz = (postZ - spot.z) / toPost;
  // 並ぶ向き: ニアポストへの直線に垂直で、ゴール中央の側へ向かう
  const flip = -dx * side > 0 ? 1 : -1;
  const tx = -dz * flip;
  const tz = dx * flip;
  const distance = Math.min(WALL.distance, toPost - WALL.minDistanceFromGoalLine);

  return Array.from({ length: count }, (_, i) => {
    const lateral = -WALL.overlap + i * WALL.spacing + setup.offset;
    return { x: spot.x + dx * distance + tx * lateral, z: spot.z + dz * distance + tz * lateral };
  });
}

/** キックから t 秒後の、壁のジャンプの高さ [m] */
export function jumpHeight(t: number, setup: WallSetup): number {
  if (!setup.jump) return 0;
  const tau = t - setup.jumpDelay;
  if (tau <= 0) return 0;
  return Math.max(0, WALL.jumpSpeed * tau - 0.5 * GRAVITY * tau * tau);
}

/** 高さ lift だけ跳んでいる選手の当たり判定 */
export function wallCapsule(player: WallPlayer, lift: number): Capsule {
  return {
    a: [player.x, WALL.radius + lift, player.z],
    b: [player.x, WALL.height - WALL.radius + lift, player.z],
    radius: WALL.radius,
  };
}
