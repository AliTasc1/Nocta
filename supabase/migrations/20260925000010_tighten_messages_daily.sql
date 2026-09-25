-- Nocta · sıkılaştırmalar
-- 1) Günlük görev aynı gün iki kez XP vermesin
create or replace function public.complete_daily_challenge(p_question uuid, p_skipped boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_active_couple_id(); c couples; partner uuid; nm text; inserted int;
begin
  if cid is null then raise exception 'Önce partnerine bağlanmalısın.' using errcode = 'P0010'; end if;
  perform pg_advisory_xact_lock(hashtext('daily:' || cid::text));
  if exists (select 1 from challenge_completions where couple_id = cid and day = public.today_tr() and not skipped) then
    return jsonb_build_object('xp', 0, 'already', true);
  end if;
  insert into challenge_completions (couple_id, question_id, day, completed_by, skipped)
  values (cid, p_question, public.today_tr(), auth.uid(), p_skipped)
  on conflict (couple_id, day) do update set skipped = excluded.skipped, completed_by = excluded.completed_by
    where challenge_completions.skipped;
  if p_skipped then return jsonb_build_object('xp', 0); end if;
  update couples set xp = xp + 30 where id = cid returning * into c;
  perform public.bump_streak(cid);
  insert into memories (couple_id, created_by, kind, title, subtitle, color)
  values (cid, auth.uid(), 'challenge', 'Günün görevi tamamlandı',
          coalesce((select qq.text from questions qq where qq.id = p_question), ''), '#F4B9C8');
  partner := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
  select display_name into nm from profiles where id = auth.uid();
  perform public.notify_user(partner, 'challenge_done', 'nightlight', coalesce(nm,'Partnerin') || ' günün görevini tamamladı', '+30 XP kazandınız.', jsonb_build_object('route','/'));
  perform public.check_achievements(cid);
  return jsonb_build_object('xp', 30, 'couple_xp', c.xp);
end $$;

-- 2) Mesaj güncellemesi: yalnızca read_at / meta değişebilir; metni yalnızca gönderen düzenleyebilir
create or replace function public.guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.couple_id <> old.couple_id or new.sender_id <> old.sender_id or new.kind <> old.kind
     or new.created_at <> old.created_at or new.expires_at is distinct from old.expires_at then
    raise exception 'Bu mesaj değiştirilemez.';
  end if;
  if new.body <> old.body and old.sender_id <> auth.uid() then
    raise exception 'Bu mesaj değiştirilemez.';
  end if;
  return new;
end $$;
create trigger messages_guard_update before update on public.messages
  for each row execute function public.guard_message_update();
revoke execute on function public.guard_message_update() from public, anon, authenticated;

-- 3) Bağlantı koptuktan sonra eski sohbet/anılar okunamasın (yalnızca açık oda)
create or replace function public.is_open_couple_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from couples where id = cid and status in ('pending','active') and (user_a = auth.uid() or user_b = auth.uid()));
$$;

drop policy messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (
  (public.is_open_couple_member(couple_id) and (expires_at is null or expires_at > now())) or public.is_admin()
);
drop policy messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
  using (public.is_open_couple_member(couple_id)) with check (public.is_open_couple_member(couple_id));
drop policy memories_select on public.memories;
create policy memories_select on public.memories for select to authenticated
  using (public.is_open_couple_member(couple_id) or public.is_admin());
drop policy chat_media_read on storage.objects;
create policy chat_media_read on storage.objects for select to authenticated using (
  bucket_id = 'chat-media' and (public.is_open_couple_member(((storage.foldername(name))[1])::uuid) or public.is_admin())
);

-- 4) Oturum ilerletmede eski indeksle geri gitmeyi engelle; seçilen hikâyenin seviyesi kontrol edilir
create or replace function public.update_session(p_session uuid, p_current_index int default null, p_state jsonb default null)
returns public.game_sessions
language plpgsql security definer set search_path = public as $$
declare s game_sessions;
begin
  select * into s from game_sessions where id = p_session for update;
  if not found or not public.is_couple_member(s.couple_id) then raise exception 'Oturum bulunamadı'; end if;
  if s.status <> 'playing' then return s; end if;
  if p_current_index is not null and p_current_index < s.current_index then return s; end if;
  update game_sessions set
    current_index = coalesce(p_current_index, current_index),
    state = case when p_state is null then state else state || p_state end
  where id = s.id returning * into s;
  return s;
end $$;

do $$ begin
  execute replace(pg_get_functiondef('public.start_session(text, uuid, uuid)'::regprocedure),
    'select * into st from stories where id = p_story and is_active;',
    'select * into st from stories where id = p_story and is_active and level <= lvl;');
end $$;
