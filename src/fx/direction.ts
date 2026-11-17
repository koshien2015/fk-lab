/**
 * 演出のきっかけを決める計算（再生がどの出来事をまたいだか、いつスローにするか）。
 */
import type { ShotEvent } from '../match/shot.ts';

/** これより大きく時刻が飛んだら、スクラブとみなして出来事を拾わない [s] */
const MAX_STEP = 0.25;

/** 再生が previous から now へ進む間にまたいだ出来事 */
export function crossedEvents(
  events: readonly ShotEvent[],
  previous: number,
  now: number,
): readonly ShotEvent[] {
  if (now <= previous || now - previous > MAX_STEP) return [];
  return events.filter((event) => event.t > previous && event.t <= now);
}

/** ゴールの瞬間の前後を、自動でスローにする */
export const SLOW_MOTION = {
  /** ゴールの何秒前から [s] */
  before: 0.22,
  /** ゴールの何秒後まで [s] */
  after: 0.45,
  /** 再生の速さに掛ける倍率 */
  factor: 0.22,
} as const;

/** 時刻 time での、再生の速さに掛ける倍率 */
export function slowFactor(events: readonly ShotEvent[], time: number): number {
  const goal = events.find((event) => event.kind === 'goal');
  if (!goal) return 1;
  const inWindow = time >= goal.t - SLOW_MOTION.before && time <= goal.t + SLOW_MOTION.after;
  return inWindow ? SLOW_MOTION.factor : 1;
}
