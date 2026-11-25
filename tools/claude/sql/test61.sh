#!/bin/bash
# Этап 61 (v198, Доп. 523): заведения и должности — свои списки у владельца, перевод сотрудника.
# Поверх базы run25.sh (этапы 11c и 21, сотрудники «Два моря, Океан» и «Порт»): копия satest61, прежний
# admin_create_employee — заглушкой (p_token uuid, как в Supabase). Без этапа 21 — понятная ошибка. Этап дважды: в
# списке «Два моря, Океан», «Марико», «Мясник», «Порт», «Камчадал» скрыты, должностей шесть; второй запуск списки не
# трогает. Списки: всем, кто вошёл, число людей — владельцу, свои должности — руководителям (менеджеру — своего
# заведения). Править — только владелец: добавить, вернуть скрытое тем же названием (регистр и пробелы не важны),
# переименовать (во всех таблицах с restaurant), занятое имя — нельзя, скрыть. Должности: добавить с «работает как»,
# такое же название, плохое «работает как», встроенной — нельзя, новая «работает как» меняет position у всех.
# Новый сотрудник со своей должностью — через прежнюю функцию (права её), job_title ставится; скрытая должность и
# незнакомое заведение — нет. Перевод: заведение и должность, профиль тоже; скрытое заведение — нет, владельцу —
# только заведение. Без входа — auth; таблицы и служебное закрыты; третий запуск — новое название из employees скрытым.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test61.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest61
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S61=supabase-stage61-places.sql
D=$(mktemp -d); cp "$SRC/$S61" "$HERE/base.sql" "$D/"; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; IRINA=10000000-0000-0000-0000-0000000000b1
ANNA_ID=00000000-0000-0000-0000-0000000000a4; ROMAN_ID=00000000-0000-0000-0000-0000000000a1
RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
# списки как строка: видимые заведения | скрытые | должности (своя — с «как …»)
LISTS() { Q "with l as (select org_lists('$1') j)
  select (select string_agg(v->>'name' || coalesce(':' || (v->>'staff'), ''), ', ' order by ord) from l, jsonb_array_elements(j->'venues') with ordinality a(v, ord) where not (v->>'hidden')::boolean)
    || ' | ' || coalesce((select string_agg(v->>'name', ', ' order by ord) from l, jsonb_array_elements(j->'venues') with ordinality a(v, ord) where (v->>'hidden')::boolean), '—')
    || ' | ' || (select string_agg(p->>'label' || case when (p->>'builtin')::boolean then '' else ' как ' || (p->>'base') end
                  || coalesce(':' || (p->>'staff'), '') || case when (p->>'hidden')::boolean then ' (скрыта)' else '' end, ', ' order by ord)
                 from l, jsonb_array_elements(j->'positions') with ordinality a(p, ord))
    || ' | правит: ' || (select j->>'can_edit' from l)"; }
VS() { Q "select (select string_agg(k, ',' order by k) from jsonb_object_keys(r) k where k not in ('venues', 'positions', 'titles', 'me', 'can_edit')) || ' ' || coalesce(r->>'done', r->>'error', '') || ' ' || coalesce(r->>'name', '') from (select org_venue_save('$1', $2) r) x"; }
PS() { Q "select coalesce(r->>'done', r->>'error', '') || ' ' || coalesce(r->>'rows', '') from (select org_position_save('$1', $2) r) x"; }
EMP() { PP "select restaurant || ' / ' || position || ' / ' || coalesce(job_title, '∅') from employees where $1"; }
BARISTA() { PP "select id from sa_positions where label = 'Бариста'"; }

# ── Без этапа 21 — понятная ошибка ─────────────────────────────────────────────────────────────────────────────────
$P0 -d postgres -c "drop database if exists ${DB}x" -c "create database ${DB}x" >/dev/null 2>&1
$P0 -d ${DB}x -f "$D/base.sql" >/dev/null 2>&1
chk "без этапа 21: «Сначала этап 21»" "$($P0 -d ${DB}x -f "$D/$S61" 2>&1 | grep -o 'Сначала этап 21[^:]*' | head -1)" '^Сначала этап 21 \(supabase-stage21-private-data.sql\)$'
$P0 -d postgres -c "drop database if exists ${DB}x" >/dev/null 2>&1

# прежний admin_create_employee — как в Supabase: токен uuid, владелец и руководители, код в ответе
PP "create or replace function admin_create_employee(p_token uuid, p_name text, p_surname text, p_restaurant text, p_position text)
returns json language plpgsql security definer set search_path to public as \$\$
declare c jsonb := _sa_caller(p_token::text); v_id uuid;
begin
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  if not (coalesce((c->>'admin')::boolean, false) or c->>'position' in ('manager', 'senior')) then return json_build_object('ok', false, 'error', 'forbidden'); end if;
  insert into employees (name, surname, restaurant, position) values (btrim(p_name), btrim(p_surname), p_restaurant, p_position) returning id into v_id;
  return json_build_object('ok', true, 'code', 'ТЕСТ-' || upper(substr(v_id::text, 1, 4)));
end \$\$;" >/dev/null

# ── Этап 61 дважды ─────────────────────────────────────────────────────────────────────────────────────────────────
run $S61
chk "этап 61: итог — функций 5 из 5, в списке одно заведение, скрыто 4, должностей 6" "$(echo "$OUT" | grep -o 'заведения и должности: .*' | head -1)" \
  '^заведения и должности: функций 5 из 5 · заведений в списке 1 \(скрыто 4\) · должностей 6 \(своих 0\)$'
run $S61
chk "этап 61 ещё раз — без ошибок, то же" "$RC $(echo "$OUT" | grep -o 'заведения и должности: .*' | head -1)" \
  '^0 заведения и должности: функций 5 из 5 · заведений в списке 1 \(скрыто 4\) · должностей 6 \(своих 0\)$'
chk "у сотрудников появилась колонка job_title (пусто)" "$(PP "select count(*) || ' ' || count(job_title) from employees")" '^8 0$'

# ── Списки ─────────────────────────────────────────────────────────────────────────────────────────────────────────
chk "официант: видно «Два моря, Океан», скрыты четыре, должности шесть, без чисел, править — нет" "$(LISTS $ANNA)" \
  '^Два моря, Океан \| Марико, Мясник, Порт, Камчадал \| Официант, Хостес, Бармен, Старший бармен, Менеджер, Руководящий состав \| правит: false$'
chk "владелец: сколько людей (уволенный не в счёт) — в заведениях и должностях, править — да" "$(LISTS $ROMAN)" \
  '^Два моря, Океан:5 \| Марико, Мясник, Порт, Камчадал \| Официант:2, Хостес:0, Бармен:1, Старший бармен:0, Менеджер:2, Руководящий состав:1 \| правит: true$'
chk "свои должности руководителю — пусто; me — своё заведение и должность" "$(Q "select (r->'titles')::text || ' ' || (r->'me'->>'restaurant') || ' ' || (r->'me'->>'position') || ' ' || coalesce(r->'me'->>'title', '∅') from (select org_lists('$PETR') r) x")" \
  '^\{\} Два моря, Океан manager ∅$'

# ── Заведения: только владелец ─────────────────────────────────────────────────────────────────────────────────────
chk "менеджер добавить заведение не может" "$(VS $PETR "null, 'Алёнка'")" '^error,ok forbidden$'
chk "руководящий состав тоже (только владелец)" "$(VS $MARIA "null, 'Алёнка'")" '^error,ok forbidden$'
chk "владелец: «Алёнка» — добавлено, ответ со списками" "$(VS $ROMAN "null, '  Алёнка  '")" '^done,name,ok added Алёнка$'
chk "«Алёнка» в списке после «Два моря, Океан»" "$(LISTS $ANNA)" '^Два моря, Океан, Алёнка \| Марико, Мясник, Порт, Камчадал \|'
chk "то же название ещё раз — «уже есть», второго нет" "$(VS $ROMAN "null, 'алёнка'") $(PP "select count(*) from sa_venues where lower(name) = 'алёнка'")" ' exists Алёнка 1$'
chk "« порт » — возвращает скрытый «Порт» со всеми данными" "$(VS $ROMAN "null, ' порт '") $(EMP "id = '00000000-0000-0000-0000-0000000000b2'")" ' returned Порт Порт / waiter / ∅$'
chk "пустое название — bad_request" "$(VS $ROMAN "null, '   '")" '^error,ok bad_request$'
chk "длиннее 60 знаков — too_long" "$(VS $ROMAN "null, repeat('я', 61)")" '^error,ok too_long$'
chk "нет такого — not_found" "$(VS $ROMAN "'Нет такого', 'Новое'")" '^error,ok not_found$'

# переименовать: везде, где есть колонка restaurant
chk "до переименования: «Порт» в сотрудниках, тестах, ответах" "$(PP "select (select count(*) from employees where restaurant = 'Порт') || ' ' || (select count(*) from scores where restaurant = 'Порт') || ' ' || (select count(*) from quiz_events where restaurant = 'Порт')")" '^2 1 1$'
chk "«Порт» → «Порт Камчатка»: renamed, строк ≥ 4" "$(VS $ROMAN "'Порт', 'Порт Камчатка'")" ' renamed Порт Камчатка$'
chk "после: старого названия нигде нет, новое — там же" "$(PP "select (select count(*) from employees where restaurant = 'Порт') || ' ' || (select count(*) from employees where restaurant = 'Порт Камчатка') || ' ' || (select count(*) from scores where restaurant = 'Порт Камчатка') || ' ' || (select count(*) from quiz_events where restaurant = 'Порт Камчатка') || ' ' || (select count(*) from sa_venues where name = 'Порт')")" '^0 2 1 1 0$'
chk "переименовать в занятое — exists" "$(VS $ROMAN "'Порт Камчатка', 'АЛЁНКА'")" ' exists Алёнка$'
chk "скрыть «Порт Камчатка» — hidden, люди на месте" "$(VS $ROMAN "'Порт Камчатка', null, true") $(PP "select count(*) from employees where restaurant = 'Порт Камчатка'")" ' hidden Порт Камчатка 2$'
chk "список: «Два моря, Океан», «Алёнка»; скрыты — четыре" "$(LISTS $ANNA)" '^Два моря, Океан, Алёнка \| Марико, Мясник, Порт Камчатка, Камчадал \|'

# ── Должности ──────────────────────────────────────────────────────────────────────────────────────────────────────
chk "менеджер должность добавить не может" "$(PS $PETR "null, 'Бариста', 'bartender'")" '^forbidden'
chk "владелец: «Бариста» как бармен — added" "$(PS $ROMAN "null, 'Бариста', 'bartender'")" '^added'
BAR=$(BARISTA)
chk "id своей должности — p и 8 знаков" "$BAR" '^p[0-9a-f]{8}$'
chk "та же «бариста» — exists; «работает как» chef — bad_base; без названия — bad_request" \
  "$(PS $ROMAN "null, 'бариста', 'waiter'") $(PS $ROMAN "null, 'Сомелье', 'chef'") $(PS $ROMAN "null, ' ', 'waiter'")" '^exists bad_base bad_request$'
chk "встроенной «работает как» менять нельзя — builtin" "$(PS $ROMAN "'waiter', null, 'manager'")" '^builtin'
chk "встроенную переименовать можно: «Руководящий состав» → «Руководство»" "$(PS $ROMAN "'senior', 'Руководство'")" '^renamed'

# ── Новый сотрудник со своей должностью ────────────────────────────────────────────────────────────────────────────
chk "менеджер: Кира — «Бариста» в «Два моря, Океан», код, job_title" \
  "$(Q "select (r->>'ok') || ' ' || (r->>'code' ~ '^ТЕСТ-') || ' ' || (r->>'job_title') from (select admin_create_employee_t('$PETR', 'Кира', 'Новикова', 'Два моря, Океан', '$BAR') r) x") $(EMP "name = 'Кира'")" \
  "^true true $BAR Два моря, Океан / bartender / $BAR\$"
chk "встроенная должность — job_title пусто" "$(Q "select (r->>'ok') || ' ' || coalesce(r->>'job_title', '∅') from (select admin_create_employee_t('$ROMAN', 'Лев', 'Ким', 'Алёнка', 'hostess') r) x") $(EMP "name = 'Лев'")" \
  '^true ∅ Алёнка / hostess / ∅$'
chk "официант заводить не может (права — прежней функции)" "$(Q "select r->>'error' from (select admin_create_employee_t('$ANNA', 'Петя', '', 'Алёнка', 'waiter') r) x")" '^forbidden$'
chk "незнакомое заведение — no_venue, нет должности — no_position" \
  "$(Q "select r->>'error' from (select admin_create_employee_t('$ROMAN', 'Ия', '', 'Кафе', 'waiter') r) x") $(Q "select r->>'error' from (select admin_create_employee_t('$ROMAN', 'Ия', '', 'Алёнка', 'chef') r) x")" '^no_venue no_position$'
chk "свои должности: менеджеру — Кира (своё заведение), официанту — нет" \
  "$(Q "select (select count(*) from jsonb_object_keys(org_lists('$PETR')->'titles')) || ' ' || (org_lists('$ANNA')->'titles')::text")" '^1 \{\}$'
chk "владелец видит: «Бариста как bartender:1», «Руководство»" "$(LISTS $ROMAN)" 'Руководство:1, Бариста как bartender:1 \| правит: true$'

# новая «работает как» — у всех, у кого эта должность
chk "«Бариста» → как официант: based, у одного человека" "$(PS $ROMAN "'$BAR', null, 'waiter'")" '^based 1$'
chk "Кира теперь waiter, job_title тот же" "$(EMP "name = 'Кира'")" "^Два моря, Океан / waiter / $BAR\$"

# ── Перевод сотрудника ─────────────────────────────────────────────────────────────────────────────────────────────
chk "менеджер переводить не может" "$(Q "select r->>'error' from (select admin_employee_place('$PETR', '$ANNA_ID', 'Алёнка', 'waiter') r) x")" '^forbidden$'
chk "владелец: Анна → «Алёнка», «Бариста»" "$(Q "select r->>'ok' from (select admin_employee_place('$ROMAN', '$ANNA_ID', 'Алёнка', '$BAR') r) x") $(EMP "id = '$ANNA_ID'")" \
  "^true Алёнка / waiter / $BAR\$"
chk "профиль Анны тоже в «Алёнке»" "$(PP "select restaurant || ' / ' || position from profiles where user_id = '$ANNA_ID'")" '^Алёнка / waiter$'
chk "Анна видит свою должность в me" "$(Q "select (r->'me'->>'restaurant') || ' / ' || (r->'me'->>'title') from (select org_lists('$ANNA') r) x")" "^Алёнка / $BAR\$"
chk "обратно в «Два моря, Океан» официантом — job_title снят" "$(Q "select r->>'ok' from (select admin_employee_place('$ROMAN', '$ANNA_ID', 'Два моря, Океан', 'waiter') r) x") $(EMP "id = '$ANNA_ID'")" \
  '^true Два моря, Океан / waiter / ∅$'
chk "в скрытое заведение — no_venue; в незнакомую должность — no_position" \
  "$(Q "select r->>'error' from (select admin_employee_place('$ROMAN', '$ANNA_ID', 'Порт Камчатка', 'waiter') r) x") $(Q "select r->>'error' from (select admin_employee_place('$ROMAN', '$ANNA_ID', 'Алёнка', 'chef') r) x")" '^no_venue no_position$'
chk "владельца — только заведение: должность и права на месте" "$(Q "select r->>'ok' from (select admin_employee_place('$ROMAN', '$ROMAN_ID', 'Алёнка', 'waiter') r) x") $(EMP "id = '$ROMAN_ID'") $(PP "select is_admin from employees where id = '$ROMAN_ID'")" \
  '^true Алёнка / owner / ∅ t$'

# скрыть должность: в выборе её нет, вернуть — тем же названием
chk "скрыть «Бариста» — hidden; завести с ней — no_position" "$(PS $ROMAN "'$BAR', null, null, true") $(Q "select r->>'error' from (select admin_create_employee_t('$ROMAN', 'Ия', '', 'Алёнка', '$BAR') r) x")" '^hidden 0 no_position$'
chk "добавить «Бариста» ещё раз — returned, тот же id" "$(PS $ROMAN "null, 'Бариста', 'bartender'") $(BARISTA)" "^returned $BAR\$"

# ── Вход, права ────────────────────────────────────────────────────────────────────────────────────────────────────
chk "без входа — auth везде" "$(Q "select concat_ws(' ', org_lists('x')->>'error', org_venue_save('x', null, 'А')->>'error', org_position_save('x', null, 'А', 'waiter')->>'error', admin_employee_place('x', '$ANNA_ID', 'Алёнка', 'waiter')->>'error', admin_create_employee_t('x', 'А', '', 'Алёнка', 'waiter')->>'error')")" '^auth auth auth auth auth$'
chk "таблицы закрыты для anon" "$(Q "select count(*) from sa_venues") / $(Q "select count(*) from sa_positions")" 'permission denied.*/.*permission denied'
chk "служебное _sa_org_lists anon вызвать не может" "$(Q "select _sa_org_lists('{}'::jsonb)")" 'permission denied'

# ── Третий запуск: списки владельца не тронуты, новое название из employees — скрытым ──────────────────────────────
PP "insert into employees (name, surname, restaurant, position) values ('Гость', 'Старый', 'Кафе у моря', 'waiter')" >/dev/null
run $S61
chk "третий запуск: в списке 2 (скрыто 5), должностей 7 (своих 1)" "$RC $(echo "$OUT" | grep -o 'заведения и должности: .*' | head -1)" \
  '^0 заведения и должности: функций 5 из 5 · заведений в списке 2 \(скрыто 5\) · должностей 7 \(своих 1\)$'
chk "«Кафе у моря» — скрытым, «Руководство» и «Алёнка» на месте" "$(LISTS $ANNA)" '^Два моря, Океан, Алёнка \| .*Кафе у моря.* \| .*Руководство.*Бариста как waiter'

echo
echo "проверок: $((pass + fail)), ✓ $pass, ✗ $fail"
[ $fail -eq 0 ]
