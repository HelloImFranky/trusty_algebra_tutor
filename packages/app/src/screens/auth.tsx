/** Login / sign-up (COPPA-aware: under-13 students need a guardian email). */
import { useState } from 'react';
import { Link } from 'solito/link';
import { useRouter } from 'solito/navigation';
import { Checkbox, Label, Text, XStack, YStack } from 'tamagui';
import { client } from '../lib/trpc';
import { setAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import {
  AppCard,
  AppInput,
  Feedback,
  GhostButton,
  Muted,
  PrimaryButton,
  Screen,
  Title,
  useAccent,
  useTokens,
} from '../components/ui';

function Field({
  label,
  value,
  onChange,
  secure,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  keyboard?: 'default' | 'email-address' | 'number-pad';
}) {
  const tokens = useTokens();
  return (
    <YStack gap={4}>
      <Label fontSize={13} fontWeight="700" color={tokens.ink}>
        {label}
      </Label>
      <AppInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize="none"
        backgroundColor={tokens.surface}
        borderColor={tokens.border}
      />
    </YStack>
  );
}

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const tokens = useTokens();
  const accent = useAccent();
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [grade, setGrade] = useState('8');
  const [under13, setUnder13] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Where each role lands after signing in.
  const homeFor = (r: string) =>
    r === 'teacher' ? '/classes' : r === 'admin' ? '/admin' : '/';

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const tokens =
        mode === 'login'
          ? await client.auth.login.mutate({ username, password })
          : await client.auth.register.mutate(
              role === 'teacher'
                ? { role: 'teacher', username, password, displayName, locale, email: email || undefined }
                : {
                    role: 'student',
                    username,
                    password,
                    displayName,
                    grade: Number(grade) || undefined,
                    locale,
                    under13,
                    guardianEmail: under13 ? guardianEmail : undefined,
                  },
            );
      setAuth(tokens);
      router.replace(homeFor(tokens.user.role));
    } catch (err) {
      setError((err as Error).message || 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={440}>
      <AppCard gap={12}>
        <Title>{mode === 'login' ? t('login') : t('register')}</Title>
        {mode === 'register' && <Muted size={14}>{t('signupNote')}</Muted>}

        {mode === 'register' && (
          <XStack gap={8}>
            {(['student', 'teacher'] as const).map((r) => {
              const Btn = role === r ? PrimaryButton : GhostButton;
              return (
                <Btn key={r} flex={1} onPress={() => setRole(r)} aria-label={`role-${r}`}>
                  {r === 'student' ? t('signupAsStudent') : t('signupAsTeacher')}
                </Btn>
              );
            })}
          </XStack>
        )}

        <Field label={t('username')} value={username} onChange={setUsername} />
        <Field label={t('password')} value={password} onChange={setPassword} secure />
        {mode === 'register' && (
          <>
            <Field label={t('displayName')} value={displayName} onChange={setDisplayName} />
            {role === 'teacher' ? (
              <>
                <Field
                  label={t('optionalEmail')}
                  value={email}
                  onChange={setEmail}
                  keyboard="email-address"
                />
                <Muted size={13}>{t('teacherSignupNote')}</Muted>
              </>
            ) : (
              <>
                <Field label={t('grade')} value={grade} onChange={setGrade} keyboard="number-pad" />
                <XStack gap={8} alignItems="center">
                  <Checkbox
                    checked={under13}
                    onCheckedChange={(v) => setUnder13(v === true)}
                    size="$4"
                    backgroundColor={tokens.surface}
                    borderColor={tokens.border}
                  >
                    <Checkbox.Indicator>
                      <Text>✓</Text>
                    </Checkbox.Indicator>
                  </Checkbox>
                  <Label onPress={() => setUnder13(!under13)}>{t('under13')}</Label>
                </XStack>
                {under13 && (
                  <Field
                    label={t('guardianEmail')}
                    value={guardianEmail}
                    onChange={setGuardianEmail}
                    keyboard="email-address"
                  />
                )}
              </>
            )}
          </>
        )}

        {error ? <Feedback kind="bad">{error}</Feedback> : null}
        <PrimaryButton onPress={submit} disabled={busy}>
          {mode === 'login' ? t('login') : t('register')}
        </PrimaryButton>
        <Link href={mode === 'login' ? '/register' : '/login'}>
          <Text color={accent} fontWeight="700">
            {mode === 'login' ? t('register') : t('login')} →
          </Text>
        </Link>
      </AppCard>
    </Screen>
  );
}
