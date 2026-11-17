/**
 * 蹴り方を決める操作パネル。
 */
import { SETUP_LIMITS, SETUP_PRESETS, toKickInput, type KickSetup } from '../app/setup.ts';
import type { Store } from '../app/store.ts';
import { distanceToGoal } from '../field/placement.ts';
import type { KeeperLevel } from '../match/keeper.ts';
import { describeSpin, type SpinDescription } from '../physics/kick.ts';
import type { PhysicsParams } from '../physics/params.ts';
import { createContactPicker } from './contactPicker.ts';
import { h, setText } from './dom.ts';
import { createSliderRow } from './sliderRow.ts';

export interface PanelActions {
  readonly onKick: () => void;
  readonly onTogglePlacing: () => void;
}

export interface PanelView {
  readonly element: HTMLElement;
  /** 位置を選んでいる最中かどうかを反映する */
  setPlacing(placing: boolean): void;
  setStatus(text: string): void;
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
  params: PhysicsParams,
  actions: PanelActions,
): PanelView {
  const picker = createContactPicker((contact) => store.set({ contact }));
  const spin = h('p', { class: 'spin-text' });
  const maxSpeed = (params.kickEfficiency * params.maxImpulse) / params.mass;

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
    format: (v) => `${Math.round(v * 100)}%（${(v * maxSpeed * 3.6).toFixed(0)} km/h）`,
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
  const wallJump = h('button', { type: 'button', class: 'chip' }, '壁がジャンプ');
  wallJump.addEventListener('click', () => setWall({ jump: !store.get().wall.jump }));
  const keepers = KEEPER_CHOICES.map((choice) => {
    const button = h('button', { type: 'button', class: 'chip' }, choice.label);
    button.addEventListener('click', () => store.set({ keeper: choice.value }));
    return { choice, button };
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
    h('div', { class: 'group sliders defence' }, wallCount.element, wallOffset.element),
    h(
      'div',
      { class: 'group row' },
      wallJump,
      h('span', { class: 'caption' }, 'GK'),
      ...keepers.map((k) => k.button),
    ),
    h('div', { class: 'group action' }, kick, status),
  );

  const render = (setup: KickSetup): void => {
    picker.render(setup.contact);
    setText(spin, spinText(describeSpin(toKickInput(setup), params)));
    aim.render(setup.aimDeg);
    elevation.render(setup.elevationDeg);
    power.render(setup.power);
    setText(seedLabel, `シード ${setup.seed}`);
    setText(distance, `ゴールまで ${distanceToGoal(setup.spot).toFixed(1)} m`);
    wallCount.render(setup.wall.count);
    wallOffset.render(setup.wall.offset);
    wallJump.setAttribute('aria-pressed', String(setup.wall.jump));
    for (const { choice, button } of keepers) {
      button.setAttribute('aria-pressed', String(choice.value === setup.keeper));
    }
    for (const { preset, button } of presets) {
      const active = (Object.keys(preset.patch) as Array<keyof typeof preset.patch>).every(
        (key) => JSON.stringify(preset.patch[key]) === JSON.stringify(setup[key]),
      );
      button.setAttribute('aria-pressed', String(active));
    }
  };
  store.subscribe(render);
  render(store.get());

  return {
    element,
    setPlacing(placing) {
      place.setAttribute('aria-pressed', String(placing));
      setText(place, placing ? 'この位置に決める' : 'ボールの位置を変える');
    },
    setStatus: (text) => setText(status, text),
  };
}
