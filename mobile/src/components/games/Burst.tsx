import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from './shared';

export const CONFETTI = ['🎉', '✨', '💖', '⭐', '🎊', '💕'];
export const HEARTS = ['💖', '💕', '❤️', '💗', '✨', '💞'];

/** 0–1 arası sabit sözde rastgele (her render'da aynı yörünge) */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Parçacık patlaması: `play` her doğru(sal) değere değiştiğinde küçük emojiler merkezden
 * dışa doğru saçılır, hafif yerçekimiyle düşerek söner. Ebeveynin tam ortasına yerleşir,
 * dokunmaları engellemez. Tamamı native driver ile çalışır; "hareketi azalt" açıksa hiç çizilmez.
 */
export function Burst({
  play,
  emojis = CONFETTI,
  count = 20,
  distance = 120,
  size = 18,
  duration = 950,
  delay = 0,
  style,
}: {
  play: string | number | boolean | null | undefined;
  emojis?: string[];
  count?: number;
  distance?: number;
  size?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const n = Math.max(1, Math.min(40, count));
  const progress = useMemo(() => Array.from({ length: n }, () => new Animated.Value(0)), [n]);

  // Her parçacığın yörüngesi (açı, uzaklık, dönüş, boyut) sabit
  const particles = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * Math.PI * 2 + (rnd(i, 1) - 0.5) * 0.7;
        const dist = distance * (0.55 + 0.45 * rnd(i, 2));
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const fall = distance * (0.25 + 0.3 * rnd(i, 3));
        return {
          emoji: emojis[i % emojis.length] ?? '✨',
          dx,
          dy,
          fall,
          spin: `${Math.round((rnd(i, 4) - 0.5) * 540)}deg`,
          scale: 0.7 + rnd(i, 5) * 0.6,
          lag: Math.round(rnd(i, 6) * 90),
        };
      }),
    [n, distance, emojis],
  );

  useEffect(() => {
    if (!play || reduced) return;
    progress.forEach((v) => v.setValue(0));
    const anim = Animated.parallel(
      progress.map((v, i) =>
        Animated.sequence([
          Animated.delay(delay + particles[i].lag),
          Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    anim.start();
    return () => anim.stop();
  }, [play, reduced, progress, particles, delay, duration]);

  // Parçacıklar başta ve sonda saydam; oynatılmadıysa hiç çizilmez
  if (reduced || !play) return null;
  return (
    <View style={[styles.origin, style, { pointerEvents: 'none' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) => {
        const v = progress[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: -size * 0.7,
              top: -size * 0.6,
              opacity: v.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                // Önce dışa fırlar, sonra yerçekimiyle aşağı süzülür
                { translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.dy * 0.8 + p.fall * 0.15, p.dy + p.fall] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.spin] }) },
                { scale: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.2, p.scale * 1.15, p.scale * 0.8] }) },
              ],
            }}
          >
            <Text allowFontScaling={false} style={{ fontSize: size, lineHeight: size * 1.2, width: size * 1.4, textAlign: 'center' }}>
              {p.emoji}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, zIndex: 20, overflow: 'visible' },
});
