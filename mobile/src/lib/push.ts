import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Push izni ister ve Expo push token'ını profile kaydeder.
 * Not: Android'de Expo Go uzaktan bildirim desteklemez (SDK 53+). iOS Expo Go'da ve
 * geliştirme/mağaza derlemelerinde çalışır. Token için EAS projectId gerekir (eas init).
 * Hiçbir durumda uygulamayı bozmaz; başarısız olursa sessizce vazgeçer.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice || Platform.OS === 'web') return null;
    const isExpoGoAndroid = Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
    if (isExpoGoAndroid) return null;
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Nocta',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#E7688A',
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId);
    return token;
  } catch {
    return null;
  }
}

/** Bildirime dokunulunca ilgili ekrana git */
export async function listenNotificationTaps(onRoute: (route: string) => void): Promise<() => void> {
  try {
    if (Platform.OS === 'web') return () => {};
    const Notifications = await import('expo-notifications');
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const route = (r.notification.request.content.data as any)?.route;
      if (typeof route === 'string') onRoute(route);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
