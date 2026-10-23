#!/bin/bash
# Этап 29 (v74, Доп. 387): тексты бота без шапки «✦ SERVICE ACADEMY» и звёздочек.
# Главная проверка: база на ПРЕЖНИХ этапах 22б/25/26 + этап 29 = база на НОВЫХ этапах 22б/25/26 — семь функций бота
# совпадают байт в байт (текст функции, права, security definer, настройки). То есть этап 29 меняет только слова,
# а перезапуск новых 22б/25/26 ничего не возвращает. Два случая: без этапа 26 (напоминание — версия 22б) и с ним
# (версия 26, со строкой «Шаг дня»). Плюс: повторный запуск, пустая база, ни одной звёздочки.
#   OLD=/путь/к/прежней/папке/supabase bash test29.sh   (например, supabase из зипа v73)
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
# Пересоздаёт satest25 (в конце — на новых этапах, как после run25.sh).
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
OLD=${OLD:-}
[ -n "$OLD" ] && [ -f "$OLD/supabase-stage25-live.sql" ] || { echo "OLD — папка supabase прежней версии (с этапами 22б, 25, 26)"; exit 1; }
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
PT="psql -h $PGH -p $PGP -U postgres -q -t -A"
D=$(mktemp -d); cp "$SRC"/supabase-stage29-bot-texts.sql "$D"/s29.sql; cp "$OLD"/supabase-stage26-mastery.sql "$D"/old26.sql
cp "$SRC"/supabase-stage26-mastery.sql "$D"/new26.sql; chmod -R a+r "$D"
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:600}"; fail=$((fail+1)); fi; }
FN="'tg_link', '_sa_warmup_due', '_sa_skill_req_notify', 'quest_call', 'pair_nudge', '_sa_nudges_at', 'mastery_claim'"
snap() {  # семь функций бота: имя, подпись, md5 текста, права, security definer, настройки
  $PT -d "$1" -c "select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || md5(p.prosrc) || '|' || coalesce(p.proacl::text, '-') || '|' || p.prosecdef || '|' || coalesce(p.proconfig::text, '-')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ($FN) order by 1"
}
stars() { $PT -d "$1" -c "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ($FN) and (p.prosrc like '%✦%' or p.prosrc like '%SERVICE ACADEMY%')"; }
mk() { $P0 -d postgres -c "drop database if exists $1" -c "create database $1 template $2" >/dev/null; }
run() { out=$($P0 -d "$1" -f "$D/$2" 2>&1); rc=$?; [ $rc -ne 0 ] && echo "$out" | grep -iE "error|ошибк" | head -3; return $rc; }

# 1) прежние этапы
SA_SRC="$OLD" bash "$HERE/run25.sh" >/dev/null 2>&1 || { echo "run25.sh на прежних этапах упал"; exit 1; }
mk satest29o satest25; mk satest29o26 satest25
run satest29o26 old26.sql; chk "прежний этап 26 — без ошибок" "$?" '^0$'
chk "прежние этапы: звёздочки в функциях бота есть (6 без этапа 26, 7 с ним)" "$(stars satest29o) $(stars satest29o26)" '^6 7$'
OLD_A=$(snap satest29o); OLD_B=$(snap satest29o26)
# 2) новые этапы
bash "$HERE/run25.sh" >/dev/null 2>&1 || { echo "run25.sh на новых этапах упал"; exit 1; }
mk satest29n satest25; mk satest29n26 satest25
run satest29n26 new26.sql; chk "новый этап 26 — без ошибок" "$?" '^0$'
chk "новые этапы 22б/25/26: звёздочек и шапки в функциях бота нет" "$(stars satest29n) $(stars satest29n26)" '^0 0$'
NEW_A=$(snap satest29n); NEW_B=$(snap satest29n26)
# 3) этап 29 поверх прежних — дважды
R=0; for i in 1 2; do run satest29o s29.sql; R=$((R + $?)); run satest29o26 s29.sql; R=$((R + $?)); done
chk "этап 29 поверх прежних (с этапом 26 и без) — дважды без ошибок" "$R" '^0$'
chk "отчёт этапа 29: «0 из 7 (есть 6)» без этапа 26, «0 из 7 (есть 7)» с ним" "$($PT -d satest29o -f "$D/s29.sql" 2>&1 | tail -1) | $($PT -d satest29o26 -f "$D/s29.sql" 2>&1 | tail -1)" 'звёздочкой: 0 из 7 \(есть 6\) \| .*звёздочкой: 0 из 7 \(есть 7\)$'
A=$(snap satest29o); B=$(snap satest29o26)
chk "без этапа 26: функции после этапа 29 = функции новых этапов (текст, права, definer)" "$([ "$A" = "$NEW_A" ] && echo same || diff <(echo "$A") <(echo "$NEW_A"))" '^same$'
chk "с этапом 26: функции после этапа 29 = функции новых этапов" "$([ "$B" = "$NEW_B" ] && echo same || diff <(echo "$B") <(echo "$NEW_B"))" '^same$'
chk "этап 29 действительно что-то поменял (прежние ≠ новые)" "$([ "$OLD_A" != "$A" ] && [ "$OLD_B" != "$B" ] && echo changed)" '^changed$'
chk "права и подписи не тронуты: то же, что до этапа 29, кроме текста" "$([ "$(echo "$OLD_B" | cut -d'|' -f1,3-)" = "$(echo "$B" | cut -d'|' -f1,3-)" ] && [ "$(echo "$OLD_A" | cut -d'|' -f1,3-)" = "$(echo "$A" | cut -d'|' -f1,3-)" ] && echo same)" '^same$'
chk "напоминание: без этапа 26 — без «Шаг дня», с ним — со строкой" "$($PT -d satest29o -c "select prosrc like '%Шаг дня%' from pg_proc where proname = '_sa_warmup_due'") $($PT -d satest29o26 -c "select prosrc like '%Шаг дня%' from pg_proc where proname = '_sa_warmup_due'")" '^f t$'
# 4) пустая база: всё пропускается, ошибок нет
$P0 -d postgres -c "drop database if exists satest29e" -c "create database satest29e" >/dev/null
out=$($PT -v ON_ERROR_STOP=1 -d satest29e -f "$D/s29.sql" 2>&1); rc=$?
chk "пустая база: без ошибок, 7 пропусков, «есть 0»" "$rc $(echo "$out" | grep -c 'пропускаю') $(echo "$out" | tail -1)" '^0 7 .*0 из 7 \(есть 0\)$'
# что именно уходит в Telegram — test25.sh на новых этапах (satest25 после этого скрипта)
echo
echo "итого: $pass ✓, $fail ✗"
