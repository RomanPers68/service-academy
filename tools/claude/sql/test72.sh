#!/bin/bash
# Этап 72 (v216, Доп. 542): сколько людей нужно по дням недели, в утренней сводке.
# Поверх базы run25.sh: копия satest72; этап 72 раньше 70 — понятная ошибка; этапы 26, 31, 32, 34, 35, 36, 37, 38, 39,
# 40, 70 → 72 дважды. _sa_mo_need: по дням недели (rules.needMode = "dows", needDow), по типу дня — как раньше, закрыто —
# пусто, «Особые дни» поверх; _sa_mo_holes считает дыры по нему.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test72.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest72
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql"
S40=supabase-stage40-morning.sql; S70=supabase-stage70-closed-days.sql; S72=supabase-stage72-need-by-dow.sql
D=$(mktemp -d); for f in $PRE $MID $S40 $S70 $S72; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT72=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = $S72 ] && OUT72="$out"; }
for f in $PRE; do run $f; done
for f in $PRE; do run $f; done
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
for f in $MID $S40; do run $f; done
NO70=$($P0 -d $DB -f "$D/$S72" 2>&1)
for f in $S70 $S72 $S72; do run $f; done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }

chk "этап 72 раньше этапа 70 — понятная ошибка" "$NO70" 'Сначала этап 70 \(supabase-stage70-closed-days.sql\): закрытые и особые дни'
chk "этапы 26–40, 70 и 72 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа" "$(echo "$OUT72" | grep -o 'Люди по дням недели в утренней сводке: .*' | tail -1 | sed 's/[[:space:]]*$//')" \
  'заведений, где считают по дням недели: 0$'

# декабрь 2026: 7-е — понедельник, 8-е — вторник, 11-е — пятница, 12-е — суббота
CW='{"rules": {"peakDows": [4, 5], "closedDows": [0], "needMode": "dows"}, "need": {"1": {"waiter": 2}, "2": {"waiter": 2}, "3": {"waiter": 3}},
  "needDow": {"waiter": [2, 2, 2, 3, 4, 5, 3], "bar": [0, 1, 1, 1, 2, 2, 1], "runner": "x"},
  "dates": {"2026-12-09": {"need": {"waiter": 1}}, "2026-12-10": {"closed": true}}}'
N() { PP "select _sa_mo_need(\$j\$$1\$j\$::jsonb, '{}'::jsonb, '$2'::date)"; }
chk "по дням недели: вторник — 2 официанта и бар, пятница — 4 и 2, суббота — 5 и 2" \
  "$(N "$CW" 2026-12-08) | $(N "$CW" 2026-12-11) | $(N "$CW" 2026-12-12)" \
  '^\{"bar": 1, "waiter": 2\} \| \{"bar": 2, "waiter": 4\} \| \{"bar": 2, "waiter": 5\}$'
chk "по дням недели: закрытый понедельник и закрытая датой среда (10-е) — пусто; «Особые дни» поверх: 9-го один официант" \
  "$(N "$CW" 2026-12-07) | $(N "$CW" 2026-12-10) | $(N "$CW" 2026-12-09)" '^\{\} \| \{\} \| \{"bar": 1, "waiter": 1\}$'
CL=$(echo "$CW" | sed 's/"needMode": "dows"/"needMode": "levels"/')
chk "по типу дня — как раньше: вторник 2, пятница (пик) 3; без needMode — тоже по типу" \
  "$(N "$CL" 2026-12-08) | $(N "$CL" 2026-12-11) | $(N '{"rules": {"peakDows": [4, 5]}, "need": {"3": {"waiter": 3}}, "needDow": {"waiter": [9, 9, 9, 9, 9, 9, 9]}}' 2026-12-11)" \
  '^\{"waiter": 2\} \| \{"waiter": 3\} \| \{"waiter": 3\}$'
chk "по типу дня, «Особые дни» поверх по одной должности: остальные должности на месте (в этапе 70 пропадали)" \
  "$(N '{"rules": {"peakDows": [4, 5]}, "need": {"1": {"waiter": 2, "bar": 1}}, "dates": {"2026-12-08": {"need": {"waiter": 4}}}}' 2026-12-08)" '^\{"bar": 1, "waiter": 4\}$'
chk "needMode «dows» без needDow — по типу дня" \
  "$(N '{"rules": {"peakDows": [4, 5], "needMode": "dows"}, "need": {"3": {"waiter": 3}}}' 2026-12-11)" '^\{"waiter": 3\}$'

# в графике: Анна (официант) — пятница 11-го и суббота 12-го, бармен Олег — пятница
PP "insert into schedule_months (restaurant, venue_key, month, payload) values ('Тест72', 'main', '2026-12',
  '{\"plan\": {\"1\": {\"11\": \"Д\", \"12\": \"Д\", \"7\": \"К\"}, \"2\": {\"11\": \"В\"}}}'::jsonb)" >/dev/null
CFG=$(echo "$CW" | sed 's/}}}$/}},\n  "shifts": [{"k": "Д", "name": "День", "from": 12, "to": 20}, {"k": "В", "name": "Вечер", "from": 16, "to": 24}, {"k": "К", "name": "Кейтеринг", "from": 10, "to": 22, "extra": 1}],\n  "staff": [{"id": 1, "name": "Анна", "pos": "waiter"}, {"id": 2, "name": "Олег", "pos": "bar"}]}/')
H() { PP "select _sa_mo_holes('Тест72', \$j\$$CFG\$j\$::jsonb, '$1'::date)"; }
chk "дыры по дням недели: в пятницу не хватает бармена и 3 официантов, в субботу — 2 барменов и 4 официантов" "$(H 2026-12-11) | $(H 2026-12-12)" \
  '^\[\{"pos": "bar", "miss": 1\}, \{"pos": "waiter", "miss": 3\}\] \| \[\{"pos": "bar", "miss": 2\}, \{"pos": "waiter", "miss": 4\}\]$'
chk "закрытый понедельник с кейтерингом — дыр нет" "$(H 2026-12-07)" '^\[\]$'
chk "права: _sa_mo_need и _sa_mo_holes закрыты от anon" "$(PP "select has_function_privilege('anon', '_sa_mo_need(jsonb, jsonb, date)', 'execute') || ' ' || has_function_privilege('anon', '_sa_mo_holes(text, jsonb, date)', 'execute')")" '^false false$'
chk "итог этапа видит заведение по дням недели" "$(PP "insert into schedule_venues (restaurant, venue_key, title, config) values ('Тест72', 'main', 'Тест', \$j\$$CFG\$j\$::jsonb) on conflict do nothing; select count(*) from schedule_venues v where v.config->'rules'->>'needMode' = 'dows' and jsonb_typeof(v.config->'needDow') = 'object'")" '^1$'

echo; echo "Итого: ✓ $pass  ✗ $fail"
$P0 -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
[ "$fail" -eq 0 ]
