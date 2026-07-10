/** Auth state (JWT + refresh token), persisted across launches. */
import { create } from 'zustand';
import type { AuthUser } from '@tutor/api';
import { storage } from './storage';

export interface Tokens {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
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
    if (t) void storage.set(KEY, JSON.stringify(t));
    else void storage.remove(KEY);
  },
}));

/** Load persisted tokens once at startup (async on native). */
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
