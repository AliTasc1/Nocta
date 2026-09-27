# -*- coding: utf-8 -*-
"""Nocta seed.sql üreticisi (geçici araç)."""
import json

import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed.sql")

def q(s):
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"

def j(v):
    return q(json.dumps(v, ensure_ascii=False))

# ─────────────────────────── Oyunlar ───────────────────────────
GAMES = [
    ("truth_dare", "Doğruluk mu Cesaret mi", "Klasik oyun, çiftlere özel. Sıra sende: doğruyu mu söyleyeceksin, yoksa cesaretini mi göstereceksin?", "local_fire_department", "#5A1A2E", "8 dk · Yumuşak–Vahşi", 20, False),
    ("would_you_rather", "Hangisini Seçerdin", "İki seçenek, tek karar. Bakalım aynı şeyi seçecek misiniz?", "call_split", "#3A1740", "5 dk · Yumuşak–Cesur", 10, False),
    ("know_me", "Beni Ne Kadar Tanıyorsun", "Partnerinin cevabını tahmin et; birbirinizi ne kadar tanıdığınızı birlikte görün.", "psychology", "#2A1530", "10 dk · Yumuşak–Flörtöz", 8, False),
    ("challenges", "Çift Görevleri", "Süreli mini görevlerle aranızdaki kıvılcımı büyütün. Göz göze, el ele, kulaktan kulağa.", "bolt", "#6B1E38", "6 dk · Flörtöz–Vahşi", 5, False),
    ("secret_questions", "Gizli Sorular", "Cevaplar gizlice yazılır, aynı anda açılır. Sırlarınızı paylaşmaya hazır mısınız?", "visibility_off", "#3A1740", "12 dk · Yumuşak–Vahşi", 6, False),
    ("this_or_that", "Bu mu Şu mu", "Hızlı seçimler, anlık eşleşmeler. Kaç kez aynı şeyi seçeceksiniz?", "swap_horiz", "#5A1A2E", "4 dk · Yumuşak–Cesur", 15, False),
    ("story", "Çift Hikâyesi", "Birlikte seçin, hikâyeyi birlikte yazın. Her karar sizi başka bir sona götürür.", "movie", "#2A1530", "15 dk · Flörtöz–Cesur", 1, False),
    ("chat_game", "Sohbet Oyunu", "Sohbetin içinde küçük görevler: emojiler, fısıltılar ve tatlı sürprizler.", "forum", "#6B1E38", "Sınırsız · Yumuşak–Vahşi", 1, False),
]

# (game, name, description, icon, color, premium)
CATS = [
    ("truth_dare", "Isınma Turu", "Buzları eritecek tatlı sorular ve masum cesaretler.", "wb_twilight", "#5A1A2E", False),
    ("truth_dare", "Tatlı Tehlike", "Flörtün dozunu biraz artıran sorular ve görevler.", "favorite", "#6B1E38", False),
    ("truth_dare", "Gece Yarısı", "Işıklar kısılınca sorulacak cesur sorular.", "dark_mode", "#3A1740", False),
    ("truth_dare", "Kırmızı Oda", "Özel paket: yalnızca en cesur çiftler için.", "local_fire_department", "#7A1F3D", True),

    ("would_you_rather", "Romantik İkilemler", "Kalbinizi zorlayacak tatlı seçimler.", "favorite", "#3A1740", False),
    ("would_you_rather", "Eğlenceli Seçimler", "Kahkaha garantili, hafif ikilemler.", "sentiment_very_satisfied", "#2A1530", False),
    ("would_you_rather", "Ateşli İkilemler", "Özel paket: cevabı düşündükçe yüzünüz kızaracak.", "whatshot", "#6B1E38", True),

    ("know_me", "Küçük Detaylar", "Günlük alışkanlıklar, sevdiği şeyler, küçük sırlar.", "search", "#2A1530", False),
    ("know_me", "Hayaller ve Anılar", "Birlikte geçen anlar ve gelecekten beklentiler.", "auto_awesome", "#3A1740", False),
    ("know_me", "Aşk Dili", "Onu neyin etkilediğini gerçekten biliyor musun?", "favorite", "#5A1A2E", False),

    ("challenges", "Günlük Görevler", "Aynı odadayken yapılacak kısa ve tatlı görevler.", "today", "#6B1E38", False),
    ("challenges", "Uzaktan Görevler", "Mesajla, sesle, fotoğrafla: uzaktayken bile yakın olun.", "send", "#3A1740", False),
    ("challenges", "Cesur Görevler", "Özel paket: sınırlarınızı birlikte, rızayla keşfedin.", "bolt", "#7A1F3D", True),

    ("secret_questions", "Derin Sorular", "İlişkinize dair daha önce hiç konuşmadığınız şeyler.", "psychology_alt", "#3A1740", False),
    ("secret_questions", "İtiraflar", "Söylemeye çekindiğin tatlı gerçekler.", "lock_open", "#2A1530", False),
    ("secret_questions", "Gece Sırları", "Özel paket: yalnızca ikinizin arasında kalacak cevaplar.", "visibility_off", "#6B1E38", True),

    ("this_or_that", "Klasikler", "Kahve mi çay mı? Hızlı ve eğlenceli seçimler.", "swap_horiz", "#5A1A2E", False),
    ("this_or_that", "Romantik", "Mum ışığı mı, şehir ışıkları mı?", "favorite", "#3A1740", False),
    ("this_or_that", "Ateşli", "Özel paket: seçimler ısınıyor.", "whatshot", "#6B1E38", True),

    ("story", "Hikâyeler", "Birlikte yazdığınız etkileşimli hikâyeler.", "movie", "#2A1530", False),

    ("chat_game", "Emoji Oyunları", "Kelimeler yerine emojilerle konuşun.", "mood", "#6B1E38", False),
    ("chat_game", "Tatlı Mesajlar", "Günün herhangi bir anına küçük bir gülümseme.", "chat_bubble", "#3A1740", False),
    ("chat_game", "Flört Mesajları", "Sohbeti biraz ısıtacak cesur mesaj görevleri.", "whatshot", "#5A1A2E", False),
]

# Sorular: (game, category, level, mood, text, kind, options, timer)
Q = []
def add(game, cat, lvl, mood, text, kind=None, options=None, timer=None):
    Q.append((game, cat, lvl, mood, text, kind, options or [], timer))

# ───────────── Doğruluk mu Cesaret mi ─────────────
G = "truth_dare"
ISI, TT, GY, KO = "Isınma Turu", "Tatlı Tehlike", "Gece Yarısı", "Kırmızı Oda"
for lvl, cat, mood, t in [
    (0, ISI, "romantik", "Beni ilk gördüğünde aklından geçen ilk düşünce neydi?"),
    (0, ISI, "romantik", "Bende en sevdiğin küçük alışkanlık hangisi?"),
    (0, ISI, "romantik", "Birlikte geçirdiğimiz en güzel gün hangisiydi ve neden?"),
    (0, ISI, "romantik", "Bana hiç söylemediğin ama hep söylemek istediğin bir iltifat var mı?"),
    (0, ISI, "eglenceli", "Beni tek bir şarkıyla anlatsan hangi şarkı olurdu?"),
    (0, ISI, "eglenceli", "İlişkimizde seni en çok güldüren an hangisi?"),
    (0, ISI, "eglenceli", "Beni arkadaşlarına ilk kez nasıl anlattın? Tam olarak ne dedin?"),
    (0, ISI, "karisik", "Benimle ilgili ilk fark ettiğin şey neydi?"),
    (0, ISI, "gizemli", "Hiç benim için gizlice bir sürpriz hazırlayıp sonra vazgeçtin mi?"),
    (0, ISI, "romantik", "Beni en çok özlediğin an hangisiydi?"),
    (0, TT, "romantik", "Birlikte gitmeyi en çok hayal ettiğin yer neresi?"),
    (0, TT, "romantik", "Partnerine seni en çok heyecanlandıran kişilik özelliğini söyle."),
    (0, ISI, "karisik", "İlk mesajlaşmamızda gerçekte ne hissetmiştin?"),
    (0, ISI, "eglenceli", "Benim yaptığım yemeklerden hangisini gizlice pek sevmiyorsun?"),
]:
    add(G, cat, lvl, mood, t, "truth")
for lvl, cat, mood, t in [
    (0, ISI, "flortoz", "Partnerine 30 saniye boyunca sadece mesajlarla iltifat et."),
    (0, ISI, "eglenceli", "Partnerinin en sevdiği şarkının nakaratını ona söyle ya da sesli mesaj olarak gönder."),
    (0, ISI, "romantik", "Partnerinin gözlerinin içine bakarak onu neden sevdiğine dair üç sebep söyle."),
    (0, ISI, "romantik", "Birlikte en sevdiğin fotoğrafınızı bul ve neden o olduğunu anlat."),
    (0, ISI, "eglenceli", "Partnerinin portresini 20 saniyede çizmeye çalış ve eserini ona göster."),
    (0, ISI, "eglenceli", "En iyi yaptığın ünlü taklidiyle partnerine bir aşk sözü söyle."),
    (0, ISI, "eglenceli", "İlk buluşmanızı sadece üç emojiyle anlat; partnerin tahmin etsin."),
    (0, TT, "romantik", "Partnerinin elini tut ve bir dakika boyunca hiç konuşmadan gözlerine bak."),
    (0, ISI, "eglenceli", "En komik selfie'ni çek ve partnerine gönder."),
    (0, ISI, "karisik", "10 saniye içinde bir sonraki randevunuz için bir plan uydur ve anlat."),
    (0, ISI, "romantik", "Partnerin için bir şiir uydur ve ilk iki dizesini hemen oku."),
    (0, ISI, "romantik", "Partnerine sarıl ve 20 saniye boyunca bırakma."),
    (0, ISI, "eglenceli", "Partnerinin sana taktığı lakabı en dramatik ses tonunla yüksek sesle söyle."),
]:
    add(G, cat, lvl, mood, t, "dare")
for lvl, cat, mood, t in [
    (1, TT, "flortoz", "Bana ilk ne zaman gerçekten çekildiğini fark ettin?"),
    (1, TT, "flortoz", "Üzerimde en çok sevdiğin kıyafet hangisi?"),
    (1, TT, "flortoz", "Seni en hızlı etkileyen bakışım ya da hareketim hangisi?"),
    (1, TT, "romantik", "İlk öpücüğümüzden hemen önce aklından ne geçiyordu?"),
    (1, TT, "eglenceli", "Hiç sadece beni görmek için bir bahane uydurdun mu?"),
    (1, TT, "flortoz", "Sana attığım mesajlardan hangisi seni en çok heyecanlandırdı?"),
    (1, ISI, "flortoz", "Sesimin en çekici geldiği an hangisi?"),
    (1, ISI, "romantik", "Bir randevuda seni en çok etkileyen şey ne olurdu?"),
    (1, TT, "gizemli", "Beni kıskanıp hiç belli etmediğin bir an oldu mu?"),
    (1, TT, "romantik", "Hakkımda kurduğun en tatlı hayal neydi?"),
    (1, TT, "flortoz", "Sence en çekici olduğum an hangisiydi?"),
    (1, TT, "gizemli", "Söylemeye utandığın ama aslında çok hoşuna giden bir hareketim var mı?"),
]:
    add(G, cat, lvl, mood, t, "truth")
for lvl, cat, mood, t in [
    (1, TT, "flortoz", "Partnerinin kulağına onda en sevdiğin özelliği fısılda."),
    (1, TT, "flortoz", "30 saniye boyunca sadece gözlerinle flört et; partnerini güldürürsen kazanırsın."),
    (1, TT, "flortoz", "Partnerine şu an ne düşündüğünü anlatan flörtöz bir sesli mesaj gönder."),
    (1, TT, "romantik", "İzin iste ve partnerinin yanağına yavaşça tek bir öpücük kondur."),
    (1, TT, "romantik", "En sevdiğiniz şarkıda partnerinle 30 saniye yavaş dans et."),
    (1, TT, "eglenceli", "Tek kelime etmeden, sadece bakışlarınla \"seni özledim\" demeye çalış."),
    (1, TT, "flortoz", "En çekici pozunla bir fotoğraf çek ve partnerine gönder."),
    (1, ISI, "romantik", "Partnerinin elini tut ve avucuna parmağınla bir kalp çiz."),
    (1, TT, "flortoz", "Partnerine \"Bu akşam seninle...\" diye başlayan bir mesaj yaz ve cümleyi tamamla."),
    (1, ISI, "romantik", "Bir dakika boyunca partnerinin saçlarıyla oyna ve ona en sevdiğin anınızı anlat."),
    (1, TT, "eglenceli", "Bir film sahnesindeymiş gibi partnerine dramatik bir aşk ilanı yap."),
]:
    add(G, cat, lvl, mood, t, "dare")
for lvl, cat, mood, t in [
    (2, GY, "cesur", "Seni en çok heyecanlandıran dokunuşum hangisi?"),
    (2, GY, "cesur", "Birlikte hiç denemediğimiz ama merak ettiğin romantik bir şey var mı?"),
    (2, GY, "gizemli", "Rüyanda beni gördüğün en ilginç an neydi?"),
    (2, GY, "cesur", "Benimle ilgili en cesur hayalin nasıl bir akşamla başlıyor?"),
    (2, GY, "flortoz", "Bende karşı koyamadığın bir hareket var mı? Hangisi?"),
    (2, KO, "cesur", "Bir geceyi baştan sona sen planlasan nasıl başlatırdın?"),
    (2, GY, "flortoz", "Bir mesajımı okurken yüzünün kızardığı oldu mu? Hangisiydi?"),
]:
    add(G, cat, lvl, mood, t, "truth")
for lvl, cat, mood, t in [
    (2, GY, "cesur", "Partnerinin kulağına ona dair en cesur düşünceni fısılda."),
    (2, GY, "flortoz", "30 saniye boyunca yalnızca bakışlarınla partnerine \"gel\" de."),
    (2, GY, "cesur", "Partnerin de isterse boynuna yavaşça üç öpücük kondur."),
    (2, GY, "cesur", "En ateşli bulduğun anınızı anlatan kısa bir sesli mesaj bırak."),
    (2, GY, "gizemli", "Bir dakika boyunca partnerinle alın alına durun; konuşmak ve gülmek yasak."),
    (2, GY, "flortoz", "Partnerine bu gece için tek cümlelik bir davet mesajı yaz."),
    (2, KO, "cesur", "Partnerinin en sevdiğin yerine bir öpücük kondur ve neden orası olduğunu söyle."),
    (2, KO, "romantik", "Işıkları kıs ve bir şarkı boyunca partnerinle çok yakın dans et."),
]:
    add(G, cat, lvl, mood, t, "dare")
for lvl, cat, mood, t in [
    (3, KO, "cesur", "Bana karşı kendini en çok tutmak zorunda kaldığın an hangisiydi?"),
    (3, KO, "cesur", "Birlikte yaşamak istediğin en cesur gece nerede geçiyor?"),
    (3, KO, "flortoz", "Seni en çok ne etkiliyor: sözlerim mi, dokunuşlarım mı, bakışlarım mı? Neden?"),
    (3, KO, "gizemli", "Bana hiç söylemediğin gizli bir arzun var mı? Sadece bir ipucu ver."),
    (3, KO, "cesur", "Hayalindeki mükemmel gecenin son sahnesini anlat."),
    (3, GY, "romantik", "Unutamadığın öpücüğümüz hangisiydi ve seni neden bu kadar etkiledi?"),
]:
    add(G, cat, lvl, mood, t, "truth")
for lvl, cat, mood, t in [
    (3, KO, "cesur", "Partnerinin kulağına bu gece onu neyin beklediğini üç kelimeyle fısılda."),
    (3, KO, "cesur", "Partnerin gözlerini kapatsın; 30 saniye boyunca onu yanağından boynuna küçük öpücüklerle şaşırt."),
    (3, KO, "flortoz", "Bir dakika boyunca gözlerini ayırmadan partnerine yavaşça yaklaş; ilk gülen kaybeder."),
    (3, KO, "cesur", "Bir dakika boyunca sadece fısıldayarak partnerine ondan ne kadar etkilendiğini anlat."),
    (3, KO, "flortoz", "Partnerinin seçtiği bir şarkı boyunca yalnızca onun için bir dans gösterisi yap."),
    (3, GY, "gizemli", "Partnerine bu gecenin ilk hamlesini ona bırakan bir \"kupon\" mesajı gönder."),
]:
    add(G, cat, lvl, mood, t, "dare")

# ───────────── Hangisini Seçerdin ─────────────
G = "would_you_rather"
RI, ES, AI = "Romantik İkilemler", "Eğlenceli Seçimler", "Ateşli İkilemler"
H = "Hangisini seçerdin?"
for lvl, cat, mood, t, a, b in [
    (0, RI, "romantik", "Bir akşam için hangisini seçerdin?", "Partnerinle spontane bir gece", "Planlanmış romantik bir gece"),
    (0, RI, "romantik", H, "Her sabah birlikte kahvaltı", "Her gece yatmadan uzun sohbet"),
    (0, ES, "eglenceli", "Tatil için hangisini seçerdin?", "Sessiz bir koyda çadır", "Büyük bir şehirde butik otel"),
    (0, RI, "romantik", H, "Ona bir aşk mektubu yazmak", "Ona bir aşk şarkısı söylemek"),
    (0, ES, "eglenceli", "Hangisi daha çok sen?", "Sürpriz yapmak", "Sürpriz yaşamak"),
    (0, ES, "eglenceli", H, "Yağmurda el ele yürüyüş", "Karda kartopu savaşı"),
    (0, ES, "eglenceli", "Bir hafta boyunca hangisini seçerdin?", "Her akşam birlikte yemek pişirmek", "Her akşam dışarıda yemek"),
    (0, RI, "romantik", H, "İlk buluşmamızı yeniden yaşamak", "Geleceğimizden bir günü görmek"),
    (0, ES, "karisik", H, "Birlikte yeni bir dil öğrenmek", "Birlikte bir enstrüman öğrenmek"),
    (0, ES, "eglenceli", "Hafta sonu için hangisini seçerdin?", "Bütün gün battaniye altında film", "Bütün gün şehri keşfetmek"),
    (0, RI, "karisik", H, "Hiç tartışmamak ama az konuşmak", "Bazen tartışmak ama her şeyi konuşmak"),
    (0, RI, "romantik", H, "Gün doğumunu birlikte izlemek", "Gün batımını birlikte izlemek"),
    (0, ES, "eglenceli", "Birlikte bakmak için hangisini seçerdin?", "Tembel bir kedi", "Enerjik bir köpek"),
    (0, RI, "gizemli", H, "Partnerinin aklını bir günlüğüne okumak", "Partnerinin rüyasına bir geceliğine girmek"),
    (0, ES, "eglenceli", "Birlikte yolculuk için hangisi?", "Uzun bir tren yolculuğu", "Plansız bir araba yolculuğu"),
    (0, RI, "romantik", H, "Her gün küçük bir hediye", "Yılda bir kez büyük bir sürpriz"),
    (0, ES, "eglenceli", H, "Ünlü bir şefin yemeği", "Partnerinin biraz yanık makarnası"),
    (1, RI, "flortoz", H, "Partnerinden el yazısı bir aşk mektubu", "Partnerinden flörtöz bir sesli mesaj"),
    (1, RI, "flortoz", H, "Kalabalıkta gizli gizli bakışmak", "Baş başa uzun bir öpücük"),
    (1, ES, "flortoz", H, "Partnerinin seni tavlamaya çalışması", "Senin onu tavlamaya çalışman"),
    (1, RI, "romantik", "Randevu için hangisini seçerdin?", "Mum ışığında akşam yemeği", "Şehir ışıklarında gece gezisi"),
    (1, RI, "flortoz", H, "Bir gün boyunca sadece flörtöz mesajlar", "Bir gün boyunca sadece sarılmak"),
    (1, ES, "flortoz", H, "Partnerinin en şık hâli", "Partnerinin sabah dağınık hâli"),
    (1, RI, "romantik", H, "Kulağına fısıldanan bir iltifat", "Yastığına bırakılmış bir not"),
    (1, RI, "flortoz", H, "Yavaş bir dans", "Oyunbaz bir takılma"),
    (1, ES, "flortoz", H, "Partnerinin senin için hazırlanması", "Senin onun için hazırlanman"),
    (1, RI, "romantik", H, "İlk öpücüğü yeniden yaşamak", "İlk \"seni seviyorum\"u yeniden yaşamak"),
    (1, RI, "romantik", H, "Otel odasında yatakta kahvaltı", "Bir teknede gün batımı"),
    (1, ES, "flortoz", H, "Boynundaki parfüm kokusu", "Saçındaki şampuan kokusu"),
    (1, ES, "eglenceli", H, "Gece yarısı sürpriz ziyaret", "Sabah erkenden kapıda sürpriz kahve"),
    (1, AI, "flortoz", H, "Seni biraz kıskanan bir partner", "Seni hiç kıskanmayan bir partner"),
    (2, AI, "cesur", H, "Göz göze uzun bir öpücük", "Gözler bağlıyken sürpriz bir öpücük"),
    (2, AI, "cesur", H, "Partnerinin seni baştan çıkarması için bir saat", "Senin onu baştan çıkarman için bir saat"),
    (2, RI, "flortoz", H, "Masaj yapmak", "Masaj yaptırmak"),
    (2, RI, "romantik", "Bir gece için hangisini seçerdin?", "Lüks bir otel süiti", "Ormanda cam bir kulübe"),
    (2, AI, "cesur", H, "Partnerinin gözlerini bağlamak", "Onun senin gözlerini bağlaması"),
    (2, AI, "gizemli", H, "Bütün gece fısıldaşmak", "Bütün gece hiç konuşmadan anlaşmak"),
    (2, AI, "flortoz", H, "Birlikte köpük banyosu", "Birlikte yağmurda dans"),
    (2, AI, "cesur", H, "Partnerinden cesur bir fotoğraf", "Partnerinden cesur bir sesli mesaj"),
    (2, ES, "cesur", H, "Bu gece liderliği sen al", "Bu gece liderliği o alsın"),
    (2, AI, "flortoz", H, "Sürpriz bir gecelik hediyesi", "Sürpriz bir parfüm hediyesi"),
    (3, AI, "cesur", H, "Bütün gece yavaş ve tutkulu", "Kısa, ani ve çılgın bir an"),
    (3, AI, "gizemli", H, "Rol yaptığınız gizemli bir gece", "Tamamen kendiniz olduğunuz bir gece"),
    (3, AI, "cesur", H, "Partnerinin tüm hayallerini bilmek", "Kendi hayallerini ona anlatmak"),
    (3, AI, "romantik", H, "Balkonda yıldızların altında", "Şöminenin önünde battaniye altında"),
    (3, AI, "cesur", H, "Bir gece boyunca kontrol sende", "Bir gece boyunca kontrol onda"),
    (3, AI, "flortoz", H, "Ayna karşısında birlikte dans", "Gözler kapalı birlikte dans"),
    (3, AI, "cesur", H, "Uykusuz geçen uzun bir gece", "Hiç acele etmeden uzun bir sabah"),
]:
    add(G, cat, lvl, mood, t, None, [a, b])

# ───────────── Bu mu Şu mu ─────────────
G = "this_or_that"
KL, RO, AT = "Klasikler", "Romantik", "Ateşli"
for lvl, cat, mood, t, a, b in [
    (0, KL, "eglenceli", "Akşam planı", "Film gecesi", "Gece yolculuğu"),
    (0, KL, "eglenceli", "İçecek", "Kahve", "Çay"),
    (0, KL, "eglenceli", "Tatil", "Deniz", "Dağ"),
    (0, KL, "eglenceli", "Sen hangisisin?", "Sabah insanı", "Gece kuşu"),
    (0, KL, "eglenceli", "Akşam yemeği", "Pizza", "Sushi"),
    (0, KL, "eglenceli", "Hangisi?", "Kedi", "Köpek"),
    (0, KL, "eglenceli", "Mevsim", "Yaz", "Kış"),
    (0, KL, "karisik", "Hangisi?", "Kitap", "Dizi"),
    (0, KL, "eglenceli", "Randevu", "Sinema", "Konser"),
    (0, KL, "eglenceli", "Hangisi?", "Tatlı", "Tuzlu"),
    (0, KL, "karisik", "Cumartesi", "Ev partisi", "Baş başa akşam"),
    (0, KL, "eglenceli", "Hareket", "Yürüyüş", "Bisiklet"),
    (0, KL, "eglenceli", "Konaklama", "Kamp", "Otel"),
    (0, RO, "romantik", "Işık", "Mum ışığı", "Şehir ışıkları"),
    (0, RO, "romantik", "Hangisi?", "Fısıldamak", "Not yazmak"),
    (0, RO, "romantik", "Yürürken", "El ele", "Kol kola"),
    (0, RO, "romantik", "Kahvaltı", "Yatakta", "Dışarıda"),
    (0, KL, "karisik", "İletişim", "Mesaj", "Telefon"),
    (0, RO, "karisik", "Hangisi?", "Sürpriz", "Plan"),
    (1, RO, "flortoz", "Hangisi?", "Yavaş dans", "Oyunbaz takılma"),
    (1, RO, "romantik", "Öpücük", "Alından", "Yanaktan"),
    (1, RO, "romantik", "Hangisi?", "Gizli bir bakış", "Uzun bir sarılma"),
    (1, RO, "flortoz", "Hangisi?", "Flörtöz mesaj", "Sesli mesaj"),
    (1, RO, "flortoz", "Koku", "Parfüm", "Doğal koku"),
    (1, KL, "flortoz", "Partnerinin hâli", "Şık hâli", "Rahat hâli"),
    (1, RO, "romantik", "Randevu", "Mumlu akşam yemeği", "Yıldızlı yürüyüş"),
    (1, RO, "flortoz", "İlk hamle", "Benden", "Ondan"),
    (1, RO, "romantik", "Hangisi?", "Aşk mektubu", "Aşk şarkısı"),
    (1, RO, "flortoz", "Hangisi?", "Kulağa fısıltı", "Göz göze bakış"),
    (1, RO, "romantik", "Öpücük zamanı", "Sabah öpücüğü", "Gece öpücüğü"),
    (1, KL, "karisik", "Kıskançlık", "Biraz tatlıdır", "Hiç gerek yok"),
    (1, RO, "romantik", "Hangisi?", "Saç okşamak", "Sırt kaşımak"),
    (1, RO, "flortoz", "Hangisi?", "Gizli randevu", "Sürpriz ziyaret"),
    (1, KL, "eglenceli", "Anı", "Selfie", "Polaroid"),
    (1, AT, "flortoz", "Hangisi?", "Köpük banyosu", "Sıcak duş"),
    (2, AT, "cesur", "Hangisi?", "Masaj yapmak", "Masaj yaptırmak"),
    (2, AT, "gizemli", "Hangisi?", "Gözler bağlı", "Gözler açık"),
    (2, AT, "cesur", "Işıklar", "Açık", "Kapalı"),
    (2, AT, "cesur", "Bu gece", "Lider olmak", "Takip etmek"),
    (2, AT, "flortoz", "Kumaş", "Dantel", "Saten"),
    (2, AT, "cesur", "Tempo", "Yavaş", "Hızlı"),
    (2, AT, "gizemli", "Hangisi?", "Fısıltı", "Sessizlik"),
    (2, RO, "cesur", "Hangisi?", "Cesur fotoğraf", "Cesur mesaj"),
    (2, AT, "flortoz", "Öpücük", "Dudaktan", "Boyundan"),
    (2, AT, "cesur", "Yakınlaşma", "Sabah", "Gece yarısı"),
    (2, AT, "gizemli", "Hangisi?", "Rol yapmak", "Kendin olmak"),
    (3, AT, "cesur", "Kontrol", "Bende", "Onda"),
    (3, AT, "cesur", "Hangisi?", "Tutkulu", "Şefkatli"),
    (3, AT, "gizemli", "Gece", "Plansız", "Senaryolu"),
    (3, AT, "cesur", "Başlangıç", "Uzun bir ısınma", "Ani bir başlangıç"),
    (3, AT, "gizemli", "Oda", "Aynalı oda", "Karanlık oda"),
    (3, AT, "flortoz", "Hangisi?", "Fısıltılı gece", "Kahkahalı gece"),
    (3, AT, "cesur", "Ne kadar?", "Bütün gece", "Sabaha karşı"),
    (3, AT, "cesur", "Mekân", "Yatak odası", "Şöminenin önü"),
]:
    add(G, cat, lvl, mood, t, None, [a, b])

# ───────────── Beni Ne Kadar Tanıyorsun ─────────────
G = "know_me"
KD, HA, AD = "Küçük Detaylar", "Hayaller ve Anılar", "Aşk Dili"
for lvl, cat, mood, t, opts in [
    (0, HA, "romantik", "Partnerinin ideal randevusu hangisi?", ["Evde film ve battaniye", "Şehirde gece yürüyüşü", "Sürpriz bir restoran", "Sabaha kadar konuşmak"]),
    (0, KD, "eglenceli", "Partnerin sabah uyanınca ilk ne yapar?", ["Telefona bakar", "Kahve ya da çay yapar", "Sarılıp uyumaya devam eder", "Hemen duşa girer"]),
    (0, KD, "karisik", "Partnerinin en sevdiği mevsim hangisi?", ["İlkbahar", "Yaz", "Sonbahar", "Kış"]),
    (0, KD, "karisik", "Partnerin stresliyken ne yapar?", ["Müzik dinler", "Yürüyüşe çıkar", "Bir şeyler atıştırır", "Uyur"]),
    (0, HA, "eglenceli", "Partnerinin tatil tarzı hangisi?", ["Deniz ve kum", "Şehir turu", "Doğa ve kamp", "Evde dinlenmek"]),
    (0, KD, "eglenceli", "Partnerinin en sevdiği yemek türü hangisi?", ["Ev yemeği", "Hamburger ve pizza", "Deniz ürünleri", "Tatlılar"]),
    (0, HA, "eglenceli", "Partnerin hangi süper gücü seçerdi?", ["Işınlanma", "Zihin okuma", "Zamanı durdurma", "Görünmezlik"]),
    (0, KD, "karisik", "Partnerinin hafta sonu favorisi hangisi?", ["Geç kalkmak", "Dışarıda kahvaltı", "Spor yapmak", "Arkadaşlarla buluşmak"]),
    (0, KD, "eglenceli", "Partnerinin en sevdiği film türü hangisi?", ["Romantik komedi", "Gerilim", "Bilim kurgu", "Animasyon"]),
    (0, KD, "gizemli", "Partnerin en çok neden korkar?", ["Böcekler", "Yükseklik", "Karanlık", "Yalnız kalmak"]),
    (0, AD, "romantik", "Bir tartışmadan sonra partnerin ne ister?", ["Hemen konuşmak", "Biraz yalnız kalmak", "Sarılmak", "Ortamı yumuşatan bir espri"]),
    (0, KD, "karisik", "Partnerinin vazgeçemediği içecek hangisi?", ["Türk kahvesi", "Demli çay", "Filtre kahve", "Soğuk limonata"]),
    (0, HA, "eglenceli", "Partnerinin çocukken hayali mesleği neydi?", ["Doktor", "Astronot", "Öğretmen", "Sanatçı"]),
    (0, KD, "eglenceli", "Partnerin telefonda en çok ne yapar?", ["Mesajlaşır", "Sosyal medyada gezer", "Müzik dinler", "Oyun oynar"]),
    (0, HA, "karisik", "Partnerinin ideal cumartesi gecesi hangisi?", ["Evde dizi maratonu", "Bir konser", "Arkadaşlarla sofra", "Uzun bir yürüyüş"]),
    (1, AD, "romantik", "Partnerini en çok ne etkiler?", ["Sürpriz bir mesaj", "Anlamlı bir bakış", "Küçük bir hediye", "Uzun bir sarılma"]),
    (1, AD, "romantik", "Partnerinin aşk dili hangisi?", ["Güzel sözler", "Dokunmak", "Birlikte zaman", "Hediyeler"]),
    (1, AD, "flortoz", "Partnerin sende en çok neyi çekici bulur?", ["Gülüşünü", "Gözlerini", "Sesini", "Özgüvenini"]),
    (1, AD, "flortoz", "Partnerinin favori öpücüğü hangisi?", ["Alından", "Yanaktan", "Boyundan", "Uzun ve yavaş"]),
    (1, HA, "romantik", "İlk buluşmada partnerinin dikkatini ilk ne çekti?", ["Kıyafetin", "Kokun", "Gülüşün", "Konuşman"]),
    (1, AD, "flortoz", "Partnerin flört ederken ne yapar?", ["Gözlerini kaçırır", "Espri yapar", "Dokunmaya bahane arar", "Uzun uzun bakar"]),
    (1, HA, "romantik", "Partnerine göre en romantik an hangisi?", ["Gün batımı", "Yağmurlu bir gece", "Birlikte uyanmak", "Karlı bir akşam"]),
    (1, AD, "flortoz", "Partnerinin en çok hoşlandığı iltifat türü?", ["Görünüşüne dair", "Zekâsına dair", "Kalbine dair", "Tarzına dair"]),
    (1, AD, "romantik", "Partnerin seni özleyince ne yapar?", ["Eski fotoğraflara bakar", "Mesaj atar", "Hemen arar", "Şarkımızı dinler"]),
    (1, KD, "romantik", "Partnerin sana en çok nasıl hitap eder?", ["Adınla", "Aşkım", "Canım", "Özel bir lakapla"]),
    (1, HA, "romantik", "Partnerinin hayalindeki yıl dönümü kutlaması?", ["Yurt dışı kaçamağı", "Evde özel bir yemek", "Sürpriz bir parti", "Doğada kamp"]),
    (1, AD, "romantik", "Partnerinin en sevdiği sarılma şekli?", ["Arkadan sarılmak", "Yüz yüze sıkıca", "Kaşık gibi uzanmak", "Omuz omuza"]),
    (1, HA, "romantik", "İlk öpücüğünüzde partnerin ne hissetti?", ["Heyecan", "Utangaçlık", "Huzur", "Karnında kelebekler"]),
    (2, AD, "flortoz", "Partnerinin en sevdiği dokunuş hangisi?", ["Saç okşamak", "Sırtta parmak uçları", "El ele tutuşmak", "Boyna bir öpücük"]),
    (2, AD, "cesur", "Partnerini en çok ne heyecanlandırır?", ["Fısıltılar", "Bakışlar", "Dokunuşlar", "Cesur mesajlar"]),
    (2, HA, "romantik", "Romantik bir gece için partnerinin tercihi?", ["Mum ışığı", "Loş bir lamba", "Karanlık", "Şehir ışıkları"]),
    (2, KD, "flortoz", "Partnerin seni en çekici hangi kıyafette bulur?", ["Siyah bir şey", "Beyaz gömlek", "Rahat eşofman", "Onun tişörtü"]),
    (2, AD, "flortoz", "Partnerin ilk hamleyi nasıl yapar?", ["Bir bakışla", "Bir mesajla", "Bir dokunuşla", "Bir fısıltıyla"]),
    (2, AD, "cesur", "Partnerin yakınlaşmayı en çok ne zaman sever?", ["Sabah", "Öğleden sonra", "Gece yarısı", "Hiç fark etmez"]),
    (2, HA, "gizemli", "Partnerinin hayalindeki kaçamak mekânı?", ["Lüks bir otel", "Karlı bir dağ evi", "Bir tekne", "Kendi evimiz"]),
    (2, KD, "flortoz", "Partnerine göre en ateşli müzik hangisi?", ["R&B", "Caz", "Pop", "Türkçe slow"]),
    (3, AD, "cesur", "Partnerin kontrolü kimde görmek ister?", ["Kendisinde", "Sende", "Sırayla", "Anına göre"]),
    (3, HA, "cesur", "Partnerinin en cesur hayali nerede geçer?", ["Bir tatil köyünde", "Şehir manzaralı süitte", "Yağmurlu bir arabada", "Issız bir koyda"]),
    (3, AD, "gizemli", "Gözlerini bağlamayı teklif etsen partnerin ne derdi?", ["Hemen evet", "Önce kahkaha atardı", "Merakla evet", "Belki bir gün"]),
    (3, AD, "cesur", "Partnerinin tercihi: tutku mu, şefkat mi?", ["Hep tutku", "Hep şefkat", "Önce şefkat sonra tutku", "Önce tutku sonra şefkat"]),
    (3, HA, "gizemli", "Bir gecelik rol oyununda partnerin kim olurdu?", ["Gizemli bir yabancı", "Bir ajan", "Bir film yıldızı", "Kendisi"]),
    (3, AD, "cesur", "Partnerine göre en hassas yer neresi?", ["Boyun", "Kulak arkası", "Bel", "Dudaklar"]),
]:
    add(G, cat, lvl, mood, t, None, opts)

# ───────────── Gizli Sorular ─────────────
G = "secret_questions"
DS, IT, GS = "Derin Sorular", "İtiraflar", "Gece Sırları"
for lvl, cat, mood, t in [
    (0, DS, "romantik", "İlişkimizde seni en çok şaşırtan şey ne oldu?"),
    (0, IT, "romantik", "Benimle ilgili hiç kimseye anlatmadığın tatlı bir anı var mı?"),
    (0, DS, "romantik", "Benim için \"işte o kişi\" dediğin an hangisiydi?"),
    (0, DS, "romantik", "Birlikte yaşlandığımızı hayal ettiğin bir sahneyi anlat."),
    (0, IT, "romantik", "Beni ilk kez gerçekten özlediğin an neydi?"),
    (0, IT, "eglenceli", "Hakkımda yanlış tahmin ettiğin ilk şey neydi?"),
    (0, DS, "romantik", "Yanımda kendini en güvende hissettiğin an hangisiydi?"),
    (0, DS, "karisik", "Birlikte değiştirmek istediğin tek bir alışkanlığımız ne?"),
    (0, DS, "eglenceli", "Beni bir renkle anlatsan hangisi olurdu ve neden?"),
    (0, DS, "eglenceli", "Hikâyemiz bir film olsa adı ne olurdu?"),
    (0, IT, "gizemli", "Ben uyurken beni izlerken aklından geçen ama söylemediğin bir düşünce var mı?"),
    (0, IT, "flortoz", "İlk buluşmamızda ayrılırken aslında ne yapmak istedin?"),
    (0, IT, "romantik", "Bana hiç söyleyemediğin bir teşekkür var mı?"),
    (0, DS, "romantik", "Sence ilişkimizin en güçlü yanı ne?"),
    (0, DS, "romantik", "Benden öğrendiğin en değerli şey ne?"),
    (0, DS, "romantik", "On yıl sonra sıradan bir akşamımızı nasıl hayal ediyorsun?"),
    (0, IT, "eglenceli", "Bir günlüğüne benim yerime geçsen ilk ne yapardın?"),
    (1, IT, "flortoz", "Benden gerçekten hoşlandığını fark ettiğin o ilk an neydi?"),
    (1, IT, "romantik", "Hakkımda kurduğun ama hiç anlatmadığın en romantik hayal ne?"),
    (1, IT, "flortoz", "İlk öpüşmemizde aklından geçen tek kelime neydi?"),
    (1, IT, "flortoz", "Bende seni hâlâ utandıracak kadar çok hoşuna giden şey ne?"),
    (1, IT, "gizemli", "Yazıp da göndermekten vazgeçtiğin bir mesaj oldu mu? Ne yazıyordu?"),
    (1, IT, "flortoz", "Beni en çekici bulduğun an hangisiydi?"),
    (1, DS, "romantik", "Bir randevumuzu tekrar yaşayabilsen hangisini seçerdin, neyi farklı yapardın?"),
    (1, DS, "flortoz", "Yanımdayken seni en çok ne heyecanlandırıyor?"),
    (1, IT, "gizemli", "Kıskandığını hiç belli etmediğin bir an oldu mu?"),
    (1, IT, "flortoz", "Üzerimde görmeyi en çok istediğin kıyafet ne?"),
    (1, DS, "romantik", "Sana söylediğim ve hiç unutmadığın cümle hangisi?"),
    (1, IT, "romantik", "Bir mesajımı tekrar tekrar okuduğun oldu mu? Hangisiydi?"),
    (1, IT, "romantik", "Bana yapmayı çok isteyip henüz yapmadığın bir sürpriz var mı?"),
    (1, DS, "romantik", "Uzaktayken beni düşündüğünde aklına gelen ilk görüntü ne?"),
    (2, GS, "cesur", "Birlikte denemeyi hayal ettiğin ama söylemeye çekindiğin bir şey var mı?"),
    (2, GS, "flortoz", "Hangi dokunuşumu en çok özlüyorsun?"),
    (2, GS, "cesur", "Bir gece için tüm kuralları sen koysan ilk kural ne olurdu?"),
    (2, GS, "flortoz", "Beni en çok baştan çıkaran hareketim hangisi?"),
    (2, GS, "gizemli", "Rüyanda beni gördüğün en ateşli anı tek bir ipucuyla anlat."),
    (2, IT, "flortoz", "Hangi kokum ya da ses tonum sana karşı konulmaz geliyor?"),
    (2, IT, "cesur", "Aklından geçen ama hiç söylemediğin en cesur iltifat ne?"),
    (2, GS, "cesur", "Yanımdayken kendini tutmakta zorlandığın bir an oldu mu?"),
    (2, DS, "romantik", "Birlikte bir gece kaçamağı yapsak nereye giderdik, ilk ne yapardık?"),
    (2, GS, "cesur", "Sana göre en tutkulu anımız hangisiydi?"),
    (3, GS, "gizemli", "Benim gizli bir arzum olsa tahminin ne olurdu?"),
    (3, GS, "cesur", "Hayallerinden birini tek bir cümleyle anlat."),
    (3, GS, "romantik", "Bizim için mükemmel bir gecenin son sahnesi nasıl?"),
    (3, GS, "cesur", "Bana karşı en cesur olduğun an hangisiydi? Şimdi olsa neyi farklı yapardın?"),
    (3, GS, "cesur", "Birlikte, sınırlarımıza saygıyla keşfetmek istediğin yeni bir şey var mı? Nazikçe anlat."),
    (3, GS, "flortoz", "Seni en çok neyin heyecanlandırdığını hiç tam olarak anlattın mı? Şimdi anlat."),
    (3, GS, "gizemli", "Bir gecelik rol oyununda sen hangi karakter olurdun, ben kim olurdum?"),
]:
    add(G, cat, lvl, mood, t)

# ───────────── Çift Görevleri ─────────────
G = "challenges"
GG, UG, CG = "Günlük Görevler", "Uzaktan Görevler", "Cesur Görevler"
for lvl, cat, mood, t, timer in [
    (0, GG, "eglenceli", "60 saniye boyunca göz göze bakın; ilk gülen kaybeder.", 60),
    (0, GG, "romantik", "Partnerine bugün seni gülümseten üç şeyi anlat.", 120),
    (0, GG, "romantik", "En sevdiğiniz şarkıyı açın ve hiç konuşmadan baştan sona birlikte dinleyin.", 240),
    (0, UG, "romantik", "Partnerine bugün için ona teşekkür ettiğin küçük bir şeyi yaz.", None),
    (0, GG, "romantik", "El ele tutuşup iki dakika boyunca birlikte yavaşça nefes alıp verin.", 120),
    (0, UG, "romantik", "Partnerine eski bir fotoğrafınızı gönder ve o gün neler hissettiğini anlat.", None),
    (0, GG, "romantik", "Birbirinize bu hafta için küçük birer iyilik sözü verin.", 90),
    (0, UG, "romantik", "Gün içinde hiç beklemediği bir anda partnerine \"seni düşünüyorum\" yaz.", None),
    (0, GG, "karisik", "Beş dakika içinde bir sonraki randevunuzu birlikte planlayın.", 300),
    (0, GG, "eglenceli", "Bu hafta birlikte pişireceğiniz bir yemek seçin ve gününü belirleyin.", 180),
    (0, GG, "flortoz", "Sırayla birbirinize iltifat edin; 30 saniye boyunca durmak yok.", 30),
    (0, UG, "karisik", "Partnerine bugününü tek bir kelimeyle anlat ve nedenini açıkla.", 60),
    (0, UG, "eglenceli", "Sırayla birbirinize üç emojiyle bir film anlatın ve tahmin edin.", 180),
    (0, UG, "romantik", "Uyumadan önce partnerine tatlı bir sesli \"iyi geceler\" mesajı gönder.", None),
    (0, GG, "romantik", "Telefonları kenara bırakın ve üç dakika boyunca sadece sohbet edin.", 180),
    (0, GG, "romantik", "Gelecek yıl birlikte yapmak istediğiniz üç şeyi yazın.", 240),
    (0, GG, "romantik", "Birbirinize sarılın ve 30 saniye boyunca bırakmayın.", 30),
    (0, UG, "eglenceli", "Birbirinize birer çocukluk fotoğrafı gönderin ve o günü anlatın.", None),
    (0, UG, "romantik", "Partnerine ona seni hatırlatan bir şarkı gönder.", None),
    (1, GG, "flortoz", "Partnerinin kulağına sadece iki kelimelik bir iltifat fısılda.", 30),
    (1, GG, "flortoz", "Bir dakika boyunca yalnızca bakışlarla flört edin; konuşmak yasak.", 60),
    (1, UG, "flortoz", "Partnerine yalnızca emojilerden oluşan flörtöz bir mesaj gönder.", None),
    (1, GG, "romantik", "En sevdiğiniz şarkıda birlikte yavaş dans edin.", 180),
    (1, UG, "flortoz", "Onda en çekici bulduğun üç şeyi anlatan bir sesli mesaj gönder.", None),
    (1, GG, "eglenceli", "Partnerinin avucuna parmağınla bir kelime yaz; ne yazdığını tahmin etsin.", 90),
    (1, UG, "flortoz", "Partnerine bu akşam için resmî bir \"randevu daveti\" mesajı gönder.", None),
    (1, UG, "flortoz", "En güzel gülüşünle bir selfie çek ve partnerine gönder.", None),
    (1, GG, "romantik", "Işıkları kısın ve beş dakika boyunca sadece mum ışığında sohbet edin.", 300),
    (1, GG, "romantik", "Partnerinin alnına bir öpücük kondur ve onunla neden şanslı olduğunu söyle.", 30),
    (1, GG, "romantik", "Sırayla \"ilk\"lerinizi sayın: ilk bakış, ilk mesaj, ilk öpücük...", 60),
    (1, UG, "gizemli", "Gün içinde partnerine gizemli bir ipucu gönder: \"Akşam sana bir şey söyleyeceğim...\"", None),
    (1, GG, "romantik", "İki dakika boyunca partnerinin saçlarını okşa.", 120),
    (1, GG, "gizemli", "Sırayla birbirinizin kulağına küçük bir sır fısıldayın.", 60),
    (1, UG, "flortoz", "Partnerinin en çekici bulduğun fotoğrafını ona gönder ve nedenini yaz.", None),
    (1, GG, "eglenceli", "30 saniye boyunca burun buruna durun; gülmek yasak.", 30),
    (2, CG, "romantik", "Partnerine iki dakikalık rahatlatıcı bir omuz masajı yap.", 120),
    (2, CG, "cesur", "İzin iste ve partnerinin boynuna, acele etmeden, üç öpücük kondur.", 30),
    (2, CG, "gizemli", "Gözlerini kapat; partnerin seni yalnızca dokunuşlarıyla odada gezdirsin.", 120),
    (2, UG, "flortoz", "Partnerine cesur ama zarif bir fotoğrafını gönder.", None),
    (2, UG, "gizemli", "Partnerine bu gece için üç ipucu içeren gizemli bir mesaj yaz.", None),
    (2, CG, "romantik", "Bir şarkı boyunca çok yakın dans edin; aranızda boşluk kalmasın.", 240),
    (2, CG, "cesur", "Partnerinin kulağına bu gece ondan en çok ne istediğini fısılda.", 30),
    (2, GG, "flortoz", "Sırayla 90 saniye boyunca en ateşli anınızı anlatın.", 90),
    (2, CG, "cesur", "Partnerinin gözlerini bağla ve onu küçük öpücüklerle şaşırt.", 60),
    (2, UG, "flortoz", "Sesini alçaltarak partnerine bir dakikalık flörtöz bir sesli mesaj bırak.", None),
    (2, CG, "gizemli", "Işıkları kapatın ve üç dakika boyunca yalnızca fısıldayarak konuşun.", 180),
    (3, CG, "romantik", "Partnerine beş dakikalık bir sırt masajı yap; temposunu o seçsin.", 300),
    (3, CG, "cesur", "Partnerine bu gece onu neyin beklediğini anlatan cesur bir mesaj yaz ve akşama kadar göndermeyi bekle.", None),
    (3, CG, "cesur", "Bir dakika boyunca tek kelime etmeden, yalnızca bakış ve dokunuşla \"seni istiyorum\" de.", 60),
    (3, CG, "flortoz", "Partnerin bir şarkı seçsin; sen de yalnızca onun için dans et.", 240),
    (3, CG, "gizemli", "Birbirinize tek kelimelik bir \"bu gece\" dileği fısıldayın ve gerçekleştirmeye çalışın.", None),
    (3, CG, "cesur", "Partnerinin gözlerini bağla; iki dakika boyunca öpücüklerini nereye kondurduğunu tahmin etsin.", 120),
    (3, CG, "gizemli", "Rol oyunu: bir otel barında ilk kez tanışan iki yabancı olun.", 300),
    (3, CG, "cesur", "Partnerine bir \"evet kuponu\" yaz: sınırlarınız içinde tek bir dileğini kabul edeceksin.", None),
]:
    add(G, cat, lvl, mood, t, None, None, timer)

# ───────────── Sohbet Oyunu ─────────────
G = "chat_game"
EO, TM, FM = "Emoji Oyunları", "Tatlı Mesajlar", "Flört Mesajları"
for lvl, cat, mood, t in [
    (0, EO, "eglenceli", "Bana üç emoji ile bugününü anlat."),
    (0, EO, "eglenceli", "Beni tek bir emojiyle anlat ve nedenini yaz."),
    (0, EO, "romantik", "İlk buluşmamızı beş emojiyle anlat."),
    (0, EO, "eglenceli", "Birlikte izlediğimiz bir filmi emojilerle anlat; ben tahmin edeyim."),
    (0, EO, "eglenceli", "Şu an nerede olmak istediğini emojilerle göster."),
    (0, TM, "romantik", "Bugün seni gülümseten bir şeyin fotoğrafını gönder."),
    (0, EO, "gizemli", "Bir sonraki randevumuz için üç emojilik bir ipucu ver."),
    (0, TM, "eglenceli", "Bu haftaki ruh hâlini bir hava durumu raporu gibi anlat."),
    (0, TM, "romantik", "En sevdiğin ortak anımızı tek bir cümleyle yaz."),
    (0, TM, "karisik", "Şu an dinlediğin şarkıyı bana gönder."),
    (0, TM, "eglenceli", "İlişkimizi bir film adıyla anlat."),
    (0, TM, "romantik", "Bugün benimle ilgili aklına gelen ilk şeyi yaz."),
    (1, TM, "flortoz", "Bana sadece iltifatlardan oluşan bir mesaj yaz."),
    (1, TM, "romantik", "\"Seni en çok özlediğim an...\" diye başlayan bir mesaj gönder."),
    (1, FM, "flortoz", "Beni üç kelimeyle anlat; üçü de flörtöz olsun."),
    (1, FM, "flortoz", "Bu akşam için bana flörtöz bir ipucu gönder."),
    (1, FM, "gizemli", "Bana gizemli bir selfie gönder: sadece gözlerin görünsün."),
    (1, TM, "romantik", "Tatlı bir sesli mesajla bana iyi geceler de."),
    (1, EO, "flortoz", "Seni benimle en çok neyin etkilediğini emojilerle anlat."),
    (1, FM, "flortoz", "\"Şu an yanımda olsaydın...\" cümlesini tamamla."),
    (1, TM, "romantik", "En sevdiğin fotoğrafımı gönder ve nedenini yaz."),
    (1, TM, "romantik", "Bir aşk şarkısından bize en çok yakışan tek bir satır gönder."),
    (2, FM, "cesur", "Bu gece için bana üç kelimelik bir davet yaz."),
    (2, FM, "gizemli", "Bana fısıltıyla okunması gereken bir mesaj yaz."),
    (2, EO, "flortoz", "Bende en çekici bulduğun şeyi yalnızca emojilerle anlat."),
    (2, FM, "cesur", "\"Seni düşündüğümde...\" diye başlayan cesur bir mesaj yaz."),
    (2, FM, "flortoz", "Ses tonunu alçaltarak bana kısa bir sesli mesaj gönder."),
    (2, FM, "gizemli", "Bu akşamki planını bana sadece ipuçlarıyla anlat."),
    (2, FM, "cesur", "En cesur bakışını bir fotoğrafla gönder."),
    (3, EO, "gizemli", "Bu gece beni neyin beklediğini tek bir emojiyle söyle ve beni meraklandır."),
    (3, FM, "cesur", "Bana hiç söylemediğin bir arzunu tek bir ipucuyla anlat."),
    (3, FM, "cesur", "\"Bu gece kurallar şöyle...\" diye başlayan bir mesaj yaz."),
    (3, FM, "flortoz", "Bana bir \"evet kuponu\" gönder: sınırlarımız içinde tek bir dileğimi kabul ediyorsun."),
    (3, FM, "romantik", "Mükemmel gecemizin son sahnesini tek bir cümleyle yaz."),
]:
    add(G, cat, lvl, mood, t)

# ─────────────────────────── Hikâyeler ───────────────────────────
STORIES = [
    # title, description, level, cover_color, premium, sort
    ("Gece Yarısı Kaçamağı", "Şehir uyurken otelin çatısından gelen bir şarkı sizi çağırıyor. Bu gece nereye gideceğine birlikte karar verin.", 1, "#2A1530", False, 1),
    ("Kapadokya'da Gün Doğumu", "Bir mağara otelde şafak vakti. Gökyüzü balonlarla dolarken sizin hikâyeniz başlıyor.", 2, "#5A1A2E", True, 2),
]
# (story, chapter, title, body, art_note, glow, is_start, is_ending, xp, sort)
S1, S2 = STORIES[0][0], STORIES[1][0]
SCENES = [
    (S1, "BÖLÜM 1", "Çatıdaki Müzik", "Gece yarısını çoktan geçti. Otelin çatısından yumuşak bir müzik sesi süzülüyor, koridorun ucundaki kapı aralık duruyor. Elini tutuyor ve fısıldıyor: \"Duyuyor musun?\"", "çatı kapısı aralık, içeri sızan sıcak ışık, camda yağmur damlaları", "rgba(242,194,123,.35)", True, False, 0, 1),
    (S1, "BÖLÜM 2", "Boş Pist", "Çatıda kimse yok. Sadece ışık zincirleri, eski bir pikap ve yavaş bir şarkı. Şehrin ışıkları ayaklarınızın altında sanki yalnızca sizin için yanıyor.", "çatı barı, ışık zincirleri, boş dans pisti", "rgba(231,104,138,.4)", False, False, 0, 2),
    (S1, "BÖLÜM 2", "Yağmurlu Sokak", "Dışarıda ince bir yağmur başlamış. Sokak lambaları ıslak kaldırımlarda titriyor; ceketini omzuna bırakıp gülümsüyor. Gece, ikinizi de bir yere götürmek istiyor gibi.", "yağmurlu sokak, ıslak kaldırımda lamba yansımaları, tek şemsiye", "rgba(120,160,230,.35)", False, False, 0, 3),
    (S1, "BÖLÜM 3", "Yavaş Şarkı", "Kollarını boynuna doluyor, ayakların pistte kendiliğinden hareket ediyor. Şarkı bitiyor ama ikiniz de durmuyorsunuz. Gökyüzünün kenarı hafifçe aydınlanmaya başlıyor.", "iki silüet ağır ağır dans ediyor, arkada pikap ve şehir", "rgba(231,104,138,.45)", False, False, 0, 4),
    (S1, "BÖLÜM 3", "Pikabın Başında", "Plakları karıştırıyorsunuz ve eğlenceli, eski bir şarkı buluyorsunuz. Kahkahalar arasında dönüp duruyorsunuz; saçları yüzüne düşüyor, gözleri parlıyor.", "plak yığını, pikabın iğnesi, kahkahayla dönen iki figür", "rgba(242,194,123,.4)", False, False, 0, 5),
    (S1, "BÖLÜM 3", "Islak Kaldırımlar", "Yağmurun altında el ele yürüyorsunuz, adımlarınız birbirine uyuyor. Bir köşede sabaha kadar açık bir kafenin ışığı yanıyor, yolun ilerisinde ise bir taksi yavaşlıyor.", "yağmurda el ele yürüyen çift, uzakta kafe ışığı ve taksi farları", "rgba(120,160,230,.4)", False, False, 0, 6),
    (S1, "FİNAL", "Şafakta Silüetler", "Şehrin ışıkları birer birer sönerken güneş ufukta beliriyor. Onun omzuna yaslanıyorsun ve ikiniz de aynı şeyi düşünüyorsunuz: bu gece sonsuza kadar sizin.", "şehir silüeti, şafak, çatıda iki silüet", "rgba(168,139,240,.4)", False, True, 250, 7),
    (S1, "FİNAL", "Eve Dönüş Taksisi", "Taksinin arka koltuğunda başını omzuna koyuyor. Camdan akan ışıklar yüzünüzde dans ederken şoför radyoyu açıyor; çatıda çalan şarkı bu. Birbirinize bakıp gülümsüyorsunuz.", "taksinin arka koltuğu, camda şehir ışıkları, yaslanmış iki baş", "rgba(242,194,123,.35)", False, True, 180, 8),
    (S1, "FİNAL", "Sabah Dörtte Kafe", "Saat dördü gösteriyor, kafede sizden başka kimse yok. İki sıcak fincan, buğulu bir cam ve bitmeyen bir sohbet. Güneş doğduğunda hâlâ aynı masada, el eledesiniz.", "boş kafe, buğulu cam, masada iki fincan ve kenetlenmiş eller", "rgba(127,209,174,.3)", False, True, 200, 9),

    (S2, "BÖLÜM 1", "Mağara Otel", "Saat daha dört buçuk. Taş duvarlı odanın penceresinden vadiye mavi bir ışık süzülüyor, dışarıda balonların ateşi yanmaya başlamış. Uykulu bir sesle soruyor: \"Kalkıyor muyuz, yoksa kalıyor muyuz?\"", "mağara otel odası, taş duvarlar, pencerede ilk balon ateşleri", "rgba(242,194,123,.35)", True, False, 0, 1),
    (S2, "BÖLÜM 2", "Sepetin İçinde", "Balon yavaşça yükseliyor, peri bacaları küçülüyor. Etrafınızda yüzlerce renkli balon, ufukta pembe bir çizgi. Elini sıkıca tutuyor; yükseklikten mi, andan mı bilinmez.", "balon sepeti, etrafta renkli balonlar, aşağıda peri bacaları", "rgba(231,104,138,.4)", False, False, 0, 2),
    (S2, "BÖLÜM 2", "Taş Duvarlar Arasında", "Yorganın altında kalıyorsunuz. Balonlar pencerenin önünden bir bir geçiyor; odanın sessizliğinde yalnızca nefesleriniz ve uzaktan gelen brülör sesi var.", "yorgan, pencerede geçen balonlar, loş taş oda", "rgba(168,139,240,.35)", False, False, 0, 3),
    (S2, "BÖLÜM 3", "Bulutların Üstünde", "Pilot arkasını döndüğü anda seni kendine çekiyor. Güneş tam o sırada doğuyor ve sepetin içi altın rengine boyanıyor. Kalbin hiç bu kadar yüksekte atmamıştı.", "sepette öpüşen iki silüet, arkalarında doğan güneş", "rgba(242,194,123,.45)", False, False, 0, 4),
    (S2, "BÖLÜM 3", "Kadrajdaki Sen", "Fotoğraf makinesini kaldırıyorsun ama kadraja manzara yerine o giriyor. Rüzgâr saçlarını dağıtıyor, sana bakıp gülüyor. Bu karenin hayatının en sevdiğin fotoğrafı olacağını biliyorsun.", "fotoğraf makinesi vizörü, kadrajda gülen partner, arkada balonlar", "rgba(231,104,138,.35)", False, False, 0, 5),
    (S2, "BÖLÜM 3", "Teras", "Battaniyeye sarılıp terasa çıkıyorsunuz. Vadide yüzlerce balon süzülüyor, elinizdeki sıcak içeceklerden buhar yükseliyor. Omzuna yaslanıp \"Burada da gökyüzündeyiz\" diyor.", "otel terası, battaniyeye sarılı iki kişi, vadide balonlar", "rgba(127,209,174,.3)", False, False, 0, 6),
    (S2, "FİNAL", "Gökyüzüne Verilen Söz", "Bu anı bir söze dönüştürüyorsunuz: her yıl, bir gün doğumunu birlikte izlemek. Balon yavaşça alçalırken bu sözün gökyüzünde asılı kaldığını hissediyorsunuz.", "doğan güneşin önünde el ele iki silüet, alçalan balon", "rgba(242,194,123,.4)", False, True, 250, 7),
    (S2, "FİNAL", "Tarlaya İniş", "Balon bir tarlaya sarsılarak iniyor; ikiniz de kahkahalar içinde birbirinize sarılıyorsunuz. Mürettebat kutlama yaparken siz hâlâ gülüyorsunuz. En güzel anılar biraz sarsıntılı olanlarmış.", "tarlaya inmiş balon, sarılarak gülen çift", "rgba(231,104,138,.35)", False, True, 180, 8),
    (S2, "FİNAL", "Güvercinlik Vadisi", "Vadide yürürken yollar sizi tenha bir patikaya çıkarıyor. Kayaların arasında oturup güneşi izliyorsunuz; sessizlik, bin kelimeden fazlasını anlatıyor.", "kayalık patika, tepede oturan iki kişi, sabah güneşi", "rgba(168,139,240,.4)", False, True, 200, 9),
    (S2, "FİNAL", "Sabahın Sıcaklığı", "Battaniyenin altında, balonların son gölgeleri odadan çekilirken birbirinize daha çok sokuluyorsunuz. Bugünün hiçbir planı yok; sadece siz varsınız ve bu fazlasıyla yeterli.", "yorgan altında sarılmış iki figür, sabah güneşi taş duvarda", "rgba(242,194,123,.3)", False, True, 220, 10),
]
# (story, from_scene, text, to_scene, sort)
CHOICES = [
    (S1, "Çatıdaki Müzik", "Yukarı çık", "Boş Pist", 1),
    (S1, "Çatıdaki Müzik", "Dışarıda kal", "Yağmurlu Sokak", 2),
    (S1, "Boş Pist", "Dans et", "Yavaş Şarkı", 1),
    (S1, "Boş Pist", "Şarkıyı değiştir", "Pikabın Başında", 2),
    (S1, "Yağmurlu Sokak", "Yağmurda yürü", "Islak Kaldırımlar", 1),
    (S1, "Yağmurlu Sokak", "Otele dön, çatıya çık", "Boş Pist", 2),
    (S1, "Yavaş Şarkı", "Gün doğumunu bekle", "Şafakta Silüetler", 1),
    (S1, "Yavaş Şarkı", "Aşağı in, taksi çağır", "Eve Dönüş Taksisi", 2),
    (S1, "Pikabın Başında", "Güneşin doğuşunu izle", "Şafakta Silüetler", 1),
    (S1, "Pikabın Başında", "Gece bitmesin, kafeye git", "Sabah Dörtte Kafe", 2),
    (S1, "Islak Kaldırımlar", "Açık kafeye gir", "Sabah Dörtte Kafe", 1),
    (S1, "Islak Kaldırımlar", "Taksiye el salla", "Eve Dönüş Taksisi", 2),

    (S2, "Mağara Otel", "Balona bin", "Sepetin İçinde", 1),
    (S2, "Mağara Otel", "Yataktan çıkma", "Taş Duvarlar Arasında", 2),
    (S2, "Sepetin İçinde", "Pilot bakmıyorken onu öp", "Bulutların Üstünde", 1),
    (S2, "Sepetin İçinde", "Fotoğraf makinesini çıkar", "Kadrajdaki Sen", 2),
    (S2, "Taş Duvarlar Arasında", "Battaniyeyle terasa çık", "Teras", 1),
    (S2, "Taş Duvarlar Arasında", "Yorganın altında kal", "Sabahın Sıcaklığı", 2),
    (S2, "Bulutların Üstünde", "Bu anı bir söze dönüştür", "Gökyüzüne Verilen Söz", 1),
    (S2, "Bulutların Üstünde", "İnişe hazırlan", "Tarlaya İniş", 2),
    (S2, "Kadrajdaki Sen", "Fotoğrafı bir notla ona gönder", "Gökyüzüne Verilen Söz", 1),
    (S2, "Kadrajdaki Sen", "İnişten sonra vadiye yürü", "Güvercinlik Vadisi", 2),
    (S2, "Teras", "Vadiye inip yürüyüşe çık", "Güvercinlik Vadisi", 1),
    (S2, "Teras", "Odaya dön, sıcağa sokul", "Sabahın Sıcaklığı", 2),
]

ACH = [
    ("first_game", "İlk Oyun", "Birlikte ilk oyununuzu tamamladınız.", "favorite", 1),
    ("connected", "İlk Bağ", "Partnerinizle Nocta'da bağlandınız.", "link", 1),
    ("games_30", "Birlikte 30 Oyun", "Birlikte 30 oyun tamamladınız.", "emoji_events", 30),
    ("challenges_10", "10 Görev", "10 çift görevini birlikte tamamladınız.", "local_fire_department", 10),
    ("questions_100", "100 Soru", "Birlikte 100 soruyu cevapladınız.", "chat", 100),
    ("midnight_players", "Gece Yarısı Oyuncuları", "Gece yarısından sonra 5 oyun oynadınız.", "dark_mode", 5),
    ("perfect_match", "Mükemmel Eşleşme", "Bir oyunda tüm cevaplarınız birebir eşleşti.", "auto_awesome", 1),
    ("story_finishers", "Hikâye Avcıları", "Bir çift hikâyesini sonuna kadar birlikte oynadınız.", "movie", 1),
    ("streak_30", "30 Günlük Seri", "30 gün boyunca aralıksız birlikte oynadınız.", "calendar_month", 30),
    ("first_photo", "İlk Kare", "Sohbette ilk fotoğrafınızı paylaştınız.", "photo_camera", 1),
]

SETTINGS = [
    ("content_version", 1, True),
    ("free_max_level", 1, True),
    ("owner_email", "sahip@ornek.com", False),
    ("support_email", "destek@nocta.app", True),
    ("min_app_version", "1.0.0", True),
    ("announcement", None, True),
    ("prices", {"monthly": 139, "yearly": 899, "currency": "TRY"}, True),
    ("free_game_slugs", ["truth_dare", "this_or_that", "would_you_rather"], True),
]

# ─────────────────────────── SQL üretimi ───────────────────────────
def rows(lines):
    return ",\n".join("  (" + ", ".join(r) + ")" for r in lines)

out = []
w = out.append
w("-- Nocta · başlangıç içeriği (seed)")
w("-- Boş bir veritabanında bir kez çalıştırılmak üzere hazırlanmıştır.")
w("-- Satırlar birbirine slug / ad / başlık üzerinden bağlanır; UUID sabit yazılmaz.")
w("-- Seviyeler: 0 Yumuşak · 1 Flörtöz · 2 Cesur · 3 Vahşi")
w("-- Ruh hâlleri: romantik · eglenceli · flortoz · cesur · gizemli · karisik")
w("")
w("begin;")
w("")
w("-- ─────────────────────────────────────────────────────────────")
w("-- Uygulama ayarları")
w("-- ─────────────────────────────────────────────────────────────")
w("insert into public.app_settings (key, value, is_public) values")
w(rows([[q(k), ("'null'::jsonb" if v is None else j(v) + "::jsonb"), "true" if p else "false"] for k, v, p in SETTINGS]))
w("on conflict (key) do nothing;")
w("")
w("-- ─────────────────────────────────────────────────────────────")
w("-- Oyunlar")
w("-- ─────────────────────────────────────────────────────────────")
w("insert into public.games (slug, engine, name, description, icon, color, duration_label, rounds, is_premium, sort) values")
w(rows([[q(s), q(s), q(n), q(d), q(i), q(c), q(dl), str(r), "true" if p else "false", str(k + 1)] for k, (s, n, d, i, c, dl, r, p) in enumerate(GAMES)]))
w(";")
w("")
w("-- ─────────────────────────────────────────────────────────────")
w("-- Kategoriler")
w("-- ─────────────────────────────────────────────────────────────")
w("insert into public.categories (game_id, name, description, icon, color, is_premium, sort)")
w("select g.id, v.name, v.description, v.icon, v.color, v.is_premium, v.sort")
w("from (values")
sortc = {}
crow = []
for (g, n, d, i, c, p) in CATS:
    sortc[g] = sortc.get(g, 0) + 1
    crow.append([q(g), q(n), q(d), q(i), q(c), "true" if p else "false", str(sortc[g])])
w(rows(crow))
w(") as v(game_slug, name, description, icon, color, is_premium, sort)")
w("join public.games g on g.slug = v.game_slug;")
w("")

cat_names = {(g, n) for g, n, *_ in CATS}
game_order = [g[0] for g in GAMES]
for gslug in game_order:
    qs = [x for x in Q if x[0] == gslug]
    if not qs:
        continue
    gname = dict((g[0], g[1]) for g in GAMES)[gslug]
    w("-- ─────────────────────────────────────────────────────────────")
    w(f"-- Sorular · {gname} ({len(qs)})")
    w("-- ─────────────────────────────────────────────────────────────")
    w("insert into public.questions (category_id, text, kind, level, mood, options, timer_seconds)")
    w("select c.id, v.text, v.kind, v.level::smallint, v.mood, v.options::jsonb, v.timer_seconds")
    w("from (values")
    lines = []
    for (g, cat, lvl, mood, text, kind, opts, timer) in qs:
        assert (g, cat) in cat_names, (g, cat)
        lines.append([q(cat), q(text), (q(kind) if kind else "null::text"), str(lvl), q(mood), q(json.dumps(opts, ensure_ascii=False)), (str(timer) if timer else "null::integer")])
    w(rows(lines))
    w(") as v(category, text, kind, level, mood, options, timer_seconds)")
    w(f"join public.games g on g.slug = {q(gslug)}")
    w("join public.categories c on c.game_id = g.id and c.name = v.category;")
    w("")

w("-- ─────────────────────────────────────────────────────────────")
w("-- Çift Hikâyeleri")
w("-- ─────────────────────────────────────────────────────────────")
w("insert into public.stories (title, description, level, cover_color, is_premium, sort) values")
w(rows([[q(t), q(d), str(l), q(c), "true" if p else "false", str(s)] for t, d, l, c, p, s in STORIES]))
w(";")
w("")
w("insert into public.story_scenes (story_id, chapter, title, body, art_note, glow, is_start, is_ending, xp, sort)")
w("select s.id, v.chapter, v.title, v.body, v.art_note, v.glow, v.is_start, v.is_ending, v.xp, v.sort")
w("from (values")
w(rows([[q(st), q(ch), q(ti), q(bo), q(an), q(gl), "true" if isS else "false", "true" if isE else "false", str(xp), str(so)] for st, ch, ti, bo, an, gl, isS, isE, xp, so in SCENES]))
w(") as v(story_title, chapter, title, body, art_note, glow, is_start, is_ending, xp, sort)")
w("join public.stories s on s.title = v.story_title;")
w("")
w("insert into public.story_choices (scene_id, text, next_scene_id, sort)")
w("select src.id, v.text, dst.id, v.sort")
w("from (values")
w(rows([[q(st), q(fr), q(tx), q(to), str(so)] for st, fr, tx, to, so in CHOICES]))
w(") as v(story_title, from_scene, text, to_scene, sort)")
w("join public.stories s on s.title = v.story_title")
w("join public.story_scenes src on src.story_id = s.id and src.title = v.from_scene")
w("join public.story_scenes dst on dst.story_id = s.id and dst.title = v.to_scene;")
w("")
w("-- ─────────────────────────────────────────────────────────────")
w("-- Rozetler")
w("-- ─────────────────────────────────────────────────────────────")
w("insert into public.achievements (code, name, description, icon, target, sort) values")
w(rows([[q(c), q(n), q(d), q(i), str(t), str(k + 1)] for k, (c, n, d, i, t) in enumerate(ACH)]))
w(";")
w("")
w("commit;")
w("")

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write("\n".join(out))

# ─────────── Doğrulama verisi (kontrol betiği için) ───────────
scene_titles = {}
for st, ch, ti, *_ in SCENES:
    key = (st, ti)
    assert key not in scene_titles, key
    scene_titles[key] = True
for st, fr, tx, to, so in CHOICES:
    assert (st, fr) in scene_titles and (st, to) in scene_titles, (st, fr, to)
print("ok", len(Q))
