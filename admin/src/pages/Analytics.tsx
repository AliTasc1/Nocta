import { useLoad } from '../lib/data';
import { loadAnalytics } from '../lib/analytics';
import { dateShort, monthShort, num, num1, pct, short } from '../lib/format';
import { Btn, Empty, ErrorBox, InfoNote, Kpi, Skel } from '../ui/ui';

/** Tasarımdaki heat(): gül rengi, değerle artan opaklık */
const heat = (v: number | null) => ({
  t: v == null ? '' : pct(v, 0),
  bg: v ? `rgba(231,104,138,${((v / 100) * 0.9).toFixed(2)})` : v === 0 ? 'rgba(255,255,255,.03)' : 'transparent',
  fg: (v ?? 0) > 55 ? '#1A0710' : '#F6EEF1',
});

export default function Analytics() {
  const { data: a, error, loading, reload } = useLoad(loadAnalytics, []);

  if (error) return <div className="card"><ErrorBox error={error} onRetry={() => reload()} /></div>;

  const kpis = a ? [
    { t: 'Günlük aktif kullanıcı', v: short(a.dau), d: 'son 24 saat' },
    { t: 'Haftalık aktif kullanıcı', v: short(a.wau), d: 'son 7 gün' },
    { t: 'Aylık aktif kullanıcı', v: short(a.mau), d: a.mau ? `yapışkanlık ${pct((a.dau / a.mau) * 100)}` : 'son 30 gün' },
    { t: 'Başlatılan oyun', v: short(a.started_30), d: `ort. ${num(Math.round(a.started_30 / 30))} / gün` },
    { t: 'Tamamlanan oyun', v: short(a.completed_30), d: a.started_30 ? `${pct((a.completed_30 / a.started_30) * 100, 0)} oran` : '—' },
    { t: 'Ort. oyun süresi', v: `${num1(a.avg_minutes)} dk`, d: 'tamamlanan oyunlar' },
    { t: '4. hafta tutunma', v: pct(a.retention_w4), d: 'son 7 günde oynayan çiftler', c: a.retention_w4 >= 40 ? '#7FD1AE' : undefined },
    { t: 'Görev tamamlama', v: pct(a.challenge_rate), d: 'günlük görevler · 30 gün' },
    { t: 'Premium dönüşüm', v: pct(a.premium_conversion), d: 'aktif çiftler içinde' },
  ] : [];

  const weekly = a?.weekly ?? [];
  const wmax = Math.max(1, ...weekly.map((w) => Math.max(w.active, w.games)));
  const f = a?.funnel;
  const funnel = f ? [
    { t: 'Başlatılan oyunlar · 30 gün', v: f.started },
    { t: 'Tamamlanan oyunlar', v: f.completed },
    { t: 'Haftada 2+ oyun oynayan çift', v: f.repeat },
    { t: 'Premium çift', v: f.premium },
  ] : [];
  const fmax = Math.max(1, ...funnel.map((x) => x.v));

  return (
    <>
      {a?.source === 'client' && (
        <InfoNote tone="warn">Sunucudaki analitik fonksiyonu yanıt vermedi; metrikler panelde doğrudan veritabanından hesaplandı. Büyük veri hacimlerinde değerler yaklaşık olabilir.</InfoNote>
      )}
      <div className="grid-kpi sm">
        {loading && !a ? Array.from({ length: 9 }).map((_, i) => <Kpi key={i} t={' '} v="" loading />) : kpis.map((k) => <Kpi key={k.t} t={k.t} v={k.v} d={k.d} c={k.c} />)}
      </div>

      <div className="grid-2">
        <div className="card" style={{ gap: 14 }}>
          <div className="card-h">
            <span className="card-t">Haftalık etkinlik · 12 hafta</span>
            <div className="legend"><span><i style={{ background: '#A88BF0' }} />Aktif oyuncu</span><span><i style={{ background: '#E7688A' }} />Oyun</span></div>
          </div>
          {loading && !a ? <Skel h={220} r={12} /> : (
            <div className="gbars" role="img" aria-label="Haftalık aktif oyuncu ve oyun sayıları">
              {weekly.map((w) => (
                <div key={w.week} title={`${dateShort(w.week)} haftası · ${num(w.active)} aktif oyuncu · ${num(w.games)} oyun`}>
                  <div style={{ height: `${(w.active / wmax) * 100}%`, background: '#A88BF0' }} />
                  <div style={{ height: `${(w.games / wmax) * 100}%`, background: '#E7688A' }} />
                </div>
              ))}
            </div>
          )}
          <div className="axis">
            <span>{weekly[0] ? dateShort(weekly[0].week) : ''}</span>
            <span>{weekly[6] ? dateShort(weekly[6].week) : ''}</span>
            <span>{weekly.at(-1) ? dateShort(weekly.at(-1)!.week) : ''}</span>
          </div>
        </div>

        <div className="card" style={{ gap: 14 }}>
          <div className="card-h"><span className="card-t">Çift tutunma · kohort</span><span className="small muted">bağlandıkları aya göre, haftalık</span></div>
          {loading && !a ? <Skel h={200} r={12} /> : !a?.cohorts.length ? (
            <Empty icon="grid_on" title="Kohort verisi yok">Son 6 ayda bağlanan çiftler oldukça tablo dolacak.</Empty>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div className="heat" style={{ gridTemplateColumns: '84px repeat(6, minmax(44px, 1fr))' }}>
                <span className="h" />
                {['H0', 'H1', 'H2', 'H3', 'H4', 'H5'].map((h) => <span key={h} className="h">{h}</span>)}
                {a.cohorts.map((r) => (
                  <Row key={r.month} label={`${monthShort(r.month)} · ${num(r.size)}`} weeks={r.weeks} />
                ))}
              </div>
            </div>
          )}
          <span className="small muted2">H0 = bağlandıkları ilk hafta. Değer: o hafta en az bir oyun oynayan çiftlerin oranı.</span>
        </div>

        <div className="card" style={{ gap: 14 }}>
          <span className="card-t">Dönüşüm hunisi · başlatılan → tamamlanan → premium</span>
          {loading && !a ? Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={40} />) : funnel.map((x) => (
            <div className="col" style={{ gap: 6 }} key={x.t}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span>{x.t}</span>
                <span className="mono muted">{num(x.v)}{f && f.started ? ` · ${pct((x.v / f.started) * 100)}` : ''}</span>
              </div>
              <div className="funnel-bar"><div style={{ width: `${(x.v / fmax) * 100}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="card flush">
          <div className="tbl-head"><span className="card-t">Oyun bazında</span><Btn size="sm" variant="ghost" icon="refresh" onClick={() => reload()}>Yenile</Btn></div>
          {loading && !a ? <div style={{ padding: 18 }} className="col"><Skel /><Skel /><Skel /></div> : !a?.games.length ? <Empty icon="playing_cards" title="Oyun yok" /> : (
            <div className="tbl-scroll">
              <table className="tbl" style={{ minWidth: 420 }}>
                <thead><tr><th>Oyun</th><th>Oynanma · 30g</th><th>Tamamlama</th></tr></thead>
                <tbody>
                  {a.games.map((g) => (
                    <tr key={g.id}>
                      <td className="strong">{g.name}</td>
                      <td className="num">{num(g.plays_30)}</td>
                      <td className="num">{g.completion == null ? '—' : pct(g.completion, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, weeks }: { label: string; weeks: (number | null)[] }) {
  return (
    <>
      <span className="rl">{label}</span>
      {Array.from({ length: 6 }).map((_, i) => {
        const h = heat(weeks[i] ?? null);
        return <span key={i} style={{ background: h.bg, color: h.fg }}>{h.t}</span>;
      })}
    </>
  );
}
