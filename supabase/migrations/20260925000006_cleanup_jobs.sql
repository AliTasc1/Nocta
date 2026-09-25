-- Nocta · periyodik temizlik (pg_cron)
create extension if not exists pg_cron;

-- Süresi dolan kaybolan mesajları ve terk edilmiş oturumları temizle
create or replace function public.cleanup_expired() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from messages where expires_at is not null and expires_at < now();
  update game_sessions set status = 'canceled'
   where status in ('lobby','playing') and updated_at < now() - interval '6 hours';
end $$;
revoke execute on function public.cleanup_expired() from public, anon, authenticated;

select cron.schedule('nocta-cleanup', '*/15 * * * *', $$select public.cleanup_expired()$$);
