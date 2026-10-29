#!/bin/bash
# Этап 42 (v108, Доп. 421): тепло в команде — «Спасибо коллеге», дни рождения и годовщины.
# Поверх базы run25.sh: копия satest42; этап 42 раньше 38 (понятная ошибка) → этапы 26, 31, 32, 34, 35, 36, 37, 38, 39, 41 →
# 42 дважды; «спасибо» карточкой и «Тоже спасибо», «спасибо» в профиле и за неделю, праздники по графику («Д.р.»,
# «В команде с») и по дню прихода в «Новички», окно 9–21 по часам заведения, сообщения бота; проверки ✓/✗. Отправка в
# Telegram — заглушка pg_net (net.sent_log), pg_cron — своя заглушка. Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock)
# и PGPORT (5433), пользователь postgres. Если есть node — сводки, тексты бота и разбор дат сверяются с lib/team-warm.js.
#   bash run25.sh && bash test42.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
LIB=${SA_LIB:-$HERE/../../../lib}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest42
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql supabase-stage41-newbie.sql"
S42=supabase-stage42-thanks.sql
D=$(mktemp -d); for f in $PRE $MID $S42; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT42=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = $S42 ] && OUT42="$out"; }
for f in $PRE; do run $f; done
# этап 42 раньше 38: просит нужный этап и ничего не меняет
NO38=$($P0 -d $DB -f "$D/$S42" 2>&1)
NOTAB=$($P0 -d $DB -t -A -c "select count(*) from pg_class where relname in ('sa_peer_thanks', 'sa_cheers')" 2>&1)
for f in $MID $S42 $S42; do run $f; done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PN() { $P -c "$1" 2>&1; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
same() { if [ "$1" = "$2" ]; then echo SAME; else printf 'РАЗНЫЕ\n--- ждали:\n%s\n--- пришло:\n%s' "$2" "$1"; fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; OLEG=10000000-0000-0000-0000-0000000000a6
IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
REMP=00000000-0000-0000-0000-0000000000a1; MEMP=00000000-0000-0000-0000-0000000000a2; PEMP=00000000-0000-0000-0000-0000000000a3
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5; OEMP=00000000-0000-0000-0000-0000000000a6
VEMP=00000000-0000-0000-0000-0000000000b2; KEMP=00000000-0000-0000-0000-0000000000c1
TZ0=Asia/Kamchatka
LD="(now() at time zone '$TZ0')::date"
R0="Два моря, Океан"
sentn() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1'"; }
lastsent() { PN "select body->>'text' from net.sent_log where body->>'chat_id' = '$1' order by id desc limit 1"; }

chk "этап 42 раньше этапа 38 — понятная ошибка, таблиц нет" "$(echo "$NO38" | tr '\n' ' ') · $NOTAB" 'Сначала этап 38 \(supabase-stage38-chat.sql\).* · 0$'
chk "этапы 26–39, 41 и 42 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 6 функций из 6, без pg_cron — подсказка, бота нет — карточки будут" \
  "$(echo "$OUT42" | grep -c 'pg_cron не включён: карточки дней рождения и годовщин появятся, когда кто-нибудь откроет чат') $(echo "$OUT42" | grep -o 'тепло в команде: .*')" \
  '^1 тепло в команде: 6 функций из 6 · расписание: pg_cron не включён · бот: нет \(карточки в чате будут, сообщений в Telegram — нет\) · сегодня праздник: 0 · «спасибо» от коллег всего: 0$'

# ── слова и даты ──
chk "годы: год, 2 года, 5 лет, 11 лет, 21 год, 22 года, 101 год" \
  "$(PP "select string_agg(_sa_ty_years(n), '|' order by o) from unnest(array[1, 2, 5, 11, 21, 22, 101]) with ordinality u(n, o)")" '^год\|2 года\|5 лет\|11 лет\|21 год\|22 года\|101 год$'
chk "«Д.р.»: 15.03, 1.2 и 15.03.1990 — да; 31.02, буквы и пусто — нет" \
  "$(PP "select concat_ws('|', _sa_ty_bday('15.03')::text, _sa_ty_bday(' 1.2 ')::text, _sa_ty_bday('15.03.1990')::text, coalesce(_sa_ty_bday('31.02')::text, 'нет'), coalesce(_sa_ty_bday('abc')::text, 'нет'), coalesce(_sa_ty_bday('')::text, 'нет'))")" \
  '^\{15,3\}\|\{1,2\}\|\{15,3\}\|нет\|нет\|нет$'
chk "«В команде с»: 29.10.2023 и 2023-10-29 — да; 31.02.2023 и 29.02.2023 — нет, 29.02.2024 — да" \
  "$(PP "select concat_ws('|', _sa_ty_joined('29.10.2023'), _sa_ty_joined('2023-10-29'), coalesce(_sa_ty_joined('31.02.2023')::text, 'нет'), coalesce(_sa_ty_joined('29.02.2023')::text, 'нет'), _sa_ty_joined('29.02.2024'))")" \
  '^2023-10-29\|2023-10-29\|нет\|нет\|2024-02-29$'
chk "29 февраля в невисокосный год — 28-го, в високосный — 29-го" \
  "$(PP "select concat_ws('|', _sa_ty_same(2, 29, '2027-02-28'), _sa_ty_same(2, 29, '2028-02-28'), _sa_ty_same(2, 29, '2028-02-29'), _sa_ty_same(3, 15, '2027-03-15'))")" '^t\|f\|t\|t$'
chk "что праздновать: день рождения и 3 года; в год прихода — ничего" \
  "$(PP "select _sa_ty_due_of('2026-10-29', '29.10', '2023-10-29')::text || ' ' || _sa_ty_due_of('2026-10-29', '30.10', '2026-10-29')::text")" \
  '^\[\{"kind": "bday"\}, \{"kind": "anniv", "since": "2023-10-29", "years": 3\}\] \[\]$'

# ── «Спасибо коллеге» ──
PP "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;
    insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;" >/dev/null
TEAM=$(Q "select chat_list('$ANNA')->'chats'->0->>'id'")
R1=$(Q "select chat_thanks('$ANNA', '$IEMP', '  выручил   на банкете ')")
M1=$(PP "select max(id) from sa_chat_msgs")
chk "Анна говорит спасибо Илье: карточка в «Вся команда» — кому, за что (пробелы в один), без присоединившихся; бот написал Илье" \
  "$(PP "select concat_ws('|', m.chat_id = (select id from sa_chats where restaurant = '$R0' and kind = 'team'), m.emp_id = '$AEMP', m.body, m.card->>'t', m.card->'to'->>'name', m.card->'to'->>'pos', m.card->>'text', jsonb_array_length(m.card->'plus')) from sa_chat_msgs m where m.id = ${M1:-0}") $(echo "$R1" | grep -o '\"tg\": true')" \
  '^t\|t\|Спасибо: Илья Бармен, выручил на банкете\|thx\|Илья Бармен\|bartender\|выручил на банкете\|0 "tg": true$'
chk "сообщение бота Илье: «Анна С. говорит тебе спасибо: «выручил на банкете»» и кнопка к карточке" \
  "$(sentn 222) $(lastsent 222 | tr '\n' ' ') $(PP "select body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url' from net.sent_log where body->>'chat_id' = '222' order by id desc limit 1")" \
  "^1 Анна С\. говорит тебе спасибо: «выручил на банкете» +https://app\.example/\?go=chat_[0-9]+_${M1:-0}$"
chk "запись «спасибо»: от Анны Илье, своя карточка" \
  "$(PP "select concat_ws('|', from_name, to_name, text, own, restaurant) from sa_peer_thanks where msg_id = ${M1:-0}")" '^Анна Смирнова\|Илья Бармен\|выручил на банкете\|t\|Два моря, Океан$'
chk "тому же коллеге второй раз за день — again и та же карточка; себе — self; из Порта и уволенному — not_found; мусор — auth" \
  "$(Q "select concat_ws('|', chat_thanks('$ANNA', '$IEMP', 'ещё')->>'error', chat_thanks('$ANNA', '$IEMP', 'ещё')->'msg'->>'id' = '${M1:-0}', chat_thanks('$ANNA', '$AEMP', 'x')->>'error', chat_thanks('$ANNA', '$VEMP', 'x')->>'error', chat_thanks('$ANNA', '$OEMP', 'x')->>'error', chat_thanks('мусор', '$IEMP', 'x')->>'error')")" \
  '^again\|t(rue)?\|self\|not_found\|not_found\|auth$'
LONG=$(printf 'а%.0s' $(seq 1 300))
chk "длинное «за что» — до 140 знаков с «…»; без слов — можно" \
  "$(Q "select char_length(chat_thanks('$ANNA', '$PEMP', '$LONG')->'msg'->'card'->>'text') || ' ' || right(chat_thanks('$ANNA', '$PEMP', 'x')->'msg'->'card'->>'text', 1) || ' ' || (chat_thanks('$MARIA', '$PEMP', '')->'msg'->>'body')")" \
  '^140 … Спасибо: Пётр Иванов$'
PP "insert into sa_peer_thanks (msg_id, restaurant, from_id, from_name, to_id, to_name, text, own) select 900000 + g, '$R0', '$REMP', 'Роман', '$PEMP', 'Пётр', 'x', true from generate_series(1, 15) g" >/dev/null
chk "от себя — до 15 в день: Роману шестнадцатое — limit" "$(Q "select chat_thanks('$ROMAN', '$AEMP', 'x')->>'error'")" '^limit$'
PP "delete from sa_peer_thanks where msg_id > 900000" >/dev/null

# ── «Тоже спасибо» ──
chk "Мария присоединяется — раз; второй раз — то же; Илья (кому спасибо) — self, Анна (автор) — own, Иван из Порта и мусор — not_found" \
  "$(Q "select concat_ws('|', jsonb_array_length(chat_cheer('$MARIA', ${M1:-0})->'msg'->'card'->'plus'), jsonb_array_length(chat_cheer('$MARIA', ${M1:-0})->'msg'->'card'->'plus'), chat_cheer('$ILYA', ${M1:-0})->>'error', chat_cheer('$ANNA', ${M1:-0})->>'error', chat_cheer('$IVAN', ${M1:-0})->>'error', chat_cheer('$MARIA', 0)->>'error')")" \
  '^1\|1\|self\|own\|not_found\|not_found$'
chk "«Тоже спасибо» Марии записано (не своя карточка, за что — то же)" \
  "$(PP "select concat_ws('|', count(*), bool_or(not own), max(text) filter (where not own)) from sa_peer_thanks where msg_id = ${M1:-0}") $(PP "select card->'plus'->0->>'n' from sa_chat_msgs where id = ${M1:-0}")" \
  '^2\|t\|выручил на банкете Мария Ким$'

# ── в профиле и за неделю ──
PP "insert into sa_chat_msgs (chat_id, emp_id, emp_name, body, kind, card) values ((select id from sa_chats where restaurant = '$R0' and kind = 'team'), '$MEMP', 'Мария Ким', 'Спасибо: Илья Бармен, подменил', 'card', '{\"t\":\"thx\",\"to\":{\"id\":\"$IEMP\",\"name\":\"Илья Бармен\"},\"text\":\"подменил\",\"plus\":[]}');
    insert into sa_peer_thanks (msg_id, restaurant, from_id, from_name, to_id, to_name, text, own, created_at)
      values ((select max(id) from sa_chat_msgs), '$R0', '$MEMP', 'Мария Ким', '$IEMP', 'Илья Бармен', 'подменил', true, now()),
             (777001, '$R0', '$PEMP', 'Пётр Иванов', '$IEMP', 'Илья Бармен', 'давно', true, now() - interval '40 days');" >/dev/null
chk "Илья в «Я»: за неделю 3, всего 4; карточки новые сверху — кто, за что, кто присоединился, чат; старая (из чата ушла) — без чата" \
  "$(Q "select concat_ws('|', r->>'week', r->>'total', (select string_agg((x->>'name') || ':' || (x->>'text') || ':' || jsonb_array_length(x->'plus') || ':' || coalesce(x->>'chat', '-'), ', ' order by o) from jsonb_array_elements(r->'items') with ordinality q(x, o))) from (select thanks_peer('$ILYA') r) z")" \
  "^3\|4\|Мария Ким:подменил:0:[0-9]+, Анна Смирнова:выручил на банкете:1:[0-9]+, Пётр Иванов:давно:0:-$"
chk "за неделю для «Сотрудника недели»: у Ильи 2 (Мария сегодня дважды — одно, Анна — одно, давнее — нет), у Петра 2" \
  "$(Q "select string_agg((x->>'name') || ' ' || (x->>'surname') || ':' || (x->>'position') || ':' || jsonb_array_length(x->'at'), ', ' order by x->>'name') from jsonb_array_elements(thanks_week('$ANNA')->'list') x")" \
  '^Илья Бармен:bartender:2, Пётр Иванов:manager:2$'
chk "в карточке коллеги: у Ильи 4 (за месяц 3); Пётр — тоже видит; Иван из Порта — not_found, Ирина (руководитель в Порту) — видит" \
  "$(Q "select concat_ws('|', thanks_of('$PETR', '$IEMP')->>'n', thanks_of('$PETR', '$IEMP')->>'month', thanks_of('$IVAN', '$IEMP')->>'error', thanks_of('$IRINA', '$IEMP')->>'n', thanks_of('мусор', '$IEMP')->>'error')")" \
  '^4\|3\|not_found\|4\|auth$'

# ── дни рождения и годовщины ──
cat > "$D/seed42.sql" <<SQL
set client_min_messages = warning;
delete from schedule_venues where restaurant in ('$R0', 'Порт');
insert into schedule_venues (restaurant, venue_key, title, config) values ('$R0', 'main', 'Океан', jsonb_build_object('staff', jsonb_build_array(
  jsonb_build_object('id', 's1', 'name', 'Смирнова Анна', 'pos', 'waiter', 'joined', to_char($LD - interval '3 years', 'DD.MM.YYYY'), 'bday', '01.01'),
  jsonb_build_object('id', 's2', 'name', 'Бармен Илья', 'pos', 'bar', 'bday', to_char($LD, 'DD.MM'), 'joined', to_char($LD + 1, 'DD.MM') || '.2020'),
  jsonb_build_object('id', 's3', 'name', 'Иванов Пётр', 'pos', 'manager', 'joined', to_char($LD, 'YYYY-MM-DD')),
  jsonb_build_object('id', 's4', 'name', 'Уволенный Олег', 'pos', 'waiter', 'bday', to_char($LD, 'DD.MM')))));
insert into schedule_venues (restaurant, venue_key, title, config) values ('Порт', 'main', 'Порт', jsonb_build_object('staff', jsonb_build_array(
  jsonb_build_object('id', 'p1', 'name', 'Петров Иван', 'pos', 'waiter', 'bday', 'boom'))));
-- новичок, пришедший год назад (без «В команде с» в графике): годовщина — от дня прихода
insert into employees (id, name, surname, restaurant, position, is_admin, status) values ('$KEMP', 'Ксения', 'Миронова', '$R0', 'waiter', false, 'active');
update sa_newbies set started_at = (($LD - interval '1 year')::date + time '10:00') at time zone '$TZ0' where emp_id = '$KEMP';
delete from net.sent_log;
update sa_chat_reads set at = now() - interval '1 day';   -- в чате давно не были: бот пишет
SQL
SEED=$($P0 -d $DB -f "$D/seed42.sql" 2>&1); chk "данные — без ошибок" "${SEED:-ok}" '^ok$'
DUE() { PP "select coalesce(string_agg((x->>'name') || ':' || (x->>'kind') || coalesce(':' || (x->>'years'), ''), ',' order by x->>'name', x->>'kind'), '-') from jsonb_array_elements(_sa_ty_due(false, ($LD + time '$1') at time zone '$TZ0', '$R0')) x"; }
chk "окно 9:00–21:00 по часам заведения: 8:59 — рано; 9:00 и 20:59 — Анна (3 года), Илья (день рождения), Ксения (год, по «Новичкам»); 21:00 — поздно" \
  "$(DUE 08:59) $(DUE 09:00) $(DUE 20:59) $(DUE 21:00)" \
  '^- Анна Смирнова:anniv:3,Илья Бармен:bday,Ксения Миронова:anniv:1 Анна Смирнова:anniv:3,Илья Бармен:bday,Ксения Миронова:anniv:1 -$'
chk "просмотр владельца — весь день, в 7 утра тоже, ещё не отмечено" \
  "$(PP "select string_agg((x->>'name') || ':' || (x->>'posted'), ',' order by x->>'name', x->>'kind') from jsonb_array_elements(sa_cheer_preview()) x")" \
  '^Анна Смирнова:false,Илья Бармен:false,Ксения Миронова:false$'
# в Порту что-то сломалось (у Ивана «Д.р.» ломает разбор) — остальным всё равно уходит
PP "alter function _sa_ty_bday(text) rename to _sa_ty_bday0;
    create function _sa_ty_bday(p text) returns int[] language plpgsql immutable as \$f\$
    begin if p = 'boom' then raise exception 'сломалось'; end if; return _sa_ty_bday0(p); end \$f\$" >/dev/null
N1=$(PP "select jsonb_array_length(_sa_ty_due(true, ($LD + time '10:00') at time zone '$TZ0'))")
PP "drop function _sa_ty_bday(text); alter function _sa_ty_bday0(text) rename to _sa_ty_bday" >/dev/null
chk "в 10:00 — три карточки от «Академии» в «Вся команда»; в Порту поломка — предупреждение, остальным не мешает" \
  "$N1 / $(PP "select string_agg(m.body, ' / ' order by m.body) from sa_chat_msgs m where m.emp_id = '' and m.emp_name = 'Академия'")" \
  'Поздравления: заведение Порт — сломалось.* 3 / Анна Смирнова: 3 года с нами / День рождения: Илья Бармен / Ксения Миронова: год с нами$'
chk "карточки: кто, должность, сколько лет и с какого дня, сегодняшний день, пока никто не поздравил" \
  "$(PP "select string_agg(concat_ws(':', m.card->>'t', m.card->>'name', m.card->>'pos', coalesce(m.card->>'years', '-'), coalesce(m.card->>'since', '-') = coalesce(to_char($LD - interval '3 years', 'YYYY-MM-DD'), '-'), (m.card->>'day') = to_char($LD, 'YYYY-MM-DD'), jsonb_array_length(m.card->'greet')), ', ' order by m.card->>'name') from sa_chat_msgs m where m.emp_id = '' and m.card->>'t' in ('bday', 'anniv')")" \
  '^anniv:Анна Смирнова:waiter:3:t:t:0, bday:Илья Бармен:bartender:-:f:t:0, anniv:Ксения Миронова:waiter:1:f:t:0$'
chk "бот — самому: Илье «Илья, с днём рождения», Анне «Анна, сегодня 3 года, как ты с нами»; Ксении без Telegram — нет" \
  "$(lastsent 222 | tr '\n' '/') $(lastsent 111 | tr '\n' '/') $(PP "select count(*) from net.sent_log")" \
  '^Илья, с днём рождения/В «Вся команда» тебя поздравляют\./? Анна, сегодня 3 года, как ты с нами/В «Вся команда» тебя поздравляют\./? 2$'
chk "второй раз в тот же день — ничего; просмотр владельца — уже отмечено" \
  "$(PP "select jsonb_array_length(_sa_ty_due(true, ($LD + time '15:00') at time zone '$TZ0'))") $(PP "select count(*) from sa_chat_msgs where emp_id = ''") $(PP "select string_agg(x->>'posted', ',') from jsonb_array_elements(sa_cheer_preview()) x")" \
  '^0 3 true,true,true$'
BD=$(PP "select msg_id from sa_cheers where emp_id = '$IEMP' and kind = 'bday'")
chk "«Поздравить»: Мария — раз (второй — то же), сам Илья — self, Иван из Порта — not_found; Илья видит, кто поздравил" \
  "$(Q "select concat_ws('|', jsonb_array_length(chat_cheer('$MARIA', ${BD:-0})->'msg'->'card'->'greet'), jsonb_array_length(chat_cheer('$MARIA', ${BD:-0})->'msg'->'card'->'greet'), chat_cheer('$ILYA', ${BD:-0})->>'error', chat_cheer('$IVAN', ${BD:-0})->>'error')") $(PP "select card->'greet'->0->>'n' from sa_chat_msgs where id = ${BD:-0}")" \
  '^1\|1\|self\|not_found Мария Ким$'
chk "«Поздравить» в списке «спасибо» не считается" "$(PP "select count(*) from sa_peer_thanks where msg_id = ${BD:-0}")" '^0$'
PP "update schedule_venues set config = jsonb_set(config, '{staff,2,joined}', to_jsonb(to_char($LD - interval '2 years', 'DD.MM.YYYY'))) where restaurant = '$R0'" >/dev/null
EXP=$(PP "select jsonb_array_length(_sa_ty_due(false, now(), '$R0'))")
chk "приложение открыло чат (cheer_poke): праздники своего заведения — сразу (сколько ушло — столько, сколько было пора)" \
  "$(Q "select cheer_poke('$PETR')->>'n'") $EXP $(Q "select cheer_poke('мусор')->>'error'")" '^([0-9]+) \1 auth$'
PP "delete from vault.secrets_stub; delete from net.sent_log; delete from sa_cheers where emp_id = '$PEMP'; delete from sa_chat_msgs where emp_id = '' and card->>'emp' = '$PEMP'" >/dev/null
chk "бота нет — карточка всё равно есть, сообщений нет" \
  "$(PP "select jsonb_array_length(_sa_ty_due(true, ($LD + time '16:00') at time zone '$TZ0'))") $(PP "select body from sa_chat_msgs where emp_id = '' and card->>'emp' = '$PEMP'") $(PP "select count(*) from net.sent_log")" \
  '^1 Пётр Иванов: 2 года с нами 0$'
PP "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST')" >/dev/null

# ── сверка с приложением (lib/team-warm.js) ──
if command -v node >/dev/null 2>&1 && [ -f "$LIB/team-warm.js" ]; then
  PP "select jsonb_build_object(
      'years', (select jsonb_agg(_sa_ty_years(n) order by n) from generate_series(1, 30) n),
      'sumThx', _sa_ty_sum((select card from sa_chat_msgs where id = ${M1:-0})), 'cardThx', (select card from sa_chat_msgs where id = ${M1:-0}),
      'sumNoText', _sa_ty_sum('{\"t\":\"thx\",\"to\":{\"name\":\"Пётр Иванов\"},\"text\":\"\"}'),
      'cards', (select jsonb_agg(m.card order by m.id) from sa_chat_msgs m where m.emp_id = '' and m.card->>'t' in ('bday', 'anniv')),
      'sums', (select jsonb_agg(_sa_ty_sum(m.card) order by m.id) from sa_chat_msgs m where m.emp_id = '' and m.card->>'t' in ('bday', 'anniv')),
      'dms', (select jsonb_agg(_sa_ty_dm(m.card) order by m.id) from sa_chat_msgs m where m.emp_id = '' and m.card->>'t' in ('bday', 'anniv')),
      'ping', _sa_ty_ping('Анна Смирнова', 'выручил на банкете'), 'ping0', _sa_ty_ping('Мария Ким', ''),
      'bday', (select jsonb_agg(coalesce(to_jsonb(_sa_ty_bday(v)), 'null'::jsonb) order by o) from unnest(array['15.03', ' 1.2 ', '15.03.1990', '31.02', 'abc', '', '29.02', '00.10', '10.13']) with ordinality u(v, o)),
      'joined', (select jsonb_agg(coalesce(to_jsonb(_sa_ty_joined(v)), 'null'::jsonb) order by o) from unnest(array['29.10.2023', '2023-10-29', '31.02.2023', '29.02.2023', '29.02.2024', '1.2.2020', '2023-13-01', 'x']) with ordinality u(v, o)),
      'due', (select jsonb_agg(_sa_ty_due_of(d::date, b, j::date) order by o) from (values ('2026-10-29', '29.10', '2023-10-29', 1), ('2027-02-28', '29.02', '2024-02-29', 2),
              ('2028-02-28', '29.02', '2024-02-29', 3), ('2028-02-29', '29.02', '2024-02-29', 4), ('2026-10-29', '30.10', '2026-10-29', 5), ('2026-10-29', null, '2025-10-29', 6)) v(d, b, j, o)))" > "$D/tw.json"
  JS=$(node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const W = await import('file://$LIB/team-warm.js');
    const x = JSON.parse(readFileSync('$D/tw.json', 'utf8'));
    const out = [];
    const canon = (v) => JSON.stringify(v, (k, y) => (y && typeof y === 'object' && !Array.isArray(y) ? Object.fromEntries(Object.entries(y).sort(([a], [b]) => (a < b ? -1 : 1))) : y));
    const eq = (name, a, b) => out.push((canon(a) === canon(b) ? 'OK ' : 'DIFF ') + name + (canon(a) === canon(b) ? '' : ' js=' + canon(a) + ' pg=' + canon(b)));
    eq('years', Array.from({ length: 30 }, (_, i) => W.yearsWord(i + 1)), x.years);
    eq('sumThx', W.warmCardSum(x.cardThx), x.sumThx);
    eq('sumNoText', W.warmCardSum({ t: 'thx', to: { name: 'Пётр Иванов' }, text: '' }), x.sumNoText);
    eq('sums', x.cards.map(W.warmCardSum), x.sums);
    eq('dms', x.cards.map(W.cheerDm), x.dms);
    eq('ping', [W.thxPing('Анна Смирнова', 'выручил на банкете'), W.thxPing('Мария Ким', '')], [x.ping, x.ping0]);
    eq('bday', ['15.03', ' 1.2 ', '15.03.1990', '31.02', 'abc', '', '29.02', '00.10', '10.13'].map((v) => { const b = W.bdayOf(v); return b ? [b.d, b.m] : null; }), x.bday);
    eq('joined', ['29.10.2023', '2023-10-29', '31.02.2023', '29.02.2023', '29.02.2024', '1.2.2020', '2023-13-01', 'x'].map(W.joinedOf), x.joined);
    eq('due', [['2026-10-29', '29.10', '2023-10-29'], ['2027-02-28', '29.02', '2024-02-29'], ['2028-02-28', '29.02', '2024-02-29'], ['2028-02-29', '29.02', '2024-02-29'], ['2026-10-29', '30.10', '2026-10-29'], ['2026-10-29', null, '2025-10-29']]
      .map(([d, b, j]) => W.cheersDue(d, { bday: b, joined: j })), x.due);
    eq('cut', W.cutText('  выручил   на банкете ', 140), x.cardThx.text);
    process.stdout.write(out.join('\n'));" 2>&1)
  chk "приложение (lib/team-warm.js) пишет те же сводки и сообщения бота и так же читает даты" "$(echo "$JS" | grep -c '^OK ') $(echo "$JS" | grep '^DIFF' | head -3)" '^10 *$'
else
  echo "· node нет — сверку с lib/team-warm.js пропускаю"
fi

# ── pg_cron: расписание раз в 10 минут ──
$P0 -d $DB >/dev/null <<'SQL'
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create or replace function cron.schedule(p_name text, p_sched text, p_cmd text) returns bigint language plpgsql as $f$
declare i bigint;
begin
  insert into cron.job (jobname, schedule, command) values (p_name, p_sched, p_cmd)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid into i;
  return i;
end $f$;
create or replace function cron.unschedule(p_name text) returns boolean language plpgsql as $f$
begin
  delete from cron.job where jobname = p_name;
  if not found then raise exception 'could not find valid entry for job ''%''', p_name; end if;
  return true;
end $f$;
SQL
run $S42; run $S42
chk "с pg_cron: задание «sa-cheer» раз в 10 минут, повторный запуск — одно; «спасибо» и праздники на месте" \
  "$RC $(PP "select count(*) || ' ' || string_agg(schedule || ' ' || command, '') from cron.job where jobname = 'sa-cheer'") $(echo "$OUT42" | grep -o 'расписание: [^·]*·') $(PP "select count(*) from sa_peer_thanks") $(PP "select count(*) from sa_cheers")" \
  '^0 1 \*/10 \* \* \* \* select public\.sa_cheer_tick\(\) расписание: каждые 10 минут \(sa-cheer\) · [0-9]+ [0-9]+$'

# ── права ──
chk "anon: 6 функций этапа — можно; служебные — нельзя" \
  "$(PP "select count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname in ('chat_thanks', 'chat_cheer', 'thanks_peer', 'thanks_week', 'thanks_of', 'cheer_poke')) || ' ' || count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('chat_thanks', 'chat_cheer', 'thanks_peer', 'thanks_week', 'thanks_of', 'cheer_poke')) || ' из ' || count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like '\_sa\_ty\_%' or p.proname like 'sa\_cheer%' or p.proname in ('chat_thanks', 'chat_cheer', 'thanks_peer', 'thanks_week', 'thanks_of', 'cheer_poke'))")" \
  '^6 0 из 19$'
chk "anon: таблицы «спасибо» и праздников закрыты, просмотр и рассылка — тоже" "$(Q "select count(*) from sa_peer_thanks") $(Q "select count(*) from sa_cheers") $(Q "select sa_cheer_preview()") $(Q "select sa_cheer_tick()")" \
  'permission denied.*permission denied.*permission denied.*permission denied'

echo
echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
