import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { mustAffect, unwrap, useLoad } from '../lib/data';
import { LEVELS, ROLE_LABEL, ROLE_TONE, type Role } from '../lib/constants';
import { dateTime, initials, relTime } from '../lib/format';
import { useAuth, type AdminRow } from '../auth/AuthContext';
import { Badge, Btn, Empty, ErrorBox, Field, InfoNote, Modal, RowMenu, Skel, SkelRows, ToggleRow, useConfirm, useToast } from '../ui/ui';

type SettingRow = { key: string; value: unknown; is_public: boolean; updated_at: string };
type Form = {
  free_max_level: number; support_email: string; min_app_version: string;
  announcement_on: boolean; announcement: string; price_monthly: string; price_yearly: string; owner_email: string;
};

const ROLES: Role[] = ['owner', 'moderator', 'content', 'support'];
const ROLE_DESC: Record<Role, string> = {
  owner: 'Her şey: yöneticiler, ödemeler, kullanıcı silme',
  moderator: 'Raporlar, kullanıcı askıya alma, çift bağlantıları',
  content: 'Oyunlar, kategoriler, sorular, hikâyeler, uygulama ayarları',
  support: 'Raporlar, abonelikler ve premium tanımlama',
};

const str = (v: unknown) => (v == null ? '' : typeof v === 'string' ? v : String(v));

export default function Settings() {
  return (
    <>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <AppSettings />
        <Account />
      </div>
      <Admins />
    </>
  );
}

function AppSettings() {
  const { perms, role } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(async () => unwrap(await supabase.from('app_settings').select('*').order('key')) as SettingRow[], []);
  const map = useMemo(() => Object.fromEntries((data ?? []).map((r) => [r.key, r])), [data]);
  const initial = useMemo<Form>(() => ({
    free_max_level: Number(map.free_max_level?.value ?? 1),
    support_email: str(map.support_email?.value),
    min_app_version: str(map.min_app_version?.value),
    announcement_on: map.announcement?.value != null && str(map.announcement?.value).trim() !== '',
    announcement: str(map.announcement?.value),
    price_monthly: str((map.prices?.value as any)?.monthly ?? ''),
    price_yearly: str((map.prices?.value as any)?.yearly ?? ''),
    owner_email: str(map.owner_email?.value),
  }), [map]);
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setF(initial); }, [initial]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const canEdit = perms.settings;

  const save = async () => {
    setErr(null);
    if (f.support_email && !/^\S+@\S+\.\S+$/.test(f.support_email.trim())) return setErr('Destek e-postası geçerli değil.');
    if (f.min_app_version && !/^\d+(\.\d+){0,2}$/.test(f.min_app_version.trim())) return setErr('Minimum sürüm 1.2.3 biçiminde olmalı.');
    const pm = f.price_monthly.trim() === '' ? null : Number(f.price_monthly.replace(',', '.'));
    const py = f.price_yearly.trim() === '' ? null : Number(f.price_yearly.replace(',', '.'));
    if ((pm != null && !(pm >= 0)) || (py != null && !(py >= 0))) return setErr('Fiyatlar geçerli bir sayı olmalı.');
    if (f.announcement_on && !f.announcement.trim()) return setErr('Duyuru metni boş olamaz. Duyuruyu kapatmak için anahtarı kapatın.');
    if (role === 'owner' && f.owner_email && !/^\S+@\S+\.\S+$/.test(f.owner_email.trim())) return setErr('Sahip e-postası geçerli değil.');

    const upserts: { key: string; value: unknown; is_public: boolean }[] = [
      { key: 'free_max_level', value: f.free_max_level, is_public: true },
    ];
    const deletes: string[] = [];
    const strOrDel = (key: string, v: string) => (v.trim() ? upserts.push({ key, value: v.trim(), is_public: true }) : map[key] && deletes.push(key));
    strOrDel('support_email', f.support_email);
    strOrDel('min_app_version', f.min_app_version);
    if (f.announcement_on) upserts.push({ key: 'announcement', value: f.announcement.trim(), is_public: true });
    else if (map.announcement) deletes.push('announcement');
    upserts.push({ key: 'prices', value: { ...((map.prices?.value as any) ?? {}), monthly: pm ?? 139, yearly: py ?? 899, currency: 'TRY' }, is_public: true });
    if (role === 'owner' && f.owner_email.trim() && f.owner_email.trim() !== initial.owner_email) upserts.push({ key: 'owner_email', value: f.owner_email.trim().toLowerCase(), is_public: false });

    // Yalnızca değişenleri yaz
    const changed = upserts.filter((u) => JSON.stringify(map[u.key]?.value) !== JSON.stringify(u.value) || !map[u.key]);
    setBusy(true);
    try {
      if (changed.length) mustAffect(await supabase.from('app_settings').upsert(changed.map((c) => ({ ...c, updated_at: new Date().toISOString() })), { onConflict: 'key' }).select('key'));
      if (deletes.length) mustAffect(await supabase.from('app_settings').delete().in('key', deletes).select('key'));
      toast.success('Ayarlar kaydedildi. Uygulama bir sonraki açılışta yeni ayarları kullanır.');
      reload(true);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  const cv = map.content_version;
  return (
    <div className="card">
      <div className="card-h"><span className="card-t">Uygulama ayarları</span>{cv && <span className="tag" title={`Sürüm ${str(cv.value)}`}>İçerik sürümü: {relTime(cv.updated_at)}</span>}</div>
      {error ? <ErrorBox error={error} onRetry={() => reload()} /> : loading && !data ? <div className="col"><Skel h={44} /><Skel h={44} /><Skel h={44} /><Skel h={90} /></div> : (
        <>
          {!canEdit && <InfoNote tone="warn">Ayarları yalnızca sahip ve içerik editörleri değiştirebilir.</InfoNote>}
          <Field label="Ücretsiz kullanıcılar için en yüksek seviye" hint="Premium olmayan çiftler bu seviyenin üstündeki içerikleri göremez.">
            <select className="select" value={f.free_max_level} onChange={(e) => set('free_max_level', Number(e.target.value))} disabled={!canEdit}>
              {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.v} · {l.t}</option>)}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Destek e-postası"><input className="input" type="email" value={f.support_email} onChange={(e) => set('support_email', e.target.value)} disabled={!canEdit} placeholder="destek@nocta.app" /></Field>
            <Field label="Minimum uygulama sürümü" hint="Daha eski sürümler güncellemeye zorlanır."><input className="input mono" value={f.min_app_version} onChange={(e) => set('min_app_version', e.target.value)} disabled={!canEdit} placeholder="1.0.0" /></Field>
            <Field label="Aylık fiyat (₺)"><input className="input" inputMode="decimal" value={f.price_monthly} onChange={(e) => set('price_monthly', e.target.value)} disabled={!canEdit} placeholder="139" /></Field>
            <Field label="Yıllık fiyat (₺)"><input className="input" inputMode="decimal" value={f.price_yearly} onChange={(e) => set('price_yearly', e.target.value)} disabled={!canEdit} placeholder="899" /></Field>
          </div>
          <ToggleRow label="Uygulama içi duyuru" sub="Açıkken tüm kullanıcılara uygulamanın üstünde bant olarak gösterilir." on={f.announcement_on} onChange={(v) => set('announcement_on', v)} disabled={!canEdit} />
          {f.announcement_on && (
            <>
              <Field label="Duyuru metni" right={<span className="muted2">{f.announcement.length} / 200</span>}>
                <textarea className="textarea" value={f.announcement} maxLength={200} onChange={(e) => set('announcement', e.target.value)} disabled={!canEdit} style={{ minHeight: 72 }} placeholder="Yeni hikâye yayında: Gece Yarısı Kaçamağı ♡" />
              </Field>
              {f.announcement.trim() && <div className="banner-preview"><span className="ms" style={{ color: 'var(--pink)' }}>campaign</span><span style={{ overflowWrap: 'anywhere' }}>{f.announcement}</span></div>}
            </>
          )}
          {role === 'owner' && (
            <Field label="Sahip e-postası (ilk yönetici)" hint="İlk yönetici hesabının talep edilebilmesi için kullanılır; uygulamaya gösterilmez.">
              <input className="input" type="email" value={f.owner_email} onChange={(e) => set('owner_email', e.target.value)} />
            </Field>
          )}
          {err && <InfoNote tone="bad">{err}</InfoNote>}
          {canEdit && (
            <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
              <Btn onClick={() => setF(initial)} disabled={!dirty || busy}>Geri al</Btn>
              <Btn variant="primary" icon="save" loading={busy} disabled={!dirty} onClick={save}>Kaydet</Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Account() {
  const { admin, session, signOut } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const change = async () => {
    setErr(null);
    if (pw.length < 6) return setErr('Şifre en az 6 karakter olmalı.');
    if (pw !== pw2) return setErr('Şifreler eşleşmiyor.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error);
    setPw(''); setPw2('');
    toast.success('Şifreniz değiştirildi.');
  };
  return (
    <div className="card">
      <span className="card-t">Hesabım</span>
      <div className="row" style={{ gap: 12 }}>
        <span className="avatar">{initials(admin?.display_name || admin?.email)}</span>
        <div className="col grow" style={{ gap: 2 }}>
          <b className="ellipsis">{admin?.display_name || '—'}</b>
          <span className="small muted ellipsis">{session?.user.email}</span>
        </div>
        {admin && <Badge tone={ROLE_TONE[admin.role]}>{ROLE_LABEL[admin.role].toLocaleUpperCase('tr-TR')}</Badge>}
      </div>
      <div className="kv">
        <span>Yetkiler</span><span>{admin ? ROLE_DESC[admin.role] : '—'}</span>
        <span>Son giriş</span><span>{dateTime(admin?.last_login_at)}</span>
      </div>
      <hr className="divider" />
      <span className="small muted" style={{ fontWeight: 600 }}>Şifre değiştir</span>
      <div className="form-grid">
        <Field label="Yeni şifre"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Yeni şifre (tekrar)"><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
      </div>
      {err && <InfoNote tone="bad">{err}</InfoNote>}
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <Btn icon="logout" variant="ghost" onClick={signOut}>Çıkış yap</Btn>
        <Btn variant="primary" icon="key" loading={busy} disabled={!pw || !pw2} onClick={change}>Şifreyi değiştir</Btn>
      </div>
    </div>
  );
}

function Admins() {
  const { perms, session } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload, setData } = useLoad(async () => unwrap(await supabase.from('admins').select('*').order('created_at')) as AdminRow[], []);
  const me = session?.user.id;
  const rows = data ?? [];
  const owners = rows.filter((r) => r.role === 'owner' && r.active).length;

  const patch = async (a: AdminRow, p: Partial<AdminRow>, msg: string) => {
    try {
      mustAffect(await supabase.from('admins').update(p).eq('user_id', a.user_id).select('user_id'));
      setData((d) => d?.map((x) => (x.user_id === a.user_id ? { ...x, ...p } : x)) ?? null);
      toast.success(msg);
    } catch (e) { toast.error(e); }
  };
  const deactivate = async (a: AdminRow) => {
    const ok = await confirm({ title: 'Yönetici devre dışı bırakılsın mı?', body: <><b style={{ color: 'var(--text)' }}>{a.display_name || a.email}</b> panele erişemez. Daha sonra yeniden etkinleştirebilirsiniz.</>, confirm: 'Devre dışı bırak', danger: true });
    if (ok) patch(a, { active: false }, 'Yönetici devre dışı bırakıldı.');
  };
  const remove = async (a: AdminRow) => {
    const ok = await confirm({ title: 'Yönetici kaldırılsın mı?', body: <><b style={{ color: 'var(--text)' }}>{a.display_name || a.email}</b> yönetici listesinden silinir. Kullanıcı hesabı silinmez.</>, confirm: 'Kaldır', danger: true });
    if (!ok) return;
    try {
      mustAffect(await supabase.from('admins').delete().eq('user_id', a.user_id).select('user_id'));
      toast.success('Yönetici kaldırıldı.');
      reload(true);
    } catch (e) { toast.error(e); }
  };

  return (
    <div className="tbl-card">
      <div className="tbl-head">
        <span className="card-t">Yöneticiler <span className="muted small" style={{ fontWeight: 500 }}>· {rows.length} kişi</span></span>
        {perms.admins && <Btn variant="primary" icon="person_add" onClick={() => setAdding(true)}>Yönetici ekle</Btn>}
      </div>
      {error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Yönetici</th><th>Rol</th><th>Son giriş</th><th>Eklenme</th><th>Durum</th><th /></tr></thead>
            <tbody>
              {loading && !data ? <SkelRows rows={3} cols={6} /> : rows.length === 0 ? (
                <tr><td colSpan={6}><Empty icon="admin_panel_settings" title="Yönetici yok" /></td></tr>
              ) : rows.map((a) => {
                const self = a.user_id === me;
                const lastOwner = a.role === 'owner' && owners <= 1;
                return (
                  <tr key={a.user_id}>
                    <td><div className="cell-main"><span className="avatar sm">{initials(a.display_name || a.email)}</span><span className="txt"><span className="strong">{a.display_name || '—'}{self && <span className="tag"> · sen</span>}</span><span className="small muted2">{a.email}</span></span></div></td>
                    <td>
                      {perms.admins && !self ? (
                        <select className="select sm auto" value={a.role} disabled={lastOwner} onChange={(e) => patch(a, { role: e.target.value as Role }, 'Rol güncellendi.')} aria-label="Rol">
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      ) : <Badge tone={ROLE_TONE[a.role]}>{ROLE_LABEL[a.role].toLocaleUpperCase('tr-TR')}</Badge>}
                    </td>
                    <td className="m nowrap">{relTime(a.last_login_at)}</td>
                    <td className="m nowrap">{dateTime(a.created_at)}</td>
                    <td>{a.active ? <Badge tone="ok">AKTİF</Badge> : <Badge tone="mute">PASİF</Badge>}</td>
                    <td className="act">
                      {perms.admins && !self && (
                        <RowMenu items={[
                          { label: 'Etkinleştir', icon: 'check_circle', hidden: a.active, onClick: () => patch(a, { active: true }, 'Yönetici etkinleştirildi.') },
                          { label: 'Devre dışı bırak', icon: 'block', hidden: !a.active, disabled: lastOwner, onClick: () => deactivate(a) },
                          'sep',
                          { label: 'Yöneticilikten çıkar', icon: 'person_remove', danger: true, disabled: lastOwner, onClick: () => remove(a) },
                        ]} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="tbl-foot">
        <span>{perms.admins ? 'Kendi rolünüzü değiştiremez, kendinizi devre dışı bırakamazsınız.' : 'Yöneticileri yalnızca sahip yönetebilir.'}</span>
      </div>
      {adding && <AddAdmin onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(true); }} />}
    </div>
  );
}

function AddAdmin({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('content');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const submit = async () => {
    setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Geçerli bir e-posta adresi girin.');
    setBusy(true);
    try {
      unwrap(await supabase.rpc('admin_add', { p_email: email.trim(), p_role: role, p_name: name.trim() }));
      toast.success('Yönetici eklendi.');
      onDone();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Yönetici ekle" sub="Kişinin önce uygulamadan ya da bu panelden “Hesap oluştur” ile kayıt olması gerekir." onClose={onClose} busy={busy}
      footer={<><Btn onClick={onClose} disabled={busy}>Vazgeç</Btn><Btn variant="primary" icon="person_add" loading={busy} onClick={submit}>Ekle</Btn></>}>
      <Field label="E-posta"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
      <Field label="Görünen ad" hint="Boş bırakılırsa e-postadan türetilir."><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="field">
        <span className="lbl">Rol</span>
        <div className="col" style={{ gap: 6 }}>
          {ROLES.map((r) => (
            <label key={r} className="story-item" style={{ cursor: 'pointer', borderColor: role === r ? 'rgba(231,104,138,.4)' : undefined, background: role === r ? 'rgba(231,104,138,.08)' : undefined }}>
              <input type="radio" name="role" className="checkbox" checked={role === r} onChange={() => setRole(r)} />
              <span className="col" style={{ gap: 2 }}><b>{ROLE_LABEL[r]}</b><span className="small muted">{ROLE_DESC[r]}</span></span>
            </label>
          ))}
        </div>
      </div>
      {err && <InfoNote tone="bad">{err}</InfoNote>}
    </Modal>
  );
}
