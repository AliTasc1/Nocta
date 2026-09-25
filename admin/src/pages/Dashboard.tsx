import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { unwrap, useLoad } from '../lib/data';
import { REPORT_PRIORITY, REPORT_STATUS } from '../lib/constants';
import { dateShort, delta, dateTime, num, pct, shortMoney, short } from '../lib/format';
import { Badge, Empty, ErrorBox, Kpi, Skel } from '../ui/ui';

type Dash = {
  active_couples: number; active_couples_y: number; games_today: number; games_y: number; dau: number; dau_y: number;
  new_couples: number; new_couples_y: number; challenges: number; challenges_y: number; premium: number;
  revenue30: number; revenue_prev: number; users: number; open_reports: number;
  daily_games: { day: string; n: number }[];
  game_mix: { name: string; n: number }[];
  recent_reports: { id: string; number: number; title: string; priority: string; status: string; created_at: string }[];
};

export default function Dashboard() {
  const { data: d, error, loading, reload } = useLoad(async () => unwrap(await supabase.rpc('admin_dashboard')) as Dash, []);

  if (error) return <div className="card"><ErrorBox error={error} onRetry={() => reload()} /></div>;

  const dl = (a: number, b: number, unit?: string) => { const x = delta(Number(a), Number(b), unit); return { d: x.t, c: x.c }; };
  const kpis: { t: string; v: string; d: string; c: string }[] = d ? [
    { t: 'Aktif çiftler', v: short(d.active_couples), ...dl(d.active_couples, d.active_couples_y) },
    { t: 'Bugünkü oyunlar', v: short(d.games_today), ...dl(d.games_today, d.games_y) },
    { t: 'Günlük aktif kullanıcı', v: short(d.dau), ...dl(d.dau, d.dau_y) },
    { t: 'Yeni çiftler', v: short(d.new_couples), ...dl(d.new_couples, d.new_couples_y) },
    { t: 'Tamamlanan görevler', v: short(d.challenges), ...dl(d.challenges, d.challenges_y) },
    { t: 'Premium abonelik', v: short(d.premium), d: `${num(d.users)} kullanıcı`, c: '#B3A2AA' },
    { t: 'Gelir · 30 gün', v: shortMoney(d.revenue30), ...dl(d.revenue30, d.revenue_prev, 'önceki dönemle') },
    { t: 'Açık raporlar', v: num(d.open_reports), d: d.open_reports ? 'incelenmeyi bekliyor' : 'her şey yolunda', c: d.open_reports ? '#F2C27B' : '#7FD1AE' },
  ] : [];

  const days = d?.daily_games ?? [];
  const max = Math.max(1, ...days.map((x) => Number(x.n)));
  const avg = days.length ? days.reduce((s, x) => s + Number(x.n), 0) / days.length : 0;
  const mixTotal = (d?.game_mix ?? []).reduce((s, x) => s + Number(x.n), 0);

  return (
    <>
      <div className="grid-kpi">
        {loading && !d
          ? Array.from({ length: 8 }).map((_, i) => <Kpi key={i} t=" " v="" loading />)
          : kpis.map((k) => <Kpi key={k.t} t={k.t} v={k.v} d={k.d} c={k.c} />)}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><span className="card-t">Günlük oyunlar · 30 gün</span><span className="small muted">ort. {num(Math.round(avg))} / gün</span></div>
          {loading && !d ? <Skel h={200} r={12} /> : (
            <div className="bars" role="img" aria-label="Son 30 günün günlük oyun sayıları">
              {days.map((x, i) => {
                const dow = new Date(x.day + 'T12:00:00').getDay();
                const weekend = dow === 0 || dow === 6;
                return (
                  <div key={x.day} title={`${dateShort(x.day)}: ${num(x.n)} oyun`}
                    style={{ height: `${Math.max(1, (Number(x.n) / max) * 100)}%`, background: i === days.length - 1 ? '#E7688A' : weekend ? '#8A3450' : '#4A2A3A' }} />
                );
              })}
            </div>
          )}
          <div className="axis">
            <span>{days[0] ? dateShort(days[0].day) : '—'}</span>
            <span>{days[15] ? dateShort(days[15].day) : ''}</span>
            <span>{days.length ? dateShort(days[days.length - 1].day) : ''}</span>
          </div>
        </div>

        <div className="card" style={{ gap: 14 }}>
          <div className="card-h"><span className="card-t">Oyun dağılımı</span><span className="small muted">son 30 gün · {num(mixTotal)} oyun</span></div>
          {loading && !d ? Array.from({ length: 6 }).map((_, i) => <Skel key={i} h={16} />) :
            !mixTotal ? <Empty icon="playing_cards" title="Henüz oyun oynanmadı">Çiftler oyun oynamaya başladığında dağılım burada görünür.</Empty> :
              d!.game_mix.slice(0, 8).map((m) => {
                const p = (Number(m.n) / mixTotal) * 100;
                return (
                  <div className="mix-row" key={m.name} title={`${num(m.n)} oyun`}>
                    <span className="ellipsis">{m.name}</span>
                    <div className="bar"><div style={{ width: `${p}%` }} /></div>
                    <span className="v">{pct(p, 0)}</span>
                  </div>
                );
              })}
        </div>
      </div>

      <div className="tbl-card">
        <div className="tbl-head"><span className="card-t">Son raporlar</span><Link to="/raporlar" className="small">Tümünü gör →</Link></div>
        {loading && !d ? <div style={{ padding: 18 }} className="col"><Skel /><Skel /><Skel /></div> :
          !d?.recent_reports.length ? <Empty icon="verified_user" title="Rapor yok">Kullanıcılardan gelen şikâyetler burada listelenir.</Empty> : (
            <div className="tbl-scroll">
              <table className="tbl" style={{ minWidth: 560 }}>
                <thead><tr><th>Rapor</th><th>Öncelik</th><th>Tarih</th><th>Durum</th></tr></thead>
                <tbody>
                  {d.recent_reports.map((r) => (
                    <tr key={r.id}>
                      <td className="strong"><Link to={`/raporlar?id=${r.id}`} style={{ color: 'inherit' }}>#R-{r.number} · {r.title}</Link></td>
                      <td><Badge tone={REPORT_PRIORITY[r.priority]?.tone}>{REPORT_PRIORITY[r.priority]?.t ?? r.priority}</Badge></td>
                      <td className="m">{dateTime(r.created_at)}</td>
                      <td><Badge tone={REPORT_STATUS[r.status]?.tone}>{REPORT_STATUS[r.status]?.t ?? r.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}
