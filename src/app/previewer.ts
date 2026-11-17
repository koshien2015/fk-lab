/**
 * 設定が変わるたびに軌道を計算し直す係。
 * 計算中に次の依頼が来たら、最後の 1 件だけを続けて計算する（古い依頼は捨てる）。
 */
import type { PhysicsParams } from '../physics/params.ts';
import type { Trajectory } from '../physics/types.ts';
import type { SimClient } from '../worker/simClient.ts';
import { toKickState, type KickSetup } from './setup.ts';

export interface Previewer {
  request(setup: KickSetup): void;
}

export function createPreviewer(
  sim: SimClient,
  params: PhysicsParams,
  onResult: (trajectory: Trajectory, setup: KickSetup) => void,
): Previewer {
  let running = false;
  let queued: KickSetup | null = null;

  const run = async (setup: KickSetup): Promise<void> => {
    running = true;
    try {
      // 予測線は、何にも当たらない飛翔をゴールラインまで描く
      const trajectory = await sim.simulate(toKickState(setup, params), params, {
        seed: setup.seed,
        stopAtX: params.radius,
      });
      onResult(trajectory, setup);
    } catch (error) {
      console.error('予測線の計算に失敗しました', error);
    } finally {
      running = false;
      const next = queued;
      queued = null;
      if (next) void run(next);
    }
  };

  return {
    request(setup) {
      if (running) queued = setup;
      else void run(setup);
    },
  };
}
