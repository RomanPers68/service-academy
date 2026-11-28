#!/bin/bash
# Этап 69 (v213, Доп. 539; v215, Доп. 541): очередь официантов, «Занят, передать дальше», очередь в «Рассадке» и
# колокольчики. Поверх базы run25.sh: копия satest69, этапы 26, 31, 32, 34, 35, 36, 37, 54, 55, 56, 38 и 68. В заведении
# ещё официанты Вера, Глеб, Дина и хостес Ольга; график на сегодня: Глеб — утро, Вера и Ольга — день, Анна — вечер,
# Мария — утро (Дина — в отпуске). Очередь утром пустая: её составляет хостес по приходу.
# Без этапа 68 — понятная ошибка. Этап 69 дважды. Отправка в Telegram — заглушка pg_net (net.sent_log).
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test69.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest69
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S68=supabase-stage68-call-series.sql; S69=supabase-stage69-waiter-queue.sql
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql"
POST="supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql supabase-stage54-tall-tables.sql supabase-stage55-chair-sides.sql supabase-stage56-join-move-wait.sql supabase-stage38-chat.sql"
D=$(mktemp -d); for f in $PRE $POST $S68 $S69; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3; ANNA=10000000-0000-0000-0000-0000000000a4
ILYA=10000000-0000-0000-0000-0000000000a5; VERA=10000000-0000-0000-0000-0000000000a7; GLEB=10000000-0000-0000-0000-0000000000a8
DINA=10000000-0000-0000-0000-0000000000a9; OLGA=10000000-0000-0000-0000-0000000000aa; IRINA=10000000-0000-0000-0000-0000000000b1
AEMP=00000000-0000-0000-0000-0000000000a4; VEMP=00000000-0000-0000-0000-0000000000a7; GEMP=00000000-0000-0000-0000-0000000000a8
DEMP=00000000-0000-0000-0000-0000000000a9; OEMP=00000000-0000-0000-0000-0000000000aa; IEMP=00000000-0000-0000-0000-0000000000a5
sent() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1' and body->>'text' like '%' || \$t\$$2\$t\$ || '%'"; }
# очередь коротко: имена по порядку, «·п» — на перерыве, «·у» — убран
QL() { Q "select string_agg(x->>'name' || case when (x->>'away')::boolean then '·п' else '' end || case when (x->>'out')::boolean then '·у' else '' end, ', ' order by o)
  from jsonb_array_elements(queue_get('$1')->'list') with ordinality t(x, o)"; }
TGU() { PP "select sa_tg_update('sec69', \$j\$$1\$j\$::jsonb)"; }
CBJ() { echo "{\"update_id\": $1, \"callback_query\": {\"id\": \"cq$1\", \"from\": {\"id\": $2}, \"data\": \"$3\", \"message\": {\"message_id\": 7$1, \"chat\": {\"id\": $2, \"type\": \"private\"}, \"text\": \"$4\", \"reply_markup\": {\"inline_keyboard\": [[{\"text\": \"Иду\", \"callback_data\": \"cg:1\"}, {\"text\": \"Занят, передать дальше\", \"callback_data\": \"cg:1:1\"}], [{\"text\": \"Открыть чат\", \"web_app\": {\"url\": \"https://app.example/?go=chat_1\"}}]]}}}}"; }

# ── Без этапа 68 — понятная ошибка ────────────────────────────────────────────────────
for f in $PRE; do run $f; done
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
for f in $POST; do run $f; done
chk "без этапа 68: «Сначала этап 68»" "$($P0 -d $DB -f "$D/$S69" 2>&1 | grep -o 'Сначала этап 68[^:]*: «Позвать» подряд' | head -1)" '^Сначала этап 68 \(supabase-stage68-call-series.sql\): «Позвать» подряд$'
run $S68
chk "этапы 26, 31, 32, 34, 35, 36, 37, 54, 55, 56, 38, 68 — без ошибок" "$RC" '^0$'

# ── Заведение: ещё официанты и хостес, график на сегодня, Telegram ──────────────────────────────────
PP "insert into employees (id, name, surname, restaurant, position, is_admin, status) values
   ('$VEMP', 'Вера', 'Соколова', 'Два моря, Океан', 'waiter', false, 'active'), ('$GEMP', 'Глеб', 'Орлов', 'Два моря, Океан', 'waiter', false, 'active'),
   ('$DEMP', 'Дина', 'Белова', 'Два моря, Океан', 'waiter', false, 'active'), ('$OEMP', 'Ольга', 'Ли', 'Два моря, Океан', 'hostess', false, 'active');
 insert into sessions (token, employee_id) values ('$VERA', '$VEMP'), ('$GLEB', '$GEMP'), ('$DINA', '$DEMP'), ('$OLGA', '$OEMP');
 insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values ('$VEMP', 555, 'Два моря, Океан', 'Вера Соколова', true),
   ('$GEMP', 666, 'Два моря, Океан', 'Глеб Орлов', true), ('$OEMP', 777, 'Два моря, Океан', 'Ольга Ли', true) on conflict (emp_id) do nothing;
 delete from schedule_months where restaurant = 'Два моря, Океан'; delete from schedule_venues where restaurant = 'Два моря, Океан';" >/dev/null
$P0 -d $DB -c "do \$\$ declare d date := (now() at time zone _sa_tz('Два моря, Океан'))::date; dn text := extract(day from d)::int::text; begin
  insert into schedule_venues (restaurant, venue_key, title, config) values ('Два моря, Океан', 'main', 'Океан', jsonb_build_object('staff', jsonb_build_array(
    jsonb_build_object('id', 's1', 'name', 'Анна Смирнова'), jsonb_build_object('id', 's2', 'name', 'Вера Соколова'), jsonb_build_object('id', 's3', 'name', 'Глеб Орлов'),
    jsonb_build_object('id', 's4', 'name', 'Дина Белова'), jsonb_build_object('id', 's5', 'name', 'Ольга Ли'), jsonb_build_object('id', 's6', 'name', 'Мария Ким')),
    'shifts', '[{\"k\":\"У\",\"name\":\"Утро\",\"from\":10,\"to\":18},{\"k\":\"Д\",\"name\":\"День\",\"from\":12,\"to\":20},{\"k\":\"В\",\"name\":\"Вечер\",\"from\":16,\"to\":24}]'::jsonb));
  insert into schedule_months (restaurant, venue_key, month, payload) values ('Два моря, Океан', 'main', to_char(d, 'YYYY-MM'), jsonb_build_object('plan', jsonb_build_object(
    's1', jsonb_build_object(dn, 'В'), 's2', jsonb_build_object(dn, 'Д'), 's3', jsonb_build_object(dn, 'У'), 's4', jsonb_build_object(dn, 'О'),
    's5', jsonb_build_object(dn, 'Д'), 's6', jsonb_build_object(dn, 'У'))));
end \$\$" >/dev/null
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST');
  insert into sa_settings (key, value) values ('app_url', 'https://app.example'), ('tg_webhook_secret', 'sec69') on conflict (key) do update set value = excluded.value" >/dev/null

# ── Этап 69 дважды ──────────────────────────────────────────────────────────────
RC=0; run $S69
chk "этап 69: итог" "$(echo "$OUT" | grep -o 'Очередь официантов: .*' | head -1 | sed 's/[[:space:]]*$//')" '^Очередь официантов: sa_queue закрыта, queue_get, queue_set, chat_pass, chat_call_state, chat_call_done, seat_set двигает очередь · очередей сегодня: [0-9]+$'
run $S69
chk "этап 69 ещё раз — без ошибок" "$RC" '^0$'
chk "таблица закрыта для ключа приложения" "$(Q "select count(*) from sa_queue")" 'permission denied'
chk "функции: security definer, вызывает ключ приложения, служебные — нет" "$(PP "select string_agg(proname || ':' || prosecdef || ':' || has_function_privilege('anon', oid, 'execute'), ' ' order by proname) from pg_proc
  where proname in ('queue_get', 'queue_set', 'chat_pass', '_sa_queue_ord', '_sa_chat_pass_do')")" \
  '^_sa_chat_pass_do:true:false _sa_queue_ord:true:false chat_pass:true:true queue_get:true:true queue_set:true:true$'

# ── Очередь на сегодня ─────────────────────────────────────────────────────────────
chk "утром очередь пустая: сама не собирается" "$(QL $OLGA)|$(Q "select jsonb_array_length(queue_get('$OLGA')->'list')")" '^\|0$'
chk "others — сегодняшние по началу смены (Глеб 10, Вера 12, Анна 16), потом остальные (Дина в отпуске)" \
  "$(Q "select string_agg((x->>'name') || ':' || coalesce(x->>'from', '-'), ', ' order by o) from jsonb_array_elements(queue_get('$OLGA')->'others') with ordinality t(x, o)")" \
  '^Глеб Орлов:10, Вера Соколова:12, Анна Смирнова:16, Дина Белова:-'
chk "хостес может менять, официант — нет" "$(Q "select (queue_get('$OLGA')->>'edit') || ' ' || (queue_get('$ANNA')->>'edit')")" '^true false$'
Q "select chat_call('$OLGA', 'person', '$AEMP', 'table', '2', null)" >/dev/null
chk "позвали Анну к столу, пока очереди нет, — в очередь она сама не попадает" "[$(QL $OLGA)]" '^\[\]$'
Q "select queue_set('$OLGA', jsonb_build_array(jsonb_build_object('id', '$AEMP'), jsonb_build_object('id', '$VEMP'), jsonb_build_object('id', '$GEMP')))" >/dev/null
chk "хостес составила по приходу: Анна, Вера, Глеб; видят все в заведении; без входа — auth; в Порту — своя, пустая" "$(QL $ANNA)|$(Q "select queue_get('x')->>'error'")|$(QL $IRINA)" \
  '^Анна Смирнова, Вера Соколова, Глеб Орлов\|auth\|$'
chk "официанту менять нельзя — forbidden" "$(Q "select queue_set('$ANNA', '[]'::jsonb)->>'error'")" '^forbidden$'
R=$(Q "select queue_set('$OLGA', jsonb_build_array(jsonb_build_object('id', '$GEMP'), jsonb_build_object('id', '$AEMP', 'away', true), jsonb_build_object('id', '$GEMP', 'away', true),
  jsonb_build_object('id', '$IEMP'), jsonb_build_object('id', '00000000-0000-0000-0000-0000000000b2')))->>'ok'")
chk "хостес: Глеб первым, Анна на перерыве; повтор, бармен и чужой официант отброшены; Вера (не прислали) — в конце" "$R|$(QL $OLGA)" '^true\|Глеб Орлов, Анна Смирнова·п, Вера Соколова$'
chk "мусор вместо порядка — bad_request" "$(Q "select queue_set('$OLGA', '{\"a\": 1}'::jsonb)->>'error'")" '^bad_request$'
Q "select queue_set('$OLGA', jsonb_build_array(jsonb_build_object('id', '$AEMP'), jsonb_build_object('id', '$VEMP'), jsonb_build_object('id', '$GEMP'), jsonb_build_object('id', '$DEMP')))" >/dev/null
chk "вернули порядок и дописали Дину (из others)" "$(QL $OLGA)" '^Анна Смирнова, Вера Соколова, Глеб Орлов, Дина Белова$'

# ── Позвали к столу — в конец ──────────────────────────────────────────────────────
PP "delete from net.sent_log" >/dev/null
C1=$(Q "select chat_call('$OLGA', 'person', '$AEMP', 'table', '13', null)->'msg'->>'id'")
chk "Ольга зовёт Анну к столу 13 — Анна в конце очереди" "$(QL $OLGA)" '^Вера Соколова, Глеб Орлов, Дина Белова, Анна Смирнова$'
chk "бот Анне: «Ольга зовёт тебя: к столу 13», кнопки «Иду» и «Занят, передать дальше» (cg:…:1)" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '111' and body->>'text' = 'Ольга зовёт тебя: к столу 13'
  and body->'reply_markup'->'inline_keyboard'->0->1->>'callback_data' = 'cg:$C1:1' and body->'reply_markup'->'inline_keyboard'->0->1->>'text' = 'Занят, передать дальше'")" '^1$'
Q "select chat_call('$OLGA', 'waiter', null, 'table', '5', null)" >/dev/null; Q "select chat_call('$OLGA', 'person', '$VEMP', 'help', null, null)" >/dev/null
chk "«официанта» к столу и Веру «нужна помощь» — очередь не двигают; у таких вызовов одна кнопка «Иду»" "$(QL $OLGA)|$(PP "select count(*) from net.sent_log where body->>'chat_id' = '555' and jsonb_array_length(body->'reply_markup'->'inline_keyboard'->0) = 1")" \
  '^Вера Соколова, Глеб Орлов, Дина Белова, Анна Смирнова\|2$'

# ── «Занят, передать дальше» ───────────────────────────────────────────────────────
PP "delete from net.sent_log" >/dev/null
CH=$(PP "select max(id) from sa_chat_msgs where kind = 'call' and call->>'why' = 'help'")
chk "чужой (Глеб) передать не может — forbidden; не тот вызов — bad_request" "$(Q "select chat_pass('$GLEB', $C1)->>'error'")|$(Q "select chat_pass('$OLGA', $CH)->>'error'")" '^forbidden\|bad_request$'
C2=$(Q "select chat_pass('$ANNA', $C1)->'next'->>'id'")
chk "Анна занята: стол уходит Вере (первая), новый вызов «Ольга зовёт Веру: к столу 13» от Ольги" "$(PP "select emp_id || '|' || body || '|' || (call->>'emp') || '|' || (call->'from'->>'name') || '|' || (call->'skip')::text from sa_chat_msgs where id = $C2")" \
  "^$OEMP\|Ольга зовёт Веру: к столу 13\|$VEMP\|Анна Смирнова\|\[\"$AEMP\"\]$"
chk "у прежнего вызова — passed: кто передал и кому" "$(PP "select (call->'passed'->>'by_name') || '→' || (call->'passed'->>'to_name') || ' ' || ((call->'passed'->>'msg')::bigint = $C2) from sa_chat_msgs where id = $C1")" '^Анна Смирнова→Вера Соколова true$'
chk "очередь: Анна первой (стол ей не достался), Вера — в конец" "$(QL $OLGA)" '^Анна Смирнова, Глеб Орлов, Дина Белова, Вера Соколова$'
chk "бот Вере: «… Анна передаёт этот стол тебе.» с двумя кнопками; Ольге — «Анна передаёт стол 13 дальше: позвали Веру.»" \
  "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '555' and body->>'text' = 'Ольга зовёт тебя: к столу 13. Анна передаёт этот стол тебе.' and body->'reply_markup'->'inline_keyboard'->0->1->>'callback_data' = 'cg:$C2:1'") $(sent 777 'Анна передаёт стол 13 дальше: позвали Веру.')" '^1 1$'
chk "вызовы мне: у Анны прежнего нет, у Веры — новый" "$(Q "select count(*) from jsonb_array_elements(chat_unread('$ANNA')->'calls') x where (x->>'id')::bigint = $C1")|$(Q "select count(*) from jsonb_array_elements(chat_unread('$VERA')->'calls') x where (x->>'id')::bigint = $C2")" '^0\|1$'
chk "передать второй раз — passed; «Иду» на переданный — passed" "$(Q "select chat_pass('$ANNA', $C1)->>'error'")|$(Q "select chat_go('$ANNA', $C1)->>'error'")" '^passed\|passed$'
C3=$(Q "select chat_pass('$OLGA', $C2)->'next'->>'id'")
chk "Вера не отвечает — Ольга передаёт: мимо Анны (уже передала) Глебу; skip: Анна и Вера" "$(PP "select (call->>'to_name') || '|' || (call->'from'->>'self') || '|' || (select string_agg(s, ',' order by s) from jsonb_array_elements_text(call->'skip') s) from sa_chat_msgs where id = $C3")" \
  "^Глеб Орлов\|false\|$AEMP,$VEMP\$"
chk "бот Глебу: «Вера не отвечает, стол передали тебе.»; Ольге (сама передала) — ничего" "$(sent 666 'Ольга зовёт тебя: к столу 13. Вера не отвечает, стол передали тебе.') $(sent 777 'Вера передаёт стол')" '^1 0$'
chk "очередь: Вера первой, Глеб — в конец" "$(QL $OLGA)" '^Вера Соколова, Анна Смирнова, Дина Белова, Глеб Орлов$'
Q "select queue_set('$OLGA', jsonb_build_array(jsonb_build_object('id', '$VEMP'), jsonb_build_object('id', '$AEMP'), jsonb_build_object('id', '$DEMP', 'away', true), jsonb_build_object('id', '$GEMP')))" >/dev/null
chk "Глеб занят, Дина на перерыве, Анна и Вера этот стол уже передали — передать некому: nobody" "$(Q "select chat_pass('$GLEB', $C3)->>'error'")|$(PP "select count(*) from sa_chat_msgs where kind = 'call' and id > $C3")" '^nobody\|0$'
Q "select chat_go('$GLEB', $C3)" >/dev/null
chk "Глеб пошёл («Иду») — передать уже нельзя: going" "$(Q "select chat_pass('$GLEB', $C3)->>'error'")" '^going$'
C4=$(Q "select chat_call('$OLGA', 'person', '$AEMP', 'table', '7', null)->'msg'->>'id'")
PP "update sa_chat_msgs set created_at = created_at - interval '11 minutes' where id = $C4" >/dev/null
chk "вызов старше 10 минут — stale" "$(Q "select chat_pass('$ANNA', $C4)->>'error'")" '^stale$'

# ── Кнопка в Telegram ─────────────────────────────────────────────────────────────────
C5=$(Q "select chat_call('$OLGA', 'person', '$AEMP', 'table', '9', null)->'msg'->>'id'")
Q "select queue_set('$OLGA', jsonb_build_array(jsonb_build_object('id', '$VEMP'), jsonb_build_object('id', '$DEMP'), jsonb_build_object('id', '$GEMP'), jsonb_build_object('id', '$AEMP')))" >/dev/null
PP "delete from net.sent_log" >/dev/null
TGU "$(CBJ 1 111 "cg:$C5:1" "Ольга зовёт тебя: к столу 9")" >/dev/null
chk "Telegram (Анна): «Занят, передать дальше» — стол Вере, сообщение бота: «Стол передан дальше: позвали Веру.», кнопок нет" \
  "$(PP "select call->'passed'->>'to_name' from sa_chat_msgs where id = $C5")|$(PP "select count(*) from net.sent_log where url like '%/editMessageText' and body->>'text' like '%Стол передан дальше: позвали Веру.' and jsonb_array_length(body->'reply_markup'->'inline_keyboard') = 1")|$(PP "select count(*) from net.sent_log where url like '%/answerCallbackQuery' and body->>'text' = 'Стол передан'")" \
  '^Вера Соколова\|1\|1$'
TGU "$(CBJ 2 111 "cg:$C5" "Ольга зовёт тебя: к столу 9")" >/dev/null
chk "Telegram: «Иду» на переданный стол — не идёт; «Этот стол уже передали дальше.»" "$(PP "select coalesce(jsonb_array_length(call->'going'), 0) from sa_chat_msgs where id = $C5")|$(PP "select count(*) from net.sent_log where url like '%/answerCallbackQuery' and body->>'text' = 'Этот стол уже передали дальше.'")" '^0\|1$'
C6=$(PP "select (call->'passed'->>'msg') from sa_chat_msgs where id = $C5")
Q "select queue_set('$OLGA', jsonb_build_array(jsonb_build_object('id', '$VEMP'), jsonb_build_object('id', '$DEMP', 'away', true), jsonb_build_object('id', '$GEMP', 'out', true), jsonb_build_object('id', '$AEMP')))" >/dev/null
TGU "$(CBJ 3 555 "cg:$C6:1" "Ольга зовёт тебя: к столу 9")" >/dev/null
chk "Telegram: передать некому — предупреждение, вызов остаётся у Веры" "$(PP "select count(*) from net.sent_log where url like '%/answerCallbackQuery' and (body->>'show_alert')::boolean and body->>'text' like 'Передать некому:%'")|$(PP "select coalesce(call ? 'passed', false) from sa_chat_msgs where id = $C6")" '^1\|f$'
TGU "$(CBJ 4 555 "cg:$C6" "Ольга зовёт тебя: к столу 9")" >/dev/null
chk "Telegram: «Иду» (Вера) — как раньше" "$(PP "select call->'going'->0->>'name' from sa_chat_msgs where id = $C6")" '^Вера Соколова$'

# ── «Рассадка»: посадили гостей — официант в конец очереди ─────────────────────────────────────────
PP "insert into sa_floor (restaurant, plan) values ('Два моря, Океан', '{\"v\": 1, \"tables\": [{\"id\": \"t13\", \"n\": \"13\", \"seats\": 4}, {\"id\": \"t14\", \"n\": \"14\", \"seats\": 2}]}'::jsonb)
  on conflict (restaurant) do update set plan = excluded.plan" >/dev/null
# очередь — напрямую: queue_set не убирает тех, кого не прислали, а здесь нужна очередь без Дины
PP "update sa_queue set ord = jsonb_build_array(jsonb_build_object('id', '$AEMP', 'away', false, 'out', false), jsonb_build_object('id', '$VEMP', 'away', false, 'out', false),
  jsonb_build_object('id', '$GEMP', 'away', false, 'out', false)) where restaurant = 'Два моря, Океан' and day = (now() at time zone _sa_tz('Два моря, Океан'))::date" >/dev/null
chk "посадили гостей за 13-й Анне — она в конце очереди" "$(Q "select seat_set('$OLGA', 't13', 'seat', 3, '', '', '$AEMP')->>'ok'")|$(QL $OLGA)" '^true\|Вера Соколова, Глеб Орлов, Анна Смирнова$'
Q "select seat_set('$OLGA', 't13', 'seat', 4, '', '', '$AEMP')" >/dev/null; Q "select seat_set('$OLGA', 't13', 'bill', 4, '', '', '$AEMP')" >/dev/null
chk "поправили число гостей и «Счёт» у того же официанта — очередь стоит" "$(QL $OLGA)" '^Вера Соколова, Глеб Орлов, Анна Смирнова$'
Q "select seat_set('$OLGA', 't14', 'seat', 2, '', '', '$DEMP')" >/dev/null
chk "посадили Дине (её нет в очереди) — очередь та же, Дину не дописали" "$(QL $OLGA)" '^Вера Соколова, Глеб Орлов, Анна Смирнова$'
Q "select seat_set('$OLGA', 't14', 'seat', 2, '', '', '$VEMP')" >/dev/null
chk "стол 14 передали Вере — она в конце" "$(QL $OLGA)" '^Глеб Орлов, Анна Смирнова, Вера Соколова$'

# ── Колокольчики: что с вызовами ──────────────────────────────────────────────────────────────
C7=$(Q "select chat_call('$OLGA', 'person', '$GEMP', 'table', '21', null)->'msg'->>'id'")
ST() { Q "select string_agg((x->>'id') || ':' || (x->>'st') || ':' || (x->>'name') || ':' || coalesce(x->>'by', '-') || ':' || (x->>'hops'), ', ' order by o)
  from jsonb_array_elements(chat_call_state('$1', array[$2]::bigint[])->'list') with ordinality t(x, o)"; }
chk "вызов 13-го: передавали дважды, Глеб нажал «Иду»; 9-го: передали Вере, она идёт; 21-го: ждём; 7-го: 10 минут без ответа" \
  "$(ST $OLGA "$C1, $C5, $C7, $C4")" "^$C1:going:Глеб Орлов:Глеб Орлов:2, $C5:going:Вера Соколова:Вера Соколова:1, $C7:wait:Глеб Орлов:-:0, $C4:gone:Анна Смирнова:-:0\$"
chk "официант своего заведения тоже видит; чужое заведение — пусто; не вызов и мусор — пропуск" "$(ST $ANNA "$C7")|$(ST $IRINA "$C7")|$(ST $OLGA "$CH, 999999")" \
  "^$C7:wait:Глеб Орлов:-:0\|\|$CH:wait:Вера Соколова:-:0$"
chk "больше 40 — bad_request; без входа — auth; ключу приложения можно" "$(Q "select chat_call_state('$OLGA', array(select generate_series(1, 41))::bigint[])->>'error'")|$(Q "select chat_call_state('x', array[1]::bigint[])->>'error'")|$(PP "select has_function_privilege('anon', 'chat_call_state(text, bigint[])', 'execute')")" \
  '^bad_request\|auth\|t$'

# ── «На месте»: официант подошёл, не нажав «Иду» ─────────────────────────────────────────────────
chk "Глеб видит вызов к 21-му у себя; официант (Анна) отметить «на месте» не может — forbidden" \
  "$(Q "select count(*) from jsonb_array_elements(chat_unread('$GLEB')->'calls') x where (x->>'id')::bigint = $C7")|$(Q "select chat_call_done('$ANNA', $C7)->>'error'")" '^1\|forbidden$'
chk "Ольга: «На месте» — done в вызове, у Глеба вызов пропал, колокольчик — done (отметила Ольга)" \
  "$(Q "select (chat_call_done('$OLGA', $C7)->'msg'->'call'->'done'->>'by_name')")|$(Q "select count(*) from jsonb_array_elements(chat_unread('$GLEB')->'calls') x where (x->>'id')::bigint = $C7")|$(ST $OLGA "$C7")" \
  "^Ольга Ли\|0\|$C7:done:Глеб Орлов:Ольга Ли:0\$"
T0=$(PP "select call->'done'->>'at' from sa_chat_msgs where id = $C7")
chk "второй раз — то же время; передать дальше нельзя — going" "$(Q "select (chat_call_done('$OLGA', $C7)->'msg'->'call'->'done'->>'at') = '$T0'")|$(Q "select chat_pass('$OLGA', $C7)->>'error'")" '^t(rue)?\|going$'
chk "права: chat_call_done — ключу приложения можно" "$(PP "select has_function_privilege('anon', 'chat_call_done(text, bigint)', 'execute')")" '^t$'

# ── Уволили, сменили должность, новый день ──────────────────────────────────────────────────
PP "update employees set status = 'fired' where id = '$DEMP'; update employees set position = 'bartender' where id = '$GEMP'" >/dev/null
chk "уволенной и сменившего должность в очереди нет" "$(QL $OLGA)" '^Анна Смирнова, Вера Соколова$'
PP "update sa_queue set day = day - 1" >/dev/null
chk "новый день — очередь снова пустая, пока хостес не составит" "$(QL $ANNA)|$(PP "select count(*) from sa_queue where restaurant = 'Два моря, Океан'")" '^\|2$'
PP "update sa_queue set day = day - 9 where day < (now() at time zone _sa_tz('Два моря, Океан'))::date" >/dev/null
Q "select queue_get('$ANNA')" >/dev/null
chk "старше недели — стирается" "$(PP "select count(*) from sa_queue where restaurant = 'Два моря, Океан'")" '^1$'

echo; echo "Итого: ✓ $pass  ✗ $fail"
$P0 -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
[ "$fail" -eq 0 ]
