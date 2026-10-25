#!/bin/bash
# Этап 35 (v85, Доп. 398): рассадка для хостес — floor_save / seat_board / seat_set / seat_clear.
# Поверх базы run25.sh: копия satest35, этапы 26, 31, 32 и 35 (35 — дважды), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test35.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest35
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
D=$(mktemp -d); cp "$SRC"/supabase-stage26-mastery.sql "$SRC"/supabase-stage31-qday.sql "$SRC"/supabase-stage32-briefing.sql "$SRC"/supabase-stage35-seating.sql "$D"/; chmod -R a+r "$D"
RC=0; OUT35=""
for f in supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage35-seating.sql supabase-stage35-seating.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
  [ "$f" = supabase-stage35-seating.sql ] && OUT35="$out"
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2; ILYA=10000000-0000-0000-0000-0000000000a5
IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5; OLEG=00000000-0000-0000-0000-0000000000a6; IVANE=00000000-0000-0000-0000-0000000000b2
PLAN='{"v":1,"tables":[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0},{"id":"t2","n":"2","seats":4,"shape":"rd","x":2,"y":0},{"id":"t3","n":"6","seats":6,"shape":"long","x":4,"y":1}]}'
cnt() { PP "select count(*) from net.sent_log"; }

chk "этапы 26, 31, 32 и 35 (35 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 4 функции, таблицы, вид «Рассадка» в напоминаниях" "$OUT35" 'рассадка: 4 функции из 4 · таблицы: есть · вид «Рассадка» в напоминаниях: да'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null

# ── схема
chk "схема: доска без схемы — plan null, столов нет" "$(Q "select coalesce(x->>'plan', 'null') || ' ' || jsonb_array_length(x->'tables') from seat_board('$ANNA') x")" '^null 0$'
chk "схему рисует руководитель: Анна (официант) — forbidden" "$(Q "select floor_save('$ANNA', '$PLAN'::jsonb)->>'error'")" '^forbidden$'
chk "битая схема — bad_plan (форма, места, клетка за краем, длинный у правого края, клетка не числом)" "$(Q "select floor_save('$MARIA', '{\"tables\":[{\"id\":\"t1\",\"n\":\"1\",\"seats\":4,\"shape\":\"star\",\"x\":0,\"y\":0}]}'::jsonb)->>'error'") $(Q "select floor_save('$MARIA', '{\"tables\":[{\"id\":\"t1\",\"n\":\"1\",\"seats\":0,\"shape\":\"sq\",\"x\":0,\"y\":0}]}'::jsonb)->>'error'") $(Q "select floor_save('$MARIA', '{\"tables\":[{\"id\":\"t1\",\"n\":\"1\",\"seats\":4,\"shape\":\"sq\",\"x\":8,\"y\":0}]}'::jsonb)->>'error'") $(Q "select floor_save('$MARIA', '{\"tables\":[{\"id\":\"t1\",\"n\":\"1\",\"seats\":4,\"shape\":\"long\",\"x\":7,\"y\":0}]}'::jsonb)->>'error'") $(Q "select floor_save('$MARIA', '{\"tables\":[{\"id\":\"t1\",\"n\":\"1\",\"seats\":\"4\",\"shape\":\"sq\",\"x\":\"abc\",\"y\":0}]}'::jsonb)->>'error'")" '^bad_plan bad_plan bad_plan bad_plan bad_plan$'
chk "крайние клетки — можно: квадрат в 7:29, длинный в 6:0" "$(Q "select floor_save('$MARIA', '{\"tables\":[{\"id\":\"t1\",\"n\":\"1\",\"seats\":4,\"shape\":\"sq\",\"x\":7,\"y\":29},{\"id\":\"t2\",\"n\":\"2\",\"seats\":8,\"shape\":\"long\",\"x\":6,\"y\":0}]}'::jsonb)->>'tables'")" '^2$'
chk "одинаковые номера столов — duplicate" "$(Q "select floor_save('$MARIA', '{\"tables\":[{\"id\":\"t1\",\"n\":\"5\",\"seats\":4,\"shape\":\"sq\",\"x\":0,\"y\":0},{\"id\":\"t2\",\"n\":\"5\",\"seats\":4,\"shape\":\"sq\",\"x\":1,\"y\":0}]}'::jsonb)->>'error'")" '^duplicate$'
chk "Мария сохраняет схему: 3 стола" "$(Q "select floor_save('$MARIA', '$PLAN'::jsonb)->>'tables'")" '^3$'
B=$(Q "select seat_board('$ANNA')")
chk "доска: схема, сегодняшний день заведения, кто обслуживает (без уволенных и чужих)" "$(Q "select jsonb_array_length(x->'plan'->'tables') || ' ' || (x->>'day') || ' ' || (select string_agg(s->>'name', ',' order by s->>'name') from jsonb_array_elements(x->'staff') s) from seat_board('$ANNA') x")" '^3 [0-9]{4}-[0-9]{2}-[0-9]{2} Анна,Илья,Мария,Пётр$'
chk "Ирина (Порт): чужой схемы нет" "$(Q "select seat_board('$IRINA')->'plan'")" '^null$'

# ── стол
chk "нет такого стола — no_table; неизвестный статус и время — bad_request" "$(Q "select seat_set('$ANNA', 't9', 'seat', 2, '', '', null)->>'error'") $(Q "select seat_set('$ANNA', 't1', 'busy', 2, '', '', null)->>'error'") $(Q "select seat_set('$ANNA', 't1', 'res', 2, 'Иванов', '25:00', null)->>'error'")" '^no_table bad_request bad_request$'
chk "официант не из заведения (Иван, Порт) или уволенный — bad_waiter" "$(Q "select seat_set('$ANNA', 't1', 'seat', 2, '', '', '$IVANE')->>'error'") $(Q "select seat_set('$ANNA', 't1', 'seat', 2, '', '', '$OLEG')->>'error'")" '^bad_waiter bad_waiter$'
R1=$(Q "select seat_set('$MARIA', 't2', 'res', 4, 'Иванов', '19:30', null)")
chk "бронь: время, на кого, сколько" "$R1" '"cnt": 4.*"name": "Иванов".*"rtime": "19:30".*"status": "res"'
$P -c "delete from net.sent_log" >/dev/null
R2=$(Q "select seat_set('$MARIA', 't3', 'seat', 5, 'игнор', '18:00', '$AEMP')")
chk "посадили: гостей 5, официант Анна, время посадки сервера, бронь стёрта" "$R2|$(PP "select (since is not null) || ' ' || name || '|' || rtime || '|' || waiter_name from sa_seat where tid = 't3'")" '"status": "seat".*\|true \|\|Анна Смирнова$'
chk "Анне — сообщение: стол, сколько гостей, кто посадил, кнопка в рассадку" "$(PP "select (body->>'chat_id') || ' ' || (body->>'text') || ' ' || (body::text like '%?go=seat%') from net.sent_log")" '^111 Стол 6: посадили 5 гостей\. Посадил\(а\): Мария Ким\. true$'
SINCE=$(PP "select since from sa_seat where tid = 't3'")
chk "правка числа гостей того же стола: время посадки прежнее, второго сообщения нет" "$(Q "select seat_set('$MARIA', 't3', 'seat', 6, '', '', '$AEMP')->'table'->>'cnt'")|$(PP "select since = '$SINCE' from sa_seat where tid = 't3'")|$(cnt)" '^6\|t\|1$'
chk "стол передали Илье — ему сообщение (1 гостя → «гостя»)" "$(Q "select seat_set('$MARIA', 't1', 'seat', 1, '', '', '$IEMP')->>'ok'")|$(PP "select body->>'text' from net.sent_log where body->>'chat_id' = '222'")" '^true\|Стол 1: посадили 1 гостя\. Посадил\(а\): Мария Ким\.$'
chk "Анна посадила себе — себе не пишем" "$(Q "select seat_set('$ANNA', 't2', 'seat', 4, '', '', '$AEMP')->>'ok'")|$(PP "select count(*) from net.sent_log where body->>'chat_id' = '111'")" '^true\|1$'
chk "уборка и свободен: всё стирается" "$(Q "select seat_set('$ANNA', 't2', 'clean', 4, 'x', '19:00', '$AEMP')->'table'")|$(Q "select seat_set('$ANNA', 't2', 'free', 0, '', '', null)->'table'->>'status'")" '"cnt": 0.*"name": "".*"rtime": "".*"since": null.*"status": "clean".*"waiter_id": null.*\|free$'
chk "доска у Ильи: состояние столов, кто менял последним" "$(Q "select string_agg((t->>'tid') || ':' || (t->>'status'), ',' order by t->>'tid') || ' ' || (select t2->>'updated_name' from jsonb_array_elements(x->'tables') t2 where t2->>'tid' = 't2') from seat_board('$ILYA') x, jsonb_array_elements(x->'tables') t group by x")" '^t1:seat,t2:free,t3:seat Анна Смирнова$'
chk "вчерашняя доска сегодня не видна (новый день — чистая доска)" "$(PP "update sa_seat set day = day - 1 where tid = 't1'; select 1")|$(Q "select jsonb_array_length(seat_board('$ANNA')->'tables')")" '\|2$'

# ── очистить, выключенные сообщения, без бота
chk "очистить доску — только руководитель" "$(Q "select seat_clear('$ANNA')->>'error'")|$(Q "select seat_clear('$MARIA')->>'cleared'")|$(Q "select jsonb_array_length(seat_board('$ANNA')->'tables')")" '^forbidden\|2\|0$'
$P -c "delete from net.sent_log" >/dev/null
$P -c "set role anon; select notify_set('$ANNA', 'seat', false)" >/dev/null
chk "Анна выключила «Рассадку» — о посадке ей не пишем" "$(Q "select seat_set('$MARIA', 't2', 'seat', 3, '', '', '$AEMP')->>'ok'")|$(cnt)" '^true\|0$'
$P -c "delete from vault.secrets_stub" >/dev/null
chk "без токена бота: доска работает, сообщений нет" "$(Q "select seat_set('$MARIA', 't1', 'seat', 2, '', '', '$IEMP')->>'ok'")|$(cnt)" '^true\|0$'

# ── права
chk "anon: четыре функции — можно" "$(PP "select has_function_privilege('anon', 'public.floor_save(text, jsonb)', 'execute') and has_function_privilege('anon', 'public.seat_board(text)', 'execute') and has_function_privilege('anon', 'public.seat_set(text, text, text, int, text, text, text)', 'execute') and has_function_privilege('anon', 'public.seat_clear(text)', 'execute')")" '^t$'
chk "anon: таблицы напрямую — нельзя" "$(Q "select count(*) from sa_seat")|$(Q "select count(*) from sa_floor")" '(permission denied|нет доступа).*\|.*(permission denied|нет доступа)'
chk "чужой токен — auth" "$(Q "select seat_board('мусор')->>'error'") $(Q "select seat_set('мусор', 't1', 'free', 0, '', '', null)->>'error'")" '^auth auth$'

echo "Итого: $pass ✓, $fail ✗"
