-- Nocta · yönetici RPC düzeltmeleri
-- 1) Yetkisiz kullanıcıda admin_role() NULL döner; NULL karşılaştırmaları kontrolü atlatmasın
-- 2) Son sahip yönetici kaldırılamaz
-- 3) Çift güncelleme ve owner_email yetkileri daraltıldı
-- 4) admin_analytics kohort alt sorgusu yeniden yazıldı

create or replace function public.admin_add(p_email text, p_role text, p_name text default '') returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if coalesce(public.admin_role(), '') <> 'owner' then raise exception 'Yalnızca sahip yönetici ekleyebilir.'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'Bu e-posta ile kayıtlı bir hesap yok. Önce uygulamadan ya da panelden kayıt olmalı.'; end if;
  insert into admins (user_id, email, display_name, role) values (uid, p_email, coalesce(nullif(p_name,''), split_part(p_email,'@',1)), p_role)
  on conflict (user_id) do update set role = excluded.role, active = true, display_name = excluded.display_name;
end $$;

create or replace function public.admin_set_premium(p_couple uuid, p_plan text, p_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.admin_role(), '') not in ('owner','support') then raise exception 'Yetkisiz'; end if;
  if p_days <= 0 then
    update subscriptions set status = 'expired', expires_at = now(), canceled_at = now()
      where status in ('trial','active','canceled')
        and (couple_id = p_couple or user_id in (select user_a from couples where id = p_couple union select user_b from couples where id = p_couple));
    return;
  end if;
  insert into subscriptions (couple_id, plan, status, provider, provider_ref, started_at, expires_at)
  values (p_couple, p_plan, 'active', 'admin', 'admin:' || auth.uid(), now(), now() + make_interval(days => p_days));
end $$;

create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce(public.admin_role(), '') <> 'owner' then raise exception 'Yalnızca sahip kullanıcı silebilir.'; end if;
  if p_user = auth.uid() then raise exception 'Kendi hesabını buradan silemezsin.'; end if;
  update couples set status = 'disconnected', ended_at = now() where (user_a = p_user or user_b = p_user) and status <> 'disconnected';
  delete from auth.users where id = p_user;
end $$;

create or replace function public.protect_last_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE' and old.role = 'owner' and old.active)
     or (tg_op = 'UPDATE' and old.role = 'owner' and old.active and (new.role <> 'owner' or not new.active)) then
    if (select count(*) from admins where role = 'owner' and active and user_id <> old.user_id) = 0 then
      raise exception 'Son sahip yönetici kaldırılamaz.';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger admins_protect_last_owner before update or delete on public.admins
  for each row execute function public.protect_last_owner();
revoke execute on function public.protect_last_owner() from public, anon, authenticated;

drop policy couples_admin_update on public.couples;
create policy couples_admin_update on public.couples for update to authenticated
  using (public.admin_role() in ('owner','moderator','support')) with check (public.admin_role() in ('owner','moderator','support'));

drop policy settings_admin_write on public.app_settings;
create policy settings_admin_write on public.app_settings for all to authenticated
  using (public.admin_role() = 'owner' or (public.admin_role() = 'content' and key <> 'owner_email'))
  with check (public.admin_role() = 'owner' or (public.admin_role() = 'content' and key <> 'owner_email'));

create or replace function public.admin_analytics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t date := public.today_tr(); r jsonb;
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
    'cohorts', (
      with cc as (
        select c.id, c.connected_at, date_trunc('month', c.connected_at)::date as m
        from couples c where c.connected_at > now() - interval '6 months'
      ), cells as (
        select cc.m, wk.n,
          case when count(*) filter (where cc.connected_at + make_interval(weeks => wk.n) < now()) = 0 then null
          else round(100.0 * count(*) filter (where cc.connected_at + make_interval(weeks => wk.n) < now() and exists (
                 select 1 from game_sessions s where s.couple_id = cc.id
                   and s.created_at >= cc.connected_at + make_interval(weeks => wk.n)
                   and s.created_at <  cc.connected_at + make_interval(weeks => wk.n + 1)))
               / count(*) filter (where cc.connected_at + make_interval(weeks => wk.n) < now())) end as pct
        from cc cross join generate_series(0,5) wk(n)
        group by cc.m, wk.n
      ), sizes as (select m, count(*) as size from cc group by m)
      select coalesce(jsonb_agg(jsonb_build_object('month', s.m, 'size', s.size,
               'weeks', (select jsonb_agg(c2.pct order by c2.n) from cells c2 where c2.m = s.m)) order by s.m), '[]'::jsonb)
      from sizes s
    ),
    'funnel', jsonb_build_object(
        'started', (select count(*) from game_sessions where created_at > now() - interval '30 days' and status <> 'canceled'),
        'completed', (select count(*) from game_sessions where created_at > now() - interval '30 days' and status = 'finished'),
        'repeat', (select count(*) from (select couple_id from game_sessions where created_at > now() - interval '7 days' and status = 'finished' group by couple_id having count(*) >= 2) x),
        'premium', (select count(distinct couple_id) from subscriptions where status in ('trial','active','canceled') and (expires_at is null or expires_at > now()))
    ),
    'games', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name,
        'plays_30', (select count(*) from game_sessions s where s.game_id = g.id and s.created_at > now() - interval '30 days' and s.status <> 'canceled'),
        'completion', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status = 'finished') / count(*)) end
                       from game_sessions s where s.game_id = g.id and s.status not in ('canceled','lobby')))
        order by g.sort), '[]'::jsonb) from games g)
  ) into r;
  return r;
end $$;
