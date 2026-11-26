#!/bin/bash
# Этап 64 (v201, Доп. 526): живая проверка точнее и удобнее — отметка по пунктам, блиц, без сети (cid), итог человеку
# в Telegram, напоминание о пересдаче, лучшие тесты в приложении, сводка.
# Поверх базы run25.sh: копия satest64, этапы 61 и 63, тесты Анны в приложении, → этап 64 дважды. Без этапа 63 — понятная
# ошибка. Старый вызов сохранения (отметки 0/1/2) работает; по пунктам: процент, отметки для старых экранов, чужой модуль,
# повтор, «названо больше, чем пунктов» — bad_request; блиц — только модуль «blitz»; cid — повтор не задваивает;
# человек — лучшие тесты (из нескольких попыток), пункты, вид, название, уроки; список — пройденные тесты; итог человеку —
# через sa_tg_send (здесь — запись в таблицу), кнопка «Открыть урок» или «Мои проверки»; пересдача — одно сообщение
# проверявшему днём по времени заведения, ночью — нет, второй раз — нет, пересдал — нет; сводка — менеджер своё
# заведение, сеть — всё или одно, официант — нельзя; слабые модули и вопросы; права.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test64.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest64
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S63=supabase-stage63-live-check.sql; S64=supabase-stage64-live-check-plus.sql
D=$(mktemp -d); for f in supabase-stage61-places.sql $S63 $S64; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; IRINA=10000000-0000-0000-0000-0000000000b1
E_ANNA=00000000-0000-0000-0000-0000000000a4; E_ILYA=00000000-0000-0000-0000-0000000000a5; E_PETR=00000000-0000-0000-0000-0000000000a3
E_IVAN=00000000-0000-0000-0000-0000000000b2
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }

# ── Без этапа 63 — понятная ошибка ───────────────────────────────────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}x" -c "create database ${DB}x template satest25" >/dev/null 2>&1
$P0 -d ${DB}x -f "$D/supabase-stage61-places.sql" >/dev/null 2>&1
chk "без этапа 63: «Сначала этап 63»" "$($P0 -d ${DB}x -f "$D/$S64" 2>&1 | grep -o 'Сначала этап 63[^:]*' | head -1)" '^Сначала этап 63 \(supabase-stage63-live-check.sql\)$'
$P0 -d postgres -c "drop database if exists ${DB}x" >/dev/null 2>&1

# ── Этапы 61, 63 и 64; тесты Анны в приложении ─────────────────────────────────────────────────────────────────────
run supabase-stage61-places.sql
run $S63
PP "insert into quiz_done (user_id, quiz_id) values ('$E_ANNA', 's0-q'), ('$E_ANNA', 's1-q');
  insert into progress (user_id, lesson_id) values ('$E_ANNA', 's0-1');
  insert into scores (name, surname, restaurant, role, position, quiz_id, score, total) values
    ('Анна', 'Смирнова', 'Два моря, Океан', 'seasonal', 'waiter', 's0-q', 11, 12),
    ('Анна', 'Смирнова', 'Два моря, Океан', 'seasonal', 'waiter', 's1-q', 7, 10)" >/dev/null
# проверка до этапа 64 — старым вызовом
OLD=$(Q "select live_check_save('$PETR', '$E_ANNA', 'seasonal', 's2', '[2,2,2,2]'::jsonb)->>'score'")
RC=0; run $S64; run $S64
chk "этап 64 дважды — без ошибок: функций 4 из 4, старый вызов убран, pg_cron нет, проверок 1" \
  "$RC $(echo "$OUT" | grep -o 'живая проверка, этап 64: .*' | head -1)" \
  '^0 живая проверка, этап 64: функций 4 из 4 · старый вызов сохранения: убран · пересдача: нет pg_cron · проверок 1$'
chk "старая проверка на месте: вид module, пунктов нет" "$OLD $(PP "select kind || ' ' || coalesce(items::text, '—') from sa_live_checks")" '^100 module —$'

# ── Сохранить ──────────────────────────────────────────────────────────────────────────────────────────────────────
SV() { Q "select coalesce(r->>'error', (r->>'score') || ' ' || (r->>'passed')) from (select live_check_save('$1', '$2', p_track => '${3:-seasonal}', p_module => '${4:-s0}', p_items => '$5'::jsonb, p_kind => ${6:-null}, p_cid => ${7:-null}) r) t"; }
chk "старый вызов (отметки 0/1/2) по-прежнему работает" "$(Q "select live_check_save('$PETR', '$E_ANNA', 'seasonal', 's3', '[2,2,1,2]'::jsonb, 'заметка')->>'score'")" '^88$'
chk "по пунктам: 3/3, 1/3, 2/3, 3/3 — 75%, зачтено; отметки для старых экранов 2,1,1,2" \
  "$(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#1","g":3,"o":3},{"k":"s0#5","g":1,"o":3},{"k":"s0#6","g":2,"o":3},{"k":"s0#8","g":3,"o":3}]') / $(PP "select marks::text from sa_live_checks where module_id = 's0'")" \
  '^75 true / \[2, 1, 1, 2\]$'
chk "1/3, 0/2, 1/4 — 22%, не зачтено" "$(SV $PETR $E_ANNA seasonal s1 '[{"k":"s1#2","g":1,"o":3},{"k":"s1#6","g":0,"o":2},{"k":"s1#7","g":1,"o":4}]')" '^22 false$'
chk "плохие пункты — bad_request: чужой модуль, названо больше, чем пунктов, повтор вопроса, 7 пунктов, пусто, не номер" \
  "$(SV $PETR $E_ANNA seasonal s0 '[{"k":"s1#1","g":1,"o":3}]') $(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#1","g":4,"o":3}]') $(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#1","g":1,"o":3},{"k":"s0#1","g":1,"o":3}]') $(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#1","g":1,"o":7}]') $(SV $PETR $E_ANNA seasonal s0 '[]') $(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#x","g":1,"o":3}]')" \
  '^bad_request bad_request bad_request bad_request bad_request bad_request$'
BL='[{"k":"s0#2","g":2,"o":3},{"k":"s1#4","g":3,"o":3},{"k":"c0#7","g":3,"o":3}]'
chk "блиц: вопросы из разных модулей — 89%; модуль не «blitz» или «blitz» без вида — bad_request" \
  "$(SV $PETR $E_ANNA seasonal blitz "$BL" "'blitz'") $(SV $PETR $E_ANNA seasonal s0 "$BL" "'blitz'") $(SV $PETR $E_ANNA seasonal blitz "$BL") $(SV $PETR $E_ANNA seasonal s0 '[{"k":"s0#1","g":1,"o":1}]' "'exam'")" \
  '^89 true bad_request bad_request bad_request$'
chk "без сети: тот же cid ещё раз — та же проверка (dup), новой строки нет" \
  "$(Q "select (r->>'id') || ' ' || coalesce(r->>'dup', 'new') from (select live_check_save('$PETR', '$E_ANNA', p_track => 'core', p_module => 'c1', p_items => '[{\"k\":\"c1#1\",\"g\":2,\"o\":2}]'::jsonb, p_cid => 'tel-abc123') r) t") / $(Q "select (r->>'id') || ' ' || coalesce(r->>'dup', 'new') from (select live_check_save('$PETR', '$E_ANNA', p_track => 'core', p_module => 'c1', p_items => '[{\"k\":\"c1#1\",\"g\":0,\"o\":2}]'::jsonb, p_cid => 'tel-abc123') r) t") / $(PP "select count(*) from sa_live_checks where module_id = 'c1'")" \
  '^([0-9]+) new / \1 true / 1$'
chk "плохой cid, длинное название, плохой урок для повтора — bad_request" \
  "$(Q "select live_check_save('$PETR', '$E_ANNA', p_track => 'core', p_module => 'c2', p_items => '[{\"k\":\"c2#1\",\"g\":1,\"o\":1}]'::jsonb, p_cid => 'x y')->>'error'") $(Q "select live_check_save('$PETR', '$E_ANNA', p_track => 'core', p_module => 'c2', p_items => '[{\"k\":\"c2#1\",\"g\":1,\"o\":1}]'::jsonb, p_repeat => '[{\"l\":\"C 2\",\"t\":\"x\"}]'::jsonb)->>'error'")" \
  '^bad_request bad_request$'
chk "правила «кто кого» прежние: бармен не проверяет, менеджер «Порта» — не Анну" \
  "$(SV $ILYA $E_ANNA seasonal s0 '[{"k":"s0#1","g":1,"o":1}]') $(SV $IRINA $E_ANNA seasonal s0 '[{"k":"s0#1","g":1,"o":1}]')" '^forbidden forbidden$'

# ── Человек и список ───────────────────────────────────────────────────────────────────────────────────────────────
chk "человек: лучшие тесты в приложении (11 из 12 — 92%, 7 из 10 — 70%)" "$(Q "select live_check_person('$PETR', '$E_ANNA')->'tests'")" '^\{"s0-q": 92, "s1-q": 70\}$'
chk "человек: у итога вид, пункты, название" \
  "$(Q "select string_agg((x->>'m') || ':' || (x->>'k') || ':' || case when jsonb_typeof(x->'it') = 'array' then jsonb_array_length(x->'it') else 0 end, ',' order by x->>'m') from jsonb_array_elements(live_check_person('$PETR', '$E_ANNA')->'checks') x")" \
  '^blitz:blitz:3,c1:module:1,s0:module:4,s1:module:3,s2:module:0,s3:module:0$'
chk "список: у Анны пройденные тесты и вид последних проверок" \
  "$(Q "select (p->'quiz')::text || ' ' || (select string_agg((x->>'m') || ':' || (x->>'k'), ',' order by x->>'m') from jsonb_array_elements(p->'checks') x) from jsonb_array_elements(live_check_people('$PETR')->'people') p where p->>'name' = 'Анна'")" \
  '^\["s0-q", "s1-q"\] blitz:blitz,c1:module,s0:module,s1:module,s2:module,s3:module$'

# ── Итог человеку: бот (здесь sa_tg_send пишет в таблицу) ─────────────────────────────────────────────────────────────
PP "create table _lc_sent (chat bigint, txt text, btn text, go text);
  create or replace function sa_tg_send(p_chat bigint, p_text text, p_button text default null, p_go text default null) returns bigint language sql as
    \$f\$ insert into _lc_sent values (p_chat, p_text, p_button, p_go) returning 1::bigint \$f\$;
  create or replace function _sa_tg_ready() returns boolean language sql as \$f\$ select true \$f\$;
  insert into tg_links (emp_id, chat_id, remind) values ('$E_ANNA', 111, true), ('$E_PETR', 222, true)
    on conflict (emp_id) do update set chat_id = excluded.chat_id, remind = true" >/dev/null
SENT=$(Q "select live_check_save('$PETR', '$E_ANNA', p_track => 'seasonal', p_module => 's4', p_items => '[{\"k\":\"s4#1\",\"g\":1,\"o\":3},{\"k\":\"s4#5\",\"g\":3,\"o\":3}]'::jsonb, p_title => '  Работа  с жалобами ', p_repeat => '[{\"l\":\"s4-1\",\"t\":\"Психология конфликта и L.A.S.T.\"}]'::jsonb)->>'sent'")
chk "итог Анне: процент, «не зачтено», что повторить, кто проверял; кнопка «Открыть урок» с уроком" \
  "$SENT / $(PP "select chat || ' | ' || replace(txt, chr(10), ' / ') || ' | ' || btn || ' | ' || go from _lc_sent")" \
  '^true / 111 \| Живая проверка «Работа с жалобами»: 67%, не зачтено\. / Повторить: «Психология конфликта и L\.A\.S\.T\.»\. / Проверка: Пётр И\. \| Открыть урок \| lesson_s4-1$'
PP "delete from _lc_sent" >/dev/null
Q "select live_check_save('$PETR', '$E_ANNA', p_track => 'seasonal', p_module => 'blitz', p_kind => 'blitz', p_items => '[{\"k\":\"s6#1\",\"g\":2,\"o\":2}]'::jsonb)" >/dev/null
chk "блиц без уроков для повтора — «Мои проверки»" "$(PP "select replace(txt, chr(10), ' / ') || ' | ' || btn || ' | ' || go from _lc_sent")" '^Живая проверка, блиц: 100%, зачтено\. / Проверка: Пётр И\. \| Мои проверки \| lc_me$'
PP "delete from _lc_sent; update tg_links set remind = false where emp_id = '$E_ANNA'" >/dev/null
chk "напоминания у Анны выключены — не пишем, проверка сохранена" \
  "$(Q "select (r->>'sent') || ' ' || (r->>'score') from (select live_check_save('$PETR', '$E_ANNA', p_track => 'core', p_module => 'c3', p_items => '[{\"k\":\"c3#1\",\"g\":1,\"o\":1}]'::jsonb) r) t") $(PP "select count(*) from _lc_sent")" '^false 100 0$'

# ── Пересдача: напоминание проверявшему ─────────────────────────────────────────────────────────────────────────────
NOON=$(PP "select to_char(((date_trunc('day', now() at time zone 'Asia/Kamchatka') + interval '13 hours') at time zone 'Asia/Kamchatka'), 'YYYY-MM-DD HH24:MI:SSOF')")
NIGHT=$(PP "select to_char(((date_trunc('day', now() at time zone 'Asia/Kamchatka') + interval '23 hours') at time zone 'Asia/Kamchatka'), 'YYYY-MM-DD HH24:MI:SSOF')")
PP "update sa_live_checks set created_at = '$NOON'::timestamptz - interval '4 days' where module_id in ('s1', 's4');
  update sa_live_checks set created_at = '$NOON'::timestamptz - interval '1 day' where module_id = 'blitz'; delete from _lc_sent" >/dev/null
chk "ночью по времени заведения — не пишем" "$(PP "select sa_lc_tick('$NIGHT'::timestamptz)") $(PP "select count(*) from _lc_sent")" '^0 0$'
chk "днём — одно сообщение Петру: Анна, два незачтённых модуля, кнопка «Живая проверка»" \
  "$(PP "select sa_lc_tick('$NOON'::timestamptz)") / $(PP "select chat || ' | ' || replace(txt, chr(10), ' / ') || ' | ' || btn || ' | ' || go from _lc_sent")" \
  '^1 / 222 \| Пора пересдать живую проверку: / • Анна С\., «s1», 22% \([0-9]{2}\.[0-9]{2}\) / • Анна С\., «Работа с жалобами», 67% \([0-9]{2}\.[0-9]{2}\) \| Живая проверка \| lc$'
chk "второй раз — не напоминаем" "$(PP "select sa_lc_tick('$NOON'::timestamptz + interval '1 hour')") $(PP "select count(*) from _lc_sent")" '^0 1$'
PP "update sa_live_checks set reminded_at = null; delete from _lc_sent" >/dev/null
Q "select live_check_save('$PETR', '$E_ANNA', p_track => 'seasonal', p_module => 's1', p_items => '[{\"k\":\"s1#3\",\"g\":3,\"o\":3}]'::jsonb)" >/dev/null
PP "delete from _lc_sent" >/dev/null
chk "пересдал «s1» — в напоминании только «Работа с жалобами»" "$(PP "select sa_lc_tick('$NOON'::timestamptz)") $(PP "select replace(txt, chr(10), ' / ') from _lc_sent")" '^1 Пора пересдать живую проверку: / • Анна С\., «Работа с жалобами», 67% \([0-9.]+\)$'

# ── Сводка ─────────────────────────────────────────────────────────────────────────────────────────────────────────
Q "select live_check_save('$MARIA', '$E_IVAN', p_track => 'seasonal', p_module => 's0', p_items => '[{\"k\":\"s0#5\",\"g\":0,\"o\":3}]'::jsonb)" >/dev/null
Q "select live_check_save('$IRINA', '$E_IVAN', p_track => 'seasonal', p_module => 's0', p_items => '[{\"k\":\"s0#5\",\"g\":1,\"o\":3}]'::jsonb)" >/dev/null
SM() { Q "select coalesce(r->>'error', concat_ws(' | ', r->>'restaurant', r->'totals'->>'checks', r->'totals'->>'blitz', r->'totals'->>'people',
  (select string_agg((v->>'name') || ':' || (v->>'checks') || ':' || (v->>'passed'), ',' order by v->>'name') from jsonb_array_elements(r->'venues') v))) from (select live_check_summary('$1', ${2:-null}) r) t"; }
chk "сводка: официант — нельзя, без входа — auth" "$(SM $ANNA) $(Q "select live_check_summary('x')->>'error'")" '^forbidden auth$'
chk "менеджер — только своё заведение (просит «Порт» — всё равно своё)" "$(SM $PETR) / $(SM $PETR "'Порт'")" \
  '^Два моря, Океан \| 8 \| 2 \| 1 \| Два моря, Океан:8:6 / Два моря, Океан \| 8 \| 2 \| 1 \| Два моря, Океан:8:6$'
chk "сеть — вся сеть или одно заведение" "$(SM $ROMAN) / $(SM $MARIA "'Порт'")" '^10 \| 2 \| 2 \| Два моря, Океан:8:6,Порт:2:0 / Порт \| 2 \| 0 \| 1 \| Порт:2:0$'
chk "сводка «Порта»: кто сколько проверил; слабый модуль s0; слабый вопрос s0#5 — пока мало ответов" \
  "$(Q "select (select string_agg((c->>'name') || ':' || (c->>'n'), ',' order by c->>'name') from jsonb_array_elements(r->'venues'->0->'checkers') c) || ' | ' || (r->'modules')::text || ' | ' || (r->'questions')::text from (select live_check_summary('$ROMAN', 'Порт') r) t")" \
  '^Ирина Портова:1,Мария Ким:1 \| \[\{"m": "s0", "n": 2, "t": "seasonal", "avg": 17, "failed": 2\}\] \| \[\]$'
Q "select live_check_save('$ROMAN', '$E_IVAN', p_track => 'seasonal', p_module => 's0', p_items => '[{\"k\":\"s0#5\",\"g\":3,\"o\":3}]'::jsonb)" >/dev/null
chk "три ответа на вопрос — он в слабых: 4 из 9 пунктов, 44%" "$(Q "select (live_check_summary('$ROMAN', 'Порт')->'questions')::text")" '^\[\{"k": "s0#5", "n": 3, "pct": 44\}\]$'

# ── Права ──────────────────────────────────────────────────────────────────────────────────────────────────────────
chk "без входа — auth; напоминания и служебное закрыты для anon" \
  "$(Q "select live_check_save('x', '', 'seasonal', 's0')->>'error'") / $(Q "select sa_lc_tick()") / $(Q "select _sa_lc_tests('', '', '', '')")" \
  '^auth / .*permission denied.* / .*permission denied'

$P0 -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
rm -rf "$D"
echo
echo "проверок: $((pass+fail)), ✓ $pass, ✗ $fail"
[ $fail -eq 0 ]
