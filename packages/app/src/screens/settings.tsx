/**
 * Options (all roles): profile rename, password change, language, and
 * appearance (light/dark mode + entry point to the color picker). Language
 * and Appearance moved here from the top chrome in the UI/UX refresh
 * (Phase 5) so every account/preference toggle lives in one place.
 * Each concern is its own titled AppCard so the screen scans as a stack
 * of tasks rather than a wall of controls.
 */
import { useState } from 'react';
import { Link } from 'solito/link';
import { ChevronRight, Palette } from '@tamagui/lucide-icons';
import { Button, Text, XStack, YStack } from 'tamagui';
import { trpc } from '../lib/trpc';
import { useI18n, type Locale } from '../lib/i18n';
import { useTheme, type ThemeMode } from '../lib/theme';
import { getAuth, setAuth, useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import {
  AppCard,
  AppInput,
  COLORS,
  Feedback,
  Muted,
  PrimaryButton,
  RADIUS,
  Screen,
  SubTitle,
  Title,
  useAccent,
  useTokens,
} from '../components/ui';

/** One button in a segmented control (Language: EN/ES; Mode: Auto/Light/Dark).
 * The selected item fills with the live accent; the rest read as inactive
 * subtle-surface pills so the row scans as one control. */
function SegmentedOption<T extends string>({
  value,
  current,
  label,
  onSelect,
}: {
  value: T;
  current: T;
  label: string;
  onSelect: (v: T) => void;
}) {
  const accent = useAccent();
  const tokens = useTokens();
  const active = value === current;
  return (
    <Button
      flex={1}
      size="$3"
      backgroundColor={active ? accent : tokens.subtle}
      color={active ? '#ffffff' : tokens.ink}
      fontWeight="800"
      borderRadius={RADIUS.control}
      pressStyle={{ opacity: 0.85 }}
      onPress={() => onSelect(value)}
    >
      {label}
    </Button>
  );
}

export function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const tokens = useTokens();
  const authed = useRequireAuth();
  const user = useAuth((s) => s.auth?.user);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Seed the profile fields from the signed-in user the first time we have one.
  const [seeded, setSeeded] = useState(false);
  if (user && !seeded) {
    setDisplayName(user.displayName);
    setUsername(user.username);
    setSeeded(true);
  }

  const profile = trpc.auth.updateProfile.useMutation({
    onSuccess: (data) => {
      const cur = getAuth();
      if (cur) setAuth({ ...cur, user: data.user, accessToken: data.accessToken });
    },
  });
  const password = trpc.auth.changePassword.useMutation({
    onSuccess: (data) => {
      const cur = getAuth();
      // Web keeps the (new) refresh token in an httpOnly cookie; native gets it
      // in the body — persist whichever we received so the session survives.
      if (cur)
        setAuth({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: 'refreshToken' in data ? data.refreshToken : cur.refreshToken,
        });
      setCurrentPassword('');
      setNewPassword('');
    },
  });

  if (!authed || !user) return <Screen>{null}</Screen>;

  const profileDirty =
    displayName.trim() !== user.displayName || username.trim() !== user.username;
  const profileValid = displayName.trim().length >= 1 && username.trim().length >= 3;
  const passwordValid = currentPassword.length >= 1 && newPassword.length >= 8;

  return (
    <Screen maxWidth={620}>
      <Title>⚙️ {t('settings')}</Title>

      <AppCard gap={10}>
        <SubTitle>{t('profileSection')}</SubTitle>
        <Muted>{t('displayNameLabel')}</Muted>
        <AppInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('displayNameLabel')}
          backgroundColor={tokens.surface}
          borderColor={COLORS.border}
        />
        <Muted>{t('username')}</Muted>
        <AppInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholder={t('username')}
          backgroundColor={tokens.surface}
          borderColor={COLORS.border}
        />
        <PrimaryButton
          disabled={profile.isPending || !profileDirty || !profileValid}
          opacity={profileDirty && profileValid ? 1 : 0.5}
          onPress={() =>
            profile.mutate({ displayName: displayName.trim(), username: username.trim() })
          }
        >
          {t('saveChanges')}
        </PrimaryButton>
        {profile.isSuccess && !profileDirty && <Feedback kind="good">{t('profileUpdated')}</Feedback>}
        {profile.error && <Feedback kind="bad">{profile.error.message}</Feedback>}
      </AppCard>

      <AppCard gap={10}>
        <SubTitle>{t('changePasswordTitle')}</SubTitle>
        <Muted>{t('changePasswordNote')}</Muted>
        <AppInput
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder={t('currentPassword')}
          backgroundColor={tokens.surface}
          borderColor={COLORS.border}
        />
        <AppInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder={t('newPassword')}
          backgroundColor={tokens.surface}
          borderColor={COLORS.border}
        />
        {newPassword.length > 0 && newPassword.length < 8 && (
          <Muted>{t('passwordTooShort')}</Muted>
        )}
        <PrimaryButton
          disabled={password.isPending || !passwordValid}
          opacity={passwordValid ? 1 : 0.5}
          onPress={() => password.mutate({ currentPassword, newPassword })}
        >
          {t('changePasswordTitle')}
        </PrimaryButton>
        {password.isSuccess && <Feedback kind="good">{t('passwordChanged')}</Feedback>}
        {password.error && <Feedback kind="bad">{password.error.message}</Feedback>}
      </AppCard>

      <AppCard gap={10}>
        <SubTitle>{t('languageSectionTitle')}</SubTitle>
        <XStack gap={8}>
          <SegmentedOption<Locale> value="en" current={locale} label={t('english')} onSelect={setLocale} />
          <SegmentedOption<Locale> value="es" current={locale} label={t('spanish')} onSelect={setLocale} />
        </XStack>
      </AppCard>

      <AppCard gap={10}>
        <SubTitle>{t('appearanceSectionTitle')}</SubTitle>
        <XStack gap={8}>
          <SegmentedOption<ThemeMode> value="auto" current={mode} label={t('modeAuto')} onSelect={setMode} />
          <SegmentedOption<ThemeMode> value="light" current={mode} label={t('modeLight')} onSelect={setMode} />
          <SegmentedOption<ThemeMode> value="dark" current={mode} label={t('modeDark')} onSelect={setMode} />
        </XStack>
        <Muted size={12}>{t('modeAutoNote')}</Muted>
        {/* Second row inside the Appearance card: the sole remaining path
            into the color picker after removing the chrome palette icon.
            Full-width tap target with a chevron so it reads as a link. */}
        <Link href="/appearance">
          <XStack
            backgroundColor={tokens.subtle}
            borderRadius={RADIUS.control}
            paddingVertical={12}
            paddingHorizontal={14}
            alignItems="center"
            gap={10}
          >
            <Palette size={18} color={tokens.ink} />
            <Text color={tokens.ink} fontWeight="700" fontSize={15} flex={1}>
              {t('changeAccentColor')}
            </Text>
            <ChevronRight size={18} color={tokens.ink} />
          </XStack>
        </Link>
        <YStack />
      </AppCard>
    </Screen>
  );
}
