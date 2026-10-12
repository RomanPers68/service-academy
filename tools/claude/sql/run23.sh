#!/bin/bash
# Этап 23 на локальном PostgreSQL (макет Supabase): создаёт базу satest23 и применяет этапы.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
D=$(mktemp -d); cp "$SRC"/*.sql "$HERE"/base.sql "$HERE"/seed.sql "$HERE"/seed24.sql "$D"/; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists satest23" -c "create database satest23" >/dev/null
run() { out=$($P -d satest23 -f "$D/$1" 2>&1); rc=$?; echo "── $1 (rc=$rc)"; echo "$out" | grep -v "^NOTICE\|^$\|^psql.*NOTICE" | grep -iE "error|warn|функций|result|отчёты|из " | head -6; }
run base.sql
run supabase-stage11c-whoami-fix.sql
run supabase-stage7-quiz-analytics.sql
run supabase-stage15-quiz-retries.sql
run supabase-stage21-private-data.sql
run supabase-stage22-hall-confirm.sql
run seed.sql
run supabase-stage23-reports.sql
run supabase-stage23-reports.sql
