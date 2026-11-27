#!/bin/bash
# Сборка базы с нуля из репозитория: макет Supabase (supabase-mock.sql) → все этапы по порядку из таблицы
# supabase/README.md (от этапа 1 до последнего). Останавливается на первой ошибке и называет файл.
# В конце — снимок устройства базы (full-snapshot.sql) в файл: его сравнивают со снимком рабочей базы (full-compare.py).
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash full-build.sh [имя_базы] [файл_снимка]
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=${1:-safull}; SNAP=${2:-/tmp/$DB-snapshot.json}
P="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
D=$(mktemp -d); cp "$SRC"/*.sql "$HERE/supabase-mock.sql" "$HERE/full-snapshot.sql" "$D"/; chmod -R a+r "$D"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null || exit 1
$P -d postgres -c "alter database $DB set search_path = \"\$user\", public, extensions" >/dev/null || exit 1
$P -d $DB -f "$D/supabase-mock.sql" >/dev/null 2>&1 || { echo "макет Supabase не встал"; exit 1; }
FILES=$(grep -oE '^\| *[0-9]+[а-яa-z]? *\| *`[^`]+\.sql`' "$SRC/README.md" | sed -E 's/^[^`]*`([^`]+)`/\1/')
n=0
for f in $FILES; do
  out=$($P -d $DB -f "$D/$f" 2>&1); rc=$?
  n=$((n + 1))
  if [ $rc -ne 0 ]; then echo "✗ $f — ошибка:"; echo "$out" | grep -iE "error|ошибк" | head -5; exit 1; fi
done
echo "✓ этапов по порядку из README: $n — без ошибок"
psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q -t -A -d $DB -f "$D/full-snapshot.sql" > "$SNAP" || { echo "снимок не снялся"; exit 1; }
echo "снимок: $SNAP"
