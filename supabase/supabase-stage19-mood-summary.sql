-- ════════════════════════════════════════════════════════════════════════════
-- Этап 19 — сводка настроения команды (mood_summary)
--
-- Проверка функций (этап 18) нашла одну ошибку на всю базу:
--   mood_summary — column reference "is_admin" is ambiguous · строка 21.
-- В функции есть переменная или параметр с тем же именем, что колонка is_admin в
-- таблице сотрудников, и в запросе база не понимает, о чём речь. Функция создавалась
-- на сервере, её кода в проекте нет, поэтому лечим штатным для PostgreSQL способом:
-- в начало тела функции ставится директива #variable_conflict use_column — при
-- совпадении имён в запросе берётся колонка таблицы. Больше в функции ничего не
-- меняется. После починки этап сам перепроверяет её (plpgsql_check из этапа 18).
-- Запускать в SQL Editor. Повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

create temp table if not exists sa_check19 (n serial, что text, статус text, подробности text);
truncate sa_check19;

do $$
declare d text; fn_oid oid; chk_schema text; errs text;
begin
  select p.oid, pg_get_functiondef(p.oid) into fn_oid, d
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'mood_summary'
   order by p.oid limit 1;
  if d is null then
    insert into sa_check19(что, статус, подробности) values ('mood_summary', 'НЕТ НА СЕРВЕРЕ', 'нечего чинить');
    return;
  end if;

  if d ~* '#variable_conflict' then
    insert into sa_check19(что, статус, подробности) values ('mood_summary', 'уже починена', 'директива уже стоит');
  elsif position('AS $function$' in d) = 0 then
    insert into sa_check19(что, статус, подробности) values ('mood_summary', 'НЕ ПОНЯТЬ КОД', 'нет AS $function$ — пришли скрин разработчику');
    return;
  else
    d := replace(d, 'AS $function$', 'AS $function$' || chr(10) || '#variable_conflict use_column');
    execute d;
    insert into sa_check19(что, статус, подробности) values ('mood_summary', 'ПОЧИНЕНА', 'при совпадении имён берётся колонка таблицы');
  end if;

  -- перепроверка тем же plpgsql_check, что в этапе 18
  select ns.nspname into chk_schema from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where p.proname = 'plpgsql_check_function_tb' limit 1;
  if chk_schema is null then
    insert into sa_check19(что, статус, подробности) values ('перепроверка', 'пропущена', 'нет plpgsql_check — запусти сначала этап 18');
    return;
  end if;
  execute format('select string_agg(coalesce(e.message, '''') || coalesce('' · строка '' || e.lineno, ''''), '' | '')
                    from %I.plpgsql_check_function_tb(%s::regprocedure) e where e.level = ''error''', chk_schema, fn_oid)
    into errs;
  insert into sa_check19(что, статус, подробности)
  values ('перепроверка mood_summary', case when errs is null then 'ошибок нет' else 'ОШИБКА' end, coalesce(errs, 'функция в порядке'));
end $$;

notify pgrst, 'reload schema';

select что, статус, подробности from sa_check19 order by n;
