import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Icon } from '@/components/ui';
import { fonts } from '@/theme';

/**
 * Oyun masası ambiyansı (Rus Ruleti / Shot Ruleti): koyu keçe + sıcak spot ışığı + kenar karartması.
 * `felt`: keçenin üst/orta/alt tonları · `light`: spot ışığının rengi · `lightY`: ışığın dikey merkezi (0–1).
 * Dokunmaları yakalamaz, tamamen statik (her karede yeniden çizilmez).
 */
export function TableBackdrop({
  felt = ['#150A0D', '#24101A', '#0E0709'],
  light = '#FFC98A',
  lightStrength = 0.2,
  lightY = 0.42,
  danger = 0,
}: {
  felt?: [string, string, string];
  light?: string;
  lightStrength?: number;
  lightY?: number;
  /** 0–1: kırmızı alarm tonu (mermi patlayınca) */
  danger?: number;
}) {
  const { width, height } = useWindowDimensions();
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const cy = h * lightY;
  const r = w * 0.95;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="tb-felt" cx="0.5" cy={lightY} r="0.8">
            <Stop offset="0" stopColor={felt[1]} />
            <Stop offset="0.55" stopColor={felt[0]} />
            <Stop offset="1" stopColor={felt[2]} />
          </RadialGradient>
          <RadialGradient id="tb-spot" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.42">
            <Stop offset="0" stopColor={light} stopOpacity={lightStrength} />
            <Stop offset="0.45" stopColor={light} stopOpacity={lightStrength * 0.35} />
            <Stop offset="1" stopColor={light} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="tb-vig" cx="0.5" cy="0.45" r="0.72">
            <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.78} />
          </RadialGradient>
          <RadialGradient id="tb-danger" cx="0.5" cy="0.5" r="0.72">
            <Stop offset="0.35" stopColor="#B0102A" stopOpacity={0} />
            <Stop offset="1" stopColor="#B0102A" stopOpacity={0.55} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="url(#tb-felt)" />
        {/* keçe dokusu: çok ince çapraz çizgiler */}
        {Array.from({ length: Math.ceil((w + h) / 9) }).map((_, i) => (
          <Line key={i} x1={i * 9 - h} y1={0} x2={i * 9} y2={h} stroke="#FFFFFF" strokeOpacity={0.012} strokeWidth={1} />
        ))}
        <Ellipse cx={w / 2} cy={cy} rx={r} ry={Math.min(h * 0.42, r * 0.95)} fill="url(#tb-spot)" />
        <Rect x={0} y={0} width={w} height={h} fill="url(#tb-vig)" />
        {danger > 0 ? <Rect x={0} y={0} width={w} height={h} fill="url(#tb-danger)" opacity={Math.min(1, danger)} /> : null}
      </Svg>
    </View>
  );
}

/** Pirinç/altın dolgulu ana eylem düğmesi (masa oyunları) */
export function GoldButton({ title, icon, onPress, loading, disabled }: { title: string; icon: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: !!loading, disabled: !!disabled }}
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => ({ height: 60, borderRadius: 999, overflow: 'hidden', opacity: disabled ? 0.45 : loading ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], shadowColor: '#E0A94A', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 })}
    >
      <LinearGradient colors={['#F6DC8F', '#D4A340', '#9C6B1C']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', left: 2, right: 2, top: 2, height: 24, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: 'rgba(255,255,255,.22)' }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Icon name={icon} size={22} color="#2A1A05" />
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extrabold, fontSize: 16, color: '#2A1A05', letterSpacing: 0.2 }}>
          {loading ? 'Hazırlanıyor…' : title}
        </Text>
      </View>
    </Pressable>
  );
}
