import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { play } from '@/lib/sfx';
import { fonts } from '@/theme';
import { haptic, useReducedMotion } from './shared';

/**
 * Palyaço (Burası Neresi?): gradyanlarla gölgelendirilmiş, hafif 3B görünümlü kafa.
 * Koordinatlar 200×220 birim. `mood`: 'sly' (sinsi gülümseme, yarı kapalı gözler) · 'laugh' (kahkaha).
 * `jaw` verilirse ağız ayrı katmanda çizilir ve çene (scaleY) canlandırılabilir.
 */
export const CLOWN_VB_W = 200;
export const CLOWN_VB_H = 220;
const INK = '#3B1A2A';
export const CLOWN_RED = '#FF4D5E';
/** Ağzın menteşesi (üst dudak hizası) — çene bu çizgiden açılır */
const JAW_Y = 138;

function ClownDefs() {
  return (
    <>
      <RadialGradient id="cl-hair" cx="0.38" cy="0.32" r="0.72">
        <Stop offset="0" stopColor="#FFD27A" />
        <Stop offset="0.35" stopColor="#FF7A2E" />
        <Stop offset="0.75" stopColor="#E0263A" />
        <Stop offset="1" stopColor="#7A0B1E" />
      </RadialGradient>
      <RadialGradient id="cl-hair2" cx="0.38" cy="0.32" r="0.72">
        <Stop offset="0" stopColor="#FFB0D0" />
        <Stop offset="0.4" stopColor="#E7688A" />
        <Stop offset="1" stopColor="#6B1E38" />
      </RadialGradient>
      <RadialGradient id="cl-face" cx="0.42" cy="0.34" r="0.78">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.45" stopColor="#FFF3EA" />
        <Stop offset="0.78" stopColor="#F1D5C8" />
        <Stop offset="1" stopColor="#CF9C8C" />
      </RadialGradient>
      <RadialGradient id="cl-rim" cx="0.44" cy="0.4" r="0.62">
        <Stop offset="0.72" stopColor="#7A3B45" stopOpacity="0" />
        <Stop offset="1" stopColor="#7A3B45" stopOpacity="0.32" />
      </RadialGradient>
      <RadialGradient id="cl-nose" cx="0.36" cy="0.3" r="0.72">
        <Stop offset="0" stopColor="#FFB0B0" />
        <Stop offset="0.35" stopColor="#FF3048" />
        <Stop offset="0.8" stopColor="#B90E26" />
        <Stop offset="1" stopColor="#6E0616" />
      </RadialGradient>
      <RadialGradient id="cl-cheek" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#FF5C86" stopOpacity="0.75" />
        <Stop offset="1" stopColor="#FF5C86" stopOpacity="0" />
      </RadialGradient>
      <LinearGradient id="cl-paint" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#9CC4FF" />
        <Stop offset="1" stopColor="#4A5FD8" />
      </LinearGradient>
      <LinearGradient id="cl-hat" x1="0" y1="0" x2="1" y2="0.3">
        <Stop offset="0" stopColor="#C9B8F7" />
        <Stop offset="0.5" stopColor="#8E63F0" />
        <Stop offset="1" stopColor="#4B2A9E" />
      </LinearGradient>
      <RadialGradient id="cl-pom" cx="0.35" cy="0.3" r="0.75">
        <Stop offset="0" stopColor="#FFF8C8" />
        <Stop offset="0.5" stopColor="#FFC93C" />
        <Stop offset="1" stopColor="#C9780A" />
      </RadialGradient>
      <RadialGradient id="cl-mouth" cx="0.5" cy="0.3" r="0.8">
        <Stop offset="0" stopColor="#6A1426" />
        <Stop offset="1" stopColor="#23040C" />
      </RadialGradient>
      <RadialGradient id="cl-ruff" cx="0.4" cy="0.3" r="0.8">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.6" stopColor="#EDE3FA" />
        <Stop offset="1" stopColor="#A996D6" />
      </RadialGradient>
      <RadialGradient id="cl-ruff2" cx="0.4" cy="0.3" r="0.8">
        <Stop offset="0" stopColor="#FFE9A8" />
        <Stop offset="0.6" stopColor="#F2C27B" />
        <Stop offset="1" stopColor="#B07A2A" />
      </RadialGradient>
    </>
  );
}

const TUFTS: [number, number, number, 'a' | 'b'][] = [
  [58, 70, 17, 'b'],
  [44, 92, 23, 'a'],
  [34, 118, 21, 'a'],
  [46, 142, 19, 'b'],
];

/** Kafanın ağız dışındaki tüm katmanları */
const ClownBase = memo(function ClownBase({ mood, withMouth }: { mood: 'sly' | 'laugh'; withMouth: boolean }) {
  const laugh = mood === 'laugh';
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${CLOWN_VB_W} ${CLOWN_VB_H}`}>
      <Defs>
        <ClownDefs />
      </Defs>
      {/* yaka fırfırı */}
      {[34, 58, 82, 106, 130, 154].map((x, i) => (
        <G key={x}>
          <Circle cx={x + 6} cy={196 + (i % 2) * 3} r={17} fill="#000" fillOpacity={0.25} />
          <Circle cx={x + 6} cy={192 + (i % 2) * 3} r={16} fill={i % 2 ? 'url(#cl-ruff2)' : 'url(#cl-ruff)'} />
        </G>
      ))}
      {/* saç tutamları (iki yanda, arkada) */}
      {TUFTS.flatMap(([x, y, r, k]) => [
        <Circle key={`l${y}`} cx={x} cy={y} r={r} fill={k === 'a' ? 'url(#cl-hair)' : 'url(#cl-hair2)'} />,
        <Circle key={`r${y}`} cx={CLOWN_VB_W - x} cy={y} r={r} fill={k === 'a' ? 'url(#cl-hair)' : 'url(#cl-hair2)'} />,
      ])}
      {TUFTS.flatMap(([x, y, r]) => [
        <Ellipse key={`lh${y}`} cx={x - r * 0.3} cy={y - r * 0.4} rx={r * 0.32} ry={r * 0.2} fill="#FFFFFF" fillOpacity={0.35} />,
        <Ellipse key={`rh${y}`} cx={CLOWN_VB_W - x - r * 0.3} cy={y - r * 0.4} rx={r * 0.32} ry={r * 0.2} fill="#FFFFFF" fillOpacity={0.3} />,
      ])}
      {/* yüz: gölge + gövde + kenar karartması */}
      <Ellipse cx={103} cy={120} rx={57} ry={62} fill="#000" fillOpacity={0.22} />
      <Ellipse cx={100} cy={115} rx={57} ry={62} fill="url(#cl-face)" />
      <Ellipse cx={100} cy={115} rx={57} ry={62} fill="url(#cl-rim)" />
      <Ellipse cx={80} cy={80} rx={20} ry={11} fill="#FFFFFF" fillOpacity={0.55} transform="rotate(-24 80 80)" />
      {/* şapka (hafif yana yatık) */}
      <G transform="rotate(16 112 58)">
        <Ellipse cx={112} cy={60} rx={29} ry={6} fill="#000" fillOpacity={0.2} />
        <Path d="M84 60 L140 60 L112 4 Z" fill="url(#cl-hat)" />
        <Path d="M95 38 L129 38 L132.5 45 L91.5 45 Z" fill="#FFD66B" />
        <Path d="M104 20 L120 20 L123 26 L101 26 Z" fill="#FFD66B" />
        <Path d="M112 4 L100 45" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.5} strokeLinecap="round" />
        <Ellipse cx={112} cy={60} rx={29} ry={5} fill="#5B35B8" />
        <Circle cx={112} cy={5} r={8} fill="url(#cl-pom)" />
        <Circle cx={109} cy={2.5} r={2.4} fill="#FFFFFF" fillOpacity={0.8} />
      </G>
      {/* göz boyası (baklava) */}
      <Path d="M76 78 L83 98 L76 120 L69 98 Z" fill="url(#cl-paint)" opacity={0.9} />
      <Path d="M124 78 L131 98 L124 120 L117 98 Z" fill="url(#cl-paint)" opacity={0.9} />
      {laugh ? (
        <G>
          {/* kahkaha: kapalı, kıvrık gözler + gülme yaşları */}
          <Path d="M64 102 Q76 86 88 102" stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
          <Path d="M112 102 Q124 86 136 102" stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
          <Path d="M58 106 Q54 116 58 120 Q63 116 58 106 Z" fill="#8FD3FF" />
          <Path d="M142 106 Q138 116 142 120 Q147 116 142 106 Z" fill="#8FD3FF" />
          <Path d="M58 76 Q70 64 86 74" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M114 74 Q130 64 142 76" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
        </G>
      ) : (
        <G>
          {/* sinsi: kaşlardan biri kalkık, göz kapakları yarı kapalı, bebekler yana bakıyor */}
          <Path d="M58 82 Q70 72 86 80" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d="M114 72 Q130 58 144 72" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Ellipse cx={76} cy={99} rx={9.5} ry={11} fill="#FFFFFF" stroke={INK} strokeWidth={1.6} />
          <Ellipse cx={124} cy={99} rx={9.5} ry={11} fill="#FFFFFF" stroke={INK} strokeWidth={1.6} />
          <Circle cx={80} cy={102} r={5.2} fill="#1E0E18" />
          <Circle cx={128} cy={102} r={5.2} fill="#1E0E18" />
          <Circle cx={78.3} cy={100.2} r={1.8} fill="#FFFFFF" />
          <Circle cx={126.3} cy={100.2} r={1.8} fill="#FFFFFF" />
          <Path d="M66.2 98 A9.8 11 0 0 1 85.8 98 Z" fill="#F6DED3" stroke={INK} strokeWidth={1.8} />
          <Path d="M114.2 96 A9.8 11 0 0 1 133.8 96 Z" fill="#F6DED3" stroke={INK} strokeWidth={1.8} />
        </G>
      )}
      {/* yanaklar */}
      <Circle cx={62} cy={128} r={14} fill="url(#cl-cheek)" />
      <Circle cx={138} cy={128} r={14} fill="url(#cl-cheek)" />
      {withMouth ? <ClownMouthShapes mood={mood} /> : null}
      {/* burun: gölge + küre + parlama */}
      <Ellipse cx={103} cy={130} rx={15} ry={5} fill="#7A3B45" fillOpacity={0.28} />
      <Circle cx={100} cy={114} r={16.5} fill="url(#cl-nose)" />
      <Ellipse cx={94} cy={107} rx={5.5} ry={3.6} fill="#FFFFFF" fillOpacity={0.85} transform="rotate(-32 94 107)" />
      <Path d="M108 124 Q114 119 115 112" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
});

function ClownMouthShapes({ mood }: { mood: 'sly' | 'laugh' }) {
  if (mood === 'laugh') {
    return (
      <G>
        <Path d="M56 136 Q100 128 144 136 Q140 196 100 198 Q60 196 56 136 Z" fill="#FFFFFF" />
        <Path d="M64 139 Q100 134 136 139 Q131 186 100 188 Q69 186 64 139 Z" fill="url(#cl-mouth)" stroke="#D81E36" strokeWidth={5} strokeLinejoin="round" />
        <Path d="M71 142 Q100 138 129 142 L127 151 Q100 154 73 151 Z" fill="#FFFFFF" />
        <Ellipse cx={100} cy={175} rx={19} ry={9} fill="#FF6F86" />
        <Path d="M100 168 L100 180" stroke="#C7405A" strokeWidth={1.5} strokeLinecap="round" />
      </G>
    );
  }
  return (
    <G>
      {/* çarpık, sinsi gülümseme (sağ köşe yukarıda) */}
      <Path d="M50 136 Q98 196 150 128 Q140 150 100 162 Q62 158 50 136 Z" fill="#FFFFFF" />
      <Path d="M60 141 Q100 180 141 133 Q124 158 100 162 Q76 160 60 141 Z" fill="#E0203A" />
      <Path d="M64 143 Q100 170 137 136" stroke="#5A0E1E" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M137 136 L143 131" stroke="#5A0E1E" strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx={86} cy={160} rx={8} ry={2.2} fill="#FFFFFF" fillOpacity={0.5} transform="rotate(12 86 160)" />
    </G>
  );
}

const ClownMouth = memo(function ClownMouth({ mood }: { mood: 'sly' | 'laugh' }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${CLOWN_VB_W} ${CLOWN_VB_H}`}>
      <Defs>
        <ClownDefs />
      </Defs>
      <ClownMouthShapes mood={mood} />
    </Svg>
  );
});

/** Palyaço kafası. `jaw` (Animated, ~0.5–1.15) verilirse ağız menteşeden açılıp kapanır. */
export function ClownHead({ size, mood = 'sly', jaw }: { size: number; mood?: 'sly' | 'laugh'; jaw?: Animated.Value | Animated.AnimatedInterpolation<number> }) {
  const w = size;
  const h = (size * CLOWN_VB_H) / CLOWN_VB_W;
  const hinge = (JAW_Y / CLOWN_VB_H) * h - h / 2;
  return (
    <View style={{ width: w, height: h }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ClownBase mood={mood} withMouth={!jaw} />
      {jaw ? (
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, transform: [{ translateY: hinge }, { scaleY: jaw }, { translateY: -hinge }] }}>
          <ClownMouth mood={mood} />
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Ekran kenarından "cee!" yapan palyaço + konuşma balonu
// ─────────────────────────────────────────────────────────────
export type ClownVisit = { key: number; text: string; side: 'left' | 'right' };

/**
 * Palyaço kenardan kafasını uzatır, sallanır ve bir şaşırtmaca önerir.
 * "Kabul et" → onAccept(text) · "Görmezden gel" / zaman aşımı → onDismiss.
 * `bottom`: ekranın altından uzaklık (alt butonların üstünde dursun diye).
 */
export function PeekingClown({ visit, bottom, onAccept, onDismiss, busy }: { visit: ClownVisit | null; bottom: number; onAccept: (text: string) => void; onDismiss: () => void; busy?: boolean }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<ClownVisit | null>(visit);
  if (visit && visit.key !== shown?.key) setShown(visit);

  const [a] = useState(() => ({ slide: new Animated.Value(0), bubble: new Animated.Value(0), wobble: new Animated.Value(0), bob: new Animated.Value(0) }));
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  const key = visit?.key ?? null;
  useEffect(() => {
    if (key == null) return;
    a.slide.setValue(0);
    a.bubble.setValue(0);
    play('clown_pop', { volume: 0.8 });
    haptic.light();
    const inAnim = Animated.sequence([
      Animated.spring(a.slide, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.spring(a.bubble, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
    ]);
    inAnim.start();
    const loops = reduced
      ? []
      : [
          Animated.loop(
            Animated.sequence([
              Animated.timing(a.wobble, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(a.wobble, { toValue: -1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ]),
          ),
          Animated.loop(
            Animated.sequence([
              Animated.delay(1400),
              // sinsi "cee": geri çekilip tekrar uzanır
              Animated.timing(a.bob, { toValue: 1, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
              Animated.spring(a.bob, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
            ]),
          ),
        ];
    loops.forEach((l) => l.start());
    // Görmezden gelinirse bir süre sonra kendiliğinden kaybolur
    const t = setTimeout(() => dismissRef.current(), 11000);
    return () => {
      clearTimeout(t);
      inAnim.stop();
      loops.forEach((l) => l.stop());
    };
  }, [key, a, reduced]);

  // Kapanış: kenara geri kayar
  useEffect(() => {
    if (key != null || !shown) return;
    Animated.parallel([
      Animated.timing(a.bubble, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(a.slide, { toValue: 0, duration: 320, easing: Easing.in(Easing.back(1.4)), useNativeDriver: true }),
    ]).start(({ finished }) => finished && setShown(null));
  }, [key, shown, a]);

  if (!shown) return null;
  const right = shown.side === 'right';
  const head = Math.min(128, Math.max(104, width * 0.3));
  const headH = (head * CLOWN_VB_H) / CLOWN_VB_W;
  const peek = head * 0.34; // ekran dışında kalan kısım
  const bubbleW = Math.min(284, width - insets.left - insets.right - (head - peek) - 24);
  const dir = right ? 1 : -1;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom, height: headH + 150, pointerEvents: 'box-none' }}>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          [right ? 'right' : 'left']: -peek,
          width: head,
          height: headH,
          pointerEvents: 'none',
          transform: [
            { translateX: a.slide.interpolate({ inputRange: [0, 1], outputRange: [dir * head * 1.1, 0] }) },
            { translateX: a.bob.interpolate({ inputRange: [0, 1], outputRange: [0, dir * head * 0.3] }) },
            { rotate: a.wobble.interpolate({ inputRange: [-1, 1], outputRange: [right ? '-24deg' : '10deg', right ? '-10deg' : '24deg'] }) },
          ],
        }}
      >
        <ClownHead size={head} mood="sly" />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: headH * 0.62,
          [right ? 'right' : 'left']: head - peek - 6 + insets.right * (right ? 1 : 0),
          width: bubbleW,
          opacity: a.bubble,
          transform: [
            { translateX: dir * bubbleW * 0.5 },
            { translateY: 40 },
            { scale: a.bubble.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { translateY: -40 },
            { translateX: -dir * bubbleW * 0.5 },
          ],
        }}
      >
        <View style={{ borderRadius: 22, padding: 14, gap: 10, backgroundColor: '#FFF8F1', borderWidth: 2, borderColor: '#FF4D5E', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: '#2A0E18' }}>
            {'Bence burası kesin '}
            <Text style={{ fontFamily: fonts.extrabold, color: '#D81E36' }}>{shown.text}</Text>
            {' 🤡'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Palyaçonun önerisini kabul et: ${shown.text}`}
              disabled={busy || key == null}
              onPress={() => {
                haptic.tap();
                onAccept(shown.text);
              }}
              style={({ pressed }) => ({ flex: 1, minHeight: 44, borderRadius: 999, backgroundColor: CLOWN_RED, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}
            >
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extrabold, fontSize: 14, color: '#FFFFFF' }}>Kabul et</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Palyaçoyu görmezden gel"
              disabled={key == null}
              onPress={() => {
                haptic.tap();
                onDismiss();
              }}
              style={({ pressed }) => ({ flex: 1.4, minHeight: 44, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(42,14,24,.25)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, opacity: pressed ? 0.7 : 1 })}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: 14, color: '#2A0E18' }}>Görmezden gel</Text>
            </Pressable>
          </View>
        </View>
        {/* balon kuyruğu palyaçoya bakar */}
        <View style={{ position: 'absolute', bottom: -9, [right ? 'right' : 'left']: 26, width: 20, height: 20, backgroundColor: '#FFF8F1', borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#FF4D5E', transform: [{ rotate: '45deg' }] }} />
      </Animated.View>
    </View>
  );
}

/** Küçük yuvarlak palyaço rozeti (başlıklar, şaşırtmaca alanı) */
export function ClownBadge({ size = 34 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,77,94,.14)', borderWidth: 1, borderColor: 'rgba(255,77,94,.35)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View style={{ marginTop: size * 0.12 }}>
        <ClownHead size={size * 0.95} />
      </View>
    </View>
  );
}
