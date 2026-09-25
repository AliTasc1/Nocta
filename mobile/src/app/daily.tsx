import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Avatar, Button, EmptyState, GlowBackground, Icon, IconButton, ProgressBar, Screen, T } from '@/components/ui';
import { hms, mmss } from '@/lib/format';
import { errorText } from '@/lib/supabase';
import { useDaily } from '@/lib/useDaily';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';

const MONTHS = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

function dayLabel(day?: string) {
  const d = day ? new Date(`${day}T12:00:00`) : new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Görevin kendi süresi (timer_seconds) için başlat / durdur sayacı */
function TaskTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const end = useRef(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((end.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) setRunning(false);
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  const start = () => {
    const from = left === 0 ? seconds : left;
    end.current = Date.now() + from * 1000;
    setLeft(from);
    setRunning(true);
  };

  return (
    <View style={{ gap: 10, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.04)', borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="timer" size={20} color={left === 0 ? colors.success : colors.warning} />
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: 22, color: colors.pearl }} accessibilityLabel={`Kalan ${left} saniye`}>{mmss(left)}</Text>
        </View>
        <Button
          title={running ? 'Durdur' : left === 0 ? 'Yeniden' : left < seconds ? 'Devam' : 'Başlat'}
          size="sm"
          kind={running ? 'outline' : 'light'}
          icon={running ? 'pause' : 'play_arrow'}
          onPress={running ? () => setRunning(false) : start}
        />
      </View>
      <ProgressBar value={1 - left / seconds} color={left === 0 ? colors.success : colors.warning} height={4} />
      {left === 0 ? <T v="caption" color={colors.success}>Süre doldu! Görevi tamamladıysanız aşağıdan işaretleyin.</T> : null}
    </View>
  );
}

export default function Daily() {
  const { couple, partner } = useApp();
  const { data, loading, error, secondsLeft, reload, complete } = useDaily();
  const { show } = useToast();
  const [busy, setBusy] = useState<'done' | 'skip' | null>(null);
  const connected = couple?.status === 'active' && !!partner;
  const q = data?.question;

  const act = async (skipped: boolean) => {
    setBusy(skipped ? 'skip' : 'done');
    try {
      const r = await complete(skipped);
      if (r?.already) show('Partnerin bugünün görevini zaten tamamlamış ♡', 'info');
      else if (!skipped) show(`Görev tamamlandı · +${r?.xp ?? 30} XP`, 'ok');
      else show('Görev atlandı. Hiçbir puan kaybetmediniz.', 'info');
    } catch (e) {
      show(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      edges={['top', 'bottom']}
      bg={<GlowBackground variant="center" />}
      contentStyle={{ gap: 22 }}
      footer={
        q && connected ? (
          data?.completed ? (
            <Button title="Ana sayfaya dön" kind="outline" onPress={back} />
          ) : (
            <View style={{ gap: 6 }}>
              <Button title="Tamamla" icon="check" loading={busy === 'done'} disabled={busy === 'skip'} onPress={() => act(false)} />
              {!data?.skipped ? <Button title="Atla · puan kaybı yok" kind="ghost" size="sm" loading={busy === 'skip'} disabled={busy === 'done'} onPress={() => act(true)} /> : null}
            </View>
          )
        ) : null
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <IconButton name="arrow_back" label="Geri" onPress={back} />
        {(couple?.streak_days ?? 0) > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.warningTint }}>
            <Icon name="local_fire_department" size={16} color={colors.warning} />
            <T v="caption" color={colors.warning} style={{ fontWeight: '700' }}>{`${couple?.streak_days} gün seri`}</T>
          </View>
        ) : null}
      </View>

      {loading && !data ? (
        <ActivityIndicator color={colors.rose} style={{ marginTop: 60 }} />
      ) : error && !data ? (
        <EmptyState icon="wifi_off" tone="warn" title="Görev yüklenemedi" desc={errorText(error)} action="Tekrar dene" onAction={reload} />
      ) : !q ? (
        <EmptyState icon="nightlight" title="Bugün için görev yok" desc="Yeni görevler yakında eklenecek. Yarın tekrar bak." tone="mute" />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <T v="label" color={colors.warning}>{`GÜNÜN GÖREVİ · ${dayLabel(data?.day)}`}</T>
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 44, lineHeight: 50, color: colors.pearl }} accessibilityLabel={`Kalan süre ${hms(secondsLeft)}`}>
              {hms(secondsLeft)}
            </Text>
            <T v="bodySm">kalan süre</T>
          </View>

          <View style={{ padding: 22, borderRadius: 28, backgroundColor: colors.velvet, borderWidth: 1, borderColor: data?.completed ? 'rgba(127,209,174,.4)' : 'rgba(242,194,123,.3)', gap: 18 }}>
            <T v="h2" style={{ fontSize: 28, lineHeight: 33 }}>{q.text}</T>
            {q.timer_seconds && !data?.completed ? <TaskTimer seconds={q.timer_seconds} /> : null}
            {data?.completed ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="check_circle" size={22} color={colors.success} />
                <T v="body" color={colors.success} style={{ fontWeight: '700', flex: 1 }}>Bugünün görevi tamamlandı · +30 XP</T>
              </View>
            ) : data?.skipped ? (
              <T v="bodySm">Bu görevi atladınız. Fikrinizi değiştirirseniz yine de tamamlayabilirsiniz.</T>
            ) : null}
          </View>

          {connected ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={partner?.display_name} color={partner?.avatar_color} size={28} />
              <T v="bodySm" style={{ flex: 1 }}>
                {data?.completed ? 'Görev ikiniz için de tamamlandı. Yarın yeni bir görev sizi bekliyor.' : `Görevi ${partner?.display_name} ile birlikte yapın; biriniz tamamladığında ikiniz de XP kazanırsınız.`}
              </T>
            </View>
          ) : (
            <EmptyState icon="lock" tone="warn" title="Partner gerekli" desc="Günün görevini tamamlamak için önce partnerinle bağlan." action="Davet et" onAction={() => router.push('/invite')} />
          )}
        </>
      )}
    </Screen>
  );
}
