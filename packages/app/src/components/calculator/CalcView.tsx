/**
 * Scientific calculator tab, styled after the iOS calculator: history tape
 * (tap to reuse), a large right-aligned display with live math preview, and
 * a pill-key pad — scientific rows up top, digit grid with the orange
 * operator column below. Evaluation happens in @tutor/core's engine via the
 * store — this component only renders state.
 */
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { formatNumber } from '@tutor/core';
import { useI18n } from '../../lib/i18n';
import { Feedback, GhostButton, Muted, COLORS } from '../ui';
import { Katex } from '../Katex';
import { toPreviewTex } from '../MathInput';
import { useCalculatorStore } from './store';

type Action =
  | 'backspace'
  | 'clearEntry'
  | 'negate'
  | 'second'
  | 'angle'
  | 'equals'
  | 'memClear'
  | 'memAdd'
  | 'memSubtract'
  | 'memRecall';

type Variant = 'sci' | 'util' | 'digit' | 'op';

interface KeyDef {
  label: string;
  aria?: string;
  insert?: string;
  action?: Action;
  /** alternate meaning while the 2nd key is latched */
  second?: { label: string; insert: string; aria?: string };
}

/* Scientific rows: 6 columns of small pills, mirroring the iOS layout. */
const SCI_KEYS: KeyDef[][] = [
  [
    { label: '(', insert: '(' },
    { label: ')', insert: ')' },
    { label: 'mc', action: 'memClear', aria: 'memory clear' },
    { label: 'm+', action: 'memAdd', aria: 'memory add' },
    { label: 'm−', action: 'memSubtract', aria: 'memory subtract' },
    { label: 'mr', action: 'memRecall', aria: 'memory recall' },
  ],
  [
    { label: '2nd', action: 'second', aria: 'second functions' },
    { label: 'x²', insert: '^2', aria: 'squared' },
    { label: 'x³', insert: '^3', aria: 'cubed' },
    { label: 'xʸ', insert: '^', aria: 'to the power' },
    { label: 'eˣ', insert: 'e^(', aria: 'e to the power' },
    { label: '10ˣ', insert: '10^(', aria: 'ten to the power' },
  ],
  [
    { label: '¹⁄ₓ', insert: '1/(', aria: 'reciprocal' },
    { label: '²√x', insert: 'sqrt(', aria: 'square root' },
    { label: '³√x', insert: 'cbrt(', aria: 'cube root' },
    { label: 'ʸ√x', insert: 'nthRoot(', aria: 'nth root' },
    { label: 'ln', insert: 'ln(' },
    { label: 'log₁₀', insert: 'log10(', aria: 'log base 10' },
  ],
  [
    { label: 'x!', insert: '!', aria: 'factorial' },
    { label: 'sin', insert: 'sin(', second: { label: 'sin⁻¹', insert: 'asin(', aria: 'inverse sine' } },
    { label: 'cos', insert: 'cos(', second: { label: 'cos⁻¹', insert: 'acos(', aria: 'inverse cosine' } },
    { label: 'tan', insert: 'tan(', second: { label: 'tan⁻¹', insert: 'atan(', aria: 'inverse tangent' } },
    { label: 'e', insert: 'e' },
    { label: 'EE', insert: '*10^', aria: 'times ten to the power' },
  ],
  [
    { label: 'Rand', insert: 'random()', aria: 'random number' },
    { label: 'sinh', insert: 'sinh(', second: { label: 'sinh⁻¹', insert: 'asinh(', aria: 'inverse hyperbolic sine' } },
    { label: 'cosh', insert: 'cosh(', second: { label: 'cosh⁻¹', insert: 'acosh(', aria: 'inverse hyperbolic cosine' } },
    { label: 'tanh', insert: 'tanh(', second: { label: 'tanh⁻¹', insert: 'atanh(', aria: 'inverse hyperbolic tangent' } },
    { label: 'π', insert: 'pi' },
    { label: '', action: 'angle' }, // label depends on the current angle mode
  ],
];

/* Main pad: 4 columns, operators in the accent column on the right. */
const MAIN_KEYS: { key: KeyDef; variant: Variant }[][] = [
  [
    { key: { label: '⌫', action: 'backspace', aria: 'backspace' }, variant: 'util' },
    { key: { label: 'AC', action: 'clearEntry', aria: 'clear entry' }, variant: 'util' },
    { key: { label: '%', insert: '/100', aria: 'percent' }, variant: 'util' },
    { key: { label: '÷', insert: '/', aria: 'divide' }, variant: 'op' },
  ],
  [
    { key: { label: '7', insert: '7' }, variant: 'digit' },
    { key: { label: '8', insert: '8' }, variant: 'digit' },
    { key: { label: '9', insert: '9' }, variant: 'digit' },
    { key: { label: '×', insert: '*', aria: 'multiply' }, variant: 'op' },
  ],
  [
    { key: { label: '4', insert: '4' }, variant: 'digit' },
    { key: { label: '5', insert: '5' }, variant: 'digit' },
    { key: { label: '6', insert: '6' }, variant: 'digit' },
    { key: { label: '−', insert: '-', aria: 'subtract' }, variant: 'op' },
  ],
  [
    { key: { label: '1', insert: '1' }, variant: 'digit' },
    { key: { label: '2', insert: '2' }, variant: 'digit' },
    { key: { label: '3', insert: '3' }, variant: 'digit' },
    { key: { label: '+', insert: '+', aria: 'add' }, variant: 'op' },
  ],
  [
    { key: { label: '⁺⁄₋', action: 'negate', aria: 'toggle sign' }, variant: 'digit' },
    { key: { label: '0', insert: '0' }, variant: 'digit' },
    { key: { label: '.', insert: '.' }, variant: 'digit' },
    { key: { label: '=', action: 'equals', aria: 'equals' }, variant: 'op' },
  ],
];

/* Light-mode translation of the iOS key shades (dark theme comes later).
 * Sci uses the tightest fontSize (13) because its labels are the widest —
 * "log₁₀" and "cosh⁻¹" (under 2nd) need every pixel. Height 38 keeps five
 * scientific rows compact so the digit pad still fits above the fold. */
type Hex = `#${string}`;
const KEY_STYLE: Record<Variant, { bg: Hex; press: Hex; color: Hex; fontSize: number; height: number }> = {
  sci: { bg: '#e8ebf1', press: '#d6dbe4', color: '#1f2937', fontSize: 13, height: 38 },
  util: { bg: '#d9dee6', press: '#c6cdd8', color: '#111827', fontSize: 17, height: 52 },
  digit: { bg: '#f4f5f8', press: '#e4e7ed', color: '#111827', fontSize: 20, height: 52 },
  op: { bg: '#ff9f0a', press: '#e68e00', color: '#ffffff', fontSize: 24, height: 52 },
};

export function CalcView() {
  const { t } = useI18n();
  const input = useCalculatorStore((s) => s.input);
  const inputError = useCalculatorStore((s) => s.inputError);
  const history = useCalculatorStore((s) => s.history);
  const angleMode = useCalculatorStore((s) => s.angleMode);
  const memory = useCalculatorStore((s) => s.memory);
  const { setInput, setAngleMode, evaluate, recall, clearHistory, memoryAdd, memoryClear } =
    useCalculatorStore();
  const [second, setSecond] = useState(false);

  const ref = useRef<TextInput>(null);
  const selection = useRef({ start: input.length, end: input.length });

  const insertText = (text: string) => {
    const { start, end } = selection.current;
    const s = Math.min(start, input.length);
    const e = Math.min(end, input.length);
    setInput(input.slice(0, s) + text + input.slice(e));
    selection.current = { start: s + text.length, end: s + text.length };
  };

  const press = (key: KeyDef) => {
    switch (key.action) {
      case 'second':
        setSecond((v) => !v);
        return;
      case 'angle':
        setAngleMode(angleMode === 'rad' ? 'deg' : 'rad');
        return;
      case 'equals':
        evaluate();
        return;
      case 'memClear':
        memoryClear();
        return;
      case 'memAdd':
        memoryAdd(1);
        return;
      case 'memSubtract':
        memoryAdd(-1);
        return;
      case 'clearEntry':
        setInput('');
        selection.current = { start: 0, end: 0 };
        break;
      case 'backspace': {
        const { start, end } = selection.current;
        const s = Math.min(start, input.length);
        const e = Math.min(end, input.length);
        const from = s === e ? Math.max(0, s - 1) : s;
        setInput(input.slice(0, from) + input.slice(e));
        selection.current = { start: from, end: from };
        break;
      }
      case 'negate': {
        const next = input.startsWith('-') ? input.slice(1) : `-${input}`;
        const d = next.length - input.length;
        setInput(next);
        selection.current = {
          start: Math.max(0, selection.current.start + d),
          end: Math.max(0, selection.current.end + d),
        };
        break;
      }
      case 'memRecall':
        insertText(formatNumber(memory ?? 0));
        break;
      default:
        insertText(second && key.second ? key.second.insert : key.insert ?? '');
    }
    ref.current?.focus();
  };

  const renderKey = (key: KeyDef, variant: Variant) => {
    const isSecondToggle = key.action === 'second';
    const isAngle = key.action === 'angle';
    const alt = second && key.second ? key.second : null;
    const label = isAngle ? (angleMode === 'rad' ? 'Deg' : 'Rad') : alt?.label ?? key.label;
    const aria = isAngle
      ? angleMode === 'rad'
        ? 'switch to degrees'
        : 'switch to radians'
      : alt?.aria ?? key.aria ?? label;
    const memDisabled =
      (key.action === 'memClear' || key.action === 'memRecall') && memory == null;
    const s = KEY_STYLE[variant];
    const latched = isSecondToggle && second;
    return (
      <Button
        key={key.action ?? key.label}
        flex={1}
        flexBasis={0}
        height={s.height}
        minWidth={0}
        paddingHorizontal={0}
        borderRadius={999}
        backgroundColor={latched ? '#374151' : s.bg}
        color={latched ? '#ffffff' : s.color}
        fontWeight="600"
        fontSize={s.fontSize}
        disabled={memDisabled}
        opacity={memDisabled ? 0.4 : 1}
        hoverStyle={{ backgroundColor: latched ? '#374151' : s.press }}
        pressStyle={{ backgroundColor: latched ? '#1f2937' : s.press }}
        onPress={() => press(key)}
        aria-label={aria}
      >
        {/* numberOfLines={1} keeps a widest label (log₁₀, cosh⁻¹) on one
            line even at the narrow phone width; clip is safer than
            ellipsis for math glyphs where a "…" would misread. */}
        <Text
          color={latched ? '#ffffff' : s.color}
          fontSize={s.fontSize}
          fontWeight="600"
          numberOfLines={1}
          ellipsizeMode="clip"
          textAlign="center"
        >
          {label}
        </Text>
      </Button>
    );
  };

  return (
    <YStack gap={10}>
      {history.length === 0 ? (
        <YStack gap={2}>
          <Muted>{t('calcHistoryEmpty')}</Muted>
          <Muted>{t('calcPlaceholder')}</Muted>
        </YStack>
      ) : (
        <YStack gap={2}>
          <XStack justifyContent="flex-end">
            <GhostButton size="$2" onPress={clearHistory}>
              {t('clear')}
            </GhostButton>
          </XStack>
          {history.slice(-12).map((h, i) => (
            <Button
              key={`${i}-${h.input}`}
              unstyled
              onPress={() => recall(h)}
              paddingVertical={5}
              paddingHorizontal={8}
              borderRadius={8}
              hoverStyle={{ backgroundColor: '#f3f4f6' }}
              pressStyle={{ backgroundColor: '#eef1fd' }}
            >
              <XStack justifyContent="space-between" alignItems="center" gap={12}>
                <Text color={COLORS.muted} fontSize={14} flexShrink={1}>
                  {h.input}
                </Text>
                <Text fontWeight="700" fontSize={16} color="#111827">
                  = {h.display}
                  {h.fraction ? (
                    <Text color={COLORS.muted} fontSize={13}>
                      {'  '}({h.fraction})
                    </Text>
                  ) : null}
                </Text>
              </XStack>
            </Button>
          ))}
        </YStack>
      )}

      <XStack alignItems="center" gap={8}>
        <Text fontSize={13} fontWeight="600" color={COLORS.muted}>
          {angleMode === 'rad' ? 'Rad' : 'Deg'}
        </Text>
        <Input
          ref={ref as never}
          flex={1}
          value={input}
          placeholder="0"
          placeholderTextColor="#9ca3af"
          onChangeText={setInput}
          onSelectionChange={(e) => {
            selection.current = e.nativeEvent.selection;
          }}
          onSubmitEditing={evaluate}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          enterKeyHint="done"
          // The pad below is the keyboard: keep the OS soft keyboard away
          // (inputMode covers web/Android; showSoftInputOnFocus, Android).
          inputMode="none"
          showSoftInputOnFocus={false}
          fontSize={34}
          textAlign="right"
          borderWidth={0}
          backgroundColor="transparent"
          paddingHorizontal={4}
          focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
          aria-label={t('calcTab')}
        />
      </XStack>
      <YStack minHeight={24} paddingHorizontal={4} alignItems="flex-end" aria-live="polite">
        {input ? <Katex tex={toPreviewTex(input)} /> : null}
      </YStack>
      {inputError === 'equation' ? (
        <Feedback kind="hint">{t('calcEquationHint')}</Feedback>
      ) : inputError ? (
        <Feedback kind="warn">{inputError}</Feedback>
      ) : null}

      {/* Sci and main pads share the same gap (8) so the two grids read as
          one aligned surface — 6-column sci above a 4-column main means
          columns still stagger, but the consistent gutter makes the
          alignment feel intentional rather than fragmentary. */}
      <YStack gap={8}>
        {SCI_KEYS.map((row, ri) => (
          <XStack key={ri} gap={8}>
            {row.map((key) => renderKey(key, 'sci'))}
          </XStack>
        ))}
      </YStack>
      <YStack gap={8}>
        {MAIN_KEYS.map((row, ri) => (
          <XStack key={ri} gap={8}>
            {row.map(({ key, variant }) => renderKey(key, variant))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
