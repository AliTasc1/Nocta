import { LinearGradient } from 'expo-linear-gradient';
import React, { useId, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { PAPERS, type Paper } from '@/lib/letters';
import { fonts } from '@/theme';

/** Kâğıt satır aralığı (yazı satırları çizgilere oturur) */
export const LINE = 30;
/** Kâğıdın üst boşluğu (ilk çizgiden önce) */
export const PAPER_TOP = 22;
export const PAPER_PAD_X = 22;
/** Kenar boşluğu çizgisinin soldan uzaklığı */
export const MARGIN_X = 14;

/** Deterministik sözde-rastgele (her çizimde aynı doku) */
export function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** SVG gradyan kimlikleri web'de belge genelinde tekil olmalı */
export function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Kâğıt dokusu: hafif renk geçişi, lif benekleri, kenarlarda yaşlanma gölgesi.
 * Mutlak konumlu olarak ebeveyni doldurur.
 */
export function PaperTexture({ paper, seed = 3, radius = 6 }: { paper: Paper; seed?: number; radius?: number }) {
  const P = PAPERS[paper];
  const gid = useSvgId('age');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const specks = useMemo(() => {
    if (!size.w || !size.h) return [];
    const r = prng(seed);
    const n = Math.min(160, Math.round((size.w * size.h) / 1400));
    return Array.from({ length: n }, () => ({ x: r() * size.w, y: r() * size.h, rx: 0.4 + r() * 1.6, ry: 0.3 + r() * 0.6, o: 0.04 + r() * 0.08, d: r() > 0.5 }));
  }, [size.w, size.h, seed]);
  const night = paper === 'night';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <LinearGradient colors={[P.bg, P.bg, P.bgDeep]} locations={[0, 0.55, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      {size.w ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={gid} cx="50%" cy="45%" r="75%">
              <Stop offset="0.55" stopColor={night ? '#000' : '#7A5A2A'} stopOpacity={0} />
              <Stop offset="1" stopColor={night ? '#000' : '#7A5A2A'} stopOpacity={night ? 0.35 : 0.22} />
            </RadialGradient>
          </Defs>
          {specks.map((s, i) => (
            <Ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={night ? (s.d ? '#AAB4FF' : '#000') : s.d ? '#6B4A1E' : '#FFFFFF'} opacity={s.o} />
          ))}
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${gid})`} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Çizgili kâğıt çizgileri + kenar boşluğu (yükseklik kadar) */
export function PaperLines({ paper, width, height, top = PAPER_TOP, gap = LINE, margin = true, baseline = 0.84 }: { paper: Paper; width: number; height: number; top?: number; gap?: number; margin?: boolean; baseline?: number }) {
  const P = PAPERS[paper];
  const lines: number[] = [];
  for (let y = top + gap * baseline; y < height - 6; y += gap) lines.push(y);
  if (!width || !height) return null;
  return (
    <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
      {lines.map((y) => (
        <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={P.line} strokeWidth={1} />
      ))}
      {margin ? <Line x1={MARGIN_X} x2={MARGIN_X} y1={0} y2={height} stroke={P.margin} strokeWidth={1} /> : null}
      {margin ? <Line x1={MARGIN_X + 3} x2={MARGIN_X + 3} y1={0} y2={height} stroke={P.margin} strokeWidth={0.6} opacity={0.6} /> : null}
    </Svg>
  );
}

/**
 * Tam kâğıt yüzeyi: doku + çizgiler, içerik yüksekliği kadar uzar.
 * Yazı stili `letterText(paper)` ile çizgilere oturur.
 */
export function PaperSurface({ paper, children, style, minHeight = 420, seed }: { paper: Paper; children: React.ReactNode; style?: StyleProp<ViewStyle>; minHeight?: number; seed?: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const P = PAPERS[paper];
  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[
        {
          minHeight,
          borderRadius: 6,
          backgroundColor: P.bg,
          paddingTop: PAPER_TOP,
          paddingBottom: LINE,
          paddingLeft: PAPER_PAD_X + 6,
          paddingRight: PAPER_PAD_X - 4,
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
        },
        style,
      ]}
    >
      <PaperTexture paper={paper} seed={seed} />
      <PaperLines paper={paper} width={size.w} height={size.h} />
      {children}
    </View>
  );
}

/** Kâğıda yazılan el yazısı benzeri serif metin */
export function letterText(paper: Paper, size = 21, gap = LINE) {
  return { fontFamily: fonts.serifItalic, fontSize: size, lineHeight: gap, color: PAPERS[paper].ink } as const;
}

/** Kırmızı mum mühür (okunmamış mektup rozeti) */
export function WaxSeal({ size = 34, color = '#B3263E', glyph = true }: { size?: number; color?: string; glyph?: boolean }) {
  const gid = useSvgId('wax');
  const blobs = useMemo(() => {
    const r = prng(11);
    const pts: string[] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = 46 + r() * 4;
      pts.push(`${(50 + Math.cos(a) * rr).toFixed(1)},${(50 + Math.sin(a) * rr).toFixed(1)}`);
    }
    return `M${pts.join(' L')} Z`;
  }, []);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={gid} cx="38%" cy="32%" r="75%">
          <Stop offset="0" stopColor="#E0566C" />
          <Stop offset="0.55" stopColor={color} />
          <Stop offset="1" stopColor="#6E1122" />
        </RadialGradient>
      </Defs>
      <Path d={blobs} fill={`url(#${gid})`} />
      <Circle cx={50} cy={50} r={31} fill="none" stroke="#7A1426" strokeWidth={3} opacity={0.7} />
      <Circle cx={50} cy={50} r={31} fill="none" stroke="#F08A9A" strokeWidth={1.2} opacity={0.35} transform="translate(-1.2,-1.2)" />
      {glyph ? (
        <Path
          d="M50 66 C 30 52, 32 36, 42 36 C 47 36, 50 41, 50 43 C 50 41, 53 36, 58 36 C 68 36, 70 52, 50 66 Z"
          fill="#7A1426"
          opacity={0.85}
        />
      ) : null}
      <Ellipse cx={36} cy={30} rx={10} ry={5} fill="#fff" opacity={0.18} transform="rotate(-30 36 30)" />
    </Svg>
  );
}

/** Küçük zarf simgesi (liste kartları) */
export function Envelope({ paper, width = 54, sealed }: { paper: Paper; width?: number; sealed?: boolean }) {
  const P = PAPERS[paper];
  const h = Math.round(width * 0.7);
  return (
    <View style={{ width, height: h }}>
      <Svg width={width} height={h} viewBox="0 0 100 70">
        <Rect x={1} y={1} width={98} height={68} rx={5} fill={P.back} stroke={P.edge} strokeWidth={1.2} />
        <Path d="M2 66 L42 34 M98 66 L58 34" stroke={P.edge} strokeWidth={1.2} fill="none" />
        <Path d="M2 3 L50 42 L98 3" fill={P.bg} stroke={P.edge} strokeWidth={1.2} />
      </Svg>
      {sealed ? (
        <View style={{ position: 'absolute', left: width / 2 - width * 0.19, top: h * 0.42 }}>
          <WaxSeal size={width * 0.38} />
        </View>
      ) : null}
    </View>
  );
}

/** Kâğıt seçici için küçük örnek */
export function PaperSwatch({ paper, active, size = 40 }: { paper: Paper; active?: boolean; size?: number }) {
  const P = PAPERS[paper];
  return (
    <View style={{ width: size, height: size * 1.2, borderRadius: 5, overflow: 'hidden', borderWidth: active ? 2 : 1, borderColor: active ? '#E7688A' : 'rgba(255,230,240,.2)' }}>
      <PaperTexture paper={paper} radius={4} />
      {[0.35, 0.55, 0.75].map((f) => (
        <View key={f} style={{ position: 'absolute', left: 4, right: 4, top: size * 1.2 * f, height: 1, backgroundColor: P.line }} />
      ))}
      <Text style={{ position: 'absolute', left: 5, top: 2, fontFamily: fonts.serifItalic, fontSize: 13, color: P.ink }}>a</Text>
    </View>
  );
}
