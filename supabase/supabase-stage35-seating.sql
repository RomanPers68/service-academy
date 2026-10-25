-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 35 (v85, Доп. 398): рассадка для хостес.
--
-- Схема зала и живая доска столов на сегодня — общая для всей смены, с любого телефона:
--   • floor_save(p_token, p_plan) — руководитель или старший рисует схему: столы (номер, места, форма, клетка сетки
--     8 клеток в ширину, 30 в глубину);
--   • seat_board(p_token) — схема, состояние столов на сегодня (по часам заведения: новый день — чистая доска), кто из
--     команды может обслуживать (для выбора официанта), время сервера;
--   • seat_set(p_token, p_tid, p_status, p_cnt, p_name, p_rtime, p_waiter) — стол: свободен, бронь (время, на кого,
--     сколько), посадили (сколько гостей, официант; время посадки — сервера), уборка. Менять может любой сотрудник
--     заведения: доска общая, последнее изменение стола — главное. Официанту, которому посадили гостей, бот пишет
--     (вид «Рассадка»), себе — нет;
--   • seat_clear(p_token) — руководитель очищает доску на сегодня.
-- Брони на сегодня видит брифинг смены (v82).
--
-- Нужны этапы 21, 22б, 24 и 25 (лучше и 32: тогда «Рассадка» появится в «Напоминаниях в Telegram»).
-- Ничего не удаляет. Можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is null then
    raise exception 'Сначала этап 22б (supabase-stage22b-telegram-reminders.sql): нужен бот — таблица tg_links и sa_tg_send';
  end if;
  if to_regprocedure('public._sa_tz(text)') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужен часовой пояс заведения _sa_tz';
  end if;
  if to_regclass('public.sa_notify_prefs') is null or to_regprocedure('public._sa_tg_chat(text,text)') is null then
    raise exception 'Сначала этап 25 (supabase-stage25-live.sql): нужны настройки сообщений sa_notify_prefs и _sa_tg_chat';
  end if;
end $$;

-- ── 1) Таблицы и вид сообщений ─────────────────────────────────────────────────
create table if not exists sa_floor (
  restaurant text primary key,
  plan       jsonb not null,                    -- { v: 1, tables: [{ id, n, seats, shape, x, y }] } (lib/seating.js)
  updated_by text,
  updated_at timestamptz not null default now()
);
create table if not exists sa_seat (
  restaurant  text not null,
  day         date not null,                    -- день по часам заведения
  tid         text not null,                    -- стол из схемы
  status      text not null default 'free',     -- free | res | seat | clean
  cnt         int not null default 0,           -- гостей (посадили или в брони)
  name        text not null default '',         -- бронь: на кого
  rtime       text not null default '',         -- бронь: ЧЧ:ММ
  since       timestamptz,                      -- посадили в (время сервера)
  waiter_id   text,
  waiter_name text not null default '',
  updated_by  text,
  updated_name text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (restaurant, day, tid)
);
alter table sa_floor enable row level security;
alter table sa_seat enable row level security;
revoke all on table sa_floor, sa_seat from public, anon, authenticated;

alter table sa_notify_prefs add column if not exists seat boolean not null default true;

-- ── 2) Схема зала ──────────────────────────────────────────────────────────────
create or replace function floor_save(p_token text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; n int; bad int; plan jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' or jsonb_typeof(p_plan->'tables') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'bad_plan');
  end if;
  n := jsonb_array_length(p_plan->'tables');
  if n > 80 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  select count(*) into bad from jsonb_array_elements(p_plan->'tables') t
   where jsonb_typeof(t) <> 'object'
      or coalesce(t->>'id', '') !~ '^t[0-9a-z]{1,12}$'
      or length(btrim(coalesce(t->>'n', ''))) not between 1 and 6
      or coalesce(t->>'shape', '') not in ('sq', 'rd', 'long')
      -- числа — через case: порядок проверок в or не гарантирован, а «abc»::int — ошибка
      or (case when coalesce(t->>'seats', '') ~ '^\d{1,2}$' then (t->>'seats')::int else 0 end) not between 1 and 20
      or (case when coalesce(t->>'x', '') ~ '^\d{1,2}$' then (t->>'x')::int else 99 end) > case when t->>'shape' = 'long' then 6 else 7 end
      or (case when coalesce(t->>'y', '') ~ '^\d{1,2}$' then (t->>'y')::int else 99 end) > 29;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  if (select count(distinct t->>'id') from jsonb_array_elements(p_plan->'tables') t) <> n
     or (select count(distinct lower(btrim(t->>'n'))) from jsonb_array_elements(p_plan->'tables') t) <> n then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;
  plan := jsonb_build_object('v', 1, 'tables', coalesce((select jsonb_agg(jsonb_build_object('id', t->>'id', 'n', btrim(t->>'n'), 'seats', (t->>'seats')::int,
            'shape', t->>'shape', 'x', (t->>'x')::int, 'y', (t->>'y')::int) order by i) from jsonb_array_elements(p_plan->'tables') with ordinality as q(t, i)), '[]'::jsonb));
  insert into sa_floor (restaurant, plan, updated_by) values (rest, plan, c->>'id')
  on conflict (restaurant) do update set plan = excluded.plan, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true, 'tables', n);
end; $$;

-- ── 3) Доска на сегодня ────────────────────────────────────────────────────────
create or replace function _sa_seat_json(s sa_seat)
returns jsonb language sql stable as $$
  select jsonb_build_object('tid', s.tid, 'status', s.status, 'cnt', s.cnt, 'name', s.name, 'rtime', s.rtime, 'since', s.since,
    'waiter_id', s.waiter_id, 'waiter_name', s.waiter_name, 'updated_name', s.updated_name, 'updated_at', s.updated_at)
$$;

create or replace function seat_board(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; pl jsonb; staff jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select plan into pl from sa_floor where restaurant = rest;
  begin
    execute $q$select coalesce(jsonb_agg(jsonb_build_object('id', e.id::text, 'name', e.name, 'surname', coalesce(e.surname, ''),
                 'position', lower(coalesce(to_jsonb(e)->>'position', ''))) order by e.name, e.surname), '[]'::jsonb)
                from employees e where e.restaurant = $1 and coalesce(to_jsonb(e)->>'status', 'active') = 'active'
                 and lower(coalesce(to_jsonb(e)->>'position', '')) in ('waiter', 'senior', 'bartender', 'senior_bartender', 'manager', 'runner', 'sommelier')$q$
      into staff using rest;
  exception when others then staff := '[]'::jsonb; end;
  return jsonb_build_object('ok', true, 'day', to_char(ld, 'YYYY-MM-DD'), 'now', now(), 'lead', coalesce((c->>'lead')::boolean, false),
    'plan', pl, 'staff', coalesce(staff, '[]'::jsonb),
    'tables', coalesce((select jsonb_agg(_sa_seat_json(s) order by s.tid) from sa_seat s where s.restaurant = rest and s.day = ld), '[]'::jsonb));
end; $$;

create or replace function seat_set(p_token text, p_tid text, p_status text, p_cnt int, p_name text, p_rtime text, p_waiter text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; pl jsonb; tn text; old sa_seat; r sa_seat; st text; wn text; wid text; chat bigint;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  select plan into pl from sa_floor where restaurant = rest;
  select t->>'n' into tn from jsonb_array_elements(coalesce(pl->'tables', '[]'::jsonb)) t where t->>'id' = p_tid;
  if tn is null then return jsonb_build_object('ok', false, 'error', 'no_table'); end if;
  st := coalesce(p_status, '');
  if st not in ('free', 'res', 'seat', 'clean') or coalesce(p_cnt, 0) not between 0 and 40
     or length(coalesce(p_name, '')) > 60 or coalesce(p_rtime, '') !~ '^(([01]\d|2[0-3]):[0-5]\d)?$' then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  wid := nullif(btrim(coalesce(p_waiter, '')), '');
  if wid is not null then
    begin
      execute 'select btrim(e.name || '' '' || coalesce(e.surname, '''')) from employees e where e.id::text = $1 and e.restaurant = $2 and coalesce(to_jsonb(e)->>''status'', ''active'') = ''active'''
        into wn using wid, rest;
    exception when others then wn := null; end;
    if wn is null then return jsonb_build_object('ok', false, 'error', 'bad_waiter'); end if;
  end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into old from sa_seat where restaurant = rest and day = ld and tid = p_tid;
  insert into sa_seat (restaurant, day, tid, status, cnt, name, rtime, since, waiter_id, waiter_name, updated_by, updated_name, updated_at)
  values (rest, ld, p_tid, st,
    case when st in ('seat', 'res') then coalesce(p_cnt, 0) else 0 end,
    case when st = 'res' then btrim(coalesce(p_name, '')) else '' end,
    case when st = 'res' then coalesce(p_rtime, '') else '' end,
    case when st = 'seat' then case when old.status = 'seat' then old.since else now() end end,
    case when st = 'seat' then wid end, case when st = 'seat' then coalesce(wn, '') else '' end,
    c->>'id', coalesce(c->>'who', ''), now())
  on conflict (restaurant, day, tid) do update set status = excluded.status, cnt = excluded.cnt, name = excluded.name, rtime = excluded.rtime,
    since = excluded.since, waiter_id = excluded.waiter_id, waiter_name = excluded.waiter_name, updated_by = excluded.updated_by,
    updated_name = excluded.updated_name, updated_at = now()
  returning * into r;
  -- официанту — когда ему посадили гостей (новая посадка или стол передали ему); себе — нет
  if st = 'seat' and wid is not null and wid <> c->>'id' and (old.status is distinct from 'seat' or old.waiter_id is distinct from wid) and _sa_tg_ready() then
    chat := _sa_tg_chat(wid, 'seat');
    if chat is not null then
      perform sa_tg_send(chat, 'Стол ' || tn || ': посадили ' || r.cnt || ' ' ||
        case when r.cnt % 10 = 1 and r.cnt % 100 <> 11 then 'гостя' else 'гостей' end || '. Посадил(а): ' || coalesce(nullif(c->>'who', ''), 'хостес') || '.',
        'Рассадка', 'seat');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'table', _sa_seat_json(r));
end; $$;

create or replace function seat_clear(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  delete from sa_seat where restaurant = rest and day = (now() at time zone _sa_tz(rest))::date;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'cleared', n);
end; $$;

-- ── 4) Права ───────────────────────────────────────────────────────────────────
grant execute on function floor_save(text, jsonb) to anon, authenticated;
grant execute on function seat_board(text) to anon, authenticated;
grant execute on function seat_set(text, text, text, int, text, text, text) to anon, authenticated;
grant execute on function seat_clear(text) to anon, authenticated;
revoke all on function _sa_seat_json(sa_seat) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'рассадка: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('floor_save', 'seat_board', 'seat_set', 'seat_clear')) ||
  ' функции из 4 · таблицы: ' || case when to_regclass('public.sa_floor') is not null and to_regclass('public.sa_seat') is not null then 'есть' else 'НЕТ' end ||
  ' · вид «Рассадка» в напоминаниях: ' ||
  case when to_regprocedure('public._sa_notify_kinds()') is null then 'после этапа 32'
       when 'seat' = any(_sa_notify_kinds()) then 'да' else 'нет' end ||
  ' · Telegram: ' || case when _sa_tg_ready() then 'бот на месте' else 'нет (доска работает, без сообщений)' end as result;
