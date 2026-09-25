import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { mustAffect, unwrap, useLoad } from '../lib/data';
import { LEVELS, levelLabel, levelTone } from '../lib/constants';
import { num, pct } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import {
  Badge, Btn, ColorField, ContentNote, Empty, ErrorBox, Field, Icon, IconBtn, InfoNote, Modal, Segmented, Skel, ToggleRow,
  useConfirm, useToast,
} from '../ui/ui';

type Story = { id: string; title: string; description: string; level: number; cover_color: string; is_premium: boolean; is_active: boolean; sort: number; story_scenes?: { count: number }[] };
type Scene = { id: string; story_id: string; chapter: string; title: string; body: string; art_note: string; glow: string; is_start: boolean; is_ending: boolean; xp: number; sort: number };
type Choice = { id: string; scene_id: string; text: string; next_scene_id: string | null; sort: number };
type Graph = { scenes: Scene[]; choices: Choice[]; stats: Record<string, number>; completions: number | null };

const GLOWS = ['rgba(231,104,138,.4)', 'rgba(168,139,240,.4)', 'rgba(242,194,123,.4)', 'rgba(127,209,174,.4)', 'rgba(244,185,200,.4)', 'rgba(240,122,122,.4)'];

function analyze(scenes: Scene[], choices: Choice[]) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const bad = new Set<string>();
  const byScene: Record<string, Choice[]> = {};
  choices.forEach((c) => (byScene[c.scene_id] ??= []).push(c));
  const starts = scenes.filter((s) => s.is_start);
  const name = (s: Scene) => `“${s.title || s.body.slice(0, 30) || 'Adsız sahne'}”`;
  if (!scenes.length) return { errors: ['Hikâyede henüz sahne yok.'], warnings, bad, byScene, unreachable: new Set<string>() };
  if (starts.length === 0) errors.push('Başlangıç sahnesi seçilmemiş. Tam olarak bir sahne başlangıç olmalı.');
  if (starts.length > 1) { errors.push(`${starts.length} başlangıç sahnesi var; yalnızca bir tane olmalı.`); starts.forEach((s) => bad.add(s.id)); }
  scenes.forEach((s) => {
    const cs = byScene[s.id] ?? [];
    if (!s.is_ending && cs.length === 0) { errors.push(`${name(s)} bir son değil ama hiç seçeneği yok.`); bad.add(s.id); }
    if (s.is_ending && cs.length > 0) warnings.push(`${name(s)} son olarak işaretli ama seçenekleri var; seçenekler gösterilmeyebilir.`);
    cs.forEach((c) => { if (!c.next_scene_id) { warnings.push(`${name(s)} içindeki “${c.text}” seçeneğinin hedef sahnesi yok.`); } });
  });
  if (!scenes.some((s) => s.is_ending)) errors.push('Hiç son sahnesi yok. En az bir sahne “son” olarak işaretlenmeli.');
  const unreachable = new Set<string>();
  if (starts.length >= 1) {
    const seen = new Set<string>([starts[0].id]);
    const stack = [starts[0].id];
    while (stack.length) {
      const id = stack.pop()!;
      (byScene[id] ?? []).forEach((c) => { if (c.next_scene_id && !seen.has(c.next_scene_id)) { seen.add(c.next_scene_id); stack.push(c.next_scene_id); } });
    }
    scenes.forEach((s) => { if (!seen.has(s.id)) unreachable.add(s.id); });
    if (unreachable.size) warnings.push(`${unreachable.size} sahneye başlangıçtan ulaşılamıyor: ${scenes.filter((s) => unreachable.has(s.id)).map(name).join(', ')}.`);
  }
  return { errors, warnings, bad, byScene, unreachable };
}

export default function Stories() {
  const { perms } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [selId, setSelId] = useState<string>('');
  const [editStory, setEditStory] = useState<Partial<Story> | null>(null);
  const [editScene, setEditScene] = useState<Partial<Scene> | null>(null);

  const stories = useLoad(async () => unwrap(await supabase.from('stories').select('*, story_scenes(count)').order('sort').order('created_at')) as Story[], []);
  useEffect(() => {
    if (stories.data && (!selId || !stories.data.some((s) => s.id === selId))) setSelId(stories.data[0]?.id ?? '');
  }, [stories.data, selId]);
  const story = stories.data?.find((s) => s.id === selId) ?? null;

  const graph = useLoad(async (): Promise<Graph | null> => {
    if (!selId) return null;
    const scenes = unwrap(await supabase.from('story_scenes').select('*').eq('story_id', selId).order('sort').order('created_at')) as Scene[];
    const ids = scenes.map((s) => s.id);
    const choices = ids.length ? unwrap(await supabase.from('story_choices').select('*').in('scene_id', ids).order('sort')) as Choice[] : [];
    const stats: Record<string, number> = {};
    if (choices.length) {
      const st = await supabase.from('story_choice_stats').select('choice_id,picks:count').in('choice_id', choices.map((c) => c.id));
      (st.data as { choice_id: string; picks: number }[] | null)?.forEach((x) => { stats[x.choice_id] = x.picks; });
    }
    const comp = await supabase.from('game_sessions').select('id', { count: 'exact', head: true }).eq('status', 'finished').eq('state->>story_id', selId);
    return { scenes, choices, stats, completions: comp.error ? null : comp.count ?? 0 };
  }, [selId]);

  const g = graph.data;
  const a = useMemo(() => analyze(g?.scenes ?? [], g?.choices ?? []), [g]);
  const sceneMap = useMemo(() => Object.fromEntries((g?.scenes ?? []).map((s) => [s.id, s])), [g]);

  const columns = useMemo(() => {
    const scenes = g?.scenes ?? [];
    const chapters: { key: string; min: number; list: Scene[] }[] = [];
    scenes.filter((s) => !s.is_ending).forEach((s) => {
      let c = chapters.find((x) => x.key === s.chapter);
      if (!c) { c = { key: s.chapter, min: s.sort, list: [] }; chapters.push(c); }
      c.min = Math.min(c.min, s.sort);
      c.list.push(s);
    });
    chapters.sort((x, y) => x.min - y.min);
    chapters.forEach((c) => c.list.sort((x, y) => Number(y.is_start) - Number(x.is_start) || x.sort - y.sort));
    const endings = scenes.filter((s) => s.is_ending).sort((x, y) => x.sort - y.sort);
    return { chapters, endings };
  }, [g]);

  const pickPct = (c: Choice) => {
    const siblings = a.byScene[c.scene_id] ?? [];
    const total = siblings.reduce((s, x) => s + (g?.stats[x.id] ?? 0), 0);
    return total ? ((g?.stats[c.id] ?? 0) / total) * 100 : null;
  };
  // Sonlar için: bu sona giden seçimlerin toplamı / tüm son seçimlerin toplamı
  const endingPct = (s: Scene) => {
    const into = (g?.choices ?? []).filter((c) => c.next_scene_id === s.id).reduce((t, c) => t + (g?.stats[c.id] ?? 0), 0);
    const all = columns.endings.reduce((t, e) => t + (g?.choices ?? []).filter((c) => c.next_scene_id === e.id).reduce((u, c) => u + (g?.stats[c.id] ?? 0), 0), 0);
    return all ? (into / all) * 100 : null;
  };

  const newScene = (chapter?: string, ending = false) => {
    const scenes = g?.scenes ?? [];
    const maxSort = Math.max(0, ...scenes.map((s) => s.sort));
    const lastChapter = columns.chapters.at(-1)?.key;
    setEditScene({
      story_id: selId, chapter: chapter ?? (ending ? lastChapter ?? 'BÖLÜM 1' : lastChapter ?? 'BÖLÜM 1'), title: '', body: '', art_note: '',
      glow: GLOWS[0], is_start: scenes.length === 0, is_ending: ending, xp: ending ? 100 : 0, sort: maxSort + 10,
    });
  };

  const toggleStory = async (key: 'is_active' | 'is_premium') => {
    if (!story) return;
    try {
      mustAffect(await supabase.from('stories').update({ [key]: !story[key] }).eq('id', story.id).select('id'));
      stories.setData((d) => d?.map((x) => (x.id === story.id ? { ...x, [key]: !story[key] } : x)) ?? null);
      toast.success('Hikâye güncellendi.');
    } catch (e) { toast.error(e); }
  };

  const deleteStory = async () => {
    if (!story) return;
    const ok = await confirm({ title: 'Hikâye silinsin mi?', body: <><b style={{ color: 'var(--text)' }}>{story.title}</b> ve {num(g?.scenes.length ?? 0)} sahnesi, tüm seçenekleri ve seçim istatistikleri kalıcı olarak silinir.</>, confirm: 'Kalıcı olarak sil', danger: true, typeToConfirm: 'SİL' });
    if (!ok) return;
    try {
      mustAffect(await supabase.from('stories').delete().eq('id', story.id).select('id'));
      toast.success('Hikâye silindi.');
      setSelId('');
      stories.reload(true);
    } catch (e) { toast.error(e); }
  };

  if (stories.error) return <div className="card"><ErrorBox error={stories.error} onRetry={() => stories.reload()} /></div>;

  const endingsCount = g?.scenes.filter((s) => s.is_ending).length ?? 0;

  return (
    <>
      <ContentNote />
      {!perms.content && <InfoNote tone="warn">Rolünüz içerik düzenlemeye izin vermiyor; bu bölümü yalnızca görüntüleyebilirsiniz.</InfoNote>}
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          {stories.loading && !stories.data ? <Skel h={36} w={260} r={10} /> : (
            <select className="select sm auto" value={selId} onChange={(e) => setSelId(e.target.value)} aria-label="Hikâye seç" disabled={!stories.data?.length}>
              {!stories.data?.length && <option value="">Hikâye yok</option>}
              {stories.data?.map((s) => <option key={s.id} value={s.id}>{s.title}{s.is_active ? '' : ' (pasif)'}</option>)}
            </select>
          )}
          <span className="small muted">{num(stories.data?.length ?? 0)} hikâye</span>
        </div>
        {perms.content && <Btn variant="primary" icon="add" onClick={() => setEditStory({ title: '', description: '', level: 1, cover_color: '#2A1530', is_premium: true, is_active: false, sort: ((stories.data?.at(-1)?.sort ?? 0) + 10) })}>Yeni hikâye</Btn>}
      </div>

      {!stories.loading && !stories.data?.length ? (
        <div className="card"><Empty icon="movie" title="Henüz hikâye yok" action={perms.content ? <Btn variant="primary" icon="add" onClick={() => setEditStory({ title: '', description: '', level: 1, cover_color: '#2A1530', is_premium: true, is_active: false, sort: 10 })}>İlk hikâyeyi oluştur</Btn> : undefined}>
          Çift Hikâyesi oyunu için sahnelerden ve seçimlerden oluşan interaktif hikâyeler yazın.
        </Empty></div>
      ) : story && (
        <div className="story-layout">
          <div className="section-stack">
            <div className="card" style={{ padding: 18, gap: 12 }}>
              <div className="cover" style={{ background: `repeating-linear-gradient(135deg,rgba(255,230,240,.05) 0 1px,transparent 1px 12px),${story.cover_color}` }}>Kapak rengi · {story.cover_color}</div>
              <span className="serif" style={{ fontSize: 26, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{story.title}</span>
              {story.description && <span className="small muted" style={{ lineHeight: 1.5 }}>{story.description}</span>}
              <div className="row wrap" style={{ gap: 8 }}>
                <Badge tone={levelTone(story.level)}>{levelLabel(story.level).toLocaleUpperCase('tr-TR')}</Badge>
                {story.is_active ? <Badge tone="ok">AKTİF</Badge> : <Badge tone="mute">TASLAK</Badge>}
                {story.is_premium && <Badge tone="pro">PREMIUM</Badge>}
              </div>
              <span className="small muted">
                {g ? <>{num(g.scenes.length)} sahne · {num(g.choices.length)} seçim · {num(endingsCount)} son · {g.completions == null ? '—' : num(g.completions)} tamamlama</> : <Skel h={12} w="80%" />}
              </span>
              {perms.content && (
                <>
                  <hr className="divider" />
                  <ToggleRow label="Yayında" sub={a.errors.length ? 'Yayına almadan önce hataları düzeltin.' : 'Uygulamada görünür.'} on={story.is_active} onChange={() => toggleStory('is_active')} />
                  <ToggleRow label="Premium" on={story.is_premium} onChange={() => toggleStory('is_premium')} />
                  <div className="row wrap">
                    <Btn size="sm" icon="edit" onClick={() => setEditStory(story)}>Bilgileri düzenle</Btn>
                    <Btn size="sm" variant="danger" icon="delete" onClick={deleteStory}>Sil</Btn>
                  </div>
                </>
              )}
            </div>
            {g && (a.errors.length > 0 || a.warnings.length > 0 ? (
              <div className="card" style={{ padding: 16, gap: 10 }}>
                <span className="card-t">Doğrulama</span>
                {a.errors.map((e, i) => <InfoNote key={'e' + i} tone="bad">{e}</InfoNote>)}
                {a.warnings.map((w, i) => <InfoNote key={'w' + i} tone="warn">{w}</InfoNote>)}
              </div>
            ) : <InfoNote tone="ok">Hikâye yapısı geçerli: tek başlangıç, tüm sahnelere ulaşılabiliyor.</InfoNote>)}
          </div>

          <div className="card dark" style={{ minWidth: 0 }}>
            <div className="card-h">
              <span className="card-t">Sahneler ve seçimler</span>
              {perms.content && <div className="row wrap"><Btn size="sm" icon="add" onClick={() => newScene()}>Sahne</Btn><Btn size="sm" icon="flag" onClick={() => newScene(undefined, true)}>Son</Btn></div>}
            </div>
            {graph.error ? <ErrorBox error={graph.error} onRetry={() => graph.reload()} /> : !g ? <Skel h={220} r={14} /> : g.scenes.length === 0 ? (
              <Empty icon="account_tree" title="Sahne yok" action={perms.content ? <Btn variant="primary" icon="add" onClick={() => newScene('BÖLÜM 1')}>Başlangıç sahnesi ekle</Btn> : undefined}>
                İlk sahneyi ekleyin, ardından seçenekleri ve sonları oluşturun.
              </Empty>
            ) : (
              <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
                <div className="graph">
                  {columns.chapters.map((col) => (
                    <div className="graph-col" key={col.key}>
                      <span className="label-mono">{col.key}</span>
                      {col.list.map((s) => (
                        <SceneCard key={s.id} s={s} choices={a.byScene[s.id] ?? []} sceneMap={sceneMap} pickPct={pickPct}
                          bad={a.bad.has(s.id)} unreachable={a.unreachable.has(s.id)} onClick={perms.content ? () => setEditScene(s) : undefined} />
                      ))}
                      {perms.content && <button type="button" className="add-scene" onClick={() => newScene(col.key)}><Icon n="add" size={16} />Bu bölüme sahne</button>}
                    </div>
                  ))}
                  <div className="graph-col">
                    <span className="label-mono">SONLAR</span>
                    {columns.endings.map((s) => {
                      const p = endingPct(s);
                      return (
                        <SceneCard key={s.id} s={s} choices={a.byScene[s.id] ?? []} sceneMap={sceneMap} pickPct={pickPct} endPct={p}
                          bad={a.bad.has(s.id)} unreachable={a.unreachable.has(s.id)} onClick={perms.content ? () => setEditScene(s) : undefined} />
                      );
                    })}
                    {perms.content && <button type="button" className="add-scene" onClick={() => newScene(undefined, true)}><Icon n="add" size={16} />Son ekle</button>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editStory && <StoryModal story={editStory} onClose={() => setEditStory(null)} onSaved={(id) => { setEditStory(null); if (id) setSelId(id); stories.reload(true); }} />}
      {editScene && g && (
        <SceneModal scene={editScene} scenes={g.scenes} choices={editScene.id ? a.byScene[editScene.id] ?? [] : []} stats={g.stats}
          chapters={[...new Set(g.scenes.map((s) => s.chapter))]}
          onClose={() => setEditScene(null)} onSaved={() => { setEditScene(null); graph.reload(true); stories.reload(true); }} />
      )}
    </>
  );
}

function SceneCard({ s, choices, sceneMap, pickPct, endPct, bad, unreachable, onClick }: {
  s: Scene; choices: Choice[]; sceneMap: Record<string, Scene>; pickPct: (c: Choice) => number | null; endPct?: number | null;
  bad: boolean; unreachable: boolean; onClick?: () => void;
}) {
  return (
    <button type="button" className={`scene ${s.is_start ? 'start' : ''} ${s.is_ending ? 'ending' : ''} ${bad ? 'bad' : ''}`} onClick={onClick} disabled={!onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="st">{s.title || 'Adsız sahne'}</span>
        <span className="row" style={{ gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.glow, boxShadow: `0 0 10px ${s.glow}` }} />
        </span>
      </div>
      <span className="sd clamp2">{s.body}</span>
      <div className="row wrap" style={{ gap: 4 }}>
        {s.is_start && <Badge tone="rose">BAŞLANGIÇ</Badge>}
        {s.is_ending && <Badge tone="warn">SON · +{num(s.xp)} XP</Badge>}
        {unreachable && <Badge tone="bad">ULAŞILAMAZ</Badge>}
        {s.is_ending && endPct != null && <span className="tag">{pct(endPct, 0)} bu sona ulaştı</span>}
      </div>
      {choices.map((c) => {
        const p = pickPct(c);
        const target = c.next_scene_id ? sceneMap[c.next_scene_id] : null;
        return (
          <span className="choice" key={c.id}>
            <span style={{ minWidth: 0 }}><b>{c.text}</b> → {target ? (target.title || 'Adsız sahne') : <span style={{ color: 'var(--amber)' }}>hedef yok</span>}</span>
            {p != null && <span className="p">{pct(p, 0)}</span>}
          </span>
        );
      })}
    </button>
  );
}

function StoryModal({ story, onClose, onSaved }: { story: Partial<Story>; onClose: () => void; onSaved: (id?: string) => void }) {
  const [f, setF] = useState<Partial<Story>>(story);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const set = <K extends keyof Story>(k: K, v: Story[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setErr(null);
    if ((f.title ?? '').trim().length < 2) return setErr('Başlık en az 2 karakter olmalı.');
    if (!/^#[0-9a-fA-F]{6}$/.test(f.cover_color ?? '')) return setErr('Kapak rengi #RRGGBB biçiminde olmalı.');
    setBusy(true);
    const payload = { title: f.title!.trim(), description: (f.description ?? '').trim(), level: f.level ?? 1, cover_color: f.cover_color, is_premium: !!f.is_premium, is_active: !!f.is_active, sort: Math.round(f.sort ?? 0) };
    try {
      if (story.id) { mustAffect(await supabase.from('stories').update(payload).eq('id', story.id).select('id')); toast.success('Hikâye kaydedildi.'); onSaved(); }
      else { const r = unwrap(await supabase.from('stories').insert(payload).select('id').single()) as { id: string }; toast.success('Hikâye oluşturuldu. Şimdi sahneleri ekleyin.'); onSaved(r.id); }
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal wide title={story.id ? 'Hikâyeyi düzenle' : 'Yeni hikâye'} onClose={onClose} busy={busy}
      footer={<><Btn onClick={onClose} disabled={busy}>Vazgeç</Btn><Btn variant="primary" icon="check" loading={busy} onClick={save}>{story.id ? 'Kaydet' : 'Oluştur'}</Btn></>}>
      <div className="form-grid">
        <Field label="Başlık" className="full"><input className="input" value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} maxLength={80} autoFocus /></Field>
        <Field label="Açıklama" className="full"><textarea className="textarea" value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={400} style={{ minHeight: 72 }} /></Field>
        <Field label="Seviye" className="full"><Segmented value={f.level ?? 1} onChange={(v) => set('level', v)} options={LEVELS.map((l) => ({ v: l.v, t: l.t }))} /></Field>
        <ColorField label="Kapak rengi" value={f.cover_color ?? ''} onChange={(v) => set('cover_color', v)} />
        <Field label="Sıra"><input className="input" type="number" value={f.sort ?? 0} onChange={(e) => set('sort', Number(e.target.value))} /></Field>
        <div className="full col" style={{ gap: 4 }}>
          <ToggleRow label="Yayında" sub="Taslak hikâyeler uygulamada görünmez." on={!!f.is_active} onChange={(v) => set('is_active', v)} />
          <ToggleRow label="Premium" on={!!f.is_premium} onChange={(v) => set('is_premium', v)} />
        </div>
      </div>
      {err && <InfoNote tone="bad">{err}</InfoNote>}
    </Modal>
  );
}

type ChoiceDraft = { id?: string; text: string; next_scene_id: string; sort: number };

function SceneModal({ scene, scenes, choices, stats, chapters, onClose, onSaved }: {
  scene: Partial<Scene>; scenes: Scene[]; choices: Choice[]; stats: Record<string, number>; chapters: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<Scene>>(scene);
  const [cs, setCs] = useState<ChoiceDraft[]>(choices.map((c) => ({ id: c.id, text: c.text, next_scene_id: c.next_scene_id ?? '', sort: c.sort })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const set = <K extends keyof Scene>(k: K, v: Scene[K]) => setF((x) => ({ ...x, [k]: v }));
  const others = scenes.filter((s) => s.id !== scene.id);
  const totalPicks = choices.reduce((s, c) => s + (stats[c.id] ?? 0), 0);

  const save = async () => {
    setErr(null);
    if (!(f.body ?? '').trim()) return setErr('Sahne metni boş olamaz.');
    if (!(f.chapter ?? '').trim()) return setErr('Bölüm adı boş olamaz.');
    const valid = cs.filter((c) => c.text.trim());
    if (cs.some((c) => !c.text.trim() && c.next_scene_id)) return setErr('Hedefi seçilmiş ama metni boş bir seçenek var.');
    if (!f.is_ending && valid.length === 0) return setErr('Son olmayan bir sahnenin en az bir seçeneği olmalı. Seçenek ekleyin ya da sahneyi “son” olarak işaretleyin.');
    setBusy(true);
    const payload = {
      story_id: f.story_id, chapter: f.chapter!.trim(), title: (f.title ?? '').trim(), body: f.body!.trim(), art_note: (f.art_note ?? '').trim(),
      glow: f.glow || GLOWS[0], is_start: !!f.is_start, is_ending: !!f.is_ending, xp: Math.max(0, Math.round(f.xp ?? 0)), sort: Math.round(f.sort ?? 0),
    };
    try {
      if (payload.is_start) {
        const prev = scenes.filter((s) => s.is_start && s.id !== scene.id).map((s) => s.id);
        if (prev.length) unwrap(await supabase.from('story_scenes').update({ is_start: false }).in('id', prev).select('id'));
      }
      let id = scene.id;
      if (id) mustAffect(await supabase.from('story_scenes').update(payload).eq('id', id).select('id'));
      else id = (unwrap(await supabase.from('story_scenes').insert(payload).select('id').single()) as { id: string }).id;

      const keep = new Set(valid.filter((c) => c.id).map((c) => c.id!));
      const removed = choices.filter((c) => !keep.has(c.id)).map((c) => c.id);
      if (removed.length) mustAffect(await supabase.from('story_choices').delete().in('id', removed).select('id'));
      for (const [i, c] of valid.entries()) {
        const row = { scene_id: id!, text: c.text.trim(), next_scene_id: c.next_scene_id || null, sort: Number.isFinite(c.sort) ? Math.round(c.sort) : i * 10 };
        const orig = choices.find((o) => o.id === c.id);
        if (c.id && orig && orig.text === row.text && (orig.next_scene_id ?? null) === row.next_scene_id && orig.sort === row.sort) continue;
        if (c.id) mustAffect(await supabase.from('story_choices').update(row).eq('id', c.id).select('id'));
        else unwrap(await supabase.from('story_choices').insert(row).select('id'));
      }
      toast.success(scene.id ? 'Sahne kaydedildi.' : 'Sahne eklendi.');
      onSaved();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Sahne silinsin mi?', body: 'Sahne ve seçenekleri silinir. Bu sahneye yönlenen seçeneklerin hedefi boşalır.', confirm: 'Sahneyi sil', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      mustAffect(await supabase.from('story_scenes').delete().eq('id', scene.id!).select('id'));
      toast.success('Sahne silindi.');
      onSaved();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={scene.id ? 'Sahneyi düzenle' : 'Yeni sahne'} onClose={onClose} busy={busy}
      footer={<>
        {scene.id && <Btn variant="danger" icon="delete" onClick={remove} disabled={busy} style={{ marginRight: 'auto' }}>Sil</Btn>}
        <Btn onClick={onClose} disabled={busy}>Vazgeç</Btn>
        <Btn variant="primary" icon="check" loading={busy} onClick={save}>Kaydet</Btn>
      </>}>
      <div className="form-grid">
        <Field label="Bölüm" hint="Aynı bölümdeki sahneler aynı sütunda gösterilir.">
          <input className="input" list="chapters" value={f.chapter ?? ''} onChange={(e) => set('chapter', e.target.value)} maxLength={40} />
          <datalist id="chapters">{chapters.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Sahne başlığı"><input className="input" value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} maxLength={80} /></Field>
        <Field label="Sahne metni" className="full"><textarea className="textarea" value={f.body ?? ''} onChange={(e) => set('body', e.target.value)} style={{ minHeight: 120 }} autoFocus={!scene.id} /></Field>
        <Field label="Görsel notu" hint="Tasarım/illüstrasyon için not (uygulamada gösterilmez)"><input className="input" value={f.art_note ?? ''} onChange={(e) => set('art_note', e.target.value)} /></Field>
        <Field label="Işıltı rengi">
          <div className="row wrap" style={{ gap: 6 }}>
            {GLOWS.map((gl) => <button key={gl} type="button" title={gl} onClick={() => set('glow', gl)} style={{ width: 26, height: 26, borderRadius: '50%', background: gl, border: f.glow === gl ? '2px solid #fff' : '1px solid rgba(255,230,240,.2)', boxShadow: `0 0 12px ${gl}` }} />)}
          </div>
          <input className="input mono sm" value={f.glow ?? ''} onChange={(e) => set('glow', e.target.value)} />
        </Field>
        <Field label="Sıra"><input className="input" type="number" value={f.sort ?? 0} onChange={(e) => set('sort', Number(e.target.value))} /></Field>
        <Field label="XP" hint="Son sahnelerde kazanılan XP (en az 100 verilir)"><input className="input" type="number" min={0} value={f.xp ?? 0} onChange={(e) => set('xp', Number(e.target.value))} /></Field>
        <div className="full col" style={{ gap: 4 }}>
          <ToggleRow label="Başlangıç sahnesi" sub="Hikâyede yalnızca bir başlangıç olabilir; seçilirse diğerinin işareti kaldırılır." on={!!f.is_start} onChange={(v) => set('is_start', v)} />
          <ToggleRow label="Son sahne" sub="Hikâye bu sahnede biter." on={!!f.is_ending} onChange={(v) => set('is_ending', v)} />
        </div>
      </div>

      <div className="col" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="card-t">Seçenekler</span>
          <span className="small muted2">{totalPicks ? `${num(totalPicks)} seçim yapıldı` : 'Henüz seçim yapılmadı'}</span>
        </div>
        {f.is_ending && cs.length > 0 && <InfoNote tone="warn">Son sahnelerde seçenekler gösterilmeyebilir.</InfoNote>}
        {cs.length === 0 && <span className="small muted">{f.is_ending ? 'Son sahnelerin seçeneği olmaz.' : 'Bu sahnenin henüz seçeneği yok.'}</span>}
        {cs.map((c, i) => {
          const picks = c.id ? stats[c.id] ?? 0 : 0;
          return (
            <div className="choice-edit" key={c.id ?? 'n' + i}>
              <input className="input sm" placeholder="Seçenek metni" value={c.text} onChange={(e) => setCs((l) => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} maxLength={120} />
              <select className="select sm" value={c.next_scene_id} onChange={(e) => setCs((l) => l.map((x, j) => (j === i ? { ...x, next_scene_id: e.target.value } : x)))} aria-label="Hedef sahne">
                <option value="">Hedef sahne seçin</option>
                {others.map((s) => <option key={s.id} value={s.id}>{s.chapter} · {s.title || s.body.slice(0, 30)}{s.is_ending ? ' (son)' : ''}</option>)}
              </select>
              <input className="input sm ord" type="number" title="Sıra" aria-label="Sıra" value={c.sort} onChange={(e) => setCs((l) => l.map((x, j) => (j === i ? { ...x, sort: Number(e.target.value) } : x)))} />
              <IconBtn icon="delete" title={picks ? `Sil (${num(picks)} seçim)` : 'Sil'} onClick={() => setCs((l) => l.filter((_, j) => j !== i))} />
            </div>
          );
        })}
        <div><Btn size="sm" icon="add" onClick={() => setCs((l) => [...l, { text: '', next_scene_id: '', sort: (l.at(-1)?.sort ?? 0) + 10 }])}>Seçenek ekle</Btn></div>
        {!scene.id && <span className="small muted2">Yeni sahneye gelen seçenekleri, kaynak sahneyi düzenleyerek bağlayabilirsiniz.</span>}
      </div>
      {err && <InfoNote tone="bad">{err}</InfoNote>}
    </Modal>
  );
}
