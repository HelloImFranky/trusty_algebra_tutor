import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useTokens } from './ui';

/**
 * Escape HTML so a string can be dropped into innerHTML as literal text. Used
 * only for the error fallback below — the happy path is KaTeX's own escaped
 * output.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
      // renderToString can still throw on some inputs even with
      // throwOnError:false. This component renders untrusted text (tutor/model
      // replies and the student's own chat messages via MathText), so the raw
      // string must NEVER be injected as HTML — escape it to literal text.
      return escapeHtml(tex);
    }
  }, [tex, block]);
  return <span style={{ color: tokens.ink }} dangerouslySetInnerHTML={{ __html: html }} />;
}
