// Postgres / PostgREST / Supabase Auth hatalarını anlaşılır Türkçe metne çevirir.
type AnyErr = { message?: string; code?: string; details?: string; hint?: string; status?: number } | null | undefined;

export class AppError extends Error {}

const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/;

export function trError(err: unknown): string {
  if (err instanceof AppError) return err.message;
  const e = (err ?? {}) as AnyErr & Record<string, unknown>;
  const msg = String(e?.message ?? (typeof err === 'string' ? err : '') ?? '');
  const code = String(e?.code ?? '');
  const low = msg.toLowerCase();

  if (!msg && !code) return 'Beklenmeyen bir hata oluştu.';

  // Ağ
  if (low.includes('failed to fetch') || low.includes('networkerror') || low.includes('load failed'))
    return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';

  // Auth
  if (low.includes('invalid login credentials')) return 'E-posta ya da şifre hatalı.';
  if (low.includes('email not confirmed')) return 'E-posta adresi henüz doğrulanmadı. Gelen kutunuzdaki bağlantıya tıklayın.';
  if (low.includes('user already registered') || low.includes('already been registered')) return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.';
  if (low.includes('password should be at least') || low.includes('password is too short')) return 'Şifre en az 6 karakter olmalı.';
  if (low.includes('weak password') || low.includes('password is known')) return 'Bu şifre çok zayıf. Daha güçlü bir şifre seçin.';
  if (low.includes('same_password') || low.includes('different from the old password')) return 'Yeni şifre eskisinden farklı olmalı.';
  if (low.includes('rate limit') || low.includes('too many requests') || e?.status === 429)
    return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.';
  if (low.includes('unable to validate email') || low.includes('invalid email') || low.includes('email address') && low.includes('invalid'))
    return 'Geçerli bir e-posta adresi girin.';
  if (low.includes('signups not allowed') || low.includes('signup is disabled')) return 'Yeni hesap oluşturma şu anda kapalı.';
  if (low.includes('jwt expired') || low.includes('refresh token')) return 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.';

  // Yetki
  if (code === '42501' || low.includes('row-level security') || low.includes('permission denied') || msg === 'Yetkisiz' || code === 'PGRST301')
    return 'Bu işlem için yetkiniz yok.';

  // Kısıtlar
  if (code === '23505') {
    if (low.includes('slug')) return 'Bu adla (kısa adla) bir kayıt zaten var. Farklı bir ad deneyin.';
    if (low.includes('couples_one_open')) return 'Kullanıcının zaten açık bir bağlantısı var.';
    return 'Bu kayıt zaten mevcut.';
  }
  if (code === '23503') return 'Bu kayıt başka verilere bağlı olduğu için işlem yapılamadı.';
  if (code === '23502') return 'Zorunlu bir alan boş bırakıldı.';
  if (code === '23514') {
    if (low.includes('text')) return 'Metin 2 ile 600 karakter arasında olmalı.';
    if (low.includes('timer')) return 'Süre 5 ile 3600 saniye arasında olmalı.';
    if (low.includes('rounds')) return 'Tur sayısı 1 ile 50 arasında olmalı.';
    if (low.includes('level')) return 'Seviye 0 ile 3 arasında olmalı.';
    if (low.includes('role')) return 'Geçersiz rol.';
    return 'Girilen değerlerden biri geçersiz.';
  }
  if (code === '22P02') return 'Geçersiz değer biçimi.';
  if (code === '22001') return 'Metin çok uzun.';
  if (code === 'PGRST116') return 'Kayıt bulunamadı.';
  if (code === 'PGRST202' || low.includes('could not find the function'))
    return 'Sunucu fonksiyonu bulunamadı. Veritabanı güncellemeleri henüz uygulanmamış olabilir.';
  if (code === 'PGRST205' || low.includes('could not find the table') || code === '42P01')
    return 'Veritabanı tablosu bulunamadı. Veritabanı güncellemeleri henüz uygulanmamış olabilir.';
  if (code === '42803' || code === '42702' || code === '42883') return 'Sunucu sorgusunda bir hata var (veritabanı fonksiyonu hatalı).';
  if (code === '57014') return 'Sorgu zaman aşımına uğradı. Filtreleri daraltıp tekrar deneyin.';

  // Sunucunun Türkçe mesajları (raise exception)
  if (code === 'P0001' || TR_CHARS.test(msg)) return msg;
  if (low.includes('permission') || low.includes('not allowed')) return 'Bu işlem için yetkiniz yok.';
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}

