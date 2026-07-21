/**
 * Structured math input (design doc §6). Two modes:
 *
 * - Default (`keypad` off): a middle-school-tuned symbol toolbar over a text
 *   field that accepts the typed shortcuts the doc calls out (x^2, sqrt(),
 *   <=), with a live math preview.
 * - Keypad (`keypad` set): a dedicated, per-problem on-screen pad (see
 *   MathKeypad) — 'numeric' for bare-number answers, 'algebra' for
 *   expressions/equations. The OS soft keyboard is suppressed so students
 *   press keys instead of typing free text on the alphabetical keyboard.
 *
 * Grading always normalizes through the CAS server-side — never string
 * equality — so `/` for ÷, `^` for powers, juxtaposition for × etc. all
 * grade fine.
 */
import { useRef } from 'react';
import { TextInput } from 'react-native';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { Katex } from './Katex';
import { MathKeypad, type KeypadKind } from './MathKeypad';
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
  keypad = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Show a dedicated on-screen pad and suppress the OS keyboard. `true`
   * picks the general algebra pad; pass a KeypadKind for a specific one. */
  keypad?: boolean | KeypadKind;
}) {
  const { t } = useI18n();
  const accent = useAccent();
  const tokens = useTokens();
  const ref = useRef<TextInput>(null);
  const selection = useRef({ start: value.length, end: value.length });

  const keypadKind: KeypadKind | null = keypad === true ? 'algebra' : keypad || null;

  const insert = (text: string, caretOffset?: number) => {
    const { start, end } = selection.current;
    const s = Math.min(start, value.length);
    const e = Math.min(end, value.length);
    onChange(value.slice(0, s) + text + value.slice(e));
    const caret = s + (caretOffset ?? text.length);
    selection.current = { start: caret, end: caret };
    ref.current?.focus();
  };

  const backspace = () => {
    const { start, end } = selection.current;
    const s = Math.min(start, value.length);
    const e = Math.min(end, value.length);
    const from = s === e ? Math.max(0, s - 1) : s;
    onChange(value.slice(0, from) + value.slice(e));
    selection.current = { start: from, end: from };
    ref.current?.focus();
  };

  const clearAll = () => {
    onChange('');
    selection.current = { start: 0, end: 0 };
    ref.current?.focus();
  };

  // Toggle a leading minus on the whole entry — a negative sign, not the
  // subtract operator (the numeric pad has no −).
  const negate = () => {
    const next = value.startsWith('-') ? value.slice(1) : `-${value}`;
    const d = next.length - value.length;
    onChange(next);
    const { start, end } = selection.current;
    selection.current = { start: Math.max(0, start + d), end: Math.max(0, end + d) };
    ref.current?.focus();
  };

  const field = (
    <Input
      ref={ref as never}
      value={value}
      editable={!disabled}
      placeholder={placeholder ?? (keypadKind ? t('padAnswer') : t('typeMath'))}
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
      // Keypad mode is the keyboard: keep the OS soft keyboard (alphabetical)
      // away so students only use the pad. inputMode covers web/Android;
      // showSoftInputOnFocus covers Android/iOS native.
      {...(keypadKind ? { inputMode: 'none' as const, showSoftInputOnFocus: false } : null)}
      fontSize={17}
      color={tokens.ink}
      borderColor={tokens.border}
      backgroundColor={tokens.surface}
    />
  );

  const preview = (
    <YStack minHeight={26} paddingHorizontal={4} aria-live="polite">
      {value ? <Katex tex={toPreviewTex(value)} /> : <Text> </Text>}
    </YStack>
  );

  if (keypadKind) {
    return (
      <YStack gap={8}>
        {field}
        {preview}
        <MathKeypad
          kind={keypadKind}
          onInsert={insert}
          onBackspace={backspace}
          onClear={clearAll}
          onNegate={negate}
          disabled={disabled}
        />
      </YStack>
    );
  }

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
      {field}
      {preview}
    </YStack>
  );
}
