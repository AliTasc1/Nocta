import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '@/theme';

// ─────────────────────────────────────────────────────────────
// İkon — Material Symbols adlarını (alt çizgili) MaterialIcons'a eşler
// ─────────────────────────────────────────────────────────────
const ICON_ALIASES: Record<string, string> = {
  playing_cards: 'style',
  shield_lock: 'lock',
  shield_person: 'verified-user',
  qr_code_2: 'qr-code-2',
};

export function Icon({ name, size = 24, color = colors.pearl, style }: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const mapped = ICON_ALIASES[name] ?? name.replace(/_/g, '-');
  const glyph = (MaterialIcons.glyphMap as Record<string, number>)[mapped] ? mapped : 'favorite';
  return <MaterialIcons name={glyph as any} size={size} color={color} style={style} />;
}

// ─────────────────────────────────────────────────────────────
// Tipografi
// ─────────────────────────────────────────────────────────────
type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodySm' | 'caption' | 'label' | 'mono' | 'button';

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.serif, fontSize: 56, lineHeight: 54, letterSpacing: -1, color: colors.pearl },
  h1: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 42, letterSpacing: -0.5, color: colors.pearl },
  h2: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 34, color: colors.pearl },
  h3: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 29, color: colors.pearl },
  title: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23, color: colors.pearl },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23, color: colors.pearlSoft },
  bodySm: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.mist },
  caption: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.mist },
  label: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1.6, color: colors.blush },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, color: colors.pearl },
  button: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.onRose },
};

export function T({ v = 'body', color, italic, center, style, ...rest }: TextProps & { v?: Variant; color?: string; italic?: boolean; center?: boolean }) {
  const base = variantStyle[v];
  const it = italic && (v === 'display' || v === 'h1' || v === 'h2' || v === 'h3') ? { fontFamily: fonts.serifItalic } : null;
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[base, it, color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    />
  );
}

/** "Tonight is <i>yours.</i>" gibi başlıklar: düz + italik pembe vurgu */
export function SerifTitle({ text, accent, v = 'h1', center, accentColor = colors.blush, style }: { text: string; accent?: string; v?: Variant; center?: boolean; accentColor?: string; style?: StyleProp<TextStyle> }) {
  return (
    <T v={v} center={center} style={style}>
      {text}
      {accent ? (
        <Text style={{ fontFamily: fonts.serifItalic, color: accentColor }}>{text ? ' ' : ''}{accent}</Text>
      ) : null}
    </T>
  );
}

// ─────────────────────────────────────────────────────────────
// Düğmeler
// ─────────────────────────────────────────────────────────────
type BtnKind = 'primary' | 'light' | 'ghost' | 'outline' | 'success' | 'danger' | 'disabled';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  iconRight,
  loading,
  disabled,
  size = 'lg',
  style,
  glow,
  ...rest
}: Omit<PressableProps, 'style'> & {
  title: string;
  kind?: BtnKind;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
}) {
  const off = disabled || loading;
  const k: BtnKind = disabled ? 'disabled' : kind;
  const bg = { primary: colors.rose, light: colors.pearl, ghost: 'transparent', outline: 'transparent', success: colors.success, danger: colors.errorTint, disabled: colors.disabled }[k];
  const fg = { primary: colors.onRose, light: colors.onRose, ghost: colors.pearl, outline: colors.pearl, success: colors.onSuccess, danger: colors.error, disabled: colors.disabledText }[k];
  const h = size === 'lg' ? 56 : size === 'md' ? 48 : 40;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={(e) => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          height: h,
          minWidth: 44,
          paddingHorizontal: size === 'sm' ? 16 : 24,
          borderRadius: radius.pill,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: k === 'outline' ? 1 : 0,
          borderColor: colors.lineHeavy,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        glow && k === 'primary' ? styles.glow : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[variantStyle.button, { color: fg, fontSize: size === 'sm' ? 14 : 16, flexShrink: 1 }]}>
            {title}
          </Text>
          {iconRight ? <Icon name={iconRight} size={20} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color = colors.pearl, bg = colors.whiteFaint, size = 44, badge, label, disabled }: { name: string; onPress?: () => void; color?: string; bg?: string; size?: number; badge?: number; label: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={name} size={Math.round(size * 0.5)} color={color} />
      {badge ? <Badge n={badge} style={{ position: 'absolute', top: -2, right: -2 }} /> : null}
    </Pressable>
  );
}

export function Badge({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Yerleşim
// ─────────────────────────────────────────────────────────────

/**
 * Sekme (tabs) sahnesinde miyiz? (tabs)/_layout bunu `true` sağlar.
 * Sekme ekranlarında alt güvenli alanı özel sekme çubuğu zaten kapsar; diğer
 * tüm ekranlarda alt boşluk (Android gezinme çubuğu / iOS ev çizgisi) Screen'de uygulanır.
 */
export const TabSceneContext = React.createContext(false);

/**
 * Ekran iskeleti.
 *  - `footer` (ana eylem düğmeleri) ScrollView'un İÇİNDE, içeriğin sonunda durur:
 *    içerik kısaysa `marginTop: 'auto'` ile en alta yaslanır, uzunsa içerikle birlikte kayar.
 *    Böylece küçük ekranlarda ya da klavye açıkken düğme asla sıkışıp erişilemez olmaz.
 *  - Alt güvenli alan her zaman uygulanır (sekme ekranlarında sekme çubuğu kapsar).
 *  - `keyboard`: klavye açıldığında görünür alan klavyenin üstüne daralır. KeyboardAvoidingView
 *    yalnızca GERÇEKTEN örtüşen yükseklik kadar dolgu ekler; Android pencereyi zaten
 *    küçültmüşse (softwareKeyboardLayoutMode: resize) örtüşme 0 olur, çift boşluk oluşmaz.
 */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  padded = true,
  refreshing,
  onRefresh,
  contentStyle,
  keyboard,
  footer,
  bg,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  footer?: React.ReactNode;
  bg?: React.ReactNode;
}) {
  const inTabs = React.useContext(TabSceneContext);
  const insets = useSafeAreaInsets();
  // Alt kenarı SafeAreaView yerine kendimiz uygularız (kaydırılan içeriğin sonuna eklenir)
  const safeEdges = edges.filter((e) => e !== 'bottom');
  const bottomInset = inTabs ? 0 : insets.bottom;
  const pad = padded ? { paddingHorizontal: 20 } : null;
  const flat = StyleSheet.flatten(contentStyle) ?? {};
  const basePadBottom = typeof flat.paddingBottom === 'number' ? flat.paddingBottom : footer ? 16 : 32;
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ flexGrow: 1 }, pad, contentStyle, { paddingBottom: basePadBottom + bottomInset }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl tintColor={colors.blush} refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, paddingBottom: bottomInset }}>
      <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      {footer ? <View style={[{ paddingTop: 12, paddingBottom: 16 }, pad]}>{footer}</View> : null}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      {bg}
      <SafeAreaView edges={safeEdges} style={{ flex: 1 }}>
        {keyboard ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" enabled={Platform.OS !== 'web'}>
            {body}
          </KeyboardAvoidingView>
        ) : (
          body
        )}
      </SafeAreaView>
    </View>
  );
}

/** Tasarımdaki radyal şarap/erik ışıltısı arka planı */
export function GlowBackground({ variant = 'default' }: { variant?: 'default' | 'center' | 'bottom' }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={variant === 'bottom' ? ['transparent', 'rgba(107,30,56,.45)'] : ['rgba(107,30,56,.55)', 'rgba(12,8,11,0)']}
        start={{ x: variant === 'center' ? 0.5 : 0.9, y: 0 }}
        end={{ x: 0.3, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(58,23,64,0)', 'rgba(58,23,64,.55)']}
        start={{ x: 0.8, y: 0.4 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function Header({ title, accent, onBack, right, label }: { title?: string; accent?: string; onBack?: () => void; right?: React.ReactNode; label?: string }) {
  return (
    <View style={{ paddingTop: 8, paddingBottom: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        {onBack ? <IconButton name="arrow_back" label="Geri" onPress={onBack} /> : <View style={{ width: 44 }} />}
        {label ? <T v="label" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: 8 }}>{label}</T> : <View style={{ flex: 1 }} />}
        <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
      </View>
      {title ? <SerifTitle text={title} accent={accent} v="h1" /> : null}
    </View>
  );
}

export function Card({ children, style, onPress, glow, accessibilityLabel }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; glow?: boolean; accessibilityLabel?: string }) {
  const content = [styles.card, glow ? styles.glowSoft : null, style];
  if (!onPress) return <View style={content}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [content, { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

/** Radyal renk geçişli oyun kartı zemini (tasarım: radial-gradient(… g.c 0%, #171016 65%)) */
export function TintCard({ color, children, style, onPress, accessibilityLabel }: { color: string; children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const inner = (
    <>
      <LinearGradient colors={[color, colors.velvet]} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={StyleSheet.absoluteFill} />
      {children}
    </>
  );
  const base: StyleProp<ViewStyle> = [styles.tint, style];
  if (!onPress) return <View style={base}>{inner}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [base, { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    >
      {inner}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, icon, tone = 'rose' }: { label: string; active?: boolean; onPress?: () => void; icon?: string; tone?: 'rose' | 'light' }) {
  const bg = active ? (tone === 'light' ? colors.pearl : colors.roseTint) : colors.whiteFaint;
  const fg = active ? (tone === 'light' ? colors.onRose : colors.blush) : colors.mist;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: bg, borderWidth: 1, borderColor: active && tone === 'rose' ? colors.rose : colors.line, flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ text, tone = 'rose', style }: { text: string; tone?: 'rose' | 'ok' | 'warn' | 'bad' | 'pro' | 'mute' | 'light'; style?: StyleProp<ViewStyle> }) {
  const T_ = {
    rose: [colors.roseTintStrong, colors.blush],
    ok: [colors.successTint, colors.success],
    warn: [colors.warningTint, colors.warning],
    bad: [colors.errorTint, colors.error],
    pro: ['rgba(168,139,240,.16)', colors.irisSoft],
    mute: ['rgba(255,255,255,.06)', colors.mist],
    light: [colors.pearl, colors.onRose],
  }[tone];
  return (
    <View style={[{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: T_[0], alignSelf: 'flex-start' }, style]}>
      <Text style={{ fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: 0.4, color: T_[1] }}>{text}</Text>
    </View>
  );
}

export function Avatar({ name, color = colors.plum, size = 40, ring }: { name?: string | null; color?: string; size?: number; ring?: string }) {
  const initial = (name ?? '?').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: ring ? 2 : 1,
        borderColor: ring ?? colors.lineStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.46, color: colors.pearl }}>{initial}</Text>
    </View>
  );
}

export function AvatarPair({ a, b, size = 38 }: { a: { name?: string | null; color?: string }; b?: { name?: string | null; color?: string } | null; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <Avatar name={a.name} color={a.color} size={size} ring={colors.velvet} />
      {b ? (
        <View style={{ marginLeft: -size * 0.3 }}>
          <Avatar name={b.name} color={b.color} size={size} ring={colors.velvet} />
        </View>
      ) : null}
    </View>
  );
}

export function Field({ label, error, hint, right, style, inputStyle, ...rest }: TextInputProps & { label?: string; error?: string | null; hint?: string; right?: React.ReactNode; inputStyle?: StyleProp<TextStyle>; ref?: React.Ref<TextInput> }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={[{ gap: 8 }, style as any]}>
      {label ? <T v="caption" color={colors.mist}>{label}</T> : null}
      <View
        style={{
          minHeight: 54,
          borderRadius: radius.md,
          backgroundColor: colors.velvet,
          borderWidth: 1,
          borderColor: error ? colors.error : focus ? colors.rose : colors.lineStrong,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          gap: 8,
        }}
      >
        <TextInput
          placeholderTextColor={colors.mute}
          selectionColor={colors.rose}
          cursorColor={colors.rose}
          maxFontSizeMultiplier={1.3}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          {...rest}
          style={[{ flex: 1, minHeight: 52, color: colors.pearl, fontFamily: fonts.semibold, fontSize: 16, paddingVertical: 12 }, inputStyle]}
        />
        {right}
      </View>
      {error ? <T v="caption" color={colors.error}>{error}</T> : hint ? <T v="caption" color={colors.mute}>{hint}</T> : null}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onChange(!value);
      }}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? colors.rose : colors.disabled, justifyContent: 'center', alignItems: value ? 'flex-end' : 'flex-start' }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? '#FFFFFF' : colors.mist }} />
    </Pressable>
  );
}

export function Row({ icon, title, value, onPress, danger, right, subtitle }: { icon: string; title: string; value?: string; onPress?: () => void; danger?: boolean; right?: React.ReactNode; subtitle?: string }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name={icon} size={22} color={danger ? colors.error : colors.mist} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="title" style={{ fontSize: 15.5 }} color={danger ? colors.error : colors.pearl} numberOfLines={1}>{title}</T>
        {subtitle ? <T v="caption" color={colors.mute}>{subtitle}</T> : null}
      </View>
      {value ? <T v="bodySm" numberOfLines={1} style={{ maxWidth: '45%' }}>{value}</T> : null}
      {right ?? (onPress ? <Icon name="chevron_right" size={22} color={colors.mute} /> : null)}
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.ink, padding: 24 }}>
      <ActivityIndicator size="large" color={colors.rose} />
      {label ? <T v="bodySm" center>{label}</T> : null}
    </View>
  );
}

/** Tasarım sistemindeki boş / hata durumları */
export function EmptyState({ icon, title, desc, action, onAction, tone = 'rose', secondary, onSecondary }: { icon: string; title: string; desc?: string; action?: string; onAction?: () => void; tone?: 'rose' | 'iris' | 'error' | 'warn' | 'mute'; secondary?: string; onSecondary?: () => void }) {
  const t = {
    rose: [colors.roseTintStrong, colors.blush],
    iris: [colors.irisTint, colors.irisSoft],
    error: [colors.errorTint, colors.error],
    warn: [colors.warningTint, colors.warning],
    mute: ['rgba(255,255,255,.06)', colors.mist],
  }[tone];
  return (
    <View style={{ alignItems: 'center', gap: 14, paddingVertical: 32, paddingHorizontal: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t[0], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} color={t[1]} />
      </View>
      <T v="h3" center>{title}</T>
      {desc ? <T v="bodySm" center style={{ maxWidth: 320 }}>{desc}</T> : null}
      {action ? <Button title={action} onPress={onAction} size="md" style={{ marginTop: 6, alignSelf: 'center' }} /> : null}
      {secondary ? <Button title={secondary} onPress={onSecondary} kind="ghost" size="sm" /> : null}
    </View>
  );
}

export function SectionTitle({ label, title, accent, right }: { label?: string; title?: string; accent?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <View style={{ flex: 1, gap: 6 }}>
        {label ? <T v="label">{label}</T> : null}
        {title ? <SerifTitle text={title} accent={accent} v="h3" /> : null}
      </View>
      {right}
    </View>
  );
}

export function ProgressBar({ value, color = colors.rose, height = 6, track = 'rgba(255,255,255,.08)' }: { value: number; color?: string; height?: number; track?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { shadowColor: colors.rose, shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  glowSoft: { shadowColor: colors.rose, shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  card: { backgroundColor: colors.velvet, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 18 },
  tint: { borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, padding: 20 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.rose, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 10, color: colors.onRose },
  footer: { marginTop: 'auto', paddingTop: 20, gap: 8 },
});
