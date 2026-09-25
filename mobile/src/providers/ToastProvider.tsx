import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui';
import { colors, fonts, radius } from '@/theme';

type Tone = 'ok' | 'error' | 'info';
type ToastCtx = { show: (text: string, tone?: Tone) => void };
const Ctx = createContext<ToastCtx>({ show: () => {} });

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback(
    (text: string, tone: Tone = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ text, tone });
      if (tone === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (tone === 'ok') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(hide, 3200);
    },
    [anim, hide],
  );

  const ctx = useMemo(() => ({ show }), [show]);
  const icon = toast?.tone === 'ok' ? 'check_circle' : toast?.tone === 'error' ? 'error' : 'info';
  const color = toast?.tone === 'ok' ? colors.success : toast?.tone === 'error' ? colors.error : colors.blush;

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: insets.top + 8,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          }}
        >
          <Pressable
            onPress={hide}
            accessibilityRole="alert"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              paddingHorizontal: 16,
              borderRadius: radius.md,
              backgroundColor: 'rgba(33,23,32,.97)',
              borderWidth: 1,
              borderColor: colors.lineStrong,
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <Icon name={icon} size={22} color={color} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.pearl }}>{toast.text}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}
