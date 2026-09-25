import { supabase } from './supabase';
import { fetchAll } from './data';

export type Analytics = {
  dau: number; wau: number; mau: number;
  started_30: number; completed_30: number; avg_minutes: number;
  retention_w4: number; challenge_rate: number; premium_conversion: number;
  weekly: { week: string; active: number; games: number }[];
  cohorts: { month: string; size: number; weeks: (number | null)[] }[];
  funnel: { started: number; completed: number; repeat: number; premium: number };
  games: { id: string; name: string; plays_30: number; completion: number | null }[];
  source: 'rpc' | 'client';
  rpcError?: unknown;
};

const DAY = 86400000;
const WEEK = 7 * DAY;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Pazartesi 00:00 (UTC) — Postgres date_trunc('week', now()) ile aynı. */
function weekStartUtc(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  return new Date(x.getTime() - dow * DAY);
}
const monthKey = (iso: string) => iso.slice(0, 7) + '-01';

async function headCount(q: PromiseLike<{ count: number | null; error: unknown }>) {
  const r = await q;
  if (r.error) throw r.error;
  return r.count ?? 0;
}

/**
 * Sunucudaki admin_analytics() çağrılır; başarısız olursa (ör. SQL hatası) aynı metrikler
 * yönetici RLS yetkisiyle istemci tarafında hesaplanır.
 */
export async function loadAnalytics(): Promise<Analytics> {
  const rpc = await supabase.rpc('admin_analytics');
  if (!rpc.error && rpc.data) return { ...(rpc.data as Omit<Analytics, 'source'>), source: 'rpc' };
  const code = (rpc.error as { code?: string } | null)?.code;
  if (code === '42501' || (rpc.error as { message?: string } | null)?.message === 'Yetkisiz') throw rpc.error;
  const res = await computeClient();
  return { ...res, source: 'client', rpcError: rpc.error };
}

async function computeClient(): Promise<Omit<Analytics, 'source'>> {
  const now = new Date();
  const iso = (ms: number) => new Date(ms).toISOString();
  const t = now.getTime();
  const wk0 = weekStartUtc(now).getTime() - 11 * WEEK;
  const sixMonths = new Date(now); sixMonths.setUTCMonth(sixMonths.getUTCMonth() - 6);
  const sessionsFrom = Math.min(wk0, sixMonths.getTime());

  const [dau, wau, mau, activeCouples] = await Promise.all([
    headCount(supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('last_seen_at', iso(t - DAY))),
    headCount(supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('last_seen_at', iso(t - 7 * DAY))),
    headCount(supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('last_seen_at', iso(t - 30 * DAY))),
    headCount(supabase.from('couples').select('id', { count: 'exact', head: true }).eq('status', 'active')),
  ]);

  type S = { couple_id: string; game_id: string; status: string; created_at: string; started_at: string | null; finished_at: string | null };
  const [sessions, couples, completions, subs, games, answers] = await Promise.all([
    fetchAll<S>((f, to) => supabase.from('game_sessions').select('couple_id,game_id,status,created_at,started_at,finished_at').gte('created_at', iso(sessionsFrom)).order('created_at').range(f, to), 60000),
    fetchAll<{ id: string; connected_at: string }>((f, to) => supabase.from('couples').select('id,connected_at').gt('connected_at', iso(Math.min(sixMonths.getTime(), t - 35 * DAY))).range(f, to), 60000),
    fetchAll<{ skipped: boolean }>((f, to) => supabase.from('challenge_completions').select('skipped').gt('day', new Date(t - 30 * DAY).toISOString().slice(0, 10)).range(f, to), 60000),
    fetchAll<{ couple_id: string | null; status: string; expires_at: string | null }>((f, to) => supabase.from('subscriptions').select('couple_id,status,expires_at').in('status', ['trial', 'active', 'canceled']).range(f, to), 60000),
    fetchAll<{ id: string; name: string; sort: number }>((f, to) => supabase.from('games').select('id,name,sort').order('sort').range(f, to)),
    fetchAll<{ user_id: string; created_at: string }>((f, to) => supabase.from('session_answers').select('user_id,created_at').gte('created_at', iso(wk0)).range(f, to), 60000).catch(() => null),
  ]);

  const in30 = sessions.filter((s) => new Date(s.created_at).getTime() > t - 30 * DAY);
  const started_30 = in30.filter((s) => s.status !== 'canceled').length;
  const completed_30 = in30.filter((s) => s.status === 'finished').length;
  const durations = sessions
    .filter((s) => s.status === 'finished' && s.started_at && s.finished_at && new Date(s.finished_at).getTime() > t - 30 * DAY)
    .map((s) => (new Date(s.finished_at!).getTime() - new Date(s.started_at!).getTime()) / 60000);
  const avg_minutes = durations.length ? round1(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const byCouple = new Map<string, number[]>();
  sessions.forEach((s) => { const a = byCouple.get(s.couple_id) ?? []; a.push(new Date(s.created_at).getTime()); byCouple.set(s.couple_id, a); });

  const w4 = couples.filter((c) => { const x = new Date(c.connected_at).getTime(); return x >= t - 35 * DAY && x <= t - 28 * DAY; });
  const w4Active = w4.filter((c) => (byCouple.get(c.id) ?? []).some((x) => x > t - 7 * DAY)).length;
  const retention_w4 = w4.length ? round1((100 * w4Active) / w4.length) : 0;

  const challenge_rate = completions.length ? round1((100 * completions.filter((c) => !c.skipped).length) / completions.length) : 0;
  const validSubs = subs.filter((s) => !s.expires_at || new Date(s.expires_at).getTime() > t);
  const premiumCouples = new Set(validSubs.map((s) => s.couple_id).filter(Boolean)).size;
  const premium_conversion = activeCouples ? round1((100 * premiumCouples) / activeCouples) : 0;

  const weekly = Array.from({ length: 12 }, (_, i) => {
    const from = wk0 + i * WEEK; const to = from + WEEK;
    const users = new Set<string>();
    answers?.forEach((a) => { const x = new Date(a.created_at).getTime(); if (x >= from && x < to) users.add(a.user_id); });
    return {
      week: new Date(from).toISOString().slice(0, 10),
      active: users.size,
      games: sessions.filter((s) => { const x = new Date(s.created_at).getTime(); return x >= from && x < to && s.status !== 'canceled'; }).length,
    };
  });

  const recent = couples.filter((c) => new Date(c.connected_at).getTime() > sixMonths.getTime());
  const months = [...new Set(recent.map((c) => monthKey(c.connected_at)))].sort();
  const cohorts = months.map((m) => {
    const members = recent.filter((c) => monthKey(c.connected_at) === m);
    const weeks = Array.from({ length: 6 }, (_, w) => {
      const eligible = members.filter((c) => new Date(c.connected_at).getTime() + w * WEEK < t);
      if (!eligible.length) return null;
      const hit = eligible.filter((c) => {
        const from = new Date(c.connected_at).getTime() + w * WEEK; const to = from + WEEK;
        return (byCouple.get(c.id) ?? []).some((x) => x >= from && x < to);
      }).length;
      return Math.round((100 * hit) / eligible.length);
    });
    return { month: m, size: members.length, weeks };
  });

  const last7 = new Map<string, number>();
  sessions.forEach((s) => { if (s.status === 'finished' && new Date(s.created_at).getTime() > t - 7 * DAY) last7.set(s.couple_id, (last7.get(s.couple_id) ?? 0) + 1); });
  const funnel = { started: started_30, completed: completed_30, repeat: [...last7.values()].filter((n) => n >= 2).length, premium: premiumCouples };

  const gameStats = games.map((g) => {
    const gs = sessions.filter((s) => s.game_id === g.id);
    const plays_30 = gs.filter((s) => s.status !== 'canceled' && new Date(s.created_at).getTime() > t - 30 * DAY).length;
    const played = gs.filter((s) => s.status !== 'canceled' && s.status !== 'lobby');
    return { id: g.id, name: g.name, plays_30, completion: played.length ? Math.round((100 * played.filter((s) => s.status === 'finished').length) / played.length) : null };
  });

  return { dau, wau, mau, started_30, completed_30, avg_minutes, retention_w4, challenge_rate, premium_conversion, weekly, cohorts, funnel, games: gameStats };
}
