import * as Haptics from 'expo-haptics';
import { router, usePathname, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActiveSession } from '@/lib/useActiveSession';
import { usePartnerAlerts } from '@/lib/usePartnerAlerts';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { colors, radius } from '@/theme';
import { Pulse, Rings } from './Rings';
import { Avatar, Button, Icon, T } from './ui';

/**
 * Küresel "partner çağrısı":
 *  - Realtime bildirim/mesaj olaylarında sesli yerel bildirim (usePartnerAlerts),
 *  - partner uygulama açıkken yeni bir oyun başlattığında her ekranda (o oyunun
 *    lobisi/oyunu hariç) "Deniz seni oyuna çağırıyor" kartı: Katıl / Sonra.
 * Ana sayfadaki davet bandı (useActiveSession) kalıcı yedek olarak durur.
 */
export function PartnerCall() {
  const { userId, partner } = useApp();
  const { gameById } = useContent();
  const { session } = useActiveSession();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  /** Uygulama açıkken "çalan" (canlı gelen) davetler */
  const [ringing, setRinging] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const onInvite = useCallback((sid: string) => {
    setRinging((cur) => (cur.has(sid) ? cur : new Set(cur).add(sid)));
  }, []);
  usePartnerAlerts(onInvite);

  // Çağrı, oturum hâlâ lobideyse ve ben henüz hazır değilsem geçerli
  const invite =
    session &&
    session.status === 'lobby' &&
    session.created_by !== userId &&
    !(session.ready ?? []).includes(userId ?? '') &&
    ringing.has(session.id) &&
    !dismissed.has(session.id)
      ? session
      : null;
  const group = segments[0] as string | undefined;
  const hiddenHere =
    !invite ||
    group === '(auth)' ||
    group === '(onboarding)' ||
    pathname === `/lobby/${invite.id}` ||
    pathname === `/play/${invite.id}`;
  const visible = !!invite && !hiddenHere;

  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
    if (!visible) return;
    // Telefon çalar gibi: birkaç titreşim
    const timers = [0, 900, 1800].map((ms) =>
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [visible, anim]);

  if (!visible || !invite) return null;

  const dismiss = () => setDismissed((cur) => new Set(cur).add(invite.id));
  const join = () => {
    dismiss();
    router.push(`/lobby/${invite.id}` as any);
  };
  const name = partner?.display_name ?? 'Partnerin';
  const gameName = gameById(invite.game_id)?.name ?? 'Yeni oyun';

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50, elevation: 50 }]} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Sonra" onPress={dismiss} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,5,10,.72)' }]} />
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}>
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
            borderColor: 'rgba(231,104,138,.45)',
            padding: 24,
            gap: 16,
            alignItems: 'center',
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          }}
        >
          <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <Rings size={110} />
            <Pulse>
              <Avatar name={partner?.display_name} color={partner?.avatar_color} size={72} ring={colors.rose} />
            </Pulse>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="playing_cards" size={16} color={colors.blush} />
            <T v="label">OYUN DAVETİ</T>
          </View>
          <T v="h3" center style={{ fontSize: 26, lineHeight: 30 }}>{`${name} seni oyuna çağırıyor`}</T>
          <T v="bodySm" center color={colors.pearlSoft}>{`${gameName} · lobide seni bekliyor`}</T>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
            <Button title="Katıl" icon="play_arrow" glow onPress={join} />
            <Button title="Sonra" kind="ghost" size="md" onPress={dismiss} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
