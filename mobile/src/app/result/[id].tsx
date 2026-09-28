import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { emojiCorrectIndex } from '@/components/games/EmojiGame';
import { quizCorrectIndex } from '@/components/games/Quiz';
import { finishCache, GameBackground, haptic, optionsOf, upper, useCompact, useReducedMotion, type FinishResult } from '@/components/games/shared';
import { WhereHistory, type WhereRound } from '@/components/games/wherePhoto';
import { Button, EmptyState, Icon, Loading } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';
import type { Game, GameSession, SessionAnswer } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { loadQuestions, useContent } from '@/providers/ContentProvider';
import { colors, flirtLevel, fonts } from '@/theme';

/** Oyun sonu: kalpler, XP, eşleşmeler, flört seviyesi ilerlemesi */
export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id ?? '');
  const { userId, couple, refreshCouple, isPremium, partner } = useApp();
  const content = useContent();
  const insets = useSafeAreaInsets();
  const { s: sz } = useCompact();

  const [session, setSession] = useState<GameSession | null>(null);
  const [res, setRes] = useState<FinishResult | null>(() => finishCache.get(sessionId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [sweetDiff, setSweetDiff] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizStats | null>(null);
  const [pick] = useState(() => Math.random());
  const celebrated = useRef(false);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('game_sessions').select('*').eq('id', sessionId).maybeSingle();
    setError(null);
    if (e || !data) {
      setError(e ? errorText(e) : 'Bu oyun bulunamadı.');
      return;
    }
    let s = data as GameSession;
    // Oyun bitmemişse (ör. bu ekran doğrudan açıldıysa) bitirmeyi dene — sunucu tarafı idempotent
    if (s.status === 'playing') {
      const { data: fin, error: fe } = await supabase.rpc('finish_session', { p_session: sessionId });
      if (fe) {
        setError(errorText(fe));
        return;
      }
      const f = fin as FinishResult;
      if (!f.already) {
        finishCache.set(sessionId, f);
        setRes(f);
      }
      if (f.session) s = f.session as GameSession;
    }
    setSession(s);
    refreshCouple();
  }, [sessionId, refreshCouple]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const game: Game | undefined = session ? content.gameById(session.game_id) : undefined;

  // "En tatlı fark": ilk farklı seçilen turda partnerin seçimi
  const { questionById } = content;
  const engine = game?.engine;
  useEffect(() => {
    if (!session || !userId || (engine !== 'would_you_rather' && engine !== 'this_or_that')) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.from('session_answers').select('*').eq('session_id', session.id).order('round');
      const rows = (data ?? []) as SessionAnswer[];
      const rounds = new Map<number, SessionAnswer[]>();
      rows.forEach((a) => rounds.set(a.round, [...(rounds.get(a.round) ?? []), a]));
      for (const [, list] of [...rounds.entries()].sort((a, b) => a[0] - b[0])) {
        const mine = list.find((a) => a.user_id === userId);
        const theirs = list.find((a) => a.user_id !== userId);
        if (!mine || !theirs || String(mine.answer?.choice) === String(theirs.answer?.choice) || !theirs.question_id) continue;
        const qs = await loadQuestions([theirs.question_id], questionById);
        const opt = optionsOf(qs[theirs.question_id])[Number(theirs.answer?.choice)];
        if (opt && alive) setSweetDiff(`${opt} 👀`);
        break;
      }
    })();
    return () => {
      alive = false;
    };
  }, [session, userId, engine, questionById]);

  // Çift Testleri / Emojilerle Anlat: istemci tarafı ayrıntı (eşleşme turları + bilgi turlarında kişi başı doğru)
  useEffect(() => {
    if (!session || !userId || (engine !== 'quiz' && engine !== 'emoji')) return;
    const correctOf = engine === 'emoji' ? emojiCorrectIndex : quizCorrectIndex;
    let alive = true;
    (async () => {
      const { data } = await supabase.from('session_answers').select('*').eq('session_id', session.id).order('round');
      const rows = (data ?? []) as SessionAnswer[];
      const qids = [...new Set(rows.map((a) => a.question_id).filter((x): x is string => !!x))];
      const qs = qids.length ? await loadQuestions(qids, questionById) : {};
      const byRound = new Map<number, SessionAnswer[]>();
      rows.forEach((a) => byRound.set(a.round, [...(byRound.get(a.round) ?? []), a]));
      const st: QuizStats = { compatRounds: 0, same: 0, knowRounds: 0, myCorrect: 0, partnerCorrect: 0 };
      byRound.forEach((list) => {
        const mine = list.find((a) => a.user_id === userId);
        const theirs = list.find((a) => a.user_id !== userId);
        if (!mine || !theirs) return;
        const qid = mine.question_id ?? theirs.question_id;
        const ci = qid ? correctOf(qs[qid]) : null;
        const a = String(mine.answer?.choice);
        const b = String(theirs.answer?.choice);
        if (ci != null) {
          st.knowRounds++;
          if (a === String(ci)) st.myCorrect++;
          if (b === String(ci)) st.partnerCorrect++;
        } else {
          st.compatRounds++;
          if (a === b) st.same++;
        }
      });
      if (alive) setQuiz(st);
    })();
    return () => {
      alive = false;
    };
  }, [session, userId, engine, questionById]);

  const ready = !!session && !!game;
  useEffect(() => {
    if (ready && !celebrated.current && session?.status === 'finished') {
      celebrated.current = true;
      haptic.success();
    }
  }, [ready, session?.status]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, justifyContent: 'center', paddingHorizontal: 20 }}>
        <EmptyState icon="wifi_off" tone="error" title="Sonuçlar yüklenemedi" desc={error} action="Tekrar dene" onAction={load} secondary="Ana sayfa" onSecondary={() => router.replace('/')} />
      </View>
    );
  }
  if (!session || !game) return <Loading label="Sonuçlar hesaplanıyor…" />;

  if (session.status !== 'finished') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, justifyContent: 'center', paddingHorizontal: 20 }}>
        <EmptyState icon="hourglass_empty" tone="mute" title="Bu oyun tamamlanmadı" desc="Oyun yarıda bırakıldığı için puan hesaplanmadı." action="Ana sayfa" onAction={() => router.replace('/')} />
      </View>
    );
  }

  const score = session.score ?? {};
  const xp = Number(res?.xp ?? score.xp ?? 0);
  const matches = Number(res?.matches ?? score.matches ?? 0);
  const rounds = Number(res?.rounds ?? score.rounds ?? 0);
  const coupleXp = Number(res?.couple_xp ?? couple?.xp ?? 0);
  const fl = res?.flirt ?? flirtLevel(coupleXp);
  const progress = fl.next ? (coupleXp - fl.floor) / (fl.next - fl.floor) : 1;

  const matchGame = game.engine === 'would_you_rather' || game.engine === 'this_or_that';
  const partnerName = partner?.display_name || 'Partnerin';
  const isQuizLike = game.engine === 'quiz' || game.engine === 'emoji';
  const quizKnow = isQuizLike && !!quiz && quiz.knowRounds > 0;
  const quizOnlyKnow = quizKnow && quiz!.compatRounds === 0;
  const st = session.state ?? {};
  const confessions: { by: string; prompt: string | null; text: string }[] = Array.isArray(st.confessions) ? st.confessions : [];
  const spins: { drinker: string | null }[] = Array.isArray(st.spins) ? st.spins : [];
  const myShots = spins.filter((x) => x.drinker && x.drinker === userId).length;
  const partnerShots = spins.filter((x) => x.drinker && x.drinker !== userId).length;
  const whereRounds: WhereRound[] = Array.isArray(st.history) ? st.history : [];
  const myHits = whereRounds.filter((r) => r.correct && r.guesser === userId).length;
  const partnerHits = whereRounds.filter((r) => r.correct && r.guesser !== userId).length;
  const copy = isQuizLike
    ? quizHeadline(quiz, matches, rounds, partnerName, game.engine === 'emoji')
    : game.engine === 'roulette'
      ? confessions.length
        ? { a: 'Sözleşme', b: 'bozulmadı.' }
        : { a: 'Mermi bu gece', b: 'sizi sevdi.' }
      : game.engine === 'shots'
        ? myShots === partnerShots
          ? { a: 'Şerefe,', b: 'ikinize de!' }
          : myShots > partnerShots
            ? { a: 'Bu gecenin', b: 'şanssızı sensin 🥃' }
            : { a: 'Şans', b: 'bu gece seninle!' }
        : game.engine === 'where'
          ? myHits + partnerHits === 0
            ? { a: 'Bu gece', b: 'palyaço kazandı 🤡' }
            : myHits === partnerHits
              ? { a: 'Aynı haritada,', b: 'ikiniz de.' }
              : myHits > partnerHits
                ? { a: 'Keşif ustası', b: 'sensin!' }
                : { a: 'Bu gece', b: `${partnerName} buldu!` }
          : headline(game.engine, matches, rounds);
  const bigNumber = quizOnlyKnow
    ? { n: quiz!.myCorrect, of: quiz!.knowRounds }
    : game.engine === 'roulette'
      ? { n: confessions.length, of: null }
      : game.engine === 'shots'
        ? { n: myShots + partnerShots, of: null }
        : game.engine === 'where'
          ? { n: myHits + partnerHits, of: whereRounds.length }
        : matchGame || game.engine === 'know_me' || isQuizLike || game.engine === 'cards'
          ? { n: matches, of: rounds }
          : { n: rounds, of: null };
  const bigUnit = game.engine === 'roulette' ? 'itiraf' : game.engine === 'shots' ? 'shot' : 'tur';
  const bigCaption = isQuizLike
    ? quizOnlyKnow
      ? 'senin doğru cevabın'
      : game.engine === 'emoji'
        ? 'aynı emoji'
        : 'aynı cevap'
    : game.engine === 'cards'
      ? 'aynı kart'
      : game.engine === 'where'
        ? 'doğru tahmin'
        : null;
  const second = isQuizLike
    ? quizKnow
      ? { k: 'Doğru cevaplar', v: `Sen ${quiz!.myCorrect} · ${partnerName} ${quiz!.partnerCorrect}` }
      : { k: 'Uyum', v: rounds ? `%${Math.round((matches / rounds) * 100)} ${game.engine === 'emoji' ? 'aynı emoji' : 'aynı cevap'}` : '—' }
    : game.engine === 'cards'
    ? { k: 'Eşleşme', v: `${matches} / ${rounds} aynı kart` }
    : game.engine === 'roulette'
    ? { k: 'Çekilen tetik', v: `${rounds} tetik · ${Math.max(1, Number(st.round ?? 0) + (st.phase === 'loading' ? 0 : 1))} tur` }
    : game.engine === 'shots'
    ? { k: 'Kim kaç shot', v: `Sen ${myShots} · ${partnerName} ${partnerShots}` }
    : game.engine === 'where'
    ? { k: 'Kim kaç bildi', v: `Sen ${myHits} · ${partnerName} ${partnerHits}` }
    : matchGame
    ? { k: 'En tatlı fark', v: sweetDiff ?? (rounds ? `%${Math.round((matches / rounds) * 100)} uyum` : '—') }
    : game.engine === 'know_me'
      ? { k: 'Doğru tahmin', v: `${matches} / ${rounds}` }
      : game.engine === 'story'
        ? { k: 'Final', v: String(session.state?.path?.length ?? 1) + ' sahne' }
        : { k: 'Oynanan tur', v: String(rounds) };

  const candidates = content.games.filter((g) => g.is_active && g.id !== game.id && g.engine !== 'chat_game' && (!g.is_premium || isPremium));
  const next = candidates.length ? candidates[Math.floor(pick * candidates.length)] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <Stack.Screen options={{ gestureEnabled: false, animation: 'fade' }} />
      <GameBackground tone="rose" intensity={1.2} />
      <Hearts />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', gap: sz(20, 14), paddingTop: insets.top + sz(40, 20), paddingBottom: Math.max(insets.bottom, 16) + 12, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, color: colors.blush, textAlign: 'center' }}>{`${upper(game.name)} · TAMAMLANDI`}</Text>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: sz(56, 46), lineHeight: sz(54, 45), color: colors.pearl, textAlign: 'center' }}>
          {copy.a}
          {'\n'}
          <Text style={{ fontFamily: fonts.serifItalic, color: colors.blush }}>{copy.b}</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text maxFontSizeMultiplier={1.1} style={{ fontFamily: fonts.serif, fontSize: sz(96, 76), lineHeight: sz(100, 80), color: colors.pearl }}>{bigNumber.n}</Text>
          <Text maxFontSizeMultiplier={1.1} style={{ fontFamily: fonts.serif, fontSize: sz(36, 30), color: colors.mist }}>{bigNumber.of != null ? `/${bigNumber.of}` : bigUnit}</Text>
        </View>
        {bigCaption ? <Text style={{ marginTop: -sz(14, 10), fontFamily: fonts.medium, fontSize: 13, color: colors.mist, textAlign: 'center' }}>{bigCaption}</Text> : null}

        <View style={{ width: '100%', flexDirection: 'row', gap: 10 }}>
          <Stat k="Kazanılan" v={`+${xp} XP`} accent />
          <Stat k={second.k} v={second.v} />
        </View>

        {game.engine === 'roulette' && confessions.length ? (
          <View style={{ width: '100%', gap: 8 }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.blush }}>İTİRAFLAR</Text>
            {confessions.map((c, i) => (
              <View key={i} style={{ padding: 14, borderRadius: 18, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, gap: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.blush }}>{c.by === userId ? 'Sen' : partnerName}</Text>
                {c.prompt ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.mist }}>{c.prompt}</Text> : null}
                <Text style={{ fontFamily: fonts.serifItalic, fontSize: 19, lineHeight: 24, color: colors.pearl }}>{c.text ? `“${c.text}”` : 'Sesli itiraf etti 🎙️'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {game.engine === 'where' ? <WhereHistory rounds={whereRounds} userId={userId ?? ''} partnerName={partnerName} /> : null}

        {game.engine === 'shots' ? (
          <View style={{ width: '100%', flexDirection: 'row', gap: 10 }}>
            <Stat k="Sen" v={`${myShots} shot 🥃`} />
            <Stat k={partnerName} v={`${partnerShots} shot 🥃`} />
          </View>
        ) : null}

        <View style={{ width: '100%', gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.pearl }}>{`Seviye ${fl.level} · ${fl.name}`}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mist }}>{fl.next ? `${fmt(coupleXp)} / ${fmt(fl.next)}` : `${fmt(coupleXp)} XP`}</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <LinearGradient colors={[colors.rose, colors.iris]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(3, Math.min(100, progress * 100))}%`, height: '100%', borderRadius: 3 }} />
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />

        {next ? (
          <View style={{ width: '100%', padding: 16, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,230,240,.1)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <LinearGradient colors={[next.color || '#3A1740', colors.velvet]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.8 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Icon name={next.icon} size={28} color={colors.blush} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.mist }}>Sıradaki öneri</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.pearl }}>{`${next.name} · ${next.duration_label.split('·')[0].trim()}`}</Text>
            </View>
          </View>
        ) : null}

        <View style={{ width: '100%', gap: 4 }}>
          <Button title="Sonraki oyun" iconRight="arrow_forward" onPress={() => router.replace(next ? `/game/${next.slug}` : '/')} />
          <Button title="Ana sayfa" kind="ghost" size="md" onPress={() => router.replace('/')} />
          <Text style={{ textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.mute }}>Bu gece anılarınıza kaydedildi ♡</Text>
        </View>
      </ScrollView>
    </View>
  );
}

type QuizStats = { compatRounds: number; same: number; knowRounds: number; myCorrect: number; partnerCorrect: number };

function quizHeadline(q: QuizStats | null, matches: number, rounds: number, partnerName: string, emoji = false): { a: string; b: string } {
  if (q && q.knowRounds > 0 && q.compatRounds === 0) {
    const noun = emoji ? 'Bu oyun' : 'Bu test';
    if (q.myCorrect > q.partnerCorrect) return { a: noun, b: 'senin!' };
    if (q.partnerCorrect > q.myCorrect) return { a: noun, b: `${partnerName} kazandı!` };
    if (emoji) return { a: 'Berabere,', b: 'emoji ustalarısınız.' };
    return { a: 'Berabere,', b: 'ikiniz de bilgilisiniz.' };
  }
  if (rounds > 0 && matches === rounds) return { a: 'Kusursuz', b: 'uyum!' };
  return matches * 2 >= rounds ? { a: 'Aynı frekans,', b: 'aynı cevap.' } : { a: 'Farklı cevaplar,', b: 'tatlı sürprizler.' };
}

function headline(engine: string, matches: number, rounds: number): { a: string; b: string } {
  switch (engine) {
    case 'would_you_rather':
    case 'this_or_that':
      if (rounds > 0 && matches === rounds) return { a: 'Kusursuz', b: 'eşleştiniz!' };
      return matches > 0 ? { a: 'Harika,', b: 'eşleştiniz!' } : { a: 'Zıtlar', b: 'çekişir.' };
    case 'cards':
      if (rounds > 0 && matches === rounds) return { a: 'Hep aynı', b: 'kart!' };
      return matches * 2 >= rounds ? { a: 'Aynı kart,', b: 'aynı kalp.' } : { a: 'Farklı kartlar,', b: 'tatlı sürprizler.' };
    case 'know_me':
      return matches * 2 >= rounds ? { a: 'Birbirinizi', b: 'tanıyorsunuz.' } : { a: 'Keşfedecek', b: 'çok şey var.' };
    case 'secret_questions':
      return { a: 'Sırlar', b: 'açıldı.' };
    case 'challenges':
      return { a: 'Görevler', b: 'tamam!' };
    case 'story':
      return { a: 'Hikâyeniz', b: 'yazıldı.' };
    default:
      return { a: 'Cesursunuz,', b: 'ikiniz de.' };
  }
}

function fmt(n: number) {
  return n.toLocaleString('tr-TR');
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, padding: 14, borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, gap: 4 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.mist }}>{k}</Text>
      <Text numberOfLines={2} style={{ fontFamily: accent ? fonts.extrabold : fonts.bold, fontSize: accent ? 18 : 14, color: accent ? colors.blush : colors.pearl }}>
        {v}
      </Text>
    </View>
  );
}

/** Yükselen kalpler (tasarım: @keyframes rise) */
function Hearts() {
  const reduced = useReducedMotion();
  const vals = useState(() => [0, 1, 2, 3, 4, 5, 6].map(() => new Animated.Value(0)))[0];
  useEffect(() => {
    if (reduced) return;
    const loops = vals.map((v, i) =>
      Animated.sequence([
        Animated.delay(i * 450),
        Animated.loop(Animated.timing(v, { toValue: 1, duration: (3 + (i % 3)) * 1000, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      ]),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduced, vals]);
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 120, height: 0 }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${12 + i * 12}%`,
            bottom: 0,
            opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -320] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) }],
          }}
        >
          <Icon name="favorite" size={14 + (i % 3) * 6} color={i % 2 ? colors.blush : colors.rose} />
        </Animated.View>
      ))}
    </View>
  );
}
