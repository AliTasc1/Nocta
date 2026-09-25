import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAll, useLoad } from '../lib/data';
import { PAY_STATUS } from '../lib/constants';
import { dateTime, money, num, pct, shortMoney } from '../lib/format';
import { Badge, Chips, Empty, ErrorBox, InfoNote, Kpi, Pager, SkelRows } from '../ui/ui';
import { coupleName } from './Couples';

type Name = { display_name: string } | null;
type Pay = {
  id: string; subscription_id: string | null; user_id: string | null; couple_id: string | null; provider_ref: string | null;
  amount_try: number; method: string; status: string; created_at: string;
  couple: { a: Name; b: Name } | null; user: Name;
};
type StatusF = 'all' | 'paid' | 'failed' | 'refunded' | 'pending';
type Range = '7' | '30' | '90' | 'all';
const PAGE = 25;
const SELECT = '*, couple:couples(a:profiles!couples_user_a_fkey(display_name), b:profiles!couples_user_b_fkey(display_name)), user:profiles!payments_user_id_fkey(display_name)';

const since = (r: Range) => (r === 'all' ? null : new Date(Date.now() - Number(r) * 86400000).toISOString());

export default function Payments() {
  const [status, setStatus] = useState<StatusF>('all');
  const [range, setRange] = useState<Range>('30');
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [status, range]);

  const totals = useLoad(async () => {
    const from = since(range);
    const rows = await fetchAll<{ amount_try: number; status: string }>((f, t) => {
      let qb = supabase.from('payments').select('amount_try,status');
      if (from) qb = qb.gte('created_at', from);
      return qb.range(f, t);
    }, 50000);
    const sum = (s: string) => rows.filter((r) => r.status === s).reduce((t, r) => t + Number(r.amount_try), 0);
    const cnt = (s: string) => rows.filter((r) => r.status === s).length;
    return { paid: sum('paid'), paidN: cnt('paid'), refunded: sum('refunded'), refundedN: cnt('refunded'), failedN: cnt('failed'), all: rows.length };
  }, [range]);

  const list = useLoad(async () => {
    let qb = supabase.from('payments').select(SELECT, { count: 'exact' });
    if (status !== 'all') qb = qb.eq('status', status);
    const from = since(range);
    if (from) qb = qb.gte('created_at', from);
    const res = await qb.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (res.error) throw res.error;
    return { rows: (res.data ?? []) as unknown as Pay[], total: res.count ?? 0 };
  }, [status, range, page]);

  const t = totals.data;
  const rangeLabel = range === 'all' ? 'tüm zamanlar' : `son ${range} gün`;
  const neverAny = t && t.all === 0 && range === 'all';

  return (
    <>
      <div className="grid-kpi">
        <Kpi t="Tahsil edilen" v={t ? shortMoney(t.paid) : ''} d={t ? `${num(t.paidN)} ödeme · ${rangeLabel}` : ''} loading={totals.loading && !t} />
        <Kpi t="Ortalama ödeme" v={t ? (t.paidN ? money(t.paid / t.paidN) : '—') : ''} d={rangeLabel} loading={totals.loading && !t} />
        <Kpi t="Başarısız ödemeler" v={t ? num(t.failedN) : ''} d={t && t.all ? `${pct((t.failedN / t.all) * 100)} oran` : '—'} c={t?.failedN ? '#F07A7A' : undefined} loading={totals.loading && !t} />
        <Kpi t="İadeler" v={t ? shortMoney(t.refunded) : ''} d={t ? `${num(t.refundedN)} iade` : ''} loading={totals.loading && !t} />
      </div>

      <div className="tbl-card">
        <div className="tbl-head">
          <Chips value={status} onChange={setStatus} options={[{ v: 'all', t: 'Tümü' }, { v: 'paid', t: 'Ödendi' }, { v: 'failed', t: 'Başarısız' }, { v: 'refunded', t: 'İade' }, { v: 'pending', t: 'Bekliyor' }]} />
          <Chips value={range} onChange={setRange} options={[{ v: '7', t: '7 gün' }, { v: '30', t: '30 gün' }, { v: '90', t: '90 gün' }, { v: 'all', t: 'Tümü' }]} />
        </div>
        {list.error ? <ErrorBox error={list.error} onRetry={() => list.reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>İşlem</th><th>Çift / kullanıcı</th><th>Tutar</th><th>Yöntem</th><th>Tarih</th><th>Durum</th></tr></thead>
              <tbody>
                {list.loading && !list.data ? <SkelRows cols={6} /> : !list.data?.rows.length ? (
                  <tr><td colSpan={6}>
                    {neverAny || (t && t.all === 0) ? (
                      <Empty icon="credit_card_off" title="Henüz ödeme kaydı yok">
                        Ödemeler, RevenueCat webhook bağlantısı kurulduğunda mağaza satın almalarından otomatik olarak buraya aktarılır. Yönetici tarafından verilen premium hediyeler ödeme oluşturmaz.
                      </Empty>
                    ) : <Empty icon="filter_alt_off" title="Bu filtrede ödeme yok">Filtreleri ya da tarih aralığını değiştirin.</Empty>}
                  </td></tr>
                ) : list.data.rows.map((p) => {
                  const st = PAY_STATUS[p.status] ?? { t: p.status, tone: 'mute' as const };
                  return (
                    <tr key={p.id} style={{ opacity: list.loading ? 0.6 : 1 }}>
                      <td className="strong mono" style={{ fontSize: 12.5 }}>{p.provider_ref || p.id.slice(0, 8)}</td>
                      <td className="m">{p.couple ? coupleName({ name_a: p.couple.a?.display_name, name_b: p.couple.b?.display_name }) : p.user?.display_name ?? '—'}</td>
                      <td className="num">{money(p.amount_try)}</td>
                      <td className="m">{p.method || '—'}</td>
                      <td className="m nowrap">{dateTime(p.created_at)}</td>
                      <td><Badge tone={st.tone}>{st.t}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE} total={list.data?.total ?? 0} onPage={setPage} unit="ödeme" />
      </div>
      <InfoNote>Ödeme kayıtları salt okunurdur; iade ve abonelik değişiklikleri mağaza / RevenueCat üzerinden yapılır.</InfoNote>
    </>
  );
}
