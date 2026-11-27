-- ════════════════════════════════════════════════════════════════════════════
-- Этап 1 — основа базы (Доп. 529)
--
-- То, что было в базе ещё до этапа 2: сотрудники и вход по коду, сессии, старые таблицы прогресса
-- (profiles, progress, quiz_done, practice_stars, completed_roles, scores), чек-листы, онбординг,
-- настроение, свои уроки, пожелания и обмены смен, счётчик запросов к AI — и функции к ним.
-- Раньше этого кода в репозитории не было, он жил только в базе. Здесь точная выгрузка из рабочей
-- базы от 27.11.2026 (после этапа 66), без данных.
--
-- На рабочей базе запускать не нужно: там всё это уже есть. Файл нужен для новой базы с нуля:
-- этап 1, потом этапы 2…66 по порядку из README. Безвреден повторно: таблицы и индексы —
-- «if not exists», функции — «create or replace».
-- Колонки, которые добавляют позже этапы 6, 13 и 61 (employees.mentor_pin, access_codes.permanent,
-- employees.job_title), и триггер новичков на employees (этап 41) здесь не повторяются.
-- ════════════════════════════════════════════════════════════════════════════

-- Функции ссылаются на то, что появится в следующих этапах: тела не проверяем при создании
set check_function_bodies = off;

-- ── Таблицы ──────────────────────────────────────────────────────────────────
create table if not exists public.access_codes (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  code_hash text not null,
  used_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint access_codes_pkey PRIMARY KEY (id)
);
create table if not exists public.ai_usage (
  id text not null,
  user_id text not null,
  day date not null,
  count integer default 0 not null,
  constraint ai_usage_pkey PRIMARY KEY (id)
);
create table if not exists public.checklist_log (
  id uuid default gen_random_uuid() not null,
  restaurant text not null,
  kind text not null,
  day date not null,
  checked jsonb default '[]'::jsonb not null,
  done_at timestamp with time zone,
  by_name text,
  updated_at timestamp with time zone default now() not null,
  constraint checklist_log_kind_check CHECK ((kind = ANY (ARRAY['open'::text, 'preshift'::text, 'close'::text]))),
  constraint checklist_log_pkey PRIMARY KEY (id),
  constraint checklist_log_restaurant_kind_day_key UNIQUE (restaurant, kind, day)
);
create table if not exists public.checklists (
  id uuid default gen_random_uuid() not null,
  restaurant text not null,
  kind text not null,
  items jsonb default '[]'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  updated_by text,
  constraint checklists_kind_check CHECK ((kind = ANY (ARRAY['open'::text, 'preshift'::text, 'close'::text]))),
  constraint checklists_pkey PRIMARY KEY (id),
  constraint checklists_restaurant_kind_key UNIQUE (restaurant, kind)
);
create table if not exists public.completed_roles (
  id bigint generated always as identity not null,
  name text not null,
  surname text default ''::text not null,
  role text not null,
  updated_at timestamp with time zone default now(),
  user_id text,
  constraint completed_roles_pkey PRIMARY KEY (id),
  constraint completed_roles_name_surname_role_key UNIQUE (name, surname, role)
);
create table if not exists public.custom_lessons (
  id uuid default gen_random_uuid() not null,
  restaurant text not null,
  role text default 'seasonal'::text not null,
  module text default ''::text not null,
  title text default ''::text not null,
  content text default ''::text not null,
  questions jsonb default '[]'::jsonb not null,
  sort integer default 0 not null,
  created_by uuid,
  updated_at timestamp with time zone default now() not null,
  constraint custom_lessons_pkey PRIMARY KEY (id)
);
create table if not exists public.employees (
  id uuid default gen_random_uuid() not null,
  name text not null,
  surname text default ''::text not null,
  restaurant text not null,
  position text default 'waiter'::text not null,
  is_admin boolean default false not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  last_seen_at timestamp with time zone,
  constraint employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text]))),
  constraint employees_pkey PRIMARY KEY (id)
);
create table if not exists public.mood_pulse (
  id uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  restaurant text,
  mood smallint not null,
  day date not null,
  created_at timestamp with time zone default now() not null,
  constraint mood_pulse_mood_check CHECK (((mood >= 1) AND (mood <= 5))),
  constraint mood_pulse_pkey PRIMARY KEY (id),
  constraint mood_pulse_employee_id_day_key UNIQUE (employee_id, day)
);
create table if not exists public.onboarding (
  employee_id uuid not null,
  restaurant text,
  checked jsonb default '[]'::jsonb not null,
  total integer,
  started_at timestamp with time zone default now() not null,
  done_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  constraint onboarding_pkey PRIMARY KEY (employee_id)
);
create table if not exists public.practice_stars (
  id bigint generated always as identity not null,
  name text not null,
  surname text default ''::text not null,
  lesson_id text not null,
  stars integer default 1 not null,
  updated_at timestamp with time zone default now(),
  user_id text,
  constraint practice_stars_pkey PRIMARY KEY (id),
  constraint practice_stars_name_surname_lesson_id_key UNIQUE (name, surname, lesson_id)
);
create table if not exists public.profiles (
  id bigint generated always as identity not null,
  name text not null,
  surname text default ''::text not null,
  last_role text,
  restaurant text,
  position text,
  updated_at timestamp with time zone default now(),
  user_id text,
  tg_chat_id bigint,
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_name_surname_key UNIQUE (name, surname)
);
create table if not exists public.progress (
  id uuid default gen_random_uuid() not null,
  name text,
  surname text,
  lesson_id text,
  role text,
  completed_at timestamp with time zone default now(),
  user_id text,
  constraint progress_pkey PRIMARY KEY (id)
);
create table if not exists public.quiz_done (
  id uuid default gen_random_uuid() not null,
  name text,
  surname text,
  quiz_id text,
  done_at timestamp with time zone default now(),
  user_id text,
  constraint quiz_done_pkey PRIMARY KEY (id),
  constraint quiz_done_unique UNIQUE (name, surname, quiz_id)
);
create table if not exists public.schedule_swaps (
  id bigint generated always as identity not null,
  restaurant text not null,
  venue_key text not null,
  mkey text not null,
  day integer not null,
  shift_k text not null,
  from_staff text not null,
  from_name text not null,
  to_staff text,
  to_name text,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint schedule_swaps_pkey PRIMARY KEY (id)
);
create table if not exists public.schedule_wishes (
  id bigint generated always as identity not null,
  restaurant text not null,
  venue_key text default ''::text not null,
  mkey text not null,
  staff_id integer not null,
  day integer not null,
  kind text default 'off'::text not null,
  author text not null,
  created_at timestamp with time zone default now() not null,
  constraint schedule_wishes_day_check CHECK (((day >= 1) AND (day <= 31))),
  constraint schedule_wishes_pkey PRIMARY KEY (id),
  constraint schedule_wishes_restaurant_venue_key_mkey_staff_id_day_key UNIQUE (restaurant, venue_key, mkey, staff_id, day)
);
create table if not exists public.scores (
  id uuid default gen_random_uuid() not null,
  name text,
  surname text,
  restaurant text,
  role text,
  position text,
  score integer,
  total integer,
  updated_at timestamp with time zone default now(),
  user_id text,
  quiz_id text,
  constraint scores_pkey PRIMARY KEY (id)
);
create table if not exists public.sessions (
  token uuid default gen_random_uuid() not null,
  employee_id uuid not null,
  created_at timestamp with time zone default now() not null,
  last_used_at timestamp with time zone default now() not null,
  constraint sessions_pkey PRIMARY KEY (token)
);

-- ── Связи между таблицами ────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'access_codes_employee_id_fkey' and conrelid = 'public.access_codes'::regclass) then
    alter table public.access_codes add constraint access_codes_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_employee_id_fkey' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
  end if;
end $$;

-- ── Индексы ──────────────────────────────────────────────────────────────────
create index if not exists idx_codes_employee on public.access_codes USING btree (employee_id);
create index if not exists ai_usage_day_idx on public.ai_usage USING btree (day);
create index if not exists checklist_log_rest_day_idx on public.checklist_log USING btree (restaurant, day);
create index if not exists idx_completed_roles_user on public.completed_roles USING btree (user_id);
create index if not exists mood_pulse_day_idx on public.mood_pulse USING btree (day);
create index if not exists mood_pulse_rest_idx on public.mood_pulse USING btree (restaurant, day);
create index if not exists onboarding_rest_idx on public.onboarding USING btree (restaurant);
create index if not exists idx_practice_stars_user on public.practice_stars USING btree (user_id);
create index if not exists idx_profiles_user on public.profiles USING btree (user_id);
create index if not exists idx_progress_user on public.progress USING btree (user_id);
create index if not exists idx_quiz_done_user on public.quiz_done USING btree (user_id);
create index if not exists schedule_swaps_scope on public.schedule_swaps USING btree (restaurant, venue_key, mkey, status);
create index if not exists idx_scores_user on public.scores USING btree (user_id);
create index if not exists idx_scores_user_quiz on public.scores USING btree (user_id, quiz_id);
create index if not exists idx_sessions_employee on public.sessions USING btree (employee_id);

-- ── Доступ: таблицы закрыты, данные — только через функции ───────────────────
alter table public.access_codes enable row level security;
revoke all on public.access_codes from public, anon, authenticated;
grant all on public.access_codes to service_role;
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from public, anon, authenticated;
grant all on public.ai_usage to service_role;
alter table public.checklist_log enable row level security;
revoke all on public.checklist_log from public, anon, authenticated;
grant all on public.checklist_log to service_role;
alter table public.checklists enable row level security;
revoke all on public.checklists from public, anon, authenticated;
grant all on public.checklists to service_role;
alter table public.completed_roles enable row level security;
revoke all on public.completed_roles from public, anon, authenticated;
grant all on public.completed_roles to service_role;
alter table public.custom_lessons enable row level security;
revoke all on public.custom_lessons from public, anon, authenticated;
grant all on public.custom_lessons to service_role;
alter table public.employees enable row level security;
revoke all on public.employees from public, anon, authenticated;
grant all on public.employees to service_role;
alter table public.mood_pulse enable row level security;
revoke all on public.mood_pulse from public, anon, authenticated;
grant all on public.mood_pulse to service_role;
alter table public.onboarding enable row level security;
revoke all on public.onboarding from public, anon, authenticated;
grant all on public.onboarding to service_role;
alter table public.practice_stars enable row level security;
revoke all on public.practice_stars from public, anon, authenticated;
grant all on public.practice_stars to service_role;
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant all on public.profiles to service_role;
alter table public.progress enable row level security;
revoke all on public.progress from public, anon, authenticated;
grant all on public.progress to service_role;
alter table public.quiz_done enable row level security;
revoke all on public.quiz_done from public, anon, authenticated;
grant all on public.quiz_done to service_role;
alter table public.schedule_swaps enable row level security;
revoke all on public.schedule_swaps from public, anon, authenticated;
grant all on public.schedule_swaps to service_role;
alter table public.schedule_wishes enable row level security;
revoke all on public.schedule_wishes from public, anon, authenticated;
grant all on public.schedule_wishes to service_role;
alter table public.scores enable row level security;
revoke all on public.scores from public, anon, authenticated;
grant all on public.scores to service_role;
alter table public.sessions enable row level security;
revoke all on public.sessions from public, anon, authenticated;
grant all on public.sessions to service_role;

-- ── Функции ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._cms_actor(p_token uuid)
 RETURNS employees
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.*
  from public.employees e
  where e.id = ((public._sa_identity(p_token::text)) ->> 'id')::uuid
  limit 1
$function$;
revoke all on function public._cms_actor(p_token uuid) from public, anon, authenticated, service_role;
grant execute on function public._cms_actor(p_token uuid) to service_role;

CREATE OR REPLACE FUNCTION public._cms_can_edit(a employees)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select a.id is not null
     and (coalesce(a.is_admin, false) or coalesce(a.position, 'waiter') <> 'waiter')
$function$;
revoke all on function public._cms_can_edit(a employees) from public, anon, authenticated, service_role;
grant execute on function public._cms_can_edit(a employees) to service_role;

CREATE OR REPLACE FUNCTION public._gen_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  words text[] := array['МАРС','ВЕГА','АТЛАС','СОКОЛ','ТИГР','ЛОТОС',
                        'ОНИКС','ТОПАЗ','КЕДР','ШТОРМ','РУБИН','ЗЕНИТ',
                        'БАРС','ГРАНД','ФАКЕЛ','ВОЛНА'];
begin
  return words[1 + floor(random()*array_length(words,1))::int]
         || '-' || lpad(floor(random()*10000)::int::text, 4, '0');
end $function$;
revoke all on function public._gen_code() from public, anon, authenticated, service_role;
grant execute on function public._gen_code() to service_role;

CREATE OR REPLACE FUNCTION public._issue_code(p_employee_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_code text; v_tries int := 0;
begin
  loop
    v_code := _gen_code();
    exit when not exists (
      select 1 from access_codes ac
      where ac.used_at is null
        and ac.code_hash = crypt(v_code, ac.code_hash));
    v_tries := v_tries + 1;
    if v_tries > 20 then raise exception 'code_generation_failed'; end if;
  end loop;
  insert into access_codes(employee_id, code_hash)
  values (p_employee_id, crypt(v_code, gen_salt('bf')));
  return v_code;
end $function$;
revoke all on function public._issue_code(p_employee_id uuid) from public, anon, authenticated, service_role;
grant execute on function public._issue_code(p_employee_id uuid) to service_role;

CREATE OR REPLACE FUNCTION public._require_admin(p_token uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_id uuid;
begin
  select e.id into v_id
  from sessions s join employees e on e.id = s.employee_id
  where s.token = p_token and e.is_admin and e.status = 'active';
  if v_id is null then raise exception 'not_admin'; end if;
  update sessions set last_used_at = now() where token = p_token;
  return v_id;
end $function$;
revoke all on function public._require_admin(p_token uuid) from public, anon, authenticated, service_role;
grant execute on function public._require_admin(p_token uuid) to service_role;

CREATE OR REPLACE FUNCTION public._sa_identity(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v jsonb;
begin
  if p_token is null or length(p_token) < 1 then
    return null;
  end if;
  begin
    v := (public.whoami(p_token::uuid))::jsonb;   -- whoami принимает UUID → приводим токен
  exception when others then
    return null;
  end;
  if v is null or coalesce((v->>'ok')::boolean, false) is distinct from true then
    return null;
  end if;
  return v->'employee';
end;
$function$;
revoke all on function public._sa_identity(p_token text) from public, anon, authenticated, service_role;
grant execute on function public._sa_identity(p_token text) to service_role;

CREATE OR REPLACE FUNCTION public._swap_auth(p_token text, p_restaurant text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tok uuid; v jsonb;
BEGIN
  BEGIN v_tok := p_token::uuid;
  EXCEPTION WHEN others THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_token'); END;
  v := to_jsonb(whoami(v_tok));
  IF coalesce((v->>'ok')::boolean, false) IS NOT TRUE
     OR (v->'employee'->>'restaurant') IS DISTINCT FROM p_restaurant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth');
  END IF;
  RETURN jsonb_build_object('ok', true, 'employee', v->'employee');
END; $function$;
revoke all on function public._swap_auth(p_token text, p_restaurant text) from public, anon, authenticated, service_role;
grant execute on function public._swap_auth(p_token text, p_restaurant text) to service_role;

CREATE OR REPLACE FUNCTION public.admin_create_employee(p_token uuid, p_name text, p_surname text, p_restaurant text, p_position text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_emp_id uuid; v_code text;
begin
  perform _require_admin(p_token);
  if length(trim(p_name)) < 2 or length(trim(p_restaurant)) < 2 then
    return json_build_object('ok', false, 'error', 'bad_input');
  end if;
  insert into employees(name, surname, restaurant, position)
  values (trim(p_name), trim(coalesce(p_surname,'')),
          trim(p_restaurant), coalesce(nullif(p_position,''), 'waiter'))
  returning id into v_emp_id;
  v_code := _issue_code(v_emp_id);
  return json_build_object('ok', true, 'employee_id', v_emp_id, 'code', v_code);
exception when others then
  return json_build_object('ok', false, 'error', sqlerrm);
end $function$;
revoke all on function public.admin_create_employee(p_token uuid, p_name text, p_surname text, p_restaurant text, p_position text) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_employee(p_token uuid, p_name text, p_surname text, p_restaurant text, p_position text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_employee(p_token uuid, p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_admin boolean;
  v_name     text;
  v_surname  text;
  r          record;
begin
  -- 1) только админ  (ключевая правка: p_token::text)
  v_is_admin := coalesce(((public._sa_identity(p_token::text)) ->> 'is_admin')::boolean, false);
  if not v_is_admin then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- 2) имя/фамилия (по ним ключуются игровые данные)
  select name, surname into v_name, v_surname
  from public.employees where id = p_employee_id;
  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- 3) удалить строки во ВСЕХ таблицах, что ссылаются на employees(id)
  for r in
    select tc.table_schema as sch, tc.table_name as tbl, kcu.column_name as col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = 'employees'
      and ccu.column_name = 'id'
  loop
    execute format('delete from %I.%I where %I = $1', r.sch, r.tbl, r.col) using p_employee_id;
  end loop;

  -- 4) игровые данные по имени+фамилии — «мягко»
  begin delete from public.scores          where name = v_name and surname = v_surname; exception when others then null; end;
  begin delete from public.progress        where name = v_name and surname = v_surname; exception when others then null; end;
  begin delete from public.quiz_done       where name = v_name and surname = v_surname; exception when others then null; end;
  begin delete from public.practice_stars  where name = v_name and surname = v_surname; exception when others then null; end;
  begin delete from public.completed_roles where name = v_name and surname = v_surname; exception when others then null; end;

  -- 5) сам сотрудник
  delete from public.employees where id = p_employee_id;

  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.admin_delete_employee(p_token uuid, p_employee_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_employee(p_token uuid, p_employee_id uuid) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_employees(p_token uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  perform _require_admin(p_token);
  return coalesce((
    select json_agg(row_to_json(t)) from (
      select e.id, e.name, e.surname, e.restaurant, e.position,
             e.is_admin, e.status, e.created_at, e.last_seen_at,
             exists(select 1 from access_codes ac
                    where ac.employee_id = e.id and ac.used_at is null)
               as has_pending_code,
             exists(select 1 from sessions s
                    where s.employee_id = e.id) as has_session
      from employees e
      order by e.restaurant, e.name, e.surname
    ) t), '[]'::json);
exception when others then
  return json_build_object('ok', false, 'error', sqlerrm);
end $function$;
revoke all on function public.admin_list_employees(p_token uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_list_employees(p_token uuid) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reset_code(p_token uuid, p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_code text;
begin
  perform _require_admin(p_token);
  update access_codes set used_at = now()
   where employee_id = p_employee_id and used_at is null;
  delete from sessions where employee_id = p_employee_id;
  v_code := _issue_code(p_employee_id);
  return json_build_object('ok', true, 'code', v_code);
exception when others then
  return json_build_object('ok', false, 'error', sqlerrm);
end $function$;
revoke all on function public.admin_reset_code(p_token uuid, p_employee_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_reset_code(p_token uuid, p_employee_id uuid) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reset_player(p_token text, p_name text, p_surname text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb := public._sa_identity(p_token); v_surname text;
begin
  if e is null or coalesce((e->>'is_admin')::boolean, false) is distinct from true then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  v_surname := coalesce(p_surname, '');
  delete from public.scores          where name = p_name and surname = v_surname;
  delete from public.quiz_done       where name = p_name and surname = v_surname;
  delete from public.progress        where name = p_name and surname = v_surname;
  delete from public.practice_stars  where name = p_name and surname = v_surname;
  delete from public.completed_roles where name = p_name and surname = v_surname;
  delete from public.profiles        where name = p_name and surname = v_surname;
  return jsonb_build_object('ok', true);
end; $function$;
revoke all on function public.admin_reset_player(p_token text, p_name text, p_surname text) from public, anon, authenticated, service_role;
grant execute on function public.admin_reset_player(p_token text, p_name text, p_surname text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_status(p_token uuid, p_employee_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  perform _require_admin(p_token);
  if p_status not in ('active','disabled') then
    return json_build_object('ok', false, 'error', 'bad_status');
  end if;
  update employees set status = p_status where id = p_employee_id;
  if p_status = 'disabled' then
    delete from sessions where employee_id = p_employee_id;
  end if;
  return json_build_object('ok', true);
exception when others then
  return json_build_object('ok', false, 'error', sqlerrm);
end $function$;
revoke all on function public.admin_set_status(p_token uuid, p_employee_id uuid, p_status text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_status(p_token uuid, p_employee_id uuid, p_status text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_admin(p_name text, p_surname text, p_restaurant text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_id uuid; v_code text;
begin
  if exists (select 1 from employees where is_admin) then
    return json_build_object('ok', false, 'error', 'admin_already_exists');
  end if;
  insert into employees(name, surname, restaurant, position, is_admin)
  values (trim(p_name), trim(coalesce(p_surname,'')), trim(p_restaurant), 'senior', true)
  returning id into v_id;
  v_code := _issue_code(v_id);
  return json_build_object('ok', true, 'master_code', v_code);
end $function$;
revoke all on function public.bootstrap_admin(p_name text, p_surname text, p_restaurant text) from public, anon, authenticated, service_role;
grant execute on function public.bootstrap_admin(p_name text, p_surname text, p_restaurant text) to service_role;

CREATE OR REPLACE FUNCTION public.checklist_check(p_token uuid, p_kind text, p_checked jsonb, p_total integer, p_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb; eid uuid; rest text; nm text; d date; done timestamptz;
begin
  e := public._sa_identity(p_token);
  if e is null then return jsonb_build_object('ok', false, 'error', 'no_identity'); end if;
  if p_kind not in ('open','preshift','close') then return jsonb_build_object('ok', false, 'error', 'bad_kind'); end if;
  eid := (e->>'id')::uuid;
  select restaurant, (coalesce(name,'')||' '||coalesce(surname,'')) into rest, nm from public.employees where id = eid;
  d := coalesce(p_day, (now() at time zone 'utc')::date);
  done := case when jsonb_array_length(p_checked) >= p_total and p_total > 0 then now() else null end;

  insert into public.checklist_log (restaurant, kind, day, checked, done_at, by_name, updated_at)
  values (rest, p_kind, d, p_checked, done, case when done is not null then nm else null end, now())
  on conflict (restaurant, kind, day)
  do update set checked = excluded.checked,
                done_at = case when excluded.done_at is not null then excluded.done_at else public.checklist_log.done_at end,
                by_name = case when excluded.done_at is not null then excluded.by_name else public.checklist_log.by_name end,
                updated_at = now();

  return jsonb_build_object('ok', true, 'done_at', done);
end; $function$;
revoke all on function public.checklist_check(p_token uuid, p_kind text, p_checked jsonb, p_total integer, p_day date) from public, anon, authenticated, service_role;
grant execute on function public.checklist_check(p_token uuid, p_kind text, p_checked jsonb, p_total integer, p_day date) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.checklist_get(p_token uuid, p_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb; eid uuid; rest text; d date; tpls jsonb; logs jsonb;
begin
  e := public._sa_identity(p_token);
  if e is null then return jsonb_build_object('ok', false, 'error', 'no_identity'); end if;
  eid := (e->>'id')::uuid;
  select restaurant into rest from public.employees where id = eid;
  d := coalesce(p_day, (now() at time zone 'utc')::date);

  select coalesce(jsonb_object_agg(kind, items), '{}'::jsonb) into tpls
    from public.checklists where restaurant = rest;

  select coalesce(jsonb_object_agg(kind, jsonb_build_object('checked', checked, 'done_at', done_at, 'by_name', by_name)), '{}'::jsonb) into logs
    from public.checklist_log where restaurant = rest and day = d;

  return jsonb_build_object('ok', true, 'restaurant', rest, 'templates', tpls, 'today', logs);
end; $function$;
revoke all on function public.checklist_get(p_token uuid, p_day date) from public, anon, authenticated, service_role;
grant execute on function public.checklist_get(p_token uuid, p_day date) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.checklist_save(p_token uuid, p_kind text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb; eid uuid; rest text; pos text; adm boolean; nm text;
begin
  e := public._sa_identity(p_token);
  if e is null then return jsonb_build_object('ok', false, 'error', 'no_identity'); end if;
  if p_kind not in ('open','preshift','close') then return jsonb_build_object('ok', false, 'error', 'bad_kind'); end if;
  eid := (e->>'id')::uuid;
  select restaurant, position, coalesce(is_admin,false), (coalesce(name,'')||' '||coalesce(surname,'')) into rest, pos, adm, nm
    from public.employees where id = eid;
  if not (adm or pos in ('manager','senior')) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into public.checklists (restaurant, kind, items, updated_at, updated_by)
  values (rest, p_kind, p_items, now(), nm)
  on conflict (restaurant, kind)
  do update set items = excluded.items, updated_at = now(), updated_by = excluded.updated_by;

  return jsonb_build_object('ok', true);
end; $function$;
revoke all on function public.checklist_save(p_token uuid, p_kind text, p_items jsonb) from public, anon, authenticated, service_role;
grant execute on function public.checklist_save(p_token uuid, p_kind text, p_items jsonb) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cms_delete_lesson(p_token uuid, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.employees;
begin
  a := public._cms_actor(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not public._cms_can_edit(a) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  delete from public.custom_lessons where id = p_id and restaurant = a.restaurant;
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.cms_delete_lesson(p_token uuid, p_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.cms_delete_lesson(p_token uuid, p_id uuid) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cms_list_lessons(p_token uuid)
 RETURNS SETOF custom_lessons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.employees;
begin
  a := public._cms_actor(p_token);
  if a.id is null then return; end if;
  return query
    select * from public.custom_lessons
    where restaurant = a.restaurant
    order by role, sort, updated_at;
end $function$;
revoke all on function public.cms_list_lessons(p_token uuid) from public, anon, authenticated, service_role;
grant execute on function public.cms_list_lessons(p_token uuid) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cms_save_lesson(p_token uuid, p_lesson jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a public.employees; v_id uuid;
begin
  a := public._cms_actor(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not public._cms_can_edit(a) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_id := coalesce(nullif(p_lesson ->> 'id', '')::uuid, gen_random_uuid());

  insert into public.custom_lessons
    (id, restaurant, role, module, title, content, questions, sort, created_by, updated_at)
  values
    (v_id, a.restaurant,
     coalesce(p_lesson ->> 'role', 'seasonal'),
     coalesce(p_lesson ->> 'module', ''),
     coalesce(p_lesson ->> 'title', ''),
     coalesce(p_lesson ->> 'content', ''),
     coalesce(p_lesson -> 'questions', '[]'::jsonb),
     coalesce((p_lesson ->> 'sort')::int, 0),
     a.id, now())
  on conflict (id) do update set
     role       = excluded.role,
     module     = excluded.module,
     title      = excluded.title,
     content    = excluded.content,
     questions  = excluded.questions,
     sort       = excluded.sort,
     updated_at = now()
  where public.custom_lessons.restaurant = a.restaurant; -- чужой ресторан не трогаем

  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;
revoke all on function public.cms_save_lesson(p_token uuid, p_lesson jsonb) from public, anon, authenticated, service_role;
grant execute on function public.cms_save_lesson(p_token uuid, p_lesson jsonb) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mood_summary(p_token uuid, p_today date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  e          jsonb;
  eid        uuid;
  is_admin   boolean;
  pos        text;
  rest       text;
  all_scope  boolean;
  today      date;
  dist       jsonb;
  total      int;
  avg_today  numeric;
  trend      jsonb;
begin
  e := public._sa_identity(p_token);
  if e is null then
    return jsonb_build_object('ok', false, 'error', 'no_identity');
  end if;
  eid := (e->>'id')::uuid;

  select position, restaurant, coalesce(is_admin, false)
    into pos, rest, is_admin
  from public.employees where id = eid;

  if is_admin or pos = 'senior' then
    all_scope := true;
  elsif pos = 'manager' then
    all_scope := false;
  else
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  today := coalesce(p_today, (now() at time zone 'utc')::date);

  -- распределение за сегодня { "1": n, ... "5": n }
  select coalesce(jsonb_object_agg(mood::text, cnt), '{}'::jsonb), coalesce(sum(cnt), 0)
    into dist, total
  from (
    select mood, count(*) cnt
    from public.mood_pulse
    where day = today and (all_scope or restaurant = rest)
    group by mood
  ) q;

  -- средний за сегодня
  select round(avg(mood)::numeric, 2) into avg_today
  from public.mood_pulse
  where day = today and (all_scope or restaurant = rest);

  -- тренд за 7 дней (средний по дню; только дни, где есть ответы)
  select coalesce(jsonb_agg(jsonb_build_object('day', day, 'avg', a) order by day), '[]'::jsonb)
    into trend
  from (
    select day, round(avg(mood)::numeric, 2) a
    from public.mood_pulse
    where day >= today - 6 and day <= today and (all_scope or restaurant = rest)
    group by day
  ) t;

  return jsonb_build_object(
    'ok', true,
    'scope', case when all_scope then 'all' else 'restaurant' end,
    'today_dist', dist,
    'today_total', total,
    'today_avg', avg_today,
    'trend', trend
  );
end;
$function$;
revoke all on function public.mood_summary(p_token uuid, p_today date) from public, anon, authenticated, service_role;
grant execute on function public.mood_summary(p_token uuid, p_today date) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.onboarding_check(p_token uuid, p_checked jsonb, p_total integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb; eid uuid; rest text; done timestamptz;
begin
  e := public._sa_identity(p_token);
  if e is null then return jsonb_build_object('ok', false, 'error', 'no_identity'); end if;
  eid := (e->>'id')::uuid;
  select restaurant into rest from public.employees where id = eid;
  done := case when jsonb_array_length(p_checked) >= p_total and p_total > 0 then now() else null end;

  insert into public.onboarding (employee_id, restaurant, checked, total, done_at, updated_at)
  values (eid, rest, p_checked, p_total, done, now())
  on conflict (employee_id)
  do update set checked = excluded.checked,
                total = excluded.total,
                done_at = case when excluded.done_at is not null then excluded.done_at else public.onboarding.done_at end,
                updated_at = now();

  return jsonb_build_object('ok', true, 'done_at', done);
end; $function$;
revoke all on function public.onboarding_check(p_token uuid, p_checked jsonb, p_total integer) from public, anon, authenticated, service_role;
grant execute on function public.onboarding_check(p_token uuid, p_checked jsonb, p_total integer) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.onboarding_get(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb; eid uuid; r public.onboarding%rowtype;
begin
  e := public._sa_identity(p_token);
  if e is null then return jsonb_build_object('ok', false, 'error', 'no_identity'); end if;
  eid := (e->>'id')::uuid;
  select * into r from public.onboarding where employee_id = eid;
  if not found then
    return jsonb_build_object('ok', true, 'checked', '[]'::jsonb, 'started_at', null, 'done_at', null);
  end if;
  return jsonb_build_object('ok', true, 'checked', r.checked, 'started_at', r.started_at, 'done_at', r.done_at);
end; $function$;
revoke all on function public.onboarding_get(p_token uuid) from public, anon, authenticated, service_role;
grant execute on function public.onboarding_get(p_token uuid) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.onboarding_list(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb; eid uuid; rest text; pos text; adm boolean; all_scope boolean; res jsonb;
begin
  e := public._sa_identity(p_token);
  if e is null then return jsonb_build_object('ok', false, 'error', 'no_identity'); end if;
  eid := (e->>'id')::uuid;
  select restaurant, position, coalesce(is_admin, false) into rest, pos, adm from public.employees where id = eid;
  if adm or pos = 'senior' then all_scope := true;
  elsif pos = 'manager' then all_scope := false;
  else return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
            'name', em.name, 'surname', em.surname, 'restaurant', em.restaurant,
            'checked', coalesce(jsonb_array_length(o.checked), 0), 'total', coalesce(o.total, 0),
            'started_at', o.started_at, 'done_at', o.done_at
          ) order by o.started_at desc), '[]'::jsonb)
    into res
  from public.onboarding o
  join public.employees em on em.id = o.employee_id
  where (all_scope or o.restaurant = rest) and o.done_at is null;

  return jsonb_build_object('ok', true, 'list', res);
end; $function$;
revoke all on function public.onboarding_list(p_token uuid) from public, anon, authenticated, service_role;
grant execute on function public.onboarding_list(p_token uuid) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sa_set_tg(p_token text, p_tg_id bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tok uuid; v jsonb;
BEGIN
  BEGIN v_tok := p_token::uuid; EXCEPTION WHEN others THEN RETURN json_build_object('ok', false, 'error', 'bad_token'); END;
  v := to_jsonb(whoami(v_tok));
  IF coalesce((v->>'ok')::boolean, false) IS NOT TRUE THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;
  UPDATE public.profiles SET tg_chat_id = p_tg_id
   WHERE lower(name) = lower(v->'employee'->>'name')
     AND lower(coalesce(surname, '')) = lower(coalesce(v->'employee'->>'surname', ''))
     AND restaurant = v->'employee'->>'restaurant';
  RETURN json_build_object('ok', true);
END; $function$;
revoke all on function public.sa_set_tg(p_token text, p_tg_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.sa_set_tg(p_token text, p_tg_id bigint) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_completed_role(p_token text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb := public._sa_identity(p_token); v_uid text; v_name text; v_surname text;
begin
  if e is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_uid := e->>'id';
  v_name := e->>'name';
  v_surname := coalesce(nullif(e->>'surname', 'EMPTY'), '');
  if not exists (select 1 from public.completed_roles where user_id = v_uid and role = p_role) then
    insert into public.completed_roles(user_id, name, surname, role, updated_at)
    values (v_uid, v_name, v_surname, p_role, now());
  end if;
  return jsonb_build_object('ok', true);
end; $function$;
revoke all on function public.save_completed_role(p_token text, p_role text) from public, anon, authenticated, service_role;
grant execute on function public.save_completed_role(p_token text, p_role text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_last_role(p_token text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e jsonb := public._sa_identity(p_token);
  v_uid text; v_name text; v_surname text; v_rest text; v_pos text;
begin
  if e is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_uid := e->>'id';
  v_name := e->>'name';
  v_surname := coalesce(nullif(e->>'surname', 'EMPTY'), '');
  v_rest := e->>'restaurant';
  v_pos  := coalesce(e->>'position', 'waiter');
  update public.profiles set last_role = p_role, name = v_name, surname = v_surname, updated_at = now()
    where user_id = v_uid;
  if not found then
    insert into public.profiles(user_id, name, surname, restaurant, position, last_role, updated_at)
    values (v_uid, v_name, v_surname, v_rest, v_pos, p_role, now());
  end if;
  return jsonb_build_object('ok', true);
end; $function$;
revoke all on function public.save_last_role(p_token text, p_role text) from public, anon, authenticated, service_role;
grant execute on function public.save_last_role(p_token text, p_role text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_mood(p_token uuid, p_mood integer, p_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e    jsonb;
  eid  uuid;
  rest text;
  d    date;
begin
  e := public._sa_identity(p_token);
  if e is null then
    return jsonb_build_object('ok', false, 'error', 'no_identity');
  end if;
  if p_mood is null or p_mood < 1 or p_mood > 5 then
    return jsonb_build_object('ok', false, 'error', 'bad_mood');
  end if;

  eid := (e->>'id')::uuid;
  select restaurant into rest from public.employees where id = eid;
  d := coalesce(p_day, (now() at time zone 'utc')::date);

  insert into public.mood_pulse (employee_id, restaurant, mood, day)
  values (eid, rest, p_mood, d)
  on conflict (employee_id, day)
  do update set mood = excluded.mood, created_at = now();

  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.save_mood(p_token uuid, p_mood integer, p_day date) from public, anon, authenticated, service_role;
grant execute on function public.save_mood(p_token uuid, p_mood integer, p_day date) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_practice_stars(p_token text, p_lesson_id text, p_stars integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e jsonb := public._sa_identity(p_token);
  v_uid text; v_name text; v_surname text; v_prev int; v_stars int;
begin
  if e is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_uid := e->>'id';
  v_name := e->>'name';
  v_surname := coalesce(nullif(e->>'surname', 'EMPTY'), '');
  v_stars := greatest(0, least(coalesce(p_stars, 0), 3));
  select max(stars) into v_prev from public.practice_stars
    where user_id = v_uid and lesson_id = p_lesson_id;
  if v_prev is null then
    insert into public.practice_stars(user_id, name, surname, lesson_id, stars, updated_at)
    values (v_uid, v_name, v_surname, p_lesson_id, v_stars, now());
  elsif v_stars > v_prev then
    update public.practice_stars set stars = v_stars, name = v_name, surname = v_surname, updated_at = now()
      where user_id = v_uid and lesson_id = p_lesson_id;
  end if;
  return jsonb_build_object('ok', true);
end; $function$;
revoke all on function public.save_practice_stars(p_token text, p_lesson_id text, p_stars integer) from public, anon, authenticated, service_role;
grant execute on function public.save_practice_stars(p_token text, p_lesson_id text, p_stars integer) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_progress(p_token text, p_lesson_id text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb := public._sa_identity(p_token); v_uid text; v_name text; v_surname text;
begin
  if e is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_uid := e->>'id';
  v_name := e->>'name';
  v_surname := coalesce(nullif(e->>'surname', 'EMPTY'), '');
  if not exists (select 1 from public.progress where user_id = v_uid and lesson_id = p_lesson_id) then
    insert into public.progress(user_id, name, surname, lesson_id, role)
    values (v_uid, v_name, v_surname, p_lesson_id, p_role);
  end if;
  return jsonb_build_object('ok', true);
end; $function$;
revoke all on function public.save_progress(p_token text, p_lesson_id text, p_role text) from public, anon, authenticated, service_role;
grant execute on function public.save_progress(p_token text, p_lesson_id text, p_role text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_quiz_done(p_token text, p_quiz_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e jsonb := public._sa_identity(p_token); v_uid text; v_name text; v_surname text;
begin
  if e is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_uid := e->>'id';
  v_name := e->>'name';
  v_surname := coalesce(nullif(e->>'surname', 'EMPTY'), '');
  if not exists (select 1 from public.quiz_done where user_id = v_uid and quiz_id = p_quiz_id) then
    insert into public.quiz_done(user_id, name, surname, quiz_id)
    values (v_uid, v_name, v_surname, p_quiz_id);
  end if;
  return jsonb_build_object('ok', true);
end; $function$;
revoke all on function public.save_quiz_done(p_token text, p_quiz_id text) from public, anon, authenticated, service_role;
grant execute on function public.save_quiz_done(p_token text, p_quiz_id text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_score(p_token text, p_quiz_id text, p_role text, p_score integer, p_total integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e jsonb := public._sa_identity(p_token);
  v_uid text; v_name text; v_surname text; v_rest text; v_pos text; v_score int; v_total int;
begin
  if e is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_uid     := e->>'id';
  v_name    := e->>'name';
  v_surname := coalesce(nullif(e->>'surname', 'EMPTY'), '');
  v_rest    := e->>'restaurant';
  v_pos     := coalesce(e->>'position', 'waiter');
  v_total := greatest(1, least(coalesce(p_total, 1), 100));
  v_score := greatest(0, least(coalesce(p_score, 0), v_total));
  if exists (select 1 from public.scores where user_id = v_uid and quiz_id = p_quiz_id) then
    update public.scores
       set score = greatest(score, v_score), total = v_total,
           name = v_name, surname = v_surname, restaurant = v_rest,
           role = p_role, position = v_pos, updated_at = now()
     where user_id = v_uid and quiz_id = p_quiz_id;
  else
    insert into public.scores(user_id, name, surname, restaurant, role, position, quiz_id, score, total, updated_at)
    values (v_uid, v_name, v_surname, v_rest, p_role, v_pos, p_quiz_id, v_score, v_total, now());
  end if;
  return jsonb_build_object('ok', true);
end; $function$;
revoke all on function public.save_score(p_token text, p_quiz_id text, p_role text, p_score integer, p_total integer) from public, anon, authenticated, service_role;
grant execute on function public.save_score(p_token text, p_quiz_id text, p_role text, p_score integer, p_total integer) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.schedule_wish_set(p_token text, p_restaurant text, p_venue_key text, p_month text, p_staff_id integer, p_day integer, p_on boolean, p_kind text DEFAULT 'off'::text, p_peers integer[] DEFAULT NULL::integer[], p_max integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v jsonb; v_tok uuid; v_author text; v_boss boolean; v_kind text; v_taken int;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if (v->'employee'->>'restaurant') is distinct from p_restaurant then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  v_kind := case when p_kind in ('off', 'hard') then p_kind else 'off' end;
  v_author := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));
  v_boss := coalesce((v->'employee'->>'is_admin')::boolean, false)
            or coalesce(v->'employee'->>'position', '') in ('manager', 'senior', 'senior_bartender');

  if p_on then
    if v_kind = 'hard' and p_peers is not null and p_max is not null then
      -- Очередь: замок на (ресторан+заведение+месяц+день), чтобы два
      -- одновременных тапа не проскочили мимо лимита, затем честный
      -- подсчёт уже занятых мест — кто успел, тот успел
      perform pg_advisory_xact_lock(hashtext(p_restaurant || '|' || coalesce(p_venue_key, '') || '|' || p_month || '|' || p_day::text));
      select count(*) into v_taken from schedule_wishes
       where restaurant = p_restaurant and venue_key = coalesce(p_venue_key, '')
         and mkey = p_month and day = p_day and kind = 'hard'
         and staff_id = any(p_peers) and staff_id <> p_staff_id;
      if v_taken >= p_max then
        return json_build_object('ok', false, 'error', 'day_full', 'taken', v_taken, 'max', p_max);
      end if;
    end if;
    insert into schedule_wishes (restaurant, venue_key, mkey, staff_id, day, kind, author)
    values (p_restaurant, coalesce(p_venue_key, ''), p_month, p_staff_id, p_day, v_kind, v_author)
    on conflict (restaurant, venue_key, mkey, staff_id, day)
      do update set kind = excluded.kind, author = excluded.author;
  else
    delete from schedule_wishes
     where restaurant = p_restaurant and venue_key = coalesce(p_venue_key, '')
       and mkey = p_month and staff_id = p_staff_id and day = p_day
       and (author = v_author or v_boss);
  end if;
  return json_build_object('ok', true);
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end $function$;
revoke all on function public.schedule_wish_set(p_token text, p_restaurant text, p_venue_key text, p_month text, p_staff_id integer, p_day integer, p_on boolean, p_kind text, p_peers integer[], p_max integer) from public, anon, authenticated, service_role;
grant execute on function public.schedule_wish_set(p_token text, p_restaurant text, p_venue_key text, p_month text, p_staff_id integer, p_day integer, p_on boolean, p_kind text, p_peers integer[], p_max integer) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.schedule_wishes_get(p_token text, p_restaurant text, p_venue_key text, p_month text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v jsonb; v_tok uuid; v_rows jsonb;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if (v->'employee'->>'restaurant') is distinct from p_restaurant then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'staff_id', staff_id, 'day', day, 'kind', kind, 'author', author)), '[]'::jsonb)
    into v_rows
    from schedule_wishes
   where restaurant = p_restaurant and venue_key = coalesce(p_venue_key, '')
     and mkey = p_month;
  return json_build_object('ok', true, 'wishes', v_rows);
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end $function$;
revoke all on function public.schedule_wishes_get(p_token text, p_restaurant text, p_venue_key text, p_month text) from public, anon, authenticated, service_role;
grant execute on function public.schedule_wishes_get(p_token text, p_restaurant text, p_venue_key text, p_month text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.swap_cancel(p_token text, p_restaurant text, p_id bigint, p_staff text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a jsonb; r record;
BEGIN
  a := public._swap_auth(p_token, p_restaurant);
  IF (a->>'ok')::boolean IS NOT TRUE THEN RETURN a::json; END IF;
  SELECT * INTO r FROM public.schedule_swaps
   WHERE id = p_id AND restaurant = p_restaurant FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;
  IF r.status NOT IN ('open', 'taken') THEN RETURN json_build_object('ok', false, 'error', 'closed'); END IF;
  IF r.from_staff = p_staff THEN
    UPDATE public.schedule_swaps SET status = 'cancelled', updated_at = now() WHERE id = p_id;
  ELSIF r.to_staff = p_staff THEN
    UPDATE public.schedule_swaps SET to_staff = NULL, to_name = NULL, status = 'open', updated_at = now() WHERE id = p_id;
  ELSE
    RETURN json_build_object('ok', false, 'error', 'not_yours');
  END IF;
  RETURN json_build_object('ok', true);
END; $function$;
revoke all on function public.swap_cancel(p_token text, p_restaurant text, p_id bigint, p_staff text) from public, anon, authenticated, service_role;
grant execute on function public.swap_cancel(p_token text, p_restaurant text, p_id bigint, p_staff text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.swap_create(p_token text, p_restaurant text, p_venue text, p_month text, p_day integer, p_k text, p_staff text, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a jsonb;
BEGIN
  a := public._swap_auth(p_token, p_restaurant);
  IF (a->>'ok')::boolean IS NOT TRUE THEN RETURN a::json; END IF;
  IF EXISTS (SELECT 1 FROM public.schedule_swaps
             WHERE restaurant = p_restaurant AND venue_key = p_venue AND mkey = p_month
               AND day = p_day AND from_staff = p_staff AND status IN ('open', 'taken')) THEN
    RETURN json_build_object('ok', false, 'error', 'already');
  END IF;
  INSERT INTO public.schedule_swaps (restaurant, venue_key, mkey, day, shift_k, from_staff, from_name)
  VALUES (p_restaurant, p_venue, p_month, p_day, p_k, p_staff, coalesce(p_name, ''));
  RETURN json_build_object('ok', true);
END; $function$;
revoke all on function public.swap_create(p_token text, p_restaurant text, p_venue text, p_month text, p_day integer, p_k text, p_staff text, p_name text) from public, anon, authenticated, service_role;
grant execute on function public.swap_create(p_token text, p_restaurant text, p_venue text, p_month text, p_day integer, p_k text, p_staff text, p_name text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.swap_list(p_token text, p_restaurant text, p_venue text, p_month text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a jsonb; out json;
BEGIN
  a := public._swap_auth(p_token, p_restaurant);
  IF (a->>'ok')::boolean IS NOT TRUE THEN RETURN a::json; END IF;
  SELECT coalesce(json_agg(json_build_object(
      'id', id, 'day', day, 'k', shift_k, 'from_staff', from_staff, 'from_name', from_name,
      'to_staff', to_staff, 'to_name', to_name, 'status', status) ORDER BY day, id), '[]'::json)
    INTO out
    FROM public.schedule_swaps
   WHERE restaurant = p_restaurant AND venue_key = p_venue AND mkey = p_month
     AND status IN ('open', 'taken');
  RETURN json_build_object('ok', true, 'swaps', out);
END; $function$;
revoke all on function public.swap_list(p_token text, p_restaurant text, p_venue text, p_month text) from public, anon, authenticated, service_role;
grant execute on function public.swap_list(p_token text, p_restaurant text, p_venue text, p_month text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.swap_resolve(p_token text, p_restaurant text, p_id bigint, p_approve boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a jsonb; v_boss boolean;
BEGIN
  a := public._swap_auth(p_token, p_restaurant);
  IF (a->>'ok')::boolean IS NOT TRUE THEN RETURN a::json; END IF;
  v_boss := coalesce((a->'employee'->>'is_admin')::boolean, false)
            OR coalesce(a->'employee'->>'position', '') IN ('manager', 'senior', 'senior_bartender');
  IF NOT v_boss THEN RETURN json_build_object('ok', false, 'error', 'not_boss'); END IF;
  UPDATE public.schedule_swaps
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, updated_at = now()
   WHERE id = p_id AND restaurant = p_restaurant AND status = 'taken';
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'not_taken'); END IF;
  RETURN json_build_object('ok', true);
END; $function$;
revoke all on function public.swap_resolve(p_token text, p_restaurant text, p_id bigint, p_approve boolean) from public, anon, authenticated, service_role;
grant execute on function public.swap_resolve(p_token text, p_restaurant text, p_id bigint, p_approve boolean) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.swap_take(p_token text, p_restaurant text, p_id bigint, p_staff text, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a jsonb; r record;
BEGIN
  a := public._swap_auth(p_token, p_restaurant);
  IF (a->>'ok')::boolean IS NOT TRUE THEN RETURN a::json; END IF;
  SELECT * INTO r FROM public.schedule_swaps
   WHERE id = p_id AND restaurant = p_restaurant FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;
  IF r.status <> 'open' THEN RETURN json_build_object('ok', false, 'error', 'busy'); END IF;
  IF r.from_staff = p_staff THEN RETURN json_build_object('ok', false, 'error', 'self'); END IF;
  UPDATE public.schedule_swaps
     SET to_staff = p_staff, to_name = coalesce(p_name, ''), status = 'taken', updated_at = now()
   WHERE id = p_id;
  RETURN json_build_object('ok', true);
END; $function$;
revoke all on function public.swap_take(p_token text, p_restaurant text, p_id bigint, p_staff text, p_name text) from public, anon, authenticated, service_role;
grant execute on function public.swap_take(p_token text, p_restaurant text, p_id bigint, p_staff text, p_name text) to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.whoami(p_token uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_emp record;
begin
  select e.* into v_emp
  from sessions s join employees e on e.id = s.employee_id
  where s.token = p_token and e.status = 'active';

  if v_emp is null then return json_build_object('ok', false); end if;

  update sessions  set last_used_at = now() where token = p_token;
  update employees set last_seen_at = now() where id = v_emp.id;

  return json_build_object('ok', true,
    'employee', json_build_object(
      'id', v_emp.id, 'name', v_emp.name, 'surname', v_emp.surname,
      'restaurant', v_emp.restaurant, 'position', v_emp.position,
      'is_admin', v_emp.is_admin));
end $function$;
revoke all on function public.whoami(p_token uuid) from public, anon, authenticated, service_role;
grant execute on function public.whoami(p_token uuid) to public, anon, authenticated, service_role;

-- Итог одной строкой
select 'основа базы, этап 1: таблиц ' ||
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('access_codes', 'ai_usage', 'checklist_log', 'checklists', 'completed_roles', 'custom_lessons', 'employees', 'mood_pulse', 'onboarding', 'practice_stars', 'profiles', 'progress', 'quiz_done', 'schedule_swaps', 'schedule_wishes', 'scores', 'sessions')) ||
  ' из 17 · функций ' ||
  (select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('_cms_actor', '_cms_can_edit', '_gen_code', '_issue_code', '_require_admin', '_sa_identity', '_swap_auth', 'admin_create_employee', 'admin_delete_employee', 'admin_list_employees', 'admin_reset_code', 'admin_reset_player', 'admin_set_status', 'bootstrap_admin', 'checklist_check', 'checklist_get', 'checklist_save', 'cms_delete_lesson', 'cms_list_lessons', 'cms_save_lesson', 'mood_summary', 'onboarding_check', 'onboarding_get', 'onboarding_list', 'sa_set_tg', 'save_completed_role', 'save_last_role', 'save_mood', 'save_practice_stars', 'save_progress', 'save_quiz_done', 'save_score', 'schedule_wish_set', 'schedule_wishes_get', 'swap_cancel', 'swap_create', 'swap_list', 'swap_resolve', 'swap_take', 'whoami')) ||
  ' из 40' as result;
