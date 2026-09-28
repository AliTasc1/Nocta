import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, Rect, Stop } from 'react-native-svg';

import { PAPERS, type Paper } from '@/lib/letters';
import { useSvgId } from './Paper';

/**
 * Yatay cam şişe (boyun solda). SVG görünüm kutusu 300×110; merkez (150,55) yerel orijindir.
 *  - BottleBack: camın arka yüzü (kâğıdın ARKASINDA)
 *  - BottleFront: renk tonu, kalın cam kenarları, parlamalar (kâğıdın ÖNÜNDE → kâğıt camın içinden görünür)
 */
export const VB_W = 300;
export const VB_H = 110;
/** Şişe gövdesinin görünüm kutusundaki x aralığı ve ağız */
export const BODY_X0 = 100;
export const BODY_X1 = 296;
export const LIP_X = 4;
export const NECK_R = 15;

export const BOTTLE_PATH =
  'M8 37 L16 37 Q18 37 18 40 L62 40 C84 40 88 9 118 9 L280 9 Q296 9 296 25 L296 85 Q296 101 280 101 L118 101 C88 101 84 70 62 70 L18 70 Q18 73 16 73 L8 73 Q4 73 4 69 L4 41 Q4 37 8 37 Z';
const NECK_PATH = 'M18 40 L62 40 C70 40 76 44 80 48 L80 62 C76 66 70 70 62 70 L18 70 Z';

type Sized = { width: number; style?: StyleProp<ViewStyle> };

function box(width: number): ViewStyle {
  const h = (width * VB_H) / VB_W;
  return { position: 'absolute', left: -width / 2, top: -h / 2, width, height: h };
}

export function BottleBack({ width, style }: Sized) {
  const g = useSvgId('bb');
  return (
    <Animated.View pointerEvents="none" style={[box(width), style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <SvgLinear id={g} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E4A42" stopOpacity={0.5} />
            <Stop offset="0.45" stopColor="#3F7F70" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#0E302A" stopOpacity={0.6} />
          </SvgLinear>
        </Defs>
        <Path d={BOTTLE_PATH} fill={`url(#${g})`} />
        {/* arka duvardaki kırılma yansıması */}
        <Path d="M128 80 C170 86 230 86 282 78" stroke="#A8F0DA" strokeOpacity={0.12} strokeWidth={5} fill="none" strokeLinecap="round" />
        <Path d="M132 30 C180 26 240 26 284 31" stroke="#0A2420" strokeOpacity={0.35} strokeWidth={4} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

export function BottleFront({ width, style, glints }: Sized & { glints?: Animated.AnimatedInterpolation<number>[] }) {
  const tint = useSvgId('bt');
  const neck = useSvgId('bn');
  const hl = useSvgId('bh');
  const clip = useSvgId('bc');
  const band = useSvgId('bg');
  return (
    <Animated.View pointerEvents="none" style={[box(width), style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          {/* silindir: kenarlarda kalın, koyu cam; ortada ince, açık */}
          <SvgLinear id={tint} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B3029" stopOpacity={0.78} />
            <Stop offset="0.12" stopColor="#2F7564" stopOpacity={0.34} />
            <Stop offset="0.3" stopColor="#6FC0A6" stopOpacity={0.12} />
            <Stop offset="0.62" stopColor="#5AAE95" stopOpacity={0.16} />
            <Stop offset="0.86" stopColor="#276656" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#072520" stopOpacity={0.85} />
          </SvgLinear>
          <SvgLinear id={neck} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B3029" stopOpacity={0.85} />
            <Stop offset="0.3" stopColor="#57A993" stopOpacity={0.2} />
            <Stop offset="0.7" stopColor="#3F8C78" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#072520" stopOpacity={0.9} />
          </SvgLinear>
          <SvgLinear id={hl} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.15" stopColor="#FFFFFF" stopOpacity={0.85} />
            <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </SvgLinear>
          <SvgLinear id={band} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </SvgLinear>
          <ClipPath id={clip}>
            <Path d={BOTTLE_PATH} />
          </ClipPath>
        </Defs>
        <Path d={BOTTLE_PATH} fill={`url(#${tint})`} />
        <Path d={NECK_PATH} fill={`url(#${neck})`} />
        {/* ağız: kalın cam halka */}
        <Rect x={4} y={37} width={14} height={36} rx={4} fill="#3E8A76" fillOpacity={0.45} />
        <Rect x={6} y={39} width={3} height={32} rx={1.5} fill="#E6FFF6" fillOpacity={0.45} />
        {/* dip: kalın cam ve iç bükey dip */}
        <Ellipse cx={289} cy={55} rx={7} ry={43} fill="#0A2C26" fillOpacity={0.45} />
        <Path d="M286 16 Q281 55 286 94" stroke="#CFFFEF" strokeOpacity={0.35} strokeWidth={1.4} fill="none" />
        {/* kırılma: gövdenin alt yarısında kâğıdı büken açık bant */}
        <Rect x={112} y={60} width={172} height={14} rx={7} fill="#9EE8D0" fillOpacity={0.07} />
        {/* parlamalar */}
        <Rect x={124} y={16} width={156} height={6} rx={3} fill={`url(#${hl})`} />
        <Rect x={136} y={26} width={120} height={2} rx={1} fill="#FFFFFF" fillOpacity={0.22} />
        <Rect x={132} y={90} width={140} height={3} rx={1.5} fill="#FFFFFF" fillOpacity={0.14} />
        <Path d="M66 42.5 C84 42 92 20 118 14.5" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Rect x={20} y={43.5} width={44} height={3} rx={1.5} fill="#FFFFFF" fillOpacity={0.55} />
        <Rect x={22} y={64} width={38} height={1.6} rx={0.8} fill="#FFFFFF" fillOpacity={0.2} />
        <Ellipse cx={272} cy={20} rx={6} ry={2.2} fill="#FFFFFF" fillOpacity={0.9} />
        {/* dış çizgi */}
        <Path d={BOTTLE_PATH} fill="none" stroke="#C8FFEE" strokeOpacity={0.5} strokeWidth={1.1} />
      </Svg>
      {glints?.map((o, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: o }}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <G clipPath={`url(#${clip})`}>
              <Path d={`M${30 + i * 70} 0 L${58 + i * 70} 0 L${28 + i * 70} 110 L${0 + i * 70} 110 Z`} fill={`url(#${band})`} />
            </G>
          </Svg>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

/** Mantar tıpa (yatay; sağ ucu şişeye girer). Merkezi yerel orijinde. */
export function Cork({ width, height, style }: { width: number; height: number; style?: StyleProp<ViewStyle> }) {
  const g = useSvgId('ck');
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -width / 2, top: -height / 2, width, height }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 40 30">
        <Defs>
          <SvgLinear id={g} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8A5A34" />
            <Stop offset="0.3" stopColor="#D2A06A" />
            <Stop offset="0.55" stopColor="#B7834F" />
            <Stop offset="1" stopColor="#5E3A1F" />
          </SvgLinear>
        </Defs>
        {/* hafif konik: sol uç daha geniş */}
        <Path d="M3 1 L37 3.5 Q40 3.8 40 7 L40 23 Q40 26.2 37 26.5 L3 29 Q0 29 0 26 L0 4 Q0 1 3 1 Z" fill={`url(#${g})`} />
        <Ellipse cx={2.2} cy={15} rx={2.2} ry={13.6} fill="#C99462" />
        <Ellipse cx={2.2} cy={15} rx={1.4} ry={11} fill="#E0B27E" opacity={0.6} />
        {[
          [9, 8, 1],
          [15, 18, 0.8],
          [22, 10, 1.1],
          [28, 20, 0.7],
          [12, 23, 0.6],
          [33, 12, 0.8],
          [19, 5, 0.6],
          [25, 15, 0.5],
        ].map(([x, y, r], i) => (
          <Ellipse key={i} cx={x} cy={y} rx={r * 1.3} ry={r} fill="#4A2C15" opacity={0.55} />
        ))}
        <Rect x={4} y={6} width={32} height={2.2} rx={1.1} fill="#F3D2A4" opacity={0.45} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Rulo hâline getirilmiş mektup (yatay silindir), ortasında kurdele ve fiyonk.
 * Merkezi yerel orijinde. `ribbon` 0→1 fiyonk görünür.
 */
export function Scroll({ length, thickness, paper, ribbon, style }: { length: number; thickness: number; paper: Paper; ribbon?: Animated.AnimatedInterpolation<number> | Animated.Value | number; style?: StyleProp<ViewStyle> }) {
  const P = PAPERS[paper];
  const D = thickness;
  const cap = Math.max(3, D * 0.2);
  const spiral = useSvgId('sp');
  const r = ribbon ?? 0;
  const scale = typeof r === 'number' ? r : r.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.01, 1.18, 1] });
  const bandOpacity = typeof r === 'number' ? (r > 0 ? 1 : 0) : r.interpolate({ inputRange: [0, 0.15], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -length / 2, top: -D / 2, width: length, height: D }, style]}>
      <View style={{ position: 'absolute', left: cap / 2, right: cap / 2, top: 0, bottom: 0, overflow: 'hidden' }}>
        <LinearGradient colors={[P.edge, P.bg, '#FFFFFF', P.bg, P.bgDeep, P.edge]} locations={[0, 0.22, 0.34, 0.5, 0.8, 1]} style={{ flex: 1 }} />
        {/* sarılı kâğıdın kenar izi */}
        <View style={{ position: 'absolute', left: length * 0.12, right: length * 0.2, top: D * 0.66, height: 1, backgroundColor: P.edge, opacity: 0.6 }} />
      </View>
      {/* uç kapaklar: spiral */}
      {[0, 1].map((side) => (
        <View key={side} style={{ position: 'absolute', top: 0, width: cap, height: D, [side ? 'right' : 'left']: 0 }}>
          <Svg width={cap} height={D} viewBox="0 0 10 40">
            <Defs>
              <SvgLinear id={spiral + side} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={P.edge} />
                <Stop offset="0.4" stopColor={P.bg} />
                <Stop offset="1" stopColor={P.edge} />
              </SvgLinear>
            </Defs>
            <Ellipse cx={5} cy={20} rx={5} ry={20} fill={`url(#${spiral + side})`} />
            <Path d="M5 20 m0 -3 a1.4 3 0 1 1 0 6 a2.4 6 0 1 1 0 -12 a3.4 9.5 0 1 1 0 19 a4.4 13 0 1 1 0 -26 a4.8 16 0 1 1 0 32" stroke={P.edge} strokeWidth={0.8} fill="none" opacity={0.9} />
          </Svg>
        </View>
      ))}
      {/* kurdele bandı */}
      <Animated.View style={{ position: 'absolute', left: length / 2 - D * 0.3, width: D * 0.6, top: -1, bottom: -1, opacity: bandOpacity, borderRadius: 2, overflow: 'hidden' }}>
        <LinearGradient colors={['#6E1122', '#C9324C', '#F07A8E', '#B3263E', '#5E0E1C']} locations={[0, 0.25, 0.38, 0.62, 1]} style={{ flex: 1 }} />
      </Animated.View>
      {/* fiyonk */}
      <Animated.View style={{ position: 'absolute', left: length / 2 - D * 1.1, top: -D * 0.55, width: D * 2.2, height: D * 2.1, transform: [{ scale }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 44 42">
          <Path d="M22 16 C14 4 2 4 3 12 C4 19 14 20 22 17 Z" fill="#B3263E" stroke="#6E1122" strokeWidth={0.8} />
          <Path d="M22 16 C30 4 42 4 41 12 C40 19 30 20 22 17 Z" fill="#C9324C" stroke="#6E1122" strokeWidth={0.8} />
          <Path d="M6 11 C9 8 14 9 18 13" stroke="#F7A1B0" strokeWidth={1.2} fill="none" opacity={0.7} />
          <Path d="M20 18 C17 26 13 33 10 40 L15 38 L17 41 C19 33 21 26 22 19 Z" fill="#A5203A" />
          <Path d="M24 18 C27 26 31 33 34 40 L29 38 L27 41 C25 33 23 26 22 19 Z" fill="#8E1A31" />
          <Ellipse cx={22} cy={16.5} rx={3.6} ry={3.4} fill="#D63C57" stroke="#6E1122" strokeWidth={0.8} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
