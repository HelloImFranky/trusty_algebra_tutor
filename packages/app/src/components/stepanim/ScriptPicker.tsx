/**
 * Uniform-width grid for choosing among several animation scripts.
 *
 * Each chip shares an equal flex basis and grows to fill its row, so the
 * buttons snap into even columns regardless of label length (2 on a phone,
 * more on wider screens) instead of the ragged wrap you get from
 * content-width chips. If this catalog ever grows past ~12-15 topics,
 * consider swapping this grid for a searchable dropdown/select.
 */
import { XStack, type SizeTokens } from 'tamagui';
import { useI18n } from '../../lib/i18n';
import { BRAND, SecondaryButton } from '../ui';
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
  if (scripts.length < 2) return null;
  return (
    <XStack gap={8} flexWrap="wrap">
      {scripts.map((s) => (
        <SecondaryButton
          key={s.id}
          flexGrow={1}
          flexBasis={140}
          minWidth={140}
          {...(size ? { size } : {})}
          onPress={() => onSelect(s.id)}
          {...(s.id === selectedId ? { backgroundColor: BRAND, color: 'white' } : {})}
        >
          {locale === 'es' ? s.titleEs : s.titleEn}
        </SecondaryButton>
      ))}
    </XStack>
  );
}
