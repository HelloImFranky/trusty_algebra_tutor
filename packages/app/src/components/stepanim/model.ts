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
  | 'cancel'; /* struck-through gray: this pair adds/divides to nothing */

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

export const demoScripts: EqScript[] = [twoStepScript, likeTermsScript];

/** Plain-text rendering of a step, for the history stack / accessibility. */
export function stepToText(step: EqStep): string {
  return step.tokens
    .map((tok, i) => (i === 0 || tok.tight ? tok.text : ` ${tok.text}`))
    .join('');
}
