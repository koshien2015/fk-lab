/**
 * 判定の表示名と、再生中のどの時刻に表示するか。
 */
import type { ShotEventKind, ShotOutcome, ShotResult } from './shot.ts';

export const OUTCOME_LABELS: Readonly<Record<ShotOutcome, string>> = {
  goal: 'GOAL',
  save: 'セーブ',
  post: 'ポスト',
  out: '枠外',
  wall: '壁',
};

/** 判定の決め手になる出来事と、そこから表示までの間 [s] */
const DECIDING: Readonly<Record<ShotOutcome, { readonly kind: ShotEventKind; readonly delay: number }>> = {
  goal: { kind: 'goal', delay: 0 },
  save: { kind: 'keeper', delay: 0.3 },
  post: { kind: 'post', delay: 0.3 },
  out: { kind: 'out', delay: 0 },
  wall: { kind: 'wall', delay: 0.3 },
};

type Judged = Pick<ShotResult, 'outcome' | 'events'> & {
  readonly trajectory: { readonly final: { readonly t: number } };
};

export function verdictTime(result: Judged): number {
  const { kind, delay } = DECIDING[result.outcome];
  const decisive = result.events.find((event) => event.kind === kind);
  return decisive ? decisive.t + delay : result.trajectory.final.t;
}
