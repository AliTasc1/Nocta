import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApp } from '@/providers/AppProvider';
import { supabase } from './supabase';
import type { DailyChallenge } from './types';

/** Günün görevi + canlı geri sayım + tamamla / atla */
export function useDaily() {
  const { couple, refreshCouple } = useApp();
  const [data, setData] = useState<DailyChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const deadline = useRef(0);
  const reloading = useRef(false);

  const reload = useCallback(async () => {
    if (reloading.current) return;
    reloading.current = true;
    try {
      const { data: d, error: e } = await supabase.rpc('get_daily_challenge');
      if (e) throw e;
      const dc = (d ?? { question: null }) as DailyChallenge;
      setData(dc);
      setError(null);
      deadline.current = Date.now() + Math.max(0, dc.seconds_left ?? 0) * 1000;
      setSecondsLeft(Math.max(0, dc.seconds_left ?? 0));
    } catch (e) {
      setError(e);
    } finally {
      reloading.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Oda değişince (bağlanma / kopma) seviyeye göre görev değişebilir
  useEffect(() => {
    reload();
  }, [couple?.id, couple?.status, reload]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!deadline.current) return;
      const s = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s === 0) {
        deadline.current = 0;
        setTimeout(reload, 1500); // yeni gün → yeni görev
      }
    }, 1000);
    return () => clearInterval(t);
  }, [reload]);

  const questionId = data?.question?.id ?? null;
  const complete = useCallback(
    async (skipped: boolean) => {
      if (!questionId) return null;
      // Partner az önce tamamlamış olabilir: sunucu aynı gün ikinci tamamlamayı engellemediği için önce kontrol et
      const { data: fresh } = await supabase.rpc('get_daily_challenge');
      if ((fresh as DailyChallenge | null)?.completed) {
        await reload();
        return { xp: 0, already: true } as { xp: number; already?: boolean };
      }
      const { data: r, error: e } = await supabase.rpc('complete_daily_challenge', { p_question: questionId, p_skipped: skipped });
      if (e) throw e;
      await Promise.all([reload(), skipped ? Promise.resolve() : refreshCouple()]);
      return r as { xp: number; already?: boolean };
    },
    [questionId, reload, refreshCouple],
  );

  return { data, loading, error, secondsLeft, reload, complete };
}
