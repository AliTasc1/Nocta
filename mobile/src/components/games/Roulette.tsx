import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Avatar, Button, Icon } from '@/components/ui';
import { play, preloadSfx } from '@/lib/sfx';
import { colors, fonts } from '@/theme';
import { Revolver, STAGE_H, STAGE_W, type RevolverAnims } from './Revolver';
import { GameLayout, GameTopBar, haptic, possessive, ResultPill, SoundToggle, TypingDots, useCompact, useReducedMotion, type Player } from './shared';
import { SignatureView, SIG_H, SIG_W, useSignaturePad } from './SignaturePad';
import { GoldButton, TableBackdrop } from './tableKit';
import type { EngineProps } from './useGameSession';

type Pull = { by: string; fired: boolean; chamber: number };
type Last = { by: string; fired: boolean; at: number } | null;
type Confession = { by: string; prompt: string | null; text: string };

const GOLD = '#D4AF6E';
const GOLD_SOFT = 'rgba(212,175,110,.35)';
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const trDate = (d: Date) => `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
const HOLD_MS = 800;

/**
 * 18 · Rus Ruleti
 * Dürüstlük sözleşmesi (iki imza) → tambura tek mermi (yeri sunucuda gizli) → sırayla tetik →
 * mermi kimde patlarsa itiraf eder → yeni tur. Tüm efektler iki telefonda da durum
 * değişikliklerinden tetiklenir (load_nonce, last.at, confessions).
 */
export function Roulette({ g, onClose }: EngineProps) {
  const session = g.session!;
  const st = session.state ?? {};
  const phase: string = st.phase ?? 'contract';
  const reduced = useReducedMotion();
  const { s: sz, compact } = useCompact();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const pulls: Pull[] = Array.isArray(st.pulls) ? st.pulls : [];
  const chamber = Number(st.chamber ?? 0);
  const last: Last = st.last ?? null;
  const confessions: Confession[] = Array.isArray(st.confessions) ? st.confessions : [];
  const round = Number(st.round ?? 0);
  const loadNonce = Number(st.load_nonce ?? 0);
  const turn: string | null = st.turn ?? null;
  const myTurn = !!turn && turn === g.userId;
  const nameOf = (id: string | null | undefined) => (id === g.userId ? g.me.name : g.partner.name);

  useEffect(() => {
    preloadSfx();
  }, []);

  // ── Animasyon değerleri ─────────────────────────────────
  const [a] = useState<RevolverAnims>(() => ({
    rot: new Animated.Value(60 * chamber),
    cock: new Animated.Value(0),
    blur: new Animated.Value(0),
    headIn: new Animated.Value(0),
    insert: new Animated.Value(0),
    smoke: new Animated.Value(0),
    recoil: new Animated.Value(0),
    bob: new Animated.Value(0),
  }));
  const [fx] = useState(() => ({
    flash: new Animated.Value(0),
    shake: new Animated.Value(0),
    danger: new Animated.Value(phase === 'confess' ? 1 : 0),
    snap: new Animated.Value(0),
    hold: new Animated.Value(0),
  }));
  const rotTarget = useRef(60 * chamber);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  /** 'loading': mermi yükleniyor · 'bang': patlama sahnesi (itiraf ekranı gecikmeli açılır) */
  const [seq, setSeq] = useState<'idle' | 'loading' | 'bang'>('idle');
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [reveal, setReveal] = useState<Confession | null>(null);

  // ── Yükleme sekansı (load_nonce artınca iki telefonda da) ──
  const seenLoad = useRef(loadNonce);
  useEffect(() => {
    if (loadNonce <= seenLoad.current) return;
    seenLoad.current = loadNonce;
    setSeq('loading');
    setBanner(null);
    a.rot.stopAnimation();
    a.headIn.setValue(0);
    a.insert.setValue(0);
    a.blur.setValue(0);
    a.smoke.setValue(0);
    const k = reduced ? 0.35 : 1;
    play('bullet_load');
    haptic.light();
    Animated.timing(a.insert, { toValue: 1, duration: 650 * k, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
    later(560 * k, () => Animated.timing(a.headIn, { toValue: 1, duration: 120, useNativeDriver: true }).start());
    later(760 * k, () => {
      play('cylinder_close');
      haptic.heavy();
      fx.snap.setValue(0);
      Animated.sequence([
        Animated.timing(fx.snap, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.spring(fx.snap, { toValue: 0, friction: 4, tension: 180, useNativeDriver: true }),
      ]).start();
    });
    const spinAt = 1020 * k;
    const spinMs = reduced ? 700 : 2200;
    later(spinAt, () => {
      play('cylinder_spin');
      const from = rotTarget.current;
      const to = Math.ceil(from / 360) * 360 + (reduced ? 360 : 360 * 5);
      rotTarget.current = to;
      Animated.parallel([
        Animated.timing(a.rot, { toValue: to, duration: spinMs, easing: Easing.bezier(0.12, 0.72, 0.18, 1), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(a.blur, { toValue: 0.92, duration: 160, useNativeDriver: true }),
          Animated.timing(a.blur, { toValue: 0, duration: spinMs * 0.7, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(a.headIn, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
      // Cırcır hissi: yavaşladıkça seyrelen hafif titreşimler
      if (!reduced) {
        let t = 70;
        let step = 45;
        while (t < spinMs - 150) {
          later(t, haptic.tap);
          step *= 1.22;
          t += step;
        }
      }
    });
    later(spinAt + spinMs, () => {
      haptic.heavy();
      Animated.sequence([
        Animated.timing(a.rot, { toValue: rotTarget.current + 2.5, duration: 70, useNativeDriver: true }),
        Animated.spring(a.rot, { toValue: rotTarget.current, friction: 5, tension: 220, useNativeDriver: true }),
      ]).start();
      setSeq((s) => (s === 'loading' ? 'idle' : s));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadNonce]);

  // ── Tetik sonucu (last.at değişince iki telefonda da) ───
  const lastAt = last?.at ?? null;
  const seenLast = useRef(lastAt);
  useEffect(() => {
    if (lastAt == null || lastAt === seenLast.current || !last) return;
    seenLast.current = lastAt;
    const mine = last.by === g.userId;
    Animated.timing(a.cock, { toValue: 0, duration: 60, useNativeDriver: true }).start();
    fx.hold.setValue(0);
    if (!last.fired) {
      play('empty_click');
      haptic.heavy();
      Animated.sequence([
        Animated.timing(a.recoil, { toValue: 0.28, duration: 60, useNativeDriver: true }),
        Animated.spring(a.recoil, { toValue: 0, friction: 5, tension: 160, useNativeDriver: true }),
      ]).start();
      rotTarget.current = rotTarget.current + 60;
      const to = rotTarget.current;
      later(reduced ? 80 : 300, () => {
        Animated.timing(a.rot, { toValue: to, duration: reduced ? 150 : 420, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
        later(reduced ? 150 : 360, haptic.tap);
      });
      const key = Date.now();
      setBanner({ text: mine ? 'Klik… şanslısın' : `Klik… ${last.by === g.partnerId ? g.partner.name : 'o'} şanslı`, key });
      later(2600, () => setBanner((b) => (b && b.key === key ? null : b)));
    } else {
      setSeq('bang');
      setBanner(null);
      play('gunshot');
      haptic.heavy();
      later(90, haptic.error);
      later(260, haptic.heavy);
      later(520, haptic.heavy);
      fx.flash.setValue(0);
      Animated.sequence([
        Animated.timing(fx.flash, { toValue: 1, duration: 40, useNativeDriver: true }),
        Animated.timing(fx.flash, { toValue: 0, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(a.recoil, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.spring(a.recoil, { toValue: 0, friction: 4, tension: 90, useNativeDriver: true }),
      ]).start();
      if (!reduced) {
        const shakes = [1, -0.8, 0.6, -0.45, 0.3, -0.18, 0];
        Animated.sequence(shakes.map((v) => Animated.timing(fx.shake, { toValue: v, duration: 55, useNativeDriver: true }))).start();
        a.smoke.setValue(0);
        Animated.timing(a.smoke, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      }
      Animated.timing(fx.danger, { toValue: 1, duration: 380, useNativeDriver: true }).start();
      later(reduced ? 900 : 2500, () => setSeq((s) => (s === 'bang' ? 'idle' : s)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAt]);

  // ── Faz geçişleri: yeni turda tambur boşalır, kırmızı ton söner ──
  useEffect(() => {
    if (phase === 'loading') {
      a.insert.setValue(0);
      a.headIn.setValue(0);
      a.smoke.setValue(0);
      Animated.timing(fx.danger, { toValue: 0, duration: 600, useNativeDriver: true }).start();
    }
    if (phase === 'confess') fx.danger.setValue(1);
  }, [phase, a, fx]);

  // Bekleme: fişek hafifçe süzülür
  const idleLoading = phase === 'loading' && seq === 'idle';
  useEffect(() => {
    if (!idleLoading || reduced) {
      a.bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a.bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a.bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [idleLoading, reduced, a]);

  // ── İtiraf yapıldı: partnerin telefonunda itiraf kartı ──
  const seenConf = useRef(confessions.length);
  useEffect(() => {
    if (confessions.length <= seenConf.current) return;
    seenConf.current = confessions.length;
    const c = confessions[confessions.length - 1];
    if (c && c.by !== g.userId) {
      setReveal(c);
      play('saved_chime');
      haptic.success();
    }
  }, [confessions, g.userId]);

  // ── Partner horozu kurarken (canlı yayın) ───────────────
  const { on, send } = g;
  useEffect(
    () =>
      on('rr_cock', (p) => {
        if (p.on) {
          play('hammer_cock');
          Animated.timing(a.cock, { toValue: 1, duration: HOLD_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        } else Animated.timing(a.cock, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      }),
    [on, a],
  );

  // İki imza tamamlanınca sözleşme ekranı kısa bir süre kalır (mühür animasyonu görülsün)
  const [holdContract, setHoldContract] = useState(false);
  const prevPhase = useRef(phase);
  useEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = phase;
    if (was === 'contract' && phase !== 'contract') {
      setHoldContract(true);
      haptic.success();
      const t = setTimeout(() => setHoldContract(false), reduced ? 600 : 1900);
      return () => clearTimeout(t);
    }
  }, [phase, reduced]);

  // ── Eylemler ─────────────────────────────────────────────
  const [acting, setActing] = useState(false);
  const load = async () => {
    if (acting) return;
    haptic.tap();
    setActing(true);
    await g.rpc('roulette_load');
    setActing(false);
  };
  const pull = async () => {
    if (acting) return;
    setActing(true);
    const res = await g.rpc('roulette_pull');
    setActing(false);
    if (!res) {
      Animated.timing(a.cock, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      fx.hold.setValue(0);
      send('rr_cock', { on: false });
    }
  };

  // ── Görünüm ──────────────────────────────────────────────
  const shownPhase = holdContract ? 'contract' : seq === 'bang' ? 'playing' : phase;
  const contentW = Math.min(width - insets.left - insets.right - 40, 520);
  const stageW = Math.max(220, Math.min(contentW, 360, ((height - insets.top - insets.bottom - (compact ? 345 : 350)) * STAGE_W) / STAGE_H));

  const spent = pulls.filter((p) => !p.fired).map((p) => p.chamber);
  const bangChamber = pulls.find((p) => p.fired)?.chamber ?? null;
  const remaining = Math.max(1, 6 - chamber);

  const shake = fx.shake.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] });
  const snapScale = fx.snap.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  const top = (
    <GameTopBar
      onClose={onClose}
      center={
        <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(20,12,14,.8)', borderWidth: 1, borderColor: GOLD_SOFT, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="gps_fixed" size={14} color={GOLD} />
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: GOLD }}>
            {shownPhase === 'contract' ? 'SÖZLEŞME' : 'RUS RULETİ'}
          </Text>
        </View>
      }
      right={<SoundToggle />}
    />
  );

  const bg = (
    <>
      <TableBackdrop felt={['#130A0C', '#26121A', '#0B0607']} light="#FFC98A" lightStrength={shownPhase === 'contract' ? 0.16 : 0.26} lightY={shownPhase === 'contract' ? 0.35 : 0.45} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fx.danger }, { pointerEvents: 'none' }]}>
        <DangerVignette />
      </Animated.View>
    </>
  );

  const overlay = (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fx.flash }, { pointerEvents: 'none' }]}>
        <MuzzleFlash />
      </Animated.View>
      {reveal ? <ConfessionReveal c={reveal} name={nameOf(reveal.by)} onClose={() => setReveal(null)} /> : null}
    </>
  );

  if (shownPhase === 'contract') return <Contract g={g} top={top} bg={bg} contentW={contentW} />;

  if (shownPhase === 'confess') {
    return <Confess g={g} top={top} bg={bg} overlay={overlay} loser={st.loser ?? null} prompt={st.prompt?.text ?? null} nameOf={nameOf} />;
  }

  // loading / playing
  let headline = '';
  let sub = '';
  if (seq === 'bang') {
    headline = last?.by === g.userId ? 'BANG! 💥' : `BANG! ${last ? nameOf(last.by) : ''} 💥`;
    sub = 'Mermi patladı. Sözleşme geçerli: itiraf zamanı.';
  } else if (phase === 'loading') {
    headline = round === 0 ? 'Tek mermi. Altı yuva.' : 'Tambur yeniden dolsun';
    sub = `${turn ? (turn === g.userId ? 'Sen' : g.partner.name) : 'Sıradaki'} ilk tetiği çekecek. Mermiyi ikiniz de yerleştirebilirsiniz.`;
  } else if (seq === 'loading') {
    headline = 'Tambur dönüyor…';
    sub = 'Mermi içeride bir yerde. Nerede olduğunu kimse bilmiyor.';
  } else if (banner) {
    headline = banner.text;
    sub = `Kalan yuva: ${remaining} · Artık ihtimal 1/${remaining}`;
  } else if (myTurn) {
    headline = 'Sıra sende — tetiği çek';
    sub = remaining === 1 ? 'Son yuva. Kaçış yok 😬' : 'Basılı tut, horoz kalksın… ve bırakma.';
  } else {
    headline = `${g.partner.name} tetiği çekiyor…`;
    sub = 'Nefesini tut.';
  }

  const footer =
    phase === 'loading' && seq === 'idle' ? (
      <GoldButton title="Mermiyi yerleştir" icon="add_circle" loading={acting} onPress={load} />
    ) : phase === 'playing' && seq === 'idle' && myTurn ? (
      <HoldTrigger
        hold={fx.hold}
        disabled={acting || !!banner}
        reduced={reduced}
        onStart={() => {
          play('hammer_cock');
          haptic.light();
          send('rr_cock', { on: true });
          Animated.timing(a.cock, { toValue: 1, duration: HOLD_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        }}
        onCancel={() => {
          send('rr_cock', { on: false });
          Animated.timing(a.cock, { toValue: 0, duration: 160, useNativeDriver: true }).start();
        }}
        onFire={pull}
      />
    ) : (
      <View style={{ flexDirection: 'row' }}>
        <ResultPill
          text={seq === 'bang' ? 'İtiraf ekranı açılıyor…' : seq === 'loading' ? 'Tambur dönüyor…' : banner ? 'Sıra değişiyor…' : `${g.partner.name} tetikte`}
          tone="wait"
        />
      </View>
    );

  return (
    <GameLayout bg={bg} overlay={overlay} top={top} footer={footer}>
      <Duel me={g.me} partner={g.partner} turn={phase === 'playing' && seq === 'idle' ? turn : null} userId={g.userId} round={round} confessions={confessions.length} />
      <View style={{ flex: 1, maxHeight: 40 }} />
      <Animated.View style={{ alignItems: 'center', transform: [{ translateX: shake }, { scale: snapScale }] }}>
        <Revolver size={stageW} a={a} spent={spent} bang={seq === 'bang' ? bangChamber : null} showCartridge={phase === 'loading' || seq === 'loading'} />
      </Animated.View>
      <View style={{ alignItems: 'center', gap: 8, marginTop: -sz(6, 10) }}>
        {phase === 'playing' ? <Chambers chamber={chamber} fired={seq === 'bang' ? bangChamber : null} loading={seq === 'loading'} /> : null}
        <Text
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={1.2}
          style={{ fontFamily: seq === 'bang' ? fonts.serif : fonts.serifItalic, fontSize: seq === 'bang' ? sz(42, 34) : sz(30, 26), lineHeight: seq === 'bang' ? sz(46, 38) : sz(34, 30), color: seq === 'bang' ? '#FF8A7A' : colors.pearl, textAlign: 'center' }}
        >
          {headline}
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.mist, textAlign: 'center', maxWidth: 320 }}>
          {sub}
        </Text>
        {phase === 'playing' && seq === 'idle' && !banner ? (
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: GOLD }}>{`KALAN YUVA: ${remaining} · İHTİMAL 1/${remaining}`}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1 }} />
    </GameLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// Sözleşme
// ─────────────────────────────────────────────────────────────
function Contract({ g, top, bg, contentW }: { g: EngineProps['g']; top: React.ReactNode; bg: React.ReactNode; contentW: number }) {
  const st = g.session!.state ?? {};
  const mySig: string | null = typeof st[`sig_${g.userId}`] === 'string' ? st[`sig_${g.userId}`] : null;
  const partnerSig: string | null = g.partnerId && typeof st[`sig_${g.partnerId}`] === 'string' ? st[`sig_${g.partnerId}`] : null;
  const { s: sz } = useCompact();
  const [drawing, setDrawing] = useState(false);
  const [sig, setSig] = useState<{ d: string; n: number }>({ d: '', n: 0 });
  const [sending, setSending] = useState(false);
  const [date] = useState(() => trDate(new Date()));
  // Açılışta zaten imzalı olanlar için damga animasyonu oynatılmaz
  const [initial] = useState(() => ({ me: !!mySig, partner: !!partnerSig }));
  const pad = useSignaturePad({ width: contentW, onChange: (d, n) => setSig({ d, n }), onDrawing: setDrawing, disabled: !!mySig || sending });

  useEffect(() => {
    if (partnerSig && !initial.partner) haptic.heavy();
  }, [partnerSig, initial.partner]);

  const submit = async () => {
    if (sig.n < 6 || sig.d.length < 10 || sending) return;
    setSending(true);
    haptic.heavy();
    await g.rpc('roulette_sign', { p_signature: sig.d });
    setSending(false);
  };

  const cardPad = sz(20, 16);
  const slotW = Math.floor((contentW - cardPad * 2 - 14) / 2);

  const footer = mySig ? (
    <View style={{ flexDirection: 'row' }}>
      <ResultPill text={partnerSig ? 'Sözleşme tamam. Masa hazırlanıyor…' : `${g.partner.name} imzalıyor…`} tone="wait" />
    </View>
  ) : (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Button title="Temizle" kind="outline" icon="refresh" disabled={pad.empty || sending} onPress={pad.clear} style={{ flex: 0.8 }} />
      <Button title="İmzala" icon="draw" loading={sending} disabled={sig.n < 6 || sig.d.length < 10} onPress={submit} glow style={{ flex: 1.2 }} />
    </View>
  );

  return (
    <GameLayout bg={bg} top={top} footer={footer} scrollEnabled={!drawing}>
      <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: GOLD_SOFT, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12 }}>
        <LinearGradient colors={['#2A181E', '#1C1014', '#150C10']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        <PaperGrain />
        <View style={{ position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,110,.18)', pointerEvents: 'none' }} />
        <Corner style={{ top: 12, left: 12 }} />
        <Corner style={{ top: 12, right: 12, transform: [{ scaleX: -1 }] }} />
        <Corner style={{ bottom: 12, left: 12, transform: [{ scaleY: -1 }] }} />
        <Corner style={{ bottom: 12, right: 12, transform: [{ scaleX: -1 }, { scaleY: -1 }] }} />
        <View style={{ padding: cardPad, paddingTop: sz(22, 16), paddingBottom: cardPad + 10, gap: sz(12, 9) }}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <WaxSeal />
            <Text maxFontSizeMultiplier={1.15} style={{ fontFamily: fonts.monoMedium, fontSize: sz(13, 12), letterSpacing: 3.2, color: GOLD, textAlign: 'center' }}>
              DÜRÜSTLÜK SÖZLEŞMESİ
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 1, backgroundColor: GOLD_SOFT }} />
              <Text style={{ fontFamily: fonts.serifItalic, fontSize: 14, color: 'rgba(244,185,200,.7)' }}>{`${g.me.name} & ${g.partner.name}`}</Text>
              <View style={{ width: 28, height: 1, backgroundColor: GOLD_SOFT }} />
            </View>
          </View>
          <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(19, 16), lineHeight: sz(26, 21), color: colors.pearlSoft, textAlign: 'center' }}>
            {'Ben, '}
            <Text style={{ fontFamily: fonts.serifItalic, color: colors.blush }}>{g.me.name}</Text>
            {', bu masada sorulan her soruya dürüst cevap vereceğime, yalan söylemeyeceğime ve mermi bende patlarsa itirafımı eksiksiz yapacağıma söz veriyorum. Bu sözleşme ikimizin arasında kalır.'}
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.4, color: colors.mute, textAlign: 'center' }}>{`TARİH · ${date.toLocaleUpperCase('tr-TR')}`}</Text>
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 2 }}>
            <SigSlot label="Sen" name={g.me.name} path={mySig} width={slotW} animate={!initial.me} />
            <SigSlot label="Partner" name={g.partner.name} path={partnerSig} width={slotW} animate={!initial.partner} />
          </View>
        </View>
      </View>

      {!mySig ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.blush }}>PARMAĞINLA İMZALA</Text>
          {pad.node}
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          {!partnerSig ? <TypingDots color={GOLD} /> : null}
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.mist, textAlign: 'center' }}>
            {partnerSig ? 'İki imza da tamam. Tambur masaya geliyor…' : `İmzan alındı. ${g.partner.name} imzalayınca masa kurulur.`}
          </Text>
        </View>
      )}
    </GameLayout>
  );
}

function SigSlot({ label, name, path, width, animate }: { label: string; name: string; path: string | null; width: number; animate: boolean }) {
  const h = Math.round((width * SIG_H) / SIG_W);
  return (
    <View style={{ width, gap: 4 }}>
      <View style={{ height: h, justifyContent: 'flex-end' }}>
        {path ? (
          <View style={{ position: 'absolute', left: 0, top: 0 }}>
            <SignatureView path={path} width={width} strokeWidth={3.4} />
          </View>
        ) : (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.serifItalic, fontSize: 13, color: colors.faint }}>imza bekleniyor…</Text>
          </View>
        )}
        {path ? <Stamp animate={animate} /> : null}
      </View>
      <View style={{ height: 1, backgroundColor: GOLD_SOFT }} />
      <Text numberOfLines={1} style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.3, color: colors.mute }}>{label.toLocaleUpperCase('tr-TR')}</Text>
      <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.pearl, marginTop: -3 }}>{name}</Text>
    </View>
  );
}

/** "İMZALANDI" mührü: büyükten küçüğe çarparak basılır */
function Stamp({ animate }: { animate: boolean }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(animate ? 0 : 1));
  useEffect(() => {
    if (!animate) return;
    Animated.sequence([
      Animated.delay(150),
      Animated.timing(v, { toValue: 1, duration: reduced ? 1 : 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => haptic.heavy(), reduced ? 150 : 410);
    return () => clearTimeout(t);
  }, [animate, v, reduced]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        right: -2,
        bottom: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderWidth: 2,
        borderColor: 'rgba(231,72,98,.85)',
        borderRadius: 6,
        opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.4, 0.92] }),
        transform: [{ rotate: '-12deg' }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) }],
        pointerEvents: 'none',
      }}
    >
      <Text allowFontScaling={false} style={{ fontFamily: fonts.monoMedium, fontSize: 10, letterSpacing: 1.6, color: 'rgba(240,96,120,.95)' }}>
        İMZALANDI
      </Text>
    </Animated.View>
  );
}

function Corner({ style }: { style: object }) {
  return (
    <View style={[{ position: 'absolute', width: 26, height: 26 }, style, { pointerEvents: 'none' }]}>
      <Svg width={26} height={26} viewBox="0 0 26 26">
        <Path d="M1 18 L1 1 L18 1" stroke={GOLD} strokeOpacity={0.7} strokeWidth={1.2} fill="none" />
        <Path d="M5 13 Q5 5 13 5" stroke={GOLD} strokeOpacity={0.45} strokeWidth={1} fill="none" />
        <Circle cx={5} cy={5} r={1.6} fill={GOLD} fillOpacity={0.8} />
      </Svg>
    </View>
  );
}

function PaperGrain() {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="pg-glow" cx="0.5" cy="0" r="0.7">
            <Stop offset="0" stopColor="#FFD9A8" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#FFD9A8" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="pg-edge" cx="0.5" cy="0.5" r="0.72">
            <Stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#pg-glow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#pg-edge)" />
      </Svg>
    </View>
  );
}

/** Mühür mumu (sözleşmenin başında) */
function WaxSeal() {
  return (
    <View style={{ width: 44, height: 44, marginBottom: 4, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, pointerEvents: 'none' }}>
      <Svg width={44} height={44} viewBox="0 0 44 44" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="ws" cx="0.38" cy="0.32" r="0.75">
            <Stop offset="0" stopColor="#D2465F" />
            <Stop offset="0.6" stopColor="#8E1830" />
            <Stop offset="1" stopColor="#4E0A19" />
          </RadialGradient>
        </Defs>
        <Path d="M22 1.5 C27 2 29 4 33 5 C37 7 39 10 41 14 C43 19 42 23 42.5 27 C41 32 38 35 35 38 C31 41 27 42.5 22 42.5 C17 42 13 41 9.5 38 C6 35 3 32 2 27 C1.5 22 1.5 18 3.5 14 C5.5 10 8 7 12 5 C15 3 18 1.8 22 1.5 Z" fill="url(#ws)" />
        <Circle cx={22} cy={22} r={13.5} fill="none" stroke="#2E0610" strokeOpacity={0.55} strokeWidth={1.4} />
        <Circle cx={22} cy={22} r={12} fill="none" stroke="#FF9AAE" strokeOpacity={0.25} strokeWidth={0.8} />
      </Svg>
      <Text allowFontScaling={false} style={{ fontFamily: fonts.serifItalic, fontSize: 20, lineHeight: 24, color: 'rgba(255,214,222,.8)' }}>
        N
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Oyuncular + yuva göstergesi
// ─────────────────────────────────────────────────────────────
function Duel({ me, partner, turn, userId, round, confessions }: { me: Player; partner: Player; turn: string | null; userId: string; round: number; confessions: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Seat p={me} label="Sen" active={turn === userId} />
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.6, color: colors.mute }}>{`TUR ${round + 1}`}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.blush }}>{`${confessions} itiraf`}</Text>
      </View>
      <Seat p={partner} label={partner.name} active={!!turn && turn !== userId} right />
    </View>
  );
}

function Seat({ p, label, active, right }: { p: Player; label: string; active: boolean; right?: boolean }) {
  const reduced = useReducedMotion();
  const [glow] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    Animated.timing(glow, { toValue: active ? 1 : 0, duration: reduced ? 0 : 300, useNativeDriver: true }).start();
  }, [active, glow, reduced]);
  return (
    <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
      <View>
        <Animated.View style={{ position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 30, borderWidth: 2, borderColor: GOLD, opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }} />
        <Avatar name={p.name} color={p.color} size={40} />
      </View>
      <View style={{ alignItems: right ? 'flex-end' : 'flex-start', flexShrink: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.pearl, maxWidth: 110 }}>{label}</Text>
        <Animated.Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.4, color: GOLD, opacity: glow }}>SIRA</Animated.Text>
      </View>
    </View>
  );
}

function Chambers({ chamber, fired, loading }: { chamber: number; fired: number | null; loading: boolean }) {
  return (
    <View accessibilityLabel={`Çekilen tetik: ${chamber}, kalan yuva: ${Math.max(0, 6 - chamber)}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const isFired = fired === i;
        const used = i < chamber && !isFired;
        const next = i === chamber && !loading && fired == null;
        return (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 1.5,
              borderColor: isFired ? '#FF5A6E' : used ? 'rgba(255,230,240,.18)' : next ? GOLD : 'rgba(212,175,110,.45)',
              backgroundColor: isFired ? '#E0243F' : used ? 'rgba(255,230,240,.08)' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: next ? 1.15 : 1 }],
            }}
          >
            {used ? <View style={{ width: 6, height: 1.5, backgroundColor: colors.faint, transform: [{ rotate: '45deg' }] }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Tetik (basılı tut)
// ─────────────────────────────────────────────────────────────
function HoldTrigger({ hold, disabled, reduced, onStart, onCancel, onFire }: { hold: Animated.Value; disabled: boolean; reduced: boolean; onStart: () => void; onCancel: () => void; onFire: () => void }) {
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const [pressed, setPressed] = useState(false);
  const ticks = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTicks = () => {
    ticks.current.forEach(clearTimeout);
    ticks.current = [];
  };
  useEffect(() => clearTicks, []);

  const start = () => {
    if (disabled) return;
    setPressed(true);
    onStart();
    [0.3, 0.55, 0.8].forEach((p) => ticks.current.push(setTimeout(haptic.tap, HOLD_MS * p)));
    anim.current = Animated.timing(hold, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: true });
    anim.current.start(({ finished }) => {
      if (finished) {
        anim.current = null;
        haptic.heavy();
        onFire();
      }
    });
  };
  const end = () => {
    setPressed(false);
    clearTicks();
    if (anim.current) {
      anim.current.stop();
      anim.current = null;
      Animated.timing(hold, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      onCancel();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tetiği çek"
      accessibilityHint="Tetiği çekmek için basılı tut"
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate', label: 'Tetiği çek' }]}
      onAccessibilityAction={() => {
        if (!disabled) {
          haptic.heavy();
          onFire();
        }
      }}
      disabled={disabled}
      onPressIn={start}
      onPressOut={end}
      style={{ height: 64, borderRadius: 999, overflow: 'hidden', borderWidth: 1.5, borderColor: pressed ? '#FF7A8C' : GOLD, opacity: disabled ? 0.6 : 1, transform: [{ scale: pressed && !reduced ? 0.985 : 1 }] }}
    >
      <LinearGradient colors={['#3A3D44', '#1D1F24', '#121316']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: 'left', transform: [{ scaleX: hold }] }]}>
        <LinearGradient colors={['#8E1830', '#D93A55', '#FF6A7E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={{ position: 'absolute', left: 1, right: 1, top: 1, height: 22, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: 'rgba(255,255,255,.06)' }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Icon name="gps_fixed" size={22} color={colors.pearl} />
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.pearl, letterSpacing: 0.3 }}>
          {pressed ? 'Bırakma…' : 'Basılı tut · tetiği çek'}
        </Text>
      </View>
    </Pressable>
  );
}


// ─────────────────────────────────────────────────────────────
// İtiraf
// ─────────────────────────────────────────────────────────────
function Confess({ g, top, bg, overlay, loser, prompt, nameOf }: { g: EngineProps['g']; top: React.ReactNode; bg: React.ReactNode; overlay: React.ReactNode; loser: string | null; prompt: string | null; nameOf: (id: string | null | undefined) => string }) {
  const { s: sz } = useCompact();
  const mine = loser === g.userId;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [v] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }).start();
  }, [v]);

  const done = async () => {
    if (sending) return;
    setSending(true);
    haptic.success();
    await g.rpc('roulette_confessed', { p_text: text.trim() });
    setSending(false);
  };

  const promptText = prompt || 'Bir itirafta bulun. Ne istersen — ama dürüst olsun.';
  const footer = mine ? (
    <Button title="İtiraf ettim" icon="record_voice_over" loading={sending} onPress={done} glow />
  ) : (
    <View style={{ flexDirection: 'row' }}>
      <ResultPill text={`${nameOf(loser)} itiraf ediyor…`} tone="wait" />
    </View>
  );

  return (
    <GameLayout bg={bg} overlay={overlay} top={top} footer={footer} keyboard>
      <Animated.View style={{ alignItems: 'center', gap: 8, opacity: v, transform: [{ scale: reduced ? 1 : v.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] }) }] }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(224,36,63,.18)', borderWidth: 1, borderColor: 'rgba(255,90,110,.5)' }}>
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 2.4, color: '#FF8A9A' }}>BANG · İTİRAF ZAMANI</Text>
        </View>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: sz(40, 34), lineHeight: sz(44, 38), color: colors.pearl, textAlign: 'center' }}>
          {mine ? 'Mermi sende patladı 💥' : `${nameOf(loser)} itiraf ediyor…`}
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.mist, textAlign: 'center' }}>
          {mine ? 'Sözleşmeyi imzaladın: şimdi dürüstlük zamanı.' : 'Dinle, sözünü kesme, yargılama. Sözleşme ikiniz için de geçerli.'}
        </Text>
      </Animated.View>

      <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,120,140,.3)', padding: sz(20, 16), gap: 10 }}>
        <LinearGradient colors={['#5A1426', '#2A0C16', '#170A0F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="local_fire_department" size={16} color="#FF8A9A" />
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, color: '#FF8A9A' }}>İTİRAF SORUSU</Text>
        </View>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serif, fontSize: sz(27, 23), lineHeight: sz(31, 27), color: colors.pearl }}>
          {promptText}
        </Text>
      </View>

      {mine ? (
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder="İtirafını yaz (isteğe bağlı, sesli de söyleyebilirsin)"
          placeholderTextColor={colors.faint}
          accessibilityLabel="İtirafın"
          style={{ minHeight: 96, maxHeight: 180, borderRadius: 18, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: 'rgba(12,8,11,.6)', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.pearl, textAlignVertical: 'top' }}
        />
      ) : (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <MicPulse />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.mist, textAlign: 'center' }}>{`${possessive(nameOf(loser))} itirafı bitince yeni tur başlar.`}</Text>
        </View>
      )}
    </GameLayout>
  );
}

function MicPulse() {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, reduced]);
  return (
    <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#FF8A9A', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.5] }) }] }} />
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(224,36,63,.2)', borderWidth: 1, borderColor: 'rgba(255,138,154,.5)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="mic" size={26} color="#FF8A9A" />
      </View>
    </View>
  );
}

/** Partner itirafını yaptı: kısa süreli kart */
function ConfessionReveal({ c, name, onClose }: { c: Confession; name: string; onClose: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: v, backgroundColor: 'rgba(8,4,6,.82)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 30 }]}>
      <Animated.View style={{ width: '100%', maxWidth: 440, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: GOLD_SOFT, padding: 22, gap: 12, transform: [{ scale: reduced ? 1 : v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
        <LinearGradient colors={['#2A181E', '#1A0F13']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.8, color: GOLD }}>{`${possessive(name).toLocaleUpperCase('tr-TR')} İTİRAFI`}</Text>
        {c.prompt ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.mist }}>{c.prompt}</Text> : null}
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.serifItalic, fontSize: 26, lineHeight: 31, color: colors.pearl }}>
          {c.text ? `“${c.text}”` : 'Sesli itiraf etti 🎙️'}
        </Text>
        <Button title="Dinledim ♡" kind="light" onPress={onClose} style={{ marginTop: 6 }} />
      </Animated.View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Efekt katmanları
// ─────────────────────────────────────────────────────────────
function MuzzleFlash() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="mf" cx={width / 2} cy={height * 0.36} r={Math.max(width, height) * 0.75} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="0.12" stopColor="#FFF3C4" stopOpacity="0.95" />
          <Stop offset="0.35" stopColor="#FFB14A" stopOpacity="0.7" />
          <Stop offset="0.7" stopColor="#E0402A" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#E0402A" stopOpacity="0.15" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#mf)" />
    </Svg>
  );
}

function DangerVignette() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="dv" cx="0.5" cy="0.45" r="0.72">
          <Stop offset="0.3" stopColor="#B0102A" stopOpacity="0" />
          <Stop offset="0.75" stopColor="#8E0C22" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#5E0716" stopOpacity="0.7" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#dv)" />
    </Svg>
  );
}
