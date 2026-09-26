// Kart Seç (cards) motoru: kart görsellerinin 'card-images' deposuna yüklenmesi ve silinmesi.
import { supabase, supabaseKey, supabaseUrl } from './supabase';
import { AppError } from './errors';

export const CARD_BUCKET = 'card-images';
export const CARD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CARD_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};
export const CARD_IMAGE_ACCEPT = Object.keys(CARD_IMAGE_TYPES).join(',');

const PUBLIC_PREFIX = `${supabaseUrl}/storage/v1/object/public/${CARD_BUCKET}/`;

/** Dosyayı yüklemeden önce doğrular; sorun varsa Türkçe mesaj döner. */
export function validateCardImage(file: File): string | null {
  if (!CARD_IMAGE_TYPES[file.type]) return 'Yalnızca JPEG, PNG, WebP ya da GIF görseller yüklenebilir.';
  if (file.size > CARD_IMAGE_MAX_BYTES) return `Görsel en fazla 5 MB olabilir (seçilen: ${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB).`;
  if (file.size === 0) return 'Seçilen dosya boş.';
  return null;
}

const uuid = () => {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
};

/** Yükleme yolu: `${game_id}/${question_id | 'new'}/${uuid}.${ext}` */
export function cardImagePath(gameId: string, questionId: string | undefined, file: File): string {
  const ext = CARD_IMAGE_TYPES[file.type] ?? 'jpg';
  return `${gameId || 'oyun'}/${questionId || 'new'}/${uuid()}.${ext}`;
}

export const publicCardUrl = (path: string) => supabase.storage.from(CARD_BUCKET).getPublicUrl(path).data.publicUrl;

/** Bu depoya ait herkese açık adresten dosya yolunu çıkarır; başka adreslerde null. */
export function cardPathFromUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const s = u.split(/[?#]/)[0];
  if (!s.startsWith(PUBLIC_PREFIX)) return null;
  const p = s.slice(PUBLIC_PREFIX.length);
  try { return decodeURIComponent(p) || null; } catch { return p || null; }
}

function uploadError(status: number, body: string): AppError {
  let msg = '';
  try { const j = JSON.parse(body); msg = String(j.message ?? j.error ?? ''); } catch { msg = body; }
  const low = msg.toLowerCase();
  if (status === 413 || low.includes('too large') || low.includes('maximum allowed size')) return new AppError('Görsel en fazla 5 MB olabilir.');
  if (low.includes('mime') || low.includes('invalid_mime') || status === 415) return new AppError('Bu dosya türü desteklenmiyor (JPEG, PNG, WebP, GIF).');
  if (status === 401 || status === 403 || low.includes('row-level security') || low.includes('unauthorized')) return new AppError('Görsel yükleme yetkiniz yok. Yalnızca sahip ve içerik editörleri yükleyebilir.');
  if (status === 409 || low.includes('already exists')) return new AppError('Aynı adla bir görsel zaten var. Tekrar deneyin.');
  return new AppError('Görsel yüklenemedi. Lütfen tekrar deneyin.');
}

/**
 * Görseli yükler ve herkese açık adresini döner. İlerleme için XHR kullanılır
 * (Supabase Storage REST: POST /storage/v1/object/{bucket}/{path}); yetki kontrolünü depo RLS'i yapar.
 */
export async function uploadCardImage(file: File, path: string, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<string> {
  const err = validateCardImage(file);
  if (err) throw new AppError(err);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AppError('Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${CARD_BUCKET}/${encoded}`);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', supabaseKey);
    xhr.setRequestHeader('content-type', file.type);
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(uploadError(xhr.status, xhr.responseText)));
    xhr.onerror = () => reject(new AppError('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'));
    xhr.onabort = () => reject(new AppError('Yükleme iptal edildi.'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(file);
  });
  onProgress?.(100);
  return publicCardUrl(path);
}

/**
 * Bu depoya ait görselleri siler (en iyi çaba; hata fırlatmaz). Silinen dosya sayısını döner.
 * Veritabanı yazıldıktan sonra çağrılmalı: hâlâ başka bir sorunun media alanında geçen adresler silinmez
 * (ör. aynı görsel adresi başka bir karta yapıştırılmışsa). Kontrol yapılamazsa dosyaya dokunulmaz.
 */
export async function removeCardImages(urls: (string | null | undefined)[]): Promise<number> {
  const uniq = [...new Set(urls.filter((u): u is string => !!u && !!cardPathFromUrl(u)))];
  const paths: string[] = [];
  for (const u of uniq) {
    try {
      const r = await supabase.from('questions').select('id').filter('media', 'cs', JSON.stringify([u])).limit(1);
      if (!r.error && !(r.data ?? []).length) paths.push(cardPathFromUrl(u)!);
    } catch { /* kontrol edilemedi → silme */ }
  }
  if (!paths.length) return 0;
  let n = 0;
  for (let i = 0; i < paths.length; i += 100) {
    try {
      const r = await supabase.storage.from(CARD_BUCKET).remove(paths.slice(i, i + 100));
      if (!r.error) n += r.data?.length ?? 0;
    } catch { /* en iyi çaba */ }
  }
  return n;
}

/** questions.media değerini metin dizisine çevirir. */
export function normalizeMedia(m: unknown): string[] {
  return Array.isArray(m) ? m.map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'url' in x ? String((x as { url: unknown }).url ?? '') : '')) : [];
}

/** media dizisini seçenek sayısına hizalar (eksikler boş metin). */
export const alignMedia = (media: string[], n: number) => Array.from({ length: n }, (_, i) => media[i] ?? '');
