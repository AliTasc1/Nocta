import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Icon } from '@/components/ui';
import { uploadChatFile } from '@/lib/chatMedia';
import { play, preloadSfx } from '@/lib/sfx';
import { errorText, supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';
import { Burst, CONFETTI } from './Burst';
import { CLOWN_RED, ClownBadge, ClownHead, PeekingClown, type ClownVisit } from './Clown';
import { CLOWN_VIDEO, ClownLaughOverlay } from './ClownLaughOverlay';
import { GameLayout, GameTopBar, haptic, possessive, ResultPill, SoundToggle, TypingDots, useCompact, useReducedMotion, type Player } from './shared';
import { TableBackdrop } from './tableKit';
import type { EngineProps } from './useGameSession';
import { FrostedPhoto, ICE, pickPlacePhoto, usePhotoUri, type PlacePhoto } from './wherePhoto';

type Phase = 'shoot' | 'guess' | 'judge' | 'reveal';
type G = EngineProps['g'];

const INK = '#0B1626';
const HINTS_MAX = 3;
/** Buzun erime süresi; sonuç bu sürenin sonunda açıklanır */
const THAW_MS = 1500;

/**
 * Fotoğrafı çeken tarafın bu turdaki yerel bilgileri (doğru cevap, yerel fotoğraf, verdiği ipuçlarının açık hâli).
 * Sunucu cevabı ve açık ipuçlarını açılışa kadar göndermez; çeken kişi kendi yazdıklarını buradan görür.
 */
type RoundMemo = { answer?: string; localUri?: string; hints: string[] };
const memo = new Map<string, RoundMemo>();
const memoKey = (sid: string, round: number) => `${sid}:${round}`;
function writeMemo(sid: string, round: number, patch: (m: RoundMemo) => void) {
  const k = memoKey(sid, round);
  const m = memo.get(k) ?? { hints: [] };
  patch(m);
  memo.set(k, m);
}

/**
 * 20 · Burası Neresi?
 * Sırayla biri bir yer fotoğraflar (doğru cevap + palyaço için 1–3 şaşırtmaca), diğeri buzlu fotoğraftan
 * yeri tahmin eder. 3 ipucu hakkı var ama ipuçları yıldızlı gelir. Palyaço arada kenardan çıkıp
 * yanlış öneriler fısıldar; kabul edilirse tahmin otomatik yanlış sayılır.
 * Açılış (buzun erimesi, kutlama / palyaço kahkahası) reveal_nonce değişince iki telefonda da oynar.
 */
export function Where({ g, onClose }: EngineProps) {
  const session = g.session!;
  const st = session.state ?? {};
  const phase = (st.phase ?? 'shoot') as Phase;
  const round = Number(st.round ?? 0);
  const shooter: string = st.shooter ?? session.created_by;
  const iShoot = shooter === g.userId;
  const scores: Record<string, number> = st.scores ?? {};
  const nonce = Number(st.reveal_nonce ?? 0);
  const reduced = useReducedMotion();

  useEffect(() => {
    preloadSfx(['clown_pop', 'clown_laugh', 'photo_frost', 'saved_chime']);
  }, []);

  // ── Açılış sekansı (iki telefonda da reveal_nonce'tan) ────────
  const [clear] = useState(() => new Animated.Value(phase === 'reveal' ? 1 : 0));
  const [shownNonce, setShownNonce] = useState(nonce);
  const [burst, setBurst] = useState<number | null>(null);
  const [laugh, setLaugh] = useState<number | null>(null);
  const seen = useRef(nonce);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (nonce <= seen.current) return;
    seen.current = nonce;
    const correct = !!st.correct;
    clear.stopAnimation();
    clear.setValue(0);
    setBurst(null);
    setLaugh(null);
    play('photo_frost');
    haptic.light();
    Animated.timing(clear, { toValue: 1, duration: reduced ? 200 : THAW_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
    timers.current.push(
      setTimeout(() => {
        setShownNonce(nonce);
        if (correct) {
          play('saved_chime');
          haptic.success();
          setBurst(Date.now());
        } else setLaugh(Date.now());
      }, reduced ? 250 : THAW_MS - 100),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);
  // Yeni tur: buz geri gelir
  useEffect(() => {
    if (phase === 'shoot' || phase === 'guess') clear.setValue(0);
  }, [phase, clear]);

  const scoreOf = (id: string | null | undefined) => (id ? Number(scores[id] ?? 0) : 0);
  const top = (
    <GameTopBar
      onClose={onClose}
      center={
        <View accessibilityLabel={`Skor: sen ${scoreOf(g.userId)}, ${g.partner.name} ${scoreOf(g.partnerId)}. Tur ${round + 1}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 4, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(10,12,24,.82)', borderWidth: 1, borderColor: 'rgba(191,227,255,.25)' }}>
          <ScoreChip p={g.me} n={scoreOf(g.userId)} />
          <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color: ICE }}>{`TUR ${round + 1}`}</Text>
          <ScoreChip p={g.partner} n={scoreOf(g.partnerId)} right />
        </View>
      }
      right={<SoundToggle />}
    />
  );
  const bg = <TableBackdrop felt={['#0A0B16', '#181B33', '#06070D']} light="#A9C8FF" lightStrength={0.13} lightY={0.36} />;
  const ctx: Ctx = { g, st, round, top, bg, clear, iShoot, shooter };

  if (phase === 'shoot') return iShoot ? <ShootForm key={`s${round}`} c={ctx} /> : <WaitShoot c={ctx} />;
  if (phase === 'guess') return iShoot ? <ShooterWatch key={`w${round}`} c={ctx} /> : <GuessBoard key={`g${round}`} c={ctx} />;
  if (phase === 'judge') return iShoot ? <Judge c={ctx} /> : <WaitJudge c={ctx} />;
  return <Reveal c={ctx} revealed={shownNonce === nonce} burst={burst} laugh={laugh} onLaughDone={() => setLaugh(null)} />;
}

type Ctx = { g: G; st: Record<string, any>; round: number; top: React.ReactNode; bg: React.ReactNode; clear: Animated.Value; iShoot: boolean; shooter: string };

function ScoreChip({ p, n, right }: { p: Player; n: number; right?: boolean }) {
  return (
    <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
      <Avatar name={p.name} color={p.color} size={26} />
      <Text allowFontScaling={false} style={{ fontFamily: fonts.extrabold, fontSize: 15, color: colors.pearl, minWidth: 10, textAlign: 'center' }}>{n}</Text>
    </View>
  );
}

function useContentWidth() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return Math.min(width - insets.left - insets.right - 40, 520);
}

// ─────────────────────────────────────────────────────────────
// Ortak parçalar
// ─────────────────────────────────────────────────────────────
function Kicker({ children, color = ICE }: { children: React.ReactNode; color?: string }) {
  return (
    <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color }}>
      {children}
    </Text>
  );
}

function Title({ text, accent }: { text: string; accent?: string }) {
  const { s: sz } = useCompact();
  return (
    <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: sz(34, 28), lineHeight: sz(37, 31), color: colors.pearl }}>
      {text}
      {accent ? <Text style={{ fontFamily: fonts.serifItalic, color: ICE }}>{` ${accent}`}</Text> : null}
    </Text>
  );
}

/** Buz mavisi ana eylem düğmesi */
function FrostButton({ title, icon, onPress, loading, disabled, tone = 'ice', compact, grow }: { title: string; icon?: string; onPress: () => void; loading?: boolean; disabled?: boolean; tone?: 'ice' | 'success' | 'danger'; compact?: boolean; grow?: boolean }) {
  const grad: [string, string, string] = tone === 'success' ? ['#B8F0D6', '#7FD1AE', '#4A9E7C'] : tone === 'danger' ? ['#FFB3B3', '#F07A7A', '#B8474F'] : ['#EEF8FF', '#B5DAF7', '#7AA6D2'];
  const fg = tone === 'success' ? colors.onSuccess : tone === 'danger' ? '#2A0710' : INK;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: !!loading, disabled: !!disabled }}
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => ({ flex: grow ? 1 : undefined, height: 56, minWidth: compact ? 112 : undefined, borderRadius: 999, overflow: 'hidden', opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }], shadowColor: tone === 'ice' ? '#8CC4FF' : grad[1], shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 })}
    >
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', left: 2, right: 2, top: 2, height: 22, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: 'rgba(255,255,255,.28)' }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 }}>
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extrabold, fontSize: 16, color: fg }}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

function Input({ style, ...rest }: TextInputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      maxFontSizeMultiplier={1.25}
      {...rest}
      onFocus={(e) => {
        setFocus(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        rest.onBlur?.(e);
      }}
      style={[{ minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: focus ? 'rgba(191,227,255,.6)' : colors.lineStrong, backgroundColor: 'rgba(8,10,20,.72)', paddingHorizontal: 16, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 15.5, color: colors.pearl }, style]}
    />
  );
}

/** Yıldızlı ipucu metni: gizli harfler parlayan ✱ olarak */
function MaskedText({ text, size = 17 }: { text: string; size?: number }) {
  const parts = text.split(/(\*+)/).filter(Boolean);
  return (
    <Text accessibilityLabel={`İpucu: ${text.replace(/\*/g, ' gizli ')}`} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: size, lineHeight: size * 1.45, color: colors.pearl, letterSpacing: 1.2 }}>
      {parts.map((p, i) =>
        p.startsWith('*') ? (
          <Text key={i} style={{ color: colors.iris, fontFamily: fonts.extrabold, textShadowColor: 'rgba(168,139,240,.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
            {'✱'.repeat(p.length)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

function HintCard({ n, masked, raw, fresh }: { n: number; masked?: string | null; raw?: string | null; fresh?: boolean }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(fresh && !reduced ? 0 : 1));
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { rotateX: v.interpolate({ inputRange: [0, 1], outputRange: ['60deg', '0deg'] }) }] }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(168,139,240,.35)' }}>
        <LinearGradient colors={['rgba(52,38,102,.9)', 'rgba(20,16,44,.92)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,139,240,.18)', borderWidth: 1, borderColor: 'rgba(168,139,240,.45)' }}>
          <Text allowFontScaling={false} style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.irisSoft }}>{n}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.4, color: colors.irisSoft }}>{`İPUCU ${n}`}</Text>
          {raw ? <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.pearl }}>{raw}</Text> : null}
          {masked ? raw ? (
            <Text numberOfLines={2} style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.mist }}>
              {'Partnerin böyle görüyor: '}
              <MaskedText text={masked} size={12} />
            </Text>
          ) : (
            <MaskedText text={masked} />
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

function PhotoFor({ c, width, height, sharp, radius }: { c: Ctx; width: number; height: number; sharp: boolean; radius?: number }) {
  const local = memo.get(memoKey(c.g.sessionId, c.round))?.localUri;
  const { uri, failed } = usePhotoUri(c.st.photo, c.iShoot ? local : null);
  return <FrostedPhoto uri={uri} clear={c.clear} sharp={sharp} width={width} height={height} radius={radius} loadingLabel={failed ? 'Fotoğraf açılamadı' : undefined} />;
}

/** Fotoğrafı çekenin kendi (net) küçük fotoğrafı */
function ClearThumb({ c, size }: { c: Ctx; size: number }) {
  const local = memo.get(memoKey(c.g.sessionId, c.round))?.localUri;
  const { uri } = usePhotoUri(c.st.photo, local);
  return (
    <View style={{ width: size, height: size * 1.2, borderRadius: 18, overflow: 'hidden', backgroundColor: '#101422', borderWidth: 1, borderColor: 'rgba(191,227,255,.3)', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <ActivityIndicator color={ICE} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ÇEKİM (fotoğrafı çeken)
// ─────────────────────────────────────────────────────────────
const DECOY_PH = ['ör. Galata Kulesi', 'ör. Anneannemin balkonu', 'ör. Moda sahili'];

function ShootForm({ c }: { c: Ctx }) {
  const { g, round } = c;
  const session = g.session!;
  const toast = useToast();
  const cw = useContentWidth();
  const { compact } = useCompact();
  const [photo, setPhoto] = useState<PlacePhoto | null>(null);
  const [answer, setAnswer] = useState('');
  const [decoys, setDecoys] = useState(['', '', '']);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);

  const pick = async (src: 'camera' | 'library') => {
    haptic.tap();
    try {
      const p = await pickPlacePhoto(src);
      if (p) setPhoto(p);
    } catch (e) {
      toast.show(errorText(e), 'error');
    }
  };

  const filled = decoys.map((d) => d.trim()).filter(Boolean);
  const ready = !!photo && answer.trim().length >= 2 && filled.length >= 1;
  const submit = async () => {
    if (sending) return;
    if (!photo) return toast.show('Önce bir fotoğraf çek ya da seç.', 'info');
    if (answer.trim().length < 2) return toast.show('Doğru cevabı yaz: burası neresi?', 'info');
    if (!filled.length) return toast.show('Palyaço için en az bir şaşırtmaca yaz.', 'info');
    setSending(true);
    setProgress(0);
    haptic.light();
    const path = `${session.couple_id}/where/${session.id}/${uuid()}.${photo.ext}`;
    try {
      await uploadChatFile(path, photo.uri, photo.mimeType, setProgress);
    } catch (e) {
      toast.show(errorText(e), 'error');
      setSending(false);
      return;
    }
    const ans = answer.trim();
    writeMemo(session.id, round, (m) => {
      m.answer = ans;
      m.localUri = photo.uri;
      m.hints = [];
    });
    const row = await g.rpc('where_submit', { p_photo: path, p_answer: ans, p_decoys: filled });
    if (!row) {
      supabase.storage.from('chat-media').remove([path]).catch(() => {});
      setSending(false);
    } else haptic.success();
  };

  const photoH = Math.round(Math.min(cw * (compact ? 0.56 : 0.66), 280));
  const footer = (
    <FrostButton
      title={sending ? (progress < 1 ? `Yükleniyor… %${Math.round(progress * 100)}` : 'Gönderiliyor…') : 'Fotoğrafı gönder'}
      icon="send"
      loading={sending}
      disabled={!ready && !sending}
      onPress={submit}
    />
  );

  return (
    <GameLayout bg={c.bg} top={c.top} footer={footer} keyboard>
      <View style={{ gap: 4 }}>
        <Kicker>{`TUR ${round + 1} · FOTOĞRAF SENDEN`}</Kicker>
        <Title text="Bir yer" accent="fotoğrafla." />
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.mist }}>
          {`${g.partner.name} buzlu camın ardından tahmin edecek. Ne kadar zor, o kadar eğlenceli.`}
        </Text>
      </View>

      <View style={{ width: cw, height: photoH, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderStyle: photo ? 'solid' : 'dashed', borderColor: photo ? 'rgba(191,227,255,.35)' : 'rgba(191,227,255,.4)', backgroundColor: 'rgba(12,16,32,.7)' }}>
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.55)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 }} />
            <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 8 }}>
              <MiniAction icon="photo_camera" label="Yeniden çek" onPress={() => pick('camera')} />
              <MiniAction icon="photo_library" label="Galeriden değiştir" onPress={() => pick('library')} />
            </View>
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: compact ? 10 : 14, padding: compact ? 12 : 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(191,227,255,.1)' }}>
              <Icon name="travel_explore" size={30} color={ICE} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
              <PickButton icon="photo_camera" label="Fotoğraf çek" onPress={() => pick('camera')} primary />
              <PickButton icon="photo_library" label="Galeriden seç" onPress={() => pick('library')} />
            </View>
          </View>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.pearl }}>Burası neresi?</Text>
        <Input value={answer} onChangeText={setAnswer} maxLength={80} placeholder="ör. Kadıköy'deki kahvecimiz" accessibilityLabel="Doğru cevap: burası neresi?" returnKeyType="next" />
      </View>

      <View style={{ gap: 10, padding: 14, borderRadius: 20, backgroundColor: 'rgba(255,77,94,.07)', borderWidth: 1, borderColor: 'rgba(255,77,94,.28)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ClownBadge size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.3, color: '#FF8A96' }}>PALYAÇONUN ŞAŞIRTMACALARI</Text>
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.mist }}>
              {`Palyaço bunları ${possessive(g.partner.name)} kulağına fısıldayacak. 1–3 yanlış ama inandırıcı yer yaz.`}
            </Text>
          </View>
        </View>
        {decoys.map((d, i) => (
          <Input
            key={i}
            value={d}
            onChangeText={(t) => setDecoys((cur) => cur.map((x, k) => (k === i ? t : x)))}
            maxLength={60}
            placeholder={DECOY_PH[i]}
            accessibilityLabel={`Şaşırtmaca ${i + 1}${i === 0 ? ' (zorunlu)' : ' (isteğe bağlı)'}`}
            style={{ minHeight: 46, paddingVertical: 10, fontSize: 14.5 }}
          />
        ))}
      </View>
    </GameLayout>
  );
}

function PickButton({ icon, label, onPress, primary }: { icon: string; label: string; onPress: () => void; primary?: boolean }) {
  const { compact } = useCompact();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: compact ? 6 : 8, paddingHorizontal: compact ? 6 : 10, backgroundColor: primary ? ICE : 'rgba(255,255,255,.06)', borderWidth: primary ? 0 : 1, borderColor: 'rgba(191,227,255,.3)', opacity: pressed ? 0.8 : 1 })}
    >
      <Icon name={icon} size={compact ? 18 : 20} color={primary ? INK : ICE} />
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: compact ? 13 : 14, color: primary ? INK : colors.pearl }}>
        {label}
      </Text>
    </Pressable>
  );
}

function MiniAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,12,24,.78)', borderWidth: 1, borderColor: 'rgba(191,227,255,.35)', opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={20} color={ICE} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// ÇEKİM (bekleyen)
// ─────────────────────────────────────────────────────────────
function WaitShoot({ c }: { c: Ctx }) {
  const { g, round } = c;
  const reduced = useReducedMotion();
  const { s: sz } = useCompact();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduced]);
  const size = sz(170, 130);
  return (
    <GameLayout bg={c.bg} top={c.top} footer={<View style={{ flexDirection: 'row' }}><ResultPill text={`${g.partner.name} fotoğraf çekiyor…`} tone="wait" /></View>}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: sz(22, 14) }}>
        <View style={{ width: size * 1.3, height: size * 1.3, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ position: 'absolute', width: size * 1.3, height: size * 1.3, borderRadius: size, borderWidth: 1.5, borderColor: 'rgba(191,227,255,.25)', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.04] }) }] }} />
          <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(191,227,255,.08)', borderWidth: 1, borderColor: 'rgba(191,227,255,.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="photo_camera" size={size * 0.42} color={ICE} />
          </View>
          <Animated.View style={{ position: 'absolute', right: -size * 0.05, bottom: -size * 0.06, transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '8deg'] }) }] }}>
            <ClownHead size={size * 0.5} />
          </Animated.View>
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Kicker>{`TUR ${round + 1} · TAHMİN SENDEN`}</Kicker>
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: sz(32, 27), lineHeight: sz(36, 31), color: colors.pearl, textAlign: 'center' }}>Partnerin bir yer fotoğraflıyor…</Text>
        </View>
        <View style={{ alignSelf: 'stretch', gap: 10, padding: 14, borderRadius: 20, backgroundColor: 'rgba(10,12,24,.7)', borderWidth: 1, borderColor: 'rgba(191,227,255,.14)' }}>
          <Rule icon="ac_unit" text="Fotoğraf sana buzlu gelecek; yerini tahmin et." />
          <Rule icon="lightbulb" text={`${HINTS_MAX} ipucu hakkın var ama ipuçları yıldızlı gelir.`} />
          <Rule icon="sentiment_very_satisfied" text="Palyaçoya kanma: önerileri her zaman yanlış!" tint={CLOWN_RED} />
        </View>
      </View>
    </GameLayout>
  );
}

function Rule({ icon, text, tint = ICE }: { icon: string; text: string; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color={tint} style={{ marginTop: 1 }} />
      <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.pearlSoft }}>
        {text}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// TAHMİN (tahmin eden)
// ─────────────────────────────────────────────────────────────
const CLOWN_FIRST_MS = 6000;
const CLOWN_EVERY_MS = 21000;
const CLOWN_AFTER_HINT_MS = 1800;

function GuessBoard({ c }: { c: Ctx }) {
  const { g, st, round } = c;
  const cw = useContentWidth();
  const { compact, height } = useCompact();
  const insets = useSafeAreaInsets();
  const hints: string[] = Array.isArray(st.hints) ? st.hints : [];
  const hintsLeft = Number(st.hints_left ?? HINTS_MAX);
  const pending = !!st.hint_pending;
  const decoys: string[] = Array.isArray(st.clown) ? st.clown : [];
  const [guess, setGuess] = useState('');
  const [acting, setActing] = useState<'hint' | 'guess' | 'clown' | null>(null);

  // ── Palyaço ziyaretleri ─────────────────────────────────
  const [visit, setVisit] = useState<ClownVisit | null>(null);
  const next = useRef(0);
  const visitRef = useRef<ClownVisit | null>(null);
  const decoyRef = useRef(decoys);
  useEffect(() => {
    visitRef.current = visit;
    decoyRef.current = decoys;
  });
  useEffect(() => {
    const summon = () => {
      const list = decoyRef.current;
      if (!list.length || visitRef.current) return;
      const i = next.current++;
      setVisit({ key: Date.now(), text: list[i % list.length], side: i % 3 === 2 ? 'left' : 'right' });
    };
    const first = setTimeout(summon, CLOWN_FIRST_MS);
    const iv = setInterval(summon, CLOWN_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);
  // Her yeni ipucundan sonra palyaço da lafa girer
  const hintCount = hints.length;
  const seenHints = useRef(hintCount);
  useEffect(() => {
    if (hintCount <= seenHints.current) return;
    seenHints.current = hintCount;
    haptic.success();
    const t = setTimeout(() => {
      const list = decoyRef.current;
      if (!list.length) return;
      const i = next.current++;
      setVisit({ key: Date.now(), text: list[i % list.length], side: 'right' });
    }, CLOWN_AFTER_HINT_MS);
    return () => clearTimeout(t);
  }, [hintCount]);

  const askHint = async () => {
    if (acting || pending || hintsLeft <= 0) return;
    setActing('hint');
    haptic.tap();
    await g.rpc('where_ask_hint');
    setActing(null);
  };
  const sendGuess = async (text: string, fromClown: boolean) => {
    const t = text.trim();
    if (!t || acting) return;
    setActing(fromClown ? 'clown' : 'guess');
    haptic.heavy();
    const row = await g.rpc('where_guess', { p_text: t, p_from_clown: fromClown });
    if (!row) setActing(null);
  };

  const photoH = Math.round(compact ? Math.min(cw * 0.72, height * 0.36) : Math.min(cw * 1.02, height * 0.42));
  const footer = (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Input
        value={guess}
        onChangeText={setGuess}
        maxLength={80}
        placeholder="Tahminin: burası…"
        accessibilityLabel="Tahminin"
        returnKeyType="send"
        onSubmitEditing={() => sendGuess(guess, false)}
        style={{ flex: 1, minWidth: 0, height: 56, borderRadius: 999, paddingHorizontal: 18 }}
      />
      <FrostButton compact title="Tahmin et" loading={acting === 'guess'} disabled={!guess.trim() || !!acting} onPress={() => sendGuess(guess, false)} />
    </View>
  );

  return (
    <GameLayout
      bg={c.bg}
      top={c.top}
      footer={footer}
      keyboard
      overlay={
        <PeekingClown
          visit={visit}
          bottom={Math.max(insets.bottom, 16) + 86}
          busy={!!acting}
          onDismiss={() => setVisit(null)}
          onAccept={(t) => {
            setVisit(null);
            sendGuess(t, true);
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Kicker>{`TUR ${round + 1} · BURASI NERESİ?`}</Kicker>
        <HintDots left={hintsLeft} />
      </View>
      <View style={{ alignSelf: 'center' }}>
        <PhotoFor c={c} width={cw} height={photoH} sharp={false} />
        <View style={{ position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(8,12,24,.62)' }}>
          <Icon name="ac_unit" size={14} color={ICE} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.3, color: ICE }}>BUZLU</Text>
        </View>
      </View>

      {hints.map((h, i) => (
        <HintCard key={i} n={i + 1} masked={h} fresh={i === hints.length - 1} />
      ))}
      {pending ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(168,139,240,.45)' }}>
          <TypingDots color={colors.irisSoft} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.irisSoft }}>{`${g.partner.name} ipucu yazıyor…`}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Partnerinden yardım iste, ${hintsLeft} hakkın kaldı`}
        accessibilityState={{ disabled: pending || hintsLeft <= 0, busy: acting === 'hint' }}
        disabled={pending || hintsLeft <= 0 || !!acting}
        onPress={askHint}
        style={({ pressed }) => ({ minHeight: 52, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderWidth: 1.5, borderColor: hintsLeft > 0 && !pending ? 'rgba(168,139,240,.6)' : colors.line, backgroundColor: 'rgba(168,139,240,.1)', opacity: hintsLeft <= 0 || pending ? 0.5 : pressed ? 0.75 : 1 })}
      >
        {acting === 'hint' ? <ActivityIndicator color={colors.irisSoft} /> : <Icon name="lightbulb" size={20} color={colors.irisSoft} />}
        <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.pearl }}>
          {hintsLeft <= 0 ? 'İpucu hakkın bitti' : `Partnerinden yardım iste (${hintsLeft}/${HINTS_MAX})`}
        </Text>
      </Pressable>
    </GameLayout>
  );
}

function HintDots({ left }: { left: number }) {
  return (
    <View accessibilityLabel={`${left} ipucu hakkı kaldı`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {Array.from({ length: HINTS_MAX }).map((_, i) => (
        <Icon key={i} name="lightbulb" size={15} color={i < left ? colors.irisSoft : 'rgba(255,255,255,.16)'} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// TAHMİN (fotoğrafı çeken izler + ipucu verir)
// ─────────────────────────────────────────────────────────────
function ShooterWatch({ c }: { c: Ctx }) {
  const { g, st, round } = c;
  const toast = useToast();
  const reduced = useReducedMotion();
  const { s: sz } = useCompact();
  const masked: string[] = Array.isArray(st.hints) ? st.hints : [];
  const hintsLeft = Number(st.hints_left ?? HINTS_MAX);
  const pending = !!st.hint_pending;
  const decoys: string[] = Array.isArray(st.clown) ? st.clown : [];
  const [mine] = useState(() => memo.get(memoKey(g.sessionId, round)));
  const [given, setGiven] = useState<string[]>(() => mine?.hints ?? []);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!pending) return;
    haptic.warn();
    play('clown_pop', { volume: 0.5 });
    if (reduced) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.2, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pending, pulse, reduced]);

  const sendHint = async () => {
    const t = text.trim();
    if (sending) return;
    if (t.length < 2) return toast.show('İpucunu yaz.', 'info');
    setSending(true);
    const row = await g.rpc('where_give_hint', { p_text: t });
    setSending(false);
    if (row) {
      haptic.success();
      writeMemo(g.sessionId, round, (m) => {
        m.hints = [...m.hints, t];
      });
      setGiven((cur) => [...cur, t]);
      setText('');
    }
  };

  const count = Math.max(masked.length, given.length);
  const thumb = sz(112, 92);
  return (
    <GameLayout
      bg={c.bg}
      top={c.top}
      keyboard
      footer={pending ? null : <View style={{ flexDirection: 'row' }}><ResultPill text={`${g.partner.name} tahmin ediyor…`} tone="wait" /></View>}
    >
      <View style={{ gap: 4 }}>
        <Kicker>{`TUR ${round + 1} · FOTOĞRAF SENDEN`}</Kicker>
        <Title text={`${g.partner.name}`} accent="tahmin ediyor…" />
      </View>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <ClearThumb c={c} size={thumb} />
        <View style={{ flex: 1, gap: 8 }}>
          <View>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.3, color: colors.mute }}>DOĞRU CEVAP</Text>
            {mine?.answer ? (
              <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: 24, lineHeight: 27, color: colors.pearl }}>{mine.answer}</Text>
            ) : (
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.mist }}>Açılışta görünecek</Text>
            )}
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.3, color: '#FF8A96' }}>PALYAÇO FISILDIYOR</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {decoys.map((d) => (
                <View key={d} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,77,94,.12)', borderWidth: 1, borderColor: 'rgba(255,77,94,.3)' }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 12, color: '#FFB3BB' }}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {pending ? (
        <View style={{ gap: 10, padding: 14, borderRadius: 22, backgroundColor: 'rgba(40,30,80,.72)', borderWidth: 1, borderColor: 'rgba(168,139,240,.3)' }}>
          <Animated.View style={{ position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: 22, borderWidth: 2, borderColor: colors.iris, opacity: pulse, pointerEvents: 'none' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,139,240,.2)' }}>
              <Icon name="lightbulb" size={22} color={colors.irisSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.pearl }}>{`${g.partner.name} ipucu istiyor!`}</Text>
              <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.mist }}>Harflerin yaklaşık yarısı yıldızlanarak gider. Kısa ve net yaz.</Text>
            </View>
          </View>
          <Input value={text} onChangeText={setText} maxLength={120} placeholder="ör. Deniz kenarında, ilk buluşmamız" accessibilityLabel="İpucun" autoFocus returnKeyType="send" onSubmitEditing={sendHint} />
          <View style={{ flexDirection: 'row' }}>
            <FrostButton grow title="İpucunu gönder" icon="send" loading={sending} disabled={text.trim().length < 2} onPress={sendHint} />
          </View>
        </View>
      ) : null}

      {count ? (
        <View style={{ gap: 8 }}>
          <Kicker color={colors.irisSoft}>{`VERDİĞİN İPUÇLARI · ${hintsLeft} HAK KALDI`}</Kicker>
          {Array.from({ length: count }).map((_, i) => (
            <HintCard key={i} n={i + 1} raw={given[i] ?? null} masked={masked[i] ?? null} />
          ))}
        </View>
      ) : !pending ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: 'rgba(10,12,24,.6)', borderWidth: 1, borderColor: colors.line }}>
          <Icon name="info" size={18} color={colors.mist} />
          <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.mist }}>
            {`${g.partner.name} ipucu isterse burada göreceksin. ${hintsLeft} ipucu hakkı var.`}
          </Text>
        </View>
      ) : null}
    </GameLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// DEĞERLENDİRME
// ─────────────────────────────────────────────────────────────
function Judge({ c }: { c: Ctx }) {
  const { g, st, round } = c;
  const { s: sz } = useCompact();
  const fromClown = !!st.from_clown;
  const guess: string = st.guess ?? '';
  const answer = memo.get(memoKey(g.sessionId, round))?.answer;
  const [acting, setActing] = useState<boolean | null>(null);
  const judge = async (ok: boolean) => {
    if (acting != null) return;
    setActing(ok);
    haptic.heavy();
    const row = await g.rpc('where_judge', { p_correct: ok });
    if (!row) setActing(null);
  };
  const footer = fromClown ? (
    <View style={{ flexDirection: 'row' }}>
      <FrostButton grow title="Devam" icon="arrow_forward" loading={acting === false} onPress={() => judge(false)} />
    </View>
  ) : (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <FrostButton grow title="Yanlış" icon="close" tone="danger" loading={acting === false} disabled={acting === true} onPress={() => judge(false)} />
      <FrostButton grow title="Doğru" icon="check" tone="success" loading={acting === true} disabled={acting === false} onPress={() => judge(true)} />
    </View>
  );
  return (
    <GameLayout bg={c.bg} top={c.top} footer={footer}>
      <View style={{ gap: 4 }}>
        <Kicker>{`TUR ${round + 1} · KARAR SENİN`}</Kicker>
        <Title text={fromClown ? 'Palyaçoya' : 'Tahmin'} accent={fromClown ? 'kandı!' : 'geldi.'} />
      </View>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <ClearThumb c={c} size={sz(96, 80)} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.3, color: colors.mute }}>{answer ? 'SENİN CEVABIN' : 'SENİN FOTOĞRAFIN'}</Text>
          {answer ? (
            <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: 24, lineHeight: 27, color: colors.pearl }}>{answer}</Text>
          ) : (
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.mist }}>Doğru cevabı hatırla ve karar ver.</Text>
          )}
        </View>
      </View>
      <View style={{ padding: sz(20, 16), borderRadius: 24, gap: 8, backgroundColor: fromClown ? 'rgba(255,77,94,.1)' : 'rgba(191,227,255,.07)', borderWidth: 1.5, borderColor: fromClown ? 'rgba(255,77,94,.45)' : 'rgba(191,227,255,.3)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {fromClown ? <ClownBadge size={30} /> : <Avatar name={g.partner.name} color={g.partner.color} size={30} />}
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, color: fromClown ? '#FF8A96' : ICE }}>{fromClown ? `${g.partner.name} palyaçonun önerisini kabul etti` : `${g.partner.name} diyor ki:`}</Text>
        </View>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serifItalic, fontSize: sz(36, 30), lineHeight: sz(40, 34), color: colors.pearl }}>{`“${guess}”`}</Text>
      </View>
      {fromClown ? (
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.mist }}>
          Palyaçonun önerileri her zaman yanlış sayılır. Devam et ve palyaço gülsün.
        </Text>
      ) : (
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.mist }}>
          Yazım farkı önemli değil: yeri bildiyse “Doğru” de.
        </Text>
      )}
    </GameLayout>
  );
}

function WaitJudge({ c }: { c: Ctx }) {
  const { g, st, round } = c;
  const cw = useContentWidth();
  const { compact, height } = useCompact();
  const photoH = Math.round(compact ? Math.min(cw * 0.66, height * 0.33) : Math.min(cw * 0.95, height * 0.4));
  const fromClown = !!st.from_clown;
  return (
    <GameLayout bg={c.bg} top={c.top} footer={<View style={{ flexDirection: 'row' }}><ResultPill text={`${g.partner.name} değerlendiriyor…`} tone="wait" /></View>}>
      <Kicker>{`TUR ${round + 1} · TAHMİNİN GÖNDERİLDİ`}</Kicker>
      <View style={{ alignSelf: 'center' }}>
        <PhotoFor c={c} width={cw} height={photoH} sharp={false} />
      </View>
      <View style={{ padding: 16, borderRadius: 22, gap: 6, backgroundColor: 'rgba(10,12,24,.72)', borderWidth: 1, borderColor: fromClown ? 'rgba(255,77,94,.4)' : 'rgba(191,227,255,.22)' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.3, color: fromClown ? '#FF8A96' : colors.mute }}>{fromClown ? 'PALYAÇONUN ÖNERİSİ' : 'TAHMİNİN'}</Text>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serifItalic, fontSize: 30, lineHeight: 34, color: colors.pearl }}>{`“${st.guess ?? ''}”`}</Text>
        {fromClown ? <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.mist }}>Palyaço sinsice sırıtıyor… 🤡</Text> : null}
      </View>
    </GameLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// AÇILIŞ (iki telefon)
// ─────────────────────────────────────────────────────────────
function Reveal({ c, revealed, burst, laugh, onLaughDone }: { c: Ctx; revealed: boolean; burst: number | null; laugh: number | null; onLaughDone: () => void }) {
  const { g, st, round, iShoot } = c;
  const cw = useContentWidth();
  const { compact, height, s: sz } = useCompact();
  const reduced = useReducedMotion();
  const correct = !!st.correct;
  const fromClown = !!st.from_clown;
  const rawHints: string[] = Array.isArray(st.raw_hints) ? st.raw_hints : [];
  const [acting, setActing] = useState(false);
  const [v] = useState(() => new Animated.Value(revealed ? 1 : 0));
  useEffect(() => {
    if (!revealed) return;
    Animated.spring(v, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
  }, [revealed, v]);

  const nextRound = async () => {
    if (acting) return;
    setActing(true);
    haptic.tap();
    const row = await g.rpc('where_next');
    if (!row) setActing(false);
  };

  const photoH = Math.round(compact ? Math.min(cw * 0.62, height * 0.3) : Math.min(cw * 0.9, height * 0.38));
  const title = correct
    ? iShoot
      ? `${g.partner.name} bildi!`
      : 'Bildin!'
    : fromClown
      ? iShoot
        ? `${g.partner.name} palyaçoya kandı!`
        : 'Palyaçoya kandın!'
      : iShoot
        ? `${g.partner.name} bilemedi`
        : 'Olmadı…';
  const nextShooter = iShoot ? g.partner.name : 'Sen';
  const footer = (
    <>
      <FrostButton title="Sıradaki tur" icon="arrow_forward" loading={acting} disabled={!revealed} onPress={nextRound} />
      <Text style={{ textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.mute }}>{`Sıradaki fotoğraf: ${nextShooter === 'Sen' ? 'sende' : `${nextShooter} çekecek`}`}</Text>
    </>
  );

  return (
    <GameLayout
      bg={c.bg}
      top={c.top}
      footer={footer}
      overlay={
        <ClownLaughOverlay
          play={laugh}
          videoSource={CLOWN_VIDEO ?? undefined}
          variant={iShoot ? 'small' : 'full'}
          caption={fromClown ? 'Palyaçoya kandın!' : 'Yanlış tahmin!'}
          onDone={onLaughDone}
        />
      }
    >
      <Kicker>{`TUR ${round + 1} · AÇILIŞ`}</Kicker>
      <View style={{ alignSelf: 'center', zIndex: 3 }}>
        <PhotoFor c={c} width={cw} height={photoH} sharp />
        <Burst play={burst} emojis={CONFETTI} count={28} distance={cw * 0.6} size={22} />
      </View>
      {revealed ? (
        <Animated.View style={{ gap: sz(14, 10), opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 12, 0] }) }] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: correct ? colors.successTint : 'rgba(255,77,94,.14)', borderWidth: 1.5, borderColor: correct ? colors.success : CLOWN_RED }}>
              <Icon name={correct ? 'check' : 'close'} size={26} color={correct ? colors.success : CLOWN_RED} />
            </View>
            <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={{ flex: 1, fontFamily: fonts.serif, fontSize: sz(32, 27), lineHeight: sz(35, 30), color: correct ? colors.success : colors.pearl }}>
              {title}
            </Text>
          </View>
          <View style={{ padding: 14, borderRadius: 20, gap: 10, backgroundColor: 'rgba(10,12,24,.76)', borderWidth: 1, borderColor: 'rgba(191,227,255,.18)' }}>
            <RevealRow label="BURASI" value={st.answer ?? '—'} big />
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong }} />
            <RevealRow label={fromClown ? 'TAHMİN · PALYAÇODAN 🤡' : 'TAHMİN'} value={st.guess ?? '—'} tone={correct ? 'ok' : 'bad'} />
            {rawHints.length ? (
              <>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong }} />
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.3, color: colors.irisSoft }}>{`İPUÇLARI · ${rawHints.length}/${HINTS_MAX}`}</Text>
                  {rawHints.map((h, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.irisSoft }}>{`${i + 1}.`}</Text>
                      <Text maxFontSizeMultiplier={1.2} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.pearlSoft }}>{h}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 60 }}>
          <Icon name="ac_unit" size={18} color={ICE} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: ICE }}>Buz eriyor…</Text>
        </View>
      )}
    </GameLayout>
  );
}

function RevealRow({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'ok' | 'bad' }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.3, color: tone === 'bad' ? '#FF8A96' : tone === 'ok' ? colors.success : colors.mute }}>{label}</Text>
      <Text
        maxFontSizeMultiplier={1.2}
        style={{ fontFamily: big ? fonts.serif : fonts.bold, fontSize: big ? 28 : 17, lineHeight: big ? 31 : 22, color: tone === 'bad' ? colors.pearlSoft : colors.pearl, textDecorationLine: tone === 'bad' ? 'line-through' : 'none', textDecorationColor: CLOWN_RED }}
      >
        {value}
      </Text>
    </View>
  );
}
