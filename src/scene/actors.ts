/**
 * 守備側の選手（壁と GK）の見た目。
 */
import * as THREE from 'three';
import type { Spot } from '../field/placement.ts';
import { KEEPER, type KeeperPose } from '../match/keeper.ts';
import type { WallPlayer } from '../match/wall.ts';
import { createFigure } from './figure.ts';

export interface Actors {
  readonly object: THREE.Group;
  /** 壁を並べ直す。選手はボール（spot）のほうを向く。 */
  setWall(players: readonly WallPlayer[], spot: Spot): void;
  /** 壁のジャンプの高さ [m] */
  setWallLift(lift: number): void;
  /** GK の姿勢。null なら GK なし。 */
  setKeeper(pose: KeeperPose | null): void;
}

const WALL_STYLE = { shirt: 0xc8102e, shorts: 0xf2f2f2, socks: 0xc8102e, arms: 'guard' } as const;
const KEEPER_STYLE = {
  shirt: 0xf2c300,
  shorts: 0x1c1c22,
  socks: 0xf2c300,
  arms: 'up',
  gloves: 0xf5f5f5,
} as const;

export function createActors(): Actors {
  const object = new THREE.Group();
  const wall = new THREE.Group();
  const keeper = createFigure(KEEPER_STYLE);
  keeper.rotation.order = 'YXZ';
  object.add(wall, keeper);

  return {
    object,
    setWall(players, spot) {
      // 人数が変わったときだけ作り直す
      while (wall.children.length > players.length) wall.remove(wall.children[wall.children.length - 1]);
      while (wall.children.length < players.length) wall.add(createFigure(WALL_STYLE));
      players.forEach((player, i) => {
        const figure = wall.children[i];
        figure.position.set(player.x, figure.position.y, player.z);
        // 人形の正面（−x）をボールへ向ける
        figure.rotation.y = Math.atan2(player.z - spot.z, spot.x - player.x);
      });
    },
    setWallLift(lift) {
      for (const figure of wall.children) figure.position.y = lift;
    },
    setKeeper(pose) {
      keeper.visible = pose !== null;
      if (!pose) return;
      keeper.position.set(KEEPER.lineX, 0, pose.z);
      // x 軸まわりに倒す（正の角度で +z の側へ）
      keeper.rotation.x = pose.lean;
    },
  };
}
