#!/bin/bash
# Этап 68 (v212, Доп. 538): «Позвать» подряд — тот же вызов второй раз за 30 секунд не уходит (already), другой —
# сразу; от лавины — не больше 15 вызовов за 5 минут (too_many и через сколько секунд можно).
# Поверх базы run25.sh: копия satest68, этапы 26, 31, 32, 34, 35, 36, 37 и 38 — как у test38.sh, график «на сегодня».
# Без этапа 38 — понятная ошибка. Этап 68 дважды. Отправка в Telegram — заглушка pg_net (net.sent_log).
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test68.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest68
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S68=supabase-stage68-call-series.sql
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql"
POST="supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql supabase-stage38-chat.sql"
D=$(mktemp -d); for f in $PRE $POST $S68; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; OLEG=10000000-0000-0000-0000-0000000000a6
MEMP=00000000-0000-0000-0000-0000000000a2; AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5
sent() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1' and body->>'text' like '%' || \$t\$$2\$t\$ || '%'"; }
# ответ коротко: ok или ошибка · id прошлого вызова (already) · стол
CL() { Q "with x as (select chat_call('$1', $2) j) select coalesce(j->>'error', 'ok') || ' · ' || coalesce(j->'msg'->>'id', '—') || ' · ' || coalesce(nullif(j->'msg'->'call'->>'table', ''), '—') from x"; }
back() { PP "update sa_chat_msgs set created_at = created_at - interval '$2' where kind = 'call' and emp_id = '$1'" >/dev/null; }   # вызовы человека — раньше

# ── Без этапа 38 — понятная ошибка ────────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}x" -c "create database ${DB}x template satest25" >/dev/null 2>&1
chk "без этапа 38: «Сначала этап 38»" "$($P0 -d ${DB}x -f "$D/$S68" 2>&1 | grep -o 'Сначала этап 38[^:]*: нет чата смены' | head -1)" '^Сначала этап 38 \(supabase-stage38-chat.sql\): нет чата смены$'
$P0 -d postgres -c "drop database if exists ${DB}x" >/dev/null 2>&1

for f in $PRE; do run $f; done
# v91: функции прошлых этапов с проверкой входа, объявленные STABLE, — этап 38 переводит их в VOLATILE (как в test38.sh)
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
for f in $POST; do run $f; done
chk "этапы 26, 31, 32, 34, 35, 36, 37, 38 — без ошибок" "$RC" '^0$'
# график «на сегодня» (как seed24.sql, от сегодняшнего дня)
sed -n '1,/^end \$\$;/p' "$HERE/seed24.sql" > "$D/seed-today.sql"
$P0 -d $DB -c "delete from schedule_months where restaurant = 'Два моря, Океан'; delete from schedule_venues where restaurant = 'Два моря, Океан'" -f "$D/seed-today.sql" >/dev/null
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null

# этап 38: после любого вызова 30 секунд — too_fast (как было)
chk "до этапа 68: второй вызов к другому столу — too_fast" "$(CL $MARIA "'person', '$AEMP', 'table', '5', null")|$(CL $MARIA "'person', '$IEMP', 'table', '7', null")" '^ok · [0-9]+ · 5\|too_fast · — · —$'
back "$MEMP" "10 minutes"

# ── Этап 68 дважды ──────────────────────────────────────────────────────────────
RC=0; run $S68
chk "этап 68: итог" "$(echo "$OUT" | grep -o 'Позвать подряд: .*' | head -1 | sed 's/[[:space:]]*$//')" \
  '^Позвать подряд: тот же вызов — раз в 30 секунд, всего — 15 за 5 минут · вызовов за сутки: 1$'
run $S68
chk "этап 68 ещё раз — без ошибок" "$RC" '^0$'
chk "chat_call: security definer, search_path, вызывает ключ приложения" "$(PP "select prosecdef || ' ' || array_to_string(proconfig, ',') || ' ' || has_function_privilege('anon', oid, 'execute') || ' ' || has_function_privilege('public', oid, 'execute') from pg_proc where proname = 'chat_call'")" '^true search_path=public true false$'

# ── Подряд к нескольким столам ───────────────────────────────────────────────────
PP "delete from net.sent_log" >/dev/null
A1=$(CL $MARIA "'person', '$AEMP', 'table', '13', null")
chk "Мария зовёт Анну к столу 13" "$A1" '^ok · [0-9]+ · 13$'
ID1=$(echo "$A1" | awk -F' · ' '{print $2}')
chk "сразу следом — Илью к столу 7, официанта к столу 5, менеджера на помощь: всё уходит" "$(CL $MARIA "'person', '$IEMP', 'table', '7', null")|$(CL $MARIA "'waiter', null, 'table', '5', null")|$(CL $MARIA "'lead', null, 'help', null, null")" \
  '^ok · [0-9]+ · 7\|ok · [0-9]+ · 5\|ok · [0-9]+ · —$'
chk "в ленте — четыре вызова, тексты как раньше" "$(PP "select string_agg(body, ' | ' order by id) from sa_chat_msgs where kind = 'call' and emp_id = '$MEMP' and created_at > now() - interval '1 minute'")" \
  '^Мария зовёт Анну: к столу 13 \| Мария зовёт Илью: к столу 7 \| Мария зовёт официанта: к столу 5 \| Мария зовёт менеджера: нужна помощь$'
chk "бот: Анне «Мария зовёт тебя: к столу 13» с «Иду», Илье — к столу 7" "$(sent 111 'Мария зовёт тебя: к столу 13') $(sent 222 'Мария зовёт тебя: к столу 7') $(PP "select count(*) from net.sent_log where body->>'chat_id' = '111' and body::text like '%cg:$ID1%'")" '^1 1 1$'

# ── Тот же вызов — already ───────────────────────────────────────────────────────
chk "тот же (Анну к столу 13) ещё раз — already с прошлым вызовом" "$(CL $MARIA "'person', '$AEMP', 'table', '13', null")" "^already · $ID1 · 13\$"
chk "already — в ленте нового нет, бот второй раз не пишет" "$(PP "select count(*) from sa_chat_msgs where kind = 'call' and emp_id = '$MEMP' and created_at > now() - interval '1 minute'") $(sent 111 'Мария зовёт тебя: к столу 13')" '^4 1$'
R=$(Q "select chat_call('$MARIA', 'person', '$AEMP', 'table', ' 13 ', null)")
chk "стол с пробелами — тот же стол" "$R" '"error": "already"'
chk "already: в прошлом вызове — кого звали и кто идёт" "$R" '"to_name": "Анна Смирнова"'
chk "другой стол той же Анне и та же Анна с другой причиной — уходят" "$(CL $MARIA "'person', '$AEMP', 'table', '14', null")|$(CL $MARIA "'person', '$AEMP', 'come', null, null")" '^ok · [0-9]+ · 14\|ok · [0-9]+ · —$'
chk "своими словами: тот же текст — already, другой — уходит" "$(CL $MARIA "'host', null, 'own', null, 'Принеси стульчик'")|$(CL $MARIA "'host', null, 'own', null, 'Принеси стульчик'")|$(CL $MARIA "'host', null, 'own', null, 'Принеси плед'")" \
  '^ok · [0-9]+ · —\|already · [0-9]+ · —\|ok · [0-9]+ · —$'
chk "повтор после «Иду» — already, в прошлом вызове видно, кто идёт" "$(Q "select chat_go('$ANNA', $ID1)->>'ok'")|$(Q "select chat_call('$MARIA', 'person', '$AEMP', 'table', '13', null)->'msg'->'call'->'going'->0->>'name'")" '^true\|Анна Смирнова$'
chk "тот же вызов от другого человека — его собственный, уходит" "$(CL $ILYA "'person', '$AEMP', 'table', '13', null")" '^ok · [0-9]+ · 13$'
PP "update sa_chat_msgs set deleted = true where id = $ID1" >/dev/null
chk "удалённый вызов не держит: тот же снова уходит" "$(CL $MARIA "'person', '$AEMP', 'table', '13', null")" '^ok · [0-9]+ · 13$'
back "$MEMP" "31 seconds"
chk "через 30 секунд тот же вызов снова уходит" "$(CL $MARIA "'person', '$AEMP', 'table', '13', null")" '^ok · [0-9]+ · 13$'
chk "проверки как раньше: кого-зачем не так — bad_request" "$(Q "select chat_call('$MARIA', 'chef', null, 'help', null, null)->>'error'") $(Q "select chat_call('$MARIA', 'waiter', null, 'table', 'стол 5!', null)->>'error'") $(Q "select chat_call('$MARIA', 'person', '$MEMP', 'come', null, null)->>'error'") $(Q "select chat_call('$OLEG', 'waiter', null, 'help', null, null)->>'error'")" \
  '^bad_request bad_request bad_request auth$'

# ── Лавина: 15 за 5 минут ─────────────────────────────────────────────────────────
back "$AEMP" "10 minutes"
chk "Анна: 15 вызовов к разным столам подряд — все уходят" "$(Q "select count(*) from generate_series(1, 15) g, lateral (select chat_call('$ANNA', 'lead', null, 'table', g::text, null) r) x where (x.r->>'ok')::boolean")" '^15$'
R=$(Q "select chat_call('$ANNA', 'lead', null, 'table', '16', null)")
chk "16-й за 5 минут — too_many и wait (секунд до первого из пятнадцати)" "$(Q "with x as (select chat_call('$ANNA', 'lead', null, 'table', '16', null) j) select (j->>'error') || ' ' || ((j->>'wait')::int between 290 and 300) from x")" '^too_many true$'
back "$AEMP" "4 minutes 30 seconds"
chk "через 4,5 минуты — ждать около 30 секунд" "$(Q "with x as (select chat_call('$ANNA', 'lead', null, 'table', '16', null) j) select (j->>'error') || ' ' || ((j->>'wait')::int between 20 and 30) from x")" '^too_many true$'
back "$AEMP" "31 seconds"
chk "первые вызовы старше 5 минут — снова можно" "$(CL $ANNA "'lead', null, 'table', '16', null")" '^ok · [0-9]+ · 16$'

echo; echo "Итого: ✓ $pass  ✗ $fail"
$P0 -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
[ "$fail" -eq 0 ]
