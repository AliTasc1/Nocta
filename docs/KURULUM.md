# Kurulum ve Geliştirme Rehberi

Bu rehber projeyi sıfırdan kendi Supabase hesabınızla çalıştırmak için gereken adımları anlatır.
Projeye özel anahtar, adres ve kişisel bilgi içermez; bu değerler yalnızca yerel `.env` dosyalarında tutulur.

## Gereksinimler

- Node.js 20 veya üzeri
- Bir Supabase projesi
- Test için telefonda **Expo Go** (App Store / Google Play)

## 1. Veritabanı (Supabase)

1. Supabase panelinde **SQL Editor**'ü açın.
2. `supabase/migrations/` klasöründeki dosyaları **ada göre sırayla** çalıştırın.
3. Başlangıç içeriği için `supabase/seed/` klasöründeki dosyaları çalıştırın:
   `seed.sql` → `seed_quiz.sql` → `seed_emoji_cards.sql`
4. `app_settings` tablosunda `owner_email` değerini kendi yönetici e-postanızla güncelleyin:
   ```sql
   update app_settings set value = '"sizin@eposta.com"' where key = 'owner_email';
   ```
5. **Edge Functions**: `supabase/functions/` altındaki `view-once` ve `revenuecat-webhook` fonksiyonlarını yayınlayın.
6. **Authentication → Sign In / Providers → Email**: e-posta girişini açık tutun. Test sırasında "Confirm email" seçeneğini kapatabilirsiniz (yayında kendi SMTP ayarınızla tekrar açmanız önerilir).

## 2. Ortam değişkenleri

Bağlantı bilgileri git'e eklenmez. Örnek dosyaları kopyalayıp kendi değerlerinizi yazın
(Supabase → Project Settings → API → *Project URL* ve *publishable/anon key*):

```bash
cp mobile/.env.example mobile/.env
cp admin/.env.example admin/.env
```

> Yalnızca **publishable/anon** anahtar kullanılır. `service_role` anahtarını asla istemci koduna veya bu dosyalara yazmayın.

## 3. Mobil uygulama

```bash
cd mobile
npm install
npx expo start            # aynı Wi-Fi ağında
npx expo start --tunnel   # farklı ağlardaki cihazlar için
```

Terminaldeki QR kodu Expo Go ile okutun. Tünel linki (`exp://…`) başka bir cihaza gönderilerek de açılabilir.

**Expo Go sınırlamaları**

- Android'de Expo Go uzak (push) bildirim desteklemez; uygulama açıkken yerel bildirimler çalışır.
- Uygulama kapalıyken push için `npx eas-cli@latest init` ile EAS proje kimliği oluşturup geliştirme/mağaza derlemesi alın.
- `nocta://` derin bağlantıları yalnızca mağaza/geliştirme derlemesinde açılır.

## 4. Yönetim paneli

```bash
cd admin
npm install
npm run dev        # geliştirme
npm run build      # yayın için: admin/dist
```

`dist/` klasörü herhangi bir statik sunucuda çalışır. Tek sayfa uygulaması olduğu için tüm yollar `index.html`'e yönlendirilmelidir; örnek Nginx ve Apache ayarları `admin/deploy/` içindedir.

**İlk yönetici:** `owner_email` olarak tanımladığınız adresle panelde "Hesap oluştur" deyip giriş yapın; yönetici tablosu boşken bu hesap otomatik olarak sahip (owner) olur.

## 5. Uygulama içi satın alma (RevenueCat)

1. `cd mobile && npx expo install react-native-purchases` (geliştirme derlemesi gerekir).
2. `mobile/src/lib/purchases.ts` içindeki yer tutucuları doldurun; girişten sonra kullanıcı kimliğiyle `Purchases.logIn` çağırın.
3. Supabase → Edge Functions → Secrets: `REVENUECAT_WEBHOOK_SECRET` tanımlayın.
4. RevenueCat → Integrations → Webhooks: `https://<proje-ref>.supabase.co/functions/v1/revenuecat-webhook`, Authorization: `Bearer <aynı değer>`.

## 6. Mağazalara yayın

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform all
npx eas-cli@latest submit --platform all
```

Paket kimlikleri `mobile/app.json` içindedir. Mağaza incelemesi için 18+ yaş sınırı, gizlilik politikası ve kullanım koşulları bağlantıları gerekir.
