/**
 * AI-tutor usage & billing dashboard for the admin view (Option 2 of
 * docs/tutor-usage-dashboard-plan.md). Renders the numbers served by
 * admin.usage.summary — the browser only ever sees aggregates; the
 * Anthropic Admin key stays server-side.
 *
 * Chart choices (dataviz method): headline values are stat tiles, not
 * charts; the daily trend is a single-series bar chart in one hue (the
 * app accent), so identity is carried by labels/position, never by
 * color alone; the per-model split is direct-labeled horizontal bars
 * (the row label is the identity, the bar is the magnitude) and doubles
 * as the table view. All text wears theme ink tokens. Tapping a day bar
 * shows that day's detail — the touch-appropriate stand-in for a hover
 * tooltip. Everything derives from mode-aware tokens, so light and dark
 * both work.
 */
import { useMemo, useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { fillDays, type UsageSummary } from '@tutor/core/admin';
import { useI18n } from '../lib/i18n';
import { Muted, RADIUS, useAccent, useTokens } from './ui';

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
}

export function fmtUsd(n: number): string {
  if (n > 0 && n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
}

const fmtPct = (r: number) => `${Math.round(r * 100)}%`;
/** '2026-07-12' → '7/12' — locale-neutral, fits under a narrow bar. */
const fmtDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** Headline value as a stat tile — the "not a chart" form. */
function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  const tokens = useTokens();
  return (
    <YStack
      flex={1}
      minWidth={120}
      backgroundColor={tokens.subtle}
      borderRadius={RADIUS.control}
      paddingVertical={10}
      paddingHorizontal={12}
      gap={2}
    >
      <Text fontSize={20} fontWeight="800" color={tokens.ink}>
        {value}
      </Text>
      <Muted size={11.5}>{label}</Muted>
      {sub ? <Muted size={10.5}>{sub}</Muted> : null}
    </YStack>
  );
}

const CHART_HEIGHT = 64;

/** Single-series daily bars. One hue (accent); tap a bar for its detail. */
function DayBars({ summary }: { summary: UsageSummary }) {
  const { t } = useI18n();
  const tokens = useTokens();
  const accent = useAccent();
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => fillDays(summary), [summary]);
  const maxCost = Math.max(...days.map((d) => d.costUsd));
  const peak = days.reduce((a, b) => (b.costUsd > a.costUsd ? b : a), days[0]);
  const selectedDay = days.find((d) => d.date === selected) ?? null;

  return (
    <YStack gap={4}>
      <XStack justifyContent="space-between" alignItems="center">
        <Muted size={12}>{t('usageDailySpend')}</Muted>
        {maxCost > 0 && (
          <Muted size={11}>
            {t('usagePeak')} {fmtUsd(peak.costUsd)} · {fmtDay(peak.date)}
          </Muted>
        )}
      </XStack>
      <XStack height={CHART_HEIGHT} alignItems="flex-end" gap={2}>
        {days.map((d) => {
          const ratio = maxCost > 0 ? d.costUsd / maxCost : 0;
          // 2px floor keeps active-but-tiny days visible; zero days show
          // as a hairline of the track color so the axis stays continuous.
          const h = d.costUsd > 0 ? Math.max(3, Math.round(ratio * CHART_HEIGHT)) : 1;
          const isSelected = selected === d.date;
          return (
            <YStack
              key={d.date}
              flex={1}
              height="100%"
              justifyContent="flex-end"
              cursor="pointer"
              hoverStyle={{ opacity: 0.75 }}
              onPress={() => setSelected(isSelected ? null : d.date)}
            >
              <YStack
                height={h}
                borderTopLeftRadius={3}
                borderTopRightRadius={3}
                backgroundColor={d.costUsd > 0 ? accent : tokens.border}
                opacity={isSelected ? 1 : 0.85}
              />
            </YStack>
          );
        })}
      </XStack>
      <XStack justifyContent="space-between">
        <Muted size={10.5}>{fmtDay(days[0].date)}</Muted>
        <Muted size={10.5}>{fmtDay(days[days.length - 1].date)}</Muted>
      </XStack>
      {selectedDay && (
        <Muted size={11.5}>
          {fmtDay(selectedDay.date)} — {fmtUsd(selectedDay.costUsd)} ·{' '}
          {fmtTokens(selectedDay.totalTokens)} {t('usageTokensUnit')}
        </Muted>
      )}
    </YStack>
  );
}

/** Direct-labeled horizontal bars: the label is the identity, the bar is
 * the magnitude — and the rows double as the table view. */
function ModelBars({ summary }: { summary: UsageSummary }) {
  const { t } = useI18n();
  const tokens = useTokens();
  const accent = useAccent();
  const max = Math.max(...summary.byModel.map((m) => m.totalTokens), 1);
  if (summary.byModel.length === 0) return null;
  return (
    <YStack gap={6}>
      <Muted size={12}>{t('usageByModel')}</Muted>
      {summary.byModel.map((m) => (
        <YStack key={m.model} gap={2}>
          <XStack justifyContent="space-between" gap={8}>
            <Text fontSize={12.5} fontWeight="700" color={tokens.ink} numberOfLines={1} flexShrink={1}>
              {m.model}
            </Text>
            <Muted size={11.5}>
              {fmtTokens(m.totalTokens)} {t('usageTokensUnit')} · {fmtUsd(m.costUsd)}
            </Muted>
          </XStack>
          <XStack height={8} backgroundColor={tokens.subtle} borderRadius={4} overflow="hidden">
            <YStack
              width={`${Math.max(2, Math.round((m.totalTokens / max) * 100))}%`}
              backgroundColor={accent}
              borderRadius={4}
            />
          </XStack>
        </YStack>
      ))}
    </YStack>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export function UsageDashboard({ summary }: { summary: UsageSummary }) {
  const { t } = useI18n();
  const days = Math.max(1, summary.windowDays);
  return (
    <YStack gap={12}>
      <XStack gap={8} flexWrap="wrap">
        <StatTile
          value={fmtUsd(summary.totals.costUsd)}
          label={t('usageSpend')}
          sub={`${fmtUsd(summary.totals.costUsd / days)} ${t('usageAvgPerDay')}`}
        />
        <StatTile
          value={fmtTokens(summary.totals.totalTokens)}
          label={t('usageTokens')}
          sub={`${fmtTokens(summary.totals.outputTokens)} ${t('usageOutputShort')}`}
        />
        <StatTile
          value={fmtPct(summary.cacheHitRate)}
          label={t('usageCacheHit')}
          sub={t('usageCacheHitSub')}
        />
      </XStack>
      <DayBars summary={summary} />
      <ModelBars summary={summary} />
      <Muted size={11}>
        {summary.workspaceScoped ? t('usageScopedNote') : t('usageOrgWideNote')}
      </Muted>
    </YStack>
  );
}

/** Small 7d/30d window switcher, matching the app's segmented pills. */
export function UsageWindowPicker({
  value,
  onChange,
}: {
  value: '7d' | '30d';
  onChange: (w: '7d' | '30d') => void;
}) {
  const { t } = useI18n();
  const tokens = useTokens();
  const accent = useAccent();
  return (
    <XStack gap={6}>
      {(['7d', '30d'] as const).map((w) => {
        const active = value === w;
        return (
          <Text
            key={w}
            fontSize={12}
            fontWeight="800"
            paddingVertical={4}
            paddingHorizontal={10}
            borderRadius={999}
            backgroundColor={active ? accent : tokens.subtle}
            color={active ? '#ffffff' : tokens.ink}
            cursor="pointer"
            pressStyle={{ opacity: 0.85 }}
            onPress={() => onChange(w)}
          >
            {w === '7d' ? t('usageWindow7') : t('usageWindow30')}
          </Text>
        );
      })}
    </XStack>
  );
}
