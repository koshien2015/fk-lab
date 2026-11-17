/**
 * メインスレッドと物理計算の Worker の間でやり取りするメッセージ。
 */
import type { PhysicsParams } from '../physics/params.ts';
import type { KickState, SimOptions, Trajectory } from '../physics/types.ts';

export type SimRequest = {
  readonly id: number;
  readonly type: 'simulate';
  readonly kick: KickState;
  readonly params: PhysicsParams;
  readonly options: SimOptions;
};

export type SimResponse =
  | { readonly id: number; readonly type: 'trajectory'; readonly trajectory: Trajectory }
  | { readonly id: number; readonly type: 'error'; readonly message: string };
