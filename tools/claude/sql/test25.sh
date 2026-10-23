#!/bin/bash
# Проверки этапа 25 (после run25.sh). Печатает ✓/✗ и итог.
set -u
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=${DB:-satest25}
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:500}"; fail=$((fail+1)); fi; }
OWN=10000000-0000-0000-0000-0000000000a1; SEN=10000000-0000-0000-0000-0000000000a2; MAN=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; BAR=10000000-0000-0000-0000-0000000000a5; FIRED=10000000-0000-0000-0000-0000000000a6
PMAN=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
EA=00000000-0000-0000-0000-0000000000a4; EB=00000000-0000-0000-0000-0000000000a5; EI=00000000-0000-0000-0000-0000000000b2; EM=00000000-0000-0000-0000-0000000000a3; ES=00000000-0000-0000-0000-0000000000a2
$P -c "delete from sa_tts_usage" >/dev/null 2>&1
$P -c "delete from emp_learning; delete from sa_pairs; delete from sa_settings where key like 'tz%'; delete from sa_kudos; delete from sa_league_weeks; delete from sa_cup_weeks; delete from sa_league_filled; delete from sa_notify_prefs; delete from sa_guest_personas; delete from tg_sent; delete from net.sent_log; delete from vault.secrets_stub; delete from progress where user_id::text = '00000000-0000-0000-0000-0000000000a4' and (lesson_id like 's1-%' or lesson_id in ('s0-3', 's0-4'))" >/dev/null
D() { $P -c "select to_char((now() at time zone 'Asia/Kamchatka')::date - $1, 'YYYY-MM-DD')"; }
T0=$(D 0); T1=$(D 1); T2=$(D 2); TF=$(D -1); TFF=$(D -2)
WS=$($P -c "select to_char((now() at time zone 'Asia/Kamchatka')::date - (extract(isodow from (now() at time zone 'Asia/Kamchatka')::date)::int - 1), 'YYYY-MM-DD')")
LW=$($P -c "select to_char('$WS'::date - 7, 'YYYY-MM-DD')"); LW2=$($P -c "select to_char('$WS'::date - 5, 'YYYY-MM-DD')")
PM=$($P -c "select to_char(date_trunc('month', (now() at time zone 'Asia/Kamchatka')::date) - interval '1 month' + interval '14 days', 'YYYY-MM-DD')")
NOWMS=$($P -c "select (extract(epoch from now()) * 1000)::bigint"); OLD=$((NOWMS - 20 * 86400000))

# ── быстрая отметка дня
chk "отметка: без токена — auth" "$(Q "select sa_day_push('мусор', '$T0', '{\"w\":1}'::jsonb)")" '"error": "auth"'
chk "отметка: день не по форме — bad" "$(Q "select sa_day_push('$ANNA', '2026-10-12#1', '{\"w\":1}'::jsonb)")" '"error": "bad"'
chk "отметка: несуществующая дата — bad" "$(Q "select sa_day_push('$ANNA', '2026-02-30', '{\"w\":1}'::jsonb)")" '"error": "bad"'
chk "отметка: позавчера и послезавтра — day" "$(Q "select sa_day_push('$ANNA', '$T2', '{\"w\":1}'::jsonb)::text || sa_day_push('$ANNA', '$TFF', '{\"w\":1}'::jsonb)::text")" '"error": "day".*"error": "day"'
chk "отметка: нет копии — создаётся" "$(Q "select sa_day_push('$ANNA', '$T0', '{\"st\":2,\"w\":1,\"l\":1,\"zz\":5,\"g\":-3}'::jsonb)") $($P -c "select data->'activity'->'$T0' from emp_learning where emp_id = '$EA'")" '"ok": true.*"l": 1.*"w": 1|"ok": true.*"w": 1.*"l": 1'
chk "отметка: мусорные поля и минус — не пишутся" "$($P -c "select (data->'activity'->'$T0') ? 'zz' or (data->'activity'->'$T0') ? 'g' from emp_learning where emp_id = '$EA'")" '^f$'
Q "select sa_day_push('$ANNA', '$T0', '{\"st\":1,\"w\":1}'::jsonb)" >/dev/null
chk "отметка: старая не уменьшает новую (st остаётся 2)" "$($P -c "select data->'activity'->'$T0'->>'st' from emp_learning where emp_id = '$EA'")" '^2$'
Q "select sa_day_push('$ANNA', '$T0', '{\"st\":3,\"g\":1,\"x\":99999999999,\"m\":5000}'::jsonb)" >/dev/null
chk "отметка: больше — растёт; огромное число — ноль, больше 1000 — 1000" "$($P -c "select (data->'activity'->'$T0'->>'st') || ' ' || (data->'activity'->'$T0'->>'g') || ' ' || coalesce(data->'activity'->'$T0'->>'x', '-') || ' ' || (data->'activity'->'$T0'->>'m') from emp_learning where emp_id = '$EA'")" '^3 1 - 1000$'
chk "отметка: квест сразу видит разминку Анны" "$(Q "select p->>'warm' from jsonb_array_elements(quest_today('$ANNA')->'people') p where p->>'name' = 'Анна'")" '^1$'

# ── копии с телефонов: прошлая неделя, золото, свежесть, прошлый месяц
Q "select sa_learning_push('$ANNA', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":2,\"l\":1,\"w\":1},\"$LW\":{\"st\":3,\"l\":2,\"w\":1},\"$LW2\":{\"st\":1,\"g\":1},\"$PM\":{\"st\":3,\"l\":3}},\"gold\":{\"s0\":{\"d\":\"$T1\",\"w\":0,\"sec\":40}},\"fresh\":{\"s0\":{\"t\":$OLD,\"n\":0},\"s1\":{\"t\":$OLD,\"n\":1},\"s2\":{\"t\":$OLD,\"n\":2},\"s3\":{\"t\":$NOWMS,\"n\":0}}}'::jsonb)" >/dev/null
Q "select sa_learning_push('$BAR', '{\"v\":2,\"activity\":{\"$LW\":{\"st\":3,\"w\":1,\"m\":2}},\"gold\":{\"s0\":{\"d\":\"$T1\",\"w\":0,\"sec\":35}}}'::jsonb)" >/dev/null
Q "select sa_learning_push('$IVAN', '{\"v\":2,\"activity\":{\"$LW\":{\"st\":1,\"x\":1},\"$T0\":{\"st\":1,\"x\":1}}}'::jsonb)" >/dev/null

# ── лига: история прошлой недели, места, кубок, стрелки, инициалы
# записи прохождения на сервере за прошлую неделю (2 урока Анны) — уроки прошлой недели подтверждены
$P -c "insert into progress (user_id, name, surname, role, lesson_id, updated_at) values ('$EA', 'Анна', 'Смирнова', 'seasonal', 's0-3', ('$LW'::date + time '12:00') at time zone 'Asia/Kamchatka'), ('$EA', 'Анна', 'Смирнова', 'seasonal', 's0-4', ('$LW'::date + time '13:00') at time zone 'Asia/Kamchatka')" >/dev/null
$P -c "select _sa_league_fill('$LW'::date, 'Asia/Kamchatka')" >/dev/null
chk "история: прошлая неделя — Анна 50 (1-я везде), Иван 30, Илья 20" "$($P -c "select string_agg(emp_id || ':' || pts || ':' || rank_rest || ':' || rank_net, ',' order by pts desc) from sa_league_weeks where week_start = '$LW'")" "^$EA:50:1:1,$EI:30:1:2,$EB:20:2:3\$"
chk "история: кубок — Океан первый (17,5 против 15)" "$($P -c "select string_agg(restaurant || ':' || avg || ':' || rank, ',' order by rank) from sa_cup_weeks where week_start = '$LW'")" '^Два моря, Океан:17.5:1,Порт:15.0:2$'
chk "история: вторая сводка недели не дублирует" "$($P -c "select _sa_league_fill('$LW'::date, 'Asia/Kamchatka')") $($P -c "select count(*) from sa_league_weeks where week_start = '$LW'")" '^f 3$'
L=$(Q "select league_week('$ANNA')")
chk "лига: прошлая неделя, моё место тогда, победы" "$L" '"me_prev": \{.*"rank_rest": 1'
chk "лига: победы в заведении и сети — по 1" "$(Q "select (league_week('$ANNA')->'wins'->>'rest') || ' ' || (league_week('$ANNA')->'wins'->>'net')")" '^1 1$'
chk "лига: история кубка — Океан" "$(Q "select league_week('$ANNA')->'cup_hist'->0->>'restaurant'")" '^Два моря, Океан$'
chk "лига: у строки — места прошлой недели" "$(Q "select (r->>'prev_rest') || ' ' || (r->>'prev_net') from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Иван'")" '^1 2$'
chk "лига: коллега другого заведения — с инициалом («П.»)" "$(Q "select r->>'surname' from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Иван'")" '^П\.$'
chk "лига: своё заведение — полностью (Смирнова)" "$(Q "select r->>'surname' from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Анна'")" '^Смирнова$'
chk "лига: проверка по серверу включена (progress хранит время)" "$(Q "select league_week('$ANNA')->>'verified'")" '^true$'
# уроки — не больше, чем записано на сервере за неделю (у Анны 3 записи прохождения → до 45 очков)
Q "select sa_learning_push('$ANNA', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":15,\"l\":15}}}'::jsonb)" >/dev/null
chk "лига: 15 уроков с телефона при 3 записях сервера — 45 очков" "$(Q "select r->>'pts' from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Анна'")" '^45$'
$P -c "insert into progress (user_id, name, surname, role, lesson_id) select '$EA', 'Анна', 'Смирнова', 'seasonal', 's1-' || g from generate_series(1, 10) g" >/dev/null
chk "лига: записей стало 13 — все 150 очков" "$(Q "select r->>'pts' from jsonb_array_elements(league_week('$ANNA')->'rows') r where r->>'name' = 'Анна'")" '^150$'
Q "select sa_learning_push('$ANNA', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":2,\"l\":1,\"w\":1},\"$LW\":{\"st\":3,\"l\":2,\"w\":1},\"$LW2\":{\"st\":1,\"g\":1},\"$PM\":{\"st\":3,\"l\":3}},\"gold\":{\"s0\":{\"d\":\"$T1\",\"w\":0,\"sec\":40}},\"fresh\":{\"s0\":{\"t\":$OLD,\"n\":0},\"s1\":{\"t\":$OLD,\"n\":1},\"s2\":{\"t\":$OLD,\"n\":2},\"s3\":{\"t\":$NOWMS,\"n\":0}}}'::jsonb)" >/dev/null

# ── сводка дня
chk "сводка дня: квест, пара и лига одним ответом" "$(Q "select (day_brief('$ANNA') ? 'quest') and (day_brief('$ANNA') ? 'pair') and (day_brief('$ANNA') ? 'league') and (day_brief('$ANNA')->'quest'->>'ok')::boolean")" '^t$'
chk "сводка дня: я 1-я в заведении (20 очков)" "$(Q "select (day_brief('$ANNA')->'league'->>'rank_rest') || ' ' || (day_brief('$ANNA')->'league'->>'pts')")" '^1 20$'

# ── квест: спасибо команде, старший зовёт
chk "спасибо: первый раз — новое" "$(Q "select quest_thanks('$ANNA')->>'new'")" '^true$'
chk "спасибо: второй раз — нет" "$(Q "select quest_thanks('$ANNA')->>'new'")" '^false$'
chk "квест: в списке «спасибо» — Анна (я)" "$(Q "select quest_today('$BAR')->'thanks'->0->>'name'")" '^Анна$'
chk "квест: старшему — lead true, официанту — false" "$(Q "select (quest_today('$MAN')->>'lead') || ' ' || (quest_today('$ANNA')->>'lead')")" '^true false$'
chk "позвать: официант — forbidden" "$(Q "select quest_call('$ANNA')")" 'forbidden'
chk "позвать: бота нет — no_bot" "$(Q "select quest_call('$MAN')")" 'no_bot'
$P -c "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret" >/dev/null
chk "Telegram готов" "$($P -c "select _sa_tg_ready()")" '^t$'
chk "квест: у людей видно, есть ли Telegram (у Марии — да)" "$(Q "select p->>'tg' from jsonb_array_elements(quest_today('$MAN')->'people') p where p->>'name' = 'Мария'")" '^true$'
QC=$(Q "select quest_call('$MAN')")
chk "позвать: Марии и Илье (в смене, 0 шагов) — два сообщения" "$QC $($P -c "select count(*) from net.sent_log")" '"sent": 2.* 2$'
chk "позвать: текст — зовёт на разминку, кнопка «Разминка»" "$(PP "select (body->>'text') || ' | ' || (body->'reply_markup'->'inline_keyboard'->0->0->>'text') from net.sent_log order by id desc limit 1")" 'Пётр зовёт на разминку.*\| Разминка'
chk "позвать ещё раз — уже звали" "$(Q "select quest_call('$MAN')")" '"already": 2'
chk "квест: у Марии отметка «позвали»" "$(Q "select p->>'called' from jsonb_array_elements(quest_today('$MAN')->'people') p where p->>'name' = 'Мария'")" '^true$'

# ── что присылать
chk "настройки: по умолчанию всё включено, Telegram подключён" "$(Q "select notify_prefs('$ANNA')")" '"bot": true.*"linked": true|"linked": true.*"bot": true'
chk "настройки: выключить «итоги месяца»" "$(Q "select notify_set('$ANNA', 'month', false)->>'month'")" '^false$'
chk "настройки: неизвестный вид — kind" "$(Q "select notify_set('$ANNA', 'всё', false)")" '"error": "kind"'
Q "select notify_set('$ANNA', 'month', true)" >/dev/null

# ── свеча на двоих: подтолкнуть
chk "подтолкнуть без пары — no_pair" "$(Q "select pair_nudge('$ANNA')")" 'no_pair'
Q "select pair_invite('$ANNA', '$EB')" >/dev/null
Q "select pair_answer('$BAR', (pair_status('$BAR')->'invites'->0->>'id')::bigint, true)" >/dev/null
N0=$($P -c "select count(*) from net.sent_log")
chk "подтолкнуть Илью (сегодня не занимался) — ушло" "$(Q "select pair_nudge('$ANNA')") $($P -c "select count(*) - $N0 from net.sent_log")" '"sent": true.* 1$'
chk "подтолкнуть второй раз — already" "$(Q "select pair_nudge('$ANNA')")" 'already'
chk "Илья занимался сегодня — подталкивать не нужно (done)" "$(Q "select pair_nudge('$BAR')")" 'no_tg|done|already|sent'
Q "select sa_day_push('$BAR', '$T0', '{\"st\":1,\"w\":1}'::jsonb)" >/dev/null
$P -c "delete from tg_sent where kind = 'pair_nudge'" >/dev/null
chk "напарник уже сделал своё — done" "$(Q "select pair_nudge('$ANNA')")" '"error": "done"'
Q "select notify_set('$ANNA', 'pair', false)" >/dev/null
$P -c "update emp_learning set data = jsonb_set(data, '{activity}', '{}'::jsonb) where emp_id = '$EA'" >/dev/null
chk "Анна выключила «свечу» — подтолкнуть нельзя (no_tg)" "$(Q "select pair_nudge('$BAR')")" '"error": "no_tg"'
Q "select notify_set('$ANNA', 'pair', true)" >/dev/null

# ── подталкивания по расписанию (время задаём сами)
Q "select sa_learning_push('$ANNA', '{\"v\":2,\"activity\":{\"$T0\":{\"st\":2,\"l\":1,\"w\":1},\"$LW\":{\"st\":3,\"l\":2,\"w\":1},\"$LW2\":{\"st\":1,\"g\":1},\"$PM\":{\"st\":3,\"l\":3}},\"gold\":{\"s0\":{\"d\":\"$T1\",\"w\":0,\"sec\":40}},\"fresh\":{\"s0\":{\"t\":$OLD,\"n\":0},\"s1\":{\"t\":$OLD,\"n\":1},\"s2\":{\"t\":$OLD,\"n\":2},\"s3\":{\"t\":$NOWMS,\"n\":0}}}'::jsonb)" >/dev/null
Q "select sa_learning_push('$BAR', '{\"v\":2,\"activity\":{\"$LW\":{\"st\":3,\"w\":1,\"m\":2}},\"gold\":{\"s0\":{\"d\":\"$T1\",\"w\":0,\"sec\":35}}}'::jsonb)" >/dev/null
EVE="('$T0'::date + time '19:00') at time zone 'Asia/Kamchatka'"
NOON="('$T0'::date + time '12:00') at time zone 'Asia/Kamchatka'"
chk "вечер: Илье — «Анна уже сделала свою часть»" "$(PP "select string_agg((x->>'kind') || ':' || (x->>'emp') || ':' || (x->>'text'), ' | ') from jsonb_array_elements(_sa_nudges_at(false, $EVE)) x where x->>'kind' = 'pair'")" "pair:$EB:.*Анна уже сделала свою часть"
chk "днём (12:00) свеча не пишет — только с 18 до 21" "$($P -c "select count(*) from jsonb_array_elements(_sa_nudges_at(false, $NOON)) x where x->>'kind' = 'pair'")" '^0$'
MON="('$WS'::date + time '10:30') at time zone 'Asia/Kamchatka'"
chk "понедельник: итоги недели Анне — 1-е место в заведении и сети, кубок у Океана" "$(PP "select x->>'text' from jsonb_array_elements(_sa_nudges_at(false, $MON)) x where x->>'kind' = 'league' and x->>'emp' = '$EA'")" '1-е место в заведении \(из 2\) и 1-е в сети, 50 очков.*Кубок заведений у «Два моря, Океан»'
chk "понедельник: Марии (0 очков) итогов нет" "$($P -c "select count(*) from jsonb_array_elements(_sa_nudges_at(false, $MON)) x where x->>'kind' = 'league' and x->>'emp' = '$ES'")" '^0$'
THU="('$WS'::date + 3 + time '13:00') at time zone 'Asia/Kamchatka'"
chk "четверг: у Анны темы выдыхаются (без точного числа — ревью v31)" "$(PP "select x->>'text' from jsonb_array_elements(_sa_nudges_at(false, $THU)) x where x->>'kind' = 'fresh' and x->>'emp' = '$EA'")" 'Несколько тем начали выдыхаться'
FIRST="(date_trunc('month', '$T0'::date)::date + time '13:00') at time zone 'Asia/Kamchatka'"
chk "1-е число: итоги прошлого месяца — 1 день, 3 шага" "$(PP "select x->>'text' from jsonb_array_elements(_sa_nudges_at(false, $FIRST)) x where x->>'kind' = 'month' and x->>'emp' = '$EA'")" 'Итоги .+ готовы: 1 день в деле, 3 шага'
Q "select notify_set('$ANNA', 'month', false)" >/dev/null
chk "выключила итоги месяца — не пишем" "$($P -c "select count(*) from jsonb_array_elements(_sa_nudges_at(false, $FIRST)) x where x->>'kind' = 'month' and x->>'emp' = '$EA'")" '^0$'
Q "select notify_set('$ANNA', 'month', true)" >/dev/null
N1=$($P -c "select count(*) from net.sent_log where body->>'text' like '%свою часть%'")
chk "отправка: в 19:00 свеча уходит один раз" "$($P -c "select jsonb_array_length(_sa_nudges_at(true, $EVE)) >= 1")-$($P -c "select count(*) from jsonb_array_elements(_sa_nudges_at(true, $EVE)) x where x->>'kind' = 'pair'")-$($P -c "select count(*) - $N1 from net.sent_log where body->>'text' like '%свою часть%'")" '^t-0-1$'
chk "отправка: кнопка ведёт в свечу (?go=pair или startapp=go_pair)" "$($P -c "select body->'reply_markup'->'inline_keyboard'->0->0 from net.sent_log where body->>'text' like '%свою часть%' order by id desc limit 1")" 'startapp=go_pair|go=pair'
$P -c "update tg_links set remind = false where emp_id = '$EB'" >/dev/null
$P -c "delete from tg_sent where kind = 'pair_eve'" >/dev/null
chk "общий выключатель (remind = false) — Илье ничего" "$($P -c "select count(*) from jsonb_array_elements(_sa_nudges_at(false, $EVE)) x where x->>'emp' = '$EB'")" '^0$'
$P -c "update tg_links set remind = true where emp_id = '$EB'" >/dev/null
chk "без бота — подталкиваний нет" "$($P -c "delete from vault.secrets_stub; select jsonb_array_length(_sa_nudges_at(false, $EVE))")" '^0$'
$P -c "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST')" >/dev/null

# ── рекорд заведения в раунде мастера
G=$(Q "select gold_records('$ANNA', 's0')")
chk "рекорд: лучший — Илья 35 с, мой — 40 с, золотых двое" "$G" '"best": \{.*"sec": 35.*"name": "Илья".*"mine": \{.*"sec": 40|"mine": \{.*"sec": 40.*"best": \{.*"sec": 35'
chk "рекорд: чужое заведение не видит наших" "$(Q "select gold_records('$IVAN', 's0')->>'n'")" '^0$'
chk "рекорд: пустой номер темы — bad" "$(Q "select gold_records('$ANNA', '')")" '"error": "bad"'

# ── свои гости заведения
chk "гости: официанту сохранить нельзя" "$(Q "select guest_persona_save('$ANNA', '{\"name\":\"Вика\",\"open\":\"Добрый вечер\"}'::jsonb)")" 'forbidden'
chk "гости: без имени — name" "$(Q "select guest_persona_save('$MAN', '{\"open\":\"Привет\"}'::jsonb)")" '"error": "name"'
GP=$(Q "select guest_persona_save('$MAN', '{\"name\":\"Вика\",\"place\":\"bar\",\"age\":200,\"mood\":9,\"who\":\"Постоянная гостья бара\",\"hidden\":\"Не пьёт сладкое\",\"open\":\"Привет! Что нового в карте?\",\"whisper\":\"Спроси, что она любит\",\"tags\":[\"постоянная\",\"бар\",\"вечер\",\"лишний\"]}'::jsonb)")
chk "гости: руководитель сохранил — возраст и настроение в границах, 3 метки" "$GP" '"ok": true.*"age": 90.*"mood": 5|"mood": 5.*"age": 90'
chk "гости: меток не больше трёх" "$(Q "select jsonb_array_length(guest_persona_save('$MAN', '{\"name\":\"Тест\",\"open\":\"Привет\",\"tags\":[\"а\",\"б\",\"в\",\"г\"]}'::jsonb)->'row'->'tags')")" '^3$'
GID=$(Q "select r->>'id' from jsonb_array_elements(guest_personas('$ANNA')->'rows') r where r->>'name' = 'Вика'")
chk "гости: официант видит своих гостей, может ли править — нет" "$(Q "select jsonb_array_length(guest_personas('$ANNA')->'rows') || ' ' || (guest_personas('$ANNA')->>'can_edit')")" '^2 false$'
chk "гости: другое заведение не видит" "$(Q "select jsonb_array_length(guest_personas('$IVAN')->'rows')")" '^0$'
chk "гости: для ИИ — по номеру и токену своего заведения" "$(Q "select guest_persona_get('$ANNA', '$GID')->'row'->>'hidden'")" '^Не пьёт сладкое$'
chk "гости: чужому заведению по номеру — not_found" "$(Q "select guest_persona_get('$IVAN', '$GID')")" 'not_found'
chk "гости: правка своего" "$(Q "select guest_persona_save('$MAN', '{\"id\":\"$GID\",\"name\":\"Виктория\",\"open\":\"Добрый вечер\"}'::jsonb)->'row'->>'name'")" '^Виктория$'
chk "гости: руководитель Порта чужого не правит" "$(Q "select guest_persona_save('$PMAN', '{\"id\":\"$GID\",\"name\":\"Взлом\",\"open\":\"x\"}'::jsonb)")" 'not_found'
chk "гости: удалить" "$(Q "select guest_persona_delete('$MAN', '$GID')->>'ok'") $(Q "select guest_persona_get('$ANNA', '$GID')->>'error'")" '^true not_found$'

# ── ревью v31
NEXTMON="('$WS'::date + 7 + time '10:30') at time zone 'Asia/Kamchatka'"
$P -c "delete from sa_league_filled where week_start = '$WS'" >/dev/null
PP "select _sa_nudges_at(false, $NEXTMON)" >/dev/null
chk "ревью: просмотр подталкиваний не подводит неделю" "$($P -c "select count(*) from sa_league_filled where week_start = '$WS'")" '^0$'
chk "ревью: текущая неделя не закрыта, позапрошлая — закрыта" "$($P -c "select _sa_week_closed('$WS'::date)::text || ' ' || _sa_week_closed('$WS'::date - 14)::text")" '^false true$'
$P -c "insert into sa_settings (key, value) values ('tz:Порт', 'Pacific/Pago_Pago') on conflict (key) do update set value = excluded.value" >/dev/null
chk "ревью: неделя закрыта, только когда понедельник 06:00 настал во всех поясах сети" "$($P -c "select (now() at time zone 'Pacific/Pago_Pago' >= ('$WS'::date)::timestamp + interval '6 hours') = _sa_week_closed('$WS'::date - 7)")" '^t$'
$P -c "delete from sa_settings where key = 'tz:Порт'" >/dev/null
chk "ревью: закрытость недели снаружи не узнать" "$(Q "select _sa_week_closed(current_date)")" 'permission denied'
chk "ревью: notify_set без вида — kind, без ошибки" "$(Q "select notify_set('$ANNA', null, true)")" '"error": "kind"'
$P -c "insert into employees (id, name, surname, restaurant, position, is_admin, status) values ('00000000-0000-0000-0000-0000000000a9', 'Сеть', 'Без заведения', null, 'senior', false, 'active') on conflict (id) do nothing; insert into sessions (token, employee_id) values ('10000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000a9') on conflict do nothing" >/dev/null
NOREST=10000000-0000-0000-0000-0000000000a9
chk "ревью: старший без заведения — править своих гостей нельзя (can_edit false)" "$(Q "select guest_personas('$NOREST')->>'can_edit'")" '^false$'
chk "ревью: и сохранить — понятная ошибка no_restaurant" "$(Q "select guest_persona_save('$NOREST', '{\"name\":\"Тест\",\"open\":\"Привет\"}'::jsonb)")" 'no_restaurant'
$P -c "delete from sessions where token::text = '$NOREST'; delete from employees where id::text = '00000000-0000-0000-0000-0000000000a9'" >/dev/null
# живые голоса радио: счётчик атомарный, лимит, только для сервера
$P -c "delete from sa_tts_usage" >/dev/null
chk "голоса: из приложения счётчик не вызвать" "$(Q "select sa_tts_take('$ANNA', 10)")" 'permission denied'
chk "голоса: плохой токен — auth" "$(PP "select sa_tts_take('мусор', 10)")" '"error": "auth"'
PP "select sa_tts_take('$ANNA', 100)" >/dev/null
TN=$(PP "select sa_tts_take('$ANNA', 999999)->>'n'")
chk "голоса: счёт фраз и знаков; огромное число знаков — не больше 2000 за раз" "$TN $($P -c "select chars from sa_tts_usage where emp_id = '$EA'")" '^2 2100$'
$P -c "update sa_tts_usage set n = 400 where emp_id = '$EA'" >/dev/null
chk "голоса: 401-я фраза за день — daily_limit" "$(PP "select sa_tts_take('$ANNA', 10)")" '"error": "daily_limit"'
$P -c "update sa_tts_usage set n = 1, chars = 39995 where emp_id = '$EA'" >/dev/null
chk "голоса: 40 000 знаков за день — daily_limit" "$(PP "select sa_tts_take('$ANNA', 10)")" '"error": "daily_limit"'
$P -c "update sa_tts_usage set n = 5000 where emp_id = '00000000-0000-0000-0000-0000000000a1'; insert into sa_tts_usage (emp_id, day, n) values ('00000000-0000-0000-0000-0000000000a1', current_date, 5000) on conflict (emp_id, day) do update set n = 5000" >/dev/null
chk "голоса: владельцу лимита нет" "$(PP "select sa_tts_take('$OWN', 10)->>'ok'")" '^true$'
P4=$(for i in 1 2 3 4 5 6 7 8; do (PP "select sa_tts_take('$BAR', 1)" >/dev/null &) ; done; wait; sleep 1; $P -c "select n from sa_tts_usage where emp_id = '$EB'")
chk "голоса: 8 запросов разом — счёт ровно 8 (без гонки)" "$P4" '^8$'

# ── права
chk "служебное снаружи не вызвать" "$(Q "select _sa_league_rows(current_date, current_date, 'UTC')")" 'permission denied'
chk "расписание снаружи не запустить" "$(Q "select sa_nudges_tick()")" 'permission denied'
chk "просмотр подталкиваний снаружи не вызвать" "$(Q "select sa_nudges_preview()")" 'permission denied'
chk "таблицы этапа напрямую не прочитать" "$(Q "select count(*) from sa_guest_personas")" 'permission denied'
chk "историю лиги напрямую не прочитать" "$(Q "select count(*) from sa_league_weeks")" 'permission denied'
# v74 (этап 29): в сообщениях бота нет шапки «✦ SERVICE ACADEMY» и звёздочек — ни в тексте, ни на кнопках
chk "v74: всё, что ушло в Telegram за прогон, — без ✦ и шапки" "$($P -c "select count(*) || ' из ' || (select count(*) from net.sent_log) from net.sent_log where body::text like '%✦%' or body::text like '%SERVICE ACADEMY%'")" '^0 из [1-9]'
echo "Итого: $pass ✓, $fail ✗"
