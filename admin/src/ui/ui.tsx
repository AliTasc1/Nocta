import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
  type ReactNode, type ButtonHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import type { Tone } from '../lib/constants';
import { COLOR_SUGGESTIONS, ICON_SUGGESTIONS } from '../lib/constants';
import { trError } from '../lib/errors';
import { num } from '../lib/format';

export const Icon = ({ n, fill, size, className = '', style }: { n: string; fill?: boolean; size?: number; className?: string; style?: React.CSSProperties }) => (
  <span className={`ms ${fill ? 'fill' : ''} ${className}`} style={{ ...(size ? { fontSize: size } : {}), ...style }} aria-hidden="true">{n}</span>
);

export const Badge = ({ tone = 'mute', children, title }: { tone?: Tone; children: ReactNode; title?: string }) => (
  <span className={`badge t-${tone}`} title={title}>{children}</span>
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger' | 'ghost' | 'default' | 'danger-solid';
  size?: 'sm' | 'lg' | 'xl';
  icon?: string;
  loading?: boolean;
  block?: boolean;
};
export function Btn({ variant = 'default', size, icon, loading, block, className = '', children, disabled, ...rest }: BtnProps) {
  const v = variant === 'danger-solid' ? 'danger solid' : variant === 'default' ? '' : variant;
  return (
    <button type="button" className={`btn ${v} ${size ?? ''} ${block ? 'block' : ''} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" /> : icon ? <Icon n={icon} /> : null}
      {children}
    </button>
  );
}

export const IconBtn = ({ icon, title, onClick, disabled, plain }: { icon: string; title: string; onClick?: (e: React.MouseEvent) => void; disabled?: boolean; plain?: boolean }) => (
  <button type="button" className={`icon-btn ${plain ? 'plain' : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
    <Icon n={icon} size={18} />
  </button>
);

export const Toggle = ({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}>
    <i />
  </button>
);

export const ToggleRow = ({ label, sub, on, onChange, disabled }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <div className="toggle-row">
    <span>{label}{sub && <small>{sub}</small>}</span>
    <Toggle on={on} onChange={onChange} disabled={disabled} label={label} />
  </div>
);

export const Field = ({ label, hint, error, children, className = '', right }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; right?: ReactNode }) => (
  <label className={`field ${className}`}>
    <span className="lbl"><span>{label}</span>{right}</span>
    {children}
    {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
  </label>
);

export function Segmented<T extends string | number>({ value, options, onChange, disabled }: { value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value} className={o.v === value ? 'on' : ''} disabled={disabled} onClick={() => onChange(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange }: { value: T; options: { v: T; t: string; n?: number | null }[]; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.v} type="button" className={`chip ${o.v === value ? 'on' : ''}`} onClick={() => onChange(o.v)}>
          {o.t}{o.n != null && <span className="cnt">{num(o.n)}</span>}
        </button>
      ))}
    </div>
  );
}

export const Kpi = ({ t, v, d, c, loading }: { t: string; v: ReactNode; d?: ReactNode; c?: string; loading?: boolean }) => (
  <div className="kpi">
    <span className="k-t">{t}</span>
    {loading ? <span className="skel" style={{ height: 32, width: '70%' }} /> : <span className="k-v">{v}</span>}
    {loading ? <span className="skel" style={{ height: 12, width: '45%' }} /> : <span className="k-d" style={{ color: c ?? 'var(--muted)' }}>{d ?? ' '}</span>}
  </div>
);

export const InfoNote = ({ children, tone, icon }: { children: ReactNode; tone?: 'warn' | 'bad' | 'ok'; icon?: string }) => (
  <div className={`info-note ${tone ?? ''}`}><Icon n={icon ?? (tone === 'bad' ? 'error' : tone === 'warn' ? 'warning' : tone === 'ok' ? 'check_circle' : 'info')} /><span>{children}</span></div>
);

export const ContentNote = () => <InfoNote icon="sync">Değişiklikler uygulamaya otomatik olarak yansır.</InfoNote>;

export const Empty = ({ icon = 'inbox', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) => (
  <div className="empty"><Icon n={icon} /><b>{title}</b>{children && <p>{children}</p>}{action}</div>
);

export const ErrorBox = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
  <div className="empty">
    <Icon n="cloud_off" style={{ color: 'var(--red)' }} />
    <b>Veriler yüklenemedi</b>
    <p>{trError(error)}</p>
    {onRetry && <Btn icon="refresh" onClick={onRetry}>Tekrar dene</Btn>}
  </div>
);

export const SkelRows = ({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: cols }).map((__, c) => (
          <td key={c}><span className="skel" style={{ display: 'block', height: 14, width: c === 0 ? '80%' : `${40 + ((r * 7 + c * 13) % 40)}%` }} /></td>
        ))}
      </tr>
    ))}
  </>
);

export const Skel = ({ h = 14, w = '100%', r }: { h?: number; w?: number | string; r?: number }) => (
  <span className="skel" style={{ display: 'block', height: h, width: w, borderRadius: r }} />
);

export function Pager({ page, pageSize, total, onPage, unit }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; unit: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="tbl-foot">
      <span>{total === 0 ? `0 ${unit}` : `${num(from)}–${num(to)} / ${num(total)} ${unit}`}</span>
      <div className="pager">
        <span className="small muted2">Sayfa {num(page + 1)} / {num(pages)}</span>
        <IconBtn icon="chevron_left" title="Önceki sayfa" disabled={page <= 0} onClick={() => onPage(page - 1)} />
        <IconBtn icon="chevron_right" title="Sonraki sayfa" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  );
}

// ── Menü ────────────────────────────────────────────────────
export type MenuItem = { label: string; icon?: string; onClick: () => void; danger?: boolean; disabled?: boolean; hidden?: boolean } | 'sep';
export function RowMenu({ items, title = 'İşlemler' }: { items: MenuItem[]; title?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => i === 'sep' || !i.hidden);
  const cleaned = visible.filter((i, idx) => !(i === 'sep' && (idx === 0 || idx === visible.length - 1 || visible[idx - 1] === 'sep')));

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const mh = menu.current?.offsetHeight ?? 200;
    const mw = menu.current?.offsetWidth ?? 220;
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    const left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw));
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const scroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', scroll);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', scroll);
    };
  }, [open]);

  if (cleaned.length === 0) return null;
  return (
    <span className="menu-wrap" onClick={(e) => e.stopPropagation()}>
      <button ref={btn} type="button" className="icon-btn plain" title={title} aria-label={title} aria-haspopup="menu" aria-expanded={open} onClick={() => { setPos(null); setOpen((o) => !o); }}>
        <Icon n="more_horiz" size={20} />
      </button>
      {open && createPortal(
        <div ref={menu} className="menu" role="menu" style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}>
          {cleaned.map((i, idx) => i === 'sep' ? <hr key={idx} /> : (
            <button key={idx} type="button" role="menuitem" className={i.danger ? 'danger' : ''} disabled={i.disabled} onClick={() => { setOpen(false); i.onClick(); }}>
              {i.icon && <Icon n={i.icon} />}{i.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </span>
  );
}

// ── Modal & çekmece ─────────────────────────────────────────
function useEsc(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, active]);
}
function useBodyLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
}

export function Modal({ title, sub, onClose, children, footer, wide, busy }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; busy?: boolean }) {
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useEsc(close);
  useBodyLock();
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-h">
          <div className="col" style={{ gap: 6, minWidth: 0 }}>
            <h3>{title}</h3>
            {sub && <span className="muted small">{sub}</span>}
          </div>
          <IconBtn icon="close" title="Kapat" onClick={close} />
        </div>
        {children}
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ title, sub, onClose, children, footer }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEsc(onClose);
  useBodyLock();
  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-h">
          <div className="col" style={{ gap: 6, minWidth: 0 }}>{sub && <span className="crumb">{sub}</span>}<span className="serif" style={{ fontSize: 26, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{title}</span></div>
          <IconBtn icon="close" title="Kapat" onClick={onClose} />
        </div>
        <div className="drawer-b">{children}</div>
        {footer && <div className="drawer-f">{footer}</div>}
      </aside>
    </>,
    document.body,
  );
}

// ── Bildirim (toast) ────────────────────────────────────────
type ToastT = { id: number; kind: 'success' | 'error' | 'info'; msg: string };
type ToastApi = { success: (m: string) => void; error: (e: unknown, prefix?: string) => void; info: (m: string) => void };
const ToastCtx = createContext<ToastApi | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastT[]>([]);
  const seq = useRef(0);
  const push = useCallback((kind: ToastT['kind'], msg: string) => {
    const id = ++seq.current;
    setList((l) => [...l.slice(-3), { id, kind, msg }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6500 : 3500);
  }, []);
  const api = useRef<ToastApi>({
    success: (m) => push('success', m),
    error: (e, prefix) => push('error', (prefix ? prefix + ' ' : '') + trError(e)),
    info: (m) => push('info', m),
  });
  api.current = {
    success: (m) => push('success', m),
    error: (e, prefix) => push('error', (prefix ? prefix + ' ' : '') + trError(e)),
    info: (m) => push('info', m),
  };
  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {list.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              <Icon n={t.kind === 'error' ? 'error' : t.kind === 'info' ? 'info' : 'check_circle'} />
              <span className="msg">{t.msg}</span>
              <button className="icon-btn plain" style={{ width: 22, height: 22 }} aria-label="Kapat" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))}><Icon n="close" size={16} /></button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => {
  const c = useContext(ToastCtx);
  if (!c) throw new Error('ToastProvider eksik');
  return c;
};

// ── Onay penceresi ──────────────────────────────────────────
type ConfirmOpts = { title: string; body?: ReactNode; confirm?: string; danger?: boolean; typeToConfirm?: string };
const ConfirmCtx = createContext<((o: ConfirmOpts) => Promise<boolean>) | null>(null);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => { setTyped(''); setState({ ...o, resolve }); }), []);
  const done = (v: boolean) => { state?.resolve(v); setState(null); };
  const blocked = !!state?.typeToConfirm && typed.trim().toLocaleLowerCase('tr-TR') !== state.typeToConfirm.toLocaleLowerCase('tr-TR');
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <Modal title={state.title} onClose={() => done(false)} footer={<>
          <Btn onClick={() => done(false)}>Vazgeç</Btn>
          <Btn variant={state.danger ? 'danger-solid' : 'primary'} disabled={blocked} onClick={() => done(true)}>{state.confirm ?? 'Onayla'}</Btn>
        </>}>
          {state.body && <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>{state.body}</div>}
          {state.typeToConfirm && (
            <Field label={<>Onaylamak için <b style={{ color: 'var(--text)' }}>{state.typeToConfirm}</b> yazın</>}>
              <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
            </Field>
          )}
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('ConfirmProvider eksik');
  return c;
};

// ── Renk & simge alanları ───────────────────────────────────
export function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <Field label={label} error={value && !valid ? 'Renk #RRGGBB biçiminde olmalı' : null}>
      <div className="row">
        <input type="color" className="input color" value={valid ? value : '#2A1530'} onChange={(e) => onChange(e.target.value.toUpperCase())} disabled={disabled} aria-label={label} />
        <input className="input mono" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={7} />
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {COLOR_SUGGESTIONS.map((c) => (
          <button key={c} type="button" title={c} disabled={disabled} onClick={() => onChange(c)}
            style={{ width: 20, height: 20, borderRadius: 6, background: c, border: value.toUpperCase() === c ? '2px solid #fff' : '1px solid rgba(255,230,240,.2)', padding: 0 }} />
        ))}
      </div>
    </Field>
  );
}

export function IconField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Field label={label} hint="Material Symbols simge adı (ör. favorite, bolt)">
      <div className="row">
        <span className="swatch" style={{ background: 'rgba(255,255,255,.04)' }}><Icon n={value || 'help'} /></span>
        <input className="input mono" value={value} onChange={(e) => onChange(e.target.value.trim())} disabled={disabled} />
      </div>
      <div className="row wrap" style={{ gap: 4 }}>
        {ICON_SUGGESTIONS.map((i) => (
          <button key={i} type="button" title={i} disabled={disabled} onClick={() => onChange(i)} className="icon-btn"
            style={{ width: 30, height: 30, background: value === i ? 'rgba(231,104,138,.2)' : undefined, color: value === i ? 'var(--pink)' : undefined }}>
            <Icon n={i} size={17} />
          </button>
        ))}
      </div>
    </Field>
  );
}

export function PageTools({ children }: { children: ReactNode }) {
  return <div className="row wrap" style={{ justifyContent: 'space-between', gap: 12 }}>{children}</div>;
}
