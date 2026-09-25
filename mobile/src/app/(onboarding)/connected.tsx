import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { effectiveLevel, levelName } from '@/components/LevelPicker';
import { Rings } from '@/components/Rings';
import { Button, Icon, Screen, SerifTitle, T } from '@/components/ui';
import { errorText } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';

function RingAvatar({ name, color, size, reverse }: { name?: string | null; color?: string; size: number; reverse?: boolean }) {
  const initial = (name ?? '?').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <LinearGradient colors={reverse ? [colors.iris, colors.rose] : [colors.rose, colors.iris]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, padding: 2 }}>
      <View style={{ flex: 1, borderRadius: size / 2, backgroundColor: color ?? colors.plum, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.42, color: colors.pearl }}>{initial}</Text>
      </View>
    </LinearGradient>
  );
}

/** Yükselen küçük kalpler */
function FloatingHearts() {
  const [hearts] = useState(() => Array.from({ length: 6 }, () => new Animated.Value(0)));
  useEffect(() => {
    const loops = hearts.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 450),
          Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [hearts]);
  const xs = [-110, -60, -20, 30, 75, 115];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {hearts.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '60%',
            opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.9, 0.5, 0] }),
            transform: [
              { translateX: xs[i] },
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) },
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) },
            ],
          }}
        >
          <Icon name="favorite" size={i % 2 ? 14 : 18} color={i % 3 ? colors.rose : colors.blush} />
        </Animated.View>
      ))}
    </View>
  );
}

export default function Connected() {
  const { profile, partner, couple, isPremium, updateProfile, refreshCouple } = useApp();
  const { settings } = useContent();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const [busy, setBusy] = useState<'go' | 'profile' | null>(null);
  const size = compact ? 80 : 96;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!partner) refreshCouple().catch(() => {});
    // yalnızca ilk açılışta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (target: 'go' | 'profile') => {
    setBusy(target);
    try {
      if (!profile?.onboarded) await updateProfile({ onboarded: true });
      router.replace('/');
      if (target === 'profile') setTimeout(() => router.push('/edit-profile'), 50);
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const level = effectiveLevel(profile?.level, partner?.level, isPremium, settings.free_max_level);
  const names = [profile?.display_name, partner?.display_name].filter(Boolean).join(' & ');

  return (
    <Screen
      edges={['top', 'bottom']}
      bg={
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient colors={['rgba(12,8,11,0)', 'rgba(231,104,138,.22)', 'rgba(12,8,11,0)']} locations={[0.15, 0.42, 0.7]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(58,23,64,0)', 'rgba(58,23,64,.7)']} start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        </View>
      }
      contentStyle={{ paddingHorizontal: 24, paddingTop: 12 }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: compact ? 28 : 40 }}>
        <View style={{ width: '100%', height: compact ? 180 : 220, alignItems: 'center', justifyContent: 'center' }}>
          <Rings size={compact ? 180 : 220} />
          <FloatingHearts />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <RingAvatar name={profile?.display_name} color={profile?.avatar_color} size={size} />
            <LinearGradient colors={[colors.rose, colors.iris]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: compact ? 40 : 56, height: 2 }} />
            <RingAvatar name={partner?.display_name ?? '?'} color={partner?.avatar_color ?? colors.plumRose} size={size} reverse />
          </View>
          <View style={{ position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pearl, alignItems: 'center', justifyContent: 'center', shadowColor: colors.rose, shadowOpacity: 0.6, shadowRadius: 20, elevation: 6 }}>
            <Icon name="favorite" size={20} color={colors.rose} />
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <SerifTitle text="Artık" accent="bağlandınız." v="display" center style={{ fontSize: compact ? 44 : 52, lineHeight: compact ? 46 : 54 }} />
          <T v="body" center color={colors.pearlSoft}>
            {names ? `${names} · özel odanız hazır.` : 'Özel odanız hazır.'}
          </T>
          <T v="bodySm" center>
            Ortak seviye: <T v="bodySm" color={colors.blush} style={{ fontWeight: '700' }}>{levelName(level)}</T>
            {couple?.status === 'active' ? '' : ' · bağlantı doğrulanıyor…'}
          </T>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Button title="İlk oyunu seç" glow loading={busy === 'go'} disabled={busy === 'profile'} onPress={() => finish('go')} />
        <Button title="Önce profilimi tamamla" kind="ghost" size="md" loading={busy === 'profile'} disabled={busy === 'go'} onPress={() => finish('profile')} />
      </View>
    </Screen>
  );
}
