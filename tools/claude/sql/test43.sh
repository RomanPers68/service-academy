#!/bin/bash
# Этап 43 (v109, Доп. 422): «Что дало обучение» — итог месяца для владельца и руководителей.
# Поверх базы run25.sh: копия satest43; этап 43 раньше 38 (понятная ошибка) → этапы 26, 31, 32, 34, 35, 36, 37, 38, 39, 41,
# 42 → 43 дважды; журнал занятий, тесты, «спасибо» гостей и коллег, новички с самостоятельной сменой — на свои даты;
# итог месяца (идёт и полный), граница журнала в 75 дней, «выросли» и «не занимались», текст бота, экран (gain_month),
# «Прислать сейчас», рассылка 1-го числа с 10 до 21 по часам заведения; проверки ✓/✗. Отправка в Telegram — заглушка
# pg_net (net.sent_log), pg_cron — своя заглушка. Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433),
# пользователь postgres. Если есть node — текст бота и кнопка сверяются с lib/gain.js.
#   bash run25.sh && bash test43.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
LIB=${SA_LIB:-$HERE/../../../lib}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest43
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql supabase-stage41-newbie.sql supabase-stage42-thanks.sql"
S43=supabase-stage43-gain.sql
D=$(mktemp -d); for f in $PRE $MID $S43; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT43=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = $S43 ] && OUT43="$out"; }
for f in $PRE; do run $f; done
# этап 43 раньше 38: просит нужный этап и ничего не создаёт
NO38=$($P0 -d $DB -f "$D/$S43" 2>&1)
NOFN=$($P0 -d $DB -t -A -c "select count(*) from pg_proc where proname in ('gain_month', 'gain_send_now', '_sa_gain_at')" 2>&1)
for f in $MID $S43 $S43; do run $f; done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PN() { $P -c "$1" 2>&1; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
same() { if [ "$1" = "$2" ]; then echo SAME; else printf 'РАЗНЫЕ\n--- ждали:\n%s\n--- пришло:\n%s' "$2" "$1"; fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
REMP=00000000-0000-0000-0000-0000000000a1; MEMP=00000000-0000-0000-0000-0000000000a2; PEMP=00000000-0000-0000-0000-0000000000a3
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5; OEMP=00000000-0000-0000-0000-0000000000a6
IREMP=00000000-0000-0000-0000-0000000000b1; VEMP=00000000-0000-0000-0000-0000000000b2
R0="Два моря, Океан"
sentn() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1'"; }
lastsent() { PN "select body->>'text' from net.sent_log where body->>'chat_id' = '$1' order by id desc limit 1"; }
AT() { echo "_sa_gain_at('$R0', '$1', '$2')"; }

chk "этап 43 раньше этапа 38 — понятная ошибка, функций нет" "$(echo "$NO38" | tr '\n' ' ') · $NOFN" 'Сначала этап 38 \(supabase-stage38-chat.sql\).* · 0$'
chk "этапы 26–39, 41, 42 и 43 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 2 функции из 2, без pg_cron — подсказка, бота нет — итог только в приложении" \
  "$(echo "$OUT43" | grep -c 'pg_cron не включён: итог месяца в Telegram не придёт по расписанию') $(echo "$OUT43" | grep -o 'что дало обучение: .*')" \
  '^1 что дало обучение: 2 функции из 2 · расписание: pg_cron не включён · бот: нет \(итог будет только в приложении\) · придёт 1-го числа руководителям с Telegram: 2$'

# ── слова ──
chk "слова: 1–15 октября, 1 октября, с сентябрём, 21 день, 2 дня, 5 дней" \
  "$(PP "select concat_ws('|', _sa_gn_period('2026-10-01', '2026-10-15'), _sa_gn_period('2026-10-01', '2026-10-01'), _sa_gn_mon('2026-09-01', 'ins'), _sa_gn_mon('2026-08-01', 'low'),
     21 || ' ' || _sa_gn_pl(21, 'день', 'дня', 'дней'), 2 || ' ' || _sa_gn_pl(2, 'день', 'дня', 'дней'), 5 || ' ' || _sa_gn_pl(5, 'день', 'дня', 'дней'), _sa_gn_and(array['А', 'Б', 'В']))")" \
  '^1–15 октября\|1 октября\|сентябрём\|август\|21 день\|2 дня\|5 дней\|А, Б и В$'
chk "какой месяц: пусто — первые семь дней прошлый, потом текущий; прошлый — можно; позапрошлый, будущий и мусор — нет" \
  "$(PP "select concat_ws('|', _sa_gain_month('', '2026-10-05'), _sa_gain_month(null, '2026-10-08'), _sa_gain_month('2026-09', '2026-10-15'), coalesce(_sa_gain_month('2026-08', '2026-10-15')::text, 'нет'),
     coalesce(_sa_gain_month('2026-11', '2026-10-15')::text, 'нет'), coalesce(_sa_gain_month('2026-13', '2026-10-15')::text, 'нет'), coalesce(_sa_gain_month('abc', '2026-10-15')::text, 'нет'), _sa_gain_month(' 2026-10 ', '2026-10-15'))")" \
  '^2026-09-01\|2026-10-01\|2026-09-01\|нет\|нет\|нет\|нет\|2026-10-01$'

# ── данные на свои даты (часы заведения — Камчатка, +12) ──
$P0 -d $DB >/dev/null <<SQL
delete from quiz_events;
-- все давно в команде (и в «Новичках» никого: этап 41 при первом запуске добавил тех, кого завели недавно, — то есть всех);
-- Ксюша пришла 20 октября (сотрудника завели и она в «Новичках»)
update employees set created_at = '2025-01-01 10:00+12';
delete from sa_newbies;
insert into employees (id, name, surname, restaurant, position, is_admin, status, created_at) values
 ('00000000-0000-0000-0000-0000000000c9', 'Ксюша', 'Поздняя', '$R0', 'waiter', false, 'active', '2026-10-20 10:00+12');
insert into emp_learning (emp_id, emp_name, restaurant, data) values
 ('$AEMP', 'Анна Смирнова', '$R0', '{"activity": {"2026-08-20": {"st": 2, "l": 2},
    "2026-09-03": {"st": 3, "l": 2, "q": 1}, "2026-09-10": {"st": 2, "l": 1, "q": 1}, "2026-09-25": {"st": 1, "l": 1},
    "2026-10-02": {"st": 5, "l": 3, "q": 2}, "2026-10-05": {"st": 4, "l": 2, "q": 1, "x": 1}, "2026-10-12": {"st": 3, "l": 2, "g": 1}, "2026-10-20": {"st": 2, "l": 1},
    "2026-10-45": {"st": 9, "l": 9}}}'),
 ('$IEMP', 'Илья Бармен', '$R0', '{"activity": {"2026-09-04": {"st": 6, "l": 4, "q": 2}, "2026-10-03": {"st": 2, "l": 1}}}'),
 ('$MEMP', 'Мария Ким', '$R0', '{"activity": {"2026-10-07": {"st": 0, "f": 2}}}'),
 ('$REMP', 'Роман Владелец', '$R0', '{"activity": {"2026-10-02": {"st": 9, "l": 9}}}'),
 ('$OEMP', 'Олег Уволенный', '$R0', '{"activity": {"2026-10-02": {"st": 9, "l": 9}}}'),
 ('$VEMP', 'Иван Петров', 'Порт', '{"activity": {"2026-10-02": {"st": 9, "l": 9}}}')
on conflict (emp_id) do update set data = excluded.data;
insert into quiz_events (restaurant, employee, role_id, lesson_id, question, correct, ts)
  select '$R0', 'Анна Смирнова', 'seasonal', 's4-q', 'В' || g, g > 1, '2026-10-05 13:00+12'::timestamptz from generate_series(1, 10) g
  union all select '$R0', 'Анна Смирнова', 'seasonal', 's1-q', 'В' || g, g > 1, '2026-10-06 13:00+12' from generate_series(1, 5) g
  union all select '$R0', 'Илья Бармен', 'bar', 's1-q', 'В' || g, true, '2026-10-03 13:00+12' from generate_series(1, 4) g
  union all select '$R0', 'Анна Смирнова', 'seasonal', 's4-q', 'Поздно', true, '2026-10-15 23:30+12'
  union all select '$R0', 'Анна Смирнова', 'seasonal', 's4-q', 'Назавтра', false, '2026-10-16 00:30+12'
  union all select '$R0', 'Анна Смирнова', 'seasonal', 's2-q', 'В' || g, g > 1, '2026-10-20 13:00+12' from generate_series(1, 3) g
  union all select '$R0', 'Анна Смирнова', 'seasonal', 's4-q', 'В' || g, g > 4, '2026-09-05 13:00+12' from generate_series(1, 10) g
  union all select '$R0', 'Илья Бармен', 'bar', 's1-q', 'В' || g, g > 1, '2026-09-06 13:00+12' from generate_series(1, 2) g
  union all select 'Порт', 'Иван Петров', 'seasonal', 's1-q', 'В' || g, false, '2026-10-04 13:00+12' from generate_series(1, 5) g;
insert into sa_guest_thanks (emp_id, restaurant, text, hidden, created_at) values
 ('$AEMP', '$R0', 'Спасибо', false, '2026-10-02 20:00+12'), ('$AEMP', '$R0', 'Спасибо', false, '2026-10-09 20:00+12'),
 ('$AEMP', '$R0', 'Спасибо', false, '2026-10-15 23:00+12'), ('$AEMP', '$R0', 'скрытое', true, '2026-10-05 20:00+12'),
 ('$AEMP', '$R0', 'Назавтра', false, '2026-10-16 01:00+12'), ('$IEMP', '$R0', 'Спасибо', false, '2026-09-07 20:00+12'),
 ('$VEMP', 'Порт', 'Спасибо', false, '2026-10-02 20:00+12'), ('$VEMP', 'Порт', 'Спасибо', false, '2026-10-03 20:00+12');
insert into sa_peer_thanks (msg_id, restaurant, from_id, from_name, to_id, to_name, text, own, created_at) values
 (900001, '$R0', '$MEMP', 'Мария Ким', '$AEMP', 'Анна Смирнова', 'выручила', true, '2026-10-04 20:00+12'),
 (900001, '$R0', '$PEMP', 'Пётр Иванов', '$AEMP', 'Анна Смирнова', 'выручила', false, '2026-10-08 20:00+12');
insert into sa_newbies (emp_id, restaurant, started_at, solo_at) values
 ('nb-1', '$R0', '2026-09-28 10:00+12', '2026-10-06 15:00+12'), ('nb-2', '$R0', '2026-10-01 10:00+12', '2026-10-05 15:00+12'),
 ('nb-3', '$R0', '2026-08-20 10:00+12', '2026-09-05 15:00+12'), ('nb-4', '$R0', '2026-10-10 10:00+12', '2026-10-20 15:00+12'),
 ('nb-5', '$R0', '2026-10-01 10:00+12', null), ('nb-6', 'Порт', '2026-10-01 10:00+12', '2026-10-03 15:00+12'),
 ('00000000-0000-0000-0000-0000000000c9', '$R0', '2026-10-20 10:00+12', null)
on conflict (emp_id) do update set restaurant = excluded.restaurant, started_at = excluded.started_at, solo_at = excluded.solo_at;
SQL

# ── итог: месяц идёт (октябрь по 15-е), сравниваем с теми же днями сентября ──
G1="$(AT 2026-10-01 2026-10-15)"
chk "месяц идёт: 1–15 октября против 1–15 сентября, в команде 4 (без владельца и уволенного)" \
  "$(PP "select concat_ws('|', b->>'month', b->>'from', b->>'to', b->>'partial', b->>'pfrom', b->>'pto', b->>'team') from (select $G1 b) x")" \
  '^2026-10\|2026-10-01\|2026-10-15\|true\|2026-09-01\|2026-09-15\|4$'
chk "чему учились: занимались 3, уроков 8, тестов 4 (с экзаменом), «Живой гость» 1, дней 5; сентябрь: 2, 7, 4; 20-е и «2026-10-45» — нет" \
  "$(PP "select (b->'learn')::text || ' ' || (b->'plearn')::text from (select $G1 b) x")" \
  '^\{"days": 5, "guest": 1, "tests": 4, "people": 3, "lessons": 8, "practice": 0\} \{"days": 3, "guest": 0, "tests": 4, "people": 2, "lessons": 7, "practice": 0\}$'
chk "тесты: ответов 20, неверных 2 (23:30 — ещё 15-е, 00:30 — уже 16-е); сентябрь 12 и 5; Порт — не наш" \
  "$(PP "select (b->'quiz')::text || ' ' || (b->'pquiz')::text from (select $G1 b) x")" '^\{"n": 20, "wrong": 2\} \{"n": 12, "wrong": 5\}$'
chk "темы: s1-q — 2 человека (9 ответов, 1 неверный), s4-q — 1 (11 ответов); всего уроков с тестами 2" \
  "$(PP "select (b->'topics')::text || ' ' || (b->>'topicsN') from (select $G1 b) x")" \
  '^\[\{"a": 9, "n": 2, "w": 1, "id": "s1-q"\}, \{"a": 11, "n": 1, "w": 1, "id": "s4-q"\}\] 2$'
chk "«спасибо» гостей: 3 (скрытое и 16-е — нет), было 1; от коллег 2, было 0" \
  "$(PP "select (b->'thanks')::text || ' ' || (b->'peer')::text from (select $G1 b) x")" '^\{"n": 3, "prev": 1\} \{"n": 2, "prev": 0\}$'
chk "новички: 2 вышли на самостоятельную смену, в среднем за 6 дней (8 и 4); в сентябре 1 за 16; без смены и Порт — нет" \
  "$(PP "select (b->'newbies')::text from (select $G1 b) x")" '^\{"n": 2, "pn": 1, "days": 6, "pdays": 16\}$'
chk "выросли: Анна С. (165 очков, было 60; 7 уроков и 4 теста; тесты 16 и 2, было 10 и 4); Илья и Мария — меньше 50 очков" \
  "$(PP "select (b->'grew')::text from (select $G1 b) x")" \
  "^\[\{\"n\": \"Анна С\.\", \"id\": \"$AEMP\", \"qn\": 16, \"qw\": 2, \"pqn\": 10, \"pqw\": 4, \"pts\": 165, \"ppts\": 60, \"tests\": 4, \"ptests\": 2, \"lessons\": 7, \"plessons\": 3\}\]$"
chk "пришла 20 октября: в команде 1–15 октября и сентября её нет, в итоге всего октября есть (и не занималась)" \
  "$(PP "select concat_ws('|', $G1->>'team', $(AT 2026-09-01 2026-10-14)->>'team', $(AT 2026-10-01 2026-11-01)->>'team', (select string_agg(x->>'n', ',') from jsonb_array_elements($(AT 2026-10-01 2026-11-01)->'idle') x))")" \
  '^4\|4\|5\|Ксюша П\.,Пётр И\.$'
chk "не занимались: Пётр И. (Мария исправляла ошибки — занималась)" "$(PP "select (b->'idle')::text || ' ' || (b->>'idleMore') from (select $G1 b) x")" "^\[\{\"n\": \"Пётр И\.\", \"id\": \"$PEMP\"\}\] 0$"
T1="<b>Что дало обучение · октябрь</b>
Два моря, Океан · 1–15 октября, сравниваем с 1–15 сентября

<b>Чему учились</b>
Уроков: 8, было 7
Тестов: 4, было 4
Занимались: 3 из 4, было 2

<b>Что изменилось в зале</b>
«Спасибо» от гостей: 3, было 1
Ошибок в тестах: 10%, было 42%
Новички до самостоятельной смены: 6 дней, было 16
«Спасибо» от коллег: 2, было 0

<b>Больше всех выросли</b>
Анна С.

<b>Не занимались</b>
Пётр И."
chk "текст бота за 1–15 октября" "$(same "$(PN "select _sa_gain_text($G1)")" "$T1")" '^SAME$'

# ── полный месяц и граница журнала (телефон хранит 75 дней) ──
G2="$(AT 2026-09-01 2026-10-14)"; G3="$(AT 2026-09-05 2026-10-15)"
chk "сентябрь 14 октября: весь месяц против всего августа; выросли Илья (+70) и Анна (+50)" \
  "$(PP "select concat_ws('|', b->>'partial', b->>'to', b->>'pto', b->'learn'->>'lessons', b->'plearn'->>'lessons', (select string_agg(g->>'n' || ':' || ((g->>'pts')::int - (g->>'ppts')::int), ',') from jsonb_array_elements(b->'grew') g)) from (select $G2 b) x")" \
  '^false\|2026-09-30\|2026-08-31\|8\|2\|Илья Б\.:70,Анна С\.:50$'
chk "сентябрь 15 октября: август уже за 75 днями — занятия не сравниваем, «выросли» нет; тесты и «спасибо» сравниваем" \
  "$(PP "select concat_ws('|', coalesce(b->>'plearn', 'нет'), jsonb_array_length(b->'grew'), b->'pquiz'->>'n', b->'thanks'->>'prev') from (select $G3 b) x")" '^нет\|0\|0\|0$'
chk "текст без сравнения занятий: «Уроков: 8» без «было», «сравниваем с августом»" \
  "$(PN "select _sa_gain_text($G3)" | sed -n '2p;5,7p' | tr '\n' '|')" '^Два моря, Океан · сравниваем с августом\|Уроков: 8\|Тестов: 4\|Занимались: 2 из 4\|$'
chk "месяц, который ещё не начался, — ошибка" "$(PP "select $(AT 2026-11-01 2026-10-15)")" '"error": "month"'

# ── сверка с приложением (lib/gain.js) ──
if command -v node >/dev/null 2>&1; then
  PN "select jsonb_build_object('cases', jsonb_build_array($G1, $G2, $G3, $(AT 2026-10-01 2026-11-01), $(AT 2026-10-01 2026-10-01)),
      'texts', jsonb_build_array(_sa_gain_text($G1), _sa_gain_text($G2), _sa_gain_text($G3), _sa_gain_text($(AT 2026-10-01 2026-11-01)), _sa_gain_text($(AT 2026-10-01 2026-10-01))),
      'kb', _sa_gain_kb($G1), 'has', jsonb_build_array(_sa_gain_has($G1), _sa_gain_has($(AT 2026-08-01 2026-09-02))))" > "$D/gain.json"
  JS=$(node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const G = await import('file://$LIB/gain.js');
    const x = JSON.parse(readFileSync('$D/gain.json', 'utf8'));
    const out = [];
    x.cases.forEach((c, i) => out.push((G.gainText(c) === x.texts[i] ? 'OK ' : 'DIFF ') + 'text' + i + (G.gainText(c) === x.texts[i] ? '' : '\n' + G.gainText(c) + '\n---\n' + x.texts[i])));
    const go = G.gainKb(x.cases[0])[0][0], url = x.kb[0][0].url || (x.kb[0][0].web_app && x.kb[0][0].web_app.url) || '';
    out.push(((url.endsWith('?go=' + go.go) || url.endsWith('?startapp=go_' + go.go)) && x.kb[0][0].text === go.text ? 'OK ' : 'DIFF ') + 'kb ' + url + ' ' + go.go);
    out.push((G.gainHas(x.cases[0]) === x.has[0] ? 'OK ' : 'DIFF ') + 'has');
    process.stdout.write(out.join('\n'));" 2>&1)
  chk "приложение (lib/gain.js) пишет тот же текст бота и ту же кнопку" "$(echo "$JS" | grep -c '^OK ') $(echo "$JS" | grep -A12 '^DIFF' | head -24)" '^7 *$'
else
  echo "· node нет — сверку с lib/gain.js пропускаю"
fi

# ── экран: gain_month ──
chk "руководителю — итог своего заведения: текущий и прошлый месяц, Telegram (бота нет, связка есть)" \
  "$(Q "select concat_ws('|', b->>'ok', b->>'rest', jsonb_array_length(b->'months'), b->'months'->>0 = to_char((now() at time zone 'Asia/Kamchatka')::date, 'YYYY-MM'), b->>'today' = to_char((now() at time zone 'Asia/Kamchatka')::date, 'YYYY-MM-DD'), b->'tg'->>'bot', b->'tg'->>'linked') from (select gain_month('$MARIA') b) x")" \
  '^true\|Два моря, Океан\|2\|t\|t\|false\|true$'
chk "прошлый месяц — можно, позапрошлый и мусор — month; сотруднику — forbidden; без входа — auth" \
  "$(Q "select concat_ws('|', gain_month('$PETR', to_char((now() at time zone 'Asia/Kamchatka')::date - interval '1 month', 'YYYY-MM'))->>'ok', gain_month('$PETR', to_char((now() at time zone 'Asia/Kamchatka')::date - interval '2 month', 'YYYY-MM'))->>'error',
     gain_month('$PETR', 'x')->>'error', gain_month('$ANNA')->>'error', gain_month('nope')->>'error', gain_month('$IVAN')->>'error')")" '^true\|month\|month\|forbidden\|auth\|forbidden$'
chk "владелец видит своё заведение; руководитель Порта — Порт" \
  "$(Q "select gain_month('$ROMAN')->>'rest' || '|' || (gain_month('$ROMAN')->>'team') || '|' || (gain_month('$IRINA')->>'rest') || '|' || (gain_month('$IRINA')->>'team')")" '^Два моря, Океан\|5\|Порт\|2$'

# ── «Прислать в Telegram» ──
chk "бота нет — no_bot" "$(Q "select gain_send_now('$MARIA')->>'error'")" '^no_bot$'
PP "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;
    insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;" >/dev/null
N333=$(sentn 333)
S1=$(Q "select gain_send_now('$MARIA', to_char((now() at time zone 'Asia/Kamchatka')::date - interval '1 month', 'YYYY-MM'))")
chk "Мария: итог прошлого месяца ушёл ей в Telegram — с заголовком месяца и кнопкой «Открыть итог»" \
  "$(echo "$S1" | grep -o '"sent": true') $(($(sentn 333) - N333)) $(lastsent 333 | head -1) $(PP "select body->'reply_markup'->'inline_keyboard'->0->0->>'text' || ' ' || (body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url') from net.sent_log where body->>'chat_id' = '333' order by id desc limit 1")" \
  "^\"sent\": true 1 <b>Что дало обучение · .+</b> Открыть итог https://app\.example/\?go=gain_$(date -d "$(TZ=Asia/Kamchatka date +%Y-%m-15) -1 month" +%Y-%m)$"
chk "второй раз в ту же минуту — too_fast; сотруднику — forbidden; руководителю без Telegram — not_linked" \
  "$(Q "select concat_ws('|', gain_send_now('$MARIA')->>'error', gain_send_now('$ANNA')->>'error', gain_send_now('$IRINA')->>'error')")" '^too_fast\|forbidden\|not_linked$'

# ── 1-го числа: итог прошлого месяца руководителям ──
PP "insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values ('$IREMP', 555, 'Порт', 'Ирина Портова', true) on conflict (emp_id) do update set remind = true, chat_id = 555;
    delete from quiz_events where restaurant = 'Порт'; delete from sa_guest_thanks where restaurant = 'Порт'; delete from sa_newbies where restaurant = 'Порт';
    update emp_learning set data = '{}'::jsonb where emp_id = '$VEMP';" >/dev/null
DUE() { PP "select jsonb_array_length(_sa_gain_due(true, '$1'::timestamptz))"; }
chk "1 ноября в 9:59 — рано; 31 октября — не тот день" "$(DUE '2026-11-01 09:59+12') $(DUE '2026-10-31 12:00+12') $(sentn 444)" '^0 0 0$'
B444=$(sentn 444)
chk "1 ноября в 10:05 — итог октября Марии и Петру (Порту сказать нечего — не шлём)" "$(DUE '2026-11-01 10:05+12') $(($(sentn 444) - B444)) $(sentn 555)" '^2 1 0$'
TOCT=$(PN "select _sa_gain_text(_sa_gain_at('$R0', '2026-10-01', '2026-11-01'))")
chk "текст — итог всего октября против сентября" "$(same "$(lastsent 444)" "$TOCT") $(echo "$TOCT" | sed -n '2p;5p;10,11p;13p' | tr '\n' '|')" \
  '^SAME Два моря, Океан · сравниваем с сентябрём\|Уроков: 9, было 8\|«Спасибо» от гостей: 4, было 1\|Ошибок в тестах: 17%, было 42%\|«Спасибо» от коллег: 2, было 0\|$'
chk "новички октября — 3 за 7 дней в среднем (8, 4 и 10)" "$(echo "$TOCT" | grep 'Новички')" '^Новички до самостоятельной смены: 7 дней, было 16$'
chk "второй запуск 1-го — ничего; в 21:00 и 2 ноября — тоже" "$(DUE '2026-11-01 10:15+12') $(DUE '2026-11-01 21:00+12') $(DUE '2026-11-02 10:05+12') $(sentn 444)" "^0 0 0 $((B444 + 1))$"
chk "просмотр владельца: оба руководителя, октябрь, уже ушло; Ирина — нечего сказать" \
  "$(PP "select string_agg(x->>'name' || ':' || (x->>'month') || ':' || (x->>'sent'), ',' order by x->>'name') from jsonb_array_elements(_sa_gain_due(false, '2026-11-01 15:00+12', true)) x")" '^Мария:2026-10:true,Пётр:2026-10:true$'
# ошибка в одном заведении не мешает другим: временно ломаем итог «boom» (в ноябре Анна занималась — есть что сказать)
PP "update emp_learning set data = jsonb_set(data, '{activity,2026-11-05}', '{\"st\": 1, \"l\": 1}') where emp_id = '$AEMP';" >/dev/null
PP "insert into employees (id, name, surname, restaurant, position, is_admin, status) values ('00000000-0000-0000-0000-0000000000d1', 'Борис', 'Бум', 'boom', 'manager', false, 'active');
    insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values ('00000000-0000-0000-0000-0000000000d1', 777, 'boom', 'Борис Бум', true);
    alter function _sa_gain_at(text, date, date) rename to _sa_gain_at_real;
    create function _sa_gain_at(p_rest text, p_month date, p_today date) returns jsonb language plpgsql as \$f\$
    begin if p_rest = 'boom' then raise exception 'поломка'; end if; return _sa_gain_at_real(p_rest, p_month, p_today); end \$f\$;" >/dev/null
WARN=$($P -c "select jsonb_array_length(_sa_gain_due(true, '2026-12-01 10:05+12'))" 2>&1 | tr '\n' ' ')
chk "1 декабря: в «boom» поломка — предупреждение, Мария и Пётр итог ноября всё равно получили" \
  "$WARN $(lastsent 333 | head -1)" 'Что дало обучение: итог для 00000000-0000-0000-0000-0000000000d1 не ушёл: поломка.* 2 +<b>Что дало обучение · ноябрь</b>$'
PP "drop function _sa_gain_at(text, date, date); alter function _sa_gain_at_real(text, date, date) rename to _sa_gain_at;" >/dev/null

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
run $S43; run $S43
chk "с pg_cron: задание «sa-gain» раз в 10 минут, повторный запуск — одно; итог на месте" \
  "$RC $(PP "select count(*) || ' ' || string_agg(schedule || ' ' || command, '') from cron.job where jobname = 'sa-gain'") $(echo "$OUT43" | grep -o 'расписание: [^·]*·') $(PP "select $G1->>'ok'")" \
  '^0 1 \*/10 \* \* \* \* select public\.sa_gain_tick\(\) расписание: каждые 10 минут \(sa-gain\) · true$'

# ── права ──
chk "anon: 2 функции этапа — можно; служебные — нельзя" \
  "$(PP "select count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname in ('gain_month', 'gain_send_now')) || ' ' || count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('gain_month', 'gain_send_now')) || ' из ' || count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like '\_sa\_gn\_%' or p.proname like '\_sa\_gain%' or p.proname like 'sa\_gain%' or p.proname in ('gain_month', 'gain_send_now'))")" \
  '^2 0 из 22$'
chk "anon: итог заведения напрямую, просмотр и рассылка — нельзя" "$(Q "select _sa_gain_at('$R0', '2026-10-01', '2026-10-15')") $(Q "select sa_gain_preview()") $(Q "select sa_gain_tick()")" \
  'permission denied.*permission denied.*permission denied'

echo
echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
