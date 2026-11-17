/**
 * 画面右上の計器（速さ、回転、レイノルズ数、力の大きさなど）。
 */
import { spinMix } from '../analysis/explain.ts';
import { FORCE_STYLES } from '../analysis/forces.ts';
import type { PhysicsParams } from '../physics/params.ts';
import type { BallSample } from '../playback/sample.ts';
import { h, setText } from '../ui/dom.ts';

const ROWS = [
  ['time', '時間'],
  ['speed', '速さ'],
  ['spin', '回転数'],
  ['axis', '回転の内訳'],
  ['re', 'Re'],
  ['cd', 'C_D'],
  ['s', 'S'],
] as const;

type RowKey = (typeof ROWS)[number][0];

export interface Hud {
  readonly element: HTMLElement;
  update(sample: BallSample): void;
}

const percent = (v: number): string => `${Math.round(v * 100)}%`;

/** レイノルズ数が、臨界域のどちら側にあるか */
function regime(re: number, params: PhysicsParams): string {
  const offset = (re - params.criticalReynolds) / params.crisisWidth;
  return offset > 2 ? '超臨界' : offset < -2 ? '亜臨界' : '臨界域';
}

export function createHud(getParams: () => PhysicsParams): Hud {
  const cells = new Map<string, HTMLElement>();
  const row = (key: string, label: string, color?: string): HTMLElement[] => {
    const term = h('dt', {}, label);
    if (color) term.style.setProperty('--swatch', color);
    if (color) term.classList.add('force');
    const value = h('dd', {}, '–');
    cells.set(key, value);
    return [term, value];
  };
  const element = h(
    'dl',
    { class: 'overlay hud' },
    ...ROWS.flatMap(([key, label]) => row(key, label)),
    ...FORCE_STYLES.flatMap((style) => row(style.key, style.label, style.color)),
  );
  const set = (key: RowKey | (typeof FORCE_STYLES)[number]['key'], text: string): void => {
    const cell = cells.get(key);
    if (cell) setText(cell, text);
  };

  return {
    element,
    update(sample) {
      const speed = Math.hypot(...sample.velocity);
      const rps = Math.hypot(...sample.omega) / (2 * Math.PI);
      const mix = spinMix(sample.omega, sample.velocity);
      set('time', `${sample.time.toFixed(2)} s`);
      set('speed', `${speed.toFixed(1)} m/s（${(speed * 3.6).toFixed(0)} km/h）`);
      set('spin', `${rps.toFixed(1)} rps`);
      set('axis', rps < 0.3 ? '無回転' : `横 ${percent(mix.side)}・縦 ${percent(mix.vertical)}`);
      set('re', `${(sample.re / 1e5).toFixed(2)}×10⁵（${regime(sample.re, getParams())}）`);
      set('cd', sample.cd.toFixed(2));
      set('s', sample.spin.toFixed(2));
      for (const style of FORCE_STYLES) {
        set(style.key, `${Math.hypot(...sample.forces[style.key]).toFixed(1)} N`);
      }
    },
  };
}
