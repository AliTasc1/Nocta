/**
 * Sohbet medya arayüzü: ek (attachment) sayfası, gönderim önizlemesi ve tam ekran görüntüleyici.
 * Kaydetme / paylaşma seçeneği bilinçli olarak yoktur.
 */
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { durationLabel, MAX_VIDEO_SECONDS, type PickedMedia } from '@/lib/chatMedia';
import { guardScreenCapture } from '@/lib/screenCapture';
import { colors, fonts } from '@/theme';
import { Sheet } from './Sheet';
import { Icon, IconButton, T, Toggle } from './ui';

// ─────────────────────────────────────────────────────────────
// WhatsApp'taki "1" rozeti: tek seferlik aç/kapat
// ─────────────────────────────────────────────────────────────
export function ViewOnceToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Tek seferlik"
      accessibilityHint="Açıkken medya karşı tarafta yalnızca bir kez açılır"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: value ? colors.rose : 'rgba(255,255,255,.55)',
        backgroundColor: value ? colors.rose : 'rgba(0,0,0,.35)',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontFamily: fonts.extrabold, fontSize: 18, color: value ? colors.onRose : colors.pearl }}>1</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Ek sayfası
// ─────────────────────────────────────────────────────────────
function SheetRow({ icon, title, desc, onPress }: { icon: string; title: string; desc?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: pressed ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.04)', borderWidth: 1, borderColor: colors.line })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.roseTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={21} color={colors.blush} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="title" style={{ fontSize: 15 }}>{title}</T>
        {desc ? <T v="caption">{desc}</T> : null}
      </View>
      <Icon name="chevron_right" size={20} color={colors.mute} />
    </Pressable>
  );
}

export function AttachSheet({
  visible,
  onClose,
  viewOnce,
  onViewOnce,
  onPick,
  disappearing,
}: {
  visible: boolean;
  onClose: () => void;
  viewOnce: boolean;
  onViewOnce: (v: boolean) => void;
  onPick: (source: 'library' | 'camera', capture?: 'photo' | 'video') => void;
  disappearing?: boolean;
}) {
  const native = Platform.OS !== 'web';
  return (
    <Sheet visible={visible} onClose={onClose} label="MEDYA" title="Fotoğraf ya da video gönder">
      <SheetRow icon="photo_library" title="Fotoğraf / video seç" desc={`Galeriden · video en fazla ${MAX_VIDEO_SECONDS} sn, 50 MB`} onPress={() => onPick('library')} />
      {native ? (
        <>
          <T v="label" style={{ fontSize: 10, marginTop: 2 }}>KAMERA İLE ÇEK</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SheetRow icon="photo_camera" title="Fotoğraf" onPress={() => onPick('camera', 'photo')} />
            </View>
            <View style={{ flex: 1 }}>
              <SheetRow icon="videocam" title="Video" onPress={() => onPick('camera', 'video')} />
            </View>
          </View>
        </>
      ) : null}
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Tek seferlik, bir kez açılır"
        accessibilityState={{ checked: viewOnce }}
        onPress={() => onViewOnce(!viewOnce)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: viewOnce ? 'rgba(231,104,138,.12)' : 'rgba(255,255,255,.04)', borderWidth: 1, borderColor: viewOnce ? 'rgba(231,104,138,.5)' : colors.line }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <T v="title" style={{ fontSize: 15 }}>Tek seferlik 💣 (bir kez açılır)</T>
          <T v="caption">Partnerin yalnızca bir kez açabilir; önizleme gösterilmez, kaydedilemez.</T>
        </View>
        <View pointerEvents="none">
          <Toggle value={viewOnce} onChange={() => {}} label="Tek seferlik" />
        </View>
      </Pressable>
      {disappearing ? <T v="caption" color={colors.warning}>Kaybolan mesajlar açık: medya 24 saat sonra sohbetten kalkar.</T> : null}
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Video oynatıcı (önizleme + tam ekran). Önbelleğe yazmaz, akış olarak oynatır.
// ─────────────────────────────────────────────────────────────
function Player({ uri, autoPlay }: { uri: string; autoPlay?: boolean }) {
  const player = useVideoPlayer({ uri, useCaching: false }, (p) => {
    p.loop = true;
    if (autoPlay) p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return (
    <View style={{ flex: 1 }}>
      <VideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
        startsPictureInPictureAutomatically={false}
        allowsVideoFrameAnalysis={false}
      />
      {status === 'loading' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.pearl} />
        </View>
      ) : status === 'error' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
          <Icon name="error_outline" size={28} color={colors.mist} />
          <T v="bodySm" center>Video oynatılamadı.</T>
        </View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Gönderim önizlemesi
// ─────────────────────────────────────────────────────────────
export function MediaPreview({
  media,
  viewOnce,
  onViewOnce,
  onSend,
  onClose,
}: {
  media: PickedMedia | null;
  viewOnce: boolean;
  onViewOnce: (v: boolean) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Yükleme ilerlemesi sohbetteki balonda gösterilir; önizleme "Gönder"e basınca hemen kapanır
  const sending = false;
  const kindAcc = media?.kind === 'video' ? 'videoyu' : 'fotoğrafı';
  return (
    <Modal visible={!!media} animationType="slide" onRequestClose={sending ? () => {} : onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <IconButton name="close" label="Vazgeç" onPress={onClose} disabled={sending} bg="rgba(255,255,255,.1)" />
          <View style={{ flex: 1 }}>
            <T v="title" style={{ fontSize: 15 }}>{media?.kind === 'video' ? 'Video gönder' : 'Fotoğraf gönder'}</T>
            {media?.kind === 'video' && media.duration ? <T v="caption">{durationLabel(media.duration)}</T> : null}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {media?.kind === 'video' ? (
            <Player uri={media.uri} autoPlay />
          ) : media ? (
            <Image source={{ uri: media.uri }} style={{ flex: 1 }} contentFit="contain" cachePolicy="none" accessibilityLabel="Seçilen fotoğraf" />
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 14, gap: 12, backgroundColor: 'rgba(12,8,11,.95)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ViewOnceToggle value={viewOnce} onChange={onViewOnce} disabled={sending} />
            <View style={{ flex: 1 }}>
              <T v="title" style={{ fontSize: 14 }} color={viewOnce ? colors.blush : colors.pearl}>{viewOnce ? 'Tek seferlik 💣 açık' : 'Tek seferlik kapalı'}</T>
              <T v="caption" numberOfLines={2}>{viewOnce ? `Partnerin bu ${kindAcc} yalnızca bir kez açabilir.` : 'Açmak için “1”e dokun.'}</T>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gönder"
              disabled={sending}
              onPress={onSend}
              style={({ pressed }) => ({ height: 52, paddingHorizontal: 20, borderRadius: 26, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: sending ? colors.disabled : colors.rose, opacity: pressed ? 0.85 : 1 })}
            >
              {sending ? <ActivityIndicator color={colors.onRose} /> : <Icon name="send" size={20} color={colors.onRose} />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: sending ? colors.disabledText : colors.onRose }}>Gönder</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Tam ekran görüntüleyici (normal ve tek seferlik)
// ─────────────────────────────────────────────────────────────
export type ViewerMedia = { kind: 'photo' | 'video'; url: string; viewOnce?: boolean };

export function MediaViewer({ media, onClose }: { media: ViewerMedia | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loaded = !!media && loadedUrl === media.url;

  // Görüntüleyici açıkken ekran görüntüsü/kayıt koruması (sohbet ekranındaki korumaya ek güvence)
  useEffect(() => {
    if (!media) return;
    let release: (() => void) | null = null;
    let dead = false;
    guardScreenCapture().then((r) => (dead ? r() : (release = r)));
    return () => {
      dead = true;
      release?.();
    };
  }, [media]);

  return (
    <Modal visible={!!media} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flex: 1, marginTop: insets.top + 60, marginBottom: insets.bottom + 20 }}>
          {media?.kind === 'video' ? (
            <Player uri={media.url} autoPlay />
          ) : media ? (
            <>
              <Image
                source={{ uri: media.url }}
                style={{ flex: 1 }}
                contentFit="contain"
                // Tek seferlik medya diske yazılmaz
                cachePolicy={media.viewOnce ? 'none' : 'memory-disk'}
                onLoad={() => setLoadedUrl(media.url)}
                accessibilityLabel="Fotoğraf"
              />
              {!loaded ? (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator color={colors.pearl} />
                </View>
              ) : null}
            </>
          ) : null}
        </View>
        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            {media?.viewOnce ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.rose, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.extrabold, fontSize: 12, color: colors.blush }}>1</Text>
                </View>
                <T v="caption" color={colors.pearl} style={{ flexShrink: 1 }}>Tek seferlik · kapattığında bir daha açılamaz</T>
              </View>
            ) : null}
          </View>
          <IconButton name="close" label="Kapat" onPress={onClose} bg="rgba(255,255,255,.12)" />
        </View>
      </View>
    </Modal>
  );
}
