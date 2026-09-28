import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSignedUrl } from '@/components/Timeline';
import { Icon } from '@/components/ui';
import { MAX_PHOTO_BYTES, MediaError } from '@/lib/chatMedia';
import { colors, fonts } from '@/theme';

/**
 * Burası Neresi? — fotoğraf yardımcıları:
 *  - `FrostedPhoto`: buzlu cam ardında (ağır bulanık + buz dokusu) fotoğraf; `clear` 0 → 1 ile buz erir.
 *  - `pickPlacePhoto`: kamera/galeriden yalnızca fotoğraf seçimi (sohbet medyasıyla aynı ayarlar).
 *  - `WhereHistory`: sonuç ekranı için tur geçmişi (fotoğraf + cevap + tahmin).
 */
export const ICE = '#BFE3FF';

export type PlacePhoto = { uri: string; mimeType: string; ext: string; width: number; height: number };

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

/** Kamera ya da galeriden tek fotoğraf. `null` → vazgeçildi. Hata → Türkçe MediaError. */
export async function pickPlacePhoto(source: 'camera' | 'library'): Promise<PlacePhoto | null> {
  if (source === 'camera' && Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new MediaError('Fotoğraf çekmek için kamera izni gerekli. Ayarlardan izin verebilirsin.');
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    exif: false,
    quality: 0.6,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if (a.type === 'video' || a.mimeType?.startsWith('video/')) throw new MediaError('Lütfen bir fotoğraf seç.');
  if (a.fileSize && a.fileSize > MAX_PHOTO_BYTES) throw new MediaError('Fotoğraf çok büyük (en fazla 12 MB).');
  const mimeType = (a.mimeType ?? 'image/jpeg').toLowerCase();
  return { uri: a.uri, mimeType, ext: EXT[mimeType] ?? 'jpg', width: a.width || 0, height: a.height || 0 };
}

/** Deterministik sözde rastgele (buz dokusu her çizimde aynı) */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Buz çiçekleri + kırağı tanecikleri + kenarlarda kalınlaşan buz */
const FrostTexture = memo(function FrostTexture() {
  const flakes = Array.from({ length: 16 }, (_, i) => ({ x: rnd(i, 1) * 100, y: rnd(i, 2) * 125, r: 3 + rnd(i, 3) * 7, rot: rnd(i, 4) * 60, o: 0.25 + rnd(i, 5) * 0.35 }));
  const grains = Array.from({ length: 140 }, (_, i) => ({ x: rnd(i, 6) * 100, y: rnd(i, 7) * 125, r: 0.25 + rnd(i, 8) * 0.8, o: 0.12 + rnd(i, 9) * 0.4 }));
  const streaks = Array.from({ length: 22 }, (_, i) => {
    // kenarlardan içeri uzanan eğrelti otu gibi buz çizgileri
    const edge = i % 4;
    const p = rnd(i, 10);
    const [x, y] = edge === 0 ? [p * 100, 0] : edge === 1 ? [100, p * 125] : edge === 2 ? [p * 100, 125] : [0, p * 125];
    const ang = Math.atan2(62.5 - y, 50 - x) + (rnd(i, 11) - 0.5) * 1.2;
    const len = 10 + rnd(i, 12) * 22;
    return { x, y, x2: x + Math.cos(ang) * len, y2: y + Math.sin(ang) * len, ang, len };
  });
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <RadialGradient id="fr-edge" cx="0.5" cy="0.5" r="0.72">
          <Stop offset="0.35" stopColor="#EAF6FF" stopOpacity="0.06" />
          <Stop offset="0.8" stopColor="#EAF6FF" stopOpacity="0.38" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.62" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={125} fill="#DCEFFF" fillOpacity={0.2} />
      <Rect x={0} y={0} width={100} height={125} fill="url(#fr-edge)" />
      {grains.map((g, i) => (
        <Circle key={`g${i}`} cx={g.x} cy={g.y} r={g.r} fill="#FFFFFF" fillOpacity={g.o} />
      ))}
      {streaks.map((s, i) => (
        <G key={`s${i}`}>
          <Line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.5} strokeLinecap="round" />
          {[0.3, 0.5, 0.7].map((f) => {
            const bx = s.x + (s.x2 - s.x) * f;
            const by = s.y + (s.y2 - s.y) * f;
            const bl = s.len * 0.22 * (1 - f * 0.6);
            return (
              <G key={f}>
                <Line x1={bx} y1={by} x2={bx + Math.cos(s.ang + 0.7) * bl} y2={by + Math.sin(s.ang + 0.7) * bl} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={0.4} strokeLinecap="round" />
                <Line x1={bx} y1={by} x2={bx + Math.cos(s.ang - 0.7) * bl} y2={by + Math.sin(s.ang - 0.7) * bl} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={0.4} strokeLinecap="round" />
              </G>
            );
          })}
        </G>
      ))}
      {flakes.map((f, i) => (
        <G key={`f${i}`} transform={`rotate(${f.rot} ${f.x} ${f.y})`}>
          {[0, 60, 120].map((d) => {
            const a = (d * Math.PI) / 180;
            return <Line key={d} x1={f.x - Math.cos(a) * f.r} y1={f.y - Math.sin(a) * f.r} x2={f.x + Math.cos(a) * f.r} y2={f.y + Math.sin(a) * f.r} stroke="#FFFFFF" strokeOpacity={f.o} strokeWidth={0.55} strokeLinecap="round" />;
          })}
          <Circle cx={f.x} cy={f.y} r={0.9} fill="#FFFFFF" fillOpacity={f.o + 0.2} />
        </G>
      ))}
    </Svg>
  );
});

/**
 * Buzlu fotoğraf. `sharp` false iken net görüntü hiç çizilmez (tahmin eden erken göremez).
 * `clear`: 0 buzlu → 1 net (native driver ile opaklık/ölçek).
 */
export function FrostedPhoto({ uri, clear, sharp, width, height, radius = 26, loadingLabel = 'Fotoğraf yükleniyor…' }: { uri: string | null; clear: Animated.Value; sharp: boolean; width: number; height: number; radius?: number; loadingLabel?: string }) {
  const frost = clear.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: '#101422', borderWidth: 1, borderColor: 'rgba(191,227,255,.28)' }}>
      {uri ? (
        <>
          {/* ağır bulanık katman (kenar boşluğu görünmesin diye büyütülmüş) */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: frost, transform: [{ scale: 1.25 }] }]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={Platform.OS === 'web' ? 34 : 60} transition={250} cachePolicy="memory-disk" />
          </Animated.View>
          {sharp ? (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: clear, transform: [{ scale: clear.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }] }]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" />
            </Animated.View>
          ) : null}
          {Platform.OS === 'ios' ? (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: frost }]}>
              <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill} />
            </Animated.View>
          ) : null}
          {/* buz dokusu: erirken hafifçe büyüyüp kaybolur */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: frost, transform: [{ scale: clear.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }], pointerEvents: 'none' },
            ]}
          >
            <LinearGradient colors={['rgba(214,236,255,.34)', 'rgba(170,200,235,.2)', 'rgba(214,236,255,.4)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <FrostTexture />
          </Animated.View>
          {/* cam parlaması */}
          <LinearGradient colors={['rgba(255,255,255,.18)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.5 }} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
          <LinearGradient colors={['#1A2236', '#0E1220']} style={StyleSheet.absoluteFill} />
          <ActivityIndicator color={ICE} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.mist }}>{loadingLabel}</Text>
        </View>
      )}
    </View>
  );
}

/** Depodaki yol → imzalı adres (yerel önizleme varsa o) */
export function usePhotoUri(path: string | null | undefined, localUri?: string | null) {
  const { url, failed } = useSignedUrl(localUri ? null : path);
  return { uri: localUri ?? url, failed };
}

export type WhereRound = { shooter: string; guesser: string; photo: string | null; answer: string | null; guess: string | null; correct: boolean; from_clown: boolean; hints_used: number };

/** Sonuç ekranı: tur tur fotoğraflar ve cevaplar */
export function WhereHistory({ rounds, userId, partnerName }: { rounds: WhereRound[]; userId: string; partnerName: string }) {
  if (!rounds.length) return null;
  return (
    <View style={{ width: '100%', gap: 8 }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.blush }}>FOTOĞRAFLAR</Text>
      {rounds.map((r, i) => (
        <HistoryRow key={i} r={r} n={i + 1} userId={userId} partnerName={partnerName} />
      ))}
    </View>
  );
}

function HistoryRow({ r, n, userId, partnerName }: { r: WhereRound; n: number; userId: string; partnerName: string }) {
  const { uri } = usePhotoUri(r.photo);
  const mine = r.guesser === userId;
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 18, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, alignItems: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: '#101422', alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Icon name="photo" size={22} color={colors.faint} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.mute }}>{`TUR ${n} · ${r.shooter === userId ? 'SEN ÇEKTİN' : `${partnerName.toLocaleUpperCase('tr-TR')} ÇEKTİ`}`}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 20, lineHeight: 24, color: colors.pearl }}>{r.answer ?? '—'}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12.5, color: r.correct ? colors.success : colors.error }}>
          {`${mine ? 'Tahminin' : 'Tahmini'}: ${r.guess ?? '—'}${r.from_clown ? ' 🤡' : ''}`}
        </Text>
      </View>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: r.correct ? colors.successTint : colors.errorTint }}>
        <Icon name={r.correct ? 'check' : 'close'} size={18} color={r.correct ? colors.success : colors.error} />
      </View>
    </View>
  );
}
