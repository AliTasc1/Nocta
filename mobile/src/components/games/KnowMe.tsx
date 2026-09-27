import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { AdvanceButton, GameBackground, GameLayout, GameTopBar, haptic, initialOf, optionsOf, possessive, RevealCountdown, SeenStatus, TypingDots, useCompact, useRevealGate } from './shared';
import type { EngineProps } from './useGameSession';

/**
 * 13 · Beni Ne Kadar Tanıyorsun
 * Çift turlarda `subject_first`, tek turlarda diğer partner "konu"dur: kendi doğru cevabını
 * kilitler; diğeri tahmin eder. İki cevap da `choice` = seçenek indeksi → doğru tahmin = eşleşme.
 */
export function KnowMe({ g, onClose }: EngineProps) {
  const { s: sz } = useCompact();
  const session = g.session!;
  const r = session.current_index;
  const qid = session.question_ids[r];
  const q = qid ? g.questions[qid] : undefined;
  const opts = optionsOf(q);
  const first: string = session.state?.subject_first || session.created_by;
  const subjectForRound = (i: number) => (i % 2 === 0 ? first : first === g.userId ? g.partnerId : g.userId);
  const iAmSubject = subjectForRound(r) === g.userId;
  const subjectName = iAmSubject ? 'Sen' : g.partner.name;

  const mine = g.myAnswer?.answer?.choice != null ? String(g.myAnswer.answer.choice) : null;
  const theirs = g.partnerAnswer?.answer?.choice != null ? String(g.partnerAnswer.answer.choice) : null;
  const gate = useRevealGate(g, mine != null && theirs != null, r);
  const revealed = mine != null && theirs != null && gate.revealed;
  const truth = revealed ? (iAmSubject ? mine : theirs) : null;
  const guess = revealed ? (iAmSubject ? theirs : mine) : null;
  const correct = revealed && truth === guess;

  // Skor: her turda tahmin edenin doğru bildiği turlar (bu tur yalnızca açıldıktan sonra sayılır)
  let myScore = 0;
  let partnerScore = 0;
  for (let i = 0; i < r + (revealed ? 1 : 0); i++) {
    const a = g.mineFor(i)?.answer?.choice;
    const b = g.partnerFor(i)?.answer?.choice;
    if (a == null || b == null || String(a) !== String(b)) continue;
    if (subjectForRound(i) === g.userId) partnerScore++;
    else myScore++;
  }

  useEffect(() => {
    if (revealed) (correct ? haptic.success : haptic.warn)();
  }, [revealed, correct]);

  const pick = (i: number) => {
    if (mine != null || !q) return;
    haptic.tap();
    g.submitAnswer({ choice: String(i), role: iAmSubject ? 'subject' : 'guess' }, { round: r, questionId: qid });
  };

  const partnerLocked = g.partnerAnswered;
  const banner = iAmSubject
    ? mine != null
      ? `Cevabını kilitledin. ${g.partner.name} şimdi tahmin ediyor.`
      : `Bu tur senin hakkında. Doğru cevabını seç; ${g.partner.name} tahmin edecek.`
    : partnerLocked
      ? `${g.partner.name} kendi cevabını kilitledi. Sen tahmin et.`
      : `${g.partner.name} kendi cevabını seçiyor. Sen tahminini yap.`;

  let resTitle = '';
  let resSub = '';
  if (revealed && truth != null) {
    const truthText = opts[Number(truth)] ?? '';
    const guessText = opts[Number(guess)] ?? '';
    if (iAmSubject) {
      resTitle = correct ? `${g.partner.name} bildi!` : 'Pek değil…';
      resSub = correct ? `+10 puan · Cevabın: “${truthText}”` : `Tahmini: “${guessText}”`;
    } else {
      resTitle = correct ? 'Doğru' : 'Pek değil…';
      resSub = correct ? `+10 puan · ${g.partner.name}: “${truthText}”` : `${g.partner.name}: “${truthText}”`;
    }
  } else if (gate.counting) {
    resSub = 'Cevaplar açılıyor…';
  } else if (!revealed) {
    resSub = iAmSubject ? (mine ? `${possessive(g.partner.name)} tahmini bekleniyor` : 'Tahmin geldikten sonra ikiniz de görürsünüz') : `${possessive(g.partner.name)} cevabı tahmininden sonra açılır`;
  }

  return (
    <GameLayout
      bg={<GameBackground tone={!revealed ? 'iris' : correct ? 'success' : 'rose'} />}
      overlay={<RevealCountdown count={gate.count} />}
      top={
        <GameTopBar
          onClose={onClose}
          center={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.velvet }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.blush }}>{`${initialOf(g.me.name)} ${myScore}`}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.faint }}>·</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.irisSoft }}>{`${initialOf(g.partner.name)} ${partnerScore}`}</Text>
            </View>
          }
          right={<Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.mist }}>{`${r + 1} / ${g.totalRounds}`}</Text>}
        />
      }
      footer={
        revealed ? (
          <>
            <SeenStatus gate={gate} name={g.partner.name} />
            <AdvanceButton gate={gate} title={r + 1 >= g.totalRounds ? 'Sonuçları gör' : 'Sonraki soru'} loading={g.busy} onPress={() => g.advance(r)} />
          </>
        ) : undefined
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(168,139,240,.08)', borderWidth: 1, borderColor: 'rgba(168,139,240,.25)' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: iAmSubject ? g.me.color : g.partner.color, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.pearl }}>{initialOf(iAmSubject ? g.me.name : g.partner.name)}</Text>
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.pearl }}>{banner}</Text>
        <Icon name={(iAmSubject ? mine != null : partnerLocked) ? 'lock' : 'lock_open'} size={22} color={colors.irisSoft} />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.irisSoft }}>
          {iAmSubject ? 'SENİN HAKKINDA' : `${possessive(subjectName).toLocaleUpperCase('tr-TR')} CEVABI`}
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(34, 28), lineHeight: sz(37, 31), color: colors.pearl }}>
          {q?.text ?? ''}
        </Text>
      </View>

      {!q ? (
        <TypingDots />
      ) : (
        <View style={{ gap: 10 }}>
          {opts.map((t, i) => {
            const k = String(i);
            const isTruth = revealed && truth === k;
            const isWrongGuess = revealed && guess === k && truth !== k;
            const picked = mine === k;
            const bg = isTruth ? 'rgba(127,209,174,.1)' : isWrongGuess ? 'rgba(240,122,122,.08)' : picked ? 'rgba(231,104,138,.12)' : colors.velvet;
            const bd = isTruth ? colors.success : isWrongGuess ? colors.error : picked ? colors.rose : 'rgba(255,230,240,.1)';
            const icon = isTruth ? 'check_circle' : isWrongGuess ? 'cancel' : picked ? 'radio_button_checked' : null;
            return (
              <Pressable
                key={`${r}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={t}
                accessibilityState={{ selected: picked, disabled: mine != null }}
                disabled={mine != null}
                onPress={() => pick(i)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: sz(64, 56), paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: bg, borderWidth: 1.5, borderColor: bd, opacity: pressed ? 0.85 : 1 })}
              >
                <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.mist }}>{String.fromCharCode(65 + i)}</Text>
                <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.pearl }}>{t}</Text>
                {icon ? <Icon name={icon} size={22} color={isTruth ? colors.success : isWrongGuess ? colors.error : colors.rose} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: 'auto', alignItems: 'center', gap: 4, minHeight: 60, justifyContent: 'flex-end' }}>
        {resTitle ? (
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 32, lineHeight: 36, color: correct ? colors.success : colors.blush }}>{resTitle}</Text>
        ) : mine != null ? (
          <TypingDots />
        ) : null}
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.mist, textAlign: 'center' }}>{resSub}</Text>
      </View>
    </GameLayout>
  );
}
