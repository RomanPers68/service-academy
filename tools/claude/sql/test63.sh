#!/bin/bash
# Этап 63 (v200, Доп. 525): живая проверка — кто кого проверяет по ступеням должностей, итоги, кто их видит.
# Поверх базы run25.sh (сотрудники «Два моря, Океан» и «Порт»): копия satest63, этап 61, своя должность «Управляющая»
# (до этапа 63 — он берёт её, а не создаёт новую), новые люди: Ульяна (управляющая), Сергей (старший бармен),
# Павел (второй менеджер), → этап 63 дважды. Без этапа 61 — понятная ошибка; без своей должности этап сам добавляет
# «Управляющего». Списки «кого проверить»: официант и бармен — нельзя, старший бармен — только бармена, менеджер — своих
# ниже менеджера, управляющая — и менеджеров, руководящий состав — любое заведение, владелец — и руководящий состав;
# сохранение: ступень, заведение, линия, не себя и не уволенного, проверка отметок, процент и «зачтено»; человек:
# сам, кто может проверять, сеть — да, остальные — нет, пройденные уроки и тесты; убрать — своё за сутки или владелец;
# «старше менеджера» — только владелец и только у своей должности «работает как» менеджер; повторный этап не трогает
# итоги и снятую отметку; без входа — auth; таблицы закрыты.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test63.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest63
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S63=supabase-stage63-live-check.sql
D=$(mktemp -d); for f in supabase-stage61-places.sql $S63; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; IRINA=10000000-0000-0000-0000-0000000000b1
ULYANA=10000000-0000-0000-0000-0000000000c1; SERGEY=10000000-0000-0000-0000-0000000000c2; PAVEL=10000000-0000-0000-0000-0000000000c3
E_ANNA=00000000-0000-0000-0000-0000000000a4; E_ILYA=00000000-0000-0000-0000-0000000000a5; E_OLEG=00000000-0000-0000-0000-0000000000a6
E_PETR=00000000-0000-0000-0000-0000000000a3; E_IVAN=00000000-0000-0000-0000-0000000000b2; E_ULYANA=00000000-0000-0000-0000-0000000000c1
E_PAVEL=00000000-0000-0000-0000-0000000000c3; E_MARIA=00000000-0000-0000-0000-0000000000a2
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }

# ── Без этапа 61 — понятная ошибка; без своей должности — этап сам добавляет «Управляющего» ────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}x" -c "create database ${DB}x template satest25" >/dev/null 2>&1
chk "без этапа 61: «Сначала этап 61»" "$($P0 -d ${DB}x -f "$D/$S63" 2>&1 | grep -o 'Сначала этап 61[^:]*' | head -1)" '^Сначала этап 61 \(supabase-stage61-places.sql\)$'
$P0 -d ${DB}x -f "$D/supabase-stage61-places.sql" >/dev/null 2>&1
chk "своей должности нет — этап добавил «Управляющего» (работает как менеджер) и он старше менеджера" \
  "$($P0 -d ${DB}x -f "$D/$S63" 2>&1 | grep -o 'живая проверка: .*' | head -1) / $(psql -h $PGH -p $PGP -U postgres -q -t -A -d ${DB}x -c "select label || ' ' || base || ' ' || builtin from sa_positions where id = 'pupravl00'")" \
  '^живая проверка: функций 6 из 6 · старше менеджера: Управляющий · проверок 0 / Управляющий manager false$'
$P0 -d postgres -c "drop database if exists ${DB}x" >/dev/null 2>&1

# ── Этап 61, своя «Управляющая», новые люди ───────────────────────────────────────────────────────────────────────
run supabase-stage61-places.sql
chk "этап 61 — без ошибок" "$RC" '^0$'
UPR=$(Q "select org_position_save('$ROMAN', null, 'Управляющая', 'manager')->>'id'")
BAR=$(Q "select org_position_save('$ROMAN', null, 'Бариста', 'bartender')->>'id'")
PP "insert into employees (id, name, surname, restaurant, position, is_admin, status, job_title) values
  ('$E_ULYANA', 'Ульяна', 'Управляющая', 'Два моря, Океан', 'manager', false, 'active', '$UPR'),
  ('00000000-0000-0000-0000-0000000000c2', 'Сергей', 'Старший', 'Два моря, Океан', 'senior_bartender', false, 'active', null),
  ('$E_PAVEL', 'Павел', 'Второй', 'Два моря, Океан', 'manager', false, 'active', null);
  insert into sessions (token, employee_id) values ('$ULYANA', '$E_ULYANA'), ('$SERGEY', '00000000-0000-0000-0000-0000000000c2'), ('$PAVEL', '$E_PAVEL');
  insert into progress (user_id, lesson_id) values ('$E_ANNA', 's0-1'), ('$E_ANNA', 's0-2'), ('$E_ANNA', 's0-1');
  insert into quiz_done (user_id, quiz_id) values ('$E_ANNA', 's0-q')" >/dev/null

RC=0; run $S63
chk "этап 63: функций 6 из 6, старше менеджера — своя «Управляющая» (новой не добавил), проверок 0" \
  "$(echo "$OUT" | grep -o 'живая проверка: .*' | head -1) / $(PP "select count(*) from sa_positions where id = 'pupravl00'")" \
  '^живая проверка: функций 6 из 6 · старше менеджера: Управляющая · проверок 0 / 0$'

# ── Ступени ────────────────────────────────────────────────────────────────────────────────────────────────────────
LV() { Q "select live_check_levels('$1')->>'level'"; }
chk "ступени: официант 10, старший бармен 20, менеджер 30, управляющая 35, руководящий состав 50, владелец 60" \
  "$(LV $ANNA) $(LV $SERGEY) $(LV $PETR) $(LV $ULYANA) $(LV $MARIA) $(LV $ROMAN)" '^10 20 30 35 50 60$'
chk "в «старше» — своя «Управляющая»" "$(Q "select live_check_levels('$ANNA')->'ups'")" "^\[\"$UPR\"\]$"

# ── Кого я могу проверить ──────────────────────────────────────────────────────────────────────────────────────────
PL() { Q "select coalesce((select string_agg(x->>'name', ',' order by x->>'name') from jsonb_array_elements(r->'people') x), '—') || ' @' || coalesce(r->>'restaurant', r->>'error') from (select live_check_people('$1', ${2:-null}) r) t"; }
chk "официант и бармен — нельзя" "$(PL $ANNA) | $(PL $ILYA)" '^— @forbidden \| — @forbidden$'
chk "старший бармен — только бармен своего заведения" "$(PL $SERGEY)" '^Илья @Два моря, Океан$'
chk "менеджер — ниже менеджера: официант, бармен, старший бармен (уволенного нет, второго менеджера нет)" "$(PL $PETR)" '^Анна,Илья,Сергей @Два моря, Океан$'
chk "управляющая — и менеджеров" "$(PL $ULYANA)" '^Анна,Илья,Павел,Пётр,Сергей @Два моря, Океан$'
chk "руководящий состав — своё заведение и выбранное («Порт»)" "$(PL $MARIA) | $(PL $MARIA "'Порт'")" '^Анна,Илья,Павел,Пётр,Сергей,Ульяна @Два моря, Океан \| Иван,Ирина @Порт$'
chk "владелец — и руководящий состав" "$(PL $ROMAN)" '^Анна,Илья,Мария,Павел,Пётр,Сергей,Ульяна @Два моря, Океан$'
chk "менеджер «Порта» просит «Два моря» — получает свой «Порт»" "$(PL $IRINA "'Два моря, Океан'")" '^Иван @Порт$'

# ── Сохранить ──────────────────────────────────────────────────────────────────────────────────────────────────────
SV() { Q "select coalesce(r->>'error', (r->>'score') || ' ' || (r->>'passed')) from (select live_check_save('$1', '$2', '${3:-seasonal}', '${4:-s0}', '$5'::jsonb, ${6:-null}) r) t"; }
chk "менеджер проверил Анну: 2,2,1,2 — 88%, зачтено; 2,1,0 — 50%, не зачтено" "$(SV $PETR $E_ANNA seasonal s0 '[2,2,1,2]') / $(SV $PETR $E_ANNA seasonal s1 '[2,1,0]')" '^88 true / 50 false$'
chk "ровно 75% — зачтено (2,2,1,1); 1,1,1,1 — 50%" "$(SV $PETR $E_ANNA seasonal s2 '[2,2,1,1]') / $(SV $PETR $E_ANNA core c0 '[1,1,1,1]')" '^75 true / 50 false$'
chk "менеджер не проверяет менеджера, себя и уволенного" "$(SV $PETR $E_PAVEL manager m0 '[2,2,2]') $(SV $PETR $E_PETR manager m0 '[2,2,2]') $(SV $PETR $E_OLEG seasonal s0 '[2,2,2]')" '^forbidden forbidden forbidden$'
chk "старший бармен: бармена да, официанта нет" "$(SV $SERGEY $E_ILYA bar bar0 '[2,2,2,2]') / $(SV $SERGEY $E_ANNA seasonal s0 '[2,2,2,2]')" '^100 true / forbidden$'
chk "управляющая проверяет менеджера; менеджер «Порта» не проверяет Анну" "$(SV $ULYANA $E_PETR manager m0 '[2,1,2,2]') / $(SV $IRINA $E_ANNA seasonal s0 '[2,2,2]')" '^88 true / forbidden$'
chk "руководящий состав — человека из «Порта»" "$(SV $MARIA $E_IVAN seasonal s3 '[2,2,2,0]')" '^75 true$'
chk "плохие отметки, курс, модуль, длинная заметка — bad_request" \
  "$(SV $PETR $E_ANNA seasonal s0 '[3]') $(SV $PETR $E_ANNA seasonal s0 '[]') $(SV $PETR $E_ANNA seasonal s0 '[1.5]') $(SV $PETR $E_ANNA zzz s0 '[2]') $(SV $PETR $E_ANNA seasonal 'S 0' '[2]') $(SV $PETR $E_ANNA seasonal s0 '[2]' "repeat('x', 501)")" \
  '^bad_request bad_request bad_request bad_request bad_request bad_request$'
chk "заметка и кто проверял сохраняются" "$(Q "select live_check_save('$PETR', '$E_ANNA', 'seasonal', 's3', '[2,2,2]'::jsonb, '  Хорошо знает аллергены  ')->>'ok'") / $(PP "select note || ' · ' || checker_name || ' · ' || checker_level || ' · ' || restaurant from sa_live_checks where module_id = 's3' and emp_id = '$E_ANNA'")" \
  '^true / Хорошо знает аллергены · Пётр Иванов · 30 · Два моря, Океан$'
chk "в списке у менеджера — последние итоги Анны по модулям (s0, s1, s2, s3, c0)" \
  "$(Q "select string_agg((x->>'m') || ':' || (x->>'s'), ',' order by x->>'m') from jsonb_array_elements((select p from jsonb_array_elements(live_check_people('$PETR')->'people') p where p->>'name' = 'Анна')->'checks') x")" \
  '^c0:50,s0:88,s1:50,s2:75,s3:100$'

# ── Человек: кто видит итоги ─────────────────────────────────────────────────────────────────────────────────────
PS() { Q "select coalesce(r->>'error', (r->>'can') || ' ' || jsonb_array_length(r->'checks') || ' ' || (r->'lessons')::text || ' ' || (r->'quiz')::text) from (select live_check_person('$1', '$2') r) t"; }
chk "Анна видит свои итоги (проверять себя не может); уроки и тесты из приложения" "$(PS $ANNA $E_ANNA)" '^false 5 \["s0-1", "s0-2"\] \["s0-q"\]$'
chk "менеджер — да и может проверять; бармен и менеджер «Порта» — нет" "$(PS $PETR $E_ANNA | cut -d' ' -f1-2) / $(PS $ILYA $E_ANNA) / $(PS $IRINA $E_ANNA)" '^true 5 / forbidden / forbidden$'
chk "руководящий состав видит человека «Порта»" "$(PS $MARIA $E_IVAN | cut -d' ' -f1-2)" '^true 1$'
chk "пустой p_emp — свои итоги" "$(Q "select live_check_person('$PETR', '')->'person'->>'name'")" '^Пётр$'

# ── Убрать проверку ─────────────────────────────────────────────────────────────────────────────────────────────────
ID1=$(PP "select id from sa_live_checks where module_id = 's1' and emp_id = '$E_ANNA'")
ID2=$(PP "select id from sa_live_checks where module_id = 's2' and emp_id = '$E_ANNA'")
PP "update sa_live_checks set created_at = now() - interval '2 days' where id = $ID2" >/dev/null
DL() { Q "select coalesce(r->>'error', 'ok') from (select live_check_delete('$1', $2) r) t"; }
chk "убрать: Анна — нет; менеджер — свою свежую да, позавчерашнюю нет; владелец — да" "$(DL $ANNA $ID1) $(DL $PETR $ID1) $(DL $PETR $ID2) $(DL $ROMAN $ID2) $(DL $ROMAN 999999)" '^forbidden ok forbidden ok not_found$'

# ── «Старше менеджера» у своей должности ───────────────────────────────────────────────────────────────────────────
OL() { Q "select coalesce(r->>'error', (r->>'up')) from (select org_position_level('$1', '$2', $3) r) t"; }
chk "отметить «старше»: руководящий состав — нельзя; встроенная — нет; не менеджерская — нет; незнакомая — нет" \
  "$(OL $MARIA $UPR false) $(OL $ROMAN manager true) $(OL $ROMAN $BAR true) $(OL $ROMAN pnope true)" '^forbidden builtin bad_base not_found$'
chk "владелец снял «старше» — управляющая теперь как менеджер и менеджеров не видит" "$(OL $ROMAN $UPR false) $(LV $ULYANA) $(PL $ULYANA)" '^false 30 Анна,Илья,Сергей @Два моря, Океан$'
RC=0; run $S63
chk "этап 63 ещё раз — без ошибок, итоги на месте, снятую отметку не вернул" \
  "$RC $(echo "$OUT" | grep -o 'живая проверка: .*' | head -1) $(LV $ULYANA)" '^0 живая проверка: функций 6 из 6 · старше менеджера: никого · проверок [5-9] 30$'
chk "вернул «старше» — снова 35" "$(OL $ROMAN $UPR true) $(LV $ULYANA)" '^true 35$'

# ── Вход и доступ ──────────────────────────────────────────────────────────────────────────────────────────────────
chk "без входа — auth" "$(Q "select concat_ws(' ', live_check_people('x')->>'error', live_check_person('x', '')->>'error', live_check_save('x', '', 'seasonal', 's0', '[2]')->>'error', live_check_delete('x', 1)->>'error', live_check_levels('x')->>'error', org_position_level('x', '', true)->>'error')")" '^auth auth auth auth auth auth$'
chk "таблицы и служебное закрыты для anon" "$(Q "select count(*) from sa_live_checks") / $(Q "select _sa_lc_me('$ROMAN')")" 'permission denied.*/.*permission denied'

$P0 -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
rm -rf "$D"
echo
echo "проверок: $((pass+fail)), ✓ $pass, ✗ $fail"
[ $fail -eq 0 ]
