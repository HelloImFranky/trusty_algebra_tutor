import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@tutor/db';
import { authConfig, jwtSecret } from './config.js';

export type Role = 'student' | 'guardian' | 'teacher' | 'admin';
export type Locale = 'en' | 'es';
export type AccountStatus = 'active' | 'pending' | 'disabled';

export interface AuthUser {
  id: number;
  role: Role;
  username: string;
  displayName: string;
  locale: Locale;
  status: AccountStatus;
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: String(user.id), role: user.role, username: user.username },
    jwtSecret(),
    { expiresIn: authConfig.accessTokenTtl, algorithm: 'HS256' } as jwt.SignOptions,
  );
}

export async function issueRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = new Date(Date.now() + authConfig.refreshTokenTtlDays * 86400_000);
  await prisma.refreshToken.create({
    data: { userId: BigInt(userId), tokenHash: hash, expiresAt: expires },
  });
  return token;
}

export async function rotateRefreshToken(token: string): Promise<AuthUser | null> {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const row = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, revoked: false, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  if (!row) return null;
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revoked: true } });
  return loadUser(Number(row.userId));
}

/**
 * Revoke a refresh token server-side (logout). Idempotent: an unknown or
 * already-revoked token is a no-op. Fixes the prior client-only logout, which
 * left the DB token valid until it expired.
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revoked: false },
    data: { revoked: true },
  });
}

/**
 * Revoke every active refresh token for a user. Used after a password change so
 * any other logged-in session (a shared or stolen device) is forced to
 * re-authenticate; the caller then issues a fresh token for the current device.
 */
export async function revokeAllUserTokens(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId: BigInt(userId), revoked: false },
    data: { revoked: true },
  });
}

export async function loadUser(id: number): Promise<AuthUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, role: true, username: true, displayName: true, locale: true, status: true },
  });
  if (!u) return null;
  return {
    id: Number(u.id),
    role: u.role as Role,
    username: u.username,
    displayName: u.displayName,
    locale: u.locale as Locale,
    status: u.status as AccountStatus,
  };
}

export async function userFromAuthHeader(header: string | null | undefined): Promise<AuthUser | null> {
  if (!header?.startsWith('Bearer ')) return null;
  try {
    // Pin the algorithm: never let a token's own header pick it (defends
    // against alg-confusion / "alg: none" forgeries).
    const payload = jwt.verify(header.slice(7), jwtSecret(), {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;
    return await loadUser(Number(payload.sub));
  } catch {
    return null;
  }
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

// A bcrypt compare against a throwaway hash, used when a login names an
// unknown user so the response takes the same time as a wrong password —
// otherwise the timing difference reveals which usernames exist.
let dummyHash: string | null = null;
export async function equalizeLoginTiming(pw: string): Promise<void> {
  dummyHash ??= await hashPassword('unused-timing-equalizer');
  await verifyPassword(pw, dummyHash);
}
