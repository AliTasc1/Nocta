import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { AVATAR_COLORS, colors, fonts, MOODS } from '@/theme';
import { Icon } from './ui';

/** Avatar rengi seçimi */
export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
      {AVATAR_COLORS.map((c, i) => {
        const on = c.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={`Renk ${i + 1}`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(c)}
            style={{ width: 44, height: 44, borderRadius: 22, padding: 3, borderWidth: 2, borderColor: on ? colors.rose : 'transparent' }}
          >
            <View style={{ flex: 1, borderRadius: 20, backgroundColor: c, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              {on ? <Icon name="check" size={18} color={colors.pearl} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tasarım: 05a · ruh hâli ızgarası (2 sütun) */
export function MoodGrid({ value, onChange }: { value: string | null; onChange: (key: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {MOODS.map((m) => {
        const on = value === m.key;
        return (
          <Pressable
            key={m.key}
            accessibilityRole="radio"
            accessibilityLabel={`${m.name}: ${m.desc}`}
            accessibilityState={{ selected: on }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(m.key);
            }}
            style={({ pressed }) => ({
              flexBasis: '47%',
              flexGrow: 1,
              minHeight: 108,
              borderRadius: 22,
              padding: 16,
              gap: 14,
              justifyContent: 'space-between',
              backgroundColor: on ? 'rgba(231,104,138,.14)' : colors.velvet,
              borderWidth: 1,
              borderColor: on ? colors.rose : colors.line,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon name={m.icon} size={26} color={on ? colors.blush : colors.mist} />
            <View style={{ gap: 2 }}>
              <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.pearl }}>{m.name}</Text>
              <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.mist }}>{m.desc}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
