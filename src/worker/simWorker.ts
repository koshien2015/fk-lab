/// <reference lib="webworker" />
/**
 * 物理計算を担当する Web Worker。メインスレッド（描画）を止めないために分けている。
 */
import { simulateShot } from '../match/shot.ts';
import { simulate } from '../physics/simulate.ts';
import type { Trajectory } from '../physics/types.ts';
import { solveKick } from '../solver/inverse.ts';
import type { SimRequest, SimResponse } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

/** コピーせずに渡せるバッファを集める */
function buffersOf(tr: Trajectory): ArrayBuffer[] {
  const arrays = [tr.t, tr.pos, tr.vel, tr.omega, tr.quat, tr.re, tr.cd, tr.spin, ...Object.values(tr.forces)];
  return arrays.map((array) => array.buffer as ArrayBuffer);
}

function handle(request: SimRequest): { response: SimResponse; transfer: ArrayBuffer[] } {
  if (request.type === 'simulate') {
    const trajectory = simulate(request.kick, request.params, request.options);
    return { response: { id: request.id, type: 'trajectory', trajectory }, transfer: buffersOf(trajectory) };
  }
  if (request.type === 'solve') {
    const solution = solveKick(request.request, request.params);
    const transfer = solution.candidates.map((path) => path.buffer as ArrayBuffer);
    return { response: { id: request.id, type: 'solved', solution }, transfer };
  }
  const result = simulateShot(request.kick, request.params, request.scenario, request.options);
  const transfer = [
    ...buffersOf(result.trajectory),
    result.keeper.z.buffer as ArrayBuffer,
    result.keeper.lean.buffer as ArrayBuffer,
  ];
  return { response: { id: request.id, type: 'shot', result }, transfer };
}

self.onmessage = (event: MessageEvent<SimRequest>): void => {
  const request = event.data;
  try {
    const { response, transfer } = handle(request);
    self.postMessage(response, transfer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const response: SimResponse = { id: request.id, type: 'error', message };
    self.postMessage(response);
  }
};
