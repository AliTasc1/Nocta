import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mustAffect, unwrap, useDebounced, useLoad } from '../lib/data';
import { levelLabel } from '../lib/constants';
import { date, initials, relTime } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Badge, Chips, Empty, ErrorBox, Icon, Pager, RowMenu, SkelRows, useConfirm, useToast } from '../ui/ui';

type U = { id: string; display_name: string; email: string; partner_name: string | null; premium: boolean; status: string; created_at: string; last_seen_at: string | null; level: number; total: number };
type Filter = 'all' | 'active' | 'suspended' | 'premium' | 'single';
const PAGE = 25;

export default function Users() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const q = useDebounced(search.trim(), 300);
  const { perms, session } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => { const p = params.get('q'); if (p != null) setSearch(p); }, [params]);
  useEffect(() => { setPage(0); }, [q, filter]);

  const { data, error, loading, reload, setData } = useLoad(async () =>
    unwrap(await supabase.rpc('admin_users', { p_search: q, p_filter: filter, p_limit: PAGE, p_offset: page * PAGE })) as U[],
  [q, filter, page]);

  const rows = data ?? [];
  const total = rows[0]?.total ?? 0;

  const setStatus = async (u: U, status: 'active' | 'suspended') => {
    if (status === 'suspended') {
      const ok = await confirm({ title: 'Kullanıcı askıya alınsın mı?', body: <><b style={{ color: 'var(--text)' }}>{u.display_name || u.email}</b> askıya alındığında uygulamayı kullanamaz. Bu işlemi daha sonra geri alabilirsiniz.</>, confirm: 'Askıya al', danger: true });
      if (!ok) return;
    }
    try {
      mustAffect(await supabase.from('profiles').update({ status }).eq('id', u.id).select('id'));
      setData((d) => d?.map((x) => (x.id === u.id ? { ...x, status } : x)) ?? null);
      toast.success(status === 'suspended' ? 'Kullanıcı askıya alındı.' : 'Kullanıcı yeniden aktifleştirildi.');
    } catch (e) { toast.error(e); }
  };

  const del = async (u: U) => {
    const ok = await confirm({
      title: 'Kullanıcı kalıcı olarak silinsin mi?',
      body: <>Bu işlem geri alınamaz. <b style={{ color: 'var(--text)' }}>{u.display_name || u.email}</b> hesabı, profili, mesajları ve oyun geçmişi silinir; varsa partner bağlantısı sonlandırılır.</>,
      confirm: 'Kalıcı olarak sil', danger: true, typeToConfirm: 'SİL',
    });
    if (!ok) return;
    try {
      unwrap(await supabase.rpc('admin_delete_user', { p_user: u.id }));
      toast.success('Kullanıcı silindi.');
      reload(true);
    } catch (e) { toast.error(e); }
  };

  return (
    <div className="tbl-card">
      <div className="tbl-head">
        <Chips value={filter} onChange={setFilter} options={[
          { v: 'all', t: 'Tümü' }, { v: 'active', t: 'Aktif' }, { v: 'suspended', t: 'Askıda' }, { v: 'premium', t: 'Premium' }, { v: 'single', t: 'Partnersiz' },
        ]} />
        <div className="searchbox" style={{ width: 280 }}>
          <Icon n="search" size={18} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); if (params.get('q')) setParams({}, { replace: true }); }} placeholder="Ad ya da e-posta ara" aria-label="Kullanıcı ara" />
          {search && <button className="icon-btn plain" style={{ width: 24, height: 24 }} onClick={() => setSearch('')} aria-label="Temizle"><Icon n="close" size={16} /></button>}
        </div>
      </div>
      {error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Kullanıcı</th><th>E-posta</th><th>Partner</th><th>Plan</th><th>Seviye</th><th>Kayıt</th><th>Son görülme</th><th>Durum</th><th /></tr></thead>
            <tbody>
              {loading && !data ? <SkelRows cols={9} /> : rows.length === 0 ? (
                <tr><td colSpan={9}><Empty icon="person_search" title={q || filter !== 'all' ? 'Eşleşen kullanıcı yok' : 'Henüz kullanıcı yok'}>{q ? 'Arama terimini değiştirmeyi deneyin.' : 'Uygulamaya kayıt olan kullanıcılar burada listelenir.'}</Empty></td></tr>
              ) : rows.map((u) => (
                <tr key={u.id} style={{ opacity: loading ? 0.6 : 1 }}>
                  <td><div className="cell-main"><span className="avatar sm">{initials(u.display_name)}</span><span className="strong ellipsis" style={{ maxWidth: 200 }}>{u.display_name || '—'}</span></div></td>
                  <td className="m">{u.email}</td>
                  <td>{u.partner_name ?? '—'}</td>
                  <td>{u.premium ? <Badge tone="pro">PREMIUM</Badge> : <Badge tone="mute">ÜCRETSİZ</Badge>}</td>
                  <td className="m">{levelLabel(u.level)}</td>
                  <td className="m nowrap">{date(u.created_at)}</td>
                  <td className="m nowrap">{relTime(u.last_seen_at)}</td>
                  <td>{u.status === 'suspended' ? <Badge tone="bad">ASKIDA</Badge> : <Badge tone="ok">AKTİF</Badge>}</td>
                  <td className="act">
                    <RowMenu items={[
                      { label: 'Askıya al', icon: 'block', onClick: () => setStatus(u, 'suspended'), hidden: u.status === 'suspended' || !perms.moderateUsers },
                      { label: 'Aktifleştir', icon: 'check_circle', onClick: () => setStatus(u, 'active'), hidden: u.status !== 'suspended' || !perms.moderateUsers },
                      { label: 'E-postayı kopyala', icon: 'content_copy', onClick: () => { navigator.clipboard?.writeText(u.email); toast.info('E-posta kopyalandı.'); } },
                      'sep',
                      { label: 'Kullanıcıyı sil', icon: 'delete', danger: true, onClick: () => del(u), hidden: !perms.deleteUser, disabled: u.id === session?.user.id },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={PAGE} total={Number(total)} onPage={setPage} unit="kullanıcı" />
    </div>
  );
}
