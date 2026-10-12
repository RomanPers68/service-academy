-- ════════════════════════════════════════════════════════════════════════════
-- Этап 21 — личные данные только по токену. Шаг 1 из 2: функции
--
-- После этапа 11 у таблиц осталось семь открытых дверей для anon-ключа:
--   чтение  profiles, progress, quiz_done, practice_stars, completed_roles, scores;
--   запись  profiles.
-- anon-ключ есть в приложении у каждого. Значит, любой, кто его достанет, мог без
-- входа по коду прочитать имена, рестораны и результаты всей команды и переписать
-- чужой профиль. Ещё две функции отдавали данные по одному названию ресторана:
-- achievements_list (рекорды сотрудников) и menu_progress_list (кто сдал меню).
--
-- И дыры серьёзнее:
--   • служебная _sa_wipe_person из этапа 20г (удаляет строки человека из любой
--     таблицы по её имени) была открыта для вызова снаружи — в Supabase новые
--     функции по умолчанию доступны anon. Здесь доступ снаружи закрывается;
--     админские функции, которые её зовут, работают (они выполняются от владельца);
--   • admin_wipe_traces и admin_unlock_quiz пускали любого руководителя к любому
--     сотруднику сети, в том числе чужого ресторана. Теперь руководитель ресторана —
--     только к своим, руководящий состав сети и владелец — ко всем;
--   • права руководителя дочитывались из employees по имени и фамилии: тёзка-официант
--     получал права тёзки-руководителя. Теперь — только по id сотрудника.
-- Заодно починена строка поиска по имени и фамилии в _sa_wipe_person: в ней
-- пропали кавычки, и «Сбросить» падало на таблице scores.
--
-- Этот файл НИЧЕГО НЕ ЛОМАЕТ: старое приложение работает как раньше. Он добавляет
-- функции, через которые новая версия читает то же самое, но только с токеном:
--   team_scores(p_token)                       результаты тестов для рейтинга
--   team_profiles(p_token)                     список сотрудников для «Управления данными»:
--                                              сети — все, ресторану — свои, остальным — пусто
--   my_state(p_token)                          + звёзды практики, пройденные роли, последняя роль
--   player_detail(p_token, p_name, p_surname)  карточка сотрудника (себя — каждый, своих —
--                                              руководитель ресторана, всех — сеть)
--   team_achievements(p_token)                 рекорды своего ресторана
--   menu_progress_team(p_token, p_restaurant)  кто выучил новинки меню (свой ресторан;
--                                              руководящему составу и владельцу — любой)
-- «Сеть» — владелец (is_admin) и руководящий состав (должность senior): так же, как
-- в приложении (аналитика показывает им все рестораны).
--
-- Все функции — VOLATILE (не STABLE): PostgREST выполняет STABLE-функции в транзакции
-- «только чтение», и если whoami на сервере что-то записывает (например, время
-- последнего входа), проверка токена внутри такой функции падала бы.
--
-- Порядок:
--   1) этот файл — можно сразу;
--   2) выложить новую версию приложения;
--   3) через день-два, когда у всех открылась новая версия, —
--      supabase-stage21b-close-tables.sql (закрывает двери). Откат — stage21b-rollback.
-- Запускать в SQL Editor. Повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0) Кто зовёт ──────────────────────────────────────────────────────────────
-- {id, name, surname, who, restaurant, position, admin, network, lead} или null,
-- если токен не действует. Права — из ответа whoami и из employees ПО ID (не по имени).
create or replace function _sa_caller(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare w jsonb; v jsonb; e_admin boolean; e_pos text; e_rest text; e_status text;
  v_admin boolean; v_pos text; v_rest text;
begin
  if p_token is null or btrim(p_token) = '' then return null; end if;
  begin w := whoami_txt(p_token); exception when others then return null; end;   -- whoami_txt — этап 11c
  if w is null then return null; end if;
  -- отозванный токен: whoami отвечает {ok:false} — это не личность, даже если рядом есть employee
  if w ? 'ok' and coalesce((w->>'ok')::boolean, false) is not true then return null; end if;
  v := coalesce(w->'employee', w);
  if coalesce(v->>'id', '') = '' then return null; end if;

  begin
    select coalesce(e.is_admin, false), lower(coalesce(e.position, '')), e.restaurant, coalesce(e.status, 'active')
      into e_admin, e_pos, e_rest, e_status
      from employees e where e.id::text = v->>'id' limit 1;
  exception when others then e_admin := null; end;
  if e_status is not null and e_status <> 'active' then return null; end if;

  v_admin := coalesce((v->>'is_admin')::boolean, false) or coalesce(e_admin, false);
  v_pos   := coalesce(nullif(lower(v->>'position'), ''), e_pos, '');
  v_rest  := coalesce(nullif(v->>'restaurant', ''), e_rest);
  return jsonb_build_object(
    'id', v->>'id',
    'name', v->>'name',
    'surname', coalesce(v->>'surname', ''),
    'who', btrim(coalesce(v->>'name', '') || ' ' || coalesce(v->>'surname', '')),
    'restaurant', v_rest,
    'position', v_pos,
    'admin', v_admin,
    'network', v_admin or v_pos = 'senior',
    'lead', v_admin or v_pos in ('manager', 'senior', 'owner', 'head', 'admin', 'service_manager'));
end; $$;

-- Сотрудник по имени и фамилии: id и ресторан. Тёзки в разных ресторанах — сначала
-- из ресторана того, кто спрашивает.
create or replace function _sa_find_person(p_name text, p_surname text, p_pref_rest text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare r jsonb;
begin
  begin
    select jsonb_build_object('id', e.id::text, 'restaurant', e.restaurant) into r
      from employees e
     where e.name = p_name and coalesce(e.surname, '') = coalesce(p_surname, '')
     order by (e.restaurant is not distinct from p_pref_rest) desc, (coalesce(e.status, 'active') = 'active') desc
     limit 1;
  exception when others then r := null; end;
  return r;
end; $$;

-- Можно ли тому, кто зовёт, трогать данные этого сотрудника.
-- Себя — всегда (по id). Сеть — всех. Руководитель ресторана — только своих.
-- Сотрудника нет в списке — только сеть.
create or replace function _sa_may_touch(c jsonb, p_target jsonb)
returns boolean language sql immutable as $$
  select c is not null and (
       coalesce((c->>'network')::boolean, false)
    or (p_target is not null and p_target->>'id' = c->>'id')
    or (p_target is not null and coalesce((c->>'lead')::boolean, false)
        and p_target->>'restaurant' is not distinct from c->>'restaurant'))
$$;

-- ── 1) Починка и закрытие _sa_wipe_person (этап 20г) ──────────────────────────
create or replace function _sa_wipe_person(p_table text, p_uid text, p_who text, p_name text, p_surname text, p_rest text)
returns bigint language plpgsql security definer set search_path to public as $$
declare
  n bigint := 0; has_rest boolean; key_cond text; rest_cond text; p1 text; p2 text;
  col_exists boolean;
begin
  if to_regclass('public.' || p_table) is null then return 0; end if;

  has_rest := exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = p_table and column_name = 'restaurant');

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
      -- было: coalesce(surname, ) — без кавычек, запрос падал с синтаксической ошибкой
      key_cond := 'name = $1 and coalesce(surname, '''') = coalesce($2, '''')'; p1 := p_name; p2 := coalesce(p_surname, '');
    else
      key_cond := 'name = $1 and ($2 is null or $2 is not null)'; p1 := p_name; p2 := null;
    end if;
  else
    return 0;
  end if;

  if has_rest and p_rest is not null then
    rest_cond := ' and (restaurant is null or restaurant = $3)';
  else
    rest_cond := ' and ($3 is null or $3 is not null)';
  end if;

  execute format('delete from %I where %s%s', p_table, key_cond, rest_cond) using p1, p2, p_rest;
  get diagnostics n = row_count;
  return n;
end; $$;

-- ── 2) Строки одного человека из таблицы (для карточки сотрудника) ─────────────
-- Сначала по id (user_id / employee_id), иначе по «Имя Фамилия» или имени и фамилии.
-- Если у таблицы есть ресторан — только строки ресторана этого сотрудника.
create or replace function _sa_person_rows(p_table text, p_uid text, p_name text, p_surname text, p_who text, p_rest text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare res jsonb := '[]'::jsonb; cond text; p1 text; p2 text; ord text := ''; rest_cond text := ' and ($3 is null or $3 is not null)';
  has_col boolean;
  col boolean;
begin
  if to_regclass('public.' || p_table) is null then return res; end if;
  if p_uid is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'user_id') then
    cond := 'user_id::text = $1 and ($2 is null or $2 is not null)'; p1 := p_uid; p2 := null;
  elsif p_uid is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'employee_id') then
    cond := 'employee_id::text = $1 and ($2 is null or $2 is not null)'; p1 := p_uid; p2 := null;
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'name') then
    has_col := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'surname');
    if has_col then cond := 'name = $1 and coalesce(surname, '''') = coalesce($2, '''')'; p1 := p_name; p2 := coalesce(p_surname, '');
    else cond := 'name = $1 and ($2 is null or $2 is not null)'; p1 := p_name; p2 := null; end if;
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'employee') then
    cond := 'employee = $1 and ($2 is null or $2 is not null)'; p1 := p_who; p2 := null;
  else
    return res;
  end if;
  col := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'restaurant');
  if col and p_rest is not null then rest_cond := ' and (t.restaurant is null or t.restaurant = $3)'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = p_table and column_name = 'updated_at') then
    ord := ' order by t.updated_at desc nulls last';
  end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t)%s), ''[]''::jsonb) from %I t where %s%s', ord, p_table, cond, rest_cond)
    into res using p1, p2, p_rest;
  return res;
end; $$;

-- Служебные функции снаружи не зовёт никто: их вызывают функции ниже и админские
-- функции этапа 20, а те выполняются от владельца базы. Право вызова у ролей клиента снимаем.
revoke all on function _sa_wipe_person(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function _sa_caller(text) from public, anon, authenticated;
revoke all on function _sa_find_person(text, text, text) from public, anon, authenticated;
revoke all on function _sa_may_touch(jsonb, jsonb) from public, anon, authenticated;
revoke all on function _sa_person_rows(text, text, text, text, text, text) from public, anon, authenticated;
-- версия первого черновика этапа 21 (с пятью параметрами), если успела появиться
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = '_sa_person_rows' and p.pronargs = 5) then
    drop function public._sa_person_rows(text, text, text, text, text);
  end if;
end $$;

-- ── 3) Рейтинг: результаты тестов — только с действующим токеном ──────────────
create or replace function team_scores(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rows jsonb := '[]'::jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if to_regclass('public.scores') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from scores s' into rows;
  end if;
  return jsonb_build_object('ok', true, 'rows', rows);
end; $$;

-- ── 4) Список сотрудников для «Управления данными» ─────────────────────────────
create or replace function team_profiles(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rows jsonb := '[]'::jsonb; scope text := 'none';
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if to_regclass('public.profiles') is not null then
    if (c->>'network')::boolean then
      scope := 'all';
      execute $q$select coalesce(jsonb_agg(jsonb_build_object('name', j->>'name', 'surname', coalesce(j->>'surname', ''),
                 'restaurant', j->>'restaurant', 'position', j->>'position', 'last_role', j->>'last_role')), '[]'::jsonb)
                 from (select to_jsonb(p) j from profiles p) t$q$ into rows;
    elsif (c->>'lead')::boolean then
      scope := 'restaurant';
      execute $q$select coalesce(jsonb_agg(jsonb_build_object('name', j->>'name', 'surname', coalesce(j->>'surname', ''),
                 'restaurant', j->>'restaurant', 'position', j->>'position', 'last_role', j->>'last_role')), '[]'::jsonb)
                 from (select to_jsonb(p) j from profiles p) t where coalesce(j->>'restaurant', '') = $1$q$
        into rows using coalesce(c->>'restaurant', '');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'rows', rows, 'scope', scope);
end; $$;

-- ── 5) «Мой прогресс» одним ответом (замена этапа 20в, ответ шире) ────────────
-- Было STABLE — стало VOLATILE (см. шапку). Сигнатура та же, приложения не задевает.
create or replace function my_state(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; uid text; quiz jsonb := '[]'::jsonb; lessons jsonb := '[]'::jsonb;
  stars jsonb := '{}'::jsonb; roles jsonb := '[]'::jsonb; last_role text := null;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  uid := c->>'id';

  if to_regclass('public.quiz_done') is not null then
    execute 'select coalesce(jsonb_agg(quiz_id), ''[]''::jsonb) from quiz_done where user_id::text = $1'
      into quiz using uid;
  end if;
  if to_regclass('public.progress') is not null then
    execute 'select coalesce(jsonb_agg(lesson_id), ''[]''::jsonb) from progress where user_id::text = $1'
      into lessons using uid;
  end if;
  -- новое в этапе 21: то, что приложение раньше читало из таблиц напрямую
  if to_regclass('public.practice_stars') is not null then
    begin
      execute 'select coalesce(jsonb_object_agg(lesson_id, mx), ''{}''::jsonb) from (
                 select lesson_id::text as lesson_id, max(stars) as mx from practice_stars
                  where user_id::text = $1 and lesson_id is not null group by lesson_id::text) t'
        into stars using uid;
    exception when others then stars := '{}'::jsonb; end;
  end if;
  if to_regclass('public.completed_roles') is not null then
    begin
      execute 'select coalesce(jsonb_agg(distinct role), ''[]''::jsonb) from completed_roles where user_id::text = $1 and role is not null'
        into roles using uid;
    exception when others then roles := '[]'::jsonb; end;
  end if;
  if to_regclass('public.profiles') is not null then
    begin
      execute 'select last_role from profiles where user_id::text = $1 and last_role is not null limit 1'
        into last_role using uid;
    exception when others then last_role := null; end;
  end if;

  return jsonb_build_object('ok', true, 'v', 2, 'quiz', quiz, 'lessons', lessons,
                            'stars', stars, 'roles', roles, 'last_role', last_role);
end; $$;

-- ── 6) Карточка сотрудника ────────────────────────────────────────────────────
create or replace function player_detail(p_token text, p_name text, p_surname text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; t jsonb; who text; uid text; rest text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  who := btrim(coalesce(p_name, '') || ' ' || coalesce(p_surname, ''));
  if who = '' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  t := _sa_find_person(p_name, p_surname, c->>'restaurant');
  if not _sa_may_touch(c, t) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  uid := t->>'id'; rest := t->>'restaurant';
  return jsonb_build_object('ok', true,
    'progress', _sa_person_rows('progress', uid, p_name, p_surname, who, rest),
    'scores',   _sa_person_rows('scores', uid, p_name, p_surname, who, rest),
    'quiz',     _sa_person_rows('quiz_done', uid, p_name, p_surname, who, rest));
end; $$;

-- ── 7) Рекорды команды — ресторан берётся из токена, а не из запроса ──────────
create or replace function team_achievements(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rows jsonb := '[]'::jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if to_regclass('public.achievements') is not null then
    select coalesce(jsonb_agg(jsonb_build_object('name', e.name, 'surname', e.surname, 'position', e.position,
             'key', a.key, 'value', a.value, 'at', a.updated_at)), '[]'::jsonb)
      into rows
      from achievements a join employees e on e.id = a.employee_id
     where e.restaurant = c->>'restaurant' and e.status = 'active';
  end if;
  return jsonb_build_object('ok', true, 'rows', rows);
end; $$;

-- ── 8) Кто выучил новинки меню: свой ресторан; сети — любой ───────────────────
create or replace function menu_progress_team(p_token text, p_restaurant text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; rows jsonb := '[]'::jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := coalesce(nullif(p_restaurant, ''), c->>'restaurant');
  if rest is distinct from c->>'restaurant' and not (c->>'network')::boolean then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'restaurant', c->>'restaurant');
  end if;
  if to_regclass('public.menu_progress') is not null then
    select coalesce(jsonb_agg(jsonb_build_object('employee', x.employee, 'status', x.status, 'score', x.score, 'ts', x.ts, 'wave', x.wave)), '[]'::jsonb)
      into rows
      from (
        select distinct on (mp.employee) mp.employee, mp.status, mp.score, mp.ts, mp.wave
          from menu_progress mp
         where mp.restaurant = rest
           and mp.wave = (select max(wave) from menu_progress where restaurant = rest)
         order by mp.employee, (mp.status = 'passed') desc, mp.ts desc
      ) x;
  end if;
  return jsonb_build_object('ok', true, 'rows', rows, 'restaurant', rest);
end; $$;

-- ── 9) Сброс и разблокировка: руководитель ресторана — только своих ───────────
-- Тело прежнее (этапы 20г и 20д), меняется только проверка прав.
create or replace function admin_wipe_traces(p_token text, p_name text, p_surname text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; t jsonb; who text; target text; uid text; tbl text; n bigint; total bigint := 0; det jsonb := '{}'::jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  who := btrim(coalesce(p_name, '') || ' ' || coalesce(p_surname, ''));
  if who = '' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  t := _sa_find_person(p_name, p_surname, c->>'restaurant');
  if not _sa_may_touch(c, t) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'position', c->>'position');
  end if;
  uid := t->>'id';
  target := coalesce(t->>'restaurant', c->>'restaurant');

  foreach tbl in array array['quiz_events', 'quiz_skips', 'quiz_keys', 'menu_progress', 'achievements',
                             'progress', 'quiz_done', 'practice_stars', 'completed_roles', 'scores'] loop
    n := _sa_wipe_person(tbl, uid, who, p_name, p_surname, target);
    total := total + n;
    if n > 0 then det := det || jsonb_build_object(tbl, n); end if;
  end loop;

  if to_regclass('public.player_resets') is not null then
    insert into player_resets(restaurant, employee, reset_at) values (target, who, now())
      on conflict (employee, restaurant) do update set reset_at = now();
  end if;

  return jsonb_build_object('ok', true, 'employee', who, 'restaurant', target, 'rows', total, 'tables', det);
end; $$;

create or replace function admin_unlock_quiz(p_token text, p_name text, p_surname text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; t jsonb; who text; target text; n bigint;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  who := btrim(coalesce(p_name, '') || ' ' || coalesce(p_surname, ''));
  if who = '' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  t := _sa_find_person(p_name, p_surname, c->>'restaurant');
  if not _sa_may_touch(c, t) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'position', c->>'position');
  end if;
  target := coalesce(t->>'restaurant', c->>'restaurant');
  n := _sa_wipe_person('quiz_done', t->>'id', who, p_name, p_surname, target);
  return jsonb_build_object('ok', true, 'employee', who, 'rows', n);
end; $$;

grant execute on function team_scores(text)                   to anon, authenticated;
grant execute on function team_profiles(text)                 to anon, authenticated;
grant execute on function my_state(text)                      to anon, authenticated;
grant execute on function player_detail(text, text, text)     to anon, authenticated;
grant execute on function team_achievements(text)            to anon, authenticated;
grant execute on function menu_progress_team(text, text)      to anon, authenticated;
grant execute on function admin_wipe_traces(text, text, text) to anon, authenticated;
grant execute on function admin_unlock_quiz(text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';

-- ── Проверка ──────────────────────────────────────────────────────────────────
-- 1) новые функции на месте (ожидаем 6 из 6)
select 'функции этапа 21: ' || count(*) || ' из 6' as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('team_scores', 'team_profiles', 'my_state', 'player_detail', 'team_achievements', 'menu_progress_team')
union all
-- 2) служебные функции снаружи недоступны (ожидаем «нет»)
select '_sa_wipe_person доступна anon: ' ||
       case when has_function_privilege('anon', 'public._sa_wipe_person(text,text,text,text,text,text)', 'execute') then 'ДА — пришли скрин' else 'нет' end
union all
-- 3) аудит: функции с правами владельца, которые anon может вызвать без токена.
--    Нормально, если здесь только menu_get, redeem_code, sa_rank и (до шага 21b)
--    achievements_list и menu_progress_list. Остальное — пришли скрин разработчику.
select 'без токена: ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosecdef
   and has_function_privilege('anon', p.oid, 'execute')
   and not (coalesce(p.proargnames, '{}'::text[]) && array['p_token', 'p_ticket', 'p_code']::text[]);
