#!/bin/bash
# Этап 37 (v88, Доп. 401): залы и стены на схеме зала (floor_save v2, seat_board floor 2), «Вопрос дня» в приложении
# (qday_today / qday_answer, серия, свой час notify_qday_hour_set, _sa_qday_at, хранение ответов в qday_push).
# Поверх базы run25.sh: копия satest37, этапы 26, 31, 32, 34, 35, 36 и 37 (37 — дважды), проверки ✓/✗ и итог.
# Отправка в Telegram — заглушка pg_net (net.sent_log). Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и
# PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test37.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest37
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
FILES="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
D=$(mktemp -d); for f in $FILES; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT37=""
# без этапа 31 этап 37 не идёт: просит сначала его
NO31=$($P0 -d $DB -f "$D/supabase-stage37-halls-qday.sql" 2>&1)
for f in $FILES supabase-stage37-halls-qday.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
  [ "$f" = supabase-stage37-halls-qday.sql ] && OUT37="$out"
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2; ILYA=10000000-0000-0000-0000-0000000000a5
IRINA=10000000-0000-0000-0000-0000000000b1
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5

chk "без этапа 31 — понятная ошибка: какой этап сначала" "$NO31" 'Сначала этап 31 \(supabase-stage31-qday.sql\)'
chk "этапы 26, 31, 32, 34, 35, 36 и 37 (37 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 5 функций, залы и стены, свой час" "$OUT37" 'залы и вопрос дня: 5 функций из 5 · схема: залы и стены · свой час вопроса: да · час заведения: 12:00'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_qday; delete from sa_notify_prefs; delete from sa_floor; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null

# ── схема зала v2
V1='{"v":1,"tables":[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0},{"id":"t2","n":"2","seats":4,"shape":"long","x":2,"y":0}]}'
chk "старое приложение (v1): принято как один зал «Зал», столы в нём" "$(Q "select floor_save('$MARIA', '$V1'::jsonb)->>'v'")|$(PP "select plan->'zones'->0->>'name' || ' ' || (plan->'tables'->1->>'z') || ' ' || jsonb_array_length(plan->'items') from sa_floor")" '^2\|Зал z1 0$'
ZONES='[{"id":"z1","name":"Основной"},{"id":"z2","name":"Веранда"}]'
ITEMS='[{"id":"i1","kind":"wall","x":0,"y":3,"x2":8,"y2":3},{"id":"i2","kind":"bar","x":5,"y":0,"w":3,"h":1},{"id":"i3","kind":"door","x":7,"y":5},{"id":"i4","kind":"wall","x":2,"y":0,"x2":2,"y2":3,"z":"z2"}]'
TABLES='[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0},{"id":"t2","n":"2","seats":4,"shape":"long","x":2,"y":0,"z":"z1"},{"id":"t3","n":"В1","seats":4,"shape":"rd","x":0,"y":0,"z":"z2"},{"id":"t4","n":"В2","seats":2,"shape":"sq","x":3,"y":3,"z":"z2"}]'
PLAN2="{\"v\":2,\"zones\":$ZONES,\"tables\":$TABLES,\"items\":$ITEMS}"
R=$(Q "select floor_save('$MARIA', '$PLAN2'::jsonb)")
chk "два зала, стены, бар и вход: сохранено (столы в разных залах на одной клетке — можно)" "$R" '"ok": true.*"zones": 2|"zones": 2.*"ok": true'
chk "схема хранится v2: зал стола без z — первый, стена по узлам сетки, бар и вход" "$(PP "select (plan->'tables'->0->>'z') || ' ' || (plan->'items'->0->>'x2') || ' ' || (plan->'items'->1->>'w') || ' ' || (plan->'items'->2->>'kind') || ' ' || (plan->'items'->3->>'z') from sa_floor")" '^z1 8 3 door z2$'
chk "seat_board: floor 2 и схема с залами" "$(Q "select (x->>'floor') || ' ' || jsonb_array_length(x->'plan'->'zones') || ' ' || jsonb_array_length(x->'plan'->'items') from seat_board('$ANNA') x")" '^2 2 4$'
chk "старое приложение после залов и стен — old_app (схема не затёрта)" "$(Q "select floor_save('$MARIA', '$V1'::jsonb)->>'error'")|$(PP "select jsonb_array_length(plan->'zones') from sa_floor")" '^old_app\|2$'
P2() { printf '{"v":2,"zones":%s,"tables":%s,"items":%s}' "$1" "$2" "$3"; }
ERR() { Q "select floor_save('$MARIA', '$1'::jsonb)->>'error'"; }
chk "залы: пустое имя, 7 залов, плохой номер — bad_plan" "$(ERR "$(P2 '[{"id":"z1","name":" "}]' '[]' '[]')") $(ERR "$(P2 '[{"id":"z1","name":"1"},{"id":"z2","name":"2"},{"id":"z3","name":"3"},{"id":"z4","name":"4"},{"id":"z5","name":"5"},{"id":"z6","name":"6"},{"id":"z7","name":"7"}]' '[]' '[]')") $(ERR "$(P2 '[{"id":"zone 1","name":"Зал"}]' '[]' '[]')")" '^bad_plan bad_plan bad_plan$'
chk "залы с одним именем (регистр не важен) — duplicate" "$(ERR "$(P2 '[{"id":"z1","name":"Веранда"},{"id":"z2","name":"веранда"}]' '[]' '[]')")" '^duplicate$'
chk "стол в несуществующем зале — bad_plan" "$(ERR "$(P2 "$ZONES" '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0,"z":"z9"}]' '[]')")" '^bad_plan$'
chk "стены: по диагонали, нулевой длины, за краем — bad_plan" "$(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"wall","x":0,"y":0,"x2":2,"y2":2}]')") $(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"wall","x":3,"y":3,"x2":3,"y2":3}]')") $(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"wall","x":0,"y":0,"x2":9,"y2":0}]')")" '^bad_plan bad_plan bad_plan$'
chk "бар за краем, вход в 8-й клетке, окно (нет такого), плохой номер — bad_plan" "$(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"bar","x":6,"y":0,"w":3,"h":1}]')") $(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"door","x":8,"y":0}]')") $(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"window","x":0,"y":0}]')") $(ERR "$(P2 "$ZONES" '[]' '[{"id":"x1","kind":"door","x":0,"y":0}]')")" '^bad_plan bad_plan bad_plan bad_plan$'
chk "бар без размера и с буквами вместо чисел — bad_plan, не ошибка базы" "$(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"bar","x":0,"y":0}]')") $(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"wall","x":"a","y":0,"x2":2,"y2":0}]')")" '^bad_plan bad_plan$'
chk "два предмета с одним номером — duplicate" "$(ERR "$(P2 "$ZONES" '[]' '[{"id":"i1","kind":"door","x":0,"y":0},{"id":"i1","kind":"door","x":1,"y":0}]')")" '^duplicate$'
MANY=$(python3 -c 'import json; print(json.dumps([{"id":"i%d"%i,"kind":"door","x":i%8,"y":i//8} for i in range(61)]))')
chk "больше 60 предметов — bad_plan" "$(ERR "$(P2 "$ZONES" '[]' "$MANY")")" '^bad_plan$'
chk "стол на баре, на входе, длинный краем на баре — overlap" "$(ERR "$(P2 "$ZONES" '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":5,"y":0}]' '[{"id":"i1","kind":"bar","x":5,"y":0,"w":3,"h":1}]')") $(ERR "$(P2 "$ZONES" '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":7,"y":5}]' '[{"id":"i1","kind":"door","x":7,"y":5}]')") $(ERR "$(P2 "$ZONES" '[{"id":"t1","n":"1","seats":2,"shape":"long","x":4,"y":0}]' '[{"id":"i1","kind":"bar","x":5,"y":0,"w":3,"h":1}]')")" '^overlap overlap overlap$'
chk "стол на клетке бара другого зала, стол под стеной — можно" "$(Q "select floor_save('$MARIA', '$(P2 "$ZONES" '[{"id":"t1","n":"1","seats":2,"shape":"sq","x":5,"y":0,"z":"z2"},{"id":"t2","n":"2","seats":2,"shape":"sq","x":0,"y":3}]' '[{"id":"i1","kind":"bar","x":5,"y":0,"w":3,"h":1},{"id":"i2","kind":"wall","x":0,"y":3,"x2":8,"y2":3}]')'::jsonb)->>'ok'")" '^true$'
chk "сотруднику — forbidden, чужой токен — auth" "$(Q "select floor_save('$ANNA', '$PLAN2'::jsonb)->>'error'") $(Q "select floor_save('мусор', '$PLAN2'::jsonb)->>'error'")" '^forbidden auth$'
Q "select floor_save('$MARIA', '$PLAN2'::jsonb)" >/dev/null
chk "доска работает со столом второго зала: посадили за В1" "$(Q "select seat_set('$MARIA', 't3', 'seat', 3, '', '', '$AEMP')->'table'->>'status'")" '^seat$'

# ── «Вопрос дня» в приложении
QITEMS='[{"k":"a1","q":"Через сколько секунд гостя нужно поприветствовать?","o":["30 секунд","Через 5 минут","Когда сядет"],"c":0,"e":"Первый контакт — до 30 секунд.","t":"Встреча гостя","r":"Официант"},
 {"k":"b2","q":"Что сделать, если гость ждёт счёт дольше 5 минут?","o":["Извиниться и принести сразу","Ничего","Позвать охрану"],"c":0,"e":"Счёт — последнее впечатление.","t":"Расчёт","r":"Официант"}]'
chk "qday_push: очередь из двух, час 12" "$(Q "select (x->>'queued') || ' ' || (x->>'hour') from qday_push('$ANNA', '$QITEMS'::jsonb) x")" '^2 12$'
R=$(Q "select qday_today('$ANNA')")
QID=$(Q "select qday_today('$ANNA')->'item'->>'id'")
chk "qday_today: первый вопрос из очереди, показан в приложении, ответа и разбора ещё нет, серия 0" "$R" '"item": \{.*"q": "Через сколько секунд.*"via": "app".*\}.*"streak": 0'
chk "до ответа верный вариант не отдаём" "$(Q "select (qday_today('$ANNA')->'item') ? 'c'")" '^f$'
chk "второй раз — тот же вопрос, очередь не тратится" "$(Q "select qday_today('$ANNA')->'item'->>'id'")|$(Q "select qday_today('$ANNA')->>'queued'")" "^$QID\\|1$"
TZ=$(PP "select _sa_tz('Два моря, Океан')")
NOON=$(PP "select ((date_trunc('day', now() at time zone '$TZ') + interval '12 hours 5 minutes') at time zone '$TZ')::text")
chk "в 12:05 бот пришлёт Анне тот же вопрос (открыт в приложении, ответа нет)" "$(PP "select x from jsonb_array_elements(sa_qday_preview('$NOON')) x where x->>'emp' = '$AEMP'")" "\"id\": $QID.*\"same\": true|\"same\": true.*\"id\": $QID"
chk "ответ из приложения: неверно — верный вариант и разбор, серия 1" "$(Q "select qday_answer('$ANNA', $QID, 2)")" '"ok": true.*"c": 0.*"correct": false.*"streak": 1|"streak": 1.*"ok": true'
chk "второй ответ — again, засчитан первый" "$(Q "select (x->>'error') || ' ' || (x->'item'->>'answer') from qday_answer('$ANNA', $QID, 0) x")" '^again 2$'
chk "ответила в приложении — в 12:05 бот ей сегодня ничего не пришлёт" "$(PP "select count(*) from jsonb_array_elements(sa_qday_preview('$NOON')) x where x->>'emp' = '$AEMP'")" '^0$'
chk "ответ из приложения виден в qday_inbox (банк ошибок в приложении)" "$(Q "select x->>'answer' from jsonb_array_elements(qday_inbox('$ANNA')->'items') x where (x->>'id')::bigint = $QID")" '^2$'
chk "ответ: чужой вопрос — not_found, вариант за пределами — bad_request" "$(Q "select qday_answer('$ILYA', $QID, 0)->>'error'") $(Q "select qday_answer('$ANNA', $QID, 7)->>'error'")" '^not_found bad_request$'
NEXTQ=$(PP "select id from sa_qday where emp_id = '$AEMP' and sent_day is null limit 1")
chk "неотправленный вопрос ответить нельзя — not_found" "$(Q "select qday_answer('$ANNA', $NEXTQ, 0)->>'error'")" '^not_found$'
# Илья: вопрос пришёл в Telegram — в приложении тот же; ответ в приложении, потом кнопка в чате — «Ответ уже засчитан»
Q "select qday_push('$ILYA', '$QITEMS'::jsonb)" >/dev/null
$P -c "delete from net.sent_log; delete from tg_sent" >/dev/null
PP "select _sa_qday_at(true, '$NOON')" >/dev/null
IQ=$(PP "select id from sa_qday where emp_id = '$IEMP' and chat_id = 222")
chk "бот прислал Илье вопрос (via tg), в приложении — он же" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '222'")|$(Q "select (x->'item'->>'id') || ' ' || (x->'item'->>'via') from qday_today('$ILYA') x")" "^1\\|$IQ tg\$"
chk "Илья ответил в приложении: верно" "$(Q "select (x->'item'->>'correct') || ' ' || (x->>'streak') from qday_answer('$ILYA', $IQ, 0) x")" '^true 1$'
SECRET=$(PP "select value from sa_settings where key = 'tg_webhook_secret'")
[ -z "$SECRET" ] && { PP "insert into sa_settings (key, value) values ('tg_webhook_secret', 'sekret') on conflict (key) do update set value = excluded.value" >/dev/null; SECRET=sekret; }
chk "кнопка в Telegram после ответа в приложении — «Ответ уже засчитан»" "$(PP "select sa_tg_update('$SECRET', '{\"callback_query\":{\"id\":\"cb1\",\"data\":\"qd:$IQ:1\",\"from\":{\"id\":222}}}'::jsonb)->>'skip'")" '^again$'

# ── серия
$P -c "update sa_qday set sent_day = sent_day - 1 where emp_id = '$AEMP' and id = $QID" >/dev/null
$P -c "insert into sa_qday (emp_id, restaurant, k, item, sent_day, answer, correct, answered_at, via) select '$AEMP', 'Два моря, Океан', 'old' || g, '{\"q\":\"x\",\"o\":[\"a\",\"b\"],\"c\":0}', (now() at time zone '$TZ')::date - g, 0, true, now() - g * interval '1 day', 'tg' from generate_series(2, 4) g" >/dev/null
chk "серия: вчера и ещё три дня до того — 4; сегодня ответа ещё нет — серия не прервана" "$(Q "select (x->>'streak') || ' ' || (x->'item'->>'id' is not null) from qday_today('$ANNA') x")" '^4 true$'
TQ=$(Q "select qday_today('$ANNA')->'item'->>'id'")
chk "ответ сегодня — серия 5" "$(Q "select qday_answer('$ANNA', $TQ, 1)->>'streak'")" '^5$'
$P -c "delete from sa_qday where emp_id = '$AEMP' and k = 'old3'" >/dev/null
chk "пропуск в середине — серия считается от него: 3" "$(Q "select qday_today('$ANNA')->>'streak'")" '^3$'

# ── свой час
chk "свой час: 5 и 23 — bad_request" "$(Q "select notify_qday_hour_set('$ANNA', 5)->>'error'") $(Q "select notify_qday_hour_set('$ANNA', 23)->>'error'")" '^bad_request bad_request$'
chk "Анна: свой час 9 — в настройках 9 (свой 9, у заведения 12)" "$(Q "select (x->>'qday_hour') || ' ' || (x->>'qday_hour_mine') || ' ' || (x->>'qday_hour_default') from notify_qday_hour_set('$ANNA', 9) x")" '^9 9 12$'
chk "свой час — не вид сообщений (колонка не булева): переключателя qday_hour нет" "$(Q "select notify_set('$ANNA', 'qday_hour', true)->>'error'")" '^kind$'
$P -c "delete from tg_sent; delete from sa_qday where emp_id = '$AEMP' and sent_day = (now() at time zone '$TZ')::date" >/dev/null
Q "select qday_push('$ANNA', '[{\"k\":\"c3\",\"q\":\"Вопрос на завтра\",\"o\":[\"да\",\"нет\"],\"c\":0}]'::jsonb)" >/dev/null
NINE=$(PP "select ((date_trunc('day', now() at time zone '$TZ') + interval '9 hours 3 minutes') at time zone '$TZ')::text")
chk "свой час 9: в 12:05 Анне не придёт, в 9:03 — придёт" "$(PP "select count(*) from jsonb_array_elements(sa_qday_preview('$NOON')) x where x->>'emp' = '$AEMP'")|$(PP "select count(*) from jsonb_array_elements(sa_qday_preview('$NINE')) x where x->>'emp' = '$AEMP' and (x->>'hour')::int = 9")" '^0\|1$'
chk "вернуть час заведения (null) — снова 12" "$(Q "select (x->>'qday_hour') || ' ' || coalesce(x->>'qday_hour_mine', 'нет') from notify_qday_hour_set('$ANNA', null) x")" '^12 нет$'
chk "qday_push отвечает своим часом" "$(Q "select notify_qday_hour_set('$ANNA', 18)->>'ok'")|$(Q "select qday_push('$ANNA', '[]'::jsonb)->>'hour'")" '^true\|18$'

# ── хранение: отвеченные — год, неотвеченные — 60 дней
$P -c "insert into sa_qday (emp_id, restaurant, k, item, sent_day, answer, correct, answered_at) values ('$AEMP', 'Два моря, Океан', 'y1', '{\"q\":\"x\",\"o\":[\"a\",\"b\"],\"c\":0}', current_date - 200, 0, true, now() - interval '200 days'), ('$AEMP', 'Два моря, Океан', 'y2', '{\"q\":\"x\",\"o\":[\"a\",\"b\"],\"c\":0}', current_date - 200, null, null, null), ('$AEMP', 'Два моря, Океан', 'y3', '{\"q\":\"x\",\"o\":[\"a\",\"b\"],\"c\":0}', current_date - 500, 0, true, now() - interval '500 days')" >/dev/null
Q "select qday_push('$ANNA', '[]'::jsonb)" >/dev/null
chk "qday_push: отвеченный 200 дней назад остался, неотвеченный и отвеченный 500 дней назад — убраны" "$(PP "select string_agg(k, ',' order by k) from sa_qday where emp_id = '$AEMP' and k like 'y%'")" '^y1$'

# ── права
chk "anon: qday_today, qday_answer, notify_qday_hour_set, floor_save, seat_board — можно" "$(PP "select has_function_privilege('anon', 'public.qday_today(text)', 'execute') and has_function_privilege('anon', 'public.qday_answer(text, bigint, int)', 'execute') and has_function_privilege('anon', 'public.notify_qday_hour_set(text, int)', 'execute') and has_function_privilege('anon', 'public.floor_save(text, jsonb)', 'execute') and has_function_privilege('anon', 'public.seat_board(text)', 'execute')")" '^t$'
chk "anon: служебные функции — нельзя" "$(PP "select has_function_privilege('anon', 'public._sa_qday_hour_of(text)', 'execute') or has_function_privilege('anon', 'public._sa_qday_streak(text, date)', 'execute') or has_function_privilege('anon', 'public._sa_qday_json(sa_qday)', 'execute') or has_function_privilege('anon', 'public._sa_qday_at(boolean, timestamptz)', 'execute')")" '^f$'
chk "чужой токен — auth (qday_today, qday_answer, notify_qday_hour_set)" "$(Q "select qday_today('мусор')->>'error'") $(Q "select qday_answer('мусор', 1, 0)->>'error'") $(Q "select notify_qday_hour_set('мусор', 9)->>'error'")" '^auth auth auth$'

echo "Итого: $pass ✓, $fail ✗"
