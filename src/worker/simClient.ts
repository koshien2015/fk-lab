/**
 * 物理計算の Worker を Promise で呼ぶための窓口。
 */
import type { ShotResult, ShotScenario } from '../match/shot.ts';
import type { PhysicsParams } from '../physics/params.ts';
import type { KickState, SimOptions, Trajectory } from '../physics/types.ts';
import type { InverseRequest, InverseSolution } from '../solver/inverse.ts';
import type { SimRequest, SimResponse } from './protocol.ts';

export interface SimClient {
  /** 何にも当たらない飛翔だけを計算する */
  simulate(kick: KickState, params: PhysicsParams, options?: SimOptions): Promise<Trajectory>;
  /** 衝突と判定を含めて 1 本のキックを計算する */
  shot(kick: KickState, params: PhysicsParams, scenario: ShotScenario): Promise<ShotResult>;
  /** 逆算: 狙った点に入る蹴り方を探す */
  solve(request: InverseRequest, params: PhysicsParams): Promise<InverseSolution>;
  /** ネットの形（落ち着いた状態の節点と、糸のつながり） */
  netShape(): Promise<{ rest: Float32Array; springs: Uint16Array }>;
}

interface Pending {
  readonly resolve: (response: SimResponse) => void;
  readonly reject: (error: Error) => void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function createSimClient(): SimClient {
  const worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, Pending>();
  let nextId = 1;

  worker.onmessage = (event: MessageEvent<SimResponse>): void => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.type === 'error') {
      entry.reject(new Error(`シミュレーションに失敗しました: ${response.message}`));
    } else {
      entry.resolve(response);
    }
  };
  worker.onerror = (event): void => {
    const error = new Error(`物理計算の Worker が止まりました: ${event.message}`);
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  const call = (request: DistributiveOmit<SimRequest, 'id'>): Promise<SimResponse> =>
    new Promise<SimResponse>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...request, id });
    });

  return {
    async simulate(kick, params, options = {}) {
      const response = await call({ type: 'simulate', kick, params, options });
      if (response.type !== 'trajectory') throw new Error('Worker から想定外の応答が返りました');
      return response.trajectory;
    },
    async shot(kick, params, scenario) {
      const response = await call({ type: 'shot', kick, params, options: {}, scenario });
      if (response.type !== 'shot') throw new Error('Worker から想定外の応答が返りました');
      return response.result;
    },
    async solve(request, params) {
      const response = await call({ type: 'solve', params, request });
      if (response.type !== 'solved') throw new Error('Worker から想定外の応答が返りました');
      return response.solution;
    },
    async netShape() {
      const response = await call({ type: 'net' });
      if (response.type !== 'net') throw new Error('Worker から想定外の応答が返りました');
      return { rest: response.rest, springs: response.springs };
    },
  };
}
