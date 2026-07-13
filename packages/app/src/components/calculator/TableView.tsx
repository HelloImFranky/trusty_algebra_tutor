/**
 * Table tab: TI-style table of values for the graph-tab functions. Rows come
 * from the engine's tableValues; the start/step controls page through x.
 */
import { useEffect, useMemo, useState } from 'react';
import { Input, Text, XStack, YStack } from 'tamagui';
import { tableValues } from '@tutor/core';
import { useI18n } from '../../lib/i18n';
import { Muted, SecondaryButton, COLORS } from '../ui';
import { useCalculatorStore } from './store';
import { useCompiledFns } from './useCompiledFns';

const ROWS = 12;

export function TableView() {
  const { t } = useI18n();
  const start = useCalculatorStore((s) => s.tableStart);
  const step = useCalculatorStore((s) => s.tableStep);
  const setTable = useCalculatorStore((s) => s.setTable);
  const rows = useCompiledFns();
  const plotted = useMemo(() => rows.filter((r) => r.fn?.ok), [rows]);

  const data = useMemo(
    () => tableValues(plotted.map((r) => r.fn!), start, step, ROWS),
    [plotted, start, step],
  );

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return v.trim() !== '' && Number.isFinite(n) ? n : fallback;
  };

  // The text fields are locally owned so half-typed values ("-", "1.")
  // survive; non-keystroke changes to the start (paging, session hydration)
  // are written back into the field explicitly.
  const hydrated = useCalculatorStore((s) => s.hydrated);
  const [startText, setStartText] = useState(String(start));
  const [stepText, setStepText] = useState(String(step));
  useEffect(() => {
    const s = useCalculatorStore.getState();
    setStartText(String(s.tableStart));
    setStepText(String(s.tableStep));
  }, [hydrated]);

  const page = (dir: 1 | -1) => {
    const next = start + dir * ROWS * step;
    setStartText(String(next));
    setTable(next, step);
  };

  return (
    <YStack gap={10}>
      {/* Inputs stacked on the left so the page arrows always fit beside them. */}
      <XStack gap={12} alignItems="center">
        <YStack gap={8} flexShrink={1}>
          <XStack gap={10} alignItems="center">
            <Text fontWeight="700" width={106} numberOfLines={1}>
              {t('startAt')}
            </Text>
            <Input
              width={110}
              value={startText}
              onChangeText={(v) => {
                setStartText(v);
                setTable(num(v, start), step);
              }}
              inputMode="numeric"
              backgroundColor="#fff"
              aria-label={t('startAt')}
            />
          </XStack>
          <XStack gap={10} alignItems="center">
            <Text fontWeight="700" width={106} numberOfLines={1}>
              Δx =
            </Text>
            <Input
              width={110}
              value={stepText}
              onChangeText={(v) => {
                setStepText(v);
                setTable(start, num(v, step) || 1);
              }}
              inputMode="numeric"
              backgroundColor="#fff"
              aria-label="Δx"
            />
          </XStack>
        </YStack>
        <YStack gap={8}>
          <SecondaryButton size="$2" onPress={() => page(-1)} aria-label="previous rows">
            ▲
          </SecondaryButton>
          <SecondaryButton size="$2" onPress={() => page(1)} aria-label="next rows">
            ▼
          </SecondaryButton>
        </YStack>
      </XStack>

      {plotted.length === 0 ? (
        <Muted>{t('graphTab')} →</Muted>
      ) : (
        <YStack borderWidth={1} borderColor={COLORS.border} borderRadius={10} overflow="hidden">
          <XStack backgroundColor="#f8f9fb" paddingVertical={8} paddingHorizontal={10}>
            <Text flex={1} fontWeight="800" color="#111827">
              x
            </Text>
            {plotted.map((r, i) => (
              <Text key={i} flex={1} fontWeight="800" color={r.color} numberOfLines={1}>
                y{rows.indexOf(r) + 1}
              </Text>
            ))}
          </XStack>
          {data.map((row, ri) => (
            <XStack
              key={row.x}
              paddingVertical={6}
              paddingHorizontal={10}
              backgroundColor={ri % 2 ? '#fbfcfe' : '#fff'}
            >
              <Text flex={1} fontWeight="700" color="#111827">
                {row.x}
              </Text>
              {row.values.map((v, vi) => (
                <Text key={vi} flex={1} color="#374151" numberOfLines={1}>
                  {v}
                </Text>
              ))}
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  );
}
