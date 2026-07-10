/**
 * tRPC client wiring, shared by web and native. httpBatchStreamLink gives the
 * tutor chat true streaming where the runtime supports it (web; expo/fetch on
 * native) and graceful buffering where it doesn't.
 *
 * Access tokens are short-lived; refresh is handled transparently before each
 * request when the token is close to expiry (single-flight).
 */
import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@tutor/api';
import { getAuth, setAuth } from './auth';

export const trpc = createTRPCReact<AppRouter>();

/** Native overrides this via EXPO_PUBLIC_API_URL; web is same-origin. */
export function getBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  return '';
}

function tokenExpiresSoon(token: string): boolean {
  try {
    const payload = JSON.parse(
      // base64url -> JSON (atob is available in browsers, RN Hermes, and Node 20+)
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 - Date.now() < 60_000;
  } catch {
    return false;
  }
}

let refreshing: Promise<void> | null = null;

async function freshAccessToken(): Promise<string | null> {
  const auth = getAuth();
  if (!auth) return null;
  if (!tokenExpiresSoon(auth.accessToken)) return auth.accessToken;
  refreshing ??= (async () => {
    try {
      const refreshed = await rawClient.auth.refresh.mutate({ refreshToken: auth.refreshToken });
      setAuth(refreshed);
    } catch {
      setAuth(null); // refresh token expired/revoked -> back to login
    } finally {
      refreshing = null;
    }
  })();
  await refreshing;
  return getAuth()?.accessToken ?? null;
}

function makeLinks(withAuth: boolean) {
  return [
    httpBatchStreamLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        if (!withAuth) return {};
        const token = await freshAccessToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ];
}

/** Bare client used for token refresh itself (no auth header, no recursion). */
const rawClient = createTRPCClient<AppRouter>({ links: makeLinks(false) });

/** Vanilla client for imperative calls (streaming chat, offline queue). */
export const client = createTRPCClient<AppRouter>({ links: makeLinks(true) });

export const trpcClientOptions = { links: makeLinks(true) };
