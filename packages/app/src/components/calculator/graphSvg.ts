/**
 * Pure SVG renderer for the graph viewport. The math engine supplies sampled
 * segments; this turns them into markup. Being a plain string function, the
 * same renderer drives the web DOM (with pointer pan/zoom on top) and the
 * native WebView.
 */
import {
  formatNumber,
  niceTicks,
  sampleGraph,
  type GraphFunction,
  type GraphWindow,
  type Point,
} from '@tutor/core';

export interface PlottedFunction {
  fn: GraphFunction;
  color: string;
}

const GRID = '#e9ecf1';
const AXIS = '#9ca3af';
const LABEL = '#6b7280';

export function renderGraphSvg(opts: {
  fns: PlottedFunction[];
  window: GraphWindow;
  width: number;
  height: number;
  markers?: { point: Point; color: string }[];
  /** Marker the user tapped: highlighted with its (x, y) ordered pair. */
  selected?: { point: Point; color: string };
}): string {
  const { fns, window: win, width, height, markers = [], selected } = opts;
  const toX = (x: number) => ((x - win.xmin) / (win.xmax - win.xmin)) * width;
  const toY = (y: number) => height - ((y - win.ymin) / (win.ymax - win.ymin)) * height;
  const fmt = (n: number) => Number(n.toFixed(2));

  const parts: string[] = [];

  // grid + tick labels
  const xTicks = niceTicks(win.xmin, win.xmax, Math.max(4, Math.round(width / 60)));
  const yTicks = niceTicks(win.ymin, win.ymax, Math.max(4, Math.round(height / 50)));
  const axisXpx = clamp(toX(0), 0, width);
  const axisYpx = clamp(toY(0), 12, height - 4);
  for (const t of xTicks) {
    const px = toX(t);
    parts.push(line(px, 0, px, height, GRID, 1));
    if (t !== 0) {
      parts.push(text(px + 2, axisYpx + 12, tickLabel(t), LABEL));
    }
  }
  for (const t of yTicks) {
    const py = toY(t);
    parts.push(line(0, py, width, py, GRID, 1));
    if (t !== 0) {
      parts.push(text(clamp(axisXpx + 4, 4, width - 34), py - 3, tickLabel(t), LABEL));
    }
  }
  // axes
  if (win.ymin <= 0 && win.ymax >= 0) parts.push(line(0, toY(0), width, toY(0), AXIS, 1.5));
  if (win.xmin <= 0 && win.xmax >= 0) parts.push(line(toX(0), 0, toX(0), height, AXIS, 1.5));

  // curves
  for (const { fn, color } of fns) {
    if (!fn.ok) continue;
    const samples = Math.max(160, Math.min(720, Math.round(width * 1.5)));
    for (const seg of sampleGraph(fn, win, samples)) {
      const d = seg
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(toX(p.x))} ${fmt(toY(p.y))}`)
        .join('');
      parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.25" stroke-linejoin="round"/>`);
    }
  }

  for (const { point, color } of markers) {
    parts.push(
      `<circle cx="${fmt(toX(point.x))}" cy="${fmt(toY(point.y))}" r="4" fill="#fff" stroke="${color}" stroke-width="2"/>`,
    );
  }

  if (selected) {
    const px = toX(selected.point.x);
    const py = toY(selected.point.y);
    parts.push(
      `<circle cx="${fmt(px)}" cy="${fmt(py)}" r="5.5" fill="${selected.color}" stroke="#fff" stroke-width="2"/>`,
    );
    const label = `(${coordLabel(selected.point.x)}, ${coordLabel(selected.point.y)})`;
    // Keep the label inside the viewport: flip below the point near the top
    // edge and pull it left near the right edge (~7px per character).
    const lx = clamp(px + 9, 4, width - (label.length * 7 + 6));
    const ly = py < 26 ? py + 22 : py - 10;
    parts.push(
      `<text x="${fmt(lx)}" y="${fmt(ly)}" font-size="12.5" font-weight="700" ` +
        `font-family="system-ui,sans-serif" fill="${selected.color}" stroke="#fff" ` +
        `stroke-width="3.5" paint-order="stroke" style="font-variant-numeric:tabular-nums">${label}</text>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" style="display:block;background:#fff">` +
    parts.join('') +
    '</svg>'
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, w: number): string {
  const f = (n: number) => Number(n.toFixed(2));
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${w}"/>`;
}

function text(x: number, y: number, s: string, fill: string): string {
  const f = (n: number) => Number(n.toFixed(2));
  return `<text x="${f(x)}" y="${f(y)}" font-size="10" font-family="system-ui,sans-serif" fill="${fill}">${s}</text>`;
}

function coordLabel(v: number): string {
  return formatNumber(Number(v.toPrecision(4)));
}

function tickLabel(t: number): string {
  if (Math.abs(t) >= 1e5 || (t !== 0 && Math.abs(t) < 1e-3)) return t.toExponential(0);
  return String(Number(t.toPrecision(6)));
}
