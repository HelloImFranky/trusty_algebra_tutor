/**
 * Token-morphing step player for worked examples.
 *
 * Renders one "active" equation line whose tokens animate between steps
 * (slide / drop-in / fade-out), with completed steps stacking above like a
 * whiteboard. Animation uses React Native's Animated API, which runs on
 * native and on web through react-native-web with zero extra config; the
 * driver surface is small (translateX/translateY/opacity per token), so
 * swapping to Reanimated later is contained to this file.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Text as RNText, View } from 'react-native';
import { Text, XStack } from 'tamagui';
import { useI18n } from '../../lib/i18n';
import { AppCard, BRAND, COLORS, GhostButton, PrimaryButton, SecondaryButton } from '../ui';
import { stepToText, type EqScript, type EqToken } from './model';

const NATIVE = Platform.OS !== 'web';
const FONT = 26;
const WEIGHT = '700' as const;
const GAP = 10;
const TIGHT_GAP = 1;
const LINE_H = 48;
const CHIP_PAD = 7;

interface TokenAnim {
  x: Animated.Value;
  y: Animated.Value;
  o: Animated.Value;
}

function tokenStyle(tok: EqToken) {
  let color: string = tok.kind === 'var' ? BRAND : tok.kind === 'num' ? '#111827' : '#6b7280';
  let bg: string | undefined;
  let strike = false;
  switch (tok.emph) {
    case 'apply':
      color = COLORS.warn;
      bg = COLORS.warnBg;
      break;
    case 'result':
      color = COLORS.good;
      bg = COLORS.goodBg;
      break;
    case 'focus':
      color = BRAND;
      bg = '#eef1fd';
      break;
    case 'cancel':
      color = '#9ca3af';
      strike = true;
      break;
  }
  return { color, bg, strike };
}

/** x-position of every token in a step, centered inside containerW. */
function layoutStep(
  tokens: EqToken[],
  textW: Map<string, number>,
  containerW: number,
): Map<string, number> {
  const widths = tokens.map(
    (tok) => (textW.get(tok.text) ?? 0) + (tokenStyle(tok).bg ? CHIP_PAD * 2 : 0),
  );
  let total = 0;
  tokens.forEach((tok, i) => {
    total += widths[i] + (i === 0 ? 0 : tok.tight ? TIGHT_GAP : GAP);
  });
  let x = Math.max(0, (containerW - total) / 2);
  const pos = new Map<string, number>();
  tokens.forEach((tok, i) => {
    if (i > 0) x += tok.tight ? TIGHT_GAP : GAP;
    pos.set(tok.id, x);
    x += widths[i];
  });
  return pos;
}

function FadeIn({ children }: { children: ReactNode }) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration: 320, useNativeDriver: NATIVE }).start();
  }, [o]);
  return <Animated.View style={{ opacity: o }}>{children}</Animated.View>;
}

export function AnimatedEquation({ script }: { script: EqScript }) {
  const { t, locale } = useI18n();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [containerW, setContainerW] = useState(0);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState<EqToken[]>([]);

  const anims = useRef(new Map<string, TokenAnim>());
  const widths = useRef(new Map<string, number>());
  const prevTokens = useRef<EqToken[] | null>(null);

  const texts = useMemo(
    () => Array.from(new Set(script.steps.flatMap((s) => s.tokens.map((tok) => tok.text)))),
    [script],
  );
  const step = script.steps[index];
  const atEnd = index >= script.steps.length - 1;

  // Whiteboard lines for the steps already completed. Consecutive steps can
  // share the same text (an emphasis-only step like "these cancel"), so
  // collapse duplicates.
  const history = useMemo(() => {
    const lines: string[] = [];
    for (let i = 0; i < index; i++) {
      const line = stepToText(script.steps[i]);
      if (lines[lines.length - 1] !== line) lines.push(line);
    }
    return lines;
  }, [index, script]);

  const getAnim = (id: string): TokenAnim => {
    let a = anims.current.get(id);
    if (!a) {
      a = { x: new Animated.Value(0), y: new Animated.Value(-18), o: new Animated.Value(0) };
      anims.current.set(id, a);
    }
    return a;
  };

  // Morph the line whenever the step (or available width) changes.
  useEffect(() => {
    if (!ready || containerW === 0) return;
    const tokens = script.steps[index].tokens;
    const pos = layoutStep(tokens, widths.current, containerW);
    const prev = prevTokens.current;
    const prevIds = new Set((prev ?? []).map((tok) => tok.id));
    const curIds = new Set(tokens.map((tok) => tok.id));
    const parts: Animated.CompositeAnimation[] = [];

    const exits = (prev ?? []).filter((tok) => !curIds.has(tok.id));
    for (const tok of exits) {
      const a = anims.current.get(tok.id);
      if (!a) continue;
      parts.push(
        Animated.parallel([
          Animated.timing(a.o, { toValue: 0, duration: 260, useNativeDriver: NATIVE }),
          Animated.timing(a.y, { toValue: 14, duration: 260, useNativeDriver: NATIVE }),
        ]),
      );
    }

    let enterDelay = exits.length > 0 ? 140 : 0;
    for (const tok of tokens) {
      const target = pos.get(tok.id)!;
      const a = getAnim(tok.id);
      if (prevIds.has(tok.id)) {
        parts.push(
          Animated.timing(a.x, {
            toValue: target,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: NATIVE,
          }),
          Animated.timing(a.o, { toValue: 1, duration: 200, useNativeDriver: NATIVE }),
          Animated.timing(a.y, { toValue: 0, duration: 200, useNativeDriver: NATIVE }),
        );
      } else {
        a.x.setValue(target);
        a.y.setValue(-18);
        a.o.setValue(0);
        parts.push(
          Animated.parallel([
            Animated.timing(a.o, {
              toValue: 1,
              duration: 300,
              delay: enterDelay,
              useNativeDriver: NATIVE,
            }),
            Animated.timing(a.y, {
              toValue: 0,
              duration: 320,
              delay: enterDelay,
              easing: Easing.out(Easing.back(1.6)),
              useNativeDriver: NATIVE,
            }),
          ]),
        );
        enterDelay += 70;
      }
    }

    setExiting(exits);
    prevTokens.current = tokens;
    const handle = Animated.parallel(parts);
    handle.start(({ finished }) => {
      if (!finished) return;
      setExiting((cur) => cur.filter((tok) => !exits.includes(tok)));
      for (const tok of exits) anims.current.delete(tok.id);
    });
    return () => handle.stop();
  }, [index, ready, containerW, script]);

  const next = () => {
    if (atEnd) return;
    setIndex((i) => i + 1);
  };
  const back = () => {
    if (index === 0) return;
    setPlaying(false);
    setIndex((i) => i - 1);
  };
  const reset = () => {
    setPlaying(false);
    setIndex(0);
  };
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (atEnd) reset();
    setPlaying(true);
  };

  // Auto-play: advance every 2.2s until the last step.
  useEffect(() => {
    if (!playing) return;
    if (index >= script.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(next, 2200);
    return () => clearTimeout(id);
  }, [playing, index]);

  const explain = locale === 'es' ? step.explainEs : step.explainEn;

  return (
    <AppCard gap={10}>
      {/* Hidden measurement pass: same component + font as the live tokens. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0, opacity: 0, flexDirection: 'row' }}
      >
        {texts.map((txt) => (
          <RNText
            key={txt}
            style={{ fontSize: FONT, fontWeight: WEIGHT }}
            onLayout={(e) => {
              widths.current.set(txt, e.nativeEvent.layout.width);
              if (widths.current.size >= texts.length) setReady(true);
            }}
          >
            {txt}
          </RNText>
        ))}
      </View>

      {/* Whiteboard history of completed steps */}
      {history.length > 0 && (
        <View style={{ gap: 2 }}>
          {history.map((line, i) => (
            <FadeIn key={`${i}-${line}`}>
              <RNText
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: COLORS.muted,
                  textAlign: 'center',
                }}
              >
                {line}
              </RNText>
            </FadeIn>
          ))}
        </View>
      )}

      {/* Active animated line */}
      <View
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
        style={{ height: LINE_H, width: '100%' }}
      >
        {[...exiting, ...step.tokens].map((tok) => {
          const st = tokenStyle(tok);
          const a = getAnim(tok.id);
          return (
            <Animated.View
              key={tok.id}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: LINE_H,
                justifyContent: 'center',
                opacity: a.o,
                transform: [{ translateX: a.x }, { translateY: a.y }],
              }}
            >
              <View
                style={{
                  backgroundColor: st.bg ?? 'transparent',
                  borderRadius: 8,
                  paddingHorizontal: st.bg ? CHIP_PAD : 0,
                  paddingVertical: 2,
                }}
              >
                <RNText
                  style={{
                    fontSize: FONT,
                    fontWeight: WEIGHT,
                    color: st.color,
                    textDecorationLine: st.strike ? 'line-through' : 'none',
                  }}
                >
                  {tok.text}
                </RNText>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* Explanation for the current step */}
      <FadeIn key={`explain-${index}`}>
        <Text fontSize={15} color="#374151" textAlign="center" minHeight={40}>
          {explain}
        </Text>
      </FadeIn>

      {/* Progress dots */}
      <XStack gap={6} justifyContent="center">
        {script.steps.map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: i < index ? COLORS.good : i === index ? BRAND : '#d1d5db',
            }}
          />
        ))}
      </XStack>

      <XStack gap={8} justifyContent="center" flexWrap="wrap">
        <SecondaryButton onPress={back} disabled={index === 0} opacity={index === 0 ? 0.5 : 1}>
          {t('back')}
        </SecondaryButton>
        <PrimaryButton onPress={next} disabled={atEnd} opacity={atEnd ? 0.5 : 1}>
          {t('next')}
        </PrimaryButton>
        <SecondaryButton onPress={togglePlay}>{playing ? '⏸' : '▶'}</SecondaryButton>
        <GhostButton onPress={reset}>{t('reset')}</GhostButton>
      </XStack>
    </AppCard>
  );
}
