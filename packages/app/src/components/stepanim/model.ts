/**
 * The step-animator data model and scripts live in @tutor/core
 * (packages/core/src/anim/) so they can be unit-tested and reused
 * server-side. This shim keeps the app package's import paths stable.
 */
export type { TokenKind, Emph, EqToken, EqStep, EqScript } from '@tutor/core';
export {
  twoStepScript,
  likeTermsScript,
  distributeScript,
  bothSidesScript,
  inequalityScript,
  evaluateScript,
  slopeTwoPointsScript,
  slopeInterceptScript,
  demoScripts,
  scriptsByLessonCode,
  splitSides,
  stepToText,
  sideToText,
} from '@tutor/core';
