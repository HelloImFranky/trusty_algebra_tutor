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

export type TokenKind = 'num' | 'var' | 'op' | 'rel';

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
}

export interface EqStep {
  tokens: EqToken[];
  explainEn: string;
  explainEs: string;
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
  extra?: Partial<Pick<EqToken, 'emph' | 'tight'>>,
): EqToken => ({ id, text, kind, ...extra });

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
    },
  ],
};

export const demoScripts: EqScript[] = [
  twoStepScript,
  likeTermsScript,
  distributeScript,
  bothSidesScript,
  inequalityScript,
];

/**
 * Which scripts belong to which lesson (by lesson code, e.g. "3.1").
 * The lesson player shows a "watch it step by step" card for matches.
 */
export const scriptsByLessonCode: Record<string, EqScript[]> = {
  '2.2': [likeTermsScript],
  '3.1': [twoStepScript, distributeScript],
  '3.2': [bothSidesScript],
  '3.3': [inequalityScript],
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

/** Plain-text rendering of a step, for the history stack / accessibility. */
export function stepToText(step: EqStep): string {
  return tokensToText(step.tokens);
}

/** Plain-text rendering of one side, for the balance-scale pans. */
export function sideToText(tokens: EqToken[]): string {
  return tokensToText(tokens);
}
