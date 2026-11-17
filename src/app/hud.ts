/**
 * 画面右上の計器（速さ、回転数など）。
 */
import type { BallSample } from '../playback/sample.ts';

const ROWS = [
  ['time', '時間'],
  ['speed', '速さ'],
  ['spin', '回転数'],
  ['height', '高さ'],
] as const;

type RowKey = (typeof ROWS)[number][0];

export interface Hud {
  readonly element: HTMLElement;
  update(sample: BallSample): void;
}

export function createHud(): Hud {
  const element = document.createElement('dl');
  element.className = 'overlay hud';
  const cells = new Map<RowKey, HTMLElement>();
  for (const [key, label] of ROWS) {
    const term = document.createElement('dt');
    term.textContent = label;
    const value = document.createElement('dd');
    value.textContent = '–';
    cells.set(key, value);
    element.append(term, value);
  }
  const set = (key: RowKey, text: string): void => {
    const cell = cells.get(key);
    if (cell && cell.textContent !== text) cell.textContent = text;
  };

  return {
    element,
    update(sample) {
      const speed = Math.hypot(...sample.velocity);
      const rps = Math.hypot(...sample.omega) / (2 * Math.PI);
      set('time', `${sample.time.toFixed(2)} s`);
      set('speed', `${speed.toFixed(1)} m/s（${(speed * 3.6).toFixed(0)} km/h）`);
      set('spin', `${rps.toFixed(1)} rps`);
      set('height', `${sample.position[1].toFixed(2)} m`);
    },
  };
}
