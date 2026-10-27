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
chk "итог этапа: 35 функций, таблицы, вид «Чат», бот, кнопки в Telegram" "$OUT38" 'чат смены: 35 функций из 35 · таблицы: есть · вид «Чат» в напоминаниях: да · Telegram: .* · кнопки в Telegram: '
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
chk "все 35 функций чата — VOLATILE: PostgREST не запирает их «только для чтения»" "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'chat\_%' and p.provolatile = 'v'")" '^35$'
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

# ── умный чат (v93): смены в графике без подтверждения (руководители видят), задание, опрос, «поделиться», брифинг,
# стоп-лист, Наставник в переписке
# график: должности и правила; клетки — от сегодняшнего дня (t_set: строка, через сколько дней, буква или '')
PP "update schedule_venues set config = config || jsonb_build_object('staff', jsonb_build_array(
      jsonb_build_object('id', 's1', 'name', 'Анна Смирнова', 'pos', 'waiter'), jsonb_build_object('id', 's2', 'name', 'Илья Бармен', 'pos', 'bar'),
      jsonb_build_object('id', 's3', 'name', 'Мария', 'pos', 'manager'), jsonb_build_object('id', 's4', 'name', 'Пётр Иванов', 'pos', 'waiter'),
      jsonb_build_object('id', 's5', 'name', 'Кто-то Неизвестный', 'pos', 'waiter')), 'rules', jsonb_build_object('minRest', 11, 'maxRow', 5))
    where restaurant = 'Два моря, Океан' and venue_key = 'main'" >/dev/null
$P -c "create or replace function t_day(p_n int) returns date language sql as \$f\$ select (now() at time zone _sa_tz('Два моря, Океан'))::date + p_n \$f\$;
  create or replace function t_d(p_n int) returns text language sql as \$f\$ select to_char(t_day(p_n), 'YYYY-MM-DD') \$f\$;
  create or replace function t_set(p_sid text, p_n int, p_k text) returns void language plpgsql as \$f\$
  declare d date := t_day(p_n); mk text := to_char(t_day(p_n), 'YYYY-MM'); dn text := extract(day from t_day(p_n))::int::text;
  begin
    insert into schedule_months (restaurant, venue_key, month, payload) values ('Два моря, Океан', 'main', mk, '{\"plan\": {}}') on conflict (restaurant, venue_key, month) do nothing;
    update schedule_months set payload = jsonb_set(jsonb_set(payload, '{plan}', coalesce(payload->'plan', '{}')), array['plan', p_sid],
        case when p_k = '' then coalesce(payload->'plan'->p_sid, '{}') - dn else coalesce(payload->'plan'->p_sid, '{}') || jsonb_build_object(dn, p_k) end)
     where restaurant = 'Два моря, Океан' and venue_key = 'main' and month = mk;
  end \$f\$;
  create or replace function t_get(p_sid text, p_n int, p_what text default 'plan') returns text language sql as \$f\$
    select coalesce((select m.payload->p_what->p_sid->>(extract(day from t_day(p_n))::int::text) from schedule_months m
      where m.restaurant = 'Два моря, Океан' and m.venue_key = 'main' and m.month = to_char(t_day(p_n), 'YYYY-MM')), '') \$f\$" >/dev/null
PORTT=$(PP "select id from sa_chats where restaurant = 'Порт' and kind = 'team'"); NET=$(PP "select id from sa_chats where kind = 'net'")
PP "update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null   # лимит 20 в минуту — с чистого листа
for n in 1 2 3 4 5 6 7 8 9 10 11 12; do PP "select t_set('s1', $n, ''), t_set('s2', $n, ''), t_set('s3', $n, ''), t_set('s4', $n, '')" >/dev/null; done
PP "select t_set('s1', 4, 'В'), t_set('s1', 5, 'В'), t_set('s1', 8, 'Д'), t_set('s4', 3, 'Д'), t_set('s4', 5, 'Д'), t_set('s4', 9, 'У'), t_set('s2', 4, 'Д'), t_set('s3', 4, 'У')" >/dev/null
D3=$(PP "select t_d(3)"); D4=$(PP "select t_d(4)"); D5=$(PP "select t_d(5)"); D8=$(PP "select t_d(8)"); D0=$(PP "select t_d(0)")
DS4=$(PP "select _sa_chat_dshort(t_day(4))"); DS3=$(PP "select _sa_chat_dshort(t_day(3))"); DS8=$(PP "select _sa_chat_dshort(t_day(8))"); DL4=$(PP "select _sa_chat_dlong(t_day(4))")
chk "мои смены на месяц: сегодня (по графику) и три впереди; «Вечер 16:00–24:00 · официант»" "$(Q "select string_agg((s->>'date') || ':' || (s->>'k'), ',') || '|' || (x->'shifts'->0->>'label') || ' ' || (x->'shifts'->0->>'time') || ' ' || (x->'shifts'->0->>'pos') from chat_shift_mine('$ANNA') x, jsonb_array_elements(x->'shifts') s group by x")" "^$D0:В,$D4:В,$D5:В,$D8:Д\\|Вечер 16:00–24:00 официант\$"
calm "$PEMP"; PP "delete from net.sent_log" >/dev/null
R=$(Q "select chat_shift_offer('$ANNA', $TEAM, '$D4', 'give', null, '  Сестра выходит замуж  ')")
SG=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "Анна отдаёт смену: карточка — дата, «В», «Вечер», строка графика, записка; текст сообщения — для списка" "$(Q "select (x->'msg'->>'kind') || '|' || (x->'msg'->'card'->>'mode') || '|' || (x->'msg'->'card'->>'date') || '|' || (x->'msg'->'card'->>'k') || '|' || (x->'msg'->'card'->>'sid') || '|' || (x->'msg'->'card'->>'note') || '|' || (x->'msg'->>'body') from (select '$R'::jsonb x) y")" "^card\\|give\\|$D4\\|В\\|s1\\|Сестра выходит замуж\\|Отдаю смену: $DL4 · вечер 16:00–24:00\$"
chk "кто может забрать (Пётр — официант по графику, свободен), тому бот: «Анна С. отдаёт смену: …»" "$(sent 444 'Анна С. отдаёт смену:')" '^1$'
chk "ещё раз тот же день — already; нет смены — no_shift; режим, прошлое, далеко — bad_request" "$(Q "select chat_shift_offer('$ANNA', $TEAM, '$D4', 'give')->>'error'") $(Q "select chat_shift_offer('$ANNA', $TEAM, '$D3', 'give')->>'error'") $(Q "select chat_shift_offer('$ANNA', $TEAM, '$D5', 'x')->>'error'") $(Q "select chat_shift_offer('$ANNA', $TEAM, to_char(current_date - 3, 'YYYY-MM-DD'), 'give')->>'error'") $(Q "select chat_shift_offer('$ANNA', $TEAM, to_char(current_date + 80, 'YYYY-MM-DD'), 'give')->>'error'")" '^already no_shift bad_request bad_request bad_request$'
chk "Роман (его нет в графике) — not_in_schedule; Ирина (у Порта графика нет) — no_schedule" "$(Q "select chat_shift_offer('$ROMAN', $TEAM, '$D4', 'give')->>'error'") $(Q "select chat_shift_offer('$IRINA', $PORTT, '$D4', 'give')->>'error'")" '^not_in_schedule no_schedule$'
can() { Q "select coalesce(m->'card'->>'can', '-') || '|' || coalesce(m->'card'->>'why', '') from jsonb_array_elements(chat_open('$1', $TEAM)->'msgs') m where (m->>'id')::bigint = $2"; }
chk "Пётр видит «можешь забрать»: свободен, отдых 20 и 12 ч, три смены подряд" "$(can $PETR $SG)" '^true\|$'
chk "Илье (бар) и Марии (менеджер по графику) — нельзя: «Забрать могут официанты, свободные в этот день»" "$(can $ILYA $SG) $(can $MARIA $SG)" '^false\|Забрать могут официанты, свободные в этот день false\|Забрать могут официанты, свободные в этот день$'
chk "Роману — «Тебя нет в графике»; самой Анне — без can (её карточка)" "$(can $ROMAN $SG) $(can $ANNA $SG)" '^false\|Тебя нет в графике -\|$'
PP "select t_set('s4', 5, 'У')" >/dev/null
chk "правила графика: утро назавтра после вечера — «мало отдыха перед сменой назавтра (нужно 11 ч)»" "$(can $PETR $SG)" '^false\|Не получится: мало отдыха перед сменой назавтра \(нужно 11 ч\)$'
PP "select t_set('s4', 5, 'Д'), t_set('s4', 1, 'Д'), t_set('s4', 2, 'Д'), t_set('s4', 6, 'Д'), t_set('s4', 7, 'Д')" >/dev/null
chk "больше 5 смен подряд — нельзя" "$(can $PETR $SG)" '^false\|Не получится: вышло бы больше 5 смен подряд$'
PP "select t_set('s4', 1, ''), t_set('s4', 2, ''), t_set('s4', 6, ''), t_set('s4', 7, '')" >/dev/null
PP "update schedule_venues set config = jsonb_set(config, '{staff,3,vacs}', jsonb_build_object(to_char(t_day(4), 'YYYY-MM'), jsonb_build_array(jsonb_build_array(extract(day from t_day(4))::int, extract(day from t_day(4))::int)))) where restaurant = 'Два моря, Океан'" >/dev/null
chk "в отпуске — нельзя" "$(can $PETR $SG)" '^false\|Не получится: в отпуске$'
PP "update schedule_venues set config = config #- '{staff,3,vacs}' where restaurant = 'Два моря, Океан'" >/dev/null
PP "select t_set('s4', 4, 'У')" >/dev/null
chk "в этот день уже своя смена — нельзя" "$(can $PETR $SG)" '^false\|Не получится: в этот день уже есть смена$'
PP "select t_set('s4', 4, '')" >/dev/null
calm "$AEMP"; PP "delete from net.sent_log" >/dev/null
R=$(Q "select chat_shift_take('$PETR', $SG)")
chk "Пётр забирает: карточка закрыта (кто взял), в графике смена у Петра, у Анны нет; клетки под замком; кто менял — чат" "$(Q "select (x->>'ok') || '|' || (x->'msg'->'card'->>'st') || '|' || (x->'msg'->'card'->>'byName') from (select '$R'::jsonb x) y")|$(PP "select t_get('s1', 4) || ',' || t_get('s4', 4) || ',' || t_get('s1', 4, 'locks') || ',' || t_get('s4', 4, 'locks')")|$(PP "select updated_by from schedule_months where restaurant = 'Два моря, Океан' and month = to_char(t_day(4), 'YYYY-MM')")" '^true\|done\|Пётр Иванов\|,В,true,true\|Чат: Пётр Иванов$'
chk "второй раз — taken (с карточкой как есть); Анна — свою не берёт" "$(Q "select (x->>'error') || ' ' || (x->'msg'->'card'->>'st') from chat_shift_take('$ILYA', $SG) x") $(Q "select chat_shift_take('$ANNA', $SG)->>'error'")" '^taken done taken$'
chk "«Старшие»: строка «Передача смены …, вечер: отдаёт Анна С., забирает Пётр И. · график обновлён»" "$(Q "select (m->>'kind') || '|' || (m->'card'->>'t') || '|' || (m->>'body') from jsonb_array_elements(chat_open('$MARIA', $LEADS)->'msgs') m order by (m->>'id')::bigint desc limit 1")" "^sys\\|log\\|Передача смены $DS4, вечер: отдаёт Анна С\\., забирает Пётр И\\. · график обновлён\$"
chk "бот: Анне — «Пётр И. забирает твою смену», руководителям (Мария) — строка; Илье (не руководитель) — ничего" "$(sent 111 'Пётр И. забирает твою смену:') $(sent 333 'Передача смены') $(sent 222 'Передача смены')" '^1 1 0$'
# обмен: Пётр меняет +3 (день) на +8 (у Анны день)
R=$(Q "select chat_shift_offer('$PETR', $TEAM, '$D3', 'swap', array['$D8', 'мусор', '$D3'], '')")
SW=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "Пётр меняет смену: взамен — только верные дни (не мусор и не тот же день)" "$(Q "select (x->'msg'->'card'->>'mode') || '|' || (x->'msg'->'card'->'want')::text || '|' || (x->'msg'->>'body') from (select '$R'::jsonb x) y")" "^swap\\|\\[\"$D8\"\\]\\|Меняю смену: "
chk "Анна может поменяться (в этот день свободна, у неё смена в просимый день); Илья — «Поменяться могут официанты»" "$(can $ANNA $SW) $(can $ILYA $SW)" '^true\|  ?false\|Поменяться могут официанты$'
chk "варианты для Анны: её день $D8 (правила графика — для обоих); у Ильи — пусто и почему" "$(Q "select string_agg((s->>'date') || ':' || (s->>'k') || ':' || (s->>'label') || ':' || (s->>'time'), ',') from jsonb_array_elements(chat_shift_options('$ANNA', $SW)->'shifts') s")|$(Q "select jsonb_array_length(x->'shifts') || ' ' || (x->>'why') from chat_shift_options('$ILYA', $SW) x")" "^$D8:Д:День:12:00–20:00\\|0 Поменяться могут официанты\$"
chk "не тот день — not_allowed с причиной" "$(Q "select (x->>'error') || '|' || (x->>'why') from chat_shift_swap('$ANNA', $SW, '$D5') x")" '^not_allowed\|'
R=$(Q "select chat_shift_swap('$ANNA', $SW, '$D8')")
chk "поменялись: в графике у Анны +3 «Д», у Петра +8 «Д» и наоборот пусто; карточка — с какого дня и какая смена" "$(Q "select (x->'msg'->'card'->>'st') || '|' || (x->'msg'->'card'->>'byDate') || '|' || (x->'msg'->'card'->>'byLabel') from (select '$R'::jsonb x) y")|$(PP "select t_get('s4', 3) || ',' || t_get('s1', 3) || ',' || t_get('s1', 8) || ',' || t_get('s4', 8)")" "^done\\|$D8\\|День\\|,Д,,Д\$"
chk "«Старшие»: «Обмен сменами: Пётр И. (…) и Анна С. (…) · график обновлён»" "$(Q "select m->>'body' from jsonb_array_elements(chat_open('$MARIA', $LEADS)->'msgs') m order by (m->>'id')::bigint desc limit 1")" "^Обмен сменами: Пётр И\\. \\($DS3\\) и Анна С\\. \\($DS8\\) · график обновлён\$"
# отменить; открытое предложение не в «моих сменах»; удалённое — снято
R=$(Q "select chat_shift_offer('$ANNA', $TEAM, '$D5', 'give')"); SC=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "открытое предложение — не в «моих сменах»" "$(Q "select count(*) from jsonb_array_elements(chat_shift_mine('$ANNA')->'shifts') s where s->>'date' = '$D5'")" '^0$'
chk "отменить чужое — forbidden; своё — off; забрать отменённое — taken" "$(Q "select chat_shift_cancel('$PETR', $SC)->>'error'") $(Q "select chat_shift_cancel('$ANNA', $SC)->'msg'->'card'->>'st'") $(Q "select chat_shift_take('$PETR', $SC)->>'error'")" '^forbidden off taken$'
R=$(Q "select chat_shift_offer('$ANNA', $TEAM, '$D5', 'give')"); SD=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
Q "select chat_delete('$ANNA', $SD)" >/dev/null
chk "удалённая карточка смены — снята (off), забрать нельзя" "$(PP "select card->>'st' from sa_chat_msgs where id = $SD")|$(Q "select chat_shift_take('$PETR', $SD)->>'error'")" '^off\|not_found$'
chk "в «Руководителях сети» сменами не меняются — not_found" "$(Q "select chat_shift_offer('$MARIA', $NET, '$D4', 'give')->>'error'")" '^not_found$'
# опрос
R=$(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'poll', 'q', ' Кто выйдет в субботу? ', 'opts', jsonb_build_array('Я выйду', ' ', 'Не смогу')))")
PL=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "опрос: вопрос и варианты (пустой — мимо), голосов нет; текст — «Опрос: …»" "$(Q "select (x->'msg'->'card'->>'q') || '|' || (x->'msg'->'card'->'opts')::text || '|' || jsonb_array_length(x->'msg'->'card'->'votes') || '|' || (x->'msg'->>'body') from (select '$R'::jsonb x) y")" '^Кто выйдет в субботу\?\|\["Я выйду", "Не смогу"\]\|0\|Опрос: Кто выйдет в субботу\?$'
chk "плохие опросы: в личной, один вариант, повтор (без учёта регистра), 7 вариантов, короткий вопрос — bad_request" "$(Q "select chat_card_send('$ANNA', $DM, jsonb_build_object('t', 'poll', 'q', 'Вопрос?', 'opts', jsonb_build_array('a', 'b')))->>'error'") $(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'poll', 'q', 'Вопрос?', 'opts', jsonb_build_array('a')))->>'error'") $(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'poll', 'q', 'Вопрос?', 'opts', jsonb_build_array('Да', 'да')))->>'error'") $(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'poll', 'q', 'Вопрос?', 'opts', jsonb_build_array('1', '2', '3', '4', '5', '6', '7')))->>'error'") $(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'poll', 'q', 'Ну', 'opts', jsonb_build_array('a', 'b')))->>'error'")" '^(bad_request ){4}bad_request$'
chk "голос: Илья за первый, потом за второй (один у человека), второй раз — снять; мимо вариантов — bad_request; из Порта — not_found" "$(Q "select v->>'o' || ':' || (v->>'name') from chat_poll_vote('$ILYA', $PL, 0) x, jsonb_array_elements(x->'msg'->'card'->'votes') v") $(Q "select string_agg(v->>'o', ',') from chat_poll_vote('$ILYA', $PL, 1) x, jsonb_array_elements(x->'msg'->'card'->'votes') v") $(Q "select jsonb_array_length(chat_poll_vote('$ILYA', $PL, 1)->'msg'->'card'->'votes')") $(Q "select chat_poll_vote('$ILYA', $PL, 5)->>'error'") $(Q "select chat_poll_vote('$IRINA', $PL, 0)->>'error'")" '^0:Илья Бармен 1 0 bad_request not_found$'
Q "select chat_poll_vote('$PETR', $PL, 0)" >/dev/null
chk "в переписке голоса видны всем (Анна видит голос Петра)" "$(Q "select string_agg(v->>'name', ',') from jsonb_array_elements(chat_open('$ANNA', $TEAM)->'msgs') m, jsonb_array_elements(m->'card'->'votes') v where (m->>'id')::bigint = $PL")" '^Пётр Иванов$'
chk "закрепить опрос можно: «Мария Ким закрепляет «Опрос: …»»" "$(Q "select chat_pin('$MARIA', $TEAM, $PL)->'msg'->>'body'")" '^Мария закрепляет «Опрос: Кто выйдет в субботу\?»$'
# задание
calm "$AEMP"; calm "$IEMP"; PP "delete from net.sent_log" >/dev/null
chk "задание даёт руководитель или старший (Анна — forbidden); не урок, срок в прошлом, в сети — bad_request" "$(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'task', 'item', jsonb_build_object('kind', 'lesson', 'id', 's0-2', 'title', 'Стресс')))->>'error'") $(Q "select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'task', 'item', jsonb_build_object('kind', 'dish', 'id', 'd1', 'title', 'Тартар')))->>'error'") $(Q "select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'task', 'due', '2020-01-01', 'item', jsonb_build_object('kind', 'lesson', 'id', 's0-2', 'title', 'Стресс')))->>'error'") $(Q "select chat_card_send('$MARIA', $NET, jsonb_build_object('t', 'task', 'item', jsonb_build_object('kind', 'lesson', 'id', 's0-2', 'title', 'Стресс')))->>'error'")" '^forbidden bad_request bad_request bad_request$'
R=$(Q "select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'task', 'due', '$D3', 'item', jsonb_build_object('kind', 'lesson', 'id', 's0-2', 'title', 'Как справляться со стрессом', 'mins', 6, 'img', 'javascript:alert(1)')))")
TK=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "задание всем: кому — Анна, Вера и Илья (руководители не в счёт), прошла Анна: 1 из 3; руководителю — кто ещё нет; картинка не https — мимо" "$(Q "select (x->'msg'->'card'->>'n') || '/' || (x->'msg'->'card'->>'of') || '|' || (x->'msg'->'card'->'left')::text || '|' || coalesce(x->'msg'->'card'->'item'->>'img', 'нет') || '|' || (x->'msg'->'card'->'item'->>'mins') from (select '$R'::jsonb x) y")" '^1/3\|\["Вера Новая", "Илья Бармен"\]\|нет\|6$'
chk "Илье (не руководитель) — без списка «кто ещё нет»" "$(Q "select coalesce(m->'card'->>'left', 'нет') || ' ' || (m->'card'->>'n') from jsonb_array_elements(chat_open('$ILYA', $TEAM)->'msgs') m where (m->>'id')::bigint = $TK")" '^нет 1$'
chk "бот тем, кому задание и кто ещё не прошёл: Илье «Мария К. даёт задание: пройти урок «…» до …»; Анне (прошла) — нет" "$(sent 222 'Мария К. даёт задание: пройти урок «Как справляться со стрессом» до ') $(sent 111 'Мария К. даёт задание:')" '^1 0$'
chk "официантам — Анна и Вера (1 из 2); тест s0-q — сдала Анна; тема из уроков и теста — Анна прошла всё" "$(Q "select (c->>'n') || '/' || (c->>'of') from (select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'task', 'to', 'waiter', 'item', jsonb_build_object('kind', 'lesson', 'id', 's0-2', 'title', 'Стресс')))->'msg'->'card' c) y") $(Q "select (c->>'n') || '/' || (c->>'of') from (select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'task', 'item', jsonb_build_object('kind', 'quiz', 'id', 's0-q', 'title', 'Тест: первый день')))->'msg'->'card' c) y") $(Q "select (c->>'n') || '/' || (c->>'of') from (select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'task', 'item', jsonb_build_object('kind', 'module', 'id', 's0', 'title', 'Первый день', 'lessons', jsonb_build_array('s0-1', 's0-2'), 'quizzes', jsonb_build_array('s0-q'))))->'msg'->'card' c) y")" '^1/2 1/3 1/3$'
PP "delete from net.sent_log" >/dev/null
chk "«Напомнить»: Анне — forbidden; Марии — двое не прошли, бот Илье (у Веры нет Telegram); второй раз за 3 часа — too_fast" "$(Q "select chat_task_remind('$ANNA', $TK)->>'error'") $(Q "select (x->>'n') || ':' || (x->>'sent') from chat_task_remind('$MARIA', $TK) x") $(sent 222 'Мария К. напоминает: пройди урок «Как справляться со стрессом»') $(Q "select chat_task_remind('$MARIA', $TK)->>'error'")" '^forbidden 2:1 1 too_fast$'
# поделиться и брифинг
chk "поделиться блюдом: «Блюдо: Тартар»; в сети блюдо — bad_request, урок — можно; что попало — bad_request" "$(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'share', 'item', jsonb_build_object('kind', 'dish', 'id', 'd1', 'title', 'Тартар', 'sub', 'тунец, авокадо')))->'msg'->>'body'") $(Q "select chat_card_send('$MARIA', $NET, jsonb_build_object('t', 'share', 'item', jsonb_build_object('kind', 'dish', 'id', 'd1', 'title', 'Тартар')))->>'error'") $(Q "select chat_card_send('$MARIA', $NET, jsonb_build_object('t', 'share', 'item', jsonb_build_object('kind', 'lesson', 'id', 's0-1', 'title', 'Первый день')))->>'ok'") $(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'share', 'item', jsonb_build_object('kind', 'dish', 'id', 'плохой id', 'title', 'x')))->>'error'") $(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'zz'))->>'error'")" '^Блюдо: Тартар bad_request true bad_request bad_request$'
chk "брифинг: Анне — forbidden; в «Старших» — bad_request; в команде — строки без пустых, дата сегодня" "$(Q "select chat_card_send('$ANNA', $TEAM, jsonb_build_object('t', 'brief', 'lines', jsonb_build_array('x')))->>'error'") $(Q "select chat_card_send('$MARIA', $LEADS, jsonb_build_object('t', 'brief', 'lines', jsonb_build_array('x')))->>'error'") $(Q "select (c->'lines')::text || '|' || (c->>'date') from (select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'brief', 'title', 'Брифинг смены', 'lines', jsonb_build_array('Банкет на 12 в 19:00', ' ', 'Стоп: тартар')))->'msg'->'card' c) y")" "^forbidden bad_request \\[\"Банкет на 12 в 19:00\", \"Стоп: тартар\"\\]\\|$D0\$"
# стоп-лист: меню заведения (этап 4)
PP "create table if not exists restaurant_menu (restaurant text primary key, dishes jsonb not null default '[]', updated_by text, updated_at timestamptz default now());
    insert into restaurant_menu (restaurant, dishes) values ('Два моря, Океан', jsonb_build_array(jsonb_build_object('id', 'd1', 'name', 'Тартар из тунца', 'img', 'https://cdn.example/t.jpg'),
      jsonb_build_object('id', 'd2', 'name', 'Борщ с уткой'), jsonb_build_object('id', 'c1', 'kind', 'cocktail', 'name', 'Негрони')))
    on conflict (restaurant) do update set dishes = excluded.dishes" >/dev/null
chk "стоп-лист — руководитель и старший (Анна — forbidden), не в личной; коктейль и чужое блюдо — not_found" "$(Q "select chat_stop_set('$ANNA', $TEAM, 'd1', true)->>'error'") $(Q "select chat_stop_set('$MARIA', $DM, 'd1', true)->>'error'") $(Q "select chat_stop_set('$MARIA', $TEAM, 'c1', true)->>'error'") $(Q "select chat_stop_set('$MARIA', $TEAM, 'zz', true)->>'error'")" '^forbidden not_found not_found not_found$'
R=$(Q "select chat_stop_set('$MARIA', $TEAM, 'd1', true)")
ST=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "в стоп: карточка (блюдо, фото https), «В стоп-листе: …»; в меню у блюда stop.since и stopAt" "$(Q "select (x->'msg'->'card'->>'st') || '|' || (x->'msg'->'card'->'dish'->>'name') || '|' || (x->'msg'->'card'->'dish'->>'img') || '|' || (x->'msg'->>'body') from (select '$R'::jsonb x) y")|$(PP "select (d->'stop'->>'since')::bigint > 0 and (d->>'stopAt')::bigint > 0 and d->'stop'->>'by' = 'Мария Ким' from restaurant_menu, jsonb_array_elements(dishes) d where restaurant = 'Два моря, Океан' and d->>'id' = 'd1'")" '^on\|Тартар из тунца\|https://cdn.example/t.jpg\|В стоп-листе: Тартар из тунца\|t$'
chk "«Вернуть в меню» по карточке: «Снова в меню», кто вернул; в меню stop пуст, stopAt новее; второй раз — ok" "$(Q "select (x->'msg'->'card'->>'st') || '|' || (x->'msg'->'card'->>'offBy') || '|' || (x->'msg'->>'body') from chat_stop_set('$MARIA', $TEAM, null, false, $ST) x")|$(PP "select jsonb_typeof(d->'stop') from restaurant_menu, jsonb_array_elements(dishes) d where restaurant = 'Два моря, Океан' and d->>'id' = 'd1'")|$(Q "select chat_stop_set('$MARIA', $TEAM, null, false, $ST)->>'ok'")" '^off\|Мария Ким\|Снова в меню: Тартар из тунца\|null\|true$'
# Наставник
QA=$(Q "select chat_send('$ANNA', $TEAM, '@Наставник какие аллергены в борще?')->'msg'->>'id'")
chk "Наставник: проверка до ИИ — можно, осталось 30; за чужой вопрос — bad_request" "$(Q "select (x->>'check') || ' ' || (x->>'left') from chat_ai_post('$ANNA', $TEAM, $QA) x") $(Q "select chat_ai_post('$PETR', $TEAM, $QA, 'Ответ', null)->>'error'")" '^true 30 bad_request$'
R=$(Q "select chat_ai_post('$ANNA', $TEAM, $QA, '  Борщ с уткой: молоко и сельдерей.  ', jsonb_build_array(jsonb_build_object('kind', 'dish', 'id', 'd2', 'title', 'Борщ с уткой'), jsonb_build_object('kind', 'evil', 'id', 'x', 'title', 'x'), jsonb_build_object('kind', 'dish', 'id', 'плохой', 'title', 'y')))")
chk "ответ Наставника в переписке: от «Наставник», ответ на вопрос, одна верная карточка" "$(Q "select (x->'msg'->>'kind') || '|' || (x->'msg'->>'emp') || '|' || (x->'msg'->>'name') || '|' || (x->'msg'->'reply'->>'id') || '|' || (x->'msg'->>'body') || '|' || jsonb_array_length(x->'msg'->'card'->'cards') from (select '$R'::jsonb x) y")" "^ai\\|ai\\|Наставник\\|$QA\\|Борщ с уткой: молоко и сельдерей\\.\\|1\$"
chk "второй ответ на тот же вопрос — already; «Наставник, …» в начале — можно; «@наставники» — не вопрос Наставнику" "$(Q "select chat_ai_post('$ANNA', $TEAM, $QA, 'ещё', null)->>'error'") $(Q "select chat_ai_post('$ANNA', $TEAM, (chat_send('$ANNA', $TEAM, 'Наставник, как подать вино?')->'msg'->>'id')::bigint)->>'ok'") $(Q "select chat_ai_post('$ANNA', $TEAM, (chat_send('$ANNA', $TEAM, '@наставники привет')->'msg'->>'id')::bigint)->>'error'")" '^already true bad_request$'
Q2=$(Q "select chat_send('$ANNA', $TEAM, '@Наставник старый вопрос')->'msg'->>'id'"); PP "update sa_chat_msgs set created_at = now() - interval '11 minutes' where id = $Q2" >/dev/null
PP "insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind) select $TEAM, 'ai', 'Наставник', 'Два моря, Океан', 'x', 'ai' from generate_series(1, 29)" >/dev/null
chk "вопрос старше 10 минут — bad_request; 30 ответов за день на заведение — ai_limit" "$(Q "select chat_ai_post('$ANNA', $TEAM, $Q2)->>'error'") $(Q "select chat_ai_post('$ANNA', $TEAM, (chat_send('$ANNA', $TEAM, '@Наставник ещё вопрос')->'msg'->>'id')::bigint)->>'error'")" '^bad_request ai_limit$'
PP "delete from sa_chat_msgs where kind = 'ai' and body = 'x'" >/dev/null
chk "в списке чатов: последнее — карточка или ответ текстом (для превью)" "$(Q "select c->'last'->>'body' from jsonb_array_elements(chat_list('$ANNA')->'chats') c where c->>'kind' = 'team'")" '.+'

# ── чат и приложение (v97): «Ищем в смену» и замена, предложения смен для графика, карточка коллеги, стоп-лист из Меню,
# брифинг без повторов, «График готов» и «Пожелания», кнопки в сообщениях бота, ответ из Telegram
for n in 13 14 15 16; do PP "select t_set('s1', $n, ''), t_set('s2', $n, ''), t_set('s3', $n, ''), t_set('s4', $n, '')" >/dev/null; done
PP "select t_set('s1', 14, 'Д'), t_set('s1', 16, 'В')" >/dev/null
D13=$(PP "select t_d(13)"); D14=$(PP "select t_d(14)"); D16=$(PP "select t_d(16)"); DL13=$(PP "select _sa_chat_dlong(t_day(13))")
DS13=$(PP "select _sa_chat_dshort(t_day(13))"); DS14=$(PP "select _sa_chat_dshort(t_day(14))"); M16=$(PP "select to_char(t_day(16), 'YYYY-MM')")
calm "$AEMP"; calm "$PEMP"; calm "$IEMP"; calm "$MEMP"; PP "delete from net.sent_log; update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null
chk "«Ищем в смену» — руководитель и старший (Анна — forbidden); у Порта графика нет; плохая должность, смена, сколько" "$(Q "select chat_shift_need('$ANNA', null, '$D13', 'waiter', 'В')->>'error'") $(Q "select chat_shift_need('$IRINA', null, '$D13', 'waiter', 'В')->>'error'") $(Q "select chat_shift_need('$MARIA', null, '$D13', 'Официант!', 'В')->>'error'") $(Q "select chat_shift_need('$MARIA', null, '$D13', 'waiter', 'Ж')->>'error'") $(Q "select chat_shift_need('$MARIA', null, '$D13', 'waiter', 'В', 9)->>'error'") $(Q "select chat_shift_need('$MARIA', $NET, '$D13', 'waiter', 'В')->>'error'")" '^forbidden no_schedule bad_request no_shift bad_request not_found$'
R=$(Q "select chat_shift_need('$MARIA', null, '$D13', 'waiter', 'В', 2, '  Банкет на веранде  ')")
NE=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "«Ищем 2 официантов»: в «Вся команда», смена вечер, записка; текст для списка" "$(Q "select (x->'msg'->>'chat') || '|' || (x->'msg'->'card'->>'mode') || '|' || (x->'msg'->'card'->>'k') || '|' || (x->'msg'->'card'->>'n') || '|' || (x->'msg'->'card'->>'note') || '|' || (x->'msg'->>'body') from (select '$R'::jsonb x) y")" "^$TEAM\\|need\\|В\\|2\\|Банкет на веранде\\|Ищем 2 официантов: $DL13 · вечер 16:00–24:00\$"
chk "бот тем, кто может выйти (Анна, Пётр), — с кнопкой «Выйду»; Илье (бар) — нет" "$(PP "select count(*) from net.sent_log where body->>'chat_id' in ('111', '444') and body->>'text' like 'Мария К. ищет 2 официантов в смену:%' and body->'reply_markup'->'inline_keyboard'->0->0->>'callback_data' = 'ct:$NE' and body->'reply_markup'->'inline_keyboard'->1->0->'web_app'->>'url' = 'https://app.example/?go=chat_${TEAM}_$NE'") $(sent 222 'ищет 2 официантов')" '^2 0$'
chk "тот же поиск ещё раз — already" "$(Q "select chat_shift_need('$MARIA', null, '$D13', 'waiter', 'В', 2)->>'error'")" '^already$'
chk "Анне — «можно»; Илье — «Выйти могут официанты»; Марии (искала) — без can" "$(can $ANNA $NE) $(can $ILYA $NE) $(can $MARIA $NE)" '^true\| false\|Выйти могут официанты -\|$'
R=$(Q "select chat_shift_take('$ANNA', $NE)")
chk "Анна выходит: в графике «В», карточка ещё открыта (нужно 2), в списке — Анна; Анне второй раз — «Ты выходишь в эту смену»" "$(Q "select (x->>'ok') || '|' || (x->'msg'->'card'->>'st') || '|' || (x->'msg'->'card'->'took'->0->>'name') from (select '$R'::jsonb x) y")|$(PP "select t_get('s1', 13) || ',' || t_get('s1', 13, 'locks')")|$(Q "select (x->>'error') || ':' || (x->>'why') from chat_shift_take('$ANNA', $NE) x")" '^true\|open\|Анна Смирнова\|В,true\|not_allowed:Ты выходишь в эту смену$'
calm "$MEMP"; PP "delete from net.sent_log" >/dev/null
R=$(Q "select chat_shift_take('$PETR', $NE)")
chk "Пётр выходит — нашли двоих, карточка закрыта; у Петра в графике «В»; третий — taken" "$(Q "select (x->'msg'->'card'->>'st') || '|' || jsonb_array_length(x->'msg'->'card'->'took') from (select '$R'::jsonb x) y")|$(PP "select t_get('s4', 13)")|$(Q "select chat_shift_take('$ILYA', $NE)->>'error'")" '^done\|2\|В\|taken$'
chk "«Старшие»: «Смена …, вечер (официант): выходит Пётр И. · график обновлён»; бот Марии — «Пётр И. выходит в смену: …»" "$(Q "select m->>'body' from jsonb_array_elements(chat_open('$MARIA', $LEADS)->'msgs') m order by (m->>'id')::bigint desc limit 1")|$(sent 333 'Пётр И. выходит в смену:')" "^Смена $DS13, вечер \\(официант\\): выходит Пётр И\\. · график обновлён\\|1\$"
# замена: Анна не сможет выйти +14 — руководитель ищет вместо неё
calm "$AEMP"; PP "delete from net.sent_log" >/dev/null
chk "замена — только с той же должностью и сменой (иначе bad_request)" "$(Q "select chat_shift_need('$MARIA', null, '$D14', 'waiter', 'В', 1, '', 's1')->>'error'") $(Q "select chat_shift_need('$MARIA', null, '$D14', 'bar', 'Д', 1, '', 's1')->>'error'")" '^bad_request bad_request$'
R=$(Q "select chat_shift_need('$MARIA', $TEAM, '$D14', 'waiter', 'Д', 3, '', 's1')")
RP=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "замена: один человек, вместо — Анна (имя из графика); текст «Ищем замену: … (официант)»" "$(Q "select (x->'msg'->'card'->>'n') || '|' || (x->'msg'->'card'->'instead'->>'name') || '|' || (x->'msg'->>'body') from (select '$R'::jsonb x) y")" '^1\|Анна Смирнова\|Ищем замену: .* · день 12:00–20:00 \(официант\)$'
chk "Анне (её заменяют) — нельзя, без причины; Петру — можно" "$(can $ANNA $RP) $(can $PETR $RP)" '^false\| true\|$'
Q "select chat_shift_take('$PETR', $RP)" >/dev/null
chk "Пётр вместо Анны: у Петра «Д», у Анны пусто (обе клетки под замком); «Старшие»: «Замена …: выходит Пётр И., не выходит Анна С.»; бот Анне — «… выходит вместо тебя»" "$(PP "select t_get('s4', 14) || ',' || t_get('s1', 14) || ',' || t_get('s1', 14, 'locks')")|$(Q "select m->>'body' from jsonb_array_elements(chat_open('$MARIA', $LEADS)->'msgs') m order by (m->>'id')::bigint desc limit 1")|$(sent 111 'Пётр И. выходит вместо тебя:')" "^Д,,true\\|Замена $DS14, день \\(официант\\): выходит Пётр И\\., не выходит Анна С\\. · график обновлён\\|1\$"
# предложения смен для графика
R=$(Q "select chat_shift_offer('$ANNA', $TEAM, '$D16', 'give', null, 'Свадьба')"); OF=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "предложения на месяц для «Графика»: Анне — её (mine), Петру — можно забрать; плохой месяц — bad_request" "$(Q "select string_agg((o->>'msg') || ':' || (o->>'mine') || ':' || coalesce(o->'card'->>'can', '-'), ',') from jsonb_array_elements(chat_shift_board('$ANNA', '$M16')->'offers') o where (o->>'msg')::bigint = $OF")|$(Q "select string_agg((o->>'msg') || ':' || (o->>'mine') || ':' || coalesce(o->'card'->>'can', '-'), ',') from jsonb_array_elements(chat_shift_board('$PETR', '$M16')->'offers') o where (o->>'msg')::bigint = $OF")|$(Q "select chat_shift_board('$ANNA', '2026-13')->>'error'")" "^$OF:true:-\\|$OF:false:true\\|bad_request\$"
chk "у Порта (Ирина) этих предложений нет" "$(Q "select count(*) from jsonb_array_elements(chat_shift_board('$IRINA', '$M16')->'offers') o where (o->>'msg')::bigint = $OF")" '^0$'
# карточка коллеги
chk "карточка коллеги: Анна смотрит Петра — должность и ближайшая смена; Ирина у Анны — not_found; Мария (руководитель) видит Ирину" "$(Q "select (p->>'name') || '|' || (p->>'pos') || '|' || coalesce(p->'next'->>'label', p->'today'->>'label', '-') || '|' || (p->>'same') from (select chat_person('$ANNA', '$PEMP')->'person' p) y")|$(Q "select chat_person('$ANNA', '$IREMP')->>'error'")|$(Q "select (p->>'name') || ':' || (p->>'same') from (select chat_person('$MARIA', '$IREMP')->'person' p) y")" '^Пётр Иванов\|manager\|[^|]+\|true\|not_found\|Ирина Портова:false$'
chk "карточка коллеги: личная переписка Анны с Марией — её id" "$(Q "select chat_person('$ANNA', '$MEMP')->'person'->>'dm'")" "^$DM\$"
# стоп-лист из Меню
chk "стоп из Меню — руководитель (Анна — forbidden); блюда нет в меню — not_found" "$(Q "select chat_stop_note('$ANNA', 'd2', true)->>'error'") $(Q "select chat_stop_note('$MARIA', 'нет', true)->>'error'")" '^forbidden not_found$'
R=$(Q "select chat_stop_note('$MARIA', 'd2', true)")
SN=$(Q "select ('$R'::jsonb)->'msg'->>'id'")
chk "стоп из Меню: карточка в «Вся команда» («В стоп-листе: Борщ с уткой»), меню не тронуто; второй раз — та же карточка" "$(Q "select (x->'msg'->>'chat') || '|' || (x->'msg'->'card'->>'st') || '|' || (x->'msg'->>'body') from (select '$R'::jsonb x) y")|$(PP "select coalesce(jsonb_typeof(d->'stop'), 'нет') from restaurant_menu, jsonb_array_elements(dishes) d where restaurant = 'Два моря, Океан' and d->>'id' = 'd2'")|$(Q "select (x->>'again') || ':' || (x->'msg'->>'id') from chat_stop_note('$MARIA', 'd2', true) x")" "^$TEAM\\|on\\|В стоп-листе: Борщ с уткой\\|нет\\|true:$SN\$"
chk "вернули в меню в Меню — карточка «Снова в меню: …»" "$(Q "select (x->>'n') || '|' || (x->'msg'->'card'->>'st') || '|' || (x->'msg'->>'body') from chat_stop_note('$MARIA', 'd2', false) x")" '^1\|off\|Снова в меню: Борщ с уткой$'
# брифинг без повторов; «Вся команда» по умолчанию
B1=$(Q "select chat_card_send('$MARIA', null, jsonb_build_object('t', 'brief', 'lines', jsonb_build_array('Брони: 2')))->'msg'->>'id'")
chk "брифинг из экрана «Брифинг» (без чата — в «Вся команда»); правка — та же карточка с новыми строками" "$(Q "select (x->>'again') || '|' || (x->'msg'->>'id') || '|' || (x->'msg'->'card'->'lines')::text from chat_card_send('$MARIA', null, jsonb_build_object('t', 'brief', 'lines', jsonb_build_array('Брони: 3', 'Стоп: борщ'))) x")|$(PP "select chat_id from sa_chat_msgs where id = $B1")" "^true\\|$B1\\|\\[\"Брони: 3\", \"Стоп: борщ\"\\]\\|$TEAM\$"
# «График готов», «Пожелания»
calm "$AEMP"; PP "delete from net.sent_log; update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null
MNEXT=$(PP "select to_char(date_trunc('month', t_day(0)) + interval '1 month', 'YYYY-MM')"); MNOM=$(PP "select _sa_chat_mon(extract(month from date_trunc('month', t_day(0)) + interval '1 month')::int, false)")
# даты — заранее: служебные t_day/t_d зовут _sa_tz, а anon её не видит
M200=$(PP "select to_char(t_day(0) + 200, 'YYYY-MM')"); U3=$(PP "select t_d(3)")
chk "«График готов» — руководитель (Анна — forbidden); месяц в прошлом или через полгода — bad_request" "$(Q "select chat_card_send('$ANNA', null, jsonb_build_object('t', 'sched', 'month', '$MNEXT'))->>'error'") $(Q "select chat_card_send('$MARIA', null, jsonb_build_object('t', 'sched', 'month', '2020-01'))->>'error'") $(Q "select chat_card_send('$MARIA', null, jsonb_build_object('t', 'sched', 'month', '$M200'))->>'error'")" '^forbidden bad_request bad_request$'
chk "«График на … готов» в «Вся команда»; бот команде с кнопкой «Открыть график»" "$(Q "select chat_card_send('$MARIA', null, jsonb_build_object('t', 'sched', 'month', '$MNEXT'))->'msg'->>'body'")|$(PP "select count(*) from net.sent_log where body->>'chat_id' = '111' and body->>'text' like 'График на % готов. Проверь свои смены.' and body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url' = 'https://app.example/?go=schedule'")" "^График на $MNOM готов\\|1\$"
chk "«Пожелания на …: до …»; срок в прошлом — bad_request" "$(Q "select chat_card_send('$MARIA', null, jsonb_build_object('t', 'sched', 'what', 'wishes', 'month', '$MNEXT', 'until', '$U3'))->'msg'->>'body'") $(Q "select chat_card_send('$MARIA', null, jsonb_build_object('t', 'sched', 'what', 'wishes', 'month', '$MNEXT', 'until', '2020-01-01'))->>'error'")" "^Пожелания на $MNOM: до [0-9]+ [^ ]+ bad_request\$"
# Telegram: кнопки и ответ в чат (вебхук — секрет из sa_settings)
PP "insert into sa_settings (key, value) values ('tg_webhook_secret', 'sec38') on conflict (key) do update set value = excluded.value" >/dev/null
TGU() { PP "select sa_tg_update('sec38', \$j\$$1\$j\$::jsonb)"; }
CBJ() { echo "{\"update_id\": $1, \"callback_query\": {\"id\": \"cq$1\", \"from\": {\"id\": $2}, \"data\": \"$3\", \"message\": {\"message_id\": 7$1, \"chat\": {\"id\": $2, \"type\": \"private\"}, \"text\": \"$4\", \"reply_markup\": {\"inline_keyboard\": [[{\"text\": \"Кнопка\", \"callback_data\": \"$3\"}], [{\"text\": \"Открыть чат\", \"web_app\": {\"url\": \"https://app.example/?go=chat_$TEAM\"}}]]}}}}"; }
calm "$AEMP"; PP "delete from net.sent_log; update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null
CL=$(Q "select chat_call('$MARIA', 'person', '$AEMP', 'table', '5', null)->'msg'->>'id'")
chk "вызов: бот Анне — «Мария зовёт тебя: к столу 5» с кнопкой «Иду» (cg:…) и «Открыть чат»" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '111' and body->>'text' = 'Мария зовёт тебя: к столу 5' and body->'reply_markup'->'inline_keyboard'->0->0->>'callback_data' = 'cg:$CL' and body->'reply_markup'->'inline_keyboard'->1->0->>'text' = 'Открыть чат'")" '^1$'
chk "вебхук: чужой секрет — отказ; Telegram не связан с приложением — ничего не меняется" "$(PP "select sa_tg_update('не тот', '$(CBJ 1 111 "cg:$CL" "x")'::jsonb)->>'error'") $(TGU "$(CBJ 2 999 "cg:$CL" "x")" | grep -o '"skip": "who"')|$(PP "select coalesce(jsonb_array_length(call->'going'), 0) from sa_chat_msgs where id = $CL")" '^secret "skip": "who"\|0$'
PP "delete from net.sent_log" >/dev/null
TGU "$(CBJ 3 111 "cg:$CL" "Мария зовёт тебя: к столу 5")" >/dev/null
chk "«Иду» в Telegram (Анна): идёт в вызове; сообщение бота дописано «Ты идёшь.», кнопки «Иду» больше нет, «Открыть чат» осталась; Марии — «Анна идёт: к столу 5»" "$(PP "select call->'going'->0->>'name' from sa_chat_msgs where id = $CL")|$(PP "select count(*) from net.sent_log where url like '%/editMessageText' and body->>'text' = E'Мария зовёт тебя: к столу 5\n\nТы идёшь.' and jsonb_array_length(body->'reply_markup'->'inline_keyboard') = 1 and body->'reply_markup'->'inline_keyboard'->0->0->>'text' = 'Открыть чат'")|$(PP "select count(*) from net.sent_log where url like '%/answerCallbackQuery' and body->>'text' = 'Отметил: ты идёшь'")|$(sent 333 'Анна идёт: к столу 5')" '^Анна Смирнова\|1\|1\|1$'
calm "$PEMP"; PP "delete from net.sent_log; update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null
PP "select t_set('s1', 15, 'Д')" >/dev/null; D15=$(PP "select t_d(15)")
OT=$(Q "select chat_shift_offer('$ANNA', $TEAM, '$D15', 'give')->'msg'->>'id'")
chk "отдаю смену: бот Петру — «… Забрать можно прямо здесь.» с кнопкой «Забрать» (ct:…)" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '444' and body->>'text' like 'Анна С. отдаёт смену: % Забрать можно прямо здесь.' and body->'reply_markup'->'inline_keyboard'->0->0->>'callback_data' = 'ct:$OT'")" '^1$'
PP "delete from net.sent_log" >/dev/null
TGU "$(CBJ 4 444 "ct:$OT" "Анна С. отдаёт смену")" >/dev/null
chk "«Забрать» в Telegram (Пётр): смена его, график обновлён; сообщение — «Смена твоя. График обновлён.»" "$(PP "select card->>'st' || ':' || (card->>'byName') from sa_chat_msgs where id = $OT")|$(PP "select t_get('s4', 15) || ',' || t_get('s1', 15)")|$(PP "select count(*) from net.sent_log where url like '%/editMessageText' and body->>'text' like '%Смена твоя. График обновлён.'")" '^done:Пётр Иванов\|Д,\|1$'
TGU "$(CBJ 5 222 "ct:$OT" "Анна С. отдаёт смену")" >/dev/null
chk "второй нажал (Илья) — «Смену уже забрали.»" "$(PP "select count(*) from net.sent_log where url like '%/answerCallbackQuery' and body->>'text' = 'Смену уже забрали.'")" '^1$'
calm "$AEMP"; PP "delete from net.sent_log; update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null
PV=$(Q "select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'poll', 'q', 'Кто выйдет в воскресенье?', 'opts', jsonb_build_array('Я выйду', 'Не смогу')))->'msg'->>'id'")
chk "опрос руководителя: бот Анне — «Мария К. спрашивает: …» с вариантами-кнопками" "$(PP "select (body->'reply_markup'->'inline_keyboard'->0->0->>'text') || '|' || (body->'reply_markup'->'inline_keyboard'->1->0->>'callback_data') from net.sent_log where body->>'chat_id' = '111' and body->>'text' = 'Мария К. спрашивает: Кто выйдет в воскресенье?'")" "^Я выйду\\|cv:$PV:1\$"
TGU "$(CBJ 6 111 "cv:$PV:1" "Мария К. спрашивает")" >/dev/null; TGU "$(CBJ 7 111 "cv:$PV:1" "Мария К. спрашивает")" >/dev/null
# кнопки в сообщении — те же, что пришли от Telegram (в CBJ — две строки): варианты остаются, можно переголосовать
chk "голос в Telegram: «Не смогу»; повторное нажатие голос не снимает; варианты в сообщении остаются" "$(PP "select string_agg(emp_name || ':' || o, ',') from sa_chat_votes where msg_id = $PV")|$(PP "select count(*) from net.sent_log where url like '%/editMessageText' and body->>'text' like '%Твой ответ: «Не смогу».' and jsonb_array_length(body->'reply_markup'->'inline_keyboard') = 2")" '^Анна Смирнова:1\|2$'
chk "задание: бот с кнопкой «Открыть урок» (go=lesson_…)" "$(calm "$IEMP"; PP "delete from net.sent_log; update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null; Q "select chat_card_send('$MARIA', $TEAM, jsonb_build_object('t', 'task', 'item', jsonb_build_object('kind', 'lesson', 'id', 's1-1', 'title', 'Что такое сервис?')))->>'ok'" >/dev/null; PP "select body->'reply_markup'->'inline_keyboard'->0->0->>'text' || '|' || (body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url') from net.sent_log where body->>'chat_id' = '222' and body->>'text' like 'Мария К. даёт задание:%'")" '^Открыть урок\|https://app.example/\?go=lesson_s1-1$'
# ответ из Telegram в чат
calm "$AEMP"; PP "delete from net.sent_log; update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null
DMM=$(Q "select chat_send('$MARIA', $DM, 'Анна, выйдешь завтра на час раньше?')->'msg'->>'id'")
chk "личное: бот Анне — «Мария Ким пишет тебе: …», ссылка «Открыть чат» на эту переписку и сообщение" "$(PP "select body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url' from net.sent_log where body->>'chat_id' = '111' and body->>'text' like 'Мария Ким пишет тебе:%'")" "^https://app.example/\\?go=chat_${DM}_$DMM\$"
RJ() { echo "{\"update_id\": $1, \"message\": {\"message_id\": 9$1, \"from\": {\"id\": $2}, \"chat\": {\"id\": $2, \"type\": \"private\"}, $3 \"reply_to_message\": {\"message_id\": 5$1, \"from\": {\"id\": 1, \"is_bot\": true}, \"text\": \"Мария Ким пишет тебе\", \"reply_markup\": {\"inline_keyboard\": [[{\"text\": \"Открыть чат\", \"web_app\": {\"url\": \"$4\"}}]]}}}}"; }
calm "$MEMP"; PP "delete from net.sent_log" >/dev/null   # Мария только что писала (прочитала свой чат) — иначе бот её не беспокоит
TGU "$(RJ 1 111 '"text": "Да, выйду к 11",' "https://app.example/?go=chat_${DM}_$DMM")" >/dev/null
chk "ответ на сообщение бота (Анна): в личной переписке «Да, выйду к 11» с цитатой; бот: «Ушло в личную переписку.»; Марии — «Анна Смирнова пишет тебе»" "$(Q "select (m->>'name') || '|' || (m->>'body') || '|' || (m->'reply'->>'id') from jsonb_array_elements(chat_open('$MARIA', $DM)->'msgs') m order by (m->>'id')::bigint desc limit 1")|$(sent 111 'Ушло в личную переписку.')|$(sent 333 'Анна Смирнова пишет тебе:')" "^Анна Смирнова\\|Да, выйду к 11\\|$DMM\\|1\\|1\$"
chk "ответ без ссылки на чат — подсказка; фото без текста — «только текст»; чужой чат (Порт) — «больше нет»; не связан — ничего" "$(TGU "$(RJ 2 111 '"text": "привет",' "https://app.example/")" | grep -o '"skip": "link"') $(TGU "$(RJ 3 111 '"photo": [],' "https://app.example/?go=chat_$TEAM")" | grep -o '"skip": "text"') $(TGU "$(RJ 4 111 '"text": "x",' "https://app.example/?go=chat_$PORTT")" | grep -o '"skip": "gone"') $(TGU "$(RJ 5 999 '"text": "x",' "https://app.example/?go=chat_$TEAM")" | grep -o '"skip": "who"')" '^"skip": "link" "skip": "text" "skip": "gone" "skip": "who"$'
chk "просто текст боту — подсказка, как ответить в чат; /start — как раньше; вопрос дня (qd:…) — через тот же вебхук" "$(TGU '{"update_id": 9, "message": {"message_id": 1, "from": {"id": 111}, "chat": {"id": 111, "type": "private"}, "text": "привет"}}' | grep -o '"hint": true') $(TGU '{"update_id": 10, "message": {"message_id": 2, "from": {"id": 111}, "chat": {"id": 111, "type": "private"}, "text": "/start"}}' | grep -o '"start": true') $(TGU "$(CBJ 8 111 "qd:999999:0" "x")" | grep -o '"skip": "row"')" '^"hint": true "start": true "skip": "row"$'

# ── права
chk "anon: 35 функций чата — можно; вебхук и связка Telegram — нельзя" "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'chat\_%' and has_function_privilege('anon', p.oid, 'execute')") $(PP "select has_function_privilege('anon', 'sa_tg_update(text, jsonb)', 'execute') or has_function_privilege('anon', '_sa_tg_caller(text)', 'execute')")" '^35 f$'
chk "anon: служебные функции чата и графика — нельзя" "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like '\_sa\_chat%' or p.proname like '\_sa\_sh\_%') and has_function_privilege('anon', p.oid, 'execute')")" '^0$'
chk "anon: таблицы чата — нельзя (сообщения, фото, реакции, участники своих чатов, голоса)" "$(Q "select count(*) from sa_chat_msgs") $(Q "select count(*) from sa_chat_photos") $(Q "select count(*) from sa_chat_reacts") $(Q "select count(*) from sa_chat_members") $(Q "select count(*) from sa_chat_votes")" 'permission denied.*permission denied.*permission denied.*permission denied.*permission denied'
chk "чужой токен — auth (все 35)" "$(Q "select string_agg(x, ' ') from (values (chat_open('мусор', $TEAM)->>'error'), (chat_send('мусор', $TEAM, 'x')->>'error'), (chat_dm('мусор', '$AEMP')->>'error'), (chat_call('мусор', 'host', null, 'help', null, null)->>'error'), (chat_go('мусор', $CALL)->>'error'), (chat_delete('мусор', $CALL)->>'error'), (chat_people('мусор')->>'error'), (chat_unread('мусор')->>'error'), (chat_read('мусор', $TEAM, 1)->>'error'), (chat_list('мусор')->>'error'), (chat_edit('мусор', $CALL, 'x')->>'error'), (chat_react('мусор', $CALL, 'ok')->>'error'), (chat_pin('мусор', $TEAM, null)->>'error'), (chat_photo('мусор', 1)->>'error'), (chat_photo_send('мусор', $TEAM, '$JPG', '$THB', 16, 12, '', null)->>'error'), (chat_clear('мусор', $TEAM)->>'error'), (chat_group_create('мусор', 'x', array['$IEMP'])->>'error'), (chat_group_edit('мусор', $TEAM, 'x', null, null)->>'error'), (chat_group_leave('мусор', $TEAM)->>'error'), (chat_group_delete('мусор', $TEAM)->>'error'),
    (chat_shift_mine('мусор')->>'error'), (chat_shift_offer('мусор', $TEAM, '$D4', 'give')->>'error'), (chat_shift_take('мусор', $SG)->>'error'), (chat_shift_options('мусор', $SW)->>'error'),
    (chat_shift_swap('мусор', $SW, '$D8')->>'error'), (chat_shift_cancel('мусор', $SC)->>'error'), (chat_card_send('мусор', $TEAM, '{}'::jsonb)->>'error'), (chat_task_remind('мусор', $TK)->>'error'),
    (chat_poll_vote('мусор', $PL, 0)->>'error'), (chat_stop_set('мусор', $TEAM, 'd1', true)->>'error'), (chat_ai_post('мусор', $TEAM, $QA)->>'error'),
    (chat_shift_need('мусор', null, '$D13', 'waiter', 'В')->>'error'), (chat_shift_board('мусор', '$M16')->>'error'), (chat_person('мусор', '$AEMP')->>'error'), (chat_stop_note('мусор', 'd1', true)->>'error')) v(x)")" '^(auth ){34}auth$'

echo
echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
