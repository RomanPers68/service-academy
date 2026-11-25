#!/bin/bash
# Этап 60 (v194, Доп. 519): «что выбрал» в тесте ложится в свою попытку — у ошибки больше не стоит верный ответ.
# Поверх базы run25.sh (этапы 7 и 15): копия satest60. Сначала прежний log_quiz_pick (этап 15) и гонка, как в
# приложении до v194 (оба вызова разом, «что выбрал» приходит раньше записи ответа): верный ответ ложится в прошлую
# ошибку, неверный — в прошлый верный; «Аналитика → Люди» показывает у ошибки верный ответ. Потом этап 60 дважды:
# починка (и 0 при повторе), записи сида не тронуты; новый log_quiz_pick — по порядку пишет в свою запись, при гонке
# не трогает чужую попытку; вход, права, индекс; повтор этапа 15 возвращает прежнее — этап 60 снова; без этапа 15 —
# понятная ошибка.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test60.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest60
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S60=supabase-stage60-quiz-pick.sql; S15=supabase-stage15-quiz-retries.sql
D=$(mktemp -d); cp "$SRC/$S60" "$SRC/$S15" "$D/"; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; ROMAN=10000000-0000-0000-0000-0000000000a1
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
# ответ в тесте: как App.jsx handleQuiz — запись ответа (этап 7) и «что выбрал» (этап 15)
ANS() { Q "select log_quiz_answer('$ANNA', 'seasonal', '$1', '$2', $3)->>'ok'"; }
PICK() { Q "select log_quiz_pick('$ANNA', '$1', '$2', '$3', '$4')::text"; }
ROW() { PP "select string_agg(correct::text || ':' || coalesce(answer, '∅'), ' | ' order by id) from quiz_events where question = '$1'"; }
PEOPLE() { Q "select coalesce(last_answer, '∅') || ' / ' || coalesce(right_answer, '∅') || ' / ' || fails from quiz_people('$ROMAN') where question = '$1'"; }

Q1='Гость-молчун ничего не просит и почти не реагирует. Тактика:'; R1='Работаю чётко и быстро, без лишних вопросов'
W1='Завожу лёгкий разговор, чтобы он расслабился'
Q2='Гость торопится. Что важнее всего сказать при рекомендации?'; R2='Называю быстрые блюда и время их готовки'
W2='Называю фирменное блюдо: его хвалят все'

# ── До этапа 60: гонка, как в приложении до v194 ─────────────────────────────────────────────────────────────────
# вопрос 1: ошибся («что выбрал» пришло раньше записи — лечь некуда), потом ответил верно (снова раньше) — ложится в ошибку
PICK s2-q "$Q1" "$W1" "$R1" >/dev/null; ANS s2-q "$Q1" false >/dev/null
PICK s2-q "$Q1" "$R1" "$R1" >/dev/null; ANS s2-q "$Q1" true >/dev/null
# вопрос 2: ответил верно (без «что выбрал»), потом ошибся с гонкой — неверный ложится в верный
ANS s2-q "$Q2" true >/dev/null; PICK s2-q "$Q2" "$W2" "$R2" >/dev/null; ANS s2-q "$Q2" false >/dev/null
chk "до этапа 60: у ошибки «что выбрал» — верный ответ (гонка)" "$(ROW "$Q1")" "^false:$R1 \| true:∅$"
chk "до этапа 60: у верного ответа — чужой неверный" "$(ROW "$Q2")" "^true:$W2 \| false:∅$"
chk "до этапа 60: «Люди» — «Выбрал» = «Верно» у ошибки (снимок владельца)" "$(PEOPLE "$Q1")" "^$R1 / $R1 / 1$"

# ── Этап 60 дважды ─────────────────────────────────────────────────────────────────────────────────────────────────
run $S60
chk "этап 60: итог — своя попытка, починено 2 записи" "$(echo "$OUT" | grep -o 'что выбрал: .*' | head -1)" \
  '^что выбрал: своя попытка — да · починено записей: 2 \(у ошибки стоял верный ответ: 1, у верного ответа — другой: 1\)$'
run $S60
chk "этап 60 ещё раз — без ошибок, чинить нечего" "$RC $(echo "$OUT" | grep -o 'починено записей: [0-9]*' | head -1)" '^0 починено записей: 0$'
chk "после починки: у ошибки «что выбрал» стёрто, сама ошибка осталась" "$(ROW "$Q1")" '^false:∅ \| true:∅$'
chk "после починки: у верного ответа — верный" "$(ROW "$Q2")" "^true:$R2 \| false:∅$"
chk "записи сида не тронуты (честная ошибка и честный верный)" \
  "$(PP "select string_agg(id || ':' || correct::text || ':' || coalesce(answer, '∅'), ' | ' order by id) from quiz_events where id <= 4")" \
  '^1:false:Угадать \| 2:true:Уточнить у шефа \| 3:false:Сзади \| 4:false:Сзади$'
chk "«Люди» после починки: у ошибки «Выбрал» пусто, «Верно» на месте" "$(PEOPLE "$Q1")" "^∅ / $R1 / 1$"

# ── Новый log_quiz_pick ────────────────────────────────────────────────────────────────────────────────────────────
Q3='Личные разговоры с коллегами в зале при гостях:'; R3='Недопустимы: гость чувствует себя лишним'; W3='Допустимы, если говорить вполголоса'
chk "по порядку (v194): ошибка — запись, потом «что выбрал» в неё" "$(ANS s2-q "$Q3" false) $(PICK s2-q "$Q3" "$W3" "$R3")" '^true \{"ok" : true, "found" : true\}$'
chk "гонка (старое приложение): верный пришёл раньше своей записи — в ошибку не ложится" "$(PICK s2-q "$Q3" "$R3" "$R3")" '"found" : false'
ANS s2-q "$Q3" true >/dev/null
chk "ошибка хранит свой неверный ответ, верная попытка — без «что выбрал»" "$(ROW "$Q3")" "^false:$W3 \| true:∅$"
chk "«Люди»: «Выбрал» — неверный, «Верно» — верный" "$(PEOPLE "$Q3")" "^$W3 / $R3 / 1$"
chk "по порядку: верный ответ — в свою запись" "$(ANS s2-q "$Q3" true) $(PICK s2-q "$Q3" "$R3" "$R3")" '^true \{"ok" : true, "found" : true\}$'
chk "неверный «что выбрал» не ложится в пустой верный ответ" "$(PICK s2-q "$Q3" "$W3" "$R3")" '"found" : false'
chk "в итоге по вопросу 3: ошибка, верный без текста, верный с верным" "$(ROW "$Q3")" "^false:$W3 \| true:∅ \| true:$R3$"
Q4='Гость спрашивает, где туалет. Что делаешь?'; R4='Провожаю или показываю рукой, улыбаюсь'; W4='Говорю: «Там, направо»'
chk "старое приложение, первая же ошибка с гонкой: текст теряется, но в чужое не ложится" \
  "$(PICK s2-q "$Q4" "$W4" "$R4") $(ANS s2-q "$Q4" false) $(ROW "$Q4")" '"found" : false\} true false:∅$'
chk "другой тест с тем же вопросом — не его запись" "$(ANS s1-q "$Q4" false) $(PICK s2-q "$Q4" "$W4" "$R4") $(ROW "$Q4")" '^true \{"ok" : true, "found" : true\} false:'"$W4"' \| false:∅$'
chk "без входа (чужой токен) — auth, ничего не записано" "$(Q "select log_quiz_pick('10000000-0000-0000-0000-0000000000ff', 's1-q', '$Q4', 'x', 'y')->>'error'") $(ROW "$Q4")" '^auth false:'"$W4"' \| false:∅$'

# ── Права, индекс, служебное ───────────────────────────────────────────────────────────────────────────────────────
chk "поиск записи снаружи не вызвать (anon)" "$(Q "select _sa_quiz_pick_row('Анна Смирнова', 's2-q', 'x', true)")" 'permission denied'
chk "log_quiz_pick — от имени владельца базы, anon может звать" \
  "$(PP "select prosecdef from pg_proc where proname = 'log_quiz_pick'") $(PP "select has_function_privilege('anon', 'log_quiz_pick(text, text, text, text, text)', 'execute')")" '^t t$'
chk "индекс по записям без «что выбрал»" "$(PP "select indexdef from pg_indexes where indexname = 'quiz_events_wait_pick'")" 'WHERE \(answer IS NULL\)'
chk "поиск пользуется индексом" "$(PP "set enable_seqscan = off; explain select _sa_quiz_pick_row('Анна Смирнова', 's2-q', 'x', true); explain select id from quiz_events where employee = 'Анна Смирнова' and lesson_id = 's2-q' and question = 'x' and answer is null and correct = true order by ts desc, id desc limit 1")" 'quiz_events_wait_pick'

# ── Повтор этапа 15 возвращает прежний log_quiz_pick — этап 60 ещё раз ───────────────────────────────────────────
run $S15
chk "после повторного этапа 15 — прежний log_quiz_pick" "$(PP "select pg_get_functiondef('log_quiz_pick(text, text, text, text, text)'::regprocedure) like '%_sa_quiz_pick_row%'")" '^f$'
run $S60
chk "этап 60 снова — своя попытка: да" "$(echo "$OUT" | grep -o 'что выбрал: своя попытка — [^ ]*' | head -1)" '^что выбрал: своя попытка — да$'
chk "все запуски — без ошибок" "$RC" '^0$'

# ── Без этапа 15 — понятная ошибка ─────────────────────────────────────────────────────────────────────────────────
DB2=satest60b
$P0 -d postgres -c "drop database if exists $DB2" -c "create database $DB2 template satest25" >/dev/null 2>&1
psql -h $PGH -p $PGP -U postgres -q -d $DB2 -c "drop function log_quiz_pick(text, text, text, text, text)" >/dev/null 2>&1
chk "без этапа 15 — «Сначала этап 15»" "$($P0 -d $DB2 -f "$D/$S60" 2>&1 | tr '\n' ' ')" 'Сначала этап 15'
$P0 -d postgres -c "drop database if exists $DB2" >/dev/null 2>&1

echo; echo "проверок: $((pass + fail)), прошло $pass, упало $fail"
[ $fail -eq 0 ]
