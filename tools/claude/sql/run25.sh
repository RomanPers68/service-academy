#!/bin/bash
# Этап 25 на локальном PostgreSQL (макет Supabase): создаёт базу satest25 и применяет этапы.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
D=$(mktemp -d); cp "$SRC"/*.sql "$HERE"/base.sql "$HERE"/seed.sql "$HERE"/seed24.sql "$HERE"/seed25.sql "$HERE"/stub-tg.sql "$D"/; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists satest25" -c "create database satest25" >/dev/null
run() { out=$($P -d satest25 -f "$D/$1" 2>&1); rc=$?; echo "── $1 (rc=$rc)"; echo "$out" | grep -v "^NOTICE\|^$\|^psql.*NOTICE" | grep -iE "error|warn|функций|result|отчёты|вместе|академия|из " | head -6; }
run base.sql
run supabase-stage11c-whoami-fix.sql
run supabase-stage7-quiz-analytics.sql
run supabase-stage15-quiz-retries.sql
run supabase-stage9-schedule.sql
run supabase-stage21-private-data.sql
run supabase-stage22-hall-confirm.sql
run stub-tg.sql
run supabase-stage22b-telegram-reminders.sql
run seed.sql
run supabase-stage23-reports.sql
run supabase-stage24-together.sql
run supabase-stage25-live.sql
run supabase-stage25-live.sql
run seed24.sql
run seed25.sql
