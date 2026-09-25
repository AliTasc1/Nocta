import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bubble, DaySeparator, type ChatMessage } from '@/components/ChatBubbles';
import { useDialog } from '@/components/Dialog';
import { TypingDots } from '@/components/Rings';
import { Sheet } from '@/components/Sheet';
import { Avatar, Button, Chip, EmptyState, Icon, IconButton, Screen, T } from '@/components/ui';
import { isOnline, relTime, shortDate } from '@/lib/format';
import { errorText, supabase } from '@/lib/supabase';
import type { Message, Question } from '@/lib/types';
import { uuid } from '@/lib/uuid';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';

const PAGE = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Bugün';
  const y = new Date(now.getTime() - DAY_MS);
  if (d.toDateString() === y.toDateString()) return 'Dün';
  return shortDate(iso);
}

export default function Chat() {
  const { userId, profile, partner, couple, refreshUnread } = useApp();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const focused = useIsFocused();
  const toast = useToast();
  const showToast = toast.show;
  const insets = useSafeAreaInsets();
  const { dialog, ask } = useDialog();
  const cid = couple?.status === 'active' && partner ? couple.id : null;
  const partnerId = partner?.id ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [older, setOlder] = useState<'idle' | 'loading' | 'done'>('idle');
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ open: boolean; loading: boolean; q: Question | null; sending: boolean }>({ open: false, loading: false, q: null, sending: false });
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(nowMs);
  const channel = useRef<RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const marking = useRef(false);
  const lastShot = useRef(0);

  const disappearing = !!(profile?.settings?.disappearing_messages || partner?.settings?.disappearing_messages);
  const screenshotAlerts = !!(profile?.settings?.screenshot_alerts || partner?.settings?.screenshot_alerts);

  // ── Yardımcılar ────────────────────────────────────────────
  const upsert = useCallback((row: ChatMessage) => {
    setMessages((cur) => {
      const cidx = row.meta?.client_id ? cur.findIndex((m) => m.meta?.client_id === row.meta.client_id) : -1;
      const idx = cidx >= 0 ? cidx : cur.findIndex((m) => m.id === row.id);
      if (idx >= 0) {
        const next = cur.slice();
        next[idx] = { ...row, meta: { ...row.meta, local_uri: cur[idx].meta?.local_uri } };
        return next;
      }
      return [row, ...cur].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    });
  }, []);

  const remove = useCallback((id: string) => setMessages((cur) => cur.filter((m) => m.id !== id)), []);

  // ── Yükleme ────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!cid) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoadError(null);
    const { data, error } = await supabase.from('messages').select('*').eq('couple_id', cid).order('created_at', { ascending: false }).limit(PAGE);
    if (error) setLoadError(errorText(error));
    else {
      setMessages((data as Message[]) ?? []);
      setOlder((data?.length ?? 0) < PAGE ? 'done' : 'idle');
    }
    setLoading(false);
  }, [cid]);

  const loadOlder = useCallback(async () => {
    if (!cid || older !== 'idle' || !messages.length) return;
    setOlder('loading');
    const oldest = messages[messages.length - 1];
    const { data, error } = await supabase.from('messages').select('*').eq('couple_id', cid).lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(PAGE);
    if (error) {
      setOlder('idle');
      return;
    }
    setMessages((cur) => {
      const ids = new Set(cur.map((m) => m.id));
      return [...cur, ...((data as Message[]) ?? []).filter((m) => !ids.has(m.id))];
    });
    setOlder((data?.length ?? 0) < PAGE ? 'done' : 'idle');
  }, [cid, older, messages]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Gerçek zamanlı: mesajlar, yazıyor, çevrimiçi ────────────
  useEffect(() => {
    if (!cid || !userId) return;
    const ch = supabase.channel(`chat:${cid}`, { config: { presence: { key: userId }, broadcast: { self: false } } });
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${cid}` }, (p) => {
      const row = p.new as Message;
      upsert(row);
      if (row.sender_id !== userId) setTyping(false);
    })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `couple_id=eq.${cid}` }, (p) => upsert(p.new as Message))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => {
        const id = (p.old as { id?: string })?.id;
        if (id) remove(id);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.user === userId) return;
        setTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 4000);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        setOnline(!!partnerId && Object.keys(state).includes(partnerId));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') ch.track({ at: new Date().toISOString() }).catch(() => {});
      });
    channel.current = ch;
    return () => {
      channel.current = null;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      supabase.removeChannel(ch);
    };
  }, [cid, userId, partnerId, upsert, remove]);

  // Ön plana dönünce kaçırılanları çek
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  // Kaybolan mesajlar ekranda da süresi dolunca kaybolsun
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const visible = useMemo(() => messages.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now), [messages, now]);

  // ── Okundu bilgisi ─────────────────────────────────────────
  useEffect(() => {
    if (!focused || !cid || !userId || marking.current || AppState.currentState !== 'active') return;
    if (!visible.some((m) => m.sender_id !== userId && !m.read_at)) return;
    marking.current = true;
    const at = new Date().toISOString();
    supabase
      .from('messages')
      .update({ read_at: at })
      .eq('couple_id', cid)
      .neq('sender_id', userId)
      .is('read_at', null)
      .then(() => {
        setMessages((cur) => cur.map((m) => (m.sender_id !== userId && !m.read_at ? { ...m, read_at: at } : m)));
        return refreshUnread();
      })
      .then(
        () => (marking.current = false),
        () => (marking.current = false),
      );
  }, [focused, visible, cid, userId, refreshUnread]);

  // ── Ekran görüntüsü uyarısı ─────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!screenshotAlerts || !cid || !userId || Platform.OS === 'web') return;
      let sub: { remove: () => void } | null = null;
      let cancelled = false;
      import('expo-screen-capture')
        .then((SC) => {
          if (cancelled) return;
          sub = SC.addScreenshotListener(() => {
            if (Date.now() - lastShot.current < 10000) return;
            lastShot.current = Date.now();
            supabase
              .from('messages')
              .insert({ couple_id: cid, sender_id: userId, kind: 'screenshot', body: `${profile?.display_name ?? 'Partnerin'} sohbetin ekran görüntüsünü aldı.`, meta: {} })
              .then(() => {});
          });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        sub?.remove();
      };
    }, [screenshotAlerts, cid, userId, profile?.display_name]),
  );

  // ── Gönderme ───────────────────────────────────────────────
  const insertMessage = useCallback(
    async (kind: Message['kind'], body: string, meta: Record<string, unknown> = {}, localUri?: string) => {
      if (!cid || !userId) return null;
      const clientId = uuid();
      const expires_at = disappearing ? new Date(Date.now() + DAY_MS).toISOString() : null;
      const temp: ChatMessage = {
        id: `tmp-${clientId}`,
        couple_id: cid,
        sender_id: userId,
        kind,
        body,
        meta: { ...meta, client_id: clientId, ...(localUri ? { local_uri: localUri } : {}) },
        expires_at,
        read_at: null,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages((cur) => [temp, ...cur]);
      const { data, error } = await supabase
        .from('messages')
        .insert({ couple_id: cid, sender_id: userId, kind, body, meta: { ...meta, client_id: clientId }, expires_at })
        .select('*')
        .single();
      if (error) {
        setMessages((cur) => cur.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
        throw error;
      }
      upsert(data as Message);
      return data as Message;
    },
    [cid, userId, disappearing, upsert],
  );

  const sendText = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      await insertMessage('text', body.slice(0, 4000));
    } catch (e) {
      toast.show(errorText(e), 'error');
      setText(body);
    }
  };

  const onChangeText = (t: string) => {
    setText(t);
    const nowTs = Date.now();
    if (t && channel.current && nowTs - lastTypingSent.current > 2000) {
      lastTypingSent.current = nowTs;
      channel.current.send({ type: 'broadcast', event: 'typing', payload: { user: userId } }).catch(() => {});
    }
  };

  const sendPhoto = async (source: 'library' | 'camera') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast.show('Fotoğraf çekmek için kamera izni gerekli.', 'error');
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false, exif: false };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > 12 * 1024 * 1024) {
        toast.show('Fotoğraf çok büyük (en fazla 12 MB).', 'error');
        return;
      }
      setUploading(true);
      const path = `${cid}/${uuid()}.jpg`;
      const buf = await (await fetch(a.uri)).arrayBuffer();
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, buf, { contentType: a.mimeType ?? 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      try {
        await insertMessage('photo', '', { path, width: a.width, height: a.height }, a.uri);
      } catch (e) {
        supabase.storage.from('chat-media').remove([path]).catch(() => {});
        throw e;
      }
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  const pickPhoto = () =>
    ask({
      icon: 'photo_camera',
      title: 'Fotoğraf gönder',
      desc: disappearing ? 'Kaybolan mesajlar açık: fotoğraf 24 saat sonra sohbetten kalkar.' : 'Fotoğraflar yalnızca ikinizin görebileceği özel bir alanda saklanır.',
      actions: [
        { label: 'Galeriden seç', icon: 'photo_library', onPress: () => void setTimeout(() => sendPhoto('library'), 450) },
        ...(Platform.OS !== 'web' ? [{ label: 'Fotoğraf çek', icon: 'photo_camera', kind: 'outline' as const, onPress: () => void setTimeout(() => sendPhoto('camera'), 450) }] : []),
        { label: 'Vazgeç', kind: 'ghost' },
      ],
    });

  // ── Sohbet oyunu: görev ─────────────────────────────────────
  const fetchPrompt = useCallback(async () => {
    setPrompt((p) => ({ ...p, open: true, loading: true }));
    const { data, error } = await supabase.rpc('random_chat_prompt');
    if (error) showToast(errorText(error), 'error');
    const q = (data as Question | null)?.id ? (data as Question) : null;
    setPrompt((p) => ({ ...p, loading: false, q }));
  }, [showToast]);

  useEffect(() => {
    if (params.prompt === '1' && cid && focused) {
      router.setParams({ prompt: undefined });
      fetchPrompt();
    }
  }, [params.prompt, cid, focused, fetchPrompt]);

  const sendPrompt = async () => {
    if (!prompt.q) return;
    setPrompt((p) => ({ ...p, sending: true }));
    try {
      await insertMessage('challenge', prompt.q.text, { question_id: prompt.q.id, timer_seconds: prompt.q.timer_seconds ?? null });
      setPrompt({ open: false, loading: false, q: null, sending: false });
    } catch (e) {
      toast.show(errorText(e), 'error');
      setPrompt((p) => ({ ...p, sending: false }));
    }
  };

  const completeChallenge = async (m: ChatMessage) => {
    setCompleting(m.id);
    try {
      const meta = { ...m.meta, done_at: new Date().toISOString(), done_by: userId };
      const { error } = await supabase.from('messages').update({ meta }).eq('id', m.id);
      if (error) throw error;
      upsert({ ...m, meta });
      await insertMessage('text', `✓ Görevi tamamladım: “${m.body.slice(0, 120)}”`, { reply_to: m.id });
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setCompleting(null);
    }
  };

  // ── Uzun basma: kopyala / sil / bildir ──────────────────────
  const onLongPress = (m: ChatMessage) => {
    if (m.pending || m.id.startsWith('tmp-')) {
      if (m.failed) remove(m.id);
      return;
    }
    const mine = m.sender_id === userId;
    const copy = m.kind === 'text' || m.kind === 'challenge' ? [{ label: 'Kopyala', icon: 'content_copy', kind: 'outline' as const, onPress: () => void Clipboard.setStringAsync(m.body).then(() => toast.show('Kopyalandı.', 'ok')) }] : [];
    if (mine) {
      ask({
        title: 'Mesaj',
        desc: 'Silinen mesaj ikiniz için de kaldırılır.',
        actions: [
          ...copy,
          {
            label: 'Sil',
            icon: 'delete',
            kind: 'danger',
            onPress: async () => {
              const { error } = await supabase.from('messages').delete().eq('id', m.id);
              if (error) throw error;
              if (m.kind === 'photo' && m.meta?.path) supabase.storage.from('chat-media').remove([m.meta.path]).catch(() => {});
              remove(m.id);
            },
          },
          { label: 'Vazgeç', kind: 'ghost' },
        ],
      });
    } else if (m.kind !== 'system' && m.kind !== 'screenshot') {
      ask({
        title: 'Mesaj',
        actions: [
          ...copy,
          {
            label: 'Bildir',
            icon: 'flag',
            kind: 'danger',
            onPress: () =>
              void setTimeout(
                () =>
                  ask({
                    icon: 'flag',
                    tone: 'error',
                    title: 'Bu mesajı bildir?',
                    desc: 'Mesaj incelenmek üzere Nocta ekibine iletilir. Partnerine bildirim gitmez.',
                    actions: [
                      {
                        label: 'Bildir',
                        kind: 'danger',
                        onPress: async () => {
                          const { error } = await supabase.from('reports').insert({
                            reporter_id: userId,
                            reported_user_id: m.sender_id,
                            couple_id: cid,
                            message_id: m.id,
                            type: m.kind === 'photo' ? 'photo' : 'chat',
                            title: m.kind === 'photo' ? 'Sohbette fotoğraf bildirildi' : 'Sohbet mesajı bildirildi',
                            description: m.body.slice(0, 1000),
                            priority: 'med',
                          });
                          if (error) throw error;
                          toast.show('Bildirimin alındı. Teşekkürler.', 'ok');
                        },
                      },
                      { label: 'Vazgeç', kind: 'ghost' },
                    ],
                  }),
                250,
              ),
          },
          { label: 'Vazgeç', kind: 'ghost' },
        ],
      });
    }
  };

  // ── Görünüm ────────────────────────────────────────────────
  if (!cid) {
    return (
      <Screen contentStyle={{ justifyContent: 'center' }}>
        <EmptyState
          icon="chat_bubble"
          title="Sohbet partnerinle açılır"
          desc="Yalnızca ikinizin göreceği özel sohbet, partnerin odana katıldığında başlar."
          action="Partnerini davet et"
          onAction={() => router.push('/invite')}
          secondary="Kodum var · Katıl"
          onSecondary={() => router.push('/join')}
        />
      </Screen>
    );
  }

  const status = typing ? 'yazıyor…' : online ? 'çevrimiçi' : partner?.last_seen_at ? (isOnline(partner.last_seen_at) ? 'az önce buradaydı' : `son görülme ${relTime(partner.last_seen_at)}`) : 'yalnızca ikiniz';

  return (
    <Screen scroll={false} padded={false} keyboard>
      {/* Başlık */}
      <View style={styles.header}>
        <View>
          <Avatar name={partner?.display_name} color={partner?.avatar_color} size={40} />
          {online ? <View style={styles.dot} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <T v="title" numberOfLines={1} style={{ fontSize: 15 }}>{partner?.display_name}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="lock" size={12} color={typing || online ? colors.success : colors.mist} />
            <T v="caption" numberOfLines={1} style={{ fontSize: 11.5, flexShrink: 1 }} color={typing || online ? colors.success : colors.mist}>{status}</T>
          </View>
        </View>
        <IconButton
          name="timer"
          label={disappearing ? 'Kaybolan mesajlar açık' : 'Kaybolan mesajlar kapalı'}
          color={disappearing ? colors.warning : colors.mist}
          bg={disappearing ? colors.warningTint : colors.whiteFaint}
          onPress={() => router.push('/privacy')}
        />
      </View>
      {disappearing ? (
        <View style={styles.notice}>
          <Icon name="timer" size={14} color={colors.warning} />
          <T v="caption" color={colors.warning} style={{ flexShrink: 1 }}>Kaybolan mesajlar açık · mesajlar 24 saat sonra silinir</T>
        </View>
      ) : null}

      {/* Mesajlar */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.rose} />
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <EmptyState icon="wifi_off" tone="warn" title="Mesajlar yüklenemedi" desc={loadError} action="Tekrar dene" onAction={() => load()} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={visible}
          inverted={visible.length > 0}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 4, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onEndReachedThreshold={0.3}
          onEndReached={loadOlder}
          ListHeaderComponent={
            typing ? (
              <View style={{ alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, backgroundColor: colors.dusk, marginTop: 4 }} accessibilityLabel="Partnerin yazıyor">
                <TypingDots />
              </View>
            ) : null
          }
          ListFooterComponent={older === 'loading' ? <ActivityIndicator color={colors.blush} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 }}>
              <Icon name="favorite" size={32} color={colors.blush} />
              <T v="h3" center>İlk mesajı sen yaz.</T>
              <T v="bodySm" center style={{ maxWidth: 280 }}>Ya da bir görev gönder: sohbet oyunu burada başlar.</T>
            </View>
          }
          renderItem={({ item, index }) => {
            const olderMsg = visible[index + 1];
            const showDay = !olderMsg || dayKey(olderMsg.created_at) !== dayKey(item.created_at);
            return (
              <View>
                {showDay ? <DaySeparator label={dayLabel(item.created_at)} /> : null}
                <Bubble
                  m={item}
                  mine={item.sender_id === userId}
                  onLongPress={() => onLongPress(item)}
                  onOpenPhoto={setViewer}
                  onCompleteChallenge={() => completeChallenge(item)}
                  completing={completing === item.id}
                />
              </View>
            );
          }}
        />
      )}

      {/* Yazma alanı */}
      <View style={styles.composer}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip label="Görev gönder" icon="bolt" active onPress={fetchPrompt} />
          <Chip label={uploading ? 'Yükleniyor…' : 'Fotoğraf'} icon="photo_camera" onPress={uploading ? undefined : pickPhoto} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <TextInput
            value={text}
            onChangeText={onChangeText}
            placeholder="Mesaj…"
            placeholderTextColor={colors.mute}
            selectionColor={colors.rose}
            cursorColor={colors.rose}
            multiline
            maxLength={4000}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Mesaj yaz"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gönder"
            disabled={!text.trim()}
            onPress={sendText}
            style={({ pressed }) => [styles.send, { backgroundColor: text.trim() ? colors.rose : colors.disabled, opacity: pressed ? 0.8 : 1 }]}
          >
            <Icon name="send" size={20} color={text.trim() ? colors.onRose : colors.disabledText} />
          </Pressable>
        </View>
      </View>

      {/* Görev seçimi */}
      <Sheet
        visible={prompt.open}
        onClose={() => setPrompt({ open: false, loading: false, q: null, sending: false })}
        label="SOHBET OYUNU"
        title="Bir görev gönder"
        footer={
          <View style={{ gap: 8 }}>
            <Button title="Gönder" icon="send" disabled={!prompt.q || prompt.loading} loading={prompt.sending} onPress={sendPrompt} />
            <Button title="Başka bir görev" icon="shuffle" kind="ghost" size="md" disabled={prompt.loading || prompt.sending} onPress={fetchPrompt} />
          </View>
        }
      >
        <View style={{ minHeight: 140, padding: 18, borderRadius: 22, backgroundColor: colors.velvet, borderWidth: 1, borderColor: 'rgba(231,104,138,.45)', justifyContent: 'center', gap: 10 }}>
          {prompt.loading ? (
            <ActivityIndicator color={colors.rose} />
          ) : prompt.q ? (
            <>
              <T v="label">{prompt.q.kind === 'dare' ? 'CESARET' : 'GÖREV'}</T>
              <T v="h3" style={{ fontSize: 24, lineHeight: 29 }}>{prompt.q.text}</T>
              {prompt.q.timer_seconds ? <T v="caption">{`Süre: ${prompt.q.timer_seconds} sn`}</T> : null}
            </>
          ) : (
            <T v="bodySm" center>Şu an ortak seviyenize uygun bir görev bulunamadı. Biraz sonra tekrar dene.</T>
          )}
        </View>
        <T v="caption" color={colors.mute}>Partnerin görevi sohbette bir kart olarak görür ve “Tamamladım” diyebilir. Görevler her zaman atlanabilir.</T>
      </Sheet>

      {/* Tam ekran fotoğraf */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.96)' }}>
          {viewer ? <Image source={{ uri: viewer }} style={{ flex: 1, marginTop: insets.top + 60, marginBottom: insets.bottom + 20 }} contentFit="contain" accessibilityLabel="Fotoğraf" /> : null}
          <View style={{ position: 'absolute', top: insets.top + 8, right: 16 }}>
            <IconButton name="close" label="Kapat" onPress={() => setViewer(null)} bg="rgba(255,255,255,.1)" />
          </View>
        </View>
      </Modal>
      {dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,230,240,.06)' },
  dot: { position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.ink },
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: 'rgba(242,194,123,.06)' },
  composer: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 10, backgroundColor: 'rgba(12,8,11,.92)', borderTopWidth: 1, borderTopColor: 'rgba(255,230,240,.06)' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,230,240,.1)',
    color: colors.pearl,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlignVertical: 'center',
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
