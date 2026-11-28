#!/bin/bash
# Этап 70 (v214, Доп. 540): закрытые дни заведения в утренней сводке.
# Поверх базы run25.sh: копия satest70; этап 70 раньше 40 — понятная ошибка; этапы 26, 31, 32, 34, 35, 36, 37, 38, 39,
# 40 → 70 дважды. _sa_mo_lvl: закрыто по неделе (rules.closedDows) и датой (days[d].closed), банкет в выходной день,
# остальное — как в этапе 40; _sa_mo_holes: в закрытый день пусто, даже если в графике кейтеринг.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test70.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest70
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql"
S40=supabase-stage40-morning.sql; S70=supabase-stage70-closed-days.sql
D=$(mktemp -d); for f in $PRE $MID $S40 $S70; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT70=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; [ "$1" = $S70 ] && OUT70="$out"; }
for f in $PRE; do run $f; done
for f in $PRE; do run $f; done
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
NO38=$($P0 -d $DB -f "$D/$S40" 2>&1)
NO40=$($P0 -d $DB -f "$D/$S70" 2>&1)
for f in $MID $S40 $S70 $S70; do run $f; done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }

chk "этап 70 раньше этапа 40 — понятная ошибка" "$NO40" 'Сначала этап 40 \(supabase-stage40-morning.sql\): утренняя сводка'
chk "этапы 26–40 и 70 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа" "$(echo "$OUT70" | grep -o 'Закрытые и особые дни в утренней сводке: .*' | tail -1 | sed 's/[[:space:]]*$//')" \
  'dates · заведений с выходными днями: 0 · с особыми днями: 0$'

# декабрь 2026: 7-е и 14-е — понедельники, 8-е — вторник, 11-е — пятница
C0='{"rules": {"peakDows": [4, 5], "highDows": [3, 6], "holidayPeak": true, "closedDows": [0]}, "need": {"1": {"waiter": 2}, "2": {"waiter": 2}, "3": {"waiter": 3}}}'
L() { PP "select _sa_mo_lvl('$C0'::jsonb, '$1'::jsonb, '$2'::date)"; }
chk "понедельник — закрыто по неделе (0); вторник — обычный; пятница — пик" "$(L '{}' 2026-12-07) $(L '{}' 2026-12-08) $(L '{}' 2026-12-11)" '^0 1 3$'
chk "дата главнее недели: банкет в понедельник открыт, пометка уровня работает" \
  "$(L '{"7": {"closed": false}}' 2026-12-07) $(L '{"7": {"closed": false, "lvl": 3}}' 2026-12-07)" '^1 3$'
chk "санитарный день во вторник и в пятницу — закрыто; заметка ко дню не закрывает" \
  "$(L '{"8": {"closed": true}}' 2026-12-08) $(L '{"11": {"closed": true, "lvl": 3}}' 2026-12-11) $(L '{"8": {"note": "банкет"}}' 2026-12-08)" '^0 0 1$'
chk "без выходных дней — как этап 40: понедельник обычный, праздник 1 января — пик" \
  "$(PP "select _sa_mo_lvl('{\"rules\": {\"peakDows\": [4, 5], \"holidayPeak\": true}}'::jsonb, '{}'::jsonb, '2026-12-07'::date)") $(PP "select _sa_mo_lvl('{\"rules\": {\"peakDows\": [4, 5], \"holidayPeak\": true}}'::jsonb, '{}'::jsonb, '2027-01-01'::date)")" '^1 3$'

# в графике кейтеринг на закрытый понедельник и обычная смена во вторник
PP "insert into schedule_months (restaurant, venue_key, month, payload) values ('Тест70', 'main', '2026-12',
  '{\"plan\": {\"1\": {\"7\": \"К\", \"8\": \"Д\"}}, \"days\": {\"9\": {\"closed\": true}}}'::jsonb)" >/dev/null
CFG='{"rules": {"peakDows": [4, 5], "closedDows": [0]}, "need": {"1": {"waiter": 2}, "2": {"waiter": 2}, "3": {"waiter": 2}},
  "shifts": [{"k": "Д", "name": "День", "from": 12, "to": 20}, {"k": "К", "name": "Кейтеринг", "from": 10, "to": 22, "extra": 1}],
  "staff": [{"id": 1, "name": "Анна", "pos": "waiter"}]}'
H() { PP "select _sa_mo_holes('Тест70', \$j\$$CFG\$j\$::jsonb, '$1'::date)"; }
chk "закрытый понедельник с кейтерингом — дыр нет; вторник — не хватает одного официанта" "$(H 2026-12-07) | $(H 2026-12-08)" \
  '^\[\] \| \[\{"pos": "waiter", "miss": 1\}\]$'
PP "update schedule_months set payload = jsonb_set(payload, '{plan,1,9}', '\"К\"') where restaurant = 'Тест70'" >/dev/null
chk "среда, закрытая датой, — тоже без дыр" "$(H 2026-12-09)" '^\[\]$'
# «Особые дни» (v216): дата главнее пометки месяца и недели; свои люди на дату
CD='{"rules": {"peakDows": [4, 5], "closedDows": [0], "holidayPeak": true}, "need": {"1": {"waiter": 2}, "2": {"waiter": 2}, "3": {"waiter": 3}},
  "dates": {"2026-12-31": {"closed": true}, "2027-01-02": {"hours": [16, 24]}, "2026-12-14": {"closed": false, "lvl": 3}, "2026-12-08": {"need": {"waiter": 4}}},
  "shifts": [{"k": "Д", "name": "День", "from": 12, "to": 20}, {"k": "К", "name": "Кейтеринг", "from": 10, "to": 22, "extra": 1}],
  "staff": [{"id": 1, "name": "Анна", "pos": "waiter"}]}'
LD() { PP "select _sa_mo_lvl(\$j\$$CD\$j\$::jsonb, '$1'::jsonb, '$2'::date)"; }
chk "особые дни: 31 декабря закрыто, 2 января (свои часы) — праздник, пик; понедельник 14-го открыт пиком, хотя месяц его закрыл" \
  "$(LD '{}' 2026-12-31) $(LD '{}' 2027-01-02) $(LD '{"14": {"closed": true}}' 2026-12-14) $(LD '{}' 2026-12-07)" '^0 3 3 0$'
PP "update schedule_months set payload = jsonb_set(payload, '{plan,1,8}', '\"Д\"') where restaurant = 'Тест70'" >/dev/null
HD() { PP "select _sa_mo_holes('Тест70', \$j\$$CD\$j\$::jsonb, '$1'::date)"; }
chk "особые дни: 8-го нужно 4 официанта (своё число) — не хватает трёх" "$(HD 2026-12-08)" '^\[\{"pos": "waiter", "miss": 3\}\]$'
chk "права: _sa_mo_lvl и _sa_mo_holes закрыты от anon" "$(PP "select has_function_privilege('anon', '_sa_mo_lvl(jsonb, jsonb, date)', 'execute') || ' ' || has_function_privilege('anon', '_sa_mo_holes(text, jsonb, date)', 'execute')")" '^false false$'

echo; echo "Итого: ✓ $pass  ✗ $fail"
$P0 -d postgres -c "drop database if exists $DB" >/dev/null 2>&1
[ "$fail" -eq 0 ]
