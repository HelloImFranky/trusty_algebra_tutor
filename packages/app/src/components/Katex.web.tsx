import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Render a LaTeX string (web: real KaTeX). */
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
