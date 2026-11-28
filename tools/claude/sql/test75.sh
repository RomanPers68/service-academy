#!/bin/bash
# Этап 75 (v221, Доп. 547): «Утро руководителя» менеджеру — только в дни его смен по графику.
# Поверх базы run25.sh: копия satest75; этап 75 раньше 40 (понятная ошибка) → этапы 26, 31, 32, 34, 35, 36, 37, 38, 39,
# 40 → 75 дважды; свой график: у менеджера Петра сегодня выходной, завтра смена, послезавтра отпуск; у менеджера Глеба
# сегодня кейтеринг; менеджер Лев в графике, но месяц для него не составлен; у Ирины («Порт») графика нет. Проверки ✓/✗.
# Отправка в Telegram — заглушка pg_net (net.sent_log). Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT
# (5433), пользователь postgres.
#   bash run25.sh && bash test75.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest75
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql supabase-stage40-morning.sql"
S75=supabase-stage75-morning-shift.sql
D=$(mktemp -d); for f in $PRE $MID $S75; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT75=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = $S75 ] && OUT75="$out"; }
# этап 75 раньше времени: просит этап 40 и ничего не меняет
NO40=$($P0 -d $DB -f "$D/$S75" 2>&1)
NOCOL=$($P0 -d $DB -t -A -c "select count(*) from information_schema.columns where table_name = 'sa_notify_prefs' and column_name = 'morning_shift'" 2>&1)
for f in $PRE; do run $f; done
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
for f in $MID $S75 $S75; do run $f; done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4
REMP=00000000-0000-0000-0000-0000000000a1; MEMP=00000000-0000-0000-0000-0000000000a2; PEMP=00000000-0000-0000-0000-0000000000a3
IREMP=00000000-0000-0000-0000-0000000000b1; GEMP=00000000-0000-0000-0000-0000000000c1; LEMP=00000000-0000-0000-0000-0000000000c2
TZ0=Asia/Kamchatka
LD="(now() at time zone '$TZ0')::date"
R="'Два моря, Океан'"
sentn() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1'"; }
DAY() { PP "select _sa_morning_day('$1', $2, $LD + $3)"; }
DUE() { PP "select coalesce(string_agg(x->>'name', ',' order by x->>'name'), '-') from jsonb_array_elements(_sa_morning_due(false, ($LD + ${2:-0} + time '$1') at time zone '$TZ0')) x"; }
HAS() { PP "select count(*) from jsonb_array_elements(_sa_morning_due(false, ($LD + $2 + time '09:30') at time zone '$TZ0')) x where x->>'name' = '$1'"; }

chk "этап 75 раньше этапа 40 — понятная ошибка, колонки нет" "$(echo "$NO40" | tr '\n' ' ') · $NOCOL" 'Сначала этап 40 \(supabase-stage40-morning\.sql\).* · 0$'
chk "этапы 26–40 и 75 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: с Telegram каждый день — Мария (управляющий), только в дни смен — Пётр (менеджер)" \
  "$(echo "$OUT75" | grep -o 'Утро руководителя: .*')" '^Утро руководителя: менеджеру — в дни его смен по графику · руководители с Telegram: каждый день — 1, только в дни смен — 1$'
chk "колонка morning_shift: пусто по умолчанию (по должности)" \
  "$(PP "select concat_ws('|', data_type, is_nullable, coalesce(column_default, 'нет')) from information_schema.columns where table_name = 'sa_notify_prefs' and column_name = 'morning_shift'")" '^boolean\|YES\|нет$'
chk "по должности: менеджер — только в смены; управляющий, владелец, менеджер-владелец, сервис-менеджер — каждый день; свой выбор главнее" \
  "$(PP "select concat_ws(',', _sa_morning_shift_only('manager', false, null), _sa_morning_shift_only('Manager', null, null), _sa_morning_shift_only('senior', false, null), _sa_morning_shift_only('owner', true, null), _sa_morning_shift_only('manager', true, null), _sa_morning_shift_only('service_manager', false, null), _sa_morning_shift_only('manager', false, false), _sa_morning_shift_only('senior', false, true))")" \
  '^t,t,f,f,f,f,f,t$'

# ── люди и график: Пётр — сегодня выходной, вчера и завтра смены, послезавтра отпуск; Глеб — сегодня кейтеринг;
#    Лев — в графике, смен в месяце нет; Мария — сегодня выходной (управляющей сводка всё равно каждый день) ──
cat > "$D/seed75.sql" <<SQL
set client_min_messages = warning;
insert into employees (id, name, surname, restaurant, position, is_admin, status) values
 ('$GEMP', 'Глеб', 'Сменный', 'Два моря, Океан', 'manager', false, 'active'),
 ('$LEMP', 'Лев', 'Новый', 'Два моря, Океан', 'manager', false, 'active');
insert into sessions (token, employee_id) values ('10000000-0000-0000-0000-0000000000c1', '$GEMP');
insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values ('$REMP', 555, 'Два моря, Океан', 'Роман Владелец', true),
 ('$IREMP', 666, 'Порт', 'Ирина Портова', true), ('$GEMP', 777, 'Два моря, Океан', 'Глеб Сменный', true), ('$LEMP', 888, 'Два моря, Океан', 'Лев Новый', true)
 on conflict (emp_id) do update set remind = true;
insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;
insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;
delete from schedule_months where restaurant = 'Два моря, Океан'; delete from schedule_venues where restaurant = 'Два моря, Океан';
do \$\$
declare ld date := $LD; d date; i int; mk text; dn text; plans jsonb := '{}'::jsonb; m text; pl jsonb;
begin
  insert into schedule_venues (restaurant, venue_key, title, config) values ('Два моря, Океан', 'main', 'Океан', jsonb_build_object(
    'staff', jsonb_build_array(
      jsonb_build_object('id', 's1', 'name', 'Мария Ким', 'pos', 'manager'),
      jsonb_build_object('id', 's4', 'name', 'Пётр Иванов', 'pos', 'manager',
        'vacs', jsonb_build_object(to_char(ld + 2, 'YYYY-MM'), jsonb_build_array(jsonb_build_array(extract(day from ld + 2)::int, extract(day from ld + 2)::int)))),
      jsonb_build_object('id', 's7', 'name', 'Глеб Сменный', 'pos', 'manager'),
      jsonb_build_object('id', 's9', 'name', 'Лев Новый', 'pos', 'manager'),
      jsonb_build_object('id', 's5', 'name', 'Анна Смирнова', 'pos', 'waiter')),
    'shifts', '[{"k":"У","name":"Утро","from":10,"to":18},{"k":"Д","name":"День","from":12,"to":20},{"k":"В","name":"Вечер","from":16,"to":24},{"k":"К","name":"Кейтеринг","from":10,"to":22,"extra":1}]'::jsonb));
  for i in -1..3 loop
    d := ld + i; mk := to_char(d, 'YYYY-MM'); dn := extract(day from d)::int::text;
    if not plans ? mk then plans := plans || jsonb_build_object(mk, '{"s1":{},"s4":{},"s7":{},"s9":{},"s5":{}}'::jsonb); end if;
    if i <> 0 then plans := jsonb_set(plans, array[mk, 's1', dn], to_jsonb('У'::text)); end if;
    if i in (-1, 1) then plans := jsonb_set(plans, array[mk, 's4', dn], to_jsonb('Д'::text)); end if;
    if i = 0 then plans := jsonb_set(plans, array[mk, 's7', dn], to_jsonb('К'::text)); end if;
    plans := jsonb_set(plans, array[mk, 's5', dn], to_jsonb('В'::text));
  end loop;
  for m, pl in select key, value from jsonb_each(plans) loop
    insert into schedule_months (restaurant, venue_key, month, payload) values ('Два моря, Океан', 'main', m, jsonb_build_object('plan', pl));
  end loop;
end \$\$;
SQL
SEED=$($P0 -d $DB -f "$D/seed75.sql" 2>&1); chk "люди и график — без ошибок" "${SEED:-ok}" '^ok$'
PP "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs" >/dev/null

# ── что у человека в графике ──
chk "Пётр: вчера смена, сегодня выходной, завтра смена, послезавтра отпуск" "$(DAY $PEMP "$R" -1) $(DAY $PEMP "$R" 0) $(DAY $PEMP "$R" 1) $(DAY $PEMP "$R" 2)" '^shift off shift vac$'
chk "Глеб сегодня на кейтеринге — тоже смена" "$(DAY $GEMP "$R" 0)" '^shift$'
chk "не знаем: Лев (смен в месяце нет), Роман (нет в графике), Ирина (у «Порта» графика нет), Пётр через два месяца (месяц не составлен)" \
  "[$(DAY $LEMP "$R" 0)] [$(DAY $REMP "$R" 0)] [$(DAY $IREMP "'Порт'" 0)] [$(DAY $PEMP "$R" 62)]" '^\[\] \[\] \[\] \[\]$'
PP "update schedule_months set payload = jsonb_set(payload, '{plan,s9}', '{\"1\": 5, \"2\": [\"Д\"], \"3\": \"Х\"}'::jsonb) where restaurant = 'Два моря, Океан'" >/dev/null
chk "мусор в строке графика (не буквы, чужие буквы) — не смена и не ошибка: по-прежнему «не знаем»" "[$(DAY $LEMP "$R" 0)]" '^\[\]$'
PP "update schedule_months set payload = payload #- '{plan,s9}' where restaurant = 'Два моря, Океан'" >/dev/null

# ── кому пора ──
chk "сегодня в 9:30: Роман, Мария, Глеб (кейтеринг), Лев и Ирина (графика нет — как раньше); Петру в выходной — нет" "$(DUE 09:30)" '^Глеб,Ирина,Лев,Мария,Роман$'
chk "Пётр завтра в смене — завтра ему придёт; послезавтра в отпуске — нет" "$(HAS Пётр 1) $(HAS Пётр 2)" '^1 0$'
chk "окно то же: в 8:59 никому, в 12:00 никому" "$(DUE 08:59) $(DUE 12:00)" '^- -$'
chk "Пётр: «Каждый день» — сегодня приходит и ему; в настройках shift=false" \
  "$(Q "select morning_shift_set('$PETR', false)->'prefs'->>'shift'") $(DUE 09:30)" '^false Глеб,Ирина,Лев,Мария,Пётр,Роман$'
chk "Пётр вернул «По должности» (пусто) — снова только в смены" "$(Q "select morning_shift_set('$PETR', null)->'prefs'->>'shift'") $(HAS Пётр 0)" '^true 0$'
chk "Мария: «Только в мои смены» — сегодня у неё выходной, не приходит; завтра смена — приходит" \
  "$(Q "select morning_shift_set('$MARIA', true)->'prefs'->>'shift'") $(HAS Мария 0) $(HAS Мария 1)" '^true 0 1$'
chk "Роман: «Только в мои смены», но в графике его нет — приходит каждый день, как раньше" \
  "$(Q "select morning_shift_set('$ROMAN', true)->'prefs'->>'today'") $(HAS Роман 0)" '^ 1$|^1$'
Q "select morning_shift_set('$MARIA', false)" >/dev/null; Q "select morning_shift_set('$ROMAN', null)" >/dev/null
Q "select morning_set('$PETR', false)" >/dev/null
chk "выключил «Присылать» — не приходит и в смену" "$(HAS Пётр 1)" '^0$'
Q "select morning_set('$PETR', true)" >/dev/null

# ── в приложении ──
chk "Пётр в «Утре»: только в смены, сегодня выходной; час и остальное — как раньше" \
  "$(Q "select concat_ws('|', p->>'on', p->>'hour', p->>'shift', p->>'today', p->>'linked', p->>'bot') from (select morning_brief('$PETR')->'prefs' p) x")" '^true\|9\|true\|off\|true\|true$'
chk "Глеб: сегодня смена; Мария: каждый день, сегодня выходной; Роман: каждый день, в графике нет" \
  "$(Q "select concat_ws('|', morning_brief('10000000-0000-0000-0000-0000000000c1')->'prefs'->>'today', morning_brief('$MARIA')->'prefs'->>'shift', morning_brief('$MARIA')->'prefs'->>'today', morning_brief('$ROMAN')->'prefs'->>'shift', '[' || (morning_brief('$ROMAN')->'prefs'->>'today') || ']')")" \
  '^shift\|false\|off\|false\|\[\]$'
chk "morning_set отвечает теми же настройками (shift и today на месте)" "$(Q "select concat_ws('|', p->>'shift', p->>'today') from (select morning_set('$PETR', null, 10)->'prefs' p) x")" '^true\|off$'
Q "select morning_set('$PETR', null, 9)" >/dev/null
chk "выбор — только руководителям: Анна — forbidden, мусор — auth" "$(Q "select concat_ws('|', morning_shift_set('$ANNA', true)->>'error', morning_shift_set('мусор', true)->>'error')")" '^forbidden\|auth$'
chk "Пётр в выходной: «Прислать сейчас» работает" "$(Q "select morning_send_now('$PETR')->>'ok'") $(sentn 444)" '^true 1$'

# ── отправка по расписанию ──
PP "delete from net.sent_log; delete from tg_sent" >/dev/null
chk "отправка в 9:30: пятерым, Петру нет; отметки «отправлено» у него нет" \
  "$(PP "select jsonb_array_length(_sa_morning_due(true, ($LD + time '09:30') at time zone '$TZ0'))") $(sentn 444) $(sentn 555) $(PP "select count(*) from tg_sent where emp_id = '$PEMP' and kind = 'morning'")" '^5 0 1 0$'
PP "update schedule_months set payload = jsonb_set(payload, array['plan', 's4', extract(day from $LD)::int::text], '\"В\"') where restaurant = 'Два моря, Океан' and month = to_char($LD, 'YYYY-MM')" >/dev/null
chk "в 9:40 Петру поставили вечер — со следующего запуска сводка уходит ему, остальным второй раз нет" \
  "$(PP "select string_agg(x->>'name', ',') from jsonb_array_elements(_sa_morning_due(true, ($LD + time '09:40') at time zone '$TZ0')) x") $(sentn 444) $(sentn 555) $(PP "select count(*) from tg_sent where emp_id = '$PEMP' and kind = 'morning'")" '^Пётр 1 1 1$'

# ── права ──
chk "anon: служебные функции закрыты, выбор открыт (с чужим токеном — auth)" \
  "$(Q "select _sa_morning_day('$PEMP', 'Два моря, Океан', current_date)") · $(Q "select _sa_morning_shift_only('manager', false, null)") · $(Q "select morning_shift_set('мусор', true)->>'error'")" \
  'permission denied.* · .*permission denied.* · auth$'
chk "этап 40 не тронут: сводка, текст и morning_set — прежние (по одному определению)" \
  "$(PP "select count(*) from pg_proc where proname in ('_sa_morning_at', '_sa_morning_text', 'morning_set', 'morning_shift_set', '_sa_morning_due', '_sa_morning_prefs', '_sa_morning_day', '_sa_morning_shift_only')")" '^8$'

echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
