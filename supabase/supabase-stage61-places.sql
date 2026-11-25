-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 61 (v198, Доп. 523): заведения и должности — свои списки у владельца, перевод сотрудника.
--
-- Владелец (26.11): «Нужно добавить возможность добавлять заведения. И исключить привязанные. И что бы заведения
-- появлялись после добавления в приложение… Так же нужно добавить возможность добавлять сотрудников, имею ввиду
-- должность». Решили: список начинается пустым, но ничего не удаляем («Ну естественно не чистить полностью»): прежние
-- заведения скрыты, кроме «Два моря, Океан» («это заведение использует приложение»). Правит списки только владелец.
--   • sa_venues — заведения сети: название (как в employees.restaurant и в остальных таблицах с колонкой restaurant),
--     скрыто ли, порядок. Первый запуск: «Два моря, Океан» видно; «Марико», «Мясник», «Порт», «Камчадал» и другие
--     названия из employees скрыты. Сотрудники, меню и история скрытого остаются, вернуть можно одним нажатием.
--   • sa_positions — должности: шесть встроенных (права и курс как раньше) и свои: название и «работает как» одна из
--     шести (base). У сотрудника position — по-прежнему одна из шести (на ней права и курсы в приложении и на сервере),
--     а employees.job_title — id своей должности (null — встроенная).
--   • org_lists(p_token) — списки всем, кто вошёл; владельцу ещё и сколько людей; руководителям — у кого своя должность.
--   • org_venue_save(p_token, p_name, p_new, p_hidden) — добавить (то же название, что у скрытого, возвращает его),
--     переименовать (новое название — во всех таблицах с колонкой restaurant), скрыть, вернуть. Только владелец.
--   • org_position_save(p_token, p_id, p_label, p_base, p_hidden) — то же для должностей; новая «работает как» у своей
--     должности меняет position всем, у кого она. Только владелец.
--   • admin_employee_place(p_token, p_employee_id, p_restaurant, p_title) — перевести сотрудника: заведение и
--     должность. Только владелец.
--   • admin_create_employee_t(p_token, p_name, p_surname, p_restaurant, p_title) — новый сотрудник с должностью из
--     списка: прежний admin_create_employee с «работает как» и job_title новому. Кто может — как у прежнего.
-- Нужен этап 21 (_sa_caller). Таблицы создаёт, ничего не удаляет; повторный запуск списки не трогает.
-- Supabase → SQL Editor → New query → вставить → Run.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
end $$;

-- ── 1) Таблицы ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_venues (
  name       text primary key,                     -- как в employees.restaurant
  hidden     boolean not null default false,
  sort       int not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table sa_venues enable row level security;
revoke all on table sa_venues from public, anon, authenticated;

create table if not exists sa_positions (
  id         text primary key,                     -- встроенные: waiter, hostess…; свои: p + 8 знаков
  label      text not null,
  base       text not null check (base in ('waiter', 'hostess', 'bartender', 'senior_bartender', 'manager', 'senior')),
  builtin    boolean not null default false,
  hidden     boolean not null default false,
  sort       int not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table sa_positions enable row level security;
revoke all on table sa_positions from public, anon, authenticated;

alter table employees add column if not exists job_title text;   -- id своей должности; null — встроенная (position)

-- ── 2) Списки: первый запуск — прежние заведения скрыты, кроме «Два моря, Океан»; встроенные должности ─────────────
do $$
begin
  if not exists (select 1 from sa_venues) then
    insert into sa_venues (name, hidden, sort, updated_by) values
      ('Два моря, Океан', false, 0, 'этап 61'), ('Марико', true, 1, 'этап 61'), ('Мясник', true, 2, 'этап 61'),
      ('Порт', true, 3, 'этап 61'), ('Камчадал', true, 4, 'этап 61')
    on conflict (name) do nothing;
  end if;
end $$;
-- названия, которых в списке нет (сотрудников завели до этапа или старым приложением), — скрытыми: ничего не теряется
insert into sa_venues (name, hidden, sort, updated_by)
  select distinct e.restaurant, true, 10, 'этап 61' from employees e where coalesce(btrim(e.restaurant), '') <> ''
on conflict (name) do nothing;

insert into sa_positions (id, label, base, builtin, sort, updated_by) values
  ('waiter', 'Официант', 'waiter', true, 0, 'этап 61'), ('hostess', 'Хостес', 'hostess', true, 1, 'этап 61'),
  ('bartender', 'Бармен', 'bartender', true, 2, 'этап 61'),
  ('senior_bartender', 'Старший бармен', 'senior_bartender', true, 3, 'этап 61'),
  ('manager', 'Менеджер', 'manager', true, 4, 'этап 61'), ('senior', 'Руководящий состав', 'senior', true, 5, 'этап 61')
on conflict (id) do nothing;

-- ── 3) Служебное ─────────────────────────────────────────────────────────────────────────────────────────────────
-- название: без пробелов по краям и двойных внутри; пусто — null
create or replace function _sa_org_name(p text)
returns text language sql immutable as $$ select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '') $$;

-- ответ со списками для того, кто спрашивает (c — _sa_caller)
create or replace function _sa_org_lists(c jsonb)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v_admin boolean := coalesce((c->>'admin')::boolean, false);
  v_net boolean := coalesce((c->>'network')::boolean, false);
  v_lead boolean := coalesce((c->>'lead')::boolean, false);
  venues jsonb; positions jsonb; titles jsonb := '{}'::jsonb; v_title text;
begin
  select coalesce(jsonb_agg(jsonb_build_object('name', v.name, 'hidden', v.hidden, 'sort', v.sort)
      || case when v_admin then jsonb_build_object('staff', (select count(*) from employees e
           where e.restaurant = v.name and coalesce(e.status, 'active') = 'active')) else '{}'::jsonb end
      order by v.hidden, v.sort, v.name), '[]'::jsonb)
    into venues from sa_venues v;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'base', p.base, 'builtin', p.builtin,
        'hidden', p.hidden, 'sort', p.sort)
      || case when v_admin then jsonb_build_object('staff', (select count(*) from employees e
           where coalesce(e.status, 'active') = 'active' and case when p.builtin
             then lower(coalesce(e.position, '')) = p.id and e.job_title is null else e.job_title = p.id end)) else '{}'::jsonb end
      order by p.sort, p.label), '[]'::jsonb)
    into positions from sa_positions p;
  -- у кого своя должность: сеть (владелец, руководящий состав) — у всех, менеджер — в своём заведении
  if v_lead then
    select coalesce(jsonb_object_agg(e.id::text, e.job_title), '{}'::jsonb) into titles from employees e
     where e.job_title is not null and (v_net or e.restaurant = c->>'restaurant');
  end if;
  select e.job_title into v_title from employees e where e.id::text = c->>'id';
  return jsonb_build_object('ok', true, 'venues', venues, 'positions', positions, 'titles', titles,
    'me', jsonb_build_object('restaurant', c->>'restaurant', 'position', c->>'position', 'title', v_title),
    'can_edit', v_admin);
end $$;

-- ── 4) Списки ────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function org_lists(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb := _sa_caller(p_token);
begin
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return _sa_org_lists(c);
end $$;

-- ── 5) Заведения: добавить, вернуть, переименовать, скрыть ───────────────────────────────────────────────────────
create or replace function org_venue_save(p_token text, p_name text, p_new text default null, p_hidden boolean default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb := _sa_caller(p_token); v_old text := _sa_org_name(p_name); v_new text := _sa_org_name(p_new);
  v_row sa_venues; v_twin sa_venues; v_done text; r record; n bigint; v_rows bigint := 0;
begin
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'admin')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if length(coalesce(v_new, '')) > 60 then return jsonb_build_object('ok', false, 'error', 'too_long'); end if;
  if v_old is null then   -- добавить
    if v_new is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    select * into v_twin from sa_venues where lower(name) = lower(v_new) limit 1;
    if found then         -- такое уже есть: скрытое — вернуть со всеми данными
      if v_twin.hidden then
        update sa_venues set hidden = false, updated_by = c->>'who', updated_at = now() where name = v_twin.name;
      end if;
      return _sa_org_lists(c) || jsonb_build_object('done', case when v_twin.hidden then 'returned' else 'exists' end, 'name', v_twin.name);
    end if;
    insert into sa_venues (name, hidden, sort, updated_by)
      values (v_new, false, coalesce((select max(sort) + 1 from sa_venues where not hidden), 0), c->>'who');
    return _sa_org_lists(c) || jsonb_build_object('done', 'added', 'name', v_new);
  end if;
  select * into v_row from sa_venues where name = v_old;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_new is not null and v_new <> v_row.name then   -- переименовать: везде, где есть колонка restaurant
    select * into v_twin from sa_venues where lower(name) = lower(v_new) and name <> v_row.name limit 1;
    if found then return jsonb_build_object('ok', false, 'error', 'exists', 'name', v_twin.name); end if;
    begin
      for r in select col.table_name, col.column_name from information_schema.columns col
                 join information_schema.tables t on t.table_schema = col.table_schema and t.table_name = col.table_name
                where col.table_schema = 'public' and t.table_type = 'BASE TABLE' and col.table_name <> 'sa_venues'
                  and col.column_name in ('restaurant', 'emp_rest') and col.data_type in ('text', 'character varying')
      loop
        execute format('update %I set %I = $1 where %I = $2', r.table_name, r.column_name, r.column_name) using v_new, v_row.name;
        get diagnostics n = row_count; v_rows := v_rows + n;
      end loop;
      update sa_venues set name = v_new, updated_by = c->>'who', updated_at = now() where name = v_row.name;
    exception when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'busy');   -- новое название уже занято старыми данными
    end;
    v_row.name := v_new; v_done := 'renamed';
  end if;
  if p_hidden is not null and p_hidden <> v_row.hidden then
    update sa_venues set hidden = p_hidden, updated_by = c->>'who', updated_at = now() where name = v_row.name;
    v_done := case when p_hidden then 'hidden' else 'returned' end;
  end if;
  return _sa_org_lists(c) || jsonb_build_object('done', coalesce(v_done, 'same'), 'name', v_row.name, 'rows', v_rows);
end $$;

-- ── 6) Должности: добавить, вернуть, переименовать, «работает как», скрыть ───────────────────────────────────────
create or replace function org_position_save(p_token text, p_id text, p_label text default null, p_base text default null,
  p_hidden boolean default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb := _sa_caller(p_token); v_label text := _sa_org_name(p_label);
  v_base text := nullif(lower(btrim(coalesce(p_base, ''))), ''); v_row sa_positions; v_twin sa_positions; v_id text;
  v_done text; n bigint := 0;
begin
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'admin')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if length(coalesce(v_label, '')) > 40 then return jsonb_build_object('ok', false, 'error', 'too_long'); end if;
  if v_base is not null and v_base not in ('waiter', 'hostess', 'bartender', 'senior_bartender', 'manager', 'senior') then
    return jsonb_build_object('ok', false, 'error', 'bad_base');
  end if;
  if coalesce(btrim(p_id), '') = '' then   -- добавить
    if v_label is null or v_base is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    select * into v_twin from sa_positions where lower(label) = lower(v_label) limit 1;
    if found then
      if not v_twin.hidden then return jsonb_build_object('ok', false, 'error', 'exists', 'id', v_twin.id); end if;
      update sa_positions set hidden = false, updated_by = c->>'who', updated_at = now() where id = v_twin.id;
      return _sa_org_lists(c) || jsonb_build_object('done', 'returned', 'id', v_twin.id);
    end if;
    v_id := 'p' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    insert into sa_positions (id, label, base, builtin, sort, updated_by)
      values (v_id, v_label, v_base, false, coalesce((select max(sort) + 1 from sa_positions), 0), c->>'who');
    return _sa_org_lists(c) || jsonb_build_object('done', 'added', 'id', v_id);
  end if;
  select * into v_row from sa_positions where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_label is not null and v_label <> v_row.label then
    if exists (select 1 from sa_positions where lower(label) = lower(v_label) and id <> v_row.id) then
      return jsonb_build_object('ok', false, 'error', 'exists');
    end if;
    update sa_positions set label = v_label, updated_by = c->>'who', updated_at = now() where id = v_row.id;
    v_done := 'renamed';
  end if;
  if v_base is not null and v_base <> v_row.base then
    if v_row.builtin then return jsonb_build_object('ok', false, 'error', 'builtin'); end if;
    update sa_positions set base = v_base, updated_by = c->>'who', updated_at = now() where id = v_row.id;
    update employees set position = v_base where job_title = v_row.id;
    get diagnostics n = row_count;
    if to_regclass('public.profiles') is not null then
      update profiles set position = v_base where user_id::text in (select id::text from employees where job_title = v_row.id);
    end if;
    v_done := 'based';
  end if;
  if p_hidden is not null and p_hidden <> v_row.hidden then
    update sa_positions set hidden = p_hidden, updated_by = c->>'who', updated_at = now() where id = v_row.id;
    v_done := case when p_hidden then 'hidden' else 'returned' end;
  end if;
  return _sa_org_lists(c) || jsonb_build_object('done', coalesce(v_done, 'same'), 'id', v_row.id, 'rows', n);
end $$;

-- ── 7) Перевести сотрудника: заведение и должность ───────────────────────────────────────────────────────────────
create or replace function admin_employee_place(p_token text, p_employee_id text, p_restaurant text, p_title text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb := _sa_caller(p_token); v_rest text := _sa_org_name(p_restaurant); v_p sa_positions; e record;
  v_pos text; v_title text;
begin
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'admin')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select * into e from employees where id::text = p_employee_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_rest is null or not exists (select 1 from sa_venues where name = v_rest and not hidden) then
    return jsonb_build_object('ok', false, 'error', 'no_venue');
  end if;
  select * into v_p from sa_positions where id = p_title and not hidden;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_position'); end if;
  -- владельцу — только заведение: должность и права владельца не трогаем
  v_pos := case when coalesce(e.is_admin, false) then e.position else v_p.base end;
  v_title := case when coalesce(e.is_admin, false) then e.job_title when v_p.builtin then null else v_p.id end;
  update employees set restaurant = v_rest, position = v_pos, job_title = v_title where id = e.id;
  if to_regclass('public.profiles') is not null then
    update profiles set restaurant = v_rest, position = v_pos where user_id::text = e.id::text;
  end if;
  return jsonb_build_object('ok', true, 'employee', jsonb_build_object('id', e.id, 'restaurant', v_rest, 'position', v_pos,
    'job_title', v_title));
end $$;

-- ── 8) Новый сотрудник с должностью из списка ────────────────────────────────────────────────────────────────────
create or replace function admin_create_employee_t(p_token text, p_name text, p_surname text, p_restaurant text, p_title text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb := _sa_caller(p_token); v_p sa_positions; v_rest text := _sa_org_name(p_restaurant); v_before text[];
  res jsonb; v_new text;
begin
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'admin_create_employee') then
    return jsonb_build_object('ok', false, 'error', 'no_create');
  end if;
  select * into v_p from sa_positions where id = p_title and not hidden;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_position'); end if;
  if v_rest is null or not exists (select 1 from sa_venues where name = v_rest) then
    return jsonb_build_object('ok', false, 'error', 'no_venue');
  end if;
  select coalesce(array_agg(id::text), '{}') into v_before from employees;
  -- прежняя функция: права, код входа, проверки — её; параметры именами, типы она решает сама
  execute format('select to_jsonb(admin_create_employee(p_token => %L, p_name => %L, p_surname => %L, p_restaurant => %L, p_position => %L))',
    p_token, p_name, coalesce(p_surname, ''), v_rest, v_p.base) into res;
  if res is null or jsonb_typeof(res) <> 'object' or coalesce((res->>'ok')::boolean, false) is not true then
    return coalesce(res, jsonb_build_object('ok', false, 'error', 'create_failed'));
  end if;
  v_new := coalesce(res->>'employee_id', res->'employee'->>'id', res->>'id');
  if v_new is null then select id::text into v_new from employees where not (id::text = any(v_before)) limit 1; end if;
  if v_new is not null and not v_p.builtin then
    update employees set job_title = v_p.id where id::text = v_new;
  end if;
  return res || jsonb_build_object('employee_id', v_new, 'job_title', case when v_p.builtin then null else v_p.id end);
end $$;

revoke all on function _sa_org_lists(jsonb) from public, anon, authenticated;
grant execute on function org_lists(text) to anon, authenticated;
grant execute on function org_venue_save(text, text, text, boolean) to anon, authenticated;
grant execute on function org_position_save(text, text, text, text, boolean) to anon, authenticated;
grant execute on function admin_employee_place(text, text, text, text) to anon, authenticated;
grant execute on function admin_create_employee_t(text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 9) Проверка: ожидаем «заведения и должности: функций 5 из 5 · заведений в списке … (скрыто …) · должностей …» ──
select 'заведения и должности: функций ' ||
  ((to_regprocedure('public.org_lists(text)') is not null)::int + (to_regprocedure('public.org_venue_save(text, text, text, boolean)') is not null)::int
   + (to_regprocedure('public.org_position_save(text, text, text, text, boolean)') is not null)::int
   + (to_regprocedure('public.admin_employee_place(text, text, text, text)') is not null)::int
   + (to_regprocedure('public.admin_create_employee_t(text, text, text, text, text)') is not null)::int) || ' из 5' ||
  ' · заведений в списке ' || (select count(*) from sa_venues where not hidden) ||
  ' (скрыто ' || (select count(*) from sa_venues where hidden) || ')' ||
  ' · должностей ' || (select count(*) from sa_positions where not hidden) ||
  ' (своих ' || (select count(*) from sa_positions where not builtin) || ')' as result;
