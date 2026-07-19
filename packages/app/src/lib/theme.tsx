/**
 * Appearance context: the pickable accent color (any hex, see
 * screens/appearance.tsx) plus the light/dark mode ('light', 'dark', or 'auto'
 * — 'auto' follows the OS/browser via useColorScheme). Both are persisted
 * client-side; nothing about appearance is server-synced. Mirrors i18n.tsx's
 * context + storage pattern. Unset accent = the design's default accent
 * (#1e88e5, a friendly light blue); unset mode = 'auto'.
 *
 * The pre-hydration script in apps/web/app/layout.tsx reads the same
 * storage key ('tutor.theme.mode') to stamp `data-theme` on <html> before
 * hydration — keep the key/value contract in sync.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from './storage';

/** Tamagui's color props require a token or a `#`-shaped literal, not a bare
 * `string` — every hex constant that flows into a color prop uses this. */
export type Hex = `#${string}`;

/** Light blue — friendlier default than the original brand red. Chosen as
 * the lightest blue that keeps white on-accent text (PrimaryButton labels,
 * selected chips) and accent text on the page background readable in both
 * modes. Users who saved a custom accent are unaffected. */
export const DEFAULT_ACCENT: Hex = '#1e88e5';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedThemeMode = 'light' | 'dark';

const ACCENT_KEY = 'tutor.theme.accent';
const RECENT_KEY = 'tutor.theme.recentColors';
const MODE_KEY = 'tutor.theme.mode';
const MAX_RECENT = 8;
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

const ThemeContext = createContext<{
  accent: Hex;
  recentColors: Hex[];
  setAccent: (hex: Hex) => void;
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (m: ThemeMode) => void;
}>({
  accent: DEFAULT_ACCENT,
  recentColors: [],
  setAccent: () => {},
  mode: 'auto',
  resolvedMode: 'light',
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<Hex>(DEFAULT_ACCENT);
  const [recentColors, setRecentColors] = useState<Hex[]>([]);
  const [mode, setModeState] = useState<ThemeMode>('auto');
  const osScheme = useColorScheme(); // 'light' | 'dark' | null

  useEffect(() => {
    void (async () => {
      const savedAccent = await storage.get(ACCENT_KEY);
      if (savedAccent && HEX_RE.test(savedAccent)) setAccentState(savedAccent as Hex);
      const savedRecent = await storage.get(RECENT_KEY);
      if (savedRecent) {
        try {
          const parsed: unknown = JSON.parse(savedRecent);
          if (Array.isArray(parsed)) {
            setRecentColors(parsed.filter((c): c is Hex => typeof c === 'string' && HEX_RE.test(c)));
          }
        } catch {
          // ignore malformed storage
        }
      }
      const savedMode = await storage.get(MODE_KEY);
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'auto') {
        setModeState(savedMode);
      }
    })();
  }, []);

  /** Applies a color as the live accent and files it under "recently used"
   * (most-recent-first, deduped, capped). Called on an explicit commit —
   * e.g. a swatch tap or the picker's Save button — not on every drag frame,
   * so the history stays a short, meaningful list. */
  const setAccent = (hex: Hex) => {
    setAccentState(hex);
    void storage.set(ACCENT_KEY, hex);
    setRecentColors((prev) => {
      const next = [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, MAX_RECENT);
      void storage.set(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    void storage.set(MODE_KEY, m);
    // Web: keep the <html data-theme> attribute in sync so the CSS body
    // background and native scrollbars follow the picker immediately.
    if (typeof document !== 'undefined') {
      const resolved = m === 'auto'
        ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : m;
      document.documentElement.setAttribute('data-theme', resolved);
    }
  };

  const resolvedMode: ResolvedThemeMode = useMemo(() => {
    if (mode === 'light' || mode === 'dark') return mode;
    return osScheme === 'dark' ? 'dark' : 'light';
  }, [mode, osScheme]);

  return (
    <ThemeContext.Provider
      value={{ accent, recentColors, setAccent, mode, resolvedMode, setMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Convenience for components that only need the current accent hex. */
export function useAccent() {
  return useContext(ThemeContext).accent;
}

/** Convenience for components that only need the resolved light/dark mode. */
export function useResolvedMode() {
  return useContext(ThemeContext).resolvedMode;
}
