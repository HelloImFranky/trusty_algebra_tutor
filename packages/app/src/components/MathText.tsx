/**
 * Render mixed prompt text: markdown-lite (**bold**, *italic*) with $...$
 * math segments, matching how prompts are authored in the content package.
 * Color explicitly follows tokens.ink so quiz / practice / lesson prompts
 * are legible in dark mode — Tamagui's Text default falls through to its
 * built-in light-theme text color, which reads as unreadable dark-gray on
 * a dark surface. Katex output uses CSS `color: inherit` so setting the
 * color on the wrapping Text carries into the rendered math.
 *
 * `\$` escapes a literal dollar sign so it doesn't open/close a math span
 * — this matters for prose like "burger costs \$17. drink costs \$10"
 * where two unescaped `$`s would drag the middle sentence into math mode
 * (rendered as italic run-together identifiers). Same pattern as the
 * `\*` escape used by ItalicText below.
 */
import { Fragment } from 'react';
import { Text } from 'tamagui';
import { Katex } from './Katex';
import { useTokens } from './ui';

const unescapeDollar = (s: string) => s.replace(/\\\$/g, '$');

export function MathText({ text, size = 15 }: { text: string; size?: number }) {
  const tokens = useTokens();
  const parts = text.split(/((?<!\\)\$[^$]+(?<!\\)\$)/g);
  return (
    <Text fontSize={size} color={tokens.ink} whiteSpace="pre-wrap">
      {parts.map((part, i) =>
        part.startsWith('$') && part.endsWith('$') ? (
          <Katex key={i} tex={part.slice(1, -1)} />
        ) : (
          <BoldText key={i} text={unescapeDollar(part)} size={size} />
        ),
      )}
    </Text>
  );
}

function BoldText({ text, size }: { text: string; size: number }) {
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*)/g);
  return (
    <Fragment>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} fontSize={size} fontWeight="800">
            <ItalicText text={p.slice(2, -2)} size={size} />
          </Text>
        ) : (
          <ItalicText key={i} text={p} size={size} />
        ),
      )}
    </Fragment>
  );
}

function ItalicText({ text, size }: { text: string; size: number }) {
  // split on *italic* runs; `\*` is an escaped literal asterisk
  const parts = text.split(/((?<!\\)\*[^*]+(?<!\\)\*)/g);
  return (
    <Fragment>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <Text key={i} fontSize={size} fontStyle="italic">
            {p.slice(1, -1).replace(/\\\*/g, '*')}
          </Text>
        ) : (
          <Fragment key={i}>{p.replace(/\\\*/g, '*')}</Fragment>
        ),
      )}
    </Fragment>
  );
}
