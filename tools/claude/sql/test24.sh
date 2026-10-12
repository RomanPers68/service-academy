#!/bin/bash
# Проверки этапа 24 (после run24.sh). Печатает ✓/✗ и итог.
set -u
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=${DB:-satest24}
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:400}"; fail=$((fail+1)); fi; }
OWN=10000000-0000-0000-0000-0000000000a1; SEN=10000000-0000-0000-0000-0000000000a2; MAN=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; BAR=10000000-0000-0000-0000-0000000000a5; FIRED=10000000-0000-0000-0000-0000000000a6
PMAN=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
EA=00000000-0000-0000-0000-0000000000a4; EB=00000000-0000-0000-0000-0000000000a5; EI=00000000-0000-0000-0000-0000000000b2; EM=00000000-0000-0000-0000-0000000000a3; ES=00000000-0000-0000-0000-0000000000a2; EO=00000000-0000-0000-0000-0000000000a1; EPM=00000000-0000-0000-0000-0000000000b1
$P -c "delete from emp_learning; delete from sa_pairs; delete from sa_settings" >/dev/null
D() { $P -c "select to_char((now() at time zone 'Asia/Kamchatka')::date - $1, 'YYYY-MM-DD')"; }
T0=$(D 0); T1=$(D 1); T2=$(D 2); T3=$(D 3); T4=$(D 4); T5=$(D 5); T6=$(D 6); T7=$(D 7); T8=$(D 8); T9=$(D 9)
DOW=$($P -c "select extract(isodow from (now() at time zone 'Asia/Kamchatka')::date)::int")
# копии с телефонов: Анна сегодня урок + разминка (20 очков), вчера 2 урока; Илья сегодня живой гость; Мария — 9 дней назад
Q "select sa_learning_push('$ANNA', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":2,\"l\":1,\"w\":1},\"$T1\":{\"st\":2,\"l\":2},\"$T2\":{\"st\":1,\"q\":1},\"$T9\":{\"st\":3,\"l\":3}},\"streak\":{\"count\":3,\"days\":[\"$T2\",\"$T1\",\"$T0\"],\"frozen\":[]}}'::jsonb)" >/dev/null
Q "select sa_learning_push('$BAR', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":1,\"g\":1},\"$T1\":{\"st\":1,\"m\":1},\"$T2\":{\"st\":0}},\"streak\":{\"count\":2,\"days\":[\"$T1\",\"$T0\"],\"frozen\":[\"$T2\"]}}'::jsonb)" >/dev/null
Q "select sa_learning_push('$SEN', '{\"v\":2,\"activity\":{\"$T9\":{\"st\":5,\"l\":5}}}'::jsonb)" >/dev/null
Q "select sa_learning_push('$IVAN', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":1,\"x\":1,\"f\":2,\"bad\":\"мусор\"}}}'::jsonb)" >/dev/null
Q "select sa_learning_push('$OWN', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":1,\"l\":1}}}'::jsonb)" >/dev/null
# ── служебное
chk "очки дня: урок 10 + разминка 10" "$($P -c "select _sa_day_points('{\"l\":1,\"w\":1,\"st\":2}'::jsonb)")" '^20$'
chk "очки дня: потолок 200" "$($P -c "select _sa_day_points('{\"m\":100}'::jsonb)")" '^200$'
chk "очки дня: мусор — ноль" "$($P -c "select _sa_day_points('{\"l\":\"abc\"}'::jsonb) || ' ' || _sa_day_points('[1]'::jsonb) || ' ' || _sa_day_points(null)")" '^0 0 0$'
chk "служебные функции снаружи не вызвать" "$(Q "select _sa_day_points('{}'::jsonb)")" 'permission denied'
chk "таблицу пар напрямую не прочитать" "$(Q "select count(*) from sa_pairs")" 'permission denied'
chk "без токена — auth" "$(Q "select quest_today('мусор')::text || league_week('мусор')::text || pair_status('мусор')::text")" '"error": "auth".*"error": "auth".*"error": "auth"'
# ── квест смены
QA=$(Q "select quest_today('$ANNA')")
chk "квест: график известен, я в смене" "$QA" '"known": true.*"me_on": true|"me_on": true.*"known": true'
chk "квест: в смене Анна, Илья, Мария (по имени без фамилии), Пётр выходной, чужой не найден" "$(Q "select string_agg(p->>'name', ',' order by p->>'name') from jsonb_array_elements(quest_today('$ANNA')->'people') p")" '^Анна,Илья,Мария$'
chk "квест: цель на троих — 3 разминки, 6 шагов, 1 гость" "$(Q "select quest_today('$ANNA')->'goal'")" '"warm": 3.*"guest": 1|"guest": 1.*"warm": 3'
chk "квест: сделано — шагов 3, разминок 1, гостей 1" "$(Q "select (quest_today('$ANNA')->'done'->>'steps') || ' ' || (quest_today('$ANNA')->'done'->>'warm') || ' ' || (quest_today('$ANNA')->'done'->>'guest')")" '^3 1 1$'
chk "квест: не закрыт" "$(Q "select quest_today('$ANNA')->>'complete'")" '^false$'
chk "квест: Пётр в выходной — не в смене, но видит смену" "$(Q "select (quest_today('$MAN')->>'me_on') || ' ' || jsonb_array_length(quest_today('$MAN')->'people')")" '^false 3$'
QI=$(Q "select quest_today('$IVAN')")
chk "квест Порта: графика нет — кто сегодня занимался и я" "$QI" '"known": false'
chk "квест Порта: Иван, шаг засчитан" "$(Q "select string_agg((p->>'name') || ':' || (p->>'steps'), ',') from jsonb_array_elements(quest_today('$IVAN')->'people') p")" '^Иван:1$'
chk "квест: инициал фамилии, без чужих данных" "$(Q "select quest_today('$ANNA')->'people'->0")" '"initial": "С"'
# ── лига недели
L=$(Q "select league_week('$ANNA')")
chk "лига: неделя с понедельника" "$L" '"week_start": "[0-9]{4}-[0-9]{2}-[0-9]{2}"'
if [ "$DOW" -ge 3 ]; then WANT_A=$((20+20+15)); elif [ "$DOW" -eq 2 ]; then WANT_A=40; else WANT_A=20; fi
chk "лига: очки Анны за неделю ($WANT_A)" "$(Q "select r->>'pts' from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Анна'")" "^$WANT_A\$"
chk "лига: владелец не участвует, уволенный тоже" "$(Q "select count(*) from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' in ('Роман','Олег')")" '^0$'
chk "лига: Мария (9 дней назад) — не в списке; Иван из Порта — в списке" "$(Q "select string_agg(r->>'name', ',' order by r->>'name') from jsonb_array_elements(league_week('$ANNA')->'rows') r")" '^Анна,Иван,Илья$'
chk "лига: экзамен 30 + 2 исправления 6 у Ивана" "$(Q "select r->>'pts' from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Иван'")" '^36$'
chk "лига: я всегда в списке, даже с нулём (Пётр)" "$(Q "select r->>'pts' || ' ' || (r->>'me') from jsonb_array_elements(league_week('$MAN')->'rows') r where r->>'name' = 'Пётр'")" '^0 true$'
chk "лига: кубок — два заведения" "$(Q "select jsonb_array_length(league_week('$ANNA')->'cup')")" '^2$'
chk "лига: кубок Порта — 36 очков на двоих = 18 в среднем" "$(Q "select (c->>'avg') || ' ' || (c->>'people') from jsonb_array_elements(league_week('$ANNA')->'cup') c where c->>'restaurant' = 'Порт'")" '^18(\.0)? 2$'
chk "лига: своё заведение отмечено" "$(Q "select c->>'mine' from jsonb_array_elements(league_week('$ANNA')->'cup') c where c->>'restaurant' = 'Два моря, Океан'")" '^true$'
# ── свеча на двоих
chk "кандидаты: своё заведение без владельца и без себя" "$(Q "select string_agg(r->>'name', ',' order by r->>'name') from jsonb_array_elements(pair_candidates('$ANNA')->'rows') r")" '^Илья,Мария,Пётр$'
chk "позвать себя — self" "$(Q "select pair_invite('$ANNA', '$EA')")" '"error": "self"'
chk "позвать из другого заведения — other_restaurant" "$(Q "select pair_invite('$ANNA', '$EI')")" 'other_restaurant'
chk "позвать владельца — not_found" "$(Q "select pair_invite('$ANNA', '$EO')")" 'not_found'
chk "Анна зовёт Илью — invited" "$(Q "select pair_invite('$ANNA', '$EB')")" '"status": "invited"'
chk "у Ильи приглашение от Анны" "$(Q "select pair_status('$BAR')->'invites'->0->'from'->>'name'")" '^Анна$'
chk "у Анны — исходящее Илье" "$(Q "select pair_status('$ANNA')->'outgoing'->'to'->>'name'")" '^Илья$'
PID=$(Q "select pair_status('$BAR')->'invites'->0->>'id'")
chk "Мария не может ответить на чужое приглашение" "$(Q "select pair_answer('$SEN', $PID, true)")" 'not_found'
chk "Илья принимает — active" "$(Q "select pair_answer('$BAR', $PID, true)")" '"status": "active"'
chk "повторный ответ — already" "$(Q "select pair_answer('$BAR', $PID, true)")" 'already'
chk "у пары нельзя звать ещё — have_pair" "$(Q "select pair_invite('$ANNA', '$EM')")" 'have_pair'
chk "Пётр зовёт занятого Илью — busy" "$(Q "select pair_invite('$MAN', '$EB')")" 'busy'
S=$(Q "select pair_status('$ANNA')->'pair'")
chk "статус пары: напарник Илья, сегодня у него 1 шаг" "$S" '"partner": \{.*"name": "Илья".*"partner_today": \{.*"steps": 1'
chk "серия на двоих с сегодняшнего дня — 1 (оба сегодня занимались)" "$(Q "select pair_status('$ANNA')->'pair'->>'streak'")" '^1$'
# пара «с позавчера»: позавчера у Ильи выходной по графику (не гасит), вчера оба, сегодня оба → 2
$P -c "update sa_pairs set answered_at = now() - interval '3 days' where id = $PID" >/dev/null
chk "серия: выходной одного не гасит и не считается — 2" "$(Q "select pair_status('$ANNA')->'pair'->>'streak'")" '^2$'
chk "дни пары: 7 дней, сегодня оба в деле" "$(Q "select jsonb_array_length(pair_status('$ANNA')->'pair'->'days') || ' ' || (pair_status('$ANNA')->'pair'->'days'->6->>'me') || (pair_status('$ANNA')->'pair'->'days'->6->>'partner')")" '^7 22$'
# Анна пропустила позавчера-позапозавчера? У неё T2 есть. Сделаем пропуск: Илья без вчера
Q "select sa_learning_push('$BAR', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":1,\"g\":1}},\"streak\":{\"count\":1,\"days\":[\"$T0\"],\"frozen\":[]}}'::jsonb)" >/dev/null
chk "серия: напарник пропустил вчера — снова 1" "$(Q "select pair_status('$ANNA')->'pair'->>'streak'")" '^1$'
chk "Илья гасит свечу — ended" "$(Q "select pair_end('$BAR')")" '"ended": 1'
chk "после — пары нет" "$(Q "select pair_status('$ANNA')->'pair'")" '^$|null'
# встречное приглашение
Q "select pair_invite('$MAN', '$EA')" >/dev/null
chk "встречное приглашение — сразу пара" "$(Q "select pair_invite('$ANNA', '$EM')")" '"status": "active"'
chk "Пётр видит пару с Анной" "$(Q "select pair_status('$MAN')->'pair'->'partner'->>'name'")" '^Анна$'
chk "Пётр отзывает — ended 1" "$(Q "select pair_end('$MAN')")" '"ended": 1'
Q "select pair_invite('$MAN', '$EB')" >/dev/null
chk "отклонить — declined" "$(Q "select pair_answer('$BAR', (pair_status('$BAR')->'invites'->0->>'id')::bigint, false)")" '"status": "declined"'
# ── ревью v30: копии с телефона не верим на слово
chk "число: огромное, минус и мусор — ноль; больше 1000 — 1000" "$($P -c "select _sa_num('99999999999999999999') || ' ' || _sa_num('-5') || ' ' || _sa_num('1e5') || ' ' || _sa_num('5000') || ' ' || _sa_num('2.5')")" '^0 0 0 1000 2\.5$'
chk "очки дня: огромное число не роняет — ноль" "$($P -c "select _sa_day_points('{\"l\":99999999999999999999,\"w\":-3}'::jsonb)")" '^0$'
Q "select sa_learning_push('$IVAN', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":99999999999999,\"x\":1,\"w\":-4,\"g\":3000}}}'::jsonb)" >/dev/null
chk "квест: огромное число шагов — без ошибки, шагов 0, гостей не больше 1000" "$(Q "select (quest_today('$IVAN')->>'ok') || ' ' || (quest_today('$IVAN')->'done'->>'steps') || ' ' || (quest_today('$IVAN')->'done'->>'guest')")" '^true 0 1000$'
Q "select sa_learning_push('$IVAN', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":1,\"x\":1,\"f\":2},\"$T0#1\":{\"m\":100},\"$T0#2\":{\"m\":100},\"x$T1\":{\"m\":100}}}'::jsonb)" >/dev/null
chk "лига: поддельные дни «${T0}#1» не считаются — у Ивана снова 36" "$(Q "select (r->>'pts') || ' ' || (r->>'days') from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Иван'")" '^36 1$'
M0=${T0:0:8}; Y0=${T0:0:4}
Q "select sa_learning_push('$IVAN', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":1,\"x\":1,\"f\":2},\"${M0}45\":{\"m\":100},\"${M0}00\":{\"m\":100},\"${M0}32\":{\"m\":100},\"${Y0}-13-01\":{\"m\":100},\"${Y0}-02-30\":{\"m\":100}}}'::jsonb)" >/dev/null
chk "лига: несуществующие даты («${M0}45», «${Y0}-13-01») не считаются — снова 36" "$(Q "select (r->>'pts') || ' ' || (r->>'days') from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Иван'")" '^36 1$'
chk "очки между датами: только настоящие дни (через границу месяца)" "$($P -c "select _sa_points_between('{\"activity\":{\"2026-09-31\":{\"m\":100},\"2026-09-45\":{\"m\":100},\"2026-10-00\":{\"m\":100},\"2026-10-01\":{\"l\":1},\"2026-09-30\":{\"l\":1}}}'::jsonb, '2026-09-28', '2026-10-01')")" '^20$'
# ── часовой пояс: свой у заведения, плохой не роняет
$P -c "insert into sa_settings (key, value) values ('tz', 'Нет/Такого') on conflict (key) do update set value = excluded.value" >/dev/null
chk "пояс: общий с ошибкой — Камчатка, квест работает" "$($P -c "select _sa_tz('Два моря, Океан')") $(Q "select quest_today('$ANNA')->>'ok'")" '^Asia/Kamchatka true$'
$P -c "insert into sa_settings (key, value) values ('tz:Порт', 'Europe/Moscow') on conflict (key) do update set value = excluded.value" >/dev/null
chk "пояс: свой у заведения" "$($P -c "select _sa_tz('Порт') || ' ' || _sa_tz('Два моря, Океан') || ' ' || _sa_tz()")" '^Europe/Moscow Asia/Kamchatka Asia/Kamchatka$'
$P -c "update sa_settings set value = 'Asia/Vladivostok' where key = 'tz'; update sa_settings set value = 'Мусор' where key = 'tz:Порт'" >/dev/null
chk "пояс: свой с ошибкой — общий" "$($P -c "select _sa_tz('Порт') || ' ' || _sa_tz(null)")" '^Asia/Vladivostok Asia/Vladivostok$'
chk "пояс: лига и пара работают с поясом заведения" "$(Q "select (league_week('$IVAN')->>'ok') || ' ' || (pair_status('$IVAN')->>'ok')")" '^true true$'
$P -c "delete from sa_settings" >/dev/null
# ── выходной по графику заведения
chk "график Ильи: позавчера выходной, вчера и сегодня смены" "$($P -c "select (s->>'$T2') || (s->>'$T1') || (s->>'$T0') from _sa_emp_sched('$EB', '$T2'::date, '$T0'::date) s")" '^011$'
chk "график: Пётр сегодня выходной; Иван (графика нет) — пусто" "$($P -c "select (_sa_emp_sched('$EM', '$T0'::date, '$T0'::date)->>'$T0') || ' ' || _sa_emp_sched('$EI', '$T3'::date, '$T0'::date)::text")" '^0 \{\}$'
Q "select sa_learning_push('$ANNA', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":2,\"l\":1,\"w\":1},\"$T1\":{\"st\":2,\"l\":2},\"$T2\":{\"st\":1,\"q\":1},\"$T9\":{\"st\":3,\"l\":3}},\"streak\":{\"count\":3,\"days\":[\"$T2\",\"$T1\",\"$T0\"],\"frozen\":[]}}'::jsonb)" >/dev/null
Q "select sa_learning_push('$BAR', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":1,\"g\":1},\"$T1\":{\"st\":1,\"m\":1}},\"streak\":{\"count\":1,\"days\":[\"$T1\",\"$T0\"],\"frozen\":[]}}'::jsonb)" >/dev/null
Q "select pair_invite('$ANNA', '$EB')" >/dev/null
PID2=$(Q "select pair_status('$BAR')->'invites'->0->>'id'")
Q "select pair_answer('$BAR', $PID2, true)" >/dev/null
$P -c "update sa_pairs set answered_at = now() - interval '3 days' where id = $PID2" >/dev/null
chk "серия: выходной Ильи по графику (телефон не отметил) не гасит — 2" "$(Q "select pair_status('$ANNA')->'pair'->>'streak'")" '^2$'
chk "дни пары: позавчера у Ильи — выходной (1)" "$(Q "select pair_status('$ANNA')->'pair'->'days'->4->>'partner'")" '^1$'
chk "сегодня: у Ильи смена по графику" "$(Q "select pair_status('$ANNA')->'pair'->'partner_today'->>'shift'")" '^1$'
# ── напарника больше нет в команде — пара гаснет сама
$P -c "update employees set status = 'fired' where id::text = '$EB'" >/dev/null
chk "напарник уволен — пары нет, свеча погашена" "$(Q "select coalesce(pair_status('$ANNA')->>'pair', 'нет')") $($P -c "select status from sa_pairs where id = $PID2")" '^нет ended$'
chk "можно звать другого" "$(Q "select pair_invite('$ANNA', '$EM')")" '"status": "invited"'
$P -c "update employees set status = 'active' where id::text = '$EB'" >/dev/null
Q "select pair_end('$ANNA')" >/dev/null
# ── неделя выходных подряд — как у личной серии, дольше недели свеча не ждёт
chk "серия: 7 выходных между занятиями — держится" "$($P -c "select _sa_pair_run('{\"activity\":{\"$T0\":{\"st\":1},\"$T8\":{\"st\":1}}}'::jsonb, '{\"activity\":{\"$T0\":{\"st\":1},\"$T8\":{\"st\":1}}}'::jsonb, '{\"$T1\":0,\"$T2\":0,\"$T3\":0,\"$T4\":0,\"$T5\":0,\"$T6\":0,\"$T7\":0}'::jsonb, '{\"$T1\":0,\"$T2\":0,\"$T3\":0,\"$T4\":0,\"$T5\":0,\"$T6\":0,\"$T7\":0}'::jsonb, '$T9'::date, '$T0'::date)")" '^2$'
chk "серия: 8 выходных подряд — с начала" "$($P -c "select _sa_pair_run('{\"activity\":{\"$T0\":{\"st\":1},\"$T9\":{\"st\":1}}}'::jsonb, '{\"activity\":{\"$T0\":{\"st\":1},\"$T9\":{\"st\":1}}}'::jsonb, '{\"$T1\":0,\"$T2\":0,\"$T3\":0,\"$T4\":0,\"$T5\":0,\"$T6\":0,\"$T7\":0,\"$T8\":0}'::jsonb, '{\"$T1\":0,\"$T2\":0,\"$T3\":0,\"$T4\":0,\"$T5\":0,\"$T6\":0,\"$T7\":0,\"$T8\":0}'::jsonb, '$T9'::date, '$T0'::date)")" '^1$'
echo "Итого: $pass ✓, $fail ✗"
