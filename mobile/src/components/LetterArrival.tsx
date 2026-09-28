import * as Haptics from 'expo-haptics';
import { router, usePathname, useSegments } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { play } from '@/lib/sfx';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { colors, radius } from '@/theme';
import { Rings } from './Rings';
import { Button, Icon, T } from './ui';

/** LottieFiles "Message in a bottle" — dalgada sallanan şişe */
const BOTTLE_LOTTIE = require('../../assets/lottie/bottle.json');

/**
 * Küresel "mektup geldi" kartı.
 * Sistem bildirimi (özellikle Android Expo Go'da uygulama kapalıyken) her zaman gösterilemediği için,
 * okunmamış teslim edilmiş bir mektup olduğunda her ekranda (mektup ekranları ve oyun hariç) büyük bir
 * kart açılır: "Deniz sana bir mektup gönderdi · Şimdi oku / Sonra".
 * Kontrol: uygulama açılışında, uygulama ön plana her gelişte, Realtime olayında ve ön plandayken dakikada bir.
 */
export function LetterArrival() {
  const { userId, partner, couple } = useApp();
  const active = couple?.status === 'active';
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<string | null>(null);
  // "Sonra" denen mektuplar bu oturumda tekrar sorulmaz (bir sonraki açılışta yeniden hatırlatılır)
  const dismissed = useRef(new Set<string>());

  const check = useCallback(async () => {
    if (!userId || !active) return;
    const { data } = await supabase
      .from('letters')
      .select('id')
      .eq('recipient_id', userId)
      .not('delivered_at', 'is', null)
      .is('read_at', null)
      .order('delivered_at', { ascending: false })
      .limit(10);
    const next = (data ?? []).map((r: { id: string }) => r.id).find((id) => !dismissed.current.has(id)) ?? null;
    setPending(next);
  }, [userId, active]);

  useEffect(() => {
    if (!userId || !active) return;
    check();
    const ch = supabase
      .channel(`letter-arrival:${userId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters', filter: `recipient_id=eq.${userId}` }, () => {
        check();
      })
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    // Realtime koparsa diye yedek: ön plandayken dakikada bir
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, 60_000);
    return () => {
      supabase.removeChannel(ch);
      sub.remove();
      clearInterval(timer);
    };
  }, [userId, active, check]);

  const group = segments[0] as string | undefined;
  const hiddenHere =
    group === '(auth)' ||
    group === '(onboarding)' ||
    pathname.startsWith('/letters') ||
    pathname.startsWith('/play/') ||
    pathname.startsWith('/lobby/');
  const visible = !!pending && !hiddenHere;

  const [anim] = useState(() => new Animated.Value(0));
  const announced = useRef<string | null>(null);
  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
    if (!visible || announced.current === pending) return;
    announced.current = pending;
    play('letter_arrive');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible, pending, anim]);

  if (!visible || !pending) return null;

  const later = () => {
    dismissed.current.add(pending);
    setPending(null);
  };
  const read = () => {
    const id = pending;
    later();
    router.push(`/letters/${id}` as any);
  };
  const name = partner?.display_name || 'Partnerin';

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 49, elevation: 49 }]} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Sonra" onPress={later} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,5,10,.72)' }]} />
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
          pointerEvents: 'box-none',
        }}
      >
        <Animated.View
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={{
            maxWidth: 420,
            width: '100%',
            alignSelf: 'center',
            borderRadius: radius.lg + 6,
            backgroundColor: colors.dusk,
            borderWidth: 1,
            borderColor: 'rgba(233,196,106,.45)',
            padding: 24,
            gap: 16,
            alignItems: 'center',
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          }}
        >
          <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
            <Rings size={140} />
            <LottieView source={BOTTLE_LOTTIE} autoPlay loop style={{ width: 150, height: 150 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="water" size={16} color={colors.blush} />
            <T v="label">SEVGİLİYE MEKTUP</T>
          </View>
          <T v="h3" center style={{ fontSize: 26, lineHeight: 30 }}>{`${name} sana bir mektup gönderdi`}</T>
          <T v="bodySm" center color={colors.pearlSoft}>
            Okyanusun öbür ucundan bir şişe kıyına vurdu. Mühür hâlâ kapalı…
          </T>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
            <Button title="Şimdi oku" icon="drafts" glow onPress={read} />
            <Button title="Sonra" kind="ghost" size="md" onPress={later} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
