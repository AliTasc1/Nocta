import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottleArrive } from '@/components/letters/BottleArrive';
import { letterText, PaperSurface } from '@/components/letters/Paper';
import { Button, EmptyState, GlowBackground, Header, Icon, Loading, Pill, Screen, T } from '@/components/ui';
import { ablative, fetchLetter, markLetterRead, paperDate, PAPERS, previewOf, statusOf, whenLabel, type Letter } from '@/lib/letters';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { colors, fonts, radius } from '@/theme';

export default function ReadLetterScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = String(rawId ?? '');
  const { userId, profile, partner } = useApp();
  const [letter, setLetter] = useState<Letter | null>(null);
  const [orig, setOrig] = useState<Letter | null>(null);
  const [replies, setReplies] = useState<Letter[]>([]);
  const [state, setState] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [arriving, setArriving] = useState(false);
  const [showOrig, setShowOrig] = useState(false);
  const marked = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    const l = await fetchLetter(id);
    if (!l) {
      setState('missing');
      return;
    }
    setLetter(l);
    setState('ready');
    // İlk açılış: gelen ve okunmamış → şişe kıyıya vurur
    if (l.recipient_id === userId && !l.read_at && !marked.current) {
      marked.current = true;
      setArriving(true);
      markLetterRead(l.id).catch(() => {});
    }
    const [o, r] = await Promise.all([
      l.reply_to ? fetchLetter(l.reply_to) : Promise.resolve(null),
      supabase.from('letters').select('*').eq('reply_to', l.id).order('created_at', { ascending: true }),
    ]);
    setOrig(o);
    setReplies(((r.data as Letter[]) ?? []).filter(Boolean));
  }, [id, userId]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/letters'));

  if (state === 'loading') return <Loading />;
  if (state === 'missing' || !letter) {
    return (
      <Screen bg={<GlowBackground />}>
        <Header onBack={back} label="MEKTUP" />
        <EmptyState icon="sailing" tone="mute" title="Bu şişe bulunamadı" desc="Mektup geri çekilmiş ya da henüz kıyına ulaşmamış olabilir." action="Mektuplara dön" onAction={() => router.replace('/letters')} />
      </Screen>
    );
  }

  const mine = letter.sender_id === userId;
  const partnerName = partner?.display_name || 'Partnerin';
  const myName = profile?.display_name || '';
  const senderName = mine ? myName : partnerName;
  const recipientName = mine ? partnerName : myName;
  const st = statusOf(letter);
  const P = PAPERS[letter.paper] ?? PAPERS.cream;
  const dateIso = letter.delivered_at ?? letter.deliver_at ?? letter.created_at;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <Screen
        bg={<GlowBackground />}
        contentStyle={{ gap: 14 }}
        footer={
          !mine ? (
            <Button title="Cevap yaz" icon="reply" onPress={() => router.push({ pathname: '/letters/new', params: { replyTo: letter.id } })} glow />
          ) : null
        }
      >
        <Header onBack={back} label={mine ? 'GİDEN MEKTUP' : 'GELEN MEKTUP'} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -8, flexWrap: 'wrap' }}>
          <T v="caption" style={{ flexShrink: 1 }}>{mine ? `${partnerName} için · ${whenLabel(letter.created_at)} yazıldı` : `${ablative(partnerName)} · ${whenLabel(dateIso)}`}</T>
          {mine ? st === 'sea' ? <Pill text={`DENİZDE · ${whenLabel(letter.deliver_at).toLocaleUpperCase('tr-TR')} ULAŞACAK`} tone="pro" /> : st === 'arrived' ? <Pill text="ULAŞTI" tone="rose" /> : <Pill text="OKUNDU ✓" tone="ok" /> : null}
        </View>

        {orig ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showOrig }}
            onPress={() => setShowOrig((s) => !s)}
            style={({ pressed }) => ({ borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.whiteFaint, padding: 12, gap: 8, opacity: pressed ? 0.8 : 1 })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="subdirectory_arrow_right" size={18} color={colors.blush} />
              <T v="caption" style={{ flex: 1 }} numberOfLines={1}>
                {`${orig.sender_id === userId ? 'Senin' : `${partnerName} ·`} ${paperDate(orig.delivered_at ?? orig.created_at)} mektubuna cevap`}
              </T>
              <Icon name={showOrig ? 'expand_less' : 'expand_more'} size={20} color={colors.mist} />
            </View>
            <Text numberOfLines={showOrig ? undefined : 1} style={{ fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 22, color: colors.pearlSoft }}>
              {showOrig ? orig.body : previewOf(orig.body, 80)}
            </Text>
          </Pressable>
        ) : null}

        <PaperSurface paper={letter.paper} seed={letter.id.charCodeAt(0)} minHeight={360}>
          <Text style={[letterText(letter.paper, 17), { textAlign: 'right', color: P.inkSoft }]}>{paperDate(dateIso)}</Text>
          <Text style={letterText(letter.paper)}>{`Sevgili ${recipientName || 'sevgilim'},`}</Text>
          <Text selectable style={letterText(letter.paper)}>{letter.body}</Text>
          {senderName ? <Text style={[letterText(letter.paper), { textAlign: 'right', marginTop: 30 }]}>{`— ${senderName}`}</Text> : null}
        </PaperSurface>

        {replies.length ? (
          <View style={{ gap: 8, marginTop: 6 }}>
            <T v="label">CEVAPLAR</T>
            {replies.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                onPress={() => router.push(`/letters/${r.id}`)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, opacity: pressed ? 0.8 : 1 })}
              >
                <Icon name="mail" size={18} color={colors.blush} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.serifItalic, fontSize: 16, color: colors.pearl }}>
                    {r.sender_id !== userId && !r.read_at ? 'Mühürlü bir mektup' : previewOf(r.body, 60)}
                  </Text>
                  <T v="caption">{`${r.sender_id === userId ? 'Sen' : partnerName} · ${statusOf(r) === 'sea' ? `denizde, ${whenLabel(r.deliver_at)} ulaşacak` : whenLabel(r.delivered_at ?? r.created_at)}`}</T>
                </View>
                <Icon name="chevron_right" size={20} color={colors.mute} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </Screen>

      {arriving ? <BottleArrive paper={letter.paper} fromName={partnerName} salutation={`Sevgili ${recipientName || 'sevgilim'},`} body={letter.body} onDone={() => setArriving(false)} /> : null}
    </View>
  );
}
