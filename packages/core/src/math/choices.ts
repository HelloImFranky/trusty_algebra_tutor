/**
 * Multiple-choice answer sets for the "pick a word" practice questions —
 * rational vs irrational, is-this-a-function (yes/no), how the graph moves
 * (up/down, left/right), linear vs exponential, and classify-the-function.
 *
 * These are graded 'exact' against a fixed English answer word, so making a
 * student type "irrational" on a number pad is the wrong tool. The choice
 * set is keyed off the generator `template` (and, for transformations, the
 * specific `kind`) that `generateProblem` stamps into every problem's
 * params. Free-response numeric/expression questions return null and keep
 * the calculator keypad.
 *
 * The returned strings are always the English words the grader expects,
 * matching the "(answer: rational / irrational)" hint the prompts carry in
 * both locales.
 */
export function answerChoicesFor(params: unknown): string[] | null {
  if (!params || typeof params !== 'object') return null;
  const p = params as Record<string, unknown>;
  const template = typeof p.template === 'string' ? p.template : null;
  if (!template) return null;
  switch (template) {
    case 'rational_irrational':
      return ['rational', 'irrational'];
    case 'is_function':
      return ['yes', 'no'];
    case 'linear_vs_exponential':
      return ['linear', 'exponential'];
    case 'classify_function_type':
      return ['linear', 'quadratic', 'exponential'];
    case 'transformation_identify':
      // kind 0 (y=x²+k) and kind 2 (y=−x² opens) are up/down; kind 1
      // (y=|x−h|) is left/right.
      return p.kind === 1 ? ['left', 'right'] : ['up', 'down'];
    default:
      return null;
  }
}

/**
 * Templates whose yes/no verdict must be justified with a checkable
 * follow-up — the student names the evidence (e.g. the input that has two
 * outputs, or "none"). The practice flow uses this to require the
 * justification step even after a correct verdict, so every student proves
 * *why*, not just *what*. Keyed off the generator `template` in params.
 */
export function requiresJustificationFor(params: unknown): boolean {
  if (!params || typeof params !== 'object') return false;
  const template = (params as Record<string, unknown>).template;
  return template === 'is_function';
}
