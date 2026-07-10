/**
 * Render mixed prompt text: markdown-lite (**bold**, *italic*) with $...$
 * math segments, matching how prompts are authored in the content package.
 */
import { Fragment } from 'react';
import { Text } from 'tamagui';
import { Katex } from './Katex';

export function MathText({ text, size = 15 }: { text: string; size?: number }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <Text fontSize={size} whiteSpace="pre-wrap">
      {parts.map((part, i) =>
        part.startsWith('$') && part.endsWith('$') ? (
          <Katex key={i} tex={part.slice(1, -1)} />
        ) : (
          <BoldText key={i} text={part} size={size} />
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
