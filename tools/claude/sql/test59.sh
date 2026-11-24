#!/bin/bash
# Этап 59 (v193, Доп. 518): меню в ежедневном повторе — «Знаю?» на сервере, «Как команда знает меню», просьбы руководителя
# («В разминку команде», «В фокус смены»), блюда в напоминании за час до смены.
# Поверх базы run25.sh: копия satest59; этап 59 дважды (итог, VOLATILE, права); menu_know_set (только про себя, мусор
# отброшен, null — не менять); menu_focus_set (только руководитель, неделя и два дня, до 5, снять); menu_focus_get (все
# в заведении, sent — только сегодня); menu_know_team (по блюдам и людям, чужое заведение — только сеть); выбор блюд для
# напоминания (порядок: спросили → просьба → гоу-лист → своя очередь; «Знаю» после просьбы и сегодня по гоу-листу;
# стоп и архив; ритм: каждую смену, через смену, раз в неделю, не нужно; копия старше трёх недель); сообщение бота с
# блюдами и что назвали (одно на день); повторный запуск этапа 22б — строка уходит, этап 59 — возвращается; вариант с
# этапом 26 («Шаг дня» на месте); чужой текст напоминания — не трогает.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test59.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest59
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S59=supabase-stage59-menu-repeat.sql; S22=supabase-stage22b-telegram-reminders.sql; S26=supabase-stage26-mastery.sql
D=$(mktemp -d); cp "$SRC/$S59" "$SRC/$S22" "$SRC/$S26" "$D/"; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; IRINA=10000000-0000-0000-0000-0000000000b1
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5
OK="Два моря, Океан"
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }

# Анна сегодня в графике (вечер), чат бота есть; база могла быть собрана в другой день — ставим смену на сегодня
PP "do \$\$ declare ld date := (now() at time zone 'Asia/Kamchatka')::date; mk text := to_char(ld, 'YYYY-MM'); begin
  insert into schedule_months (restaurant, venue_key, month, payload) values ('$OK', 'main', mk, '{\"plan\":{\"s1\":{}}}'::jsonb) on conflict do nothing;
  update schedule_months set payload = jsonb_set(jsonb_set(payload, '{plan,s1}', coalesce(payload->'plan'->'s1', '{}'::jsonb), true), array['plan','s1', extract(day from ld)::int::text], '\"В\"'::jsonb, true)
   where restaurant = '$OK' and month = mk; end \$\$" >/dev/null
# смена «Вечер» начинается через $1 минут (окно отправки — от «за час» до «за час без пятнадцати», просмотр — «за час десять»)
SHIFT_IN() { PP "update schedule_venues set config = jsonb_set(config, '{shifts}', jsonb_build_array(jsonb_build_object('k','В','name','Вечер','from',
  round((extract(epoch from (now() at time zone 'Asia/Kamchatka')::time)/3600.0 + $1/60.0)::numeric, 4),'to',24)))" >/dev/null; }
PREVIEW() { PP "select coalesce(string_agg(x->>'text', ' | '), 'пусто') from jsonb_array_elements(sa_warmup_preview()) x where x->>'name' = 'Анна Смирнова'"; }
run $S59; run $S59
chk "этап 59 дважды — без ошибок" "$RC" '^0$'
chk "итог этапа: 4 функции, таблицы, напоминание с блюдами" "$(echo "$OUT" | grep -o 'меню в повторе: .*' | head -1)" \
  '^меню в повторе: 4 функции из 4 · таблицы: есть · напоминание с блюдами: да · прислали «Знаю\?»: 0 · просьб руководителя: 0$'
chk "функции с проверкой входа — VOLATILE" \
  "$(PP "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname in ('menu_know_set', 'menu_focus_get', 'menu_focus_set', 'menu_know_team')")" \
  '^menu_focus_get:v,menu_focus_set:v,menu_know_set:v,menu_know_team:v$'
chk "без входа — auth" "$(Q "select menu_know_set('нет')->>'error'") $(Q "select menu_focus_get('нет')->>'error'") $(Q "select menu_focus_set('нет','warm','x')->>'error'") $(Q "select menu_know_team('нет')->>'error'")" '^auth auth auth auth$'
chk "таблицы напрямую не прочитать (anon)" "$(Q "select count(*) from sa_menu_know") | $(Q "select count(*) from sa_menu_focus")" 'permission denied.*\|.*permission denied'
chk "служебные функции снаружи не вызвать" "$(Q "select _sa_menu_warm_pick('x','y',current_date)") | $(Q "select _sa_mk_today('x')")" 'permission denied.*\|.*permission denied'

TN=$(PP "select _sa_mk_dnum(_sa_mk_today('$OK'))"); TD=$(PP "select to_char(_sa_mk_today('$OK'), 'YYYY-MM-DD')")
chk "день заведения — номер с 1970 года" "$TN $TD" '^[0-9]{5} [0-9]{4}-[0-9]{2}-[0-9]{2}$'
# ── «Знаю?» с телефона
DATA="{\"ok2601\":[1,$((TN+1)),$TN],\"ok2602\":[0,$TN,$TN],\"ok2605\":[2,$((TN-3)),$((TN-10))],\"bad\":\"x\",\"\":[1,1,1],\"short\":[1,2],\"big\":[9,999999,-5]}"
WARM='{"r":"each","n":2,"next":[{"id":"ok2604","name":"Закуска  из морепродуктов","why":"asked"},{"id":"ok2603","name":"Кальмар в азиатском стиле","why":"fresh"},{"id":"ok2609","name":"Крабовая котлета","why":"new"},{"id":"","name":"пусто"},{"id":"x1","name":"Икс","why":"что-то"}]}'
R=$(Q "select menu_know_set('$ANNA', '$DATA'::jsonb, '$WARM'::jsonb)")
chk "menu_know_set: ok, просьб нет, бот сегодня ничего не называл" "$R" '"ok": true.*"sent": null.*"focus": \[\]'
chk "в базе — только понятное: три блюда и «big» в пределах (ступень 4, день 100000, отметка 0)" \
  "$(PP "select (select string_agg(key, ',' order by key) from jsonb_each(data)) || ' ' || (data->'big')::text from sa_menu_know where emp_id = '$AEMP'")" \
  '^big,ok2601,ok2602,ok2605 \[4, 100000, 0\]$'
chk "ритм и очередь: пробелы схлопнуты, пустое отброшено, непонятное «why» — due" \
  "$(PP "select warm->>'r', warm->>'n', jsonb_array_length(warm->'next'), warm->'next'->0->>'name', warm->'next'->3->>'why' from sa_menu_know where emp_id = '$AEMP'")" \
  '^each\|2\|4\|Закуска из морепродуктов\|due$'
Q "select menu_know_set('$ANNA', null, '{\"r\":\"week\",\"n\":3,\"next\":[]}'::jsonb)" >/dev/null
chk "null вместо «Знаю?» — не меняет его, ритм — новый" "$(PP "select (select count(*) from jsonb_each(data)) || ' ' || (warm->>'r') || ' ' || (warm->>'n') from sa_menu_know where emp_id = '$AEMP'")" '^4 week 3$'
Q "select menu_know_set('$ANNA', '$DATA'::jsonb, '$WARM'::jsonb)" >/dev/null
chk "только про себя: строка одна, своего заведения" "$(PP "select count(*) || ' ' || string_agg(restaurant, ',') from sa_menu_know")" "^1 $OK$"

# ── просьбы руководителя
chk "сотрудник не просит: forbidden; в разминку — только warm и brief" \
  "$(Q "select menu_focus_set('$ANNA','warm','ok2602','Креветка темпура')->>'error'") $(Q "select menu_focus_set('$PETR','other','ok2602','Креветка')->>'error'") $(Q "select menu_focus_set('$PETR','warm','  ','Креветка')->>'error'")" '^forbidden kind bad_request$'
R=$(Q "select menu_focus_set('$PETR','warm','ok2602','  Креветка   темпура ', true, 'не уверены 1 из 1')")
chk "«В разминку команде»: неделя, кто просил, заметка, день просьбы" "$R" "\"by\": \"Пётр Иванов\", \"id\": \"ok2602\", \"day\": $TN, \"kind\": \"warm\", \"name\": \"Креветка темпура\", \"note\": \"не уверены 1 из 1\", \"until\": \"$(PP "select to_char(_sa_mk_today('$OK') + 7, 'YYYY-MM-DD')")\""
R=$(Q "select menu_focus_set('$PETR','brief','ok2605','Салат с крабом и страчателлой')")
chk "«В фокус смены»: сегодня и завтра" "$R" "\"kind\": \"brief\", \"name\": \"Салат с крабом и страчателлой\", \"note\": \"\", \"until\": \"$(PP "select to_char(_sa_mk_today('$OK') + 1, 'YYYY-MM-DD')")\""
for i in 1 2 3 4; do Q "select menu_focus_set('$MARIA','brief','b$i','Блюдо $i')" >/dev/null; done
chk "больше пяти в одном виде — too_many; ту же можно обновить" "$(Q "select menu_focus_set('$PETR','brief','b5','Блюдо 5')->>'error'") $(Q "select menu_focus_set('$PETR','brief','b4','Блюдо 4')->>'ok'")" '^too_many true$'
R=$(Q "select menu_focus_set('$MARIA','brief','b1','Блюдо 1', false)")
chk "снять просьбу: блюда больше нет в списке" "$(echo "$R" | grep -o '"b1"' | wc -l) $(echo "$R" | grep -o '"kind": "brief"' | wc -l)" '^0 4$'
for i in 2 3 4; do Q "select menu_focus_set('$MARIA','brief','b$i','', false)" >/dev/null; done
PP "insert into sa_menu_focus (restaurant, kind, dish_id, name, from_day, until_day) values ('$OK', 'warm', 'old', 'Старое', current_date - 20, current_date - 10)" >/dev/null
chk "menu_focus_get: просьбы видит любой в заведении, прошедшие — нет" "$(Q "select menu_focus_get('$ILYA')->'focus'") | $(Q "select menu_focus_get('$ILYA')->>'today'")" "\"ok2602\".*\"ok2605\".* \| $TD$"
chk "прошедшая просьба — не видна" "$(Q "select menu_focus_get('$ANNA')::text like '%Старое%'")" '^f$'
chk "в другом заведении просьб нет" "$(Q "select jsonb_array_length(menu_focus_get('$IRINA')->'focus')")" '^0$'

# ── «Как команда знает меню»
chk "сотруднику — forbidden, чужое заведение менеджеру — forbidden, сети — можно" \
  "$(Q "select menu_know_team('$ANNA')->>'error'") $(Q "select menu_know_team('$IRINA', '$OK')->>'error'") $(Q "select menu_know_team('$MARIA', 'Порт')->>'ok'")" '^forbidden forbidden true$'
T=$(Q "select menu_know_team('$PETR')")
chk "по блюдам: знают, не уверены, отмечали" "$(echo "$T" | grep -o '{"id": "ok260[125]", "seen": [0-9], "weak": [0-9], "known": [0-9]}' | tr '\n' ' ')" \
  '^\{"id": "ok2601", "seen": 1, "weak": 0, "known": 1\} \{"id": "ok2602", "seen": 1, "weak": 1, "known": 0\} \{"id": "ok2605", "seen": 1, "weak": 0, "known": 0\} $'
chk "по людям: Анна — знает 2 (ok2601 и «big»), не уверена 1, отмечала 3; прислали 1 из 4; владельца в списке нет" \
  "$(echo "$T" | grep -o '"name": "Анна Смирнова", "weak": [0-9], "known": [0-9], "marked": [0-9]') | $(echo "$T" | grep -o '"n": [0-9]*, "ok": true') | $(echo "$T" | grep -o '"staff": [0-9]*') | $(echo "$T" | grep -c 'Роман')" \
  '^"name": "Анна Смирнова", "weak": 1, "known": 2, "marked": 3 \| "n": 1, "ok": true \| "staff": 4 \| 0$'
chk "сеть смотрит чужое заведение — просьбы своего не подмешаны" "$(Q "select jsonb_array_length(menu_know_team('$MARIA', 'Порт')->'focus')")" '^0$'

# ── какие блюда назовёт напоминание (выбор — по дню, без отправки)
PICK() { PP "select coalesce(_sa_menu_warm_pick('$AEMP', '$OK', ${1:-_sa_mk_today('$OK')})->>'names', 'нет')"; }
chk "каждую смену: спросили → просьба руководителя (по два)" "$(PICK)" '^\["Закуска из морепродуктов", "Креветка темпура"\]$'
Q "select menu_know_set('$ANNA', '{\"ok2602\":[1,$((TN+1)),$TN]}'::jsonb, null)" >/dev/null
chk "отметила «Знаю» в день просьбы — дальше своя очередь" "$(PICK)" '^\["Закуска из морепродуктов", "Кальмар в азиатском стиле"\]$'
Q "select menu_know_set('$ANNA', '{\"ok2602\":[1,$((TN+1)),$((TN-1))]}'::jsonb, null)" >/dev/null
chk "«Знаю» раньше просьбы — просьба в силе" "$(PICK)" '^\["Закуска из морепродуктов", "Креветка темпура"\]$'
# гоу-лист смены (этап 32 — таблица брифинга): после просьбы, до своей очереди; «Знаю» сегодня — пропуск; не блюдо — пропуск
PP "create table if not exists sa_briefs (restaurant text, day date, data jsonb, primary key (restaurant, day))" >/dev/null
PP "insert into sa_briefs values ('$OK', _sa_mk_today('$OK'), '{\"on\":{\"go\":true},\"blocks\":{\"go\":[{\"id\":\"c1\",\"name\":\"Негрони\",\"kind\":\"cocktail\"},{\"id\":\"ok2607\",\"name\":\"Тыквенный крем-суп с крабом\",\"kind\":\"dish\"}]}}')
    on conflict (restaurant, day) do update set data = excluded.data" >/dev/null
Q "select menu_know_set('$ANNA', null, '{\"r\":\"each\",\"n\":3,\"next\":[{\"id\":\"ok2604\",\"name\":\"Закуска из морепродуктов\",\"why\":\"asked\"},{\"id\":\"ok2603\",\"name\":\"Кальмар в азиатском стиле\",\"why\":\"fresh\"}]}'::jsonb)" >/dev/null
chk "три блюда: спросили → просьба → гоу-лист (коктейль не в счёт)" "$(PICK)" '^\["Закуска из морепродуктов", "Креветка темпура", "Тыквенный крем-суп с крабом"\]$'
Q "select menu_know_set('$ANNA', '{\"ok2607\":[1,$((TN+1)),$TN]}'::jsonb, null)" >/dev/null
chk "гоу-лист: «Знаю» сегодня — дальше своя очередь" "$(PICK)" '^\["Закуска из морепродуктов", "Креветка темпура", "Кальмар в азиатском стиле"\]$'
PP "update sa_briefs set data = jsonb_set(data, '{on,go}', 'false') where restaurant = '$OK'" >/dev/null
Q "select menu_know_set('$ANNA', '{\"ok2602\":[1,$((TN+1)),$((TN-1))]}'::jsonb, null)" >/dev/null
chk "гоу-лист выключен в брифинге — его нет" "$(PICK)" '^\["Закуска из морепродуктов", "Креветка темпура", "Кальмар в азиатском стиле"\]$'
# стоп и архив из меню команды (этап 4)
PP "create table if not exists restaurant_menu (restaurant text primary key, dishes jsonb not null default '[]')" >/dev/null
PP "insert into restaurant_menu values ('$OK', '[{\"id\":\"ok2604\",\"name\":\"Закуска\",\"stop\":true},{\"id\":\"ok2602\",\"name\":\"Креветка\",\"archived\":true},{\"id\":\"ok2603\",\"name\":\"Кальмар\",\"stop\":false}]')
    on conflict (restaurant) do update set dishes = excluded.dishes" >/dev/null
chk "стоп и архив не называем, «stop: false» — можно" "$(PICK)" '^\["Кальмар в азиатском стиле"\]$'
PP "update restaurant_menu set dishes = '[]' where restaurant = '$OK'" >/dev/null
# ритм — на заданный день (четверг 26.11.2026; понедельник недели — 23.11)
W() { Q "select menu_know_set('$ANNA', null, '{\"r\":\"$1\",\"n\":2,\"last\":$2,\"prev\":$3,\"had\":$4,\"next\":[{\"id\":\"ok2603\",\"name\":\"Кальмар в азиатском стиле\",\"why\":\"fresh\"}]}'::jsonb)" >/dev/null; }
THU="date '2026-11-26'"
W off null null false;               R1=$(PICK "$THU")
W every2 '"2026-11-25"' '"2026-11-25"' true;  R2=$(PICK "$THU")
W every2 null '"2026-11-25"' false;  R3=$(PICK "$THU")
W every2 '"2026-11-26"' '"2026-11-26"' true;  R4=$(PICK "$THU")
W week '"2026-11-24"' '"2026-11-25"' false;   R5=$(PICK "$THU")
W week '"2026-11-22"' '"2026-11-25"' false;   R6=$(PICK "$THU")
W week '"2026-11-26"' '"2026-11-26"' true;    R7=$(PICK "$THU")
chk "ритм: «не нужно» — нет; через смену: прошлая с блюдами — нет, без блюд — да, сегодня уже с блюдами — да" "$R1 | $R2 | $(echo "$R3" | grep -c Кальмар) | $(echo "$R4" | grep -c Кальмар)" '^нет \| нет \| 1 \| 1$'
chk "ритм: раз в неделю — во вторник этой недели были — нет, в воскресенье прошлой — да, сегодня — да" "$R5 | $(echo "$R6" | grep -c Кальмар) | $(echo "$R7" | grep -c Кальмар)" '^нет \| 1 \| 1$'
W each null null false
PP "update sa_menu_know set updated_at = now() - interval '22 days' where emp_id = '$AEMP'" >/dev/null
chk "копия с телефона старше трёх недель — без блюд" "$(PICK)" '^нет$'
PP "update sa_menu_know set updated_at = now() where emp_id = '$AEMP'" >/dev/null
chk "у кого «Знаю?» не присылали — без блюд" "$(PP "select coalesce(_sa_menu_warm_pick('$IEMP', '$OK', current_date)::text, 'нет')")" '^нет$'

# ── само напоминание
Q "select menu_know_set('$ANNA', null, '$WARM'::jsonb)" >/dev/null
SHIFT_IN 30
chk "просмотр напоминания: строка с блюдами" "$(PREVIEW)" 'Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл, и 2 блюда из меню: Закуска из морепродуктов, Креветка темпура\. Хорошей смены!'
W off null null false
chk "«не нужно» — прежняя строка" "$(PREVIEW)" 'Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл\. Хорошей смены!$'
Q "select menu_know_set('$ANNA', null, '{\"r\":\"each\",\"n\":1,\"next\":[{\"id\":\"ok2603\",\"name\":\"Кальмар в азиатском стиле\",\"why\":\"fresh\"}]}'::jsonb)" >/dev/null
PP "delete from sa_menu_focus" >/dev/null
chk "одно блюдо — «1 блюдо»" "$(PREVIEW)" 'и 1 блюдо из меню: Кальмар в азиатском стиле\. Хорошей смены!'
Q "select menu_know_set('$ANNA', null, '$WARM'::jsonb)" >/dev/null
Q "select menu_focus_set('$PETR','warm','ok2602','Креветка темпура')" >/dev/null
PP "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret; delete from tg_sent; delete from net.sent_log" >/dev/null
SHIFT_IN 50
chk "отправка: одно сообщение Анне с блюдами" "$(PP "select sa_warmup_tick()") | $(PP "select string_agg(body->>'text', ' ') from net.sent_log where (body->>'chat_id')::bigint = 111")" \
  '^[0-9]+ \| .*и 2 блюда из меню: Закуска из морепродуктов, Креветка темпура\. Хорошей смены!$'
chk "что назвал бот — запомнено, телефон его видит (menu_focus_get и ответ menu_know_set)" \
  "$(Q "select menu_focus_get('$ANNA')->'sent'") | $(Q "select menu_know_set('$ANNA', null, null)->'sent'->>'day'")" \
  "^\{\"day\": \"$TD\", \"ids\": \[\"ok2604\", \"ok2602\"\], \"names\": \[\"Закуска из морепродуктов\", \"Креветка темпура\"\]\} \| $TD$"
Q "select menu_focus_set('$PETR','warm','ok2602','', false)" >/dev/null
PP "select _sa_menu_warm_mark('$AEMP', '$OK', _sa_mk_today('$OK'))" >/dev/null
chk "второй раз за день то, что назвали, не меняется" "$(Q "select menu_focus_get('$ANNA')->'sent'->'ids'")" '^\["ok2604", "ok2602"\]$'
chk "второй тик — напоминание не повторяется" "$(PP "select sa_warmup_tick()") $(PP "select count(*) from net.sent_log where (body->>'chat_id')::bigint = 111")" '^0 1$'
PP "update sa_menu_know set sent = jsonb_set(sent, '{day}', '\"2020-01-01\"')" >/dev/null
chk "вчерашнее «назвал» телефону не отдаётся" "$(Q "select menu_focus_get('$ANNA')->'sent'")" '^$|^null$'

# ── этап 22б заново: строка без блюд; этап 59 заново — вернулась (одна вставка)
RC=0; run $S22
chk "этап 22б заново — напоминание без блюд" "$RC $(PP "select prosrc like '%_sa_menu_warm_line%' from pg_proc where proname = '_sa_warmup_due'")" '^0 f$'
run $S59; run $S59
chk "этап 59 заново — блюда вернулись, вставка одна, отметка после отправки одна" "$RC $(PP "select (length(prosrc) - length(replace(prosrc, '_sa_menu_warm_line', ''))) / length('_sa_menu_warm_line') || ' ' || (length(prosrc) - length(replace(prosrc, '_sa_menu_warm_mark', ''))) / length('_sa_menu_warm_mark') from pg_proc where proname = '_sa_warmup_due'")" '^0 1 1$'
chk "права напоминания не открылись" "$(Q "select _sa_warmup_due(false)")" 'permission denied'
# ── с этапом 26: «Шаг дня» на месте, блюда — тоже
RC=0; run $S26; run $S59
chk "этап 26 и 59 — без ошибок; в напоминании и «Шаг дня», и блюда" "$RC $(PP "select (prosrc like '%Шаг дня%') || ' ' || (prosrc like '%_sa_menu_warm_line%') from pg_proc where proname = '_sa_warmup_due'")" '^0 true true$'
SHIFT_IN 30
chk "просмотр с этапом 26: строка с блюдами" "$(PREVIEW)" 'и 2 блюда из меню: Закуска из морепродуктов, Кальмар в азиатском стиле\. Хорошей смены!'
# ── чужой текст напоминания — не трогаем
PP "create or replace function _sa_warmup_due(p_send boolean) returns jsonb language plpgsql as \$\$ begin return '[]'::jsonb; end; \$\$" >/dev/null
OUT=$($P0 -d $DB -f "$D/$S59" 2>&1)
chk "свой текст напоминания: этап 59 сообщает и не меняет" "$(echo "$OUT" | grep -o 'не тот, что ожидался' | head -1) $(echo "$OUT" | grep -o 'напоминание с блюдами: [А-Яа-я]*')" '^не тот, что ожидался напоминание с блюдами: НЕТ$'
# ── без напоминаний (нет этапа 22б): функции есть, строки нет
PP "drop function _sa_warmup_due(boolean) cascade" >/dev/null
OUT=$($P0 -d $DB -f "$D/$S59" 2>&1)
chk "без этапа 22б — понятно, функции на месте" "$(echo "$OUT" | grep -o 'Напоминаний до смены (этап 22б) ещё нет' | head -1) | $(echo "$OUT" | grep -o 'меню в повторе: 4 функции из 4 .* напоминание с блюдами: нет этапа 22б')" '^Напоминаний до смены \(этап 22б\) ещё нет \| меню в повторе: 4 функции из 4 .* напоминание с блюдами: нет этапа 22б$'

echo
echo "итого: $pass ✓, $fail ✗"
[ "$fail" -eq 0 ]
