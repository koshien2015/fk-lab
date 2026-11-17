/**
 * ラベルと値の表示が付いたスライダー 1 行。
 */
import { h, setText } from './dom.ts';

export interface SliderSpec {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly onInput: (value: number) => void;
}

export interface SliderRow {
  readonly element: HTMLElement;
  render(value: number): void;
}

export function createSliderRow(spec: SliderSpec): SliderRow {
  const value = h('output', {});
  const input = h('input', {
    type: 'range',
    min: String(spec.min),
    max: String(spec.max),
    step: String(spec.step),
  });
  input.setAttribute('aria-label', spec.label);
  input.addEventListener('input', () => spec.onInput(Number(input.value)));
  const element = h('label', { class: 'slider-row' }, h('span', {}, spec.label), value, input);

  return {
    element,
    render(next) {
      if (Number(input.value) !== next) input.value = String(next);
      setText(value, spec.format(next));
    },
  };
}
