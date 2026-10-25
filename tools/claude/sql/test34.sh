#!/bin/bash
# Этап 34 (v84, Доп. 397): «Спасибо» от гостей по QR — гостю guest_thanks_card / guest_thanks_send, сотруднику my_thanks /
# thanks_rotate, руководителю thanks_team / thanks_hide. Поверх базы run25.sh: копия satest34, этапы 26, 31, 32 и 34
# (34 — дважды), проверки ✓/✗ и итог. Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test34.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest34
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
D=$(mktemp -d); cp "$SRC"/supabase-stage26-mastery.sql "$SRC"/supabase-stage31-qday.sql "$SRC"/supabase-stage32-briefing.sql "$SRC"/supabase-stage34-guest-thanks.sql "$D"/; chmod -R a+r "$D"
RC=0; OUT34=""
for f in supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage34-guest-thanks.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
  [ "$f" = supabase-stage34-guest-thanks.sql ] && OUT34="$out"
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2; ILYA=10000000-0000-0000-0000-0000000000a5
OLEG=10000000-0000-0000-0000-0000000000a6; IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
cnt() { PP "select count(*) from net.sent_log"; }

chk "этапы 26, 31, 32 и 34 (34 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 6 функций, таблицы, вид «Спасибо от гостей» в напоминаниях" "$OUT34" 'спасибо от гостей: 6 функций из 6 · таблицы: есть · вид «Спасибо от гостей» в напоминаниях: да'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null

# ── свой код
M1=$(Q "select my_thanks('$ANNA')")
chk "my_thanks: код создан (10 знаков 0-9a-f), имя без фамилии, нули" "$M1" '"code": "[0-9a-f]{10}".*"name": "Анна"'
CODE=$(Q "select my_thanks('$ANNA')->>'code'")
chk "my_thanks второй раз — тот же код" "$(Q "select my_thanks('$ANNA')->>'code'")" "^$CODE$"
chk "my_thanks: чужой токен — auth" "$(Q "select my_thanks('мусор')->>'error'")" '^auth$'
ICODE=$(Q "select my_thanks('$ILYA')->>'code'")
chk "у Ильи — свой код" "$([ "$ICODE" != "$CODE" ] && echo разные)" '^разные$'

# ── гость
chk "карточка по коду: имя, должность, заведение (без фамилии)" "$(Q "select (x->>'name') || '|' || (x->>'pos') || '|' || (x->>'restaurant') || '|' || (x ? 'surname') from guest_thanks_card('$CODE') x")" '^Анна\|waiter\|Два моря, Океан\|false$'
chk "карточка: мусорный и несуществующий код — not_found" "$(Q "select guest_thanks_card('ABC')->>'error'") $(Q "select guest_thanks_card('0000000000')->>'error'")" '^not_found not_found$'
R1=$(Q "select guest_thanks_send('$CODE', array['care','advice','spam','care'], '  Спасибо   за совет  ', 'dev-1')")
chk "спасибо: ok; лишние и повторные отметки отброшены, пробелы сжаты" "$R1|$(PP "select array_to_string(tags, ',') || '|' || text || '|' || device from sa_guest_thanks")" '"ok": true.*\|advice,care\|Спасибо за совет\|dev-1$'
chk "Анне — сообщение: за что и текст, кнопка в приложение" "$(PP "select (body->>'chat_id') || ' ' || (body->>'text') || ' ' || (body::text like '%?go=thanks%') from net.sent_log")" '^111 Гость сказал тебе спасибо: совет по меню, внимание\. «Спасибо за совет» true$'
chk "тот же телефон гостя второй раз за 12 часов — dup, не записано" "$(Q "select guest_thanks_send('$CODE', array['smile'], '', 'dev-1')->>'dup'")|$(PP "select count(*) from sa_guest_thanks")" '^true\|1$'
Q "select guest_thanks_send('$CODE', array['smile'], '', 'dev-2')" >/dev/null
Q "select guest_thanks_send('$CODE', '{}', '', 'dev-3')" >/dev/null
Q "select guest_thanks_send('$CODE', array['speed'], 'Быстро и вкусно', 'dev-4')" >/dev/null
chk "о первых трёх за день — сообщения, четвёртое — только в приложении" "$(cnt)|$(PP "select count(*) from sa_guest_thanks")" '^3\|4$'
chk "спасибо без отметок и текста — тоже спасибо" "$(PP "select count(*) from sa_guest_thanks where tags = '{}' and text = ''")" '^1$'
$P -c "insert into sa_guest_thanks (emp_id, restaurant, created_at) select '00000000-0000-0000-0000-0000000000a4', 'Два моря, Океан', now() from generate_series(1, 36)" >/dev/null
chk "41-е за сутки одному человеку — limit" "$(Q "select guest_thanks_send('$CODE', '{}', '', 'dev-99')->>'error'")" '^limit$'
$P -c "delete from sa_guest_thanks where text = '' and tags = '{}' and device = ''" >/dev/null
OCODE=$(Q "select my_thanks('$OLEG')->>'code'")
chk "уволенный (Олег): его код у гостя не работает" "$OCODE|$(Q "select guest_thanks_card('$(PP "select code from sa_thanks_codes where emp_id like '%a6'")')->>'error'")" '\|not_found$|^\|not_found$'

# ── сотруднику
chk "my_thanks: неделя 4, всего 4, последние — свежие сверху, с отметками" "$(Q "select (x->>'week') || ' ' || (x->>'total') || ' ' || jsonb_array_length(x->'items') || ' ' || (x->'items'->0->>'text') from my_thanks('$ANNA') x")" '^4 4 4 Быстро и вкусно$'
chk "у Ильи спасибо нет" "$(Q "select my_thanks('$ILYA')->>'total'")" '^0$'
NEW=$(Q "select thanks_rotate('$ANNA')->>'code'")
chk "новый код: другой; старый у гостя больше не работает; новый — работает" "$([ "$NEW" != "$CODE" ] && echo другой)|$(Q "select guest_thanks_card('$CODE')->>'error'")|$(Q "select guest_thanks_card('$NEW')->>'name'")" '^другой\|not_found\|Анна$'
chk "старые спасибо после смены кода — на месте" "$(Q "select my_thanks('$ANNA')->>'total'")" '^4$'

# ── руководителю
chk "Анна (официант) — thanks_team: forbidden" "$(Q "select thanks_team('$ANNA')->>'error'")" '^forbidden$'
chk "Мария (старшая): Анна — 4 за неделю, отметки по видам" "$(Q "select (r->>'name') || ' ' || (r->>'week') || ' ' || (r->>'month') || ' ' || (r->'tags'->>'care') || (r->'tags'->>'advice') || (r->'tags'->>'smile') || (r->'tags'->>'speed') from jsonb_array_elements(thanks_team('$MARIA')->'rows') r")" '^Анна 4 4 1111$'
chk "Мария: последние спасибо с именами" "$(Q "select jsonb_array_length(x->'items') || ' ' || (x->'items'->0->>'name') from thanks_team('$MARIA') x")" '^4 Анна$'
chk "Ирина (Порт): чужого заведения не видно" "$(Q "select jsonb_array_length(thanks_team('$IRINA')->'rows')")" '^0$'
TID=$(PP "select id from sa_guest_thanks where text = 'Быстро и вкусно'")
chk "Ирина не скрывает чужое — not_found; Анна — forbidden" "$(Q "select thanks_hide('$IRINA', $TID, true)->>'error'") $(Q "select thanks_hide('$ANNA', $TID, true)->>'error'")" '^not_found forbidden$'
chk "Мария скрывает: спасибо не видно и не считается" "$(Q "select thanks_hide('$MARIA', $TID, true)->>'hidden'")|$(Q "select my_thanks('$ANNA')->>'total'")|$(Q "select (thanks_team('$MARIA')->'rows'->0->>'week')")" '^true\|3\|3$'
chk "руководитель видит скрытое с пометкой и может вернуть" "$(Q "select bool_or((i->>'hidden')::boolean) from jsonb_array_elements(thanks_team('$MARIA')->'items') i")|$(Q "select thanks_hide('$MARIA', $TID, false)->>'hidden'")|$(Q "select my_thanks('$ANNA')->>'total'")" '^t\|false\|4$'

# ── выключенные сообщения и без бота
$P -c "delete from net.sent_log; delete from tg_sent" >/dev/null
$P -c "set role anon; select notify_set('$ILYA', 'thanks', false)" >/dev/null
chk "Илья выключил «Спасибо от гостей» — спасибо записано, сообщения нет" "$(Q "select guest_thanks_send('$ICODE', array['smile'], '', 'dev-5')->>'ok'")|$(cnt)" '^true\|0$'
$P -c "delete from vault.secrets_stub" >/dev/null
chk "без токена бота: спасибо записано, сообщений нет" "$(Q "select guest_thanks_send('$NEW', array['smile'], '', 'dev-6')->>'ok'")|$(cnt)" '^true\|0$'

# ── права
chk "anon: шесть функций — можно" "$(PP "select bool_and(has_function_privilege('anon', f, 'execute')) from unnest(array['public.guest_thanks_card(text)', 'public.guest_thanks_send(text, text[], text, text)', 'public.my_thanks(text)', 'public.thanks_rotate(text)', 'public.thanks_team(text)', 'public.thanks_hide(text, bigint, boolean)']) f")" '^t$'
chk "anon: служебные функции и таблицы напрямую — нельзя" "$(PP "select has_function_privilege('anon', 'public._sa_thanks_emp(text)', 'execute') or has_function_privilege('anon', 'public._sa_thanks_new_code()', 'execute')")|$(Q "select count(*) from sa_guest_thanks")|$(Q "select count(*) from sa_thanks_codes")" '^f\|.*(permission denied|нет доступа).*\|.*(permission denied|нет доступа)'

echo "Итого: $pass ✓, $fail ✗"
