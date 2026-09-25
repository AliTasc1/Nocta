import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFonts } from 'expo-font';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '@/components/AppLockGate';
import { Loading } from '@/components/ui';
import { listenNotificationTaps, registerForPush } from '@/lib/push';
import { AppProvider, useApp } from '@/providers/AppProvider';
import { ContentProvider } from '@/providers/ContentProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(colors.ink).catch(() => {});

/**
 * Yönlendirme kuralları
 *  - Oturum yok               → (auth)
 *  - Hesap askıda             → /suspended
 *  - Profil tamamlanmamış     → (onboarding)
 *  - Diğer                    → uygulama (tabs ve diğer ekranlar)
 */
function Guard() {
  const { ready, session, profile, userId } = useApp();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === '(onboarding)';
    if (!session) {
      if (!inAuth) router.replace('/welcome');
      return;
    }
    if (!profile) return;
    if (profile.status === 'suspended') {
      if (group !== 'suspended') router.replace('/suspended');
      return;
    }
    if (!profile.onboarded) {
      if (!inOnboarding) router.replace('/profile-setup');
      return;
    }
    if (inAuth || group === 'suspended') router.replace('/');
  }, [ready, session, profile, segments]);

  useEffect(() => {
    if (userId) registerForPush(userId);
  }, [userId]);

  useEffect(() => {
    let off: (() => void) | undefined;
    listenNotificationTaps((route) => router.push(route as any)).then((f) => (off = f));
    return () => off?.();
  }, []);

  return null;
}

function Root() {
  const { ready, session, profile } = useApp();
  const booting = !ready || (session && !profile);
  useEffect(() => {
    if (!booting) SplashScreen.hideAsync().catch(() => {});
  }, [booting]);

  return (
    <>
      <Guard />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ink },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
      </Stack>
      {booting ? (
        <View style={StyleSheet.absoluteFill}>
          {/* Açılışta ekran boş kalmasın */}
          <Loading />
        </View>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppProvider>
          <ContentProvider>
            <ToastProvider>
              <AppLockGate>
                <Root />
              </AppLockGate>
            </ToastProvider>
          </ContentProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
