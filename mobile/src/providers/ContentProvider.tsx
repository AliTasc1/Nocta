import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Achievement, Category, Game, Question, Story } from '@/lib/types';
import { useApp } from './AppProvider';

/**
 * İçerik kataloğu. Yönetici panelinden eklenen oyun/kategori/soru/hikâyeler
 * `content_version` değiştiğinde otomatik indirilir ve cihazda önbelleğe alınır.
 * Böylece yeni içerik için mağaza güncellemesi gerekmez.
 */
type Catalog = {
  version: number;
  games: Game[];
  categories: Category[];
  questions: Question[];
  stories: Story[];
  achievements: Achievement[];
  settings: Record<string, any>;
};

type ContentCtx = Catalog & {
  loading: boolean;
  refresh: (force?: boolean) => Promise<void>;
  gameBySlug: (slug: string) => Game | undefined;
  gameById: (id: string) => Game | undefined;
  questionById: (id: string) => Question | undefined;
  categoriesFor: (gameId: string) => Category[];
  questionCount: (gameId: string, categoryId?: string | null) => number;
};

const EMPTY: Catalog = { version: 0, games: [], categories: [], questions: [], stories: [], achievements: [], settings: {} };
const CACHE_KEY = 'nocta.catalog.v1';
const Ctx = createContext<ContentCtx | null>(null);

export function useContent() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useContent, ContentProvider içinde kullanılmalı');
  return v;
}

async function fetchAll<T>(table: string, order = 'sort'): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const { userId, isPremium, couple } = useApp();
  const [catalog, setCatalog] = useState<Catalog>(EMPTY);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  // Önbellekten anında yükle
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (raw) setCatalog(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!userId || busy.current) return;
      busy.current = true;
      try {
        const { data: settingsRows } = await supabase.from('app_settings').select('key,value');
        const settings = Object.fromEntries((settingsRows ?? []).map((r: any) => [r.key, r.value]));
        const version = Number(settings.content_version ?? 0);
        if (!force && version === catalogRef.current.version && catalogRef.current.games.length) {
          setCatalog((c) => ({ ...c, settings }));
          return;
        }
        const [games, categories, questions, stories, achievements] = await Promise.all([
          fetchAll<Game>('games'),
          fetchAll<Category>('categories'),
          fetchAll<Question>('questions', 'created_at'),
          fetchAll<Story>('stories'),
          fetchAll<Achievement>('achievements'),
        ]);
        const next: Catalog = { version, games, categories, questions, stories, achievements, settings };
        setCatalog(next);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next)).catch(() => {});
      } catch {
        // çevrimdışı: önbellekteki içerikle devam
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [userId],
  );

  // Giriş, premium değişimi (RLS farklı soru döndürür), odaya bağlanma → zorla tazele
  useEffect(() => {
    if (userId) refresh(true);
  }, [userId, isPremium, couple?.status, refresh]);

  // Yönetici içerik değiştirince realtime ile haber al
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel('content-version')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => refresh())
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      supabase.removeChannel(ch);
      sub.remove();
    };
  }, [userId, refresh]);

  const value = useMemo<ContentCtx>(() => {
    const qById = new Map(catalog.questions.map((q) => [q.id, q]));
    const catGame = new Map(catalog.categories.map((c) => [c.id, c.game_id]));
    return {
      ...catalog,
      loading,
      refresh,
      gameBySlug: (slug) => catalog.games.find((g) => g.slug === slug),
      gameById: (id) => catalog.games.find((g) => g.id === id),
      questionById: (id) => qById.get(id),
      categoriesFor: (gameId) => catalog.categories.filter((c) => c.game_id === gameId && c.is_active),
      questionCount: (gameId, categoryId) =>
        catalog.questions.filter(
          (q) => q.is_active && (categoryId ? q.category_id === categoryId : catGame.get(q.category_id) === gameId),
        ).length,
    };
  }, [catalog, loading, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Oturumdaki soruları getirir: önce önbellek, eksikse sunucudan */
export async function loadQuestions(ids: string[], cached: (id: string) => Question | undefined): Promise<Record<string, Question>> {
  const out: Record<string, Question> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const q = cached(id);
    if (q) out[id] = q;
    else missing.push(id);
  }
  if (missing.length) {
    const { data } = await supabase.from('questions').select('*').in('id', missing);
    for (const q of (data ?? []) as Question[]) out[q.id] = q;
  }
  return out;
}
