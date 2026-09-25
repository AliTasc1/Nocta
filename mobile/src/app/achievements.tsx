import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { EmptyState, Header, Icon, Screen, T } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { CoupleAchievement } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { colors, flirtLevel, fonts } from '@/theme';

const LEVEL_NAMES = [1, 2, 3, 4, 5].map((l) => flirtLevel([0, 200, 500, 1000, 2000][l - 1]).name);

export default function Achievements() {
  const { couple } = useApp();
  const { achievements, refresh } = useContent();
  const [progress, setProgress] = useState<Record<string, CoupleAchievement>>({});
  const [refreshing, setRefreshing] = useState(false);

  const cid = couple?.id ?? null;
  const load = useCallback(async () => {
    if (!cid) return;
    const { data } = await supabase.from('couple_achievements').select('*').eq('couple_id', cid);
    const map: Record<string, CoupleAchievement> = {};
    ((data as CoupleAchievement[]) ?? []).forEach((r) => (map[r.achievement_id] = r));
    setProgress(map);
  }, [cid]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([load(), refresh()]);
    setRefreshing(false);
  };

  const xp = couple?.xp ?? 0;
  const lv = flirtLevel(xp);
  const nextName = lv.next ? flirtLevel(lv.next).name : null;
  const pct = lv.next ? (xp - lv.floor) / (lv.next - lv.floor) : 1;
  const list = [...achievements].sort((a, b) => a.sort - b.sort);
  const unlocked = list.filter((a) => progress[a.id]?.unlocked_at).length;

  return (
    <Screen edges={['top', 'bottom']} refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ gap: 18 }}>
      <Header onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} title="Rozetler" label={`${unlocked} / ${list.length} AÇILDI`} />

      <View style={{ borderRadius: 24, overflow: 'hidden', padding: 18, gap: 10, borderWidth: 1, borderColor: colors.lineStrong }}>
        <LinearGradient colors={[colors.plumViolet, colors.velvet]} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.9 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <T v="bodySm">{`Seviye ${lv.level} / 5`}</T>
          <T v="mono" style={{ fontSize: 12 }} color={colors.mist}>{lv.next ? `${xp} / ${lv.next} XP` : `${xp} XP`}</T>
        </View>
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, color: colors.pearl }}>
          {lv.name}
          {nextName ? <Text style={{ fontFamily: fonts.serifItalic, color: colors.blush }}>{` → ${nextName}`}</Text> : null}
        </Text>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
          <LinearGradient colors={[colors.rose, colors.iris]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(3, pct * 100)}%`, height: '100%' }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {LEVEL_NAMES.map((n, i) => (
            <T
              key={n}
              v="caption"
              center
              numberOfLines={2}
              style={{ flex: 1, fontSize: 10, lineHeight: 13, fontFamily: i + 1 === lv.level ? fonts.extrabold : fonts.semibold }}
              color={i + 1 < lv.level ? colors.blush : i + 1 === lv.level ? colors.pearl : colors.mist}
            >
              {n}
            </T>
          ))}
        </View>
        <T v="caption" color={colors.pearlSoft}>Oyun bitirdikçe ve günün görevini tamamladıkça birlikte XP kazanırsınız.</T>
      </View>

      {!list.length ? (
        <EmptyState icon="military_tech" title="Rozetler yükleniyor" desc="Aşağı çekerek yenileyebilirsin." tone="mute" />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map((a) => {
            const p = progress[a.id];
            const on = !!p?.unlocked_at;
            const prog = Math.min(p?.progress ?? 0, a.target);
            return (
              <View
                key={a.id}
                accessible
                accessibilityLabel={`${a.name}: ${on ? 'açıldı' : `${prog} / ${a.target}`}. ${a.description}`}
                style={{
                  width: '31%',
                  flexGrow: 0,
                  paddingVertical: 14,
                  paddingHorizontal: 8,
                  borderRadius: 20,
                  backgroundColor: colors.velvet,
                  borderWidth: 1,
                  borderColor: on ? 'rgba(244,185,200,.25)' : 'rgba(255,230,240,.06)',
                  alignItems: 'center',
                  gap: 8,
                  opacity: on ? 1 : 0.5,
                }}
              >
                <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={{
                      position: 'absolute',
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      transform: [{ rotate: '45deg' }],
                      backgroundColor: on ? colors.wine : 'rgba(255,255,255,.04)',
                      shadowColor: colors.rose,
                      shadowOpacity: on ? 0.35 : 0,
                      shadowRadius: 16,
                    }}
                  />
                  <Icon name={a.icon} size={26} color={on ? colors.blush : colors.faint} />
                </View>
                <T v="title" center style={{ fontSize: 12, lineHeight: 15 }}>{a.name}</T>
                <T v="caption" center style={{ fontSize: 10.5, lineHeight: 13 }}>
                  {on && p?.unlocked_at ? shortDate(p.unlocked_at) : a.target > 1 ? `${prog} / ${a.target}` : 'Kilitli'}
                </T>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
