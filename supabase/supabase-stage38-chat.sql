-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 38 (v90, Доп. 403): чат смены.
--
-- Переписка сотрудников заведения внутри приложения:
--   • чаты: «Вся команда» (все сотрудники заведения), «Старшие» (руководители и старшие) и личные — с коллегой своего
--     заведения; «Руководители сети» — руководители всех заведений сразу (виден, когда заведений два и больше).
--     Групповые чаты заводятся сами при первом входе;
--   • chat_list(p_token) — мои чаты: последнее сообщение, непрочитанные, кто в смене; вызовы мне без ответа;
--     chat_unread(p_token) — коротко для остального приложения: всего непрочитанных и вызовы мне;
--   • chat_open(p_token, p_chat, p_after, p_before, p_since) — сообщения (последние 60; новые после p_after и
--     изменённые с p_since: правка, реакции, «Иду», удаление; раньше p_before — по 40), участники и до какого
--     сообщения каждый прочитал, закреплённое сообщение, время сервера для следующего опроса;
--   • chat_send(p_token, p_chat, p_body, p_reply) — сообщение до 1000 знаков (p_reply — ответ с цитатой), не больше 20
--     в минуту. Собеседнику в личной переписке и автору сообщения, на которое ответили в группе, пишет бот, если
--     человека нет в чате (вид «Чат»; не чаще раза в 2 минуты на переписку);
--   • chat_photo_send(p_token, p_chat, p_full, p_thumb, p_w, p_h, p_body, p_reply) — фото (сжатое на телефоне JPEG, до
--     450 КБ, и превью до 80 КБ, base64) с подписью; chat_photo(p_token, p_id, p_full) — фото или превью для показа.
--     Не больше 10 фото за 10 минут у человека, 60 в день и 200 МБ всего у заведения;
--   • chat_edit(p_token, p_msg, p_body) — поправить своё сообщение (или подпись к фото) в течение суток;
--   • chat_react(p_token, p_msg, p_r) — реакция: ok, like, heart, lol, wow, fire (одна у человека; null — снять);
--   • chat_pin(p_token, p_chat, p_msg) — закрепить сообщение в группе (null — открепить): в «Вся команда» —
--     руководитель и старший, в «Старших» и «Руководителях сети» — каждый; в ленте строка «Мария закрепляет «…»»;
--   • chat_read(p_token, p_chat, p_last) — прочитал до этого сообщения;
--   • chat_dm(p_token, p_emp) — личная переписка с коллегой (одна на двоих); chat_people(p_token) — коллеги заведения;
--   • chat_call(p_token, p_who, p_emp, p_why, p_table, p_text) — «Позвать» в «Вся команда»: менеджера, хостес, бар,
--     официанта или человека; к столу N, нужна помощь, подойди, гость ждёт, своими словами. Тем, кого зовут (по
--     должности — кто сегодня в графике, если график есть), пишет бот;
--     chat_go(p_token, p_msg) — «Иду» на вызов (позвавшему пишет бот);
--   • chat_delete(p_token, p_msg) — удалить своё сообщение; руководитель и старший — любое в группе своего заведения,
--     в «Руководителях сети» — владелец и руководящий состав;
--   • chat_clear(p_token, p_chat) — очистить чат целиком у всех (v91): «Вся команда» и «Старшие» — руководитель и старший
--     заведения, «Руководители сети» — владелец и руководящий состав, личную переписку — любой из двоих. Стирается всё,
--     без строки «кто очистил»; личная переписка уходит из списка чатов у обоих.
-- Удалённое сообщение (v91) исчезает из переписки целиком, без «Сообщение удалено»: в первой странице и раньше его нет,
-- в опросе оно приходит с del, чтобы открытые чаты убрали его у себя; в списке чатов — последнее неудалённое.
-- Переписка и фото хранятся 30 дней (закреплённое — пока закреплено). Тексты и фото видят только сотрудники
-- заведения (личные — только двое; «Руководители сети» — только руководители).
--
-- Нужны этапы 21, 22б, 24, 25, 32 и 36. Ничего не удаляет. Можно запускать повторно.
--
-- v91: функции с токеном — VOLATILE (как в этапе 21). PostgREST выполняет STABLE-функции в транзакции «только для
-- чтения», а проверка входа (whoami) на сервере отмечает визит записью — chat_unread, chat_people и chat_photo в v90
-- были STABLE и молча падали: пустой список «Написать», нет числа на значке и баннера вызова, фото не открывались.
-- Перезапуск этапа заменяет их; переписка не трогается. Ещё в v91: chat_clear — «Очистить чат» (16 функций).
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is null then
    raise exception 'Сначала этап 22б (supabase-stage22b-telegram-reminders.sql): нужен бот — таблица tg_links и sa_tg_send';
  end if;
  if to_regprocedure('public._sa_tz(text)') is null or to_regprocedure('public._sa_on_shift(text,date)') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужны часовой пояс заведения и «кто сегодня в графике»';
  end if;
  if to_regclass('public.sa_notify_prefs') is null or to_regprocedure('public._sa_tg_chat(text,text)') is null then
    raise exception 'Сначала этап 25 (supabase-stage25-live.sql): нужны настройки сообщений sa_notify_prefs и _sa_tg_chat';
  end if;
  if to_regprocedure('public._sa_notify_kinds()') is null then
    raise exception 'Сначала этап 32 (supabase-stage32-briefing.sql): нужны виды сообщений _sa_notify_kinds';
  end if;
  if to_regprocedure('public.notify_quiet(text)') is null then
    raise exception 'Сначала этап 36 (supabase-stage36-comfort.sql): нужны тихие часы — notify_quiet';
  end if;
end $$;

-- ── 1) Таблицы ─────────────────────────────────────────────────────────────────
-- Чат: группа заведения (team, leads), руководители сети (net — один на всю базу, restaurant пустой) или личная
-- переписка (dm: a < b — id двух сотрудников). pin_id — закреплённое.
create table if not exists sa_chats (
  id bigserial primary key,
  restaurant text not null,
  kind text not null,
  a text,
  b text,
  pin_id bigint,
  pin_by text,
  pin_at timestamptz,
  created_at timestamptz not null default now()
);
alter table sa_chats add column if not exists pin_id bigint;
alter table sa_chats add column if not exists pin_by text;
alter table sa_chats add column if not exists pin_at timestamptz;
alter table sa_chats add column if not exists cleared_at timestamptz;   -- v91: когда чат очищали (открытые у других — перечитать)
alter table sa_chats drop constraint if exists sa_chats_kind_check;
alter table sa_chats add constraint sa_chats_kind_check check (kind in ('team', 'leads', 'dm', 'net'));
create unique index if not exists sa_chats_group on sa_chats (restaurant, kind) where kind in ('team', 'leads');
create unique index if not exists sa_chats_net on sa_chats (kind) where kind = 'net';
create unique index if not exists sa_chats_dm on sa_chats (restaurant, a, b) where kind = 'dm';
create index if not exists sa_chats_a on sa_chats (a) where kind = 'dm';
create index if not exists sa_chats_b on sa_chats (b) where kind = 'dm';

-- Сообщение: текст, фото (photo: id, w, h), вызов (call: who, emp, to_name, why, table, text, going [{id, name, at}]) или
-- служебное (sys: «Мария закрепляет «…»»). emp_rest — заведение автора (в «Руководителях сети» видно, кто откуда);
-- reply_to — на какое сообщение ответ; edited_at — когда поправлено;
-- updated_at — для опроса изменённого (правка, реакции, кто идёт на вызов, удаление).
create table if not exists sa_chat_msgs (
  id bigserial primary key,
  chat_id bigint not null references sa_chats(id) on delete cascade,
  emp_id text not null,
  emp_name text not null default '',
  emp_rest text not null default '',
  body text not null default '',
  kind text not null default 'text',
  call jsonb,
  photo jsonb,
  reply_to bigint,
  edited_at timestamptz,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table sa_chat_msgs add column if not exists emp_rest text not null default '';
alter table sa_chat_msgs add column if not exists photo jsonb;
alter table sa_chat_msgs add column if not exists reply_to bigint;
alter table sa_chat_msgs add column if not exists edited_at timestamptz;
alter table sa_chat_msgs drop constraint if exists sa_chat_msgs_kind_check;
alter table sa_chat_msgs add constraint sa_chat_msgs_kind_check check (kind in ('text', 'call', 'photo', 'sys'));
create index if not exists sa_chat_msgs_chat on sa_chat_msgs (chat_id, id);
create index if not exists sa_chat_msgs_emp on sa_chat_msgs (emp_id, created_at);
create index if not exists sa_chat_msgs_at on sa_chat_msgs (created_at);
create index if not exists sa_chat_msgs_upd on sa_chat_msgs (chat_id, updated_at);

-- Прочитано: до какого сообщения; notified_at — когда бот последний раз писал об этой переписке.
create table if not exists sa_chat_reads (
  chat_id bigint not null references sa_chats(id) on delete cascade,
  emp_id text not null,
  last_id bigint not null default 0,
  at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (chat_id, emp_id)
);

-- Реакции: у человека одна на сообщение.
create table if not exists sa_chat_reacts (
  msg_id bigint not null references sa_chat_msgs(id) on delete cascade,
  emp_id text not null,
  emp_name text not null default '',
  r text not null check (r in ('ok', 'like', 'heart', 'lol', 'wow', 'fire')),
  at timestamptz not null default now(),
  primary key (msg_id, emp_id)
);

-- Фото: сжатое (до 1280 точек) и превью; уходят вместе с сообщением.
create table if not exists sa_chat_photos (
  id bigserial primary key,
  msg_id bigint not null references sa_chat_msgs(id) on delete cascade,
  restaurant text not null,
  emp_id text not null,
  mime text not null default 'image/jpeg',
  w int not null default 0,
  h int not null default 0,
  full_data bytea not null,
  thumb_data bytea not null,
  bytes int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists sa_chat_photos_msg on sa_chat_photos (msg_id);
create index if not exists sa_chat_photos_rest on sa_chat_photos (restaurant, created_at);
create index if not exists sa_chat_photos_emp on sa_chat_photos (emp_id, created_at);

alter table sa_chats enable row level security;
alter table sa_chat_msgs enable row level security;
alter table sa_chat_reads enable row level security;
alter table sa_chat_reacts enable row level security;
alter table sa_chat_photos enable row level security;
revoke all on table sa_chats, sa_chat_msgs, sa_chat_reads, sa_chat_reacts, sa_chat_photos from public, anon, authenticated;

-- вид сообщений «Чат» (личные сообщения, ответы и вызовы) в «Напоминаниях в Telegram»: колонка — значит вид
alter table sa_notify_prefs add column if not exists chat boolean;

-- ── 2) Служебное ───────────────────────────────────────────────────────────────
-- должности руководителей и старших (как lead в _sa_caller)
create or replace function _sa_chat_lead_pos()
returns text[] language sql immutable as $$ select array['manager', 'senior', 'owner', 'head', 'admin', 'service_manager'] $$;

-- кого зовут по должности
create or replace function _sa_chat_role_pos(p_who text)
returns text[] language sql immutable as $$
  select case p_who when 'lead' then _sa_chat_lead_pos() when 'host' then array['hostess'] when 'bar' then array['bartender', 'senior_bartender']
    when 'waiter' then array['waiter'] else array[]::text[] end
$$;

-- обрезать до n знаков в одну строку, с многоточием
create or replace function _sa_chat_cut(p text, n int)
returns text language sql immutable as $$
  select case when char_length(t) > n then rtrim(left(t, greatest(n - 1, 0))) || '…' else t end
    from (select btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')) t) x
$$;

-- виден ли чат сотруднику (c — из _sa_caller): чаты своего заведения; «Руководители сети» — любому руководителю
create or replace function _sa_chat_ok(c jsonb, ch sa_chats)
returns boolean language sql stable as $$
  select ch.id is not null and c is not null and (
    (ch.kind = 'net' and coalesce((c->>'lead')::boolean, false) and coalesce(c->>'restaurant', '') <> '')
    or (ch.restaurant is not distinct from (c->>'restaurant') and (
      ch.kind = 'team'
      or (ch.kind = 'leads' and coalesce((c->>'lead')::boolean, false))
      or (ch.kind = 'dm' and (c->>'id') in (ch.a, ch.b)))))
$$;

-- заведений в сети два и больше — тогда есть «Руководители сети»
create or replace function _sa_chat_multi()
returns boolean language sql stable security definer set search_path to public as $$
  select (select count(distinct e.restaurant) from employees e where coalesce(e.status, 'active') = 'active' and coalesce(e.restaurant, '') <> '') >= 2
$$;

-- участники чата: действующие сотрудники заведения (у «Старших» — руководители и старшие; у личной — двое);
-- у «Руководителей сети» — руководители и старшие всех заведений
drop function if exists _sa_chat_members(sa_chats);
create or replace function _sa_chat_members(ch sa_chats)
returns table (id text, name text, pos text, rest text) language sql stable security definer set search_path to public as $$
  select e.id::text, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')), lower(coalesce(e.position, '')), coalesce(e.restaurant, '')
    from employees e
   where coalesce(e.status, 'active') = 'active'
     and ((ch.kind = 'net' and coalesce(e.restaurant, '') <> ''
           and (coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any(_sa_chat_lead_pos())))
       or (e.restaurant is not distinct from ch.restaurant
           and (ch.kind = 'team'
                or (ch.kind = 'leads' and (coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any(_sa_chat_lead_pos())))
                or (ch.kind = 'dm' and e.id::text in (ch.a, ch.b)))))
   order by 2
$$;

-- сообщение для приложения: с цитатой (на что ответ), реакциями, фото и пометкой «изменено»
create or replace function _sa_chat_msg_json(m sa_chat_msgs)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('id', m.id, 'chat', m.chat_id, 'emp', m.emp_id, 'name', m.emp_name, 'rest', m.emp_rest,
    'body', case when m.deleted then '' else m.body end, 'kind', m.kind,
    'call', case when m.kind = 'call' and not m.deleted then m.call end,
    'photo', case when m.kind = 'photo' and not m.deleted then m.photo end,
    'reply', case when m.reply_to is not null and not m.deleted then
      (select jsonb_build_object('id', q.id, 'emp', q.emp_id, 'name', q.emp_name, 'kind', q.kind, 'body', case when q.deleted then '' else _sa_chat_cut(q.body, 200) end,
         'photo', q.kind = 'photo', 'del', q.deleted) from sa_chat_msgs q where q.id = m.reply_to) end,
    'reacts', case when m.deleted then '[]'::jsonb else
      coalesce((select jsonb_agg(jsonb_build_object('r', r.r, 'emp', r.emp_id, 'name', r.emp_name) order by r.at) from sa_chat_reacts r where r.msg_id = m.id), '[]'::jsonb) end,
    'at', m.created_at, 'edited', m.edited_at is not null and not m.deleted, 'del', m.deleted)
$$;

-- текст вызова: «к столу 5», «нужна помощь»…; кого: «хостес», «менеджера», имя
create or replace function _sa_chat_call_why(p jsonb)
returns text language sql immutable as $$
  select case p->>'why' when 'table' then 'к столу ' || coalesce(p->>'table', '') when 'help' then 'нужна помощь'
    when 'come' then 'подойди ко мне' when 'guest' then 'гость ждёт' when 'own' then coalesce(p->>'text', '') else '' end
$$;
-- имя в винительном падеже — кого зовут: Анна → Анну, Мария → Марию, Роман → Романа, Пётр → Петра, Андрей → Андрея
create or replace function _sa_chat_acc(p text)
returns text language sql immutable as $$
  select case
    when n = '' then ''
    when l in ('пётр', 'петр') then 'Петра' when l = 'павел' then 'Павла' when l = 'лев' then 'Льва'
    when l in ('любовь', 'нинель', 'мишель', 'рашель') then n
    when l ~ 'я$' then left(n, -1) || 'ю'
    when l ~ 'а$' then left(n, -1) || 'у'
    when l ~ '[йь]$' then left(n, -1) || 'я'
    when l ~ '[бвгджзклмнпрстфхцчшщ]$' then n || 'а'
    else n end
  from (select btrim(coalesce(p, '')) n, lower(btrim(coalesce(p, ''))) l) x
$$;
create or replace function _sa_chat_call_who(p jsonb)
returns text language sql immutable as $$
  select case p->>'who' when 'lead' then 'менеджера' when 'host' then 'хостес' when 'bar' then 'бар' when 'waiter' then 'официанта'
    when 'person' then coalesce(nullif(_sa_chat_acc(split_part(btrim(coalesce(p->>'to_name', '')), ' ', 1)), ''), 'коллегу') else 'коллегу' end
$$;

-- вызов адресован сотруднику: по должности (руководителю — и админу) или лично; свой — нет
create or replace function _sa_chat_call_for(m sa_chat_msgs, c jsonb)
returns boolean language sql stable as $$
  select m.kind = 'call' and m.emp_id <> (c->>'id') and case m.call->>'who'
    when 'person' then m.call->>'emp' = (c->>'id')
    when 'lead' then coalesce((c->>'lead')::boolean, false)
    else (c->>'position') = any(_sa_chat_role_pos(m.call->>'who')) end
$$;

-- непрочитанные: чужие и не удалённые после моего «прочитал»
create or replace function _sa_chat_unread(p_chat bigint, p_emp text)
returns int language sql stable security definer set search_path to public as $$
  select count(*)::int from sa_chat_msgs m
   where m.chat_id = p_chat and m.emp_id <> p_emp and not m.deleted
     and m.id > coalesce((select r.last_id from sa_chat_reads r where r.chat_id = p_chat and r.emp_id = p_emp), 0)
$$;

-- чат для списка и шапки: последнее сообщение, непрочитанные, участники, в смене; у личной — собеседник
create or replace function _sa_chat_view(c jsonb, ch sa_chats, p_today text[])
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare lm sa_chat_msgs; n int; sh int; peer jsonb; pid text;
begin
  select * into lm from sa_chat_msgs m where m.chat_id = ch.id and not m.deleted order by m.id desc limit 1;
  select count(*), count(*) filter (where p_today is not null and x.id = any(p_today)) into n, sh from _sa_chat_members(ch) x;
  if ch.kind = 'dm' then
    pid := case when ch.a = c->>'id' then ch.b else ch.a end;
    select jsonb_build_object('id', e.id::text, 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')), 'pos', lower(coalesce(e.position, '')),
      'shift', p_today is not null and e.id::text = any(p_today), 'active', coalesce(e.status, 'active') = 'active')
      into peer from employees e where e.id::text = pid;
  end if;
  return jsonb_build_object('id', ch.id, 'kind', ch.kind, 'members', n, 'shift', case when p_today is not null and ch.kind in ('team', 'leads') then sh end,
    'peer', peer, 'last', case when lm.id is not null then _sa_chat_msg_json(lm) end, 'unread', _sa_chat_unread(ch.id, c->>'id'), 'cleared', ch.cleared_at);
end; $$;

-- вызовы мне за 10 минут без ответа
create or replace function _sa_chat_calls(c jsonb)
returns jsonb language sql stable security definer set search_path to public as $$
  select coalesce(jsonb_agg(_sa_chat_msg_json(m) order by m.id), '[]'::jsonb)
    from sa_chat_msgs m join sa_chats ch on ch.id = m.chat_id
   where ch.restaurant is not distinct from (c->>'restaurant') and ch.kind = 'team' and m.kind = 'call' and not m.deleted
     and m.created_at > now() - interval '10 minutes' and coalesce(jsonb_array_length(m.call->'going'), 0) = 0
     and _sa_chat_call_for(m, c)
$$;

-- групповые чаты заведения (заводятся сами); первое «прочитал» в группе — история старше 12 часов прочитана
create or replace function _sa_chat_ensure(c jsonb)
returns void language plpgsql security definer set search_path to public as $$
declare rest text := nullif(btrim(coalesce(c->>'restaurant', '')), '');
begin
  if rest is null then return; end if;
  insert into sa_chats (restaurant, kind) values (rest, 'team') on conflict (restaurant, kind) where kind in ('team', 'leads') do nothing;
  if coalesce((c->>'lead')::boolean, false) then
    insert into sa_chats (restaurant, kind) values (rest, 'leads') on conflict (restaurant, kind) where kind in ('team', 'leads') do nothing;
    insert into sa_chats (restaurant, kind) values ('', 'net') on conflict (kind) where kind = 'net' do nothing;
  end if;
  insert into sa_chat_reads (chat_id, emp_id, last_id)
    select ch.id, c->>'id', coalesce((select max(m.id) from sa_chat_msgs m where m.chat_id = ch.id and m.created_at < now() - interval '12 hours'), 0)
      from sa_chats ch where ((ch.restaurant = rest and ch.kind in ('team', 'leads')) or ch.kind = 'net') and _sa_chat_ok(c, ch)
    on conflict do nothing;
end; $$;

-- кто сегодня в графике заведения (null — графика нет)
create or replace function _sa_chat_today(p_rest text)
returns text[] language sql stable security definer set search_path to public as $$
  select _sa_on_shift(p_rest, (now() at time zone _sa_tz(p_rest))::date)
$$;

-- своё отправленное — прочитано мной; переписка и фото старше 30 дней — стереть (закреплённое остаётся)
create or replace function _sa_chat_after_write(ch sa_chats, p_emp text, p_last bigint)
returns void language plpgsql security definer set search_path to public as $$
begin
  insert into sa_chat_reads (chat_id, emp_id, last_id, at) values (ch.id, p_emp, p_last, now())
    on conflict (chat_id, emp_id) do update set last_id = greatest(sa_chat_reads.last_id, excluded.last_id), at = now();
  delete from sa_chat_msgs x using sa_chats y
   where y.id = x.chat_id and y.restaurant = ch.restaurant and x.created_at < now() - interval '30 days' and x.id is distinct from y.pin_id;
end; $$;

-- ── 3) Список, коротко, переписка ──────────────────────────────────────────────
create or replace function chat_list(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; today text[]; out jsonb := '[]'::jsonb; tot int := 0; v jsonb; ch sa_chats; multi boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  perform _sa_chat_ensure(c);
  today := _sa_chat_today(rest);
  multi := _sa_chat_multi();
  -- группы — первыми («Руководители сети» — после «Старших»); личные — по последнему сообщению (пустые не показываем)
  for ch in
    select x.* from sa_chats x
     where (x.restaurant = rest or (x.kind = 'net' and multi)) and _sa_chat_ok(c, x)
       and (x.kind <> 'dm' or exists (select 1 from sa_chat_msgs m where m.chat_id = x.id and not m.deleted))
     order by case x.kind when 'team' then 0 when 'leads' then 1 when 'net' then 2 else 3 end,
              (select max(m.id) from sa_chat_msgs m where m.chat_id = x.id and not m.deleted) desc nulls last
  loop
    v := _sa_chat_view(c, ch, today);
    out := out || jsonb_build_array(v);
    tot := tot + coalesce((v->>'unread')::int, 0);
  end loop;
  return jsonb_build_object('ok', true, 'me', jsonb_build_object('id', c->>'id', 'name', c->>'who', 'pos', c->>'position', 'lead', coalesce((c->>'lead')::boolean, false),
    'network', coalesce((c->>'network')::boolean, false), 'restaurant', rest), 'chats', out, 'unread', tot, 'calls', _sa_chat_calls(c));
end; $$;

create or replace function chat_unread(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; tot int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', true, 'unread', 0, 'calls', '[]'::jsonb); end if;
  select coalesce(sum(_sa_chat_unread(x.id, c->>'id')), 0)::int into tot from sa_chats x
   where (x.restaurant = rest or (x.kind = 'net' and _sa_chat_multi())) and _sa_chat_ok(c, x);
  return jsonb_build_object('ok', true, 'unread', tot, 'calls', _sa_chat_calls(c));
end; $$;

-- p_after — новые после этого номера и всё, что менялось с p_since (время сервера из прошлого ответа, с запасом
-- 5 секунд: так доходят и правки, и сообщения, записанные одновременно с прошлым опросом)
create or replace function chat_open(p_token text, p_chat bigint, p_after bigint default 0, p_before bigint default 0, p_since timestamptz default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; ch sa_chats; msgs jsonb; more boolean := false; mem jsonb; lo bigint; pin jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(p_before, 0) > 0 then
    select coalesce(jsonb_agg(_sa_chat_msg_json(m::sa_chat_msgs) order by m.id), '[]'::jsonb), min(m.id) into msgs, lo
      from (select * from sa_chat_msgs x where x.chat_id = ch.id and x.id < p_before and not x.deleted order by x.id desc limit 40) m;
    more := lo is not null and exists (select 1 from sa_chat_msgs x where x.chat_id = ch.id and x.id < lo and not x.deleted);
  elsif coalesce(p_after, 0) > 0 then
    select coalesce(jsonb_agg(_sa_chat_msg_json(m::sa_chat_msgs) order by m.id), '[]'::jsonb) into msgs
      from ((select * from sa_chat_msgs x where x.chat_id = ch.id and x.id > p_after order by x.id limit 300)
            union
            (select * from sa_chat_msgs x where x.chat_id = ch.id and x.id <= p_after
               and case when p_since is not null then x.updated_at >= p_since - interval '5 seconds'
                        else x.updated_at > now() - interval '15 minutes' and x.updated_at > x.created_at end
             order by x.updated_at desc limit 200)) m;
  else
    select coalesce(jsonb_agg(_sa_chat_msg_json(m::sa_chat_msgs) order by m.id), '[]'::jsonb), min(m.id) into msgs, lo
      from (select * from sa_chat_msgs x where x.chat_id = ch.id and not x.deleted order by x.id desc limit 60) m;
    more := lo is not null and exists (select 1 from sa_chat_msgs x where x.chat_id = ch.id and x.id < lo and not x.deleted);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'pos', x.pos, 'rest', x.rest, 'read', coalesce(r.last_id, 0)) order by x.name), '[]'::jsonb) into mem
    from _sa_chat_members(ch) x left join sa_chat_reads r on r.chat_id = ch.id and r.emp_id = x.id;
  if ch.kind <> 'dm' and ch.pin_id is not null then
    select _sa_chat_msg_json(m) into pin from sa_chat_msgs m where m.id = ch.pin_id and m.chat_id = ch.id and not m.deleted;
  end if;
  return jsonb_build_object('ok', true, 'chat', _sa_chat_view(c, ch, _sa_chat_today(ch.restaurant)), 'msgs', msgs, 'members', mem, 'more', more,
    'pin', pin, 'now', now());
end; $$;

create or replace function chat_read(p_token text, p_chat bigint, p_last bigint)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; ch sa_chats; top bigint;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select max(id) into top from sa_chat_msgs where chat_id = ch.id;
  insert into sa_chat_reads (chat_id, emp_id, last_id, at) values (ch.id, c->>'id', least(greatest(coalesce(p_last, 0), 0), coalesce(top, 0)), now())
    on conflict (chat_id, emp_id) do update set last_id = greatest(sa_chat_reads.last_id, excluded.last_id), at = now();
  return jsonb_build_object('ok', true);
end; $$;

-- ── 4) Написать, фото, правка, реакции, закреп ─────────────────────────────────
-- бот пишет о переписке: человек не в чате (не читал минуту) и бот не писал о ней 2 минуты
create or replace function _sa_chat_ping(ch sa_chats, p_to text, p_text text)
returns boolean language plpgsql security definer set search_path to public as $$
declare chat bigint; r sa_chat_reads;
begin
  if not _sa_tg_ready() or p_to is null then return false; end if;
  select * into r from sa_chat_reads where chat_id = ch.id and emp_id = p_to;
  if r.emp_id is not null and (r.at > now() - interval '1 minute' or r.notified_at > now() - interval '2 minutes') then return false; end if;
  chat := _sa_tg_chat(p_to, 'chat');
  if chat is null then return false; end if;
  perform sa_tg_send(chat, p_text, 'Открыть чат', 'chat');
  insert into sa_chat_reads (chat_id, emp_id, last_id, at, notified_at) values (ch.id, p_to, 0, now() - interval '1 day', now())
    on conflict (chat_id, emp_id) do update set notified_at = now();
  return true;
end; $$;

-- кому сказать о новом сообщении: собеседнику в личной; в группе — автору сообщения, на которое ответили
create or replace function _sa_chat_notify(c jsonb, ch sa_chats, m sa_chat_msgs)
returns void language plpgsql security definer set search_path to public as $$
declare peer text; q sa_chat_msgs; what text;
begin
  what := case when m.kind = 'photo' then 'Фото' || case when m.body <> '' then ': ' || _sa_clip(m.body, 280) else '' end else _sa_clip(m.body, 300) end;
  if ch.kind = 'dm' then
    peer := case when ch.a = c->>'id' then ch.b else ch.a end;
    perform _sa_chat_ping(ch, peer, coalesce(c->>'who', '') || ' пишет тебе:' || chr(10) || what);
  elsif m.reply_to is not null then
    select * into q from sa_chat_msgs where id = m.reply_to;
    if q.id is not null and q.emp_id <> c->>'id' and q.kind in ('text', 'photo', 'call')
       and exists (select 1 from _sa_chat_members(ch) x where x.id = q.emp_id) then
      perform _sa_chat_ping(ch, q.emp_id, coalesce(c->>'who', '') || ' отвечает тебе в «' || case ch.kind when 'team' then 'Вся команда' when 'leads' then 'Старшие'
        else 'Руководители сети' end || '»:' || chr(10) || what);
    end if;
  end if;
end; $$;

-- ответ — только на сообщение этого же чата, не удалённое и не служебное
create or replace function _sa_chat_reply_ok(ch sa_chats, p_reply bigint)
returns bigint language sql stable security definer set search_path to public as $$
  select q.id from sa_chat_msgs q where q.id = p_reply and q.chat_id = ch.id and not q.deleted and q.kind <> 'sys'
$$;

create or replace function chat_send(p_token text, p_chat bigint, p_body text, p_reply bigint default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; ch sa_chats; body text; m sa_chat_msgs;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  body := left(btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), E'\r\n?', E'\n', 'g'), E'\n{3,}', E'\n\n', 'g')), 1000);
  if body = '' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if (select count(*) from sa_chat_msgs x where x.emp_id = c->>'id' and x.created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, reply_to)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), body, case when p_reply is not null then _sa_chat_reply_ok(ch, p_reply) end) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  perform _sa_chat_notify(c, ch, m);
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

-- фото: JPEG, PNG или WebP; сжатое — до 450 КБ, превью — до 80 КБ
create or replace function _sa_chat_img(p bytea)
returns text language sql immutable as $$
  select case when p is null or octet_length(p) < 12 then null
    when substring(p from 1 for 3) = '\xffd8ff'::bytea then 'image/jpeg'
    when substring(p from 1 for 8) = '\x89504e470d0a1a0a'::bytea then 'image/png'
    when substring(p from 1 for 4) = '\x52494646'::bytea and substring(p from 9 for 4) = '\x57454250'::bytea then 'image/webp'
    else null end
$$;

create or replace function chat_photo_send(p_token text, p_chat bigint, p_full text, p_thumb text, p_w int, p_h int, p_body text default '', p_reply bigint default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; ch sa_chats; body text; m sa_chat_msgs; full_b bytea; thumb_b bytea; mime text; pid bigint; tz text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  begin
    full_b := decode(coalesce(p_full, ''), 'base64');
    thumb_b := decode(coalesce(p_thumb, ''), 'base64');
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end;
  mime := _sa_chat_img(full_b);
  if mime is null or _sa_chat_img(thumb_b) is null or coalesce(p_w, 0) not between 1 and 4096 or coalesce(p_h, 0) not between 1 and 4096 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if octet_length(full_b) > 450 * 1024 or octet_length(thumb_b) > 80 * 1024 then return jsonb_build_object('ok', false, 'error', 'too_big'); end if;
  if (select count(*) from sa_chat_photos x where x.emp_id = c->>'id' and x.created_at > now() - interval '10 minutes') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  tz := _sa_tz(ch.restaurant);
  if (select count(*) from sa_chat_photos x where x.restaurant = ch.restaurant and (x.created_at at time zone tz)::date = (now() at time zone tz)::date) >= 60
     or (select coalesce(sum(x.bytes), 0) from sa_chat_photos x where x.restaurant = ch.restaurant) > 200 * 1024 * 1024 then
    return jsonb_build_object('ok', false, 'error', 'photo_limit');
  end if;
  body := left(btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), E'\r\n?', E'\n', 'g'), E'\n{3,}', E'\n\n', 'g')), 1000);
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, reply_to)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), body, 'photo', case when p_reply is not null then _sa_chat_reply_ok(ch, p_reply) end) returning * into m;
  insert into sa_chat_photos (msg_id, restaurant, emp_id, mime, w, h, full_data, thumb_data, bytes)
    values (m.id, ch.restaurant, c->>'id', mime, p_w, p_h, full_b, thumb_b, octet_length(full_b) + octet_length(thumb_b)) returning id into pid;
  update sa_chat_msgs set photo = jsonb_build_object('id', pid, 'w', p_w, 'h', p_h) where id = m.id returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  perform _sa_chat_notify(c, ch, m);
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

create or replace function chat_photo(p_token text, p_id bigint, p_full boolean default false)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; p sa_chat_photos; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into p from sa_chat_photos where id = p_id;
  select * into m from sa_chat_msgs where id = p.msg_id;
  select * into ch from sa_chats where id = m.chat_id;
  if p.id is null or m.id is null or m.deleted or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'mime', p.mime, 'w', p.w, 'h', p.h,
    'data', replace(encode(case when coalesce(p_full, false) then p.full_data else p.thumb_data end, 'base64'), E'\n', ''));
end; $$;

create or replace function chat_edit(p_token text, p_msg bigint, p_body text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats; nb text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.emp_id <> c->>'id' or m.kind not in ('text', 'photo') then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if m.created_at < now() - interval '24 hours' then return jsonb_build_object('ok', false, 'error', 'too_late'); end if;
  nb := left(btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), E'\r\n?', E'\n', 'g'), E'\n{3,}', E'\n\n', 'g')), 1000);
  if nb = '' and m.kind = 'text' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if nb is distinct from m.body then
    update sa_chat_msgs set body = nb, edited_at = now(), updated_at = now() where id = m.id returning * into m;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

create or replace function chat_react(p_token text, p_msg bigint, p_r text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind = 'sys' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_r is not null and p_r not in ('ok', 'like', 'heart', 'lol', 'wow', 'fire') then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if p_r is null then
    delete from sa_chat_reacts where msg_id = m.id and emp_id = c->>'id';
  else
    insert into sa_chat_reacts (msg_id, emp_id, emp_name, r) values (m.id, c->>'id', coalesce(c->>'who', ''), p_r)
      on conflict (msg_id, emp_id) do update set r = excluded.r, emp_name = excluded.emp_name, at = now();
  end if;
  update sa_chat_msgs set updated_at = now() where id = m.id returning * into m;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

create or replace function chat_pin(p_token text, p_chat bigint, p_msg bigint)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; ch sa_chats; m sa_chat_msgs; s sa_chat_msgs; what text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or ch.kind = 'dm' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if ch.kind = 'team' and not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_msg is null then
    update sa_chats set pin_id = null, pin_by = c->>'id', pin_at = now() where id = ch.id;
    return jsonb_build_object('ok', true, 'pin', null);
  end if;
  select * into m from sa_chat_msgs where id = p_msg and chat_id = ch.id;
  if m.id is null or m.deleted or m.kind not in ('text', 'photo') then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  update sa_chats set pin_id = m.id, pin_by = c->>'id', pin_at = now() where id = ch.id;
  what := case when m.kind = 'photo' then 'фото' || case when m.body <> '' then ': ' || m.body else '' end else m.body end;
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, reply_to)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), split_part(coalesce(c->>'who', ''), ' ', 1) || ' закрепляет «' || _sa_chat_cut(what, 48) || '»', 'sys', m.id)
    returning * into s;
  perform _sa_chat_after_write(ch, c->>'id', s.id);
  return jsonb_build_object('ok', true, 'pin', _sa_chat_msg_json(m), 'msg', _sa_chat_msg_json(s));
end; $$;

create or replace function chat_dm(p_token text, p_emp text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; va text; vb text; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_emp is null or p_emp = c->>'id' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if not exists (select 1 from employees e where e.id::text = p_emp and e.restaurant is not distinct from rest and coalesce(e.status, 'active') = 'active') then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  va := least(c->>'id', p_emp); vb := greatest(c->>'id', p_emp);
  insert into sa_chats (restaurant, kind, a, b) values (rest, 'dm', va, vb) on conflict (restaurant, a, b) where kind = 'dm' do nothing;
  select * into ch from sa_chats x where x.restaurant = rest and x.kind = 'dm' and x.a = va and x.b = vb;
  return jsonb_build_object('ok', true, 'chat', _sa_chat_view(c, ch, _sa_chat_today(rest)));
end; $$;

create or replace function chat_people(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; today text[]; out jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  today := _sa_chat_today(rest);
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id::text, 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')), 'pos', lower(coalesce(e.position, '')),
      'shift', today is not null and e.id::text = any(today)) order by btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, ''))), '[]'::jsonb) into out
    from employees e where e.restaurant is not distinct from rest and coalesce(e.status, 'active') = 'active' and e.id::text <> c->>'id';
  return jsonb_build_object('ok', true, 'people', out);
end; $$;

-- ── 5) «Позвать» и «Иду» ───────────────────────────────────────────────────────
create or replace function chat_call(p_token text, p_who text, p_emp text, p_why text, p_table text, p_text text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ch sa_chats; to_name text := ''; call jsonb; line text; m sa_chat_msgs; today text[]; t record; chat bigint; tbl text; txt text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_who is null or p_who not in ('lead', 'host', 'bar', 'waiter', 'person') or p_why is null or p_why not in ('table', 'help', 'come', 'guest', 'own') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if p_who = 'person' then
    select btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) into to_name from employees e
     where e.id::text = p_emp and e.restaurant is not distinct from rest and coalesce(e.status, 'active') = 'active' and e.id::text <> c->>'id';
    if to_name is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  end if;
  tbl := btrim(coalesce(p_table, '')); txt := _sa_clip(p_text, 200);
  if p_why = 'table' and tbl !~ '^[0-9A-Za-zА-Яа-яЁё]{1,6}$' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if p_why = 'own' and (txt = '' or char_length(txt) > 80) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if exists (select 1 from sa_chat_msgs x where x.emp_id = c->>'id' and x.kind = 'call' and x.created_at > now() - interval '30 seconds') then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  perform _sa_chat_ensure(c);
  select * into ch from sa_chats x where x.restaurant = rest and x.kind = 'team';
  call := jsonb_build_object('who', p_who, 'emp', case when p_who = 'person' then p_emp end, 'to_name', to_name, 'why', p_why,
    'table', case when p_why = 'table' then tbl else '' end, 'text', case when p_why = 'own' then txt else '' end, 'going', '[]'::jsonb);
  line := split_part(coalesce(c->>'who', ''), ' ', 1) || ' зовёт ' || _sa_chat_call_who(call) || ': ' || _sa_chat_call_why(call);
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, call) values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), line, 'call', call) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  -- кого зовут: человека; по должности — кто сегодня в графике (графика нет — все с этой должностью)
  if _sa_tg_ready() then
    today := _sa_chat_today(rest);
    for t in
      select e.id::text as id from employees e
       where e.restaurant is not distinct from rest and coalesce(e.status, 'active') = 'active' and e.id::text <> c->>'id'
         and case when p_who = 'person' then e.id::text = p_emp
                  when p_who = 'lead' then coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any(_sa_chat_lead_pos())
                  else lower(coalesce(e.position, '')) = any(_sa_chat_role_pos(p_who)) end
         and (p_who = 'person' or today is null or cardinality(today) = 0 or e.id::text = any(today))
    loop
      chat := _sa_tg_chat(t.id, 'chat');
      if chat is not null then
        perform sa_tg_send(chat, split_part(coalesce(c->>'who', ''), ' ', 1) || ' зовёт ' || case when p_who = 'person' then 'тебя' else _sa_chat_call_who(call) end ||
          ': ' || _sa_chat_call_why(call), 'Открыть чат', 'chat');
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

create or replace function chat_go(p_token text, p_msg bigint)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats; chat bigint;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.kind <> 'call' or m.deleted or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.emp_id = c->>'id' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(m.call->'going', '[]'::jsonb)) g where g->>'id' = c->>'id') then
    update sa_chat_msgs set call = jsonb_set(call, '{going}', coalesce(call->'going', '[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('id', c->>'id', 'name', coalesce(c->>'who', ''), 'at', now()))), updated_at = now()
     where id = m.id returning * into m;
    if _sa_tg_ready() then
      chat := _sa_tg_chat(m.emp_id, 'chat');
      if chat is not null then
        perform sa_tg_send(chat, split_part(coalesce(c->>'who', ''), ' ', 1) || ' идёт: ' || _sa_chat_call_why(m.call), null, null);
      end if;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

create or replace function chat_delete(p_token text, p_msg bigint)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.emp_id <> c->>'id' and not ((coalesce((c->>'lead')::boolean, false) and ch.kind in ('team', 'leads'))
                                   or (coalesce((c->>'network')::boolean, false) and ch.kind = 'net')) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update sa_chat_msgs set deleted = true, body = '', photo = null, updated_at = now() where id = m.id;
  delete from sa_chat_photos where msg_id = m.id;
  delete from sa_chat_reacts where msg_id = m.id;
  update sa_chats set pin_id = null where id = ch.id and pin_id = m.id;
  return jsonb_build_object('ok', true);
end; $$;

-- v91: очистить чат целиком — у всех. Сообщения стираются (фото и реакции — вместе с ними), закреп снимается, строки
-- «кто очистил» нет (владелец: «что бы удалялось все, без подписи»); личная переписка уходит из списка у обоих.
-- cleared_at — метка для тех, у кого чат открыт: их приложение увидит её в ответе опроса и перечитает переписку.
create or replace function chat_clear(p_token text, p_chat bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats; n int; t timestamptz := clock_timestamp();
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not (ch.kind = 'dm' or (coalesce((c->>'lead')::boolean, false) and ch.kind in ('team', 'leads'))
          or (coalesce((c->>'network')::boolean, false) and ch.kind = 'net')) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  delete from sa_chat_msgs where chat_id = ch.id;
  get diagnostics n = row_count;
  update sa_chats set pin_id = null, pin_by = c->>'id', pin_at = t, cleared_at = t where id = ch.id;
  return jsonb_build_object('ok', true, 'removed', n, 'cleared', t);
end; $$;

-- v91: та же причина, что у chat_people, у двух функций прошлых этапов: my_reset_at (этап 20, метка «Сбросить
-- прогресс» для нового телефона) и hr_quality_get (этап 28, общий итог «Проверки AI HR»). Тела не меняются.
do $$ begin
  if to_regprocedure('public.my_reset_at(text)') is not null then execute 'alter function public.my_reset_at(text) volatile'; end if;
  if to_regprocedure('public.hr_quality_get(text,text)') is not null then execute 'alter function public.hr_quality_get(text, text) volatile'; end if;
end $$;

-- ── 6) Права ───────────────────────────────────────────────────────────────────
grant execute on function chat_list(text) to anon, authenticated;
grant execute on function chat_unread(text) to anon, authenticated;
grant execute on function chat_open(text, bigint, bigint, bigint, timestamptz) to anon, authenticated;
grant execute on function chat_read(text, bigint, bigint) to anon, authenticated;
grant execute on function chat_send(text, bigint, text, bigint) to anon, authenticated;
grant execute on function chat_photo_send(text, bigint, text, text, int, int, text, bigint) to anon, authenticated;
grant execute on function chat_photo(text, bigint, boolean) to anon, authenticated;
grant execute on function chat_edit(text, bigint, text) to anon, authenticated;
grant execute on function chat_react(text, bigint, text) to anon, authenticated;
grant execute on function chat_pin(text, bigint, bigint) to anon, authenticated;
grant execute on function chat_dm(text, text) to anon, authenticated;
grant execute on function chat_people(text) to anon, authenticated;
grant execute on function chat_call(text, text, text, text, text, text) to anon, authenticated;
grant execute on function chat_go(text, bigint) to anon, authenticated;
grant execute on function chat_delete(text, bigint) to anon, authenticated;
grant execute on function chat_clear(text, bigint) to anon, authenticated;
revoke all on function _sa_chat_lead_pos() from public, anon, authenticated;
revoke all on function _sa_chat_role_pos(text) from public, anon, authenticated;
revoke all on function _sa_chat_cut(text, int) from public, anon, authenticated;
revoke all on function _sa_chat_ok(jsonb, sa_chats) from public, anon, authenticated;
revoke all on function _sa_chat_multi() from public, anon, authenticated;
revoke all on function _sa_chat_members(sa_chats) from public, anon, authenticated;
revoke all on function _sa_chat_msg_json(sa_chat_msgs) from public, anon, authenticated;
revoke all on function _sa_chat_call_why(jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_call_who(jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_acc(text) from public, anon, authenticated;
revoke all on function _sa_chat_call_for(sa_chat_msgs, jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_unread(bigint, text) from public, anon, authenticated;
revoke all on function _sa_chat_view(jsonb, sa_chats, text[]) from public, anon, authenticated;
revoke all on function _sa_chat_calls(jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_ensure(jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_today(text) from public, anon, authenticated;
revoke all on function _sa_chat_after_write(sa_chats, text, bigint) from public, anon, authenticated;
revoke all on function _sa_chat_ping(sa_chats, text, text) from public, anon, authenticated;
revoke all on function _sa_chat_notify(jsonb, sa_chats, sa_chat_msgs) from public, anon, authenticated;
revoke all on function _sa_chat_reply_ok(sa_chats, bigint) from public, anon, authenticated;
revoke all on function _sa_chat_img(bytea) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'чат смены: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('chat_list', 'chat_unread', 'chat_open', 'chat_read', 'chat_send', 'chat_photo_send', 'chat_photo', 'chat_edit', 'chat_react', 'chat_pin',
                       'chat_dm', 'chat_people', 'chat_call', 'chat_go', 'chat_delete', 'chat_clear')) ||
  ' функций из 16 · таблицы: ' || case when to_regclass('public.sa_chats') is not null and to_regclass('public.sa_chat_msgs') is not null
    and to_regclass('public.sa_chat_reads') is not null and to_regclass('public.sa_chat_reacts') is not null and to_regclass('public.sa_chat_photos') is not null
    then 'есть' else 'НЕТ' end ||
  ' · вид «Чат» в напоминаниях: ' || case when 'chat' = any(_sa_notify_kinds()) then 'да' else 'нет' end ||
  ' · Telegram: ' || case when _sa_tg_ready() then 'бот на месте' else 'нет (чат работает, без сообщений)' end as result;
