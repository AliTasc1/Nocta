import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApp } from '@/providers/AppProvider';
import { supabase } from './supabase';

/**
 * Sevgiliye Mektup — veri katmanı.
 * RLS: gönderen kendi mektuplarını her zaman, alıcı yalnızca teslim edildikten sonra görür.
 * Teslim: send_letter (anında) ya da her dakika çalışan pg_cron işi (ileri tarihli).
 */
export type Paper = 'cream' | 'rose' | 'night';

export type Letter = {
  id: string;
  couple_id: string;
  sender_id: string;
  recipient_id: string;
  reply_to: string | null;
  body: string;
  paper: Paper;
  deliver_at: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};

export const LETTER_MAX = 8000;

/** Kâğıt temaları: zemin, çizgi, mürekkep, kenar boşluğu çizgisi */
export const PAPERS: Record<Paper, { name: string; bg: string; bgDeep: string; line: string; margin: string; ink: string; inkSoft: string; back: string; edge: string }> = {
  cream: { name: 'Krem', bg: '#F4E9D2', bgDeep: '#E8D6B4', line: 'rgba(92,120,168,.26)', margin: 'rgba(200,80,90,.38)', ink: '#2B2340', inkSoft: 'rgba(43,35,64,.55)', back: '#EADBBC', edge: '#D9C39A' },
  rose: { name: 'Gül', bg: '#F6DCDD', bgDeep: '#EBC3C6', line: 'rgba(160,70,95,.22)', margin: 'rgba(170,50,80,.34)', ink: '#4A1A2C', inkSoft: 'rgba(74,26,44,.55)', back: '#EDCACC', edge: '#DDAAB0' },
  night: { name: 'Gece', bg: '#1C2140', bgDeep: '#141832', line: 'rgba(170,185,255,.16)', margin: 'rgba(231,104,138,.34)', ink: '#EDE6FF', inkSoft: 'rgba(237,230,255,.6)', back: '#232849', edge: '#343B66' },
};

export const PAPER_KEYS: Paper[] = ['cream', 'rose', 'night'];

export function isPaper(p: unknown): p is Paper {
  return p === 'cream' || p === 'rose' || p === 'night';
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const pad2 = (n: number) => String(n).padStart(2, '0');

export function hhmm(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "bugün 21:30", "yarın 09:00", "3 Ekim Cumartesi 09:00", yıl farklıysa yıl da */
export function whenLabel(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const now = new Date();
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((dayD - day0) / 86400000);
  if (diff === 0) return `bugün ${hhmm(d)}`;
  if (diff === 1) return `yarın ${hhmm(d)}`;
  if (diff === -1) return `dün ${hhmm(d)}`;
  const y = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${AYLAR[d.getMonth()]}${y} ${GUNLER[d.getDay()]} ${hhmm(d)}`;
}

/** Kâğıdın köşesine yazılan tarih: "28 Eylül 2026" */
export function paperDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

export function dayLabel(d: Date): string {
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${GUNLER[d.getDay()]}`;
}

export { AYLAR as MONTHS_TR_LETTERS };

/** Yönelme hâli: "Deniz'e", "Ayşe'ye", "Alp'a", "Kuzu'ya" */
export function dative(name: string): string {
  const n = name.trim();
  if (!n) return 'Partnerine';
  const low = n.toLocaleLowerCase('tr-TR');
  const vowels = low.match(/[aıoueiöü]/g);
  const last = vowels ? vowels[vowels.length - 1] : 'e';
  const back = 'aıou'.includes(last);
  const endsVowel = /[aıoueiöü]$/.test(low);
  return `${n}'${endsVowel ? 'y' : ''}${back ? 'a' : 'e'}`;
}

/** Ayrılma hâli: "Deniz'den", "Alp'tan", "Ayşe'den" */
export function ablative(name: string): string {
  const n = name.trim();
  if (!n) return 'Partnerinden';
  const low = n.toLocaleLowerCase('tr-TR');
  const vowels = low.match(/[aıoueiöü]/g);
  const last = vowels ? vowels[vowels.length - 1] : 'e';
  const back = 'aıou'.includes(last);
  const hard = /[çfhkpsşt]$/.test(low);
  return `${n}'${hard ? 't' : 'd'}${back ? 'a' : 'e'}n`;
}

export type LetterStatus = 'sea' | 'arrived' | 'read';
export function statusOf(l: Letter): LetterStatus {
  if (!l.delivered_at) return 'sea';
  return l.read_at ? 'read' : 'arrived';
}

/** Mektubun ilk anlamlı satırı (liste önizlemesi) */
export function previewOf(body: string, max = 120): string {
  const s = body.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

// ─────────────────────────────────────────────────────────────
// RPC'ler
// ─────────────────────────────────────────────────────────────
export async function sendLetter(p: { body: string; deliverAt: Date | null; replyTo: string | null; paper: Paper }) {
  const { data, error } = await supabase.rpc('send_letter', {
    p_body: p.body,
    p_deliver_at: p.deliverAt ? p.deliverAt.toISOString() : null,
    p_reply_to: p.replyTo,
    p_paper: p.paper,
  });
  if (error) throw error;
  return data as Letter;
}

export async function cancelLetter(id: string) {
  const { error } = await supabase.rpc('cancel_letter', { p_id: id });
  if (error) throw error;
}

export async function markLetterRead(id: string) {
  const { error } = await supabase.rpc('mark_letter_read', { p_id: id });
  if (error) throw error;
}

export async function fetchLetter(id: string): Promise<Letter | null> {
  const { data } = await supabase.from('letters').select('*').eq('id', id).maybeSingle();
  return (data as Letter) ?? null;
}

// ─────────────────────────────────────────────────────────────
// Posta kutusu (realtime ile güncel)
// ─────────────────────────────────────────────────────────────
export function useLetters() {
  const { userId, couple } = useApp();
  const cid = couple?.id ?? null;
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!cid) {
      setLetters([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('letters').select('*').eq('couple_id', cid).order('created_at', { ascending: false }).limit(300);
    setLetters(((data as Letter[]) ?? []).filter(Boolean));
    setLoading(false);
  }, [cid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!cid || !userId) return;
    const ch = supabase
      .channel(`letters:${cid}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters', filter: `couple_id=eq.${cid}` }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cid, userId, load]);

  return { letters, loading, reload: load, setLetters };
}

/** Okunmamış (teslim edilmiş) gelen mektup sayısı — oyun kartındaki mühür rozeti için */
export function useUnreadLetters(): number {
  const { userId, couple } = useApp();
  const active = couple?.status === 'active';
  const [n, setN] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId || !active) return setN(0);
    const { count } = await supabase
      .from('letters')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .not('delivered_at', 'is', null)
      .is('read_at', null);
    if (alive.current) setN(count ?? 0);
  }, [userId, active]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!userId || !active) return;
    const ch = supabase
      .channel(`letters-unread:${userId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters', filter: `recipient_id=eq.${userId}` }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, active, load]);

  return n;
}

// Taslak (gönderilmemiş mektup) cihazda saklanır
export const draftKey = (replyTo: string | null) => `nocta.letter.draft.${replyTo ?? 'new'}`;
