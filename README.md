# Nocta

Çiftler için 18+ oyun uygulaması. Bu depo üç parçadan oluşur:

| Klasör | İçerik |
|---|---|
| `mobile/` | Android + iOS uygulaması (Expo SDK 57, expo-router, TypeScript) |
| `admin/` | Web tabanlı yönetim paneli (Vite + React + TypeScript) |
| `supabase/` | Veritabanı şeması (migrations), başlangıç içeriği (seed), RevenueCat webhook fonksiyonu |
| `design/` | Claude Design'dan gelen orijinal tasarım dosyaları (referans) |

Arka uç: Supabase projesi **ayla** (`eeytvrfsxfxxpyqdoqls`, eu-central-1). Şema, içerik ve fonksiyonlar bu projeye **kurulu durumda**.

---

## 1. Uygulamayı Expo Go ile test etme (iki telefon)

Bilgisayarda (Node 20+):

```bash
cd mobile
npm install
npx expo start --tunnel     # telefonlar farklı ağlardaysa --tunnel, aynı Wi-Fi'daysa sadece: npx expo start
```

1. İki telefona da **Expo Go** uygulamasını (App Store / Google Play) kurun.
2. Terminalde çıkan QR kodu okutun (iPhone: Kamera uygulaması, Android: Expo Go içinden).
3. Birinci telefon: kayıt ol → profil → ruh hâli → seviye → **davet kodu** görünür.
4. İkinci telefon: kayıt ol → … → davet ekranında **"Kodum var · Katıl"** → kodu gir (ya da QR'ı uygulama içi tarayıcıyla okut).
5. "Bağlandınız" ekranı iki telefonda da açılır. Bir oyun seçin → lobi → ikiniz de **Hazırım** → 3-2-1 → oyun.

> ⚠️ **E-posta doğrulaması:** Supabase varsayılan olarak kayıttan sonra doğrulama e-postası gönderir ve ücretsiz planda saatte yalnızca birkaç e-posta atabilir. Test sırasında takılmamak için:
> Supabase Panel → **Authentication → Sign In / Providers → Email → "Confirm email"** seçeneğini kapatın. (Yayından önce tekrar açıp kendi SMTP sunucunuzu tanımlamanızı öneririm: Authentication → Emails → SMTP Settings.)

> ℹ️ **Push bildirimleri:** Android'de Expo Go uzaktan bildirim desteklemez (Expo SDK 53+ kısıtı). Uygulama içi bildirim listesi ve gerçek zamanlı güncellemeler Expo Go'da da çalışır. Push için `mobile/` içinde bir kez `npx eas-cli@latest init` çalıştırın (EAS projectId oluşturur); geliştirme/mağaza derlemelerinde push otomatik çalışır.

> ℹ️ `nocta://join/KOD` bağlantıları Expo Go'da açılmaz (Expo Go kendi `exp://` şemasını kullanır). Testte kodu elle girin ya da uygulama içi QR tarayıcıyı kullanın. Mağaza derlemesinde bağlantılar çalışır.

---

## 2. Yönetim paneli

```bash
cd admin
npm install
npm run build        # çıktı: admin/dist/
```

`dist/` klasörünü sunucunuza yükleyin. Nginx / Apache örnek ayarları `admin/deploy/` içinde (tek sayfa uygulaması için tüm yollar `index.html`'e yönlenmeli). Ayrıntılar: `admin/README.md`.

**İlk yönetici hesabı:** Panelde **"Hesap oluştur"** ile `alitasci8@gmail.com` adresiyle kayıt olun, sonra giriş yapın. Yönetici tablosu boşken bu adres otomatik olarak **sahip (owner)** olur. Diğer yöneticileri Ayarlar → Yöneticiler bölümünden eklersiniz (önce o kişinin bir hesabı olmalı).

**Panelde yapabilecekleriniz:** genel bakış ve analitik, kullanıcı askıya alma/silme, çiftler (premium verme/kaldırma, bağlantı sonlandırma), oyunlar, **sınırsız kategori**, **sınırsız soru** (tek tek veya toplu içe aktarma, CSV dışa aktarma), görevler, dallanan hikâye editörü, raporlar, abonelikler, ödemeler, uygulama ayarları (ücretsiz seviye sınırı, fiyatlar, duyuru bandı, destek e-postası).

**İçerik güncellemeleri mağaza güncellemesi gerektirmez:** Panelde bir kategori/soru eklediğiniz, değiştirdiğiniz veya kapattığınız anda veritabanındaki `content_version` değişir; uygulama bunu gerçek zamanlı algılayıp yeni içeriği indirir ve cihazda saklar (çevrimdışıyken önbellekten çalışır).

**Premium testi:** RevenueCat bağlanana kadar panelde Çiftler → ilgili çift → **Premium ver** ile istediğiniz gün sayısı kadar premium açabilirsiniz (Cesur/Vahşi seviyeler, premium kategoriler, premium hikâye).

---

## 3. Veritabanı (Supabase)

- `supabase/migrations/` — sırasıyla uygulanmış SQL dosyaları (tablolar, satır düzeyi güvenlik, oyun/eşleşme/sohbet fonksiyonları, yönetici fonksiyonları, realtime, depolama, zamanlanmış temizlik).
- `supabase/seed/seed.sql` — başlangıç içeriği: 8 oyun, 23 kategori, 357 soru, 2 dallanan hikâye, 10 rozet. `gen_seed.py` ile yeniden üretilebilir, `check_seed.py` ile doğrulanır.
- Yeni bir Supabase projesine kurmak için: migration dosyalarını sırayla, ardından `seed.sql`'i SQL Editor'de çalıştırın.

Güvenlik özeti: her tabloda RLS açık; kullanıcılar yalnızca kendi ve partnerlerinin verisini görür; oyunlarda partnerin cevabı ancak siz de cevapladıktan sonra görünür; 18 yaş altı doğum tarihi veritabanında reddedilir; mesajları yalnızca gönderen düzenleyebilir; bağlantı koptuğunda eski sohbet/anılar erişilemez olur.

---

## 4. RevenueCat (sonraki aşama)

Hazır olanlar:
- `supabase/functions/revenuecat-webhook` — **yayında** (`https://eeytvrfsxfxxpyqdoqls.supabase.co/functions/v1/revenuecat-webhook`). Satın alma/yenileme/iptal olaylarını `subscriptions` ve `payments` tablolarına yazar; abonelik çiftin ikisini birden kapsar.
- `mobile/src/lib/purchases.ts` — `getOfferings`, `purchase`, `restore` yer tutucuları; Premium ekranı bunları kullanıyor.

Yapılacaklar:
1. `cd mobile && npx expo install react-native-purchases` (Expo Go'da çalışmaz; geliştirme derlemesi gerekir: `npx eas-cli@latest build --profile development`).
2. `purchases.ts` içindeki TODO'ları doldurun; girişten sonra `Purchases.logIn(<supabase kullanıcı id>)` çağırın.
3. Supabase → Edge Functions → Secrets: `REVENUECAT_WEBHOOK_SECRET` = uzun rastgele bir değer.
4. RevenueCat → Integrations → Webhooks: yukarıdaki URL, Authorization: `Bearer <aynı değer>`.
5. Ürün kimliklerinde `monthly`/`aylik` ya da `yearly`/`annual`/`yillik` geçsin (plan eşlemesi buna göre yapılır).

---

## 5. Mağazalara yayın

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init                  # projectId (push için de gerekli)
npx eas-cli@latest build --platform all  # Android .aab + iOS .ipa
npx eas-cli@latest submit --platform all
```

Paket kimlikleri `mobile/app.json` içinde: `app.nocta.android` / `app.nocta.ios` — kendi alan adınıza göre değiştirebilirsiniz (ilk yayından sonra değiştirilemez). Uygulama simgesi ve açılış görseli şu an Expo şablonununkiler; `mobile/assets/images/` içindeki dosyaları Nocta görselleriyle değiştirin. Mağaza incelemesi için 18+ yaş sınırı, gizlilik politikası ve kullanım koşulları bağlantıları gerekecek.

---

## Bilinen sınırlamalar

- Sohbet **uçtan uca şifreli değildir** (veriler Supabase'de TLS ve erişim kurallarıyla korunur). Uygulama metinlerinde bu iddia kullanılmadı.
- Sesli mesaj, GIF, Apple/Google ile giriş ve "uygulama simgesini gizle" henüz yok.
- Sohbet silindiğinde fotoğraf dosyaları depolamada kalır (mesaj kayıtları silinir, dosyalara erişim kalmaz).
- Tasarımdaki görsel alanlar (hero, hikâye sahneleri) şimdilik renkli yer tutucular; hikâye sahneleri admin panelinde `art_note` alanıyla tarif ediliyor.
- Oyunlar iki telefonda gerçek zamanlı test edilmedi; arka uç akışları SQL üzerinden uçtan uca doğrulandı, iOS ve Android paketleri hatasız derleniyor.
