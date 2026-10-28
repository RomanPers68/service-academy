#!/bin/bash
# Этап 39 (v99, Доп. 412): удобство каждый день — вход через Telegram без кода, упоминания и поиск в чате, «Опаздываю»,
# смены в календаре телефона, экран «Сервер» у владельца, бот: /smena, «Принято», кнопка «Академия».
# Поверх базы run25.sh: копия satest39, этапы 26, 31, 32, 34, 35, 36, 37, 38 → 39 до 38 (ошибка) → 38, 39, 39; проверки ✓/✗.
# Отправка в Telegram — заглушка pg_net (net.sent_log). Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и
# PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test39.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest39
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
POST="supabase-stage38-chat.sql supabase-stage39-everyday.sql supabase-stage39-everyday.sql"
D=$(mktemp -d); for f in $PRE $POST; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT39=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = supabase-stage39-everyday.sql ] && OUT39="$out"; }
for f in $PRE; do run $f; done
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
# без этапа 38 этап 39 не идёт: просит сначала его
NO38=$($P0 -d $DB -f "$D/supabase-stage39-everyday.sql" 2>&1)
for f in $POST; do run $f; done
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
sent() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1' and body->>'text' like '%' || \$t\$$2\$t\$ || '%'"; }
calm() { PP "update sa_chat_reads set at = now() - interval '10 minutes', notified_at = null where emp_id = '$1'" >/dev/null; }
calmall() { PP "update sa_chat_reads set at = now() - interval '10 minutes', notified_at = null; update sa_chat_msgs set created_at = created_at - interval '2 minutes'" >/dev/null; }

chk "без этапа 38 — понятная ошибка: какой этап сначала" "$NO38" 'Сначала этап 38 \(supabase-stage38-chat.sql\)'
chk "этапы 26–38 и 39 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 11 функций, таблицы, упоминания, вход через Telegram, напоминание о функции tg-bot" "$OUT39" 'удобство: 11 функций из 11 · таблицы: есть · упоминания: да · вход через Telegram: .* · бот: обнови функцию tg-bot'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null
# подпись initData, как у Telegram: секрет — HMAC(токен бота, "WebAppData"), подпись — HMAC(строки ключ=значение по алфавиту)
PP "create or replace function t_init(p_id bigint, p_age int default 0, p_bad boolean default false) returns text language sql as \$f\$
  select 'query_id=AAA&user={\"id\":' || p_id || ',\"first_name\":\"T\"}&auth_date=' || ad || '&hash=' ||
    case when p_bad then repeat('0', 64) else encode(hmac(convert_to('auth_date=' || ad || E'\nquery_id=AAA\nuser={\"id\":' || p_id || ',\"first_name\":\"T\"}', 'UTF8'),
      hmac(convert_to('123:TEST', 'UTF8'), convert_to('WebAppData', 'UTF8'), 'sha256'), 'sha256'), 'hex') end
  from (select (extract(epoch from now())::bigint - p_age) ad) x \$f\$; grant execute on function t_init(bigint, int, boolean) to anon" >/dev/null
TI() { PP "select t_init($1, ${2:-0}, ${3:-false})"; }

# ── вход через Telegram ──
I111=$(TI 111); I222=$(TI 222); I555=$(TI 555)
R=$(Q "select tg_login('$I111')")
chk "Анна (напоминания в Telegram 111): вход без кода — новая сессия и профиль, как у входа по коду" "$R" '"ok": true.*"name": "Анна".*"restaurant": "Два моря, Океан"|"name": "Анна".*"ok": true'
TOK=$(PP "select tg_login('$I111')->>'token'")
chk "сессия рабочая: чат открывается с этим токеном" "$(Q "select chat_list('$TOK')->'me'->>'name'")" '^Анна Смирнова$'
chk "Telegram без связки — not_linked; подпись не та — bad_init; подпись старше суток — stale" "$(Q "select tg_login('$I555')->>'error'") $(Q "select tg_login('$(TI 111 0 true)')->>'error'") $(Q "select tg_login('$(TI 111 90000)')->>'error'") $(Q "select tg_login('мусор')->>'error'")" '^not_linked bad_init stale bad_init$'
chk "после входа по коду: tg_auth_bind запоминает Telegram 555 за Ильёй — дальше вход без кода" "$(Q "select tg_auth_bind('$ILYA', '$I555')->>'ok'") $(Q "select tg_login('$I555')->'employee'->>'name'")" '^true Илья$'
chk "чужой токен — auth; без подписи — bad_init" "$(Q "select tg_auth_bind('мусор', '$I555')->>'error'") $(Q "select tg_auth_bind('$ILYA', '')->>'error'")" '^auth bad_init$'
chk "«Выйти с этого устройства»: tg_auth_off — Telegram 555 больше не входит без кода" "$(Q "select tg_auth_off('$ILYA', '$I555')->>'ok'") $(Q "select tg_login('$I555')->>'error'")" '^true not_linked$'
chk "выход Анны закрывает и вход по напоминаниям (111), новый вход по коду — снова открывает" "$(Q "select tg_auth_off('$ANNA', '$I111')->>'ok'") $(Q "select tg_login('$I111')->>'error'") $(Q "select tg_auth_bind('$ANNA', '$I111')->>'ok'") $(Q "select tg_login('$I111')->'employee'->>'name'")" '^true not_linked true Анна$'
PP "insert into sa_tg_auth (tg_id, emp_id) values (666, '$OEMP') on conflict (tg_id) do update set emp_id = excluded.emp_id, off = false" >/dev/null
chk "уволенный — disabled; Telegram перешёл к другому (тот же 555 после входа Анны) — входит Анна" "$(Q "select tg_login('$(TI 666)')->>'error'") $(Q "select tg_auth_bind('$ANNA', '$I555')->>'ok'") $(Q "select tg_login('$I555')->'employee'->>'name'")" '^disabled true Анна$'
PP "delete from vault.secrets_stub" >/dev/null
chk "без бота — no_bot (вход по коду, как раньше)" "$(Q "select tg_login('$I111')->>'error'")" '^no_bot$'
PP "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST')" >/dev/null
chk "anon: таблица связок закрыта" "$(Q "select count(*) from sa_tg_auth")" 'permission denied'

# ── упоминания ──
TEAM=$(PP "select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'team'")
[ -z "$TEAM" ] && { Q "select chat_list('$ANNA')" >/dev/null; TEAM=$(PP "select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'team'"); }
Q "select chat_list('$MARIA')" >/dev/null; Q "select chat_list('$ROMAN')" >/dev/null; Q "select chat_list('$ILYA')" >/dev/null; Q "select chat_list('$PETR')" >/dev/null
LEADS=$(PP "select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'leads'")
calmall; PP "delete from net.sent_log" >/dev/null
M1=$(Q "select chat_send('$MARIA', $TEAM, '@Анна, проверь бокалы на веранде')->'msg'->>'id'")
chk "«@Анна» в «Вся команда»: в сообщении упомянута Анна; бот Анне — «Мария К. упоминает тебя в «Вся команда»»" "$(PP "select array_to_string(mentions, ',') from sa_chat_msgs where id = $M1")|$(sent 111 'Мария К. упоминает тебя в «Вся команда»:')" "^$AEMP\\|1\$"
chk "у Анны в списке чатов — 1 непрочитанное упоминание; прочитала — 0" "$(Q "select c->>'ment' from jsonb_array_elements(chat_list('$ANNA')->'chats') c where (c->>'id')::bigint = $TEAM")|$(Q "select chat_read('$ANNA', $TEAM, $M1)->>'ok'" >/dev/null; Q "select c->>'ment' from jsonb_array_elements(chat_list('$ANNA')->'chats') c where (c->>'id')::bigint = $TEAM")" '^1\|0$'
calmall; PP "delete from net.sent_log" >/dev/null
M2=$(Q "select chat_send('$ANNA', $TEAM, 'Готово. @Илья, лёд на баре ещё есть? Почта anna@mail.ru')->'msg'->>'id'")
chk "«@Илья» — только Илья (адрес почты — не упоминание); бот Илье" "$(PP "select array_to_string(mentions, ',') from sa_chat_msgs where id = $M2")|$(sent 222 'Анна С. упоминает тебя')" "^$IEMP\\|1\$"
calm "$IEMP"; PP "delete from net.sent_log" >/dev/null
Q "select chat_open('$ILYA', $TEAM)" >/dev/null; PP "update sa_chat_reads set at = now() where emp_id = '$IEMP'" >/dev/null
M3=$(Q "select chat_send('$ANNA', $TEAM, '@Илья спасибо!')->'msg'->>'id'")
chk "Илья сейчас в чате (читал только что) — бот ему не пишет, упоминание в сообщении есть" "$(PP "select array_to_string(mentions, ',') from sa_chat_msgs where id = $M3")|$(sent 222 'упоминает тебя')" "^$IEMP\\|0\$"
calmall; PP "delete from net.sent_log" >/dev/null
M4=$(Q "select chat_send('$MARIA', $TEAM, '@все в 17:00 короткая планёрка')->'msg'->>'id'")
chk "«@все» руководителя: бот всем участникам (Анна, Илья, Пётр), кроме автора" "$(PP "select array_to_string(mentions, ',') from sa_chat_msgs where id = $M4")|$(sent 111 'Мария К. пишет всем в «Вся команда»:')$(sent 222 'пишет всем')$(sent 444 'пишет всем')$(sent 333 'пишет всем')" '^all\|1110$'
calmall; PP "delete from net.sent_log" >/dev/null
M5=$(Q "select chat_send('$MARIA', $TEAM, '@все и ещё: форма чистая')->'msg'->>'id'")
chk "второе «@все» за 10 минут — упоминание есть, бот всем больше не пишет" "$(PP "select array_to_string(mentions, ',') from sa_chat_msgs where id = $M5")|$(PP "select count(*) from net.sent_log")" '^all\|0$'
M6=$(Q "select chat_send('$ANNA', $TEAM, '@все кто возьмёт мой стол?')->'msg'->>'id'")
chk "«@все» официанта — просто текст (без упоминания)" "$(PP "select coalesce(array_to_string(mentions, ','), 'нет') from sa_chat_msgs where id = $M6")" '^нет$'
# тёзки: две Анны в заведении — «Анна С.» и «Анна П.»
PP "insert into employees (id, name, surname, restaurant, position) values ('00000000-0000-0000-0000-0000000000c1', 'Анна', 'Петрова', 'Два моря, Океан', 'waiter') on conflict do nothing" >/dev/null
M7=$(Q "select chat_send('$MARIA', $TEAM, '@Анна С. и @Анна П. на веранду; @Анна просто так')->'msg'->>'id'")
chk "тёзки: «@Анна С.» и «@Анна П.» — обе; «@Анна» без буквы — никто" "$(PP "select array_to_string(array(select unnest(mentions) order by 1), ',') from sa_chat_msgs where id = $M7")" "^00000000-0000-0000-0000-0000000000a4,00000000-0000-0000-0000-0000000000c1\$"
PP "delete from employees where id = '00000000-0000-0000-0000-0000000000c1'" >/dev/null
DM=$(Q "select chat_dm('$MARIA', '$AEMP')->'chat'->>'id'")
M8=$(Q "select chat_send('$MARIA', $DM, '@Анна привет')->'msg'->>'id'")
chk "в личной переписке упоминаний нет (там и так пишет бот)" "$(PP "select coalesce(array_to_string(mentions, ','), 'нет') from sa_chat_msgs where id = $M8")" '^нет$'
M9=$(Q "select chat_send('$ANNA', $TEAM, 'Пётр, глянь')->'msg'->>'id'")
Q "select chat_edit('$ANNA', $M9, '@Пётр глянь')" >/dev/null
chk "правка: упоминание пересчитано (бот при правке не пишет)" "$(PP "select array_to_string(mentions, ',') from sa_chat_msgs where id = $M9")" "^$PEMP\$"
THB=$(grep -oE "^THB='[^']+'" "$HERE/test38.sh" | sed "s/^THB='//;s/'\$//")   # маленький JPEG, как в test38
PH=$(Q "select chat_photo_send('$ANNA', $TEAM, '$THB', '$THB', 8, 6, '@Мария вот так стол накрыт', null)->'msg'->>'id'")
chk "фото с подписью «@Мария …» — упоминание" "$(PP "select array_to_string(mentions, ',') from sa_chat_msgs where id = ${PH:-0}") [$PH]" "^$MEMP \[[0-9]+\]\$"

# ── поиск ──
chk "поиск «бокал» у Анны: сообщение Марии в «Вся команда»; регистр не важен; «ещё» находится по «еще»" "$(Q "select (x->'msgs'->0->>'id') from chat_search('$ANNA', 'бокал') x")|$(Q "select jsonb_array_length(chat_search('$ANNA', 'БОКАЛЫ')->'msgs')")|$(Q "select (chat_search('$ANNA', 'лёд на баре еще')->'msgs'->0->>'id')")" "^$M1\\|1\\|$M2\$"
PP "update sa_chat_msgs set created_at = created_at - interval '2 minutes' where emp_id = '$MEMP'" >/dev/null
ML=$(Q "select chat_send('$MARIA', $LEADS, 'Секретный план на банкет')->'msg'->>'id'")
chk "чужие чаты в поиск не попадают: «Старшие» — только руководителям" "$(Q "select jsonb_array_length(chat_search('$ANNA', 'банкет')->'msgs')") $(Q "select (chat_search('$MARIA', 'банкет')->'msgs'->0->>'id')")" "^0 $ML\$"
chk "в одном чате (p_chat); короче двух знаков — bad_request; «%» — буквально" "$(Q "select jsonb_array_length(chat_search('$MARIA', 'банкет', $TEAM)->'msgs')") $(Q "select chat_search('$ANNA', 'б')->>'error'") $(Q "select jsonb_array_length(chat_search('$ANNA', '%%')->'msgs')") $(Q "select chat_search('мусор', 'бокал')->>'error'")" '^0 bad_request 0 auth$'

# ── «Опаздываю» ──
calmall; PP "delete from net.sent_log" >/dev/null
ETQ="select to_char(greatest(((now() at time zone 'Asia/Kamchatka')::date + time '16:00'), date_trunc('minute', now() at time zone 'Asia/Kamchatka')) + interval '15 minutes', 'HH24:MI')"
ETA1=$(PP "$ETQ")
R=$(Q "select chat_late('$ANNA', null, 15, 'Пробка на мосту')")
ETA2=$(PP "$ETQ")
LM=$(printf '%s' "$R" | grep -oE '"id": [0-9]+' | head -1 | grep -oE '[0-9]+')
ETA=$(PP "select card->>'eta' from sa_chat_msgs where id = $LM")
[ "$ETA" = "$ETA1" ] || [ "$ETA" = "$ETA2" ] || ETA="не то: $ETA (ждали $ETA1)"
chk "Анна (вечер с 16:00): карточка «Опаздываю» в «Вся команда»: на 15 минут, буду в $ETA, смена с 16:00, причина" "$R" "\"t\": \"late\".*\"eta\": \"$ETA\".*\"from\": \"16:00\""
chk "текст карточки (для списка и поиска): «Опаздываю на 15 минут: буду в …. Пробка на мосту»" "$(PP "select body from sa_chat_msgs where id = $LM")" "^Опаздываю на 15 минут: буду в $ETA\\. Пробка на мосту\$"
chk "руководителю в смене (Мария, утро) — бот с кнопкой «Принято» (cl:…); Петру (не в смене сегодня) — нет" "$(PP "select count(*) from net.sent_log where body->>'chat_id' = '333' and body->>'text' like 'Анна С. опаздывает на 15 минут: будет в $ETA (смена с 16:00).%«Пробка на мосту»' and body->'reply_markup'->'inline_keyboard'->0->0->>'callback_data' = 'cl:$LM'")$(sent 444 'опаздывает')" '^10$'
chk "второй раз за 3 минуты — too_fast; минуты не те — bad_request; «Старшие» — not_found" "$(Q "select chat_late('$ANNA', null, 10, '')->>'error'") $(Q "select chat_late('$ILYA', null, 3, '')->>'error'") $(Q "select chat_late('$MARIA', $LEADS, 15, '')->>'error'")" '^too_fast bad_request not_found$'
chk "отметка для графика: late_month у Марии — Анна, s1 (строка графика), 15 мин; у Ильи — только свои (пусто)" "$(Q "select (r->>'name') || '|' || (r->>'sid') || '|' || (r->>'min') || '|' || (r->>'note') from jsonb_array_elements(late_month('$MARIA', to_char(now() at time zone 'Asia/Kamchatka', 'YYYY-MM'))->'rows') r")|$(Q "select jsonb_array_length(late_month('$ILYA', to_char(now() at time zone 'Asia/Kamchatka', 'YYYY-MM'))->'rows')")" '^Анна Смирнова\|s1\|15\|Пробка на мосту\|0$'
calm "$AEMP"; PP "delete from net.sent_log" >/dev/null
chk "«Принято»: Анне — forbidden; Мария — в карточке «принято: Мария Ким», Анне бот «Мария К.: принято, ждём к …»" "$(Q "select chat_late_ok('$ANNA', $LM)->>'error'") $(Q "select chat_late_ok('$MARIA', $LM)->'msg'->'card'->'ok'->>'name'")|$(sent 111 "Мария К.: принято, ждём к $ETA.")" '^forbidden Мария Ким\|1$'
chk "второе «Принято» — again (кто ответил первым — остаётся); в графике отмечено «принято»" "$(Q "select chat_late_ok('$ROMAN', $LM)->>'again'") $(Q "select r->>'ok' from jsonb_array_elements(late_month('$MARIA', to_char(now() at time zone 'Asia/Kamchatka', 'YYYY-MM'))->'rows') r")" '^true Мария Ким$'
# «Принято» из Telegram
PP "update sa_chat_msgs set created_at = created_at - interval '5 minutes' where emp_id = '$IEMP'" >/dev/null
LI=$(Q "select chat_late('$ILYA', null, 30, '')->'msg'->>'id'")
PP "insert into sa_settings (key, value) values ('tg_webhook_secret', 'sec39') on conflict (key) do update set value = excluded.value; delete from sa_settings where key = 'tg_last_update'" >/dev/null
TGU() { PP "select sa_tg_update('sec39', \$j\$$1\$j\$::jsonb)"; }
CBJ() { echo "{\"update_id\": $1, \"callback_query\": {\"id\": \"cq$1\", \"from\": {\"id\": $2}, \"data\": \"$3\", \"message\": {\"message_id\": 7$1, \"chat\": {\"id\": $2, \"type\": \"private\"}, \"text\": \"$4\", \"reply_markup\": {\"inline_keyboard\": [[{\"text\": \"Принято\", \"callback_data\": \"$3\"}], [{\"text\": \"Открыть чат\", \"web_app\": {\"url\": \"https://app.example/?go=chat_$TEAM\"}}]]}}}}"; }
calm "$IEMP"; PP "delete from net.sent_log" >/dev/null
chk "«Принято» в Telegram: Анна (не руководитель) — отказ; Мария — принято, сообщение бота без кнопки «Принято», «Открыть чат» остаётся" "$(TGU "$(CBJ 1 111 "cl:$LI" "Илья Б. опаздывает")" | grep -o '"skip": "late"') $(TGU "$(CBJ 2 333 "cl:$LI" "Илья Б. опаздывает на 30 минут")" | grep -o '"late": [0-9]*')|$(PP "select count(*) from net.sent_log where url like '%/editMessageText' and body->>'text' like '%Принято.' and jsonb_array_length(body->'reply_markup'->'inline_keyboard') = 1")|$(sent 222 'Мария К.: принято')" "^\"skip\": \"late\" \"late\": $LI\\|1\\|1\$"
chk "вебхук отмечает время последнего события от Telegram (для экрана «Сервер»)" "$(PP "select value from sa_settings where key = 'tg_last_update'")" '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T'

# ── /smena ──
PP "delete from net.sent_log" >/dev/null
TGU '{"update_id": 20, "message": {"message_id": 1, "from": {"id": 111}, "chat": {"id": 111, "type": "private"}, "text": "/smena"}}' >/dev/null
chk "/smena (Анна): «Твои смены: сегодня, … · вечер 16:00–24:00» и кнопка «Открыть график» (go=schedule)" "$(PP "select (body->>'text') || '|' || (body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url') from net.sent_log where body->>'chat_id' = '111'")" '^Твои смены:.сегодня, [0-9]+ [^ ]+ · вечер 16:00–24:00\|https://app.example/\?go=schedule$'
PP "delete from net.sent_log" >/dev/null
TGU '{"update_id": 21, "message": {"message_id": 2, "from": {"id": 999}, "chat": {"id": 999, "type": "private"}, "text": "/smena@SA_RestaurantBot"}}' >/dev/null
TGU '{"update_id": 22, "message": {"message_id": 3, "from": {"id": 111}, "chat": {"id": 111, "type": "private"}, "text": "/start"}}' >/dev/null
chk "/smena из чужого Telegram — «Не узнаю этот Telegram» и кнопка в приложение; /start — подсказка про «смена» и /smena" "$(sent 999 'Не узнаю этот Telegram. Открой приложение кнопкой ниже и войди')|$(sent 111 'Напиши «смена» или /smena: пришлю твои ближайшие смены.')" '^1\|1$'

# ── v100 (Доп. 413): смены словами, ответом на сообщение бота и по входу через Telegram ──
TGM() { echo "{\"update_id\": $1, \"message\": {\"message_id\": $1, \"from\": {\"id\": $2}, \"chat\": {\"id\": $2, \"type\": \"private\"}, \"text\": \"$3\"${4:-}}}"; }
PP "delete from net.sent_log" >/dev/null
for w in "smena" "Смена" "мои  смены!" "График?" "Когда на смену" "/smena@SA_RestaurantBot"; do TGU "$(TGM 30 111 "$w")" >/dev/null; done
chk "v100: «smena», «Смена», «мои  смены!», «График?», «Когда на смену», /smena@бот — каждый раз смены" "$(sent 111 'Твои смены:')" '^6$'
PP "delete from net.sent_log" >/dev/null
TGU "$(TGM 31 111 'сменаа')" >/dev/null; TGU "$(TGM 32 111 'смена завтра у кого')" >/dev/null
chk "v100: «сменаа», «смена завтра у кого» — не команда: подсказка «Твои смены: напиши «смена» или /smena.»" "$(sent 111 'Твои смены: напиши «смена» или /smena.') $(sent 111 'Твои смены:')" '^2 2$'
PP "delete from net.sent_log" >/dev/null
RB='{"message_id": 50, "from": {"id": 1, "is_bot": true}, "chat": {"id": 111, "type": "private"}, "text": "Чтобы написать в чат, ответь на сообщение о переписке"}'
TGU "$(TGM 33 111 'smena' ", \"reply_to_message\": $RB")" >/dev/null
chk "v100: «smena» ответом на сообщение бота не о переписке — смены (раньше «Этот ответ в чат не уходит»)" "$(sent 111 'Твои смены:') $(sent 111 'Этот ответ в чат не уходит')" '^1 0$'
RC='{"message_id": 51, "from": {"id": 1, "is_bot": true}, "chat": {"id": 111, "type": "private"}, "text": "Мария К. пишет", "reply_markup": {"inline_keyboard": [[{"text": "Открыть чат", "web_app": {"url": "https://app.example/?go=chat_'"$TEAM"'"}}]]}}'
N0=$(PP "select count(*) from sa_chat_msgs where emp_id = '$AEMP' and body = 'смена'")
calm "$AEMP"
TGU "$(TGM 34 111 'смена' ", \"reply_to_message\": $RC")" >/dev/null
chk "v100: «смена» ответом на сообщение о переписке — уходит в чат, как раньше" "$(PP "select count(*) from sa_chat_msgs where emp_id = '$AEMP' and body = 'смена'")" "^$((N0+1))$"
PP "insert into sa_tg_auth (tg_id, emp_id, off) values (777, '$PEMP', false) on conflict (tg_id) do update set emp_id = excluded.emp_id, off = false; delete from net.sent_log" >/dev/null
TGU "$(TGM 35 777 'смена')" >/dev/null
PP "update sa_tg_auth set off = true where tg_id = 777" >/dev/null
TGU "$(TGM 36 777 'смена')" >/dev/null
chk "v100: вход через Telegram без напоминаний — бот узнаёт (у Петра в графике смен нет — так и пишет); вышел сам — «Не узнаю этот Telegram»" "$(sent 777 'В графике на две недели вперёд смен нет.')|$(sent 777 'Не узнаю этот Telegram')" '^1\|1$'
chk "v100: служебные функции закрыты (anon)" "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('_sa_tg_is_shifts', '_sa_tg_emp', '_sa_tg_chat_link') and has_function_privilege('anon', p.oid, 'execute')")" '^0$'

# ── календарь ──
K1=$(Q "select cal_key('$ANNA')->>'key'")
chk "календарь: ссылка Анны — 32 знака; ближайшие смены для подсказки (сегодня вечер); повторно — та же" "$K1|$(Q "select (x->'next'->0->>'label') || ' ' || (x->'next'->0->>'time') from cal_key('$ANNA') x")|$(Q "select cal_key('$ANNA')->>'key'")" "^[0-9a-f]{32}\\|Вечер 16:00–24:00\\|$K1\$"
chk "страница «Подписаться» (p_page): смены есть, а «календарь забирал смены» не отмечается" "$(Q "select (cal_feed('$K1', true)->>'ok') || ' ' || ((cal_key('$ANNA')->>'used') is null)")" '^true true$'
R=$(Q "select cal_feed('$K1')")
chk "cal_feed по ссылке (без входа): имя, заведение, пояс, смены с часами" "$R" '"ok": true.*"name": "Анна Смирнова"|"name": "Анна Смирнова".*"ok": true'
chk "смен в ленте — 12 дней графика (вечер 16–24); телефон забирал — отмечено" "$(Q "select jsonb_array_length(x->'shifts') || ' ' || (x->'shifts'->0->>'from') || '-' || (x->'shifts'->0->>'to') from cal_feed('$K1') x")|$(Q "select (cal_key('$ANNA')->>'used') is not null")" '^1[23] 16-24\|t$'
K2=$(Q "select cal_key('$ANNA', true)->>'key'")
chk "«Сбросить ссылку»: новая; старая больше не работает; мусор — key" "$(Q "select cal_feed('$K1')->>'error'") $(Q "select cal_feed('$K2')->>'ok'") $(Q "select cal_feed('мусор')->>'error'")" '^key true key$'
KO=$(PP "insert into sa_cal_keys (emp_id, k) values ('$OEMP', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') on conflict do nothing; select 'ok'")
chk "уволенный — ссылка не работает; таблица ссылок закрыта" "$(Q "select cal_feed('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')->>'error'") $(Q "select count(*) from sa_cal_keys")" '^key .*permission denied'

# ── «Сервер» у владельца ──
chk "server_check: не владелец — forbidden; чужой токен — auth" "$(Q "select server_check('$MARIA', array['chat_list'])->>'error'") $(Q "select server_check('мусор')->>'error'")" '^forbidden auth$'
chk "владелец: функции на месте (без «нет_такой»), корзин нет (нет Storage), бот, адрес приложения" "$(Q "select (x->'fns')::text || '|' || coalesce(x->>'buckets', 'null') || '|' || (x->'tg'->>'bot') || '|' || (x->>'app') from server_check('$ROMAN', array['chat_list', 'tg_login', 'нет_такой'], array['menu-photos'], 'https://abcdefgh.supabase.co') x")" '^\["chat_list", "tg_login"\]\|null\|true\|https://app.example$'
chk "в ответе: связки (напоминания — 4, вход без кода — есть), pg_net, сотрудников" "$(Q "select (x->'tg'->>'linked') || ' ' || ((x->'tg'->>'auth')::int > 0) || ' ' || (x->>'pg_net') || ' ' || ((x->>'staff')::int > 5) || ' ' || (x->'tg'->>'hook') from server_check('$ROMAN') x")" '^4 true (true|false) true true$'
chk "адрес проекта запомнен — sa_tg_setup_code печатает готовую ссылку" "$(PP "select sa_tg_setup_code()")" 'Открой в браузере: https://abcdefgh.supabase.co/functions/v1/tg-bot\?setup=[0-9a-f]{12}$'
CODE=$(Q "select owner_tg_setup('$ROMAN', 'https://other.example')->>'code'")
chk "«Подключить бота» из приложения: код (Марии — forbidden); адрес приложения уже есть — не меняется; tg-bot по коду получает адрес" "$CODE|$(Q "select owner_tg_setup('$MARIA', 'https://x.example')->>'error'")|$(PP "select sa_tg_setup_take('$CODE')->>'app'")" '^[0-9a-f]{12}\|forbidden\|https://app.example$'
PP "delete from sa_settings where key = 'app_url'" >/dev/null
CODE2=$(Q "select owner_tg_setup('$ROMAN', 'https://new.example/')->>'code'")
chk "адреса приложения нет — берётся из приложения (без «/» в конце); код одноразовый" "$(PP "select value from sa_settings where key = 'app_url'")|$(PP "select sa_tg_setup_take('$CODE2', true)->>'ok'")|$(PP "select sa_tg_setup_take('$CODE2')->>'error'")" '^https://new.example\|true\|code$'
PP "insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null
# вебхук «стоит» только когда tg-bot поставил его по коду или от Telegram пришло событие (код выдан, но ссылку не открыли — нет)
PP "delete from sa_settings where key in ('tg_hook_at', 'tg_last_update')" >/dev/null
H0=$(Q "select server_check('$ROMAN')->'tg'->>'hook'")
CODE3=$(Q "select owner_tg_setup('$ROMAN')->>'code'")
H1=$(Q "select server_check('$ROMAN')->'tg'->>'hook'")
PP "select sa_tg_setup_take('$CODE3', true)" >/dev/null
chk "«Сервер»: код выдан, ссылку не открыли — вебхука нет; tg-bot поставил по коду — есть" "$H0 $H1 $(Q "select server_check('$ROMAN')->'tg'->>'hook'")" '^false false true$'

# ── права ──
chk "anon: 11 функций этапа — можно; служебные — нельзя" "$(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('tg_login', 'tg_auth_bind', 'tg_auth_off', 'chat_search', 'chat_late', 'chat_late_ok', 'late_month', 'cal_key', 'cal_feed', 'server_check', 'owner_tg_setup') and has_function_privilege('anon', p.oid, 'execute')") $(PP "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('_sa_tg_auth_date', '_sa_tg_who', '_sa_re_esc', '_sa_low_e', '_sa_chat_ment_names', '_sa_chat_ment_parse', '_sa_emp_shifts', '_sa_late_min', '_sa_late_ok_do', '_sa_tg_shifts_text', '_sa_late_tg_cb', 'sa_tg_setup_take', 'sa_tg_setup_code', 'sa_tg_update') and has_function_privilege('anon', p.oid, 'execute')")" '^11 0$'
chk "anon: таблица опозданий закрыта" "$(Q "select count(*) from sa_late")" 'permission denied'
chk "чужой токен — auth (все с токеном)" "$(Q "select string_agg(x, ' ') from (values (tg_auth_bind('мусор', 'x')->>'error'), (tg_auth_off('мусор', 'x')->>'error'), (chat_search('мусор', 'xx')->>'error'), (chat_late('мусор', null, 15)->>'error'), (chat_late_ok('мусор', 1)->>'error'), (late_month('мусор', '2026-10')->>'error'), (cal_key('мусор')->>'error'), (server_check('мусор')->>'error'), (owner_tg_setup('мусор')->>'error')) v(x)")" '^(auth ){8}auth$'
# этап 38 после 39 возвращает свой вебхук: напоминание в начале файла
chk "в шапке файла: после повторного этапа 31 или 38 перезапустить этот" "$(head -40 "$SRC/supabase-stage39-everyday.sql" | tr '\n' ' ')" 'если после него снова запускали -- этап 31 или 38, запусти и этот файл ещё раз'

echo
echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
