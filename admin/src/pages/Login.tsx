import { useState, type FormEvent } from 'react';
import { supabase, configMissing } from '../lib/supabase';
import { trError } from '../lib/errors';
import { useAuth } from '../auth/AuthContext';
import { Btn, Field, Icon, InfoNote, Segmented } from '../ui/ui';

const Brand = () => (
  <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
    <span className="serif" style={{ fontSize: 34, lineHeight: 1 }}>noc<i style={{ color: 'var(--pink)' }}>ta</i></span>
    <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)' }}>YÖNETİM</span>
  </div>
);

export function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setOk(null);
    const em = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { setErr('Geçerli bir e-posta adresi girin.'); return; }
    if (mode !== 'reset' && pw.length < 6) { setErr('Şifre en az 6 karakter olmalı.'); return; }
    if (mode === 'up' && pw !== pw2) { setErr('Şifreler eşleşmiyor.'); return; }
    setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (error) throw error;
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({
          email: em, password: pw,
          options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        });
        if (error) throw error;
        if (!data.session) {
          if (data.user && (data.user.identities?.length ?? 0) === 0) {
            setErr('Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.');
          } else {
            setOk('Hesabınız oluşturuldu. E-posta adresinize bir doğrulama bağlantısı gönderildi; doğruladıktan sonra buradan giriş yapabilirsiniz.');
            setMode('in');
          }
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: window.location.origin + import.meta.env.BASE_URL });
        if (error) throw error;
        setOk('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
      }
    } catch (x) {
      setErr(trError(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <Brand />
        <h1>{mode === 'up' ? <>Yönetici <i>hesabı</i> oluştur</> : mode === 'reset' ? <>Şifreni <i>sıfırla</i></> : <>Tekrar <i>hoş geldin</i></>}</h1>
        {configMissing && <InfoNote tone="bad">Supabase bağlantı bilgileri eksik. .env dosyasına VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ekleyip paneli yeniden derleyin.</InfoNote>}
        {mode !== 'reset' && (
          <Segmented value={mode} onChange={(v) => { setMode(v); setErr(null); setOk(null); }} options={[{ v: 'in', t: 'Giriş yap' }, { v: 'up', t: 'Hesap oluştur' }]} />
        )}
        <Field label="E-posta">
          <input className="input" type="email" autoComplete="email" placeholder="sen@ornek.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        {mode !== 'reset' && (
          <Field label="Şifre">
            <input className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
        )}
        {mode === 'up' && (
          <Field label="Şifre (tekrar)">
            <input className="input" type="password" autoComplete="new-password" placeholder="••••••••" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
        )}
        {mode === 'up' && <InfoNote>E-posta doğrulaması gerekebilir. Kayıttan sonra gelen kutunuzu kontrol edin. İlk yönetici hesabı, sistemde tanımlı sahip e-postasıyla oluşturulmalıdır.</InfoNote>}
        {err && <InfoNote tone="bad">{err}</InfoNote>}
        {ok && <InfoNote tone="ok">{ok}</InfoNote>}
        <Btn type="submit" variant="primary" size="xl" loading={busy}>
          {mode === 'up' ? 'Hesap oluştur' : mode === 'reset' ? 'Sıfırlama bağlantısı gönder' : 'Giriş yap'}
        </Btn>
        <div className="row" style={{ justifyContent: 'center' }}>
          {mode === 'reset'
            ? <button type="button" className="link-btn" onClick={() => { setMode('in'); setErr(null); setOk(null); }}>Girişe dön</button>
            : <button type="button" className="link-btn" onClick={() => { setMode('reset'); setErr(null); setOk(null); }}>Şifremi unuttum</button>}
        </div>
      </form>
    </div>
  );
}

export function NoAccess() {
  const { session, status, signOut, recheck, error } = useAuth();
  const isErr = status === 'error';
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Brand />
        <div className="row" style={{ gap: 12 }}>
          <span className="swatch" style={{ width: 48, height: 48, background: 'rgba(240,122,122,.12)', color: 'var(--red)' }}><Icon n={isErr ? 'cloud_off' : 'lock'} size={24} /></span>
          <h1 style={{ fontSize: 30 }}>{isErr ? 'Bağlantı sorunu' : status === 'inactive' ? 'Yönetici hesabın devre dışı' : 'Bu hesabın yönetici yetkisi yok'}</h1>
        </div>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          {isErr
            ? trError({ message: error ?? '' })
            : status === 'inactive'
              ? 'Yönetici erişimin bir sahip tarafından kapatılmış. Tekrar erişim için panel sahibine başvur.'
              : <>Giriş yaptığın hesap (<b style={{ color: 'var(--text)' }}>{session?.user.email}</b>) yönetici olarak tanımlı değil. Erişim için panel sahibinden seni “Ayarlar → Yöneticiler” bölümünden eklemesini iste.</>}
        </p>
        <div className="row wrap">
          <Btn icon="refresh" onClick={recheck}>Tekrar kontrol et</Btn>
          <Btn variant="primary" icon="logout" onClick={signOut}>Çıkış yap</Btn>
        </div>
      </div>
    </div>
  );
}

export function Recovery() {
  const { finishRecovery, signOut } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.length < 6) return setErr('Şifre en az 6 karakter olmalı.');
    if (pw !== pw2) return setErr('Şifreler eşleşmiyor.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(trError(error));
    finishRecovery();
  };
  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <Brand />
        <h1>Yeni <i>şifre</i> belirle</h1>
        <Field label="Yeni şifre"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></Field>
        <Field label="Yeni şifre (tekrar)"><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {err && <InfoNote tone="bad">{err}</InfoNote>}
        <Btn type="submit" variant="primary" size="xl" loading={busy}>Şifreyi kaydet</Btn>
        <div className="row" style={{ justifyContent: 'center' }}><button type="button" className="link-btn" onClick={signOut}>Vazgeç ve çıkış yap</button></div>
      </form>
    </div>
  );
}

export function Splash({ text = 'Yükleniyor…' }: { text?: string }) {
  return (
    <div className="center-screen">
      <div className="col" style={{ alignItems: 'center', gap: 14 }}>
        <span className="serif" style={{ fontSize: 40 }}>noc<i style={{ color: 'var(--pink)' }}>ta</i></span>
        <span className="row muted small"><span className="spinner" />{text}</span>
      </div>
    </div>
  );
}
