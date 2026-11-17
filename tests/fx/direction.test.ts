import { describe, expect, it } from 'vitest';
import { crossedEvents, slowFactor, SLOW_MOTION } from '../../src/fx/direction.ts';
import type { ShotEvent } from '../../src/match/shot.ts';

const event = (kind: ShotEvent['kind'], t: number): ShotEvent => ({ t, kind, position: [0, 0, 0], speed: 10 });
const events = [event('ground', 0.5), event('post', 1.0), event('goal', 1.1), event('net', 1.2)];

describe('crossedEvents（再生がまたいだ出来事）', () => {
  it('前の時刻より後、いまの時刻以前の出来事を返す', () => {
    expect(crossedEvents(events, 0.95, 1.15).map((e) => e.kind)).toEqual(['post', 'goal']);
    expect(crossedEvents(events, 0.45, 0.55).map((e) => e.kind)).toEqual(['ground']);
    expect(crossedEvents(events, 1.0, 1.1).map((e) => e.kind)).toEqual(['goal']);
  });
  it('巻き戻したとき・大きく飛んだときは何も返さない（音を鳴らし直さない）', () => {
    expect(crossedEvents(events, 1.5, 0.2)).toEqual([]);
    expect(crossedEvents(events, 0, 3)).toEqual([]);
  });
});

describe('slowFactor（ゴール前後の自動スロー）', () => {
  it('ゴールの直前から直後までは遅くなる', () => {
    expect(slowFactor(events, 1.1)).toBe(SLOW_MOTION.factor);
    expect(slowFactor(events, 1.1 - SLOW_MOTION.before + 0.01)).toBe(SLOW_MOTION.factor);
    expect(slowFactor(events, 1.1 + SLOW_MOTION.after - 0.01)).toBe(SLOW_MOTION.factor);
  });
  it('それ以外は等速', () => {
    expect(slowFactor(events, 0.3)).toBe(1);
    expect(slowFactor(events, 1.1 + SLOW_MOTION.after + 0.1)).toBe(1);
  });
  it('ゴールでなければ遅くしない', () => {
    expect(slowFactor([event('keeper', 1.0)], 1.0)).toBe(1);
  });
});
