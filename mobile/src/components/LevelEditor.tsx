import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useApp } from '@/providers/AppProvider';
import { useContent } from '@/providers/ContentProvider';
import { colors } from '@/theme';
import { AgreedBanner, effectiveLevel, levelName, PersonLevelCard } from './LevelPicker';
import { Icon, T } from './ui';

/**
 * Tasarım 05b — "çift onayı": her partner kendi seviyesini seçer, oyun ikisinin en düşüğünde oynanır.
 * Partner bağlıysa onun seçimi gerçek zamanlı görünür (profil realtime → AppProvider).
 */
export function LevelEditor({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { profile, partner, isPremium } = useApp();
  const { settings } = useContent();
  const freeMax = Number(settings.free_max_level ?? 1);
  const agreed = effectiveLevel(value, partner ? partner.level : null, isPremium, freeMax);
  const cappedByPlan = !isPremium && Math.min(value, partner?.level ?? 3) > freeMax;

  return (
    <View style={{ gap: 12 }}>
      <PersonLevelCard
        name={profile?.display_name || 'Sen'}
        color={profile?.avatar_color}
        value={value}
        status="Sen"
        statusColor={colors.mist}
        onChange={onChange}
        lockedFrom={isPremium ? undefined : freeMax + 1}
      />
      {partner ? (
        <PersonLevelCard
          name={partner.display_name}
          color={partner.avatar_color}
          value={partner.level}
          status="Seçti ✓"
          statusColor={colors.success}
          readOnly
        />
      ) : (
        <View style={{ padding: 16, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,230,240,.2)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,230,240,.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="person_add" size={18} color={colors.mist} />
          </View>
          <T v="bodySm" style={{ flex: 1 }}>Partnerin bağlandığında o da kendi seviyesini seçecek.</T>
        </View>
      )}
      <AgreedBanner level={agreed} note={partner ? undefined : 'partnerin katılınca kesinleşir'} />
      <T v="caption" color={colors.mute} style={{ lineHeight: 18 }}>
        Her biriniz ayrı seçer. Oyunlar ikinizin seçtiği en düşük seviyede ({levelName(agreed)}) oynanır; kimse istemediği bir seviyeye zorlanmaz.
      </T>
      {cappedByPlan ? (
        <Pressable accessibilityRole="button" disabled={!profile?.onboarded} onPress={() => router.push('/premium')} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: colors.irisTint, borderWidth: 1, borderColor: 'rgba(168,139,240,.3)' }}>
          <Icon name="workspace_premium" size={20} color={colors.irisSoft} />
          <T v="bodySm" style={{ flex: 1 }} color={colors.pearlSoft}>
            Ücretsiz sürümde en fazla {levelName(freeMax)} seviyesinde oynanır. Cesur ve Vahşi için Premium’a göz at.
          </T>
          {profile?.onboarded ? <Icon name="chevron_right" size={20} color={colors.mist} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

