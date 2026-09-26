// Emoji (emoji şıklar) ve Kart Seç (resimli kartlar) motorlarına özel düzenleyici, önizleme ve liste parçaları.
import { useRef, useState } from 'react';
import { CARD_TITLE_MAX, EMOJI_OPTION_MAX, FLEX_MAX, FLEX_MIN, optLetter } from '../lib/constants';
import {
  CARD_IMAGE_ACCEPT, cardImagePath, cardPathFromUrl, uploadCardImage, validateCardImage,
} from '../lib/cardImages';
import { AppError } from '../lib/errors';
import { num } from '../lib/format';
import { Btn, Icon, useToast } from '../ui/ui';

// ── Emoji paleti ─────────────────────────────────────────────
export const EMOJI_GROUPS: { k: string; t: string; list: string[] }[] = [
  { k: 'ask', t: 'Aşk', list: ['❤️', '💕', '💖', '💘', '💝', '💞', '💓', '💗', '💋', '💌', '💍', '💐', '🌹', '😍', '🥰', '😘', '💑', '💏', '🫶', '💔'] },
  { k: 'yuz', t: 'Yüz', list: ['😀', '😂', '🤣', '😊', '😇', '🙂', '😉', '😜', '🤪', '😎', '🤩', '🥳', '😏', '😴', '🤔', '🙈', '😱', '😭', '😡', '🤯'] },
  { k: 'yemek', t: 'Yemek', list: ['🍕', '🍔', '🍟', '🌮', '🍣', '🍝', '🍰', '🎂', '🍫', '🍿', '🍦', '🍓', '🍒', '🥐', '☕', '🍷', '🥂', '🍾', '🍺', '🍹'] },
  { k: 'aktivite', t: 'Aktivite', list: ['⚽', '🏀', '🎾', '🏊', '🚴', '🧘', '💃', '🕺', '🎤', '🎧', '🎸', '🎮', '🎲', '🎬', '🎨', '📚', '🏕️', '🎉', '🎁', '🏆'] },
  { k: 'seyahat', t: 'Seyahat', list: ['✈️', '🚗', '🚢', '🚂', '🏝️', '🏖️', '🏔️', '🗼', '🗽', '🏰', '🌍', '🌅', '🌃', '🌙', '⭐', '☀️', '🌧️', '❄️', '🔥', '🌈'] },
  { k: 'nesne', t: 'Nesne', list: ['💎', '💰', '📱', '💻', '📸', '🔑', '🕯️', '🛏️', '🛁', '🧸', '🎈', '⏰', '💡', '📖', '✏️', '🧳', '🪩', '👑', '🎀', '🔮'] },
];

type SegmenterLike = { segment: (s: string) => Iterable<{ segment: string }> };
/** Metni görünür karakterlere (birleşik emojiler tek parça) böler. */
function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => SegmenterLike }).Segmenter;
  if (Seg) return [...new Seg('tr', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  return Array.from(s);
}
const HAS_LETTER = /\p{L}/u;

/** Seçenek listesinde i. öğe silindiğinde doğru cevap indeksini günceller. */
const shiftCorrect = (c: number | null, removed: number) => (c == null ? null : c === removed ? null : c > removed ? c - 1 : c);

function CorrectPicker({ count, value, onChange, noneLabel }: { count: number; value: number | null; onChange: (v: number | null) => void; noneLabel: string }) {
  const opts: { v: number | null; t: string }[] = [{ v: null, t: noneLabel }, ...Array.from({ length: count }, (_, i) => ({ v: i, t: optLetter(i) }))];
  return (
    <div className="chips" role="radiogroup" aria-label="Doğru cevap">
      {opts.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} className={`chip ${value === o.v ? 'on' : ''}`} onClick={() => onChange(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

export function EmojiOptionsEditor({ options, correct, onChange }: {
  options: string[]; correct: number | null; onChange: (options: string[], correct: number | null) => void;
}) {
  const [focus, setFocus] = useState(0);
  const [group, setGroup] = useState(EMOJI_GROUPS[0].k);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const target = Math.min(focus, options.length - 1);

  const setOpt = (i: number, v: string) => onChange(options.map((x, j) => (j === i ? v : x)), correct);
  const pick = (e: string) => {
    const cur = options[target] ?? '';
    if ((cur + e).length > EMOJI_OPTION_MAX) return;
    setOpt(target, cur + e);
    refs.current[target]?.focus();
  };
  const backspace = () => {
    const g = graphemes(options[target] ?? '');
    g.pop();
    setOpt(target, g.join(''));
    refs.current[target]?.focus();
  };
  const add = () => { if (options.length < FLEX_MAX) { onChange([...options, ''], correct); setFocus(options.length); } };
  const remove = (i: number) => {
    if (options.length <= FLEX_MIN) return;
    onChange(options.filter((_, j) => j !== i), shiftCorrect(correct, i));
    setFocus((f) => Math.max(0, f > i ? f - 1 : Math.min(f, options.length - 2)));
  };

  return (
    <>
      <div className="col" style={{ gap: 8 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>Emoji şıklar · {FLEX_MIN}–{FLEX_MAX} adet, tümü zorunlu. Bir şıkkı seçip aşağıdaki paletten emoji ekleyin.</span>
        {options.map((o, i) => (
          <div className={`emoji-row ${target === i ? 'focus' : ''}`} key={i}>
            <span className="mono small muted2" style={{ width: 18 }}>{optLetter(i)}</span>
            <input ref={(el) => { refs.current[i] = el; }} className="input emoji-input" value={o} maxLength={EMOJI_OPTION_MAX} aria-label={`${optLetter(i)} şıkkı`}
              onFocus={() => setFocus(i)} onChange={(e) => setOpt(i, e.target.value)} placeholder="😀😍"
              style={correct === i ? { borderColor: 'var(--green)' } : undefined} />
            <span className={`emoji-big ${o.trim() ? '' : 'ph'}`} aria-hidden="true">{o.trim() || '＋'}</span>
            <button type="button" className="icon-btn" title="Şıkkı kaldır" aria-label={`${optLetter(i)} şıkkını kaldır`} disabled={options.length <= FLEX_MIN} onClick={() => remove(i)}><Icon n="close" size={18} /></button>
            {o.trim() && HAS_LETTER.test(o) && <span className="emoji-warn">Harf içeriyor — bu oyunda emoji kullanılması önerilir.</span>}
          </div>
        ))}
        {options.length < FLEX_MAX && <button type="button" className="add-scene" onClick={add}><Icon n="add" size={18} />Şık ekle ({num(options.length)}/{FLEX_MAX})</button>}
      </div>

      <div className="emoji-picker" aria-label="Emoji paleti">
        <div className="row wrap" style={{ gap: 6, justifyContent: 'space-between' }}>
          <div className="chips" role="tablist">
            {EMOJI_GROUPS.map((g) => (
              <button key={g.k} type="button" role="tab" aria-selected={group === g.k} className={`chip ${group === g.k ? 'on' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => setGroup(g.k)}>{g.t}</button>
            ))}
          </div>
          <span className="small muted2">Hedef: <b style={{ color: 'var(--text)' }}>{optLetter(target)}</b> şıkkı</span>
        </div>
        <div className="emoji-grid">
          {EMOJI_GROUPS.find((g) => g.k === group)!.list.map((e) => (
            <button key={e} type="button" className="emoji-cell" title={`${optLetter(target)} şıkkına ekle`} aria-label={`${e} ekle`}
              onMouseDown={(ev) => ev.preventDefault()} onClick={() => pick(e)}>{e}</button>
          ))}
          <button type="button" className="emoji-cell back" title="Son emojiyi sil" aria-label="Son emojiyi sil" onMouseDown={(ev) => ev.preventDefault()} onClick={backspace}><Icon n="backspace" size={20} /></button>
        </div>
      </div>

      <div className="field">
        <span className="lbl"><span>Doğru cevap</span></span>
        <CorrectPicker count={options.length} value={correct} noneLabel="Yok (eşleşme modu)" onChange={(v) => onChange(options, v)} />
        <span className="hint">{correct == null ? 'Eşleşme modu: doğru cevap yok, partnerler aynı şıkkı seçmeye çalışır.' : `Doğru cevap ${optLetter(correct)}: doğru bilen kutlama görür, oyun sonunda doğru sayısı gösterilir.`}</span>
      </div>
    </>
  );
}

// ── Kartlar ───────────────────────────────────────────────────
export function CardImg({ url, className, alt }: { url: string; className?: string; alt?: string }) {
  const [bad, setBad] = useState<string | null>(null);
  if (!url || bad === url) return <span className={`${className ?? ''} img-ph`} title={url && bad === url ? 'Görsel yüklenemedi' : 'Görsel yok'}><Icon n={url ? 'broken_image' : 'image'} size={18} /></span>;
  return <img className={className} src={url} alt={alt ?? ''} loading="lazy" onError={() => setBad(url)} />;
}

type Cards = { options: string[]; media: string[] };
export function CardsEditor({ cards, update, gameId, questionId, onUploaded, onDiscard, onBusy }: {
  cards: Cards;
  update: (fn: (c: Cards) => Cards) => void;
  gameId: string; questionId?: string;
  /** Bu oturumda yüklenen görsel adresi (kaydedilmezse silinir). */
  onUploaded: (url: string) => void;
  /** Karttan kaldırılan görsel; bu oturumda yüklendiyse hemen silinir. */
  onDiscard: (url: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const toast = useToast();
  const [up, setUp] = useState<Record<number, number>>({});
  const [drag, setDrag] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const active = useRef(0);
  const uploading = Object.keys(up).length > 0;
  const n = cards.options.length;

  const setField = (i: number, k: keyof Cards, v: string) => update((c) => ({ ...c, [k]: c[k].map((x, j) => (j === i ? v : x)) }));
  const move = (i: number, dir: -1 | 1) => update((c) => {
    const j = i + dir;
    if (j < 0 || j >= c.options.length) return c;
    const o = [...c.options]; const m = [...c.media];
    [o[i], o[j]] = [o[j], o[i]]; [m[i], m[j]] = [m[j], m[i]];
    return { options: o, media: m };
  });
  const add = () => update((c) => (c.options.length < FLEX_MAX ? { options: [...c.options, ''], media: [...c.media, ''] } : c));
  const remove = (i: number) => {
    const old = cards.media[i];
    update((c) => (c.options.length > FLEX_MIN ? { options: c.options.filter((_, j) => j !== i), media: c.media.filter((_, j) => j !== i) } : c));
    if (old) onDiscard(old);
  };
  const clearImage = (i: number) => { const old = cards.media[i]; setField(i, 'media', ''); if (old) onDiscard(old); };

  const upload = async (i: number, file: File | undefined) => {
    if (!file) return;
    const err = validateCardImage(file);
    if (err) { toast.error(new AppError(err)); return; }
    active.current++; onBusy(true);
    setUp((u) => ({ ...u, [i]: 0 }));
    try {
      const url = await uploadCardImage(file, cardImagePath(gameId, questionId, file), (p) => setUp((u) => ({ ...u, [i]: p })));
      onUploaded(url);
      const old = cards.media[i];
      setField(i, 'media', url);
      if (old) onDiscard(old);
      toast.success('Görsel yüklendi.');
    } catch (e) { toast.error(e); } finally {
      setUp((u) => { const x = { ...u }; delete x[i]; return x; });
      if (--active.current <= 0) { active.current = 0; onBusy(false); }
      const f = fileRefs.current[i]; if (f) f.value = '';
    }
  };

  return (
    <div className="col" style={{ gap: 10 }}>
      <span className="small muted" style={{ fontWeight: 600 }}>Kartlar · {FLEX_MIN}–{FLEX_MAX} adet. Her kartın başlığı zorunlu; görsel isteğe bağlı (JPEG, PNG, WebP, GIF · en fazla 5 MB).</span>
      {cards.options.map((t, i) => {
        const m = cards.media[i] ?? '';
        const pct = up[i];
        const ours = !!cardPathFromUrl(m);
        return (
          <div key={i} className={`card-edit ${drag === i ? 'drag' : ''}`}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(i); } }}
            onDragLeave={() => setDrag((d) => (d === i ? null : d))}
            onDrop={(e) => { e.preventDefault(); setDrag(null); if (pct == null) upload(i, e.dataTransfer.files?.[0]); }}>
            <div className="card-thumb-lg">
              {pct != null ? <span className="img-ph col" style={{ gap: 6 }}><span className="spinner" /><span className="mono small">%{num(pct)}</span></span> : <CardImg url={m} alt={t} />}
            </div>
            <div className="col" style={{ gap: 8, minWidth: 0, flex: 1 }}>
              <div className="row" style={{ gap: 6 }}>
                <span className="mono small muted2" style={{ width: 16 }}>{num(i + 1)}</span>
                <input className="input" value={t} maxLength={CARD_TITLE_MAX} aria-label={`${i + 1}. kart başlığı`} placeholder={`${i + 1}. kart başlığı`}
                  onChange={(e) => setField(i, 'options', e.target.value)} />
                <button type="button" className="icon-btn" title="Yukarı taşı" aria-label={`${i + 1}. kartı yukarı taşı`} disabled={i === 0 || uploading} onClick={() => move(i, -1)}><Icon n="arrow_upward" size={18} /></button>
                <button type="button" className="icon-btn" title="Aşağı taşı" aria-label={`${i + 1}. kartı aşağı taşı`} disabled={i === n - 1 || uploading} onClick={() => move(i, 1)}><Icon n="arrow_downward" size={18} /></button>
                <button type="button" className="icon-btn" title="Kartı kaldır" aria-label={`${i + 1}. kartı kaldır`} disabled={n <= FLEX_MIN || uploading} onClick={() => remove(i)}><Icon n="delete" size={18} /></button>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <input ref={(el) => { fileRefs.current[i] = el; }} type="file" accept={CARD_IMAGE_ACCEPT} hidden aria-label={`${i + 1}. kart görsel dosyası`}
                  onChange={(e) => upload(i, e.target.files?.[0])} />
                <Btn size="sm" icon="upload" loading={pct != null} onClick={() => fileRefs.current[i]?.click()}>{pct != null ? `Yükleniyor… %${num(pct)}` : m ? 'Görseli değiştir' : 'Görsel yükle'}</Btn>
                {m && pct == null && <Btn size="sm" variant="ghost" icon="hide_image" onClick={() => clearImage(i)}>Görseli kaldır</Btn>}
                <input className="input sm-input" value={m} disabled={pct != null} aria-label={`${i + 1}. kart görsel adresi`} placeholder="veya görsel adresi yapıştırın (https://…)"
                  onChange={(e) => setField(i, 'media', e.target.value.trim())} style={{ flex: 1, minWidth: 160 }} title={ours ? 'Nocta deposundaki görsel' : undefined} />
              </div>
            </div>
          </div>
        );
      })}
      {n < FLEX_MAX && <button type="button" className="add-scene" onClick={add}><Icon n="add" size={18} />Kart ekle ({num(n)}/{FLEX_MAX})</button>}
      <span className="small muted2">Görseli karta sürükleyip bırakabilirsiniz. Kartları oklarla sıralayın; başlık ve görsel birlikte taşınır. Kart Seç'te doğru cevap yoktur: partnerler aynı kartı seçmeye çalışır.</span>
    </div>
  );
}

// ── Önizleme ─────────────────────────────────────────────────
export function EmojiPreview({ options, correct }: { options: string[]; correct: number | null }) {
  return (
    <div className="p-emoji-grid">
      {options.map((o, i) => (
        <div key={i} className={`p-emoji ${correct === i ? 'ok' : ''}`} style={{ opacity: o.trim() ? 1 : 0.45 }}>
          <span className="pl">{optLetter(i)}</span>
          <span className="e">{o.trim() || '❔'}</span>
          {correct === i && <Icon n="check_circle" size={18} fill className="ck" />}
        </div>
      ))}
    </div>
  );
}

export function CardsPreview({ options, media }: { options: string[]; media: string[] }) {
  return (
    <div className="p-card-grid">
      {options.map((t, i) => (
        <div key={i} className="p-card" style={{ opacity: t.trim() ? 1 : 0.5 }}>
          <CardImg url={media[i] ?? ''} className="p-card-img" alt={t} />
          <span className="p-card-t">{t.trim() || `${i + 1}. kart`}</span>
        </div>
      ))}
    </div>
  );
}

// ── Liste satırı ─────────────────────────────────────────────
export function EmojiRowOptions({ options, correct }: { options: string[]; correct: number | null }) {
  return (
    <div className="emoji-opts">
      {options.map((o, i) => (
        <span key={i} className={`emoji-opt ${correct === i ? 'ok' : ''}`} title={`${optLetter(i)}: ${o}`}><b>{optLetter(i)}</b>{o}</span>
      ))}
    </div>
  );
}

export function CardThumbs({ options, media }: { options: string[]; media: string[] }) {
  return (
    <div className="card-thumbs">
      {options.map((t, i) => (
        <span key={i} className="card-thumb" title={t}>
          <CardImg url={media[i] ?? ''} alt={t} />
          <span className="ct">{t}</span>
        </span>
      ))}
    </div>
  );
}
