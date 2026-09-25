import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useDialog } from '@/components/Dialog';
import { Button, Icon, IconButton, Screen, T } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { formatPrice, getOfferings, purchase, restore, STORE_MESSAGE, type Plan, type PlanId } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import type { Subscription } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { colors, fonts } from '@/theme';

const PERKS = [
  { i: 'playing_cards', t: 'Tüm oyunlar ve özel kategoriler' },
  { i: 'movie', t: 'Hikâye Modu' },
  { i: 'local_fire_department', t: 'Cesur ve Vahşi seviyeleri' },
  { i: 'style', t: 'Özel soru ve görev paketleri' },
  { i: 'all_inclusive', t: 'Sınırsız sohbet görevi' },
  { i: 'favorite', t: 'Tek abonelik, ikinizi de kapsar' },
];

const PLAN_TR: Record<Subscription['plan'], string> = { monthly: 'Aylık', yearly: 'Yıllık', lifetime: 'Ömür boyu', gift: 'Hediye' };
const STATUS_TR: Record<Subscription['status'], string> = { trial: 'Deneme', active: 'Aktif', canceled: 'İptal edildi · süre sonuna kadar aktif', expired: 'Sona erdi', billing_issue: 'Ödeme sorunu' };

export default function Premium() {
  const { isPremium, userId, couple, refreshPremium } = useApp();
  const { settings } = useContent();
  const { dialog, ask } = useDialog();
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plan, setPlan] = useState<PlanId>('yearly');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    getOfferings(settings.prices).then(setPlans);
  }, [settings.prices]);

  useEffect(() => {
    if (!isPremium || !userId) return;
    let q = supabase.from('subscriptions').select('*').in('status', ['trial', 'active', 'canceled', 'billing_issue']).order('expires_at', { ascending: false, nullsFirst: true }).limit(1);
    q = couple?.id ? q.or(`user_id.eq.${userId},couple_id.eq.${couple.id}`) : q.eq('user_id', userId);
    q.maybeSingle().then(({ data }) => setSub((data as Subscription) ?? null));
  }, [isPremium, userId, couple?.id]);

  const info = (message: string) =>
    ask({ icon: 'storefront', tone: 'iris', title: 'Çok yakında', desc: message, actions: [{ label: 'Tamam' }] });

  const buy = async () => {
    setBusy('buy');
    const r = await purchase(plan);
    setBusy(null);
    if (r.ok) {
      await refreshPremium();
      return;
    }
    if (r.reason !== 'canceled') info(r.message || STORE_MESSAGE);
  };

  const doRestore = async () => {
    setBusy('restore');
    const r = await restore();
    setBusy(null);
    if (r.ok) await refreshPremium();
    else info(r.message || STORE_MESSAGE);
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      bg={
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient colors={['rgba(107,30,56,.8)', 'rgba(12,8,11,0)']} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(168,139,240,0)', 'rgba(168,139,240,.14)', 'rgba(168,139,240,0)']} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </View>
      }
      contentStyle={{ paddingHorizontal: 22, gap: compact ? 14 : 18 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 6 }}>
        <IconButton name="close" label="Kapat" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <T v="label" center>NOCTA PREMIUM · İKİNİZ İÇİN</T>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: compact ? 42 : 50, lineHeight: compact ? 42 : 50, color: colors.pearl, textAlign: 'center' }}>
          Gecenin{'\n'}
          <Text style={{ fontFamily: fonts.serifItalic, color: colors.blush }}>kilidini aç</Text>
        </Text>
      </View>

      <View style={{ gap: 10, paddingHorizontal: 6 }}>
        {PERKS.map((p) => (
          <View key={p.t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name={p.i} size={18} color={colors.blush} />
            <T v="body" style={{ flex: 1, fontSize: 14, lineHeight: 20 }} color={colors.pearl}>{p.t}</T>
          </View>
        ))}
      </View>

      {isPremium ? (
        <View style={{ marginTop: 'auto', gap: 12 }}>
          <View style={{ padding: 18, borderRadius: 22, backgroundColor: colors.successTint, borderWidth: 1, borderColor: 'rgba(127,209,174,.35)', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="verified" size={22} color={colors.success} />
              <T v="title">Premium aktif</T>
            </View>
            {sub ? (
              <>
                <T v="bodySm" color={colors.pearlSoft}>{`${PLAN_TR[sub.plan]} · ${STATUS_TR[sub.status]}`}</T>
                <T v="bodySm" color={colors.pearlSoft}>{sub.expires_at ? `Bitiş tarihi: ${shortDate(sub.expires_at)}` : 'Süresiz'}</T>
              </>
            ) : (
              <T v="bodySm" color={colors.pearlSoft}>Aboneliğin ikinizi de kapsıyor.</T>
            )}
          </View>
          <T v="caption" center color={colors.mute}>Aboneliğini App Store ya da Google Play hesabından yönetebilirsin.</T>
          <Button title="Harika" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
      ) : (
        <View style={{ marginTop: 'auto', gap: 10 }}>
          {plans.map((p) => {
            const on = plan === p.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${p.title}, ${formatPrice(p.price, p.currency)}. ${p.subtitle}`}
                onPress={() => setPlan(p.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 64, borderRadius: 20, backgroundColor: on ? 'rgba(231,104,138,.12)' : 'rgba(23,16,22,.8)', borderWidth: 1.5, borderColor: on ? colors.rose : colors.lineStrong }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.rose : colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? colors.rose : 'transparent' }} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="title" style={{ fontSize: 15 }}>{p.title}</T>
                  <T v="caption" style={{ fontFamily: fonts.medium }}>{p.subtitle}</T>
                </View>
                <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.pearl }}>{formatPrice(p.price, p.currency)}</Text>
              </Pressable>
            );
          })}
          <Button title="Premium'a geç" glow loading={busy === 'buy'} disabled={busy === 'restore'} onPress={buy} style={{ marginTop: 6 }} />
          <Button title="Satın alımları geri yükle" kind="ghost" size="sm" loading={busy === 'restore'} disabled={busy === 'buy'} onPress={doRestore} />
          <T v="caption" center color={colors.mute} style={{ lineHeight: 17 }}>
            Tek abonelik ikinizi de kapsar. İstediğin an mağaza hesabından iptal edebilirsin.
          </T>
        </View>
      )}
      {dialog}
    </Screen>
  );
}
