#!/bin/bash
# Этап 66 (Доп. 529): порядок в базе. Поверх базы run25.sh (копия satest66) — как на рабочей базе: шесть старых таблиц
# открыты на чтение (profiles и на запись), лишние правила allow_all / sa_read_<таблица>, служебные функции открыты
# наружу, функции без search_path, макет pg_cron. Этап 66 дважды: таблицы закрыты, правила убраны, приложение читает через
# функции этапа 21, служебные функции снаружи не позвать (кроме тех, что зовёт открытая функция с правами вызывающего),
# search_path у всех, журнал расписания — 14 дней. Страховки: без этапа 21, функция с правами вызывающего на старых
# таблицах. Без pg_cron. Откат и снова этап 66.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test66.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest66
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S66=supabase-stage66-order.sql; R66=supabase-stage66-rollback.sql
D=$(mktemp -d); cp "$SRC/$S66" "$SRC/$R66" "$HERE/base.sql" "$D/"; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
LINE() { echo "$OUT" | grep -o "$1.*" | head -1; }

# ── Как на рабочей базе ──────────────────────────────────────────────────────────────────────────────────────────
SETUP="
do \$\$ declare t text; begin
  foreach t in array array['profiles','progress','quiz_done','practice_stars','completed_roles','scores'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
    execute format('grant select on %I to anon, authenticated', t);
    execute format('create policy sa_read on %I for select to anon, authenticated using (true)', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', 'sa_read_' || t, t);
  end loop;
  foreach t in array array['progress','quiz_done','scores'] loop
    execute format('create policy allow_all on %I for all to public using (true) with check (true)', t);
  end loop;
end \$\$;
grant insert, update on profiles to anon, authenticated;
create policy sa_write on profiles for insert to anon, authenticated with check (true);
create policy sa_update on profiles for update to anon, authenticated using (true) with check (true);
create or replace function _sa_identity(p_token uuid) returns jsonb language sql stable security definer set search_path to public
  as \$f\$ select to_jsonb(whoami(p_token)) \$f\$;
create or replace function _cms_actor(p_token uuid) returns employees language sql stable security definer
  as \$f\$ select e.* from employees e join sessions s on s.employee_id = e.id where s.token = p_token \$f\$;
create or replace function _cms_can_edit(a employees) returns boolean language sql stable as \$f\$ select a.id is not null and coalesce(a.is_admin, false) \$f\$;
create or replace function _sa_hh(p numeric) returns text language sql immutable as \$f\$ select lpad(p::int::text, 2, '0') \$f\$;
create or replace function _probe_helper(p text) returns text language sql immutable as \$f\$ select upper(p) \$f\$;
create or replace function probe_open(p text) returns text language sql stable as \$f\$ select _probe_helper(p) \$f\$;
create or replace function np_probe() returns int language sql immutable as \$f\$ select 42 \$f\$;
create or replace function np_bytes() returns int language sql volatile security definer as \$f\$ select length(gen_random_bytes(8)) \$f\$;
create or replace function achievements_list(p_restaurant text) returns jsonb language sql stable security definer set search_path to public
  as \$f\$ select '[]'::jsonb \$f\$;
"
CRON="
create schema if not exists cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true);
create table cron.job_run_details (runid bigserial, jobid bigint, start_time timestamptz, end_time timestamptz, status text);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as \$f\$
declare id bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid into id;
  return id;
end \$f\$;
create or replace function cron.unschedule(job_name text) returns boolean language plpgsql as \$f\$
begin delete from cron.job where jobname = job_name; return found; end \$f\$;
"
PP "$SETUP" >/dev/null; PP "$CRON" >/dev/null
chk "до этапа: anon читает scores и пишет в profiles, служебные функции открыты" \
  "$(Q "select count(*) >= 0 from scores") $(Q "insert into profiles (name) values ('x') returning 'ins'") $(Q "select (_cms_actor('$ANNA')).name")" '^t ins Анна$'

# ── Страховка: без этапа 21 ──────────────────────────────────────────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}x" -c "create database ${DB}x" >/dev/null 2>&1
$P0 -d ${DB}x -f "$D/base.sql" >/dev/null 2>&1
chk "без этапа 21 — «Сначала этап 21»" "$($P0 -d ${DB}x -f "$D/$S66" 2>&1 | grep -o 'Сначала этап 21[^:]*' | head -1)" '^Сначала этап 21 \(supabase-stage21-private-data.sql\)$'
$P0 -d postgres -c "drop database if exists ${DB}x" >/dev/null 2>&1

# ── Страховка: функция с правами вызывающего на старых таблицах ──────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}y" -c "create database ${DB}y template $DB" >/dev/null 2>&1
psql -h $PGH -p $PGP -U postgres -q -d ${DB}y -c "create function bad_reader() returns bigint language sql as 'select count(*) from scores'" >/dev/null 2>&1
chk "функция с правами вызывающего читает scores — ничего не закрываю, называю её" \
  "$($P0 -d ${DB}y -f "$D/$S66" 2>&1 | grep -o 'Не закрываю: .*' | head -1) $(psql -h $PGH -p $PGP -U postgres -q -t -A -d ${DB}y -c "set role anon; select count(*) >= 0 from scores" 2>&1)" \
  '^Не закрываю: эти функции работают с правами вызывающего и трогают старые таблицы — bad_reader\(\) t$'
$P0 -d postgres -c "drop database if exists ${DB}y" >/dev/null 2>&1

# ── Этап 66 дважды ────────────────────────────────────────────────────────────────────────────────────────────────
RC=0; run $S66; run $S66
chk "этап 66 дважды — без ошибок, итог" "$RC $(LINE 'порядок в базе, этап 66')" \
  '^0 порядок в базе, этап 66: старые таблицы закрыты 6 из 6 · служебные функции снаружи: только _probe_helper \(их зовут открытые функции\) · без search_path: 0 · журнал расписания: хранится 14 дней$'

chk "anon не читает старые таблицы" "$(Q "select count(*) from scores") | $(Q "select count(*) from progress") | $(Q "select count(*) from profiles")" \
  'permission denied for table scores.*\| .*permission denied for table progress.*\| .*permission denied for table profiles'
chk "anon не пишет в profiles" "$(Q "insert into profiles (name) values ('y')")" 'permission denied for table profiles'
chk "старых разрешающих правил на шести таблицах нет" \
  "$(PP "select count(*) from pg_policies where schemaname = 'public' and tablename in ('profiles','progress','quiz_done','practice_stars','completed_roles','scores')")" '^0$'
chk "RLS на шести таблицах включён" \
  "$(PP "select count(*) from pg_class where relname in ('profiles','progress','quiz_done','practice_stars','completed_roles','scores') and relrowsecurity")" '^6$'
chk "service_role по-прежнему читает profiles (напоминание о смене)" "$(PP "select has_table_privilege('service_role', 'profiles', 'select')")" '^t$'
chk "приложение: team_scores по токену работает у anon" "$(Q "select team_scores('$ANNA')->>'ok'")" '^true$'
chk "приложение: whoami по токену работает у anon" "$(Q "select (whoami('$ANNA')::jsonb)->>'ok'")" '^true$'
chk "achievements_list по названию ресторана закрыт" "$(Q "select achievements_list('Порт')")" 'permission denied for function achievements_list'
chk "служебные функции снаружи не позвать" \
  "$(Q "select _cms_actor('$ANNA')") | $(Q "select _sa_identity('$ANNA')") | $(Q "select _sa_hh(5)")" \
  'permission denied for function _cms_actor.*\| .*permission denied for function _sa_identity.*\| .*permission denied for function _sa_hh'
chk "служебную функцию, которую зовёт открытая функция с правами вызывающего, не трогаем" "$(Q "select probe_open('ok')")" '^OK$'
chk "функции базы по-прежнему зовут служебные: whoami через _sa_identity изнутри" \
  "$(PP "select _sa_identity('$ANNA')->>'ok'")" '^true$'
chk "search_path у всех функций, где не было — public, extensions" \
  "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')") $(PP "select array_to_string(proconfig, ';') from pg_proc where proname = 'np_probe'") $(PP "select array_to_string(proconfig, ';') from pg_proc where proname = 'team_scores'")" \
  '^0 search_path=public, extensions search_path=public$'
chk "функции работают с закреплённым search_path (в том числе pgcrypto без схемы)" "$(PP "select np_probe(), np_bytes()")" '^42\|8$'
chk "журнал расписания: задача раз в сутки" "$(PP "select schedule || ' | ' || command from cron.job where jobname = 'sa-cron-clean'")" \
  "^17 4 \* \* \* \| delete from cron.job_run_details where end_time < now\(\) - interval '14 days'$"
PP "insert into cron.job_run_details (jobid, start_time, end_time, status) values (1, now() - interval '20 days', now() - interval '20 days', 'succeeded'), (1, now() - interval '1 day', now() - interval '1 day', 'succeeded')" >/dev/null
PP "$(PP "select command from cron.job where jobname = 'sa-cron-clean'")" >/dev/null
chk "чистка журнала: старше 14 дней — удалено, свежее — осталось" "$(PP "select count(*) from cron.job_run_details")" '^1$'
chk "задача одна, повтор этапа её не множит" "$(PP "select count(*) from cron.job where jobname = 'sa-cron-clean'")" '^1$'

# ── Без pg_cron ───────────────────────────────────────────────────────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}z" -c "create database ${DB}z template satest25" >/dev/null 2>&1
psql -h $PGH -p $PGP -U postgres -q -d ${DB}z -c "$SETUP" >/dev/null 2>&1
chk "без pg_cron — шаг пропущен, остальное сделано" "$($P0 -d ${DB}z -f "$D/$S66" 2>&1 | grep -o 'порядок в базе, этап 66: .*' | head -1)" \
  '^порядок в базе, этап 66: старые таблицы закрыты 6 из 6 · служебные функции снаружи: только _probe_helper \(их зовут открытые функции\) · без search_path: 0 · журнал расписания: нет pg_cron$'
$P0 -d postgres -c "drop database if exists ${DB}z" >/dev/null 2>&1

# ── Откат и снова этап 66 ─────────────────────────────────────────────────────────────────────────────────────────
RC=0; run $R66
chk "откат: таблицы снова открыты на чтение, служебные функции — снаружи, чистки журнала нет" \
  "$RC $(LINE 'откат этапа 66') | $(Q "select count(*) >= 0 from scores") $(Q "select (_cms_actor('$ANNA')).name") $(Q "select insert_ok from (select 1) x, lateral (select 'w' as insert_ok) y") $(PP "select count(*) from cron.job where jobname = 'sa-cron-clean'")" \
  '^0 откат этапа 66: старые таблицы снова открыты на чтение — 6 · чтобы снова закрыть — этап 66 \| t Анна w 0$'
chk "откат: profiles снова на запись" "$(Q "insert into profiles (name) values ('z') returning 'ins'")" '^ins$'
RC=0; run $S66
chk "снова этап 66 — снова закрыто" "$RC $(Q "select count(*) from scores") $(LINE 'порядок в базе, этап 66')" \
  '^0 .*permission denied for table scores.* порядок в базе, этап 66: старые таблицы закрыты 6 из 6'

echo "проверок: $((pass + fail)), ✓ $pass, ✗ $fail"
[ "$fail" = 0 ]
