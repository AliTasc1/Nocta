import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Field, Header, Icon, Screen, T } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

type ReportType = 'chat' | 'photo' | 'content' | 'account' | 'other';
const TYPES: { key: ReportType; label: string; icon: string; title: string }[] = [
  { key: 'content', label: 'Soru / içerik', icon: 'style', title: 'Uygunsuz ya da hatalı içerik' },
  { key: 'chat', label: 'Sohbet', icon: 'chat_bubble', title: 'Sohbetle ilgili sorun' },
  { key: 'photo', label: 'Fotoğraf', icon: 'photo', title: 'Fotoğrafla ilgili sorun' },
  { key: 'account', label: 'Hesap', icon: 'person', title: 'Hesapla ilgili sorun' },
  { key: 'other', label: 'Diğer', icon: 'help', title: 'Diğer' },
];

export default function Report() {
  const params = useLocalSearchParams<{ type?: string }>();
  const { userId, couple, partner } = useApp();
  const { show } = useToast();
  const initial = (TYPES.find((t) => t.key === params.type)?.key ?? 'content') as ReportType;
  const [type, setType] = useState<ReportType>(initial);
  const [desc, setDesc] = useState('');
  const [aboutPartner, setAboutPartner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const valid = desc.trim().length >= 10;

  const submit = async () => {
    if (!valid || !userId) return;
    setBusy(true);
    try {
      const t = TYPES.find((x) => x.key === type)!;
      const { error } = await supabase.from('reports').insert({
        reporter_id: userId,
        reported_user_id: aboutPartner && partner ? partner.id : null,
        couple_id: couple?.id ?? null,
        type,
        title: t.title,
        description: desc.trim().slice(0, 2000),
        priority: aboutPartner ? 'high' : 'med',
      });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      show(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  if (done) {
    return (
      <Screen edges={['top', 'bottom']} contentStyle={{ gap: 18 }} footer={<Button title="Tamam" onPress={back} />}>
        <Header onBack={back} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check_circle" size={36} color={colors.success} />
          </View>
          <T v="h2" center>Bildirimin alındı</T>
          <T v="body" center>Ekibimiz en kısa sürede inceleyecek. Gerekirse e-posta adresinden sana ulaşırız.</T>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      contentStyle={{ gap: 20 }}
      footer={<Button title="Gönder" icon="send" loading={busy} disabled={!valid} onPress={submit} />}
    >
      <Header onBack={back} title="Sorun" accent="bildir" />
      <View style={{ gap: 10 }}>
        <T v="caption">Konu</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map((t) => (
            <Chip key={t.key} label={t.label} icon={t.icon} active={type === t.key} onPress={() => setType(t.key)} />
          ))}
        </View>
      </View>
      <Field
        label="Açıklama"
        placeholder="Ne oldu? Olabildiğince ayrıntılı anlat."
        value={desc}
        onChangeText={setDesc}
        multiline
        maxLength={2000}
        inputStyle={{ minHeight: 140, textAlignVertical: 'top', paddingTop: 14 }}
        hint={`${desc.trim().length < 10 ? 'En az 10 karakter · ' : ''}${desc.length} / 2000`}
      />
      {partner ? (
        <Chip label={`Bu bildirim ${partner.display_name} hakkında`} icon={aboutPartner ? 'check_box' : 'check_box_outline_blank'} active={aboutPartner} onPress={() => setAboutPartner((v) => !v)} />
      ) : null}
      <T v="caption" color={colors.mute} style={{ lineHeight: 17 }}>Bildirimler gizlidir; partnerine bildirim gitmez.</T>
    </Screen>
  );
}
