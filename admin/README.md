# Nocta Yönetim Paneli

Nocta çift oyunları uygulamasının web yönetim paneli. Vite + React 18 + TypeScript ile yazılmıştır ve doğrudan Supabase arka ucuyla çalışır. Derleme çıktısı (`dist/`) statik dosyalardan oluşur; herhangi bir web sunucusunda yayınlanabilir.

## Bölümler

| Bölüm | Ne yapar |
| --- | --- |
| Genel Bakış | Günlük göstergeler (düne göre değişim), 30 günlük oyun grafiği, oyun dağılımı, son raporlar |
| Kullanıcılar | Arama, filtreler (Tümü/Aktif/Askıda/Premium/Partnersiz), askıya alma, silme (yalnızca sahip) |
| Çiftler | Flört seviyesi, oyun sayısı, son aktivite, premium verme/kaldırma, bağlantıyı sonlandırma |
| Oyunlar | Oyunları düzenleme, 8 oyun motorundan birini kullanan yeni oyun oluşturma, oynanma istatistikleri |
| Kategoriler | Her oyun için sınırsız kategori, soru sayıları, silmede soru sayısını gösteren onay |
| Sorular / Görevler | Filtreler, toplu işlemler, motora göre değişen form, canlı önizleme, CSV dışa aktarma, toplu içe aktarma (satır/CSV/JSON) |
| Hikâyeler | Bölüm sütunlarında sahne ve seçim düzenleyicisi, seçim yüzdeleri, yapı doğrulaması |
| Raporlar | Durum/öncelik filtreleri, ayrıntı paneli, bildirilen mesaj, not, kullanıcıyı askıya alma |
| Abonelikler | Özet göstergeler (aylık yinelenen gelir dahil), elle premium verme, iptal ve sonlandırma |
| Ödemeler | RevenueCat üzerinden gelen ödemeler, filtreler ve toplamlar |
| Analitik | Etkin kullanıcılar, haftalık grafik, kohort ısı haritası, dönüşüm hunisi, oyun bazında tablo |
| Ayarlar | Uygulama ayarları, yöneticiler ve roller, şifre değiştirme |

Rol bazlı erişim: **Sahip** her şeyi yapar. **İçerik editörü** içerikleri ve uygulama ayarlarını yönetir. **Moderatör** raporları ve kullanıcıları yönetir. **Destek** raporlara ve aboneliklere bakar. Panel yetkisi olmayan işlemleri gizler; asıl yetki kontrolünü veritabanı (RLS) yapar.

## Kurulum

Gereksinim: Node.js 18 ya da üzeri.

```bash
cd admin
npm install
cp .env.example .env   # depoda hazır bir .env zaten var
npm run dev            # http://localhost:5173
```

### Ortam değişkenleri (`.env`)

```
VITE_SUPABASE_URL=https://eeytvrfsxfxxpyqdoqls.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
# İsteğe bağlı: panel bir alt klasörde yayınlanacaksa
# VITE_BASE=/admin/
```

Bu değerler herkese açık istemci anahtarlarıdır; güvenlik veritabanındaki satır düzeyi güvenlik (RLS) kurallarıyla sağlanır. **Asla `service_role` anahtarını buraya yazmayın.**

## Derleme

```bash
npm run build     # önce TypeScript denetimi, ardından dist/ oluşturulur
npm run preview   # derlenmiş sürümü http://localhost:4173 adresinde deneyin
```

Ortam değişkenleri derleme sırasında dosyalara gömülür. `.env` değişirse yeniden derleyin.

## Sunucuya yükleme

Panel, adres çubuğunda `/kullanicilar` gibi gerçek yollar kullanır (tek sayfa uygulama). Bu yüzden sunucunun, bilinmeyen tüm yolları `index.html` dosyasına yönlendirmesi gerekir.

### nginx

1. `dist/` içeriğini sunucuya kopyalayın (ör. `/var/www/nocta-admin`).
2. `deploy/nginx.conf` dosyasındaki örneği site yapılandırmanıza ekleyin (`try_files $uri $uri/ /index.html;`).
3. `sudo nginx -t && sudo systemctl reload nginx`

### Apache

`public/.htaccess` derlemeye otomatik olarak eklenir, yani `dist/.htaccess` olarak gelir. `dist/` içeriğini sunucuya yüklemeniz yeterlidir. `mod_rewrite` ve `AllowOverride All` etkin olmalıdır. Aynı dosyanın bir kopyası `deploy/.htaccess` konumunda da bulunur.

### Alt klasörde yayınlama

Paneli `https://alan-adi.com/admin/` gibi bir alt klasörde yayınlayacaksanız:

1. `.env` dosyasına `VITE_BASE=/admin/` ekleyip yeniden derleyin.
2. nginx'te `location /admin/` bloğunu kullanın; Apache'de `RewriteBase /admin/` ve `RewriteRule . /admin/index.html [L]` yazın.

### Supabase ayarı

Supabase panelinde **Authentication → URL Configuration** bölümüne gidin. **Site URL** ve **Redirect URLs** alanlarına panelin adresini ekleyin. E-posta doğrulama ve şifre sıfırlama bağlantıları bu adrese yönlenir.

## İlk yönetici hesabı

`admins` tablosu boşken sisteme yalnızca **sahip e-postası** ile kayıt olan hesap yönetici olabilir.

1. Veritabanında sahip e-postasının tanımlı olduğundan emin olun. Tanımlı değilse Supabase SQL düzenleyicisinde şunu çalıştırın:
   ```sql
   insert into public.app_settings (key, value, is_public)
   values ('owner_email', to_jsonb('sahip@ornek.com'::text), false)
   on conflict (key) do update set value = excluded.value;
   ```
2. Paneli açın, **Hesap oluştur** sekmesinden bu e-posta ve bir şifre ile kayıt olun.
3. Supabase'de e-posta doğrulaması açıksa gelen kutunuzdaki bağlantıya tıklayın.
4. **Giriş yap** ile oturum açın. Panel `claim_first_admin` fonksiyonunu çağırır ve hesabınızı **Sahip** rolüyle yönetici yapar.
5. Diğer yöneticileri **Ayarlar → Yöneticiler → Yönetici ekle** ile ekleyin. Eklenecek kişi önce uygulamadan ya da panelden kayıt olmuş olmalıdır.

Yönetici olmayan bir hesapla giriş yapılırsa panel “Bu hesabın yönetici yetkisi yok” ekranını gösterir.

## Notlar

- İçerikte (oyun, kategori, soru, hikâye) yapılan her değişiklik veritabanı tetikleyicileriyle `content_version` değerini günceller. Mobil uygulama içeriği bu sayede otomatik olarak yeniden çeker.
- Uygulama ayarları anahtarları: `free_max_level` (sayı 0–3), `support_email`, `min_app_version`, `announcement` (duyuru kapalıyken satır silinir), `price_monthly`, `price_yearly` (sayı, ₺), `owner_email` (herkese açık değil).
- Sunucudaki `admin_analytics()` fonksiyonu hata verirse Analitik ve Oyunlar sayfaları aynı metrikleri yönetici yetkisiyle doğrudan tablolardan hesaplar ve bunu bir uyarıyla belirtir.
- Tarayıcı desteği: güncel Chrome, Safari, Firefox ve Edge.
