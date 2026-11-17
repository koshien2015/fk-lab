/**
 * 空力係数。すべて状態を持たない純粋関数。
 * 係数の形（シグモイド、飽和関数）と値は仮定であり、実測の当てはめではない。
 */
import type { PhysicsParams } from './params.ts';

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** レイノルズ数 Re = |v|·2R/ν */
export function reynolds(speed: number, p: PhysicsParams): number {
  return (speed * 2 * p.radius) / p.kinematicViscosity;
}

/** 超臨界域にどれだけ入っているか（0 = 亜臨界, 1 = 超臨界） */
export function supercriticalFraction(re: number, p: PhysicsParams): number {
  return sigmoid((re - p.criticalReynolds) / p.crisisWidth);
}

/**
 * 抗力係数 C_D(Re)。臨界レイノルズ数の付近で急に下がる（ドラッグクライシス）。
 * 球が減速してここを逆向きに通ると、抗力係数が跳ね上がって「落ちる」。
 */
export function dragCoefficient(re: number, p: PhysicsParams): number {
  const s = supercriticalFraction(re, p);
  return p.cdSubcritical + (p.cdSupercritical - p.cdSubcritical) * s;
}

/** スピンパラメータ S = R·|ω|/|v|（表面の周速 ÷ 飛ぶ速さ） */
export function spinParameter(speed: number, omegaMag: number, p: PhysicsParams): number {
  return speed > 1e-9 ? (p.radius * omegaMag) / speed : 0;
}

/** 揚力係数 C_L(S) = a·S/(b+S)。単調に増えて a で飽和する。 */
export function liftCoefficient(s: number, p: PhysicsParams): number {
  return (p.liftSaturation * s) / (p.liftHalfSpin + s);
}

/**
 * ナックル横力係数の振幅。
 * 回転が小さいほど大きく、S が閾値の 2 倍に達するとゼロになる。
 * 超臨界域で大きく、亜臨界域で小さい。
 */
export function knuckleAmplitude(s: number, re: number, p: PhysicsParams): number {
  const spinGate = 1 - smoothstep(0, 2 * p.knuckleSpinThreshold, s);
  if (spinGate === 0) return 0;
  const ratio = p.knuckleSubcriticalRatio;
  const reGate = ratio + (1 - ratio) * supercriticalFraction(re, p);
  return p.knuckleCoefficient * spinGate * reGate;
}
