import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { query } from './db/pool.js';

export type Role = 'student' | 'guardian' | 'teacher';

export interface AuthUser {
  id: number;
  role: Role;
  username: string;
  displayName: string;
  locale: 'en' | 'es';
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: String(user.id), role: user.role, username: user.username },
    config.jwtSecret,
    { expiresIn: config.accessTokenTtl } as jwt.SignOptions,
  );
}

export async function issueRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + config.refreshTokenTtlDays * 86400_000);
  await query(
    'INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
    [userId, hash, expires],
  );
  return token;
}

export async function rotateRefreshToken(token: string): Promise<AuthUser | null> {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const row = await query<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM refresh_tokens
     WHERE token_hash=$1 AND NOT revoked AND expires_at > now()`,
    [hash],
  );
  if (!row.rowCount) return null;
  await query('UPDATE refresh_tokens SET revoked=TRUE WHERE id=$1', [row.rows[0].id]);
  return loadUser(row.rows[0].user_id);
}

export async function loadUser(id: number): Promise<AuthUser | null> {
  const r = await query<{
    id: number; role: Role; username: string; display_name: string; locale: 'en' | 'es';
  }>('SELECT id, role, username, display_name, locale FROM users WHERE id=$1', [id]);
  if (!r.rowCount) return null;
  const u = r.rows[0];
  return { id: u.id, role: u.role, username: u.username, displayName: u.display_name, locale: u.locale };
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing token' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
    loadUser(Number(payload.sub))
      .then((user) => {
        if (!user) {
          res.status(401).json({ error: 'unknown user' });
          return;
        }
        req.user = user;
        next();
      })
      .catch(next);
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}

/** Simple fixed-window per-user rate limiter (design doc §8: rate-limit tutor endpoints). */
export function rateLimit(maxPerMinute: number) {
  const windows = new Map<string, { count: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.user ? String(req.user.id) : req.ip ?? 'anon';
    const now = Date.now();
    const w = windows.get(key);
    if (!w || now > w.reset) {
      windows.set(key, { count: 1, reset: now + 60_000 });
      next();
      return;
    }
    if (w.count >= maxPerMinute) {
      res.status(429).json({ error: 'rate limited, slow down' });
      return;
    }
    w.count++;
    next();
  };
}
