import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinear, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { prng, useSvgId } from './Paper';

/** 0→1 arasında sonsuz, doğrusal döngü (yerel sürücü) */
export function useLoop(ms: number, run = true) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!run) return;
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [v, ms, run]);
  return v;
}

/** Döngü değerinden sinüs (−1…1) */
const SIN_IN = Array.from({ length: 17 }, (_, i) => i / 16);
export function sineOf(v: Animated.Value, amp: number, phase = 0) {
  return v.interpolate({ inputRange: SIN_IN, outputRange: SIN_IN.map((u) => Math.sin((u + phase) * Math.PI * 2) * amp) });
}

/** Periyodik dalga yolu: genişlik = w + period; `period` kadar kaydırılınca dikişsiz */
function wavePath(w: number, h: number, amp: number, period: number, seed: number) {
  const r = prng(seed);
  const p1 = r() * 6;
  const p2 = r() * 6;
  const total = w + period;
  let d = '';
  for (let x = 0; x <= total + 1; x += 4) {
    const u = (x / period) * Math.PI * 2;
    // sivri tepe, yayvan çukur (trokoid benzeri)
    const y = amp * (0.62 * -Math.abs(Math.sin(u / 2 + p1)) * 1.6 + 0.28 * Math.sin(u * 2 + p2) + 0.1 * Math.sin(u * 3 + p1)) + amp;
    d += `${x === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(2)} `;
  }
  const crest = d;
  d += `L${total} ${h} L0 ${h} Z`;
  return { fill: d, crest };
}

type WaveSpec = { top: number; amp: number; period: number; speed: number; colors: [string, string]; opacity: number; crest: string; seed: number; bob: number };

/** Tek dalga katmanı: SVG yol, sonsuz yatay kayma + hafif kabarma */
export function WaveLayer({ width, height, spec, dir = 1, style }: { width: number; height: number; spec: WaveSpec; dir?: 1 | -1; style?: any }) {
  const gid = useSvgId('wv');
  const { fill, crest } = useMemo(() => wavePath(width, height, spec.amp, spec.period, spec.seed), [width, height, spec.amp, spec.period, spec.seed]);
  const slide = useLoop(spec.speed);
  const bobL = useLoop(spec.speed * 0.37 + 1800);
  const tx = slide.interpolate({ inputRange: [0, 1], outputRange: dir === 1 ? [0, -spec.period] : [-spec.period, 0] });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: spec.top - spec.amp * 2, width: width + spec.period, height, transform: [{ translateX: tx }, { translateY: sineOf(bobL, spec.bob) }] }, style]}>
      <Svg width={width + spec.period} height={height}>
        <Defs>
          <SvgLinear id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={spec.colors[0]} stopOpacity={Math.min(1, spec.opacity + 0.15)} />
            <Stop offset={String(Math.min(0.5, (spec.amp * 2.4 + 3) / height))} stopColor={spec.colors[0]} stopOpacity={spec.opacity} />
            <Stop offset={String(Math.min(0.8, (spec.amp * 5 + 10) / height))} stopColor={spec.colors[1]} stopOpacity={spec.opacity} />
            <Stop offset="1" stopColor={spec.colors[1]} stopOpacity={Math.min(1, spec.opacity + 0.1)} />
          </SvgLinear>
        </Defs>
        <Path d={fill} fill={`url(#${gid})`} />
        <Path d={crest} fill="none" stroke={spec.crest} strokeWidth={1.1} />
      </Svg>
    </Animated.View>
  );
}

/** Dalga katmanları (uzaktan yakına). `near` dışındakiler şişenin arkasında kalır. */
export function waveSpecs(W: number, H: number, horizon: number): WaveSpec[] {
  const sea = H - horizon;
  // perspektif: uzakta sık ve alçak, yakında seyrek ve yüksek
  const rows: [number, number, number, number][] = [
    // f (derinlik), genlik, periyot bölen, hız
    [0.012, 0.8, 7, 17000],
    [0.045, 1.3, 5.5, 15000],
    [0.1, 2, 4.4, 13500],
    [0.18, 3, 3.4, 12000],
    [0.29, 4.4, 2.6, 10500],
    [0.43, 6.4, 2, 9400],
    [0.6, 9, 1.5, 8400],
    [0.8, 13, 1.15, 7400],
  ];
  return rows.map(([f, amp, div, speed], i) => {
    const light = 1 - f; // uzak katmanlar ay ışığını daha çok yansıtır
    const r = Math.round(26 + 28 * light);
    const gC = Math.round(40 + 34 * light);
    const bC = Math.round(88 + 52 * light);
    return {
      top: horizon + sea * f,
      amp,
      period: W / div,
      speed,
      colors: [`rgb(${r},${gC},${bC})`, i < 4 ? '#0E1A3E' : '#070E24'] as [string, string],
      opacity: 0.62 + f * 0.35,
      crest: `rgba(215,228,255,${(0.16 + 0.22 * light).toFixed(2)})`,
      seed: i + 1,
      bob: amp * 0.35,
    };
  });
}

/** Ay ışığı parıltı yolu: kısa yatay parlamalar, üç katman sırayla yanıp söner */
function Glitter({ W, H, horizon, moonX }: { W: number; H: number; horizon: number; moonX: number }) {
  const layers = useMemo(() => {
    const r = prng(42);
    return [0, 1, 2].map(() => {
      const items: { x: number; y: number; rx: number; ry: number; o: number }[] = [];
      for (let i = 0; i < 95; i++) {
        const f = Math.pow(r(), 1.5); // uzakta daha sık
        const y = horizon + 2 + f * (H - horizon);
        const spread = 6 + f * W * 0.24;
        const x = moonX + (r() + r() + r() - 1.5) * spread * 0.9;
        items.push({ x, y, rx: 1.2 + f * 18 * (0.3 + r()), ry: 0.45 + f * 1.8, o: 0.45 + r() * 0.55 });
      }
      return items;
    });
  }, [W, H, horizon, moonX]);
  const l = useLoop(2600);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {layers.map((items, k) => (
        <Animated.View key={k} style={[StyleSheet.absoluteFill, { opacity: l.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: k === 0 ? [1, 0.25, 0.6, 1] : k === 1 ? [0.3, 1, 0.35, 0.3] : [0.55, 0.4, 1, 0.55] }) }]}>
          <Svg width={W} height={H}>
            {items.map((g, i) => (
              <Ellipse key={i} cx={g.x} cy={g.y} rx={g.rx} ry={g.ry} fill="#FFF3D6" opacity={g.o} />
            ))}
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

/** İnce dalgacık dokusu: perspektifle küçülen kısa kıvrımlar, iki katman sırayla parlar */
function Chop({ W, H, horizon }: { W: number; H: number; horizon: number }) {
  const layers = useMemo(() => {
    const r = prng(77);
    return [0, 1].map(() => {
      let d = '';
      let dd = '';
      for (let i = 0; i < 150; i++) {
        const f = Math.pow(r(), 1.7);
        const y = horizon + 3 + f * (H - horizon - 6);
        const len = 3 + f * 30 * (0.5 + r());
        const x = r() * (W + 20) - 10;
        const hgt = 0.4 + f * 2.2;
        const seg = `M${x.toFixed(1)} ${y.toFixed(1)} q${(len / 2).toFixed(1)} ${(-hgt).toFixed(2)} ${len.toFixed(1)} 0 `;
        if (r() > 0.35) d += seg;
        else dd += seg;
      }
      return { light: d, dark: dd };
    });
  }, [W, H, horizon]);
  const l = useLoop(3800);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {layers.map((ly, k) => (
        <Animated.View key={k} style={[StyleSheet.absoluteFill, { opacity: sineOf(l, 0.35, k * 0.5).interpolate({ inputRange: [-0.35, 0.35], outputRange: [0.25, 0.95] }), transform: [{ translateX: sineOf(l, 5, k * 0.5 + 0.25) }] }]}>
          <Svg width={W} height={H}>
            <Path d={ly.light} stroke="#B9C8F0" strokeOpacity={0.3} strokeWidth={1} fill="none" strokeLinecap="round" />
            <Path d={ly.dark} stroke="#02060F" strokeOpacity={0.45} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

function Stars({ W, horizon, moonX, moonY }: { W: number; horizon: number; moonX: number; moonY: number }) {
  const groups = useMemo(() => {
    const r = prng(7);
    const g: { x: number; y: number; s: number; o: number }[][] = [[], [], []];
    for (let i = 0; i < 90; i++) {
      const x = r() * W;
      const y = Math.pow(r(), 1.3) * (horizon - 16);
      const dm = Math.hypot(x - moonX, y - moonY);
      if (dm < 60) continue; // ayın parıltısında yıldız görünmez
      g[i % 3].push({ x, y, s: 0.4 + r() * r() * 1.4, o: 0.35 + r() * 0.6 * Math.min(1, dm / 140) });
    }
    return g;
  }, [W, horizon, moonX, moonY]);
  const tw = useLoop(3400);
  return (
    <>
      {groups.map((items, k) => (
        <Animated.View key={k} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: sineOf(tw, 0.3, k / 3).interpolate({ inputRange: [-0.3, 0.3], outputRange: [0.45, 1] }) }]}>
          <Svg width={W} height={horizon}>
            {items.map((s, i) => (
              <Circle key={i} cx={s.x} cy={s.y} r={s.s} fill={i % 7 === 0 ? '#D9E2FF' : '#FFFFFF'} opacity={s.o} />
            ))}
          </Svg>
        </Animated.View>
      ))}
    </>
  );
}

function Moon({ x, y, r }: { x: number; y: number; r: number }) {
  const glow = useSvgId('mg');
  const disk = useSvgId('md');
  const S = r * 7;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x - S / 2, top: y - S / 2, width: S, height: S }}>
      <Svg width={S} height={S}>
        <Defs>
          <RadialGradient id={glow} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF4D8" stopOpacity={0.55} />
            <Stop offset="0.18" stopColor="#F6E9C8" stopOpacity={0.22} />
            <Stop offset="0.45" stopColor="#9FB0E0" stopOpacity={0.07} />
            <Stop offset="1" stopColor="#9FB0E0" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={disk} cx="42%" cy="40%" r="60%">
            <Stop offset="0" stopColor="#FFFDF4" />
            <Stop offset="0.7" stopColor="#F4EACB" />
            <Stop offset="1" stopColor="#DCCFA8" />
          </RadialGradient>
        </Defs>
        <Circle cx={S / 2} cy={S / 2} r={S / 2} fill={`url(#${glow})`} />
        <Circle cx={S / 2} cy={S / 2} r={r} fill={`url(#${disk})`} />
        {[
          [-0.3, -0.2, 0.22],
          [0.25, 0.1, 0.16],
          [-0.05, 0.35, 0.12],
          [0.35, -0.35, 0.09],
          [-0.42, 0.22, 0.08],
        ].map(([dx, dy, rr], i) => (
          <Circle key={i} cx={S / 2 + dx * r} cy={S / 2 + dy * r} r={rr * r} fill="#B8AC88" opacity={0.28} />
        ))}
      </Svg>
    </View>
  );
}

/** Yavaşça süzülen sis/bulut şeritleri */
function FogBand({ W, y, h, opacity, speed, seed }: { W: number; y: number; h: number; opacity: number; speed: number; seed: number }) {
  const gid = useSvgId('fog');
  const puffs = useMemo(() => {
    const r = prng(seed);
    return Array.from({ length: 7 }, (_, i) => ({ x: (i / 7) * W * 2 + r() * 40, rx: W * (0.18 + r() * 0.2), ry: h * (0.2 + r() * 0.12), dy: (r() - 0.5) * h * 0.12 }));
  }, [W, h, seed]);
  const l = useLoop(speed);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: y - h / 2, width: W * 2, height: h, opacity, transform: [{ translateX: l.interpolate({ inputRange: [0, 1], outputRange: [0, -W] }) }] }}>
      <Svg width={W * 2} height={h}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#B7C4EA" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#B7C4EA" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {puffs.map((p, i) => (
          <React.Fragment key={i}>
            <Ellipse cx={p.x} cy={h / 2 + p.dy} rx={p.rx} ry={p.ry} fill={`url(#${gid})`} />
            {/* aynı bulut bir periyot (W) solda da çizilir → dikişsiz döngü */}
            <Ellipse cx={p.x >= W ? p.x - W : p.x + W} cy={h / 2 + p.dy} rx={p.rx} ry={p.ry} fill={`url(#${gid})`} />
          </React.Fragment>
        ))}
      </Svg>
    </Animated.View>
  );
}

export type OceanGeometry = { W: number; H: number; horizon: number; moonX: number; moonY: number; moonR: number };

/** Ay, kısa ekranlarda da üstteki yazının altında kalır */
export function oceanGeometry(W: number, H: number): OceanGeometry {
  const horizon = Math.round(H * 0.44);
  return { W, H, horizon, moonX: Math.round(W * 0.66), moonY: Math.round(Math.max(horizon * 0.36, Math.min(horizon * 0.62, 150))), moonR: Math.round(Math.min(W, H) * 0.062) };
}

/** Gece okyanusu (gökyüzü, yıldızlar, ay, ufuk sisi, ay yolu, arka dalga katmanları) */
export function OceanBack({ g, waves = 7 }: { g: OceanGeometry; waves?: number }) {
  const { W, H, horizon, moonX, moonY, moonR } = g;
  const specs = useMemo(() => waveSpecs(W, H, horizon), [W, H, horizon]);
  const seaG = useSvgId('sea');
  const col = useSvgId('col');
  const hl = useSvgId('hl');
  const sea = H - horizon;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: '#050814' }]}>
      <LinearGradient colors={['#02030A', '#060D24', '#102048', '#26396C']} locations={[0, 0.45, 0.84, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: horizon + 1 }} />
      <Stars W={W} horizon={horizon} moonX={moonX} moonY={moonY} />
      <FogBand W={W} y={moonY + moonR * 1.1} h={moonR * 4} opacity={0.4} speed={60000} seed={5} />
      <Moon x={moonX} y={moonY} r={moonR} />
      {/* deniz zemini + ay sütunu (eliptik yumuşak ışık) */}
      <Svg width={W} height={sea} style={{ position: 'absolute', left: 0, top: horizon }}>
        <Defs>
          <SvgLinear id={seaG} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#223670" />
            <Stop offset="0.22" stopColor="#12214B" />
            <Stop offset="1" stopColor="#040817" />
          </SvgLinear>
          <RadialGradient id={col} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF0CC" stopOpacity={0.42} />
            <Stop offset="0.35" stopColor="#E9D9B8" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#E9D9B8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={sea} fill={`url(#${seaG})`} />
        <Ellipse cx={moonX} cy={0} rx={W * 0.2} ry={sea * 0.95} fill={`url(#${col})`} />
      </Svg>
      {specs.slice(0, waves).map((sp, i) => (
        <WaveLayer key={i} width={W} height={H - sp.top + sp.amp * 2 + 4} spec={sp} dir={i % 2 ? -1 : 1} />
      ))}
      <Chop W={W} H={H} horizon={horizon} />
      <Glitter W={W} H={H} horizon={horizon} moonX={moonX} />
      {/* ufuk: ince pus ve ayın altında parlayan çizgi */}
      <LinearGradient colors={['rgba(170,185,230,0)', 'rgba(170,185,230,.16)', 'rgba(170,185,230,0)']} style={{ position: 'absolute', left: 0, right: 0, top: horizon - 16, height: 32 }} />
      <Svg width={W} height={4} style={{ position: 'absolute', left: 0, top: horizon - 1.5 }}>
        <Defs>
          <SvgLinear id={hl} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFF0D0" stopOpacity={0.05} />
            <Stop offset={String(Math.max(0.05, (moonX - W * 0.22) / W))} stopColor="#FFF0D0" stopOpacity={0.1} />
            <Stop offset={String(moonX / W)} stopColor="#FFF0D0" stopOpacity={0.75} />
            <Stop offset={String(Math.min(0.95, (moonX + W * 0.22) / W))} stopColor="#FFF0D0" stopOpacity={0.1} />
            <Stop offset="1" stopColor="#FFF0D0" stopOpacity={0.05} />
          </SvgLinear>
        </Defs>
        <Rect x={0} y={1} width={W} height={1.4} fill={`url(#${hl})`} />
      </Svg>
      <FogBand W={W} y={horizon + 2} h={70} opacity={0.35} speed={42000} seed={9} />
    </View>
  );
}

/** Ön plandaki dalga(lar): şişenin önünden geçer */
export function OceanFront({ g, from = 7 }: { g: OceanGeometry; from?: number }) {
  const { W, H, horizon } = g;
  const specs = useMemo(() => waveSpecs(W, H, horizon), [W, H, horizon]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {specs.slice(from).map((s, i) => (
        <WaveLayer key={i} width={W} height={H - s.top + s.amp * 2 + 4} spec={s} dir={i % 2 ? 1 : -1} />
      ))}
      <LinearGradient colors={['rgba(2,3,10,0)', 'rgba(2,3,10,.55)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 0.22 }} />
    </View>
  );
}
