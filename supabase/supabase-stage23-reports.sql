-- ════════════════════════════════════════════════════════════════════════════
-- Этап 23 — отчёт по сотруднику для руководителя (v29). Excel по команде, PDF-карточка.
--
-- Что появляется:
--   • emp_learning — копия того, что раньше жило только в телефоне сотрудника:
--     «Работа над ошибками» (вопрос, верный ответ, на каком повторе), экзамены, дни
--     занятий и цель дня, разминки, серия, навыки, подтверждённые наставником по PIN,
--     пройденный «Гость недели». Приложение присылает её само — sa_learning_push,
--     не чаще раза в пару минут и только когда что-то изменилось.
--   • report_people(p_token)            список сотрудников для отчёта: прогресс, ошибки,
--                                       когда занимался (без тяжёлых подробностей)
--   • report_person(p_token, p_emp)     всё по одному сотруднику: пройденное, тесты, ответы
--                                       с ошибками (что выбрал и что верно), практика, навыки,
--                                       копия с телефона
--   • report_team(p_token)              всё по всем, кого видишь, одним ответом — для Excel
--   • report_ticket / report_take       скачивание файла в Telegram: приложение собирает отчёт,
--                                       кладёт его под билет (3 минуты, одно скачивание),
--                                       /api/report на Vercel меняет билет на файл. Как резервная
--                                       копия в этапе 10: в ссылке нет ни токена, ни ключей.
--
-- Кто кого видит — как в «Аналитике» (этап 15): менеджер — сотрудников своего ресторана
-- (ниже себя по должности), старший (senior) — всех ниже себя во всех ресторанах, владелец —
-- всех. Себя — каждый (своя PDF-карточка). Уволенные (status ≠ active) в отчёт не попадают.
--
-- Нужен этап 21 (_sa_caller). Повторный запуск безопасен. Приложение работает и без этого
-- этапа: экран «Отчёты» честно скажет, что сервер не обновлён.
-- ════════════════════════════════════════════════════════════════════════════

do $$ begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала выполни этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
end $$;

-- Лестница видимости — та же, что в этапе 15 (если этап 15 не применён — появится здесь).
create or replace function sa_rank(p_pos text, p_admin boolean) returns int
language sql immutable as $$
  select case when coalesce(p_admin, false) then 3
              when p_pos = 'senior' then 2
              when p_pos = 'manager' then 1
              else 0 end
$$;

-- ── 1) Копия «телефонных» данных ─────────────────────────────────────────────
create table if not exists emp_learning (
  emp_id      text primary key,               -- employees.id
  emp_name    text,                           -- «Имя Фамилия» на момент записи
  restaurant  text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create index if not exists emp_learning_rest on emp_learning (restaurant);
alter table emp_learning enable row level security;      -- политик нет: напрямую не читается
revoke all on table emp_learning from anon, authenticated;

-- Телефон присылает копию. Личность — только из токена.
create or replace function sa_learning_push(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad');
  end if;
  n := octet_length(p_data::text);
  if n > 400000 then return jsonb_build_object('ok', false, 'error', 'too_big', 'size', n); end if;
  insert into emp_learning (emp_id, emp_name, restaurant, data, updated_at)
  values (c->>'id', c->>'who', c->>'restaurant', p_data, now())
  on conflict (emp_id) do update
    set emp_name = excluded.emp_name, restaurant = excluded.restaurant, data = excluded.data, updated_at = now();
  return jsonb_build_object('ok', true, 'at', now());
end; $$;

-- ── 2) Кто кого видит ────────────────────────────────────────────────────────
create or replace function _sa_report_rank(c jsonb) returns int
language sql immutable as $$
  select case when c is null then -1 else sa_rank(c->>'position', coalesce((c->>'admin')::boolean, false)) end
$$;

create or replace function _sa_report_can(c jsonb, p_id text, p_rest text, p_pos text, p_admin boolean)
returns boolean language sql immutable as $$
  select c is not null and (
       p_id = c->>'id'
    or _sa_report_rank(c) = 3
    or (_sa_report_rank(c) = 2 and sa_rank(lower(coalesce(p_pos, '')), coalesce(p_admin, false)) < 2)
    or (_sa_report_rank(c) = 1 and p_rest is not distinct from c->>'restaurant'
        and sa_rank(lower(coalesce(p_pos, '')), coalesce(p_admin, false)) < 1))
$$;

-- ── 3) Служебные чтения: таблицы прогресса заведены до репозитория, поэтому —
--       осторожно: нет таблицы или поля — пустой ответ, а не ошибка ────────────
create or replace function _sa_rep_list(p_table text, p_col text, p_uid text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare res jsonb := '[]'::jsonb;
begin
  if to_regclass('public.' || p_table) is null then return res; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'user_id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = p_col) then
    return res;
  end if;
  begin
    execute format('select coalesce(jsonb_agg(distinct %1$I::text), ''[]''::jsonb) from %2$I where user_id::text = $1 and %1$I is not null', p_col, p_table)
      into res using p_uid;
  exception when others then res := '[]'::jsonb; end;
  return coalesce(res, '[]'::jsonb);
end; $$;

create or replace function _sa_rep_count(p_table text, p_col text, p_uid text)
returns int language plpgsql security definer set search_path to public as $$
declare n int := 0;
begin
  if to_regclass('public.' || p_table) is null then return 0; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'user_id')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = p_col) then
    return 0;
  end if;
  begin
    execute format('select count(distinct %1$I) from %2$I where user_id::text = $1', p_col, p_table) into n using p_uid;
  exception when others then n := 0; end;
  return coalesce(n, 0);
end; $$;

-- Всё по одному сотруднику (без проверки прав — её делают вызывающие функции)
create or replace function _sa_report_person(p_id text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare e record; who text; res jsonb; x jsonb; ts0 timestamptz := now() - interval '180 days';
  lr text; seen timestamptz; l_at timestamptz; linked boolean := false;
begin
  select em.id::text as id, em.name, coalesce(em.surname, '') as surname, em.restaurant,
         lower(coalesce(em.position, '')) as position, coalesce(em.is_admin, false) as is_admin,
         coalesce(em.status, 'active') as status
    into e from employees em where em.id::text = p_id limit 1;
  if not found then return null; end if;
  who := btrim(coalesce(e.name, '') || ' ' || e.surname);

  res := jsonb_build_object('person', jsonb_build_object('id', e.id, 'name', e.name, 'surname', e.surname,
           'restaurant', e.restaurant, 'position', e.position, 'is_admin', e.is_admin, 'status', e.status));
  res := res || jsonb_build_object(
    'lessons', _sa_rep_list('progress', 'lesson_id', e.id),
    'quiz',    _sa_rep_list('quiz_done', 'quiz_id', e.id),
    'roles',   _sa_rep_list('completed_roles', 'role', e.id));

  -- звёзды практики: лучший результат по каждой практике
  x := '{}'::jsonb;
  if to_regclass('public.practice_stars') is not null then
    begin
      execute 'select coalesce(jsonb_object_agg(lesson_id, mx), ''{}''::jsonb) from (
                 select lesson_id::text as lesson_id, max(stars) as mx from practice_stars
                  where user_id::text = $1 and lesson_id is not null group by lesson_id::text) t'
        into x using e.id;
    exception when others then x := '{}'::jsonb; end;
  end if;
  res := res || jsonb_build_object('stars', coalesce(x, '{}'::jsonb));

  -- последняя открытая роль
  lr := null;
  if to_regclass('public.profiles') is not null then
    begin
      execute 'select last_role from profiles where user_id::text = $1 and last_role is not null limit 1' into lr using e.id;
    exception when others then lr := null; end;
  end if;
  res := res || jsonb_build_object('last_role', lr);

  -- результаты тестов: строки как есть (поля в разных базах называются по-разному)
  begin
    x := _sa_person_rows('scores', e.id, e.name, e.surname, who, e.restaurant);
  exception when others then x := '[]'::jsonb; end;
  res := res || jsonb_build_object('scores', coalesce(x, '[]'::jsonb));

  -- ответы в тестах за 180 дней: что выбрал и что было верно (этапы 7 и 15)
  x := '[]'::jsonb; seen := null;
  if to_regclass('public.quiz_events') is not null then
    begin
      execute 'select coalesce(jsonb_agg(to_jsonb(q) - ''employee'' - ''restaurant'' - ''id'' order by q.ts desc), ''[]''::jsonb), max(q.ts)
                 from (select * from quiz_events where employee = $1 and (restaurant is null or restaurant is not distinct from $2)
                         and ts > $3 order by ts desc limit 3000) q'
        into x, seen using who, e.restaurant, ts0;
    exception when others then x := '[]'::jsonb; seen := null; end;
  end if;
  res := res || jsonb_build_object('events', coalesce(x, '[]'::jsonb));

  -- вышел из теста, не закончив (этап 15)
  x := '[]'::jsonb;
  if to_regclass('public.quiz_skips') is not null then
    begin
      execute 'select coalesce(jsonb_agg(to_jsonb(s) - ''employee'' - ''restaurant'' - ''id'' order by s.ts desc), ''[]''::jsonb)
                 from (select * from quiz_skips where employee = $1 and (restaurant is null or restaurant is not distinct from $2)
                         and ts > $3 order by ts desc limit 300) s'
        into x using who, e.restaurant, ts0;
    exception when others then x := '[]'::jsonb; end;
  end if;
  res := res || jsonb_build_object('skips', coalesce(x, '[]'::jsonb));

  -- навыки: запросы на подтверждение в зале (этап 22)
  x := '[]'::jsonb;
  if to_regclass('public.skill_requests') is not null then
    select coalesce(jsonb_agg(jsonb_build_object('role_id', r.role_id, 'skill_id', r.skill_id, 'skill_label', r.skill_label,
             'status', r.status, 'note', r.note, 'mentor_name', r.mentor_name, 'created_at', r.created_at, 'decided_at', r.decided_at)
             order by r.created_at desc), '[]'::jsonb)
      into x from skill_requests r where r.emp_id = e.id and r.status <> 'cancelled';
  end if;
  res := res || jsonb_build_object('skills', coalesce(x, '[]'::jsonb));

  -- новинки меню (этап 4)
  x := '[]'::jsonb;
  if to_regclass('public.menu_progress') is not null then
    begin
      execute 'select coalesce(jsonb_agg(to_jsonb(m) - ''employee'' - ''restaurant'' order by m.ts desc), ''[]''::jsonb)
                 from (select * from menu_progress where employee = $1 and (restaurant is null or restaurant is not distinct from $2) order by ts desc limit 60) m'
        into x using who, e.restaurant;
    exception when others then x := '[]'::jsonb; end;
  end if;
  res := res || jsonb_build_object('menu', coalesce(x, '[]'::jsonb));

  -- копия с телефона
  select l.data, l.updated_at into x, l_at from emp_learning l where l.emp_id = e.id;
  res := res || jsonb_build_object('learning', coalesce(x, '{}'::jsonb), 'learning_at', l_at);

  -- напоминания в Telegram включены? (этап 22б) — без номера чата
  if to_regclass('public.tg_links') is not null then
    begin
      execute 'select exists (select 1 from tg_links where emp_id = $1)' into linked using e.id;
    exception when others then linked := false; end;
  end if;
  res := res || jsonb_build_object('tg', coalesce(linked, false));

  res := res || jsonb_build_object('seen', greatest(seen, l_at));
  return res;
end; $$;

-- Список для экрана: лёгкие цифры по каждому, кого видно
create or replace function _sa_report_people(c jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare r record; rows jsonb := '[]'::jsonb; who text; ev_n int; ev_seen timestamptz; l record; lr text;
  has_prof boolean := to_regclass('public.profiles') is not null;
  d14 text := to_char((now() at time zone 'Asia/Kamchatka')::date - 13, 'YYYY-MM-DD');
  now_ms double precision := extract(epoch from now()) * 1000;
begin
  for r in
    select em.id::text as id, em.name, coalesce(em.surname, '') as surname, em.restaurant,
           lower(coalesce(em.position, '')) as position, coalesce(em.is_admin, false) as is_admin
      from employees em
     where coalesce(em.status, 'active') = 'active'
       and _sa_report_can(c, em.id::text, em.restaurant, lower(coalesce(em.position, '')), coalesce(em.is_admin, false))
     order by em.restaurant nulls last, em.name, em.surname
     limit 500
  loop
    who := btrim(coalesce(r.name, '') || ' ' || r.surname);
    ev_n := 0; ev_seen := null;
    if to_regclass('public.quiz_events') is not null then
      begin
        execute 'select count(*) filter (where not correct and ts > now() - interval ''30 days''), max(ts)
                   from quiz_events where employee = $1 and (restaurant is null or restaurant is not distinct from $2)'
          into ev_n, ev_seen using who, r.restaurant;
      exception when others then ev_n := 0; ev_seen := null; end;
    end if;
    lr := null;
    if has_prof then
      begin
        execute 'select last_role from profiles where user_id::text = $1 and last_role is not null limit 1' into lr using r.id;
      exception when others then lr := null; end;
    end if;
    select el.updated_at as at,
           coalesce(jsonb_array_length(case when jsonb_typeof(el.data->'mistakes') = 'array' then el.data->'mistakes' end), 0) as mist,
           (select count(*) from jsonb_array_elements(case when jsonb_typeof(el.data->'mistakes') = 'array' then el.data->'mistakes' else '[]'::jsonb end) m
             where case when (m->>'due') ~ '^[0-9]{1,15}(\.[0-9]+)?$' then (m->>'due')::double precision else 0 end <= now_ms) as due,
           -- дни в деле за 14 дней: по настоящим датам, а не по ключам журнала (поддельный
           -- «2026-10-45» не станет лишним днём)
           (select count(*) from generate_series(d14::date, d14::date + 13, interval '1 day') g
             where (case when (el.data->'activity'->to_char(g, 'YYYY-MM-DD')->>'st') ~ '^[0-9]{1,6}$' then (el.data->'activity'->to_char(g, 'YYYY-MM-DD')->>'st')::int else 0 end)
                 + (case when (el.data->'activity'->to_char(g, 'YYYY-MM-DD')->>'f') ~ '^[0-9]{1,6}$' then (el.data->'activity'->to_char(g, 'YYYY-MM-DD')->>'f')::int else 0 end) > 0) as days14
      into l from emp_learning el where el.emp_id = r.id;
    rows := rows || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'name', r.name, 'surname', r.surname, 'restaurant', r.restaurant, 'position', r.position,
      'self', r.id = c->>'id', 'last_role', lr,
      'lessons', _sa_rep_count('progress', 'lesson_id', r.id),
      'quiz', _sa_rep_count('quiz_done', 'quiz_id', r.id),
      'wrong30', coalesce(ev_n, 0),
      'learning_at', l.at,
      'mistakes', coalesce(l.mist, 0), 'due', coalesce(l.due, 0), 'days14', coalesce(l.days14, 0),
      'seen', greatest(ev_seen, l.at)));
  end loop;
  return rows;
end; $$;

create or replace function _sa_report_scope(c jsonb) returns text
language sql immutable as $$
  select case _sa_report_rank(c) when 3 then 'all' when 2 then 'network' when 1 then 'restaurant' else 'self' end
$$;

-- ── 4) То, что зовёт приложение ──────────────────────────────────────────────
create or replace function report_people(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return jsonb_build_object('ok', true, 'scope', _sa_report_scope(c), 'restaurant', c->>'restaurant',
                            'rows', _sa_report_people(c));
end; $$;

create or replace function report_person(p_token text, p_emp text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; e record; d jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select em.id::text as id, em.restaurant, lower(coalesce(em.position, '')) as position, coalesce(em.is_admin, false) as is_admin,
         coalesce(em.status, 'active') as status
    into e from employees em where em.id::text = coalesce(nullif(btrim(p_emp), ''), c->>'id') limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not _sa_report_can(c, e.id, e.restaurant, e.position, e.is_admin) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  d := _sa_report_person(e.id);
  return jsonb_build_object('ok', true, 'data', d);
end; $$;

create or replace function report_team(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; r jsonb; people jsonb := '[]'::jsonb; n int := 0;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if _sa_report_rank(c) < 1 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  for r in select jsonb_array_elements(_sa_report_people(c)) loop
    n := n + 1;
    exit when n > 300;
    people := people || jsonb_build_array(_sa_report_person(r->>'id'));
  end loop;
  return jsonb_build_object('ok', true, 'scope', _sa_report_scope(c), 'restaurant', c->>'restaurant', 'people', people,
                            'cut', n > 300);
end; $$;

-- ── 5) Файл в Telegram: билет на готовый отчёт ───────────────────────────────
-- Приложение уже собрало отчёт из данных выше (их права проверены там) и кладёт его
-- под билет; /api/report отдаёт файл по билету один раз в течение 3 минут.
create table if not exists report_tickets (
  ticket      text primary key,
  emp_id      text,
  kind        text not null,
  payload     jsonb not null,
  expires_at  timestamptz not null
);
alter table report_tickets enable row level security;
revoke all on table report_tickets from anon, authenticated;

create or replace function report_ticket(p_token text, p_kind text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; t text; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_kind is null or p_kind not in ('team_xlsx', 'team_pdf', 'person_pdf', 'person_xlsx') then
    return jsonb_build_object('ok', false, 'error', 'kind');
  end if;
  if p_kind like 'team%' and _sa_report_rank(c) < 1 then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad');
  end if;
  n := octet_length(p_payload::text);
  if n > 3000000 then return jsonb_build_object('ok', false, 'error', 'too_big', 'size', n); end if;
  delete from report_tickets where expires_at < now();
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into report_tickets (ticket, emp_id, kind, payload, expires_at)
  values (t, c->>'id', p_kind, p_payload, now() + interval '3 minutes');
  return jsonb_build_object('ok', true, 'ticket', t);
end; $$;

-- Обмен билета на отчёт: билет гасится сразу, второй раз не сработает.
create or replace function report_take(p_ticket text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare k text; p jsonb;
begin
  delete from report_tickets where ticket = p_ticket and expires_at >= now()
    returning kind, payload into k, p;
  if k is null then return jsonb_build_object('ok', false, 'error', 'ticket'); end if;
  return jsonb_build_object('ok', true, 'kind', k, 'payload', p);
end; $$;

-- ── 6) Права ─────────────────────────────────────────────────────────────────
revoke all on function _sa_report_rank(jsonb) from public, anon, authenticated;
revoke all on function _sa_report_can(jsonb, text, text, text, boolean) from public, anon, authenticated;
revoke all on function _sa_report_scope(jsonb) from public, anon, authenticated;
revoke all on function _sa_rep_list(text, text, text) from public, anon, authenticated;
revoke all on function _sa_rep_count(text, text, text) from public, anon, authenticated;
revoke all on function _sa_report_person(text) from public, anon, authenticated;
revoke all on function _sa_report_people(jsonb) from public, anon, authenticated;
grant execute on function sa_learning_push(text, jsonb) to anon, authenticated;
grant execute on function report_people(text) to anon, authenticated;
grant execute on function report_person(text, text) to anon, authenticated;
grant execute on function report_team(text) to anon, authenticated;
grant execute on function report_ticket(text, text, jsonb) to anon, authenticated;
grant execute on function report_take(text) to anon, authenticated;

-- PostgREST должен увидеть новые функции сразу (см. этап 9)
notify pgrst, 'reload schema';

-- ── Проверка: ожидаем «отчёты: 6 функций из 6, таблиц 2 из 2» ────────────────
select 'отчёты: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('sa_learning_push', 'report_people', 'report_person', 'report_team', 'report_ticket', 'report_take'))
  || ' функций из 6, таблиц ' ||
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('emp_learning', 'report_tickets'))
  || ' из 2' as result;
