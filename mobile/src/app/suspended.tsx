import React, { useState } from 'react';
import { Linking, View } from 'react-native';

import { Logo } from '@/components/Brand';
import { Button, GlowBackground, Icon, Screen, SerifTitle, T } from '@/components/ui';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

export default function Suspended() {
  const { signOut } = useApp();
  const { settings } = useContent();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  const email = typeof settings.support_email === 'string' ? settings.support_email : 'destek@nocta.app';

  return (
    <Screen edges={['top', 'bottom']} bg={<GlowBackground variant="center" />} contentStyle={{ paddingHorizontal: 28, paddingTop: 24 }}>
      <Logo size={30} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18, paddingVertical: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.warningTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock_clock" size={36} color={colors.warning} />
        </View>
        <SerifTitle text="Hesabın" accent="askıya alındı." v="h1" center />
        <T v="body" center>
          Topluluk kurallarımıza aykırı olabilecek bir durum nedeniyle hesabın geçici olarak kullanıma kapatıldı. Bunun bir hata olduğunu düşünüyorsan bize yaz.
        </T>
      </View>
      <View style={{ gap: 10 }}>
        <Button
          title="Destek ekibine yaz"
          icon="mail"
          onPress={() =>
            Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('Askıya alınan hesap')}`).catch(() => show(`Bize ${email} adresinden yazabilirsin.`, 'info'))
          }
        />
        <T v="caption" center color={colors.mute}>{email}</T>
        <Button
          title="Çıkış yap"
          kind="ghost"
          size="md"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await signOut().catch(() => setBusy(false));
          }}
        />
      </View>
    </Screen>
  );
}
