import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, View } from 'react-native';

import { DatePickerSheet, formatDMY, parseISODate, toISODate } from '@/components/DateField';
import { confirmWipe } from '@/components/DangerActions';
import { useDialog } from '@/components/Dialog';
import { EyeToggle } from '@/components/Form';
import { levelName } from '@/components/LevelPicker';
import { SettingsGroup } from '@/components/SettingsGroup';
import { Sheet } from '@/components/Sheet';
import { Button, Field, Header, Screen, T } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { useToast } from '@/providers/ToastProvider';
import { colors } from '@/theme';

export default function Settings() {
  const { profile, partner, couple, isPremium, session, refreshCouple, signOut } = useApp();
  const { settings } = useContent();
  const { show } = useToast();
  const { dialog, ask } = useDialog();
  const [annOpen, setAnnOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const connected = couple?.status === 'active' && !!partner;
  const pending = couple?.status === 'pending';
  const supportEmail = typeof settings.support_email === 'string' ? settings.support_email : 'destek@nocta.app';
  const year = new Date().getFullYear();

  const later = (fn: () => void) => {
    setTimeout(fn, 300);
  };

  const setAnniversary = async (iso: string | null) => {
    try {
      const { error } = await supabase.rpc('set_anniversary', { p_date: iso });
      if (error) throw error;
      await refreshCouple();
      show(iso ? 'Yıldönümü kaydedildi ♡' : 'Yıldönümü kaldırıldı.', 'ok');
    } catch (e) {
      show(errorText(e), 'error');
    }
  };

  const changePassword = async () => {
    if (pw.length < 8) return show('Yeni şifre en az 8 karakter olmalı.', 'error');
    if (pw !== pw2) return show('Şifreler eşleşmiyor.', 'error');
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPwOpen(false);
      setPw('');
      setPw2('');
      show('Şifren güncellendi.', 'ok');
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      show(/different from the old/i.test(msg) ? 'Yeni şifre eskisinden farklı olmalı.' : /reauthentication|recent/i.test(msg) ? 'Güvenlik için çıkış yapıp tekrar giriş yaptıktan sonra dene.' : errorText(e), 'error');
    } finally {
      setPwBusy(false);
    }
  };

  const disconnect = (block: boolean) =>
    ask({
      icon: block ? 'block' : 'link_off',
      tone: 'error',
      title: block ? 'Partnerini engelle?' : pending ? 'Bekleyen odayı kapat?' : 'Partner bağlantısını kes?',
      desc: block
        ? 'Bağlantı kopar ve bu kişi sana bir daha davet kodu ile bağlanamaz. Partnerine yalnızca “bağlantı sona erdi” bildirimi gider.'
        : pending
          ? 'Davet kodun geçersiz olur. İstediğin zaman yeni bir oda açabilirsin.'
          : 'Ortak oyunlar durur ve bu oda kapanır. Sohbet ve anılarınıza artık erişemezsiniz. Partnerine yalnızca “bağlantı sona erdi” bildirimi gider.',
      actions: [
        {
          label: block ? 'Engelle' : pending ? 'Odayı kapat' : 'Bağlantıyı kes',
          kind: 'danger',
          onPress: async () => {
            const { error } = await supabase.rpc('disconnect_partner', { p_block: block });
            if (error) throw error;
            await refreshCouple();
            show(block ? 'Partner engellendi.' : 'Bağlantı sona erdi.', 'info');
          },
        },
        { label: 'Vazgeç', kind: 'ghost' },
      ],
    });

  const wipe = (what: 'chat' | 'memories') => confirmWipe(ask, show, what);

  const deleteAccount = () =>
    ask({
      icon: 'delete_forever',
      tone: 'error',
      title: 'Hesabını sil?',
      desc: 'Profilin, partner bağlantın ve sana ait tüm veriler kalıcı olarak silinir.',
      actions: [
        {
          label: 'Devam et',
          kind: 'danger',
          onPress: () =>
            later(() =>
              ask({
                icon: 'warning',
                tone: 'error',
                title: 'Son kez soruyoruz',
                desc: 'Bu işlem geri alınamaz. Hesabın ve verilerin hemen silinecek.',
                actions: [
                  {
                    label: 'Hesabımı kalıcı olarak sil',
                    kind: 'danger',
                    onPress: async () => {
                      const { error } = await supabase.rpc('delete_my_account');
                      if (error) throw error;
                      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                    },
                  },
                  { label: 'Vazgeç', kind: 'ghost' },
                ],
              }),
            ),
        },
        { label: 'Vazgeç', kind: 'ghost' },
      ],
    });

  const logout = async () => {
    setLeaving(true);
    try {
      await signOut();
    } catch (e) {
      show(errorText(e), 'error');
      setLeaving(false);
    }
  };

  const mail = () => {
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent('Nocta destek')}`;
    Linking.openURL(url).catch(() => show(`E-posta uygulaması açılamadı. Bize ${supportEmail} adresinden yazabilirsin.`, 'info'));
  };

  const anniversary = parseISODate(couple?.anniversary);

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ gap: 20 }}>
      <Header onBack={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} title="Ayarlar" />

      <SettingsGroup
        label="HESAP"
        rows={[
          { icon: 'person', title: 'Profil', value: profile?.display_name, onPress: () => router.push('/edit-profile') },
          { icon: 'key', title: 'Hesap güvenliği', value: session?.user.email ?? undefined, onPress: () => setPwOpen(true) },
          { icon: 'shield', title: 'Gizlilik', onPress: () => router.push('/privacy') },
          { icon: 'workspace_premium', title: 'Abonelik', value: isPremium ? 'Premium' : 'Ücretsiz', onPress: () => router.push('/premium') },
        ]}
      />

      <SettingsGroup
        label="PARTNER"
        rows={[
          connected
            ? { icon: 'favorite', title: 'Bağlı partner', value: partner?.display_name }
            : { icon: 'person_add', title: pending ? 'Davet kodunu göster' : 'Partnerini davet et', value: pending ? couple?.invite_code : undefined, onPress: () => router.push('/invite') },
          !connected && { icon: 'pin', title: 'Kodum var · Katıl', onPress: () => router.push('/join') },
          connected && { icon: 'cake', title: 'Yıldönümü tarihi', value: anniversary ? formatDMY(anniversary) : 'Ekle', onPress: () => setAnnOpen(true) },
          { icon: 'tune', title: 'Seviyemi değiştir', value: levelName(profile?.level), onPress: () => router.push('/level-edit') },
          (connected || pending) && { icon: 'link_off', title: pending ? 'Bekleyen odayı kapat' : 'Bağlantıyı kopar', warn: true, onPress: () => disconnect(false) },
          connected && { icon: 'block', title: 'Partneri engelle', warn: true, onPress: () => disconnect(true) },
        ]}
      />

      <SettingsGroup
        label="VERİ"
        rows={[
          connected && { icon: 'chat', title: 'Sohbeti sil', warn: true, onPress: () => wipe('chat') },
          connected && { icon: 'auto_stories', title: 'Anıları sil', warn: true, onPress: () => wipe('memories') },
          { icon: 'delete_forever', title: 'Hesabı sil', danger: true, onPress: deleteAccount },
        ]}
      />

      <SettingsGroup
        label="DESTEK"
        rows={[
          { icon: 'mail', title: 'Destek e-postası', value: supportEmail, onPress: mail },
          { icon: 'flag', title: 'Sorun bildir', onPress: () => router.push('/report') },
        ]}
      />

      <Button title="Çıkış yap" icon="logout" kind="outline" loading={leaving} onPress={logout} />
      <T v="caption" center color={colors.faint}>{`Nocta · sürüm ${Constants.expoConfig?.version ?? '1.0.0'}`}</T>

      <DatePickerSheet
        visible={annOpen}
        onClose={() => setAnnOpen(false)}
        value={anniversary}
        minYear={year - 60}
        maxYear={year}
        title="Yıldönümünüz"
        confirmLabel="Kaydet"
        onConfirm={(v) => {
          setAnnOpen(false);
          setAnniversary(toISODate(v));
        }}
      />

      <Sheet
        visible={pwOpen}
        onClose={() => setPwOpen(false)}
        label="HESAP GÜVENLİĞİ"
        title="Şifreni değiştir"
        footer={<Button title="Şifreyi güncelle" loading={pwBusy} disabled={!pw || !pw2} onPress={changePassword} />}
      >
        <T v="bodySm">{`Giriş e-postan: ${session?.user.email ?? '—'}`}</T>
        <Field
          label="Yeni şifre"
          placeholder="En az 8 karakter"
          value={pw}
          onChangeText={setPw}
          secureTextEntry={!showPw}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          right={<EyeToggle shown={showPw} onToggle={() => setShowPw((s) => !s)} />}
        />
        <Field
          label="Yeni şifre tekrar"
          placeholder="Şifreni tekrar yaz"
          value={pw2}
          onChangeText={setPw2}
          secureTextEntry={!showPw}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          error={pw2 && pw2 !== pw ? 'Şifreler eşleşmiyor.' : null}
        />
      </Sheet>
      {dialog}
      <View style={{ height: 8 }} />
    </Screen>
  );
}
