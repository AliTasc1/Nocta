import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mustAffect, unwrap, useDebounced, useLoad } from '../lib/data';
import { COUPLE_STATUS, flirtLevel } from '../lib/constants';
import { duration, num, relTime } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Badge, Btn, Empty, ErrorBox, Field, Icon, Modal, Pager, RowMenu, Segmented, SkelRows, useConfirm, useToast } from '../ui/ui';

export type CoupleRow = {
  id: string; name_a: string; name_b: string | null; status: string; xp: number; streak_days: number; games: number;
  last_activity: string | null; connected_at: string | null; created_at: string; premium: boolean; invite_code: string; total: number;
};
const PAGE = 25;

export const coupleName = (c: { name_a?: string | null; name_b?: string | null }) =>
  c.name_b ? `${c.name_a || '—'} & ${c.name_b}` : `${c.name_a || '—'} · partner bekleniyor`;

export function GrantPremiumModal({ couple, onClose, onDone }: { couple: { id: string; label: string }; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = useState<'gift' | 'monthly' | 'yearly'>('gift');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = async () => {
    if (!Number.isFinite(days) || days < 1 || days > 3650) { toast.error({ message: 'Süre 1 ile 3650 gün arasında olmalı.', code: 'P0001' }); return; }
    setBusy(true);
    try {
      unwrap(await supabase.rpc('admin_set_premium', { p_couple: couple.id, p_plan: plan, p_days: Math.round(days) }));
      toast.success(`${couple.label} için ${num(days)} günlük premium tanımlandı.`);
      onDone();
      onClose();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Premium ver" sub={couple.label} onClose={onClose} busy={busy} footer={<>
      <Btn onClick={onClose} disabled={busy}>Vazgeç</Btn>
      <Btn variant="primary" icon="workspace_premium" loading={busy} onClick={submit}>Premium ver</Btn>
    </>}>
      <Field label="Plan">
        <Segmented value={plan} onChange={(v) => { setPlan(v); setDays(v === 'yearly' ? 365 : 30); }} options={[{ v: 'gift', t: 'Hediye' }, { v: 'monthly', t: 'Aylık' }, { v: 'yearly', t: 'Yıllık' }]} />
      </Field>
      <Field label="Süre (gün)" hint="Abonelik bugünden itibaren bu kadar gün geçerli olur. Ödeme alınmaz.">
        <input className="input" type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} />
      </Field>
      <div className="row wrap">
        {[7, 30, 90, 365].map((d) => <button key={d} type="button" className={`chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>{d} gün</button>)}
      </div>
    </Modal>
  );
}

export default function Couples() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [page, setPage] = useState(0);
  const [grant, setGrant] = useState<CoupleRow | null>(null);
  const q = useDebounced(search.trim(), 300);
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => { const p = params.get('q'); if (p != null) setSearch(p); }, [params]);
  useEffect(() => { setPage(0); }, [q]);

  const { data, error, loading, reload, setData } = useLoad(async () =>
    unwrap(await supabase.rpc('admin_couples', { p_search: q, p_limit: PAGE, p_offset: page * PAGE })) as CoupleRow[],
  [q, page]);
  const rows = data ?? [];
  const total = Number(rows[0]?.total ?? 0);

  const revoke = async (c: CoupleRow) => {
    const ok = await confirm({ title: 'Premium kaldırılsın mı?', body: <>{coupleName(c)} çiftine bağlı tüm aktif abonelikler hemen sona erdirilir. Mağaza (RevenueCat) üzerinden yapılan ödemeler iade edilmez.</>, confirm: 'Premiumu kaldır', danger: true });
    if (!ok) return;
    try {
      unwrap(await supabase.rpc('admin_set_premium', { p_couple: c.id, p_plan: 'gift', p_days: 0 }));
      toast.success('Premium kaldırıldı.');
      reload(true);
    } catch (e) { toast.error(e); }
  };

  const disconnect = async (c: CoupleRow) => {
    const ok = await confirm({ title: 'Bağlantı sonlandırılsın mı?', body: <>{coupleName(c)} bağlantısı kapatılır. Partnerler yeniden eşleşmek için yeni bir oda oluşturmak zorunda kalır. Bu işlem geri alınamaz.</>, confirm: 'Bağlantıyı sonlandır', danger: true });
    if (!ok) return;
    try {
      const now = new Date().toISOString();
      mustAffect(await supabase.from('couples').update({ status: 'disconnected', ended_at: now }).eq('id', c.id).select('id'));
      setData((d) => d?.map((x) => (x.id === c.id ? { ...x, status: 'disconnected' } : x)) ?? null);
      toast.success('Bağlantı sonlandırıldı.');
    } catch (e) { toast.error(e); }
  };

  return (
    <>
      <div className="tbl-card">
        <div className="tbl-head">
          <span className="card-t">Çiftler</span>
          <div className="searchbox" style={{ width: 300 }}>
            <Icon n="search" size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İsim ya da oda kodu ara" aria-label="Çift ara" />
            {search && <button className="icon-btn plain" style={{ width: 24, height: 24 }} onClick={() => setSearch('')} aria-label="Temizle"><Icon n="close" size={16} /></button>}
          </div>
        </div>
        {error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl" style={{ minWidth: 980 }}>
              <thead><tr><th>Çift</th><th>Birlikte</th><th>Flört seviyesi</th><th>XP</th><th>Oyun</th><th>Seri</th><th>Son aktivite</th><th>Plan</th><th>Durum</th><th /></tr></thead>
              <tbody>
                {loading && !data ? <SkelRows cols={10} /> : rows.length === 0 ? (
                  <tr><td colSpan={10}><Empty icon="favorite" title={q ? 'Eşleşen çift yok' : 'Henüz çift yok'}>{q ? 'Arama terimini değiştirmeyi deneyin.' : 'Partnerler eşleştiğinde çiftler burada görünür.'}</Empty></td></tr>
                ) : rows.map((c) => {
                  const fl = flirtLevel(c.xp);
                  const st = COUPLE_STATUS[c.status] ?? { t: c.status, tone: 'mute' as const };
                  return (
                    <tr key={c.id} style={{ opacity: loading ? 0.6 : 1 }}>
                      <td><div className="txt col" style={{ gap: 2 }}><span className="strong">{coupleName(c)}</span><span className="tag">{c.invite_code}</span></div></td>
                      <td className="m nowrap">{c.connected_at ? duration(c.connected_at) : '—'}</td>
                      <td><Badge tone="rose" title={fl.next ? `Sonraki seviye: ${num(fl.next)} XP` : 'En yüksek seviye'}>SV{fl.level} · {fl.name.toLocaleUpperCase('tr-TR')}</Badge></td>
                      <td className="num">{num(c.xp)}</td>
                      <td className="num">{num(c.games)}</td>
                      <td className="m nowrap">{c.streak_days ? `${num(c.streak_days)} gün` : '—'}</td>
                      <td className="m nowrap">{relTime(c.last_activity)}</td>
                      <td>{c.premium ? <Badge tone="pro">PREMIUM</Badge> : <Badge tone="mute">ÜCRETSİZ</Badge>}</td>
                      <td><Badge tone={st.tone}>{st.t}</Badge></td>
                      <td className="act">
                        <RowMenu items={[
                          { label: 'Premium ver', icon: 'workspace_premium', onClick: () => setGrant(c), hidden: !perms.subs },
                          { label: 'Premiumu kaldır', icon: 'remove_moderator', onClick: () => revoke(c), hidden: !perms.subs || !c.premium },
                          { label: 'Oda kodunu kopyala', icon: 'content_copy', onClick: () => { navigator.clipboard?.writeText(c.invite_code); toast.info('Oda kodu kopyalandı.'); } },
                          'sep',
                          { label: 'Bağlantıyı sonlandır', icon: 'link_off', danger: true, onClick: () => disconnect(c), hidden: c.status === 'disconnected' || !perms.moderateUsers },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} unit="çift" />
      </div>
      {grant && <GrantPremiumModal couple={{ id: grant.id, label: coupleName(grant) }} onClose={() => setGrant(null)} onDone={() => reload(true)} />}
    </>
  );
}
