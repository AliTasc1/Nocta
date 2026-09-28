import { useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinear, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { PAPERS, type Paper } from '@/lib/letters';
import { play, preloadSfx, stop } from '@/lib/sfx';
import { colors, fonts } from '@/theme';
import { BODY_X1, BottleBack, BottleFront, Cork, LIP_X, Scroll } from './Bottle';
import { Ripples, useOnce, WaterPatch } from './BottleLaunch';
import { OceanBack, oceanGeometry, sineOf, useLoop } from './Ocean';
import { letterText, PAPER_PAD_X, PAPER_TOP, PaperLines, PaperTexture, prng, useSvgId } from './Paper';

/**
 * Önceden işlenmiş sinematik varış videosu (assets/video/arrive.mp4) hazır olduğunda
 * yalnızca bu satırı değiştirin:  export const ARRIVE_VIDEO: number | null = require('../../../assets/video/arrive.mp4');
 */
export const ARRIVE_VIDEO: number | null = null;

type Props = {
  paper: Paper;
  /** "Deniz" — başlıkta kullanılır */
  fromName: string;
  /** Açılan kâğıtta görünen metin (okuma ekranıyla aynı) */
  salutation?: string;
  body?: string;
  onDone: () => void;
};

const T = {
  capA: 400,
  approachA: 150,
  approachB: 2700,
  washA: 2250,
  washB: 3400,
  pushA: 3000,
  pushB: 3850,
  pop: 4050,
  outA: 4300,
  outB: 5000,
  untie: 4950,
  centerA: 5050,
  centerB: 5650,
  unrollA: 5650,
  unrollB: 6600,
  fadeA: 6750,
  end: 7250,
};

const THETA = 28; // yakın çekimde şişe ekseni (boyun sol üstte)

export function BottleArrive(props: Props) {
  if (ARRIVE_VIDEO != null) return <VideoArrive source={ARRIVE_VIDEO} {...props} />;
  return <DrawnArrive {...props} />;
}

function Skip({ onPress }: { onPress: () => void }) {
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

function VideoArrive({ source, onDone }: Props & { source: number }) {
  const finish = useOnce(onDone);
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.play();
  });
  useEventListener(player, 'playToEnd', finish);
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') finish();
  });
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Skip onPress={finish} />
    </View>
  );
}

/** Kıyı: ay ışığında ıslak kum + gelip giden köpük */
function Shore({ W, H, y }: { W: number; H: number; y: number }) {
  const sand = useSvgId('sand');
  const wet = useSvgId('wet');
  const h = H - y;
  let edge = `M0 ${h * 0.1} `;
  for (let x = 0; x <= W; x += 8) edge += `L${x} ${(h * 0.1 + Math.sin((x / W) * Math.PI * 2.2 + 0.6) * 6 + Math.sin((x / W) * Math.PI * 7) * 2).toFixed(1)} `;
  const fill = `${edge} L${W} ${h} L0 ${h} Z`;
  const specks = useMemo(() => {
    const r = prng(21);
    return Array.from({ length: 140 }, () => ({ x: r() * W, y: h * 0.18 + r() * h * 0.82, s: 0.4 + r() * 1.1, o: 0.05 + r() * 0.15 }));
  }, [W, h]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: y, width: W, height: h }}>
      <Svg width={W} height={h}>
        <Defs>
          <SvgLinear id={sand} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5A5064" />
            <Stop offset="0.12" stopColor="#433A4C" />
            <Stop offset="0.45" stopColor="#2C2432" />
            <Stop offset="1" stopColor="#120D14" />
          </SvgLinear>
          <RadialGradient id={wet} cx="62%" cy="10%" r="60%">
            <Stop offset="0" stopColor="#FFF1D2" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#FFF1D2" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={fill} fill={`url(#${sand})`} />
        <Path d={fill} fill={`url(#${wet})`} />
        {specks.map((s, i) => (
          <Rect key={i} x={s.x} y={s.y} width={s.s} height={s.s} fill="#E9DDC8" opacity={s.o} />
        ))}
      </Svg>
    </View>
  );
}

/** Kumu yalayan köpük dili */
function Wash({ W, y, v }: { W: number; y: number; v: Animated.AnimatedInterpolation<number> }) {
  const f = useSvgId('foam');
  const h = 70;
  let top = 'M0 18 ';
  for (let x = 0; x <= W; x += 8) top += `L${x} ${(18 + Math.sin((x / W) * Math.PI * 5 + 1) * 5 + Math.sin((x / W) * Math.PI * 13) * 2).toFixed(1)} `;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: y - 18,
        width: W,
        height: h,
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.95, 0.6, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 0.45, 1], outputRange: [-10, 34, 18] }) }],
      }}
    >
      <Svg width={W} height={h}>
        <Defs>
          <SvgLinear id={f} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E8F0FF" stopOpacity={0.75} />
            <Stop offset="0.25" stopColor="#9FB2DE" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#6E82B8" stopOpacity={0} />
          </SvgLinear>
        </Defs>
        <Path d={`${top} L${W} ${h} L0 ${h} Z`} fill={`url(#${f})`} />
        <Path d={top} stroke="#F4F8FF" strokeOpacity={0.8} strokeWidth={1.6} fill="none" />
      </Svg>
    </Animated.View>
  );
}

function Sparkles({ at, v, count = 12 }: { at: number; v: Animated.AnimatedInterpolation<number>; count?: number }) {
  const parts = useMemo(() => {
    const r = prng(33);
    return Array.from({ length: count }, (_, i) => {
      const a = Math.PI + (r() - 0.5) * Math.PI * 1.3; // boyundan dışarı (−x yönüne) doğru
      const d = 40 + r() * 70;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 10, s: 5 + r() * 7, rot: r() * 90, delay: (i % 4) * 0.06 };
    });
  }, [count]);
  return (
    <>
      {parts.map((p, i) => {
        const u = v.interpolate({ inputRange: [p.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: at - p.s / 2,
              top: -p.s / 2,
              width: p.s,
              height: p.s,
              opacity: u.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 1, 0.8, 0] }),
              transform: [
                { translateX: u.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx], easing: Easing.out(Easing.cubic) }) },
                { translateY: u.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy], easing: Easing.out(Easing.cubic) }) },
                { rotate: `${p.rot}deg` },
                { scale: u.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.2, 1.2, 0.4] }) },
              ],
            }}
          >
            <Svg width="100%" height="100%" viewBox="0 0 20 20">
              <Path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill="#FFF3D0" />
            </Svg>
          </Animated.View>
        );
      })}
    </>
  );
}

function DrawnArrive({ paper, fromName, onDone, salutation, body }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const finish = useOnce(onDone);
  const g = useMemo(() => oceanGeometry(W, H), [W, H]);
  const P = PAPERS[paper];
  const glowId = useSvgId('ag');

  const G = useMemo(() => {
    const BL = Math.min(W * 0.66, 270);
    const k = BL / 300;
    const D = Math.max(12, Math.round(21 * k));
    const Ls = Math.round(Math.min(W - 72, 300) * 0.433);
    const lip = (LIP_X - 150) * k;
    const xr = (BODY_X1 - 150 - 8) * k - Ls / 2;
    const xs = lip - 18 - Ls / 2;
    const Lc = 36 * k;
    const Hc = 27 * k;
    const corkEnd = lip + Lc * 0.5 - Lc * 0.6;
    const shoreY = Math.round(H * 0.74);
    const P0 = { x: g.moonX - 4, y: g.horizon + 5, s: 0.05, r: 4 };
    const P1 = { x: W * 0.44, y: shoreY + 18, s: 0.5, r: -6 };
    const P2 = { x: W * 0.54, y: H * 0.54, s: 1, r: THETA };
    const P3 = { x: W / 2 - xs, y: H * 0.47, s: 1, r: 0 };
    const PWr = W - 40;
    const PHr = Math.min(Math.round(PWr * 1.2), Math.round(H * 0.6));
    return { BL, k, D, Ls, lip, xr, xs, Lc, Hc, corkEnd, shoreY, P0, P1, P2, P3, PWr, PHr };
  }, [W, H, g]);

  const [c] = useState(() => new Animated.Value(0));
  const bob = useLoop(2400);
  const ripple = useLoop(2200);

  const A = useMemo(() => {
    const seg = (a: number, b: number, e: (x: number) => number = Easing.inOut(Easing.cubic)) => c.interpolate({ inputRange: [a, b], outputRange: [0, 1], easing: e, extrapolate: 'clamp' });
    const ap = seg(T.approachA, T.approachB, Easing.bezier(0.45, 0, 0.55, 1));
    const push = seg(T.pushA, T.pushB);
    const cen = seg(T.centerA, T.centerB);
    const { P0, P1, P2, P3 } = G;
    const lin = (vals: [number, number, number, number]) =>
      Animated.add(Animated.add(Animated.multiply(ap, vals[1] - vals[0]), Animated.multiply(push, vals[2] - vals[1])), Animated.add(Animated.multiply(cen, vals[3] - vals[2]), vals[0]));
    // ölçek: yaklaşırken perspektif (1/z) → üstel büyüme hissi
    const apScale = ap.interpolate({ inputRange: [0, 0.5, 0.8, 1], outputRange: [P0.s, P0.s * 2.6, P1.s * 0.62, P1.s] });
    const scale = Animated.multiply(apScale, push.interpolate({ inputRange: [0, 1], outputRange: [1, P2.s / P1.s] }));
    const rotNum = lin([P0.r, P1.r, P2.r, P3.r]);
    const onSea = c.interpolate({ inputRange: [0, T.approachB - 250, T.approachB + 150], outputRange: [1, 1, 0], extrapolate: 'clamp' });
    const pop = seg(T.pop, T.pop + 750, Easing.out(Easing.quad));
    const out = seg(T.outA, T.outB, Easing.inOut(Easing.quad));
    const unroll = seg(T.unrollA, T.unrollB, Easing.inOut(Easing.cubic));
    const s0 = G.Ls / G.PWr;
    return {
      root: c.interpolate({ inputRange: [0, 300, T.fadeA, T.end], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
      caption: c.interpolate({ inputRange: [T.capA, T.capA + 700, T.pushA - 300, T.pushA + 200], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
      tx: lin([P0.x, P1.x, P2.x, P3.x]),
      ty: lin([P0.y, P1.y, P2.y, P3.y]),
      scale,
      rot: rotNum.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }),
      wobY: Animated.multiply(sineOf(bob, 7), onSea),
      wobR: Animated.multiply(sineOf(bob, 1, 0.2), onSea).interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] }),
      water: onSea,
      wash: seg(T.washA, T.washB, Easing.linear),
      dim: c.interpolate({ inputRange: [T.pushA, T.pushB], outputRange: [0, 0.82], extrapolate: 'clamp' }),
      corkX: pop.interpolate({ inputRange: [0, 1], outputRange: [G.corkEnd, G.corkEnd - 150] }),
      corkY: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -70, -40] }),
      corkR: pop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-420deg'] }),
      corkO: c.interpolate({ inputRange: [T.pop + 350, T.pop + 750], outputRange: [1, 0], extrapolate: 'clamp' }),
      popSquash: c.interpolate({ inputRange: [T.pop - 80, T.pop, T.pop + 120], outputRange: [1, 1.06, 1], extrapolate: 'clamp' }),
      sparkle: seg(T.pop, T.pop + 1100, Easing.linear),
      scrollX: out.interpolate({ inputRange: [0, 1], outputRange: [G.xr, G.xs] }),
      ribbon: c.interpolate({ inputRange: [T.untie, T.untie + 300], outputRange: [1, 0], extrapolate: 'clamp' }),
      scrollO: c.interpolate({ inputRange: [T.unrollA - 1, T.unrollA], outputRange: [1, 0], extrapolate: 'clamp' }),
      bottleO: c.interpolate({ inputRange: [T.centerA, T.centerB - 100], outputRange: [1, 0], extrapolate: 'clamp' }),
      bottleX: cen.interpolate({ inputRange: [0, 1], outputRange: [0, W * 0.5] }),
      revealO: c.interpolate({ inputRange: [T.unrollA - 1, T.unrollA], outputRange: [0, 1], extrapolate: 'clamp' }),
      revealScale: unroll.interpolate({ inputRange: [0, 0.35, 1], outputRange: [s0, s0 * 1.25, 1] }),
      paperScaleY: unroll.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] }),
      rollTopY: unroll.interpolate({ inputRange: [0, 1], outputRange: [0, -G.PHr / 2] }),
      rollBotY: unroll.interpolate({ inputRange: [0, 1], outputRange: [0, G.PHr / 2] }),
      rollThick: unroll.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
      rollO: c.interpolate({ inputRange: [T.unrollB - 150, T.unrollB + 100], outputRange: [1, 0], extrapolate: 'clamp' }),
      glow: c.interpolate({ inputRange: [T.pop - 100, T.pop + 300, T.unrollB], outputRange: [0, 1, 0.5], extrapolate: 'clamp' }),
    };
  }, [c, G, W, bob]);

  useEffect(() => {
    preloadSfx(['ocean_waves', 'glass_bottle', 'cork_pop', 'letter_arrive', 'paper_fold']);
    play('ocean_waves', { volume: 0.55, loop: true });
    const anim = Animated.timing(c, { toValue: T.end, duration: T.end, easing: Easing.linear, useNativeDriver: true });
    anim.start(({ finished }) => {
      if (finished) finish();
    });
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    at(T.approachB - 40, () => {
      play('glass_bottle', { volume: 0.55 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    });
    at(T.pushB, () => stop('ocean_waves'));
    at(T.pop - 330, () => play('cork_pop'));
    at(T.pop, () => {
      play('letter_arrive');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
    at(T.unrollA, () => play('paper_fold', { volume: 0.7 }));
    return () => {
      anim.stop();
      timers.forEach(clearTimeout);
      stop('ocean_waves');
    };
  }, [c, finish]);

  const { BL, D, Ls, lip, Lc, Hc, PWr, PHr, shoreY } = G;
  const rollerD = (D * PWr) / Ls;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: A.root, backgroundColor: '#03040A', overflow: 'hidden' }]}>
      <OceanBack g={g} />
      <Shore W={W} H={H} y={shoreY} />

      {/* yakın çekim: loş zemin + sıcak ışık */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink, opacity: A.dim }]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: A.glow }]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id={glowId} cx="50%" cy="48%" r="55%">
              <Stop offset="0" stopColor="#FFE3B0" stopOpacity={0.28} />
              <Stop offset="0.5" stopColor="#E7688A" stopOpacity={0.1} />
              <Stop offset="1" stopColor="#0C080B" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill={`url(#${glowId})`} />
        </Svg>
      </Animated.View>

      {/* şişe grubu */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: [{ translateX: A.tx }, { translateY: A.ty }, { scale: A.scale }] }}>
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: [{ translateY: A.wobY }, { rotate: A.wobR }] }}>
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: [{ rotate: A.rot }] }}>
            <BottleBack width={BL} style={{ opacity: A.bottleO, transform: [{ translateX: A.bottleX }] }} />
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, opacity: A.scrollO, transform: [{ translateX: A.scrollX }] }}>
              <Scroll length={Ls} thickness={D} paper={paper} ribbon={A.ribbon} />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, opacity: A.corkO, transform: [{ translateX: A.corkX }, { translateY: A.corkY }, { rotate: A.corkR }] }}>
              <Cork width={Lc} height={Hc} />
            </Animated.View>
            <BottleFront width={BL} style={{ opacity: A.bottleO, transform: [{ translateX: A.bottleX }, { scale: A.popSquash }] }} />
            <Sparkles at={lip} v={A.sparkle} />
          </Animated.View>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, opacity: A.water }}>
          <Ripples bl={BL} v={ripple} />
          <WaterPatch bl={BL} />
        </Animated.View>
      </Animated.View>

      <Wash W={W} y={shoreY} v={A.wash} />

      {/* rulo açılır → mektup */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: W / 2, top: H * 0.47, width: 0, height: 0, opacity: A.revealO, transform: [{ scale: A.revealScale }] }}>
        <Animated.View style={{ position: 'absolute', left: -PWr / 2, top: -PHr / 2, width: PWr, height: PHr, transform: [{ scaleY: A.paperScaleY }], borderRadius: 4, overflow: 'hidden', backgroundColor: P.bg }}>
          <PaperTexture paper={paper} radius={4} />
          <PaperLines paper={paper} width={PWr} height={PHr} />
          <View style={{ position: 'absolute', left: PAPER_PAD_X + 6, right: PAPER_PAD_X - 4, top: PAPER_TOP }}>
            {salutation ? <Text style={letterText(paper)}>{salutation}</Text> : null}
            {body ? (
              <Text style={letterText(paper)} numberOfLines={Math.max(1, Math.floor((PHr - PAPER_TOP - 60) / 30))}>
                {body}
              </Text>
            ) : null}
          </View>
          <LinearGradient colors={['rgba(0,0,0,.18)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.18)']} locations={[0, 0.12, 0.88, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {[A.rollTopY, A.rollBotY].map((y, i) => (
          <Animated.View key={i} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, opacity: A.rollO, transform: [{ translateY: y }, { scaleY: A.rollThick }] }}>
            <Scroll length={PWr} thickness={rollerD * 0.62} paper={paper} />
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 24, right: 24, top: insets.top + 30, alignItems: 'center', gap: 8, opacity: A.caption }}>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serifItalic, fontSize: 28, lineHeight: 32, color: colors.pearl, textAlign: 'center', textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 12 }}>
          Kıyıya bir şişe vurdu…
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 11.5, letterSpacing: 1.4, color: '#F6E6C4', textAlign: 'center' }}>
          {`${fromName.toLocaleUpperCase('tr-TR')} SANA YAZDI`}
        </Text>
      </Animated.View>
      <Skip onPress={finish} />
    </Animated.View>
  );
}
