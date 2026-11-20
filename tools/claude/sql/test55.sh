#!/bin/bash
# Этап 55 (v183, Доп. 508): стулья по сторонам стола и диван — sides в floor_save, признак sides: true в seat_board,
# _sa_floor_sides для экрана «Сервер».
# Поверх базы run25.sh: копия satest55, этапы 26, 31, 32, 34, 35, 36, 37, 54 и 55 (55 — дважды), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test55.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest55
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
BEFORE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql"
D=$(mktemp -d); for f in $BEFORE supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql supabase-stage54-tall-tables.sql supabase-stage55-chair-sides.sql; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT55=""
run() { local out; out=$($P0 -d $DB -f "$D/$1" 2>&1); local rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; LAST="$out"; }
for f in $BEFORE; do run "$f"; done
run supabase-stage35-seating.sql; run supabase-stage36-comfort.sql; run supabase-stage37-halls-qday.sql
# без этапа 54 — просит его
NO54=$($P0 -d $DB -f "$D/supabase-stage55-chair-sides.sql" 2>&1)
run supabase-stage54-tall-tables.sql
run supabase-stage55-chair-sides.sql
run supabase-stage55-chair-sides.sql; OUT55="$LAST"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2

chk "без этапа 54 — понятная ошибка: какой этап сначала" "$NO54" 'Сначала этап 54 \(supabase-stage54-tall-tables.sql\)'
chk "этапы 26, 31, 32, 34, 35, 36, 37, 54 и 55 (55 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: стулья по сторонам, доска знает, вертикальные на месте" "$OUT55" 'стулья по сторонам: да · доска знает: да · вертикальные столы: да · схем заведений: 0'
$P -c "delete from sa_floor" >/dev/null

Z='[{"id":"z1","name":"Основной"}]'
P2() { printf '{"v":2,"sides":true,"zones":%s,"tables":%s,"items":[]}' "$Z" "$1"; }
OLD() { printf '{"v":2,"zones":%s,"tables":%s,"items":[]}' "$Z" "$1"; }   # приложение до v183: без признака sides
SAVE() { Q "select floor_save('$MARIA', '$1'::jsonb)"; }
ERR() { Q "select floor_save('$MARIA', '$1'::jsonb)->>'error'"; }
SIDES() { PP "select coalesce(string_agg((t->>'n') || '=' || coalesce(t->>'sides', '-'), ' ' order by t->>'n'), '') from sa_floor, jsonb_array_elements(plan->'tables') t"; }
# стол 1: два стула сверху, диван снизу на двоих (4 места); 6: стул слева, диван справа (2); 3: длинный, 3 сверху, диван 3 снизу
T='[{"id":"t1","n":"1","seats":4,"shape":"long","x":0,"y":0,"sides":[2,-2,0,0]},{"id":"t2","n":"6","seats":2,"shape":"sq","x":3,"y":0,"sides":[0,0,1,-1]},{"id":"t3","n":"3","seats":6,"shape":"long","x":4,"y":0,"sides":[3,-3,0,0]},{"id":"t4","n":"19","seats":8,"shape":"tall","x":7,"y":0,"sides":[0,0,4,4]},{"id":"t5","n":"15","seats":5,"shape":"rd","x":0,"y":2}]'
chk "стулья по сторонам и диваны — сохранено" "$(SAVE "$(P2 "$T")")" '"ok": true'
chk "хранится sides как прислали; у круглого и стола без sides — нет" "$(SIDES)" '^1=\[2, -2, 0, 0\] 15=- 19=\[0, 0, 4, 4\] 3=\[3, -3, 0, 0\] 6=\[0, 0, 1, -1\]$'
chk "seat_board: floor 2, tall true, sides true; стол с sides — как сохранён" "$(Q "select (x->>'floor') || ' ' || (x->>'tall') || ' ' || (x->>'sides') || ' ' || (x->'plan'->'tables'->0->>'sides') from seat_board('$ANNA') x")" '^2 true true \[2, -2, 0, 0\]$'
chk "числа строкой («2») — хранятся числами" "$(SAVE "$(P2 '[{"id":"t1","n":"1","seats":3,"shape":"sq","x":0,"y":0,"sides":["2","0","1","0"]}]')" | grep -o '"ok": true') $(PP "select plan->'tables'->0->'sides' from sa_floor")" '^"ok": true \[2, 0, 1, 0\]$'
chk "мест по сторонам не столько, сколько seats — bad_plan" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":5,"shape":"sq","x":0,"y":0,"sides":[2,0,1,0]}]')")" '^bad_plan$'
chk "у круглого sides — bad_plan" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"rd","x":0,"y":0,"sides":[1,1,1,1]}]')")" '^bad_plan$'
chk "квадрат: 4 на сторону — bad_plan; 3 — можно" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0,"sides":[4,0,0,0]}]')") $(SAVE "$(P2 '[{"id":"t1","n":"1","seats":3,"shape":"sq","x":0,"y":0,"sides":[-3,0,0,0]}]')" | grep -o '"ok": true')" '^bad_plan "ok": true$'
chk "длинный: вдоль 9 — bad_plan, у торца 3 — bad_plan; вдоль 8 и торцы по 2 — можно" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":9,"shape":"long","x":0,"y":0,"sides":[9,0,0,0]}]')") $(ERR "$(P2 '[{"id":"t1","n":"1","seats":3,"shape":"long","x":0,"y":0,"sides":[0,0,3,0]}]')") $(SAVE "$(P2 '[{"id":"t1","n":"1","seats":20,"shape":"long","x":0,"y":0,"sides":[8,-8,2,-2]}]')" | grep -o '"ok": true')" '^bad_plan bad_plan "ok": true$'
chk "вертикальный — наоборот: сверху 3 — bad_plan, слева 8 — можно" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":3,"shape":"tall","x":0,"y":0,"sides":[3,0,0,0]}]')") $(SAVE "$(P2 '[{"id":"t1","n":"1","seats":10,"shape":"tall","x":0,"y":0,"sides":[1,1,8,0]}]')" | grep -o '"ok": true')" '^bad_plan "ok": true$'
chk "не массив, не 4 стороны, дробь, буквы — bad_plan" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0,"sides":"2,0,0,0"}]')") $(ERR "$(P2 '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0,"sides":[2,0,0]}]')") $(ERR "$(P2 '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0,"sides":[1.5,0.5,0,0]}]')") $(ERR "$(P2 '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0,"sides":["a",2,0,0]}]')")" '^bad_plan bad_plan bad_plan bad_plan$'
chk "sides: null — стол без стульев по сторонам" "$(SAVE "$(P2 '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0,"sides":null}]')" | grep -o '"ok": true') $(SIDES)" '^"ok": true 1=-$'
# старое приложение: не шлёт sides — у тех же столов (id, форма, места) sides остаются; поменял места или форму — нет
$P -c "delete from sa_floor" >/dev/null
SAVE "$(P2 "$T")" >/dev/null
T_OLD='[{"id":"t1","n":"1","seats":4,"shape":"long","x":0,"y":1},{"id":"t2","n":"6","seats":3,"shape":"sq","x":3,"y":0},{"id":"t3","n":"3","seats":6,"shape":"sq","x":4,"y":0},{"id":"t4","n":"19","seats":8,"shape":"tall","x":7,"y":0},{"id":"t5","n":"15","seats":5,"shape":"rd","x":0,"y":2}]'
chk "старое приложение сохраняет схему — стулья по сторонам у тех же столов остаются, у изменённых — нет" "$(SAVE "$(OLD "$T_OLD")" | grep -o '"ok": true') $(SIDES)" '^"ok": true 1=\[2, -2, 0, 0\] 15=- 19=\[0, 0, 4, 4\] 3=- 6=-$'
# новое приложение (sides: true) без sides у стола — «как по местам», прежние не возвращаются
chk "новое приложение без sides у стола — стулья по местам (прежние не возвращаются)" "$(SAVE "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"long","x":0,"y":1}]')" | grep -o '"ok": true') $(SIDES)" '^"ok": true 1=-$'
chk "проверки этапа 54 на месте: вертикальный в последнем ряду — bad_plan, на столе — overlap" "$(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":0,"y":29}]')") $(ERR "$(P2 '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":3,"y":3},{"id":"t2","n":"2","seats":2,"shape":"sq","x":3,"y":4}]')")" '^bad_plan overlap$'
chk "_sa_floor_sides: сколько на сторону; anon её не зовёт" "$(PP "select array_to_string(_sa_floor_sides(), ',')") $(Q "select _sa_floor_sides()" | grep -o 'permission denied' | head -1)" '^3,8,2 permission denied$'
chk "права: anon зовёт floor_save и seat_board" "$(PP "select has_function_privilege('anon', 'floor_save(text, jsonb)', 'execute')::text || ' ' || has_function_privilege('anon', 'seat_board(text)', 'execute')::text")" '^true true$'
chk "чужой токен и не руководитель — auth / forbidden" "$(Q "select floor_save('nope', '$(P2 "$T")'::jsonb)->>'error'") $(Q "select floor_save('$ANNA', '$(P2 "$T")'::jsonb)->>'error'")" '^auth forbidden$'
# этап 54 заново — признака нет; этап 55 после него — снова есть
$P0 -d $DB -f "$D/supabase-stage54-tall-tables.sql" >/dev/null 2>&1
A54=$(Q "select coalesce(x->>'sides', 'нет') from seat_board('$ANNA') x")
$P0 -d $DB -f "$D/supabase-stage55-chair-sides.sql" >/dev/null 2>&1
chk "этап 54 заново снимает стулья по сторонам, этап 55 после него — возвращает" "$A54 $(Q "select x->>'sides' from seat_board('$ANNA') x")" '^нет true$'

echo "итог: $pass ✓, $fail ✗"
[ "$fail" -eq 0 ]
