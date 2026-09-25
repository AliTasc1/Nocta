-- Nocta · yardımcı fonksiyonlar ve RPC'ler

-- ─────────────────────────────────────────────────────────────
-- Yardımcılar
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid() and active);
$$;

create or replace function public.admin_role() returns text
language sql stable security definer set search_path = public as $$
  select role from admins where user_id = auth.uid() and active;
$$;

create or replace function public.my_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from couples
  where (user_a = auth.uid() or user_b = auth.uid()) and status in ('pending','active')
  order by created_at desc limit 1;
$$;

create or replace function public.my_active_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from couples
  where (user_a = auth.uid() or user_b = auth.uid()) and status = 'active'
  limit 1;
$$;

create or replace function public.my_partner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select case when user_a = auth.uid() then user_b else user_a end
  from couples where id = public.my_active_couple_id();
$$;

create or replace function public.is_couple_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from couples where id = cid and (user_a = auth.uid() or user_b = auth.uid()));
$$;

create or replace function public.setting(k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from app_settings where key = k;
$$;

create or replace function public.couple_is_premium(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions s
    where s.status in ('trial','active','canceled')
      and (s.expires_at is null or s.expires_at > now())
      and (
        s.couple_id = cid
        or s.user_id in (select user_a from couples where id = cid union select user_b from couples where id = cid)
      )
  );
$$;

create or replace function public.i_am_premium() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.couple_is_premium(public.my_couple_id()), false)
      or exists (
        select 1 from subscriptions s where s.user_id = auth.uid()
          and s.status in ('trial','active','canceled')
          and (s.expires_at is null or s.expires_at > now())
      );
$$;

create or replace function public.free_max_level() returns smallint
language sql stable security definer set search_path = public as $$
  select coalesce((public.setting('free_max_level'))::text::smallint, 1::smallint);
$$;

-- Çiftin ortak seviyesi = iki partnerin seçtiğinin en düşüğü (premium değilse ücretsiz sınırla)
create or replace function public.couple_effective_level(cid uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select least(
    coalesce((select p.level from profiles p join couples c on c.user_a = p.id where c.id = cid), 0),
    coalesce((select p.level from profiles p join couples c on c.user_b = p.id where c.id = cid), 3),
    case when public.couple_is_premium(cid) then 3 else public.free_max_level() end
  )::smallint;
$$;

create or replace function public.today_tr() returns date
language sql stable as $$ select (now() at time zone 'Europe/Istanbul')::date; $$;

-- XP → Flirt Level
create or replace function public.flirt_level(xp integer) returns jsonb
language sql immutable as $$
  select case
    when xp >= 2000 then jsonb_build_object('level',5,'name','Durdurulamaz','floor',2000,'next',null)
    when xp >= 1000 then jsonb_build_object('level',4,'name','Yakın','floor',1000,'next',2000)
    when xp >= 500  then jsonb_build_object('level',3,'name','Flörtöz','floor',500,'next',1000)
    when xp >= 200  then jsonb_build_object('level',2,'name','Meraklı','floor',200,'next',500)
    else jsonb_build_object('level',1,'name','Başlangıç','floor',0,'next',200)
  end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Push bildirimleri (Expo) — pg_net ile doğrudan Expo Push API'ye
-- ─────────────────────────────────────────────────────────────
create extension if not exists pg_net with schema extensions;

create or replace function public.push_to_user(uid uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare tok text; enabled boolean;
begin
  select expo_push_token, coalesce((settings->>'notifications')::boolean, true)
    into tok, enabled from profiles where id = uid;
  if tok is null or not enabled then return; end if;
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object('to', tok, 'title', p_title, 'body', p_body, 'data', p_data, 'sound', 'default'),
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb
    );
  exception when others then
    -- push hatası hiçbir zaman asıl işlemi bozmamalı
    null;
  end;
end $$;

create or replace function public.notify_user(uid uuid, p_kind text, p_icon text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if uid is null then return; end if;
  insert into notifications (user_id, kind, icon, title, body, data) values (uid, p_kind, p_icon, p_title, p_body, p_data);
  perform public.push_to_user(uid, p_title, p_body, p_data || jsonb_build_object('kind', p_kind));
end $$;

-- ─────────────────────────────────────────────────────────────
-- Profil koruması: kullanıcı kendi durumunu (askıya alma) değiştiremez
-- ─────────────────────────────────────────────────────────────
create or replace function public.protect_profile() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not public.is_admin() then
    new.status := old.status;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- ─────────────────────────────────────────────────────────────
-- Eşleşme: oda oluştur / koda katıl / bağlantıyı kopar
-- ─────────────────────────────────────────────────────────────
create or replace function public.gen_invite_code() returns text language plpgsql as $$
declare letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ'; code text; i int;
begin
  loop
    code := '';
    for i in 1..4 loop code := code || substr(letters, 1 + floor(random()*length(letters))::int, 1); end loop;
    code := code || '-' || lpad(floor(random()*10000)::int::text, 4, '0');
    exit when not exists (select 1 from couples where invite_code = code);
  end loop;
  return code;
end $$;

create or replace function public.create_couple() returns public.couples
language plpgsql security definer set search_path = public as $$
declare c couples;
begin
  if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
  select * into c from couples where (user_a = auth.uid() or user_b = auth.uid()) and status in ('pending','active') limit 1;
  if found then return c; end if;
  insert into couples (user_a, invite_code) values (auth.uid(), public.gen_invite_code()) returning * into c;
  return c;
end $$;

create or replace function public.refresh_invite_code() returns public.couples
language plpgsql security definer set search_path = public as $$
declare c couples;
begin
  update couples set invite_code = public.gen_invite_code()
  where user_a = auth.uid() and status = 'pending' returning * into c;
  if not found then raise exception 'Yenilenecek bekleyen bir oda yok'; end if;
  return c;
end $$;

create or replace function public.join_couple(p_code text) returns public.couples
language plpgsql security definer set search_path = public as $$
declare c couples; me uuid := auth.uid(); code text; my_name text;
begin
  if me is null then raise exception 'Oturum gerekli'; end if;
  code := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
  if length(code) = 8 then code := substr(code,1,4) || '-' || substr(code,5,4); end if;

  select * into c from couples where invite_code = code for update;
  if not found or c.status <> 'pending' then
    raise exception 'Bu kod geçersiz ya da süresi dolmuş.' using errcode = 'P0002';
  end if;
  if c.user_a = me then raise exception 'Kendi oda koduna katılamazsın.' using errcode = 'P0003'; end if;
  if exists (select 1 from blocks where (blocker_id = c.user_a and blocked_id = me) or (blocker_id = me and blocked_id = c.user_a)) then
    raise exception 'Bu kod geçersiz ya da süresi dolmuş.' using errcode = 'P0002';
  end if;
  -- Katılanın kendi bekleyen odası varsa kapat
  delete from couples where user_a = me and status = 'pending' and user_b is null;
  if exists (select 1 from couples where (user_a = me or user_b = me) and status = 'active') then
    raise exception 'Zaten bir partnere bağlısın.' using errcode = 'P0004';
  end if;

  update couples set user_b = me, status = 'active', connected_at = now(), invite_code = code || '-' || substr(md5(random()::text),1,4)
  where id = c.id returning * into c;

  insert into memories (couple_id, created_by, kind, title, subtitle, color)
  values (c.id, me, 'first', 'Bağlandınız', 'Nocta''daki ilk geceniz başladı.', '#7FD1AE');

  select display_name into my_name from profiles where id = me;
  perform public.notify_user(c.user_a, 'connected', 'favorite', 'Bağlandınız! ♡', coalesce(my_name,'Partnerin') || ' odana katıldı.', jsonb_build_object('route','/connected'));
  perform public.check_achievements(c.id);
  return c;
end $$;

create or replace function public.disconnect_partner(p_block boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare c couples; partner uuid;
begin
  select * into c from couples where (user_a = auth.uid() or user_b = auth.uid()) and status in ('active','pending') limit 1;
  if not found then return; end if;
  partner := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
  update couples set status = 'disconnected', ended_at = now() where id = c.id;
  update game_sessions set status = 'canceled' where couple_id = c.id and status in ('lobby','playing');
  if p_block and partner is not null then
    insert into blocks (blocker_id, blocked_id) values (auth.uid(), partner) on conflict do nothing;
  end if;
  if partner is not null then
    perform public.notify_user(partner, 'disconnected', 'link_off', 'Bağlantı sona erdi', 'Bu oda artık kapalı.', '{}'::jsonb);
  end if;
end $$;

create or replace function public.set_anniversary(p_date date) returns void
language plpgsql security definer set search_path = public as $$
begin
  update couples set anniversary = p_date where id = public.my_couple_id();
end $$;

-- ─────────────────────────────────────────────────────────────
-- Oyun oturumları
-- ─────────────────────────────────────────────────────────────
create or replace function public.pick_questions(p_game uuid, p_category uuid, p_level smallint, p_n int, p_kind text default null)
returns uuid[] language sql volatile security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from (
    select q.id from questions q join categories c on c.id = q.category_id
    where c.game_id = p_game and c.is_active and q.is_active
      and (p_category is null or c.id = p_category)
      and q.level <= p_level
      and (p_kind is null or q.kind = p_kind)
    order by random() limit p_n
  ) s;
$$;

create or replace function public.start_session(p_game_slug text, p_category uuid default null, p_story uuid default null)
returns public.game_sessions
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public.my_active_couple_id();
  g games; cat categories; st stories; s game_sessions;
  lvl smallint; premium boolean; qids uuid[] := '{}'; st_state jsonb := '{}'::jsonb;
  start_scene uuid; partner uuid; me_name text;
begin
  if cid is null then raise exception 'Önce partnerine bağlanmalısın.' using errcode = 'P0010'; end if;
  select * into g from games where slug = p_game_slug and is_active;
  if not found then raise exception 'Bu oyun şu an kullanılamıyor.' using errcode = 'P0011'; end if;
  premium := public.couple_is_premium(cid);
  if g.is_premium and not premium then raise exception 'PREMIUM_REQUIRED' using errcode = 'P0020'; end if;
  if p_category is not null then
    select * into cat from categories where id = p_category and game_id = g.id and is_active;
    if not found then raise exception 'Kategori bulunamadı.' using errcode = 'P0012'; end if;
    if cat.is_premium and not premium then raise exception 'PREMIUM_REQUIRED' using errcode = 'P0020'; end if;
  end if;
  lvl := public.couple_effective_level(cid);

  if g.engine = 'story' then
    if p_story is null then
      select * into st from stories where is_active and level <= lvl and (premium or not is_premium) order by sort, created_at limit 1;
    else
      select * into st from stories where id = p_story and is_active;
    end if;
    if st.id is null then raise exception 'Uygun hikâye bulunamadı.' using errcode = 'P0013'; end if;
    if st.is_premium and not premium then raise exception 'PREMIUM_REQUIRED' using errcode = 'P0020'; end if;
    select id into start_scene from story_scenes where story_id = st.id order by is_start desc, sort, created_at limit 1;
    if start_scene is null then raise exception 'Bu hikâyenin sahnesi yok.' using errcode = 'P0013'; end if;
    st_state := jsonb_build_object('story_id', st.id, 'scene_id', start_scene, 'path', jsonb_build_array(start_scene));
  elsif g.engine = 'truth_dare' then
    st_state := jsonb_build_object(
      'truths', to_jsonb(public.pick_questions(g.id, p_category, lvl, 30, 'truth')),
      'dares',  to_jsonb(public.pick_questions(g.id, p_category, lvl, 30, 'dare')),
      'turn', 0, 'pick', null, 'current', null, 'ti', 0, 'di', 0
    );
    if jsonb_array_length(st_state->'truths') + jsonb_array_length(st_state->'dares') = 0 then
      raise exception 'Bu seviyede henüz soru yok.' using errcode = 'P0014';
    end if;
  else
    qids := public.pick_questions(g.id, p_category, lvl, g.rounds);
    if coalesce(array_length(qids,1),0) = 0 then
      raise exception 'Bu seviyede henüz soru yok.' using errcode = 'P0014';
    end if;
    if g.engine = 'know_me' then
      -- her turda kimin hakkında soru sorulduğu sırayla değişir
      st_state := jsonb_build_object('subject_first', auth.uid());
    end if;
  end if;

  update game_sessions set status = 'canceled' where couple_id = cid and status in ('lobby','playing');

  insert into game_sessions (couple_id, game_id, category_id, created_by, level, question_ids, state, ready)
  values (cid, g.id, p_category, auth.uid(), lvl, qids, st_state, array[auth.uid()])
  returning * into s;

  select case when user_a = auth.uid() then user_b else user_a end into partner from couples where id = cid;
  select display_name into me_name from profiles where id = auth.uid();
  perform public.notify_user(partner, 'invite', 'playing_cards', coalesce(me_name,'Partnerin') || ' seni oyuna çağırıyor',
    g.name || ' · lobide seni bekliyor.', jsonb_build_object('route','/lobby/' || s.id));
  return s;
end $$;

create or replace function public.set_ready(p_session uuid, p_ready boolean default true) returns public.game_sessions
language plpgsql security definer set search_path = public as $$
declare s game_sessions; c couples;
begin
  select * into s from game_sessions where id = p_session for update;
  if not found or not public.is_couple_member(s.couple_id) then raise exception 'Oturum bulunamadı'; end if;
  if s.status <> 'lobby' then return s; end if;
  if p_ready then
    if not (auth.uid() = any(s.ready)) then s.ready := array_append(s.ready, auth.uid()); end if;
  else
    s.ready := array_remove(s.ready, auth.uid());
  end if;
  select * into c from couples where id = s.couple_id;
  if c.user_a = any(s.ready) and c.user_b = any(s.ready) then
    update game_sessions set ready = s.ready, status = 'playing', started_at = now() + interval '4 seconds'
      where id = s.id returning * into s;
  else
    update game_sessions set ready = s.ready where id = s.id returning * into s;
  end if;
  return s;
end $$;

-- Oturum durumu güncelleme (tur ilerletme, Truth/Dare seçimi, hikâye sahnesi)
create or replace function public.update_session(p_session uuid, p_current_index int default null, p_state jsonb default null)
returns public.game_sessions
language plpgsql security definer set search_path = public as $$
declare s game_sessions;
begin
  select * into s from game_sessions where id = p_session for update;
  if not found or not public.is_couple_member(s.couple_id) then raise exception 'Oturum bulunamadı'; end if;
  if s.status <> 'playing' then return s; end if;
  update game_sessions set
    current_index = coalesce(p_current_index, current_index),
    state = case when p_state is null then state else state || p_state end
  where id = s.id returning * into s;
  return s;
end $$;

create or replace function public.cancel_session(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update game_sessions set status = 'canceled'
  where id = p_session and public.is_couple_member(couple_id) and status in ('lobby','playing');
end $$;

create or replace function public.bump_streak(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c couples; t date := public.today_tr();
begin
  select * into c from couples where id = cid;
  if c.last_play_date = t then return; end if;
  update couples set
    streak_days = case when c.last_play_date = t - 1 then streak_days + 1 else 1 end,
    last_play_date = t
  where id = cid;
end $$;

create or replace function public.finish_session(p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s game_sessions; g games; c couples;
  rounds_played int; matches int := 0; xp_gain int := 50; sc story_scenes;
  title text; subtitle text; color text := '#E7688A'; kind text := 'game';
begin
  select * into s from game_sessions where id = p_session for update;
  if not found or not public.is_couple_member(s.couple_id) then raise exception 'Oturum bulunamadı'; end if;
  select * into g from games where id = s.game_id;
  if s.status = 'finished' then
    return jsonb_build_object('session', to_jsonb(s), 'xp', 0, 'already', true);
  end if;

  select count(distinct round) into rounds_played from session_answers where session_id = s.id;

  if g.engine in ('would_you_rather','this_or_that','secret_questions','know_me') then
    select count(*) into matches from (
      select round from session_answers where session_id = s.id
      group by round having count(*) = 2 and count(distinct answer->>'choice') = 1 and bool_and(answer ? 'choice')
    ) m;
  end if;

  if g.engine = 'story' then
    select * into sc from story_scenes where id = (s.state->>'scene_id')::uuid;
    xp_gain := greatest(coalesce(sc.xp, 0), 100);
    kind := 'story'; color := '#F2C27B';
    title := 'Çift Hikâyesi · ' || coalesce((select title from stories where id = (s.state->>'story_id')::uuid), 'Hikâye');
    subtitle := coalesce(nullif(sc.title,''), 'Birlikte bir son seçtiniz.');
  else
    xp_gain := 30 + least(rounds_played, 20) * 5;
    title := g.name || ' — ' || rounds_played || ' tur';
    subtitle := case
      when g.engine in ('would_you_rather','this_or_that') then matches || '/' || rounds_played || ' eşleşme'
      when g.engine = 'know_me' then matches || ' doğru tahmin'
      when g.engine = 'secret_questions' then rounds_played || ' sır açıldı'
      else 'Birlikte oynadınız.' end;
    if g.engine = 'challenges' then kind := 'challenge'; color := '#F4B9C8'; end if;
  end if;

  update game_sessions set status = 'finished', finished_at = now(),
    score = jsonb_build_object('rounds', rounds_played, 'matches', matches, 'xp', xp_gain,
                               'perfect', rounds_played > 0 and matches = rounds_played and g.engine in ('would_you_rather','this_or_that'))
  where id = s.id returning * into s;

  insert into question_usage (question_id, count)
  select distinct question_id, 1 from session_answers where session_id = s.id and question_id is not null
  on conflict (question_id) do update set count = question_usage.count + 1;

  update couples set xp = xp + xp_gain where id = s.couple_id returning * into c;
  perform public.bump_streak(s.couple_id);

  insert into memories (couple_id, created_by, kind, title, subtitle, color)
  values (s.couple_id, auth.uid(), kind, title, subtitle, color);

  perform public.check_achievements(s.couple_id);
  return jsonb_build_object('session', to_jsonb(s), 'xp', xp_gain, 'matches', matches, 'rounds', rounds_played,
                            'couple_xp', c.xp, 'flirt', public.flirt_level(c.xp));
end $$;

-- Hikâye seçimi istatistiği
create or replace function public.record_story_choice(p_choice uuid) returns void
language sql security definer set search_path = public as $$
  insert into story_choice_stats (choice_id, count) values (p_choice, 1)
  on conflict (choice_id) do update set count = story_choice_stats.count + 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- Günlük görev
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_daily_challenge() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_couple_id(); lvl smallint; q questions; done challenge_completions; t date := public.today_tr(); secs int; n int;
begin
  lvl := case when cid is null then 0 else public.couple_effective_level(cid) end;
  select count(*) into n from questions q join categories c on c.id = q.category_id join games g on g.id = c.game_id
    where g.engine = 'challenges' and q.is_active and c.is_active and q.level <= lvl and not c.is_premium;
  if n = 0 then return jsonb_build_object('question', null); end if;
  select q.* into q from questions q join categories c on c.id = q.category_id join games g on g.id = c.game_id
    where g.engine = 'challenges' and q.is_active and c.is_active and q.level <= lvl and not c.is_premium
    order by md5(coalesce(cid::text,'x') || t::text || q.id::text) limit 1;
  select * into done from challenge_completions where couple_id = cid and day = t;
  secs := extract(epoch from ((t + 1)::timestamp at time zone 'Europe/Istanbul') - now())::int;
  return jsonb_build_object('question', to_jsonb(q), 'completed', done.id is not null and not done.skipped,
    'skipped', coalesce(done.skipped,false), 'seconds_left', secs, 'day', t);
end $$;

create or replace function public.complete_daily_challenge(p_question uuid, p_skipped boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_active_couple_id(); c couples; partner uuid; nm text;
begin
  if cid is null then raise exception 'Önce partnerine bağlanmalısın.' using errcode = 'P0010'; end if;
  insert into challenge_completions (couple_id, question_id, day, completed_by, skipped)
  values (cid, p_question, public.today_tr(), auth.uid(), p_skipped)
  on conflict (couple_id, day) do update set skipped = excluded.skipped, completed_by = excluded.completed_by
    where challenge_completions.skipped;
  if p_skipped then return jsonb_build_object('xp', 0); end if;
  update couples set xp = xp + 30 where id = cid returning * into c;
  perform public.bump_streak(cid);
  insert into memories (couple_id, created_by, kind, title, subtitle, color)
  values (cid, auth.uid(), 'challenge', 'Günün görevi tamamlandı',
          coalesce((select text from questions where id = p_question), ''), '#F4B9C8');
  partner := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
  select display_name into nm from profiles where id = auth.uid();
  perform public.notify_user(partner, 'challenge_done', 'nightlight', coalesce(nm,'Partnerin') || ' günün görevini tamamladı', '+30 XP kazandınız.', jsonb_build_object('route','/'));
  perform public.check_achievements(cid);
  return jsonb_build_object('xp', 30, 'couple_xp', c.xp);
end $$;

-- Sohbet oyunu için rastgele görev
create or replace function public.random_chat_prompt() returns public.questions
language sql volatile security definer set search_path = public as $$
  select q.* from questions q join categories c on c.id = q.category_id join games g on g.id = c.game_id
  where g.engine = 'chat_game' and g.is_active and q.is_active and c.is_active
    and q.level <= public.couple_effective_level(public.my_active_couple_id())
    and (public.i_am_premium() or not c.is_premium)
  order by random() limit 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- Rozetler
-- ─────────────────────────────────────────────────────────────
create or replace function public.check_achievements(cid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a achievements; prog int; c couples; newly text[] := '{}';
begin
  select * into c from couples where id = cid;
  for a in select * from achievements where is_active loop
    prog := case a.code
      when 'first_game' then (select count(*) from game_sessions where couple_id = cid and status = 'finished')
      when 'games_30' then (select count(*) from game_sessions where couple_id = cid and status = 'finished')
      when 'challenges_10' then
        (select count(*) from challenge_completions where couple_id = cid and not skipped)
        + (select count(*) from game_sessions s join games g on g.id = s.game_id where s.couple_id = cid and s.status = 'finished' and g.engine = 'challenges')
      when 'questions_100' then (select count(distinct (a2.session_id, a2.round)) from session_answers a2 join game_sessions s on s.id = a2.session_id where s.couple_id = cid)
      when 'midnight_players' then (select count(*) from game_sessions where couple_id = cid and status = 'finished'
                                    and extract(hour from finished_at at time zone 'Europe/Istanbul') < 5)
      when 'perfect_match' then (select count(*) from game_sessions where couple_id = cid and status = 'finished' and (score->>'perfect')::boolean)
      when 'story_finishers' then (select count(*) from game_sessions s join games g on g.id = s.game_id where s.couple_id = cid and s.status = 'finished' and g.engine = 'story')
      when 'streak_30' then c.streak_days
      when 'first_photo' then (select count(*) from messages where couple_id = cid and kind = 'photo')
      when 'connected' then case when c.status = 'active' then 1 else 0 end
      else 0 end;
    insert into couple_achievements (couple_id, achievement_id, progress, unlocked_at)
    values (cid, a.id, least(prog, a.target), case when prog >= a.target then now() end)
    on conflict (couple_id, achievement_id) do update
      set progress = least(excluded.progress, a.target),
          unlocked_at = coalesce(couple_achievements.unlocked_at, excluded.unlocked_at);
    if prog >= a.target and not exists (
      select 1 from memories where couple_id = cid and kind = 'badge' and title = '🏅 ' || a.name
    ) then
      newly := array_append(newly, a.name);
      insert into memories (couple_id, kind, title, subtitle, color) values (cid, 'badge', '🏅 ' || a.name, a.description, '#A88BF0');
    end if;
  end loop;
  if array_length(newly, 1) > 0 then
    perform public.notify_user(c.user_a, 'badge', 'military_tech', 'Yeni rozet: ' || newly[1], 'Birlikte kazandınız.', jsonb_build_object('route','/achievements'));
    perform public.notify_user(c.user_b, 'badge', 'military_tech', 'Yeni rozet: ' || newly[1], 'Birlikte kazandınız.', jsonb_build_object('route','/achievements'));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Sohbet tetikleyicisi → partnere push
-- ─────────────────────────────────────────────────────────────
create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c couples; partner uuid; nm text; blur boolean; body text;
begin
  select * into c from couples where id = new.couple_id;
  partner := case when c.user_a = new.sender_id then c.user_b else c.user_a end;
  select display_name into nm from profiles where id = new.sender_id;
  select coalesce((settings->>'blur_previews')::boolean, true) into blur from profiles where id = partner;
  if new.kind = 'challenge' then
    perform public.notify_user(partner, 'challenge', 'bolt', 'Partnerin sana bir görev gönderdi', coalesce(nm,'') || ': “' || left(new.body, 80) || '”', jsonb_build_object('route','/chat'));
  elsif new.kind = 'screenshot' then
    perform public.notify_user(partner, 'screenshot', 'screenshot_monitor', 'Ekran görüntüsü alındı', coalesce(nm,'Partnerin') || ' sohbetin ekran görüntüsünü aldı.', jsonb_build_object('route','/chat'));
  elsif new.kind <> 'system' then
    body := case when blur then 'Yeni bir mesajın var ♡' when new.kind = 'photo' then '📷 Fotoğraf' else left(new.body, 120) end;
    perform public.push_to_user(partner, coalesce(nm, 'Nocta'), body, jsonb_build_object('route','/chat','kind','message'));
  end if;
  if new.kind = 'photo' then perform public.check_achievements(new.couple_id); end if;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- ─────────────────────────────────────────────────────────────
-- Veri silme
-- ─────────────────────────────────────────────────────────────
create or replace function public.delete_conversation() returns void
language sql security definer set search_path = public as $$
  delete from messages where couple_id = public.my_couple_id();
$$;

create or replace function public.delete_memories() returns void
language sql security definer set search_path = public as $$
  delete from memories where couple_id = public.my_couple_id();
$$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  perform public.disconnect_partner(false);
  delete from auth.users where id = me;
end $$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now() where id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────
-- İçerik sürümü: yönetici içerik değiştirdiğinde uygulama yeni içeriği çeker
-- ─────────────────────────────────────────────────────────────
create or replace function public.bump_content_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into app_settings (key, value, is_public) values ('content_version', to_jsonb(floor(extract(epoch from clock_timestamp()) * 1000)::bigint), true)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['games','categories','questions','stories','story_scenes','story_choices','achievements'] loop
    execute format('create trigger %I_content_version after insert or update or delete on public.%I for each statement execute function public.bump_content_version()', t, t);
  end loop;
end $$;
