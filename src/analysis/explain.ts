/**
 * 「なぜ曲がった？」の元になる計算と、言葉での説明。
 */
import type { PhysicsParams } from '../physics/params.ts';
import type { ForceKey, KickState, Trajectory, Vec3 } from '../physics/types.ts';
import { FORCE_STYLES, type ForceStyle } from './forces.ts';

export interface ForceShare extends ForceStyle {
  /** 蹴った向きに対して右へ動かした量 [m]（左なら負） */
  readonly lateral: number;
  /** 上へ動かした量 [m]（下なら負） */
  readonly vertical: number;
  /** 蹴った向きへ進めた量 [m]（引き戻したなら負） */
  readonly forward: number;
}

/** 力ごとの変位への寄与を、蹴った向き（水平成分）を基準に 3 方向へ分ける */
export function forceShares(
  contributions: Trajectory['contributions'],
  kick: KickState,
): ForceShare[] {
  const [vx, , vz] = kick.velocity;
  const h = Math.hypot(vx, vz);
  // 真上に蹴った場合は +x を前とする
  const fx = h > 1e-9 ? vx / h : 1;
  const fz = h > 1e-9 ? vz / h : 0;
  return FORCE_STYLES.map((style) => {
    const [cx, cy, cz] = contributions[style.key];
    return {
      ...style,
      lateral: cx * -fz + cz * fx || 0,
      vertical: cy,
      forward: cx * fx + cz * fz || 0,
    };
  });
}

/** これより小さい寄与 [m] には触れない */
const NOTABLE = 0.05;
/** C_D がこの倍率を超えて上がったら、ドラッグクライシスとして説明する */
const CRISIS_RATIO = 1.25;

const meters = (v: number): string => `${Math.abs(v).toFixed(1)} m`;
const side = (v: number): string => (v > 0 ? '右へ' : '左へ');

/**
 * 最初に何かに当たるまでの飛翔を、言葉で説明する。
 * flightTime を渡すと、その時刻までの記録だけを見る（当たったあとの転がりを含めない）。
 */
export function explainFlight(
  tr: Trajectory,
  kick: KickState,
  params: PhysicsParams,
  flightTime = Infinity,
): string[] {
  const shares = forceShares(tr.contributions, kick);
  const of = (key: ForceKey): ForceShare => {
    const found = shares.find((s) => s.key === key);
    if (!found) throw new Error(`力 ${key} の寄与が見つかりません`);
    return found;
  };
  const gravity = of('gravity');
  const drag = of('drag');
  const magnus = of('magnus');
  const knuckle = of('knuckle');
  const lines = [`重力が ${meters(gravity.vertical)} 落とした。`];

  if (Math.abs(magnus.lateral) > NOTABLE) {
    lines.push(`マグヌス力（回転による力）が${side(magnus.lateral)} ${meters(magnus.lateral)} 曲げた。`);
  }
  if (Math.abs(magnus.vertical) > NOTABLE) {
    const how = magnus.vertical > 0 ? '持ち上げた（バックスピン）' : '落とした（トップスピン）';
    lines.push(`マグヌス力が ${meters(magnus.vertical)} ${how}。`);
  }
  if (Math.hypot(knuckle.lateral, knuckle.vertical) > NOTABLE) {
    const vertical = knuckle.vertical > 0 ? '上へ' : '下へ';
    lines.push(
      `ナックル横力が${side(knuckle.lateral)} ${meters(knuckle.lateral)}、${vertical} ${meters(knuckle.vertical)} 揺らした。` +
        'この揺れは渦の剥離による（簡易モデル）。',
    );
  }
  if (drag.forward < -NOTABLE) lines.push(`抗力が ${meters(drag.forward)} 手前に引き戻した。`);

  const cdStart = tr.cd[0];
  const cdMax = tr.cd.reduce((max, cd, i) => (tr.t[i] <= flightTime ? Math.max(max, cd) : max), 0);
  if (cdStart > 0 && cdMax > cdStart * CRISIS_RATIO) {
    const speed = (params.criticalReynolds * params.kinematicViscosity) / (2 * params.radius);
    lines.push(
      `減速して臨界域（約 ${speed.toFixed(0)} m/s）に近づき、抗力係数が ${cdStart.toFixed(2)} → ${cdMax.toFixed(2)} に上がった（ドラッグクライシス）。`,
    );
  }
  return lines;
}

export interface SpinMix {
  /** 横回転（曲がる）の割合 0〜1 */
  readonly side: number;
  /** 縦回転（伸びる・落ちる）の割合 */
  readonly vertical: number;
  /** ジャイロ回転（進行方向が軸。力を生まない）の割合 */
  readonly gyro: number;
}

/** 回転軸を、進行方向を基準に 3 つの成分へ分ける（2 乗の割合） */
export function spinMix(omega: Vec3, velocity: Vec3): SpinMix {
  const w = Math.hypot(...omega);
  const v = Math.hypot(...velocity);
  if (w < 1e-9 || v < 1e-9) return { side: 0, vertical: 0, gyro: 0 };
  const u: Vec3 = [velocity[0] / v, velocity[1] / v, velocity[2] / v];
  const h = Math.hypot(u[0], u[2]);
  // 右 = 水平で進行方向に垂直、上 = 右 × 前
  const right: Vec3 = h > 1e-9 ? [-u[2] / h, 0, u[0] / h] : [0, 0, 1];
  const up: Vec3 = [
    right[1] * u[2] - right[2] * u[1],
    right[2] * u[0] - right[0] * u[2],
    right[0] * u[1] - right[1] * u[0],
  ];
  const along = (axis: Vec3): number =>
    ((omega[0] * axis[0] + omega[1] * axis[1] + omega[2] * axis[2]) / w) ** 2;
  return { side: along(up), vertical: along(right), gyro: along(u) };
}
