const nf = new Intl.NumberFormat('tr-TR');
const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const cf = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cf0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });

export const num = (v: number | string | null | undefined) => (v == null || v === '' ? '—' : nf.format(Number(v)));
export const num1 = (v: number | string | null | undefined) => (v == null || v === '' ? '—' : nf1.format(Number(v)));
export const money = (v: number | string | null | undefined) => (v == null ? '—' : cf.format(Number(v)));
export const money0 = (v: number | string | null | undefined) => (v == null ? '—' : cf0.format(Number(v)));
export const short = (v: number | string | null | undefined) => {
  if (v == null) return '—';
  const n = Number(v);
  return Math.abs(n) >= 10000 ? compact.format(n) : nf.format(n);
};
export const shortMoney = (v: number | string | null | undefined) => {
  if (v == null) return '—';
  const n = Number(v);
  return Math.abs(n) >= 100000 ? '₺' + compact.format(n) : money0(n);
};
/** Türkçe yüzde biçimi: %12,5 */
export const pct = (v: number | string | null | undefined, digits = 1) => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  return '%' + new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(Number(v));
};

const d = (v: string | Date) => (v instanceof Date ? v : new Date(v));
export const date = (v: string | Date | null | undefined) =>
  v ? d(v).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const dateShort = (v: string | Date | null | undefined) =>
  v ? d(v).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—';
export const dateTime = (v: string | Date | null | undefined) => {
  if (!v) return '—';
  const x = d(v);
  const sameYear = x.getFullYear() === new Date().getFullYear();
  return x.toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const monthShort = (v: string | Date) => d(v).toLocaleDateString('tr-TR', { month: 'short' });
export const monthYear = (v: string | Date) => d(v).toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });

export function relTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const t = d(v).getTime();
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (diff < 0) return dateTime(v);
  if (min < 1) return 'Az önce';
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} sa önce`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'Dün';
  if (days < 30) return `${days} gün önce`;
  return date(v);
}

export function duration(from: string | Date | null | undefined): string {
  if (!from) return '—';
  const days = Math.floor((Date.now() - d(from).getTime()) / 86400000);
  if (days < 1) return 'Bugün';
  if (days < 30) return `${days} gün`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} ay`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} yıl ${rest} ay` : `${years} yıl`;
}

export function delta(cur: number, prev: number, unit = 'dünle'): { t: string; c: string } {
  if (!prev && !cur) return { t: `— ${unit} aynı`, c: '#B3A2AA' };
  if (!prev) return { t: `▲ yeni`, c: '#7FD1AE' };
  const p = ((cur - prev) / prev) * 100;
  if (Math.abs(p) < 0.05) return { t: `— ${unit} aynı`, c: '#B3A2AA' };
  return { t: `${p > 0 ? '▲' : '▼'} ${pct(Math.abs(p))}`, c: p > 0 ? '#7FD1AE' : '#F07A7A' };
}

export function initials(name: string | null | undefined): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toLocaleUpperCase('tr-TR');
}

export function slugify(s: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıiöşüâîû]/g, (c) => map[c] ?? c)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'oyun';
}

export const trUpper = (s: string) => s.toLocaleUpperCase('tr-TR');
