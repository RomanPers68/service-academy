-- ════════════════════════════════════════════════════════════════════════════
-- Этап 20б — почему зачистка не сработала + ручная чистка
--
-- После сброса следы в аналитике остались. Возможных причин две:
--   1) новый клиент ещё не залит — приложение не зовёт admin_wipe_traces;
--   2) функция отказала на проверке прав: она смотрит employee.is_admin и
--      employee.position из whoami_txt, а в этой базе поле может называться
--      иначе или быть пустым. Клиент ошибку не показывает.
--
-- Этот этап: показывает запись сотрудника и счётчики следов ДО, чистит их
-- вручную (здесь права не нужны — SQL Editor работает от владельца базы),
-- показывает счётчики ПОСЛЕ и заменяет admin_wipe_traces на версию с более
-- мягкой проверкой прав (is_admin из whoami ИЛИ из таблицы employees ИЛИ
-- должность из списка руководящих).
--
-- ▸ ИМЯ И ФАМИЛИЯ — в двух строках ниже. Поменяй, если чистишь другого.
-- Запускать в SQL Editor. Повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_name    text := 'Роман';        -- ← имя
  v_surname text := 'Переверзев';   -- ← фамилия
  who  text := btrim(v_name || ' ' || coalesce(v_surname, ''));
  uid  text;
  tbl  text;
  n    bigint;
  before_txt text := '';
  after_txt  text := '';
  cnt  bigint;
begin
  -- 1. кто это в базе: должность и признак руководителя
  begin
    select e.id::text into uid from employees e
     where e.name = v_name and coalesce(e.surname, '') = coalesce(v_surname, '') limit 1;
  exception when others then uid := null; end;
  raise notice '— сотрудник: % · id: %', who, coalesce(uid::text, 'не найден');

  -- 2. сколько следов сейчас
  foreach tbl in array array['quiz_events', 'quiz_skips', 'quiz_keys', 'menu_progress'] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('select count(*) from %I where employee = $1', tbl) into cnt using who;
      before_txt := before_txt || tbl || '=' || cnt || ' ';
    end if;
  end loop;
  if uid is not null then
    foreach tbl in array array['progress', 'quiz_done', 'practice_stars', 'completed_roles', 'achievements'] loop
      if to_regclass('public.' || tbl) is not null then
        if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = tbl and column_name = 'user_id') then
          execute format('select count(*) from %I where user_id::text = $1', tbl) into cnt using uid;
          before_txt := before_txt || tbl || '=' || cnt || ' ';
        elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = tbl and column_name = 'employee_id') then
          execute format('select count(*) from %I where employee_id::text = $1', tbl) into cnt using uid;
          before_txt := before_txt || tbl || '=' || cnt || ' ';
        end if;
      end if;
    end loop;
  end if;
  raise notice '— следов ДО: %', before_txt;

  -- 3. чистим вручную
  foreach tbl in array array['quiz_events', 'quiz_skips', 'quiz_keys', 'menu_progress'] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('delete from %I where employee = $1', tbl) using who;
    end if;
  end loop;
  if uid is not null then
    foreach tbl in array array['progress', 'quiz_done', 'practice_stars', 'completed_roles'] loop
      if to_regclass('public.' || tbl) is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = tbl and column_name = 'user_id') then
        execute format('delete from %I where user_id::text = $1', tbl) using uid;
      end if;
    end loop;
    if to_regclass('public.achievements') is not null then
      delete from achievements where employee_id::text = uid;
    end if;
    if to_regclass('public.scores') is not null then
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scores' and column_name = 'user_id') then
        execute 'delete from scores where user_id::text = $1' using uid;
      elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scores' and column_name = 'employee') then
        execute 'delete from scores where employee = $1' using who;
      end if;
    end if;
  end if;

  -- 4. метка сброса, чтобы телефон сотрудника тоже очистился
  if to_regclass('public.player_resets') is not null then
    insert into player_resets(restaurant, employee, reset_at)
    values ((select e.restaurant from employees e where e.id::text = uid), who, now())
    on conflict (employee, restaurant) do update set reset_at = now();
  end if;

  -- 5. сколько осталось
  foreach tbl in array array['quiz_events', 'quiz_skips', 'quiz_keys', 'menu_progress'] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('select count(*) from %I where employee = $1', tbl) into cnt using who;
      after_txt := after_txt || tbl || '=' || cnt || ' ';
    end if;
  end loop;
  raise notice '— следов ПОСЛЕ: %', after_txt;
end $$;

-- ── Мягче проверка прав: is_admin из whoami ИЛИ из employees ИЛИ должность ──
create or replace function admin_wipe_traces(p_token text, p_name text, p_surname text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare v jsonb; v_rest text; v_pos text; v_admin boolean; v_me text;
        who text; target text; uid text; tbl text; n bigint; total bigint := 0;
begin
  v := _sa_who(p_token);
  if v is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_rest  := v->>'restaurant';
  v_pos   := lower(coalesce(v->>'position', ''));
  v_admin := coalesce((v->>'is_admin')::boolean, false);
  v_me    := btrim(coalesce(v->>'name', '') || ' ' || coalesce(v->>'surname', ''));
  -- признак руководителя из таблицы сотрудников, если в whoami его нет
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
          or who = v_me) then                      -- себя чистить можно всегда
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'position', v_pos, 'is_admin', v_admin);
  end if;

  begin
    select e.restaurant, e.id::text into target, uid from employees e
     where e.name = p_name and coalesce(e.surname, '') = coalesce(p_surname, '') limit 1;
  exception when others then target := null; uid := null; end;
  target := coalesce(target, v_rest);

  foreach tbl in array array['quiz_events', 'quiz_skips', 'quiz_keys', 'menu_progress'] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('delete from %I where employee = $1', tbl) using who;
      get diagnostics n = row_count; total := total + n;
    end if;
  end loop;
  if uid is not null then
    if to_regclass('public.achievements') is not null then
      delete from achievements where employee_id::text = uid;
      get diagnostics n = row_count; total := total + n;
    end if;
    foreach tbl in array array['progress', 'quiz_done', 'practice_stars', 'completed_roles'] loop
      if to_regclass('public.' || tbl) is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = tbl and column_name = 'user_id') then
        execute format('delete from %I where user_id::text = $1', tbl) using uid;
        get diagnostics n = row_count; total := total + n;
      end if;
    end loop;
    if to_regclass('public.scores') is not null then
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scores' and column_name = 'user_id') then
        execute 'delete from scores where user_id::text = $1' using uid;
      elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scores' and column_name = 'employee') then
        execute 'delete from scores where employee = $1' using who;
      end if;
      get diagnostics n = row_count; total := total + n;
    end if;
  end if;

  insert into player_resets(restaurant, employee, reset_at) values (target, who, now())
    on conflict (employee, restaurant) do update set reset_at = now();

  return jsonb_build_object('ok', true, 'employee', who, 'restaurant', target, 'rows', total);
end; $$;

grant execute on function admin_wipe_traces(text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';

-- Итог: что осталось по сотруднику (ожидаем нули) и должность в базе
select (select count(*) from quiz_events where employee = 'Роман Переверзев') as "ответов осталось",
       (select count(*) from quiz_skips  where employee = 'Роман Переверзев') as "выходов осталось",
       (select count(*) from quiz_keys   where employee = 'Роман Переверзев') as "ключей осталось",
       (select string_agg(distinct coalesce(to_jsonb(e)->>'position', '—')
                 || case when coalesce((to_jsonb(e)->>'is_admin')::boolean, false) then ' · руководитель' else '' end, ', ')
          from employees e where e.name = 'Роман') as "должность в базе";
