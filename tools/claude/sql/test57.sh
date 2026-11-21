#!/bin/bash
# Этап 57 (v191, Доп. 516): раздел «О нас» в треках — своё название, «для ознакомления» или «в зачёт», зачёт по роли.
# Поверх базы run25.sh: копия satest57; без этапа 49 — понятная ошибка; этап 49, потом 57 дважды; права (сеть — владелец
# и руководящий состав, заведение — его руководители), длины (40 и 60 знаков, пробелы схлопнуты), режим (info, credit,
# пусто; чужое — bad_mode; null — не трогать), всё пусто — как было, concept_get отдаёт meta (сеть и своё заведение;
# руководящему составу — выбранное заведение), остальной ответ — как в этапе 49; перенос пройденного: старые номера
# уроков раздела (cms-l-cn-idea) — в роль, в которой прошли (progress, scores, quiz_events, quiz_done), новые не трогаются,
# повтор ничего не меняет; функции с проверкой входа — VOLATILE.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test57.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest57
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S49=supabase-stage49-concept.sql; S57=supabase-stage57-concept-title.sql
D=$(mktemp -d); cp "$SRC/$S49" "$SRC/$S57" "$D/"; chmod -R a+r "$D"
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; IRINA=10000000-0000-0000-0000-0000000000b1
OK="Два моря, Океан"
SET() { Q "select concept_meta_set('$1', '$2', '$3', '$4')"; }
UA=00000000-0000-0000-0000-0000000000a4; UI=00000000-0000-0000-0000-0000000000a5

# без этапа 49 — понятная ошибка, ничего не создано
NO49=$($P0 -d $DB -f "$D/$S57" 2>&1)
chk "без этапа 49 — «Сначала этап 49», таблицы нет" "$(echo "$NO49" | grep -o 'Сначала этап 49' | head -1) $(PP "select coalesce(to_regclass('public.sa_concept_meta')::text, 'нет')")" '^Сначала этап 49 нет$'

RC=0; OUT=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT="$out"; }
run $S49; run $S57; run $S57
chk "этапы 49 и 57 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 2 функции, concept_get отдаёт название, пока нигде не задано, старых номеров нет" "$(echo "$OUT" | grep -o 'название раздела: .*' | head -1)" \
  '^название раздела: 2 функции из 2 · concept_get отдаёт название: да · задано: пока нигде · старых номеров уроков раздела: 0$'
chk "функции с проверкой входа — VOLATILE" \
  "$(PP "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname in ('concept_get', 'concept_meta_set')")" '^concept_get:v,concept_meta_set:v$'
chk "без входа — auth" "$(Q "select concept_meta_set('нет', '', 'x', '')->>'error'")" '^auth$'
chk "напрямую таблицу не прочитать (anon)" "$(Q "select count(*) from sa_concept_meta")" 'permission denied'

# ── concept_get: meta пустое, всё прежнее на месте
chk "concept_get: meta сети и заведения пустые, прежние поля на месте" \
  "$(Q "select (concept_get('$ANNA')->'meta')::text || ' | ' || (select string_agg(k, ',' order by k) from jsonb_object_keys(concept_get('$ANNA')) k)")" \
  '^\{"net": \{"sub": "", "mode": "", "title": ""\}, "venue": \{"sub": "", "mode": "", "title": ""\}\} \| can,meta,mine,net,ok,others,read,restaurant,venue,venues$'

# ── права
chk "официант — forbidden (и сеть, и своё заведение)" "$(Q "select concept_meta_set('$ANNA', '', 'x')->>'error'") $(Q "select concept_meta_set('$ANNA', '$OK', 'x')->>'error'")" '^forbidden forbidden$'
chk "менеджер — своё заведение да, сеть нет" "$(SET $PETR "$OK" 'Два моря' 'Рыба и море' | grep -o '"ok": true') $(Q "select concept_meta_set('$PETR', '', 'x')->>'error'")" '^"ok": true forbidden$'
chk "менеджер «Порта» не трогает «Океан»" "$(Q "select concept_meta_set('$IRINA', '$OK', 'x')->>'error'")" '^forbidden$'
chk "владелец — сеть" "$(SET $ROMAN '' 'Marin Resto Group' 'Холдинг, ценности и стандарты' | grep -o '"title": "Marin Resto Group"')" '^"title": "Marin Resto Group"$'
chk "руководящий состав — любое заведение" "$(SET $MARIA 'Порт' 'Порт' '' | grep -o '"ok": true')" '^"ok": true$'

# ── что видит сотрудник
chk "Анна: сеть — Marin Resto Group, заведение — «Два моря»" \
  "$(Q "select (concept_get('$ANNA')->'meta'->'net'->>'title') || ' | ' || (concept_get('$ANNA')->'meta'->'net'->>'sub') || ' | ' || (concept_get('$ANNA')->'meta'->'venue'->>'title') || ' | ' || (concept_get('$ANNA')->'meta'->'venue'->>'sub')")" \
  '^Marin Resto Group \| Холдинг, ценности и стандарты \| Два моря \| Рыба и море$'
chk "руководящий состав открывает «Порт» — его название" "$(Q "select concept_get('$MARIA', 'Порт')->'meta'->'venue'->>'title'")" '^Порт$'
chk "итог этапа при повторе — что задано" "$($P0 -d $DB -f "$D/$S57" 2>&1 | sed -n 's/.*задано: \(.*\) · старых.*/\1/p' | head -1)" '^сеть — «Marin Resto Group», Два моря, Океан — «Два моря», Порт — «Порт»$'

# ── длины и пробелы
chk "название до 40, подзаголовок до 60 знаков, лишние пробелы схлопнуты" \
  "$(Q "select char_length(m->>'title') || ' ' || char_length(m->>'sub') from (select concept_meta_set('$ROMAN', '', repeat('я', 70), repeat('ю', 90))->'meta' m) x") $(Q "select concept_meta_set('$ROMAN', '', '  Marin   Resto  Group ', ' сеть ')->'meta'->>'title'")" \
  '^40 60 Marin Resto Group$'

# ── пусто — как было
chk "пустые название и подзаголовок — запись удалена, meta снова пустое" \
  "$(Q "select concept_meta_set('$PETR', '$OK', '  ', '')->'meta'->>'title'")|$(PP "select count(*) from sa_concept_meta where scope = '$OK'")|$(Q "select concept_get('$ANNA')->'meta'->'venue'->>'title'")" '^\|0\|$'

# ── как проходить раздел
chk "режим: credit и info задаются, чужое — bad_mode" \
  "$(Q "select concept_meta_set('$ROMAN', '', null, null, 'credit')->'meta'->>'mode'") $(Q "select concept_meta_set('$PETR', '$OK', null, null, 'info')->'meta'->>'mode'") $(Q "select concept_meta_set('$ROMAN', '', null, null, 'всегда')->>'error'")" \
  '^credit info bad_mode$'
chk "null — не трогать: режим остался, название сети прежнее" \
  "$(Q "select concept_meta_set('$ROMAN', '', 'Marin', null)->'meta'->>'mode'") $(Q "select concept_get('$ANNA')->'meta'->'net'->>'title'") $(Q "select concept_get('$ANNA')->'meta'->'venue'->>'mode'")" '^credit Marin info$'
chk "официант режим не меняет" "$(Q "select concept_meta_set('$ANNA', '$OK', null, null, 'credit')->>'error'")" '^forbidden$'
chk "всё пусто (и режим) — запись удалена" "$(Q "select concept_meta_set('$PETR', '$OK', '', '', '')->'meta'->>'mode'")|$(PP "select count(*) from sa_concept_meta where scope = '$OK'")" '^\|0$'

# ── зачёт по роли: старые номера уроков раздела — в роль, в которой прошли
PP "insert into progress (user_id, name, surname, role, lesson_id, updated_at) values
  ('$UA', 'Анна', 'Смирнова', 'core', 'cms-l-cn-idea', now() - interval '2 day'), ('$UA', 'Анна', 'Смирнова', 'core', 'cms-l-cn-o12', now() - interval '2 day'),
  ('$UA', 'Анна', 'Смирнова', 'spg', 'cms-l-cn-pitch', now() - interval '1 day'), ('$UA', 'Анна', 'Смирнова', 'core', 'cms-l-cn-core-dress', now()),
  ('$UI', 'Илья', 'Петров', 'bar', 'cms-l-cn-idea', now()), ('$UI', 'Илья', 'Петров', 'bar', 'cms-l-cn-bar-idea', now()), ('$UI', 'Илья', 'Петров', null, 'cms-l-cn-mood', now()),
  ('$UA', 'Анна', 'Смирнова', 'core', 'c0-1', now())" >/dev/null
PP "insert into quiz_done (user_id, name, surname, quiz_id) values ('$UA', 'Анна', 'Смирнова', 'cms-q-cn-idea'), ('$UA', 'Анна', 'Смирнова', 'c0-quiz')" >/dev/null
PP "insert into scores (name, surname, restaurant, role, position, quiz_id, score, total) values ('Анна', 'Смирнова', '$OK', 'core', 'waiter', 'cms-q-cn-idea', 3, 4)" >/dev/null
HASQE=$(PP "select (to_regclass('public.quiz_events') is not null)::text")
[ "$HASQE" = "true" ] && PP "insert into quiz_events (restaurant, employee, role_id, lesson_id, question, correct) values ('$OK', 'Анна Смирнова', 'core', 'cms-q-cn-idea', 'Где бейдж?', true)" >/dev/null
MIG=$($P0 -d $DB -f "$D/$S57" 2>&1)
chk "итог этапа: старых номеров уроков раздела не осталось (кроме урока без роли)" "$(echo "$MIG" | grep -o 'старых номеров уроков раздела: [0-9]*')" '^старых номеров уроков раздела: 1$'
chk "Анна: уроки — в своих ролях (ядро, хостес), новый номер не тронут, чужие уроки на месте" \
  "$(PP "select string_agg(lesson_id, ',' order by lesson_id) from progress where user_id = '$UA' and lesson_id ~ '^c'")" '^c0-1,cms-l-cn-core-dress,cms-l-cn-core-idea,cms-l-cn-core-o12,cms-l-cn-spg-pitch$'
chk "Илья: старый номер при уже новом — лишний, убран; без роли — как был" \
  "$(PP "select string_agg(lesson_id, ',' order by lesson_id) from progress where user_id = '$UI'")" '^cms-l-cn-bar-idea,cms-l-cn-mood$'
chk "тест раздела — в роль, где раньше всего проходили уроки раздела (ядро); другие тесты на месте" \
  "$(PP "select string_agg(quiz_id, ',' order by quiz_id) from quiz_done where user_id = '$UA' and quiz_id ~ '^c'")" '^c0-quiz,cms-q-cn-core-idea$'
chk "результат теста (scores) — по своей роли" "$(PP "select quiz_id from scores where name = 'Анна' and quiz_id like 'cms-q-cn-%'")" '^cms-q-cn-core-idea$'
if [ "$HASQE" = "true" ]; then chk "ответы теста (quiz_events) — по своей роли" "$(PP "select lesson_id from quiz_events where lesson_id like 'cms-q-cn-%'")" '^cms-q-cn-core-idea$'; fi
SNAP=$(PP "select md5(string_agg(user_id::text || lesson_id, ',' order by id)) from progress")
$P0 -d $DB -f "$D/$S57" >/dev/null 2>&1
chk "повтор этапа ничего не меняет" "$(PP "select md5(string_agg(user_id::text || lesson_id, ',' order by id)) from progress")" "^$SNAP$"

echo
echo "$pass ✓ / $fail ✗"
[ $fail -eq 0 ]
