/**
 * Table tab: TI-style table of values for the graph-tab functions. Rows come
 * from the engine's tableValues; the start/step controls page through x.
 */
import { useMemo } from 'react';
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

  return (
    <YStack gap={10}>
      <XStack gap={10} alignItems="center" flexWrap="wrap">
        <Text fontWeight="700">{t('startAt')}</Text>
        <Input
          width={90}
          defaultValue={String(start)}
          onChangeText={(v) => setTable(num(v, start), step)}
          inputMode="numeric"
          backgroundColor="#fff"
          aria-label={t('startAt')}
        />
        <Text fontWeight="700">Δx =</Text>
        <Input
          width={90}
          defaultValue={String(step)}
          onChangeText={(v) => setTable(start, num(v, step) || 1)}
          inputMode="numeric"
          backgroundColor="#fff"
          aria-label="Δx"
        />
        <SecondaryButton size="$2" onPress={() => setTable(start - ROWS * step, step)} aria-label="previous rows">
          ▲
        </SecondaryButton>
        <SecondaryButton size="$2" onPress={() => setTable(start + ROWS * step, step)} aria-label="next rows">
          ▼
        </SecondaryButton>
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
