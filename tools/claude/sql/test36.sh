#!/bin/bash
# Этап 36 (v86, Доп. 399): удобнее — brief_read / brief_reads, «Счёт» в seat_set, review_links / review_links_set /
# guest_review_links, тихие часы notify_quiet / notify_quiet_set и _sa_tg_chat. Поверх базы run25.sh: копия satest36,
# этапы 26, 31, 32, 34, 35 и 36 (36 — дважды), проверки ✓/✗ и итог. Нужен psql; сервер — PGHOST (по умолчанию
# /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test36.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest36
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
FILES="supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql"
D=$(mktemp -d); for f in $FILES; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0; OUT36=""
# без этапов 32–35 этап 36 не идёт: просит сначала их
NO35=$($P0 -d $DB -f "$D/supabase-stage36-comfort.sql" 2>&1)
for f in $FILES supabase-stage36-comfort.sql; do
  out=$($P0 -d $DB -f "$D/$f" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $f (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3
  [ "$f" = supabase-stage36-comfort.sql ] && OUT36="$out"
done
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:700}"; fail=$((fail+1)); fi; }
ANNA=10000000-0000-0000-0000-0000000000a4; MARIA=10000000-0000-0000-0000-0000000000a2; ILYA=10000000-0000-0000-0000-0000000000a5
IRINA=10000000-0000-0000-0000-0000000000b1
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5
PLAN='{"v":1,"tables":[{"id":"t1","n":"1","seats":2,"shape":"sq","x":0,"y":0},{"id":"t2","n":"2","seats":4,"shape":"rd","x":2,"y":0},{"id":"t3","n":"6","seats":6,"shape":"long","x":4,"y":1}]}'
cnt() { PP "select count(*) from net.sent_log"; }

chk "без этапов 32–35 — понятная ошибка: какой этап сначала" "$NO35" 'Сначала этап 32 \(supabase-stage32-briefing.sql\)'
chk "этапы 26, 31, 32, 34, 35 и 36 (36 — дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 7 функций, таблицы, «Счёт», тихие часы" "$OUT36" 'удобнее: 7 функций из 7 · таблицы: есть · «Счёт» в рассадке: да · тихие часы: да'
$P -c "delete from net.sent_log; delete from tg_sent; delete from sa_notify_prefs; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value" >/dev/null

# ── брифинг: «Прочитал(а)»
chk "брифинга нет: brief_read — no_brief; brief_reads — brief false" "$(Q "select brief_read('$ANNA')->>'error'")|$(Q "select (x->>'brief') || ' ' || (x->>'me') from brief_reads('$ANNA') x")" '^no_brief\|false false$'
Q "select brief_publish('$MARIA', '{\"v\":1,\"blocks\":{\"note\":\"Банкет\"},\"on\":{\"note\":true}}'::jsonb, 'Брифинг смены')" >/dev/null
chk "брифинг есть, Анна ещё не читала: me false, прочитали 0" "$(Q "select (x->>'brief') || ' ' || (x->>'me') || ' ' || (x->>'n') from brief_reads('$ANNA') x")" '^true false 0$'
chk "Анна отметила «Прочитал(а)»: me true; у Марии — 1 и кто" "$(Q "select brief_read('$ANNA')->>'ok'")|$(Q "select (x->>'me') from brief_reads('$ANNA') x")|$(Q "select (x->>'n') || ' ' || (x->'rows'->0->>'name') || ' ' || (x->'rows'->0->>'surname') from brief_reads('$MARIA') x")" '^true\|true\|1 Анна Смирнова$'
chk "сотруднику список не отдаём (только число)" "$(Q "select jsonb_array_length(x->'rows') || ' ' || (x->>'lead') from brief_reads('$ILYA') x")" '^0 false$'
chk "автор не считается: Мария отметила у себя — по-прежнему 1" "$(Q "select brief_read('$MARIA')->>'ok'")|$(Q "select x->>'n' from brief_reads('$MARIA') x")" '^true\|1$'
$P -c "select pg_sleep(0.05)" >/dev/null
Q "select brief_publish('$MARIA', '{\"v\":1,\"blocks\":{\"note\":\"Банкет перенесли\"},\"on\":{\"note\":true}}'::jsonb, 'Брифинг смены')" >/dev/null
chk "правка брифинга: прежняя отметка устарела — me false, прочитали 0" "$(Q "select (x->>'me') || ' ' || (x->>'n') from brief_reads('$ANNA') x")" '^false 0$'
chk "прочитала правку — снова me true" "$(Q "select brief_read('$ANNA')->>'ok'")|$(Q "select x->>'me' from brief_reads('$ANNA') x")" '^true\|true$'
chk "Ирина (Порт): брифинга своего заведения нет" "$(Q "select brief_read('$IRINA')->>'error'")" '^no_brief$'
chk "чужой токен — auth" "$(Q "select brief_read('мусор')->>'error'") $(Q "select brief_reads('мусор')->>'error'")" '^auth auth$'

# ── рассадка: «Счёт»
Q "select floor_save('$MARIA', '$PLAN'::jsonb)" >/dev/null
$P -c "delete from net.sent_log" >/dev/null
Q "select seat_set('$MARIA', 't3', 'seat', 5, '', '', '$AEMP')" >/dev/null
SINCE=$(PP "select since from sa_seat where tid = 't3'")
chk "посадили — Анне сообщение (как в этапе 35)" "$(cnt)" '^1$'
R=$(Q "select seat_set('$ANNA', 't3', 'bill', 5, 'x', '19:00', '$AEMP')")
chk "«Счёт»: гости, официант и время посадки остались, бронь не пишется" "$R|$(PP "select (since = '$SINCE') || ' ' || cnt || ' ' || waiter_name || '|' || name || '|' || rtime from sa_seat where tid = 't3'")" '"status": "bill".*\|true 5 Анна Смирнова\|\|$'
chk "«Счёт» — без сообщения официанту" "$(cnt)" '^1$'
chk "обратно в «Гости» (нажали по ошибке) — время прежнее, второго сообщения нет" "$(Q "select seat_set('$MARIA', 't3', 'seat', 5, '', '', '$AEMP')->'table'->>'status'")|$(PP "select since = '$SINCE' from sa_seat where tid = 't3'")|$(cnt)" '^seat\|t\|1$'
chk "«Счёт» → уборка: всё стирается" "$(Q "select seat_set('$ANNA', 't3', 'bill', 5, '', '', '$AEMP')->>'ok'")|$(Q "select seat_set('$ANNA', 't3', 'clean', 0, '', '', null)->'table'")" '^true\|.*"cnt": 0.*"since": null.*"status": "clean".*"waiter_id": null'
chk "неизвестный статус — bad_request" "$(Q "select seat_set('$ANNA', 't3', 'paid', 2, '', '', null)->>'error'")" '^bad_request$'
chk "передали стол со «Счётом» Илье и посадили — Илье сообщение" "$(Q "select seat_set('$MARIA', 't1', 'bill', 2, '', '', '$AEMP')->>'ok'")|$(Q "select seat_set('$MARIA', 't1', 'seat', 2, '', '', '$IEMP')->>'ok'")|$(PP "select count(*) from net.sent_log where body->>'chat_id' = '222'")" '^true\|true\|1$'

# ── ссылки на отзывы
YA='https://yandex.ru/maps/org/dva_morya/1234567890/reviews/'; GIS='https://2gis.ru/petropavlovsk/firm/70000001012345678'
chk "ссылки задаёт руководитель: Анна — forbidden" "$(Q "select review_links_set('$ANNA', '[\"$YA\"]'::jsonb)->>'error'")" '^forbidden$'
chk "чужие и небезопасные ссылки — bad_url (http, другой сайт, пробел)" "$(Q "select review_links_set('$MARIA', '[\"http://yandex.ru/maps/org/1\"]'::jsonb)->>'error'") $(Q "select review_links_set('$MARIA', '[\"https://evil.example/?yandex.ru/maps\"]'::jsonb)->>'error'") $(Q "select review_links_set('$MARIA', '[\"https://yandex.ru/maps/org/a b\"]'::jsonb)->>'error'")" '^bad_url bad_url bad_url$'
chk "больше двух — bad_request; два раза Яндекс — duplicate" "$(Q "select review_links_set('$MARIA', '[\"$YA\", \"$GIS\", \"https://g.page/r/abc/review\"]'::jsonb)->>'error'") $(Q "select review_links_set('$MARIA', '[\"$YA\", \"https://yandex.ru/maps/-/CDabc\"]'::jsonb)->>'error'")" '^bad_request duplicate$'
chk "Мария: Яндекс Карты и 2ГИС сохранены, вид — по адресу" "$(Q "select string_agg(l->>'kind', ',') from jsonb_array_elements(review_links_set('$MARIA', '[\"$YA\", {\"url\": \"$GIS\"}]'::jsonb)->'links') l")" '^yandex,2gis$'
chk "Google: короткие ссылки и «написать отзыв»" "$(PP "select _sa_review_kind('https://maps.app.goo.gl/AbCd') || ' ' || _sa_review_kind('https://search.google.com/local/writereview?placeid=x') || ' ' || coalesce(_sa_review_kind('https://google.com/search?q=maps'), 'нет')")" '^google google нет$'
chk "сотрудник видит ссылки своего заведения, Ирина (Порт) — пусто" "$(Q "select jsonb_array_length(review_links('$ILYA')->'links')")|$(Q "select jsonb_array_length(review_links('$IRINA')->'links')")" '^2\|0$'
CODE=$(Q "select my_thanks('$ANNA')->>'code'")
chk "гость по QR Анны видит ссылки заведения; неизвестный код — not_found" "$(Q "select (guest_review_links('$CODE')->'links'->0->>'url')")|$(Q "select guest_review_links('zzzzzzzzzz')->>'error'")" "^$YA\|not_found$"
chk "очистить ссылки — пустой список" "$(Q "select jsonb_array_length(review_links_set('$MARIA', '[]'::jsonb)->'links')")|$(Q "select jsonb_array_length(guest_review_links('$CODE')->'links')")" '^0\|0$'

# ── тихие часы
chk "тихие часы: неверные — bad_request (одно из двух, 24, одинаковые)" "$(Q "select notify_quiet_set('$ANNA', 22, null)->>'error'") $(Q "select notify_quiet_set('$ANNA', 24, 8)->>'error'") $(Q "select notify_quiet_set('$ANNA', 5, 5)->>'error'")" '^bad_request bad_request bad_request$'
chk "Анна: с 22 до 8 сохранено и читается" "$(Q "select notify_quiet_set('$ANNA', 22, 8)->>'ok'")|$(Q "select (x->>'from') || '-' || (x->>'to') from notify_quiet('$ANNA') x")" '^true\|22-8$'
chk "через полночь и днём: 23→9 в 23, 3 — тихо, в 9 — нет; 9→18 в 12 — тихо, в 18 — нет" "$(PP "select _sa_quiet_now(23, 9, 23)::text || _sa_quiet_now(23, 9, 3)::text || _sa_quiet_now(23, 9, 9)::text || _sa_quiet_now(9, 18, 12)::text || _sa_quiet_now(9, 18, 18)::text")" '^truetruefalsetruefalse$'
HH=$(PP "select extract(hour from now() at time zone _sa_tz((select restaurant from tg_links where emp_id = '$AEMP')))::int")
Q "select notify_quiet_set('$ANNA', $HH, $(( (HH + 1) % 24 )))" >/dev/null
chk "сейчас тихий час Анны: «спасибо от гостей» не шлём, напоминание о смене (без вида) — шлём" "$(PP "select coalesce(_sa_tg_chat('$AEMP', 'thanks')::text, 'нет') || ' ' || coalesce(_sa_tg_chat('$AEMP', null)::text, 'нет')")" '^нет 111$'
$P -c "delete from net.sent_log" >/dev/null
chk "в тихий час Анне не пишем о посадке, доска работает" "$(Q "select seat_set('$MARIA', 't2', 'seat', 3, '', '', '$AEMP')->>'ok'")|$(cnt)" '^true\|0$'
Q "select notify_quiet_set('$ANNA', $(( (HH + 1) % 24 )), $(( (HH + 2) % 24 )))" >/dev/null
chk "тихие часы позже — сейчас пишем" "$(PP "select coalesce(_sa_tg_chat('$AEMP', 'thanks')::text, 'нет')")" '^111$'
chk "выключить тихие часы (null, null)" "$(Q "select notify_quiet_set('$ANNA', null, null)->>'ok'")|$(Q "select coalesce(x->>'from', 'нет') from notify_quiet('$ANNA') x")" '^true\|нет$'
chk "виды сообщений — без тихих часов (колонки не булевы)" "$(Q "select notify_prefs('$ANNA') ? 'quiet_from'")|$(Q "select notify_prefs('$ANNA') ? 'seat'")" '^f\|t$'
chk "выключенный вид по-прежнему выключен" "$(Q "select notify_set('$ANNA', 'thanks', false)->>'ok'")|$(PP "select coalesce(_sa_tg_chat('$AEMP', 'thanks')::text, 'нет')")" '^true\|нет$'

# ── права
chk "anon: семь функций и seat_set — можно" "$(PP "select has_function_privilege('anon', 'public.brief_read(text)', 'execute') and has_function_privilege('anon', 'public.brief_reads(text)', 'execute') and has_function_privilege('anon', 'public.review_links(text)', 'execute') and has_function_privilege('anon', 'public.review_links_set(text, jsonb)', 'execute') and has_function_privilege('anon', 'public.guest_review_links(text)', 'execute') and has_function_privilege('anon', 'public.notify_quiet(text)', 'execute') and has_function_privilege('anon', 'public.notify_quiet_set(text, int, int)', 'execute') and has_function_privilege('anon', 'public.seat_set(text, text, text, int, text, text, text)', 'execute')")" '^t$'
chk "anon: служебные функции и таблицы — нельзя" "$(PP "select has_function_privilege('anon', 'public._sa_tg_chat(text, text)', 'execute') or has_function_privilege('anon', 'public._sa_review_kind(text)', 'execute') or has_function_privilege('anon', 'public._sa_quiet_now(int, int, int)', 'execute')")|$(Q "select count(*) from sa_brief_reads")|$(Q "select count(*) from sa_review_links")" '^f\|.*(permission denied|нет доступа).*\|.*(permission denied|нет доступа)'

echo "Итого: $pass ✓, $fail ✗"
