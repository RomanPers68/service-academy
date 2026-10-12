-- ════════════════════════════════════════════════════════════════════════════
-- Откат этапа 21б — вернуть двери этапа 11, если после закрытия что-то пропало.
-- Функции этапа 21 остаются (они ничему не мешают). Служебная _sa_wipe_person
-- остаётся закрытой — её снаружи не зовёт никто.
-- Безвреден повторно.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array['profiles','progress','quiz_done','practice_stars','completed_roles','scores'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('drop policy if exists sa_read on public.%I', t);
    execute format('create policy sa_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    grant insert, update on public.profiles to anon, authenticated;
    drop policy if exists sa_write on public.profiles;
    create policy sa_write on public.profiles for insert to anon, authenticated with check (true);
    drop policy if exists sa_update on public.profiles;
    create policy sa_update on public.profiles for update to anon, authenticated using (true) with check (true);
  end if;
  if exists (select 1 from pg_proc where proname = 'achievements_list') then
    grant execute on function achievements_list(text) to anon, authenticated;
  end if;
  if exists (select 1 from pg_proc where proname = 'menu_progress_list') then
    grant execute on function menu_progress_list(text) to anon, authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';

select 'откат 21б выполнен: двери этапа 11 снова открыты' as result;
