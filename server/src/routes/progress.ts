import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { query } from '../db/pool.js';
import { decayedScore, masteryLabel } from '../mastery.js';

export const progressRouter = Router();

async function buildProgress(userId: number) {
  const mastery = await query<{
    skill_id: number; score: number; attempts_count: number; last_practiced_at: Date | null;
    name_en: string; lesson_code: string; unit_number: number;
  }>(`SELECT m.skill_id, m.score, m.attempts_count, m.last_practiced_at,
             s.name_en, l.code AS lesson_code, u.number AS unit_number
      FROM mastery m
      JOIN skills s ON s.id = m.skill_id
      JOIN lessons l ON l.id = s.lesson_id
      JOIN units u ON u.id = l.unit_id
      WHERE m.user_id=$1
      ORDER BY u.number, l.code`, [userId]);

  const etResults = await query<{
    score: number; max_score: number; created_at: Date; lesson_code: string;
  }>(`SELECT r.score, r.max_score, r.created_at, l.code AS lesson_code
      FROM exit_ticket_results r
      JOIN exit_tickets e ON e.id = r.exit_ticket_id
      JOIN lessons l ON l.id = e.lesson_id
      WHERE r.user_id=$1
      ORDER BY r.created_at DESC LIMIT 20`, [userId]);

  const activity = await query<{ day: string; attempts: number; correct: number; minutes: number }>(
    `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day,
            count(*)::int AS attempts,
            count(*) FILTER (WHERE correct)::int AS correct,
            coalesce(round(sum(duration_ms)/60000.0, 1), 0) AS minutes
     FROM attempts WHERE user_id=$1 AND created_at > now() - interval '30 days'
     GROUP BY 1 ORDER BY 1`,
    [userId],
  );

  // Streak: consecutive days (ending today or yesterday) with any attempt.
  const days = new Set(activity.rows.map((a) => a.day));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const skills = mastery.rows.map((m) => {
    const score = decayedScore({
      score: m.score,
      attemptsCount: m.attempts_count,
      lastPracticedAt: m.last_practiced_at,
    });
    return {
      skillId: m.skill_id,
      name: m.name_en,
      lessonCode: m.lesson_code,
      unitNumber: m.unit_number,
      score: Math.round(score * 100) / 100,
      attempts: m.attempts_count,
      label: masteryLabel(score, m.attempts_count),
    };
  });

  return {
    streakDays: streak,
    skills,
    struggleFlags: skills.filter((s) => s.label === 'struggling'),
    exitTickets: etResults.rows.map((r) => ({
      lessonCode: r.lesson_code,
      score: r.score,
      maxScore: r.max_score,
      at: r.created_at,
    })),
    activity: activity.rows,
  };
}

progressRouter.get('/progress/me', requireAuth, async (req, res, next) => {
  try {
    res.json(await buildProgress(req.user!.id));
  } catch (err) {
    next(err);
  }
});

/** Guardian/teacher view (§4.6): read-only, scoped to linked students (FERPA §9). */
progressRouter.get('/progress/:studentId', requireAuth, async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId);
    if (req.user!.role === 'student') {
      if (req.user!.id !== studentId) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
    } else {
      const link = await query(
        `SELECT 1 FROM guardian_links WHERE guardian_user_id=$1 AND student_user_id=$2 AND status='active'`,
        [req.user!.id, studentId],
      );
      if (!link.rowCount && req.user!.role !== 'teacher') {
        res.status(403).json({ error: 'not linked to this student' });
        return;
      }
    }
    const student = await query<{ display_name: string; grade: number | null }>(
      `SELECT display_name, grade FROM users WHERE id=$1 AND role='student'`,
      [studentId],
    );
    if (!student.rowCount) {
      res.status(404).json({ error: 'student not found' });
      return;
    }
    res.json({
      student: { id: studentId, displayName: student.rows[0].display_name, grade: student.rows[0].grade },
      ...(await buildProgress(studentId)),
    });
  } catch (err) {
    next(err);
  }
});

/** FERPA (§9): data export for the student's own records. */
progressRouter.get('/progress/me/export', requireAuth, async (req, res, next) => {
  try {
    const attempts = await query(
      'SELECT problem_id, submitted_latex, correct, hints_used, step_reached, duration_ms, context, created_at FROM attempts WHERE user_id=$1 ORDER BY created_at',
      [req.user!.id],
    );
    res.setHeader('Content-Disposition', 'attachment; filename="my-progress.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      user: req.user,
      progress: await buildProgress(req.user!.id),
      attempts: attempts.rows,
    });
  } catch (err) {
    next(err);
  }
});

/** FERPA (§9): account + data deletion. */
progressRouter.delete('/account/me', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM users WHERE id=$1', [req.user!.id]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
