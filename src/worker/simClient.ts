/**
 * 物理計算の Worker を Promise で呼ぶための窓口。
 */
import type { PhysicsParams } from '../physics/params.ts';
import type { KickState, SimOptions, Trajectory } from '../physics/types.ts';
import type { SimRequest, SimResponse } from './protocol.ts';

export interface SimClient {
  simulate(kick: KickState, params: PhysicsParams, options?: SimOptions): Promise<Trajectory>;
}

interface Pending {
  readonly resolve: (trajectory: Trajectory) => void;
  readonly reject: (error: Error) => void;
}

export function createSimClient(): SimClient {
  const worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, Pending>();
  let nextId = 1;

  worker.onmessage = (event: MessageEvent<SimResponse>): void => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.type === 'trajectory') entry.resolve(response.trajectory);
    else entry.reject(new Error(`シミュレーションに失敗しました: ${response.message}`));
  };
  worker.onerror = (event): void => {
    const error = new Error(`物理計算の Worker が止まりました: ${event.message}`);
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  return {
    simulate(kick, params, options = {}) {
      return new Promise<Trajectory>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        const request: SimRequest = { id, type: 'simulate', kick, params, options };
        worker.postMessage(request);
      });
    },
  };
}
