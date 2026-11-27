-- Макет Supabase для сборки базы с нуля на обычном PostgreSQL: роли клиента, схема extensions,
-- права по умолчанию как в Supabase, заглушки pg_cron, pg_net, Vault и Storage.
-- Только для проверки этапов (full-build.sh) — в рабочую базу не запускать.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
grant usage on schema public, extensions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;

-- pg_cron
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, schedule text, command text, nodename text default 'localhost',
  nodeport int default 5432, database text default current_database(), username text default current_user,
  active boolean default true, jobname text unique);
create table if not exists cron.job_run_details (jobid bigint, runid bigserial primary key, job_pid int, database text, username text,
  command text, status text, return_message text, start_time timestamptz, end_time timestamptz);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $f$
declare id bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid into id;
  return id;
end $f$;
create or replace function cron.unschedule(job_name text) returns boolean language plpgsql as $f$
begin delete from cron.job where jobname = job_name; return found; end $f$;
create or replace function cron.unschedule(job_id bigint) returns boolean language plpgsql as $f$
begin delete from cron.job where jobid = job_id; return found; end $f$;

-- pg_net
create schema if not exists net;
create table if not exists net._http_response (id bigint, status_code int, content_type text, headers jsonb, content text,
  timed_out boolean, error_msg text, created timestamptz default now());
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds int default 5000)
  returns bigint language sql as $f$ select 1::bigint $f$;
create or replace function net.http_get(url text, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb,
  timeout_milliseconds int default 5000) returns bigint language sql as $f$ select 1::bigint $f$;

-- Vault
create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text default '',
  secret text, created_at timestamptz default now(), updated_at timestamptz default now());
create or replace view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, created_at, updated_at from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
  returns uuid language sql as $f$ insert into vault.secrets (secret, name, description) values (new_secret, new_name, new_description) returning id $f$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null,
  new_description text default null) returns void language sql as $f$
  update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name),
    description = coalesce(new_description, description), updated_at = now() where id = secret_id $f$;

-- Storage
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, owner uuid, public boolean default false,
  avif_autodetection boolean default false, file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
