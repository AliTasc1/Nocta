import { AppState, Platform } from 'react-native';

/**
 * Bildirim altyapısı (yerel + uzak).
 *
 * Neden yerel bildirim?
 *  - Android Expo Go, SDK 53'ten beri UZAK (push) bildirim alamaz.
 *  - Uzak bildirim için EAS projectId gerekir (henüz `eas init` yapılmadı).
 *  - YEREL bildirimler (scheduleNotificationAsync, trigger: null/anında) ise Expo Go'da
 *    hem Android'de hem iOS'ta sesli çalışır.
 * Bu yüzden partner bir oyun başlattığında ya da mesaj gönderdiğinde Supabase Realtime
 * olayını yakalayıp anında sesli bir YEREL bildirim gösteriyoruz (bkz. usePartnerAlerts).
 *
 * Sınır: Realtime yalnızca uygulama süreci canlıyken (ön planda ya da arka plana yeni
 * alınmışken) çalışır. Uygulama TAMAMEN kapalıyken "çağrı" alabilmek için uzak push
 * gerekir: `eas init` ile app.json'a projectId eklenmeli ve geliştirme/mağaza derlemesi
 * kullanılmalı (iOS Expo Go'da projectId eklendiği anda push da çalışır).
 */

type NotificationsModule = typeof import('expo-notifications');

export const ANDROID_CHANNEL_ID = 'default';

let modPromise: Promise<NotificationsModule | null> | null = null;
/** expo-notifications'ı tembel yükler (web'de ve hata durumunda null) */
export function getNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return Promise.resolve(null);
  if (!modPromise) modPromise = import('expo-notifications').then((m) => m as NotificationsModule).catch(() => null);
  return modPromise;
}

/**
 * Realtime bağlıyken ön plandaki UZAK bildirimleri gizleriz; aynı olay için yerel
 * bildirim zaten gösterilir (çift bildirim olmasın). Realtime kopuksa uzak olan gösterilir.
 */
let realtimeLive = false;
export function setRealtimeLive(v: boolean) {
  realtimeLive = v;
}

let setupPromise: Promise<void> | null = null;
/** Ön plan davranışı + Android kanalı. Birden çok kez çağrılabilir. */
export function setupNotifications(): Promise<void> {
  if (!setupPromise) {
    setupPromise = (async () => {
      const N = await getNotifications();
      if (!N) return;
      try {
        N.setNotificationHandler({
          handleNotification: async (n) => {
            const data = (n.request.content.data ?? {}) as Record<string, unknown>;
            const isLocal = data.local === true;
            const isDuplicateRemote =
              !isLocal && typeof data.kind === 'string' && realtimeLive && AppState.currentState === 'active';
            if (isDuplicateRemote) {
              return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
            }
            return {
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
              priority: N.AndroidNotificationPriority.MAX,
            };
          },
        });
        if (Platform.OS === 'android') {
          // Not: Android, var olan bir kanalın önem düzeyini sonradan yükseltmez; yeni kurulumlarda MAX olur.
          await N.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
            name: 'Partner bildirimleri',
            description: 'Partnerin seni oyuna çağırdığında ya da mesaj gönderdiğinde',
            importance: N.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 400, 250, 400],
            enableVibrate: true,
            lightColor: '#E7688A',
            lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
          });
        }
      } catch {
        // bildirim altyapısı uygulamayı asla bozmasın
      }
    })();
  }
  return setupPromise;
}

let permissionGranted: boolean | null = null;
/** Bildirim iznini kontrol eder, gerekirse bir kez ister. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const N = await getNotifications();
  if (!N) return false;
  try {
    await setupNotifications();
    const current = await N.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return (permissionGranted = true);
    if (!current.canAskAgain) return (permissionGranted = false);
    const asked = await N.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });
    permissionGranted = asked.granted || asked.status === 'granted';
    return permissionGranted;
  } catch {
    return (permissionGranted = false);
  }
}

export type LocalAlert = {
  title: string;
  body: string;
  /** data.route → dokununca gidilecek ekran */
  route?: string | null;
  kind?: string;
  /** kaynak satırın id'si (tekrarları önlemek için) */
  sourceId?: string;
};

/**
 * Anında sesli yerel bildirim gösterir. İzin yoksa ya da desteklenmiyorsa `false` döner
 * (çağıran uygulama içi bir bildirim gösterebilir).
 */
export async function presentLocalAlert(a: LocalAlert): Promise<boolean> {
  const N = await getNotifications();
  if (!N) return false;
  try {
    await setupNotifications();
    if (permissionGranted === null) {
      const p = await N.getPermissionsAsync();
      permissionGranted = p.granted || p.status === 'granted';
    }
    if (!permissionGranted) return false;
    await N.scheduleNotificationAsync({
      identifier: a.sourceId ? `nocta-${a.sourceId}` : undefined,
      content: {
        title: a.title,
        body: a.body,
        sound: 'default',
        priority: N.AndroidNotificationPriority.MAX,
        data: { route: a.route ?? null, kind: a.kind ?? null, sourceId: a.sourceId ?? null, local: true },
      },
      trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null,
    });
    return true;
  } catch {
    return false;
  }
}
