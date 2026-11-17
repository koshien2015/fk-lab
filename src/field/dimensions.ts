/**
 * ピッチとゴールの寸法 [m]（FIFA 規格）。
 *
 * 世界座標: 攻めるゴールのゴールライン中央の地面を原点とし、
 * x = ゴール方向（ピッチは x ≤ 0 の側）, y = 上, z = キッカーから見て右。
 */
export const FIELD = {
  length: 105,
  width: 68,
  lineWidth: 0.12,
  goalWidth: 7.32,
  goalHeight: 2.44,
  /** ポストとクロスバーの半径（直径 12 cm） */
  postRadius: 0.06,
  /** ネットの奥行き（規格に定めがないので一般的な値。地面側と上側） */
  goalDepthBottom: 2.0,
  goalDepthTop: 0.9,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  /** ペナルティアーク、センターサークル、壁までの距離 */
  circleRadius: 9.15,
  cornerArcRadius: 1,
} as const;
