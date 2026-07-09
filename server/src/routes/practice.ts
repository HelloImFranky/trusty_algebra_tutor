import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { query } from '../db/pool.js';
import { decayedScore, tierForScore } from '../mastery.js';
import { grade, type GradingMode } from '../math/engine.js';
import { applyMastery } from './curriculum.js';

export const practiceRouter = Router();

interface ProblemRow {
  id: number;
  skill_id: number;
  tier: string;
  prompt_en: string;
  prompt_es: string;
  grading_mode: GradingMode;
  tolerance: number | null;
}

function locOf(req: { user?: { locale: 'en' | 'es' }; query: Record<string, unknown> }): 'en' | 'es' {
  const q = req.query.locale;
  if (q === 'es' || q === 'en') return q;
  return req.user?.locale ?? 'en';
}

async function problemPayload(p: ProblemRow, locale: 'en' | 'es') {
  const steps = await query<{
    position: number; prompt_en: string; prompt_es: string; hint_en: string | null; hint_es: string | null;
  }>('SELECT position, prompt_en, prompt_es, hint_en, hint_es FROM problem_steps WHERE problem_id=$1 ORDER BY position', [p.id]);
  return {
    id: p.id,
    skillId: p.skill_id,
    tier: p.tier,
    prompt: locale === 'es' ? p.prompt_es : p.prompt_en,
    gradingMode: p.grading_mode,
    steps: steps.rows.map((s) => ({
      position: s.position,
      prompt: locale === 'es' ? s.prompt_es : s.prompt_en,
      hint: locale === 'es' ? s.hint_es : s.hint_en,
    })),
  };
}

/**
 * Adaptive problem selection (§4.4): pick the tier from current mastery,
 * prefer problems the student hasn't attempted recently.
 */
practiceRouter.get('/practice/next', requireAuth, async (req, res, next) => {
  try {
    const locale = locOf(req);
    const skillId = Number(req.query.skill);
    if (!skillId) {
      res.status(400).json({ error: 'skill query param required' });
      return;
    }
    const m = await query<{
      score: number; attempts_count: number; last_practiced_at: Date | null;
    }>('SELECT score, attempts_count, last_practiced_at FROM mastery WHERE user_id=$1 AND skill_id=$2', [
      req.user!.id,
      skillId,
    ]);
    const score = m.rowCount
      ? decayedScore({
          score: m.rows[0].score,
          attemptsCount: m.rows[0].attempts_count,
          lastPracticedAt: m.rows[0].last_practiced_at,
        })
      : 0;
    const tier = tierForScore(score, m.rows[0]?.attempts_count ?? 0);

    const pick = await query<ProblemRow>(
      `SELECT p.id, p.skill_id, p.tier, p.prompt_en, p.prompt_es, p.grading_mode, p.tolerance
       FROM problems p
       LEFT JOIN (
         SELECT problem_id, max(created_at) AS last_attempt, count(*) AS n
         FROM attempts WHERE user_id=$1 GROUP BY problem_id
       ) a ON a.problem_id = p.id
       WHERE p.skill_id=$2 AND p.tier=$3 AND NOT p.is_sprint
       ORDER BY a.n NULLS FIRST, a.last_attempt NULLS FIRST, random()
       LIMIT 1`,
      [req.user!.id, skillId, tier],
    );
    if (!pick.rowCount) {
      res.status(404).json({ error: 'no problems for this skill' });
      return;
    }
    res.json({ tier, masteryScore: Math.round(score * 100) / 100, problem: await problemPayload(pick.rows[0], locale) });
  } catch (err) {
    next(err);
  }
});

const attemptSchema = z.object({
  submittedLatex: z.string().max(2000),
  hintsUsed: z.number().int().min(0).max(20).default(0),
  stepReached: z.number().int().min(0).default(0),
  durationMs: z.number().int().nonnegative().optional(),
  context: z.enum(['practice', 'sprint', 'review']).default('practice'),
});

/**
 * Full-answer check (§8). Wrong answers don't just say "incorrect": the
 * response carries the problem's scaffold steps so the client can walk the
 * student through STEP 1, STEP 2, ... (§4.2).
 */
practiceRouter.post('/problems/:id/attempt', requireAuth, async (req, res, next) => {
  try {
    const locale = locOf(req);
    const body = attemptSchema.parse(req.body);
    const problemId = Number(req.params.id);
    const p = await query<ProblemRow & { answer_latex: string }>(
      `SELECT id, skill_id, tier, prompt_en, prompt_es, grading_mode, tolerance, answer_latex
       FROM problems WHERE id=$1`,
      [problemId],
    );
    if (!p.rowCount) {
      res.status(404).json({ error: 'problem not found' });
      return;
    }
    const prob = p.rows[0];
    const result = grade(body.submittedLatex, prob.answer_latex, prob.grading_mode, prob.tolerance);

    await query(
      `INSERT INTO attempts(user_id, problem_id, submitted_latex, correct, hints_used, step_reached, duration_ms, context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [req.user!.id, problemId, body.submittedLatex, result.correct, body.hintsUsed, body.stepReached, body.durationMs ?? null, body.context],
    );
    await applyMastery(req.user!.id, prob.skill_id, result.correct, body.hintsUsed);

    const steps = result.correct
      ? []
      : (
          await query<{
            position: number; prompt_en: string; prompt_es: string; hint_en: string | null; hint_es: string | null;
          }>('SELECT position, prompt_en, prompt_es, hint_en, hint_es FROM problem_steps WHERE problem_id=$1 ORDER BY position', [problemId])
        ).rows.map((s) => ({
          position: s.position,
          prompt: locale === 'es' ? s.prompt_es : s.prompt_en,
          hint: locale === 'es' ? s.hint_es : s.hint_en,
        }));

    res.json({
      correct: result.correct,
      equivalentButNotCanonical: result.equivalentButNotCanonical ?? false,
      message: result.correct
        ? null
        : result.equivalentButNotCanonical
          ? locale === 'es'
            ? 'Tu valor es correcto, ¡pero aún no está en su forma final! Revisa la forma estándar o simplifica por completo.'
            : "Your value is right, but it's not in final form yet! Check standard form or simplify completely."
          : null,
      steps,
    });
  } catch (err) {
    next(err);
  }
});

/** Single-step check for the guided tutor loop (§8). */
practiceRouter.post('/problems/:id/steps/:n/check', requireAuth, async (req, res, next) => {
  try {
    const locale = locOf(req);
    const { submittedLatex } = z.object({ submittedLatex: z.string().max(2000) }).parse(req.body);
    const problemId = Number(req.params.id);
    const position = Number(req.params.n);
    const step = await query<{
      expected_latex: string; grading_mode: GradingMode; hint_en: string | null; hint_es: string | null;
    }>('SELECT expected_latex, grading_mode, hint_en, hint_es FROM problem_steps WHERE problem_id=$1 AND position=$2', [
      problemId,
      position,
    ]);
    if (!step.rowCount) {
      res.status(404).json({ error: 'step not found' });
      return;
    }
    const s = step.rows[0];
    const tolerance = (
      await query<{ tolerance: number | null }>('SELECT tolerance FROM problems WHERE id=$1', [problemId])
    ).rows[0]?.tolerance;
    const result = grade(submittedLatex, s.expected_latex, s.grading_mode, tolerance);
    res.json({
      correct: result.correct,
      equivalentButNotCanonical: result.equivalentButNotCanonical ?? false,
      hint: result.correct ? null : locale === 'es' ? s.hint_es : s.hint_en,
    });
  } catch (err) {
    next(err);
  }
});

/** Sprints (§4.4): short timed fluency drills from the Sprints folder. */
practiceRouter.get('/sprints/next', requireAuth, async (req, res, next) => {
  try {
    const locale = locOf(req);
    const count = Math.min(Number(req.query.count) || 10, 20);
    const rows = await query<ProblemRow>(
      `SELECT id, skill_id, tier, prompt_en, prompt_es, grading_mode, tolerance
       FROM problems WHERE is_sprint ORDER BY random() LIMIT $1`,
      [count],
    );
    res.json({
      problems: rows.rows.map((p) => ({
        id: p.id,
        skillId: p.skill_id,
        prompt: locale === 'es' ? p.prompt_es : p.prompt_en,
        gradingMode: p.grading_mode,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Review mode (§4.5): mixed-unit session assembled from previously seen
 * skills, weighted toward stale/weak mastery (Regents prep).
 */
practiceRouter.get('/review/session', requireAuth, async (req, res, next) => {
  try {
    const locale = locOf(req);
    const size = Math.min(Number(req.query.count) || 8, 15);
    const mastered = await query<{
      skill_id: number; score: number; attempts_count: number; last_practiced_at: Date | null;
    }>('SELECT skill_id, score, attempts_count, last_practiced_at FROM mastery WHERE user_id=$1', [
      req.user!.id,
    ]);
    if (!mastered.rowCount) {
      res.json({ problems: [], message: 'practice some lessons first' });
      return;
    }
    // Weakest decayed mastery first — those need review most.
    const ranked = mastered.rows
      .map((m) => ({
        skillId: m.skill_id,
        score: decayedScore({
          score: m.score,
          attemptsCount: m.attempts_count,
          lastPracticedAt: m.last_practiced_at,
        }),
      }))
      .sort((a, b) => a.score - b.score);
    const problems: Awaited<ReturnType<typeof problemPayload>>[] = [];
    for (const r of ranked) {
      if (problems.length >= size) break;
      const tier = tierForScore(r.score, 1);
      const pick = await query<ProblemRow>(
        `SELECT id, skill_id, tier, prompt_en, prompt_es, grading_mode, tolerance
         FROM problems WHERE skill_id=$1 AND tier=$2 AND NOT is_sprint ORDER BY random() LIMIT 2`,
        [r.skillId, tier],
      );
      for (const p of pick.rows) {
        if (problems.length >= size) break;
        problems.push(await problemPayload(p, locale));
      }
    }
    res.json({ problems });
  } catch (err) {
    next(err);
  }
});
