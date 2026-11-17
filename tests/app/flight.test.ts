import { describe, expect, it } from 'vitest';
import { advance, seek, setRate, startFlight, togglePlay, type Flight } from '../../src/app/flight.ts';

const flight = (over: Partial<Flight> = {}): Flight => ({
  ...startFlight({ duration: 2, payload: 'x' }, 1),
  ...over,
});

describe('再生の状態', () => {
  it('始めは時刻 0 で再生中', () => {
    expect(flight()).toMatchObject({ time: 0, playing: true, rate: 1, duration: 2 });
  });
  it('再生中は、経過時間 × 速さ だけ進む', () => {
    expect(advance(flight({ rate: 0.25 }), 0.4).time).toBeCloseTo(0.1, 12);
  });
  it('終わりに着いたら止まる', () => {
    const end = advance(flight({ time: 1.95 }), 0.2);
    expect(end.time).toBe(2);
    expect(end.playing).toBe(false);
  });
  it('一時停止中は進まない', () => {
    expect(advance(flight({ time: 0.5, playing: false }), 0.2).time).toBe(0.5);
  });
  it('スクラブすると、その時刻で一時停止する（範囲の外は丸める）', () => {
    expect(seek(flight(), 1.2)).toMatchObject({ time: 1.2, playing: false });
    expect(seek(flight(), 9).time).toBe(2);
    expect(seek(flight(), -1).time).toBe(0);
  });
  it('再生と一時停止を切り替える。終わりで押すと最初から再生する', () => {
    expect(togglePlay(flight({ time: 0.5 })).playing).toBe(false);
    expect(togglePlay(flight({ time: 0.5, playing: false }))).toMatchObject({ time: 0.5, playing: true });
    expect(togglePlay(flight({ time: 2, playing: false }))).toMatchObject({ time: 0, playing: true });
  });
  it('速さを変えても時刻は変わらない。元の状態は書き換えない', () => {
    const before = flight({ time: 0.7 });
    const after = setRate(before, 0.1);
    expect(after).toMatchObject({ time: 0.7, rate: 0.1 });
    expect(before.rate).toBe(1);
  });
});
