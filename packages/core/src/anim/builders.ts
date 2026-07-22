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

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
/** Unicode superscript for an exponent, e.g. 3 → "³". */
const sup = (n: number) => String(n).split('').map((d) => SUP[d] ?? d).join('');
/** "x" raised to a power as display text: xp(3) → "x³" (x¹ collapses to "x"). */
const xp = (e: number) => (e === 1 ? 'x' : `x${sup(e)}`);

const tok = (
  id: string,
  text: string,
  kind: TokenKind,
  extra?: Partial<{ emph: Emph; tight: boolean; row: 0 | 1 }>,
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

/** "+"/"−" operator for a signed value. */
const signOp = (n: number) => (n >= 0 ? '+' : '−');

/** Radical value as display text: rad(2) → "√2". */
const rad = (inner: number) => `√${inner}`;
/** Coefficient · radical: 1√2 → "√2", −1√2 → "−√2", 3√2 → "3√2". */
const radCf = (c: number, inner: number) =>
  c === 1 ? rad(inner) : c === -1 ? `−${rad(inner)}` : `${M(c)}${rad(inner)}`;

/**
 * Result tokens for a polynomial in standard form (highest degree first),
 * dropping zero terms — e.g. [{2,'x²'},{0,'x'},{−3,''}] → "2x² − 3". Emits a
 * single "0" when every term is zero. Ids are r0, r1… with ro1, ro2… operators.
 */
function standardFormTokens(terms: { coef: number; unit: string }[]): EqToken[] {
  const kept = terms.filter((t) => t.coef !== 0);
  if (kept.length === 0) return [tok('r0', '0', 'num', { emph: 'result' })];
  return kept.flatMap((t, i) => {
    const kind: TokenKind = t.unit ? 'var' : 'num';
    const text = t.unit
      ? cf(i === 0 ? t.coef : Math.abs(t.coef), t.unit)
      : M(i === 0 ? t.coef : Math.abs(t.coef));
    const term = tok(`r${i}`, text, kind, { emph: 'result' });
    return i === 0 ? [term] : [tok(`ro${i}`, signOp(t.coef), 'op'), term];
  });
}

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

/**
 * add_polynomials template: (a1x² + b1x + c1) ± (a2x² + b2x + c2),
 * params {a1, b1, c1, a2, b2, c2, sub}. Stacks the polynomials on two
 * rows (row: 1 tokens) so like terms line up in columns.
 */
export function buildAddPolynomials(
  a1: number,
  b1: number,
  c1: number,
  a2: number,
  b2: number,
  c2: number,
  sub: boolean,
): EqScript {
  // after distributing the minus sign, subtraction is addition of negated terms
  const n2 = sub ? -a2 : a2;
  const n1 = sub ? -b2 : b2;
  const n0 = sub ? -c2 : c2;
  const A = a1 + n2;
  const B = b1 + n1;
  const C = c1 + n0;

  const op = (v: number) => (v >= 0 ? '+' : '−');
  const topRow = (emph2?: Emph, emph1?: Emph, emph0?: Emph): EqToken[] => [
    tok('a2', cf(a1, 'x²'), 'var', emph2 ? { emph: emph2 } : undefined),
    tok('ao1', op(b1), 'op'),
    tok('a1', cf(Math.abs(b1), 'x'), 'var', emph1 ? { emph: emph1 } : undefined),
    tok('ao2', op(c1), 'op'),
    tok('a0', M(Math.abs(c1)), 'num', emph0 ? { emph: emph0 } : undefined),
  ];
  const secondPoly = (
    s2: number,
    s1: number,
    s0: number,
    row: 0 | 1,
    emphAll?: Emph,
    emph2?: Emph,
    emph1?: Emph,
    emph0?: Emph,
  ): EqToken[] => {
    const e = (own?: Emph) => (emphAll ?? own ? { emph: emphAll ?? own } : {});
    const r = row ? { row } : {};
    return [
      tok('mid', op(s2), 'op', { ...r, ...e() }),
      tok('b2', cf(Math.abs(s2), 'x²'), 'var', { ...r, ...e(emph2) }),
      tok('bo1', op(s1), 'op', { ...r, ...e() }),
      tok('b1', cf(Math.abs(s1), 'x'), 'var', { ...r, ...e(emph1) }),
      tok('bo2', op(s0), 'op', { ...r, ...e() }),
      tok('b0', M(Math.abs(s0)), 'num', { ...r, ...e(emph0) }),
    ];
  };

  // "3x² + 2x² = 5x²" for one column (handles zero results and constants)
  const col = (l: number, r: number, unit: string) => {
    const fmt = (v: number) => (unit ? cf(v, unit) : M(v));
    const sum = l + r;
    return `${fmt(l)} ${op(r)} ${unit ? cf(Math.abs(r), unit) : M(Math.abs(r))} = ${sum === 0 ? '0' : fmt(sum)}`;
  };

  const steps: EqStep[] = [
    {
      tokens: [
        tok('lp', '(', 'op'),
        ...topRow().map((tk, i) => (i === 0 ? { ...tk, tight: true } : tk)),
        tok('rp', ')', 'op', { tight: true }),
        tok('mid', sub ? '−' : '+', 'op'),
        tok('lq', '(', 'op'),
        tok('b2', cf(a2, 'x²'), 'var', { tight: true }),
        tok('bo1', op(b2), 'op'),
        tok('b1', cf(Math.abs(b2), 'x'), 'var'),
        tok('bo2', op(c2), 'op'),
        tok('b0', M(Math.abs(c2)), 'num'),
        tok('rq', ')', 'op', { tight: true }),
      ],
      explainEn: sub
        ? 'Careful: subtracting a polynomial means subtracting EVERY term inside.'
        : 'To ADD polynomials, combine like terms. Stack them so the like terms line up.',
      explainEs: sub
        ? 'Cuidado: restar un polinomio significa restar TODOS sus términos.'
        : 'Para SUMAR polinomios, combina los términos semejantes. Apílalos para que queden alineados.',
    },
  ];

  if (sub) {
    steps.push({
      tokens: [...topRow(), ...secondPoly(n2, n1, n0, 0, 'apply')],
      explainEn: 'Distribute the minus sign: it flips EVERY sign in the second polynomial.',
      explainEs: 'Distribuye el signo menos: cambia TODOS los signos del segundo polinomio.',
      holdMs: 3000,
    });
  }

  steps.push(
    {
      tokens: [...topRow(), ...secondPoly(n2, n1, n0, 1)],
      explainEn: 'Each column holds like terms: x² over x², x over x, numbers over numbers.',
      explainEs: 'Cada columna tiene términos semejantes: x² sobre x², x sobre x, números sobre números.',
    },
    {
      tokens: [...topRow('focus'), ...secondPoly(n2, n1, n0, 1, undefined, 'focus')],
      explainEn: `The x² column: ${col(a1, n2, 'x²')}.`,
      explainEs: `La columna de x²: ${col(a1, n2, 'x²')}.`,
    },
    {
      tokens: [...topRow(undefined, 'focus'), ...secondPoly(n2, n1, n0, 1, undefined, undefined, 'focus')],
      explainEn: `The x column: ${col(b1, n1, 'x')}.`,
      explainEs: `La columna de x: ${col(b1, n1, 'x')}.`,
    },
    {
      tokens: [
        ...topRow(undefined, undefined, 'focus'),
        ...secondPoly(n2, n1, n0, 1, undefined, undefined, undefined, 'focus'),
      ],
      explainEn: `The number column: ${col(c1, n0, '')}.`,
      explainEs: `La columna de números: ${col(c1, n0, '')}.`,
    },
  );

  // result in standard form, skipping zero terms
  const terms = [
    { v: A, unit: 'x²', kind: 'var' as TokenKind },
    { v: B, unit: 'x', kind: 'var' as TokenKind },
    { v: C, unit: '', kind: 'num' as TokenKind },
  ].filter((tm) => tm.v !== 0);
  const result: EqToken[] = terms.length
    ? terms.flatMap((tm, i) => {
        const text = tm.unit ? cf(i === 0 ? tm.v : Math.abs(tm.v), tm.unit) : M(i === 0 ? tm.v : Math.abs(tm.v));
        const term = tok(`s${i}`, text, tm.kind, { emph: 'result' });
        return i === 0 ? [term] : [tok(`so${i}`, op(tm.v), 'op'), term];
      })
    : [tok('s0', '0', 'num', { emph: 'result' })];
  const answer = result.map((tk, i) => (i === 0 ? tk.text : ` ${tk.text}`)).join('');
  steps.push({
    tokens: result,
    explainEn: `Put the columns together: ${answer}. Standard form — highest power first!`,
    explainEs: `Junta las columnas: ${answer}. Forma estándar — ¡la potencia mayor primero!`,
    holdMs: 3000,
  });

  return {
    id: `gen-poly-add-${a1}-${b1}-${c1}-${a2}-${b2}-${c2}-${sub ? 's' : 'a'}`,
    titleEn: 'Your problem, step by step',
    titleEs: 'Tu problema, paso a paso',
    steps,
  };
}

/**
 * foil template: (x + p)(x + q) → x² + (p+q)x + pq, params {p, q}.
 * Walks First · Outer · Inner · Last, shows the four products, then
 * combines the middle two like terms. Single row — both factors are
 * binomials in x. p, q are nonzero, so the constant term never vanishes;
 * the middle term can (p + q === 0), in which case it cancels away.
 */
export function buildFoil(p: number, q: number): EqScript {
  const B = p + q; // middle coefficient
  const C = p * q; // constant term (nonzero: p, q are nonzero)
  const op = (v: number) => (v >= 0 ? '+' : '−');
  const par = (v: number) => (v < 0 ? `(${M(v)})` : M(v));

  type Slot = 'x1' | 'p' | 'x2' | 'q';
  // (x + p)(x + q); pass a focus set to spotlight one FOIL pair.
  const factored = (focus: Slot[] = []): EqToken[] => {
    const f = (s: Slot) => (focus.includes(s) ? { emph: 'focus' as Emph } : {});
    return [
      tok('lp1', '(', 'op'),
      tok('x1', 'x', 'var', { tight: true, ...f('x1') }),
      tok('s1', op(p), 'op'),
      tok('p', M(Math.abs(p)), 'num', f('p')),
      tok('rp1', ')', 'op', { tight: true }),
      tok('lp2', '(', 'op'),
      tok('x2', 'x', 'var', { tight: true, ...f('x2') }),
      tok('s2', op(q), 'op'),
      tok('q', M(Math.abs(q)), 'num', f('q')),
      tok('rp2', ')', 'op', { tight: true }),
    ];
  };

  // x² + qx + px + pq — the four products. 'reveal' greens them all;
  // 'combine' spotlights the two middle (Outer + Inner) like terms.
  const products = (mode: 'reveal' | 'combine'): EqToken[] => {
    const res: Emph | undefined = mode === 'reveal' ? 'result' : undefined;
    const mid: Emph = mode === 'reveal' ? 'result' : 'focus';
    return [
      tok('F', 'x²', 'var', res ? { emph: res } : undefined),
      tok('opO', op(q), 'op'),
      tok('O', cf(Math.abs(q), 'x'), 'var', { emph: mid }),
      tok('opI', op(p), 'op'),
      tok('I', cf(Math.abs(p), 'x'), 'var', { emph: mid }),
      tok('opL', op(C), 'op'),
      tok('L', M(Math.abs(C)), 'num', res ? { emph: res } : undefined),
    ];
  };

  // final answer in standard form; drop the middle term when it cancels
  const finalTokens: EqToken[] =
    B === 0
      ? [tok('F', 'x²', 'var'), tok('opL', op(C), 'op'), tok('L', M(Math.abs(C)), 'num', { emph: 'result' })]
      : [
          tok('F', 'x²', 'var'),
          tok('opM', op(B), 'op'),
          tok('M', cf(Math.abs(B), 'x'), 'var', { emph: 'result' }),
          tok('opL', op(C), 'op'),
          tok('L', M(Math.abs(C)), 'num'),
        ];

  const fourProducts = `x² ${op(q)} ${cf(Math.abs(q), 'x')} ${op(p)} ${cf(Math.abs(p), 'x')} ${op(C)} ${M(Math.abs(C))}`;
  const mids = `${cf(q, 'x')} ${op(p)} ${cf(Math.abs(p), 'x')}`;
  const answer = B === 0 ? `x² ${op(C)} ${M(Math.abs(C))}` : `x² ${op(B)} ${cf(Math.abs(B), 'x')} ${op(C)} ${M(Math.abs(C))}`;

  const steps: EqStep[] = [
    {
      tokens: factored(),
      explainEn: 'Multiply two binomials with FOIL: First, Outer, Inner, Last — distribute 4 times, then combine like terms.',
      explainEs: 'Multiplica dos binomios con FOIL: Primeros, Externos, Internos, Últimos — distribuye 4 veces y luego combina términos semejantes.',
    },
    {
      tokens: factored(['x1', 'x2']),
      explainEn: 'First: multiply the first terms. x · x = x².',
      explainEs: 'Primeros: multiplica los primeros términos. x · x = x².',
    },
    {
      tokens: factored(['x1', 'q']),
      explainEn: `Outer: the outer pair. x · ${par(q)} = ${cf(q, 'x')}.`,
      explainEs: `Externos: el par de afuera. x · ${par(q)} = ${cf(q, 'x')}.`,
    },
    {
      tokens: factored(['p', 'x2']),
      explainEn: `Inner: the inner pair. ${par(p)} · x = ${cf(p, 'x')}.`,
      explainEs: `Internos: el par de adentro. ${par(p)} · x = ${cf(p, 'x')}.`,
    },
    {
      tokens: factored(['p', 'q']),
      explainEn: `Last: the last terms. ${par(p)} · ${par(q)} = ${M(C)}.`,
      explainEs: `Últimos: los últimos términos. ${par(p)} · ${par(q)} = ${M(C)}.`,
    },
    {
      tokens: products('reveal'),
      explainEn: `All four products: ${fourProducts}. Now combine like terms.`,
      explainEs: `Los cuatro productos: ${fourProducts}. Ahora combina los términos semejantes.`,
    },
    {
      tokens: products('combine'),
      explainEn:
        B === 0
          ? `The two middle terms are LIKE terms: ${mids} = 0 — they cancel.`
          : `The two middle terms are LIKE terms: ${mids} = ${cf(B, 'x')}.`,
      explainEs:
        B === 0
          ? `Los dos términos del medio son SEMEJANTES: ${mids} = 0 — se cancelan.`
          : `Los dos términos del medio son SEMEJANTES: ${mids} = ${cf(B, 'x')}.`,
      holdMs: 3000,
    },
    {
      tokens: finalTokens,
      explainEn: `The answer is ${answer}. Standard form lists the highest power first!`,
      explainEs: `La respuesta es ${answer}. La forma estándar pone primero la potencia mayor.`,
    },
  ];

  return {
    id: `gen-foil-${p}-${q}`,
    titleEn: 'Your problem, step by step',
    titleEs: 'Tu problema, paso a paso',
    steps,
  };
}

/**
 * gcf_monomials template: find the GCF of m1·x^e1 and m2·x^e2, params
 * {m1, m2, e1, e2}. Handles the coefficient GCF and the variable (smaller
 * exponent) as two separate beats, then combines them. Coefficients are
 * always ≥ 2 (both are multiples of a shared factor ≥ 2), so they always show.
 */
export function buildGcfMonomials(m1: number, m2: number, e1: number, e2: number): EqScript {
  const gc = gcd(m1, m2);
  const se = Math.min(e1, e2); // the shared variable uses the SMALLER power

  // one monomial as [coefficient, x-power] with independent emphasis
  const mono = (
    cId: string,
    vId: string,
    coef: number,
    e: number,
    cEmph?: Emph,
    vEmph?: Emph,
  ): EqToken[] => [
    tok(cId, M(coef), 'num', cEmph ? { emph: cEmph } : undefined),
    tok(vId, xp(e), 'var', { tight: true, ...(vEmph ? { emph: vEmph } : {}) }),
  ];
  // "m1x^e1, m2x^e2" — spotlight the coefficients or the variables
  const pair = (cEmph?: Emph, vEmph?: Emph): EqToken[] => [
    ...mono('m1c', 'm1v', m1, e1, cEmph, vEmph),
    tok('sep', ',', 'op', { tight: true }),
    ...mono('m2c', 'm2v', m2, e2, cEmph, vEmph),
  ];

  const steps: EqStep[] = [
    {
      tokens: pair(),
      explainEn: `Find the GCF of ${m1}${xp(e1)} and ${m2}${xp(e2)} — the biggest monomial that divides BOTH. Do the number and the variable separately.`,
      explainEs: `Encuentra el MCD de ${m1}${xp(e1)} y ${m2}${xp(e2)} — el mayor monomio que divide a AMBOS. Haz el número y la variable por separado.`,
    },
    {
      tokens: pair('focus'),
      explainEn: `First the coefficients: the GCF of ${m1} and ${m2} is ${gc}.`,
      explainEs: `Primero los coeficientes: el MCD de ${m1} y ${m2} es ${gc}.`,
    },
    {
      tokens: pair(undefined, 'focus'),
      explainEn: `Now the variable: both share x. Use the SMALLER exponent — ${xp(se)}.`,
      explainEs: `Ahora la variable: ambos tienen x. Usa el exponente MENOR — ${xp(se)}.`,
    },
    {
      tokens: [
        tok('rc', M(gc), 'num', { emph: 'result' }),
        tok('rv', xp(se), 'var', { emph: 'result', tight: true }),
      ],
      explainEn: `Put them together: the GCF is ${gc}${xp(se)}.`,
      explainEs: `Júntalos: el MCD es ${gc}${xp(se)}.`,
      holdMs: 3000,
    },
  ];

  return {
    id: `gen-gcf-mono-${m1}-${m2}-${e1}-${e2}`,
    titleEn: 'Find the GCF, step by step',
    titleEs: 'Encuentra el MCD, paso a paso',
    steps,
  };
}

/**
 * factor_gcf template: factor (g·a)x² + (g·b)x → g·x(a·x + b), params
 * {g, a, b} (g, a ≥ 2; b nonzero). Finds the GCF g·x of the two terms,
 * divides each term by it (shown as fractions), then writes the factored
 * form. Mirrors the template's own answer key: the GCF is g·x.
 */
export function buildFactorGcf(g: number, a: number, b: number): EqScript {
  const A1 = g * a; // x² coefficient (positive: g, a ≥ 2)
  const A2 = g * b; // x coefficient (signed)
  const absA2 = Math.abs(A2);
  const bOp = b >= 0 ? '+' : '−';
  const gx = `${M(g)}x`;

  // "A1x² ± A2x" with independent emphasis on coefficients / variables
  const poly = (c1?: Emph, v1?: Emph, c2?: Emph, v2?: Emph): EqToken[] => [
    tok('t1c', M(A1), 'num', c1 ? { emph: c1 } : undefined),
    tok('t1v', 'x²', 'var', { tight: true, ...(v1 ? { emph: v1 } : {}) }),
    tok('op', bOp, 'op'),
    tok('t2c', M(absA2), 'num', c2 ? { emph: c2 } : undefined),
    tok('t2v', 'x', 'var', { tight: true, ...(v2 ? { emph: v2 } : {}) }),
  ];

  const steps: EqStep[] = [
    {
      tokens: poly(),
      explainEn: `To factor ${A1}x² ${bOp} ${absA2}x, pull out the GCF — the biggest thing that divides BOTH terms.`,
      explainEs: `Para factorizar ${A1}x² ${bOp} ${absA2}x, saca el MCD — lo más grande que divide a AMBOS términos.`,
    },
    {
      tokens: poly('focus', undefined, 'focus', undefined),
      explainEn: `The coefficients ${A1} and ${absA2} share a factor of ${g}.`,
      explainEs: `Los coeficientes ${A1} y ${absA2} comparten un factor de ${g}.`,
    },
    {
      tokens: poly(undefined, 'focus', undefined, 'focus'),
      explainEn: `Both terms have an x too. So the GCF is ${gx}.`,
      explainEs: `Ambos términos también tienen x. Así que el MCD es ${gx}.`,
    },
    {
      tokens: [
        tok('gcf', gx, 'var', { emph: 'apply' }),
        tok('lp', '(', 'op', { tight: true }),
        ftok('q1', `${M(A1)}x²`, gx, { emph: 'focus' }),
        tok('op', bOp, 'op'),
        ftok('q2', `${M(absA2)}x`, gx, { emph: 'focus' }),
        tok('rp', ')', 'op', { tight: true }),
      ],
      explainEn: `Write ${gx} outside the parentheses and divide each term by it.`,
      explainEs: `Escribe ${gx} afuera del paréntesis y divide cada término entre él.`,
    },
    {
      tokens: [
        tok('gcf', gx, 'var'),
        tok('lp', '(', 'op', { tight: true }),
        tok('q1c', cf(a, 'x'), 'var', { emph: 'result', tight: true }),
        tok('op', bOp, 'op'),
        tok('q2c', M(Math.abs(b)), 'num', { emph: 'result' }),
        tok('rp', ')', 'op', { tight: true }),
      ],
      explainEn: `${A1}x² ÷ ${gx} = ${cf(a, 'x')} and ${absA2}x ÷ ${gx} = ${Math.abs(b)}. Factored: ${gx}(${cf(a, 'x')} ${bOp} ${Math.abs(b)}). Distribute ${gx} back to check!`,
      explainEs: `${A1}x² ÷ ${gx} = ${cf(a, 'x')} y ${absA2}x ÷ ${gx} = ${Math.abs(b)}. Factorizado: ${gx}(${cf(a, 'x')} ${bOp} ${Math.abs(b)}). ¡Distribuye ${gx} para verificar!`,
      holdMs: 3000,
    },
  ];

  return {
    id: `gen-factor-gcf-${g}-${a}-${b}`,
    titleEn: 'Factor out the GCF, step by step',
    titleEs: 'Factoriza el MCD, paso a paso',
    steps,
  };
}

/**
 * evaluate_expression template: evaluate a·x² + b·x + c at x = v, params
 * {a, b, c, v} (a, b, v nonzero; c may be 0). Substitutes (v) for each x,
 * squares/multiplies, then sums to the final value.
 */
export function buildEvaluateExpression(a: number, b: number, c: number, v: number): EqScript {
  const q2 = a * v * v; // value of the x² term
  const q1 = b * v; // value of the x term
  const ans = q2 + q1 + c;
  const hasC = c !== 0;
  const paren = `(${M(v)})`;

  // trailing "± c" tokens shared by the first two steps (dropped when c = 0)
  const cTail = (): EqToken[] =>
    hasC ? [tok('o0', signOp(c), 'op'), tok('t0', M(Math.abs(c)), 'num')] : [];

  const steps: EqStep[] = [
    {
      tokens: [
        tok('t2', cf(a, 'x²'), 'var'),
        tok('o1', signOp(b), 'op'),
        tok('t1', cf(Math.abs(b), 'x'), 'var'),
        ...cTail(),
      ],
      explainEn: `Evaluate ${cf(a, 'x²')} ${signOp(b)} ${cf(Math.abs(b), 'x')}${hasC ? ` ${signOp(c)} ${Math.abs(c)}` : ''} when x = ${M(v)}. "Evaluate" means: substitute the value in.`,
      explainEs: `Evalúa ${cf(a, 'x²')} ${signOp(b)} ${cf(Math.abs(b), 'x')}${hasC ? ` ${signOp(c)} ${Math.abs(c)}` : ''} cuando x = ${M(v)}. "Evaluar" significa: sustituye el valor.`,
    },
    {
      tokens: [
        tok('t2', cf(a, `${paren}²`), 'var', { emph: 'focus' }),
        tok('o1', signOp(b), 'op'),
        tok('t1', cf(Math.abs(b), paren), 'var', { emph: 'focus' }),
        ...cTail(),
      ],
      explainEn: `Substitute: every x becomes ${paren}. Keep the parentheses so the signs stay clear.`,
      explainEs: `Sustituye: cada x se convierte en ${paren}. Mantén los paréntesis para que los signos queden claros.`,
    },
    {
      tokens: [
        tok('t2', M(q2), 'num', { emph: 'result' }),
        tok('o1', signOp(q1), 'op'),
        tok('t1', M(Math.abs(q1)), 'num', { emph: 'result' }),
        ...cTail(),
      ],
      explainEn: `${paren}² = ${v * v}. Multiply: ${M(a)}·${v * v} = ${M(q2)} and ${M(b)}·${M(v)} = ${M(q1)} (do exponents and products before adding).`,
      explainEs: `${paren}² = ${v * v}. Multiplica: ${M(a)}·${v * v} = ${M(q2)} y ${M(b)}·${M(v)} = ${M(q1)} (exponentes y productos antes de sumar).`,
    },
    {
      tokens: [tok('r', M(ans), 'num', { emph: 'result' })],
      explainEn: `Add it up: ${M(q2)} ${signOp(q1)} ${Math.abs(q1)}${hasC ? ` ${signOp(c)} ${Math.abs(c)}` : ''} = ${M(ans)}. The expression is worth ${M(ans)} when x = ${M(v)}.`,
      explainEs: `Suma todo: ${M(q2)} ${signOp(q1)} ${Math.abs(q1)}${hasC ? ` ${signOp(c)} ${Math.abs(c)}` : ''} = ${M(ans)}. La expresión vale ${M(ans)} cuando x = ${M(v)}.`,
      holdMs: 3000,
    },
  ];

  return {
    id: `gen-evaluate-${a}-${b}-${c}-${v}`,
    titleEn: 'Evaluate the expression, step by step',
    titleEs: 'Evalúa la expresión, paso a paso',
    steps,
  };
}

/**
 * combine_like_terms template: simplify the out-of-order expression
 * b·x + e + a·x² + c·x + d into standard form, params {a, b, c, d, e}
 * (a, b, c, d nonzero; e ≥ 1). Groups the x-terms and the constants, then
 * writes a·x² + (b+c)·x + (e+d) highest-degree-first.
 */
export function buildCombineLikeTerms(a: number, b: number, c: number, d: number, e: number): EqScript {
  const xCo = b + c;
  const k = e + d;

  // the messy given order: bx + e + ax² + cx + d
  const messy = (xEmph?: Emph, kEmph?: Emph): EqToken[] => [
    tok('xb', cf(b, 'x'), 'var', xEmph ? { emph: xEmph } : undefined),
    tok('oe', '+', 'op'),
    tok('te', M(e), 'num', kEmph ? { emph: kEmph } : undefined),
    tok('oa', signOp(a), 'op'),
    tok('xa', cf(Math.abs(a), 'x²'), 'var'),
    tok('oc', signOp(c), 'op'),
    tok('xc', cf(Math.abs(c), 'x'), 'var', xEmph ? { emph: xEmph } : undefined),
    tok('od', signOp(d), 'op'),
    tok('td', M(Math.abs(d)), 'num', kEmph ? { emph: kEmph } : undefined),
  ];

  const steps: EqStep[] = [
    {
      tokens: messy(),
      explainEn: 'Simplify by combining like terms. The terms are out of order — group the ones that match.',
      explainEs: 'Simplifica combinando términos semejantes. Los términos están desordenados — agrupa los que coinciden.',
    },
    {
      tokens: messy('focus'),
      explainEn: `The x-terms are ${cf(b, 'x')} and ${cf(c, 'x')}: ${cf(b, 'x')} ${signOp(c)} ${cf(Math.abs(c), 'x')} = ${xCo === 0 ? '0' : cf(xCo, 'x')}.`,
      explainEs: `Los términos con x son ${cf(b, 'x')} y ${cf(c, 'x')}: ${cf(b, 'x')} ${signOp(c)} ${cf(Math.abs(c), 'x')} = ${xCo === 0 ? '0' : cf(xCo, 'x')}.`,
    },
    {
      tokens: messy(undefined, 'focus'),
      explainEn: `The constants are ${e} and ${M(d)}: ${e} ${signOp(d)} ${Math.abs(d)} = ${M(k)}. (${cf(a, 'x²')} has no like term — it stays.)`,
      explainEs: `Las constantes son ${e} y ${M(d)}: ${e} ${signOp(d)} ${Math.abs(d)} = ${M(k)}. (${cf(a, 'x²')} no tiene semejante — se queda.)`,
    },
    {
      tokens: standardFormTokens([
        { coef: a, unit: 'x²' },
        { coef: xCo, unit: 'x' },
        { coef: k, unit: '' },
      ]),
      explainEn: `Standard form lists highest degree first: ${cf(a, 'x²')}${xCo ? ` ${signOp(xCo)} ${cf(Math.abs(xCo), 'x')}` : ''}${k ? ` ${signOp(k)} ${Math.abs(k)}` : ''}.`,
      explainEs: `La forma estándar pone primero el mayor grado: ${cf(a, 'x²')}${xCo ? ` ${signOp(xCo)} ${cf(Math.abs(xCo), 'x')}` : ''}${k ? ` ${signOp(k)} ${Math.abs(k)}` : ''}.`,
      holdMs: 3000,
    },
  ];

  return {
    id: `gen-combine-${a}-${b}-${c}-${d}-${e}`,
    titleEn: 'Combine like terms, step by step',
    titleEs: 'Combina términos semejantes, paso a paso',
    steps,
  };
}

/**
 * distribute_simplify template: simplify k(a·x + b) + c·x + d into standard
 * form, params {k, a, b, c, d} (all nonzero except d may be 0-ranged).
 * Distributes k, then combines like terms into (k·a+c)·x + (k·b+d).
 */
export function buildDistributeSimplify(k: number, a: number, b: number, c: number, d: number): EqScript {
  const xCo = k * a + c;
  const kk = k * b + d;

  // trailing "+ cx + d" — the terms outside the parentheses, unchanged early on
  const tail = (): EqToken[] => [
    tok('oc', signOp(c), 'op'),
    tok('cx', cf(Math.abs(c), 'x'), 'var'),
    tok('od', signOp(d), 'op'),
    tok('td', M(Math.abs(d)), 'num'),
  ];

  const steps: EqStep[] = [
    {
      tokens: [
        tok('k', M(k), 'num'),
        tok('lp', '(', 'op', { tight: true }),
        tok('ia', cf(a, 'x'), 'var', { tight: true }),
        tok('io', signOp(b), 'op'),
        tok('ib', M(Math.abs(b)), 'num'),
        tok('rp', ')', 'op', { tight: true }),
        ...tail(),
      ],
      explainEn: `Simplify. First distribute the ${M(k)} to EACH term inside the parentheses.`,
      explainEs: `Simplifica. Primero distribuye el ${M(k)} a CADA término dentro del paréntesis.`,
    },
    {
      tokens: [
        tok('k', M(k), 'num', { emph: 'focus' }),
        tok('lp', '(', 'op', { tight: true }),
        tok('ia', cf(a, 'x'), 'var', { tight: true, emph: 'focus' }),
        tok('io', signOp(b), 'op'),
        tok('ib', M(Math.abs(b)), 'num', { emph: 'focus' }),
        tok('rp', ')', 'op', { tight: true }),
        ...tail(),
      ],
      explainEn: `Distribute: ${M(k)}·${cf(a, 'x')} = ${cf(k * a, 'x')} and ${M(k)}·${M(b)} = ${M(k * b)}.`,
      explainEs: `Distribuye: ${M(k)}·${cf(a, 'x')} = ${cf(k * a, 'x')} y ${M(k)}·${M(b)} = ${M(k * b)}.`,
    },
    {
      tokens: [
        tok('dax', cf(k * a, 'x'), 'var', { emph: 'result' }),
        tok('dob', signOp(k * b), 'op'),
        tok('db', M(Math.abs(k * b)), 'num', { emph: 'result' }),
        ...tail(),
      ],
      explainEn: `The parentheses are gone: ${cf(k * a, 'x')} ${signOp(k * b)} ${Math.abs(k * b)} ${signOp(c)} ${cf(Math.abs(c), 'x')} ${signOp(d)} ${Math.abs(d)}. Now combine like terms.`,
      explainEs: `Ya no hay paréntesis: ${cf(k * a, 'x')} ${signOp(k * b)} ${Math.abs(k * b)} ${signOp(c)} ${cf(Math.abs(c), 'x')} ${signOp(d)} ${Math.abs(d)}. Ahora combina términos semejantes.`,
    },
    {
      tokens: standardFormTokens([
        { coef: xCo, unit: 'x' },
        { coef: kk, unit: '' },
      ]),
      explainEn: `Combine: ${cf(k * a, 'x')} ${signOp(c)} ${cf(Math.abs(c), 'x')} = ${xCo === 0 ? '0' : cf(xCo, 'x')}, and ${M(k * b)} ${signOp(d)} ${Math.abs(d)} = ${M(kk)}.`,
      explainEs: `Combina: ${cf(k * a, 'x')} ${signOp(c)} ${cf(Math.abs(c), 'x')} = ${xCo === 0 ? '0' : cf(xCo, 'x')}, y ${M(k * b)} ${signOp(d)} ${Math.abs(d)} = ${M(kk)}.`,
      holdMs: 3000,
    },
  ];

  return {
    id: `gen-distribute-${k}-${a}-${b}-${c}-${d}`,
    titleEn: 'Distribute and simplify, step by step',
    titleEs: 'Distribuye y simplifica, paso a paso',
    steps,
  };
}

/**
 * factor_trinomial template: x² + B·x + C → (x + p)(x + q), params {p, q}
 * (p, q nonzero and distinct; B = p+q, C = p·q). The reverse of FOIL: find
 * the pair that multiplies to C and adds to B. Uses the same factored-form
 * token layout as buildFoil. B can be 0 (then the middle term is absent).
 */
export function buildFactorTrinomial(p: number, q: number): EqScript {
  const B = p + q;
  const C = p * q;

  // x² ± Bx ± C — the middle term is dropped when B = 0
  const trinomial = (cEmph?: Emph, bEmph?: Emph): EqToken[] => [
    tok('x2', 'x²', 'var'),
    ...(B !== 0
      ? [tok('ob', signOp(B), 'op'), tok('bx', cf(Math.abs(B), 'x'), 'var', bEmph ? { emph: bEmph } : undefined)]
      : []),
    tok('oc', signOp(C), 'op'),
    tok('c', M(Math.abs(C)), 'num', cEmph ? { emph: cEmph } : undefined),
  ];

  // (x + p)(x + q) — same ids/layout as buildFoil's factored form
  const factored = (emph?: Emph): EqToken[] => [
    tok('lp1', '(', 'op'),
    tok('x1', 'x', 'var', { tight: true }),
    tok('s1', signOp(p), 'op'),
    tok('p', M(Math.abs(p)), 'num', emph ? { emph } : undefined),
    tok('rp1', ')', 'op', { tight: true }),
    tok('lp2', '(', 'op'),
    tok('x2b', 'x', 'var', { tight: true }),
    tok('s2', signOp(q), 'op'),
    tok('q', M(Math.abs(q)), 'num', emph ? { emph } : undefined),
    tok('rp2', ')', 'op', { tight: true }),
  ];

  const bTxt = B === 0 ? '0' : M(B);
  const steps: EqStep[] = [
    {
      tokens: trinomial(),
      explainEn: `Factor this trinomial: find two numbers that MULTIPLY to ${M(C)} and ADD to ${bTxt}.`,
      explainEs: `Factoriza este trinomio: encuentra dos números que MULTIPLIQUEN a ${M(C)} y SUMEN ${bTxt}.`,
    },
    {
      tokens: trinomial('focus'),
      explainEn: `The two numbers must multiply to the constant, ${M(C)}.`,
      explainEs: `Los dos números deben multiplicarse para dar la constante, ${M(C)}.`,
    },
    {
      tokens: trinomial(undefined, 'focus'),
      explainEn:
        B === 0
          ? `…and add to 0, so they are opposites. ${M(p)} and ${M(q)} work: ${M(p)}·${M(q)} = ${M(C)}, ${M(p)} + ${M(q)} = 0.`
          : `…and add to the middle coefficient, ${M(B)}. ${M(p)} and ${M(q)} work: ${M(p)}·${M(q)} = ${M(C)}, ${M(p)} + ${M(q)} = ${M(B)}.`,
      explainEs:
        B === 0
          ? `…y sumen 0, así que son opuestos. ${M(p)} y ${M(q)} funcionan: ${M(p)}·${M(q)} = ${M(C)}, ${M(p)} + ${M(q)} = 0.`
          : `…y sumen el coeficiente del medio, ${M(B)}. ${M(p)} y ${M(q)} funcionan: ${M(p)}·${M(q)} = ${M(C)}, ${M(p)} + ${M(q)} = ${M(B)}.`,
    },
    {
      tokens: factored('result'),
      explainEn: `Put each number into its own binomial: (x ${signOp(p)} ${Math.abs(p)})(x ${signOp(q)} ${Math.abs(q)}). FOIL it to check!`,
      explainEs: `Pon cada número en su propio binomio: (x ${signOp(p)} ${Math.abs(p)})(x ${signOp(q)} ${Math.abs(q)}). ¡Compruébalo con FOIL!`,
      holdMs: 3000,
    },
  ];

  return {
    id: `gen-factor-tri-${p}-${q}`,
    titleEn: 'Factor the trinomial, step by step',
    titleEs: 'Factoriza el trinomio, paso a paso',
    steps,
  };
}

/**
 * dots template: difference of two squares a²·x² − b² → (a·x + b)(a·x − b),
 * params {a, b} (a ≥ 1, b ≥ 1). Rewrites each term as a perfect square, then
 * writes the two conjugate binomials.
 */
export function buildDots(a: number, b: number): EqScript {
  const aTxt = a === 1 ? 'x' : `${M(a)}x`;

  const steps: EqStep[] = [
    {
      tokens: [
        tok('sq1', a === 1 ? 'x²' : `${M(a * a)}x²`, 'var'),
        tok('op', '−', 'op'),
        tok('sq2', M(b * b), 'num'),
      ],
      explainEn: `Two perfect squares with a MINUS between them — that's a difference of squares (DOTS).`,
      explainEs: `Dos cuadrados perfectos con un MENOS en medio — es una diferencia de cuadrados (DOTS).`,
    },
    {
      tokens: [
        tok('sq1', `(${aTxt})²`, 'var', { emph: 'focus' }),
        tok('op', '−', 'op'),
        tok('sq2', `(${M(b)})²`, 'num', { emph: 'focus' }),
      ],
      explainEn: `Write each as a square: √(${a === 1 ? '' : a * a}x²) = ${aTxt}, and √${b * b} = ${b}. So it's (${aTxt})² − (${b})².`,
      explainEs: `Escribe cada uno como cuadrado: √(${a === 1 ? '' : a * a}x²) = ${aTxt}, y √${b * b} = ${b}. Así que es (${aTxt})² − (${b})².`,
    },
    {
      tokens: [
        tok('lp1', '(', 'op'),
        tok('r1', aTxt, 'var', { tight: true, emph: 'result' }),
        tok('s1', '+', 'op'),
        tok('b1', M(b), 'num', { emph: 'result' }),
        tok('rp1', ')', 'op', { tight: true }),
        tok('lp2', '(', 'op'),
        tok('r2', aTxt, 'var', { tight: true, emph: 'result' }),
        tok('s2', '−', 'op'),
        tok('b2', M(b), 'num', { emph: 'result' }),
        tok('rp2', ')', 'op', { tight: true }),
      ],
      explainEn: `DOTS factors into the SAME two terms with opposite signs: (${aTxt} + ${b})(${aTxt} − ${b}). FOIL to check — the middle terms cancel.`,
      explainEs: `DOTS se factoriza en los MISMOS dos términos con signos opuestos: (${aTxt} + ${b})(${aTxt} − ${b}). Comprueba con FOIL — los términos del medio se cancelan.`,
      holdMs: 3000,
    },
  ];

  return {
    id: `gen-dots-${a}-${b}`,
    titleEn: 'Factor with DOTS, step by step',
    titleEs: 'Factoriza con DOTS, paso a paso',
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
 * exponent_product_rule template: xᵃ · xᵇ → xᵃ⁺ᵇ, params {a, b} (a, b ≥ 2).
 * Same base → add the exponents.
 */
export function buildExponentProduct(a: number, b: number): EqScript {
  const steps: EqStep[] = [
    {
      tokens: [tok('xa', xp(a), 'var'), tok('mul', '·', 'op'), tok('xb', xp(b), 'var')],
      explainEn: `Multiply ${xp(a)} · ${xp(b)}. The base x is the SAME in both.`,
      explainEs: `Multiplica ${xp(a)} · ${xp(b)}. La base x es la MISMA en ambos.`,
    },
    {
      tokens: [
        tok('xa', xp(a), 'var', { emph: 'focus' }),
        tok('mul', '·', 'op'),
        tok('xb', xp(b), 'var', { emph: 'focus' }),
      ],
      explainEn: `Same base → ADD the exponents: ${a} + ${b} = ${a + b}.`,
      explainEs: `Misma base → SUMA los exponentes: ${a} + ${b} = ${a + b}.`,
    },
    {
      tokens: [tok('r', xp(a + b), 'var', { emph: 'result' })],
      explainEn: `${xp(a)} · ${xp(b)} = ${xp(a + b)}.`,
      explainEs: `${xp(a)} · ${xp(b)} = ${xp(a + b)}.`,
      holdMs: 3000,
    },
  ];
  return {
    id: `gen-exp-prod-${a}-${b}`,
    titleEn: 'Multiply powers, step by step',
    titleEs: 'Multiplica potencias, paso a paso',
    steps,
  };
}

/**
 * simplify_radical template: √(outer²·inner) → outer√inner, params
 * {outer, inner}. Pull the largest perfect square out of the radical.
 */
export function buildSimplifyRadical(outer: number, inner: number): EqScript {
  const n = outer * outer * inner;
  const sq = outer * outer;
  const steps: EqStep[] = [
    {
      tokens: [tok('r', rad(n), 'num')],
      explainEn: `Simplify ${rad(n)}. Find the largest PERFECT SQUARE that divides ${n} — it is ${sq} (= ${outer}²).`,
      explainEs: `Simplifica ${rad(n)}. Encuentra el CUADRADO PERFECTO más grande que divide a ${n} — es ${sq} (= ${outer}²).`,
    },
    {
      tokens: [
        tok('sq', rad(sq), 'num', { emph: 'focus' }),
        tok('mul', '·', 'op'),
        tok('inr', rad(inner), 'num'),
      ],
      explainEn: `${n} = ${sq} · ${inner}, so ${rad(n)} = ${rad(sq)} · ${rad(inner)}. Split the radical.`,
      explainEs: `${n} = ${sq} · ${inner}, así que ${rad(n)} = ${rad(sq)} · ${rad(inner)}. Separa el radical.`,
    },
    {
      tokens: [
        tok('o', String(outer), 'num', { emph: 'result' }),
        tok('inr', rad(inner), 'num', { emph: 'result', tight: true }),
      ],
      explainEn: `${rad(sq)} = ${outer}. The ${rad(inner)} has no perfect square left, so ${rad(n)} = ${outer}${rad(inner)}.`,
      explainEs: `${rad(sq)} = ${outer}. El ${rad(inner)} ya no tiene cuadrado perfecto, así que ${rad(n)} = ${outer}${rad(inner)}.`,
      holdMs: 3000,
    },
  ];
  return {
    id: `gen-simp-rad-${outer}-${inner}`,
    titleEn: 'Simplify the radical, step by step',
    titleEs: 'Simplifica el radical, paso a paso',
    steps,
  };
}

/**
 * radical_add template: c1√k ± c2√k → (c1+c2)√k, params {inner, c1, c2}
 * (like radicals — same radicand — so combine the coefficients).
 */
export function buildRadicalAdd(inner: number, c1: number, c2: number): EqScript {
  const sum = c1 + c2;
  const result: EqToken[] =
    sum === 0
      ? [tok('r', '0', 'num', { emph: 'result' })]
      : [tok('r', radCf(sum, inner), 'num', { emph: 'result' })];
  const steps: EqStep[] = [
    {
      tokens: [
        tok('t1', radCf(c1, inner), 'num'),
        tok('op', signOp(c2), 'op'),
        tok('t2', radCf(Math.abs(c2), inner), 'num'),
      ],
      explainEn: `${radCf(c1, inner)} and ${radCf(c2, inner)} are LIKE radicals — same ${rad(inner)}. Combine the coefficients.`,
      explainEs: `${radCf(c1, inner)} y ${radCf(c2, inner)} son radicales SEMEJANTES — el mismo ${rad(inner)}. Combina los coeficientes.`,
    },
    {
      tokens: [
        tok('t1', radCf(c1, inner), 'num', { emph: 'focus' }),
        tok('op', signOp(c2), 'op'),
        tok('t2', radCf(Math.abs(c2), inner), 'num', { emph: 'focus' }),
      ],
      explainEn: `${c1} ${signOp(c2)} ${Math.abs(c2)} = ${sum}. The radical ${rad(inner)} stays the same.`,
      explainEs: `${c1} ${signOp(c2)} ${Math.abs(c2)} = ${sum}. El radical ${rad(inner)} no cambia.`,
    },
    {
      tokens: result,
      explainEn:
        sum === 0
          ? `The coefficients cancel to 0, so the whole expression is 0.`
          : `Put it together: ${radCf(sum, inner)}.`,
      explainEs:
        sum === 0
          ? `Los coeficientes se cancelan a 0, así que toda la expresión es 0.`
          : `Júntalo: ${radCf(sum, inner)}.`,
      holdMs: 3000,
    },
  ];
  return {
    id: `gen-rad-add-${inner}-${c1}-${c2}`,
    titleEn: 'Add like radicals, step by step',
    titleEs: 'Suma radicales semejantes, paso a paso',
    steps,
  };
}

/**
 * radical_multiply template: √a · √b → √(ab), params {a, b}. Multiply the
 * radicands; collapse to an integer when the product is a perfect square.
 */
export function buildRadicalMultiply(a: number, b: number): EqScript {
  const prod = a * b;
  const root = Math.sqrt(prod);
  const perfect = Number.isInteger(root);
  const steps: EqStep[] = [
    {
      tokens: [tok('ra', rad(a), 'num'), tok('mul', '·', 'op'), tok('rb', rad(b), 'num')],
      explainEn: `Multiply radicals by multiplying what's INSIDE: ${rad(a)} · ${rad(b)} = √(${a}·${b}).`,
      explainEs: `Multiplica radicales multiplicando lo de ADENTRO: ${rad(a)} · ${rad(b)} = √(${a}·${b}).`,
    },
    {
      tokens: [tok('r', rad(prod), 'num', { emph: perfect ? 'focus' : 'result' })],
      explainEn: perfect
        ? `${a} · ${b} = ${prod}, so we get ${rad(prod)}. And ${prod} is a perfect square…`
        : `${a} · ${b} = ${prod}, so ${rad(a)} · ${rad(b)} = ${rad(prod)} — already simplest.`,
      explainEs: perfect
        ? `${a} · ${b} = ${prod}, así que obtenemos ${rad(prod)}. Y ${prod} es un cuadrado perfecto…`
        : `${a} · ${b} = ${prod}, así que ${rad(a)} · ${rad(b)} = ${rad(prod)} — ya es lo más simple.`,
      ...(perfect ? {} : { holdMs: 3000 }),
    },
  ];
  if (perfect) {
    steps.push({
      tokens: [tok('r2', String(root), 'num', { emph: 'result' })],
      explainEn: `${rad(prod)} = ${root}.`,
      explainEs: `${rad(prod)} = ${root}.`,
      holdMs: 3000,
    });
  }
  return {
    id: `gen-rad-mul-${a}-${b}`,
    titleEn: 'Multiply radicals, step by step',
    titleEs: 'Multiplica radicales, paso a paso',
    steps,
  };
}

/**
 * evaluate_function template: f(x) = a·x² + b evaluated at x = v, params
 * {a, b, v} (a, b, v nonzero). Substitute (v) for x, square, then add.
 */
export function buildEvaluateFunction(a: number, b: number, v: number): EqScript {
  const q2 = a * v * v;
  const ans = q2 + b;
  const paren = `(${M(v)})`;
  const tail = (): EqToken[] => [tok('o0', signOp(b), 'op'), tok('t0', M(Math.abs(b)), 'num')];
  const steps: EqStep[] = [
    {
      tokens: [tok('t2', cf(a, 'x²'), 'var'), ...tail()],
      explainEn: `f(x) = ${cf(a, 'x²')} ${signOp(b)} ${Math.abs(b)}. To find f(${M(v)}), INPUT ${M(v)} for x.`,
      explainEs: `f(x) = ${cf(a, 'x²')} ${signOp(b)} ${Math.abs(b)}. Para hallar f(${M(v)}), INGRESA ${M(v)} por x.`,
    },
    {
      tokens: [tok('t2', cf(a, `${paren}²`), 'var', { emph: 'focus' }), ...tail()],
      explainEn: `Substitute: every x becomes ${paren}. Keep the parentheses so the sign is clear.`,
      explainEs: `Sustituye: cada x se convierte en ${paren}. Mantén los paréntesis para que el signo quede claro.`,
    },
    {
      tokens: [tok('t2', M(q2), 'num', { emph: 'result' }), ...tail()],
      explainEn: `${paren}² = ${v * v}${v < 0 ? ' (a negative squared is positive)' : ''}, and ${M(a)}·${v * v} = ${M(q2)}.`,
      explainEs: `${paren}² = ${v * v}${v < 0 ? ' (un negativo al cuadrado es positivo)' : ''}, y ${M(a)}·${v * v} = ${M(q2)}.`,
    },
    {
      tokens: [tok('r', M(ans), 'num', { emph: 'result' })],
      explainEn: `${M(q2)} ${signOp(b)} ${Math.abs(b)} = ${M(ans)}. So f(${M(v)}) = ${M(ans)}.`,
      explainEs: `${M(q2)} ${signOp(b)} ${Math.abs(b)} = ${M(ans)}. Así que f(${M(v)}) = ${M(ans)}.`,
      holdMs: 3000,
    },
  ];
  return {
    id: `gen-eval-fn-${a}-${b}-${v}`,
    titleEn: 'Evaluate the function, step by step',
    titleEs: 'Evalúa la función, paso a paso',
    steps,
  };
}

/**
 * solve_sqrt_method template: a·x² − c = 0 (c = a·x²) → x = ±x, params
 * {a, x}. Isolate x², divide out a, then square-root both sides (± beat).
 */
export function buildSolveSqrt(a: number, x: number): EqScript {
  const c = a * x * x;
  const steps: EqStep[] = [
    {
      tokens: [
        tok('ax', cf(a, 'x²'), 'var'),
        tok('mns', '−', 'op'),
        tok('c', M(c), 'num'),
        tok('rel', '=', 'rel'),
        tok('z', '0', 'num'),
      ],
      explainEn: `Solve with square roots. First isolate x²: undo the − ${c}.`,
      explainEs: `Resuelve con raíces cuadradas. Primero aísla x²: deshaz el − ${c}.`,
    },
    {
      tokens: [
        tok('ax', cf(a, 'x²'), 'var'),
        tok('mns', '−', 'op'),
        tok('c', M(c), 'num'),
        tok('addL', `+ ${c}`, 'op', { emph: 'apply' }),
        tok('rel', '=', 'rel'),
        tok('z', '0', 'num'),
        tok('addR', `+ ${c}`, 'op', { emph: 'apply' }),
      ],
      explainEn: `Add ${c} to BOTH sides.`,
      explainEs: `Suma ${c} a AMBOS lados.`,
    },
    {
      tokens: [tok('ax', cf(a, 'x²'), 'var'), tok('rel', '=', 'rel'), tok('c', M(c), 'num', { emph: 'result' })],
      explainEn: `${cf(a, 'x²')} = ${c}.`,
      explainEs: `${cf(a, 'x²')} = ${c}.`,
    },
  ];
  if (a > 1) {
    steps.push(
      {
        tokens: [
          tok('ax', cf(a, 'x²'), 'var'),
          tok('dL', `÷ ${a}`, 'op', { emph: 'apply' }),
          tok('rel', '=', 'rel'),
          tok('c', M(c), 'num'),
          tok('dR', `÷ ${a}`, 'op', { emph: 'apply' }),
        ],
        explainEn: `Divide BOTH sides by ${a} to get x² alone.`,
        explainEs: `Divide AMBOS lados entre ${a} para dejar x² sola.`,
      },
      {
        tokens: [tok('x2', 'x²', 'var'), tok('rel', '=', 'rel'), tok('xsq', M(x * x), 'num', { emph: 'result' })],
        explainEn: `x² = ${c} ÷ ${a} = ${x * x}.`,
        explainEs: `x² = ${c} ÷ ${a} = ${x * x}.`,
      },
    );
  }
  steps.push({
    tokens: [tok('x', 'x', 'var'), tok('rel', '=', 'rel'), tok('pm', `±${M(x)}`, 'num', { emph: 'result' })],
    explainEn: `Square-root BOTH sides — a positive number has TWO roots, so remember ±. x = ±${x}.`,
    explainEs: `Saca la raíz cuadrada en AMBOS lados — un número positivo tiene DOS raíces, así que recuerda ±. x = ±${x}.`,
    holdMs: 3400,
  });
  return {
    id: `gen-solve-sqrt-${a}-${x}`,
    titleEn: 'Solve with square roots, step by step',
    titleEs: 'Resuelve con raíces, paso a paso',
    steps,
  };
}

/**
 * solve_quadratic_factoring template: x² + Bx + C = 0 → (x+p)(x+q) = 0 →
 * x = −p, −q, params {p, q}. Factor (reverse FOIL), then Zero-Product.
 */
export function buildSolveQuadraticFactoring(p: number, q: number): EqScript {
  const B = p + q;
  const C = p * q;
  const trinomial = (cEmph?: Emph, bEmph?: Emph): EqToken[] => [
    tok('x2', 'x²', 'var'),
    ...(B !== 0
      ? [tok('ob', signOp(B), 'op'), tok('bx', cf(Math.abs(B), 'x'), 'var', bEmph ? { emph: bEmph } : undefined)]
      : []),
    tok('oc', signOp(C), 'op'),
    tok('c', M(Math.abs(C)), 'num', cEmph ? { emph: cEmph } : undefined),
    tok('rel', '=', 'rel'),
    tok('z', '0', 'num'),
  ];
  const factored = (emph?: Emph): EqToken[] => [
    tok('lp1', '(', 'op'),
    tok('x1', 'x', 'var', { tight: true }),
    tok('s1', signOp(p), 'op'),
    tok('p', M(Math.abs(p)), 'num', emph ? { emph } : undefined),
    tok('rp1', ')', 'op', { tight: true }),
    tok('lp2', '(', 'op'),
    tok('x2b', 'x', 'var', { tight: true }),
    tok('s2', signOp(q), 'op'),
    tok('q', M(Math.abs(q)), 'num', emph ? { emph } : undefined),
    tok('rp2', ')', 'op', { tight: true }),
    tok('rel', '=', 'rel'),
    tok('z', '0', 'num'),
  ];
  const bTxt = B === 0 ? '0' : M(B);
  const steps: EqStep[] = [
    {
      tokens: trinomial(),
      explainEn: `Solve by factoring. Find two numbers that MULTIPLY to ${M(C)} and ADD to ${bTxt}.`,
      explainEs: `Resuelve factorizando. Encuentra dos números que MULTIPLIQUEN a ${M(C)} y SUMEN ${bTxt}.`,
    },
    {
      tokens: trinomial('focus', 'focus'),
      explainEn: `${M(p)} and ${M(q)} work: ${M(p)}·${M(q)} = ${M(C)} and ${M(p)} + ${M(q)} = ${bTxt}.`,
      explainEs: `${M(p)} y ${M(q)} funcionan: ${M(p)}·${M(q)} = ${M(C)} y ${M(p)} + ${M(q)} = ${bTxt}.`,
    },
    {
      tokens: factored('focus'),
      explainEn: `Factor: (x ${signOp(p)} ${Math.abs(p)})(x ${signOp(q)} ${Math.abs(q)}) = 0. Zero-Product: set each factor = 0.`,
      explainEs: `Factoriza: (x ${signOp(p)} ${Math.abs(p)})(x ${signOp(q)} ${Math.abs(q)}) = 0. Producto Cero: iguala cada factor a 0.`,
    },
    {
      tokens: [
        tok('x', 'x', 'var'),
        tok('rel', '=', 'rel'),
        tok('r1', M(-p), 'num', { emph: 'result' }),
        tok('comma', ',', 'op', { tight: true }),
        tok('r2', M(-q), 'num', { emph: 'result' }),
      ],
      explainEn: `x ${signOp(p)} ${Math.abs(p)} = 0 gives x = ${M(-p)}; x ${signOp(q)} ${Math.abs(q)} = 0 gives x = ${M(-q)}.`,
      explainEs: `x ${signOp(p)} ${Math.abs(p)} = 0 da x = ${M(-p)}; x ${signOp(q)} ${Math.abs(q)} = 0 da x = ${M(-q)}.`,
      holdMs: 3400,
    },
  ];
  return {
    id: `gen-solve-quad-${p}-${q}`,
    titleEn: 'Solve by factoring, step by step',
    titleEs: 'Resuelve factorizando, paso a paso',
    steps,
  };
}

/**
 * projectile_ground template: h(t) = −16t² + v·t, find when h = 0 (v = 16T),
 * params {t} (= the landing time T). Set = 0, factor the GCF −16t, then the
 * ball lands at t = T (t = 0 is the throw).
 */
export function buildProjectileGround(T: number): EqScript {
  const v = 16 * T;
  const steps: EqStep[] = [
    {
      tokens: [
        tok('h2', '−16t²', 'var'),
        tok('op', '+', 'op'),
        tok('h1', `${v}t`, 'var'),
        tok('rel', '=', 'rel'),
        tok('z', '0', 'num'),
      ],
      explainEn: `The ball is on the ground when the height is 0. Solve −16t² + ${v}t = 0.`,
      explainEs: `La pelota está en el suelo cuando la altura es 0. Resuelve −16t² + ${v}t = 0.`,
    },
    {
      tokens: [
        tok('gcf', '−16t', 'var', { emph: 'apply' }),
        tok('lp', '(', 'op', { tight: true }),
        tok('in1', 't', 'var', { tight: true }),
        tok('mns', '−', 'op'),
        tok('in2', M(T), 'num'),
        tok('rp', ')', 'op', { tight: true }),
        tok('rel', '=', 'rel'),
        tok('z', '0', 'num'),
      ],
      explainEn: `Factor out the GCF −16t: −16t(t − ${T}) = 0.`,
      explainEs: `Factoriza el MCD −16t: −16t(t − ${T}) = 0.`,
    },
    {
      tokens: [
        tok('t', 't', 'var'),
        tok('rel', '=', 'rel'),
        tok('T', M(T), 'num', { emph: 'result' }),
      ],
      explainEn: `Zero-Product: t = 0 (the throw) OR t − ${T} = 0. The ball lands at t = ${T} seconds.`,
      explainEs: `Producto Cero: t = 0 (el lanzamiento) O t − ${T} = 0. La pelota aterriza en t = ${T} segundos.`,
      holdMs: 3400,
    },
  ];
  return {
    id: `gen-projectile-${T}`,
    titleEn: 'When does it land? step by step',
    titleEs: '¿Cuándo aterriza? paso a paso',
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

  // add_polynomials params: two coefficient triples + the add/subtract flag.
  // foil ({p, q}) and mono_times_poly ({m, a, b}) share this skill.
  if (skillSlug === 'polynomial-operations') {
    const [a1, b1, c1, a2, b2, c2] = ['a1', 'b1', 'c1', 'a2', 'b2', 'c2'].map(num);
    if (a1 === null || b1 === null || c1 === null || a2 === null || b2 === null || c2 === null) {
      // foil: (x + p)(x + q). mono_times_poly has no p/q → stays unanimated.
      const fp = num('p');
      const fq = num('q');
      if (fp !== null && fq !== null) return buildFoil(fp, fq);
      return null;
    }
    return buildAddPolynomials(a1, b1, c1, a2, b2, c2, p.sub === true);
  }

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

  // factor-gcf carries two shapes: gcf_monomials {m1, m2, e1, e2} (find the
  // GCF of two monomials) and factor_gcf {g, a, b} (factor a binomial). The
  // {g, a, b} shape has an `a` key too, so handle both here before the
  // generic {a, b, x} equation dispatch below.
  if (skillSlug === 'factor-gcf') {
    const [m1, m2, e1, e2] = ['m1', 'm2', 'e1', 'e2'].map(num);
    if (m1 !== null && m2 !== null && e1 !== null && e2 !== null) {
      return buildGcfMonomials(m1, m2, e1, e2);
    }
    const g = num('g');
    const ga = num('a');
    const gb = num('b');
    if (g !== null && ga !== null && gb !== null) return buildFactorGcf(g, ga, gb);
    return null;
  }

  // evaluate_expression: a·x² + b·x + c evaluated at x = v
  if (skillSlug === 'evaluate-expressions') {
    const [ea, eb, ec, ev] = ['a', 'b', 'c', 'v'].map(num);
    if (ea === null || eb === null || ec === null || ev === null) return null;
    return buildEvaluateExpression(ea, eb, ec, ev);
  }

  // combine-like-terms hosts combine_like_terms {a, b, c, d, e} and
  // distribute_simplify {k, a, b, c, d} — the `k` key tells them apart.
  if (skillSlug === 'combine-like-terms') {
    const [ca, cb, cc, cd] = ['a', 'b', 'c', 'd'].map(num);
    if (ca === null || cb === null || cc === null || cd === null) return null;
    const k = num('k');
    if (k !== null) return buildDistributeSimplify(k, ca, cb, cc, cd);
    const e = num('e');
    if (e !== null) return buildCombineLikeTerms(ca, cb, cc, cd, e);
    return null;
  }

  // factor-trinomials hosts factor_trinomial {p, q} and dots {a, b}.
  if (skillSlug === 'factor-trinomials') {
    const fp = num('p');
    const fq = num('q');
    if (fp !== null && fq !== null) return buildFactorTrinomial(fp, fq);
    const da = num('a');
    const db = num('b');
    if (da !== null && db !== null) return buildDots(da, db);
    return null;
  }

  // exponents-perfect-squares: exponent_product_rule {a, b}. perfect_square_root
  // {n} is a bare recall — nothing to walk through.
  if (skillSlug === 'exponents-perfect-squares') {
    const ea = num('a');
    const eb = num('b');
    if (ea !== null && eb !== null) return buildExponentProduct(ea, eb);
    return null;
  }

  // simplify_radical {outer, inner}
  if (skillSlug === 'simplify-radicals') {
    const outer = num('outer');
    const inner = num('inner');
    if (outer !== null && inner !== null) return buildSimplifyRadical(outer, inner);
    return null;
  }

  // radical-operations: radical_add {inner, c1, c2} and radical_multiply {a, b}.
  if (skillSlug === 'radical-operations') {
    const inner = num('inner');
    const c1 = num('c1');
    const c2 = num('c2');
    if (inner !== null && c1 !== null && c2 !== null) return buildRadicalAdd(inner, c1, c2);
    const ra = num('a');
    const rb = num('b');
    if (ra !== null && rb !== null) return buildRadicalMultiply(ra, rb);
    return null;
  }

  // evaluate_function {a, b, v}. domain_from_points ({xs}) is a read-off — null.
  if (skillSlug === 'evaluate-functions') {
    const [fa, fb, fv] = ['a', 'b', 'v'].map(num);
    if (fa !== null && fb !== null && fv !== null) return buildEvaluateFunction(fa, fb, fv);
    return null;
  }

  // solve_sqrt_method {a, x}
  if (skillSlug === 'quadratics-sqrt') {
    const sa = num('a');
    const sx = num('x');
    if (sa !== null && sx !== null) return buildSolveSqrt(sa, sx);
    return null;
  }

  // solve_quadratic_factoring {p, q}
  if (skillSlug === 'quadratics-factoring') {
    const qp = num('p');
    const qq = num('q');
    if (qp !== null && qq !== null) return buildSolveQuadraticFactoring(qp, qq);
    return null;
  }

  // projectile_ground {t} (= landing time)
  if (skillSlug === 'quadratics-realworld') {
    const T = num('t');
    if (T !== null) return buildProjectileGround(T);
    return null;
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
