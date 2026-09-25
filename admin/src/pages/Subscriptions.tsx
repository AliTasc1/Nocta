import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAll, mustAffect, unwrap, useDebounced, useLoad } from '../lib/data';
import { PLAN_LABEL, SUB_STATUS } from '../lib/constants';
import { date, money, num, shortMoney } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Badge, Btn, Chips, Empty, ErrorBox, Icon, InfoNote, Kpi, Modal, Pager, RowMenu, Skel, SkelRows, useConfirm, useToast } from '../ui/ui';
import { GrantPremiumModal, coupleName, type CoupleRow } from './Couples';

type Name = { display_name: string } | null;
type Sub = {
  id: string; couple_id: string | null; user_id: string | null; plan: string; status: string; provider: string; provider_ref: string | null;
  price_try: number; started_at: string; expires_at: string | null; canceled_at: string | null; created_at: string;
  couple: { id: string; a: Name; b: Name } | null; user: Name;
};
type StatusF = 'all' | 'active' | 'trial' | 'canceled' | 'expired' | 'billing_issue';
const PAGE = 25;
const SELECT = '*, couple:couples(id, a:profiles!couples_user_a_fkey(display_name), b:profiles!couples_user_b_fkey(display_name)), user:profiles!subscriptions_user_id_fkey(display_name)';

const subName = (s: Sub) => s.couple ? coupleName({ name_a: s.couple.a?.display_name, name_b: s.couple.b?.display_name }) : s.user?.display_name ?? '—';
const mrrOf = (s: { plan: string; price_try: number | string }) => s.plan === 'monthly' ? Number(s.price_try) : s.plan === 'yearly' ? Number(s.price_try) / 12 : 0;
const valid = (s: { expires_at: string | null }) => !s.expires_at || new Date(s.expires_at).getTime() > Date.now();

export default function Subscriptions() {
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<StatusF>('all');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(0);
  const [picking, setPicking] = useState(false);
  const [grant, setGrant] = useState<{ id: string; label: string } | null>(null);
  useEffect(() => { setPage(0); }, [status, source]);

  const kpi = useLoad(async () => {
    const all = await fetchAll<{ plan: string; status: string; price_try: number; expires_at: string | null; provider: string }>(
      (f, t) => supabase.from('subscriptions').select('plan,status,price_try,expires_at,provider').range(f, t));
    const live = all.filter(valid);
    const active = live.filter((s) => s.status === 'active');
    return {
      active: active.length,
      trial: live.filter((s) => s.status === 'trial').length,
      canceled: all.filter((s) => s.status === 'canceled').length,
      issue: all.filter((s) => s.status === 'billing_issue').length,
      gifts: live.filter((s) => s.provider === 'admin' && ['active', 'trial'].includes(s.status)).length,
      mrr: active.reduce((t, s) => t + mrrOf(s), 0),
    };
  }, []);

  const list = useLoad(async () => {
    let qb = supabase.from('subscriptions').select(SELECT, { count: 'exact' });
    if (status !== 'all') qb = qb.eq('status', status);
    if (source) qb = qb.eq('provider', source);
    const res = await qb.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (res.error) throw res.error;
    return { rows: (res.data ?? []) as unknown as Sub[], total: res.count ?? 0 };
  }, [status, source, page]);

  const refresh = () => { list.reload(true); kpi.reload(true); };

  const act = async (s: Sub, kind: 'cancel' | 'end' | 'reactivate') => {
    const now = new Date().toISOString();
    if (kind !== 'reactivate') {
      const ok = await confirm({
        title: kind === 'cancel' ? 'Abonelik iptal edilsin mi?' : 'Abonelik hemen sonlandırılsın mı?',
        body: kind === 'cancel'
          ? <>{subName(s)} aboneliği iptal edilir; premium erişim mevcut dönemin sonuna ({date(s.expires_at)}) kadar sürer.{s.provider === 'revenuecat' && ' Mağaza aboneliği ayrıca App Store / Google Play üzerinden iptal edilmelidir.'}</>
          : <>{subName(s)} premium erişimi hemen kapanır.{s.provider === 'revenuecat' && ' Mağaza aboneliği ve iadeler RevenueCat / mağaza üzerinden yönetilmelidir.'}</>,
        confirm: kind === 'cancel' ? 'İptal et' : 'Hemen sonlandır', danger: true,
      });
      if (!ok) return;
    }
    const patch = kind === 'cancel' ? { status: 'canceled', canceled_at: now }
      : kind === 'end' ? { status: 'expired', expires_at: now, canceled_at: s.canceled_at ?? now }
        : { status: 'active', canceled_at: null };
    try {
      mustAffect(await supabase.from('subscriptions').update(patch).eq('id', s.id).select('id'));
      toast.success(kind === 'cancel' ? 'Abonelik iptal edildi.' : kind === 'end' ? 'Abonelik sonlandırıldı.' : 'Abonelik yeniden etkinleştirildi.');
      refresh();
    } catch (e) { toast.error(e); }
  };

  const k = kpi.data;
  return (
    <>
      <div className="grid-kpi">
        <Kpi t="Aktif abonelik" v={k ? num(k.active) : ''} d={k ? `${num(k.gifts)} yönetici hediyesi` : ''} loading={kpi.loading && !k} />
        <Kpi t="Deneme süresinde" v={k ? num(k.trial) : ''} d="ücretsiz deneme" loading={kpi.loading && !k} />
        <Kpi t="İptal edilmiş" v={k ? num(k.canceled) : ''} d="dönem sonuna kadar erişim" c="#F07A7A" loading={kpi.loading && !k} />
        <Kpi t="Ödeme sorunu" v={k ? num(k.issue) : ''} d={k?.issue ? 'yenileme başarısız' : 'sorun yok'} c={k?.issue ? '#F2C27B' : '#7FD1AE'} loading={kpi.loading && !k} />
        <Kpi t="Aylık yinelenen gelir" v={k ? shortMoney(k.mrr) : ''} d="aylık + yıllık/12" loading={kpi.loading && !k} />
      </div>
      {kpi.error && <InfoNote tone="bad">Özet değerler yüklenemedi.</InfoNote>}

      <div className="tbl-card">
        <div className="tbl-head">
          <Chips value={status} onChange={setStatus} options={[
            { v: 'all', t: 'Tümü' }, { v: 'active', t: 'Aktif' }, { v: 'trial', t: 'Deneme' }, { v: 'canceled', t: 'İptal' },
            { v: 'expired', t: 'Sona erdi' }, { v: 'billing_issue', t: 'Ödeme sorunu' },
          ]} />
          <div className="row wrap">
            <select className="select sm auto" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Kaynak">
              <option value="">Tüm kaynaklar</option>
              <option value="revenuecat">Mağaza (RevenueCat)</option>
              <option value="admin">Yönetici</option>
            </select>
            {perms.subs && <Btn variant="primary" icon="add" onClick={() => setPicking(true)}>Premium ver</Btn>}
          </div>
        </div>
        {list.error ? <ErrorBox error={list.error} onRetry={() => list.reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl" style={{ minWidth: 940 }}>
              <thead><tr><th>Çift / kullanıcı</th><th>Plan</th><th>Kaynak</th><th>Başlangıç</th><th>Bitiş / yenileme</th><th>Tutar</th><th>Aylık gelir</th><th>Durum</th><th /></tr></thead>
              <tbody>
                {list.loading && !list.data ? <SkelRows cols={9} /> : !list.data?.rows.length ? (
                  <tr><td colSpan={9}><Empty icon="workspace_premium" title="Abonelik yok">Mağaza satın almaları RevenueCat bağlandığında, yönetici hediyeleri ise “Premium ver” ile burada görünür.</Empty></td></tr>
                ) : list.data.rows.map((s) => {
                  const st = SUB_STATUS[s.status] ?? { t: s.status, tone: 'mute' as const };
                  const expired = !valid(s) && s.status !== 'expired';
                  return (
                    <tr key={s.id} style={{ opacity: list.loading ? 0.6 : 1 }}>
                      <td className="strong">{subName(s)}</td>
                      <td><Badge tone="pro">{PLAN_LABEL[s.plan] ?? s.plan}</Badge></td>
                      <td className="m">{s.provider === 'admin' ? 'Yönetici' : 'Mağaza'}</td>
                      <td className="m nowrap">{date(s.started_at)}</td>
                      <td className="m nowrap">{s.expires_at ? date(s.expires_at) : 'Süresiz'}</td>
                      <td className="num">{Number(s.price_try) ? money(s.price_try) : '—'}</td>
                      <td className="num">{s.status === 'active' && valid(s) && mrrOf(s) ? money(mrrOf(s)) : '—'}</td>
                      <td>{expired ? <Badge tone="mute">SÜRESİ DOLDU</Badge> : <Badge tone={st.tone}>{st.t}</Badge>}</td>
                      <td className="act">
                        {perms.subs && <RowMenu items={[
                          { label: 'Süre uzat / premium ver', icon: 'more_time', hidden: !s.couple_id, onClick: () => setGrant({ id: s.couple_id!, label: subName(s) }) },
                          { label: 'Yeniden etkinleştir', icon: 'replay', hidden: s.status !== 'canceled' || !valid(s), onClick: () => act(s, 'reactivate') },
                          'sep',
                          { label: 'İptal et (dönem sonunda biter)', icon: 'event_busy', danger: true, hidden: !['active', 'trial', 'billing_issue'].includes(s.status), onClick: () => act(s, 'cancel') },
                          { label: 'Hemen sonlandır', icon: 'cancel', danger: true, hidden: s.status === 'expired' || !valid(s), onClick: () => act(s, 'end') },
                        ]} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE} total={list.data?.total ?? 0} onPage={setPage} unit="abonelik" />
      </div>

      {picking && <CouplePicker onClose={() => setPicking(false)} onPick={(c) => { setPicking(false); setGrant({ id: c.id, label: coupleName(c) }); }} />}
      {grant && <GrantPremiumModal couple={grant} onClose={() => setGrant(null)} onDone={refresh} />}
    </>
  );
}

function CouplePicker({ onClose, onPick }: { onClose: () => void; onPick: (c: CoupleRow) => void }) {
  const [s, setS] = useState('');
  const q = useDebounced(s.trim(), 300);
  const { data, error, loading } = useLoad(async () => unwrap(await supabase.rpc('admin_couples', { p_search: q, p_limit: 12, p_offset: 0 })) as CoupleRow[], [q]);
  return (
    <Modal title="Çift seçin" sub="Premium verilecek çifti isim ya da oda koduyla arayın." onClose={onClose}>
      <div className="searchbox" style={{ width: '100%', height: 44 }}>
        <Icon n="search" size={18} />
        <input autoFocus value={s} onChange={(e) => setS(e.target.value)} placeholder="İsim ya da oda kodu" />
      </div>
      {error ? <ErrorBox error={error} /> : loading && !data ? <div className="col"><Skel h={44} /><Skel h={44} /><Skel h={44} /></div> : !data?.length ? (
        <Empty icon="favorite" title="Çift bulunamadı" />
      ) : (
        <div className="col" style={{ gap: 6 }}>
          {data.map((c) => (
            <button key={c.id} type="button" className="story-item" onClick={() => onPick(c)}>
              <span className="swatch" style={{ background: 'var(--plum)' }}><Icon n="favorite" /></span>
              <span className="col grow" style={{ gap: 2 }}>
                <b className="ellipsis">{coupleName(c)}</b>
                <span className="tag">{c.invite_code} · {c.status === 'active' ? 'aktif' : c.status === 'pending' ? 'beklemede' : 'ayrıldı'}</span>
              </span>
              {c.premium && <Badge tone="pro">PREMIUM</Badge>}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
