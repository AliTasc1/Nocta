import React from 'react';
import { Pressable, View } from 'react-native';

import { colors } from '@/theme';
import { Icon, T } from './ui';

export type SettingsRowProps = {
  icon: string;
  title: string;
  value?: string;
  subtitle?: string;
  danger?: boolean;
  /** İkon kırmızı, yazı normal (tasarım: Disconnect / Block satırları) */
  warn?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
  disabled?: boolean;
};

/** Tasarım 23 · Settings — başlıklı, yuvarlatılmış satır grubu */
export function SettingsGroup({ label, rows, labelColor = colors.mist }: { label: string; rows: (SettingsRowProps | null | false)[]; labelColor?: string }) {
  const list = rows.filter(Boolean) as SettingsRowProps[];
  return (
    <View style={{ gap: 8 }}>
      <T v="label" color={labelColor} style={{ fontSize: 10.5, paddingLeft: 4 }}>{label}</T>
      <View style={{ borderRadius: 20, backgroundColor: colors.velvet, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        {list.map((r, i) => (
          <Pressable
            key={r.title}
            accessibilityRole={r.onPress ? 'button' : undefined}
            accessibilityLabel={r.value ? `${r.title}: ${r.value}` : r.title}
            disabled={!r.onPress || r.disabled}
            onPress={r.onPress}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 54,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: 'rgba(255,230,240,.05)',
              backgroundColor: pressed ? 'rgba(255,255,255,.03)' : 'transparent',
              opacity: r.disabled ? 0.5 : 1,
            })}
          >
            <Icon name={r.icon} size={21} color={r.danger || r.warn ? colors.error : colors.mist} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="title" style={{ fontSize: 14.5, lineHeight: 20, fontWeight: '600' }} color={r.danger ? colors.error : colors.pearl}>{r.title}</T>
              {r.subtitle ? <T v="caption" color={colors.mute}>{r.subtitle}</T> : null}
            </View>
            {r.value ? <T v="bodySm" numberOfLines={1} style={{ fontSize: 12.5, maxWidth: '42%' }}>{r.value}</T> : null}
            {r.right ?? (r.onPress ? <Icon name="chevron_right" size={20} color={colors.faint} /> : null)}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
