/**
 * Data model for animated worked examples ("step animator").
 *
 * A script is a list of steps; each step is the full equation expressed as
 * tokens. Tokens carry stable ids so the player can morph between steps:
 * same id in both steps → the token slides to its new position; new id →
 * it drops in; missing id → it fades out. This is what lets us *show* the
 * arithmetic (terms moving across the equals sign, like terms merging,
 * canceling pairs being struck out) instead of just swapping lines.
 */

export type TokenKind = 'num' | 'var' | 'op' | 'rel' | 'frac';

/** Visual emphasis for a token within one step. */
export type Emph =
  | 'apply' /* the operation being applied to both sides (orange chip) */
  | 'focus' /* terms the student should look at (blue chip) */
  | 'result' /* a freshly computed value (green chip) */
  | 'cancel' /* struck-through gray: this pair adds/divides to nothing */
  | 'flip'; /* red chip: the inequality symbol just flipped — look here! */

export interface EqToken {
  /** Stable identity across steps — drives the morph animation. */
  id: string;
  text: string;
  kind: TokenKind;
  emph?: Emph;
  /** Render flush against the previous token (e.g. the "x" in "2x"). */
  tight?: boolean;
  /** Stacked fraction parts, for kind 'frac'. `text` stays the plain
   * rendering (e.g. "3/4") for history lines and screen readers. */
  num?: string;
  den?: string;
  /** Second-line placement for vertical layouts (polynomial addition).
   * Default 0 = the main line. */
  row?: 0 | 1;
}

export interface EqStep {
  tokens: EqToken[];
  explainEn: string;
  explainEs: string;
  /** Auto-play dwell time for this step in ms (default 2200). Give big
   * moments — a sign flip, a cancellation — a longer beat. */
  holdMs?: number;
}

export interface EqScript {
  id: string;
  titleEn: string;
  titleEs: string;
  steps: EqStep[];
}

const t = (
  id: string,
  text: string,
  kind: TokenKind,
  extra?: Partial<Pick<EqToken, 'emph' | 'tight' | 'row'>>,
): EqToken => ({ id, text, kind, ...extra });

/** Stacked-fraction token. Multi-term parts get parenthesized in the
 * plain-text fallback so "8 − 2/5 − 1" can't be misread. */
const f = (
  id: string,
  num: string,
  den: string,
  extra?: Partial<Pick<EqToken, 'emph' | 'tight'>>,
): EqToken => {
  const wrap = (s: string) => (s.includes(' ') ? `(${s})` : s);
  return { id, text: `${wrap(num)}/${wrap(den)}`, kind: 'frac', num, den, ...extra };
};

/** Two-step equation: 2x + 3 = 11 (Unit 2 style). */
export const twoStepScript: EqScript = {
  id: 'two-step',
  titleEn: 'Solve a two-step equation',
  titleEs: 'Resuelve una ecuación de dos pasos',
  steps: [
    {
      tokens: [
        t('c2', '2', 'num'),
        t('x', 'x', 'var', { tight: true }),
        t('plus', '+', 'op'),
        t('n3', '3', 'num'),
        t('eq', '=', 'rel'),
        t('n11', '11', 'num'),
      ],
      explainEn: 'We want x alone. First, undo the + 3.',
      explainEs: 'Queremos x sola. Primero, deshaz el + 3.',
    },
    {
      tokens: [
        t('c2', '2', 'num'),
        t('x', 'x', 'var', { tight: true }),
        t('plus', '+', 'op'),
        t('n3', '3', 'num'),
        t('m3L', '− 3', 'op', { emph: 'apply' }),
        t('eq', '=', 'rel'),
        t('n11', '11', 'num'),
        t('m3R', '− 3', 'op', { emph: 'apply' }),
      ],
      explainEn: 'Subtract 3 from BOTH sides to keep the balance.',
      explainEs: 'Resta 3 de AMBOS lados para mantener el equilibrio.',
    },
    {
      tokens: [
        t('c2', '2', 'num'),
        t('x', 'x', 'var', { tight: true }),
        t('plus', '+ 3', 'op', { emph: 'cancel' }),
        t('m3L', '− 3', 'op', { emph: 'cancel' }),
        t('eq', '=', 'rel'),
        t('n11', '11', 'num', { emph: 'focus' }),
        t('m3R', '− 3', 'op', { emph: 'focus' }),
      ],
      explainEn: '+ 3 and − 3 cancel — they add to zero.',
      explainEs: '+ 3 y − 3 se cancelan — suman cero.',
      holdMs: 3000,
    },
    {
      tokens: [
        t('c2', '2', 'num'),
        t('x', 'x', 'var', { tight: true }),
        t('eq', '=', 'rel'),
        t('n8', '8', 'num', { emph: 'result' }),
      ],
      explainEn: 'The left side is just 2x, and 11 − 3 = 8.',
      explainEs: 'El lado izquierdo queda 2x, y 11 − 3 = 8.',
    },
    {
      tokens: [
        t('c2', '2', 'num'),
        t('x', 'x', 'var', { tight: true }),
        t('d2L', '÷ 2', 'op', { emph: 'apply' }),
        t('eq', '=', 'rel'),
        t('n8', '8', 'num'),
        t('d2R', '÷ 2', 'op', { emph: 'apply' }),
      ],
      explainEn: 'x is multiplied by 2, so divide BOTH sides by 2.',
      explainEs: 'x está multiplicada por 2, así que divide AMBOS lados entre 2.',
    },
    {
      tokens: [
        t('x', 'x', 'var'),
        t('eq', '=', 'rel'),
        t('n4', '4', 'num', { emph: 'result' }),
      ],
      explainEn: '2 ÷ 2 = 1, so x is alone. 8 ÷ 2 = 4. Done!',
      explainEs: '2 ÷ 2 = 1, así que x queda sola. 8 ÷ 2 = 4. ¡Listo!',
    },
  ],
};

/** Combining like terms: 3x + 2x = 15 (Unit 1 style). */
export const likeTermsScript: EqScript = {
  id: 'like-terms',
  titleEn: 'Combine like terms',
  titleEs: 'Combina términos semejantes',
  steps: [
    {
      tokens: [
        t('a', '3x', 'var'),
        t('plus', '+', 'op'),
        t('b', '2x', 'var'),
        t('eq', '=', 'rel'),
        t('n15', '15', 'num'),
      ],
      explainEn: 'Two x-terms on the same side. Can we tidy this up?',
      explainEs: 'Dos términos con x en el mismo lado. ¿Podemos ordenarlo?',
    },
    {
      tokens: [
        t('a', '3x', 'var', { emph: 'focus' }),
        t('plus', '+', 'op'),
        t('b', '2x', 'var', { emph: 'focus' }),
        t('eq', '=', 'rel'),
        t('n15', '15', 'num'),
      ],
      explainEn: '3x and 2x are LIKE terms — same variable, so they combine.',
      explainEs: '3x y 2x son términos SEMEJANTES — misma variable, se combinan.',
    },
    {
      tokens: [
        t('m', '5x', 'var', { emph: 'result' }),
        t('eq', '=', 'rel'),
        t('n15', '15', 'num'),
      ],
      explainEn: '3x + 2x = 5x. Three x’s plus two x’s is five x’s.',
      explainEs: '3x + 2x = 5x. Tres x más dos x son cinco x.',
    },
    {
      tokens: [
        t('m', '5x', 'var'),
        t('d5L', '÷ 5', 'op', { emph: 'apply' }),
        t('eq', '=', 'rel'),
        t('n15', '15', 'num'),
        t('d5R', '÷ 5', 'op', { emph: 'apply' }),
      ],
      explainEn: 'Divide BOTH sides by 5 to get x alone.',
      explainEs: 'Divide AMBOS lados entre 5 para dejar x sola.',
    },
    {
      tokens: [
        t('x', 'x', 'var'),
        t('eq', '=', 'rel'),
        t('n3', '3', 'num', { emph: 'result' }),
      ],
      explainEn: '5x ÷ 5 = x, and 15 ÷ 5 = 3. So x = 3!',
      explainEs: '5x ÷ 5 = x, y 15 ÷ 5 = 3. ¡Así que x = 3!',
    },
  ],
};

/** Distributive property: 2(x + 3) = 10 (Unit 3, multi-step). */
export const distributeScript: EqScript = {
  id: 'distribute',
  titleEn: 'Distribute, then solve',
  titleEs: 'Distribuye y resuelve',
  steps: [
    {
      tokens: [
        t('c2', '2', 'num'),
        t('lp', '(', 'op', { tight: true }),
        t('x', 'x', 'var', { tight: true }),
        t('plus', '+', 'op'),
        t('n3', '3', 'num'),
        t('rp', ')', 'op', { tight: true }),
        t('eq', '=', 'rel'),
        t('n10', '10', 'num'),
      ],
      explainEn: 'The 2 outside multiplies EVERYTHING inside the parentheses.',
      explainEs: 'El 2 de afuera multiplica TODO lo que está dentro del paréntesis.',
    },
    {
      tokens: [
        t('c2', '2', 'num', { emph: 'focus' }),
        t('lp', '(', 'op', { tight: true }),
        t('x', 'x', 'var', { emph: 'focus', tight: true }),
        t('plus', '+', 'op'),
        t('n3', '3', 'num', { emph: 'focus' }),
        t('rp', ')', 'op', { tight: true }),
        t('eq', '=', 'rel'),
        t('n10', '10', 'num'),
      ],
      explainEn: 'Distribute: 2 · x and 2 · 3.',
      explainEs: 'Distribuye: 2 · x y 2 · 3.',
    },
    {
      tokens: [
        t('t2x', '2x', 'var', { emph: 'result' }),
        t('plus', '+', 'op'),
        t('n6', '6', 'num', { emph: 'result' }),
        t('eq', '=', 'rel'),
        t('n10', '10', 'num'),
      ],
      explainEn: '2 · x = 2x and 2 · 3 = 6. The parentheses are gone!',
      explainEs: '2 · x = 2x y 2 · 3 = 6. ¡Ya no hay paréntesis!',
    },
    {
      tokens: [
        t('t2x', '2x', 'var'),
        t('plus', '+', 'op'),
        t('n6', '6', 'num'),
        t('m6L', '− 6', 'op', { emph: 'apply' }),
        t('eq', '=', 'rel'),
        t('n10', '10', 'num'),
        t('m6R', '− 6', 'op', { emph: 'apply' }),
      ],
      explainEn: 'Now it looks familiar: subtract 6 from BOTH sides.',
      explainEs: 'Ahora es conocido: resta 6 de AMBOS lados.',
    },
    {
      tokens: [
        t('t2x', '2x', 'var'),
        t('eq', '=', 'rel'),
        t('n4', '4', 'num', { emph: 'result' }),
      ],
      explainEn: '+ 6 − 6 cancels, and 10 − 6 = 4.',
      explainEs: '+ 6 − 6 se cancela, y 10 − 6 = 4.',
    },
    {
      tokens: [
        t('t2x', '2x', 'var'),
        t('d2L', '÷ 2', 'op', { emph: 'apply' }),
        t('eq', '=', 'rel'),
        t('n4', '4', 'num'),
        t('d2R', '÷ 2', 'op', { emph: 'apply' }),
      ],
      explainEn: 'Divide BOTH sides by 2.',
      explainEs: 'Divide AMBOS lados entre 2.',
    },
    {
      tokens: [
        t('x', 'x', 'var'),
        t('eq', '=', 'rel'),
        t('n2f', '2', 'num', { emph: 'result' }),
      ],
      explainEn: '2x ÷ 2 = x, and 4 ÷ 2 = 2. So x = 2!',
      explainEs: '2x ÷ 2 = x, y 4 ÷ 2 = 2. ¡Así que x = 2!',
    },
  ],
};

/** Variables on both sides: 5x − 2 = 3x + 6 (Unit 3). */
export const bothSidesScript: EqScript = {
  id: 'both-sides',
  titleEn: 'Variables on both sides',
  titleEs: 'Variables en ambos lados',
  steps: [
    {
      tokens: [
        t('a', '5x', 'var'),
        t('minus', '−', 'op'),
        t('n2', '2', 'num'),
        t('eq', '=', 'rel'),
        t('b', '3x', 'var'),
        t('plus', '+', 'op'),
        t('n6', '6', 'num'),
      ],
      explainEn: 'x appears on BOTH sides. Gather the x-terms on one side first.',
      explainEs: 'La x aparece en AMBOS lados. Primero junta los términos con x en un lado.',
    },
    {
      tokens: [
        t('a', '5x', 'var', { emph: 'focus' }),
        t('minus', '−', 'op'),
        t('n2', '2', 'num'),
        t('eq', '=', 'rel'),
        t('b', '3x', 'var', { emph: 'focus' }),
        t('plus', '+', 'op'),
        t('n6', '6', 'num'),
      ],
      explainEn: '5x and 3x are the x-terms. Remove 3x from the right side.',
      explainEs: '5x y 3x son los términos con x. Quita 3x del lado derecho.',
    },
    {
      tokens: [
        t('a', '5x', 'var'),
        t('m3xL', '− 3x', 'op', { emph: 'apply' }),
        t('minus', '−', 'op'),
        t('n2', '2', 'num'),
        t('eq', '=', 'rel'),
        t('b', '3x', 'var'),
        t('m3xR', '− 3x', 'op', { emph: 'apply' }),
        t('plus', '+', 'op'),
        t('n6', '6', 'num'),
      ],
      explainEn: 'Subtract 3x from BOTH sides.',
      explainEs: 'Resta 3x de AMBOS lados.',
    },
    {
      tokens: [
        t('t2x', '2x', 'var', { emph: 'result' }),
        t('minus', '−', 'op'),
        t('n2', '2', 'num'),
        t('eq', '=', 'rel'),
        t('n6', '6', 'num'),
      ],
      explainEn: '5x − 3x = 2x. On the right, 3x − 3x = 0 — the x is gone there.',
      explainEs: '5x − 3x = 2x. A la derecha, 3x − 3x = 0 — allí ya no hay x.',
    },
    {
      tokens: [
        t('t2x', '2x', 'var'),
        t('minus', '−', 'op'),
        t('n2', '2', 'num'),
        t('p2L', '+ 2', 'op', { emph: 'apply' }),
        t('eq', '=', 'rel'),
        t('n6', '6', 'num'),
        t('p2R', '+ 2', 'op', { emph: 'apply' }),
      ],
      explainEn: 'Now undo the − 2: add 2 to BOTH sides.',
      explainEs: 'Ahora deshaz el − 2: suma 2 a AMBOS lados.',
    },
    {
      tokens: [
        t('t2x', '2x', 'var'),
        t('eq', '=', 'rel'),
        t('n8', '8', 'num', { emph: 'result' }),
      ],
      explainEn: '− 2 + 2 cancels, and 6 + 2 = 8.',
      explainEs: '− 2 + 2 se cancela, y 6 + 2 = 8.',
    },
    {
      tokens: [
        t('t2x', '2x', 'var'),
        t('d2L', '÷ 2', 'op', { emph: 'apply' }),
        t('eq', '=', 'rel'),
        t('n8', '8', 'num'),
        t('d2R', '÷ 2', 'op', { emph: 'apply' }),
      ],
      explainEn: 'Divide BOTH sides by 2.',
      explainEs: 'Divide AMBOS lados entre 2.',
    },
    {
      tokens: [
        t('x', 'x', 'var'),
        t('eq', '=', 'rel'),
        t('n4', '4', 'num', { emph: 'result' }),
      ],
      explainEn: '2x ÷ 2 = x, and 8 ÷ 2 = 4. So x = 4!',
      explainEs: '2x ÷ 2 = x, y 8 ÷ 2 = 4. ¡Así que x = 4!',
    },
  ],
};

/** Inequality with the sign flip: 12 − 5x > 72 (the 3.3 classroom example). */
export const inequalityScript: EqScript = {
  id: 'inequality-flip',
  titleEn: 'Inequality: flip the symbol',
  titleEs: 'Desigualdad: voltea el símbolo',
  steps: [
    {
      tokens: [
        t('n12', '12', 'num'),
        t('minus', '−', 'op'),
        t('a', '5x', 'var'),
        t('rel', '>', 'rel'),
        t('n72', '72', 'num'),
      ],
      explainEn: 'Same steps as an equation: isolate the x-term. First undo the 12.',
      explainEs: 'Los mismos pasos que una ecuación: aísla el término con x. Primero deshaz el 12.',
    },
    {
      tokens: [
        t('n12', '12', 'num'),
        t('minus', '−', 'op'),
        t('a', '5x', 'var'),
        t('m12L', '− 12', 'op', { emph: 'apply' }),
        t('rel', '>', 'rel'),
        t('n72', '72', 'num'),
        t('m12R', '− 12', 'op', { emph: 'apply' }),
      ],
      explainEn: 'Subtract 12 from BOTH sides.',
      explainEs: 'Resta 12 de AMBOS lados.',
    },
    {
      tokens: [
        t('a', '−5x', 'var'),
        t('rel', '>', 'rel'),
        t('n60', '60', 'num', { emph: 'result' }),
      ],
      explainEn: '12 − 12 cancels. The x-term keeps its minus sign: −5x. And 72 − 12 = 60.',
      explainEs: '12 − 12 se cancela. El término con x conserva su signo menos: −5x. Y 72 − 12 = 60.',
    },
    {
      tokens: [
        t('a', '−5x', 'var'),
        t('d5L', '÷ (−5)', 'op', { emph: 'apply' }),
        t('rel', '>', 'rel'),
        t('n60', '60', 'num'),
        t('d5R', '÷ (−5)', 'op', { emph: 'apply' }),
      ],
      explainEn: 'Divide BOTH sides by −5. Careful — that number is NEGATIVE…',
      explainEs: 'Divide AMBOS lados entre −5. Cuidado — ¡ese número es NEGATIVO…',
    },
    {
      tokens: [
        t('x', 'x', 'var'),
        t('rel', '<', 'rel', { emph: 'flip' }),
        t('nf', '−12', 'num', { emph: 'result' }),
      ],
      explainEn: 'Dividing by a negative FLIPS the symbol: > becomes <. So x < −12.',
      explainEs: 'Dividir entre un negativo VOLTEA el símbolo: > se convierte en <. Así que x < −12.',
      holdMs: 3400,
    },
  ],
};

/** Evaluating an expression by substitution: 4x − 5 when x = 3 (Unit 2). */
export const evaluateScript: EqScript = {
  id: 'evaluate',
  titleEn: 'Evaluate an expression',
  titleEs: 'Evalúa una expresión',
  steps: [
    {
      tokens: [t('a', '4x', 'var'), t('minus', '−', 'op'), t('n5', '5', 'num')],
      explainEn: 'Evaluate 4x − 5 when x = 3. "Evaluate" means: plug in the value.',
      explainEs: 'Evalúa 4x − 5 cuando x = 3. "Evaluar" significa: sustituye el valor.',
    },
    {
      tokens: [
        t('a', '4(3)', 'var', { emph: 'focus' }),
        t('minus', '−', 'op'),
        t('n5', '5', 'num'),
      ],
      explainEn: 'Substitute: every x becomes (3). Parentheses keep the multiplication clear.',
      explainEs: 'Sustituye: cada x se convierte en (3). Los paréntesis mantienen clara la multiplicación.',
    },
    {
      tokens: [
        t('a', '12', 'num', { emph: 'result' }),
        t('minus', '−', 'op'),
        t('n5', '5', 'num'),
      ],
      explainEn: '4 · 3 = 12. Multiplication before subtraction (order of operations).',
      explainEs: '4 · 3 = 12. La multiplicación va antes que la resta (orden de operaciones).',
    },
    {
      tokens: [t('r', '7', 'num', { emph: 'result' })],
      explainEn: '12 − 5 = 7. The expression is worth 7 when x = 3.',
      explainEs: '12 − 5 = 7. La expresión vale 7 cuando x = 3.',
    },
  ],
};

/** Adding polynomials vertically: (3x² + 2x + 4) + (2x² + 5x + 1) (Unit 2). */
export const polyAddScript: EqScript = {
  id: 'poly-add',
  titleEn: 'Add polynomials',
  titleEs: 'Suma de polinomios',
  steps: [
    {
      tokens: [
        t('lp', '(', 'op'),
        t('a2', '3x²', 'var', { tight: true }),
        t('ao1', '+', 'op'),
        t('a1', '2x', 'var'),
        t('ao2', '+', 'op'),
        t('a0', '4', 'num'),
        t('rp', ')', 'op', { tight: true }),
        t('mid', '+', 'op'),
        t('lq', '(', 'op'),
        t('b2', '2x²', 'var', { tight: true }),
        t('bo1', '+', 'op'),
        t('b1', '5x', 'var'),
        t('bo2', '+', 'op'),
        t('b0', '1', 'num'),
        t('rq', ')', 'op', { tight: true }),
      ],
      explainEn: 'To ADD polynomials, combine like terms. Stack them so the like terms line up.',
      explainEs: 'Para SUMAR polinomios, combina los términos semejantes. Apílalos para que queden alineados.',
    },
    {
      tokens: [
        t('a2', '3x²', 'var'),
        t('ao1', '+', 'op'),
        t('a1', '2x', 'var'),
        t('ao2', '+', 'op'),
        t('a0', '4', 'num'),
        t('mid', '+', 'op', { row: 1 }),
        t('b2', '2x²', 'var', { row: 1 }),
        t('bo1', '+', 'op', { row: 1 }),
        t('b1', '5x', 'var', { row: 1 }),
        t('bo2', '+', 'op', { row: 1 }),
        t('b0', '1', 'num', { row: 1 }),
      ],
      explainEn: 'Each column holds like terms: x² over x², x over x, numbers over numbers.',
      explainEs: 'Cada columna tiene términos semejantes: x² sobre x², x sobre x, números sobre números.',
    },
    {
      tokens: [
        t('a2', '3x²', 'var', { emph: 'focus' }),
        t('ao1', '+', 'op'),
        t('a1', '2x', 'var'),
        t('ao2', '+', 'op'),
        t('a0', '4', 'num'),
        t('mid', '+', 'op', { row: 1 }),
        t('b2', '2x²', 'var', { emph: 'focus', row: 1 }),
        t('bo1', '+', 'op', { row: 1 }),
        t('b1', '5x', 'var', { row: 1 }),
        t('bo2', '+', 'op', { row: 1 }),
        t('b0', '1', 'num', { row: 1 }),
      ],
      explainEn: 'The x² column: 3x² + 2x² = 5x².',
      explainEs: 'La columna de x²: 3x² + 2x² = 5x².',
    },
    {
      tokens: [
        t('a2', '3x²', 'var'),
        t('ao1', '+', 'op'),
        t('a1', '2x', 'var', { emph: 'focus' }),
        t('ao2', '+', 'op'),
        t('a0', '4', 'num'),
        t('mid', '+', 'op', { row: 1 }),
        t('b2', '2x²', 'var', { row: 1 }),
        t('bo1', '+', 'op', { row: 1 }),
        t('b1', '5x', 'var', { emph: 'focus', row: 1 }),
        t('bo2', '+', 'op', { row: 1 }),
        t('b0', '1', 'num', { row: 1 }),
      ],
      explainEn: 'The x column: 2x + 5x = 7x.',
      explainEs: 'La columna de x: 2x + 5x = 7x.',
    },
    {
      tokens: [
        t('a2', '3x²', 'var'),
        t('ao1', '+', 'op'),
        t('a1', '2x', 'var'),
        t('ao2', '+', 'op'),
        t('a0', '4', 'num', { emph: 'focus' }),
        t('mid', '+', 'op', { row: 1 }),
        t('b2', '2x²', 'var', { row: 1 }),
        t('bo1', '+', 'op', { row: 1 }),
        t('b1', '5x', 'var', { row: 1 }),
        t('bo2', '+', 'op', { row: 1 }),
        t('b0', '1', 'num', { emph: 'focus', row: 1 }),
      ],
      explainEn: 'The number column: 4 + 1 = 5.',
      explainEs: 'La columna de números: 4 + 1 = 5.',
    },
    {
      tokens: [
        t('s2', '5x²', 'var', { emph: 'result' }),
        t('so1', '+', 'op'),
        t('s1', '7x', 'var', { emph: 'result' }),
        t('so2', '+', 'op'),
        t('s0', '5', 'num', { emph: 'result' }),
      ],
      explainEn: 'Put the columns together: 5x² + 7x + 5. Already in standard form — highest power first!',
      explainEs: 'Junta las columnas: 5x² + 7x + 5. ¡Ya está en forma estándar — la potencia mayor primero!',
      holdMs: 3000,
    },
  ],
};

/** Multiplying two binomials with FOIL: (x + 5)(x − 6) (Unit 2, the 2.3
 * classroom worked example). Same token ids as the `buildFoil` generator. */
export const foilScript: EqScript = {
  id: 'foil',
  titleEn: 'Multiply binomials (FOIL)',
  titleEs: 'Multiplica binomios (FOIL)',
  steps: [
    {
      tokens: [
        t('lp1', '(', 'op'),
        t('x1', 'x', 'var', { tight: true }),
        t('s1', '+', 'op'),
        t('p', '5', 'num'),
        t('rp1', ')', 'op', { tight: true }),
        t('lp2', '(', 'op'),
        t('x2', 'x', 'var', { tight: true }),
        t('s2', '−', 'op'),
        t('q', '6', 'num'),
        t('rp2', ')', 'op', { tight: true }),
      ],
      explainEn:
        'Multiply two binomials with FOIL: First, Outer, Inner, Last — distribute 4 times, then combine like terms.',
      explainEs:
        'Multiplica dos binomios con FOIL: Primeros, Externos, Internos, Últimos — distribuye 4 veces y luego combina términos semejantes.',
    },
    {
      tokens: [
        t('lp1', '(', 'op'),
        t('x1', 'x', 'var', { tight: true, emph: 'focus' }),
        t('s1', '+', 'op'),
        t('p', '5', 'num'),
        t('rp1', ')', 'op', { tight: true }),
        t('lp2', '(', 'op'),
        t('x2', 'x', 'var', { tight: true, emph: 'focus' }),
        t('s2', '−', 'op'),
        t('q', '6', 'num'),
        t('rp2', ')', 'op', { tight: true }),
      ],
      explainEn: 'First: multiply the first terms. x · x = x².',
      explainEs: 'Primeros: multiplica los primeros términos. x · x = x².',
    },
    {
      tokens: [
        t('lp1', '(', 'op'),
        t('x1', 'x', 'var', { tight: true, emph: 'focus' }),
        t('s1', '+', 'op'),
        t('p', '5', 'num'),
        t('rp1', ')', 'op', { tight: true }),
        t('lp2', '(', 'op'),
        t('x2', 'x', 'var', { tight: true }),
        t('s2', '−', 'op'),
        t('q', '6', 'num', { emph: 'focus' }),
        t('rp2', ')', 'op', { tight: true }),
      ],
      explainEn: 'Outer: the outer pair. x · (−6) = −6x.',
      explainEs: 'Externos: el par de afuera. x · (−6) = −6x.',
    },
    {
      tokens: [
        t('lp1', '(', 'op'),
        t('x1', 'x', 'var', { tight: true }),
        t('s1', '+', 'op'),
        t('p', '5', 'num', { emph: 'focus' }),
        t('rp1', ')', 'op', { tight: true }),
        t('lp2', '(', 'op'),
        t('x2', 'x', 'var', { tight: true, emph: 'focus' }),
        t('s2', '−', 'op'),
        t('q', '6', 'num'),
        t('rp2', ')', 'op', { tight: true }),
      ],
      explainEn: 'Inner: the inner pair. 5 · x = 5x.',
      explainEs: 'Internos: el par de adentro. 5 · x = 5x.',
    },
    {
      tokens: [
        t('lp1', '(', 'op'),
        t('x1', 'x', 'var', { tight: true }),
        t('s1', '+', 'op'),
        t('p', '5', 'num', { emph: 'focus' }),
        t('rp1', ')', 'op', { tight: true }),
        t('lp2', '(', 'op'),
        t('x2', 'x', 'var', { tight: true }),
        t('s2', '−', 'op'),
        t('q', '6', 'num', { emph: 'focus' }),
        t('rp2', ')', 'op', { tight: true }),
      ],
      explainEn: 'Last: the last terms. 5 · (−6) = −30.',
      explainEs: 'Últimos: los últimos términos. 5 · (−6) = −30.',
    },
    {
      tokens: [
        t('F', 'x²', 'var', { emph: 'result' }),
        t('opO', '−', 'op'),
        t('O', '6x', 'var', { emph: 'result' }),
        t('opI', '+', 'op'),
        t('I', '5x', 'var', { emph: 'result' }),
        t('opL', '−', 'op'),
        t('L', '30', 'num', { emph: 'result' }),
      ],
      explainEn: 'All four products: x² − 6x + 5x − 30. Now combine like terms.',
      explainEs: 'Los cuatro productos: x² − 6x + 5x − 30. Ahora combina los términos semejantes.',
    },
    {
      tokens: [
        t('F', 'x²', 'var'),
        t('opO', '−', 'op'),
        t('O', '6x', 'var', { emph: 'focus' }),
        t('opI', '+', 'op'),
        t('I', '5x', 'var', { emph: 'focus' }),
        t('opL', '−', 'op'),
        t('L', '30', 'num'),
      ],
      explainEn: 'The two middle terms are LIKE terms: −6x + 5x = −x.',
      explainEs: 'Los dos términos del medio son SEMEJANTES: −6x + 5x = −x.',
      holdMs: 3000,
    },
    {
      tokens: [
        t('F', 'x²', 'var'),
        t('opM', '−', 'op'),
        t('M', 'x', 'var', { emph: 'result' }),
        t('opL', '−', 'op'),
        t('L', '30', 'num'),
      ],
      explainEn: 'The answer is x² − x − 30. Standard form lists the highest power first!',
      explainEs: 'La respuesta es x² − x − 30. La forma estándar pone primero la potencia mayor.',
    },
  ],
};

/** Slope from two points: (1, 2) and (5, 8) (Unit 5). */
export const slopeTwoPointsScript: EqScript = {
  id: 'slope-two-points',
  titleEn: 'Slope from two points',
  titleEs: 'Pendiente con dos puntos',
  steps: [
    {
      tokens: [t('m', 'm', 'var'), t('eq', '=', 'rel'), f('fr', 'y₂ − y₁', 'x₂ − x₁')],
      explainEn: 'Find the slope through (1, 2) and (5, 8). Slope m is RISE (y-change) over RUN (x-change).',
      explainEs: 'Encuentra la pendiente por (1, 2) y (5, 8). La pendiente m es ELEVACIÓN (cambio en y) sobre AVANCE (cambio en x).',
    },
    {
      tokens: [t('m', 'm', 'var'), t('eq', '=', 'rel'), f('fr', '8 − 2', '5 − 1', { emph: 'focus' })],
      explainEn: 'Substitute the points. Subtract in the SAME order on top and bottom.',
      explainEs: 'Sustituye los puntos. Resta en el MISMO orden arriba y abajo.',
    },
    {
      tokens: [t('m', 'm', 'var'), t('eq', '=', 'rel'), f('fr', '6', '4', { emph: 'result' })],
      explainEn: '8 − 2 = 6 (the rise) and 5 − 1 = 4 (the run).',
      explainEs: '8 − 2 = 6 (la elevación) y 5 − 1 = 4 (el avance).',
    },
    {
      tokens: [t('m', 'm', 'var'), t('eq', '=', 'rel'), f('fr', '3', '2', { emph: 'result' })],
      explainEn: 'Simplify: divide top and bottom by 2. The slope is 3/2 — up 3 for every 2 right.',
      explainEs: 'Simplifica: divide arriba y abajo entre 2. La pendiente es 3/2 — sube 3 por cada 2 a la derecha.',
      holdMs: 3000,
    },
  ],
};

/** Rewrite in slope-intercept form: −2x + y = 5 (Unit 5). */
export const slopeInterceptScript: EqScript = {
  id: 'slope-intercept',
  titleEn: 'Slope-intercept form',
  titleEs: 'Forma pendiente-intercepto',
  steps: [
    {
      tokens: [
        t('a', '−2x', 'var'),
        t('plus', '+', 'op'),
        t('y', 'y', 'var'),
        t('eq', '=', 'rel'),
        t('n5', '5', 'num'),
      ],
      explainEn: 'We want y ALONE on the left — that is slope-intercept form, y = mx + b.',
      explainEs: 'Queremos la y SOLA a la izquierda — esa es la forma pendiente-intercepto, y = mx + b.',
    },
    {
      tokens: [
        t('a', '−2x', 'var'),
        t('plus', '+', 'op'),
        t('y', 'y', 'var'),
        t('gL', '+ 2x', 'op', { emph: 'apply' }),
        t('eq', '=', 'rel'),
        t('n5', '5', 'num'),
        t('gR', '+ 2x', 'op', { emph: 'apply' }),
      ],
      explainEn: 'y has −2x next to it. Add 2x to BOTH sides to remove it.',
      explainEs: 'La y tiene −2x al lado. Suma 2x a AMBOS lados para quitarlo.',
    },
    {
      tokens: [
        t('a', '−2x', 'var', { emph: 'cancel' }),
        t('plus', '+', 'op'),
        t('y', 'y', 'var'),
        t('gL', '+ 2x', 'op', { emph: 'cancel' }),
        t('eq', '=', 'rel'),
        t('n5', '5', 'num', { emph: 'focus' }),
        t('gR', '+ 2x', 'op', { emph: 'focus' }),
      ],
      explainEn: '−2x + 2x cancels — they add to zero. Only y is left on the left side.',
      explainEs: '−2x + 2x se cancela — suman cero. Solo queda y en el lado izquierdo.',
      holdMs: 3000,
    },
    {
      tokens: [
        t('y', 'y', 'var'),
        t('eq', '=', 'rel'),
        t('mx', '2x', 'var', { emph: 'result' }),
        t('bop', '+', 'op'),
        t('bb', '5', 'num', { emph: 'result' }),
      ],
      explainEn: 'Write the x-term first: y = 2x + 5. Slope m = 2, y-intercept b = 5!',
      explainEs: 'Escribe primero el término con x: y = 2x + 5. ¡Pendiente m = 2, intercepto en y b = 5!',
    },
  ],
};

export const demoScripts: EqScript[] = [
  twoStepScript,
  likeTermsScript,
  distributeScript,
  bothSidesScript,
  inequalityScript,
  evaluateScript,
  polyAddScript,
  foilScript,
  slopeTwoPointsScript,
  slopeInterceptScript,
];

/**
 * Which scripts belong to which lesson (by lesson code, e.g. "3.1").
 * The lesson player shows a "watch it step by step" card for matches.
 */
export const scriptsByLessonCode: Record<string, EqScript[]> = {
  '2.1': [evaluateScript],
  '2.2': [likeTermsScript],
  '2.3': [polyAddScript, foilScript],
  '3.1': [twoStepScript, distributeScript],
  '3.2': [bothSidesScript],
  '3.3': [inequalityScript],
  '5.2': [slopeTwoPointsScript],
  '5.3': [slopeInterceptScript],
};

/** Split a step at its relation token (=, ≤, …) for the balance scale. */
export function splitSides(step: EqStep): { left: EqToken[]; right: EqToken[]; rel?: EqToken } {
  const i = step.tokens.findIndex((tok) => tok.kind === 'rel');
  if (i < 0) return { left: step.tokens, right: [] };
  return { left: step.tokens.slice(0, i), right: step.tokens.slice(i + 1), rel: step.tokens[i] };
}

function tokensToText(tokens: EqToken[]): string {
  return tokens.map((tok, i) => (i === 0 || tok.tight ? tok.text : ` ${tok.text}`)).join('');
}

/** Plain-text rendering of a step, for the history stack / accessibility.
 * Two-row steps (vertical polynomial addition) join with a newline. */
export function stepToText(step: EqStep): string {
  const top = step.tokens.filter((tok) => !tok.row);
  const bottom = step.tokens.filter((tok) => tok.row === 1);
  return bottom.length ? `${tokensToText(top)}\n${tokensToText(bottom)}` : tokensToText(top);
}

/** Plain-text rendering of one side, for the balance-scale pans. */
export function sideToText(tokens: EqToken[]): string {
  return tokensToText(tokens);
}

const ANIM_MARKER = /\[\[anim:(\d+)\]\]/g;

/**
 * Extract the animation deep-link marker a tutor reply may carry
 * (`[[anim:N]]`, N numbered from 1). Returns the reply with every marker
 * stripped, plus the 0-based step index of the first valid marker, or null.
 *
 * Lives here (not in the tutor module) so the chat UI can import it without
 * pulling the server-only LLM providers into the client bundle.
 */
export function parseAnimMarker(text: string): { text: string; animStep: number | null } {
  let step: number | null = null;
  const cleaned = text
    .replace(ANIM_MARKER, (_, n: string) => {
      const parsed = parseInt(n, 10) - 1;
      if (step === null && parsed >= 0) step = parsed;
      return '';
    })
    .replace(/[ \t]+$/gm, '')
    .trim();
  return { text: cleaned, animStep: step };
}
