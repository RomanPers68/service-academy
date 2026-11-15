#!/bin/bash
# Этап 53 (v167, Доп. 492): редактор справочника — ref_book, ref_book_save.
# Поверх базы run25.sh: копия satest53, этап 53 дважды; читают все, кто вошёл; пишет только владелец; строка заменяется
# целиком, пустое поле у штатного — «как в приложении»; убрать строку — вернуть штатное или удалить своё; свой раздел
# уходит вместе со своими главами; версия растёт при каждой записи, с той же версией ответ короткий; плохие строки —
# отказ без записи (ни одна строка правки не ложится); таблицы закрыты.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test53.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest53
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S53=supabase-stage53-ref-book.sql
D=$(mktemp -d); cp "$SRC/$S53" "$D/"; chmod -R a+r "$D"
RC=0; OUT53=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT53="$out"; }
run $S53; run $S53
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:500}"; fail=$((fail+1)); fi; }
# входы (sessions): Роман — владелец, Мария — руководитель заведения, Анна — официант, Олег — уволен, Ирина — другое заведение
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2
ANNA=10000000-0000-0000-0000-0000000000a4; OLEG=10000000-0000-0000-0000-0000000000a6; IRINA=10000000-0000-0000-0000-0000000000b1
SAVE() { Q "select ref_book_save('$1', '$2'::jsonb, '${3:-[]}'::jsonb)"; }
IDS() { Q "select coalesce(string_agg(x->>'id', ',' order by x->>'id'), '') from jsonb_array_elements(ref_book('$1')->'items') x"; }
ONE() { Q "select (select x from jsonb_array_elements(ref_book('$ANNA')->'items') x where x->>'id' = '$1')"; }

chk "этап 53 дважды — без ошибок" "$RC" '^0$'
chk "итог этапа: 2 функции, правок 0" "$(echo "$OUT53" | grep -o 'редактор справочника: .*' | head -1)" '^редактор справочника: 2 функции из 2 · строк правок: 0'
chk "функции с проверкой входа — VOLATILE" \
  "$(PP "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname like 'ref_book%'")" '^ref_book:v,ref_book_save:v$'
chk "без входа и уволенный — auth" "$(Q "select ref_book('нет')->>'error'") $(Q "select ref_book('$OLEG')->>'error'") $(SAVE нет '[]' | grep -o '"error": *"[a-z]*"' | head -1)" '^auth auth "error": *"auth"$'

# ── чтение: все, кто вошёл; править может только владелец
chk "пусто: версия 0, строк нет" "$(Q "select ref_book('$ANNA')->>'ver'") $(Q "select ref_book('$ANNA')->>'items'")" '^0 \[\]$'
chk "кто может править: владелец — да, руководитель и официант — нет" \
  "$(Q "select ref_book('$ROMAN')->'can'->>'edit'") $(Q "select ref_book('$MARIA')->'can'->>'edit'") $(Q "select ref_book('$ANNA')->'can'->>'edit'")" '^true false false$'
chk "руководитель и официант записать не могут — forbidden, строк нет" \
  "$(SAVE $MARIA '[{"id":"rc-1","kind":"ch","parent":"serving","title":"Чужая","body":"x"}]' | grep -o 'forbidden') $(SAVE $ANNA '[]' '["srv-basics"]' | grep -o 'forbidden') $(PP "select count(*) from sa_ref_items")" '^forbidden forbidden 0$'

# ── владелец правит штатную главу, добавляет свою главу и свой раздел
V1=$(SAVE $ROMAN '[{"id":"srv-basics","kind":"ch","parent":"","title":null,"body":"Новый текст основ","hidden":false,"sort":null}]' | grep -o '"ver": *"[0-9]*"' | grep -o '[0-9]*')
chk "правка штатной главы — версия 1" "$V1" '^1$'
chk "у штатной главы пустое название осталось пустым («как в приложении»), текст записан" "$(ONE srv-basics | tr -d ' ')" '"body":"Новыйтекстоснов".*"title":null'
V2=$(SAVE $ROMAN '[{"id":"rs-tea","kind":"sec","parent":"","title":"Чай","sub":"Сорта и подача","sort":40},{"id":"rc-tea1","kind":"ch","parent":"rs-tea","title":"Зелёный чай","body":"**Заваривание**\n• 80 градусов","sort":1},{"id":"rc-tea2","kind":"ch","parent":"rs-tea","title":"Чёрный чай","body":"Текст","sort":2},{"id":"rc-own1","kind":"ch","parent":"coffee","title":"Наш фильтр","body":"Текст","sort":99}]' | grep -o '"ver": *"[0-9]*"' | grep -o '[0-9]*')
chk "свой раздел с двумя главами и своя глава в штатном разделе — версия 2" "$V2" '^2$'
chk "список видят все: официант, руководитель, другое заведение" "$(IDS $ANNA) | $(IDS $MARIA) | $(IDS $IRINA)" '^rc-own1,rc-tea1,rc-tea2,rs-tea,srv-basics \| rc-own1,rc-tea1,rc-tea2,rs-tea,srv-basics \| rc-own1,rc-tea1,rc-tea2,rs-tea,srv-basics$'
chk "разделы в ответе идут раньше глав" "$(Q "select string_agg(x->>'kind', ',') from jsonb_array_elements(ref_book('$ANNA')->'items') x")" '^sec,ch,ch,ch,ch$'
chk "перенос строки в тексте главы дошёл как есть" "$(Q "select (select x->>'body' from jsonb_array_elements(ref_book('$ANNA')->'items') x where x->>'id' = 'rc-tea1') like '%' || chr(10) || '• 80 градусов'")" '^t$'
chk "кто правил — имя владельца" "$(PP "select count(distinct by_name) || ' ' || max(by_name) from sa_ref_items")" '^1 Роман'

# ── версия: с той же версией ответ короткий, со старой — весь список
chk "та же версия на телефоне — «то же самое», списка нет" "$(Q "select ref_book('$ANNA', '2')->>'same'") $(Q "select ref_book('$ANNA', '2') ? 'items'")" '^true f$'
chk "старая версия на телефоне — весь список" "$(Q "select jsonb_array_length(ref_book('$ANNA', '1')->'items')") $(Q "select ref_book('$ANNA', '1') ? 'same'")" '^5 f$'

# ── строка заменяется целиком: скрыть, порядок, пустое поле
SAVE $ROMAN '[{"id":"srv-basics","kind":"ch","parent":"","title":"Основы","body":null,"hidden":true,"sort":3}]' >/dev/null
chk "вторая правка той же главы: название есть, текст снова «как в приложении», скрыта, место 3" "$(ONE srv-basics | tr -d ' ')" '"body":null.*"sort":3.*"title":"Основы"'
chk "скрытая глава: hidden true" "$(Q "select (select x->>'hidden' from jsonb_array_elements(ref_book('$ANNA')->'items') x where x->>'id' = 'srv-basics')")" '^true$'
chk "строк по-прежнему пять (замена, а не добавление)" "$(PP "select count(*) from sa_ref_items")" '^5$'

# ── убрать строку: штатное возвращается, своё удаляется; свой раздел — вместе с главами
SAVE $ROMAN '[]' '["srv-basics"]' >/dev/null
chk "вернуть штатную главу как было — её строки больше нет" "$(IDS $ANNA)" '^rc-own1,rc-tea1,rc-tea2,rs-tea$'
SAVE $ROMAN '[{"id":"coffee","kind":"sec","parent":"","title":"Кофе и чай","sort":2}]' >/dev/null
SAVE $ROMAN '[]' '["coffee"]' >/dev/null
chk "вернуть штатный раздел как было — своя глава в нём остаётся" "$(IDS $ANNA)" '^rc-own1,rc-tea1,rc-tea2,rs-tea$'
SAVE $ROMAN '[]' '["rs-tea"]' >/dev/null
chk "свой раздел убран вместе со своими главами" "$(IDS $ANNA)" '^rc-own1$'
chk "версия росла при каждой записи и удалении" "$(Q "select ref_book('$ANNA')->>'ver'")" '^7$'

# ── плохие строки: отказ, и ни одна строка этой правки не записана
chk "плохой номер — bad_item, хорошая строка рядом не записана" \
  "$(SAVE $ROMAN '[{"id":"rc-ok","kind":"ch","parent":"wine","title":"Хорошая","body":"x"},{"id":"плохой номер","kind":"ch","title":"x"}]' | grep -o 'bad_item') $(IDS $ANNA)" '^bad_item rc-own1$'
chk "не раздел и не глава — bad_item" "$(SAVE $ROMAN '[{"id":"rc-x","kind":"photo","title":"x"}]' | grep -o 'bad_item')" '^bad_item$'
chk "название длиннее 160 знаков — bad_item" "$(SAVE $ROMAN "[{\"id\":\"rc-x\",\"kind\":\"ch\",\"title\":\"$(printf 'я%.0s' $(seq 1 161))\"}]" | grep -o 'bad_item')" '^bad_item$'
chk "место не числом — bad_item" "$(SAVE $ROMAN '[{"id":"rc-x","kind":"ch","title":"x","sort":"первое"}]' | grep -o 'bad_item')" '^bad_item$'
chk "не список — bad_request" "$(Q "select ref_book_save('$ROMAN', '{\"id\":\"rc-x\"}'::jsonb)->>'error'")" '^bad_request$'
chk "плохой номер в «убрать» — bad_item, строки на месте" "$(SAVE $ROMAN '[]' '["rc-own1", 5]' | grep -o 'bad_item') $(IDS $ANNA)" '^bad_item rc-own1$'
chk "после отказов версия прежняя" "$(Q "select ref_book('$ANNA')->>'ver'")" '^7$'
BIG=$(python3 -c "print('я' * 60001)")
chk "текст длиннее 60 000 знаков — bad_item" "$(SAVE $ROMAN "[{\"id\":\"rc-big\",\"kind\":\"ch\",\"title\":\"x\",\"body\":\"$BIG\"}]" | grep -o 'bad_item')" '^bad_item$'

# ── как удаляет раздел редактор: одним вызовом — раздел убрать, штатную главу, перенесённую в него, вернуть домой с её правкой
SAVE $ROMAN '[{"id":"rs-std","kind":"sec","parent":"","title":"Стандарты"},{"id":"rc-std1","kind":"ch","parent":"rs-std","title":"Своя","body":"т","sort":10},{"id":"srv-types","kind":"ch","parent":"rs-std","title":"Виды, наши","sort":20}]' >/dev/null
chk "штатная глава перенесена в свой раздел" "$(ONE srv-types | tr -d ' ')" '"sort":20.*"title":"Виды,наши".*"parent":"rs-std"'
SAVE $ROMAN '[{"id":"srv-types","kind":"ch","parent":"","title":"Виды, наши","body":null,"hidden":false,"sort":null}]' '["rs-std"]' >/dev/null
chk "раздел и своя глава удалены, штатная вернулась домой со своим названием" "$(IDS $ANNA) $(ONE srv-types | tr -d ' ')" '^rc-own1,srv-types .*"sort":null.*"title":"Виды,наши".*"parent":""'
# ── порядок: место записано числом и отдаётся числом
SAVE $ROMAN '[{"id":"wine","kind":"sec","parent":"","sort":10},{"id":"serving","kind":"sec","parent":"","sort":20.4}]' >/dev/null
chk "место раздела хранится целым числом" "$(Q "select string_agg(x->>'id' || ':' || (x->>'sort'), ',' order by (x->>'sort')::int) from jsonb_array_elements(ref_book('$ANNA')->'items') x where x->>'kind' = 'sec'")" '^wine:10,serving:20$'

# ── закрыто
chk "таблицы закрыты для прямого чтения" "$(Q "select count(*) from sa_ref_items") $(Q "select count(*) from sa_ref_meta")" '(permission denied|^0 0$)'
chk "права на функции: anon зовёт" "$(PP "select has_function_privilege('anon', 'ref_book(text, text)', 'execute')::text || ' ' || has_function_privilege('anon', 'ref_book_save(text, jsonb, jsonb)', 'execute')::text")" '^true true$'

echo "итог: $pass ✓, $fail ✗"
[ "$fail" -eq 0 ]
