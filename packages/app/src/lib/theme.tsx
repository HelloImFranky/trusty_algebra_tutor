/**
 * Appearance (accent color) picker: 4 hues x 4 shades, persisted client-side
 * (no server sync needed — purely cosmetic). Mirrors i18n.tsx's context +
 * storage pattern. Unset = the design's default accent (#ec3013).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { storage } from './storage';

/** Tamagui's color props require a token or a `#`-shaped literal, not a bare
 * `string` — every hex constant that flows into a color prop uses this. */
export type Hex = `#${string}`;

export const DEFAULT_ACCENT: Hex = '#ec3013';

export type ThemeHue = 'classicRed' | 'oceanBlue' | 'forestGreen' | 'grapePurple';

export const THEMES: Record<ThemeHue, { label: string; shades: readonly [Hex, Hex, Hex, Hex] }> = {
  classicRed: { label: 'Classic Red', shades: ['#ff9783', '#ff563c', '#dd2b0f', '#ae1800'] },
  oceanBlue: { label: 'Ocean Blue', shades: ['#74b9f5', '#4098ea', '#1c7ed6', '#125a9c'] },
  forestGreen: { label: 'Forest Green', shades: ['#6fd8b3', '#34c491', '#0ca678', '#087a58'] },
  grapePurple: { label: 'Grape Purple', shades: ['#d9a6e8', '#b767cf', '#9c36b5', '#75278a'] },
};

interface StoredTheme {
  hue: ThemeHue;
  shade: number;
}

const STORAGE_KEY = 'tutor.theme';

const ThemeContext = createContext<{
  accent: Hex;
  hue: ThemeHue | null;
  shade: number | null;
  setTheme: (hue: ThemeHue, shade: number) => void;
}>({ accent: DEFAULT_ACCENT, hue: null, shade: null, setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [picked, setPicked] = useState<StoredTheme | null>(null);

  useEffect(() => {
    void (async () => {
      const saved = await storage.get(STORAGE_KEY);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as StoredTheme;
        if (parsed.hue in THEMES && THEMES[parsed.hue].shades[parsed.shade]) setPicked(parsed);
      } catch {
        // ignore malformed storage
      }
    })();
  }, []);

  const setTheme = (hue: ThemeHue, shade: number) => {
    setPicked({ hue, shade });
    void storage.set(STORAGE_KEY, JSON.stringify({ hue, shade }));
  };

  const accent = picked ? THEMES[picked.hue].shades[picked.shade] : DEFAULT_ACCENT;

  return (
    <ThemeContext.Provider value={{ accent, hue: picked?.hue ?? null, shade: picked?.shade ?? null, setTheme }}>
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
