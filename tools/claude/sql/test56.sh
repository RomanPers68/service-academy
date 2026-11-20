#!/bin/bash
# Этап 56 (v187, Доп. 512): объединить столы (seat_join, seat_unjoin), пересадить (seat_move), лист ожидания (wait_add,
# wait_done), seat_set с приставленными столами, seat_board (seat2, fine, wait), сдвиг стола ox, oy в floor_save.
# Поверх базы run25.sh: копия satest56, этапы 26, 31, 32, 34, 35, 36, 37, 54, 55 и 56 (56 — дважды), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test56.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest56
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
BEFORE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql"
S56=supabase-stage56-join-move-wait.sql
D=$(mktemp -d); for f in $BEFORE supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql supabase-stage54-tall-tables.sql supabase-stage55-chair-sides.sql $S56; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT56=""
run() { local out; out=$($P0 -d $DB -f "$D/$1" 2>&1); local rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; LAST="$out"; }
for f in $BEFORE; do run "$f"; done
run supabase-stage35-seating.sql; run supabase-stage36-comfort.sql; run supabase-stage37-halls-qday.sql; run supabase-stage54-tall-tables.sql
# без этапа 55 — просит его
NO55=$($P0 -d $DB -f "$D/$S56" 2>&1)
run supabase-stage55-chair-sides.sql
run $S56
run $S56; OUT56="$LAST"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2; ILYA=10000000-0000-0000-0000-0000000000a5
IRINA=10000000-0000-0000-0000-0000000000b1
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5

chk "без этапа 55 — понятная ошибка: какой этап сначала" "$NO55" 'Сначала этап 55 \(supabase-stage55-chair-sides.sql\)'
chk "этапы 26, 31, 32, 34, 35, 36, 37, 54, 55 и 56 (56 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 5 функций, доска знает, стулья по сторонам и сдвиг на месте" "$OUT56" 'объединение, пересадка, лист ожидания: 5 функций из 5 · доска знает: да · стулья по сторонам: да · сдвиг стола: да'
$P -c "delete from sa_floor; delete from sa_seat; delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null
sent() { PP "select count(*) from net.sent_log"; }
lastmsg() { PP "select body->>'text' from net.sent_log order by id desc limit 1"; }

# зал «Основной»: 1 (4), 2 (4), 3 (6), 4 (2), 5 (2); «Терраса»: 7 (4)
Z='[{"id":"z1","name":"Основной"},{"id":"z2","name":"Терраса"}]'
T='[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0},{"id":"t2","n":"2","seats":4,"shape":"sq","x":1,"y":0},{"id":"t3","n":"3","seats":6,"shape":"long","x":3,"y":0},{"id":"t4","n":"4","seats":2,"shape":"sq","x":0,"y":2},{"id":"t5","n":"5","seats":2,"shape":"sq","x":1,"y":2},{"id":"t7","n":"7","seats":4,"shape":"sq","x":0,"y":0,"z":"z2"}]'
Q "select floor_save('$MARIA', '{\"v\":2,\"sides\":true,\"zones\":$Z,\"tables\":$T,\"items\":[]}'::jsonb)" >/dev/null
ROW() { PP "select coalesce((select status || ' ' || cnt || ' ' || coalesce(main, '-') || ' ' || joined::text || ' ' || coalesce(waiter_name, '') from sa_seat where tid = '$1'), 'нет')"; }
SET() { Q "select seat_set('$1', '$2', '$3', $4, '', '${5:-}', ${6:-null})->>'ok'"; }
JOIN() { Q "select seat_join('$1', '$2', '$3'::jsonb)"; }

chk "seat_board: seat2 true, fine true, лист ожидания пуст" "$(Q "select (x->>'seat2') || ' ' || (x->>'fine') || ' ' || (x->'wait')::text || ' ' || (x->>'sides') from seat_board('$ANNA') x")" '^true true \[\] true$'

# ── объединить
chk "посадили 7 гостей за 1 (Анна)" "$(SET "$MARIA" t1 seat 7 '' "'$AEMP'")" '^true$'
SINCE1=$(PP "select since from sa_seat where tid = 't1'")
R=$(JOIN "$MARIA" t1 '["t2"]')
chk "приставили 2 к 1: в ответе оба стола" "$(printf '%s' "$R" | grep -o '"ok": true') $(PP "select string_agg(x->>'tid', ',' order by x->>'tid') from jsonb_array_elements('$R'::jsonb->'tables') x")" '^"ok": true t1,t2$'
chk "у 2: гости, 0, main 1, официант Анна, время посадки как у 1; у 1: joined [2]" "$(ROW t2) | $(ROW t1) | $(PP "select (since = '$SINCE1')::text from sa_seat where tid = 't2'")" '^seat 0 t1 \[\] Анна Смирнова \| seat 7 - \["t2"\] Анна Смирнова \| true$'
chk "приставить занятый — busy и какой; к себе — bad_request; не массив — bad_request" "$(JOIN "$MARIA" t1 '["t2"]' | grep -o '"error": "busy", "tid": "t2"\|"tid": "t2", "error": "busy"' | head -1) $(Q "select seat_join('$MARIA', 't1', '[\"t1\"]'::jsonb)->>'error'") $(Q "select seat_join('$MARIA', 't1', '\"t3\"'::jsonb)->>'error'")" '"busy".* bad_request bad_request$'
chk "к свободному — not_busy; к приставленному — joined; нет стола — no_table; терраса — other_zone" "$(Q "select seat_join('$MARIA', 't4', '[\"t5\"]'::jsonb)->>'error'") $(Q "select seat_join('$MARIA', 't2', '[\"t5\"]'::jsonb)->>'error'") $(Q "select seat_join('$MARIA', 't1', '[\"t9\"]'::jsonb)->>'error'") $(Q "select seat_join('$MARIA', 't1', '[\"t7\"]'::jsonb)->>'error'")" '^not_busy joined no_table other_zone$'
chk "больше шести у одного стола — too_many; пустой список — bad_request" "$(Q "select seat_join('$MARIA', 't1', '[\"a\",\"b\",\"c\",\"d\",\"e\",\"f\",\"g\"]'::jsonb)->>'error'") $(Q "select seat_join('$MARIA', 't1', '[]'::jsonb)->>'error'")" '^bad_request bad_request$'
chk "доска: у 2 main и joined, у 1 — joined" "$(Q "select string_agg((x->>'tid') || ':' || coalesce(x->>'main', '-') || ':' || (x->'joined')::text, ' ' order by x->>'tid') from jsonb_array_elements(seat_board('$ANNA')->'tables') x")" '^t1:-:\["t2"\] t2:t1:\[\]$'

# ── статус главного — и у приставленных
chk "«Счёт» у 1 — и у 2; в ответе seat_set оба стола" "$(Q "select string_agg((x->>'tid') || '=' || (x->>'status'), ',' order by x->>'tid') from jsonb_array_elements(seat_set('$MARIA', 't1', 'bill', 7, '', '', '$AEMP')->'tables') x") $(ROW t2)" '^t1=bill,t2=bill bill 0 t1 \[\] Анна Смирнова$'
chk "обратно в «Гости» — время посадки прежнее у обоих" "$(SET "$MARIA" t1 seat 7 '' "'$AEMP'") $(PP "select count(*) from sa_seat where tid in ('t1', 't2') and since = '$SINCE1'")" '^true 2$'
chk "на уборку 1 — и 2 на уборку, без ссылок" "$(SET "$MARIA" t1 clean 0) $(ROW t1) | $(ROW t2)" '^true clean 0 - \[\] \| clean 0 - \[\]$'

# бронь с приставленным столом: бронь на 8 за 3, приставили 4 — у 4 бронь на то же время
SET "$MARIA" t3 res 8 20:00 >/dev/null
JOIN "$MARIA" t3 '["t4"]' >/dev/null
chk "бронь: приставленный — бронь на то же время, гостей 0" "$(PP "select status || ' ' || rtime || ' ' || cnt || ' ' || main from sa_seat where tid = 't4'")" '^res 20:00 0 t3$'
chk "пришли по брони — посадили за 3: 4 тоже «Гости», время посадки одно" "$(SET "$MARIA" t3 seat 8 '' "'$IEMP'") $(PP "select string_agg(status || ':' || waiter_name, ',' order by tid) from sa_seat where tid in ('t3', 't4')") $(PP "select count(distinct since) from sa_seat where tid in ('t3', 't4')")" '^true seat:Илья .*,seat:Илья .* 1$'

# ── приставленному ставят статус сам по себе (так делает и приложение до v187) — отделяется
chk "4 «Свободен» сам по себе — у 3 его больше нет" "$(SET "$ANNA" t4 free 0) $(ROW t4) | $(PP "select joined::text from sa_seat where tid = 't3'")" '^true free 0 - \[\] \| \[\]$'
$P -c "delete from net.sent_log" >/dev/null
JOIN "$MARIA" t3 '["t4"]' >/dev/null
chk "приставленный 4 посадили сам по себе — новое время, Анне сообщение, у 3 его нет" "$(SET "$MARIA" t4 seat 2 '' "'$AEMP'") $(PP "select (since > (select since from sa_seat where tid = 't3'))::text || ' ' || coalesce(main, '-') from sa_seat where tid = 't4'") $(PP "select joined::text from sa_seat where tid = 't3'") $(sent)" '^true true - \[\] 1$'

# ── разъединить
SET "$MARIA" t4 free 0 >/dev/null; SET "$MARIA" t5 free 0 >/dev/null
JOIN "$MARIA" t3 '["t4", "t5"]' >/dev/null
chk "приставили два: у 3 joined [4, 5] в том порядке" "$(PP "select joined::text from sa_seat where tid = 't3'")" '^\["t4", "t5"\]$'
chk "отделить 4 — он на уборку (сидели гости), у 3 остался 5" "$(Q "select seat_unjoin('$ANNA', 't4')->>'ok'") $(ROW t4) | $(PP "select joined::text from sa_seat where tid = 't3'")" '^true clean 0 - \[\] \| \["t5"\]$'
chk "отделить у главного — все его: 5 на уборку, у 3 пусто, гости за 3 остались" "$(Q "select jsonb_array_length(seat_unjoin('$ANNA', 't3')->'tables')") $(ROW t5) | $(ROW t3)" '^2 clean 0 - \[\] \| seat 8 - \[\] Илья'
chk "отделять нечего — not_joined" "$(Q "select seat_unjoin('$ANNA', 't3')->>'error'") $(Q "select seat_unjoin('$ANNA', 't9')->>'error'")" '^not_joined not_joined$'
SET "$MARIA" t4 res 3 21:00 >/dev/null; SET "$MARIA" t5 free 0 >/dev/null
JOIN "$MARIA" t4 '["t5"]' >/dev/null
chk "отделить от брони — свободен" "$(Q "select seat_unjoin('$MARIA', 't5')->>'ok'") $(ROW t5)" '^true free 0 - \[\]$'

# ── пересадить
SET "$MARIA" t4 free 0 >/dev/null; SET "$MARIA" t5 free 0 >/dev/null; SET "$MARIA" t1 free 0 >/dev/null; SET "$MARIA" t2 free 0 >/dev/null
SET "$MARIA" t1 seat 5 '' "'$AEMP'" >/dev/null
JOIN "$MARIA" t1 '["t2"]' >/dev/null
S1=$(PP "select since from sa_seat where tid = 't1'")
$P -c "delete from net.sent_log" >/dev/null
R=$(Q "select string_agg((x->>'tid') || '=' || (x->>'status'), ',' order by x->>'tid') from jsonb_array_elements(seat_move('$MARIA', 't1', 't7')->'tables') x")
chk "пересадили 1 (с приставленным 2) за 7 на террасу: 7 — гости, 1 и 2 — на уборку" "$R" '^t1=clean,t2=clean,t7=seat$'
chk "за 7: 5 гостей, Анна, время посадки прежнее; 1 и 2 без гостей и ссылок" "$(PP "select cnt || ' ' || waiter_name || ' ' || (since = '$S1')::text from sa_seat where tid = 't7'") | $(ROW t1) | $(ROW t2)" '^5 Анна Смирнова true \| clean 0 - \[\] \| clean 0 - \[\]$'
chk "Анне сообщение: куда пересадили и кто" "$(sent) $(lastmsg)" '^1 Гостей со стола 1 пересадили за стол 7\. Пересадил\(а\): Мария Ким\.$'
chk "пересадить за занятый — busy; со свободного — not_busy; сам на себя — same; нет стола — no_table" "$(SET "$MARIA" t1 free 0 >/dev/null; SET "$MARIA" t3 seat 2 >/dev/null; Q "select seat_move('$MARIA', 't7', 't3')->>'error'") $(Q "select seat_move('$MARIA', 't5', 't4')->>'error'") $(Q "select seat_move('$MARIA', 't7', 't7')->>'error'") $(Q "select seat_move('$MARIA', 't7', 't9')->>'error'")" '^busy not_busy same no_table$'
JOIN "$MARIA" t7 '[]' >/dev/null
SET "$MARIA" t3 free 0 >/dev/null; SET "$MARIA" t4 free 0 >/dev/null
SET "$MARIA" t3 seat 4 '' "'$AEMP'" >/dev/null; JOIN "$MARIA" t3 '["t4"]' >/dev/null
chk "пересадить на свой приставленный — same" "$(Q "select seat_move('$MARIA', 't3', 't4')->>'error'")" '^same$'
$P -c "delete from net.sent_log" >/dev/null
chk "пересадить с приставленного 4 — пересаживается вся компания стола 3; Анна пересадила сама — без сообщения" "$(Q "select string_agg((x->>'tid') || '=' || (x->>'status'), ',' order by x->>'tid') from jsonb_array_elements(seat_move('$ANNA', 't4', 't5')->'tables') x") $(sent)" '^t3=clean,t4=clean,t5=seat 0$'
SET "$MARIA" t1 res 2 19:30 >/dev/null; SET "$MARIA" t2 free 0 >/dev/null
chk "перенести бронь: 2 — бронь на 19:30, 1 — свободен (не уборка), без сообщения" "$(Q "select seat_move('$MARIA', 't1', 't2')->>'ok'") $(PP "select status || ' ' || rtime || ' ' || cnt from sa_seat where tid = 't2'") $(ROW t1) $(sent)" '^true res 19:30 2 free 0 - \[\] 0$'

# ── лист ожидания
W1=$(Q "select seat_board('$ANNA') is not null")
chk "в лист: Ильины, 4, «у бара» — item с id, кто записал" "$(Q "select (x->'item'->>'name') || ' ' || (x->'item'->>'cnt') || ' ' || (x->'item'->>'note') || ' ' || (x->'item'->>'by') || ' ' || ((x->'item'->>'id') ~ '^\d+$')::text from wait_add('$ANNA', ' Ильины ', 4, 'у бара') x")" '^Ильины 4 у бара Анна Смирнова true$'
Q "select wait_add('$MARIA', '', 2, '')" >/dev/null
chk "доска: двое ждут, по порядку; без имени — пусто" "$(Q "select string_agg(coalesce(nullif(w->>'name', ''), '—') || ':' || (w->>'cnt'), ',') from jsonb_array_elements(seat_board('$ILYA')->'wait') w")" '^Ильины:4,—:2$'
chk "неверное: 0 гостей, 41, длинное имя, длинная заметка — bad_request" "$(Q "select wait_add('$ANNA', 'x', 0, '')->>'error'") $(Q "select wait_add('$ANNA', 'x', 41, '')->>'error'") $(Q "select wait_add('$ANNA', repeat('я', 41), 2, '')->>'error'") $(Q "select wait_add('$ANNA', 'x', 2, repeat('я', 61))->>'error'")" '^bad_request bad_request bad_request bad_request$'
ID1=$(PP "select id from sa_wait where name = 'Ильины'")
chk "посадили Ильиных за 4 — из листа ушли; второй раз — not_found" "$(Q "select wait_done('$ANNA', $ID1, 'seat', 't4')->>'ok'") $(PP "select done || ' ' || done_tid from sa_wait where id = $ID1") $(Q "select jsonb_array_length(seat_board('$ANNA')->'wait')") $(Q "select wait_done('$ANNA', $ID1, 'left', null)->>'error'")" '^true seat t4 1 not_found$'
ID2=$(PP "select id from sa_wait where done is null")
chk "«Ушли» — без стола; неизвестное how — bad_request" "$(Q "select wait_done('$ANNA', $ID2, 'gone', null)->>'error'") $(Q "select wait_done('$ANNA', $ID2, 'left', 't3')->>'ok'") $(PP "select done || ' ' || coalesce(done_tid, '-') from sa_wait where id = $ID2")" '^bad_request true left -$'
chk "Ирина (Порт) не видит и не трогает чужой лист" "$(Q "select jsonb_array_length(seat_board('$IRINA')->'wait')") $(Q "select wait_done('$IRINA', $ID1, 'left', null)->>'error'")" '^0 not_found$'
$P -c "insert into sa_wait (restaurant, day, name, cnt) select 'Два моря, Океан', (now() at time zone _sa_tz('Два моря, Океан'))::date, 'g' || g, 2 from generate_series(1, 40) g" >/dev/null
chk "40 ждут — 41-го не записать: too_many" "$(Q "select wait_add('$ANNA', 'x', 2, '')->>'error'")" '^too_many$'
$P -c "update sa_wait set day = day - 1" >/dev/null
chk "вчерашний лист на доске не видно" "$(Q "select jsonb_array_length(seat_board('$ANNA')->'wait')")" '^0$'

# ── сдвиг стола ox, oy
SAVE() { Q "select floor_save('$MARIA', '$1'::jsonb)"; }
ERR() { Q "select floor_save('$MARIA', '$1'::jsonb)->>'error'"; }
FINE() { printf '{"v":2,"sides":true,"fine":true,"zones":%s,"tables":%s,"items":[]}' "$Z" "$1"; }
OLD() { printf '{"v":2,"sides":true,"zones":%s,"tables":%s,"items":[]}' "$Z" "$1"; }   # приложение до v188: без признака fine
OFF() { PP "select coalesce(string_agg((t->>'n') || '=' || coalesce(t->>'ox', '-') || '/' || coalesce(t->>'oy', '-'), ' ' order by t->>'n'), '') from sa_floor, jsonb_array_elements(plan->'tables') t"; }
TF='[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0,"ox":0.25,"oy":-0.5},{"id":"t2","n":"2","seats":4,"shape":"sq","x":2,"y":0,"ox":0},{"id":"t3","n":"3","seats":6,"shape":"long","x":4,"y":0,"oy":0.75},{"id":"t4","n":"4","seats":2,"shape":"sq","x":0,"y":2,"ox":0.5,"sides":[1,1,0,0]}]'
chk "сдвиг 0.75 — bad_plan" "$(ERR "$(FINE "$TF")")" '^bad_plan$'
TF='[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0,"ox":0.25,"oy":-0.5},{"id":"t2","n":"2","seats":4,"shape":"sq","x":2,"y":0,"ox":0},{"id":"t3","n":"3","seats":6,"shape":"long","x":4,"y":0,"oy":null},{"id":"t4","n":"4","seats":2,"shape":"sq","x":0,"y":2,"ox":0.5,"sides":[1,1,0,0]}]'
chk "сдвиг в четвертях сохранён; ноль и null — не пишутся; стулья по сторонам рядом" "$(SAVE "$(FINE "$TF")" | grep -o '"ok": true') $(OFF) $(PP "select (plan->'tables'->3->'sides')::text from sa_floor")" '^"ok": true 1=0.25/-0.5 2=-/- 3=-/- 4=0.5/- \[1, 1, 0, 0\]$'
chk "0.3, строка «0.25», −0.6, буквы — bad_plan" "$(ERR "$(FINE '[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0,"ox":0.3}]')") $(ERR "$(FINE '[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0,"ox":"0.25"}]')") $(ERR "$(FINE '[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0,"oy":-0.6}]')") $(ERR "$(FINE '[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0,"oy":"a"}]')")" '^bad_plan bad_plan bad_plan bad_plan$'
chk "seat_board отдаёт сдвиг" "$(Q "select (x->'plan'->'tables'->0->>'ox') || ' ' || (x->'plan'->'tables'->0->>'oy') from seat_board('$ANNA') x")" '^0.25 -0.5$'
# приложение до v188 (без fine) сохраняет — у того же стола в той же клетке сдвиг остаётся; передвинул — нет
T_OLD='[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0},{"id":"t2","n":"2","seats":4,"shape":"sq","x":2,"y":0},{"id":"t3","n":"3","seats":6,"shape":"long","x":4,"y":0},{"id":"t4","n":"4","seats":2,"shape":"sq","x":1,"y":2}]'
chk "старое приложение сохраняет — сдвиг у стола на месте остаётся, у передвинутого — нет" "$(SAVE "$(OLD "$T_OLD")" | grep -o '"ok": true') $(OFF)" '^"ok": true 1=0.25/-0.5 2=-/- 3=-/- 4=-/-$'
chk "новое приложение (fine) без сдвига у стола — ровно в клетке" "$(SAVE "$(FINE '[{"id":"t1","n":"1","seats":4,"shape":"sq","x":0,"y":0}]')" | grep -o '"ok": true') $(OFF)" '^"ok": true 1=-/-$'
chk "проверки этапа 55 на месте: стулья по сторонам не сходятся с местами — bad_plan; стол на столе — overlap" "$(ERR "$(FINE '[{"id":"t1","n":"1","seats":5,"shape":"sq","x":0,"y":0,"sides":[2,0,1,0]}]')") $(ERR "$(FINE '[{"id":"t1","n":"1","seats":4,"shape":"tall","x":3,"y":3},{"id":"t2","n":"2","seats":2,"shape":"sq","x":3,"y":4}]')")" '^bad_plan overlap$'

# ── права и чужие
chk "права: anon зовёт seat_join, seat_unjoin, seat_move, wait_add, wait_done, seat_set" "$(PP "select string_agg(has_function_privilege('anon', f, 'execute')::text, ' ') from unnest(array['seat_join(text, text, jsonb)', 'seat_unjoin(text, text)', 'seat_move(text, text, text)', 'wait_add(text, text, int, text)', 'wait_done(text, bigint, text, text)', 'seat_set(text, text, text, int, text, text, text)']) f")" '^true true true true true true$'
chk "помощники anon не зовёт" "$(PP "select string_agg(has_function_privilege('anon', f, 'execute')::text, ' ') from unnest(array['_sa_seat_rows(text, date, text[])', '_sa_seat_reset(text, date, text[], text, text, text)', '_sa_seat_follow(text, date, text, text, text)', '_sa_wait_json(sa_wait)', '_sa_seat_json(sa_seat)']) f")" '^false false false false false$'
chk "чужой токен — auth" "$(Q "select seat_join('nope', 't1', '[\"t2\"]'::jsonb)->>'error'") $(Q "select seat_unjoin('nope', 't1')->>'error'") $(Q "select seat_move('nope', 't1', 't2')->>'error'") $(Q "select wait_add('nope', 'x', 2, '')->>'error'") $(Q "select wait_done('nope', 1, 'left', null)->>'error'")" '^auth auth auth auth auth$'
# этап 55 заново — seat2 нет; этап 56 после него — снова есть
$P0 -d $DB -f "$D/supabase-stage55-chair-sides.sql" >/dev/null 2>&1
A55=$(Q "select coalesce(x->>'seat2', 'нет') from seat_board('$ANNA') x")
$P0 -d $DB -f "$D/$S56" >/dev/null 2>&1
chk "этап 55 заново снимает seat2, этап 56 после него — возвращает" "$A55 $(Q "select x->>'seat2' from seat_board('$ANNA') x")" '^нет true$'

echo "итог: $pass ✓, $fail ✗"
[ "$fail" -eq 0 ]
