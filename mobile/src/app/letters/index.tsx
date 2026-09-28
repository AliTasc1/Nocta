import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useDialog } from '@/components/Dialog';
import { Envelope, WaxSeal } from '@/components/letters/Paper';
import { Button, EmptyState, GlowBackground, Header, Icon, Pill, Screen, SerifTitle, T } from '@/components/ui';
import { relTime } from '@/lib/format';
import { ablative, cancelLetter, previewOf, statusOf, useLetters, whenLabel, type Letter } from '@/lib/letters';
import { errorText } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts, radius } from '@/theme';

type Tab = 'in' | 'out';

export default function MailboxScreen() {
  const { userId, couple, partner } = useApp();
  const { letters, loading, reload, setLetters } = useLetters();
  const { dialog, ask } = useDialog();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('in');
  const [refreshing, setRefreshing] = useState(false);
  const connected = couple?.status === 'active' && !!partner;
  const partnerName = partner?.display_name || 'Partnerin';

  const byId = useMemo(() => new Map(letters.map((l) => [l.id, l])), [letters]);
  const replyCount = useMemo(() => {
    const m = new Map<string, number>();
    letters.forEach((l) => {
      if (l.reply_to) m.set(l.reply_to, (m.get(l.reply_to) ?? 0) + 1);
    });
    return m;
  }, [letters]);
  const incoming = letters.filter((l) => l.recipient_id === userId && l.delivered_at).sort((a, b) => (b.delivered_at ?? '').localeCompare(a.delivered_at ?? ''));
  const outgoing = letters.filter((l) => l.sender_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const unread = incoming.filter((l) => !l.read_at).length;
  const atSea = outgoing.filter((l) => !l.delivered_at).length;
  const list = tab === 'in' ? incoming : outgoing;

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const withdraw = (l: Letter) =>
    ask({
      icon: 'undo',
      title: 'Şişeyi geri çek?',
      desc: `Bu mektup henüz ${partnerName} kıyısına ulaşmadı. Geri çekersen tamamen silinir.`,
      actions: [
        {
          label: 'Geri çek',
          kind: 'danger',
          onPress: async () => {
            try {
              await cancelLetter(l.id);
              setLetters((cur) => cur.filter((x) => x.id !== l.id));
              toast.show('Mektup geri çekildi.', 'ok');
            } catch (e) {
              toast.show(errorText(e), 'error');
              reload();
            }
          },
        },
        { label: 'Vazgeç', kind: 'ghost' },
      ],
    });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/games'));

  return (
    <Screen
      bg={<GlowBackground />}
      refreshing={refreshing}
      onRefresh={connected ? onRefresh : undefined}
      contentStyle={{ gap: 16 }}
      footer={connected ? <Button title="Mektup yaz" icon="edit" onPress={() => router.push('/letters/new')} glow /> : null}
    >
      <Header onBack={back} label="SEVGİLİYE MEKTUP" />
      <View style={{ gap: 8, marginTop: -8 }}>
        <SerifTitle text="Şişedeki" accent="mektuplar" v="h1" />
        <T v="bodySm">Söyleyemediklerini yaz, şişeye koy, denize bırak. İster hemen, ister ileri bir tarihte ulaşsın.</T>
      </View>

      {!connected ? (
        <EmptyState icon="link_off" tone="iris" title="Önce partnerine bağlan" desc="Mektuplar yalnızca partnerinle arandaki okyanusu aşar. Bağlandığınızda ilk şişeyi denize bırakabilirsin." action="Partnerini davet et" onAction={() => router.push('/invite')} />
      ) : (
        <>
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line }}>
            {(
              [
                ['in', 'Gelen', unread],
                ['out', 'Giden', atSea],
              ] as const
            ).map(([k, label, n]) => {
              const on = tab === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={n ? `${label}, ${n} ${k === 'in' ? 'okunmamış' : 'denizde'}` : label}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setTab(k);
                  }}
                  style={{ flex: 1, minHeight: 42, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: on ? colors.pearl : 'transparent' }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? colors.onRose : colors.mist }}>{label}</Text>
                  {n ? (
                    <View style={{ minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'in' ? '#B3263E' : on ? '#4B3A8C' : 'rgba(168,139,240,.25)' }}>
                      <Text style={{ fontFamily: fonts.extrabold, fontSize: 11, color: k === 'in' ? '#FFE9EC' : on ? '#EFE9FF' : colors.irisSoft }}>{n}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {loading && !letters.length ? null : !list.length ? (
            tab === 'in' ? (
              <EmptyState icon="sailing" tone="mute" title="Kıyın henüz sessiz" desc={`${partnerName} sana bir mektup yazdığında burada mühürlü bir zarf olarak belirecek.`} />
            ) : (
              <EmptyState icon="edit" tone="rose" title="İlk şişeyi sen bırak" desc="Hiç söyleyemediğin bir şeyi yaz; istersen yarın sabah, istersen bir yıl sonra ulaşsın." />
            )
          ) : (
            <View style={{ gap: 10 }}>
              {list.map((l) => (
                <LetterCard key={l.id} l={l} mine={l.sender_id === userId} original={l.reply_to ? byId.get(l.reply_to) : undefined} replies={replyCount.get(l.id) ?? 0} partnerName={partnerName} onWithdraw={() => withdraw(l)} />
              ))}
            </View>
          )}
        </>
      )}
      {dialog}
    </Screen>
  );
}

function LetterCard({ l, mine, original, replies, partnerName, onWithdraw }: { l: Letter; mine: boolean; original?: Letter; replies: number; partnerName: string; onWithdraw: () => void }) {
  const st = statusOf(l);
  const sealed = !mine && st === 'arrived';
  const when = mine ? relTime(l.created_at) : relTime(l.delivered_at);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sealed ? `${ablative(partnerName)} mühürlü mektup, açmak için dokun` : `Mektup: ${previewOf(l.body, 60)}`}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        router.push(`/letters/${l.id}`);
      }}
      style={({ pressed }) => ({
        borderRadius: radius.lg,
        backgroundColor: sealed ? 'rgba(179,38,62,.08)' : colors.velvet,
        borderWidth: 1,
        borderColor: sealed ? 'rgba(224,86,108,.35)' : colors.line,
        padding: 14,
        gap: 10,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {original ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="subdirectory_arrow_right" size={15} color={colors.mute} />
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.mute }}>
            {`“${previewOf(original.body, 40)}” mektubuna cevap`}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Envelope paper={l.paper} width={52} sealed={sealed} />
        <View style={{ flex: 1, gap: 4 }}>
          {sealed ? (
            <>
              <T v="title" style={{ fontSize: 16 }}>Mühürlü bir mektup</T>
              <T v="caption" numberOfLines={1}>{`${partnerName} · ${when}`}</T>
              <T v="caption" numberOfLines={1} color={colors.blush}>Mührü kırmak için dokun</T>
            </>
          ) : (
            <>
              <Text numberOfLines={2} style={{ fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 22, color: colors.pearl }}>
                {previewOf(l.body, 110)}
              </Text>
              <T v="caption" numberOfLines={1}>{mine ? `Sen · ${when}` : `${partnerName} · ${when}`}</T>
            </>
          )}
        </View>
        {sealed ? <WaxSeal size={26} /> : <Icon name="chevron_right" size={22} color={colors.mute} />}
      </View>
      {mine || replies ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          {mine ? (
            st === 'sea' ? (
              <Pill text={`DENİZDE · ${whenLabel(l.deliver_at).toLocaleUpperCase('tr-TR')} ULAŞACAK`} tone="pro" style={{ flexShrink: 1 }} />
            ) : st === 'arrived' ? (
              <Pill text="ULAŞTI" tone="rose" />
            ) : (
              <Pill text="OKUNDU ✓" tone="ok" />
            )
          ) : null}
          {replies ? <Pill text={`${replies} CEVAP`} tone="mute" /> : null}
          {mine && st === 'sea' ? (
            <View style={{ marginLeft: 'auto' }}>
              <Button title="Geri çek" icon="undo" kind="outline" size="sm" onPress={onWithdraw} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
