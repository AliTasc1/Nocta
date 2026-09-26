-- Yeni oyun motorları: 'emoji' (emoji şıklı, doğru cevaplı) ve 'cards' (resimli kartlar, eşleşme)
alter table public.games drop constraint games_engine_check;
alter table public.games add constraint games_engine_check check (engine in
  ('truth_dare','would_you_rather','know_me','challenges','secret_questions','this_or_that','story','chat_game','quiz','emoji','cards'));

-- Kart görselleri: media[i] = options[i] kartının resim adresi (boş olabilir)
alter table public.questions add column media jsonb not null default '[]'::jsonb;
alter table public.questions drop constraint if exists questions_correct_index_check;
alter table public.questions add constraint questions_correct_index_check check (correct_index is null or correct_index between 0 and 5);

-- finish_session: eşleşme + doğru sayısı emoji ve kartlar için de hesaplansın
do $$ begin
  execute replace(replace(pg_get_functiondef('public.finish_session(uuid)'::regprocedure),
    '''know_me'',''quiz'') then',
    '''know_me'',''quiz'',''emoji'',''cards'') then'),
    'when g.engine = ''quiz'' then',
    'when g.engine = ''cards'' then matches || ''/'' || rounds_played || '' aynı kart''
      when g.engine in (''quiz'',''emoji'') then');
end $$;

-- Kart görselleri için herkese açık depolama (yalnızca içerik yöneticileri yükler)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
create policy card_images_read on storage.objects for select to anon, authenticated using (bucket_id = 'card-images');
create policy card_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'card-images' and public.admin_role() in ('owner','content'));
create policy card_images_update on storage.objects for update to authenticated
  using (bucket_id = 'card-images' and public.admin_role() in ('owner','content'));
create policy card_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'card-images' and public.admin_role() in ('owner','content'));
