#!/bin/bash
# Этап 58 (v192, Доп. 517): «О нас» — лист ознакомления, «Что изменилось», история блоков и «Вернуть», файл для Telegram,
# шаг новичка «Знакомство с компанией».
# Поверх базы run25.sh: копия satest58; без этапа 49 и без этапа 57 — понятные ошибки; этапы 49, 57, 58 дважды; история
# (правка — версия, порядок — нет, 20 версий на блок, удаление — с тем, кто удалил), concept_history и concept_revert
# (права, версия, удалённый блок с тем же номером, фото на месте), «Ознакомлен(а)» (дата — первая отметка редакции),
# changes в concept_get (что видел сотрудник, новые, убранные; после отметки — пусто), лист ознакомления (у каждого дата,
# прошлая отметка, сам руководитель), concept_ticket (кто какой файл, размер), concept_notify просит «Ознакомлен(а)»,
# newbie_check принимает d1e (заглушка этапа 41), функции с проверкой входа — VOLATILE.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test58.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest58
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S49=supabase-stage49-concept.sql; S57=supabase-stage57-concept-title.sql; S58=supabase-stage58-concept-acks.sql
D=$(mktemp -d); cp "$SRC/$S49" "$SRC/$S57" "$SRC/$S58" "$D/"; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; IRINA=10000000-0000-0000-0000-0000000000b1
AEMP=00000000-0000-0000-0000-0000000000a4; PEMP=00000000-0000-0000-0000-0000000000a3
OK="Два моря, Океан"
SAVE() { Q "select concept_save('$1', '$2'::jsonb)"; }
B64=$(python3 -c "import base64; print(base64.b64encode(bytes(range(256))*2).decode())")

# ── без нужных этапов — понятные ошибки, ничего не создано
NO49=$($P0 -d $DB -f "$D/$S58" 2>&1)
chk "без этапа 49 — «Сначала этап 49», таблицы истории нет" "$(echo "$NO49" | grep -o 'Сначала этап 49' | head -1) $(PP "select coalesce(to_regclass('public.sa_concept_hist')::text, 'нет')")" '^Сначала этап 49 нет$'
$P0 -d $DB -f "$D/$S49" >/dev/null 2>&1
NO57=$($P0 -d $DB -f "$D/$S58" 2>&1)
chk "без этапа 57 — «Сначала этап 57»" "$(echo "$NO57" | grep -o 'Сначала этап 57' | head -1) $(PP "select coalesce(to_regclass('public.sa_concept_hist')::text, 'нет')")" '^Сначала этап 57 нет$'

# заглушка этапа 41 (новички): таблица и проверка «новичок ещё новичок»
PP "create table sa_newbies (emp_id text primary key, checked jsonb not null default '{}'::jsonb, updated_at timestamptz default now());
    create or replace function _sa_nb_active(nb sa_newbies) returns boolean language sql stable as \$\$ select true \$\$;
    insert into sa_newbies (emp_id) values ('$AEMP');" >/dev/null

RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
run $S57; run $S58; run $S58
chk "этапы 57 и 58 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 7 функций, история пишется, пусто, шаг новичка и файл — да" "$(echo "$OUT" | grep -o 'лист ознакомления: .*' | head -1)" \
  '^лист ознакомления: 7 функций из 7 · история пишется: да · версий в истории: 0, удалённых блоков: 0 · шаг новичка: да · файл в Telegram: да$'
chk "функции с проверкой входа — VOLATILE" \
  "$(PP "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname in ('concept_get', 'concept_read', 'concept_reads', 'concept_history', 'concept_revert', 'concept_delete', 'concept_photo_put', 'concept_ticket', 'concept_notify')")" \
  '^concept_delete:v,concept_get:v,concept_history:v,concept_notify:v,concept_photo_put:v,concept_read:v,concept_reads:v,concept_revert:v,concept_ticket:v$'
chk "без входа — auth" "$(Q "select concept_history('нет', '')->>'error'") $(Q "select concept_revert('нет', 1)->>'error'") $(Q "select concept_ticket('нет', 'concept_pdf', '{}')->>'error'")" '^auth auth auth$'
chk "напрямую историю не прочитать (anon)" "$(Q "select count(*) from sa_concept_hist")" 'permission denied'

# ── история: правка — версия, порядок — нет
B1=$(PP "select concept_save('$PETR', jsonb_build_object('scope','$OK','kind','dress','title','Дресс-код','body','Чёрный верх.'))->'block'->>'id'")
B2=$(PP "select concept_save('$PETR', jsonb_build_object('scope','$OK','kind','idea','title','Концепция','body','Рыба и море.'))->'block'->>'id'")
chk "два блока заведения сохранены" "$B1 $B2" '^[0-9]+ [0-9]+$'
PP "update sa_concept_blocks set updated_at = now() - interval '3 days', created_at = now() - interval '3 days'" >/dev/null
SAVE $PETR "{\"id\":$B1,\"scope\":\"$OK\",\"kind\":\"dress\",\"title\":\"Дресс-код\",\"body\":\"Чёрный верх, белый фартук.\"}" >/dev/null
chk "правка текста — одна версия в истории, в ней прежний текст, автор и кто сменил" \
  "$(PP "select count(*) || '|' || max(body) || '|' || max(made_name) || '|' || max(gone_name) || '|' || max(op) from sa_concept_hist where block_id = $B1")" \
  '^1\|Чёрный верх\.\|Пётр Иванов\|Пётр Иванов\|edit$'
Q "select concept_order('$PETR', '$OK', array[$B2, $B1]::bigint[])" >/dev/null
chk "порядок блоков — не версия" "$(PP "select count(*) from sa_concept_hist where block_id = $B1")" '^1$'
SAVE $MARIA "{\"id\":$B1,\"scope\":\"$OK\",\"kind\":\"dress\",\"title\":\"Дресс-код\",\"body\":\"Чёрный верх, белый фартук.\",\"questions\":[{\"q\":\"Фартук?\",\"options\":[\"Белый\",\"Красный\"],\"correct\":0}]}" >/dev/null
chk "вопросы теста — тоже версия (её можно вернуть)" "$(PP "select count(*) || '|' || string_agg(gone_name, ',' order by id) from sa_concept_hist where block_id = $B1")" '^2\|Пётр Иванов,Мария Ким$'
for i in $(seq 1 22); do SAVE $PETR "{\"id\":$B2,\"scope\":\"$OK\",\"kind\":\"idea\",\"title\":\"Концепция\",\"body\":\"Рыба и море, версия $i.\"}" >/dev/null; done
chk "у блока — 20 последних версий" "$(PP "select count(*) || '|' || min(body) from sa_concept_hist where block_id = $B2")" '^20\|Рыба и море, версия 10\.$'

# ── concept_history: права и версии
chk "версии блока: официант и чужой менеджер — forbidden" "$(Q "select concept_history('$ANNA', '', $B1)->>'error'") $(Q "select concept_history('$IRINA', '', $B1)->>'error'")" '^forbidden forbidden$'
chk "версии блока: новые первыми, у версии — кто сохранил и кто сменил" \
  "$(Q "select jsonb_array_length(r->'versions') || '|' || (r->'versions'->0->>'body') || '|' || (r->'versions'->0->>'gone_name') || '|' || (r->'versions'->1->>'body') || '|' || (r->>'scope') from (select concept_history('$PETR', '', $B1) r) x")" \
  '^2\|Чёрный верх, белый фартук\.\|Мария Ким\|Чёрный верх\.\|Два моря, Океан$'
chk "нет блока — not_found" "$(Q "select concept_history('$PETR', '', 999999)->>'error'")" '^not_found$'

# ── «Вернуть» версию
H1=$(PP "select id from sa_concept_hist where block_id = $B1 and body = 'Чёрный верх.'")
chk "чужой менеджер версию не вернёт" "$(Q "select concept_revert('$IRINA', $H1)->>'error'")" '^forbidden$'
chk "вернуть первую версию: текст прежний, вопросов нет, автор — кто вернул, нынешняя ушла в историю" \
  "$(Q "select (r->'block'->>'body') || '|' || jsonb_array_length(r->'block'->'questions') || '|' || (r->'block'->>'by') from (select concept_revert('$MARIA', $H1) r) x")|$(PP "select count(*) from sa_concept_hist where block_id = $B1")" \
  '^Чёрный верх\.\|0\|Мария Ким\|3$'

# ── фото и удаление: история держит фото, блок возвращается с тем же номером
PH=$(PP "select concept_photo_put('$PETR', '$OK', '$B64', '$B64', 800, 600)->>'id'")
SAVE $PETR "{\"scope\":\"$OK\",\"kind\":\"mood\",\"title\":\"Атмосфера\",\"body\":\"Тёплый свет.\",\"photos\":[{\"id\":$PH,\"cap\":\"Зал\"}]}" >/dev/null
B3=$(PP "select id from sa_concept_blocks where kind = 'mood'")
chk "официант не удалит" "$(Q "select concept_delete('$ANNA', $B3)->>'error'")" '^forbidden$'
chk "удалил менеджер: блока нет, в истории — с тем, кто удалил; фото на месте" \
  "$(Q "select concept_delete('$PETR', $B3)->>'ok'")|$(PP "select count(*) from sa_concept_blocks where id = $B3")|$(PP "select op || ':' || gone_name from sa_concept_hist where block_id = $B3")|$(PP "select count(*) from sa_concept_photos where id = $PH")" \
  '^true\|0\|delete:Пётр Иванов\|1$'
chk "удалённые блоки части: «Атмосфера» с фото" \
  "$(Q "select jsonb_array_length(r->'gone') || '|' || (r->'gone'->0->>'title') || '|' || (r->'gone'->0->'photos'->0->>'cap') from (select concept_history('$PETR', '$OK') r) x")" '^1\|Атмосфера\|Зал$'
chk "удалённые сети — только кто правит сеть" "$(Q "select concept_history('$PETR', '')->>'error'") $(Q "select concept_history('$MARIA', '')->>'ok'")" '^forbidden true$'
# старые незакреплённые фото уходят, а фото из истории — нет
PP "update sa_concept_photos set created_at = now() - interval '5 days'" >/dev/null
Q "select concept_photo_put('$PETR', '$OK', '$B64', '$B64')" >/dev/null
chk "уборка фото: фото удалённого блока осталось (оно в истории)" "$(PP "select count(*) from sa_concept_photos where id = $PH")" '^1$'
HD=$(PP "select id from sa_concept_hist where block_id = $B3 and op = 'delete'")
chk "вернуть удалённый блок: тот же номер, фото и подпись на месте, запись об удалении ушла" \
  "$(Q "select (r->'block'->>'id') || '|' || (r->'block'->'photos'->0->>'cap') from (select concept_revert('$PETR', $HD) r) x")|$(PP "select count(*) from sa_concept_hist where block_id = $B3 and op = 'delete'")" \
  "^$B3\|Зал\|0$"
chk "фото, которого уже нет, при возврате пропускается" \
  "$(PP "update sa_concept_hist set photos = '[{\"id\": 987654, \"cap\": \"нет\"}]'::jsonb where id = $H1; select jsonb_array_length(concept_revert('$PETR', $H1)->'block'->'photos')")" '^0$'

# ── «Ознакомлен(а)»: дата — первая отметка этой редакции
R1=$(Q "select concept_read('$ANNA', '$OK')->>'at'")
sleep 1
R2=$(Q "select concept_read('$ANNA', '$OK')->>'at'")
chk "повторная отметка той же редакции дату не двигает" "$([ -n "$R1" ] && [ "$R1" = "$R2" ] && echo same || echo "$R1 / $R2")" '^same$'
Q "select concept_read('$ANNA', '')" >/dev/null
chk "concept_get: read_at сети и заведения, даты редакций" \
  "$(Q "select (g->'read_at'->>'venue' is not null) || '|' || (g->'read_at'->>'net' is null) || '|' || (g->'venue'->>'at' is not null) || '|' || (g->'changes')::text from (select concept_get('$ANNA') g) x")" \
  '^true\|true\|true\|\{"net": null, "venue": null\}$'
# Анна отметила давно; потом правка, новый блок, удаление
PP "update sa_concept_reads set read_at = now() - interval '1 day' where emp_id = '$AEMP'" >/dev/null
SAVE $PETR "{\"id\":$B1,\"scope\":\"$OK\",\"kind\":\"dress\",\"title\":\"Дресс-код зала\",\"body\":\"Чёрный верх. Волосы собраны.\"}" >/dev/null
SAVE $PETR "{\"scope\":\"$OK\",\"kind\":\"pitch\",\"title\":\"Рассказ гостю\",\"body\":\"«Мы ресторан у моря».\"}" >/dev/null
B4=$(PP "select id from sa_concept_blocks where kind = 'pitch'")
Q "select concept_delete('$PETR', $B2)" >/dev/null
CH=$(Q "select concept_get('$ANNA')->'changes'->'venue'")
chk "changes: правленный блок — текст, который Анна видела" "$(Q "select concept_get('$ANNA')->'changes'->'venue'->'was'->0->>'body'") $(Q "select concept_get('$ANNA')->'changes'->'venue'->'was'->0->>'title'")" '^Чёрный верх\. Дресс-код$'
chk "changes: новый блок — в fresh, удалённый — в gone; сети — пусто" \
  "$(Q "select (concept_get('$ANNA')->'changes'->'venue'->'fresh') @> '[$B4]'::jsonb")|$(echo "$CH" | grep -o '"title": "Концепция"' | head -1)|[$(Q "select concept_get('$ANNA')->'changes'->>'net'")]" \
  '^t\|"title": "Концепция"\|\[\]$'
chk "блок, появившийся и после отметки удалённый, Анне не показывается" "$(echo "$CH" | grep -c 'Атмосфера')" '^0$'
Q "select concept_read('$ANNA', '$OK')" >/dev/null
chk "отметила снова — changes пусто" "[$(Q "select concept_get('$ANNA')->'changes'->>'venue'")]" '^\[\]$'
chk "concept_notify просит «Ознакомлен(а)»" "$(PP "select pg_get_functiondef('public.concept_notify(text,text)'::regprocedure) like '%отметь «Ознакомлен(а)»%'")" '^t$'

# ── лист ознакомления
chk "официант лист не видит" "$(Q "select concept_reads('$ANNA')->>'error'")" '^forbidden$'
RD=$(Q "select concept_reads('$PETR')")
chk "лист: Анна с датой, Пётр в списке как «я», даты редакций" \
  "$(Q "select (select x->>'at' is not null from jsonb_array_elements(r->'rows') x where x->>'name' = 'Анна Смирнова') || '|' || (select (x->>'me') from jsonb_array_elements(r->'rows') x where x->>'name' = 'Пётр Иванов') || '|' || (r->>'venue_at' is not null) || '|' || (r->>'net_at' is null) from (select concept_reads('$PETR') r) x")" \
  '^true\|true\|true\|true$'
PP "update sa_concept_reads set read_at = now() - interval '2 days' where emp_id = '$AEMP'" >/dev/null
SAVE $PETR "{\"id\":$B4,\"scope\":\"$OK\",\"kind\":\"pitch\",\"title\":\"Рассказ гостю\",\"body\":\"«Мы ресторан у моря, рыба с утра».\"}" >/dev/null
chk "редакция сменилась: у Анны даты нет, прошлая отметка — в was; неотметившие первыми" \
  "$(Q "select (select (x->>'at') is null and (x->>'was') is not null from jsonb_array_elements(r->'rows') x where x->>'name' = 'Анна Смирнова') || '|' || (r->'rows'->0->>'at' is null) from (select concept_reads('$PETR') r) x")" '^true\|true$'
chk "администратор в листе не значится" "$(echo "$RD" | grep -c 'Роман')" '^0$'

# ── файл для Telegram
chk "концепция в PDF — любой сотрудник; лист — только руководитель; чужой вид — kind" \
  "$(Q "select concept_ticket('$ANNA', 'concept_pdf', '{\"t\":1}')->>'ok'") $(Q "select concept_ticket('$ANNA', 'concept_acks_pdf', '{\"t\":1}')->>'error'") $(Q "select concept_ticket('$PETR', 'concept_acks_pdf', '{\"t\":1}')->>'ok'") $(Q "select concept_ticket('$PETR', 'team_pdf', '{}')->>'error'")" \
  '^true forbidden true kind$'
chk "билет — 64 знака, файл забирают один раз (report_take)" \
  "$(Q "select length(concept_ticket('$ANNA', 'concept_pdf', '{\"t\":2}')->>'ticket')") $(PP "select (report_take(ticket)->>'kind') || ',' || coalesce(report_take(ticket)->>'error', '-') from report_tickets where payload->>'t' = '2'")" \
  '^64 concept_pdf,ticket$'
chk "слишком большой файл — too_big" "$(Q "select concept_ticket('$ANNA', 'concept_pdf', jsonb_build_object('x', repeat('a', 3600000)))->>'error'")" '^too_big$'

# ── новичок: шаг d1e
chk "newbie_check принимает d1e «Знакомство с компанией», чужие шаги — нет" \
  "$(Q "select (r->'checked' ? 'd1e') || ' ' || (r->'checked' ? 'zz') from (select newbie_check('$ANNA', array['d1e', 'zz'], true) r) x")" '^true false$'

echo "── итог: $pass ✓, $fail ✗"
[ "$fail" -eq 0 ]
