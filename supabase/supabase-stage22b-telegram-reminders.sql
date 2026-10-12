-- ════════════════════════════════════════════════════════════════════════════
-- Этап 22б — напоминание в Telegram за час до смены (версия v28)
--
-- Что делает:
--   • за час до смены по графику бот пишет сотруднику: «Через час смена: Вечер ·
--     16:00–24:00. Разминка до смены — 2 минуты» с кнопкой, которая открывает
--     приложение сразу на разминке;
--   • старшему приходит сообщение, когда его просят подтвердить навык в зале (этап 22),
--     а сотруднику — когда навык подтвердили или сказали «ещё рано».
-- Включает каждый сам: «Смена» → «Напоминания в Telegram» → «Включить». Telegram
-- спрашивает разрешение, сервер проверяет подпись Telegram (никто не привяжет чужой чат).
--
-- Всё работает внутри Supabase: расписание — pg_cron (каждые 10 минут), отправка —
-- pg_net. Отдельные edge-функции не нужны. Прежняя «Завтра смена» (shift-reminder)
-- не меняется и работает как раньше.
--
-- ПЕРЕД ЗАПУСКОМ (один раз):
--   1) Database → Extensions: включи pg_net и pg_cron (или этот файл попробует сам).
--   2) Токен бота (тот же бот, в котором открывается приложение) — в Vault:
--        select vault.create_secret('123456789:AA…ТОКЕН_ОТ_BOTFATHER', 'sa_tg_bot_token');
--      Сменить токен потом: select vault.update_secret(
--        (select id from vault.secrets where name = 'sa_tg_bot_token'), 'НОВЫЙ_ТОКЕН');
--   3) Адрес приложения — для кнопки «Разминка» (тот же, что APP_URL у shift-reminder).
--      Таблицу sa_settings создаёт этот файл, поэтому адрес (и пояс ниже) задаются ПОСЛЕ
--      первого запуска — потом файл можно запустить ещё раз, он покажет, всё ли на месте:
--        insert into sa_settings (key, value) values ('app_url', 'https://ВАШ-АДРЕС.vercel.app')
--        on conflict (key) do update set value = excluded.value;
--      Без адреса кнопка ведёт по ссылке t.me/<бот>?startapp=go_warmup (бот — ключ bot_username).
--   Часовой пояс по умолчанию — Камчатка (Asia/Kamchatka). Другой для ресторана:
--        insert into sa_settings (key, value) values ('tz:Название ресторана', 'Europe/Moscow')
--        on conflict (key) do update set value = excluded.value;
--
-- Нужны этапы 21 (_sa_caller) и 9 (график). Этап 22 — по желанию (уведомления о навыках
-- включатся сами, когда он есть). Запускать в SQL Editor целиком. Повторный запуск безопасен.
-- Проверка без отправки: select sa_warmup_preview(); — кому и что ушло бы прямо сейчас
-- (окно ±10 минут вокруг «за час до смены»).
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала выполни этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
end $$;

-- ── 0) Расширения ────────────────────────────────────────────────────────────
create schema if not exists extensions;
do $$ begin
  begin create extension if not exists pgcrypto with schema extensions;
  exception when others then raise notice 'pgcrypto: %', sqlerrm; end;
  begin create extension if not exists pg_net with schema extensions;
  exception when others then raise notice 'pg_net не включилось само (%). Включи: Database → Extensions → pg_net', sqlerrm; end;
  begin create extension if not exists pg_cron;
  exception when others then raise notice 'pg_cron не включилось само (%). Включи: Database → Extensions → pg_cron (или Integrations → Cron)', sqlerrm; end;
end $$;

-- ── 1) Настройки и таблицы ───────────────────────────────────────────────────
create table if not exists sa_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);
alter table sa_settings enable row level security;
revoke all on table sa_settings from anon, authenticated;
insert into sa_settings (key, value) values
  ('tz', 'Asia/Kamchatka'),          -- часовой пояс по умолчанию (свой у ресторана — ключ 'tz:<ресторан>')
  ('remind_minutes', '60'),          -- за сколько минут до смены напоминать
  ('bot_username', 'SA_RestaurantBot')
on conflict (key) do nothing;

-- кто из сотрудников подключил Telegram (один Telegram — один сотрудник)
create table if not exists tg_links (
  emp_id     text primary key,          -- employees.id
  chat_id    bigint not null,           -- личный чат с ботом (= id пользователя Telegram)
  tg_user    jsonb,                     -- имя и username из Telegram (для справки)
  restaurant text,
  full_name  text,                      -- «Имя Фамилия» — по нему ищем в графике
  remind     boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists tg_links_rest on tg_links (restaurant) where remind;
create index if not exists tg_links_chat on tg_links (chat_id);
alter table tg_links enable row level security;
revoke all on table tg_links from anon, authenticated;

-- что уже отправлено (одно напоминание на смену)
create table if not exists tg_sent (
  emp_id  text not null,
  day     date not null,
  kind    text not null,
  sent_at timestamptz default now(),
  primary key (emp_id, day, kind)
);
alter table tg_sent enable row level security;
revoke all on table tg_sent from anon, authenticated;

-- ── 2) Служебное ─────────────────────────────────────────────────────────────
-- токен бота из Vault (null, если не задан)
create or replace function _sa_tg_token()
returns text language plpgsql stable security definer set search_path to public as $$
declare t text;
begin
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into t using 'sa_tg_bot_token';
  exception when others then t := null; end;
  return nullif(btrim(coalesce(t, '')), '');
end; $$;

-- %XX-раскодирование строки initData (UTF-8)
create or replace function _sa_urldecode(p text)
returns text language plpgsql immutable as $$
declare b bytea := ''::bytea; i int := 1; n int := length(coalesce(p, '')); ch text;
begin
  while i <= n loop
    ch := substr(p, i, 1);
    if ch = '%' and i + 2 <= n and substr(p, i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' then
      b := b || decode(substr(p, i + 1, 2), 'hex'); i := i + 3;
    elsif ch = '+' then
      b := b || '\x20'::bytea; i := i + 1;
    else
      b := b || convert_to(ch, 'UTF8'); i := i + 1;
    end if;
  end loop;
  return convert_from(b, 'UTF8');
end; $$;

-- Проверка подписи Telegram.WebApp.initData (core.telegram.org/bots/webapps):
-- secret = HMAC_SHA256(bot_token, key "WebAppData"); hash = HMAC_SHA256(data_check_string, secret).
-- data_check_string — все поля кроме hash, по алфавиту, «key=value» через перевод строки.
-- Вернёт объект user из initData, {"stale":true} для старой подписи (больше 7 дней) или null.
create or replace function _sa_tg_check(p_init text, p_bot text)
returns jsonb language plpgsql stable set search_path to public, extensions, pg_catalog as $$
declare kv text; k text; v text; pairs text[] := '{}'; pairs2 text[] := '{}'; h text; usr jsonb; ad bigint;
  secret bytea; dcs text; good boolean := false;
begin
  if coalesce(p_init, '') = '' or coalesce(p_bot, '') = '' then return null; end if;
  foreach kv in array string_to_array(p_init, '&') loop
    if kv = '' then continue; end if;
    k := _sa_urldecode(split_part(kv, '=', 1));
    v := _sa_urldecode(substr(kv, length(split_part(kv, '=', 1)) + 2));
    if k = 'hash' then h := lower(v); continue; end if;
    pairs := pairs || (k || '=' || v);
    if k <> 'signature' then pairs2 := pairs2 || (k || '=' || v); end if;
    if k = 'user' then begin usr := v::jsonb; exception when others then usr := null; end; end if;
    if k = 'auth_date' then begin ad := v::bigint; exception when others then ad := null; end; end if;
  end loop;
  if h is null or usr is null or coalesce(usr->>'id', '') = '' then return null; end if;
  secret := hmac(convert_to(p_bot, 'UTF8'), convert_to('WebAppData', 'UTF8'), 'sha256');
  select string_agg(x, E'\n' order by x collate "C") into dcs from unnest(pairs) x;
  good := encode(hmac(convert_to(dcs, 'UTF8'), secret, 'sha256'), 'hex') = h;
  if not good and array_length(pairs2, 1) is distinct from array_length(pairs, 1) then
    -- на случай, если Telegram считает подпись без поля signature
    select string_agg(x, E'\n' order by x collate "C") into dcs from unnest(pairs2) x;
    good := encode(hmac(convert_to(dcs, 'UTF8'), secret, 'sha256'), 'hex') = h;
  end if;
  if not good then return null; end if;
  if ad is null or ad < extract(epoch from now())::bigint - 7 * 86400 then return jsonb_build_object('stale', true); end if;
  return usr;
end; $$;

-- слова имени: нижний регистр, ё → е, по алфавиту, без повторов
create or replace function _sa_name_tokens(p text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct w order by w), '{}')
    from unnest(regexp_split_to_array(btrim(regexp_replace(replace(lower(coalesce(p, '')), 'ё', 'е'), '\s+', ' ', 'g')), ' ')) w
   where w <> ''
$$;

-- час «16» / «24» / «02:30» для подписи смены
create or replace function _sa_hh(p numeric)
returns text language sql immutable as $$
  select case when p is null then '' else
    (case when p = 24 then '24' else lpad((floor(p)::int % 24)::text, 2, '0') end) || ':' ||
    lpad(round((p - floor(p)) * 60)::int::text, 2, '0') end
$$;

-- Сообщение в Telegram (асинхронно, через pg_net). p_go — куда открыть приложение: warmup | mentor.
create or replace function sa_tg_send(p_chat bigint, p_text text, p_button text default null, p_go text default null)
returns bigint language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare bot text; app text; botname text; body jsonb; btn jsonb; rid bigint;
begin
  bot := _sa_tg_token();
  if bot is null or p_chat is null or coalesce(p_text, '') = '' then return null; end if;
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

-- ── 3) Подключить / выключить напоминания (из приложения) ────────────────────
create or replace function tg_status(p_token text)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb; l tg_links; is_linked boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  select * into l from tg_links where emp_id = c->>'id';
  is_linked := found;
  return json_build_object('ok', true, 'bot', _sa_tg_token() is not null,
    'linked', is_linked, 'remind', coalesce(l.remind, false),
    'minutes', coalesce((select value::int from sa_settings where key = 'remind_minutes'), 60));
end; $$;

create or replace function tg_link(p_token text, p_init_data text, p_remind boolean default true)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb; bot text; u jsonb; chat bigint; mins int;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  bot := _sa_tg_token();
  if bot is null then return json_build_object('ok', false, 'error', 'no_bot'); end if;
  u := _sa_tg_check(p_init_data, bot);
  if u is null then return json_build_object('ok', false, 'error', 'bad_init'); end if;
  if u ? 'stale' then return json_build_object('ok', false, 'error', 'stale'); end if;
  chat := (u->>'id')::bigint;
  delete from tg_links where chat_id = chat and emp_id <> c->>'id';   -- общий телефон: чат — у того, кто вошёл
  insert into tg_links (emp_id, chat_id, tg_user, restaurant, full_name, remind, updated_at)
  values (c->>'id', chat, u - 'photo_url', c->>'restaurant', c->>'who', coalesce(p_remind, true), now())
  on conflict (emp_id) do update
     set chat_id = excluded.chat_id, tg_user = excluded.tg_user, restaurant = excluded.restaurant,
         full_name = excluded.full_name, remind = excluded.remind, updated_at = now();
  mins := coalesce((select value::int from sa_settings where key = 'remind_minutes'), 60);
  if coalesce(p_remind, true) then
    perform sa_tg_send(chat, '✦ SERVICE ACADEMY' || E'\n\n' || 'Готово! За ' ||
      case when mins = 60 then 'час' else mins || ' мин' end ||
      ' до смены по графику напомню о разминке — 2 минуты, 3 ситуации.' ||
      E'\n\nВыключить: «Смена» → «Напоминания в Telegram».', null, null);
  end if;
  return json_build_object('ok', true, 'linked', true, 'remind', coalesce(p_remind, true));
end; $$;

create or replace function tg_set(p_token text, p_remind boolean)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  update tg_links set remind = coalesce(p_remind, false), restaurant = c->>'restaurant', full_name = c->>'who', updated_at = now()
   where emp_id = c->>'id';
  if not found then return json_build_object('ok', false, 'error', 'not_linked'); end if;
  return json_build_object('ok', true, 'remind', coalesce(p_remind, false));
end; $$;

create or replace function tg_unlink(p_token text)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  delete from tg_links where emp_id = c->>'id';
  return json_build_object('ok', true);
end; $$;

-- ── 4) Кому пора напомнить: смены по графику, которые начнутся через ~час ─────
-- p_send = false — только посмотреть (ничего не отправляет и не отмечает).
create or replace function _sa_warmup_due(p_send boolean)
returns jsonb language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare tzdef text; mins int; v record; tz text; lnow timestamp; ld date; mkey text; dnum int;
  pl jsonb; days jsonb; shifts jsonb; st jsonb; k text; sh jsonb; start_ts timestamp; target tg_links;
  stoks text[]; note text; txt text; out jsonb := '[]'::jsonb; nmatch int;
  def_shifts constant jsonb := '[{"k":"У","name":"Утро","from":10,"to":18},{"k":"Д","name":"День","from":12,"to":20},{"k":"В","name":"Вечер","from":16,"to":24},{"k":"К","name":"Кейтеринг","from":10,"to":22}]';
begin
  tzdef := coalesce((select value from sa_settings where key = 'tz'), 'Asia/Kamchatka');
  mins := coalesce((select value::int from sa_settings where key = 'remind_minutes'), 60);
  for v in select sv.restaurant, sv.venue_key, sv.config from schedule_venues sv
            where exists (select 1 from tg_links l where l.remind and l.restaurant is not distinct from sv.restaurant) loop
    tz := coalesce((select value from sa_settings where key = 'tz:' || v.restaurant), tzdef);
    begin lnow := now() at time zone tz; exception when others then lnow := now() at time zone tzdef; end;
    ld := lnow::date;
    mkey := to_char(ld, 'YYYY-MM');
    dnum := extract(day from ld)::int;
    select m.payload into pl from schedule_months m
     where m.restaurant = v.restaurant and m.venue_key = v.venue_key and m.month = mkey;
    if pl is null then continue; end if;
    days := coalesce(pl->'days', '{}'::jsonb);
    shifts := case when jsonb_typeof(v.config->'shifts') = 'array' and jsonb_array_length(v.config->'shifts') > 0 then v.config->'shifts' else def_shifts end;
    for st in select * from jsonb_array_elements(case when jsonb_typeof(v.config->'staff') = 'array' then v.config->'staff' else '[]'::jsonb end) loop
      if coalesce(st->>'till', '') <> '' and mkey > st->>'till' then continue; end if;   -- закрыт месяцем (как в графике)
      k := pl->'plan'->(st->>'id')->>(dnum::text);
      if k is null or k = '' then continue; end if;
      select x into sh from jsonb_array_elements(shifts) x where x->>'k' = k limit 1;
      if sh is null or coalesce(sh->>'from', '') !~ '^[0-9]+(\.[0-9]+)?$' then continue; end if;
      start_ts := ld + make_interval(mins => round((sh->>'from')::numeric * 60)::int);
      if p_send then
        -- окно отправки: от «за час» до «за час + 15 минут» (расписание — каждые 10 минут)
        if not (lnow >= start_ts - make_interval(mins => mins) and lnow < start_ts - make_interval(mins => mins) + interval '15 minutes'
                and lnow < start_ts) then continue; end if;
      else
        -- просмотр: смены, которые начнутся в ближайшие «час + 10 минут»
        if not (lnow >= start_ts - make_interval(mins => mins + 10) and lnow < start_ts) then continue; end if;
      end if;
      -- кто это в Telegram: то же правило имён, что в приложении (все слова совпали или одно внутри другого, единственный)
      stoks := _sa_name_tokens(st->>'name');
      if coalesce(array_length(stoks, 1), 0) = 0 then continue; end if;
      select count(*) into nmatch from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant and _sa_name_tokens(l.full_name) = stoks;
      if nmatch = 1 then
        select * into target from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant and _sa_name_tokens(l.full_name) = stoks;
      else
        select count(*) into nmatch from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant
           and (_sa_name_tokens(l.full_name) <@ stoks or stoks <@ _sa_name_tokens(l.full_name));
        if nmatch <> 1 then continue; end if;
        select * into target from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant
           and (_sa_name_tokens(l.full_name) <@ stoks or stoks <@ _sa_name_tokens(l.full_name));
      end if;
      note := nullif(btrim(coalesce(days->(dnum::text)->>'note', '')), '');
      txt := '✦ SERVICE ACADEMY' || E'\n\n' || 'Через ' || case when mins = 60 then 'час' else mins || ' мин' end ||
             ' смена: ' || coalesce(sh->>'name', 'смена') || ' · ' || _sa_hh((sh->>'from')::numeric) || '–' ||
             _sa_hh(coalesce((sh->>'to')::numeric, 24)) ||
             coalesce(E'\n✎ ' || note, '') ||
             E'\n\nРазминка до смены — 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены ✦';
      if p_send then
        insert into tg_sent (emp_id, day, kind) values (target.emp_id, ld, 'warmup') on conflict do nothing;
        if not found then continue; end if;   -- уже напоминали сегодня
        perform sa_tg_send(target.chat_id, txt, 'Разминка ✦', 'warmup');
      end if;
      out := out || jsonb_build_object('restaurant', v.restaurant, 'name', st->>'name', 'shift', sh->>'name',
        'starts', to_char(start_ts, 'HH24:MI'), 'local_now', to_char(lnow, 'YYYY-MM-DD HH24:MI'), 'text', txt);
    end loop;
  end loop;
  return out;
end; $$;

-- раз в 10 минут (pg_cron): отправить, кому пора
create or replace function sa_warmup_tick()
returns int language plpgsql security definer set search_path to public as $$
declare r jsonb;
begin
  if _sa_tg_token() is null then return 0; end if;
  delete from tg_sent where day < current_date - 40;
  r := _sa_warmup_due(true);
  return coalesce(jsonb_array_length(r), 0);
end; $$;

-- проверка без отправки: кому и что ушло бы (смены в ближайшие 70 минут)
create or replace function sa_warmup_preview()
returns jsonb language plpgsql security definer set search_path to public as $$
begin
  return _sa_warmup_due(false);
end; $$;

-- ── 5) Подтверждение в зале (этап 22): уведомить старших и сотрудника ─────────
create or replace function _sa_skill_req_notify()
returns trigger language plpgsql security definer set search_path to public as $$
declare l record; lbl text;
begin
  if _sa_tg_token() is null then return new; end if;
  lbl := coalesce(nullif(new.skill_label, ''), new.skill_id);
  if tg_op = 'INSERT' and new.status = 'pending' then
    for l in select tl.chat_id from tg_links tl join employees e on e.id::text = tl.emp_id
              where tl.remind and tl.emp_id <> new.emp_id
                and tl.restaurant is not distinct from new.restaurant
                and lower(coalesce(to_jsonb(e)->>'position', '')) in ('senior', 'manager')
                and coalesce(to_jsonb(e)->>'status', 'active') = 'active' loop
      perform sa_tg_send(l.chat_id, '✦ SERVICE ACADEMY' || E'\n\n' || new.emp_name || ' просит подтвердить навык в зале:' ||
        E'\n«' || lbl || '»' || E'\n\nПосмотри, как это получается на смене, и ответь в «Наставничестве».', 'Открыть ✦', 'mentor');
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'declined') then
    for l in select tl.chat_id from tg_links tl where tl.emp_id = new.emp_id and tl.remind loop
      perform sa_tg_send(l.chat_id, '✦ SERVICE ACADEMY' || E'\n\n' ||
        case when new.status = 'approved'
          then 'Навык подтверждён: «' || lbl || '» — ' || coalesce(new.mentor_name, 'наставник') || ' видел(а) в зале ✓'
          else 'Пока не подтверждено: «' || lbl || '»' || coalesce(E'\n' || coalesce(new.mentor_name, 'Старший') || ': «' || new.note || '»', '') ||
               E'\nПопроси ещё раз, когда будешь готов(а).' end, 'Открыть ✦', 'mentor');
    end loop;
  end if;
  return new;
exception when others then
  return new;   -- уведомление не должно мешать записи
end; $$;

do $$
begin
  if to_regclass('public.skill_requests') is not null then
    execute 'drop trigger if exists skill_requests_notify on skill_requests';
    execute 'create trigger skill_requests_notify after insert or update of status on skill_requests
             for each row execute function _sa_skill_req_notify()';
  else
    raise notice 'Этап 22 ещё не выполнен — уведомления о навыках включатся, если запустить этот файл ещё раз после него';
  end if;
end $$;

-- ── 6) Права: наружу — только функции с токеном ───────────────────────────────
revoke all on function _sa_tg_token()                    from public, anon, authenticated;
revoke all on function _sa_tg_check(text, text)          from public, anon, authenticated;
revoke all on function sa_tg_send(bigint, text, text, text) from public, anon, authenticated;
revoke all on function _sa_warmup_due(boolean)           from public, anon, authenticated;
revoke all on function sa_warmup_tick()                  from public, anon, authenticated;
revoke all on function sa_warmup_preview()               from public, anon, authenticated;
revoke all on function _sa_skill_req_notify()            from public, anon, authenticated;
grant execute on function tg_status(text)                to anon, authenticated;
grant execute on function tg_link(text, text, boolean)   to anon, authenticated;
grant execute on function tg_set(text, boolean)          to anon, authenticated;
grant execute on function tg_unlink(text)                to anon, authenticated;

-- ── 7) Расписание: каждые 10 минут ────────────────────────────────────────────
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: включи (Database → Extensions → pg_cron) и запусти этот файл ещё раз';
    return;
  end if;
  execute $c$select cron.schedule('sa-warmup-reminders', '*/10 * * * *', 'select public.sa_warmup_tick()')$c$;
exception when others then
  raise notice 'Расписание не создано: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- состояние задания pg_cron. Таблицу cron.job смотрим через execute: без pg_cron обычный
-- запрос к ней не разбирается вовсе и откатил бы весь файл (v31: нашла проверка на чистой базе)
create or replace function _sa_cron_status(p_job text)
returns text language plpgsql stable security definer set search_path to public as $$
declare jn text;
begin
  if to_regclass('cron.job') is null then return 'pg_cron не включён'; end if;
  execute 'select jobname from cron.job where jobname = $1 limit 1' into jn using p_job;
  return case when jn is null then 'не создано' else 'каждые 10 минут (' || jn || ')' end;
exception when others then return 'не удалось проверить';
end; $$;
revoke all on function _sa_cron_status(text) from public, anon, authenticated;

-- ── Итог ───────────────────────────────────────────────────────────────────────
select 'функции этапа 22б: ' || count(*) || ' из 4' as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('tg_status', 'tg_link', 'tg_set', 'tg_unlink')
union all
select 'токен бота в Vault: ' || case when _sa_tg_token() is not null then 'есть' else 'НЕТ — см. шаг 2 в начале файла' end
union all
select 'адрес приложения (app_url): ' || coalesce((select value from sa_settings where key = 'app_url'), 'не задан — кнопка поведёт через t.me/' || coalesce((select value from sa_settings where key = 'bot_username'), 'SA_RestaurantBot'))
union all
select 'расписание: ' || _sa_cron_status('sa-warmup-reminders');

-- Проверка:
--   select tg_status('ТОКЕН_ИЗ_ПРИЛОЖЕНИЯ');      -- bot: true, если токен бота в Vault
--   select sa_warmup_preview();                   -- кому и что ушло бы в ближайший час
--   select * from cron.job where jobname = 'sa-warmup-reminders';
--   select * from net._http_response order by created desc limit 5;   -- ответы Telegram
-- Выключить расписание: select cron.unschedule('sa-warmup-reminders');
