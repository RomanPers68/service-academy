-- ════════════════════════════════════════════════════════════════════════════
-- Этап 20г — зачистка сама находит, по какому полю искать человека
--
-- Что вскрылось: в этой базе таблицы хранят сотрудника по-разному.
--   quiz_events, quiz_skips, quiz_keys, menu_progress — строкой «Имя Фамилия»;
--   progress, quiz_done, practice_stars, completed_roles — по user_id;
--   achievements — по employee_id;
--   scores — по name + surname (!) — а прежняя версия зачистки этот вариант
--   не проверяла, поэтому результаты тестов переживали сброс.
--
-- Теперь для каждой таблицы поле определяется на месте: user_id → employee_id →
-- employee → name+surname. Если у таблицы есть restaurant, чистится только свой
-- ресторан. Ничего не найдено — таблица просто пропускается.
--
-- Этап заменяет admin_wipe_traces, сразу чистит указанного сотрудника вручную
-- и показывает отчёт по таблицам.
--
-- ▸ ИМЯ И ФАМИЛИЯ для ручной чистки — в двух строках ниже.
-- Запускать в SQL Editor. Повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

-- Удаление строк одного сотрудника из одной таблицы. Возвращает сколько удалено.
create or replace function _sa_wipe_person(p_table text, p_uid text, p_who text, p_name text, p_surname text, p_rest text)
returns bigint language plpgsql security definer set search_path to public as $$
declare
  n bigint := 0; has_rest boolean; key_cond text; rest_cond text; p1 text; p2 text;
  col_exists boolean;
begin
  if to_regclass('public.' || p_table) is null then return 0; end if;

  has_rest := exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = p_table and column_name = 'restaurant');

  -- по какому полю искать человека в этой таблице
  if p_uid is not null and exists (select 1 from information_schema.columns
       where table_schema = 'public' and table_name = p_table and column_name = 'user_id') then
    key_cond := 'user_id::text = $1 and ($2 is null or $2 is not null)'; p1 := p_uid; p2 := null;
  elsif p_uid is not null and exists (select 1 from information_schema.columns
       where table_schema = 'public' and table_name = p_table and column_name = 'employee_id') then
    key_cond := 'employee_id::text = $1 and ($2 is null or $2 is not null)'; p1 := p_uid; p2 := null;
  elsif exists (select 1 from information_schema.columns
       where table_schema = 'public' and table_name = p_table and column_name = 'employee') then
    key_cond := 'employee = $1 and ($2 is null or $2 is not null)'; p1 := p_who; p2 := null;
  elsif exists (select 1 from information_schema.columns
       where table_schema = 'public' and table_name = p_table and column_name = 'name') then
    col_exists := exists (select 1 from information_schema.columns
                           where table_schema = 'public' and table_name = p_table and column_name = 'surname');
    if col_exists then
      key_cond := 'name = $1 and coalesce(surname, ) = coalesce($2, )'; p1 := p_name; p2 := coalesce(p_surname, '');
    else
      key_cond := 'name = $1 and ($2 is null or $2 is not null)'; p1 := p_name; p2 := null;
    end if;
  else
    return 0;   -- не понимаем, как в этой таблице записан человек
  end if;

  -- свой ресторан, если у таблицы есть такое поле
  if has_rest and p_rest is not null then
    rest_cond := ' and (restaurant is null or restaurant = $3)';
  else
    rest_cond := ' and ($3 is null or $3 is not null)';   -- всегда истина; $3 нужен для единообразия
  end if;

  execute format('delete from %I where %s%s', p_table, key_cond, rest_cond) using p1, p2, p_rest;
  get diagnostics n = row_count;
  return n;
end; $$;

-- Зачистка следов сотрудника: все таблицы разом
create or replace function admin_wipe_traces(p_token text, p_name text, p_surname text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare v jsonb; v_rest text; v_pos text; v_admin boolean; v_me text;
        who text; target text; uid text; tbl text; n bigint; total bigint := 0; det jsonb := '{}'::jsonb;
begin
  v := _sa_who(p_token);
  if v is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_rest  := v->>'restaurant';
  v_pos   := lower(coalesce(v->>'position', ''));
  v_admin := coalesce((v->>'is_admin')::boolean, false);
  v_me    := btrim(coalesce(v->>'name', '') || ' ' || coalesce(v->>'surname', ''));
  if not v_admin then
    begin
      select coalesce(e.is_admin, false) into v_admin from employees e
       where e.name = v->>'name' and coalesce(e.surname, '') = coalesce(v->>'surname', '') limit 1;
    exception when others then null; end;
  end if;
  who := btrim(coalesce(p_name, '') || ' ' || coalesce(p_surname, ''));
  if who = '' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if not (coalesce(v_admin, false)
          or v_pos in ('manager', 'senior', 'owner', 'head', 'admin', 'service_manager')
          or who = v_me) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'position', v_pos);
  end if;

  begin
    select e.restaurant, e.id::text into target, uid from employees e
     where e.name = p_name and coalesce(e.surname, '') = coalesce(p_surname, '') limit 1;
  exception when others then target := null; uid := null; end;
  target := coalesce(target, v_rest);

  foreach tbl in array array['quiz_events', 'quiz_skips', 'quiz_keys', 'menu_progress', 'achievements',
                             'progress', 'quiz_done', 'practice_stars', 'completed_roles', 'scores'] loop
    n := _sa_wipe_person(tbl, uid, who, p_name, p_surname, target);
    total := total + n;
    if n > 0 then det := det || jsonb_build_object(tbl, n); end if;
  end loop;

  insert into player_resets(restaurant, employee, reset_at) values (target, who, now())
    on conflict (employee, restaurant) do update set reset_at = now();

  return jsonb_build_object('ok', true, 'employee', who, 'restaurant', target, 'rows', total, 'tables', det);
end; $$;

grant execute on function admin_wipe_traces(text, text, text) to anon, authenticated;
grant execute on function _sa_wipe_person(text, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';

-- ── Ручная чистка прямо сейчас + отчёт ──────────────────────────────────────
do $$
declare
  v_name    text := 'Роман';        -- ← имя
  v_surname text := 'Переверзев';   -- ← фамилия
  who text := btrim(v_name || ' ' || coalesce(v_surname, ''));
  uid text; rest text; tbl text; n bigint; rep text := '';
begin
  begin
    select e.id::text, e.restaurant into uid, rest from employees e
     where e.name = v_name and coalesce(e.surname, '') = coalesce(v_surname, '') limit 1;
  exception when others then uid := null; rest := null; end;
  foreach tbl in array array['quiz_events', 'quiz_skips', 'quiz_keys', 'menu_progress', 'achievements',
                             'progress', 'quiz_done', 'practice_stars', 'completed_roles', 'scores'] loop
    n := _sa_wipe_person(tbl, uid, who, v_name, v_surname, rest);
    if n > 0 then rep := rep || tbl || '=' || n || ' '; end if;
  end loop;
  if to_regclass('public.player_resets') is not null then
    insert into player_resets(restaurant, employee, reset_at) values (rest, who, now())
      on conflict (employee, restaurant) do update set reset_at = now();
  end if;
  raise notice '— вычищено: %', coalesce(nullif(rep, ''), 'нечего было чистить');
end $$;

-- Итог: что осталось по сотруднику (ожидаем нули)
select (select count(*) from scores      where name = 'Роман' and coalesce(surname, '') = 'Переверзев') as "результатов осталось",
       (select count(*) from quiz_events where employee = 'Роман Переверзев')                            as "ответов осталось",
       (select count(*) from quiz_keys   where employee = 'Роман Переверзев')                            as "ключей осталось";
