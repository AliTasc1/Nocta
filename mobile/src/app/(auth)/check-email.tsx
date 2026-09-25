import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Logo } from '@/components/Brand';
import { Pulse } from '@/components/Rings';
import { Button, GlowBackground, Icon, Screen, SerifTitle, T } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

const COOLDOWN = 60;

export default function CheckEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(COOLDOWN);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    if (!email) return router.replace('/login');
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      toast.show('Doğrulama e-postası tekrar gönderildi.', 'ok');
      setWait(COOLDOWN);
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} bg={<GlowBackground variant="center" />} contentStyle={{ paddingHorizontal: 28, paddingTop: 24 }}>
      <Logo size={30} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, paddingVertical: 32 }}>
        <Pulse>
          <View style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 1, borderColor: 'rgba(244,185,200,.35)', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.roseTint }}>
            <Icon name="mark_email_unread" size={38} color={colors.blush} />
          </View>
        </Pulse>
        <SerifTitle text="E-postanı" accent="doğrula." v="h1" center />
        <T v="body" center>
          {email ? (
            <>
              <T v="body" color={colors.pearl} style={{ fontWeight: '700' }}>{email}</T> adresine bir doğrulama bağlantısı gönderdik.
            </>
          ) : (
            'E-posta adresine bir doğrulama bağlantısı gönderdik.'
          )}
        </T>
        <T v="bodySm" center>
          Bağlantıya dokunarak hesabını onayla, sonra bu ekrana dönüp giriş yap. Gelmediyse gereksiz (spam) klasörüne de bak.
        </T>
      </View>
      <View style={{ gap: 10 }}>
        <Button title="Giriş yap" onPress={() => router.replace('/login')} />
        <Button
          title={wait > 0 ? `Tekrar gönder (${wait} sn)` : 'Tekrar gönder'}
          kind="outline"
          size="md"
          loading={busy}
          disabled={wait > 0}
          onPress={resend}
        />
      </View>
    </Screen>
  );
}
