/**
 * Which dedicated answer pad a practice problem should show, derived from the
 * shape of its (server-side) answer:
 *
 * - 'numeric' — the answer is a single bare number: integer or decimal,
 *   optionally negative (5, -12, 348.05). These get the clean number pad
 *   with no operators.
 * - 'algebra' — everything else: variables, +/−, parentheses, commas,
 *   coordinates, inequalities, radicals or fractions (x^{6}, y = -3x - 2,
 *   (-3, -1), x < -2, 3\sqrt{5}, (3)/(1)). These need the fuller pad.
 *
 * Word-answer questions (rational/irrational, yes/no, …) use choice buttons
 * instead — see answerChoicesFor — and never reach here.
 *
 * The result is intentionally coarse (two buckets) so it reveals nothing
 * about the answer beyond what the prompt already implies.
 */
export type KeypadKind = 'numeric' | 'algebra';

export function keypadKindForAnswer(answerLatex: string): KeypadKind {
  return /^-?\d+(\.\d+)?$/.test(answerLatex.trim()) ? 'numeric' : 'algebra';
}
