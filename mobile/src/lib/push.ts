import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { ensureNotificationPermission, getNotifications, setupNotifications } from './alerts';
import { supabase } from './supabase';

/**
 * Bildirim iznini ister, Android kanalını ve ön plan davranışını kurar; mümkünse
 * Expo push token'ını profile kaydeder.
 *
 * İzin + kanal kurulumu HER ZAMAN yapılır (yerel "partner çağrısı" bildirimleri için
 * gerekli). Yalnızca uzak token kısmı şu durumlarda atlanır:
 *  - Android Expo Go (SDK 53+ uzak bildirim desteklemez),
 *  - simülatör / web,
 *  - EAS projectId yok (`eas init` yapılmadı).
 * Hiçbir durumda uygulamayı bozmaz; başarısız olursa sessizce vazgeçer.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    await setupNotifications();
    const granted = await ensureNotificationPermission();
    if (!granted) return null;

    const isExpoGoAndroid = Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
    if (!Device.isDevice || isExpoGoAndroid) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return null;

    // Tam paket yalnızca burada (Expo Go Android değilken) yüklenir
    const Notifications = await import('expo-notifications');
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId);
    return token;
  } catch {
    return null;
  }
}

function routeOf(data: unknown): string | null {
  const r = (data as { route?: unknown } | null | undefined)?.route;
  return typeof r === 'string' && r.startsWith('/') ? r : null;
}

const handled = new Set<string>();
function keyOf(r: { notification: { request: { identifier: string }; date: number }; actionIdentifier: string }) {
  return `${r.notification.request.identifier}:${r.notification.date}:${r.actionIdentifier}`;
}

/**
 * Bildirime (yerel ya da uzak) dokunulunca ilgili ekrana git.
 * Uygulama çalışırken gelen dokunuşları dinler.
 */
export async function listenNotificationTaps(onRoute: (route: string) => void): Promise<() => void> {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return () => {};
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const k = keyOf(r);
      if (handled.has(k)) return;
      handled.add(k);
      const route = routeOf(r.notification.request.content.data);
      if (route) onRoute(route);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/**
 * Uygulama bir bildirime dokunularak (soğuk başlangıç) açıldıysa o bildirimin rotasını
 * bir kez döndürür. Yönlendirme korumaları (oturum/onboarding) bittikten sonra çağrılmalı.
 */
export async function consumeLaunchNotificationRoute(): Promise<string | null> {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return null;
    const r = Notifications.getLastNotificationResponse();
    if (!r) return null;
    const k = keyOf(r);
    if (handled.has(k)) return null;
    handled.add(k);
    Notifications.clearLastNotificationResponse();
    return routeOf(r.notification.request.content.data);
  } catch {
    return null;
  }
}
