#!/bin/bash
# Этап 40 (v106, Доп. 419): «Утро руководителя» — сводка заведения на утро: в Telegram по расписанию и на экране «Утро».
# Поверх базы run25.sh: копия satest40; этап 40 раньше 31 и раньше 38 (понятные ошибки) → этапы 26, 31, 32, 34, 35, 36,
# 37, 38, 39 → 40 дважды; свой график на неделю с должностями, опоздание, карточки смен, стоп-лист, «спасибо» гостей,
# брифинг, занятия; проверки ✓/✗. Отправка в Telegram — заглушка pg_net (net.sent_log), pg_cron — своя заглушка.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres. Если есть node — текст
# сводки и кнопки сверяются с приложением (lib/morning.js: экран «Утро» и демо показывают тот же текст).
#   bash run25.sh && bash test40.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
LIB=${SA_LIB:-$HERE/../../../lib}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest40
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql"
S40=supabase-stage40-morning.sql
D=$(mktemp -d); for f in $PRE $MID $S40; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT40=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = $S40 ] && OUT40="$out"; }
# этап 40 раньше времени: просит нужный этап и ничего не меняет
NO31=$($P0 -d $DB -f "$D/$S40" 2>&1)
NOCOL31=$($P0 -d $DB -t -A -c "select count(*) from information_schema.columns where table_name = 'sa_notify_prefs' and column_name like 'morning%'" 2>&1)
for f in $PRE; do run $f; done
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
NO38=$($P0 -d $DB -f "$D/$S40" 2>&1)
for f in $MID $S40 $S40; do run $f; done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PN() { $P -c "$1" 2>&1; }   # как есть, со строками
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
same() { if [ "$1" = "$2" ]; then echo SAME; else printf 'РАЗНЫЕ\n--- ждали:\n%s\n--- пришло:\n%s' "$2" "$1"; fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; OLEG=10000000-0000-0000-0000-0000000000a6
IRINA=10000000-0000-0000-0000-0000000000b1
REMP=00000000-0000-0000-0000-0000000000a1; MEMP=00000000-0000-0000-0000-0000000000a2; PEMP=00000000-0000-0000-0000-0000000000a3
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5; OEMP=00000000-0000-0000-0000-0000000000a6
DEMP=00000000-0000-0000-0000-0000000000a7; VEMP=00000000-0000-0000-0000-0000000000b2
TZ0=Asia/Kamchatka
LD="(now() at time zone '$TZ0')::date"
sentn() { PP "select count(*) from net.sent_log where body->>'chat_id' = '$1'"; }

chk "этап 40 раньше этапа 31 — понятная ошибка, настройки не тронуты" "$(echo "$NO31" | tr '\n' ' ') · $NOCOL31" 'Сначала этап 31 \(supabase-stage31-qday.sql\).* · 0$'
chk "раньше этапа 38 — тоже: какой этап сначала" "$NO38" 'Сначала этап 38 \(supabase-stage38-chat.sql\)'
chk "этапы 26–39 и 40 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 4 функции из 4; без pg_cron — подсказка; бота ещё нет; придёт двоим (Мария, Пётр)" \
  "$(echo "$OUT40" | grep -c 'pg_cron не включён: «Утро руководителя» не придёт по расписанию') $(echo "$OUT40" | grep -o 'утро руководителя: .*')" \
  '^1 утро руководителя: 4 функции из 4 · расписание: pg_cron не включён · бот: нет \(сводка будет только в приложении\) · придёт руководителям с Telegram: 2$'
chk "настройки: «Утро» включено, 9:00 — у всех по умолчанию" "$(PP "select column_name || '=' || column_default from information_schema.columns where table_name = 'sa_notify_prefs' and column_name in ('morning', 'morning_hour') order by 1")" '^morning=true morning_hour=9$'

# ── неделя заведения: график с должностями, опоздание, карточки смен, стоп-лист, «спасибо», брифинг, занятия ──
Q "select chat_list('$ANNA')" >/dev/null; Q "select chat_list('$IRINA')" >/dev/null
TEAM=$(PP "select id from sa_chats where restaurant = 'Два моря, Океан' and kind = 'team'")
cat > "$D/seed40.sql" <<SQL
set client_min_messages = warning;
insert into employees (id, name, surname, restaurant, position, is_admin, status) values
 ('$DEMP', 'Дарья', 'Новикова', 'Два моря, Океан', 'waiter', false, 'active');
insert into sessions (token, employee_id) values ('10000000-0000-0000-0000-0000000000a7', '$DEMP');
insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST') on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;
insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value;
delete from schedule_months where restaurant = 'Два моря, Океан'; delete from schedule_venues where restaurant = 'Два моря, Океан';
-- Анна — вечер каждый день; Илья — бармен, день, через 2 дня выходной; Мария (в графике без фамилии) — утро; Пётр —
-- день, сегодня выходной; «Кто-то Неизвестный» — вечер, сегодня и через 3 дня выходной; Дарья — утро через 4 дня.
-- График составлен со вчера до четвёртого дня: пятый и шестой — пустые (не дыры). Нужно: менеджер, два официанта, бармен
do \$\$
declare ld date := $LD; d date; i int; mk text; dn text; plans jsonb := '{}'::jsonb; m text; pl jsonb;
begin
  insert into schedule_venues (restaurant, venue_key, title, config) values ('Два моря, Океан', 'main', 'Океан', jsonb_build_object(
    'staff', jsonb_build_array(
      jsonb_build_object('id', 's1', 'name', 'Анна Смирнова', 'pos', 'waiter'), jsonb_build_object('id', 's2', 'name', 'Илья Бармен', 'pos', 'bar'),
      jsonb_build_object('id', 's3', 'name', 'Мария', 'pos', 'manager'), jsonb_build_object('id', 's4', 'name', 'Пётр Иванов', 'pos', 'manager'),
      jsonb_build_object('id', 's5', 'name', 'Кто-то Неизвестный', 'pos', 'waiter'), jsonb_build_object('id', 's6', 'name', 'Дарья Новикова', 'pos', 'waiter')),
    'shifts', '[{"k":"У","name":"Утро","from":10,"to":18},{"k":"Д","name":"День","from":12,"to":20},{"k":"В","name":"Вечер","from":16,"to":24}]'::jsonb,
    'need', '{"1":{"manager":1,"waiter":2,"bar":1},"2":{"manager":1,"waiter":2,"bar":1},"3":{"manager":1,"waiter":2,"bar":1}}'::jsonb));
  for i in -1..4 loop
    d := ld + i; mk := to_char(d, 'YYYY-MM'); dn := extract(day from d)::int::text;
    if not plans ? mk then plans := plans || jsonb_build_object(mk, '{"s1":{},"s2":{},"s3":{},"s4":{},"s5":{},"s6":{}}'::jsonb); end if;
    plans := jsonb_set(plans, array[mk, 's1', dn], to_jsonb('В'::text));
    plans := jsonb_set(plans, array[mk, 's2', dn], to_jsonb(case when i = 2 then 'О' else 'Д' end));
    plans := jsonb_set(plans, array[mk, 's3', dn], to_jsonb('У'::text));
    plans := jsonb_set(plans, array[mk, 's4', dn], to_jsonb(case when i = 0 then 'О' else 'Д' end));
    plans := jsonb_set(plans, array[mk, 's5', dn], to_jsonb(case when i in (0, 3) then 'О' else 'В' end));
    if i = 4 then plans := jsonb_set(plans, array[mk, 's6', dn], to_jsonb('У'::text)); end if;
  end loop;
  for m, pl in select key, value from jsonb_each(plans) loop
    insert into schedule_months (restaurant, venue_key, month, payload) values ('Два моря, Океан', 'main', m, jsonb_build_object('plan', pl));
  end loop;
end \$\$;
-- Анна сегодня опаздывает
insert into sa_late (emp_id, day, restaurant, emp_name, min, eta) values ('$AEMP', $LD, 'Два моря, Океан', 'Анна Смирнова', 15, '16:15');
-- карточки смен в «Вся команда»: Анна отдаёт завтрашнюю; ищем двух барменов через 4 дня, одного уже нашли; закрытая,
-- удалённая и дальше недели — не в счёт
insert into sa_chat_msgs (chat_id, emp_id, emp_name, kind, card, deleted) values
 ($TEAM, '$AEMP', 'Анна Смирнова', 'card', jsonb_build_object('t', 'shift', 'st', 'open', 'mode', 'give', 'date', to_char($LD + 1, 'YYYY-MM-DD'), 'fromName', 'Анна Смирнова', 'posKey', 'waiter'), false),
 ($TEAM, '$MEMP', 'Мария Ким', 'card', jsonb_build_object('t', 'shift', 'st', 'open', 'mode', 'need', 'date', to_char($LD + 4, 'YYYY-MM-DD'), 'posKey', 'bar', 'n', 2, 'took', jsonb_build_array(jsonb_build_object('id', 'x'))), false),
 ($TEAM, '$IEMP', 'Илья Бармен', 'card', jsonb_build_object('t', 'shift', 'st', 'done', 'mode', 'swap', 'date', to_char($LD + 1, 'YYYY-MM-DD'), 'fromName', 'Илья Бармен', 'posKey', 'bar'), false),
 ($TEAM, '$AEMP', 'Анна Смирнова', 'card', jsonb_build_object('t', 'shift', 'st', 'open', 'mode', 'give', 'date', to_char($LD + 9, 'YYYY-MM-DD'), 'fromName', 'Анна Смирнова', 'posKey', 'waiter'), false),
 ($TEAM, '$AEMP', 'Анна Смирнова', 'card', jsonb_build_object('t', 'shift', 'st', 'open', 'mode', 'give', 'date', to_char($LD + 2, 'YYYY-MM-DD'), 'fromName', 'Анна Смирнова', 'posKey', 'waiter'), true);
-- стоп-лист (меню команды, этап 4): два блюда; архивное и без названия — нет
create table if not exists restaurant_menu (restaurant text primary key, dishes jsonb not null default '[]', updated_by text, updated_at timestamptz default now());
insert into restaurant_menu (restaurant, dishes) values ('Два моря, Океан', '[{"name":"Уха по-фински","stop":{"by":"Мария Ким"}},{"name":"Борщ"},{"name":"Тартар из тунца","stop":{}},{"name":"Старое блюдо","stop":{},"archived":true},{"name":"  ","stop":{}}]'::jsonb)
  on conflict (restaurant) do update set dishes = excluded.dishes;
-- «спасибо» гостей вчера: Анне два, Илье одно; скрытое, позавчерашнее и чужого заведения — не в счёт
insert into sa_guest_thanks (emp_id, restaurant, text, hidden, created_at) values
 ('$AEMP', 'Два моря, Океан', 'Спасибо Анне за чудесный вечер и внимание к деталям!', false, (($LD - 1) + time '20:00') at time zone '$TZ0'),
 ('$AEMP', 'Два моря, Океан', 'Супер', false, (($LD - 1) + time '21:00') at time zone '$TZ0'),
 ('$IEMP', 'Два моря, Океан', 'Лучший коктейль в городе, спасибо бармену', false, (($LD - 1) + time '22:00') at time zone '$TZ0'),
 ('$IEMP', 'Два моря, Океан', 'Скрытое спасибо, его не видно никому вообще', true, (($LD - 1) + time '22:30') at time zone '$TZ0'),
 ('$AEMP', 'Два моря, Океан', 'Позавчерашнее спасибо, оно уже не вчерашнее', false, (($LD - 2) + time '20:00') at time zone '$TZ0'),
 ('$VEMP', 'Порт', 'Спасибо Ивану из другого заведения сети', false, (($LD - 1) + time '20:00') at time zone '$TZ0');
-- вчерашний брифинг: прочитали Анна, Илья, Пётр (в смене) и Роман (не в смене — не в счёт)
insert into sa_briefs (restaurant, day, data, text) values ('Два моря, Океан', $LD - 1, '{}', '');
insert into sa_brief_reads (restaurant, day, emp_id) values ('Два моря, Океан', $LD - 1, '$AEMP'), ('Два моря, Океан', $LD - 1, '$IEMP'),
  ('Два моря, Океан', $LD - 1, '$PEMP'), ('Два моря, Океан', $LD - 1, '$REMP');
-- занятия: Анна и Мария — вчера; Илья — восемь дней назад (и мусорные ключи с телефона); Дарья — ни разу
insert into emp_learning (emp_id, emp_name, restaurant, data) values
 ('$AEMP', 'Анна Смирнова', 'Два моря, Океан', jsonb_build_object('activity', jsonb_build_object(to_char($LD - 1, 'YYYY-MM-DD'), '{"st":1}'::jsonb))),
 ('$MEMP', 'Мария Ким', 'Два моря, Океан', jsonb_build_object('activity', jsonb_build_object(to_char($LD - 1, 'YYYY-MM-DD'), '{"f":2}'::jsonb))),
 ('$IEMP', 'Илья Бармен', 'Два моря, Океан', jsonb_build_object('streak', jsonb_build_object('days', jsonb_build_array(to_char($LD - 8, 'YYYY-MM-DD'), '2026-09-31')),
   'activity', '{"мусор":{"st":1},"2026-02-30":{"st":2}}'::jsonb))
on conflict (emp_id) do update set data = excluded.data;
SQL
SEED=$($P0 -d $DB -f "$D/seed40.sql" 2>&1); chk "данные недели — без ошибок" "${SEED:-ok}" '^ok$'
PP "delete from net.sent_log; delete from tg_sent" >/dev/null

# ── сводка (morning_brief) ──
B="morning_brief('$MARIA')"
chk "Мария (старший): сегодня по часам заведения, «Два моря, Океан», в смене трое — по сменам, у каждого имя коротко" \
  "$(Q "select concat_ws('|', b->>'ok', ((b->>'day') = to_char($LD, 'YYYY-MM-DD'))::text, b->>'rest', b->>'sched', b->>'count', (select string_agg((s->>'name') || ' ' || (s->>'from') || '-' || (s->>'to') || ': ' || (select string_agg(p->>'n', ', ') from jsonb_array_elements(s->'people') p), '; ') from jsonb_array_elements(b->'shifts') s)) from (select $B b) x")" \
  '^true\|true\|Два моря, Океан\|true\|3\|Утро 10-18: Мария К\.; День 12-20: Илья Б\.; Вечер 16-24: Анна С\.$'
chk "опаздывает Анна: в её смене и отдельной строкой (15 минут, будет в 16:15); у остальных — нет" \
  "$(Q "select (select string_agg(coalesce(p->'late'->>'min', '-'), ',') from jsonb_array_elements(b->'shifts') s, jsonb_array_elements(s->'people') p) || ' ' || (select string_agg((l->>'n') || ' ' || (l->>'min') || ' ' || (l->>'eta'), ',') from jsonb_array_elements(b->'late') l) from (select $B b) x")" \
  '^-,-,15 Анна С\. 15 16:15$'
chk "не хватает: сегодня официанта, через 2 дня бармена, через 3 — официанта; пятый и шестой дни пустые — не дыры" \
  "$(Q "select string_agg((((h->>'day')::date - $LD)) || ':' || (h->>'pos') || ':' || (h->>'miss'), ' ' order by h->>'day', h->>'pos') from (select $B b) x, jsonb_array_elements(b->'holes') h")" \
  '^0:waiter:1 2:bar:1 3:waiter:1$'
chk "карточки смен: Анна отдаёт завтрашнюю, ищем бармена через 4 дня (одного из двух уже нашли); закрытая, удалённая и дальше недели — нет" \
  "$(Q "select string_agg((c->>'mode') || ':' || coalesce(c->>'who', '') || ':' || (c->>'pos') || ':' || (c->>'n') || ':' || ((c->>'day')::date - $LD), ' ' order by c->>'day') from (select $B b) x, jsonb_array_elements(b->'open') c")" \
  '^give:Анна С\.:waiter:1:1 need::bar:1:4$'
chk "стоп-лист: два блюда по алфавиту; архивное и без названия — нет" \
  "$(Q "select (b->'stop'->>'n') || ' ' || (select string_agg(v #>> '{}', ', ') from jsonb_array_elements(b->'stop'->'names') v) from (select $B b) x")" \
  '^2 Тартар из тунца, Уха по-фински$'
chk "вчера «спасибо» трижды: Анна (2), Илья; цитата — самая длинная (до 160 знаков); скрытое, позавчерашнее и чужое — нет" \
  "$(Q "select concat_ws('|', b->'thanks'->>'n', (select string_agg((p->>'n') || ':' || (p->>'k'), ',') from jsonb_array_elements(b->'thanks'->'people') p), b->'thanks'->>'quote', b->'thanks'->>'by') from (select $B b) x")" \
  '^3\|Анна С\.:2,Илья Б\.:1\|Спасибо Анне за чудесный вечер и внимание к деталям!\|Анна С\.$'
chk "вчера: брифинг прочитали 3 из 4 бывших в смене (Роман не в смене — не в счёт); занимались 2 из 4" \
  "$(Q "select concat_ws('|', b->'ybrief'->>'reads', b->'ybrief'->>'of', b->'learn'->>'done', b->'learn'->>'of') from (select $B b) x")" '^3\|4\|2\|4$'
chk "давно не занимались: Дарья (ни разу, без Telegram) первой, Илья — 8 дней; руководители и Анна (вчера) — нет; мусор в журнале не мешает" \
  "$(Q "select (select string_agg((v->>'n') || ':' || coalesce(v->>'days', '-') || ':' || (v->>'tg'), ',') from jsonb_array_elements(b->'idle'->'list') v) || ' +' || (b->'idle'->>'more') from (select $B b) x")" \
  '^Дарья Н\.:-:false,Илья Б\.:8:true \+0$'
chk "брифинг на сегодня не собран; настройки: включено, 9:00, Telegram подключён, бот на месте" \
  "$(Q "select concat_ws('|', b->'brief'->>'done', b->'prefs'->>'on', b->'prefs'->>'hour', b->'prefs'->>'linked', b->'prefs'->>'bot') from (select $B b) x")" '^false\|true\|9\|true\|true$'
chk "кто может: Анна (официант) — forbidden; мусор и уволенный — auth; владелец без Telegram — сводка есть, «не подключён»" \
  "$(Q "select concat_ws('|', morning_brief('$ANNA')->>'error', morning_brief('мусор')->>'error', morning_brief('$OLEG')->>'error', morning_brief('$ROMAN')->>'ok', morning_brief('$ROMAN')->'prefs'->>'linked')")" \
  '^forbidden\|auth\|auth\|true\|false$'

# ── текст бота и кнопки ──
DL=$(PP "select _sa_chat_dlong($LD)"); DLC=$(PP "select upper(left(_sa_chat_dlong($LD), 1)) || substr(_sa_chat_dlong($LD), 2)")
D1=$(PP "select _sa_chat_dshort($LD + 1)"); D2=$(PP "select _sa_chat_dshort($LD + 2)"); D3=$(PP "select _sa_chat_dshort($LD + 3)"); D4=$(PP "select _sa_chat_dshort($LD + 4)")
chk "дата словами: «четверг, 29 октября»; коротко — «пт 30»" "$DL / $D1" '^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье), [0-9]{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря) / (пн|вт|ср|чт|пт|сб|вс) [0-9]{1,2}$'
WANT="<b>Доброе утро, Мария</b>
$DLC · Два моря, Океан

<b>Сегодня в смене 3</b>
Утро 10:00–18:00: Мария К.
День 12:00–20:00: Илья Б.
Вечер 16:00–24:00: Анна С.
Не хватает: официанта
Опаздывает: Анна С., будет в 16:15

<b>На неделе</b>
$D2: не хватает бармена
$D3: не хватает официанта
Отдают смену: Анна С. ($D1)
Ищем в смену: бармена на $D4

<b>Стоп-лист: 2</b>
Тартар из тунца, Уха по-фински

<b>Вчера</b>
Гости сказали спасибо 3 раза: Анна С. (2), Илья Б.
«Спасибо Анне за чудесный вечер и внимание к деталям!»
Брифинг прочитали 3 из 4
Занимались 2 из 4, кто был в смене

<b>Давно не занимались</b>
Дарья Н. (ещё ни разу), Илья Б. (8 дней)

Брифинг на сегодня ещё не собран"
TXT=$(PN "select _sa_morning_text($B, 'Мария Ким')")
chk "текст для Telegram: приветствие по имени, дата с большой буквы, разделы по порядку" "$(same "$TXT" "$WANT")" '^SAME$'
chk "кнопки: «Открыть утро»; ниже — «Собрать брифинг» и «График»; ведут в приложение (?go=…)" "$(PP "select _sa_morning_kb($B)")" \
  '^\[\[\{"text": "Открыть утро", "web_app": \{"url": "https://app.example/\?go=morning"\}\}\], \[\{"text": "Собрать брифинг", "web_app": \{"url": "https://app.example/\?go=briefing"\}\}, \{"text": "График", "web_app": \{"url": "https://app.example/\?go=schedule"\}\}\]\]$'
if command -v node >/dev/null 2>&1 && [ -f "$LIB/morning.js" ]; then
  PP "select $B" > "$D/brief.json"
  JS=$(node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const { morningText, morningKb } = await import('file://$LIB/morning.js');
    const b = JSON.parse(readFileSync('$D/brief.json', 'utf8'));
    process.stdout.write(morningText(b, 'Мария Ким') + '\n@@' + morningKb(b).map((r) => r.map((x) => x.text + '=' + x.go).join(', ')).join(' / '));" 2>&1)
  KB=$(PP "select string_agg((select string_agg((x->>'text') || '=' || substring(x->'web_app'->>'url' from '\?go=(.*)$'), ', ' order by o2) from jsonb_array_elements(r) with ordinality q2(x, o2)), ' / ' order by o) from jsonb_array_elements(_sa_morning_kb($B)) with ordinality q(r, o)")
  chk "приложение (lib/morning.js) пишет ту же сводку слово в слово и те же кнопки" "$(same "$JS" "$TXT
@@$KB")" '^SAME$'
else
  echo "· node нет — сверку с lib/morning.js пропускаю"
fi
PP "insert into sa_briefs (restaurant, day, data, text, updated_at) values ('Два моря, Океан', $LD, '{}', '', ($LD + time '08:40') at time zone '$TZ0')" >/dev/null
chk "брифинг собрали в 8:40 — «собран, 08:40»; в тексте строки «не собран» нет, кнопка «Собрать брифинг» пропала" \
  "$(Q "select (b->'brief'->>'done') || ' ' || (b->'brief'->>'at') from (select $B b) x") $(PP "select position('ещё не собран' in _sa_morning_text($B, 'Мария Ким')) || ' ' || (select string_agg(x->>'text', ',') from jsonb_array_elements(_sa_morning_kb($B)) r, jsonb_array_elements(r) x)")" \
  '^true 08:40 0 Открыть утро,График$'
PP "delete from sa_settings where key = 'app_url'" >/dev/null
chk "адреса приложения нет — кнопки ведут в бота: t.me/…?startapp=go_morning" "$(PP "select _sa_morning_kb($B)->0->0->>'url'")" '^https://t\.me/SA_RestaurantBot\?startapp=go_morning$'
PP "insert into sa_settings (key, value) values ('app_url', 'https://app.example')" >/dev/null
WANTP="<b>Доброе утро, Ирина</b>
$DLC · Порт

<b>Вчера</b>
Гость сказал спасибо: Иван П.
«Спасибо Ивану из другого заведения сети»

Брифинг на сегодня ещё не собран"
chk "«Порт» без графика: дата, своё вчерашнее «спасибо» (Иван) и брифинг; стоп-лист, «спасибо» и карточки «Океана» не видны" \
  "$(same "$(PN "select _sa_morning_text(morning_brief('$IRINA'), 'Ирина Портова')")" "$WANTP") $(Q "select concat_ws('|', b->>'sched', jsonb_array_length(b->'open'), b->'stop'->>'n', b->'thanks'->>'n', b->>'count') from (select morning_brief('$IRINA') b) x")" \
  '^SAME false\|0\|0\|1\|0$'

# ── настройки: присылать ли и во сколько ──
chk "morning_set: час вне 6–12 — hour; 7 — сохраняется; «выключить» — время остаётся" \
  "$(Q "select concat_ws('|', morning_set('$MARIA', null, 13)->>'error', morning_set('$MARIA', null, 5)->>'error', morning_set('$MARIA', null, 7)->'prefs'->>'hour', morning_set('$MARIA', false)->'prefs'->>'on', morning_brief('$MARIA')->'prefs'->>'hour')") $(PP "select morning || ' ' || morning_hour from sa_notify_prefs where emp_id = '$MEMP'")" \
  '^hour\|hour\|7\|false\|7 false 7$'
chk "Анне настройки «Утра» — forbidden; мусор — auth" "$(Q "select concat_ws('|', morning_set('$ANNA', true)->>'error', morning_set('мусор', true)->>'error')")" '^forbidden\|auth$'
run $S40
chk "повторный запуск этапа 40 — без ошибок, настройки Марии на месте" "$RC $(PP "select morning || ' ' || morning_hour from sa_notify_prefs where emp_id = '$MEMP'")" '^0 false 7$'
Q "select morning_set('$MARIA', true, 9)" >/dev/null

# ── «Прислать сейчас» ──
PP "delete from net.sent_log; delete from tg_sent" >/dev/null
PP "delete from vault.secrets_stub" >/dev/null
chk "бота нет — no_bot" "$(Q "select morning_send_now('$MARIA')->>'error'")" '^no_bot$'
PP "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST')" >/dev/null
chk "владелец без Telegram — not_linked; Анна — forbidden; мусор — auth" "$(Q "select concat_ws('|', morning_send_now('$ROMAN')->>'error', morning_send_now('$ANNA')->>'error', morning_send_now('мусор')->>'error')")" '^not_linked\|forbidden\|auth$'
chk "Мария: «Прислать сейчас» — ушло; второй раз в ту же минуту — too_fast" "$(Q "select morning_send_now('$MARIA')->>'ok'; select morning_send_now('$MARIA')->>'error'")" '^true too_fast$'
chk "в Telegram Марии (333): одно сообщение — та же сводка (HTML) с кнопками" \
  "$(sentn 333) $(PP "select concat_ws('|', body->>'parse_mode', (body->>'text' = _sa_morning_text($B, 'Мария Ким'))::text, body->'reply_markup'->'inline_keyboard'->0->0->>'text', jsonb_array_length(body->'reply_markup'->'inline_keyboard')) from net.sent_log where body->>'chat_id' = '333'")" \
  '^1 HTML\|true\|Открыть утро\|2$'
PP "update tg_links set remind = false where emp_id = '$MEMP'" >/dev/null
chk "напоминания в Telegram выключены — not_linked, и в сводке «не подключён»" "$(Q "select morning_send_now('$MARIA')->>'error', morning_brief('$MARIA')->'prefs'->>'linked'")" '^not_linked\|false$'
PP "update tg_links set remind = true where emp_id = '$MEMP'" >/dev/null

# ── «Напомнить» тому, кто давно не занимался ──
PP "delete from net.sent_log" >/dev/null
chk "Мария → Илья: ушло; бот пишет от её имени, с кнопкой «Разминка»" \
  "$(Q "select morning_nudge('$MARIA', '$IEMP')->>'ok'") $(PP "select concat_ws('|', body->>'text', body->'reply_markup'->'inline_keyboard'->0->0->>'text', body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url') from net.sent_log where body->>'chat_id' = '222'")" \
  '^true Мария К\. напоминает про разминку: 2 минуты, три ситуации из зала\.\|Разминка\|https://app\.example/\?go=warmup$'
chk "второй раз за день — already (и от Петра тоже: одно напоминание в день на человека)" "$(Q "select concat_ws('|', morning_nudge('$MARIA', '$IEMP')->>'error', morning_nudge('$PETR', '$IEMP')->>'error')") $(sentn 222)" '^already\|already 1$'
chk "Дарье — no_tg; Ивану из «Порта», себе, уволенному, мусору — not_found" \
  "$(Q "select concat_ws('|', morning_nudge('$MARIA', '$DEMP')->>'error', morning_nudge('$MARIA', '$VEMP')->>'error', morning_nudge('$MARIA', '$MEMP')->>'error', morning_nudge('$MARIA', '$OEMP')->>'error', morning_nudge('$MARIA', 'мусор')->>'error')")" \
  '^no_tg\|not_found\|not_found\|not_found\|not_found$'
chk "Анне «Напомнить» — forbidden; мусор — auth" "$(Q "select concat_ws('|', morning_nudge('$ANNA', '$IEMP')->>'error', morning_nudge('мусор', '$IEMP')->>'error')")" '^forbidden\|auth$'
chk "в сводке Илья — «напоминать можно» (Telegram есть), Дарья — нет" "$(Q "select string_agg((v->>'n') || ':' || (v->>'tg'), ',') from (select $B b) x, jsonb_array_elements(b->'idle'->'list') v")" '^Дарья Н\.:false,Илья Б\.:true$'

# ── по расписанию: кому пора ──
PP "delete from tg_sent; delete from net.sent_log; delete from sa_notify_prefs where emp_id <> '$MEMP'" >/dev/null
DUE() { PP "select coalesce(string_agg(x->>'name', ',' order by x->>'name'), '-') from jsonb_array_elements(_sa_morning_due(false, ($LD + time '$1') at time zone '$TZ0')) x"; }
chk "по умолчанию 9:00 и три часа после: 8:59 — никому, 9:00 и 11:59 — Марии и Петру, 12:00 — уже никому" "$(DUE 08:59) $(DUE 09:00) $(DUE 11:59) $(DUE 12:00)" '^- Мария,Пётр Мария,Пётр -$'
Q "select morning_set('$MARIA', true, 7)" >/dev/null
chk "у Марии 7:00: в 7:00 — ей, в 10:00 — её окно прошло, остаётся Пётр" "$(DUE 07:00) $(DUE 10:00)" '^Мария Пётр$'
Q "select morning_set('$MARIA', false, 9)" >/dev/null
chk "Мария выключила — в 9:30 только Пётр" "$(DUE 09:30)" '^Пётр$'
Q "select morning_set('$MARIA', true)" >/dev/null
PP "update tg_links set remind = false where emp_id = '$PEMP'" >/dev/null
chk "у Петра напоминания в Telegram выключены — в 9:30 только Мария" "$(DUE 09:30)" '^Мария$'
PP "update tg_links set remind = true where emp_id = '$PEMP'; insert into tg_sent (emp_id, day, kind) values ('$PEMP', $LD, 'morning')" >/dev/null
chk "Пётр сегодня уже получил — второй раз нет" "$(DUE 09:30)" '^Мария$'
PP "delete from tg_sent; insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values ('$REMP', 555, 'Два моря, Океан', 'Роман Владелец', true), ('00000000-0000-0000-0000-0000000000b1', 666, 'Порт', 'Ирина Портова', true)" >/dev/null
chk "владелец с Telegram и руководитель другого заведения — тоже; бармен Илья и официантка Анна — никогда" "$(DUE 09:30)" '^Ирина,Мария,Пётр,Роман$'
PP "insert into sa_settings (key, value) values ('tz:Порт', 'Europe/Moscow')" >/dev/null
chk "у «Порта» свой пояс (Москва): в 9:30 по Камчатке Ирине рано, в 18:30 по Камчатке (9:30 в Москве) — пора" "$(DUE 09:30) $(DUE 18:30)" '^Мария,Пётр,Роман Ирина$'
# сводка одного руководителя падает (ошибка в данных) — остальные свою получают, а он — со следующего запуска
PP "alter function _sa_morning_at(text, timestamptz) rename to _sa_morning_at0;
    create function _sa_morning_at(p_emp text, p_now timestamptz) returns jsonb language plpgsql security definer set search_path to public as \$f\$
    begin if p_emp = '$PEMP' then raise exception 'сломалось'; end if; return _sa_morning_at0(p_emp, p_now); end \$f\$" >/dev/null
chk "сводка Петра не собралась — Марии и Роману уходит, тик не падает; у Петра отметки «отправлено» нет (придёт со следующего)" \
  "$(PP "select coalesce(string_agg(x->>'name', ',' order by x->>'name'), '-') from jsonb_array_elements(_sa_morning_due(true, ($LD + time '09:30') at time zone '$TZ0')) x") $(PP "select count(*) from tg_sent where emp_id = '$PEMP'") $(sentn 444) $(sentn 333)" \
  "сводка для $PEMP не ушла: сломалось Мария,Роман 0 0 1$"
PP "drop function _sa_morning_at(text, timestamptz); alter function _sa_morning_at0(text, timestamptz) rename to _sa_morning_at; delete from tg_sent; delete from net.sent_log" >/dev/null
chk "в списке «кому пора» — тот же текст, что уйдёт в Telegram" "$(PP "select (x->>'text') = _sa_morning_text(_sa_morning_at('$MEMP', ($LD + time '09:30') at time zone '$TZ0'), 'Мария') from jsonb_array_elements(_sa_morning_due(false, ($LD + time '09:30') at time zone '$TZ0')) x where x->>'emp' = '$MEMP'")" '^t$'
PP "delete from vault.secrets_stub" >/dev/null
chk "бота нет — никому" "$(DUE 09:30)" '^-$'
PP "insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST')" >/dev/null
chk "просмотр без отправки ничего не отправил" "$(PP "select count(*) from net.sent_log") $(PP "select count(*) from tg_sent")" '^0 0$'

# ── отправка по расписанию (sa_morning_tick) ──
PP "delete from tg_links where emp_id in ('$REMP', '00000000-0000-0000-0000-0000000000b1'); insert into sa_notify_prefs (emp_id, morning) values ('$PEMP', false) on conflict (emp_id) do update set morning = false;
    update sa_notify_prefs set morning = true, morning_hour = extract(hour from now() at time zone '$TZ0')::int where emp_id = '$MEMP'" >/dev/null
chk "sa_morning_tick: пора — одна сводка Марии; повторный запуск — ничего" "$(PP "select sa_morning_tick()") $(PP "select sa_morning_tick()") $(sentn 333) $(PP "select count(*) from tg_sent where emp_id = '$MEMP' and kind = 'morning'")" '^1 0 1 1$'
chk "ушла сводка по сегодняшнему дню с кнопками" "$(PP "select (body->>'text' like '<b>Доброе утро, Мария</b>%') || ' ' || (body->'reply_markup'->'inline_keyboard'->0->0->>'text') from net.sent_log where body->>'chat_id' = '333'")" '^true Открыть утро$'

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
run $S40; run $S40
chk "с pg_cron: задание «sa-morning» раз в 10 минут, повторный запуск — одно задание; в итоге этапа — «каждые 10 минут»" \
  "$RC $(PP "select count(*) || ' ' || string_agg(schedule || ' ' || command, '') from cron.job where jobname = 'sa-morning'") $(echo "$OUT40" | grep -o 'расписание: [^·]*·')" \
  '^0 1 \*/10 \* \* \* \* select public\.sa_morning_tick\(\) расписание: каждые 10 минут \(sa-morning\) ·$'

# ── права ──
chk "anon: 4 функции этапа — можно; служебные (сводка, текст, кому пора, отправка) — нельзя" \
  "$(PP "select count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname in ('morning_brief', 'morning_set', 'morning_send_now', 'morning_nudge')) || ' ' || count(*) filter (where has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('morning_brief', 'morning_set', 'morning_send_now', 'morning_nudge')) || ' из ' || count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like '\_sa\_mo\_%' or p.proname like '\_sa\_morning%' or p.proname like 'sa\_morning%' or p.proname like 'morning\_%')")" \
  '^4 0 из 22$'
chk "anon: «кому пора» и отправка по расписанию закрыты" "$(Q "select sa_morning_preview()") $(Q "select sa_morning_tick()")" 'permission denied.*permission denied'

echo
echo "Итого: $pass ✓, $fail ✗"
[ "$fail" = 0 ]
