#!/bin/bash
# Этап 62 (v199, Доп. 524): стены между заведениями и взгляд руководства сети по заведениям.
# Поверх базы run25.sh (этапы 7, 9, 15, 21, 22б, 24, 25; сотрудники «Два моря, Океан» и «Порт»): копия satest62,
# этапы меню (menu-server-stage4), 26, 29, 52, 61, 8, 8b, 28 → 62 дважды. Без этапа 21 — понятная ошибка. Итог этапа;
# результаты тестов — официанту и менеджеру своё (и свои прежние после перевода), сети всё; лига — у сотрудника только
# своё заведение, без кубка, место «в сети» = место в заведении, у сети — все и кубок; бот — без «в сети» и кубка;
# фото — своё заведение; меню: официант — нет, менеджер — своё, сеть — любое; «меню выучено» — в своё; график,
# публикации и пожелания — своё заведение, сеть — любое; org_view — только сеть, выбранное заведение по списку этапа 61:
# рекорды, мастера, кандидаты (и запись кандидата и итога AI HR) так, как их видит руководитель того заведения, после
# запроса — снова своё; трудные вопросы одного заведения; без входа — auth; повторный этап 25 возвращает прежнюю лигу —
# этап 62 снова её закрывает.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test62.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest62
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S62=supabase-stage62-venue-walls.sql
PRE="menu-server-stage4.sql supabase-stage26-mastery.sql supabase-stage29-bot-texts.sql supabase-stage52-staff-photos.sql supabase-stage61-places.sql supabase-stage8-candidates.sql supabase-stage8b-hire-access.sql supabase-stage28-ai-hr.sql supabase-stage25-live.sql"
D=$(mktemp -d); for f in $PRE $S62; do cp "$SRC/$f" "$D/"; done; cp "$HERE/base.sql" "$D/"; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
ANNA_ID=00000000-0000-0000-0000-0000000000a4; IVAN_ID=00000000-0000-0000-0000-0000000000b2
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }

# ── Без этапа 21 — понятная ошибка ─────────────────────────────────────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}x" -c "create database ${DB}x" >/dev/null 2>&1
$P0 -d ${DB}x -f "$D/base.sql" >/dev/null 2>&1
chk "без этапа 21: «Сначала этап 21»" "$($P0 -d ${DB}x -f "$D/$S62" 2>&1 | grep -o 'Сначала этап 21[^:]*' | head -1)" '^Сначала этап 21 \(supabase-stage21-private-data.sql\)$'
$P0 -d postgres -c "drop database if exists ${DB}x" >/dev/null 2>&1

for f in menu-server-stage4.sql supabase-stage26-mastery.sql supabase-stage29-bot-texts.sql supabase-stage52-staff-photos.sql supabase-stage61-places.sql \
  supabase-stage8-candidates.sql supabase-stage8b-hire-access.sql supabase-stage28-ai-hr.sql; do run $f; done
chk "этапы меню, 26, 29, 52, 61, 8, 8b, 28 — без ошибок" "$RC" '^0$'
# данные: результаты и ответы «Порта», рекорды, фото, кандидаты
PP "insert into scores (name, surname, restaurant, role, position, quiz_id, score, total) values ('Ирина', 'Портова', 'Порт', 'manager', 'manager', 's0-q', 10, 12)" >/dev/null
PP "insert into scores (name, surname, restaurant, role, position, quiz_id, score, total) values ('Анна', 'Смирнова', 'Порт', 'waiter', 'waiter', 's0-old', 7, 10)" >/dev/null   # прежнее заведение Анны
PP "insert into achievements (employee_id, key, value) values ('$ANNA_ID', 'streak', 5), ('$IVAN_ID', 'streak', 9)" >/dev/null
PP "insert into quiz_events (restaurant, employee, role_id, lesson_id, question, correct, answer, right_answer, ts) select 'Порт', 'Иван Петров', 'seasonal', 's0-q', 'Портовый вопрос', false, 'а', 'б', now() - interval '1 hour' from generate_series(1, 3)" >/dev/null
PP "insert into sa_staff_photos (emp_id, data, thumb, ver) values ('$ANNA_ID', 'A', 'a', 'v1'), ('$IVAN_ID', 'B', 'b', 'v1')" >/dev/null
PP "insert into candidate_results (restaurant, payload, created_by) values ('Порт', '{\"name\":\"Кандидат Порта\"}', 'Ирина Портова')" >/dev/null
# в макете базы menu_progress создан раньше этапа меню (base.sql) — без его ключа; в Supabase ключ есть
PP "alter table menu_progress add constraint menu_progress_key unique (restaurant, employee, wave, status)" >/dev/null 2>&1

# ── Этап 62 дважды ─────────────────────────────────────────────────────────────────────────────────────────────────
RC=0; run $S62
chk "этап 62: итог — тесты, лига, фото, меню, график; бот без «в сети»; взгляд сети" "$(echo "$OUT" | grep -o 'стены между заведениями: .*' | head -1)" \
  '^стены между заведениями: тесты, лига, фото, меню, график · бот: без «в сети» · взгляд сети: да$'
run $S62
chk "этап 62 ещё раз — без ошибок, то же" "$RC $(echo "$OUT" | grep -o 'стены между заведениями: .*' | head -1)" \
  '^0 стены между заведениями: тесты, лига, фото, меню, график · бот: без «в сети» · взгляд сети: да$'

# ── Результаты тестов ──────────────────────────────────────────────────────────────────────────────────────────────
SC() { Q "select (r->>'scope') || ' ' || (select string_agg(distinct x->>'restaurant', ', ' order by x->>'restaurant') from jsonb_array_elements(r->'rows') x) from (select team_scores('$1') r) t"; }
chk "официант «Двух морей» — своё заведение и свой прежний результат из «Порта», чужих из «Порта» нет" \
  "$(SC $ANNA) / $(Q "select string_agg(x->>'name', ',' order by x->>'name') from jsonb_array_elements(team_scores('$ANNA')->'rows') x where x->>'restaurant' = 'Порт'")" '^restaurant Два моря, Океан, Порт / Анна$'
chk "менеджер «Порта» — только «Порт»" "$(SC $IRINA)" '^restaurant Порт$'
chk "руководящий состав и владелец — вся сеть" "$(SC $MARIA) | $(SC $ROMAN)" '^all Два моря, Океан, Порт \| all Два моря, Океан, Порт$'

# ── Лига ───────────────────────────────────────────────────────────────────────────────────────────────────────────
LG() { Q "select coalesce(r->>'scope', 'сеть') || ' ' || coalesce((select string_agg(distinct x->>'restaurant', ', ') from jsonb_array_elements(r->'rows') x), '—') || ' кубок:' || jsonb_array_length(r->'cup') || ' история:' || jsonb_array_length(r->'cup_hist') from (select league_week('$1') r) t"; }
chk "лига у официанта — своё заведение, без кубка" "$(LG $ANNA)" '^restaurant (Два моря, Океан|—) кубок:0 история:0$'
chk "у сотрудника «Порта» — только «Порт»" "$(LG $IVAN)" '^restaurant (Порт|—) кубок:0 история:0$'
chk "место «в сети» = место в заведении (prev_net = prev_rest у всех строк)" \
  "$(Q "select count(*) filter (where (x->'prev_net') is distinct from (x->'prev_rest')) from jsonb_array_elements(league_week('$ANNA')->'rows') x")" '^0$'
chk "у владельца лига как была: без scope, кубок по заведениям" "$(Q "select coalesce(r->>'scope', 'нет') || ' ' || (jsonb_array_length(r->'cup') >= 1) from (select league_week('$ROMAN') r) t")" '^нет true$'
chk "бот: в итогах недели нет «в сети» и «Кубок заведений»" \
  "$(PP "select (pg_get_functiondef('public._sa_nudges_at(boolean, timestamp with time zone)'::regprocedure) like '%-е в сети%')::text || ' ' || (pg_get_functiondef('public._sa_nudges_at(boolean, timestamp with time zone)'::regprocedure) like '%Кубок заведений у%')::text || ' ' || (pg_get_functiondef('public._sa_nudges_at(boolean, timestamp with time zone)'::regprocedure) like '%-е место в заведении%')::text")" '^false false true$'

# ── Фото ───────────────────────────────────────────────────────────────────────────────────────────────────────────
PH() { Q "select coalesce((select string_agg(x->>'name', ', ' order by x->>'name') from jsonb_array_elements(staff_photos('$1')->'items') x), '—')"; }
chk "фото: официант «Двух морей» — только свои (Анна)" "$(PH $ANNA)" '^Анна$'
chk "фото: сотрудник «Порта» — только «Порт» (Иван)" "$(PH $IVAN)" '^Иван$'
chk "фото: владелец — все" "$(PH $ROMAN)" '^Анна, Иван$'

# ── Меню ───────────────────────────────────────────────────────────────────────────────────────────────────────────
MS() { Q "select menu_set('$1', '$2', '[]')->>'ok' || coalesce(' ' || (menu_set('$1', '$2', '[]')->>'error'), '')"; }
chk "меню: официант сохранить не может" "$(MS $ANNA 'Два моря, Океан')" '^false forbidden$'
chk "меню: менеджер «Порта» — своё да, чужое нет" "$(MS $IRINA 'Порт') / $(MS $IRINA 'Два моря, Океан')" '^true / false forbidden$'
chk "меню: руководящий состав и владелец — любое" "$(MS $MARIA 'Порт') / $(MS $ROMAN 'Алёнка')" '^true / true$'
chk "меню: без заведения — bad_request" "$(MS $ROMAN '')" '^false bad_request$'
Q "select menu_progress_set('$ANNA', 'Порт', 'w1', 'passed', 9)" >/dev/null
Q "select menu_progress_set('$ROMAN', 'Порт', 'w1', 'passed', 7)" >/dev/null
chk "«меню выучено»: официант пишет в своё заведение, владелец — в выбранное" \
  "$(PP "select string_agg(employee || ':' || restaurant, ', ' order by employee) from menu_progress where wave = 'w1'")" '^Анна Смирнова:Два моря, Океан, Роман Владелец:Порт$'

# ── График ─────────────────────────────────────────────────────────────────────────────────────────────────────────
SL() { Q "select coalesce(r->>'ok', '') || coalesce(' ' || (r->>'error'), '') from (select to_jsonb(schedule_load('$1', '$2', to_char(now(), 'YYYY-MM'))) r) t"; }
chk "график: официант — своё да, «Порт» нет" "$(SL $ANNA 'Два моря, Океан') / $(SL $ANNA 'Порт')" '^true / false forbidden$'
chk "график: менеджер «Порта» — свой; владелец — любой" "$(SL $IRINA 'Порт') / $(SL $ROMAN 'Порт')" '^true / true$'
chk "публикации графика: официант «Порт» — нет" "$(Q "select to_jsonb(schedule_publications_list('$ANNA', 'Порт', 'main', '2026-11'))->>'error'")" '^forbidden$'
chk "пожелание: своё в своё заведение — дальше проверки (нет месяца), в «Порт» — нет" \
  "$(Q "select to_jsonb(schedule_set_wish('$ANNA', 'Два моря, Океан', 'zzz', '2026-01', '$ANNA_ID', '3', 'О'))->>'error'") / $(Q "select to_jsonb(schedule_set_wish('$ANNA', 'Порт', 'main', '2026-11', '$ANNA_ID', '3', 'О'))->>'error'")" '^no_month / forbidden$'

# ── Взгляд сети: org_view ──────────────────────────────────────────────────────────────────────────────────────────
OV() { Q "select org_view('$1', '$2', '$3', '$4'::jsonb)::text"; }
chk "org_view: официант и менеджер — нельзя" "$(Q "select org_view('$ANNA', 'Порт', 'team_achievements')->>'error'") / $(Q "select org_view('$IRINA', 'Два моря, Океан', 'team_achievements')->>'error'")" '^forbidden / forbidden$'
chk "org_view: владелец — рекорды «Порта» (Иван), а свои — «Двух морей» (Анна)" \
  "$(Q "select string_agg(x->>'name', ',') from jsonb_array_elements(org_view('$ROMAN', 'Порт', 'team_achievements')->'rows') x") / $(Q "select string_agg(x->>'name', ',') from jsonb_array_elements(team_achievements('$ROMAN')->'rows') x")" '^Иван / Анна$'
chk "org_view: после запроса снова своё заведение (выбор живёт один запрос)" \
  "$(Q "select (org_view('$ROMAN', 'Порт', 'team_achievements')->>'ok') || ' ' || (_sa_caller('$ROMAN')->>'restaurant')" 2>&1)" '^true Два моря, Океан$|permission denied'
chk "org_view: мастера «Порта» — ответ как у руководителя заведения (приз можно назначать)" "$(Q "select (r->>'ok') || ' ' || (r->>'can_prize') || ' ' || jsonb_typeof(r->'rows') from (select org_view('$ROMAN', 'Порт', 'mastery_list') r) t")" '^true true array$'
chk "org_view: кандидаты «Порта» владельцу — через взгляд да, напрямую нет (как было)" \
  "$(Q "select jsonb_array_length(org_view('$ROMAN', 'Порт', 'candidate_list')->'items')") / $(Q "select to_jsonb(candidate_list('$ROMAN', 'Порт'))->>'error'")" '^1 / forbidden$'
chk "org_view: владелец сохраняет кандидата и итог AI HR в «Порт» — запись именно в «Порт»" \
  "$(Q "select (org_view('$ROMAN', 'Порт', 'candidate_save', jsonb_build_object('p_result', '{\"name\":\"Новый для Порта\"}'))->>'ok') || ' ' || (org_view('$ROMAN', 'Порт', 'hr_quality_save', jsonb_build_object('p_payload', '{\"score\":7}'))->>'ok')") / $(PP "select string_agg(restaurant, ',' order by restaurant) from candidate_results where payload->>'name' = 'Новый для Порта'") / $(PP "select restaurant || ':' || (payload->>'score') from hr_quality")" \
  '^true true / Порт / Порт:7$'
chk "org_view: незнакомое заведение — no_venue, чужая функция — bad_fn, пусто — bad_request" \
  "$(Q "select org_view('$ROMAN', 'Кафе', 'team_achievements')->>'error'") $(Q "select org_view('$ROMAN', 'Порт', 'drop_all')->>'error'") $(Q "select org_view('$ROMAN', ' ', 'team_achievements')->>'error'")" '^no_venue bad_fn bad_request$'
chk "org_view: функции, которой нет на сервере (этап 43 не стоит), — no_stage" "$(Q "select org_view('$ROMAN', 'Порт', 'gain_month', '{\"p_month\":\"2026-11\"}')->>'error'")" '^no_stage$'

# ── Трудные вопросы одного заведения ───────────────────────────────────────────────────────────────────────────────
HQ() { Q "select coalesce(string_agg(question, ' | '), '—') from quiz_hard_questions_at('$1', '$2')"; }
chk "трудные вопросы: владелец — «Порт»" "$(HQ $ROMAN 'Порт')" '^Портовый вопрос$'
chk "менеджер «Порта» просит «Два моря» — получает свой «Порт»" "$(HQ $IRINA 'Два моря, Океан')" '^Портовый вопрос$'
chk "официант — ничего" "$(HQ $ANNA 'Порт')" '^—$'

# ── Вход, права ────────────────────────────────────────────────────────────────────────────────────────────────────
chk "без входа — auth" "$(Q "select concat_ws(' ', team_scores('x')->>'error', league_week('x')->>'error', staff_photos('x')->>'error', menu_set('x', 'Порт', '[]')->>'error', org_view('x', 'Порт', 'team_achievements')->>'error')")" '^auth auth auth auth auth$'
chk "служебное закрыто для anon" "$(Q "select _sa_league_week_all('$ANNA')") / $(Q "select _sa_rest_ok('{}'::jsonb, 'x')")" 'permission denied.*/.*permission denied'

# ── Этап 25 заново — лига снова на всю сеть; этап 62 ещё раз — снова только своё ─────────────────────────────────────
RC=0; run supabase-stage25-live.sql
chk "после повторного этапа 25 лига у официанта снова сетевая (так и предупреждает шапка этапа 62)" "$(LG $ANNA)" '^сеть .*кубок:[1-9]'
run $S62
chk "этап 62 ещё раз — лига снова только своё заведение" "$RC $(LG $ANNA)" '^0 restaurant (Два моря, Океан|—) кубок:0 история:0$'

echo
echo "проверок: $((pass + fail)), ✓ $pass, ✗ $fail"
[ $fail -eq 0 ]
