-- Nocta · PL/pgSQL değişken/sütun ad çakışmaları düzeltildi + hikâye oyunu ücretsiz
create or replace function public.get_daily_challenge() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_couple_id(); lvl smallint; dq questions; done challenge_completions; t date := public.today_tr(); secs int; n int;
begin
  lvl := case when cid is null then 0 else public.couple_effective_level(cid) end;
  select count(*) into n from questions qq join categories cc on cc.id = qq.category_id join games gg on gg.id = cc.game_id
    where gg.engine = 'challenges' and qq.is_active and cc.is_active and qq.level <= lvl and not cc.is_premium;
  if n = 0 then return jsonb_build_object('question', null); end if;
  select qq.* into dq from questions qq join categories cc on cc.id = qq.category_id join games gg on gg.id = cc.game_id
    where gg.engine = 'challenges' and qq.is_active and cc.is_active and qq.level <= lvl and not cc.is_premium
    order by md5(coalesce(cid::text,'x') || t::text || qq.id::text) limit 1;
  select * into done from challenge_completions where couple_id = cid and day = t;
  secs := extract(epoch from ((t + 1)::timestamp at time zone 'Europe/Istanbul') - now())::int;
  return jsonb_build_object('question', to_jsonb(dq), 'completed', done.id is not null and not done.skipped,
    'skipped', coalesce(done.skipped,false), 'seconds_left', secs, 'day', t);
end $$;

do $$ begin
  execute replace(pg_get_functiondef('public.finish_session(uuid)'::regprocedure),
    '(select title from stories where id = (s.state->>''story_id'')::uuid)',
    '(select st.title from stories st where st.id = (s.state->>''story_id'')::uuid)');
end $$;

-- Hikâye oyunu ücretsiz; tek tek hikâyeler premium olabilir
update public.games set is_premium = false where slug = 'story';
