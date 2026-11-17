/**
 * 蹴り方を決める操作パネル。
 */
import { LEGENDS, type Legend } from '../app/legends.ts';
import { SETUP_LIMITS, SETUP_PRESETS, toKickInput, type KickSetup } from '../app/setup.ts';
import type { Store } from '../app/store.ts';
import { distanceToGoal } from '../field/placement.ts';
import type { KeeperLevel } from '../match/keeper.ts';
import { describeSpin, type SpinDescription } from '../physics/kick.ts';
import type { PhysicsParams } from '../physics/params.ts';
import type { SpinStyle } from '../solver/inverse.ts';
import { createContactPicker } from './contactPicker.ts';
import { h, setText } from './dom.ts';
import { createParamsPanel } from './paramsPanel.ts';
import { createSliderRow } from './sliderRow.ts';

export interface PanelActions {
  readonly onKick: () => void;
  readonly onTogglePlacing: () => void;
  readonly onToggleArrows: () => void;
  readonly onTogglePreview: () => void;
  /** いまの軌道を、比較用に残す */
  readonly onPin: () => void;
  readonly onClearPins: () => void;
  /** 逆算モード（ゴールの狙う点をクリックして蹴り方を求める）の入り切り */
  readonly onToggleInverse: () => void;
  readonly onInverseStyle: (style: SpinStyle) => void;
  readonly onLegend: (legend: Legend) => void;
}

export interface InverseState {
  readonly active: boolean;
  readonly style: SpinStyle;
}

const STYLE_CHOICES: ReadonlyArray<{ readonly value: SpinStyle; readonly label: string }> = [
  { value: 'curve', label: 'カーブ' },
  { value: 'knuckle', label: 'ナックル' },
  { value: 'drive', label: 'ドライブ' },
];

export interface ViewState {
  readonly arrows: boolean;
  readonly preview: boolean;
  /** 残せる軌道があるか */
  readonly canPin: boolean;
  readonly pinCount: number;
}

export interface PanelView {
  readonly element: HTMLElement;
  /** 位置を選んでいる最中かどうかを反映する */
  setPlacing(placing: boolean): void;
  setStatus(text: string): void;
  setView(view: ViewState): void;
  setInverse(state: InverseState): void;
}

function spinText(spin: SpinDescription): string {
  if (spin.knuckle) return '回転ほぼなし → ナックル（揺れる）';
  const curve = { right: '右へ曲がる', left: '左へ曲がる', none: '' }[spin.curve];
  const vertical = { backspin: 'バックスピン（伸びる）', topspin: 'トップスピン（落ちる）', none: '' }[
    spin.vertical
  ];
  return `${spin.rps.toFixed(1)} rps：${[curve, vertical].filter(Boolean).join(' ＋ ')}`;
}

const KEEPER_CHOICES: ReadonlyArray<{ readonly value: KeeperLevel | 'none'; readonly label: string }> = [
  { value: 'none', label: 'なし' },
  { value: 'easy', label: 'やさしい' },
  { value: 'normal', label: 'ふつう' },
  { value: 'hard', label: 'つよい' },
];

const signedDeg = (v: number): string =>
  v === 0 ? '正面' : `${v > 0 ? '右' : '左'} ${Math.abs(v).toFixed(1)}°`;

export function createPanel(
  store: Store<KickSetup>,
  paramStore: Store<PhysicsParams>,
  actions: PanelActions,
): PanelView {
  const picker = createContactPicker((contact) => store.set({ contact }));
  const spin = h('p', { class: 'spin-text' });
  const maxSpeed = (): number => {
    const params = paramStore.get();
    return (params.kickEfficiency * params.maxImpulse) / params.mass;
  };

  const aim = createSliderRow({
    label: '左右の狙い',
    ...SETUP_LIMITS.aimDeg,
    format: signedDeg,
    onInput: (aimDeg) => store.set({ aimDeg }),
  });
  const elevation = createSliderRow({
    label: '打ち出しの高さ',
    ...SETUP_LIMITS.elevationDeg,
    format: (v) => `${v.toFixed(1)}°`,
    onInput: (elevationDeg) => store.set({ elevationDeg }),
  });
  const power = createSliderRow({
    label: '強さ',
    ...SETUP_LIMITS.power,
    format: (v) => `${Math.round(v * 100)}%（${(v * maxSpeed() * 3.6).toFixed(0)} km/h）`,
    onInput: (value) => store.set({ power: value }),
  });

  const presets = SETUP_PRESETS.map((preset) => {
    const button = h('button', { type: 'button', class: 'chip', title: preset.description }, preset.label);
    button.addEventListener('click', () => store.set(preset.patch));
    return { preset, button };
  });

  const seedLabel = h('span', {});
  const reroll = h('button', { type: 'button', class: 'chip' }, '揺れ方を変える');
  reroll.addEventListener('click', () => store.set({ seed: store.get().seed + 1 }));

  const place = h('button', { type: 'button', class: 'chip' }, 'ボールの位置を変える');
  place.addEventListener('click', actions.onTogglePlacing);
  const distance = h('span', {});

  const setWall = (patch: Partial<KickSetup['wall']>): void =>
    store.set({ wall: { ...store.get().wall, ...patch } });
  const wallCount = createSliderRow({
    label: '壁の人数',
    ...SETUP_LIMITS.wallCount,
    format: (v) => (v === 0 ? 'なし' : `${v} 人`),
    onInput: (count) => setWall({ count }),
  });
  const wallOffset = createSliderRow({
    label: '壁の位置',
    ...SETUP_LIMITS.wallOffset,
    format: (v) => (v === 0 ? '自動' : `${v > 0 ? '中央へ' : '外へ'} ${Math.abs(v).toFixed(2)} m`),
    onInput: (offset) => setWall({ offset }),
  });
  const wallJumpDelay = createSliderRow({
    label: '壁が跳ぶタイミング',
    ...SETUP_LIMITS.wallJumpDelay,
    format: (v) => `蹴ってから ${v.toFixed(2)} 秒後`,
    onInput: (jumpDelay) => setWall({ jumpDelay }),
  });
  const wallJump = h('button', { type: 'button', class: 'chip' }, '壁がジャンプ');
  wallJump.addEventListener('click', () => setWall({ jump: !store.get().wall.jump }));
  const keepers = KEEPER_CHOICES.map((choice) => {
    const button = h('button', { type: 'button', class: 'chip' }, choice.label);
    button.addEventListener('click', () => store.set({ keeper: choice.value }));
    return { choice, button };
  });

  const chip = (label: string, onClick: () => void): HTMLButtonElement => {
    const button = h('button', { type: 'button', class: 'chip' }, label);
    button.addEventListener('click', onClick);
    return button;
  };
  const arrows = chip('力ベクトル', actions.onToggleArrows);
  const previewLine = chip('予測線', actions.onTogglePreview);
  const pin = chip('この軌道を残す', actions.onPin);
  const clearPins = chip('比較を消す', actions.onClearPins);

  const inverse = chip('ゴールをクリックして逆算', actions.onToggleInverse);
  const styles = STYLE_CHOICES.map((choice) => ({
    choice,
    button: chip(choice.label, () => actions.onInverseStyle(choice.value)),
  }));
  const legends = LEGENDS.map((legend) => {
    const button = chip(legend.label, () => actions.onLegend(legend));
    button.title = legend.scene;
    return { legend, button };
  });

  const kick = h('button', { type: 'button', class: 'kick' }, '蹴る');
  kick.addEventListener('click', actions.onKick);
  const status = h('p', { class: 'status' });

  const element = h(
    'aside',
    { class: 'panel' },
    h('div', { class: 'group presets' }, h('span', { class: 'caption' }, 'お手本'), ...presets.map((p) => p.button)),
    h(
      'div',
      { class: 'group contact' },
      h('span', { class: 'caption' }, 'ボールのどこを蹴るか'),
      picker.element,
      spin,
    ),
    h('div', { class: 'group sliders' }, aim.element, elevation.element, power.element),
    h('div', { class: 'group row' }, place, distance),
    h('div', { class: 'group row' }, reroll, seedLabel),
    h('div', { class: 'group sliders defence' }, wallCount.element, wallOffset.element, wallJumpDelay.element),
    h(
      'div',
      { class: 'group row' },
      wallJump,
      h('span', { class: 'caption' }, 'GK'),
      ...keepers.map((k) => k.button),
    ),
    h('div', { class: 'group action' }, kick, status),
    h(
      'div',
      { class: 'group row' },
      h('span', { class: 'caption wide' }, '逆算（狙う点から蹴り方を求める）'),
      inverse,
      ...styles.map((s) => s.button),
    ),
    h(
      'div',
      { class: 'group row' },
      h('span', { class: 'caption wide' }, '伝説の FK（パラメータは推定値）'),
      ...legends.map((l) => l.button),
    ),
    h('div', { class: 'group row' }, h('span', { class: 'caption' }, '表示'), arrows, previewLine),
    h('div', { class: 'group row' }, h('span', { class: 'caption' }, '比較'), pin, clearPins),
    createParamsPanel(paramStore),
  );

  const render = (setup: KickSetup): void => {
    picker.render(setup.contact);
    setText(spin, spinText(describeSpin(toKickInput(setup), paramStore.get())));
    aim.render(setup.aimDeg);
    elevation.render(setup.elevationDeg);
    power.render(setup.power);
    setText(seedLabel, `シード ${setup.seed}`);
    setText(distance, `ゴールまで ${distanceToGoal(setup.spot).toFixed(1)} m`);
    wallCount.render(setup.wall.count);
    wallOffset.render(setup.wall.offset);
    wallJumpDelay.render(setup.wall.jumpDelay);
    wallJumpDelay.element.hidden = !setup.wall.jump;
    wallJump.setAttribute('aria-pressed', String(setup.wall.jump));
    for (const { choice, button } of keepers) {
      button.setAttribute('aria-pressed', String(choice.value === setup.keeper));
    }
    for (const { legend, button } of legends) {
      button.setAttribute('aria-pressed', String(JSON.stringify(legend.setup) === JSON.stringify(setup)));
    }
    for (const { preset, button } of presets) {
      const active = (Object.keys(preset.patch) as Array<keyof typeof preset.patch>).every(
        (key) => JSON.stringify(preset.patch[key]) === JSON.stringify(setup[key]),
      );
      button.setAttribute('aria-pressed', String(active));
    }
  };
  store.subscribe(render);
  paramStore.subscribe(() => render(store.get()));
  render(store.get());

  return {
    element,
    setPlacing(placing) {
      place.setAttribute('aria-pressed', String(placing));
      setText(place, placing ? 'この位置に決める' : 'ボールの位置を変える');
    },
    setStatus: (text) => setText(status, text),
    setView(view) {
      arrows.setAttribute('aria-pressed', String(view.arrows));
      previewLine.setAttribute('aria-pressed', String(view.preview));
      pin.disabled = !view.canPin;
      clearPins.disabled = view.pinCount === 0;
    },
    setInverse(state) {
      inverse.setAttribute('aria-pressed', String(state.active));
      for (const { choice, button } of styles) {
        button.setAttribute('aria-pressed', String(choice.value === state.style));
      }
    },
  };
}
