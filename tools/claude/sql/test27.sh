#!/bin/bash
# Этап 27 (v64, Доп. 377): старт одним запросом — app_bootstrap. Поверх базы run25.sh: копия satest27, этапы 26 и 27
# (27 — дважды: повторный запуск безопасен), проверки ✓/✗ и итог.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test27.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest27
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
D=$(mktemp -d); cp "$SRC"/supabase-stage26-mastery.sql "$SRC"/supabase-stage27-bootstrap.sql "$D"/; chmod -R a+r "$D"
RC=0
for f in supabase-stage26-mastery.sql supabase-stage27-bootstrap.sql supabase-stage27-bootstrap.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:500}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4

chk "этапы 26 и 27 (27 — дважды) — без ошибок" "$RC" '^0$'
chk "app_bootstrap(text) → jsonb, с правами того, кто зовёт (security invoker)" "$(PP "select pg_get_function_result('public.app_bootstrap(text)'::regprocedure) || ' ' || p.prosecdef from pg_proc p where p.oid = 'public.app_bootstrap(text)'::regprocedure")" '^jsonb false$'
chk "anon и authenticated могут звать app_bootstrap" "$(PP "select has_function_privilege('anon', 'public.app_bootstrap(text)', 'execute') and has_function_privilege('authenticated', 'public.app_bootstrap(text)', 'execute')")" '^t$'
chk "ответ: ok, версия 1" "$(Q "select app_bootstrap('$ANNA')")" '"ok": true.*"v": 1|"v": 1.*"ok": true'
# в этой базе нет my_reset_at, quiz_key_rank, cms_list_lessons (их этапы run25.sh не ставит) — этих частей нет;
# mastery_list и team_achievements (этап 26) в старт не входят — их приложение спрашивает, когда человек туда заходит
chk "части — ровно те функции из списка, что есть в базе" "$(Q "select string_agg(k, ',' order by k) from jsonb_object_keys(app_bootstrap('$ANNA')->'parts') k")" '^day_brief,my_mentors,my_state,pair_status,team_profiles,team_scores,whoami$'
chk "whoami в старте = whoami_txt напрямую (whoami здесь принимает uuid — берётся переходник)" "$(Q "select (app_bootstrap('$ANNA')->'parts'->'whoami') = to_jsonb(whoami_txt('$ANNA'))")" '^t$'
chk "my_state, team_scores, day_brief в старте = те же функции напрямую" "$(Q "select (app_bootstrap('$ANNA')->'parts'->'my_state') = to_jsonb(my_state('$ANNA')) and (app_bootstrap('$ANNA')->'parts'->'team_scores') = to_jsonb(team_scores('$ANNA')) and (app_bootstrap('$ANNA')->'parts'->'day_brief') - 'now' = to_jsonb(day_brief('$ANNA')) - 'now'")" '^t$'
chk "чужой токен: части отвечают своим «auth», как напрямую; сам ответ — ok" "$(Q "select app_bootstrap('мусор')")" '"ok": true.*"error": "auth"'
# часть упала — остальные на месте
$P -c "create or replace function public.quiz_key_rank(p_token text) returns json language plpgsql as \$\$ begin raise exception 'сломано'; end \$\$; grant execute on function public.quiz_key_rank(text) to anon, authenticated" >/dev/null
chk "часть упала — {ok:false, error:boot}, остальные части на месте" "$(Q "select (app_bootstrap('$ANNA')->'parts'->'quiz_key_rank'->>'error') || ',' || (app_bootstrap('$ANNA')->'parts' ? 'my_state')::text")" '^boot,true$'
# права того, кто зовёт: функция без права для anon — в старте тоже не отвечает (а не выдаётся с правами владельца)
$P -c "revoke execute on function public.quiz_key_rank(text) from public, anon, authenticated; create or replace function public.quiz_key_rank(p_token text) returns json language sql as 'select ''{\"ok\":true,\"secret\":1}''::json'; revoke execute on function public.quiz_key_rank(text) from public, anon, authenticated" >/dev/null
chk "функция, которую anon звать не может, — в старте «boot», а не ответ с правами владельца" "$(Q "select app_bootstrap('$ANNA')->'parts'->'quiz_key_rank'")" '"error": "boot"'
chk "…а владельцу (postgres) та же часть отвечает — права действительно того, кто зовёт" "$(PP "select app_bootstrap('$ANNA')->'parts'->'quiz_key_rank'->>'secret'")" '^1$'
# подпись не та — не берётся
$P -c "create or replace function public.cms_list_lessons(p_token text, p_x int) returns json language sql as 'select ''[]''::json'; grant execute on function public.cms_list_lessons(text, int) to anon" >/dev/null
chk "функция с другой подписью (два параметра) — не берётся" "$(Q "select app_bootstrap('$ANNA')->'parts' ? 'cms_list_lessons'")" '^f$'
$P -c "create or replace function public.cms_list_lessons(p_token text) returns setof json language sql as 'select ''[]''::json'; grant execute on function public.cms_list_lessons(text) to anon" >/dev/null
chk "функция-набор (setof) — не берётся" "$(Q "select app_bootstrap('$ANNA')->'parts' ? 'cms_list_lessons'")" '^f$'
$P -c "drop function public.cms_list_lessons(text); drop function public.cms_list_lessons(text, int); create function public.cms_list_lessons(p_token text) returns json language sql as 'select ''[1,2]''::json'; grant execute on function public.cms_list_lessons(text) to anon" >/dev/null
chk "подходящая появилась — берётся без перезапуска этапа" "$(Q "select app_bootstrap('$ANNA')->'parts'->'cms_list_lessons'")" '^\[1, 2\]$'
chk "отчёт этапа: список частей печатается (whoami → whoami_txt)" "$($P0 -d $DB -t -A -f "$D/supabase-stage27-bootstrap.sql" 2>&1 | tr '\n' ' ')" 'whoami\|whoami_txt'
echo
echo "итого: $pass ✓, $fail ✗"
