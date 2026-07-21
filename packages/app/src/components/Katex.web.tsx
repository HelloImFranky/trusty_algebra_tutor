import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
 * Top-level relation operators. A long equation is broken *before* one of
 * these so the relation leads the next line — the way you'd write the next
 * step underneath the previous one. Longest first so `\leq` matches before
 * `\le` (and `\left`/`\right` are never mistaken for `\le`/`\ge`).
 */
const RELATIONS = ['\\leq', '\\geq', '\\neq', '\\approx', '\\le', '\\ge', '\\ne', '\\lt', '\\gt'];

/**
 * Split a LaTeX string into wrap units at its **outermost** relation operators
 * (=, <, >, ≤, ≥, …), keeping each relation attached to the side that follows
 * it. `2x + 5 = 4x - 3` → `['2x + 5 ', '= 4x - 3']`. Relations nested inside
 * braces (a `\frac`, a `\text{…}`) stay put, so only the equation's own
 * relation is a break point. A string with no top-level relation comes back as
 * a single unit and wraps normally at its operators instead.
 */
function splitAtRelations(tex: string): string[] {
  const units: string[] = [];
  let depth = 0;
  let cur = '';
  const flush = () => {
    if (cur.trim()) units.push(cur);
    cur = '';
  };
  for (let i = 0; i < tex.length; ) {
    const c = tex[i];
    if (c === '{') {
      depth++;
      cur += c;
      i++;
      continue;
    }
    if (c === '}') {
      depth--;
      cur += c;
      i++;
      continue;
    }
    if (depth === 0) {
      // `\le`, `\ge`, … — only when the next char isn't a letter, so `\left`
      // and `\leq`-vs-`\le` are matched correctly (RELATIONS is longest-first).
      const macro = RELATIONS.find(
        (r) => tex.startsWith(r, i) && !/[a-zA-Z]/.test(tex[i + r.length] ?? ''),
      );
      if (macro) {
        flush();
        cur = macro;
        i += macro.length;
        continue;
      }
      // Bare relations — but not the `<`/`>` that delimit a `\left<…\right>`.
      if ((c === '=' || c === '<' || c === '>') && !/\\(left|right)$/.test(cur)) {
        flush();
        cur = c;
        i++;
        continue;
      }
    }
    cur += c;
    i++;
  }
  flush();
  return units.length > 0 ? units : [tex];
}

function renderTex(tex: string, block: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: block, throwOnError: false });
  } catch {
    // See the note in Katex() below — untrusted text must never reach innerHTML.
    return escapeHtml(tex);
  }
}

/**
 * Inline prompt math that wraps instead of overflowing its card. A long
 * equation breaks at its relation onto a new line (each side stays intact);
 * an expression with no relation wraps at its operators. Anything still too
 * wide to break — a single long radical or fraction — is scaled down to fit,
 * the same never-overflow guarantee FitBlockKatex gives block math.
 */
function FitInlineKatex({ tex, color }: { tex: string; color: string }) {
  const units = useMemo(() => splitAtRelations(tex), [tex]);
  const htmls = useMemo(() => units.map((u) => renderTex(u, false)), [units]);
  const multi = units.length > 1;
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<{ scale: number; height: number }>({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const fit = () => {
      inner.style.transform = 'scale(1)';
      // scrollWidth after wrapping is the widest line that still can't break;
      // if it beats the available width, shrink everything to fit.
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
  }, [tex]);

  return (
    <span
      ref={outerRef}
      style={{
        display: 'inline-block',
        maxWidth: '100%',
        verticalAlign: 'baseline',
        overflow: 'hidden',
        height: box.scale < 1 && box.height ? box.height : undefined,
      }}
    >
      <span
        ref={innerRef}
        style={{
          color,
          display: 'inline-block',
          whiteSpace: 'normal',
          transform: `scale(${box.scale})`,
          transformOrigin: 'left top',
        }}
      >
        {htmls.map((h, i) => (
          <Fragment key={i}>
            {/* zero-width space: a wrap point between sides without a visible gap */}
            {i > 0 ? '​' : null}
            <span
              // Each side of an equation is its own no-wrap block, so a break
              // only ever lands at the relation, never mid-side. The relation
              // gets its usual spacing (and a hanging indent once wrapped).
              style={
                multi
                  ? {
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      marginLeft: i > 0 ? '0.28em' : undefined,
                    }
                  : undefined
              }
              dangerouslySetInnerHTML={{ __html: h }}
            />
          </Fragment>
        ))}
      </span>
    </span>
  );
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
    // textAlign centers the inline-block child, and scaling from the top
    // center keeps it centered whether it renders at full size or is shrunk
    // to fit — matching KaTeX's default display-mode centering.
    <div
      ref={outerRef}
      style={{ width: '100%', overflow: 'hidden', height: box.height || undefined, textAlign: 'center' }}
    >
      <div
        ref={innerRef}
        style={{
          color,
          display: 'inline-block',
          whiteSpace: 'nowrap',
          transform: `scale(${box.scale})`,
          transformOrigin: 'top center',
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
 * Block mode auto-fits: a worked answer wider than its card is scaled down to
 * fit rather than overflowing the background it sits in. Inline mode wraps a
 * long equation at its relation onto a new line (FitInlineKatex) so working
 * problems never run past the card edge.
 */
export function Katex({ tex, block = false }: { tex: string; block?: boolean }) {
  const tokens = useTokens();
  if (block) {
    // renderToString can still throw on some inputs even with
    // throwOnError:false. This component renders untrusted text (tutor/model
    // replies and the student's own chat messages via MathText), so the raw
    // string must NEVER be injected as HTML — escape it to literal text.
    const html = renderTex(tex, true);
    return <FitBlockKatex html={html} color={tokens.ink} />;
  }
  return <FitInlineKatex tex={tex} color={tokens.ink} />;
}
