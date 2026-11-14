#!/bin/bash
# Этап 52 (v158, Доп. 483; v160: должность в списке): фото сотрудников — staff_photos, staff_photo, staff_photo_set, staff_photo_del.
# Поверх базы run25.sh: копия satest52, этап 52 дважды; своё фото ставит и убирает сам сотрудник, чужое — кому можно
# трогать данные сотрудника (руководитель — у своего заведения, сеть — у любого); список на всю сеть без уволенных; превью
# пачкой до 24 и одно фото целиком; замена (новая версия, одна строка), проверка фото, служебная _sa_sp_person закрыта.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test52.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest52
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S52=supabase-stage52-staff-photos.sql
D=$(mktemp -d); cp "$SRC/$S52" "$D/"; chmod -R a+r "$D"
RC=0; OUT52=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT52="$out"; }
run $S52; run $S52
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:500}"; fail=$((fail+1)); fi; }
# входы (sessions) и сами сотрудники (employees)
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; OLEG=10000000-0000-0000-0000-0000000000a6
IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
eANNA=00000000-0000-0000-0000-0000000000a4; eILYA=00000000-0000-0000-0000-0000000000a5; eOLEG=00000000-0000-0000-0000-0000000000a6
eIVAN=00000000-0000-0000-0000-0000000000b2; eIRINA=00000000-0000-0000-0000-0000000000b1; eROMAN=00000000-0000-0000-0000-0000000000a1
F1=$(printf 'QUJD%.0s' $(seq 1 60)); F2=$(printf 'R0hJ%.0s' $(seq 1 70)); T1=$(printf 'REVG%.0s' $(seq 1 30))
IDS() { Q "select coalesce(string_agg(x->>'id', ',' order by x->>'id'), '') from jsonb_array_elements(staff_photos('$1')->'items') x"; }

chk "этап 52 дважды — без ошибок" "$RC" '^0$'
chk "итог этапа: 4 функции, фото 0" "$(echo "$OUT52" | grep -o 'фото сотрудников: .*' | head -1)" '^фото сотрудников: 4 функции из 4 · фото: 0'
chk "функции с проверкой входа — VOLATILE" \
  "$(PP "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname like 'staff_photo%'")" \
  '^staff_photo:v,staff_photo_del:v,staff_photo_set:v,staff_photos:v$'
chk "служебная _sa_sp_person — не для anon" "$(Q "select _sa_sp_person('$eANNA')" | grep -c 'permission denied')" '^1$'
chk "без входа — auth" "$(Q "select staff_photos('нет')->>'error'") $(Q "select staff_photo('нет', array['$eANNA'])->>'error'") $(Q "select staff_photo_set('нет', null, '$F1', '$T1')->>'error'") $(Q "select staff_photo_del('нет')->>'error'")" '^auth auth auth auth$'
chk "уволенный Олег — auth" "$(Q "select staff_photos('$OLEG')->>'error'") $(Q "select staff_photo_set('$OLEG', null, '$F1', '$T1')->>'error'")" '^auth auth$'

# ── своё фото
chk "пусто: список пуст, я — Анна" "$(Q "select staff_photos('$ANNA')->>'items'") $(Q "select staff_photos('$ANNA')->>'me'")" "^\[\] $eANNA\$"
VA=$(Q "select staff_photo_set('$ANNA', null, '$F1', '$T1')->>'ver'")
chk "Анна ставит своё фото — версия" "$VA" '^[0-9a-f]{12}$'
chk "кому поставлено — сама Анна" "$(Q "select staff_photo_set('$ANNA', '', '$F1', '$T1')->>'id'") $(Q "select staff_photo_set('$ANNA', '$eANNA', '$F1', '$T1')->>'id'")" "^$eANNA $eANNA\$"
chk "в таблице одна строка, кто поставил — имя" "$(PP "select count(*) || ' ' || max(by_name) from sa_staff_photos")" '^1 Анна Смирнова$'
chk "в списке: номер, имя, фамилия, заведение, версия" "$(Q "select x->>'id' || '|' || (x->>'name') || '|' || (x->>'surname') || '|' || (x->>'restaurant') || '|' || (x->>'ver') from jsonb_array_elements(staff_photos('$ANNA')->'items') x")" "^$eANNA\|Анна\|Смирнова\|Два моря, Океан\|$VA\$"
# v160 (Доп. 485): должность в списке — подпись под фото крупно («Официант · Океан»)
chk "v160: в списке должность, строчными" "$(Q "select x->>'position' from jsonb_array_elements(staff_photos('$ANNA')->'items') x where x->>'id' = '$eANNA'")" '^waiter$'
chk "что можно: Анна — никто, Пётр — руководитель, Роман и Мария — сеть" \
  "$(Q "select staff_photos('$ANNA')->'can'") $(Q "select staff_photos('$PETR')->'can'") $(Q "select staff_photos('$ROMAN')->'can'") $(Q "select staff_photos('$MARIA')->'can'")" \
  '"lead": false, "network": false.*"lead": true, "network": false.*"lead": true, "network": true.*"lead": true, "network": true'
chk "своё заведение в ответе" "$(Q "select staff_photos('$IVAN')->>'restaurant'")" '^Порт$'

# ── чужое фото: права
chk "Анна ставит Илье — forbidden" "$(Q "select staff_photo_set('$ANNA', '$eILYA', '$F1', '$T1')->>'error'")" '^forbidden$'
chk "Анна убирает у Ильи — forbidden" "$(Q "select staff_photo_del('$ANNA', '$eILYA')->>'error'")" '^forbidden$'
chk "Пётр (руководитель «Океана») ставит Илье — можно" "$(Q "select staff_photo_set('$PETR', '$eILYA', '$F2', '$T1')->>'ok'")" '^true$'
chk "кто поставил Илье — Пётр" "$(PP "select by_name from sa_staff_photos where emp_id = '$eILYA'")" '^Пётр Иванов$'
chk "Пётр ставит Ивану («Порт») — forbidden" "$(Q "select staff_photo_set('$PETR', '$eIVAN', '$F1', '$T1')->>'error'")" '^forbidden$'
chk "Ирина («Порт») убирает у Анны («Океан») — forbidden" "$(Q "select staff_photo_del('$IRINA', '$eANNA')->>'error'")" '^forbidden$'
chk "Роман (владелец) ставит Ивану — можно" "$(Q "select staff_photo_set('$ROMAN', '$eIVAN', '$F1', '$T1')->>'ok'")" '^true$'
chk "нет такого сотрудника — not_found" "$(Q "select staff_photo_set('$ROMAN', '00000000-0000-0000-0000-0000000000ff', '$F1', '$T1')->>'error'")" '^not_found$'
chk "уволенному Олегу фото не ставят — not_found" "$(Q "select staff_photo_set('$ROMAN', '$eOLEG', '$F1', '$T1')->>'error'")" '^not_found$'

# ── кто что видит
chk "список на всю сеть: Иван («Порт») видит Анну и Илью" "$(IDS $IVAN)" "^$eANNA,$eILYA,$eIVAN\$"
chk "Анна видит Ивана" "$(IDS $ANNA)" "$eIVAN"
chk "превью пачкой: два фото, данные — превью" "$(Q "select jsonb_array_length(staff_photo('$IVAN', array['$eANNA','$eILYA'])->'items')") $(Q "select string_agg(length(x->>'data')::text, ',' order by x->>'id') from jsonb_array_elements(staff_photo('$IVAN', array['$eANNA','$eILYA'])->'items') x")" '^2 120,120$'
chk "целиком — только первое из списка" "$(Q "select jsonb_array_length(staff_photo('$IVAN', array['$eANNA','$eILYA'], true)->'items')") $(Q "select length(staff_photo('$IVAN', array['$eANNA','$eILYA'], true)->'items'->0->>'data')") $(Q "select staff_photo('$IVAN', array['$eANNA','$eILYA'], true)->'items'->0->>'id'")" "^1 240 $eANNA\$"
chk "версия и mime в ответе" "$(Q "select staff_photo('$IVAN', array['$eANNA'])->'items'->0->>'ver'") $(Q "select staff_photo('$IVAN', array['$eANNA'])->'items'->0->>'mime'")" "^$VA image/jpeg\$"
chk "пустой список номеров — пусто" "$(Q "select staff_photo('$IVAN', array[]::text[])->>'items'") $(Q "select staff_photo('$IVAN', null)->>'items'")" '^\[\] \[\]$'
chk "нет фото у сотрудника — в ответе его нет" "$(Q "select staff_photo('$IVAN', array['$eIRINA'])->>'items'")" '^\[\]$'
MANY=$(printf "'x%s'," $(seq 1 24))
chk "больше 24 номеров — берутся первые 24" "$(Q "select jsonb_array_length(staff_photo('$IVAN', array[${MANY}'$eANNA'])->'items')") $(Q "select jsonb_array_length(staff_photo('$IVAN', array['$eANNA',${MANY%,}])->'items')")" '^0 1$'

# ── замена и проверка
V2=$(Q "select staff_photo_set('$ANNA', null, '$F2', '$T1')->>'ver'")
chk "замена — новая версия, строка одна" "$V2 $([ "$V2" != "$VA" ] && echo diff) $(PP "select count(*) from sa_staff_photos where emp_id = '$eANNA'")" '^[0-9a-f]{12} diff 1$'
chk "версия по содержимому: то же фото у Ильи — та же версия" "$(PP "select ver from sa_staff_photos where emp_id = '$eILYA'")" "^$V2\$"
chk "не base64 — bad_photo" "$(Q "select staff_photo_set('$ANNA', null, 'не картинка $F1', '$T1')->>'error'")" '^bad_photo$'
chk "слишком короткое — bad_photo" "$(Q "select staff_photo_set('$ANNA', null, 'QUJD', '$T1')->>'error'")" '^bad_photo$'
chk "фото больше 200000 — bad_photo" "$(Q "select staff_photo_set('$ANNA', null, repeat('QUJD', 50001), '$T1')->>'error'")" '^bad_photo$'
chk "превью больше 40000 — bad_photo" "$(Q "select staff_photo_set('$ANNA', null, '$F1', repeat('QUJD', 10001))->>'error'")" '^bad_photo$'
chk "ровно на пределе — можно" "$(Q "select staff_photo_set('$ANNA', null, repeat('QUJD', 50000), repeat('QUJD', 10000))->>'ok'")" '^true$'
chk "без превью — bad_photo" "$(Q "select staff_photo_set('$ANNA', null, '$F1', '')->>'error'") $(Q "select staff_photo_set('$ANNA', null, '$F1', null)->>'error'")" '^bad_photo bad_photo$'

# ── убрать
chk "Мария (руководящий состав) убирает у Ивана — 1" "$(Q "select staff_photo_del('$MARIA', '$eIVAN')->>'removed'")" '^1$'
chk "Анна убирает своё — 1, второй раз — 0" "$(Q "select staff_photo_del('$ANNA')->>'removed'") $(Q "select staff_photo_del('$ANNA', '')->>'removed'")" '^1 0$'
chk "после — в списке только Илья" "$(IDS $ROMAN)" "^$eILYA\$"

# ── уволенный: фото не видно, убрать может только сеть
PP "update employees set status = 'fired' where id = '$eILYA'" >/dev/null
chk "Илью уволили — в списке его нет, фото не отдаётся" "$(IDS $ROMAN)|$(Q "select staff_photo('$ROMAN', array['$eILYA'])->>'items'")" '^\|\[\]$'
chk "строка в таблице пока лежит" "$(PP "select count(*) from sa_staff_photos where emp_id = '$eILYA'")" '^1$'
chk "Пётр (руководитель) убрать уже не может — forbidden" "$(Q "select staff_photo_del('$PETR', '$eILYA')->>'error'")" '^forbidden$'
chk "Роман (сеть) убирает — 1" "$(Q "select staff_photo_del('$ROMAN', '$eILYA')->>'removed'")" '^1$'
chk "таблица закрыта для прямого чтения" "$(Q "select count(*) from sa_staff_photos")" '(permission denied|^0$)'
chk "права на функции: anon зовёт, public — нет" "$(PP "select has_function_privilege('anon', 'staff_photo_set(text, text, text, text)', 'execute')::text || ' ' || has_function_privilege('public', 'staff_photo_set(text, text, text, text)', 'execute')::text")" '^true false$'

echo "итог: $pass ✓, $fail ✗"
[ "$fail" -eq 0 ]
