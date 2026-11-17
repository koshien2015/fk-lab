/**
 * 力の表示名と色（力ベクトル、凡例、グラフで共通に使う）。
 */
import type { ForceKey } from '../physics/types.ts';

export interface ForceStyle {
  readonly key: ForceKey;
  readonly label: string;
  readonly color: string;
}

export const FORCE_STYLES: readonly ForceStyle[] = [
  { key: 'gravity', label: '重力', color: '#c9d2e0' },
  { key: 'drag', label: '抗力', color: '#ff6b6b' },
  { key: 'magnus', label: 'マグヌス力', color: '#ffd166' },
  { key: 'knuckle', label: 'ナックル横力', color: '#5ad1ff' },
];
