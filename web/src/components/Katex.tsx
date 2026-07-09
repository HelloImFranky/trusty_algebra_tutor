import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Render a LaTeX string. */
export function Katex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: block, throwOnError: false });
    } catch {
      return tex;
    }
  }, [tex, block]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Render mixed prompt text: markdown-lite (**bold**) with $...$ math segments,
 * matching how prompts are authored in the content package.
 */
export function MathText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\$[^$]+\$)/g), [text]);
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) =>
        part.startsWith('$') && part.endsWith('$') ? (
          <Katex key={i} tex={part.slice(1, -1)} />
        ) : (
          <BoldText key={i} text={part} />
        ),
      )}
    </span>
  );
}

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i}>
            <ItalicText text={p.slice(2, -2)} />
          </strong>
        ) : (
          <ItalicText key={i} text={p} />
        ),
      )}
    </>
  );
}

function ItalicText({ text }: { text: string }) {
  // split on *italic* runs; `\*` is an escaped literal asterisk
  const parts = text.split(/((?<!\\)\*[^*]+(?<!\\)\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1).replace(/\\\*/g, '*')}</em>
        ) : (
          p.replace(/\\\*/g, '*')
        ),
      )}
    </>
  );
}
