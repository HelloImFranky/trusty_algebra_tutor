/**
 * Achievement (badge/medal) definitions for the gamified progress tab.
 * Definitions live here as data; the API computes each user's metric values
 * and returns the definitions with `value`/`earned` attached. Icons are
 * emoji so the medals render identically on web and native with no asset
 * pipeline; the client draws the bronze/silver/gold medallion around them.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold';

/** Everything an achievement can be measured against. */
export interface AchievementMetrics {
  /** Correct answers across practice, sprints, and Regents Review. */
  correctAnswers: number;
  /** Longest run of consecutive correct answers (all-time best). */
  correctStreakBest: number;
  /** Consecutive-day activity streak. */
  streakDays: number;
  /** Skills currently at proficient or mastered. */
  skillsStrong: number;
  /** Regents Review: correct multiple-choice answers. */
  regentsCorrect: number;
  /** Regents Review: topics with all questions answered. */
  regentsTopicsCompleted: number;
  /** Regents Review: topics answered with a perfect score. */
  regentsPerfectTopics: number;
  /** Completed sprint rounds (sprints are single-difficulty). */
  sprintsCompleted: number;
}

export interface AchievementDef {
  id: string;
  icon: string;
  tier: AchievementTier;
  metric: keyof AchievementMetrics;
  target: number;
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
}

export const achievementDefs: AchievementDef[] = [
  // — Problem solving —
  // Milestone ladder: starts at 25 and each next target is 60% more than the
  // last, rounded up (25 → 40 → 64 → 103 → 165 → 264).
  {
    id: 'solver-25', icon: '✏️', tier: 'bronze', metric: 'correctAnswers', target: 25,
    nameEn: 'Getting Started', nameEs: 'Buen Comienzo',
    descEn: 'Answer 25 problems correctly', descEs: 'Responde 25 problemas correctamente',
  },
  {
    id: 'solver-40', icon: '🚀', tier: 'bronze', metric: 'correctAnswers', target: 40,
    nameEn: 'Warmed Up', nameEs: 'En Marcha',
    descEn: 'Answer 40 problems correctly', descEs: 'Responde 40 problemas correctamente',
  },
  {
    id: 'solver-64', icon: '🧠', tier: 'silver', metric: 'correctAnswers', target: 64,
    nameEn: 'Problem Solver', nameEs: 'Solucionador',
    descEn: 'Answer 64 problems correctly', descEs: 'Responde 64 problemas correctamente',
  },
  {
    id: 'solver-103', icon: '🧙', tier: 'silver', metric: 'correctAnswers', target: 103,
    nameEn: 'Math Whiz', nameEs: 'Genio Matemático',
    descEn: 'Answer 103 problems correctly', descEs: 'Responde 103 problemas correctamente',
  },
  {
    id: 'solver-165', icon: '🏆', tier: 'gold', metric: 'correctAnswers', target: 165,
    nameEn: 'Math Machine', nameEs: 'Máquina Matemática',
    descEn: 'Answer 165 problems correctly', descEs: 'Responde 165 problemas correctamente',
  },
  {
    id: 'solver-264', icon: '🐐', tier: 'gold', metric: 'correctAnswers', target: 264,
    nameEn: 'Math Legend', nameEs: 'Leyenda Matemática',
    descEn: 'Answer 264 problems correctly', descEs: 'Responde 264 problemas correctamente',
  },
  // — Correct answers in a row —
  {
    id: 'row-5', icon: '🎳', tier: 'bronze', metric: 'correctStreakBest', target: 5,
    nameEn: 'Hot Streak', nameEs: 'Racha Caliente',
    descEn: 'Answer 5 questions correctly in a row', descEs: 'Responde 5 preguntas correctas seguidas',
  },
  {
    id: 'row-10', icon: '⚡', tier: 'silver', metric: 'correctStreakBest', target: 10,
    nameEn: 'In the Zone', nameEs: 'En la Zona',
    descEn: 'Answer 10 questions correctly in a row', descEs: 'Responde 10 preguntas correctas seguidas',
  },
  {
    id: 'row-20', icon: '💎', tier: 'gold', metric: 'correctStreakBest', target: 20,
    nameEn: 'Flawless', nameEs: 'Impecable',
    descEn: 'Answer 20 questions correctly in a row', descEs: 'Responde 20 preguntas correctas seguidas',
  },
  // — Streaks —
  {
    id: 'streak-bronze', icon: '🔥', tier: 'bronze', metric: 'streakDays', target: 3,
    nameEn: 'Warming Up', nameEs: 'Calentando',
    descEn: 'Practice 3 days in a row', descEs: 'Practica 3 días seguidos',
  },
  {
    id: 'streak-silver', icon: '🔥', tier: 'silver', metric: 'streakDays', target: 7,
    nameEn: 'On Fire', nameEs: 'En Llamas',
    descEn: 'Practice 7 days in a row', descEs: 'Practica 7 días seguidos',
  },
  {
    id: 'streak-gold', icon: '🌋', tier: 'gold', metric: 'streakDays', target: 14,
    nameEn: 'Unstoppable', nameEs: 'Imparable',
    descEn: 'Practice 14 days in a row', descEs: 'Practica 14 días seguidos',
  },
  // — Mastery —
  {
    id: 'mastery-bronze', icon: '⭐', tier: 'bronze', metric: 'skillsStrong', target: 1,
    nameEn: 'First Star', nameEs: 'Primera Estrella',
    descEn: 'Reach proficient on your first skill', descEs: 'Alcanza competente en tu primera habilidad',
  },
  {
    id: 'mastery-silver', icon: '🌟', tier: 'silver', metric: 'skillsStrong', target: 5,
    nameEn: 'Rising Star', nameEs: 'Estrella en Ascenso',
    descEn: 'Reach proficient on 5 skills', descEs: 'Alcanza competente en 5 habilidades',
  },
  {
    id: 'mastery-gold', icon: '💫', tier: 'gold', metric: 'skillsStrong', target: 15,
    nameEn: 'Constellation', nameEs: 'Constelación',
    descEn: 'Reach proficient on 15 skills', descEs: 'Alcanza competente en 15 habilidades',
  },
  // — Regents Review —
  {
    id: 'regents-bronze', icon: '📚', tier: 'bronze', metric: 'regentsTopicsCompleted', target: 1,
    nameEn: 'Review Rookie', nameEs: 'Novato del Repaso',
    descEn: 'Complete your first Regents Review topic', descEs: 'Completa tu primer tema del Repaso Regents',
  },
  {
    id: 'regents-silver', icon: '🎓', tier: 'silver', metric: 'regentsTopicsCompleted', target: 5,
    nameEn: 'Review Scholar', nameEs: 'Académico del Repaso',
    descEn: 'Complete 5 Regents Review topics', descEs: 'Completa 5 temas del Repaso Regents',
  },
  {
    id: 'regents-gold', icon: '👑', tier: 'gold', metric: 'regentsTopicsCompleted', target: 10,
    nameEn: 'Regents Royalty', nameEs: 'Realeza Regents',
    descEn: 'Complete all 10 Regents Review topics', descEs: 'Completa los 10 temas del Repaso Regents',
  },
  {
    id: 'sharpshooter', icon: '🎯', tier: 'silver', metric: 'regentsPerfectTopics', target: 1,
    nameEn: 'Sharpshooter', nameEs: 'Tirador Certero',
    descEn: 'Get a perfect score on a Regents topic', descEs: 'Logra un puntaje perfecto en un tema Regents',
  },
  {
    id: 'sharpshooter-gold', icon: '🏹', tier: 'gold', metric: 'regentsPerfectTopics', target: 5,
    nameEn: 'Eagle Eye', nameEs: 'Ojo de Águila',
    descEn: 'Get perfect scores on 5 Regents topics', descEs: 'Logra puntajes perfectos en 5 temas Regents',
  },
  // — Sprints — one bronze/silver/gold ladder over total completed rounds
  // (sprints are single-difficulty, so one ladder covers everyone).
  {
    id: 'sprint-5', icon: '⚡', tier: 'bronze', metric: 'sprintsCompleted', target: 5,
    nameEn: 'Sprint Starter', nameEs: 'Iniciador de Sprints',
    descEn: 'Finish 5 sprints', descEs: 'Termina 5 sprints',
  },
  {
    id: 'sprint-15', icon: '⚡', tier: 'silver', metric: 'sprintsCompleted', target: 15,
    nameEn: 'Sprint Veteran', nameEs: 'Veterano de Sprints',
    descEn: 'Finish 15 sprints', descEs: 'Termina 15 sprints',
  },
  {
    id: 'sprint-30', icon: '⚡', tier: 'gold', metric: 'sprintsCompleted', target: 30,
    nameEn: 'Sprint Master', nameEs: 'Maestro de Sprints',
    descEn: 'Finish 30 sprints', descEs: 'Termina 30 sprints',
  },
  // Same +60% ladder as the solver milestones: 25 → 40 → 64.
  {
    id: 'regents-25', icon: '🥉', tier: 'bronze', metric: 'regentsCorrect', target: 25,
    nameEn: 'Exam Ready', nameEs: 'Listo para el Examen',
    descEn: 'Answer 25 Regents questions correctly', descEs: 'Responde 25 preguntas Regents correctamente',
  },
  {
    id: 'regents-40', icon: '🥈', tier: 'silver', metric: 'regentsCorrect', target: 40,
    nameEn: 'Regents Pro', nameEs: 'Profesional Regents',
    descEn: 'Answer 40 Regents questions correctly', descEs: 'Responde 40 preguntas Regents correctamente',
  },
  {
    id: 'regents-64', icon: '🥇', tier: 'gold', metric: 'regentsCorrect', target: 64,
    nameEn: 'Regents Champion', nameEs: 'Campeón Regents',
    descEn: 'Answer 64 Regents questions correctly', descEs: 'Responde 64 preguntas Regents correctamente',
  },
];

/** Attach a user's metric values to the definitions. */
export function computeAchievements(metrics: AchievementMetrics) {
  return achievementDefs.map((def) => ({
    ...def,
    value: metrics[def.metric],
    earned: metrics[def.metric] >= def.target,
  }));
}
