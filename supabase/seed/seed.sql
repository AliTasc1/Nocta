-- Nocta · başlangıç içeriği (seed)
-- Boş bir veritabanında bir kez çalıştırılmak üzere hazırlanmıştır.
-- Satırlar birbirine slug / ad / başlık üzerinden bağlanır; UUID sabit yazılmaz.
-- Seviyeler: 0 Yumuşak · 1 Flörtöz · 2 Cesur · 3 Vahşi
-- Ruh hâlleri: romantik · eglenceli · flortoz · cesur · gizemli · karisik

begin;

-- ─────────────────────────────────────────────────────────────
-- Uygulama ayarları
-- ─────────────────────────────────────────────────────────────
insert into public.app_settings (key, value, is_public) values
  ('content_version', '1'::jsonb, true),
  ('free_max_level', '1'::jsonb, true),
  ('owner_email', '"sahip@ornek.com"'::jsonb, false),
  ('support_email', '"destek@nocta.app"'::jsonb, true),
  ('min_app_version', '"1.0.0"'::jsonb, true),
  ('announcement', 'null'::jsonb, true),
  ('prices', '{"monthly": 139, "yearly": 899, "currency": "TRY"}'::jsonb, true),
  ('free_game_slugs', '["truth_dare", "this_or_that", "would_you_rather"]'::jsonb, true)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Oyunlar
-- ─────────────────────────────────────────────────────────────
insert into public.games (slug, engine, name, description, icon, color, duration_label, rounds, is_premium, sort) values
  ('truth_dare', 'truth_dare', 'Doğruluk mu Cesaret mi', 'Klasik oyun, çiftlere özel. Sıra sende: doğruyu mu söyleyeceksin, yoksa cesaretini mi göstereceksin?', 'local_fire_department', '#5A1A2E', '8 dk · Yumuşak–Vahşi', 20, false, 1),
  ('would_you_rather', 'would_you_rather', 'Hangisini Seçerdin', 'İki seçenek, tek karar. Bakalım aynı şeyi seçecek misiniz?', 'call_split', '#3A1740', '5 dk · Yumuşak–Cesur', 10, false, 2),
  ('know_me', 'know_me', 'Beni Ne Kadar Tanıyorsun', 'Partnerinin cevabını tahmin et; birbirinizi ne kadar tanıdığınızı birlikte görün.', 'psychology', '#2A1530', '10 dk · Yumuşak–Flörtöz', 8, false, 3),
  ('challenges', 'challenges', 'Çift Görevleri', 'Süreli mini görevlerle aranızdaki kıvılcımı büyütün. Göz göze, el ele, kulaktan kulağa.', 'bolt', '#6B1E38', '6 dk · Flörtöz–Vahşi', 5, false, 4),
  ('secret_questions', 'secret_questions', 'Gizli Sorular', 'Cevaplar gizlice yazılır, aynı anda açılır. Sırlarınızı paylaşmaya hazır mısınız?', 'visibility_off', '#3A1740', '12 dk · Yumuşak–Vahşi', 6, false, 5),
  ('this_or_that', 'this_or_that', 'Bu mu Şu mu', 'Hızlı seçimler, anlık eşleşmeler. Kaç kez aynı şeyi seçeceksiniz?', 'swap_horiz', '#5A1A2E', '4 dk · Yumuşak–Cesur', 15, false, 6),
  ('story', 'story', 'Çift Hikâyesi', 'Birlikte seçin, hikâyeyi birlikte yazın. Her karar sizi başka bir sona götürür.', 'movie', '#2A1530', '15 dk · Flörtöz–Cesur', 1, false, 7),
  ('chat_game', 'chat_game', 'Sohbet Oyunu', 'Sohbetin içinde küçük görevler: emojiler, fısıltılar ve tatlı sürprizler.', 'forum', '#6B1E38', 'Sınırsız · Yumuşak–Vahşi', 1, false, 8)
;

-- ─────────────────────────────────────────────────────────────
-- Kategoriler
-- ─────────────────────────────────────────────────────────────
insert into public.categories (game_id, name, description, icon, color, is_premium, sort)
select g.id, v.name, v.description, v.icon, v.color, v.is_premium, v.sort
from (values
  ('truth_dare', 'Isınma Turu', 'Buzları eritecek tatlı sorular ve masum cesaretler.', 'wb_twilight', '#5A1A2E', false, 1),
  ('truth_dare', 'Tatlı Tehlike', 'Flörtün dozunu biraz artıran sorular ve görevler.', 'favorite', '#6B1E38', false, 2),
  ('truth_dare', 'Gece Yarısı', 'Işıklar kısılınca sorulacak cesur sorular.', 'dark_mode', '#3A1740', false, 3),
  ('truth_dare', 'Kırmızı Oda', 'Özel paket: yalnızca en cesur çiftler için.', 'local_fire_department', '#7A1F3D', true, 4),
  ('would_you_rather', 'Romantik İkilemler', 'Kalbinizi zorlayacak tatlı seçimler.', 'favorite', '#3A1740', false, 1),
  ('would_you_rather', 'Eğlenceli Seçimler', 'Kahkaha garantili, hafif ikilemler.', 'sentiment_very_satisfied', '#2A1530', false, 2),
  ('would_you_rather', 'Ateşli İkilemler', 'Özel paket: cevabı düşündükçe yüzünüz kızaracak.', 'whatshot', '#6B1E38', true, 3),
  ('know_me', 'Küçük Detaylar', 'Günlük alışkanlıklar, sevdiği şeyler, küçük sırlar.', 'search', '#2A1530', false, 1),
  ('know_me', 'Hayaller ve Anılar', 'Birlikte geçen anlar ve gelecekten beklentiler.', 'auto_awesome', '#3A1740', false, 2),
  ('know_me', 'Aşk Dili', 'Onu neyin etkilediğini gerçekten biliyor musun?', 'favorite', '#5A1A2E', false, 3),
  ('challenges', 'Günlük Görevler', 'Aynı odadayken yapılacak kısa ve tatlı görevler.', 'today', '#6B1E38', false, 1),
  ('challenges', 'Uzaktan Görevler', 'Mesajla, sesle, fotoğrafla: uzaktayken bile yakın olun.', 'send', '#3A1740', false, 2),
  ('challenges', 'Cesur Görevler', 'Özel paket: sınırlarınızı birlikte, rızayla keşfedin.', 'bolt', '#7A1F3D', true, 3),
  ('secret_questions', 'Derin Sorular', 'İlişkinize dair daha önce hiç konuşmadığınız şeyler.', 'psychology_alt', '#3A1740', false, 1),
  ('secret_questions', 'İtiraflar', 'Söylemeye çekindiğin tatlı gerçekler.', 'lock_open', '#2A1530', false, 2),
  ('secret_questions', 'Gece Sırları', 'Özel paket: yalnızca ikinizin arasında kalacak cevaplar.', 'visibility_off', '#6B1E38', true, 3),
  ('this_or_that', 'Klasikler', 'Kahve mi çay mı? Hızlı ve eğlenceli seçimler.', 'swap_horiz', '#5A1A2E', false, 1),
  ('this_or_that', 'Romantik', 'Mum ışığı mı, şehir ışıkları mı?', 'favorite', '#3A1740', false, 2),
  ('this_or_that', 'Ateşli', 'Özel paket: seçimler ısınıyor.', 'whatshot', '#6B1E38', true, 3),
  ('story', 'Hikâyeler', 'Birlikte yazdığınız etkileşimli hikâyeler.', 'movie', '#2A1530', false, 1),
  ('chat_game', 'Emoji Oyunları', 'Kelimeler yerine emojilerle konuşun.', 'mood', '#6B1E38', false, 1),
  ('chat_game', 'Tatlı Mesajlar', 'Günün herhangi bir anına küçük bir gülümseme.', 'chat_bubble', '#3A1740', false, 2),
  ('chat_game', 'Flört Mesajları', 'Sohbeti biraz ısıtacak cesur mesaj görevleri.', 'whatshot', '#5A1A2E', false, 3)
) as v(game_slug, name, description, icon, color, is_premium, sort)
join public.games g on g.slug = v.game_slug;

-- ─────────────────────────────────────────────────────────────
-- Sorular · Doğruluk mu Cesaret mi (77)
-- ─────────────────────────────────────────────────────────────
insert into public.questions (category_id, text, kind, level, mood, options, timer_seconds)
select c.id, v.text, v.kind, v.level::smallint, v.mood, v.options::jsonb, v.timer_seconds
from (values
  ('Isınma Turu', 'Beni ilk gördüğünde aklından geçen ilk düşünce neydi?', 'truth', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'Bende en sevdiğin küçük alışkanlık hangisi?', 'truth', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'Birlikte geçirdiğimiz en güzel gün hangisiydi ve neden?', 'truth', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'Bana hiç söylemediğin ama hep söylemek istediğin bir iltifat var mı?', 'truth', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'Beni tek bir şarkıyla anlatsan hangi şarkı olurdu?', 'truth', 0, 'eglenceli', '[]', null::integer),
  ('Isınma Turu', 'İlişkimizde seni en çok güldüren an hangisi?', 'truth', 0, 'eglenceli', '[]', null::integer),
  ('Isınma Turu', 'Beni arkadaşlarına ilk kez nasıl anlattın? Tam olarak ne dedin?', 'truth', 0, 'eglenceli', '[]', null::integer),
  ('Isınma Turu', 'Benimle ilgili ilk fark ettiğin şey neydi?', 'truth', 0, 'karisik', '[]', null::integer),
  ('Isınma Turu', 'Hiç benim için gizlice bir sürpriz hazırlayıp sonra vazgeçtin mi?', 'truth', 0, 'gizemli', '[]', null::integer),
  ('Isınma Turu', 'Beni en çok özlediğin an hangisiydi?', 'truth', 0, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'Birlikte gitmeyi en çok hayal ettiğin yer neresi?', 'truth', 0, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'Partnerine seni en çok heyecanlandıran kişilik özelliğini söyle.', 'truth', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'İlk mesajlaşmamızda gerçekte ne hissetmiştin?', 'truth', 0, 'karisik', '[]', null::integer),
  ('Isınma Turu', 'Benim yaptığım yemeklerden hangisini gizlice pek sevmiyorsun?', 'truth', 0, 'eglenceli', '[]', null::integer),
  ('Isınma Turu', 'Partnerine 30 saniye boyunca sadece mesajlarla iltifat et.', 'dare', 0, 'flortoz', '[]', null::integer),
  ('Isınma Turu', 'Partnerinin en sevdiği şarkının nakaratını ona söyle ya da sesli mesaj olarak gönder.', 'dare', 0, 'eglenceli', '[]', null::integer),
  ('Isınma Turu', 'Partnerinin gözlerinin içine bakarak onu neden sevdiğine dair üç sebep söyle.', 'dare', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'Birlikte en sevdiğin fotoğrafınızı bul ve neden o olduğunu anlat.', 'dare', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'Partnerinin portresini 20 saniyede çizmeye çalış ve eserini ona göster.', 'dare', 0, 'eglenceli', '[]', null::integer),
  ('Isınma Turu', 'En iyi yaptığın ünlü taklidiyle partnerine bir aşk sözü söyle.', 'dare', 0, 'eglenceli', '[]', null::integer),
  ('Isınma Turu', 'İlk buluşmanızı sadece üç emojiyle anlat; partnerin tahmin etsin.', 'dare', 0, 'eglenceli', '[]', null::integer),
  ('Tatlı Tehlike', 'Partnerinin elini tut ve bir dakika boyunca hiç konuşmadan gözlerine bak.', 'dare', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'En komik selfie''ni çek ve partnerine gönder.', 'dare', 0, 'eglenceli', '[]', null::integer),
  ('Isınma Turu', '10 saniye içinde bir sonraki randevunuz için bir plan uydur ve anlat.', 'dare', 0, 'karisik', '[]', null::integer),
  ('Isınma Turu', 'Partnerin için bir şiir uydur ve ilk iki dizesini hemen oku.', 'dare', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'Partnerine sarıl ve 20 saniye boyunca bırakma.', 'dare', 0, 'romantik', '[]', null::integer),
  ('Isınma Turu', 'Partnerinin sana taktığı lakabı en dramatik ses tonunla yüksek sesle söyle.', 'dare', 0, 'eglenceli', '[]', null::integer),
  ('Tatlı Tehlike', 'Bana ilk ne zaman gerçekten çekildiğini fark ettin?', 'truth', 1, 'flortoz', '[]', null::integer),
  ('Tatlı Tehlike', 'Üzerimde en çok sevdiğin kıyafet hangisi?', 'truth', 1, 'flortoz', '[]', null::integer),
  ('Tatlı Tehlike', 'Seni en hızlı etkileyen bakışım ya da hareketim hangisi?', 'truth', 1, 'flortoz', '[]', null::integer),
  ('Tatlı Tehlike', 'İlk öpücüğümüzden hemen önce aklından ne geçiyordu?', 'truth', 1, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'Hiç sadece beni görmek için bir bahane uydurdun mu?', 'truth', 1, 'eglenceli', '[]', null::integer),
  ('Tatlı Tehlike', 'Sana attığım mesajlardan hangisi seni en çok heyecanlandırdı?', 'truth', 1, 'flortoz', '[]', null::integer),
  ('Isınma Turu', 'Sesimin en çekici geldiği an hangisi?', 'truth', 1, 'flortoz', '[]', null::integer),
  ('Isınma Turu', 'Bir randevuda seni en çok etkileyen şey ne olurdu?', 'truth', 1, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'Beni kıskanıp hiç belli etmediğin bir an oldu mu?', 'truth', 1, 'gizemli', '[]', null::integer),
  ('Tatlı Tehlike', 'Hakkımda kurduğun en tatlı hayal neydi?', 'truth', 1, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'Sence en çekici olduğum an hangisiydi?', 'truth', 1, 'flortoz', '[]', null::integer),
  ('Tatlı Tehlike', 'Söylemeye utandığın ama aslında çok hoşuna giden bir hareketim var mı?', 'truth', 1, 'gizemli', '[]', null::integer),
  ('Tatlı Tehlike', 'Partnerinin kulağına onda en sevdiğin özelliği fısılda.', 'dare', 1, 'flortoz', '[]', null::integer),
  ('Tatlı Tehlike', '30 saniye boyunca sadece gözlerinle flört et; partnerini güldürürsen kazanırsın.', 'dare', 1, 'flortoz', '[]', null::integer),
  ('Tatlı Tehlike', 'Partnerine şu an ne düşündüğünü anlatan flörtöz bir sesli mesaj gönder.', 'dare', 1, 'flortoz', '[]', null::integer),
  ('Tatlı Tehlike', 'İzin iste ve partnerinin yanağına yavaşça tek bir öpücük kondur.', 'dare', 1, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'En sevdiğiniz şarkıda partnerinle 30 saniye yavaş dans et.', 'dare', 1, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'Tek kelime etmeden, sadece bakışlarınla "seni özledim" demeye çalış.', 'dare', 1, 'eglenceli', '[]', null::integer),
  ('Tatlı Tehlike', 'En çekici pozunla bir fotoğraf çek ve partnerine gönder.', 'dare', 1, 'flortoz', '[]', null::integer),
  ('Isınma Turu', 'Partnerinin elini tut ve avucuna parmağınla bir kalp çiz.', 'dare', 1, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'Partnerine "Bu akşam seninle..." diye başlayan bir mesaj yaz ve cümleyi tamamla.', 'dare', 1, 'flortoz', '[]', null::integer),
  ('Isınma Turu', 'Bir dakika boyunca partnerinin saçlarıyla oyna ve ona en sevdiğin anınızı anlat.', 'dare', 1, 'romantik', '[]', null::integer),
  ('Tatlı Tehlike', 'Bir film sahnesindeymiş gibi partnerine dramatik bir aşk ilanı yap.', 'dare', 1, 'eglenceli', '[]', null::integer),
  ('Gece Yarısı', 'Seni en çok heyecanlandıran dokunuşum hangisi?', 'truth', 2, 'cesur', '[]', null::integer),
  ('Gece Yarısı', 'Birlikte hiç denemediğimiz ama merak ettiğin romantik bir şey var mı?', 'truth', 2, 'cesur', '[]', null::integer),
  ('Gece Yarısı', 'Rüyanda beni gördüğün en ilginç an neydi?', 'truth', 2, 'gizemli', '[]', null::integer),
  ('Gece Yarısı', 'Benimle ilgili en cesur hayalin nasıl bir akşamla başlıyor?', 'truth', 2, 'cesur', '[]', null::integer),
  ('Gece Yarısı', 'Bende karşı koyamadığın bir hareket var mı? Hangisi?', 'truth', 2, 'flortoz', '[]', null::integer),
  ('Kırmızı Oda', 'Bir geceyi baştan sona sen planlasan nasıl başlatırdın?', 'truth', 2, 'cesur', '[]', null::integer),
  ('Gece Yarısı', 'Bir mesajımı okurken yüzünün kızardığı oldu mu? Hangisiydi?', 'truth', 2, 'flortoz', '[]', null::integer),
  ('Gece Yarısı', 'Partnerinin kulağına ona dair en cesur düşünceni fısılda.', 'dare', 2, 'cesur', '[]', null::integer),
  ('Gece Yarısı', '30 saniye boyunca yalnızca bakışlarınla partnerine "gel" de.', 'dare', 2, 'flortoz', '[]', null::integer),
  ('Gece Yarısı', 'Partnerin de isterse boynuna yavaşça üç öpücük kondur.', 'dare', 2, 'cesur', '[]', null::integer),
  ('Gece Yarısı', 'En ateşli bulduğun anınızı anlatan kısa bir sesli mesaj bırak.', 'dare', 2, 'cesur', '[]', null::integer),
  ('Gece Yarısı', 'Bir dakika boyunca partnerinle alın alına durun; konuşmak ve gülmek yasak.', 'dare', 2, 'gizemli', '[]', null::integer),
  ('Gece Yarısı', 'Partnerine bu gece için tek cümlelik bir davet mesajı yaz.', 'dare', 2, 'flortoz', '[]', null::integer),
  ('Kırmızı Oda', 'Partnerinin en sevdiğin yerine bir öpücük kondur ve neden orası olduğunu söyle.', 'dare', 2, 'cesur', '[]', null::integer),
  ('Kırmızı Oda', 'Işıkları kıs ve bir şarkı boyunca partnerinle çok yakın dans et.', 'dare', 2, 'romantik', '[]', null::integer),
  ('Kırmızı Oda', 'Bana karşı kendini en çok tutmak zorunda kaldığın an hangisiydi?', 'truth', 3, 'cesur', '[]', null::integer),
  ('Kırmızı Oda', 'Birlikte yaşamak istediğin en cesur gece nerede geçiyor?', 'truth', 3, 'cesur', '[]', null::integer),
  ('Kırmızı Oda', 'Seni en çok ne etkiliyor: sözlerim mi, dokunuşlarım mı, bakışlarım mı? Neden?', 'truth', 3, 'flortoz', '[]', null::integer),
  ('Kırmızı Oda', 'Bana hiç söylemediğin gizli bir arzun var mı? Sadece bir ipucu ver.', 'truth', 3, 'gizemli', '[]', null::integer),
  ('Kırmızı Oda', 'Hayalindeki mükemmel gecenin son sahnesini anlat.', 'truth', 3, 'cesur', '[]', null::integer),
  ('Gece Yarısı', 'Unutamadığın öpücüğümüz hangisiydi ve seni neden bu kadar etkiledi?', 'truth', 3, 'romantik', '[]', null::integer),
  ('Kırmızı Oda', 'Partnerinin kulağına bu gece onu neyin beklediğini üç kelimeyle fısılda.', 'dare', 3, 'cesur', '[]', null::integer),
  ('Kırmızı Oda', 'Partnerin gözlerini kapatsın; 30 saniye boyunca onu yanağından boynuna küçük öpücüklerle şaşırt.', 'dare', 3, 'cesur', '[]', null::integer),
  ('Kırmızı Oda', 'Bir dakika boyunca gözlerini ayırmadan partnerine yavaşça yaklaş; ilk gülen kaybeder.', 'dare', 3, 'flortoz', '[]', null::integer),
  ('Kırmızı Oda', 'Bir dakika boyunca sadece fısıldayarak partnerine ondan ne kadar etkilendiğini anlat.', 'dare', 3, 'cesur', '[]', null::integer),
  ('Kırmızı Oda', 'Partnerinin seçtiği bir şarkı boyunca yalnızca onun için bir dans gösterisi yap.', 'dare', 3, 'flortoz', '[]', null::integer),
  ('Gece Yarısı', 'Partnerine bu gecenin ilk hamlesini ona bırakan bir "kupon" mesajı gönder.', 'dare', 3, 'gizemli', '[]', null::integer)
) as v(category, text, kind, level, mood, options, timer_seconds)
join public.games g on g.slug = 'truth_dare'
join public.categories c on c.game_id = g.id and c.name = v.category;

-- ─────────────────────────────────────────────────────────────
-- Sorular · Hangisini Seçerdin (48)
-- ─────────────────────────────────────────────────────────────
insert into public.questions (category_id, text, kind, level, mood, options, timer_seconds)
select c.id, v.text, v.kind, v.level::smallint, v.mood, v.options::jsonb, v.timer_seconds
from (values
  ('Romantik İkilemler', 'Bir akşam için hangisini seçerdin?', null::text, 0, 'romantik', '["Partnerinle spontane bir gece", "Planlanmış romantik bir gece"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 0, 'romantik', '["Her sabah birlikte kahvaltı", "Her gece yatmadan uzun sohbet"]', null::integer),
  ('Eğlenceli Seçimler', 'Tatil için hangisini seçerdin?', null::text, 0, 'eglenceli', '["Sessiz bir koyda çadır", "Büyük bir şehirde butik otel"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 0, 'romantik', '["Ona bir aşk mektubu yazmak", "Ona bir aşk şarkısı söylemek"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisi daha çok sen?', null::text, 0, 'eglenceli', '["Sürpriz yapmak", "Sürpriz yaşamak"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 0, 'eglenceli', '["Yağmurda el ele yürüyüş", "Karda kartopu savaşı"]', null::integer),
  ('Eğlenceli Seçimler', 'Bir hafta boyunca hangisini seçerdin?', null::text, 0, 'eglenceli', '["Her akşam birlikte yemek pişirmek", "Her akşam dışarıda yemek"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 0, 'romantik', '["İlk buluşmamızı yeniden yaşamak", "Geleceğimizden bir günü görmek"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 0, 'karisik', '["Birlikte yeni bir dil öğrenmek", "Birlikte bir enstrüman öğrenmek"]', null::integer),
  ('Eğlenceli Seçimler', 'Hafta sonu için hangisini seçerdin?', null::text, 0, 'eglenceli', '["Bütün gün battaniye altında film", "Bütün gün şehri keşfetmek"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 0, 'karisik', '["Hiç tartışmamak ama az konuşmak", "Bazen tartışmak ama her şeyi konuşmak"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 0, 'romantik', '["Gün doğumunu birlikte izlemek", "Gün batımını birlikte izlemek"]', null::integer),
  ('Eğlenceli Seçimler', 'Birlikte bakmak için hangisini seçerdin?', null::text, 0, 'eglenceli', '["Tembel bir kedi", "Enerjik bir köpek"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 0, 'gizemli', '["Partnerinin aklını bir günlüğüne okumak", "Partnerinin rüyasına bir geceliğine girmek"]', null::integer),
  ('Eğlenceli Seçimler', 'Birlikte yolculuk için hangisi?', null::text, 0, 'eglenceli', '["Uzun bir tren yolculuğu", "Plansız bir araba yolculuğu"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 0, 'romantik', '["Her gün küçük bir hediye", "Yılda bir kez büyük bir sürpriz"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 0, 'eglenceli', '["Ünlü bir şefin yemeği", "Partnerinin biraz yanık makarnası"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Partnerinden el yazısı bir aşk mektubu", "Partnerinden flörtöz bir sesli mesaj"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Kalabalıkta gizli gizli bakışmak", "Baş başa uzun bir öpücük"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Partnerinin seni tavlamaya çalışması", "Senin onu tavlamaya çalışman"]', null::integer),
  ('Romantik İkilemler', 'Randevu için hangisini seçerdin?', null::text, 1, 'romantik', '["Mum ışığında akşam yemeği", "Şehir ışıklarında gece gezisi"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Bir gün boyunca sadece flörtöz mesajlar", "Bir gün boyunca sadece sarılmak"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Partnerinin en şık hâli", "Partnerinin sabah dağınık hâli"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 1, 'romantik', '["Kulağına fısıldanan bir iltifat", "Yastığına bırakılmış bir not"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Yavaş bir dans", "Oyunbaz bir takılma"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Partnerinin senin için hazırlanması", "Senin onun için hazırlanman"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 1, 'romantik', '["İlk öpücüğü yeniden yaşamak", "İlk \"seni seviyorum\"u yeniden yaşamak"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 1, 'romantik', '["Otel odasında yatakta kahvaltı", "Bir teknede gün batımı"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Boynundaki parfüm kokusu", "Saçındaki şampuan kokusu"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 1, 'eglenceli', '["Gece yarısı sürpriz ziyaret", "Sabah erkenden kapıda sürpriz kahve"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 1, 'flortoz', '["Seni biraz kıskanan bir partner", "Seni hiç kıskanmayan bir partner"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 2, 'cesur', '["Göz göze uzun bir öpücük", "Gözler bağlıyken sürpriz bir öpücük"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 2, 'cesur', '["Partnerinin seni baştan çıkarması için bir saat", "Senin onu baştan çıkarman için bir saat"]', null::integer),
  ('Romantik İkilemler', 'Hangisini seçerdin?', null::text, 2, 'flortoz', '["Masaj yapmak", "Masaj yaptırmak"]', null::integer),
  ('Romantik İkilemler', 'Bir gece için hangisini seçerdin?', null::text, 2, 'romantik', '["Lüks bir otel süiti", "Ormanda cam bir kulübe"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 2, 'cesur', '["Partnerinin gözlerini bağlamak", "Onun senin gözlerini bağlaması"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 2, 'gizemli', '["Bütün gece fısıldaşmak", "Bütün gece hiç konuşmadan anlaşmak"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 2, 'flortoz', '["Birlikte köpük banyosu", "Birlikte yağmurda dans"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 2, 'cesur', '["Partnerinden cesur bir fotoğraf", "Partnerinden cesur bir sesli mesaj"]', null::integer),
  ('Eğlenceli Seçimler', 'Hangisini seçerdin?', null::text, 2, 'cesur', '["Bu gece liderliği sen al", "Bu gece liderliği o alsın"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 2, 'flortoz', '["Sürpriz bir gecelik hediyesi", "Sürpriz bir parfüm hediyesi"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 3, 'cesur', '["Bütün gece yavaş ve tutkulu", "Kısa, ani ve çılgın bir an"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 3, 'gizemli', '["Rol yaptığınız gizemli bir gece", "Tamamen kendiniz olduğunuz bir gece"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 3, 'cesur', '["Partnerinin tüm hayallerini bilmek", "Kendi hayallerini ona anlatmak"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 3, 'romantik', '["Balkonda yıldızların altında", "Şöminenin önünde battaniye altında"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 3, 'cesur', '["Bir gece boyunca kontrol sende", "Bir gece boyunca kontrol onda"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 3, 'flortoz', '["Ayna karşısında birlikte dans", "Gözler kapalı birlikte dans"]', null::integer),
  ('Ateşli İkilemler', 'Hangisini seçerdin?', null::text, 3, 'cesur', '["Uykusuz geçen uzun bir gece", "Hiç acele etmeden uzun bir sabah"]', null::integer)
) as v(category, text, kind, level, mood, options, timer_seconds)
join public.games g on g.slug = 'would_you_rather'
join public.categories c on c.game_id = g.id and c.name = v.category;

-- ─────────────────────────────────────────────────────────────
-- Sorular · Beni Ne Kadar Tanıyorsun (42)
-- ─────────────────────────────────────────────────────────────
insert into public.questions (category_id, text, kind, level, mood, options, timer_seconds)
select c.id, v.text, v.kind, v.level::smallint, v.mood, v.options::jsonb, v.timer_seconds
from (values
  ('Hayaller ve Anılar', 'Partnerinin ideal randevusu hangisi?', null::text, 0, 'romantik', '["Evde film ve battaniye", "Şehirde gece yürüyüşü", "Sürpriz bir restoran", "Sabaha kadar konuşmak"]', null::integer),
  ('Küçük Detaylar', 'Partnerin sabah uyanınca ilk ne yapar?', null::text, 0, 'eglenceli', '["Telefona bakar", "Kahve ya da çay yapar", "Sarılıp uyumaya devam eder", "Hemen duşa girer"]', null::integer),
  ('Küçük Detaylar', 'Partnerinin en sevdiği mevsim hangisi?', null::text, 0, 'karisik', '["İlkbahar", "Yaz", "Sonbahar", "Kış"]', null::integer),
  ('Küçük Detaylar', 'Partnerin stresliyken ne yapar?', null::text, 0, 'karisik', '["Müzik dinler", "Yürüyüşe çıkar", "Bir şeyler atıştırır", "Uyur"]', null::integer),
  ('Hayaller ve Anılar', 'Partnerinin tatil tarzı hangisi?', null::text, 0, 'eglenceli', '["Deniz ve kum", "Şehir turu", "Doğa ve kamp", "Evde dinlenmek"]', null::integer),
  ('Küçük Detaylar', 'Partnerinin en sevdiği yemek türü hangisi?', null::text, 0, 'eglenceli', '["Ev yemeği", "Hamburger ve pizza", "Deniz ürünleri", "Tatlılar"]', null::integer),
  ('Hayaller ve Anılar', 'Partnerin hangi süper gücü seçerdi?', null::text, 0, 'eglenceli', '["Işınlanma", "Zihin okuma", "Zamanı durdurma", "Görünmezlik"]', null::integer),
  ('Küçük Detaylar', 'Partnerinin hafta sonu favorisi hangisi?', null::text, 0, 'karisik', '["Geç kalkmak", "Dışarıda kahvaltı", "Spor yapmak", "Arkadaşlarla buluşmak"]', null::integer),
  ('Küçük Detaylar', 'Partnerinin en sevdiği film türü hangisi?', null::text, 0, 'eglenceli', '["Romantik komedi", "Gerilim", "Bilim kurgu", "Animasyon"]', null::integer),
  ('Küçük Detaylar', 'Partnerin en çok neden korkar?', null::text, 0, 'gizemli', '["Böcekler", "Yükseklik", "Karanlık", "Yalnız kalmak"]', null::integer),
  ('Aşk Dili', 'Bir tartışmadan sonra partnerin ne ister?', null::text, 0, 'romantik', '["Hemen konuşmak", "Biraz yalnız kalmak", "Sarılmak", "Ortamı yumuşatan bir espri"]', null::integer),
  ('Küçük Detaylar', 'Partnerinin vazgeçemediği içecek hangisi?', null::text, 0, 'karisik', '["Türk kahvesi", "Demli çay", "Filtre kahve", "Soğuk limonata"]', null::integer),
  ('Hayaller ve Anılar', 'Partnerinin çocukken hayali mesleği neydi?', null::text, 0, 'eglenceli', '["Doktor", "Astronot", "Öğretmen", "Sanatçı"]', null::integer),
  ('Küçük Detaylar', 'Partnerin telefonda en çok ne yapar?', null::text, 0, 'eglenceli', '["Mesajlaşır", "Sosyal medyada gezer", "Müzik dinler", "Oyun oynar"]', null::integer),
  ('Hayaller ve Anılar', 'Partnerinin ideal cumartesi gecesi hangisi?', null::text, 0, 'karisik', '["Evde dizi maratonu", "Bir konser", "Arkadaşlarla sofra", "Uzun bir yürüyüş"]', null::integer),
  ('Aşk Dili', 'Partnerini en çok ne etkiler?', null::text, 1, 'romantik', '["Sürpriz bir mesaj", "Anlamlı bir bakış", "Küçük bir hediye", "Uzun bir sarılma"]', null::integer),
  ('Aşk Dili', 'Partnerinin aşk dili hangisi?', null::text, 1, 'romantik', '["Güzel sözler", "Dokunmak", "Birlikte zaman", "Hediyeler"]', null::integer),
  ('Aşk Dili', 'Partnerin sende en çok neyi çekici bulur?', null::text, 1, 'flortoz', '["Gülüşünü", "Gözlerini", "Sesini", "Özgüvenini"]', null::integer),
  ('Aşk Dili', 'Partnerinin favori öpücüğü hangisi?', null::text, 1, 'flortoz', '["Alından", "Yanaktan", "Boyundan", "Uzun ve yavaş"]', null::integer),
  ('Hayaller ve Anılar', 'İlk buluşmada partnerinin dikkatini ilk ne çekti?', null::text, 1, 'romantik', '["Kıyafetin", "Kokun", "Gülüşün", "Konuşman"]', null::integer),
  ('Aşk Dili', 'Partnerin flört ederken ne yapar?', null::text, 1, 'flortoz', '["Gözlerini kaçırır", "Espri yapar", "Dokunmaya bahane arar", "Uzun uzun bakar"]', null::integer),
  ('Hayaller ve Anılar', 'Partnerine göre en romantik an hangisi?', null::text, 1, 'romantik', '["Gün batımı", "Yağmurlu bir gece", "Birlikte uyanmak", "Karlı bir akşam"]', null::integer),
  ('Aşk Dili', 'Partnerinin en çok hoşlandığı iltifat türü?', null::text, 1, 'flortoz', '["Görünüşüne dair", "Zekâsına dair", "Kalbine dair", "Tarzına dair"]', null::integer),
  ('Aşk Dili', 'Partnerin seni özleyince ne yapar?', null::text, 1, 'romantik', '["Eski fotoğraflara bakar", "Mesaj atar", "Hemen arar", "Şarkımızı dinler"]', null::integer),
  ('Küçük Detaylar', 'Partnerin sana en çok nasıl hitap eder?', null::text, 1, 'romantik', '["Adınla", "Aşkım", "Canım", "Özel bir lakapla"]', null::integer),
  ('Hayaller ve Anılar', 'Partnerinin hayalindeki yıl dönümü kutlaması?', null::text, 1, 'romantik', '["Yurt dışı kaçamağı", "Evde özel bir yemek", "Sürpriz bir parti", "Doğada kamp"]', null::integer),
  ('Aşk Dili', 'Partnerinin en sevdiği sarılma şekli?', null::text, 1, 'romantik', '["Arkadan sarılmak", "Yüz yüze sıkıca", "Kaşık gibi uzanmak", "Omuz omuza"]', null::integer),
  ('Hayaller ve Anılar', 'İlk öpücüğünüzde partnerin ne hissetti?', null::text, 1, 'romantik', '["Heyecan", "Utangaçlık", "Huzur", "Karnında kelebekler"]', null::integer),
  ('Aşk Dili', 'Partnerinin en sevdiği dokunuş hangisi?', null::text, 2, 'flortoz', '["Saç okşamak", "Sırtta parmak uçları", "El ele tutuşmak", "Boyna bir öpücük"]', null::integer),
  ('Aşk Dili', 'Partnerini en çok ne heyecanlandırır?', null::text, 2, 'cesur', '["Fısıltılar", "Bakışlar", "Dokunuşlar", "Cesur mesajlar"]', null::integer),
  ('Hayaller ve Anılar', 'Romantik bir gece için partnerinin tercihi?', null::text, 2, 'romantik', '["Mum ışığı", "Loş bir lamba", "Karanlık", "Şehir ışıkları"]', null::integer),
  ('Küçük Detaylar', 'Partnerin seni en çekici hangi kıyafette bulur?', null::text, 2, 'flortoz', '["Siyah bir şey", "Beyaz gömlek", "Rahat eşofman", "Onun tişörtü"]', null::integer),
  ('Aşk Dili', 'Partnerin ilk hamleyi nasıl yapar?', null::text, 2, 'flortoz', '["Bir bakışla", "Bir mesajla", "Bir dokunuşla", "Bir fısıltıyla"]', null::integer),
  ('Aşk Dili', 'Partnerin yakınlaşmayı en çok ne zaman sever?', null::text, 2, 'cesur', '["Sabah", "Öğleden sonra", "Gece yarısı", "Hiç fark etmez"]', null::integer),
  ('Hayaller ve Anılar', 'Partnerinin hayalindeki kaçamak mekânı?', null::text, 2, 'gizemli', '["Lüks bir otel", "Karlı bir dağ evi", "Bir tekne", "Kendi evimiz"]', null::integer),
  ('Küçük Detaylar', 'Partnerine göre en ateşli müzik hangisi?', null::text, 2, 'flortoz', '["R&B", "Caz", "Pop", "Türkçe slow"]', null::integer),
  ('Aşk Dili', 'Partnerin kontrolü kimde görmek ister?', null::text, 3, 'cesur', '["Kendisinde", "Sende", "Sırayla", "Anına göre"]', null::integer),
  ('Hayaller ve Anılar', 'Partnerinin en cesur hayali nerede geçer?', null::text, 3, 'cesur', '["Bir tatil köyünde", "Şehir manzaralı süitte", "Yağmurlu bir arabada", "Issız bir koyda"]', null::integer),
  ('Aşk Dili', 'Gözlerini bağlamayı teklif etsen partnerin ne derdi?', null::text, 3, 'gizemli', '["Hemen evet", "Önce kahkaha atardı", "Merakla evet", "Belki bir gün"]', null::integer),
  ('Aşk Dili', 'Partnerinin tercihi: tutku mu, şefkat mi?', null::text, 3, 'cesur', '["Hep tutku", "Hep şefkat", "Önce şefkat sonra tutku", "Önce tutku sonra şefkat"]', null::integer),
  ('Hayaller ve Anılar', 'Bir gecelik rol oyununda partnerin kim olurdu?', null::text, 3, 'gizemli', '["Gizemli bir yabancı", "Bir ajan", "Bir film yıldızı", "Kendisi"]', null::integer),
  ('Aşk Dili', 'Partnerine göre en hassas yer neresi?', null::text, 3, 'cesur', '["Boyun", "Kulak arkası", "Bel", "Dudaklar"]', null::integer)
) as v(category, text, kind, level, mood, options, timer_seconds)
join public.games g on g.slug = 'know_me'
join public.categories c on c.game_id = g.id and c.name = v.category;

-- ─────────────────────────────────────────────────────────────
-- Sorular · Çift Görevleri (54)
-- ─────────────────────────────────────────────────────────────
insert into public.questions (category_id, text, kind, level, mood, options, timer_seconds)
select c.id, v.text, v.kind, v.level::smallint, v.mood, v.options::jsonb, v.timer_seconds
from (values
  ('Günlük Görevler', '60 saniye boyunca göz göze bakın; ilk gülen kaybeder.', null::text, 0, 'eglenceli', '[]', 60),
  ('Günlük Görevler', 'Partnerine bugün seni gülümseten üç şeyi anlat.', null::text, 0, 'romantik', '[]', 120),
  ('Günlük Görevler', 'En sevdiğiniz şarkıyı açın ve hiç konuşmadan baştan sona birlikte dinleyin.', null::text, 0, 'romantik', '[]', 240),
  ('Uzaktan Görevler', 'Partnerine bugün için ona teşekkür ettiğin küçük bir şeyi yaz.', null::text, 0, 'romantik', '[]', null::integer),
  ('Günlük Görevler', 'El ele tutuşup iki dakika boyunca birlikte yavaşça nefes alıp verin.', null::text, 0, 'romantik', '[]', 120),
  ('Uzaktan Görevler', 'Partnerine eski bir fotoğrafınızı gönder ve o gün neler hissettiğini anlat.', null::text, 0, 'romantik', '[]', null::integer),
  ('Günlük Görevler', 'Birbirinize bu hafta için küçük birer iyilik sözü verin.', null::text, 0, 'romantik', '[]', 90),
  ('Uzaktan Görevler', 'Gün içinde hiç beklemediği bir anda partnerine "seni düşünüyorum" yaz.', null::text, 0, 'romantik', '[]', null::integer),
  ('Günlük Görevler', 'Beş dakika içinde bir sonraki randevunuzu birlikte planlayın.', null::text, 0, 'karisik', '[]', 300),
  ('Günlük Görevler', 'Bu hafta birlikte pişireceğiniz bir yemek seçin ve gününü belirleyin.', null::text, 0, 'eglenceli', '[]', 180),
  ('Günlük Görevler', 'Sırayla birbirinize iltifat edin; 30 saniye boyunca durmak yok.', null::text, 0, 'flortoz', '[]', 30),
  ('Uzaktan Görevler', 'Partnerine bugününü tek bir kelimeyle anlat ve nedenini açıkla.', null::text, 0, 'karisik', '[]', 60),
  ('Uzaktan Görevler', 'Sırayla birbirinize üç emojiyle bir film anlatın ve tahmin edin.', null::text, 0, 'eglenceli', '[]', 180),
  ('Uzaktan Görevler', 'Uyumadan önce partnerine tatlı bir sesli "iyi geceler" mesajı gönder.', null::text, 0, 'romantik', '[]', null::integer),
  ('Günlük Görevler', 'Telefonları kenara bırakın ve üç dakika boyunca sadece sohbet edin.', null::text, 0, 'romantik', '[]', 180),
  ('Günlük Görevler', 'Gelecek yıl birlikte yapmak istediğiniz üç şeyi yazın.', null::text, 0, 'romantik', '[]', 240),
  ('Günlük Görevler', 'Birbirinize sarılın ve 30 saniye boyunca bırakmayın.', null::text, 0, 'romantik', '[]', 30),
  ('Uzaktan Görevler', 'Birbirinize birer çocukluk fotoğrafı gönderin ve o günü anlatın.', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Uzaktan Görevler', 'Partnerine ona seni hatırlatan bir şarkı gönder.', null::text, 0, 'romantik', '[]', null::integer),
  ('Günlük Görevler', 'Partnerinin kulağına sadece iki kelimelik bir iltifat fısılda.', null::text, 1, 'flortoz', '[]', 30),
  ('Günlük Görevler', 'Bir dakika boyunca yalnızca bakışlarla flört edin; konuşmak yasak.', null::text, 1, 'flortoz', '[]', 60),
  ('Uzaktan Görevler', 'Partnerine yalnızca emojilerden oluşan flörtöz bir mesaj gönder.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Günlük Görevler', 'En sevdiğiniz şarkıda birlikte yavaş dans edin.', null::text, 1, 'romantik', '[]', 180),
  ('Uzaktan Görevler', 'Onda en çekici bulduğun üç şeyi anlatan bir sesli mesaj gönder.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Günlük Görevler', 'Partnerinin avucuna parmağınla bir kelime yaz; ne yazdığını tahmin etsin.', null::text, 1, 'eglenceli', '[]', 90),
  ('Uzaktan Görevler', 'Partnerine bu akşam için resmî bir "randevu daveti" mesajı gönder.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Uzaktan Görevler', 'En güzel gülüşünle bir selfie çek ve partnerine gönder.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Günlük Görevler', 'Işıkları kısın ve beş dakika boyunca sadece mum ışığında sohbet edin.', null::text, 1, 'romantik', '[]', 300),
  ('Günlük Görevler', 'Partnerinin alnına bir öpücük kondur ve onunla neden şanslı olduğunu söyle.', null::text, 1, 'romantik', '[]', 30),
  ('Günlük Görevler', 'Sırayla "ilk"lerinizi sayın: ilk bakış, ilk mesaj, ilk öpücük...', null::text, 1, 'romantik', '[]', 60),
  ('Uzaktan Görevler', 'Gün içinde partnerine gizemli bir ipucu gönder: "Akşam sana bir şey söyleyeceğim..."', null::text, 1, 'gizemli', '[]', null::integer),
  ('Günlük Görevler', 'İki dakika boyunca partnerinin saçlarını okşa.', null::text, 1, 'romantik', '[]', 120),
  ('Günlük Görevler', 'Sırayla birbirinizin kulağına küçük bir sır fısıldayın.', null::text, 1, 'gizemli', '[]', 60),
  ('Uzaktan Görevler', 'Partnerinin en çekici bulduğun fotoğrafını ona gönder ve nedenini yaz.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Günlük Görevler', '30 saniye boyunca burun buruna durun; gülmek yasak.', null::text, 1, 'eglenceli', '[]', 30),
  ('Cesur Görevler', 'Partnerine iki dakikalık rahatlatıcı bir omuz masajı yap.', null::text, 2, 'romantik', '[]', 120),
  ('Cesur Görevler', 'İzin iste ve partnerinin boynuna, acele etmeden, üç öpücük kondur.', null::text, 2, 'cesur', '[]', 30),
  ('Cesur Görevler', 'Gözlerini kapat; partnerin seni yalnızca dokunuşlarıyla odada gezdirsin.', null::text, 2, 'gizemli', '[]', 120),
  ('Uzaktan Görevler', 'Partnerine cesur ama zarif bir fotoğrafını gönder.', null::text, 2, 'flortoz', '[]', null::integer),
  ('Uzaktan Görevler', 'Partnerine bu gece için üç ipucu içeren gizemli bir mesaj yaz.', null::text, 2, 'gizemli', '[]', null::integer),
  ('Cesur Görevler', 'Bir şarkı boyunca çok yakın dans edin; aranızda boşluk kalmasın.', null::text, 2, 'romantik', '[]', 240),
  ('Cesur Görevler', 'Partnerinin kulağına bu gece ondan en çok ne istediğini fısılda.', null::text, 2, 'cesur', '[]', 30),
  ('Günlük Görevler', 'Sırayla 90 saniye boyunca en ateşli anınızı anlatın.', null::text, 2, 'flortoz', '[]', 90),
  ('Cesur Görevler', 'Partnerinin gözlerini bağla ve onu küçük öpücüklerle şaşırt.', null::text, 2, 'cesur', '[]', 60),
  ('Uzaktan Görevler', 'Sesini alçaltarak partnerine bir dakikalık flörtöz bir sesli mesaj bırak.', null::text, 2, 'flortoz', '[]', null::integer),
  ('Cesur Görevler', 'Işıkları kapatın ve üç dakika boyunca yalnızca fısıldayarak konuşun.', null::text, 2, 'gizemli', '[]', 180),
  ('Cesur Görevler', 'Partnerine beş dakikalık bir sırt masajı yap; temposunu o seçsin.', null::text, 3, 'romantik', '[]', 300),
  ('Cesur Görevler', 'Partnerine bu gece onu neyin beklediğini anlatan cesur bir mesaj yaz ve akşama kadar göndermeyi bekle.', null::text, 3, 'cesur', '[]', null::integer),
  ('Cesur Görevler', 'Bir dakika boyunca tek kelime etmeden, yalnızca bakış ve dokunuşla "seni istiyorum" de.', null::text, 3, 'cesur', '[]', 60),
  ('Cesur Görevler', 'Partnerin bir şarkı seçsin; sen de yalnızca onun için dans et.', null::text, 3, 'flortoz', '[]', 240),
  ('Cesur Görevler', 'Birbirinize tek kelimelik bir "bu gece" dileği fısıldayın ve gerçekleştirmeye çalışın.', null::text, 3, 'gizemli', '[]', null::integer),
  ('Cesur Görevler', 'Partnerinin gözlerini bağla; iki dakika boyunca öpücüklerini nereye kondurduğunu tahmin etsin.', null::text, 3, 'cesur', '[]', 120),
  ('Cesur Görevler', 'Rol oyunu: bir otel barında ilk kez tanışan iki yabancı olun.', null::text, 3, 'gizemli', '[]', 300),
  ('Cesur Görevler', 'Partnerine bir "evet kuponu" yaz: sınırlarınız içinde tek bir dileğini kabul edeceksin.', null::text, 3, 'cesur', '[]', null::integer)
) as v(category, text, kind, level, mood, options, timer_seconds)
join public.games g on g.slug = 'challenges'
join public.categories c on c.game_id = g.id and c.name = v.category;

-- ─────────────────────────────────────────────────────────────
-- Sorular · Gizli Sorular (48)
-- ─────────────────────────────────────────────────────────────
insert into public.questions (category_id, text, kind, level, mood, options, timer_seconds)
select c.id, v.text, v.kind, v.level::smallint, v.mood, v.options::jsonb, v.timer_seconds
from (values
  ('Derin Sorular', 'İlişkimizde seni en çok şaşırtan şey ne oldu?', null::text, 0, 'romantik', '[]', null::integer),
  ('İtiraflar', 'Benimle ilgili hiç kimseye anlatmadığın tatlı bir anı var mı?', null::text, 0, 'romantik', '[]', null::integer),
  ('Derin Sorular', 'Benim için "işte o kişi" dediğin an hangisiydi?', null::text, 0, 'romantik', '[]', null::integer),
  ('Derin Sorular', 'Birlikte yaşlandığımızı hayal ettiğin bir sahneyi anlat.', null::text, 0, 'romantik', '[]', null::integer),
  ('İtiraflar', 'Beni ilk kez gerçekten özlediğin an neydi?', null::text, 0, 'romantik', '[]', null::integer),
  ('İtiraflar', 'Hakkımda yanlış tahmin ettiğin ilk şey neydi?', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Derin Sorular', 'Yanımda kendini en güvende hissettiğin an hangisiydi?', null::text, 0, 'romantik', '[]', null::integer),
  ('Derin Sorular', 'Birlikte değiştirmek istediğin tek bir alışkanlığımız ne?', null::text, 0, 'karisik', '[]', null::integer),
  ('Derin Sorular', 'Beni bir renkle anlatsan hangisi olurdu ve neden?', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Derin Sorular', 'Hikâyemiz bir film olsa adı ne olurdu?', null::text, 0, 'eglenceli', '[]', null::integer),
  ('İtiraflar', 'Ben uyurken beni izlerken aklından geçen ama söylemediğin bir düşünce var mı?', null::text, 0, 'gizemli', '[]', null::integer),
  ('İtiraflar', 'İlk buluşmamızda ayrılırken aslında ne yapmak istedin?', null::text, 0, 'flortoz', '[]', null::integer),
  ('İtiraflar', 'Bana hiç söyleyemediğin bir teşekkür var mı?', null::text, 0, 'romantik', '[]', null::integer),
  ('Derin Sorular', 'Sence ilişkimizin en güçlü yanı ne?', null::text, 0, 'romantik', '[]', null::integer),
  ('Derin Sorular', 'Benden öğrendiğin en değerli şey ne?', null::text, 0, 'romantik', '[]', null::integer),
  ('Derin Sorular', 'On yıl sonra sıradan bir akşamımızı nasıl hayal ediyorsun?', null::text, 0, 'romantik', '[]', null::integer),
  ('İtiraflar', 'Bir günlüğüne benim yerime geçsen ilk ne yapardın?', null::text, 0, 'eglenceli', '[]', null::integer),
  ('İtiraflar', 'Benden gerçekten hoşlandığını fark ettiğin o ilk an neydi?', null::text, 1, 'flortoz', '[]', null::integer),
  ('İtiraflar', 'Hakkımda kurduğun ama hiç anlatmadığın en romantik hayal ne?', null::text, 1, 'romantik', '[]', null::integer),
  ('İtiraflar', 'İlk öpüşmemizde aklından geçen tek kelime neydi?', null::text, 1, 'flortoz', '[]', null::integer),
  ('İtiraflar', 'Bende seni hâlâ utandıracak kadar çok hoşuna giden şey ne?', null::text, 1, 'flortoz', '[]', null::integer),
  ('İtiraflar', 'Yazıp da göndermekten vazgeçtiğin bir mesaj oldu mu? Ne yazıyordu?', null::text, 1, 'gizemli', '[]', null::integer),
  ('İtiraflar', 'Beni en çekici bulduğun an hangisiydi?', null::text, 1, 'flortoz', '[]', null::integer),
  ('Derin Sorular', 'Bir randevumuzu tekrar yaşayabilsen hangisini seçerdin, neyi farklı yapardın?', null::text, 1, 'romantik', '[]', null::integer),
  ('Derin Sorular', 'Yanımdayken seni en çok ne heyecanlandırıyor?', null::text, 1, 'flortoz', '[]', null::integer),
  ('İtiraflar', 'Kıskandığını hiç belli etmediğin bir an oldu mu?', null::text, 1, 'gizemli', '[]', null::integer),
  ('İtiraflar', 'Üzerimde görmeyi en çok istediğin kıyafet ne?', null::text, 1, 'flortoz', '[]', null::integer),
  ('Derin Sorular', 'Sana söylediğim ve hiç unutmadığın cümle hangisi?', null::text, 1, 'romantik', '[]', null::integer),
  ('İtiraflar', 'Bir mesajımı tekrar tekrar okuduğun oldu mu? Hangisiydi?', null::text, 1, 'romantik', '[]', null::integer),
  ('İtiraflar', 'Bana yapmayı çok isteyip henüz yapmadığın bir sürpriz var mı?', null::text, 1, 'romantik', '[]', null::integer),
  ('Derin Sorular', 'Uzaktayken beni düşündüğünde aklına gelen ilk görüntü ne?', null::text, 1, 'romantik', '[]', null::integer),
  ('Gece Sırları', 'Birlikte denemeyi hayal ettiğin ama söylemeye çekindiğin bir şey var mı?', null::text, 2, 'cesur', '[]', null::integer),
  ('Gece Sırları', 'Hangi dokunuşumu en çok özlüyorsun?', null::text, 2, 'flortoz', '[]', null::integer),
  ('Gece Sırları', 'Bir gece için tüm kuralları sen koysan ilk kural ne olurdu?', null::text, 2, 'cesur', '[]', null::integer),
  ('Gece Sırları', 'Beni en çok baştan çıkaran hareketim hangisi?', null::text, 2, 'flortoz', '[]', null::integer),
  ('Gece Sırları', 'Rüyanda beni gördüğün en ateşli anı tek bir ipucuyla anlat.', null::text, 2, 'gizemli', '[]', null::integer),
  ('İtiraflar', 'Hangi kokum ya da ses tonum sana karşı konulmaz geliyor?', null::text, 2, 'flortoz', '[]', null::integer),
  ('İtiraflar', 'Aklından geçen ama hiç söylemediğin en cesur iltifat ne?', null::text, 2, 'cesur', '[]', null::integer),
  ('Gece Sırları', 'Yanımdayken kendini tutmakta zorlandığın bir an oldu mu?', null::text, 2, 'cesur', '[]', null::integer),
  ('Derin Sorular', 'Birlikte bir gece kaçamağı yapsak nereye giderdik, ilk ne yapardık?', null::text, 2, 'romantik', '[]', null::integer),
  ('Gece Sırları', 'Sana göre en tutkulu anımız hangisiydi?', null::text, 2, 'cesur', '[]', null::integer),
  ('Gece Sırları', 'Benim gizli bir arzum olsa tahminin ne olurdu?', null::text, 3, 'gizemli', '[]', null::integer),
  ('Gece Sırları', 'Hayallerinden birini tek bir cümleyle anlat.', null::text, 3, 'cesur', '[]', null::integer),
  ('Gece Sırları', 'Bizim için mükemmel bir gecenin son sahnesi nasıl?', null::text, 3, 'romantik', '[]', null::integer),
  ('Gece Sırları', 'Bana karşı en cesur olduğun an hangisiydi? Şimdi olsa neyi farklı yapardın?', null::text, 3, 'cesur', '[]', null::integer),
  ('Gece Sırları', 'Birlikte, sınırlarımıza saygıyla keşfetmek istediğin yeni bir şey var mı? Nazikçe anlat.', null::text, 3, 'cesur', '[]', null::integer),
  ('Gece Sırları', 'Seni en çok neyin heyecanlandırdığını hiç tam olarak anlattın mı? Şimdi anlat.', null::text, 3, 'flortoz', '[]', null::integer),
  ('Gece Sırları', 'Bir gecelik rol oyununda sen hangi karakter olurdun, ben kim olurdum?', null::text, 3, 'gizemli', '[]', null::integer)
) as v(category, text, kind, level, mood, options, timer_seconds)
join public.games g on g.slug = 'secret_questions'
join public.categories c on c.game_id = g.id and c.name = v.category;

-- ─────────────────────────────────────────────────────────────
-- Sorular · Bu mu Şu mu (54)
-- ─────────────────────────────────────────────────────────────
insert into public.questions (category_id, text, kind, level, mood, options, timer_seconds)
select c.id, v.text, v.kind, v.level::smallint, v.mood, v.options::jsonb, v.timer_seconds
from (values
  ('Klasikler', 'Akşam planı', null::text, 0, 'eglenceli', '["Film gecesi", "Gece yolculuğu"]', null::integer),
  ('Klasikler', 'İçecek', null::text, 0, 'eglenceli', '["Kahve", "Çay"]', null::integer),
  ('Klasikler', 'Tatil', null::text, 0, 'eglenceli', '["Deniz", "Dağ"]', null::integer),
  ('Klasikler', 'Sen hangisisin?', null::text, 0, 'eglenceli', '["Sabah insanı", "Gece kuşu"]', null::integer),
  ('Klasikler', 'Akşam yemeği', null::text, 0, 'eglenceli', '["Pizza", "Sushi"]', null::integer),
  ('Klasikler', 'Hangisi?', null::text, 0, 'eglenceli', '["Kedi", "Köpek"]', null::integer),
  ('Klasikler', 'Mevsim', null::text, 0, 'eglenceli', '["Yaz", "Kış"]', null::integer),
  ('Klasikler', 'Hangisi?', null::text, 0, 'karisik', '["Kitap", "Dizi"]', null::integer),
  ('Klasikler', 'Randevu', null::text, 0, 'eglenceli', '["Sinema", "Konser"]', null::integer),
  ('Klasikler', 'Hangisi?', null::text, 0, 'eglenceli', '["Tatlı", "Tuzlu"]', null::integer),
  ('Klasikler', 'Cumartesi', null::text, 0, 'karisik', '["Ev partisi", "Baş başa akşam"]', null::integer),
  ('Klasikler', 'Hareket', null::text, 0, 'eglenceli', '["Yürüyüş", "Bisiklet"]', null::integer),
  ('Klasikler', 'Konaklama', null::text, 0, 'eglenceli', '["Kamp", "Otel"]', null::integer),
  ('Romantik', 'Işık', null::text, 0, 'romantik', '["Mum ışığı", "Şehir ışıkları"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 0, 'romantik', '["Fısıldamak", "Not yazmak"]', null::integer),
  ('Romantik', 'Yürürken', null::text, 0, 'romantik', '["El ele", "Kol kola"]', null::integer),
  ('Romantik', 'Kahvaltı', null::text, 0, 'romantik', '["Yatakta", "Dışarıda"]', null::integer),
  ('Klasikler', 'İletişim', null::text, 0, 'karisik', '["Mesaj", "Telefon"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 0, 'karisik', '["Sürpriz", "Plan"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 1, 'flortoz', '["Yavaş dans", "Oyunbaz takılma"]', null::integer),
  ('Romantik', 'Öpücük', null::text, 1, 'romantik', '["Alından", "Yanaktan"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 1, 'romantik', '["Gizli bir bakış", "Uzun bir sarılma"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 1, 'flortoz', '["Flörtöz mesaj", "Sesli mesaj"]', null::integer),
  ('Romantik', 'Koku', null::text, 1, 'flortoz', '["Parfüm", "Doğal koku"]', null::integer),
  ('Klasikler', 'Partnerinin hâli', null::text, 1, 'flortoz', '["Şık hâli", "Rahat hâli"]', null::integer),
  ('Romantik', 'Randevu', null::text, 1, 'romantik', '["Mumlu akşam yemeği", "Yıldızlı yürüyüş"]', null::integer),
  ('Romantik', 'İlk hamle', null::text, 1, 'flortoz', '["Benden", "Ondan"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 1, 'romantik', '["Aşk mektubu", "Aşk şarkısı"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 1, 'flortoz', '["Kulağa fısıltı", "Göz göze bakış"]', null::integer),
  ('Romantik', 'Öpücük zamanı', null::text, 1, 'romantik', '["Sabah öpücüğü", "Gece öpücüğü"]', null::integer),
  ('Klasikler', 'Kıskançlık', null::text, 1, 'karisik', '["Biraz tatlıdır", "Hiç gerek yok"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 1, 'romantik', '["Saç okşamak", "Sırt kaşımak"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 1, 'flortoz', '["Gizli randevu", "Sürpriz ziyaret"]', null::integer),
  ('Klasikler', 'Anı', null::text, 1, 'eglenceli', '["Selfie", "Polaroid"]', null::integer),
  ('Ateşli', 'Hangisi?', null::text, 1, 'flortoz', '["Köpük banyosu", "Sıcak duş"]', null::integer),
  ('Ateşli', 'Hangisi?', null::text, 2, 'cesur', '["Masaj yapmak", "Masaj yaptırmak"]', null::integer),
  ('Ateşli', 'Hangisi?', null::text, 2, 'gizemli', '["Gözler bağlı", "Gözler açık"]', null::integer),
  ('Ateşli', 'Işıklar', null::text, 2, 'cesur', '["Açık", "Kapalı"]', null::integer),
  ('Ateşli', 'Bu gece', null::text, 2, 'cesur', '["Lider olmak", "Takip etmek"]', null::integer),
  ('Ateşli', 'Kumaş', null::text, 2, 'flortoz', '["Dantel", "Saten"]', null::integer),
  ('Ateşli', 'Tempo', null::text, 2, 'cesur', '["Yavaş", "Hızlı"]', null::integer),
  ('Ateşli', 'Hangisi?', null::text, 2, 'gizemli', '["Fısıltı", "Sessizlik"]', null::integer),
  ('Romantik', 'Hangisi?', null::text, 2, 'cesur', '["Cesur fotoğraf", "Cesur mesaj"]', null::integer),
  ('Ateşli', 'Öpücük', null::text, 2, 'flortoz', '["Dudaktan", "Boyundan"]', null::integer),
  ('Ateşli', 'Yakınlaşma', null::text, 2, 'cesur', '["Sabah", "Gece yarısı"]', null::integer),
  ('Ateşli', 'Hangisi?', null::text, 2, 'gizemli', '["Rol yapmak", "Kendin olmak"]', null::integer),
  ('Ateşli', 'Kontrol', null::text, 3, 'cesur', '["Bende", "Onda"]', null::integer),
  ('Ateşli', 'Hangisi?', null::text, 3, 'cesur', '["Tutkulu", "Şefkatli"]', null::integer),
  ('Ateşli', 'Gece', null::text, 3, 'gizemli', '["Plansız", "Senaryolu"]', null::integer),
  ('Ateşli', 'Başlangıç', null::text, 3, 'cesur', '["Uzun bir ısınma", "Ani bir başlangıç"]', null::integer),
  ('Ateşli', 'Oda', null::text, 3, 'gizemli', '["Aynalı oda", "Karanlık oda"]', null::integer),
  ('Ateşli', 'Hangisi?', null::text, 3, 'flortoz', '["Fısıltılı gece", "Kahkahalı gece"]', null::integer),
  ('Ateşli', 'Ne kadar?', null::text, 3, 'cesur', '["Bütün gece", "Sabaha karşı"]', null::integer),
  ('Ateşli', 'Mekân', null::text, 3, 'cesur', '["Yatak odası", "Şöminenin önü"]', null::integer)
) as v(category, text, kind, level, mood, options, timer_seconds)
join public.games g on g.slug = 'this_or_that'
join public.categories c on c.game_id = g.id and c.name = v.category;

-- ─────────────────────────────────────────────────────────────
-- Sorular · Sohbet Oyunu (34)
-- ─────────────────────────────────────────────────────────────
insert into public.questions (category_id, text, kind, level, mood, options, timer_seconds)
select c.id, v.text, v.kind, v.level::smallint, v.mood, v.options::jsonb, v.timer_seconds
from (values
  ('Emoji Oyunları', 'Bana üç emoji ile bugününü anlat.', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Emoji Oyunları', 'Beni tek bir emojiyle anlat ve nedenini yaz.', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Emoji Oyunları', 'İlk buluşmamızı beş emojiyle anlat.', null::text, 0, 'romantik', '[]', null::integer),
  ('Emoji Oyunları', 'Birlikte izlediğimiz bir filmi emojilerle anlat; ben tahmin edeyim.', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Emoji Oyunları', 'Şu an nerede olmak istediğini emojilerle göster.', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Tatlı Mesajlar', 'Bugün seni gülümseten bir şeyin fotoğrafını gönder.', null::text, 0, 'romantik', '[]', null::integer),
  ('Emoji Oyunları', 'Bir sonraki randevumuz için üç emojilik bir ipucu ver.', null::text, 0, 'gizemli', '[]', null::integer),
  ('Tatlı Mesajlar', 'Bu haftaki ruh hâlini bir hava durumu raporu gibi anlat.', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Tatlı Mesajlar', 'En sevdiğin ortak anımızı tek bir cümleyle yaz.', null::text, 0, 'romantik', '[]', null::integer),
  ('Tatlı Mesajlar', 'Şu an dinlediğin şarkıyı bana gönder.', null::text, 0, 'karisik', '[]', null::integer),
  ('Tatlı Mesajlar', 'İlişkimizi bir film adıyla anlat.', null::text, 0, 'eglenceli', '[]', null::integer),
  ('Tatlı Mesajlar', 'Bugün benimle ilgili aklına gelen ilk şeyi yaz.', null::text, 0, 'romantik', '[]', null::integer),
  ('Tatlı Mesajlar', 'Bana sadece iltifatlardan oluşan bir mesaj yaz.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Tatlı Mesajlar', '"Seni en çok özlediğim an..." diye başlayan bir mesaj gönder.', null::text, 1, 'romantik', '[]', null::integer),
  ('Flört Mesajları', 'Beni üç kelimeyle anlat; üçü de flörtöz olsun.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Flört Mesajları', 'Bu akşam için bana flörtöz bir ipucu gönder.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Flört Mesajları', 'Bana gizemli bir selfie gönder: sadece gözlerin görünsün.', null::text, 1, 'gizemli', '[]', null::integer),
  ('Tatlı Mesajlar', 'Tatlı bir sesli mesajla bana iyi geceler de.', null::text, 1, 'romantik', '[]', null::integer),
  ('Emoji Oyunları', 'Seni benimle en çok neyin etkilediğini emojilerle anlat.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Flört Mesajları', '"Şu an yanımda olsaydın..." cümlesini tamamla.', null::text, 1, 'flortoz', '[]', null::integer),
  ('Tatlı Mesajlar', 'En sevdiğin fotoğrafımı gönder ve nedenini yaz.', null::text, 1, 'romantik', '[]', null::integer),
  ('Tatlı Mesajlar', 'Bir aşk şarkısından bize en çok yakışan tek bir satır gönder.', null::text, 1, 'romantik', '[]', null::integer),
  ('Flört Mesajları', 'Bu gece için bana üç kelimelik bir davet yaz.', null::text, 2, 'cesur', '[]', null::integer),
  ('Flört Mesajları', 'Bana fısıltıyla okunması gereken bir mesaj yaz.', null::text, 2, 'gizemli', '[]', null::integer),
  ('Emoji Oyunları', 'Bende en çekici bulduğun şeyi yalnızca emojilerle anlat.', null::text, 2, 'flortoz', '[]', null::integer),
  ('Flört Mesajları', '"Seni düşündüğümde..." diye başlayan cesur bir mesaj yaz.', null::text, 2, 'cesur', '[]', null::integer),
  ('Flört Mesajları', 'Ses tonunu alçaltarak bana kısa bir sesli mesaj gönder.', null::text, 2, 'flortoz', '[]', null::integer),
  ('Flört Mesajları', 'Bu akşamki planını bana sadece ipuçlarıyla anlat.', null::text, 2, 'gizemli', '[]', null::integer),
  ('Flört Mesajları', 'En cesur bakışını bir fotoğrafla gönder.', null::text, 2, 'cesur', '[]', null::integer),
  ('Emoji Oyunları', 'Bu gece beni neyin beklediğini tek bir emojiyle söyle ve beni meraklandır.', null::text, 3, 'gizemli', '[]', null::integer),
  ('Flört Mesajları', 'Bana hiç söylemediğin bir arzunu tek bir ipucuyla anlat.', null::text, 3, 'cesur', '[]', null::integer),
  ('Flört Mesajları', '"Bu gece kurallar şöyle..." diye başlayan bir mesaj yaz.', null::text, 3, 'cesur', '[]', null::integer),
  ('Flört Mesajları', 'Bana bir "evet kuponu" gönder: sınırlarımız içinde tek bir dileğimi kabul ediyorsun.', null::text, 3, 'flortoz', '[]', null::integer),
  ('Flört Mesajları', 'Mükemmel gecemizin son sahnesini tek bir cümleyle yaz.', null::text, 3, 'romantik', '[]', null::integer)
) as v(category, text, kind, level, mood, options, timer_seconds)
join public.games g on g.slug = 'chat_game'
join public.categories c on c.game_id = g.id and c.name = v.category;

-- ─────────────────────────────────────────────────────────────
-- Çift Hikâyeleri
-- ─────────────────────────────────────────────────────────────
insert into public.stories (title, description, level, cover_color, is_premium, sort) values
  ('Gece Yarısı Kaçamağı', 'Şehir uyurken otelin çatısından gelen bir şarkı sizi çağırıyor. Bu gece nereye gideceğine birlikte karar verin.', 1, '#2A1530', false, 1),
  ('Kapadokya''da Gün Doğumu', 'Bir mağara otelde şafak vakti. Gökyüzü balonlarla dolarken sizin hikâyeniz başlıyor.', 2, '#5A1A2E', true, 2)
;

insert into public.story_scenes (story_id, chapter, title, body, art_note, glow, is_start, is_ending, xp, sort)
select s.id, v.chapter, v.title, v.body, v.art_note, v.glow, v.is_start, v.is_ending, v.xp, v.sort
from (values
  ('Gece Yarısı Kaçamağı', 'BÖLÜM 1', 'Çatıdaki Müzik', 'Gece yarısını çoktan geçti. Otelin çatısından yumuşak bir müzik sesi süzülüyor, koridorun ucundaki kapı aralık duruyor. Elini tutuyor ve fısıldıyor: "Duyuyor musun?"', 'çatı kapısı aralık, içeri sızan sıcak ışık, camda yağmur damlaları', 'rgba(242,194,123,.35)', true, false, 0, 1),
  ('Gece Yarısı Kaçamağı', 'BÖLÜM 2', 'Boş Pist', 'Çatıda kimse yok. Sadece ışık zincirleri, eski bir pikap ve yavaş bir şarkı. Şehrin ışıkları ayaklarınızın altında sanki yalnızca sizin için yanıyor.', 'çatı barı, ışık zincirleri, boş dans pisti', 'rgba(231,104,138,.4)', false, false, 0, 2),
  ('Gece Yarısı Kaçamağı', 'BÖLÜM 2', 'Yağmurlu Sokak', 'Dışarıda ince bir yağmur başlamış. Sokak lambaları ıslak kaldırımlarda titriyor; ceketini omzuna bırakıp gülümsüyor. Gece, ikinizi de bir yere götürmek istiyor gibi.', 'yağmurlu sokak, ıslak kaldırımda lamba yansımaları, tek şemsiye', 'rgba(120,160,230,.35)', false, false, 0, 3),
  ('Gece Yarısı Kaçamağı', 'BÖLÜM 3', 'Yavaş Şarkı', 'Kollarını boynuna doluyor, ayakların pistte kendiliğinden hareket ediyor. Şarkı bitiyor ama ikiniz de durmuyorsunuz. Gökyüzünün kenarı hafifçe aydınlanmaya başlıyor.', 'iki silüet ağır ağır dans ediyor, arkada pikap ve şehir', 'rgba(231,104,138,.45)', false, false, 0, 4),
  ('Gece Yarısı Kaçamağı', 'BÖLÜM 3', 'Pikabın Başında', 'Plakları karıştırıyorsunuz ve eğlenceli, eski bir şarkı buluyorsunuz. Kahkahalar arasında dönüp duruyorsunuz; saçları yüzüne düşüyor, gözleri parlıyor.', 'plak yığını, pikabın iğnesi, kahkahayla dönen iki figür', 'rgba(242,194,123,.4)', false, false, 0, 5),
  ('Gece Yarısı Kaçamağı', 'BÖLÜM 3', 'Islak Kaldırımlar', 'Yağmurun altında el ele yürüyorsunuz, adımlarınız birbirine uyuyor. Bir köşede sabaha kadar açık bir kafenin ışığı yanıyor, yolun ilerisinde ise bir taksi yavaşlıyor.', 'yağmurda el ele yürüyen çift, uzakta kafe ışığı ve taksi farları', 'rgba(120,160,230,.4)', false, false, 0, 6),
  ('Gece Yarısı Kaçamağı', 'FİNAL', 'Şafakta Silüetler', 'Şehrin ışıkları birer birer sönerken güneş ufukta beliriyor. Onun omzuna yaslanıyorsun ve ikiniz de aynı şeyi düşünüyorsunuz: bu gece sonsuza kadar sizin.', 'şehir silüeti, şafak, çatıda iki silüet', 'rgba(168,139,240,.4)', false, true, 250, 7),
  ('Gece Yarısı Kaçamağı', 'FİNAL', 'Eve Dönüş Taksisi', 'Taksinin arka koltuğunda başını omzuna koyuyor. Camdan akan ışıklar yüzünüzde dans ederken şoför radyoyu açıyor; çatıda çalan şarkı bu. Birbirinize bakıp gülümsüyorsunuz.', 'taksinin arka koltuğu, camda şehir ışıkları, yaslanmış iki baş', 'rgba(242,194,123,.35)', false, true, 180, 8),
  ('Gece Yarısı Kaçamağı', 'FİNAL', 'Sabah Dörtte Kafe', 'Saat dördü gösteriyor, kafede sizden başka kimse yok. İki sıcak fincan, buğulu bir cam ve bitmeyen bir sohbet. Güneş doğduğunda hâlâ aynı masada, el eledesiniz.', 'boş kafe, buğulu cam, masada iki fincan ve kenetlenmiş eller', 'rgba(127,209,174,.3)', false, true, 200, 9),
  ('Kapadokya''da Gün Doğumu', 'BÖLÜM 1', 'Mağara Otel', 'Saat daha dört buçuk. Taş duvarlı odanın penceresinden vadiye mavi bir ışık süzülüyor, dışarıda balonların ateşi yanmaya başlamış. Uykulu bir sesle soruyor: "Kalkıyor muyuz, yoksa kalıyor muyuz?"', 'mağara otel odası, taş duvarlar, pencerede ilk balon ateşleri', 'rgba(242,194,123,.35)', true, false, 0, 1),
  ('Kapadokya''da Gün Doğumu', 'BÖLÜM 2', 'Sepetin İçinde', 'Balon yavaşça yükseliyor, peri bacaları küçülüyor. Etrafınızda yüzlerce renkli balon, ufukta pembe bir çizgi. Elini sıkıca tutuyor; yükseklikten mi, andan mı bilinmez.', 'balon sepeti, etrafta renkli balonlar, aşağıda peri bacaları', 'rgba(231,104,138,.4)', false, false, 0, 2),
  ('Kapadokya''da Gün Doğumu', 'BÖLÜM 2', 'Taş Duvarlar Arasında', 'Yorganın altında kalıyorsunuz. Balonlar pencerenin önünden bir bir geçiyor; odanın sessizliğinde yalnızca nefesleriniz ve uzaktan gelen brülör sesi var.', 'yorgan, pencerede geçen balonlar, loş taş oda', 'rgba(168,139,240,.35)', false, false, 0, 3),
  ('Kapadokya''da Gün Doğumu', 'BÖLÜM 3', 'Bulutların Üstünde', 'Pilot arkasını döndüğü anda seni kendine çekiyor. Güneş tam o sırada doğuyor ve sepetin içi altın rengine boyanıyor. Kalbin hiç bu kadar yüksekte atmamıştı.', 'sepette öpüşen iki silüet, arkalarında doğan güneş', 'rgba(242,194,123,.45)', false, false, 0, 4),
  ('Kapadokya''da Gün Doğumu', 'BÖLÜM 3', 'Kadrajdaki Sen', 'Fotoğraf makinesini kaldırıyorsun ama kadraja manzara yerine o giriyor. Rüzgâr saçlarını dağıtıyor, sana bakıp gülüyor. Bu karenin hayatının en sevdiğin fotoğrafı olacağını biliyorsun.', 'fotoğraf makinesi vizörü, kadrajda gülen partner, arkada balonlar', 'rgba(231,104,138,.35)', false, false, 0, 5),
  ('Kapadokya''da Gün Doğumu', 'BÖLÜM 3', 'Teras', 'Battaniyeye sarılıp terasa çıkıyorsunuz. Vadide yüzlerce balon süzülüyor, elinizdeki sıcak içeceklerden buhar yükseliyor. Omzuna yaslanıp "Burada da gökyüzündeyiz" diyor.', 'otel terası, battaniyeye sarılı iki kişi, vadide balonlar', 'rgba(127,209,174,.3)', false, false, 0, 6),
  ('Kapadokya''da Gün Doğumu', 'FİNAL', 'Gökyüzüne Verilen Söz', 'Bu anı bir söze dönüştürüyorsunuz: her yıl, bir gün doğumunu birlikte izlemek. Balon yavaşça alçalırken bu sözün gökyüzünde asılı kaldığını hissediyorsunuz.', 'doğan güneşin önünde el ele iki silüet, alçalan balon', 'rgba(242,194,123,.4)', false, true, 250, 7),
  ('Kapadokya''da Gün Doğumu', 'FİNAL', 'Tarlaya İniş', 'Balon bir tarlaya sarsılarak iniyor; ikiniz de kahkahalar içinde birbirinize sarılıyorsunuz. Mürettebat kutlama yaparken siz hâlâ gülüyorsunuz. En güzel anılar biraz sarsıntılı olanlarmış.', 'tarlaya inmiş balon, sarılarak gülen çift', 'rgba(231,104,138,.35)', false, true, 180, 8),
  ('Kapadokya''da Gün Doğumu', 'FİNAL', 'Güvercinlik Vadisi', 'Vadide yürürken yollar sizi tenha bir patikaya çıkarıyor. Kayaların arasında oturup güneşi izliyorsunuz; sessizlik, bin kelimeden fazlasını anlatıyor.', 'kayalık patika, tepede oturan iki kişi, sabah güneşi', 'rgba(168,139,240,.4)', false, true, 200, 9),
  ('Kapadokya''da Gün Doğumu', 'FİNAL', 'Sabahın Sıcaklığı', 'Battaniyenin altında, balonların son gölgeleri odadan çekilirken birbirinize daha çok sokuluyorsunuz. Bugünün hiçbir planı yok; sadece siz varsınız ve bu fazlasıyla yeterli.', 'yorgan altında sarılmış iki figür, sabah güneşi taş duvarda', 'rgba(242,194,123,.3)', false, true, 220, 10)
) as v(story_title, chapter, title, body, art_note, glow, is_start, is_ending, xp, sort)
join public.stories s on s.title = v.story_title;

insert into public.story_choices (scene_id, text, next_scene_id, sort)
select src.id, v.text, dst.id, v.sort
from (values
  ('Gece Yarısı Kaçamağı', 'Çatıdaki Müzik', 'Yukarı çık', 'Boş Pist', 1),
  ('Gece Yarısı Kaçamağı', 'Çatıdaki Müzik', 'Dışarıda kal', 'Yağmurlu Sokak', 2),
  ('Gece Yarısı Kaçamağı', 'Boş Pist', 'Dans et', 'Yavaş Şarkı', 1),
  ('Gece Yarısı Kaçamağı', 'Boş Pist', 'Şarkıyı değiştir', 'Pikabın Başında', 2),
  ('Gece Yarısı Kaçamağı', 'Yağmurlu Sokak', 'Yağmurda yürü', 'Islak Kaldırımlar', 1),
  ('Gece Yarısı Kaçamağı', 'Yağmurlu Sokak', 'Otele dön, çatıya çık', 'Boş Pist', 2),
  ('Gece Yarısı Kaçamağı', 'Yavaş Şarkı', 'Gün doğumunu bekle', 'Şafakta Silüetler', 1),
  ('Gece Yarısı Kaçamağı', 'Yavaş Şarkı', 'Aşağı in, taksi çağır', 'Eve Dönüş Taksisi', 2),
  ('Gece Yarısı Kaçamağı', 'Pikabın Başında', 'Güneşin doğuşunu izle', 'Şafakta Silüetler', 1),
  ('Gece Yarısı Kaçamağı', 'Pikabın Başında', 'Gece bitmesin, kafeye git', 'Sabah Dörtte Kafe', 2),
  ('Gece Yarısı Kaçamağı', 'Islak Kaldırımlar', 'Açık kafeye gir', 'Sabah Dörtte Kafe', 1),
  ('Gece Yarısı Kaçamağı', 'Islak Kaldırımlar', 'Taksiye el salla', 'Eve Dönüş Taksisi', 2),
  ('Kapadokya''da Gün Doğumu', 'Mağara Otel', 'Balona bin', 'Sepetin İçinde', 1),
  ('Kapadokya''da Gün Doğumu', 'Mağara Otel', 'Yataktan çıkma', 'Taş Duvarlar Arasında', 2),
  ('Kapadokya''da Gün Doğumu', 'Sepetin İçinde', 'Pilot bakmıyorken onu öp', 'Bulutların Üstünde', 1),
  ('Kapadokya''da Gün Doğumu', 'Sepetin İçinde', 'Fotoğraf makinesini çıkar', 'Kadrajdaki Sen', 2),
  ('Kapadokya''da Gün Doğumu', 'Taş Duvarlar Arasında', 'Battaniyeyle terasa çık', 'Teras', 1),
  ('Kapadokya''da Gün Doğumu', 'Taş Duvarlar Arasında', 'Yorganın altında kal', 'Sabahın Sıcaklığı', 2),
  ('Kapadokya''da Gün Doğumu', 'Bulutların Üstünde', 'Bu anı bir söze dönüştür', 'Gökyüzüne Verilen Söz', 1),
  ('Kapadokya''da Gün Doğumu', 'Bulutların Üstünde', 'İnişe hazırlan', 'Tarlaya İniş', 2),
  ('Kapadokya''da Gün Doğumu', 'Kadrajdaki Sen', 'Fotoğrafı bir notla ona gönder', 'Gökyüzüne Verilen Söz', 1),
  ('Kapadokya''da Gün Doğumu', 'Kadrajdaki Sen', 'İnişten sonra vadiye yürü', 'Güvercinlik Vadisi', 2),
  ('Kapadokya''da Gün Doğumu', 'Teras', 'Vadiye inip yürüyüşe çık', 'Güvercinlik Vadisi', 1),
  ('Kapadokya''da Gün Doğumu', 'Teras', 'Odaya dön, sıcağa sokul', 'Sabahın Sıcaklığı', 2)
) as v(story_title, from_scene, text, to_scene, sort)
join public.stories s on s.title = v.story_title
join public.story_scenes src on src.story_id = s.id and src.title = v.from_scene
join public.story_scenes dst on dst.story_id = s.id and dst.title = v.to_scene;

-- ─────────────────────────────────────────────────────────────
-- Rozetler
-- ─────────────────────────────────────────────────────────────
insert into public.achievements (code, name, description, icon, target, sort) values
  ('first_game', 'İlk Oyun', 'Birlikte ilk oyununuzu tamamladınız.', 'favorite', 1, 1),
  ('connected', 'İlk Bağ', 'Partnerinizle Nocta''da bağlandınız.', 'link', 1, 2),
  ('games_30', 'Birlikte 30 Oyun', 'Birlikte 30 oyun tamamladınız.', 'emoji_events', 30, 3),
  ('challenges_10', '10 Görev', '10 çift görevini birlikte tamamladınız.', 'local_fire_department', 10, 4),
  ('questions_100', '100 Soru', 'Birlikte 100 soruyu cevapladınız.', 'chat', 100, 5),
  ('midnight_players', 'Gece Yarısı Oyuncuları', 'Gece yarısından sonra 5 oyun oynadınız.', 'dark_mode', 5, 6),
  ('perfect_match', 'Mükemmel Eşleşme', 'Bir oyunda tüm cevaplarınız birebir eşleşti.', 'auto_awesome', 1, 7),
  ('story_finishers', 'Hikâye Avcıları', 'Bir çift hikâyesini sonuna kadar birlikte oynadınız.', 'movie', 1, 8),
  ('streak_30', '30 Günlük Seri', '30 gün boyunca aralıksız birlikte oynadınız.', 'calendar_month', 30, 9),
  ('first_photo', 'İlk Kare', 'Sohbette ilk fotoğrafınızı paylaştınız.', 'photo_camera', 1, 10)
;

commit;
