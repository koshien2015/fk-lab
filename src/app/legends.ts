/**
 * 伝説の FK の再現プリセット。
 *
 * パラメータはすべて推定値。映像や記録から数値を取ったものではなく、
 * 「それらしい位置から、それらしい球筋でゴールに入る」ように逆算モードで求めた。
 * 実在の選手の肖像や公式の素材は使わず、選手名と場面の説明だけにとどめる。
 */
import type { KickSetup } from './setup.ts';

export interface Legend {
  readonly id: string;
  readonly label: string;
  /** 場面の説明 */
  readonly scene: string;
  readonly setup: KickSetup;
}

export const LEGENDS: readonly Legend[] = [
  {
    id: 'outside-1997',
    label: 'R・カルロス 1997',
    scene:
      'ロベルト・カルロス、1997 年のフランス戦。約 35 m から左足のアウトサイドで蹴り、壁の外を通った球が大きく曲がって入った',
    setup: {
      spot: { x: -35, z: 2 },
      contact: [0.251, -0.1],
      aimDeg: 16.375,
      elevationDeg: 7.696,
      power: 1,
      seed: 2,
      wall: { count: 4, offset: 0, jump: false, jumpDelay: 0.15 },
      keeper: 'hard',
    },
  },
  {
    id: 'knuckle-2010',
    label: '本田圭佑 2010',
    scene: '本田圭佑、2010 年 W 杯のデンマーク戦。約 30 m からの無回転の球が、揺れながら入った',
    setup: {
      spot: { x: -29, z: 6 },
      contact: [0, 0],
      aimDeg: -5.959,
      elevationDeg: 12.857,
      power: 1,
      seed: 3,
      wall: { count: 4, offset: 0, jump: true, jumpDelay: 0.2 },
      keeper: 'hard',
    },
  },
];
