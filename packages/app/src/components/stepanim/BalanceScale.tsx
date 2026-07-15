/**
 * Balance-scale visual for the step animator: two pans showing the current
 * left/right side of the equation on a beam over a fulcrum. When a step
 * applies an operation to both sides, the beam wobbles and settles level —
 * "we did the same thing to both sides, so it stays balanced."
 *
 * Built from plain Views and transforms (no SVG dependency) so it renders
 * the same on native and on web through react-native-web.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Text as RNText, View } from 'react-native';
import { COLORS, useAccent } from '../ui';
import { sideToText, splitSides, type EqStep } from './model';

const NATIVE = Platform.OS !== 'web';
const BEAM_W = 210;
const BEAM_H = 6;

function Pan({ text, tint, textColor }: { text: string; tint: string; textColor: string }) {
  return (
    <View style={{ alignItems: 'center', width: 70 }}>
      {/* string from beam end down to the pan */}
      <View style={{ width: 2, height: 12, backgroundColor: '#94a3b8' }} />
      <View
        style={{
          backgroundColor: tint,
          borderRadius: 10,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          paddingHorizontal: 10,
          paddingVertical: 5,
          minWidth: 56,
          alignItems: 'center',
        }}
      >
        <RNText
          style={{ fontSize: 13, fontWeight: '700', color: textColor, maxWidth: 84 }}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {text}
        </RNText>
      </View>
    </View>
  );
}

export function BalanceScale({ step, wobble }: { step: EqStep; wobble: boolean }) {
  const accent = useAccent();
  const tilt = useRef(new Animated.Value(0)).current;

  // Wobble and settle whenever an "apply to both sides" step arrives.
  useEffect(() => {
    if (!wobble) return;
    tilt.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(tilt, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(tilt, { toValue: -0.7, duration: 300, useNativeDriver: NATIVE }),
      Animated.timing(tilt, { toValue: 0.3, duration: 280, useNativeDriver: NATIVE }),
      Animated.timing(tilt, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [wobble, step, tilt]);

  const { left, right, rel } = splitSides(step);
  if (!rel || rel.text !== '=') return null;

  const rotate = tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <View style={{ alignItems: 'center', height: 66, marginTop: 2 }}>
      {/* fulcrum triangle (border trick — no SVG needed), behind the beam */}
      <View
        style={{
          position: 'absolute',
          top: 7,
          width: 0,
          height: 0,
          borderLeftWidth: 13,
          borderRightWidth: 13,
          borderBottomWidth: 22,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: '#cbd5e1',
        }}
      />
      {/* beam + hanging pans tilt together */}
      <Animated.View style={{ width: BEAM_W, alignItems: 'center', transform: [{ rotate }] }}>
        <View
          style={{
            width: BEAM_W,
            height: BEAM_H,
            borderRadius: BEAM_H / 2,
            backgroundColor: '#64748b',
          }}
        />
        <View style={{ flexDirection: 'row', width: BEAM_W, justifyContent: 'space-between' }}>
          <Pan text={sideToText(left)} tint="#eef1fd" textColor={accent} />
          <Pan text={sideToText(right)} tint={COLORS.goodBg} textColor={COLORS.good} />
        </View>
      </Animated.View>
    </View>
  );
}
