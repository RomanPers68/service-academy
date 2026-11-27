-- ════════════════════════════════════════════════════════════════════════════
-- Этап 66 (Доп. 529): порядок в базе
--
-- Что делает:
--   1. Шесть старых таблиц (profiles, progress, quiz_done, practice_stars, completed_roles, scores)
--      больше не читаются напрямую ключом приложения, в profiles нельзя писать напрямую. Это то,
--      что должен был сделать этап 21б. Старые разрешающие правила (allow_all, sa_read,
--      sa_read_<таблица>, sa_write, sa_update) убраны. Приложение берёт эти данные через функции
--      этапа 21, с проверкой токена. achievements_list и menu_progress_list по одному названию
--      ресторана (так звали версии приложения до этапа 21) тоже закрыты.
--   2. Служебные функции (имя начинается с «_») снаружи не позвать: их зовут только другие
--      функции базы. Если служебную функцию зовёт открытая функция с правами вызывающего
--      (app_bootstrap, sa_rank) или правило таблицы — её не трогаем.
--   3. У каждой функции схемы public закреплён search_path. Где его не было — «public, extensions»:
--      функции видят то же, что и раньше.
--   4. Журнал расписания (cron.job_run_details) раз в сутки чистится: хранятся последние 14 дней
--      (задача sa-cron-clean). Без pg_cron шаг пропускается.
--
-- Нужен этап 21. Безвреден повторно. Если перезапускаешь старые этапы (create or replace без
-- search_path или с открытыми правами) — после них снова этап 66.
-- Откат — supabase-stage66-rollback.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Страховка 1: без функций этапа 21 закрывать нельзя — приложение читает через них
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('team_scores', 'team_profiles', 'my_state', 'player_detail', 'team_achievements', 'menu_progress_team')) < 6 then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): функций этапа 21 нет';
  end if;
end $$;

-- Страховка 2: функции с правами вызывающего, которые трогают эти таблицы, после закрытия их не увидят
do $$
declare bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by 1) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and p.prosrc ~* '\m(profiles|progress|quiz_done|practice_stars|completed_roles|scores)\M';
  if bad is not null then
    raise exception 'Не закрываю: эти функции работают с правами вызывающего и трогают старые таблицы — %', bad;
  end if;
end $$;

-- 1) Шесть старых таблиц — только через функции
do $$
declare t text; pol record;
begin
  foreach t in array array['profiles', 'progress', 'quiz_done', 'practice_stars', 'completed_roles', 'scores'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for pol in select policyname from pg_policies
                where schemaname = 'public' and tablename = t
                  and policyname in ('allow_all', 'sa_read', 'sa_write', 'sa_update', 'sa_read_' || t) loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
  if to_regprocedure('public.achievements_list(text)') is not null then
    revoke all on function public.achievements_list(text) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.menu_progress_list(text)') is not null then
    revoke all on function public.menu_progress_list(text) from public, anon, authenticated;
  end if;
end $$;

-- 2) Служебные функции — только изнутри базы
do $$
declare keep text[]; f record;
begin
  select coalesce(array_agg(distinct h.proname), '{}') into keep
    from pg_proc h join pg_namespace hn on hn.oid = h.pronamespace
   where hn.nspname = 'public' and h.proname like '\_%'
     and (exists (select 1 from pg_proc p join pg_namespace pn on pn.oid = p.pronamespace
                   where pn.nspname = 'public' and not p.prosecdef and p.proname not like '\_%'
                     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
                     and p.prosrc ~ ('\m' || h.proname || '\M'))
       or exists (select 1 from pg_policies pl
                   where coalesce(pl.qual, '') || ' ' || coalesce(pl.with_check, '') ~ ('\m' || h.proname || '\M')));
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like '\_%' and p.prokind = 'f'
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
              and not (p.proname = any (keep))
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- 3) search_path у каждой функции
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind in ('f', 'p')
              and p.prorettype <> 'event_trigger'::regtype
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
              and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop;
end $$;

-- 4) Журнал расписания — последние 14 дней
do $$
declare st text := 'нет pg_cron'; n int := 0;
begin
  if to_regclass('cron.job') is not null then
    begin
      perform cron.schedule('sa-cron-clean', '17 4 * * *',
        $c$delete from cron.job_run_details where end_time < now() - interval '14 days'$c$);
      execute 'select count(*) from cron.job where jobname = $1' into n using 'sa-cron-clean';
      st := case when n > 0 then 'хранится 14 дней' else 'НЕ НАСТРОЕН' end;
    exception when others then
      st := 'НЕ НАСТРОЕН: ' || sqlerrm;
    end;
  end if;
  perform set_config('sa.stage66_cron', st, false);
end $$;

-- Итог одной строкой
select 'порядок в базе, этап 66: старые таблицы закрыты ' ||
  (select count(*) from unnest(array['profiles', 'progress', 'quiz_done', 'practice_stars', 'completed_roles', 'scores']) t
    where to_regclass('public.' || t) is not null
      and not has_table_privilege('anon', ('public.' || t)::regclass, 'select,insert,update,delete')
      and not has_table_privilege('authenticated', ('public.' || t)::regclass, 'select,insert,update,delete')) ||
  ' из ' || (select count(*) from unnest(array['profiles', 'progress', 'quiz_done', 'practice_stars', 'completed_roles', 'scores']) t
              where to_regclass('public.' || t) is not null) ||
  ' · служебные функции снаружи: ' ||
  coalesce((select 'только ' || string_agg(distinct p.proname, ', ' order by p.proname) || ' (их зовут открытые функции)'
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname like '\_%' and p.prokind = 'f'
               and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
               and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))), 'нет') ||
  ' · без search_path: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p') and p.prorettype <> 'event_trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')) ||
  ' · журнал расписания: ' || coalesce(current_setting('sa.stage66_cron', true), '—') as result;
