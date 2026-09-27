# Nocta Yönetim Paneli

Nocta çift oyunları uygulamasının web yönetim paneli. Vite + React 18 + TypeScript ile yazılmıştır ve doğrudan Supabase arka ucuyla çalışır. Derleme çıktısı (`dist/`) statik dosyalardan oluşur; herhangi bir web sunucusunda yayınlanabilir.

## Bölümler

| Bölüm | Ne yapar |
| --- | --- |
| Genel Bakış | Günlük göstergeler (düne göre değişim), 30 günlük oyun grafiği, oyun dağılımı, son raporlar |
| Kullanıcılar | Arama, filtreler (Tümü/Aktif/Askıda/Premium/Partnersiz), askıya alma, silme (yalnızca sahip) |
| Çiftler | Flört seviyesi, oyun sayısı, son aktivite, premium verme/kaldırma, bağlantıyı sonlandırma |
| Oyunlar | Oyunları düzenleme, 11 oyun motorundan birini (Test, Emoji ve Kart Seç dahil) kullanan yeni oyun oluşturma, satır menüsünden kategorilere/sorulara geçiş, oynanma istatistikleri |
| Kategoriler | Her oyun için sınırsız kategori, soru sayıları, silmede soru sayısını gösteren onay |
| Sorular / Görevler | Filtreler (motor filtresi dahil), toplu işlemler, motora göre değişen form (emoji paleti, kart görseli yükleme dahil), canlı önizleme, CSV dışa aktarma, toplu içe aktarma (satır/CSV/JSON) |
| Testler | 4 seçenekli testler: test listesi (soru sayısı, tür özeti, premium/aktif), yeni test, düzenleme/silme, her testin soruları |
| Hikâyeler | Bölüm sütunlarında sahne ve seçim düzenleyicisi, seçim yüzdeleri, yapı doğrulaması |
| Raporlar | Durum/öncelik filtreleri, ayrıntı paneli, bildirilen mesaj, not, kullanıcıyı askıya alma |
| Abonelikler | Özet göstergeler (aylık yinelenen gelir dahil), elle premium verme, iptal ve sonlandırma |
| Tanıtım Ödülleri | Nocta'yı tanıtan video başvuruları: göstergeler, durum/platform filtreleri, arama, 24 saat geri sayımı, kanıt görselleri, onay (premium verme) ve ret |
| Ödemeler | RevenueCat üzerinden gelen ödemeler, filtreler ve toplamlar |
| Analitik | Etkin kullanıcılar, haftalık grafik, kohort ısı haritası, dönüşüm hunisi, oyun bazında tablo |
| Ayarlar | Uygulama ayarları, yöneticiler ve roller, şifre değiştirme |

Rol bazlı erişim: **Sahip** her şeyi yapar. **İçerik editörü** içerikleri ve uygulama ayarlarını yönetir. **Moderatör** raporları, kullanıcıları ve tanıtım başvurularını yönetir. **Destek** raporlara, aboneliklere ve tanıtım başvurularına bakar. Panel yetkisi olmayan işlemleri gizler; asıl yetki kontrolünü veritabanı (RLS) yapar.

## Tanıtım Ödülleri

Kullanıcılar Nocta'yı TikTok, Instagram ya da YouTube'da tanıtan bir video paylaşır ve uygulamadan başvurur (`promo_submissions`: video linki, hesap adı, not, paylaşım zamanı ve özel **`promo-proofs`** deposuna yüklenen kanıt görselleri). Akış:

1. **Başvuru** — Kampanya açıkken (`promo_enabled`) yalnızca Premium olmayan ve bekleyen/onaylanmış başka başvurusu olmayan kullanıcılar başvurabilir. Başvuru **Bekliyor** durumunda gelir; kenar çubuğundaki rozet bekleyen başvuru sayısını gösterir.
2. **Bekleme** — Video en az `promo_min_hours` saat (varsayılan 24) yayında kalmalıdır. Listede “24 saat” sütunu kalan süreyi (“5s 12dk kaldı”) ya da ✓ **Doldu** bilgisini gösterir; “24 saati dolan & bekleyen” göstergesi onaya hazır başvuruları sayar.
3. **İnceleme** — Satıra tıklayınca ayrıntı paneli açılır: **Linki aç** ile videonun hâlâ yayında olduğunu kontrol edin, kanıt görsellerini (kısa süreli imzalı adreslerle) büyüterek inceleyin.
4. **Karar** — **Onayla — N gün Premium ver**, `admin_review_promo` fonksiyonunu çağırır: kullanıcıya `promo_days` gün (varsayılan 30) hediye abonelik tanımlanır ve bildirim gönderilir. Süre dolmadan onay düğmesi kapalıdır; gerekirse “24 saat dolmadan onayla” kutusu işaretlenerek erken onaylanabilir. **Reddet** için yönetici notu zorunludur; not kullanıcıya bildirim olarak gider. Reddedilen başvuru gerekirse sonradan onaylanabilir; onaylanan başvuru geri alınamaz (aboneliği **Abonelikler** bölümünden sonlandırabilirsiniz).

Başvuruları **Sahip**, **Moderatör** ve **Destek** inceleyebilir; diğer roller yalnızca görüntüler. Kampanya ayarları **Ayarlar → Tanıtım kampanyası** kartındadır (sahip ve içerik editörü değiştirebilir): `promo_enabled` (açık/kapalı), `promo_days` (gün), `promo_min_hours` (saat). Kampanya kapatılınca yeni başvuru alınmaz, mevcut başvurular incelenmeye devam eder.

## Testler

“Test (4 seçenek)” motorunu kullanan oyunlarda (ör. `quiz` kısa adlı **Çift Testleri**) her kategori bir testtir. **Testler** bölümü bu kategorileri listeler; **Yeni test** varsayılan olarak `quiz` oyununa eklenir (birden fazla test oyunu varsa seçilebilir). Yeni test oyunları **Oyunlar → Yeni oyun** ekranında motor olarak “Test (4 seçenek)” seçilerek oluşturulur.

- Her soruda A, B, C, D olmak üzere **4 seçenek zorunludur** (en fazla 80 karakter, birbirinden farklı).
- **Doğru cevap**: “Yok (uyum testi)” seçilirse partnerler aynı şıkkı seçmeye çalışır; A–D seçilirse bilgi sorusudur ve doğru cevap puanlanır (`questions.correct_index`, 0–3 ya da boş).
- Test türü özeti: tüm sorular doğru cevaplıysa **Bilgi testi**, hiçbiri değilse **Uyum testi**, aksi halde **Karışık**.
- Toplu içe aktarma (satır satır): `Soru | A | B | C | D | doğru` — doğru alanı A–D ya da boş (uyum). CSV'de `secenekler` (| ile) veya `a,b,c,d` sütunları ve `dogru` sütunu; JSON'da `options` ve `correct` (`"A"`–`"D"`, 0–3 ya da `null`).
- CSV dışa aktarma seçenekleri (`secenekler` ve ayrı `a`–`d` sütunları) ve doğru cevabı (`dogru`) içerir.
- Test soruları **Sorular** bölümünde de “Test (4 seçenek)” motor filtresiyle görülebilir.

## Emojilerle Anlat ve Kart Seç

Bu iki oyunun ayrı bir menüsü yoktur: **Oyunlar → (satır menüsü) Kategoriler / Soruları gör** ya da **Sorular** bölümünde motor filtresi (“Emoji (emoji şıklar)”, “Kart Seç (resimli kartlar)”) ile yönetilir. Kategoriler sayfasında oyuna göre filtreleyince “Bu oyunun tüm soruları →” bağlantısı çıkar; `/sorular?oyun=<oyun id>` bağlantısı doğrudan o oyunun sorularını açar. Yeni oyunlar **Oyunlar → Yeni oyun** ekranında bu motorlar seçilerek oluşturulabilir.

### Emoji (`emoji`, ör. **Emojilerle Anlat**)

- Her soruda **2–6 emoji şık** vardır (hepsi dolu ve birbirinden farklı, en fazla 40 karakter). Şık kutusunu seçip alttaki **emoji paletinden** (Aşk, Yüz, Yemek, Aktivite, Seyahat, Nesne · 120 emoji) tıklayarak ekleyebilirsiniz; ⌫ son emojiyi siler. Harf içeren şıklar için uyarı gösterilir.
- **Doğru cevap**: A–F ya da “Yok (eşleşme modu)” (`questions.correct_index`, 0–5 ya da boş). Şık silinince doğru cevap kaydırılır.
- Önizleme emojileri büyük karolar hâlinde (2 sütun) gösterir, doğru şık yeşil vurgulanır. Listede şıklar satır içinde ve DOĞRU / EŞLEŞME rozetiyle görünür.
- Toplu içe aktarma (satır satır): `Soru | 😀 | 😍 | 🙈 | 🔥 | doğru` — son alan tek harf (A–F) ya da boşsa doğru cevap kabul edilir. CSV: `secenekler` (| ile) ve `dogru`; JSON: `options`, `correct`.

### Kart Seç (`cards`, ör. **Kart Seç**)

- Her soruda **2–6 kart** vardır: başlık (`options[i]`, zorunlu, en fazla 60 karakter) ve isteğe bağlı görsel (`questions.media[i]`). `media` her zaman kart sayısı kadar uzunluktadır; görseli olmayan kart için boş metin (`""`) saklanır. Doğru cevap yoktur (`correct_index` her zaman boş); partnerler aynı kartı seçmeye çalışır.
- Kartlar oklarla sıralanır; başlık ve görsel birlikte taşınır. Önizleme kartları görselleriyle 2 sütunlu ızgarada, liste küçük görsel şeridiyle gösterir.
- Toplu içe aktarma (satır satır): `Soru | Kart1 | Kart2 | Kart3 | Kart4` — görseller sonradan soruyu düzenleyerek eklenir. CSV'de isteğe bağlı `gorseller` sütunu (| ile, kartlarla aynı sırada), JSON'da `media` desteklenir.
- CSV dışa aktarma (Sorular) `motor`, `gorseller` (kart görsel adresleri) ve `dogru` sütunlarını içerir.

### Kart görselleri (yükleme notları)

- Görseller herkese açık **`card-images`** deposuna yüklenir: **Görsel yükle** düğmesi, dosyayı karta sürükleyip bırakma ya da görsel adresi (`https://…`) yapıştırma. Yükleme sırasında ilerleme yüzdesi gösterilir; yükleme bitene kadar kaydetme kapalıdır.
- Yalnızca **JPEG, PNG, WebP, GIF** ve en fazla **5 MB**; panel bunu yüklemeden önce denetler, depo da aynı sınırları uygular.
- Dosya yolu: `<oyun id>/<soru id ya da new>/<rastgele uuid>.<uzantı>`; karta herkese açık adres yazılır.
- Yükleme/silme yetkisi yalnızca **Sahip** ve **İçerik editörü** rollerindedir (depo RLS kuralları). Diğer roller içeriği yalnızca görüntüler.
- Temizlik (en iyi çaba): kaydedilmeden kaldırılan ya da düzenleyici kapatılınca kaydedilmemiş kalan yüklemeler silinir; kayıttan çıkarılan görseller kaydetmeden sonra silinir; soru, kategori ya da Kart Seç oyunu silinirken ilgili görseller de depodan kaldırılır. Başka bir soruda hâlâ kullanılan adresler ve bu deponun dışındaki (yapıştırılmış) adresler silinmez.

## Kurulum

Gereksinim: Node.js 18 ya da üzeri.

```bash
cd admin
npm install
cp .env.example .env   # sonra kendi Supabase değerlerinizi yazın
npm run dev            # http://localhost:5173
```

### Ortam değişkenleri (`.env`)

```
VITE_SUPABASE_URL=https://<proje-ref>.supabase.co
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
- Uygulama ayarları anahtarları: `free_max_level` (sayı 0–3), `support_email`, `min_app_version`, `announcement` (duyuru kapalıyken satır silinir), `price_monthly`, `price_yearly` (sayı, ₺), `owner_email` (herkese açık değil), `promo_enabled`, `promo_days`, `promo_min_hours` (tanıtım kampanyası).
- Sunucudaki `admin_analytics()` fonksiyonu hata verirse Analitik ve Oyunlar sayfaları aynı metrikleri yönetici yetkisiyle doğrudan tablolardan hesaplar ve bunu bir uyarıyla belirtir.
- Tarayıcı desteği: güncel Chrome, Safari, Firefox ve Edge.
