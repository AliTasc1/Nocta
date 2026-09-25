import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mustAffect, unwrap, useLoad } from '../lib/data';
import { REPORT_PRIORITY, REPORT_STATUS, REPORT_TYPE } from '../lib/constants';
import { dateTime, relTime } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Badge, Btn, Chips, Drawer, Empty, ErrorBox, Field, InfoNote, Pager, Skel, SkelRows, useConfirm, useToast } from '../ui/ui';

type P = { id: string; display_name: string; status: string } | null;
type Report = {
  id: string; number: number; reporter_id: string | null; reported_user_id: string | null; couple_id: string | null; message_id: string | null;
  type: string; title: string; description: string; priority: string; status: string; admin_note: string; created_at: string; updated_at: string;
  reporter: P; reported: P;
};
type StatusF = 'all' | 'open' | 'in_review' | 'resolved' | 'dismissed';
const PAGE = 25;
const SELECT = '*, reporter:profiles!reports_reporter_id_fkey(id,display_name,status), reported:profiles!reports_reported_user_id_fkey(id,display_name,status)';

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<StatusF>('all');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(params.get('id'));

  useEffect(() => { setPage(0); }, [status, priority]);
  useEffect(() => { const id = params.get('id'); if (id) setOpenId(id); }, [params]);

  const counts = useLoad(async () => {
    const keys: StatusF[] = ['open', 'in_review', 'resolved', 'dismissed'];
    const res = await Promise.all(keys.map((k) => supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', k)));
    return Object.fromEntries(keys.map((k, i) => [k, res[i].count ?? 0])) as Record<string, number>;
  }, []);

  const list = useLoad(async () => {
    let qb = supabase.from('reports').select(SELECT, { count: 'exact' });
    if (status !== 'all') qb = qb.eq('status', status);
    if (priority) qb = qb.eq('priority', priority);
    const res = await qb.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (res.error) throw res.error;
    return { rows: (res.data ?? []) as unknown as Report[], total: res.count ?? 0 };
  }, [status, priority, page]);

  const close = () => { setOpenId(null); if (params.get('id')) setParams({}, { replace: true }); };
  const refresh = () => { list.reload(true); counts.reload(true); };
  const c = counts.data;
  const total = c ? Object.values(c).reduce((s, n) => s + n, 0) : null;

  return (
    <>
      <div className="tbl-card">
        <div className="tbl-head">
          <Chips value={status} onChange={setStatus} options={[
            { v: 'all', t: 'Tümü', n: total }, { v: 'open', t: 'Açık', n: c?.open }, { v: 'in_review', t: 'İncelemede', n: c?.in_review },
            { v: 'resolved', t: 'Çözüldü', n: c?.resolved }, { v: 'dismissed', t: 'Reddedildi', n: c?.dismissed },
          ]} />
          <select className="select sm auto" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Öncelik">
            <option value="">Tüm öncelikler</option>
            <option value="high">Yüksek</option>
            <option value="med">Orta</option>
            <option value="low">Düşük</option>
          </select>
        </div>
        {list.error ? <ErrorBox error={list.error} onRetry={() => list.reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl" style={{ minWidth: 900 }}>
              <thead><tr><th>Rapor</th><th>Tür</th><th>Bildiren</th><th>Bildirilen</th><th>Öncelik</th><th>Tarih</th><th>Durum</th></tr></thead>
              <tbody>
                {list.loading && !list.data ? <SkelRows cols={7} /> : !list.data?.rows.length ? (
                  <tr><td colSpan={7}><Empty icon="verified_user" title={status === 'all' && !priority ? 'Henüz rapor yok' : 'Bu filtrede rapor yok'}>Kullanıcıların uygulamadan gönderdiği şikâyetler burada listelenir.</Empty></td></tr>
                ) : list.data.rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => setOpenId(r.id)} style={{ opacity: list.loading ? 0.6 : 1 }}>
                    <td className="strong"><span className="ellipsis" style={{ display: 'block', maxWidth: 360 }}>#R-{r.number} · {r.title}</span></td>
                    <td className="m">{REPORT_TYPE[r.type] ?? r.type}</td>
                    <td className="m">{r.reporter?.display_name ?? (r.reporter_id ? '—' : 'sistem')}</td>
                    <td className="m">{r.reported?.display_name ?? '—'}{r.reported?.status === 'suspended' && <> <Badge tone="bad">ASKIDA</Badge></>}</td>
                    <td><Badge tone={REPORT_PRIORITY[r.priority]?.tone}>{REPORT_PRIORITY[r.priority]?.t ?? r.priority}</Badge></td>
                    <td className="m nowrap" title={dateTime(r.created_at)}>{relTime(r.created_at)}</td>
                    <td><Badge tone={REPORT_STATUS[r.status]?.tone}>{REPORT_STATUS[r.status]?.t ?? r.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE} total={list.data?.total ?? 0} onPage={setPage} unit="rapor" />
      </div>
      {openId && <ReportDrawer id={openId} onClose={close} onChanged={refresh} />}
    </>
  );
}

function ReportDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  const { data, error, loading, reload, setData } = useLoad(async () => {
    const r = unwrap(await supabase.from('reports').select(SELECT).eq('id', id).single()) as unknown as Report;
    let message: { body: string; kind: string; created_at: string; sender_id: string; meta: Record<string, unknown> } | null = null;
    let msgErr = false;
    if (r.message_id) {
      const m = await supabase.from('messages').select('body,kind,created_at,sender_id,meta').eq('id', r.message_id).maybeSingle();
      if (m.error) msgErr = true; else message = m.data;
    }
    let couple: { name_a: string; name_b: string | null; status: string } | null = null;
    if (r.couple_id) {
      const c = await supabase.from('couples').select('status, a:profiles!couples_user_a_fkey(display_name), b:profiles!couples_user_b_fkey(display_name)').eq('id', r.couple_id).maybeSingle();
      const cd = c.data as unknown as { status: string; a: { display_name: string } | null; b: { display_name: string } | null } | null;
      if (cd) couple = { name_a: cd.a?.display_name ?? '—', name_b: cd.b?.display_name ?? null, status: cd.status };
    }
    return { r, message, msgErr, couple };
  }, [id]);

  useEffect(() => { if (data) setNote(data.r.admin_note ?? ''); }, [data?.r.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (patch: Partial<Report>, msg: string, key: string) => {
    setBusy(key);
    try {
      mustAffect(await supabase.from('reports').update(patch).eq('id', id).select('id'));
      setData((d) => (d ? { ...d, r: { ...d.r, ...patch } } : d));
      toast.success(msg);
      onChanged();
    } catch (e) { toast.error(e); } finally { setBusy(''); }
  };

  const suspend = async (u: NonNullable<P>) => {
    const suspend = u.status !== 'suspended';
    if (suspend) {
      const ok = await confirm({ title: 'Kullanıcı askıya alınsın mı?', body: <><b style={{ color: 'var(--text)' }}>{u.display_name}</b> askıya alındığında uygulamayı kullanamaz.</>, confirm: 'Askıya al', danger: true });
      if (!ok) return;
    }
    setBusy('suspend');
    try {
      const status = suspend ? 'suspended' : 'active';
      mustAffect(await supabase.from('profiles').update({ status }).eq('id', u.id).select('id'));
      setData((d) => (d && d.r.reported ? { ...d, r: { ...d.r, reported: { ...d.r.reported, status } } } : d));
      toast.success(suspend ? 'Kullanıcı askıya alındı.' : 'Kullanıcının askısı kaldırıldı.');
      onChanged();
    } catch (e) { toast.error(e); } finally { setBusy(''); }
  };

  const r = data?.r;
  const canEdit = perms.reports;
  return (
    <Drawer onClose={onClose} sub={r ? `#R-${r.number} · ${REPORT_TYPE[r.type] ?? r.type}` : 'RAPOR'} title={r?.title ?? (error ? 'Rapor' : 'Yükleniyor…')}
      footer={r && canEdit ? <>
        {r.status === 'open' && <Btn icon="visibility" loading={busy === 'rev'} disabled={!!busy} onClick={() => update({ status: 'in_review' }, 'Rapor incelemeye alındı.', 'rev')}>İncelemeye al</Btn>}
        {r.status !== 'resolved' && <Btn variant="primary" icon="check" loading={busy === 'res'} disabled={!!busy} onClick={() => update({ status: 'resolved', admin_note: note }, 'Rapor çözüldü olarak işaretlendi.', 'res')}>Çözüldü</Btn>}
        {r.status !== 'dismissed' && <Btn icon="block" loading={busy === 'dis'} disabled={!!busy} onClick={() => update({ status: 'dismissed', admin_note: note }, 'Rapor reddedildi.', 'dis')}>Reddet</Btn>}
        {(r.status === 'resolved' || r.status === 'dismissed') && <Btn icon="undo" loading={busy === 're'} disabled={!!busy} onClick={() => update({ status: 'open' }, 'Rapor yeniden açıldı.', 're')}>Yeniden aç</Btn>}
      </> : undefined}>
      {error ? <ErrorBox error={error} onRetry={() => reload()} /> : loading && !data ? <div className="col"><Skel h={20} /><Skel h={80} /><Skel h={20} w="60%" /></div> : r && (
        <>
          <div className="row wrap" style={{ gap: 8 }}>
            <Badge tone={REPORT_STATUS[r.status]?.tone}>{REPORT_STATUS[r.status]?.t}</Badge>
            <Badge tone={REPORT_PRIORITY[r.priority]?.tone}>{REPORT_PRIORITY[r.priority]?.t} ÖNCELİK</Badge>
          </div>
          <div className="kv">
            <span>Oluşturulma</span><span>{dateTime(r.created_at)}</span>
            <span>Son güncelleme</span><span>{dateTime(r.updated_at)}</span>
            <span>Bildiren</span><span>{r.reporter?.display_name ?? (r.reporter_id ? 'Silinmiş kullanıcı' : 'Sistem')}</span>
            <span>Bildirilen</span><span>{r.reported ? <>{r.reported.display_name} {r.reported.status === 'suspended' && <Badge tone="bad">ASKIDA</Badge>}</> : '—'}</span>
            {data.couple && <><span>Çift</span><span>{data.couple.name_a}{data.couple.name_b ? ` & ${data.couple.name_b}` : ''}</span></>}
          </div>
          {canEdit && (
            <Field label="Öncelik">
              <select className="select sm" value={r.priority} disabled={!!busy} onChange={(e) => update({ priority: e.target.value }, 'Öncelik güncellendi.', 'pri')}>
                <option value="high">Yüksek</option><option value="med">Orta</option><option value="low">Düşük</option>
              </select>
            </Field>
          )}
          <div className="col"><span className="label-mono">Açıklama</span><div className="quote">{r.description || <span className="muted">Açıklama girilmemiş.</span>}</div></div>
          {r.message_id && (
            <div className="col">
              <span className="label-mono">Bildirilen mesaj</span>
              {data.msgErr ? <InfoNote tone="warn">Mesaj okunamadı.</InfoNote> : data.message ? (
                <div className="quote">
                  <div className="tag" style={{ marginBottom: 6 }}>{dateTime(data.message.created_at)} · {data.message.kind === 'photo' ? 'Fotoğraf' : data.message.kind === 'challenge' ? 'Görev' : 'Metin'}</div>
                  {data.message.body || <span className="muted">(boş mesaj)</span>}
                </div>
              ) : <InfoNote tone="warn">Mesaj silinmiş ya da süresi dolmuş.</InfoNote>}
            </div>
          )}
          {r.reported && perms.moderateUsers && (
            <div className="row wrap">
              <Btn variant={r.reported.status === 'suspended' ? 'default' : 'danger'} icon={r.reported.status === 'suspended' ? 'check_circle' : 'block'} loading={busy === 'suspend'} disabled={!!busy} onClick={() => suspend(r.reported!)}>
                {r.reported.status === 'suspended' ? 'Askıyı kaldır' : 'Kullanıcıyı askıya al'}
              </Btn>
            </div>
          )}
          <Field label="Yönetici notu" hint="Yalnızca yöneticiler görür.">
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} disabled={!canEdit} placeholder="İnceleme notu ekleyin…" />
          </Field>
          {canEdit && note !== (r.admin_note ?? '') && (
            <div><Btn size="sm" icon="save" loading={busy === 'note'} disabled={!!busy} onClick={() => update({ admin_note: note }, 'Not kaydedildi.', 'note')}>Notu kaydet</Btn></div>
          )}
          {!canEdit && <InfoNote tone="warn">Rolünüz raporları güncellemeye izin vermiyor.</InfoNote>}
          <span className="tag">Kimlik: {r.id}</span>
        </>
      )}
    </Drawer>
  );
}
