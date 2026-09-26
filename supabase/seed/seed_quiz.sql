-- Nocta · Çift Testleri başlangıç içeriği (seed.sql'den sonra çalıştırın)
insert into public.games (slug, engine, name, description, icon, color, duration_label, rounds, is_premium, sort)
values ('quiz', 'quiz', 'Çift Testleri', 'Dört seçenekli testler: aynı cevabı mı vereceksiniz, yoksa kim daha çok bilecek?', 'quiz', '#3A1740', '6 dk · Tümü', 10, false, 9);

insert into public.categories (game_id, name, description, icon, color, is_premium, sort)
select g.id, v.name, v.descr, v.icon, v.color, v.prem, v.sort from public.games g,
 (values ('Uyum Testi', 'İkiniz de aynı cevabı verebilecek misiniz?', 'favorite', '#5A1A2E', false, 1),
         ('Aşk Bilgi Yarışması', 'Aşk ve ilişkiler üzerine eğlenceli bilgi soruları.', 'emoji_objects', '#3A1740', false, 2),
         ('Ateşli Test', 'Biraz daha cesur sorular.', 'local_fire_department', '#6B1E38', true, 3)) as v(name, descr, icon, color, prem, sort)
where g.slug = 'quiz';

insert into public.questions (category_id, text, level, mood, options, correct_index)
select c.id, v.text, v.lvl, v.mood, v.opts::jsonb, v.ci from public.categories c
join (values
 ('Uyum Testi','İdeal bir cumartesi gecesi hangisi?',0,'romantik','["Evde film ve battaniye","Şehirde yemek","Arkadaşlarla buluşma","Plansız bir yolculuk"]',null),
 ('Uyum Testi','Tartıştıktan sonra ilk ne yaparsın?',0,'karisik','["Hemen konuşurum","Biraz yalnız kalırım","Sarılırım","Espriyle yumuşatırım"]',null),
 ('Uyum Testi','Hayalindeki tatil nerede?',0,'romantik','["Sahil kasabası","Kar yağan bir dağ evi","Kalabalık bir metropol","Doğada kamp"]',null),
 ('Uyum Testi','Sevgini en çok nasıl gösterirsin?',0,'romantik','["Sözlerle","Dokunarak","Küçük hediyelerle","Birlikte zaman geçirerek"]',null),
 ('Uyum Testi','Sabah insanı mısın, gece mi?',0,'eglenceli','["Tam bir sabahçı","Gece kuşu","Duruma göre","Öğlene kadar uykucu"]',null),
 ('Uyum Testi','Bir ilişkide en önemli şey?',0,'romantik','["Güven","Kahkaha","Tutku","Saygı"]',null),
 ('Uyum Testi','Birlikte yeni bir hobi seçsek?',0,'eglenceli','["Dans kursu","Yemek yapmak","Seyahat","Oyun gecesi"]',null),
 ('Uyum Testi','En romantik jest hangisi?',1,'flortoz','["Sürpriz akşam yemeği","El yazısı mektup","Gece yarısı mesajı","Uzun bir sarılma"]',null),
 ('Uyum Testi','İlk buluşma için en iyi yer?',1,'flortoz','["Sessiz bir kafe","Gün batımında yürüyüş","Konser","Evde yemek"]',null),
 ('Uyum Testi','Partnerinde seni en çok ne çeker?',1,'flortoz','["Gülüşü","Bakışları","Sesi","Zekâsı"]',null),
 ('Aşk Bilgi Yarışması','Aşk tanrısı Eros, Roma mitolojisinde hangi adla bilinir?',0,'eglenceli','["Apollon","Cupid","Mars","Merkür"]',1),
 ('Aşk Bilgi Yarışması','Sevgililer Günü hangi tarihte kutlanır?',0,'eglenceli','["14 Şubat","14 Mart","1 Mayıs","21 Haziran"]',0),
 ('Aşk Bilgi Yarışması','Romeo ve Juliet''i kim yazdı?',0,'romantik','["Charles Dickens","William Shakespeare","Jane Austen","Victor Hugo"]',1),
 ('Aşk Bilgi Yarışması','"Leyla ile Mecnun" mesnevisini Türk edebiyatında kim yazmıştır?',0,'romantik','["Fuzuli","Yunus Emre","Nedim","Baki"]',0),
 ('Aşk Bilgi Yarışması','Sarılmak vücutta hangi hormonun salınımını artırır?',0,'romantik','["Adrenalin","Oksitosin","Kortizol","İnsülin"]',1),
 ('Aşk Bilgi Yarışması','Kırmızı gül genellikle neyi simgeler?',0,'romantik','["Dostluk","Kıskançlık","Aşk","Özür"]',2),
 ('Aşk Bilgi Yarışması','"Beş aşk dili" kavramını kim ortaya attı?',1,'karisik','["Gary Chapman","Sigmund Freud","Carl Jung","Esther Perel"]',0),
 ('Aşk Bilgi Yarışması','Evlilik yüzüğü geleneksel olarak hangi parmağa takılır?',0,'romantik','["İşaret parmağı","Orta parmak","Yüzük parmağı","Serçe parmak"]',2),
 ('Ateşli Test','Seni en çok ne heyecanlandırır?',2,'cesur','["Fısıltılar","Uzun bakışlar","Sürpriz dokunuşlar","Cesur mesajlar"]',null),
 ('Ateşli Test','Birlikte denemek istediğin şey?',2,'cesur','["Gece yarısı yüzmek","Rol yapma oyunu","Otel kaçamağı","Mum ışığında dans"]',null),
 ('Ateşli Test','En çekici kıyafet hangisi?',2,'flortoz','["Takım elbise","Salaş tişört","Deri ceket","Pijama"]',null),
 ('Ateşli Test','Mükemmel bir öpücük nerede olur?',3,'cesur','["Yağmur altında","Asansörde","Sahilde","Kapı önünde veda ederken"]',null)
) as v(cat, text, lvl, mood, opts, ci) on c.name = v.cat
join public.games g on g.id = c.game_id and g.slug = 'quiz';
