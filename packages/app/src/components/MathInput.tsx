/**
 * Structured math input (design doc §6): middle-school-tuned toolbar
 * (fraction, exponent, radical, ≤/≥, π) over a text field that accepts the
 * typed shortcuts the doc calls out (x^2, sqrt(), <=), with a live math
 * preview so students see their work rendered as they type. Grading always
 * normalizes through the CAS server-side — never string equality.
 */
import { useRef } from 'react';
import { TextInput } from 'react-native';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { Katex } from './Katex';
import { useI18n } from '../lib/i18n';
import { useAccent, useTokens } from './ui';

const BUTTONS: { label: string; insert: string; caret?: number }[] = [
  { label: 'x²', insert: '^2' },
  { label: 'xⁿ', insert: '^', caret: 1 },
  { label: '√', insert: 'sqrt()', caret: 5 },
  { label: 'a/b', insert: '()/()', caret: 1 },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
  { label: 'π', insert: 'pi' },
  { label: '≤', insert: '<=' },
  { label: '≥', insert: '>=' },
  { label: '=', insert: '=' },
];

/** Best-effort preview conversion of shortcut syntax to LaTeX. */
export function toPreviewTex(input: string): string {
  let s = input;
  for (let i = 0; i < 6 && /sqrt\(/.test(s); i++) {
    s = s.replace(/sqrt\(([^()]*)\)/g, '\\sqrt{$1}');
  }
  s = s.replace(/<=/g, '\\le ').replace(/>=/g, '\\ge ');
  s = s.replace(/\bpi\b/g, '\\pi ');
  s = s.replace(/\^(\d{2,}|\w)/g, '^{$1}');
  s = s.replace(/\*/g, '\\cdot ');
  return s;
}

export function MathInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const accent = useAccent();
  const tokens = useTokens();
  const ref = useRef<TextInput>(null);
  const selection = useRef({ start: value.length, end: value.length });

  const insert = (text: string, caretOffset?: number) => {
    const { start, end } = selection.current;
    const s = Math.min(start, value.length);
    const e = Math.min(end, value.length);
    onChange(value.slice(0, s) + text + value.slice(e));
    ref.current?.focus();
  };

  return (
    <YStack gap={6}>
      <XStack gap={6} flexWrap="wrap" role="toolbar" aria-label="math symbols">
        {BUTTONS.map((b) => (
          <Button
            key={b.label}
            size="$2"
            disabled={disabled}
            backgroundColor={tokens.subtle}
            color={accent}
            fontWeight="700"
            borderRadius={8}
            minWidth={40}
            onPress={() => insert(b.insert, b.caret)}
            aria-label={b.label}
          >
            {b.label}
          </Button>
        ))}
      </XStack>
      <Input
        ref={ref as never}
        value={value}
        editable={!disabled}
        placeholder={placeholder ?? t('typeMath')}
        onChangeText={onChange}
        onSelectionChange={(e) => {
          selection.current = e.nativeEvent.selection;
        }}
        onSubmitEditing={onSubmit}
        aria-label={t('yourAnswer')}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        enterKeyHint="go"
        fontSize={17}
        color={tokens.ink}
        borderColor={tokens.border}
        backgroundColor={tokens.surface}
      />
      <YStack minHeight={26} paddingHorizontal={4} aria-live="polite">
        {value ? <Katex tex={toPreviewTex(value)} /> : <Text> </Text>}
      </YStack>
    </YStack>
  );
}
