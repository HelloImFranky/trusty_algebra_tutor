/** API client: JWT auth with refresh, plus an offline attempt queue (§6). */

export interface User {
  id: number;
  role: 'student' | 'guardian' | 'teacher';
  username: string;
  displayName: string;
  locale: 'en' | 'es';
}

interface Tokens {
  user: User;
  accessToken: string;
  refreshToken: string;
}

const LS_KEY = 'tutor.auth';
const QUEUE_KEY = 'tutor.offlineQueue';

export function getAuth(): Tokens | null {
  const raw = localStorage.getItem(LS_KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}

export function setAuth(t: Tokens | null): void {
  if (t) localStorage.setItem(LS_KEY, JSON.stringify(t));
  else localStorage.removeItem(LS_KEY);
  window.dispatchEvent(new Event('auth-changed'));
}

async function refreshTokens(): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return false;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });
  if (!res.ok) {
    setAuth(null);
    return false;
  }
  setAuth((await res.json()) as Tokens);
  return true;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const auth = getAuth();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401 && retry && auth) {
    if (await refreshTokens()) return api<T>(path, options, false);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error((body as { message?: string; error?: string }).message ?? (body as { error?: string }).error ?? `HTTP ${res.status}`), {
      status: res.status,
      body,
    });
  }
  return (await res.json()) as T;
}

/* Offline attempt queue: POSTs made while offline are stored and replayed. */
interface QueuedPost {
  path: string;
  body: unknown;
}

export async function postAttempt<T>(path: string, body: unknown): Promise<T | { queued: true }> {
  if (!navigator.onLine) {
    const q: QueuedPost[] = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    q.push({ path, body });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    return { queued: true };
  }
  return api<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function flushQueue(): Promise<void> {
  const q: QueuedPost[] = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  if (!q.length) return;
  localStorage.setItem(QUEUE_KEY, '[]');
  for (const item of q) {
    try {
      await api(item.path, { method: 'POST', body: JSON.stringify(item.body) });
    } catch {
      // re-queue on failure
      const rest: QueuedPost[] = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
      rest.push(item);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(rest));
    }
  }
}

window.addEventListener('online', () => void flushQueue());
