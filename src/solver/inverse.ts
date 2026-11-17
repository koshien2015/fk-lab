/**
 * 逆算モード。ゴール面上の狙う点を通る蹴り方（接触点・向き・強さ）を、Nelder-Mead 法で求める。
 *
 * 目的関数（小さいほどよい）:
 *   - 狙った点からのずれ（ゴールラインを通る位置との距離の 2 乗）
 *   - 壁に当たる・かすめる場合の罰則
 *   - 操作できる範囲を外れた場合の罰則
 *   - 飛んでいる時間（短いほど GK に時間を与えない）
 *   - GK の最初の読み（反応した瞬間の等速直線の延長）と実際の到達点の差が大きいほど少し有利
 *   - こする量が極端にならないための、弱い引き戻し
 *
 * 後ろの 3 つは、狙った点を通る蹴り方がいくつもあるときに、どれを選ぶかを決めるための項。
 * 重みは「ずれ 数 cm ぶん」程度に抑えてある（仮定）。
 */
import { SETUP_LIMITS, toKickState, type KickSetup } from '../app/setup.ts';
import { FIELD } from '../field/dimensions.ts';
import { sphereCapsuleContact } from '../match/geometry.ts';
import { KEEPER_LEVELS } from '../match/keeper.ts';
import { jumpHeight, WALL, wallCapsule, wallPlayers, type WallPlayer } from '../match/wall.ts';
import type { PhysicsParams } from '../physics/params.ts';
import { simulate } from '../physics/simulate.ts';
import type { Trajectory } from '../physics/types.ts';
import { minimize } from './nelderMead.ts';

export type SpinStyle = 'curve' | 'knuckle' | 'drive';

export interface GoalTarget {
  /** 高さ [m] */
  readonly y: number;
  /** 横位置 [m]（右が正） */
  readonly z: number;
}

export interface InverseRequest {
  /** いまの設定（ボールの位置、壁、シードを使う） */
  readonly setup: KickSetup;
  readonly target: GoalTarget;
  readonly style: SpinStyle;
  /** カーブの曲げる向きを決め打ちする（+1: ボールの右をこすって左へ曲げる）。省くと両方試す。 */
  readonly curveDirection?: 1 | -1;
}

export type KickPatch = Pick<KickSetup, 'contact' | 'aimDeg' | 'elevationDeg' | 'power'>;

export interface InverseSolution {
  readonly patch: KickPatch;
  /** 狙った点からのずれ [m] */
  readonly miss: number;
  readonly clearsWall: boolean;
  readonly evaluations: number;
  /** 探索の途中で試した軌道（x, y, z の並び）。表示用。 */
  readonly candidates: readonly Float32Array[];
}

/** 枠の内側に残す余白 [m] */
const TARGET_MARGIN = 0.04;
/** 壁との間に空けたい余裕 [m] */
const WALL_MARGIN = 0.1;
const MAX_CANDIDATES = 48;
const NOT_REACHED = 50;
/** 目的関数の重み（仮定） */
const WEIGHT = { wall: 200, bounds: 10, time: 0.02, deception: 0.015, spin: 0.15 };
/** こする量の目安（ここから離れるほど少し不利にする） */
const NATURAL_SPIN = 0.4;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** 狙う点を、ボールがまるごと枠に収まる範囲へ丸める */
export function clampTarget(target: GoalTarget, radius: number): GoalTarget {
  const halfW = FIELD.goalWidth / 2 - radius - TARGET_MARGIN;
  return {
    y: clamp(target.y, radius + TARGET_MARGIN, FIELD.goalHeight - radius - TARGET_MARGIN),
    z: clamp(target.z, -halfW, halfW),
  };
}

/** 探索する変数 [左右の狙い, 高さ, 強さ, こする量] から、蹴り方の設定を作る */
type Decode = (x: readonly number[]) => KickPatch;

const SPIN_LIMIT = { min: 0.1, max: 0.75 };

function decoder(style: SpinStyle, direction: 1 | -1): Decode {
  return (x) => {
    const spin = clamp(x[3] ?? 0, SPIN_LIMIT.min, SPIN_LIMIT.max);
    const contact: KickPatch['contact'] =
      style === 'knuckle' ? [0, 0] : style === 'drive' ? [0, spin] : [direction * spin, -0.1];
    return {
      contact,
      aimDeg: clamp(x[0], SETUP_LIMITS.aimDeg.min, SETUP_LIMITS.aimDeg.max),
      elevationDeg: clamp(x[1], SETUP_LIMITS.elevationDeg.min, SETUP_LIMITS.elevationDeg.max),
      power: clamp(x[2], SETUP_LIMITS.power.min, SETUP_LIMITS.power.max),
    };
  };
}

/** 変数が操作できる範囲からどれだけはみ出したか */
function overflow(x: readonly number[]): number {
  const beyond = (v: number, lo: number, hi: number): number => Math.max(0, lo - v, v - hi);
  return (
    beyond(x[0], SETUP_LIMITS.aimDeg.min, SETUP_LIMITS.aimDeg.max) / 5 +
    beyond(x[1], SETUP_LIMITS.elevationDeg.min, SETUP_LIMITS.elevationDeg.max) / 5 +
    beyond(x[2], SETUP_LIMITS.power.min, SETUP_LIMITS.power.max) * 5 +
    (x.length > 3 ? beyond(x[3], SPIN_LIMIT.min, SPIN_LIMIT.max) * 3 : 0)
  );
}

/** 軌道が壁にどれだけ食い込むか [m]（余裕 WALL_MARGIN を含む。当たらなければ 0） */
function wallIntrusion(tr: Trajectory, players: readonly WallPlayer[], setup: KickSetup, radius: number): number {
  let worst = 0;
  for (let i = 0; i < tr.count; i++) {
    const x = tr.pos[i * 3], z = tr.pos[i * 3 + 2];
    const lift = jumpHeight(tr.t[i], setup.wall);
    for (const player of players) {
      if (Math.hypot(x - player.x, z - player.z) > WALL.radius + radius + WALL_MARGIN + 0.2) continue;
      const contact = sphereCapsuleContact(
        [x, tr.pos[i * 3 + 1], z],
        radius + WALL_MARGIN,
        wallCapsule(player, lift),
      );
      if (contact) worst = Math.max(worst, contact.depth);
    }
  }
  return worst;
}

/** GK が反応した瞬間に、等速直線で読むゴールライン上の横位置 */
function firstRead(tr: Trajectory, reactionTime: number): number {
  const i = Math.min(tr.count - 1, tr.t.findIndex((t) => t >= reactionTime));
  if (i < 0 || tr.vel[i * 3] < 1) return tr.final.position[2];
  const remaining = -tr.pos[i * 3] / tr.vel[i * 3];
  return tr.pos[i * 3 + 2] + tr.vel[i * 3 + 2] * remaining;
}

interface Scored {
  readonly cost: number;
  readonly miss: number;
  readonly intrusion: number;
  readonly path: Float32Array;
}

export function solveKick(request: InverseRequest, params: PhysicsParams): InverseSolution {
  const { setup, style } = request;
  const target = clampTarget(request.target, params.radius);
  const players = wallPlayers(setup.spot, setup.wall);
  const reaction = KEEPER_LEVELS[setup.keeper === 'none' ? 'normal' : setup.keeper].reactionTime;
  const distance = Math.hypot(setup.spot.x, setup.spot.z);
  // ゴール中央への向きを 0 としたときの、狙う点の方位角 [度]
  const bearing =
    ((Math.atan2(target.z - setup.spot.z, -setup.spot.x) - Math.atan2(-setup.spot.z, -setup.spot.x)) * 180) /
    Math.PI;
  const candidates: Float32Array[] = [];
  let evaluations = 0;

  const score = (patch: KickPatch, x: readonly number[]): Scored => {
    const tr = simulate(toKickState({ ...setup, ...patch }, params), params, {
      seed: setup.seed,
      stopAtX: 0,
      sampleEvery: 3,
    });
    const [fx, fy, fz] = tr.final.position;
    const path = Float32Array.from(tr.pos.filter((_, i) => Math.floor(i / 3) % 6 === 0));
    const intrusion = wallIntrusion(tr, players, setup, params.radius);
    const bounds = overflow(x);
    if (fx < 0) {
      // ゴールラインに届く前に落ちた
      return { cost: NOT_REACHED + fx * fx + WEIGHT.bounds * bounds * bounds, miss: Infinity, intrusion, path };
    }
    const miss = Math.hypot(fy - target.y, fz - target.z);
    const deception = Math.min(3, Math.abs(firstRead(tr, reaction) - target.z));
    const spin = x.length > 3 ? x[3] - NATURAL_SPIN : 0;
    const cost =
      miss * miss +
      WEIGHT.wall * intrusion * intrusion +
      WEIGHT.bounds * bounds * bounds +
      WEIGHT.time * tr.final.t -
      WEIGHT.deception * deception +
      WEIGHT.spin * spin * spin;
    return { cost, miss, intrusion, path };
  };

  /** 1 つの曲げ方（右曲がり・左曲がり）について探索する */
  const search = (direction: 1 | -1): { patch: KickPatch; scored: Scored } => {
    const decode = decoder(style, direction);
    // 曲げる向きと逆へ打ち出すところから始める
    const lead = style === 'curve' ? direction * 6 : 0;
    const start = [bearing + lead, 12 + distance * 0.12, 0.8, ...(style === 'knuckle' ? [] : [0.4])];
    const steps = [3, 3, 0.08, ...(style === 'knuckle' ? [] : [0.12])];
    const result = minimize((x) => score(decode(x), x).cost, start, steps, {
      maxEvaluations: 260,
      tolerance: 1e-6,
      onEvaluate: (x) => {
        evaluations++;
        // 表示用に、試した軌道を間引いて残す
        if (evaluations % 5 === 0 && candidates.length < MAX_CANDIDATES) {
          candidates.push(score(decode(x), x).path);
        }
      },
    });
    const patch = decode(result.x);
    return { patch, scored: score(patch, result.x) };
  };

  const directions: ReadonlyArray<1 | -1> =
    style !== 'curve' ? [1] : request.curveDirection ? [request.curveDirection] : [1, -1];
  const runs = directions.map(search);
  const best = runs.reduce((a, b) => (b.scored.cost < a.scored.cost ? b : a));
  return {
    patch: best.patch,
    miss: best.scored.miss,
    clearsWall: best.scored.intrusion === 0,
    evaluations,
    candidates,
  };
}
