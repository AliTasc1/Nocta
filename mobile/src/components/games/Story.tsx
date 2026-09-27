import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Icon } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';
import type { Story as StoryRow, StoryChoice, StoryScene } from '@/lib/types';
import { useContent } from '@/providers/ContentProvider';
import { colors, fonts } from '@/theme';
import { CircleButton, GameBackground, haptic, PresenceAvatar, RevealCountdown, TypingDots, upper, useCompact, useReducedMotion, useRevealGate } from './shared';
import type { EngineProps } from './useGameSession';

type StoryData = { story: StoryRow | null; scenes: Record<string, StoryScene>; choices: Record<string, StoryChoice[]> };

/**
 * 17 · Çift Hikâyesi — ikiniz de oy verirsiniz. Aynı seçim → o sahne; farklıysa
 * kimliği alfabetik olarak önce gelen seçenek ("kader") kazanır. İlerletmeyi user_a'nın
 * telefonu yapar; ulaşılamazsa user_b biraz sonra dener (mutlak indeks → güvenli).
 */
export function Story({ g, onClose }: EngineProps) {
  const insets = useSafeAreaInsets();
  const { s: sz } = useCompact();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { stories } = useContent();
  const session = g.session!;
  const st = session.state ?? {};
  const storyId: string | undefined = st.story_id;
  const sceneId: string | undefined = st.scene_id;
  const path: string[] = Array.isArray(st.path) ? st.path : sceneId ? [sceneId] : [];
  const r = session.current_index;

  const [data, setData] = useState<StoryData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partnerVotes, setPartnerVotes] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!storyId) return;
    try {
      const [{ data: scenes, error: e1 }, storyRes] = await Promise.all([
        supabase.from('story_scenes').select('*').eq('story_id', storyId).order('sort'),
        stories.find((s) => s.id === storyId) ? Promise.resolve({ data: stories.find((s) => s.id === storyId) }) : supabase.from('stories').select('*').eq('id', storyId).maybeSingle(),
      ]);
      if (e1) throw e1;
      const list = (scenes ?? []) as StoryScene[];
      const ids = list.map((s) => s.id);
      const { data: ch, error: e2 } = ids.length ? await supabase.from('story_choices').select('*').in('scene_id', ids).order('sort') : { data: [], error: null };
      if (e2) throw e2;
      const byScene: Record<string, StoryChoice[]> = {};
      for (const c of (ch ?? []) as StoryChoice[]) (byScene[c.scene_id] ??= []).push(c);
      setLoadError(null);
      setData({ story: (storyRes.data as StoryRow) ?? null, scenes: Object.fromEntries(list.map((s) => [s.id, s])), choices: byScene });
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [storyId, stories]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  // Partnerin oyu (broadcast) — RLS nedeniyle kendi oyunu vermeden önce yalnızca buradan görünür
  const { on } = g;
  useEffect(
    () =>
      on('answered', (p) => {
        if (typeof p.round === 'number' && typeof p.choice === 'string') setPartnerVotes((v) => ({ ...v, [p.round]: p.choice }));
      }),
    [on],
  );

  const scene = sceneId && data ? data.scenes[sceneId] : undefined;
  const choices = scene && data ? data.choices[scene.id] ?? [] : [];
  const isEnding = !!scene && (scene.is_ending || choices.length === 0);
  const mine: string | null = g.myAnswer?.answer?.choice ?? null;
  const theirs: string | null = g.partnerAnswer?.answer?.choice ?? partnerVotes[r] ?? null;
  const bothIn = !!g.myAnswer && !!g.partnerAnswer;
  // İki oy da gelince 3-2-1 → karar açılır → izleme süresinden sonra otomatik ilerler
  const gate = useRevealGate(g, bothIn && !isEnding, r);
  const bothVoted = bothIn && gate.revealed;
  const decided = bothVoted && mine && g.partnerAnswer?.answer?.choice ? [mine, String(g.partnerAnswer.answer.choice)].sort()[0] : null;
  const same = bothVoted && mine === g.partnerAnswer?.answer?.choice;
  const decidedChoice = decided ? choices.find((c) => c.id === decided) : undefined;

  // Karar verildiyse sahneyi ilerlet
  const recorded = useRef<number | null>(null);
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  });
  const { advance, finish, amUserA, membersKnown } = g;
  useEffect(() => {
    if (decidedChoice) haptic.success();
  }, [decidedChoice]);
  const canGo = gate.canAdvance;
  useEffect(() => {
    if (!decidedChoice || !membersKnown || !canGo) return;
    const next = decidedChoice.next_scene_id;
    const t = setTimeout(
      async () => {
        if (amUserA && recorded.current !== r) {
          recorded.current = r;
          supabase.rpc('record_story_choice', { p_choice: decidedChoice.id }).then(() => {});
        }
        if (!next) await finish();
        else await advance(r, { scene_id: next, path: [...pathRef.current, next] });
      },
      amUserA ? 0 : 2500,
    );
    return () => clearTimeout(t);
  }, [decidedChoice, membersKnown, canGo, amUserA, r, advance, finish]);

  // Sahne geçişi (sinematik 900ms)
  const fade = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    fade.setValue(reduced ? 1 : 0);
    if (!reduced) Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [sceneId, reduced, fade]);

  const vote = (c: StoryChoice) => {
    if (mine) return;
    haptic.tap();
    g.submitAnswer({ choice: c.id, public: true }, { round: r, questionId: null });
  };

  if (loadError || (data && !scene)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, paddingTop: insets.top + 6, paddingHorizontal: 20, justifyContent: 'center' }}>
        <EmptyState
          icon={loadError ? 'wifi_off' : 'lock'}
          tone={loadError ? 'error' : 'iris'}
          title={loadError ? 'Hikâye yüklenemedi' : 'Bu hikâyeye erişilemiyor'}
          desc={loadError ?? 'Bu hikâye Nocta Premium ile açılır ya da artık yayında değil.'}
          action={loadError ? 'Tekrar dene' : 'Premium’u incele'}
          onAction={loadError ? load : () => router.push('/premium')}
          secondary="Oyundan çık"
          onSecondary={onClose}
        />
      </View>
    );
  }

  const glow = scene?.glow || 'rgba(231,104,138,.4)';
  const dotsTotal = Math.max(4, path.length + (isEnding ? 0 : 1));

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <GameBackground accent={glow} intensity={1.25} />
      {/* Çizgili doku */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: 0.5 }]}>
        {Array.from({ length: 40 }).map((_, i) => (
          <View key={i} style={{ position: 'absolute', top: -200, left: i * 20 - 200, width: 1, height: height * 1.6, backgroundColor: 'rgba(255,230,240,.035)', transform: [{ rotate: '45deg' }] }} />
        ))}
      </View>
      <LinearGradient pointerEvents="none" colors={['rgba(12,8,11,0)', 'rgba(12,8,11,.72)', 'rgba(12,8,11,.9)']} locations={[0, 0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' }} />

      <View style={{ flex: 1, paddingTop: insets.top + 6, paddingLeft: insets.left, paddingRight: insets.right }}>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <CircleButton icon="close" label="Oyundan çık" onPress={onClose} />
          <PresenceAvatar player={g.partner} online={g.partnerOnline} />
        </View>
        {scene?.art_note ? (
          <Text numberOfLines={3} style={{ marginTop: 14, paddingHorizontal: 24, maxWidth: 280, fontFamily: fonts.mono, fontSize: 10, lineHeight: 15, color: colors.mute }}>
            {`SAHNE GÖRSELİ · ${scene.art_note}`}
          </Text>
        ) : null}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingTop: 24, paddingBottom: Math.max(insets.bottom, 16) + 14, gap: 16 }} showsVerticalScrollIndicator={false}>
          {!scene ? (
            <View style={{ alignItems: 'center', paddingBottom: 40 }}>
              <TypingDots />
            </View>
          ) : (
            <Animated.View style={{ gap: 16, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, color: colors.blush }}>
                  {`${upper(data?.story?.title ?? 'HİKÂYE')} · ${scene.chapter}`}
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {Array.from({ length: dotsTotal }).map((_, i) => (
                    <View key={i} style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: i < path.length ? colors.blush : 'rgba(255,255,255,.2)' }} />
                  ))}
                </View>
              </View>
              {scene.title ? <Text style={{ fontFamily: fonts.serifItalic, fontSize: 20, color: colors.blush }}>{scene.title}</Text> : null}
              <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(27, 23), lineHeight: sz(32, 27), color: colors.pearl }}>
                {scene.body}
              </Text>

              {isEnding ? (
                <View style={{ gap: 10 }}>
                  <Button title="Hikâyeyi bitir" iconRight="auto_awesome" loading={g.busy} onPress={() => finish()} />
                  <Text style={{ textAlign: 'center', fontFamily: fonts.semibold, fontSize: 12, color: colors.mist }}>{`+${Math.max(scene.xp || 0, 100)} XP · anılarınıza kaydedilir`}</Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {choices.map((c) => {
                    const me = mine === c.id;
                    const them = theirs === c.id;
                    const label = me && them ? `${g.partner.name} de seçti ♡` : them ? `${g.partner.name} seçti` : me ? 'Sen seçtin' : '';
                    const win = decided === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        accessibilityRole="button"
                        accessibilityLabel={c.text}
                        accessibilityState={{ selected: me, disabled: !!mine }}
                        disabled={!!mine}
                        onPress={() => vote(c)}
                        style={({ pressed }) => ({
                          minHeight: 60,
                          borderRadius: 20,
                          overflow: 'hidden',
                          borderWidth: win ? 1.5 : 1,
                          borderColor: win ? colors.rose : me ? colors.blush : 'rgba(255,230,240,.18)',
                          backgroundColor: Platform.OS === 'ios' ? 'rgba(40,24,36,.35)' : 'rgba(40,24,36,.85)',
                          opacity: pressed ? 0.85 : mine && !me && !them ? 0.6 : 1,
                        })}
                      >
                        {Platform.OS === 'ios' ? <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} /> : null}
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, paddingVertical: 12 }}>
                          <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15.5, color: colors.pearl }}>{c.text}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '45%' }}>
                            {label ? <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, color: colors.mist }}>{label}</Text> : null}
                            <Icon name="arrow_forward" size={20} color={colors.blush} />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                  <View style={{ minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {bothIn && !gate.revealed ? (
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.blush }}>Karar açılıyor…</Text>
                    ) : decidedChoice ? (
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: same ? colors.blush : colors.irisSoft, textAlign: 'center' }}>
                        {same ? 'Aynı yolu seçtiniz ♡' : `Kader seçti: “${decidedChoice.text}”`}
                      </Text>
                    ) : mine ? (
                      <>
                        <TypingDots />
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.mist }}>{`${g.partner.name} bekleniyor`}</Text>
                      </>
                    ) : (
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mute }}>İkiniz de seçin; farklı seçerseniz kader karar verir.</Text>
                    )}
                  </View>
                </View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </View>
      <RevealCountdown count={gate.count} label="Karar açılıyor…" />
    </View>
  );
}
