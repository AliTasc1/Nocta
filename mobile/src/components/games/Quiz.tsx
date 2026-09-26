import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components/ui';
import type { Question } from '@/lib/types';
import { colors, fonts } from '@/theme';
import { GameLayout, GameTopBar, haptic, MiniAvatar, optionsOf, PartnerStatus, possessive, RadialGlow, ResultPill, TypingDots, upper, useCompact, useReducedMotion, type Player } from './shared';
import type { EngineProps } from './useGameSession';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Sorunun doğru şıkkı (bilgi testi) ya da null (uyum testi). Geçersiz indeks → uyum testi. */
export function quizCorrectIndex(q: Question | null | undefined): number | null {
  const raw = q?.correct_index;
  if (raw == null) return null;
  const n = Number(raw);
  const count = Math.min(4, optionsOf(q).length);
  return Number.isInteger(n) && n >= 0 && n < count ? n : null;
}

const choiceOf = (a: { answer?: Record<string, any> } | undefined) => (a?.answer?.choice != null ? String(a.answer.choice) : null);

/**
 * 15 · Çift Testleri
 * Dört seçenekli sorular. `correct_index` boşsa **uyum testi**: ikiniz de gizlice seçer,
 * aynı şık = eşleşme. Doluysa **bilgi testi**: doğru şık açılır, her partnerin skoru tutulur.
 * Cevap biçimi: `{ choice: "<indeks>" }` (finish_session bunu sayar).
 */
export function Quiz({ g, onClose }: EngineProps) {
  const { s: sz } = useCompact();
  const session = g.session!;
  const r = session.current_index;
  const qid = session.question_ids[r];
  const q = qid ? g.questions[qid] : undefined;
  const opts = optionsOf(q).slice(0, 4);
  const correct = quizCorrectIndex(q);
  const isKnowledge = correct != null;

  const mine = choiceOf(g.myAnswer);
  const theirs = choiceOf(g.partnerAnswer);
  const revealed = mine != null && theirs != null;
  const matched = revealed && mine === theirs;
  const iRight = revealed && isKnowledge && mine === String(correct);
  const theyRight = revealed && isKnowledge && theirs === String(correct);
  const isLast = r + 1 >= g.totalRounds;

  // Önceki turlar (ve açılmışsa bu tur) üzerinden istemci tarafı skor
  let myScore = 0;
  let partnerScore = 0;
  let sameCount = 0;
  let knowledgeRounds = 0;
  let compatRounds = 0;
  for (let i = 0; i <= r; i++) {
    const a = choiceOf(g.mineFor(i));
    const b = choiceOf(g.partnerFor(i));
    if (a == null || b == null) continue;
    const ci = quizCorrectIndex(g.questions[session.question_ids[i]]);
    if (ci != null) {
      knowledgeRounds++;
      if (a === String(ci)) myScore++;
      if (b === String(ci)) partnerScore++;
    } else {
      compatRounds++;
      if (a === b) sameCount++;
    }
  }
  const sessionHasKnowledge = isKnowledge || knowledgeRounds > 0;

  useEffect(() => {
    if (!revealed) return;
    const good = isKnowledge ? iRight : matched;
    (good ? haptic.success : haptic.warn)();
  }, [revealed, isKnowledge, iRight, matched]);

  const pick = (i: number) => {
    if (mine != null || !q) return;
    haptic.tap();
    g.submitAnswer({ choice: String(i) }, { round: r, questionId: qid });
  };

  // Sonuç metni
  let resTitle = '';
  let resColor: string = colors.blush;
  let resSub = '';
  if (revealed) {
    if (isKnowledge) {
      const truth = opts[correct!] ?? '';
      resSub = `Doğru cevap: “${truth}”`;
      if (iRight && theyRight) {
        resTitle = 'İkiniz de bildiniz!';
        resColor = colors.success;
      } else if (iRight) {
        resTitle = 'Sen bildin!';
        resColor = colors.success;
      } else if (theyRight) {
        resTitle = `${g.partner.name} bildi!`;
        resColor = colors.irisSoft;
      } else {
        resTitle = 'İkiniz de yanıldınız';
        resColor = colors.error;
      }
    } else if (matched) {
      resTitle = 'Aynı cevap! ♡';
      resColor = colors.rose;
      resSub = `İkiniz de “${opts[Number(mine)] ?? ''}” dediniz.`;
    } else {
      resTitle = 'Farklı cevaplar 👀';
      resSub = `${possessive(g.partner.name)} cevabı: “${opts[Number(theirs)] ?? ''}”`;
    }
  }

  const pill = !q
    ? { text: 'Soru yükleniyor…', tone: 'idle' as const }
    : mine == null
      ? { text: g.partnerAnswered ? `${g.partner.name} cevapladı · sıra sende` : 'Gizlice bir cevap seç', tone: 'idle' as const }
      : { text: `${g.partner.name} bekleniyor`, tone: 'wait' as const };

  return (
    <GameLayout
      bg={<RadialGlow color={isKnowledge ? 'rgba(168,139,240,.32)' : 'rgba(231,104,138,.3)'} top="0%" size={1.4} />}
      top={
        <GameTopBar
          onClose={onClose}
          center={
            <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.velvet, borderWidth: 1, borderColor: isKnowledge ? 'rgba(168,139,240,.35)' : 'rgba(231,104,138,.35)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={isKnowledge ? 'emoji_objects' : 'favorite'} size={14} color={isKnowledge ? colors.irisSoft : colors.blush} />
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: isKnowledge ? colors.irisSoft : colors.blush }}>
                {isKnowledge ? 'BİLGİ TESTİ' : 'UYUM TESTİ'}
              </Text>
            </View>
          }
          right={<Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.mist }}>{`${r + 1} / ${g.totalRounds}`}</Text>}
        />
      }
      footer={
        revealed ? (
          <Button title={isLast ? 'Testi bitir' : 'Sonraki soru'} iconRight={isLast ? 'flag' : 'arrow_forward'} kind="light" loading={g.busy} onPress={() => g.advance(r)} />
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <ResultPill text={pill.text} tone={pill.tone} />
          </View>
        )
      }
    >
      {sessionHasKnowledge ? (
        <ScoreStrip me={g.me} partner={g.partner} myScore={myScore} partnerScore={partnerScore} of={knowledgeRounds} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <PartnerStatus name={g.partner.name} done={g.partnerAnswered} doneText="cevapladı" />
          {compatRounds > 0 ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.blush }}>{`♡ ${sameCount} / ${compatRounds} aynı`}</Text>
          ) : null}
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: isKnowledge ? colors.irisSoft : colors.blush }}>
          {isKnowledge ? 'DOĞRU CEVABI BUL' : 'AYNI CEVABI VEREBİLECEK MİSİNİZ?'}
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(32, 26), lineHeight: sz(35, 29), color: colors.pearl }}>
          {q?.text ?? ''}
        </Text>
      </View>

      {!q ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <TypingDots />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {opts.map((t, i) => {
            const k = String(i);
            const who: Player[] = [];
            if (mine === k) who.push(g.me);
            if (revealed && theirs === k) who.push(g.partner);
            let state: OptionState = 'idle';
            if (!revealed) state = mine === k ? 'selected' : mine != null ? 'dim' : 'idle';
            else if (isKnowledge) state = i === correct ? 'correct' : who.length ? 'wrong' : 'dim';
            else state = who.length ? (matched ? 'match' : mine === k ? 'selected' : 'partner') : 'dim';
            return <OptionCard key={`${r}-${i}`} letter={LETTERS[i] ?? String(i + 1)} text={t} state={state} who={who} disabled={mine != null} onPress={() => pick(i)} />;
          })}
        </View>
      )}

      <View style={{ marginTop: 'auto', alignItems: 'center', gap: 4, minHeight: 56, justifyContent: 'flex-end', paddingTop: 4 }}>
        {resTitle ? (
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serifItalic, fontSize: sz(30, 26), lineHeight: sz(34, 30), color: resColor, textAlign: 'center' }}>
            {resTitle}
          </Text>
        ) : null}
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.mist, textAlign: 'center' }}>
          {revealed ? resSub : mine != null ? 'Cevabın kilitlendi. İkiniz de cevaplayınca açılır.' : 'Cevaplar gizli kalır; ikiniz de seçince birlikte açılır.'}
        </Text>
      </View>
    </GameLayout>
  );
}

// ─────────────────────────────────────────────────────────────

type OptionState = 'idle' | 'selected' | 'dim' | 'match' | 'partner' | 'correct' | 'wrong';

function OptionCard({ letter, text, state, who, disabled, onPress }: { letter: string; text: string; state: OptionState; who: Player[]; disabled: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const scale = useState(() => new Animated.Value(1))[0];
  const emphasized = state === 'selected' || state === 'match' || state === 'correct';
  useEffect(() => {
    Animated.spring(scale, { toValue: reduced ? 1 : emphasized ? 1.015 : 1, useNativeDriver: true, friction: 7 }).start();
  }, [emphasized, reduced, scale]);

  const border =
    state === 'correct'
      ? colors.success
      : state === 'wrong'
        ? colors.error
        : state === 'selected' || state === 'match'
          ? colors.rose
          : state === 'partner'
            ? colors.iris
            : 'rgba(255,230,240,.1)';
  const bg = state === 'correct' ? 'rgba(127,209,174,.1)' : state === 'wrong' ? 'rgba(240,122,122,.08)' : state === 'partner' ? 'rgba(168,139,240,.1)' : colors.velvet;
  const gradient = state === 'selected' || state === 'match';
  const icon = state === 'correct' ? 'check_circle' : state === 'wrong' ? 'cancel' : state === 'match' ? 'favorite' : null;
  const iconColor = state === 'correct' ? colors.success : state === 'wrong' ? colors.error : colors.rose;
  const a11yState = state === 'correct' ? ', doğru cevap' : state === 'wrong' ? ', yanlış' : '';
  const a11yWho = who.length ? `, seçen: ${who.map((p) => p.name).join(' ve ')}` : '';

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: state === 'dim' ? 0.55 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${letter}: ${text}${a11yState}${a11yWho}`}
        accessibilityState={{ selected: state === 'selected' || state === 'match', disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 56,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: border,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {gradient ? <LinearGradient colors={['#6B1E38', colors.velvet]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 0.9 }} style={StyleSheet.absoluteFill} /> : null}
        <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,230,240,.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.pearl }}>{letter}</Text>
        </View>
        <Text maxFontSizeMultiplier={1.3} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.pearl }}>
          {text}
        </Text>
        {who.length ? (
          <View style={{ flexDirection: 'row' }}>
            {who.map((p, i) => (
              <View key={p.id || p.name} style={{ marginLeft: i ? -8 : 0 }}>
                <MiniAvatar player={p} size={26} />
              </View>
            ))}
          </View>
        ) : null}
        {icon ? <Icon name={icon} size={22} color={iconColor} /> : null}
      </Pressable>
    </Animated.View>
  );
}

/** Bilgi testi skor şeridi: iki partnerin doğru sayısı */
export function ScoreStrip({ me, partner, myScore, partnerScore, of }: { me: Player; partner: Player; myScore: number; partnerScore: number; of: number }) {
  const lead = myScore === partnerScore ? null : myScore > partnerScore ? 'me' : 'partner';
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Skor: sen ${myScore}, ${partner.name} ${partnerScore} doğru`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(168,139,240,.08)', borderWidth: 1, borderColor: 'rgba(168,139,240,.25)' }}
    >
      <ScoreSide player={me} label="Sen" score={myScore} color={colors.blush} leading={lead === 'me'} />
      <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.mute }}>DOĞRU</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.faint }}>{`${of} soru`}</Text>
      </View>
      <ScoreSide player={partner} label={partner.name} score={partnerScore} color={colors.irisSoft} leading={lead === 'partner'} right />
    </View>
  );
}

function ScoreSide({ player, label, score, color, leading, right }: { player: Player; label: string; score: number; color: string; leading: boolean; right?: boolean }) {
  return (
    <View style={{ flex: 1, flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
      <MiniAvatar player={player} size={30} />
      <View style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start' }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.mist }}>
          {leading ? `${upper(label)} ÖNDE` : label}
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 20, lineHeight: 26, color }}>
          {score}
        </Text>
      </View>
    </View>
  );
}
