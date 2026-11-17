/**
 * 物理パラメータを変える欄。仮定値の項目だけを並べ、仮定値であることを明示する。
 */
import type { Store } from '../app/store.ts';
import { PARAM_DEFS, defaultParams, type ParamKey, type PhysicsParams } from '../physics/params.ts';
import { h } from './dom.ts';
import { createSliderRow } from './sliderRow.ts';

const ASSUMED = (Object.keys(PARAM_DEFS) as ParamKey[]).filter((key) => PARAM_DEFS[key].assumed);

const format = (value: number): string =>
  Math.abs(value) >= 1e4 ? value.toExponential(2) : String(Number(value.toPrecision(3)));

export function createParamsPanel(store: Store<PhysicsParams>): HTMLElement {
  const rows = ASSUMED.map((key) => {
    const def = PARAM_DEFS[key];
    const row = createSliderRow({
      label: def.label,
      min: def.min,
      max: def.max,
      step: (def.max - def.min) / 200,
      format: (value) => `${format(value)}${def.unit ? ` ${def.unit}` : ''}`,
      onInput: (value) => store.set({ [key]: value } as Partial<PhysicsParams>),
    });
    if (def.note) row.element.title = def.note;
    return { key, row };
  });
  const reset = h('button', { type: 'button', class: 'chip' }, '初期値に戻す');
  reset.addEventListener('click', () => store.set(defaultParams()));

  const render = (params: PhysicsParams): void => {
    for (const { key, row } of rows) row.render(params[key]);
  };
  store.subscribe(render);
  render(store.get());

  return h(
    'details',
    { class: 'params' },
    h('summary', {}, '物理パラメータを変える', h('span', { class: 'badge' }, '仮定値')),
    h(
      'p',
      { class: 'why-note' },
      'ここに並ぶ値は、実測で検証していない仮定値です。変えると、予測線と結果がその場で変わります。',
    ),
    ...rows.map(({ row }) => row.element),
    reset,
  );
}
