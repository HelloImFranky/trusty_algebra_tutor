/**
 * Live sprint leaderboard, shared by the student Sprint page and the teacher
 * sprint-stats page (docs/sprint-leaderboard-plan.md). Students and teachers
 * see the SAME two stat columns: questions correct during the sprint (live
 * while a round runs, else today's best) and questions correct this week.
 * The data arrives pre-ranked from the server; callers poll and re-render.
 */
import { Text, XStack, YStack } from 'tamagui';
import { useI18n } from '../lib/i18n';
import { AppCard, Muted, SubTitle, useAccent, useTokens } from './ui';

export interface SprintLeaderboardEntry {
  id: number;
  displayName: string;
  /** The signed-in student's own row (student view only). */
  you?: boolean;
  inSprint: boolean;
  sprintCorrect: number;
  weekCorrect: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** Pulsing-dot "LIVE" tag for anything that refreshes on a short poll. */
export function LiveTag() {
  const accent = useAccent();
  return (
    <XStack gap={5} alignItems="center">
      <YStack width={8} height={8} borderRadius={4} backgroundColor={accent} />
      <Text fontSize={11} fontWeight="800" letterSpacing={1} color={accent}>
        LIVE
      </Text>
    </XStack>
  );
}

/** Fixed column widths keep the two stat columns aligned across rows. */
const STAT_WIDTH = 74;

export function SprintLeaderboardCard({
  rows,
  emptyHint,
}: {
  rows: SprintLeaderboardEntry[];
  emptyHint: string;
}) {
  const { t } = useI18n();
  const tokens = useTokens();
  const accent = useAccent();
  return (
    <AppCard gap={10}>
      <XStack justifyContent="space-between" alignItems="center">
        <SubTitle>⚡ {t('sprintLive')}</SubTitle>
        <LiveTag />
      </XStack>

      {/* Alone on the board (or an empty class): explain instead of a bare
          one-row "race". */}
      {(rows.length === 0 || (rows.length === 1 && rows[0].you)) && (
        <Muted size={12}>{emptyHint}</Muted>
      )}

      {rows.length > 0 && (
        <YStack>
          <XStack gap={8} alignItems="center" paddingVertical={4}>
            <YStack width={26} />
            <YStack flex={1}>
              <Muted size={11}>{t('sprintColStudent')}</Muted>
            </YStack>
            <YStack width={STAT_WIDTH} alignItems="flex-end">
              <Muted size={11}>{t('sprintLbSprint')}</Muted>
            </YStack>
            <YStack width={STAT_WIDTH} alignItems="flex-end">
              <Muted size={11}>{t('sprintLbWeek')}</Muted>
            </YStack>
          </XStack>
          {rows.map((r, i) => (
            <XStack
              key={r.id}
              gap={8}
              alignItems="center"
              paddingVertical={7}
              paddingHorizontal={r.you ? 8 : 0}
              marginHorizontal={r.you ? -8 : 0}
              borderRadius={r.you ? 12 : 0}
              backgroundColor={r.you ? tokens.subtle : 'transparent'}
              borderTopWidth={i === 0 ? 0 : 1}
              borderTopColor={tokens.border}
            >
              <YStack width={26} alignItems="center">
                <Text fontSize={13} fontWeight="800" color={tokens.muted}>
                  {MEDALS[i] ?? i + 1}
                </Text>
              </YStack>
              <XStack flex={1} gap={6} alignItems="center" flexWrap="wrap">
                <Text
                  fontSize={14}
                  fontWeight={r.you ? '800' : '600'}
                  color={tokens.ink}
                  flexShrink={1}
                >
                  {r.displayName}
                </Text>
                {r.you && (
                  <Text fontSize={11} fontWeight="800" color={accent}>
                    ({t('sprintLbYou')})
                  </Text>
                )}
                {r.inSprint && (
                  <Text fontSize={11} fontWeight="700" color={accent} aria-label={t('sprintLbRacing')}>
                    ⚡ {t('sprintLbRacing')}
                  </Text>
                )}
              </XStack>
              <YStack width={STAT_WIDTH} alignItems="flex-end">
                <Text fontSize={16} fontWeight="800" color={r.inSprint ? accent : tokens.ink}>
                  {r.sprintCorrect}
                </Text>
              </YStack>
              <YStack width={STAT_WIDTH} alignItems="flex-end">
                <Text fontSize={16} fontWeight="700" color={tokens.ink}>
                  {r.weekCorrect}
                </Text>
              </YStack>
            </XStack>
          ))}
        </YStack>
      )}
    </AppCard>
  );
}
