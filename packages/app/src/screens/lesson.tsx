/**
 * Scaffolded lesson player (design doc §4.1): steps revealed one at a time,
 * worked examples rendered as math, the lesson mnemonic as a persistent chip,
 * and the original scaffold notes from class (images from the teacher's
 * document) per topic.
 */
import { useEffect, useState } from 'react';
import { Image, Linking, Platform } from 'react-native';
import { Link } from 'solito/link';
import { Text, XStack, YStack } from 'tamagui';
import { trpc, getBaseUrl } from '../lib/trpc';
import { useI18n } from '../lib/i18n';
import { useRequireAuth } from '../components/AppChrome';
import { MathText } from '../components/MathText';
import { Katex } from '../components/Katex';
import { LessonAnimations } from '../components/stepanim/LessonAnimations';
import { TutorChat } from '../components/TutorChat';
import {
  AppCard, GhostButton, Loading, Muted, PrimaryButton, Screen,
  SubTitle, Title, BRAND, COLORS,
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
        style={{ width: '100%', aspectRatio: ratio, borderRadius: 10, backgroundColor: '#fff' }}
        resizeMode="contain"
        accessibilityLabel={title}
      />
      <XStack justifyContent="flex-end">
        <Text
          color={COLORS.muted}
          fontSize={13}
          fontWeight="700"
          cursor="pointer"
          pressStyle={{ opacity: 0.6 }}
          onPress={() => downloadImage(uri)}
          accessibilityRole="button"
        >
          ⬇ {t('downloadScaffold')}
        </Text>
      </XStack>
    </YStack>
  );
}

export function LessonScreen({ id }: { id: number }) {
  const { t, locale } = useI18n();
  const authed = useRequireAuth();
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
        <Text color={BRAND} fontWeight="700">← {t('curriculum')}</Text>
      </Link>
      <Title>
        {l.code} · {l.title}
      </Title>
      {l.mnemonic && (
        <XStack backgroundColor="#fff9db" borderRadius={12} padding={10} alignItems="center" gap={6}>
          <Text>💡</Text>
          <Text fontSize={14}>
            <Text fontWeight="800">{t('mnemonic')}:</Text> {l.mnemonic}
          </Text>
        </XStack>
      )}

      {l.steps.slice(0, revealed).map((s) => (
        <AppCard key={s.position} gap={6}>
          <Muted>
            {t('step')} {s.position} {t('of')} {l.steps.length}
          </Muted>
          <MathText text={s.body} size={16} />
          {s.workedExampleLatex && (
            <YStack backgroundColor="#f8f9fa" borderRadius={10} padding={12} gap={4}>
              <Muted size={12}>{t('workedExample')}</Muted>
              <Katex tex={s.workedExampleLatex} block />
            </YStack>
          )}
          {s.hint && (
            <Text fontSize={14} color={COLORS.warn}>
              💡 <MathText text={s.hint} size={14} />
            </Text>
          )}
        </AppCard>
      ))}

      {allShown && <LessonAnimations code={l.code} />}

      {l.classroomScaffolds.length > 0 && (
        <AppCard gap={8} borderLeftWidth={4} borderLeftColor={COLORS.warn}>
          <SubTitle>📄 {t('classroomScaffold')}</SubTitle>
          <Muted>{t('scaffoldNote')}</Muted>
          {l.classroomScaffolds.map((s) => {
            const open = openScaffold === s.title;
            return (
              <YStack
                key={s.title}
                borderWidth={1}
                borderColor="#f1f5f9"
                borderRadius={10}
                backgroundColor="#fffdf5"
              >
                <XStack
                  padding={12}
                  onPress={() => setOpenScaffold(open ? null : s.title)}
                  pressStyle={{ opacity: 0.7 }}
                  cursor="pointer"
                  gap={8}
                >
                  <Text color={COLORS.warn}>{open ? '▾' : '▸'}</Text>
                  <Text fontWeight="700" fontSize={15} flexShrink={1}>
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
            <PrimaryButton>✏️ {t('practice')}</PrimaryButton>
          </Link>
        )}
        <GhostButton onPress={() => setShowTutor((s) => !s)}>🤖 {t('askTutor')}</GhostButton>
      </XStack>

      {showTutor && <TutorChat lessonId={l.id} />}
    </Screen>
  );
}
