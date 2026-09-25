import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField, type DMY } from '@/components/DateField';
import { useDialog } from '@/components/Dialog';
import { Sheet } from '@/components/Sheet';
import { TimelineItem } from '@/components/Timeline';
import { Button, EmptyState, Field, Screen, SerifTitle, T } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';
import type { Memory } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

const PAGE = 50;

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 18, backgroundColor: colors.velvet, gap: 2 }}>
      <T v="h3" style={{ fontSize: 28, lineHeight: 32 }}>{n}</T>
      <T v="caption" numberOfLines={2} style={{ fontSize: 11 }}>{label}</T>
    </View>
  );
}

function daysSince(iso: string | null | undefined) {
  return iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0;
}

function todayDMY(): DMY {
  const d = new Date();
  return { d: d.getDate(), m: d.getMonth() + 1, y: d.getFullYear() };
}

export default function Memories() {
  const { couple, partner, userId } = useApp();
  const toast = useToast();
  const { show } = toast;
  const { dialog, ask } = useDialog();
  const cid = couple?.status === 'active' && partner ? couple.id : null;
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState<'idle' | 'loading' | 'done'>('idle');
  const [stats, setStats] = useState({ games: 0, challenges: 0 });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [date, setDate] = useState<DMY>(todayDMY());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!cid) {
      setItems([]);
      setLoading(false);
      return;
    }
    const [m, g, c] = await Promise.all([
      supabase.from('memories').select('*').eq('couple_id', cid).order('happened_at', { ascending: false }).limit(PAGE),
      supabase.from('game_sessions').select('id', { count: 'exact', head: true }).eq('couple_id', cid).eq('status', 'finished'),
      supabase.from('challenge_completions').select('id', { count: 'exact', head: true }).eq('couple_id', cid).eq('skipped', false),
    ]);
    if (m.error) show(errorText(m.error), 'error');
    else {
      setItems((m.data as Memory[]) ?? []);
      setMore((m.data?.length ?? 0) < PAGE ? 'done' : 'idle');
    }
    setStats({ games: g.count ?? 0, challenges: c.count ?? 0 });
    setLoading(false);
  }, [cid, show]);

  const loadMore = async () => {
    if (!cid || more !== 'idle' || !items.length) return;
    setMore('loading');
    const last = items[items.length - 1];
    const { data } = await supabase.from('memories').select('*').eq('couple_id', cid).lt('happened_at', last.happened_at).order('happened_at', { ascending: false }).limit(PAGE);
    setItems((cur) => {
      const ids = new Set(cur.map((x) => x.id));
      return [...cur, ...((data as Memory[]) ?? []).filter((x) => !ids.has(x.id))];
    });
    setMore((data?.length ?? 0) < PAGE ? 'done' : 'idle');
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!cid) return;
    const ch = supabase
      .channel(`memories:${cid}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memories', filter: `couple_id=eq.${cid}` }, (p) => {
        const row = p.new as Memory;
        setItems((cur) => (cur.some((x) => x.id === row.id) ? cur : [row, ...cur].sort((a, b) => (a.happened_at < b.happened_at ? 1 : -1))));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'memories' }, (p) => {
        const id = (p.old as { id?: string })?.id;
        if (id) setItems((cur) => cur.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const save = async () => {
    if (!cid || !userId) return;
    if (title.trim().length < 2) {
      toast.show('Anıya kısa bir başlık ver.', 'info');
      return;
    }
    setSaving(true);
    try {
      const now = new Date();
      const happened = new Date(date.y, date.m - 1, date.d, now.getHours(), now.getMinutes());
      const { data, error } = await supabase
        .from('memories')
        .insert({ couple_id: cid, created_by: userId, kind: 'special', title: title.trim(), subtitle: subtitle.trim(), color: '#F4B9C8', happened_at: happened.toISOString() })
        .select('*')
        .single();
      if (error) throw error;
      const row = data as Memory;
      setItems((cur) => (cur.some((x) => x.id === row.id) ? cur : [row, ...cur].sort((a, b) => (a.happened_at < b.happened_at ? 1 : -1))));
      setAdding(false);
      setTitle('');
      setSubtitle('');
      setDate(todayDMY());
      toast.show('Anı eklendi ♡', 'ok');
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (m: Memory) =>
    ask({
      icon: 'delete',
      tone: 'error',
      title: 'Bu anıyı sil?',
      desc: `“${m.title}” ikiniz için de zaman çizelgesinden kalkar. Bu işlem geri alınamaz.`,
      actions: [
        {
          label: 'Sil',
          kind: 'danger',
          onPress: async () => {
            const { error } = await supabase.from('memories').delete().eq('id', m.id);
            if (error) throw error;
            setItems((cur) => cur.filter((x) => x.id !== m.id));
          },
        },
        { label: 'Vazgeç', kind: 'ghost' },
      ],
    });

  if (!cid) {
    return (
      <Screen contentStyle={{ justifyContent: 'center' }}>
        <EmptyState icon="auto_stories" title="Anılarınız burada görünecek." desc="Birlikte oynadığınız oyunlar, rozetler ve özel anlar bir zaman çizelgesine dönüşür. Önce partnerini davet et." action="Partnerini davet et" onAction={() => router.push('/invite')} />
      </Screen>
    );
  }

  const since = couple?.anniversary ?? couple?.connected_at;
  const days = daysSince(since);
  const year = new Date().getFullYear();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={<RefreshControl tintColor={colors.blush} refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListHeaderComponent={
            <View style={{ gap: 14, paddingTop: 6, paddingBottom: 20 }}>
              <SerifTitle text="Anılar" v="h1" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Stat n={stats.games} label="oyun" />
                <Stat n={stats.challenges} label="görev" />
                <Stat n={days} label="gün birlikte" />
              </View>
              <Button title="Özel an ekle" icon="add" kind="outline" size="md" onPress={() => setAdding(true)} />
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.rose} style={{ marginTop: 32 }} />
            ) : (
              <EmptyState icon="auto_stories" title="Anılarınız burada görünecek." desc="İlk oyununuzu oynayın ya da yukarıdan özel bir an ekleyin." />
            )
          }
          ListFooterComponent={more === 'loading' ? <ActivityIndicator color={colors.blush} style={{ marginVertical: 12 }} /> : null}
          renderItem={({ item, index }) => <TimelineItem m={item} last={index === items.length - 1} onLongPress={() => confirmDelete(item)} />}
        />
      </SafeAreaView>

      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        label="ÖZEL AN"
        title="Bir anı ekle"
        footer={<Button title="Kaydet" loading={saving} disabled={title.trim().length < 2} onPress={save} />}
      >
        <Field label="Başlık" placeholder="Örn. İlk dans" value={title} onChangeText={setTitle} maxLength={80} />
        <Field label="Not · opsiyonel" placeholder="O geceden aklında kalan…" value={subtitle} onChangeText={setSubtitle} maxLength={200} multiline inputStyle={{ minHeight: 80, textAlignVertical: 'top' }} />
        <DateField label="Tarih" value={date} onChange={setDate} minYear={year - 30} maxYear={year} sheetTitle="Anının tarihi" />
      </Sheet>
      {dialog}
    </View>
  );
}
