/**
 * 物理コアを確かめるための代表的な蹴り方。
 * 初速と回転を直接与えている（接触点から求めるキックモデルはマイルストーン 3 で入れる）。
 * 数値はどれも「それらしい球」になるよう選んだ仮定値。
 */
import type { KickState } from './types.ts';

export interface DemoKick {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly kick: KickState;
}

const RPS = 2 * Math.PI;
const BALL_RADIUS = 0.11;

/** 速さ [m/s]、仰角と方位角 [度]（方位角は右が正）から初速ベクトルを作る */
function launch(speed: number, elevationDeg: number, azimuthDeg: number): KickState['velocity'] {
  const el = (elevationDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return [
    speed * Math.cos(el) * Math.cos(az),
    speed * Math.sin(el),
    speed * Math.cos(el) * Math.sin(az),
  ];
}

export const DEMO_KICKS: readonly DemoKick[] = [
  {
    id: 'curve',
    label: 'カーブ',
    description: '左へ打ち出し、8 rps の横回転で右へ巻く',
    kick: {
      position: [0, BALL_RADIUS, 0],
      velocity: launch(27, 16, -9),
      omega: [0, -8 * RPS, 1.5 * RPS],
    },
  },
  {
    id: 'knuckle',
    label: 'ナックル（無回転）',
    description: '回転ほぼゼロ。渦の剥離による横力で揺れる',
    kick: {
      position: [0, BALL_RADIUS, 0],
      velocity: launch(29, 13, 0),
      omega: [0, 0, 0.15 * RPS],
    },
  },
  {
    id: 'drive',
    label: 'ドライブ（縦回転）',
    description: '7 rps のトップスピンで急に落ちる',
    kick: {
      position: [0, BALL_RADIUS, 0],
      velocity: launch(28, 19, 0),
      omega: [0, 0, -7 * RPS],
    },
  },
  {
    id: 'straight',
    label: '比較用（回転なし・ナックルなし相当）',
    description: 'ナックルと同じ打ち出し。力の内訳を比べる基準',
    kick: {
      position: [0, BALL_RADIUS, 0],
      velocity: launch(29, 13, 0),
      omega: [0, 0, 0],
    },
  },
];
