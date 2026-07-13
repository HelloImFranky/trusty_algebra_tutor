/**
 * Graph tab: expression list, the pan/zoom viewport (GraphPlot, platform
 * specific), and engine-computed points of interest (x-intercepts and
 * intersections) — the same structured data an AI tutor explanation can use.
 */
import { useMemo, useRef, useState } from 'react';
import { Platform, type TextInput } from 'react-native';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import {
  findIntersections,
  findRoots,
  formatNumber,
  type GraphWindow,
  type Point,
} from '@tutor/core';
import { useI18n } from '../../lib/i18n';
import { GhostButton, Muted, SecondaryButton, COLORS } from '../ui';
import { GraphPlot } from './GraphPlot';
import { MAX_EXPRESSIONS, useCalculatorStore } from './store';
import { useCompiledFns } from './useCompiledFns';

/** Quick-insert chips for tokens that are fiddly to type, phone-first. */
const QUICK_KEYS: { label: string; insert: string; aria: string }[] = [
  { label: 'x', insert: 'x', aria: 'x' },
  { label: 'x²', insert: '^2', aria: 'squared' },
  { label: '^', insert: '^', aria: 'to the power' },
  { label: '√', insert: 'sqrt(', aria: 'square root' },
  { label: '(', insert: '(', aria: 'open parenthesis' },
  { label: ')', insert: ')', aria: 'close parenthesis' },
  { label: '+', insert: '+', aria: 'add' },
  { label: '−', insert: '-', aria: 'subtract' },
  { label: '×', insert: '*', aria: 'multiply' },
  { label: '÷', insert: '/', aria: 'divide' },
  { label: 'π', insert: 'pi', aria: 'pi' },
  { label: '|x|', insert: 'abs(', aria: 'absolute value' },
];

export function GraphView() {
  const { t } = useI18n();
  const window = useCalculatorStore((s) => s.window);
  const { setExpression, addExpression, removeExpression, setWindow, resetWindow } =
    useCalculatorStore();
  const rows = useCompiledFns();
  const plotted = useMemo(
    () => rows.filter((r) => r.fn?.ok).map((r) => ({ fn: r.fn!, color: r.color })),
    [rows],
  );

  // Quick keys type into whichever y= box was touched last, at its cursor.
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const selections = useRef<Record<number, { start: number; end: number }>>({});
  const [activeRow, setActiveRow] = useState(0);

  const quickInsert = (text: string) => {
    const i = Math.min(activeRow, rows.length - 1);
    const raw = rows[i].raw;
    const sel = selections.current[i] ?? { start: raw.length, end: raw.length };
    const s = Math.min(sel.start, raw.length);
    const e = Math.min(Math.max(sel.end, s), raw.length);
    setExpression(i, raw.slice(0, s) + text + raw.slice(e));
    selections.current[i] = { start: s + text.length, end: s + text.length };
    inputRefs.current[i]?.focus();
  };

  const analysis = useMemo(() => {
    // The numeric solvers return values like -1.593e-20 for roots that are
    // really 0; snap anything negligible at the window's scale to exactly 0
    // so markers and labels read sensibly.
    const snapX = zeroSnapper(window.xmax - window.xmin);
    const snapY = zeroSnapper(window.ymax - window.ymin);
    const roots = plotted.map(({ fn, color }) => ({
      color,
      xs: findRoots(fn, window.xmin, window.xmax).slice(0, 6).map(snapX),
      yIntercept: snapY(fn.at(0)),
    }));
    const intersections: { point: Point; color: string }[] = [];
    for (let i = 0; i < plotted.length; i++) {
      for (let j = i + 1; j < plotted.length; j++) {
        for (const p of findIntersections(
          plotted[i].fn,
          plotted[j].fn,
          window.xmin,
          window.xmax,
        ).slice(0, 6)) {
          if (p.y >= window.ymin && p.y <= window.ymax) {
            intersections.push({ point: { x: snapX(p.x), y: snapY(p.y) }, color: plotted[j].color });
          }
        }
      }
    }
    return { roots, intersections };
  }, [plotted, window]);

  const markers = useMemo(
    () => [
      ...analysis.roots.flatMap((r) =>
        r.xs.map((x) => ({ point: { x, y: 0 }, color: r.color })),
      ),
      ...analysis.intersections,
    ],
    [analysis],
  );

  const zoom = (factor: number) => setWindow(scaleWindow(window, factor));
  const pan = (dxFrac: number, dyFrac: number) => {
    const dx = (window.xmax - window.xmin) * dxFrac;
    const dy = (window.ymax - window.ymin) * dyFrac;
    setWindow({
      xmin: window.xmin + dx,
      xmax: window.xmax + dx,
      ymin: window.ymin + dy,
      ymax: window.ymax + dy,
    });
  };

  return (
    <YStack gap={10}>
      {rows.map((row, i) => (
        <YStack key={i} gap={2}>
          <XStack alignItems="center" gap={8}>
            <YStack width={10} height={10} borderRadius={5} backgroundColor={row.color} />
            <Text fontWeight="700" width={34} color="#111827">
              y{i + 1} =
            </Text>
            <Input
              ref={((el: TextInput | null) => {
                inputRefs.current[i] = el;
              }) as never}
              flex={1}
              value={row.raw}
              onChangeText={(v) => setExpression(i, v)}
              onFocus={() => setActiveRow(i)}
              onSelectionChange={(e) => {
                selections.current[i] = e.nativeEvent.selection;
              }}
              placeholder="2x + 3"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              backgroundColor="#fff"
              borderColor={row.fn && !row.fn.ok ? COLORS.bad : COLORS.border}
              aria-label={`y${i + 1}`}
            />
            {rows.length > 1 && (
              <GhostButton size="$2" onPress={() => removeExpression(i)} aria-label={`remove y${i + 1}`}>
                ✕
              </GhostButton>
            )}
          </XStack>
          {row.fn && !row.fn.ok ? (
            <Text color={COLORS.bad} fontSize={12} paddingLeft={52}>
              {row.fn.error}
            </Text>
          ) : null}
        </YStack>
      ))}

      <XStack gap={6} flexWrap="wrap">
        {QUICK_KEYS.map((k) => (
          <Button
            key={k.label}
            size="$2"
            minWidth={44}
            paddingHorizontal={8}
            borderRadius={999}
            backgroundColor="#e8ebf1"
            color="#1f2937"
            fontWeight="700"
            fontSize={15}
            hoverStyle={{ backgroundColor: '#d6dbe4' }}
            pressStyle={{ backgroundColor: '#d6dbe4' }}
            onPress={() => quickInsert(k.insert)}
            aria-label={k.aria}
          >
            {k.label}
          </Button>
        ))}
      </XStack>

      <XStack gap={8} flexWrap="wrap" alignItems="center">
        {rows.length < MAX_EXPRESSIONS && (
          <SecondaryButton size="$2" onPress={addExpression}>
            {t('addFunction')}
          </SecondaryButton>
        )}
        <XStack flex={1} />
        <SecondaryButton size="$2" onPress={() => zoom(1.5)} aria-label="zoom out">
          −
        </SecondaryButton>
        <SecondaryButton size="$2" onPress={() => zoom(1 / 1.5)} aria-label="zoom in">
          +
        </SecondaryButton>
        {Platform.OS !== 'web' && (
          <>
            <SecondaryButton size="$2" onPress={() => pan(-0.25, 0)} aria-label="pan left">
              ←
            </SecondaryButton>
            <SecondaryButton size="$2" onPress={() => pan(0.25, 0)} aria-label="pan right">
              →
            </SecondaryButton>
            <SecondaryButton size="$2" onPress={() => pan(0, 0.25)} aria-label="pan up">
              ↑
            </SecondaryButton>
            <SecondaryButton size="$2" onPress={() => pan(0, -0.25)} aria-label="pan down">
              ↓
            </SecondaryButton>
          </>
        )}
        <GhostButton size="$2" onPress={resetWindow}>
          {t('reset')}
        </GhostButton>
      </XStack>

      <GraphPlot fns={plotted} window={window} onWindowChange={setWindow} markers={markers} />
      {Platform.OS === 'web' && <Muted>{t('graphHint')}</Muted>}

      {plotted.length > 0 && (
        <YStack gap={4}>
          {analysis.roots.map((r, i) => (
            <YStack key={i} gap={4}>
              <XStack gap={6} alignItems="center" flexWrap="wrap">
                <YStack width={8} height={8} borderRadius={4} backgroundColor={r.color} />
                <Text fontSize={13} color={COLORS.muted}>
                  {t('xIntercepts')}:{' '}
                  {r.xs.length
                    ? r.xs.map((x) => `x = ${formatNumber(Number(x.toPrecision(6)))}`).join(',  ')
                    : t('none')}
                </Text>
              </XStack>
              <XStack gap={6} alignItems="center" flexWrap="wrap">
                <YStack width={8} height={8} borderRadius={4} backgroundColor={r.color} />
                <Text fontSize={13} color={COLORS.muted}>
                  {t('yIntercept')}:{' '}
                  {Number.isFinite(r.yIntercept)
                    ? `y = ${formatNumber(Number(r.yIntercept.toPrecision(6)))}`
                    : t('none')}
                </Text>
              </XStack>
            </YStack>
          ))}
          {plotted.length > 1 && (
            <Text fontSize={13} color={COLORS.muted}>
              {t('intersections')}:{' '}
              {analysis.intersections.length
                ? analysis.intersections
                    .map(
                      ({ point }) =>
                        `(${formatNumber(Number(point.x.toPrecision(6)))}, ${formatNumber(Number(point.y.toPrecision(6)))})`,
                    )
                    .join(',  ')
                : t('none')}
            </Text>
          )}
        </YStack>
      )}
    </YStack>
  );
}

/** Rounds values that are ~0 at the given scale (numeric-solver noise) to 0. */
function zeroSnapper(span: number): (v: number) => number {
  const tol = Math.abs(span) * 1e-7;
  return (v) => (Math.abs(v) < tol ? 0 : v);
}

function scaleWindow(w: GraphWindow, factor: number): GraphWindow {
  const cx = (w.xmin + w.xmax) / 2;
  const cy = (w.ymin + w.ymax) / 2;
  const sx = ((w.xmax - w.xmin) / 2) * factor;
  const sy = ((w.ymax - w.ymin) / 2) * factor;
  if (sx < 1e-9 || sx > 1e12) return w;
  return { xmin: cx - sx, xmax: cx + sx, ymin: cy - sy, ymax: cy + sy };
}
