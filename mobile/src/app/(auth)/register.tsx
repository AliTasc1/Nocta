import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { EMAIL_RE, EyeToggle } from '@/components/Form';
import { Button, Field, GlowBackground, IconButton, Screen, SerifTitle, T } from '@/components/ui';
import { hasAgeConsent } from '@/lib/consent';
import { errorText, supabase } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-zçğıöşü]/.test(pw) && /[A-ZÇĞİÖŞÜ]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/.test(pw) || pw.length >= 12) s++;
  if (pw.length < 6) s = Math.min(s, 1);
  return s;
}
const STRENGTH = [
  { t: 'Çok zayıf', c: colors.error },
  { t: 'Zayıf', c: colors.error },
  { t: 'Orta', c: colors.warning },
  { t: 'İyi', c: colors.success },
  { t: 'Güçlü şifre', c: colors.success },
];

export default function Register() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const pw2Ref = useRef<TextInput>(null);

  useEffect(() => {
    hasAgeConsent().then((ok) => {
      if (!ok) router.replace('/age');
    });
  }, []);

  const errors = {
    name: name.trim().length < 2 ? 'Adın en az 2 karakter olmalı.' : name.trim().length > 30 ? 'Adın en fazla 30 karakter olabilir.' : null,
    email: !EMAIL_RE.test(email.trim()) ? 'Geçerli bir e-posta adresi gir.' : null,
    pw: pw.length < 8 ? 'Şifre en az 8 karakter olmalı.' : null,
    pw2: pw2 !== pw ? 'Şifreler eşleşmiyor.' : null,
  };
  const valid = !errors.name && !errors.email && !errors.pw && !errors.pw2;
  const st = strength(pw);

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    try {
      const addr = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: addr,
        password: pw,
        options: { data: { display_name: name.trim() } },
      });
      if (error) throw error;
      // E-posta zaten kayıtlıysa Supabase kimliksiz bir kullanıcı döndürür
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        toast.show('Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.', 'error');
        return;
      }
      if (!data.session) {
        router.replace({ pathname: '/check-email', params: { email: addr } });
      }
      // Oturum açıldıysa yönlendirmeyi kök düzen (Guard) yapar → profil kurulumu
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']} bg={<GlowBackground />} contentStyle={{ paddingHorizontal: 24, paddingTop: 8, gap: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <IconButton name="arrow_back" label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
        <T v="label" color={colors.mist}>HESAP OLUŞTUR</T>
      </View>
      <View style={{ gap: 10 }}>
        <SerifTitle text="Kendini" accent="tanıt." v="h1" />
        <T v="body" color={colors.mist}>Partnerin seni bu isimle görecek.</T>
      </View>
      <View style={{ gap: 14 }}>
        <Field
          label="Görünen ad"
          placeholder="Adın"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="givenName"
          maxLength={30}
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          error={touched ? errors.name : null}
        />
        <Field
          ref={emailRef}
          label="E-posta"
          placeholder="sen@ornek.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => pwRef.current?.focus()}
          error={touched ? errors.email : null}
        />
        <View style={{ gap: 8 }}>
          <Field
            ref={pwRef}
            label="Şifre"
            placeholder="En az 8 karakter"
            value={pw}
            onChangeText={setPw}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => pw2Ref.current?.focus()}
            error={touched ? errors.pw : null}
            right={<EyeToggle shown={show} onToggle={() => setShow((s) => !s)} />}
          />
          {pw.length ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= st ? STRENGTH[st].c : 'rgba(255,255,255,.1)' }} />
                ))}
              </View>
              <T v="caption" color={STRENGTH[st].c}>{STRENGTH[st].t}</T>
            </View>
          ) : null}
        </View>
        <Field
          ref={pw2Ref}
          label="Şifre tekrar"
          placeholder="Şifreni tekrar yaz"
          value={pw2}
          onChangeText={setPw2}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={touched || (pw2.length >= pw.length && pw2.length > 0) ? errors.pw2 : null}
        />
      </View>
      <View style={{ marginTop: 'auto', gap: 12 }}>
        <Button title="Hesap Oluştur" loading={busy} onPress={submit} />
        <T v="caption" center color={colors.mute}>Hesabın oluşturulduktan sonra profilini ve partner odanı birlikte kuracağız.</T>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <T v="bodySm" center>
            Zaten hesabın var mı? <T v="bodySm" color={colors.blush} style={{ fontWeight: '700' }}>Giriş yap</T>
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}
