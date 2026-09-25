-- Hikâye anısı başlığını Türkçeleştir (yeni kurulumda 002 zaten düzeltilmiş olduğundan etkisizdir)
do $$ begin
  execute replace(pg_get_functiondef('public.finish_session(uuid)'::regprocedure), '''Couple Story · ''', '''Çift Hikâyesi · ''');
end $$;
