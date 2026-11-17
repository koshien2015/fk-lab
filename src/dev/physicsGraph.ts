/**
 * マイルストーン 1 の確認ページ。代表的な蹴り方の軌道と係数を 2D グラフで見る。
 */
import { dragCoefficient, reynolds } from '../physics/aero.ts';
import { defaultParams } from '../physics/params.ts';
import { DEMO_KICKS } from '../physics/presets.ts';
import { simulate } from '../physics/simulate.ts';
import type { Trajectory } from '../physics/types.ts';
import { drawPlot, type PlotSpec, type Series } from './plot.ts';

const COLORS: Readonly<Record<string, string>> = {
  curve: '#ffb347',
  knuckle: '#5ad1ff',
  drive: '#ff6b8b',
  straight: '#8a97ad',
};
const GOAL_DISTANCE = 25;
const SEED = 7;

type Point = readonly [number, number];

/** 軌道から (横軸, 縦軸) の点列を作る */
function pointsOf(tr: Trajectory, pick: (i: number) => Point): Point[] {
  return Array.from({ length: tr.count }, (_, i) => pick(i));
}

const speedAt = (tr: Trajectory, i: number): number =>
  Math.hypot(tr.vel[i * 3], tr.vel[i * 3 + 1], tr.vel[i * 3 + 2]);

function buildPlots(): PlotSpec[] {
  const params = defaultParams();
  const runs = DEMO_KICKS.map((demo) => ({
    demo,
    color: COLORS[demo.id] ?? '#ffffff',
    tr: simulate(
      demo.kick,
      demo.id === 'straight' ? defaultParams({ knuckleCoefficient: 0 }) : params,
      { seed: SEED },
    ),
  }));
  const series = (pick: (tr: Trajectory, i: number) => Point): Series[] =>
    runs.map(({ tr, color }) => ({ color, points: pointsOf(tr, (i) => pick(tr, i)) }));

  const knuckle = DEMO_KICKS.find((d) => d.id === 'knuckle');
  if (!knuckle) throw new Error('ナックルのデモが見つかりません');
  const seedRuns: Series[] = Array.from({ length: 12 }, (_, seed) => {
    const tr = simulate(knuckle.kick, params, { seed });
    return {
      color: COLORS.knuckle,
      alpha: seed === SEED ? 1 : 0.35,
      width: seed === SEED ? 2.5 : 1.2,
      points: pointsOf(tr, (i) => [tr.pos[i * 3], tr.pos[i * 3 + 2]]),
    };
  });

  const cdCurve: Point[] = Array.from({ length: 141 }, (_, i) => {
    const v = i * 0.25;
    return [v, dragCoefficient(reynolds(v, params), params)];
  });

  return [
    {
      title: '横から見た軌道',
      note: 'ドライブ（赤）はトップスピンの下向きの力で急に落ちる。',
      xLabel: '前へ x [m]', yLabel: '高さ y [m]',
      xRange: [0, 36], yRange: [0, 4],
      series: series((tr, i) => [tr.pos[i * 3], tr.pos[i * 3 + 1]]),
      guides: [
        { axis: 'x', value: GOAL_DISTANCE, label: `${GOAL_DISTANCE} m` },
        { axis: 'y', value: 2.44, label: 'クロスバー 2.44 m' },
      ],
    },
    {
      title: '上から見た軌道（上が右）',
      note: 'カーブ（橙）は左へ出て右へ巻く。ナックル（水色）は不規則にずれる。',
      xLabel: '前へ x [m]', yLabel: '右へ z [m]',
      xRange: [0, 36], yRange: [-2, 4],
      series: series((tr, i) => [tr.pos[i * 3], tr.pos[i * 3 + 2]]),
      guides: [{ axis: 'x', value: GOAL_DISTANCE, label: `${GOAL_DISTANCE} m` }],
    },
    {
      title: 'ナックルの揺れ方（シード 12 通り）',
      note: '同じ蹴り方でも、渦の剥離の位相（シード）で揺れ方が変わる。同じシードなら同じ軌道。',
      xLabel: '前へ x [m]', yLabel: '右へ z [m]',
      xRange: [0, 30], yRange: [-1, 1],
      series: seedRuns,
      guides: [{ axis: 'x', value: GOAL_DISTANCE, label: `${GOAL_DISTANCE} m` }],
    },
    {
      title: '抗力係数 C_D と速さ（ドラッグクライシス）',
      note: '灰色の線が C_D(速さ)。各キックは右（速い）から左へ進む。減速して 20 m/s を切るあたりから抗力係数が上がり始める。',
      xLabel: '速さ [m/s]', yLabel: 'C_D',
      xRange: [0, 35], yRange: [0, 0.5],
      series: [
        { color: '#56657f', points: cdCurve, width: 6, alpha: 0.6 },
        ...runs.map(({ tr, color }) => ({
          color,
          points: pointsOf(tr, (i) => [speedAt(tr, i), tr.cd[i]]),
        })),
      ],
    },
    {
      title: '速さの変化',
      xLabel: '時間 [s]', yLabel: '速さ [m/s]',
      xRange: [0, 1.8], yRange: [15, 30],
      series: series((tr, i) => [tr.t[i], speedAt(tr, i)]),
    },
    {
      title: '横向きの力（マグヌス力 + ナックル横力の z 成分）',
      note: 'カーブはほぼ一定の向き、ナックルは向きが入れ替わる。',
      xLabel: '時間 [s]', yLabel: '力 [N]',
      xRange: [0, 1.8], yRange: [-2, 5],
      series: series((tr, i) => [
        tr.t[i],
        tr.forces.magnus[i * 3 + 2] + tr.forces.knuckle[i * 3 + 2],
      ]),
    },
  ];
}

function render(): void {
  const legend = document.getElementById('legend');
  const container = document.getElementById('plots');
  if (!legend || !container) throw new Error('ページの土台が見つかりません');

  legend.replaceChildren(
    ...DEMO_KICKS.map((demo) => {
      const item = document.createElement('li');
      const swatch = document.createElement('i');
      swatch.style.background = COLORS[demo.id] ?? '#ffffff';
      item.append(swatch, `${demo.label}：${demo.description}`);
      return item;
    }),
  );

  container.replaceChildren(
    ...buildPlots().map((spec) => {
      const figure = document.createElement('figure');
      const caption = document.createElement('figcaption');
      caption.textContent = spec.title;
      const canvas = document.createElement('canvas');
      figure.append(caption, canvas);
      if (spec.note) {
        const note = document.createElement('small');
        note.textContent = spec.note;
        figure.append(note);
      }
      queueMicrotask(() => drawPlot(canvas, spec));
      return figure;
    }),
  );
}

render();
window.addEventListener('resize', render);
