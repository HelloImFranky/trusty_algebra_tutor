/**
 * Appearance (accent color) picker: any color via a saturation/hue picker
 * (see screens/appearance.tsx), persisted client-side (no server sync needed
 * — purely cosmetic) along with a short history of recently-applied colors.
 * Mirrors i18n.tsx's context + storage pattern. Unset = the design's default
 * accent (#ec3013).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { storage } from './storage';

/** Tamagui's color props require a token or a `#`-shaped literal, not a bare
 * `string` — every hex constant that flows into a color prop uses this. */
export type Hex = `#${string}`;

export const DEFAULT_ACCENT: Hex = '#ec3013';

const ACCENT_KEY = 'tutor.theme.accent';
const RECENT_KEY = 'tutor.theme.recentColors';
const MAX_RECENT = 8;
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

const ThemeContext = createContext<{
  accent: Hex;
  recentColors: Hex[];
  setAccent: (hex: Hex) => void;
}>({ accent: DEFAULT_ACCENT, recentColors: [], setAccent: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<Hex>(DEFAULT_ACCENT);
  const [recentColors, setRecentColors] = useState<Hex[]>([]);

  useEffect(() => {
    void (async () => {
      const savedAccent = await storage.get(ACCENT_KEY);
      if (savedAccent && HEX_RE.test(savedAccent)) setAccentState(savedAccent as Hex);
      const savedRecent = await storage.get(RECENT_KEY);
      if (!savedRecent) return;
      try {
        const parsed: unknown = JSON.parse(savedRecent);
        if (Array.isArray(parsed)) {
          setRecentColors(parsed.filter((c): c is Hex => typeof c === 'string' && HEX_RE.test(c)));
        }
      } catch {
        // ignore malformed storage
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

  return (
    <ThemeContext.Provider value={{ accent, recentColors, setAccent }}>
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
