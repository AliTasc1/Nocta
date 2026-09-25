import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Icon, T } from '@/components/ui';
import type { Question } from '@/lib/types';
import { colors, fonts, LEVELS } from '@/theme';

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

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
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
export function GameLayout({ top, children, footer, bg, contentStyle, scroll = true, keyboard }: { top: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; bg?: React.ReactNode; contentStyle?: StyleProp<ViewStyle>; scroll?: boolean; keyboard?: boolean }) {
  const insets = useSafeAreaInsets();
  const { compact } = useCompact();
  const gap = compact ? 12 : 18;
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      {bg}
      <KeyboardAvoidingView
        enabled={!!keyboard && Platform.OS === 'ios'}
        behavior="padding"
        style={{ flex: 1, paddingTop: insets.top + 6, paddingLeft: insets.left, paddingRight: insets.right }}
      >
        <View style={{ paddingHorizontal: 20 }}>{top}</View>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[{ flexGrow: 1, paddingHorizontal: 20, paddingTop: gap, paddingBottom: 12, gap }, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingHorizontal: 20, paddingTop: gap, paddingBottom: 12, gap }, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 4, gap: 8 }}>{footer}</View> : <View style={{ height: Math.max(insets.bottom, 12) }} />}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Radyal ışıltı taklidi: merkezde yumuşak renk halkası */
export function RadialGlow({ color, top = '45%', size = 1.1, left = '50%' }: { color: string; top?: `${number}%`; size?: number; left?: `${number}%` }) {
  const { width } = useWindowDimensions();
  const d = width * size;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', top, left, width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, borderRadius: d / 2, backgroundColor: color, opacity: 0.55, transform: [{ scaleY: 0.8 }] }} />
      <View style={{ position: 'absolute', top, left, width: d * 1.5, height: d * 1.5, marginLeft: -d * 0.75, marginTop: -d * 0.75, borderRadius: d * 0.75, backgroundColor: color, opacity: 0.18 }} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,8,11,.35)' }]} />
    </View>
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

/** Yuvarlak "sonraki" düğmesi */
export function NextFab({ onPress, loading, label = 'Sonraki' }: { onPress: () => void; loading?: boolean; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.pearl, alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.6 : pressed ? 0.85 : 1 })}
    >
      <Icon name="arrow_forward" size={24} color={colors.onRose} />
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
