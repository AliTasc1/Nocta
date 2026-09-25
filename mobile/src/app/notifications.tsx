import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, Header, Icon, T } from '@/components/ui';
import { relTime } from '@/lib/format';
import { errorText, supabase } from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

const KIND_COLOR: Record<string, string> = {
  challenge: colors.blush,
  invite: colors.blush,
  secret: colors.irisSoft,
  badge: colors.blush,
  connected: colors.success,
  challenge_done: colors.warning,
  daily: colors.warning,
  screenshot: colors.warning,
  disconnected: colors.error,
  game_done: colors.success,
};

export default function Notifications() {
  const { userId, refreshUnread } = useApp();
  const { show } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markAll = useCallback(async () => {
    const { error: e } = await supabase.rpc('mark_notifications_read');
    if (!e) {
      const at = new Date().toISOString();
      setItems((cur) => cur.map((n) => (n.read_at ? n : { ...n, read_at: at })));
      refreshUnread().catch(() => {});
    }
    return e;
  }, [refreshUnread]);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const { data, error: e } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
    if (e) {
      setError(errorText(e));
    } else {
      const rows = (data as AppNotification[]) ?? [];
      setItems(rows);
      // Açılışta okunmamış olanlar vurgulu kalsın, sonra hepsi okundu say
      setUnreadIds((prev) => new Set([...prev, ...rows.filter((n) => !n.read_at).map((n) => n.id)]));
      if (rows.some((n) => !n.read_at)) markAll();
    }
    setLoading(false);
  }, [userId, markAll]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notifications-screen:${userId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p) => {
        const n = p.new as AppNotification;
        setItems((cur) => (cur.some((x) => x.id === n.id) ? cur : [n, ...cur]));
        setUnreadIds((prev) => new Set([...prev, n.id]));
        markAll();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, markAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = (n: AppNotification) => {
    const route = typeof n.data?.route === 'string' ? (n.data.route as string) : null;
    if (route && route.startsWith('/')) router.push(route);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 10, flexGrow: 1 }}
          refreshControl={<RefreshControl tintColor={colors.blush} refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <Header
              onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              title="Bildirimler"
              right={
                items.length ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={async () => {
                      const e = await markAll();
                      if (e) show(errorText(e), 'error');
                      else setUnreadIds(new Set());
                    }}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <T v="bodySm" color={colors.blush} style={{ fontWeight: '700', fontSize: 12.5 }}>Tümünü oku</T>
                  </Pressable>
                ) : null
              }
            />
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.rose} style={{ marginTop: 40 }} />
            ) : error ? (
              <EmptyState icon="wifi_off" tone="warn" title="Bildirimler yüklenemedi" desc={error} action="Tekrar dene" onAction={load} />
            ) : (
              <EmptyState icon="notifications" title="Henüz bildirim yok" desc="Partnerin sana bir görev gönderdiğinde ya da oyuna çağırdığında burada göreceksin." tone="mute" />
            )
          }
          renderItem={({ item: n }) => {
            const unread = unreadIds.has(n.id);
            const tappable = typeof n.data?.route === 'string' && n.data.route.startsWith('/');
            return (
              <Pressable
                accessibilityRole={tappable ? 'button' : undefined}
                disabled={!tappable}
                onPress={() => open(n)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  gap: 12,
                  padding: 14,
                  borderRadius: 20,
                  backgroundColor: unread ? 'rgba(231,104,138,.06)' : colors.velvet,
                  borderWidth: 1,
                  borderColor: unread ? 'rgba(231,104,138,.25)' : colors.line,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.05)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={n.icon || 'notifications'} size={20} color={KIND_COLOR[n.kind] ?? colors.blush} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <T v="title" style={{ fontSize: 14, lineHeight: 19 }}>{n.title}</T>
                  {n.body ? <T v="bodySm" style={{ fontSize: 12.5, lineHeight: 18 }}>{n.body}</T> : null}
                  <T v="caption" color={colors.mute} style={{ fontSize: 11 }}>{relTime(n.created_at)}</T>
                </View>
                {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose, marginTop: 6 }} /> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}
