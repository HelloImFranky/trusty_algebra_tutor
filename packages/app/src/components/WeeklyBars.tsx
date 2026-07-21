/**
 * Generic weekly bar chart (Monday-bucketed), the same visual language as
 * the sprint stats chart: accent bars, month labels on the axis, a value
 * label on the peak bar only. Servers omit empty weeks; the axis is rebuilt
 * Monday-by-Monday so the chart reads as linear time.
 */
import { Text, XStack, YStack } from 'tamagui';
import { useI18n } from '../lib/i18n';
import { useAccent, useTokens } from './ui';

export interface WeekValue {
  /** ISO date (YYYY-MM-DD) of the week's Monday. */
  weekStart: string;
  value: number;
  /** Peak-bar label; defaults to String(value). */
  display?: string;
}

/** Monday (UTC) of the week containing `d` — matches date_trunc('week'). */
export function mondayOf(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  out.setUTCDate(out.getUTCDate() - ((out.getUTCDay() + 6) % 7));
  return out;
}

export function fillWeekValues(points: WeekValue[], fallbackStart: string): WeekValue[] {
  const byWeek = new Map(points.map((p) => [p.weekStart, p]));
  const start = mondayOf(new Date(`${points[0]?.weekStart ?? fallbackStart}T00:00:00Z`));
  const last = mondayOf(new Date());
  const out: WeekValue[] = [];
  for (let d = start; d <= last; d = new Date(d.getTime() + 7 * 86_400_000)) {
    const key = d.toISOString().slice(0, 10);
    out.push(byWeek.get(key) ?? { weekStart: key, value: 0 });
  }
  return out;
}

export function WeeklyBars({
  points,
  yearStart,
  height = 90,
}: {
  points: WeekValue[];
  yearStart: string;
  height?: number;
}) {
  const { locale } = useI18n();
  const tokens = useTokens();
  const accent = useAccent();
  const weeks = fillWeekValues(points, yearStart);
  const max = Math.max(1, ...weeks.map((w) => w.value));
  const peakIndex = weeks.findIndex((w) => w.value === max);
  let lastMonth = -1;
  return (
    <YStack gap={4}>
      <XStack gap={2} height={height + 16} alignItems="flex-end">
        {weeks.map((w, i) => {
          const h = Math.round((w.value / max) * height);
          return (
            <YStack key={w.weekStart} flex={1} alignItems="center" gap={2} justifyContent="flex-end">
              {i === peakIndex && w.value > 0 && (
                <Text fontSize={10} fontWeight="800" color={tokens.ink}>
                  {w.display ?? w.value}
                </Text>
              )}
              <YStack
                width="100%"
                maxWidth={18}
                height={Math.max(h, 2)}
                backgroundColor={w.value > 0 ? accent : tokens.subtle}
                borderTopLeftRadius={4}
                borderTopRightRadius={4}
              />
            </YStack>
          );
        })}
      </XStack>
      <XStack gap={2}>
        {weeks.map((w) => {
          const d = new Date(`${w.weekStart}T00:00:00Z`);
          const month = d.getUTCMonth();
          const label = month !== lastMonth;
          lastMonth = month;
          return (
            <YStack key={w.weekStart} flex={1} alignItems="flex-start">
              {label && (
                <Text fontSize={9} color={tokens.muted}>
                  {d.toLocaleDateString(locale === 'es' ? 'es' : 'en', {
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </Text>
              )}
            </YStack>
          );
        })}
      </XStack>
    </YStack>
  );
}
