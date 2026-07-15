/**
 * Options (all roles): language, profile (with a collapsible password row),
 * appearance, and sign out — one titled AppCard per concern, ordered by how
 * often students touch them (language first for ES students who tend to
 * flip it before doing anything else). Password change hides behind a
 * disclosure row (chevron-down toggle) so the Profile card stays tight
 * until the student actually wants to update credentials.
 */
import { useState } from 'react';
import { Link } from 'solito/link';
import { useRouter } from 'solito/navigation';
import { ChevronDown, ChevronRight, KeyRound, LogOut, Palette } from '@tamagui/lucide-icons';
import { Button, Text, XStack, YStack } from 'tamagui';
import { trpc, logout } from '../lib/trpc';
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

/** Same "row-with-chevron" pattern the Appearance card uses for the color
 * picker link — reused here to disclose the password fields inline. Kept a
 * shared component so a future settings row (2FA, connected accounts, etc.)
 * gets the same visuals for free. */
function DisclosureRow({
  icon,
  label,
  open,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onPress: () => void;
}) {
  const tokens = useTokens();
  return (
    <XStack
      backgroundColor={tokens.subtle}
      borderRadius={RADIUS.control}
      paddingVertical={12}
      paddingHorizontal={14}
      alignItems="center"
      gap={10}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      {icon}
      <Text color={tokens.ink} fontWeight="700" fontSize={15} flex={1}>
        {label}
      </Text>
      {open ? (
        <ChevronDown size={18} color={tokens.ink} />
      ) : (
        <ChevronRight size={18} color={tokens.ink} />
      )}
    </XStack>
  );
}

export function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const tokens = useTokens();
  const router = useRouter();
  const authed = useRequireAuth();
  const user = useAuth((s) => s.auth?.user);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);

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
      setPasswordOpen(false); // collapse the row once the change succeeds
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

      {/* Card order: Language first (ES students flip it before anything
          else) → Profile (with collapsible password) → Appearance → Sign
          out. Sign out is intentionally last, separated as a
          destructive-ish action. */}
      <AppCard gap={10}>
        <SubTitle>{t('languageSectionTitle')}</SubTitle>
        <XStack gap={8}>
          <SegmentedOption<Locale> value="en" current={locale} label={t('english')} onSelect={setLocale} />
          <SegmentedOption<Locale> value="es" current={locale} label={t('spanish')} onSelect={setLocale} />
        </XStack>
      </AppCard>

      <AppCard gap={10}>
        <SubTitle>{t('profileSection')}</SubTitle>
        <Muted>{t('displayNameLabel')}</Muted>
        <AppInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('displayNameLabel')}
          color={tokens.ink}
          backgroundColor={tokens.surface}
          borderColor={tokens.border}
        />
        <Muted>{t('username')}</Muted>
        <AppInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholder={t('username')}
          color={tokens.ink}
          backgroundColor={tokens.surface}
          borderColor={tokens.border}
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

        {/* Password change lives inside Profile as a disclosure row — mirrors
            the Appearance card's "Change accent color →" pattern so both
            entry points look and behave the same. Clicking expands the row
            in place; a successful change collapses it (see onSuccess above). */}
        <DisclosureRow
          icon={<KeyRound size={18} color={tokens.ink} />}
          label={t('changePasswordTitle')}
          open={passwordOpen}
          onPress={() => setPasswordOpen((v) => !v)}
        />
        {passwordOpen && (
          <YStack gap={8}>
            <Muted>{t('changePasswordNote')}</Muted>
            <AppInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder={t('currentPassword')}
              color={tokens.ink}
              backgroundColor={tokens.surface}
              borderColor={tokens.border}
            />
            <AppInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder={t('newPassword')}
              color={tokens.ink}
              backgroundColor={tokens.surface}
              borderColor={tokens.border}
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
          </YStack>
        )}
      </AppCard>

      <AppCard gap={10}>
        <SubTitle>{t('appearanceSectionTitle')}</SubTitle>
        <XStack gap={8}>
          <SegmentedOption<ThemeMode> value="auto" current={mode} label={t('modeAuto')} onSelect={setMode} />
          <SegmentedOption<ThemeMode> value="light" current={mode} label={t('modeLight')} onSelect={setMode} />
          <SegmentedOption<ThemeMode> value="dark" current={mode} label={t('modeDark')} onSelect={setMode} />
        </XStack>
        <Muted size={12}>{t('modeAutoNote')}</Muted>
        {/* Full-width tap target navigating to the color picker — same
            visual as the DisclosureRow above so the two entry points feel
            like siblings. This one navigates instead of expands because
            the picker is too tall for an inline reveal. */}
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
      </AppCard>

      <AppCard gap={8}>
        <SubTitle>{t('signOutSection')}</SubTitle>
        <Muted>{t('signOutNote')}</Muted>
        <Button
          size="$3"
          backgroundColor={COLORS.badBg}
          color={COLORS.bad}
          fontWeight="800"
          borderRadius={RADIUS.control}
          pressStyle={{ opacity: 0.85 }}
          icon={<LogOut size={16} color={COLORS.bad} />}
          onPress={() => {
            void logout();
            router.replace('/login');
          }}
        >
          {t('logout')}
        </Button>
      </AppCard>
    </Screen>
  );
}
