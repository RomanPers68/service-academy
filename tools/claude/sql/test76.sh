#!/bin/bash
# Этап 76 (v225, Доп. 551): фото и голос в базе — путём к файлу. Поверх базы run25.sh: копия satest76; этап 76 раньше 38
# (понятная ошибка) → этапы 4, 26, 31, 32, 34, 35, 36, 37, 38, 39, 40, 46 → старая проверка фото (как на рабочей базе до
# v225) → меню с полными адресами → этап 76 дважды.
# Проверки ✓/✗. Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433), пользователь postgres.
#   bash run25.sh && bash test76.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest76
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
PRE="supabase-stage4.sql supabase-stage26-mastery.sql supabase-stage31-qday.sql supabase-stage32-briefing.sql supabase-stage34-guest-thanks.sql supabase-stage35-seating.sql supabase-stage36-comfort.sql supabase-stage37-halls-qday.sql"
MID="supabase-stage38-chat.sql supabase-stage39-everyday.sql supabase-stage40-morning.sql supabase-stage46-bar-share.sql"
S76=supabase-stage76-storage-paths.sql
D=$(mktemp -d); for f in $PRE $MID $S76; do cp "$SRC/$f" "$D/"; done; chmod -R a+r "$D"
RC=0
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; }
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PASS=0; FAIL=0
chk() { if [ "$2" = "$3" ]; then PASS=$((PASS + 1)); echo "✓ $1"; else FAIL=$((FAIL + 1)); echo "✗ $1 — получено «$2», ожидалось «$3»"; fi; }
# этап 76 раньше времени: просит этап 38 и ничего не меняет
NO38=$($P0 -d $DB -f "$D/$S76" 2>&1)
for f in $PRE; do run $f; done
$P0 -d $DB -c "create or replace function my_reset_at(p_token text) returns jsonb language plpgsql stable security definer set search_path to public as \$f\$ begin return jsonb_build_object('ok', true, 'reset_at', null); end \$f\$" \
  -c "create or replace function hr_quality_get(p_token text, p_restaurant text) returns json language plpgsql stable security definer set search_path to public as \$f\$ begin return json_build_object('ok', true, 'item', null); end \$f\$" >/dev/null
for f in $MID; do run $f; done
chk "этап 76 без этапа 38 — понятная ошибка" "$(echo "$NO38" | grep -c 'Сначала этап 38')" "1"

SB="https://gvxhgdynjuaisswplroh.supabase.co"; OT="https://abcd1234.supabase.co"; PTH="/storage/v1/object/public"
ITEM() { Q "select coalesce(_sa_chat_item(jsonb_build_object('kind', 'dish', 'id', 'd1', 'title', 'Борщ', 'img', '$1'), array['dish'])->>'img', '∅')"; }
chk "этапы 38 и 46 (v225): путь хранилища в карточке уже проходит" "$(ITEM "$PTH/menu-photos/a.jpg")" "$PTH/menu-photos/a.jpg"
# база, где этапы 38 и 46 стоят в прежнем виде (как на рабочей до v225): возвращаем старую проверку
cat > "$D/old.sql" <<'SQL'
do $d$ declare f record; begin
  for f in select p.oid from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
            where ns.nspname = 'public' and p.proname in ('_sa_chat_item', 'chat_stop_note', 'chat_stop_set') loop
    execute replace(pg_get_functiondef(f.oid), $q$'^(https://[^\s"<>]+|/storage/v1/object/public/[^\s"<>]+)$'$q$, $q$'^https://[^\s"<>]+$'$q$);
  end loop;
end $d$;
SQL
chmod a+r "$D/old.sql"; run old.sql
chk "старая база: путь хранилища в карточке отбрасывался" "$(ITEM "$PTH/menu-photos/a.jpg")" "∅"
chk "старая база: полный адрес проходил" "$(ITEM "$SB$PTH/menu-photos/a.jpg")" "$SB$PTH/menu-photos/a.jpg"
# меню заведения: два блюда с фото и голосом, одно — фото прямо в записи, одно — чужой сайт
$P -c "insert into restaurant_menu (restaurant, dishes) values ('Океан', jsonb_build_array(
  jsonb_build_object('id', 'd1', 'name', 'Борщ', 'img', '$SB$PTH/menu-photos/okean/d1-1.jpg', 'voice', jsonb_build_object('chef', jsonb_build_object('url', '$SB$PTH/menu-voice/okean/d1-chef.webm'))),
  jsonb_build_object('id', 'd2', 'name', 'Салат', 'img', '$OT$PTH/menu-photos/x/d2.png', 'stop', null),
  jsonb_build_object('id', 'd3', 'name', 'Суп', 'img', 'data:image/jpeg;base64,AAAA'),
  jsonb_build_object('id', 'd4', 'name', 'Пирог', 'img', 'https://example.com/storage/v1/object/public/p.jpg', 'note', 'фото было на $SB$PTH/menu-photos/okean/d1-1.jpg')))
  on conflict (restaurant) do update set dishes = excluded.dishes" >/dev/null
run $S76
MENU() { Q "select x->>'$2' from restaurant_menu, jsonb_array_elements(dishes) x where restaurant = 'Океан' and x->>'id' = '$1'"; }
chk "меню: фото блюда — путём" "$(MENU d1 img)" "$PTH/menu-photos/okean/d1-1.jpg"
chk "меню: голос шефа — путём" "$(Q "select x#>>'{voice,chef,url}' from restaurant_menu, jsonb_array_elements(dishes) x where restaurant = 'Океан' and x->>'id' = 'd1'")" "$PTH/menu-voice/okean/d1-chef.webm"
chk "меню: адрес другого проекта Supabase — как был (путь вёл бы в наше хранилище)" "$(MENU d2 img)" "$OT$PTH/menu-photos/x/d2.png"
chk "меню: фото прямо в записи (data:) — как было" "$(MENU d3 img)" "data:image/jpeg;base64,AAAA"
chk "меню: не Supabase — как было" "$(MENU d4 img)" "https://example.com/storage/v1/object/public/p.jpg"
chk "меню: адрес хранилища посреди текста — тоже путём (строка та же)" "$(MENU d4 note)" "фото было на $PTH/menu-photos/okean/d1-1.jpg"
chk "меню: прочие поля на месте (stop: null, имена)" "$(Q "select jsonb_array_length(dishes) || ' ' || (dishes->1 ? 'stop')::text || ' ' || (dishes->0->>'name') from restaurant_menu where restaurant = 'Океан'")" "4 true Борщ"
chk "карточка: путь хранилища проходит" "$(ITEM "$PTH/menu-photos/a.jpg")" "$PTH/menu-photos/a.jpg"
chk "карточка: полный адрес https проходит" "$(ITEM "$SB$PTH/menu-photos/a.jpg")" "$SB$PTH/menu-photos/a.jpg"
chk "карточка: http (без s) — нет" "$(ITEM "http://x.ru/a.jpg")" "∅"
chk "карточка: javascript: — нет" "$(ITEM "javascript:alert(1)")" "∅"
chk "карточка: путь не хранилища — нет" "$(ITEM "/assets/x.js")" "∅"
chk "карточка: путь с пробелом и кавычкой — нет" "$(ITEM "$PTH/a b.jpg")|$(ITEM "$PTH/a\\\"b.jpg")" "∅|∅"
chk "карточка: длиннее 600 знаков — нет" "$(Q "select coalesce(_sa_chat_item(jsonb_build_object('kind', 'dish', 'id', 'd1', 'title', 'Б', 'img', '$PTH/' || repeat('a', 600)), array['dish'])->>'img', '∅')")" "∅"
NEW_RE='^(https://[^\s"<>]+|/storage/v1/object/public/[^\s"<>]+)$'
for fn in _sa_chat_item chat_stop_note chat_stop_set; do
  chk "$fn: новая проверка на месте, старой нет" "$(Q "select (strpos(pg_get_functiondef('$fn'::regproc), '$NEW_RE') > 0)::text || ' ' || (strpos(pg_get_functiondef('$fn'::regproc), \$q\$'^https://[^\s\"<>]+\$'\$q\$) > 0)::text")" "true false"
done
chk "признак этапа _sa_storage_path" "$(Q "select _sa_storage_path()")" "$PTH/"
# повторный запуск: ничего не меняется
H1=$(Q "select md5(dishes::text) from restaurant_menu where restaurant = 'Океан'")
F1=$(Q "select md5(string_agg(pg_get_functiondef(oid), '' order by proname)) from pg_proc where proname in ('_sa_chat_item', 'chat_stop_note', 'chat_stop_set')")
run $S76
chk "повторный запуск: меню то же" "$(Q "select md5(dishes::text) from restaurant_menu where restaurant = 'Океан'")" "$H1"
chk "повторный запуск: функции те же" "$(Q "select md5(string_agg(pg_get_functiondef(oid), '' order by proname)) from pg_proc where proname in ('_sa_chat_item', 'chat_stop_note', 'chat_stop_set')")" "$F1"
chk "этапы прошли без ошибок" "$RC" "0"
echo "итого: $PASS ✓, $FAIL ✗"
[ "$FAIL" = 0 ]
