/**
 * 画面上部の小さな操作（視点の切り替え、音の入り切り）。
 */
import { CAMERA_MODES, type CameraMode } from '../scene/cameraViews.ts';
import { h, setText } from './dom.ts';

export interface ToolbarActions {
  readonly onCamera: (mode: CameraMode) => void;
  readonly onToggleSound: () => void;
}

export interface Toolbar {
  readonly element: HTMLElement;
  render(state: { readonly camera: CameraMode; readonly muted: boolean }): void;
}

export function createToolbar(actions: ToolbarActions): Toolbar {
  const cameras = CAMERA_MODES.map((mode) => {
    const button = h('button', { type: 'button', class: 'chip' }, mode.label);
    button.addEventListener('click', () => actions.onCamera(mode.value));
    return { mode, button };
  });
  const sound = h('button', { type: 'button', class: 'chip' }, '音 入');
  sound.addEventListener('click', actions.onToggleSound);
  const element = h(
    'div',
    { class: 'overlay toolbar' },
    h('span', { class: 'caption' }, '視点'),
    ...cameras.map((c) => c.button),
    sound,
  );

  return {
    element,
    render({ camera, muted }) {
      for (const { mode, button } of cameras) {
        button.setAttribute('aria-pressed', String(mode.value === camera));
      }
      setText(sound, muted ? '音 切' : '音 入');
      sound.setAttribute('aria-pressed', String(!muted));
    },
  };
}
