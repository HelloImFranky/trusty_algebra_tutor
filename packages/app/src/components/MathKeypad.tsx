/**
 * Dedicated, per-problem math keypad.
 *
 * One base component (`MathKeypad`) renders any `KeypadLayout` — an optional
 * collapsible "more symbols" drawer, an optional always-on functions row, and
 * a grid of keys — and the named presets below are all built from a single
 * shared key catalog (`K`). That's the "one base pad, extend it per problem"
 * idea done the React way: composition/config over class inheritance, so a new
 * problem-specific pad is a few lines of layout, not a new component.
 *
 * Each preset is tuned to one lesson's answers and shows ONLY the keys that
 * lesson's answers can need (see keypadKindForProblem in @tutor/core, which
 * maps a problem's generator template to one of these). A student adding
 * polynomials gets variables, exponents and signs; a student converting units
 * gets a clean number pad; nobody sees a key they can't use.
 *
 * Deliberately NO ×/÷ keys in any preset: Algebra 1 answers use juxtaposition
 * for multiplication (2x, (x−1)(x+2)) and the fraction bar for division, so
 * the four "calculator" arithmetic keys don't belong on a math-answer pad.
 * Number-only pads also drop +/− (bare-number answers never need them, and
 * ± covers a leading negative); expression pads keep +/− because polynomial
 * and signed answers (−3x² + x − 1, y = −3x − 2) can't be typed without them.
 */
import { useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import { useAccent, useTokens, type Hex } from './ui';

/** Which dedicated pad a problem shows. Add a preset to KEYPADS to extend. */
export type KeypadKind =
  | 'numeric'
  | 'radical'
  | 'exponent'
  | 'polynomial'
  | 'inequality'
  | 'linear'
  | 'points'
  | 'factor'
  | 'algebra';

type Variant = 'digit' | 'term' | 'op' | 'fn' | 'util';
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
  /** Collapsed-by-default drawer of rarely-needed symbols (√, π, <, >, …). */
  more?: KeyDef[];
  /** Always-visible row above the grid, for a pad's few structure keys. */
  functions?: KeyDef[];
  grid: KeyDef[][];
}

// ── Shared key catalog ─────────────────────────────────────────────────
const digit = (d: string): KeyDef => ({ label: d, insert: d, variant: 'digit' });
const K = {
  d0: digit('0'), d1: digit('1'), d2: digit('2'), d3: digit('3'), d4: digit('4'),
  d5: digit('5'), d6: digit('6'), d7: digit('7'), d8: digit('8'), d9: digit('9'),
  dot: { label: '.', insert: '.', variant: 'digit' } as KeyDef,
  // Variables and exponents are the "term builder" — grouped and tinted so
  // they read as structure, distinct from the neutral digits.
  x: { label: 'x', insert: 'x', variant: 'term' } as KeyDef,
  y: { label: 'y', insert: 'y', variant: 'term' } as KeyDef,
  sq: { label: 'x²', insert: '^2', variant: 'term', aria: 'squared' } as KeyDef,
  pow: { label: 'xⁿ', insert: '^', caret: 1, variant: 'term', aria: 'exponent' } as KeyDef,
  plus: { label: '+', insert: '+', variant: 'op', aria: 'plus' } as KeyDef,
  minus: { label: '−', insert: '-', variant: 'op', aria: 'minus' } as KeyDef,
  eq: { label: '=', insert: '=', variant: 'op', aria: 'equals' } as KeyDef,
  lparen: { label: '(', insert: '(', variant: 'fn' } as KeyDef,
  rparen: { label: ')', insert: ')', variant: 'fn' } as KeyDef,
  comma: { label: ',', insert: ', ', variant: 'fn', aria: 'comma' } as KeyDef,
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

// A tinted, prominent variant of a term key (used to echo the reference
// "Operations with Polynomials" design, where signs join the term group
// rather than reading as calculator actions).
const term = (k: KeyDef): KeyDef => ({ ...k, variant: 'term' });

// The 3-column digit core shared by the compact single-purpose pads, with a
// backspace / 0 / clear foot. Structure keys ride in the `functions` row.
const digitCore: KeyDef[][] = [
  [K.d7, K.d8, K.d9],
  [K.d4, K.d5, K.d6],
  [K.d1, K.d2, K.d3],
  [K.bksp, K.d0, K.clear],
];

// ── Presets (extend the base by adding an entry here) ──────────────────
const KEYPADS: Record<KeypadKind, KeypadLayout> = {
  // Bare-number answers (solve for x, evaluate, convert, percent, …): a clean
  // number pad. No operators — ± covers a leading negative, . covers decimals.
  numeric: {
    grid: [
      [K.d7, K.d8, K.d9],
      [K.d4, K.d5, K.d6],
      [K.d1, K.d2, K.d3],
      [K.neg, K.d0, K.dot],
      [K.bksp, K.clear],
    ],
  },

  // Simplified radicals (3√5): digits plus the radical, nothing else.
  radical: {
    functions: [K.sqrt],
    grid: digitCore,
  },

  // Powers of a single variable / monomials (x⁶, 3x²): digits, the variable,
  // and the two exponent keys.
  exponent: {
    functions: [K.x, K.sq, K.pow],
    grid: digitCore,
  },

  // Expressions & polynomials (−3x² + x − 1) — the full term-builder, matching
  // the "Operations with Polynomials" redesign: parens + edit controls on top,
  // the variable/exponent term row, a wide sign pair, then digits with a/b and
  // decimal. The rarely-needed symbols live in the collapsible drawer.
  polynomial: {
    more: [K.sqrt, K.pi, K.lt, K.gt, K.le, K.ge],
    grid: [
      [K.lparen, K.rparen, K.bksp, K.clear],
      [K.x, K.y, K.sq, K.pow],
      [term(K.plus), term(K.minus)],
      [K.d7, K.d8, K.d9, K.frac],
      [K.d4, K.d5, K.d6, K.dot],
      [K.d1, K.d2, K.d3, K.d0],
    ],
  },

  // Inequality solutions (x < −2): the variable, a minus, the four inequality
  // signs, and digits.
  inequality: {
    functions: [K.x, K.minus, K.lt, K.gt, K.le, K.ge],
    grid: digitCore,
  },

  // Linear equations solved for a variable (y = −3x − 2, x = −3): variables,
  // equals, +/−, and digits.
  linear: {
    functions: [K.x, K.y, K.eq, K.plus, K.minus],
    grid: digitCore,
  },

  // Coordinate points, slopes and solution lists ((−3, −1), (3)/(2), 5, −5):
  // parentheses, comma, the fraction bar, a minus, and digits.
  points: {
    functions: [K.lparen, K.rparen, K.comma, K.frac, K.minus],
    grid: digitCore,
  },

  // Factored forms (3x(2x + 4), (x + 3)(x − 5)): the variable, parentheses,
  // +/−, and digits.
  factor: {
    functions: [K.x, K.lparen, K.rparen, K.plus, K.minus],
    grid: digitCore,
  },

  // General fallback for anything the per-lesson selector can't narrow (e.g.
  // "f(x) = a(b)^x"). Keeps +/−/= and variables, adds parens, comma, the
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
  const [showMore, setShowMore] = useState(false);

  const KEY_STYLE: Record<
    Variant,
    { bg: Hex; color: Hex; fontSize: number; border?: Hex }
  > = {
    digit: { bg: tokens.subtle, color: tokens.ink, fontSize: 19 },
    term: { bg: tokens.subtle, color: accent, fontSize: 18, border: accent },
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

  const renderKey = (k: KeyDef, keyId: string, flexBasis?: number) => {
    const s = KEY_STYLE[k.variant];
    return (
      <Button
        key={keyId}
        flex={1}
        flexBasis={flexBasis ?? 0}
        minWidth={0}
        height={46}
        paddingHorizontal={0}
        borderRadius={12}
        borderWidth={s.border ? 1 : 0}
        borderColor={s.border ?? 'transparent'}
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
      {layout.more && (
        <YStack gap={6}>
          <Button
            alignSelf="center"
            height={30}
            paddingHorizontal={14}
            borderRadius={20}
            borderWidth={1}
            borderColor={tokens.border}
            backgroundColor="transparent"
            disabled={disabled}
            pressStyle={{ opacity: 0.7 }}
            onPress={() => setShowMore((v) => !v)}
            aria-label="more symbols"
            aria-expanded={showMore}
          >
            <Text color={tokens.muted} fontSize={11} letterSpacing={0.3}>
              ⋯ more symbols (√, π, {'<'} {'>'} ≤ ≥)
            </Text>
          </Button>
          {showMore && (
            <XStack gap={6} flexWrap="wrap" role="toolbar" aria-label="more symbols">
              {layout.more.map((k, i) => renderKey(k, `more-${i}`, 44))}
            </XStack>
          )}
        </YStack>
      )}
      {layout.functions && (
        <XStack gap={6} flexWrap="wrap" role="toolbar" aria-label="math functions">
          {layout.functions.map((k, i) => renderKey(k, `fn-${i}`, 40))}
        </XStack>
      )}
      <YStack gap={6}>
        {layout.grid.map((row, ri) => (
          <XStack key={ri} gap={6}>
            {row.map((k, ci) => renderKey(k, `${ri}-${ci}`))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
