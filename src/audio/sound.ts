/**
 * 効果音。音声ファイルは使わず、Web Audio API でその場で合成する。
 */
export interface SoundKit {
  /** ユーザーの操作をきっかけに音を出せるようにする（ブラウザの制限のため） */
  unlock(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /**
   * 再生中かどうかを伝える。再生中だけ観客のざわめきを出し、
   * 再生が終わってしばらくしたら、音の出力そのものを止める。
   */
  setActive(active: boolean): void;
  /** いま目標にしている、ざわめきの音量と全体の音量（確認用） */
  ambientLevel(): number;
  masterLevel(): number;
  /** 強さ 0〜1 */
  kick(power: number): void;
  /** 以下の speed はぶつかった速さ [m/s] */
  bounce(speed: number): void;
  post(speed: number): void;
  net(speed: number): void;
  thud(speed: number): void;
  cheer(): void;
  groan(): void;
}

interface Envelope {
  /** 立ち上がりの時間、最大の音量、消えるまでの時間 */
  readonly attack: number;
  readonly peak: number;
  readonly release: number;
  /** 最大の音量を保つ時間 */
  readonly hold?: number;
}

const AMBIENT_LEVEL = 0.035;
const MASTER_LEVEL = 0.8;
/** 再生が終わってから、音の出力を止めるまでの時間 [ms]（歓声の余韻が消えるのを待つ） */
const IDLE_SUSPEND_MS = 6000;
/** ポストの「カーン」を作る倍音（周波数 [Hz] と相対的な大きさ） */
const POST_PARTIALS: ReadonlyArray<readonly [number, number]> = [
  [523, 1],
  [1318, 0.6],
  [2217, 0.35],
  [3320, 0.2],
];

const loudness = (speed: number, full: number): number => Math.min(1, Math.max(0.15, speed / full));

export function createSoundKit(): SoundKit {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = false;
  /** ざわめきの音量を決めるノードと、いまの目標の音量 */
  let ambient: GainNode | null = null;
  let ambientTarget = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  /** 鳴らし終わった音源のつなぎを外す（外さないと、鳴らすたびにノードが残る） */
  const release = (source: AudioScheduledSourceNode, ...chain: AudioNode[]): void => {
    source.onended = () => {
      source.disconnect();
      for (const node of chain) node.disconnect();
    };
  };

  const shape = (gain: AudioParam, at: number, env: Envelope): number => {
    const end = at + env.attack + (env.hold ?? 0) + env.release;
    gain.setValueAtTime(0.0001, at);
    gain.exponentialRampToValueAtTime(env.peak, at + env.attack);
    gain.setValueAtTime(env.peak, at + env.attack + (env.hold ?? 0));
    gain.exponentialRampToValueAtTime(0.0001, end);
    return end;
  };

  /** 音程のある音（周波数を from から to へ滑らせる） */
  const tone = (from: number, to: number, env: Envelope, type: OscillatorType = 'sine'): void => {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + env.attack + env.release);
    const end = shape(gain.gain, ctx.currentTime, env);
    osc.connect(gain).connect(master);
    release(osc, gain);
    osc.start();
    osc.stop(end + 0.02);
  };

  /** 雑音をフィルターに通した音（フィルターの周波数を from から to へ滑らせる） */
  const hiss = (kind: BiquadFilterType, from: number, to: number, q: number, env: Envelope): void => {
    if (!ctx || !master || !noise) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = kind;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, ctx.currentTime);
    const end = ctx.currentTime + env.attack + (env.hold ?? 0) + env.release;
    filter.frequency.exponentialRampToValueAtTime(to, end);
    const gain = ctx.createGain();
    shape(gain.gain, ctx.currentTime, env);
    source.connect(filter).connect(gain).connect(master);
    release(source, filter, gain);
    source.start(ctx.currentTime, Math.random() * 1.5);
    source.stop(end + 0.02);
  };

  /** 観客のざわめきの音源を用意する。音量はゼロから始め、再生中だけ上げる。 */
  const startAmbient = (context: AudioContext, out: GainNode, buffer: AudioBuffer): GainNode => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.4;
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(out);
    source.start();
    return gain;
  };

  return {
    unlock() {
      if (ctx) {
        void ctx.resume();
        return;
      }
      try {
        ctx = new AudioContext();
      } catch (error) {
        console.error('音を出す準備に失敗しました', error);
        return;
      }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_LEVEL;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      ambient = startAmbient(ctx, master, noise);
    },
    setMuted(next) {
      muted = next;
      if (ctx && master) master.gain.setTargetAtTime(next ? 0 : MASTER_LEVEL, ctx.currentTime, 0.03);
    },
    isMuted: () => muted,
    setActive(active) {
      ambientTarget = active ? AMBIENT_LEVEL : 0;
      if (!ctx || !ambient) return;
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = null;
      ambient.gain.setTargetAtTime(ambientTarget, ctx.currentTime, active ? 0.2 : 0.35);
      if (active) {
        void ctx.resume();
        return;
      }
      // 余韻が消えたら出力を止める。止めないと、ざわめきの音源が裏で回り続ける。
      const context = ctx;
      idleTimer = setTimeout(() => {
        idleTimer = null;
        void context.suspend();
      }, IDLE_SUSPEND_MS);
    },
    ambientLevel: () => ambientTarget,
    masterLevel: () => (muted ? 0 : MASTER_LEVEL),
    kick(power) {
      const level = 0.5 + 0.5 * power;
      tone(170, 46, { attack: 0.004, peak: 0.9 * level, release: 0.16 });
      hiss('highpass', 1800, 900, 0.7, { attack: 0.002, peak: 0.35 * level, release: 0.05 });
    },
    bounce(speed) {
      tone(120, 58, { attack: 0.003, peak: 0.45 * loudness(speed, 12), release: 0.1 });
    },
    post(speed) {
      const level = loudness(speed, 25);
      for (const [frequency, weight] of POST_PARTIALS) {
        tone(frequency, frequency * 0.995, { attack: 0.002, peak: 0.34 * weight * level, release: 0.9 });
      }
      hiss('bandpass', 3000, 2000, 2, { attack: 0.001, peak: 0.25 * level, release: 0.04 });
    },
    net(speed) {
      hiss('bandpass', 2600, 700, 0.8, { attack: 0.01, peak: 0.4 * loudness(speed, 22), release: 0.32 });
    },
    thud(speed) {
      tone(95, 50, { attack: 0.003, peak: 0.6 * loudness(speed, 20), release: 0.12 });
      hiss('lowpass', 900, 300, 0.7, { attack: 0.002, peak: 0.3 * loudness(speed, 20), release: 0.08 });
    },
    cheer() {
      hiss('bandpass', 900, 1300, 0.5, { attack: 0.3, peak: 0.55, hold: 1.4, release: 2.6 });
      hiss('bandpass', 2400, 2000, 0.9, { attack: 0.5, peak: 0.16, hold: 1.0, release: 2.2 });
      hiss('lowpass', 500, 380, 0.5, { attack: 0.2, peak: 0.3, hold: 1.2, release: 2.4 });
    },
    groan() {
      hiss('bandpass', 620, 260, 0.7, { attack: 0.12, peak: 0.3, hold: 0.25, release: 1.3 });
    },
  };
}
