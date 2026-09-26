import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { durationLabel } from '@/lib/chatMedia';
import { clock } from '@/lib/format';
import type { Message } from '@/lib/types';
import { colors, fonts } from '@/theme';
import { useSignedUrl } from './Timeline';
import { Button, Icon, T } from './ui';

export type ChatMessage = Message & { pending?: boolean; failed?: boolean; progress?: number };

export const isViewOnce = (m: Pick<Message, 'kind' | 'meta'>) => (m.kind === 'photo' || m.kind === 'video') && !!m.meta?.view_once;

function Meta({ m, mine, onDark }: { m: ChatMessage; mine: boolean; onDark?: boolean }) {
  const fg = onDark ? 'rgba(26,7,16,.6)' : colors.mute;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4 }}>
      {m.expires_at ? <Icon name="timer" size={11} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: fg }}>{clock(m.created_at)}</Text>
      {mine ? (
        m.failed ? (
          <Icon name="error" size={13} color={colors.error} />
        ) : m.pending ? (
          <Icon name="schedule" size={12} color={fg} />
        ) : (
          <Icon name={m.read_at ? 'done_all' : 'done'} size={14} color={m.read_at ? (onDark ? '#3B0D1F' : colors.success) : fg} />
        )
      ) : null}
    </View>
  );
}

function UploadOverlay({ m }: { m: ChatMessage }) {
  if (!m.pending) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,8,11,.45)', alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
      <ActivityIndicator color={colors.pearl} />
      {typeof m.progress === 'number' ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.pearl }}>{`%${Math.round(m.progress * 100)}`}</Text> : null}
    </View>
  );
}

function PhotoBody({ m, onOpen }: { m: ChatMessage; onOpen: (url: string) => void }) {
  const local = m.meta?.local_uri as string | undefined;
  const { url, failed } = useSignedUrl(local ? null : (m.meta?.path as string | undefined));
  const src = local ?? url;
  const w = Number(m.meta?.width) || 3;
  const h = Number(m.meta?.height) || 4;
  const ratio = Math.min(Math.max(w / h, 0.6), 1.6);
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel="Fotoğraf, büyütmek için dokun"
      disabled={!src}
      onPress={() => src && onOpen(src)}
      style={{ width: 220, maxWidth: '100%', aspectRatio: ratio, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.dusk, alignItems: 'center', justifyContent: 'center' }}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : failed ? (
        <Icon name="image_not_supported" size={28} color={colors.mute} />
      ) : (
        <ActivityIndicator color={colors.blush} />
      )}
      <UploadOverlay m={m} />
    </Pressable>
  );
}

function VideoBody({ m, onOpen }: { m: ChatMessage; onOpen: () => void }) {
  const localPoster = m.meta?.local_poster as string | undefined;
  const { url: poster } = useSignedUrl(localPoster ? null : (m.meta?.poster as string | undefined));
  const src = localPoster ?? poster;
  const w = Number(m.meta?.width) || 9;
  const h = Number(m.meta?.height) || 16;
  const ratio = Math.min(Math.max(w / h, 0.6), 1.6);
  const dur = durationLabel(m.meta?.duration as number | undefined);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Video${dur ? `, ${dur}` : ''}, oynatmak için dokun`}
      disabled={!!m.pending}
      onPress={onOpen}
      style={{ width: 220, maxWidth: '100%', aspectRatio: ratio, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}
    >
      {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,.5)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="play_arrow" size={32} color="#fff" />
      </View>
      {dur ? (
        <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.55)' }}>
          <Icon name="videocam" size={12} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{dur}</Text>
        </View>
      ) : null}
      <UploadOverlay m={m} />
    </Pressable>
  );
}

/**
 * Tek seferlik medya: kimse için önizleme yok.
 * Gönderen: "Gönderildi" → "Açıldı · saat". Alıcı: "açmak için dokun" → açıldıktan sonra "Açıldı".
 */
function ViewOnceBody({ m, mine, openedAt, opening, onOpen }: { m: ChatMessage; mine: boolean; openedAt?: string | null; opening?: boolean; onOpen: () => void }) {
  const what = m.kind === 'video' ? 'video' : 'fotoğraf';
  const fg = mine ? colors.onRose : colors.pearl;
  const sub = mine ? 'rgba(26,7,16,.7)' : colors.mist;
  const canOpen = !mine && !openedAt && !m.pending;
  const status = m.pending
    ? typeof m.progress === 'number'
      ? `Yükleniyor… %${Math.round(m.progress * 100)}`
      : 'Gönderiliyor…'
    : openedAt
      ? `Açıldı · ${clock(openedAt)}`
      : mine
        ? 'Gönderildi · henüz açılmadı'
        : 'Açmak için dokun';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tek seferlik ${what}. ${status}`}
      accessibilityState={{ disabled: !canOpen, busy: !!opening }}
      disabled={!canOpen || opening}
      onPress={onOpen}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 4, minWidth: 200, opacity: pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderStyle: openedAt ? 'dashed' : 'solid',
          borderColor: openedAt ? sub : mine ? colors.onRose : colors.rose,
        }}
      >
        {opening ? <ActivityIndicator size="small" color={fg} /> : <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: openedAt ? sub : fg }}>1</Text>}
      </View>
      <View style={{ flexShrink: 1, gap: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: fg }}>{`💣 Tek seferlik ${what}`}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: canOpen ? (mine ? fg : colors.blush) : sub }}>{status}</Text>
      </View>
    </Pressable>
  );
}

export function Bubble({
  m,
  mine,
  partnerName,
  onLongPress,
  onOpenMedia,
  onOpenViewOnce,
  viewOnceOpenedAt,
  opening,
  onCompleteChallenge,
  completing,
}: {
  m: ChatMessage;
  mine: boolean;
  partnerName?: string | null;
  onLongPress: () => void;
  /** Normal fotoğraf/video: fotoğrafta hazır URL (yerel ya da imzalı) gelir, videoda URL'yi çağıran çözer */
  onOpenMedia: (m: ChatMessage, url?: string) => void;
  onOpenViewOnce?: () => void;
  viewOnceOpenedAt?: string | null;
  opening?: boolean;
  onCompleteChallenge: () => void;
  completing?: boolean;
}) {
  if (m.kind === 'screenshot') {
    // Her iki taraf için ortada sistem notu: "📸 Ayşe ekran görüntüsü aldı · 21:04"
    const who = mine ? 'Sen ekran görüntüsü aldın' : `${partnerName || 'Partnerin'} ekran görüntüsü aldı`;
    return (
      <View
        accessibilityRole="text"
        style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.warningTint, borderWidth: 1, borderColor: 'rgba(242,194,123,.25)', maxWidth: '90%', marginVertical: 6 }}
      >
        <T v="caption" color={colors.warning} style={{ flexShrink: 1 }}>{`📸 ${who} · ${clock(m.created_at)}`}</T>
      </View>
    );
  }
  if (m.kind === 'system') {
    return (
      <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.whiteFaint, maxWidth: '90%', marginVertical: 4 }}>
        <Icon name="info" size={14} color={colors.mist} />
        <T v="caption" color={colors.mist} style={{ flexShrink: 1 }}>{m.body}</T>
      </View>
    );
  }

  if (m.kind === 'challenge') {
    const done = !!m.meta?.done_at;
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          width: 250,
          maxWidth: '82%',
          padding: 14,
          borderRadius: 20,
          backgroundColor: colors.velvet,
          borderWidth: 1,
          borderColor: done ? 'rgba(127,209,174,.45)' : 'rgba(231,104,138,.45)',
          gap: 8,
          marginVertical: 2,
        }}
      >
        <T v="label" style={{ fontSize: 10 }} color={done ? colors.success : colors.blush}>
          {done ? 'GÖREV TAMAMLANDI' : mine ? 'GÖREV GÖNDERİLDİ' : 'SANA BİR GÖREV'}
        </T>
        <T v="h3" style={{ fontSize: 19, lineHeight: 23 }}>{m.body}</T>
        {m.meta?.timer_seconds ? <T v="caption">{`Süre: ${m.meta.timer_seconds} sn`}</T> : null}
        {!mine && !done ? (
          <Button title="Tamamladım" size="sm" icon="check" kind="success" loading={completing} onPress={onCompleteChallenge} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
        ) : !done ? (
          <T v="caption">Bekliyor…</T>
        ) : null}
        <Meta m={m} mine={mine} />
      </Pressable>
    );
  }

  const vo = isViewOnce(m);
  const photo = (m.kind === 'photo' || m.kind === 'video') && !vo;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityHint="Seçenekler için basılı tut"
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        paddingHorizontal: photo ? 4 : vo ? 8 : 14,
        paddingTop: photo ? 4 : vo ? 8 : 10,
        paddingBottom: photo ? 6 : 8,
        borderRadius: 20,
        borderBottomRightRadius: mine ? 6 : 20,
        borderBottomLeftRadius: mine ? 20 : 6,
        backgroundColor: mine ? colors.rose : colors.dusk,
        opacity: m.failed ? 0.6 : 1,
        marginVertical: 2,
      }}
    >
      {vo ? (
        <ViewOnceBody m={m} mine={mine} openedAt={viewOnceOpenedAt} opening={opening} onOpen={() => onOpenViewOnce?.()} />
      ) : m.kind === 'video' ? (
        <VideoBody m={m} onOpen={() => onOpenMedia(m)} />
      ) : photo ? (
        <PhotoBody m={m} onOpen={(url) => onOpenMedia(m, url)} />
      ) : (
        <Text selectable={false} maxFontSizeMultiplier={1.4} style={{ fontFamily: mine ? fonts.semibold : fonts.medium, fontSize: 14.5, lineHeight: 20, color: mine ? colors.onRose : colors.pearl }}>
          {m.body}
        </Text>
      )}
      <View style={{ paddingHorizontal: photo ? 8 : 0 }}>
        <Meta m={m} mine={mine} onDark={mine} />
      </View>
    </Pressable>
  );
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <T v="caption" center color={colors.mute} style={{ marginVertical: 10 }}>
      {label}
    </T>
  );
}
