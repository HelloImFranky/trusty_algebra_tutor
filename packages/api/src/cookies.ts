/**
 * httpOnly refresh-token cookie (security review item #3).
 *
 * On web the refresh token lives in this cookie instead of localStorage, so an
 * XSS bug can't read a 7-day credential. The cookie is scoped to the tRPC path
 * and `SameSite=Strict`, which also closes the CSRF surface a cookie-borne
 * refresh would otherwise open. Native never uses this — it keeps the refresh
 * token in the response body + AsyncStorage (not reachable by page script).
 */
import { authConfig } from './config.js';

export const REFRESH_COOKIE = 'tutor_rt';

// Path-scoped to the API so the cookie only ever rides refresh requests.
const COOKIE_PATH = '/api/trpc';

function serialize(value: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [
    `${REFRESH_COOKIE}=${value}`,
    'HttpOnly',
    'SameSite=Strict',
    `Path=${COOKIE_PATH}`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  // Secure can't be set over plain http (localhost dev), or the browser drops
  // the cookie entirely. Prod is always https behind the proxy.
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** `Set-Cookie` value that stores the refresh token for its full TTL. */
export function setRefreshCookie(token: string, secure: boolean): string {
  return serialize(token, authConfig.refreshTokenTtlDays * 86400, secure);
}

/** `Set-Cookie` value that expires the refresh cookie immediately (logout). */
export function clearRefreshCookie(secure: boolean): string {
  return serialize('', 0, secure);
}

/** Read a single cookie value out of a `Cookie` request header. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null;
  }
  return null;
}
