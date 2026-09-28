import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BottleLaunch } from '@/components/letters/BottleLaunch';
import { LINE, letterText, PaperSurface, PaperSwatch } from '@/components/letters/Paper';
import { arrivalCaption, ScheduleSheet } from '@/components/letters/SchedulePicker';
import { Button, GlowBackground, Header, Icon, Screen, T } from '@/components/ui';
import { draftKey, fetchLetter, isPaper, LETTER_MAX, PAPER_KEYS, PAPERS, paperDate, previewOf, sendLetter, type Letter, type Paper } from '@/lib/letters';
import { errorText } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts, radius } from '@/theme';

/** Söylemesi zor olanı başlatmaya yardım eden nazik cümle başları */
const PROMPTS = [
  'Sana hiç söyleyemediğim şey…',
  'Seni ilk gördüğümde…',
  'En çok özlediğim anımız…',
  'Yanımda olduğunu en çok hissettiğim an…',
  'Keşke daha sık söyleseydim:',
  'Özür dilemek istediğim bir şey var…',
  'Bugün seni düşündüm, çünkü…',
  'Seninle yaşlanmayı düşündüğümde…',
  'Birlikte yapmayı hayal ettiğim şey…',
  'Bilmeni istiyorum ki…',
];

export default function NewLetterScreen() {
  const params = useLocalSearchParams<{ replyTo?: string }>();
  const replyTo = typeof params.replyTo === 'string' && params.replyTo ? params.replyTo : null;
  const { partner, profile } = useApp();
  const toast = useToast();
  const input = useRef<TextInput>(null);

  const [paper, setPaper] = useState<Paper>('cream');
  const [body, setBody] = useState('');
  const [sheet, setSheet] = useState(false);
  const [sending, setSending] = useState(false);
  const [launch, setLaunch] = useState<{ at: Date | null; body: string } | null>(null);
  const [orig, setOrig] = useState<Letter | null>(null);
  const [showOrig, setShowOrig] = useState(false);

  const partnerName = partner?.display_name || 'Sevgilim';
  const myName = profile?.display_name || '';
  const salutation = `Sevgili ${partnerName},`;
  const signature = myName ? `— ${myName}` : undefined;
  const key = draftKey(replyTo);

  // Gönderilmemiş taslağı geri yükle
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((v) => {
        if (!v) return;
        const d = JSON.parse(v) as { body?: string; paper?: string };
        if (d.body) setBody((b) => b || d.body || '');
        if (isPaper(d.paper)) setPaper(d.paper);
      })
      .catch(() => {});
  }, [key]);

  // Taslağı sakla (gönderilince silinir)
  const sent = launch != null;
  useEffect(() => {
    if (sent) return;
    const t = setTimeout(() => {
      if (body.trim()) AsyncStorage.setItem(key, JSON.stringify({ body, paper })).catch(() => {});
      else AsyncStorage.removeItem(key).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [body, paper, key, sent]);

  useEffect(() => {
    if (!replyTo) return;
    fetchLetter(replyTo).then((l) => {
      setOrig(l);
      if (l && isPaper(l.paper)) setPaper((p) => (p === 'cream' ? l.paper : p));
    });
  }, [replyTo]);

  const addPrompt = (p: string) => {
    Haptics.selectionAsync().catch(() => {});
    setBody((b) => {
      const trimmed = b.replace(/\s+$/, '');
      const next = trimmed ? `${trimmed}\n\n${p} ` : `${p} `;
      return next.slice(0, LETTER_MAX);
    });
    setTimeout(() => input.current?.focus(), 50);
  };

  const send = async (at: Date | null) => {
    if (sending) return;
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendLetter({ body: text, deliverAt: at, replyTo, paper });
      AsyncStorage.removeItem(key).catch(() => {});
      setSheet(false);
      input.current?.blur();
      setLaunch({ at, body: text });
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/letters'));
  const count = body.length;
  const empty = !body.trim();
  const P = PAPERS[paper];

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <Screen
        keyboard
        bg={<GlowBackground />}
        contentStyle={{ gap: 14 }}
        footer={
          <Button
            title="Gönder"
            iconRight="send"
            disabled={empty}
            onPress={() => {
              input.current?.blur();
              setSheet(true);
            }}
            glow
          />
        }
      >
        <Header onBack={back} label={replyTo ? 'CEVAP MEKTUBU' : 'YENİ MEKTUP'} />
        <T v="bodySm" style={{ marginTop: -10 }}>
          Söyleyemediklerini yaz. Şişeye koyup okyanusa bırakacağız; ne zaman ulaşacağını sen seç.
        </T>

        {replyTo && orig ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showOrig }}
            onPress={() => setShowOrig((s) => !s)}
            style={({ pressed }) => ({ borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.whiteFaint, padding: 12, gap: 8, opacity: pressed ? 0.8 : 1 })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="subdirectory_arrow_right" size={18} color={colors.blush} />
              <T v="caption" style={{ flex: 1 }} numberOfLines={1}>{`${partnerName} · ${paperDate(orig.delivered_at ?? orig.created_at)} mektubuna cevap`}</T>
              <Icon name={showOrig ? 'expand_less' : 'expand_more'} size={20} color={colors.mist} />
            </View>
            <Text numberOfLines={showOrig ? 12 : 1} style={{ fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 22, color: colors.pearlSoft }}>
              {showOrig ? orig.body : previewOf(orig.body, 80)}
            </Text>
          </Pressable>
        ) : null}

        {/* kâğıt seçimi */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T v="label" style={{ marginRight: 2 }}>KÂĞIT</T>
          {PAPER_KEYS.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ checked: paper === k }}
              accessibilityLabel={`${PAPERS[k].name} kâğıt`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPaper(k);
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingRight: 4, opacity: pressed ? 0.75 : 1 })}
            >
              <PaperSwatch paper={k} active={paper === k} size={26} />
              <Text style={{ fontFamily: paper === k ? fonts.bold : fonts.semibold, fontSize: 13, color: paper === k ? colors.pearl : colors.mist }}>{PAPERS[k].name}</Text>
            </Pressable>
          ))}
        </View>

        {/* ilham cümleleri */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {PROMPTS.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={`Cümle başlangıcı ekle: ${p}`}
              onPress={() => addPrompt(p)}
              style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: 'rgba(244,185,200,.08)', borderWidth: 1, borderColor: 'rgba(244,185,200,.22)', opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontFamily: fonts.serifItalic, fontSize: 16, color: colors.blush }}>{p}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* yazı kâğıdı */}
        <PaperSurface paper={paper} minHeight={LINE * 12 + 30} seed={paper.length}>
          <Text style={[letterText(paper, 17), { textAlign: 'right', color: P.inkSoft }]}>{paperDate(new Date())}</Text>
          <Text style={letterText(paper)}>{salutation}</Text>
          <TextInput
            ref={input}
            value={body}
            onChangeText={(t) => setBody(t.slice(0, LETTER_MAX))}
            multiline
            scrollEnabled={false}
            maxLength={LETTER_MAX}
            placeholder="Buraya yaz… ya da yukarıdaki cümlelerden biriyle başla."
            placeholderTextColor={P.inkSoft}
            selectionColor={colors.rose}
            cursorColor={colors.rose}
            accessibilityLabel="Mektup metni"
            textAlignVertical="top"
            maxFontSizeMultiplier={1.2}
            style={[
              letterText(paper),
              // position: web'de textarea statik kalırsa mutlak konumlu kâğıt dokusunun altında boyanır
              { position: 'relative', minHeight: LINE * 7, padding: 0, paddingTop: 0, paddingBottom: 0, margin: 0, includeFontPadding: false },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
          />
          {signature ? <Text style={[letterText(paper), { textAlign: 'right', marginTop: LINE }]}>{signature}</Text> : null}
        </PaperSurface>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T v="caption" color={colors.mute}>Taslağın bu cihazda saklanır.</T>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: count > LETTER_MAX * 0.95 ? colors.warning : colors.mist }}>{`${count.toLocaleString('tr-TR')} / ${LETTER_MAX.toLocaleString('tr-TR')}`}</Text>
        </View>
      </Screen>

      <ScheduleSheet visible={sheet} onClose={() => setSheet(false)} onConfirm={send} sending={sending} partnerName={partnerName} />

      {launch ? (
        <BottleLaunch
          paper={paper}
          body={launch.body}
          salutation={salutation}
          signature={signature}
          arrival={arrivalCaption(launch.at, partnerName)}
          onDone={() => router.dismissTo('/letters')}
        />
      ) : null}
    </View>
  );
}
