/**
 * 物理コアの確認用の、最小限の折れ線グラフ（Canvas 2D）。
 */
export interface Series {
  readonly color: string;
  readonly points: ReadonlyArray<readonly [number, number]>;
  readonly width?: number;
  readonly alpha?: number;
}

export interface PlotSpec {
  readonly title: string;
  readonly note?: string;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number];
  readonly series: readonly Series[];
  /** 目印として引く縦線・横線 */
  readonly guides?: ReadonlyArray<{ readonly axis: 'x' | 'y'; readonly value: number; readonly label: string }>;
}

const MARGIN = { left: 46, right: 12, top: 10, bottom: 34 };
const GRID = '#22304a';
const TEXT = '#9fb0c8';

/** きりのよい目盛りの間隔を返す */
function niceStep(span: number, target: number): number {
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10) * pow;
}

function ticks([lo, hi]: readonly [number, number], target: number): number[] {
  const step = niceStep(hi - lo, target);
  const first = Math.ceil(lo / step - 1e-9) * step;
  const count = Math.floor((hi - first) / step + 1e-9) + 1;
  return Array.from({ length: count }, (_, i) => first + i * step);
}

const tickLabel = (v: number): string =>
  Math.abs(v) >= 100 ? v.toFixed(0) : String(Number(v.toFixed(2)));

export function drawPlot(canvas: HTMLCanvasElement, spec: PlotSpec): void {
  const dpr = window.devicePixelRatio || 1;
  const { width: w, height: h } = canvas.getBoundingClientRect();
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D が使えません');
  ctx.scale(dpr, dpr);

  const plotW = w - MARGIN.left - MARGIN.right;
  const plotH = h - MARGIN.top - MARGIN.bottom;
  const sx = (x: number): number =>
    MARGIN.left + ((x - spec.xRange[0]) / (spec.xRange[1] - spec.xRange[0])) * plotW;
  const sy = (y: number): number =>
    MARGIN.top + plotH - ((y - spec.yRange[0]) / (spec.yRange[1] - spec.yRange[0])) * plotH;

  ctx.font = '11px system-ui, sans-serif';
  ctx.lineWidth = 1;
  ctx.strokeStyle = GRID;
  ctx.fillStyle = TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const x of ticks(spec.xRange, 6)) {
    ctx.beginPath();
    ctx.moveTo(sx(x), MARGIN.top);
    ctx.lineTo(sx(x), MARGIN.top + plotH);
    ctx.stroke();
    ctx.fillText(tickLabel(x), sx(x), MARGIN.top + plotH + 4);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const y of ticks(spec.yRange, 5)) {
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, sy(y));
    ctx.lineTo(MARGIN.left + plotW, sy(y));
    ctx.stroke();
    ctx.fillText(tickLabel(y), MARGIN.left - 6, sy(y));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(spec.xLabel, MARGIN.left + plotW / 2, h - 2);
  ctx.save();
  ctx.translate(11, MARGIN.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.yLabel, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#5b6f90';
  ctx.textBaseline = 'top';
  for (const guide of spec.guides ?? []) {
    ctx.beginPath();
    if (guide.axis === 'x') {
      ctx.moveTo(sx(guide.value), MARGIN.top);
      ctx.lineTo(sx(guide.value), MARGIN.top + plotH);
      ctx.textAlign = 'right';
      ctx.fillText(guide.label, sx(guide.value) - 4, MARGIN.top + 2);
    } else {
      ctx.moveTo(MARGIN.left, sy(guide.value));
      ctx.lineTo(MARGIN.left + plotW, sy(guide.value));
      ctx.textAlign = 'left';
      ctx.fillText(guide.label, MARGIN.left + 4, sy(guide.value) + 2);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(MARGIN.left, MARGIN.top, plotW, plotH);
  ctx.clip();
  ctx.lineJoin = 'round';
  for (const s of spec.series) {
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = s.alpha ?? 1;
    ctx.lineWidth = s.width ?? 2;
    ctx.beginPath();
    s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(sx(x), sy(y)) : ctx.lineTo(sx(x), sy(y))));
    ctx.stroke();
  }
  ctx.restore();
}
