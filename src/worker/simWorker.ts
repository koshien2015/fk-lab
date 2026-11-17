/// <reference lib="webworker" />
/**
 * 物理計算を担当する Web Worker。メインスレッド（描画）を止めないために分けている。
 */
import { simulate } from '../physics/simulate.ts';
import type { Trajectory } from '../physics/types.ts';
import type { SimRequest, SimResponse } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

/** コピーせずに渡せるバッファを集める */
function buffersOf(tr: Trajectory): ArrayBuffer[] {
  const arrays = [tr.t, tr.pos, tr.vel, tr.omega, tr.quat, tr.re, tr.cd, tr.spin, ...Object.values(tr.forces)];
  return arrays.map((array) => array.buffer as ArrayBuffer);
}

self.onmessage = (event: MessageEvent<SimRequest>): void => {
  const request = event.data;
  try {
    const trajectory = simulate(request.kick, request.params, request.options);
    const response: SimResponse = { id: request.id, type: 'trajectory', trajectory };
    self.postMessage(response, buffersOf(trajectory));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const response: SimResponse = { id: request.id, type: 'error', message };
    self.postMessage(response);
  }
};
