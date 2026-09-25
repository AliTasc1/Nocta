import { useCallback, useEffect, useRef, useState } from 'react';

import { useApp } from '@/providers/AppProvider';
import { supabase } from './supabase';
import type { GameSession } from './types';

/**
 * Çiftin şu anki (lobide ya da oynanan) oyun oturumu — gerçek zamanlı.
 * Partner yeni bir oyun başlattığında `session` anında güncellenir.
 */
export function useActiveSession() {
  const { couple } = useApp();
  const cid = couple?.status === 'active' ? couple.id : null;
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!cid) return;
    const { data } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('couple_id', cid)
      .in('status', ['lobby', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!alive.current) return;
    setSession((data as GameSession) ?? null);
    setLoading(false);
  }, [cid]);

  useEffect(() => {
    alive.current = true;
    if (!cid) return;
    reload().catch(() => setLoading(false));
    const ch = supabase
      .channel(`active-session:${cid}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `couple_id=eq.${cid}` }, () => {
        reload().catch(() => {});
      })
      .subscribe();
    return () => {
      alive.current = false;
      supabase.removeChannel(ch);
    };
  }, [cid, reload]);

  // Oda yoksa oturum da yok (durumdan türetilir)
  return { session: cid && session?.couple_id === cid ? session : null, loading: cid ? loading : false, reload };
}

/** Oturumun durumuna göre gidilecek ekran */
export function sessionRoute(s: Pick<GameSession, 'id' | 'status'>): string {
  return s.status === 'lobby' ? `/lobby/${s.id}` : `/play/${s.id}`;
}
