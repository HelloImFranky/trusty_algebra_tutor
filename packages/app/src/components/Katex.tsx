/**
 * Native fallback for KaTeX: convert common middle-school LaTeX to readable
 * unicode text (fractions, radicals, exponents, ≤/≥, π). Web resolves
 * Katex.web.tsx instead and renders real KaTeX.
 */
import { Text } from 'react-native';

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '-': '⁻', 'n': 'ⁿ', 'x': 'ˣ',
};

export function latexToUnicode(tex: string): string {
  let s = tex;
  for (let i = 0; i < 6 && /\\frac/.test(s); i++) {
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) =>
      a.length === 1 && b.length === 1 ? `${a}/${b}` : `(${a})/(${b})`,
    );
  }
  for (let i = 0; i < 6 && /\\sqrt/.test(s); i++) {
    s = s.replace(/\\sqrt\[3\]\{([^{}]*)\}/g, '∛($1)');
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  }
  s = s.replace(/\^\{([^{}]+)\}/g, (_m, exp: string) => {
    const sup = [...exp].map((c) => SUP[c] ?? null);
    return sup.every(Boolean) ? sup.join('') : `^(${exp})`;
  });
  s = s.replace(/\^(\w)/g, (_m, c: string) => SUP[c] ?? `^${c}`);
  s = s
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\le(?:q)?\b/g, '≤')
    .replace(/\\ge(?:q)?\b/g, '≥')
    .replace(/\\ne(?:q)?\b/g, '≠')
    .replace(/\\pm\b/g, '±')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\left|\\right/g, '')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\,|\\;|\\ /g, ' ')
    .replace(/[{}]/g, '');
  return s.trim();
}

export function Katex({ tex, block = false }: { tex: string; block?: boolean }) {
  return (
    <Text
      style={{
        fontFamily: 'monospace',
        fontSize: block ? 18 : 15,
        textAlign: block ? 'center' : undefined,
      }}
    >
      {latexToUnicode(tex)}
    </Text>
  );
}
