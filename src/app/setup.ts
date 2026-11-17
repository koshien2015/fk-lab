/**
 * 蹴り方の設定（ユーザーが決めるもの）と、お手本の設定。
 */
import { aimAzimuthDeg, type Spot } from '../field/placement.ts';
import { kickToState, type KickInput } from '../physics/kick.ts';
import type { PhysicsParams } from '../physics/params.ts';
import type { KickState } from '../physics/types.ts';

export interface KickSetup {
  /** ボールを置く位置 */
  readonly spot: Spot;
  /** 接触点（ボール正面の円の中でのずれ。右と上が正） */
  readonly contact: readonly [number, number];
  /** 左右の狙い [度]。ゴール中央への向きが 0、右が正。 */
  readonly aimDeg: number;
  readonly elevationDeg: number;
  /** 強さ 0〜1 */
  readonly power: number;
  /** ナックルの揺れ方を決めるシード */
  readonly seed: number;
}

export const SETUP_LIMITS = {
  aimDeg: { min: -25, max: 25, step: 0.5 },
  elevationDeg: { min: 0, max: 40, step: 0.5 },
  power: { min: 0.3, max: 1, step: 0.01 },
} as const;

export function toKickInput(setup: KickSetup): KickInput {
  return {
    contact: setup.contact,
    azimuthDeg: aimAzimuthDeg(setup.spot) + setup.aimDeg,
    elevationDeg: setup.elevationDeg,
    power: setup.power,
  };
}

export function toKickState(setup: KickSetup, params: PhysicsParams): KickState {
  return kickToState(toKickInput(setup), [setup.spot.x, params.radius, setup.spot.z], params);
}

export interface SetupPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly patch: Pick<KickSetup, 'contact' | 'aimDeg' | 'elevationDeg' | 'power'>;
}

/** お手本の蹴り方。数値は「それらしい球」になるよう選んだもの。 */
export const SETUP_PRESETS: readonly SetupPreset[] = [
  {
    id: 'curve',
    label: 'カーブ',
    description: 'ボールの左下をこすって、右へ巻く',
    patch: { contact: [-0.42, -0.1], aimDeg: -5, elevationDeg: 14.5, power: 0.78 },
  },
  {
    id: 'knuckle',
    label: 'ナックル',
    description: '中心を押し出す。無回転で揺れる',
    patch: { contact: [0, 0], aimDeg: 0, elevationDeg: 13, power: 0.83 },
  },
  {
    id: 'drive',
    label: 'ドライブ',
    description: '上をこすって縦回転。壁を越えて落ちる',
    patch: { contact: [0, 0.3], aimDeg: 0, elevationDeg: 22, power: 0.86 },
  },
];

export const DEFAULT_SETUP: KickSetup = {
  spot: { x: -25, z: 0 },
  ...SETUP_PRESETS[0].patch,
  seed: 1,
};
