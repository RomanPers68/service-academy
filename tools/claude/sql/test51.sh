#!/bin/bash
# Этап 51 (v146, Доп. 467): фото урока — lesson_photos, lesson_photo, lesson_photo_set, lesson_photo_del.
# Поверх базы run25.sh: копия satest51, этап 51 дважды; права (сеть — владелец и руководящий состав, заведение — его
# руководители), кто что видит (своё заведение важнее сети, чужих заведений не видно), превью и целиком, замена (новая
# версия, одна строка), проверка фото и номера урока, снятие, служебная _sa_lp_can закрыта, функции — VOLATILE.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test51.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest51
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S51=supabase-stage51-lesson-photos.sql
D=$(mktemp -d); cp "$SRC/$S51" "$D/"; chmod -R a+r "$D"
RC=0; OUT51=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT51="$out"; }
run $S51; run $S51
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:500}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
OK="Два моря, Океан"
F1=$(printf 'QUJD%.0s' $(seq 1 60)); T1=$(printf 'REVG%.0s' $(seq 1 30)); F2=$(printf 'R0hJ%.0s' $(seq 1 70))
SET() { Q "select lesson_photo_set('$1', '$2', '$3', '$4', '$T1', 1280, 853)"; }

chk "этап 51 дважды — без ошибок" "$RC" '^0$'
chk "итог этапа: 4 функции, фото 0" "$(echo "$OUT51" | grep -o 'фото уроков: .*' | head -1)" '^фото уроков: 4 функции из 4 · фото: 0'
chk "функции с проверкой входа — VOLATILE" \
  "$(PP "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname like 'lesson_photo%'")" \
  '^lesson_photo:v,lesson_photo_del:v,lesson_photo_set:v,lesson_photos:v$'
chk "служебная _sa_lp_can — не для anon" "$(Q "select _sa_lp_can('{}'::jsonb, '')" | grep -c 'permission denied')" '^1$'
chk "без входа — auth" "$(Q "select lesson_photos('нет')->>'error'") $(Q "select lesson_photo('нет', 's0-1')->>'error'") $(Q "select lesson_photo_set('нет', 's0-1', '', '$F1', '$T1')->>'error'") $(Q "select lesson_photo_del('нет', 's0-1', '')->>'error'")" '^auth auth auth auth$'

# ── права
chk "Анна (официант): ничего нельзя" "$(Q "select lesson_photos('$ANNA')->'can'")" '"net": false.*"venue": false'
chk "Пётр (менеджер «Океана»): только своё заведение" "$(Q "select lesson_photos('$PETR')->'can'")" '"net": false.*"venue": true'
chk "Роман (владелец): сеть и заведение" "$(Q "select lesson_photos('$ROMAN')->'can'")" '"net": true.*"venue": true'
chk "Мария (руководящий состав): сеть и заведение" "$(Q "select lesson_photos('$MARIA')->'can'")" '"net": true.*"venue": true'
chk "в ответе своё заведение" "$(Q "select lesson_photos('$PETR')->>'restaurant'")" "^$OK\$"
chk "Анна ставит фото — forbidden" "$(SET $ANNA s0-1 '' "$F1" | sed 's/.*error": "\([a-z_]*\)".*/\1/')" '^forbidden$'
chk "Пётр ставит фото сети — forbidden" "$(Q "select lesson_photo_set('$PETR', 's0-1', '', '$F1', '$T1')->>'error'")" '^forbidden$'
chk "Пётр ставит фото чужому заведению — forbidden" "$(Q "select lesson_photo_set('$PETR', 's0-1', 'Порт', '$F1', '$T1')->>'error'")" '^forbidden$'
chk "Ирина («Порт») ставит «Океану» — forbidden" "$(Q "select lesson_photo_set('$IRINA', 's0-1', '$OK', '$F1', '$T1')->>'error'")" '^forbidden$'

# ── поставить
V0=$(Q "select lesson_photo_set('$ROMAN', 's0-1', '', '$F1', '$T1', 1280, 853)->>'ver'")
chk "Роман ставит фото сети — версия" "$V0" '^[0-9a-f]{12}$'
V1=$(Q "select lesson_photo_set('$PETR', 's0-1', '$OK', '$F2', '$T1', 900, 600)->>'ver'")
chk "Пётр ставит фото «Океана» — своя версия" "$V1" '^[0-9a-f]{12}$'
chk "версии сети и заведения разные" "$([ "$V0" != "$V1" ] && echo diff)" '^diff$'
chk "Мария ставит «Порту» (руководящий состав — любое заведение)" "$(Q "select lesson_photo_set('$MARIA', 'c4-3', 'Порт', '$F1', '$T1')->>'ok'")" '^true$'
chk "в таблице три фото" "$(PP "select count(*) from sa_lesson_photos")" '^3$'
chk "кто поставил — имя" "$(PP "select by_name from sa_lesson_photos where scope = '$OK' and lesson = 's0-1'")" '^Пётр Иванов$'

# ── кто что видит
chk "Анна («Океан»): s0-1 — своё заведение, без чужого «Порта»" "$(Q "select string_agg(x->>'lesson' || '@' || (x->>'scope'), ',' order by x->>'lesson', x->>'scope') from jsonb_array_elements(lesson_photos('$ANNA')->'items') x")" "^s0-1@,s0-1@$OK\$"
chk "Иван («Порт»): сеть и своё" "$(Q "select string_agg(x->>'lesson' || '@' || (x->>'scope'), ',' order by x->>'lesson', x->>'scope') from jsonb_array_elements(lesson_photos('$IVAN')->'items') x")" '^c4-3@Порт,s0-1@$'
chk "Анне — фото «Океана» (важнее сети)" "$(Q "select lesson_photo('$ANNA', 's0-1')->>'scope'") $(Q "select lesson_photo('$ANNA', 's0-1')->>'ver'")" "^$OK $V1\$"
chk "Ивану — фото сети" "$(Q "select lesson_photo('$IVAN', 's0-1')->>'scope'")|$(Q "select lesson_photo('$IVAN', 's0-1')->>'ver'")" "^\|$V0\$"
chk "превью и целиком — разные данные" "$(Q "select length(lesson_photo('$ANNA', 's0-1')->>'data')") $(Q "select length(lesson_photo('$ANNA', 's0-1', true)->>'data')")" '^120 280$'
chk "именно сеть (p_scope = '')" "$(Q "select lesson_photo('$ANNA', 's0-1', false, '')->>'ver'")" "^$V0\$"
chk "чужое заведение по p_scope — not_found" "$(Q "select lesson_photo('$ANNA', 'c4-3', false, 'Порт')->>'error'")" '^not_found$'
chk "фото «Порта» Анне не видно" "$(Q "select lesson_photo('$ANNA', 'c4-3')->>'error'")" '^not_found$'
chk "размер и mime" "$(Q "select lesson_photo('$IVAN', 's0-1')->>'w'") $(Q "select lesson_photo('$IVAN', 's0-1')->>'mime'")" '^1280 image/jpeg$'

# ── замена и проверка
V2=$(Q "select lesson_photo_set('$ROMAN', 's0-1', '', '$F2', '$T1', 99999, 600)->>'ver'")
chk "замена — новая версия, строка одна" "$V2 $(PP "select count(*) from sa_lesson_photos where scope = '' and lesson = 's0-1'")" '^[0-9a-f]{12} 1$'
chk "версия по содержимому: то же фото — та же версия" "$([ "$V2" = "$V1" ] && echo same)" '^same$'
chk "ширина вне 1…10000 — пусто" "$(PP "select coalesce(w::text, 'null') from sa_lesson_photos where scope = '' and lesson = 's0-1'")" '^null$'
chk "не base64 — bad_photo" "$(Q "select lesson_photo_set('$ROMAN', 's0-2', '', 'не картинка $F1', '$T1')->>'error'")" '^bad_photo$'
chk "слишком короткое — bad_photo" "$(Q "select lesson_photo_set('$ROMAN', 's0-2', '', 'QUJD', '$T1')->>'error'")" '^bad_photo$'
chk "превью больше 110000 — bad_photo" "$(Q "select lesson_photo_set('$ROMAN', 's0-2', '', '$F1', repeat('QUJD', 30000))->>'error'")" '^bad_photo$'
chk "номер урока с пробелом — bad_request" "$(Q "select lesson_photo_set('$ROMAN', 'урок 1', '', '$F1', '$T1')->>'error'")" '^bad_request$'
chk "номер урока «cms-l-cn-idea» (раздел «О нас») — можно" "$(Q "select lesson_photo_set('$ROMAN', 'cms-l-cn-idea', '', '$F1', '$T1')->>'ok'")" '^true$'

# ── убрать
chk "Ирина убирает фото «Океана» — forbidden" "$(Q "select lesson_photo_del('$IRINA', 's0-1', '$OK')->>'error'")" '^forbidden$'
chk "Пётр убирает своё — 1" "$(Q "select lesson_photo_del('$PETR', 's0-1', '$OK')->>'removed'")" '^1$'
chk "второй раз — 0" "$(Q "select lesson_photo_del('$PETR', 's0-1', '$OK')->>'removed'")" '^0$'
chk "после — Анне снова фото сети" "$(Q "select lesson_photo('$ANNA', 's0-1')->>'scope'")|" '^\|$'
chk "таблица закрыта для прямого чтения" "$(Q "select count(*) from sa_lesson_photos")" '(permission denied|^0$)'

echo "итог: $pass ✓, $fail ✗"
[ "$fail" -eq 0 ]
