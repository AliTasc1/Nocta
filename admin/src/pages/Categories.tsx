import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mustAffect, unwrap, useLoad } from '../lib/data';
import { ENGINE_LABEL, QUESTION_ENGINES, type Engine } from '../lib/constants';
import { normalizeMedia, removeCardImages } from '../lib/cardImages';
import { num } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import {
  Badge, Btn, ColorField, ContentNote, Empty, ErrorBox, Field, Icon, IconField, InfoNote, Modal, RowMenu, SkelRows, ToggleRow,
  useConfirm, useToast,
} from '../ui/ui';

type GameLite = { id: string; name: string; engine: Engine; sort: number };
export type Category = {
  id: string; game_id: string; name: string; description: string; icon: string; color: string;
  is_premium: boolean; is_active: boolean; sort: number; questions?: { count: number }[];
};

export default function Categories() {
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const gameFilter = params.get('oyun') ?? '';
  const [edit, setEdit] = useState<(Omit<Category, 'id'> & { id?: string }) | null>(null);

  const games = useLoad(async () => unwrap(await supabase.from('games').select('id,name,engine,sort').order('sort')) as GameLite[], []);
  const { data, error, loading, reload, setData } = useLoad(async () =>
    unwrap(await supabase.from('categories').select('*, questions(count)').order('sort').order('created_at')) as Category[], []);

  const gmap = useMemo(() => Object.fromEntries((games.data ?? []).map((g) => [g.id, g])), [games.data]);
  const rows = useMemo(() => {
    const all = (data ?? []).filter((c) => !gameFilter || c.game_id === gameFilter);
    return all.sort((a, b) => (gmap[a.game_id]?.sort ?? 0) - (gmap[b.game_id]?.sort ?? 0) || a.sort - b.sort);
  }, [data, gameFilter, gmap]);
  const count = (c: Category) => c.questions?.[0]?.count ?? 0;
  const contentGames = (games.data ?? []).filter((g) => g.engine !== 'story');

  const toggle = async (c: Category, key: 'is_active' | 'is_premium') => {
    const v = !c[key];
    setData((d) => d?.map((x) => (x.id === c.id ? { ...x, [key]: v } : x)) ?? null);
    try {
      mustAffect(await supabase.from('categories').update({ [key]: v }).eq('id', c.id).select('id'));
      toast.success('Kategori güncellendi.');
    } catch (e) {
      setData((d) => d?.map((x) => (x.id === c.id ? { ...x, [key]: !v } : x)) ?? null);
      toast.error(e);
    }
  };

  const remove = async (c: Category) => {
    const n = count(c);
    const ok = await confirm({
      title: 'Kategori silinsin mi?',
      body: n > 0
        ? <><b style={{ color: 'var(--text)' }}>{c.name}</b> kategorisi ve içindeki <b style={{ color: 'var(--red)' }}>{num(n)} soru</b> kalıcı olarak silinecek. Bu işlem geri alınamaz.</>
        : <><b style={{ color: 'var(--text)' }}>{c.name}</b> kategorisi kalıcı olarak silinecek. Kategoride soru yok.</>,
      confirm: n > 0 ? `Kategoriyi ve ${num(n)} soruyu sil` : 'Kategoriyi sil', danger: true,
      typeToConfirm: n > 0 ? 'SİL' : undefined,
    });
    if (!ok) return;
    try {
      // Kart Seç: kategoriyle birlikte silinecek soruların görselleri (silme sonrası depodan da kaldırılır)
      let imgs: string[] = [];
      if (gmap[c.game_id]?.engine === 'cards' && n > 0) {
        const m = await supabase.from('questions').select('media').eq('category_id', c.id).limit(5000);
        imgs = ((m.data ?? []) as { media: unknown }[]).flatMap((x) => normalizeMedia(x.media));
      }
      mustAffect(await supabase.from('categories').delete().eq('id', c.id).select('id'));
      if (imgs.length) void removeCardImages(imgs);
      toast.success('Kategori silindi.');
      reload(true);
    } catch (e) { toast.error(e); }
  };

  const newCat = () => {
    const gid = gameFilter || contentGames[0]?.id || '';
    const maxSort = Math.max(0, ...(data ?? []).filter((c) => c.game_id === gid).map((c) => c.sort));
    setEdit({ game_id: gid, name: '', description: '', icon: 'style', color: '#3A1740', is_premium: false, is_active: true, sort: maxSort + 10 });
  };

  return (
    <>
      <ContentNote />
      {!perms.content && <InfoNote tone="warn">Rolünüz içerik düzenlemeye izin vermiyor; bu bölümü yalnızca görüntüleyebilirsiniz.</InfoNote>}
      <div className="tbl-card">
        <div className="tbl-head">
          <div className="row wrap">
            <select className="select sm auto" value={gameFilter} onChange={(e) => setParams(e.target.value ? { oyun: e.target.value } : {}, { replace: true })} aria-label="Oyuna göre filtrele">
              <option value="">Tüm oyunlar</option>
              {(games.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <span className="small muted">{num(rows.length)} kategori · {num(rows.reduce((s, c) => s + count(c), 0))} soru</span>
            {gameFilter && gmap[gameFilter] && QUESTION_ENGINES.includes(gmap[gameFilter].engine) && (
              <Link className="small" to={gmap[gameFilter].engine === 'quiz' ? `/testler?oyun=${gameFilter}` : `/sorular?oyun=${gameFilter}`}>Bu oyunun tüm soruları →</Link>
            )}
          </div>
          {perms.content && <Btn variant="primary" icon="add" onClick={newCat} disabled={!contentGames.length}>Yeni kategori</Btn>}
        </div>
        {error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl" style={{ minWidth: 860 }}>
              <thead><tr><th>Kategori</th><th>Oyun</th><th>Soru</th><th>Sıra</th><th>Durum</th><th /></tr></thead>
              <tbody>
                {loading && !data ? <SkelRows cols={6} /> : rows.length === 0 ? (
                  <tr><td colSpan={6}><Empty icon="category" title="Kategori yok" action={perms.content && contentGames.length ? <Btn variant="primary" icon="add" onClick={newCat}>Yeni kategori</Btn> : undefined}>
                    {contentGames.length ? 'Her oyun için sınırsız sayıda kategori oluşturabilirsiniz.' : 'Kategori eklemek için önce Oyunlar bölümünden bir oyun oluşturun.'}
                  </Empty></td></tr>
                ) : rows.map((c) => {
                  const g = gmap[c.game_id];
                  const qPath = g?.engine === 'quiz' ? `/testler/${c.id}` : `${g?.engine === 'challenges' ? '/gorevler' : '/sorular'}?kategori=${c.id}`;
                  return (
                    <tr key={c.id} className={perms.content ? 'click' : ''} onClick={() => perms.content && setEdit(c)}>
                      <td>
                        <div className="cell-main">
                          <span className="swatch" style={{ background: c.color }}><Icon n={c.icon} /></span>
                          <span className="txt"><span className="strong">{c.name}</span>{c.description && <span className="small muted2 ellipsis" style={{ maxWidth: 360 }}>{c.description}</span>}</span>
                        </div>
                      </td>
                      <td className="m">{g ? <>{g.name}<div className="tag">{ENGINE_LABEL[g.engine]}</div></> : '—'}</td>
                      <td className="num"><Link to={qPath} onClick={(e) => e.stopPropagation()}>{num(count(c))}</Link></td>
                      <td className="m">{num(c.sort)}</td>
                      <td><div className="row" style={{ gap: 6 }}>{c.is_active ? <Badge tone="ok">AKTİF</Badge> : <Badge tone="mute">PASİF</Badge>}{c.is_premium && <Badge tone="pro">PREMIUM</Badge>}</div></td>
                      <td className="act">
                        {perms.content && <RowMenu items={[
                          { label: 'Düzenle', icon: 'edit', onClick: () => setEdit(c) },
                          { label: 'Soruları gör', icon: 'list', onClick: () => navigate(qPath) },
                          { label: c.is_active ? 'Pasife al' : 'Aktifleştir', icon: c.is_active ? 'visibility_off' : 'visibility', onClick: () => toggle(c, 'is_active') },
                          { label: c.is_premium ? 'Ücretsiz yap' : 'Premium yap', icon: 'workspace_premium', onClick: () => toggle(c, 'is_premium') },
                          'sep',
                          { label: 'Sil', icon: 'delete', danger: true, onClick: () => remove(c) },
                        ]} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <CategoryModal cat={edit} games={contentGames} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(true); }} />}
    </>
  );
}

/** Kategori oluşturma/düzenleme. `test` açıksa etiketler “test” olarak gösterilir (Testler bölümü). */
export function CategoryModal({ cat, games, onClose, onSaved, test }: { cat: Omit<Category, 'id'> & { id?: string }; games: GameLite[]; onClose: () => void; onSaved: (id: string) => void; test?: boolean }) {
  const noun = test ? 'Test' : 'Kategori';
  const [f, setF] = useState(cat);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const isNew = !cat.id;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setErr(null);
    if (!f.game_id) return setErr('Bir oyun seçin.');
    if (f.name.trim().length < 2) return setErr(`${noun} adı en az 2 karakter olmalı.`);
    if (!/^#[0-9a-fA-F]{6}$/.test(f.color)) return setErr('Renk #RRGGBB biçiminde olmalı.');
    setBusy(true);
    const payload = {
      game_id: f.game_id, name: f.name.trim(), description: f.description.trim(), icon: f.icon || 'style', color: f.color,
      is_premium: f.is_premium, is_active: f.is_active, sort: Math.round(f.sort) || 0,
    };
    try {
      let id = cat.id ?? '';
      if (isNew) id = (unwrap(await supabase.from('categories').insert(payload).select('id').single()) as { id: string }).id;
      else mustAffect(await supabase.from('categories').update(payload).eq('id', cat.id!).select('id'));
      toast.success(isNew ? `${noun} oluşturuldu.` : `${noun} kaydedildi.`);
      onSaved(id);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={isNew ? (test ? 'Yeni test' : 'Yeni kategori') : test ? 'Testi düzenle' : 'Kategoriyi düzenle'} sub={test ? 'Her test, test motorlu bir oyunun kategorisidir.' : undefined} onClose={onClose} busy={busy}
      footer={<><Btn onClick={onClose} disabled={busy}>Vazgeç</Btn><Btn variant="primary" icon="check" loading={busy} onClick={save}>{isNew ? 'Oluştur' : 'Kaydet'}</Btn></>}>
      <div className="form-grid">
        <Field label="Oyun">
          <select className="select" value={f.game_id} onChange={(e) => set('game_id', e.target.value)}>
            {games.map((g) => <option key={g.id} value={g.id}>{g.name} · {ENGINE_LABEL[g.engine]}</option>)}
          </select>
        </Field>
        <Field label={`${noun} adı`}><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={60} autoFocus /></Field>
        <Field label="Açıklama" className="full"><textarea className="textarea" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={240} style={{ minHeight: 72 }} /></Field>
        <IconField label="Simge" value={f.icon} onChange={(v) => set('icon', v)} />
        <ColorField label="Renk" value={f.color} onChange={(v) => set('color', v)} />
        <Field label="Sıra" hint="Küçük değer önce gösterilir"><input className="input" type="number" value={f.sort} onChange={(e) => set('sort', Number(e.target.value))} /></Field>
        <div className="full col" style={{ gap: 4 }}>
          <ToggleRow label="Aktif" sub={test ? 'Pasif testler uygulamada görünmez.' : 'Pasif kategoriler uygulamada görünmez.'} on={f.is_active} onChange={(v) => set('is_active', v)} />
          <ToggleRow label="Premium" sub="Yalnızca premium çiftler açabilir." on={f.is_premium} onChange={(v) => set('is_premium', v)} />
        </div>
      </div>
      {err && <InfoNote tone="bad">{err}</InfoNote>}
    </Modal>
  );
}
