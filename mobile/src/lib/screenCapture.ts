/**
 * Ekran görüntüsü / ekran kaydı koruması (expo-screen-capture, Expo Go'da mevcut).
 *
 * Platform notları:
 * - Android: FLAG_SECURE. Ekran görüntüsü ve kayıt tamamen engellenir (sistem "alınamadı" der ya da
 *   görüntü siyah çıkar). Engellenen denemelerde dinleyici çoğu zaman TETİKLENMEZ — koruma, engelin kendisidir.
 *   RN <Modal> kendi penceresini açar; FLAG_SECURE yalnızca modal GÖSTERİLİRKEN etkinse kopyalanır.
 *   Bu yüzden medya görüntüleyiciler açılmadan önce `guardScreenCapture` beklenir.
 * - iOS: Ekran görüntüsü teknik olarak ENGELLENEMEZ; kütüphane pencereyi "secure text field" katmanına
 *   taşır, böylece görüntü/kayıt içeriği boş (siyah) çıkar ve UIScreen.isCaptured iken siyah perde eklenir.
 *   Kullanıcı yine de tuşlara basabildiği için `addScreenshotListener` ile algılayıp partneri bilgilendiriyoruz.
 *   Bu katman taşıma işlemi iç içe çağrılara dayanıklı değildir (iki kez prevent → allow pencereyi geri
 *   tam taşıyamaz). Bu nedenle tek bir anahtar ve kendi sayaç (ref-count) mekanizmamızı kullanıyoruz.
 * - Web: modül yok; tüm çağrılar sessizce hiçbir şey yapmaz.
 */
import { Platform } from 'react-native';

type SC = typeof import('expo-screen-capture');

const KEY = 'nocta-private';
let holders = 0;
let mod: Promise<SC | null> | null = null;

function load(): Promise<SC | null> {
  if (Platform.OS === 'web') return Promise.resolve(null);
  if (!mod) mod = import('expo-screen-capture').then((m) => m, () => null);
  return mod;
}

/** Korumayı açar; dönen fonksiyon korumayı bırakır. Birden çok ekran aynı anda tutabilir. */
export async function guardScreenCapture(): Promise<() => void> {
  holders += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0)
      load().then((SC) => {
        if (holders === 0) SC?.allowScreenCaptureAsync(KEY).catch(() => {});
      });
  };
  const SC = await load();
  // Aynı anahtarla tekrar çağrı yerelde hiçbir şey yapmaz (idempotent)
  if (SC && holders > 0) {
    await SC.preventScreenCaptureAsync(KEY).catch(() => {});
    // Biz beklerken herkes bıraktıysa korumayı geri kaldır
    if (holders === 0) SC.allowScreenCaptureAsync(KEY).catch(() => {});
  }
  return release;
}

/** Ekran görüntüsü dinleyicisi. iOS'ta her zaman çalışır; Android 14+ yerel geri çağrı, daha eskilerde medya izni gerekir. */
export async function onScreenshot(cb: () => void): Promise<() => void> {
  const SC = await load();
  if (!SC) return () => {};
  try {
    const sub = SC.addScreenshotListener(cb);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
