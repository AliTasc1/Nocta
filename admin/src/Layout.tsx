import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { supabase } from './lib/supabase';
import { PROMO_CHANGED, ROLE_LABEL } from './lib/constants';
import { initials, trUpper } from './lib/format';
import { Icon, IconBtn } from './ui/ui';

type NavItem = { to: string; icon: string; t: string; badge?: 'reports' | 'promo'; crumb?: string };
export const NAV: NavItem[] = [
  { to: '/', icon: 'space_dashboard', t: 'Genel Bakış' },
  { to: '/kullanicilar', icon: 'group', t: 'Kullanıcılar' },
  { to: '/ciftler', icon: 'favorite', t: 'Çiftler' },
  { to: '/oyunlar', icon: 'playing_cards', t: 'Oyunlar' },
  { to: '/sorular', icon: 'help', t: 'Sorular' },
  { to: '/gorevler', icon: 'bolt', t: 'Görevler' },
  { to: '/testler', icon: 'quiz', t: 'Testler' },
  { to: '/hikayeler', icon: 'movie', t: 'Hikâyeler' },
  { to: '/raporlar', icon: 'flag', t: 'Raporlar', badge: 'reports' },
  { to: '/abonelikler', icon: 'workspace_premium', t: 'Abonelikler' },
  { to: '/tanitim', icon: 'campaign', t: 'Tanıtım Ödülleri', badge: 'promo' },
  { to: '/odemeler', icon: 'payments', t: 'Ödemeler' },
  { to: '/analitik', icon: 'monitoring', t: 'Analitik' },
  { to: '/kategoriler', icon: 'edit_note', t: 'Kategoriler', crumb: 'İçerik Yönetimi' },
  { to: '/ayarlar', icon: 'settings', t: 'Ayarlar' },
];

export function Layout() {
  const { admin, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [openReports, setOpenReports] = useState<number>(0);
  const [pendingPromo, setPendingPromo] = useState<number>(0);
  const [promoTick, setPromoTick] = useState(0);
  const [q, setQ] = useState('');

  const current = NAV.find((n) => (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to))) ?? NAV[0];

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => { document.title = `${current.t} · Nocta Yönetim`; }, [current.t]);

  // Açık rapor sayısı (kenar çubuğu rozeti)
  useEffect(() => {
    let alive = true;
    supabase.from('reports').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_review'])
      .then(({ count }) => { if (alive) setOpenReports(count ?? 0); });
    return () => { alive = false; };
  }, [loc.pathname, loc.search]);

  // Bekleyen tanıtım başvurusu sayısı (kenar çubuğu rozeti)
  useEffect(() => {
    const on = () => setPromoTick((t) => t + 1);
    window.addEventListener(PROMO_CHANGED, on);
    return () => window.removeEventListener(PROMO_CHANGED, on);
  }, []);
  useEffect(() => {
    let alive = true;
    supabase.from('promo_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      .then(({ count }) => { if (alive) setPendingPromo(count ?? 0); });
    return () => { alive = false; };
  }, [loc.pathname, loc.search, promoTick]);
  const badgeCount = (b: NavItem['badge']) => (b === 'reports' ? openReports : b === 'promo' ? pendingPromo : 0);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const s = q.trim();
    if (!s) return;
    if (/^[A-Za-z]{4}-?\d{4}/.test(s)) nav(`/ciftler?q=${encodeURIComponent(s)}`);
    else nav(`/kullanicilar?q=${encodeURIComponent(s)}`);
    setQ('');
  };

  return (
    <div className={`shell ${open ? 'open' : ''}`}>
      <div className="scrim" onClick={() => setOpen(false)} />
      <aside className="side" aria-label="Ana menü">
        <div className="brand"><span className="logo">noc<i>ta</i></span><span className="tag">YÖNETİM</span></div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon n={n.icon} />{n.t}
            {n.badge && badgeCount(n.badge) > 0 && <span className="nav-badge">{badgeCount(n.badge) > 99 ? '99+' : badgeCount(n.badge)}</span>}
          </NavLink>
        ))}
        <div className="side-foot">
          <div className="side-user">
            <span className="avatar sm">{initials(admin?.display_name || admin?.email)}</span>
            <span className="who"><b className="ellipsis">{admin?.display_name || admin?.email}</b><span className="small muted2">{admin ? ROLE_LABEL[admin.role] : ''}</span></span>
            <span style={{ marginLeft: 'auto' }}><IconBtn icon="logout" title="Çıkış yap" plain onClick={signOut} /></span>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="heading">
            <span className="menu-btn"><IconBtn icon="menu" title="Menüyü aç" onClick={() => setOpen(true)} /></span>
            <div className="col" style={{ gap: 4, minWidth: 0 }}>
              <span className="crumb">YÖNETİM / {trUpper(current.crumb ?? current.t)}</span>
              <h1 className="title">{current.t}</h1>
            </div>
          </div>
          <div className="top-actions">
            <form className="searchbox" onSubmit={search} role="search">
              <Icon n="search" size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kullanıcı, çift ya da oda kodu ara" aria-label="Ara" />
            </form>
            <span className="chip-static">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' })}</span>
            <span className="avatar" title={admin?.email}>{initials(admin?.display_name || admin?.email)}</span>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
