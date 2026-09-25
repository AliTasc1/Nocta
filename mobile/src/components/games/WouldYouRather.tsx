import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';
import { GameLayout, GameTopBar, haptic, MiniAvatar, NextFab, optionsOf, PartnerStatus, ResultPill, TypingDots, useCompact, useReducedMotion, type Player } from './shared';
import type { EngineProps } from './useGameSession';

/** 12 · Hangisini Seçerdin — ikiniz de gizlice seçer, sonra birlikte açılır */
export function WouldYouRather({ g, onClose }: EngineProps) {
  const { s: sz } = useCompact();
  const session = g.session!;
  const r = session.current_index;
  const qid = session.question_ids[r];
  const q = qid ? g.questions[qid] : undefined;
  const opts = optionsOf(q);
  const mine = g.myAnswer?.answer?.choice != null ? String(g.myAnswer.answer.choice) : null;
  const theirs = g.partnerAnswer?.answer?.choice != null ? String(g.partnerAnswer.answer.choice) : null;
  const revealed = mine != null && theirs != null;
  const matched = revealed && mine === theirs;

  // Açılış anında titreşim
  useEffect(() => {
    if (revealed) (matched ? haptic.success : haptic.warn)();
  }, [revealed, matched]);

  const pick = (i: number) => {
    if (mine != null || !q) return;
    haptic.tap();
    g.submitAnswer({ choice: String(i) }, { round: r, questionId: qid });
  };

  const result = !mine
    ? { text: 'Bir seçim yap', tone: 'idle' as const }
    : !revealed
      ? { text: `${g.partner.name} bekleniyor`, tone: 'wait' as const }
      : matched
        ? { text: 'Eşleştiniz! ♡', tone: 'match' as const }
        : { text: 'Farklı seçtiniz 👀', tone: 'diff' as const };

  return (
    <GameLayout
      top={
        <GameTopBar
          onClose={onClose}
          center={`${r + 1} / ${g.totalRounds}`}
          right={<PartnerStatus name={g.partner.name} done={g.partnerAnswered} />}
        />
      }
      footer={
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <ResultPill text={result.text} tone={result.tone} />
          {revealed ? <NextFab loading={g.busy} onPress={() => g.advance(r)} label="Sonraki soru" /> : null}
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: sz(10, 2) }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, color: colors.blush }}>HANGİSİNİ SEÇERDİN</Text>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: sz(36, 30), lineHeight: sz(38, 32), color: colors.pearl, textAlign: 'center' }}>
          {q?.text && q.text !== 'Hangisini seçerdin?' ? q.text : 'Hangisini tercih edersin?'}
        </Text>
      </View>
      {!q ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TypingDots />
        </View>
      ) : (
        opts.slice(0, 2).map((t, i) => {
          const who: Player[] = [];
          if (mine === String(i)) who.push(g.me);
          if (revealed && theirs === String(i)) who.push(g.partner);
          return <OptionCard key={`${r}-${i}`} k={i === 0 ? 'A' : 'B'} text={t} selected={mine === String(i)} dim={mine != null && mine !== String(i)} who={who} onPress={() => pick(i)} disabled={mine != null} />;
        })
      )}
    </GameLayout>
  );
}

function OptionCard({ k, text, selected, dim, who, onPress, disabled }: { k: string; text: string; selected: boolean; dim: boolean; who: Player[]; onPress: () => void; disabled: boolean }) {
  const { s: sz } = useCompact();
  const reduced = useReducedMotion();
  const scale = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    Animated.spring(scale, { toValue: reduced ? 1 : selected ? 1.02 : dim ? 0.98 : 1, useNativeDriver: true, friction: 7 }).start();
  }, [selected, dim, reduced, scale]);
  return (
    <Animated.View style={{ flex: 1, minHeight: sz(170, 140), transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${k}: ${text}`}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: 30,
          padding: sz(24, 18),
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: selected ? colors.rose : 'rgba(255,230,240,.1)',
          backgroundColor: colors.velvet,
          justifyContent: 'space-between',
          gap: 12,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        {selected ? <LinearGradient colors={['#6B1E38', colors.velvet]} start={{ x: 0, y: 0 }} end={{ x: 0.75, y: 0.9 }} style={StyleSheet.absoluteFill} /> : null}
        <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,230,240,.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.pearl }}>{k}</Text>
        </View>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(30, 25), lineHeight: sz(33, 28), color: colors.pearl }}>
          {text}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, minHeight: 28 }}>
          {who.map((p) => (
            <MiniAvatar key={p.id || p.name} player={p} />
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}
