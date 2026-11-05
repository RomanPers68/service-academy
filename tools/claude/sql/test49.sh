#!/bin/bash
# Этап 49 (v139, Доп. 454): «О нас» — концепция и стандарты сети и заведений.
# Поверх базы run25.sh: копия satest49; этап 49 дважды; права (сеть — владелец и руководящий состав, заведение — его
# руководители), проверка блока (вид, заголовок, текст или фото, «для кого», вопросы теста, длины), фото (своё заведение,
# base64, превью и целиком, удаление вместе с блоком), concept_get (сеть, своё заведение, соседи — только концепция, сети —
# любое заведение), версии (текст меняет, порядок и вопросы — нет), «Прочитал(а)» и «Кто прочитал», «Сообщить команде»
# (бот, раз в день, напоминания выключены — нет), все функции с проверкой входа — VOLATILE. Отправка — заглушка pg_net.
# Нужен psql; сервер — PGHOST (по умолчанию /tmp/pgsock) и PGPORT (5433).
#   bash run25.sh && bash test49.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${SA_SRC:-$HERE/../../../supabase}
PGH=${PGHOST:-/tmp/pgsock}; PGP=${PGPORT:-5433}
DB=satest49
P0="psql -h $PGH -p $PGP -U postgres -v ON_ERROR_STOP=1 -q"
$P0 -d postgres -c "drop database if exists $DB" -c "create database $DB template satest25" >/dev/null 2>&1 || { echo "нет базы satest25 — сначала run25.sh"; exit 1; }
S49=supabase-stage49-concept.sql
D=$(mktemp -d); cp "$SRC/$S49" "$D/"; chmod -R a+r "$D"
RC=0; OUT49=""
run() { out=$($P0 -d $DB -f "$D/$1" 2>&1); rc=$?; RC=$((RC + rc)); echo "── $1 (rc=$rc)"; echo "$out" | grep -iE "error|ошибк" | head -3; OUT49="$out"; }
run $S49; run $S49
P="psql -h $PGH -p $PGP -U postgres -q -t -A -d $DB"
Q() { $P -c "set role anon; $1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
PP() { $P -c "$1" 2>&1 | tr '\n' ' ' | sed 's/[[:space:]]*$//'; }
pass=0; fail=0
chk() { local name="$1" got="$2" want="$3"; if printf '%s' "$got" | grep -qE -- "$want"; then echo "✓ $name"; pass=$((pass+1)); else echo "✗ $name — got: ${got:0:900}"; fail=$((fail+1)); fi; }
ROMAN=10000000-0000-0000-0000-0000000000a1; MARIA=10000000-0000-0000-0000-0000000000a2; PETR=10000000-0000-0000-0000-0000000000a3
ANNA=10000000-0000-0000-0000-0000000000a4; ILYA=10000000-0000-0000-0000-0000000000a5; IRINA=10000000-0000-0000-0000-0000000000b1; IVAN=10000000-0000-0000-0000-0000000000b2
AEMP=00000000-0000-0000-0000-0000000000a4; IEMP=00000000-0000-0000-0000-0000000000a5; VEMP=00000000-0000-0000-0000-0000000000b2
OK="Два моря, Океан"
SAVE() { Q "select concept_save('$1', '$2'::jsonb)"; }
B64=$(python3 -c "import base64; print(base64.b64encode(bytes(range(256))*2).decode())")

chk "этап 49 (дважды) — без ошибок" "$RC" '^0$'
chk "итог этапа: 9 функций, блоков 0, бот сообщает команде" "$(echo "$OUT49" | grep -o 'о нас: .*' | head -1)" '^о нас: 9 функций из 9 · блоков: 0 · бот: сообщает команде$'
chk "все функции с проверкой входа — VOLATILE (PostgREST зовёт STABLE «только для чтения»)" \
  "$(PP "select string_agg(proname || ':' || provolatile::text, ',' order by proname) from pg_proc where proname like 'concept\_%'")" \
  '^concept_delete:v,concept_get:v,concept_notify:v,concept_order:v,concept_photo:v,concept_photo_put:v,concept_read:v,concept_reads:v,concept_save:v$'
chk "без входа — auth" "$(Q "select concept_get('нет')->>'error'") $(Q "select concept_save(null, '{}'::jsonb)->>'error'")" '^auth auth$'

# ── права
chk "официант не правит своё заведение" "$(SAVE $ANNA "{\"scope\":\"$OK\",\"kind\":\"idea\",\"title\":\"x\",\"body\":\"x\"}" | grep -o '"error": "[a-z_]*"')" 'forbidden'
chk "менеджер — своё заведение да, сеть нет" \
  "$(SAVE $PETR "{\"scope\":\"$OK\",\"kind\":\"idea\",\"title\":\"Концепция «Океана»\",\"body\":\"Рыба и морепродукты.\"}" | grep -o '"ok": true') $(SAVE $PETR '{"scope":"","kind":"values","title":"x","body":"x"}' | grep -o 'forbidden')" '^"ok": true forbidden$'
chk "менеджер «Порта» не правит «Океан»" "$(SAVE $IRINA "{\"scope\":\"$OK\",\"kind\":\"pitch\",\"title\":\"x\",\"body\":\"x\"}" | grep -o 'forbidden')" '^forbidden$'
chk "руководящий состав — сеть и любое заведение" \
  "$(SAVE $MARIA '{"scope":"","kind":"values","title":"Ценности","body":"• Гость первым"}' | grep -o '"ok": true') $(SAVE $MARIA '{"scope":"Порт","kind":"idea","title":"Концепция «Порта»","body":"Бар у причала."}' | grep -o '"ok": true')" '^"ok": true "ok": true$'
chk "владелец — сеть" "$(SAVE $ROMAN '{"scope":"","kind":"dress","title":"Внешний вид","body":"Чёрный верх","tracks":["seasonal","core","x"]}' | grep -o '"tracks": \[[^]]*\]')" '^"tracks": \["core", "seasonal"\]$'

# ── проверка блока
chk "вид неизвестен — bad_kind; без заголовка — no_title; без текста и фото — empty" \
  "$(SAVE $ROMAN '{"scope":"","kind":"spam","title":"x","body":"x"}' | grep -o 'bad_kind') $(SAVE $ROMAN '{"scope":"","kind":"own","title":"  ","body":"x"}' | grep -o 'no_title') $(SAVE $ROMAN '{"scope":"","kind":"own","title":"Свой","body":""}' | grep -o '"error": "empty"')" '^bad_kind no_title "error": "empty"$'
LONG=$(python3 -c "print('я'*200)"); BODY=$(python3 -c "print('т'*7000)")
chk "заголовок до 80, текст до 6000 знаков" "$(PP "select char_length(b->>'title') || ' ' || char_length(b->>'body') from (select concept_save('$ROMAN', jsonb_build_object('scope','','kind','own','title','$LONG','body','$BODY'))->'block' b) x")" '^80 6000$'
QS='[{"q":"Где бейдж?","options":["Слева","Справа"],"correct":0,"explanation":"Слева"},{"q":"","options":["a","b"],"correct":0},{"q":"Один вариант","options":["a"],"correct":0},{"q":"Неверный номер","options":["a","b"],"correct":5},{"q":"Пустой вариант","options":["a",""],"correct":0},{"q":"Не строка","options":["a",1],"correct":0},{"q":"Номер-строка","options":["a","b","c"],"correct":"2"}]'
chk "вопросы теста: остаются целые (2 из 7)" "$(PP "select jsonb_array_length(concept_save('$ROMAN', jsonb_build_object('scope','','kind','check','title','Чек','body','x','questions','$QS'::jsonb))->'block'->'questions')")" '^2$'
Q12=$(python3 -c "import json; print(json.dumps([{'q':'В%d'%i,'options':['a','b'],'correct':1} for i in range(15)]))")
chk "вопросов не больше 12" "$(PP "select jsonb_array_length(concept_save('$ROMAN', jsonb_build_object('scope','','kind','numbers','title','Цифры','body','x','questions','$Q12'::jsonb))->'block'->'questions')")" '^12$'

# ── фото
PH=$(Q "select concept_photo_put('$PETR', '$OK', '$B64', '$B64', 720, 480)->>'id'")
chk "фото своего заведения — номер" "$PH" '^[0-9]+$'
chk "фото: официанту нельзя, не base64 — bad_photo, маленькое — bad_photo" \
  "$(Q "select concept_photo_put('$ANNA', '$OK', '$B64', '$B64')->>'error'") $(Q "select concept_photo_put('$PETR', '$OK', 'не фото!', 'x')->>'error'") $(Q "select concept_photo_put('$PETR', '$OK', 'QUJD', 'QUJD')->>'error'")" '^forbidden bad_photo bad_photo$'
PN=$(Q "select concept_photo_put('$ROMAN', '', '$B64', '$B64')->>'id'")
SV=$(SAVE $PETR "{\"scope\":\"$OK\",\"kind\":\"setting\",\"title\":\"Сервировка\",\"body\":\"\",\"photos\":[{\"id\":$PH,\"cap\":\"Стол на двоих\"},{\"id\":$PH},{\"id\":$PN},{\"id\":\"x\"}]}")
chk "блок только с фото: фото сети в блок заведения не встаёт, повтор — тоже" "$(echo "$SV" | grep -o '"photos": \[[^]]*\]')" "^\"photos\": \[\{\"id\": $PH, \"cap\": \"Стол на двоих\"\}\]$"
SID=$(echo "$SV" | grep -o '"id": [0-9]*, "body"' | grep -o '[0-9]*')
chk "фото: превью и целиком — любой сотрудник" "$(Q "select (concept_photo('$IVAN', $PH)->>'ok') || ' ' || (concept_photo('$ANNA', $PH, true)->>'w') || ' ' || char_length(concept_photo('$ANNA', $PH, true)->>'data')")" '^true 720 [0-9]+$'
chk "удалить блок: официант нет; менеджер да, фото — вместе с ним" \
  "$(Q "select concept_delete('$ANNA', $SID)->>'error'") $(Q "select concept_delete('$PETR', $SID)->>'ok'") $(PP "select count(*) from sa_concept_photos where id = $PH")" '^forbidden true 0$'

# ── что видит сотрудник
SAVE $PETR "{\"scope\":\"$OK\",\"kind\":\"pitch\",\"title\":\"Рассказ гостю\",\"body\":\"«Добрый вечер!»\"}" >/dev/null
SAVE $PETR "{\"scope\":\"$OK\",\"kind\":\"day\",\"title\":\"Распорядок дня менеджера\",\"body\":\"10:30 открытие\",\"tracks\":[\"manager\"]}" >/dev/null
SAVE $MARIA '{"scope":"Порт","kind":"dress","title":"Форма «Порта»","body":"Тельняшка"}' >/dev/null
G=$(Q "select concept_get('$ANNA')")
chk "Анна: своё заведение, сеть, соседи; править нельзя; списка заведений нет" \
  "$(Q "select (concept_get('$ANNA')->>'restaurant') || ' | ' || (concept_get('$ANNA')->'can')::text || ' | ' || coalesce(concept_get('$ANNA')->>'venues', '—')")" "^$OK \| \{\"net\": false, \"venue\": false\} \| —$"
chk "сосед «Порт» — только концепция (без формы)" "$(Q "select string_agg(b->>'kind', ',') from jsonb_array_elements(concept_get('$ANNA')->'others') o, jsonb_array_elements(o->'blocks') b")" '^idea$'
chk "Анна просит «Порт» целиком — получает своё заведение" "$(Q "select concept_get('$ANNA', 'Порт')->'venue'->>'name'")" "^$OK$"
chk "руководящий состав открывает «Порт» целиком (и форму), видит список заведений" \
  "$(Q "select (concept_get('$MARIA', 'Порт')->'venue'->>'name') || ' ' || jsonb_array_length(concept_get('$MARIA', 'Порт')->'venue'->'blocks') || ' ' || (concept_get('$MARIA')->'venues')::text")" '^Порт 2 \[.*"Два моря, Океан".*"Порт".*\]$'
chk "менеджер может править своё заведение, сеть — нет" "$(Q "select (concept_get('$PETR')->'can')::text")" '^\{"net": false, "venue": true\}$'

# ── версии и «Прочитал(а)»
V1=$(Q "select concept_get('$ANNA')->'venue'->>'ver'")
chk "версия заведения — 12 знаков" "$V1" '^[0-9a-f]{12}$'
chk "Анна отмечает сеть и своё заведение; чужое — нельзя" \
  "$(Q "select concept_read('$ANNA', '')->>'ok'") $(Q "select concept_read('$ANNA', '$OK')->>'ver'") $(Q "select concept_read('$ANNA', 'Порт')->>'error'")" "^true $V1 forbidden$"
chk "concept_get: что прочитано — текущие версии" "$(Q "select ((concept_get('$ANNA')->'read'->>'venue') = (concept_get('$ANNA')->'venue'->>'ver'))::text")" '^true$'
IDS=$(PP "select string_agg(id::text, ',' order by id desc) from sa_concept_blocks where scope = '$OK'")
Q "select concept_order('$PETR', '$OK', '{$IDS}'::bigint[])" >/dev/null
chk "порядок поменяли — версия та же" "$(Q "select concept_get('$ANNA')->'venue'->>'ver'")" "^$V1$"
PID=$(PP "select id from sa_concept_blocks where scope = '$OK' and kind = 'pitch'")
SAVE $PETR "{\"id\":$PID,\"scope\":\"$OK\",\"kind\":\"pitch\",\"title\":\"Рассказ гостю\",\"body\":\"«Добрый вечер!»\",\"questions\":[{\"q\":\"Как встречаем?\",\"options\":[\"Добрый вечер\",\"Привет\"],\"correct\":0}]}" >/dev/null
chk "добавили вопросы — версия та же" "$(Q "select concept_get('$ANNA')->'venue'->>'ver'")" "^$V1$"
chk "порядок: блоки в заданном порядке" "$(Q "select string_agg(b->>'id', ',') from jsonb_array_elements(concept_get('$ANNA')->'venue'->'blocks') b")" "^$IDS$"
SAVE $PETR "{\"id\":$PID,\"scope\":\"$OK\",\"kind\":\"pitch\",\"title\":\"Рассказ гостю\",\"body\":\"«Добрый вечер! У нас всё из моря.»\"}" >/dev/null
V2=$(Q "select concept_get('$ANNA')->'venue'->>'ver'")
chk "поправили текст — версия новая, у Анны снова непрочитано" "$V2 $(Q "select concept_get('$ANNA')->'read'->>'venue'")" "^[0-9a-f]{12} $V1$"
chk "чужой блок по номеру не поправить (scope другой) — not_found" "$(SAVE $MARIA "{\"id\":$PID,\"scope\":\"Порт\",\"kind\":\"pitch\",\"title\":\"x\",\"body\":\"x\"}" | grep -o 'not_found')" '^not_found$'
chk "«Кто прочитал»: официанту нельзя; менеджеру — своё заведение, Анна — сеть да, заведение нет" \
  "$(Q "select concept_reads('$ANNA')->>'error'") $(Q "select (r->>'net') || ' ' || (r->>'venue') from jsonb_array_elements(concept_reads('$PETR')->'rows') r where r->>'id' = '$AEMP'")" '^forbidden true false$'
chk "«Кто прочитал»: себя в списке нет (Пётр), остальные — Мария, Анна, Илья; уволенного и владельца нет" \
  "$(Q "select string_agg(r->>'name', ', ' order by r->>'name') from jsonb_array_elements(concept_reads('$PETR')->'rows') r")" '^Анна Смирнова, Илья Бармен, Мария Ким$'
chk "«Кто прочитал»: менеджер «Порта» про «Океан» — нельзя, руководящий состав — можно" \
  "$(Q "select concept_reads('$IRINA', '$OK')->>'error'") $(Q "select concept_reads('$MARIA', '$OK')->>'restaurant'")" "^forbidden $OK$"

# ── «Сообщить команде»
$P -c "delete from net.sent_log; delete from tg_sent; delete from vault.secrets_stub; insert into vault.secrets_stub values ('sa_tg_bot_token', '123:TEST'); insert into sa_settings (key, value) values ('app_url', 'https://app.example') on conflict (key) do update set value = excluded.value; update tg_links set remind = true" >/dev/null
$P -c "insert into tg_links (emp_id, chat_id, remind) values ('$VEMP', 555, true) on conflict (emp_id) do update set chat_id = 555, remind = true" >/dev/null 2>&1
N1=$(Q "select concept_notify('$PETR', '$OK')")
chk "сообщить «Океану»: ушло Марии, Анне и Илье (у Романа нет Telegram, Иван — в «Порту», автору — нет), бот на месте" "$(echo "$N1" | grep -o '"sent": [0-9]*') $(echo "$N1" | grep -o '"bot": [a-z]*')" '^"sent": 3 "bot": true$'
chk "текст и кнопка «О нас» (go=about)" "$(PP "select (body->>'text') || ' | ' || (body->'reply_markup'->'inline_keyboard'->0->0->>'text') || ' | ' || (body->'reply_markup'->'inline_keyboard'->0->0->'web_app'->>'url') from net.sent_log where body->>'chat_id' = '111' order by id desc limit 1")" '^Обновили «О нас»: концепция и стандарты «Два моря, Океан»\.\s*Открой и отметь «Прочитал\(а\)»\. \| О нас \| https://app\.example/\?go=about$'
chk "второй раз за день — никому" "$(Q "select concept_notify('$PETR', '$OK')->>'sent'")" '^0$'
$P -c "delete from tg_sent" >/dev/null
chk "сеть — всем сотрудникам сети с Telegram, кроме автора (Пётр, Анна, Илья, Иван); официанту — нельзя" \
  "$(Q "select concept_notify('$MARIA', '')->>'sent'") $(Q "select concept_notify('$ANNA', '$OK')->>'error'")" '^4 forbidden$'
$P -c "delete from tg_sent; update tg_links set remind = false where emp_id = '$AEMP'" >/dev/null
chk "у кого напоминания выключены — не пишем (Анна)" "$(Q "select concept_notify('$PETR', '$OK')->>'sent'")" '^2$'
chk "чужое заведение — forbidden, пустое — empty" "$(Q "select concept_notify('$IRINA', '$OK')->>'error'") $(Q "select concept_notify('$ROMAN', 'Нигде')->>'error'")" '^forbidden empty$'

echo
echo "$pass ✓ / $fail ✗"
[ $fail -eq 0 ]
