/**
 * Scaffolded lesson player (design doc §4.1): steps revealed one at a time,
 * worked examples rendered as math, the lesson mnemonic as a persistent chip,
 * and the original scaffold notes from class (images from the teacher's
 * document) per topic.
 */
import { useEffect, useState } from 'react';
import { Image, Linking, Platform } from 'react-native';
import { Link } from 'solito/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Lightbulb,
  MessageCircle,
  PenLine,
} from '@tamagui/lucide-icons';
import { Text, XStack, YStack } from 'tamagui';
import { trpc, getBaseUrl } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { Mascot } from '../components/Mascot';
import { MathText } from '../components/MathText';
import { Katex } from '../components/Katex';
import { LessonAnimations } from '../components/stepanim/LessonAnimations';
import { TutorChat } from '../components/TutorChat';
import {
  AppCard, GhostButton, INK, Loading, Muted, NEUTRAL, PrimaryButton, Screen,
  useAccent, COLORS,
} from '../components/ui';

/** Save the scaffold to the device: a real download on web, the system
 * browser (with its save options) on native. */
function downloadImage(uri: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = uri;
    a.download = uri.split('/').pop() ?? 'scaffold.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    Linking.openURL(uri).catch(() => {});
  }
}

function ScaffoldImage({ src, title }: { src: string; title: string }) {
  const uri = `${getBaseUrl()}${src}`;
  const [ratio, setRatio] = useState(0.75);
  const { t } = useI18n();
  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (iw, ih) => {
      if (alive && iw && ih) setRatio(iw / ih);
    });
    return () => {
      alive = false;
    };
  }, [uri]);
  return (
    <YStack width="100%" gap={4}>
      <Image
        source={{ uri }}
        style={{ width: '100%', aspectRatio: ratio, borderRadius: 14, backgroundColor: '#fff' }}
        resizeMode="contain"
        accessibilityLabel={title}
      />
      <XStack justifyContent="flex-end" alignItems="center" gap={4}>
        <Download size={13} color={COLORS.muted} />
        <Text
          color={COLORS.muted}
          fontSize={13}
          fontWeight="700"
          cursor="pointer"
          pressStyle={{ opacity: 0.6 }}
          onPress={() => downloadImage(uri)}
          accessibilityRole="button"
        >
          {t('downloadScaffold')}
        </Text>
      </XStack>
    </YStack>
  );
}

export function LessonScreen({ id }: { id: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
  const accent = useAccent();
  const lesson = trpc.curriculum.lesson.useQuery({ id, locale }, { enabled: authed && !!id });
  const [revealed, setRevealed] = useState(1);
  const [openScaffold, setOpenScaffold] = useState<string | null>(null);
  const [showTutor, setShowTutor] = useState(false);

  if (!lesson.data) return <Loading />;
  const l = lesson.data;
  const allShown = revealed >= l.steps.length;

  return (
    <Screen>
      <Link href="/">
        <XStack alignItems="center" gap={8}>
          <ArrowLeft size={18} color={INK} />
          <Text color={INK} fontWeight="800" fontSize={15}>
            {l.code} · {l.title}
          </Text>
        </XStack>
      </Link>

      {l.mnemonic && (
        <XStack backgroundColor={NEUTRAL[200]} borderRadius={16} padding={12} alignItems="center" gap={8}>
          <Lightbulb size={17} color={accent} />
          <Text fontSize={13.5} color={INK}>
            <Text fontWeight="800">{t('mnemonic')}:</Text> {l.mnemonic}
          </Text>
        </XStack>
      )}

      {l.steps.slice(0, revealed).map((s) => (
        <AppCard key={s.position} gap={6}>
          <Text fontSize={11} fontWeight="800" textTransform="uppercase" letterSpacing={0.6} color={accent}>
            {t('step')} {s.position} {t('of')} {l.steps.length}
          </Text>
          <MathText text={s.body} size={16} />
          {s.workedExampleLatex && (
            <YStack backgroundColor={NEUTRAL[200]} borderRadius={14} padding={12} gap={4}>
              <Muted size={12}>{t('workedExample')}</Muted>
              <Katex tex={s.workedExampleLatex} block />
            </YStack>
          )}
          {s.hint && (
            <XStack gap={4} alignItems="flex-start">
              <Lightbulb size={14} color={COLORS.warn} />
              <Text fontSize={14} color={COLORS.warn}>
                <MathText text={s.hint} size={14} />
              </Text>
            </XStack>
          )}
        </AppCard>
      ))}

      {allShown && (
        <AppCard flexDirection="row" alignItems="center" gap={10}>
          <Mascot size={44} />
          <Text fontSize={13} fontWeight="600" color={INK} flexShrink={1}>
            {t('lessonEncourage')}
          </Text>
        </AppCard>
      )}

      {allShown && <LessonAnimations code={l.code} />}

      {l.classroomScaffolds.length > 0 && (
        <AppCard gap={8} borderLeftWidth={4} borderLeftColor={accent}>
          <XStack alignItems="center" gap={6}>
            <FileText size={16} color={accent} />
            <Text fontWeight="800" fontSize={12} color="#ae1800" textTransform="uppercase" letterSpacing={0.6}>
              {t('classroomScaffold')}
            </Text>
          </XStack>
          <Muted>{t('scaffoldNote')}</Muted>
          {l.classroomScaffolds.map((s) => {
            const open = openScaffold === s.title;
            return (
              <YStack
                key={s.title}
                borderRadius={14}
                backgroundColor={NEUTRAL[100]}
              >
                <XStack
                  padding={12}
                  onPress={() => setOpenScaffold(open ? null : s.title)}
                  pressStyle={{ opacity: 0.7 }}
                  cursor="pointer"
                  gap={8}
                  alignItems="center"
                >
                  {open ? (
                    <ChevronDown size={16} color={COLORS.muted} />
                  ) : (
                    <ChevronRight size={16} color={COLORS.muted} />
                  )}
                  <Text fontWeight="700" fontSize={15} flexShrink={1} color={INK}>
                    {s.title}
                  </Text>
                </XStack>
                {open && (
                  <YStack padding={12} paddingTop={0} gap={10} alignItems="center">
                    {s.images.length > 0 ? (
                      s.images.map((src) => <ScaffoldImage key={src} src={src} title={s.title} />)
                    ) : (
                      <MathText text={s.body} />
                    )}
                  </YStack>
                )}
              </YStack>
            );
          })}
        </AppCard>
      )}

      <XStack gap={10} flexWrap="wrap">
        {!allShown && (
          <PrimaryButton onPress={() => setRevealed((r) => r + 1)}>
            {t('continueBtn')} →
          </PrimaryButton>
        )}
        {allShown && l.skill && (
          <Link href={`/practice/${l.skill.id}?lesson=${l.id}`}>
            <PrimaryButton icon={<PenLine size={15} color="#fff" />}>{t('practice')}</PrimaryButton>
          </Link>
        )}
        <GhostButton icon={<MessageCircle size={15} />} onPress={() => setShowTutor((s) => !s)}>
          {t('askTutor')}
        </GhostButton>
      </XStack>

      {showTutor && <TutorChat lessonId={l.id} />}
    </Screen>
  );
}
