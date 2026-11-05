#!/bin/bash
# Этап 48 (v137, Доп. 450): уведомления на телефон (Web Push).
# Поверх базы run25.sh: копия satest48; этап 48 раньше 38 (понятная ошибка) → этапы 26, 31, 32, 34–43 → 48 дважды;
# подписки (проверка, общий телефон, не больше пяти), «чат» без Telegram, куда что уходит (Telegram и телефон, только
# телефон, только Telegram), текст и экран уведомления, ответы вебхуку только в Telegram, число на иконке, функции для
# push-send (ключи, подписки, итог отправки), пробное уведомление, адрес Supabase и ключ anon от руководителя, напоминания
# в Telegram были выключены, отвязка Telegram, shift-reminder, права, повторный этап 39. Отправка — заглушка pg_net
# (net.sent_log, здесь — и с заголовками). Доп. 451: текст как в мессенджере, число новых, кнопки уведомления и ключ
# (ответ, «Прочитано», «Принято», «Иду»), просто текст в Telegram после сообщения о переписке и «Отменить», подпись VAPID
# в базе. Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test48.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest48
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql supabase-stage40-morning.sql supabase-stage41-newbie.sql supabase-stage42-thanks.sql supabase-stage43-gain.sql"
S48=supabase-stage48-push.sql
D=$(mktemp -d); for f in $PRE $MID $S48; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT48=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = $S48 ] && OUT48="$out"; }
for f in $PRE; do run $f; done
NO38=$($P0 -d $DB -f "$D/$S48" 2>&1)
NOFN=$($P0 -d $DB -t -A -c "select count(*) from pg_proc where proname in ('push_status', 'push_subscribe', '_sa_push_route')" 2>&1)
for f in $MID $S48 $S48; do run $f; done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PN() { $P -c "$1" 2>&1; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
REMP=00000000-0000-0000-0000-0000000000a1; MEMP=00000000-0000-0000-0000-0000000000a2; PEMP=00000000-0000-0000-0000-0000000000a3
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5; IREMP=00000000-0000-0000-0000-0000000000b1; VEMP=00000000-0000-0000-0000-0000000000b2
K1=BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4; K2=BTBZMqHH6r4Tts7J_aSIgg
SUB() { echo "'{\"endpoint\": \"https://web.push.apple.com/$1\", \"keys\": {\"p256dh\": \"$K1\", \"auth\": \"$K2\"}}'::jsonb"; }
EP() { echo "https://web.push.apple.com/$1"; }
# журнал: сколько ушло в Telegram этому чату и сколько звонков push-send (с этого номера записи)
mark() { PP "select coalesce(max(id), 0) from net.sent_log"; }
tgn() { PP "select count(*) from net.sent_log where id > $1 and url like 'https://api.telegram.org/%' and body->>'chat_id' = '$2'"; }
pushn() { PP "select count(*) from net.sent_log where id > $1 and url like '%/functions/v1/push-send'"; }
pushitems() { PP "select coalesce(string_agg((i->>'emp') || ':' || (i->>'go'), ',' order by l.id), '') from net.sent_log l, jsonb_array_elements(l.body->'items') i where l.id > $1 and l.url like '%/functions/v1/push-send'"; }
lastitem() { PN "select (body->'items'->0)::text from net.sent_log where url like '%/functions/v1/push-send' order by id desc limit 1"; }

chk "этап 48 раньше этапа 38 — понятная ошибка, функций нет" "$(echo "$NO38" | tr '\n' ' ') · $NOFN" 'Сначала этап 38 \(supabase-stage38-chat.sql\).* · 0$'
chk "этапы 26–43 и 48 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 10 функций, бот пишет и на телефон, адреса Supabase ещё нет, телефонов 0" "$(echo "$OUT48" | grep -o 'уведомления на телефон: .*')" \
  '^уведомления на телефон: 10 функций из 10 · бот: пишет и на телефон · адрес Supabase: нет \(открой в приложении «Команда» → «Сервер»\) · телефонов: 0$'
chk "секрет для push-send — 64 знака, повторный запуск его не меняет" "$(PP "select char_length(value) from sa_settings where key = 'push_secret'")" '^64$'

# журнал pg_net — с заголовками (секрет push-send)
$P0 -d $DB >/dev/null <<'SQL'
alter table net.sent_log add column if not exists headers jsonb;
create or replace function net.http_post(url text, body jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language plpgsql as $f$
declare i bigint;
begin
  insert into net.sent_log (url, body, headers) values (url, body, headers) returning id into i;
  return i;
end $f$;
delete from net.sent_log; delete from sa_notify_prefs;
delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST');
insert into sa_settings (key, value) values ('app_url', 'https://app.example'), ('tg_webhook_secret', 'whsec')
  on conflict (key) do update set value = excluded.value;
delete from sa_settings where key in ('supabase_url', 'anon_key');
SQL
SECRET=$(PP "select value from sa_settings where key = 'push_secret'")

# ── текст и экран уведомления ──
chk "HTML бота → заголовок — первая строка, текст — остальное одной строкой" \
  "$(PP "select _sa_push_text(E'<b>Что дало обучение · октябрь</b>\nДва моря, Океан · 1–15 октября\n\n<b>Чему учились</b>\nУроков: 8, было 7')::text")" \
  '^\{"b": "Два моря, Океан · 1–15 октября Чему учились Уроков: 8, было 7", "m": false, "t": "Что дало обучение · октябрь"\}$'
chk "знаки HTML: &amp; &lt; &gt; &quot; — как есть; пусто — null" \
  "$(PP "select (_sa_push_text('Тест &amp; &lt;вино&gt; &quot;Кьянти&quot;')->>'t') || '|' || coalesce(_sa_push_text(E' \n <b></b> ')::text, 'null') || '|' || (_sa_push_text('Одна строка')->>'b')")" \
  '^Тест & <вино> "Кьянти"\|null\|$'
chk "«Анна С. пишет тебе:» над сообщением — заголовок «Анна С.» (Доп. 451), это сообщение; «Итог:» без текста — как есть" \
  "$(PP "select (_sa_push_text(E'Анна С. пишет тебе:\nМожно поменяться сменой?'))::text || '|' || (_sa_push_text('Итог:')->>'t')")" \
  '^\{"b": "Можно поменяться сменой\?", "m": true, "t": "Анна С\."\}\|Итог:$'
LONGT='Здесь приходят сообщения академии: разминка перед сменой, вопрос дня, лига недели, чат смены. Уроки и тесты ждут в приложении.'
LONGT2='Здесь приходят сообщения академии про разминку перед сменой, вопрос дня, лигу недели и чат смены, а уроки ждут в приложении'
chk "длинная первая строка без «что: …»: заголовок до 80 знаков по слову с «…», продолжение — в начале текста" \
  "$(PP "select char_length(x->>'t') <= 80, x->>'t', x->>'b' from (select _sa_push_text('$LONGT2') x) q" | tr '|' '#')" \
  '^t#Здесь приходят сообщения академии про разминку перед сменой, вопрос дня, лигу…#…недели и чат смены, а уроки ждут в приложении$'
chk "длинный текст — до 240 знаков по слову с «…»" \
  "$(PP "select char_length(x->>'b') <= 240, right(x->>'b', 1), x->>'b' like 'слово слово%' from (select _sa_push_text(E'Заголовок\n' || repeat('слово ', 80)) x) q")" '^t\|…\|t$'
chk "куда открыть: кнопка мини-приложения ?go=, ссылка t.me startapp=go_, «Вопрос дня» — qday, без кнопок — нет" \
  "$(PP "select concat_ws('|', _sa_push_go('[[{\"text\": \"Открыть чат\", \"web_app\": {\"url\": \"https://app.example/?go=chat_5_10\"}}]]'),
     _sa_push_go('[[{\"text\": \"А\", \"callback_data\": \"cg:1\"}, {\"text\": \"Наставник\", \"url\": \"https://t.me/SA_RestaurantBot?startapp=go_mentor\"}]]'),
     _sa_push_go('[[{\"text\": \"А\", \"callback_data\": \"qd:7:0\"}, {\"text\": \"Б\", \"callback_data\": \"qd:7:1\"}]]'),
     coalesce(_sa_push_go('[]'), 'нет'), coalesce(_sa_push_go(null), 'нет'), coalesce(_sa_push_go('{\"a\": 1}'), 'нет'))")" '^chat_5_10\|mentor\|qday\|нет\|нет\|нет$'

# ── Доп. 451: как в мессенджере ──
chk "ответ, упоминание, «всем»: заголовок — чат, текст — «кто: что», это сообщение" \
  "$(PP "select concat_ws('#', x1->>'t', x1->>'b', x2->>'t', x2->>'b', x3->>'t', x3->>'b', x1->>'m') from (select _sa_push_text(E'Пётр О. отвечает тебе в «Вся команда»:\nДа, возьму') x1,
     _sa_push_text(E'Пётр О. упоминает тебя в «Вся команда»:\n@Мария, на банкет нужен ещё один официант') x2, _sa_push_text(E'Мария К. пишет всем в «Старшие»:\n@все собрание в 15:00') x3) q")" \
  '^Вся команда#Пётр О\. отвечает тебе: Да, возьму#Вся команда#Пётр О\.: @Мария, на банкет нужен ещё один официант#Старшие#Мария К\. всем: @все собрание в 15:00#true$'
chk "опоздание, «отдаю смену», «ищем в смену»: сверху — кто что, ниже — подробности с заглавной; короткий вызов — как есть" \
  "$(PP "select concat_ws('#', a->>'t', a->>'b', b->>'t', b->>'b', c->>'t', c->>'b', d->>'t', coalesce(nullif(d->>'b', ''), 'пусто'), a->>'m') from (select
     _sa_push_text(E'Дарья Л. опаздывает на 20 минут: будет в 12:20 (смена с 12:00).\n«автобус сломался»') a,
     _sa_push_text('Пётр О. отдаёт смену: суббота, 8 ноября · день 12:00–20:00. Забрать можно прямо здесь.') b,
     _sa_push_text('Мария К. ищет официанта в смену: пятница, 7 ноября · вечер 18:00–24:00. Выйти можно прямо здесь.') c,
     _sa_push_text('Марк зовёт тебя: к столу 6') d) q")" \
  '^Дарья Л\. опаздывает на 20 минут#Будет в 12:20, смена с 12:00 · «автобус сломался»#Пётр О\. отдаёт смену#Суббота, 8 ноября · день 12:00–20:00#Мария К\. ищет официанта в смену#Пятница, 7 ноября · вечер 18:00–24:00#Марк зовёт тебя: к столу 6#пусто#false$'
chk "длинная первая строка «что: подробности» — заголовок до двоеточия, текст с заглавной (латиница тоже)" \
  "$(PP "select concat_ws('#', x->>'t', x->>'b', y->>'b') from (select _sa_push_text('$LONGT') x, _sa_push_text('Утро руководителя за 5 ноября: stop-лист пуст, опозданий нет, все смены закрыты') y) q")" \
  '^Здесь приходят сообщения академии#Разминка перед сменой, вопрос дня, лига недели, чат смены\. Уроки и тесты ждут в приложении#Stop-лист пуст, опозданий нет, все смены закрыты$'
chk "«3 новых», «21 новое», «11 новых», «101 новое»" "$(PP "select concat_ws('|', _sa_push_new(3), _sa_push_new(21), _sa_push_new(11), _sa_push_new(101))")" '^3 новых\|21 новое\|11 новых\|101 новое$'
chk "кнопки уведомления: у сообщения — «Ответить» и «Прочитано»; «Забрать», «Иду», «Принято» — не больше двух; опрос и вопрос дня — нет" \
  "$(PP "select concat_ws('#', _sa_push_acts(null, 'chat_5_77', true)::text, _sa_push_acts('[[{\"text\": \"\", \"callback_data\": \"ct:1\"}, {\"text\": \"Иду\", \"callback_data\": \"cg:2\"}, {\"text\": \"Принято\", \"callback_data\": \"cl:3\"}]]', null, false)::text,
     coalesce(_sa_push_acts('[[{\"text\": \"А\", \"callback_data\": \"qd:7:0\"}, {\"text\": \"1\", \"callback_data\": \"cv:9:0\"}]]', 'qday', false)::text, 'нет'), coalesce(_sa_push_acts(null, 'chat_5_77', false)::text, 'нет'))")" \
  '^\[\{"a": "reply", "c": 5, "t": "Ответить", "id": 77\}, \{"a": "read", "c": 5, "t": "Прочитано", "id": 77\}\]#\[\{"a": "ct", "t": "Забрать", "id": 1\}, \{"a": "cg", "t": "Иду", "id": 2\}\]#нет#нет$'

# ── подписка ──
chk "без входа — auth; Анна: ключа ещё нет, телефонов 0, Telegram и телефон, Telegram подключён" \
  "$(Q "select push_status('nope')->>'error'") $(Q "select concat_ws('|', coalesce(x->>'key', 'нет'), x->>'n', x->>'here', x->>'channel', x->>'tg', x->>'tg_linked', x->>'pseudo', x->>'bot', coalesce(x->>'srv', 'нет')) from push_status('$ANNA') x")" \
  '^auth нет\|0\|false\|both\|true\|true\|false\|true\|нет$'
chk "плохая подписка — bad_sub (http, короткие ключи, не объект)" \
  "$(Q "select concat_ws('|', push_subscribe('$ANNA', '{\"endpoint\": \"http://x.example/abcdefgh\", \"keys\": {\"p256dh\": \"$K1\", \"auth\": \"$K2\"}}')->>'error',
     push_subscribe('$ANNA', '{\"endpoint\": \"https://web.push.apple.com/x\", \"keys\": {\"p256dh\": \"abc\", \"auth\": \"$K2\"}}')->>'error', push_subscribe('$ANNA', '[1]')->>'error', push_subscribe('nope', $(SUB a))->>'error')")" \
  '^bad_sub\|bad_sub\|bad_sub\|auth$'
chk "Анна включила на телефоне: 1 телефон, этот; ещё раз тот же — по-прежнему 1" \
  "$(Q "select x->>'n' || ' ' || (x->>'here') from push_subscribe('$ANNA', $(SUB anna-1), 'iPhone') x") $(Q "select x->>'n' from push_subscribe('$ANNA', $(SUB anna-1), 'iPhone') x") $(Q "select (push_status('$ANNA', '$(EP anna-1)')->>'here') || ' ' || (push_status('$ANNA', '$(EP other)')->>'here')")" \
  '^1 true 1 true false$'
chk "у Анны Telegram есть — «чата» без Telegram нет" "$(PP "select string_agg(chat_id::text, ',') from tg_links where emp_id = '$AEMP'")" '^111$'
R=$(Q "select push_subscribe('$IVAN', $(SUB ivan-1))")
PSI=$(PP "select chat_id from tg_links where emp_id = '$VEMP'")
chk "Иван без Telegram: «чат» без Telegram — номер ниже −9·10¹⁵, напоминания включены, заведение и имя" \
  "$(echo "$R" | grep -o '"pseudo": true') $(echo "$R" | grep -o '"tg_linked": false') $(PP "select (chat_id <= -9000000000000001) || '|' || remind || '|' || restaurant || '|' || full_name || '|' || (tg_user->>'push') from tg_links where emp_id = '$VEMP'") $(PP "select pseudo = $PSI from sa_push_people where emp_id = '$VEMP'")" \
  '^"pseudo": true "tg_linked": false true\|true\|Порт\|Иван Петров\|true t$'
chk "рассылки бота видят Ивана: _sa_tg_chat (вопрос дня) — его «чат»" "$(PP "select _sa_tg_chat('$VEMP', 'qday') = $PSI")" '^t$'

# ── куда что уходит ──
M=$(mark); PP "select sa_tg_send(111, E'Через час смена: Вечер\nРазминка до смены: 2 минуты', 'Разминка', 'warmup')" >/dev/null
chk "адреса Supabase нет: в Telegram ушло, на телефон — нет, ошибка no_url" "$(tgn $M 111) $(pushn $M) $(PP "select value from sa_settings where key = 'push_err'")" '^1 0 no_url$'
PP "insert into sa_settings (key, value) values ('supabase_url', 'https://abcdefgh.supabase.co') on conflict (key) do update set value = excluded.value" >/dev/null
M=$(mark); PP "select sa_tg_send(111, E'Через час смена: Вечер\nРазминка до смены: 2 минуты', 'Разминка', 'warmup')" >/dev/null
chk "Telegram и телефон: в Telegram ушло, push-send позвали с секретом" \
  "$(tgn $M 111) $(pushn $M) $(PP "select (headers->>'x-sa-push' = '$SECRET') || ' ' || coalesce(headers->>'Authorization', 'нет') from net.sent_log where id > $M and url = 'https://abcdefgh.supabase.co/functions/v1/push-send'")" '^1 1 true нет$'
chk "что придёт: Анне, заголовок, текст, экран разминки, число на иконке" "$(lastitem)" \
  "^\{\"b\": \"Разминка до смены: 2 минуты\", \"t\": \"Через час смена: Вечер\", \"go\": \"warmup\", \"emp\": \"$AEMP\", \"badge\": 0\}$"
M=$(mark); PP "select sa_tg_send($PSI, 'Иван, тебе посадили гостей за стол 4', 'Открыть', 'seat')" >/dev/null
chk "Иван без Telegram: только на телефон, в Telegram — ничего" "$(PP "select count(*) from net.sent_log where id > $M and url like 'https://api.telegram.org/%'") $(pushitems $M)" "^0 $VEMP:seat\$"
chk "только телефон без телефона — no_subs; чепуха — bad_channel" "$(Q "select push_channel('$ILYA', 'push')->>'error'") $(Q "select push_channel('$ANNA', 'всё')->>'error'")" '^no_subs bad_channel$'
chk "Анна: только телефон" "$(Q "select push_channel('$ANNA', 'push')->>'channel'")" '^push$'
M=$(mark); PP "select sa_tg_send(111, 'Только телефон')" >/dev/null
chk "только телефон: Telegram молчит, на телефон ушло" "$(tgn $M 111) $(pushitems $M)" "^0 $AEMP:\$"
Q "select push_channel('$ANNA', 'tg')" >/dev/null
M=$(mark); PP "select sa_tg_send(111, 'Только Telegram')" >/dev/null
chk "только Telegram: на телефон — нет" "$(tgn $M 111) $(pushn $M)" '^1 0$'
Q "select push_channel('$ANNA', 'both')" >/dev/null
M=$(mark); PP "select sa_tg_api('sendMessage', jsonb_build_object('chat_id', 111, 'text', E'Вопрос дня · Бар\n\nЧто такое негрони?\n\nА. Коктейль\nБ. Вино', 'reply_markup', jsonb_build_object('inline_keyboard', '[[{\"text\": \"А\", \"callback_data\": \"qd:7:0\"}, {\"text\": \"Б\", \"callback_data\": \"qd:7:1\"}]]'::jsonb)))" >/dev/null
chk "вопрос дня (sa_tg_api): и в Telegram, и на телефон, экран — qday; текст без кнопок" \
  "$(tgn $M 111) $(pushitems $M) $(lastitem | grep -o '"b": "[^"]*"')" "^1 $AEMP:qday \"b\": \"Что такое негрони\? А\. Коктейль Б\. Вино\"\$"
M=$(mark); PP "select sa_tg_api('editMessageText', '{\"chat_id\": 111, \"message_id\": 5, \"text\": \"Правка\"}'), sa_tg_api('answerCallbackQuery', '{\"callback_query_id\": \"1\"}')" >/dev/null
chk "правка сообщения и ответ на нажатие — только Telegram" "$(tgn $M 111) $(pushn $M)" '^1 0$'
M=$(mark); PP "select _sa_chat_tg(111, E'Илья в «Вся команда»\nЛайм закончился', '[[{\"text\": \"Открыть чат\", \"web_app\": {\"url\": \"https://app.example/?go=chat_5_10\"}}]]')" >/dev/null
chk "сообщение чата (_sa_chat_tg): на телефон — с экраном переписки" "$(tgn $M 111) $(pushitems $M)" "^1 $AEMP:chat_5_10\$"
chk "shift-reminder: sa_push_tg — на телефон и писать ли в Telegram (Анна — да, Иван — нет)" \
  "$(PP "select (sa_push_tg(111, 'Завтра смена', 'schedule')->>'tg') || ' ' || (sa_push_tg($PSI, 'Завтра смена', 'schedule')->>'tg')") $(pushitems $(( $(mark) - 2 )))" \
  "^true false $AEMP:schedule,$VEMP:schedule\$"

# ── вебхук: ответ человеку на его же сообщение — только Telegram ──
M=$(mark); R=$(PP "select sa_tg_update('whsec', '{\"update_id\": 1, \"message\": {\"message_id\": 9, \"chat\": {\"id\": 111, \"type\": \"private\"}, \"from\": {\"id\": 111}, \"text\": \"/start\"}}')")
chk "/start от Анны: ответ в Telegram, на телефон — нет; чужой секрет — secret" "$R $(tgn $M 111) $(pushn $M) $(PP "select sa_tg_update('nope', '{}')->>'error'")" '"start": true.* 1 0 secret$'
M=$(mark)
$P0 -d $DB >/dev/null <<SQL
begin;
select set_config('sa.tg_from', '111', true);
select _sa_push_route(111, 'Ответ Анне'), _sa_push_route($PSI, 'Ивану в это время');
commit;
SQL
chk "в событии от Анны: Анне — без телефона, Ивану — на телефон; после события — как обычно" "$(pushitems $M) $(PP "select _sa_push_route(111, 'потом')") $(pushn $M)" "^$VEMP: t 2\$"

# ── число на иконке: непрочитанное в чатах ──
Q "select chat_list('$ANNA')" >/dev/null; Q "select chat_list('$ILYA')" >/dev/null
TEAM=$(PP "select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'team'")
Q "select chat_send('$ILYA', $TEAM, 'Лайм закончился')" >/dev/null; Q "select chat_send('$PETR', $TEAM, 'Иду на склад')" >/dev/null
chk "число на иконке у Анны — как непрочитанное в чатах (2), у Ильи — 1" "$(PP "select _sa_push_badge('$AEMP') || ' ' || _sa_push_badge('$IEMP')") $(Q "select chat_unread('$ANNA')->>'unread'")" '^2 1 2$'
M=$(mark); PP "select sa_tg_send(111, 'Проверка числа')" >/dev/null
chk "в уведомлении — то же число" "$(lastitem | grep -o '"badge": [0-9]*')" '^"badge": 2$'

# ── Доп. 451: уведомление о сообщении, кнопки, ответ из уведомления ──
lastj() { PP "select $1 from (select body->'items'->0 as i from net.sent_log where url like '%/functions/v1/push-send' order by id desc limit 1) q"; }
LM=$(PP "select max(id) from sa_chat_msgs where chat_id = $TEAM and emp_id = '$IEMP'")
M=$(mark); PP "select _sa_chat_tg(111, E'Илья Б. упоминает тебя в «Вся команда»:\n@Анна, лайм закончился', '[[{\"text\": \"Открыть чат\", \"web_app\": {\"url\": \"https://app.example/?go=chat_${TEAM}_${LM}\"}}]]')" >/dev/null
chk "сообщение из переписки: заголовок — чат и сколько новых, текст — «кто: что», c — чат, касание — к ответу (…_r), кнопки и ключ" \
  "$(lastj "concat_ws('#', i->>'t', i->>'b', i->>'c', i->>'go', i->'a', i->>'k' ~ '^[0-9a-f]{64}$')")" \
  "^Вся команда · 2 новых#Илья Б\.: @Анна, лайм закончился#$TEAM#chat_${TEAM}_${LM}_r#\[\{\"a\": \"reply\", \"t\": \"Ответить\"\}, \{\"a\": \"read\", \"t\": \"Прочитано\"\}\]#t\$"
KN=$(lastj "i->>'k'")
chk "ключ — у Анны, «Ответить» знает чат и сообщение; Telegram запомнил, о какой переписке писал бот" \
  "$(PP "select concat_ws('|', emp_id, acts->0->>'c', acts->0->>'id', used_at is null) from sa_push_acts where k = '$KN'") $(PP "select chat_id || '|' || msg_id from sa_push_tglast where tg = 111")" \
  "^$AEMP\|$TEAM\|$LM\|t $TEAM\|$LM\$"
chk "кнопка: чужой ключ — bad_key, нет такого — gone, не та кнопка — bad_action, пустой ответ — empty (ключ не потрачен)" \
  "$(PP "select concat_ws('|', sa_push_act('abc', 'reply', 'x')->>'error', sa_push_act(repeat('0', 64), 'reply', 'x')->>'error', sa_push_act('$KN', 'ct', 'x')->>'error', sa_push_act('$KN', 'reply', '   ')->>'error')") $(PP "select used_at is null from sa_push_acts where k = '$KN'")" \
  '^bad_key\|gone\|bad_action\|empty t$'
R=$(PP "select sa_push_act('$KN', 'reply', 'Сейчас принесу со склада')")
NEWID=$(PP "select max(id) from sa_chat_msgs where chat_id = $TEAM and emp_id = '$AEMP'")
chk "«Ответить» в уведомлении: сообщение Анны — ответом на сообщение Ильи, на телефоне — «Ушло в «Вся команда».»; ещё раз — used" \
  "$(echo "$R" | grep -oE '"text": "[^"]*"') $(PP "select body || '|' || coalesce(reply_to::text, 'нет') from sa_chat_msgs where id = $NEWID") $(PP "select sa_push_act('$KN', 'reply', 'ещё')->>'error'")" \
  "^\"text\": \"Ушло в «Вся команда»\.\" Сейчас принесу со склада\|$LM used\$"
Q "select chat_send('$ILYA', $TEAM, 'Спасибо!')" >/dev/null
M=$(mark); PP "select _sa_chat_tg(111, E'Илья Б. пишет всем в «Вся команда»:\n@все склад закрыт', '[[{\"text\": \"Открыть чат\", \"web_app\": {\"url\": \"https://app.example/?go=chat_${TEAM}_${LM}\"}}]]')" >/dev/null
KN2=$(lastj "i->>'k'")
AT0=$(PP "select at from sa_chat_reads where chat_id = $TEAM and emp_id = '$AEMP'")
chk "«Прочитано»: в переписке всё прочитано, «сейчас в чате» не тронуто (следующее придёт уведомлением)" \
  "$(PP "select _sa_chat_unread($TEAM, '$AEMP')") $(PP "select sa_push_act('$KN2', 'read')->>'ok'") $(PP "select _sa_chat_unread($TEAM, '$AEMP')") $(PP "select at = '$AT0' from sa_chat_reads where chat_id = $TEAM and emp_id = '$AEMP'")" '^1 true 0 t$'

# ── Доп. 451: кнопки карточек — «Принято» на опоздание, «Иду» на вызов ──
LATE=$(PP "insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card) values ($TEAM, '$AEMP', 'Анна Смирнова', 'Два моря, Океан', 'Опаздываю на 20 минут', 'card', '{\"t\": \"late\", \"eta\": \"12:20\"}') returning id")
PP "insert into sa_push_acts (k, emp_id, acts) values (repeat('a', 64), '$MEMP', '[{\"a\": \"cl\", \"t\": \"Принято\", \"id\": $LATE}]'), (repeat('b', 64), '$IEMP', '[{\"a\": \"cl\", \"t\": \"Принято\", \"id\": $LATE}]')" >/dev/null
chk "«Принято» (старшая): опоздание принято, на телефоне — «Принято.»; бармену — not_allowed" \
  "$(PP "select sa_push_act(repeat('a', 64), 'cl')->>'text'") $(PP "select card->'ok'->>'id' from sa_chat_msgs where id = $LATE") $(PP "select sa_push_act(repeat('b', 64), 'cl')->>'error'")" "^Принято\. $MEMP not_allowed\$"
CALL=$(PP "insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, call) values ($TEAM, '$MEMP', 'Мария Ким', 'Два моря, Океан', '', 'call', '{\"who\": \"person\", \"why\": \"table\", \"table\": \"6\", \"going\": []}') returning id")
PP "insert into sa_push_acts (k, emp_id, acts) values (repeat('c', 64), '$AEMP', '[{\"a\": \"cg\", \"t\": \"Иду\", \"id\": $CALL}]')" >/dev/null
M=$(mark)
chk "«Иду» на вызов: Анна идёт, на телефоне — «Ты идёшь.», позвавшей — бот" \
  "$(PP "select sa_push_act(repeat('c', 64), 'cg')->>'text'") $(PP "select call->'going'->0->>'id' from sa_chat_msgs where id = $CALL") $(PP "select count(*) from net.sent_log where id > $M and body->>'text' like 'Анна идёт: к столу 6%'")" "^Ты идёшь\. $AEMP [12]\$"
PP "insert into sa_push_acts (k, emp_id, acts, created_at) values (repeat('d', 64), '$AEMP', '[{\"a\": \"read\", \"t\": \"Прочитано\", \"id\": 1, \"c\": $TEAM}]', now() - interval '4 days')" >/dev/null
chk "ключ старше трёх дней — gone; sa_push_done убирает такие" \
  "$(PP "select sa_push_act(repeat('d', 64), 'read')->>'error'") $(PP "select sa_push_done('$SECRET', '[]')->>'ok'") $(PP "select count(*) from sa_push_acts where k = repeat('d', 64)")" '^gone true 0$'

# ── Доп. 451: Telegram — просто текст после сообщения о переписке ──
M=$(mark); PP "select sa_tg_send(111, E'Через час смена: Вечер\nРазминка до смены: 2 минуты', 'Разминка', 'warmup')" >/dev/null
chk "последнее сообщение бота — не о переписке (разминка): просто текст — снова подсказка, в чат не уходит" \
  "$(PP "select count(*) from sa_push_tglast where tg = 111") $(PP "select sa_tg_update('whsec', '{\"update_id\": 2, \"message\": {\"message_id\": 20, \"chat\": {\"id\": 111, \"type\": \"private\"}, \"from\": {\"id\": 111}, \"text\": \"Ок\"}}')->>'hint'") $(PP "select count(*) from sa_chat_msgs where body = 'Ок'")" '^0 true 0$'
PP "insert into sa_push_tglast (tg, chat_id, msg_id, at) values (111, $TEAM, $LM, now()) on conflict (tg) do update set chat_id = excluded.chat_id, msg_id = excluded.msg_id, at = now()" >/dev/null
M=$(mark); R=$(PP "select sa_tg_update('whsec', '{\"update_id\": 3, \"message\": {\"message_id\": 21, \"chat\": {\"id\": 111, \"type\": \"private\"}, \"from\": {\"id\": 111}, \"text\": \"Буду через 5 минут\"}}')")
QID=$(PP "select max(id) from sa_chat_msgs where chat_id = $TEAM and emp_id = '$AEMP' and kind = 'text'")
chk "просто текст боту (меньше 30 минут после сообщения о переписке): в «Вся команда» ответом на сообщение Ильи; бот — «Ушло…», «Отменить», «Открыть чат»; на телефон — нет" \
  "$(echo "$R" | grep -o '"quick": true') $(PP "select body || '|' || coalesce(reply_to::text, 'нет') from sa_chat_msgs where id = $QID") $(PP "select (body->>'text') || '|' || (body->'reply_markup'->'inline_keyboard'->0->0->>'callback_data') || '|' || (body->'reply_markup'->'inline_keyboard'->0->1->>'text') || '|' || (body->'reply_parameters'->>'message_id') from net.sent_log where id > $M and url like 'https://api.telegram.org/%sendMessage' and body->>'chat_id' = '111'") $(pushitems $M | grep -c "$AEMP")" \
  "^\"quick\": true Буду через 5 минут\|$LM Ушло в «Вся команда»\.\|cu:$QID\|Открыть чат\|21 0\$"
chk "«смена» и /start — как раньше, в чат не уходят" \
  "$(PP "select sa_tg_update('whsec', '{\"update_id\": 4, \"message\": {\"message_id\": 22, \"chat\": {\"id\": 111, \"type\": \"private\"}, \"from\": {\"id\": 111}, \"text\": \"смена\"}}')->>'shifts'") $(PP "select sa_tg_update('whsec', '{\"update_id\": 5, \"message\": {\"message_id\": 23, \"chat\": {\"id\": 111, \"type\": \"private\"}, \"from\": {\"id\": 111}, \"text\": \"/start\"}}')->>'start'") $(PP "select count(*) from sa_chat_msgs where chat_id = $TEAM and body in ('смена', '/start')")" '^true true 0$'
U='{"update_id": 6, "callback_query": {"id": "cb1", "from": {"id": 111}, "data": "cu:'$QID'", "message": {"message_id": 30, "chat": {"id": 111}, "text": "Ушло в «Вся команда»."}}}'
M=$(mark)
chk "«Отменить»: сообщение стёрто, у бота — «Отменено: в чат не ушло.» без кнопок; ещё раз — нет" \
  "$(PP "select sa_tg_update('whsec', '$U')->>'undo'") $(PP "select deleted || '|' || body from sa_chat_msgs where id = $QID") $(PP "select string_agg(coalesce(body->>'text', '') || '/' || coalesce(body->>'callback_query_id', '') || '/' || coalesce(jsonb_array_length(body->'reply_markup'->'inline_keyboard')::text, ''), ';' order by id) from net.sent_log where id > $M") $(PP "select sa_tg_update('whsec', '$U')->>'undo'")" \
  "^true true\| Отменено: в чат не ушло\.//0;Отменено/cb1/ false\$"
chk "«Отменить» чужое — нельзя" \
  "$(PP "select sa_tg_update('whsec', '{\"update_id\": 7, \"callback_query\": {\"id\": \"cb2\", \"from\": {\"id\": 111}, \"data\": \"cu:$LM\"}}')->>'undo'") $(PP "select deleted from sa_chat_msgs where id = $LM")" '^false f$'
PP "update sa_push_tglast set at = now() - interval '31 minutes' where tg = 111" >/dev/null
chk "через 30 минут — как раньше: подсказка, в чат не уходит" \
  "$(PP "select sa_tg_update('whsec', '{\"update_id\": 8, \"message\": {\"message_id\": 24, \"chat\": {\"id\": 111, \"type\": \"private\"}, \"from\": {\"id\": 111}, \"text\": \"Привет\"}}')->>'hint'") $(PP "select count(*) from sa_chat_msgs where chat_id = $TEAM and body = 'Привет'")" '^true 0$'

# ── для функции push-send ──
chk "sa_push_take: чужой секрет — secret; свой — подписки Анны и Ивана, ключей ещё нет, sub — адрес приложения" \
  "$(PP "select sa_push_take('nope', array['$AEMP'])->>'error'") $(PP "select concat_ws('|', coalesce(x->>'pub', 'нет'), coalesce(x->>'priv', 'нет'), x->>'sub', (select string_agg((s->>'emp') || ':' || right(s->>'endpoint', 6), ',') from jsonb_array_elements(x->'subs') s)) from sa_push_take('$SECRET', array['$AEMP', '$VEMP', 'nobody']) x")" \
  "^secret нет\|нет\|https://app\.example\|$AEMP:anna-1,$VEMP:ivan-1\$"
PUB=BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8; PRIV=yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw
chk "sa_push_keys: плохие — bad_keys; первые — записаны; вторые — остаются первые; ключ виден приложению" \
  "$(PP "select sa_push_keys('abc', 'def')->>'error'") $(PP "select sa_push_keys('$PUB', '$PRIV')->>'pub' = '$PUB'") $(PP "select sa_push_keys('$K1', '$PRIV')->>'pub' = '$PUB'") $(Q "select push_status('$ANNA')->>'key' = '$PUB'") $(PP "select value = '$PRIV' from sa_settings where key = 'push_vapid_priv'")" \
  '^bad_keys t t t t$'
chk "подпись VAPID (Доп. 451): в базе нет — {}; push-send прислал — хранится и отдаётся; не объект — не трогаем" \
  "$(PP "select sa_push_take('$SECRET', null)->'jwt'") $(PP "select sa_push_done('$SECRET', '[]', '{\"https://web.push.apple.com\": {\"t\": \"x.y.z\", \"at\": 1700000000, \"k\": \"BP4\"}}')->>'ok'") $(PP "select sa_push_take('$SECRET', null)->'jwt'->'https://web.push.apple.com'->>'t'") $(PP "select sa_push_done('$SECRET', '[]', '[1]')->>'ok'") $(PP "select sa_push_take('$SECRET', null)->'jwt'->'https://web.push.apple.com'->>'at'")" \
  '^\{\} true x\.y\.z true 1700000000$'
SA=$(PP "select id from sa_push_subs where endpoint = '$(EP anna-1)'"); SV=$(PP "select id from sa_push_subs where endpoint = '$(EP ivan-1)'")
chk "sa_push_done: чужой секрет — secret; доставлено Анне, подписки Ивана больше нет (410)" \
  "$(PP "select sa_push_done('nope', '[]')->>'error'") $(PP "select concat_ws('|', x->>'sent', x->>'gone', x->>'failed') from sa_push_done('$SECRET', '[{\"id\": $SA, \"ok\": true}, {\"id\": $SV, \"gone\": true, \"code\": 410}, {\"id\": \"x\"}]') x")" '^secret 1\|1\|0$'
chk "у Ивана подписки нет — «чата» без Telegram нет; у Анны — время доставки; push_ok_at" \
  "$(PP "select count(*) from sa_push_subs where emp_id = '$VEMP'") $(PP "select count(*) from tg_links where emp_id = '$VEMP'") $(PP "select ok_at is not null and fails = 0 from sa_push_subs where id = $SA") $(PP "select count(*) from sa_settings where key = 'push_ok_at'")" '^0 0 t 1$'
M=$(mark); PP "select sa_tg_send($PSI, 'Ивану уже некуда')" >/dev/null
chk "старый «чат» Ивана — ни в Telegram, ни на телефон" "$(PP "select count(*) from net.sent_log where id > $M")" '^0$'
chk "неудача: у подписки — ошибка с кодом, в настройках — последняя ошибка" \
  "$(PP "select x->>'failed' from sa_push_done('$SECRET', '[{\"id\": $SA, \"ok\": false, \"code\": 403, \"err\": \"BadJwtToken\"}]') x") $(PP "select fails || '|' || err from sa_push_subs where id = $SA") $(PP "select value from sa_settings where key = 'push_err'")" \
  '^1 1\|BadJwtToken \(код 403\) BadJwtToken \(код 403\)$'

# ── пробное уведомление ──
chk "без телефона — no_subs; Анна — ушло, заголовок «Уведомления работают», экран «Напоминания»; сразу ещё раз — often" \
  "$(Q "select push_test('$ILYA')->>'error'") $(Q "select push_test('$ANNA')->>'ok'") $(lastitem | grep -oE '"t": "[^"]*"|"go": "[^"]*"' | tr '\n' ' ')$(Q "select push_test('$ANNA')->>'error'")" \
  '^no_subs true "t": "Уведомления работают" "go": "remind" often$'

# ── руководитель: сервер, адрес Supabase и ключ anon ──
JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImV4cCI6MTk5OTk5OTk5OX0.abcdefghijklmnopqrstuvwxyz012345
chk "сотрудник не меняет адрес и ключ; у руководителя — сервер: телефонов, людей, «чатов» без Telegram, ошибка" \
  "$(Q "select coalesce(push_status('$ANNA', null, 'https://evilevil.supabase.co', '$JWT')->>'srv', 'нет')") $(PP "select value from sa_settings where key = 'supabase_url'") $(PP "select count(*) from sa_settings where key = 'anon_key'") $(Q "select concat_ws('|', x->'srv'->>'subs', x->'srv'->>'people', x->'srv'->>'pseudo', x->'srv'->>'url', x->'srv'->>'err') from push_status('$ROMAN') x")" \
  '^нет https://abcdefgh\.supabase\.co 0 1\|1\|0\|true\|BadJwtToken \(код 403\)$'
Q "select push_status('$ROMAN', null, 'https://example.com', 'not-a-jwt')" >/dev/null
chk "руководитель: чужой адрес и не JWT — не записываются" "$(PP "select value from sa_settings where key = 'supabase_url'") $(PP "select count(*) from sa_settings where key = 'anon_key'")" '^https://abcdefgh\.supabase\.co 0$'
Q "select push_status('$ROMAN', null, 'https://gvxhgdynjuaisswplroh.supabase.co/', '$JWT')" >/dev/null
M=$(mark); PP "select sa_tg_send(111, 'С ключом anon')" >/dev/null
chk "руководитель передал адрес и ключ anon: push-send — по новому адресу, с ключом" \
  "$(PP "select url || ' ' || (headers->>'Authorization' = 'Bearer $JWT') || ' ' || (headers->>'apikey' = '$JWT') from net.sent_log where id > $M and url like '%push-send'")" '^https://gvxhgdynjuaisswplroh\.supabase\.co/functions/v1/push-send true true$'

# ── общий телефон и пять телефонов ──
R=$(Q "select push_subscribe('$MARIA', $(SUB anna-1))")
chk "Мария вошла на телефоне Анны: подписка — у Марии, у Анны телефонов 0, выбор сброшен" \
  "$(echo "$R" | grep -o '"here": true') $(Q "select push_status('$ANNA')->>'n'") $(PP "select emp_id from sa_push_subs where endpoint = '$(EP anna-1)'")" "^\"here\": true 0 $MEMP\$"
Q "select push_subscribe('$IVAN', $(SUB ivan-2))" >/dev/null
R=$(Q "select push_subscribe('$IRINA', $(SUB ivan-2))")
chk "Ирина на телефоне Ивана: у Ивана телефонов нет — «чата» без Telegram нет; у Ирины — свой" \
  "$(PP "select count(*) from tg_links where emp_id = '$VEMP'") $(echo "$R" | grep -o '"pseudo": true') $(PP "select (chat_id <= -9000000000000001)::text || '|' || restaurant from tg_links where emp_id = '$IREMP'")" '^0 "pseudo": true true\|Порт$'
for i in 2 3 4 5 6; do Q "select push_subscribe('$MARIA', $(SUB maria-$i))" >/dev/null; done
chk "у Марии шесть телефонов — остаются пять новых (первый — телефон Анны — ушёл)" \
  "$(Q "select push_status('$MARIA')->>'n'") $(PP "select count(*) from sa_push_subs where endpoint = '$(EP anna-1)'")" '^5 0$'

# ── напоминания в Telegram были выключены ──
Q "select tg_set('$PETR', false)" >/dev/null
R=$(Q "select push_subscribe('$PETR', $(SUB petr-1))")
chk "у Петра Telegram был выключен, включил телефон: только телефон, напоминания в Telegram снова включены" \
  "$(echo "$R" | grep -oE '"channel": "[a-z]+"') $(PP "select remind from tg_links where emp_id = '$PEMP'") $(PP "select tg_off from sa_push_people where emp_id = '$PEMP'")" '^"channel": "push" t t$'
M=$(mark); PP "select sa_tg_send(444, 'Петру')" >/dev/null
chk "Петру: в Telegram — нет, на телефон — да" "$(tgn $M 444) $(pushitems $M)" "^0 $PEMP:\$"
Q "select push_unsubscribe('$PETR', '$(EP petr-1)')" >/dev/null
chk "выключил телефон: Telegram снова молчит, как было; выбор — Telegram и телефон" \
  "$(PP "select remind from tg_links where emp_id = '$PEMP'") $(PP "select channel || '|' || tg_off from sa_push_people where emp_id = '$PEMP'") $(Q "select push_status('$PETR')->>'tg'")" '^f both\|false false$'
Q "select push_subscribe('$PETR', $(SUB petr-2))" >/dev/null; Q "select push_channel('$PETR', 'both')" >/dev/null; Q "select push_unsubscribe('$PETR', '$(EP petr-2)')" >/dev/null
chk "включил телефон, сам выбрал «Telegram и телефон», выключил телефон — Telegram остаётся включён" "$(PP "select remind from tg_links where emp_id = '$PEMP'")" '^t$'

# ── отвязка Telegram при включённом телефоне ──
Q "select push_subscribe('$ANNA', $(SUB anna-2))" >/dev/null
Q "select tg_unlink('$ANNA')" >/dev/null
chk "Анна отвязала Telegram, телефон включён: «чат» без Telegram, напоминания включены" \
  "$(PP "select (chat_id <= -9000000000000001)::text || '|' || remind from tg_links where emp_id = '$AEMP'") $(Q "select (x->>'pseudo') || '|' || (x->>'tg_linked') from push_status('$ANNA') x")" '^true\|true true\|false$'
PSA=$(PP "select chat_id from tg_links where emp_id = '$AEMP'")
M=$(mark); PP "select sa_tg_send($PSA, 'Анне без Telegram')" >/dev/null
chk "теперь Анне — только на телефон" "$(PP "select count(*) from net.sent_log where id > $M and url like 'https://api.telegram.org/%'") $(pushitems $M)" "^0 $AEMP:\$"
PP "insert into tg_links (emp_id, chat_id, tg_user, restaurant, full_name, remind, updated_at) values ('$AEMP', 111, '{\"id\": 111}', 'Два моря, Океан', 'Анна Смирнова', true, now())
    on conflict (emp_id) do update set chat_id = excluded.chat_id, tg_user = excluded.tg_user, remind = excluded.remind, updated_at = now()" >/dev/null
chk "снова связала Telegram (как tg_link): номер — настоящий, «чата» без Telegram нет" \
  "$(PP "select string_agg(chat_id::text, ',') from tg_links where emp_id = '$AEMP'") $(Q "select (x->>'pseudo') || '|' || (x->>'tg_linked') || '|' || (x->>'n') from push_status('$ANNA') x")" '^111 false\|true\|1$'

# ── двадцать неудач подряд ──
SA2=$(PP "select id from sa_push_subs where endpoint = '$(EP anna-2)'")
PP "update sa_push_subs set fails = 19 where id = $SA2" >/dev/null
chk "двадцатая неудача подряд — подписка уходит" "$(PP "select sa_push_done('$SECRET', '[{\"id\": $SA2, \"code\": 500}]')->>'failed'") $(PP "select count(*) from sa_push_subs where id = $SA2")" '^1 0$'

# ── права ──
chk "anon: 5 функций приложения — можно; остальные этапа — нельзя" \
  "$(PP "select count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname like 'push\_%') || ' ' || count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname not like 'push\_%') || ' из ' || count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like '\_sa\_push\_%' or p.proname like 'sa\_push\_%' or p.proname like 'push\_%' or p.proname in ('sa_tg_send', 'sa_tg_api', '_sa_chat_tg', 'sa_tg_update', '_sa_tg_update_core'))")" \
  '^5 0 из 38$'
chk "anon: таблицы и служебные функции — нельзя" \
  "$(Q "select count(*) from sa_push_subs") $(Q "select count(*) from sa_push_people") $(Q "select sa_push_take('$SECRET', null)") $(Q "select _sa_push_route(111, 'x')") $(Q "select sa_tg_update('whsec', '{}')")" \
  'permission denied.*permission denied.*permission denied.*permission denied.*permission denied'
chk "служба (service_role): вебхук и функции push-send — можно" \
  "$(PP "select has_function_privilege('service_role', 'sa_tg_update(text, jsonb)', 'execute') and has_function_privilege('service_role', 'sa_push_take(text, text[])', 'execute') and has_function_privilege('service_role', 'sa_push_done(text, jsonb, jsonb)', 'execute') and has_function_privilege('service_role', 'sa_push_act(text, text, text)', 'execute') and has_function_privilege('service_role', 'sa_push_keys(text, text)', 'execute') and has_function_privilege('service_role', 'sa_push_tg(bigint, text, text)', 'execute')")" '^t$'

# ── снова этап 39, потом 48 ──
run supabase-stage39-everyday.sql
chk "после этапа 39 вебхук — снова «настоящий» (без пометки)" "$(PP "select position('_sa_tg_update_core' in pg_get_functiondef('sa_tg_update(text, jsonb)'::regprocedure)) = 0")" '^t$'
run $S48
chk "этап 48 ещё раз: вебхук обёрнут, ядро — новое, /start работает; подписки на месте" \
  "$RC $(echo "$OUT48" | grep -o 'бот: [^·]*·') $(PP "select sa_tg_update('whsec', '{\"update_id\": 2, \"message\": {\"message_id\": 10, \"chat\": {\"id\": 111, \"type\": \"private\"}, \"from\": {\"id\": 111}, \"text\": \"/start\"}}')->>'start'") $(PP "select count(*) from sa_push_subs")" \
  '^0 бот: пишет и на телефон · true 6$'

echo
echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
