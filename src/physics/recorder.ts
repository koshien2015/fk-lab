/**
 * シミュレーションの途中経過を、後から再生・可視化できる形で貯める。
 */
import type { ForceKey, Trajectory, Vec3 } from './types.ts';

const FORCE_ORDER: readonly ForceKey[] = ['gravity', 'drag', 'magnus', 'knuckle'];

export interface Recorder {
  /** 状態 y とそのときの力 f を 1 点として記録し、その番号を返す */
  record(time: number, y: Float64Array, f: Float64Array): number;
  /** 力ごとの寄与を 1 ステップぶん積む（台形則） */
  accumulate(fPrev: Float64Array, fNow: Float64Array): void;
  finish(time: number, y: Float64Array): Trajectory;
}

export function createRecorder(capacity: number, dt: number, mass: number): Recorder {
  const t = new Float64Array(capacity);
  const pos = new Float64Array(capacity * 3), vel = new Float64Array(capacity * 3);
  const omega = new Float64Array(capacity * 3), quat = new Float64Array(capacity * 4);
  const force = new Float64Array(capacity * 12);
  const re = new Float64Array(capacity), cd = new Float64Array(capacity);
  const spin = new Float64Array(capacity);
  // 力ごとの寄与: 速度への寄与と変位への寄与（4 つの力 × 3 軸）
  const velPart = new Float64Array(12), dispPart = new Float64Array(12);
  let count = 0;

  const forceOf = (index: number): Float64Array => {
    const out = new Float64Array(count * 3);
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 3; a++) out[i * 3 + a] = force[i * 12 + index * 3 + a];
    }
    return out;
  };
  const vec3At = (arr: Float64Array, offset: number): Vec3 => [
    arr[offset],
    arr[offset + 1],
    arr[offset + 2],
  ];
  const perForce = <T>(make: (index: number) => T): Record<ForceKey, T> =>
    Object.fromEntries(FORCE_ORDER.map((key, i) => [key, make(i)])) as Record<ForceKey, T>;

  return {
    record(time, y, f) {
      t[count] = time;
      for (let a = 0; a < 3; a++) {
        pos[count * 3 + a] = y[a];
        vel[count * 3 + a] = y[3 + a];
        omega[count * 3 + a] = y[6 + a];
      }
      for (let a = 0; a < 4; a++) quat[count * 4 + a] = y[9 + a];
      for (let a = 0; a < 12; a++) force[count * 12 + a] = f[a];
      re[count] = f[12];
      cd[count] = f[13];
      spin[count] = f[14];
      count++;
      return count - 1;
    },
    accumulate(fPrev, fNow) {
      // 力が 1 ステップ内で直線的に変わるなら厳密
      for (let j = 0; j < 12; j++) {
        const a0 = fPrev[j] / mass, a1 = fNow[j] / mass;
        dispPart[j] += velPart[j] * dt + (dt * dt * (2 * a0 + a1)) / 6;
        velPart[j] += 0.5 * (a0 + a1) * dt;
      }
    },
    finish(time, y) {
      return {
        dt,
        count,
        t: t.slice(0, count),
        pos: pos.slice(0, count * 3),
        vel: vel.slice(0, count * 3),
        omega: omega.slice(0, count * 3),
        quat: quat.slice(0, count * 4),
        forces: perForce(forceOf),
        re: re.slice(0, count),
        cd: cd.slice(0, count),
        spin: spin.slice(0, count),
        contributions: perForce((i) => vec3At(dispPart, i * 3)),
        final: {
          t: time,
          position: vec3At(y, 0),
          velocity: vec3At(y, 3),
          omega: vec3At(y, 6),
        },
      };
    },
  };
}
