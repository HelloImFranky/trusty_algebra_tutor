import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useTokens } from './ui';

/**
 * Render a LaTeX string (web: real KaTeX). Wraps the rendered HTML in a
 * span with an explicit `color: tokens.ink` so KaTeX (which uses
 * `currentColor`) inherits the theme-aware ink even in cases where the
 * parent Tamagui Text's color wouldn't cascade — notably block worked
 * examples in the lesson player, where the Katex sits directly under a
 * YStack (no Text wrapper) and inherited black on dark bg.
 */
export function Katex({ tex, block = false }: { tex: string; block?: boolean }) {
  const tokens = useTokens();
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: block, throwOnError: false });
    } catch {
      return tex;
    }
  }, [tex, block]);
  return <span style={{ color: tokens.ink }} dangerouslySetInnerHTML={{ __html: html }} />;
}
