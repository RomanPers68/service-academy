-- ════════════════════════════════════════════════════════════════════════════
-- Этап 20 — сброс прогресса дочищает следы
--
-- Жалоба владельца: «сбрасываю прогресс, а в аналитике остаются корни».
-- Так и есть: admin_reset_player убирает результаты и прохождение, но записи
-- аналитики (ответы, выходы из тестов, ключи лазейки), прогресс по меню и
-- ачивки привязаны к строке «Имя Фамилия» и остаются.
--
-- Этап добавляет две функции:
--   admin_wipe_traces(p_token, p_name, p_surname) — чистит следы сотрудника
--     (quiz_events, quiz_skips, quiz_keys, menu_progress, achievements) и ставит
--     метку сброса в player_resets. Зовёт приложение сразу после сброса и после
--     удаления сотрудника. Только руководители.
--   my_reset_at(p_token) — метка сброса для того, кто спрашивает. Приложение
--     сотрудника видит её при входе и стирает своё: прохождение, тесты, баллы,
--     звёзды, банк ошибок. Метка надёжнее «пустого ответа с сервера»: сбой сети
--     ничего не сотрёт.
--
-- Запускать в SQL Editor. Повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists player_resets (
  restaurant text,
  employee   text not null,          -- «Имя Фамилия», как в quiz_events
  reset_at   timestamptz not null default now(),
  primary key (employee, restaurant)
);
alter table player_resets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'player_resets' and policyname = 'player_resets_none') then
    create policy player_resets_none on player_resets for all using (false);
  end if;
end $$;

-- Кто спрашивает: разбираем ответ whoami_txt, не зная точной формы
create or replace function _sa_who(p_token text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v jsonb;
begin
  begin v := whoami_txt(p_token); exception when others then return null; end;
  if v is null then return null; end if;
  return coalesce(v->'employee', v);
end; $$;

create or replace function admin_wipe_traces(p_token text, p_name text, p_surname text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare v jsonb; v_rest text; v_pos text; v_admin boolean; who text; target text; n bigint; total bigint := 0;
begin
  v := _sa_who(p_token);
  if v is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_rest  := v->>'restaurant';
  v_pos   := coalesce(v->>'position', '');
  v_admin := coalesce((v->>'is_admin')::boolean, false);
  if not (v_admin or v_pos in ('manager', 'senior')) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  who := btrim(coalesce(p_name, '') || ' ' || coalesce(p_surname, ''));
  if who = '' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  -- ресторан сотрудника; не нашли — ресторан того, кто чистит
  begin
    select e.restaurant into target from employees e
     where e.name = p_name and coalesce(e.surname, '') = coalesce(p_surname, '') limit 1;
  exception when others then target := null; end;
  target := coalesce(target, v_rest);

  -- следы по строке «Имя Фамилия» в своём ресторане
  if to_regclass('public.quiz_events') is not null then
    execute 'delete from quiz_events where employee = $1 and ($2 is null or restaurant is null or restaurant = $2)' using who, target;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.quiz_skips') is not null then
    execute 'delete from quiz_skips where employee = $1 and ($2 is null or restaurant is null or restaurant = $2)' using who, target;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.quiz_keys') is not null then
    execute 'delete from quiz_keys where employee = $1 and ($2 is null or restaurant is null or restaurant = $2)' using who, target;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.menu_progress') is not null then
    execute 'delete from menu_progress where employee = $1 and ($2 is null or restaurant = $2)' using who, target;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.achievements') is not null then
    execute 'delete from achievements where employee_id in (select id from employees where name = $1 and coalesce(surname, '''') = coalesce($2, ''''))' using p_name, p_surname;
    get diagnostics n = row_count; total := total + n;
  end if;

  insert into player_resets(restaurant, employee, reset_at) values (target, who, now())
    on conflict (employee, restaurant) do update set reset_at = now();

  return jsonb_build_object('ok', true, 'employee', who, 'restaurant', target, 'rows', total);
end; $$;

-- Метка сброса для того, кто спрашивает: приложение сотрудника стирает своё
create or replace function my_reset_at(p_token text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v jsonb; who text; ts timestamptz;
begin
  v := _sa_who(p_token);
  if v is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  who := btrim(coalesce(v->>'name', '') || ' ' || coalesce(v->>'surname', ''));
  select max(reset_at) into ts from player_resets
   where employee = who and (restaurant is null or restaurant = v->>'restaurant');
  return jsonb_build_object('ok', true, 'reset_at', ts);
end; $$;

-- Удалённый свой урок: следы его шагов (ответы, выходы, ключи, результаты)
-- остаются на сервере. Редактор зовёт эту функцию сразу после удаления урока.
create or replace function admin_wipe_lesson_traces(p_token text, p_ids text[])
returns jsonb language plpgsql security definer set search_path to public as $$
declare v jsonb; v_pos text; v_admin boolean; n bigint; total bigint := 0;
begin
  v := _sa_who(p_token);
  if v is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_pos := coalesce(v->>'position', ''); v_admin := coalesce((v->>'is_admin')::boolean, false);
  if not (v_admin or v_pos in ('manager', 'senior')) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    return jsonb_build_object('ok', true, 'rows', 0);
  end if;
  if to_regclass('public.quiz_events') is not null then
    execute 'delete from quiz_events where lesson_id = any($1)' using p_ids;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.quiz_skips') is not null then
    execute 'delete from quiz_skips where lesson_id = any($1)' using p_ids;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.quiz_keys') is not null then
    execute 'delete from quiz_keys where lesson_id = any($1)' using p_ids;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.scores') is not null then
    execute 'delete from scores where quiz_id = any($1)' using p_ids;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.progress') is not null then
    execute 'delete from progress where lesson_id = any($1)' using p_ids;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.quiz_done') is not null then
    execute 'delete from quiz_done where quiz_id = any($1)' using p_ids;
    get diagnostics n = row_count; total := total + n;
  end if;
  if to_regclass('public.practice_stars') is not null then
    execute 'delete from practice_stars where lesson_id = any($1)' using p_ids;
    get diagnostics n = row_count; total := total + n;
  end if;
  return jsonb_build_object('ok', true, 'rows', total);
end; $$;

grant execute on function admin_wipe_lesson_traces(text, text[]) to anon, authenticated;
grant execute on function admin_wipe_traces(text, text, text) to anon, authenticated;
grant execute on function my_reset_at(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Что чистит сам сброс (для сведения: функция создана на сервере)
select 'admin_reset_player чистит: ' ||
       coalesce((select string_agg(distinct m[1], ', ')
                   from pg_proc p, regexp_matches(p.prosrc, 'delete\s+from\s+(?:public\.)?([a-z_]+)', 'gi') as m
                  where p.proname = 'admin_reset_player'), '— не удалось разобрать') as "сброс",
       (select count(*) from pg_proc where proname in ('admin_wipe_traces', 'my_reset_at', 'admin_wipe_lesson_traces')) as "новых функций (ожидаем 3)";
