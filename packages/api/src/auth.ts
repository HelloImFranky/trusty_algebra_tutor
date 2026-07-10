import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@tutor/db';
import { authConfig, jwtSecret } from './config.js';

export type Role = 'student' | 'guardian' | 'teacher';
export type Locale = 'en' | 'es';

export interface AuthUser {
  id: number;
  role: Role;
  username: string;
  displayName: string;
  locale: Locale;
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: String(user.id), role: user.role, username: user.username },
    jwtSecret(),
    { expiresIn: authConfig.accessTokenTtl } as jwt.SignOptions,
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

export async function loadUser(id: number): Promise<AuthUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: BigInt(id) },
    select: { id: true, role: true, username: true, displayName: true, locale: true },
  });
  if (!u) return null;
  return {
    id: Number(u.id),
    role: u.role as Role,
    username: u.username,
    displayName: u.displayName,
    locale: u.locale as Locale,
  };
}

export async function userFromAuthHeader(header: string | null | undefined): Promise<AuthUser | null> {
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret()) as jwt.JwtPayload;
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
