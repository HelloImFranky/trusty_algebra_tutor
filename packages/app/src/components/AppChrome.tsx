/**
 * Shared chrome: brand top bar (calculator, reference sheet) and navigation
 * tabs. Desktop-width web gets the nav links in the top bar like a
 * traditional website; phones (native app and narrow web) keep the
 * app-style bottom tab bar. Calculator lives in the top chrome so students
 * can pop it open from any screen without losing their place. Settings is a
 * navigation destination (bottom tab bar on phones, top nav row on desktop
 * web) — there is exactly one entry point, not a duplicate top-bar icon.
 * Wraps every signed-in screen on web and native.
 */
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Link } from 'solito/link';
import { useRouter, usePathname } from 'solito/navigation';
import {
  BookOpen,
  Library,
  School,
  Settings,
  Shield,
  TrendingUp,
  Zap,
} from '@tamagui/lucide-icons';
import type { IconProps } from '@tamagui/helpers-icon';
import { Text, XStack, YStack } from 'tamagui';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { CalculatorButton } from './CalculatorButton';
import { ReferenceSheetButton } from './ReferenceSheet';
import { useAccent, useTokens, type Hex } from './ui';

function TabIcon({
  icon: Icon,
  active,
  accent,
  inactive,
}: {
  icon: ComponentType<IconProps>;
  active: boolean;
  accent: Hex;
  inactive: Hex;
}) {
  return <Icon size={20} color={active ? accent : inactive} />;
}

export function AppChrome({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const auth = useAuth((s) => s.auth);
  const pathname = usePathname() ?? '/';
  const accent = useAccent();
  const tokens = useTokens();
  // Mid-neutral for inactive tab items — same visual weight in either mode.
  const inactive: Hex = tokens.muted;

  // Admins get the governance console; teachers get the class dashboard;
  // students/guardians get the learner tabs. Calculator has moved out of
  // the tab bar and into the top chrome (available from every screen so
  // students never lose their spot), and Settings takes its slot here.
  const tabs =
    auth?.user.role === 'admin'
      ? [{ href: '/admin', icon: Shield, label: t('admin') }]
      : auth?.user.role === 'teacher'
        ? [{ href: '/classes', icon: School, label: t('classes') }]
        : [
            { href: '/', icon: BookOpen, label: t('curriculum') },
            { href: '/sprint', icon: Zap, label: t('sprint') },
            { href: '/review', icon: Library, label: t('review') },
            { href: '/progress', icon: TrendingUp, label: t('progress') },
            { href: '/settings', icon: Settings, label: t('settings') },
          ];

  const { width } = useWindowDimensions();
  const topNav = Platform.OS === 'web' && width >= 768;

  return (
    // The web page scrolls as one normal document; the bars hold their
    // place with plain CSS — #top-bar is sticky and #bottom-tabs is fixed
    // (see the web layout's global style) — so they behave from the first
    // paint, before hydration. Native pins them via the flex column.
    <YStack flex={1} backgroundColor={tokens.bg}>
      <XStack
        id="top-bar"
        backgroundColor={tokens.bg}
        borderBottomWidth={2}
        borderBottomColor={tokens.chromeBorder}
        paddingHorizontal={16}
        paddingVertical={12}
        alignItems="center"
        justifyContent="space-between"
      >
        <XStack gap={26} alignItems="center" flexShrink={1}>
          <Text color={tokens.ink} fontWeight="800" fontSize={18}>
            ∑ {t('appName')}
          </Text>
          {topNav &&
            auth &&
            tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link key={tab.href} href={tab.href}>
                  <XStack gap={6} alignItems="center">
                    <TabIcon icon={tab.icon} active={active} accent={accent} inactive={inactive} />
                    <Text
                      color={active ? accent : inactive}
                      fontSize={14}
                      fontWeight={active ? '800' : '600'}
                    >
                      {tab.label}
                    </Text>
                  </XStack>
                </Link>
              );
            })}
        </XStack>
        <XStack gap={8} alignItems="center">
          {/* Order — Calculator first: it's the most-used chrome tool
              and opens as a bottom sheet OVER the current page instead
              of navigating away, so students never lose their spot in a
              lesson / practice / review. Reference sheet next (also a
              sheet). Settings is NOT here — it lives in the navigation
              (bottom tab bar on phones, top nav row on desktop web) so
              there's a single, un-duplicated entry point to preferences. */}
          {auth && <CalculatorButton />}
          {auth && <ReferenceSheetButton compact={!topNav} />}
        </XStack>
      </XStack>

      <YStack flex={1}>{children}</YStack>

      {auth && !topNav && (
        <XStack
          id="bottom-tabs"
          backgroundColor={tokens.surface}
          borderTopWidth={2}
          borderTopColor={tokens.chromeBorder}
          paddingVertical={6}
          paddingBottom={10}
          justifyContent="space-around"
          aria-label="main"
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href}>
                <YStack alignItems="center" gap={3} paddingHorizontal={6}>
                  <TabIcon icon={tab.icon} active={active} accent={accent} inactive={inactive} />
                  <Text fontSize={10} fontWeight="700" color={active ? accent : inactive}>
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
