import { Router } from 'express';
import { z } from 'zod';
import { rateLimit, requireAuth } from '../auth.js';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import {
  loadTutorContext,
  scrubPii,
  streamTutorReply,
  tutorAvailable,
  type ChatMessage,
} from '../tutor/service.js';

export const tutorRouter = Router();

// Design doc §8: rate-limit tutor endpoints per user; §6: LLM is the
// escalation path, so keep the budget tight.
const tutorLimiter = rateLimit(10);

tutorRouter.post('/tutor/sessions', requireAuth, tutorLimiter, async (req, res, next) => {
  try {
    const body = z
      .object({
        lessonId: z.number().optional(),
        problemId: z.number().optional(),
      })
      .parse(req.body);
    const row = await query<{ id: number }>(
      `INSERT INTO tutor_sessions(user_id, problem_id, lesson_id) VALUES ($1,$2,$3) RETURNING id`,
      [req.user!.id, body.problemId ?? null, body.lessonId ?? null],
    );
    res.status(201).json({ sessionId: row.rows[0].id, available: tutorAvailable() });
  } catch (err) {
    next(err);
  }
});

/** Student message → streamed tutor reply (SSE). */
tutorRouter.post('/tutor/sessions/:id/messages', requireAuth, tutorLimiter, async (req, res, next) => {
  try {
    const { message, stepReached } = z
      .object({ message: z.string().min(1).max(2000), stepReached: z.number().int().optional() })
      .parse(req.body);
    const sessionId = Number(req.params.id);
    const session = await query<{
      id: number; user_id: number; problem_id: number | null; lesson_id: number | null; transcript_json: ChatMessage[];
    }>('SELECT id, user_id, problem_id, lesson_id, transcript_json FROM tutor_sessions WHERE id=$1', [sessionId]);
    if (!session.rowCount || session.rows[0].user_id !== req.user!.id) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    const s = session.rows[0];
    const transcript: ChatMessage[] = Array.isArray(s.transcript_json) ? s.transcript_json : [];
    if (transcript.filter((m) => m.role === 'user').length >= config.tutorMaxTurns) {
      res.status(429).json({
        error: 'turn_limit',
        message: 'This tutor chat has reached its limit — try the step-by-step hints, or start a fresh session.',
      });
      return;
    }

    // §9: strip PII before sending to the API and before storage.
    const cleaned = scrubPii(message, req.user!.displayName);
    transcript.push({ role: 'user', content: cleaned });

    const ctx = await loadTutorContext(req.user!.locale, s.lesson_id, s.problem_id);
    if (stepReached !== undefined) ctx.studentStepReached = stepReached;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let reply = '';
    try {
      for await (const chunk of streamTutorReply(ctx, transcript)) {
        reply += chunk;
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: 'tutor_error' })}\n\n`);
      console.error('tutor stream error', err);
    }
    transcript.push({ role: 'assistant', content: reply });
    // Log transcripts for safety review (§5), PII-scrubbed.
    await query('UPDATE tutor_sessions SET transcript_json=$1 WHERE id=$2', [
      JSON.stringify(transcript),
      sessionId,
    ]);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    next(err);
  }
});
