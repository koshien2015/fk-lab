/**
 * 比較モード。蹴った軌道を残して、次の軌道と重ねて見る。
 */
import * as THREE from 'three';
import type { Trajectory } from '../physics/types.ts';
import { createTrail } from '../scene/trail.ts';
import { h } from '../ui/dom.ts';

const COLORS = ['#ff8fab', '#8ce99a', '#b197fc', '#ffa94d'] as const;

export interface Compare {
  readonly object: THREE.Group;
  /** 残した軌道の一覧（色と説明） */
  readonly element: HTMLElement;
  pin(trajectory: Trajectory, label: string): void;
  clear(): void;
  count(): number;
}

interface Pinned {
  readonly color: string;
  readonly label: string;
  readonly line: THREE.Object3D;
}

export function createCompare(): Compare {
  const object = new THREE.Group();
  const element = h('ul', { class: 'overlay compare' });
  let pinned: readonly Pinned[] = [];
  let next = 0;

  const render = (): void => {
    element.replaceChildren(
      ...pinned.map(({ color, label }) => {
        const swatch = h('i', {});
        swatch.style.background = color;
        return h('li', {}, swatch, label);
      }),
    );
  };

  return {
    object,
    element,
    pin(trajectory, label) {
      const color = COLORS[next % COLORS.length];
      next += 1;
      const trail = createTrail({ width: 2.5, opacity: 0.8, color });
      trail.setTrajectory(trajectory);
      trail.reveal(trajectory.count);
      object.add(trail.object);
      // 古いものから消して、色の数までに収める
      const all = [...pinned, { color, label, line: trail.object }];
      const dropped = all.slice(0, Math.max(0, all.length - COLORS.length));
      for (const { line } of dropped) object.remove(line);
      pinned = all.slice(dropped.length);
      render();
    },
    clear() {
      for (const { line } of pinned) object.remove(line);
      pinned = [];
      render();
    },
    count: () => pinned.length,
  };
}
