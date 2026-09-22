-- ════════════════════════════════════════════════════════════════════════════
-- Этап 18 — чек-листы, полная проверка функций, заведения в редакторе контента
--
-- 1) Чек-листы не сохранялись: «function public._sa_identity(uuid) does not exist».
--    Функции чек-листов (их создавали на сервере, в проекте их нет) проверяют сессию
--    служебной функцией _sa_identity и передают ей токен типа uuid, а она принимает
--    другой тип. Создаём переходник _sa_identity(uuid) → существующая _sa_identity:
--    чинит чек-листы и любые другие функции, которые зовут её так же.
-- 2) Полная проверка всех функций базы расширением plpgsql_check (есть в Supabase):
--    вызовы несуществующих функций, колонок, таблиц — сразу по всей базе, чтобы
--    не находить такие поломки по одной. Только чтение, ничего не меняет.
-- 3) Редактор контента: учитывают ли функции cms_* заведение — чтобы свой урок одного
--    ресторана не появился в другом.
-- Запускать в SQL Editor. Повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

create temp table if not exists sa_check18 (n serial, что text, статус text, подробности text);
truncate sa_check18;

do $$
declare
  f record; at text; rt text; body text; chk_schema text; errs int := 0; checked int := 0;
begin
  -- ── 1) переходник _sa_identity(uuid) ──────────────────────────────────────
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = '_sa_identity') then
    insert into sa_check18(что, статус, подробности) values ('_sa_identity', 'НЕТ НА СЕРВЕРЕ', 'функции нет вовсе — пришли этот скрин разработчику');
  elsif exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                 where ns.nspname = 'public' and p.proname = '_sa_identity' and p.pronargs = 1
                   and format_type(p.proargtypes[0], null) = 'uuid') then
    insert into sa_check18(что, статус, подробности) values ('_sa_identity(uuid)', 'уже есть', '');
  else
    select format_type(p.proargtypes[0], null), pg_get_function_result(p.oid) into at, rt
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = '_sa_identity' and p.pronargs = 1
     order by p.oid limit 1;
    if at is null then
      insert into sa_check18(что, статус, подробности) values ('_sa_identity', 'НЕ ПОНЯТЬ ПОДПИСЬ', 'у неё не один параметр — пришли скрин разработчику');
    else
      body := case when rt ~* '^(table|setof)'
                   then format('select * from public._sa_identity(p_token::%s)', at)
                   else format('select public._sa_identity(p_token::%s)', at) end;
      execute format('create function public._sa_identity(p_token uuid) returns %s '
                     'language sql stable security definer set search_path to public as $f$ %s $f$', rt, body);
      insert into sa_check18(что, статус, подробности)
      values ('_sa_identity(uuid)', 'СОЗДАН ПЕРЕХОДНИК', 'uuid → _sa_identity(' || at || '), результат ' || rt || ' — чек-листы должны сохраняться');
    end if;
  end if;

  -- ── 2) полная проверка функций: plpgsql_check ─────────────────────────────
  -- в Supabase расширения ставят в схему extensions; не вышло — обычным способом
  begin
    create extension if not exists plpgsql_check with schema extensions;
  exception when others then
    begin
      create extension if not exists plpgsql_check;
    exception when others then
      insert into sa_check18(что, статус, подробности) values ('plpgsql_check', 'НЕДОСТУПНО', sqlerrm);
    end;
  end;
  select ns.nspname into chk_schema from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where p.proname = 'plpgsql_check_function_tb' limit 1;
  if chk_schema is not null then
    for f in
      select p.oid, p.proname from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
        join pg_language l on l.oid = p.prolang
       where ns.nspname = 'public' and l.lanname = 'plpgsql'
         and p.prorettype <> 'trigger'::regtype and p.prorettype <> 'event_trigger'::regtype
       order by p.proname
    loop
      checked := checked + 1;
      begin
        execute format(
          'insert into sa_check18(что, статус, подробности)
           select %L, ''ОШИБКА'', coalesce(e.message, '''') || coalesce('' · строка '' || e.lineno, '''')
             from %I.plpgsql_check_function_tb(%s::regprocedure) e where e.level = ''error''',
          f.proname, chk_schema, f.oid);
        get diagnostics errs = row_count;
      exception when others then
        insert into sa_check18(что, статус, подробности) values (f.proname, 'не проверить', sqlerrm);
      end;
    end loop;
    insert into sa_check18(что, статус, подробности)
    values ('проверка функций', format('проверено %s', checked),
            (select format('с ошибками: %s', count(distinct что)) from sa_check18 where статус = 'ОШИБКА'));
  end if;
end $$;

-- ── 3) редактор контента: учитывают ли функции заведение ─────────────────────
insert into sa_check18(что, статус, подробности)
select p.proname,
       case when p.prosrc ~* 'restaurant' then 'учитывает заведение' else 'ЗАВЕДЕНИЕ НЕ УЧТЕНО' end,
       coalesce((select string_agg(trim(m[1]), ' | ')
                   from regexp_matches(p.prosrc, '([^\n]*restaurant[^\n]*)', 'gi') as m), '—')
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public' and p.proname in ('cms_list_lessons', 'cms_save_lesson', 'cms_delete_lesson')
 order by p.proname;

-- Разбудить сервер API, чтобы приложение увидело переходник (см. этап 9)
notify pgrst, 'reload schema';

select что, статус, подробности from sa_check18 order by n;
