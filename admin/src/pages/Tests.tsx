import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fetchAll, mustAffect, unwrap, useLoad } from '../lib/data';
import { quizTypeOf, type Engine } from '../lib/constants';
import { num } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import {
  Badge, Btn, ContentNote, Empty, ErrorBox, Icon, InfoNote, RowMenu, SkelRows, useConfirm, useToast,
} from '../ui/ui';
import { CategoryModal, type Category } from './Categories';

const Questions = lazy(() => import('./Questions'));

type GameLite = { id: string; name: string; engine: Engine; sort: number; slug: string };
type Stat = { total: number; active: number; correct: number };
type EditCat = Omit<Category, 'id'> & { id?: string };

/** Test motorlu oyunlar, testleri (kategoriler) ve soru özetleri. */
async function loadQuiz() {
  const games = (unwrap(await supabase.from('games').select('id,name,engine,sort,slug').eq('engine', 'quiz').order('sort')) as GameLite[]);
  if (!games.length) return { games, cats: [] as Category[], stats: {} as Record<string, Stat> };
  const cats = unwrap(await supabase.from('categories').select('*').in('game_id', games.map((g) => g.id)).order('sort').order('created_at')) as Category[];
  const stats: Record<string, Stat> = {};
  cats.forEach((c) => { stats[c.id] = { total: 0, active: 0, correct: 0 }; });
  if (cats.length) {
    const ids = cats.map((c) => c.id);
    const qs = await fetchAll<{ category_id: string; correct_index: number | null; is_active: boolean }>((from, to) =>
      supabase.from('questions').select('category_id,correct_index,is_active').in('category_id', ids).order('id').range(from, to));
    qs.forEach((q) => {
      const s = stats[q.category_id];
      if (!s) return;
      s.total++;
      if (q.is_active) s.active++;
      if (q.correct_index != null) s.correct++;
    });
  }
  return { games, cats, stats };
}

function TypeBadge({ s }: { s?: Stat }) {
  const t = quizTypeOf(s?.total ?? 0, s?.correct ?? 0);
  const title = s && s.total ? `${num(s.correct)} doğru cevaplı · ${num(s.total - s.correct)} uyum sorusu` : undefined;
  return <Badge tone={t.tone} title={title}>{t.t}</Badge>;
}

export default function Tests() {
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const gameFilter = params.get('oyun') ?? '';
  const [edit, setEdit] = useState<EditCat | null>(null);

  const { data, error, loading, reload, setData } = useLoad(loadQuiz, []);
  const games = data?.games ?? [];
  const gmap = useMemo(() => Object.fromEntries(games.map((g) => [g.id, g])), [games]);
  const rows = useMemo(() => (data?.cats ?? [])
    .filter((c) => !gameFilter || c.game_id === gameFilter)
    .sort((a, b) => (gmap[a.game_id]?.sort ?? 0) - (gmap[b.game_id]?.sort ?? 0) || a.sort - b.sort), [data, gameFilter, gmap]);
  const stat = (c: Category) => data?.stats[c.id];
  const totalQ = rows.reduce((s, c) => s + (stat(c)?.total ?? 0), 0);

  const toggle = async (c: Category, key: 'is_active' | 'is_premium') => {
    const v = !c[key];
    const patch = (val: boolean) => setData((d) => d ? { ...d, cats: d.cats.map((x) => (x.id === c.id ? { ...x, [key]: val } : x)) } : d);
    patch(v);
    try {
      mustAffect(await supabase.from('categories').update({ [key]: v }).eq('id', c.id).select('id'));
      toast.success('Test güncellendi.');
    } catch (e) { patch(!v); toast.error(e); }
  };

  const remove = async (c: Category) => {
    const n = stat(c)?.total ?? 0;
    const ok = await confirm({
      title: 'Test silinsin mi?',
      body: n > 0
        ? <><b style={{ color: 'var(--text)' }}>{c.name}</b> testi ve içindeki <b style={{ color: 'var(--red)' }}>{num(n)} soru</b> kalıcı olarak silinecek. Bu işlem geri alınamaz.</>
        : <><b style={{ color: 'var(--text)' }}>{c.name}</b> testi kalıcı olarak silinecek. Testte soru yok.</>,
      confirm: n > 0 ? `Testi ve ${num(n)} soruyu sil` : 'Testi sil', danger: true,
      typeToConfirm: n > 0 ? 'SİL' : undefined,
    });
    if (!ok) return;
    try {
      mustAffect(await supabase.from('categories').delete().eq('id', c.id).select('id'));
      toast.success('Test silindi.');
      reload(true);
    } catch (e) { toast.error(e); }
  };

  const newTest = () => {
    // Varsayılan: filtredeki oyun, yoksa 'quiz' kısa adlı oyun, yoksa ilk test oyunu
    const gid = gameFilter || games.find((g) => g.slug === 'quiz')?.id || games[0]?.id || '';
    const maxSort = Math.max(0, ...(data?.cats ?? []).filter((c) => c.game_id === gid).map((c) => c.sort));
    setEdit({ game_id: gid, name: '', description: '', icon: 'quiz', color: '#3A1740', is_premium: false, is_active: true, sort: maxSort + 1 });
  };

  const noGames = data && games.length === 0;

  return (
    <>
      <ContentNote />
      {!perms.content && <InfoNote tone="warn">Rolünüz içerik düzenlemeye izin vermiyor; bu bölümü yalnızca görüntüleyebilirsiniz.</InfoNote>}
      <InfoNote icon="quiz">Her test 4 seçenekli sorulardan oluşur. Doğru cevabı olmayan sorular <b>uyum</b> sorusudur (partnerler aynı şıkkı seçmeye çalışır); doğru cevabı olanlar <b>bilgi</b> sorusudur.</InfoNote>
      {noGames && <InfoNote tone="warn">Test motorunu kullanan bir oyun yok. <Link to="/oyunlar">Oyunlar</Link> bölümünden “Test (4 seçenek)” motoruyla bir oyun oluşturun.</InfoNote>}
      <div className="tbl-card">
        <div className="tbl-head">
          <div className="row wrap">
            {games.length > 1 && (
              <select className="select sm auto" value={gameFilter} onChange={(e) => setParams(e.target.value ? { oyun: e.target.value } : {}, { replace: true })} aria-label="Oyuna göre filtrele">
                <option value="">Tüm test oyunları</option>
                {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
            <span className="small muted">{num(rows.length)} test · {num(totalQ)} soru</span>
          </div>
          {perms.content && <Btn variant="primary" icon="add" onClick={newTest} disabled={!games.length}>Yeni test</Btn>}
        </div>
        {error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl" style={{ minWidth: 900 }}>
              <thead><tr><th>Test</th><th>Oyun</th><th>Soru</th><th>Tür</th><th>Sıra</th><th>Durum</th><th /></tr></thead>
              <tbody>
                {loading && !data ? <SkelRows cols={7} /> : rows.length === 0 ? (
                  <tr><td colSpan={7}><Empty icon="quiz" title="Henüz test yok" action={perms.content && games.length ? <Btn variant="primary" icon="add" onClick={newTest}>Yeni test</Btn> : undefined}>
                    {games.length ? 'Yeni bir test oluşturup sorularını ekleyin.' : 'Test eklemek için önce test motorlu bir oyun oluşturun.'}
                  </Empty></td></tr>
                ) : rows.map((c) => {
                  const g = gmap[c.game_id];
                  const s = stat(c);
                  return (
                    <tr key={c.id} className="click" onClick={() => navigate(`/testler/${c.id}`)}>
                      <td>
                        <div className="cell-main">
                          <span className="swatch" style={{ background: c.color }}><Icon n={c.icon} /></span>
                          <span className="txt"><span className="strong">{c.name}</span>{c.description && <span className="small muted2 ellipsis" style={{ maxWidth: 380 }}>{c.description}</span>}</span>
                        </div>
                      </td>
                      <td className="m">{g?.name ?? '—'}</td>
                      <td className="num">
                        <Link to={`/testler/${c.id}`} onClick={(e) => e.stopPropagation()}>{num(s?.total ?? 0)}</Link>
                        {s && s.total > s.active && <div className="tag">{num(s.total - s.active)} pasif</div>}
                      </td>
                      <td>
                        <TypeBadge s={s} />
                        {s && s.total > 0 && s.correct > 0 && s.correct < s.total && <div className="tag" style={{ marginTop: 4 }}>{num(s.correct)} doğru cevaplı · {num(s.total - s.correct)} uyum</div>}
                      </td>
                      <td className="m">{num(c.sort)}</td>
                      <td><div className="row" style={{ gap: 6 }}>{c.is_active ? <Badge tone="ok">AKTİF</Badge> : <Badge tone="mute">PASİF</Badge>}{c.is_premium && <Badge tone="pro">PREMIUM</Badge>}</div></td>
                      <td className="act">
                        <RowMenu items={[
                          { label: 'Soruları gör', icon: 'list', onClick: () => navigate(`/testler/${c.id}`) },
                          { label: 'Düzenle', icon: 'edit', onClick: () => setEdit(c), hidden: !perms.content },
                          { label: c.is_active ? 'Pasife al' : 'Aktifleştir', icon: c.is_active ? 'visibility_off' : 'visibility', onClick: () => toggle(c, 'is_active'), hidden: !perms.content },
                          { label: c.is_premium ? 'Ücretsiz yap' : 'Premium yap', icon: 'workspace_premium', onClick: () => toggle(c, 'is_premium'), hidden: !perms.content },
                          ...(perms.content ? ['sep' as const, { label: 'Sil', icon: 'delete', danger: true, onClick: () => remove(c) }] : []),
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <CategoryModal test cat={edit} games={games} onClose={() => setEdit(null)}
        onSaved={(id) => { const wasNew = !edit.id; setEdit(null); if (wasNew && id) navigate(`/testler/${id}`); else reload(true); }} />}
    </>
  );
}

/** Tek bir testin soruları: Sorular bileşeni test motoru ve bu kategoriyle sınırlanır. */
export function TestDetail() {
  const { id = '' } = useParams();
  const { perms } = useAuth();
  const [edit, setEdit] = useState<EditCat | null>(null);
  const info = useLoad(async () => {
    const c = unwrap(await supabase.from('categories').select('*, game:games!inner(id,name,engine,sort,slug)').eq('id', id).maybeSingle()) as (Category & { game: GameLite }) | null;
    if (!c) return null;
    const qs = await fetchAll<{ correct_index: number | null; is_active: boolean }>((from, to) =>
      supabase.from('questions').select('correct_index,is_active').eq('category_id', id).order('id').range(from, to));
    const games = unwrap(await supabase.from('games').select('id,name,engine,sort,slug').eq('engine', 'quiz').order('sort')) as GameLite[];
    return { c, games, stat: { total: qs.length, active: qs.filter((q) => q.is_active).length, correct: qs.filter((q) => q.correct_index != null).length } as Stat };
  }, [id]);

  const c = info.data?.c;
  return (
    <>
      <div className="row wrap" style={{ gap: 12, marginBottom: 12, justifyContent: 'space-between' }}>
        <div className="row wrap" style={{ gap: 12, minWidth: 0 }}>
          <Link to="/testler" className="btn sm"><Icon n="arrow_back" />Testler</Link>
          {info.loading && !info.data ? <span className="skel" style={{ width: 220, height: 20 }} /> : c ? (
            <div className="row" style={{ gap: 10, minWidth: 0 }}>
              <span className="swatch" style={{ background: c.color }}><Icon n={c.icon} /></span>
              <span className="col" style={{ gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name} <span className="muted small" style={{ fontWeight: 500 }}>· {c.game.name}</span></span>
                {c.description && <span className="small muted2">{c.description}</span>}
              </span>
            </div>
          ) : null}
        </div>
        {c && (
          <div className="row wrap" style={{ gap: 6 }}>
            <TypeBadge s={info.data?.stat} />
            {info.data && info.data.stat.total > 0 && <Badge tone="mute">{num(info.data.stat.correct)} DOĞRU CEVAPLI · {num(info.data.stat.total - info.data.stat.correct)} UYUM</Badge>}
            {c.is_active ? <Badge tone="ok">AKTİF</Badge> : <Badge tone="mute">PASİF</Badge>}
            {c.is_premium && <Badge tone="pro">PREMIUM</Badge>}
            {perms.content && <Btn size="sm" icon="edit" onClick={() => setEdit(c)}>Testi düzenle</Btn>}
          </div>
        )}
      </div>
      {info.error ? <ErrorBox error={info.error} onRetry={() => info.reload()} />
        : info.data === null && !info.loading ? (
          <div className="tbl-card"><Empty icon="quiz" title="Test bulunamadı" action={<Link to="/testler" className="btn">Testlere dön</Link>}>Bu test silinmiş olabilir.</Empty></div>
        ) : c && c.game.engine !== 'quiz' ? (
          <InfoNote tone="warn">Bu kategori test motorlu bir oyuna ait değil. <Link to={`/sorular?kategori=${c.id}`}>Sorular bölümünde açın.</Link></InfoNote>
        ) : (
          <Suspense fallback={<div className="row muted small" style={{ padding: 24 }}><span className="spinner" />Yükleniyor…</div>}>
            <Questions key={id} mode="quiz" fixedCategory={id} onChanged={() => info.reload(true)} />
          </Suspense>
        )}
      {edit && info.data && <CategoryModal test cat={edit} games={info.data.games} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); info.reload(true); }} />}
    </>
  );
}
