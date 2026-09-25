import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { ageOf, DateField, parseISODate, toISODate, type DMY } from '@/components/DateField';
import { StepBar } from '@/components/LevelPicker';
import { ColorSwatches } from '@/components/ProfileBits';
import { Avatar, Button, Field, GlowBackground, Loading, Screen, SerifTitle, T } from '@/components/ui';
import { errorText } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { AVATAR_COLORS, colors } from '@/theme';

export default function ProfileSetup() {
  const { profile } = useApp();
  if (!profile) return <Loading />;
  return <ProfileSetupForm />;
}

function ProfileSetupForm() {
  const { profile, updateProfile, signOut } = useApp();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [color, setColor] = useState<string>(profile?.avatar_color ?? AVATAR_COLORS[0]);
  const [birth, setBirth] = useState<DMY | null>(parseISODate(profile?.birth_date));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const year = new Date().getFullYear();

  const nameErr = name.trim().length < 2 ? 'Adın en az 2 karakter olmalı.' : null;
  const birthErr = !birth ? 'Doğum tarihini seç.' : ageOf(birth) < 18 ? "Nocta'yı kullanmak için 18 yaşından büyük olmalısın." : null;

  const next = async () => {
    setTouched(true);
    if (nameErr || birthErr || !birth) return;
    setBusy(true);
    try {
      await updateProfile({
        display_name: name.trim(),
        avatar_color: color,
        birth_date: toISODate(birth),
        age_confirmed_at: profile?.age_confirmed_at ?? new Date().toISOString(),
      });
      router.push('/mood');
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']} bg={<GlowBackground />} contentStyle={{ paddingHorizontal: 24, paddingTop: 12, gap: 24 }}>
      <StepBar step={1} total={4} />
      <View style={{ gap: 10 }}>
        <SerifTitle text="Seni biraz" accent="tanıyalım." v="h1" />
        <T v="body" color={colors.mist}>Partnerin seni bu isimle ve renkle görecek.</T>
      </View>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Avatar name={name || '?'} color={color} size={88} ring={colors.rose} />
        <ColorSwatches value={color} onChange={setColor} />
      </View>
      <View style={{ gap: 14 }}>
        <Field label="Görünen ad" placeholder="Adın" value={name} onChangeText={setName} maxLength={30} autoCapitalize="words" error={touched ? nameErr : null} />
        <DateField
          label="Doğum tarihi"
          value={birth}
          onChange={setBirth}
          minYear={year - 100}
          maxYear={year - 18}
          placeholder="Gün / Ay / Yıl"
          sheetTitle="Doğum tarihin"
          error={touched ? birthErr : null}
          hint="Yalnızca yaşını doğrulamak için kullanılır, partnerine gösterilmez."
        />
      </View>
      <View style={{ marginTop: 'auto', gap: 6 }}>
        <Button title="Devam" loading={busy} onPress={next} />
        <Button title="Çıkış yap" kind="ghost" size="sm" onPress={() => signOut().catch(() => {})} />
      </View>
    </Screen>
  );
}
