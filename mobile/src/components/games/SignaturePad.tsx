import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { colors, fonts } from '@/theme';

/** İmza koordinat sistemi: tüm imzalar bu boyuta normalize edilip saklanır */
export const SIG_W = 300;
export const SIG_H = 120;
const INK = '#F4B9C8';

const r1 = (n: number) => {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/** Nokta dizisi → yumuşak (ikinci dereceden Bézier) SVG yolu */
function strokeToPath(pts: number[]) {
  const n = pts.length / 2;
  if (n === 0) return '';
  const x = (i: number) => pts[i * 2];
  const y = (i: number) => pts[i * 2 + 1];
  if (n === 1) return `M${r1(x(0))} ${r1(y(0))}l0.1 0.1`;
  let d = `M${r1(x(0))} ${r1(y(0))}`;
  for (let i = 1; i < n - 1; i++) {
    const mx = (x(i) + x(i + 1)) / 2;
    const my = (y(i) + y(i + 1)) / 2;
    d += `Q${r1(x(i))} ${r1(y(i))} ${r1(mx)} ${r1(my)}`;
  }
  d += `L${r1(x(n - 1))} ${r1(y(n - 1))}`;
  return d;
}

/** Kaydedilmiş imzayı (SVG yolu, 300×120) verilen genişlikte çizer */
export function SignatureView({ path, width, color = INK, strokeWidth = 3 }: { path: string; width: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={width} height={(width * SIG_H) / SIG_W} viewBox={`0 0 ${SIG_W} ${SIG_H}`}>
      <Path d={path} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={path} stroke="#FFF1F4" strokeOpacity={0.55} strokeWidth={strokeWidth * 0.32} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Parmakla imza alanı (PanResponder). Çizim sürerken `onDrawing(true)` ile üstteki kaydırma
 * kapatılabilir. `onChange` normalize edilmiş yolu (300×120, 1 ondalık) ve toplam nokta sayısını verir.
 */
export function useSignaturePad({ width, onChange, onDrawing, disabled }: { width: number; onChange: (path: string, points: number) => void; onDrawing?: (on: boolean) => void; disabled?: boolean }) {
  const height = Math.round((width * SIG_H) / SIG_W);
  const strokes = useRef<number[][]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const cb = useRef({ onChange, onDrawing, width, height, disabled });
  useEffect(() => {
    cb.current = { onChange, onDrawing, width, height, disabled };
  });

  const emit = () => {
    const ps = strokes.current.map(strokeToPath);
    setPaths(ps);
    const count = strokes.current.reduce((s, p) => s + p.length / 2, 0);
    cb.current.onChange(ps.join(''), count);
  };

  const point = (e: GestureResponderEvent): [number, number] => {
    const { width: w, height: h } = cb.current;
    const lx = Math.max(0, Math.min(w, e.nativeEvent.locationX));
    const ly = Math.max(0, Math.min(h, e.nativeEvent.locationY));
    return [(lx * SIG_W) / Math.max(1, w), (ly * SIG_H) / Math.max(1, h)];
  };

  // Dokunma işleyicileri ref'leri yalnızca olay anında okur (render sırasında değil)
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !cb.current.disabled,
      onStartShouldSetPanResponderCapture: () => !cb.current.disabled,
      onMoveShouldSetPanResponder: () => !cb.current.disabled,
      onMoveShouldSetPanResponderCapture: () => !cb.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        cb.current.onDrawing?.(true);
        const [x, y] = point(e);
        strokes.current = [...strokes.current, [x, y]];
        emit();
      },
      onPanResponderMove: (e) => {
        const cur = strokes.current[strokes.current.length - 1];
        if (!cur) return;
        const [x, y] = point(e);
        const lx = cur[cur.length - 2];
        const ly = cur[cur.length - 1];
        // Çok yakın noktaları atla: yol kısa kalır, çizgi yine pürüzsüz
        if (Math.hypot(x - lx, y - ly) < 2.2) return;
        cur.push(x, y);
        emit();
      },
      onPanResponderRelease: () => cb.current.onDrawing?.(false),
      onPanResponderTerminate: () => cb.current.onDrawing?.(false),
    }),
  );

  const clear = () => {
    strokes.current = [];
    emit();
  };

  return {
    clear,
    empty: paths.length === 0,
    node: (
      <View
        {...responder.panHandlers}
        accessibilityLabel="İmza alanı. Parmağınla imzanı çiz."
        style={{ width, height, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(10,6,8,.55)', borderWidth: 1, borderColor: 'rgba(212,175,110,.35)' }}
      >
        <View style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <Svg width={width} height={height} viewBox={`0 0 ${SIG_W} ${SIG_H}`}>
            <Line x1={22} y1={SIG_H - 26} x2={SIG_W - 22} y2={SIG_H - 26} stroke="#D4AF6E" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="4 5" />
            {paths.map((d, i) => (
              <Path key={i} d={d} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {paths.map((d, i) => (
              <Path key={`h${i}`} d={d} stroke="#FFF1F4" strokeOpacity={0.55} strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        </View>
        <Text style={{ position: 'absolute', left: 14, bottom: 8, fontFamily: fonts.serifItalic, fontSize: 18, color: 'rgba(212,175,110,.55)', pointerEvents: 'none' }}>
          ×
        </Text>
        {paths.length === 0 ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 26, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Text style={{ fontFamily: fonts.serifItalic, fontSize: 20, color: 'rgba(244,185,200,.4)' }}>İmzanı buraya at</Text>
          </View>
        ) : null}
        <View style={{ position: 'absolute', right: 10, top: 8, pointerEvents: 'none' }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.4, color: colors.faint }}>İMZA</Text>
        </View>
      </View>
    ),
  };
}
