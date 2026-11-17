/**
 * 物理パラメータの定義。
 *
 * `assumed: true` は「実測で検証していない仮定値」を表す。
 * UI のラベルと README の一覧表はこの定義から作るので、
 * 仮定値を実測値のように見せないための唯一の出どころになる。
 */
export interface ParamDef {
  readonly value: number;
  readonly unit: string;
  readonly label: string;
  /** 仮定値なら true（規格値・物性値なら false） */
  readonly assumed: boolean;
  readonly note: string;
  /** UI のスライダーで動かせる範囲 */
  readonly min: number;
  readonly max: number;
}

export const PARAM_DEFS = {
  mass: {
    value: 0.43, unit: 'kg', label: 'ボールの質量', assumed: false,
    note: 'FIFA 規定 0.41〜0.45 kg', min: 0.41, max: 0.45,
  },
  radius: {
    value: 0.11, unit: 'm', label: 'ボールの半径', assumed: false,
    note: '周長 68〜70 cm', min: 0.108, max: 0.112,
  },
  airDensity: {
    value: 1.2, unit: 'kg/m³', label: '空気密度', assumed: false,
    note: '約 20℃・1 気圧', min: 0, max: 1.4,
  },
  kinematicViscosity: {
    value: 1.5e-5, unit: 'm²/s', label: '動粘性係数', assumed: false,
    note: '約 20℃の空気', min: 1.3e-5, max: 1.7e-5,
  },
  gravity: {
    value: 9.81, unit: 'm/s²', label: '重力加速度', assumed: false,
    note: '標準重力', min: 0, max: 20,
  },
  cdSubcritical: {
    value: 0.45, unit: '', label: '抗力係数（亜臨界）', assumed: true,
    note: '遅い球の C_D', min: 0.3, max: 0.6,
  },
  cdSupercritical: {
    value: 0.18, unit: '', label: '抗力係数（超臨界）', assumed: true,
    note: '速い球の C_D（0.15〜0.2）', min: 0.1, max: 0.3,
  },
  criticalReynolds: {
    value: 2.5e5, unit: '', label: '臨界レイノルズ数', assumed: true,
    note: 'ドラッグクライシスの中心（約 17 m/s）', min: 1.5e5, max: 4e5,
  },
  crisisWidth: {
    value: 4e4, unit: '', label: 'ドラッグクライシスの幅', assumed: true,
    note: 'シグモイドの幅（Re 単位）', min: 1e4, max: 1e5,
  },
  liftSaturation: {
    value: 0.5, unit: '', label: '揚力係数の上限 a', assumed: true,
    note: 'C_L = a·S/(b+S)', min: 0.2, max: 1.0,
  },
  liftHalfSpin: {
    value: 0.2, unit: '', label: '揚力係数の半飽和 b', assumed: true,
    note: 'S = b で C_L = a/2', min: 0.05, max: 0.6,
  },
  spinDecayCoefficient: {
    value: 0.05, unit: '', label: '回転の減衰係数', assumed: true,
    note: '空力トルク τ = −C·½ρA·R²·|v|·ω', min: 0, max: 0.3,
  },
  knuckleCoefficient: {
    value: 0.2, unit: '', label: 'ナックル横力係数（最大）', assumed: true,
    note: '無回転・超臨界での C_K の上限', min: 0, max: 0.4,
  },
  knuckleSpinThreshold: {
    value: 0.05, unit: '', label: 'ナックルが消える回転の閾値', assumed: true,
    note: 'S がこの値で半減、2 倍でゼロ', min: 0.01, max: 0.2,
  },
  knuckleSubcriticalRatio: {
    value: 0.2, unit: '', label: 'ナックル振幅の亜臨界比', assumed: true,
    note: '亜臨界域での振幅 ÷ 超臨界域での振幅', min: 0, max: 1,
  },
  strouhal: {
    value: 0.1, unit: '', label: 'ストローハル数 St', assumed: true,
    note: '代表周波数 f = St·|v|/(2R)', min: 0.02, max: 0.3,
  },
} as const satisfies Record<string, ParamDef>;

export type ParamKey = keyof typeof PARAM_DEFS;
export type PhysicsParams = Readonly<Record<ParamKey, number>>;

export function defaultParams(overrides: Partial<PhysicsParams> = {}): PhysicsParams {
  const base = Object.fromEntries(
    Object.entries(PARAM_DEFS).map(([key, def]) => [key, def.value]),
  ) as Record<ParamKey, number>;
  return { ...base, ...overrides };
}

/** 慣性モーメント。薄い球殻として近似する。 */
export function inertia(p: PhysicsParams): number {
  return (2 / 3) * p.mass * p.radius * p.radius;
}

/** 進行方向から見た断面積 A = πR² */
export function crossSection(p: PhysicsParams): number {
  return Math.PI * p.radius * p.radius;
}
