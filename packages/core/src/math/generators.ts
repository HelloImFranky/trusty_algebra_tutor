/**
 * Procedural problem generation (design doc §7): templates with randomized
 * parameters give effectively unlimited practice per skill. Every generated
 * problem is validated through the math engine before it's persisted.
 */
import { grade, type GradingMode } from './engine.js';
import type { Misconception } from './misconceptions.js';

export interface GeneratedStep {
  promptEn: string;
  promptEs: string;
  expectedLatex: string;
  gradingMode: GradingMode;
  hintEn?: string;
  hintEs?: string;
}

export interface GeneratedProblem {
  promptEn: string;
  promptEs: string;
  answerLatex: string;
  gradingMode: GradingMode;
  tolerance?: number;
  steps?: GeneratedStep[];
  /** predicted wrong answers with targeted feedback (misconceptions.ts) */
  misconceptions?: Misconception[];
  params: Record<string, unknown>;
}

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ri = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const nz = (rng: Rng, lo: number, hi: number) => {
  let v = 0;
  while (v === 0) v = ri(rng, lo, hi);
  return v;
};
const sgn = (n: number) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);
const coeff = (n: number, v: string) =>
  n === 1 ? v : n === -1 ? `-${v}` : `${n}${v}`;
/** "Ax^2 + Bx + C" with zero terms dropped ("0" when all are zero). */
const polyLatex = (A: number, B: number, C: number) => {
  const parts: string[] = [];
  if (A !== 0) parts.push(coeff(A, 'x^2'));
  if (B !== 0) parts.push(coeff(B, 'x'));
  if (C !== 0) parts.push(String(C));
  return parts.length ? parts.join(' + ').replace(/\+ -/g, '- ') : '0';
};

/** Difficulty knob for tier-aware templates (currently the sprint drills).
 * Mirrors the problem tiers; generators that ignore it are unaffected. */
export type GeneratorTier = 'modified' | 'standard' | 'challenge';

type Generator = (rng: Rng, tier?: GeneratorTier) => GeneratedProblem;

export const generators: Record<string, Generator> = {
  /* ---------------- Unit 1: Number Sense ---------------- */

  perfect_square_root(rng) {
    const n = ri(rng, 2, 15);
    return {
      promptEn: `What is the **positive** square root of ${n * n}?`,
      promptEs: `¿Cuál es la raíz cuadrada **positiva** de ${n * n}?`,
      answerLatex: String(n),
      gradingMode: 'exact',
      params: { n },
    };
  },

  exponent_product_rule(rng) {
    const a = ri(rng, 2, 6);
    const b = ri(rng, 2, 6);
    return {
      promptEn: `Simplify using exponent rules: $x^{${a}} \\cdot x^{${b}}$. Write your answer as a power of $x$.`,
      promptEs: `Simplifica usando las reglas de los exponentes: $x^{${a}} \\cdot x^{${b}}$. Escribe tu respuesta como una potencia de $x$.`,
      answerLatex: `x^{${a + b}}`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: 'When multiplying powers with the same base, what do you do to the exponents? Write the new exponent.',
          promptEs: 'Al multiplicar potencias con la misma base, ¿qué haces con los exponentes? Escribe el nuevo exponente.',
          expectedLatex: String(a + b),
          gradingMode: 'exact',
          hintEn: 'Same base: ADD the exponents.',
          hintEs: 'Misma base: SUMA los exponentes.',
        },
      ],
      params: { a, b },
    };
  },

  simplify_radical(rng) {
    const outer = ri(rng, 2, 6);
    const inner = [2, 3, 5, 6, 7, 10][ri(rng, 0, 5)];
    const n = outer * outer * inner;
    return {
      promptEn: `Simplify the radical completely: $\\sqrt{${n}}$`,
      promptEs: `Simplifica el radical por completo: $\\sqrt{${n}}$`,
      answerLatex: `${outer}\\sqrt{${inner}}`,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: `STEP 1: Find the largest **perfect square** that divides ${n}. What is it?`,
          promptEs: `PASO 1: Encuentra el **cuadrado perfecto** más grande que divide a ${n}. ¿Cuál es?`,
          expectedLatex: String(outer * outer),
          gradingMode: 'exact',
          hintEn: 'Perfect squares: 4, 9, 16, 25, 36...',
          hintEs: 'Cuadrados perfectos: 4, 9, 16, 25, 36...',
        },
        {
          promptEn: `STEP 2: Rewrite $\\sqrt{${n}}$ as $\\sqrt{${outer * outer}} \\cdot \\sqrt{${inner}}$ and simplify the perfect square. What is $\\sqrt{${outer * outer}}$?`,
          promptEs: `PASO 2: Reescribe $\\sqrt{${n}}$ como $\\sqrt{${outer * outer}} \\cdot \\sqrt{${inner}}$ y simplifica el cuadrado perfecto. ¿Cuánto es $\\sqrt{${outer * outer}}$?`,
          expectedLatex: String(outer),
          gradingMode: 'exact',
        },
      ],
      params: { outer, inner },
    };
  },

  radical_add(rng) {
    const inner = [2, 3, 5, 7][ri(rng, 0, 3)];
    const c1 = ri(rng, 2, 9);
    const c2 = nz(rng, -9, 9);
    const sum = c1 + c2;
    const answer = sum === 0 ? '0' : sum === 1 ? `\\sqrt{${inner}}` : `${sum}\\sqrt{${inner}}`;
    return {
      promptEn: `Simplify: $${c1}\\sqrt{${inner}} ${sgn(c2)}\\sqrt{${inner}}$`,
      promptEs: `Simplifica: $${c1}\\sqrt{${inner}} ${sgn(c2)}\\sqrt{${inner}}$`,
      answerLatex: answer,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: `These are **like radicals** (same radicand). Combine the coefficients: what is $${c1} ${sgn(c2)}$?`,
          promptEs: `Son **radicales semejantes** (mismo radicando). Combina los coeficientes: ¿cuánto es $${c1} ${sgn(c2)}$?`,
          expectedLatex: String(sum),
          gradingMode: 'exact',
          hintEn: 'Add the numbers in front; the radical stays the same.',
          hintEs: 'Suma los números de enfrente; el radical no cambia.',
        },
      ],
      params: { inner, c1, c2 },
    };
  },

  radical_multiply(rng) {
    const a = [2, 3, 5][ri(rng, 0, 2)];
    const b = [2, 3, 5][ri(rng, 0, 2)];
    const prod = a * b;
    let answer: string;
    const root = Math.sqrt(prod);
    if (Number.isInteger(root)) answer = String(root);
    else answer = `\\sqrt{${prod}}`;
    return {
      promptEn: `Multiply and simplify: $\\sqrt{${a}} \\cdot \\sqrt{${b}}$`,
      promptEs: `Multiplica y simplifica: $\\sqrt{${a}} \\cdot \\sqrt{${b}}$`,
      answerLatex: answer,
      gradingMode: 'canonical_form',
      params: { a, b },
    };
  },

  rational_irrational(rng) {
    const choices: [string, string, 'rational' | 'irrational'][] = [
      ['\\sqrt{2}', '\\sqrt{2}', 'irrational'],
      ['\\sqrt{16}', '\\sqrt{16}', 'rational'],
      ['0.75', '0.75', 'rational'],
      ['\\pi', '\\pi', 'irrational'],
      ['\\frac{3}{7}', '\\frac{3}{7}', 'rational'],
      ['\\sqrt{20}', '\\sqrt{20}', 'irrational'],
      ['-14', '-14', 'rational'],
      ['0.333...', '0.333...', 'rational'],
      ['\\sqrt{81}', '\\sqrt{81}', 'rational'],
      ['2\\pi', '2\\pi', 'irrational'],
    ];
    const [en, es, key] = choices[ri(rng, 0, choices.length - 1)];
    return {
      promptEn: `Is $${en}$ **rational** or **irrational**? (answer: rational / irrational)`,
      promptEs: `¿Es $${es}$ **racional** o **irracional**? (responde: rational / irrational)`,
      answerLatex: key,
      gradingMode: 'exact',
      params: { expr: en, key },
    };
  },

  dimensional_analysis(rng) {
    const conversions = [
      { fromEn: 'feet', fromEs: 'pies', toEn: 'inches', toEs: 'pulgadas', factor: 12 },
      { fromEn: 'miles', fromEs: 'millas', toEn: 'feet', toEs: 'pies', factor: 5280 },
      { fromEn: 'pounds', fromEs: 'libras', toEn: 'ounces', toEs: 'onzas', factor: 16 },
      { fromEn: 'hours', fromEs: 'horas', toEn: 'minutes', toEs: 'minutos', factor: 60 },
      { fromEn: 'gallons', fromEs: 'galones', toEn: 'quarts', toEs: 'cuartos', factor: 4 },
    ];
    const c = conversions[ri(rng, 0, conversions.length - 1)];
    const qty = ri(rng, 2, 12);
    const answer = qty * c.factor;
    return {
      promptEn: `Use dimensional analysis to convert: how many ${c.toEn} are in ${qty} ${c.fromEn}?`,
      promptEs: `Usa el análisis dimensional para convertir: ¿cuántos ${c.toEs} hay en ${qty} ${c.fromEs}?`,
      answerLatex: String(answer),
      gradingMode: 'numeric_tolerance',
      tolerance: 0.01,
      steps: [
        {
          promptEn: `STEP 1: Write the given as a fraction over 1, then multiply by the conversion factor $\\frac{${c.factor}\\ \\text{${c.toEn}}}{1\\ \\text{${c.fromEn.slice(0, -1)}}}$ so the units cancel. What is $${qty} \\times ${c.factor}$?`,
          promptEs: `PASO 1: Escribe el dato como una fracción sobre 1 y multiplica por el factor de conversión $\\frac{${c.factor}\\ \\text{${c.toEs}}}{1\\ \\text{${c.fromEs.slice(0, -1)}}}$ para que las unidades se cancelen. ¿Cuánto es $${qty} \\times ${c.factor}$?`,
          expectedLatex: String(answer),
          gradingMode: 'numeric_tolerance',
          hintEn: 'The conversion factor is in the Regents Reference Table.',
          hintEs: 'El factor de conversión está en la Tabla de Referencia de Regents.',
        },
      ],
      params: { qty, factor: c.factor },
    };
  },

  /* ------------- Unit 2: Expressions & Polynomials ------------- */

  evaluate_expression(rng) {
    const a = nz(rng, -4, 4);
    const b = nz(rng, -6, 6);
    const c = ri(rng, -10, 10);
    const v = nz(rng, -5, 5);
    const answer = a * v * v + b * v + c;
    const expr = `${coeff(a, 'x^2')} ${sgn(b)}x ${sgn(c)}`;
    return {
      promptEn: `Evaluate the expression $${expr}$ when $x = ${v}$.`,
      promptEs: `Evalúa la expresión $${expr}$ cuando $x = ${v}$.`,
      answerLatex: String(answer),
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: **Substitute** ${v} for x. Show what the expression looks like after replacing every x with (${v}).`,
          promptEs: `PASO 1: **Sustituye** ${v} por x. Muestra cómo queda la expresión al reemplazar cada x con (${v}).`,
          expectedLatex: `${a}(${v})^2 ${sgn(b)}(${v}) ${sgn(c)}`,
          gradingMode: 'equivalent',
          hintEn: 'Wherever you see an "x", replace it with the number in parentheses.',
          hintEs: 'Donde veas una "x", reemplázala con el número entre paréntesis.',
        },
        {
          promptEn: 'STEP 2: **Simplify** using PEMDAS. What is the final value?',
          promptEs: 'PASO 2: **Simplifica** usando PEMDAS. ¿Cuál es el valor final?',
          expectedLatex: String(answer),
          gradingMode: 'exact',
          hintEn: 'PEMDAS: Parentheses, Exponents, Multiply/Divide, Add/Subtract.',
          hintEs: 'PEMDAS: Paréntesis, Exponentes, Multiplicación/División, Suma/Resta.',
        },
      ],
      misconceptions:
        v < 0
          ? [
              {
                id: 'negative_square_error',
                answerLatex: String(-a * v * v + b * v + c),
                feedbackEn: `Careful squaring a negative: $(${v})^2 = (${v})(${v}) = ${v * v}$, a POSITIVE number. Keep the parentheses when you substitute.`,
                feedbackEs: `Cuidado al elevar un negativo al cuadrado: $(${v})^2 = (${v})(${v}) = ${v * v}$, un número POSITIVO. Mantén los paréntesis al sustituir.`,
              },
            ]
          : undefined,
      params: { a, b, c, v },
    };
  },

  combine_like_terms(rng) {
    const a = nz(rng, -5, 5);
    const b = nz(rng, -8, 8);
    const c = nz(rng, -8, 8);
    const d = nz(rng, -9, 9);
    const e = ri(rng, 1, 20);
    // a x^2 + b x + c x + e + d  → a x^2 + (b+c) x + (e+d)
    const xCo = b + c;
    const k = e + d;
    const parts: string[] = [];
    if (a !== 0) parts.push(coeff(a, 'x^2'));
    if (xCo !== 0) parts.push(coeff(xCo, 'x'));
    if (k !== 0) parts.push(String(k));
    const answer = parts.length
      ? parts.join(' + ').replace(/\+ -/g, '- ')
      : '0';
    return {
      promptEn: `Simplify by combining like terms. Write your final answer in **standard form**: $${coeff(b, 'x')} ${sgn(e)} ${sgn(a >= 0 ? a : a)}x^2 ${sgn(c)}x ${sgn(d)}$`.replace('+ -', '- '),
      promptEs: `Simplifica combinando términos semejantes. Escribe tu respuesta final en **forma estándar**: $${coeff(b, 'x')} ${sgn(e)} ${sgn(a)}x^2 ${sgn(c)}x ${sgn(d)}$`.replace('+ -', '- '),
      answerLatex: answer,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: `STEP 1: Identify and combine the like terms. What is $${b}x ${sgn(c)}x$?`,
          promptEs: `PASO 1: Identifica y combina los términos semejantes. ¿Cuánto es $${b}x ${sgn(c)}x$?`,
          expectedLatex: xCo === 0 ? '0' : coeff(xCo, 'x'),
          gradingMode: 'equivalent',
          hintEn: 'TIP: Use different shapes or colors to mark the like terms.',
          hintEs: 'CONSEJO: Usa diferentes formas o colores para marcar los términos semejantes.',
        },
        {
          promptEn: 'STEP 2: Write your answer in standard form — order the terms from highest degree to lowest degree.',
          promptEs: 'PASO 2: Escribe tu respuesta en forma estándar — ordena los términos de mayor a menor grado.',
          expectedLatex: answer,
          gradingMode: 'canonical_form',
          hintEn: 'Determine the degree of each term, then order from highest degree to lowest.',
          hintEs: 'Determina el grado de cada término y ordena de mayor a menor grado.',
        },
      ],
      params: { a, b, c, d, e },
    };
  },

  distribute_simplify(rng) {
    const k = nz(rng, -4, 4);
    const a = nz(rng, -5, 5);
    const b = nz(rng, -7, 7);
    const c = nz(rng, -6, 6);
    const d = ri(rng, -9, 9);
    // k(a x + b) + c x + d
    const xCo = k * a + c;
    const kk = k * b + d;
    const parts: string[] = [];
    if (xCo !== 0) parts.push(coeff(xCo, 'x'));
    if (kk !== 0) parts.push(String(kk));
    const answer = parts.length ? parts.join(' + ').replace(/\+ -/g, '- ') : '0';
    return {
      promptEn: `Simplify: $${k}(${coeff(a, 'x')} ${sgn(b)}) ${sgn(c)}x ${sgn(d)}$`,
      promptEs: `Simplifica: $${k}(${coeff(a, 'x')} ${sgn(b)}) ${sgn(c)}x ${sgn(d)}$`,
      answerLatex: answer,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: `STEP 1: **Distribute** ${k} to each term inside the parentheses. What do you get?`,
          promptEs: `PASO 1: **Distribuye** ${k} a cada término dentro del paréntesis. ¿Qué obtienes?`,
          expectedLatex: `${coeff(k * a, 'x')} ${sgn(k * b)}`,
          gradingMode: 'equivalent',
          hintEn: 'Distributive means to multiply: give the number out to EACH term inside.',
          hintEs: 'Distribuir significa multiplicar: dale el número a CADA término de adentro.',
        },
        {
          promptEn: 'STEP 2: Combine like terms and write your answer in standard form.',
          promptEs: 'PASO 2: Combina los términos semejantes y escribe tu respuesta en forma estándar.',
          expectedLatex: answer,
          gradingMode: 'canonical_form',
        },
      ],
      params: { k, a, b, c, d },
    };
  },

  add_polynomials(rng) {
    const a1 = nz(rng, -5, 5), b1 = nz(rng, -7, 7), c1 = ri(rng, -9, 9);
    const a2 = nz(rng, -5, 5), b2 = nz(rng, -7, 7), c2 = ri(rng, -9, 9);
    const sub = rng() < 0.5;
    const A = sub ? a1 - a2 : a1 + a2;
    const B = sub ? b1 - b2 : b1 + b2;
    const C = sub ? c1 - c2 : c1 + c2;
    const parts: string[] = [];
    if (A !== 0) parts.push(coeff(A, 'x^2'));
    if (B !== 0) parts.push(coeff(B, 'x'));
    if (C !== 0) parts.push(String(C));
    const answer = parts.length ? parts.join(' + ').replace(/\+ -/g, '- ') : '0';
    const p1 = `${coeff(a1, 'x^2')} ${sgn(b1)}x ${sgn(c1)}`;
    const p2 = `${coeff(a2, 'x^2')} ${sgn(b2)}x ${sgn(c2)}`;
    const op = sub ? '-' : '+';
    return {
      promptEn: `${sub ? 'Subtract' : 'Add'} the polynomials: $(${p1}) ${op} (${p2})$`,
      promptEs: `${sub ? 'Resta' : 'Suma'} los polinomios: $(${p1}) ${op} (${p2})$`,
      answerLatex: answer,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: sub
            ? 'STEP 1: Distribute the minus sign (multiply the second polynomial by −1). Rewrite the problem without parentheses.'
            : 'STEP 1: Drop the parentheses and rewrite as one long expression.',
          promptEs: sub
            ? 'PASO 1: Distribuye el signo menos (multiplica el segundo polinomio por −1). Reescribe el problema sin paréntesis.'
            : 'PASO 1: Quita los paréntesis y reescribe como una sola expresión.',
          expectedLatex: sub
            ? `${p1} ${sgn(-a2)}x^2 ${sgn(-b2)}x ${sgn(-c2)}`
            : `${p1} ${sgn(a2)}x^2 ${sgn(b2)}x ${sgn(c2)}`,
          gradingMode: 'equivalent',
          hintEn: sub ? 'Subtracting flips EVERY sign in the second polynomial.' : 'Adding keeps every sign the same.',
          hintEs: sub ? 'Restar cambia TODOS los signos del segundo polinomio.' : 'Sumar mantiene todos los signos iguales.',
        },
        {
          promptEn: 'STEP 2: Combine like terms. Write the answer in standard form.',
          promptEs: 'PASO 2: Combina los términos semejantes. Escribe la respuesta en forma estándar.',
          expectedLatex: answer,
          gradingMode: 'canonical_form',
        },
      ],
      misconceptions: sub
        ? [
            {
              id: 'minus_not_distributed',
              answerLatex: polyLatex(a1 + a2, b1 + b2, c1 + c2),
              feedbackEn: 'Subtracting a polynomial flips the sign of EVERY term in it, not just the first one. Distribute the minus sign through the whole second polynomial.',
              feedbackEs: 'Restar un polinomio cambia el signo de TODOS sus términos, no solo del primero. Distribuye el signo menos por todo el segundo polinomio.',
            },
          ]
        : undefined,
      params: { a1, b1, c1, a2, b2, c2, sub },
    };
  },

  foil(rng) {
    const p = nz(rng, -9, 9);
    const q = nz(rng, -9, 9);
    const B = p + q;
    const C = p * q;
    const parts = ['x^2'];
    if (B !== 0) parts.push(coeff(B, 'x'));
    if (C !== 0) parts.push(String(C));
    const answer = parts.join(' + ').replace(/\+ -/g, '- ');
    return {
      promptEn: `Multiply the binomials using **FOIL**: $(x ${sgn(p)})(x ${sgn(q)})$`,
      promptEs: `Multiplica los binomios usando **FOIL**: $(x ${sgn(p)})(x ${sgn(q)})$`,
      answerLatex: answer,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: `STEP 1: USE FOIL — First, Outer, Inner, Last. Write all four products before combining: $x^2 ${sgn(q)}x ${sgn(p)}x ${sgn(C)}$. Type the four terms.`,
          promptEs: `PASO 1: USA FOIL — Primeros, Externos, Internos, Últimos. Escribe los cuatro productos antes de combinar: $x^2 ${sgn(q)}x ${sgn(p)}x ${sgn(C)}$. Escribe los cuatro términos.`,
          expectedLatex: `x^2 ${sgn(q)}x ${sgn(p)}x ${sgn(C)}`,
          gradingMode: 'equivalent',
          hintEn: 'FOIL = First, Outer, Inner, Last. Distribute 4 times!',
          hintEs: 'FOIL = Primeros, Externos, Internos, Últimos. ¡Distribuye 4 veces!',
        },
        {
          promptEn: 'STEP 2: Combine like terms.',
          promptEs: 'PASO 2: Combina los términos semejantes.',
          expectedLatex: answer,
          gradingMode: 'canonical_form',
        },
      ],
      misconceptions: [
        {
          id: 'foil_missed_middle_terms',
          answerLatex: `x^2 ${sgn(C)}`,
          feedbackEn: `You multiplied First and Last, but FOIL has FOUR products. The Outer (${sgn(q).trim()}x) and Inner (${sgn(p).trim()}x) terms combine into the middle term.`,
          feedbackEs: `Multiplicaste los Primeros y los Últimos, pero FOIL tiene CUATRO productos. Los Externos (${sgn(q).trim()}x) y los Internos (${sgn(p).trim()}x) se combinan en el término del medio.`,
        },
      ],
      params: { p, q },
    };
  },

  mono_times_poly(rng) {
    const m = nz(rng, -5, 5);
    const a = nz(rng, -6, 6);
    const b = nz(rng, -8, 8);
    // m x (a x + b) = m a x^2 + m b x
    const answer = `${coeff(m * a, 'x^2')} ${sgn(m * b)}x`.replace('+ -', '- ');
    return {
      promptEn: `Multiply: $${coeff(m, 'x')}(${coeff(a, 'x')} ${sgn(b)})$`,
      promptEs: `Multiplica: $${coeff(m, 'x')}(${coeff(a, 'x')} ${sgn(b)})$`,
      answerLatex: answer,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: 'Distribute the monomial to each term. Remember: multiply coefficients, ADD exponents of the same variable.',
          promptEs: 'Distribuye el monomio a cada término. Recuerda: multiplica los coeficientes y SUMA los exponentes de la misma variable.',
          expectedLatex: answer,
          gradingMode: 'canonical_form',
          hintEn: 'x · x = x². Multiply the numbers in front.',
          hintEs: 'x · x = x². Multiplica los números de enfrente.',
        },
      ],
      params: { m, a, b },
    };
  },

  /* ------------- Unit 3: Equations & Inequalities ------------- */

  two_step_equation(rng) {
    const a = nz(rng, -9, 9);
    const x = nz(rng, -9, 9);
    const b = nz(rng, -12, 12);
    const c = a * x + b;
    return {
      promptEn: `Solve for x: $${coeff(a, 'x')} ${sgn(b)} = ${c}$`,
      promptEs: `Resuelve para x: $${coeff(a, 'x')} ${sgn(b)} = ${c}$`,
      answerLatex: String(x),
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: Use inverse operations — ${b > 0 ? 'subtract' : 'add'} ${Math.abs(b)} on both sides. What is $${c} ${sgn(-b)}$?`,
          promptEs: `PASO 1: Usa operaciones inversas — ${b > 0 ? 'resta' : 'suma'} ${Math.abs(b)} en ambos lados. ¿Cuánto es $${c} ${sgn(-b)}$?`,
          expectedLatex: String(c - b),
          gradingMode: 'exact',
          hintEn: 'Undo addition with subtraction (and vice versa).',
          hintEs: 'Deshaz la suma con la resta (y viceversa).',
        },
        {
          promptEn: `STEP 2: Divide both sides by ${a}. What is x?`,
          promptEs: `PASO 2: Divide ambos lados entre ${a}. ¿Cuánto vale x?`,
          expectedLatex: String(x),
          gradingMode: 'exact',
        },
      ],
      misconceptions: [
        {
          id: 'inverse_operation_error',
          answerLatex: `(${c + b})/(${a})`,
          feedbackEn: `It looks like you ${b > 0 ? 'added' : 'subtracted'} ${Math.abs(b)} — but ${b > 0 ? 'adding' : 'subtracting'} needs the INVERSE operation. ${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} on both sides first, then divide by ${a}.`,
          feedbackEs: `Parece que ${b > 0 ? 'sumaste' : 'restaste'} ${Math.abs(b)} — pero ${b > 0 ? 'sumar' : 'restar'} necesita la operación INVERSA. ${b > 0 ? 'Resta' : 'Suma'} ${Math.abs(b)} en ambos lados primero y luego divide entre ${a}.`,
        },
        {
          id: 'skipped_division',
          answerLatex: String(c - b),
          feedbackEn: `${c - b} is what you get after undoing the ${sgn(b).startsWith('+') ? 'addition' : 'subtraction'} — one more step! Divide both sides by ${a} to get x alone.`,
          feedbackEs: `${c - b} es lo que queda después de deshacer la ${sgn(b).startsWith('+') ? 'suma' : 'resta'} — ¡falta un paso! Divide ambos lados entre ${a} para dejar x sola.`,
        },
      ],
      params: { a, b, x },
    };
  },

  multi_step_equation(rng) {
    const k = nz(rng, -4, 4);
    const a = nz(rng, -4, 4);
    const b = nz(rng, -6, 6);
    const c = nz(rng, -5, 5);
    const x = nz(rng, -6, 6);
    if (k * a + c === 0) return generators.multi_step_equation(rng);
    const d = k * (a * x + b) + c * x;
    return {
      promptEn: `Solve for x: $${k}(${coeff(a, 'x')} ${sgn(b)}) ${sgn(c)}x = ${d}$`,
      promptEs: `Resuelve para x: $${k}(${coeff(a, 'x')} ${sgn(b)}) ${sgn(c)}x = ${d}$`,
      answerLatex: String(x),
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: Ask yourself: do I need to distribute? YES — distribute ${k}. Rewrite the left side without parentheses.`,
          promptEs: `PASO 1: Pregúntate: ¿necesito distribuir? SÍ — distribuye ${k}. Reescribe el lado izquierdo sin paréntesis.`,
          expectedLatex: `${coeff(k * a, 'x')} ${sgn(k * b)} ${sgn(c)}x`,
          gradingMode: 'equivalent',
          hintEn: 'BEFORE solving, ALWAYS ask: Do I need to distribute? Do I need to combine like terms?',
          hintEs: 'ANTES de resolver, SIEMPRE pregunta: ¿Necesito distribuir? ¿Necesito combinar términos semejantes?',
        },
        {
          promptEn: `STEP 2: Combine like terms on the left. What is the coefficient of x now?`,
          promptEs: `PASO 2: Combina los términos semejantes a la izquierda. ¿Cuál es ahora el coeficiente de x?`,
          expectedLatex: String(k * a + c),
          gradingMode: 'exact',
        },
        {
          promptEn: 'STEP 3: Use inverse operations to solve. What is x?',
          promptEs: 'PASO 3: Usa operaciones inversas para resolver. ¿Cuánto vale x?',
          expectedLatex: String(x),
          gradingMode: 'exact',
        },
      ],
      misconceptions: [
        {
          id: 'partial_distribution',
          answerLatex: `(${d - b})/(${k * a + c})`,
          feedbackEn: `Did you distribute ${k} to BOTH terms inside the parentheses? ${k} times ${b} is ${k * b} — the second term gets multiplied too.`,
          feedbackEs: `¿Distribuiste ${k} a AMBOS términos dentro del paréntesis? ${k} por ${b} es ${k * b} — el segundo término también se multiplica.`,
        },
      ],
      params: { k, a, b, c, x },
    };
  },

  var_both_sides(rng) {
    const a = nz(rng, -8, 8);
    let c = nz(rng, -8, 8);
    if (a === c) c = a + nz(rng, 1, 3);
    const x = nz(rng, -6, 6);
    const b = nz(rng, -12, 12);
    const d = a * x + b - c * x;
    return {
      promptEn: `Solve the equation for the variable: $${coeff(a, 'n')} ${sgn(b)} = ${d} ${sgn(c)}n$`,
      promptEs: `Resuelve la ecuación para la variable: $${coeff(a, 'n')} ${sgn(b)} = ${d} ${sgn(c)}n$`,
      answerLatex: String(x),
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: Move the variables to one side using inverse operations — subtract $${coeff(c, 'n')}$ from both sides. What is the coefficient of n on the left now?`,
          promptEs: `PASO 1: Mueve las variables a un lado usando operaciones inversas — resta $${coeff(c, 'n')}$ de ambos lados. ¿Cuál es ahora el coeficiente de n a la izquierda?`,
          expectedLatex: String(a - c),
          gradingMode: 'exact',
        },
        {
          promptEn: 'STEP 2: Solve the remaining two-step equation. What is n?',
          promptEs: 'PASO 2: Resuelve la ecuación de dos pasos que queda. ¿Cuánto vale n?',
          expectedLatex: String(x),
          gradingMode: 'exact',
        },
      ],
      params: { a, b, c, x },
    };
  },

  two_step_inequality(rng) {
    const a = nz(rng, -8, 8);
    const x = nz(rng, -8, 8);
    const b = nz(rng, -10, 10);
    const c = a * x + b;
    const baseOp = rng() < 0.5 ? '>' : '<';
    const finalOp = a < 0 ? (baseOp === '>' ? '<' : '>') : baseOp;
    return {
      promptEn: `Solve the inequality: $${coeff(a, 'x')} ${sgn(b)} ${baseOp} ${c}$ (write your answer like "x ${finalOp} ${x}")`,
      promptEs: `Resuelve la desigualdad: $${coeff(a, 'x')} ${sgn(b)} ${baseOp} ${c}$ (escribe tu respuesta como "x ${finalOp} ${x}")`,
      answerLatex: `x ${finalOp} ${x}`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: 'The steps are the SAME as solving an equation. STEP 1: undo the constant with inverse operations. What number is on the right side now?',
          promptEs: 'Los pasos son IGUALES que al resolver una ecuación. PASO 1: deshaz la constante con operaciones inversas. ¿Qué número queda en el lado derecho?',
          expectedLatex: String(c - b),
          gradingMode: 'exact',
        },
        {
          promptEn: a < 0
            ? `STEP 2: Divide both sides by ${a}. You are dividing by a NEGATIVE — don't forget to flip the inequality symbol! Write the final answer.`
            : `STEP 2: Divide both sides by ${a}. Write the final answer.`,
          promptEs: a < 0
            ? `PASO 2: Divide ambos lados entre ${a}. Estás dividiendo entre un NEGATIVO — ¡no olvides voltear el símbolo de desigualdad! Escribe la respuesta final.`
            : `PASO 2: Divide ambos lados entre ${a}. Escribe la respuesta final.`,
          expectedLatex: `x ${finalOp} ${x}`,
          gradingMode: 'exact',
          hintEn: 'Dividing or multiplying by a negative number flips the inequality symbol.',
          hintEs: 'Dividir o multiplicar por un número negativo voltea el símbolo de desigualdad.',
        },
      ],
      misconceptions: [
        a < 0
          ? {
              id: 'missed_inequality_flip',
              answerLatex: `x ${baseOp} ${x}`,
              feedbackEn: `You divided by ${a}, a NEGATIVE number — that flips the inequality symbol. ${baseOp} becomes ${finalOp}.`,
              feedbackEs: `Dividiste entre ${a}, un número NEGATIVO — eso voltea el símbolo de desigualdad. ${baseOp} se convierte en ${finalOp}.`,
            }
          : {
              id: 'unnecessary_inequality_flip',
              answerLatex: `x ${baseOp === '>' ? '<' : '>'} ${x}`,
              feedbackEn: `The symbol only flips when you multiply or divide by a NEGATIVE number. You divided by ${a}, which is positive — keep the symbol as ${baseOp}.`,
              feedbackEs: `El símbolo solo se voltea cuando multiplicas o divides entre un número NEGATIVO. Dividiste entre ${a}, que es positivo — mantén el símbolo ${baseOp}.`,
            },
      ],
      params: { a, b, x, baseOp },
    };
  },

  /* ---------------- Unit 4: Functions ---------------- */

  evaluate_function(rng) {
    const a = nz(rng, -5, 5);
    const b = nz(rng, -8, 8);
    const v = nz(rng, -6, 6);
    const answer = a * v * v + b;
    return {
      promptEn: `If $f(x) = ${coeff(a, 'x^2')} ${sgn(b)}$, what is the value of $f(${v})$?`,
      promptEs: `Si $f(x) = ${coeff(a, 'x^2')} ${sgn(b)}$, ¿cuál es el valor de $f(${v})$?`,
      answerLatex: String(answer),
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `INPUT the x-value into the machine: substitute ${v} for x. What is $(${v})^2$?`,
          promptEs: `INGRESA el valor de x en la máquina: sustituye ${v} por x. ¿Cuánto es $(${v})^2$?`,
          expectedLatex: String(v * v),
          gradingMode: 'exact',
          hintEn: 'A negative number squared is positive.',
          hintEs: 'Un número negativo al cuadrado es positivo.',
        },
        {
          promptEn: 'Now finish with order of operations to find the OUTPUT.',
          promptEs: 'Ahora termina con el orden de operaciones para encontrar la SALIDA.',
          expectedLatex: String(answer),
          gradingMode: 'exact',
        },
      ],
      misconceptions:
        v < 0
          ? [
              {
                id: 'negative_square_error',
                answerLatex: String(-a * v * v + b),
                feedbackEn: `$(${v})^2$ is $(${v})(${v}) = ${v * v}$ — a negative times a negative is POSITIVE.`,
                feedbackEs: `$(${v})^2$ es $(${v})(${v}) = ${v * v}$ — negativo por negativo es POSITIVO.`,
              },
            ]
          : undefined,
      params: { a, b, v },
    };
  },

  is_function(rng) {
    const isFn = rng() < 0.5;
    const x1 = ri(rng, 1, 5);
    const pairs = isFn
      ? `(${x1},${ri(rng, 1, 9)})\\; (${x1 + 1},${ri(rng, 1, 9)})\\; (${x1 + 2},${ri(rng, 1, 9)})\\; (${x1 + 3},${ri(rng, 1, 9)})`
      : `(${x1},${ri(rng, 1, 4)})\\; (${x1},${ri(rng, 5, 9)})\\; (${x1 + 2},${ri(rng, 1, 9)})\\; (${x1 + 3},${ri(rng, 1, 9)})`;
    return {
      promptEn: `Is this relation a **function**? $${pairs}$ (answer: yes / no)`,
      promptEs: `¿Es esta relación una **función**? $${pairs}$ (responde: yes / no)`,
      answerLatex: isFn ? 'yes' : 'no',
      gradingMode: 'exact',
      steps: [
        {
          promptEn: 'A relation is a function when each INPUT has exactly ONE output. Check the x-values: does any input repeat with a different output? (yes/no)',
          promptEs: 'Una relación es una función cuando cada ENTRADA tiene exactamente UNA salida. Revisa los valores de x: ¿algún valor de entrada se repite con una salida diferente? (yes/no)',
          expectedLatex: isFn ? 'no' : 'yes',
          gradingMode: 'exact',
          hintEn: 'Look only at the first number in each ordered pair.',
          hintEs: 'Mira solo el primer número de cada par ordenado.',
        },
      ],
      params: { isFn },
    };
  },

  domain_from_points(rng) {
    const xs = [...new Set([nz(rng, -9, 9), nz(rng, -9, 9), nz(rng, -9, 9)])].sort((a, b) => a - b);
    const pts = xs.map((x) => `(${x},${ri(rng, -9, 9)})`).join('\\; ');
    return {
      promptEn: `State the **domain** of the relation $${pts}$. List the values separated by commas.`,
      promptEs: `Indica el **dominio** de la relación $${pts}$. Escribe los valores separados por comas.`,
      answerLatex: xs.join(', '),
      gradingMode: 'exact',
      steps: [
        {
          promptEn: 'Domain = all of the x-values. Which number in each pair is x?',
          promptEs: 'Dominio = todos los valores de x. ¿Qué número de cada par es x?',
          expectedLatex: xs.join(', '),
          gradingMode: 'exact',
          hintEn: 'Domain: x-values. Range: y-values.',
          hintEs: 'Dominio: valores de x. Rango: valores de y.',
        },
      ],
      params: { xs },
    };
  },

  /* ------------- Unit 5: Linear Relationships ------------- */

  slope_two_points(rng) {
    const x1 = ri(rng, -6, 6);
    let x2 = ri(rng, -6, 6);
    if (x2 === x1) x2 = x1 + nz(rng, 1, 3);
    const y1 = ri(rng, -8, 8);
    const y2 = ri(rng, -8, 8);
    const num = y2 - y1;
    const den = x2 - x1;
    const answer = `(${num})/(${den})`;
    return {
      promptEn: `Find the **slope** of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
      promptEs: `Encuentra la **pendiente** de la recta que pasa por $(${x1}, ${y1})$ y $(${x2}, ${y2})$.`,
      answerLatex: answer,
      gradingMode: 'equivalent',
      steps: [
        {
          promptEn: `STEP 1: Label the points and substitute into the slope formula $m = \\frac{y_2 - y_1}{x_2 - x_1}$. What is the numerator $${y2} - (${y1})$?`,
          promptEs: `PASO 1: Etiqueta los puntos y sustituye en la fórmula de la pendiente $m = \\frac{y_2 - y_1}{x_2 - x_1}$. ¿Cuál es el numerador $${y2} - (${y1})$?`,
          expectedLatex: String(num),
          gradingMode: 'exact',
          hintEn: 'RISE = difference in y-values. RUN = difference in x-values.',
          hintEs: 'ELEVACIÓN = diferencia en los valores de y. AVANCE = diferencia en los valores de x.',
        },
        {
          promptEn: 'STEP 2: Simplify the fraction. What is the slope?',
          promptEs: 'PASO 2: Simplifica la fracción. ¿Cuál es la pendiente?',
          expectedLatex: answer,
          gradingMode: 'equivalent',
        },
      ],
      misconceptions: [
        ...(num !== 0
          ? [
              {
                id: 'slope_rise_run_inverted',
                answerLatex: `(${den})/(${num})`,
                feedbackEn: 'That is run over rise — upside down! Slope = RISE over RUN: the difference in y-values goes on TOP.',
                feedbackEs: '¡Eso es avance sobre elevación — al revés! Pendiente = ELEVACIÓN sobre AVANCE: la diferencia de los valores de y va ARRIBA.',
              },
            ]
          : []),
        {
          id: 'slope_mixed_point_order',
          answerLatex: `(${-num})/(${den})`,
          feedbackEn: 'Check your subtraction order: it must be the SAME in both the numerator and denominator — $(y_2 - y_1)$ over $(x_2 - x_1)$. Mixing the order flips the sign.',
          feedbackEs: 'Revisa el orden de la resta: debe ser el MISMO en el numerador y el denominador — $(y_2 - y_1)$ sobre $(x_2 - x_1)$. Mezclar el orden cambia el signo.',
        },
      ],
      params: { x1, y1, x2, y2 },
    };
  },

  slope_intercept_rewrite(rng) {
    const m = nz(rng, -5, 5);
    const b = nz(rng, -9, 9);
    const A = -m;
    return {
      promptEn: `Rewrite in **slope-intercept form** (y = mx + b): $${coeff(A, 'x')} + y = ${b}$`,
      promptEs: `Reescribe en **forma pendiente-intercepto** (y = mx + b): $${coeff(A, 'x')} + y = ${b}$`,
      answerLatex: `y = ${coeff(m, 'x')} ${sgn(b)}`,
      gradingMode: 'equivalent',
      steps: [
        {
          promptEn: `Use inverse operations to isolate y: ${A > 0 ? 'subtract' : 'add'} $${coeff(Math.abs(A), 'x')}$ on both sides. Write the equation.`,
          promptEs: `Usa operaciones inversas para aislar y: ${A > 0 ? 'resta' : 'suma'} $${coeff(Math.abs(A), 'x')}$ en ambos lados. Escribe la ecuación.`,
          expectedLatex: `y = ${coeff(m, 'x')} ${sgn(b)}`,
          gradingMode: 'equivalent',
          hintEn: '"m" is the slope, "b" is the y-intercept.',
          hintEs: '"m" es la pendiente, "b" es el intercepto en y.',
        },
      ],
      params: { m, b },
    };
  },

  identify_slope_yint(rng) {
    const m = nz(rng, -6, 6);
    const b = nz(rng, -9, 9);
    const which = rng() < 0.5;
    return {
      promptEn: which
        ? `What is the **slope** of $y = ${coeff(m, 'x')} ${sgn(b)}$?`
        : `What is the **y-intercept** of $y = ${coeff(m, 'x')} ${sgn(b)}$? Write it as a point (0, b).`,
      promptEs: which
        ? `¿Cuál es la **pendiente** de $y = ${coeff(m, 'x')} ${sgn(b)}$?`
        : `¿Cuál es el **intercepto en y** de $y = ${coeff(m, 'x')} ${sgn(b)}$? Escríbelo como un punto (0, b).`,
      answerLatex: which ? String(m) : `(0, ${b})`,
      gradingMode: 'exact',
      params: { m, b, which },
    };
  },

  system_substitution(rng) {
    const x = nz(rng, -5, 5);
    const y = nz(rng, -5, 5);
    const a = nz(rng, -4, 4);
    const c = nz(rng, -4, 4);
    // x = a y + k ; c x + y = d
    const k = x - a * y;
    const d = c * x + y;
    return {
      promptEn: `Solve the system by **substitution**. Write the solution as a point (x, y).\n\n$x = ${coeff(a, 'y')} ${sgn(k)}$\n\n$${coeff(c, 'x')} + y = ${d}$`,
      promptEs: `Resuelve el sistema por **sustitución**. Escribe la solución como un punto (x, y).\n\n$x = ${coeff(a, 'y')} ${sgn(k)}$\n\n$${coeff(c, 'x')} + y = ${d}$`,
      answerLatex: `(${x}, ${y})`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: x is already isolated. Substitute $${coeff(a, 'y')} ${sgn(k)}$ for x in the second equation, then solve for y. What is y?`,
          promptEs: `PASO 1: x ya está aislada. Sustituye $${coeff(a, 'y')} ${sgn(k)}$ por x en la segunda ecuación y resuelve para y. ¿Cuánto vale y?`,
          expectedLatex: String(y),
          gradingMode: 'exact',
        },
        {
          promptEn: 'STEP 2: Substitute your y-value back to find x. Write the solution as a point.',
          promptEs: 'PASO 2: Sustituye tu valor de y para encontrar x. Escribe la solución como un punto.',
          expectedLatex: `(${x}, ${y})`,
          gradingMode: 'exact',
          hintEn: 'The solution is the point of intersection of the two lines.',
          hintEs: 'La solución es el punto de intersección de las dos rectas.',
        },
      ],
      misconceptions:
        x !== y
          ? [
              {
                id: 'coordinates_swapped',
                answerLatex: `(${y}, ${x})`,
                feedbackEn: `Your values are right but in the wrong order — a point is written (x, y). Here x = ${x} and y = ${y}.`,
                feedbackEs: `Tus valores son correctos pero en el orden equivocado — un punto se escribe (x, y). Aquí x = ${x} y y = ${y}.`,
              },
            ]
          : undefined,
      params: { x, y, a, c },
    };
  },

  system_elimination(rng) {
    const x = nz(rng, -4, 4);
    const y = nz(rng, -4, 4);
    const a = nz(rng, 1, 4);
    const b = nz(rng, 1, 4);
    const c = nz(rng, 1, 4);
    // a x + b y = e ; c x - b y = f  (opposite coefficients on y)
    const e = a * x + b * y;
    const f = c * x - b * y;
    return {
      promptEn: `Solve the system by **elimination**. Write the solution as a point (x, y).\n\n$${coeff(a, 'x')} + ${coeff(b, 'y')} = ${e}$\n\n$${coeff(c, 'x')} - ${coeff(b, 'y')} = ${f}$`,
      promptEs: `Resuelve el sistema por **eliminación**. Escribe la solución como un punto (x, y).\n\n$${coeff(a, 'x')} + ${coeff(b, 'y')} = ${e}$\n\n$${coeff(c, 'x')} - ${coeff(b, 'y')} = ${f}$`,
      answerLatex: `(${x}, ${y})`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: The y-terms already have opposite coefficients ($${coeff(b, 'y')}$ and $-${coeff(b, 'y')}$). ADD the equations. What is x?`,
          promptEs: `PASO 1: Los términos en y ya tienen coeficientes opuestos ($${coeff(b, 'y')}$ y $-${coeff(b, 'y')}$). SUMA las ecuaciones. ¿Cuánto vale x?`,
          expectedLatex: String(x),
          gradingMode: 'exact',
          hintEn: 'Opposite coefficients eliminate each other when you add.',
          hintEs: 'Los coeficientes opuestos se eliminan al sumar.',
        },
        {
          promptEn: 'STEP 2: Substitute x into either original equation and solve for y. Write the solution point.',
          promptEs: 'PASO 2: Sustituye x en cualquiera de las ecuaciones originales y resuelve para y. Escribe el punto solución.',
          expectedLatex: `(${x}, ${y})`,
          gradingMode: 'exact',
        },
      ],
      misconceptions:
        x !== y
          ? [
              {
                id: 'coordinates_swapped',
                answerLatex: `(${y}, ${x})`,
                feedbackEn: `Your values are right but in the wrong order — a point is written (x, y). Here x = ${x} and y = ${y}.`,
                feedbackEs: `Tus valores son correctos pero en el orden equivocado — un punto se escribe (x, y). Aquí x = ${x} y y = ${y}.`,
              },
            ]
          : undefined,
      params: { x, y, a, b, c },
    };
  },

  /* ------------- Unit 6: Exponential Relationships ------------- */

  exponential_write(rng) {
    const a = [100, 200, 250, 500, 800, 1000][ri(rng, 0, 5)];
    const doubling = rng() < 0.5;
    const b = doubling ? 2 : 3;
    return {
      promptEn: `A population of ${a} bacteria ${doubling ? 'doubles' : 'triples'} every hour. Write an exponential function $f(x)$ for the number of bacteria after $x$ hours.`,
      promptEs: `Una población de ${a} bacterias se ${doubling ? 'duplica' : 'triplica'} cada hora. Escribe una función exponencial $f(x)$ para el número de bacterias después de $x$ horas.`,
      answerLatex: `f(x) = ${a}(${b})^x`,
      gradingMode: 'equivalent',
      steps: [
        {
          promptEn: `Use $f(x) = ab^x$ where "a" is the original value and "b" is the constant ratio. Here a = ${a} and b = ${b}. Write the function.`,
          promptEs: `Usa $f(x) = ab^x$ donde "a" es el valor original y "b" es la razón constante. Aquí a = ${a} y b = ${b}. Escribe la función.`,
          expectedLatex: `f(x) = ${a}(${b})^x`,
          gradingMode: 'equivalent',
          hintEn: '"a" is the y-intercept (start amount); "b" is like the slope for exponentials.',
          hintEs: '"a" es el intercepto en y (cantidad inicial); "b" es como la pendiente para exponenciales.',
        },
      ],
      params: { a, b },
    };
  },

  exponential_growth_decay(rng) {
    const decay = rng() < 0.5;
    const a = [900, 1100, 1200, 600, 750][ri(rng, 0, 4)];
    const rPct = [10, 20, 25, 5][ri(rng, 0, 3)];
    const t = ri(rng, 2, 4);
    const base = decay ? 1 - rPct / 100 : 1 + rPct / 100;
    const value = a * Math.pow(base, t);
    const answer = Math.round(value * 100) / 100;
    return {
      promptEn: decay
        ? `A phone worth $$${a} loses ${rPct}% of its value each year. a) The model is $y = ${a}(${base})^t$. Find its value after ${t} years (round to the nearest cent).`
        : `A savings account with $$${a} grows ${rPct}% each year. a) The model is $y = ${a}(${base})^t$. Find the balance after ${t} years (round to the nearest cent).`,
      promptEs: decay
        ? `Un teléfono que vale $$${a} pierde ${rPct}% de su valor cada año. a) El modelo es $y = ${a}(${base})^t$. Encuentra su valor después de ${t} años (redondea al centavo más cercano).`
        : `Una cuenta de ahorros con $$${a} crece ${rPct}% cada año. a) El modelo es $y = ${a}(${base})^t$. Encuentra el saldo después de ${t} años (redondea al centavo más cercano).`,
      answerLatex: String(answer),
      gradingMode: 'numeric_tolerance',
      tolerance: 0.02,
      steps: [
        {
          promptEn: decay
            ? `DECAY: b = 1 − r. What is $1 - ${rPct / 100}$?`
            : `GROWTH: b = 1 + r. What is $1 + ${rPct / 100}$?`,
          promptEs: decay
            ? `DECAIMIENTO: b = 1 − r. ¿Cuánto es $1 - ${rPct / 100}$?`
            : `CRECIMIENTO: b = 1 + r. ¿Cuánto es $1 + ${rPct / 100}$?`,
          expectedLatex: String(base),
          gradingMode: 'numeric_tolerance',
          hintEn: 'Convert the percent to a decimal first.',
          hintEs: 'Primero convierte el porcentaje a decimal.',
        },
        {
          promptEn: `Evaluate $${a}(${base})^{${t}}$.`,
          promptEs: `Evalúa $${a}(${base})^{${t}}$.`,
          expectedLatex: String(answer),
          gradingMode: 'numeric_tolerance',
        },
      ],
      params: { a, rPct, t, decay },
    };
  },

  linear_vs_exponential(rng) {
    const cases: [string, string, 'linear' | 'exponential'][] = [
      ['Juan receives $20 every month.', 'Juan recibe $20 cada mes.', 'linear'],
      ['The number of views doubles every day.', 'El número de vistas se duplica cada día.', 'exponential'],
      ['A tree grows 3 inches each year.', 'Un árbol crece 3 pulgadas cada año.', 'linear'],
      ['The investment grows 5% each year.', 'La inversión crece 5% cada año.', 'exponential'],
      ['Points are deducted 10 at a time for each late day.', 'Se descuentan 10 puntos por cada día de retraso.', 'linear'],
      ['The bacteria population triples every hour.', 'La población de bacterias se triplica cada hora.', 'exponential'],
    ];
    const [en, es, key] = cases[ri(rng, 0, cases.length - 1)];
    return {
      promptEn: `Is this situation **linear** or **exponential**? "${en}" (answer: linear / exponential)`,
      promptEs: `¿Esta situación es **lineal** o **exponencial**? "${es}" (responde: linear / exponential)`,
      answerLatex: key,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: 'Constant ADDING or SUBTRACTING change → linear. Doubling, tripling, or percent change → exponential. Which is it?',
          promptEs: 'Cambio constante de SUMA o RESTA → lineal. Duplicar, triplicar o cambio porcentual → exponencial. ¿Cuál es?',
          expectedLatex: key,
          gradingMode: 'exact',
        },
      ],
      params: { key },
    };
  },

  /* ---------------- Unit 7: Factoring ---------------- */

  gcf_monomials(rng) {
    const g = [2, 3, 4, 5, 6][ri(rng, 0, 4)];
    const m1 = g * ri(rng, 1, 4);
    const m2 = g * ri(rng, 1, 4);
    const e1 = ri(rng, 2, 4);
    const e2 = ri(rng, e1 + 1, 6);
    const gcfCoeff = gcd(m1, m2);
    return {
      promptEn: `Find the GCF of the monomials $${m1}x^{${e1}}$ and $${m2}x^{${e2}}$.`,
      promptEs: `Encuentra el MCD de los monomios $${m1}x^{${e1}}$ y $${m2}x^{${e2}}$.`,
      answerLatex: `${gcfCoeff}x^{${e1}}`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: Find the GCF of the coefficients ${m1} and ${m2}.`,
          promptEs: `PASO 1: Encuentra el MCD de los coeficientes ${m1} y ${m2}.`,
          expectedLatex: String(gcfCoeff),
          gradingMode: 'exact',
        },
        {
          promptEn: `STEP 2: Take the greatest number of x's both have in common. Write the full GCF.`,
          promptEs: `PASO 2: Toma la mayor cantidad de x que ambos tienen en común. Escribe el MCD completo.`,
          expectedLatex: `${gcfCoeff}x^{${e1}}`,
          gradingMode: 'exact',
          hintEn: 'Use the SMALLER exponent for the shared variable.',
          hintEs: 'Usa el exponente MENOR para la variable compartida.',
        },
      ],
      misconceptions: [
        {
          id: 'gcf_larger_exponent',
          answerLatex: `${gcfCoeff}x^{${e2}}`,
          feedbackEn: `The GCF uses the SMALLER exponent: $x^{${e1}}$ divides both monomials, but $x^{${e2}}$ doesn't divide $x^{${e1}}$.`,
          feedbackEs: `El MCD usa el exponente MENOR: $x^{${e1}}$ divide a ambos monomios, pero $x^{${e2}}$ no divide a $x^{${e1}}$.`,
        },
      ],
      params: { m1, m2, e1, e2 },
    };
  },

  factor_gcf(rng) {
    const g = ri(rng, 2, 5);
    const a = ri(rng, 2, 5);
    const b = nz(rng, -6, 6);
    // g x (a x + b)  →  ga x^2 + gb x
    return {
      promptEn: `Factor the polynomial using the GCF: $${g * a}x^2 ${sgn(g * b)}x$`,
      promptEs: `Factoriza el polinomio usando el MCD: $${g * a}x^2 ${sgn(g * b)}x$`,
      answerLatex: `${g}x(${coeff(a, 'x')} ${sgn(b)})`,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: `STEP 1: Find the GCF of $${g * a}x^2$ and $${Math.abs(g * b)}x$.`,
          promptEs: `PASO 1: Encuentra el MCD de $${g * a}x^2$ y $${Math.abs(g * b)}x$.`,
          expectedLatex: `${g}x`,
          gradingMode: 'exact',
        },
        {
          promptEn: 'STEP 2: Divide each term by the GCF (divide coefficients, subtract exponents) and write the factored form.',
          promptEs: 'PASO 2: Divide cada término entre el MCD (divide los coeficientes, resta los exponentes) y escribe la forma factorizada.',
          expectedLatex: `${g}x(${coeff(a, 'x')} ${sgn(b)})`,
          gradingMode: 'canonical_form',
          hintEn: 'Check your work: distribute the GCF back — you should get the original polynomial.',
          hintEs: 'Verifica tu trabajo: distribuye el MCD — debes obtener el polinomio original.',
        },
      ],
      params: { g, a, b },
    };
  },

  factor_trinomial(rng) {
    const p = nz(rng, -8, 8);
    let q = nz(rng, -8, 8);
    if (p === q) q = -q;
    const B = p + q;
    const C = p * q;
    return {
      promptEn: `Factor the trinomial: $x^2 ${sgn(B)}x ${sgn(C)}$`.replace(' + 0x', ''),
      promptEs: `Factoriza el trinomio: $x^2 ${sgn(B)}x ${sgn(C)}$`.replace(' + 0x', ''),
      answerLatex: `(x ${sgn(p)})(x ${sgn(q)})`,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: `Ask yourself: what two numbers **multiply** to ${C} and **add** to ${B}? List them separated by a comma.`,
          promptEs: `Pregúntate: ¿qué dos números se **multiplican** para dar ${C} y se **suman** para dar ${B}? Escríbelos separados por una coma.`,
          expectedLatex: `${p}, ${q}`,
          gradingMode: 'exact',
          hintEn: 'List the factor pairs of "c", then check which pair adds to "b".',
          hintEs: 'Enumera los pares de factores de "c" y verifica cuál par suma "b".',
        },
        {
          promptEn: 'Set up your binomial factors with those two integers.',
          promptEs: 'Escribe tus factores binomiales con esos dos enteros.',
          expectedLatex: `(x ${sgn(p)})(x ${sgn(q)})`,
          gradingMode: 'canonical_form',
          hintEn: 'OPTIONAL: FOIL your answer to check it!',
          hintEs: 'OPCIONAL: ¡Usa FOIL para comprobar tu respuesta!',
        },
      ],
      misconceptions: [
        {
          id: 'factor_signs_swapped',
          answerLatex: `(x ${sgn(-p)})(x ${sgn(-q)})`,
          feedbackEn: `So close — check the signs! Your two numbers must multiply to ${C} AND add to ${B}, signs included. FOIL your factors to verify.`,
          feedbackEs: `¡Casi — revisa los signos! Tus dos números deben multiplicarse para dar ${C} Y sumarse para dar ${B}, con signos incluidos. Usa FOIL para verificar tus factores.`,
        },
      ],
      params: { p, q },
    };
  },

  dots(rng) {
    const a = ri(rng, 1, 5);
    const b = ri(rng, 1, 9);
    const aTxt = a === 1 ? 'x' : `${a}x`;
    return {
      promptEn: `Factor using the **DOTS** method (difference of two squares): $${a === 1 ? '' : a * a}x^2 - ${b * b}$`,
      promptEs: `Factoriza usando el método **DOTS** (diferencia de dos cuadrados): $${a === 1 ? '' : a * a}x^2 - ${b * b}$`,
      answerLatex: `(${aTxt} + ${b})(${aTxt} - ${b})`,
      gradingMode: 'canonical_form',
      steps: [
        {
          promptEn: `Both terms are perfect squares with a subtraction sign between them. What is the square root of ${b * b}?`,
          promptEs: `Ambos términos son cuadrados perfectos con un signo de resta en medio. ¿Cuál es la raíz cuadrada de ${b * b}?`,
          expectedLatex: String(b),
          gradingMode: 'exact',
        },
        {
          promptEn: 'Set up the two binomials: one with a "+" sign and one with a "−" sign.',
          promptEs: 'Escribe los dos binomios: uno con signo "+" y otro con signo "−".',
          expectedLatex: `(${aTxt} + ${b})(${aTxt} - ${b})`,
          gradingMode: 'canonical_form',
          hintEn: 'OPTIONAL: check your work by FOILing!',
          hintEs: 'OPCIONAL: ¡comprueba tu trabajo con FOIL!',
        },
      ],
      params: { a, b },
    };
  },

  /* ---------------- Unit 8: Quadratics ---------------- */

  solve_sqrt_method(rng) {
    const a = ri(rng, 1, 4);
    const x = ri(rng, 1, 9);
    const c = a * x * x;
    return {
      promptEn: `Solve for all values of x using the square roots method: $${a === 1 ? '' : a}x^2 - ${c} = 0$. Write both solutions separated by a comma.`,
      promptEs: `Resuelve para todos los valores de x usando el método de raíces cuadradas: $${a === 1 ? '' : a}x^2 - ${c} = 0$. Escribe ambas soluciones separadas por una coma.`,
      answerLatex: `${x}, -${x}`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: Add ${c} to both sides${a > 1 ? `, then divide by ${a}` : ''}. What does $x^2$ equal?`,
          promptEs: `PASO 1: Suma ${c} en ambos lados${a > 1 ? ` y luego divide entre ${a}` : ''}. ¿A qué es igual $x^2$?`,
          expectedLatex: String(x * x),
          gradingMode: 'exact',
        },
        {
          promptEn: 'STEP 2: Square root both sides. Remember there are TWO square roots! Write both solutions.',
          promptEs: 'PASO 2: Saca la raíz cuadrada en ambos lados. ¡Recuerda que hay DOS raíces cuadradas! Escribe ambas soluciones.',
          expectedLatex: `${x}, -${x}`,
          gradingMode: 'exact',
          hintEn: 'A positive number has a positive AND a negative square root.',
          hintEs: 'Un número positivo tiene una raíz cuadrada positiva Y una negativa.',
        },
      ],
      misconceptions: [
        {
          id: 'missed_negative_root',
          answerLatex: String(x),
          feedbackEn: `${x} is only half the answer! $x^2 = ${x * x}$ has TWO solutions: ${x} and -${x}, because $(-${x})^2 = ${x * x}$ too.`,
          feedbackEs: `¡${x} es solo la mitad de la respuesta! $x^2 = ${x * x}$ tiene DOS soluciones: ${x} y -${x}, porque $(-${x})^2 = ${x * x}$ también.`,
        },
      ],
      params: { a, x },
    };
  },

  solve_quadratic_factoring(rng) {
    const p = nz(rng, -8, 8);
    let q = nz(rng, -8, 8);
    if (q === p) q = -q;
    const B = p + q;
    const C = p * q;
    return {
      promptEn: `Solve for all values of x by factoring: $x^2 ${sgn(B)}x ${sgn(C)} = 0$. Write the solutions separated by a comma.`.replace(' + 0x', ''),
      promptEs: `Resuelve para todos los valores de x factorizando: $x^2 ${sgn(B)}x ${sgn(C)} = 0$. Escribe las soluciones separadas por una coma.`.replace(' + 0x', ''),
      answerLatex: `${-p}, ${-q}`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `STEP 1: The equation is already in standard form. Factor: what multiplies to ${C} and adds to ${B}? (comma-separated)`,
          promptEs: `PASO 1: La ecuación ya está en forma estándar. Factoriza: ¿qué se multiplica para dar ${C} y se suma para dar ${B}? (separados por coma)`,
          expectedLatex: `${p}, ${q}`,
          gradingMode: 'exact',
        },
        {
          promptEn: `STEP 2: Use the **Zero Product Property**: set each factor equal to 0 and solve. Write both solutions.`,
          promptEs: `PASO 2: Usa la **Propiedad del Producto Cero**: iguala cada factor a 0 y resuelve. Escribe ambas soluciones.`,
          expectedLatex: `${-p}, ${-q}`,
          gradingMode: 'exact',
          hintEn: 'If (x+a)(x+b)=0 then x = −a or x = −b.',
          hintEs: 'Si (x+a)(x+b)=0 entonces x = −a o x = −b.',
        },
      ],
      params: { p, q },
    };
  },

  vertex_from_vertex_form(rng) {
    const h = nz(rng, -7, 7);
    const k = nz(rng, -9, 9);
    const a = nz(rng, -3, 3);
    return {
      promptEn: `State the **vertex** of $y = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${sgn(-h)})^2 ${sgn(k)}$. Write it as a point.`,
      promptEs: `Indica el **vértice** de $y = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${sgn(-h)})^2 ${sgn(k)}$. Escríbelo como un punto.`,
      answerLatex: `(${h}, ${k})`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: 'Vertex form is $y = a(x-h)^2 + k$ and the vertex is (h, k). Watch the sign on h!',
          promptEs: 'La forma de vértice es $y = a(x-h)^2 + k$ y el vértice es (h, k). ¡Cuidado con el signo de h!',
          expectedLatex: `(${h}, ${k})`,
          gradingMode: 'exact',
          hintEn: '(x − 3)² means h = 3; (x + 3)² means h = −3.',
          hintEs: '(x − 3)² significa h = 3; (x + 3)² significa h = −3.',
        },
      ],
      params: { h, k, a },
    };
  },

  axis_of_symmetry(rng) {
    const a = nz(rng, 1, 3);
    const xAxis = nz(rng, -5, 5);
    const b = -2 * a * xAxis;
    const c = ri(rng, -9, 9);
    return {
      promptEn: `Find the **axis of symmetry** of $y = ${coeff(a, 'x^2')} ${sgn(b)}x ${sgn(c)}$. Write your answer as an equation (x = ...).`,
      promptEs: `Encuentra el **eje de simetría** de $y = ${coeff(a, 'x^2')} ${sgn(b)}x ${sgn(c)}$. Escribe tu respuesta como una ecuación (x = ...).`,
      answerLatex: `x = ${xAxis}`,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: `Use the formula $x = \\frac{-b}{2a}$ with a = ${a}, b = ${b}. What is x?`,
          promptEs: `Usa la fórmula $x = \\frac{-b}{2a}$ con a = ${a}, b = ${b}. ¿Cuánto vale x?`,
          expectedLatex: `x = ${xAxis}`,
          gradingMode: 'exact',
          hintEn: 'The axis of symmetry is the vertical line through the vertex.',
          hintEs: 'El eje de simetría es la recta vertical que pasa por el vértice.',
        },
      ],
      params: { a, b, c, xAxis },
    };
  },

  projectile_ground(rng) {
    const t = ri(rng, 2, 6);
    const v = 16 * t;
    return {
      promptEn: `A ball is thrown into the air from the ground. Its height after t seconds is $h(t) = -16t^2 + ${v}t$. How many **seconds** after being thrown will the ball hit the ground?`,
      promptEs: `Se lanza una pelota al aire desde el suelo. Su altura después de t segundos es $h(t) = -16t^2 + ${v}t$. ¿Cuántos **segundos** después de lanzarla golpeará el suelo?`,
      answerLatex: String(t),
      gradingMode: 'exact',
      steps: [
        {
          promptEn: 'TIP 1: The ball is on the ground when the height is 0. Set $-16t^2 + ' + v + 't = 0$ and factor out the GCF. What is the GCF?',
          promptEs: 'CONSEJO 1: La pelota está en el suelo cuando la altura es 0. Iguala $-16t^2 + ' + v + 't = 0$ y factoriza el MCD. ¿Cuál es el MCD?',
          expectedLatex: '-16t',
          gradingMode: 'equivalent',
          hintEn: 'The zeros/roots are when the object is on the ground (height = 0).',
          hintEs: 'Los ceros/raíces son cuando el objeto está en el suelo (altura = 0).',
        },
        {
          promptEn: 'Use the Zero Product Property. Besides t = 0 (the throw), when does the ball land?',
          promptEs: 'Usa la Propiedad del Producto Cero. Además de t = 0 (el lanzamiento), ¿cuándo aterriza la pelota?',
          expectedLatex: String(t),
          gradingMode: 'exact',
        },
      ],
      params: { t },
    };
  },

  /* ------------- Unit 9: Function Families ------------- */

  transformation_identify(rng) {
    const k = nz(rng, -8, 8);
    const h = nz(rng, -8, 8);
    const kind = ri(rng, 0, 2);
    if (kind === 0) {
      return {
        promptEn: `Compared to $y = x^2$, how does the graph of $y = x^2 ${sgn(k)}$ move? (answer: up / down)`,
        promptEs: `Comparado con $y = x^2$, ¿cómo se mueve la gráfica de $y = x^2 ${sgn(k)}$? (responde: up / down)`,
        answerLatex: k > 0 ? 'up' : 'down',
        gradingMode: 'exact',
        params: { k, kind },
      };
    }
    if (kind === 1) {
      return {
        promptEn: `Compared to $y = |x|$, how does the graph of $y = |x ${sgn(-h)}|$ move? (answer: left / right)`,
        promptEs: `Comparado con $y = |x|$, ¿cómo se mueve la gráfica de $y = |x ${sgn(-h)}|$? (responde: left / right)`,
        answerLatex: h > 0 ? 'right' : 'left',
        gradingMode: 'exact',
        params: { h, kind },
      };
    }
    return {
      promptEn: `The graph of $y = -x^2$ opens... (answer: up / down)`,
      promptEs: `La gráfica de $y = -x^2$ abre hacia... (responde: up / down)`,
      answerLatex: 'down',
      gradingMode: 'exact',
      params: { kind },
    };
  },

  classify_function_type(rng) {
    const cases: [string, 'linear' | 'exponential' | 'quadratic'][] = [
      ['y = 2x + 5', 'linear'],
      ['y = x^2 + 6x + 12', 'quadratic'],
      ['y = 100(3)^x', 'exponential'],
      ['y = -x - 1', 'linear'],
      ['y = 2x^2 - 8', 'quadratic'],
      ['y = 50(1/2)^x', 'exponential'],
      ['-3x + 2y = 5', 'linear'],
    ];
    const [expr, key] = cases[ri(rng, 0, cases.length - 1)];
    return {
      promptEn: `Classify the function $${expr}$: **linear**, **quadratic**, or **exponential**?`,
      promptEs: `Clasifica la función $${expr}$: ¿**lineal** (linear), **cuadrática** (quadratic) o **exponencial** (exponential)?`,
      answerLatex: key,
      gradingMode: 'exact',
      steps: [
        {
          promptEn: 'Highest power of x is 1 → linear. Highest power of x is 2 → quadratic. x is in the exponent → exponential.',
          promptEs: 'La mayor potencia de x es 1 → lineal. La mayor potencia de x es 2 → cuadrática. La x está en el exponente → exponencial.',
          expectedLatex: key,
          gradingMode: 'exact',
        },
      ],
      params: { expr, key },
    };
  },

  /* ---------------- Sprints (fluency drills) ---------------- */

  // Each sprint template is tier-aware: 'modified' shrinks ranges (and drops
  // the trickiest operation), 'challenge' widens them or adds a step. The
  // 'standard' branch of each template must keep the exact rng-call sequence
  // it had before tiers existed — the seed replays these streams
  // deterministically to match problems already in the database.
  sprint_integer_ops(rng, tier) {
    if (tier === 'modified') {
      // Positive first operand, + / − only — fluency without sign gymnastics.
      const a = ri(rng, 1, 9);
      const b = nz(rng, -9, 9);
      const op = ['+', '-'][ri(rng, 0, 1)];
      return {
        promptEn: `$${a} ${op} (${b}) = ?$`,
        promptEs: `$${a} ${op} (${b}) = ?$`,
        answerLatex: String(op === '+' ? a + b : a - b),
        gradingMode: 'exact',
        params: { a, b, op },
      };
    }
    if (tier === 'challenge') {
      // Wider range, and division joins the mix (built as a*b ÷ b so the
      // quotient is always a clean integer).
      const a = nz(rng, -15, 15);
      const b = nz(rng, -15, 15);
      const op = ['+', '-', '*', '/'][ri(rng, 0, 3)];
      if (op === '/') {
        return {
          promptEn: `$${a * b} \\div (${b}) = ?$`,
          promptEs: `$${a * b} \\div (${b}) = ?$`,
          answerLatex: String(a),
          gradingMode: 'exact',
          params: { a, b, op },
        };
      }
      const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
      const disp = op === '*' ? '\\times' : op;
      return {
        promptEn: `$${a} ${disp} (${b}) = ?$`,
        promptEs: `$${a} ${disp} (${b}) = ?$`,
        answerLatex: String(answer),
        gradingMode: 'exact',
        params: { a, b, op },
      };
    }
    const a = nz(rng, -12, 12);
    const b = nz(rng, -12, 12);
    const op = ['+', '-', '*'][ri(rng, 0, 2)];
    const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const disp = op === '*' ? '\\times' : op;
    return {
      promptEn: `$${a} ${disp} (${b}) = ?$`,
      promptEs: `$${a} ${disp} (${b}) = ?$`,
      answerLatex: String(answer),
      gradingMode: 'exact',
      params: { a, b, op },
    };
  },

  sprint_perfect_squares(rng, tier) {
    const n =
      tier === 'modified' ? ri(rng, 2, 10) : tier === 'challenge' ? ri(rng, 8, 20) : ri(rng, 2, 15);
    const forward = rng() < 0.5;
    return forward
      ? {
          promptEn: `$${n}^2 = ?$`,
          promptEs: `$${n}^2 = ?$`,
          answerLatex: String(n * n),
          gradingMode: 'exact',
          params: { n, forward },
        }
      : {
          promptEn: `$\\sqrt{${n * n}} = ?$ (positive root)`,
          promptEs: `$\\sqrt{${n * n}} = ?$ (raíz positiva)`,
          answerLatex: String(n),
          gradingMode: 'exact',
          params: { n, forward },
        };
  },

  sprint_one_step_equations(rng, tier) {
    if (tier === 'modified') {
      // All-positive one-step: ax = c with small friendly numbers.
      const a = ri(rng, 2, 9);
      const x = ri(rng, 1, 9);
      return {
        promptEn: `Solve: $${coeff(a, 'x')} = ${a * x}$`,
        promptEs: `Resuelve: $${coeff(a, 'x')} = ${a * x}$`,
        answerLatex: String(x),
        gradingMode: 'exact',
        params: { a, x },
      };
    }
    if (tier === 'challenge') {
      // Two-step under time pressure: ax + b = c.
      const a = nz(rng, -9, 9);
      const b = nz(rng, -12, 12);
      const x = nz(rng, -9, 9);
      const c = a * x + b;
      return {
        promptEn: `Solve: $${coeff(a, 'x')} ${sgn(b)} = ${c}$`,
        promptEs: `Resuelve: $${coeff(a, 'x')} ${sgn(b)} = ${c}$`,
        answerLatex: String(x),
        gradingMode: 'exact',
        params: { a, b, x },
      };
    }
    const a = nz(rng, -9, 9);
    const x = nz(rng, -9, 9);
    return {
      promptEn: `Solve: $${coeff(a, 'x')} = ${a * x}$`,
      promptEs: `Resuelve: $${coeff(a, 'x')} = ${a * x}$`,
      answerLatex: String(x),
      gradingMode: 'exact',
      params: { a, x },
    };
  },
};

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Generate a validated problem: the answer key must grade correct against
 * itself and every step key against its own mode (catches template bugs).
 */
export function generateProblem(template: string, rng: Rng, tier?: GeneratorTier): GeneratedProblem {
  const gen = generators[template];
  if (!gen) throw new Error(`unknown generator template: ${template}`);
  for (let attempt = 0; attempt < 10; attempt++) {
    const p = gen(rng, tier);
    const ok =
      grade(p.answerLatex, p.answerLatex, p.gradingMode, p.tolerance).correct &&
      (p.steps ?? []).every(
        (s) => grade(s.expectedLatex, s.expectedLatex, s.gradingMode, p.tolerance).correct,
      );
    if (ok) {
      // A predicted wrong answer that happens to equal the key for these
      // parameters would mislabel a correct student — drop it.
      const misconceptions = p.misconceptions?.filter(
        (m) => !grade(m.answerLatex, p.answerLatex, p.gradingMode, p.tolerance).correct,
      );
      return {
        ...p,
        misconceptions: misconceptions?.length ? misconceptions : undefined,
        params: { ...p.params, template },
      };
    }
  }
  throw new Error(`template ${template} failed self-validation`);
}
