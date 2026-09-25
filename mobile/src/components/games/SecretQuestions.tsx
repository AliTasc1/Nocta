import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { GameLayout, GameTopBar, haptic, initialOf, PresenceAvatar, RadialGlow, RevealText, TypingDots, useCompact, type Player } from './shared';
import type { EngineProps } from './useGameSession';

const PLACEHOLDER = 'Bu cevap iki kişi aynı anda açana kadar gizli kalır, merak etme.';

/** 15 · Gizli Sorular — ikiniz de gizlice yazar, cevaplar aynı anda açılır */
export function SecretQuestions({ g, onClose }: EngineProps) {
  const { s: sz } = useCompact();
  const [draftState, setDraftState] = useState<{ round: number; text: string }>({ round: -1, text: '' });
  const [sending, setSending] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [partnerTypingAt, setPartnerTypingAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lastTypingSent = useRef(0);

  const session = g.session!;
  const r = session.current_index;
  const qid = session.question_ids[r];
  const q = qid ? g.questions[qid] : undefined;
  const myText: string | null = g.myAnswer ? String(g.myAnswer.answer?.text ?? '') : null;
  const partnerText: string | null = g.partnerAnswer ? String(g.partnerAnswer.answer?.text ?? '') : null;
  const bothIn = myText != null && partnerText != null;
  const revealed = bothIn && Number(session.state?.revealed ?? -1) === r;
  // Taslak tura bağlı: tur değişince kendiliğinden boşalır
  const draft = draftState.round === r ? draftState.text : '';

  // Partner "yazıyor…" sinyali
  const { on, send } = g;
  useEffect(
    () =>
      on('typing', (p) => {
        if (p.round === r) setPartnerTypingAt(Date.now());
      }),
    [on, r],
  );
  useEffect(() => {
    if (!partnerTypingAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [partnerTypingAt]);
  const partnerTyping = now - partnerTypingAt < 3500;

  useEffect(() => {
    if (revealed) haptic.success();
  }, [revealed]);

  const onChange = (t: string) => {
    setDraftState({ round: r, text: t });
    if (Date.now() - lastTypingSent.current > 1500) {
      lastTypingSent.current = Date.now();
      send('typing', { round: r });
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    await g.submitAnswer({ text }, { round: r, questionId: qid });
    setSending(false);
  };

  const reveal = async () => {
    if (!bothIn || revealing) return;
    setRevealing(true);
    await g.updateSession({ revealed: r });
    setRevealing(false);
  };

  const partnerStatus = g.partnerAnswered ? 'Yazdı ✓' : partnerTyping ? 'Yazıyor…' : 'Bekleniyor';

  let footer: React.ReactNode;
  if (myText == null) {
    footer = (
      <>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mist, textAlign: 'center' }}>İki cevap aynı anda açılır</Text>
        <Button title="Gizlice gönder" icon="lock" onPress={submit} disabled={!draft.trim()} loading={sending} />
      </>
    );
  } else if (!revealed) {
    footer = (
      <>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mist, textAlign: 'center' }}>
          {bothIn ? 'İkiniz de yazdınız. Hazırsanız açın.' : `${g.partner.name} yazınca açabilirsiniz`}
        </Text>
        <Button title="Cevapları aç" icon="visibility" onPress={reveal} disabled={!bothIn} loading={revealing} />
      </>
    );
  } else {
    footer = (
      <>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mist, textAlign: 'center' }}>Bu sırlar yalnızca ikinizin arasında.</Text>
        <Button title={r + 1 >= g.totalRounds ? 'Sonuçları gör' : 'Sonraki soru'} icon="arrow_forward" kind="light" onPress={() => g.advance(r)} loading={g.busy} />
      </>
    );
  }

  return (
    <GameLayout
      keyboard
      bg={<RadialGlow color="rgba(58,23,64,.95)" top="55%" size={1.3} />}
      top={
        <GameTopBar
          onClose={onClose}
          center={<Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: colors.irisSoft }}>{`GİZLİ · ${r + 1} / ${g.totalRounds}`}</Text>}
          right={<PresenceAvatar player={g.partner} online={g.partnerOnline} />}
        />
      }
      footer={footer}
    >
      <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(32, 27), lineHeight: sz(36, 31), color: colors.pearl, textAlign: 'center', paddingHorizontal: 6, paddingVertical: sz(8, 0) }}>
        {q?.text ?? ''}
      </Text>
      {!q ? <TypingDots /> : null}

      {myText == null ? (
        <View style={{ padding: 18, borderRadius: 24, backgroundColor: 'rgba(23,16,22,.8)', borderWidth: 1, borderColor: colors.rose, gap: 10 }}>
          <AnswerHead player={g.me} label="Sen" status={draft.trim() ? 'Yazıyorsun…' : ''} />
          <TextInput
            value={draft}
            onChangeText={onChange}
            multiline
            maxLength={600}
            placeholder="Cevabını buraya yaz…"
            placeholderTextColor={colors.mute}
            selectionColor={colors.rose}
            cursorColor={colors.rose}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Gizli cevabın"
            style={{ minHeight: 96, maxHeight: 180, color: colors.pearl, fontFamily: fonts.medium, fontSize: 15.5, lineHeight: 22, textAlignVertical: 'top', padding: 0 }}
          />
          <Text style={{ alignSelf: 'flex-end', fontFamily: fonts.mono, fontSize: 10, color: colors.faint }}>{`${draft.length}/600`}</Text>
        </View>
      ) : (
        <AnswerCard player={g.me} label="Sen" status="Yazdı ✓" text={myText} revealed={revealed} />
      )}

      <AnswerCard player={g.partner} label={g.partner.name} status={partnerStatus} text={partnerText} revealed={revealed} waiting={!g.partnerAnswered} />
    </GameLayout>
  );
}

function AnswerHead({ player, label, status, statusColor = colors.success }: { player: Player; label: string; status: string; statusColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: player.color, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 14, color: colors.pearl }}>{initialOf(player.name)}</Text>
      </View>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.pearl }}>{label}</Text>
      {status ? <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: statusColor }}>{status}</Text> : null}
    </View>
  );
}

function AnswerCard({ player, label, status, text, revealed, waiting }: { player: Player; label: string; status: string; text: string | null; revealed: boolean; waiting?: boolean }) {
  return (
    <View style={{ padding: 18, borderRadius: 24, backgroundColor: 'rgba(23,16,22,.8)', borderWidth: 1, borderColor: 'rgba(255,230,240,.1)', gap: 10, overflow: 'hidden' }}>
      <AnswerHead player={player} label={label} status={status} statusColor={waiting ? colors.mist : colors.success} />
      {waiting && !text ? (
        <View style={{ minHeight: 46, justifyContent: 'center' }}>
          <TypingDots />
        </View>
      ) : (
        <RevealText text={text} revealed={revealed} placeholder={PLACEHOLDER} />
      )}
    </View>
  );
}
