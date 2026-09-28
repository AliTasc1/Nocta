-- Nocta · Rus Ruleti ve Shot Ruleti
-- Merminin yeri ve rulet sonucu SUNUCUDA belirlenir; gizli bilgi istemcilerin okuyamadığı tabloda tutulur.

alter table public.games drop constraint games_engine_check;
alter table public.games add constraint games_engine_check check (engine in
  ('truth_dare','would_you_rather','know_me','challenges','secret_questions','this_or_that','story','chat_game',
   'quiz','emoji','cards','roulette','shots'));

-- Gizli oyun verisi (RLS açık, hiçbir istemci politikası yok → yalnızca sunucu fonksiyonları erişir)
create table if not exists public.game_secrets (
  session_id uuid primary key references public.game_sessions(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);
alter table public.game_secrets enable row level security;

-- start_session: bu iki motor soru gerektirmez, başlangıç durumunu kurar
do $$ declare d text; begin
  d := pg_get_functiondef('public.start_session(text, uuid, uuid)'::regprocedure);
  d := replace(d, E'  elsif g.engine = ''truth_dare'' then',
    E'  elsif g.engine = ''roulette'' then\n    st_state := jsonb_build_object(''phase'', ''contract'', ''round'', 0, ''chamber'', 0, ''pulls'', ''[]''::jsonb, ''load_nonce'', 0);\n  elsif g.engine = ''shots'' then\n    st_state := jsonb_build_object(''phase'', ''agreement'', ''spins'', ''[]''::jsonb, ''spin_nonce'', 0);\n  elsif g.engine = ''truth_dare'' then');
  execute d;
end $$;

-- Ortak yardımcı: oturumu kilitle + üyelik/oyun motoru kontrolü
create or replace function public._game_lock(p_session uuid, p_engine text)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; e text;
begin
  select * into s from game_sessions where id = p_session for update;
  if not found or not public.is_couple_member(s.couple_id) then raise exception 'Oturum bulunamadı'; end if;
  select engine into e from games where id = s.game_id;
  if e <> p_engine then raise exception 'Bu işlem bu oyun için geçerli değil.'; end if;
  if s.status <> 'playing' then raise exception 'Oyun şu an aktif değil.'; end if;
  return s;
end $$;
revoke execute on function public._game_lock(uuid, text) from public, anon, authenticated;

create or replace function public._partner_of(p_couple uuid, p_user uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case when user_a = p_user then user_b else user_a end from couples where id = p_couple;
$$;
revoke execute on function public._partner_of(uuid, uuid) from public, anon, authenticated;

-- ───────────────────────────── RUS RULETİ ─────────────────────────────
-- Dürüstlük sözleşmesini imzala (imza = SVG path verisi)
create or replace function public.roulette_sign(p_session uuid, p_signature text)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; partner uuid; both_signed boolean;
begin
  s := public._game_lock(p_session, 'roulette');
  if coalesce(length(p_signature), 0) < 10 then raise exception 'Lütfen sözleşmeyi imzala.'; end if;
  if length(p_signature) > 60000 then raise exception 'İmza çok uzun.'; end if;
  partner := public._partner_of(s.couple_id, auth.uid());
  s.state := s.state || jsonb_build_object('sig_' || auth.uid(), p_signature);
  both_signed := s.state ? ('sig_' || auth.uid()) and s.state ? ('sig_' || partner);
  if both_signed and s.state->>'phase' = 'contract' then
    s.state := s.state || jsonb_build_object('phase', 'loading', 'starter', s.created_by, 'turn', s.created_by);
  end if;
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

-- Tek mermiyi yükle ve tamburu çevir (sunucu merminin yerini gizlice seçer)
create or replace function public.roulette_load(p_session uuid)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; bullet int; starter uuid;
begin
  s := public._game_lock(p_session, 'roulette');
  if s.state->>'phase' <> 'loading' then return s; end if;
  bullet := floor(random() * 6)::int;
  insert into game_secrets (session_id, data) values (s.id, jsonb_build_object('bullet', bullet))
  on conflict (session_id) do update set data = game_secrets.data || jsonb_build_object('bullet', bullet);
  starter := coalesce((s.state->>'turn')::uuid, s.created_by);
  s.state := s.state || jsonb_build_object(
    'phase', 'playing', 'chamber', 0, 'pulls', '[]'::jsonb, 'turn', starter,
    'loader', auth.uid(), 'load_nonce', coalesce((s.state->>'load_nonce')::int, 0) + 1,
    'loser', null, 'prompt', null, 'last', null);
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

-- Tetiği çek
create or replace function public.roulette_pull(p_session uuid)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; bullet int; ch int; fired boolean; partner uuid; lvl smallint; pr questions; rnd int;
begin
  s := public._game_lock(p_session, 'roulette');
  if s.state->>'phase' <> 'playing' then raise exception 'Önce tamburu doldurun.'; end if;
  if (s.state->>'turn')::uuid <> auth.uid() then raise exception 'Sıra sende değil.'; end if;
  select (data->>'bullet')::int into bullet from game_secrets where session_id = s.id;
  ch := coalesce((s.state->>'chamber')::int, 0);
  fired := (ch = bullet);
  partner := public._partner_of(s.couple_id, auth.uid());
  rnd := coalesce((s.state->>'round')::int, 0);

  insert into session_answers (session_id, round, user_id, answer)
  values (s.id, s.current_index, auth.uid(), jsonb_build_object('choice', case when fired then 'bang' else 'click' end, 'round', rnd, 'chamber', ch))
  on conflict (session_id, round, user_id) do nothing;

  s.state := s.state || jsonb_build_object(
    'chamber', ch + 1,
    'pulls', coalesce(s.state->'pulls', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('by', auth.uid(), 'fired', fired, 'chamber', ch)),
    'last', jsonb_build_object('by', auth.uid(), 'fired', fired, 'at', extract(epoch from clock_timestamp())));

  if fired then
    lvl := public.couple_effective_level(s.couple_id);
    select q.* into pr from questions q join categories c on c.id = q.category_id
      where c.game_id = s.game_id and q.is_active and c.is_active and q.level <= lvl
        and (not c.is_premium or public.couple_is_premium(s.couple_id))
      order by random() limit 1;
    s.state := s.state || jsonb_build_object('phase', 'confess', 'loser', auth.uid(),
      'prompt', case when pr.id is null then null else jsonb_build_object('id', pr.id, 'text', pr.text) end,
      'turn', partner);
  else
    s.state := s.state || jsonb_build_object('turn', partner);
  end if;
  update game_sessions set state = s.state, current_index = current_index + 1 where id = s.id returning * into s;
  return s;
end $$;

-- İtiraf tamamlandı → yeni tur (tambur yeniden doldurulacak)
create or replace function public.roulette_confessed(p_session uuid, p_text text default '')
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions;
begin
  s := public._game_lock(p_session, 'roulette');
  if s.state->>'phase' <> 'confess' then return s; end if;
  s.state := s.state || jsonb_build_object(
    'phase', 'loading',
    'round', coalesce((s.state->>'round')::int, 0) + 1,
    'confessions', coalesce(s.state->'confessions', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'by', s.state->>'loser', 'prompt', s.state->'prompt'->>'text', 'text', left(coalesce(p_text, ''), 1000))),
    'loser', null, 'prompt', null);
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

-- ───────────────────────────── SHOT RULETİ ─────────────────────────────
-- 16 bardak; tek numaralar kırmızı, çift numaralar siyah.
-- Oyunu başlatan kırmızı, partneri siyah. Oyuncu 4'lü bir aralık seçer (başlangıç 1–13).
-- Top aralıktaysa kurtulur; değilse topun rengindeki oyuncu içer.
create or replace function public.shots_agree(p_session uuid)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; partner uuid;
begin
  s := public._game_lock(p_session, 'shots');
  partner := public._partner_of(s.couple_id, auth.uid());
  s.state := s.state || jsonb_build_object('agree_' || auth.uid(), true);
  if (s.state ? ('agree_' || auth.uid())) and (s.state ? ('agree_' || partner)) and s.state->>'phase' = 'agreement' then
    s.state := s.state || jsonb_build_object('phase', 'playing', 'turn', s.created_by,
      'red', s.created_by, 'black', public._partner_of(s.couple_id, s.created_by));
  end if;
  update game_sessions set state = s.state where id = s.id returning * into s;
  return s;
end $$;

create or replace function public.shots_spin(p_session uuid, p_range_start int)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s game_sessions; res int; color text; saved boolean; drinker uuid; partner uuid;
begin
  s := public._game_lock(p_session, 'shots');
  if s.state->>'phase' <> 'playing' then raise exception 'Önce kuralları kabul edin.'; end if;
  if (s.state->>'turn')::uuid <> auth.uid() then raise exception 'Sıra sende değil.'; end if;
  if p_range_start is null or p_range_start < 1 or p_range_start > 13 then raise exception 'Geçersiz aralık.'; end if;
  res := 1 + floor(random() * 16)::int;
  color := case when res % 2 = 1 then 'red' else 'black' end;
  saved := res between p_range_start and p_range_start + 3;
  drinker := case when saved then null else (s.state->>color)::uuid end;
  partner := public._partner_of(s.couple_id, auth.uid());

  insert into session_answers (session_id, round, user_id, answer)
  values (s.id, s.current_index, auth.uid(), jsonb_build_object('choice', case when saved then 'saved' else 'drink' end,
          'result', res, 'range_start', p_range_start, 'drinker', drinker))
  on conflict (session_id, round, user_id) do nothing;

  s.state := s.state || jsonb_build_object(
    'turn', partner,
    'spin_nonce', coalesce((s.state->>'spin_nonce')::int, 0) + 1,
    'last', jsonb_build_object('by', auth.uid(), 'range_start', p_range_start, 'result', res, 'color', color,
                               'saved', saved, 'drinker', drinker, 'at', extract(epoch from clock_timestamp())),
    'spins', coalesce(s.state->'spins', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'by', auth.uid(), 'range_start', p_range_start, 'result', res, 'color', color, 'saved', saved, 'drinker', drinker)));
  update game_sessions set state = s.state, current_index = current_index + 1 where id = s.id returning * into s;
  return s;
end $$;

grant execute on function public.roulette_sign(uuid, text), public.roulette_load(uuid), public.roulette_pull(uuid),
  public.roulette_confessed(uuid, text), public.shots_agree(uuid), public.shots_spin(uuid, int) to authenticated;
revoke execute on function public.roulette_sign(uuid, text), public.roulette_load(uuid), public.roulette_pull(uuid),
  public.roulette_confessed(uuid, text), public.shots_agree(uuid), public.shots_spin(uuid, int) from anon, public;

-- Sonuç anısı metni
do $$ begin
  execute replace(pg_get_functiondef('public.finish_session(uuid)'::regprocedure),
    'when g.engine = ''cards'' then',
    'when g.engine = ''roulette'' then coalesce(jsonb_array_length(s.state->''confessions''), 0) || '' itiraf · '' || rounds_played || '' tetik''
      when g.engine = ''shots'' then (select count(*) from jsonb_array_elements(coalesce(s.state->''spins'', ''[]''::jsonb)) e where e->>''drinker'' is not null) || '' shot · '' || rounds_played || '' tur''
      when g.engine = ''cards'' then');
end $$;

-- Oyunlar + itiraf soruları kategorisi
insert into public.games (slug, engine, name, description, icon, color, duration_label, rounds, is_premium, sort) values
 ('roulette', 'roulette', 'Rus Ruleti', 'Tek mermi, altı yuva. Kimde patlarsa bir itirafta bulunur. Önce dürüstlük sözleşmesini imzalayın.', 'gps_fixed', '#3A1D2B', '10 dk · Cesur', 10, false, 12),
 ('shots', 'shots', 'Shot Ruleti', 'Rulet döner, top durur: aralığını tutturursan kurtulursun, tutturamazsan renk kimdeyse o içer.', 'local_bar', '#5A1A2E', '15 dk · Eğlenceli', 10, false, 13)
on conflict (slug) do nothing;

insert into public.categories (game_id, name, description, icon, color, is_premium, sort)
select g.id, v.name, v.descr, v.icon, v.color, v.prem, v.sort from public.games g,
 (values ('İtiraflar', 'Mermi patlayınca sorulacak itiraf soruları.', 'record_voice_over', '#3A1D2B', false, 1),
         ('Karanlık İtiraflar', 'Daha cesur itiraflar.', 'local_fire_department', '#6B1E38', true, 2)) as v(name, descr, icon, color, prem, sort)
where g.slug = 'roulette';

insert into public.questions (category_id, text, level, mood)
select c.id, v.text, v.lvl, v.mood from public.categories c
join (values
 ('İtiraflar','Partnerine hiç söylemediğin küçük bir yalanını itiraf et.',0,'gizemli'),
 ('İtiraflar','İlk tanıştığınızda onun hakkında düşündüğün ama söylemediğin şey neydi?',0,'romantik'),
 ('İtiraflar','Partnerinin en sevdiğin ama hiç dile getirmediğin özelliği ne?',0,'romantik'),
 ('İtiraflar','Birlikteyken en çok utandığın an hangisiydi?',0,'eglenceli'),
 ('İtiraflar','Partnerinin telefonuna hiç merakla göz attın mı? Dürüst ol.',1,'cesur'),
 ('İtiraflar','Onu kıskandığın ama belli etmediğin bir an anlat.',1,'gizemli'),
 ('İtiraflar','Partnerin hakkında gördüğün en garip rüya neydi?',1,'eglenceli'),
 ('İtiraflar','Ona söylemediğin bir hayalini itiraf et.',1,'flortoz'),
 ('İtiraflar','Kavgalarınızdan birinde aslında haksız olduğunu bildiğin an hangisiydi?',0,'karisik'),
 ('İtiraflar','Ondan sakladığın bir alışkanlığın var mı?',0,'gizemli'),
 ('Karanlık İtiraflar','Partnerinle ilgili en cesur fantezini itiraf et.',2,'cesur'),
 ('Karanlık İtiraflar','Onu ilk kez gerçekten arzuladığın anı anlat.',2,'flortoz'),
 ('Karanlık İtiraflar','Birlikte denemek isteyip utandığın için söylemediğin şey ne?',2,'cesur'),
 ('Karanlık İtiraflar','Hiç ona baktığında aklından geçenleri yüksek sesle söyle.',3,'cesur')
) as v(cat, text, lvl, mood) on c.name = v.cat
join public.games g on g.id = c.game_id and g.slug = 'roulette';
