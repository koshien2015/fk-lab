/**
 * 「なぜ曲がった？」パネル。どの力がどれだけ横・縦に動かしたかを棒グラフで示す。
 */
import { explainFlight, forceShares, type ForceShare } from '../analysis/explain.ts';
import type { PhysicsParams } from '../physics/params.ts';
import type { KickState, Trajectory } from '../physics/types.ts';
import { h } from './dom.ts';

export interface WhyPanel {
  readonly element: HTMLElement;
  show(trajectory: Trajectory, kick: KickState, flightTime: number): void;
  hide(): void;
}

type Axis = 'lateral' | 'vertical';

const AXES: ReadonlyArray<{ readonly key: Axis; readonly title: string; readonly minus: string; readonly plus: string }> = [
  { key: 'lateral', title: '横の変位への寄与', minus: '左', plus: '右' },
  { key: 'vertical', title: '縦の変位への寄与', minus: '下', plus: '上' },
];

/** 中央を 0 として、左右に伸びる棒 1 本 */
function bar(share: ForceShare, value: number, scale: number): HTMLElement {
  const fill = h('i', {});
  const width = (Math.abs(value) / scale) * 50;
  fill.style.width = `${width}%`;
  fill.style.left = value >= 0 ? '50%' : `${50 - width}%`;
  fill.style.background = share.color;
  return h(
    'div',
    { class: 'why-row' },
    h('span', {}, share.label),
    h('div', { class: 'why-track' }, fill),
    h('output', {}, `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)} m`),
  );
}

function chart(shares: readonly ForceShare[], axis: (typeof AXES)[number]): HTMLElement {
  const scale = Math.max(0.1, ...shares.map((share) => Math.abs(share[axis.key])));
  return h(
    'section',
    {},
    h('h3', {}, axis.title, h('small', {}, `（−：${axis.minus} ／ ＋：${axis.plus}）`)),
    ...shares.map((share) => bar(share, share[axis.key], scale)),
  );
}

export function createWhyPanel(getParams: () => PhysicsParams): WhyPanel {
  const body = h('div', { class: 'why-body' });
  const close = h('button', { type: 'button', class: 'why-close', title: '閉じる' }, '×');
  const heading = h('h2', {}, 'なぜ曲がった？', close);
  const element = h('aside', { class: 'overlay why' }, heading, body);
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    element.classList.remove('show');
  });
  // 見出しを押すと、中身を畳む・開く（狭い画面では 3D を隠さないよう、畳んだ状態で出す）
  heading.addEventListener('click', () => element.classList.toggle('collapsed'));
  const narrow = window.matchMedia('(max-width: 760px)');

  return {
    element,
    show(trajectory, kick, flightTime) {
      const shares = forceShares(trajectory.contributions, kick);
      body.replaceChildren(
        h('p', { class: 'why-note' }, `蹴ってから ${flightTime.toFixed(2)} 秒間（最初に何かに当たるまで）の、力ごとの積分値。`),
        ...AXES.map((axis) => chart(shares, axis)),
        h('ul', {}, ...explainFlight(trajectory, kick, getParams(), flightTime).map((line) => h('li', {}, line))),
        h('p', { class: 'why-note' }, '空力係数は仮定値です。'),
      );
      element.classList.toggle('collapsed', narrow.matches);
      element.classList.add('show');
    },
    hide: () => element.classList.remove('show'),
  };
}
