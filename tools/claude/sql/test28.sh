#!/bin/bash
# Этап 28 (v66, Доп. 379): AI HR — «Ваше решение» по кандидату, итог «Проверки AI HR», сверка ресторана в истории
# собеседований. Поверх базы run25.sh: копия satest28, этапы 8 и 8б (как у владельца), этап 28 — дважды
# (повторный запуск безопасен), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test28.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest28
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
D=$(mktemp -d); cp "$SRC"/supabase-stage8-candidates.sql "$SRC"/supabase-stage8b-hire-access.sql "$SRC"/supabase-stage28-ai-hr.sql "$D"/; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:500}"; fail=$((fail+1)); fi; }
OWN=10000000-0000-0000-0000-0000000000a1    # Роман, владелец (is_admin), «Два моря, Океан»
MAR=10000000-0000-0000-0000-0000000000a2    # Мария Ким, senior, «Два моря, Океан»
PET=10000000-0000-0000-0000-0000000000a3    # Пётр Иванов, manager, «Два моря, Океан»
ANN=10000000-0000-0000-0000-0000000000a4    # Анна, официант
IRA=10000000-0000-0000-0000-0000000000b1    # Ирина Портова, manager, «Порт»
R1='Два моря, Океан'

RC=0
for f in supabase-stage8-candidates.sql supabase-stage8b-hire-access.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
done
# как было до этапа 28: руководитель «Порта» читает историю «Двух морей», подставив название
$P -c "insert into candidate_results (restaurant, payload, created_by) values ('$R1', '{\"id\":\"old1\",\"name\":\"Старый\"}', 'Пётр Иванов')" >/dev/null
chk "до этапа 28: руководитель другого ресторана читал чужую историю (дыра, которую закрываем)" "$(Q "select candidate_list('$IRA', '$R1')")" '"ok" : true.*Старый|"ok": true.*Старый'
for f in supabase-stage28-ai-hr.sql supabase-stage28-ai-hr.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
done
chk "этапы 8, 8б и 28 (28 — дважды) — без ошибок" "$RC" '^0$'

# ── история: свои — как раньше, чужие — нет ──
S1=$(Q "select candidate_save('$PET', '$R1', '{\"id\":\"k1\",\"name\":\"Ольга\",\"aiScores\":{\"Сервис и гость\":80},\"decSync\":false,\"srvId\":5}')")
chk "менеджер сохраняет собеседование своего ресторана" "$S1" '"ok" : true, "id" : [0-9]+|"ok": true, "id": [0-9]+'
K1=$(PP "select id from candidate_results where payload->>'id' = 'k1'")
chk "служебные поля телефона (decSync, srvId) в запись на сервере не попадают" "$(PP "select (payload ? 'decSync')::text || ',' || (payload ? 'srvId')::text || ',' || created_by from candidate_results where id = $K1")" '^false,false,Пётр Иванов$'
chk "список своего ресторана: менеджер, senior и владелец видят записи" "$(Q "select (candidate_list('$PET', '$R1')->'items')::text || (candidate_list('$MAR', '$R1')->>'ok') || (candidate_list('$OWN', '$R1')->>'ok')")" 'Ольга.*truetrue$'
chk "руководитель «Порта» больше не читает «Два моря» — forbidden" "$(Q "select candidate_list('$IRA', '$R1')")" '"error" : "forbidden"|"error": "forbidden"'
chk "…и не сохраняет туда" "$(Q "select candidate_save('$IRA', '$R1', '{\"id\":\"x\"}')")" 'forbidden'
chk "…и не удаляет чужое (ни подставив название, ни через свой ресторан)" "$(Q "select candidate_delete('$IRA', '$R1', $K1)::text || candidate_delete('$IRA', 'Порт', $K1)::text"; PP "select count(*) from candidate_results where id = $K1")" 'forbidden.*"ok" ?: true\}1$'
chk "свой список у «Порта» — пустой, но работает" "$(Q "select candidate_list('$IRA', 'Порт')")" '"items" : \[\]|"items": \[\]'
chk "официант — forbidden; мусорный токен — auth" "$(Q "select (candidate_list('$ANN', '$R1')->>'error') || ',' || (candidate_list('мусор', '$R1')->>'error')")" '^forbidden,auth$'

# ── «Ваше решение» ──
chk "решение «Берём»: в записи decision, когда и кто" "$(Q "select candidate_decide('$PET', '$R1', $K1, 'hire')"; PP "select (payload->>'decision') || ',' || (payload->>'decidedBy') || ',' || (payload->>'decidedAt' ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$')::text from candidate_results where id = $K1")" '"ok" : true.*"decision" : "hire".*hire,Пётр Иванов,true$|"ok": true.*hire,Пётр Иванов,true$'
chk "решение видно в списке (внутри payload, как у приложения)" "$(Q "select candidate_list('$MAR', '$R1')->'items'->0->'payload'->>'decision'")" '^hire$'
chk "передумали: «Подумаю», потом «Не берём» — остаётся последнее; решил другой руководитель — его имя" "$(Q "select candidate_decide('$PET', '$R1', $K1, 'maybe')::text || candidate_decide('$MAR', '$R1', $K1, 'reject')::text" >/dev/null; PP "select (payload->>'decision') || ',' || (payload->>'decidedBy') from candidate_results where id = $K1")" '^reject,Мария Ким$'
chk "снять отметку (null) — полей решения нет, остальное на месте" "$(Q "select candidate_decide('$PET', '$R1', $K1, null)" >/dev/null; PP "select (payload ? 'decision')::text || ',' || (payload ? 'decidedAt')::text || ',' || (payload->>'name') from candidate_results where id = $K1")" '^false,false,Ольга$'
chk "неизвестное решение — bad_decision; нет записи — not_found" "$(Q "select (candidate_decide('$PET', '$R1', $K1, 'yes')->>'error') || ',' || (candidate_decide('$PET', '$R1', 999999, 'hire')->>'error')")" '^bad_decision,not_found$'
chk "чужой руководитель: подставил название — forbidden; через свой ресторан — not_found, запись не тронута" "$(Q "select (candidate_decide('$IRA', '$R1', $K1, 'hire')->>'error') || ',' || (candidate_decide('$IRA', 'Порт', $K1, 'hire')->>'error')"; PP "select coalesce(payload->>'decision', '—') from candidate_results where id = $K1")" '^forbidden,not_found—$'
chk "официант не может решать — forbidden" "$(Q "select candidate_decide('$ANN', '$R1', $K1, 'hire')->>'error'")" '^forbidden$'
# запись, пришедшая с телефона уже с решением (решили до того, как долетела) и с пометкой decSync — пометку убираем
$P -c "update candidate_results set payload = payload || '{\"decSync\": false}' where id = $K1" >/dev/null
chk "пометка телефона decSync в записи на сервере не остаётся" "$(Q "select candidate_decide('$PET', '$R1', $K1, 'hire')" >/dev/null; PP "select (payload ? 'decSync')::text || ',' || (payload->>'decision') from candidate_results where id = $K1")" '^false,hire$'

# ── «Проверка AI HR» ──
chk "нет проверки — item null" "$(Q "select hr_quality_get('$PET', '$R1')")" '"item" : null|"item": null'
chk "senior сохраняет итог проверки" "$(Q "select hr_quality_save('$MAR', '$R1', '{\"v\":1,\"n\":22,\"match\":21,\"missed\":0,\"pass\":true,\"model\":\"anthropic/claude-test\"}')")" '"ok" : true|"ok": true'
chk "менеджер того же ресторана видит тот же итог: кто и когда" "$(Q "select (hr_quality_get('$PET', '$R1')->'item'->'payload'->>'match') || ',' || (hr_quality_get('$PET', '$R1')->'item'->>'updated_by')")" '^21,Мария Ким$'
chk "перезапуск проверки — итог заменяется (одна строка на ресторан)" "$(Q "select hr_quality_save('$PET', '$R1', '{\"v\":1,\"n\":22,\"match\":19,\"pass\":false}')" >/dev/null; PP "select (select count(*) from hr_quality) || ',' || (payload->>'match') || ',' || updated_by from hr_quality where restaurant = '$R1'")" '^1,19,Пётр Иванов$'
chk "у «Порта» — свой итог (пусто); в «Два моря» подставить название — forbidden" "$(Q "select (hr_quality_get('$IRA', 'Порт')->>'item') is null")$(Q "select hr_quality_save('$IRA', '$R1', '{}')->>'error'")" '^tforbidden$'
chk "мусор вместо JSON и не объект — bad_payload; слишком большой — too_big; официант — forbidden" "$(Q "select (hr_quality_save('$PET', '$R1', 'не json')->>'error') || ',' || (hr_quality_save('$PET', '$R1', '[1,2]')->>'error') || ',' || (hr_quality_save('$PET', '$R1', repeat('x', 20001))->>'error') || ',' || (hr_quality_get('$ANN', '$R1')->>'error')")" '^bad_payload,bad_payload,too_big,forbidden$'

# ── права ──
chk "anon не читает таблицы напрямую (candidate_results, hr_quality)" "$(Q "select count(*) from hr_quality" 2>&1)$(Q "select count(*) from candidate_results" 2>&1)" 'permission denied.*permission denied'
chk "служебную _sa_hire_staff снаружи не позвать" "$(PP "select has_function_privilege('anon', 'public._sa_hire_staff(text)', 'execute')::text || has_function_privilege('authenticated', 'public._sa_hire_staff(text)', 'execute')::text")" '^falsefalse$'
chk "функции этапа доступны приложению (anon, authenticated)" "$(PP "select bool_and(has_function_privilege('anon', f, 'execute') and has_function_privilege('authenticated', f, 'execute')) from unnest(array['public.candidate_decide(text,text,bigint,text)','public.hr_quality_save(text,text,text)','public.hr_quality_get(text,text)','public.candidate_list(text,text)','public.candidate_save(text,text,text)','public.candidate_delete(text,text,bigint)']) f")" '^t$'
chk "отчёт этапа: все шесть функций на месте" "$($P0 -d $DB -t -A -f "$D/supabase-stage28-ai-hr.sql" 2>&1 | tr '\n' ' ')" 'этап 28: candidate_decide, candidate_delete, candidate_list, candidate_save, hr_quality_get, hr_quality_save'
echo
echo "итого: $pass ✓, $fail ✗"
