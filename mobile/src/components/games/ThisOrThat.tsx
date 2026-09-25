import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';
import { GameLayout, GameTopBar, haptic, MetaText, MiniAvatar, optionsOf, TypingDots, useCompact, useReducedMotion, type Player } from './shared';
import type { EngineProps } from './useGameSession';

const ROUND_SECONDS = 10;

/** 16 · Bu mu Şu mu — hızlı seçim, ikiniz de seçince otomatik sonraki */
export function ThisOrThat({ g, onClose }: EngineProps) {
  const session = g.session!;
  const r = session.current_index;
  const qid = session.question_ids[r];
  const q = qid ? g.questions[qid] : undefined;
  const opts = optionsOf(q);
  const mine = g.myAnswer?.answer?.choice != null ? String(g.myAnswer.answer.choice) : null;
  const theirs = g.partnerAnswer?.answer?.choice != null ? String(g.partnerAnswer.answer.choice) : null;
  const revealed = mine != null && theirs != null;
  const matched = revealed && mine === theirs;

  // Toplam eşleşme (bu cihazın görebildiği turlar)
  let matches = 0;
  for (let i = 0; i < r + (revealed ? 1 : 0); i++) {
    const a = g.mineFor(i)?.answer?.choice;
    const b = g.partnerFor(i)?.answer?.choice;
    if (a != null && b != null && String(a) === String(b)) matches++;
  }


  // İkiniz de seçince ~1.2 sn sonra otomatik ilerle: yalnızca user_a çağırır,
  // user_a ulaşılamazsa user_b biraz daha bekleyip çağırır (indeks mutlak → çift çağrı zararsız)
  const { advance, amUserA, membersKnown } = g;
  useEffect(() => {
    if (!revealed || !membersKnown) return;
    (matched ? haptic.success : haptic.light)();
    const t = setTimeout(() => advance(r), amUserA ? 1200 : 3500);
    return () => clearTimeout(t);
  }, [revealed, matched, r, amUserA, membersKnown, advance]);

  const pick = (i: number) => {
    if (mine != null || !q) return;
    haptic.tap();
    g.submitAnswer({ choice: String(i) }, { round: r, questionId: qid });
  };

  const msg = !mine
    ? g.partnerAnswered
      ? `${g.partner.name} seçti · sıra sende`
      : 'Hızlı seç!'
    : !revealed
      ? `${g.partner.name} bekleniyor`
      : matched
        ? 'Eşleştiniz ♡ — sonraki →'
        : 'Farklı seçtiniz 👀 — sonraki →';

  const whoFor = (i: number): Player[] => {
    const w: Player[] = [];
    if (mine === String(i)) w.push(g.me);
    if (revealed && theirs === String(i)) w.push(g.partner);
    return w;
  };

  return (
    <GameLayout
      scroll={false}
      top={
        <GameTopBar
          onClose={onClose}
          center={`${r + 1} / ${g.totalRounds} · ${matches} EŞLEŞME`}
          right={<RoundClock key={r} stopped={mine != null} />}
        />
      }
      footer={
        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {mine && !revealed ? <TypingDots /> : null}
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: 14, color: matched ? colors.blush : colors.mist }}>
            {msg}
          </Text>
        </View>
      }
    >
      {!q ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TypingDots />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <BigCard key={`a-${r}`} text={opts[0] ?? ''} side="a" state={mine === '0' ? 'on' : mine === '1' ? 'off' : 'idle'} who={whoFor(0)} onPress={() => pick(0)} disabled={mine != null} />
          <View pointerEvents="none" style={{ alignSelf: 'center', width: 56, height: 56, marginVertical: -22, zIndex: 2, borderRadius: 28, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.lineHeavy, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.serifItalic, fontSize: 20, color: colors.blush }}>veya</Text>
          </View>
          <BigCard key={`b-${r}`} text={opts[1] ?? ''} side="b" state={mine === '1' ? 'on' : mine === '0' ? 'off' : 'idle'} who={whoFor(1)} onPress={() => pick(1)} disabled={mine != null} />
        </View>
      )}
    </GameLayout>
  );
}

/** Görsel geri sayım (yalnızca tempo için; süre dolunca bir şey olmaz). Her turda key ile sıfırlanır. */
function RoundClock({ stopped }: { stopped: boolean }) {
  const [left, setLeft] = useState(ROUND_SECONDS);
  useEffect(() => {
    if (stopped) return;
    const started = Date.now() - (ROUND_SECONDS - left) * 1000;
    const iv = setInterval(() => setLeft(Math.max(0, ROUND_SECONDS - Math.floor((Date.now() - started) / 1000))), 500);
    return () => clearInterval(iv);
    // yalnızca durdurulma değişince yeniden kur
  }, [stopped]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <MetaText color={left <= 3 ? colors.error : colors.warning} style={{ fontSize: 13 }}>
      {`0:${String(left).padStart(2, '0')}`}
    </MetaText>
  );
}

function BigCard({ text, side, state, who, onPress, disabled }: { text: string; side: 'a' | 'b'; state: 'on' | 'off' | 'idle'; who: Player[]; onPress: () => void; disabled: boolean }) {
  const { s: sz } = useCompact();
  const reduced = useReducedMotion();
  const scale = useState(() => new Animated.Value(reduced ? 1 : 0.94))[0];
  const fade = useState(() => new Animated.Value(reduced ? 1 : 0))[0];
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [scale, fade]);
  useEffect(() => {
    if (reduced) return;
    Animated.timing(scale, { toValue: state === 'on' ? 1.02 : state === 'off' ? 0.96 : 1, duration: 200, useNativeDriver: true }).start();
  }, [state, reduced, scale]);
  return (
    <Animated.View style={{ flex: 1, opacity: fade, transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ selected: state === 'on', disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{ flex: 1, borderRadius: 32, overflow: 'hidden', borderWidth: 1.5, borderColor: state === 'on' ? colors.rose : 'rgba(255,230,240,.1)', padding: 24, alignItems: 'center', justifyContent: 'center', opacity: state === 'off' ? 0.75 : 1 }}
      >
        <LinearGradient
          colors={side === 'a' ? ['#5A1A2E', colors.velvet] : ['#3A1740', colors.velvet]}
          start={side === 'a' ? { x: 0, y: 0 } : { x: 1, y: 1 }}
          end={side === 'a' ? { x: 0.8, y: 0.8 } : { x: 0.2, y: 0.2 }}
          style={StyleSheet.absoluteFill}
        />
        <Text adjustsFontSizeToFit numberOfLines={3} minimumFontScale={0.5} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: sz(44, 36), lineHeight: sz(46, 38), color: colors.pearl, textAlign: 'center' }}>
          {text}
        </Text>
        {who.length ? (
          <View style={{ position: 'absolute', bottom: 16, flexDirection: 'row', gap: 6 }}>
            {who.map((p) => (
              <MiniAvatar key={p.id || p.name} player={p} />
            ))}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
