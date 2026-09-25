-- Nocta · güvenlik sıkılaştırma (Supabase advisor önerileri)
alter function public.touch_updated_at() set search_path = public;
alter function public.today_tr() set search_path = public;
alter function public.gen_invite_code() set search_path = public;
alter function public.flirt_level(integer) set search_path = public;
alter function public.check_adult() set search_path = public;

-- Tetikleyici ve iç yardımcı fonksiyonlar API'den çağrılamasın
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.on_message_insert() from authenticated;
revoke execute on function public.protect_profile() from authenticated;
revoke execute on function public.bump_content_version() from authenticated;
revoke execute on function public.setting(text) from authenticated;
revoke execute on function public.couple_is_premium(uuid) from authenticated;
revoke execute on function public.couple_effective_level(uuid) from authenticated;
revoke execute on function public.gen_invite_code() from authenticated;
