import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useDialog } from '@/components/Dialog';
import { Chip, EmptyState, Icon, Pill, Screen, SerifTitle, T, TintCard } from '@/components/ui';
import type { Engine, Game } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { colors } from '@/theme';

type Filter = { key: string; label: string; test: (g: Game) => boolean };

const minutes = (g: Game) => {
  const m = /(\d+)\s*dk/i.exec(g.duration_label ?? '');
  return m ? Number(m[1]) : null;
};
const is = (...e: Engine[]) => (g: Game) => e.includes(g.engine);

const FILTERS: Filter[] = [
  { key: 'all', label: 'Tümü', test: () => true },
  { key: 'quick', label: 'Hızlı', test: (g) => (minutes(g) ?? 99) <= 6 },
  { key: 'questions', label: 'Sorular', test: is('would_you_rather', 'know_me', 'secret_questions', 'this_or_that', 'quiz', 'emoji', 'cards') },
  { key: 'dare', label: 'Cesaret & Görev', test: is('truth_dare', 'challenges') },
  { key: 'story', label: 'Hikâye', test: is('story') },
  { key: 'chat', label: 'Sohbet', test: is('chat_game') },
];

export default function Games() {
  const { games, loading, refresh } = useContent();
  const { isPremium, couple, partner } = useApp();
  const { dialog, ask } = useDialog();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const connected = couple?.status === 'active' && !!partner;

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    return games.filter((g) => g.is_active && f.test(g)).sort((a, b) => a.sort - b.sort);
  }, [games, filter]);
  const filters = FILTERS.filter((f) => f.key === 'all' || games.some((g) => g.is_active && f.test(g)));

  const open = (g: Game) => {
    if (!connected) {
      ask({
        icon: 'lock',
        title: 'Oda kilitli',
        desc: 'Oyunlar iki kişiliktir. Partnerin odana katıldığında tüm oyunlar açılır.',
        actions: [
          { label: 'Partnerini davet et', icon: 'favorite', onPress: () => router.push('/invite') },
          { label: 'Kodum var · Katıl', kind: 'outline', onPress: () => router.push('/join') },
          { label: 'Vazgeç', kind: 'ghost' },
        ],
      });
      return;
    }
    router.push(`/game/${g.slug}`);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh(true).catch(() => {});
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ paddingTop: 6, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <SerifTitle text="Oyunlar" v="h1" />
        {!isPremium ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/premium')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Pill text="PREMIUM" tone="pro" />
          </Pressable>
        ) : null}
      </View>

      {!connected ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/invite')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, backgroundColor: colors.velvet, borderWidth: 1, borderColor: 'rgba(242,194,123,.3)', opacity: pressed ? 0.85 : 1 })}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.warningTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="lock" size={22} color={colors.warning} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="title" style={{ fontSize: 15 }}>Oda kilitli</T>
            <T v="caption">Oynamak için partnerini davet et.</T>
          </View>
          <Icon name="chevron_right" size={22} color={colors.mist} />
        </Pressable>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {filters.map((f) => (
          <Chip key={f.key} label={f.label} tone="light" active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      {!visible.length ? (
        loading ? null : <EmptyState icon="style" title="Burada henüz oyun yok" desc="Başka bir filtre dene ya da aşağı çekerek yenile." tone="mute" />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {visible.map((g) => {
            const locked = g.is_premium && !isPremium;
            return (
              <TintCard
                key={g.id}
                color={g.color}
                accessibilityLabel={`${g.name}${locked ? ', Premium' : ''}`}
                onPress={() => (locked ? router.push('/premium') : open(g))}
                style={{ flexBasis: '47%', flexGrow: 1, minHeight: 150, padding: 14, borderRadius: 24, justifyContent: 'space-between', gap: 14 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <Icon name={g.icon} size={22} color={colors.blush} />
                  {g.is_premium ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {locked ? <Icon name="lock" size={14} color={colors.irisSoft} /> : null}
                      <Pill text="PREMIUM" tone="pro" style={{ paddingHorizontal: 7, paddingVertical: 3 }} />
                    </View>
                  ) : null}
                </View>
                <View style={{ gap: 4 }}>
                  <T v="h3" style={{ fontSize: 21, lineHeight: 23 }}>{g.name}</T>
                  {g.duration_label ? <T v="caption" style={{ fontSize: 11.5 }}>{g.duration_label}</T> : null}
                </View>
              </TintCard>
            );
          })}
        </View>
      )}
      {dialog}
    </Screen>
  );
}
