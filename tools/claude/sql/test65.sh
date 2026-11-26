#!/bin/bash
# Этап 65 (v202, Доп. 527): живая проверка встраивается в смену — вопрос на брифинге, просьбы о проверке, вопросы о блюдах
# и свои вопросы, отметки «неудачный вопрос», план «каждого раз в N дней», средний у проверяющих, итог недели.
# Поверх базы run25.sh: копия satest65, этапы 61, 63 и 64, бот (sa_tg_send пишет в таблицу), → этап 65 дважды. Без этапа 64 —
# понятная ошибка. Брифинг: только модуль «brief», только по пунктам; боту — если назвал не всё. Меню: ключи «menu#блюдо»,
# «Повторить блюда». Свои ключи «s0#c12». Просьбы: проверка или пересдача (по последнему итогу), повтор — та же просьба,
# не больше десяти; руководитель видит просьбы тех, кого проверяет; проверка модуля закрывает просьбу, брифинг — нет; отмена.
# Отметки: от старшего бармена, одна на человека; вопросы правит руководство сети: правка снимает отметки, свой вопрос —
# «c1», спрятать без текста, «оставить как есть». План: норма 14/30/60/90, в сводке «проверено из стольких» по заведениям,
# средний у проверяющих и по сети, просьбы, отметки. Пересдача по-прежнему. Итог недели: никогда не проверяли — не шлём;
# понедельник с 10 до 12 по времени заведения, один раз; текст. Права.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test65.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest65
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S63=supabase-stage63-live-check.sql; S64=supabase-stage64-live-check-plus.sql; S65=supabase-stage65-live-check-shift.sql
D=$(mktemp -d); for f in supabase-stage61-places.sql $S63 $S64 $S65; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; IRINA=10000000-0000-0000-0000-0000000000b1
E_ANNA=00000000-0000-0000-0000-0000000000a4; E_ILYA=00000000-0000-0000-0000-0000000000a5; E_IVAN=00000000-0000-0000-0000-0000000000b2
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
SENT() { PP "select coalesce(string_agg(chat || ' | ' || replace(txt, chr(10), ' / ') || ' | ' || btn || ' | ' || go, ' ## ' order by txt), '—') from _lc_sent"; }

# ── Без этапа 64 — понятная ошибка ───────────────────────────────────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}x" -c "create database ${DB}x template satest25" >/dev/null 2>&1
$P0 -d ${DB}x -f "$D/supabase-stage61-places.sql" >/dev/null 2>&1; $P0 -d ${DB}x -f "$D/$S63" >/dev/null 2>&1
chk "без этапа 64: «Сначала этап 64»" "$($P0 -d ${DB}x -f "$D/$S65" 2>&1 | grep -o 'Сначала этап 64[^:]*' | head -1)" '^Сначала этап 64 \(supabase-stage64-live-check-plus.sql\)$'
$P0 -d postgres -c "drop database if exists ${DB}x" >/dev/null 2>&1

# ── Этапы 61, 63, 64; бот пишет в таблицу; этап 65 дважды ─────────────────────────────────────────────────────────────
run supabase-stage61-places.sql
run $S63
run $S64
PP "create table _lc_sent (chat bigint, txt text, btn text, go text);
  create or replace function sa_tg_send(p_chat bigint, p_text text, p_button text default null, p_go text default null) returns bigint language sql as
    \$f\$ insert into _lc_sent values (p_chat, p_text, p_button, p_go) returning 1::bigint \$f\$;
  create or replace function _sa_tg_ready() returns boolean language sql as \$f\$ select true \$f\$" >/dev/null
RC=0; run $S65; run $S65
chk "этап 65 дважды — без ошибок: функций 7 из 7, план 30 дней, pg_cron нет, просьб и своих вопросов нет" \
  "$RC $(echo "$OUT" | grep -o 'живая проверка, этап 65: .*' | head -1)" \
  '^0 живая проверка, этап 65: функций 7 из 7 · план: каждого раз в 30 дней · расписание: нет pg_cron · просьб 0 · своих вопросов 0$'
# понедельник, 11:00 по времени заведения (через неделю — чтобы проверки «сейчас» попали в неделю до него)
MON=$(PP "select to_char(((date_trunc('week', now() at time zone 'Asia/Kamchatka') + interval '7 days 11 hours') at time zone 'Asia/Kamchatka'), 'YYYY-MM-DD HH24:MI:SSOF')")
chk "итог недели: живой проверкой ещё не пользовались — не шлём" "$(PP "select sa_lc_tick('$MON'::timestamptz)") $(PP "select count(*) from _lc_sent")" '^0 0$'

# ── Брифинг, меню, свои ключи ──────────────────────────────────────────────────────────────────────────────────────────
SV() { Q "select coalesce(r->>'error', (r->>'score') || ' ' || (r->>'passed')) from (select live_check_save('$1', '$2', p_track => '${3:-seasonal}', p_module => '${4:-s0}', p_items => '$5'::jsonb, p_kind => ${6:-null}, p_title => ${7:-null}) r) t"; }
chk "брифинг: вопросы из разных модулей и о блюде — 3 из 5 пунктов, 60%" \
  "$(SV $PETR $E_ANNA seasonal brief '[{"k":"s5#1","g":1,"o":3},{"k":"menu#borsch","g":2,"o":2}]' "'brief'")" '^60 false$'
chk "бот Анне: «Вопрос на брифинге: названо 3 из 5 пунктов», кто спрашивал, «Мои проверки»" "$(SENT)" \
  '^111 \| Вопрос на брифинге: названо 3 из 5 пунктов\. / Проверка: Пётр И\. \| Мои проверки \| lc_me$'
PP "delete from _lc_sent" >/dev/null
chk "назвал всё — 100%, бот не пишет" "$(SV $PETR $E_ANNA seasonal brief '[{"k":"s5#2","g":2,"o":2}]' "'brief'") $(SENT)" '^100 true —$'
chk "брифинг — только модуль «brief» и только по пунктам: иначе bad_request" \
  "$(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#1","g":1,"o":1}]' "'brief'") $(SV $PETR $E_ANNA seasonal brief '[{"k":"s0#1","g":1,"o":1}]') $(SV $PETR $E_ANNA seasonal brief '[{"k":"s0#1","g":1,"o":1}]' "'blitz'") $(Q "select live_check_save('$PETR', '$E_ANNA', 'seasonal', 'brief', '[2,2]'::jsonb, p_kind => 'brief')->>'error'")" \
  '^bad_request bad_request bad_request bad_request$'
MENU='[{"k":"menu#borsch","g":1,"o":3},{"k":"menu#tom-yam","g":2,"o":3}]'
MREP='[{"l":"borsch","t":"Борщ"},{"l":"tom-yam","t":"Том ям"}]'
chk "меню заведения: 3 из 6 — 50%; бот: «Повторить блюда», кнопка «Мои проверки» (уроков у блюд нет)" \
  "$(Q "select live_check_save('$PETR', '$E_ANNA', p_track => 'seasonal', p_module => 'menu', p_items => '$MENU'::jsonb, p_title => 'Меню заведения', p_repeat => '$MREP'::jsonb)->>'score'") / $(SENT)" \
  '^50 / 111 \| Живая проверка «Меню заведения»: 50%, не зачтено\. / Повторить блюда: «Борщ», «Том ям»\. / Проверка: Пётр И\. \| Мои проверки \| lc_me$'
PP "delete from _lc_sent" >/dev/null
chk "свой вопрос в модуле («s0#c12») — 75%; ключи с заглавной, пустые, с пробелом, без модуля — bad_request" \
  "$(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#c12","g":2,"o":2},{"k":"s0#3","g":1,"o":2}]' null "'Первый день'") $(SV $PETR $E_ANNA seasonal s0 '[{"k":"S0#1","g":1,"o":1}]') $(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#","g":1,"o":1}]') $(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#a b","g":1,"o":1}]') $(SV $PETR $E_ANNA seasonal s0 '[{"k":"#1","g":1,"o":1}]')" \
  '^75 true bad_request bad_request bad_request bad_request$'
chk "старый вызов (отметки 0/1/2) работает" "$(Q "select live_check_save('$PETR', '$E_ANNA', 'seasonal', 's3', '[2,2,1,2]'::jsonb, 'заметка')->>'score'")" '^88$'
chk "незачёт по «s1» — 33%" "$(SV $PETR $E_ANNA seasonal s1 '[{"k":"s1#2","g":1,"o":3}]')" '^33 false$'
PP "delete from _lc_sent" >/dev/null

# ── Просьбы о проверке ───────────────────────────────────────────────────────────────────────────────────────────────
RQ() { Q "select coalesce(r->>'error', concat_ws(' ', r->>'kind', r->>'again', r->>'cancelled')) from (select live_check_request('$1', '$2', '$3', ${4:-null}, ${5:-false}) r) t"; }
RL() { Q "select concat_ws(' | ', r->>'plan_days',
    coalesce((select string_agg((x->>'m') || ':' || (x->>'k'), ',' order by x->>'m') from jsonb_array_elements(r->'mine') x), '—'),
    coalesce((select string_agg((x->>'name') || ':' || (x->>'m') || ':' || (x->>'k') || coalesce(':' || (x->>'ti'), ''), ',' order by x->>'m') from jsonb_array_elements(r->'people') x), '—'))
  from (select live_check_requests('$1', ${2:-null}) r) t"; }
chk "Анна просит проверку «Аллергии»: проверка; ещё раз — та же просьба; по «s1» (не зачтено) — пересдача" \
  "$(RQ $ANNA seasonal s5 "'Аллергии и безопасность'") / $(RQ $ANNA seasonal s5 "'Аллергии и безопасность'") / $(RQ $ANNA seasonal s1)" '^check false / check true / retake false$'
chk "просьбы: блиц, чужая программа — bad_request; без входа — auth" "$(RQ $ANNA seasonal blitz) $(RQ $ANNA x s5) $(RQ x seasonal s5)" '^bad_request bad_request auth$'
chk "Анна видит свои просьбы, Пётр — просьбы Анны с названием" "$(RL $ANNA) / $(RL $PETR)" \
  '^30 \| s1:retake,s5:check \| — / 30 \| — \| Анна:s1:retake,Анна:s5:check:Аллергии и безопасность$'
chk "менеджер «Порта», бармен — чужих просьб не видят; сеть — своё заведение или выбранное" "$(RL $IRINA) / $(RL $ILYA) / $(RL $ROMAN) / $(RL $ROMAN "'Порт'")" \
  '^30 \| — \| — / 30 \| — \| — / 30 \| — \| Анна:s1:retake,Анна:s5:check:Аллергии и безопасность / 30 \| — \| —$'
SV $PETR $E_ANNA seasonal brief '[{"k":"s1#3","g":1,"o":1}]' "'brief'" >/dev/null
chk "проверка модуля закрывает просьбу, брифинг — нет" \
  "$(SV $PETR $E_ANNA seasonal s5 '[{"k":"s5#1","g":3,"o":3}]') / $(RL $PETR) / $(PP "select (check_id is not null)::text from sa_live_check_requests where module_id = 's5'")" \
  '^100 true / 30 \| — \| Анна:s1:retake / true$'
chk "Анна отменяет просьбу по «s1»; второй раз — нечего отменять" "$(RQ $ANNA seasonal s1 null true) $(RQ $ANNA seasonal s1 null true) / $(RL $PETR)" '^true false / 30 \| — \| —$'
PP "insert into sa_live_check_requests (emp_id, emp_name, restaurant, track, module_id) select '$E_ILYA', 'Илья Бармен', 'Два моря, Океан', 'bar', 'bar' || g from generate_series(0, 9) g" >/dev/null
chk "больше десяти просьб сразу — too_many" "$(RQ $ILYA bar spg-m1)" '^too_many$'
PP "update sa_live_check_requests set closed_at = now() where emp_id = '$E_ILYA'" >/dev/null
chk "Анна просит проверку «s2»" "$(RQ $ANNA seasonal s2)" '^check false$'

# ── Неудачные вопросы и свои вопросы ─────────────────────────────────────────────────────────────────────────────────
FL() { Q "select coalesce(r->>'error', 'ok') from (select live_check_flag('$1', '$2', '$3', '$4', ${5:-null}) r) t"; }
QS() { Q "select concat_ws(' | ', r->>'can_edit', jsonb_array_length(r->'rows'), (select string_agg((f->>'k') || ':' || (f->>'n'), ',' order by f->>'k') from jsonb_array_elements(r->'flags') f)) from (select live_check_questions('$1') r) t"; }
chk "отметки: Пётр (дважды — одна), Ирина; официант — нельзя; ключ не того модуля, плохой ключ — bad_request" \
  "$(FL $PETR seasonal s0 's0#3' "'пункты не из урока'") $(FL $PETR seasonal s0 's0#3' "'пункты не из урока'") $(FL $IRINA seasonal s0 's0#3' "'непонятно'") $(FL $IRINA seasonal s1 's1#2') $(FL $ANNA seasonal s0 's0#3') $(FL $PETR seasonal s0 's1#3') $(FL $PETR seasonal s0 's0#x y') / $(PP "select count(*) from sa_live_check_flags")" \
  '^ok ok ok ok forbidden bad_request bad_request / 3$'
chk "вопросы: менеджер не правит и отметок не видит; руководство сети — видит, по ключам" "$(QS $PETR) / $(QS $MARIA)" '^false \| 0 / true \| 0 \| s0#3:2,s1#2:1$'
QSV() { Q "select coalesce(r->>'error', (r->>'n') || ' ' || (r->>'resolved')) from (select live_check_question_save('$1', 'seasonal', '${2:-s0}', ${3:-null}, ${4:-null}, ${5:-null}, ${6:-null}, ${7:-false}) r) t"; }
Q3="'Как подойти к столу, если гость говорит по телефону?'"; A3="'[\"Подождать паузу\", \"Встать в поле зрения\"]'::jsonb"
chk "правка вопроса: менеджер — нельзя; руководство сети — правка снимает обе отметки" "$(QSV $PETR s0 "'3'" "$Q3" "$A3") / $(QSV $MARIA s0 "'3'" "$Q3" "$A3")" '^forbidden / 3 2$'
QN="'Что сказать гостю, если блюдо задерживается?'"; AN="'[\"Извиниться\", \"Назвать срок\", \"Предложить напиток\"]'::jsonb"
chk "свой вопрос — «c1», правка его же — «c1»; спрятать вопрос без текста; несуществующий свой — not_found" \
  "$(QSV $MARIA s0 null "$QN" "$AN" "'s0-2'") $(QSV $MARIA s0 "'c1'" "$QN" "$AN") $(QSV $MARIA s0 "'5'" null null null true) $(QSV $MARIA s0 "'c99'" "$QN" "$AN")" '^c1 0 c1 0 5 0 not_found$'
chk "плохие правки — bad_request: короткий текст, без пунктов, семь пунктов, меню, номер, урок, спрятать новый" \
  "$(QSV $MARIA s0 null "'Коротко'" "$AN") $(QSV $MARIA s0 null "$QN" "'[]'::jsonb") $(QSV $MARIA s0 null "$QN" "'[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\"]'::jsonb") $(QSV $MARIA menu null "$QN" "$AN") $(QSV $MARIA s0 "'x1'" "$QN" "$AN") $(QSV $MARIA s0 null "$QN" "$AN" "'урок'") $(QSV $MARIA s0 null null null null true)" \
  '^bad_request bad_request bad_request bad_request bad_request bad_request bad_request$'
chk "правки видят все: s0#3 (2 пункта), s0#5 спрятан, s0#c1 (3 пункта, урок s0-2)" \
  "$(Q "select string_agg((x->>'m') || '#' || (x->>'n') || ':' || (x->>'h') || ':' || case when jsonb_typeof(x->'a') = 'array' then jsonb_array_length(x->'a')::text else '—' end || coalesce(':' || (x->>'l'), ''), ',' order by x->>'n') from jsonb_array_elements(live_check_questions('$ANNA')->'rows') x") / $(QS $ANNA)" \
  '^s0#3:false:2,s0#5:true:—,s0#c1:false:3:s0-2 / false \| 3$'
chk "«оставить как есть»: менеджер — нельзя, руководство — снимает, второй раз — нечего; плохой ключ" \
  "$(Q "select live_check_flag_done('$PETR', 's1#2')->>'error'") $(Q "select live_check_flag_done('$MARIA', 's1#2')->>'resolved'") $(Q "select live_check_flag_done('$MARIA', 's1#2')->>'resolved'") $(Q "select live_check_flag_done('$MARIA', 'x')->>'error'") / $(QS $MARIA)" \
  '^forbidden 1 0 bad_request / true \| 3$'
FL $PETR seasonal s5 's5#2' >/dev/null

# ── План и сводка ────────────────────────────────────────────────────────────────────────────────────────────────────
chk "норма: менеджер — нельзя, 45 дней — нельзя, руководство — 14, потом снова 30" \
  "$(Q "select live_check_plan_set('$PETR', 14)->>'error'") $(Q "select live_check_plan_set('$MARIA', 45)->>'error'") $(Q "select live_check_plan_set('$MARIA', 14)->>'days'") $(Q "select live_check_requests('$ANNA')->>'plan_days'") $(Q "select live_check_plan_set('$MARIA', 30)->>'days'")" \
  '^forbidden bad_request 14 14 30$'
SV $MARIA $E_IVAN seasonal s0 '[{"k":"s0#5","g":0,"o":3}]' >/dev/null
SM() { Q "select coalesce(r->>'error', concat_ws(' | ', r->>'restaurant', r->'totals'->>'checks', r->'totals'->>'brief', r->'plan'->>'days', (r->'plan'->>'done') || '/' || (r->'plan'->>'due'),
    (select string_agg((v->>'name') || ':' || (v->>'done') || '/' || (v->>'due'), ',' order by v->>'name') from jsonb_array_elements(r->'plan'->'venues') v), r->'plan'->>'edit', r->>'requests', r->>'flags'))
  from (select live_check_summary('$1', ${2:-null}) r) t"; }
chk "сводка менеджера: проверок 5, на брифинге 3, план «1 из 3», норму не меняет, просьба 1, отметок не видит" "$(SM $PETR)" \
  '^Два моря, Океан \| 5 \| 3 \| 30 \| 1/3 \| Два моря, Океан:1/3 \| false \| 1 \| 0$'
chk "сводка сети: 6 проверок, план «2 из 5» по заведениям, норму меняет, просьба 1, отметка 1; «Порт» отдельно" "$(SM $ROMAN) / $(SM $MARIA "'Порт'")" \
  '^6 \| 3 \| 30 \| 2/5 \| Два моря, Океан:1/3,Порт:1/2 \| true \| 1 \| 1 / Порт \| 1 \| 0 \| 30 \| 1/2 \| Порт:1/2 \| true \| 0 \| 1$'
chk "сверка: средний по сети 58%; у проверяющих — всего, модулей, средний; слабый модуль с названием" \
  "$(Q "select (r->>'net_avg') || ' | ' || (select string_agg((v->>'name') || '=' || (v->>'brief') || '=' || (select string_agg((c->>'name') || ':' || (c->>'n') || ':' || (c->>'m') || ':' || coalesce(c->>'avg', '—'), ',') from jsonb_array_elements(v->'checkers') c), '; ' order by v->>'name') from jsonb_array_elements(r->'venues') v) || ' | ' || (select string_agg((m->>'m') || ':' || (m->>'avg') || ':' || coalesce(m->>'ti', '—'), ',') from jsonb_array_elements(r->'modules') m) from (select live_check_summary('$ROMAN') r) t")" \
  '^58 \| Два моря, Океан=3=Пётр Иванов:8:5:69; Порт=0=Мария Ким:1:1:0 \| s0:38:Первый день$'

# ── Пересдача — как в этапе 64 ─────────────────────────────────────────────────────────────────────────────────────────
NOON=$(PP "select to_char(((date_trunc('day', now() at time zone 'Asia/Kamchatka') + interval '13 hours') at time zone 'Asia/Kamchatka'), 'YYYY-MM-DD HH24:MI:SSOF')")
PP "update sa_live_checks set created_at = '$NOON'::timestamptz - interval '5 days' where module_id = 's1' and kind = 'module';
  update sa_live_checks set created_at = '$NOON'::timestamptz - interval '4 days' where module_id = 'menu'; delete from _lc_sent" >/dev/null
chk "пересдача: одно сообщение Петру — «s1» и «Меню заведения»" "$(PP "select sa_lc_tick('$NOON'::timestamptz)") / $(SENT)" \
  '^1 / 444 \| Пора пересдать живую проверку: / • Анна С\., «s1», 33% \([0-9.]+\) / • Анна С\., «Меню заведения», 50% \([0-9.]+\) \| Живая проверка \| lc$'

# ── Итог недели ────────────────────────────────────────────────────────────────────────────────────────────────────
PP "update sa_live_checks set created_at = '$MON'::timestamptz - interval '1 day'; delete from _lc_sent" >/dev/null
chk "понедельник 9:00 по времени заведения — рано" "$(PP "select sa_lc_tick('$MON'::timestamptz - interval '2 hours')") $(PP "select count(*) from _lc_sent")" '^0 0$'
chk "понедельник 11:00 — итог Марии (у Романа нет бота): заведения, слабый модуль, просьбы, кто никого не проверил; «Сводка»" \
  "$(PP "select sa_lc_tick('$MON'::timestamptz)") / $(SENT)" \
  '^1 / 333 \| Живая проверка за неделю \([0-9]{2}\.[0-9]{2}–[0-9]{2}\.[0-9]{2}\): / • Два моря, Океан: 5 проверок, зачтено 60%, средний 69% / • Порт: 1 проверка, зачтено 0%, средний 0% / Слабый модуль: «Первый день», средний 38%\. / Просят проверку: 1\. / Никого не проверили: Ирина П\. \(Порт\)\. \| Сводка \| lc_sum$'
chk "в ту же неделю второй раз — нет" "$(PP "select sa_lc_tick('$MON'::timestamptz + interval '30 minutes')") $(PP "select count(*) from _lc_sent")" '^0 1$'
chk "неделя без проверок — так и пишем" "$(PP "select replace(_sa_lc_week_text('$MON'::timestamptz - interval '60 days', 'Asia/Kamchatka'), chr(10), ' / ')")" \
  '^Живая проверка за неделю \([0-9.–]+\): / проверок модулей не было\. / Просят проверку: 1\. / Никого не проверили: '

# ── Права ──────────────────────────────────────────────────────────────────────────────────────────────────────────
chk "anon: таблиц и служебного не видно; без входа — auth" \
  "$(Q "select count(*) from sa_live_check_requests") / $(Q "select _sa_lc_week_text(now(), 'UTC')") / $(Q "select live_check_questions('x')->>'error'") $(Q "select live_check_plan_set('x', 30)->>'error'") $(Q "select live_check_flag('x', 'seasonal', 's0', 's0#1')->>'error'")" \
  '^.*permission denied.* / .*permission denied.* / auth auth auth$'

$P0 -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
rm -rf "$D"
echo
echo "проверок: $((pass+fail)), ✓ $pass, ✗ $fail"
[ $fail -eq 0 ]
