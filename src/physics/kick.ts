/**
 * キックモデル（3.6）。蹴る点・向き・強さから、初速と回転を求める。
 *
 *   v₀ = e·J/m        （e: キック効率）
 *   ω₀ = κ·(r × J)/I  （r: 重心から接触点へのベクトル, κ: 足との摩擦による伝達係数）
 *
 * 中心を蹴れば r と J が平行なので回転はゼロ（ナックル）。外側をこするほど回転が増える。
 * e, κ, 力積の上限はどれも仮定値。
 */
import { inertia, type PhysicsParams } from './params.ts';
import type { KickState, Vec3 } from './types.ts';

export interface KickInput {
  /**
   * 接触点。キッカーから見たボール正面の円の中での、中心からのずれ。
   * [右が正, 上が正]。半径を 1 とする。
   */
  readonly contact: readonly [number, number];
  /** 蹴る向きの方位角 [度]。+x（ゴール方向）が 0、右（+z）が正。 */
  readonly azimuthDeg: number;
  /** 仰角 [度] */
  readonly elevationDeg: number;
  /** 強さ 0〜1 */
  readonly power: number;
}

/** 接触点が中心から離れられる上限（縁ぎりぎりは足が当たらない） */
export const CONTACT_LIMIT = 0.9;

const RAD = Math.PI / 180;

interface KickFrame {
  /** 蹴る向き */
  readonly forward: Vec3;
  /** キッカーから見て右（水平） */
  readonly right: Vec3;
  /** キッカーから見て上（forward に垂直） */
  readonly up: Vec3;
}

function kickFrame(azimuthDeg: number, elevationDeg: number): KickFrame {
  const az = azimuthDeg * RAD;
  const el = elevationDeg * RAD;
  const forward: Vec3 = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
  const right: Vec3 = [-Math.sin(az), 0, Math.cos(az)];
  // up = right × forward
  const up: Vec3 = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  return { forward, right, up };
}

/** 接触点を、ボールの縁の内側（CONTACT_LIMIT）に収める */
export function clampContact([u, w]: readonly [number, number]): readonly [number, number] {
  const r = Math.hypot(u, w);
  return r > CONTACT_LIMIT ? [(u / r) * CONTACT_LIMIT, (w / r) * CONTACT_LIMIT] : [u, w];
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export function kickToState(input: KickInput, position: Vec3, params: PhysicsParams): KickState {
  const { forward, right, up } = kickFrame(input.azimuthDeg, input.elevationDeg);
  const [u, w] = clampContact(input.contact);
  const impulse = clamp01(input.power) * params.maxImpulse;
  const speed = (params.kickEfficiency * impulse) / params.mass;
  // r × J = R·J·(u·up − w·right)（ボールの裏側へ向かう成分は J と平行なので消える）
  const spin = (params.spinTransfer * params.radius * impulse) / inertia(params);
  const axis = (a: 0 | 1 | 2): number => (u === 0 && w === 0 ? 0 : spin * (u * up[a] - w * right[a]));

  return {
    position,
    velocity: [speed * forward[0], speed * forward[1], speed * forward[2]],
    omega: [axis(0), axis(1), axis(2)],
  };
}

export interface SpinDescription {
  /** 回転数 [回/秒] */
  readonly rps: number;
  /** 横にどちらへ曲がるか */
  readonly curve: 'left' | 'right' | 'none';
  readonly vertical: 'backspin' | 'topspin' | 'none';
  /** ナックル横力が強く出るほど回転が少ない */
  readonly knuckle: boolean;
  /** スピンパラメータ S */
  readonly spinParameter: number;
}

/** これより小さい回転成分 [rad/s] は「なし」とみなす */
const NEGLIGIBLE_SPIN = 3;

/** 蹴り方から、どんな回転がかかるかを言葉にするための分類 */
export function describeSpin(input: KickInput, params: PhysicsParams): SpinDescription {
  const state = kickToState(input, [0, params.radius, 0], params);
  const { right, up } = kickFrame(input.azimuthDeg, input.elevationDeg);
  const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const side = dot(state.omega, up);
  const back = dot(state.omega, right);
  const omegaMag = Math.hypot(...state.omega);
  const speed = Math.hypot(...state.velocity);
  const spinParameter = speed > 0 ? (params.radius * omegaMag) / speed : 0;

  return {
    rps: omegaMag / (2 * Math.PI),
    curve: side < -NEGLIGIBLE_SPIN ? 'right' : side > NEGLIGIBLE_SPIN ? 'left' : 'none',
    vertical: back > NEGLIGIBLE_SPIN ? 'backspin' : back < -NEGLIGIBLE_SPIN ? 'topspin' : 'none',
    knuckle: spinParameter < params.knuckleSpinThreshold,
    spinParameter,
  };
}
