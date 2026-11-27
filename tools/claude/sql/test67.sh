#!/bin/bash
# Этап 67 (v211, Доп. 537): КБЖУ заведения — в базе, а не в коде приложения.
# Поверх базы run25.sh (этапы 11c и 21, сотрудники «Два моря, Океан» и «Порт»): копия satest67, этапы меню, 26, 29,
# 52, 61, 8, 8b, 28 и 62 — как у test62.sh. Без этапа 62 — понятная ошибка. Этап дважды. Таблица закрыта, читать —
# только nutrition_get: без входа и уволенному — auth; своё заведение — всем, кто вошёл (пусто, пока ведомости нет);
# чужое — только сети (владелец, старший), остальным forbidden. После загрузки — строки, решения владельца, хвосты.
# Переименование заведения (этап 61) уносит и таблицу. Права и search_path у функции.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test67.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest67
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S67=supabase-stage67-nutrition.sql
PRE="menu-server-stage4.sql supabase-stage26-mastery.sql supabase-stage29-bot-texts.sql supabase-stage52-staff-photos.sql supabase-stage61-places.sql supabase-stage8-candidates.sql supabase-stage8b-hire-access.sql supabase-stage28-ai-hr.sql supabase-stage62-venue-walls.sql"
D=$(mktemp -d); for f in $PRE $S67; do cp "$SRC/$f" "$D/"; done; cp "$HERE/base.sql" "$D/"; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; OLEG=10000000-0000-0000-0000-0000000000a6
IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
# ответ коротко: ok/ошибка · заведение · строк · решений · хвостов
NG() { Q "with x as (select nutrition_get('$1', $2) j)
  select coalesce(j->>'error', 'ok') || ' · ' || coalesce(j->>'restaurant', '—') || ' · ' || coalesce(jsonb_array_length(j->'rows'), -1)
    || ' · ' || coalesce((select count(*) from jsonb_object_keys(j->'alias')), -1) || ' · ' || coalesce(jsonb_array_length(j->'tails'), -1) from x"; }

# ── Без этапа 62 — понятная ошибка ─────────────────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}x" -c "create database ${DB}x" >/dev/null 2>&1
$P0 -d ${DB}x -f "$D/base.sql" >/dev/null 2>&1
chk "без этапа 62: «Сначала этап 62»" "$($P0 -d ${DB}x -f "$D/$S67" 2>&1 | grep -o 'Сначала этап 62[^:]*' | head -1)" '^Сначала этап 62 \(supabase-stage62-venue-walls.sql\)$'
$P0 -d postgres -c "drop database if exists ${DB}x" >/dev/null 2>&1

for f in $PRE; do run $f; done
chk "этапы меню, 26, 29, 52, 61, 8, 8b, 28, 62 — без ошибок" "$RC" '^0$'

# ── Этап 67 дважды ─────────────────────────────────────────────────────────────────────────────
RC=0; run $S67
chk "этап 67: итог" "$(echo "$OUT" | grep -o 'КБЖУ заведений: .*' | head -1 | sed 's/[[:space:]]*$//')" \
  '^КБЖУ заведений: таблица закрыта, чтение — nutrition_get · с ведомостью: 0$'
run $S67
chk "этап 67 ещё раз — без ошибок" "$RC" '^0$'

# ── Доступ ─────────────────────────────────────────────────────────────────────────────────────
chk "таблица закрыта для ключа приложения" "$(Q "select count(*) from sa_nutrition")" 'permission denied'
chk "без входа — auth" "$(NG x null)" '^auth · '
chk "уволенному — auth" "$(NG $OLEG null)" '^auth · '
chk "своё заведение, ведомости ещё нет — пусто" "$(NG $ANNA null)" '^ok · Два моря, Океан · 0 · 0 · 0$'

# ── Ведомость загружена (как владелец загрузит её отдельно) ────────────────────────────────────
PP "insert into sa_nutrition (restaurant, items, alias, tails, source, updated_by) values ('Два моря, Океан',
  '[{\"n\":\"Уха по-царски\",\"out\":350,\"kcal\":280,\"p\":21,\"f\":12,\"c\":18},{\"n\":\"Салат с крабом\",\"out\":200,\"kcal\":310,\"p\":15,\"f\":20,\"c\":12}]',
  '{\"уха царская\":\"Уха по-царски\"}', '[\"зал блюдо\"]', 'проверка', 'test67')" >/dev/null
chk "официант, своё — строки, решения, хвосты" "$(NG $ANNA null)" '^ok · Два моря, Океан · 2 · 1 · 1$'
chk "официант, своё по названию — то же" "$(NG $ANNA "'Два моря, Океан'")" '^ok · Два моря, Океан · 2 · 1 · 1$'
chk "менеджер своего — то же" "$(NG $PETR null)" '^ok · Два моря, Океан · 2 · 1 · 1$'
chk "официант — чужое заведение нельзя" "$(NG $ANNA "'Порт'")" '^forbidden · '
chk "официант «Порта» — чужое нельзя" "$(NG $IVAN "'Два моря, Океан'")" '^forbidden · '
chk "менеджер «Порта» — своё пустое" "$(NG $IRINA null)" '^ok · Порт · 0 · 0 · 0$'
chk "владелец (сеть) — любое" "$(NG $ROMAN "'Порт'") / $(NG $ROMAN "'Два моря, Океан'")" '^ok · Порт · 0 · 0 · 0 / ok · Два моря, Океан · 2 · 1 · 1$'
chk "старший (сеть) — любое" "$(NG $MARIA "'Два моря, Океан'")" '^ok · Два моря, Океан · 2 · 1 · 1$'
chk "строка ведомости целиком" "$(Q "select nutrition_get('$ANNA')->'rows'->0->>'n' || ' ' || (nutrition_get('$ANNA')->'rows'->0->>'kcal')")" '^Уха по-царски 280$'

# ── Переименование заведения уносит ведомость ──────────────────────────────────────────────────
chk "владелец переименовал заведение" "$(Q "select org_venue_save('$ROMAN', 'Два моря, Океан', 'Маяк')->>'done'")" '^renamed$'
chk "ведомость — у нового названия" "$(NG $ANNA null)" '^ok · Маяк · 2 · 1 · 1$'
chk "у старого названия ничего" "$(PP "select count(*) from sa_nutrition where restaurant = 'Два моря, Океан'")" '^0$'

# ── Права и search_path ────────────────────────────────────────────────────────────────────────
chk "функция: security definer, search_path, ключу приложения можно" \
  "$(PP "select p.prosecdef || ' ' || array_to_string(p.proconfig, ',') || ' ' || has_function_privilege('anon', p.oid, 'execute') from pg_proc p where p.proname = 'nutrition_get'")" \
  '^true search_path=public true$'
chk "в итоге этапа — заведений с ведомостью: 1" "$($P0 -d $DB -f "$D/$S67" 2>&1 | grep -o 'с ведомостью: [0-9]*' | head -1)" '^с ведомостью: 1$'

echo
echo "проверок: $((pass + fail)), ✓ $pass, ✗ $fail"
[ $fail -eq 0 ]
