import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { chunk, downloadText, fetchAll, likeEscape, mustAffect, parseCsv, toCsv, unwrap, useDebounced, useLoad } from '../lib/data';
import { AppError } from '../lib/errors';
import {
  CARD_TITLE_MAX, EMOJI_OPTION_MAX, ENGINE_LABEL, ENGINE_SHORT, FLEX_MAX, FLEX_MIN, LEVELS, MOODS, QUESTION_ENGINES, QUIZ_OPTION_MAX,
  hasCorrect, isFlexOptions, levelLabel, levelTone, moodLabel, optLetter, optionCount,
  type Engine,
} from '../lib/constants';
import { alignMedia, normalizeMedia, removeCardImages } from '../lib/cardImages';
import { CardThumbs, CardsEditor, CardsPreview, EmojiOptionsEditor, EmojiPreview, EmojiRowOptions } from './QuestionExtras';
import { num, pct } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import {
  Badge, Btn, ContentNote, Empty, ErrorBox, Field, Icon, InfoNote, Modal, Pager, RowMenu, Segmented, SkelRows, ToggleRow,
  useConfirm, useToast,
} from '../ui/ui';

type Mode = 'questions' | 'challenges' | 'quiz';
type GameLite = { id: string; name: string; engine: Engine; sort: number };
type CatLite = { id: string; name: string; game_id: string; sort: number; is_active: boolean };
type Q = {
  id: string; category_id: string; text: string; kind: 'truth' | 'dare' | null; level: number; mood: string;
  options: string[]; media: string[]; correct_index: number | null; timer_seconds: number | null; is_active: boolean; created_at: string;
  category: { id: string; name: string; game_id: string; game: { id: string; name: string; engine: Engine } };
};
type Draft = {
  id?: string; game_id: string; category_id: string; text: string; kind: 'truth' | 'dare'; level: number; mood: string;
  options: string[]; media: string[]; correct_index: number | null; timer_on: boolean; timer_seconds: number; is_active: boolean;
};

const PAGE = 25;
const SELECT = 'id,category_id,text,kind,level,mood,options,media,correct_index,timer_seconds,is_active,created_at,category:categories!inner(id,name,game_id,game:games!inner(id,name,engine))';

const KIND_LABEL = { truth: 'Doğruluk', dare: 'Cesaret' } as const;

/** Sayfanın kapsadığı oyun motorları. */
const scopeEngines = (mode: Mode): Engine[] =>
  mode === 'challenges' ? ['challenges'] : mode === 'quiz' ? ['quiz'] : QUESTION_ENGINES;

function previewKind(engine: Engine | undefined, d: Pick<Draft, 'kind' | 'timer_on' | 'timer_seconds' | 'correct_index'>): string {
  if (!engine) return 'SORU';
  if (engine === 'truth_dare') return d.kind === 'dare' ? 'CESARET' : 'DOĞRULUK';
  if (engine === 'quiz') return d.correct_index != null ? 'TEST · BİLGİ' : 'TEST · UYUM';
  if (engine === 'emoji') return d.correct_index != null ? 'EMOJİ · DOĞRU CEVAPLI' : 'EMOJİ · EŞLEŞME';
  if (engine === 'challenges') return d.timer_on ? `GÖREV · ${num(d.timer_seconds)} sn` : 'GÖREV';
  return ENGINE_SHORT[engine];
}

function normalizeOptions(o: unknown): string[] {
  return Array.isArray(o) ? o.map((x) => (typeof x === 'string' ? x : typeof x === 'object' && x && 'text' in x ? String((x as { text: unknown }).text) : String(x))) : [];
}

/** Liste satırında 4 test seçeneğini kısaca gösterir; doğru cevap vurgulanır. */
function QuizOptions({ options, correct }: { options: string[]; correct: number | null }) {
  return (
    <div className="quiz-opts">
      {options.slice(0, 4).map((o, i) => (
        <span key={i} className={`quiz-opt ${correct === i ? 'ok' : ''}`} title={o}><b>{optLetter(i)}</b>{o}</span>
      ))}
    </div>
  );
}

export default function Questions({ mode, fixedCategory, onChanged }: { mode: Mode; fixedCategory?: string; onChanged?: () => void }) {
  const chal = mode === 'challenges';
  const quizMode = mode === 'quiz';
  const locked = !!fixedCategory;
  const unit = chal ? 'görev' : 'soru';
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const editorRef = useRef<HTMLDivElement>(null);

  const [engineF, setEngineF] = useState<Engine | ''>('');
  const [gameF, setGameF] = useState(locked ? '' : params.get('oyun') ?? '');
  const [catF, setCatF] = useState(fixedCategory ?? params.get('kategori') ?? '');
  const [levelF, setLevelF] = useState<string>('');
  const [moodF, setMoodF] = useState('');
  const [activeF, setActiveF] = useState<'' | 'on' | 'off'>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const q = useDebounced(search.trim(), 300);

  // Kapsam: görevler → challenges; testler → quiz; sorular → diğer içerik motorları (testler dahil)
  const games = useLoad(async () => {
    const rows = unwrap(await supabase.from('games').select('id,name,engine,sort').order('sort')) as GameLite[];
    const scope = scopeEngines(mode);
    return rows.filter((g) => scope.includes(g.engine));
  }, [mode]);
  const gameIds = useMemo(() => (games.data ?? []).map((g) => g.id), [games.data]);
  const cats = useLoad(async () => {
    if (!gameIds.length) return [] as CatLite[];
    return unwrap(await supabase.from('categories').select('id,name,game_id,sort,is_active').in('game_id', gameIds).order('sort')) as CatLite[];
  }, [gameIds.join(',')]);
  const gmap = useMemo(() => Object.fromEntries((games.data ?? []).map((g) => [g.id, g])), [games.data]);
  const gameOptions = (games.data ?? []).filter((g) => !engineF || g.engine === engineF);
  const catOptions = (cats.data ?? []).filter((c) => (!gameF || c.game_id === gameF) && (!engineF || gmap[c.game_id]?.engine === engineF));

  // Bağlantıdan gelen kategori → oyunu da seç; ?oyun= bağlantısı → oyun filtresi
  useEffect(() => {
    const k = fixedCategory ?? params.get('kategori');
    if (k && cats.data) {
      const c = cats.data.find((x) => x.id === k);
      if (c) { setCatF(c.id); setGameF(c.game_id); }
    } else if (!locked && params.get('oyun')) { setGameF(params.get('oyun')!); setCatF(''); }
  }, [params, cats.data, fixedCategory, locked]);
  const clearLink = () => { if (params.get('kategori') || params.get('oyun')) setParams({}, { replace: true }); };
  useEffect(() => { setPage(0); setSel(new Set()); }, [engineF, gameF, catF, levelF, moodF, activeF, q, mode]);
  useEffect(() => { setEngineF(''); setGameF(locked ? '' : params.get('oyun') ?? ''); setCatF(fixedCategory ?? params.get('kategori') ?? ''); setDraft(null); /* mod değişti */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fixedCategory]);

  const build = (select: string, withCount: boolean) => {
    let qb = supabase.from('questions').select(select, withCount ? { count: 'exact' } : undefined);
    qb = engineF ? qb.eq('category.game.engine', engineF) : qb.in('category.game.engine', scopeEngines(mode));
    if (gameF) qb = qb.eq('category.game_id', gameF);
    if (catF) qb = qb.eq('category_id', catF);
    if (levelF !== '') qb = qb.eq('level', Number(levelF));
    if (moodF) qb = qb.eq('mood', moodF);
    if (activeF) qb = qb.eq('is_active', activeF === 'on');
    if (q) qb = qb.ilike('text', `%${likeEscape(q)}%`);
    return qb;
  };

  const list = useLoad(async () => {
    const res = await build(SELECT, true).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (res.error) throw res.error;
    const rows = ((res.data ?? []) as unknown as Q[]).map((r) => ({ ...r, options: normalizeOptions(r.options), media: normalizeMedia(r.media) }));
    const ids = rows.map((r) => r.id);
    const usage: Record<string, number> = {};
    const compl: Record<string, { done: number; all: number }> = {};
    if (ids.length) {
      const u = await supabase.from('question_usage').select('question_id,uses:count').in('question_id', ids);
      (u.data as { question_id: string; uses: number }[] | null)?.forEach((x) => { usage[x.question_id] = x.uses; });
      if (chal) {
        const c = await supabase.from('challenge_completions').select('question_id,skipped').in('question_id', ids).limit(10000);
        (c.data as { question_id: string; skipped: boolean }[] | null)?.forEach((x) => {
          const o = (compl[x.question_id] ??= { done: 0, all: 0 });
          o.all++; if (!x.skipped) o.done++;
        });
      }
    }
    return { rows, total: res.count ?? 0, usage, compl };
  }, [mode, engineF, gameF, catF, levelF, moodF, activeF, q, page]);

  const rows = list.data?.rows ?? [];
  const changed = () => { list.reload(true); onChanged?.(); };
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const openNew = () => {
    const cat = catF ? cats.data?.find((c) => c.id === catF) : undefined;
    const gid = cat?.game_id || gameF || gameOptions[0]?.id || games.data?.[0]?.id || '';
    const firstCat = cat?.id || (cats.data ?? []).find((c) => c.game_id === gid)?.id || '';
    const eng = gmap[gid]?.engine;
    const n = optionCount(eng);
    setDraft({ game_id: gid, category_id: firstCat, text: '', kind: 'truth', level: 1, mood: 'karisik', options: Array(n).fill(''), media: eng === 'cards' ? Array(n).fill('') : [], correct_index: null, timer_on: chal, timer_seconds: 60, is_active: true });
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  const openEdit = (r: Q) => {
    const eng = r.category.game.engine;
    const flex = isFlexOptions(eng);
    const n = flex ? Math.min(FLEX_MAX, Math.max(FLEX_MIN, r.options.length)) : optionCount(eng);
    const opts = [...r.options];
    while (opts.length < n) opts.push('');
    const options = n ? opts.slice(0, n) : opts;
    const ci = hasCorrect(eng) && r.correct_index != null && r.correct_index < options.length ? r.correct_index : null;
    setDraft({
      id: r.id, game_id: r.category.game_id, category_id: r.category_id, text: r.text, kind: r.kind ?? 'truth', level: r.level, mood: r.mood,
      options, media: eng === 'cards' ? alignMedia(r.media, options.length) : [], correct_index: ci, timer_on: r.timer_seconds != null, timer_seconds: r.timer_seconds ?? 60, is_active: r.is_active,
    });
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const bulk = async (action: 'on' | 'off' | 'delete') => {
    const ids = [...sel];
    if (!ids.length) return;
    if (action === 'delete') {
      const ok = await confirm({ title: `${num(ids.length)} ${unit} silinsin mi?`, body: 'Seçili içerikler ve kullanım istatistikleri kalıcı olarak silinir. Bu işlem geri alınamaz.', confirm: 'Sil', danger: true });
      if (!ok) return;
    }
    try {
      // Kart görselleri: silinecek soruların görsel adresleri (silme başarılı olursa depodan da kaldırılır)
      const imgs: string[] = [];
      if (action === 'delete') {
        for (const part of chunk(ids, 200)) {
          const m = await supabase.from('questions').select('id,media').in('id', part);
          (m.data as { media: unknown }[] | null)?.forEach((x) => imgs.push(...normalizeMedia(x.media)));
        }
      }
      for (const part of chunk(ids, 200)) {
        if (action === 'delete') mustAffect(await supabase.from('questions').delete().in('id', part).select('id'));
        else mustAffect(await supabase.from('questions').update({ is_active: action === 'on' }).in('id', part).select('id'));
      }
      if (imgs.length) void removeCardImages(imgs);
      toast.success(action === 'delete' ? `${num(ids.length)} ${unit} silindi.` : action === 'on' ? `${num(ids.length)} ${unit} aktifleştirildi.` : `${num(ids.length)} ${unit} pasife alındı.`);
      setSel(new Set());
      changed();
    } catch (e) { toast.error(e); }
  };

  const toggleOne = async (r: Q) => {
    try {
      mustAffect(await supabase.from('questions').update({ is_active: !r.is_active }).eq('id', r.id).select('id'));
      list.setData((d) => d ? { ...d, rows: d.rows.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)) } : d);
      toast.success(r.is_active ? 'Pasife alındı.' : 'Aktifleştirildi.');
    } catch (e) { toast.error(e); }
  };
  const removeOne = async (r: Q) => {
    const ok = await confirm({ title: `${chal ? 'Görev' : 'Soru'} silinsin mi?`, body: <>“{r.text}” kalıcı olarak silinecek.</>, confirm: 'Sil', danger: true });
    if (!ok) return;
    try {
      mustAffect(await supabase.from('questions').delete().eq('id', r.id).select('id'));
      if (r.media.some(Boolean)) void removeCardImages(r.media);
      toast.success('Silindi.');
      if (draft?.id === r.id) setDraft(null);
      changed();
    } catch (e) { toast.error(e); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await fetchAll<Q>((from, to) => build(SELECT, false).order('created_at', { ascending: false }).range(from, to) as unknown as PromiseLike<{ data: Q[] | null; error: unknown }>);
      const usage: Record<string, number> = {};
      for (const part of chunk(all.map((r) => r.id), 150)) {
        const u = await supabase.from('question_usage').select('question_id,uses:count').in('question_id', part);
        (u.data as { question_id: string; uses: number }[] | null)?.forEach((x) => { usage[x.question_id] = x.uses; });
      }
      const header = quizMode
        ? ['id', 'oyun', 'test', 'metin', 'seviye', 'ruh_hali', 'secenekler', 'a', 'b', 'c', 'd', 'dogru', 'aktif', 'kullanim']
        : ['id', 'oyun', 'kategori', 'motor', 'metin', 'tur', 'seviye', 'ruh_hali', 'secenekler', 'gorseller', 'dogru', 'sure_sn', 'aktif', 'kullanim'];
      const lines = all.map((r) => {
        const opts = normalizeOptions(r.options);
        const eng = r.category.game.engine;
        const correct = hasCorrect(eng) ? optLetter(r.correct_index) : '';
        const media = eng === 'cards' ? alignMedia(normalizeMedia(r.media), opts.length).join(' | ') : '';
        return quizMode
          ? [r.id, r.category.game.name, r.category.name, r.text, r.level, r.mood, opts.join(' | '), opts[0] ?? '', opts[1] ?? '', opts[2] ?? '', opts[3] ?? '', correct, r.is_active ? 'evet' : 'hayır', usage[r.id] ?? 0]
          : [r.id, r.category.game.name, r.category.name, eng, r.text, r.kind ? KIND_LABEL[r.kind] : '', r.level, r.mood,
            opts.join(' | '), media, correct, r.timer_seconds ?? '', r.is_active ? 'evet' : 'hayır', usage[r.id] ?? 0];
      });
      downloadText(`nocta-${chal ? 'gorevler' : quizMode ? 'testler' : 'sorular'}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...lines]));
      toast.success(`${num(all.length)} ${unit} dışa aktarıldı.`);
    } catch (e) { toast.error(e); } finally { setExporting(false); }
  };

  const noGames = games.data && games.data.length === 0;

  return (
    <>
      <ContentNote />
      {!perms.content && <InfoNote tone="warn">Rolünüz içerik düzenlemeye izin vermiyor; bu bölümü yalnızca görüntüleyebilirsiniz.</InfoNote>}
      {noGames && <InfoNote tone="warn">{chal ? 'Görev motorunu kullanan bir oyun yok. Oyunlar bölümünden “Çift Görevleri” motoruyla bir oyun oluşturun.' : quizMode ? 'Test motorunu kullanan bir oyun yok. Oyunlar bölümünden “Test (4 seçenek)” motoruyla bir oyun oluşturun.' : 'Soru içeren bir oyun yok. Önce Oyunlar bölümünden bir oyun oluşturun.'}</InfoNote>}

      {draft && perms.content && (
        <div ref={editorRef} style={{ scrollMarginTop: 16 }}>
          <Editor key={draft.id ?? 'new'} mode={mode} draft={draft} games={games.data ?? []} cats={cats.data ?? []}
            onClose={() => setDraft(null)}
            onSaved={(keepOpen) => { changed(); if (!keepOpen) setDraft(null); }}
            onDelete={draft.id ? () => { const r = rows.find((x) => x.id === draft.id); if (r) removeOne(r); } : undefined} />
        </div>
      )}

      <div className="tbl-card">
        <div className="tbl-head">
          <div className="row wrap" style={{ gap: 8 }}>
            {mode === 'questions' && (
              <select className="select sm auto" value={engineF} onChange={(e) => { setEngineF(e.target.value as Engine | ''); setGameF(''); setCatF(''); clearLink(); }} aria-label="Oyun motoru">
                <option value="">Tüm motorlar</option>
                {QUESTION_ENGINES.map((en) => <option key={en} value={en}>{ENGINE_LABEL[en]}</option>)}
              </select>
            )}
            {!locked && (
              <>
                <select className="select sm auto" value={gameF} onChange={(e) => { setGameF(e.target.value); setCatF(''); clearLink(); }} aria-label="Oyun">
                  <option value="">Tüm oyunlar</option>
                  {gameOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <select className="select sm auto" value={catF} onChange={(e) => { setCatF(e.target.value); clearLink(); }} aria-label={quizMode ? 'Test' : 'Kategori'}>
                  <option value="">{quizMode ? 'Tüm testler' : 'Tüm kategoriler'}</option>
                  {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{!gameF && gmap[c.game_id] ? ` · ${gmap[c.game_id].name}` : ''}</option>)}
                </select>
              </>
            )}
            <select className="select sm auto" value={levelF} onChange={(e) => setLevelF(e.target.value)} aria-label="Seviye">
              <option value="">Tüm seviyeler</option>
              {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.t}</option>)}
            </select>
            <select className="select sm auto" value={moodF} onChange={(e) => setMoodF(e.target.value)} aria-label="Ruh hali">
              <option value="">Tüm ruh halleri</option>
              {MOODS.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
            </select>
            <select className="select sm auto" value={activeF} onChange={(e) => setActiveF(e.target.value as '' | 'on' | 'off')} aria-label="Durum">
              <option value="">Tüm durumlar</option>
              <option value="on">Aktif</option>
              <option value="off">Pasif</option>
            </select>
            <div className="searchbox" style={{ width: 220, height: 36 }}>
              <Icon n="search" size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Metinde ara" aria-label="Metinde ara" />
            </div>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <Btn size="sm" icon="download" loading={exporting} onClick={exportCsv} disabled={!list.data?.total}>CSV dışa aktar</Btn>
            {perms.content && <Btn size="sm" icon="upload" onClick={() => setImporting(true)} disabled={!cats.data?.length}>Toplu içe aktar</Btn>}
            {perms.content && <Btn variant="primary" icon="add" onClick={openNew} disabled={!!noGames}>{chal ? 'Yeni görev' : 'Yeni soru'}</Btn>}
          </div>
        </div>

        {perms.content && sel.size > 0 && (
          <div className="bulkbar">
            <span>{num(sel.size)} seçili</span>
            <Btn size="sm" icon="visibility" onClick={() => bulk('on')}>Aktifleştir</Btn>
            <Btn size="sm" icon="visibility_off" onClick={() => bulk('off')}>Pasife al</Btn>
            <Btn size="sm" variant="danger" icon="delete" onClick={() => bulk('delete')}>Sil</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setSel(new Set())}>Seçimi temizle</Btn>
          </div>
        )}

        {list.error ? <ErrorBox error={list.error} onRetry={() => list.reload()} /> : (
          <div className="tbl-scroll">
            <table className="tbl" style={{ minWidth: 980 }}>
              <thead><tr>
                {perms.content && <th className="chk"><input type="checkbox" className="checkbox" checked={allSel} aria-label="Sayfadakilerin tümünü seç"
                  onChange={() => setSel((s) => { const n = new Set(s); rows.forEach((r) => (allSel ? n.delete(r.id) : n.add(r.id))); return n; })} /></th>}
                <th>{chal ? 'Görev' : 'Soru'}</th><th>{quizMode ? 'Test' : 'Kategori'}</th><th>Seviye</th>{chal ? <th>Süre</th> : <th>Ruh hali</th>}<th>Kullanım</th>{chal && <th>Tamamlama</th>}<th>Durum</th><th />
              </tr></thead>
              <tbody>
                {list.loading && !list.data ? <SkelRows cols={chal ? 9 : 8} /> : rows.length === 0 ? (
                  <tr><td colSpan={10}><Empty icon={chal ? 'bolt' : quizMode ? 'quiz' : 'help'} title={q || (catF && !locked) || gameF || engineF || levelF || moodF || activeF ? 'Filtrelere uyan içerik yok' : chal ? 'Henüz görev yok' : 'Henüz soru yok'}
                    action={perms.content && !noGames ? <Btn variant="primary" icon="add" onClick={openNew}>{chal ? 'Yeni görev' : 'Yeni soru'}</Btn> : undefined}>
                    {q || (catF && !locked) ? 'Filtreleri değiştirmeyi deneyin.' : 'Tek tek ekleyebilir ya da toplu içe aktarabilirsiniz.'}
                  </Empty></td></tr>
                ) : rows.map((r) => {
                  const c = list.data?.compl[r.id];
                  return (
                    <tr key={r.id} className={`${perms.content ? 'click' : ''} ${sel.has(r.id) ? 'sel' : ''} ${draft?.id === r.id ? 'sel' : ''}`} onClick={() => perms.content && openEdit(r)} style={{ opacity: list.loading ? 0.6 : 1 }}>
                      {perms.content && <td className="chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="checkbox" checked={sel.has(r.id)} aria-label="Seç"
                        onChange={() => setSel((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} /></td>}
                      <td>
                        <div className="q-text clamp2">{r.text}</div>
                        {r.category.game.engine === 'quiz' ? (
                          <div className="row wrap" style={{ gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
                            {r.correct_index != null
                              ? <Badge tone="ok" title="Bilgi testi: doğru cevap puanlanır">DOĞRU: {optLetter(r.correct_index)}</Badge>
                              : <Badge tone="rose" title="Uyum testi: partnerler aynı şıkkı seçmeye çalışır">UYUM</Badge>}
                            <QuizOptions options={r.options} correct={r.correct_index} />
                          </div>
                        ) : r.category.game.engine === 'emoji' ? (
                          <div className="row wrap" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                            {r.correct_index != null
                              ? <Badge tone="ok" title="Doğru cevaplı: doğru emojiyi bulan kazanır">DOĞRU: {optLetter(r.correct_index)}</Badge>
                              : <Badge tone="rose" title="Eşleşme modu: partnerler aynı şıkkı seçmeye çalışır">EŞLEŞME</Badge>}
                            <EmojiRowOptions options={r.options} correct={r.correct_index} />
                          </div>
                        ) : r.category.game.engine === 'cards' ? (
                          <div className="row wrap" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
                            <Badge tone="pro" title={`${num(r.media.filter(Boolean).length)} kartın görseli var`}>{num(r.options.length)} KART</Badge>
                            <CardThumbs options={r.options} media={r.media} />
                          </div>
                        ) : (
                          <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                            {r.kind && <span className="tag">{KIND_LABEL[r.kind].toLocaleUpperCase('tr-TR')}</span>}
                            {r.options.length > 0 && <span className="tag ellipsis" style={{ maxWidth: 380 }}>{r.options.join(' · ')}</span>}
                          </div>
                        )}
                      </td>
                      <td className="m">{r.category.name}<div className="tag">{r.category.game.name}{mode === 'questions' && ['quiz', 'emoji', 'cards'].includes(r.category.game.engine) ? ` · ${ENGINE_SHORT[r.category.game.engine]}` : ''}</div></td>
                      <td><Badge tone={levelTone(r.level)}>{levelLabel(r.level).toLocaleUpperCase('tr-TR')}</Badge></td>
                      {chal ? <td className="m nowrap">{r.timer_seconds ? `${num(r.timer_seconds)} sn` : '—'}</td> : <td className="m">{moodLabel(r.mood)}</td>}
                      <td className="num">{num(list.data?.usage[r.id] ?? 0)}</td>
                      {chal && <td className="num">{c && c.all ? <span title={`${num(c.done)} / ${num(c.all)}`}>{pct((c.done / c.all) * 100, 0)}</span> : '—'}</td>}
                      <td>{r.is_active ? <Badge tone="ok">AKTİF</Badge> : <Badge tone="mute">PASİF</Badge>}</td>
                      <td className="act">
                        {perms.content && <RowMenu items={[
                          { label: 'Düzenle', icon: 'edit', onClick: () => openEdit(r) },
                          { label: r.is_active ? 'Pasife al' : 'Aktifleştir', icon: r.is_active ? 'visibility_off' : 'visibility', onClick: () => toggleOne(r) },
                          'sep',
                          { label: 'Sil', icon: 'delete', danger: true, onClick: () => removeOne(r) },
                        ]} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE} total={list.data?.total ?? 0} onPage={setPage} unit={unit} />
      </div>

      {importing && <ImportModal mode={mode} games={games.data ?? []} cats={cats.data ?? []} defaultCat={catF} onClose={() => setImporting(false)} onDone={() => { setImporting(false); changed(); }} />}
    </>
  );
}

// ── Düzenleyici + önizleme ─────────────────────────────────────
function validateDraft(d: Draft, engine: Engine | undefined): string | null {
  if (!d.category_id) return 'Bir kategori seçin.';
  const t = d.text.trim();
  if (t.length < 2) return 'Metin en az 2 karakter olmalı.';
  if (t.length > 600) return 'Metin en fazla 600 karakter olabilir.';
  const n = optionCount(engine);
  if (engine === 'quiz') {
    for (let i = 0; i < 4; i++) {
      const o = (d.options[i] ?? '').trim();
      if (!o) return `${optLetter(i)} seçeneği boş bırakılamaz; testlerde 4 seçeneğin tümü zorunludur.`;
      if (o.length > QUIZ_OPTION_MAX) return `${optLetter(i)} seçeneği en fazla ${QUIZ_OPTION_MAX} karakter olabilir.`;
    }
    const low = d.options.map((o) => o.trim().toLocaleLowerCase('tr-TR'));
    if (new Set(low).size !== low.length) return 'Seçenekler birbirinden farklı olmalı.';
    if (d.correct_index != null && !(d.correct_index >= 0 && d.correct_index <= 3)) return 'Doğru cevap A, B, C ya da D olmalı.';
  } else if (engine === 'emoji' || engine === 'cards') {
    const isEmoji = engine === 'emoji';
    const noun = isEmoji ? 'şık' : 'kart';
    if (d.options.length < FLEX_MIN || d.options.length > FLEX_MAX) return `${FLEX_MIN}–${FLEX_MAX} ${noun} girilmeli.`;
    const max = isEmoji ? EMOJI_OPTION_MAX : CARD_TITLE_MAX;
    for (let i = 0; i < d.options.length; i++) {
      const o = d.options[i].trim();
      const name = isEmoji ? `${optLetter(i)} şıkkı` : `${i + 1}. kartın başlığı`;
      if (!o) return `${name} boş bırakılamaz.`;
      if (o.length > max) return `${name} en fazla ${max} karakter olabilir.`;
    }
    const low = d.options.map((o) => o.trim().toLocaleLowerCase('tr-TR'));
    if (new Set(low).size !== low.length) return isEmoji ? 'Şıklar birbirinden farklı olmalı.' : 'Kart başlıkları birbirinden farklı olmalı.';
    if (isEmoji && d.correct_index != null && !(d.correct_index >= 0 && d.correct_index < d.options.length)) return 'Doğru cevap mevcut şıklardan biri olmalı.';
    if (!isEmoji) {
      const bad = d.media.findIndex((m) => m.trim() && !/^https?:\/\/\S+$/i.test(m.trim()));
      if (bad >= 0) return `${bad + 1}. kartın görsel adresi geçerli değil (https:// ile başlamalı).`;
    }
  } else if (n && d.options.filter((o) => o.trim()).length !== n) return `Bu oyun için tam olarak ${n} seçenek girilmeli.`;
  if (d.timer_on && !(d.timer_seconds >= 5 && d.timer_seconds <= 3600)) return 'Süre 5 ile 3600 saniye arasında olmalı.';
  return null;
}

function Editor({ mode, draft, games, cats, onClose, onSaved, onDelete }: {
  mode: Mode; draft: Draft; games: GameLite[]; cats: CatLite[]; onClose: () => void; onSaved: (keepOpen: boolean) => void; onDelete?: () => void;
}) {
  const chal = mode === 'challenges';
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState<'' | 'draft' | 'pub' | 'next'>('');
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const engine = games.find((g) => g.id === d.game_id)?.engine;
  // Kart görselleri: kayıtlı hâldeki adresler ve bu oturumda yüklenip henüz kaydedilmemiş olanlar
  const savedMedia = useRef<string[]>(draft.media);
  const sessionUploads = useRef<Set<string>>(new Set());
  useEffect(() => () => { // kapatılırsa / başka soruya geçilirse kaydedilmemiş yüklemeleri temizle
    if (sessionUploads.current.size) void removeCardImages([...sessionUploads.current]);
  }, []);
  const discardImage = (url: string) => {
    if (sessionUploads.current.has(url)) { sessionUploads.current.delete(url); void removeCardImages([url]); }
  };
  const nOpt = optionCount(engine);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const catName = cats.find((c) => c.id === d.category_id)?.name;

  const changeGame = (gid: string) => {
    const eng = games.find((g) => g.id === gid)?.engine;
    setD((x) => {
      const n = isFlexOptions(eng) ? Math.min(FLEX_MAX, Math.max(FLEX_MIN, x.options.length || optionCount(eng))) : optionCount(eng);
      const options = n ? [...x.options, ...Array(n).fill('')].slice(0, n) : [];
      return {
        ...x, game_id: gid, category_id: cats.find((c) => c.game_id === gid)?.id ?? '', options,
        media: eng === 'cards' ? alignMedia(x.media, options.length) : [],
        correct_index: hasCorrect(eng) && x.correct_index != null && x.correct_index < Math.min(options.length, eng === 'quiz' ? 4 : FLEX_MAX) ? x.correct_index : null,
      };
    });
  };

  const save = async (active: boolean, next = false) => {
    if (uploading) { setErr('Görsel yüklemesi bitene kadar bekleyin.'); return; }
    const e = validateDraft(d, engine);
    setErr(e);
    if (e) return;
    const media = engine === 'cards' ? alignMedia(d.media.map((m) => m.trim()), d.options.length) : [];
    setBusy(next ? 'next' : active ? 'pub' : 'draft');
    const payload = {
      category_id: d.category_id,
      text: d.text.trim(),
      kind: engine === 'truth_dare' ? d.kind : null,
      level: d.level,
      mood: d.mood,
      options: nOpt ? d.options.map((o) => o.trim()) : [],
      media,
      correct_index: hasCorrect(engine) ? d.correct_index : null,
      timer_seconds: chal && d.timer_on ? Math.round(d.timer_seconds) : null,
      is_active: active,
    };
    try {
      if (d.id) mustAffect(await supabase.from('questions').update(payload).eq('id', d.id).select('id'));
      else unwrap(await supabase.from('questions').insert(payload).select('id').single());
      // Kaydedildi: bu oturumdaki yüklemeler artık kalıcı; kayıttan çıkarılan eski görseller depodan silinir
      const removed = savedMedia.current.filter((u) => u && !media.includes(u));
      if (removed.length) void removeCardImages(removed);
      sessionUploads.current.clear();
      savedMedia.current = next ? [] : media;
      toast.success(d.id ? 'Değişiklikler kaydedildi.' : active ? 'Yayınlandı.' : 'Taslak olarak kaydedildi.');
      if (next) {
        setD((x) => ({ ...x, id: undefined, text: '', options: x.options.map(() => ''), media: x.media.map(() => ''), correct_index: null }));
        onSaved(true);
      } else onSaved(false);
    } catch (x) { toast.error(x); } finally { setBusy(''); }
  };

  const title = d.id ? (chal ? 'Görevi düzenle' : 'Soruyu düzenle') : chal ? 'Görev oluştur' : 'Soru oluştur';
  const gameCats = cats.filter((c) => c.game_id === d.game_id);

  return (
    <div className="grid-form">
      <div className="card accent" style={{ gap: 14 }}>
        <div className="card-h"><span className="card-t">{title}</span><button className="icon-btn" onClick={onClose} aria-label="Kapat" title="Kapat"><Icon n="close" size={18} /></button></div>
        <div className="form-grid">
          {games.length > 1 && (
            <Field label="Oyun">
              <select className="select" value={d.game_id} onChange={(e) => changeGame(e.target.value)}>
                {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
          )}
          <Field label={engine === 'quiz' ? 'Test' : 'Kategori'} error={!gameCats.length ? (engine === 'quiz' ? 'Bu oyunda test yok. Önce Testler bölümünden bir test oluşturun.' : 'Bu oyunda kategori yok. Önce Kategoriler bölümünden ekleyin.') : null}>
            <select className="select" value={d.category_id} onChange={(e) => set('category_id', e.target.value)}>
              {!d.category_id && <option value="">{engine === 'quiz' ? 'Test seçin' : 'Kategori seçin'}</option>}
              {gameCats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (pasif)'}</option>)}
            </select>
          </Field>
        </div>
        {engine === 'truth_dare' && (
          <Field label="Tür"><Segmented value={d.kind} onChange={(v) => set('kind', v)} options={[{ v: 'truth', t: 'Doğruluk' }, { v: 'dare', t: 'Cesaret' }]} /></Field>
        )}
        <Field label="Seviye"><Segmented value={d.level} onChange={(v) => set('level', v)} options={LEVELS.map((l) => ({ v: l.v, t: l.t }))} /></Field>
        <Field label="Ruh hali">
          <div className="mood-chips">
            {MOODS.map((m) => <button key={m.v} type="button" className={`mood-chip ${d.mood === m.v ? 'on' : ''}`} onClick={() => set('mood', m.v)}>{m.t}</button>)}
          </div>
        </Field>
        <Field label="Metin" right={<span className={d.text.length > 600 ? '' : 'muted2'} style={{ color: d.text.length > 600 ? 'var(--red)' : undefined }}>{num(d.text.length)} / 600</span>}>
          <textarea className="textarea" value={d.text} onChange={(e) => set('text', e.target.value)} placeholder={chal ? 'Partnerine 60 saniye boyunca gözlerini kaçırmadan bak.' : 'Partnerine henüz hiç söylemediğin romantik bir düşüncen var mı?'} autoFocus={!d.id} />
        </Field>
        {engine === 'quiz' && (
          <>
            <div className="col" style={{ gap: 8 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>Seçenekler · 4 adet, tümü zorunlu (en fazla {QUIZ_OPTION_MAX} karakter)</span>
              {d.options.map((o, i) => (
                <div className="row" key={i}>
                  <span className="mono small muted2" style={{ width: 18 }}>{optLetter(i)}</span>
                  <input className="input" value={o} maxLength={QUIZ_OPTION_MAX} aria-label={`${optLetter(i)} seçeneği`}
                    onChange={(e) => set('options', d.options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`${optLetter(i)} seçeneği`}
                    style={d.correct_index === i ? { borderColor: 'var(--green)' } : undefined} />
                  <span className="small muted2 mono" style={{ width: 44, textAlign: 'right' }}>{num(o.length)}/{QUIZ_OPTION_MAX}</span>
                </div>
              ))}
            </div>
            <Field label="Doğru cevap" hint={d.correct_index == null ? 'Uyum testi: doğru cevap yok, partnerler aynı şıkkı seçmeye çalışır.' : 'Bilgi testi: doğru cevabı bilen puan alır.'}>
              <Segmented<number> value={d.correct_index ?? -1} onChange={(v) => set('correct_index', v < 0 ? null : v)}
                options={[{ v: -1, t: 'Yok (uyum testi)' }, { v: 0, t: 'A' }, { v: 1, t: 'B' }, { v: 2, t: 'C' }, { v: 3, t: 'D' }]} />
            </Field>
          </>
        )}
        {engine === 'emoji' && (
          <EmojiOptionsEditor options={d.options} correct={d.correct_index} onChange={(options, correct_index) => setD((x) => ({ ...x, options, correct_index }))} />
        )}
        {engine === 'cards' && (
          <CardsEditor cards={{ options: d.options, media: alignMedia(d.media, d.options.length) }} gameId={d.game_id} questionId={d.id}
            update={(fn) => setD((x) => { const c = fn({ options: x.options, media: alignMedia(x.media, x.options.length) }); return { ...x, options: c.options, media: c.media }; })}
            onUploaded={(url) => sessionUploads.current.add(url)} onDiscard={discardImage} onBusy={setUploading} />
        )}
        {nOpt > 0 && !['quiz', 'emoji', 'cards'].includes(engine ?? '') && (
          <div className="col" style={{ gap: 8 }}>
            <span className="small muted" style={{ fontWeight: 600 }}>Seçenekler · tam {nOpt} adet{engine === 'know_me' ? ' (partner hakkında tahmin seçenekleri)' : ''}</span>
            {d.options.map((o, i) => (
              <div className="row" key={i}>
                <span className="mono small muted2" style={{ width: 18 }}>{String.fromCharCode(65 + i)}</span>
                <input className="input" value={o} maxLength={120} onChange={(e) => set('options', d.options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`${i + 1}. seçenek`} />
              </div>
            ))}
          </div>
        )}
        {chal && (
          <>
            <ToggleRow label="Süreli görev" sub="Uygulamada geri sayım gösterilir." on={d.timer_on} onChange={(v) => set('timer_on', v)} />
            {d.timer_on && (
              <Field label="Süre (saniye)" hint="5–3600 saniye">
                <div className="row wrap">
                  <input className="input" type="number" min={5} max={3600} value={d.timer_seconds} onChange={(e) => set('timer_seconds', Number(e.target.value))} style={{ width: 140 }} />
                  {[30, 60, 120, 300].map((s) => <button key={s} type="button" className={`chip ${d.timer_seconds === s ? 'on' : ''}`} onClick={() => set('timer_seconds', s)}>{s} sn</button>)}
                </div>
              </Field>
            )}
          </>
        )}
        {err && <InfoNote tone="bad">{err}</InfoNote>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Btn size="lg" loading={busy === 'draft'} disabled={!!busy || uploading} onClick={() => save(false)}>Taslak</Btn>
          <Btn size="lg" variant="primary" loading={busy === 'pub'} disabled={!!busy || uploading} onClick={() => save(true)}>{d.id && draft.is_active ? 'Kaydet' : 'Yayınla'}</Btn>
        </div>
        <div className="row wrap" style={{ justifyContent: 'space-between' }}>
          {!d.id ? <button type="button" className="link-btn small" disabled={!!busy || uploading} onClick={() => save(true, true)}>{busy === 'next' ? 'Kaydediliyor…' : 'Yayınla ve yenisini ekle →'}</button> : <span className="small muted2">Taslak = pasif olarak kaydeder</span>}
          {onDelete && <Btn size="sm" variant="danger" icon="delete" onClick={onDelete}>Sil</Btn>}
        </div>
      </div>

      <div className="card dark" style={{ gap: 12 }}>
        <span className="label-mono">UYGULAMA ÖNİZLEMESİ</span>
        <div className="pcard">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="k">{previewKind(engine, d)}</span>
            <span className="lv">{levelLabel(d.level).toLocaleUpperCase('tr-TR')}</span>
          </div>
          <span className={`q ${d.text.trim() ? '' : 'ph'}`}>{d.text.trim() || (chal ? 'Görev metni burada görünecek.' : 'Soru metni burada görünecek.')}</span>
          {engine === 'emoji' && <EmojiPreview options={d.options} correct={d.correct_index} />}
          {engine === 'cards' && <CardsPreview options={d.options} media={alignMedia(d.media, d.options.length)} />}
          {nOpt > 0 && engine !== 'emoji' && engine !== 'cards' && (
            <div className="col" style={{ gap: 8 }}>
              {engine === 'quiz'
                ? d.options.map((o, i) => (
                  <div key={i} className={`popt quiz ${d.correct_index === i ? 'ok' : ''}`} style={{ opacity: o.trim() ? 1 : 0.45 }}>
                    <span className="pl">{optLetter(i)}</span><span style={{ flex: 1 }}>{o.trim() || `${optLetter(i)} seçeneği`}</span>
                    {d.correct_index === i && <Icon n="check_circle" size={18} fill />}
                  </div>
                ))
                : d.options.map((o, i) => <div key={i} className="popt" style={{ opacity: o.trim() ? 1 : 0.45 }}>{o.trim() || `${i + 1}. seçenek`}</div>)}
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
            <span className="small" style={{ color: 'rgba(246,238,241,.6)' }}>{catName ?? 'Kategori'} · {moodLabel(d.mood)}</span>
            {chal && d.timer_on && <span className="row small" style={{ gap: 4, color: 'var(--pink)' }}><Icon n="timer" size={16} />{num(d.timer_seconds)} sn</span>}
          </div>
        </div>
        {engine === 'quiz' && <span className="small muted" style={{ lineHeight: 1.5 }}>{d.correct_index == null ? 'Uyum testi: iki partner aynı şıkkı seçerse eşleşme sayılır.' : `Bilgi testi: doğru cevap ${optLetter(d.correct_index)}. Oyun sonunda doğru sayıları gösterilir.`}</span>}
        {engine === 'emoji' && <span className="small muted" style={{ lineHeight: 1.5 }}>{d.correct_index == null ? 'Eşleşme modu: iki partner aynı emojiyi seçerse eşleşme sayılır.' : `Doğru cevap ${optLetter(d.correct_index)}: ikiniz de kendi ekranınızdan seçersiniz; doğruysa kutlama gösterilir.`}</span>}
        {engine === 'cards' && <span className="small muted" style={{ lineHeight: 1.5 }}>Kart Seç: doğru cevap yoktur. İki partner aynı kartı seçerse eşleşme sayılır.</span>}
        <span className="small muted" style={{ lineHeight: 1.5 }}>İçerik kuralları: rıza odaklı, açık cinsel betimleme yok, her kart atlanabilir.</span>
        {engine && <span className="tag">Motor: {ENGINE_LABEL[engine]}</span>}
      </div>
    </div>
  );
}

// ── Toplu içe aktarma ──────────────────────────────────────────
type ParsedItem = { text: string; kind: 'truth' | 'dare' | null; level: number; mood: string; options: string[]; media: string[]; correct_index: number | null; timer_seconds: number | null };
const LEVEL_WORDS: Record<string, number> = { yumusak: 0, 'yumuşak': 0, soft: 0, flortoz: 1, 'flörtöz': 1, flirty: 1, cesur: 2, bold: 2, vahsi: 3, 'vahşi': 3, wild: 3 };
const parseLevel = (v: unknown, def: number) => {
  if (v == null || v === '') return def;
  const s = String(v).trim().toLocaleLowerCase('tr-TR');
  if (/^[0-3]$/.test(s)) return Number(s);
  return LEVEL_WORDS[s] ?? NaN;
};
const parseKind = (v: unknown, def: 'truth' | 'dare') => {
  if (v == null || v === '') return def;
  const s = String(v).trim().toLocaleLowerCase('tr-TR');
  if (['truth', 'doğruluk', 'dogruluk', 'd'].includes(s)) return 'truth';
  if (['dare', 'cesaret', 'c'].includes(s)) return 'dare';
  return null;
};
/** Doğru cevap: boş / “-” / “yok” → null (uyum/eşleşme); A–D (emoji: A–F) ya da 0–3 (0–5) → indeks; aksi halde NaN. */
const parseCorrect = (v: unknown, max = 3): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= max ? v : NaN;
  const s = String(v).trim().toLocaleUpperCase('tr-TR');
  if (s === '' || s === '-' || s === 'YOK') return null;
  if (/^[A-Z]$/.test(s) && s.charCodeAt(0) - 65 <= max) return s.charCodeAt(0) - 65;
  if (/^\d$/.test(s) && Number(s) <= max) return Number(s);
  return NaN;
};
/** Emoji satırında son alan doğru cevap mı? (tek harf A–F, boş, “-” ya da “yok”) */
const looksLikeCorrect = (v: string) => /^([A-Fa-f]|-|yok|YOK|Yok)?$/.test(v.trim());
const splitPipe = (v: unknown): string[] => (Array.isArray(v) ? v.map((o) => String(o ?? '').trim()) : typeof v === 'string' ? v.split('|').map((o) => o.trim()) : []);
const parseMood = (v: unknown, def: string) => {
  if (v == null || v === '') return def;
  const s = String(v).trim().toLocaleLowerCase('tr-TR');
  return MOODS.find((m) => m.v === s || m.t.toLocaleLowerCase('tr-TR') === s)?.v ?? null;
};

function ImportModal({ mode, games, cats, defaultCat, onClose, onDone }: { mode: Mode; games: GameLite[]; cats: CatLite[]; defaultCat: string; onClose: () => void; onDone: () => void }) {
  const chal = mode === 'challenges';
  const quizMode = mode === 'quiz';
  const [catId, setCatId] = useState(defaultCat || cats[0]?.id || '');
  const [fmt, setFmt] = useState<'lines' | 'csv' | 'json'>('lines');
  const [text, setText] = useState('');
  const [level, setLevel] = useState(1);
  const [mood, setMood] = useState('karisik');
  const [kind, setKind] = useState<'truth' | 'dare'>('truth');
  const [timer, setTimer] = useState<number | ''>(chal ? 60 : '');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const cat = cats.find((c) => c.id === catId);
  const engine = games.find((g) => g.id === cat?.game_id)?.engine;
  const nOpt = optionCount(engine);
  const isQuiz = engine === 'quiz';
  const isEmoji = engine === 'emoji';
  const isCards = engine === 'cards';
  const flex = isFlexOptions(engine);

  const parsed = useMemo(() => {
    const items: ParsedItem[] = [];
    const errors: string[] = [];
    const add = (i: number, raw: Partial<Record<string, unknown>>) => {
      const t = String(raw.text ?? '').trim();
      const lv = parseLevel(raw.level, level);
      const md = parseMood(raw.mood, mood);
      const kd = engine === 'truth_dare' ? parseKind(raw.kind, kind) : null;
      let opts: string[] = [];
      if (Array.isArray(raw.options)) opts = raw.options.map((o) => String(o).trim()).filter(Boolean);
      else if (typeof raw.options === 'string' && raw.options.trim()) opts = raw.options.split('|').map((o) => o.trim()).filter(Boolean);
      const media = isCards ? alignMedia(splitPipe(raw.media), opts.length) : [];
      const tmRaw = raw.timer_seconds ?? (chal && timer !== '' ? timer : null);
      const tm = tmRaw == null || tmRaw === '' ? null : Number(tmRaw);
      const ci = isQuiz ? parseCorrect(raw.correct_index) : isEmoji ? parseCorrect(raw.correct_index, FLEX_MAX - 1) : null;
      const where = `${i}. satır`;
      if (t.length < 2 || t.length > 600) return errors.push(`${where}: metin 2–600 karakter olmalı.`);
      if (Number.isNaN(lv)) return errors.push(`${where}: seviye anlaşılamadı.`);
      if (md == null) return errors.push(`${where}: ruh hali anlaşılamadı.`);
      if (engine === 'truth_dare' && kd == null) return errors.push(`${where}: tür Doğruluk ya da Cesaret olmalı.`);
      if (flex) {
        const noun = isEmoji ? 'şık' : 'kart';
        if (opts.length < FLEX_MIN || opts.length > FLEX_MAX) return errors.push(`${where}: ${FLEX_MIN}–${FLEX_MAX} ${noun} gerekli (${opts.length} bulundu).`);
        const max = isEmoji ? EMOJI_OPTION_MAX : CARD_TITLE_MAX;
        const long = opts.findIndex((o) => o.length > max);
        if (long >= 0) return errors.push(`${where}: ${long + 1}. ${noun} en fazla ${max} karakter olabilir.`);
        if (new Set(opts.map((o) => o.toLocaleLowerCase('tr-TR'))).size !== opts.length) return errors.push(`${where}: ${isEmoji ? 'şıklar' : 'kart başlıkları'} birbirinden farklı olmalı.`);
        if (isEmoji && ci != null && (Number.isNaN(ci) || ci >= opts.length)) return errors.push(`${where}: doğru cevap mevcut şıklardan biri (A–${optLetter(opts.length - 1)}) ya da boş olmalı.`);
        if (isCards) {
          if (splitPipe(raw.media).filter(Boolean).length > opts.length) return errors.push(`${where}: görsel sayısı kart sayısından fazla.`);
          const bad = media.findIndex((m) => m && !/^https?:\/\/\S+$/i.test(m));
          if (bad >= 0) return errors.push(`${where}: ${bad + 1}. kartın görsel adresi geçerli değil.`);
        }
      } else if (nOpt && opts.length !== nOpt) return errors.push(`${where}: tam ${nOpt} seçenek gerekli (${opts.length} bulundu).`);
      if (isQuiz) {
        const long = opts.findIndex((o) => o.length > QUIZ_OPTION_MAX);
        if (long >= 0) return errors.push(`${where}: ${optLetter(long)} seçeneği en fazla ${QUIZ_OPTION_MAX} karakter olabilir.`);
        if (new Set(opts.map((o) => o.toLocaleLowerCase('tr-TR'))).size !== opts.length) return errors.push(`${where}: seçenekler birbirinden farklı olmalı.`);
        if (ci != null && Number.isNaN(ci)) return errors.push(`${where}: doğru cevap A, B, C, D ya da boş olmalı.`);
      }
      if (tm != null && !(tm >= 5 && tm <= 3600)) return errors.push(`${where}: süre 5–3600 saniye olmalı.`);
      items.push({ text: t, kind: kd, level: lv, mood: md, options: nOpt ? opts : [], media, correct_index: isQuiz || isEmoji ? ci : null, timer_seconds: chal ? tm : null });
    };
    try {
      if (fmt === 'lines') {
        text.split(/\r?\n/).forEach((line, idx) => {
          if (!line.trim()) return;
          const parts = line.split('|').map((p) => p.trim());
          if (isQuiz) {
            // Soru | A | B | C | D | doğru(A–D veya boş)
            if (parts.length > 6) { errors.push(`${idx + 1}. satır: en fazla 6 alan olabilir (soru, 4 seçenek, doğru cevap).`); return; }
            add(idx + 1, { text: parts[0], options: parts.slice(1, 5), correct_index: parts[5] ?? null });
          } else if (isEmoji) {
            // Soru | 😀 | 😍 | … | doğru(A–F veya boş) — son alan tek harf ya da boşsa doğru cevaptır
            const rest = parts.slice(1);
            const last = rest.length > FLEX_MIN && looksLikeCorrect(rest[rest.length - 1]) ? rest.pop()! : null;
            add(idx + 1, { text: parts[0], options: rest.filter(Boolean), correct_index: last });
          } else if (isCards) {
            // Soru | Kart1 | Kart2 | … (görseller sonra eklenir)
            add(idx + 1, { text: parts[0], options: parts.slice(1).filter(Boolean) });
          } else add(idx + 1, { text: parts[0], options: parts.slice(1) });
        });
      } else if (fmt === 'csv') {
        const rows = parseCsv(text);
        if (rows.length) {
          const head = rows[0].map((h) => h.trim().toLocaleLowerCase('tr-TR'));
          const hasHead = head.includes('text') || head.includes('metin');
          const idx = (names: string[]) => head.findIndex((h) => names.includes(h));
          const cols = hasHead ? {
            text: idx(['text', 'metin']), kind: idx(['kind', 'tur', 'tür']), level: idx(['level', 'seviye']), mood: idx(['mood', 'ruh_hali', 'ruh hali']),
            options: idx(['options', 'secenekler', 'seçenekler']), timer: idx(['timer_seconds', 'sure_sn', 'süre', 'sure']),
            correct: idx(['correct_index', 'correct', 'dogru', 'doğru', 'dogru_cevap', 'doğru_cevap', 'doğru cevap']),
            a: idx(['a']), b: idx(['b']), c: idx(['c']), d: idx(['d']),
            media: idx(['media', 'gorseller', 'görseller', 'gorsel', 'görsel']),
          } : { text: 0, kind: -1, level: -1, mood: -1, options: 1, timer: -1, correct: isQuiz || isEmoji ? 2 : -1, a: -1, b: -1, c: -1, d: -1, media: isCards ? 2 : -1 };
          rows.slice(hasHead ? 1 : 0).forEach((r, i) => {
            const g = (k: number) => (k >= 0 ? r[k] : undefined);
            // Testlerde ayrı a/b/c/d sütunları varsa onları kullan
            const abcd = [cols.a, cols.b, cols.c, cols.d];
            const options = cols.options < 0 && abcd.every((k) => k >= 0) ? abcd.map((k) => g(k) ?? '') : g(cols.options);
            add(i + (hasHead ? 2 : 1), { text: g(cols.text), kind: g(cols.kind), level: g(cols.level), mood: g(cols.mood), options, media: g(cols.media), correct_index: g(cols.correct), timer_seconds: g(cols.timer) || undefined });
          });
        }
      } else if (text.trim()) {
        const j = JSON.parse(text);
        if (!Array.isArray(j)) throw new AppError('JSON bir dizi olmalı.');
        j.forEach((x: unknown, i: number) => {
          if (typeof x === 'string') return add(i + 1, { text: x });
          const o = (x ?? {}) as Record<string, unknown>;
          add(i + 1, { ...o, correct_index: o.correct_index ?? o.correct ?? o.dogru ?? null });
        });
      }
    } catch (e) {
      errors.unshift(e instanceof AppError ? e.message : 'JSON ayrıştırılamadı: biçimi kontrol edin.');
    }
    return { items, errors };
  }, [text, fmt, level, mood, kind, timer, engine, nOpt, chal, isQuiz, isEmoji, isCards, flex]);

  const run = async () => {
    if (!catId || !parsed.items.length) return;
    setBusy(true);
    let done = 0;
    try {
      for (const part of chunk(parsed.items, 500)) {
        unwrap(await supabase.from('questions').insert(part.map((p) => ({ ...p, category_id: catId, is_active: active }))).select('id'));
        done += part.length;
      }
      toast.success(`${num(done)} ${chal ? 'görev' : 'soru'} içe aktarıldı.`);
      onDone();
    } catch (e) {
      toast.error(e, done ? `${num(done)} kayıt eklendi, sonra hata oluştu:` : undefined);
      if (done) onDone();
    } finally { setBusy(false); }
  };

  const example = isEmoji
    ? fmt === 'lines'
      ? 'Hangisi "romantik akşam yemeği"? | 🍕🎮 | 🕯️🍷 | 🍿📺 | 🏃‍♀️🥤 | B\nBu gece hangi ruh hâlindesin? | 😴 | 🥳 | 😍 | 🤪 |'
      : fmt === 'csv'
        ? 'metin,seviye,ruh_hali,secenekler,dogru\n"Hangi film: Titanic?",0,eglenceli,"🦁👑 | 🚢🧊💔 | 🕷️🧑 | 🦖🏝️",B'
        : '[\n  { "text": "Hangisi ilk öpücük?", "options": ["💋✨", "🍔🍟", "🚗💨", "📚✏️"], "correct": "A" },\n  { "text": "Bu gece hangi emoji?", "options": ["😴", "🥳", "😍"], "correct": null }\n]'
    : isCards
      ? fmt === 'lines'
        ? 'Hayalindeki randevu hangisi? | Piknik | Mum ışığında yemek | Konser | Sinema\nHangi hafta sonu kaçamağı? | Bağ evi | Kayak | Termal otel | Kamp'
        : fmt === 'csv'
          ? 'metin,seviye,ruh_hali,secenekler,gorseller\n"Hayalindeki randevu?",0,romantik,"Piknik | Konser | Sinema","https://…/piknik.jpg | | "'
          : '[\n  { "text": "Hayalindeki randevu?", "options": ["Piknik", "Konser", "Sinema", "Dans"], "media": ["https://…/piknik.jpg", "", "", ""] }\n]'
    : isQuiz
    ? fmt === 'lines'
      ? 'İdeal bir cumartesi gecesi hangisi? | Evde film | Şehirde yemek | Arkadaşlarla buluşma | Plansız yolculuk |\nSevgililer Günü hangi tarihte kutlanır? | 14 Şubat | 14 Mart | 1 Mayıs | 21 Haziran | A'
      : fmt === 'csv'
        ? 'metin,seviye,ruh_hali,secenekler,dogru\n"Sevgililer Günü ne zaman?",0,eglenceli,"14 Şubat | 14 Mart | 1 Mayıs | 21 Haziran",A'
        : '[\n  { "text": "Sevgililer Günü ne zaman?", "options": ["14 Şubat", "14 Mart", "1 Mayıs", "21 Haziran"], "correct": "A" },\n  { "text": "İdeal tatil?", "options": ["Sahil", "Dağ evi", "Metropol", "Kamp"], "correct": null }\n]'
    : fmt === 'lines'
    ? (nOpt ? `Soru metni | 1. seçenek | 2. seçenek${nOpt === 4 ? ' | 3. seçenek | 4. seçenek' : ''}` : chal ? 'Partnerine üç farklı iltifat gönder.\nBir şarkıyı sadece mırıldanarak anlat.' : 'İlk buluşmamızda aklından ne geçti?\nSeni en çok heyecanlandıran özelliğim ne?')
    : fmt === 'csv'
      ? `metin,seviye,ruh_hali${engine === 'truth_dare' ? ',tur' : ''}${nOpt ? ',secenekler' : ''}${chal ? ',sure_sn' : ''}\n"Örnek metin",1,romantik${engine === 'truth_dare' ? ',cesaret' : ''}${nOpt ? ',"A | B"' : ''}${chal ? ',60' : ''}`
      : `[\n  "Sadece metin",\n  { "text": "Ayrıntılı kayıt", "level": 2, "mood": "cesur"${engine === 'truth_dare' ? ', "kind": "dare"' : ''}${nOpt ? ', "options": ["A", "B"]' : ''}${chal ? ', "timer_seconds": 60' : ''} }\n]`;

  return (
    <Modal wide title="Toplu içe aktarma" sub={quizMode ? 'Seçilen teste çok sayıda soru ekleyin.' : 'Seçilen kategoriye çok sayıda içerik ekleyin.'} onClose={onClose} busy={busy}
      footer={<><Btn onClick={onClose} disabled={busy}>Vazgeç</Btn><Btn variant="primary" icon="upload" loading={busy} disabled={!parsed.items.length || !catId} onClick={run}>{num(parsed.items.length)} kaydı içe aktar</Btn></>}>
      <div className="form-grid">
        <Field label={quizMode ? 'Test' : 'Kategori'}>
          <select className="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
            {games.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {cats.filter((c) => c.game_id === g.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Biçim"><Segmented value={fmt} onChange={setFmt} options={[{ v: 'lines', t: 'Satır satır' }, { v: 'csv', t: 'CSV' }, { v: 'json', t: 'JSON' }]} /></Field>
        <Field label="Varsayılan seviye">
          <select className="select" value={level} onChange={(e) => setLevel(Number(e.target.value))}>{LEVELS.map((l) => <option key={l.v} value={l.v}>{l.t}</option>)}</select>
        </Field>
        <Field label="Varsayılan ruh hali">
          <select className="select" value={mood} onChange={(e) => setMood(e.target.value)}>{MOODS.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}</select>
        </Field>
        {engine === 'truth_dare' && (
          <Field label="Varsayılan tür"><Segmented value={kind} onChange={setKind} options={[{ v: 'truth', t: 'Doğruluk' }, { v: 'dare', t: 'Cesaret' }]} /></Field>
        )}
        {chal && (
          <Field label="Varsayılan süre (sn)" hint="Boş bırakılırsa süresiz">
            <input className="input" type="number" min={5} max={3600} value={timer} onChange={(e) => setTimer(e.target.value === '' ? '' : Number(e.target.value))} />
          </Field>
        )}
      </div>
      <Field label="İçerik" hint={isEmoji ? (fmt === 'lines' ? 'Her satıra bir soru: Soru | 😀 | 😍 | 🙈 | 🔥 | doğru (2–6 emoji şık; doğru A–F, eşleşme modu için boş bırakın).' : fmt === 'csv' ? 'Başlıklar: metin, seviye, ruh_hali, secenekler (| ile 2–6 emoji), dogru (A–F veya boş).' : 'Nesne dizisi: text, options (2–6 emoji), correct ("A"–"F", 0–5 ya da null), level, mood.')
        : isCards ? (fmt === 'lines' ? 'Her satıra bir soru: Soru | Kart1 | Kart2 | Kart3 | Kart4 (2–6 kart). Görselleri sonra soruyu düzenleyerek ekleyin.' : fmt === 'csv' ? 'Başlıklar: metin, seviye, ruh_hali, secenekler (| ile 2–6 kart başlığı), isteğe bağlı gorseller (| ile, kartlarla aynı sırada).' : 'Nesne dizisi: text, options (2–6 kart başlığı), isteğe bağlı media (görsel adresleri), level, mood.')
        : isQuiz ? (fmt === 'lines' ? 'Her satıra bir soru: Soru | A | B | C | D | doğru (A–D; uyum testi için boş bırakın).' : fmt === 'csv' ? 'Başlıklar: metin, seviye, ruh_hali, secenekler (| ile 4 adet) ya da a, b, c, d sütunları, dogru (A–D veya boş).' : 'Nesne dizisi: text, options (4 metin), correct ("A"–"D", 0–3 ya da null), level, mood.') : fmt === 'lines' ? (nOpt ? `Her satıra bir kayıt; seçenekleri “|” ile ayırın (tam ${nOpt} seçenek).` : 'Her satıra bir kayıt yazın.') : fmt === 'csv' ? 'İlk satır başlık olabilir: metin, seviye, ruh_hali, tur, secenekler (| ile ayrılmış), sure_sn.' : 'Metin dizisi ya da nesne dizisi.'}>
        <textarea className="textarea mono" style={{ minHeight: 200, fontSize: 13 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={example} spellCheck={false} />
      </Field>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <span className="small"><b style={{ color: 'var(--green)' }}>{num(parsed.items.length)}</b> geçerli kayıt{parsed.errors.length > 0 && <> · <b style={{ color: 'var(--red)' }}>{num(parsed.errors.length)}</b> hatalı satır atlanacak</>}</span>
        <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" className="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Hemen yayınla (aktif)</label>
      </div>
      {parsed.errors.length > 0 && (
        <div className="quote" style={{ maxHeight: 140, overflow: 'auto', fontSize: 12.5, color: '#F3B1B1' }}>
          {parsed.errors.slice(0, 50).join('\n')}{parsed.errors.length > 50 ? `\n… ve ${num(parsed.errors.length - 50)} hata daha` : ''}
        </div>
      )}
    </Modal>
  );
}
