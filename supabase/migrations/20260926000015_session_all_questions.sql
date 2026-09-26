-- Oturum soru sınırı kaldırıldı: kategorideki TÜM uygun sorular gelir.
-- Çiftin daha önce görmediği sorular önce, görülenler sonra (her grup kendi içinde rastgele).
create or replace function public.pick_all_questions(p_couple uuid, p_game uuid, p_category uuid, p_level smallint, p_kind text default null)
returns uuid[] language sql volatile security definer set search_path = public as $$
  with seen as (
    select distinct a.question_id
    from session_answers a join game_sessions s on s.id = a.session_id
    where s.couple_id = p_couple and a.question_id is not null
  )
  select coalesce(array_agg(id order by seen_flag, rnd), '{}') from (
    select q.id, (q.id in (select question_id from seen))::int as seen_flag, random() as rnd
    from questions q join categories c on c.id = q.category_id
    where c.game_id = p_game and c.is_active and q.is_active
      and (p_category is null or c.id = p_category)
      and q.level <= p_level
      and (p_kind is null or q.kind = p_kind)
  ) x;
$$;
revoke execute on function public.pick_all_questions(uuid, uuid, uuid, smallint, text) from public, anon, authenticated;

do $$ declare d text; begin
  d := pg_get_functiondef('public.start_session(text, uuid, uuid)'::regprocedure);
  d := replace(d, 'public.pick_questions(g.id, p_category, lvl, 30, ''truth'')', 'public.pick_all_questions(cid, g.id, p_category, lvl, ''truth'')');
  d := replace(d, 'public.pick_questions(g.id, p_category, lvl, 30, ''dare'')', 'public.pick_all_questions(cid, g.id, p_category, lvl, ''dare'')');
  d := replace(d, 'public.pick_questions(g.id, p_category, lvl, g.rounds)', 'public.pick_all_questions(cid, g.id, p_category, lvl, null)');
  execute d;
end $$;
