import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
 * Block worked answer that never overflows its card. A long expression is
 * scaled down (not wrapped) until it fits the available width, so it stays
 * on one line and inside the background box instead of running past the
 * edge. Content that already fits renders at full size (scale 1).
 */
function FitBlockKatex({ html, color }: { html: string; color: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ scale: number; height: number }>({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const fit = () => {
      // Measure at natural size first, then compute the shrink ratio.
      inner.style.transform = 'scale(1)';
      const avail = outer.clientWidth;
      const natural = inner.scrollWidth;
      const naturalH = inner.offsetHeight;
      const scale = natural > avail && natural > 0 ? avail / natural : 1;
      setBox({ scale, height: naturalH * scale });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [html]);

  return (
    <div ref={outerRef} style={{ width: '100%', overflow: 'hidden', height: box.height || undefined }}>
      <div
        ref={innerRef}
        style={{
          color,
          display: 'inline-block',
          whiteSpace: 'nowrap',
          transform: `scale(${box.scale})`,
          transformOrigin: 'left top',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/**
 * Render a LaTeX string (web: real KaTeX). Wraps the rendered HTML in a
 * span with an explicit `color: tokens.ink` so KaTeX (which uses
 * `currentColor`) inherits the theme-aware ink even in cases where the
 * parent Tamagui Text's color wouldn't cascade — notably block worked
 * examples in the lesson player, where the Katex sits directly under a
 * YStack (no Text wrapper) and inherited black on dark bg.
 *
 * Block mode additionally auto-fits: a worked answer wider than its card is
 * scaled down to fit rather than overflowing the background it sits in.
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
  if (block) return <FitBlockKatex html={html} color={tokens.ink} />;
  return <span style={{ color: tokens.ink }} dangerouslySetInnerHTML={{ __html: html }} />;
}
