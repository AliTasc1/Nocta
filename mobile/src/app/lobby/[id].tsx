import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, BackHandler, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDialog } from '@/components/Dialog';
import { joinGameChannel } from '@/components/games/gameChannel';
import { CircleButton, haptic, initialOf, MetaText, RadialGlow, upper, useCompact, useReducedMotion, type Player } from '@/components/games/shared';
import { Button, EmptyState, Loading } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';
import type { Game, GameSession } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts, LEVELS } from '@/theme';

const ts = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/** 10 · Oyun lobisi — iki taraf da "Hazırım" deyince eşzamanlı 3-2-1 */
export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id ?? '');
  const { userId, profile, partner: appPartner, couple } = useApp();
  const { gameById, stories } = useContent();
  const { show: showToast } = useToast();
  const { dialog, ask } = useDialog();
  const insets = useSafeAreaInsets();
  const { compact, s: sz } = useCompact();

  const [session, setSession] = useState<GameSession | null>(null);
  const [fetchedGame, setFetchedGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [online, setOnline] = useState<string[]>([]);
  /** Geri sayımın biteceği yerel an (ms) */
  const [target, setTarget] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const sessionRef = useRef<GameSession | null>(null);
  const sawLobby = useRef(false);
  const leaving = useRef(false);
  const navigated = useRef(false);

  // Oturumu uygula; lobi → oyun geçişi canlı görüldüyse geri sayımı alış anına göre kur
  const apply = useCallback((s: GameSession | null | undefined, liveAt?: number) => {
    if (!s) return;
    const cur = sessionRef.current;
    if (cur && ts(s.updated_at) < ts(cur.updated_at)) return;
    sessionRef.current = s;
    setSession(s);
    if (s.status === 'lobby') sawLobby.current = true;
    if (s.status === 'playing' && s.started_at) {
      setTarget((t) => {
        if (t != null) return t;
        // Canlı geçiş (Realtime yükü / set_ready yanıtı): saat farkından etkilenmemek için
        // sunucunun verdiği 4 sn'yi alış anından say
        if (liveAt != null && sawLobby.current) return liveAt + Math.max(0, Math.min(4000, ts(s.started_at) - ts(s.updated_at)));
        // Sonradan katılım: cihaz saatine göre, 0..4 sn aralığında
        return Date.now() + Math.max(0, Math.min(4000, ts(s.started_at) - Date.now()));
      });
    }
  }, []);

  const fetchSession = useCallback(async () => {
    const { data, error: e } = await supabase.from('game_sessions').select('*').eq('id', sessionId).maybeSingle();
    if (e) {
      if (!sessionRef.current) setError(errorText(e));
      return;
    }
    if (!data) {
      setError('Bu oyun bulunamadı ya da artık erişilemiyor.');
      return;
    }
    setError(null);
    apply(data as GameSession);
  }, [sessionId, apply]);

  useEffect(() => {
    (async () => {
      await fetchSession();
    })();
  }, [fetchSession]);

  // Oyun bilgisi (önbellekte yoksa sunucudan)
  const gameId = session?.game_id;
  const cachedGame = gameId ? gameById(gameId) : undefined;
  const game = cachedGame ?? (fetchedGame && fetchedGame.id === gameId ? fetchedGame : null);
  useEffect(() => {
    if (!gameId || cachedGame) return;
    supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFetchedGame(data as Game);
      });
  }, [gameId, cachedGame]);

  // Realtime: oturum satırı
  useEffect(() => {
    const nonce = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`lobby:${sessionId}:${nonce}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` }, (p) => {
        const row = p.new as Partial<GameSession>;
        const receivedAt = Date.now();
        // Durum/başlangıç küçük alanlardır ve yükte gelir: geri sayımı gecikmesiz başlat
        if (row.status === 'playing' && row.started_at && row.updated_at && sessionRef.current) {
          apply({ ...sessionRef.current, status: 'playing', started_at: row.started_at, updated_at: row.updated_at, ready: (row.ready as string[]) ?? sessionRef.current.ready }, receivedAt);
        }
        fetchSession();
      })
      .subscribe((st) => {
        if (st === 'SUBSCRIBED') fetchSession();
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, apply, fetchSession]);

  // Presence + hızlı eşitleme
  useEffect(() => {
    if (!userId) return;
    const h = joinGameChannel(sessionId, userId, {
      onPresence: setOnline,
      onBroadcast: (event) => {
        if (event === 'sync') fetchSession();
      },
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        fetchSession();
        h.retrack();
      }
    });
    // Yedek yoklama (Realtime kopukken de lobi güncel kalsın)
    const iv = setInterval(() => {
      if (AppState.currentState === 'active') fetchSession();
    }, 5000);
    return () => {
      sub.remove();
      clearInterval(iv);
      h.leave();
    };
  }, [sessionId, userId, fetchSession]);

  // Geri sayım saati
  useEffect(() => {
    if (target == null) return;
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, [target]);

  const status = session?.status;
  const remaining = target != null ? target - now : null;

  // Yönlendirmeler
  useEffect(() => {
    if (navigated.current || !status) return;
    if (status === 'canceled') {
      navigated.current = true;
      if (!leaving.current) showToast('Oyun iptal edildi. Partnerin lobiden çıktı.', 'info');
      router.replace('/');
    } else if (status === 'finished') {
      navigated.current = true;
      router.replace(`/result/${sessionId}`);
    } else if (status === 'playing' && remaining != null && remaining <= 0) {
      navigated.current = true;
      router.replace(`/play/${sessionId}`);
    }
  }, [status, remaining, sessionId, showToast]);

  // Geri sayım adımında titreşim
  const label = remaining == null ? null : remaining > 3000 ? '3' : remaining > 2000 ? '2' : remaining > 1000 ? '1' : 'BAŞLA';
  useEffect(() => {
    if (!label) return;
    if (label === 'BAŞLA') haptic.success();
    else haptic.heavy();
  }, [label]);

  const members = couple && session && couple.id === session.couple_id ? couple : null;
  const partnerId = members ? (members.user_a === userId ? members.user_b : members.user_a) : appPartner?.id ?? null;
  const me: Player = { id: userId ?? '', name: profile?.display_name || 'Sen', color: profile?.avatar_color || '#2A1530' };
  const partner: Player = { id: partnerId ?? '', name: appPartner?.display_name || 'Partnerin', color: appPartner?.avatar_color || '#3A1D2B' };
  const meReady = !!userId && !!session?.ready?.includes(userId);
  const partnerReady = !!partnerId && (!!session?.ready?.includes(partnerId) || status === 'playing');
  const partnerOnline = !!partnerId && online.includes(partnerId);
  const counting = status === 'playing';

  const toggleReady = async () => {
    if (!session || toggling || counting) return;
    const next = !meReady;
    setToggling(true);
    haptic.light();
    // iyimser
    setSession((s) => (s ? { ...s, ready: next ? [...s.ready.filter((x) => x !== userId), userId!] : s.ready.filter((x) => x !== userId) } : s));
    const { data, error: e } = await supabase.rpc('set_ready', { p_session: session.id, p_ready: next });
    const receivedAt = Date.now();
    setToggling(false);
    if (e) {
      showToast(errorText(e), 'error');
      fetchSession();
      return;
    }
    apply(data as GameSession, receivedAt);
  };

  const leave = useCallback(() => {
    ask({
      icon: 'logout',
      tone: 'error',
      title: 'Lobiden çıkılsın mı?',
      desc: 'Oyun iptal edilir ve partnerine haber verilir.',
      actions: [
        {
          label: 'Oyundan çık',
          kind: 'danger',
          onPress: async () => {
            leaving.current = true;
            const { error: e } = await supabase.rpc('cancel_session', { p_session: sessionId });
            if (e) {
              leaving.current = false;
              throw e;
            }
            navigated.current = true;
            if (router.canGoBack()) router.back();
            else router.replace('/');
          },
        },
        { label: 'Lobide kal', kind: 'ghost' },
      ],
    });
  }, [ask, sessionId]);

  // Android geri tuşu: lobiden çıkmadan önce sor
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  if (error && !session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, justifyContent: 'center', paddingHorizontal: 20 }}>
        <EmptyState icon="wifi_off" tone="error" title="Lobi açılamadı" desc={error} action="Tekrar dene" onAction={fetchSession} secondary="Ana sayfaya dön" onSecondary={() => router.replace('/')} />
      </View>
    );
  }
  if (!session || !game) return <Loading label="Lobi hazırlanıyor…" />;

  const lvl = LEVELS[Math.max(0, Math.min(3, session.level))]?.name ?? 'Yumuşak';
  const st = session.state ?? {};
  const story = st.story_id ? stories.find((s) => s.id === st.story_id) : undefined;
  const count = game.engine === 'truth_dare' ? Math.min(game.rounds, (st.truths?.length ?? 0) + (st.dares?.length ?? 0)) : session.question_ids.length;
  const info =
    game.engine === 'story'
      ? story?.title ?? 'Etkileşimli hikâye'
      : `${count} ${game.engine === 'challenges' ? 'görev' : game.engine === 'truth_dare' ? 'kart' : 'soru'} · ${lvl}`;
  const roomCode = `${sessionId.slice(0, 4)}-${sessionId.slice(4, 8)}`.toLocaleUpperCase('tr-TR');
  const avatarSize = compact ? 80 : 92;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <RadialGlow color="rgba(107,30,56,.8)" top="50%" size={1.2} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 16) + 12, paddingHorizontal: 24, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <CircleButton icon="close" label="Lobiden çık" onPress={leave} />
          <MetaText>{`ODA · ${roomCode}`}</MetaText>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ marginTop: sz(28, 16), alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, color: colors.blush }}>{`OYUN ${String(game.sort).padStart(2, '0')} · ${upper(lvl)}`}</Text>
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: sz(36, 30), lineHeight: sz(38, 32), color: colors.pearl, textAlign: 'center' }}>{game.name}</Text>
        </View>

        <View style={{ flex: 1, minHeight: sz(40, 20) }} />

        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Seat player={me} ready={meReady || counting} size={avatarSize} online />
          <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
            <CenterLabel label={label} />
          </View>
          <Seat player={partner} ready={partnerReady} size={avatarSize} online={partnerOnline} showPresence />
        </View>

        <View style={{ flex: 1, minHeight: sz(40, 20) }} />

        <View style={{ width: '100%', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: 'rgba(23,16,22,.7)', borderWidth: 1, borderColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.mist }}>{info}</Text>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.mist }}>
            {game.engine === 'story' ? 'Birlikte seçin' : 'Pas geçmek serbest'}
          </Text>
        </View>

        {!partnerOnline && !partnerReady ? (
          <Text style={{ marginTop: 10, fontFamily: fonts.medium, fontSize: 12, color: colors.mute, textAlign: 'center' }}>
            {`${partner.name} henüz lobide değil. Davet bildirimi gönderildi.`}
          </Text>
        ) : null}

        <View style={{ width: '100%', marginTop: 14 }}>
          <Button
            title={counting ? 'Başlıyor…' : meReady ? 'Hazırsın ✓' : 'Hazırım'}
            kind={meReady || counting ? 'success' : 'primary'}
            glow={!meReady}
            loading={toggling}
            onPress={toggleReady}
            accessibilityHint={meReady ? 'Dokununca hazır değilim olarak işaretlenirsin' : undefined}
            style={{ height: 58 }}
          />
          <Text style={{ marginTop: 8, minHeight: 16, fontFamily: fonts.medium, fontSize: 12, color: colors.mute, textAlign: 'center' }}>
            {counting ? '' : meReady ? (partnerReady ? '' : `${partner.name} bekleniyor · vazgeçmek için tekrar dokun`) : partnerReady ? `${partner.name} hazır, seni bekliyor` : ''}
          </Text>
        </View>
      </ScrollView>
      {dialog}
    </View>
  );
}

function Seat({ player, ready, size, online, showPresence }: { player: Player; ready: boolean; size: number; online: boolean; showPresence?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 12 }}>
      <View style={{ width: size, height: size }}>
        <View style={{ flex: 1, borderRadius: size / 2, padding: 2, overflow: 'hidden' }}>
          {ready ? (
            <LinearGradient colors={[colors.success, colors.iris]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,230,240,.15)' }]} />
          )}
          <View style={{ flex: 1, borderRadius: size / 2, backgroundColor: player.color, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.41, color: colors.pearl }}>{initialOf(player.name)}</Text>
          </View>
        </View>
        {showPresence ? (
          <View
            accessibilityLabel={online ? 'çevrimiçi' : 'çevrimdışı'}
            style={{ position: 'absolute', right: size * 0.06, bottom: size * 0.06, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: colors.ink, backgroundColor: online ? colors.success : colors.faint }}
          />
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.pearl, maxWidth: '100%' }}>{player.name}</Text>
      <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: ready ? 'rgba(127,209,174,.16)' : 'rgba(242,194,123,.14)' }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.9, color: ready ? colors.success : colors.warning }}>{ready ? 'HAZIR' : 'BEKLİYOR'}</Text>
      </View>
      {showPresence ? <Text style={{ marginTop: -6, fontFamily: fonts.medium, fontSize: 11, color: online ? colors.success : colors.mute }}>{online ? 'çevrimiçi' : 'çevrimdışı'}</Text> : null}
    </View>
  );
}

/** Ortadaki "HAZIR MISIN?" → 3 · 2 · 1 · BAŞLA (pop animasyonu) */
function CenterLabel({ label }: { label: string | null }) {
  const reduced = useReducedMotion();
  const anim = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    if (reduced) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [label, reduced, anim]);
  const big = label != null;
  const text = label ?? 'HAZIR MISIN?';
  return (
    <Animated.Text
      accessibilityLiveRegion="polite"
      maxFontSizeMultiplier={1.1}
      numberOfLines={big ? 1 : 2}
      adjustsFontSizeToFit
      style={{
        fontFamily: big ? fonts.serifItalic : fonts.serif,
        fontSize: big ? (text.length > 1 ? 34 : 72) : 24,
        lineHeight: big ? (text.length > 1 ? 40 : 76) : 26,
        color: big ? colors.blush : colors.pearl,
        textAlign: 'center',
        textShadowColor: 'rgba(231,104,138,.6)',
        textShadowRadius: 30,
        opacity: anim,
        transform: [{ scale: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 1.1, 1] }) }],
      }}
    >
      {text}
    </Animated.Text>
  );
}
