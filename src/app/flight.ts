/**
 * 再生の状態（いまの時刻、再生中かどうか、速さ）。状態は書き換えず、新しい値を返す。
 */
export interface Flight<T = unknown> {
  /** 再生しているもの（キックの結果など） */
  readonly payload: T;
  readonly duration: number;
  readonly time: number;
  readonly playing: boolean;
  /** 再生の速さ（1 が実時間、0.1 が 10 分の 1 のスロー） */
  readonly rate: number;
}

export function startFlight<T>(source: { duration: number; payload: T }, rate: number): Flight<T> {
  return { payload: source.payload, duration: source.duration, time: 0, playing: true, rate };
}

/** 実時間で dt 秒ぶん進める。終わりに着いたら止まる。 */
export function advance<T>(flight: Flight<T>, dt: number): Flight<T> {
  if (!flight.playing) return flight;
  const time = Math.min(flight.duration, flight.time + dt * flight.rate);
  return { ...flight, time, playing: time < flight.duration };
}

/** 指定の時刻へ移って一時停止する */
export function seek<T>(flight: Flight<T>, time: number): Flight<T> {
  return { ...flight, time: Math.min(flight.duration, Math.max(0, time)), playing: false };
}

export function togglePlay<T>(flight: Flight<T>): Flight<T> {
  if (flight.playing) return { ...flight, playing: false };
  const atEnd = flight.time >= flight.duration;
  return { ...flight, time: atEnd ? 0 : flight.time, playing: true };
}

export function setRate<T>(flight: Flight<T>, rate: number): Flight<T> {
  return { ...flight, rate };
}
