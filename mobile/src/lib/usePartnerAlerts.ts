import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { presentLocalAlert, setRealtimeLive } from './alerts';
import { supabase } from './supabase';
import type { AppNotification, Message } from './types';

/** Gizlilik ayarı açıkken mesaj önizlemesi yerine gösterilen metin */
export const BLURRED_PREVIEW = 'Yeni bir mesajın var ♡';

function sessionIdFromRoute(route: string | null | undefined): string | null {
  const m = typeof route === 'string' ? route.match(/^\/lobby\/([^/?#]+)/) : null;
  return m ? m[1] : null;
}

/**
 * "Partner çağrısı" katmanı: Supabase Realtime ile
 *   1) bana yazılan `notifications` satırlarını (oyun daveti, görev, rozet…),
 *   2) partnerin gönderdiği `messages` satırlarını (metin / fotoğraf)
 * dinler ve her olayda ANINDA sesli bir yerel bildirim gösterir (+ titreşim).
 *
 * - Sohbet ekranındayken sohbet bildirimleri, o oyunun lobisinde/oyununda iken
 *   o oyunun daveti atlanır.
 * - Görev/ekran görüntüsü mesajları için sunucu zaten bir `notifications` satırı
 *   yazdığından mesaj kanalında yalnızca metin ve fotoğraf bildirilir (çift olmasın).
 * - Realtime yalnızca uygulama süreci canlıyken çalışır; uygulama tamamen kapalıyken
 *   uzak push gerekir (EAS projectId + geliştirme/mağaza derlemesi, bkz. lib/alerts.ts).
 *
 * `onInvite`: partner yeni bir oyun başlattığında (uygulama açıkken) çağrılır.
 */
export function usePartnerAlerts(onInvite?: (sessionId: string) => void) {
  const { userId, couple, partner, profile } = useApp();
  const toast = useToast();
  const pathname = usePathname();
  const cid = couple?.status === 'active' ? couple.id : null;

  // Olay geri çağrılarında her zaman güncel değerleri okumak için
  const live = useRef({ pathname, partner, profile, toast, onInvite });
  useEffect(() => {
    live.current = { pathname, partner, profile, toast, onInvite };
  }, [pathname, partner, profile, toast, onInvite]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;

    const alert = async (a: { id: string; title: string; body: string; route: string | null; kind: string }) => {
      if (seen.current.has(a.id)) return;
      seen.current.add(a.id);
      const { profile: me, toast: t } = live.current;
      if (me?.settings?.notifications === false) return;
      const foreground = AppState.currentState === 'active';
      if (foreground) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      const shown = await presentLocalAlert({ title: a.title, body: a.body, route: a.route, kind: a.kind, sourceId: a.id });
      // Sistem bildirimi gösterilemediyse (izin yok / web) uygulama içinde göster.
      // Davet için zaten tam ekran "çağrı" kartı açılır.
      if (!shown && foreground && a.kind !== 'invite') t.show(a.body ? `${a.title} · ${a.body}` : a.title, 'info');
    };

    const onNotification = (n: AppNotification) => {
      const route = typeof n.data?.route === 'string' ? (n.data.route as string) : null;
      const here = live.current.pathname;
      if (n.kind === 'invite') {
        const sid = sessionIdFromRoute(route);
        if (sid) {
          live.current.onInvite?.(sid);
          // Zaten o oyunun lobisinde / oyununda
          if (here === `/lobby/${sid}` || here === `/play/${sid}`) return;
        }
      } else if (route === '/chat' && here === '/chat') {
        return;
      } else if (route?.startsWith('/letters/') && here === route) {
        return; // o mektup zaten açık
      }
      // Mektup teslimi hem `notifications` hem `letters` kanalından gelir: aynı kimlikle tek bildirim
      const letterId = typeof n.data?.letter_id === 'string' ? (n.data.letter_id as string) : null;
      alert({ id: letterId ? `l:${letterId}` : `n:${n.id}`, title: n.title, body: n.body ?? '', route, kind: n.kind });
    };

    const ch = supabase
      .channel(`alerts:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => onNotification(p.new as AppNotification),
      );

    if (cid) {
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${cid}` }, (p) => {
        const m = p.new as Message;
        if (!m || m.sender_id === userId) return;
        if (m.kind !== 'text' && m.kind !== 'photo') return; // görev / ekran görüntüsü → notifications satırı
        if (live.current.pathname === '/chat') return; // sohbet zaten açık
        const { partner: pa, profile: me } = live.current;
        const blur = me?.settings?.blur_previews ?? true;
        const body = blur ? BLURRED_PREVIEW : m.kind === 'photo' ? '📷 Fotoğraf' : (m.body ?? '').slice(0, 120);
        alert({ id: `m:${m.id}`, title: pa?.display_name || 'Nocta', body, route: '/chat', kind: 'message' });
      });
    }

    // Sevgiliye Mektup: bana bir mektup teslim edildiğinde (anında ya da zamanı gelince)
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'letters', filter: `recipient_id=eq.${userId}` }, (p) => {
      const l = p.new as { id?: string; delivered_at?: string | null; read_at?: string | null } | null;
      if (!l?.id || !l.delivered_at || l.read_at) return;
      const route = `/letters/${l.id}`;
      if (live.current.pathname === route) return;
      const name = live.current.partner?.display_name || 'Partnerin';
      alert({ id: `l:${l.id}`, title: '💌 Bir mektubun var', body: `${name} sana okyanusun öbür ucundan bir mektup gönderdi.`, route, kind: 'letter' });
    });

    ch.subscribe((status) => setRealtimeLive(status === 'SUBSCRIBED'));
    return () => {
      setRealtimeLive(false);
      supabase.removeChannel(ch);
    };
  }, [userId, cid]);
}
