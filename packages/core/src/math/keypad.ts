/**
 * Which dedicated answer pad a practice problem should show.
 *
 * There are two selectors here, from coarse to specific:
 *
 * 1. `keypadKindForAnswer(answerLatex)` — the shape-only fallback. It only
 *    ever returns the two general pads:
 *      - 'numeric' — a single bare number: integer or decimal, optionally
 *        negative (5, -12, 348.05). The clean number pad, no operators.
 *      - 'algebra' — everything else. The full pad.
 *    It's deliberately coarse and is used whenever a problem carries no
 *    generator `template` (hand-authored fixed problems).
 *
 * 2. `keypadKindForProblem(params, answerLatex)` — the per-lesson selector.
 *    Generated problems stamp their generator `template` into params (see
 *    generateProblem), and each template's answer has a known, narrow shape
 *    — a radical, a power of x, a coordinate pair, an inequality, a factored
 *    form, and so on. `KEYPAD_FOR_TEMPLATE` maps each template to a pad that
 *    shows *only* the keys that answer can need, so a student solving "x + 3"
 *    problems never sees √, π, or coordinate parentheses they'll never type.
 *    Unmapped templates (and fixed problems) fall back to the shape-only
 *    classifier above.
 *
 * Because the choice is keyed off the lesson's template — never the concrete
 * answer's operators — the pad reveals nothing the lesson prompt doesn't
 * already imply.
 *
 * Word-answer questions (rational/irrational, yes/no, …) use choice buttons
 * instead — see answerChoicesFor — and never reach here.
 */
export type KeypadKind =
  // bare numbers: 12, -4, 348.05
  | 'numeric'
  // simplified radicals: 3√5
  | 'radical'
  // powers of a single variable / monomials: x^6, 3x^2
  | 'exponent'
  // expressions & polynomials: -3x^2 + x - 1 (the full term-builder pad)
  | 'polynomial'
  // inequality solutions: x < -2
  | 'inequality'
  // linear equations solved for a variable: y = -3x - 2, x = -3
  | 'linear'
  // coordinate points, slopes, and comma-separated solution lists:
  // (-3, -1), (3)/(2), 5, -5
  | 'points'
  // factored forms: 3x(2x + 4), (x + 3)(x - 5)
  | 'factor'
  // catch-all fallback for anything the shape classifier can't narrow
  | 'algebra';

/** The two general pads the shape-only classifier can return. */
export function keypadKindForAnswer(answerLatex: string): 'numeric' | 'algebra' {
  return /^-?\d+(\.\d+)?$/.test(answerLatex.trim()) ? 'numeric' : 'algebra';
}

/**
 * Per-lesson pad by generator template. Every free-response (non-choice)
 * template maps to the narrowest pad that can still type its whole answer
 * space — verified against each generator's answerLatex in keypad.test.ts.
 * A template intentionally left out (e.g. exponential_write's "f(x) = …",
 * which needs the general pad) falls through to keypadKindForAnswer.
 */
export const KEYPAD_FOR_TEMPLATE: Record<string, KeypadKind> = {
  // Unit 1 — Number Sense
  perfect_square_root: 'numeric',
  exponent_product_rule: 'exponent',
  simplify_radical: 'radical',
  radical_add: 'radical',
  radical_multiply: 'radical',
  dimensional_analysis: 'numeric',

  // Unit 2 — Expressions & Polynomials
  evaluate_expression: 'numeric',
  combine_like_terms: 'polynomial',
  distribute_simplify: 'polynomial',
  add_polynomials: 'polynomial',
  foil: 'polynomial',
  mono_times_poly: 'polynomial',

  // Unit 3 — Equations & Inequalities
  two_step_equation: 'numeric',
  multi_step_equation: 'numeric',
  var_both_sides: 'numeric',
  two_step_inequality: 'inequality',

  // Unit 4 — Functions
  evaluate_function: 'numeric',
  domain_from_points: 'points',

  // Unit 5 — Linear Relationships
  slope_two_points: 'points',
  slope_intercept_rewrite: 'linear',
  identify_slope_yint: 'points',
  system_substitution: 'points',
  system_elimination: 'points',

  // Unit 6 — Exponential Relationships
  exponential_growth_decay: 'numeric',
  // exponential_write → "f(x) = a(b)^x" needs the general pad (falls through)

  // Unit 7 — Factoring
  gcf_monomials: 'exponent',
  factor_gcf: 'factor',
  factor_trinomial: 'factor',
  dots: 'factor',

  // Unit 8 — Quadratics
  solve_sqrt_method: 'points',
  solve_quadratic_factoring: 'points',
  vertex_from_vertex_form: 'points',
  axis_of_symmetry: 'linear',
  projectile_ground: 'numeric',
};

/**
 * Pick a problem's pad: prefer the per-lesson pad keyed off its generator
 * template, and fall back to the shape-only classifier for hand-authored
 * problems (no template) and any template deliberately left unmapped.
 */
export function keypadKindForProblem(params: unknown, answerLatex: string): KeypadKind {
  const template =
    params && typeof params === 'object'
      ? (params as Record<string, unknown>).template
      : undefined;
  if (typeof template === 'string' && template in KEYPAD_FOR_TEMPLATE) {
    return KEYPAD_FOR_TEMPLATE[template];
  }
  return keypadKindForAnswer(answerLatex);
}
