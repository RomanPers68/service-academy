#!/bin/bash
# Этап 41 (v107, Доп. 420): новичок — тёплый вход, наставник из команды, темы с собеседования.
# Поверх базы run25.sh: копия satest41; этап 41 раньше 38 (понятная ошибка) → этапы 8, 26, 31, 32, 34, 35, 36, 37, 38, 39 →
# 41 дважды; новый сотрудник (триггер), график с первой сменой завтра, собеседования «Берём», памятка, наставник, карточки
# «Знакомьтесь» и «самостоятельная смена», сообщения бота накануне первой смены; проверки ✓/✗. Отправка в Telegram —
# заглушка pg_net (net.sent_log), pg_cron — своя заглушка. Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT
# (5433), пользователь postgres. Если есть node — тексты бота, темы собеседования и памятка сверяются с lib/newbie.js.
#   bash run25.sh && bash test41.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
LIB=${SA_LIB:-$HERE/../../../lib}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest41
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage8-candidates.sql supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql"
S41=supabase-stage41-newbie.sql
D=$(mktemp -d); for f in $PRE $MID $S41; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT41=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = $S41 ] && OUT41="$out"; }
for f in $PRE; do run $f; done
# этап 41 раньше 38: просит нужный этап и ничего не меняет
NO38=$($P0 -d $DB -f "$D/$S41" 2>&1)
NOTAB=$($P0 -d $DB -t -A -c "select count(*) from pg_class where relname = 'sa_newbies'" 2>&1)
for f in $MID $S41 $S41; do run $f; done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PN() { $P -c "$1" 2>&1; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
same() { if [ "$1" = "$2" ]; then echo SAME; else printf 'РАЗНЫЕ\n--- ждали:\n%s\n--- пришло:\n%s' "$2" "$1"; fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; OLEG=10000000-0000-0000-0000-0000000000a6
IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2; KSEN=10000000-0000-0000-0000-0000000000c1; TIM=10000000-0000-0000-0000-0000000000c2
REMP=00000000-0000-0000-0000-0000000000a1; MEMP=00000000-0000-0000-0000-0000000000a2; PEMP=00000000-0000-0000-0000-0000000000a3
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5; OEMP=00000000-0000-0000-0000-0000000000a6
VEMP=00000000-0000-0000-0000-0000000000b2; KEMP=00000000-0000-0000-0000-0000000000c1; TEMP=00000000-0000-0000-0000-0000000000c2
NEMP=00000000-0000-0000-0000-0000000000c3; XEMP=00000000-0000-0000-0000-0000000000c4
TZ0=Asia/Kamchatka
LD="(now() at time zone '$TZ0')::date"
sentn() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1'"; }

chk "этап 41 раньше этапа 38 — понятная ошибка, таблиц нет" "$(echo "$NO38" | tr '\n' ' ') · $NOTAB" 'Сначала этап 38 \(supabase-stage38-chat.sql\).* · 0$'
chk "этапы 8, 26–39 и 41 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 9 функций из 9, триггер, без pg_cron — подсказка; в «Новичках» трое (кто пришёл за три недели, без руководителей)" \
  "$(echo "$OUT41" | grep -c 'pg_cron не включён: сообщение новичку накануне первой смены не придёт по расписанию') $(echo "$OUT41" | grep -o 'новичок: .*')" \
  '^1 новичок: 9 функций из 9 · новый сотрудник — сам в «Новичках»: да · расписание: pg_cron не включён · бот: нет \(памятка будет только в приложении\) · сейчас в «Новичках»: 3$'
chk "кто попал в «Новички» сам: Анна, Илья, Иван (Порт); Мария, Пётр, Роман, Ирина и уволенный Олег — нет" \
  "$(PP "select string_agg(e.name, ',' order by e.name) from sa_newbies n join employees e on e.id::text = n.emp_id")" '^Анна,Иван,Илья$'

# ── новый сотрудник: сам в «Новички» (руководитель и владелец — нет); ошибка в триггере не мешает завести сотрудника ──
cat > "$D/seed41.sql" <<SQL
set client_min_messages = warning;
insert into employees (id, name, surname, restaurant, position, is_admin, status) values
 ('$KEMP', 'Ксения', 'Миронова', 'Два моря, Океан', 'waiter', false, 'active'),
 ('$TEMP', 'Тимур', 'Ахметов', 'Два моря, Океан', 'bartender', false, 'active'),
 ('$NEMP', 'Новый', 'Менеджер', 'Два моря, Океан', 'manager', false, 'active'),
 ('$XEMP', 'Второй', 'Владелец', 'Два моря, Океан', 'owner', true, 'active');
insert into sessions (token, employee_id) values ('$KSEN', '$KEMP'), ('$TIM', '$TEMP');
insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;
insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;
insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values ('$KEMP', 777, 'Два моря, Океан', 'Ксения Миронова', true);
-- график: Ксения — первая смена завтра днём, Тимур — завтра вечером; Анна и Илья — каждый день
delete from schedule_months where restaurant = 'Два моря, Океан'; delete from schedule_venues where restaurant = 'Два моря, Океан';
do \$\$
declare ld date := $LD; d date; i int; mk text; dn text; plans jsonb := '{}'::jsonb; m text; pl jsonb;
begin
  insert into schedule_venues (restaurant, venue_key, title, config) values ('Два моря, Океан', 'main', 'Океан', jsonb_build_object(
    'staff', jsonb_build_array(
      jsonb_build_object('id', 's1', 'name', 'Анна Смирнова', 'pos', 'waiter'), jsonb_build_object('id', 's2', 'name', 'Илья Бармен', 'pos', 'bar'),
      jsonb_build_object('id', 's7', 'name', 'Миронова Ксения', 'pos', 'waiter'), jsonb_build_object('id', 's8', 'name', 'Тимур Ахметов', 'pos', 'bar')),
    'shifts', '[{"k":"У","name":"Утро","from":10,"to":18},{"k":"Д","name":"День","from":12.5,"to":20},{"k":"В","name":"Вечер","from":16,"to":24}]'::jsonb));
  for i in -2..6 loop
    d := ld + i; mk := to_char(d, 'YYYY-MM'); dn := extract(day from d)::int::text;
    if not plans ? mk then plans := plans || jsonb_build_object(mk, '{"s1":{},"s2":{},"s7":{},"s8":{}}'::jsonb); end if;
    plans := jsonb_set(plans, array[mk, 's1', dn], to_jsonb('В'::text));
    plans := jsonb_set(plans, array[mk, 's2', dn], to_jsonb('Д'::text));
    if i >= 1 then plans := jsonb_set(plans, array[mk, 's7', dn], to_jsonb(case when i = 2 then 'О' else 'Д' end)); end if;
    if i >= 1 then plans := jsonb_set(plans, array[mk, 's8', dn], to_jsonb('В'::text)); end if;
  end loop;
  for m, pl in select key, value from jsonb_each(plans) loop
    insert into schedule_months (restaurant, venue_key, month, payload) values ('Два моря, Океан', 'main', m, jsonb_build_object('plan', pl));
  end loop;
end \$\$;
-- собеседования: Ксения «Берём» (AI), однофамилица в Порту и Ксения «Не берём» — не она; Глеб «Берём» — ещё не пришёл
insert into candidate_results (restaurant, payload, created_at) values
 ('Два моря, Океан', '{"name":"Ксения Миронова","decision":"hire","aiScores":{"Сервис и гость":78,"Конфликты и сложные ситуации":45,"Приоритеты и организация":70,"Честность и деньги":62,"Команда":85}}', now() - interval '5 days'),
 ('Порт', '{"name":"Ксения Миронова","decision":"hire","aiScores":{"Команда":10}}', now() - interval '4 days'),
 ('Два моря, Океан', '{"name":"Миронова Ксения","decision":"reject","aiScores":{"Команда":5}}', now() - interval '3 days'),
 ('Два моря, Океан', '{"name":"Глеб Соколов","decision":"hire","topics":[{"topic":"Сервис и гость","ok":1,"n":3},{"topic":"Команда","ok":2,"n":2}]}', now() - interval '2 days');
SQL
SEED=$($P0 -d $DB -f "$D/seed41.sql" 2>&1); chk "данные — без ошибок" "${SEED:-ok}" '^ok$'
chk "новые сотрудники: официант и бармен — в «Новичках», менеджер и владелец — нет" \
  "$(PP "select string_agg(e.name, ',' order by e.name) from sa_newbies n join employees e on e.id::text = n.emp_id where n.emp_id in ('$KEMP', '$TEMP', '$NEMP', '$XEMP')")" '^Ксения,Тимур$'
PP "alter table sa_newbies rename to sa_newbies_x" >/dev/null
TRG=$(PP "insert into employees (id, name, surname, restaurant, position) values ('00000000-0000-0000-0000-0000000000c9', 'Проверка', 'Триггера', 'Два моря, Океан', 'waiter'); select count(*) from employees where id = '00000000-0000-0000-0000-0000000000c9'")
PP "alter table sa_newbies_x rename to sa_newbies; delete from employees where id = '00000000-0000-0000-0000-0000000000c9'" >/dev/null
chk "таблицы новичков нет (сломалась) — сотрудника всё равно завели" "$TRG" '(^| )1$'

# ── руководитель: «Новички», убрать и добавить ──
chk "Анна и Илья пришли до этапа — Мария убирает их из «Новичков»; Анне (не руководитель) — нельзя; себя и владельца — нет" \
  "$(Q "select concat_ws('|', newbie_add('$ANNA', '$IEMP', false)->>'error', newbie_add('$MARIA', '$AEMP', false)->>'ok', newbie_add('$MARIA', '$IEMP', false)->>'ok', newbie_add('$MARIA', '$MEMP', true)->>'error', newbie_add('$MARIA', '$REMP', true)->>'error', newbie_add('$MARIA', '$VEMP', true)->>'error')")" \
  '^forbidden\|true\|true\|not_found\|not_found\|not_found$'
chk "у Марии в «Новичках» — Ксения и Тимур (новые сверху), руководитель" \
  "$(Q "select (r->>'lead') || ' ' || (select string_agg(x->>'name', ',' order by o) from jsonb_array_elements(r->'list') with ordinality q(x, o)) from (select newbie_list('$MARIA') r) z")" \
  '^true (Ксения Миронова,Тимур Ахметов|Тимур Ахметов,Ксения Миронова)$'
K="(select (select x from jsonb_array_elements(newbie_list('$MARIA')->'list') x where x->>'emp' = '$KEMP') as k) z"
chk "Ксения у руководителя: собеседование найдено само («Берём», то же имя), темы с баллами (слабые первыми, ниже 70)" \
  "$(Q "select concat_ws('|', k->'cand'->>'how', k->'cand'->>'name', (k->'cand'->>'date') = to_char($LD - 5, 'YYYY-MM-DD'), (select string_agg((f->>'topic') || ' ' || (f->>'score'), ', ' order by o) from jsonb_array_elements(k->'focus') with ordinality q(f, o)), k->>'no_cand') from $K")" \
  '^auto\|Ксения Миронова\|t\|Конфликты и сложные ситуации 45, Честность и деньги 62\|false$'
chk "первая смена — завтра днём (12:30–20:00) по графику, где она «Миронова Ксения»; с нами 0 дней; Telegram есть" \
  "$(Q "select concat_ws('|', (k->'first'->>'day') = to_char($LD + 1, 'YYYY-MM-DD'), k->'first'->>'name', k->'first'->>'from', k->'first'->>'to', k->>'days', k->>'tg') from $K")" \
  '^t\|День\|12\.5\|20\|0\|true$'
chk "кого можно назначить наставником: действующие, не новички и не владелец" \
  "$(Q "select string_agg(t->>'name', ',' order by t->>'name') from jsonb_array_elements(newbie_list('$MARIA')->'team') t")" \
  '^Анна Смирнова,Илья Бармен,Мария Ким,Новый Менеджер,Пётр Иванов$'
chk "собеседования «Берём» своего заведения за 120 дней — для выбора (Порта и «Не берём» нет)" \
  "$(Q "select string_agg((c->>'name') || ':' || jsonb_array_length(c->'focus'), ',' order by c->>'name') from jsonb_array_elements(newbie_list('$MARIA')->'cands') c")" \
  '^Глеб Соколов:1,Ксения Миронова:2$'

# ── памятка ──
chk "памятка: руководитель сохраняет (пробелы и длина — как в приложении, «за сколько» — из 0, 10, 15, 20, 30); Анне — нельзя" \
  "$(Q "select concat_ws('|', newbie_memo_set('$MARIA', '{\"addr\":\"  Служебный  вход со двора \",\"arrive\":20,\"dress\":\"Чёрный верх\",\"extra\":\"Обед в 15:30\"}')->'memo'->>'addr', newbie_memo_set('$ANNA', '{}')->>'error', newbie_memo_set('мусор', '{}')->>'error')") $(PP "select data->>'arrive' from sa_newbie_memo where restaurant = 'Два моря, Океан'")" \
  '^Служебный вход со двора\|forbidden\|auth 20$'
chk "«за сколько» не из списка — 15 минут" "$(PP "select _sa_nb_memo_norm('{\"arrive\":7}')->>'arrive', _sa_nb_memo_norm('{\"arrive\":\"x\"}')->>'arrive'")" '^15\|15$'

# ── новичок: своя неделя ──
chk "Ксения: новичок, памятка заведения, темы с собеседования без баллов, наставника пока нет" \
  "$(Q "select concat_ws('|', r->>'newbie', r->'memo'->>'arrive', r->'memo'->>'addr', (select string_agg(f::text, ',') from jsonb_array_elements(r->'focus') f), coalesce(r->>'buddy', 'нет'), r->>'cand') from (select newbie_me('$KSEN') r) z")" \
  '^true\|20\|Служебный вход со двора\|\{"topic": "Конфликты и сложные ситуации"\},\{"topic": "Честность и деньги"\}\|нет$'
chk "не новичок — newbie: false (кого ведёт — пусто); мусор — auth" "$(Q "select concat_ws('|', newbie_me('$PETR')->>'newbie', newbie_me('$PETR')->>'buddy_of', newbie_me('мусор')->>'error')")" '^false\|\[\]\|auth$'
chk "свои шаги: «Познакомиться», тема собеседования; шаги наставника, мусор и не новичку — нет" \
  "$(Q "select concat_ws('|', (select string_agg(k, ',' order by k) from jsonb_object_keys(newbie_check('$KSEN', array['d1a', 'd2c', 'd3b', 'f:Конфликты и сложные ситуации', 'zzz', 'd3c'], true)->'checked') k), newbie_check('$PETR', array['d1a'], true)->>'error')")" \
  '^d1a,f:Конфликты и сложные ситуации\|not_newbie$'
chk "снять отметку" "$(Q "select string_agg(k, ',') from jsonb_object_keys(newbie_check('$KSEN', array['d1a'], false)->'checked') k")" '^f:Конфликты и сложные ситуации$'

# ── наставник и «Знакомьтесь» ──
chk "наставником нельзя: саму себя, другого новичка, человека из Порта, уволенного; Анне назначать — нельзя" \
  "$(Q "select concat_ws('|', newbie_set('$MARIA', '$KEMP', '$KEMP')->>'error', newbie_set('$MARIA', '$KEMP', '$TEMP')->>'error', newbie_set('$MARIA', '$KEMP', '$VEMP')->>'error', newbie_set('$MARIA', '$KEMP', '$OEMP')->>'error', newbie_set('$ANNA', '$KEMP', '$AEMP')->>'error')")" \
  '^bad_buddy\|bad_buddy\|bad_buddy\|bad_buddy\|forbidden$'
TEAM=$(PP "select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'team'")
HM=$(Q "select newbie_set('$MARIA', '$KEMP', '$AEMP', null, true)->'msg'->>'id'")
chk "Мария назначает Анну и представляет Ксению: карточка «Знакомьтесь» в «Вся команда» — кто, должность, первая смена, наставник" \
  "$(PP "select concat_ws('|', m.chat_id = (select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'team'), m.emp_id = '$MEMP', m.body, m.card->>'t', m.card->>'name', m.card->>'pos', (m.card->'first'->>'day') = to_char($LD + 1, 'YYYY-MM-DD'), m.card->'first'->>'from', m.card->'buddy'->>'name', jsonb_array_length(m.card->'greet')) from sa_chat_msgs m where m.id = ${HM:-0}")" \
  '^t\|t\|Знакомьтесь: Ксения Миронова, официант\|hello\|Ксения Миронова\|waiter\|t\|12\.5\|Анна Смирнова\|0$'
chk "второй раз «представить» — та же карточка; у Ксении наставник Анна, у Анны — «ведёт Ксению»" \
  "$(Q "select concat_ws('|', (newbie_set('$MARIA', '$KEMP', null, null, true)->'msg'->>'id') = '${HM:-x}', newbie_me('$KSEN')->'buddy'->>'name', newbie_me('$ANNA')->'buddy_of'->0->>'name', newbie_me('$KSEN')->'hello'->>'msg' = '${HM:-x}')")" \
  '^t(rue)?\|Анна Смирнова\|Ксения Миронова\|t(rue)?$'
chk "Анна (наставник) видит в «Новичках» только Ксению, без собеседования и баллов; Илья — никого" \
  "$(Q "select concat_ws('|', r->>'lead', (select string_agg(x->>'name', ',') from jsonb_array_elements(r->'list') x), coalesce(r->'list'->0->>'cand', 'нет'), r->'list'->0->'focus'->0->>'score', jsonb_array_length(r->'team')) from (select newbie_list('$ANNA') r) z") $(Q "select jsonb_array_length(newbie_list('$ILYA')->'list')")" \
  '^false\|Ксения Миронова\|нет\|0 0$'
chk "«Поздороваться»: Илья — раз (второй — не добавляет), сама Ксения — self, Иван из Порта и мусор — not_found" \
  "$(Q "select concat_ws('|', jsonb_array_length(chat_greet('$ILYA', ${HM:-0})->'msg'->'card'->'greet'), jsonb_array_length(chat_greet('$ILYA', ${HM:-0})->'msg'->'card'->'greet'), chat_greet('$KSEN', ${HM:-0})->>'error', chat_greet('$IVAN', ${HM:-0})->>'error', chat_greet('$ILYA', 0)->>'error')") $(PP "select m.card->'greet'->0->>'n' from sa_chat_msgs m where m.id = ${HM:-0}")" \
  '^1\|1\|self\|not_found\|not_found Илья Бармен$'
chk "собеседование: «без собеседования» — тем нет; «найти само» — снова; чужое (Порт) — bad_cand" \
  "$(Q "select concat_ws('|', newbie_set('$MARIA', '$KEMP', null, -1)->'item'->>'no_cand', jsonb_array_length(newbie_me('$KSEN')->'focus'), newbie_set('$MARIA', '$KEMP', null, 0)->'item'->'cand'->>'how', newbie_set('$MARIA', '$KEMP', null, (select id from candidate_results where restaurant = 'Порт' limit 1))->>'error')")" \
  '^true\|0\|auto\|bad_cand$'
GLEB=$(PP "select id from candidate_results where payload->>'name' = 'Глеб Соколов'")
chk "выбрать собеседование вручную (Глеб) — темы его, «set»; назад — само" \
  "$(Q "select concat_ws('|', newbie_set('$MARIA', '$KEMP', null, $GLEB)->'item'->'cand'->>'how', newbie_me('$KSEN')->'focus'->0->>'topic', newbie_set('$MARIA', '$KEMP', null, 0)->'item'->'cand'->>'name')")" \
  '^set\|Сервис и гость\|Ксения Миронова$'

# ── подтверждения наставника и самостоятельная смена ──
chk "подтверждает наставник или руководитель: Илья — forbidden, сама Ксения — forbidden, не тот шаг — bad_step; Анна «5 столов» — да" \
  "$(Q "select concat_ws('|', newbie_confirm('$ILYA', '$KEMP', 'd2c', true)->>'error', newbie_confirm('$KSEN', '$KEMP', 'd2c', true)->>'error', newbie_confirm('$ANNA', '$KEMP', 'd1a', true)->>'error', newbie_confirm('$ANNA', '$KEMP', 'd2c', true)->'item'->'confirm'->'d2c'->>'name')")" \
  '^forbidden\|forbidden\|bad_step\|Анна Смирнова$'
SOLO=$(Q "select newbie_confirm('$ANNA', '$KEMP', 'd3b', true)->'item'->'solo'->>'by'")
SM=$(PP "select solo_msg from sa_newbies where emp_id = '$KEMP'")
chk "Анна подтверждает самостоятельную смену: отметка у Ксении, карточка в «Вся команда» (первой смены ещё не было — дни с прихода)" \
  "$SOLO $(PP "select concat_ws('|', m.emp_id = '$AEMP', m.body, m.card->>'t', m.card->>'days', m.card->'buddy'->>'name') from sa_chat_msgs m where m.id = ${SM:-0}")" \
  "^$AEMP t\|Первая самостоятельная смена: Ксения Миронова\|solo\|0\|Анна Смирнова$"
chk "«Наставник новичков» у Анны: вывела на самостоятельную смену Ксению; Ивану из Порта — not_found" \
  "$(Q "select concat_ws('|', jsonb_array_length(chat_newbie_mark('$ILYA', '$AEMP')->'now'), chat_newbie_mark('$ILYA', '$AEMP')->'led'->0->>'name', chat_newbie_mark('$IVAN', '$AEMP')->>'error')") $(Q "select newbie_list('$ANNA')->'led'->0->>'name'")" \
  '^0\|Ксения Миронова\|not_found Ксения Миронова$'
chk "Мария снимает «самостоятельную смену» — карточка уходит, отметки нет" \
  "$(Q "select coalesce(newbie_confirm('$MARIA', '$KEMP', 'd3b', false)->'item'->>'solo', 'нет')") $(PP "select deleted from sa_chat_msgs where id = ${SM:-0}") $(PP "select coalesce(solo_at::text, 'нет') from sa_newbies where emp_id = '$KEMP'")" \
  '^нет t нет$'
PP "update sa_newbies set solo_at = now() - interval '15 days' where emp_id = '$IEMP'; update sa_newbies set off = false where emp_id = '$IEMP'" >/dev/null
chk "через две недели после самостоятельной смены — уже не в «Новичках»" "$(Q "select newbie_me('$ILYA')->>'newbie'")" '^false$'

# ── накануне первой смены: 19:00–23:00 по часам заведения ──
PP "delete from net.sent_log; delete from tg_sent; update sa_newbies set buddy_id = '$IEMP', buddy_by = '$MEMP', hello_msg = null where emp_id = '$TEMP'" >/dev/null
DUE() { PP "select coalesce(string_agg(x->>'name', ',' order by x->>'name'), '-') from jsonb_array_elements(_sa_nb_due(false, ($LD + time '$1') at time zone '$TZ0')) x"; }
chk "сегодня 18:59 — рано, 19:00 и 22:59 — Ксении и Тимуру (первая смена завтра), 23:00 — поздно" "$(DUE 18:59) $(DUE 19:00) $(DUE 22:59) $(DUE 23:00)" '^- Ксения Миронова,Тимур Ахметов Ксения Миронова,Тимур Ахметов -$'
chk "завтра вечером — уже нет (первая смена была бы сегодня)" "$(PP "select jsonb_array_length(_sa_nb_due(false, ($LD + 1 + time '19:30') at time zone '$TZ0'))")" '^0$'
EVE=$(PN "select x->>'text' from jsonb_array_elements(_sa_nb_due(false, ($LD + time '19:30') at time zone '$TZ0')) x where x->>'emp' = '$KEMP'")
DLC=$(PP "select upper(left(_sa_chat_dlong($LD + 1), 1)) || substr(_sa_chat_dlong($LD + 1), 2)")
WANT="<b>Завтра твоя первая смена</b>
$DLC · День 12:30–20:00
Два моря, Океан

Приходи к 12:10
Как найти: Служебный вход со двора
Форма: Чёрный верх
Тебя встретит Анна С., твой наставник
Обед в 15:30

В «Первой неделе» план и с чего начать."
chk "текст новичку: когда, к какому времени (за 20 минут), как найти, форма, кто встретит, ещё" "$(same "$EVE" "$WANT")" '^SAME$'
chk "текст наставнику: кто, должность, смена, к какому времени встретить" \
  "$(same "$(PN "select x->>'buddy_text' from jsonb_array_elements(_sa_nb_due(false, ($LD + time '19:30') at time zone '$TZ0')) x where x->>'emp' = '$KEMP'")" "<b>Завтра первая смена у новичка</b>
Ксения М., официант · День 12:30–20:00
Ты наставник: встреть к 12:10 и покажи, где что.")" '^SAME$'
chk "просмотр ничего не отправил" "$(PP "select count(*) from net.sent_log") $(PP "select count(*) from tg_sent")" '^0 0$'
SENT=$(PP "select jsonb_array_length(_sa_nb_due(true, ($LD + time '19:30') at time zone '$TZ0'))")
chk "отправка: двое; Ксении (777) — памятка с кнопкой «Первая неделя», наставникам Анне (111) и Илье (222) — с «Новички»; Тимуру без Telegram — ничего" \
  "$SENT $(sentn 777) $(sentn 111) $(sentn 222) $(PP "select concat_ws('|', body->>'parse_mode', body->'reply_markup'->'inline_keyboard'->0->0->>'text', body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url') from net.sent_log where body->>'chat_id' = '777'") $(PP "select body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url' from net.sent_log where body->>'chat_id' = '111'")" \
  '^2 1 1 1 HTML\|Первая неделя\|https://app\.example/\?go=newbie https://app\.example/\?go=newbies$'
chk "Тимура ещё не представили — его представляет Мария (назначила наставника), с первой сменой и наставником" \
  "$(PP "select concat_ws('|', m.emp_id = '$MEMP', m.card->>'name', m.card->'buddy'->>'name', m.card->'first'->>'name') from sa_newbies n join sa_chat_msgs m on m.id = n.hello_msg where n.emp_id = '$TEMP'")" \
  '^t\|Тимур Ахметов\|Илья Бармен\|Вечер$'
chk "второй раз в тот же вечер — ничего" "$(PP "select jsonb_array_length(_sa_nb_due(true, ($LD + time '21:00') at time zone '$TZ0'))") $(sentn 777)" '^0 1$'
PP "delete from tg_sent; delete from net.sent_log" >/dev/null
PP "alter function _sa_nb_first(text, text, date) rename to _sa_nb_first0;
    create function _sa_nb_first(p_rest text, p_emp text, p_from date) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$
    begin if p_emp = '$TEMP' then raise exception 'сломалось'; end if; return _sa_nb_first0(p_rest, p_emp, p_from); end \$f\$" >/dev/null
chk "у Тимура что-то сломалось — Ксении всё равно уходит" "$(PP "select coalesce(string_agg(x->>'name', ','), '-') from jsonb_array_elements(_sa_nb_due(true, ($LD + time '19:30') at time zone '$TZ0')) x") $(sentn 777)" \
  'не ушло: сломалось Ксения Миронова 1$'
PP "drop function _sa_nb_first(text, text, date); alter function _sa_nb_first0(text, text, date) rename to _sa_nb_first" >/dev/null
PP "delete from vault.secrets_stub" >/dev/null
chk "бота нет — никому" "$(DUE 19:30)" '^-$'
PP "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST')" >/dev/null

# ── сверка с приложением (lib/newbie.js) ──
PP "delete from tg_sent" >/dev/null
if command -v node >/dev/null 2>&1 && [ -f "$LIB/newbie.js" ]; then
  PP "select jsonb_build_object('me', newbie_me('$KSEN'), 'tim', (select x from jsonb_array_elements(newbie_list('$MARIA')->'list') x where x->>'emp' = '$TEMP'),
      'focus', (select jsonb_agg(_sa_nb_focus(p) order by o) from jsonb_array_elements('[{\"aiScores\":{\"Сервис и гость\":78,\"Конфликты и сложные ситуации\":45,\"Честность и деньги\":62.5,\"Команда\":45}},{\"topics\":[{\"topic\":\"Сервис и гость\",\"ok\":2,\"n\":3},{\"topic\":\"Команда\",\"ok\":0,\"n\":2},{\"topic\":\"Честность и деньги\",\"ok\":1.5,\"n\":3},{\"topic\":\"Приоритеты и организация\",\"ok\":1,\"n\":2},{\"topic\":\"Свой раздел: Веранда\",\"ok\":0.5,\"n\":1}]},{\"aiScores\":{}},{}]') with ordinality q(p, o)),
      'memo', _sa_nb_memo_norm('{\"addr\":\"  a   b \",\"arrive\":\"10\",\"dress\":null}'),
      'eve', (select x->>'text' from jsonb_array_elements(_sa_nb_due(false, ($LD + time '19:30') at time zone '$TZ0')) x where x->>'emp' = '$KEMP'),
      'eveTim', (select x->>'text' from jsonb_array_elements(_sa_nb_due(false, ($LD + time '19:30') at time zone '$TZ0')) x where x->>'emp' = '$TEMP'),
      'buddy', (select x->>'buddy_text' from jsonb_array_elements(_sa_nb_due(false, ($LD + time '19:30') at time zone '$TZ0')) x where x->>'emp' = '$KEMP'),
      'sumHello', _sa_nb_card_sum((select card from sa_chat_msgs where id = ${HM:-0})), 'helloCard', (select card from sa_chat_msgs where id = ${HM:-0}),
      'sumSolo', _sa_nb_card_sum('{\"t\":\"solo\",\"name\":\"Ксения Миронова\"}'))" > "$D/nb.json"
  JS=$(node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const N = await import('file://$LIB/newbie.js');
    const x = JSON.parse(readFileSync('$D/nb.json', 'utf8'));
    const out = [];
    const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
    const eq = (name, a, b) => out.push((canon(a) === canon(b) ? 'OK ' : 'DIFF ') + name + (canon(a) === canon(b) ? '' : ' js=' + canon(a) + ' pg=' + canon(b)));
    eq('eve', N.eveText(x.me), x.eve);
    eq('eveTim', N.eveText({ ...x.tim, rest: x.me.rest }), x.eveTim);
    eq('buddy', N.eveBuddyText(x.me), x.buddy);
    eq('focus', [{ aiScores: { 'Сервис и гость': 78, 'Конфликты и сложные ситуации': 45, 'Честность и деньги': 62.5, 'Команда': 45 } },
      { topics: [{ topic: 'Сервис и гость', ok: 2, n: 3 }, { topic: 'Команда', ok: 0, n: 2 }, { topic: 'Честность и деньги', ok: 1.5, n: 3 }, { topic: 'Приоритеты и организация', ok: 1, n: 2 }, { topic: 'Свой раздел: Веранда', ok: 0.5, n: 1 }] },
      { aiScores: {} }, {}].map(N.focusFromPayload), x.focus);
    eq('memo', N.memoOf({ addr: '  a   b ', arrive: '10', dress: null }), x.memo);
    eq('sumHello', N.newbieCardSum(x.helloCard), x.sumHello);
    eq('sumSolo', N.newbieCardSum({ t: 'solo', name: 'Ксения Миронова' }), x.sumSolo);
    eq('model', N.newbieModel(x.me).first, { day: x.me.first.day, k: 'Д', name: 'День', from: 12.5, to: 20 });
    process.stdout.write(out.join('\n'));" 2>&1)
  chk "приложение (lib/newbie.js) пишет те же тексты бота, находит те же темы собеседования и так же читает памятку" "$(echo "$JS" | grep -c '^OK ') $(echo "$JS" | grep '^DIFF' | head -3)" '^8 *$'
else
  echo "· node нет — сверку с lib/newbie.js пропускаю"
fi

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
run $S41; run $S41
chk "с pg_cron: задание «sa-newbie» раз в 10 минут, повторный запуск — одно; настройки и новички на месте" \
  "$RC $(PP "select count(*) || ' ' || string_agg(schedule || ' ' || command, '') from cron.job where jobname = 'sa-newbie'") $(echo "$OUT41" | grep -o 'расписание: [^·]*·') $(PP "select data->>'arrive' from sa_newbie_memo") $(PP "select buddy_id = '$AEMP' from sa_newbies where emp_id = '$KEMP'")" \
  '^0 1 \*/10 \* \* \* \* select public\.sa_newbie_tick\(\) расписание: каждые 10 минут \(sa-newbie\) · 20 t$'

# ── права ──
chk "anon: 9 функций этапа — можно; служебные — нельзя" \
  "$(PP "select count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname in ('newbie_me', 'newbie_check', 'newbie_list', 'newbie_set', 'newbie_confirm', 'newbie_memo_set', 'newbie_add', 'chat_greet', 'chat_newbie_mark')) || ' ' || count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('newbie_me', 'newbie_check', 'newbie_list', 'newbie_set', 'newbie_confirm', 'newbie_memo_set', 'newbie_add', 'chat_greet', 'chat_newbie_mark')) || ' из ' || count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like '\_sa\_nb\_%' or p.proname like 'sa\_newbie%' or p.proname like 'newbie\_%' or p.proname in ('chat_greet', 'chat_newbie_mark'))")" \
  '^9 0 из 35$'
chk "anon: таблицы новичков и памятки закрыты, «кому пора» и отправка — тоже" "$(Q "select count(*) from sa_newbies") $(Q "select count(*) from sa_newbie_memo") $(Q "select sa_newbie_preview()") $(Q "select sa_newbie_tick()")" \
  'permission denied.*permission denied.*permission denied.*permission denied'

echo
echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
