/**
 * Graph tab: expression list, the pan/zoom viewport (GraphPlot, platform
 * specific), and engine-computed points of interest (x-intercepts and
 * intersections) — the same structured data an AI tutor explanation can use.
 */
import { useMemo } from 'react';
import { Platform } from 'react-native';
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

  const analysis = useMemo(() => {
    const roots = plotted.map(({ fn, color }) => ({
      color,
      xs: findRoots(fn, window.xmin, window.xmax).slice(0, 6),
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
            intersections.push({ point: p, color: plotted[j].color });
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
              flex={1}
              value={row.raw}
              onChangeText={(v) => setExpression(i, v)}
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
            <XStack key={i} gap={6} alignItems="center" flexWrap="wrap">
              <YStack width={8} height={8} borderRadius={4} backgroundColor={r.color} />
              <Text fontSize={13} color={COLORS.muted}>
                {t('xIntercepts')}:{' '}
                {r.xs.length
                  ? r.xs.map((x) => `x = ${formatNumber(Number(x.toPrecision(6)))}`).join(',  ')
                  : t('none')}
              </Text>
            </XStack>
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

function scaleWindow(w: GraphWindow, factor: number): GraphWindow {
  const cx = (w.xmin + w.xmax) / 2;
  const cy = (w.ymin + w.ymax) / 2;
  const sx = ((w.xmax - w.xmin) / 2) * factor;
  const sy = ((w.ymax - w.ymin) / 2) * factor;
  if (sx < 1e-9 || sx > 1e12) return w;
  return { xmin: cx - sx, xmax: cx + sx, ymin: cy - sy, ymax: cy + sy };
}
