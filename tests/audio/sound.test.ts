import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundKit } from '../../src/audio/sound.ts';

/** Web Audio の代役。つないだ・止めた・値を変えた、を記録するだけ。 */
class FakeParam {
  value = 0;
  target: number | null = null;
  setValueAtTime(v: number): void { this.value = v; }
  exponentialRampToValueAtTime(): void {}
  setTargetAtTime(v: number): void { this.target = v; }
  cancelScheduledValues(): void {}
}
class FakeNode {
  connected = 0;
  disconnected = 0;
  started = false;
  stopped = false;
  loop = false;
  buffer: unknown = null;
  type = '';
  onended: (() => void) | null = null;
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  connect<T>(next: T): T { this.connected++; return next; }
  disconnect(): void { this.disconnected++; }
  start(): void { this.started = true; }
  stop(): void { this.stopped = true; }
}
class FakeContext {
  static last: FakeContext | null = null;
  state: 'running' | 'suspended' = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  nodes: FakeNode[] = [];
  constructor() { FakeContext.last = this; }
  private make(): FakeNode { const n = new FakeNode(); this.nodes.push(n); return n; }
  createGain(): FakeNode { return this.make(); }
  createOscillator(): FakeNode { return this.make(); }
  createBiquadFilter(): FakeNode { return this.make(); }
  createBufferSource(): FakeNode { return this.make(); }
  createBuffer(): { getChannelData: () => Float32Array } { return { getChannelData: () => new Float32Array(16) }; }
  resume(): Promise<void> { this.state = 'running'; return Promise.resolve(); }
  suspend(): Promise<void> { this.state = 'suspended'; return Promise.resolve(); }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', FakeContext);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** 鳴らしっぱなしの音源（ループ再生で、止める予約がないもの） */
const endless = (ctx: FakeContext): FakeNode[] => ctx.nodes.filter((n) => n.loop && n.started && !n.stopped);

describe('効果音の後始末', () => {
  it('音を出せるようにしただけでは、ざわめきは鳴らない', () => {
    const kit = createSoundKit();
    kit.unlock();
    const ctx = FakeContext.last!;
    expect(kit.ambientLevel()).toBe(0);
    // ざわめきの音源は 1 つだけ用意される
    expect(endless(ctx)).toHaveLength(1);
  });
  it('再生中だけざわめきを出し、再生が終わったら消す', () => {
    const kit = createSoundKit();
    kit.unlock();
    kit.setActive(true);
    expect(kit.ambientLevel()).toBeGreaterThan(0);
    kit.setActive(false);
    expect(kit.ambientLevel()).toBe(0);
  });
  it('再生が終わってしばらくしたら、音の出力そのものを止める。次の再生で戻る', () => {
    const kit = createSoundKit();
    kit.unlock();
    const ctx = FakeContext.last!;
    kit.setActive(true);
    kit.setActive(false);
    vi.advanceTimersByTime(3000);
    expect(ctx.state).toBe('running'); // 歓声の余韻が残っている間は止めない
    vi.advanceTimersByTime(4000);
    expect(ctx.state).toBe('suspended');
    kit.setActive(true);
    expect(ctx.state).toBe('running');
  });
  it('止める前にまた再生が始まったら、出力を止めない', () => {
    const kit = createSoundKit();
    kit.unlock();
    const ctx = FakeContext.last!;
    kit.setActive(false);
    vi.advanceTimersByTime(3000);
    kit.setActive(true);
    vi.advanceTimersByTime(10000);
    expect(ctx.state).toBe('running');
  });
  it('1 回きりの音は、鳴らし終わったら止まり、つなぎを外す', () => {
    const kit = createSoundKit();
    kit.unlock();
    const ctx = FakeContext.last!;
    const before = ctx.nodes.length;
    kit.kick(1);
    kit.post(20);
    kit.net(20);
    kit.cheer();
    kit.groan();
    const sources = ctx.nodes.slice(before).filter((n) => n.started);
    expect(sources.length).toBeGreaterThan(5);
    for (const source of sources) {
      expect(source.stopped).toBe(true);
      expect(source.onended).not.toBeNull();
    }
    // 鳴らしっぱなしの音源は、ざわめきの 1 つから増えない
    expect(endless(ctx)).toHaveLength(1);
    for (const source of sources) source.onended!();
    expect(ctx.nodes.slice(before).every((n) => n.disconnected > 0 || n.connected === 0)).toBe(true);
  });
  it('音を切っている間は、再生中でもざわめきを出さない', () => {
    const kit = createSoundKit();
    kit.unlock();
    kit.setMuted(true);
    kit.setActive(true);
    expect(kit.masterLevel()).toBe(0);
  });
});
