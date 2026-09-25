import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { LevelEditor } from '@/components/LevelEditor';
import { StepBar } from '@/components/LevelPicker';
import { Button, GlowBackground, IconButton, Loading, Screen, SerifTitle } from '@/components/ui';
import { getPendingJoin } from '@/lib/pendingJoin';
import { errorText } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';

export default function Level() {
  const { profile } = useApp();
  if (!profile) return <Loading />;
  return <LevelForm />;
}

function LevelForm() {
  const { profile, couple, updateProfile } = useApp();
  const toast = useToast();
  const [level, setLevel] = useState<number>(profile?.level ?? 0);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    setBusy(true);
    try {
      await updateProfile({ level });
      if (couple?.status === 'active') {
        router.push('/connected');
        return;
      }
      const code = await getPendingJoin();
      if (code) router.push({ pathname: '/join', params: { code } });
      else router.push('/invite');
    } catch (e) {
      toast.show(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} bg={<GlowBackground />} contentStyle={{ paddingHorizontal: 24, paddingTop: 12, gap: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton name="arrow_back" label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/mood'))} />
        <View style={{ flex: 1 }}>
          <StepBar step={3} total={4} />
        </View>
      </View>
      <SerifTitle text="Ne kadar ileri gitmek" accent="istiyorsunuz?" v="h1" style={{ fontSize: 36, lineHeight: 38 }} />
      <LevelEditor value={level} onChange={setLevel} />
      <Button title="Devam" loading={busy} onPress={next} style={{ marginTop: 'auto' }} />
    </Screen>
  );
}
