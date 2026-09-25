import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Couple, Profile, ProfileSettings } from '@/lib/types';

type AppCtx = {
  /** İlk oturum kontrolü bitti mi */
  ready: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  /** Açık (bekleyen ya da aktif) oda */
  couple: Couple | null;
  partner: Profile | null;
  isPremium: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  refreshProfile: () => Promise<void>;
  refreshCouple: () => Promise<void>;
  refreshPremium: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  updateSettings: (patch: Partial<ProfileSettings>) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp, AppProvider içinde kullanılmalı');
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const userId = session?.user.id ?? null;
  const coupleRef = useRef<Couple | null>(null);
  useEffect(() => {
    coupleRef.current = couple;
  }, [couple]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return setProfile(null);
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, [userId]);

  const refreshCouple = useCallback(async () => {
    if (!userId) {
      setCouple(null);
      setPartner(null);
      return;
    }
    const { data } = await supabase
      .from('couples')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const c = (data as Couple) ?? null;
    setCouple(c);
    const pid = c ? (c.user_a === userId ? c.user_b : c.user_a) : null;
    if (pid && c?.status === 'active') {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', pid).maybeSingle();
      setPartner((p as Profile) ?? null);
    } else {
      setPartner(null);
    }
  }, [userId]);

  const refreshPremium = useCallback(async () => {
    if (!userId) return setIsPremium(false);
    const { data } = await supabase.rpc('i_am_premium');
    setIsPremium(Boolean(data));
  }, [userId]);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    const { count: n } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    setUnreadNotifications(n ?? 0);
    const c = coupleRef.current;
    if (c?.status === 'active') {
      const { count: m } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', c.id)
        .neq('sender_id', userId)
        .is('read_at', null);
      setUnreadMessages(m ?? 0);
    } else {
      setUnreadMessages(0);
    }
  }, [userId]);

  // Oturum
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Kullanıcı değişince her şeyi yükle
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setCouple(null);
      setPartner(null);
      setIsPremium(false);
      return;
    }
    let alive = true;
    (async () => {
      await Promise.all([refreshProfile(), refreshCouple(), refreshPremium()]);
      supabase.rpc('touch_last_seen').then(() => {});
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [userId, refreshProfile, refreshCouple, refreshPremium]);

  useEffect(() => {
    refreshUnread();
  }, [couple?.id, couple?.status, refreshUnread]);

  // Gerçek zamanlı: profil, oda, bildirim, mesaj
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`app:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couples' }, () => {
        refreshCouple();
        refreshPremium();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const row = p.new as Profile;
        if (row.id === userId) setProfile(row);
        else setPartner((cur) => (cur && cur.id === row.id ? row : cur));
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => refreshUnread(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, refreshCouple, refreshPremium, refreshUnread]);

  useEffect(() => {
    if (!userId || couple?.status !== 'active') return;
    const ch = supabase
      .channel(`unread:${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `couple_id=eq.${couple.id}` },
        () => refreshUnread(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, couple?.id, couple?.status, refreshUnread]);

  // Ön plana dönünce tazele
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && userId) {
        refreshCouple();
        refreshPremium();
        refreshUnread();
        supabase.rpc('touch_last_seen').then(() => {});
      }
    });
    return () => sub.remove();
  }, [userId, refreshCouple, refreshPremium, refreshUnread]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!userId) return;
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single();
      if (error) throw error;
      setProfile(data as Profile);
    },
    [userId],
  );

  const updateSettings = useCallback(
    async (patch: Partial<ProfileSettings>) => {
      if (!profile) return;
      await updateProfile({ settings: { ...profile.settings, ...patch } });
    },
    [profile, updateProfile],
  );

  const signOut = useCallback(async () => {
    if (userId) await supabase.from('profiles').update({ expo_push_token: null }).eq('id', userId);
    await supabase.auth.signOut();
  }, [userId]);

  const value = useMemo<AppCtx>(
    () => ({
      ready,
      session,
      userId,
      profile,
      couple,
      partner,
      isPremium,
      unreadNotifications,
      unreadMessages,
      refreshProfile,
      refreshCouple,
      refreshPremium,
      refreshUnread,
      updateProfile,
      updateSettings,
      signOut,
    }),
    [ready, session, userId, profile, couple, partner, isPremium, unreadNotifications, unreadMessages,
      refreshProfile, refreshCouple, refreshPremium, refreshUnread, updateProfile, updateSettings, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
