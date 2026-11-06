#!/bin/bash
# Этап 50 (v141, Доп. 458): итог гоу-листа смены — brief_go_save / brief_go_get поверх брифинга дня (этап 32).
# Поверх базы run25.sh: копия satest50, этапы 26, 31, 32 и 50 (50 — дважды), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test50.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest50
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
D=$(mktemp -d); cp "$SRC"/supabase-stage26-mastery.sql "$SRC"/supabase-stage31-qday.sql "$SRC"/supabase-stage32-briefing.sql "$SRC"/supabase-stage50-golist.sql "$D"/; chmod -R a+r "$D"
RC=0; OUT50=""
for f in supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage50-golist.sql supabase-stage50-golist.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
  [ "$f" = supabase-stage50-golist.sql ] && OUT50="$out"
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:600}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
IRINA=10000000-0000-0000-0000-0000000000b1
GO='[{"id":"d1","name":"Тартар","kind":"dish","why":"Нежный, с дымком","pair":"Пино нуар","say":"Сегодня советую тартар"},{"id":"negroni","name":"Негрони","kind":"cocktail"}]'
DATA="{\"v\":1,\"day\":\"x\",\"blocks\":{\"stop\":[\"Борщ\"],\"go\":$GO,\"note\":\"VIP\"},\"on\":{\"stop\":true,\"go\":true,\"note\":true}}"
OFF="{\"v\":1,\"blocks\":{\"go\":$GO},\"on\":{\"go\":false}}"
TODAY=$(PP "select to_char((now() at time zone _sa_tz('Два моря, Океан'))::date, 'YYYY-MM-DD')")
YDAY=$(PP "select to_char((now() at time zone _sa_tz('Два моря, Океан'))::date - 1, 'YYYY-MM-DD')")
D2=$(PP "select to_char((now() at time zone _sa_tz('Два моря, Океан'))::date - 2, 'YYYY-MM-DD')")
D40=$(PP "select to_char((now() at time zone _sa_tz('Два моря, Океан'))::date - 40, 'YYYY-MM-DD')")
TMRW=$(PP "select to_char((now() at time zone _sa_tz('Два моря, Океан'))::date + 1, 'YYYY-MM-DD')")
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_briefs" >/dev/null 2>&1

chk "этапы 26, 31, 32 и 50 (50 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 2 функции, брифингов с гоу-листом 0, с итогом 0" "$(echo "$OUT50" | grep -o 'гоу-лист: .*' | head -1)" '^гоу-лист: 2 функции из 2 · брифингов с гоу-листом: 0 · с итогом: 0'
chk "колонки итога в sa_briefs" "$(PP "select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_name = 'sa_briefs' and column_name like 'go\_%'")" '^go_at,go_by,go_sold$'
chk "функции с проверкой входа — VOLATILE (PostgREST зовёт STABLE «только для чтения»)" \
  "$(PP "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname in ('brief_go_save', 'brief_go_get')")" '^brief_go_get:v,brief_go_save:v$'
chk "служебные _sa_go_ids и _sa_go_day — не для anon" "$(Q "select _sa_go_ids('{}'::jsonb)" | grep -c 'permission denied')" '^1$'
chk "без входа — auth" "$(Q "select brief_go_get('нет')->>'error'") $(Q "select brief_go_save('нет', null, '{}'::jsonb)->>'error'")" '^auth auth$'

# ── до брифинга
chk "брифинга нет — go: null" "$(Q "select brief_go_get('$ANNA')")" '"go": null'
chk "итог без брифинга — no_brief" "$(Q "select brief_go_save('$MARIA', null, '{\"d1\": 1}'::jsonb)->>'error'")" '^no_brief$'
chk "официант не записывает итог — forbidden" "$(Q "select brief_go_save('$ANNA', null, '{\"d1\": 1}'::jsonb)->>'error'")" '^forbidden$'

# ── брифинг с гоу-листом
chk "старшая публикует брифинг с гоу-листом" "$(Q "select brief_publish('$MARIA', '$DATA'::jsonb, 'Брифинг смены')->>'ok'")" '^true$'
G1=$(Q "select brief_go_get('$ANNA')")
chk "brief_go_get у Анны: две позиции, итога ещё нет" "$G1" '"saved": false'
chk "brief_go_get: позиции в порядке гоу-листа, день — сегодня" "$(Q "select (brief_go_get('$ANNA')->'go'->0->>'id') || ' ' || (brief_go_get('$ANNA')->'go'->1->>'id') || ' ' || (brief_go_get('$ANNA')->>'day')")" "^d1 negroni $TODAY\$"
chk "брифинг правки не меняет: sold пустой, автор — Мария" "$(Q "select (brief_go_get('$ANNA')->>'sold') || ' ' || (brief_go_get('$ANNA')->>'author')")" '^\{\} Мария Ким$'

# ── записать итог
S1=$(Q "select brief_go_save('$MARIA', '$TODAY', '{\"d1\": 12, \"negroni\": 7, \"x\": 3}'::jsonb)")
chk "итог записан: только позиции гоу-листа, кто записал" "$S1" '"sold": \{"d1": 12, "negroni": 7\}'
chk "итог: by — Мария Ким, день — сегодня" "$(Q "select (brief_go_save('$MARIA', null, '{\"d1\": 12, \"negroni\": 7}'::jsonb)->>'by') || ' ' || (brief_go_get('$ANNA')->>'day')")" "^Мария Ким $TODAY\$"
chk "brief_go_get: saved, sold — как записали" "$(Q "select (brief_go_get('$ANNA')->>'saved') || ' ' || (brief_go_get('$ANNA')->'sold'->>'d1') || ' ' || (brief_go_get('$ANNA')->'sold'->>'negroni')")" '^true 12 7$'
chk "ноль — тоже итог" "$(Q "select brief_go_save('$PETR', null, '{\"d1\": 0}'::jsonb)->'sold'->>'d1'")" '^0$'
chk "отрицательное, дробное, строка, огромное — bad_request" \
  "$(Q "select brief_go_save('$MARIA', null, '{\"d1\": -1}'::jsonb)->>'error'") $(Q "select brief_go_save('$MARIA', null, '{\"d1\": 1.5}'::jsonb)->>'error'") $(Q "select brief_go_save('$MARIA', null, '{\"d1\": \"12\"}'::jsonb)->>'error'") $(Q "select brief_go_save('$MARIA', null, '{\"d1\": 100000}'::jsonb)->>'error'")" \
  '^bad_request bad_request bad_request bad_request$'
chk "не объект и слишком большой — bad_request" "$(Q "select brief_go_save('$MARIA', null, '[1]'::jsonb)->>'error'") $(Q "select brief_go_save('$MARIA', null, jsonb_build_object('x', repeat('a', 2100)))->>'error'")" '^bad_request bad_request$'
chk "неудачная запись не стирает итог" "$(Q "select brief_go_get('$ANNA')->'sold'->>'d1'")" '^0$'

# ── дни
$P -c "insert into sa_briefs (restaurant, day, data, text, author_name) values ('Два моря, Океан', '$YDAY', '$DATA'::jsonb, 'вчера', 'Пётр Иванов'), ('Два моря, Океан', '$D2', '$DATA'::jsonb, 'позавчера', 'Пётр Иванов'), ('Два моря, Океан', '$D40', '$DATA'::jsonb, 'давно', 'Пётр Иванов')" >/dev/null
chk "вчера — можно записать (закрытие после полуночи)" "$(Q "select brief_go_save('$MARIA', '$YDAY', '{\"negroni\": 5}'::jsonb)->>'ok'")" '^true$'
chk "вчерашний итог виден по дню" "$(Q "select (brief_go_get('$ANNA', '$YDAY')->>'day') || ' ' || (brief_go_get('$ANNA', '$YDAY')->'sold'->>'negroni')")" "^$YDAY 5\$"
chk "позавчера и завтра записать нельзя — bad_day" "$(Q "select brief_go_save('$MARIA', '$D2', '{\"d1\": 1}'::jsonb)->>'error'") $(Q "select brief_go_save('$MARIA', '$TMRW', '{\"d1\": 1}'::jsonb)->>'error'")" '^bad_day bad_day$'
chk "посмотреть позавчера — можно; 40 дней назад, завтра и не дата — bad_day" \
  "$(Q "select brief_go_get('$ANNA', '$D2')->>'ok'") $(Q "select brief_go_get('$ANNA', '$D40')->>'error'") $(Q "select brief_go_get('$ANNA', '$TMRW')->>'error'") $(Q "select brief_go_get('$ANNA', 'вчера')->>'error'") $(Q "select brief_go_get('$ANNA', '2026-02-30')->>'error'")" \
  '^true bad_day bad_day bad_day bad_day$'

# ── гоу-лист выключен, другое заведение
chk "брифинг правкой без гоу-листа (блок выключен) — go: null, итог — no_go" \
  "$(Q "select brief_publish('$MARIA', '$OFF'::jsonb, 'Брифинг (правка)')->>'ok'") $(Q "select brief_go_get('$ANNA')->>'go'") $(Q "select brief_go_save('$MARIA', null, '{\"d1\": 2}'::jsonb)->>'error'")" '^true  no_go$'
chk "Ирина (Порт) не видит гоу-лист «Два моря» и не пишет его итог" "$(Q "select brief_go_get('$IRINA', '$YDAY')->>'go'") $(Q "select brief_go_save('$IRINA', '$YDAY', '{\"negroni\": 1}'::jsonb)->>'error'")" '^ no_brief$'

# ── повтор этапа итог не стирает
out=$($P0 -d $DB -f "$D/supabase-stage50-golist.sql" 2>&1); chk "третий запуск этапа — без ошибок, итог вчерашнего дня на месте" "$?:$(Q "select brief_go_get('$ANNA', '$YDAY')->'sold'->>'negroni'")" '^0:5$'
chk "итог этапа после записей: с гоу-листом 3 (вчера, позавчера, 40 дней), с итогом 2" "$(echo "$out" | grep -o 'гоу-лист: .*' | head -1)" '^гоу-лист: 2 функции из 2 · брифингов с гоу-листом: 3 · с итогом: 2'

echo "─────────"
echo "Итого: $pass ✓, $fail ✗"
[ $fail -eq 0 ]
