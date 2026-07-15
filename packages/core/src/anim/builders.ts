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
