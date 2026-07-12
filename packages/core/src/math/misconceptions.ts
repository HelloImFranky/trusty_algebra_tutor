/**
 * Misconception detection: a wrong answer should tell us *why* it's wrong,
 * not just that it is. Generators know their parameters, so they can predict
 * the answers common errors produce ("added 5 instead of subtracting") and
 * attach targeted feedback. When a student's incorrect submission matches a
 * predicted wrong answer, the app can respond to the actual mistake and the
 * mastery layer gains a signal richer than "problem #48392 wrong".
 */
import { areEquivalent, exactMatch } from './engine.js';

export interface Misconception {
  /** stable slug for analytics, e.g. "inverse_operation_error" */
  id: string;
  /** the wrong answer this error produces, in the same format as the key */
  answerLatex: string;
  feedbackEn: string;
  feedbackEs: string;
}

/**
 * Match an incorrect submission against a problem's predicted wrong answers.
 * Call only after normal grading said "incorrect" — generators guarantee the
 * predicted answers never grade correct against the real key.
 */
export function diagnoseMisconception(
  submitted: string,
  misconceptions: Misconception[] | null | undefined,
): Misconception | null {
  if (!submitted.trim() || !misconceptions?.length) return null;
  for (const m of misconceptions) {
    try {
      if (exactMatch(submitted, m.answerLatex) || areEquivalent(submitted, m.answerLatex)) {
        return m;
      }
    } catch {
      // an unparseable prediction should never block grading feedback
    }
  }
  return null;
}
