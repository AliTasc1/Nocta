import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mustAffect, unwrap, useLoad } from '../lib/data';
import { loadAnalytics } from '../lib/analytics';
import { normalizeMedia, removeCardImages } from '../lib/cardImages';
import { ENGINES, ENGINE_LABEL, QUESTION_ENGINES, type Engine } from '../lib/constants';
import { num, pct, slugify } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import {
  Badge, Btn, ColorField, ContentNote, Empty, ErrorBox, Field, Icon, IconField, InfoNote, Modal, RowMenu, SkelRows, ToggleRow,
  useConfirm, useToast,
} from '../ui/ui';

export type Game = {
  id: string; slug: string; engine: Engine; name: string; description: string; icon: string; color: string;
  duration_label: string; rounds: number; is_premium: boolean; is_active: boolean; sort: number;
  categories?: { count: number }[];
};
type Stat = { id: string; plays_30: number; completion: number | null };

const blank = (sort: number): Omit<Game, 'id'> => ({
  slug: '', engine: 'truth_dare', name: '', description: '', icon: 'favorite', color: '#2A1530',
  duration_label: '10–15 dk', rounds: 10, is_premium: false, is_active: true, sort,
});

export default function Games() {
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [edit, setEdit] = useState<(Omit<Game, 'id'> & { id?: string }) | null>(null);
  /** Oyunun içeriğine giden yol: hikâye → Hikâyeler, test → Testler, görev → Görevler, diğerleri → Sorular (oyun filtresiyle). */
  const contentPath = (g: Game) => g.engine === 'story' ? '/hikayeler' : g.engine === 'quiz' ? `/testler?oyun=${g.id}` : g.engine === 'challenges' ? `/gorevler?oyun=${g.id}` : QUESTION_ENGINES.includes(g.engine) ? `/sorular?oyun=${g.id}` : null;

  const { data, error, loading, reload, setData } = useLoad(async () =>
    unwrap(await supabase.from('games').select('*, categories(count)').order('sort').order('created_at')) as Game[], []);
  const stats = useLoad(async () => {
    const r = await loadAnalytics();
    return Object.fromEntries((r.games ?? []).map((g) => [g.id, g])) as Record<string, Stat>;
  }, []);

  const games = data ?? [];
  const toggle = async (g: Game, key: 'is_active' | 'is_premium') => {
    const v = !g[key];
    setData((d) => d?.map((x) => (x.id === g.id ? { ...x, [key]: v } : x)) ?? null);
    try {
      mustAffect(await supabase.from('games').update({ [key]: v }).eq('id', g.id).select('id'));
      toast.success(key === 'is_active' ? (v ? 'Oyun yayına alındı.' : 'Oyun yayından kaldırıldı.') : v ? 'Oyun premium yapıldı.' : 'Oyun ücretsiz yapıldı.');
    } catch (e) {
      setData((d) => d?.map((x) => (x.id === g.id ? { ...x, [key]: !v } : x)) ?? null);
      toast.error(e);
    }
  };

  const remove = async (g: Game) => {
    const cats = g.categories?.[0]?.count ?? 0;
    const ok = await confirm({
      title: 'Oyun silinsin mi?',
      body: <><b style={{ color: 'var(--text)' }}>{g.name}</b> ile birlikte {num(cats)} kategori, bu kategorilerdeki tüm sorular ve oyunun tüm oturum geçmişi kalıcı olarak silinir. Genellikle oyunu <b>pasife almak</b> daha güvenlidir.</>,
      confirm: 'Kalıcı olarak sil', danger: true, typeToConfirm: g.name,
    });
    if (!ok) return;
    try {
      // Kart Seç: oyunla birlikte silinecek soruların görselleri depodan da kaldırılır (en iyi çaba)
      let imgs: string[] = [];
      if (g.engine === 'cards') {
        const m = await supabase.from('questions').select('media,category:categories!inner(game_id)').eq('category.game_id', g.id).limit(10000);
        imgs = ((m.data ?? []) as { media: unknown }[]).flatMap((x) => normalizeMedia(x.media));
      }
      mustAffect(await supabase.from('games').delete().eq('id', g.id).select('id'));
      if (imgs.length) void removeCardImages(imgs);
      toast.success('Oyun silindi.');
      reload(true);
    } catch (e) { toast.error(e); }
  };

  return (
    <>
      <ContentNote />
      {!perms.content && <InfoNote tone="warn">Rolünüz içerik düzenlemeye izin vermiyor; bu bölümü yalnızca görüntüleyebilirsiniz.</InfoNote>}
      <div className="tbl-card">
        <div className="tbl-head">
          <span className="card-t">Oyunlar <span className="muted small" style={{ fontWeight: 500 }}>· {num(games.length)} oyun · {num(games.filter((g) => g.is_premium).length)} premium</span></span>
          {perms.content && <Btn variant="primary" icon="add" onClick={() => setEdit(blank((games.at(-1)?.sort ?? 0) + 10))}>Yeni oyun</Btn>}
        </div>
        {error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl" style={{ minWidth: 980 }}>
              <thead><tr><th>Oyun</th><th>Motor</th><th>Kategori</th><th>Süre</th><th>Oynanma · 30g</th><th>Tamamlama</th><th>Sıra</th><th>Durum</th><th /></tr></thead>
              <tbody>
                {loading && !data ? <SkelRows cols={10} /> : games.length === 0 ? (
                  <tr><td colSpan={10}><Empty icon="playing_cards" title="Henüz oyun yok" action={perms.content ? <Btn variant="primary" icon="add" onClick={() => setEdit(blank(10))}>Yeni oyun</Btn> : undefined}>Uygulamada görünen oyunları buradan oluşturup düzenleyebilirsiniz.</Empty></td></tr>
                ) : games.map((g) => {
                  const s = stats.data?.[g.id];
                  return (
                    <tr key={g.id} className={perms.content ? 'click' : ''} onClick={() => perms.content && setEdit(g)}>
                      <td>
                        <div className="cell-main">
                          <span className="swatch" style={{ background: g.color }}><Icon n={g.icon} /></span>
                          <span className="txt"><span className="strong">{g.name}</span><span className="tag">{g.slug}</span></span>
                        </div>
                      </td>
                      <td className="m">{ENGINE_LABEL[g.engine]}</td>
                      <td className="num">{g.engine === 'story' ? <Link to="/hikayeler" onClick={(e) => e.stopPropagation()}>Hikâyeler</Link> : g.engine === 'quiz' ? <Link to={`/testler?oyun=${g.id}`} onClick={(e) => e.stopPropagation()}>{num(g.categories?.[0]?.count ?? 0)} test</Link> : <Link to={`/kategoriler?oyun=${g.id}`} onClick={(e) => e.stopPropagation()}>{num(g.categories?.[0]?.count ?? 0)}</Link>}</td>
                      <td className="m nowrap">{g.duration_label || '—'}</td>
                      <td className="num">{stats.loading ? <span className="skel" style={{ display: 'inline-block', width: 40, height: 12 }} /> : s ? num(s.plays_30) : '—'}</td>
                      <td className="num">{stats.loading ? <span className="skel" style={{ display: 'inline-block', width: 30, height: 12 }} /> : s?.completion != null ? pct(s.completion, 0) : '—'}</td>
                      <td className="m">{num(g.sort)}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {g.is_active ? <Badge tone="ok">AKTİF</Badge> : <Badge tone="mute">PASİF</Badge>}
                          {g.is_premium && <Badge tone="pro">PREMIUM</Badge>}
                        </div>
                      </td>
                      <td className="act">
                        {perms.content && (
                          <RowMenu items={[
                            { label: 'Düzenle', icon: 'edit', onClick: () => setEdit(g) },
                            { label: 'Kategoriler', icon: 'category', onClick: () => navigate(`/kategoriler?oyun=${g.id}`), hidden: g.engine === 'story' || g.engine === 'quiz' },
                            { label: g.engine === 'challenges' ? 'Görevleri gör' : g.engine === 'quiz' ? 'Testleri gör' : g.engine === 'story' ? 'Hikâyeler' : 'Soruları gör', icon: 'list', onClick: () => { const p = contentPath(g); if (p) navigate(p); }, hidden: !contentPath(g) },
                            { label: g.is_active ? 'Yayından kaldır' : 'Yayına al', icon: g.is_active ? 'visibility_off' : 'visibility', onClick: () => toggle(g, 'is_active') },
                            { label: g.is_premium ? 'Ücretsiz yap' : 'Premium yap', icon: 'workspace_premium', onClick: () => toggle(g, 'is_premium') },
                            'sep',
                            { label: 'Sil', icon: 'delete', danger: true, onClick: () => remove(g) },
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
          <span>{stats.error ? 'Oynanma istatistikleri alınamadı.' : 'Oynanma: son 30 gün · Tamamlama: başlayan oturumların bitirilme oranı'}</span>
        </div>
      </div>
      {edit && <GameModal game={edit} existing={games} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(true); }} />}
    </>
  );
}

function GameModal({ game, existing, onClose, onSaved }: { game: Omit<Game, 'id'> & { id?: string }; existing: Game[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(game);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const isNew = !game.id;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const uniqueSlug = (base: string) => {
    const taken = new Set(existing.filter((g) => g.id !== game.id).map((g) => g.slug));
    let s = base; let i = 2;
    while (taken.has(s)) s = `${base}-${i++}`;
    return s;
  };

  const save = async () => {
    setErr(null);
    if (f.name.trim().length < 2) return setErr('Oyun adı en az 2 karakter olmalı.');
    if (!/^#[0-9a-fA-F]{6}$/.test(f.color)) return setErr('Renk #RRGGBB biçiminde olmalı.');
    setBusy(true);
    const payload = {
      name: f.name.trim(), description: f.description.trim(), icon: f.icon || 'favorite', color: f.color,
      duration_label: f.duration_label.trim(), rounds: Math.round(f.rounds), is_premium: f.is_premium, is_active: f.is_active, sort: Math.round(f.sort) || 0,
    };
    try {
      if (isNew) {
        unwrap(await supabase.from('games').insert({ ...payload, engine: f.engine, slug: uniqueSlug(slugify(f.name)) }).select('id').single());
        toast.success('Oyun oluşturuldu.');
      } else {
        mustAffect(await supabase.from('games').update(payload).eq('id', game.id!).select('id'));
        toast.success('Oyun kaydedildi.');
      }
      onSaved();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={isNew ? 'Yeni oyun' : f.name || 'Oyunu düzenle'} sub={isNew ? `Yeni oyun, mevcut ${ENGINES.length} oyun motorundan birini kullanır.` : `Kısa ad: ${game.slug}`} onClose={onClose} busy={busy}
      footer={<><Btn onClick={onClose} disabled={busy}>Vazgeç</Btn><Btn variant="primary" icon="check" loading={busy} onClick={save}>{isNew ? 'Oluştur' : 'Kaydet'}</Btn></>}>
      <div className="form-grid">
        <Field label="Oyun adı"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={80} autoFocus /></Field>
        <Field label="Oyun motoru" hint={isNew ? `Kısa ad: ${f.name ? uniqueSlug(slugify(f.name)) : '—'}` : 'Motor oluşturulduktan sonra değiştirilemez.'}>
          <select className="select" value={f.engine} onChange={(e) => set('engine', e.target.value as Engine)} disabled={!isNew}>
            {ENGINES.map((e) => <option key={e} value={e}>{ENGINE_LABEL[e]}</option>)}
          </select>
        </Field>
        {isNew && f.engine === 'quiz' && <div className="full"><InfoNote>Test motorlu oyunlarda her kategori bir testtir. Testleri ve sorularını <b>Testler</b> bölümünden yönetebilirsiniz.</InfoNote></div>}
        {isNew && f.engine === 'emoji' && <div className="full"><InfoNote>Emoji motoru: her soruda 2–6 emoji şık bulunur; isteğe bağlı doğru cevap (A–F) seçilir, seçilmezse eşleşme modunda oynanır. Kategorileri <b>Kategoriler</b>, soruları <b>Sorular</b> bölümünden (motor filtresi: Emoji) yönetin.</InfoNote></div>}
        {isNew && f.engine === 'cards' && <div className="full"><InfoNote>Kart Seç motoru: her soruda 2–6 resimli kart bulunur, doğru cevap yoktur (partnerler aynı kartı seçmeye çalışır). Kart görsellerini soru düzenleyicisinden yükleyin (en fazla 5 MB).</InfoNote></div>}
        <Field label="Açıklama" className="full"><textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={300} style={{ minHeight: 72 }} /></Field>
        <Field label="Süre etiketi" hint="Ör. 10–15 dk"><input className="input" value={f.duration_label} onChange={(e) => set('duration_label', e.target.value)} maxLength={30} /></Field>
        <Field label="Sıra" hint="Küçük değer önce gösterilir"><input className="input" type="number" value={f.sort} onChange={(e) => set('sort', Number(e.target.value))} /></Field>
        <IconField label="Simge" value={f.icon} onChange={(v) => set('icon', v)} />
        <ColorField label="Renk" value={f.color} onChange={(v) => set('color', v)} />
        <div className="full col" style={{ gap: 4 }}>
          <ToggleRow label="Aktif" sub="Pasif oyunlar uygulamada görünmez." on={f.is_active} onChange={(v) => set('is_active', v)} />
          <ToggleRow label="Premium" sub="Yalnızca premium çiftler oynayabilir." on={f.is_premium} onChange={(v) => set('is_premium', v)} />
        </div>
      </div>
      {err && <InfoNote tone="bad">{err}</InfoNote>}
    </Modal>
  );
}
