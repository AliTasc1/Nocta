import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components/ui';
import type { Question } from '@/lib/types';
import { colors, fonts } from '@/theme';
import { Burst, CONFETTI, HEARTS } from './Burst';
import { ScoreStrip } from './Quiz';
import { ChoiceGrid, GameLayout, GameTopBar, haptic, MiniAvatar, optionsOf, PartnerStatus, possessive, RadialGlow, ResultPill, TypingDots, useCompact, useChoiceGrid, useReducedMotion, type Player } from './shared';
import type { EngineProps } from './useGameSession';

const MAX_OPTIONS = 6;

/** Sorunun doğru emojisi ya da null (eşleşme modu). Geçersiz indeks → eşleşme modu. */
export function emojiCorrectIndex(q: Question | null | undefined): number | null {
  const raw = q?.correct_index;
  if (raw == null) return null;
  const n = Number(raw);
  const count = Math.min(MAX_OPTIONS, optionsOf(q).length);
  return Number.isInteger(n) && n >= 0 && n < count ? n : null;
}

const choiceOf = (a: { answer?: Record<string, any> } | undefined) => (a?.answer?.choice != null ? String(a.answer.choice) : null);

/** Bir dizedeki görünür emoji sayısı (ZWJ dizileri ve varyasyon seçicileri tek sayılır) */
let pictoRe: RegExp | null | undefined;
function glyphCount(s: string) {
  if (pictoRe === undefined) {
    try {
      pictoRe = new RegExp('\\p{Extended_Pictographic}', 'gu');
    } catch {
      pictoRe = null;
    }
  }
  const joined = s.replace(/‍[^\s]/gu, '');
  if (pictoRe) {
    const m = joined.match(pictoRe);
    if (m?.length) return m.length;
  }
  return Math.max(1, Math.ceil(Array.from(joined.replace(/[️\u{1F3FB}-\u{1F3FF}]/gu, '')).length));
}

/**
 * 16 · Emojilerle Anlat
 * Soru metni + emoji şıkları (2 sütunlu, kareye yakın büyük kutular). İki partner de kendi telefonunda gizlice seçer.
 * `correct_index` doluysa doğru emoji açılır, her partnerin sonucu animasyonla gösterilir;
 * boşsa eşleşme modu (aynı emoji = eşleşme). Cevap biçimi: `{ choice: "<indeks>" }`.
 */
export function EmojiGame({ g, onClose }: EngineProps) {
  const { s: sz, compact } = useCompact();
  const session = g.session!;
  const r = session.current_index;
  const qid = session.question_ids[r];
  const q = qid ? g.questions[qid] : undefined;
  const opts = optionsOf(q).slice(0, MAX_OPTIONS);
  const correct = emojiCorrectIndex(q);
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
  let matchRounds = 0;
  for (let i = 0; i <= r; i++) {
    const a = choiceOf(g.mineFor(i));
    const b = choiceOf(g.partnerFor(i));
    if (a == null || b == null) continue;
    const ci = emojiCorrectIndex(g.questions[session.question_ids[i]]);
    if (ci != null) {
      knowledgeRounds++;
      if (a === String(ci)) myScore++;
      if (b === String(ci)) partnerScore++;
    } else {
      matchRounds++;
      if (a === b) sameCount++;
    }
  }
  const sessionHasKnowledge = isKnowledge || knowledgeRounds > 0;

  useEffect(() => {
    if (!revealed) return;
    const good = isKnowledge ? iRight : matched;
    (good ? haptic.success : isKnowledge ? haptic.error : haptic.warn)();
  }, [revealed, isKnowledge, iRight, matched]);

  const pick = (i: number) => {
    if (mine != null || !q) return;
    haptic.tap();
    g.submitAnswer({ choice: String(i) }, { round: r, questionId: qid });
  };

  // Izgara: 2 sütun, açık satırlar (2 → yan yana, 3 → 2 + 1, 4 → 2×2, 5–6 → 3 satır).
  // Ölçüler pencere boyutundan kesin sayılarla hesaplanır (onLayout beklenmez); kutular kareye
  // yakın, kısa ekranda yükseklik ızgara + soru + alt buton sığacak şekilde sınırlanır.
  const gap = 10;
  const grid = useChoiceGrid({ count: opts.length, gap, reserve: compact ? 320 : 380, maxCols: 2 });
  const tileW = grid.colW;
  const tileH = Math.floor(Math.max(80, Math.min(tileW * 0.95, grid.rowH)));
  const celebrateIdx = !revealed ? null : isKnowledge ? (iRight || theyRight ? correct : null) : matched && mine != null ? Number(mine) : null;

  let resTitle = '';
  let resColor: string = colors.blush;
  let resSub = '';
  if (revealed) {
    if (isKnowledge) {
      resSub = `Doğru cevap: ${opts[correct!] ?? ''}`;
    } else if (matched) {
      resTitle = 'Aynı emoji! ♡';
      resColor = colors.rose;
      resSub = `İkiniz de ${opts[Number(mine)] ?? ''} seçtiniz.`;
    } else {
      resTitle = 'Farklı emojiler 👀';
      resSub = `${possessive(g.partner.name)} seçimi: ${opts[Number(theirs)] ?? ''}`;
    }
  }

  const pill = !q
    ? { text: 'Soru yükleniyor…', tone: 'idle' as const }
    : mine == null
      ? { text: g.partnerAnswered ? `${g.partner.name} seçti · sıra sende` : 'Gizlice bir emoji seç', tone: 'idle' as const }
      : { text: `${g.partner.name} bekleniyor`, tone: 'wait' as const };

  const accent = isKnowledge ? colors.irisSoft : colors.blush;

  return (
    <GameLayout
      bg={<RadialGlow color={isKnowledge ? 'rgba(168,139,240,.3)' : 'rgba(231,104,138,.3)'} top="0%" size={1.4} />}
      top={
        <GameTopBar
          onClose={onClose}
          center={
            <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.velvet, borderWidth: 1, borderColor: isKnowledge ? 'rgba(168,139,240,.35)' : 'rgba(231,104,138,.35)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="emoji_emotions" size={14} color={accent} />
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: accent }}>
                {isKnowledge ? 'EMOJİLERLE ANLAT' : 'EMOJİ EŞLEŞMESİ'}
              </Text>
            </View>
          }
          right={<Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.mist }}>{`${r + 1} / ${g.totalRounds}`}</Text>}
        />
      }
      footer={
        revealed ? (
          <Button title={isLast ? 'Oyunu bitir' : 'Sonraki soru'} iconRight={isLast ? 'flag' : 'arrow_forward'} kind="light" loading={g.busy} onPress={() => g.advance(r)} />
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
          <PartnerStatus name={g.partner.name} done={g.partnerAnswered} />
          {matchRounds > 0 ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.blush }}>{`♡ ${sameCount} / ${matchRounds} aynı`}</Text> : null}
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: accent }}>{isKnowledge ? 'DOĞRU EMOJİYİ BUL' : 'AYNI EMOJİYİ SEÇEBİLECEK MİSİNİZ?'}</Text>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(32, 26), lineHeight: sz(35, 29), color: colors.pearl }}>
          {q?.text ?? ''}
        </Text>
      </View>

      {!q ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <TypingDots />
        </View>
      ) : (
        <ChoiceGrid
          count={opts.length}
          cols={grid.cols}
          gap={gap}
          raise={celebrateIdx}
          renderItem={(i) => {
            const t = opts[i];
            const k = String(i);
            const who: Player[] = [];
            if (mine === k) who.push(g.me);
            if (revealed && theirs === k) who.push(g.partner);
            let state: TileState = 'idle';
            if (!revealed) state = mine === k ? 'selected' : mine != null ? 'dim' : 'idle';
            else if (isKnowledge) state = i === correct ? 'correct' : who.length ? 'wrong' : 'dim';
            else state = who.length ? (matched ? 'match' : mine === k ? 'selected' : 'partner') : 'dim';
            return (
              <EmojiTile
                key={`${r}-${i}`}
                index={i}
                emoji={t}
                state={state}
                who={who}
                width={tileW}
                height={tileH}
                celebrate={celebrateIdx === i ? `${r}-${i}` : null}
                burstEmojis={isKnowledge ? CONFETTI : HEARTS}
                disabled={mine != null}
                onPress={() => pick(i)}
              />
            );
          }}
        />
      )}

      <View style={{ marginTop: 'auto', alignItems: 'center', gap: 8, minHeight: 56, justifyContent: 'flex-end', paddingTop: 4 }}>
        {revealed && isKnowledge ? (
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <Verdict key={`me-${r}`} player={g.me} label="Sen" right={iRight} delay={150} />
            <Verdict key={`pa-${r}`} player={g.partner} label={g.partner.name} right={theyRight} delay={450} />
          </View>
        ) : null}
        {resTitle ? (
          <FadeIn key={`t-${r}`}>
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serifItalic, fontSize: sz(30, 26), lineHeight: sz(34, 30), color: resColor, textAlign: 'center' }}>
              {resTitle}
            </Text>
          </FadeIn>
        ) : null}
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.mist, textAlign: 'center' }}>
          {revealed ? resSub : mine != null ? 'Seçimin kilitlendi. İkiniz de seçince açılır.' : 'Seçimler gizli kalır; ikiniz de seçince birlikte açılır.'}
        </Text>
      </View>
    </GameLayout>
  );
}

// ─────────────────────────────────────────────────────────────

type TileState = 'idle' | 'selected' | 'dim' | 'match' | 'partner' | 'correct' | 'wrong';

function EmojiTile({
  index,
  emoji,
  state,
  who,
  width,
  height,
  celebrate,
  burstEmojis,
  disabled,
  onPress,
}: {
  index: number;
  emoji: string;
  state: TileState;
  who: Player[];
  width: number;
  height: number;
  celebrate: string | null;
  burstEmojis: string[];
  disabled: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useState(() => new Animated.Value(1))[0];
  const shake = useState(() => new Animated.Value(0))[0];
  const flash = useState(() => new Animated.Value(0))[0];
  const emphasized = state === 'selected' || state === 'match' || state === 'correct';
  const wrong = state === 'wrong';

  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    if (state === 'correct' || state === 'match') {
      // Doğru kutu: küçük bir zıplama
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, friction: 4, tension: 160 }),
        Animated.spring(scale, { toValue: 1.02, useNativeDriver: true, friction: 5 }),
      ]).start();
    } else {
      Animated.spring(scale, { toValue: emphasized ? 1.03 : 1, useNativeDriver: true, friction: 7 }).start();
    }
  }, [state, emphasized, reduced, scale]);

  // Yanlış seçim: sallanma + kırmızı parlama
  useEffect(() => {
    if (!wrong) return;
    const flashAnim = Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.25, duration: 160, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.8, duration: 120, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]);
    if (reduced) {
      // Hareket yok; yalnızca yumuşak bir solma
      const fade = Animated.sequence([
        Animated.timing(flash, { toValue: 0.6, duration: 200, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]);
      fade.start();
      return () => fade.stop();
    }
    shake.setValue(0);
    const shakeAnim = Animated.sequence(
      [10, -10, 8, -8, 5, -5, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, easing: Easing.linear, useNativeDriver: true })),
    );
    const all = Animated.parallel([flashAnim, Animated.sequence([Animated.delay(80), shakeAnim])]);
    all.start();
    return () => all.stop();
  }, [wrong, reduced, flash, shake]);

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
  const bg = state === 'correct' ? 'rgba(127,209,174,.12)' : state === 'wrong' ? 'rgba(240,122,122,.08)' : state === 'partner' ? 'rgba(168,139,240,.1)' : colors.velvet;
  const gradient = state === 'selected' || state === 'match';
  const icon = state === 'correct' ? 'check_circle' : state === 'wrong' ? 'cancel' : state === 'match' ? 'favorite' : null;
  const iconColor = state === 'correct' ? colors.success : state === 'wrong' ? colors.error : colors.rose;

  const glyphs = glyphCount(emoji);
  // Emoji boyutu kutuya göre ölçeklenir: tek emoji büyük, çoklu emoji genişliğe sığacak kadar
  const fontSize = Math.round(Math.max(22, Math.min(64, (width - 24) / (glyphs * 1.4), height * 0.46)));
  const a11yState = state === 'correct' ? ', doğru cevap' : state === 'wrong' ? ', yanlış' : '';
  const a11yWho = who.length ? `, seçen: ${who.map((p) => p.name).join(' ve ')}` : '';

  return (
    <Animated.View style={{ width, height, zIndex: celebrate ? 5 : 1, opacity: state === 'dim' ? 0.45 : 1, transform: [{ translateX: shake }, { scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${index + 1}. şık: ${emoji}${a11yState}${a11yWho}`}
        accessibilityState={{ selected: state === 'selected' || state === 'match', disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: bg,
          borderWidth: state === 'idle' || state === 'dim' ? 1.5 : 2,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        {gradient ? <LinearGradient colors={['#6B1E38', colors.velvet]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 0.9 }} style={StyleSheet.absoluteFill} /> : null}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(240,80,90,.55)', opacity: flash }]} />
        <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize, lineHeight: fontSize * 1.25, textAlign: 'center', paddingHorizontal: 8 }}>
          {emoji}
        </Text>
        {icon ? (
          <View style={{ position: 'absolute', top: 8, left: 8 }}>
            <Icon name={icon} size={20} color={iconColor} />
          </View>
        ) : null}
        {who.length ? (
          <View style={{ position: 'absolute', top: 6, right: 6, flexDirection: 'row' }}>
            {who.map((p, i) => (
              <View key={p.id || p.name} style={{ marginLeft: i ? -8 : 0 }}>
                <MiniAvatar player={p} size={24} />
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
      <Burst play={celebrate} emojis={burstEmojis} count={22} distance={Math.max(90, width * 0.85)} size={18} />
    </Animated.View>
  );
}

/** Oyuncu başına sonuç rozeti: doğruysa zıplayıp konfeti saçar, yanlışsa sallanır */
function Verdict({ player, label, right, delay }: { player: Player; label: string; right: boolean; delay: number }) {
  const reduced = useReducedMotion();
  const appear = useState(() => new Animated.Value(0))[0];
  const pop = useState(() => new Animated.Value(reduced ? 1 : 0.4))[0];
  const wobble = useState(() => new Animated.Value(0))[0];
  const [go, setGo] = useState(false);

  useEffect(() => {
    appear.setValue(0);
    const fade = Animated.timing(appear, { toValue: 1, duration: reduced ? 350 : 220, delay, useNativeDriver: true });
    if (reduced) {
      pop.setValue(1);
      fade.start();
      return () => fade.stop();
    }
    pop.setValue(0.4);
    wobble.setValue(0);
    const t = setTimeout(() => setGo(true), delay);
    const motion = right
      ? Animated.sequence([
          Animated.delay(delay),
          Animated.spring(pop, { toValue: 1.18, useNativeDriver: true, friction: 3, tension: 180 }),
          Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4 }),
        ])
      : Animated.parallel([
          Animated.sequence([Animated.delay(delay), Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6 })]),
          Animated.sequence([
            Animated.delay(delay + 120),
            ...[-1, 1, -0.8, 0.8, -0.5, 0.5, 0].map((x) => Animated.timing(wobble, { toValue: x, duration: 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true })),
          ]),
        ]);
    const all = Animated.parallel([fade, motion]);
    all.start();
    return () => {
      clearTimeout(t);
      all.stop();
    };
  }, [right, delay, reduced, appear, pop, wobble]);

  const color = right ? colors.success : colors.error;
  return (
    <Animated.View
      accessibilityLabel={`${label}: ${right ? 'doğru' : 'yanlış'}`}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 18,
        backgroundColor: right ? 'rgba(127,209,174,.1)' : 'rgba(240,122,122,.08)',
        borderWidth: 1,
        borderColor: right ? 'rgba(127,209,174,.35)' : 'rgba(240,122,122,.3)',
        opacity: appear,
      }}
    >
      <MiniAvatar player={player} size={28} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.mist }}>
          {label}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Animated.Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            style={{
              fontFamily: fonts.extrabold,
              fontSize: 15,
              color,
              transform: [{ scale: pop }, { rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] }) }],
            }}
          >
            {right ? 'Doğru! 🎉' : 'Yanlış 😅'}
          </Animated.Text>
          {right ? <Burst play={go} emojis={CONFETTI} count={12} distance={56} size={13} duration={800} /> : null}
        </View>
      </View>
    </Animated.View>
  );
}

function FadeIn({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: reduced ? 350 : 280, useNativeDriver: true }).start();
  }, [reduced, v]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 8, 0] }) }] }}>{children}</Animated.View>;
}
