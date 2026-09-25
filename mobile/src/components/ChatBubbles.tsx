import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { clock } from '@/lib/format';
import type { Message } from '@/lib/types';
import { colors, fonts } from '@/theme';
import { useSignedUrl } from './Timeline';
import { Button, Icon, T } from './ui';

export type ChatMessage = Message & { pending?: boolean; failed?: boolean };

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
      {m.pending ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(12,8,11,.45)', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.pearl} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function Bubble({
  m,
  mine,
  onLongPress,
  onOpenPhoto,
  onCompleteChallenge,
  completing,
}: {
  m: ChatMessage;
  mine: boolean;
  onLongPress: () => void;
  onOpenPhoto: (url: string) => void;
  onCompleteChallenge: () => void;
  completing?: boolean;
}) {
  if (m.kind === 'system' || m.kind === 'screenshot') {
    return (
      <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: m.kind === 'screenshot' ? colors.warningTint : colors.whiteFaint, maxWidth: '90%', marginVertical: 4 }}>
        <Icon name={m.kind === 'screenshot' ? 'screenshot_monitor' : 'info'} size={14} color={m.kind === 'screenshot' ? colors.warning : colors.mist} />
        <T v="caption" color={m.kind === 'screenshot' ? colors.warning : colors.mist} style={{ flexShrink: 1 }}>{m.body}</T>
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

  const photo = m.kind === 'photo';
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityHint="Seçenekler için basılı tut"
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        paddingHorizontal: photo ? 4 : 14,
        paddingTop: photo ? 4 : 10,
        paddingBottom: photo ? 6 : 8,
        borderRadius: 20,
        borderBottomRightRadius: mine ? 6 : 20,
        borderBottomLeftRadius: mine ? 20 : 6,
        backgroundColor: mine ? colors.rose : colors.dusk,
        opacity: m.failed ? 0.6 : 1,
        marginVertical: 2,
      }}
    >
      {photo ? (
        <PhotoBody m={m} onOpen={onOpenPhoto} />
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
