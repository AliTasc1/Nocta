-- 1) Tek seferlik (patlayan) fotoğraf / video
-- Dosyalar chat-media/<couple_id>/vo/<uuid>.<ext> yoluna yüklenir; bu klasör istemciden
-- doğrudan okunamaz. Alıcı yalnızca 'view-once' edge fonksiyonu üzerinden BİR kez açabilir.
alter table public.messages drop constraint messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text','challenge','photo','video','system','screenshot'));

create table public.view_once_opens (
  message_id uuid primary key references public.messages(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  file_deleted boolean not null default false
);
alter table public.view_once_opens enable row level security;
create policy view_once_select on public.view_once_opens for select to authenticated
  using (public.is_open_couple_member(couple_id) or public.is_admin());
alter publication supabase_realtime add table public.view_once_opens;

drop policy chat_media_read on storage.objects;
create policy chat_media_read on storage.objects for select to authenticated using (
  bucket_id = 'chat-media'
  and coalesce((storage.foldername(name))[2], '') <> 'vo'
  and (public.is_open_couple_member(((storage.foldername(name))[1])::uuid) or public.is_admin())
);

do $$ begin
  execute replace(pg_get_functiondef('public.on_message_insert()'::regprocedure),
    'when new.kind = ''photo'' then ''📷 Fotoğraf''',
    'when coalesce((new.meta->>''view_once'')::boolean, false) then ''💣 Tek seferlik medya''
                 when new.kind = ''photo'' then ''📷 Fotoğraf''
                 when new.kind = ''video'' then ''🎬 Video''');
end $$;

-- 2) Tanıtım ödülü: video paylaş, 24 saat yayında kalsın → 30 gün premium
create table public.promo_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('tiktok','instagram','youtube')),
  url text not null check (url ~* '^https?://'),
  handle text not null default '',
  note text not null default '',
  proof_paths text[] not null default '{}',
  posted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  premium_until timestamptz,
  created_at timestamptz not null default now()
);
create index promo_submissions_user on public.promo_submissions(user_id, created_at desc);
create index promo_submissions_status on public.promo_submissions(status, created_at desc);
alter table public.promo_submissions enable row level security;

create policy promo_select on public.promo_submissions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy promo_insert on public.promo_submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null and premium_until is null);
create policy promo_admin_update on public.promo_submissions for update to authenticated
  using (public.admin_role() in ('owner','moderator','support')) with check (public.admin_role() in ('owner','moderator','support'));

create or replace function public.guard_promo_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((public.setting('promo_enabled'))::text::boolean, true) then
    raise exception 'Bu kampanya şu an aktif değil.';
  end if;
  if exists (select 1 from promo_submissions where user_id = new.user_id and status in ('pending','approved')) then
    raise exception 'Zaten bekleyen ya da onaylanmış bir başvurun var.';
  end if;
  if public.i_am_premium() then
    raise exception 'Bu ödül yalnızca ücretsiz üyeler içindir.';
  end if;
  new.status := 'pending'; new.reviewed_by := null; new.reviewed_at := null; new.premium_until := null; new.admin_note := '';
  return new;
end $$;
create trigger promo_guard_insert before insert on public.promo_submissions
  for each row execute function public.guard_promo_insert();
revoke execute on function public.guard_promo_insert() from public, anon, authenticated;

create or replace function public.admin_review_promo(p_id uuid, p_approve boolean, p_note text default '')
returns public.promo_submissions
language plpgsql security definer set search_path = public as $$
declare ps promo_submissions; cid uuid; days int; until timestamptz;
begin
  if coalesce(public.admin_role(), '') not in ('owner','moderator','support') then raise exception 'Yetkisiz'; end if;
  select * into ps from promo_submissions where id = p_id for update;
  if not found then raise exception 'Başvuru bulunamadı.'; end if;
  if ps.status = 'approved' then raise exception 'Bu başvuru zaten onaylandı.'; end if;
  if not p_approve then
    update promo_submissions set status = 'rejected', admin_note = coalesce(p_note,''), reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_id returning * into ps;
    perform public.notify_user(ps.user_id, 'promo', 'campaign', 'Tanıtım başvurun onaylanmadı',
      coalesce(nullif(p_note,''), 'Detaylar için profilindeki Ödül bölümüne bak.'), jsonb_build_object('route','/promo'));
    return ps;
  end if;
  days := coalesce((public.setting('promo_days'))::text::int, 30);
  until := now() + make_interval(days => days);
  select id into cid from couples where (user_a = ps.user_id or user_b = ps.user_id) and status in ('pending','active') limit 1;
  insert into subscriptions (couple_id, user_id, plan, status, provider, provider_ref, started_at, expires_at)
  values (cid, ps.user_id, 'gift', 'active', 'admin', 'promo:' || ps.id, now(), until);
  update promo_submissions set status = 'approved', admin_note = coalesce(p_note,''), reviewed_by = auth.uid(), reviewed_at = now(), premium_until = until
    where id = p_id returning * into ps;
  perform public.notify_user(ps.user_id, 'promo', 'workspace_premium', 'Tebrikler! ' || days || ' gün Premium kazandın 🎉',
    'Tanıtım videon için teşekkürler. Premium şimdi aktif.', jsonb_build_object('route','/promo'));
  return ps;
end $$;
revoke execute on function public.admin_review_promo(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_promo(uuid, boolean, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promo-proofs', 'promo-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;
create policy promo_proofs_read on storage.objects for select to authenticated using (
  bucket_id = 'promo-proofs' and (((storage.foldername(name))[1])::uuid = auth.uid() or public.is_admin())
);
create policy promo_proofs_write on storage.objects for insert to authenticated with check (
  bucket_id = 'promo-proofs' and ((storage.foldername(name))[1])::uuid = auth.uid()
);

insert into app_settings (key, value, is_public) values
  ('promo_enabled', 'true', true),
  ('promo_days', '30', true),
  ('promo_min_hours', '24', true)
on conflict (key) do nothing;
