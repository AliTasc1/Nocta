import React, { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

/**
 * Shot Ruleti tepsisi: parlak siyah yuvarlak tepsi, kenarda 1–16 numaralı shot bardakları
 * (tek = kırmızı, çift = siyah), ortada altın kuleli rulet çarkı ve beyaz top.
 *
 * Koordinatlar 400×400 birim; merkez (200,200). Bardak n, saat yönünde (n−1)·22.5° açısında.
 * Çark cepleri WHEEL_ORDER sırasıyla dizilir (renkler dönüşümlü); cep i'nin yerel açısı i·22.5°.
 * Top, çark dönüşü + göreli açı ile konumlanır: göreli açı = cebin açısı olduğunda top o cepte durur.
 */
export const TRAY = 400;
const C = 200;
export const GLASS_RING = 160;
export const GLASS_R = 21;
const BOWL_R = 122;
const TRACK_OUT = 118;
const TRACK_IN = 103;
export const BALL_TRACK = 110.5;
export const BALL_POCKET = 79;
const BAND_OUT = 100;
const BAND_IN = 87;
const CONE_R = 70;

export const WHEEL_ORDER = [1, 12, 5, 16, 9, 4, 13, 8, 3, 14, 7, 2, 11, 6, 15, 10];
export const pocketAngle = (n: number) => WHEEL_ORDER.indexOf(n) * 22.5;
export const glassAngle = (n: number) => (n - 1) * 22.5;
export const isRed = (n: number) => n % 2 === 1;

export function polar(r: number, deg: number, cx = C, cy = C): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}
const f = (n: number) => Math.round(n * 100) / 100;

function wedge(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = polar(r2, a1);
  const [x2, y2] = polar(r2, a2);
  const [x3, y3] = polar(r1, a2);
  const [x4, y4] = polar(r1, a1);
  return `M${f(x1)} ${f(y1)}A${r2} ${r2} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r1} ${r1} 0 0 0 ${f(x4)} ${f(y4)}Z`;
}

// ─────────────────────────────────────────────────────────────
// Tek bardak (tepside ve büyütülmüş "kahraman" bardakta ortak)
// ─────────────────────────────────────────────────────────────
export function GlassDefs() {
  return (
    <>
      <RadialGradient id="gl-red" cx="0.38" cy="0.34" r="0.75">
        <Stop offset="0" stopColor="#FF7086" />
        <Stop offset="0.45" stopColor="#D0142F" />
        <Stop offset="1" stopColor="#5E0615" />
      </RadialGradient>
      <RadialGradient id="gl-black" cx="0.38" cy="0.34" r="0.75">
        <Stop offset="0" stopColor="#6A6470" />
        <Stop offset="0.45" stopColor="#2A262E" />
        <Stop offset="1" stopColor="#0A090C" />
      </RadialGradient>
      <RadialGradient id="gl-body" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity="0.03" />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.2" />
      </RadialGradient>
      <RadialGradient id="gl-shadow" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0.5" stopColor="#000" stopOpacity="0.75" />
        <Stop offset="1" stopColor="#000" stopOpacity="0" />
      </RadialGradient>
    </>
  );
}

/** Bardak: gölge + cam gövde (alt duvar görünür) + sıvı + menisküs + parlama + numara */
function GlassShape({ n, x, y, empty = false, numberSize = 13 }: { n: number; x: number; y: number; empty?: boolean; numberSize?: number }) {
  const red = isRed(n);
  return (
    <G>
      <Circle cx={x + 2} cy={y + 5} r={GLASS_R + 3} fill="url(#gl-shadow)" />
      {/* cam duvarın alt kısmı (derinlik) */}
      <Circle cx={x} cy={y + 3.2} r={GLASS_R} fill="#FFFFFF" fillOpacity={0.08} stroke="#FFFFFF" strokeOpacity={0.22} strokeWidth={1} />
      <Circle cx={x} cy={y} r={GLASS_R} fill="#0B0B0E" />
      <Circle cx={x} cy={y} r={GLASS_R} fill="url(#gl-body)" />
      {!empty ? (
        <G>
          <Circle cx={x} cy={y + 1} r={GLASS_R - 4.5} fill={red ? 'url(#gl-red)' : 'url(#gl-black)'} />
          <Circle cx={x} cy={y + 1} r={GLASS_R - 4.5} fill="none" stroke="#FFFFFF" strokeOpacity={red ? 0.4 : 0.22} strokeWidth={1} />
          <Ellipse cx={x - 5} cy={y - 4} rx={5} ry={3} fill="#FFFFFF" fillOpacity={red ? 0.28 : 0.16} transform={`rotate(-35 ${x - 5} ${y - 4})`} />
        </G>
      ) : (
        <Circle cx={x} cy={y + 1} r={GLASS_R - 4.5} fill="#16151A" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={1} />
      )}
      {/* ağız kenarı */}
      <Circle cx={x} cy={y} r={GLASS_R} fill="none" stroke="#FFFFFF" strokeOpacity={0.62} strokeWidth={1.3} />
      <Circle cx={x} cy={y} r={GLASS_R - 2.2} fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1.4} />
      <Path d={`M${f(x - GLASS_R * 0.78)} ${f(y - GLASS_R * 0.45)} A ${GLASS_R - 1} ${GLASS_R - 1} 0 0 1 ${f(x + GLASS_R * 0.2)} ${f(y - GLASS_R * 0.93)}`} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <SvgText x={x + 0.6} y={y + numberSize * 0.36 + 1.6} fontSize={numberSize} fontWeight="800" fill="#000" fillOpacity={0.55} textAnchor="middle">
        {n}
      </SvgText>
      <SvgText x={x} y={y + numberSize * 0.36 + 1} fontSize={numberSize} fontWeight="800" fill="#FFFFFF" textAnchor="middle">
        {n}
      </SvgText>
    </G>
  );
}

// ─────────────────────────────────────────────────────────────
// Statik tepsi + bardaklar + çark kasesi
// ─────────────────────────────────────────────────────────────
const TrayBase = memo(function TrayBase({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${TRAY} ${TRAY}`}>
      <Defs>
        <GlassDefs />
        <RadialGradient id="tr-base" cx="170" cy="130" r="260" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#2E2D33" />
          <Stop offset="0.45" stopColor="#141417" />
          <Stop offset="1" stopColor="#050506" />
        </RadialGradient>
        <LinearGradient id="tr-rim" x1="60" y1="20" x2="340" y2="380" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.08" />
          <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity="0.03" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.22" />
        </LinearGradient>
        <RadialGradient id="tr-well" cx="200" cy="200" r="190" gradientUnits="userSpaceOnUse">
          <Stop offset="0.6" stopColor="#0B0B0D" />
          <Stop offset="0.93" stopColor="#101013" />
          <Stop offset="1" stopColor="#1C1C21" />
        </RadialGradient>
        <RadialGradient id="tr-bowl" cx="200" cy="200" r={BOWL_R} gradientUnits="userSpaceOnUse">
          <Stop offset="0.8" stopColor="#0A0A0C" />
          <Stop offset="0.95" stopColor="#1B1B20" />
          <Stop offset="1" stopColor="#060607" />
        </RadialGradient>
        <LinearGradient id="tr-gold" x1="90" y1="90" x2="310" y2="310" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#F8E3A0" />
          <Stop offset="0.35" stopColor="#C9973A" />
          <Stop offset="0.7" stopColor="#7A5214" />
          <Stop offset="1" stopColor="#E3BF6A" />
        </LinearGradient>
        <LinearGradient id="tr-track" x1="110" y1="80" x2="290" y2="320" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#3A2A1E" />
          <Stop offset="0.5" stopColor="#1A120C" />
          <Stop offset="1" stopColor="#0C0806" />
        </LinearGradient>
      </Defs>
      {/* tepsi gölgesi + gövde */}
      <Circle cx={C} cy={C + 4} r={198} fill="#000" fillOpacity={0.6} />
      <Circle cx={C} cy={C} r={197} fill="url(#tr-base)" />
      <Circle cx={C} cy={C} r={196} fill="none" stroke="url(#tr-rim)" strokeWidth={2.5} />
      <Circle cx={C} cy={C} r={188} fill="url(#tr-well)" />
      <Circle cx={C} cy={C} r={188} fill="none" stroke="#000" strokeOpacity={0.8} strokeWidth={2} />
      <Circle cx={C} cy={C} r={189.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={1} />
      {/* bardak yuvaları */}
      {Array.from({ length: 16 }).map((_, i) => {
        const [x, y] = polar(GLASS_RING, i * 22.5);
        return <Circle key={`s${i}`} cx={x} cy={y} r={GLASS_R + 3.5} fill="#050506" stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={1} />;
      })}
      {/* çark kasesi (altın halka + parke pisti) */}
      <Circle cx={C} cy={C + 3} r={BOWL_R + 6} fill="#000" fillOpacity={0.55} />
      <Circle cx={C} cy={C} r={BOWL_R + 4} fill="url(#tr-gold)" />
      <Circle cx={C} cy={C} r={BOWL_R + 1.2} fill="url(#tr-bowl)" />
      <Circle cx={C} cy={C} r={TRACK_OUT} fill="url(#tr-track)" />
      <Circle cx={C} cy={C} r={TRACK_OUT} fill="none" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={1} />
      <Circle cx={C} cy={C} r={TRACK_IN + 1} fill="#050505" />
      {/* saptırıcı elmaslar */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = i * 45 + 11.25;
        const [x, y] = polar(113, a);
        return <Path key={`d${i}`} d="M0 -4.5 L2.2 0 L0 4.5 L-2.2 0 Z" fill="url(#tr-gold)" transform={`translate(${f(x)} ${f(y)}) rotate(${a})`} />;
      })}
      {/* bardaklar */}
      {Array.from({ length: 16 }).map((_, i) => {
        const [x, y] = polar(GLASS_RING, i * 22.5);
        return <GlassShape key={i} n={i + 1} x={x} y={y} />;
      })}
    </Svg>
  );
});

/** Dönen çark: numaralı cepler, altın ayraçlar, koni ve kule */
const Wheel = memo(function Wheel({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${TRAY} ${TRAY}`}>
      <Defs>
        <LinearGradient id="wh-red" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E3223F" />
          <Stop offset="1" stopColor="#8C0B1F" />
        </LinearGradient>
        <LinearGradient id="wh-black" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2B2A30" />
          <Stop offset="1" stopColor="#0B0B0D" />
        </LinearGradient>
        <RadialGradient id="wh-cone" cx="200" cy="200" r={CONE_R} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#3A2414" />
          <Stop offset="0.65" stopColor="#1E120A" />
          <Stop offset="1" stopColor="#0B0705" />
        </RadialGradient>
        <RadialGradient id="wh-pocket" cx="200" cy="200" r={BAND_IN} gradientUnits="userSpaceOnUse">
          <Stop offset="0.8" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </RadialGradient>
        <LinearGradient id="wh-gold" x1="150" y1="150" x2="250" y2="250" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFF0B8" />
          <Stop offset="0.4" stopColor="#D9A843" />
          <Stop offset="0.75" stopColor="#8A5E18" />
          <Stop offset="1" stopColor="#F0CD74" />
        </LinearGradient>
        <RadialGradient id="wh-cap" cx="0.38" cy="0.32" r="0.8">
          <Stop offset="0" stopColor="#FFF6D0" />
          <Stop offset="0.45" stopColor="#E0B04E" />
          <Stop offset="1" stopColor="#6E4810" />
        </RadialGradient>
      </Defs>
      {/* numara bandı + cepler */}
      {WHEEL_ORDER.map((n, i) => {
        const a1 = i * 22.5 - 11.25;
        const a2 = i * 22.5 + 11.25;
        const fill = isRed(n) ? 'url(#wh-red)' : 'url(#wh-black)';
        const [tx, ty] = polar((BAND_OUT + BAND_IN) / 2, i * 22.5);
        return (
          <G key={n}>
            <Path d={wedge(BAND_IN, BAND_OUT, a1, a2)} fill={fill} />
            <Path d={wedge(CONE_R, BAND_IN, a1, a2)} fill={fill} opacity={0.82} />
            <SvgText x={tx} y={ty + 3.6} fontSize={10.5} fontWeight="800" fill="#FFFFFF" textAnchor="middle" transform={`rotate(${i * 22.5} ${f(tx)} ${f(ty)})`}>
              {n}
            </SvgText>
          </G>
        );
      })}
      <Circle cx={C} cy={C} r={BAND_IN} fill="url(#wh-pocket)" />
      {/* ayraçlar (altın) */}
      {WHEEL_ORDER.map((_, i) => {
        const a = i * 22.5 + 11.25;
        const [x1, y1] = polar(CONE_R, a);
        const [x2, y2] = polar(BAND_OUT, a);
        return <Line key={`fr${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E8C372" strokeWidth={1.4} />;
      })}
      <Circle cx={C} cy={C} r={BAND_IN} fill="none" stroke="#E8C372" strokeWidth={1.4} />
      <Circle cx={C} cy={C} r={BAND_OUT} fill="none" stroke="#E8C372" strokeWidth={1.6} />
      {/* koni */}
      <Circle cx={C} cy={C} r={CONE_R} fill="url(#wh-cone)" />
      <Circle cx={C} cy={C} r={CONE_R} fill="none" stroke="#E8C372" strokeOpacity={0.9} strokeWidth={1.6} />
      {Array.from({ length: 8 }).map((_, i) => {
        const [x1, y1] = polar(26, i * 45);
        const [x2, y2] = polar(CONE_R - 3, i * 45);
        return <Line key={`cn${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={6} />;
      })}
      {/* kule: dört kollu altın merkez */}
      <Circle cx={C} cy={C + 2} r={22} fill="#000" fillOpacity={0.5} />
      {[0, 90, 180, 270].map((a) => {
        const [x, y] = polar(44, a);
        return (
          <G key={a}>
            <Path d={`M${C - 3.2} ${C} L${C + 3.2} ${C} L${C + 1.8} ${C - 42} L${C - 1.8} ${C - 42} Z`} fill="url(#wh-gold)" transform={`rotate(${a} ${C} ${C})`} />
            <Circle cx={x} cy={y} r={5.4} fill="url(#wh-cap)" />
            <Circle cx={x} cy={y} r={5.4} fill="none" stroke="#5A3A0A" strokeOpacity={0.6} strokeWidth={0.8} />
          </G>
        );
      })}
      <Circle cx={C} cy={C} r={17} fill="url(#wh-gold)" />
      <Circle cx={C} cy={C} r={11} fill="url(#wh-cap)" />
      <Circle cx={C} cy={C} r={11} fill="none" stroke="#5A3A0A" strokeOpacity={0.5} strokeWidth={0.8} />
      <Circle cx={C - 3.5} cy={C - 4} r={3} fill="#FFFFFF" fillOpacity={0.7} />
    </Svg>
  );
});

/** Sabit parlama: çark dönse de ışık yerinde */
const WheelGloss = memo(function WheelGloss({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${TRAY} ${TRAY}`}>
      <Defs>
        <RadialGradient id="wg" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="wg-shade" x1="130" y1="120" x2="290" y2="300" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </LinearGradient>
      </Defs>
      <Circle cx={C} cy={C} r={BAND_OUT} fill="url(#wg-shade)" />
      <Ellipse cx={165} cy={150} rx={110} ry={80} fill="url(#wg)" />
      <Path d={`M${f(polar(TRACK_OUT - 2, -70)[0])} ${f(polar(TRACK_OUT - 2, -70)[1])} A ${TRACK_OUT - 2} ${TRACK_OUT - 2} 0 0 1 ${f(polar(TRACK_OUT - 2, 10)[0])} ${f(polar(TRACK_OUT - 2, 10)[1])}`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
});

const Ball = memo(function Ball({ d }: { d: number }) {
  return (
    <Svg width={d} height={d} viewBox="0 0 20 20">
      <Defs>
        <RadialGradient id="ball" cx="0.36" cy="0.32" r="0.75">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.55" stopColor="#E9E6E2" />
          <Stop offset="1" stopColor="#8D8984" />
        </RadialGradient>
      </Defs>
      <Circle cx={11} cy={12} r={7.5} fill="#000" fillOpacity={0.45} />
      <Circle cx={10} cy={10} r={7.5} fill="url(#ball)" />
    </Svg>
  );
});

/** Seçili aralığın bardaklarını çevreleyen altın vurgu (sürüklerken hafif; yeniden çizimi ucuz) */
const RangeGlow = memo(function RangeGlow({ size, start, tone }: { size: number; start: number | null; tone: 'gold' | 'dim' }) {
  if (start == null) return null;
  const a1 = glassAngle(start) - 11.25 + 1.5;
  const a2 = glassAngle(start + 3) + 11.25 - 1.5;
  const [x1, y1] = polar(GLASS_RING, a1);
  const [x2, y2] = polar(GLASS_RING, a2);
  const col = tone === 'gold' ? '#F2C27B' : '#C9B8F7';
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${TRAY} ${TRAY}`}>
      <Path d={`M${f(x1)} ${f(y1)} A ${GLASS_RING} ${GLASS_RING} 0 0 1 ${f(x2)} ${f(y2)}`} stroke={col} strokeOpacity={0.14} strokeWidth={54} strokeLinecap="round" fill="none" />
      {[0, 1, 2, 3].map((k) => {
        const [x, y] = polar(GLASS_RING, glassAngle(start + k));
        return (
          <G key={k}>
            <Circle cx={x} cy={y} r={GLASS_R + 6} fill="none" stroke={col} strokeOpacity={0.25} strokeWidth={5} />
            <Circle cx={x} cy={y} r={GLASS_R + 3.2} fill="none" stroke={col} strokeOpacity={0.95} strokeWidth={1.8} />
          </G>
        );
      })}
    </Svg>
  );
});

export type TrayAnims = {
  wheel: Animated.Value;
  rel: Animated.Value;
  drop: Animated.Value;
};

/** Tepsi + çark + top. Sonuç bardağının animasyonu (HeroGlass) üst bileşende çizilir. */
export function ShotsTray({ size, a, range, rangeTone = 'gold', children }: { size: number; a: TrayAnims; range: number | null; rangeTone?: 'gold' | 'dim'; children?: React.ReactNode }) {
  const k = size / TRAY;
  const wheelRot = a.wheel.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const ballRot = Animated.add(a.wheel, a.rel).interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const bd = 15 * k;
  return (
    <View style={{ width: size, height: size }}>
      <View style={StyleSheet.absoluteFill}>
        <TrayBase size={size} />
      </View>
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <RangeGlow size={size} start={range} tone={rangeTone} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: wheelRot }] }, { pointerEvents: 'none' }]}>
        <Wheel size={size} />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <WheelGloss size={size} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: ballRot }] }, { pointerEvents: 'none' }]}>
        <Animated.View
          style={{
            position: 'absolute',
            left: size / 2 - bd / 2,
            top: size / 2 - bd / 2,
            width: bd,
            height: bd,
            transform: [{ translateY: a.drop.interpolate({ inputRange: [0, 1], outputRange: [-BALL_TRACK * k, -BALL_POCKET * k] }) }],
          }}
        >
          <Ball d={bd} />
        </Animated.View>
      </Animated.View>
      {children}
    </View>
  );
}

/** Tek bardak çizimi (kahraman bardak katmanları için) */
export function GlassArt({ n, size, part }: { n: number; size: number; part: 'body' | 'liquid' | 'rim' }) {
  const vb = GLASS_R * 2 + 12;
  const cx = vb / 2;
  const red = isRed(n);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}>
      <Defs>
        <GlassDefs />
      </Defs>
      {part === 'body' ? (
        <G>
          <Circle cx={cx} cy={cx + 3.2} r={GLASS_R} fill="#FFFFFF" fillOpacity={0.1} stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={1} />
          <Circle cx={cx} cy={cx} r={GLASS_R} fill="#0D0C10" />
          <Circle cx={cx} cy={cx} r={GLASS_R} fill="url(#gl-body)" />
          <Circle cx={cx} cy={cx + 1} r={GLASS_R - 4.5} fill="#1A191F" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={1} />
        </G>
      ) : part === 'liquid' ? (
        <G>
          <Circle cx={cx} cy={cx + 1} r={GLASS_R - 4.5} fill={red ? 'url(#gl-red)' : 'url(#gl-black)'} />
          <Circle cx={cx} cy={cx + 1} r={GLASS_R - 4.5} fill="none" stroke="#FFFFFF" strokeOpacity={red ? 0.4 : 0.22} strokeWidth={1} />
          <Ellipse cx={cx - 5} cy={cx - 4} rx={5} ry={3} fill="#FFFFFF" fillOpacity={red ? 0.28 : 0.16} transform={`rotate(-35 ${cx - 5} ${cx - 4})`} />
        </G>
      ) : (
        <G>
          <Circle cx={cx} cy={cx} r={GLASS_R} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.3} />
          <Circle cx={cx} cy={cx} r={GLASS_R - 2.2} fill="none" stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1.4} />
          <Path d={`M${f(cx - GLASS_R * 0.78)} ${f(cx - GLASS_R * 0.45)} A ${GLASS_R - 1} ${GLASS_R - 1} 0 0 1 ${f(cx + GLASS_R * 0.2)} ${f(cx - GLASS_R * 0.93)}`} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <SvgText x={cx + 0.6} y={cx + 13 * 0.36 + 1.6} fontSize={13} fontWeight="800" fill="#000" fillOpacity={0.55} textAnchor="middle">
            {n}
          </SvgText>
          <SvgText x={cx} y={cx + 13 * 0.36 + 1} fontSize={13} fontWeight="800" fill="#FFFFFF" textAnchor="middle">
            {n}
          </SvgText>
        </G>
      )}
    </Svg>
  );
}
export const GLASS_VB = GLASS_R * 2 + 12;

/** Küçük bardak simgesi (skor tablosu, renk rozeti) */
export function MiniGlass({ red, size = 22 }: { red: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={13.5} r={10} fill="#FFFFFF" fillOpacity={0.1} />
      <Circle cx={12} cy={12} r={10} fill="#0D0C10" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.2} />
      <Circle cx={12} cy={12.6} r={7} fill={red ? '#D0142F' : '#2E2A33'} />
      <Ellipse cx={9.6} cy={10} rx={2.6} ry={1.5} fill="#FFFFFF" fillOpacity={0.35} transform="rotate(-35 9.6 10)" />
    </Svg>
  );
}
