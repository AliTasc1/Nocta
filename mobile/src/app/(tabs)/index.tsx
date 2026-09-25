import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { levelName } from '@/components/LevelPicker';
import { Pulse } from '@/components/Rings';
import { TimelineItem } from '@/components/Timeline';
import { Avatar, Button, Card, GlowBackground, Icon, IconButton, Pill, ProgressBar, Screen, SerifTitle, T } from '@/components/ui';
import { greeting, hms, isOnline, together } from '@/lib/format';
import { errorText, supabase } from '@/lib/supabase';
import type { Game, GameSession, Memory } from '@/lib/types';
import { sessionRoute, useActiveSession } from '@/lib/useActiveSession';
import { useDaily } from '@/lib/useDaily';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, flirtLevel, fonts } from '@/theme';

const PLAYABLE = (g: Game) => g.is_active && g.engine !== 'chat_game' && g.engine !== 'story';

function todayIndex() {
  return Math.floor(Date.now() / 86400000);
}
function randomSeed() {
  return Math.random();
}

function announcementText(a: unknown): { title?: string; body: string } | null {
  if (!a) return null;
  if (typeof a === 'string') return a.trim() ? { body: a } : null;
  if (typeof a === 'object') {
    const o = a as { title?: string; body?: string; text?: string; message?: string };
    const body = o.body ?? o.text ?? o.message ?? '';
    return body || o.title ? { title: o.title, body } : null;
  }
  return null;
}

function CoupleHeader() {
  const { profile, partner, couple, unreadNotifications } = useApp();
  const lv = flirtLevel(couple?.xp ?? 0);
  const since = together(couple?.anniversary ?? couple?.connected_at);
  const online = isOnline(partner?.last_seen_at);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flexDirection: 'row' }}>
        <Avatar name={profile?.display_name} color={profile?.avatar_color} size={44} ring={colors.ink} />
        {partner ? (
          <View style={{ marginLeft: -14 }}>
            <Avatar name={partner.display_name} color={partner.avatar_color} size={44} ring={colors.ink} />
            {online ? <View style={styles.onlineDot} accessibilityLabel="Çevrimiçi" /> : null}
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <T v="title" numberOfLines={1} style={{ fontSize: 15 }}>
          {partner ? `${profile?.display_name ?? ''} & ${partner.display_name}` : profile?.display_name}
        </T>
        <T v="caption" numberOfLines={2}>
          {partner ? `${since === 'bugün' ? 'Bugün bağlandınız' : `Birlikte ${since}`} · Sv ${lv.level}` : 'Partnerin henüz bağlanmadı'}
        </T>
      </View>
      {partner && (couple?.streak_days ?? 0) > 0 ? (
        <View style={styles.streak} accessibilityLabel={`${couple?.streak_days} günlük seri`}>
          <Icon name="local_fire_department" size={16} color={colors.warning} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.warning }}>{couple?.streak_days}</Text>
        </View>
      ) : null}
      <IconButton name="notifications" label="Bildirimler" badge={unreadNotifications} onPress={() => router.push('/notifications')} />
    </View>
  );
}

function NoPartner() {
  const { profile } = useApp();
  return (
    <View style={{ gap: 18, alignItems: 'center', paddingVertical: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ padding: 2, borderRadius: 34 }}>
          <Avatar name={profile?.display_name} color={profile?.avatar_color} size={64} ring={colors.rose} />
        </View>
        <View style={{ width: 40, height: 2, borderRadius: 1, backgroundColor: 'rgba(244,185,200,.5)' }} />
        <Pulse>
          <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,230,240,.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="person_add" size={26} color={colors.mist} />
          </View>
        </Pulse>
      </View>
      <SerifTitle text="Diğer yarın" accent="seni bekliyor." v="h2" center />
      <T v="bodySm" center style={{ maxWidth: 320 }}>
        Oyunlar, günün görevi ve özel sohbet, partnerin odana katıldığında açılır. Davet kodunu gönder ya da onun kodunu gir.
      </T>
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        <Button title="Davet et" icon="favorite" glow onPress={() => router.push('/invite')} />
        <Button title="Kodum var · Katıl" kind="outline" size="md" onPress={() => router.push('/join')} />
      </View>
    </View>
  );
}

function HeroCard({ session, suggestion }: { session: GameSession | null; suggestion: Game | null }) {
  const { gameById } = useContent();
  const { userId, partner } = useApp();
  const g = session ? gameById(session.game_id) : suggestion;
  if (!g) return null;
  const total = session ? Math.max(session.question_ids?.length ?? 0, 1) : 0;
  const idx = session ? Math.min(session.current_index + 1, total) : 0;
  const waitingForMe = session?.status === 'lobby' && !(session.ready ?? []).includes(userId ?? '');
  const statusLine = !session
    ? g.description
    : session.status === 'lobby'
      ? waitingForMe
        ? `${partner?.display_name ?? 'Partnerin'} lobide seni bekliyor.`
        : `Lobidesin · ${partner?.display_name ?? 'partnerin'} bekleniyor.`
      : session.question_ids?.length
        ? `Tur ${idx}/${total} · oyun sürüyor`
        : 'Oyun sürüyor';
  const words = g.name.split(' ');
  const first = words.length > 1 ? words.slice(0, -1).join(' ') : g.name;
  const last = words.length > 1 ? words[words.length - 1] : '';

  return (
    <View style={styles.hero}>
      <LinearGradient colors={['#6B1E38', '#2A1530', '#150C13']} locations={[0, 0.55, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.heroGlow} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <T v="label" style={{ flexShrink: 1 }}>{session ? 'DEVAM EDEN OYUN' : 'BU GECENİN OYUNU'}</T>
        {g.duration_label ? (
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.3)', flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.pearl }}>{g.duration_label}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 8, marginVertical: 22 }}>
        <SerifTitle text={first} accent={last || undefined} v="h1" style={{ fontSize: 40, lineHeight: 40 }} />
        <T v="bodySm" color={colors.pearlSoft} numberOfLines={3}>{statusLine}</T>
        {session?.status === 'playing' && session.question_ids?.length ? <ProgressBar value={idx / total} color={colors.pearl} height={4} track="rgba(255,255,255,.12)" /> : null}
      </View>
      <Button
        title={session ? (waitingForMe ? 'Lobiye katıl' : 'Oyuna devam et') : 'Oyuna başla'}
        kind="light"
        size="md"
        iconRight="play_arrow"
        onPress={() => router.push((session ? sessionRoute(session) : `/game/${g.slug}`) as any)}
      />
    </View>
  );
}

function DailyCard() {
  const { data, loading, secondsLeft, complete } = useDaily();
  const toast = useToast();
  const [busy, setBusy] = useState<'done' | 'skip' | null>(null);
  const q = data?.question;

  const act = async (skipped: boolean) => {
    setBusy(skipped ? 'skip' : 'done');
    try {
      const r = await complete(skipped);
      if (r?.already) toast.show('Partnerin bugünün görevini zaten tamamlamış ♡', 'info');
      else if (!skipped) toast.show(`Görev tamamlandı · +${r?.xp ?? 30} XP`, 'ok');
      else toast.show('Görev atlandı. Hiçbir puan kaybetmediniz.', 'info');
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) return <Card style={{ height: 150 }}>{null}</Card>;
  if (!q) return null;

  return (
    <Card onPress={() => router.push('/daily')} accessibilityLabel="Günün görevi" style={{ gap: 10, paddingVertical: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <T v="label" color={colors.warning}>GÜNÜN GÖREVİ</T>
        <T v="mono" style={{ fontSize: 12 }} color={colors.mist} accessibilityLabel={`Kalan süre ${hms(secondsLeft)}`}>{hms(secondsLeft)}</T>
      </View>
      <T v="h3" style={{ fontSize: 21, lineHeight: 25 }}>{q.text}</T>
      {data?.completed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="check_circle" size={20} color={colors.success} />
          <T v="bodySm" color={colors.success} style={{ fontWeight: '700' }}>Bugünün görevi tamamlandı</T>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button title="Tamamla" size="sm" icon="check" loading={busy === 'done'} disabled={busy === 'skip'} onPress={() => act(false)} />
          {!data?.skipped ? (
            <Button title="Atla" size="sm" kind="ghost" loading={busy === 'skip'} disabled={busy === 'done'} onPress={() => act(true)} />
          ) : (
            <T v="caption" color={colors.mute}>Atlandı · istersen yine tamamlayabilirsin</T>
          )}
        </View>
      )}
    </Card>
  );
}

function FlirtCard() {
  const { couple } = useApp();
  const xp = couple?.xp ?? 0;
  const lv = flirtLevel(xp);
  const nextName = lv.next ? flirtLevel(lv.next).name : null;
  const pct = lv.next ? (xp - lv.floor) / (lv.next - lv.floor) : 1;
  return (
    <Card onPress={() => router.push('/achievements')} accessibilityLabel="Flört seviyesi" style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <T v="title" style={{ fontSize: 14 }}>{`Seviye ${lv.level} · ${lv.name}`}</T>
        <T v="caption">{lv.next ? `${nextName} için ${lv.next - xp} XP` : `${xp} XP · en üst seviye`}</T>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
        <LinearGradient colors={[colors.rose, colors.iris]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(3, pct * 100)}%`, height: '100%', borderRadius: 3 }} />
      </View>
    </Card>
  );
}

function QuickActions({ quickGame }: { quickGame: Game | null }) {
  const { gameBySlug } = useContent();
  const questions = gameBySlug('secret_questions') ?? gameBySlug('know_me');
  const items = [
    { i: 'bolt', t: 'Hızlı Oyun', s: quickGame ? quickGame.name : 'Rastgele', go: () => quickGame && router.push(`/game/${quickGame.slug}` as any) },
    { i: 'favorite', t: 'Çift Oyunları', s: 'Tüm oyunlar', go: () => router.navigate('/games') },
    { i: 'help', t: 'Sorular', s: questions?.name ?? 'Derin sorular', go: () => questions && router.push(`/game/${questions.slug}` as any) },
    { i: 'movie', t: 'Hikâye Modu', s: 'Birlikte seçin', go: () => router.push('/game/story' as any) },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((q) => (
        <Pressable
          key={q.t}
          accessibilityRole="button"
          accessibilityLabel={q.t}
          onPress={q.go}
          style={({ pressed }) => [styles.quick, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Icon name={q.i} size={24} color={colors.blush} />
          <View style={{ gap: 2 }}>
            <T v="title" style={{ fontSize: 13.5, lineHeight: 17 }}>{q.t}</T>
            <T v="caption" numberOfLines={1} style={{ fontSize: 11 }}>{q.s}</T>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export default function Dashboard() {
  const { profile, partner, couple, userId, refreshCouple, refreshUnread, isPremium } = useApp();
  const { games, settings, gameById, refresh: refreshContent } = useContent();
  const { session, reload: reloadSession } = useActiveSession();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const active = couple?.status === 'active' && !!partner;

  const activeCoupleId = couple?.status === 'active' ? couple.id : null;
  const loadMemories = useCallback(async () => {
    if (!activeCoupleId) return setMemories([]);
    const { data } = await supabase.from('memories').select('*').eq('couple_id', activeCoupleId).order('happened_at', { ascending: false }).limit(3);
    setMemories((data as Memory[]) ?? []);
  }, [activeCoupleId]);

  useFocusEffect(
    useCallback(() => {
      loadMemories().catch(() => {});
    }, [loadMemories]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refreshCouple(), refreshUnread(), reloadSession(), loadMemories(), refreshContent()]);
    setRefreshing(false);
  };

  const available = useMemo(() => games.filter((g) => PLAYABLE(g) && (isPremium || !g.is_premium)), [games, isPremium]);
  // Günün önerisi: gün içinde sabit kalsın
  const suggestion = useMemo(() => (available.length ? available[todayIndex() % available.length] : null), [available]);
  const [quickSeed] = useState(randomSeed);
  const quickGame = available.length ? available[Math.floor(quickSeed * available.length)] : null;

  const invite = session && session.status === 'lobby' && session.created_by !== userId && !(session.ready ?? []).includes(userId ?? '') ? session : null;
  const ann = announcementText(settings.announcement);
  const name = profile?.display_name ?? '';

  return (
    <Screen bg={<GlowBackground />} refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ paddingTop: 6, gap: 18 }}>
      <CoupleHeader />
      <SerifTitle text={`${greeting()},`} accent={`${name}.`} v="h2" />

      {ann ? (
        <View style={styles.banner}>
          <Icon name="campaign" size={22} color={colors.irisSoft} />
          <View style={{ flex: 1, gap: 2 }}>
            {ann.title ? <T v="title" style={{ fontSize: 14 }}>{ann.title}</T> : null}
            {ann.body ? <T v="bodySm" color={colors.pearlSoft}>{ann.body}</T> : null}
          </View>
        </View>
      ) : null}

      {!active ? (
        <NoPartner />
      ) : (
        <>
          {invite ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/lobby/${invite.id}` as any)}
              style={({ pressed }) => [styles.invite, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Pulse>
                <Avatar name={partner?.display_name} color={partner?.avatar_color} size={40} ring={colors.rose} />
              </Pulse>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="title" style={{ fontSize: 14.5 }}>{`${partner?.display_name ?? 'Partnerin'} seni oyuna çağırıyor`}</T>
                <T v="caption" color={colors.pearlSoft}>{`${gameById(invite.game_id)?.name ?? 'Oyun'} · lobide bekliyor`}</T>
              </View>
              <Pill text="KATIL" tone="light" style={{ alignSelf: 'center' }} />
            </Pressable>
          ) : null}
          <HeroCard session={invite ? null : session} suggestion={suggestion} />
          <DailyCard />
          <FlirtCard />
          <QuickActions quickGame={quickGame} />
          {memories.length ? (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T v="label">SON ANILAR</T>
                <Pressable accessibilityRole="button" onPress={() => router.navigate('/memories')} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <T v="bodySm" color={colors.blush} style={{ fontWeight: '700' }}>Tümü</T>
                </Pressable>
              </View>
              <View>
                {memories.map((m, i) => (
                  <TimelineItem key={m.id} m={m} last={i === memories.length - 1} />
                ))}
              </View>
            </View>
          ) : null}
          {!isPremium ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/premium')} style={({ pressed }) => [styles.premium, { opacity: pressed ? 0.85 : 1 }]}>
              <LinearGradient colors={['#6B1E38', colors.velvet]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.8 }} style={StyleSheet.absoluteFill} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="title" style={{ fontSize: 14 }}>Gecenin kilidini aç</T>
                <T v="caption" color={colors.pearlSoft}>{`Hikâye Modu, ${levelName(2)} ve ${levelName(3)} seviyeleri, özel soru paketleri.`}</T>
              </View>
              <Icon name="chevron_right" size={22} color={colors.blush} />
            </Pressable>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.ink },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, height: 30, borderRadius: 15, backgroundColor: colors.warningTint },
  hero: { borderRadius: 30, overflow: 'hidden', padding: 22, borderWidth: 1, borderColor: colors.lineStrong, minHeight: 260 },
  heroGlow: { position: 'absolute', right: -60, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(231,104,138,.22)' },
  banner: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.irisTint, borderWidth: 1, borderColor: 'rgba(168,139,240,.3)' },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.roseTintStrong, borderWidth: 1, borderColor: 'rgba(231,104,138,.45)' },
  quick: { flexBasis: '47%', flexGrow: 1, minHeight: 92, borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, padding: 14, justifyContent: 'space-between', gap: 10 },
  premium: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
});
