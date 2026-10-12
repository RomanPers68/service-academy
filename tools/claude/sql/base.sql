-- Макет базы Supabase для проверки этапов (роли, права по умолчанию, базовые таблицы и whoami)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create extension if not exists pgcrypto;
grant usage on schema public to anon, authenticated, service_role;
-- как в Supabase: всё новое в public по умолчанию доступно ролям клиента
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;

create table employees (id uuid primary key default gen_random_uuid(), name text, surname text, restaurant text, position text,
  is_admin boolean default false, status text default 'active', created_at timestamptz default now());
create table sessions (token uuid primary key default gen_random_uuid(), employee_id uuid references employees(id), created_at timestamptz default now());
create table access_codes (id uuid primary key default gen_random_uuid(), employee_id uuid, code_hash text, used_at timestamptz, created_at timestamptz default now());
create table profiles (id serial primary key, user_id uuid, name text, surname text, restaurant text, position text, last_role text, updated_at timestamptz default now());
create table progress (id serial primary key, user_id uuid, name text, surname text, role text, lesson_id text, updated_at timestamptz default now());
create table quiz_done (id serial primary key, user_id uuid, name text, surname text, quiz_id text);
create table practice_stars (id serial primary key, user_id uuid, lesson_id text, stars int);
create table completed_roles (id serial primary key, user_id uuid, role text);
create table scores (id serial primary key, name text, surname text, restaurant text, role text, position text, quiz_id text, score int, total int, updated_at timestamptz default now());
create table achievements (employee_id uuid, key text, value numeric, updated_at timestamptz default now());
create table menu_progress (employee text, restaurant text, status text, score int, ts timestamptz default now(), wave text);

create or replace function whoami(p_token uuid) returns json language plpgsql stable security definer set search_path to public as $$
declare e record;
begin
  select em.* into e from sessions s join employees em on em.id = s.employee_id where s.token = p_token and em.status = 'active';
  if e is null then return json_build_object('ok', false, 'error', 'invalid_session'); end if;
  return json_build_object('ok', true, 'employee', json_build_object('id', e.id, 'name', e.name, 'surname', e.surname,
    'restaurant', e.restaurant, 'position', e.position, 'is_admin', e.is_admin));
end $$;
-- заглушка этапа 22б: только таблица связок Telegram
create table if not exists tg_links (emp_id text primary key, chat_id bigint, tg_user jsonb, created_at timestamptz default now());
