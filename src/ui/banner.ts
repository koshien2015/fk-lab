/**
 * 判定の表示。ゴールのときは 1 文字ずつ跳ねて出る。
 */
import type { ShotOutcome } from '../match/shot.ts';
import { OUTCOME_LABELS } from '../match/verdict.ts';
import { h } from './dom.ts';

export interface Banner {
  readonly element: HTMLElement;
  /** 画面全体を一瞬光らせる幕 */
  readonly flashElement: HTMLElement;
  set(outcome: ShotOutcome, detail: string): void;
  setVisible(visible: boolean): void;
  flash(): void;
}

export function createBanner(): Banner {
  const main = h('div', { class: 'banner-main' });
  const sub = h('div', { class: 'banner-sub' });
  const element = h('div', { class: 'overlay banner' }, main, sub);
  const flashElement = h('div', { class: 'overlay flash' });

  return {
    element,
    flashElement,
    set(outcome, detail) {
      element.dataset.outcome = outcome;
      main.replaceChildren(
        ...[...OUTCOME_LABELS[outcome]].map((letter, i) => {
          const span = h('span', {}, letter);
          span.style.animationDelay = `${i * 0.06}s`;
          return span;
        }),
      );
      sub.textContent = detail;
    },
    setVisible(visible) {
      element.classList.toggle('show', visible);
    },
    flash() {
      // アニメーションを最初からやり直す
      flashElement.classList.remove('go');
      void flashElement.offsetWidth;
      flashElement.classList.add('go');
    },
  };
}
