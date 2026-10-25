-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 31 (v81, Доп. 394): «Вопрос дня» в Telegram — с кнопками ответа прямо в чате.
--
-- Как это устроено:
--   • приложение раз в день кладёт на сервер очередь своих вопросов (до 7): сначала ошибки, которые пора
--     повторить, потом вопросы из пройденных тем своей роли — qday_push. Сервер содержимое уроков не хранит:
--     вопрос всегда тот, который человек видит в приложении;
--   • в 12:00 по часам заведения (ключ qday_hour в sa_settings) бот присылает следующий вопрос: текст,
--     варианты «А.», «Б.»… и кнопки с буквами — sa_qday_tick (pg_cron, раз в 10 минут);
--   • нажатие кнопки Telegram присылает в функцию tg-bot (вебхук) → sa_tg_update: ответ записан (один раз,
--     только из того же чата), сообщение дополняется итогом и разбором, внизу — кнопка в приложение;
--   • приложение забирает ответы — qday_inbox: ошибка из Telegram попадает в «Работу над ошибками», верный
--     ответ на вопрос из банка ошибок продвигает его повтор.
-- Присылать ли — каждый решает сам: «Смена» → «Напоминания в Telegram» → «Вопрос дня» (вид qday в notify_prefs).
--
-- Нужны этапы 21 (_sa_caller), 22б (бот: tg_links, токен в Vault), 24 (_sa_tz) и 25 (настройки сообщений).
-- Этап 26 — по желанию. Ничего не удаляет. Можно запускать повторно.
--
-- ПОСЛЕ ЗАПУСКА — подключить вебхук бота (один раз; подробно — supabase/README.md, «Этап 31»):
--   1) развернуть функцию tg-bot с выключенной проверкой JWT (Telegram не присылает ключ Supabase);
--   2) здесь же: select sa_tg_setup_code();  — одноразовый код на 30 минут;
--   3) открыть в браузере https://<проект>.supabase.co/functions/v1/tg-bot?setup=<код>.
-- Функция сама проверит, что у бота нет чужого вебхука (чужой не трогает), и подключит свой — с секретом:
-- запросы не от Telegram сервер не примет.
-- Проверка без отправки: select sa_qday_preview();  или на заданное время: select sa_qday_preview('2026-10-23 00:05+00');
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is null then
    raise exception 'Сначала этап 22б (supabase-stage22b-telegram-reminders.sql): нужен бот — таблица tg_links и sa_tg_send';
  end if;
  if to_regprocedure('public._sa_tz(text)') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужен часовой пояс заведения _sa_tz';
  end if;
  if to_regclass('public.sa_notify_prefs') is null or to_regprocedure('public._sa_tg_chat(text,text)') is null then
    raise exception 'Сначала этап 25 (supabase-stage25-live.sql): нужны настройки сообщений sa_notify_prefs и _sa_tg_chat';
  end if;
end $$;

-- ── 1) Таблица и настройки ─────────────────────────────────────────────────────
create table if not exists sa_qday (
  id          bigserial primary key,
  emp_id      text not null,
  restaurant  text,
  k           text not null,               -- ключ вопроса (приложение считает его по тексту вопроса)
  item        jsonb not null,              -- { q, o: [варианты], c: номер верного, e: разбор, t: урок, r: роль }
  ord         int not null default 0,      -- порядок в очереди
  queued_at   timestamptz not null default now(),
  sent_day    date,                        -- день отправки по часам заведения (null — ещё в очереди)
  sent_at     timestamptz,
  chat_id     bigint,                      -- куда ушёл: ответ принимается только из этого чата
  answer      int,
  correct     boolean,
  answered_at timestamptz
);
create index if not exists sa_qday_emp on sa_qday (emp_id, sent_day);
alter table sa_qday enable row level security;
revoke all on table sa_qday from public, anon, authenticated;
revoke all on sequence sa_qday_id_seq from public, anon, authenticated;

alter table sa_notify_prefs add column if not exists master boolean not null default true;   -- этап 26 (если не запускали)
alter table sa_notify_prefs add column if not exists qday boolean not null default true;

insert into sa_settings (key, value) values ('qday_hour', '12') on conflict (key) do nothing;

-- ── 2) Служебное ───────────────────────────────────────────────────────────────
-- час «Вопроса дня» по часам заведения: 6…22, иначе 12
create or replace function _sa_qday_hour()
returns int language plpgsql stable security definer set search_path to public as $$
declare v text; h int;
begin
  select value into v from sa_settings where key = 'qday_hour';
  v := btrim(coalesce(v, ''));
  if v ~ '^\d{1,2}$' then h := v::int; end if;
  if h is null or h < 6 or h > 22 then h := 12; end if;
  return h;
end; $$;

-- вызов Bot API (сообщение с кнопками, правка сообщения, ответ на нажатие, вебхук): pg_net, токен — из Vault
create or replace function sa_tg_api(p_method text, p_body jsonb)
returns bigint language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare bot text; rid bigint;
begin
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

-- кнопка «в приложение» — как у sa_tg_send: web_app по адресу приложения, иначе ссылка t.me/<бот>?startapp=go_…
create or replace function _sa_tg_app_kb(p_text text, p_go text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare app text; botname text; btn jsonb;
begin
  app := nullif(btrim(coalesce((select value from sa_settings where key = 'app_url'), '')), '');
  botname := coalesce(nullif(btrim((select value from sa_settings where key = 'bot_username')), ''), 'SA_RestaurantBot');
  if app is not null then
    btn := jsonb_build_object('text', p_text, 'web_app', jsonb_build_object('url',
      rtrim(app, '/') || '/' || case when p_go is not null then '?go=' || p_go else '' end));
  else
    btn := jsonb_build_object('text', p_text, 'url',
      'https://t.me/' || botname || case when p_go is not null then '?startapp=go_' || p_go else '' end);
  end if;
  return jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(btn)));
end; $$;

-- буква варианта
create or replace function _sa_qday_letter(n int)
returns text language sql immutable as $$
  select (array['А','Б','В','Г'])[n + 1]
$$;

-- текст вопроса: «Вопрос дня · роль», вопрос, варианты с буквами
create or replace function _sa_qday_text(p_item jsonb)
returns text language plpgsql stable security definer set search_path to public as $$
declare t text; i int; n int;
begin
  t := 'Вопрос дня' || case when coalesce(p_item->>'r', '') <> '' then ' · ' || (p_item->>'r') else '' end
    || E'\n\n' || coalesce(p_item->>'q', '') || E'\n';
  n := coalesce(jsonb_array_length(p_item->'o'), 0);
  for i in 0 .. n - 1 loop
    t := t || E'\n' || _sa_qday_letter(i) || '. ' || coalesce(p_item->'o'->>i, '');
  end loop;
  return t;
end; $$;

-- кнопки-буквы: callback_data «qd:<номер вопроса>:<вариант>»
create or replace function _sa_qday_kb(p_id bigint, p_n int)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare row_ jsonb := '[]'::jsonb; i int;
begin
  for i in 0 .. greatest(0, least(p_n, 4)) - 1 loop
    row_ := row_ || jsonb_build_object('text', _sa_qday_letter(i), 'callback_data', 'qd:' || p_id || ':' || i);
  end loop;
  return jsonb_build_object('inline_keyboard', jsonb_build_array(row_));
end; $$;

-- ── 3) Очередь от приложения ───────────────────────────────────────────────────
-- p_items — массив до 7 вопросов { k, q, o, c, e, t, r }. Очередь заменяется целиком (неотправленные — новые);
-- вопрос, который уже уходил за последние 14 дней, повторно не встаёт; мусор и лишнее отбрасываются.
create or replace function qday_push(p_token text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; it jsonb; v_k text; v_q text; v_o jsonb; v_c int; v_ok boolean; i int; n int := 0; v_emp text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  v_emp := c->>'id';
  delete from sa_qday where emp_id = v_emp and sent_day is null;
  delete from sa_qday where emp_id = v_emp and sent_day < current_date - 60;   -- старые ответы больше не нужны
  for it in select value from jsonb_array_elements(p_items) loop
    exit when n >= 7;
    if jsonb_typeof(it) <> 'object' then continue; end if;
    v_k := left(btrim(coalesce(it->>'k', '')), 80);
    v_q := left(btrim(coalesce(it->>'q', '')), 400);
    v_o := it->'o';
    if v_k = '' or v_q = '' or v_o is null or jsonb_typeof(v_o) <> 'array' or jsonb_array_length(v_o) not between 2 and 4 then continue; end if;
    v_ok := true;
    for i in 0 .. jsonb_array_length(v_o) - 1 loop
      if jsonb_typeof(v_o->i) <> 'string' or btrim(v_o->>i) = '' or length(v_o->>i) > 200 then v_ok := false; end if;
    end loop;
    v_c := case when coalesce(it->>'c', '') ~ '^\d$' then (it->>'c')::int else -1 end;
    if not v_ok or v_c < 0 or v_c >= jsonb_array_length(v_o) then continue; end if;
    if exists (select 1 from sa_qday x where x.emp_id = v_emp and x.k = v_k and (x.sent_day is null or x.sent_day > current_date - 14)) then continue; end if;
    insert into sa_qday (emp_id, restaurant, k, item, ord)
    values (v_emp, c->>'restaurant', v_k, jsonb_build_object('q', v_q, 'o', v_o, 'c', v_c,
      'e', left(btrim(coalesce(it->>'e', '')), 500), 't', left(btrim(coalesce(it->>'t', '')), 120), 'r', left(btrim(coalesce(it->>'r', '')), 40)), n);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'queued', n, 'hour', _sa_qday_hour());
end; $$;

-- ответы из Telegram за 30 дней (приложение помнит, какие уже учло)
create or replace function qday_inbox(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return jsonb_build_object('ok', true, 'hour', _sa_qday_hour(),
    'queued', (select count(*) from sa_qday where emp_id = c->>'id' and sent_day is null),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'k', x.k, 'q', x.item->>'q', 'o', x.item->'o', 'c', (x.item->>'c')::int,
        'e', x.item->>'e', 't', x.item->>'t', 'day', x.sent_day, 'answer', x.answer, 'correct', x.correct, 'at', x.answered_at) order by x.id)
      from sa_qday x where x.emp_id = c->>'id' and x.answered_at is not null and x.answered_at > now() - interval '30 days'), '[]'::jsonb));
end; $$;

-- ── 4) Отправка по расписанию ──────────────────────────────────────────────────
-- p_send = false — только посмотреть, кому и что ушло бы (ничего не отмечает и не отправляет); p_now — «который час».
create or replace function _sa_qday_at(p_send boolean, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path to public as $$
declare out jsonb := '[]'::jsonb; l record; tz text; lnow timestamp; hh int; chat bigint; nx sa_qday;
begin
  if not _sa_tg_ready() then return out; end if;
  hh := _sa_qday_hour();
  for l in select t.emp_id, t.restaurant from tg_links t where t.remind order by t.emp_id loop
    tz := _sa_tz(l.restaurant);
    lnow := p_now at time zone tz;
    if extract(hour from lnow)::int <> hh or extract(minute from lnow)::int >= 10 then continue; end if;   -- окно — шаг расписания
    chat := _sa_tg_chat(l.emp_id, 'qday');
    if chat is null then continue; end if;
    nx := null;
    select * into nx from sa_qday where emp_id = l.emp_id and sent_day is null order by ord, id limit 1;
    if nx.id is null then continue; end if;   -- очереди нет: приложение ещё не открывали в новой версии
    if _sa_tg_was(l.emp_id, lnow::date, 'qday') then continue; end if;
    out := out || jsonb_build_object('emp', l.emp_id, 'id', nx.id, 'q', nx.item->>'q', 'chat', chat);
    if p_send then
      if not _sa_tg_once(l.emp_id, lnow::date, 'qday') then continue; end if;
      update sa_qday set sent_day = lnow::date, sent_at = p_now, chat_id = chat where id = nx.id;
      perform sa_tg_api('sendMessage', jsonb_build_object('chat_id', chat, 'text', left(_sa_qday_text(nx.item), 4000),
        'reply_markup', _sa_qday_kb(nx.id, jsonb_array_length(nx.item->'o')), 'disable_web_page_preview', true));
    end if;
  end loop;
  return out;
end; $$;

create or replace function sa_qday_tick()
returns void language plpgsql security definer set search_path to public as $$
begin perform _sa_qday_at(true, now()); end; $$;

create or replace function sa_qday_preview(p_now timestamptz default now())
returns jsonb language sql security definer set search_path to public as $$
  select _sa_qday_at(false, p_now)
$$;

-- ── 5) Вебхук: нажатие кнопки и /start ─────────────────────────────────────────
-- Зовёт только функция tg-bot (сервисным ключом) и передаёт секрет из заголовка Telegram.
create or replace function sa_tg_update(p_secret text, p_update jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare want text; cq jsonb; m text[]; v_id bigint; v_n int; nx sa_qday; v_from bigint; v_ok boolean; v_c int;
  txt text; msg jsonb; mt text; chat bigint;
begin
  select value into want from sa_settings where key = 'tg_webhook_secret';
  if coalesce(want, '') = '' or coalesce(p_secret, '') <> want then return jsonb_build_object('ok', false, 'error', 'secret'); end if;
  if p_update is null or jsonb_typeof(p_update) <> 'object' then return jsonb_build_object('ok', true, 'skip', 'empty'); end if;

  cq := p_update->'callback_query';
  if cq is not null and jsonb_typeof(cq) = 'object' then
    m := regexp_match(coalesce(cq->>'data', ''), '^qd:(\d{1,18}):(\d)$');
    if m is null then
      perform sa_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id'));
      return jsonb_build_object('ok', true, 'skip', 'data');
    end if;
    v_id := m[1]::bigint; v_n := m[2]::int;
    v_from := case when coalesce(cq->'from'->>'id', '') ~ '^\d{1,18}$' then (cq->'from'->>'id')::bigint end;
    select * into nx from sa_qday where id = v_id;
    if nx.id is null or nx.chat_id is null or nx.chat_id is distinct from v_from then
      perform sa_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', 'Этот вопрос не найден'));
      return jsonb_build_object('ok', true, 'skip', 'row');
    end if;
    if v_n >= jsonb_array_length(nx.item->'o') then
      perform sa_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id'));
      return jsonb_build_object('ok', true, 'skip', 'option');
    end if;
    update sa_qday set answer = v_n, correct = (v_n = (item->>'c')::int), answered_at = now()
     where id = v_id and answered_at is null;
    if not found then
      perform sa_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', 'Ответ уже засчитан'));
      return jsonb_build_object('ok', true, 'skip', 'again');
    end if;
    v_c := (nx.item->>'c')::int;
    v_ok := v_n = v_c;
    txt := _sa_qday_text(nx.item) || E'\n\n' ||
      case when v_ok then 'Твой ответ: ' || _sa_qday_letter(v_n) || '. Верно.'
           else 'Твой ответ: ' || _sa_qday_letter(v_n) || '. Верный: ' || _sa_qday_letter(v_c) || '.' end ||
      case when coalesce(nx.item->>'e', '') <> '' then E'\n' || (nx.item->>'e') else '' end ||
      case when v_ok then '' else E'\n\nВопрос ждёт в «Работе над ошибками».' end;
    msg := cq->'message';
    if msg is not null and msg->'chat'->>'id' is not null and msg->>'message_id' is not null then
      perform sa_tg_api('editMessageText', jsonb_build_object('chat_id', msg->'chat'->'id', 'message_id', msg->'message_id',
        'text', left(txt, 4000), 'disable_web_page_preview', true,
        'reply_markup', _sa_tg_app_kb(case when v_ok then 'Открыть академию' else 'Разобрать ошибку' end, case when v_ok then null else 'mistakes' end)));
    end if;
    perform sa_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', case when v_ok then 'Верно' else 'Неверно, разбор в сообщении' end));
    return jsonb_build_object('ok', true, 'answered', v_id, 'correct', v_ok);
  end if;

  -- сообщение боту: на /start — что здесь приходит, и кнопка в приложение
  mt := coalesce(p_update->'message'->>'text', '');
  if mt ~ '^/start' and coalesce(p_update->'message'->'chat'->>'id', '') ~ '^-?\d{1,18}$' then
    chat := (p_update->'message'->'chat'->>'id')::bigint;
    perform sa_tg_send(chat, 'Здесь приходят сообщения академии: разминка перед сменой, вопрос дня, лига недели. Уроки и тесты ждут в приложении.', 'Открыть академию', null);
    return jsonb_build_object('ok', true, 'start', true);
  end if;
  return jsonb_build_object('ok', true, 'skip', 'other');
end; $$;

-- ── 6) Подключение вебхука ─────────────────────────────────────────────────────
-- Одноразовый код на 30 минут; заодно — секрет вебхука (один раз, дальше тот же).
create or replace function sa_tg_setup_code()
returns text language plpgsql security definer set search_path to public as $$
declare code text;
begin
  if _sa_tg_token() is null then
    return 'Сначала токен бота в Vault (этап 22б): select vault.create_secret(''ТОКЕН_ОТ_BOTFATHER'', ''sa_tg_bot_token'');';
  end if;
  code := left(replace(gen_random_uuid()::text, '-', ''), 12);
  insert into sa_settings (key, value) values ('tg_setup_code', code || '|' || floor(extract(epoch from now()))::bigint)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into sa_settings (key, value) values ('tg_webhook_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  on conflict (key) do nothing;
  return 'Код на 30 минут: ' || code || E'\nОткрой в браузере: https://<проект>.supabase.co/functions/v1/tg-bot?setup=' || code;
end; $$;

-- Функция tg-bot по коду получает токен и секрет. p_use = true — код использован (на шаге «подключить»).
create or replace function sa_tg_setup_take(p_code text, p_use boolean default false)
returns jsonb language plpgsql security definer set search_path to public as $$
declare v text; parts text[];
begin
  select value into v from sa_settings where key = 'tg_setup_code';
  parts := string_to_array(coalesce(v, ''), '|');
  if coalesce(array_length(parts, 1), 0) <> 2 or coalesce(p_code, '') = '' or parts[1] <> p_code
     or parts[2] !~ '^\d+$' or parts[2]::bigint < floor(extract(epoch from now()))::bigint - 1800 then
    return jsonb_build_object('ok', false, 'error', 'code');
  end if;
  if coalesce(p_use, false) then delete from sa_settings where key = 'tg_setup_code'; end if;
  return jsonb_build_object('ok', true, 'token', _sa_tg_token(),
    'secret', (select value from sa_settings where key = 'tg_webhook_secret'));
end; $$;

-- ── 7) Что присылать: то же, что в этапах 25 и 26, плюс «Вопрос дня» (и его час) ──
create or replace function notify_prefs(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; p sa_notify_prefs; linked boolean := false; on_ boolean := false;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into p from sa_notify_prefs where emp_id = c->>'id';
  if to_regclass('public.tg_links') is not null then
    execute 'select true, remind from tg_links where emp_id = $1' into linked, on_ using c->>'id';
  end if;
  return jsonb_build_object('ok', true, 'bot', _sa_tg_ready(), 'linked', coalesce(linked, false), 'remind', coalesce(on_, false),
    'pair', coalesce(p.pair, true), 'quest', coalesce(p.quest, true), 'league', coalesce(p.league, true),
    'fresh', coalesce(p.fresh, true), 'month', coalesce(p.month, true), 'master', coalesce(p.master, true),
    'qday', coalesce(p.qday, true), 'qday_hour', _sa_qday_hour());
end; $$;

create or replace function notify_set(p_token text, p_kind text, p_on boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_kind is null or p_kind not in ('pair', 'quest', 'league', 'fresh', 'month', 'master', 'qday') then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  insert into sa_notify_prefs (emp_id) values (c->>'id') on conflict do nothing;
  execute format('update sa_notify_prefs set %I = $1, updated_at = now() where emp_id = $2', p_kind) using coalesce(p_on, false), c->>'id';
  return notify_prefs(p_token);
end; $$;

-- ── 8) Расписание ──────────────────────────────────────────────────────────────
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: «Вопрос дня» не пойдёт по расписанию (включи pg_cron и запусти файл ещё раз)';
    return;
  end if;
  begin execute $c$select cron.unschedule('sa-qday')$c$; exception when others then null; end;
  execute $c$select cron.schedule('sa-qday', '*/10 * * * *', 'select public.sa_qday_tick()')$c$;
exception when others then
  raise notice 'Расписание «Вопроса дня» не создано: %', sqlerrm;
end $$;

-- ── 9) Права ───────────────────────────────────────────────────────────────────
revoke all on function _sa_qday_hour() from public, anon, authenticated;
revoke all on function sa_tg_api(text, jsonb) from public, anon, authenticated;
revoke all on function _sa_tg_app_kb(text, text) from public, anon, authenticated;
revoke all on function _sa_qday_letter(int) from public, anon, authenticated;
revoke all on function _sa_qday_text(jsonb) from public, anon, authenticated;
revoke all on function _sa_qday_kb(bigint, int) from public, anon, authenticated;
revoke all on function _sa_qday_at(boolean, timestamptz) from public, anon, authenticated;
revoke all on function sa_qday_tick() from public, anon, authenticated;
revoke all on function sa_qday_preview(timestamptz) from public, anon, authenticated;
revoke all on function sa_tg_update(text, jsonb) from public, anon, authenticated;
revoke all on function sa_tg_setup_code() from public, anon, authenticated;
revoke all on function sa_tg_setup_take(text, boolean) from public, anon, authenticated;
grant execute on function sa_tg_update(text, jsonb) to service_role;
grant execute on function sa_tg_setup_take(text, boolean) to service_role;
grant execute on function qday_push(text, jsonb) to anon, authenticated;
grant execute on function qday_inbox(text) to anon, authenticated;
grant execute on function notify_prefs(text) to anon, authenticated;
grant execute on function notify_set(text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

select 'вопрос дня: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('qday_push', 'qday_inbox', '_sa_qday_at', 'sa_qday_tick', 'sa_qday_preview', 'sa_tg_api', 'sa_tg_update',
                       'sa_tg_setup_code', 'sa_tg_setup_take', '_sa_qday_text', '_sa_qday_kb', '_sa_tg_app_kb', '_sa_qday_hour', '_sa_qday_letter')) ||
  ' функций из 14 · таблица: ' || case when to_regclass('public.sa_qday') is not null then 'есть' else 'НЕТ' end ||
  ' · час: ' || _sa_qday_hour() || ':00' ||
  ' · Telegram: ' || case when _sa_tg_ready() then 'бот на месте' else 'нет (токен бота — этап 22б)' end ||
  ' · вебхук: ' || case when exists (select 1 from sa_settings where key = 'tg_webhook_secret') then 'секрет есть' else 'ещё не подключали (select sa_tg_setup_code();)' end ||
  ' · pg_cron: ' || case when to_regnamespace('cron') is null then 'нет' else 'да' end as result;
