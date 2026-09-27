import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Icon, T } from '@/components/ui';
import type { Question } from '@/lib/types';
import { colors, fonts, LEVELS } from '@/theme';
import type { GameApi } from './useGameSession';

// ─────────────────────────────────────────────────────────────
// Yardımcılar
// ─────────────────────────────────────────────────────────────
export type Player = { id: string; name: string; color: string };

export function levelName(n: number | null | undefined) {
  return LEVELS[Math.max(0, Math.min(3, n ?? 0))]?.name ?? 'Yumuşak';
}

export function upper(s: string) {
  return s.toLocaleUpperCase('tr-TR');
}

export function initialOf(name: string) {
  return upper((name || '?').trim().charAt(0) || '?');
}

/** "Deniz" → "Deniz'in" (Türkçe iyelik eki, ünlü uyumu) */
export function possessive(name: string) {
  const n = name.trim();
  if (!n) return 'Partnerinin';
  const vowels = n.toLocaleLowerCase('tr-TR').match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? 'e';
  const endsVowel = /[aeıioöuü]$/i.test(n.toLocaleLowerCase('tr-TR'));
  const suffix = { a: 'ın', ı: 'ın', e: 'in', i: 'in', o: 'un', u: 'un', ö: 'ün', ü: 'ün' }[last] ?? 'in';
  return `${n}'${endsVowel ? 'n' : ''}${suffix}`;
}

export function optionsOf(q: Question | null | undefined): string[] {
  const o = q?.options as unknown;
  if (Array.isArray(o)) return o.map((x) => String(x));
  if (typeof o === 'string') {
    try {
      const parsed = JSON.parse(o);
      return Array.isArray(parsed) ? parsed.map((x: unknown) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Sorunun görsel adresleri (options ile hizalı). Eksik/bozuk → boş dize. */
export function mediaOf(q: Question | null | undefined): string[] {
  let m = q?.media as unknown;
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m);
    } catch {
      m = [];
    }
  }
  if (!Array.isArray(m)) return [];
  return m.map((x) => (typeof x === 'string' ? x.trim() : ''));
}

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

/** Sistem "hareketi azalt" ayarı */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Küçük ekranlar (360×640) için ölçek */
export function useCompact() {
  const { height, width } = useWindowDimensions();
  const compact = height < 720 || width < 370;
  const tiny = height < 660;
  return { compact, tiny, height, width, s: (big: number, small: number) => (compact ? small : big) };
}

// ─────────────────────────────────────────────────────────────
// Seçenek ızgarası (Kart Seç, Emojilerle Anlat)
// ─────────────────────────────────────────────────────────────
/** GameLayout içerik alanının yatay dolgusu (her iki yanda) */
export const GAME_PAD = 20;

/**
 * Izgara ölçüleri — onLayout'a bağlı değil, ilk render'da kesin sayılarla hesaplanır.
 * İçerik genişliği = pencere − güvenli alan − 2×dolgu (tablette `maxW` ile sınırlı).
 * Hücre genişliği tam sayıya AŞAĞI yuvarlanır: satır toplamı hiçbir zaman kapsayıcıyı
 * aşmaz (Yoga'nın piksel yuvarlaması yüzünden ikinci hücrenin alt satıra düşmesi engellenir).
 * `reserve`: ızgara dışındaki başlık/soru/alt buton vb. için ayrılan yaklaşık yükseklik.
 */
export function useChoiceGrid({ count, gap, reserve, maxCols = 2, maxW = 560 }: { count: number; gap: number; reserve: number; maxCols?: number; maxW?: number }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentW = Math.max(0, Math.min(maxW, width - insets.left - insets.right - GAME_PAD * 2));
  const cols = count <= 1 ? 1 : Math.min(maxCols, count >= 5 && width >= 600 ? 3 : 2);
  const rows = Math.max(1, Math.ceil(count / cols));
  const colW = Math.max(0, Math.floor((contentW - gap * (cols - 1)) / cols));
  // Tüm satırların (yaklaşık) kaydırmasız sığması için satır başına düşen yükseklik
  const budget = height - insets.top - insets.bottom - reserve;
  const rowH = Math.floor((budget - gap * (rows - 1)) / rows);
  return { cols, rows, colW, rowH, contentW };
}

/**
 * Seçenekleri açık satırlar halinde dizer (flexWrap kullanılmaz): 2 → yan yana,
 * 3 → 2 + 1 (sonuncu ortada), 4 → 2×2, 5–6 → 2 sütun.
 * `raise`: kutlama patlaması (Burst) sonraki satırların altında kalmasın diye öne alınan hücre.
 */
export function ChoiceGrid({ count, cols, gap, raise, renderItem }: { count: number; cols: number; gap: number; raise?: number | null; renderItem: (i: number) => React.ReactNode }) {
  const rows: number[][] = [];
  for (let s = 0; s < count; s += cols) rows.push(Array.from({ length: Math.min(cols, count - s) }, (_, k) => s + k));
  return (
    <View style={{ gap, zIndex: 2, alignSelf: 'center' }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', justifyContent: 'center', gap, zIndex: raise != null && row.includes(raise) ? 3 : 1 }}>
          {row.map((i) => (
            <React.Fragment key={i}>{renderItem(i)}</React.Fragment>
          ))}
        </View>
      ))}
    </View>
  );
}

/** finish_session sonucunu sonuç ekranına taşımak için bellek içi önbellek */
export type FinishResult = {
  xp?: number;
  matches?: number;
  rounds?: number;
  couple_xp?: number;
  flirt?: { level: number; name: string; floor: number; next: number | null };
  already?: boolean;
  session?: Record<string, any>;
};
export const finishCache = new Map<string, FinishResult>();

// ─────────────────────────────────────────────────────────────
// Ortak oyun iskeleti
// ─────────────────────────────────────────────────────────────
export function PresenceAvatar({ player, online, size = 36 }: { player: Player; online: boolean; size?: number }) {
  return (
    <View accessibilityLabel={`${player.name} ${online ? 'çevrimiçi' : 'çevrimdışı'}`}>
      <Avatar name={player.name} color={player.color} size={size} />
      <View
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: online ? colors.success : colors.faint,
        }}
      />
    </View>
  );
}

export function CircleButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.05)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name={icon} size={22} color={colors.pearl} />
    </Pressable>
  );
}

/** Tasarımdaki üst çubuk: kapat · ortada meta · sağda partner */
export function GameTopBar({ onClose, center, right }: { onClose: () => void; center?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
      <CircleButton icon="close" label="Oyundan çık" onPress={onClose} />
      <View style={{ flex: 1, alignItems: 'center' }}>{typeof center === 'string' ? <MetaText>{center}</MetaText> : center}</View>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function MetaText({ children, color = colors.mist, style }: { children: React.ReactNode; color?: string; style?: StyleProp<any> }) {
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2} style={[{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color, textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

/**
 * Oyun ekranı gövdesi: üst çubuk + (taşarsa kayan) içerik + sabit alt alan.
 * Güvenli alanlar burada uygulanır.
 */
export function GameLayout({ top, children, footer, bg, overlay, contentStyle, scroll = true, keyboard }: { top: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; bg?: React.ReactNode; overlay?: React.ReactNode; contentStyle?: StyleProp<ViewStyle>; scroll?: boolean; keyboard?: boolean }) {
  const insets = useSafeAreaInsets();
  const { compact } = useCompact();
  const gap = compact ? 12 : 18;
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      {bg ?? <GameBackground />}
      <KeyboardAvoidingView
        enabled={!!keyboard && Platform.OS === 'ios'}
        behavior="padding"
        style={{ flex: 1, paddingTop: insets.top + 6, paddingLeft: insets.left, paddingRight: insets.right }}
      >
        <View style={{ paddingHorizontal: 20 }}>{top}</View>
        {scroll ? (
          // Alt butonlar içerikle birlikte kayar: içerik kısaysa en altta durur, uzunsa kaydırılarak ulaşılır
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={!!keyboard}
          >
            <View style={[{ flexGrow: 1, paddingHorizontal: 20, paddingTop: gap, paddingBottom: 12, gap }, contentStyle]}>{children}</View>
            {footer ? (
              <View style={{ marginTop: 'auto', paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 4, gap: 8 }}>{footer}</View>
            ) : (
              <View style={{ height: Math.max(insets.bottom, 12) }} />
            )}
          </ScrollView>
        ) : (
          <>
            <View style={[{ flex: 1, paddingHorizontal: 20, paddingTop: gap, paddingBottom: 12, gap }, contentStyle]}>{children}</View>
            {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 4, gap: 8 }}>{footer}</View> : <View style={{ height: Math.max(insets.bottom, 12) }} />}
          </>
        )}
      </KeyboardAvoidingView>
      {overlay}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Tam ekran arka plan (eski dairesel ışıltının yerine)
// ─────────────────────────────────────────────────────────────
/** Oyun ekranlarının renk tonu: motorun/durumun ipucu (doğruluk → iris, cesaret → gül, doğru → yeşil…) */
export type BgTone = 'rose' | 'iris' | 'violet' | 'wine' | 'success' | 'error';

const TONE_RGB: Record<BgTone, [number, number, number]> = {
  rose: [231, 104, 138],
  iris: [168, 139, 240],
  violet: [120, 60, 150],
  wine: [150, 40, 78],
  success: [127, 209, 174],
  error: [240, 122, 122],
};
// Ton başına vurgu katmanının yoğunluğu (açık renkler daha düşük): metin kontrastı korunur
const TONE_STRENGTH: Record<BgTone, number> = { rose: 0.2, iris: 0.2, violet: 0.34, wine: 0.36, success: 0.14, error: 0.14 };

/** "#RRGGBB" | "rgb(a)(…)" → [r,g,b] (tanınmazsa gül) */
function rgbOf(c: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : TONE_RGB.rose;
}
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/**
 * Tüm ekranı (güvenli alanlar dahil) kaplayan gradyan arka plan:
 *  - dikey taban: mürekkep → mor/erik tonu → mürekkep
 *  - motorun/durumun rengine boyanmış düşük opaklıkta çapraz vurgu (ton değişince yumuşak geçiş)
 *  - altta hafif koyulaşma (alt butonların/metnin kontrastı için)
 * Dokunmaları yakalamaz. "Hareketi azalt" açık değilse vurgu çok yavaş "nefes alır".
 */
export function GameBackground({ tone = 'violet', accent, intensity = 1 }: { tone?: BgTone; accent?: string; intensity?: number }) {
  const rgb = accent ? rgbOf(accent) : TONE_RGB[tone];
  const strength = (accent ? 0.24 : TONE_STRENGTH[tone]) * intensity;
  const layerKey = `${rgb.join(',')}:${strength.toFixed(3)}`;
  // Ton değişiminde çapraz geçiş için son iki katman tutulur
  const [layers, setLayers] = useState<{ key: string; rgb: [number, number, number]; strength: number }[]>(() => [{ key: layerKey, rgb, strength }]);
  if (layers[layers.length - 1].key !== layerKey) {
    setLayers((l) => [...l.filter((x) => x.key !== layerKey).slice(-1), { key: layerKey, rgb, strength }]);
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.ink, '#150C16', '#1E1024', '#140B15', colors.ink]} locations={[0, 0.22, 0.52, 0.8, 1]} style={StyleSheet.absoluteFill} />
      {layers.map((l, i) => (
        <AccentLayer
          key={l.key}
          rgb={l.rgb}
          strength={l.strength}
          fadeIn={i > 0}
          // Yeni katman tamamen görünür olunca eskisi kaldırılır
          onShown={i === layers.length - 1 && layers.length > 1 ? () => setLayers((cur) => cur.slice(-1)) : undefined}
        />
      ))}
      <LinearGradient colors={['rgba(12,8,11,0)', 'rgba(12,8,11,.55)']} locations={[0, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' }} />
    </View>
  );
}

function AccentLayer({ rgb, strength, fadeIn, onShown }: { rgb: [number, number, number]; strength: number; fadeIn: boolean; onShown?: () => void }) {
  const reduced = useReducedMotion();
  const appear = useState(() => new Animated.Value(fadeIn ? 0 : 1))[0];
  const breath = useState(() => new Animated.Value(0))[0];
  const shownRef = useRef(onShown);
  useEffect(() => {
    shownRef.current = onShown;
  });
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: reduced ? 0 : 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (finished) shownRef.current?.();
    });
  }, [appear, reduced]);
  useEffect(() => {
    if (reduced) {
      breath.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reduced]);
  const wine = TONE_RGB.wine;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]}>
      {/* sol üstten çapraz vurgu (nefes alan katman) */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}>
        <LinearGradient
          colors={[rgba(rgb, strength), rgba(rgb, strength * 0.45), rgba(rgb, 0)]}
          locations={[0, 0.4, 0.78]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* sağ alttan karşı vurgu: ton + şarap karışımı, daha soluk; zıt fazda nefes alır */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }) }]}>
        <LinearGradient
          colors={[rgba(rgb, strength * 0.5), rgba(wine, 0.12), rgba(wine, 0)]}
          locations={[0, 0.3, 0.7]}
          start={{ x: 1, y: 1 }}
          end={{ x: 0.1, y: 0.25 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

/** Partner durum göstergesi: "Deniz seçti" (yeşil nokta) ya da "düşünüyor…" */
export function PartnerStatus({ name, done, doneText = 'seçti', waitText = 'düşünüyor…' }: { name: string; done: boolean; doneText?: string; waitText?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 140 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: done ? colors.success : colors.faint }} />
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.semibold, fontSize: 12, color: done ? colors.success : colors.mist, flexShrink: 1 }}>
        {name} {done ? doneText : waitText}
      </Text>
    </View>
  );
}

/** Mini avatar (seçim üzerindeki "kim seçti" rozeti) */
export function MiniAvatar({ player, size = 28 }: { player: Player; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: player.color, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.5, color: colors.pearl }}>{initialOf(player.name)}</Text>
    </View>
  );
}

/** Yükleniyor / bekleniyor: üç nokta animasyonu */
export function TypingDots({ color = colors.mist }: { color?: string }) {
  const reduced = useReducedMotion();
  const vals = useState(() => [0, 1, 2].map(() => new Animated.Value(0.25)))[0];
  useEffect(() => {
    if (reduced) return;
    const anims = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - i * 200),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [reduced, vals]);
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: reduced ? 0.6 : v }} />
      ))}
    </View>
  );
}

/** Tek satırlık sonuç şeridi (tasarım: 56px hap) */
export function ResultPill({ text, tone }: { text: string; tone: 'idle' | 'match' | 'diff' | 'wait' }) {
  const bg = tone === 'match' ? colors.rose : tone === 'diff' ? 'rgba(168,139,240,.18)' : 'rgba(255,255,255,.04)';
  const fg = tone === 'match' ? colors.onRose : tone === 'idle' || tone === 'wait' ? colors.mist : colors.pearl;
  return (
    <View style={{ flex: 1, minHeight: 56, borderRadius: 999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
      {tone === 'wait' ? <TypingDots /> : null}
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: 16, color: fg }}>
        {text}
      </Text>
    </View>
  );
}

/** Yuvarlak "sonraki" düğmesi. `gate` verilirse kilit açılana kadar alttan yukarı dolar. */
export function NextFab({ onPress, loading, label = 'Sonraki', gate }: { onPress: () => void; loading?: boolean; label?: string; gate?: RevealGate }) {
  return gate ? <GatedFab gate={gate} onPress={onPress} loading={loading} label={label} /> : <FabBase onPress={onPress} loading={loading} label={label} locked={false} />;
}

function GatedFab({ gate, onPress, loading, label }: { gate: RevealGate; onPress: () => void; loading?: boolean; label: string }) {
  const progress = useUnlockProgress(gate);
  return <FabBase onPress={onPress} loading={loading} label={label} locked={!gate.canAdvance} progress={progress} />;
}

function FabBase({ onPress, loading, label, locked, progress }: { onPress: () => void; loading?: boolean; label: string; locked: boolean; progress?: Animated.Value }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={locked ? 'Cevapları ikiniz de gördükten sonra etkinleşir' : undefined}
      accessibilityState={{ disabled: locked || !!loading }}
      disabled={loading || locked}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: locked ? 'rgba(246,238,241,.08)' : colors.pearl,
        borderWidth: locked ? 1 : 0,
        borderColor: colors.lineStrong,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: loading ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      {locked && progress ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(246,238,241,.2)', height: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
        />
      ) : null}
      <Icon name="arrow_forward" size={24} color={locked ? colors.pearlSoft : colors.onRose} />
    </Pressable>
  );
}

/** Metni bulanık gösterir (text-shadow maskesi) ve 600ms'de netleştirir */
export function RevealText({ text, revealed, placeholder, style }: { text: string | null; revealed: boolean; placeholder?: string; style?: StyleProp<any> }) {
  const reduced = useReducedMotion();
  const anim = useState(() => new Animated.Value(revealed ? 1 : 0))[0];
  useEffect(() => {
    Animated.timing(anim, { toValue: revealed ? 1 : 0, duration: reduced ? 0 : 600, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [revealed, reduced, anim]);
  const shown = text ?? placeholder ?? '';
  const base = [{ fontFamily: fonts.medium, fontSize: 15.5, lineHeight: 23, color: colors.pearl }, style];
  return (
    <View>
      <Animated.Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        maxFontSizeMultiplier={1.3}
        style={[base, { color: 'transparent', textShadowColor: 'rgba(246,238,241,.75)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14, opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
      >
        {revealed ? shown : (text ? scramble(text) : shown)}
      </Animated.Text>
      {text ? (
        <Animated.Text
          maxFontSizeMultiplier={1.3}
          style={[base, StyleSheet.absoluteFill, { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] }]}
        >
          {revealed ? text : ''}
        </Animated.Text>
      ) : null}
    </View>
  );
}

/** Bulanık katmanda gerçek metin yerine aynı uzunlukta rastgele harfler (göz ucuyla okunmasın) */
function scramble(t: string) {
  const letters = 'aeiklmnorstuyzbdg';
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    out += ch === ' ' || ch === '\n' ? ch : letters[(i * 7 + t.charCodeAt(i)) % letters.length];
  }
  return out;
}

export function SectionLabel({ children, color = colors.blush, center }: { children: React.ReactNode; color?: string; center?: boolean }) {
  return (
    <T v="label" color={color} center={center} numberOfLines={2}>
      {children}
    </T>
  );
}

// ─────────────────────────────────────────────────────────────
// Senkron açılış: 3 · 2 · 1 geri sayım → otomatik açılış → izleme süresi
// ─────────────────────────────────────────────────────────────
export const REVEAL_COUNT = 3;
/** Açılıştan sonra "Sonraki"nin kilitli kaldığı en kısa izleme süresi */
export const REVEAL_MIN_VIEW = 2500;
/** Partnerin "gördüm" sinyali gelmezse bu süreden sonra ilerlemeye izin verilir */
export const REVEAL_SAFETY = 6000;

/**
 * Bu cihazda turun iki cevabı da görünür olduğu an 3-2-1 geri sayımı başlatır ve
 * ardından açılışı yapar. Her tur (`roundKey`) için sıfırlanır.
 *  - `count`: 3 | 2 | 1 (geri sayım sürerken) ya da null
 *  - `revealed`: cevaplar bu cihazda açıldı
 *  - `viewed`: açılıştan sonra en az `minView` ms geçti
 *  - `revealedAt`: açılış zamanı (ilerleme dolgusu için)
 */
export function useRevealCountdown(bothAnswered: boolean, roundKey: string | number, { minView = REVEAL_MIN_VIEW }: { minView?: number } = {}) {
  const key = String(roundKey);
  const [st, setSt] = useState<{ key: string; step: number; revealedAt: number | null }>({ key, step: 0, revealedAt: null });
  const minViewRef = useRef(minView);
  useEffect(() => {
    minViewRef.current = minView;
  });

  useEffect(() => {
    if (!bothAnswered) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // step: 1..3 → ekranda 3,2,1 · 4 → açıldı · 5 → izleme süresi doldu
    const at = (ms: number, step: number) =>
      timers.push(
        setTimeout(() => {
          setSt((p) => (p.key === key && p.step >= step ? p : { key, step, revealedAt: step >= 4 ? (p.key === key && p.revealedAt) || Date.now() : null }));
          if (step <= REVEAL_COUNT) haptic.light();
        }, ms),
      );
    for (let i = 1; i <= REVEAL_COUNT; i++) at((i - 1) * 1000, i);
    at(REVEAL_COUNT * 1000, 4);
    at(REVEAL_COUNT * 1000 + minViewRef.current, 5);
    return () => timers.forEach(clearTimeout);
  }, [bothAnswered, key]);

  const step = st.key === key && bothAnswered ? st.step : 0;
  return {
    count: step >= 1 && step <= REVEAL_COUNT ? REVEAL_COUNT + 1 - step : null,
    counting: step >= 1 && step <= REVEAL_COUNT,
    revealed: step >= 4,
    viewed: step >= 5,
    revealedAt: step >= 4 ? st.revealedAt : null,
  };
}

/**
 * Geri sayım + partner senkronu. Açılınca `revealed` olayı yayınlanır; "Sonraki" ancak
 * bu cihazda izleme süresi dolmuş VE partner de açılışı görmüşse (ya da sinyal kaçtıysa
 * açılıştan `REVEAL_SAFETY` ms sonra) etkinleşir.
 */
export function useRevealGate(g: Pick<GameApi, 'markRevealed' | 'partnerRevealed'>, bothAnswered: boolean, round: number, opts: { minView?: number } = {}) {
  const rc = useRevealCountdown(bothAnswered, round, opts);
  const { markRevealed } = g;
  useEffect(() => {
    if (rc.revealed) markRevealed(round);
  }, [rc.revealed, round, markRevealed]);

  const [safeRound, setSafeRound] = useState<number | null>(null);
  useEffect(() => {
    if (!rc.revealed) return;
    const t = setTimeout(() => setSafeRound(round), REVEAL_SAFETY);
    return () => clearTimeout(t);
  }, [rc.revealed, round]);

  const partnerSeen = rc.revealed && !!g.partnerRevealed[round];
  const safety = rc.revealed && safeRound === round;
  const minView = opts.minView ?? REVEAL_MIN_VIEW;
  return {
    ...rc,
    partnerSeen,
    canAdvance: rc.viewed && (partnerSeen || safety),
    /** "Sonraki" dolgusunun tamamlanacağı an (ms, epoch) */
    unlockAt: rc.revealedAt == null ? null : rc.revealedAt + (partnerSeen || safety ? minView : REVEAL_SAFETY),
  };
}
export type RevealGate = ReturnType<typeof useRevealGate>;

/** Ekran ortasında büyük 3 · 2 · 1 geri sayımı (dokunmaları engellemez) */
export function RevealCountdown({ count, label = 'Cevaplar açılıyor…' }: { count: number | null; label?: string }) {
  const reduced = useReducedMotion();
  const fade = useState(() => new Animated.Value(0))[0];
  const pop = useState(() => new Animated.Value(1))[0];
  const visible = count != null;
  const [shown, setShown] = useState<number | null>(count);
  if (count != null && count !== shown) setShown(count);

  useEffect(() => {
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: reduced ? 120 : 220, useNativeDriver: true }).start();
  }, [visible, reduced, fade]);
  useEffect(() => {
    if (count == null) return;
    if (reduced) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    const a = Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [count, reduced, pop]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={visible ? `${label} ${count}` : undefined}
      style={[StyleSheet.absoluteFill, { opacity: fade, alignItems: 'center', justifyContent: 'center', zIndex: 20 }]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,8,11,.84)' }]} />
      <View style={{ alignItems: 'center', gap: 18 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {Array.from({ length: REVEAL_COUNT }).map((_, i) => {
            const on = shown != null && REVEAL_COUNT - i >= shown;
            return <View key={i} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: on ? colors.rose : 'rgba(255,230,240,.18)' }} />;
          })}
        </View>
        <View style={{ width: 176, height: 176, borderRadius: 88, borderWidth: 1.5, borderColor: 'rgba(244,185,200,.35)', backgroundColor: 'rgba(42,21,48,.55)', alignItems: 'center', justifyContent: 'center' }}>
          <Animated.Text
            allowFontScaling={false}
            style={{
              fontFamily: fonts.serif,
              fontSize: 128,
              lineHeight: 140,
              color: colors.pearl,
              textAlign: 'center',
              opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }],
            }}
          >
            {shown ?? ''}
          </Animated.Text>
        </View>
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 0.3, color: colors.blush }}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Türkçe "de/da" bağlacı: "Deniz de", "Ayça da" */
export function deDa(name: string) {
  const vowels = name.toLocaleLowerCase('tr-TR').match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? 'e';
  return `${name} ${'aıou'.includes(last) ? 'da' : 'de'}`;
}

/** "Deniz de gördü ✓" / "Deniz bakıyor…" */
export function SeenStatus({ gate, name }: { gate: RevealGate; name: string }) {
  // Sinyal kaçtıysa (güvenlik süresiyle açıldıysa) belirsiz durumu göstermeye gerek yok
  if (!gate.revealed || (gate.canAdvance && !gate.partnerSeen)) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 18 }}>
      {gate.partnerSeen ? null : <TypingDots />}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.semibold, fontSize: 12, color: gate.partnerSeen ? colors.success : colors.mist }}>
        {gate.partnerSeen ? `${deDa(name)} gördü ✓` : `${name} bakıyor…`}
      </Text>
    </View>
  );
}

/** 0 → 1: açılıştan `unlockAt`'e kadar dolan ilerleme */
function useUnlockProgress(gate: RevealGate) {
  const v = useState(() => new Animated.Value(0))[0];
  const { revealedAt, unlockAt, canAdvance } = gate;
  useEffect(() => {
    if (canAdvance) {
      Animated.timing(v, { toValue: 1, duration: 160, useNativeDriver: false }).start();
      return;
    }
    if (revealedAt == null || unlockAt == null) {
      v.setValue(0);
      return;
    }
    const total = Math.max(1, unlockAt - revealedAt);
    const elapsed = Math.max(0, Date.now() - revealedAt);
    const cur = Math.min(0.98, elapsed / total);
    v.setValue(cur);
    const a = Animated.timing(v, { toValue: 0.98, duration: Math.max(0, total - elapsed), easing: Easing.linear, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [revealedAt, unlockAt, canAdvance, v]);
  return v;
}

/**
 * "Sonraki" düğmesi: açılış bu cihazda tamamlanıp izleme süresi dolana ve partner de
 * görene kadar kilitli; bu sürede arka planı soldan sağa dolar.
 */
export function AdvanceButton({ gate, title, iconRight = 'arrow_forward', onPress, loading }: { gate: RevealGate; title: string; iconRight?: string; onPress: () => void; loading?: boolean }) {
  const progress = useUnlockProgress(gate);
  const locked = !gate.canAdvance;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={locked ? 'Cevapları ikiniz de gördükten sonra etkinleşir' : undefined}
      accessibilityState={{ disabled: locked || !!loading, busy: !!loading }}
      disabled={locked || loading}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        height: 56,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: locked ? 'rgba(246,238,241,.08)' : colors.pearl,
        borderWidth: locked ? 1 : 0,
        borderColor: colors.lineStrong,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 24,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {locked ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(246,238,241,.16)', width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.onRose} />
      ) : (
        <>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: 16, color: locked ? colors.pearlSoft : colors.onRose }}>
            {title}
          </Text>
          <Icon name={iconRight} size={20} color={locked ? colors.pearlSoft : colors.onRose} />
        </>
      )}
    </Pressable>
  );
}
