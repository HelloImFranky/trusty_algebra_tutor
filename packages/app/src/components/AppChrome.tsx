/**
 * Shared chrome: brand top bar (language toggle, logout) and an app-style
 * bottom tab bar (design: students on phones first). Wraps every signed-in
 * screen on web and native.
 */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'solito/link';
import { useRouter } from 'solito/navigation';
import { usePathname } from 'solito/navigation';
import { Button, Text, XStack, YStack } from 'tamagui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { ReferenceSheetButton } from './ReferenceSheet';
import { BRAND, COLORS } from './ui';

export function AppChrome({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const auth = useAuth((s) => s.auth);
  const setAuth = useAuth((s) => s.setAuth);
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  const tabs = [
    { href: '/', icon: '📘', label: t('curriculum') },
    { href: '/sprint', icon: '⚡', label: t('sprint') },
    { href: '/review', icon: '📚', label: t('review') },
    { href: '/progress', icon: '📈', label: t('progress') },
    { href: '/calculator', icon: '🧮', label: t('calculator') },
  ];

  return (
    <YStack flex={1} backgroundColor="#f6f7fb">
      <XStack
        backgroundColor={BRAND}
        paddingHorizontal={14}
        paddingVertical={10}
        alignItems="center"
        justifyContent="space-between"
      >
        <Text color="white" fontWeight="900" fontSize={17}>
          ∑ {t('appName')}
        </Text>
        <XStack gap={8} alignItems="center">
          <Button
            size="$2"
            backgroundColor="rgba(255,255,255,0.18)"
            color="white"
            borderRadius={999}
            onPress={() => setLocale(locale === 'en' ? 'es' : 'en')}
            aria-label="language"
          >
            {locale === 'en' ? '🇪🇸 ES' : '🇺🇸 EN'}
          </Button>
          {auth && (
            <Button
              size="$2"
              backgroundColor="rgba(255,255,255,0.18)"
              color="white"
              borderRadius={999}
              onPress={() => {
                setAuth(null);
                router.replace('/login');
              }}
            >
              {t('logout')}
            </Button>
          )}
        </XStack>
      </XStack>

      <YStack flex={1}>{children}</YStack>

      {auth && <ReferenceSheetButton />}

      {auth && (
        <XStack
          backgroundColor="#ffffff"
          borderTopWidth={1}
          borderTopColor={COLORS.border}
          paddingVertical={6}
          paddingBottom={10}
          justifyContent="space-around"
          aria-label="main"
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href}>
                <YStack alignItems="center" paddingHorizontal={6} opacity={active ? 1 : 0.65}>
                  <Text fontSize={20}>{tab.icon}</Text>
                  <Text fontSize={10} fontWeight="700" color={active ? BRAND : COLORS.muted}>
                    {tab.label}
                  </Text>
                </YStack>
              </Link>
            );
          })}
        </XStack>
      )}
    </YStack>
  );
}

/** Client-side auth gate: bounce to /login when signed out. */
export function useRequireAuth(): boolean {
  const auth = useAuth((s) => s.auth);
  const hydrated = useAuth((s) => s.hydrated);
  const router = useRouter();
  useEffect(() => {
    if (hydrated && !auth) router.replace('/login');
  }, [hydrated, auth, router]);
  return Boolean(auth);
}
