/**
 * Calculator engine (graphing-calculator architecture doc): the single source
 * of truth for everything the Calculator feature computes. React components
 * render output from this module — they never parse or evaluate math
 * themselves — so the same engine can later power AI explanations, homework
 * checking, and analytics.
 *
 * Everything runs client-side (no API round-trip per keypress); the backend
 * only stores saved sessions.
 */
import { create, all } from 'mathjs';
import { normalizeInput } from './engine.js';

export type AngleMode = 'rad' | 'deg';

/* ------------------------------------------------------------------ */
/* Evaluation                                                           */
/* ------------------------------------------------------------------ */

const radMath = create(all, {});

const degMath = create(all, {});
const D = Math.PI / 180;
degMath.import(
  {
    sin: (x: number) => Math.sin(x * D),
    cos: (x: number) => Math.cos(x * D),
    tan: (x: number) => Math.tan(x * D),
    asin: (x: number) => Math.asin(x) / D,
    acos: (x: number) => Math.acos(x) / D,
    atan: (x: number) => Math.atan(x) / D,
  },
  { override: true },
);

function mathFor(mode: AngleMode) {
  return mode === 'deg' ? degMath : radMath;
}

export interface CalcResult {
  ok: boolean;
  /** numeric value when the result is a plain real number */
  value?: number;
  /** cleaned display string (float noise removed), e.g. "0.3", "2i", "[1, 2]" */
  display?: string;
  /** nice rational form when one exists and adds information, e.g. "1/3" */
  fraction?: string;
  /** user variables after evaluation (assignments like `a = 5` update it) */
  variables?: Record<string, number>;
  error?: string;
}

const RESERVED = new Set(['pi', 'e', 'i', 'ans', 'x', 'y', 'true', 'false']);

/**
 * Evaluate one calculator entry. Supports arithmetic, functions, `ans`, and
 * TI-style variable storage (`a = 5`, then `3a + 1`). Equations/inequalities
 * belong to the Graph tab, so `=` is only accepted as a single assignment.
 */
export function evaluateCalculation(
  input: string,
  opts: { angleMode?: AngleMode; ans?: number | null; variables?: Record<string, number> } = {},
): CalcResult {
  const math = mathFor(opts.angleMode ?? 'rad');
  const raw = normalizeInput(input);
  if (!raw) return { ok: false, error: 'empty' };

  const variables = { ...(opts.variables ?? {}) };
  const scope: Record<string, unknown> = { ...variables };
  if (opts.ans != null) scope.ans = opts.ans;

  // Only allow `=` as `name = expression` (assignment); anything else is an
  // equation and should be graphed instead.
  const eqCount = (raw.match(/=/g) ?? []).length - (raw.match(/[<>!]=/g) ?? []).length;
  const assign = raw.match(/^\s*([A-Za-z][A-Za-z0-9]*)\s*=\s*([^=].*)$/);
  if (eqCount > 0 && (!assign || eqCount > 1)) {
    return { ok: false, error: 'equation' };
  }
  if (assign && RESERVED.has(assign[1].toLowerCase())) {
    return { ok: false, error: `"${assign[1]}" can't be reassigned` };
  }

  let value: unknown;
  try {
    value = math.evaluate(raw, scope);
  } catch (err) {
    return { ok: false, error: humanError(err) };
  }

  // Collect updated user variables (numbers only) back out of the scope.
  for (const [k, v] of Object.entries(scope)) {
    if (k === 'ans' || RESERVED.has(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) variables[k] = v;
  }

  const num = toReal(value);
  if (num !== null) {
    if (!Number.isFinite(num)) return { ok: false, error: 'undefined result' };
    return {
      ok: true,
      value: num,
      display: formatNumber(num),
      fraction: asFraction(num),
      variables,
    };
  }
  // Non-scalar results (complex, matrices, …) still display via mathjs.
  try {
    return { ok: true, display: radMath.format(value, { precision: 12 }), variables };
  } catch {
    return { ok: false, error: 'could not display result' };
  }
}

function humanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const undef = msg.match(/undefined (?:symbol|function)\s+(\w+)/i);
  if (undef) return `unknown name "${undef[1]}"`;
  if (/unexpected end of expression/i.test(msg)) return 'incomplete expression';
  return 'syntax error';
}

function toReal(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v && typeof v === 'object') {
    const o = v as { toNumber?: () => number; im?: number; re?: number };
    if (typeof o.im === 'number') return o.im === 0 ? (o.re ?? null) : null;
    if (typeof o.toNumber === 'function') {
      try {
        return o.toNumber();
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Round float noise away: 0.1+0.2 → "0.3". 10 significant digits, TI-style. */
export function formatNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  if (!Number.isFinite(n)) return String(n);
  const cleaned = Number(n.toPrecision(10));
  if (Math.abs(cleaned) >= 1e15 || (cleaned !== 0 && Math.abs(cleaned) < 1e-6)) {
    return cleaned.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(cleaned);
}

/**
 * Best rational p/q (q ≤ 999) within float tolerance, or undefined when the
 * value is an integer / has no small-denominator form. Continued fractions.
 */
export function asFraction(n: number): string | undefined {
  if (!Number.isFinite(n) || Number.isInteger(n)) return undefined;
  const sign = n < 0 ? -1 : 1;
  let x = Math.abs(n);
  let [h0, h1] = [1, Math.floor(x)];
  let [k0, k1] = [0, 1];
  x -= Math.floor(x);
  for (let i = 0; i < 24 && x > 1e-12; i++) {
    x = 1 / x;
    const a = Math.floor(x);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > 999) return undefined;
    x -= a;
    if (Math.abs(h1 / k1 - Math.abs(n)) < 1e-10) break;
  }
  if (k1 <= 1 || k1 > 999) return undefined;
  if (Math.abs(h1 / k1 - Math.abs(n)) > 1e-9 * Math.max(1, Math.abs(n))) return undefined;
  return `${sign < 0 ? '-' : ''}${h1}/${k1}`;
}

/* ------------------------------------------------------------------ */
/* Graphing                                                             */
/* ------------------------------------------------------------------ */

export interface GraphWindow {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export const DEFAULT_WINDOW: GraphWindow = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };

export interface GraphFunction {
  ok: boolean;
  /** evaluate y at x; NaN when outside the domain */
  at: (x: number) => number;
  error?: string;
}

/**
 * Compile "y = …" / "f(x) = …" / bare expression into a fast x → y function.
 * The only free variable allowed is x.
 */
export function compileGraphFunction(
  expr: string,
  opts: { angleMode?: AngleMode } = {},
): GraphFunction {
  const math = mathFor(opts.angleMode ?? 'rad');
  const bad = (error: string): GraphFunction => ({ ok: false, at: () => NaN, error });
  let body = normalizeInput(expr)
    .replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, '')
    .trim();
  if (!body) return bad('empty');
  if (body.includes('=')) return bad('only y = f(x) can be graphed');
  let compiled: { evaluate: (scope: Record<string, unknown>) => unknown };
  try {
    const node = math.parse(body);
    let unknown: string | null = null;
    node.traverse((n) => {
      if (n.type === 'SymbolNode') {
        const name = (n as unknown as { name: string }).name;
        if (name !== 'x' && name !== 'pi' && name !== 'e' && !isKnown(math, name)) {
          unknown = name;
        }
      }
    });
    if (unknown) return bad(`unknown name "${unknown}"`);
    compiled = node.compile();
  } catch {
    return bad('syntax error');
  }
  const at = (x: number): number => {
    try {
      const v = compiled.evaluate({ x });
      const n = toReal(v);
      return n === null ? NaN : n;
    } catch {
      return NaN;
    }
  };
  return { ok: true, at };
}

/** mathjs resolves its own functions/constants; anything else is a typo. */
function isKnown(math: ReturnType<typeof create>, name: string): boolean {
  try {
    const v = (math as unknown as Record<string, unknown>)[name];
    return typeof v === 'function' || typeof v === 'number';
  } catch {
    return false;
  }
}

export type Point = { x: number; y: number };

/**
 * Sample a compiled function across the window into polyline segments. A new
 * segment starts at domain gaps (NaN/∞) and at vertical asymptotes (detected
 * by a sign flip with both sides far outside the window, e.g. tan, 1/x) so
 * the renderer never draws the classic fake vertical line.
 */
export function sampleGraph(
  fn: GraphFunction,
  window: GraphWindow,
  samples = 480,
): Point[][] {
  const { xmin, xmax, ymin, ymax } = window;
  const segments: Point[][] = [];
  let current: Point[] = [];
  const yspan = ymax - ymin;
  const clipAbs = Math.max(Math.abs(ymin), Math.abs(ymax)) + yspan * 4;
  const dx = (xmax - xmin) / samples;
  let prev: Point | null = null;
  const flush = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };
  for (let i = 0; i <= samples; i++) {
    const x = xmin + i * dx;
    let y = fn.at(x);
    if (!Number.isFinite(y)) {
      flush();
      prev = null;
      continue;
    }
    // Asymptote heuristic: consecutive samples on opposite sides, both far
    // off-screen → break instead of connecting.
    if (prev && Math.sign(y) !== Math.sign(prev.y) && Math.abs(y - prev.y) > yspan * 8) {
      flush();
    }
    // Clamp extreme values so the polyline stays numerically sane.
    if (Math.abs(y) > clipAbs) y = Math.sign(y) * clipAbs;
    const p = { x, y };
    current.push(p);
    prev = p;
  }
  flush();
  return segments;
}

/** Grid steps in the 1–2–5 progression, e.g. span 20 → step 2. */
export function niceTicks(min: number, max: number, maxTicks = 10): number[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const rough = span / maxTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  let step = mag;
  for (const m of [1, 2, 5, 10]) {
    if (mag * m >= rough) {
      step = mag * m;
      break;
    }
  }
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step / 1e6; t += step) {
    ticks.push(Math.abs(t) < step / 1e6 ? 0 : Number(t.toPrecision(12)));
  }
  return ticks;
}

/**
 * Real roots of f on [xmin, xmax]: scan for sign changes, refine by bisection.
 * Deterministic and fast enough to run on every window change.
 */
export function findRoots(fn: GraphFunction, xmin: number, xmax: number, samples = 480): number[] {
  const roots: number[] = [];
  const dx = (xmax - xmin) / samples;
  let px = xmin;
  let py = fn.at(px);
  for (let i = 1; i <= samples; i++) {
    const x = xmin + i * dx;
    const y = fn.at(x);
    if (Number.isFinite(py) && Number.isFinite(y)) {
      if (py === 0) roots.push(px);
      else if (Math.sign(py) !== Math.sign(y) && Math.abs(y - py) < Math.abs(dx) * 1e6) {
        roots.push(bisect(fn, px, x));
      }
    }
    px = x;
    py = y;
  }
  if (Number.isFinite(py) && py === 0) roots.push(px);
  // dedupe near-identical roots
  const out: number[] = [];
  for (const r of roots.sort((a, b) => a - b)) {
    if (out.length === 0 || Math.abs(r - out[out.length - 1]) > Math.abs(dx) / 2) {
      out.push(Number(r.toPrecision(10)));
    }
  }
  return out;
}

function bisect(fn: GraphFunction, a: number, b: number): number {
  let fa = fn.at(a);
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    const fm = fn.at(m);
    if (!Number.isFinite(fm) || fm === 0) return m;
    if (Math.sign(fa) === Math.sign(fm)) {
      a = m;
      fa = fm;
    } else {
      b = m;
    }
  }
  return (a + b) / 2;
}

/** Intersections of two functions on the window (roots of f − g). */
export function findIntersections(
  f: GraphFunction,
  g: GraphFunction,
  xmin: number,
  xmax: number,
): Point[] {
  const diff: GraphFunction = { ok: true, at: (x) => f.at(x) - g.at(x) };
  return findRoots(diff, xmin, xmax).map((x) => ({ x, y: f.at(x) }));
}

/* ------------------------------------------------------------------ */
/* Table view                                                           */
/* ------------------------------------------------------------------ */

export interface TableRow {
  x: number;
  /** one formatted value per function; "—" when undefined at that x */
  values: string[];
}

export function tableValues(
  fns: GraphFunction[],
  start: number,
  step: number,
  count = 12,
): TableRow[] {
  const rows: TableRow[] = [];
  const s = step === 0 || !Number.isFinite(step) ? 1 : step;
  for (let i = 0; i < count; i++) {
    const x = Number((start + i * s).toPrecision(12));
    rows.push({
      x,
      values: fns.map((fn) => {
        const y = fn.at(x);
        return Number.isFinite(y) ? formatNumber(Number(y.toPrecision(10))) : '—';
      }),
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Saved-session state (shared shape for UI + backend JSON column)      */
/* ------------------------------------------------------------------ */

export interface HistoryEntry {
  input: string;
  display: string;
  fraction?: string;
}

export interface CalculatorState {
  version: 1;
  angleMode: AngleMode;
  /** graph tab expressions, e.g. ["x^2 - 4", "2x + 1"] */
  expressions: string[];
  window: GraphWindow;
  history: HistoryEntry[];
  variables: Record<string, number>;
}

export const EMPTY_CALCULATOR_STATE: CalculatorState = {
  version: 1,
  angleMode: 'rad',
  expressions: ['x^2 - 4'],
  window: { ...DEFAULT_WINDOW },
  history: [],
  variables: {},
};

/** Validate/upgrade a state blob loaded from the backend or storage. */
export function parseCalculatorState(raw: unknown): CalculatorState {
  const base = EMPTY_CALCULATOR_STATE;
  if (!raw || typeof raw !== 'object') return { ...base, window: { ...base.window } };
  const o = raw as Partial<CalculatorState>;
  const win = o.window ?? base.window;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const window: GraphWindow = {
    xmin: num(win.xmin, base.window.xmin),
    xmax: num(win.xmax, base.window.xmax),
    ymin: num(win.ymin, base.window.ymin),
    ymax: num(win.ymax, base.window.ymax),
  };
  if (!(window.xmax > window.xmin)) [window.xmin, window.xmax] = [base.window.xmin, base.window.xmax];
  if (!(window.ymax > window.ymin)) [window.ymin, window.ymax] = [base.window.ymin, base.window.ymax];
  return {
    version: 1,
    angleMode: o.angleMode === 'deg' ? 'deg' : 'rad',
    expressions: Array.isArray(o.expressions)
      ? o.expressions.filter((e): e is string => typeof e === 'string').slice(0, 6)
      : [...base.expressions],
    window,
    history: Array.isArray(o.history)
      ? o.history
          .filter(
            (h): h is HistoryEntry =>
              !!h && typeof h === 'object' && typeof (h as HistoryEntry).input === 'string' &&
              typeof (h as HistoryEntry).display === 'string',
          )
          .slice(-50)
      : [],
    variables:
      o.variables && typeof o.variables === 'object'
        ? Object.fromEntries(
            Object.entries(o.variables).filter(
              ([, v]) => typeof v === 'number' && Number.isFinite(v),
            ),
          )
        : {},
  };
}
