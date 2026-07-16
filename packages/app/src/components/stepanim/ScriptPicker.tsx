/**
 * Uniform-width grid for choosing among several animation scripts.
 *
 * Each chip shares an equal flex basis and grows to fill its row, so the
 * buttons snap into even columns regardless of label length (2 on a phone,
 * more on wider screens) instead of the ragged wrap you get from
 * content-width chips. Long topic names wrap onto multiple lines inside the
 * chip (the row stretches so chips stay equal height) rather than
 * overflowing. If this catalog ever grows past ~12-15 topics, consider
 * swapping this grid for a searchable dropdown/select.
 */
import { Text, XStack, type SizeTokens } from 'tamagui';
import { useI18n } from '../../lib/i18n';
import { SecondaryButton, useAccent } from '../ui';
import type { EqScript } from './model';

export function ScriptPicker({
  scripts,
  selectedId,
  onSelect,
  size,
}: {
  scripts: EqScript[];
  selectedId: string;
  onSelect: (id: string) => void;
  size?: SizeTokens;
}) {
  const { locale } = useI18n();
  const accent = useAccent();
  if (scripts.length < 2) return null;
  return (
    <XStack gap={8} flexWrap="wrap" alignItems="stretch">
      {scripts.map((s) => {
        const selected = s.id === selectedId;
        return (
          <SecondaryButton
            key={s.id}
            flexGrow={1}
            flexBasis={140}
            minWidth={140}
            height="auto"
            minHeight={44}
            paddingVertical={8}
            {...(size ? { size } : {})}
            onPress={() => onSelect(s.id)}
            {...(selected ? { backgroundColor: accent } : {})}
          >
            {/* Explicit Text child so long topic names wrap onto multiple
                lines instead of overflowing the fixed-width chip. */}
            <Text
              textAlign="center"
              fontWeight="700"
              lineHeight={18}
              color={selected ? 'white' : accent}
            >
              {locale === 'es' ? s.titleEs : s.titleEn}
            </Text>
          </SecondaryButton>
        );
      })}
    </XStack>
  );
}
