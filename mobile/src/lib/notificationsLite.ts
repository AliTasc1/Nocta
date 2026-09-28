/**
 * expo-notifications'ın yalnızca YEREL bildirim için gereken parçaları.
 *
 * Paketin ana girişi (index) yüklenirken DevicePushTokenAutoRegistration.fx çalışır ve
 * Android Expo Go'da (SDK 53+) "remote notifications removed" hatasını FIRLATIR — biz hiç
 * push kullanmasak bile. Bu yüzden izin, kanal, işleyici, zamanlama ve dokunma dinleyicisini
 * doğrudan alt modüllerden alıyoruz; bunlar o yan etkiyi tetiklemez.
 * Push token gerektiğinde (Expo Go dışında) tam paket ayrıca yüklenir (bkz. push.ts).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
type Full = typeof import('expo-notifications');

export type NotificationsLite = Pick<
  Full,
  | 'setNotificationHandler'
  | 'setNotificationChannelAsync'
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'scheduleNotificationAsync'
  | 'addNotificationResponseReceivedListener'
  | 'getLastNotificationResponse'
  | 'clearLastNotificationResponse'
  | 'AndroidImportance'
  | 'AndroidNotificationVisibility'
  | 'AndroidNotificationPriority'
>;

export function loadNotificationsLite(): NotificationsLite {
  const emitter = require('expo-notifications/build/NotificationsEmitter');
  const handler = require('expo-notifications/build/NotificationsHandler');
  const perms = require('expo-notifications/build/NotificationPermissions');
  const schedule = require('expo-notifications/build/scheduleNotificationAsync');
  const channel = require('expo-notifications/build/setNotificationChannelAsync');
  const channelTypes = require('expo-notifications/build/NotificationChannelManager.types');
  const types = require('expo-notifications/build/Notifications.types');
  return {
    setNotificationHandler: handler.setNotificationHandler,
    setNotificationChannelAsync: channel.setNotificationChannelAsync,
    getPermissionsAsync: perms.getPermissionsAsync,
    requestPermissionsAsync: perms.requestPermissionsAsync,
    scheduleNotificationAsync: schedule.scheduleNotificationAsync,
    addNotificationResponseReceivedListener: emitter.addNotificationResponseReceivedListener,
    getLastNotificationResponse: emitter.getLastNotificationResponse,
    clearLastNotificationResponse: emitter.clearLastNotificationResponse,
    AndroidImportance: channelTypes.AndroidImportance,
    AndroidNotificationVisibility: channelTypes.AndroidNotificationVisibility,
    AndroidNotificationPriority: types.AndroidNotificationPriority,
  };
}
