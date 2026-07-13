/**
 * Auto-generated animation scripts from practice-problem parameters.
 *
 * The problem generators (packages/core/src/math/generators.ts) persist
 * their randomized params on each seeded problem. Given a skill slug and
 * that params object, these builders produce an EqScript for the student's
 * OWN problem — no hand authoring per problem. Dispatch is by slug plus
 * params shape, so a template the builders don't understand simply returns
 * null and the practice UI hides the animation button.
 */
import type { EqScript, EqStep, EqToken, Emph, TokenKind } from './model.js';

/** Display negatives with a real minus sign. */
const M = (n: number) => String(n).replace('-', '−');
/** Coefficient rendering: 1x → x, −1x → −x. */
const cf = (a: number, v: string) => (a === 1 ? v : a === -1 ? `−${v}` : `${M(a)}${v}`);

const tok = (
  id: string,
  text: string,
  kind: TokenKind,
  extra?: Partial<{ emph: Emph; tight: boolean }>,
): EqToken => ({ id, text, kind, ...extra });

const FLIP: Record<string, string> = { '>': '<', '<': '>', '≥': '≤', '≤': '≥' };

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** Stacked-fraction token; text fallback parenthesizes multi-term parts. */
const ftok = (
  id: string,
  num: string,
  den: string,
  extra?: Partial<{ emph: Emph }>,
): EqToken => {
  const wrap = (s: string) => (s.includes(' ') ? `(${s})` : s);
  return { id, text: `${wrap(num)}/${wrap(den)}`, kind: 'frac', num, den, ...extra };
};

/**
 * Steps for solving A·v + B rel C (A ≠ 0), including the inequality flip
 * when dividing by a negative A. Token ids are stable ('ax', 'op', 'b',
 * 'rel', 'c0'…) so callers can prepend steps that hand off seamlessly.
 */
function solveLinearSteps(A: number, B: number, C: number, v: string, rel: string, x: number): EqStep[] {
  const steps: EqStep[] = [];
  const isIneq = rel !== '=';
  const bOp = B >= 0 ? '+' : '−';
  const absB = Math.abs(B);
  const inv = B > 0 ? `− ${M(B)}` : `+ ${M(-B)}`;
  const C1 = C - B;

  const head = [tok('ax', cf(A, v), 'var'), tok('op', bOp, 'op'), tok('b', M(absB), 'num')];

  if (B !== 0) {
    steps.push({
      tokens: [...head, tok('rel', rel, 'rel'), tok('c0', M(C), 'num')],
      explainEn: `We want ${v} alone. First undo the ${bOp} ${absB}.`,
      explainEs: `Queremos ${v} sola. Primero deshaz el ${bOp} ${absB}.`,
    });
    steps.push({
      tokens: [
        ...head,
        tok('invL', inv, 'op', { emph: 'apply' }),
        tok('rel', rel, 'rel'),
        tok('c0', M(C), 'num'),
        tok('invR', inv, 'op', { emph: 'apply' }),
      ],
      explainEn: `${B > 0 ? 'Subtract' : 'Add'} ${absB} on BOTH sides.`,
      explainEs: `${B > 0 ? 'Resta' : 'Suma'} ${absB} en AMBOS lados.`,
    });
    steps.push({
      tokens: [
        tok('ax', cf(A, v), 'var'),
        tok('rel', rel, 'rel'),
        tok('c1', M(C1), 'num', { emph: A === 1 ? undefined : 'result' }),
      ],
      explainEn: `${bOp} ${absB} ${inv} cancels, and ${M(C)} ${inv} = ${M(C1)}.`,
      explainEs: `${bOp} ${absB} ${inv} se cancela, y ${M(C)} ${inv} = ${M(C1)}.`,
    });
  }

  if (A === 1) {
    const last = steps[steps.length - 1];
    if (last) {
      last.tokens = last.tokens.map((tk) =>
        tk.id === 'c1' ? { ...tk, emph: 'result' as Emph } : tk,
      );
      last.explainEn += ` ${v} is alone — done!`;
      last.explainEs += ` ${v} quedó sola — ¡listo!`;
    }
    return steps;
  }

  const divisor = A < 0 ? `(${M(A)})` : M(A);
  steps.push({
    tokens: [
      tok('ax', cf(A, v), 'var'),
      tok('dL', `÷ ${divisor}`, 'op', { emph: 'apply' }),
      tok('rel', rel, 'rel'),
      tok('c1', M(C1), 'num'),
      tok('dR', `÷ ${divisor}`, 'op', { emph: 'apply' }),
    ],
    explainEn:
      isIneq && A < 0
        ? `Divide BOTH sides by ${M(A)}. Careful — that number is NEGATIVE…`
        : `Divide BOTH sides by ${M(A)}.`,
    explainEs:
      isIneq && A < 0
        ? `Divide AMBOS lados entre ${M(A)}. Cuidado — ¡ese número es NEGATIVO…`
        : `Divide AMBOS lados entre ${M(A)}.`,
  });

  const flips = isIneq && A < 0;
  const finalRel = flips ? FLIP[rel] ?? rel : rel;
  steps.push({
    tokens: [
      tok('v', v, 'var'),
      tok('rel', finalRel, 'rel', flips ? { emph: 'flip' } : undefined),
      tok('xf', M(x), 'num', { emph: 'result' }),
    ],
    explainEn: flips
      ? `Dividing by a negative FLIPS the symbol: ${rel} becomes ${finalRel}. So ${v} ${finalRel} ${M(x)}.`
      : `${cf(A, v)} ÷ ${M(A)} = ${v}, and ${M(C1)} ÷ ${M(A)} = ${M(x)}. Done!`,
    explainEs: flips
      ? `Dividir entre un negativo VOLTEA el símbolo: ${rel} se convierte en ${finalRel}. Así que ${v} ${finalRel} ${M(x)}.`
      : `${cf(A, v)} ÷ ${M(A)} = ${v}, y ${M(C1)} ÷ ${M(A)} = ${M(x)}. ¡Listo!`,
    ...(flips ? { holdMs: 3400 } : {}),
  });
  return steps;
}

/** two_step_equation template: a·x + b = c, params {a, b, x}. */
export function buildTwoStepEquation(a: number, b: number, x: number): EqScript {
  const c = a * x + b;
  return {
    id: `gen-two-step-${a}-${b}-${x}`,
    titleEn: 'Your problem, step by step',
    titleEs: 'Tu problema, paso a paso',
    steps: solveLinearSteps(a, b, c, 'x', '=', x),
  };
}

/** two_step_inequality template: a·x + b {>|<} c, params {a, b, x, baseOp}. */
export function buildTwoStepInequality(a: number, b: number, x: number, baseOp: string): EqScript {
  const c = a * x + b;
  return {
    id: `gen-ineq-${a}-${b}-${x}-${baseOp}`,
    titleEn: 'Your inequality, step by step',
    titleEs: 'Tu desigualdad, paso a paso',
    steps: solveLinearSteps(a, b, c, 'x', baseOp, x),
  };
}

/** var_both_sides template: a·n + b = d + c·n, params {a, b, c, x}. */
export function buildVarBothSides(a: number, b: number, c: number, x: number): EqScript {
  const d = a * x + b - c * x;
  const bOp = b >= 0 ? '+' : '−';
  const absB = Math.abs(b);
  const cOp = c >= 0 ? '+' : '−';
  const gather = c > 0 ? `− ${cf(c, 'n')}` : `+ ${cf(-c, 'n')}`;
  const A = a - c;

  const lhs = [tok('ax', cf(a, 'n'), 'var'), tok('op', bOp, 'op'), tok('b', M(absB), 'num')];
  const rhs = [tok('c0', M(d), 'num'), tok('cop', cOp, 'op'), tok('cn', cf(Math.abs(c), 'n'), 'var')];

  const steps: EqStep[] = [
    {
      tokens: [...lhs, tok('rel', '=', 'rel'), ...rhs],
      explainEn: 'n appears on BOTH sides. Gather the n-terms on the left first.',
      explainEs: 'La n aparece en AMBOS lados. Primero junta los términos con n a la izquierda.',
    },
    {
      tokens: [
        tok('ax', cf(a, 'n'), 'var', { emph: 'focus' }),
        tok('op', bOp, 'op'),
        tok('b', M(absB), 'num'),
        tok('rel', '=', 'rel'),
        tok('c0', M(d), 'num'),
        tok('cop', cOp, 'op'),
        tok('cn', cf(Math.abs(c), 'n'), 'var', { emph: 'focus' }),
      ],
      explainEn: `The n-terms are ${cf(a, 'n')} and ${cOp === '−' ? '−' : ''}${cf(Math.abs(c), 'n')}. Remove the one on the right.`,
      explainEs: `Los términos con n son ${cf(a, 'n')} y ${cOp === '−' ? '−' : ''}${cf(Math.abs(c), 'n')}. Quita el del lado derecho.`,
    },
    {
      tokens: [
        ...lhs,
        tok('gL', gather, 'op', { emph: 'apply' }),
        tok('rel', '=', 'rel'),
        ...rhs,
        tok('gR', gather, 'op', { emph: 'apply' }),
      ],
      explainEn: `${c > 0 ? 'Subtract' : 'Add'} ${cf(Math.abs(c), 'n')} on BOTH sides.`,
      explainEs: `${c > 0 ? 'Resta' : 'Suma'} ${cf(Math.abs(c), 'n')} en AMBOS lados.`,
    },
    {
      tokens: [
        tok('ax', cf(A, 'n'), 'var', { emph: 'result' }),
        tok('op', bOp, 'op'),
        tok('b', M(absB), 'num'),
        tok('rel', '=', 'rel'),
        tok('c0', M(d), 'num'),
      ],
      explainEn: `${cf(a, 'n')} ${gather} = ${cf(A, 'n')}; on the right the n-terms cancel to 0.`,
      explainEs: `${cf(a, 'n')} ${gather} = ${cf(A, 'n')}; a la derecha los términos con n se cancelan a 0.`,
    },
    ...solveLinearSteps(A, b, d, 'n', '=', x),
  ];

  return {
    id: `gen-both-sides-${a}-${b}-${c}-${x}`,
    titleEn: 'Your problem, step by step',
    titleEs: 'Tu problema, paso a paso',
    steps,
  };
}

/** multi_step_equation template: k(a·x + b) + c·x = d, params {k, a, b, c, x}. */
export function buildMultiStepEquation(
  k: number,
  a: number,
  b: number,
  c: number,
  x: number,
): EqScript | null {
  const A = k * a + c;
  if (A === 0) return null;
  const d = k * (a * x + b) + c * x;
  const bOp = b >= 0 ? '+' : '−';
  const cOp = c >= 0 ? '+' : '−';
  const kb = k * b;
  const kbOp = kb >= 0 ? '+' : '−';

  // 2(3x + 1) + 4x = 12  as tokens, parens tight against their contents
  const original = (emphasized: boolean): EqToken[] => [
    tok('kk', M(k), 'num', emphasized ? { emph: 'focus' } : undefined),
    tok('lp', '(', 'op', { tight: true }),
    tok('in1', cf(a, 'x'), 'var', { tight: true, ...(emphasized ? { emph: 'focus' } : {}) }),
    tok('iop', bOp, 'op'),
    tok('ib', M(Math.abs(b)), 'num', emphasized ? { emph: 'focus' } : undefined),
    tok('rp', ')', 'op', { tight: true }),
    tok('cop', cOp, 'op'),
    tok('cx', cf(Math.abs(c), 'x'), 'var'),
    tok('rel', '=', 'rel'),
    tok('c0', M(d), 'num'),
  ];

  const steps: EqStep[] = [
    {
      tokens: original(false),
      explainEn: `Before solving, ask: do I need to distribute? YES — the ${M(k)} multiplies everything inside.`,
      explainEs: `Antes de resolver, pregunta: ¿necesito distribuir? SÍ — el ${M(k)} multiplica todo lo de adentro.`,
    },
    {
      tokens: original(true),
      explainEn: `Distribute: ${M(k)} · ${cf(a, 'x')} and ${M(k)} · ${M(b)}.`,
      explainEs: `Distribuye: ${M(k)} · ${cf(a, 'x')} y ${M(k)} · ${M(b)}.`,
    },
    {
      tokens: [
        tok('dax', cf(k * a, 'x'), 'var', { emph: 'result' }),
        tok('dop', kbOp, 'op'),
        tok('db', M(Math.abs(kb)), 'num', { emph: 'result' }),
        tok('cop', cOp, 'op'),
        tok('cx', cf(Math.abs(c), 'x'), 'var'),
        tok('rel', '=', 'rel'),
        tok('c0', M(d), 'num'),
      ],
      explainEn: `${M(k)} · ${cf(a, 'x')} = ${cf(k * a, 'x')} and ${M(k)} · ${M(b)} = ${M(kb)}. The parentheses are gone.`,
      explainEs: `${M(k)} · ${cf(a, 'x')} = ${cf(k * a, 'x')} y ${M(k)} · ${M(b)} = ${M(kb)}. Ya no hay paréntesis.`,
    },
    {
      tokens: [
        tok('dax', cf(k * a, 'x'), 'var', { emph: 'focus' }),
        tok('dop', kbOp, 'op'),
        tok('db', M(Math.abs(kb)), 'num'),
        tok('cop', cOp, 'op'),
        tok('cx', cf(Math.abs(c), 'x'), 'var', { emph: 'focus' }),
        tok('rel', '=', 'rel'),
        tok('c0', M(d), 'num'),
      ],
      explainEn: `Now combine the like terms: ${cf(k * a, 'x')} and ${cOp === '−' ? '−' : ''}${cf(Math.abs(c), 'x')}.`,
      explainEs: `Ahora combina los términos semejantes: ${cf(k * a, 'x')} y ${cOp === '−' ? '−' : ''}${cf(Math.abs(c), 'x')}.`,
    },
    {
      tokens: [
        tok('ax', cf(A, 'x'), 'var', { emph: 'result' }),
        tok('op', kbOp, 'op'),
        tok('b', M(Math.abs(kb)), 'num'),
        tok('rel', '=', 'rel'),
        tok('c0', M(d), 'num'),
      ],
      explainEn: `${cf(k * a, 'x')} ${cOp} ${cf(Math.abs(c), 'x')} = ${cf(A, 'x')}. A familiar two-step equation!`,
      explainEs: `${cf(k * a, 'x')} ${cOp} ${cf(Math.abs(c), 'x')} = ${cf(A, 'x')}. ¡Una ecuación de dos pasos conocida!`,
    },
    ...solveLinearSteps(A, kb, d, 'x', '=', x),
  ];

  return {
    id: `gen-multi-step-${k}-${a}-${b}-${c}-${x}`,
    titleEn: 'Your problem, step by step',
    titleEs: 'Tu problema, paso a paso',
    steps,
  };
}

/** slope_two_points template: line through (x1, y1) and (x2, y2). */
export function buildSlopeFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): EqScript | null {
  if (x2 === x1) return null;
  const rise = y2 - y1;
  const run = x2 - x1;
  const g = gcd(rise, run) || 1;
  // canonical form: positive denominator, sign on the numerator
  const sign = run < 0 ? -1 : 1;
  const sn = (rise / g) * sign;
  const sd = (run / g) * sign;

  const head = [tok('m', 'm', 'var'), tok('rel', '=', 'rel')];
  const steps: EqStep[] = [
    {
      tokens: [...head, ftok('fr', 'y₂ − y₁', 'x₂ − x₁')],
      explainEn: `Slope through (${M(x1)}, ${M(y1)}) and (${M(x2)}, ${M(y2)}): m is RISE (y-change) over RUN (x-change).`,
      explainEs: `Pendiente por (${M(x1)}, ${M(y1)}) y (${M(x2)}, ${M(y2)}): m es ELEVACIÓN (cambio en y) sobre AVANCE (cambio en x).`,
    },
    {
      tokens: [...head, ftok('fr', `${M(y2)} − (${M(y1)})`, `${M(x2)} − (${M(x1)})`, { emph: 'focus' })],
      explainEn: 'Substitute the points. Subtract in the SAME order on top and bottom.',
      explainEs: 'Sustituye los puntos. Resta en el MISMO orden arriba y abajo.',
    },
    {
      tokens: [...head, ftok('fr', M(rise), M(run), { emph: 'result' })],
      explainEn: `${M(y2)} − (${M(y1)}) = ${M(rise)} (the rise) and ${M(x2)} − (${M(x1)}) = ${M(run)} (the run).`,
      explainEs: `${M(y2)} − (${M(y1)}) = ${M(rise)} (la elevación) y ${M(x2)} − (${M(x1)}) = ${M(run)} (el avance).`,
    },
  ];

  if (sd === 1) {
    // the fraction collapses to an integer (0 rise included: 0/run → 0)
    steps.push({
      tokens: [...head, tok('fr', M(sn), 'num', { emph: 'result' })],
      explainEn: `Simplify: ${M(rise)} ÷ ${M(run)} = ${M(sn)}. The slope is ${M(sn)}.`,
      explainEs: `Simplifica: ${M(rise)} ÷ ${M(run)} = ${M(sn)}. La pendiente es ${M(sn)}.`,
      holdMs: 3000,
    });
  } else if (g > 1 || run < 0) {
    steps.push({
      tokens: [...head, ftok('fr', M(sn), M(sd), { emph: 'result' })],
      explainEn:
        run < 0 && g === 1
          ? `A negative bottom moves its sign to the top: the slope is ${M(sn)}/${M(sd)}.`
          : `Simplify: divide top and bottom by ${g}. The slope is ${M(sn)}/${M(sd)}.`,
      explainEs:
        run < 0 && g === 1
          ? `Un negativo abajo pasa su signo arriba: la pendiente es ${M(sn)}/${M(sd)}.`
          : `Simplifica: divide arriba y abajo entre ${g}. La pendiente es ${M(sn)}/${M(sd)}.`,
      holdMs: 3000,
    });
  } else {
    const last = steps[steps.length - 1];
    last.explainEn += ` Already in simplest form — the slope is ${M(sn)}/${M(sd)}.`;
    last.explainEs += ` Ya está en su forma más simple — la pendiente es ${M(sn)}/${M(sd)}.`;
    last.holdMs = 3000;
  }
  return {
    id: `gen-slope-${x1}-${y1}-${x2}-${y2}`,
    titleEn: 'Your problem, step by step',
    titleEs: 'Tu problema, paso a paso',
    steps,
  };
}

/** slope_intercept_rewrite template: −m·x + y = b → y = m·x + b, params {m, b}. */
export function buildSlopeInterceptRewrite(m: number, b: number): EqScript | null {
  if (m === 0) return null;
  const A = -m;
  const inv = A > 0 ? `− ${cf(A, 'x')}` : `+ ${cf(-A, 'x')}`;
  const bOp = b >= 0 ? '+' : '−';
  const lhs = [tok('a', cf(A, 'x'), 'var'), tok('plus', '+', 'op'), tok('y', 'y', 'var')];

  const steps: EqStep[] = [
    {
      tokens: [...lhs, tok('rel', '=', 'rel'), tok('b0', M(b), 'num')],
      explainEn: 'We want y ALONE on the left — that is slope-intercept form, y = mx + b.',
      explainEs: 'Queremos la y SOLA a la izquierda — esa es la forma pendiente-intercepto, y = mx + b.',
    },
    {
      tokens: [
        ...lhs,
        tok('gL', inv, 'op', { emph: 'apply' }),
        tok('rel', '=', 'rel'),
        tok('b0', M(b), 'num'),
        tok('gR', inv, 'op', { emph: 'apply' }),
      ],
      explainEn: `y has ${cf(A, 'x')} next to it. ${A > 0 ? 'Subtract' : 'Add'} ${cf(Math.abs(A), 'x')} on BOTH sides to remove it.`,
      explainEs: `La y tiene ${cf(A, 'x')} al lado. ${A > 0 ? 'Resta' : 'Suma'} ${cf(Math.abs(A), 'x')} en AMBOS lados para quitarlo.`,
    },
    {
      tokens: [
        tok('a', cf(A, 'x'), 'var', { emph: 'cancel' }),
        tok('plus', '+', 'op'),
        tok('y', 'y', 'var'),
        tok('gL', inv, 'op', { emph: 'cancel' }),
        tok('rel', '=', 'rel'),
        tok('b0', M(b), 'num', { emph: 'focus' }),
        tok('gR', inv, 'op', { emph: 'focus' }),
      ],
      explainEn: `${cf(A, 'x')} ${inv} cancels — they add to zero. Only y is left on the left side.`,
      explainEs: `${cf(A, 'x')} ${inv} se cancela — suman cero. Solo queda y en el lado izquierdo.`,
      holdMs: 3000,
    },
    {
      tokens: [
        tok('y', 'y', 'var'),
        tok('rel', '=', 'rel'),
        tok('mx', cf(m, 'x'), 'var', { emph: 'result' }),
        tok('bop', bOp, 'op'),
        tok('bb', M(Math.abs(b)), 'num', { emph: 'result' }),
      ],
      explainEn: `Write the x-term first: y = ${cf(m, 'x')} ${bOp} ${M(Math.abs(b))}. Slope m = ${M(m)}, y-intercept b = ${M(b)}!`,
      explainEs: `Escribe primero el término con x: y = ${cf(m, 'x')} ${bOp} ${M(Math.abs(b))}. ¡Pendiente m = ${M(m)}, intercepto en y b = ${M(b)}!`,
    },
  ];

  return {
    id: `gen-slope-int-${m}-${b}`,
    titleEn: 'Your problem, step by step',
    titleEs: 'Tu problema, paso a paso',
    steps,
  };
}

/**
 * Pick a builder from the problem's skill slug + params shape.
 * Returns null when no builder understands the problem.
 */
export function buildScriptForProblem(
  skillSlug: string | null | undefined,
  params: unknown,
): EqScript | null {
  if (!skillSlug || !params || typeof params !== 'object') return null;
  const p = params as Record<string, unknown>;
  const num = (k: string): number | null => (typeof p[k] === 'number' ? (p[k] as number) : null);

  // slope templates carry point/line params, not the {a, b, x} shape below
  if (skillSlug === 'slope-intercepts') {
    const [x1, y1, x2, y2] = [num('x1'), num('y1'), num('x2'), num('y2')];
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return buildSlopeFromPoints(x1, y1, x2, y2);
  }
  if (skillSlug === 'slope-intercept-form') {
    const m = num('m');
    const b = num('b');
    // identify_slope_yint (modified tier) also has {m, b} but adds `which` —
    // it's a read-off question, nothing to animate
    if (m === null || b === null || 'which' in p) return null;
    return buildSlopeInterceptRewrite(m, b);
  }

  const a = num('a');
  const b = num('b');
  const x = num('x');
  if (a === null || b === null || x === null || a === 0) return null;

  if (skillSlug === 'inequalities' && (p.baseOp === '>' || p.baseOp === '<')) {
    return buildTwoStepInequality(a, b, x, p.baseOp);
  }
  if (
    skillSlug === 'multi-step-equations' &&
    typeof p.k === 'number' &&
    typeof p.c === 'number'
  ) {
    return buildMultiStepEquation(p.k, a, b, p.c, x);
  }
  if (skillSlug === 'var-both-sides' && typeof p.c === 'number' && a - (p.c as number) !== 0) {
    return buildVarBothSides(a, b, p.c as number, x);
  }
  // two_step_equation instances (used by 3.1 and 3.2's modified tier)
  if (
    (skillSlug === 'multi-step-equations' || skillSlug === 'var-both-sides') &&
    !('c' in p) &&
    !('k' in p)
  ) {
    return buildTwoStepEquation(a, b, x);
  }
  return null;
}
