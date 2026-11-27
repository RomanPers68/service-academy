-- ════════════════════════════════════════════════════════════════════════════
-- Откат этапа 66 — вернуть доступы, как было до него
--
-- Открывает старые таблицы на чтение (и profiles на запись), как было после этапа 11,
-- возвращает вызов служебных функций снаружи и убирает чистку журнала расписания.
-- search_path у функций не трогает: он ничего не ломает.
-- Нужен только если после этапа 66 что-то перестало показываться. Безвреден повторно.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['profiles', 'progress', 'quiz_done', 'practice_stars', 'completed_roles', 'scores'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('grant select on public.%I to anon, authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'sa_read') then
      execute format('create policy sa_read on public.%I for select to anon, authenticated using (true)', t);
    end if;
  end loop;
  if to_regclass('public.profiles') is not null then
    grant insert, update on public.profiles to anon, authenticated;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'sa_write') then
      create policy sa_write on public.profiles for insert to anon, authenticated with check (true);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'sa_update') then
      create policy sa_update on public.profiles for update to anon, authenticated using (true) with check (true);
    end if;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.achievements_list(text)', 'public.menu_progress_list(text)',
    'public._sa_identity(uuid)', 'public._sa_who(text)', 'public._cms_actor(uuid)', 'public._swap_auth(text,text)',
    'public._cms_can_edit(public.employees)', 'public._sa_org_name(text)', 'public._sa_urldecode(text)',
    'public._sa_name_tokens(text)', 'public._sa_thanks_tags()', 'public._sa_thanks_tag_ru(text)', 'public._sa_hh(numeric)'] loop
    if to_regprocedure(f) is not null then
      execute format('grant execute on function %s to anon, authenticated', to_regprocedure(f));
    end if;
  end loop;
end $$;

do $$
declare n int := 0;
begin
  if to_regclass('cron.job') is null then return; end if;
  execute 'select count(*) from cron.job where jobname = $1' into n using 'sa-cron-clean';
  if n > 0 then perform cron.unschedule('sa-cron-clean'); end if;
end $$;

select 'откат этапа 66: старые таблицы снова открыты на чтение — ' ||
  (select count(*) from unnest(array['profiles', 'progress', 'quiz_done', 'practice_stars', 'completed_roles', 'scores']) t
    where to_regclass('public.' || t) is not null and has_table_privilege('anon', ('public.' || t)::regclass, 'select')) ||
  ' · чтобы снова закрыть — этап 66' as result;
