/**
 * Sohbet medyası: seçme (galeri / kamera), boyut kontrolü, ilerlemeli yükleme, video kapağı.
 *
 * Depolama düzeni (bucket 'chat-media'):
 * - Normal medya:      `${couple_id}/${uuid}.${ext}`     → meta { path, width, height, duration?, poster? }
 * - Tek seferlik medya: `${couple_id}/vo/${uuid}.${ext}`  → meta { view_once: true, path, duration? }
 *   vo/ klasörü istemciden okunamaz; alıcı yalnızca 'view-once' edge fonksiyonu ile bir kez açar.
 */
import { File, UploadTask, UploadType } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase';
import { uuid } from './uuid';

export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export type PickedMedia = {
  uri: string;
  kind: 'photo' | 'video';
  width: number;
  height: number;
  /** saniye */
  duration: number | null;
  size: number | null;
  mimeType: string;
  ext: string;
};

export class MediaError extends Error {}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
};

function guessMime(a: ImagePicker.ImagePickerAsset, kind: 'photo' | 'video') {
  if (a.mimeType) return a.mimeType.toLowerCase();
  const ext = (a.fileName ?? a.uri).split('?')[0].split('.').pop()?.toLowerCase();
  const hit = Object.entries(EXT).find(([, e]) => e === ext);
  if (hit && hit[0].startsWith(kind === 'video' ? 'video/' : 'image/')) return hit[0];
  return kind === 'video' ? 'video/mp4' : 'image/jpeg';
}

function fileSize(a: ImagePicker.ImagePickerAsset): number | null {
  if (a.fileSize) return a.fileSize;
  if (Platform.OS === 'web') return null;
  try {
    const f = new File(a.uri);
    return f.exists ? f.size : null;
  } catch {
    return null;
  }
}

/**
 * Galeriden fotoğraf/video seçer ya da kamerayla çeker.
 * `null` → kullanıcı vazgeçti. Hata → Türkçe mesajlı MediaError.
 */
export async function pickMedia(source: 'library' | 'camera', capture: 'photo' | 'video' = 'photo'): Promise<PickedMedia | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new MediaError('Çekim yapmak için kamera izni gerekli. Ayarlardan izin verebilirsin.');
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: source === 'library' ? ['images', 'videos'] : capture === 'video' ? ['videos'] : ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    exif: false,
    quality: 0.7,
    // Kayıt süresi sınırı (Android'de kamera uygulamasının desteğine bağlı; seçimden sonra ayrıca kontrol ediyoruz)
    videoMaxDuration: MAX_VIDEO_SECONDS,
    // iOS: kayıt/dışa aktarma kalitesi — dosya boyutunu makul tutar
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    // iOS: HEIC yerine uyumlu (JPEG/H.264) temsil
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const kind: 'photo' | 'video' = a.type === 'video' || a.mimeType?.startsWith('video/') ? 'video' : 'photo';
  const mimeType = guessMime(a, kind);
  const size = fileSize(a);
  const duration = kind === 'video' && a.duration ? Math.round(a.duration / 1000) : null;

  if (kind === 'video') {
    if (duration && duration > MAX_VIDEO_SECONDS + 1) throw new MediaError(`Video en fazla ${MAX_VIDEO_SECONDS} saniye olabilir. Daha kısa bir video seç.`);
    if (size && size > MAX_VIDEO_BYTES) throw new MediaError('Video çok büyük (en fazla 50 MB). Daha kısa ya da düşük kaliteli bir video dene.');
  } else if (size && size > MAX_PHOTO_BYTES) {
    throw new MediaError('Fotoğraf çok büyük (en fazla 12 MB).');
  }

  return {
    uri: a.uri,
    kind,
    width: a.width || 0,
    height: a.height || 0,
    duration,
    size,
    mimeType,
    ext: EXT[mimeType] ?? (kind === 'video' ? 'mp4' : 'jpg'),
  };
}

export function mediaPath(coupleId: string, ext: string, viewOnce: boolean) {
  return `${coupleId}/${viewOnce ? 'vo/' : ''}${uuid()}.${ext}`;
}

class HttpUploadError extends Error {}

/**
 * Dosyayı 'chat-media' kovasına yükler.
 * Yerelde expo-file-system UploadTask kullanılır: dosya belleğe okunmaz (büyük videolarda Android'de
 * arrayBuffer bellek hatası vermez) ve gerçek ilerleme bildirilir. Görev başlatılamazsa (ör. web)
 * fetch(uri).arrayBuffer() → supabase.storage.upload yoluna düşülür.
 */
export async function uploadChatFile(path: string, uri: string, contentType: string, onProgress?: (p: number) => void) {
  if (Platform.OS !== 'web') {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new HttpUploadError('Oturum süresi doldu. Tekrar giriş yap.');
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const task = new UploadTask(new File(uri), `${SUPABASE_URL}/storage/v1/object/chat-media/${encoded}`, {
        httpMethod: 'POST',
        uploadType: UploadType.BINARY_CONTENT,
        mimeType: contentType,
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': contentType,
          'x-upsert': 'false',
          'cache-control': '3600',
        },
        onProgress: (p) => p.totalBytes > 0 && onProgress?.(Math.min(1, p.bytesSent / p.totalBytes)),
      });
      const res = await task.uploadAsync();
      if (res.status >= 200 && res.status < 300) {
        onProgress?.(1);
        return;
      }
      if (res.status === 413) throw new HttpUploadError('Dosya çok büyük (en fazla 50 MB).');
      let msg = '';
      try {
        msg = JSON.parse(res.body)?.message ?? '';
      } catch {}
      throw new HttpUploadError(/row-level security|unauthorized/i.test(msg) ? 'Bu işlem için yetkin yok.' : msg || 'Yükleme başarısız oldu. Tekrar dene.');
    } catch (e) {
      if (e instanceof HttpUploadError) throw e;
      // Yerel görev kullanılamadı → aşağıdaki yedek yola düş
    }
  }
  onProgress?.(0.05);
  const buf = await (await fetch(uri)).arrayBuffer();
  onProgress?.(0.3);
  const { error } = await supabase.storage.from('chat-media').upload(path, buf, { contentType, upsert: false });
  if (error) throw error;
  onProgress?.(1);
}

/** Normal videolar için kapak (poster) karesi üretir. Başarısızsa null — balon düz kart gösterir. */
export async function makePoster(uri: string): Promise<{ uri: string; width: number; height: number } | null> {
  if (Platform.OS === 'web') return null;
  try {
    const VT = await import('expo-video-thumbnails');
    const r = await VT.getThumbnailAsync(uri, { time: 300, quality: 0.6 });
    return { uri: r.uri, width: r.width, height: r.height };
  } catch {
    return null;
  }
}

export function durationLabel(sec?: number | null) {
  if (!sec || sec < 0) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
