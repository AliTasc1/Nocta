import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fetchAll, unwrap, useDebounced, useLoad } from '../lib/data';
import { PROMO_CHANGED, PROMO_DEFAULTS, PROMO_PLATFORM, PROMO_STATUS } from '../lib/constants';
import { dateTime, num, relTime } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Badge, Btn, Chips, Drawer, Empty, ErrorBox, Field, Icon, InfoNote, Kpi, Modal, Pager, Skel, SkelRows, useConfirm, useToast } from '../ui/ui';

type Person = { id: string; display_name: string; status?: string } | null;
export type PromoRow = {
  id: string; user_id: string; platform: string; url: string; handle: string; note: string; proof_paths: string[];
  posted_at: string; status: 'pending' | 'approved' | 'rejected'; admin_note: string; reviewed_by: string | null; reviewed_at: string | null;
  premium_until: string | null; created_at: string;
  user: Person; reviewer: { display_name: string } | null;
};
type StatusF = 'all' | 'pending' | 'approved' | 'rejected';
type PromoCfg = { enabled: boolean; days: number; minHours: number };

const PAGE = 25;
const BUCKET = 'promo-proofs';
const SELECT = '*, user:profiles!promo_submissions_user_id_fkey(id,display_name,status), reviewer:profiles!promo_submissions_reviewed_by_fkey(display_name)';
const HOUR = 3600_000;
const DAY = 86_400_000;

// ── Yardımcılar ────────────────────────────────────────────────
const asNum = (v: unknown, d: number) => { const n = Number(typeof v === 'string' ? v.replace(/"/g, '') : v); return Number.isFinite(n) && n > 0 ? n : d; };
const asBool = (v: unknown, d: boolean) => (v == null ? d : v === true || v === 'true' || v === '"true"');

async function loadCfg(): Promise<PromoCfg> {
  const rows = unwrap(await supabase.from('app_settings').select('key,value').in('key', ['promo_enabled', 'promo_days', 'promo_min_hours'])) as { key: string; value: unknown }[];
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: asBool(m.promo_enabled, PROMO_DEFAULTS.enabled),
    days: asNum(m.promo_days, PROMO_DEFAULTS.days),
    minHours: asNum(m.promo_min_hours, PROMO_DEFAULTS.minHours),
  };
}

/** Yayında kalma süresinin dolduğu an (posted_at + promo_min_hours). */
const dueAt = (r: Pick<PromoRow, 'posted_at'>, minHours: number) => new Date(r.posted_at).getTime() + minHours * HOUR;

export function remainingText(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}s ${m}dk kaldı` : `${m}dk kaldı`;
}

/** Onaylanan başvurunun verdiği premium gün sayısı. */
const grantedDays = (r: PromoRow, fallback: number) =>
  r.premium_until && r.reviewed_at ? Math.max(0, Math.round((new Date(r.premium_until).getTime() - new Date(r.reviewed_at).getTime()) / DAY)) : fallback;

const shortId = (id: string) => id.slice(0, 8);

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const PlatformBadge = ({ p }: { p: string }) => <Badge tone={PROMO_PLATFORM[p]?.tone ?? 'mute'}>{PROMO_PLATFORM[p]?.t ?? p}</Badge>;
const StatusBadge = ({ s }: { s: string }) => <Badge tone={PROMO_STATUS[s]?.tone ?? 'mute'}>{PROMO_STATUS[s]?.t ?? s}</Badge>;

function Countdown({ r, minHours, now }: { r: PromoRow; minHours: number; now: number }) {
  const left = dueAt(r, minHours) - now;
  if (left <= 0) return <span className="row nowrap" style={{ gap: 4, color: 'var(--green)', fontWeight: 700 }}><Icon n="check_circle" size={16} />Doldu</span>;
  return <span className="nowrap" style={{ color: 'var(--amber)', fontWeight: 600 }} title={`Dolum: ${dateTime(new Date(dueAt(r, minHours)))}`}><Icon n="schedule" size={15} style={{ verticalAlign: '-3px', marginRight: 4 }} />{remainingText(left)}</span>;
}

// ── Sayfa ──────────────────────────────────────────────────────
export default function Promo() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<StatusF>('pending');
  const [platform, setPlatform] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim().toLocaleLowerCase('tr-TR'), 200);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(params.get('id'));
  const now = useNow();

  useEffect(() => { setPage(0); }, [status, platform, q]);
  useEffect(() => { const id = params.get('id'); if (id) setOpenId(id); }, [params]);

  const cfg = useLoad(loadCfg, []);
  const all = useLoad(async () => fetchAll<PromoRow>((from, to) =>
    supabase.from('promo_submissions').select(SELECT).order('created_at', { ascending: false }).range(from, to) as unknown as PromiseLike<{ data: PromoRow[] | null; error: unknown }>, 10000), []);

  const c = cfg.data ?? { enabled: PROMO_DEFAULTS.enabled, days: PROMO_DEFAULTS.days, minHours: PROMO_DEFAULTS.minHours };
  const rows = all.data ?? [];

  const kpi = useMemo(() => {
    const k = { pending: 0, due: 0, approved: 0, rejected: 0, days: 0 };
    for (const r of rows) {
      if (r.status === 'pending') { k.pending++; if (dueAt(r, c.minHours) <= now) k.due++; }
      else if (r.status === 'approved') { k.approved++; k.days += grantedDays(r, c.days); }
      else if (r.status === 'rejected') k.rejected++;
    }
    return k;
  }, [rows, c.minHours, c.days, now]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (platform && r.platform !== platform) return false;
    if (q) {
      const hay = [r.handle, r.url, r.user?.display_name ?? '', r.user_id].join(' ').toLocaleLowerCase('tr-TR');
      if (!hay.includes(q.replace(/^@/, ''))) return false;
    }
    return true;
  }), [rows, status, platform, q]);
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const close = () => { setOpenId(null); if (params.get('id')) setParams({}, { replace: true }); };
  const refresh = () => { all.reload(true); cfg.reload(true); window.dispatchEvent(new Event(PROMO_CHANGED)); };
  const loadingK = all.loading && !all.data;

  return (
    <>
      {cfg.data && !cfg.data.enabled && (
        <InfoNote tone="warn">Kampanya şu an <b>kapalı</b>; uygulamadan yeni başvuru alınmıyor. Ayarlar → Tanıtım kampanyası bölümünden açabilirsiniz.</InfoNote>
      )}
      <div className="grid-kpi">
        <Kpi t="Bekleyen" v={num(kpi.pending)} d="incelenmeyi bekliyor" c={kpi.pending ? '#F2C27B' : undefined} loading={loadingK} />
        <Kpi t={`${c.minHours} saati dolan & bekleyen`} v={num(kpi.due)} d={kpi.due ? 'onaylanmaya hazır' : 'hazır başvuru yok'} c={kpi.due ? '#7FD1AE' : undefined} loading={loadingK} />
        <Kpi t="Onaylanan" v={num(kpi.approved)} d="premium verildi" c="#7FD1AE" loading={loadingK} />
        <Kpi t="Reddedilen" v={num(kpi.rejected)} d="kullanıcıya bildirildi" c="#F07A7A" loading={loadingK} />
        <Kpi t="Verilen toplam premium" v={`${num(kpi.days)} gün`} d={`başvuru başına ${num(c.days)} gün`} loading={loadingK} />
      </div>

      <div className="tbl-card">
        <div className="tbl-head">
          <Chips value={status} onChange={setStatus} options={[
            { v: 'all', t: 'Tümü', n: all.data ? rows.length : null }, { v: 'pending', t: 'Bekleyen', n: all.data ? kpi.pending : null },
            { v: 'approved', t: 'Onaylanan', n: all.data ? kpi.approved : null }, { v: 'rejected', t: 'Reddedilen', n: all.data ? kpi.rejected : null },
          ]} />
          <div className="row wrap">
            <select className="select sm auto" value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">
              <option value="">Tüm platformlar</option>
              {Object.entries(PROMO_PLATFORM).map(([k, v]) => <option key={k} value={k}>{v.t}</option>)}
            </select>
            <div className="searchbox" style={{ minWidth: 220 }}>
              <Icon n="search" size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hesap, link ya da ad ara" aria-label="Başvuru ara" />
            </div>
          </div>
        </div>
        {all.error ? <ErrorBox error={all.error} onRetry={() => all.reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl" style={{ minWidth: 1040 }}>
              <thead><tr><th>Kullanıcı</th><th>Platform</th><th>Hesap</th><th>Video linki</th><th>Paylaşım</th><th>{c.minHours} saat</th><th>Durum</th><th>Kanıt</th></tr></thead>
              <tbody>
                {loadingK ? <SkelRows cols={8} /> : !pageRows.length ? (
                  <tr><td colSpan={8}><Empty icon="campaign" title={rows.length ? 'Bu filtrede başvuru yok' : 'Henüz başvuru yok'}>Kullanıcılar uygulamada Nocta'yı tanıtan videolarını paylaşıp buradan ödül talep eder.</Empty></td></tr>
                ) : pageRows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => setOpenId(r.id)} style={{ opacity: all.loading ? 0.6 : 1 }}>
                    <td><span className="txt col" style={{ gap: 2 }}><span className="strong ellipsis" style={{ maxWidth: 180, display: 'block' }}>{r.user?.display_name || 'Silinmiş kullanıcı'}</span><span className="tag">{shortId(r.user_id)}</span></span></td>
                    <td><PlatformBadge p={r.platform} /></td>
                    <td className="m nowrap">{r.handle ? `@${r.handle.replace(/^@/, '')}` : '—'}</td>
                    <td><a href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ellipsis" style={{ display: 'block', maxWidth: 240 }} title={r.url}>{r.url.replace(/^https?:\/\/(www\.)?/, '')}</a></td>
                    <td className="m nowrap" title={dateTime(r.posted_at)}>{relTime(r.posted_at)}</td>
                    <td>{r.status === 'pending' ? <Countdown r={r} minHours={c.minHours} now={now} /> : <span className="muted2">—</span>}</td>
                    <td><StatusBadge s={r.status} /></td>
                    <td className="m nowrap">{r.proof_paths?.length ? <><Icon n="image" size={16} style={{ verticalAlign: '-3px', marginRight: 4 }} />{num(r.proof_paths.length)}</> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} unit="başvuru" />
      </div>
      {openId && <PromoDrawer id={openId} cfg={c} now={now} onClose={close} onChanged={refresh} />}
    </>
  );
}

// ── Ayrıntı çekmecesi ──────────────────────────────────────────
function PromoDrawer({ id, cfg, now, onClose, onChanged }: { id: string; cfg: PromoCfg; now: number; onClose: () => void; onChanged: () => void }) {
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [note, setNote] = useState('');
  const [early, setEarly] = useState(false);
  const [busy, setBusy] = useState('');
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  const { data, error, loading, reload } = useLoad(async () => {
    const r = unwrap(await supabase.from('promo_submissions').select(SELECT).eq('id', id).single()) as unknown as PromoRow;
    let proofs: { path: string; url: string | null }[] = [];
    let proofErr = false;
    if (r.proof_paths?.length) {
      const res = await supabase.storage.from(BUCKET).createSignedUrls(r.proof_paths, 3600);
      if (res.error) { proofErr = true; proofs = r.proof_paths.map((p) => ({ path: p, url: null })); }
      else proofs = r.proof_paths.map((p) => ({ path: p, url: res.data?.find((x) => x.path === p)?.signedUrl ?? null }));
    }
    return { r, proofs, proofErr };
  }, [id]);

  useEffect(() => { if (data) { setNote(data.r.admin_note ?? ''); setEarly(false); setNoteErr(null); } }, [data?.r.id, data?.r.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = data?.r;
  const canReview = perms.promo;
  const due = r ? dueAt(r, cfg.minHours) : 0;
  const elapsed = !!r && due <= now;
  const approveBlocked = !elapsed && !early;
  const name = r?.user?.display_name || 'Silinmiş kullanıcı';

  const review = async (approve: boolean) => {
    if (!r) return;
    const n = note.trim();
    if (!approve && !n) { setNoteErr('Reddetmek için kullanıcıya gösterilecek bir not yazın.'); return; }
    setNoteErr(null);
    const ok = await confirm(approve ? {
      title: `${cfg.days} gün Premium verilsin mi?`,
      body: <>
        <b style={{ color: 'var(--text)' }}>{name}</b> için başvuru onaylanır, <b style={{ color: 'var(--text)' }}>{cfg.days} günlük</b> hediye abonelik tanımlanır ve kullanıcıya bildirim gider.
        {!elapsed && <><br /><br /><span style={{ color: 'var(--amber)' }}>Uyarı: video henüz {cfg.minHours} saat yayında kalmadı ({remainingText(due - now)}).</span></>}
      </>,
      confirm: 'Onayla ve Premium ver',
    } : {
      title: 'Başvuru reddedilsin mi?',
      body: <><b style={{ color: 'var(--text)' }}>{name}</b> kullanıcısına şu notla bildirim gönderilir:<div className="quote" style={{ marginTop: 10 }}>{n}</div></>,
      confirm: 'Reddet', danger: true,
    });
    if (!ok) return;
    setBusy(approve ? 'approve' : 'reject');
    try {
      unwrap(await supabase.rpc('admin_review_promo', { p_id: r.id, p_approve: approve, p_note: n }));
      toast.success(approve ? `Başvuru onaylandı; ${cfg.days} gün Premium tanımlandı.` : 'Başvuru reddedildi ve kullanıcıya bildirildi.');
      await reload(true);
      onChanged();
    } catch (e) { toast.error(e); } finally { setBusy(''); }
  };

  const saveNote = async () => {
    if (!r) return;
    setBusy('note');
    try {
      const res = await supabase.from('promo_submissions').update({ admin_note: note }).eq('id', r.id).select('id');
      if (res.error) throw res.error;
      if (!res.data?.length) throw new Error('Not kaydedilemedi: bu işlem için yetkiniz yok.');
      toast.success('Not kaydedildi.');
      await reload(true);
      onChanged();
    } catch (e) { toast.error(e); } finally { setBusy(''); }
  };

  const canAct = !!r && canReview && r.status !== 'approved';
  const proofs = data?.proofs ?? [];

  return (
    <Drawer onClose={() => { if (zoom == null) onClose(); }} sub={r ? `TANITIM BAŞVURUSU · ${(PROMO_PLATFORM[r.platform]?.t ?? r.platform).toLocaleUpperCase('tr-TR')}` : 'TANITIM BAŞVURUSU'}
      title={r ? name : error ? 'Başvuru' : 'Yükleniyor…'}
      footer={canAct ? <>
        <span title={approveBlocked ? `Video henüz ${cfg.minHours} saat yayında kalmadı (${remainingText(due - now)}). Erken onaylamak için “${cfg.minHours} saat dolmadan onayla” kutusunu işaretleyin.` : undefined} style={{ display: 'inline-flex' }}>
          <Btn variant="primary" icon="workspace_premium" loading={busy === 'approve'} disabled={!!busy || approveBlocked} onClick={() => review(true)}>
            Onayla — {cfg.days} gün Premium ver
          </Btn>
        </span>
        {r!.status === 'pending' && <Btn variant="danger" icon="block" loading={busy === 'reject'} disabled={!!busy} onClick={() => review(false)}>Reddet</Btn>}
      </> : undefined}>
      {error ? <ErrorBox error={error} onRetry={() => reload()} /> : loading && !data ? <div className="col"><Skel h={20} /><Skel h={80} /><Skel h={120} /></div> : r && (
        <>
          <div className="row wrap" style={{ gap: 8 }}>
            <StatusBadge s={r.status} />
            <PlatformBadge p={r.platform} />
            {r.status === 'pending' && (elapsed ? <Badge tone="ok">{cfg.minHours} SAAT DOLDU</Badge> : <Badge tone="warn">{remainingText(due - now)}</Badge>)}
          </div>

          <div className="col" style={{ gap: 8 }}>
            <span className="label-mono">Video linki</span>
            <div className="quote row" style={{ gap: 10, whiteSpace: 'normal' }}>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="grow" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{r.url}</a>
              <a className="btn sm" href={r.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}><Icon n="open_in_new" />Linki aç</a>
            </div>
          </div>

          <div className="kv">
            <span>Kullanıcı</span>
            <span>
              {r.user ? <Link to={`/kullanicilar?q=${encodeURIComponent(r.user.display_name)}`}>{r.user.display_name}</Link> : 'Silinmiş kullanıcı'}
              {r.user?.status === 'suspended' && <> <Badge tone="bad">ASKIDA</Badge></>}
              <span className="tag"> · {shortId(r.user_id)}</span>
            </span>
            <span>Hesap</span><span>{r.handle ? `@${r.handle.replace(/^@/, '')}` : '—'}</span>
            <span>Platform</span><span>{PROMO_PLATFORM[r.platform]?.t ?? r.platform}</span>
            <span>Paylaşım</span><span>{dateTime(r.posted_at)} <span className="muted2">· {relTime(r.posted_at)}</span></span>
            <span>Başvuru</span><span>{dateTime(r.created_at)}</span>
            {r.status === 'approved' && <><span>Premium bitişi</span><span>{dateTime(r.premium_until)} <span className="muted2">· {num(grantedDays(r, cfg.days))} gün</span></span></>}
          </div>

          <div className="col" style={{ gap: 8 }}>
            <span className="label-mono">Kullanıcının notu</span>
            <div className="quote">{r.note?.trim() || <span className="muted">Not eklenmemiş.</span>}</div>
          </div>

          <div className="col" style={{ gap: 8 }}>
            <span className="label-mono">Kanıt görselleri · {num(proofs.length)}</span>
            {data.proofErr && <InfoNote tone="warn">Görsellerin bağlantıları oluşturulamadı.</InfoNote>}
            {proofs.length === 0 ? <span className="small muted">Kanıt görseli eklenmemiş.</span> : (
              <div className="proof-grid">
                {proofs.map((p, i) => p.url ? (
                  <button key={p.path} type="button" className="proof" onClick={() => setZoom(i)} title="Büyüt">
                    <img src={p.url} alt={`Kanıt ${i + 1}`} loading="lazy" />
                  </button>
                ) : (
                  <div key={p.path} className="proof ph" title={p.path}><Icon n="broken_image" /></div>
                ))}
              </div>
            )}
          </div>

          <div className="col" style={{ gap: 8 }}>
            <span className="label-mono">Zaman çizelgesi</span>
            <ol className="timeline">
              <li className="done"><b>Gönderildi</b><span>{dateTime(r.created_at)} · paylaşım {dateTime(r.posted_at)}</span></li>
              <li className={elapsed ? 'done' : 'wait'}><b>{cfg.minHours} saat dolumu</b><span>{dateTime(new Date(due))}{elapsed ? ' · doldu' : ` · ${remainingText(due - now)}`}</span></li>
              <li className={r.reviewed_at ? (r.status === 'rejected' ? 'bad' : 'done') : 'wait'}>
                <b>{r.reviewed_at ? (r.status === 'approved' ? 'İncelendi · onaylandı' : 'İncelendi · reddedildi') : 'İnceleme bekleniyor'}</b>
                <span>{r.reviewed_at ? `${dateTime(r.reviewed_at)}${r.reviewer ? ` · ${r.reviewer.display_name}` : ''}` : '—'}</span>
              </li>
            </ol>
          </div>

          <Field label="Yönetici notu" error={noteErr} hint={r.status === 'pending' ? 'Reddederken zorunludur; not kullanıcıya bildirim olarak gönderilir.' : 'Kullanıcıya gönderilen karar notu.'}>
            <textarea className={`textarea ${noteErr ? 'bad' : ''}`} value={note} onChange={(e) => { setNote(e.target.value); if (noteErr) setNoteErr(null); }} disabled={!canReview} placeholder="Ör. Video 24 saat dolmadan kaldırılmış." />
          </Field>
          {canReview && r.status !== 'pending' && note !== (r.admin_note ?? '') && (
            <div><Btn size="sm" icon="save" loading={busy === 'note'} disabled={!!busy} onClick={saveNote}>Notu kaydet</Btn></div>
          )}

          {canAct && !elapsed && (
            <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" className="checkbox" checked={early} onChange={(e) => setEarly(e.target.checked)} />
              <span>{cfg.minHours} saat dolmadan onayla</span>
            </label>
          )}
          {canAct && approveBlocked && <InfoNote tone="warn">Video henüz {cfg.minHours} saat yayında kalmadı ({remainingText(due - now)}). Onay düğmesi süre dolunca açılır.</InfoNote>}
          {canReview && r.status === 'rejected' && <InfoNote>Bu başvuru reddedildi. Hatalı reddedildiyse yine de onaylayabilirsiniz.</InfoNote>}
          {!canReview && <InfoNote tone="warn">Rolünüz tanıtım başvurularını incelemeye izin vermiyor (yalnızca sahip, moderatör ve destek).</InfoNote>}
          <span className="tag">Kimlik: {r.id}</span>
        </>
      )}
      {zoom != null && proofs[zoom]?.url && (
        <Modal wide title={`Kanıt ${zoom + 1} / ${proofs.length}`} onClose={() => setZoom(null)} footer={proofs.length > 1 ? <>
          <Btn icon="chevron_left" disabled={zoom <= 0} onClick={() => setZoom(zoom - 1)}>Önceki</Btn>
          <Btn icon="chevron_right" disabled={zoom >= proofs.length - 1} onClick={() => setZoom(zoom + 1)}>Sonraki</Btn>
        </> : undefined}>
          <div className="proof-zoom"><img src={proofs[zoom].url!} alt={`Kanıt ${zoom + 1}`} /></div>
          <a className="small" href={proofs[zoom].url!} target="_blank" rel="noopener noreferrer">Yeni sekmede aç</a>
        </Modal>
      )}
    </Drawer>
  );
}
