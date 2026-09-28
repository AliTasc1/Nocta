import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Icon } from '@/components/ui';
import { play, preloadSfx, stop } from '@/lib/sfx';
import { colors, fonts } from '@/theme';
import { Burst, CONFETTI } from './Burst';
import { GameLayout, GameTopBar, haptic, ResultPill, SoundToggle, TypingDots, useCompact, useReducedMotion, type Player } from './shared';
import { GLASS_R, GLASS_RING, GLASS_VB, GlassArt, glassAngle, isRed, MiniGlass, pocketAngle, polar, ShotsTray, TRAY, type TrayAnims } from './ShotsTray';
import { GoldButton, TableBackdrop } from './tableKit';
import type { EngineProps } from './useGameSession';

type Spin = { by: string; range_start: number; result: number; color: 'red' | 'black'; saved: boolean; drinker: string | null };
type Last = (Spin & { at: number }) | null;

const GOLD = '#F2C27B';
const RED = '#E3223F';
const mod = (x: number, m: number) => ((x % m) + m) % m;
/** Top cebe düştüğü an (çevirmeden itibaren) */
const LAND_MS = 7600;
/** Çark, top düştükten sonra da bir süre dönmeye devam eder */
const SPIN_MS = 8800;
/** Topun cebe "zıplayarak" oturma süresi (LAND_MS'ten önce başlar) */
const DROP_MS = 900;
const REVEAL_MS = LAND_MS + 350;
/** Gerilim müziği top belirgin biçimde yavaşlamaya başlayınca girer ve düşüşte kesilir */
const TENSION_AT = LAND_MS - DROP_MS - 4000;
/** Top yörüngesinin üstel yavaşlama sabiti (generate_sfx.py → SPIN_K ile aynı) */
const SPIN_K = 2.6;
const spinCurve = (x: number) => (1 - Math.exp(-SPIN_K * x)) / SPIN_K - x * Math.exp(-SPIN_K);
const SPIN_NORM = spinCurve(1);
/**
 * Topun göreli açısı için üstel yavaşlama: hızlı başlar, son 3–4 sn'de gözle görülür biçimde
 * yavaşlar ve hızı tam sonda sıfıra iner (sert durma yok). Uç noktalar kesin: 0 → 0, 1 → 1.
 */
const spinEase = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : spinCurve(x) / SPIN_NORM);

/**
 * 19 · Shot Ruleti
 * Kurallar kabul edilir → sırayla 4 sayılık aralık seçilir, rulet çevrilir (sonuç sunucuda).
 * Top aralıktaysa kurtulursun; değilse topun rengindeki oyuncu içer (tek = kırmızı, çift = siyah).
 * Çark/top animasyonu spin_nonce değişince iki telefonda da oynar ve top tam sonucun cebine düşer.
 */
export function Shots({ g, onClose }: EngineProps) {
  const session = g.session!;
  const st = session.state ?? {};
  const phase: string = st.phase ?? 'agreement';

  useEffect(() => {
    preloadSfx(['roulette_spin', 'ball_drop', 'glass_clink', 'saved_chime', 'tension']);
  }, []);

  const top = (
    <GameTopBar
      onClose={onClose}
      center={
        <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(14,10,12,.85)', borderWidth: 1, borderColor: 'rgba(242,194,123,.35)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="local_bar" size={14} color={GOLD} />
          <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: GOLD }}>
            SHOT RULETİ
          </Text>
        </View>
      }
      right={<SoundToggle />}
    />
  );
  const bg = <TableBackdrop felt={['#0C0A0C', '#1C1016', '#070506']} light="#FFD9A0" lightStrength={0.17} lightY={0.42} />;

  if (phase === 'agreement') return <Agreement g={g} top={top} bg={bg} />;
  return <Table g={g} top={top} bg={bg} />;
}

// ─────────────────────────────────────────────────────────────
// Masa
// ─────────────────────────────────────────────────────────────
function Table({ g, top, bg }: { g: EngineProps['g']; top: React.ReactNode; bg: React.ReactNode }) {
  const session = g.session!;
  const st = session.state ?? {};
  const reduced = useReducedMotion();
  const { s: sz, compact } = useCompact();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const spins: Spin[] = Array.isArray(st.spins) ? st.spins : [];
  const last: Last = st.last ?? null;
  const nonce = Number(st.spin_nonce ?? 0);
  const turn: string | null = st.turn ?? null;
  const redId: string = st.red ?? session.created_by;
  const nameOf = (id: string | null | undefined) => (id === g.userId ? g.me.name : g.partner.name);
  const iAmRed = redId === g.userId;

  // ── Animasyon durumu ─────────────────────────────────────
  const [a] = useState<TrayAnims>(() => ({
    wheel: new Animated.Value(0),
    rel: new Animated.Value(last ? pocketAngle(last.result) : 0),
    drop: new Animated.Value(last ? 1 : 0),
  }));
  const [hero] = useState(() => ({
    lift: new Animated.Value(last ? 0.3 : 0),
    tilt: new Animated.Value(0),
    drain: new Animated.Value(last && !last.saved ? 0 : 1),
    glow: new Animated.Value(last ? 1 : 0),
    cheers: new Animated.Value(0),
  }));
  const wheelRef = useRef(0);
  const relRef = useRef(last ? pocketAngle(last.result) : 0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      stop('tension');
    };
  }, []);

  /** Ekranda gösterilen sonuç (animasyon bitene kadar bir öncekini gösterir → sürpriz bozulmaz) */
  const [shown, setShown] = useState<Last>(last);
  const [spinning, setSpinning] = useState(false);
  const [burst, setBurst] = useState<number | null>(null);

  const seenNonce = useRef(nonce);
  useEffect(() => {
    if (nonce <= seenNonce.current || !last) return;
    seenNonce.current = nonce;
    const res = last;
    const k = reduced ? 0.25 : 1;
    setSpinning(true);
    setShown(null);
    setBurst(null);
    hero.glow.setValue(0);
    hero.lift.setValue(0);
    hero.tilt.setValue(0);
    hero.drain.setValue(1);
    hero.cheers.setValue(0);
    a.wheel.stopAnimation();
    a.rel.stopAnimation();

    const W1 = wheelRef.current + (reduced ? 120 : 360 * 3 + 60 + Math.random() * 200);
    wheelRef.current = W1;
    const base = relRef.current - (reduced ? 360 : 360 * 8);
    const Rf = base - mod(base - pocketAngle(res.result), 360);
    relRef.current = Rf;

    const dropAt = (LAND_MS - DROP_MS) * k;
    play('roulette_spin');
    haptic.light();
    Animated.parallel([
      Animated.timing(a.wheel, { toValue: W1, duration: SPIN_MS * k, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(a.rel, { toValue: Rf, duration: LAND_MS * k, easing: spinEase, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(a.drop, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.delay(Math.max(0, dropAt - 220)),
        Animated.timing(a.drop, { toValue: 1, duration: DROP_MS * k, easing: Easing.bounce, useNativeDriver: true }),
      ]),
    ]).start();
    // Gerilim: iki telefonda da aynı nonce'tan tetiklenir → senkron başlar, düşüşte kesilir
    if (!reduced) later(TENSION_AT, () => play('tension', { volume: 0.75 }));
    later(dropAt, () => {
      stop('tension');
      play('ball_drop');
      haptic.light();
    });
    if (!reduced) {
      // yavaşlarken seyrelen tıkırtı titreşimleri
      [2400, 3300, 4100, 4800, 5400, 5900, 6300].forEach((t) => later(t, haptic.tap));
      [LAND_MS - 700, LAND_MS - 480, LAND_MS - 300, LAND_MS - 120].forEach((t) => later(t, haptic.tap));
    }

    later(REVEAL_MS * k, () => {
      setShown(res);
      setSpinning(false);
      Animated.timing(hero.glow, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      if (res.saved) {
        play('saved_chime');
        haptic.success();
        setBurst(Date.now());
        Animated.spring(hero.lift, { toValue: 0.3, friction: 5, tension: 90, useNativeDriver: true }).start();
      } else {
        haptic.heavy();
        later(200, () => play('glass_clink'));
        const r = reduced;
        Animated.sequence([
          Animated.spring(hero.lift, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(hero.tilt, { toValue: 1, duration: r ? 1 : 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(hero.drain, { toValue: 0, duration: r ? 1 : 620, delay: r ? 0 : 120, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(hero.tilt, { toValue: 0, duration: r ? 1 : 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.spring(hero.lift, { toValue: 0.3, friction: 6, tension: 80, useNativeDriver: true }),
          ]),
        ]).start();
        later(r ? 100 : 1250, () => {
          haptic.success();
          hero.cheers.setValue(0);
          Animated.sequence([
            Animated.spring(hero.cheers, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
            Animated.delay(1300),
            Animated.timing(hero.cheers, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start();
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // ── Aralık seçimi (canlı yayın) ─────────────────────────
  const myTurn = !!turn && turn === g.userId && !spinning;
  const [range, setRange] = useState(1);
  const [partnerRange, setPartnerRange] = useState<number | null>(null);
  const { on, send } = g;
  useEffect(() => on('sh_range', (p) => typeof p.s === 'number' && setPartnerRange(Math.max(1, Math.min(13, p.s)))), [on]);
  const pick = (s: number) => {
    const v = Math.max(1, Math.min(13, s));
    if (v === range) return;
    haptic.tap();
    setRange(v);
    send('sh_range', { s: v });
  };
  const [dragging, setDragging] = useState(false);
  const [acting, setActing] = useState(false);
  const spin = async () => {
    if (acting || !myTurn) return;
    setActing(true);
    haptic.heavy();
    await g.rpc('shots_spin', { p_range_start: range });
    setActing(false);
  };

  // ── Ölçüler ──────────────────────────────────────────────
  const contentW = Math.min(width - insets.left - insets.right - 40, 520);
  const maxByH = height - insets.top - insets.bottom - (compact ? 380 : 430);
  const trayW = Math.round(Math.max(230, Math.min(width - insets.left - insets.right - 12, 440, maxByH)));
  const k = trayW / TRAY;

  // Skor: animasyon sürerken son atış sayılmaz (sonuç önceden belli olmasın)
  const counted = spinning ? spins.slice(0, -1) : spins;
  const drinks = (id: string) => counted.filter((s) => s.drinker === id).length;

  const displayTurn = spinning ? null : turn;
  const rangeShown = spinning ? last?.range_start ?? null : myTurn ? range : partnerRange ?? shown?.range_start ?? null;
  // Mor ton yalnızca partnerin canlı seçimi için; oynanan aralık altın kalır
  const rangeTone: 'gold' | 'dim' = spinning || myTurn || partnerRange == null ? 'gold' : 'dim';

  const footer = myTurn ? (
    <GoldButton title="Ruleti çevir" icon="casino" loading={acting} onPress={spin} />
  ) : (
    <View style={{ flexDirection: 'row' }}>
      <ResultPill text={spinning ? 'Top dönüyor…' : `${g.partner.name} aralık seçiyor…`} tone="wait" />
    </View>
  );

  return (
    <GameLayout bg={bg} top={top} footer={footer} scrollEnabled={!dragging}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <ScoreSeat p={g.me} label="Sen" red={iAmRed} drinks={drinks(g.userId)} active={displayTurn === g.userId} />
        <ScoreSeat p={g.partner} label={g.partner.name} red={!iAmRed} drinks={drinks(g.partnerId ?? '')} active={!!displayTurn && displayTurn !== g.userId} right />
      </View>

      <View style={{ alignSelf: 'center', width: trayW, height: trayW, marginVertical: -sz(4, 6) }}>
        <ShotsTray size={trayW} a={a} range={rangeShown} rangeTone={rangeTone}>
          {shown ? <HeroGlass key={`${nonce}-${shown.result}`} n={shown.result} k={k} h={hero} saved={shown.saved} /> : null}
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: trayW / 2 - 30, alignItems: 'center', opacity: hero.cheers, transform: [{ scale: hero.cheers.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], pointerEvents: 'none' }}>
            <View style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(10,6,8,.82)', borderWidth: 1, borderColor: 'rgba(242,194,123,.6)' }}>
              <Text allowFontScaling={false} style={{ fontFamily: fonts.serifItalic, fontSize: Math.round(30 * Math.max(0.8, k * 1.1)), color: GOLD }}>
                Şerefe! 🥂
              </Text>
            </View>
          </Animated.View>
          <Burst play={burst} emojis={CONFETTI} count={26} distance={trayW * 0.45} size={20} />
        </ShotsTray>
      </View>

      <Outcome shown={shown} spinning={spinning} spinner={last ? nameOf(last.by) : ''} spinRange={last?.range_start ?? null} nameOf={nameOf} userId={g.userId} />

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 20 }}>
          {!myTurn && !spinning ? <TypingDots color={GOLD} /> : null}
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.mono, fontSize: 11, letterSpacing: compact ? 1 : 1.4, color: myTurn ? GOLD : colors.mist }}>
            {spinning ? 'TOP DÖNÜYOR…' : myTurn ? 'SIRA SENDE — ARALIĞINI SEÇ' : `${g.partner.name.toLocaleUpperCase('tr-TR')} ARALIK SEÇİYOR…`}
          </Text>
          {compact && rangeShown != null ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.pearl }}>{`· ${rangeShown}–${rangeShown + 3} · %25`}</Text>
          ) : null}
        </View>
        <RangeTrack width={contentW} value={myTurn ? range : rangeShown} disabled={!myTurn} onPick={pick} onDrag={setDragging} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, display: compact ? 'none' : 'flex' }}>
          <StepButton icon="chevron_left" label="Aralığı sola kaydır" disabled={!myTurn || range <= 1} onPress={() => pick(range - 1)} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 24, lineHeight: 28, color: colors.pearl }}>
              {rangeShown != null ? `${rangeShown} – ${rangeShown + 3}` : '— – —'}
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: GOLD }}>Kurtulma şansı %25</Text>
          </View>
          <StepButton icon="chevron_right" label="Aralığı sağa kaydır" disabled={!myTurn || range >= 13} onPress={() => pick(range + 1)} />
        </View>
      </View>
    </GameLayout>
  );
}

/** Sonuç bardağı: parlar, kalkar; içilirse eğilip boşalır */
function HeroGlass({ n, k, h, saved }: { n: number; k: number; h: { lift: Animated.Value; tilt: Animated.Value; drain: Animated.Value; glow: Animated.Value }; saved: boolean }) {
  const [x, y] = polar(GLASS_RING, glassAngle(n));
  const size = GLASS_VB * k;
  const cx = x * k;
  const cy = y * k;
  // Tepsi merkezine doğru biraz kayar (kenardan taşmasın)
  const dx = (TRAY / 2 - x) * k * 0.32;
  const dy = (TRAY / 2 - y) * k * 0.32;
  const glowCol = saved ? GOLD : isRed(n) ? '#FF4D66' : '#C9B8F7';
  const slot = (GLASS_R + 3.5) * 2 * k;
  return (
    <>
    {/* bardak kalkınca tepside boş yuvası görünür */}
    <View style={{ position: 'absolute', left: cx - slot / 2, top: cy - slot / 2, width: slot, height: slot, borderRadius: slot / 2, backgroundColor: '#050506', borderWidth: 1, borderColor: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
    <Animated.View
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        zIndex: 5,
        transform: [
          { translateX: h.lift.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: h.lift.interpolate({ inputRange: [0, 1], outputRange: [0, dy - 6 * k] }) },
          { scale: h.lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) },
          { rotate: h.tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-38deg'] }) },
        ],
        pointerEvents: 'none',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: -size * 0.12,
          top: -size * 0.12,
          width: size * 1.24,
          height: size * 1.24,
          borderRadius: size,
          borderWidth: 2.5,
          borderColor: glowCol,
          opacity: h.glow,
          shadowColor: glowCol,
          shadowOpacity: 0.9,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
          backgroundColor: 'rgba(0,0,0,.35)',
        }}
      />
      <View style={StyleSheet.absoluteFill}>
        <GlassArt n={n} size={size} part="body" />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: h.drain.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }), transform: [{ scale: h.drain.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }, { translateX: h.tilt.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.08] }) }] }]}>
        <GlassArt n={n} size={size} part="liquid" />
      </Animated.View>
      <View style={StyleSheet.absoluteFill}>
        <GlassArt n={n} size={size} part="rim" />
      </View>
    </Animated.View>
    </>
  );
}

function Outcome({ shown, spinning, spinner, spinRange, nameOf, userId }: { shown: Last; spinning: boolean; spinner: string; spinRange: number | null; nameOf: (id: string | null | undefined) => string; userId: string }) {
  const { s: sz } = useCompact();
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(1));
  const key = shown ? `${shown.at}` : spinning ? 'spin' : 'none';
  useEffect(() => {
    if (reduced) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [key, v, reduced]);

  let title = '';
  let sub = '';
  if (spinning) {
    title = 'Top dönüyor…';
    sub = `${spinner} çevirdi · aralık ${spinRange ?? '?'}–${(spinRange ?? 0) + 3}`;
  } else if (shown) {
    const col = shown.color === 'red' ? 'kırmızı' : 'siyah';
    if (shown.saved) {
      title = shown.by === userId ? 'Kurtuldun! 🎉' : `${nameOf(shown.by)} kurtuldu! 🎉`;
      sub = `Top ${shown.result} · aralık ${shown.range_start}–${shown.range_start + 3} tuttu`;
    } else {
      title = shown.drinker === userId ? 'Sen içiyorsun 🥃' : `${nameOf(shown.drinker)} içiyor 🥃`;
      sub = `Top ${shown.result} (${col}) · aralık ${shown.range_start}–${shown.range_start + 3} dışında`;
    }
  } else {
    title = 'İlk tur';
    sub = 'Aralığını seç ve ruleti çevir. Tutarsa kurtulursun.';
  }

  return (
    <Animated.View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: shown ? (shown.saved ? GOLD : 'rgba(255,255,255,.7)') : 'rgba(242,194,123,.35)',
          backgroundColor: shown ? (shown.color === 'red' ? RED : '#16151A') : 'rgba(255,255,255,.04)',
          shadowColor: shown?.color === 'red' ? RED : '#000',
          shadowOpacity: shown ? 0.6 : 0,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {shown && !spinning ? (
          <Text allowFontScaling={false} style={{ fontFamily: fonts.extrabold, fontSize: 26, color: '#FFFFFF' }}>
            {shown.result}
          </Text>
        ) : (
          <Icon name={spinning ? 'autorenew' : 'casino'} size={26} color={GOLD} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={{ fontFamily: fonts.serif, fontSize: sz(28, 24), lineHeight: sz(31, 27), color: shown?.saved ? GOLD : colors.pearl }}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.mist }}>
          {sub}
        </Text>
      </View>
    </Animated.View>
  );
}

function ScoreSeat({ p, label, red, drinks, active, right }: { p: Player; label: string; red: boolean; drinks: number; active: boolean; right?: boolean }) {
  const reduced = useReducedMotion();
  const [glow] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    Animated.timing(glow, { toValue: active ? 1 : 0, duration: reduced ? 0 : 300, useNativeDriver: true }).start();
  }, [active, glow, reduced]);
  return (
    <View style={{ flex: 1, borderRadius: 18, padding: 10, flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(14,10,12,.72)', borderWidth: 1, borderColor: 'rgba(255,230,240,.08)' }}>
      <Animated.View style={{ position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: 18, borderWidth: 1.5, borderColor: GOLD, opacity: glow, pointerEvents: 'none' }} />
      <View>
        <Avatar name={p.name} color={p.color} size={36} />
        <View style={{ position: 'absolute', right: -4, bottom: -4 }}>
          <MiniGlass red={red} size={18} />
        </View>
      </View>
      <View style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start' }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.pearl }}>{label}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: red ? '#FF7A8C' : colors.pearlMuted }}>{red ? 'Kırmızı' : 'Siyah'}</Text>
      </View>
      <View accessibilityLabel={`${drinks} shot`} style={{ alignItems: 'center', minWidth: 34 }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 22, color: colors.pearl }}>{drinks}</Text>
        <Text style={{ fontSize: 11 }}>🥃</Text>
      </View>
    </View>
  );
}

/** 16 hücreli şerit; 4 hücrelik altın pencere sürüklenerek/dokunarak taşınır */
function RangeTrack({ width, value, disabled, onPick, onDrag }: { width: number; value: number | null; disabled: boolean; onPick: (s: number) => void; onDrag: (on: boolean) => void }) {
  const cell = width / 16;
  const reduced = useReducedMotion();
  const [x] = useState(() => new Animated.Value(((value ?? 1) - 1) * cell));
  useEffect(() => {
    if (value == null) return;
    Animated.spring(x, { toValue: (value - 1) * cell, friction: 8, tension: reduced ? 400 : 160, useNativeDriver: true }).start();
  }, [value, cell, x, reduced]);
  const cb = useRef({ onPick, onDrag, disabled, cell });
  useEffect(() => {
    cb.current = { onPick, onDrag, disabled, cell };
  });
  const at = (e: GestureResponderEvent) => Math.round(e.nativeEvent.locationX / cb.current.cell - 2) + 1;
  // Dokunma işleyicileri ref'leri yalnızca olay anında okur (render sırasında değil)
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !cb.current.disabled,
      onStartShouldSetPanResponderCapture: () => !cb.current.disabled,
      onMoveShouldSetPanResponder: () => !cb.current.disabled,
      onMoveShouldSetPanResponderCapture: () => !cb.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        cb.current.onDrag(true);
        cb.current.onPick(at(e));
      },
      onPanResponderMove: (e) => cb.current.onPick(at(e)),
      onPanResponderRelease: () => cb.current.onDrag(false),
      onPanResponderTerminate: () => cb.current.onDrag(false),
    }),
  );
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Sayı aralığı"
      accessibilityValue={{ text: value != null ? `${value} ile ${value + 3} arası` : 'seçilmedi' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (disabled || value == null) return;
        onPick(e.nativeEvent.actionName === 'increment' ? value + 1 : value - 1);
      }}
      style={{ width, height: 48, alignSelf: 'center', opacity: disabled ? 0.55 : 1 }}
    >
      <View style={{ flexDirection: 'row', height: 48, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,.1)', pointerEvents: 'none' }}>
        {Array.from({ length: 16 }).map((_, i) => {
          const n = i + 1;
          const red = isRed(n);
          return (
            <View key={n} style={{ width: cell, height: '100%', alignItems: 'center', justifyContent: 'center', borderRightWidth: i < 15 ? StyleSheet.hairlineWidth : 0, borderColor: 'rgba(255,255,255,.14)' }}>
              <LinearGradient colors={red ? ['#D81F3B', '#7E0A1C'] : ['#2C2A31', '#0E0D10']} style={StyleSheet.absoluteFill} />
              <Text allowFontScaling={false} selectable={false} style={{ fontFamily: fonts.bold, fontSize: cell < 21 ? 11 : 12.5, color: '#FFFFFF' }}>
                {n}
              </Text>
            </View>
          );
        })}
      </View>
      {value != null ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: -4,
            left: 0,
            width: cell * 4,
            height: 56,
            borderRadius: 14,
            borderWidth: 2.5,
            borderColor: disabled ? 'rgba(201,184,247,.8)' : GOLD,
            backgroundColor: 'rgba(242,194,123,.1)',
            shadowColor: GOLD,
            shadowOpacity: disabled ? 0 : 0.7,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
            transform: [{ translateX: x }],
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </View>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: string; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: disabled ? 'rgba(255,255,255,.06)' : 'rgba(242,194,123,.35)', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <Icon name={icon} size={26} color={disabled ? colors.faint : GOLD} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Kurallar / onay
// ─────────────────────────────────────────────────────────────
function Agreement({ g, top, bg }: { g: EngineProps['g']; top: React.ReactNode; bg: React.ReactNode }) {
  const session = g.session!;
  const st = session.state ?? {};
  const { s: sz } = useCompact();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const meOk = !!st[`agree_${g.userId}`];
  const partnerOk = !!(g.partnerId && st[`agree_${g.partnerId}`]);
  const redId: string = st.red ?? session.created_by;
  const iAmRed = redId === g.userId;
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [a] = useState<TrayAnims>(() => ({ wheel: new Animated.Value(0), rel: new Animated.Value(0), drop: new Animated.Value(0) }));

  // Vitrin: çark yavaşça döner, top ters yönde süzülür
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(a.wheel, { toValue: 360, duration: 24000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(a.rel, { toValue: -720, duration: 24000, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a, reduced]);

  const accept = async () => {
    if (!checked || sending) return;
    setSending(true);
    haptic.success();
    await g.rpc('shots_agree');
    setSending(false);
  };

  const trayW = Math.min(width - 40, sz(210, 150));
  const footer = meOk ? (
    <View style={{ flexDirection: 'row' }}>
      <ResultPill text={partnerOk ? 'Masa kuruluyor…' : `${g.partner.name} kuralları okuyor…`} tone="wait" />
    </View>
  ) : (
    <GoldButton title="Kabul et ve otur" icon="local_bar" loading={sending} disabled={!checked} onPress={accept} />
  );

  return (
    <GameLayout bg={bg} top={top} footer={footer}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: trayW, height: trayW }}>
          <ShotsTray size={trayW} a={a} range={null} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: GOLD }}>18+ · İKİ KİŞİLİK MASA</Text>
        <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.serif, fontSize: sz(36, 30), lineHeight: sz(39, 33), color: colors.pearl }}>
          Masaya oturmadan <Text style={{ fontFamily: fonts.serifItalic, color: GOLD }}>önce…</Text>
        </Text>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: colors.pearlSoft }}>
          {"Burada 'içmiyorum' demek yok. Sayını tahmin et, shot'tan kurtul. Kaybedersen rengin konuşur."}
        </Text>
      </View>

      <View style={{ borderRadius: 20, padding: 16, gap: 12, backgroundColor: 'rgba(14,10,12,.78)', borderWidth: 1, borderColor: 'rgba(242,194,123,.2)' }}>
        <Rule icon="tune" text="Sıran gelince 4 sayılık bir aralık seç ve ruleti çevir." />
        <Rule icon="celebration" text="Top aralığına düşerse kurtuldun." />
        <Rule icon="local_bar" text="Düşmezse topun rengi konuşur: kırmızıysa kırmızı, siyahsa siyah içer." />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ColorSeat p={g.me} label="Sen" red={iAmRed} ok={meOk} />
          <ColorSeat p={g.partner} label={g.partner.name} red={!iAmRed} ok={partnerOk} />
        </View>
      </View>

      {!meOk ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => {
            haptic.tap();
            setChecked((c) => !c);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: checked ? 'rgba(242,194,123,.12)' : 'rgba(255,255,255,.04)', borderWidth: 1, borderColor: checked ? 'rgba(242,194,123,.55)' : colors.lineStrong, opacity: pressed ? 0.85 : 1 })}
        >
          <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: checked ? GOLD : colors.mute, backgroundColor: checked ? GOLD : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {checked ? <Icon name="check" size={18} color="#2A1A05" /> : null}
          </View>
          <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.pearl }}>
            Kuralları kabul ediyorum, kaybedersem şikâyet yok 🥃
          </Text>
        </Pressable>
      ) : null}
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.mute, textAlign: 'center' }}>18+ · Shot yerine istediğin bir içecek de olur · Sorumlu iç.</Text>
    </GameLayout>
  );
}

function Rule({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color={GOLD} style={{ marginTop: 1 }} />
      <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.pearlSoft }}>
        {text}
      </Text>
    </View>
  );
}

function ColorSeat({ p, label, red, ok }: { p: Player; label: string; red: boolean; ok: boolean }) {
  return (
    <View accessibilityLabel={`${p.name}: ${red ? 'kırmızı' : 'siyah'}, ${ok ? 'kabul etti' : 'bekleniyor'}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: red ? 'rgba(227,34,63,.12)' : 'rgba(255,255,255,.05)', borderWidth: 1, borderColor: red ? 'rgba(255,90,110,.35)' : 'rgba(255,255,255,.1)' }}>
      <MiniGlass red={red} size={28} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.pearl }}>{label === 'Sen' ? (red ? 'Sen kırmızısın' : 'Sen siyahsın') : `${label} ${red ? 'kırmızı' : 'siyah'}`}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: ok ? colors.success : colors.mute }}>{ok ? 'Kabul etti ✓' : 'Bekleniyor…'}</Text>
      </View>
    </View>
  );
}
