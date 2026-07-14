/**
 * tRPC client wiring, shared by web and native. A splitLink routes the tutor
 * chat through httpBatchStreamLink for true streaming (web; expo/fetch on
 * native) and everything else through the plain httpBatchLink — the latter so
 * the server's Set-Cookie (the httpOnly refresh token on web) survives, which
 * streamed jsonl responses drop.
 *
 * Access tokens are short-lived; refresh is handled transparently before each
 * request when the token is close to expiry (single-flight). On web the refresh
 * token lives in an httpOnly cookie (see auth.ts); on native it's in the body.
 */
import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink, httpBatchStreamLink, splitLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@tutor/api';
import { getAuth, isWeb, setAuth, useAuth, type Tokens } from './auth';

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

/**
 * Rotate the refresh token. Web sends nothing in the body — the httpOnly cookie
 * carries it (and same-origin fetch sends the cookie automatically) — and the
 * response omits the refresh token too. Native sends/receives it in the body.
 */
async function rotate(): Promise<Tokens | null> {
  if (isWeb) return rawClient.auth.refresh.mutate({});
  const refreshToken = getAuth()?.refreshToken;
  if (!refreshToken) return null;
  return rawClient.auth.refresh.mutate({ refreshToken });
}

let refreshing: Promise<void> | null = null;

async function freshAccessToken(): Promise<string | null> {
  const auth = getAuth();
  if (!auth) return null;
  if (!tokenExpiresSoon(auth.accessToken)) return auth.accessToken;
  refreshing ??= (async () => {
    try {
      setAuth(await rotate());
    } catch {
      setAuth(null); // refresh token expired/revoked -> back to login
    } finally {
      refreshing = null;
    }
  })();
  await refreshing;
  return getAuth()?.accessToken ?? null;
}

/**
 * Web boot: no tokens are persisted, so try a silent refresh from the httpOnly
 * cookie to restore the session (a returning, still-valid user). Failure just
 * lands on the login screen. Marks the store hydrated when done.
 */
export async function silentBootRefresh(): Promise<void> {
  try {
    setAuth(await rotate());
  } catch {
    setAuth(null);
  } finally {
    useAuth.setState({ hydrated: true });
  }
}

/**
 * Sign out: revoke the refresh token server-side (and, on web, clear the
 * cookie) before dropping local state. Best-effort — local state is cleared
 * even if the network call fails.
 */
export async function logout(): Promise<void> {
  const refreshToken = getAuth()?.refreshToken;
  try {
    await rawClient.auth.logout.mutate(isWeb ? {} : { refreshToken });
  } catch {
    // ignore — clear locally regardless
  }
  setAuth(null);
}

function makeLinks(withAuth: boolean) {
  const opts = {
    url: `${getBaseUrl()}/api/trpc`,
    transformer: superjson,
    async headers() {
      // Web asks the server to keep the refresh token in an httpOnly cookie.
      const base = isWeb ? { 'x-auth-transport': 'cookie' } : {};
      if (!withAuth) return base;
      const token = await freshAccessToken();
      return token ? { ...base, authorization: `Bearer ${token}` } : base;
    },
  };
  return [
    // Only the tutor chat truly streams. Everything else goes over the plain
    // batched transport: httpBatchStreamLink sends jsonl responses, and the
    // fetch adapter drops `responseMeta` headers (our Set-Cookie for the
    // httpOnly refresh token) on those — so auth must not be streamed.
    splitLink({
      condition: (op) => op.path === 'tutor.sendMessage',
      true: httpBatchStreamLink(opts),
      false: httpBatchLink(opts),
    }),
  ];
}

/** Bare client used for token refresh itself (no auth header, no recursion). */
const rawClient = createTRPCClient<AppRouter>({ links: makeLinks(false) });

/** Vanilla client for imperative calls (streaming chat, offline queue). */
export const client = createTRPCClient<AppRouter>({ links: makeLinks(true) });

export const trpcClientOptions = { links: makeLinks(true) };
