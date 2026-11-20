#!/bin/bash
# Этап 54 (v180, Доп. 505): длинные столы вертикально на схеме зала — форма tall в floor_save (две клетки в глубину),
# признак tall: true в seat_board, _sa_floor_shapes для экрана «Сервер».
# Поверх базы run25.sh: копия satest54, этапы 26, 31, 32, 34, 35, 36, 37 и 54 (54 — дважды), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test54.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest54
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
BEFORE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql"
D=$(mktemp -d); for f in $BEFORE supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql supabase-stage54-tall-tables.sql; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT54=""
run() { local out; out=$($P0 -d $DB -f "$D/$1" 2>&1); local rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; LAST="$out"; }
for f in $BEFORE; do run "$f"; done
# без этапа 35 — просит его; без этапа 37 — просит его
NO35=$($P0 -d $DB -f "$D/supabase-stage54-tall-tables.sql" 2>&1)
run supabase-stage35-seating.sql; run supabase-stage36-comfort.sql
NO37=$($P0 -d $DB -f "$D/supabase-stage54-tall-tables.sql" 2>&1)
run supabase-stage37-halls-qday.sql
run supabase-stage54-tall-tables.sql
run supabase-stage54-tall-tables.sql; OUT54="$LAST"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2

chk "без этапа 35 — понятная ошибка: какой этап сначала" "$NO35" 'Сначала этап 35 \(supabase-stage35-seating.sql\)'
chk "без этапа 37 — понятная ошибка: какой этап сначала" "$NO37" 'Сначала этап 37 \(supabase-stage37-halls-qday.sql\)'
chk "этапы 26, 31, 32, 34, 35, 36, 37 и 54 (54 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: вертикальные столы, доска знает" "$OUT54" 'длинные столы вертикально: да · доска знает: да · схем заведений: 0'
$P -c "delete from sa_floor" >/dev/null

Z='[{"id":"z1","name":"Основной"},{"id":"z2","name":"Веранда"}]'
P2() { printf '{"v":2,"zones":%s,"tables":%s,"items":%s}' "$Z" "$1" "${2:-[]}"; }
SAVE() { Q "select floor_save('$MARIA', '$1'::jsonb)"; }
ERR() { Q "select floor_save('$MARIA', '$1'::jsonb)->>'error'"; }
T='[{"id":"t1","n":"1","seats":8,"shape":"tall","x":7,"y":0},{"id":"t2","n":"2","seats":6,"shape":"long","x":5,"y":0},{"id":"t3","n":"3","seats":2,"shape":"sq","x":7,"y":2},{"id":"t4","n":"4","seats":12,"shape":"tall","x":0,"y":28,"z":"z2"}]'
chk "вертикальный стол (две клетки в глубину) рядом с длинным и квадратным — сохранено" "$(SAVE "$(P2 "$T")")" '"ok": true'
chk "хранится форма tall, x и y как есть, зал" "$(PP "select string_agg((t->>'n') || ':' || (t->>'shape') || '@' || (t->>'x') || ':' || (t->>'y') || '@' || (t->>'z'), ',' order by t->>'n') from sa_floor, jsonb_array_elements(plan->'tables') t")" '^1:tall@7:0@z1,2:long@5:0@z1,3:sq@7:2@z1,4:tall@0:28@z2$'
chk "seat_board: floor 2 и tall true" "$(Q "select (x->>'floor') || ' ' || (x->>'tall') || ' ' || (x->'plan'->'tables'->0->>'shape') from seat_board('$ANNA') x")" '^2 true tall$'
chk "вертикальный стол в последнем ряду (y 29) — bad_plan" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":0,"y":29}]')")" '^bad_plan$'
chk "нижняя клетка вертикального стола на другом столе — overlap" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":3,"y":3},{"id":"t2","n":"2","seats":2,"shape":"sq","x":3,"y":4}]')")" '^overlap$'
chk "вертикальный на длинном — overlap" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":4,"y":0},{"id":"t2","n":"2","seats":6,"shape":"long","x":3,"y":1}]')")" '^overlap$'
chk "вертикальный на баре и на входе — overlap" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":0,"y":0}]' '[{"id":"i1","kind":"bar","x":0,"y":1,"w":3,"h":1}]')") $(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":5,"y":5}]' '[{"id":"i1","kind":"door","x":5,"y":6}]')")" '^overlap overlap$'
chk "вертикальные в разных залах на одних клетках — можно" "$(SAVE "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":2,"y":2},{"id":"t2","n":"2","seats":4,"shape":"tall","x":2,"y":3,"z":"z2"}]')")" '"ok": true'
chk "чужая форма (овал) — bad_plan" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"oval","x":0,"y":0}]')")" '^bad_plan$'
chk "длинный по-прежнему: x 7 — bad_plan, x 6 — можно" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"long","x":7,"y":0}]')") $(SAVE "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"long","x":6,"y":29}]')" | grep -o '"ok": true')" '^bad_plan "ok": true$'
V1='{"v":1,"tables":[{"id":"t1","n":"1","seats":2,"shape":"tall","x":0,"y":0}]}'
$P -c "delete from sa_floor" >/dev/null
chk "старое приложение (схема v1) тоже может сохранить вертикальный стол" "$(Q "select floor_save('$MARIA', '$V1'::jsonb)->>'ok'")|$(PP "select plan->'tables'->0->>'shape' from sa_floor")" '^true\|tall$'
chk "_sa_floor_shapes: формы стола; anon её не зовёт" "$(PP "select array_to_string(_sa_floor_shapes(), ',')") $(Q "select _sa_floor_shapes()" | grep -o 'permission denied' | head -1)" '^sq,rd,long,tall permission denied$'
chk "права: anon зовёт floor_save и seat_board" "$(PP "select has_function_privilege('anon', 'floor_save(text, jsonb)', 'execute')::text || ' ' || has_function_privilege('anon', 'seat_board(text)', 'execute')::text")" '^true true$'
chk "чужой токен и не руководитель — auth / forbidden" "$(Q "select floor_save('nope', '$V1'::jsonb)->>'error'") $(Q "select floor_save('$ANNA', '$V1'::jsonb)->>'error'")" '^auth forbidden$'
# этап 37 заново — признака нет; этап 54 после него — снова есть
$P0 -d $DB -f "$D/supabase-stage37-halls-qday.sql" >/dev/null 2>&1
A37=$(Q "select coalesce(x->>'tall', 'нет') from seat_board('$ANNA') x")
$P0 -d $DB -f "$D/supabase-stage54-tall-tables.sql" >/dev/null 2>&1
chk "этап 37 заново снимает вертикальные столы, этап 54 после него — возвращает" "$A37 $(Q "select x->>'tall' from seat_board('$ANNA') x")" '^нет true$'

echo "итог: $pass ✓, $fail ✗"
[ "$fail" -eq 0 ]
