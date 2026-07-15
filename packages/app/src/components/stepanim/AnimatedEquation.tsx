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
import { AccessibilityInfo, Animated, Easing, Platform, Text as RNText, View } from 'react-native';
import { Text, XStack } from 'tamagui';
import { useI18n } from '../../lib/i18n';
import { AppCard, BRAND, COLORS, GhostButton, PrimaryButton, SecondaryButton, useAccent, type Hex } from '../ui';
import { BalanceScale } from './BalanceScale';
import { stepToText, type EqScript, type EqToken } from './model';

const NATIVE = Platform.OS !== 'web';
const FONT = 26;
const WEIGHT = '700' as const;
const GAP = 10;
const TIGHT_GAP = 1;
const LINE_H = 48;
const CHIP_PAD = 7;
// stacked fractions: numerator/denominator font + padding around the rule
const FRAC_FONT = 16;
const FRAC_PAD = 4;

interface TokenAnim {
  x: Animated.Value;
  y: Animated.Value;
  o: Animated.Value;
}

/** `accent` defaults to the static brand color for the layout-measurement
 * pass (see layoutStep), where only whether a token has a bg matters; the
 * live theme color is threaded in for the actual render below. */
function tokenStyle(tok: EqToken, accent: Hex = BRAND) {
  let color: string =
    tok.kind === 'var' ? accent : tok.kind === 'num' || tok.kind === 'frac' ? '#111827' : '#6b7280';
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
      color = accent;
      bg = '#eef1fd';
      break;
    case 'cancel':
      color = '#9ca3af';
      strike = true;
      break;
    case 'flip':
      color = COLORS.bad;
      bg = COLORS.badBg;
      break;
  }
  return { color, bg, strike };
}

/** Width of one token: measured text, or the widest fraction part. */
function tokenWidth(tok: EqToken, textW: Map<string, number>): number {
  if (tok.kind === 'frac') {
    const nw = textW.get(`frac:${tok.num ?? ''}`) ?? 0;
    const dw = textW.get(`frac:${tok.den ?? ''}`) ?? 0;
    return Math.max(nw, dw) + FRAC_PAD * 2;
  }
  return textW.get(tok.text) ?? 0;
}

/**
 * Position of every token in a step. Each row (vertical polynomial layouts
 * use `row: 1` for the second line) is centered on containerW/2, and the
 * row block is centered vertically in containerH. A line wider than the
 * container keeps its center (negative start x) so the whole-line scale
 * transform shrinks it symmetrically into view.
 */
function layoutStep(
  tokens: EqToken[],
  textW: Map<string, number>,
  containerW: number,
  containerH: number,
): { pos: Map<string, { x: number; y: number }>; total: number } {
  const rows = [tokens.filter((tok) => !tok.row), tokens.filter((tok) => tok.row === 1)].filter(
    (r) => r.length > 0,
  );
  const pos = new Map<string, { x: number; y: number }>();
  const yPad = (containerH - rows.length * LINE_H) / 2;
  let total = 0;
  rows.forEach((rowTokens, r) => {
    const widths = rowTokens.map(
      (tok) => tokenWidth(tok, textW) + (tokenStyle(tok).bg ? CHIP_PAD * 2 : 0),
    );
    let rowTotal = 0;
    rowTokens.forEach((tok, i) => {
      rowTotal += widths[i] + (i === 0 ? 0 : tok.tight ? TIGHT_GAP : GAP);
    });
    let x = (containerW - rowTotal) / 2;
    const y = yPad + r * LINE_H;
    rowTokens.forEach((tok, i) => {
      if (i > 0) x += tok.tight ? TIGHT_GAP : GAP;
      pos.set(tok.id, { x, y });
      x += widths[i];
    });
    total = Math.max(total, rowTotal);
  });
  return { pos, total };
}

function FadeIn({ children }: { children: ReactNode }) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: 1, duration: 320, useNativeDriver: NATIVE }).start();
  }, [o]);
  return <Animated.View style={{ opacity: o }}>{children}</Animated.View>;
}

export function AnimatedEquation({
  script,
  startAtStep = 0,
}: {
  script: EqScript;
  /** Open on a specific step (e.g. the flip step after a flip mistake). */
  startAtStep?: number;
}) {
  const { t, locale } = useI18n();
  const accent = useAccent();
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, startAtStep), script.steps.length - 1),
  );
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Respect the OS reduced-motion setting: steps swap instead of morphing.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) =>
      setReduceMotion(!!v),
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  const [containerW, setContainerW] = useState(0);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState<EqToken[]>([]);

  const anims = useRef(new Map<string, TokenAnim>());
  const widths = useRef(new Map<string, number>());
  const prevTokens = useRef<EqToken[] | null>(null);
  const prevPos = useRef(new Map<string, { x: number; y: number }>());
  const lineScale = useRef(new Animated.Value(1)).current;

  // Scripts with a second row (vertical polynomial addition) get a taller
  // stage for the whole run so the card doesn't jump between steps.
  const stageH = useMemo(
    () => (script.steps.some((s) => s.tokens.some((tok) => tok.row)) ? LINE_H * 2 : LINE_H),
    [script],
  );

  // One measurement entry per unique plain text, plus every fraction part
  // (measured at the smaller fraction font, keyed with a "frac:" prefix).
  const measures = useMemo(() => {
    const plain = new Set<string>();
    const parts = new Set<string>();
    for (const s of script.steps) {
      for (const tok of s.tokens) {
        if (tok.kind === 'frac') {
          parts.add(tok.num ?? '');
          parts.add(tok.den ?? '');
        } else {
          plain.add(tok.text);
        }
      }
    }
    return [
      ...Array.from(plain, (text) => ({ key: text, text, frac: false })),
      ...Array.from(parts, (text) => ({ key: `frac:${text}`, text, frac: true })),
    ];
  }, [script]);
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
    // reduced motion: zero-duration timings — steps swap instead of animating
    const dur = (ms: number) => (reduceMotion ? 0 : ms);
    const tokens = script.steps[index].tokens;
    const { pos, total } = layoutStep(tokens, widths.current, containerW, stageH);
    const prev = prevTokens.current;
    const prevIds = new Set((prev ?? []).map((tok) => tok.id));
    const curIds = new Set(tokens.map((tok) => tok.id));
    const parts: Animated.CompositeAnimation[] = [];

    // Shrink the whole line when it would overflow the card.
    parts.push(
      Animated.timing(lineScale, {
        toValue: Math.min(1, containerW / (total + 8)),
        duration: dur(420),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: NATIVE,
      }),
    );

    const exits = (prev ?? []).filter((tok) => !curIds.has(tok.id));
    for (const tok of exits) {
      const a = anims.current.get(tok.id);
      if (!a) continue;
      const fromY = prevPos.current.get(tok.id)?.y ?? 0;
      parts.push(
        Animated.parallel([
          Animated.timing(a.o, { toValue: 0, duration: dur(260), useNativeDriver: NATIVE }),
          Animated.timing(a.y, { toValue: fromY + 14, duration: dur(260), useNativeDriver: NATIVE }),
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
            toValue: target.x,
            duration: dur(420),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: NATIVE,
          }),
          Animated.timing(a.o, { toValue: 1, duration: dur(200), useNativeDriver: NATIVE }),
          Animated.timing(a.y, {
            toValue: target.y,
            duration: dur(420),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: NATIVE,
          }),
        );
      } else {
        a.x.setValue(target.x);
        a.y.setValue(target.y - 18);
        a.o.setValue(0);
        parts.push(
          Animated.parallel([
            Animated.timing(a.o, {
              toValue: 1,
              duration: dur(300),
              delay: dur(enterDelay),
              useNativeDriver: NATIVE,
            }),
            Animated.timing(a.y, {
              toValue: target.y,
              duration: dur(320),
              delay: dur(enterDelay),
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
    prevPos.current = pos;
    const handle = Animated.parallel(parts);
    handle.start(({ finished }) => {
      if (!finished) return;
      setExiting((cur) => cur.filter((tok) => !exits.includes(tok)));
      for (const tok of exits) anims.current.delete(tok.id);
    });
    return () => handle.stop();
  }, [index, ready, containerW, script, reduceMotion, stageH]);

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

  // Auto-play: advance after each step's dwell time (big moments hold longer).
  useEffect(() => {
    if (!playing) return;
    if (index >= script.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(next, script.steps[index].holdMs ?? 2200);
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
        {measures.map((m) => (
          <RNText
            key={m.key}
            style={{ fontSize: m.frac ? FRAC_FONT : FONT, fontWeight: WEIGHT }}
            onLayout={(e) => {
              widths.current.set(m.key, e.nativeEvent.layout.width);
              if (widths.current.size >= measures.length) setReady(true);
            }}
          >
            {m.text}
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
        style={{ height: stageH, width: '100%' }}
      >
        <Animated.View
          style={{ width: '100%', height: stageH, transform: [{ scale: lineScale }] }}
        >
        {[...exiting, ...step.tokens].map((tok) => {
          const st = tokenStyle(tok, accent);
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
                {tok.kind === 'frac' ? (
                  <View style={{ alignItems: 'center', paddingHorizontal: FRAC_PAD }}>
                    <RNText
                      style={{
                        fontSize: FRAC_FONT,
                        fontWeight: WEIGHT,
                        color: st.color,
                        textDecorationLine: st.strike ? 'line-through' : 'none',
                      }}
                    >
                      {tok.num}
                    </RNText>
                    <View
                      style={{
                        alignSelf: 'stretch',
                        height: 1.5,
                        borderRadius: 1,
                        backgroundColor: st.color,
                        marginVertical: 1.5,
                      }}
                    />
                    <RNText
                      style={{
                        fontSize: FRAC_FONT,
                        fontWeight: WEIGHT,
                        color: st.color,
                        textDecorationLine: st.strike ? 'line-through' : 'none',
                      }}
                    >
                      {tok.den}
                    </RNText>
                  </View>
                ) : (
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
                )}
              </View>
            </Animated.View>
          );
        })}
        </Animated.View>
      </View>

      {/* Explanation for the current step (announced to screen readers) */}
      <FadeIn key={`explain-${index}`}>
        <Text
          fontSize={15}
          color="#374151"
          textAlign="center"
          minHeight={40}
          accessibilityLiveRegion="polite"
        >
          {explain}
        </Text>
      </FadeIn>

      {/* Balance scale: wobbles when an operation hits both sides */}
      <BalanceScale step={step} wobble={step.tokens.some((tok) => tok.emph === 'apply')} />

      {/* Progress dots */}
      <XStack gap={6} justifyContent="center">
        {script.steps.map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: i < index ? COLORS.good : i === index ? accent : '#d1d5db',
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
