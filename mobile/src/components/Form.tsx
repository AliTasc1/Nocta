import React from 'react';
import { Pressable } from 'react-native';

import { colors } from '@/theme';
import { Icon } from './ui';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Şifre alanı için göster / gizle düğmesi (44×44 dokunma alanı) */
export function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Şifreyi gizle' : 'Şifreyi göster'}
      hitSlop={6}
      onPress={onToggle}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 }}
    >
      <Icon name={shown ? 'visibility_off' : 'visibility'} size={21} color={colors.mist} />
    </Pressable>
  );
}
