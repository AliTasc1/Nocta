-- Nocta · yönetici RPC'leri, depolama, realtime, yetkiler

-- ─────────────────────────────────────────────────────────────
-- Yönetici RPC'leri
-- ─────────────────────────────────────────────────────────────
-- İlk yönetici: yalnızca app_settings.owner_email adresine sahip hesap, tablo boşken kendini sahip yapabilir
create or replace function public.claim_first_admin() returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare em text; owner_email text;
begin
  select email into em from auth.users where id = auth.uid();
  owner_email := lower(coalesce(public.setting('owner_email') #>> '{}', ''));
  if exists (select 1 from admins) or em is null or lower(em) <> owner_email then return false; end if;
  insert into admins (user_id, email, display_name, role) values (auth.uid(), em, split_part(em,'@',1), 'owner');
  return true;
end $$;

create or replace function public.admin_touch_login() returns void
language sql security definer set search_path = public as $$
  update admins set last_login_at = now() where user_id = auth.uid();
$$;

create or replace function public.admin_add(p_email text, p_role text, p_name text default '') returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if public.admin_role() <> 'owner' then raise exception 'Yalnızca sahip yönetici ekleyebilir.'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'Bu e-posta ile kayıtlı bir hesap yok. Önce uygulamadan ya da panelden kayıt olmalı.'; end if;
  insert into admins (user_id, email, display_name, role) values (uid, p_email, coalesce(nullif(p_name,''), split_part(p_email,'@',1)), p_role)
  on conflict (user_id) do update set role = excluded.role, active = true, display_name = excluded.display_name;
end $$;

create or replace function public.admin_users(p_search text default '', p_filter text default 'all', p_limit int default 50, p_offset int default 0)
returns table (id uuid, display_name text, email text, partner_name text, premium boolean, status text,
               created_at timestamptz, last_seen_at timestamptz, level smallint, total bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Yetkisiz'; end if;
  return query
  with base as (
    select p.id, p.display_name, u.email::text as email,
      (select pp.display_name from couples c join profiles pp on pp.id = case when c.user_a = p.id then c.user_b else c.user_a end
        where (c.user_a = p.id or c.user_b = p.id) and c.status = 'active' limit 1) as partner_name,
      exists (select 1 from subscriptions s where (s.user_id = p.id or s.couple_id in (select c.id from couples c where c.user_a = p.id or c.user_b = p.id))
        and s.status in ('trial','active','canceled') and (s.expires_at is null or s.expires_at > now())) as premium,
      p.status, p.created_at, p.last_seen_at, p.level
    from profiles p join auth.users u on u.id = p.id
    where (p_search = '' or p.display_name ilike '%'||p_search||'%' or u.email ilike '%'||p_search||'%')
  ), filtered as (
    select * from base where
      p_filter = 'all'
      or (p_filter = 'active' and base.status = 'active')
      or (p_filter = 'suspended' and base.status = 'suspended')
      or (p_filter = 'premium' and base.premium)
      or (p_filter = 'single' and base.partner_name is null)
  )
  select f.*, count(*) over() as total from filtered f order by f.created_at desc limit p_limit offset p_offset;
end $$;

create or replace function public.admin_couples(p_search text default '', p_limit int default 50, p_offset int default 0)
returns table (id uuid, name_a text, name_b text, status text, xp int, streak_days int, games bigint,
               last_activity timestamptz, connected_at timestamptz, created_at timestamptz, premium boolean, invite_code text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Yetkisiz'; end if;
  return query
  select c.id, pa.display_name, pb.display_name, c.status, c.xp, c.streak_days,
    (select count(*) from game_sessions s where s.couple_id = c.id and s.status = 'finished'),
    greatest((select max(s.updated_at) from game_sessions s where s.couple_id = c.id), (select max(m.created_at) from messages m where m.couple_id = c.id), c.connected_at),
    c.connected_at, c.created_at, public.couple_is_premium(c.id), c.invite_code, count(*) over()
  from couples c join profiles pa on pa.id = c.user_a left join profiles pb on pb.id = c.user_b
  where p_search = '' or pa.display_name ilike '%'||p_search||'%' or pb.display_name ilike '%'||p_search||'%' or c.invite_code ilike '%'||p_search||'%'
  order by c.created_at desc limit p_limit offset p_offset;
end $$;

create or replace function public.admin_set_premium(p_couple uuid, p_plan text, p_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.admin_role() not in ('owner','support') then raise exception 'Yetkisiz'; end if;
  if p_days <= 0 then
    update subscriptions set status = 'expired', expires_at = now(), canceled_at = now()
      where couple_id = p_couple and status in ('trial','active','canceled');
    return;
  end if;
  insert into subscriptions (couple_id, plan, status, provider, provider_ref, started_at, expires_at)
  values (p_couple, p_plan, 'active', 'admin', 'admin:' || auth.uid(), now(), now() + make_interval(days => p_days));
end $$;

create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if public.admin_role() <> 'owner' then raise exception 'Yalnızca sahip kullanıcı silebilir.'; end if;
  update couples set status = 'disconnected', ended_at = now() where (user_a = p_user or user_b = p_user) and status <> 'disconnected';
  delete from auth.users where id = p_user;
end $$;

create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t date := public.today_tr(); r jsonb; tz text := 'Europe/Istanbul';
begin
  if not public.is_admin() then raise exception 'Yetkisiz'; end if;
  with d as (
    select
      (select count(*) from couples where status = 'active') as active_couples,
      (select count(*) from couples where status = 'active' and (connected_at at time zone tz)::date < t) as active_couples_y,
      (select count(*) from game_sessions where (created_at at time zone tz)::date = t and status <> 'canceled') as games_today,
      (select count(*) from game_sessions where (created_at at time zone tz)::date = t - 1 and status <> 'canceled') as games_y,
      (select count(*) from profiles where (last_seen_at at time zone tz)::date = t) as dau,
      (select count(*) from profiles where (last_seen_at at time zone tz)::date = t - 1) as dau_y,
      (select count(*) from couples where (connected_at at time zone tz)::date = t) as new_couples,
      (select count(*) from couples where (connected_at at time zone tz)::date = t - 1) as new_couples_y,
      (select count(*) from challenge_completions where day = t and not skipped) as challenges,
      (select count(*) from challenge_completions where day = t - 1 and not skipped) as challenges_y,
      (select count(*) from subscriptions where status in ('trial','active','canceled') and (expires_at is null or expires_at > now())) as premium,
      (select coalesce(sum(amount_try),0) from payments where status = 'paid' and created_at > now() - interval '30 days') as revenue30,
      (select coalesce(sum(amount_try),0) from payments where status = 'paid' and created_at between now() - interval '60 days' and now() - interval '30 days') as revenue_prev,
      (select count(*) from profiles) as users,
      (select count(*) from reports where status in ('open','in_review')) as open_reports
  )
  select to_jsonb(d.*) into r from d;
  r := r || jsonb_build_object(
    'daily_games', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'n', n) order by day), '[]'::jsonb) from (
      select g.day::date as day, (select count(*) from game_sessions s where (s.created_at at time zone tz)::date = g.day::date and s.status <> 'canceled') as n
      from generate_series(t - 29, t, interval '1 day') g(day)) x),
    'game_mix', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc), '[]'::jsonb) from (
      select g.name, count(*) as n from game_sessions s join games g on g.id = s.game_id
      where s.created_at > now() - interval '30 days' and s.status <> 'canceled' group by g.name) x),
    'recent_reports', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
      select id, number, title, priority, status, created_at from reports order by created_at desc limit 5) x)
  );
  return r;
end $$;

create or replace function public.admin_analytics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t date := public.today_tr(); tz text := 'Europe/Istanbul'; r jsonb;
begin
  if not public.is_admin() then raise exception 'Yetkisiz'; end if;
  select jsonb_build_object(
    'dau', (select count(*) from profiles where last_seen_at > now() - interval '1 day'),
    'wau', (select count(*) from profiles where last_seen_at > now() - interval '7 days'),
    'mau', (select count(*) from profiles where last_seen_at > now() - interval '30 days'),
    'started_30', (select count(*) from game_sessions where created_at > now() - interval '30 days' and status <> 'canceled'),
    'completed_30', (select count(*) from game_sessions where created_at > now() - interval '30 days' and status = 'finished'),
    'avg_minutes', (select coalesce(round(avg(extract(epoch from finished_at - started_at))/60.0, 1), 0) from game_sessions
                    where status = 'finished' and started_at is not null and finished_at > now() - interval '30 days'),
    'retention_w4', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where exists (
                        select 1 from game_sessions s where s.couple_id = c.id and s.created_at > now() - interval '7 days')) / count(*), 1) end
                     from couples c where c.connected_at between now() - interval '35 days' and now() - interval '28 days'),
    'challenge_rate', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where not skipped) / count(*), 1) end
                       from challenge_completions where day > t - 30),
    'premium_conversion', (select case when (select count(*) from couples where status = 'active') = 0 then 0 else
        round(100.0 * (select count(distinct couple_id) from subscriptions where status in ('trial','active','canceled') and (expires_at is null or expires_at > now()))
              / (select count(*) from couples where status = 'active'), 1) end),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'active', a, 'games', gm) order by wk), '[]'::jsonb) from (
        select w.wk::date as wk,
          (select count(distinct x.user_id) from session_answers x where x.created_at >= w.wk and x.created_at < w.wk + interval '7 days') as a,
          (select count(*) from game_sessions s where s.created_at >= w.wk and s.created_at < w.wk + interval '7 days' and s.status <> 'canceled') as gm
        from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w(wk)) q),
    'cohorts', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'size', size, 'weeks', weeks) order by m), '[]'::jsonb) from (
        select date_trunc('month', c.connected_at)::date as m, count(*) as size,
          (select jsonb_agg(
             (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where exists (
                select 1 from game_sessions s where s.couple_id = c2.id
                  and s.created_at >= c2.connected_at + make_interval(weeks => wkn)
                  and s.created_at <  c2.connected_at + make_interval(weeks => wkn + 1))) / count(*)) end
              from couples c2 where date_trunc('month', c2.connected_at) = date_trunc('month', c.connected_at)
                and c2.connected_at + make_interval(weeks => wkn) < now())
             order by wkn) from generate_series(0,5) wkn) as weeks
        from couples c where c.connected_at > now() - interval '6 months' group by 1) co),
    'funnel', jsonb_build_object(
        'started', (select count(*) from game_sessions where created_at > now() - interval '30 days' and status <> 'canceled'),
        'completed', (select count(*) from game_sessions where created_at > now() - interval '30 days' and status = 'finished'),
        'repeat', (select count(*) from (select couple_id from game_sessions where created_at > now() - interval '7 days' and status = 'finished' group by couple_id having count(*) >= 2) x),
        'premium', (select count(distinct couple_id) from subscriptions where status in ('trial','active','canceled') and (expires_at is null or expires_at > now()))
    ),
    'games', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name,
        'plays_30', (select count(*) from game_sessions s where s.game_id = g.id and s.created_at > now() - interval '30 days' and s.status <> 'canceled'),
        'completion', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status = 'finished') / count(*)) end
                       from game_sessions s where s.game_id = g.id and s.status <> 'canceled' and s.status <> 'lobby'))
        order by g.sort), '[]'::jsonb) from games g)
  ) into r;
  return r;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Depolama: sohbet fotoğrafları (yalnızca çift üyeleri)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

create policy chat_media_read on storage.objects for select to authenticated using (
  bucket_id = 'chat-media' and (public.is_couple_member(((storage.foldername(name))[1])::uuid) or public.is_admin())
);
create policy chat_media_write on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-media' and ((storage.foldername(name))[1])::uuid = public.my_active_couple_id()
);
create policy chat_media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'chat-media' and public.is_couple_member(((storage.foldername(name))[1])::uuid)
);

-- ─────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table
  public.couples, public.profiles, public.game_sessions, public.session_answers,
  public.messages, public.notifications, public.app_settings, public.memories;

-- ─────────────────────────────────────────────────────────────
-- Fonksiyon yetkileri: yalnızca oturum açmış kullanıcılar
-- ─────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
grant execute on function public.is_admin() to anon;
revoke execute on function public.push_to_user(uuid, text, text, jsonb) from authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text, jsonb) from authenticated;
revoke execute on function public.check_achievements(uuid) from authenticated;
revoke execute on function public.bump_streak(uuid) from authenticated;
revoke execute on function public.pick_questions(uuid, uuid, smallint, int, text) from authenticated;
