import { describe, expect, it } from 'vitest';
import { ICOSAHEDRON_FACE_CENTERS, ICOSAHEDRON_VERTICES, panelAt } from '../../src/scene/ballPattern.ts';

describe('ボールのパネル模様（切頂二十面体）', () => {
  it('頂点 12 個、面 20 個、どれも単位ベクトル', () => {
    expect(ICOSAHEDRON_VERTICES).toHaveLength(12);
    expect(ICOSAHEDRON_FACE_CENTERS).toHaveLength(20);
    for (const v of [...ICOSAHEDRON_VERTICES, ...ICOSAHEDRON_FACE_CENTERS]) {
      expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    }
  });
  it('正二十面体の頂点の方向は五角形', () => {
    for (const v of ICOSAHEDRON_VERTICES) {
      const panel = panelAt(v);
      expect(panel.kind).toBe('pentagon');
      expect(panel.edgeDistance).toBeGreaterThan(0.05);
    }
  });
  it('正二十面体の面の中心の方向は六角形', () => {
    for (const c of ICOSAHEDRON_FACE_CENTERS) expect(panelAt(c).kind).toBe('hexagon');
  });
  it('五角形と六角形の境目では edgeDistance がゼロに近い', () => {
    // 五角形の内接円の角半径は約 16.47°
    const [v] = ICOSAHEDRON_VERTICES;
    const [c] = [...ICOSAHEDRON_FACE_CENTERS].sort(
      (a, b) => Math.hypot(a[0] - v[0], a[1] - v[1], a[2] - v[2]) - Math.hypot(b[0] - v[0], b[1] - v[1], b[2] - v[2]),
    );
    const total = Math.acos(v[0] * c[0] + v[1] * c[1] + v[2] * c[2]);
    const k = ((16.47 * Math.PI) / 180) / total;
    const mix = [0, 1, 2].map((a) => v[a] * (1 - k) + c[a] * k);
    const n = Math.hypot(mix[0], mix[1], mix[2]);
    const dir = [mix[0] / n, mix[1] / n, mix[2] / n] as const;
    expect(panelAt(dir).edgeDistance).toBeLessThan(0.01);
  });
  it('五角形は球面の 2〜3 割を占める', () => {
    let pentagons = 0;
    const count = 20000;
    for (let i = 0; i < count; i++) {
      // フィボナッチ格子で球面を一様に見る
      const y = 1 - (2 * (i + 0.5)) / count;
      const r = Math.sqrt(1 - y * y);
      const phi = i * Math.PI * (3 - Math.sqrt(5));
      if (panelAt([r * Math.cos(phi), y, r * Math.sin(phi)]).kind === 'pentagon') pentagons++;
    }
    expect(pentagons / count).toBeGreaterThan(0.2);
    expect(pentagons / count).toBeLessThan(0.3);
  });
});
