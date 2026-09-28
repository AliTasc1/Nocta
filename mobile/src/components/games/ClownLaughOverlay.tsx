import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { isMuted, play, stop } from '@/lib/sfx';
import { fonts } from '@/theme';
import { ClownHead } from './Clown';
import { haptic, useReducedMotion } from './shared';

/**
 * Higgsfield ile üretilmiş palyaço kahkaha videosu buraya bağlanır:
 *   export const CLOWN_VIDEO: number | null = require('../../../assets/video/clown.mp4');
 * null iken çizilmiş palyaço animasyonu + 'clown_laugh' sesi kullanılır.
 */
export const CLOWN_VIDEO: number | null = null;

const DRAWN_MS = 3400;
const VIDEO_MAX_MS = 9000;
const HA = [
  { x: 0.1, y: 0.19, r: -14, d: 250 },
  { x: 0.68, y: 0.15, r: 12, d: 520 },
  { x: 0.06, y: 0.8, r: 10, d: 820 },
  { x: 0.64, y: 0.83, r: -10, d: 1080 },
  { x: 0.38, y: 0.08, r: 4, d: 1350 },
];

/**
 * Yanlış tahminde palyaçonun kahkahası.
 *  - `play` her yeni (doğru-sal) değer aldığında gösterilir; kendiliğinden kapanır, dokununca da kapanır.
 *  - `videoSource` verilirse video tam ekran oynar (kendi sesiyle); yoksa çizilmiş palyaço + 'clown_laugh'.
 *  - `variant="small"`: fotoğrafı çeken tarafta ekranı kapatmayan küçük kart.
 */
export function ClownLaughOverlay({ play: trigger, videoSource, variant = 'full', caption = 'Palyaço kazandı!', onDone }: { play: number | string | null | undefined; videoSource?: VideoSource; variant?: 'full' | 'small'; caption?: string; onDone?: () => void }) {
  const [active, setActive] = useState<number | string | null>(null);
  const [seen, setSeen] = useState(trigger);
  if (trigger !== seen) {
    setSeen(trigger);
    if (trigger) setActive(trigger);
  }
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  if (!active) return null;
  const close = () => {
    setActive(null);
    doneRef.current?.();
  };
  if (videoSource != null && variant === 'full') return <VideoLaugh key={String(active)} source={videoSource} onClose={close} />;
  return <DrawnLaugh key={String(active)} variant={variant} caption={caption} onClose={close} />;
}

function VideoLaugh({ source, onClose }: { source: VideoSource; onClose: () => void }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = isMuted();
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    haptic.error();
    const sub = player.addListener('playToEnd', () => closeRef.current());
    const t = setTimeout(() => closeRef.current(), VIDEO_MAX_MS);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [player]);
  useEffect(() => {
    if (status === 'error') closeRef.current();
  }, [status]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Palyaço gülüyor. Kapatmak için dokun." onPress={onClose} style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: '#000' }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} />
    </Pressable>
  );
}

function DrawnLaugh({ variant, caption, onClose }: { variant: 'full' | 'small'; caption: string; onClose: () => void }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const small = variant === 'small';
  const [a] = useState(() => ({
    fade: new Animated.Value(0),
    zoom: new Animated.Value(0),
    shake: new Animated.Value(0),
    bounce: new Animated.Value(0),
    jaw: new Animated.Value(0.7),
    rays: new Animated.Value(0),
    ha: HA.map(() => new Animated.Value(0)),
  }));
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    play('clown_laugh', { volume: small ? 0.6 : 1 });
    if (!small) haptic.error();
    const r = reduced;
    Animated.timing(a.fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    Animated.spring(a.zoom, { toValue: 1, friction: r ? 12 : 5, tension: r ? 200 : 60, useNativeDriver: true }).start();
    const loops = r
      ? []
      : [
          // kahkaha titremesi: hızlı sağa-sola sarsılma
          Animated.loop(
            Animated.sequence([
              Animated.timing(a.shake, { toValue: 1, duration: 70, useNativeDriver: true }),
              Animated.timing(a.shake, { toValue: -1, duration: 140, useNativeDriver: true }),
              Animated.timing(a.shake, { toValue: 0, duration: 70, useNativeDriver: true }),
            ]),
          ),
          // her "ha"da zıplama
          Animated.loop(
            Animated.sequence([
              Animated.timing(a.bounce, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(a.bounce, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ]),
          ),
          // çene: ha-ha-ha
          Animated.loop(
            Animated.sequence([
              Animated.timing(a.jaw, { toValue: 1.02, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(a.jaw, { toValue: 0.5, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ]),
          ),
          Animated.loop(Animated.timing(a.rays, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })),
        ];
    loops.forEach((l) => l.start());
    const has = a.ha.map((v, i) =>
      Animated.sequence([Animated.delay(HA[i].d), Animated.spring(v, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true })]),
    );
    if (!r) has.forEach((h) => h.start());
    const shakes = r ? [] : [0, 260, 540, 820, 1100, 1400].map((ms) => setTimeout(haptic.light, ms));
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(a.fade, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(a.zoom, { toValue: small ? 0 : 1.6, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => closeRef.current());
    }, DRAWN_MS);
    return () => {
      clearTimeout(t);
      shakes.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
      has.forEach((h) => h.stop());
      stop('clown_laugh');
    };
  }, [a, reduced, small]);

  const head = small ? Math.min(150, width * 0.4) : Math.min(width * 0.78, height * 0.44, 380);
  const clown = (
    <Animated.View
      style={{
        transform: [
          { translateY: a.bounce.interpolate({ inputRange: [0, 1], outputRange: [0, small ? -6 : -16] }) },
          { scale: a.zoom.interpolate({ inputRange: [0, 1, 1.6], outputRange: [0.15, 1, 1.9] }) },
          { rotate: a.zoom.interpolate({ inputRange: [0, 1, 1.6], outputRange: ['-35deg', '0deg', '8deg'] }) },
          { rotate: a.shake.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) },
        ],
      }}
    >
      <ClownHead size={head} mood="laugh" jaw={a.jaw} />
    </Animated.View>
  );

  if (small) {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 50, alignItems: 'center', justifyContent: 'center', pointerEvents: 'box-none' }]}>
        <Animated.View style={{ opacity: a.fade }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Palyaço gülüyor. Kapatmak için dokun."
            onPress={onClose}
            style={{ width: head + 70, alignItems: 'center', paddingTop: 18, paddingBottom: 14, borderRadius: 28, backgroundColor: '#1A0C16', borderWidth: 1.5, borderColor: 'rgba(255,77,94,.55)', shadowColor: '#FF4D5E', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 12 }}
          >
            {clown}
            <Text maxFontSizeMultiplier={1.2} style={{ marginTop: 6, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 1, color: '#FF6B7A' }}>HA HA HA!</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 50, opacity: a.fade }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${caption} Palyaço gülüyor. Kapatmak için dokun.`} onPress={onClose} style={StyleSheet.absoluteFill}>
        <LaughBackdrop w={width} h={height} />
        <Animated.View
          style={{
            position: 'absolute',
            left: width / 2 - height * 0.75,
            top: height * 0.44 - height * 0.75,
            width: height * 1.5,
            height: height * 1.5,
            opacity: 0.55,
            transform: [{ rotate: a.rays.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          }}
        >
          <Rays />
        </Animated.View>
        {HA.map((h, i) => (
          <Animated.Text
            key={i}
            allowFontScaling={false}
            style={{
              position: 'absolute',
              left: width * h.x,
              top: height * h.y,
              fontFamily: fonts.extrabold,
              fontSize: 30 + (i % 2) * 8,
              color: i % 2 ? '#FFD66B' : '#FF6B7A',
              textShadowColor: 'rgba(0,0,0,.6)',
              textShadowOffset: { width: 0, height: 3 },
              textShadowRadius: 8,
              opacity: a.ha[i],
              transform: [{ rotate: `${h.r}deg` }, { scale: a.ha[i].interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
            }}
          >
            HA!
          </Animated.Text>
        ))}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {clown}
          <Animated.Text
            maxFontSizeMultiplier={1.2}
            style={{
              marginTop: 18,
              fontFamily: fonts.serifItalic,
              fontSize: 40,
              lineHeight: 44,
              color: '#FFF3EA',
              textAlign: 'center',
              textShadowColor: 'rgba(0,0,0,.7)',
              textShadowOffset: { width: 0, height: 3 },
              textShadowRadius: 10,
              transform: [{ scale: a.zoom.interpolate({ inputRange: [0, 1, 1.6], outputRange: [0.6, 1, 1.1] }) }],
            }}
          >
            {caption}
          </Animated.Text>
          <Text style={{ marginTop: 8, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: 'rgba(255,243,234,.6)' }}>KAPATMAK İÇİN DOKUN</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function LaughBackdrop({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="lb" cx="0.5" cy="0.44" r="0.75">
          <Stop offset="0" stopColor="#6B1026" stopOpacity="0.96" />
          <Stop offset="0.55" stopColor="#2A0716" stopOpacity="0.97" />
          <Stop offset="1" stopColor="#07030A" stopOpacity="0.98" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#lb)" />
    </Svg>
  );
}

function Rays() {
  const n = 16;
  return (
    <Svg width="100%" height="100%" viewBox="-100 -100 200 200">
      <G>
        {Array.from({ length: n }).map((_, i) => {
          const a1 = ((i * 360) / n) * (Math.PI / 180);
          const a2 = (((i + 0.5) * 360) / n) * (Math.PI / 180);
          return <Path key={i} d={`M0 0 L${Math.cos(a1) * 100} ${Math.sin(a1) * 100} L${Math.cos(a2) * 100} ${Math.sin(a2) * 100} Z`} fill={i % 2 ? '#FF4D5E' : '#FFD66B'} fillOpacity={0.12} />;
        })}
      </G>
    </Svg>
  );
}
