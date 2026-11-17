/**
 * 比較モード。蹴った軌道を残して、次の軌道と重ねて見る。
 */
import * as THREE from 'three';
import type { Trajectory } from '../physics/types.ts';
import { createTrail, type TrailView } from '../scene/trail.ts';
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
  readonly trail: TrailView;
}

export function createCompare(): Compare {
  const object = new THREE.Group();
  const element = h('ul', { class: 'overlay compare' });
  let pinned: readonly Pinned[] = [];
  let next = 0;

  const remove = ({ trail }: Pinned): void => {
    object.remove(trail.object);
    trail.dispose();
  };

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
      const all = [...pinned, { color, label, trail }];
      const dropped = all.slice(0, Math.max(0, all.length - COLORS.length));
      for (const old of dropped) remove(old);
      pinned = all.slice(dropped.length);
      render();
    },
    clear() {
      for (const old of pinned) remove(old);
      pinned = [];
      render();
    },
    count: () => pinned.length,
  };
}
