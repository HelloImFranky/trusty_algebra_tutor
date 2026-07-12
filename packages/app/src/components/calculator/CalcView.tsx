/**
 * Scientific calculator tab: history tape (tap to reuse), live math preview,
 * and a keypad. Evaluation happens in @tutor/core's engine via the store —
 * this component only renders state.
 */
import { useRef } from 'react';
import { TextInput } from 'react-native';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { useI18n } from '../../lib/i18n';
import { Feedback, GhostButton, Muted, PrimaryButton, BRAND, COLORS } from '../ui';
import { Katex } from '../Katex';
import { toPreviewTex } from '../MathInput';
import { useCalculatorStore } from './store';

type Key =
  | { label: string; insert: string }
  | { label: string; action: 'backspace' | 'clearEntry' };

const KEYS: Key[][] = [
  [
    { label: 'sin', insert: 'sin(' },
    { label: 'cos', insert: 'cos(' },
    { label: 'tan', insert: 'tan(' },
    { label: '√', insert: 'sqrt(' },
    { label: 'π', insert: 'pi' },
  ],
  [
    { label: 'x²', insert: '^2' },
    { label: '^', insert: '^' },
    { label: 'ln', insert: 'ln(' },
    { label: 'log', insert: 'log10(' },
    { label: 'e', insert: 'e' },
  ],
  [
    { label: '7', insert: '7' },
    { label: '8', insert: '8' },
    { label: '9', insert: '9' },
    { label: '(', insert: '(' },
    { label: ')', insert: ')' },
  ],
  [
    { label: '4', insert: '4' },
    { label: '5', insert: '5' },
    { label: '6', insert: '6' },
    { label: '×', insert: '*' },
    { label: '÷', insert: '/' },
  ],
  [
    { label: '1', insert: '1' },
    { label: '2', insert: '2' },
    { label: '3', insert: '3' },
    { label: '+', insert: '+' },
    { label: '−', insert: '-' },
  ],
  [
    { label: '0', insert: '0' },
    { label: '.', insert: '.' },
    { label: 'ans', insert: 'ans' },
    { label: '⌫', action: 'backspace' },
    { label: 'C', action: 'clearEntry' },
  ],
];

export function CalcView() {
  const { t } = useI18n();
  const input = useCalculatorStore((s) => s.input);
  const inputError = useCalculatorStore((s) => s.inputError);
  const history = useCalculatorStore((s) => s.history);
  const angleMode = useCalculatorStore((s) => s.angleMode);
  const { setInput, setAngleMode, evaluate, recall, clearHistory } = useCalculatorStore();

  const ref = useRef<TextInput>(null);
  const selection = useRef({ start: input.length, end: input.length });

  const press = (key: Key) => {
    if ('action' in key) {
      if (key.action === 'clearEntry') {
        setInput('');
      } else {
        const { start, end } = selection.current;
        const s = Math.min(start, input.length);
        const e = Math.min(end, input.length);
        const from = s === e ? Math.max(0, s - 1) : s;
        setInput(input.slice(0, from) + input.slice(e));
        selection.current = { start: from, end: from };
      }
    } else {
      const { start, end } = selection.current;
      const s = Math.min(start, input.length);
      const e = Math.min(end, input.length);
      setInput(input.slice(0, s) + key.insert + input.slice(e));
      selection.current = { start: s + key.insert.length, end: s + key.insert.length };
    }
    ref.current?.focus();
  };

  return (
    <YStack gap={10}>
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap={4} backgroundColor="#eef1fd" borderRadius={10} padding={2}>
          {(['rad', 'deg'] as const).map((m) => (
            <Button
              key={m}
              size="$2"
              borderRadius={8}
              backgroundColor={angleMode === m ? BRAND : 'transparent'}
              color={angleMode === m ? '#fff' : BRAND}
              fontWeight="700"
              onPress={() => setAngleMode(m)}
              aria-label={m === 'rad' ? 'radians' : 'degrees'}
            >
              {m.toUpperCase()}
            </Button>
          ))}
        </XStack>
        {history.length > 0 && (
          <GhostButton size="$2" onPress={clearHistory}>
            {t('clear')}
          </GhostButton>
        )}
      </XStack>

      {history.length === 0 ? (
        <Muted>{t('calcHistoryEmpty')}</Muted>
      ) : (
        <YStack gap={2}>
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

      <Input
        ref={ref as never}
        value={input}
        placeholder={t('calcPlaceholder')}
        onChangeText={setInput}
        onSelectionChange={(e) => {
          selection.current = e.nativeEvent.selection;
        }}
        onSubmitEditing={evaluate}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        enterKeyHint="done"
        fontSize={18}
        borderColor={COLORS.border}
        backgroundColor="#fff"
        aria-label={t('calcTab')}
      />
      <YStack minHeight={24} paddingHorizontal={4} aria-live="polite">
        {input ? <Katex tex={toPreviewTex(input)} /> : null}
      </YStack>
      {inputError === 'equation' ? (
        <Feedback kind="warn">{t('calcEquationHint')}</Feedback>
      ) : inputError ? (
        <Feedback kind="warn">{inputError}</Feedback>
      ) : null}

      <YStack gap={6}>
        {KEYS.map((row, ri) => (
          <XStack key={ri} gap={6}>
            {row.map((key) => (
              <Button
                key={key.label}
                flex={1}
                size="$3"
                borderRadius={10}
                backgroundColor={'action' in key ? '#fde8e8' : /\d|\./.test(key.label) ? '#f8f9fb' : '#eef1fd'}
                color={'action' in key ? COLORS.bad : /\d|\./.test(key.label) ? '#111827' : BRAND}
                fontWeight="700"
                fontSize={16}
                onPress={() => press(key)}
                aria-label={key.label}
              >
                {key.label}
              </Button>
            ))}
          </XStack>
        ))}
        <PrimaryButton onPress={evaluate} aria-label="=">
          =
        </PrimaryButton>
      </YStack>
    </YStack>
  );
}
