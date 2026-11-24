-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 59 (v193, Доп. 518): меню в ежедневном повторе — «Как команда знает меню», просьбы руководителя и блюда
-- в напоминании до смены.
--
-- Владелец (24.11): «Мы можем сделать так, что бы оно не навязчиво советовало повторить несколько блюд? Может перед
-- сменой, или же во время… меню вживить в ежедневный или же не ежедневный повтор». Из предложенных семи идей —
-- «Давай по классике. Все». Приложение само кладёт блюда в разминку, в перерыв, в «Вопрос дня» и после смены; серверу
-- из этого нужно:
--   • телефон присылает свой «Знаю?» по блюдам (ступень, день повтора, день отметки) и ритм блюд в разминке —
--     menu_know_set(p_token, p_data, p_warm). Пишется только про себя и своё заведение (по токену). В ответ — просьбы
--     руководителя и какие блюда бот назвал в напоминании сегодня (то же, что menu_focus_get);
--   • руководитель (менеджер, старший, владелец) видит «Как команда знает меню»: menu_know_team(p_token, p_restaurant) —
--     по блюдам (сколько знают, сколько не уверены) и по людям; другие заведения — только сеть (старший, владелец);
--   • просьбы руководителя: «В разминку команде» (неделю: блюдо ждёт каждого, пока он не отметит «Знаю») и «В фокус смены»
--     (в брифинг сегодня и завтра) — menu_focus_set(p_token, p_kind, p_id, p_name, p_on, p_note); видят все в
--     заведении — menu_focus_get(p_token);
--   • напоминание за час до смены (этапы 22б, 26, 29: _sa_warmup_due) называет блюда, если у человека сегодня разминка
--     с блюдами: «…и 2 блюда из меню: Креветка темпура, Пончик с крабом.» Порядок — как в приложении
--     (lib/menu-repeat.js warmPlan): спросили, а не знал → просьба руководителя → гоу-лист смены → своя очередь с
--     телефона. Что назвал бот, запоминается: в разминке будут те же блюда.
--   • Таблицы sa_menu_know и sa_menu_focus закрыты: только через эти функции.
--
-- Нужен этап 21 (_sa_caller). Часы заведения — этап 24 (без него — часы сервера); гоу-лист в напоминании — этап 32;
-- стоп-лист — меню команды (этап 4). Само напоминание — этап 22б: без него функции работают, а строки в сообщении нет
-- (запусти этот файл ещё раз после этапа 22б). После повторного запуска этапов 22б, 26 или 29 — тоже ещё раз.
-- Таблицы создаёт, ничего не удаляет. Можно запускать повторно. Supabase → SQL Editor → New query → вставить → Run.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
end $$;

-- ── 1) Таблицы ─────────────────────────────────────────────────────────────────
-- «Знаю?» сотрудника в заведении: одна строка на человека
create table if not exists sa_menu_know (
  restaurant text not null,
  emp_id     text not null,                            -- employees.id
  data       jsonb not null default '{}'::jsonb,       -- { блюдо: [ступень 0–4, день повтора, день отметки] }, дни — с 1970 года
  warm       jsonb,                                    -- ритм и своя очередь: { r, n, last, prev, had, next: [{ id, name, why }] }
  sent       jsonb,                                    -- что бот назвал в напоминании: { day, ids, names }
  updated_at timestamptz not null default now(),
  primary key (restaurant, emp_id)
);
alter table sa_menu_know enable row level security;
revoke all on table sa_menu_know from public, anon, authenticated;

-- просьбы руководителя: warm — в разминку команде, brief — в фокус смены
create table if not exists sa_menu_focus (
  restaurant text not null,
  kind       text not null check (kind in ('warm', 'brief')),
  dish_id    text not null,
  name       text not null default '',
  note       text not null default '',                 -- «не уверены 3 из 5» — как было, когда просили
  from_day   date not null,
  until_day  date not null,
  by_id      text,
  by_name    text,
  created_at timestamptz not null default now(),
  primary key (restaurant, kind, dish_id)
);
alter table sa_menu_focus enable row level security;
revoke all on table sa_menu_focus from public, anon, authenticated;

-- ── 2) Служебное ───────────────────────────────────────────────────────────────
-- сегодня по часам заведения (этап 24: _sa_tz); без него — по часам сервера
create or replace function _sa_mk_today(p_rest text)
returns date language plpgsql stable security definer set search_path to public as $$
declare tz text;
begin
  if to_regprocedure('public._sa_tz(text)') is not null then
    begin execute 'select _sa_tz($1)' into tz using p_rest; exception when others then tz := null; end;
  end if;
  if coalesce(tz, '') = '' then return current_date; end if;
  begin return (now() at time zone tz)::date; exception when others then return current_date; end;
end; $$;
-- номер дня с 1970 года — как localDay на телефоне
create or replace function _sa_mk_dnum(d date)
returns int language sql immutable set search_path to public as $$ select (d - date '1970-01-01')::int $$;

-- «Знаю?» с телефона: до 400 блюд, ключ — до 80 знаков, значение — три целых (ступень 0–4, дни 0–100000)
create or replace function _sa_mk_data(j jsonb)
returns jsonb language plpgsql immutable set search_path to public as $$
declare out_ jsonb := '{}'::jsonb; k text; v jsonb; n int := 0;
begin
  if j is null or jsonb_typeof(j) <> 'object' then return out_; end if;
  for k, v in select key, value from jsonb_each(j) loop
    exit when n >= 400;
    if btrim(k) = '' or length(k) > 80 or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) < 3 then continue; end if;
    if jsonb_typeof(v->0) <> 'number' or jsonb_typeof(v->1) <> 'number' or jsonb_typeof(v->2) <> 'number' then continue; end if;
    out_ := out_ || jsonb_build_object(k, jsonb_build_array(
      greatest(0, least(4, floor((v->>0)::numeric)))::int,
      greatest(0, least(100000, floor((v->>1)::numeric)))::int,
      greatest(0, least(100000, floor((v->>2)::numeric)))::int));
    n := n + 1;
  end loop;
  return out_;
end; $$;

-- ритм и своя очередь: r — each | every2 | week | off, n — 1–3 блюда, last / prev — даты, had — да/нет, next — до 6 блюд
create or replace function _sa_mk_warm(j jsonb)
returns jsonb language plpgsql immutable set search_path to public as $$
declare nx jsonb := '[]'::jsonb; e jsonb; i int := 0; iso constant text := '^\d{4}-\d{2}-\d{2}$';
begin
  if j is null or jsonb_typeof(j) <> 'object' then return null; end if;
  for e in select value from jsonb_array_elements(case when jsonb_typeof(j->'next') = 'array' then j->'next' else '[]'::jsonb end) loop
    exit when i >= 6;
    if jsonb_typeof(e) <> 'object' or btrim(coalesce(e->>'id', '')) = '' or btrim(coalesce(e->>'name', '')) = '' then continue; end if;
    nx := nx || jsonb_build_array(jsonb_build_object('id', left(btrim(e->>'id'), 80),
      'name', left(regexp_replace(btrim(e->>'name'), '\s+', ' ', 'g'), 60),
      'why', case when e->>'why' in ('asked', 'new', 'due', 'fresh') then e->>'why' else 'due' end));
    i := i + 1;
  end loop;
  return jsonb_build_object(
    'r', case when j->>'r' in ('each', 'every2', 'week', 'off') then j->>'r' else 'each' end,
    'n', case when jsonb_typeof(j->'n') = 'number' then greatest(1, least(3, floor((j->>'n')::numeric)))::int else 2 end,
    'last', case when coalesce(j->>'last', '') ~ iso then j->>'last' end,
    'prev', case when coalesce(j->>'prev', '') ~ iso then j->>'prev' end,
    'had', case when jsonb_typeof(j->'had') = 'boolean' then (j->>'had')::boolean else false end,
    'next', nx);
end; $$;

-- просьбы руководителя, что ещё в силе
create or replace function _sa_mk_focus(p_rest text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare d date := _sa_mk_today(p_rest); out_ jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', f.dish_id, 'kind', f.kind, 'name', f.name, 'note', f.note,
           'until', to_char(f.until_day, 'YYYY-MM-DD'), 'day', _sa_mk_dnum(f.from_day), 'by', coalesce(f.by_name, ''))
           order by f.kind desc, f.created_at), '[]'::jsonb)
    into out_ from sa_menu_focus f where f.restaurant = p_rest and f.until_day >= d;
  return out_;
end; $$;

-- ответ телефону: просьбы руководителя и что бот назвал в напоминании сегодня
create or replace function _sa_mk_state(p_rest text, p_emp text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare s jsonb; d text := to_char(_sa_mk_today(p_rest), 'YYYY-MM-DD');
begin
  select k.sent into s from sa_menu_know k where k.restaurant = p_rest and k.emp_id = p_emp;
  return jsonb_build_object('ok', true, 'restaurant', p_rest, 'today', d, 'focus', _sa_mk_focus(p_rest),
    'sent', case when s is not null and s->>'day' = d then s else null end);
end; $$;

-- ── 3) Телефон → сервер ────────────────────────────────────────────────────────
-- p_data — «Знаю?» целиком (null — не менять), p_warm — ритм и своя очередь (null — не менять)
create or replace function menu_know_set(p_token text, p_data jsonb default null, p_warm jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; me text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := coalesce(c->>'restaurant', ''); me := c->>'id';
  if rest = '' then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  insert into sa_menu_know (restaurant, emp_id, data, warm, updated_at)
  values (rest, me, _sa_mk_data(p_data), _sa_mk_warm(p_warm), now())
  on conflict (restaurant, emp_id) do update set
    data = case when p_data is null then sa_menu_know.data else excluded.data end,
    warm = coalesce(excluded.warm, sa_menu_know.warm),
    updated_at = now();
  return _sa_mk_state(rest, me);
end; $$;

create or replace function menu_focus_get(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := coalesce(c->>'restaurant', '');
  if rest = '' then return jsonb_build_object('ok', true, 'restaurant', null, 'focus', '[]'::jsonb, 'sent', null); end if;
  return _sa_mk_state(rest, c->>'id');
end; $$;

-- ── 4) Руководителю: просьба «В разминку команде» / «В фокус смены» ───────────────
-- warm — неделю (сегодня и ещё 7 дней), brief — сегодня и завтра; в каждом виде — до 5 блюд сразу
create or replace function menu_focus_set(p_token text, p_kind text, p_id text, p_name text default '', p_on boolean default true, p_note text default '')
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; id_ text; d date; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := coalesce(c->>'restaurant', '');
  if rest = '' then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_kind is null or p_kind not in ('warm', 'brief') then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  id_ := left(btrim(coalesce(p_id, '')), 80);
  if id_ = '' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  d := _sa_mk_today(rest);
  if coalesce(p_on, true) then
    select count(*) into n from sa_menu_focus where restaurant = rest and kind = p_kind and until_day >= d and dish_id <> id_;
    if n >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many', 'max', 5); end if;
    insert into sa_menu_focus (restaurant, kind, dish_id, name, note, from_day, until_day, by_id, by_name)
    values (rest, p_kind, id_, left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 60), left(regexp_replace(btrim(coalesce(p_note, '')), '\s+', ' ', 'g'), 80),
            d, d + case when p_kind = 'warm' then 7 else 1 end, c->>'id', nullif(btrim(coalesce(c->>'who', '')), ''))
    on conflict (restaurant, kind, dish_id) do update set name = excluded.name, note = excluded.note, from_day = excluded.from_day,
      until_day = excluded.until_day, by_id = excluded.by_id, by_name = excluded.by_name, created_at = now();
  else
    delete from sa_menu_focus where restaurant = rest and kind = p_kind and dish_id = id_;
  end if;
  delete from sa_menu_focus where restaurant = rest and until_day < d - 30;   -- старое не копим
  return _sa_mk_state(rest, c->>'id');
end; $$;

-- ── 5) Руководителю: «Как команда знает меню» ─────────────────────────────────────
-- known — знает (отмечал «Знаю», срок повтора не подошёл), weak — не уверен или ошибся за 30 дней, seen — отмечал хоть раз;
-- n — сколько человек отмечали хоть одно блюдо
create or replace function menu_know_team(p_token text, p_restaurant text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; tn int; people jsonb; dishes jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden', 'restaurant', c->>'restaurant'); end if;
  rest := coalesce(nullif(btrim(coalesce(p_restaurant, '')), ''), c->>'restaurant');
  if rest is distinct from c->>'restaurant' and not coalesce((c->>'network')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'restaurant', c->>'restaurant');
  end if;
  tn := _sa_mk_dnum(_sa_mk_today(rest));
  with staff as (
    select e.id::text emp, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) nm, lower(coalesce(e.position, '')) pos, k.data, k.updated_at at_
      from employees e left join sa_menu_know k on k.restaurant = rest and k.emp_id = e.id::text
     where e.restaurant = rest and coalesce(e.status, 'active') = 'active' and not coalesce(e.is_admin, false)
  ), marks as (
    select s.emp, x.key id, (x.value->>0)::int st, (x.value->>1)::int dd, (x.value->>2)::int td
      from staff s cross join lateral jsonb_each(case when jsonb_typeof(s.data) = 'object' then s.data else '{}'::jsonb end) x
     where jsonb_typeof(x.value) = 'array'
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object('id', s.emp, 'name', s.nm, 'pos', s.pos, 'at', s.at_,
        'known', (select count(*) from marks m where m.emp = s.emp and m.st > 0 and m.dd >= tn),
        'weak', (select count(*) from marks m where m.emp = s.emp and m.st = 0 and m.td > 0 and m.td >= tn - 30),
        'marked', (select count(*) from marks m where m.emp = s.emp and m.td > 0))
        order by (s.at_ is null), s.nm, s.emp), '[]'::jsonb) from staff s),
    (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'known', g.known, 'weak', g.weak, 'seen', g.seen) order by g.id), '[]'::jsonb)
       from (select m.id, count(*) filter (where m.st > 0 and m.dd >= tn) known,
                    count(*) filter (where m.st = 0 and m.td > 0 and m.td >= tn - 30) weak,
                    count(*) filter (where m.td > 0) seen
               from marks m group by m.id) g),
    (select count(*) from staff s where exists (select 1 from marks m where m.emp = s.emp and m.td > 0))::int
    into people, dishes, n;
  return jsonb_build_object('ok', true, 'restaurant', rest, 'n', n, 'staff', jsonb_array_length(people), 'people', people, 'dishes', dishes,
    'focus', case when rest = c->>'restaurant' then _sa_mk_focus(rest) else '[]'::jsonb end);
end; $$;

-- ── 6) Напоминание за час до смены: какие блюда ждут в разминке ─────────────────────
-- Решает ритм с телефона: каждую смену; через смену — если в прошлой разминке блюд не было; раз в неделю — если на этой
-- неделе разминки с блюдами ещё не было; «не нужно» — без блюд (как isDishDay в lib/menu-repeat.js). Копия с телефона
-- старше трёх недель — без блюд. Стоп и архив из меню команды не называем.
create or replace function _sa_menu_warm_pick(p_emp text, p_rest text, p_day date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare k sa_menu_know; w jsonb; r text; n int; ds text; mon text; on_ boolean; had boolean; dn int;
  ids text[] := '{}'; names text[] := '{}'; stops text[] := '{}'; e jsonb; f record; b jsonb; g jsonb; v jsonb; id_ text; nm text;
begin
  select * into k from sa_menu_know m where m.emp_id = p_emp and m.restaurant is not distinct from p_rest;
  if k.emp_id is null or k.warm is null or jsonb_typeof(k.warm) <> 'object' or k.updated_at < now() - interval '21 days' then return null; end if;
  w := k.warm; r := coalesce(w->>'r', 'each'); n := greatest(1, least(3, coalesce((w->>'n')::int, 2)));
  had := coalesce((w->>'had')::boolean, false);
  ds := to_char(p_day, 'YYYY-MM-DD'); mon := to_char(date_trunc('week', p_day)::date, 'YYYY-MM-DD');
  on_ := case r when 'off' then false
    when 'every2' then case when w->>'prev' = ds then had else not (w->>'prev' is not null and w->>'prev' < ds and had) end
    when 'week' then coalesce(w->>'last' = ds, false) or not (w->>'last' is not null and w->>'last' >= mon and w->>'last' < ds)
    else true end;
  if not on_ then return null; end if;
  dn := _sa_mk_dnum(p_day);
  if to_regclass('public.restaurant_menu') is not null then
    select coalesce(array_agg(x->>'id'), '{}') into stops
      from restaurant_menu m, jsonb_array_elements(case when jsonb_typeof(m.dishes) = 'array' then m.dishes else '[]'::jsonb end) x
     where m.restaurant = p_rest and jsonb_typeof(x) = 'object'
       and (coalesce(x->>'archived', '') = 'true' or (x ? 'stop' and x->'stop' not in ('null'::jsonb, 'false'::jsonb, '""'::jsonb, '0'::jsonb)));
  end if;
  -- 1) спросили, а не знал
  for e in select value from jsonb_array_elements(case when jsonb_typeof(w->'next') = 'array' then w->'next' else '[]'::jsonb end) loop
    exit when coalesce(array_length(ids, 1), 0) >= n;
    if e->>'why' = 'asked' and not (e->>'id' = any(ids)) and not (e->>'id' = any(stops)) then ids := ids || (e->>'id'); names := names || (e->>'name'); end if;
  end loop;
  -- 2) просьба руководителя: пока не отметил «Знаю» в день просьбы или позже
  for f in select fo.dish_id, fo.name, fo.from_day from sa_menu_focus fo
            where fo.restaurant is not distinct from p_rest and fo.kind = 'warm' and fo.until_day >= p_day order by fo.created_at loop
    exit when coalesce(array_length(ids, 1), 0) >= n;
    v := k.data->f.dish_id;
    if jsonb_typeof(v) = 'array' and (v->>0)::int > 0 and (v->>2)::int >= _sa_mk_dnum(f.from_day) then continue; end if;
    if f.dish_id = any(ids) or f.dish_id = any(stops) or btrim(coalesce(f.name, '')) = '' then continue; end if;
    ids := ids || f.dish_id; names := names || f.name;
  end loop;
  -- 3) гоу-лист смены (этап 32): пока не отметил «Знаю» сегодня
  if to_regclass('public.sa_briefs') is not null then
    execute 'select data from sa_briefs where restaurant is not distinct from $1 and day = $2' into b using p_rest, p_day;
    if b is not null and coalesce(b->'on'->>'go', '') = 'true' and jsonb_typeof(b->'blocks'->'go') = 'array' then
      for g in select value from jsonb_array_elements(b->'blocks'->'go') loop
        exit when coalesce(array_length(ids, 1), 0) >= n;
        if jsonb_typeof(g) <> 'object' or coalesce(g->>'kind', 'dish') <> 'dish' then continue; end if;
        nm := left(regexp_replace(btrim(coalesce(g->>'name', '')), '\s+', ' ', 'g'), 60);
        id_ := coalesce(nullif(btrim(coalesce(g->>'id', '')), ''), nm);
        if id_ = '' or nm = '' or id_ = any(ids) or id_ = any(stops) then continue; end if;
        v := k.data->id_;
        if jsonb_typeof(v) = 'array' and (v->>0)::int > 0 and (v->>2)::int = dn then continue; end if;
        ids := ids || id_; names := names || nm;
      end loop;
    end if;
  end if;
  -- 4) своя очередь с телефона: новинки, пора повторить, ещё не отмечал
  for e in select value from jsonb_array_elements(case when jsonb_typeof(w->'next') = 'array' then w->'next' else '[]'::jsonb end) loop
    exit when coalesce(array_length(ids, 1), 0) >= n;
    if e->>'why' = 'asked' or e->>'id' = any(ids) or e->>'id' = any(stops) then continue; end if;
    ids := ids || (e->>'id'); names := names || (e->>'name');
  end loop;
  if coalesce(array_length(ids, 1), 0) = 0 then return null; end if;
  return jsonb_build_object('day', ds, 'ids', to_jsonb(ids), 'names', to_jsonb(names));
end; $$;

-- строка разминки в напоминании (как remindLine в lib/menu-repeat.js); ошибка здесь не ломает напоминание
create or replace function _sa_menu_warm_line(p_emp text, p_rest text, p_day date)
returns text language plpgsql stable security definer set search_path to public as $$
declare p jsonb; nm text; cnt int;
begin
  begin p := _sa_menu_warm_pick(p_emp, p_rest, p_day); exception when others then p := null; end;
  if p is null then return 'Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!'; end if;
  select string_agg(x, ', ' order by o), count(*)::int into nm, cnt from jsonb_array_elements_text(p->'names') with ordinality t(x, o);
  return 'Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл, и ' || cnt || ' ' ||
    case when cnt % 10 = 1 and cnt % 100 <> 11 then 'блюдо' when cnt % 10 between 2 and 4 and (cnt % 100 < 10 or cnt % 100 >= 20) then 'блюда' else 'блюд' end ||
    ' из меню: ' || nm || '. Хорошей смены!';
end; $$;

-- после отправки: запомнить, что назвали (первое за день не меняется) — приложение покажет в разминке те же блюда
create or replace function _sa_menu_warm_mark(p_emp text, p_rest text, p_day date)
returns void language plpgsql volatile security definer set search_path to public as $$
declare p jsonb;
begin
  p := _sa_menu_warm_pick(p_emp, p_rest, p_day);
  if p is not null then
    update sa_menu_know set sent = p where emp_id = p_emp and restaurant is not distinct from p_rest
       and (sent is null or sent->>'day' is distinct from p->>'day');
  end if;
exception when others then null;
end; $$;

-- Напоминание (этапы 22б, 26, 29): строка разминки — с блюдами, после отправки — запомнить блюда. Остальное в функции
-- не меняется: окно отправки, «одно напоминание на смену», «Шаг дня», просмотр.
do $do$
declare def text;
  lit constant text := $l$E'\n\nРазминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!'$l$;
  snd constant text := $l$perform sa_tg_send(target.chat_id, txt, 'Разминка', 'warmup');$l$;
begin
  if to_regprocedure('public._sa_warmup_due(boolean)') is null then
    raise notice 'Напоминаний до смены (этап 22б) ещё нет: блюда в них появятся, если запустить этот файл после этапа 22б';
    return;
  end if;
  def := pg_get_functiondef('public._sa_warmup_due(boolean)'::regprocedure);
  if position('_sa_menu_warm_line' in def) > 0 then return; end if;   -- уже с блюдами
  if position(lit in def) = 0 or position(snd in def) = 0 then
    raise notice 'Текст напоминания не тот, что ожидался: блюда в него не добавлены';
    return;
  end if;
  def := replace(def, lit, $r$E'\n\n' || _sa_menu_warm_line(target.emp_id, v.restaurant, ld)$r$);
  def := replace(def, snd, snd || $r$
        perform _sa_menu_warm_mark(target.emp_id, v.restaurant, ld);$r$);
  execute def;
  execute 'revoke all on function _sa_warmup_due(boolean) from public, anon, authenticated';
end $do$;

-- ── 7) Права ───────────────────────────────────────────────────────────────────
revoke all on function _sa_mk_today(text), _sa_mk_dnum(date), _sa_mk_data(jsonb), _sa_mk_warm(jsonb), _sa_mk_focus(text), _sa_mk_state(text, text),
  _sa_menu_warm_pick(text, text, date), _sa_menu_warm_line(text, text, date), _sa_menu_warm_mark(text, text, date) from public, anon, authenticated;
revoke all on function menu_know_set(text, jsonb, jsonb), menu_focus_get(text), menu_focus_set(text, text, text, text, boolean, text),
  menu_know_team(text, text) from public;
grant execute on function menu_know_set(text, jsonb, jsonb), menu_focus_get(text), menu_focus_set(text, text, text, text, boolean, text),
  menu_know_team(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 8) Проверка: ожидаем «меню в повторе: 4 функции из 4 · таблицы: есть · напоминание с блюдами: да · …» ──
select 'меню в повторе: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('menu_know_set', 'menu_focus_get', 'menu_focus_set', 'menu_know_team')) || ' функции из 4' ||
  ' · таблицы: ' || case when to_regclass('public.sa_menu_know') is not null and to_regclass('public.sa_menu_focus') is not null then 'есть' else 'НЕТ' end ||
  ' · напоминание с блюдами: ' || case when to_regprocedure('public._sa_warmup_due(boolean)') is null then 'нет этапа 22б'
       when pg_get_functiondef(to_regprocedure('public._sa_warmup_due(boolean)')) like '%_sa_menu_warm_line%' then 'да' else 'НЕТ' end ||
  ' · прислали «Знаю?»: ' || (select count(*) from sa_menu_know) ||
  ' · просьб руководителя: ' || (select count(*) from sa_menu_focus where until_day >= current_date) as result;
