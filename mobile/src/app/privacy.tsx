import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { confirmWipe } from '@/components/DangerActions';
import { useDialog } from '@/components/Dialog';
import { Header, Icon, Screen, T, Toggle } from '@/components/ui';
import { registerForPush } from '@/lib/push';
import { errorText } from '@/lib/supabase';
import type { ProfileSettings } from '@/lib/types';
import { useApp } from '@/providers/AppProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors, fonts } from '@/theme';

const ITEMS: { key: keyof ProfileSettings; title: string; desc: string }[] = [
  { key: 'blur_previews', title: 'Bildirim önizlemelerini gizle', desc: 'Kilit ekranında mesaj içeriği yerine “Yeni bir mesajın var” görünür' },
  { key: 'screenshot_alerts', title: 'Ekran görüntüsü uyarısı', desc: 'Sohbetin ekran görüntüsü alınırsa ikiniz de haberdar olursunuz' },
  { key: 'disappearing_messages', title: 'Kaybolan mesajlar', desc: 'Yeni mesajlar 24 saat sonra otomatik silinir (biriniz açarsa ikiniz için geçerli)' },
  { key: 'app_lock', title: 'Uygulama kilidi', desc: 'Açılışta Face ID, parmak izi ya da cihaz şifresi istenir' },
  { key: 'notifications', title: 'Bildirimler', desc: 'Görevler, oyun davetleri ve mesajlar için anlık bildirim' },
];

export default function Privacy() {
  const { profile, couple, partner, userId, updateSettings } = useApp();
  const { show } = useToast();
  const { dialog, ask } = useDialog();
  const [busy, setBusy] = useState<keyof ProfileSettings | null>(null);
  const settings = profile?.settings;
  const connected = couple?.status === 'active' && !!partner;

  const toggle = async (key: keyof ProfileSettings, value: boolean) => {
    if (busy) return;
    setBusy(key);
    try {
      if (key === 'app_lock' && value) {
        if (Platform.OS === 'web') throw new Error('Uygulama kilidi yalnızca telefonda kullanılabilir.');
        const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
        if (!hw || !enrolled) throw new Error('Bu cihazda tanımlı Face ID, parmak izi ya da ekran kilidi yok. Önce cihaz ayarlarından bir kilit ekle.');
        const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Uygulama kilidini aç', cancelLabel: 'Vazgeç' });
        if (!r.success) return;
      }
      await updateSettings({ [key]: value });
      if (key === 'notifications' && value && userId) registerForPush(userId).catch(() => null);
    } catch (e) {
      show(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ gap: 16 }}>
      <Header onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} title="Gizlilik" />

      <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, backgroundColor: 'rgba(127,209,174,.06)', borderWidth: 1, borderColor: 'rgba(127,209,174,.25)' }}>
        <Icon name="info" size={22} color={colors.success} />
        <T v="bodySm" style={{ flex: 1, lineHeight: 20 }} color="#D6E9E0">
          Nocta’da paylaştığın mesajlar, fotoğraflar ve cevaplar yalnızca sen ve bağlı partnerin tarafından görülebilir. İstediğin an tek dokunuşla silebilirsin.
        </T>
      </View>

      <View style={{ borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        {ITEMS.map((it, i) => {
          const on = !!settings?.[it.key];
          return (
            <Pressable
              key={it.key}
              accessibilityRole="switch"
              accessibilityState={{ checked: on, busy: busy === it.key }}
              accessibilityLabel={it.title}
              accessibilityHint={it.desc}
              onPress={() => toggle(it.key, !on)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                minHeight: 64,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: 'rgba(255,230,240,.05)',
                backgroundColor: pressed ? 'rgba(255,255,255,.03)' : 'transparent',
              })}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <T v="title" style={{ fontSize: 14.5, lineHeight: 20, fontFamily: fonts.semibold }}>{it.title}</T>
                <T v="caption" style={{ fontFamily: fonts.medium, lineHeight: 17 }}>{it.desc}</T>
              </View>
              <View pointerEvents="none" style={{ opacity: busy === it.key ? 0.5 : 1 }}>
                <Toggle value={on} onChange={() => {}} label={it.title} />
              </View>
            </Pressable>
          );
        })}
      </View>

      {connected ? (
        <>
          <T v="label" color={colors.error} style={{ fontSize: 10.5, paddingLeft: 4, marginTop: 4 }}>TEHLİKELİ BÖLGE</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              { t: 'Sohbeti sil', on: () => confirmWipe(ask, show, 'chat') },
              { t: 'Anıları sil', on: () => confirmWipe(ask, show, 'memories') },
              { t: 'Sorun bildir', on: () => router.push('/report') },
              { t: 'Engelle / kopar', on: () => router.push('/settings') },
            ].map((b) => (
              <Pressable
                key={b.t}
                accessibilityRole="button"
                onPress={b.on}
                style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, minHeight: 48, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(240,122,122,.08)', borderWidth: 1, borderColor: 'rgba(240,122,122,.3)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
              >
                <T v="title" center style={{ fontSize: 13 }} color={colors.error}>{b.t}</T>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      {dialog}
    </Screen>
  );
}
