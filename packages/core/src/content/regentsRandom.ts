/**
 * Procedurally generated Regents Review questions. Every round serves
 * REGENTS_ROUND_SIZE questions: round 0 is the handwritten bank in regents.ts
 * topped up with generated questions (slots REGENTS_BANK_SIZE+1..ROUND_SIZE),
 * and once a round is finished the student can "practice again" with a fully
 * generated set (rounds 1, 2, ...). Every topic has four slot generators
 * mirroring the archetypes of the handwritten bank; slots beyond the fourth
 * cycle through those archetypes with fresh parameters. Distractors are the
 * same predicted-mistake wrong answers the misconception system uses (forgot
 * the inequality flip, skipped the FOIL middle terms, ...).
 *
 * Determinism is the security model: a question is fully determined by its
 * seed, which the API derives from (userId, topic, round, slot). The server
 * regenerates the identical question at grading time, so generated questions
 * are never stored and the correct choice never reaches the client before the
 * student's one allowed attempt.
 *
 * Number ranges stay middle-school friendly (design guidance: small values,
 * roughly 1–20): coefficients within ±12, answers constructed first so they
 * come out as clean small integers, negatives only where the skill needs them.
 */
import { makeRng, type Rng } from '../math/generators.js';
import type { RegentsQuestion } from './regents.js';

export type RegentsQuestionContent = Omit<RegentsQuestion, 'id'>;

/** Questions per topic per round. */
export const REGENTS_ROUND_SIZE = 10;

/** Handwritten questions per topic in regents.ts (round 0 slots 1..4). */
export const REGENTS_BANK_SIZE = 4;

/* ------------------------------------------------------------------ */
/* Ids and seeds                                                       */
/* ------------------------------------------------------------------ */

/** Attempt key for a generated question, e.g. "linear-equations:r2:q3". */
export function regentsGeneratedId(slug: string, round: number, slot: number): string {
  return `${slug}:r${round}:q${slot}`;
}

const GENERATED_ID = /^([a-z0-9-]+):r(0|[1-9]\d{0,3}):q(10|[1-9])$/;

export function parseRegentsGeneratedId(
  id: string,
): { slug: string; round: number; slot: number } | null {
  const m = GENERATED_ID.exec(id);
  if (!m) return null;
  const round = Number(m[2]);
  const slot = Number(m[3]);
  // Round 0 slots 1..BANK_SIZE belong to the handwritten bank — a generated
  // id there would let a client double-answer the same slot.
  if (round === 0 && slot <= REGENTS_BANK_SIZE) return null;
  if (slot > REGENTS_ROUND_SIZE) return null;
  return { slug: m[1], round, slot };
}

/**
 * FNV-1a hash → 32-bit seed. The same (user, topic, round, slot) always maps
 * to the same seed, so serving and grading reconstruct the same question.
 */
export function regentsQuestionSeed(
  userId: number | string,
  slug: string,
  round: number,
  slot: number,
): number {
  const key = `${userId}:${slug}:${round}:${slot}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/* Small helpers (mirroring math/generators.ts conventions)            */
/* ------------------------------------------------------------------ */

const ri = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const nz = (rng: Rng, lo: number, hi: number) => {
  let v = 0;
  while (v === 0) v = ri(rng, lo, hi);
  return v;
};
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[ri(rng, 0, arr.length - 1)];
const sgn = (n: number) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);
const coeff = (n: number, v: string) => (n === 1 ? v : n === -1 ? `-${v}` : `${n}${v}`);
const fmt = (v: number) => String(Math.round(v * 100) / 100);
/** "Ax^2 + Bx + C" with zero terms dropped ("0" when all are zero). */
const quad = (A: number, B: number, C: number) => {
  const parts: string[] = [];
  if (A !== 0) parts.push(coeff(A, 'x^2'));
  if (B !== 0) parts.push(coeff(B, 'x'));
  if (C !== 0) parts.push(String(C));
  return parts.length ? parts.join(' + ').replace(/\+ -/g, '- ') : '0';
};
const pt = (x: number, y: number) => `$(${x}, ${y})$`;
/** A literal dollar amount in prose: "\$25". MathText treats the escaped
 * `\$` as a plain `$` (not a math delimiter), so the whole thing renders
 * as text without pulling neighboring words into a math span. */
const usd = (n: number) => `\\$${n}`;

/** A choice: one string when En and Es render identically (pure math). */
type Choice = string | { en: string; es: string };
const cEn = (c: Choice) => (typeof c === 'string' ? c : c.en);
const cEs = (c: Choice) => (typeof c === 'string' ? c : c.es);

/** Shuffle correct + distractors into place, tracking where correct lands. */
function withChoices(rng: Rng, correct: Choice, distractors: Choice[]) {
  const all = [correct, ...distractors];
  for (let i = all.length - 1; i > 0; i--) {
    const j = ri(rng, 0, i);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return {
    choicesEn: all.map(cEn),
    choicesEs: all.map(cEs),
    correctIndex: all.indexOf(correct),
  };
}

/**
 * First `n` candidates distinct from the answer and each other (numeric).
 * Throws when the pool runs dry — the outer generation loop redraws.
 */
function pickDistinct(cands: number[], answer: number, n = 3): number[] {
  const out: number[] = [];
  for (const c of cands) {
    if (!Number.isFinite(c)) continue;
    if (Math.abs(c - answer) < 1e-9) continue;
    if (out.some((o) => Math.abs(o - c) < 1e-9)) continue;
    out.push(c);
    if (out.length === n) break;
  }
  if (out.length < n) throw new Error('not enough distinct distractors');
  return out;
}

/** Keep only "nice" decimals (quarters) so choices never look like 7.67. */
const isNice = (v: number) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-9;

type SlotGenerator = (rng: Rng) => RegentsQuestionContent;

/* ------------------------------------------------------------------ */
/* Topic: exponents-radicals                                           */
/* ------------------------------------------------------------------ */

const exponentsRadicals: SlotGenerator[] = [
  // q1: product rule x^a · x^b
  (rng) => {
    const a = ri(rng, 2, 9);
    let b = ri(rng, 2, 9);
    while (b === a) b = ri(rng, 2, 9); // a ≠ b keeps x^{a+b}, x^{ab}, x^{|a−b|} distinct
    return {
      promptEn: `Which expression is equivalent to $x^{${a}} \\cdot x^{${b}}$?`,
      promptEs: `¿Qué expresión es equivalente a $x^{${a}} \\cdot x^{${b}}$?`,
      ...withChoices(rng, `$x^{${a + b}}$`, [
        `$x^{${a * b}}$`,
        `$2x^{${a + b}}$`,
        `$x^{${Math.abs(a - b)}}$`,
      ]),
      explanationEn: `When multiplying powers with the **same base**, ADD the exponents: $x^{${a}} \\cdot x^{${b}} = x^{${a}+${b}} = x^{${a + b}}$. Multiplying them ($x^{${a * b}}$) is the rule for a power raised to a power.`,
      explanationEs: `Al multiplicar potencias con la **misma base**, SUMA los exponentes: $x^{${a}} \\cdot x^{${b}} = x^{${a}+${b}} = x^{${a + b}}$. Multiplicarlos ($x^{${a * b}}$) es la regla para una potencia elevada a otra potencia.`,
    };
  },
  // q2: simplify √(o²·i)
  (rng) => {
    const o = pick(rng, [4, 6]); // composite, so a partially simplified trap exists
    const i = pick(rng, [2, 3, 5]);
    const n = o * o * i;
    const partials =
      o === 4
        ? [`$2\\sqrt{${4 * i}}$`, `$${o * o}\\sqrt{${i}}$`, `$${2 * o}\\sqrt{${i}}$`]
        : [`$3\\sqrt{${4 * i}}$`, `$2\\sqrt{${9 * i}}$`, `$${o * o}\\sqrt{${i}}$`];
    return {
      promptEn: `What is $\\sqrt{${n}}$ written in simplest radical form?`,
      promptEs: `¿Cuál es $\\sqrt{${n}}$ escrito en su forma radical más simple?`,
      ...withChoices(rng, `$${o}\\sqrt{${i}}$`, partials),
      explanationEn: `Find the **largest perfect square** inside ${n}: $${n} = ${o * o} \\cdot ${i}$. Then $\\sqrt{${n}} = \\sqrt{${o * o}} \\cdot \\sqrt{${i}} = ${o}\\sqrt{${i}}$. Splitting out a smaller perfect square leaves the radical not fully simplified.`,
      explanationEs: `Encuentra el **cuadrado perfecto más grande** dentro de ${n}: $${n} = ${o * o} \\cdot ${i}$. Entonces $\\sqrt{${n}} = \\sqrt{${o * o}} \\cdot \\sqrt{${i}} = ${o}\\sqrt{${i}}$. Usar un cuadrado perfecto más pequeño deja el radical sin simplificar por completo.`,
    };
  },
  // q3: power of a product (c x^a)^p
  (rng) => {
    const [c, p] = pick(rng, [
      [2, 3],
      [3, 2],
      [3, 3],
    ] as const); // pairs where c·p ≠ c^p
    const a = p === 2 ? ri(rng, 3, 4) : ri(rng, 2, 4); // avoid a=p=2 (a·p = a+p)
    return {
      promptEn: `Which expression is equivalent to $(${c}x^{${a}})^{${p}}$?`,
      promptEs: `¿Qué expresión es equivalente a $(${c}x^{${a}})^{${p}}$?`,
      ...withChoices(rng, `$${c ** p}x^{${a * p}}$`, [
        `$${c * p}x^{${a * p}}$`,
        `$${c ** p}x^{${a + p}}$`,
        `$${c}x^{${a * p}}$`,
      ]),
      explanationEn: `The power applies to **everything** inside the parentheses: $(${c}x^{${a}})^{${p}} = ${c}^{${p}} \\cdot (x^{${a}})^{${p}} = ${c ** p}x^{${a * p}}$. Raise the coefficient to the power ($${c}^{${p}} = ${c ** p}$) and multiply the exponents ($${a} \\cdot ${p} = ${a * p}$).`,
      explanationEs: `La potencia se aplica a **todo** lo que está dentro del paréntesis: $(${c}x^{${a}})^{${p}} = ${c}^{${p}} \\cdot (x^{${a}})^{${p}} = ${c ** p}x^{${a * p}}$. Eleva el coeficiente a la potencia ($${c}^{${p}} = ${c ** p}$) y multiplica los exponentes ($${a} \\cdot ${p} = ${a * p}$).`,
    };
  },
  // q4: spot the irrational number
  (rng) => {
    const irr = pick(rng, [2, 3, 5, 6, 7, 10, 11, 13]);
    const sq = pick(rng, [4, 9, 16, 25, 36, 49]);
    const dec = pick(rng, ['0.5', '0.25', '0.75', '0.4']);
    const fa = ri(rng, 1, 4);
    const fb = ri(rng, fa + 1, 9);
    return {
      promptEn: 'Which number is **irrational**?',
      promptEs: '¿Qué número es **irracional**?',
      ...withChoices(rng, `$\\sqrt{${irr}}$`, [
        `$\\sqrt{${sq}}$`,
        `$${dec}$`,
        `$\\tfrac{${fa}}{${fb}}$`,
      ]),
      explanationEn: `${irr} is **not a perfect square**, so $\\sqrt{${irr}}$ is a never-ending, never-repeating decimal — irrational. $\\sqrt{${sq}} = ${Math.sqrt(sq)}$, $${dec}$, and $\\tfrac{${fa}}{${fb}}$ can all be written as ratios of integers, so they are rational.`,
      explanationEs: `${irr} **no es un cuadrado perfecto**, así que $\\sqrt{${irr}}$ es un decimal infinito no periódico — irracional. $\\sqrt{${sq}} = ${Math.sqrt(sq)}$, $${dec}$ y $\\tfrac{${fa}}{${fb}}$ se pueden escribir como razones de enteros, por lo tanto son racionales.`,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: linear-equations                                             */
/* ------------------------------------------------------------------ */

const linearEquations: SlotGenerator[] = [
  // q1: two-step ax + b = c
  (rng) => {
    const a = ri(rng, 2, 4);
    const x = ri(rng, 2, 5);
    const b = ri(rng, 1, 7);
    const c = a * x + b;
    const cands = [c - b, x + 1, x + 2, x - 1, 2 * x, x + 3];
    if (Number.isInteger((c + b) / a)) cands.splice(1, 0, (c + b) / a);
    const d = pickDistinct(cands, x);
    return {
      promptEn: `What is the solution of $${a}x + ${b} = ${c}$?`,
      promptEs: `¿Cuál es la solución de $${a}x + ${b} = ${c}$?`,
      ...withChoices(rng, `$x = ${x}$`, d.map((v) => `$x = ${fmt(v)}$`)),
      explanationEn: `Undo operations in reverse order. Subtract ${b} from both sides: $${a}x = ${c - b}$. Then divide both sides by ${a}: $x = ${x}$. Check: $${a}(${x}) + ${b} = ${c}$ ✓`,
      explanationEs: `Deshaz las operaciones en orden inverso. Resta ${b} en ambos lados: $${a}x = ${c - b}$. Luego divide ambos lados entre ${a}: $x = ${x}$. Comprueba: $${a}(${x}) + ${b} = ${c}$ ✓`,
      anim: { skillSlug: 'multi-step-equations', params: { a, b, x } },
    };
  },
  // q2: distribute k(x − m) = c
  (rng) => {
    const k = ri(rng, 2, 5);
    const m = ri(rng, 1, 5);
    const x = m + ri(rng, 2, 6);
    const c = k * (x - m);
    const cands = [(c + m) / k, c / k, x + 1, x - 1, x + 2, x - 2].filter(isNice);
    const d = pickDistinct(cands, x);
    return {
      promptEn: `What is the solution of $${k}(x - ${m}) = ${c}$?`,
      promptEs: `¿Cuál es la solución de $${k}(x - ${m}) = ${c}$?`,
      ...withChoices(rng, `$x = ${x}$`, d.map((v) => `$x = ${fmt(v)}$`)),
      explanationEn: `Distribute first: $${k}x - ${k * m} = ${c}$. Add ${k * m} to both sides: $${k}x = ${c + k * m}$, so $x = ${x}$. (A common error is multiplying the ${k} only by $x$ and not by $-${m}$.)`,
      explanationEs: `Primero distribuye: $${k}x - ${k * m} = ${c}$. Suma ${k * m} en ambos lados: $${k}x = ${c + k * m}$, así que $x = ${x}$. (Un error común es multiplicar el ${k} solo por $x$ y no por $-${m}$.)`,
    };
  },
  // q3: variables on both sides ax + b = cx + d
  (rng) => {
    const c = ri(rng, 1, 4);
    const g = ri(rng, 1, 4); // a − c
    const a = c + g;
    const x = ri(rng, 1, 6);
    const b = ri(rng, 1, 9);
    const d = b + g * x;
    const cands = [-x, x + 1, x + 2, x - 1, 2 * x];
    if (Number.isInteger((d + b) / g)) cands.splice(1, 0, (d + b) / g);
    const dis = pickDistinct(cands, x);
    return {
      promptEn: `Solve for $x$: $${a}x + ${b} = ${coeff(c, 'x')} + ${d}$`,
      promptEs: `Resuelve para $x$: $${a}x + ${b} = ${coeff(c, 'x')} + ${d}$`,
      ...withChoices(rng, `$x = ${x}$`, dis.map((v) => `$x = ${fmt(v)}$`)),
      explanationEn: `Collect the variables on one side: subtract $${coeff(c, 'x')}$ from both sides to get $${g}x + ${b} = ${d}$. Subtract ${b}: $${g}x = ${d - b}$. Divide by ${g}: $x = ${x}$. Check: $${a}(${x}) + ${b} = ${a * x + b}$ and $${c}(${x}) + ${d} = ${c * x + d}$ ✓`,
      explanationEs: `Agrupa las variables en un lado: resta $${coeff(c, 'x')}$ en ambos lados para obtener $${g}x + ${b} = ${d}$. Resta ${b}: $${g}x = ${d - b}$. Divide entre ${g}: $x = ${x}$. Comprueba: $${a}(${x}) + ${b} = ${a * x + b}$ y $${c}(${x}) + ${d} = ${c * x + d}$ ✓`,
      anim: { skillSlug: 'var-both-sides', params: { a, b, c, x } },
    };
  },
  // q4: x/k − b = c
  (rng) => {
    const k = ri(rng, 2, 4);
    const s = ri(rng, 2, Math.floor(20 / k)); // b + c, keeps x = k·s ≤ 20
    const b = ri(rng, 1, s - 1);
    const c = s - b;
    const x = k * s;
    const d = pickDistinct([s, k * c, x - k, x + k, s + 1, x + 1], x);
    return {
      promptEn: `What is the solution of $\\tfrac{x}{${k}} - ${b} = ${c}$?`,
      promptEs: `¿Cuál es la solución de $\\tfrac{x}{${k}} - ${b} = ${c}$?`,
      ...withChoices(rng, `$x = ${x}$`, d.map((v) => `$x = ${fmt(v)}$`)),
      explanationEn: `Add ${b} to both sides first: $\\tfrac{x}{${k}} = ${s}$. Then multiply both sides by ${k}: $x = ${x}$. (Answering $${s}$ means the last step — multiplying by ${k} — was skipped.)`,
      explanationEs: `Primero suma ${b} en ambos lados: $\\tfrac{x}{${k}} = ${s}$. Luego multiplica ambos lados por ${k}: $x = ${x}$. (Responder $${s}$ significa que se saltó el último paso — multiplicar por ${k}.)`,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: inequalities                                                 */
/* ------------------------------------------------------------------ */

const inequalities: SlotGenerator[] = [
  // q1: −ax + b > c, remember the flip
  (rng) => {
    const a = ri(rng, 2, 4);
    const v = nz(rng, -5, 5);
    const b = ri(rng, 1, 9);
    const c = b - a * v;
    const baseOp = pick(rng, ['>', '<'] as const);
    const finalOp = baseOp === '>' ? '<' : '>';
    return {
      promptEn: `What is the solution of $-${a}x + ${b} ${baseOp} ${c}$?`,
      promptEs: `¿Cuál es la solución de $-${a}x + ${b} ${baseOp} ${c}$?`,
      ...withChoices(rng, `$x ${finalOp} ${v}$`, [
        `$x ${baseOp} ${v}$`,
        `$x ${finalOp} ${-v}$`,
        `$x ${baseOp} ${-v}$`,
      ]),
      explanationEn: `Subtract ${b}: $-${a}x ${baseOp} ${c - b}$. Now divide by $-${a}$ — dividing by a **negative flips the inequality sign**: $x ${finalOp} ${v}$. Forgetting the flip gives $x ${baseOp} ${v}$, the trap answer.`,
      explanationEs: `Resta ${b}: $-${a}x ${baseOp} ${c - b}$. Ahora divide entre $-${a}$ — dividir entre un **negativo invierte el signo de la desigualdad**: $x ${finalOp} ${v}$. Olvidar el cambio da $x ${baseOp} ${v}$, la respuesta trampa.`,
      anim: { skillSlug: 'inequalities', params: { a: -a, b, x: v, baseOp } },
    };
  },
  // q2: which value is in the solution set
  (rng) => {
    const a = ri(rng, 2, 5);
    const t = ri(rng, 4, 8);
    const b = ri(rng, 1, Math.min(9, a * t - 1));
    const c = a * t - b;
    const ge = rng() < 0.5;
    const op = ge ? '\\ge' : '\\le';
    const correct = ge ? t + pick(rng, [0, 1, 2]) : t - pick(rng, [0, 1, 2]);
    const offs = ge ? [-1, -2, -3] : [1, 2, 3];
    return {
      promptEn: `Which value of $x$ is in the solution set of $${a}x - ${b} ${op} ${c}$?`,
      promptEs: `¿Qué valor de $x$ está en el conjunto solución de $${a}x - ${b} ${op} ${c}$?`,
      ...withChoices(rng, `$${correct}$`, offs.map((o) => `$${t + o}$`)),
      explanationEn: `Solve it first: add ${b} to get $${a}x ${op} ${a * t}$, then divide by ${a} to get $x ${op} ${t}$. The only choice that is ${ge ? 'at least' : 'at most'} ${t} is $${correct}$. You can also test each choice: $${a}(${correct}) - ${b} = ${a * correct - b}$ ✓`,
      explanationEs: `Primero resuélvela: suma ${b} para obtener $${a}x ${op} ${a * t}$, luego divide entre ${a}: $x ${op} ${t}$. La única opción que es ${ge ? 'al menos' : 'como máximo'} ${t} es $${correct}$. También puedes probar cada opción: $${a}(${correct}) - ${b} = ${a * correct - b}$ ✓`,
    };
  },
  // q3: b − x ≤ c
  (rng) => {
    const b = ri(rng, 3, 9);
    const v = nz(rng, -6, Math.min(6, b - 1)); // keep c = b − v ≥ 1
    const c = b - v;
    return {
      promptEn: `What is the solution of $${b} - x \\le ${c}$?`,
      promptEs: `¿Cuál es la solución de $${b} - x \\le ${c}$?`,
      ...withChoices(rng, `$x \\ge ${v}$`, [
        `$x \\le ${v}$`,
        `$x \\ge ${-v}$`,
        `$x \\le ${-v}$`,
      ]),
      explanationEn: `Subtract ${b}: $-x \\le ${c - b}$. Multiply (or divide) both sides by $-1$ and **flip the sign**: $x \\ge ${v}$. Check with a number that is $\\ge ${v}$ to confirm it makes $${b} - x \\le ${c}$ true.`,
      explanationEs: `Resta ${b}: $-x \\le ${c - b}$. Multiplica (o divide) ambos lados por $-1$ e **invierte el signo**: $x \\ge ${v}$. Comprueba con un número que sea $\\ge ${v}$ para confirmar que hace verdadera $${b} - x \\le ${c}$.`,
    };
  },
  // q4: budget word problem, round down
  (rng) => {
    const name = pick(rng, ['Jayden', 'Maya', 'Carlos', 'Ava'] as const);
    const scene = pick(rng, [
      {
        en: (F: number, p: number, B: number) =>
          `A gym charges a ${usd(F)} sign-up fee plus ${usd(p)} per class. ${name} can spend at most ${usd(B)}. What is the **greatest** number of classes ${name} can take, using $${F} + ${p}c \\le ${B}$?`,
        es: (F: number, p: number, B: number) =>
          `Un gimnasio cobra una cuota de inscripción de ${usd(F)} más ${usd(p)} por clase. ${name} puede gastar como máximo ${usd(B)}. ¿Cuál es el **mayor** número de clases que puede tomar, usando $${F} + ${p}c \\le ${B}$?`,
        unitEn: 'classes',
        unitEs: 'clases',
      },
      {
        en: (F: number, p: number, B: number) =>
          `An arcade charges a ${usd(F)} entry fee plus ${usd(p)} per game. ${name} can spend at most ${usd(B)}. What is the **greatest** number of games ${name} can play, using $${F} + ${p}g \\le ${B}$?`,
        es: (F: number, p: number, B: number) =>
          `Una sala de juegos cobra una entrada de ${usd(F)} más ${usd(p)} por juego. ${name} puede gastar como máximo ${usd(B)}. ¿Cuál es el **mayor** número de juegos que puede jugar, usando $${F} + ${p}g \\le ${B}$?`,
        unitEn: 'games',
        unitEs: 'juegos',
      },
    ] as const);
    const p = ri(rng, 2, 5);
    const F = ri(rng, 10, 30);
    const n = ri(rng, 5, 9);
    const r = ri(rng, 1, p - 1);
    const B = F + p * n + r;
    return {
      promptEn: scene.en(F, p, B),
      promptEs: scene.es(F, p, B),
      ...withChoices(rng, `$${n}$`, [`$${n + 1}$`, `$${n - 1}$`, `$${B - F}$`]),
      explanationEn: `Subtract ${F}: $${p}c \\le ${B - F}$. Divide by ${p}: $c \\le ${fmt((B - F) / p)}$. You cannot pay for a fraction, so round **down** to the greatest whole number: $${n}$ ${scene.unitEn} ($${F} + ${p}(${n}) = ${F + p * n} \\le ${B}$ ✓).`,
      explanationEs: `Resta ${F}: $${p}c \\le ${B - F}$. Divide entre ${p}: $c \\le ${fmt((B - F) / p)}$. No se puede pagar una fracción, así que redondea **hacia abajo** al mayor número entero: $${n}$ ${scene.unitEs} ($${F} + ${p}(${n}) = ${F + p * n} \\le ${B}$ ✓).`,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: linear-functions                                             */
/* ------------------------------------------------------------------ */

const linearFunctions: SlotGenerator[] = [
  // q1: slope from two points (integer slope)
  (rng) => {
    const m = nz(rng, -1, 1) * ri(rng, 2, 3);
    const d = ri(rng, 2, 4);
    const x1 = ri(rng, 1, 6);
    const x2 = x1 + d;
    const y1 = ri(rng, 1, 8);
    const y2 = y1 + m * d;
    const recip = m > 0 ? `$\\tfrac{1}{${m}}$` : `$-\\tfrac{1}{${-m}}$`;
    return {
      promptEn: `What is the slope of the line that passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$?`,
      promptEs: `¿Cuál es la pendiente de la recta que pasa por $(${x1}, ${y1})$ y $(${x2}, ${y2})$?`,
      ...withChoices(rng, `$${m}$`, [`$${m * d}$`, `$${-m}$`, recip]),
      explanationEn: `Slope is **rise over run**: $m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${y2} - ${y1}}{${x2} - ${x1}} = \\frac{${m * d}}{${d}} = ${m}$. Getting ${recip} means the fraction was flipped (run over rise).`,
      explanationEs: `La pendiente es **cambio en y sobre cambio en x**: $m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${y2} - ${y1}}{${x2} - ${x1}} = \\frac{${m * d}}{${d}} = ${m}$. Obtener ${recip} significa que la fracción se invirtió.`,
      anim: { skillSlug: 'slope-intercepts', params: { x1, y1, x2, y2 } },
    };
  },
  // q2: read slope and y-intercept from y = mx + b
  (rng) => {
    const m = nz(rng, -8, 8);
    let b = nz(rng, -8, 8);
    while (b === m || b === -m) b = nz(rng, -8, 8); // keeps the four combos distinct
    const opt = (mm: number, bb: number): Choice => ({
      en: `slope $= ${mm}$, $y$-intercept $= ${bb}$`,
      es: `pendiente $= ${mm}$, intercepto en $y = ${bb}$`,
    });
    return {
      promptEn: `For the line $y = ${coeff(m, 'x')} ${sgn(b)}$, what are the slope and the $y$-intercept?`,
      promptEs: `Para la recta $y = ${coeff(m, 'x')} ${sgn(b)}$, ¿cuáles son la pendiente y el intercepto en $y$?`,
      ...withChoices(rng, opt(m, b), [opt(b, m), opt(-m, b), opt(m, -b)]),
      explanationEn: `In slope-intercept form $y = mx + b$, the coefficient of $x$ is the slope and the constant is the $y$-intercept. Here $m = ${m}$ (keep the sign!) and $b = ${b}$.`,
      explanationEs: `En la forma pendiente-intercepto $y = mx + b$, el coeficiente de $x$ es la pendiente y la constante es el intercepto en $y$. Aquí $m = ${m}$ (¡conserva el signo!) y $b = ${b}$.`,
    };
  },
  // q3: parallel line through (0, c)
  (rng) => {
    const m = nz(rng, -1, 1) * ri(rng, 2, 5);
    const b = nz(rng, -9, 9);
    const c = nz(rng, -9, 9);
    const perp = m > 0 ? `-\\tfrac{1}{${m}}x` : `\\tfrac{1}{${-m}}x`;
    return {
      promptEn: `Which equation represents the line **parallel** to $y = ${coeff(m, 'x')} ${sgn(b)}$ that passes through $(0, ${c})$?`,
      promptEs: `¿Qué ecuación representa la recta **paralela** a $y = ${coeff(m, 'x')} ${sgn(b)}$ que pasa por $(0, ${c})$?`,
      ...withChoices(rng, `$y = ${coeff(m, 'x')} ${sgn(c)}$`, [
        `$y = ${coeff(-m, 'x')} ${sgn(c)}$`,
        `$y = ${perp} ${sgn(c)}$`,
        `$y = ${coeff(m, 'x')} ${sgn(-c)}$`,
      ]),
      explanationEn: `Parallel lines have the **same slope**, so keep $m = ${m}$. The point $(0, ${c})$ is on the $y$-axis, so the $y$-intercept is ${c}: $y = ${coeff(m, 'x')} ${sgn(c)}$. ($${perp.replace('x', '')}$ would be the slope of a *perpendicular* line.)`,
      explanationEs: `Las rectas paralelas tienen la **misma pendiente**, así que conserva $m = ${m}$. El punto $(0, ${c})$ está sobre el eje $y$, así que el intercepto en $y$ es ${c}: $y = ${coeff(m, 'x')} ${sgn(c)}$. ($${perp.replace('x', '')}$ sería la pendiente de una recta *perpendicular*.)`,
    };
  },
  // q4: evaluate f(v) for f(x) = ax + b
  (rng) => {
    const a = nz(rng, -1, 1) * ri(rng, 2, 6);
    const b = nz(rng, -9, 9);
    const v = nz(rng, -6, 6);
    const ans = a * v + b;
    const d = pickDistinct([-ans, a * v - b, -a * v + b, a * v, b, ans + 2, ans - 2], ans);
    return {
      promptEn: `If $f(x) = ${coeff(a, 'x')} ${sgn(b)}$, what is $f(${v})$?`,
      promptEs: `Si $f(x) = ${coeff(a, 'x')} ${sgn(b)}$, ¿cuál es $f(${v})$?`,
      ...withChoices(rng, `$${ans}$`, d.map((x) => `$${fmt(x)}$`)),
      explanationEn: `Substitute $${v}$ for $x$: $f(${v}) = ${a}(${v}) ${sgn(b)} = ${a * v} ${sgn(b)} = ${ans}$. Watch the signs when multiplying and adding.`,
      explanationEs: `Sustituye $${v}$ por $x$: $f(${v}) = ${a}(${v}) ${sgn(b)} = ${a * v} ${sgn(b)} = ${ans}$. Cuidado con los signos al multiplicar y sumar.`,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: systems                                                      */
/* ------------------------------------------------------------------ */

const systems: SlotGenerator[] = [
  // q1: y = x + p and y = qx + r
  (rng) => {
    const q = ri(rng, 2, 3);
    const x = ri(rng, 1, 5);
    let p = ri(rng, 1, 8);
    while (p === (q - 1) * x) p = ri(rng, 1, 8); // keeps r ≠ 0 so line 2 displays cleanly
    const r = p - (q - 1) * x;
    const y = x + p;
    return {
      promptEn: `What is the solution of the system $y = x + ${p}$ and $y = ${q}x ${sgn(r)}$?`,
      promptEs: `¿Cuál es la solución del sistema $y = x + ${p}$ y $y = ${q}x ${sgn(r)}$?`,
      ...withChoices(rng, pt(x, y), [
        pt(y, x),
        pt(x - 1, x - 1 + p),
        pt(x + 1, q * (x + 1) + r),
      ]),
      explanationEn: `Both expressions equal $y$, so set them equal: $x + ${p} = ${q}x ${sgn(r)}$. Solving gives $x = ${x}$, and then $y = ${x} + ${p} = ${y}$. The solution is the point $(${x}, ${y})$ — it must work in **both** equations.`,
      explanationEs: `Ambas expresiones son iguales a $y$, así que iguálalas: $x + ${p} = ${q}x ${sgn(r)}$. Al resolver, $x = ${x}$, y luego $y = ${x} + ${p} = ${y}$. La solución es el punto $(${x}, ${y})$ — debe funcionar en **ambas** ecuaciones.`,
    };
  },
  // q2: elimination x + y = S, x − y = D
  (rng) => {
    const y = ri(rng, 1, 6);
    const D = ri(rng, 2, 5);
    const x = y + D;
    const S = x + y;
    return {
      promptEn: `What is the solution of the system $x + y = ${S}$ and $x - y = ${D}$?`,
      promptEs: `¿Cuál es la solución del sistema $x + y = ${S}$ y $x - y = ${D}$?`,
      ...withChoices(rng, pt(x, y), [pt(y, x), pt(x - 1, y + 1), pt(x + 1, y - 1)]),
      explanationEn: `**Elimination**: add the two equations — the $y$ terms cancel: $2x = ${S + D}$, so $x = ${x}$. Substitute back: $${x} + y = ${S}$, so $y = ${y}$. Order matters: $(${x}, ${y})$ means $x = ${x}$, $y = ${y}$.`,
      explanationEs: `**Eliminación**: suma las dos ecuaciones — los términos $y$ se cancelan: $2x = ${S + D}$, así que $x = ${x}$. Sustituye: $${x} + y = ${S}$, así que $y = ${y}$. El orden importa: $(${x}, ${y})$ significa $x = ${x}$, $y = ${y}$.`,
    };
  },
  // q3: two items, price word problem
  (rng) => {
    const item = pick(rng, [
      { twoEn: 'Two burgers and a drink', oneEn: 'One burger and the same drink', askEn: 'one burger', twoEs: 'Dos hamburguesas y una bebida', oneEs: 'Una hamburguesa y la misma bebida', askEs: 'una hamburguesa', otherEn: 'drink', otherEs: 'bebida' },
      { twoEn: 'Two notebooks and a pen', oneEn: 'One notebook and the same pen', askEn: 'one notebook', twoEs: 'Dos cuadernos y un bolígrafo', oneEs: 'Un cuaderno y el mismo bolígrafo', askEs: 'un cuaderno', otherEn: 'pen', otherEs: 'bolígrafo' },
      { twoEn: 'Two smoothies and a muffin', oneEn: 'One smoothie and the same muffin', askEn: 'one smoothie', twoEs: 'Dos batidos y un panecillo', oneEs: 'Un batido y el mismo panecillo', askEs: 'un batido', otherEn: 'muffin', otherEs: 'panecillo' },
    ] as const);
    const b = ri(rng, 3, 8);
    const d = ri(rng, 1, b - 2);
    const t2 = b + d;
    const t1 = 2 * b + d;
    return {
      promptEn: `${item.twoEn} cost ${usd(t1)}. ${item.oneEn} cost ${usd(t2)}. What is the cost of **${item.askEn}**?`,
      promptEs: `${item.twoEs} cuestan ${usd(t1)}. ${item.oneEs} cuestan ${usd(t2)}. ¿Cuánto cuesta **${item.askEs}**?`,
      ...withChoices(rng, `$${b}` as Choice, [`$${d}`, `$${b - 1}`, `$${t2}`]),
      explanationEn: `Write the system: $2b + d = ${t1}$ and $b + d = ${t2}$. Subtract the second equation from the first: $b = ${b}$. (Then the ${item.otherEn} is $${t2} - ${b} = ${d}$ — that is the trap answer.)`,
      explanationEs: `Escribe el sistema: $2b + d = ${t1}$ y $b + d = ${t2}$. Resta la segunda ecuación de la primera: $b = ${b}$. (Entonces el/la ${item.otherEs} cuesta $${t2} - ${b} = ${d}$ — esa es la respuesta trampa.)`,
    };
  },
  // q4: how many solutions
  (rng) => {
    const scenario = pick(rng, ['none', 'one', 'infinite'] as const);
    const m = nz(rng, -4, 4);
    const b1 = nz(rng, -8, 8);
    let secondEn: string;
    let explainEn: string;
    let explainEs: string;
    let correct: 0 | 1 | 3;
    if (scenario === 'none') {
      let b2 = nz(rng, -8, 8);
      while (b2 === b1) b2 = nz(rng, -8, 8);
      secondEn = `$y = ${coeff(m, 'x')} ${sgn(b2)}$`;
      correct = 0;
      explainEn = `Both lines have slope ${m} but **different** $y$-intercepts (${b1} and ${b2}), so they are parallel lines that never intersect. No intersection point means **no solution**.`;
      explainEs = `Ambas rectas tienen pendiente ${m} pero interceptos en $y$ **diferentes** (${b1} y ${b2}), así que son rectas paralelas que nunca se cruzan. Sin punto de intersección, **no hay solución**.`;
    } else if (scenario === 'one') {
      let m2 = nz(rng, -4, 4);
      while (m2 === m) m2 = nz(rng, -4, 4);
      const b2 = nz(rng, -8, 8);
      secondEn = `$y = ${coeff(m2, 'x')} ${sgn(b2)}$`;
      correct = 1;
      explainEn = `The slopes are **different** (${m} and ${m2}), so the lines cross at exactly one point — **exactly one** solution.`;
      explainEs = `Las pendientes son **diferentes** (${m} y ${m2}), así que las rectas se cruzan en exactamente un punto — **exactamente una** solución.`;
    } else {
      secondEn = `$2y = ${coeff(2 * m, 'x')} ${sgn(2 * b1)}$`;
      correct = 3;
      explainEn = `Divide the second equation by 2 — it becomes $y = ${coeff(m, 'x')} ${sgn(b1)}$, the **same line** as the first. Every point on the line works: **infinitely many** solutions.`;
      explainEs = `Divide la segunda ecuación entre 2 — se convierte en $y = ${coeff(m, 'x')} ${sgn(b1)}$, la **misma recta** que la primera. Todo punto de la recta funciona: **infinitas** soluciones.`;
    }
    return {
      promptEn: `How many solutions does the system $y = ${coeff(m, 'x')} ${sgn(b1)}$ and ${secondEn} have?`,
      promptEs: `¿Cuántas soluciones tiene el sistema $y = ${coeff(m, 'x')} ${sgn(b1)}$ y ${secondEn}?`,
      choicesEn: ['none', 'exactly one', 'exactly two', 'infinitely many'],
      choicesEs: ['ninguna', 'exactamente una', 'exactamente dos', 'infinitas'],
      correctIndex: correct,
      explanationEn: explainEn,
      explanationEs: explainEs,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: polynomials                                                  */
/* ------------------------------------------------------------------ */

const polynomials: SlotGenerator[] = [
  // q1: add/subtract two trinomials
  (rng) => {
    const a1 = nz(rng, -4, 4), b1 = nz(rng, -6, 6), c1 = nz(rng, -8, 8);
    const a2 = nz(rng, -4, 4), b2 = nz(rng, -6, 6), c2 = nz(rng, -8, 8);
    const sub = rng() < 0.5;
    const A = sub ? a1 - a2 : a1 + a2;
    const B = sub ? b1 - b2 : b1 + b2;
    const C = sub ? c1 - c2 : c1 + c2;
    if (A === 0 || B === 0 || C === 0) throw new Error('degenerate sum'); // outer loop redraws
    const p1 = quad(a1, b1, c1);
    const p2 = quad(a2, b2, c2);
    const wrongOp = sub ? quad(a1 + a2, b1 + b2, c1 + c2) : quad(a1 - a2, b1 - b2, c1 - c2);
    return {
      promptEn: `What is the ${sub ? 'difference' : 'sum'} $(${p1}) ${sub ? '-' : '+'} (${p2})$?`,
      promptEs: `¿Cuál es la ${sub ? 'diferencia' : 'suma'} $(${p1}) ${sub ? '-' : '+'} (${p2})$?`,
      ...withChoices(rng, `$${quad(A, B, C)}$`, [
        `$${wrongOp}$`,
        `$${quad(A, -B, C)}$`,
        `$${quad(A, B, -C)}$`,
      ]),
      explanationEn: `${sub ? 'Subtracting flips the sign of EVERY term in the second polynomial. Then combine' : 'Combine'} **like terms** by degree: $x^2$ terms give ${A}, $x$ terms give ${B}, constants give ${C}. Result: $${quad(A, B, C)}$.`,
      explanationEs: `${sub ? 'Restar cambia el signo de TODOS los términos del segundo polinomio. Luego combina' : 'Combina'} **términos semejantes** por grado: los términos $x^2$ dan ${A}, los términos $x$ dan ${B}, las constantes dan ${C}. Resultado: $${quad(A, B, C)}$.`,
      anim: { skillSlug: 'polynomial-operations', params: { a1, b1, c1, a2, b2, c2, sub } },
    };
  },
  // q2: FOIL (x + p)(x + q)
  (rng) => {
    const p = nz(rng, -8, 8);
    const q = nz(rng, -8, 8);
    const B = p + q;
    const C = p * q;
    if (B === 0 || C === B || C === -B) throw new Error('degenerate FOIL');
    return {
      promptEn: `Which expression is equivalent to $(x ${sgn(p)})(x ${sgn(q)})$?`,
      promptEs: `¿Qué expresión es equivalente a $(x ${sgn(p)})(x ${sgn(q)})$?`,
      ...withChoices(rng, `$${quad(1, B, C)}$`, [
        `$${quad(1, 0, C)}$`,
        `$${quad(1, -B, C)}$`,
        `$${quad(1, C, B)}$`,
      ]),
      explanationEn: `Use FOIL (double distribution): $x \\cdot x ${sgn(q)}x ${sgn(p)}x ${sgn(C)} = ${quad(1, B, C)}$. Forgetting the middle terms gives $${quad(1, 0, C)}$, the trap answer.`,
      explanationEs: `Usa doble distribución (FOIL): $x \\cdot x ${sgn(q)}x ${sgn(p)}x ${sgn(C)} = ${quad(1, B, C)}$. Olvidar los términos del medio da $${quad(1, 0, C)}$, la respuesta trampa.`,
    };
  },
  // q3: square a binomial (ax ± b)²
  (rng) => {
    const a = pick(rng, [2, 3]);
    const b = ri(rng, 1, 5);
    const s = pick(rng, [1, -1]);
    const A = a * a;
    const M = 2 * a * b * s;
    const K = b * b;
    return {
      promptEn: `Which expression is equivalent to $(${a}x ${sgn(s * b)})^2$?`,
      promptEs: `¿Qué expresión es equivalente a $(${a}x ${sgn(s * b)})^2$?`,
      ...withChoices(rng, `$${quad(A, M, K)}$`, [
        `$${quad(A, 0, K)}$`,
        `$${quad(A, 0, -K)}$`,
        `$${quad(A, a * b * s, K)}$`,
      ]),
      explanationEn: `Squaring a binomial means multiplying it by itself: $(${a}x ${sgn(s * b)})(${a}x ${sgn(s * b)}) = ${quad(A, M, K)}$. Squaring each term separately ($${quad(A, 0, K)}$) skips the middle term $${coeff(M, 'x')}$.`,
      explanationEs: `Elevar un binomio al cuadrado significa multiplicarlo por sí mismo: $(${a}x ${sgn(s * b)})(${a}x ${sgn(s * b)}) = ${quad(A, M, K)}$. Elevar cada término por separado ($${quad(A, 0, K)}$) omite el término del medio $${coeff(M, 'x')}$.`,
    };
  },
  // q4: divide a binomial by a monomial
  (rng) => {
    const k = ri(rng, 2, 4);
    const q1 = ri(rng, 2, 5);
    const q2 = ri(rng, 1, Math.min(6, Math.floor(20 / k)));
    const M = k * q1;
    const N = k * q2;
    return {
      promptEn: `What is the quotient of $\\frac{${M}x^3 + ${N}x^2}{${k}x}$, where $x \\ne 0$?`,
      promptEs: `¿Cuál es el cociente de $\\frac{${M}x^3 + ${N}x^2}{${k}x}$, donde $x \\ne 0$?`,
      ...withChoices(rng, `$${q1}x^2 + ${coeff(q2, 'x')}$`, [
        `$${q1}x^2 + ${N}x$`,
        `$${M}x^2 + ${coeff(N, 'x')}$`,
        `$${coeff(q1, 'x')} ${sgn(q2)}$`,
      ]),
      explanationEn: `Divide **each term** by $${k}x$: $\\frac{${M}x^3}{${k}x} = ${q1}x^2$ and $\\frac{${N}x^2}{${k}x} = ${coeff(q2, 'x')}$. So the quotient is $${q1}x^2 + ${coeff(q2, 'x')}$ (divide the coefficients, subtract the exponents).`,
      explanationEs: `Divide **cada término** entre $${k}x$: $\\frac{${M}x^3}{${k}x} = ${q1}x^2$ y $\\frac{${N}x^2}{${k}x} = ${coeff(q2, 'x')}$. El cociente es $${q1}x^2 + ${coeff(q2, 'x')}$ (divide los coeficientes, resta los exponentes).`,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: factoring                                                    */
/* ------------------------------------------------------------------ */

const factoring: SlotGenerator[] = [
  // q1: factor x² + Bx + C
  (rng) => {
    const p = ri(rng, 2, 4);
    const q = ri(rng, p + 1, Math.min(9, Math.floor(20 / p)));
    const B = p + q;
    const C = p * q;
    return {
      promptEn: `Which is the factored form of $${quad(1, B, C)}$?`,
      promptEs: `¿Cuál es la forma factorizada de $${quad(1, B, C)}$?`,
      ...withChoices(rng, `$(x + ${p})(x + ${q})$`, [
        `$(x + 1)(x + ${C})$`,
        `$(x - ${p})(x - ${q})$`,
        `$(x - 1)(x - ${C})$`,
      ]),
      explanationEn: `Find two numbers that **multiply to ${C}** and **add to ${B}**: $${p} \\cdot ${q} = ${C}$ and $${p} + ${q} = ${B}$. So $${quad(1, B, C)} = (x + ${p})(x + ${q})$. ($1 + ${C} = ${1 + C}$ has the right product but the wrong sum.)`,
      explanationEs: `Busca dos números que **multiplicados den ${C}** y **sumados den ${B}**: $${p} \\cdot ${q} = ${C}$ y $${p} + ${q} = ${B}$. Así $${quad(1, B, C)} = (x + ${p})(x + ${q})$. ($1 + ${C} = ${1 + C}$ tiene el producto correcto pero la suma incorrecta.)`,
    };
  },
  // q2: difference of two squares
  (rng) => {
    const k = ri(rng, 2, 9);
    return {
      promptEn: `Which is the factored form of $x^2 - ${k * k}$?`,
      promptEs: `¿Cuál es la forma factorizada de $x^2 - ${k * k}$?`,
      ...withChoices(rng, `$(x + ${k})(x - ${k})$`, [
        `$(x - ${k})^2$`,
        `$(x + ${k})^2$`,
        { en: 'It cannot be factored', es: 'No se puede factorizar' },
      ]),
      explanationEn: `This is a **difference of two squares**: $a^2 - b^2 = (a + b)(a - b)$. Here $a = x$, $b = ${k}$, so $x^2 - ${k * k} = (x + ${k})(x - ${k})$. Note $(x - ${k})^2 = ${quad(1, -2 * k, k * k)}$, which has a middle term.`,
      explanationEs: `Esta es una **diferencia de cuadrados**: $a^2 - b^2 = (a + b)(a - b)$. Aquí $a = x$, $b = ${k}$, así que $x^2 - ${k * k} = (x + ${k})(x - ${k})$. Nota que $(x - ${k})^2 = ${quad(1, -2 * k, k * k)}$, que tiene término del medio.`,
    };
  },
  // q3: factor out the GCF of Mx³ + Nx²
  (rng) => {
    const g = ri(rng, 2, 5);
    const r1 = ri(rng, 2, Math.min(5, Math.floor(20 / g)));
    let r2 = ri(rng, 1, Math.min(5, Math.floor(20 / g)));
    while (r2 === r1 || gcd(r1, r2) !== 1) r2 = ri(rng, 1, 5); // g really is the GCF
    const M = g * r1;
    const N = g * r2;
    if (N > 20) throw new Error('coefficient too large');
    return {
      promptEn: `What is $${M}x^3 + ${N}x^2$ with its **greatest common factor** factored out?`,
      promptEs: `¿Cómo queda $${M}x^3 + ${N}x^2$ al sacar su **máximo factor común**?`,
      ...withChoices(rng, `$${g}x^2(${r1}x + ${r2})$`, [
        `$${g}x(${r1}x^2 + ${coeff(r2, 'x')})$`,
        `$x^2(${M}x + ${N})$`,
        `$x(${M}x^2 + ${coeff(N, 'x')})$`,
      ]),
      explanationEn: `The GCF of ${M} and ${N} is **${g}**; the GCF of $x^3$ and $x^2$ is $x^2$. Pull out $${g}x^2$: $${M}x^3 + ${N}x^2 = ${g}x^2(${r1}x + ${r2})$. The other choices factor something out, but not the *greatest* common factor.`,
      explanationEs: `El MCD de ${M} y ${N} es **${g}**; el MCD de $x^3$ y $x^2$ es $x^2$. Saca $${g}x^2$: $${M}x^3 + ${N}x^2 = ${g}x^2(${r1}x + ${r2})$. Las otras opciones sacan un factor, pero no el factor común *máximo*.`,
    };
  },
  // q4: factor completely k(x² − m²)
  (rng) => {
    const [k, m] = pick(rng, [
      [2, 2],
      [2, 3],
      [3, 2],
    ] as const); // k·m² stays ≤ 18
    const C = k * m * m;
    return {
      promptEn: `Which is the **completely** factored form of $${k}x^2 - ${C}$?`,
      promptEs: `¿Cuál es la forma **completamente** factorizada de $${k}x^2 - ${C}$?`,
      ...withChoices(rng, `$${k}(x + ${m})(x - ${m})$`, [
        `$${k}(x^2 - ${m * m})$`,
        `$(${k}x + ${k * m})(x - ${m})$`,
        `$(x + ${k * m})(x - ${m})$`,
      ]),
      explanationEn: `First factor out the GCF: $${k}(x^2 - ${m * m})$. But $x^2 - ${m * m}$ is a difference of squares, so keep going: $${k}(x + ${m})(x - ${m})$. "Completely factored" means **no factor can be factored further**.`,
      explanationEs: `Primero saca el MCD: $${k}(x^2 - ${m * m})$. Pero $x^2 - ${m * m}$ es una diferencia de cuadrados, así que continúa: $${k}(x + ${m})(x - ${m})$. "Completamente factorizado" significa que **ningún factor se puede factorizar más**.`,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: quadratics                                                   */
/* ------------------------------------------------------------------ */

const quadratics: SlotGenerator[] = [
  // q1: roots by factoring x² − Bx + C = 0
  (rng) => {
    const p = ri(rng, 2, 4);
    const q = ri(rng, p + 1, Math.min(8, Math.floor(20 / p)));
    const B = p + q;
    const C = p * q;
    const roots = (u: number, v: number): Choice => ({
      en: `$x = ${u}$ and $x = ${v}$`,
      es: `$x = ${u}$ y $x = ${v}$`,
    });
    return {
      promptEn: `What are the roots of $${quad(1, -B, C)} = 0$?`,
      promptEs: `¿Cuáles son las raíces de $${quad(1, -B, C)} = 0$?`,
      ...withChoices(rng, roots(p, q), [roots(-p, -q), roots(1, C), roots(-1, -C)]),
      explanationEn: `Factor: two numbers that multiply to $+${C}$ and add to $-${B}$ are $-${p}$ and $-${q}$, so $(x - ${p})(x - ${q}) = 0$. The zero-product property gives $x = ${p}$ or $x = ${q}$ (the roots have the **opposite** sign of the factors).`,
      explanationEs: `Factoriza: dos números que multiplicados den $+${C}$ y sumados den $-${B}$ son $-${p}$ y $-${q}$, así que $(x - ${p})(x - ${q}) = 0$. La propiedad del producto cero da $x = ${p}$ o $x = ${q}$ (las raíces tienen el signo **opuesto** al de los factores).`,
    };
  },
  // q2: solution set of x² = k²
  (rng) => {
    const k = ri(rng, 3, 9);
    return {
      promptEn: `What is the solution set of $x^2 = ${k * k}$?`,
      promptEs: `¿Cuál es el conjunto solución de $x^2 = ${k * k}$?`,
      ...withChoices(rng, `$\\{-${k}, ${k}\\}$`, [
        `$\\{${k}\\}$`,
        `$\\{-${k}\\}$`,
        `$\\{${fmt((k * k) / 2)}\\}$`,
      ]),
      explanationEn: `Take the square root of **both** sides — and remember a positive number has **two** square roots: $x = \\pm\\sqrt{${k * k}} = \\pm ${k}$. Both work: $${k}^2 = ${k * k}$ and $(-${k})^2 = ${k * k}$.`,
      explanationEs: `Saca la raíz cuadrada de **ambos** lados — y recuerda que un número positivo tiene **dos** raíces cuadradas: $x = \\pm\\sqrt{${k * k}} = \\pm ${k}$. Ambas funcionan: $${k}^2 = ${k * k}$ y $(-${k})^2 = ${k * k}$.`,
    };
  },
  // q3: axis of symmetry of y = x² − 2hx + C
  (rng) => {
    const h = nz(rng, -6, 6);
    const C = ri(rng, 1, 12);
    const b = -2 * h;
    return {
      promptEn: `What is the equation of the **axis of symmetry** of the parabola $y = ${quad(1, b, C)}$?`,
      promptEs: `¿Cuál es la ecuación del **eje de simetría** de la parábola $y = ${quad(1, b, C)}$?`,
      ...withChoices(rng, `$x = ${h}$`, [`$x = ${-h}$`, `$x = ${2 * h}$`, `$x = ${-2 * h}$`]),
      explanationEn: `The axis of symmetry is $x = \\frac{-b}{2a}$. Here $a = 1$ and $b = ${b}$: $x = \\frac{${-b}}{2(1)} = ${h}$. Watch the signs — dropping the negative in the formula gives $x = ${-h}$.`,
      explanationEs: `El eje de simetría es $x = \\frac{-b}{2a}$. Aquí $a = 1$ y $b = ${b}$: $x = \\frac{${-b}}{2(1)} = ${h}$. Cuidado con los signos — omitir el negativo de la fórmula da $x = ${-h}$.`,
    };
  },
  // q4: vertex from vertex form
  (rng) => {
    const h = nz(rng, -8, 8);
    const k = nz(rng, -9, 9);
    return {
      promptEn: `What is the **vertex** of the parabola $y = (x ${sgn(-h)})^2 ${sgn(k)}$?`,
      promptEs: `¿Cuál es el **vértice** de la parábola $y = (x ${sgn(-h)})^2 ${sgn(k)}$?`,
      ...withChoices(rng, pt(h, k), [pt(-h, k), pt(h, -k), pt(-h, -k)]),
      explanationEn: `Vertex form is $y = (x - h)^2 + k$ with vertex $(h, k)$. Matching $(x ${sgn(-h)})^2 ${sgn(k)}$ gives $h = ${h}$ (note: **opposite** sign of what appears inside) and $k = ${k}$, so the vertex is $(${h}, ${k})$.`,
      explanationEs: `La forma de vértice es $y = (x - h)^2 + k$ con vértice $(h, k)$. Comparando con $(x ${sgn(-h)})^2 ${sgn(k)}$, $h = ${h}$ (nota: signo **opuesto** al que aparece adentro) y $k = ${k}$, así que el vértice es $(${h}, ${k})$.`,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: exponential-functions                                        */
/* ------------------------------------------------------------------ */

const exponentialFunctions: SlotGenerator[] = [
  // q1: interpret the growth factor
  (rng) => {
    const a = pick(rng, [200, 300, 500, 800, 1000]);
    const r = ri(rng, 2, 9);
    const thing = pick(rng, [
      { en: 'The value of a collectible', es: 'El valor de un objeto de colección' },
      { en: 'The value of a rare trading card', es: 'El valor de una carta coleccionable rara' },
      { en: 'The balance of a savings account', es: 'El saldo de una cuenta de ahorros' },
    ] as const);
    return {
      promptEn: `${thing.en} is modeled by $A(t) = ${a}(1.0${r})^t$, where $t$ is in years. What does $1.0${r}$ represent?`,
      promptEs: `${thing.es} se modela con $A(t) = ${a}(1.0${r})^t$, donde $t$ está en años. ¿Qué representa $1.0${r}$?`,
      ...withChoices(
        rng,
        { en: `The value grows by ${r}% each year`, es: `El valor crece ${r}% cada año` },
        [
          { en: `The value decays by ${r}% each year`, es: `El valor decae ${r}% cada año` },
          { en: `The value grows by ${100 + r}% each year`, es: `El valor crece ${100 + r}% cada año` },
          { en: `The starting value is $1.0${r}`, es: `El valor inicial es $1.0${r}` },
        ],
      ),
      explanationEn: `In $A(t) = a(b)^t$, $b$ is the **growth factor**: $b = 1 + r$. Here $1.0${r} = 1 + 0.0${r}$, so the rate is ${r}% growth per year. The starting value is $a = ${a}$.`,
      explanationEs: `En $A(t) = a(b)^t$, $b$ es el **factor de crecimiento**: $b = 1 + r$. Aquí $1.0${r} = 1 + 0.0${r}$, así que la tasa es ${r}% de crecimiento anual. El valor inicial es $a = ${a}$.`,
    };
  },
  // q2: which function is decay
  (rng) => {
    const a1 = pick(rng, [50, 100, 200, 400]);
    const d = pick(rng, ['0.9', '0.8', '0.75', '0.85']);
    const a2 = pick(rng, [50, 100, 200]);
    const grow = ri(rng, 2, 4);
    const bigBase = `1.${ri(rng, 1, 9)}`;
    const smallBase = `1.0${ri(rng, 1, 9)}`;
    return {
      promptEn: 'Which function represents exponential **decay**?',
      promptEs: '¿Qué función representa **decaimiento** exponencial?',
      ...withChoices(rng, `$y = ${a1}(${d})^x$`, [
        `$y = 0.5(${grow})^x$`,
        `$y = ${a2}(${bigBase})^x$`,
        `$y = ${ri(rng, 2, 9)}(${smallBase})^x$`,
      ]),
      explanationEn: `Look at the **base** (growth factor), not the front coefficient. Decay means the base is between 0 and 1: only $${d} < 1$ qualifies. $y = 0.5(${grow})^x$ starts small but **grows**, because its base is ${grow}.`,
      explanationEs: `Mira la **base** (factor de crecimiento), no el coeficiente del frente. Decaimiento significa que la base está entre 0 y 1: solo $${d} < 1$ cumple. $y = 0.5(${grow})^x$ empieza pequeña pero **crece**, porque su base es ${grow}.`,
    };
  },
  // q3: evaluate f(n) = b^n
  (rng) => {
    const [b, n] = pick(rng, [
      [2, 3],
      [2, 5],
      [2, 6],
      [3, 2],
      [3, 4],
    ] as const); // pairs where b^n, b·n, n^b, b^(n−1) are all distinct
    return {
      promptEn: `If $f(x) = ${b}^x$, what is $f(${n})$?`,
      promptEs: `Si $f(x) = ${b}^x$, ¿cuál es $f(${n})$?`,
      ...withChoices(rng, `$${b ** n}$`, [`$${b * n}$`, `$${n ** b}$`, `$${b ** (n - 1)}$`]),
      explanationEn: `$f(${n}) = ${b}^{${n}} = ${Array(n).fill(b).join(' \\cdot ')} = ${b ** n}$. The exponent counts how many times to multiply the base by itself — it is **not** $${b} \\times ${n} = ${b * n}$.`,
      explanationEs: `$f(${n}) = ${b}^{${n}} = ${Array(n).fill(b).join(' \\cdot ')} = ${b ** n}$. El exponente indica cuántas veces multiplicar la base por sí misma — **no** es $${b} \\times ${n} = ${b * n}$.`,
    };
  },
  // q4: write the growth model
  (rng) => {
    const a = pick(rng, [200, 300, 400, 500]);
    const r = pick(rng, [3, 4, 5, 6, 8]);
    return {
      promptEn: `${usd(a)} is invested in an account that grows ${r}% per year. Which equation models the value $y$ after $t$ years?`,
      promptEs: `Se invierten ${usd(a)} en una cuenta que crece ${r}% al año. ¿Qué ecuación modela el valor $y$ después de $t$ años?`,
      ...withChoices(rng, `$y = ${a}(1.0${r})^t$`, [
        `$y = ${a}(1.${r})^t$`,
        `$y = ${a}(0.0${r})^t$`,
        `$y = ${a} + 1.0${r}t$`,
      ]),
      explanationEn: `Growth of ${r}% means the factor is $1 + 0.0${r} = 1.0${r}$: $y = ${a}(1.0${r})^t$. $1.${r}$ would be ${10 * r}% growth, $0.0${r}$ would shrink the value almost to zero, and $${a} + 1.0${r}t$ is linear, not exponential.`,
      explanationEs: `Un crecimiento de ${r}% significa que el factor es $1 + 0.0${r} = 1.0${r}$: $y = ${a}(1.0${r})^t$. $1.${r}$ sería ${10 * r}% de crecimiento, $0.0${r}$ reduciría el valor casi a cero, y $${a} + 1.0${r}t$ es lineal, no exponencial.`,
    };
  },
];

/* ------------------------------------------------------------------ */
/* Topic: statistics                                                   */
/* ------------------------------------------------------------------ */

const statistics: SlotGenerator[] = [
  // q1: mean of five values (constructed from the mean, so it's clean)
  (rng) => {
    const m = ri(rng, 4, 9);
    let vals: number[];
    let v5: number;
    do {
      vals = [0, 0, 0, 0].map(() => ri(rng, m - 3, m + 3));
      v5 = 5 * m - vals.reduce((s, v) => s + v, 0);
    } while (v5 < 1 || v5 > 20);
    vals.push(v5);
    for (let i = vals.length - 1; i > 0; i--) {
      const j = ri(rng, 0, i);
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    const list = vals.join(', ');
    return {
      promptEn: `What is the **mean** of the data set $${list}$?`,
      promptEs: `¿Cuál es la **media** del conjunto de datos $${list}$?`,
      ...withChoices(rng, `$${m}$`, [`$${m - 1}$`, `$${m + 1}$`, `$${5 * m}$`]),
      explanationEn: `Mean = sum ÷ count: $\\frac{${vals.join(' + ')}}{5} = \\frac{${5 * m}}{5} = ${m}$. ($${5 * m}$ is just the sum — remember to divide by how many values there are.)`,
      explanationEs: `Media = suma ÷ cantidad: $\\frac{${vals.join(' + ')}}{5} = \\frac{${5 * m}}{5} = ${m}$. ($${5 * m}$ es solo la suma — recuerda dividir entre la cantidad de valores.)`,
    };
  },
  // q2: median of six ordered values
  (rng) => {
    const v3 = ri(rng, 3, 8);
    const v4 = v3 + ri(rng, 1, 3);
    const v1 = ri(rng, 1, v3);
    const v2 = ri(rng, v1, v3);
    const v5 = ri(rng, v4, v4 + 3);
    const v6 = ri(rng, v5, Math.min(20, v5 + 4));
    const med = (v3 + v4) / 2;
    const list = [v1, v2, v3, v4, v5, v6].join(', ');
    return {
      promptEn: `What is the **median** of the data set $${list}$?`,
      promptEs: `¿Cuál es la **mediana** del conjunto de datos $${list}$?`,
      ...withChoices(rng, `$${fmt(med)}$`, [`$${v3}$`, `$${v4}$`, `$${v4 + 2}$`]),
      explanationEn: `The data is already in order, and there is an **even** number of values (6), so the median is the average of the two middle ones: $\\frac{${v3} + ${v4}}{2} = ${fmt(med)}$.`,
      explanationEs: `Los datos ya están en orden y hay una cantidad **par** de valores (6), así que la mediana es el promedio de los dos del medio: $\\frac{${v3} + ${v4}}{2} = ${fmt(med)}$.`,
    };
  },
  // q3: interpret a correlation coefficient
  (rng) => {
    const kind = pick(rng, ['strongPos', 'strongNeg', 'weakPos'] as const);
    const r =
      kind === 'strongPos'
        ? pick(rng, [0.85, 0.9, 0.95])
        : kind === 'strongNeg'
          ? pick(rng, [-0.85, -0.9, -0.95])
          : pick(rng, [0.2, 0.25, 0.3]);
    const ctx =
      kind === 'strongNeg'
        ? { en: 'days absent vs. final grades', es: 'días de ausencia vs. calificaciones finales' }
        : kind === 'strongPos'
          ? { en: 'hours studied vs. test scores', es: 'horas de estudio vs. calificaciones' }
          : { en: 'height vs. quiz scores', es: 'estatura vs. puntajes de pruebas' };
    const correctIndex = kind === 'strongPos' ? 0 : kind === 'weakPos' ? 1 : 2;
    const strength =
      kind === 'weakPos'
        ? { en: `$${r}$ is close to 0, so: weak positive`, es: `$${r}$ está cerca de 0, así que: positiva débil` }
        : { en: `$${r}$ is close to ${r > 0 ? '1' : '-1'}, so: strong ${r > 0 ? 'positive' : 'negative'}`, es: `$${r}$ está cerca de ${r > 0 ? '1' : '-1'}, así que: ${r > 0 ? 'positiva' : 'negativa'} fuerte` };
    return {
      promptEn: `A study of ${ctx.en} has a correlation coefficient of $r = ${r}$. Which best describes the relationship?`,
      promptEs: `Un estudio de ${ctx.es} tiene un coeficiente de correlación $r = ${r}$. ¿Cuál describe mejor la relación?`,
      choicesEn: ['strong positive correlation', 'weak positive correlation', 'strong negative correlation', 'no correlation'],
      choicesEs: ['correlación positiva fuerte', 'correlación positiva débil', 'correlación negativa fuerte', 'sin correlación'],
      correctIndex,
      explanationEn: `$r$ runs from $-1$ to $1$. The **sign** gives the direction and the **closeness to** $\\pm 1$ gives the strength. ${strength.en}.`,
      explanationEs: `$r$ va de $-1$ a $1$. El **signo** da la dirección y la **cercanía a** $\\pm 1$ da la fuerza. ${strength.es}.`,
    };
  },
  // q4: outlier effect on center measures
  (rng) => {
    const big = rng() < 0.5;
    return {
      promptEn: `A very ${big ? 'large' : 'small'} value is added to a data set. Which measure of central tendency is affected the **most**?`,
      promptEs: `Se agrega un valor muy ${big ? 'grande' : 'pequeño'} a un conjunto de datos. ¿Qué medida de tendencia central se ve **más** afectada?`,
      ...withChoices(
        rng,
        { en: 'the mean', es: 'la media' },
        [
          { en: 'the median', es: 'la mediana' },
          { en: 'the mode', es: 'la moda' },
          { en: 'they are all equally affected', es: 'todas se afectan por igual' },
        ],
      ),
      explanationEn: `The **mean** uses every value in its calculation, so one huge outlier drags it ${big ? 'upward' : 'downward'}. The median only depends on the middle position and the mode on the most frequent value — both barely move.`,
      explanationEs: `La **media** usa todos los valores en su cálculo, así que un valor atípico enorme la arrastra hacia ${big ? 'arriba' : 'abajo'}. La mediana solo depende de la posición central y la moda del valor más frecuente — casi no cambian.`,
    };
  },
];

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Slot generators per topic slug — must cover every topic in regents.ts. */
export const regentsSlotGenerators: Record<string, SlotGenerator[]> = {
  'exponents-radicals': exponentsRadicals,
  'linear-equations': linearEquations,
  inequalities,
  'linear-functions': linearFunctions,
  systems,
  polynomials,
  factoring,
  quadratics,
  'exponential-functions': exponentialFunctions,
  statistics,
};

/**
 * Generate one validated multiple-choice question: all four choices must be
 * distinct in both languages, or the generator redraws (the RNG stream
 * continues, so retries stay deterministic for a given seed).
 */
export function generateRegentsQuestion(
  slug: string,
  slot: number,
  seed: number,
): RegentsQuestionContent {
  const gens = regentsSlotGenerators[slug];
  if (!gens) throw new Error(`no regents generators for topic: ${slug}`);
  if (!Number.isInteger(slot) || slot < 1 || slot > REGENTS_ROUND_SIZE) {
    throw new Error(`bad regents slot ${slot} for topic ${slug}`);
  }
  // Slots past the archetype count cycle back through them; the seed already
  // encodes the slot, so repeats of an archetype draw different parameters.
  const gen = gens[(slot - 1) % gens.length];
  const rng = makeRng(seed);
  for (let attempt = 0; attempt < 25; attempt++) {
    let q: RegentsQuestionContent;
    try {
      q = gen(rng);
    } catch {
      continue; // degenerate parameter draw — redraw from the same stream
    }
    if (
      q.correctIndex >= 0 &&
      q.correctIndex < 4 &&
      new Set(q.choicesEn).size === 4 &&
      new Set(q.choicesEs).size === 4
    ) {
      return q;
    }
  }
  throw new Error(`regents generator ${slug} slot ${slot} failed to produce distinct choices`);
}
