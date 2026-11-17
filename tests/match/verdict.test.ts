import { describe, expect, it } from 'vitest';
import type { ShotEvent, ShotOutcome } from '../../src/match/shot.ts';
import { OUTCOME_LABELS, verdictTime } from '../../src/match/verdict.ts';

const event = (kind: ShotEvent['kind'], t: number): ShotEvent => ({ t, kind, position: [0, 0, 0], speed: 10 });
const shot = (outcome: ShotOutcome, events: ShotEvent[]) => ({ outcome, events, trajectory: { final: { t: 5 } } });

describe('判定を表示する時刻', () => {
  it('ゴールは、ゴールラインを越えた瞬間', () => {
    expect(verdictTime(shot('goal', [event('post', 0.9), event('goal', 1.0), event('net', 1.1)]))).toBe(1.0);
  });
  it('セーブ・ポスト・壁は、当たった少しあと', () => {
    expect(verdictTime(shot('save', [event('ground', 0.5), event('keeper', 1.0)]))).toBeCloseTo(1.3, 9);
    expect(verdictTime(shot('post', [event('post', 1.0), event('ground', 1.4)]))).toBeCloseTo(1.3, 9);
    expect(verdictTime(shot('wall', [event('wall', 0.4)]))).toBeCloseTo(0.7, 9);
  });
  it('枠外は、外へ出た瞬間', () => {
    expect(verdictTime(shot('out', [event('out', 1.2)]))).toBe(1.2);
  });
  it('決め手になる出来事がなければ、再生の終わり', () => {
    expect(verdictTime(shot('save', [event('ground', 0.5)]))).toBe(5);
  });
  it('すべての判定に表示名がある', () => {
    for (const outcome of ['goal', 'save', 'post', 'out', 'wall'] as const) {
      expect(OUTCOME_LABELS[outcome].length).toBeGreaterThan(0);
    }
  });
});
