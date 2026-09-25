import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/providers/AppProvider';
import { colors, fonts } from '@/theme';

const ITEMS: Record<string, { label: string; on: string; off: string }> = {
  index: { label: 'Ana Sayfa', on: 'home', off: 'home-outline' },
  games: { label: 'Oyunlar', on: 'cards-playing', off: 'cards-playing-outline' },
  chat: { label: 'Sohbet', on: 'chat', off: 'chat-outline' },
  memories: { label: 'Anılar', on: 'book-open-page-variant', off: 'book-open-page-variant-outline' },
  profile: { label: 'Profil', on: 'account', off: 'account-outline' },
};

/** Klavye açık mı (Android'de sekme çubuğu klavyenin üstüne çıkmasın diye) */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/** BottomNav.dc.html — bulanık zemin, 5 sekme, aktif #F4B9C8 + dolu ikon, sohbet rozeti */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { unreadMessages } = useApp();
  const keyboard = useKeyboardVisible();
  if (keyboard && Platform.OS !== 'ios') return null;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: Platform.OS === 'android' ? 'rgba(12,8,11,.97)' : 'rgba(12,8,11,.86)' }}>
      {Platform.OS !== 'android' ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 10) }}
      >
        {state.routes.map((route, index) => {
          const item = ITEMS[route.name];
          if (!item) return null;
          const focused = state.index === index;
          const color = focused ? colors.blush : colors.mute;
          const badge = route.name === 'chat' && unreadMessages > 0 ? unreadMessages : 0;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${item.label}, ${badge} okunmamış mesaj` : item.label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3, opacity: pressed ? 0.7 : 1 })}
            >
              <View>
                <MaterialCommunityIcons name={(focused ? item.on : item.off) as any} size={24} color={color} />
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={{ fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.2, color }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -12,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.rose,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 10, color: colors.onRose },
});
