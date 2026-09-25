import { useCallback, useEffect, useRef, useState } from 'react';
import { AppError } from './errors';

/** Basit veri yükleme kancası: loading / error / reload / setData. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (silent = false) => {
    const my = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const r = await fnRef.current();
      if (my === seq.current) { setData(r); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => { run(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, error, loading, reload: run };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Supabase yanıtını açar; hata varsa fırlatır. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

/**
 * RLS nedeniyle sessizce 0 satır etkilenen güncellemeleri yakalar.
 * Güncelleme/silme sorgusunun sonuna .select('id') eklenmiş olmalı.
 */
export function mustAffect<T>(res: { data: T[] | null; error: unknown }, expected = 1): T[] {
  if (res.error) throw res.error;
  const rows = res.data ?? [];
  if (rows.length < Math.min(expected, 1)) throw new AppError('Değişiklik kaydedilemedi: bu işlem için yetkiniz yok ya da kayıt bulunamadı.');
  return rows;
}

/** Sayfalı PostgREST sorgusu ile tüm satırları getirir (üst sınırlı). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 20000,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += size) {
    const res = await page(from, from + size - 1);
    if (res.error) throw res.error;
    const rows = res.data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Postgrest ilike için özel karakterleri kaçırır. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c).replace(/[,()]/g, ' ');

// ── CSV ────────────────────────────────────────────────────────
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** RFC4180'e yakın CSV ayrıştırıcı (virgül veya noktalı virgül). */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}
