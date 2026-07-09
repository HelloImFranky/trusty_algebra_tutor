import { Router } from 'express';
import { z } from 'zod';
import {
  hashPassword,
  issueRefreshToken,
  loadUser,
  requireAuth,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
  type AuthUser,
} from '../auth.js';
import { query } from '../db/pool.js';

export const authRouter = Router();

const registerSchema = z.object({
  role: z.enum(['student', 'guardian', 'teacher']).default('student'),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64),
  locale: z.enum(['en', 'es']).default('en'),
  grade: z.number().int().min(5).max(12).optional(),
  // COPPA (§9): students don't provide an email. Under-13 self-signup needs a
  // guardian email that we use to create/link a guardian consent record.
  email: z.string().email().optional(),
  guardianEmail: z.string().email().optional(),
  under13: z.boolean().default(false),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    if (body.role === 'student' && body.email) {
      res.status(400).json({ error: 'students must not register an email (COPPA)' });
      return;
    }
    if (body.role === 'student' && body.under13 && !body.guardianEmail) {
      res.status(400).json({
        error: 'guardian_consent_required',
        message: 'Students under 13 need a parent or guardian email to sign up.',
      });
      return;
    }
    const exists = await query('SELECT 1 FROM users WHERE username=$1', [body.username]);
    if (exists.rowCount) {
      res.status(409).json({ error: 'username taken' });
      return;
    }
    const hash = await hashPassword(body.password);
    const row = await query<{ id: number }>(
      `INSERT INTO users(role, username, password_hash, display_name, locale, grade, email, guardian_consent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        body.role,
        body.username,
        hash,
        body.displayName,
        body.locale,
        body.grade ?? null,
        body.role === 'student' ? null : body.email ?? null,
        // guardian email supplied → consent flow initiated; real deployments
        // verify by email before flipping this on.
        body.role !== 'student' || !body.under13 || Boolean(body.guardianEmail),
      ],
    );
    const userId = row.rows[0].id;
    // Guardian self-signup with a linked student comes later via guardian_links.
    if (body.role === 'student' && body.guardianEmail) {
      const guardian = await query<{ id: number }>(
        `SELECT id FROM users WHERE role='guardian' AND email=$1`,
        [body.guardianEmail],
      );
      if (guardian.rowCount) {
        await query(
          `INSERT INTO guardian_links(guardian_user_id, student_user_id, status)
           VALUES ($1,$2,'active') ON CONFLICT DO NOTHING`,
          [guardian.rows[0].id, userId],
        );
      }
    }
    const user = (await loadUser(userId)) as AuthUser;
    res.status(201).json(await tokensFor(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = z
      .object({ username: z.string(), password: z.string() })
      .parse(req.body);
    const row = await query<{ id: number; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE username=$1',
      [username],
    );
    if (!row.rowCount || !(await verifyPassword(password, row.rows[0].password_hash))) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }
    const user = (await loadUser(row.rows[0].id)) as AuthUser;
    res.json(await tokensFor(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const user = await rotateRefreshToken(refreshToken);
    if (!user) {
      res.status(401).json({ error: 'invalid refresh token' });
      return;
    }
    res.json(await tokensFor(user));
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.patch('/me/locale', requireAuth, async (req, res, next) => {
  try {
    const { locale } = z.object({ locale: z.enum(['en', 'es']) }).parse(req.body);
    await query('UPDATE users SET locale=$1 WHERE id=$2', [locale, req.user!.id]);
    res.json({ ok: true, locale });
  } catch (err) {
    next(err);
  }
});

async function tokensFor(user: AuthUser) {
  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
  };
}
