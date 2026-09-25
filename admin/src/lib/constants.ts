export type Role = 'owner' | 'moderator' | 'content' | 'support';
export type Engine =
  | 'truth_dare' | 'would_you_rather' | 'know_me' | 'challenges'
  | 'secret_questions' | 'this_or_that' | 'story' | 'chat_game';
export type Tone = 'ok' | 'warn' | 'bad' | 'pro' | 'rose' | 'mute';

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Sahip',
  moderator: 'Moderatör',
  content: 'İçerik editörü',
  support: 'Destek',
};
export const ROLE_TONE: Record<Role, Tone> = { owner: 'rose', moderator: 'pro', content: 'pro', support: 'mute' };

export const ENGINES: Engine[] = ['truth_dare', 'would_you_rather', 'know_me', 'challenges', 'secret_questions', 'this_or_that', 'story', 'chat_game'];
export const ENGINE_LABEL: Record<Engine, string> = {
  truth_dare: 'Doğruluk mu Cesaret mi',
  would_you_rather: 'Hangisini Tercih Edersin',
  know_me: 'Beni Ne Kadar Tanıyorsun',
  challenges: 'Çift Görevleri',
  secret_questions: 'Gizli Sorular',
  this_or_that: 'Bu mu Şu mu',
  story: 'Çift Hikâyesi',
  chat_game: 'Sohbet Oyunu',
};
export const ENGINE_SHORT: Record<Engine, string> = {
  truth_dare: 'DOĞRULUK / CESARET',
  would_you_rather: 'HANGİSİ',
  know_me: 'BENİ TANI',
  challenges: 'GÖREV',
  secret_questions: 'GİZLİ SORU',
  this_or_that: 'BU MU ŞU MU',
  story: 'HİKÂYE',
  chat_game: 'SOHBET OYUNU',
};
/** Sorular bölümünde yönetilen motorlar (görev ve hikâye hariç). */
export const QUESTION_ENGINES: Engine[] = ['truth_dare', 'would_you_rather', 'know_me', 'secret_questions', 'this_or_that', 'chat_game'];

export function optionCount(engine: Engine | undefined | null): number {
  if (engine === 'would_you_rather' || engine === 'this_or_that') return 2;
  if (engine === 'know_me') return 4;
  return 0;
}

export const LEVELS = [
  { v: 0, t: 'Yumuşak', tone: 'mute' as Tone },
  { v: 1, t: 'Flörtöz', tone: 'rose' as Tone },
  { v: 2, t: 'Cesur', tone: 'warn' as Tone },
  { v: 3, t: 'Vahşi', tone: 'bad' as Tone },
];
export const levelLabel = (v: number | null | undefined) => LEVELS.find((l) => l.v === v)?.t ?? '—';
export const levelTone = (v: number | null | undefined): Tone => LEVELS.find((l) => l.v === v)?.tone ?? 'mute';

export const MOODS = [
  { v: 'romantik', t: 'Romantik' },
  { v: 'eglenceli', t: 'Eğlenceli' },
  { v: 'flortoz', t: 'Flörtöz' },
  { v: 'cesur', t: 'Cesur' },
  { v: 'gizemli', t: 'Gizemli' },
  { v: 'karisik', t: 'Karışık' },
];
export const moodLabel = (v: string | null | undefined) => MOODS.find((m) => m.v === v)?.t ?? (v || '—');

export const FLIRT = [
  { floor: 0, name: 'Başlangıç' },
  { floor: 200, name: 'Meraklı' },
  { floor: 500, name: 'Flörtöz' },
  { floor: 1000, name: 'Yakın' },
  { floor: 2000, name: 'Durdurulamaz' },
];
export function flirtLevel(xp: number) {
  let i = 0;
  FLIRT.forEach((f, idx) => { if (xp >= f.floor) i = idx; });
  return { level: i + 1, name: FLIRT[i].name, next: FLIRT[i + 1]?.floor ?? null };
}

export const PLAN_LABEL: Record<string, string> = { monthly: 'AYLIK', yearly: 'YILLIK', lifetime: 'ÖMÜR BOYU', gift: 'HEDİYE' };
export const SUB_STATUS: Record<string, { t: string; tone: Tone }> = {
  trial: { t: 'DENEME', tone: 'warn' },
  active: { t: 'AKTİF', tone: 'ok' },
  canceled: { t: 'İPTAL', tone: 'bad' },
  expired: { t: 'SONA ERDİ', tone: 'mute' },
  billing_issue: { t: 'ÖDEME SORUNU', tone: 'bad' },
};
export const PAY_STATUS: Record<string, { t: string; tone: Tone }> = {
  paid: { t: 'ÖDENDİ', tone: 'ok' },
  failed: { t: 'BAŞARISIZ', tone: 'bad' },
  refunded: { t: 'İADE', tone: 'mute' },
  pending: { t: 'BEKLİYOR', tone: 'warn' },
};
export const REPORT_STATUS: Record<string, { t: string; tone: Tone }> = {
  open: { t: 'AÇIK', tone: 'warn' },
  in_review: { t: 'İNCELEMEDE', tone: 'pro' },
  resolved: { t: 'ÇÖZÜLDÜ', tone: 'ok' },
  dismissed: { t: 'REDDEDİLDİ', tone: 'mute' },
};
export const REPORT_PRIORITY: Record<string, { t: string; tone: Tone }> = {
  high: { t: 'YÜKSEK', tone: 'bad' },
  med: { t: 'ORTA', tone: 'warn' },
  low: { t: 'DÜŞÜK', tone: 'mute' },
};
export const REPORT_TYPE: Record<string, string> = {
  chat: 'Sohbet', photo: 'Fotoğraf', content: 'İçerik', account: 'Hesap', other: 'Diğer',
};
export const COUPLE_STATUS: Record<string, { t: string; tone: Tone }> = {
  active: { t: 'AKTİF', tone: 'ok' },
  pending: { t: 'BEKLEMEDE', tone: 'warn' },
  disconnected: { t: 'AYRILDI', tone: 'bad' },
};

export const ICON_SUGGESTIONS = [
  'favorite', 'local_fire_department', 'bolt', 'psychology', 'quiz', 'lock', 'visibility_off', 'style',
  'casino', 'playing_cards', 'swap_horiz', 'forum', 'chat_bubble', 'movie', 'auto_stories', 'nightlight',
  'wine_bar', 'spa', 'celebration', 'star', 'diamond', 'mood', 'sentiment_very_satisfied', 'theater_comedy',
  'emoji_objects', 'music_note', 'flight', 'restaurant', 'bed', 'kiss', 'favorite_border', 'heart_plus',
];
export const COLOR_SUGGESTIONS = ['#2A1530', '#3A1740', '#6B1E38', '#E7688A', '#F4B9C8', '#A88BF0', '#C9B8F7', '#7FD1AE', '#F2C27B', '#F07A7A', '#1F2A44', '#123A32'];
