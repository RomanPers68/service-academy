#!/bin/bash
# Этап 32 (v82, Доп. 395): брифинг смены — brief_publish / brief_today и настройки сообщений по колонкам.
# Поверх базы run25.sh: копия satest32, этапы 26, 31 и 32 (32 — дважды), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test32.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest32
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
D=$(mktemp -d); cp "$SRC"/supabase-stage26-mastery.sql "$SRC"/supabase-stage31-qday.sql "$SRC"/supabase-stage32-briefing.sql "$D"/; chmod -R a+r "$D"
RC=0; OUT32=""
for f in supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage32-briefing.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
  [ "$f" = supabase-stage32-briefing.sql ] && OUT32="$out"
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:600}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2; ILYA=10000000-0000-0000-0000-0000000000a5; IRINA=10000000-0000-0000-0000-0000000000b1
IEMP=00000000-0000-0000-0000-0000000000a5
DATA='{"v":1,"day":"x","blocks":{"stop":["Тартар"],"note":"VIP в 20:00"},"on":{"stop":true,"note":true}}'
TXT='Брифинг смены · 23 октября\nот Мария Ким\n\nСтоп-лист: Тартар\n\nVIP в 20:00'

chk "этапы 26, 31 и 32 (32 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 5 функций, таблица, все виды сообщений по колонкам" "$OUT32" 'брифинг: 5 функций из 5 · таблица: есть · виды сообщений: pair, quest, league, fresh, month, master, qday, brief'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null

# ── настройки сообщений по колонкам
chk "notify_prefs: все виды и час «Вопроса дня»" "$(Q "select notify_prefs('$ANNA')")" '"brief": true.*"qday": true|"qday": true.*"brief": true'
chk "notify_prefs: час «Вопроса дня» — 12" "$(Q "select notify_prefs('$ANNA')->>'qday_hour'")" '^12$'
chk "notify_prefs: прежние ключи на месте (ok, bot, linked, remind, pair…master)" "$(Q "select string_agg(k, ',' order by k) from jsonb_object_keys(notify_prefs('$ANNA')) k")" '^bot,brief,fresh,league,linked,master,month,ok,pair,qday,qday_hour,quest,remind$'
chk "notify_set: brief выкл" "$(Q "select notify_set('$ILYA', 'brief', false)->>'brief'")" '^false$'
chk "notify_set: неизвестный вид (и не булева колонка) — kind" "$(Q "select notify_set('$ANNA', 'emp_id', true)->>'error'") $(Q "select notify_set('$ANNA', 'spam', true)->>'error'")" '^kind kind$'
chk "notify_set: прежние виды работают (qday)" "$(Q "select notify_set('$ANNA', 'qday', false)->>'qday'")" '^false$'
$P -c "set role anon; select notify_set('$ANNA', 'qday', true)" >/dev/null

# ── публикация
chk "официант не публикует — forbidden" "$(Q "select brief_publish('$ANNA', '$DATA'::jsonb, E'$TXT')->>'error'")" '^forbidden$'
chk "пустой текст — bad_request" "$(Q "select brief_publish('$MARIA', '$DATA'::jsonb, '  ')->>'error'")" '^bad_request$'
chk "огромный брифинг — bad_request" "$(Q "select brief_publish('$MARIA', jsonb_build_object('x', repeat('a', 31000)), 'текст')->>'error'")" '^bad_request$'
R1=$(Q "select brief_publish('$MARIA', '$DATA'::jsonb, E'$TXT')")
chk "старшая публикует: ok, сегодня по часам заведения, ушло двоим (Анна, Пётр; Илья выключил, автору — нет)" "$R1" '"ok": true.*"sent": 2|"sent": 2.*"ok": true'
chk "в Telegram: текст брифинга и кнопка «Брифинг смены» → приложение на брифинге" "$(PP "select string_agg(body->>'chat_id', ',' order by body->>'chat_id') || ' ' || bool_and(body->>'text' like 'Брифинг смены · 23 октября%') || ' ' || bool_and(body::text like '%\"text\": \"Брифинг смены\"%' and body::text like '%https://app.example/?go=brief%') from net.sent_log")" '^111,444 true true$'
chk "Илья (выключил «Брифинг смены») и сама Мария — без сообщения" "$(PP "select count(*) from net.sent_log where body->>'chat_id' in ('222', '333')")" '^0$'
R2=$(Q "select brief_publish('$MARIA', '{\"v\":1,\"blocks\":{\"note\":\"Банкет 12 человек\"},\"on\":{\"note\":true}}'::jsonb, 'Брифинг (правка)')")
chk "повторная отправка в тот же день — правка, в Telegram второй раз не шлём" "$R2" '"again": true.*"sent": 0|"sent": 0.*"again": true'
chk "в базе — одна запись дня с правкой, отправлено всего 2" "$(PP "select count(*) || ' ' || max(data->'blocks'->>'note') || ' ' || max(sent) from sa_briefs")" '^1 Банкет 12 человек 2$'
# Илья включил «Брифинг смены» обратно: следующая правка доходит только до него
$P -c "set role anon; select notify_set('$ILYA', 'brief', true)" >/dev/null
R3=$(Q "select brief_publish('$MARIA', '$DATA'::jsonb, 'Брифинг (ещё правка)')")
chk "правка после того, как Илья включил брифинг: уходит только ему" "$R3|$(PP "select string_agg(body->>'chat_id', ',' order by id) from net.sent_log where body->>'text' = 'Брифинг (ещё правка)'")" '"sent": 1.*\|222$'
chk "всего за день отправлено троим" "$(PP "select max(sent) from sa_briefs")" '^3$'

# ── чтение
chk "brief_today у Анны: брифинг Марии, правка, не её" "$(Q "select brief_today('$ANNA')")" '"author": "Мария Ким".*"mine": false|"mine": false.*"author": "Мария Ким"'
chk "brief_today у Марии — её брифинг (mine)" "$(Q "select brief_today('$MARIA')->'brief'->>'mine'")" '^true$'
chk "brief_today у Ирины (Порт) — брифинга нет" "$(Q "select brief_today('$IRINA')->'brief'")" '^null$'
chk "brief_today: чужой токен — auth" "$(Q "select brief_today('мусор')->>'error'")" '^auth$'

# ── без бота
$P -c "delete from sa_briefs; delete from tg_sent; delete from net.sent_log; delete from vault.secrets_stub" >/dev/null
chk "без токена бота: брифинг сохранён, сообщений нет, bot: false" "$(Q "select brief_publish('$MARIA', '$DATA'::jsonb, 'текст')")|$(PP "select count(*) from net.sent_log")|$(PP "select count(*) from sa_briefs")" '"bot": false.*"sent": 0.*\|0\|1$|"sent": 0.*"bot": false.*\|0\|1$'

# ── права
chk "anon: brief_publish, brief_today, notify_prefs, notify_set — можно" "$(PP "select has_function_privilege('anon', 'public.brief_publish(text, jsonb, text)', 'execute') and has_function_privilege('anon', 'public.brief_today(text)', 'execute') and has_function_privilege('anon', 'public.notify_set(text, text, boolean)', 'execute')")" '^t$'
chk "anon: служебный список видов — нельзя; таблицу брифингов напрямую — нельзя" "$(PP "select has_function_privilege('anon', 'public._sa_notify_kinds()', 'execute')")|$(Q "select count(*) from sa_briefs")" '^f\|.*(permission denied|нет доступа)'

echo "Итого: $pass ✓, $fail ✗"
