import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon } from '@/components/ui';
import { colors, fonts } from '@/theme';
import { Burst, HEARTS } from './Burst';
import { GameLayout, GameTopBar, haptic, mediaOf, MiniAvatar, optionsOf, PartnerStatus, possessive, RadialGlow, ResultPill, TypingDots, useCompact, useReducedMotion, type Player } from './shared';
import type { EngineProps } from './useGameSession';

const MAX_CARDS = 6;

/** Görseli olmayan kartlar için sıralı gradyanlar ve dekoratif ikonlar */
const PALETTES: [string, string][] = [
  ['#6B1E38', '#2A1530'],
  ['#3A1740', '#171016'],
  ['#5A1A2E', '#211720'],
  ['#2A1530', '#6B1E38'],
  ['#3A1D2B', '#3A1740'],
  ['#211720', '#5A1A2E'],
];
const ICONS = ['auto_awesome', 'nights_stay', 'favorite', 'local_florist', 'wb_twilight', 'style'];

const choiceOf = (a: { answer?: Record<string, any> } | undefined) => (a?.answer?.choice != null ? String(a.answer.choice) : null);

/**
 * 17 · Kart Seç
 * Her soruya resimli kartlardan birini gizlice seçersiniz; ikiniz de seçince kartlar
 * çevrilir ve partnerin seçimi açılır. Doğru cevap yok, aynı kart = eşleşme.
 * Karta basılı tutmak büyük önizlemeyi açar. Cevap biçimi: `{ choice: "<indeks>" }`.
 */
export function CardPick({ g, onClose }: EngineProps) {
  const { s: sz, compact } = useCompact();
  const { width: winW } = useWindowDimensions();
  const session = g.session!;
  const r = session.current_index;
  const qid = session.question_ids[r];
  const q = qid ? g.questions[qid] : undefined;
  const opts = optionsOf(q).slice(0, MAX_CARDS);
  const media = mediaOf(q);

  const mine = choiceOf(g.myAnswer);
  const theirs = choiceOf(g.partnerAnswer);
  const revealed = mine != null && theirs != null;
  const matched = revealed && mine === theirs;
  const isLast = r + 1 >= g.totalRounds;
  const [preview, setPreview] = useState<number | null>(null);

  let sameCount = 0;
  let played = 0;
  for (let i = 0; i <= r; i++) {
    const a = choiceOf(g.mineFor(i));
    const b = choiceOf(g.partnerFor(i));
    if (a == null || b == null) continue;
    played++;
    if (a === b) sameCount++;
  }

  useEffect(() => {
    if (!revealed) return;
    (matched ? haptic.success : haptic.warn)();
  }, [revealed, matched]);

  const pick = (i: number) => {
    if (mine != null || !q) return;
    haptic.tap();
    g.submitAnswer({ choice: String(i) }, { round: r, questionId: qid });
  };

  // Izgara: 2 sütun; geniş ekranda 6 kart → 3 sütun. Portre 3:4 (küçük ekranda biraz basık)
  // Ölçüm gelene dek pencere genişliğinden tahmin (GameLayout yatay dolgusu 20+20)
  const [measuredW, setGridW] = useState(0);
  const gridW = measuredW > 0 ? measuredW : Math.max(0, winW - 40);
  const cols = opts.length >= 5 && winW >= 600 ? 3 : 2;
  const gap = 12;
  const cardW = gridW > 0 ? (gridW - gap * (cols - 1)) / cols : 0;
  const cardH = cardW * (compact ? 1.2 : 4 / 3);

  let resTitle = '';
  let resSub = '';
  if (revealed) {
    if (matched) {
      resTitle = 'Aynı kartı seçtiniz! ♡';
      resSub = `İkiniz de “${opts[Number(mine)] ?? ''}” dediniz.`;
    } else {
      resTitle = 'Farklı kartlar 👀';
      resSub = `${possessive(g.partner.name)} kartı: “${opts[Number(theirs)] ?? ''}”`;
    }
  }

  const pill = !q
    ? { text: 'Soru yükleniyor…', tone: 'idle' as const }
    : mine == null
      ? { text: g.partnerAnswered ? `${g.partner.name} seçti · sıra sende` : 'Gizlice bir kart seç', tone: 'idle' as const }
      : { text: `${g.partner.name} bekleniyor`, tone: 'wait' as const };

  return (
    <GameLayout
      bg={<RadialGlow color="rgba(231,104,138,.28)" top="0%" size={1.4} />}
      top={
        <GameTopBar
          onClose={onClose}
          center={
            <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.velvet, borderWidth: 1, borderColor: 'rgba(231,104,138,.35)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="style" size={14} color={colors.blush} />
              <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: colors.blush }}>
                KART SEÇ
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <PartnerStatus name={g.partner.name} done={g.partnerAnswered} />
        {played > 0 ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.blush }}>{`♡ ${sameCount} / ${played} aynı kart`}</Text> : null}
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.blush }}>AYNI KARTI SEÇEBİLECEK MİSİNİZ?</Text>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(32, 26), lineHeight: sz(35, 29), color: colors.pearl }}>
          {q?.text ?? ''}
        </Text>
      </View>

      {!q ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <TypingDots />
        </View>
      ) : (
        <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap, zIndex: 2 }}>
          {cardW > 0
            ? opts.map((t, i) => {
                const k = String(i);
                const who: Player[] = [];
                if (mine === k) who.push(g.me);
                if (revealed && theirs === k) who.push(g.partner);
                let state: CardState = 'idle';
                if (!revealed) state = mine === k ? 'selected' : mine != null ? 'dim' : 'idle';
                else state = who.length ? (matched ? 'match' : mine === k ? 'selected' : 'partner') : 'dim';
                // Açılışta partnerin kartı çevrilir (aynıysa ortak kart)
                const flip = revealed && theirs === k;
                return (
                  <PickCard
                    key={`${r}-${i}`}
                    index={i}
                    title={t}
                    image={media[i] ?? ''}
                    state={state}
                    who={who}
                    flip={flip}
                    celebrate={revealed && matched && mine === k ? `${r}-${i}` : null}
                    width={cardW}
                    height={cardH}
                    disabled={mine != null}
                    onPress={() => pick(i)}
                    onPreview={() => {
                      haptic.light();
                      setPreview(i);
                    }}
                  />
                );
              })
            : null}
        </View>
      )}

      <View style={{ marginTop: 'auto', alignItems: 'center', gap: 4, minHeight: 56, justifyContent: 'flex-end', paddingTop: 4 }}>
        {resTitle ? (
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serifItalic, fontSize: sz(30, 26), lineHeight: sz(34, 30), color: matched ? colors.rose : colors.blush, textAlign: 'center' }}>
            {resTitle}
          </Text>
        ) : null}
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.mist, textAlign: 'center' }}>
          {revealed ? resSub : mine != null ? 'Kartın kilitlendi. İkiniz de seçince kartlar açılır.' : 'Büyütmek için karta basılı tut. Seçimler gizli kalır.'}
        </Text>
      </View>

      <CardPreview index={preview} title={preview != null ? opts[preview] ?? '' : ''} image={preview != null ? media[preview] ?? '' : ''} onClose={() => setPreview(null)} />
    </GameLayout>
  );
}

// ─────────────────────────────────────────────────────────────

type CardState = 'idle' | 'selected' | 'dim' | 'match' | 'partner';

function PickCard({
  index,
  title,
  image,
  state,
  who,
  flip,
  celebrate,
  width,
  height,
  disabled,
  onPress,
  onPreview,
}: {
  index: number;
  title: string;
  image: string;
  state: CardState;
  who: Player[];
  flip: boolean;
  celebrate: string | null;
  width: number;
  height: number;
  disabled: boolean;
  onPress: () => void;
  onPreview: () => void;
}) {
  const reduced = useReducedMotion();
  const lift = useState(() => new Animated.Value(0))[0];
  const turn = useState(() => new Animated.Value(flip ? 1 : 0))[0];
  const emphasized = state === 'selected' || state === 'match' || state === 'partner';

  useEffect(() => {
    Animated.spring(lift, { toValue: emphasized ? 1 : 0, useNativeDriver: true, friction: 6, tension: 120 }).start();
  }, [emphasized, lift]);

  // Çevirme: 0 → 90° (arka yüz) → 0°; partner avatarı dönüşün ortasında belirir
  useEffect(() => {
    if (!flip) {
      turn.setValue(0);
      return;
    }
    turn.setValue(0);
    const a = Animated.timing(turn, { toValue: 1, duration: reduced ? 300 : 720, delay: reduced ? 0 : 120, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [flip, reduced, turn]);

  const border = state === 'selected' || state === 'match' ? colors.rose : state === 'partner' ? colors.iris : 'rgba(255,230,240,.12)';
  const glow = state === 'selected' || state === 'match' ? 'rgba(231,104,138,.45)' : state === 'partner' ? 'rgba(168,139,240,.4)' : null;
  const hasImage = /^https?:\/\//i.test(image);
  const pal = PALETTES[index % PALETTES.length];
  const a11yWho = who.length ? `, seçen: ${who.map((p) => p.name).join(' ve ')}` : '';

  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : 1.035] });
  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : -6] });
  const rotateY = reduced ? '0deg' : turn.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '0deg'] });
  // Arka yüz yalnızca dönüşün ortasında görünür; ön yüzdeki "kim seçti" rozeti sonra açılır
  const backOpacity = turn.interpolate({ inputRange: [0, 0.3, 0.5, 0.7, 1], outputRange: [0, reduced ? 0 : 1, reduced ? 0.6 : 1, reduced ? 0 : 1, 0] });
  const whoOpacity = flip ? turn.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] }) : 1;

  return (
    <Animated.View style={{ width, height, zIndex: celebrate ? 5 : emphasized ? 2 : 1, opacity: state === 'dim' ? 0.5 : 1, transform: [{ perspective: 900 }, { translateY }, { scale }, { rotateY }] }}>
      {glow ? <View pointerEvents="none" style={{ position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 25, backgroundColor: glow, opacity: 0.55 }} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} kartı${a11yWho}`}
        accessibilityHint="Seçmek için dokun, büyütmek için basılı tut"
        accessibilityState={{ selected: state === 'selected' || state === 'match', disabled }}
        disabled={false}
        onPress={disabled ? undefined : onPress}
        onLongPress={onPreview}
        delayLongPress={320}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: emphasized ? 2 : 1,
          borderColor: border,
          backgroundColor: colors.velvet,
          opacity: pressed && !disabled ? 0.88 : 1,
        })}
      >
        <LinearGradient colors={pal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {hasImage ? (
          <Image source={{ uri: image }} contentFit="cover" transition={250} cachePolicy="memory-disk" recyclingKey={image} accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: height * 0.18 }]}>
            <View style={{ width: width * 0.46, height: width * 0.46, borderRadius: width * 0.23, backgroundColor: 'rgba(255,230,240,.07)', borderWidth: 1, borderColor: 'rgba(255,230,240,.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ICONS[index % ICONS.length]} size={Math.round(width * 0.24)} color={colors.blush} />
            </View>
          </View>
        )}
        <LinearGradient colors={['rgba(12,8,11,0)', 'rgba(12,8,11,.55)', 'rgba(12,8,11,.92)']} locations={[0, 0.4, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.max(72, height * 0.45) }} />
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
          <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 19, color: colors.pearl }}>
            {title}
          </Text>
        </View>
        {state === 'match' ? (
          <View style={{ position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="favorite" size={16} color={colors.onRose} />
          </View>
        ) : null}
        {who.length ? (
          <Animated.View style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', opacity: whoOpacity }}>
            {who.map((p, i) => (
              <View key={p.id || p.name} style={{ marginLeft: i ? -8 : 0 }}>
                <MiniAvatar player={p} size={28} />
              </View>
            ))}
          </Animated.View>
        ) : null}
        {/* Kartın arka yüzü (çevirme sırasında) */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: flip ? backOpacity : 0, alignItems: 'center', justifyContent: 'center' }]}>
          <LinearGradient colors={['#E7688A', '#6B1E38']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Icon name="favorite" size={Math.round(width * 0.28)} color="rgba(26,7,16,.55)" />
        </Animated.View>
      </Pressable>
      <Burst play={celebrate} emojis={HEARTS} count={20} distance={Math.max(100, width * 0.9)} size={18} delay={reduced ? 0 : 520} />
    </Animated.View>
  );
}

/** Basılı tutunca açılan büyük kart önizlemesi */
function CardPreview({ index, title, image, onClose }: { index: number | null; title: string; image: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const v = useState(() => new Animated.Value(0))[0];
  const open = index != null;
  useEffect(() => {
    if (!open) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();
  }, [open, v]);

  const w = Math.min(width - 48, 420, (height - insets.top - insets.bottom - 140) * 0.75);
  const h = w * (4 / 3);
  const i = index ?? 0;
  const hasImage = /^https?:\/\//i.test(image);
  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Önizlemeyi kapat" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(12,8,11,.88)', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Animated.View style={{ width: w, height: h, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,230,240,.18)', transform: [{ scale: reduced ? 1 : v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
          <LinearGradient colors={PALETTES[i % PALETTES.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {hasImage ? (
            <Image source={{ uri: image }} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingBottom: h * 0.15 }]}>
              <Icon name={ICONS[i % ICONS.length]} size={Math.round(w * 0.3)} color={colors.blush} />
            </View>
          )}
          <LinearGradient colors={['rgba(12,8,11,0)', 'rgba(12,8,11,.92)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.4 }} />
          <Text maxFontSizeMultiplier={1.2} style={{ position: 'absolute', left: 20, right: 20, bottom: 20, fontFamily: fonts.serif, fontSize: 32, lineHeight: 35, color: colors.pearl }}>
            {title}
          </Text>
        </Animated.View>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.mist }}>Kapatmak için dokun</Text>
      </Pressable>
    </Modal>
  );
}
