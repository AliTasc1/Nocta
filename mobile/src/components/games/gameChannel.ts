import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * `game:<sessionId>` Realtime kanalı — presence (kim çevrimiçi) ve broadcast
 * (geçici olaylar: "cevapladı", "yazıyor", süre başlatıldı…).
 *
 * supabase-js aynı topic için tek bir kanal nesnesi tutar ve kanalı topic adına göre
 * siler. Lobi → oyun geçişinde iki ekran aynı kanalı aynı anda isteyebildiği için kanal
 * burada referans sayımıyla paylaşılır; son kullanıcı ayrıldıktan kısa süre sonra kapatılır.
 */
export type ChannelListener = {
  onPresence?: (onlineUserIds: string[]) => void;
  onBroadcast?: (event: string, payload: Record<string, any>) => void;
  /** Partner kanala (yeniden) katıldığında — kaçırdığı durumları tekrar yayınlamak için */
  onJoin?: (userId: string) => void;
  onStatus?: (status: string) => void;
};

type Entry = {
  topic: string;
  userId: string;
  ch: RealtimeChannel | null;
  listeners: Set<ChannelListener>;
  online: string[];
  closeTimer: ReturnType<typeof setTimeout> | null;
  closing: Promise<unknown> | null;
  joined: boolean;
};

const pool = new Map<string, Entry>();

function onlineIds(ch: RealtimeChannel): string[] {
  const state = ch.presenceState() as Record<string, unknown[]>;
  return Object.keys(state).filter((k) => (state[k]?.length ?? 0) > 0);
}

function open(entry: Entry) {
  const ch = supabase.channel(entry.topic, {
    config: { presence: { key: entry.userId }, broadcast: { self: false, ack: false } },
  });
  entry.ch = ch;
  ch.on('presence', { event: 'sync' }, () => {
    entry.online = onlineIds(ch);
    entry.listeners.forEach((l) => l.onPresence?.(entry.online));
  });
  ch.on('presence', { event: 'join' }, ({ key }) => {
    if (key && key !== entry.userId) entry.listeners.forEach((l) => l.onJoin?.(key));
  });
  ch.on('broadcast', { event: '*' }, (msg: { event: string; payload?: Record<string, any> }) => {
    entry.listeners.forEach((l) => l.onBroadcast?.(msg.event, msg.payload ?? {}));
  });
  ch.subscribe((status) => {
    entry.joined = status === 'SUBSCRIBED';
    if (status === 'SUBSCRIBED') {
      ch.track({ at: Date.now() }).catch(() => {});
    }
    entry.listeners.forEach((l) => l.onStatus?.(status));
  });
}

export function joinGameChannel(sessionId: string, userId: string, listener: ChannelListener) {
  const topic = `game:${sessionId}`;
  let entry = pool.get(topic);
  if (entry && entry.userId !== userId) {
    // farklı hesap: eskisini hemen kapat
    if (entry.ch) supabase.removeChannel(entry.ch).catch(() => {});
    pool.delete(topic);
    entry = undefined;
  }
  if (!entry) {
    entry = { topic, userId, ch: null, listeners: new Set(), online: [], closeTimer: null, closing: null, joined: false };
    pool.set(topic, entry);
    // Bir önceki kapanış hâlâ sürüyorsa bitmesini bekle (aynı topic'li kanal nesnesi tekrar kullanılmasın)
    const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
    const e = entry;
    if (stale) {
      supabase
        .removeChannel(stale)
        .catch(() => {})
        .finally(() => {
          if (pool.get(topic) === e && !e.ch) open(e);
        });
    } else {
      open(entry);
    }
  }
  if (entry.closeTimer) {
    clearTimeout(entry.closeTimer);
    entry.closeTimer = null;
  }
  entry.listeners.add(listener);
  if (entry.online.length) listener.onPresence?.(entry.online);
  const e = entry;

  return {
    send(event: string, payload: Record<string, any> = {}) {
      if (!e.ch || !e.joined) return;
      e.ch.send({ type: 'broadcast', event, payload: { ...payload, from: userId } }).catch(() => {});
    },
    /** Uygulama ön plana dönünce presence'ı tazele */
    retrack() {
      if (e.ch && e.joined) e.ch.track({ at: Date.now() }).catch(() => {});
    },
    leave() {
      e.listeners.delete(listener);
      if (e.listeners.size > 0) return;
      if (e.closeTimer) clearTimeout(e.closeTimer);
      e.closeTimer = setTimeout(() => {
        if (e.listeners.size > 0) return;
        if (pool.get(topic) === e) pool.delete(topic);
        if (e.ch) {
          const ch = e.ch;
          e.ch = null;
          ch.untrack().catch(() => {});
          supabase.removeChannel(ch).catch(() => {});
        }
      }, 1500);
    },
  };
}

export type GameChannelHandle = ReturnType<typeof joinGameChannel>;
