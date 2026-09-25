import { router } from 'expo-router';
import React, { useState } from 'react';

import { LevelEditor } from '@/components/LevelEditor';
import { Button, Header, Loading, Screen } from '@/components/ui';
import { errorText } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';

export default function LevelEdit() {
  const { profile } = useApp();
  if (!profile) return <Loading />;
  return <LevelEditForm />;
}

function LevelEditForm() {
  const { profile, updateProfile } = useApp();
  const { show } = useToast();
  const [level, setLevel] = useState<number>(profile?.level ?? 0);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateProfile({ level });
      show('Seviyen güncellendi.', 'ok');
      if (router.canGoBack()) router.back();
    } catch (e) {
      show(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      contentStyle={{ gap: 18 }}
      footer={<Button title="Kaydet" loading={busy} disabled={level === profile?.level} onPress={save} />}
    >
      <Header onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} title="Ne kadar ileri" accent="gidelim?" label="SEVİYE" />
      <LevelEditor value={level} onChange={setLevel} />
    </Screen>
  );
}
