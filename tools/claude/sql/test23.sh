#!/bin/bash
# Проверки этапа 23 (после run23.sh). Печатает ✓/✗ и итог.
set -u
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d satest23"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:300}"; fail=$((fail+1)); fi; }
OWN=10000000-0000-0000-0000-0000000000a1; SEN=10000000-0000-0000-0000-0000000000a2; MAN=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; BAR=10000000-0000-0000-0000-0000000000a5; FIRED=10000000-0000-0000-0000-0000000000a6
PMAN=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
EA=00000000-0000-0000-0000-0000000000a4; EI=00000000-0000-0000-0000-0000000000b2; EM=00000000-0000-0000-0000-0000000000a3; EO=00000000-0000-0000-0000-0000000000a1
$P -c "delete from emp_learning; delete from report_tickets" >/dev/null
# ── копия с телефона
chk "push без токена — auth" "$(Q "select sa_learning_push('мусор', '{}'::jsonb)")" '"error": "auth"'
chk "push не объект — bad" "$(Q "select sa_learning_push('$ANNA', '[1,2]'::jsonb)")" '"error": "bad"'
chk "push слишком большой — too_big" "$(Q "select sa_learning_push('$ANNA', jsonb_build_object('x', repeat('я', 250000)))")" '"error": "too_big"'
NOWMS=$($P -c "select (extract(epoch from now())*1000)::bigint")
TODAY=$($P -c "select to_char((now() at time zone 'Asia/Kamchatka')::date, 'YYYY-MM-DD')")
OLD=$($P -c "select to_char((now() at time zone 'Asia/Kamchatka')::date - 20, 'YYYY-MM-DD')")
DATA="{\"v\":1,\"mistakes\":[{\"q\":\"Аллерген в «Цезаре»?\",\"a\":\"Анчоусы\",\"l\":\"s0-q\",\"st\":0,\"due\":$((NOWMS-1000))},{\"q\":\"Вопрос на потом\",\"a\":\"Ответ\",\"st\":2,\"due\":$((NOWMS+86400000))}],\"activity\":{\"$TODAY\":{\"st\":2,\"w\":1},\"$OLD\":{\"st\":5}},\"exams\":{\"seasonal\":{\"passed\":true,\"score\":92}}}"
chk "push Анны — ok" "$(Q "select sa_learning_push('$ANNA', '$DATA'::jsonb)")" '"ok": true'
chk "повторный push — та же строка обновлена" "$(Q "select sa_learning_push('$ANNA', '$DATA'::jsonb)"; $P -c "select count(*) from emp_learning")" '"ok": true.* 1$|^1$|1$'
chk "напрямую таблицу не прочитать (anon)" "$(Q "select count(*) from emp_learning")" 'permission denied'
chk "служебную функцию снаружи не вызвать" "$(Q "select _sa_report_person('$EA')")" 'permission denied'
# ── список по лестнице
names() { $P -c "set role anon; select string_agg(r->>'name', ',' order by r->>'name') from jsonb_array_elements(report_people('$1')->'rows') r" | tail -1; }
chk "официант видит только себя" "$(names $ANNA)" '^Анна$'
chk "менеджер — свой ресторан, ниже себя (+ себя)" "$(names $MAN)" '^Анна,Илья,Пётр$'
chk "менеджер Порта — только Порт" "$(names $PMAN)" '^Иван,Ирина$'
chk "старший — все рестораны ниже себя" "$(names $SEN)" '^Анна,Иван,Илья,Ирина,Мария,Пётр$'
chk "владелец — все действующие (уволенный не виден)" "$(names $OWN)" '^Анна,Иван,Илья,Ирина,Мария,Пётр,Роман$'
chk "уволенный — не войдёт" "$(Q "select report_people('$FIRED')")" '"error": "auth"'
ROW=$(Q "select r from jsonb_array_elements(report_people('$MAN')->'rows') r where r->>'name' = 'Анна'")
chk "строка Анны: уроков 2, тестов 1" "$ROW" '"lessons": 2.*"quiz": 1|"quiz": 1.*"lessons": 2'
chk "строка Анны: ошибок за 30 дней 2" "$ROW" '"wrong30": 2'
chk "строка Анны: копия с телефона — 2 в банке, 1 на повтор, 1 день из 14" "$ROW" '"due": 1' 
chk "строка Анны: days14 = 1, mistakes = 2" "$ROW" '"days14": 1.*"mistakes": 2|"mistakes": 2.*"days14": 1'
chk "scope менеджера — restaurant" "$(Q "select report_people('$MAN')->>'scope'")" '^restaurant$'
chk "scope старшего — network, владельца — all" "$(Q "select report_people('$SEN')->>'scope' || ' ' || (report_people('$OWN')->>'scope')")" '^network all$'
# ── карточка
chk "менеджер → Анна: ok" "$(Q "select report_person('$MAN', '$EA')->>'ok'")" '^true$'
chk "менеджер → Иван (Порт): forbidden" "$(Q "select report_person('$MAN', '$EI')")" 'forbidden'
chk "менеджер Порта → Анна: forbidden" "$(Q "select report_person('$PMAN', '$EA')")" 'forbidden'
chk "старший → менеджер: ok; менеджер → менеджер: forbidden" "$(Q "select (report_person('$SEN', '$EM')->>'ok') || ' ' || (report_person('$PMAN', '$EM')->>'error')")" '^true forbidden$'
chk "старший → владелец: forbidden" "$(Q "select report_person('$SEN', '$EO')")" 'forbidden'
chk "официант → сам себе (пустой p_emp): ok" "$(Q "select report_person('$ANNA', '')->'data'->'person'->>'name'")" '^Анна$'
chk "официант → чужой: forbidden" "$(Q "select report_person('$ANNA', '$EI')")" 'forbidden'
chk "нет такого — not_found" "$(Q "select report_person('$OWN', 'нет-такого')")" 'not_found'
D=$(Q "select report_person('$MAN', '$EA')->'data'")
chk "уроки без повторов" "$(Q "select jsonb_array_length(report_person('$MAN', '$EA')->'data'->'lessons')")" '^2$'
chk "тесты, звёзды (лучшие), роли, последняя роль" "$D" '"quiz": \["s0-q"\].*'
chk "звёзды — максимум 3" "$(Q "select report_person('$MAN', '$EA')->'data'->'stars'->>'s0-p'")" '^3$'
chk "последняя роль seasonal, пройденные роли spg" "$(Q "select (report_person('$MAN', '$EA')->'data'->>'last_role') || ' ' || (report_person('$MAN', '$EA')->'data'->'roles'->>0)")" '^seasonal spg$'
chk "результаты тестов — строка 9 из 12" "$(Q "select report_person('$MAN', '$EA')->'data'->'scores'")" '"score": 9.*"total": 12|"total": 12.*"score": 9'
chk "ответы: 3 события, свежие первыми, что выбрал и что верно" "$(Q "select jsonb_array_length(report_person('$MAN', '$EA')->'data'->'events') || ' ' || (report_person('$MAN', '$EA')->'data'->'events'->0->>'answer') || ' / ' || (report_person('$MAN', '$EA')->'data'->'events'->0->>'right_answer')")" '^3 Сзади / Со стороны гостя'
chk "в событиях нет имени и ресторана" "$(Q "select (report_person('$MAN', '$EA')->'data'->'events'->0) ? 'employee'")" '^f$'
chk "навыки: подтверждённый и ждущий, отменённого нет" "$(Q "select string_agg(s->>'status', ',' order by s->>'status') from jsonb_array_elements(report_person('$MAN', '$EA')->'data'->'skills') s")" '^approved,pending$'
chk "копия с телефона и когда пришла" "$(Q "select (report_person('$MAN', '$EA')->'data'->'learning'->'exams'->'seasonal'->>'score') || ' ' || ((report_person('$MAN', '$EA')->'data'->>'learning_at') is not null)")" '^92 true$'
chk "напоминания включены — tg true (без номера чата)" "$(Q "select (report_person('$MAN', '$EA')->'data'->>'tg') || ' ' || ((report_person('$MAN', '$EA')->'data')::text ~ '(chat|: ?\"?111\"?[,}])')")" '^true (f|false)$'
chk "seen = последнее занятие" "$(Q "select (report_person('$MAN', '$EA')->'data'->>'seen') is not null")" '^t$'
chk "Иван без копии с телефона — learning {}" "$(Q "select report_person('$OWN', '$EI')->'data'->'learning'")" '^\{\}$'
# ── команда
chk "официанту команда — forbidden" "$(Q "select report_team('$ANNA')")" 'forbidden'
chk "менеджер: 3 человека" "$(Q "select jsonb_array_length(report_team('$MAN')->'people')")" '^3$'
chk "владелец: 7 человек, в каждом events" "$(Q "select jsonb_array_length(report_team('$OWN')->'people') || ' ' || (select bool_and(p ? 'events') from jsonb_array_elements(report_team('$OWN')->'people') p)")" '^7 true$'
# ── билеты на файл
chk "неизвестный вид — kind" "$(Q "select report_ticket('$MAN', 'zip', '{}'::jsonb)")" '"error": "kind"'
chk "официанту Excel команды — forbidden" "$(Q "select report_ticket('$ANNA', 'team_xlsx', '{}'::jsonb)")" 'forbidden'
T1=$(Q "select report_ticket('$ANNA', 'person_pdf', '{\"name\":\"Анна\"}'::jsonb)->>'ticket'")
chk "официант — своя PDF: билет" "$T1" '^[0-9a-f]{64}$'
chk "билет → отчёт" "$(Q "select report_take('$T1')")" '"kind": "person_pdf".*"name": "Анна"'
chk "второй раз — ticket" "$(Q "select report_take('$T1')")" '"error": "ticket"'
T2=$(Q "select report_ticket('$MAN', 'team_xlsx', '{\"people\":[]}'::jsonb)->>'ticket'")
$P -c "update report_tickets set expires_at = now() - interval '1 second' where ticket = '$T2'" >/dev/null
chk "просроченный билет — ticket" "$(Q "select report_take('$T2')")" '"error": "ticket"'
chk "таблицу билетов напрямую не прочитать" "$(Q "select count(*) from report_tickets")" 'permission denied'
# ── ревью v30: мусор в копии с телефона не роняет отчёт
BAD="{\"v\":2,\"mistakes\":[{\"q\":\"x\",\"due\":\"abc\"},{\"q\":\"y\",\"due\":99999999999999999999999},{\"q\":\"z\",\"due\":-5}],\"activity\":{\"$TODAY\":{\"st\":99999999999},\"$TODAY#1\":{\"st\":3},\"${TODAY:0:8}45\":{\"st\":3},\"${TODAY:0:8}00\":{\"st\":2},\"мусор\":{\"st\":1},\"$OLD\":\"строка\"}}"
chk "мусорная копия принята" "$(Q "select sa_learning_push('$BAR', '$BAD'::jsonb)")" '"ok": true'
chk "отчёт с мусорной копией работает: Илья — 3 в банке, все 3 на повтор (срок не разобрать — повторить сейчас), дней 0" "$(Q "select (r->>'mistakes') || ' ' || (r->>'due') || ' ' || (r->>'days14') from jsonb_array_elements(report_people('$MAN')->'rows') r where r->>'name' = 'Илья'")" '^3 3 0$'
echo "Итого: $pass ✓, $fail ✗"
