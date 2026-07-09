import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { query } from '../db/pool.js';
import { decayedScore, masteryLabel, updateMastery } from '../mastery.js';
import { grade, type GradingMode } from '../math/engine.js';
import { referenceSheet } from '../content/index.js';

export const curriculumRouter = Router();

function loc(req: { user?: { locale: 'en' | 'es' } }, query?: unknown): 'en' | 'es' {
  if (query === 'es' || query === 'en') return query;
  return req.user?.locale ?? 'en';
}

/** Units + lessons + the student's mastery overlay (§8). */
curriculumRouter.get('/curriculum', requireAuth, async (req, res, next) => {
  try {
    const locale = loc(req, req.query.locale);
    const units = await query<{
      id: number; number: number; title_en: string; title_es: string;
    }>('SELECT id, number, title_en, title_es FROM units ORDER BY position');
    const lessons = await query<{
      id: number; unit_id: number; code: string; title_en: string; title_es: string;
      skill_id: number | null;
    }>(`SELECT l.id, l.unit_id, l.code, l.title_en, l.title_es, s.id AS skill_id
        FROM lessons l LEFT JOIN skills s ON s.lesson_id = l.id
        ORDER BY l.unit_id, l.position`);
    const mastery = await query<{
      skill_id: number; score: number; attempts_count: number; last_practiced_at: Date | null;
    }>('SELECT skill_id, score, attempts_count, last_practiced_at FROM mastery WHERE user_id=$1', [
      req.user!.id,
    ]);
    const masteryBySkill = new Map(mastery.rows.map((m) => [m.skill_id, m]));

    res.json({
      units: units.rows.map((u) => ({
        id: u.id,
        number: u.number,
        title: locale === 'es' ? u.title_es : u.title_en,
        lessons: lessons.rows
          .filter((l) => l.unit_id === u.id)
          .map((l) => {
            const m = l.skill_id ? masteryBySkill.get(l.skill_id) : undefined;
            const score = m
              ? decayedScore({
                  score: m.score,
                  attemptsCount: m.attempts_count,
                  lastPracticedAt: m.last_practiced_at,
                })
              : 0;
            return {
              id: l.id,
              code: l.code,
              title: locale === 'es' ? l.title_es : l.title_en,
              skillId: l.skill_id,
              mastery: {
                score: Math.round(score * 100) / 100,
                attempts: m?.attempts_count ?? 0,
                label: masteryLabel(score, m?.attempts_count ?? 0),
              },
            };
          }),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Lesson player payload: scaffold steps, worked examples, mnemonic (localized). */
curriculumRouter.get('/lessons/:id', requireAuth, async (req, res, next) => {
  try {
    const locale = loc(req, req.query.locale);
    const id = Number(req.params.id);
    const lesson = await query<{
      id: number; code: string; title_en: string; title_es: string;
      mnemonic_en: string | null; mnemonic_es: string | null; unit_id: number;
      content_version: number;
    }>('SELECT id, code, title_en, title_es, mnemonic_en, mnemonic_es, unit_id, content_version FROM lessons WHERE id=$1', [id]);
    if (!lesson.rowCount) {
      res.status(404).json({ error: 'lesson not found' });
      return;
    }
    const l = lesson.rows[0];
    const steps = await query<{
      id: number; position: number; body_en: string; body_es: string;
      worked_example_latex: string | null; hint_en: string | null; hint_es: string | null;
    }>('SELECT id, position, body_en, body_es, worked_example_latex, hint_en, hint_es FROM lesson_steps WHERE lesson_id=$1 ORDER BY position', [id]);
    const skill = await query<{ id: number; slug: string; name_en: string; name_es: string }>(
      'SELECT id, slug, name_en, name_es FROM skills WHERE lesson_id=$1',
      [id],
    );
    // The original classroom scaffold sections for this lesson's topics
    // (authentic source material — English, as written by the teacher).
    const scaffolds = await query<{ title: string; body_md: string; images: string[] }>(
      'SELECT title, body_md, images FROM lesson_scaffolds WHERE lesson_id=$1 ORDER BY position',
      [id],
    );
    res.json({
      id: l.id,
      code: l.code,
      contentVersion: l.content_version,
      title: locale === 'es' ? l.title_es : l.title_en,
      mnemonic: locale === 'es' ? l.mnemonic_es : l.mnemonic_en,
      skill: skill.rowCount
        ? {
            id: skill.rows[0].id,
            slug: skill.rows[0].slug,
            name: locale === 'es' ? skill.rows[0].name_es : skill.rows[0].name_en,
          }
        : null,
      steps: steps.rows.map((s) => ({
        position: s.position,
        body: locale === 'es' ? s.body_es : s.body_en,
        workedExampleLatex: s.worked_example_latex,
        hint: locale === 'es' ? s.hint_es : s.hint_en,
      })),
      classroomScaffolds: scaffolds.rows.map((s) => ({
        title: s.title,
        body: s.body_md,
        images: s.images ?? [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** Exit ticket for a lesson (problems only — no answers). */
curriculumRouter.get('/lessons/:id/exit-ticket', requireAuth, async (req, res, next) => {
  try {
    const locale = loc(req, req.query.locale);
    const lessonId = Number(req.params.id);
    const et = await query<{ id: number; problem_ids: number[] }>(
      'SELECT id, problem_ids FROM exit_tickets WHERE lesson_id=$1',
      [lessonId],
    );
    if (!et.rowCount) {
      res.status(404).json({ error: 'no exit ticket for this lesson' });
      return;
    }
    const problems = await query<{
      id: number; prompt_en: string; prompt_es: string; grading_mode: string;
    }>('SELECT id, prompt_en, prompt_es, grading_mode FROM problems WHERE id = ANY($1)', [
      et.rows[0].problem_ids,
    ]);
    const byId = new Map(problems.rows.map((p) => [p.id, p]));
    res.json({
      id: et.rows[0].id,
      lessonId,
      problems: et.rows[0].problem_ids
        .map((pid) => byId.get(pid))
        .filter(Boolean)
        .map((p) => ({
          id: p!.id,
          prompt: locale === 'es' ? p!.prompt_es : p!.prompt_en,
          gradingMode: p!.grading_mode,
        })),
    });
  } catch (err) {
    next(err);
  }
});

/** Submit a whole exit ticket; auto-grade, store result, update mastery (§4.3). */
curriculumRouter.post('/exit-tickets/:id/submit', requireAuth, async (req, res, next) => {
  try {
    const body = z
      .object({
        answers: z.array(z.object({ problemId: z.number(), submittedLatex: z.string() })),
        durationMs: z.number().int().nonnegative().optional(),
      })
      .parse(req.body);
    const etId = Number(req.params.id);
    const et = await query<{ id: number; lesson_id: number; problem_ids: number[] }>(
      'SELECT id, lesson_id, problem_ids FROM exit_tickets WHERE id=$1',
      [etId],
    );
    if (!et.rowCount) {
      res.status(404).json({ error: 'exit ticket not found' });
      return;
    }
    const problems = await query<{
      id: number; skill_id: number; answer_latex: string; grading_mode: GradingMode; tolerance: number | null;
    }>('SELECT id, skill_id, answer_latex, grading_mode, tolerance FROM problems WHERE id = ANY($1)', [
      et.rows[0].problem_ids,
    ]);
    const byId = new Map(problems.rows.map((p) => [p.id, p]));

    let score = 0;
    const results: { problemId: number; correct: boolean; correctAnswer: string }[] = [];
    for (const ans of body.answers) {
      const p = byId.get(ans.problemId);
      if (!p) continue;
      const result = grade(ans.submittedLatex, p.answer_latex, p.grading_mode, p.tolerance);
      if (result.correct) score++;
      results.push({ problemId: p.id, correct: result.correct, correctAnswer: p.answer_latex });
      await query(
        `INSERT INTO attempts(user_id, problem_id, submitted_latex, correct, context)
         VALUES ($1,$2,$3,$4,'exit_ticket')`,
        [req.user!.id, p.id, ans.submittedLatex, result.correct],
      );
      await applyMastery(req.user!.id, p.skill_id, result.correct, 0);
    }
    const maxScore = et.rows[0].problem_ids.length;
    await query(
      `INSERT INTO exit_ticket_results(user_id, exit_ticket_id, score, max_score)
       VALUES ($1,$2,$3,$4)`,
      [req.user!.id, etId, score, maxScore],
    );
    res.json({ score, maxScore, results });
  } catch (err) {
    next(err);
  }
});

/** Always-available Regents reference sheet, localized (§4.5). */
curriculumRouter.get('/reference-sheet', (req, res) => {
  const locale = req.query.locale === 'es' ? 'es' : 'en';
  res.json({
    locale,
    sections: referenceSheet.map((s) => ({
      title: locale === 'es' ? s.titleEs : s.titleEn,
      rows: s.rows.map((r) => ({
        label: locale === 'es' ? r.labelEs : r.labelEn,
        latex: r.latex,
      })),
    })),
  });
});

export async function applyMastery(
  userId: number,
  skillId: number,
  correct: boolean,
  hintsUsed: number,
): Promise<void> {
  const existing = await query<{
    score: number; attempts_count: number; last_practiced_at: Date | null;
  }>('SELECT score, attempts_count, last_practiced_at FROM mastery WHERE user_id=$1 AND skill_id=$2', [
    userId,
    skillId,
  ]);
  const prior = existing.rowCount
    ? {
        score: existing.rows[0].score,
        attemptsCount: existing.rows[0].attempts_count,
        lastPracticedAt: existing.rows[0].last_practiced_at,
      }
    : { score: 0, attemptsCount: 0, lastPracticedAt: null };
  const updated = updateMastery(prior, correct, hintsUsed);
  await query(
    `INSERT INTO mastery(user_id, skill_id, score, attempts_count, last_practiced_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, skill_id)
     DO UPDATE SET score=$3, attempts_count=$4, last_practiced_at=$5`,
    [userId, skillId, updated.score, updated.attemptsCount, updated.lastPracticedAt],
  );
}
