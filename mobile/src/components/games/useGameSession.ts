import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { errorText, supabase } from '@/lib/supabase';
import type { Game, GameSession, Profile, Question, SessionAnswer } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { loadQuestions, useContent } from '@/providers/ContentProvider';
import { useToast } from '@/providers/ToastProvider';
import { joinGameChannel, type GameChannelHandle } from './gameChannel';
import { finishCache, type FinishResult, type Player } from './shared';

type BroadcastHandler = (payload: Record<string, any>) => void;

const ts = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/**
 * Bir oyun oturumunun ortak mantığı:
 *  - oturum + cevaplar (Realtime postgres_changes + broadcast + yedek yoklama)
 *  - partner presence
 *  - cevap gönderme, tur ilerletme (yarış korumalı), bitirme, ayrılma
 *
 * RLS gereği partnerin cevabı ancak sen de o turu cevapladıktan sonra görünür;
 * bu yüzden kendi cevabından sonra, her oturum güncellemesinde ve beklerken
 * düzenli aralıklarla cevaplar yeniden çekilir.
 */
export function useGameSession(sessionId: string) {
  const { userId, profile, partner: appPartner, couple: appCouple } = useApp();
  const content = useContent();
  const { show: showToast } = useToast();

  const [session, setSession] = useState<GameSession | null>(null);
  const [fetchedGame, setFetchedGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<SessionAnswer[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [online, setOnline] = useState<string[]>([]);
  const [partnerFlags, setPartnerFlags] = useState<Record<number, boolean>>({});
  const [fetchedMembers, setFetchedMembers] = useState<{ id: string; user_a: string; user_b: string | null } | null>(null);
  const [fetchedPartner, setFetchedPartner] = useState<Pick<Profile, 'id' | 'display_name' | 'avatar_color'> | null>(null);
  const [busy, setBusy] = useState(false);

  const sessionRef = useRef<GameSession | null>(null);
  const answersRef = useRef<SessionAnswer[]>([]);
  const answerSeq = useRef(0);
  const answerApplied = useRef(0);
  const channelRef = useRef<GameChannelHandle | null>(null);
  const handlers = useRef(new Map<string, Set<BroadcastHandler>>());
  const advancing = useRef<number | null>(null);
  const finishing = useRef(false);
  const leaving = useRef(false);
  const requestedQ = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // ── Oturum ────────────────────────────────────────────────
  const applySession = useCallback((s: GameSession | null | undefined) => {
    if (!s || !alive.current) return;
    const cur = sessionRef.current;
    // Sıra dışı gelen eski yanıtları yok say
    if (cur && cur.id === s.id && ts(s.updated_at) < ts(cur.updated_at)) return;
    sessionRef.current = s;
    setSession(s);
  }, []);

  const fetchSession = useCallback(async () => {
    const { data, error: e } = await supabase.from('game_sessions').select('*').eq('id', sessionId).maybeSingle();
    if (!alive.current) return null;
    if (e) {
      if (!sessionRef.current) setError(errorText(e));
      return null;
    }
    if (!data) {
      setError('Bu oyun bulunamadı ya da artık erişilemiyor.');
      return null;
    }
    setError(null);
    applySession(data as GameSession);
    return data as GameSession;
  }, [sessionId, applySession]);

  const fetchAnswers = useCallback(async () => {
    const seq = ++answerSeq.current;
    const { data, error: e } = await supabase.from('session_answers').select('*').eq('session_id', sessionId).order('round');
    if (!alive.current || e || seq < answerApplied.current) return;
    answerApplied.current = seq;
    const rows = (data ?? []) as SessionAnswer[];
    // İyimser (henüz sunucuya ulaşmamış) kendi cevaplarımızı koru
    const pending = answersRef.current.filter((a) => a.id.startsWith('local-') && !rows.some((r) => r.round === a.round && r.user_id === a.user_id));
    const next = [...rows, ...pending];
    answersRef.current = next;
    setAnswers(next);
  }, [sessionId]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchSession(), fetchAnswers()]);
  }, [fetchSession, fetchAnswers]);

  // İlk yükleme
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Oyun ve çift bilgisi (önbellekte yoksa sunucudan)
  const gameId = session?.game_id;
  const coupleId = session?.couple_id;
  const { gameById } = content;
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
        if (alive.current && data) setFetchedGame(data as Game);
      });
  }, [gameId, cachedGame]);

  const appMembers = appCouple && appCouple.id === coupleId ? appCouple : null;
  const members = appMembers
    ? { user_a: appMembers.user_a, user_b: appMembers.user_b }
    : fetchedMembers && fetchedMembers.id === coupleId
      ? fetchedMembers
      : null;
  useEffect(() => {
    if (!coupleId || appMembers) return;
    supabase
      .from('couples')
      .select('id,user_a,user_b')
      .eq('id', coupleId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive.current && data) setFetchedMembers(data as { id: string; user_a: string; user_b: string | null });
      });
  }, [coupleId, appMembers]);

  const partnerId = members ? (members.user_a === userId ? members.user_b : members.user_a) : appPartner?.id ?? null;
  const knownPartner = appPartner && appPartner.id === partnerId ? appPartner : null;
  const partnerProfile = knownPartner ?? (fetchedPartner && fetchedPartner.id === partnerId ? fetchedPartner : null);
  useEffect(() => {
    if (!partnerId || knownPartner) return;
    supabase
      .from('profiles')
      .select('id,display_name,avatar_color')
      .eq('id', partnerId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive.current && data) setFetchedPartner(data as Pick<Profile, 'id' | 'display_name' | 'avatar_color'>);
      });
  }, [partnerId, knownPartner]);

  // ── Sorular ───────────────────────────────────────────────
  const neededIds = useMemo(() => {
    if (!session) return [] as string[];
    const st = session.state ?? {};
    const ids = [...(session.question_ids ?? [])];
    if (Array.isArray(st.truths)) ids.push(...st.truths);
    if (Array.isArray(st.dares)) ids.push(...st.dares);
    if (typeof st.current === 'string') ids.push(st.current);
    return ids;
  }, [session]);

  useEffect(() => {
    const missing = neededIds.filter((id) => !questions[id] && !requestedQ.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => requestedQ.current.add(id));
    loadQuestions(missing, content.questionById)
      .then((found) => {
        if (!alive.current) return;
        missing.forEach((id) => {
          if (!found[id]) requestedQ.current.delete(id);
        });
        setQuestions((q) => ({ ...q, ...found }));
      })
      .catch(() => missing.forEach((id) => requestedQ.current.delete(id)));
  }, [neededIds, questions, content.questionById]);

  // ── Realtime: veritabanı değişiklikleri ──────────────────
  useEffect(() => {
    const nonce = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`gs:${sessionId}:${nonce}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` }, () => {
        // TOAST sütunları yükte eksik gelebilir: satırı yeniden çek
        fetchSession();
        fetchAnswers();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_answers', filter: `session_id=eq.${sessionId}` }, () => {
        fetchAnswers();
      })
      .subscribe((status) => {
        // (Yeniden) bağlanınca kaçırılan her şeyi tazele
        if (status === 'SUBSCRIBED') {
          fetchSession();
          fetchAnswers();
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, fetchSession, fetchAnswers]);

  // ── Realtime: presence + broadcast ────────────────────────
  useEffect(() => {
    if (!userId) return;
    const handle = joinGameChannel(sessionId, userId, {
      onPresence: (ids) => {
        if (alive.current) setOnline(ids);
      },
      onJoin: () => {
        // Partner yeni katıldı: bu turdaki durumumu tekrar yayınla
        const s = sessionRef.current;
        if (!s) return;
        const mine = answersRef.current.find((a) => a.round === s.current_index && a.user_id === userId);
        if (mine) handle.send('answered', { round: s.current_index, ...(mine.answer?.public ? { choice: mine.answer.choice } : {}) });
      },
      onBroadcast: (event, payload) => {
        if (payload.from === userId) return;
        if (event === 'answered' && typeof payload.round === 'number') {
          setPartnerFlags((f) => (f[payload.round] ? f : { ...f, [payload.round]: true }));
          if (answersRef.current.some((a) => a.round === payload.round && a.user_id === userId)) fetchAnswers();
        }
        if (event === 'sync') {
          fetchSession();
          fetchAnswers();
        }
        handlers.current.get(event)?.forEach((h) => h(payload));
      },
    });
    channelRef.current = handle;
    return () => {
      channelRef.current = null;
      handle.leave();
    };
  }, [sessionId, userId, fetchSession, fetchAnswers]);

  // Ön plana dönünce tazele
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refresh();
        channelRef.current?.retrack();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  // ── Türetilmiş değerler ──────────────────────────────────
  const round = session?.current_index ?? 0;
  const mineFor = useCallback((r: number) => answers.find((a) => a.round === r && a.user_id === userId), [answers, userId]);
  const partnerFor = useCallback((r: number) => answers.find((a) => a.round === r && a.user_id !== userId), [answers, userId]);
  const myAnswer = mineFor(round);
  const partnerAnswer = partnerFor(round);
  const partnerAnswered = !!partnerAnswer || !!partnerFlags[round];
  const waiting = session?.status === 'playing' && !!myAnswer && !partnerAnswer;

  const totalRounds = useMemo(() => {
    if (!session) return 0;
    const st = session.state ?? {};
    if (game?.engine === 'truth_dare') {
      const pool = (st.truths?.length ?? 0) + (st.dares?.length ?? 0);
      return Math.max(1, Math.min(game.rounds || 10, pool));
    }
    if (game?.engine === 'story') return Number.POSITIVE_INFINITY;
    return session.question_ids?.length ?? 0;
  }, [session, game]);
  const totalRef = useRef(totalRounds);
  useEffect(() => {
    totalRef.current = totalRounds;
  }, [totalRounds]);

  // Yedek yoklama: partner beklenirken sık, diğer zamanlarda seyrek
  const status = session?.status;
  useEffect(() => {
    if (!status || status === 'finished' || status === 'canceled') return;
    const iv = setInterval(
      () => {
        if (AppState.currentState !== 'active') return;
        fetchSession();
        if (waiting) fetchAnswers();
      },
      waiting ? 2500 : 6000,
    );
    return () => clearInterval(iv);
  }, [status, waiting, fetchSession, fetchAnswers]);

  const me: Player = { id: userId ?? '', name: profile?.display_name || 'Sen', color: profile?.avatar_color || '#2A1530' };
  const partner: Player = {
    id: partnerId ?? '',
    name: partnerProfile?.display_name || 'Partnerin',
    color: partnerProfile?.avatar_color || '#3A1D2B',
  };
  const amUserA = !!members && members.user_a === userId;
  const partnerOnline = !!partnerId && online.includes(partnerId);

  // ── Eylemler ─────────────────────────────────────────────
  const send = useCallback((event: string, payload: Record<string, any> = {}) => {
    channelRef.current?.send(event, payload);
  }, []);

  /** Motorların broadcast olaylarına abone olması için */
  const on = useCallback((event: string, h: BroadcastHandler) => {
    let set = handlers.current.get(event);
    if (!set) {
      set = new Set();
      handlers.current.set(event, set);
    }
    set.add(h);
    return () => {
      set?.delete(h);
    };
  }, []);

  const submitAnswer = useCallback(
    async (answer: Record<string, any>, opts: { round?: number; questionId?: string | null } = {}) => {
      const s = sessionRef.current;
      if (!s || !userId) return false;
      if (s.status !== 'playing') return false;
      const r = opts.round ?? s.current_index;
      if (answersRef.current.some((a) => a.round === r && a.user_id === userId)) return true;
      const qid = opts.questionId === undefined ? s.question_ids?.[r] ?? null : opts.questionId;
      const local: SessionAnswer = {
        id: `local-${r}`,
        session_id: s.id,
        round: r,
        user_id: userId,
        question_id: qid,
        answer,
        created_at: new Date().toISOString(),
      };
      answersRef.current = [...answersRef.current, local];
      setAnswers(answersRef.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const { error: e } = await supabase.from('session_answers').insert({ session_id: s.id, round: r, user_id: userId, question_id: qid, answer });
      if (e && e.code !== '23505') {
        answersRef.current = answersRef.current.filter((a) => a !== local);
        setAnswers(answersRef.current);
        showToast(errorText(e), 'error');
        fetchSession();
        return false;
      }
      // Seçimin kendisi yalnızca gizli olmayan oylarda (hikâye) yayınlanır
      send('answered', { round: r, ...(answer.public ? { choice: answer.choice } : {}) });
      await fetchAnswers();
      return true;
    },
    [userId, showToast, send, fetchAnswers, fetchSession],
  );

  const finish = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || finishing.current) return null;
    if (s.status === 'finished') return finishCache.get(s.id) ?? null;
    finishing.current = true;
    setBusy(true);
    try {
      const { data, error: e } = await supabase.rpc('finish_session', { p_session: s.id });
      if (e) throw e;
      const res = (data ?? {}) as FinishResult;
      if (!res.already) finishCache.set(s.id, res);
      send('sync');
      if (res.session) applySession(res.session as GameSession);
      else await fetchSession();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return res;
    } catch (e) {
      showToast(errorText(e), 'error');
      finishing.current = false;
      return null;
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [applySession, fetchSession, send, showToast]);

  /** Oturum durumunu (sığ birleştirme) ve/veya tur indeksini güncelle */
  const updateSession = useCallback(
    async (patch: Record<string, any> | null, nextIndex?: number) => {
      const s = sessionRef.current;
      if (!s || s.status !== 'playing') return null;
      const { data, error: e } = await supabase.rpc('update_session', {
        p_session: s.id,
        p_current_index: nextIndex ?? null,
        p_state: patch,
      });
      if (e) {
        showToast(errorText(e), 'error');
        return null;
      }
      applySession(data as GameSession);
      send('sync');
      return data as GameSession;
    },
    [applySession, send, showToast],
  );

  /**
   * `from` turundan bir sonrakine geç (sonuncuysa bitir). İndeks mutlak gönderildiği
   * için iki telefonun aynı anda basması aynı sonucu verir; sunucu çoktan ilerlediyse
   * çağrı yapılmaz.
   */
  const advance = useCallback(
    async (from: number, patch?: Record<string, any> | null) => {
      const s = sessionRef.current;
      if (!s || s.status !== 'playing') return;
      if (s.current_index !== from) return;
      if (advancing.current === from) return;
      advancing.current = from;
      setBusy(true);
      try {
        const next = from + 1;
        if (next >= totalRef.current) {
          const r = await finish();
          if (!r) advancing.current = null;
          return;
        }
        const res = await updateSession(patch ?? null, next);
        if (!res) advancing.current = null;
        else Haptics.selectionAsync().catch(() => {});
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [finish, updateSession],
  );

  const cancel = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    leaving.current = true;
    const { error: e } = await supabase.rpc('cancel_session', { p_session: s.id });
    if (e) {
      leaving.current = false;
      throw e;
    }
    send('sync');
  }, [send]);

  return {
    sessionId,
    userId: userId ?? '',
    session,
    game,
    loading,
    error,
    busy,
    questions,
    answers,
    round,
    totalRounds,
    myAnswer,
    partnerAnswer,
    partnerAnswered,
    partnerFlags,
    mineFor,
    partnerFor,
    waiting,
    me,
    partner,
    partnerId,
    amUserA,
    membersKnown: !!members,
    partnerOnline,
    isLeaving: () => leaving.current,
    refresh,
    fetchAnswers,
    submitAnswer,
    updateSession,
    advance,
    finish,
    cancel,
    send,
    on,
  };
}

export type GameApi = ReturnType<typeof useGameSession>;
export type EngineProps = { g: GameApi; onClose: () => void };
