import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, IconButton, Pill, Screen, T } from '@/components/ui';
import { shortDate, together } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { colors, flirtLevel, fonts, MOODS } from '@/theme';

function RingAvatar({ name, color, reverse }: { name?: string | null; color?: string; reverse?: boolean }) {
  const initial = (name ?? '?').trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <LinearGradient colors={reverse ? [colors.iris, colors.rose] : [colors.rose, colors.iris]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 76, height: 76, borderRadius: 38, padding: 2 }}>
      <View style={{ flex: 1, borderRadius: 38, backgroundColor: color ?? colors.plum, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 32, color: colors.pearl }}>{initial}</Text>
      </View>
    </LinearGradient>
  );
}

function LinkRow({ icon, iconColor = colors.blush, title, value, onPress }: { icon: string; iconColor?: string; title: string; value?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.8 : 1 })}
    >
      <Icon name={icon} size={22} color={iconColor} />
      <T v="title" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>{title}</T>
      {value ? <T v="bodySm" numberOfLines={1} style={{ maxWidth: '40%' }}>{value}</T> : null}
      <Icon name="chevron_right" size={22} color={colors.mist} />
    </Pressable>
  );
}

/** Tanıtım ödülü: bilerek sade ve küçük tutulan satır */
function PromoRow({ status, days, onPress }: { status: string | null; days: number; onPress: () => void }) {
  const badge = status === 'pending' ? 'İnceleniyor' : status === 'approved' ? 'Onaylandı' : status === 'rejected' ? 'Onaylanmadı' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ödül kazan. Tanıt, ${days} gün Premium kazan${badge ? `. Durum: ${badge}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.75 : 1 })}
    >
      <Icon name="redeem" size={20} color={colors.mist} />
      <View style={{ flex: 1 }}>
        <T v="title" style={{ fontSize: 14, lineHeight: 19 }} numberOfLines={1}>Ödül kazan</T>
        <T v="caption" style={{ fontSize: 11.5 }} numberOfLines={1}>{`Tanıt, ${days} gün Premium kazan`}</T>
      </View>
      {badge ? <T v="caption" numberOfLines={1} style={{ fontSize: 11.5 }}>{badge}</T> : null}
      <Icon name="chevron_right" size={20} color={colors.mute} />
    </Pressable>
  );
}

export default function Profile() {
  const { userId, profile, partner, couple, isPremium, unreadNotifications } = useApp();
  const { achievements, gameById, settings } = useContent();
  const promoEnabled = settings.promo_enabled !== false && settings.promo_enabled !== 'false';
  const [promoStatus, setPromoStatus] = useState<string | null>(null);
  const [stats, setStats] = useState<{ games: number; badges: number; favorite: { name: string; n: number } | null }>({ games: 0, badges: 0, favorite: null });
  const active = couple?.status === 'active' && !!partner;

  const cid = couple?.status === 'active' ? couple.id : null;
  const load = useCallback(async () => {
    if (!cid) return setStats({ games: 0, badges: 0, favorite: null });
    const [s, b] = await Promise.all([
      supabase.from('game_sessions').select('game_id').eq('couple_id', cid).eq('status', 'finished').limit(1000),
      supabase.from('couple_achievements').select('achievement_id', { count: 'exact', head: true }).eq('couple_id', cid).not('unlocked_at', 'is', null),
    ]);
    const rows = (s.data ?? []) as { game_id: string }[];
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.game_id, (counts.get(r.game_id) ?? 0) + 1));
    let fav: { name: string; n: number } | null = null;
    counts.forEach((n, id) => {
      const g = gameById(id);
      if (g && (!fav || n > fav.n)) fav = { name: g.name, n };
    });
    setStats({ games: rows.length, badges: b.count ?? 0, favorite: fav });
  }, [cid, gameById]);

  // Tanıtım ödülü başvurusu (varsa durumunu satırda göster)
  const loadPromo = useCallback(async () => {
    if (!userId || !promoEnabled) return setPromoStatus(null);
    const { data } = await supabase.from('promo_submissions').select('status').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setPromoStatus((data as { status?: string } | null)?.status ?? null);
  }, [userId, promoEnabled]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
      loadPromo().catch(() => {});
    }, [load, loadPromo]),
  );

  const lv = flirtLevel(couple?.xp ?? 0);
  const since = couple?.anniversary ?? couple?.connected_at;
  const mood = MOODS.find((m) => m.key === profile?.mood);

  return (
    <Screen
      bg={<LinearGradient pointerEvents="none" colors={['rgba(107,30,56,.5)', 'rgba(12,8,11,0)']} locations={[0, 0.45]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />}
      contentStyle={{ paddingTop: 6, gap: 16 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <IconButton name="settings" label="Ayarlar" onPress={() => router.push('/settings')} />
      </View>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: 'row' }}>
          <RingAvatar name={profile?.display_name} color={profile?.avatar_color} />
          {partner ? (
            <View style={{ marginLeft: -18 }}>
              <RingAvatar name={partner.display_name} color={partner.avatar_color} reverse />
            </View>
          ) : null}
        </View>
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 36, color: colors.pearl, textAlign: 'center' }}>
          {profile?.display_name}
          {partner ? (
            <>
              <Text style={{ fontFamily: fonts.serifItalic, color: colors.blush }}> & </Text>
              {partner.display_name}
            </>
          ) : null}
        </Text>
        <T v="bodySm" center>
          {active && since ? (together(since) === 'bugün' ? 'Bugün bağlandınız ♡' : `Birlikte ${together(since)} · başlangıç ${shortDate(since)}`) : 'Partnerin henüz bağlanmadı'}
        </T>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {active ? <Pill text={`SEVİYE ${lv.level} · ${lv.name.toLocaleUpperCase('tr-TR')}`} /> : null}
          {isPremium ? <Pill text="PREMIUM" tone="pro" /> : null}
          {mood ? <Pill text={mood.name.toLocaleUpperCase('tr-TR')} tone="mute" /> : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}>
        {[
          { n: stats.games, t: 'Oyun' },
          { n: stats.badges, t: 'Rozet' },
          { n: couple?.streak_days ?? 0, t: 'Gün seri' },
        ].map((s, i) => (
          <View key={s.t} style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
            <T v="h3" style={{ fontSize: 28, lineHeight: 32 }}>{s.n}</T>
            <T v="caption" numberOfLines={1} style={{ fontSize: 11 }}>{s.t}</T>
          </View>
        ))}
      </View>

      {stats.favorite ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}>
          <Icon name="favorite" size={22} color={colors.blush} />
          <View style={{ flex: 1 }}>
            <T v="caption" style={{ fontSize: 11.5 }}>Favori oyununuz</T>
            <T v="title" style={{ fontSize: 15 }}>{`${stats.favorite.name} · ${stats.favorite.n} kez`}</T>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <LinkRow icon="military_tech" title="Rozetler" value={`${stats.badges} / ${achievements.length || '–'}`} onPress={() => router.push('/achievements')} />
        <LinkRow icon="notifications" title="Bildirimler" value={unreadNotifications ? `${unreadNotifications} yeni` : undefined} onPress={() => router.push('/notifications')} />
        <LinkRow icon="edit" title="Profili düzenle" onPress={() => router.push('/edit-profile')} />
        <LinkRow icon="shield_lock" iconColor={colors.success} title="Gizlilik" onPress={() => router.push('/privacy')} />
        <LinkRow icon="workspace_premium" iconColor={colors.irisSoft} title="Abonelik" value={isPremium ? 'Premium' : 'Ücretsiz'} onPress={() => router.push('/premium')} />
        <LinkRow icon="settings" iconColor={colors.mist} title="Ayarlar" onPress={() => router.push('/settings')} />
      </View>
      {promoEnabled && (!isPremium || promoStatus) ? (
        <PromoRow status={promoStatus} days={Number(settings.promo_days) > 0 ? Number(settings.promo_days) : 30} onPress={() => router.push('/promo')} />
      ) : null}
      {!active ? (
        <LinkRow icon="person_add" title="Partnerini davet et" onPress={() => router.push('/invite')} />
      ) : null}
    </Screen>
  );
}
