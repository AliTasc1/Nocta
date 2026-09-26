-- Testler: 4 seçenekli çoktan seçmeli sorular. correct_index doluysa bilgi testi (doğru cevap puanlanır),
-- boşsa uyum testi (iki partnerin aynı şıkkı seçmesi eşleşme sayılır).
alter table public.games drop constraint games_engine_check;
alter table public.games add constraint games_engine_check check (engine in
  ('truth_dare','would_you_rather','know_me','challenges','secret_questions','this_or_that','story','chat_game','quiz'));

alter table public.questions add column correct_index smallint check (correct_index is null or correct_index between 0 and 3);

-- finish_session: quiz için eşleşme + doğru sayısı
do $$ begin
  execute replace(replace(pg_get_functiondef('public.finish_session(uuid)'::regprocedure),
    'if g.engine in (''would_you_rather'',''this_or_that'',''secret_questions'',''know_me'') then',
    'if g.engine in (''would_you_rather'',''this_or_that'',''secret_questions'',''know_me'',''quiz'') then'),
    'when g.engine = ''know_me'' then matches || '' doğru tahmin''',
    'when g.engine = ''know_me'' then matches || '' doğru tahmin''
      when g.engine = ''quiz'' then matches || ''/'' || rounds_played || '' aynı cevap'' || coalesce('' · '' || (
        select string_agg(coalesce(p.display_name, ''?'') || '' '' || x.n || '' doğru'', '', '')
        from (select a.user_id, count(*) filter (where (a.answer->>''choice'')::int = q.correct_index) as n
              from session_answers a join questions q on q.id = a.question_id
              where a.session_id = s.id and q.correct_index is not null group by a.user_id) x
        join profiles p on p.id = x.user_id), '''')');
end $$;

-- Başlangıç içeriği (oyun + 3 test + 22 soru) canlı veritabanına bu migration ile eklendi;
-- yeni kurulumda supabase/seed/seed_quiz.sql dosyasını çalıştırın.
