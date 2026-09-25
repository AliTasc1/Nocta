import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useDialog } from '@/components/Dialog';
import { EMAIL_RE, EyeToggle } from '@/components/Form';
import { Button, Field, GlowBackground, IconButton, Screen, SerifTitle, T } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

export default function Login() {
  const toast = useToast();
  const { dialog, ask } = useDialog();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const pwRef = useRef<TextInput>(null);

  const addr = email.trim().toLowerCase();
  const emailErr = !EMAIL_RE.test(addr) ? 'Geçerli bir e-posta adresi gir.' : null;
  const pwErr = pw.length < 6 ? 'Şifreni yaz.' : null;

  const submit = async () => {
    setTouched(true);
    if (emailErr || pwErr) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: addr, password: pw });
      if (error) throw error;
      // Yönlendirmeyi kök düzen (Guard) yapar
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      if (/Email not confirmed/i.test(msg)) {
        router.push({ pathname: '/check-email', params: { email: addr } });
      } else {
        toast.show(errorText(e), 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (emailErr) {
      setTouched(true);
      toast.show('Şifre sıfırlama bağlantısı için önce e-posta adresini yaz.', 'info');
      return;
    }
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(addr);
      if (error) throw error;
      ask({
        icon: 'mail',
        tone: 'ok',
        title: 'E-postanı kontrol et',
        desc: `${addr} adresine bir şifre sıfırlama bağlantısı gönderdik. Bağlantıya dokunup yeni şifreni belirledikten sonra buradan giriş yapabilirsin.`,
        actions: [{ label: 'Tamam' }],
      });
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']} bg={<GlowBackground />} contentStyle={{ paddingHorizontal: 24, paddingTop: 8, gap: 26 }}>
      <View style={{ minHeight: 48, justifyContent: 'center' }}>
        <IconButton name="arrow_back" label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
      </View>
      <View style={{ gap: 10 }}>
        <SerifTitle text="Tekrar" accent="hoş geldin." v="h1" />
        <T v="body" color={colors.mist}>Partnerin seni bekliyor olabilir.</T>
      </View>
      <View style={{ gap: 14 }}>
        <Field
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
          error={touched ? emailErr : null}
        />
        <Field
          ref={pwRef}
          label="Şifre"
          placeholder="Şifren"
          value={pw}
          onChangeText={setPw}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={touched ? pwErr : null}
          right={<EyeToggle shown={show} onToggle={() => setShow((s) => !s)} />}
        />
        <Pressable
          accessibilityRole="button"
          onPress={forgot}
          disabled={resetBusy}
          style={({ pressed }) => ({ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, opacity: pressed || resetBusy ? 0.6 : 1 })}
        >
          <T v="bodySm" color={colors.blush} style={{ fontWeight: '700' }}>{resetBusy ? 'Gönderiliyor…' : 'Şifremi unuttum'}</T>
        </Pressable>
      </View>
      <Button title="Giriş Yap" loading={busy} onPress={submit} />
      <View style={{ marginTop: 'auto' }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/age')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
          <T v="bodySm" center style={{ fontSize: 14 }}>
            Hesabın yok mu? <T v="bodySm" color={colors.blush} style={{ fontSize: 14, fontWeight: '700' }}>Kayıt ol</T>
          </T>
        </Pressable>
      </View>
      {dialog}
    </Screen>
  );
}
