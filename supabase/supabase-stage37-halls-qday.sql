-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 37 (v88, Доп. 401): залы и стены на схеме зала, «Вопрос дня» в приложении.
--
--   • floor_save(p_token, p_plan) — схема v2: залы (до 6: «Основной», «Веранда»…), в каждом свои столы, стены (линии по
--     сетке), бар (прямоугольник клеток) и вход (клетка). Схему старого вида (v1, без залов) сервер принимает как один
--     зал «Зал». Если у заведения уже есть второй зал или стены, а сохраняет старое приложение — отказ old_app (иначе
--     залы и стены пропали бы). Стол не встаёт на другой стол, бар или вход; стены клеток не занимают;
--   • seat_board — то же, что в этапе 35, плюс признак floor: 2 (приложение включает залы и стены);
--   • qday_today(p_token) — «Вопрос дня» в приложении: сегодняшний вопрос (уже пришёл в Telegram — тот же; нет —
--     следующий из очереди, и бот сегодня другой не пришлёт), серия дней с ответом и свой час;
--     qday_answer(p_token, p_id, p_answer) — ответ из приложения (один раз; в Telegram потом «Ответ уже засчитан»);
--   • свой час «Вопроса дня»: notify_qday_hour_set(p_token, p_hour) — 6…22 или null (как у заведения); бот присылает
--     по нему (_sa_qday_at). Вопрос, открытый в приложении без ответа, бот в этот час пришлёт тот же, а не новый;
--   • qday_push — как в этапе 31, но ответы хранятся год (для серии), а не 60 дней.
--
-- Нужны этапы 21, 22б, 24, 25, 31, 32, 35 и 36. Ничего не удаляет. Можно запускать повторно.
-- Этап 37 заменяет floor_save и seat_board (этап 35), _sa_qday_at и qday_push (этап 31), notify_prefs (этап 32):
-- если перезапускаешь эти этапы — после них снова этап 37.
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
  if to_regclass('public.sa_notify_prefs') is null or to_regprocedure('public._sa_tg_once(text,date,text)') is null then
    raise exception 'Сначала этап 25 (supabase-stage25-live.sql): нужны настройки сообщений sa_notify_prefs и _sa_tg_once';
  end if;
  if to_regclass('public.sa_qday') is null or to_regprocedure('public._sa_qday_hour()') is null then
    raise exception 'Сначала этап 31 (supabase-stage31-qday.sql): нужен «Вопрос дня» — таблица sa_qday';
  end if;
  if to_regprocedure('public._sa_notify_kinds()') is null then
    raise exception 'Сначала этап 32 (supabase-stage32-briefing.sql): нужны виды сообщений _sa_notify_kinds';
  end if;
  if to_regclass('public.sa_floor') is null or to_regclass('public.sa_seat') is null then
    raise exception 'Сначала этап 35 (supabase-stage35-seating.sql): нужна рассадка — таблицы sa_floor и sa_seat';
  end if;
  if to_regprocedure('public.notify_quiet(text)') is null then
    raise exception 'Сначала этап 36 (supabase-stage36-comfort.sql): нужны тихие часы — notify_quiet';
  end if;
end $$;

-- ── 1) Схема зала v2: залы, стены, бар, вход ─────────────────────────────────────
-- Стол: { id, n, seats, shape, x, y, z } — z: зал. Предметы: стена { id, kind: 'wall', x, y, x2, y2, z } — линия по
-- узлам сетки (0…8 по ширине, 0…30 в глубину), только по горизонтали или вертикали; бар { kind: 'bar', x, y, w, h } —
-- клетки; вход { kind: 'door', x, y } — одна клетка.
create or replace function floor_save(p_token text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; n int; ni int; nz int; bad int; plan jsonb; zones jsonb; items jsonb; old jsonb; zids text[]; z1 text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' or jsonb_typeof(p_plan->'tables') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'bad_plan');
  end if;

  -- залы; нет — схема старого вида: один зал. Старое приложение не затирает второй зал и стены
  zones := p_plan->'zones';
  if zones is null or jsonb_typeof(zones) = 'null' then
    select f.plan into old from sa_floor f where f.restaurant = rest;
    if old is not null and (
         (jsonb_typeof(old->'zones') = 'array' and jsonb_array_length(old->'zones') > 1)
      or (jsonb_typeof(old->'items') = 'array' and jsonb_array_length(old->'items') > 0)) then
      return jsonb_build_object('ok', false, 'error', 'old_app');
    end if;
    zones := jsonb_build_array(jsonb_build_object('id', 'z1', 'name', 'Зал'));
  end if;
  if jsonb_typeof(zones) <> 'array' then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  nz := jsonb_array_length(zones);
  if nz < 1 or nz > 6 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  select count(*) into bad from jsonb_array_elements(zones) z
   where jsonb_typeof(z) <> 'object' or coalesce(z->>'id', '') !~ '^z[0-9a-z]{1,8}$'
      or length(btrim(coalesce(z->>'name', ''))) not between 1 and 24;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  if (select count(distinct z->>'id') from jsonb_array_elements(zones) z) <> nz
     or (select count(distinct lower(btrim(z->>'name'))) from jsonb_array_elements(zones) z) <> nz then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;
  select array_agg(z->>'id' order by i) into zids from jsonb_array_elements(zones) with ordinality as q(z, i);
  z1 := zids[1];

  -- столы (как в этапе 35) и зал стола; стол без зала — в первом зале
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
      or (case when coalesce(t->>'y', '') ~ '^\d{1,2}$' then (t->>'y')::int else 99 end) > 29
      or not (coalesce(t->>'z', z1) = any (zids));
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  if (select count(distinct t->>'id') from jsonb_array_elements(p_plan->'tables') t) <> n
     or (select count(distinct lower(btrim(t->>'n'))) from jsonb_array_elements(p_plan->'tables') t) <> n then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  -- стены, бар, вход
  items := coalesce(p_plan->'items', '[]'::jsonb);
  if jsonb_typeof(items) <> 'array' then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  ni := jsonb_array_length(items);
  if ni > 60 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  select count(*) into bad from jsonb_array_elements(items) it
   where jsonb_typeof(it) <> 'object'
      or coalesce(it->>'id', '') !~ '^i[0-9a-z]{1,12}$'
      or coalesce(it->>'kind', '') not in ('wall', 'bar', 'door')
      or not (coalesce(it->>'z', z1) = any (zids))
      or coalesce(it->>'x', '') !~ '^\d{1,2}$' or coalesce(it->>'y', '') !~ '^\d{1,2}$'
      or case it->>'kind'
           when 'wall' then coalesce(it->>'x2', '') !~ '^\d{1,2}$' or coalesce(it->>'y2', '') !~ '^\d{1,2}$'
           when 'bar' then coalesce(it->>'w', '') !~ '^\d{1,2}$' or coalesce(it->>'h', '') !~ '^\d{1,2}$'
           else false end;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  -- числа уже проверены — границы
  select count(*) into bad from jsonb_array_elements(items) it
   where case it->>'kind'
           when 'wall' then (it->>'x')::int > 8 or (it->>'x2')::int > 8 or (it->>'y')::int > 30 or (it->>'y2')::int > 30
                         or ((it->>'x')::int <> (it->>'x2')::int and (it->>'y')::int <> (it->>'y2')::int)
                         or ((it->>'x')::int = (it->>'x2')::int and (it->>'y')::int = (it->>'y2')::int)
           when 'bar' then (it->>'w')::int < 1 or (it->>'h')::int < 1 or (it->>'x')::int + (it->>'w')::int > 8 or (it->>'y')::int + (it->>'h')::int > 30
           else (it->>'x')::int > 7 or (it->>'y')::int > 29 end;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  if (select count(distinct it->>'id') from jsonb_array_elements(items) it) <> ni then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  -- стол не встаёт на стол, бар или вход того же зала (стены клеток не занимают)
  with cells as (
    select coalesce(t->>'z', z1) as z, (t->>'x')::int + g.dx as cx, (t->>'y')::int as cy, 't' as src
      from jsonb_array_elements(p_plan->'tables') t, lateral generate_series(0, case when t->>'shape' = 'long' then 1 else 0 end) as g(dx)
    union all
    select coalesce(it->>'z', z1), (it->>'x')::int + gx, (it->>'y')::int + gy, 'i'
      from jsonb_array_elements(items) it,
           lateral generate_series(0, case when it->>'kind' = 'bar' then (it->>'w')::int - 1 else 0 end) as gx,
           lateral generate_series(0, case when it->>'kind' = 'bar' then (it->>'h')::int - 1 else 0 end) as gy
     where it->>'kind' in ('bar', 'door')
  )
  select count(*) into bad from (select 1 from cells group by z, cx, cy having count(*) filter (where src = 't') >= 1 and count(*) > 1) d;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'overlap'); end if;

  plan := jsonb_build_object('v', 2,
    'zones', (select jsonb_agg(jsonb_build_object('id', z->>'id', 'name', btrim(z->>'name')) order by i) from jsonb_array_elements(zones) with ordinality as q(z, i)),
    'tables', coalesce((select jsonb_agg(jsonb_build_object('id', t->>'id', 'n', btrim(t->>'n'), 'seats', (t->>'seats')::int,
            'shape', t->>'shape', 'x', (t->>'x')::int, 'y', (t->>'y')::int, 'z', coalesce(t->>'z', z1)) order by i)
          from jsonb_array_elements(p_plan->'tables') with ordinality as q(t, i)), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(case it->>'kind'
            when 'wall' then jsonb_build_object('id', it->>'id', 'kind', 'wall', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'x2', (it->>'x2')::int, 'y2', (it->>'y2')::int, 'z', coalesce(it->>'z', z1))
            when 'bar' then jsonb_build_object('id', it->>'id', 'kind', 'bar', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'w', (it->>'w')::int, 'h', (it->>'h')::int, 'z', coalesce(it->>'z', z1))
            else jsonb_build_object('id', it->>'id', 'kind', 'door', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'z', coalesce(it->>'z', z1)) end order by i)
          from jsonb_array_elements(items) with ordinality as q(it, i)), '[]'::jsonb));
  insert into sa_floor (restaurant, plan, updated_by) values (rest, plan, c->>'id')
  on conflict (restaurant) do update set plan = excluded.plan, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true, 'v', 2, 'tables', n, 'items', ni, 'zones', nz);
end; $$;

-- как в этапе 35, плюс floor: 2 — сервер знает залы и стены
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
  return jsonb_build_object('ok', true, 'floor', 2, 'day', to_char(ld, 'YYYY-MM-DD'), 'now', now(), 'lead', coalesce((c->>'lead')::boolean, false),
    'plan', pl, 'staff', coalesce(staff, '[]'::jsonb),
    'tables', coalesce((select jsonb_agg(_sa_seat_json(s) order by s.tid) from sa_seat s where s.restaurant = rest and s.day = ld), '[]'::jsonb));
end; $$;

-- ── 2) «Вопрос дня»: свой час, приложение, серия ────────────────────────────────
alter table sa_notify_prefs add column if not exists qday_hour smallint;   -- свой час (6–22), null — как у заведения
alter table sa_qday add column if not exists via text;                     -- app — показан в приложении, tg — пришёл в Telegram

create or replace function _sa_qday_hour_of(p_emp text)
returns int language plpgsql stable security definer set search_path to public as $$
declare h int;
begin
  select qday_hour into h from sa_notify_prefs where emp_id = p_emp;
  if h is null or h < 6 or h > 22 then h := _sa_qday_hour(); end if;
  return h;
end; $$;

-- серия: сколько дней подряд был ответ (сегодня ответа ещё нет — серия до вчера не прервана)
create or replace function _sa_qday_streak(p_emp text, p_day date)
returns int language plpgsql stable security definer set search_path to public as $$
declare d date; n int := 0;
begin
  d := p_day;
  if not exists (select 1 from sa_qday where emp_id = p_emp and sent_day = d and answered_at is not null) then d := d - 1; end if;
  while n < 400 and exists (select 1 from sa_qday where emp_id = p_emp and sent_day = d and answered_at is not null) loop
    n := n + 1; d := d - 1;
  end loop;
  return n;
end; $$;

-- вопрос для приложения: верный ответ и разбор — только после ответа
create or replace function _sa_qday_json(x sa_qday)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', x.id, 'q', x.item->>'q', 'o', x.item->'o', 't', coalesce(x.item->>'t', ''), 'r', coalesce(x.item->>'r', ''),
    'day', x.sent_day, 'via', coalesce(x.via, 'tg'), 'answer', x.answer, 'correct', x.correct, 'at', x.answered_at)
    || case when x.answered_at is not null then jsonb_build_object('c', (x.item->>'c')::int, 'e', coalesce(x.item->>'e', '')) else '{}'::jsonb end
$$;

create or replace function qday_today(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; v_emp text; ld date; x sa_qday;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_emp := c->>'id';
  ld := (now() at time zone _sa_tz(c->>'restaurant'))::date;
  select * into x from sa_qday where emp_id = v_emp and sent_day = ld order by id desc limit 1;
  if x.id is null then
    select * into x from sa_qday where emp_id = v_emp and sent_day is null order by ord, id limit 1;
    if x.id is not null then
      update sa_qday set sent_day = ld, sent_at = now(), via = 'app' where id = x.id returning * into x;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'day', to_char(ld, 'YYYY-MM-DD'), 'hour', _sa_qday_hour_of(v_emp), 'streak', _sa_qday_streak(v_emp, ld),
    'queued', (select count(*) from sa_qday where emp_id = v_emp and sent_day is null),
    'item', case when x.id is null then null else _sa_qday_json(x) end);
end; $$;

create or replace function qday_answer(p_token text, p_id bigint, p_answer int)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; v_emp text; ld date; x sa_qday;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_emp := c->>'id';
  ld := (now() at time zone _sa_tz(c->>'restaurant'))::date;
  select * into x from sa_qday where id = p_id and emp_id = v_emp;
  if x.id is null or x.sent_day is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_answer is null or p_answer < 0 or p_answer >= jsonb_array_length(x.item->'o') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  update sa_qday set answer = p_answer, correct = (p_answer = (item->>'c')::int), answered_at = now()
   where id = x.id and answered_at is null
  returning * into x;
  if not found then
    select * into x from sa_qday where id = p_id;
    return jsonb_build_object('ok', false, 'error', 'again', 'item', _sa_qday_json(x), 'streak', _sa_qday_streak(v_emp, ld));
  end if;
  return jsonb_build_object('ok', true, 'item', _sa_qday_json(x), 'streak', _sa_qday_streak(v_emp, ld));
end; $$;

-- p_hour: 6…22 — свой час, null — как у заведения
create or replace function notify_qday_hour_set(p_token text, p_hour int)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_hour is not null and (p_hour < 6 or p_hour > 22) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  insert into sa_notify_prefs (emp_id, qday_hour) values (c->>'id', p_hour)
  on conflict (emp_id) do update set qday_hour = excluded.qday_hour, updated_at = now();
  return notify_prefs(p_token);
end; $$;

-- как в этапе 32, плюс свой час «Вопроса дня»: qday_hour — по которому придёт, qday_hour_mine — свой (null — как у
-- заведения), qday_hour_default — час заведения
create or replace function notify_prefs(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; pj jsonb; linked boolean := false; on_ boolean := false; out jsonb; k text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select to_jsonb(p) into pj from sa_notify_prefs p where p.emp_id = c->>'id';
  if to_regclass('public.tg_links') is not null then
    execute 'select true, remind from tg_links where emp_id = $1' into linked, on_ using c->>'id';
  end if;
  out := jsonb_build_object('ok', true, 'bot', _sa_tg_ready(), 'linked', coalesce(linked, false), 'remind', coalesce(on_, false));
  foreach k in array _sa_notify_kinds() loop
    out := out || jsonb_build_object(k, coalesce((pj->>k)::boolean, true));
  end loop;
  return out || jsonb_build_object('qday_hour', _sa_qday_hour_of(c->>'id'), 'qday_hour_default', _sa_qday_hour(),
    'qday_hour_mine', case when pj->>'qday_hour' ~ '^\d{1,2}$' and (pj->>'qday_hour')::int between 6 and 22 then (pj->>'qday_hour')::int end);
end; $$;

-- как в этапе 31: свой час у каждого; вопрос, открытый сегодня в приложении без ответа, приходит тот же; с ответом —
-- сегодня ничего
create or replace function _sa_qday_at(p_send boolean, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path to public as $$
declare out jsonb := '[]'::jsonb; l record; tz text; lnow timestamp; hh int; chat bigint; nx sa_qday; td sa_qday;
begin
  if not _sa_tg_ready() then return out; end if;
  for l in select t.emp_id, t.restaurant from tg_links t where t.remind order by t.emp_id loop
    tz := _sa_tz(l.restaurant);
    lnow := p_now at time zone tz;
    hh := _sa_qday_hour_of(l.emp_id);
    if extract(hour from lnow)::int <> hh or extract(minute from lnow)::int >= 10 then continue; end if;   -- окно — шаг расписания
    chat := _sa_tg_chat(l.emp_id, 'qday');
    if chat is null then continue; end if;
    if _sa_tg_was(l.emp_id, lnow::date, 'qday') then continue; end if;
    td := null;
    select * into td from sa_qday where emp_id = l.emp_id and sent_day = lnow::date order by id desc limit 1;
    if td.id is not null then
      if td.answered_at is not null or td.chat_id is not null then continue; end if;
      nx := td;
    else
      nx := null;
      select * into nx from sa_qday where emp_id = l.emp_id and sent_day is null order by ord, id limit 1;
      if nx.id is null then continue; end if;   -- очереди нет: приложение ещё не открывали в новой версии
    end if;
    out := out || jsonb_build_object('emp', l.emp_id, 'id', nx.id, 'q', nx.item->>'q', 'chat', chat, 'hour', hh, 'same', td.id is not null);
    if p_send then
      if not _sa_tg_once(l.emp_id, lnow::date, 'qday') then continue; end if;
      update sa_qday set sent_day = lnow::date, sent_at = coalesce(sent_at, p_now), chat_id = chat, via = coalesce(via, 'tg') where id = nx.id;
      perform sa_tg_api('sendMessage', jsonb_build_object('chat_id', chat, 'text', left(_sa_qday_text(nx.item), 4000),
        'reply_markup', _sa_qday_kb(nx.id, jsonb_array_length(nx.item->'o')), 'disable_web_page_preview', true));
    end if;
  end loop;
  return out;
end; $$;

-- как в этапе 31, но отвеченные хранятся год (серия), неотвеченные и неотправленные — как раньше
create or replace function qday_push(p_token text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; it jsonb; v_k text; v_q text; v_o jsonb; v_c int; v_ok boolean; i int; n int := 0; v_emp text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  v_emp := c->>'id';
  delete from sa_qday where emp_id = v_emp and sent_day is null;
  delete from sa_qday where emp_id = v_emp and sent_day < current_date - 60 and answered_at is null;
  delete from sa_qday where emp_id = v_emp and sent_day < current_date - 400;
  for it in select value from jsonb_array_elements(p_items) loop
    exit when n >= 7;
    if jsonb_typeof(it) <> 'object' then continue; end if;
    v_k := left(btrim(coalesce(it->>'k', '')), 80);
    v_q := left(btrim(coalesce(it->>'q', '')), 400);
    v_o := it->'o';
    if v_k = '' or v_q = '' or v_o is null or jsonb_typeof(v_o) <> 'array' or jsonb_array_length(v_o) not between 2 and 4 then continue; end if;
    v_ok := true;
    for i in 0 .. jsonb_array_length(v_o) - 1 loop
      if jsonb_typeof(v_o->i) <> 'string' or btrim(v_o->>i) = '' or length(v_o->>i) > 200 then v_ok := false; end if;
    end loop;
    v_c := case when coalesce(it->>'c', '') ~ '^\d$' then (it->>'c')::int else -1 end;
    if not v_ok or v_c < 0 or v_c >= jsonb_array_length(v_o) then continue; end if;
    if exists (select 1 from sa_qday x where x.emp_id = v_emp and x.k = v_k and (x.sent_day is null or x.sent_day > current_date - 14)) then continue; end if;
    insert into sa_qday (emp_id, restaurant, k, item, ord)
    values (v_emp, c->>'restaurant', v_k, jsonb_build_object('q', v_q, 'o', v_o, 'c', v_c,
      'e', left(btrim(coalesce(it->>'e', '')), 500), 't', left(btrim(coalesce(it->>'t', '')), 120), 'r', left(btrim(coalesce(it->>'r', '')), 40)), n);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'queued', n, 'hour', _sa_qday_hour_of(v_emp));
end; $$;

-- ── 3) Права ───────────────────────────────────────────────────────────────────
grant execute on function floor_save(text, jsonb) to anon, authenticated;
grant execute on function seat_board(text) to anon, authenticated;
grant execute on function qday_today(text) to anon, authenticated;
grant execute on function qday_answer(text, bigint, int) to anon, authenticated;
grant execute on function notify_qday_hour_set(text, int) to anon, authenticated;
grant execute on function notify_prefs(text) to anon, authenticated;
grant execute on function qday_push(text, jsonb) to anon, authenticated;
revoke all on function _sa_qday_hour_of(text) from public, anon, authenticated;
revoke all on function _sa_qday_streak(text, date) from public, anon, authenticated;
revoke all on function _sa_qday_json(sa_qday) from public, anon, authenticated;
revoke all on function _sa_qday_at(boolean, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'залы и вопрос дня: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('qday_today', 'qday_answer', 'notify_qday_hour_set', '_sa_qday_hour_of', '_sa_qday_streak')) ||
  ' функций из 5 · схема: ' || case when pg_get_functiondef('public.floor_save(text,jsonb)'::regprocedure) like '%''zones''%' then 'залы и стены' else 'НЕТ' end ||
  ' · свой час вопроса: ' || case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sa_notify_prefs' and column_name = 'qday_hour') then 'да' else 'нет' end ||
  ' · час заведения: ' || _sa_qday_hour() || ':00' as result;
