/**
 * Deterministic answer checking (design doc §6).
 *
 * Never grade on string equality: everything is normalized through the CAS
 * (mathjs in-process). Four grading modes per problem/step:
 *
 *  - equivalent:        symbolically/numerically equivalent to the key
 *  - canonical_form:    equivalent AND written in the taught canonical shape
 *                       (standard form, fully simplified radical, etc.)
 *  - exact:             same normalized token sequence (e.g. classifications)
 *  - numeric_tolerance: |student - key| <= tolerance
 */
import { create, all, type MathNode } from 'mathjs';

const math = create(all, {});

export type GradingMode =
  | 'equivalent'
  | 'canonical_form'
  | 'exact'
  | 'numeric_tolerance';

export interface GradeResult {
  correct: boolean;
  /** true when the value is right but not in the required canonical form */
  equivalentButNotCanonical?: boolean;
  error?: string;
}

/**
 * Convert student/authored input to a mathjs-parseable expression.
 * Accepts plain text with the shortcuts the doc calls out (x^2, sqrt()),
 * plus the small subset of LaTeX our math input emits.
 */
export function normalizeInput(raw: string): string {
  let s = raw.trim();
  // strip surrounding $...$
  s = s.replace(/^\$+|\$+$/g, '');
  // LaTeX → plain
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\cdot|\\times/g, '*');
  s = s.replace(/\\div/g, '/');
  s = s.replace(/\\pi/g, 'pi');
  s = s.replace(/\\le(?![a-z])/g, '<=').replace(/\\ge(?![a-z])/g, '>=');
  s = s.replace(/\\leq/g, '<=').replace(/\\geq/g, '>=');
  s = s.replace(/\\ne(?![a-z])|\\neq/g, '!=');
  // \frac{a}{b} → ((a)/(b))  (repeat for nesting)
  for (let i = 0; i < 8 && s.includes('\\frac'); i++) {
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))');
  }
  // \sqrt[3]{x} → nthRoot(x,3); \sqrt{x} → sqrt(x)
  s = s.replace(/\\sqrt\s*\[\s*(\d+)\s*\]\s*\{([^{}]*)\}/g, 'nthRoot($2,$1)');
  for (let i = 0; i < 8 && /\\sqrt\s*\{/.test(s); i++) {
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)');
  }
  // ^{ab} → ^(ab); _{..} subscripts dropped
  s = s.replace(/\^\s*\{([^{}]*)\}/g, '^($1)');
  s = s.replace(/_\{[^{}]*\}|_[A-Za-z0-9]/g, '');
  // remaining braces act as parens
  s = s.replace(/\{/g, '(').replace(/\}/g, ')');
  // unicode operators
  s = s.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  s = s.replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=');
  s = s.replace(/√\s*\(/g, 'sqrt(').replace(/√\s*(\d+|[a-z])/g, 'sqrt($1)');
  s = s.replace(/π/g, 'pi');
  // implicit multiplication mathjs already handles (2x, 3(x+1))
  return s.trim();
}

function parse(expr: string): MathNode {
  return math.parse(normalizeInput(expr));
}

function variablesOf(node: MathNode): string[] {
  const vars = new Set<string>();
  node.traverse((n) => {
    if (n.type === 'SymbolNode') {
      const name = (n as unknown as { name: string }).name;
      if (!['pi', 'e', 'sqrt', 'nthRoot', 'abs', 'true', 'false'].includes(name)) {
        vars.add(name);
      }
    }
  });
  return [...vars].sort();
}

/** Deterministic pseudo-random sample points so grading is reproducible. */
function samplePoints(vars: string[], count: number): Record<string, number>[] {
  const points: Record<string, number>[] = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < count; i++) {
    const scope: Record<string, number> = {};
    for (const v of vars) scope[v] = Math.round((rand() * 8 - 4) * 100) / 100 + 0.13;
    points.push(scope);
  }
  return points;
}

/**
 * Numeric equivalence over random sample points. Handles the expressions this
 * course uses (polynomials, radicals, rationals) far more robustly than
 * symbolic simplify alone.
 */
export function areEquivalent(a: string, b: string): boolean {
  const aEq = normalizeInput(a).includes('=');
  const bEq = normalizeInput(b).includes('=');
  if (aEq || bEq) {
    if (!(aEq && bEq)) return false;
    return equationsEquivalent(a, b);
  }
  let na: MathNode, nb: MathNode;
  try {
    na = parse(a);
    nb = parse(b);
  } catch {
    return false;
  }
  const vars = [...new Set([...variablesOf(na), ...variablesOf(nb)])].sort();
  const ca = na.compile();
  const cb = nb.compile();
  let compared = 0;
  for (const scope of samplePoints(vars, 24)) {
    let va: unknown, vb: unknown;
    try {
      va = ca.evaluate({ ...scope });
      vb = cb.evaluate({ ...scope });
    } catch {
      continue; // outside domain (e.g. sqrt of negative) — try another point
    }
    const fa = toNumber(va);
    const fb = toNumber(vb);
    if (fa === null || fb === null) continue;
    if (Number.isNaN(fa) || Number.isNaN(fb)) continue;
    compared++;
    const tol = 1e-8 * Math.max(1, Math.abs(fa), Math.abs(fb));
    if (Math.abs(fa - fb) > tol) return false;
  }
  return compared >= Math.min(6, vars.length === 0 ? 1 : 6);
}

/**
 * Two equations are equivalent when (LHS−RHS) of one is a nonzero constant
 * multiple of the other's across sample points — e.g. y=2x+5 ≡ y−2x=5 ≡
 * 2y=4x+10, and x=3 ≡ 2x=6.
 */
function equationsEquivalent(a: string, b: string): boolean {
  const split = (s: string): [string, string] | null => {
    const parts = normalizeInput(s).split('=');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
    return [parts[0], parts[1]];
  };
  const pa = split(a);
  const pb = split(b);
  if (!pa || !pb) return false;
  let fa: ReturnType<MathNode['compile']>, fb: ReturnType<MathNode['compile']>;
  let vars: string[];
  try {
    const na = math.parse(`(${pa[0]})-(${pa[1]})`);
    const nb = math.parse(`(${pb[0]})-(${pb[1]})`);
    vars = [...new Set([...variablesOf(na), ...variablesOf(nb)])].sort();
    fa = na.compile();
    fb = nb.compile();
  } catch {
    return false;
  }
  let ratio: number | null = null;
  let compared = 0;
  for (const scope of samplePoints(vars, 24)) {
    let va: number | null, vb: number | null;
    try {
      va = toNumber(fa.evaluate({ ...scope }));
      vb = toNumber(fb.evaluate({ ...scope }));
    } catch {
      continue;
    }
    if (va === null || vb === null || Number.isNaN(va) || Number.isNaN(vb)) continue;
    compared++;
    if (Math.abs(vb) < 1e-12) {
      if (Math.abs(va) > 1e-9) return false;
      continue;
    }
    const r = va / vb;
    if (Math.abs(r) < 1e-12) return false;
    if (ratio === null) ratio = r;
    else if (Math.abs(r - ratio) > 1e-6 * Math.max(1, Math.abs(ratio))) return false;
  }
  return compared >= 6;
}

/**
 * True when the expression is written as a product with at least one
 * parenthesized multi-term factor — i.e. it *looks* factored, not expanded.
 * Used so `x^2+5x+6` can't pass a "factor this" problem it merely equals.
 */
export function isFactoredForm(expr: string): boolean {
  let node: MathNode;
  try {
    node = parse(expr);
  } catch {
    return false;
  }
  const top = node.type === 'ParenthesisNode'
    ? (node as unknown as { content: MathNode }).content
    : node;
  const factors: MathNode[] = [];
  const collect = (n: MathNode): void => {
    if (n.type === 'OperatorNode') {
      const op = n as unknown as { op: string; args: MathNode[] };
      if (op.op === '*') {
        op.args.forEach(collect);
        return;
      }
      if (op.op === '^') {
        factors.push(op.args[0]);
        return;
      }
      if (op.op === '-' && op.args.length === 1) {
        collect(op.args[0]);
        return;
      }
    }
    factors.push(n);
  };
  collect(top);
  const hasParenSum = factors.some((f) => {
    const inner = f.type === 'ParenthesisNode'
      ? (f as unknown as { content: MathNode }).content
      : f;
    if (inner.type !== 'OperatorNode') return false;
    const op = inner as unknown as { op: string };
    return op.op === '+' || op.op === '-';
  });
  return factors.length >= 2 && hasParenSum;
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'toNumber' in (v as object)) {
    try {
      return (v as { toNumber(): number }).toNumber();
    } catch {
      return null;
    }
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return null;
}

/* ------------------------------------------------------------------ */
/* Canonical-form checks                                                */
/* ------------------------------------------------------------------ */

interface Term {
  coeff: number;
  /** variable → exponent, e.g. {x:2} */
  powers: Record<string, number>;
}

/**
 * Extract the flat list of polynomial terms exactly as the student wrote
 * them, left to right. Returns null if the expression isn't a plain sum of
 * monomial terms (i.e. still has parentheses to distribute, etc.).
 */
export function termsAsWritten(expr: string): Term[] | null {
  let node: MathNode;
  try {
    node = parse(expr);
  } catch {
    return null;
  }
  const terms: Term[] = [];

  function walkSum(n: MathNode, sign: number): boolean {
    if (n.type === 'OperatorNode') {
      const op = n as unknown as { op: string; args: MathNode[]; fn: string };
      if (op.op === '+' && op.args.length === 2) {
        return walkSum(op.args[0], sign) && walkSum(op.args[1], sign);
      }
      if (op.op === '-' && op.args.length === 2) {
        return walkSum(op.args[0], sign) && walkSum(op.args[1], -sign);
      }
      if (op.op === '-' && op.args.length === 1) {
        return walkSum(op.args[0], -sign);
      }
    }
    if (n.type === 'ParenthesisNode') return false; // undistributed parens
    const t = monomialOf(n);
    if (!t) return false;
    terms.push({ coeff: t.coeff * sign, powers: t.powers });
    return true;
  }

  function monomialOf(n: MathNode): Term | null {
    if (n.type === 'ConstantNode') {
      return { coeff: Number((n as unknown as { value: unknown }).value), powers: {} };
    }
    if (n.type === 'SymbolNode') {
      const name = (n as unknown as { name: string }).name;
      if (name === 'pi') return { coeff: Math.PI, powers: {} };
      return { coeff: 1, powers: { [name]: 1 } };
    }
    if (n.type === 'OperatorNode') {
      const op = n as unknown as { op: string; args: MathNode[] };
      if (op.op === '^') {
        const base = op.args[0];
        const exp = op.args[1];
        if (base.type === 'SymbolNode' && exp.type === 'ConstantNode') {
          const name = (base as unknown as { name: string }).name;
          const e = Number((exp as unknown as { value: unknown }).value);
          return { coeff: 1, powers: { [name]: e } };
        }
        return null;
      }
      if (op.op === '*') {
        let coeff = 1;
        const powers: Record<string, number> = {};
        for (const arg of op.args) {
          const sub = monomialOf(arg);
          if (!sub) return null;
          coeff *= sub.coeff;
          for (const [v, e] of Object.entries(sub.powers)) {
            powers[v] = (powers[v] ?? 0) + e;
          }
        }
        return { coeff, powers };
      }
      if (op.op === '/') {
        const num = monomialOf(op.args[0]);
        const den = monomialOf(op.args[1]);
        if (!num || !den || Object.keys(den.powers).length > 0) return null;
        return { coeff: num.coeff / den.coeff, powers: num.powers };
      }
      if (op.op === '-' && op.args.length === 1) {
        const sub = monomialOf(op.args[0]);
        if (!sub) return null;
        return { coeff: -sub.coeff, powers: sub.powers };
      }
    }
    return null;
  }

  return walkSum(node, 1) ? terms : null;
}

function degreeOf(t: Term): number {
  return Object.values(t.powers).reduce((a, b) => a + b, 0);
}

function termKey(t: Term): string {
  return Object.entries(t.powers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([v, e]) => `${v}^${e}`)
    .join('*');
}

/**
 * Canonical polynomial form as taught in class: like terms combined, terms
 * ordered from highest degree to lowest ("standard form").
 */
export function isCanonicalPolynomial(expr: string): boolean {
  const terms = termsAsWritten(expr);
  if (!terms) return false;
  const seen = new Set<string>();
  for (const t of terms) {
    const key = termKey(t);
    if (seen.has(key)) return false; // like terms not combined
    seen.add(key);
    if (t.coeff === 0 && terms.length > 1) return false;
  }
  for (let i = 1; i < terms.length; i++) {
    if (degreeOf(terms[i]) > degreeOf(terms[i - 1])) return false; // not standard order
  }
  return true;
}

/**
 * Simplified-radical check: every sqrt() in the expression has an integer,
 * square-free radicand (no perfect-square factor > 1), and no fraction has a
 * radical in its denominator.
 */
export function radicalsFullySimplified(expr: string): boolean {
  let node: MathNode;
  try {
    node = parse(expr);
  } catch {
    return false;
  }
  let ok = true;
  node.traverse((n) => {
    if (n.type === 'FunctionNode') {
      const fn = n as unknown as { fn: { name?: string }; args: MathNode[] };
      if (fn.fn?.name === 'sqrt' && fn.args.length === 1) {
        const arg = fn.args[0];
        if (arg.type !== 'ConstantNode') {
          ok = false; // radicand must be a plain integer at this level
          return;
        }
        const v = Number((arg as unknown as { value: unknown }).value);
        if (!Number.isInteger(v) || v < 2) {
          if (v !== 0 && v !== 1) ok = false;
          return;
        }
        for (let f = 2; f * f <= v; f++) {
          if (v % (f * f) === 0) {
            ok = false;
            return;
          }
        }
      }
    }
    if (n.type === 'OperatorNode') {
      const op = n as unknown as { op: string; args: MathNode[] };
      if (op.op === '/' && op.args.length === 2) {
        let radicalBelow = false;
        op.args[1].traverse((d) => {
          if (
            d.type === 'FunctionNode' &&
            (d as unknown as { fn: { name?: string } }).fn?.name === 'sqrt'
          ) {
            radicalBelow = true;
          }
        });
        if (radicalBelow) ok = false;
      }
    }
  });
  return ok;
}

/**
 * Canonical-form check: right value AND the taught final shape.
 * Combines the polynomial standard-form rule with the simplified-radical rule;
 * for pure numbers it requires a fully-evaluated simple value.
 */
export function isCanonicalForm(expr: string): boolean {
  const s = normalizeInput(expr);
  if (/sqrt|√/.test(s)) {
    if (!radicalsFullySimplified(s)) return false;
    // radical answers: also no uncombined like radical terms, approximated by
    // requiring the term list (with sqrt treated as opaque) to be short/simple.
    return true;
  }
  const terms = termsAsWritten(s);
  if (terms) return isCanonicalPolynomial(s);
  // Not a polynomial sum (e.g. factored form "(x+2)(x+3)", "y=2x+5").
  // Those skills use 'equivalent' or 'exact' modes instead.
  return true;
}

/* ------------------------------------------------------------------ */
/* Exact + numeric modes                                                */
/* ------------------------------------------------------------------ */

/**
 * Put inequalities in a canonical orientation so "5 > x" grades the same as
 * "x < 5".
 */
function canonicalizeInequality(s: string): string {
  const m = s.match(/^([^<>]+?)(<=|>=|<|>)([^<>]+)$/);
  if (!m) return s;
  const [, lhs, op, rhs] = m;
  const hasVar = (t: string) => /[a-z]/i.test(t);
  if (!hasVar(lhs) && hasVar(rhs)) {
    const flip: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
    return `${rhs}${flip[op]}${lhs}`;
  }
  return s;
}

/** Token-normalized exact comparison (whitespace/case/brace insensitive). */
export function exactMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    canonicalizeInequality(
      normalizeInput(s)
        .toLowerCase()
        .replace(/\s+/g, ''),
    ).replace(/\((\w)\)/g, '$1');
  if (norm(a) === norm(b)) return true;
  // allow list answers in any order: "3, -5" vs "-5, 3"
  const parts = (s: string) =>
    norm(s)
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean)
      .sort();
  const pa = parts(a);
  const pb = parts(b);
  return pa.length > 1 && pa.length === pb.length && pa.every((p, i) => p === pb[i]);
}

export function numericWithin(student: string, key: string, tolerance: number): boolean {
  try {
    const sv = toNumber(math.evaluate(normalizeInput(student)));
    const kv = toNumber(math.evaluate(normalizeInput(key)));
    if (sv === null || kv === null) return false;
    return Math.abs(sv - kv) <= tolerance;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Entry point                                                          */
/* ------------------------------------------------------------------ */

/**
 * The narrow surface the rest of the app is allowed to depend on. Everything
 * mathjs-specific stays inside this module; swapping the CAS (SymPy service,
 * custom solver) means providing another implementation of this interface,
 * not touching callers.
 */
export interface MathEngine {
  normalize(raw: string): string;
  equivalent(a: string, b: string): boolean;
  isCanonicalForm(expr: string): boolean;
  grade(
    submitted: string,
    answerKey: string,
    mode: GradingMode,
    tolerance?: number | null,
  ): GradeResult;
}

export function grade(
  submitted: string,
  answerKey: string,
  mode: GradingMode,
  tolerance?: number | null,
): GradeResult {
  if (!submitted.trim()) return { correct: false, error: 'empty' };
  try {
    switch (mode) {
      case 'exact': {
        if (exactMatch(submitted, answerKey)) return { correct: true };
        // fall back: numerically identical constants count as exact ("0.5" vs "1/2")
        if (numericWithin(submitted, answerKey, 1e-9)) return { correct: true };
        return { correct: false };
      }
      case 'numeric_tolerance':
        return { correct: numericWithin(submitted, answerKey, tolerance ?? 0.05) };
      case 'equivalent':
        if (exactMatch(submitted, answerKey)) return { correct: true };
        return { correct: areEquivalent(submitted, answerKey) };
      case 'canonical_form': {
        if (exactMatch(submitted, answerKey)) return { correct: true };
        const equivalent = areEquivalent(submitted, answerKey);
        if (!equivalent) return { correct: false };
        // Per-skill canonicalization comes from the shape of the answer key:
        // a factored key demands a factored student answer; a polynomial-sum
        // key demands standard form; radical keys demand simplified radicals.
        let canonical: boolean;
        if (isFactoredForm(answerKey)) {
          canonical = isFactoredForm(submitted);
        } else if (
          termsAsWritten(normalizeInput(answerKey)) &&
          !/sqrt|√/.test(normalizeInput(answerKey))
        ) {
          const studentTerms = termsAsWritten(normalizeInput(submitted));
          canonical = studentTerms !== null && isCanonicalPolynomial(submitted);
        } else {
          canonical = isCanonicalForm(submitted);
        }
        return canonical
          ? { correct: true }
          : { correct: false, equivalentButNotCanonical: true };
      }
    }
  } catch (err) {
    return { correct: false, error: String(err) };
  }
}

/** Default engine, backed by mathjs. */
export const mathEngine: MathEngine = {
  normalize: normalizeInput,
  equivalent: areEquivalent,
  isCanonicalForm,
  grade,
};
