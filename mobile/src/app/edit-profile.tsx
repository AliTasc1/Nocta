import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { ColorSwatches, MoodGrid } from '@/components/ProfileBits';
import { Avatar, Button, Field, Header, Loading, Screen, T } from '@/components/ui';
import { errorText } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { AVATAR_COLORS, colors } from '@/theme';

export default function EditProfile() {
  const { profile } = useApp();
  if (!profile) return <Loading />;
  return <EditProfileForm />;
}

function EditProfileForm() {
  const { profile, session, updateProfile } = useApp();
  const { show } = useToast();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [color, setColor] = useState<string>(profile?.avatar_color ?? AVATAR_COLORS[0]);
  const [mood, setMood] = useState<string | null>(profile?.mood ?? null);
  const [busy, setBusy] = useState(false);
  const nameErr = name.trim().length < 2 ? 'Adın en az 2 karakter olmalı.' : null;
  const dirty = name.trim() !== (profile?.display_name ?? '') || color !== profile?.avatar_color || mood !== (profile?.mood ?? null);

  const save = async () => {
    if (nameErr) return;
    setBusy(true);
    try {
      await updateProfile({ display_name: name.trim(), avatar_color: color, mood });
      show('Profilin güncellendi.', 'ok');
      if (router.canGoBack()) router.back();
    } catch (e) {
      show(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      contentStyle={{ gap: 22 }}
      footer={<Button title="Kaydet" loading={busy} disabled={!dirty || !!nameErr} onPress={save} />}
    >
      <Header onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} title="Profilini" accent="düzenle" />
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Avatar name={name || '?'} color={color} size={88} ring={colors.rose} />
        <ColorSwatches value={color} onChange={setColor} />
      </View>
      <Field label="Görünen ad" value={name} onChangeText={setName} maxLength={30} autoCapitalize="words" error={nameErr} />
      {session?.user.email ? <Field label="E-posta" value={session.user.email} editable={false} inputStyle={{ color: colors.mist }} /> : null}
      <View style={{ gap: 12 }}>
        <T v="caption">Bu geceki ruh hâlin</T>
        <MoodGrid value={mood} onChange={setMood} />
      </View>
    </Screen>
  );
}
