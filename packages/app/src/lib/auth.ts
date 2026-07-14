/**
 * Auth state (access token + user). On native the refresh token rides along in
 * `Tokens` and is persisted to AsyncStorage. On web the refresh token lives in
 * an httpOnly cookie the page can't read, so the access token is kept in memory
 * only and never written to storage (security review item #3).
 */
import { Platform } from 'react-native';
import { create } from 'zustand';
import type { AuthUser } from '@tutor/api';
import { storage } from './storage';

export const isWeb = Platform.OS === 'web';

export interface Tokens {
  user: AuthUser;
  accessToken: string;
  /** Native only; web keeps the refresh token in an httpOnly cookie. */
  refreshToken?: string;
}

interface AuthState {
  auth: Tokens | null;
  hydrated: boolean;
  setAuth: (t: Tokens | null) => void;
}

const KEY = 'tutor.auth';

export const useAuth = create<AuthState>((set) => ({
  auth: null,
  hydrated: false,
  setAuth: (t) => {
    set({ auth: t });
    // Web never persists tokens (access token is in-memory; refresh is a
    // cookie). Native persists the whole blob so sessions survive relaunch.
    if (isWeb) return;
    if (t) void storage.set(KEY, JSON.stringify(t));
    else void storage.remove(KEY);
  },
}));

/**
 * Load persisted tokens once at startup (native, async). Web has nothing to
 * read — it silently refreshes from the httpOnly cookie instead (see
 * `silentBootRefresh` in trpc.ts). Marks the store hydrated either way.
 */
export async function hydrateAuth(): Promise<void> {
  try {
    const raw = await storage.get(KEY);
    useAuth.setState({ auth: raw ? (JSON.parse(raw) as Tokens) : null, hydrated: true });
  } catch {
    useAuth.setState({ auth: null, hydrated: true });
  }
}

export function getAuth(): Tokens | null {
  return useAuth.getState().auth;
}

export function setAuth(t: Tokens | null): void {
  useAuth.getState().setAuth(t);
}
