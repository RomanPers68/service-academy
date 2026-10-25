#!/bin/bash
# Этап 31 (v81, Доп. 394): «Вопрос дня» в Telegram с кнопками. Поверх базы run25.sh: копия satest31, этапы 26 и 31
# (31 — дважды: повторный запуск безопасен), проверки ✓/✗ и итог. Отправка в Telegram — заглушка pg_net (net.sent_log).
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test31.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest31
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
D=$(mktemp -d); cp "$SRC"/supabase-stage26-mastery.sql "$SRC"/supabase-stage31-qday.sql "$D"/; chmod -R a+r "$D"
RC=0; OUT31=""
for f in supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage31-qday.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
  [ "$f" = supabase-stage31-qday.sql ] && OUT31="$out"
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:600}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5
AEMP=00000000-0000-0000-0000-0000000000a4
NOON='2026-10-23 00:05+00'      # 12:05 по Камчатке (UTC+12)
LATE='2026-10-23 00:15+00'      # 12:15 — окно прошло
NEXT='2026-10-24 00:03+00'      # завтра, 12:03

chk "этапы 26 и 31 (31 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 14 функций, таблица, час 12:00" "$OUT31" 'вопрос дня: 14 функций из 14 · таблица: есть · час: 12:00'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_qday; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null

# ── настройки сообщений
chk "notify_prefs: «Вопрос дня» включён по умолчанию, час 12" "$(Q "select notify_prefs('$ANNA')")" '"qday": true.*"qday_hour": 12'
chk "notify_prefs по-прежнему знает «master» (этап 26)" "$(Q "select notify_prefs('$ANNA')->>'master'")" '^true$'
chk "notify_set: qday можно выключить" "$(Q "select notify_set('$ANNA', 'qday', false)->>'qday'")" '^false$'
chk "notify_set: неизвестный вид — ошибка" "$(Q "select notify_set('$ANNA', 'spam', true)->>'error'")" '^kind$'
$P -c "set role anon; select notify_set('$ANNA', 'qday', true)" >/dev/null

# ── очередь от приложения
ITEMS='[{"k":"a1","q":"Через сколько секунд гостя нужно поприветствовать?","o":["30 секунд","Через 5 минут","Когда сядет"],"c":0,"e":"Первый контакт — до 30 секунд.","t":"Встреча гостя","r":"Новичок"},
 {"k":"bad5","q":"Пять вариантов","o":["1","2","3","4","5"],"c":0},
 {"k":"badc","q":"Неверный номер","o":["да","нет"],"c":3},
 {"k":"a1","q":"Дубль того же вопроса","o":["да","нет"],"c":0},
 {"k":"b2","q":"Что сделать, если гость ждёт счёт дольше 5 минут?","o":["Извиниться и принести сразу","Ничего","Позвать охрану","Сделать скидку молча"],"c":0,"e":"Счёт — последнее впечатление.","t":"Прощание","r":"Новичок"}]'
chk "qday_push: из пяти — два годных (мусор и дубль отброшены), час 12" "$(Q "select qday_push('$ANNA', '$ITEMS'::jsonb)")" '"ok": true.*"queued": 2|"queued": 2.*"ok": true'
chk "qday_push: чужой токен — auth" "$(Q "select qday_push('мусор', '[]'::jsonb)->>'error'")" '^auth$'
chk "qday_push: не массив — bad_request" "$(Q "select qday_push('$ANNA', '{}'::jsonb)->>'error'")" '^bad_request$'
chk "очередь: два вопроса Анны по порядку" "$(PP "select string_agg(k, ',' order by ord) from sa_qday where emp_id = '$AEMP' and sent_day is null")" '^a1,b2$'
chk "повторная отправка очереди заменяет неотправленное" "$(Q "select qday_push('$ANNA', '$ITEMS'::jsonb)->>'queued'"),$(PP "select count(*) from sa_qday where emp_id = '$AEMP'")" '^2,2$'

# ── отправка по расписанию
chk "просмотр в 12:05 по часам заведения — первый вопрос Анне в чат 111" "$(PP "select sa_qday_preview('$NOON')")" '"q": "Через сколько секунд.*"chat": 111'
chk "в 12:15 окно прошло — никому" "$(PP "select jsonb_array_length(sa_qday_preview('$LATE'))")" '^0$'
chk "просмотр ничего не отмечает и не шлёт" "$(PP "select count(*) from net.sent_log")|$(PP "select count(*) from sa_qday where sent_day is not null")" '^0\|0$'
PP "select _sa_qday_at(true, '$NOON')" >/dev/null
SENT=$(PP "select body::text from net.sent_log where url like '%/sendMessage' order by id desc limit 1")
chk "отправка: sendMessage в чат 111 с вопросом, вариантами «А.», «Б.», «В.»" "$(printf '%s' "$SENT" | grep -c '"chat_id": 111')|$SENT" '^1\|.*"text": "Вопрос дня · Новичок\\n\\nЧерез сколько секунд гостя нужно поприветствовать\?\\n\\nА\. 30 секунд\\nБ\. Через 5 минут\\nВ\. Когда сядет"'
QID=$(PP "select id from sa_qday where k = 'a1' and emp_id = '$AEMP'")
chk "кнопки — буквы А, Б, В: callback «qd:<номер>:<вариант>»" "$SENT" "\"inline_keyboard\": \[\[\{\"text\": \"А\", \"callback_data\": \"qd:$QID:0\"\}, \{\"text\": \"Б\", \"callback_data\": \"qd:$QID:1\"\}, \{\"text\": \"В\", \"callback_data\": \"qd:$QID:2\"\}\]\]"
chk "вопрос отмечен: день по часам заведения, чат" "$(PP "select sent_day || ' ' || chat_id from sa_qday where id = $QID")" '^2026-10-23 111$'
PP "select _sa_qday_at(true, '$NOON')" >/dev/null
chk "второй раз в тот же день — не шлём" "$(PP "select count(*) from net.sent_log where url like '%/sendMessage'")" '^1$'
chk "Илья без очереди — ему ничего (приложение ещё не прислало вопросы)" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '222'")" '^0$'
$P -c "set role anon; select notify_set('$ANNA', 'qday', false)" >/dev/null
chk "выключил «Вопрос дня» — завтра не придёт" "$(PP "select jsonb_array_length(sa_qday_preview('$NEXT'))")" '^0$'
$P -c "set role anon; select notify_set('$ANNA', 'qday', true)" >/dev/null
chk "включил — завтра придёт второй вопрос" "$(PP "select sa_qday_preview('$NEXT')")" '"q": "Что сделать, если гость ждёт счёт'
$P -c "update tg_links set remind = false where emp_id = '$AEMP'" >/dev/null
chk "общий выключатель Telegram выключен — не шлём" "$(PP "select jsonb_array_length(sa_qday_preview('$NEXT'))")" '^0$'
$P -c "update tg_links set remind = true where emp_id = '$AEMP'; delete from vault.secrets_stub" >/dev/null
chk "без токена бота — никому" "$(PP "select jsonb_array_length(sa_qday_preview('$NEXT'))")" '^0$'
$P -c "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST')" >/dev/null

# ── подключение вебхука
CODE=$(PP "select sa_tg_setup_code()" | sed -n 's/.*Код на 30 минут: \([0-9a-f]\{12\}\).*/\1/p')
chk "sa_tg_setup_code: код из 12 знаков и ссылка на tg-bot" "$(PP "select sa_tg_setup_code()")" 'Код на 30 минут: [0-9a-f]{12}.*functions/v1/tg-bot\?setup='
CODE=$(PP "select split_part(value, '|', 1) from sa_settings where key = 'tg_setup_code'")
SECRET=$(PP "select value from sa_settings where key = 'tg_webhook_secret'")
chk "секрет вебхука — 64 знака, повторный код его не меняет" "${#SECRET},$(PP "select sa_tg_setup_code() is not null"),$(PP "select value = '$SECRET' from sa_settings where key = 'tg_webhook_secret'")" '^64,t,t$'
CODE=$(PP "select split_part(value, '|', 1) from sa_settings where key = 'tg_setup_code'")
chk "sa_tg_setup_take: чужой код — нет" "$(PP "select sa_tg_setup_take('000000000000')->>'error'")" '^code$'
chk "свой код — токен и секрет; без «использован» код живёт" "$(PP "select (sa_tg_setup_take('$CODE')->>'token') || ' ' || (sa_tg_setup_take('$CODE')->>'secret' = '$SECRET')")" '^123:TEST true$'
chk "код использован — второй раз не подходит" "$(PP "select (sa_tg_setup_take('$CODE', true)->>'ok') || ',' || (sa_tg_setup_take('$CODE')->>'error')")" '^true,code$'
PP "select sa_tg_setup_code()" >/dev/null; CODE=$(PP "select split_part(value, '|', 1) from sa_settings where key = 'tg_setup_code'")
$P -c "update sa_settings set value = split_part(value, '|', 1) || '|' || (floor(extract(epoch from now()))::bigint - 1900) where key = 'tg_setup_code'" >/dev/null
chk "код старше 30 минут — не подходит" "$(PP "select sa_tg_setup_take('$CODE')->>'error'")" '^code$'

# ── нажатие кнопки (вебхук)
CB() { echo "{\"callback_query\": {\"id\": \"cb$1\", \"from\": {\"id\": $2}, \"data\": \"$3\", \"message\": {\"message_id\": 77, \"chat\": {\"id\": $2}}}}"; }
chk "sa_tg_update: чужой секрет — отказ" "$(PP "select sa_tg_update('не тот', '$(CB 1 111 "qd:$QID:1")'::jsonb)->>'error'")" '^secret$'
chk "нажатие из чужого чата — вопрос «не найден», ответ не записан" "$(PP "select sa_tg_update('$SECRET', '$(CB 2 999 "qd:$QID:1")'::jsonb)->>'skip'")|$(PP "select coalesce(answer::text, '-') from sa_qday where id = $QID")" '^row\|-$'
$P -c "delete from net.sent_log" >/dev/null
chk "Анна ответила «Б» — неверно, записано" "$(PP "select sa_tg_update('$SECRET', '$(CB 3 111 "qd:$QID:1")'::jsonb)")" '"correct": false'
chk "в базе: ответ 1, неверно, время ответа" "$(PP "select answer || ',' || correct || ',' || (answered_at is not null) from sa_qday where id = $QID")" '^1,false,true$'
EDIT=$(PP "select body::text from net.sent_log where url like '%/editMessageText' order by id desc limit 1")
chk "сообщение дополнено итогом и разбором, кнопка «Разобрать ошибку» → приложение на ошибках" "$EDIT" 'Твой ответ: Б\. Верный: А\.\\nПервый контакт — до 30 секунд\.\\n\\nВопрос ждёт в «Работе над ошибками»\..*"web_app": \{"url": "https://app\.example/\?go=mistakes"\}, "text": "Разобрать ошибку"|"text": "Разобрать ошибку", "web_app": \{"url": "https://app\.example/\?go=mistakes"\}'
chk "правка — то же сообщение того же чата" "$EDIT" '"chat_id": 111.*"message_id": 77|"message_id": 77.*"chat_id": 111'
chk "всплывашка нажатия: «Неверно, разбор в сообщении»" "$(PP "select body::text from net.sent_log where url like '%/answerCallbackQuery' order by id desc limit 1")" '"callback_query_id": "cb3".*Неверно, разбор в сообщении|Неверно, разбор в сообщении.*"callback_query_id": "cb3"'
chk "второе нажатие — «Ответ уже засчитан», ответ не меняется" "$(PP "select sa_tg_update('$SECRET', '$(CB 4 111 "qd:$QID:0")'::jsonb)->>'skip'")|$(PP "select answer from sa_qday where id = $QID")" '^again\|1$'
chk "кнопка с вариантом, которого нет, — ничего" "$(PP "select sa_tg_update('$SECRET', '$(CB 5 111 "qd:$QID:3")'::jsonb)->>'skip'")" '^(option|again)$'
chk "чужие данные кнопки — пропуск" "$(PP "select sa_tg_update('$SECRET', '$(CB 6 111 "drop table")'::jsonb)->>'skip'")" '^data$'
# второй вопрос — завтра, ответ верный
PP "select _sa_qday_at(true, '$NEXT')" >/dev/null
QID2=$(PP "select id from sa_qday where k = 'b2' and emp_id = '$AEMP'")
chk "завтра ушёл второй вопрос (Г — четыре кнопки)" "$(PP "select body::text from net.sent_log where url like '%/sendMessage' order by id desc limit 1")" "\"text\": \"Г\", \"callback_data\": \"qd:$QID2:3\""
$P -c "delete from net.sent_log" >/dev/null
chk "верный ответ «А» — «Верно.» и кнопка «Открыть академию» без перехода" "$(PP "select sa_tg_update('$SECRET', '$(CB 7 111 "qd:$QID2:0")'::jsonb)->>'correct'")|$(PP "select body::text from net.sent_log where url like '%/editMessageText'")" '^true\|.*Твой ответ: А\. Верно\.\\nСчёт — последнее впечатление\.".*"url": "https://app\.example/"'
chk "после верного ответа — без строки про «Работу над ошибками»" "$(PP "select body::text from net.sent_log where url like '%/editMessageText'" | grep -c 'Работе над ошибками')" '^0$'
chk "/start — приветствие с кнопкой в приложение" "$(PP "select sa_tg_update('$SECRET', '{\"message\": {\"text\": \"/start\", \"chat\": {\"id\": 111}}}'::jsonb)->>'start'")|$(PP "select body::text from net.sent_log where url like '%/sendMessage' order by id desc limit 1")" '^true\|.*Здесь приходят сообщения академии.*Открыть академию'
chk "прочие сообщения — пропуск" "$(PP "select sa_tg_update('$SECRET', '{\"message\": {\"text\": \"привет\", \"chat\": {\"id\": 111}}}'::jsonb)->>'skip'")" '^other$'

# ── ответы — в приложение
chk "qday_inbox: два ответа Анны — неверный и верный, с вопросом и вариантами" "$(Q "select qday_inbox('$ANNA')")" '"items": \[\{.*"k": "a1".*"correct": false.*\}, \{.*"k": "b2".*"correct": true'
chk "qday_inbox: Илье — пусто" "$(Q "select jsonb_array_length(qday_inbox('$ILYA')->'items')")" '^0$'
chk "qday_inbox: чужой токен — auth" "$(Q "select qday_inbox('мусор')->>'error'")" '^auth$'
chk "ушедший вопрос две недели снова в очередь не встаёт" "$(Q "select qday_push('$ANNA', '[{\"k\":\"a1\",\"q\":\"Снова\",\"o\":[\"да\",\"нет\"],\"c\":0}]'::jsonb)->>'queued'")" '^0$'

# ── права
chk "anon: qday_push, qday_inbox, notify_prefs, notify_set — можно" "$(PP "select has_function_privilege('anon', 'public.qday_push(text, jsonb)', 'execute') and has_function_privilege('anon', 'public.qday_inbox(text)', 'execute') and has_function_privilege('anon', 'public.notify_prefs(text)', 'execute') and has_function_privilege('anon', 'public.notify_set(text, text, boolean)', 'execute')")" '^t$'
chk "anon: вебхук, код, токен, отправка, расписание — нельзя" "$(PP "select bool_or(has_function_privilege('anon', f, 'execute')) or bool_or(has_function_privilege('authenticated', f, 'execute')) from unnest(array['public.sa_tg_update(text, jsonb)', 'public.sa_tg_setup_take(text, boolean)', 'public.sa_tg_setup_code()', 'public.sa_tg_api(text, jsonb)', 'public._sa_qday_at(boolean, timestamptz)', 'public.sa_qday_tick()', 'public.sa_qday_preview(timestamptz)']) f")" '^f$'
chk "service_role: вебхук и код — можно" "$(PP "select has_function_privilege('service_role', 'public.sa_tg_update(text, jsonb)', 'execute') and has_function_privilege('service_role', 'public.sa_tg_setup_take(text, boolean)', 'execute')")" '^t$'
chk "anon: таблицу вопросов напрямую не прочитать" "$(Q "select count(*) from sa_qday")" 'permission denied|нет доступа'
chk "anon: вебхук напрямую — permission denied" "$(Q "select sa_tg_update('$SECRET', '{}'::jsonb)")" 'permission denied|нет доступа'

# ── без этапа 26: колонка master появляется, настройки работают
$P0 -d postgres -c "drop database if exists satest31b" -c "create database satest31b template satest25" >/dev/null
out=$($P0 -d satest31b -f "$D/supabase-stage31-qday.sql" 2>&1); rc=$?
chk "без этапа 26 — этап 31 встаёт, notify_prefs отвечает (master и qday)" "$rc|$(psql -h $PGH -p $PGP -U postgres -q -t -A -d satest31b -c "set role anon; select notify_prefs('$ANNA')" 2>&1 | tr '\n' ' ')" '^0\|.*"qday": true.*'
$P0 -d postgres -c "drop database if exists satest31b" >/dev/null

echo "Итого: $pass ✓, $fail ✗"
