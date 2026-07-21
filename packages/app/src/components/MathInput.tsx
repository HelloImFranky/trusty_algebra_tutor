/**
 * Structured math input (design doc §6). Two modes:
 *
 * - Default (`keypad` off): a middle-school-tuned symbol toolbar over a text
 *   field that accepts the typed shortcuts the doc calls out (x^2, sqrt(),
 *   <=), with a live math preview.
 * - Keypad (`keypad` on, used by Practice): a calculator-style number/
 *   operations pad. The OS soft keyboard is suppressed so students press
 *   digits, operators and math symbols instead of typing free text on the
 *   alphabetical keyboard.
 *
 * Grading always normalizes through the CAS server-side — never string
 * equality — so `*` for ×, `/` for ÷, `^` for powers etc. all grade fine.
 */
import { useRef } from 'react';
import { TextInput } from 'react-native';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { Katex } from './Katex';
import { useI18n } from '../lib/i18n';
import { useAccent, useTokens, type Hex } from './ui';

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

/* ── Keypad layout ──────────────────────────────────────────────────────
 * A "functions" row of the middle-school math symbols, then a 4-column
 * calculator grid with the operator column on the right (mirrors the app's
 * Calculator pad). Every key just inserts text (or backspaces / clears);
 * grading normalizes server-side. */
type Variant = 'digit' | 'var' | 'op' | 'fn' | 'util';
type PadKey =
  | { label: string; insert: string; caret?: number; variant: Variant; aria?: string }
  | { label: string; action: 'backspace' | 'clear'; variant: Variant; aria: string };

const PAD_FUNCTIONS: PadKey[] = [
  { label: 'x²', insert: '^2', variant: 'fn', aria: 'squared' },
  { label: 'xⁿ', insert: '^', caret: 1, variant: 'fn', aria: 'to the power' },
  { label: '√', insert: 'sqrt()', caret: 5, variant: 'fn', aria: 'square root' },
  { label: 'a/b', insert: '()/()', caret: 1, variant: 'fn', aria: 'fraction' },
  { label: 'π', insert: 'pi', variant: 'fn' },
  { label: '≤', insert: '<=', variant: 'fn', aria: 'less than or equal' },
  { label: '≥', insert: '>=', variant: 'fn', aria: 'greater than or equal' },
  { label: '=', insert: '=', variant: 'fn', aria: 'equals' },
];

const PAD_GRID: PadKey[][] = [
  [
    { label: '(', insert: '(', variant: 'fn' },
    { label: ')', insert: ')', variant: 'fn' },
    { label: '⌫', action: 'backspace', variant: 'util', aria: 'backspace' },
    { label: 'AC', action: 'clear', variant: 'util', aria: 'clear' },
  ],
  [
    { label: '7', insert: '7', variant: 'digit' },
    { label: '8', insert: '8', variant: 'digit' },
    { label: '9', insert: '9', variant: 'digit' },
    { label: '÷', insert: '/', variant: 'op', aria: 'divide' },
  ],
  [
    { label: '4', insert: '4', variant: 'digit' },
    { label: '5', insert: '5', variant: 'digit' },
    { label: '6', insert: '6', variant: 'digit' },
    { label: '×', insert: '*', variant: 'op', aria: 'multiply' },
  ],
  [
    { label: '1', insert: '1', variant: 'digit' },
    { label: '2', insert: '2', variant: 'digit' },
    { label: '3', insert: '3', variant: 'digit' },
    { label: '−', insert: '-', variant: 'op', aria: 'subtract' },
  ],
  [
    { label: 'x', insert: 'x', variant: 'var' },
    { label: '0', insert: '0', variant: 'digit' },
    { label: '.', insert: '.', variant: 'digit' },
    { label: '+', insert: '+', variant: 'op', aria: 'add' },
  ],
];

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
  /** Show the calculator-style keypad and suppress the OS keyboard. */
  keypad?: boolean;
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

  const pressKey = (key: PadKey) => {
    if ('action' in key) {
      if (key.action === 'backspace') backspace();
      else clearAll();
      return;
    }
    insert(key.insert, key.caret);
  };

  const KEY_STYLE: Record<Variant, { bg: Hex; color: Hex; fontSize: number }> = {
    digit: { bg: tokens.subtle, color: tokens.ink, fontSize: 19 },
    var: { bg: tokens.subtle, color: accent, fontSize: 19 },
    op: { bg: accent, color: tokens.onAccent, fontSize: 21 },
    fn: { bg: tokens.subtle, color: accent, fontSize: 15 },
    util: { bg: tokens.border, color: tokens.ink, fontSize: 16 },
  };

  const renderKey = (key: PadKey, flexBasis?: number) => {
    const s = KEY_STYLE[key.variant];
    return (
      <Button
        key={key.label}
        flex={1}
        flexBasis={flexBasis ?? 0}
        minWidth={0}
        height={46}
        paddingHorizontal={0}
        borderRadius={12}
        disabled={disabled}
        backgroundColor={s.bg}
        color={s.color}
        pressStyle={{ opacity: 0.7 }}
        hoverStyle={{ opacity: 0.85 }}
        onPress={() => pressKey(key)}
        aria-label={('aria' in key && key.aria) || key.label}
      >
        <Text color={s.color} fontSize={s.fontSize} fontWeight="700" numberOfLines={1}>
          {key.label}
        </Text>
      </Button>
    );
  };

  const field = (
    <Input
      ref={ref as never}
      value={value}
      editable={!disabled}
      placeholder={placeholder ?? (keypad ? t('padAnswer') : t('typeMath'))}
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
      {...(keypad ? { inputMode: 'none' as const, showSoftInputOnFocus: false } : null)}
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

  if (keypad) {
    return (
      <YStack gap={8}>
        {field}
        {preview}
        <XStack gap={6} flexWrap="wrap" role="toolbar" aria-label="math functions">
          {PAD_FUNCTIONS.map((k) => renderKey(k, 40))}
        </XStack>
        <YStack gap={6}>
          {PAD_GRID.map((row, ri) => (
            <XStack key={ri} gap={6}>
              {row.map((k) => renderKey(k))}
            </XStack>
          ))}
        </YStack>
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
