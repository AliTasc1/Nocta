// Türkçe tarih/saat biçimlendirme yardımcıları
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 45) return 'şimdi';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  const days = Math.round(h / 24);
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  return shortDate(iso);
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function upperDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return `BU GECE · ${clock(iso)}`;
  }
  return shortDate(iso).toLocaleUpperCase('tr-TR');
}

export function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function hms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "2 ay", "3 yıl" gibi birliktelik süresi */
export function together(sinceIso: string | null | undefined): string {
  if (!sinceIso) return '';
  const days = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 86400000));
  if (days < 1) return 'bugün';
  if (days < 30) return `${days} gün`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay`;
  return `${Math.floor(months / 12)} yıl`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

export function ageFrom(birth: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

/** Son 10 dakikada görüldüyse çevrimiçi say */
export function isOnline(lastSeen: string | null | undefined): boolean {
  return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000;
}
