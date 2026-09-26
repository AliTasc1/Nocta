-- Nocta · Emojilerle Anlat + Kart Seç başlangıç içeriği
insert into public.games (slug, engine, name, description, icon, color, duration_label, rounds, is_premium, sort) values
 ('emoji', 'emoji', 'Emojilerle Anlat', 'Doğru emojiyi bul! İkiniz de kendi ekranınızdan seçin; doğruysa kutlama, yanlışsa…', 'emoji_emotions', '#5A1A2E', '5 dk · Tümü', 10, false, 10),
 ('cards', 'cards', 'Kart Seç', 'Her soruya bir kart seçin. Aynı kartı mı seçeceksiniz?', 'style', '#2A1530', '6 dk · Tümü', 8, false, 11);

insert into public.categories (game_id, name, description, icon, color, is_premium, sort)
select g.id, v.name, v.descr, v.icon, v.color, v.prem, v.sort
from (values
  ('emoji', 'Aşk Emojileri', 'Romantik anları emojilerle bul.', 'favorite', '#5A1A2E', false, 1),
  ('emoji', 'Eğlenceli Emojiler', 'Gündelik hayat, filmler ve şarkılar.', 'celebration', '#3A1740', false, 2),
  ('emoji', 'Ateşli Emojiler', 'Biraz daha cesur emoji bulmacaları.', 'local_fire_department', '#6B1E38', true, 3),
  ('cards', 'Ruh Hâli Kartları', 'Bu gece hangi kart sizi anlatıyor?', 'style', '#2A1530', false, 1),
  ('cards', 'Randevu Kartları', 'Hayalinizdeki buluşmayı kartlarla seçin.', 'local_bar', '#3A1740', false, 2)
) as v(slug, name, descr, icon, color, prem, sort)
join public.games g on g.slug = v.slug;

insert into public.questions (category_id, text, level, mood, options, correct_index)
select c.id, v.text, v.lvl, v.mood, v.opts::jsonb, v.ci
from (values
 ('Aşk Emojileri','Hangisi "romantik akşam yemeği"?',0,'romantik','["🍕🎮","🕯️🍷","🍿📺","🏃‍♀️🥤"]',1),
 ('Aşk Emojileri','Hangisi "ilk öpücük"?',0,'romantik','["💋✨","🍔🍟","🚗💨","📚✏️"]',0),
 ('Aşk Emojileri','Hangisi "yağmurda yürüyüş"?',0,'romantik','["☀️🏖️","🌧️☂️👫","❄️⛷️","🔥🏕️"]',1),
 ('Aşk Emojileri','Hangisi "kalbim kırıldı"?',0,'romantik','["💔😢","😂🎉","😴💤","🤑💰"]',0),
 ('Aşk Emojileri','Hangisi "evlenme teklifi"?',0,'romantik','["🎂🎈","💍🧎‍♂️","🎓📜","🏆🥇"]',1),
 ('Aşk Emojileri','Hangisi "balayı"?',1,'romantik','["🏢💼","✈️🏝️💑","🏥💊","🚌🎒"]',1),
 ('Aşk Emojileri','Hangisi "sabah kahvaltısı yatakta"?',1,'flortoz','["🛏️🥐☕","🍝🍷","🍦🌙","🥗🏋️"]',0),
 ('Eğlenceli Emojiler','Hangi film: "Titanic"?',0,'eglenceli','["🦁👑","🚢🧊💔","🕷️🧑","🦖🏝️"]',1),
 ('Eğlenceli Emojiler','Hangi film: "Aslan Kral"?',0,'eglenceli','["🦁👑","🐟🔍","🧊❄️👸","🐼🥋"]',0),
 ('Eğlenceli Emojiler','Hangisi "pazar sabahı"?',0,'eglenceli','["⏰😫💼","😴☕📰","🎉🍾","🏃‍♂️💦"]',1),
 ('Eğlenceli Emojiler','Hangisi "tatile çıkıyoruz"?',0,'eglenceli','["🧳✈️🌴","📚📝","🧹🧽","💻📊"]',0),
 ('Eğlenceli Emojiler','Hangi film: "Buz Devri"?',0,'eglenceli','["🚀🌌","🐿️🌰🧊","🧙‍♂️💍","👻🔫"]',1),
 ('Eğlenceli Emojiler','Hangisi "film gecesi"?',0,'eglenceli','["🍿🎬🛋️","🏔️🥾","🎤🎶","🛒🥦"]',0),
 ('Eğlenceli Emojiler','Hangisi "kavga edip barışmak"?',1,'eglenceli','["😠➡️🤗","😴➡️😴","🍕➡️🍔","🌞➡️🌙"]',0),
 ('Ateşli Emojiler','Hangisi "tutkulu bir gece"?',2,'cesur','["🔥🌙💋","🧸🍼","📺😴","🧾💸"]',0),
 ('Ateşli Emojiler','Hangisi "baştan çıkarıcı bakış"?',2,'flortoz','["😏👀","🤓📖","🥱💤","😬🦷"]',0),
 ('Ateşli Emojiler','Hangisi "sürpriz kaçamak"?',2,'cesur','["🏨🗝️🍾","🏫📐","🏦💳","🧺🧼"]',0)
) as v(cat, text, lvl, mood, opts, ci)
join public.categories c on c.name = v.cat
join public.games g on g.id = c.game_id and g.slug = 'emoji';

-- Kartlar: seçenekler kart başlıklarıdır; görseller admin panelinden eklenir (media dizisi)
insert into public.questions (category_id, text, level, mood, options)
select c.id, v.text, v.lvl, v.mood, v.opts::jsonb
from (values
 ('Ruh Hâli Kartları','Bu gece hangi kart seni anlatıyor?',0,'karisik','["Sakin deniz","Havai fişek","Şömine başı","Yıldızlı gökyüzü"]'),
 ('Ruh Hâli Kartları','İlişkimizi en iyi hangi kart anlatır?',0,'romantik','["Serüven","Sıcak yuva","Dans","Sonsuz yol"]'),
 ('Ruh Hâli Kartları','Bugün partnerine hangi kartı verirdin?',0,'romantik','["Sarılma","Kahkaha","Sürpriz","Dinlenme"]'),
 ('Ruh Hâli Kartları','Hangi renk bu geceyi anlatıyor?',0,'gizemli','["Gece mavisi","Şarap kırmızısı","Altın","Gül pembesi"]'),
 ('Ruh Hâli Kartları','Birlikte hangi manzarada olmak isterdin?',1,'romantik','["Karlı dağ","Tropik ada","Şehir ışıkları","Lavanta tarlası"]'),
 ('Randevu Kartları','Hayalindeki randevu hangisi?',0,'romantik','["Piknik","Mum ışığında yemek","Konser","Sinema"]'),
 ('Randevu Kartları','Randevu sonrası ne yapalım?',1,'flortoz','["Sahilde yürüyüş","Evde film","Gece kulübü","Çatıda şarap"]'),
 ('Randevu Kartları','Hangi hafta sonu kaçamağı?',0,'romantik','["Bağ evi","Kayak","Termal otel","Kamp"]')
) as v(cat, text, lvl, mood, opts)
join public.categories c on c.name = v.cat
join public.games g on g.id = c.game_id and g.slug = 'cards';
