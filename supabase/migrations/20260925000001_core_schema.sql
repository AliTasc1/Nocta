-- Nocta · çekirdek şema
-- Seviyeler: 0 Soft · 1 Flirty · 2 Bold · 3 Wild

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Profiller
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  birth_date date,
  age_confirmed_at timestamptz,
  avatar_color text not null default '#2A1530',
  mood text,
  level smallint not null default 0 check (level between 0 and 3),
  onboarded boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended')),
  settings jsonb not null default jsonb_build_object(
    'blur_previews', true,
    'screenshot_alerts', true,
    'disappearing_messages', false,
    'app_lock', false,
    'notifications', true
  ),
  expo_push_token text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.check_adult() returns trigger language plpgsql as $$
begin
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years') then
    raise exception 'Nocta yalnızca 18 yaş üstü yetişkinler içindir.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger profiles_check_adult before insert or update of birth_date on public.profiles
  for each row execute function public.check_adult();

-- Yeni auth kullanıcısı → profil satırı
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Çiftler
-- ─────────────────────────────────────────────────────────────
create table public.couples (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid references public.profiles(id) on delete set null,
  invite_code text not null unique,
  status text not null default 'pending' check (status in ('pending','active','disconnected')),
  xp integer not null default 0,
  streak_days integer not null default 0,
  last_play_date date,
  anniversary date,
  created_at timestamptz not null default now(),
  connected_at timestamptz,
  ended_at timestamptz
);
create index couples_user_a on public.couples(user_a);
create index couples_user_b on public.couples(user_b);
-- Bir kullanıcı aynı anda yalnızca bir açık odada olabilir
create unique index couples_one_open_a on public.couples(user_a) where status in ('pending','active');
create unique index couples_one_open_b on public.couples(user_b) where status in ('pending','active');

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ─────────────────────────────────────────────────────────────
-- Yöneticiler & ayarlar
-- ─────────────────────────────────────────────────────────────
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'content' check (role in ('owner','moderator','content','support')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- İçerik: oyunlar, kategoriler, sorular, hikâyeler, rozetler
-- ─────────────────────────────────────────────────────────────
create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  engine text not null check (engine in ('truth_dare','would_you_rather','know_me','challenges','secret_questions','this_or_that','story','chat_game')),
  name text not null,
  description text not null default '',
  icon text not null default 'favorite',
  color text not null default '#2A1530',
  duration_label text not null default '',
  rounds smallint not null default 10 check (rounds between 1 and 50),
  is_premium boolean not null default false,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null,
  description text not null default '',
  icon text not null default 'style',
  color text not null default '#3A1740',
  is_premium boolean not null default false,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_game on public.categories(game_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  text text not null check (length(text) between 2 and 600),
  kind text check (kind in ('truth','dare')),
  level smallint not null default 0 check (level between 0 and 3),
  mood text not null default 'karisik',
  options jsonb not null default '[]'::jsonb,
  timer_seconds integer check (timer_seconds is null or timer_seconds between 5 and 3600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_category on public.questions(category_id);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  level smallint not null default 1 check (level between 0 and 3),
  cover_color text not null default '#2A1530',
  is_premium boolean not null default true,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_scenes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  chapter text not null default 'BÖLÜM 1',
  title text not null default '',
  body text not null,
  art_note text not null default '',
  glow text not null default 'rgba(231,104,138,.4)',
  is_start boolean not null default false,
  is_ending boolean not null default false,
  xp integer not null default 0,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index story_scenes_story on public.story_scenes(story_id);

create table public.story_choices (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.story_scenes(id) on delete cascade,
  text text not null,
  next_scene_id uuid references public.story_scenes(id) on delete set null,
  sort integer not null default 0
);
create index story_choices_scene on public.story_choices(scene_id);

-- Kullanım istatistikleri ayrı tabloda: içerik sürümünü gereksiz yere değiştirmesin
create table public.question_usage (
  question_id uuid primary key references public.questions(id) on delete cascade,
  count integer not null default 0
);
create table public.story_choice_stats (
  choice_id uuid primary key references public.story_choices(id) on delete cascade,
  count integer not null default 0
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default 'military_tech',
  target integer not null default 1,
  sort integer not null default 0,
  is_active boolean not null default true
);

-- ─────────────────────────────────────────────────────────────
-- Oyun oturumları
-- ─────────────────────────────────────────────────────────────
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','playing','finished','canceled')),
  level smallint not null default 0,
  question_ids uuid[] not null default '{}',
  current_index integer not null default 0,
  state jsonb not null default '{}'::jsonb,
  ready uuid[] not null default '{}',
  score jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_sessions_couple on public.game_sessions(couple_id, created_at desc);

create table public.session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  round integer not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  answer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, round, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- Sohbet, anılar, rozet ilerlemesi, günlük görev
-- ─────────────────────────────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','challenge','photo','system','screenshot')),
  body text not null default '',
  meta jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_couple on public.messages(couple_id, created_at desc);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  kind text not null default 'game' check (kind in ('game','badge','story','special','first','challenge','photo')),
  title text not null,
  subtitle text not null default '',
  color text not null default '#E7688A',
  photo_path text,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index memories_couple on public.memories(couple_id, happened_at desc);

create table public.couple_achievements (
  couple_id uuid not null references public.couples(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  progress integer not null default 0,
  unlocked_at timestamptz,
  primary key (couple_id, achievement_id)
);

create table public.challenge_completions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  day date not null,
  completed_by uuid references public.profiles(id) on delete set null,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (couple_id, day)
);

-- ─────────────────────────────────────────────────────────────
-- Bildirimler, raporlar, abonelik, ödemeler
-- ─────────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'info',
  icon text not null default 'notifications',
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications(user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  number serial,
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  couple_id uuid references public.couples(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  type text not null default 'other' check (type in ('chat','photo','content','account','other')),
  title text not null,
  description text not null default '',
  priority text not null default 'med' check (priority in ('low','med','high')),
  status text not null default 'open' check (status in ('open','in_review','resolved','dismissed')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  plan text not null check (plan in ('monthly','yearly','lifetime','gift')),
  status text not null default 'active' check (status in ('trial','active','canceled','expired','billing_issue')),
  provider text not null default 'revenuecat' check (provider in ('revenuecat','admin')),
  provider_ref text,
  price_try numeric(10,2) not null default 0,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_couple on public.subscriptions(couple_id);
create index subscriptions_user on public.subscriptions(user_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  couple_id uuid references public.couples(id) on delete set null,
  provider_ref text,
  amount_try numeric(10,2) not null default 0,
  method text not null default '',
  status text not null default 'paid' check (status in ('paid','failed','refunded','pending')),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Ortak zaman damgası tetikleyicisi
-- ─────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['games','categories','questions','stories','game_sessions','reports','subscriptions'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
