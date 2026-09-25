import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { Logo } from '@/components/Brand';
import { CheckRow, LegalLinks } from '@/components/Legal';
import { Button, GlowBackground, IconButton, Screen, T } from '@/components/ui';
import { saveAgeConsent } from '@/lib/consent';
import { colors, fonts } from '@/theme';

export default function Age() {
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const ok = adult && terms;

  const next = async () => {
    setBusy(true);
    await saveAgeConsent();
    setBusy(false);
    router.push('/register');
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      bg={<GlowBackground variant="center" />}
      contentStyle={{ paddingHorizontal: 28, paddingTop: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <IconButton name="arrow_back" label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
        <Logo size={28} />
        <View style={{ width: 44 }} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: compact ? 16 : 22, paddingVertical: compact ? 20 : 32 }}>
        <View
          style={{
            width: compact ? 80 : 96,
            height: compact ? 80 : 96,
            borderRadius: 48,
            borderWidth: 1,
            borderColor: 'rgba(244,185,200,.35)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.rose,
            shadowOpacity: 0.35,
            shadowRadius: 30,
          }}
        >
          <Text style={{ fontFamily: fonts.serif, fontSize: compact ? 36 : 44, color: colors.blush }}>18+</Text>
        </View>
        <T v="h2" center style={{ fontSize: compact ? 28 : 34, lineHeight: compact ? 31 : 37 }}>
          Bu deneyim yalnızca 18+ yetişkinler içindir.
        </T>
        <T v="bodySm" center style={{ fontSize: 14, lineHeight: 21 }}>
          Nocta, rıza ve yetişkin temalar içeren çift oyunları sunar. Devam etmek için yaşını onayla.
        </T>
      </View>

      <View style={{ gap: 10 }}>
        <CheckRow checked={adult} onChange={setAdult} label="18 yaşından büyük olduğumu onaylıyorum">
          <T v="title" style={{ fontSize: 14.5, lineHeight: 20, fontFamily: fonts.semibold }}>18 yaşından büyük olduğumu onaylıyorum.</T>
        </CheckRow>
        <CheckRow checked={terms} onChange={setTerms} label="Kullanım Koşulları ve Gizlilik metinlerini kabul ediyorum">
          <T v="title" style={{ fontSize: 14.5, lineHeight: 20, fontFamily: fonts.semibold }}>Kullanım Koşulları ve Gizlilik metinlerini okudum, kabul ediyorum.</T>
        </CheckRow>
        <Button title="Devam Et" disabled={!ok} loading={busy} onPress={next} style={{ marginTop: 8 }} />
        <LegalLinks />
      </View>
    </Screen>
  );
}
