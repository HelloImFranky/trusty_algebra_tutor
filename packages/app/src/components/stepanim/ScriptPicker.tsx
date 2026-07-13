/** Chip row for choosing among several animation scripts. */
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
