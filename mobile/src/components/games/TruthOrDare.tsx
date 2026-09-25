import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Icon } from '@/components/ui';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';
import { GameLayout, GameTopBar, haptic, levelName, possessive, PresenceAvatar, RadialGlow, TypingDots, upper, useCompact, useReducedMotion } from './shared';
import type { EngineProps } from './useGameSession';

type Kind = 'truth' | 'dare';

/** 11 · Doğruluk mu Cesaret mi — sırayla, kart çekerek */
export function TruthOrDare({ g, onClose }: EngineProps) {
  const toast = useToast();
  const { s: sz } = useCompact();
  const reduced = useReducedMotion();
  const [pending, setPending] = useState<'pick' | 'done' | 'skip' | null>(null);

  const session = g.session!;
  const st = session.state ?? {};
  const truths: string[] = Array.isArray(st.truths) ? st.truths : [];
  const dares: string[] = Array.isArray(st.dares) ? st.dares : [];
  const ti = Number(st.ti ?? 0);
  const di = Number(st.di ?? 0);
  const turn = Number(st.turn ?? 0) === 1 ? 1 : 0;
  const pick: Kind | null = st.pick === 'truth' || st.pick === 'dare' ? st.pick : null;
  const currentId: string | null = typeof st.current === 'string' ? st.current : null;
  const q = currentId ? g.questions[currentId] : undefined;
  const r = session.current_index;
  // state.turn: 0 → çiftin user_a'sı, 1 → user_b'si
  const myTurn = g.membersKnown ? (turn === 0) === g.amUserA : false;
  const turnName = myTurn ? 'SENİN SIRAN' : `${upper(possessive(g.partner.name))} SIRASI`;
  const truthsLeft = truths.length - ti;
  const daresLeft = dares.length - di;
  const truth = (pick ?? 'truth') === 'truth';

  // Kart değişince giriş animasyonu
  const anim = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    if (reduced) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 60 }).start();
    if (currentId) haptic.light();
  }, [currentId, reduced, anim]);

  const choose = async (kind: Kind) => {
    if (!myTurn || pending) return;
    if (pick === kind && currentId) return;
    const list = kind === 'truth' ? truths : dares;
    const idx = kind === 'truth' ? ti : di;
    if (idx >= list.length) {
      toast.show(kind === 'truth' ? 'Doğruluk kartları bitti, cesaret zamanı!' : 'Cesaret kartları bitti, doğruluk zamanı!', 'info');
      return;
    }
    setPending('pick');
    haptic.tap();
    await g.updateSession({ pick: kind, current: list[idx], [kind === 'truth' ? 'ti' : 'di']: idx + 1 });
    setPending(null);
  };

  const complete = async (choice: 'done' | 'skip') => {
    if (!currentId || pending) return;
    setPending(choice);
    const ok = await g.submitAnswer({ choice, kind: pick }, { round: r, questionId: currentId });
    if (ok) {
      if (choice === 'done') haptic.success();
      if (truthsLeft + daresLeft <= 0) await g.finish();
      else await g.advance(r, { turn: turn === 0 ? 1 : 0, pick: null, current: null });
    }
    setPending(null);
  };

  const cardColors: [string, string] = !currentId ? ['#2A1530', '#171016'] : truth ? ['#3A1740', '#1E1220'] : ['#6B1E38', '#2A1530'];
  const glow = truth ? 'rgba(168,139,240,.28)' : 'rgba(231,104,138,.35)';

  return (
    <GameLayout
      bg={<RadialGlow color={glow} top="48%" />}
      top={
        <GameTopBar
          onClose={onClose}
          center={`KART ${Math.min(r + 1, g.totalRounds)} / ${g.totalRounds} · ${turnName}`}
          right={<PresenceAvatar player={g.partner} online={g.partnerOnline} />}
        />
      }
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pas geç"
            disabled={!currentId || !!pending}
            onPress={() => complete('skip')}
            style={({ pressed }) => ({
              flex: 1,
              height: 56,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,230,240,.16)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !currentId ? 0.4 : pressed ? 0.7 : 1,
            })}
          >
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.pearl }}>
              {pending === 'skip' ? '…' : 'Pas geç'}
            </Text>
          </Pressable>
          <Button title="Yaptım ✓" onPress={() => complete('done')} disabled={!currentId} loading={pending === 'done'} style={{ flex: 2 }} />
        </View>
      }
    >
      {/* DOĞRULUK / CESARET seçici */}
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: colors.line, opacity: myTurn ? 1 : 0.6 }}
      >
        {(['truth', 'dare'] as Kind[]).map((k) => {
          const active = pick === k;
          const left = k === 'truth' ? truthsLeft : daresLeft;
          const bg = active ? (k === 'truth' ? colors.pearl : colors.rose) : 'transparent';
          const fg = active ? colors.onRose : left <= 0 ? colors.faint : colors.mist;
          return (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: active, disabled: !myTurn }}
              accessibilityLabel={k === 'truth' ? 'Doğruluk' : 'Cesaret'}
              disabled={!myTurn || !!pending}
              onPress={() => choose(k)}
              style={{ flex: 1, height: 48, borderRadius: 999, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extrabold, fontSize: 14, letterSpacing: 1.6, color: fg }}>
                {k === 'truth' ? 'DOĞRULUK' : 'CESARET'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Kart */}
      <View style={{ flex: 1, minHeight: sz(360, 280), marginBottom: 10 }}>
        <View style={[StyleSheet.absoluteFill, { left: 18, right: 18, top: 18, bottom: -10, borderRadius: 32, backgroundColor: colors.velvet, borderWidth: 1, borderColor: 'rgba(255,230,240,.06)', transform: [{ rotate: '3deg' }] }]} />
        <Animated.View
          style={{
            flex: 1,
            borderRadius: 32,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,230,240,.14)',
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 20 },
            elevation: 12,
          }}
        >
          <LinearGradient colors={cardColors} start={{ x: 0.2, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, padding: sz(28, 22), justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: 2.4, color: colors.blush }}>
                {currentId ? (truth ? 'DOĞRULUK' : 'CESARET') : 'SIRADAKİ KART'}
              </Text>
              {q ? (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.3)' }}>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: colors.pearl }}>{upper(levelName(q.level))}</Text>
                </View>
              ) : null}
            </View>
            {currentId ? (
              q ? (
                <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(34, 28), lineHeight: sz(38, 32), color: colors.pearl }}>
                  {q.text}
                </Text>
              ) : (
                <TypingDots />
              )
            ) : (
              <View style={{ gap: 12 }}>
                <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(36, 30), lineHeight: sz(40, 34), color: colors.pearl }}>
                  Doğruluk mu,{'\n'}
                  <Text style={{ fontFamily: fonts.serifItalic, color: colors.blush }}>cesaret mi?</Text>
                </Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.pearlSoft }}>
                  {myTurn ? 'Sıra sende. Yukarıdan birini seç, kartın açılsın.' : `${g.partner.name} kartını seçiyor…`}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={myTurn ? 'touch_app' : 'visibility'} size={18} color={colors.pearlSoft} />
              <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.pearlSoft }}>
                {!currentId
                  ? `${truthsLeft} doğruluk · ${daresLeft} cesaret kartı kaldı`
                  : myTurn
                    ? 'Bitirince “Yaptım”a dokun. Pas geçmek serbest.'
                    : `${g.partner.name} kartını oynuyor. Bitince “Yaptım”a dokunabilirsin.`}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </GameLayout>
  );
}
