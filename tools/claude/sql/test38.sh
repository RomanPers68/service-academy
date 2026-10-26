#!/bin/bash
# Этап 38 (v90, Доп. 403): чат смены — чаты заведения и личные, сообщения, ответы с цитатой, правка, реакции, закреп,
# фото, прочтения, «Позвать» и «Иду», бот, хранение 30 дней, права.
# Поверх базы run25.sh: копия satest38, этапы 26, 31, 32, 34, 35 → 38 без 36 (ошибка) → 36, 37, 38, 38; проверки ✓/✗.
# Отправка в Telegram — заглушка pg_net (net.sent_log). Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и
# PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test38.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest38
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql"
POST="supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql supabase-stage38-chat.sql supabase-stage38-chat.sql"
D=$(mktemp -d); for f in $PRE $POST; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT38=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = supabase-stage38-chat.sql ] && OUT38="$out"; }
for f in $PRE; do run $f; done
# без этапа 36 этап 38 не идёт: просит сначала его
NO36=$($P0 -d $DB -f "$D/supabase-stage38-chat.sql" 2>&1)
# v91: функции прошлых этапов с проверкой входа, объявленные STABLE (этапы 20 и 28 до v91), — этап 38 переводит их в VOLATILE
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
for f in $POST; do run $f; done
# график «на сегодня» (как seed24.sql, от сегодняшнего дня: шаблон satest25 мог быть собран раньше)
sed -n '1,/^end \$\$;/p' "$HERE/seed24.sql" > "$D/seed-today.sql"
$P0 -d $DB -c "delete from schedule_months where restaurant = 'Два моря, Океан'; delete from schedule_venues where restaurant = 'Два моря, Океан'" -f "$D/seed-today.sql" >/dev/null
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; OLEG=10000000-0000-0000-0000-0000000000a6
IRINA=10000000-0000-0000-0000-0000000000b1
REMP=00000000-0000-0000-0000-0000000000a1; MEMP=00000000-0000-0000-0000-0000000000a2; PEMP=00000000-0000-0000-0000-0000000000a3
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5; OEMP=00000000-0000-0000-0000-0000000000a6
IREMP=00000000-0000-0000-0000-0000000000b1
# маленькие JPEG 16×12 и 8×6 (base64), как присылает телефон после сжатия
JPG='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAMABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDdooor509U/9k='
THB='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDdooor509U/9k='
sent() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1' and body->>'text' like '%' || \$t\$$2\$t\$ || '%'"; }
calm() { PP "update sa_chat_reads set at = now() - interval '10 minutes', notified_at = null where emp_id = '$1'" >/dev/null; }   # человек давно не заглядывал в чат

chk "без этапа 36 — понятная ошибка: какой этап сначала" "$NO36" 'Сначала этап 36 \(supabase-stage36-comfort.sql\)'
chk "этапы 26, 31, 32, 34, 35, 36, 37 и 38 (38 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 20 функций, таблицы, вид «Чат», бот" "$OUT38" 'чат смены: 20 функций из 20 · таблицы: есть · вид «Чат» в напоминаниях: да · Telegram: '
chk "v91: my_reset_at (этап 20) и hr_quality_get (этап 28) — VOLATILE после этапа 38" "$($P0 -d $DB -t -A -c "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname in ('my_reset_at', 'hr_quality_get')")" '^hr_quality_get:v,my_reset_at:v$'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null

# ── чаты заведения
R=$(Q "select chat_list('$ANNA')")
chk "Анна (официант): «Вся команда», без «Старших»; кто я — с заведением" "$R" '"me": \{.*"name": "Анна Смирнова".*"restaurant": "Два моря, Океан"'
chk "у Анны один чат — команда, 5 человек, в смене 3, непрочитанных 0" "$(Q "select jsonb_array_length(x->'chats') || ' ' || (x->'chats'->0->>'kind') || ' ' || (x->'chats'->0->>'members') || ' ' || (x->'chats'->0->>'shift') || ' ' || (x->>'unread') from chat_list('$ANNA') x")" '^1 team 5 3 0$'
chk "Мария (старшая): команда, «Старшие» (3: владелец, старшая, менеджер) и «Руководители сети» (4: ещё Ирина из Порта)" "$(Q "select string_agg((c->>'kind') || ':' || (c->>'members'), ',') from jsonb_array_elements(chat_list('$MARIA')->'chats') c")" '^team:5,leads:3,net:4$'
TEAM=$(PP "select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'team'"); LEADS=$(PP "select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'leads'")
chk "Ирина (Порт): свой чат команды, не океанский" "$(Q "select (chat_list('$IRINA')->'chats'->0->>'id')::bigint <> $TEAM")" '^t$'
chk "уволенный — auth; чужой токен — auth" "$(Q "select chat_list('$OLEG')->>'error'") $(Q "select chat_list('мусор')->>'error'")" '^auth auth$'

# ── сообщения и прочтения
R=$(Q "select chat_send('$ANNA', $TEAM, '  Привет, команда!  ')")
chk "Анна пишет в команду: текст без пробелов по краям, её имя" "$R" '"ok": true.*"body": "Привет, команда!".*"name": "Анна Смирнова"|"name": "Анна Смирнова".*"body": "Привет, команда!"'
M1=$(PP "select max(id) from sa_chat_msgs where chat_id = $TEAM")
chk "у Ильи — 1 непрочитанное в команде" "$(Q "select chat_list('$ILYA')->'chats'->0->>'unread'")" '^1$'
chk "Илья открывает: сообщение, участники — 5 (уволенного нет), Анна прочитала своё" "$(Q "select jsonb_array_length(x->'msgs') || ' ' || jsonb_array_length(x->'members') || ' ' || (select (m->>'read')::bigint = $M1 from jsonb_array_elements(x->'members') m where m->>'id' = '$AEMP') from chat_open('$ILYA', $TEAM) x")" '^1 5 true$'
Q "select chat_read('$ILYA', $TEAM, $M1)" >/dev/null
chk "Илья прочитал: у него 0, у Анны видно, что Илья прочитал" "$(Q "select chat_list('$ILYA')->'chats'->0->>'unread'")|$(Q "select (m->>'read')::bigint >= $M1 from jsonb_array_elements(chat_open('$ANNA', $TEAM)->'members') m where m->>'id' = '$IEMP'")" '^0\|t$'
chk "прочитал «дальше последнего» — не больше последнего" "$(Q "select chat_read('$ILYA', $TEAM, 999999)->>'ok'")|$(PP "select last_id from sa_chat_reads where chat_id = $TEAM and emp_id = '$IEMP'")" "^true\|$M1\$"
chk "пустое — bad_request; длинное — 1000 знаков" "$(Q "select chat_send('$ANNA', $TEAM, '   ')->>'error'") $(Q "select char_length(chat_send('$ANNA', $TEAM, repeat('а', 1500))->'msg'->>'body')")" '^bad_request 1000$'
chk "новое после p_after — только новое" "$(Q "select string_agg(char_length(m->>'body')::text, ',') from jsonb_array_elements(chat_open('$ILYA', $TEAM, $M1)->'msgs') m")" '^1000$'
chk "20 в минуту можно, 21-е — too_fast" "$(Q "select count(*) from generate_series(1, 20) g, lateral (select chat_send('$PETR', $TEAM, 'п' || g) r) x where (x.r->>'ok')::boolean")|$(Q "select chat_send('$PETR', $TEAM, 'ещё')->>'error'")" '^20\|too_fast$'
chk "«Старшие»: официанту не открыть и не написать, старшей — можно" "$(Q "select chat_open('$ANNA', $LEADS)->>'error'") $(Q "select chat_send('$ANNA', $LEADS, 'тест')->>'error'") $(Q "select chat_send('$MARIA', $LEADS, 'Вечером не хватает официанта')->>'ok'")" '^not_found not_found true$'
chk "чужое заведение: не открыть, не написать" "$(Q "select chat_open('$IRINA', $TEAM)->>'error'") $(Q "select chat_send('$IRINA', $TEAM, 'привет')->>'error'")" '^not_found not_found$'

# ── ответ с цитатой
PP "update sa_chat_msgs set created_at = now() - interval '2 minutes', updated_at = now() - interval '2 minutes' where emp_id = '$PEMP'" >/dev/null   # Пётр писал раньше: лимит 20 в минуту снят
MI=$(Q "select chat_send('$ILYA', $TEAM, 'Лайм закончился, кто сходит на склад?')->'msg'->>'id'")
calm "$IEMP"; PP "delete from net.sent_log" >/dev/null
R=$(Q "select chat_send('$PETR', $TEAM, 'Иду, принесу два килограмма', $MI)")
chk "Пётр отвечает Илье: в сообщении цитата (номер, имя, текст)" "$(Q "select (x->'msg'->'reply'->>'id') || '|' || (x->'msg'->'reply'->>'name') || '|' || (x->'msg'->'reply'->>'body') from (select '$R'::jsonb x) y")" "^$MI\\|Илья Бармен\\|Лайм закончился, кто сходит на склад\\?\$"
chk "Илье бот: «Пётр Иванов отвечает тебе в «Вся команда»: …»" "$(sent 222 'Пётр Иванов отвечает тебе в «Вся команда»:')" '^1$'
chk "ответ на сообщение другого чата — без цитаты" "$(Q "select coalesce(chat_send('$MARIA', $LEADS, 'Ответ', $MI)->'msg'->>'reply', 'нет')")" '^нет$'
chk "свой ответ себе — бот молчит" "$(Q "select chat_send('$ILYA', $TEAM, 'Уже не надо', $MI)->>'ok'")|$(PP "select count(*) from net.sent_log where body->>'chat_id' = '222'")" '^true\|1$'

# ── правка своего
MA=$(Q "select chat_send('$ANNA', $TEAM, 'Банкет в 19:00')->'msg'->>'id'")
R=$(Q "select chat_edit('$ANNA', $MA, 'Банкет в 19:30')")
chk "Анна правит своё: новый текст, «изменено»" "$R" '"body": "Банкет в 19:30".*"edited": true|"edited": true.*"body": "Банкет в 19:30"'
chk "чужое не править (forbidden), пустым — нельзя, старше суток — too_late" "$(Q "select chat_edit('$ILYA', $MA, 'хм')->>'error'") $(Q "select chat_edit('$ANNA', $MA, '   ')->>'error'") $(PP "update sa_chat_msgs set created_at = now() - interval '25 hours' where id = $MI" >/dev/null; Q "select chat_edit('$ILYA', $MI, 'поздно')->>'error'")" '^forbidden bad_request too_late$'

# ── реакции
SINCE=$(Q "select chat_open('$MARIA', $TEAM)->>'now'"); LASTT=$(PP "select max(id) from sa_chat_msgs where chat_id = $TEAM")
sleep 1
R=$(Q "select chat_react('$ILYA', $MA, 'ok')")
chk "Илья ставит «Принято» на сообщение Анны" "$R" '"reacts": \[\{"r": "ok", "emp": "'$IEMP'", "name": "Илья Бармен"\}\]'
chk "другая реакция — заменяет (у человека одна)" "$(Q "select jsonb_array_length(chat_react('$ILYA', $MA, 'heart')->'msg'->'reacts')") $(Q "select chat_react('$ILYA', $MA, 'heart')->'msg'->'reacts'->0->>'r'")" '^1 heart$'
Q "select chat_react('$MARIA', $MA, 'ok')" >/dev/null
chk "опрос с p_since: правка и реакции приходят снова" "$(Q "select string_agg((m->>'id') || ':' || jsonb_array_length(m->'reacts') || ':' || (m->>'edited'), ',') from jsonb_array_elements(chat_open('$MARIA', $TEAM, $LASTT, 0, '$SINCE')->'msgs') m where (m->>'id')::bigint = $MA")" "^$MA:2:true\$"
chk "без p_since — по-старому: изменённое за 15 минут" "$(Q "select count(*) from jsonb_array_elements(chat_open('$MARIA', $TEAM, $LASTT)->'msgs') m where (m->>'id')::bigint = $MA")" '^1$'
chk "снять (null) — реакции Ильи нет; чужая — bad_request" "$(Q "select jsonb_array_length(chat_react('$ILYA', $MA, null)->'msg'->'reacts')") $(Q "select chat_react('$ILYA', $MA, 'xx')->>'error'")" '^1 bad_request$'
chk "реакция в чужом заведении — not_found" "$(Q "select chat_react('$IRINA', $MA, 'ok')->>'error'")" '^not_found$'

# ── личные
DM=$(Q "select chat_dm('$ANNA', '$MEMP')->'chat'->>'id'")
chk "личная: одна на двоих (Анна → Мария и Мария → Анна)" "$(Q "select chat_dm('$MARIA', '$AEMP')->'chat'->>'id'")|$(Q "select chat_dm('$ANNA', '$MEMP')->'chat'->'peer'->>'name'")" "^$DM\\|Мария Ким\$"
chk "с собой, с уволенным, с чужим заведением — нельзя" "$(Q "select chat_dm('$ANNA', '$AEMP')->>'error'") $(Q "select chat_dm('$ANNA', '$OEMP')->>'error'") $(Q "select chat_dm('$ANNA', '$IREMP')->>'error'")" '^bad_request not_found not_found$'
chk "пустая личная в списке не показывается" "$(Q "select count(*) from jsonb_array_elements(chat_list('$MARIA')->'chats') c where c->>'kind' = 'dm'")" '^0$'
PP "delete from net.sent_log" >/dev/null
Q "select chat_send('$ANNA', $DM, 'Мария, можно в субботу поменяться сменой с Петром?')" >/dev/null
chk "Мария: личная от Анны — 1 непрочитанное, собеседник Анна" "$(Q "select (c->>'unread') || ' ' || (c->'peer'->>'name') from jsonb_array_elements(chat_list('$MARIA')->'chats') c where c->>'kind' = 'dm'")" '^1 Анна Смирнова$'
chk "бот написал Марии: «Анна Смирнова пишет тебе: …»" "$(sent 333 'Анна Смирнова пишет тебе:')" '^1$'
Q "select chat_send('$ANNA', $DM, 'И в воскресенье тоже?')" >/dev/null
chk "второе подряд — бот не пишет (2 минуты на переписку)" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '333'")" '^1$'
PP "update sa_chat_reads set notified_at = now() - interval '5 minutes' where chat_id = $DM and emp_id = '$MEMP'" >/dev/null
Q "select chat_read('$MARIA', $DM, 999999)" >/dev/null
Q "select chat_send('$ANNA', $DM, 'Жду ответа')" >/dev/null
chk "Мария только что читала переписку — бот не пишет (она в чате)" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '333'")" '^1$'
Q "select chat_dm('$ILYA', '$AEMP')" >/dev/null; DMI=$(PP "select id from sa_chats where kind = 'dm' and '$IEMP' in (a, b) and '$AEMP' in (a, b)")
Q "select notify_set('$ANNA', 'chat', false)" >/dev/null
Q "select chat_send('$ILYA', $DMI, 'Аня, лёд закончился')" >/dev/null
chk "у Анны «Чат» выключен — бот молчит" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '111'")" '^0$'
chk "в настройках сообщений — вид «Чат» (у Анны выключен)" "$(Q "select notify_prefs('$ANNA')->>'chat'") $(Q "select notify_prefs('$ILYA')->>'chat'")" '^false true$'
Q "select notify_set('$ANNA', 'chat', true)" >/dev/null
chk "коллеги: все, кроме меня, уволенного и чужих; в смене — по графику" "$(Q "select string_agg((p->>'name') || ':' || (p->>'shift'), ',') from jsonb_array_elements(chat_people('$ANNA')->'people') p")" '^Илья Бармен:true,Мария Ким:true,Пётр Иванов:false,Роман Владелец:false$'
chk "в личной закрепа нет" "$(Q "select chat_pin('$MARIA', $DM, null)->>'error'")" '^not_found$'

# ── фото
calm "$AEMP"; PP "delete from net.sent_log" >/dev/null
R=$(Q "select chat_photo_send('$ILYA', $DMI, '$JPG', '$THB', 16, 12, 'Стоп-лист на сегодня', null)")
PH=$(Q "select ('$R'::jsonb)->'msg'->'photo'->>'id'")
chk "Илья шлёт фото Анне: вид photo, размер, подпись" "$R" '"kind": "photo".*"photo": \{"h": 12, "w": 16, "id": [0-9]+\}|"photo": \{"h": 12, "w": 16, "id": [0-9]+\}.*"kind": "photo"'
chk "Анне бот: «Илья Бармен пишет тебе: Фото: Стоп-лист…»" "$(sent 111 'Илья Бармен пишет тебе:
Фото: Стоп-лист на сегодня')" '^1$'
chk "Анна видит фото и превью — те же байты" "$(Q "select (chat_photo('$ANNA', $PH, true)->>'data') = '$JPG'") $(Q "select (chat_photo('$ANNA', $PH, false)->>'data') = '$THB'") $(Q "select chat_photo('$ANNA', $PH)->>'mime'")" '^t t image/jpeg$'
chk "чужие не видят фото личной (Мария, Ирина) — not_found" "$(Q "select chat_photo('$MARIA', $PH)->>'error'") $(Q "select chat_photo('$IRINA', $PH)->>'error'")" '^not_found not_found$'
chk "не картинка, кривой base64, нет размера — bad_request" "$(Q "select chat_photo_send('$ILYA', $TEAM, encode(convert_to('просто текст, а не фото', 'UTF8'), 'base64'), '$THB', 10, 10, '', null)->>'error'") $(Q "select chat_photo_send('$ILYA', $TEAM, '%%%', '$THB', 10, 10, '', null)->>'error'") $(Q "select chat_photo_send('$ILYA', $TEAM, '$JPG', '$THB', 0, 10, '', null)->>'error'")" '^bad_request bad_request bad_request$'
chk "больше 450 КБ — too_big" "$(Q "select chat_photo_send('$ILYA', $TEAM, encode('\\xffd8ffe0'::bytea || decode(repeat('00', 470000), 'hex'), 'base64'), '$THB', 10, 10, '', null)->>'error'")" '^too_big$'
chk "10 фото за 10 минут можно (с первым), 11-е — too_fast" "$(Q "select count(*) from generate_series(1, 9) g, lateral (select chat_photo_send('$ILYA', $TEAM, '$JPG', '$THB', 16, 12, 'ф' || g, null) r) x where (x.r->>'ok')::boolean")|$(Q "select chat_photo_send('$ILYA', $TEAM, '$JPG', '$THB', 16, 12, '', null)->>'error'")" '^9\|too_fast$'
PP "insert into sa_chat_photos (msg_id, restaurant, emp_id, w, h, full_data, thumb_data, bytes) select (select max(id) from sa_chat_msgs where chat_id = $TEAM), 'Два моря, Океан', 'кто-то', 1, 1, '\\xffd8ff'::bytea, '\\xffd8ff'::bytea, 6 from generate_series(1, 50)" >/dev/null
chk "60 фото в день у заведения — дальше photo_limit" "$(Q "select chat_photo_send('$PETR', $TEAM, '$JPG', '$THB', 16, 12, '', null)->>'error'")" '^photo_limit$'
PP "delete from sa_chat_photos where emp_id = 'кто-то'" >/dev/null
MP=$(PP "select max(id) from sa_chat_msgs where kind = 'photo' and chat_id = $TEAM")
chk "подпись к фото можно стереть правкой; текст — нет" "$(Q "select chat_edit('$ILYA', $MP, '')->'msg'->>'body'")|$(Q "select chat_edit('$ANNA', $MA, '')->>'error'")" '^\|bad_request$'
Q "select chat_delete('$ILYA', $MP)" >/dev/null
chk "удалил фото — строки фото нет, другое фото на месте" "$(PP "select count(*) from sa_chat_photos where msg_id = $MP") $(Q "select chat_photo('$ANNA', $PH)->>'ok'")" '^0 true$'

# ── закреп
chk "официант не закрепляет в «Вся команда» — forbidden" "$(Q "select chat_pin('$ANNA', $TEAM, $MA)->>'error'")" '^forbidden$'
R=$(Q "select chat_pin('$MARIA', $TEAM, $MA)")
chk "Мария закрепляет сообщение Анны: закреп и строка «Мария закрепляет «…»»" "$R" '"pin": \{.*"body": "Банкет в 19:30".*"msg": \{.*"body": "Мария закрепляет «Банкет в 19:30»".*"kind": "sys"|"msg": \{.*"body": "Мария закрепляет «Банкет в 19:30»".*"pin": \{.*"body": "Банкет в 19:30"'
chk "у Ильи в переписке — закреп и строка о закрепе со ссылкой на сообщение" "$(Q "select chat_open('$ILYA', $TEAM)->'pin'->>'body'")|$(Q "select (select count(*) from jsonb_array_elements(chat_open('$ILYA', $TEAM)->'msgs') m where m->>'kind' = 'sys' and (m->'reply'->>'id')::bigint = $MA)")" '^Банкет в 19:30\|1$'
chk "закрепить сообщение другого чата — not_found" "$(Q "select chat_pin('$MARIA', $LEADS, $MA)->>'error'")" '^not_found$'
PP "update sa_chat_msgs set created_at = now() - interval '31 days' where id = $MA" >/dev/null
Q "select chat_send('$MARIA', $TEAM, 'Всем хорошей смены')" >/dev/null
chk "закреплённое старше 30 дней не стирается" "$(PP "select count(*) from sa_chat_msgs where id = $MA")" '^1$'
ML=$(PP "select max(id) from sa_chat_msgs where chat_id = $LEADS and kind = 'text'")
chk "в «Старших» закрепляет каждый: Мария закрепила" "$(Q "select chat_pin('$MARIA', $LEADS, $ML)->>'ok'")" '^true$'
Q "select chat_delete('$MARIA', $MA)" >/dev/null
chk "удалённое закреплённое — закрепа нет" "$(Q "select coalesce(chat_open('$ILYA', $TEAM)->>'pin', 'нет')")" '^нет$'
chk "открепить (null)" "$(Q "select chat_pin('$MARIA', $LEADS, null)->>'ok'")|$(Q "select coalesce(chat_open('$MARIA', $LEADS)->>'pin', 'нет')")" '^true\|нет$'

# ── «Позвать» и «Иду»
PP "delete from net.sent_log" >/dev/null
R=$(Q "select chat_call('$ANNA', 'lead', null, 'table', '5', null)")
chk "Анна зовёт менеджера к столу 5: вызов в команде" "$R" '"ok": true.*"kind": "call"|"kind": "call".*"ok": true'
chk "текст вызова — «Анна зовёт менеджера: к столу 5»" "$(PP "select body from sa_chat_msgs where kind = 'call' order by id desc limit 1")" '^Анна зовёт менеджера: к столу 5$'
CALL=$(PP "select max(id) from sa_chat_msgs where kind = 'call'")
chk "бот: руководителю в графике сегодня (Мария) — да, Петру (выходной) — нет" "$(sent 333 'Анна зовёт менеджера: к столу 5') $(PP "select count(*) from net.sent_log where body->>'chat_id' = '444'")" '^1 0$'
chk "вызов у руководителей — в «вызовах мне», у Ильи — нет" "$(Q "select jsonb_array_length(chat_unread('$MARIA')->'calls')") $(Q "select jsonb_array_length(chat_unread('$PETR')->'calls')") $(Q "select jsonb_array_length(chat_unread('$ILYA')->'calls')")" '^1 1 0$'
chk "второй вызов через секунду — too_fast" "$(Q "select chat_call('$ANNA', 'bar', null, 'help', null, null)->>'error'")" '^too_fast$'
chk "кого-зачем не так — bad_request (кто, стол, своё пустое, своё длинное, себя, чужого)" "$(Q "select chat_call('$ILYA', 'chef', null, 'help', null, null)->>'error'") $(Q "select chat_call('$ILYA', 'host', null, 'table', 'стол 5!', null)->>'error'") $(Q "select chat_call('$ILYA', 'host', null, 'own', null, '  ')->>'error'") $(Q "select chat_call('$ILYA', 'host', null, 'own', null, repeat('я', 81))->>'error'") $(Q "select chat_call('$ILYA', 'person', '$IEMP', 'come', null, null)->>'error'") $(Q "select chat_call('$ILYA', 'person', '$IREMP', 'come', null, null)->>'error'")" '^(bad_request ){5}bad_request$'
chk "вызов закрепить нельзя" "$(Q "select chat_pin('$MARIA', $TEAM, $CALL)->>'error'")" '^not_found$'
SINCE=$(Q "select chat_open('$ANNA', $TEAM)->>'now'"); sleep 1
R=$(Q "select chat_go('$MARIA', $CALL)")
chk "Мария: «Иду» — в вызове «идёт: Мария Ким»" "$R" '"going": \[\{[^]]*"name": "Мария Ким"'
chk "Анне бот: «Мария идёт: к столу 5»" "$(sent 111 'Мария идёт: к столу 5')" '^1$'
chk "второй раз «Иду» — без повтора; на свой вызов — нельзя" "$(Q "select jsonb_array_length(chat_go('$MARIA', $CALL)->'msg'->'call'->'going')") $(Q "select chat_go('$ANNA', $CALL)->>'error'")" '^1 bad_request$'
chk "после «Иду» вызова в «вызовах мне» нет" "$(Q "select jsonb_array_length(chat_unread('$PETR')->'calls')")" '^0$'
chk "опрос после вызова: изменённый вызов приходит снова (кто идёт)" "$(Q "select count(*) from jsonb_array_elements(chat_open('$ANNA', $TEAM, $CALL, 0, '$SINCE')->'msgs') m where (m->>'id')::bigint = $CALL and jsonb_array_length(m->'call'->'going') = 1")" '^1$'
chk "на вызов можно ответить и поставить реакцию" "$(Q "select chat_send('$ILYA', $TEAM, 'Мария уже идёт', $CALL)->'msg'->'reply'->>'body'")|$(Q "select chat_react('$ILYA', $CALL, 'ok')->>'ok'")" '^Анна зовёт менеджера: к столу 5\|true$'
R=$(Q "select chat_call('$ILYA', 'person', '$AEMP', 'come', null, null)")
chk "Илья зовёт Анну лично: бот ей «Илья зовёт тебя: подойди ко мне», у неё — в «вызовах мне»" "$(sent 111 'Илья зовёт тебя: подойди ко мне') $(Q "select jsonb_array_length(chat_unread('$ANNA')->'calls')")" '^1 1$'
chk "в ленте — «Илья зовёт Анну: подойди ко мне» (имя в винительном)" "$(PP "select body from sa_chat_msgs where kind = 'call' order by id desc limit 1")" '^Илья зовёт Анну: подойди ко мне$'
chk "склонение имён: Мария, Роман, Пётр, Андрей, Игорь, Любовь, Нико" "$(PP "select string_agg(_sa_chat_acc(x), ',' order by o) from unnest(array['Мария', 'Роман', 'Пётр', 'Андрей', 'Игорь', 'Любовь', 'Нико']) with ordinality t(x, o)")" '^Марию,Романа,Петра,Андрея,Игоря,Любовь,Нико$'
Q "select chat_call('$PETR', 'bar', null, 'help', null, null)" >/dev/null
chk "Пётр зовёт бар: бот бармену в смене (Илья)" "$(sent 222 'Пётр зовёт бар: нужна помощь')" '^1$'
Q "select chat_call('$MARIA', 'host', null, 'own', null, 'Принеси детский стульчик к шестому')" >/dev/null
chk "своими словами: «Мария зовёт хостес: Принеси детский стульчик к шестому»" "$(PP "select body from sa_chat_msgs where kind = 'call' order by id desc limit 1")" '^Мария зовёт хостес: Принеси детский стульчик к шестому$'
PP "update sa_chat_msgs set created_at = now() - interval '11 minutes' where id = (select max(id) from sa_chat_msgs where kind = 'call' and emp_id = '$IEMP')" >/dev/null
chk "вызов старше 10 минут — из «вызовов мне» ушёл" "$(Q "select jsonb_array_length(chat_unread('$ANNA')->'calls')")" '^0$'

# ── удаление
MA2=$(Q "select chat_send('$ANNA', $TEAM, 'Удалю это')->'msg'->>'id'"); MI2=$(Q "select chat_send('$ILYA', $TEAM, 'И это удалят')->'msg'->>'id'")
chk "чужое сообщение официанту не удалить — forbidden" "$(Q "select chat_delete('$ILYA', $MA2)->>'error'")" '^forbidden$'
chk "своё — удаляется: в опросе открытого чата приходит с del и пустым текстом (убрать у себя)" "$(Q "select chat_delete('$ANNA', $MA2)->>'ok'")|$(Q "select (m->>'del') || ':' || (m->>'body') from jsonb_array_elements(chat_open('$ILYA', $TEAM, $MA2 - 1)->'msgs') m where (m->>'id')::bigint = $MA2")" '^true\|true:$'
DMLAST=$(PP "select max(id) from sa_chat_msgs where chat_id = $DMI")
chk "старшая удаляет чужое в группе; в чужой личной — нет" "$(Q "select chat_delete('$MARIA', $MI2)->>'ok'") $(Q "select chat_delete('$MARIA', $DMLAST)->>'error'")" '^true not_found$'
chk "v91: удалённых (два последних) нет в переписке (первая страница), в списке чатов — последнее неудалённое" "$(Q "select count(*) from jsonb_array_elements(chat_open('$ILYA', $TEAM)->'msgs') m where (m->>'id')::bigint in ($MA2, $MI2)")|$(Q "select (c->'last'->>'id')::bigint < $MA2 from jsonb_array_elements(chat_list('$ILYA')->'chats') c where c->>'kind' = 'team'")" '^0\|t$'
WANT=$(PP "select count(*) from sa_chat_msgs m where m.chat_id = $TEAM and not m.deleted and m.emp_id <> '$PEMP' and m.id > coalesce((select last_id from sa_chat_reads r where r.chat_id = $TEAM and r.emp_id = '$PEMP'), 0)")
chk "удалённые не считаются непрочитанными" "$(Q "select c->>'unread' from jsonb_array_elements(chat_list('$PETR')->'chats') c where c->>'kind' = 'team'")" "^$WANT\$"

# ── хранение и страницы
PP "insert into sa_chat_msgs (chat_id, emp_id, emp_name, body, created_at, updated_at) values ($TEAM, '$AEMP', 'Анна Смирнова', 'старое', now() - interval '31 days', now() - interval '31 days')" >/dev/null
Q "select chat_send('$MARIA', $TEAM, 'Новый день')" >/dev/null
chk "переписка старше 30 дней стирается" "$(PP "select count(*) from sa_chat_msgs where body = 'старое'")" '^0$'
PP "insert into sa_chat_msgs (chat_id, emp_id, emp_name, body) select $LEADS, '$PEMP', 'Пётр Иванов', 'лист ' || g from generate_series(1, 70) g" >/dev/null
NL=$(PP "select count(*) from sa_chat_msgs where chat_id = $LEADS")
FIRST=$(Q "select min((m->>'id')::bigint) from jsonb_array_elements(chat_open('$MARIA', $LEADS)->'msgs') m")
chk "страницы: первые 60, «ещё есть»; раньше — оставшиеся, конец" "$(Q "select jsonb_array_length(x->'msgs') || ' ' || (x->>'more') from chat_open('$MARIA', $LEADS) x")|$(Q "select jsonb_array_length(x->'msgs') || ' ' || (x->>'more') from chat_open('$MARIA', $LEADS, 0, $FIRST) x")" "^60 true\\|$((NL - 60)) false\$"
PP "insert into employees (id, name, surname, restaurant, position, is_admin, status) values ('00000000-0000-0000-0000-0000000000a7', 'Вера', 'Новая', 'Два моря, Океан', 'waiter', false, 'active'); insert into sessions (token, employee_id) values ('10000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a7'); update sa_chat_msgs set created_at = now() - interval '13 hours' where chat_id = $TEAM and id = $M1" >/dev/null
ALLT=$(PP "select count(*) from sa_chat_msgs where chat_id = $TEAM and not deleted")
chk "новичок в группе: история старше 12 часов — прочитана" "$(Q "select (chat_list('10000000-0000-0000-0000-0000000000a7')->'chats'->0->>'unread')::int < $ALLT")" '^t$'

# ── руководители сети
IVAN=10000000-0000-0000-0000-0000000000b2
chk "«Руководители сети»: у Марии после «Старших», у Ирины (Порт) — тот же чат" "$(Q "select string_agg(c->>'kind', ',') from jsonb_array_elements(chat_list('$MARIA')->'chats') c where c->>'kind' <> 'dm'")|$(Q "select string_agg(c->>'kind', ',') from jsonb_array_elements(chat_list('$IRINA')->'chats') c")" '^team,leads,net\|team,leads,net$'
NET=$(PP "select id from sa_chats where kind = 'net'")
chk "в сети — руководители обоих заведений (4), с заведением; у официантов (Анна, Иван) чата нет" "$(Q "select jsonb_array_length(x->'members') || ':' || (select m->>'rest' from jsonb_array_elements(x->'members') m where m->>'name' = 'Ирина Портова') from chat_open('$IRINA', $NET) x")|$(Q "select count(*) from jsonb_array_elements(chat_list('$ANNA')->'chats') c where c->>'kind' = 'net'")$(Q "select count(*) from jsonb_array_elements(chat_list('$IVAN')->'chats') c where c->>'kind' = 'net'")|$(Q "select chat_open('$ANNA', $NET)->>'error'")" '^4:Порт\|00\|not_found$'
MN=$(Q "select chat_send('$MARIA', $NET, 'Коллеги, в четверг общая планёрка в 11:00')->'msg'->>'id'")
chk "Мария пишет в сеть — у Ирины сообщение с заведением автора и непрочитанное" "$(Q "select (m->>'rest') from jsonb_array_elements(chat_open('$IRINA', $NET)->'msgs') m where (m->>'id')::bigint = $MN")|$(Q "select c->>'unread' from jsonb_array_elements(chat_list('$IRINA')->'chats') c where c->>'kind' = 'net'")" '^Два моря, Океан\|1$'
calm "$MEMP"; PP "delete from net.sent_log" >/dev/null
MIR=$(Q "select chat_send('$IRINA', $NET, 'Буду, захвачу отчёт по Порту', $MN)->'msg'->>'id'")
chk "Ирина отвечает — Марии бот «… отвечает тебе в «Руководители сети»»" "$(sent 333 'Ирина Портова отвечает тебе в «Руководители сети»:')" '^1$'
chk "закрепляет каждый руководитель (Ирина); чужое удаляет только руководящий состав (Ирина — нет, Мария — да)" "$(Q "select chat_pin('$IRINA', $NET, $MN)->>'ok'") $(Q "select chat_delete('$IRINA', $MN)->>'error'") $(Q "select chat_delete('$MARIA', $MIR)->>'ok'")" '^true forbidden true$'
PP "update employees set status = 'fired' where restaurant = 'Порт'" >/dev/null
chk "заведение одно — «Руководителей сети» в списке нет" "$(Q "select count(*) from jsonb_array_elements(chat_list('$MARIA')->'chats') c where c->>'kind' = 'net'")" '^0$'
PP "update employees set status = 'active' where restaurant = 'Порт'" >/dev/null

# ── как PostgREST (v91): STABLE-функции он выполняет в транзакции «только для чтения», а whoami на сервере
# записывает визит — функция с токеном, помеченная STABLE, там молча падает (v90: пустой «Написать», нет числа и баннера)
PP "alter table sessions add column if not exists seen_at timestamptz; create or replace function whoami(p_token uuid) returns json language plpgsql volatile security definer set search_path to public as \$w\$
declare e record;
begin
  update sessions set seen_at = now() where token = p_token;
  select em.* into e from sessions s join employees em on em.id = s.employee_id where s.token = p_token and em.status = 'active';
  if e is null then return json_build_object('ok', false, 'error', 'invalid_session'); end if;
  return json_build_object('ok', true, 'employee', json_build_object('id', e.id, 'name', e.name, 'surname', e.surname, 'restaurant', e.restaurant, 'position', e.position, 'is_admin', e.is_admin));
end \$w\$" >/dev/null
RPC() { local fn="$1" call="$2" vol mode="read write"; vol=$(PP "select max(provolatile) from pg_proc where proname = '$fn'"); [ "$vol" != "v" ] && mode="read only"; $P -c "begin transaction $mode; set local role anon; $call; commit;" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
chk "все 20 функций чата — VOLATILE: PostgREST не запирает их «только для чтения»" "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'chat\_%' and p.provolatile = 'v'")" '^20$'
chk "как PostgREST, whoami пишет визит: коллеги, непрочитанные, фото, список, переписка отвечают" "$(RPC chat_people "select chat_people('$ANNA')->>'ok'") $(RPC chat_unread "select chat_unread('$ANNA')->>'ok'") $(RPC chat_photo "select chat_photo('$ANNA', $PH)->>'ok'") $(RPC chat_list "select chat_list('$ANNA')->>'ok'") $(RPC chat_open "select chat_open('$ANNA', $TEAM)->>'ok'")" '^true true true true true$'
chk "проверка проверяет: STABLE-функция с таким whoami в «только для чтения» падает" "$($P -c "begin transaction read only; select whoami('$ANNA'::uuid); commit;" 2>&1 | tr '\n' ' ')" 'read-only transaction'
chk "коллеги у Анны — все действующие своего заведения" "$(RPC chat_people "select jsonb_array_length(chat_people('$ANNA')->'people')")" '^5$'

# ── очистить чат (v91): «Вся команда» — руководитель и старший, «Старшие» — каждый, сеть — руководящий состав,
# личную — любой из двоих; стирается всё (фото и реакции вместе с сообщениями), закреп снимается, строки «кто очистил» нет
PP "update sa_chat_msgs set created_at = now() - interval '2 minutes', updated_at = now() - interval '2 minutes' where chat_id = $TEAM" >/dev/null
MC1=$(Q "select chat_send('$ANNA', $TEAM, 'Тестовое сообщение')->'msg'->>'id'")
Q "select chat_react('$ILYA', $MC1, 'ok')" >/dev/null; Q "select chat_pin('$MARIA', $TEAM, $MC1)" >/dev/null
PHC=$(Q "select chat_photo_send('$PETR', $TEAM, '$JPG', '$THB', 16, 12, 'Тестовое фото', null)->'msg'->'photo'->>'id'")
NT=$(PP "select count(*) from sa_chat_msgs where chat_id = $TEAM")
chk "очистить «Вся команда»: официанту — forbidden, чужому заведению — not_found, уволенному — auth" "$(Q "select chat_clear('$ANNA', $TEAM)->>'error'") $(Q "select chat_clear('$IRINA', $TEAM)->>'error'") $(Q "select chat_clear('$OLEG', $TEAM)->>'error'")" '^forbidden not_found auth$'
R=$(Q "select chat_clear('$MARIA', $TEAM)")
chk "старшая очищает «Вся команда»: стёрто всё ($NT), без строки «кто очистил»" "$(Q "select (x->>'removed') || '|' || coalesce(x->>'msg', 'нет') from (select '$R'::jsonb x) y")|$(PP "select count(*) from sa_chat_msgs where chat_id = $TEAM")" "^$NT\\|нет\\|0\$"
chk "после очистки: закрепа нет, фото и реакции ушли вместе с сообщениями" "$(PP "select (pin_id is null)::text from sa_chats where id = $TEAM") $(PP "select count(*) from sa_chat_photos where id = $PHC") $(PP "select count(*) from sa_chat_reacts where msg_id = $MC1")" '^true 0 0$'
chk "у Ильи: в команде пусто и непрочитанных 0; в переписке метка «очищен» для открытых чатов" "$(Q "select (c->>'unread') || ' ' || coalesce(c->>'last', 'нет') from jsonb_array_elements(chat_list('$ILYA')->'chats') c where c->>'kind' = 'team'")|$(Q "select (x->'chat'->>'cleared' is not null)::text || ' ' || jsonb_array_length(x->'msgs') from chat_open('$ILYA', $TEAM) x")" '^0 нет\|true 0$'
chk "«Старшие» очищает каждый из старших (Пётр, менеджер)" "$(Q "select chat_clear('$PETR', $LEADS)->>'ok'")|$(PP "select count(*) from sa_chat_msgs where chat_id = $LEADS")" '^true\|0$'
chk "«Руководители сети»: руководитель Порта — forbidden, руководящий состав (Мария) — очищает" "$(Q "select chat_clear('$IRINA', $NET)->>'error'") $(Q "select chat_clear('$MARIA', $NET)->>'ok'")" '^forbidden true$'
chk "чужую личную не очистить (Мария → Илья и Анна); нет такого чата — not_found" "$(Q "select chat_clear('$MARIA', $DMI)->>'error'") $(Q "select chat_clear('$MARIA', 999999)->>'error'")" '^not_found not_found$'
chk "личную очищает любой из двоих (Илья): сообщений нет, строки об очистке нет, у Анны в списке её нет" "$(Q "select (x->>'ok') || ' ' || coalesce(x->>'msg', 'нет') from chat_clear('$ILYA', $DMI) x")|$(PP "select count(*) from sa_chat_msgs where chat_id = $DMI")|$(Q "select count(*) from jsonb_array_elements(chat_list('$ANNA')->'chats') c where (c->>'id')::bigint = $DMI")" '^true нет\|0\|0$'
chk "фото личной ушло вместе с перепиской; после очистки в чат снова пишут" "$(PP "select count(*) from sa_chat_photos where id = $PH") $(Q "select chat_send('$ANNA', $TEAM, 'Начинаем с чистого листа')->>'ok'")" '^0 true$'

# ── свои чаты (v92): заводят руководитель и старший, участники — из своего заведения; видят только участники
PP "delete from net.sent_log; update sa_chat_reads set at = now() - interval '10 minutes', notified_at = null" >/dev/null
chk "официант свой чат не заводит — forbidden; без названия или без людей — bad_request" "$(Q "select chat_group_create('$ANNA', 'Бар', array['$IEMP'])->>'error'") $(Q "select chat_group_create('$MARIA', '   ', array['$IEMP'])->>'error'") $(Q "select chat_group_create('$MARIA', 'Бар', array['$IREMP', 'мусор'])->>'error'")" '^forbidden bad_request bad_request$'
R=$(Q "select chat_group_create('$MARIA', '  Бар  и   веранда ', array['$IEMP', '$AEMP', '$IREMP', 'мусор', '$MEMP'])")
GR=$(Q "select ('$R'::jsonb)->'chat'->>'id'")
chk "Мария заводит «Бар и веранда»: название в одну строку; участники — она, Илья, Анна (Ирина из Порта и мусор — нет)" "$(Q "select (x->'chat'->>'kind') || '|' || (x->'chat'->>'title') || '|' || (x->'chat'->>'owner') from (select '$R'::jsonb x) y")|$(PP "select string_agg(emp_id, ',' order by emp_id) from sa_chat_members where chat_id = $GR")" "^group\\|Бар и веранда\\|$MEMP\\|$MEMP,$AEMP,$IEMP\$"
chk "бот добавленным: «Мария Ким добавляет тебя в чат «Бар и веранда»» (Илья, Анна)" "$(sent 222 'Мария Ким добавляет тебя в чат «Бар и веранда»') $(sent 111 'Мария Ким добавляет тебя в чат «Бар и веранда»')" '^1 1$'
chk "у Анны в списке — свой чат после команды; у Петра (не участник) — нет; открыть и написать ему нельзя" "$(Q "select string_agg(c->>'kind', ',') from jsonb_array_elements(chat_list('$ANNA')->'chats') c where c->>'kind' <> 'dm'")|$(Q "select count(*) from jsonb_array_elements(chat_list('$PETR')->'chats') c where c->>'kind' = 'group'")|$(Q "select chat_open('$PETR', $GR)->>'error'") $(Q "select chat_send('$PETR', $GR, 'привет')->>'error'")" '^team,group\|0\|not_found not_found$'
MG=$(Q "select chat_send('$ANNA', $GR, 'Я принесу лёд')->'msg'->>'id'")
chk "Анна пишет в свой чат — у Ильи непрочитанное; участники в переписке — 3" "$(Q "select c->>'unread' from jsonb_array_elements(chat_list('$ILYA')->'chats') c where c->>'kind' = 'group'")|$(Q "select jsonb_array_length(chat_open('$ILYA', $GR)->'members')")" '^1\|3$'
chk "переименовать, добавить, убрать — только руководитель и старший (Анна — forbidden)" "$(Q "select chat_group_edit('$ANNA', $GR, 'Мой бар', null, null)->>'error'")" '^forbidden$'
R=$(Q "select chat_group_edit('$MARIA', $GR, 'Бар', array['$PEMP', '$IREMP'], array['$AEMP', '$MEMP'])")
chk "Мария: название «Бар», Пётр добавлен (Ирина из Порта — нет), Анна убрана, себя убрать нельзя" "$(Q "select (x->'chat'->>'title') || '|' || (select string_agg(m->>'id', ',' order by m->>'id') from jsonb_array_elements(x->'members') m) from (select '$R'::jsonb x) y")" "^Бар\\|$MEMP,$PEMP,$IEMP\$"
chk "убранной Анне чат не открыть; Петру переписка до него — прочитана (0 непрочитанных), но видна" "$(Q "select chat_open('$ANNA', $GR)->>'error'")|$(Q "select (c->>'unread') || ' ' || (c->'last'->>'id') from jsonb_array_elements(chat_list('$PETR')->'chats') c where c->>'kind' = 'group'")" "^not_found\\|0 $MG\$"
chk "бот Петру: «… добавляет тебя в чат «Бар»»" "$(sent 444 'Мария Ким добавляет тебя в чат «Бар»')" '^1$'
chk "закреп и чужое в своём чате — руководитель и старший: Илья — forbidden, Пётр (менеджер) — можно" "$(Q "select chat_pin('$ILYA', $GR, $MG)->>'error'") $(Q "select chat_delete('$ILYA', $MG)->>'error'") $(Q "select chat_pin('$PETR', $GR, $MG)->>'ok'") $(Q "select chat_delete('$PETR', $MG)->>'ok'")" '^forbidden forbidden true true$'
chk "Илья выходит сам — больше не участник; удалить чат ему нельзя" "$(Q "select chat_group_leave('$ILYA', $GR)->>'ok'") $(Q "select chat_open('$ILYA', $GR)->>'error'") $(Q "select chat_group_delete('$ILYA', $GR)->>'error'")" '^true not_found not_found$'
Q "select chat_send('$PETR', $GR, 'Последнее')" >/dev/null
chk "Пётр (руководитель, участник) удаляет чат у всех: чата, участников и переписки нет" "$(Q "select chat_group_delete('$PETR', $GR)->>'ok'")|$(PP "select count(*) from sa_chats where id = $GR")$(PP "select count(*) from sa_chat_members where chat_id = $GR")$(PP "select count(*) from sa_chat_msgs where chat_id = $GR")" '^true\|000$'
G2=$(Q "select chat_group_create('$MARIA', 'Двое', array['$IEMP'])->'chat'->>'id'")
Q "select chat_group_leave('$ILYA', $G2)" >/dev/null; Q "select chat_group_leave('$MARIA', $G2)" >/dev/null
chk "вышел последний — чата нет" "$(PP "select count(*) from sa_chats where id = $G2")" '^0$'
chk "20 своих чатов в сутки можно (удалённые не в счёт), дальше too_fast" "$(Q "select count(*) from generate_series(1, 30) g, lateral (select chat_group_create('$MARIA', 'Чат ' || g, array['$IEMP']) r) x where (x.r->>'ok')::boolean")|$(Q "select chat_group_create('$MARIA', 'Ещё', array['$IEMP'])->>'error'")" '^20\|too_fast$'

# ── права
chk "anon: 20 функций чата — можно" "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'chat\_%' and has_function_privilege('anon', p.oid, 'execute')")" '^20$'
chk "anon: служебные функции чата — нельзя" "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like '\_sa\_chat%' and has_function_privilege('anon', p.oid, 'execute')")" '^0$'
chk "anon: таблицы чата — нельзя (сообщения, фото, реакции, участники своих чатов)" "$(Q "select count(*) from sa_chat_msgs") $(Q "select count(*) from sa_chat_photos") $(Q "select count(*) from sa_chat_reacts") $(Q "select count(*) from sa_chat_members")" 'permission denied.*permission denied.*permission denied.*permission denied'
chk "чужой токен — auth (все 20)" "$(Q "select string_agg(x, ' ') from (values (chat_open('мусор', $TEAM)->>'error'), (chat_send('мусор', $TEAM, 'x')->>'error'), (chat_dm('мусор', '$AEMP')->>'error'), (chat_call('мусор', 'host', null, 'help', null, null)->>'error'), (chat_go('мусор', $CALL)->>'error'), (chat_delete('мусор', $CALL)->>'error'), (chat_people('мусор')->>'error'), (chat_unread('мусор')->>'error'), (chat_read('мусор', $TEAM, 1)->>'error'), (chat_list('мусор')->>'error'), (chat_edit('мусор', $CALL, 'x')->>'error'), (chat_react('мусор', $CALL, 'ok')->>'error'), (chat_pin('мусор', $TEAM, null)->>'error'), (chat_photo('мусор', 1)->>'error'), (chat_photo_send('мусор', $TEAM, '$JPG', '$THB', 16, 12, '', null)->>'error'), (chat_clear('мусор', $TEAM)->>'error'), (chat_group_create('мусор', 'x', array['$IEMP'])->>'error'), (chat_group_edit('мусор', $TEAM, 'x', null, null)->>'error'), (chat_group_leave('мусор', $TEAM)->>'error'), (chat_group_delete('мусор', $TEAM)->>'error')) v(x)")" '^(auth ){19}auth$'

echo
echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
