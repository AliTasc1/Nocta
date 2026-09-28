import { useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient as SvgLinear, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { PAPERS, paperDate, type Paper } from '@/lib/letters';
import { play, preloadSfx, stop } from '@/lib/sfx';
import { colors, fonts } from '@/theme';
import { BODY_X1, BottleBack, BottleFront, Cork, LIP_X, Scroll } from './Bottle';
import { OceanBack, OceanFront, oceanGeometry, sineOf, useLoop } from './Ocean';
import { PaperLines, PaperTexture, useSvgId } from './Paper';

/**
 * Önceden işlenmiş sinematik video (assets/video/bottle.mp4) hazır olduğunda
 * yalnızca bu satırı değiştirin:  export const BOTTLE_VIDEO: number | null = require('../../../assets/video/bottle.mp4');
 * Video varsa çizimli animasyon yerine tam ekran oynatılır, bitince onDone çağrılır.
 */
export const BOTTLE_VIDEO: number | null = null;

type Props = {
  paper: Paper;
  body: string;
  /** "Sevgili Deniz," */
  salutation: string;
  signature?: string;
  /** "yarın 09:00'da ulaşacak" gibi alt yazı */
  arrival: string;
  onDone: () => void;
};

/** Zaman çizelgesi (ms) — toplam ≈ 8.9 sn */
const T = {
  f1a: 450,
  f1b: 1200,
  f2a: 1300,
  f2b: 2050,
  strip: 2100,
  rollA: 2200,
  rollB: 2950,
  hand: 3000,
  toA: 3000,
  toB: 3650,
  ribA: 3150,
  ribB: 3550,
  inA: 2750,
  inB: 3600,
  slideA: 3700,
  slideB: 4420,
  corkA: 4520,
  corkHover: 4700,
  corkB: 4960,
  glint: 5000,
  pullA: 5250,
  pullB: 6750,
  driftA: 6750,
  driftB: 8650,
  caption: 6500,
  end: 8900,
};

const DEG = Math.PI / 180;
const THETA0 = 48; // şişe ekseni (derece, saat yönü): boyun sol üstte

export function BottleLaunch(props: Props) {
  if (BOTTLE_VIDEO != null) return <VideoLaunch source={BOTTLE_VIDEO} {...props} />;
  return <DrawnLaunch {...props} />;
}

function Caption({ arrival, opacity, translateY }: { arrival: string; opacity: any; translateY: any }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, top: insets.top + 28, alignItems: 'center', gap: 8, opacity, transform: [{ translateY }] }}>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serifItalic, fontSize: 30, lineHeight: 34, color: colors.pearl, textAlign: 'center', textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 12 }}>
        Mektubun denize açıldı
      </Text>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 11.5, letterSpacing: 1.4, color: '#F6E6C4', textAlign: 'center', opacity: 0.9 }}>
        {arrival.toLocaleUpperCase('tr-TR')}
      </Text>
    </Animated.View>
  );
}

function SkipButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Animasyonu geç"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({ position: 'absolute', right: 16, top: insets.top + 10, minHeight: 36, minWidth: 44, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', opacity: pressed ? 0.6 : 0.85 })}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.pearlSoft }}>Geç</Text>
    </Pressable>
  );
}

/** Tek seferlik, kararlı geri çağrı (her çizimde aynı fonksiyon) */
export function useOnce(fn: () => void) {
  const f = useRef(fn);
  useEffect(() => {
    f.current = fn;
  }, [fn]);
  const [cb] = useState(() => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      f.current();
    };
  });
  return cb;
}

// ─────────────────────────────────────────────────────────────
// Video yolu
// ─────────────────────────────────────────────────────────────
function VideoLaunch({ source, arrival, onDone }: Props & { source: number }) {
  const finish = useOnce(onDone);
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.play();
  });
  useEventListener(player, 'playToEnd', finish);
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') finish();
  });
  const [cap] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const t = setTimeout(() => Animated.timing(cap, { toValue: 1, duration: 700, useNativeDriver: true }).start(), 5200);
    return () => clearTimeout(t);
  }, [cap]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Caption arrival={arrival} opacity={cap} translateY={cap.interpolate({ inputRange: [0, 1], outputRange: [8, 0] })} />
      <SkipButton onPress={finish} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Çizimli sahne
// ─────────────────────────────────────────────────────────────
/** Mektubun katlanırken görünen yüzü (küçültülmüş metin) */
function SheetFace({ paper, w, h, body, salutation, signature }: { paper: Paper; w: number; h: number; body: string; salutation: string; signature?: string }) {
  const P = PAPERS[paper];
  const gap = Math.round(h / 17);
  const size = Math.round(gap * 0.7);
  const top = Math.round(gap * 0.8);
  const bodyLines = Math.max(3, Math.floor((h - top - gap * 3.4) / gap));
  const ink = { fontFamily: fonts.serifItalic, fontSize: size, lineHeight: gap, color: P.ink } as const;
  return (
    <View style={{ width: w, height: h, backgroundColor: P.bg }}>
      <PaperTexture paper={paper} radius={0} seed={5} />
      <PaperLines paper={paper} width={w} height={h} top={top} gap={gap} />
      <View style={{ position: 'absolute', left: 24, right: 14, top }}>
        <Text style={[ink, { textAlign: 'right', color: P.inkSoft }]} numberOfLines={1}>
          {paperDate(new Date())}
        </Text>
        <Text style={ink} numberOfLines={1}>
          {salutation}
        </Text>
        <Text style={ink} numberOfLines={bodyLines}>
          {body}
        </Text>
        {signature ? (
          <Text style={[ink, { textAlign: 'right' }]} numberOfLines={1}>
            {signature}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DrawnLaunch({ paper, body, salutation, signature, arrival, onDone }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const finish = useOnce(onDone);
  const P = PAPERS[paper];
  const g = useMemo(() => oceanGeometry(W, H), [W, H]);
  const deskG = useSvgId('desk');

  // ── Geometri ─────────────────────────────────────────────
  const G = useMemo(() => {
    const PW = Math.min(W - 72, 300);
    const PH = Math.round(PW * 1.3);
    const ph = PH / 3;
    const paperCY = H / 2 - 10;
    const BL = Math.min(W * 0.66, 270);
    const k = BL / 300;
    const D = Math.max(12, Math.round(21 * k));
    const Ls = ph;
    const by0 = Math.round(H * 0.1);
    const C = { x: W / 2, y: H / 2 + by0 };
    const th = THETA0 * DEG;
    // rulonun bittiği sahne noktası → şişe ekseni koordinatları
    const dx = W / 2 - PW / 2 - C.x;
    const dy = paperCY - C.y;
    const lx0 = dx * Math.cos(th) + dy * Math.sin(th);
    const ly0 = -dx * Math.sin(th) + dy * Math.cos(th);
    const lip = (LIP_X - 150) * k;
    const xs = lip - 16 - Ls / 2;
    const xr = (BODY_X1 - 150 - 8) * k - Ls / 2;
    const Lc = 36 * k;
    const Hc = 27 * k;
    const corkEnd = lip + Lc * 0.5 - Lc * 0.6;
    const corkHover = lip - Lc * 0.5 - 6;
    const corkStart = lip - Lc * 0.5 - 70;
    // denizde yüzdüğü nokta ve ufuk
    const F = { x: W * 0.4, y: g.horizon + (H - g.horizon) * 0.44 };
    const sF = 0.46;
    const Hz = { x: g.moonX - 4, y: g.horizon + 4 };
    return { PW, PH, ph, paperCY, BL, k, D, Ls, C, lx0, ly0, xs, xr, Lc, Hc, corkEnd, corkHover, corkStart, F, sF, Hz };
  }, [W, H, g]);

  // ── Ana saat (tek değer, yerel sürücü) ─────────────────────
  const [c] = useState(() => new Animated.Value(0));
  const [bobOn, setBobOn] = useState(false);
  const bob = useLoop(2600, bobOn);
  const ripple = useLoop(2400, bobOn);

  const A = useMemo(() => {
    const seg = (a: number, b: number, e: (x: number) => number = Easing.inOut(Easing.cubic)) => c.interpolate({ inputRange: [a, b], outputRange: [0, 1], easing: e, extrapolate: 'clamp' });
    const step = (a: number) => c.interpolate({ inputRange: [a - 1, a], outputRange: [0, 1], extrapolate: 'clamp' });
    const p1 = seg(T.f1a, T.f1b);
    const p2 = seg(T.f2a, T.f2b);
    const face = (p: Animated.AnimatedInterpolation<number>, front: boolean) => p.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: front ? [1, 1, 0, 0] : [0, 0, 1, 1] });
    const shadeFront = (p: Animated.AnimatedInterpolation<number>) => p.interpolate({ inputRange: [0, 0.5], outputRange: [0, 0.5], extrapolate: 'clamp' });
    const shadeBack = (p: Animated.AnimatedInterpolation<number>) => p.interpolate({ inputRange: [0.5, 1], outputRange: [0.55, 0.07], extrapolate: 'clamp' });
    const cast = (p: Animated.AnimatedInterpolation<number>) => p.interpolate({ inputRange: [0, 0.3, 0.75, 1], outputRange: [0, 0.05, 0.42, 0.16] });
    const roll = seg(T.rollA, T.rollB, Easing.inOut(Easing.quad));
    const hand = step(T.hand);
    const to = seg(T.toA, T.toB);
    const slide = seg(T.slideA, T.slideB, Easing.bezier(0.5, 0, 0.25, 1));
    const bounce = c.interpolate({ inputRange: [T.slideB, T.slideB + 90, T.slideB + 220], outputRange: [0, -4, 0], extrapolate: 'clamp' });
    const pull = seg(T.pullA, T.pullB, Easing.inOut(Easing.cubic));
    const drift = seg(T.driftA, T.driftB, Easing.out(Easing.quad));
    const corkIn = seg(T.corkA, T.corkHover, Easing.out(Easing.cubic));
    const corkPress = seg(T.corkHover + 60, T.corkB, Easing.in(Easing.quad));
    const shake = c.interpolate({ inputRange: [T.corkB, T.corkB + 50, T.corkB + 110, T.corkB + 190], outputRange: [0, -2.5, 1.6, 0], extrapolate: 'clamp' });
    const tx = Animated.add(Animated.add(Animated.multiply(pull, G.F.x - G.C.x), Animated.multiply(drift, G.Hz.x - G.F.x)), shake);
    const ty = Animated.add(Animated.multiply(pull, G.F.y - G.C.y), Animated.multiply(drift, G.Hz.y - G.F.y));
    const scale = Animated.multiply(pull.interpolate({ inputRange: [0, 1], outputRange: [1, G.sF] }), drift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.05 / G.sF] }));
    const ramp = c.interpolate({ inputRange: [T.pullA, T.pullB], outputRange: [0, 1], extrapolate: 'clamp' });
    return {
      rootOpacity: c.interpolate({ inputRange: [0, 280], outputRange: [0, 1], extrapolate: 'clamp' }),
      paperScale: c.interpolate({ inputRange: [0, 380], outputRange: [1.05, 1], easing: Easing.out(Easing.cubic), extrapolate: 'clamp' }),
      paperOn: c.interpolate({ inputRange: [T.strip - 1, T.strip], outputRange: [1, 0], extrapolate: 'clamp' }),
      p1,
      p2,
      rotBottom: p1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
      rotTop: p2.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-180deg'] }),
      f1Front: face(p1, true),
      f1Back: face(p1, false),
      f2Front: face(p2, true),
      f2Back: face(p2, false),
      s1Front: shadeFront(p1),
      s1Back: shadeBack(p1),
      s2Front: shadeFront(p2),
      s2Back: shadeBack(p2),
      cast1: cast(p1),
      cast2: cast(p2),
      // katlanan kâğıdın gölgesi: yükseklik küçülür
      shadowScale: Animated.add(p1.interpolate({ inputRange: [0, 1], outputRange: [1, -1 / 3] }), p2.interpolate({ inputRange: [0, 1], outputRange: [0, -1 / 3] })),
      shadowShift: Animated.add(p1.interpolate({ inputRange: [0, 1], outputRange: [0, -G.ph / 2] }), p2.interpolate({ inputRange: [0, 1], outputRange: [0, G.ph / 2] })),
      stripOn: c.interpolate({ inputRange: [T.strip - 1, T.strip, T.hand - 1, T.hand], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
      stripScale: roll.interpolate({ inputRange: [0, 1], outputRange: [1, 0.001] }),
      rollX: roll.interpolate({ inputRange: [0, 1], outputRange: [G.PW, 0] }),
      rollThick: roll.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.25, 0.45, 1] }),
      rollOn: c.interpolate({ inputRange: [T.rollA - 1, T.rollA, T.hand - 1, T.hand], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
      scrollOn: hand,
      scrollX: Animated.add(Animated.add(Animated.multiply(to, G.xs - G.lx0), Animated.multiply(slide, G.xr - G.xs)), Animated.add(bounce, G.lx0)),
      scrollY: to.interpolate({ inputRange: [0, 1], outputRange: [G.ly0, 0] }),
      scrollRot: to.interpolate({ inputRange: [0, 1], outputRange: [`${90 - THETA0}deg`, '0deg'] }),
      ribbon: seg(T.ribA, T.ribB, Easing.linear),
      bottleOpacity: seg(T.inA, T.inA + 350, Easing.linear),
      bottleX: seg(T.inA, T.inB, Easing.out(Easing.cubic)).interpolate({ inputRange: [0, 1], outputRange: [W * 0.95, 0] }),
      corkOpacity: seg(T.corkA, T.corkA + 160, Easing.linear),
      corkX: Animated.add(Animated.multiply(corkIn, G.corkHover - G.corkStart), Animated.add(Animated.multiply(corkPress, G.corkEnd - G.corkHover), G.corkStart)),
      corkSquash: c.interpolate({ inputRange: [T.corkB - 40, T.corkB, T.corkB + 140], outputRange: [1, 0.86, 1], extrapolate: 'clamp' }),
      glints: [0, 1, 2, 3].map((i) => c.interpolate({ inputRange: [T.glint + i * 80, T.glint + i * 80 + 110, T.glint + i * 80 + 280], outputRange: [0, 0.9, 0], extrapolate: 'clamp' })),
      axisRot: pull.interpolate({ inputRange: [0, 1], outputRange: [`${THETA0}deg`, '5deg'] }),
      tx,
      ty,
      scale,
      groupOpacity: c.interpolate({ inputRange: [T.driftB - 700, T.driftB], outputRange: [1, 0], extrapolate: 'clamp' }),
      wobbleY: Animated.multiply(sineOf(bob, 6), ramp),
      wobbleRot: Animated.multiply(sineOf(bob, 1, 0.18), ramp).interpolate({ inputRange: [-1, 1], outputRange: ['-3.5deg', '3.5deg'] }),
      water: c.interpolate({ inputRange: [T.pullA + 300, T.pullA + 1100], outputRange: [0, 1], extrapolate: 'clamp' }),
      desk: c.interpolate({ inputRange: [T.pullA, T.pullA + 1000], outputRange: [1, 0], extrapolate: 'clamp' }),
      oceanScale: pull.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }),
      oceanY: pull.interpolate({ inputRange: [0, 1], outputRange: [H * 0.2, 0] }),
      nearY: pull.interpolate({ inputRange: [0, 1], outputRange: [H * 0.55, 0] }),
      caption: c.interpolate({ inputRange: [T.caption, T.caption + 800], outputRange: [0, 1], extrapolate: 'clamp' }),
      captionY: c.interpolate({ inputRange: [T.caption, T.caption + 800], outputRange: [10, 0], easing: Easing.out(Easing.cubic), extrapolate: 'clamp' }),
    };
  }, [c, G, W, H, bob]);

  // ── Başlat: saat + sesler + titreşimler ─────────────────────
  useEffect(() => {
    preloadSfx(['paper_fold', 'cork_pop', 'glass_bottle', 'ocean_waves']);
    const anim = Animated.timing(c, { toValue: T.end, duration: T.end, easing: Easing.linear, useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished) finish();
    });
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    at(T.f1a - 20, () => play('paper_fold'));
    at(T.f1b - 60, light);
    at(T.f2a - 20, () => play('paper_fold', { volume: 0.9 }));
    at(T.f2b - 60, light);
    at(T.rollA, () => play('paper_fold', { volume: 0.55 }));
    at(T.slideB - 20, () => {
      play('glass_bottle', { volume: 0.8 });
      light();
    });
    at(T.corkB - 330, () => play('cork_pop'));
    at(T.corkB, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}));
    at(T.pullA - 150, () => {
      play('ocean_waves', { volume: 0.6, loop: true });
      setBobOn(true);
    });
    return () => {
      anim.stop();
      timers.forEach(clearTimeout);
      stop('ocean_waves');
    };
  }, [c, finish]);

  const { PW, PH, ph, paperCY, BL, D, Ls, C, Lc, Hc } = G;
  const paperLeft = W / 2 - PW / 2;
  const paperTop = paperCY - PH / 2;
  const face = (i: number) => (
    <View style={{ position: 'absolute', left: 0, top: -i * ph, width: PW, height: PH }}>
      <SheetFace paper={paper} w={PW} h={PH} body={body} salutation={salutation} signature={signature} />
    </View>
  );
  /** Kâğıdın arka yüzü: mürekkep hafifçe tersinden görünür */
  const back = (i: number) => (
    <View style={{ position: 'absolute', left: 0, top: 0, width: PW, height: ph, overflow: 'hidden', backgroundColor: P.back }}>
      <View style={{ opacity: paper === 'night' ? 0.1 : 0.14 }}>{face(i)}</View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: P.back, opacity: 0.55 }]} />
      <PaperTexture paper={paper} radius={0} seed={9 + i} />
    </View>
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: A.rootOpacity, backgroundColor: '#03040A', overflow: 'hidden' }]}>
      {/* ── Okyanus (kamera geri çekilince görünür) ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: A.oceanY }, { scale: A.oceanScale }] }]}>
        <OceanBack g={g} />
      </Animated.View>

      {/* ── Yakın çekim zemini: loş, sıcak masa ışığı ── */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: A.desk }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink }]} />
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={deskG} cx="50%" cy="52%" r="65%">
              <Stop offset="0" stopColor="#6B3A1E" stopOpacity={0.42} />
              <Stop offset="0.45" stopColor="#4A1A2E" stopOpacity={0.25} />
              <Stop offset="1" stopColor="#0C080B" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill={`url(#${deskG})`} />
        </Svg>
      </Animated.View>

      {/* ── 1) Katlanan kâğıt ── */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: paperLeft, top: paperTop, width: PW, height: PH, opacity: A.paperOn, transform: [{ scale: A.paperScale }] }}>
        {/* yumuşak gölge (katlandıkça kısalır) */}
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: PH, transform: [{ translateY: A.shadowShift }, { translateY: 12 }, { scaleY: A.shadowScale }] }}>
          {[12, 7, 3].map((s, i) => (
            <View key={s} style={{ position: 'absolute', left: -s + 4, right: -s + 4, top: -s + 10, bottom: -s + 2, borderRadius: 8 + s, backgroundColor: '#000', opacity: 0.07 + i * 0.05 }} />
          ))}
        </Animated.View>
        {/* orta panel */}
        <View style={{ position: 'absolute', left: 0, top: ph, width: PW, height: ph, overflow: 'hidden' }}>
          {face(1)}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: A.cast1 }]}>
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.85)']} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        {/* alt kanat: yukarı katlanır */}
        <Animated.View style={{ position: 'absolute', left: 0, top: ph * 2, width: PW, height: ph, transformOrigin: 'top', transform: [{ perspective: 1100 }, { rotateX: A.rotBottom }] }}>
          <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: A.f1Front }]}>
            {face(2)}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: A.s1Front }]} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: A.f1Back }]}>
            {back(2)}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: A.s1Back }]} />
            <LinearGradient colors={['rgba(0,0,0,.14)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 10 }} />
          </Animated.View>
        </Animated.View>
        {/* üst kanadın düşürdüğü gölge (alt kanadın üstünde) */}
        <Animated.View style={{ position: 'absolute', left: 0, top: ph, width: PW, height: ph, opacity: A.cast2 }}>
          <LinearGradient colors={['rgba(0,0,0,.85)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* üst kanat: aşağı katlanır */}
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: PW, height: ph, transformOrigin: 'bottom', transform: [{ perspective: 1100 }, { rotateX: A.rotTop }] }}>
          <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: A.f2Front }]}>
            {face(0)}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: A.s2Front }]} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: A.f2Back }]}>
            {back(0)}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: A.s2Back }]} />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.16)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10 }} />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* ── 2) Katlanmış şerit rulo olur ── */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: paperLeft, top: paperCY - ph / 2, width: PW, height: ph, opacity: A.stripOn, transformOrigin: 'left', transform: [{ scaleX: A.stripScale }] }}>
        <View style={[StyleSheet.absoluteFill, { borderRadius: 2, overflow: 'hidden' }]}>{back(0)}</View>
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.28)']} start={{ x: 0.82, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1.5, backgroundColor: P.edge, opacity: 0.7 }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1.5, backgroundColor: P.edge, opacity: 0.7 }} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: paperLeft, top: paperCY, width: 0, height: 0, opacity: A.rollOn, transform: [{ translateX: A.rollX }, { rotate: '90deg' }, { scaleY: A.rollThick }] }}>
        <Scroll length={ph} thickness={D} paper={paper} />
      </Animated.View>

      {/* ── 3–6) Şişe grubu: kamera, sallanma, eksen ── */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: C.x, top: C.y, width: 0, height: 0, opacity: A.groupOpacity, transform: [{ translateX: A.tx }, { translateY: A.ty }, { scale: A.scale }] }}>
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: [{ translateY: A.wobbleY }, { rotate: A.wobbleRot }] }}>
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: [{ rotate: A.axisRot }] }}>
            <BottleBack width={BL} style={{ opacity: A.bottleOpacity, transform: [{ translateX: A.bottleX }] }} />
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, opacity: A.scrollOn, transform: [{ translateX: A.scrollX }, { translateY: A.scrollY }, { rotate: A.scrollRot }] }}>
              <Scroll length={Ls} thickness={D} paper={paper} ribbon={A.ribbon} />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, opacity: A.corkOpacity, transform: [{ translateX: A.corkX }, { scaleX: A.corkSquash }] }}>
              <Cork width={Lc} height={Hc} />
            </Animated.View>
            <BottleFront width={BL} glints={A.glints} style={{ opacity: A.bottleOpacity, transform: [{ translateX: A.bottleX }] }} />
          </Animated.View>
        </Animated.View>
        {/* şişenin çevresindeki su: su hattı, köpük ve halkalar */}
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, opacity: A.water }}>
          <Ripples bl={BL} v={ripple} />
          <WaterPatch bl={BL} />
        </Animated.View>
      </Animated.View>

      {/* ── ön dalgalar (şişenin önünden geçer) ── */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateY: A.nearY }] }]}>
        <OceanFront g={g} />
      </Animated.View>

      <Caption arrival={arrival} opacity={A.caption} translateY={A.captionY} />
      <SkipButton onPress={finish} />
    </Animated.View>
  );
}

/** Şişenin önünü kısmen örten yerel su yüzeyi (şişe suya gömülü görünür) */
export function WaterPatch({ bl, top = 0.03 }: { bl: number; top?: number }) {
  const m = useSvgId('wm');
  const mg = useSvgId('wmg');
  const fg = useSvgId('wfg');
  const w = bl * 1.9;
  const h = bl * 0.34;
  const y0 = bl * top; // su hattı (şişe merkezinin altında)
  let d = `M0 ${h * 0.12} `;
  for (let x = 0; x <= w; x += 6) {
    const u = x / w;
    d += `L${x.toFixed(1)} ${(h * 0.12 + Math.sin(u * Math.PI * 7) * 1.6 + Math.sin(u * Math.PI * 3 + 1) * 1.2).toFixed(2)} `;
  }
  const crest = d;
  d += `L${w} ${h} L0 ${h} Z`;
  return (
    <View style={{ position: 'absolute', left: -w / 2, top: y0 - h * 0.12, width: w, height: h }}>
      <Svg width={w} height={h}>
        <Defs>
          <SvgLinear id={mg} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset="0.25" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.75" stopColor="#fff" stopOpacity={1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </SvgLinear>
          <Mask id={m}>
            <Rect x={0} y={0} width={w} height={h} fill={`url(#${mg})`} />
          </Mask>
          <SvgLinear id={fg} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#24386E" stopOpacity={0.97} />
            <Stop offset="0.35" stopColor="#12214B" stopOpacity={0.94} />
            <Stop offset="1" stopColor="#0A1433" stopOpacity={0} />
          </SvgLinear>
        </Defs>
        <Path d={d} fill={`url(#${fg})`} mask={`url(#${m})`} />
        <Path d={crest} fill="none" stroke="#DCE6FF" strokeOpacity={0.55} strokeWidth={1.4} mask={`url(#${m})`} />
      </Svg>
    </View>
  );
}

/** Şişenin etrafında yayılan su halkaları */
export function Ripples({ bl, v, top = 0.03 }: { bl: number; v: Animated.Value; top?: number }) {
  const y0 = bl * top;
  const w = bl * 1.2;
  const h = bl * 0.12;
  return (
    <>
      {[0, 0.5].map((ph) => {
        const u = v.interpolate({ inputRange: [0, 1 - ph, 1 - ph + 0.0001, 1], outputRange: [ph, 1, 0, ph] });
        return (
          <Animated.View
            key={ph}
            style={{
              position: 'absolute',
              left: -w / 2,
              top: y0 - h / 2,
              width: w,
              height: h,
              opacity: u.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }),
              transform: [{ scaleX: u.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.45] }) }, { scaleY: u.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.8] }) }],
            }}
          >
            <Svg width={w} height={h}>
              <Ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} stroke="#D2E0FF" strokeOpacity={0.6} strokeWidth={1.2} fill="none" />
            </Svg>
          </Animated.View>
        );
      })}
    </>
  );
}
