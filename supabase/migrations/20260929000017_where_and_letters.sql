-- Nocta · "Burası Neresi?" oyunu ve "Sevgiliye Mektup"
-- Doğru cevap ve ipuçlarının açık hâli istemcilerin okuyamadığı game_secrets tablosunda tutulur;
-- tahmin eden kişiye yalnızca yıldızlanmış (eksik) ipuçları gönderilir.

alter table public.games drop constraint games_engine_check;
alter table public.games add constraint games_engine_check check (engine in
  ('truth_dare','would_you_rather','know_me','challenges','secret_questions','this_or_that','story','chat_game',
   'quiz','emoji','cards','roulette','shots','where','letters'));

-- start_session: "where" soru gerektirmez; ilk fotoğrafı oyunu başlatan çeker
do $$ declare d text; begin
  d := pg_get_functiondef('public.start_session(text, uuid, uuid)'::regprocedure);
  d := replace(d, E'  elsif g.engine = ''roulette'' then',
    E'  elsif g.engine = ''where'' then\n    st_state := jsonb_build_object(''phase'', ''shoot'', ''round'', 0, ''hints'', ''[]''::jsonb, ''history'', ''[]''::jsonb, ''scores'', ''{}''::jsonb);\n  elsif g.engine = ''roulette'' then');
  execute d;
end $$;

-- ───────────────────────────── BURASI NERESİ? ─────────────────────────────
-- İpucunu "belli belirsiz" hâle getirir: harflerin yaklaşık yarısı * olur, boşluk ve noktalama korunur.
create or replace function public._where_mask(p_text text) returns text
language plpgsql volatile set search_path = public as $$
declare res text := ''; ch text; i int; word_pos int := 0; masked_in_word int := 0;
begin
  for i in 1..char_length(p_text) loop
    ch := substr(p_text, i, 1);
    if ch ~ '[[:alnum:]]' then
      word_pos := word_pos + 1;
      -- kelimenin ilk harfi daha sık görünür; diğerleri ~%55 ihtimalle gizlenir
      if (word_pos = 1 and random() < 0.3) or (word_pos > 1 and random() < 0.55) then
        res := res || '*'; masked_in_word := masked_in_word + 1;
      else
        res := res || ch;
      end if;
    else
      word_pos := 0; masked_in_word := 0;
      res := res || ch;
    end if;
  end loop;
  -- hiç gizlenmemişse (çok kısa metin) en az bir harfi gizle
  if position('*' in res) = 0 and char_length(res) > 1 then
    i := 2 + floor(random() * (char_length(res) - 1))::int;
    res := overlay(res placing '*' from least(i, char_length(res)) for 1);
  end if;
  return res;
end $$;
revoke execute on function public._where_mask(text) from public, anon, authenticated;

-- Fotoğrafı gönder (fotoğrafı çeken): doğru cevap gizli saklanır, yanıltıcı öneriler palyaçoya verilir
create or replace function public.where_submit(p_session uuid, p_photo text, p_answer text, p_decoys text[])
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; shooter uuid; guesser uuid; decoys jsonb;
begin
  s := public._game_lock(p_session, 'where');
  if s.state->>'phase' <> 'shoot' then raise exception 'Şu an fotoğraf gönderilemez.'; end if;
  shooter := coalesce((s.state->>'shooter')::uuid, s.created_by);
  if shooter <> auth.uid() then raise exception 'Bu tur fotoğrafı partnerin çekiyor.'; end if;
  if p_photo is null or split_part(p_photo, '/', 1) <> s.couple_id::text then raise exception 'Geçersiz fotoğraf.'; end if;
  if coalesce(length(trim(p_answer)), 0) < 2 then raise exception 'Doğru cevabı yaz.'; end if;
  select coalesce(jsonb_agg(left(trim(d), 60) order by random()), '[]'::jsonb) into decoys
    from unnest(coalesce(p_decoys, '{}')) d where length(trim(d)) > 0;
  if jsonb_array_length(decoys) < 1 or jsonb_array_length(decoys) > 3 then
    raise exception 'Palyaço için 1–3 yanıltıcı öneri yaz.';
  end if;
  guesser := public._partner_of(s.couple_id, shooter);

  insert into game_secrets (session_id, data) values (s.id, jsonb_build_object('answer', left(trim(p_answer), 80), 'raw_hints', '[]'::jsonb))
  on conflict (session_id) do update set data = game_secrets.data || jsonb_build_object('answer', left(trim(p_answer), 80), 'raw_hints', '[]'::jsonb);

  s.state := s.state || jsonb_build_object(
    'phase', 'guess', 'shooter', shooter, 'guesser', guesser, 'photo', p_photo,
    'clown', decoys, 'hints', '[]'::jsonb, 'hints_left', 3, 'hint_pending', false,
    'guess', null, 'from_clown', false, 'correct', null, 'answer', null);
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

-- Tahmin eden partnerinden ipucu ister (turda en fazla 3)
create or replace function public.where_ask_hint(p_session uuid)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions;
begin
  s := public._game_lock(p_session, 'where');
  if s.state->>'phase' <> 'guess' then raise exception 'Şu an ipucu istenemez.'; end if;
  if (s.state->>'guesser')::uuid <> auth.uid() then raise exception 'İpucunu tahmin eden ister.'; end if;
  if coalesce((s.state->>'hint_pending')::boolean, false) then return s; end if;
  if coalesce((s.state->>'hints_left')::int, 0) <= 0 then raise exception 'İpucu hakkın kalmadı.'; end if;
  s.state := s.state || jsonb_build_object('hint_pending', true, 'hints_left', (s.state->>'hints_left')::int - 1);
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

-- Fotoğrafı çeken ipucunu yazar; tahmin edene yalnızca yıldızlı hâli gider
create or replace function public.where_give_hint(p_session uuid, p_text text)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; t text;
begin
  s := public._game_lock(p_session, 'where');
  if s.state->>'phase' <> 'guess' or not coalesce((s.state->>'hint_pending')::boolean, false) then
    raise exception 'Bekleyen bir ipucu isteği yok.';
  end if;
  if (s.state->>'shooter')::uuid <> auth.uid() then raise exception 'İpucunu fotoğrafı çeken verir.'; end if;
  t := left(trim(coalesce(p_text, '')), 120);
  if length(t) < 2 then raise exception 'İpucunu yaz.'; end if;
  update game_secrets set data = data || jsonb_build_object('raw_hints', coalesce(data->'raw_hints', '[]'::jsonb) || to_jsonb(t))
    where session_id = s.id;
  s.state := s.state || jsonb_build_object('hint_pending', false,
    'hints', coalesce(s.state->'hints', '[]'::jsonb) || to_jsonb(public._where_mask(t)));
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

-- Tahmin gönder (palyaçonun önerisi kabul edildiyse p_from_clown = true)
create or replace function public.where_guess(p_session uuid, p_text text, p_from_clown boolean default false)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; t text;
begin
  s := public._game_lock(p_session, 'where');
  if s.state->>'phase' <> 'guess' then raise exception 'Şu an tahmin yapılamaz.'; end if;
  if (s.state->>'guesser')::uuid <> auth.uid() then raise exception 'Bu tur tahmin sırası partnerinde.'; end if;
  t := left(trim(coalesce(p_text, '')), 80);
  if length(t) < 1 then raise exception 'Tahminini yaz.'; end if;
  s.state := s.state || jsonb_build_object('phase', 'judge', 'guess', t, 'from_clown', coalesce(p_from_clown, false), 'hint_pending', false);
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

-- Fotoğrafı çeken tahmini değerlendirir → cevap ve fotoğraf açılır
create or replace function public.where_judge(p_session uuid, p_correct boolean)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; sec jsonb; g uuid; sc jsonb; correct boolean;
begin
  s := public._game_lock(p_session, 'where');
  if s.state->>'phase' <> 'judge' then raise exception 'Değerlendirilecek bir tahmin yok.'; end if;
  if (s.state->>'shooter')::uuid <> auth.uid() then raise exception 'Tahmini fotoğrafı çeken değerlendirir.'; end if;
  select data into sec from game_secrets where session_id = s.id;
  -- palyaçonun önerisi her zaman yanlıştır
  correct := coalesce(p_correct, false) and not coalesce((s.state->>'from_clown')::boolean, false);
  g := (s.state->>'guesser')::uuid;
  sc := coalesce(s.state->'scores', '{}'::jsonb);
  if correct then sc := sc || jsonb_build_object(g::text, coalesce((sc->>g::text)::int, 0) + 1); end if;

  insert into session_answers (session_id, round, user_id, answer)
  values (s.id, s.current_index, g, jsonb_build_object('choice', case when correct then 'correct' else 'wrong' end,
          'guess', s.state->>'guess', 'answer', sec->>'answer', 'from_clown', s.state->'from_clown'))
  on conflict (session_id, round, user_id) do nothing;

  s.state := s.state || jsonb_build_object(
    'phase', 'reveal', 'correct', correct, 'answer', sec->>'answer',
    'raw_hints', coalesce(sec->'raw_hints', '[]'::jsonb), 'scores', sc,
    'reveal_nonce', coalesce((s.state->>'reveal_nonce')::int, 0) + 1,
    'history', coalesce(s.state->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'shooter', s.state->>'shooter', 'guesser', g, 'photo', s.state->>'photo', 'answer', sec->>'answer',
      'guess', s.state->>'guess', 'correct', correct, 'from_clown', s.state->'from_clown',
      'hints_used', 3 - coalesce((s.state->>'hints_left')::int, 3))));
  update game_sessions set state = s.state, current_index = current_index + 1 where id = s.id returning * into s;
  return s;
end $$;

-- Sonraki tur: roller değişir
create or replace function public.where_next(p_session uuid)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions;
begin
  s := public._game_lock(p_session, 'where');
  if s.state->>'phase' <> 'reveal' then return s; end if;
  s.state := s.state || jsonb_build_object(
    'phase', 'shoot', 'round', coalesce((s.state->>'round')::int, 0) + 1,
    'shooter', s.state->>'guesser', 'guesser', s.state->>'shooter',
    'photo', null, 'clown', '[]'::jsonb, 'hints', '[]'::jsonb, 'raw_hints', '[]'::jsonb, 'hints_left', 3,
    'hint_pending', false, 'guess', null, 'from_clown', false, 'correct', null, 'answer', null);
  update game_secrets set data = '{}'::jsonb where session_id = s.id;
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

grant execute on function public.where_submit(uuid, text, text, text[]), public.where_ask_hint(uuid),
  public.where_give_hint(uuid, text), public.where_guess(uuid, text, boolean), public.where_judge(uuid, boolean),
  public.where_next(uuid) to authenticated;
revoke execute on function public.where_submit(uuid, text, text, text[]), public.where_ask_hint(uuid),
  public.where_give_hint(uuid, text), public.where_guess(uuid, text, boolean), public.where_judge(uuid, boolean),
  public.where_next(uuid) from anon, public;

do $$ begin
  execute replace(pg_get_functiondef('public.finish_session(uuid)'::regprocedure),
    'when g.engine = ''roulette'' then',
    'when g.engine = ''where'' then (select count(*) from jsonb_array_elements(coalesce(s.state->''history'', ''[]''::jsonb)) e where (e->>''correct'')::boolean) || '' doğru tahmin · '' || rounds_played || '' fotoğraf''
      when g.engine = ''roulette'' then');
end $$;

-- ───────────────────────────── SEVGİLİYE MEKTUP ─────────────────────────────
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  reply_to uuid references public.letters(id) on delete set null,
  body text not null check (char_length(body) between 1 and 8000),
  paper text not null default 'cream' check (paper in ('cream','rose','night')),
  deliver_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists letters_recipient on public.letters(recipient_id, delivered_at desc);
create index if not exists letters_due on public.letters(deliver_at) where delivered_at is null;
create index if not exists letters_couple on public.letters(couple_id, created_at desc);

alter table public.letters enable row level security;
-- Gönderen kendi mektuplarını her zaman görür; alıcı yalnızca teslim edildikten sonra görür
create policy letters_select on public.letters for select to authenticated using (
  sender_id = auth.uid() or (recipient_id = auth.uid() and delivered_at is not null)
);
alter publication supabase_realtime add table public.letters;

create or replace function public._deliver_letter(l public.letters) returns void
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  update letters set delivered_at = now() where id = l.id and delivered_at is null;
  if not found then return; end if;
  select display_name into nm from profiles where id = l.sender_id;
  perform public.notify_user(l.recipient_id, 'letter', 'mail',
    '💌 Bir mektubun var',
    coalesce(nullif(nm, ''), 'Partnerin') || ' sana okyanusun öbür ucundan bir mektup gönderdi.',
    jsonb_build_object('route', '/letters/' || l.id, 'letter_id', l.id));
end $$;
revoke execute on function public._deliver_letter(public.letters) from public, anon, authenticated;

-- Mektup gönder: p_deliver_at boş ya da geçmişse anında teslim edilir
create or replace function public.send_letter(p_body text, p_deliver_at timestamptz default null,
  p_reply_to uuid default null, p_paper text default 'cream')
returns public.letters language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_active_couple_id(); partner uuid; l letters; v_at timestamptz;
begin
  if cid is null then raise exception 'Mektup göndermek için partnerinle eşleşmelisin.'; end if;
  if coalesce(length(trim(p_body)), 0) < 1 then raise exception 'Mektubun boş olamaz.'; end if;
  v_at := coalesce(p_deliver_at, now());
  if v_at > now() + interval '366 days' then raise exception 'En fazla bir yıl sonrasına mektup gönderebilirsin.'; end if;
  if p_reply_to is not null and not exists (
    select 1 from letters where id = p_reply_to and couple_id = cid and recipient_id = auth.uid() and delivered_at is not null
  ) then raise exception 'Yanıtlanacak mektup bulunamadı.'; end if;
  partner := public._partner_of(cid, auth.uid());
  insert into letters (couple_id, sender_id, recipient_id, reply_to, body, paper, deliver_at)
  values (cid, auth.uid(), partner, p_reply_to, trim(p_body), coalesce(p_paper, 'cream'), greatest(v_at, now()))
  returning * into l;
  if l.deliver_at <= now() + interval '5 seconds' then
    perform public._deliver_letter(l);
    select * into l from letters where id = l.id;
  end if;
  return l;
end $$;

-- Teslim edilmemiş mektubu geri çek
create or replace function public.cancel_letter(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from letters where id = p_id and sender_id = auth.uid() and delivered_at is null;
  if not found then raise exception 'Bu mektup artık geri çekilemez.'; end if;
end $$;

create or replace function public.mark_letter_read(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update letters set read_at = coalesce(read_at, now())
    where id = p_id and recipient_id = auth.uid() and delivered_at is not null;
end $$;

grant execute on function public.send_letter(text, timestamptz, uuid, text), public.cancel_letter(uuid),
  public.mark_letter_read(uuid) to authenticated;
revoke execute on function public.send_letter(text, timestamptz, uuid, text), public.cancel_letter(uuid),
  public.mark_letter_read(uuid) from anon, public;

-- Zamanı gelen mektupları her dakika teslim et
create or replace function public.deliver_due_letters() returns int
language plpgsql security definer set search_path = public as $$
declare l letters; n int := 0;
begin
  for l in select * from letters where delivered_at is null and deliver_at <= now() order by deliver_at limit 500 loop
    perform public._deliver_letter(l);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.deliver_due_letters() from public, anon, authenticated;
select cron.schedule('nocta-letters', '* * * * *', $$select public.deliver_due_letters()$$);

-- Oyun kartları
insert into public.games (slug, engine, name, description, icon, color, duration_label, rounds, is_premium, sort) values
 ('where', 'where', 'Burası Neresi?', 'Sırayla fotoğraf çekin; buzlu fotoğraftan yeri tahmin et. 3 ipucu hakkın var ama ipuçları yıldızlı gelir… ve palyaçoya kanma!', 'travel_explore', '#211F3A', '15 dk · Keşif', 10, false, 14),
 ('letters', 'letters', 'Sevgiliye Mektup', 'Söyleyemediklerini yaz, şişeye koy, okyanusa bırak. İstersen hemen, istersen ileri bir tarihte ulaşsın.', 'mail', '#3A2A1D', 'Sınırsız · Duygusal', 1, false, 15)
on conflict (slug) do nothing;
