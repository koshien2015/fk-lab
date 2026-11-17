export type Vec3 = readonly [number, number, number];

/** 蹴った直後の状態 */
export interface KickState {
  readonly position: Vec3;
  /** [m/s] */
  readonly velocity: Vec3;
  /** 角速度 [rad/s]（世界座標） */
  readonly omega: Vec3;
}

export interface SimOptions {
  /** 積分の刻み [s]。結果を決定的にするため固定。 */
  readonly dt?: number;
  readonly maxTime?: number;
  /** 何ステップごとに記録するか */
  readonly sampleEvery?: number;
  /** ナックルの揺れ方を決めるシード */
  readonly seed?: number;
  /** 地面（y = R）まで落ちたら止める */
  readonly stopAtGround?: boolean;
}

export type ForceKey = 'gravity' | 'drag' | 'magnus' | 'knuckle';

export interface Trajectory {
  readonly dt: number;
  /** 記録した点の数 */
  readonly count: number;
  readonly t: Float64Array;
  /** 以下は 1 点あたり 3 要素（quat は 4 要素 x,y,z,w） */
  readonly pos: Float64Array;
  readonly vel: Float64Array;
  readonly omega: Float64Array;
  readonly quat: Float64Array;
  /** 力 [N]。1 点あたり 3 要素。 */
  readonly forces: Readonly<Record<ForceKey, Float64Array>>;
  readonly re: Float64Array;
  readonly cd: Float64Array;
  /** スピンパラメータ S */
  readonly spin: Float64Array;
  /** それぞれの力が最終的な変位をどれだけ動かしたか [m]（力 ÷ 質量の 2 重積分） */
  readonly contributions: Readonly<Record<ForceKey, Vec3>>;
  readonly final: {
    readonly t: number;
    readonly position: Vec3;
    readonly velocity: Vec3;
    readonly omega: Vec3;
  };
}
