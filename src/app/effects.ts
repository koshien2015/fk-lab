/**
 * 演出の進行役。再生が出来事（バウンド、ポスト、ネット、ゴールなど）をまたいだときに、
 * 音・紙吹雪・画面の光を出す。ネットの動きは物理計算の結果なので、ここでは扱わない。
 */
import type { SoundKit } from '../audio/sound.ts';
import { crossedEvents } from '../fx/direction.ts';
import type { ShotEvent, ShotResult } from '../match/shot.ts';
import type { Confetti } from '../scene/particles.ts';

export interface Effects {
  /** 蹴った瞬間 */
  kick(power: number): void;
  /** 再生が previous から now へ進んだ */
  advance(result: ShotResult, previous: number, now: number): void;
}

export interface EffectParts {
  readonly sound: SoundKit;
  readonly confetti: Confetti;
  /** 画面を一瞬光らせる */
  readonly flash: () => void;
}

export function createEffects({ sound, confetti, flash }: EffectParts): Effects {
  const react = (event: ShotEvent, result: ShotResult): void => {
    switch (event.kind) {
      case 'ground':
        sound.bounce(event.speed);
        break;
      case 'post':
        sound.post(event.speed);
        if (result.outcome !== 'goal') sound.groan();
        break;
      case 'wall':
      case 'keeper':
        sound.thud(event.speed);
        if (result.outcome !== 'goal') sound.groan();
        break;
      case 'net':
        sound.net(event.speed);
        break;
      case 'goal':
        sound.cheer();
        confetti.burst([1.2, 2.6, event.position[2] * 0.3]);
        flash();
        break;
      case 'out':
        sound.groan();
        break;
    }
  };

  return {
    kick: (power) => sound.kick(power),
    advance(result, previous, now) {
      for (const event of crossedEvents(result.events, previous, now)) react(event, result);
    },
  };
}
