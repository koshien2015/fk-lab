/**
 * 1 本のキックの全体（飛翔 + 地面・ゴール・壁・GK との衝突 + 判定）。
 */
import { FIELD } from '../field/dimensions.ts';
import type { Spot } from '../field/placement.ts';
import type { PhysicsParams } from '../physics/params.ts';
import { integrate, type StepControl } from '../physics/simulate.ts';
import type { KickState, SimOptions, Trajectory, Vec3 } from '../physics/types.ts';
import { applyContact, REST_SPEED, type Surface } from './contact.ts';
import { sphereCapsuleContact, type Capsule } from './geometry.ts';
import { FRAME_CAPSULES, isInsideGoal, netContact } from './goalFrame.ts';
import {
  createKeeper,
  KEEPER,
  KEEPER_LEVELS,
  keeperCapsule,
  keeperStartZ,
  type KeeperConfig,
  type KeeperLevel,
} from './keeper.ts';
import { jumpHeight, wallCapsule, wallPlayers, type WallPlayer, type WallSetup } from './wall.ts';

export type ShotOutcome = 'goal' | 'save' | 'post' | 'out' | 'wall';
export type ShotEventKind = 'ground' | 'post' | 'wall' | 'keeper' | 'net' | 'goal' | 'out';

export interface ShotEvent {
  readonly t: number;
  readonly kind: ShotEventKind;
  readonly position: Vec3;
  /** ぶつかった速さ [m/s]（goal と out ではボールの速さ） */
  readonly speed: number;
}

export interface ShotScenario {
  readonly spot: Spot;
  readonly wall: WallSetup;
  readonly keeper: KeeperLevel | 'none';
  readonly seed: number;
}

export interface ShotResult {
  readonly trajectory: Trajectory;
  readonly outcome: ShotOutcome;
  readonly events: readonly ShotEvent[];
  /** 最初に何かに当たる（またはゴールラインを越える）までの時間 [s] */
  readonly flightTime: number;
  readonly wallPlayers: readonly WallPlayer[];
  /** GK の動き。軌道の記録点と同じ並び。 */
  readonly keeper: {
    readonly config: KeeperConfig | null;
    readonly z: Float64Array;
    readonly lean: Float64Array;
  };
}

/** 同じ種類の出来事を続けて記録しない間隔 [s] */
const EVENT_GAP = 0.08;
/** これより遅い接触は出来事として記録しない [m/s] */
const EVENT_SPEED = 0.8;
/** ゴール後・アウト後に、ボールの行方を見せておく時間 [s] */
const AFTER_GOAL = 1.6;
const AFTER_OUT = 0.7;
/** 止まったとみなす速さ [m/s] */
const STOPPED_SPEED = 0.25;
/** ネットに触れている間、1 ステップごとに勢いを削る割合 */
const NET_DAMPING = 0.92;
const MAX_TIME = 8;

function isOutOfPlay(c: Vec3, radius: number): boolean {
  return (c[0] > radius && !isInsideGoal(c, radius)) || Math.abs(c[2]) > FIELD.width / 2 + radius;
}

function judge(events: readonly ShotEvent[]): ShotOutcome {
  const has = (kind: ShotEventKind): boolean => events.some((event) => event.kind === kind);
  if (has('goal')) return 'goal';
  if (has('keeper')) return 'save';
  if (has('post')) return 'post';
  if (has('wall')) return 'wall';
  // 何にも当たらずにピッチの中で止まった球は、GK が拾う
  return has('out') ? 'out' : 'save';
}

export function simulateShot(
  kick: KickState,
  params: PhysicsParams,
  scenario: ShotScenario,
  options: SimOptions = {},
): ShotResult {
  const R = params.radius;
  const ground: Surface = { restitution: params.groundRestitution, friction: params.groundFriction };
  const frame: Surface = { restitution: params.postRestitution, friction: params.postFriction };
  const body: Surface = { restitution: params.bodyRestitution, friction: params.bodyFriction };
  const net: Surface = { restitution: params.netRestitution, friction: 0 };

  const players = wallPlayers(scenario.spot, scenario.wall);
  const config = scenario.keeper === 'none' ? null : KEEPER_LEVELS[scenario.keeper];
  const keeper = config
    ? createKeeper(config, keeperStartZ(scenario.spot, players.length > 0), scenario.seed)
    : null;
  const dt = options.dt ?? 0.001;

  const events: ShotEvent[] = [];
  const lastAt = new Map<ShotEventKind, number>();
  const keeperZ: number[] = [];
  const keeperLean: number[] = [];
  let goalAt: number | null = null;
  let outAt: number | null = null;

  const note = (kind: ShotEventKind, time: number, y: Float64Array, speed: number): void => {
    if (time - (lastAt.get(kind) ?? -Infinity) < EVENT_GAP) return;
    lastAt.set(kind, time);
    events.push({ t: time, kind, position: [y[0], y[1], y[2]], speed });
  };

  /** カプセルの並びとの衝突。当たったら出来事を記録する。 */
  const hitCapsules = (
    y: Float64Array,
    time: number,
    capsules: readonly Capsule[],
    surface: Surface,
    kind: ShotEventKind,
  ): void => {
    for (const capsule of capsules) {
      const contact = sphereCapsuleContact([y[0], y[1], y[2]], R, capsule);
      if (!contact) continue;
      const impact = applyContact(y, contact, surface, params);
      if (impact > EVENT_SPEED) note(kind, time, y, impact);
    }
  };

  const hitGround = (y: Float64Array, time: number): void => {
    if (y[1] >= R) return;
    const impact = applyContact(y, { normal: [0, 1, 0], depth: R - y[1] }, ground, params);
    if (impact > EVENT_SPEED) note('ground', time, y, impact);
    if (impact >= REST_SPEED) return;
    // 転がっている間は、転がり抵抗で減速する
    const speed = Math.hypot(y[3], y[5]);
    if (speed <= 0) return;
    const keep = Math.max(0, speed - params.rollingResistance * params.gravity * dt) / speed;
    y[3] *= keep;
    y[5] *= keep;
    y[6] *= keep;
    y[7] *= keep;
    y[8] *= keep;
  };

  const hitNet = (y: Float64Array, time: number): void => {
    const contact = netContact([y[0], y[1], y[2]], R);
    if (!contact) return;
    const impact = applyContact(y, contact, net, params);
    if (impact > EVENT_SPEED) note('net', time, y, impact);
    for (let i = 3; i < 9; i++) y[i] *= NET_DAMPING;
  };

  const afterStep = (y: Float64Array, time: number, control: StepControl): boolean => {
    keeper?.step(time, y, dt);
    const before = events.length;

    hitGround(y, time);
    if (y[0] > -1) hitCapsules(y, time, FRAME_CAPSULES, frame, 'post');
    if (y[0] > -R) hitNet(y, time);
    if (players.length > 0) {
      const lift = jumpHeight(time, scenario.wall);
      hitCapsules(y, time, players.map((player) => wallCapsule(player, lift)), body, 'wall');
    }
    if (keeper && Math.abs(y[0] - KEEPER.lineX) < 1) {
      hitCapsules(y, time, [keeperCapsule(keeper.pose())], body, 'keeper');
    }

    const center: Vec3 = [y[0], y[1], y[2]];
    const speed = Math.hypot(y[3], y[4], y[5]);
    if (goalAt === null && outAt === null) {
      if (isInsideGoal(center, R)) {
        goalAt = time;
        note('goal', time, y, speed);
      } else if (isOutOfPlay(center, R)) {
        outAt = time;
        note('out', time, y, speed);
      }
    }
    if (events.length > before) control.freezeContributions();

    if (goalAt !== null) return time > goalAt + AFTER_GOAL;
    if (outAt !== null) return time > outAt + AFTER_OUT;
    return y[1] <= R + 1e-3 && speed < STOPPED_SPEED;
  };

  const trajectory = integrate(kick, params, { maxTime: MAX_TIME, ...options, seed: scenario.seed }, {
    afterStep,
    onSample: () => {
      const pose = keeper?.pose() ?? { z: 0, lean: 0 };
      keeperZ.push(pose.z);
      keeperLean.push(pose.lean);
    },
  });

  return {
    trajectory,
    outcome: judge(events),
    events,
    flightTime: events[0]?.t ?? trajectory.final.t,
    wallPlayers: players,
    keeper: { config, z: Float64Array.from(keeperZ), lean: Float64Array.from(keeperLean) },
  };
}
