import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import { colors } from '@/theme';

/** Tasarımdaki genişleyen halkalar (@keyframes ring: scale .6→1.9, opacity .8→0) */
export function Rings({ size = 220, count = 3, duration = 2400, color = 'rgba(244,185,200,.5)' }: { size?: number; count?: number; duration?: number; color?: string }) {
  const [values] = useState(() => Array.from({ length: count }, () => new Animated.Value(0)));

  useEffect(() => {
    let stopped = false;
    const loops: Animated.CompositeAnimation[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (stopped || reduce) return;
        values.forEach((v, i) => {
          const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }));
          loops.push(loop);
          timers.push(setTimeout(() => !stopped && loop.start(), (i * duration) / count));
        });
      });
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
    };
  }, [values, duration, count]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1,
            borderColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
          }}
        />
      ))}
    </View>
  );
}

/** Yavaşça atan kalp / nokta (bekleme göstergesi) */
export function Pulse({ children, min = 0.92, max = 1.08, duration = 1200 }: { children: React.ReactNode; min?: number; max?: number; duration?: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [min, max] }) }] }}>{children}</Animated.View>;
}

/** "Yazıyor…" üç nokta */
export function TypingDots({ color = colors.mist }: { color?: string }) {
  const [vals] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.25)));
  useEffect(() => {
    const anims = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(v, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 400, useNativeDriver: true }),
          Animated.delay((2 - i) * 200),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [vals]);
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: v }} />
      ))}
    </View>
  );
}
