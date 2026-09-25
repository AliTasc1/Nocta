import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role } from '../lib/constants';

export type AdminRow = { user_id: string; email: string; display_name: string; role: Role; active: boolean; last_login_at: string | null; created_at: string };

type Status = 'loading' | 'signed_out' | 'checking' | 'admin' | 'denied' | 'inactive' | 'error' | 'recovery';

export type Perms = {
  content: boolean; reports: boolean; subs: boolean; payments: boolean; admins: boolean;
  deleteUser: boolean; settings: boolean; moderateUsers: boolean;
};

type Ctx = {
  status: Status;
  session: Session | null;
  admin: AdminRow | null;
  error: string | null;
  perms: Perms;
  role: Role | null;
  signOut: () => Promise<void>;
  recheck: () => void;
  finishRecovery: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function permsFor(role: Role | null): Perms {
  const r = role;
  return {
    content: r === 'owner' || r === 'content',
    reports: r === 'owner' || r === 'moderator' || r === 'support',
    subs: r === 'owner' || r === 'support',
    payments: r === 'owner',
    admins: r === 'owner',
    deleteUser: r === 'owner',
    settings: r === 'owner' || r === 'content',
    moderateUsers: !!r, // profiles/couples admin update: her aktif yönetici
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [admin, setAdmin] = useState<AdminRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkedFor = useRef<string | null>(null);
  const recovering = useRef(false);

  const check = useCallback(async (s: Session | null, force = false) => {
    if (!s) { checkedFor.current = null; setAdmin(null); setStatus('signed_out'); return; }
    if (recovering.current) { setStatus('recovery'); return; }
    if (!force && checkedFor.current === s.user.id) return;
    checkedFor.current = s.user.id;
    setStatus('checking');
    setError(null);
    try {
      const fetchRow = async () => {
        const { data, error: e } = await supabase.from('admins').select('*').eq('user_id', s.user.id).maybeSingle();
        if (e) throw e;
        return data as AdminRow | null;
      };
      let row = await fetchRow();
      if (!row) {
        const { data: claimed, error: ce } = await supabase.rpc('claim_first_admin');
        if (ce) throw ce;
        if (claimed === true) row = await fetchRow();
      }
      if (!row) { setAdmin(null); setStatus('denied'); return; }
      if (!row.active) { setAdmin(row); setStatus('inactive'); return; }
      setAdmin(row);
      setStatus('admin');
      supabase.rpc('admin_touch_login').then(() => undefined, () => undefined);
    } catch (e) {
      checkedFor.current = null;
      setError((e as { message?: string })?.message ?? String(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      check(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') { recovering.current = true; setStatus('recovery'); return; }
      if (event === 'SIGNED_OUT') { recovering.current = false; }
      // Supabase istemcisi içinde await kilitlenmesini önlemek için ertele
      setTimeout(() => check(s), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [check]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    checkedFor.current = null;
    setAdmin(null);
    setStatus('signed_out');
  }, []);

  const value = useMemo<Ctx>(() => ({
    status, session, admin, error,
    role: status === 'admin' ? admin?.role ?? null : null,
    perms: permsFor(status === 'admin' ? admin?.role ?? null : null),
    signOut,
    recheck: () => check(session, true),
    finishRecovery: () => { recovering.current = false; check(session, true); },
  }), [status, session, admin, error, signOut, check]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('AuthProvider eksik');
  return c;
};
