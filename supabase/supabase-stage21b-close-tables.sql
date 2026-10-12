-- ════════════════════════════════════════════════════════════════════════════
-- Этап 21б — закрыть последние двери. Шаг 2 из 2
--
-- Запускать ТОЛЬКО после того, как:
--   • выполнен supabase-stage21-private-data.sql (функции на месте);
--   • выложена новая версия приложения и у сотрудников она уже открылась
--     (приложение само обновляется при запуске; достаточно подождать день-два).
--
-- Что делает: снимает с anon/authenticated прямое чтение шести таблиц и запись в
-- profiles, которые этап 11 оставил открытыми, и право звать achievements_list и
-- menu_progress_list по одному названию ресторана. Новое приложение всё это читает
-- через функции этапа 21 — с проверкой токена.
--
-- Если после запуска что-то перестало показываться — supabase-stage21b-rollback.sql
-- возвращает всё как было (одной командой), и пришли скрин разработчику.
-- Безвреден повторно.
-- ════════════════════════════════════════════════════════════════════════════

-- Страховка 1: без функций этапа 21 закрывать нельзя — новое приложение их ждёт
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('team_scores', 'team_profiles', 'my_state', 'player_detail', 'team_achievements', 'menu_progress_team')) < 6 then
    raise exception 'Сначала выполни supabase-stage21-private-data.sql — функций этапа 21 нет';
  end if;
end $$;

-- Страховка 2: функции, созданные на сервере без «security definer» (с правами того,
-- кто зовёт), после закрытия таблиц перестанут их видеть. Если такие есть и трогают
-- эти шесть таблиц — ничего не закрываем, а показываем их список: пришли скрин.
do $$
declare bad text;
begin
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ' order by p.proname) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f'
     and p.prosrc ~* '\m(profiles|progress|quiz_done|practice_stars|completed_roles|scores)\M';
  if bad is not null then
    raise exception 'Не закрываю: эти функции работают с правами вызывающего и читают/пишут закрываемые таблицы — %. Пришли этот текст разработчику.', bad;
  end if;
end $$;

-- 1) Чтение шести таблиц — только через функции
do $$
declare t text;
begin
  foreach t in array array['profiles','progress','quiz_done','practice_stars','completed_roles','scores'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists sa_read on public.%I', t);
    execute format('revoke select on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 2) Запись в profiles — только функцией save_last_role
do $$
begin
  if to_regclass('public.profiles') is not null then
    drop policy if exists sa_write on public.profiles;
    drop policy if exists sa_update on public.profiles;
    revoke insert, update on public.profiles from anon, authenticated;
  end if;
end $$;

-- 3) Списки по одному названию ресторана — только через функции с токеном
do $$
begin
  if exists (select 1 from pg_proc where proname = 'achievements_list') then
    revoke execute on function achievements_list(text) from public, anon, authenticated;
  end if;
  if exists (select 1 from pg_proc where proname = 'menu_progress_list') then
    revoke execute on function menu_progress_list(text) from public, anon, authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ── Проверка ──────────────────────────────────────────────────────────────────
-- Открытых таблиц для anon больше нет (ожидаем одну строку «прямой доступ: 0»)
select 'прямой доступ anon к таблицам: ' || count(*) as result
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public'
union all
select 'дверь осталась: ' || table_name || ' → ' || string_agg(privilege_type, ', ' order by privilege_type)
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public'
 group by table_name
union all
-- функции с правами владельца, доступные без токена (ожидаем только menu_get, redeem_code, sa_rank)
select 'без токена: ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and has_function_privilege('anon', p.oid, 'execute')
   and not (coalesce(p.proargnames, '{}'::text[]) && array['p_token', 'p_ticket', 'p_code']::text[]);
