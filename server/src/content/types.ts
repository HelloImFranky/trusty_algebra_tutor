import type { GradingMode } from '../math/engine.js';
import type { Tier } from '../mastery.js';

export interface StepSeed {
  promptEn: string;
  promptEs: string;
  expectedLatex: string;
  gradingMode: GradingMode;
  hintEn?: string;
  hintEs?: string;
}

export interface FixedProblemSeed {
  tier: Tier;
  promptEn: string;
  promptEs: string;
  answerLatex: string;
  gradingMode: GradingMode;
  tolerance?: number;
  steps?: StepSeed[];
}

export interface LessonStepSeed {
  bodyEn: string;
  bodyEs: string;
  workedExampleLatex?: string;
  hintEn?: string;
  hintEs?: string;
}

export interface GeneratedSpec {
  template: string;
  tier: Tier;
  count: number;
  sprint?: boolean;
}

export interface LessonSeed {
  code: string;
  titleEn: string;
  titleEs: string;
  /** the persistent mnemonic hint chip for the lesson player */
  mnemonicEn?: string;
  mnemonicEs?: string;
  steps: LessonStepSeed[];
  skill: { slug: string; nameEn: string; nameEs: string };
  fixedProblems?: FixedProblemSeed[];
  generated?: GeneratedSpec[];
  exitTicketSize: number;
}

export interface UnitSeed {
  number: number;
  titleEn: string;
  titleEs: string;
  lessons: LessonSeed[];
}
