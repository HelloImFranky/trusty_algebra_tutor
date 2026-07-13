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
  /** Correct answers across practice, sprints, and exit tickets. */
  correctAnswers: number;
  /** Consecutive-day activity streak. */
  streakDays: number;
  /** Skills currently at proficient or mastered. */
  skillsStrong: number;
  /** Exit tickets with a perfect score. */
  perfectExitTickets: number;
  /** Regents Review: correct multiple-choice answers. */
  regentsCorrect: number;
  /** Regents Review: topics with all questions answered. */
  regentsTopicsCompleted: number;
  /** Regents Review: topics answered with a perfect score. */
  regentsPerfectTopics: number;
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
  {
    id: 'solver-bronze', icon: '✏️', tier: 'bronze', metric: 'correctAnswers', target: 10,
    nameEn: 'Getting Started', nameEs: 'Buen Comienzo',
    descEn: 'Answer 10 problems correctly', descEs: 'Responde 10 problemas correctamente',
  },
  {
    id: 'solver-silver', icon: '🧠', tier: 'silver', metric: 'correctAnswers', target: 50,
    nameEn: 'Problem Solver', nameEs: 'Solucionador',
    descEn: 'Answer 50 problems correctly', descEs: 'Responde 50 problemas correctamente',
  },
  {
    id: 'solver-gold', icon: '🏆', tier: 'gold', metric: 'correctAnswers', target: 150,
    nameEn: 'Math Machine', nameEs: 'Máquina Matemática',
    descEn: 'Answer 150 problems correctly', descEs: 'Responde 150 problemas correctamente',
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
  // — Exit tickets —
  {
    id: 'ticket-ace', icon: '🎟️', tier: 'silver', metric: 'perfectExitTickets', target: 1,
    nameEn: 'Ticket Ace', nameEs: 'As del Boleto',
    descEn: 'Score 100% on an exit ticket', descEs: 'Obtén 100% en un boleto de salida',
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
  {
    id: 'regents-25', icon: '🥇', tier: 'gold', metric: 'regentsCorrect', target: 25,
    nameEn: 'Exam Ready', nameEs: 'Listo para el Examen',
    descEn: 'Answer 25 Regents questions correctly', descEs: 'Responde 25 preguntas Regents correctamente',
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
