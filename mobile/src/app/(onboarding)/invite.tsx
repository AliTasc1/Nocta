import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Share, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useDialog } from '@/components/Dialog';
import { StepBar } from '@/components/LevelPicker';
import { Rings } from '@/components/Rings';
import { Button, EmptyState, GlowBackground, Icon, IconButton, Screen, SerifTitle, T } from '@/components/ui';
import { getPendingJoin, inviteLink } from '@/lib/pendingJoin';
import { errorText, supabase } from '@/lib/supabase';
import type { Couple } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';

export default function Invite() {
  const { profile, couple, refreshCouple, updateProfile } = useApp();
  const toast = useToast();
  const { dialog, ask } = useDialog();
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const onboarded = !!profile?.onboarded;
  const [local, setRoom] = useState<Couple | null>(null);
  const room = local ?? (couple?.status === 'pending' ? couple : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!room);
  const [refreshing, setRefreshing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const navigated = useRef(false);

  const goConnected = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace('/connected');
  }, []);

  // Partner katıldı → kutlama
  const hadRoom = useRef(!!room);
  useEffect(() => {
    if (couple?.status === 'active') {
      // Zaten bağlı ve uygulamayı kullanan biri bu ekrana geldiyse doğrudan ana sayfa
      if (onboarded && !hadRoom.current && !navigated.current) {
        navigated.current = true;
        router.replace('/');
      } else goConnected();
    } else if (couple?.status === 'pending') {
      hadRoom.current = true;
    }
  }, [couple, goConnected, onboarded]);

  const create = useCallback(async () => {
    try {
      const pending = await getPendingJoin();
      if (pending) {
        router.replace({ pathname: '/join', params: { code: pending } });
        return;
      }
      const { data, error: e } = await supabase.rpc('create_couple');
      if (e) throw e;
      const c = data as Couple;
      if (c.status === 'active') {
        await refreshCouple();
        goConnected();
        return;
      }
      hadRoom.current = true;
      setRoom(c);
      refreshCouple().catch(() => {});
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [refreshCouple, goConnected]);

  const retry = () => {
    setError(null);
    setLoading(true);
    create();
  };

  useEffect(() => {
    if (couple?.status !== 'active') create();
    // yalnızca ilk açılışta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bu odaya özel realtime aboneliği (AppProvider'a ek güvence)
  useEffect(() => {
    if (!room?.id) return;
    const ch = supabase
      .channel(`invite:${room.id}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${room.id}` }, (p) => {
        const row = p.new as Couple;
        if (row.status === 'active') refreshCouple().finally(goConnected);
        else setRoom(row);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [room?.id, refreshCouple, goConnected]);

  const code = room?.invite_code ?? '';
  const link = code ? inviteLink(code) : '';

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      toast.show('Oda kodu kopyalandı.', 'ok');
    } catch {
      toast.show('Kopyalanamadı. Kodu elle yazabilirsin.', 'error');
    }
  };

  const share = async () => {
    try {
      await Share.share({
        message: `Nocta'da özel odamıza katıl ♡\n\nOda kodu: ${code}\n${link}\n\nUygulamayı açıp "Kodum var · Katıl" bölümüne kodu yazman yeterli.`,
      });
    } catch {
      toast.show('Paylaşım açılamadı.', 'error');
    }
  };

  const renew = () =>
    ask({
      icon: 'refresh',
      title: 'Kodu yenile?',
      desc: 'Eski kod hemen geçersiz olur. Partnerine yeni kodu göndermen gerekir.',
      actions: [
        {
          label: 'Yenile',
          onPress: async () => {
            setRefreshing(true);
            try {
              const { data, error: e } = await supabase.rpc('refresh_invite_code');
              if (e) throw e;
              setRoom(data as Couple);
              toast.show('Yeni oda kodu hazır.', 'ok');
            } finally {
              setRefreshing(false);
            }
          },
        },
        { label: 'Vazgeç', kind: 'ghost' },
      ],
    });

  const skip = async () => {
    setSkipping(true);
    try {
      await updateProfile({ onboarded: true });
      router.replace('/');
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setSkipping(false);
    }
  };

  const qrSize = compact ? 132 : 168;

  return (
    <Screen edges={['top', 'bottom']} bg={<GlowBackground variant="center" />} contentStyle={{ paddingHorizontal: 24, paddingTop: 12, gap: compact ? 16 : 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton name={onboarded ? 'close' : 'arrow_back'} label={onboarded ? 'Kapat' : 'Geri'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1 }}>{onboarded ? <T v="label" center style={{ marginRight: 44 }}>PARTNER DAVETİ</T> : <StepBar step={4} total={4} />}</View>
      </View>
      <SerifTitle text="Partnerini" accent="davet et." v="h1" />

      {error ? (
        <EmptyState icon="wifi_off" tone="warn" title="Oda oluşturulamadı" desc={error} action="Tekrar dene" onAction={retry} />
      ) : loading || !room ? (
        <View style={{ height: 280, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.rose} size="large" />
          <T v="bodySm">Özel odan hazırlanıyor…</T>
        </View>
      ) : (
        <>
          <View style={{ padding: compact ? 18 : 24, borderRadius: 28, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', gap: compact ? 14 : 18 }}>
            <View style={{ padding: 12, borderRadius: 20, backgroundColor: colors.pearl }} accessible accessibilityLabel={`QR kod: ${code}`}>
              <QRCode value={link} size={qrSize} color={colors.onRose} backgroundColor={colors.pearl} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <T v="caption">Oda kodu</T>
              <Text
                selectable
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.1}
                style={{ fontFamily: fonts.monoMedium, fontSize: compact ? 28 : 32, letterSpacing: 4, color: colors.pearl }}
              >
                {code}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="schedule" size={16} color={colors.warning} />
              <T v="caption" color={colors.warning} style={{ flexShrink: 1 }}>Tek kullanımlık · partnerin katılınca kapanır</T>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Kopyala" accessibilityLabel="Oda kodunu kopyala" icon="content_copy" kind="outline" size="md" style={{ flex: 1, paddingHorizontal: 12 }} onPress={copy} />
            <Button title="Yenile" accessibilityLabel="Oda kodunu yenile" icon="refresh" kind="outline" size="md" style={{ flex: 1, paddingHorizontal: 12 }} loading={refreshing} onPress={renew} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Rings size={26} color="rgba(242,194,123,.7)" />
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning }} />
            </View>
            <T v="bodySm" style={{ flex: 1 }}>Partnerinin katılması bekleniyor…</T>
          </View>
        </>
      )}

      <View style={{ marginTop: 'auto', gap: 6 }}>
        <Button title="Davet Linki Gönder" icon="ios_share" disabled={!room} onPress={share} />
        <Button title="Kodum var · Katıl" kind="ghost" size="md" onPress={() => router.push('/join')} />
        {!onboarded ? <Button title="Şimdilik atla" kind="ghost" size="sm" loading={skipping} onPress={skip} /> : null}
      </View>
      {dialog}
    </Screen>
  );
}
