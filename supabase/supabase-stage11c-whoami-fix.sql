-- supabase-stage11c-whoami-fix.sql — заплатка: «function whoami(text) does not exist» (Дополнение 155).
--
-- Симптом: «Опубликовать команде» → Ошибка сервера: function whoami(text) does not exist.
-- Причина: функции этапов 4, 6, 7, 8, 8b, 10 зовут whoami(p_token) с текстовым токеном,
-- а whoami в базе принимает другой тип (например, uuid). PostgREST снаружи типы
-- подгоняет, внутри SQL — нет. Затронуты: menu_set, menu_progress_set, set_mentor_pin,
-- confirm_skill_pin, log_quiz_answer, quiz_hard_questions, candidate_save/list/delete,
-- backup_ticket.
--
-- Что делает скрипт (сам, по фактической подписи whoami):
--   1) создаёт переходник whoami_txt(p_token text) → jsonb, который приводит тип и зовёт whoami;
--   2) находит ВСЕ функции public, где встречается «whoami(p_token)», и пересоздаёт их
--      с «whoami_txt(p_token)» — тела не меняются;
--   3) печатает отчёт: подпись whoami и список исправленных функций.
-- Саму whoami не трогает (второй вариант с текстом сломал бы вызовы из приложения).
-- Безвреден повторно.

create temp table if not exists sa_fix_log (n serial, msg text);

do $$
declare r record; fn record; def text; cnt int := 0;
begin
  select p.oid, p.pronargs, format_type(p.proargtypes[0], null) as t0,
         pg_get_function_identity_arguments(p.oid) as args, pg_get_function_result(p.oid) as res
    into r
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'whoami'
  order by p.pronargs limit 1;

  if r is null then
    insert into sa_fix_log(msg) values ('whoami в схеме public не найдена — пришли этот отчёт разработчику');
    return;
  end if;
  insert into sa_fix_log(msg) values (format('whoami(%s) → %s', r.args, r.res));

  -- 1) переходник: текст → тип первого аргумента whoami; результат всегда jsonb
  execute format(
    'create or replace function public.whoami_txt(p_token text) returns jsonb '
    'language sql stable security definer as $f$ select to_jsonb(public.whoami(p_token::%s)) $f$',
    r.t0);
  insert into sa_fix_log(msg) values (format('создан переходник whoami_txt(text) → whoami(%s)', r.t0));

  -- 2) все функции, зовущие whoami(p_token), — на переходник
  for fn in
    select p.oid, p.proname
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname <> 'whoami_txt' and p.prosrc like '%whoami(p_token)%'
    order by p.proname
  loop
    def := replace(pg_get_functiondef(fn.oid), 'whoami(p_token)', 'whoami_txt(p_token)');
    begin
      execute def; cnt := cnt + 1;
      insert into sa_fix_log(msg) values ('исправлена: ' || fn.proname);
    exception when others then
      insert into sa_fix_log(msg) values ('НЕ удалось ' || fn.proname || ': ' || sqlerrm);
    end;
  end loop;
  insert into sa_fix_log(msg) values (format('итого исправлено функций: %s', cnt));
end $$;

select msg as result from sa_fix_log order by n;
