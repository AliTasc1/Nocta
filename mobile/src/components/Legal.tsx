import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';
import { Sheet } from './Sheet';
import { Icon, T } from './ui';

/** Tasarım: 02 · 18+ doğrulama onay kutusu */
export function CheckRow({ checked, onChange, children, label }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; label: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onChange(!checked);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        minHeight: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,.04)',
        borderWidth: 1,
        borderColor: checked ? 'rgba(231,104,138,.45)' : colors.lineStrong,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? colors.rose : 'transparent',
          borderWidth: 1.5,
          borderColor: checked ? colors.rose : 'rgba(255,230,240,.3)',
        }}
      >
        {checked ? <Icon name="check" size={18} color={colors.onRose} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

const TERMS = [
  'Nocta yalnızca 18 yaşını doldurmuş yetişkinler içindir. Yaşın hakkında yanlış beyanda bulunman hesabının kapatılmasına yol açar.',
  'Oyunlar karşılıklı rıza üzerine kuruludur. Her görev ve soru atlanabilir; atlamanın hiçbir cezası yoktur.',
  'Partnerini rahatsız eden, taciz içeren ya da yasa dışı içerik paylaşmak yasaktır. Bu tür içerikleri uygulama içinden bildirebilirsin.',
  'Bir hesap aynı anda yalnızca bir partnere bağlanabilir. Bağlantıyı istediğin an Ayarlar üzerinden koparabilirsin.',
  'Premium abonelik iki partneri birlikte kapsar ve mağaza hesabın üzerinden istediğin an iptal edilebilir.',
];

const PRIVACY = [
  'Mesajların, fotoğrafların ve oyun cevapların yalnızca sen ve bağlı partnerin tarafından görülebilir.',
  'Sohbet fotoğrafları özel bir depoda saklanır ve yalnızca kısa süreli, imzalı bağlantılarla gösterilir.',
  'Kaybolan mesajlar açıkken mesajlar 24 saat sonra silinir.',
  'Sohbetini, anılarını ya da hesabının tamamını Ayarlar → Veri bölümünden istediğin an silebilirsin.',
  'Bildirim önizlemeleri varsayılan olarak gizlidir; kilit ekranında mesaj içeriği görünmez.',
];

export function LegalLinks() {
  const [open, setOpen] = useState<'terms' | 'privacy' | null>(null);
  const items = open === 'terms' ? TERMS : PRIVACY;
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 24 }}>
        <Pressable accessibilityRole="link" onPress={() => setOpen('privacy')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.blush }}>Gizlilik</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => setOpen('terms')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.blush }}>Kullanım Koşulları</Text>
        </Pressable>
      </View>
      <Sheet visible={!!open} onClose={() => setOpen(null)} label="NOCTA" title={open === 'terms' ? 'Kullanım Koşulları' : 'Gizlilik'}>
        {items.map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <T v="label" style={{ marginTop: 3 }}>{String(i + 1).padStart(2, '0')}</T>
            <T v="body" style={{ flex: 1, fontSize: 14, lineHeight: 21 }}>{t}</T>
          </View>
        ))}
      </Sheet>
    </>
  );
}
