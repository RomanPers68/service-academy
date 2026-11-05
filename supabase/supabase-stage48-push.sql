-- ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 48 (v137, Доп. 450): уведомления на телефон (Web Push), как у приложений.
--
-- Владелец (04.11): «Я тут у ребят плати по миру увидел, что когда добавляешь по сути ссылку на домашний экран айфона, у
-- них приходят уведомления… можно ли это реализовать в приложении?» — на семь предложений «Да, берём все».
--
--   • Телефон с приложением на экране «Домой» (iPhone — iOS 16.4 и новее, Android — Chrome) включает уведомления:
--     push_subscribe(p_token, p_sub, p_ua) — подписка браузера (адрес и ключи), до пяти телефонов на человека; тот же
--     телефон у другого (общий телефон) — подписка у того, кто вошёл. push_unsubscribe — выключить на этом телефоне.
--   • Что приходит: всё, что бот пишет человеку (sa_tg_send, sa_tg_api('sendMessage'), _sa_chat_tg — этап 48 их заменяет
--     той же отправкой в Telegram плюс шаг _sa_push_route): чат, смены, «Опаздываю», утро, брифинг, вопрос дня, разминка
--     за час до смены, новичку… Те же виды и тихие часы, что у Telegram (sa_notify_prefs, _sa_tg_chat): кто выключил вид
--     или у кого тихие часы, тому не придёт ни туда, ни туда. Уведомления идут тем же путём, что сообщения бота: бот
--     должен быть подключён (этап 22б и токен).
--   • Где получать (push_channel): 'both' — Telegram и телефон (по умолчанию), 'push' — только телефон (Telegram молчит,
--     пока на телефоне включено), 'tg' — только Telegram. Ответы бота на нажатие или сообщение в самом Telegram
--     (вебхук, sa_tg_update) — всегда только в Telegram: sa_tg_update обёрнут и помечает, из какого чата событие.
--     Напоминания в Telegram были выключены, а телефон включили — приходит только на телефон; выключили последний
--     телефон — Telegram снова молчит, как было.
--   • Без Telegram: у кого нет связки с ботом, тому в tg_links ставится «чат» без Telegram (отрицательный номер из
--     sa_push_people.pseudo) — все рассылки бота видят человека как обычно, а отправка уходит только на телефон. Связал
--     Telegram — номер заменяется настоящим; отвязал, а телефон включён — снова «чат» без Telegram (триггер на tg_links).
--     Выключил последний телефон — «чат» без Telegram убирается.
--   • Касание уведомления открывает тот же экран, что кнопка в сообщении бота (go из кнопки: ?go=… или startapp=go_…;
--     у «Вопроса дня» — qday). На иконке приложения — сколько непрочитанного в чатах (badge, _sa_push_badge).
--   • push_test — пробное уведомление себе (не чаще раза в 15 секунд). push_status — что включено (руководителю —
--     сколько телефонов в сети, последняя доставка и ошибка: экран «Сервер»).
--   • Отправляет функция push-send (supabase/functions/push-send): база зовёт её через pg_net (_sa_push_post) с секретом
--     push_secret; функция берёт подписки и ключи (sa_push_take), шифрует и подписывает (VAPID), отправляет и отвечает
--     в базу (sa_push_done): подписка, которой больше нет (404/410), удаляется. Ключи VAPID функция создаёт сама при
--     первом запуске (sa_push_keys) и хранит в sa_settings (закрыта, только для службы). Адрес функции — из
--     sa_settings.supabase_url (его записывает экран «Сервер», этап 39, и push_status у руководителя).
--   • sa_push_tg(p_chat, p_text, p_go) — то же для функции shift-reminder («Завтра смена»): отправить на телефон и
--     ответить, писать ли в Telegram.
--
-- Доп. 451 (владелец, 05.11: «Мы можем уведомления сделать красивее? И они будут приходить с кнопками перехода в
-- приложение? И будет ли возможность отвечать прямо с них?» — на пять предложений «Давай как обычно, все»):
--   • Текст как в мессенджере (_sa_push_text): заголовок — чат или человек, текст — «кто: что» («Вся команда» /
--     «Пётр О.: @Мария, на банкет…»); опоздание, «отдаю смену», «ищем в смену» — «кто что» сверху, подробности ниже.
--   • Одна переписка — одно уведомление: в заголовке — сколько новых («Вся команда · 3 новых»), у функции — c (чат: на
--     Android уведомление заменяется, на iPhone старые закрывает сервис-воркер) и Topic (пока телефон без сети, ждёт
--     только последнее).
--   • Касание — сразу к делу: сообщение открывает переписку с готовым ответом (go chat_<чат>_<сообщение>_r).
--   • Кнопки под уведомлением (Android): у сообщения — «Ответить» (поле прямо в уведомлении) и «Прочитано», у карточек —
--     кнопки бота «Принято», «Забрать», «Выйду», «Иду». Ключ (sa_push_acts) — у телефона, один раз и три дня;
--     нажатие — функция push-send (?act=1) → sa_push_act.
--   • Telegram: просто текст боту в ближайшие 30 минут после сообщения о переписке (sa_push_tglast) уходит в эту
--     переписку; бот отвечает «Ушло в «…».» с кнопкой «Отменить» (10 минут).
--   • Подпись VAPID не обновляется чаще раза в час (так просит Apple): функция берёт её из базы (sa_push_take → jwt)
--     и обновляет раз в 6 часов (sa_push_done, p_jwt).
--
-- Нужны этапы 21, 22б, 31, 36, 38 и 39. Можно запускать повторно. Этот файл заменяет sa_tg_send (22б), sa_tg_api (31),
-- _sa_chat_tg (38) и оборачивает sa_tg_update (31, 38, 39): если после него снова запускали 22б, 31, 38 или 39 —
-- запусти его ещё раз. После этапа — функция push-send (Edge Functions → push-send; Verify JWT — выключить).
-- ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is null then
    raise exception 'Сначала этап 22б (supabase-stage22b-telegram-reminders.sql): нужны tg_links и sa_tg_send';
  end if;
  if to_regprocedure('public.sa_tg_api(text,jsonb)') is null then
    raise exception 'Сначала этап 31 (supabase-stage31-qday.sql): нужна функция sa_tg_api';
  end if;
  if to_regprocedure('public._sa_tg_chat(text,text)') is null then
    raise exception 'Сначала этап 36 (supabase-stage36-comfort.sql): нужна функция _sa_tg_chat';
  end if;
  if to_regprocedure('public._sa_chat_tg(bigint,text,jsonb,jsonb)') is null or to_regprocedure('public._sa_chat_unread(bigint,text)') is null then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужны _sa_chat_tg и чат';
  end if;
  if to_regprocedure('public._sa_tg_emp(text)') is null or to_regprocedure('public.sa_tg_update(text,jsonb)') is null then
    raise exception 'Сначала этап 39 (supabase-stage39-everyday.sql): нужны _sa_tg_emp и sa_tg_update';
  end if;
end $$;

-- ── 1) Телефоны и выбор «где получать» ──────────────────────────────────────────────────────────────────────────
create table if not exists sa_push_subs (
  id         bigserial primary key,
  emp_id     text not null,                    -- employees.id
  endpoint   text not null unique,             -- адрес подписки (Apple, Google, Mozilla)
  p256dh     text not null,                    -- ключ телефона для шифрования
  auth       text not null,                    -- секрет телефона для шифрования
  ua         text,                             -- что за телефон (для справки)
  created_at timestamptz not null default now(),
  ok_at      timestamptz,                      -- последняя доставка
  fails      int not null default 0,           -- неудачи подряд
  err        text                              -- последняя ошибка
);
create index if not exists sa_push_subs_emp on sa_push_subs (emp_id);
alter table sa_push_subs enable row level security;
revoke all on table sa_push_subs from anon, authenticated;

create table if not exists sa_push_people (
  emp_id     text primary key,                 -- employees.id
  channel    text not null default 'both' check (channel in ('both', 'push', 'tg')),
  pseudo     bigint unique,                    -- «чат» без Telegram для tg_links: −9 000 000 000 000 001 и ниже
  tg_off     boolean not null default false,   -- напоминания в Telegram были выключены, когда включили телефон
  test_at    timestamptz,                      -- последнее пробное уведомление
  updated_at timestamptz default now()
);
alter table sa_push_people enable row level security;
revoke all on table sa_push_people from anon, authenticated;
create sequence if not exists sa_push_pseudo_seq;
revoke all on sequence sa_push_pseudo_seq from anon, authenticated;

-- Доп. 451: кнопки уведомления — что можно сделать прямо из него; ключ — у телефона, один раз и три дня
create table if not exists sa_push_acts (
  k          text primary key,                 -- 64 знака, у телефона в уведомлении
  emp_id     text not null,                    -- кому пришло (от его имени и делается)
  acts       jsonb not null,                   -- [{ a: reply | read | cl | ct | cg, t: надпись, id: сообщение, c: чат }]
  created_at timestamptz not null default now(),
  used_at    timestamptz
);
create index if not exists sa_push_acts_at on sa_push_acts (created_at);
alter table sa_push_acts enable row level security;
revoke all on table sa_push_acts from anon, authenticated;

-- Доп. 451: последнее сообщение бота о переписке в этот Telegram — просто текст боту в ближайшие 30 минут уходит туда
create table if not exists sa_push_tglast (
  tg       bigint primary key,                 -- личный чат с ботом
  chat_id  bigint not null,                    -- переписка в приложении
  msg_id   bigint,                             -- сообщение, о котором писал бот
  at       timestamptz not null default now()
);
alter table sa_push_tglast enable row level security;
revoke all on table sa_push_tglast from anon, authenticated;

-- секрет, с которым база зовёт функцию push-send (функция сверяет его через sa_push_take)
insert into sa_settings (key, value) values ('push_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  on conflict (key) do nothing;

-- ── 2) Помощники ───────────────────────────────────────────────────────────────────────────────────────────────
-- номер «чата» без Telegram (настоящие чаты Telegram — от −10¹³ и выше)
create or replace function _sa_push_is_pseudo(p_chat bigint)
returns boolean language sql immutable as $$ select coalesce(p_chat <= -9000000000000001, false) $$;

-- строка не длиннее n знаков: по слову и «…»
create or replace function _sa_push_cut(p text, n int)
returns text language sql immutable as $$
  select case when p is null then null when char_length(p) <= n then p
    else rtrim(case when substr(p, n, 1) ~ '\s' then left(p, n - 1)
      else coalesce(nullif(regexp_replace(left(p, n - 1), '\s+\S*$', ''), ''), left(p, n - 1)) end, ' ,.;:—–-') || '…' end
$$;

-- первая буква — заглавная (upper() зависит от локали базы: своя таблица, кириллица и латиница)
create or replace function _sa_push_cap(p text)
returns text language sql immutable as $$
  select case when coalesce(p, '') = '' then coalesce(p, '')
    else translate(left(p, 1), 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz',
      'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ') || substr(p, 2) end
$$;

-- текст бота → уведомление: { t — заголовок, b — текст, m — сообщение из переписки }. Без разметки HTML.
-- Доп. 451, как в мессенджере:
--   «Анна С. пишет тебе:» и текст                    → «Анна С.» / текст
--   «Пётр О. отвечает тебе в «Вся команда»:»         → «Вся команда» / «Пётр О. отвечает тебе: …»
--   «… упоминает тебя в «…»:», «… пишет всем в «…»:» → чат / «Пётр О.: …», «Пётр О. всем: …»
--   длинная первая строка «кто что: подробности» (опоздание, отдаю смену, ищем в смену) → до двоеточия — заголовок,
--   после — текст с заглавной («(смена с 12:00)» в конце — через запятую, «Забрать / Выйти можно прямо здесь» — это
--   кнопка), остальные строки — через « · ».
-- Иначе как раньше: первая строка — заголовок (до 80 знаков, что не вошло — в начало текста; двоеточие в конце над
-- сообщением — без него), остальное — текст (до 240 знаков).
create or replace function _sa_push_text(p_text text)
returns jsonb language plpgsql immutable as $$
declare t text; ls text[]; ttl text; pre text; rest text; mm text[]; m boolean := false; p int; aft text;
begin
  t := regexp_replace(coalesce(p_text, ''), '<[^>]*>', '', 'g');
  t := replace(replace(replace(replace(replace(replace(t, '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&nbsp;', ' '), '&amp;', '&');
  select array_agg(x order by i) into ls
    from (select btrim(regexp_replace(l, '\s+', ' ', 'g')) as x, i from regexp_split_to_table(t, E'\n') with ordinality as s(l, i)) q
   where x <> '';
  if ls is null then return null; end if;
  ttl := ls[1];
  rest := coalesce(array_to_string(ls[2:array_length(ls, 1)], ' '), '');
  if rest <> '' then
    mm := regexp_match(ttl, '^(.{1,60}) пишет тебе:$');
    if mm is not null then
      ttl := mm[1]; m := true;
    else
      mm := regexp_match(ttl, '^(.{1,60}) (отвечает тебе|упоминает тебя|пишет всем) в «(.{1,60})»:$');
      if mm is not null then
        ttl := mm[3];
        rest := mm[1] || case mm[2] when 'отвечает тебе' then ' отвечает тебе: ' when 'пишет всем' then ' всем: ' else ': ' end || rest;
        m := true;
      end if;
    end if;
  end if;
  if not m and char_length(ttl) > 45 then
    p := position(': ' in ttl);
    if p between 6 and 60 then
      aft := btrim(substr(ttl, p + 2));
      aft := regexp_replace(aft, '\.?\s*(Забрать|Выйти) можно прямо здесь\.?$', '');
      aft := regexp_replace(aft, ' \(([^()]{1,40})\)\.?$', ', \1');
      aft := btrim(regexp_replace(aft, '\.$', ''));
      if aft <> '' then
        ttl := left(ttl, p - 1);
        rest := _sa_push_cap(aft) || case when rest <> '' then ' · ' || rest else '' end;
      end if;
    end if;
  end if;
  if char_length(ttl) > 80 then
    pre := _sa_push_cut(ttl, 80);
    rest := '…' || ltrim(substr(ttl, char_length(pre)), ' ,.;:') || case when rest <> '' then ' ' || rest else '' end;
    ttl := pre;
  end if;
  -- «Итог:» над сообщением — заголовок без двоеточия
  if right(ttl, 1) = ':' and btrim(rest) <> '' then ttl := rtrim(ttl, ': '); end if;
  return jsonb_build_object('t', ttl, 'b', coalesce(_sa_push_cut(nullif(btrim(rest), ''), 240), ''), 'm', m);
end; $$;

-- куда открыть приложение: go из первой кнопки со ссылкой (?go=… у кнопки мини-приложения, startapp=go_… у ссылки
-- t.me); у «Вопроса дня» (кнопки qd:…) — qday
create or replace function _sa_push_go(p_rows jsonb)
returns text language plpgsql immutable as $$
declare r jsonb; b jsonb; u text; g text; qd boolean := false;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then return null; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) <> 'array' then continue; end if;
    for b in select * from jsonb_array_elements(r) loop
      if jsonb_typeof(b) <> 'object' then continue; end if;
      if coalesce(b->>'callback_data', '') ~ '^qd:' then qd := true; end if;
      u := coalesce(b->'web_app'->>'url', b->>'url', '');
      g := substring(u from '[?&]go=([A-Za-z0-9_.:-]{1,90})');
      if g is null then g := substring(u from 'startapp=go_([A-Za-z0-9_.:-]{1,90})'); end if;
      if g is not null then return g; end if;
    end loop;
  end loop;
  return case when qd then 'qday' end;
end; $$;

-- сотрудник как _sa_caller (для «кто что видит» в чатах), по id
create or replace function _sa_push_emp_c(p_emp text)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('id', e.id::text, 'name', e.name, 'surname', coalesce(e.surname, ''),
    'who', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')), 'restaurant', e.restaurant,
    'position', lower(coalesce(e.position, '')), 'admin', coalesce(e.is_admin, false),
    'network', coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = 'senior',
    'lead', coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any(_sa_chat_lead_pos()))
  from employees e where e.id::text = p_emp and coalesce(e.status, 'active') = 'active' limit 1
$$;

-- число на иконке: непрочитанное во всех чатах человека (как chat_unread)
create or replace function _sa_push_badge(p_emp text)
returns int language plpgsql stable security definer set search_path to public as $$
declare c jsonb; rest text; n int;
begin
  c := _sa_push_emp_c(p_emp);
  if c is null then return null; end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return 0; end if;
  select coalesce(sum(_sa_chat_unread(x.id, p_emp)), 0)::int into n from sa_chats x
   where (x.restaurant = rest or (x.kind = 'net' and _sa_chat_multi())) and _sa_chat_ok(c, x);
  return n;
exception when others then return null;
end; $$;

-- последняя ошибка доставки (для экрана «Сервер»)
create or replace function _sa_push_err(p_text text)
returns void language sql security definer set search_path to public as $$
  insert into sa_settings (key, value) values ('push_err', left(coalesce(p_text, ''), 200)), ('push_err_at', now()::text)
    on conflict (key) do update set value = excluded.value, updated_at = now()
$$;

-- позвать функцию push-send: { items: [{ emp, t, b, go, badge }] }. Ключ anon (если руководитель его передал) — на
-- случай, если у функции включена проверка JWT
create or replace function _sa_push_post(p_items jsonb)
returns bigint language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare base text; sec text; ak text; hd jsonb; rid bigint;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then return null; end if;
  base := nullif(btrim(coalesce((select value from sa_settings where key = 'supabase_url'), '')), '');
  sec := (select value from sa_settings where key = 'push_secret');
  if base is null then perform _sa_push_err('no_url'); return null; end if;
  hd := jsonb_build_object('Content-Type', 'application/json', 'x-sa-push', coalesce(sec, ''));
  ak := nullif(btrim(coalesce((select value from sa_settings where key = 'anon_key'), '')), '');
  if ak is not null then hd := hd || jsonb_build_object('apikey', ak, 'Authorization', 'Bearer ' || ak); end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
      into rid using rtrim(base, '/') || '/functions/v1/push-send', jsonb_build_object('items', p_items), hd;
  exception when others then
    perform _sa_push_err('net: ' || sqlerrm);
    return null;
  end;
  return rid;
end; $$;

drop function if exists _sa_push_send(text[], text, text);   -- до Доп. 451 — без p_rows
-- Доп. 451: кнопки уведомления. У сообщения из переписки — «Ответить» и «Прочитано»; иначе — кнопки бота «Принято»
-- (опоздание), «Забрать» / «Выйду» (смена), «Иду» (вызов), не больше двух. → [{ a, t, id, c }] или null
create or replace function _sa_push_acts(p_rows jsonb, p_go text, p_m boolean)
returns jsonb language plpgsql immutable as $$
declare mm text[]; r jsonb; b jsonb; d text[]; out jsonb := '[]'::jsonb;
begin
  mm := regexp_match(coalesce(p_go, ''), '^chat_(\d{1,12})_(\d{1,15})$');
  if coalesce(p_m, false) and mm is not null then
    return jsonb_build_array(jsonb_build_object('a', 'reply', 't', 'Ответить', 'id', mm[2]::bigint, 'c', mm[1]::bigint),
                             jsonb_build_object('a', 'read', 't', 'Прочитано', 'id', mm[2]::bigint, 'c', mm[1]::bigint));
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then return null; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) <> 'array' then continue; end if;
    for b in select * from jsonb_array_elements(r) loop
      if jsonb_typeof(b) <> 'object' or jsonb_array_length(out) >= 2 then continue; end if;
      d := regexp_match(coalesce(b->>'callback_data', ''), '^(cl|ct|cg):(\d{1,18})$');
      if d is null then continue; end if;
      out := out || jsonb_build_array(jsonb_build_object('a', d[1], 'id', d[2]::bigint,
        't', coalesce(nullif(left(btrim(coalesce(b->>'text', '')), 24), ''), case d[1] when 'cl' then 'Принято' when 'ct' then 'Забрать' else 'Иду' end)));
    end loop;
  end loop;
  return case when jsonb_array_length(out) > 0 then out end;
end; $$;

-- «3 новых», «21 новое»
create or replace function _sa_push_new(n int)
returns text language sql immutable as $$
  select n || ' ' || case when n % 10 = 1 and n % 100 <> 11 then 'новое' else 'новых' end
$$;

-- уведомление этим сотрудникам на все их телефоны; → скольким людям. p_rows — кнопки сообщения бота (для кнопок
-- уведомления). Доп. 451: сообщение из переписки — с числом новых в заголовке, c — чат (одно уведомление на переписку),
-- касание — к ответу (go …_r); кнопки — с ключом k (sa_push_acts).
create or replace function _sa_push_send(p_emps text[], p_text text, p_go text default null, p_rows jsonb default null)
returns int language plpgsql security definer set search_path to public as $$
declare tx jsonb; items jsonb := '[]'::jsonb; e text; go text; c bigint; m boolean; n int; ttl text; acts jsonb; pub jsonb; k text; it jsonb;
begin
  tx := _sa_push_text(p_text);
  if tx is null or p_emps is null then return 0; end if;
  m := coalesce((tx->>'m')::boolean, false);
  go := coalesce(p_go, '');
  if m and go ~ '^chat_\d{1,12}(_\d{1,15})?$' then c := substring(go from '^chat_(\d+)')::bigint; end if;
  if m and go ~ '^chat_\d{1,12}_\d{1,15}$' then go := go || '_r'; end if;
  acts := _sa_push_acts(p_rows, p_go, m);
  if acts is not null then
    select jsonb_agg(jsonb_build_object('a', x->>'a', 't', x->>'t') order by o) into pub from jsonb_array_elements(acts) with ordinality y(x, o);
  end if;
  foreach e in array p_emps loop
    if e is null or not exists (select 1 from sa_push_subs s where s.emp_id = e) then continue; end if;
    ttl := tx->>'t';
    if c is not null then
      n := coalesce(_sa_chat_unread(c, e), 0);
      if n > 1 then ttl := _sa_push_cut(ttl, 64) || ' · ' || _sa_push_new(n); end if;
    end if;
    it := jsonb_build_object('emp', e, 't', ttl, 'b', tx->>'b', 'go', go, 'badge', _sa_push_badge(e));
    if c is not null then it := it || jsonb_build_object('c', c); end if;
    if acts is not null then
      k := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      insert into sa_push_acts (k, emp_id, acts) values (k, e, acts);
      it := it || jsonb_build_object('k', k, 'a', pub);
    end if;
    items := items || jsonb_build_array(it);
  end loop;
  if jsonb_array_length(items) = 0 then return 0; end if;
  perform _sa_push_post(items);
  return jsonb_array_length(items);
end; $$;

-- «чат» без Telegram: у кого нет связки с ботом, тому в tg_links — отрицательный номер (рассылки бота видят человека)
create or replace function _sa_push_link(p_emp text, p_rest text, p_name text)
returns void language plpgsql security definer set search_path to public as $$
declare ps bigint;
begin
  if p_emp is null or exists (select 1 from tg_links where emp_id = p_emp) then return; end if;
  insert into sa_push_people (emp_id) values (p_emp) on conflict (emp_id) do nothing;
  update sa_push_people set pseudo = coalesce(pseudo, -(9000000000000000 + nextval('sa_push_pseudo_seq'))), updated_at = now()
   where emp_id = p_emp returning pseudo into ps;
  insert into tg_links (emp_id, chat_id, tg_user, restaurant, full_name, remind, updated_at)
  values (p_emp, ps, jsonb_build_object('push', true), p_rest, p_name, true, now())
  on conflict (emp_id) do nothing;
end; $$;

-- телефонов у человека не осталось: «чат» без Telegram убирается; Telegram был выключен до телефона — снова молчит
create or replace function _sa_push_unlink(p_emp text)
returns void language plpgsql security definer set search_path to public as $$
declare pp sa_push_people;
begin
  if p_emp is null or exists (select 1 from sa_push_subs where emp_id = p_emp) then return; end if;
  delete from tg_links where emp_id = p_emp and _sa_push_is_pseudo(chat_id);
  select * into pp from sa_push_people where emp_id = p_emp;
  if pp.emp_id is null then return; end if;
  if pp.tg_off and pp.channel = 'push' then
    update tg_links set remind = false, updated_at = now() where emp_id = p_emp and not _sa_push_is_pseudo(chat_id);
  end if;
  update sa_push_people set channel = 'both', tg_off = false, updated_at = now() where emp_id = p_emp;
end; $$;

-- отвязали Telegram (tg_unlink, общий телефон), а телефон с уведомлениями есть — снова «чат» без Telegram
create or replace function _sa_push_tg_gone()
returns trigger language plpgsql security definer set search_path to public as $$
begin
  if not _sa_push_is_pseudo(old.chat_id) and exists (select 1 from sa_push_subs where emp_id = old.emp_id) then
    perform _sa_push_link(old.emp_id, old.restaurant, old.full_name);
  end if;
  return null;
exception when others then
  raise notice '_sa_push_tg_gone: %', sqlerrm;
  return null;
end; $$;
drop trigger if exists sa_push_tg_gone on tg_links;
create trigger sa_push_tg_gone after delete on tg_links for each row execute function _sa_push_tg_gone();

drop function if exists _sa_push_route(bigint, text, text);   -- до Доп. 451 — без p_rows
-- Доп. 451: бот написал в личный чат Telegram о переписке (go chat_<чат>[_<сообщение>]) — запомнить: просто текст боту в
-- ближайшие 30 минут уйдёт в эту переписку (sa_tg_update). Последнее сообщение бота — не о переписке (вопрос дня, смены…) —
-- забыть: просто текст снова получит подсказку
create or replace function _sa_push_tgmark(p_tg bigint, p_go text)
returns void language plpgsql security definer set search_path to public as $$
declare mm text[];
begin
  if p_tg is null or p_tg <= 0 then return; end if;   -- только личный чат с ботом (у групп номер меньше нуля)
  mm := regexp_match(coalesce(p_go, ''), '^chat_(\d{1,12})(?:_(\d{1,15}))?$');
  if mm is null then delete from sa_push_tglast where tg = p_tg; return; end if;
  insert into sa_push_tglast (tg, chat_id, msg_id, at) values (p_tg, mm[1]::bigint, mm[2]::bigint, now())
    on conflict (tg) do update set chat_id = excluded.chat_id, msg_id = excluded.msg_id, at = now();
exception when others then
  raise notice '_sa_push_tgmark: %', sqlerrm;
end; $$;

-- Куда это сообщение бота: на телефоны (кому надо — отправляет) и → писать ли в Telegram.
-- Ответ человеку на его же нажатие или сообщение в Telegram (вебхук, sa.tg_from) — только Telegram, как раньше.
-- p_rows — кнопки сообщения (Доп. 451: кнопки уведомления).
create or replace function _sa_push_route(p_chat bigint, p_text text, p_go text default null, p_rows jsonb default null)
returns boolean language plpgsql security definer set search_path to public as $$
declare ps boolean; emps text[]; pe text[];
begin
  if p_chat is null or coalesce(p_text, '') = '' then return true; end if;
  ps := _sa_push_is_pseudo(p_chat);
  if not ps and coalesce(current_setting('sa.tg_from', true), '') = p_chat::text then
    perform _sa_push_tgmark(p_chat, p_go);
    return true;
  end if;
  if ps then select array_agg(p.emp_id) into emps from sa_push_people p where p.pseudo = p_chat;
  else select array_agg(l.emp_id) into emps from tg_links l where l.chat_id = p_chat; end if;
  if emps is null then
    if ps then delete from tg_links where chat_id = p_chat; end if;
    return not ps;
  end if;
  select array_agg(distinct s.emp_id) into pe from sa_push_subs s left join sa_push_people pp on pp.emp_id = s.emp_id
   where s.emp_id = any(emps) and (ps or coalesce(pp.channel, 'both') <> 'tg');
  if pe is not null then perform _sa_push_send(pe, p_text, p_go, p_rows); end if;
  if ps then
    if pe is null then delete from tg_links where chat_id = p_chat; end if;   -- телефонов не осталось
    return false;
  end if;
  -- «только телефон»: Telegram молчит, если у всех этого чата так выбрано и телефон включён
  if pe is not null and not exists (select 1 from unnest(emps) x(e) left join sa_push_people pp on pp.emp_id = x.e
      where coalesce(pp.channel, 'both') <> 'push' or not (x.e = any(pe))) then return false; end if;
  perform _sa_push_tgmark(p_chat, p_go);
  return true;
exception when others then
  raise notice '_sa_push_route: %', sqlerrm;
  return not coalesce(ps, false);
end; $$;

-- ── 3) Отправка бота: та же, что в этапах 22б, 31 и 38, плюс телефон ─────────────────────────────────────────────
-- Сообщение в Telegram (асинхронно, через pg_net). p_go — куда открыть приложение: warmup | mentor.
create or replace function sa_tg_send(p_chat bigint, p_text text, p_button text default null, p_go text default null)
returns bigint language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare bot text; app text; botname text; body jsonb; btn jsonb; rid bigint;
begin
  if p_chat is null or coalesce(p_text, '') = '' then return null; end if;
  if not _sa_push_route(p_chat, p_text, p_go) then return null; end if;   -- этап 48: телефон; «только телефон» — Telegram молчит
  bot := _sa_tg_token();
  if bot is null then return null; end if;
  body := jsonb_build_object('chat_id', p_chat, 'text', p_text, 'disable_web_page_preview', true);
  if p_button is not null then
    app := nullif(btrim(coalesce((select value from sa_settings where key = 'app_url'), '')), '');
    botname := coalesce(nullif(btrim((select value from sa_settings where key = 'bot_username')), ''), 'SA_RestaurantBot');
    if app is not null then
      btn := jsonb_build_object('text', p_button, 'web_app', jsonb_build_object('url',
        rtrim(app, '/') || '/' || case when p_go is not null then '?go=' || p_go else '' end));
    else
      btn := jsonb_build_object('text', p_button, 'url',
        'https://t.me/' || botname || case when p_go is not null then '?startapp=go_' || p_go else '' end);
    end if;
    body := body || jsonb_build_object('reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(btn))));
  end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
      into rid using 'https://api.telegram.org/bot' || bot || '/sendMessage', body, '{"Content-Type": "application/json"}'::jsonb;
  exception when others then
    raise notice 'sa_tg_send: %', sqlerrm;
    return null;
  end;
  return rid;
end; $$;

-- вызов Bot API (сообщение с кнопками, правка сообщения, ответ на нажатие, вебхук): pg_net, токен — из Vault.
-- Этап 48: сообщение (sendMessage) — и на телефон
create or replace function sa_tg_api(p_method text, p_body jsonb)
returns bigint language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare bot text; rid bigint;
begin
  if p_method = 'sendMessage' and jsonb_typeof(p_body) = 'object' and coalesce(p_body->>'chat_id', '') ~ '^-?\d{1,19}$' then
    if not _sa_push_route((p_body->>'chat_id')::bigint, p_body->>'text', _sa_push_go(p_body->'reply_markup'->'inline_keyboard'), p_body->'reply_markup'->'inline_keyboard') then return null; end if;
  end if;
  bot := _sa_tg_token();
  if bot is null or coalesce(p_method, '') !~ '^[A-Za-z]{3,40}$' then return null; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
      into rid using 'https://api.telegram.org/bot' || bot || '/' || p_method, coalesce(p_body, '{}'::jsonb),
        '{"Content-Type": "application/json"}'::jsonb;
  exception when others then
    raise notice 'sa_tg_api: %', sqlerrm;
    return null;
  end;
  return rid;
end; $$;

-- сообщение бота: p_rows — ряды кнопок (callback_data разбирает sa_tg_update); p_extra — что ещё (ответ на сообщение).
-- Этап 48: и на телефон
create or replace function _sa_chat_tg(p_chat bigint, p_text text, p_rows jsonb, p_extra jsonb default null)
returns bigint language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare bot text; body jsonb; rid bigint;
begin
  if p_chat is null or coalesce(p_text, '') = '' then return null; end if;
  if not _sa_push_route(p_chat, p_text, _sa_push_go(p_rows), p_rows) then return null; end if;
  bot := _sa_tg_token();
  if bot is null then return null; end if;
  body := jsonb_build_object('chat_id', p_chat, 'text', left(p_text, 4000), 'disable_web_page_preview', true);
  if jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) > 0 then
    body := body || jsonb_build_object('reply_markup', jsonb_build_object('inline_keyboard', p_rows));
  end if;
  if jsonb_typeof(p_extra) = 'object' then body := body || p_extra; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
      into rid using 'https://api.telegram.org/bot' || bot || '/sendMessage', body, '{"Content-Type": "application/json"}'::jsonb;
  exception when others then
    raise notice '_sa_chat_tg: %', sqlerrm;
    return null;
  end;
  return rid;
end; $$;

-- Вебхук бота: sa_tg_update этапа 39 становится _sa_tg_update_core, сверху — обёртка: помечает, из какого чата Telegram
-- событие (ответы этому человеку — только в Telegram). Перезапустили этап 31, 38 или 39 — sa_tg_update снова «настоящая»:
-- она и становится ядром.
do $$
begin
  if position('_sa_tg_update_core' in pg_get_functiondef('public.sa_tg_update(text,jsonb)'::regprocedure)) = 0 then
    if to_regprocedure('public._sa_tg_update_core(text,jsonb)') is not null then
      drop function public._sa_tg_update_core(text, jsonb);
    end if;
    alter function public.sa_tg_update(text, jsonb) rename to _sa_tg_update_core;
  end if;
end $$;
create or replace function sa_tg_update(p_secret text, p_update jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare want text; cq jsonb; msg jsonb; mt text; tgc bigint; c jsonb; ql sa_push_tglast;
begin
  perform set_config('sa.tg_from', coalesce(p_update->'message'->'chat'->>'id', p_update->'edited_message'->'chat'->>'id',
    p_update->'callback_query'->'message'->'chat'->>'id', p_update->'callback_query'->'from'->>'id', ''), true);
  -- Доп. 451: «Отменить» и просто текст после сообщения о переписке — здесь; остальное — как было (ядро)
  select value into want from sa_settings where key = 'tg_webhook_secret';
  if coalesce(want, '') <> '' and coalesce(p_secret, '') = want and jsonb_typeof(p_update) = 'object' then
    cq := p_update->'callback_query';
    if jsonb_typeof(cq) = 'object' and coalesce(cq->>'data', '') ~ '^cu:\d{1,18}$' then
      insert into sa_settings (key, value) values ('tg_last_update', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
        on conflict (key) do update set value = excluded.value, updated_at = now();
      return _sa_push_tg_undo(cq);
    end if;
    msg := p_update->'message';
    if jsonb_typeof(msg) = 'object' and jsonb_typeof(msg->'reply_to_message') is distinct from 'object'
       and coalesce(msg->'chat'->>'type', '') = 'private' and coalesce(msg->'chat'->>'id', '') ~ '^\d{1,18}$' then
      mt := btrim(coalesce(msg->>'text', ''));
      tgc := (msg->'chat'->>'id')::bigint;
      if mt <> '' and left(mt, 1) <> '/' and not _sa_tg_is_shifts(mt) then
        select * into ql from sa_push_tglast where tg = tgc and at > now() - interval '30 minutes';
        if ql.tg is not null then c := _sa_tg_caller(msg->'from'->>'id'); end if;
        if c is not null then
          insert into sa_settings (key, value) values ('tg_last_update', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
            on conflict (key) do update set value = excluded.value, updated_at = now();
          return _sa_push_tg_quick(msg, c, ql);
        end if;
      end if;
    end if;
  end if;
  return _sa_tg_update_core(p_secret, p_update);
end; $$;

-- ── Доп. 451: ответ прямо из уведомления и из Telegram ───────────────────────────────────────────────────────────
-- как назвать переписку в ответе бота: «Ушло в «Вся команда».»
create or replace function _sa_push_place(ch sa_chats)
returns text language sql stable as $$
  select case ch.kind when 'team' then '«Вся команда»' when 'leads' then '«Старшие»' when 'net' then '«Руководители сети»'
    when 'group' then '«' || coalesce(ch.title, 'Чат') || '»' else 'личную переписку' end
$$;

-- написать в переписку от имени сотрудника (как chat_send): в группе — ответом на сообщение, о котором было уведомление
-- (не на своё), в личной — просто сообщением. → { ok, id, place } или { ok: false, error }
create or replace function _sa_push_say(c jsonb, ch sa_chats, p_text text, p_about bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare body text; q bigint; m sa_chat_msgs;
begin
  if c is null or ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  body := left(btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), E'\r\n?', E'\n', 'g'), E'\n{3,}', E'\n\n', 'g')), 1000);
  if body = '' then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  if (select count(*) from sa_chat_msgs x where x.emp_id = c->>'id' and x.created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  if ch.kind <> 'dm' and p_about is not null then
    q := _sa_chat_reply_ok(ch, p_about);
    if q is not null and exists (select 1 from sa_chat_msgs x where x.id = q and x.emp_id = c->>'id') then q := null; end if;
  end if;
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, reply_to)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), body, q) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  perform _sa_chat_notify(c, ch, m);
  return jsonb_build_object('ok', true, 'id', m.id, 'place', _sa_push_place(ch));
end; $$;

-- кнопка в уведомлении (функция push-send, ?act=1; только служба). p_key — ключ уведомления, p_action — какая кнопка
-- (reply | read | cl | ct | cg), p_text — ответ. Ключ — один раз и три дня. → { ok, text — что показать на телефоне, badge }
create or replace function sa_push_act(p_key text, p_action text, p_text text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare pa sa_push_acts; x jsonb; c jsonb; ch sa_chats; m sa_chat_msgs; r jsonb; ok boolean; txt text; top bigint;
begin
  if coalesce(p_key, '') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'error', 'bad_key'); end if;
  select * into pa from sa_push_acts where k = p_key for update;
  if pa.k is null or pa.created_at < now() - interval '3 days' then return jsonb_build_object('ok', false, 'error', 'gone'); end if;
  if pa.used_at is not null then return jsonb_build_object('ok', false, 'error', 'used'); end if;
  select a into x from jsonb_array_elements(pa.acts) a where a->>'a' = coalesce(p_action, '') limit 1;
  if x is null then return jsonb_build_object('ok', false, 'error', 'bad_action'); end if;
  c := _sa_push_emp_c(pa.emp_id);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_action = 'reply' then
    select * into ch from sa_chats where id = (x->>'c')::bigint;
    r := _sa_push_say(c, ch, p_text, (x->>'id')::bigint);
    if not coalesce((r->>'ok')::boolean, false) then return r; end if;   -- ключ не тратится: пусто — откроется приложение
    txt := 'Ушло в ' || (r->>'place') || '.';
  elsif p_action = 'read' then
    select * into ch from sa_chats where id = (x->>'c')::bigint;
    if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    select max(id) into top from sa_chat_msgs where chat_id = ch.id;
    -- прочитано до последнего; «в чате сейчас» (at) не трогаем: следующее сообщение придёт уведомлением
    insert into sa_chat_reads (chat_id, emp_id, last_id, at) values (ch.id, pa.emp_id, coalesce(top, 0), now() - interval '1 day')
      on conflict (chat_id, emp_id) do update set last_id = greatest(sa_chat_reads.last_id, excluded.last_id);
  else
    select * into m from sa_chat_msgs where id = (x->>'id')::bigint;
    if m.id is not null then select * into ch from sa_chats where id = m.chat_id; end if;
    if m.id is null or m.deleted or ch.id is null or not _sa_chat_ok(c, ch) then
      return jsonb_build_object('ok', false, 'error', 'not_found', 'text', 'Этого сообщения в чате уже нет.');
    end if;
    if p_action = 'cl' then
      if coalesce(m.card->>'t', '') <> 'late' or not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
      r := _sa_late_ok_do(c, ch, m);
      txt := case when coalesce((r->>'again')::boolean, false) then 'Уже приняли: ' || coalesce(nullif(m.card->'ok'->>'name', ''), 'руководитель') || '.' else 'Принято.' end;
    elsif p_action = 'ct' then
      r := _sa_sh_take_do(c, m.id);
      ok := coalesce((r->>'ok')::boolean, false);
      txt := case when ok and m.card->>'mode' = 'need' then 'Ты выходишь в эту смену. График обновлён.'
        when ok then 'Смена твоя. График обновлён.'
        when r->>'error' = 'taken' then case when m.card->>'mode' = 'need' then 'Уже нашли, кто выйдет.' else 'Смену уже забрали.' end
        when r->>'error' = 'not_allowed' then coalesce(nullif(regexp_replace(coalesce(r->>'why', ''), '\.?$', '.'), '.'), 'Эту смену взять нельзя.')
        when r->>'error' = 'no_schedule' then 'График смен ещё не заполнен.'
        else 'Не получилось. Открой чат.' end;
    else
      if m.kind <> 'call' or m.emp_id = c->>'id' then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
      m := _sa_chat_go_do(c, m);
      txt := 'Ты идёшь.';
    end if;
  end if;
  update sa_push_acts set used_at = now() where k = pa.k;
  return jsonb_build_object('ok', true, 'text', txt, 'badge', _sa_push_badge(pa.emp_id));
end; $$;

-- просто текст боту в ближайшие 30 минут после сообщения о переписке: в эту переписку; бот отвечает «Ушло в «…».» с
-- кнопками «Отменить» и «Открыть чат»
create or replace function _sa_push_tg_quick(p_msg jsonb, c jsonb, ql sa_push_tglast)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare tgc bigint; ch sa_chats; r jsonb;
begin
  tgc := (p_msg->'chat'->>'id')::bigint;
  select * into ch from sa_chats where id = ql.chat_id;
  r := _sa_push_say(c, ch, p_msg->>'text', ql.msg_id);
  if not coalesce((r->>'ok')::boolean, false) then
    if r->>'error' = 'not_found' then
      delete from sa_push_tglast where tg = tgc;
      perform _sa_chat_tg(tgc, 'Этого чата у тебя больше нет.', null);
    elsif r->>'error' = 'too_fast' then
      perform _sa_chat_tg(tgc, 'Слишком часто. Подожди минуту.', null);
    end if;
    return jsonb_build_object('ok', true, 'skip', coalesce(r->>'error', 'quick'));
  end if;
  perform _sa_chat_tg(tgc, 'Ушло в ' || (r->>'place') || '.', jsonb_build_array(jsonb_build_array(
      jsonb_build_object('text', 'Отменить', 'callback_data', 'cu:' || (r->>'id')), _sa_chat_tg_open(ch.id, (r->>'id')::bigint))),
    jsonb_build_object('reply_parameters', jsonb_build_object('message_id', p_msg->'message_id', 'allow_sending_without_reply', true)));
  return jsonb_build_object('ok', true, 'sent', (r->>'id')::bigint, 'chat', ch.id, 'quick', true);
end; $$;

-- «Отменить» (cu:<сообщение>): своё сообщение, не позже 10 минут — стирается, как «Удалить» в приложении
create or replace function _sa_push_tg_undo(cq jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare mm text[]; c jsonb; m sa_chat_msgs; msg jsonb; ok boolean := false;
begin
  mm := regexp_match(coalesce(cq->>'data', ''), '^cu:(\d{1,18})$');
  c := _sa_tg_caller(cq->'from'->>'id');
  if mm is not null then select * into m from sa_chat_msgs where id = mm[1]::bigint; end if;
  if c is not null and m.id is not null and not m.deleted and m.emp_id = c->>'id' and m.created_at > now() - interval '10 minutes' then
    update sa_chat_msgs set deleted = true, body = '', photo = null, updated_at = now() where id = m.id;
    delete from sa_chat_reacts where msg_id = m.id;
    update sa_chats set pin_id = null where id = m.chat_id and pin_id = m.id;
    ok := true;
  end if;
  msg := cq->'message';
  if ok and jsonb_typeof(msg) = 'object' and msg->'chat'->>'id' is not null and msg->>'message_id' is not null then
    perform _sa_chat_tg_api('editMessageText', jsonb_build_object('chat_id', msg->'chat'->'id', 'message_id', msg->'message_id',
      'text', 'Отменено: в чат не ушло.', 'reply_markup', jsonb_build_object('inline_keyboard', '[]'::jsonb)));
  end if;
  perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id',
    'text', case when ok then 'Отменено' when m.id is not null and m.deleted then 'Уже отменено' else 'Отменить уже нельзя: прошло больше 10 минут' end));
  return jsonb_build_object('ok', true, 'undo', ok);
end; $$;

-- ── 4) Приложение ───────────────────────────────────────────────────────────────────────────────────────────────
-- что включено у меня (p_endpoint — подписка этого телефона); руководителю — ещё и сервер
create or replace function _sa_push_state(c jsonb, p_endpoint text default null)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare me text; res jsonb;
begin
  me := c->>'id';
  res := jsonb_build_object('ok', true,
    'key', nullif(btrim(coalesce((select value from sa_settings where key = 'push_vapid_pub'), '')), ''),
    'bot', _sa_tg_token() is not null,
    'n', (select count(*) from sa_push_subs where emp_id = me),
    'here', coalesce(p_endpoint, '') <> '' and exists (select 1 from sa_push_subs where emp_id = me and endpoint = p_endpoint),
    'channel', coalesce((select channel from sa_push_people where emp_id = me), 'both'),
    'tg', exists (select 1 from tg_links where emp_id = me and not _sa_push_is_pseudo(chat_id) and remind),
    'tg_linked', exists (select 1 from tg_links where emp_id = me and not _sa_push_is_pseudo(chat_id)),
    'pseudo', exists (select 1 from tg_links where emp_id = me and _sa_push_is_pseudo(chat_id)));
  if coalesce((c->>'admin')::boolean, false) then
    res := res || jsonb_build_object('srv', jsonb_build_object(
      'subs', (select count(*) from sa_push_subs), 'people', (select count(distinct emp_id) from sa_push_subs),
      'pseudo', (select count(*) from tg_links l join employees e on e.id::text = l.emp_id
                  where _sa_push_is_pseudo(l.chat_id) and coalesce(l.remind, false) and coalesce(e.status, 'active') = 'active'),
      'ok_at', (select value from sa_settings where key = 'push_ok_at'),
      'err', (select value from sa_settings where key = 'push_err'), 'err_at', (select value from sa_settings where key = 'push_err_at'),
      'url', exists (select 1 from sa_settings where key = 'supabase_url' and btrim(coalesce(value, '')) <> '')));
  end if;
  return res;
end; $$;

-- p_url — адрес Supabase, p_key — ключ anon: только у руководителя (туда база зовёт push-send; адрес так же
-- записывает экран «Сервер»)
create or replace function push_status(p_token text, p_endpoint text default null, p_url text default null, p_key text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if coalesce((c->>'admin')::boolean, false) then
    if coalesce(p_url, '') ~ '^https://[a-z0-9-]{3,64}\.supabase\.co/?$' then
      insert into sa_settings (key, value) values ('supabase_url', rtrim(p_url, '/'))
        on conflict (key) do update set value = excluded.value, updated_at = now();
    end if;
    if coalesce(p_key, '') ~ '^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$' and char_length(p_key) <= 2000 then
      insert into sa_settings (key, value) values ('anon_key', p_key)
        on conflict (key) do update set value = excluded.value, updated_at = now();
    end if;
  end if;
  return _sa_push_state(c, p_endpoint);
end; $$;

-- включить на этом телефоне: p_sub — PushSubscription.toJSON() ({ endpoint, keys: { p256dh, auth } })
create or replace function push_subscribe(p_token text, p_sub jsonb, p_ua text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; me text; ep text; k1 text; k2 text; other text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if jsonb_typeof(p_sub) is distinct from 'object' then return jsonb_build_object('ok', false, 'error', 'bad_sub'); end if;
  ep := p_sub->>'endpoint'; k1 := p_sub->'keys'->>'p256dh'; k2 := p_sub->'keys'->>'auth';
  if coalesce(ep, '') !~ '^https://[^\s"<>]{8,}$' or char_length(ep) > 800 or coalesce(k1, '') !~ '^[A-Za-z0-9_+/-]{80,100}={0,2}$' or coalesce(k2, '') !~ '^[A-Za-z0-9_+/-]{16,32}={0,2}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_sub');
  end if;
  me := c->>'id';
  -- общий телефон: подписка — у того, кто вошёл
  for other in delete from sa_push_subs where endpoint = ep and emp_id <> me returning emp_id loop
    perform _sa_push_unlink(other);
  end loop;
  insert into sa_push_subs (emp_id, endpoint, p256dh, auth, ua) values (me, ep, k1, k2, left(nullif(btrim(coalesce(p_ua, '')), ''), 200))
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, fails = 0, err = null;
  -- не больше пяти телефонов: самые старые уходят
  delete from sa_push_subs where id in (select id from sa_push_subs where emp_id = me order by created_at desc, id desc offset 5);
  insert into sa_push_people (emp_id) values (me) on conflict (emp_id) do nothing;
  -- напоминания в Telegram были выключены: теперь приходит только на телефон, Telegram молчит, как раньше
  update tg_links set remind = true, updated_at = now() where emp_id = me and not _sa_push_is_pseudo(chat_id) and not coalesce(remind, false);
  if found then update sa_push_people set channel = 'push', tg_off = true, updated_at = now() where emp_id = me; end if;
  perform _sa_push_link(me, c->>'restaurant', c->>'who');
  return _sa_push_state(c, ep);
end; $$;

create or replace function push_unsubscribe(p_token text, p_endpoint text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from sa_push_subs where emp_id = c->>'id' and endpoint = coalesce(p_endpoint, '');
  perform _sa_push_unlink(c->>'id');
  return _sa_push_state(c, null);
end; $$;

-- где получать: both — Telegram и телефон, push — только телефон, tg — только Telegram
create or replace function push_channel(p_token text, p_channel text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; me text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if coalesce(p_channel, '') not in ('both', 'push', 'tg') then return jsonb_build_object('ok', false, 'error', 'bad_channel'); end if;
  me := c->>'id';
  if p_channel = 'push' and not exists (select 1 from sa_push_subs where emp_id = me) then return jsonb_build_object('ok', false, 'error', 'no_subs'); end if;
  if p_channel <> 'push' then
    update tg_links set remind = true, updated_at = now() where emp_id = me and not _sa_push_is_pseudo(chat_id) and not coalesce(remind, false);
  end if;
  insert into sa_push_people (emp_id, channel) values (me, p_channel)
    on conflict (emp_id) do update set channel = excluded.channel, tg_off = case when excluded.channel = 'push' then sa_push_people.tg_off else false end, updated_at = now();
  return _sa_push_state(c, null);
end; $$;

-- пробное уведомление себе (не чаще раза в 15 секунд)
create or replace function push_test(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; me text; n int; was timestamptz;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  me := c->>'id';
  select count(*) into n from sa_push_subs where emp_id = me;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'no_subs'); end if;
  if not exists (select 1 from sa_settings where key = 'supabase_url' and btrim(coalesce(value, '')) <> '') then
    return jsonb_build_object('ok', false, 'error', 'no_url');
  end if;
  select test_at into was from sa_push_people where emp_id = me;
  if was is not null and was > now() - interval '15 seconds' then return jsonb_build_object('ok', false, 'error', 'often'); end if;
  insert into sa_push_people (emp_id, test_at) values (me, now()) on conflict (emp_id) do update set test_at = now();
  perform _sa_push_send(array[me], 'Уведомления работают' || E'\n' || 'Так будут приходить сообщения: чат, смены, вопрос дня.', 'remind');
  return jsonb_build_object('ok', true, 'n', n);
end; $$;

-- ── 5) Для функции push-send (только служба) ────────────────────────────────────────────────────────────────────
-- подписи VAPID, что функция уже сделала: { «https://web.push.apple.com»: { t, at, k } } (Доп. 451)
create or replace function _sa_push_jwt()
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v text; j jsonb;
begin
  select value into v from sa_settings where key = 'push_jwt';
  if coalesce(v, '') !~ '^\{' then return '{}'::jsonb; end if;
  j := v::jsonb;
  return case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end;
exception when others then return '{}'::jsonb;
end; $$;

-- ключи и подписки этих людей; p_secret — тот, с которым база позвала функцию
create or replace function sa_push_take(p_secret text, p_emps text[])
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare want text;
begin
  select value into want from sa_settings where key = 'push_secret';
  if want is null or p_secret is distinct from want then return jsonb_build_object('ok', false, 'error', 'secret'); end if;
  return jsonb_build_object('ok', true,
    'pub', (select value from sa_settings where key = 'push_vapid_pub'),
    'priv', (select value from sa_settings where key = 'push_vapid_priv'),
    'sub', coalesce(nullif(btrim((select value from sa_settings where key = 'app_url')), ''), nullif(btrim((select value from sa_settings where key = 'supabase_url')), '')),
    'url', nullif(btrim(coalesce((select value from sa_settings where key = 'supabase_url'), '')), ''),   -- куда телефону нажимать кнопки
    'jwt', _sa_push_jwt(),
    'subs', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'emp', s.emp_id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth) order by s.id)
      from sa_push_subs s where s.emp_id = any(coalesce(p_emps, '{}'::text[]))), '[]'::jsonb));
end; $$;

-- ключи VAPID: записать, если их ещё нет (функция создаёт их при первом запуске); → открытый ключ, что в базе
create or replace function sa_push_keys(p_pub text, p_priv text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
begin
  if not exists (select 1 from sa_settings where key = 'push_vapid_pub' and btrim(coalesce(value, '')) <> '') then
    if coalesce(p_pub, '') !~ '^[A-Za-z0-9_-]{86,88}$' or coalesce(p_priv, '') !~ '^[A-Za-z0-9_-]{42,44}$' then
      return jsonb_build_object('ok', false, 'error', 'bad_keys');
    end if;
    insert into sa_settings (key, value) values ('push_vapid_priv', p_priv) on conflict (key) do update set value = excluded.value, updated_at = now();
    insert into sa_settings (key, value) values ('push_vapid_pub', p_pub) on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'pub', (select value from sa_settings where key = 'push_vapid_pub'));
end; $$;

drop function if exists sa_push_done(text, jsonb);   -- до Доп. 451 — без p_jwt
-- как прошла отправка: [{ id, ok, gone, code, err }]; подписки, которой больше нет (404, 410), нет и у нас.
-- p_jwt — подписи VAPID, если функция сделала новые (Доп. 451: не чаще раза в 6 часов на службу)
create or replace function sa_push_done(p_secret text, p_res jsonb, p_jwt jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare want text; r jsonb; e text; n_ok int := 0; n_gone int := 0; n_bad int := 0; last_err text;
begin
  select value into want from sa_settings where key = 'push_secret';
  if want is null or p_secret is distinct from want then return jsonb_build_object('ok', false, 'error', 'secret'); end if;
  if jsonb_typeof(p_res) is distinct from 'array' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  for r in select * from jsonb_array_elements(p_res) loop
    if jsonb_typeof(r) <> 'object' or coalesce(r->>'id', '') !~ '^\d{1,18}$' then continue; end if;
    if coalesce(r->>'gone', '') = 'true' then
      e := null;
      delete from sa_push_subs where id = (r->>'id')::bigint returning emp_id into e;
      if e is not null then perform _sa_push_unlink(e); end if;
      n_gone := n_gone + 1;
    elsif coalesce(r->>'ok', '') = 'true' then
      update sa_push_subs set ok_at = now(), fails = 0, err = null where id = (r->>'id')::bigint;
      n_ok := n_ok + 1;
    else
      last_err := left(coalesce(nullif(r->>'err', ''), 'ошибка') || case when r->>'code' is not null then ' (код ' || (r->>'code') || ')' else '' end, 200);
      update sa_push_subs set fails = fails + 1, err = last_err where id = (r->>'id')::bigint;
      n_bad := n_bad + 1;
    end if;
  end loop;
  -- двадцать неудач подряд: телефон не отвечает, подписка уходит
  for e in delete from sa_push_subs where fails >= 20 returning emp_id loop perform _sa_push_unlink(e); end loop;
  if n_ok > 0 then
    insert into sa_settings (key, value) values ('push_ok_at', now()::text) on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  if n_bad > 0 then perform _sa_push_err(last_err); end if;
  if jsonb_typeof(p_jwt) = 'object' and char_length(p_jwt::text) <= 20000 then
    insert into sa_settings (key, value) values ('push_jwt', p_jwt::text) on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  -- старые кнопки уведомлений и отметки «о какой переписке писал бот»
  delete from sa_push_acts where created_at < now() - interval '3 days';
  delete from sa_push_tglast where at < now() - interval '1 day';
  return jsonb_build_object('ok', true, 'sent', n_ok, 'gone', n_gone, 'failed', n_bad);
end; $$;

-- для shift-reminder («Завтра смена»): на телефон и → писать ли в Telegram
create or replace function sa_push_tg(p_chat bigint, p_text text, p_go text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
begin
  return jsonb_build_object('ok', true, 'tg', _sa_push_route(p_chat, p_text, p_go));
end; $$;

-- ── 6) Права ───────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function _sa_push_is_pseudo(bigint), _sa_push_cut(text, int), _sa_push_cap(text), _sa_push_text(text), _sa_push_go(jsonb), _sa_push_emp_c(text),
  _sa_push_badge(text), _sa_push_err(text), _sa_push_post(jsonb), _sa_push_acts(jsonb, text, boolean), _sa_push_new(int), _sa_push_send(text[], text, text, jsonb),
  _sa_push_link(text, text, text), _sa_push_unlink(text), _sa_push_tg_gone(), _sa_push_tgmark(bigint, text), _sa_push_route(bigint, text, text, jsonb),
  _sa_push_state(jsonb, text), sa_tg_send(bigint, text, text, text), sa_tg_api(text, jsonb), _sa_chat_tg(bigint, text, jsonb, jsonb),
  _sa_tg_update_core(text, jsonb), sa_tg_update(text, jsonb), _sa_push_place(sa_chats), _sa_push_say(jsonb, sa_chats, text, bigint), sa_push_act(text, text, text),
  _sa_push_tg_quick(jsonb, jsonb, sa_push_tglast), _sa_push_tg_undo(jsonb), _sa_push_jwt(), sa_push_take(text, text[]), sa_push_keys(text, text),
  sa_push_done(text, jsonb, jsonb), sa_push_tg(bigint, text, text)
  from public, anon, authenticated;
revoke all on function push_status(text, text, text, text), push_subscribe(text, jsonb, text), push_unsubscribe(text, text), push_channel(text, text), push_test(text) from public;
grant execute on function push_status(text, text, text, text), push_subscribe(text, jsonb, text), push_unsubscribe(text, text), push_channel(text, text), push_test(text)
  to anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function sa_tg_update(text, jsonb), sa_push_take(text, text[]), sa_push_keys(text, text), sa_push_done(text, jsonb, jsonb), '
      || 'sa_push_tg(bigint, text, text), sa_push_act(text, text, text) to service_role';
  end if;
end $$;

notify pgrst, 'reload schema';

select 'уведомления на телефон: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('push_status', 'push_subscribe', 'push_unsubscribe', 'push_channel', 'push_test', 'sa_push_take', 'sa_push_keys', 'sa_push_done', 'sa_push_tg',
                       'sa_push_act')) || ' функций из 10' ||
  ' · бот: ' || case when position('_sa_push_route' in pg_get_functiondef('public.sa_tg_send(bigint,text,text,text)'::regprocedure)) > 0
     and position('_sa_tg_update_core' in pg_get_functiondef('public.sa_tg_update(text,jsonb)'::regprocedure)) > 0 then 'пишет и на телефон' else 'нет' end ||
  ' · адрес Supabase: ' || case when exists (select 1 from sa_settings where key = 'supabase_url' and btrim(coalesce(value, '')) <> '') then 'есть'
     else 'нет (открой в приложении «Команда» → «Сервер»)' end ||
  ' · телефонов: ' || (select count(*) from sa_push_subs) as result;
