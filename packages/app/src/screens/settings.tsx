/**
 * Account settings (all roles): rename display name / username and change
 * password. Both are self-service endpoints — before this screen, credentials
 * could only be changed with a direct SQL UPDATE.
 */
import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { getAuth, setAuth, useAuth } from '../lib/auth';
import { useRequireAuth } from '../components/AppChrome';
import {
  AppCard,
  AppInput,
  COLORS,
  Feedback,
  Muted,
  PrimaryButton,
  Screen,
  SubTitle,
  Title,
} from '../components/ui';

export function SettingsScreen() {
  const { t } = useI18n();
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
          backgroundColor="#fff"
          borderColor={COLORS.border}
        />
        <Muted>{t('username')}</Muted>
        <AppInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholder={t('username')}
          backgroundColor="#fff"
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
          backgroundColor="#fff"
          borderColor={COLORS.border}
        />
        <AppInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder={t('newPassword')}
          backgroundColor="#fff"
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
    </Screen>
  );
}
