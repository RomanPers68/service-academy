-- Заглушки Supabase для проверки этапов 22б и 25 на обычном PostgreSQL:
-- vault.decrypted_secrets (токен бота) и net.http_post (вместо отправки — запись в журнал)
create schema if not exists vault;
create table if not exists vault.secrets_stub (name text primary key, decrypted_secret text);
create or replace view vault.decrypted_secrets as select name, decrypted_secret from vault.secrets_stub;
create schema if not exists net;
create table if not exists net.sent_log (id bigserial primary key, url text, body jsonb, at timestamptz default now());
create or replace function net.http_post(url text, body jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$
declare i bigint;
begin
  insert into net.sent_log (url, body) values (url, body) returning id into i;
  return i;
end $$;
grant usage on schema net, vault to postgres;
-- настоящая таблица связок Telegram появится в этапе 22б (в base.sql — упрощённая заглушка)
drop table if exists tg_links;
