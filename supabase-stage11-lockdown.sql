-- supabase-stage11-lockdown.sql — Этап 11: замок на базу (Дополнение 131).
--
-- Было: RLS включён только на трёх таблицах графика; все остальные таблицы
-- public открыты для anon-ключа, а он лежит в JS у каждого сотрудника.
-- Любой с DevTools мог стереть restaurant_menu или прочитать candidate_results.
--
-- Стало: RLS на ВСЕХ таблицах public, прямой доступ anon/authenticated снят.
-- Открытыми остаются ровно те двери, которыми приложение пользуется напрямую
-- (проверено по коду, Дополнение 131):
--   чтение:  profiles, progress, quiz_done, practice_stars, completed_roles, scores
--   запись:  profiles (upsert last_role из экрана ролей)
-- Всё остальное идёт через ваши функции security definer (владелец postgres —
-- RLS его не касается) и Edge Functions с service_role (обходят RLS). Для них
-- ничего не меняется.
--
-- Безвреден повторно. Откат — supabase-stage11-rollback.sql.

-- 1) RLS на каждой таблице public (и на будущих — см. замечание внизу)
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end $$;

-- 2) Снять прямые права anon/authenticated со всех таблиц
revoke all on all tables in schema public from anon, authenticated;

-- 3) Новые таблицы не должны открываться сами
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- 4) Семь дверей приложения: чтение шести таблиц…
do $$
declare t text;
begin
  foreach t in array array['profiles','progress','quiz_done','practice_stars','completed_roles','scores'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relname = t and c.relkind = 'r') then
      raise notice 'таблицы % нет (или это view) — пропускаю', t; continue;
    end if;
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('drop policy if exists sa_read on public.%I', t);
    execute format('create policy sa_read on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- …и запись профиля (upsert: insert + update)
grant insert, update on public.profiles to anon, authenticated;
drop policy if exists sa_write on public.profiles;
create policy sa_write on public.profiles for insert to anon, authenticated with check (true);
drop policy if exists sa_update on public.profiles;
create policy sa_update on public.profiles for update to anon, authenticated using (true) with check (true);

-- 5) Последовательности (serial-id) — нужны для insert в profiles, секретов не содержат
grant usage, select on all sequences in schema public to anon, authenticated;

-- 6) Подтверждение: таблицы без RLS (ожидаем 0) и открытые двери (ожидаем 7 строк)
select 'без RLS: ' || count(*) || ' таблиц (ожидаем 0)' as result
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'дверь: ' || table_name || ' → ' || string_agg(privilege_type, ', ' order by privilege_type)
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
group by table_name
order by 1;

-- ЗАМЕЧАНИЕ НА БУДУЩЕЕ: каждую новую таблицу создавать со строкой
--   alter table <имя> enable row level security;
-- и ходить в неё функцией security definer, а не напрямую.
