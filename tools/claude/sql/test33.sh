#!/bin/bash
# Этап 33 (v83, Доп. 396): случаи из нашего зала — case_submit / case_review / case_list.
# Поверх базы run25.sh: копия satest33, этапы 26, 31, 32 и 33 (33 — дважды), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test33.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest33
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
D=$(mktemp -d); cp "$SRC"/supabase-stage26-mastery.sql "$SRC"/supabase-stage31-qday.sql "$SRC"/supabase-stage32-briefing.sql "$SRC"/supabase-stage33-cases.sql "$D"/; chmod -R a+r "$D"
RC=0; OUT33=""
for f in supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage33-cases.sql supabase-stage33-cases.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
  [ "$f" = supabase-stage33-cases.sql ] && OUT33="$out"
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ILYA=10000000-0000-0000-0000-0000000000a5; IRINA=10000000-0000-0000-0000-0000000000b1
STORY='Гость за шестым столом попросил пересадить: дует из окна, а свободных столов у окна не было.'
DID='Сказал, что мест нет, и предложил плед.'
SIT='{"scene":"Гость за шестым столом просит пересадить: дует из окна, свободных столов нет.","question":"Как поступить?","options":["Извиниться, предложить плед и первый освободившийся стол","Сказать, что мест нет","Позвать менеджера сразу"],"correct":0,"why":"Гостю важно, что о нём позаботились сейчас и не забыли потом.","real":"Предложили плед, через 20 минут пересадили. Гость оставил чаевые.","show_author":true}'
cnt() { PP "select count(*) from net.sent_log"; }

chk "этапы 26, 31, 32 и 33 (33 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 4 функции, таблица, вид «Случаи из зала» в напоминаниях" "$OUT33" 'случаи из зала: 4 функции из 4 · таблица: есть · вид «Случаи из зала» в напоминаниях: да'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null
chk "notify_prefs: вид cases (этап 32 видит колонку сам)" "$(Q "select notify_prefs('$ANNA')->>'cases'")" '^true$'

# ── рассказать
chk "чужой токен — auth" "$(Q "select case_submit('мусор', '$STORY', '', 'ok', false)->>'error'")" '^auth$'
chk "слишком коротко — short" "$(Q "select case_submit('$ANNA', 'Гость ругался', '', 'bad', false)->>'error'")" '^short$'
chk "неизвестный итог — bad_request" "$(Q "select case_submit('$ANNA', '$STORY', '', 'spam', false)->>'error'")" '^bad_request$'
R1=$(Q "select case_submit('$ANNA', '$STORY', '$DID', 'bad', false)")
chk "Анна рассказала: ok, руководителям заведения ушло двоим (Мария, Пётр)" "$R1" '"ok": true.*"sent": 2|"sent": 2.*"ok": true'
chk "в Telegram: кто рассказал, начало истории, кнопка «Разобрать» в приложение" "$(PP "select string_agg(body->>'chat_id', ',' order by body->>'chat_id') || ' ' || bool_and(body->>'text' like 'Новый случай из зала. Рассказал(а) Анна Смирнова:%«Гость за шестым столом%') || ' ' || bool_and(body::text like '%\"text\": \"Разобрать\"%' and body::text like '%https://app.example/?go=cases%') from net.sent_log")" '^333,444 true true$'
CID=$(PP "select max(id) from sa_cases")
R2=$(Q "select case_submit('$ANNA', 'Второй случай: гость попросил счёт раньше, чем принесли десерт.', '', 'saved', false)")
chk "второй случай в тот же день — руководителям второй раз не пишем" "$R2|$(cnt)" '"sent": 0.*\|2$'
R3=$(Q "select case_submit('$ILYA', 'Гость за баром попросил коктейль не из карты, а нужного сиропа не было.', 'Предложил похожий из карты.', 'unsure', true)")
chk "Илья — без имени: ok; пробелы в тексте сжаты" "$R3|$(PP "select anon || ' ' || story from sa_cases where author_id like '%a5'")" '"ok": true.*\|true Гость за баром попросил коктейль не из карты, а нужного сиропа не было\.$'
for i in 3 4 5; do Q "select case_submit('$ANNA', 'Случай номер $i: гость попросил разделить счёт на троих.', '', '', false)" >/dev/null; done
chk "шестой случай за день — limit" "$(Q "select case_submit('$ANNA', 'Шестой случай: гость попросил разделить счёт на шестерых.', '', '', false)->>'error'")" '^limit$'

# ── списки
chk "Анна: свои 5 случаев «new», в тренировке пока пусто, разбора ей не видно" "$(Q "select jsonb_array_length(x->'mine') || ' ' || jsonb_array_length(x->'team') || ' ' || (x ? 'inbox') || ' ' || (x->>'lead') from case_list('$ANNA') x")" '^5 0 false false$'
chk "Мария (старшая): ждут разбора 6, у каждого — рассказ и автор (руководитель видит имя и у «без имени»)" "$(Q "select jsonb_array_length(x->'inbox') || ' ' || (select string_agg(distinct i->>'author', ',' order by i->>'author') from jsonb_array_elements(x->'inbox') i) || ' ' || (x->'inbox'->0->>'story' like 'Гость за шестым%') from case_list('$MARIA') x")" '^6 Анна Смирнова,Илья Бармен true$'
chk "Ирина (Порт): чужого заведения не видно" "$(Q "select jsonb_array_length(x->'inbox') || ' ' || jsonb_array_length(x->'team') from case_list('$IRINA') x")" '^0 0$'
chk "числа: у Марии ждут разбора 6; у Анны — 0 (не руководитель)" "$(Q "select case_list('$MARIA', 'counts')->>'inbox'") $(Q "select case_list('$ANNA', 'counts')->>'inbox'")" '^6 0$'

# ── разобрать
chk "Анна не разбирает — forbidden" "$(Q "select case_review('$ANNA', $CID, 'publish', '$SIT'::jsonb, '')->>'error'")" '^forbidden$'
chk "Ирина (Порт) — not_found" "$(Q "select case_review('$IRINA', $CID, 'publish', '$SIT'::jsonb, '')->>'error'")" '^not_found$'
LAST=$(PP "select max(id) from sa_cases where author_id like '%a4'")
chk "свой неразобранный случай автор удаляет сам" "$(Q "select case_review('$ANNA', $LAST, 'delete', null, '')->>'status'")|$(PP "select count(*) from sa_cases where author_id like '%a4'")" '^deleted\|4$'
chk "ситуация с одним вариантом — bad_sit" "$(Q "select case_review('$MARIA', $CID, 'publish', jsonb_set('$SIT'::jsonb, '{options}', '[\"Один\"]'), '')->>'error'")" '^bad_sit$'
chk "одинаковые варианты — bad_sit" "$(Q "select case_review('$MARIA', $CID, 'publish', jsonb_set('$SIT'::jsonb, '{options}', '[\"Плед\", \"плед \"]'), '')->>'error'")" '^bad_sit$'
chk "верный вне вариантов — bad_sit" "$(Q "select case_review('$MARIA', $CID, 'publish', jsonb_set('$SIT'::jsonb, '{correct}', '3'), '')->>'error'")" '^bad_sit$'
chk "без разбора — bad_sit" "$(Q "select case_review('$MARIA', $CID, 'publish', jsonb_set('$SIT'::jsonb, '{why}', '\"\"'), '')->>'error'")" '^bad_sit$'
$P -c "delete from net.sent_log" >/dev/null
chk "Мария публикует: published" "$(Q "select case_review('$MARIA', $CID, 'publish', '$SIT'::jsonb, 'Спасибо, хороший пример')->>'status'")" '^published$'
chk "автору — сообщение: случай разобрали, слово Марии, кнопка в приложение" "$(PP "select string_agg(body->>'chat_id', ',') || ' ' || bool_and(body->>'text' = E'Твой случай из зала разобрали: теперь на нём тренируется команда.\nМария Ким: «Спасибо, хороший пример»') || ' ' || bool_and(body::text like '%?go=cases%') from net.sent_log")" '^111 true true$'
PUB1=$(PP "select published_at from sa_cases where id = $CID")
chk "правка опубликованного: без сообщений, дата публикации прежняя" "$(Q "select case_review('$MARIA', $CID, 'publish', jsonb_set('$SIT'::jsonb, '{question}', '\"Что сделать первым?\"'), '')->>'status'")|$(cnt)|$(PP "select (published_at = '$PUB1') || ' ' || (sit->>'question') from sa_cases where id = $CID")" '^published\|1\|true Что сделать первым\?$'
ICID=$(PP "select id from sa_cases where author_id like '%a5'")
chk "«не для тренировки» с пояснением: declined, Илье — сообщение со словом Марии" "$(Q "select case_review('$MARIA', $ICID, 'decline', null, 'Такой коктейль делать нельзя: в карте его нет')->>'status'")|$(PP "select body->>'text' from net.sent_log where body->>'chat_id' = '222'")" '^declined\|Руководитель прочитал твой случай из зала\. В тренировку команды он не пошёл\. Мария Ким: «Такой коктейль делать нельзя: в карте его нет»$'

# ── команда видит
chk "Илья: в тренировке 1 случай — ситуация и автор, без рассказа; новых для него 1" "$(Q "select jsonb_array_length(x->'team') || ' ' || (x->'team'->0->>'author') || ' ' || (x->'team'->0 ? 'story') || ' ' || (x->'team'->0->'sit'->>'correct') from case_list('$ILYA') x") $(Q "select case_list('$ILYA', 'counts')->>'fresh'")" '^1 Анна Смирнова false 0 1$'
chk "Илья: свой случай — «не для тренировки» и слово руководителя" "$(Q "select (x->'mine'->0->>'status') || ' ' || (x->'mine'->0->>'note') from case_list('$ILYA') x")" '^declined Такой коктейль делать нельзя: в карте его нет$'
chk "Анна: свой случай в тренировке; новых для неё 0 (свой не считаем); ответ руководителя — 1" "$(Q "select case_list('$ANNA', 'counts')")" '"fresh": 0.*"mine_new": 1|"mine_new": 1.*"fresh": 0'
chk "новые с отметки p_since: после публикации — 0" "$(Q "select case_list('$ILYA', 'counts', now())->>'fresh'")" '^0$'
chk "свежий опубликованный — top (для брифинга смены)" "$(Q "select case_list('$PETR', 'counts')->'top'->'sit'->>'question'")" '^Что сделать первым\?$'
# «без имени» и «не показывать автора»
A2=$(PP "select id from sa_cases where author_id like '%a4' and status = 'new' order by id limit 1")
Q "select case_review('$MARIA', $A2, 'publish', jsonb_set('$SIT'::jsonb, '{show_author}', 'false'), '')" >/dev/null
$P -c "update sa_cases set anon = true where id = $ICID" >/dev/null
Q "select case_review('$MARIA', $ICID, 'publish', '$SIT'::jsonb, '')" >/dev/null
chk "команде не видно имени: «не показывать автора» и «без имени» (даже если руководитель отметил «показывать»)" "$(Q "select string_agg(coalesce(t->>'author', '—'), ',' order by (t->>'id')::int) from jsonb_array_elements(case_list('$PETR')->'team') t")" '^Анна Смирнова,—,—$'
chk "руководителю — «разобранные»: опубликованные и «не для тренировки»" "$(Q "select jsonb_array_length(case_list('$MARIA')->'done')")" '^3$'
chk "Ирина (Порт): тренировка чужого заведения не видна" "$(Q "select jsonb_array_length(case_list('$IRINA')->'team')")" '^0$'

# ── выключенные сообщения и без бота
$P -c "delete from net.sent_log; delete from tg_sent" >/dev/null
$P -c "set role anon; select notify_set('$ANNA', 'cases', false)" >/dev/null
A3=$(PP "select id from sa_cases where author_id like '%a4' and status = 'new' order by id limit 1")
chk "Анна выключила «Случаи из зала» — о разборе ей не пишем" "$(Q "select case_review('$MARIA', $A3, 'publish', '$SIT'::jsonb, '')->>'status'")|$(cnt)" '^published\|0$'
$P -c "delete from vault.secrets_stub" >/dev/null
chk "без токена бота: случай записан, сообщений нет" "$(Q "select case_submit('$PETR', 'Без бота: гость спросил про веганское меню, а его нет.', '', 'saved', false)")|$(cnt)" '"ok": true.*"sent": 0.*\|0$|"sent": 0.*"ok": true.*\|0$'

# ── права
chk "anon: case_submit, case_review, case_list — можно" "$(PP "select has_function_privilege('anon', 'public.case_submit(text, text, text, text, boolean)', 'execute') and has_function_privilege('anon', 'public.case_review(text, bigint, text, jsonb, text)', 'execute') and has_function_privilege('anon', 'public.case_list(text, text, timestamptz)', 'execute')")" '^t$'
chk "anon: служебная _sa_case_json — нельзя; таблицу случаев напрямую — нельзя" "$(PP "select has_function_privilege('anon', 'public._sa_case_json(sa_cases, text)', 'execute')")|$(Q "select count(*) from sa_cases")" '^f\|.*(permission denied|нет доступа)'

echo "Итого: $pass ✓, $fail ✗"
