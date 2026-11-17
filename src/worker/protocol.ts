/**
 * メインスレッドと物理計算の Worker の間でやり取りするメッセージ。
 */
import type { ShotResult, ShotScenario } from '../match/shot.ts';
import type { PhysicsParams } from '../physics/params.ts';
import type { KickState, SimOptions, Trajectory } from '../physics/types.ts';

interface Base {
  readonly id: number;
  readonly kick: KickState;
  readonly params: PhysicsParams;
  readonly options: SimOptions;
}

export type SimRequest =
  /** 何にも当たらない飛翔だけ（予測線） */
  | (Base & { readonly type: 'simulate' })
  /** 衝突と判定を含む 1 本のキック */
  | (Base & { readonly type: 'shot'; readonly scenario: ShotScenario });

export type SimResponse =
  | { readonly id: number; readonly type: 'trajectory'; readonly trajectory: Trajectory }
  | { readonly id: number; readonly type: 'shot'; readonly result: ShotResult }
  | { readonly id: number; readonly type: 'error'; readonly message: string };
