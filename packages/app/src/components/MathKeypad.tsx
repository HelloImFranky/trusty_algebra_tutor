/**
 * Dedicated, per-problem math keypad.
 *
 * One base component (`MathKeypad`) renders any `KeypadLayout` — a functions
 * row plus a grid of keys — and the named presets below are all built from a
 * single shared key catalog (`K`). That's the "one base pad, extend it per
 * problem" idea done the React way: composition/config over class
 * inheritance, so a new problem-specific pad is a few lines of layout, not a
 * new component.
 *
 * Deliberately NO ×/÷ keys in any preset: Algebra 1 answers use juxtaposition
 * for multiplication (2x, (x−1)(x+2)) and the fraction bar for division, so
 * the four "calculator" arithmetic keys don't belong on a math-answer pad.
 * The `numeric` pad also drops +/− (bare-number answers never need them, and
 * ± covers a leading negative); the `algebra` pad keeps +/− because
 * polynomial and signed answers (−3x² + x − 1, y = −3x − 2) can't be typed
 * without them.
 */
import { Button, Text, XStack, YStack } from 'tamagui';
import { useAccent, useTokens, type Hex } from './ui';

/** Which dedicated pad a problem shows. Add a preset to KEYPADS to extend. */
export type KeypadKind = 'numeric' | 'algebra';

type Variant = 'digit' | 'var' | 'op' | 'fn' | 'util';
export interface KeyDef {
  label: string;
  insert?: string;
  /** caret offset from the insertion point (lands the cursor inside sqrt() etc.) */
  caret?: number;
  action?: 'backspace' | 'clear' | 'negate';
  variant: Variant;
  aria?: string;
}
interface KeypadLayout {
  functions?: KeyDef[];
  grid: KeyDef[][];
}

// ── Shared key catalog ─────────────────────────────────────────────────
const digit = (d: string): KeyDef => ({ label: d, insert: d, variant: 'digit' });
const K = {
  d0: digit('0'), d1: digit('1'), d2: digit('2'), d3: digit('3'), d4: digit('4'),
  d5: digit('5'), d6: digit('6'), d7: digit('7'), d8: digit('8'), d9: digit('9'),
  dot: { label: '.', insert: '.', variant: 'digit' } as KeyDef,
  x: { label: 'x', insert: 'x', variant: 'var' } as KeyDef,
  y: { label: 'y', insert: 'y', variant: 'var' } as KeyDef,
  plus: { label: '+', insert: '+', variant: 'op', aria: 'plus' } as KeyDef,
  minus: { label: '−', insert: '-', variant: 'op', aria: 'minus' } as KeyDef,
  eq: { label: '=', insert: '=', variant: 'op', aria: 'equals' } as KeyDef,
  lparen: { label: '(', insert: '(', variant: 'fn' } as KeyDef,
  rparen: { label: ')', insert: ')', variant: 'fn' } as KeyDef,
  comma: { label: ',', insert: ', ', variant: 'fn', aria: 'comma' } as KeyDef,
  sq: { label: 'x²', insert: '^2', variant: 'fn', aria: 'squared' } as KeyDef,
  pow: { label: 'xⁿ', insert: '^', caret: 1, variant: 'fn', aria: 'exponent' } as KeyDef,
  sqrt: { label: '√', insert: 'sqrt()', caret: 5, variant: 'fn', aria: 'square root' } as KeyDef,
  frac: { label: 'a/b', insert: '()/()', caret: 1, variant: 'fn', aria: 'fraction' } as KeyDef,
  lt: { label: '<', insert: '<', variant: 'fn', aria: 'less than' } as KeyDef,
  gt: { label: '>', insert: '>', variant: 'fn', aria: 'greater than' } as KeyDef,
  le: { label: '≤', insert: '<=', variant: 'fn', aria: 'less than or equal' } as KeyDef,
  ge: { label: '≥', insert: '>=', variant: 'fn', aria: 'greater than or equal' } as KeyDef,
  pi: { label: 'π', insert: 'pi', variant: 'fn' } as KeyDef,
  bksp: { label: '⌫', action: 'backspace', variant: 'util', aria: 'backspace' } as KeyDef,
  clear: { label: 'AC', action: 'clear', variant: 'util', aria: 'clear' } as KeyDef,
  neg: { label: '±', action: 'negate', variant: 'util', aria: 'negative sign' } as KeyDef,
};

// ── Presets (extend the base by adding an entry here) ──────────────────
const KEYPADS: Record<KeypadKind, KeypadLayout> = {
  // Bare-number answers (solve for x, evaluate, percent, …): a clean number
  // pad. No operators — ± covers a leading negative, . covers decimals.
  numeric: {
    grid: [
      [K.d7, K.d8, K.d9],
      [K.d4, K.d5, K.d6],
      [K.d1, K.d2, K.d3],
      [K.neg, K.d0, K.dot],
      [K.bksp, K.clear],
    ],
  },
  // Expression / equation / coordinate / inequality / radical answers: the
  // full algebra pad. Keeps +/−/= and variables, adds parens, comma, the
  // inequality signs, exponents, radical and fraction — but never ×/÷.
  algebra: {
    functions: [K.sq, K.pow, K.sqrt, K.frac, K.comma, K.lt, K.gt, K.le, K.ge, K.pi],
    grid: [
      [K.lparen, K.rparen, K.bksp, K.clear],
      [K.d7, K.d8, K.d9, K.plus],
      [K.d4, K.d5, K.d6, K.minus],
      [K.d1, K.d2, K.d3, K.eq],
      [K.x, K.y, K.d0, K.dot],
    ],
  },
};

export function MathKeypad({
  kind,
  onInsert,
  onBackspace,
  onClear,
  onNegate,
  disabled,
}: {
  kind: KeypadKind;
  onInsert: (text: string, caret?: number) => void;
  onBackspace: () => void;
  onClear: () => void;
  onNegate: () => void;
  disabled?: boolean;
}) {
  const accent = useAccent();
  const tokens = useTokens();
  const layout = KEYPADS[kind];

  const KEY_STYLE: Record<Variant, { bg: Hex; color: Hex; fontSize: number }> = {
    digit: { bg: tokens.subtle, color: tokens.ink, fontSize: 19 },
    var: { bg: tokens.subtle, color: accent, fontSize: 19 },
    op: { bg: accent, color: tokens.onAccent, fontSize: 21 },
    fn: { bg: tokens.subtle, color: accent, fontSize: 15 },
    util: { bg: tokens.border, color: tokens.ink, fontSize: 16 },
  };

  const press = (k: KeyDef) => {
    if (k.action === 'backspace') return onBackspace();
    if (k.action === 'clear') return onClear();
    if (k.action === 'negate') return onNegate();
    if (k.insert != null) onInsert(k.insert, k.caret);
  };

  const renderKey = (k: KeyDef, flexBasis?: number) => {
    const s = KEY_STYLE[k.variant];
    return (
      <Button
        key={k.label}
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
        onPress={() => press(k)}
        aria-label={k.aria ?? k.label}
      >
        <Text color={s.color} fontSize={s.fontSize} fontWeight="700" numberOfLines={1}>
          {k.label}
        </Text>
      </Button>
    );
  };

  return (
    <YStack gap={8}>
      {layout.functions && (
        <XStack gap={6} flexWrap="wrap" role="toolbar" aria-label="math functions">
          {layout.functions.map((k) => renderKey(k, 40))}
        </XStack>
      )}
      <YStack gap={6}>
        {layout.grid.map((row, ri) => (
          <XStack key={ri} gap={6}>
            {row.map((k) => renderKey(k))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
