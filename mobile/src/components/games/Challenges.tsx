import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button, Icon } from '@/components/ui';
import { mmss } from '@/lib/format';
import { useContent } from '@/providers/ContentProvider';
import { colors, fonts } from '@/theme';
import { GameBackground, GameLayout, GameTopBar, haptic, levelName, PresenceAvatar, TypingDots, upper, useCompact } from './shared';
import type { EngineProps } from './useGameSession';

type Timer = { round: number; running: boolean; left: number; ends_at: number | null; v: number };

/**
 * 14 · Çift Görevleri — süreli görev. Süre durumu `state.timer` içinde saklanır
 * (yeniden bağlanan telefon kaldığı yerden devam eder) ve anında eşitleme için broadcast edilir.
 */
export function Challenges({ g, onClose }: EngineProps) {
  const { s: sz } = useCompact();
  const { categories } = useContent();
  const session = g.session!;
  const r = session.current_index;
  const qid = session.question_ids[r];
  const q = qid ? g.questions[qid] : undefined;
  const total = q?.timer_seconds ?? null;
  const category = q ? categories.find((c) => c.id === q.category_id) : undefined;

  const [local, setLocal] = useState<Timer | null>(null);
  const [pending, setPending] = useState<'timer' | 'done' | 'skip' | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Sunucudaki ve broadcast ile gelen süre durumundan en yenisi
  const server: Timer | null = session.state?.timer && session.state.timer.round === r ? (session.state.timer as Timer) : null;
  const localForRound = local && local.round === r ? local : null;
  const timer = [server, localForRound].filter(Boolean).sort((a, b) => (b!.v ?? 0) - (a!.v ?? 0))[0] ?? null;
  const running = !!timer?.running && !!timer.ends_at;
  const remaining = total == null ? 0 : !timer ? total : running ? Math.min(total, Math.max(0, Math.ceil((timer.ends_at! - now) / 1000))) : Math.max(0, timer.left);
  const finished = total != null && remaining <= 0;
  const started = !!timer;

  const { on, send } = g;
  useEffect(
    () =>
      on('timer', (p) => {
        if (p.timer && typeof p.timer.round === 'number') setLocal(p.timer as Timer);
      }),
    [on],
  );

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [running]);

  useEffect(() => {
    if (running && finished) haptic.success();
  }, [running, finished]);

  const setTimer = async (t: Timer) => {
    setLocal(t);
    setNow(Date.now());
    send('timer', { timer: t });
    setPending('timer');
    await g.updateSession({ timer: t });
    setPending(null);
  };

  const toggle = () => {
    if (total == null || pending) return;
    haptic.light();
    const v = Date.now();
    if (running) setTimer({ round: r, running: false, left: remaining, ends_at: null, v });
    else setTimer({ round: r, running: true, left: remaining, ends_at: Date.now() + remaining * 1000, v });
  };

  const complete = async (choice: 'done' | 'skip') => {
    if (pending) return;
    setPending(choice);
    const ok = await g.submitAnswer({ choice }, { round: r, questionId: qid });
    if (ok) {
      if (choice === 'done') haptic.success();
      await g.advance(r);
    }
    setPending(null);
  };

  const size = sz(200, 164);
  const stroke = 8;
  const rad = (size - stroke) / 2;
  const circ = 2 * Math.PI * rad;
  const pct = total ? (total - remaining) / total : 0;

  const primary =
    total == null || finished
      ? { title: 'Görevi tamamla', kind: 'success' as const, icon: 'check', onPress: () => complete('done'), loading: pending === 'done' }
      : running
        ? { title: 'Duraklat', kind: 'primary' as const, icon: 'pause', onPress: toggle, loading: pending === 'timer' }
        : { title: started ? 'Devam et' : 'Başlat', kind: 'primary' as const, icon: 'play_arrow', onPress: toggle, loading: pending === 'timer' };

  const lvl = upper(levelName(q?.level ?? session.level));

  return (
    <GameLayout
      bg={<GameBackground tone="rose" />}
      top={<GameTopBar onClose={onClose} center={`${r + 1} / ${g.totalRounds} GÖREV`} right={<PresenceAvatar player={g.partner} online={g.partnerOnline} />} />}
      footer={
        <>
          <Button title={primary.title} kind={primary.kind} icon={primary.icon} onPress={primary.onPress} loading={primary.loading} disabled={!q} />
          <Button title="Pas geç" kind="ghost" size="md" onPress={() => complete('skip')} loading={pending === 'skip'} disabled={!q} />
        </>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {category ? (
          <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,230,240,.14)' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.pearl }}>{category.name}</Text>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.pearl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onRose }}>{levelName(q?.level ?? session.level)}</Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mist }}>İlerleme</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mist }}>{`${r + 1} / ${g.totalRounds} görev`}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: g.totalRounds }).map((_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= r ? colors.rose : 'rgba(255,255,255,.1)' }} />
          ))}
        </View>
      </View>

      <View style={{ padding: sz(24, 20), borderRadius: 30, backgroundColor: colors.velvet, borderWidth: 1, borderColor: 'rgba(231,104,138,.4)', gap: 12 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, color: colors.blush }}>{`GÖREV ${String(r + 1).padStart(2, '0')} · ${lvl}`}</Text>
        {q ? (
          <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(30, 26), lineHeight: sz(34, 29), color: colors.pearl }}>{q.text}</Text>
        ) : (
          <TypingDots />
        )}
      </View>

      <View style={{ flex: 1, minHeight: size + 16, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', shadowColor: colors.rose, shadowOpacity: 0.3, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } }}>
          <Svg width={size} height={size} style={{ position: 'absolute' }}>
            <Circle cx={size / 2} cy={size / 2} r={rad} stroke="rgba(255,255,255,.07)" strokeWidth={stroke} fill={colors.ink} />
            {total != null ? (
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={rad}
                stroke={finished ? colors.success : colors.rose}
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={circ * (1 - (finished ? 1 : pct))}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            ) : null}
          </Svg>
          {total != null ? (
            <Text accessibilityRole="timer" style={{ fontFamily: fonts.mono, fontSize: sz(48, 40), color: colors.pearl }}>{mmss(remaining)}</Text>
          ) : (
            <Icon name="all_inclusive" size={sz(48, 40)} color={colors.blush} />
          )}
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mist, marginTop: 4 }}>
            {total == null ? 'süre yok, acele etmeyin' : finished ? 'tamamlandı' : running ? 'süre işliyor…' : started ? 'duraklatıldı' : 'hazır olduğunuzda'}
          </Text>
        </View>
      </View>
    </GameLayout>
  );
}
