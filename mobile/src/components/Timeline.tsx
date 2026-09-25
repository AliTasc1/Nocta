import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { upperDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Memory } from '@/lib/types';
import { colors } from '@/theme';
import { T } from './ui';

const urlCache = new Map<string, { url: string; exp: number }>();

function readCache(path: string | null | undefined): string | null {
  if (!path) return null;
  const c = urlCache.get(path);
  return c && c.exp > Date.now() ? c.url : null;
}

/** chat-media kovasındaki özel dosya için kısa süreli imzalı bağlantı (önbellekli) */
export function useSignedUrl(path: string | null | undefined) {
  const [fetched, setFetched] = useState<{ path: string; url: string | null; failed: boolean } | null>(null);
  const cached = readCache(path);

  useEffect(() => {
    if (!path || readCache(path)) return;
    let alive = true;
    supabase.storage
      .from('chat-media')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data?.signedUrl) return setFetched({ path, url: null, failed: true });
        urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
        setFetched({ path, url: data.signedUrl, failed: false });
      })
      .catch(() => alive && setFetched({ path, url: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [path]);

  const mine = fetched && fetched.path === path ? fetched : null;
  return { url: cached ?? mine?.url ?? null, failed: !cached && !!mine?.failed };
}

function MemoryPhoto({ path }: { path: string }) {
  const { url } = useSignedUrl(path);
  return (
    <View style={{ height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}>
      {url ? <Image source={{ uri: url }} style={{ flex: 1 }} contentFit="cover" transition={200} accessibilityLabel="Anı fotoğrafı" /> : null}
    </View>
  );
}

/** Tasarım: 20 · Memories — renkli nokta + dikey çizgi zaman çizelgesi satırı */
export function TimelineItem({ m, last, onLongPress }: { m: Memory; last?: boolean; onLongPress?: () => void }) {
  const dot = m.color || colors.rose;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityHint={onLongPress ? 'Silmek için basılı tut' : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 14, opacity: pressed && onLongPress ? 0.8 : 1 })}
    >
      <View style={{ width: 18, alignItems: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: dot, shadowColor: dot, shadowOpacity: 0.8, shadowRadius: 8, elevation: 3 }} />
        {!last ? <View style={{ flex: 1, width: 1, backgroundColor: colors.lineStrong, marginTop: 4 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 4 : 20, gap: 6 }}>
        <T v="label" color={colors.mist} style={{ fontSize: 10.5, letterSpacing: 1 }}>{upperDate(m.happened_at)}</T>
        <T v="title" style={{ fontSize: 15, lineHeight: 21 }}>{m.title}</T>
        {m.subtitle ? <T v="bodySm" style={{ fontSize: 13, lineHeight: 19 }}>{m.subtitle}</T> : null}
        {m.photo_path ? <MemoryPhoto path={m.photo_path} /> : null}
      </View>
    </Pressable>
  );
}
