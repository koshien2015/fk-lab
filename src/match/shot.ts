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
import { FRAME_CAPSULES, isInsideGoal } from './goalFrame.ts';
import {
  createKeeper,
  KEEPER_LEVELS,
  keeperCapsule,
  keeperLineX,
  keeperStartZ,
  type KeeperConfig,
  type KeeperLevel,
} from './keeper.ts';
import { createNetSim, getNetModel, NET } from './netCloth.ts';
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
  /** ボールがゴールラインに届いたら、そこで打ち切る（予測線用） */
  readonly stopAtGoalLine?: boolean;
}

export interface ShotResult {
  readonly trajectory: Trajectory;
  readonly outcome: ShotOutcome;
  readonly events: readonly ShotEvent[];
  /** 最初に何かに当たる（またはゴールラインを越える）までの時間 [s] */
  readonly flightTime: number;
  readonly wallPlayers: readonly WallPlayer[];
  /** ネットの動き。ボールがゴールに近づかなかったキックでは null。 */
  readonly net: NetMotion | null;
  /** GK の動き。軌道の記録点と同じ並び。 */
  readonly keeper: {
    readonly config: KeeperConfig | null;
    readonly z: Float64Array;
    readonly lean: Float64Array;
  };
}

/** ネットの節点の位置を、一定の間隔で記録したもの */
export interface NetMotion {
  /** 記録を始めた時刻と、記録の間隔 [s] */
  readonly startTime: number;
  readonly frameDt: number;
  readonly nodeCount: number;
  /** 1 コマあたり nodeCount × 3 要素（x, y, z の並び） */
  readonly frames: Float32Array;
}

/** ネットを何ステップごとに記録するか（網の刻み 2 ms で 約 60 コマ/秒） */
const NET_FRAME_STEPS = 8;
/** ネットに触れていない時間がこれだけ続いたら、次の接触を新しい出来事として数える [s] */
const NET_CONTACT_GAP = 0.3;
/** 同じ種類の出来事を続けて記録しない間隔 [s] */
const EVENT_GAP = 0.08;
/** これより遅い接触は出来事として記録しない [m/s] */
const EVENT_SPEED = 0.8;
/** ゴール後・アウト後に、ボールの行方を見せておく時間 [s] */
const AFTER_GOAL = 2.0;
const AFTER_OUT = 0.7;
const AFTER_SAVE = 1.0;
/** 止まったとみなす速さ [m/s] */
const STOPPED_SPEED = 0.25;
const MAX_TIME = 8;
/** GK が弾いた球の、前へ向かう速さの割合（当たる前のゴール方向の速さに対して） */
const PARRY = 0.3;
/** 弾いた球が前へ向かう速さの下限 [m/s]（ゴールライン上にこぼれないように） */
const PARRY_MIN_SPEED = 1.5;

function isOutOfPlay(c: Vec3, radius: number): boolean {
  return (c[0] > radius && !isInsideGoal(c, radius)) || Math.abs(c[2]) > FIELD.width / 2 + radius;
}

function judge(events: readonly ShotEvent[], hasKeeper: boolean): ShotOutcome {
  const has = (kind: ShotEventKind): boolean => events.some((event) => event.kind === kind);
  if (has('goal')) return 'goal';
  if (has('keeper')) return 'save';
  if (has('post')) return 'post';
  if (has('wall')) return 'wall';
  if (has('out')) return 'out';
  // 何にも当たらずにピッチの中で止まった球は、GK がいれば拾う。いなければ枠に届かなかった扱い。
  return hasKeeper ? 'save' : 'out';
}

/** 記録したコマを 1 本の配列にまとめる */
function packNet(startTime: number, frameDt: number, frames: readonly Float32Array[]): NetMotion {
  const size = frames[0]?.length ?? 0;
  const packed = new Float32Array(size * frames.length);
  frames.forEach((frame, i) => packed.set(frame, i * size));
  return { startTime, frameDt, nodeCount: size / 3, frames: packed };
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

  const players = wallPlayers(scenario.spot, scenario.wall);
  const config = scenario.keeper === 'none' ? null : KEEPER_LEVELS[scenario.keeper];
  const lineX = keeperLineX(scenario.spot);
  const keeper = config
    ? createKeeper(config, keeperStartZ(scenario.spot, players.length > 0), scenario.seed, lineX)
    : null;
  const dt = options.dt ?? 0.001;

  const events: ShotEvent[] = [];
  const lastAt = new Map<ShotEventKind, number>();
  const keeperZ: number[] = [];
  const keeperLean: number[] = [];
  let goalAt: number | null = null;
  let flightEnd: number | null = null;
  let savedAt: number | null = null;
  let outAt: number | null = null;

  const note = (kind: ShotEventKind, time: number, y: Float64Array, speed: number): void => {
    if (time - (lastAt.get(kind) ?? -Infinity) < EVENT_GAP) return;
    lastAt.set(kind, time);
    events.push({ t: time, kind, position: [y[0], y[1], y[2]], speed });
  };

  /** カプセルの並びとの衝突。当たったら出来事を記録し、true を返す。 */
  const hitCapsules = (
    y: Float64Array,
    time: number,
    capsules: readonly Capsule[],
    surface: Surface,
    kind: ShotEventKind,
  ): boolean => {
    let touched = false;
    for (const capsule of capsules) {
      const contact = sphereCapsuleContact([y[0], y[1], y[2]], R, capsule);
      if (!contact) continue;
      touched = true;
      const impact = applyContact(y, contact, surface, params);
      if (impact > EVENT_SPEED) note(kind, time, y, impact);
    }
    return touched;
  };

  /** 地面に触れたら true（転がっているだけの接触も含む） */
  const hitGround = (y: Float64Array, time: number): boolean => {
    if (y[1] >= R) return false;
    const impact = applyContact(y, { normal: [0, 1, 0], depth: R - y[1] }, ground, params);
    if (impact > EVENT_SPEED) note('ground', time, y, impact);
    if (impact >= REST_SPEED) return true;
    // 転がっている間は、転がり抵抗で減速する
    const speed = Math.hypot(y[3], y[5]);
    if (speed <= 0) return true;
    const keep = Math.max(0, speed - params.rollingResistance * params.gravity * dt) / speed;
    y[3] *= keep;
    y[5] *= keep;
    y[6] *= keep;
    y[7] *= keep;
    y[8] *= keep;
    return true;
  };

  // ネットは、ボールがゴールに近づいてから計算を始める（近づかないキックでは計算しない）
  let netSim: ReturnType<typeof createNetSim> | null = null;
  let netStart = 0;
  let netSteps = 0;
  let netClock = 0;
  let netTouchedAt = -Infinity;
  const netFrames: Float32Array[] = [];

  const hitNet = (y: Float64Array, time: number): void => {
    if (!netSim) {
      const close = y[0] > -1.5 && Math.abs(y[2]) < FIELD.goalWidth / 2 + 2 && y[1] < FIELD.goalHeight + 1.5;
      if (!close) return;
      netSim = createNetSim(getNetModel(), params);
      netStart = time;
    }
    // 網はボールより粗い刻みで進める
    netClock += dt;
    if (netClock < NET.dt - 1e-9) return;
    netClock = 0;
    if (netSteps % NET_FRAME_STEPS === 0) netFrames.push(Float32Array.from(netSim.positions));
    netSteps++;
    const speed = Math.hypot(y[3], y[4], y[5]);
    if (netSim.step(NET.dt, y) <= 0) return;
    if (time - netTouchedAt > NET_CONTACT_GAP && speed > EVENT_SPEED) note('net', time, y, speed);
    netTouchedAt = time;
  };

  const afterStep = (y: Float64Array, time: number, control: StepControl): boolean => {
    keeper?.step(time, y, dt);
    const before = events.length;

    // 蹴った直後の地面との接触は除く（置いたボールは最初から地面に触れている）
    const grounded = hitGround(y, time) && time > 0.05;
    if (y[0] > -1) hitCapsules(y, time, FRAME_CAPSULES, frame, 'post');
    hitNet(y, time);
    if (players.length > 0) {
      const lift = jumpHeight(time, scenario.wall);
      hitCapsules(y, time, players.map((player) => wallCapsule(player, lift)), body, 'wall');
    }
    if (keeper && Math.abs(y[0] - lineX) < 1) {
      const touched = hitCapsules(y, time, [keeperCapsule(keeper.pose(), lineX)], body, 'keeper');
      // GK は当たった球をゴールの外（前）へ弾く。体の横に当たってゴールへ押し込むことはない。
      if (touched) {
        keeper.stop();
        savedAt ??= time;
        if (y[3] > -PARRY_MIN_SPEED) y[3] = -Math.max(PARRY_MIN_SPEED, PARRY * Math.abs(y[3]));
      }
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
    // 何かに当たったら（転がり始めた場合も含めて）、そこから先は飛翔として数えない
    if (events.length > before || grounded) {
      control.freezeContributions();
      flightEnd ??= time;
    }
    if (scenario.stopAtGoalLine && y[0] >= R) return true;

    if (goalAt !== null) return time > goalAt + AFTER_GOAL;
    if (outAt !== null) return time > outAt + AFTER_OUT;
    // GK が弾いた球は、こぼれ球を押さえたものとして、少し見せてから終える
    if (savedAt !== null) return time > savedAt + AFTER_SAVE;
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
    outcome: judge(events, config !== null),
    events,
    flightTime: flightEnd ?? trajectory.final.t,
    net: netSim ? packNet(netStart, NET.dt * NET_FRAME_STEPS, netFrames) : null,
    wallPlayers: players,
    keeper: { config, z: Float64Array.from(keeperZ), lean: Float64Array.from(keeperLean) },
  };
}
