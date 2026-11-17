/**
 * 再生のタイムライン（再生・一時停止、スクラブ、スローモーション）。
 */
import { h, setText } from './dom.ts';

export const PLAYBACK_RATES = [0.1, 0.25, 0.5, 1] as const;

export interface TimelineActions {
  readonly onTogglePlay: () => void;
  readonly onSeek: (time: number) => void;
  readonly onRate: (rate: number) => void;
}

export interface TimelineState {
  readonly time: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly rate: number;
}

export interface Timeline {
  readonly element: HTMLElement;
  render(state: TimelineState): void;
  setVisible(visible: boolean): void;
}

export function createTimeline(actions: TimelineActions): Timeline {
  const play = h('button', { type: 'button', class: 'chip play' }, '一時停止');
  play.addEventListener('click', actions.onTogglePlay);
  const scrub = h('input', { type: 'range', min: '0', max: '1', step: '0.001' });
  scrub.setAttribute('aria-label', '再生位置');
  scrub.addEventListener('input', () => actions.onSeek(Number(scrub.value)));
  const clock = h('output', {});
  const rates = PLAYBACK_RATES.map((rate) => {
    const button = h('button', { type: 'button', class: 'chip' }, `×${rate}`);
    button.addEventListener('click', () => actions.onRate(rate));
    return { rate, button };
  });
  const element = h(
    'div',
    { class: 'overlay timeline' },
    play,
    scrub,
    clock,
    h('div', { class: 'rates' }, ...rates.map((r) => r.button)),
  );

  return {
    element,
    render({ time, duration, playing, rate }) {
      if (scrub.max !== String(duration)) scrub.max = String(duration);
      // ドラッグ中に値を書き戻すとつまみが跳ねるので、離れているときだけ更新する
      if (document.activeElement !== scrub || playing) scrub.value = String(time);
      setText(clock, `${time.toFixed(2)} / ${duration.toFixed(2)} s`);
      const atEnd = time >= duration;
      setText(play, playing ? '一時停止' : atEnd ? 'もう一度' : '再生');
      for (const { rate: value, button } of rates) button.setAttribute('aria-pressed', String(value === rate));
    },
    setVisible(visible) {
      element.classList.toggle('show', visible);
    },
  };
}
