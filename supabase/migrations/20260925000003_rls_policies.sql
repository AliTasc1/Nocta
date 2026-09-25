-- Nocta · satır düzeyi güvenlik, yönetici RPC'leri, depolama, realtime

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['profiles','couples','blocks','admins','app_settings','games','categories','questions',
    'question_usage','stories','story_scenes','story_choices','story_choice_stats','achievements','game_sessions',
    'session_answers','messages','memories','couple_achievements','challenge_completions','notifications','reports',
    'subscriptions','payments'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Profiller
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or id = public.my_partner_id() or public.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Çiftler (değişiklikler yalnızca RPC ile)
create policy couples_select on public.couples for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid() or public.is_admin());
create policy couples_admin_update on public.couples for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy couples_admin_delete on public.couples for delete to authenticated
  using (public.admin_role() in ('owner','moderator'));

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Yöneticiler
create policy admins_select on public.admins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy admins_owner_write on public.admins for all to authenticated
  using (public.admin_role() = 'owner') with check (public.admin_role() = 'owner');

-- Ayarlar
create policy settings_public_read on public.app_settings for select to anon, authenticated
  using (is_public or public.is_admin());
create policy settings_admin_write on public.app_settings for all to authenticated
  using (public.admin_role() in ('owner','content')) with check (public.admin_role() in ('owner','content'));

-- İçerik: herkes aktif içeriği okur, yöneticiler yazar
create policy games_read on public.games for select to authenticated using (is_active or public.is_admin());
create policy categories_read on public.categories for select to authenticated using (is_active or public.is_admin());
create policy questions_read on public.questions for select to authenticated using (
  public.is_admin() or (
    is_active and exists (
      select 1 from public.categories c join public.games g on g.id = c.game_id
      where c.id = category_id and c.is_active and g.is_active
        and ((not c.is_premium and not g.is_premium and level <= public.free_max_level()) or public.i_am_premium())
    )
  )
);
create policy stories_read on public.stories for select to authenticated using (is_active or public.is_admin());
create policy scenes_read on public.story_scenes for select to authenticated using (
  public.is_admin() or exists (select 1 from public.stories s where s.id = story_id and s.is_active and (not s.is_premium or public.i_am_premium()))
);
create policy choices_read on public.story_choices for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.story_scenes sc join public.stories s on s.id = sc.story_id
    where sc.id = scene_id and s.is_active and (not s.is_premium or public.i_am_premium())
  )
);
create policy achievements_read on public.achievements for select to authenticated using (is_active or public.is_admin());
create policy usage_admin on public.question_usage for select to authenticated using (public.is_admin());
create policy choice_stats_admin on public.story_choice_stats for select to authenticated using (public.is_admin());

do $$ declare t text; begin
  foreach t in array array['games','categories','questions','stories','story_scenes','story_choices','achievements'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.admin_role() in (''owner'',''content'')) with check (public.admin_role() in (''owner'',''content''))', t || '_admin_write', t);
  end loop;
end $$;

-- Oyun oturumları (yazma RPC ile)
create policy sessions_select on public.game_sessions for select to authenticated
  using (public.is_couple_member(couple_id) or public.is_admin());

create or replace function public.i_answered(p_session uuid, p_round int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from session_answers where session_id = p_session and round = p_round and user_id = auth.uid());
$$;

-- Cevaplar: kendi cevabını her zaman görürsün; partnerinkini ancak aynı turda sen de cevapladıysan
create policy answers_select on public.session_answers for select to authenticated using (
  user_id = auth.uid()
  or public.is_admin()
  or (
    exists (select 1 from public.game_sessions s where s.id = session_id and public.is_couple_member(s.couple_id))
    and public.i_answered(session_id, round)
  )
);
create policy answers_insert on public.session_answers for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.game_sessions s where s.id = session_id and s.status = 'playing' and public.is_couple_member(s.couple_id)
  )
);
create policy answers_update on public.session_answers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Mesajlar
create policy messages_select on public.messages for select to authenticated using (
  (public.is_couple_member(couple_id) and (expires_at is null or expires_at > now())) or public.is_admin()
);
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and couple_id = public.my_active_couple_id()
);
create policy messages_update on public.messages for update to authenticated
  using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
create policy messages_delete on public.messages for delete to authenticated
  using (sender_id = auth.uid() or public.admin_role() in ('owner','moderator'));

-- Anılar
create policy memories_select on public.memories for select to authenticated
  using (public.is_couple_member(couple_id) or public.is_admin());
create policy memories_insert on public.memories for insert to authenticated
  with check (couple_id = public.my_active_couple_id() and created_by = auth.uid());
create policy memories_delete on public.memories for delete to authenticated
  using (public.is_couple_member(couple_id));

create policy couple_ach_select on public.couple_achievements for select to authenticated
  using (public.is_couple_member(couple_id) or public.is_admin());
create policy completions_select on public.challenge_completions for select to authenticated
  using (public.is_couple_member(couple_id) or public.is_admin());

-- Bildirimler
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Raporlar
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin on public.reports for update to authenticated
  using (public.admin_role() in ('owner','moderator','support')) with check (public.admin_role() in ('owner','moderator','support'));

-- Abonelik & ödemeler
create policy subs_select on public.subscriptions for select to authenticated using (
  user_id = auth.uid() or public.is_couple_member(couple_id) or public.is_admin()
);
create policy subs_admin on public.subscriptions for all to authenticated
  using (public.admin_role() in ('owner','support')) with check (public.admin_role() in ('owner','support'));
create policy payments_select on public.payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy payments_admin on public.payments for all to authenticated
  using (public.admin_role() = 'owner') with check (public.admin_role() = 'owner');

