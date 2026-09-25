import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { StepBar } from '@/components/LevelPicker';
import { MoodGrid } from '@/components/ProfileBits';
import { Button, GlowBackground, IconButton, Loading, Screen, SerifTitle, T } from '@/components/ui';
import { errorText } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

export default function Mood() {
  const { profile } = useApp();
  if (!profile) return <Loading />;
  return <MoodForm />;
}

function MoodForm() {
  const { profile, updateProfile } = useApp();
  const toast = useToast();
  const [mood, setMood] = useState<string | null>(profile?.mood ?? null);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (!mood) return;
    setBusy(true);
    try {
      await updateProfile({ mood });
      router.push('/level');
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      bg={<GlowBackground variant="bottom" />}
      contentStyle={{ paddingHorizontal: 24, paddingTop: 12, gap: 24 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton name="arrow_back" label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile-setup'))} />
        <View style={{ flex: 1 }}>
          <StepBar step={2} total={4} />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <SerifTitle text="Bugün nasıl bir" accent="gece istiyorsunuz?" v="h1" />
        <T v="bodySm" color={colors.mist}>Sorular ve görevler bu ruh hâline göre seçilir. İstediğin zaman profilinden değiştirebilirsin.</T>
      </View>
      <MoodGrid value={mood} onChange={setMood} />
      <Button title="Devam" disabled={!mood} loading={busy} onPress={next} style={{ marginTop: 'auto' }} />
    </Screen>
  );
}
