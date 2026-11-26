-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 63 (v200, Доп. 525): живая проверка — руководитель спрашивает по урокам вживую и отмечает ответы.
--
-- Владелец (26.11): «составить ряд вопросов для сотрудников, что бы понять и оценить то, читал ли человек инфу или же
-- нет. Тестирование это хорошо, но живая проверка тоже важна». «Сделаем это ввиду чек листа в приложении… опираясь на
-- градацию должностей… официанта проверяет менеджер, управляющий (если менеджер не может). Менеджера проверяет
-- управляющий. И так далее по возрастанию».
-- Вопросы — в приложении (data/live-check.js), здесь — кто кого проверяет и где хранятся итоги.
--   • Ступени: официант, хостес, бармен — 10; старший бармен — 20 (проверяет только барменов); менеджер — 30;
--     управляющий (своя должность «работает как» менеджер, отмеченная «старше менеджера») — 35; руководящий
--     состав — 50; владелец — 60. Проверяет тот, чья ступень выше. Менеджер и управляющий — в своём заведении,
--     руководящий состав и владелец — в любом.
--   • sa_position_levels — какие свои должности стоят на ступень выше своей «работает как». Первый запуск: должность
--     «Управляющий» (если её нет — появится, «работает как» менеджер) — старше менеджера.
--   • sa_live_checks — итоги: кого, по какому модулю, отметки по вопросам (2 — ответил, 1 — частично, 0 — нет),
--     процент, зачтено (75% и выше), кто проверял, когда, заметка.
--   • live_check_people(p_token, p_restaurant) — кого я могу проверить (у сети — в выбранном заведении) и последние
--     итоги по модулям;
--   • live_check_person(p_token, p_emp) — человек, пройденные уроки и тесты, все итоги; видят сам человек, тот, кто
--     может его проверять, и руководство сети;
--   • live_check_save(p_token, p_emp, p_track, p_module, p_marks, p_note) — сохранить проверку;
--   • live_check_delete(p_token, p_id) — убрать ошибочную: проверявший в течение суток или владелец;
--   • live_check_levels(p_token) — свои должности «старше» и моя ступень;
--   • org_position_level(p_token, p_id, p_up) — «старше менеджера» у своей должности. Только владелец.
-- Нужны этапы 21 и 61. Ничего не удаляет; повторный запуск итоги и решения владельца не трогает.
-- Supabase → SQL Editor → New query → вставить → Run.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.sa_positions') is null then
    raise exception 'Сначала этап 61 (supabase-stage61-places.sql): нужен список должностей';
  end if;
end $$;

-- ── 1) Таблицы ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_position_levels (
  id         text primary key,                  -- sa_positions.id своей должности
  up         boolean not null default false,    -- на ступень выше своей «работает как»: проверяет и равных по ней
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table sa_position_levels enable row level security;
revoke all on table sa_position_levels from public, anon, authenticated;

create table if not exists sa_live_checks (
  id            bigserial primary key,
  emp_id        text not null,                  -- employees.id того, кого проверяли
  emp_name      text,
  restaurant    text,                           -- заведение человека на момент проверки
  track         text not null,                  -- курс: seasonal, core, spg, bar, manager, service_manager
  module_id     text not null,
  marks         jsonb not null,                 -- [2, 1, 0, 2]: по вопросам модуля
  score         int not null,                   -- 0–100
  passed        boolean not null,               -- 75% и выше
  note          text,
  checker_id    text not null,
  checker_name  text,
  checker_level int,
  created_at    timestamptz not null default now()
);
create index if not exists sa_live_checks_emp on sa_live_checks (emp_id, created_at desc);
alter table sa_live_checks enable row level security;
revoke all on table sa_live_checks from public, anon, authenticated;
revoke all on sequence sa_live_checks_id_seq from public, anon, authenticated;

-- ── 2) «Управляющий» — старше менеджера ────────────────────────────────────────────────────────────────────────
-- Есть своя должность «Управляющий» («Управляющая») — она; нет — появится («работает как» менеджер). Отметка «старше» —
-- только при первом запуске: если владелец её потом снимет, повторный запуск её не вернёт.
do $$
declare v_id text;
begin
  select id into v_id from sa_positions where not builtin and lower(btrim(label)) in ('управляющий', 'управляющая') order by sort limit 1;
  if v_id is null then
    insert into sa_positions (id, label, base, builtin, sort, updated_by)
      values ('pupravl00', 'Управляющий', 'manager', false, coalesce((select max(sort) + 1 from sa_positions), 0), 'этап 63')
      on conflict (id) do nothing;
    v_id := 'pupravl00';
  end if;
  if (select base from sa_positions where id = v_id) = 'manager' then
    insert into sa_position_levels (id, up, updated_by) values (v_id, true, 'этап 63') on conflict (id) do nothing;
  end if;
end $$;

-- ── 3) Ступени и правило «кто кого» ────────────────────────────────────────────────────────────────────────────
create or replace function _sa_lc_level(p_admin boolean, p_pos text, p_title text)
returns int language sql stable security definer set search_path to public as $$
  select case
    when coalesce(p_admin, false) or lower(coalesce(p_pos, '')) in ('owner', 'admin') then 60
    when lower(coalesce(p_pos, '')) = 'senior' then 50
    when lower(coalesce(p_pos, '')) = 'head' then 35
    when lower(coalesce(p_pos, '')) in ('manager', 'service_manager') then
      case when exists (select 1 from sa_position_levels l where l.id = p_title and l.up) then 35 else 30 end
    when lower(coalesce(p_pos, '')) = 'senior_bartender' then 20
    else 10 end
$$;

create or replace function _sa_lc_family(p_pos text)
returns text language sql immutable as $$
  select case lower(coalesce(p_pos, ''))
    when 'bartender' then 'bar' when 'senior_bartender' then 'bar' when 'hostess' then 'host' when 'waiter' then 'hall'
    else 'other' end
$$;

-- проверяющий (c_*) может проверить человека (t_*): ступень выше; своё заведение (сеть — любое); ниже менеджера — только
-- свою линию (старший бармен — барменов); не себя и не уволенных
create or replace function _sa_lc_can(c_level int, c_family text, c_rest text, c_net boolean, c_id text,
  t_level int, t_family text, t_rest text, t_id text, t_active boolean)
returns boolean language sql immutable as $$
  select coalesce(t_active, false) and c_id is distinct from t_id and coalesce(c_level, 0) > coalesce(t_level, 0)
     and (coalesce(c_net, false) or coalesce(c_rest, '') = coalesce(t_rest, ''))
     and (coalesce(c_level, 0) >= 30 or c_family = t_family)
$$;

-- кто зовёт: своя строка в employees (заведение — своё, без «взгляда сети»), ступень, линия
create or replace function _sa_lc_me(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; e record;
begin
  c := _sa_caller(p_token);
  if c is null then return null; end if;
  select em.id::text as id, btrim(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) as who, coalesce(em.restaurant, '') as restaurant,
         lower(coalesce(em.position, '')) as position, em.job_title, coalesce(em.is_admin, false) as is_admin
    into e from employees em where em.id::text = c->>'id';
  if not found then return null; end if;
  return jsonb_build_object('id', e.id, 'who', e.who, 'restaurant', e.restaurant, 'position', e.position, 'title', e.job_title,
    'admin', e.is_admin, 'level', _sa_lc_level(e.is_admin, e.position, e.job_title), 'family', _sa_lc_family(e.position),
    'net', e.is_admin or e.position = 'senior');
end $$;

revoke all on function _sa_lc_level(boolean, text, text) from public, anon, authenticated;
revoke all on function _sa_lc_family(text) from public, anon, authenticated;
revoke all on function _sa_lc_can(int, text, text, boolean, text, int, text, text, text, boolean) from public, anon, authenticated;
revoke all on function _sa_lc_me(text) from public, anon, authenticated;

-- ── 4) Кого я могу проверить ───────────────────────────────────────────────────────────────────────────────────
create or replace function live_check_people(p_token text, p_restaurant text default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_rest text; v_rows jsonb;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (me->>'level')::int < 20 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  v_rest := case when (me->>'net')::boolean and nullif(btrim(coalesce(p_restaurant, '')), '') is not null
                 then regexp_replace(btrim(p_restaurant), '\s+', ' ', 'g') else me->>'restaurant' end;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'surname', t.surname, 'restaurant', t.restaurant,
           'position', t.position, 'title', t.job_title, 'level', t.lvl,
           'checks', coalesce((select jsonb_agg(jsonb_build_object('m', x.module_id, 't', x.track, 's', x.score, 'p', x.passed,
                                 'at', x.created_at, 'by', x.checker_name) order by x.created_at desc)
                               from (select distinct on (k.module_id) k.* from sa_live_checks k where k.emp_id = t.id
                                      order by k.module_id, k.created_at desc) x), '[]'::jsonb))
           order by t.lvl desc, t.name, t.surname), '[]'::jsonb)
    into v_rows
    from (select em.id::text as id, coalesce(em.name, '') as name, coalesce(em.surname, '') as surname, coalesce(em.restaurant, '') as restaurant,
                 lower(coalesce(em.position, '')) as position, em.job_title, coalesce(em.status, 'active') = 'active' as active,
                 _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) as lvl
            from employees em where coalesce(em.restaurant, '') = v_rest) t
   where _sa_lc_can((me->>'level')::int, me->>'family', me->>'restaurant', (me->>'net')::boolean, me->>'id',
                    t.lvl, _sa_lc_family(t.position), t.restaurant, t.id, t.active);
  return jsonb_build_object('ok', true, 'restaurant', v_rest, 'me', jsonb_build_object('level', (me->>'level')::int, 'title', me->>'title'),
    'people', v_rows);
end $$;

-- ── 5) Человек: пройденное в приложении и итоги живых проверок ─────────────────────────────────────────────────
create or replace function live_check_person(p_token text, p_emp text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); t record; v_can boolean; v_lessons jsonb := '[]'::jsonb; v_quiz jsonb := '[]'::jsonb;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select em.id::text as id, coalesce(em.name, '') as name, coalesce(em.surname, '') as surname, coalesce(em.restaurant, '') as restaurant,
         lower(coalesce(em.position, '')) as position, em.job_title, coalesce(em.status, 'active') = 'active' as active,
         _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) as lvl
    into t from employees em where em.id::text = coalesce(nullif(btrim(coalesce(p_emp, '')), ''), me->>'id');
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_can := _sa_lc_can((me->>'level')::int, me->>'family', me->>'restaurant', (me->>'net')::boolean, me->>'id',
                      t.lvl, _sa_lc_family(t.position), t.restaurant, t.id, t.active);
  if not (t.id = me->>'id' or v_can or (me->>'net')::boolean) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if to_regclass('public.progress') is not null then
    begin
      execute 'select coalesce(jsonb_agg(distinct lesson_id::text), ''[]''::jsonb) from progress where user_id::text = $1 and lesson_id is not null'
        into v_lessons using t.id;
    exception when others then v_lessons := '[]'::jsonb; end;
  end if;
  if to_regclass('public.quiz_done') is not null then
    begin
      execute 'select coalesce(jsonb_agg(distinct quiz_id::text), ''[]''::jsonb) from quiz_done where user_id::text = $1 and quiz_id is not null'
        into v_quiz using t.id;
    exception when others then v_quiz := '[]'::jsonb; end;
  end if;
  return jsonb_build_object('ok', true, 'can', v_can,
    'person', jsonb_build_object('id', t.id, 'name', t.name, 'surname', t.surname, 'restaurant', t.restaurant, 'position', t.position,
      'title', t.job_title, 'level', t.lvl),
    'lessons', coalesce(v_lessons, '[]'::jsonb), 'quiz', coalesce(v_quiz, '[]'::jsonb),
    'checks', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 't', k.track, 'm', k.module_id, 'marks', k.marks, 's', k.score,
                         'p', k.passed, 'note', k.note, 'by', k.checker_name, 'at', k.created_at, 'mine', k.checker_id = me->>'id')
                         order by k.created_at desc)
                       from (select * from sa_live_checks where emp_id = t.id order by created_at desc limit 300) k), '[]'::jsonb));
end $$;

-- ── 6) Сохранить и убрать проверку ─────────────────────────────────────────────────────────────────────────────
create or replace function live_check_save(p_token text, p_emp text, p_track text, p_module text, p_marks jsonb, p_note text default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); t record; n int; s int; v_score int; v_id bigint; v_at timestamptz;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select em.id::text as id, btrim(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) as who, coalesce(em.restaurant, '') as restaurant,
         lower(coalesce(em.position, '')) as position, coalesce(em.status, 'active') = 'active' as active,
         _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) as lvl
    into t from employees em where em.id::text = btrim(coalesce(p_emp, ''));
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not _sa_lc_can((me->>'level')::int, me->>'family', me->>'restaurant', (me->>'net')::boolean, me->>'id',
                    t.lvl, _sa_lc_family(t.position), t.restaurant, t.id, t.active) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if coalesce(p_track, '') not in ('seasonal', 'core', 'spg', 'bar', 'manager', 'service_manager')
     or coalesce(p_module, '') !~ '^[a-z0-9_-]{1,40}$'
     or p_marks is null or jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) not between 1 and 8
     or exists (select 1 from jsonb_array_elements(p_marks) x where x::text !~ '^[012]$')
     or length(coalesce(p_note, '')) > 500 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  n := jsonb_array_length(p_marks);
  select sum((x::text)::int) into s from jsonb_array_elements(p_marks) x;
  v_score := round(s * 100.0 / (2 * n));
  insert into sa_live_checks (emp_id, emp_name, restaurant, track, module_id, marks, score, passed, note, checker_id, checker_name, checker_level)
    values (t.id, t.who, t.restaurant, p_track, p_module, p_marks, v_score, v_score >= 75, nullif(btrim(coalesce(p_note, '')), ''),
            me->>'id', me->>'who', (me->>'level')::int)
    returning id, created_at into v_id, v_at;
  return jsonb_build_object('ok', true, 'id', v_id, 'score', v_score, 'passed', v_score >= 75, 'at', v_at);
end $$;

create or replace function live_check_delete(p_token text, p_id bigint)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); k record;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into k from sa_live_checks where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not ((me->>'admin')::boolean or (k.checker_id = me->>'id' and k.created_at > now() - interval '24 hours')) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  delete from sa_live_checks where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ── 7) Ступени должностей: прочитать и отметить «старше менеджера» ─────────────────────────────────────────────
create or replace function live_check_levels(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token);
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return jsonb_build_object('ok', true, 'level', (me->>'level')::int,
    'ups', coalesce((select jsonb_agg(l.id order by l.id) from sa_position_levels l where l.up), '[]'::jsonb));
end $$;

create or replace function org_position_level(p_token text, p_id text, p_up boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_row sa_positions;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not (me->>'admin')::boolean then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select * into v_row from sa_positions where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_row.builtin then return jsonb_build_object('ok', false, 'error', 'builtin'); end if;
  if v_row.base <> 'manager' then return jsonb_build_object('ok', false, 'error', 'bad_base'); end if;
  insert into sa_position_levels (id, up, updated_by, updated_at) values (v_row.id, coalesce(p_up, false), me->>'who', now())
    on conflict (id) do update set up = excluded.up, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'up', coalesce(p_up, false));
end $$;

grant execute on function live_check_people(text, text) to anon, authenticated;
grant execute on function live_check_person(text, text) to anon, authenticated;
grant execute on function live_check_save(text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function live_check_delete(text, bigint) to anon, authenticated;
grant execute on function live_check_levels(text) to anon, authenticated;
grant execute on function org_position_level(text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 8) Проверка: ожидаем «живая проверка: функций 6 из 6 · старше менеджера: Управляющий · проверок 0» ─────────────
select 'живая проверка: функций ' ||
  (select count(*) from unnest(array['live_check_people(text,text)', 'live_check_person(text,text)',
     'live_check_save(text,text,text,text,jsonb,text)', 'live_check_delete(text,bigint)', 'live_check_levels(text)',
     'org_position_level(text,text,boolean)']) f where to_regprocedure('public.' || f) is not null) || ' из 6' ||
  ' · старше менеджера: ' || coalesce((select string_agg(p.label, ', ' order by p.sort) from sa_positions p
                                        join sa_position_levels l on l.id = p.id and l.up), 'никого') ||
  ' · проверок ' || (select count(*) from sa_live_checks) as result;
