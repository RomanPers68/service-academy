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
--   • свои чаты (v92): chat_group_create(p_token, p_title, p_emps) — руководитель или старший заводит чат с названием и
--     выбранными коллегами своего заведения; chat_group_edit(p_token, p_chat, p_title, p_add, p_remove) — переименовать,
--     добавить, убрать (руководитель или старший из участников); chat_group_leave(p_token, p_chat) — выйти самому;
--     chat_group_delete(p_token, p_chat) — удалить чат у всех. Видят только участники; добавленному пишет бот.
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
-- v92: свои чаты с выбором участников (kind group, таблица sa_chat_members) — 20 функций.
-- v93: умный чат — карточки (kind card: смена, задание, «поделиться», опрос, стоп-лист, брифинг), голоса (sa_chat_votes),
-- Наставник в переписке (kind ai): chat_shift_mine, chat_shift_offer, chat_shift_take, chat_shift_options, chat_shift_swap,
-- chat_shift_cancel, chat_card_send, chat_task_remind, chat_poll_vote, chat_stop_set, chat_ai_post — 31 функция. Смены
-- меняются в графике (этап 9) сразу, без подтверждения; руководители видят каждую передачу (строка в «Старших» и бот).
-- v97: чат и приложение — одно целое. «Ищем в смену» из графика руководителя (chat_shift_need: «Выйду» сразу ставит в
-- график; можно вместо того, кто не сможет выйти), предложения смен для экрана «График» (chat_shift_board), карточка
-- коллеги (chat_person), стоп-лист из Меню — карточкой в чат (chat_stop_note), брифинг дня и «График готов» в «Вся
-- команда» (без повторов брифинга). Кнопки прямо в сообщениях бота: «Иду» на вызов, «Забрать» и «Выйду» на смену, голос
-- в опросе руководителя, «Открыть урок» в задании; ответ на сообщение бота уходит в чат (sa_tg_update — тот же вебхук
-- tg-bot, что у «Вопроса дня», этап 31) — 35 функций.
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
alter table sa_chats add column if not exists title text;               -- v92: название своего чата
alter table sa_chats add column if not exists created_by text;          -- v92: кто завёл свой чат
alter table sa_chats drop constraint if exists sa_chats_kind_check;
alter table sa_chats add constraint sa_chats_kind_check check (kind in ('team', 'leads', 'dm', 'net', 'group'));
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
alter table sa_chat_msgs add column if not exists card jsonb;   -- v93: карточка (смена, задание, опрос…), ответ Наставника, строка о смене
alter table sa_chat_msgs drop constraint if exists sa_chat_msgs_kind_check;
alter table sa_chat_msgs add constraint sa_chat_msgs_kind_check check (kind in ('text', 'call', 'photo', 'sys', 'card', 'ai'));
create index if not exists sa_chat_msgs_chat on sa_chat_msgs (chat_id, id);
create index if not exists sa_chat_msgs_emp on sa_chat_msgs (emp_id, created_at);
create index if not exists sa_chat_msgs_at on sa_chat_msgs (created_at);
create index if not exists sa_chat_msgs_upd on sa_chat_msgs (chat_id, updated_at);

-- v92: участники своих чатов (kind group): кто и кем добавлен.
create table if not exists sa_chat_members (
  chat_id bigint not null references sa_chats(id) on delete cascade,
  emp_id text not null,
  added_by text,
  added_at timestamptz not null default now(),
  primary key (chat_id, emp_id)
);
create index if not exists sa_chat_members_emp on sa_chat_members (emp_id);

-- v93: голоса в опросах — один вариант у человека.
create table if not exists sa_chat_votes (
  msg_id bigint not null references sa_chat_msgs(id) on delete cascade,
  emp_id text not null,
  emp_name text not null default '',
  o int not null,
  at timestamptz not null default now(),
  primary key (msg_id, emp_id)
);

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
alter table sa_chat_members enable row level security;
alter table sa_chat_votes enable row level security;
revoke all on table sa_chats, sa_chat_msgs, sa_chat_reads, sa_chat_reacts, sa_chat_photos from public, anon, authenticated;
revoke all on table sa_chat_members, sa_chat_votes from public, anon, authenticated;

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

-- виден ли чат сотруднику (c — из _sa_caller): чаты своего заведения; «Руководители сети» — любому руководителю;
-- свой чат (v92) — только участникам
create or replace function _sa_chat_ok(c jsonb, ch sa_chats)
returns boolean language sql stable security definer set search_path to public as $$
  select ch.id is not null and c is not null and (
    (ch.kind = 'net' and coalesce((c->>'lead')::boolean, false) and coalesce(c->>'restaurant', '') <> '')
    or (ch.restaurant is not distinct from (c->>'restaurant') and (
      ch.kind = 'team'
      or (ch.kind = 'leads' and coalesce((c->>'lead')::boolean, false))
      or (ch.kind = 'dm' and (c->>'id') in (ch.a, ch.b))
      or (ch.kind = 'group' and exists (select 1 from sa_chat_members m where m.chat_id = ch.id and m.emp_id = (c->>'id'))))))
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
                or (ch.kind = 'dm' and e.id::text in (ch.a, ch.b))
                or (ch.kind = 'group' and exists (select 1 from sa_chat_members m where m.chat_id = ch.id and m.emp_id = e.id::text)))))
   order by 2
$$;

-- сообщение для приложения: с цитатой (на что ответ), реакциями, фото и пометкой «изменено»
create or replace function _sa_chat_msg_json(m sa_chat_msgs)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('id', m.id, 'chat', m.chat_id, 'emp', m.emp_id, 'name', m.emp_name, 'rest', m.emp_rest,
    'body', case when m.deleted then '' else m.body end, 'kind', m.kind,
    'call', case when m.kind = 'call' and not m.deleted then m.call end,
    'photo', case when m.kind = 'photo' and not m.deleted then m.photo end,
    'card', case when m.kind in ('card', 'ai', 'sys') and not m.deleted then m.card end,
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
    'peer', peer, 'last', case when lm.id is not null then _sa_chat_msg_json(lm) end, 'unread', _sa_chat_unread(ch.id, c->>'id'), 'cleared', ch.cleared_at,
    'title', case when ch.kind = 'group' then ch.title end, 'owner', case when ch.kind = 'group' then ch.created_by end);
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
     order by case x.kind when 'team' then 0 when 'leads' then 1 when 'net' then 2 when 'group' then 3 else 4 end,
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
  msgs := _sa_chat_smart(c, ch, msgs);   -- v93: карточки глазами того, кто смотрит (может ли взять смену, прогресс задания, голоса)
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
-- v97: сообщения бота с кнопками. Кнопка «Открыть чат» ведёт в этот чат (?go=chat_<чат>_<сообщение>); по ней же ответ
-- на сообщение бота в Telegram находит, в какой чат его отправить (sa_tg_update).
create or replace function _sa_chat_tg_btn(p_text text, p_go text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare app text; botname text;
begin
  app := nullif(btrim(coalesce((select value from sa_settings where key = 'app_url'), '')), '');
  botname := coalesce(nullif(btrim((select value from sa_settings where key = 'bot_username')), ''), 'SA_RestaurantBot');
  if app is not null then
    return jsonb_build_object('text', p_text, 'web_app', jsonb_build_object('url', rtrim(app, '/') || '/' || case when p_go is not null then '?go=' || p_go else '' end));
  end if;
  return jsonb_build_object('text', p_text, 'url', 'https://t.me/' || botname || case when p_go is not null then '?startapp=go_' || p_go else '' end);
end; $$;
create or replace function _sa_chat_tg_open(p_chat bigint, p_msg bigint)
returns jsonb language sql stable security definer set search_path to public as $$
  select _sa_chat_tg_btn('Открыть чат', 'chat_' || p_chat || coalesce('_' || p_msg, ''))
$$;
-- сообщение бота: p_rows — ряды кнопок (callback_data разбирает sa_tg_update); p_extra — что ещё (ответ на сообщение)
create or replace function _sa_chat_tg(p_chat bigint, p_text text, p_rows jsonb, p_extra jsonb default null)
returns bigint language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare bot text; body jsonb; rid bigint;
begin
  bot := _sa_tg_token();
  if bot is null or p_chat is null or coalesce(p_text, '') = '' then return null; end if;
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
-- вызов Telegram по имени метода (ответ на нажатие, правка сообщения)
create or replace function _sa_chat_tg_api(p_method text, p_body jsonb)
returns bigint language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare bot text; rid bigint;
begin
  bot := _sa_tg_token();
  if bot is null or coalesce(p_method, '') !~ '^[A-Za-z]{3,40}$' then return null; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
      into rid using 'https://api.telegram.org/bot' || bot || '/' || p_method, coalesce(p_body, '{}'::jsonb), '{"Content-Type": "application/json"}'::jsonb;
  exception when others then
    raise notice '_sa_chat_tg_api: %', sqlerrm;
    return null;
  end;
  return rid;
end; $$;

-- бот пишет о переписке, если человека нет в чате прямо сейчас; не чаще раза в 2 минуты на переписку (p_force — для
-- карточек с кнопкой: «Забрать», «Выйду» доходят всегда). p_msg — сообщение (для ответа из Telegram), p_acts — кнопки.
create or replace function _sa_chat_pingk(ch sa_chats, p_to text, p_text text, p_msg bigint, p_acts jsonb, p_force boolean default false)
returns boolean language plpgsql security definer set search_path to public as $$
declare chat bigint; r sa_chat_reads;
begin
  if not _sa_tg_ready() or p_to is null then return false; end if;
  select * into r from sa_chat_reads where chat_id = ch.id and emp_id = p_to;
  if r.emp_id is not null and (r.at > now() - interval '1 minute' or (not coalesce(p_force, false) and r.notified_at > now() - interval '2 minutes')) then return false; end if;
  chat := _sa_tg_chat(p_to, 'chat');
  if chat is null then return false; end if;
  perform _sa_chat_tg(chat, p_text, case when jsonb_typeof(p_acts) = 'array' then p_acts else '[]'::jsonb end || jsonb_build_array(jsonb_build_array(_sa_chat_tg_open(ch.id, p_msg))));
  insert into sa_chat_reads (chat_id, emp_id, last_id, at, notified_at) values (ch.id, p_to, 0, now() - interval '1 day', now())
    on conflict (chat_id, emp_id) do update set notified_at = now();
  return true;
end; $$;
create or replace function _sa_chat_ping(ch sa_chats, p_to text, p_text text)
returns boolean language sql security definer set search_path to public as $$
  select _sa_chat_pingk(ch, p_to, p_text, null, null, false)
$$;

-- кому сказать о новом сообщении: собеседнику в личной; в группе — автору сообщения, на которое ответили
create or replace function _sa_chat_notify(c jsonb, ch sa_chats, m sa_chat_msgs)
returns void language plpgsql security definer set search_path to public as $$
declare peer text; q sa_chat_msgs; what text;
begin
  what := case when m.kind = 'photo' then 'Фото' || case when m.body <> '' then ': ' || _sa_clip(m.body, 280) else '' end else _sa_clip(m.body, 300) end;
  if ch.kind = 'dm' then
    peer := case when ch.a = c->>'id' then ch.b else ch.a end;
    perform _sa_chat_pingk(ch, peer, coalesce(c->>'who', '') || ' пишет тебе:' || chr(10) || what, m.id, null);
  elsif m.reply_to is not null then
    select * into q from sa_chat_msgs where id = m.reply_to;
    if q.id is not null and q.emp_id <> c->>'id' and q.kind in ('text', 'photo', 'call')
       and exists (select 1 from _sa_chat_members(ch) x where x.id = q.emp_id) then
      perform _sa_chat_pingk(ch, q.emp_id, coalesce(c->>'who', '') || ' отвечает тебе в «' || case ch.kind when 'team' then 'Вся команда' when 'leads' then 'Старшие'
        when 'group' then coalesce(ch.title, 'Чат') else 'Руководители сети' end || '»:' || chr(10) || what, m.id, null);
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
  if ch.kind in ('team', 'group') and not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_msg is null then
    update sa_chats set pin_id = null, pin_by = c->>'id', pin_at = now() where id = ch.id;
    return jsonb_build_object('ok', true, 'pin', null);
  end if;
  select * into m from sa_chat_msgs where id = p_msg and chat_id = ch.id;
  if m.id is null or m.deleted or m.kind not in ('text', 'photo', 'card', 'ai') then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
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
      if chat is not null then   -- v97: «Иду» прямо в Telegram
        perform _sa_chat_tg(chat, split_part(coalesce(c->>'who', ''), ' ', 1) || ' зовёт ' || case when p_who = 'person' then 'тебя' else _sa_chat_call_who(call) end ||
          ': ' || _sa_chat_call_why(call), jsonb_build_array(jsonb_build_array(jsonb_build_object('text', 'Иду', 'callback_data', 'cg:' || m.id)),
          jsonb_build_array(_sa_chat_tg_open(ch.id, m.id))));
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

-- «Иду»: в вызов, позвавшему — бот (v97: и из приложения, и кнопкой в Telegram)
create or replace function _sa_chat_go_do(c jsonb, m sa_chat_msgs)
returns sa_chat_msgs language plpgsql security definer set search_path to public as $$
declare chat bigint; r sa_chat_msgs := m;
begin
  if not exists (select 1 from jsonb_array_elements(coalesce(m.call->'going', '[]'::jsonb)) g where g->>'id' = c->>'id') then
    update sa_chat_msgs set call = jsonb_set(call, '{going}', coalesce(call->'going', '[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('id', c->>'id', 'name', coalesce(c->>'who', ''), 'at', now()))), updated_at = now()
     where id = m.id returning * into r;
    if _sa_tg_ready() then
      chat := _sa_tg_chat(m.emp_id, 'chat');
      if chat is not null then
        perform sa_tg_send(chat, split_part(coalesce(c->>'who', ''), ' ', 1) || ' идёт: ' || _sa_chat_call_why(m.call), null, null);
      end if;
    end if;
  end if;
  return r;
end; $$;
create or replace function chat_go(p_token text, p_msg bigint)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.kind <> 'call' or m.deleted or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.emp_id = c->>'id' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  m := _sa_chat_go_do(c, m);
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
  if m.emp_id <> c->>'id' and not ((coalesce((c->>'lead')::boolean, false) and ch.kind in ('team', 'leads', 'group'))
                                   or (coalesce((c->>'network')::boolean, false) and ch.kind = 'net')) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update sa_chat_msgs set deleted = true, body = '', photo = null, updated_at = now(),
         card = case when kind = 'card' and card->>'t' = 'shift' and card->>'st' = 'open' then card || '{"st": "off"}'::jsonb else card end
   where id = m.id;
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
  if not (ch.kind = 'dm' or (coalesce((c->>'lead')::boolean, false) and ch.kind in ('team', 'leads', 'group'))
          or (coalesce((c->>'network')::boolean, false) and ch.kind = 'net')) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  delete from sa_chat_msgs where chat_id = ch.id;
  get diagnostics n = row_count;
  update sa_chats set pin_id = null, pin_by = c->>'id', pin_at = t, cleared_at = t where id = ch.id;
  return jsonb_build_object('ok', true, 'removed', n, 'cleared', t);
end; $$;

-- ── 5б) Свои чаты (v92) ─────────────────────────────────────────────────────────
-- Владелец: «нужно добавить функцию «создать чат», что бы выбрать кого добавить», заводят «Только руководители».
-- Свой чат (kind group): название и участники из своего заведения; видят только участники; переименовать, добавить,
-- убрать, очистить и удалить — руководитель и старший из участников; выйти может каждый. Добавленному пишет бот.

-- название: одна строка, до 40 знаков (пусто — null)
create or replace function _sa_chat_title(p text)
returns text language sql immutable as $$ select nullif(left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), 40), '') $$;

-- кого можно добавить: действующие сотрудники своего заведения, без себя
create or replace function _sa_chat_pick(c jsonb, p_emps text[])
returns text[] language sql stable security definer set search_path to public as $$
  select coalesce(array_agg(distinct e.id::text), array[]::text[]) from employees e
   where e.id::text = any(coalesce(p_emps, array[]::text[])) and e.id::text <> (c->>'id')
     and e.restaurant is not distinct from nullif(btrim(coalesce(c->>'restaurant', '')), '') and coalesce(e.status, 'active') = 'active'
$$;

-- добавленные: переписка до них — прочитана (видна, но не «непрочитанные»); бот: «Роман Перс добавляет тебя в чат «Бар»»
create or replace function _sa_chat_added(c jsonb, ch sa_chats, p_emps text[])
returns void language plpgsql security definer set search_path to public as $$
declare e text; top bigint;
begin
  select coalesce(max(id), 0) into top from sa_chat_msgs where chat_id = ch.id;
  foreach e in array coalesce(p_emps, array[]::text[]) loop
    insert into sa_chat_members (chat_id, emp_id, added_by) values (ch.id, e, c->>'id') on conflict do nothing;
    insert into sa_chat_reads (chat_id, emp_id, last_id, at) values (ch.id, e, top, now() - interval '1 day')
      on conflict (chat_id, emp_id) do update set last_id = greatest(sa_chat_reads.last_id, excluded.last_id);
    perform _sa_chat_ping(ch, e, coalesce(c->>'who', '') || ' добавляет тебя в чат «' || coalesce(ch.title, 'Чат') || '»');
  end loop;
end; $$;

create or replace function _sa_chat_group_out(c jsonb, ch sa_chats)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('ok', true, 'chat', _sa_chat_view(c, ch, _sa_chat_today(ch.restaurant)),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'pos', x.pos) order by x.name), '[]'::jsonb) from _sa_chat_members(ch) x))
$$;

create or replace function chat_group_create(p_token text, p_title text, p_emps text[])
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; t text; who text[]; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  t := _sa_chat_title(p_title);
  who := _sa_chat_pick(c, p_emps);
  if t is null or cardinality(who) = 0 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if cardinality(who) > 100 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  if (select count(*) from sa_chats x where x.kind = 'group' and x.created_by = c->>'id' and x.created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  insert into sa_chats (restaurant, kind, title, created_by) values (rest, 'group', t, c->>'id') returning * into ch;
  insert into sa_chat_members (chat_id, emp_id, added_by) values (ch.id, c->>'id', c->>'id');
  insert into sa_chat_reads (chat_id, emp_id, last_id, at) values (ch.id, c->>'id', 0, now());
  perform _sa_chat_added(c, ch, who);
  return _sa_chat_group_out(c, ch);
end; $$;

-- переименовать, добавить, убрать (себя — нельзя: для этого «Выйти»)
create or replace function chat_group_edit(p_token text, p_chat bigint, p_title text default null, p_add text[] default null, p_remove text[] default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats; t text; adds text[];
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or ch.kind <> 'group' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_title is not null then
    t := _sa_chat_title(p_title);
    if t is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    update sa_chats set title = t where id = ch.id returning * into ch;
  end if;
  if p_remove is not null then
    delete from sa_chat_members m where m.chat_id = ch.id and m.emp_id = any(p_remove) and m.emp_id <> (c->>'id');
  end if;
  if p_add is not null then
    select coalesce(array_agg(x), array[]::text[]) into adds from unnest(_sa_chat_pick(c, p_add)) x
     where not exists (select 1 from sa_chat_members m where m.chat_id = ch.id and m.emp_id = x);
    if (select count(*) from sa_chat_members m where m.chat_id = ch.id) + cardinality(adds) > 101 then
      return jsonb_build_object('ok', false, 'error', 'too_many');
    end if;
    perform _sa_chat_added(c, ch, adds);
  end if;
  return _sa_chat_group_out(c, ch);
end; $$;

-- выйти самому; вышел последний — чата нет
create or replace function chat_group_leave(p_token text, p_chat bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or ch.kind <> 'group' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  delete from sa_chat_members where chat_id = ch.id and emp_id = c->>'id';
  delete from sa_chat_reads where chat_id = ch.id and emp_id = c->>'id';
  if not exists (select 1 from sa_chat_members where chat_id = ch.id) then delete from sa_chats where id = ch.id; end if;
  return jsonb_build_object('ok', true);
end; $$;

-- удалить свой чат у всех: сообщения, фото, реакции, прочтения и участники — вместе с ним
create or replace function chat_group_delete(p_token text, p_chat bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or ch.kind <> 'group' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  delete from sa_chats where id = ch.id;
  return jsonb_build_object('ok', true);
end; $$;

-- ── 5в) Умный чат (v93) ─────────────────────────────────────────────────────────
-- Владелец: «сделать чат умнее… что бы он мог использовать функционал приложения»; про смены — «без подтверждения
-- руководителя, но что бы руководитель видел, что поменялись, или была отдана смена»; «Наставника зовёт любой сотрудник».
-- Карточка в переписке (kind card) делает дело: смена (отдать или поменяться: график меняется сразу, руководителям —
-- строка в «Старших» и бот), задание (урок, тест или тема: кто прошёл, «Напомнить»), «поделиться» (блюдо, коктейль,
-- справочник, урок), опрос, стоп-лист (в меню у всех), брифинг дня. Наставник (kind ai) отвечает в переписке на
-- «@Наставник …»: ответ получает приложение спросившего (ai-chat), сервер проверяет вопрос и считает 30 ответов в день
-- на заведение.

-- строчные русские и латинские буквы при любой локали базы
create or replace function _sa_chat_low(p text)
returns text language sql immutable as $$
  select lower(translate(coalesce(p, ''), 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'))
$$;
-- «Вера Соколова» → «Вера С.»
create or replace function _sa_chat_nm(p text)
returns text language sql immutable as $$
  select case when coalesce(array_length(w, 1), 0) >= 2 and w[2] <> '' then w[1] || ' ' || left(w[2], 1) || '.' else coalesce(w[1], '') end
    from (select regexp_split_to_array(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), ' ') w) x
$$;
-- дата из текста ГГГГ-ММ-ДД (иначе null)
create or replace function _sa_chat_date(p text)
returns date language plpgsql immutable as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p::date;
exception when others then return null;
end; $$;
-- «пт 30»
create or replace function _sa_chat_dshort(d date)
returns text language sql immutable as $$
  select (array['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'])[extract(dow from d)::int + 1] || ' ' || extract(day from d)::int
$$;
-- «пятница, 30 октября»
create or replace function _sa_chat_dlong(d date)
returns text language sql immutable as $$
  select (array['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'])[extract(dow from d)::int + 1] || ', ' ||
    extract(day from d)::int || ' ' || (array['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'])[extract(month from d)::int]
$$;
-- срок задания: «до пятницы, 30 октября»
create or replace function _sa_chat_due(d date)
returns text language sql immutable as $$
  select 'до ' || (array['воскресенья', 'понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы'])[extract(dow from d)::int + 1] || ', ' ||
    extract(day from d)::int || ' ' || (array['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'])[extract(month from d)::int]
$$;
-- часы смены: 16 → «16:00», 26 (после полуночи) → «02:00», 10.5 → «10:30»
create or replace function _sa_chat_hh(p numeric)
returns text language sql immutable as $$
  select lpad(floor(v)::int::text, 2, '0') || ':' || lpad(round((v - floor(v)) * 60)::int::text, 2, '0')
    from (select case when coalesce(p, 0) > 24 then p - 24 else coalesce(p, 0) end v) x
$$;
-- должность в графике (ui/schedule.jsx, POS): одна — «официант», много — «официанты»
create or replace function _sa_chat_spos(p text, p_many boolean)
returns text language sql immutable as $$
  select case coalesce(p, '')
    when 'manager' then case when p_many then 'менеджеры' else 'менеджер' end
    when 'host' then 'хостес'
    when 'call' then case when p_many then 'операторы колл-центра' else 'колл-центр' end
    when 'bar' then case when p_many then 'бармены' else 'бар' end
    when 'barback' then case when p_many then 'барбеки' else 'барбек' end
    when 'waiter' then case when p_many then 'официанты' else 'официант' end
    when 'runner' then case when p_many then 'раннеры' else 'раннер' end
    else case when p_many then 'коллеги той же должности' else '' end end
$$;
-- v97: «Ищем официанта», «Ищем 2 официантов» — кого ищут в смену (n — сколько человек)
create or replace function _sa_chat_spos_acc(p text, n int)
returns text language sql immutable as $$
  select case when coalesce(n, 1) <= 1 then
    case coalesce(p, '') when 'manager' then 'менеджера' when 'host' then 'хостес' when 'call' then 'оператора колл-центра' when 'bar' then 'бармена'
      when 'barback' then 'барбека' when 'waiter' then 'официанта' when 'runner' then 'раннера' else 'человека' end
  else n::text || ' ' ||
    case coalesce(p, '') when 'manager' then 'менеджеров' when 'host' then 'хостес' when 'call' then 'операторов колл-центра' when 'bar' then 'барменов'
      when 'barback' then 'барбеков' when 'waiter' then 'официантов' when 'runner' then 'раннеров' else 'человек' end end
$$;
-- месяц словами: «ноябрь» (график на ноябрь) и «ноября» (до 20 ноября)
create or replace function _sa_chat_mon(p_m int, p_gen boolean)
returns text language sql immutable as $$
  select case when p_gen then (array['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'])[p_m]
    else (array['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'])[p_m] end
$$;

-- ── график (этап 9): одно заведение «main» на ресторан, как в приложении ──
create or replace function _sa_sh_cfg(p_rest text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v jsonb;
begin
  if to_regclass('public.schedule_venues') is null or to_regclass('public.schedule_months') is null then return null; end if;
  select sv.config into v from schedule_venues sv where sv.restaurant = p_rest and sv.venue_key = 'main';
  return case when jsonb_typeof(v) = 'object' then v end;
end; $$;
-- смены заведения (свои или как DEFAULT_CONFIG в ui/schedule.jsx)
create or replace function _sa_sh_defs(p_cfg jsonb)
returns jsonb language sql immutable as $$
  select case when jsonb_typeof(p_cfg->'shifts') = 'array' and jsonb_array_length(p_cfg->'shifts') > 0 then p_cfg->'shifts'
    else '[{"k":"У","name":"Утро","from":10,"to":18},{"k":"Д","name":"День","from":12,"to":20},{"k":"В","name":"Вечер","from":16,"to":24},{"k":"К","name":"Кейтеринг","from":10,"to":22,"extra":1}]'::jsonb end
$$;
-- смена по букве (null — в этот день не смена)
create or replace function _sa_sh_def(p_cfg jsonb, p_k text)
returns jsonb language sql immutable as $$
  select x from jsonb_array_elements(_sa_sh_defs(p_cfg)) x where coalesce(p_k, '') <> '' and jsonb_typeof(x) = 'object' and x->>'k' = p_k limit 1
$$;
-- строка графика по id
create or replace function _sa_sh_row(p_cfg jsonb, p_sid text)
returns jsonb language sql immutable as $$
  select x from jsonb_array_elements(case when jsonb_typeof(p_cfg->'staff') = 'array' then p_cfg->'staff' else '[]'::jsonb end) x
   where jsonb_typeof(x) = 'object' and x->>'id' = p_sid limit 1
$$;
-- строка графика сотрудника в месяце: слова имени совпали; иначе единственный похожий (как на телефоне и в _sa_emp_sched)
create or replace function _sa_sh_staff(p_cfg jsonb, p_emp text, p_mkey text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare ptk text[]; me jsonb; me1 jsonb; nc int;
begin
  select _sa_name_tokens(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) into ptk from employees e where e.id::text = p_emp;
  if coalesce(array_length(ptk, 1), 0) = 0 then return null; end if;
  select count(*), (array_agg(s.x) filter (where s.t = ptk))[1], (array_agg(s.x))[1] into nc, me, me1
    from (select x, _sa_name_tokens(x->>'name') as t
            from jsonb_array_elements(case when jsonb_typeof(p_cfg->'staff') = 'array' then p_cfg->'staff' else '[]'::jsonb end) x
           where jsonb_typeof(x) = 'object' and coalesce(x->>'id', '') <> ''
             and (coalesce(x->>'till', '') = '' or p_mkey <= x->>'till') and (coalesce(x->>'since', '') = '' or p_mkey >= x->>'since')) s
   where coalesce(array_length(s.t, 1), 0) > 0 and (s.t <@ ptk or ptk <@ s.t);
  if me is null and nc = 1 then me := me1; end if;
  return me;
end; $$;
-- буква в плане: строка p_sid, день p_day; p_over — «как будто уже»: {"ГГГГ-ММ-ДД|id": "Д" или ""}
create or replace function _sa_sh_code(p_rest text, p_sid text, p_day date, p_over jsonb default '{}'::jsonb)
returns text language plpgsql stable security definer set search_path to public as $$
declare k text := to_char(p_day, 'YYYY-MM-DD') || '|' || coalesce(p_sid, ''); v text;
begin
  if p_over is not null and p_over ? k then return coalesce(p_over->>k, ''); end if;
  select m.payload->'plan'->p_sid->>(extract(day from p_day)::int::text) into v
    from schedule_months m where m.restaurant = p_rest and m.venue_key = 'main' and m.month = to_char(p_day, 'YYYY-MM');
  return coalesce(v, '');
end; $$;

-- почему строку графика p_s нельзя поставить в день p_day на смену p_k (null — можно): уже в смене, отпуск, отдых до и
-- после (rules.minRest, по умолчанию 11 ч), смен подряд (rules.maxRow, 5). Пожелания и постоянные выходные не мешают:
-- человек берёт смену сам.
create or replace function _sa_sh_why(p_rest text, p_cfg jsonb, p_s jsonb, p_day date, p_k text, p_over jsonb)
returns text language plpgsql stable security definer set search_path to public as $$
declare sh jsonb := _sa_sh_def(p_cfg, p_k); pv jsonb; nx jsonb; r jsonb; mk text := to_char(p_day, 'YYYY-MM'); dn int := extract(day from p_day)::int;
  rst numeric; maxrow int; run int := 1; d date; sid text := p_s->>'id';
begin
  if sh is null then return 'смены нет в графике'; end if;
  if _sa_sh_def(p_cfg, _sa_sh_code(p_rest, sid, p_day, p_over)) is not null then return 'в этот день уже есть смена'; end if;
  if jsonb_typeof(p_s->'vacs'->mk) = 'array' then
    for r in select x from jsonb_array_elements(p_s->'vacs'->mk) x loop
      if jsonb_typeof(r) = 'array' and _sa_num(r->>0) > 0 and dn >= _sa_num(r->>0) and dn <= greatest(_sa_num(r->>1), _sa_num(r->>0)) then return 'в отпуске'; end if;
    end loop;
  elsif jsonb_typeof(p_s->'vac') = 'array' and p_s->'vac'->>2 = mk and _sa_num(p_s->'vac'->>0) > 0
        and dn >= _sa_num(p_s->'vac'->>0) and dn <= greatest(_sa_num(p_s->'vac'->>1), _sa_num(p_s->'vac'->>0)) then
    return 'в отпуске';
  end if;
  rst := case when p_cfg->'rules'->>'minRest' ~ '^[0-9]{1,2}(\.[0-9]+)?$' then (p_cfg->'rules'->>'minRest')::numeric else 11 end;
  maxrow := case when p_cfg->'rules'->>'maxRow' ~ '^[0-9]{1,2}$' then greatest((p_cfg->'rules'->>'maxRow')::int, 1) else 5 end;
  pv := _sa_sh_def(p_cfg, _sa_sh_code(p_rest, sid, p_day - 1, p_over));
  if pv is not null and 24 - _sa_num(pv->>'to') + _sa_num(sh->>'from') < rst then return 'мало отдыха после смены накануне (нужно ' || rst || ' ч)'; end if;
  nx := _sa_sh_def(p_cfg, _sa_sh_code(p_rest, sid, p_day + 1, p_over));
  if nx is not null and 24 - _sa_num(sh->>'to') + _sa_num(nx->>'from') < rst then return 'мало отдыха перед сменой назавтра (нужно ' || rst || ' ч)'; end if;
  d := p_day - 1;
  while run <= maxrow and _sa_sh_def(p_cfg, _sa_sh_code(p_rest, sid, d, p_over)) is not null loop run := run + 1; d := d - 1; end loop;
  d := p_day + 1;
  while run <= maxrow and _sa_sh_def(p_cfg, _sa_sh_code(p_rest, sid, d, p_over)) is not null loop run := run + 1; d := d + 1; end loop;
  if run > maxrow then return 'вышло бы больше ' || maxrow || ' смен подряд'; end if;
  return null;
end; $$;

-- может ли p_emp взять смену карточки: {can, why; ts — его строка графика, gs — строка того, кто предлагает}. Та же
-- должность по графику, смена ещё в графике, день не прошёл; «отдаю» — свободен и правила графика; «меняю» — в этот
-- день свободен и есть своя смена в просимые дни (подробно, по правилам для обоих, — _sa_sh_options)
create or replace function _sa_sh_check(p_rest text, p_card jsonb, p_emp text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare cfg jsonb := _sa_sh_cfg(p_rest); d date := _sa_chat_date(p_card->>'date'); gs jsonb; ts jsonb; w text; swap boolean := p_card->>'mode' = 'swap';
  today date; has boolean; want jsonb := case when jsonb_typeof(p_card->'want') = 'array' then p_card->'want' else '[]'::jsonb end;
begin
  if cfg is null then return jsonb_build_object('can', false, 'why', 'Графика в приложении нет'); end if;
  if d is null then return jsonb_build_object('can', false, 'why', ''); end if;
  today := (now() at time zone _sa_tz(p_rest))::date;
  if d < today then return jsonb_build_object('can', false, 'why', 'Этот день уже прошёл'); end if;
  gs := _sa_sh_row(cfg, p_card->>'sid');
  ts := _sa_sh_staff(cfg, p_emp, to_char(d, 'YYYY-MM'));
  if ts is null then return jsonb_build_object('can', false, 'why', 'Тебя нет в графике'); end if;
  if gs is null or ts->>'id' = gs->>'id' then return jsonb_build_object('can', false, 'why', ''); end if;
  if coalesce(ts->>'pos', '') <> coalesce(gs->>'pos', '') then
    return jsonb_build_object('can', false, 'why', case when swap then 'Поменяться могут ' || _sa_chat_spos(gs->>'pos', true)
      else 'Забрать могут ' || _sa_chat_spos(gs->>'pos', true) || ', свободные в этот день' end);
  end if;
  if _sa_sh_code(p_rest, gs->>'id', d) is distinct from (p_card->>'k') then return jsonb_build_object('can', false, 'why', 'Этой смены уже нет в графике'); end if;
  if swap then
    if _sa_sh_def(cfg, _sa_sh_code(p_rest, ts->>'id', d)) is not null then return jsonb_build_object('can', false, 'why', 'В этот день у тебя своя смена'); end if;
    if jsonb_array_length(want) > 0 then
      select bool_or(_sa_sh_def(cfg, _sa_sh_code(p_rest, ts->>'id', y.x)) is not null) into has
        from (select _sa_chat_date(w0) x from jsonb_array_elements_text(want) w0) y where y.x is not null and y.x >= today and y.x <> d;
      if not coalesce(has, false) then return jsonb_build_object('can', false, 'why', 'В эти дни у тебя нет смен взамен'); end if;
    else
      select bool_or(_sa_sh_def(cfg, _sa_sh_code(p_rest, ts->>'id', g::date)) is not null) into has
        from generate_series(today, today + 31, interval '1 day') g where g::date <> d;
      if not coalesce(has, false) then return jsonb_build_object('can', false, 'why', 'В ближайший месяц у тебя нет смен взамен'); end if;
    end if;
    return jsonb_build_object('can', true, 'ts', ts, 'gs', gs);
  end if;
  w := _sa_sh_why(p_rest, cfg, ts, d, p_card->>'k', jsonb_build_object(to_char(d, 'YYYY-MM-DD') || '|' || (gs->>'id'), ''));
  if w is not null then return jsonb_build_object('can', false, 'why', 'Не получится: ' || w); end if;
  return jsonb_build_object('can', true, 'ts', ts, 'gs', gs);
end; $$;
-- для карточки в ленте — только can и why
create or replace function _sa_sh_can(p_rest text, p_card jsonb, p_emp text)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('can', coalesce((x->>'can')::boolean, false), 'why', coalesce(x->>'why', '')) from (select _sa_sh_check(p_rest, p_card, p_emp) x) y
$$;
-- «Поменяться»: какие свои смены можно отдать взамен (правила графика — для обоих); нет ни одной — почему
create or replace function _sa_sh_options(p_rest text, p_card jsonb, p_emp text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare chk jsonb := _sa_sh_check(p_rest, p_card, p_emp); cfg jsonb; d date := _sa_chat_date(p_card->>'date'); ts jsonb; gs jsonb; today date; x date;
  k2 text; sh jsonb; w1 text; w2 text; out jsonb := '[]'::jsonb; why text := ''; dkey text; xkey text;
  want jsonb := case when jsonb_typeof(p_card->'want') = 'array' then p_card->'want' else '[]'::jsonb end;
begin
  if not coalesce((chk->>'can')::boolean, false) then return jsonb_build_object('shifts', out, 'why', coalesce(chk->>'why', '')); end if;
  cfg := _sa_sh_cfg(p_rest); ts := chk->'ts'; gs := chk->'gs'; today := (now() at time zone _sa_tz(p_rest))::date; dkey := to_char(d, 'YYYY-MM-DD');
  for x in
    select z.y from (select _sa_chat_date(w0) y from jsonb_array_elements_text(want) w0) z where z.y is not null and z.y >= today and z.y <> d
    union
    select g::date from generate_series(today, today + 31, interval '1 day') g where jsonb_array_length(want) = 0 and g::date <> d
    order by 1
  loop
    k2 := _sa_sh_code(p_rest, ts->>'id', x); sh := _sa_sh_def(cfg, k2);
    continue when sh is null;
    xkey := to_char(x, 'YYYY-MM-DD');
    w1 := _sa_sh_why(p_rest, cfg, ts, d, p_card->>'k', jsonb_build_object(xkey || '|' || (ts->>'id'), '', dkey || '|' || (gs->>'id'), ''));
    w2 := _sa_sh_why(p_rest, cfg, gs, x, k2, jsonb_build_object(dkey || '|' || (gs->>'id'), '', xkey || '|' || (ts->>'id'), ''));
    if w1 is null and w2 is null then
      out := out || jsonb_build_array(jsonb_build_object('date', xkey, 'k', k2, 'label', coalesce(sh->>'name', k2),
        'time', _sa_chat_hh(_sa_num(sh->>'from')) || '–' || _sa_chat_hh(_sa_num(sh->>'to'))));
    elsif why = '' then
      why := _sa_chat_dshort(x) || ', ' || coalesce(w1, 'у коллеги: ' || w2);
    end if;
  end loop;
  return jsonb_build_object('shifts', out, 'why', case when jsonb_array_length(out) > 0 then '' when why = '' then 'Подходящих смен взамен нет' else 'Не получится: ' || why end);
end; $$;
-- v97: может ли p_emp выйти по карточке «Ищем в смену» (mode need): та же должность по графику, в этот день без смены,
-- правила графика; уже выходит по этой карточке — нет. {can, why; ts — его строка графика}
create or replace function _sa_sh_need_check(p_rest text, p_card jsonb, p_emp text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare cfg jsonb := _sa_sh_cfg(p_rest); d date := _sa_chat_date(p_card->>'date'); ts jsonb; w text; today date;
begin
  if cfg is null then return jsonb_build_object('can', false, 'why', 'Графика в приложении нет'); end if;
  if d is null then return jsonb_build_object('can', false, 'why', ''); end if;
  today := (now() at time zone _sa_tz(p_rest))::date;
  if d < today then return jsonb_build_object('can', false, 'why', 'Этот день уже прошёл'); end if;
  if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_card->'took') = 'array' then p_card->'took' else '[]'::jsonb end) t where t->>'id' = p_emp) then
    return jsonb_build_object('can', false, 'why', 'Ты выходишь в эту смену');
  end if;
  ts := _sa_sh_staff(cfg, p_emp, to_char(d, 'YYYY-MM'));
  if ts is null then return jsonb_build_object('can', false, 'why', 'Тебя нет в графике'); end if;
  if coalesce(ts->>'pos', '') <> coalesce(p_card->>'posKey', '') then
    return jsonb_build_object('can', false, 'why', 'Выйти могут ' || _sa_chat_spos(p_card->>'posKey', true));
  end if;
  if ts->>'id' = p_card->'instead'->>'sid' then return jsonb_build_object('can', false, 'why', ''); end if;
  w := _sa_sh_why(p_rest, cfg, ts, d, p_card->>'k', '{}'::jsonb);
  if w is not null then return jsonb_build_object('can', false, 'why', 'Не получится: ' || w); end if;
  return jsonb_build_object('can', true, 'ts', ts);
end; $$;
create or replace function _sa_sh_need_can(p_rest text, p_card jsonb, p_emp text)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('can', coalesce((x->>'can')::boolean, false), 'why', coalesce(x->>'why', '')) from (select _sa_sh_need_check(p_rest, p_card, p_emp) x) y
$$;
-- клетка плана: поставить букву (null — убрать) и замок (пересборка месяца клетку не тронет)
create or replace function _sa_sh_put(p jsonb, p_sid text, p_day text, p_k text)
returns jsonb language sql immutable as $$
  select jsonb_set(jsonb_set(x, array['locks', p_sid], case when jsonb_typeof(x->'locks'->p_sid) = 'object' then x->'locks'->p_sid else '{}'::jsonb end || jsonb_build_object(p_day, true)),
    array['plan', p_sid], case when p_k is null then (case when jsonb_typeof(x->'plan'->p_sid) = 'object' then x->'plan'->p_sid else '{}'::jsonb end) - p_day
      else (case when jsonb_typeof(x->'plan'->p_sid) = 'object' then x->'plan'->p_sid else '{}'::jsonb end) || jsonb_build_object(p_day, p_k) end)
  from (select jsonb_set(jsonb_set(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end, '{plan}',
          case when jsonb_typeof(p->'plan') = 'object' then p->'plan' else '{}'::jsonb end), '{locks}',
          case when jsonb_typeof(p->'locks') = 'object' then p->'locks' else '{}'::jsonb end) x) y
$$;
-- записать в график: [{date, sid, k или null}]; месяцы — по порядку, строки под замком
create or replace function _sa_sh_apply(p_rest text, p_who text, p_ch jsonb)
returns boolean language plpgsql security definer set search_path to public as $$
declare mk text; pl jsonb; x jsonb; d date;
begin
  for mk in select distinct to_char(_sa_chat_date(c->>'date'), 'YYYY-MM') from jsonb_array_elements(p_ch) c order by 1 loop
    select payload into pl from schedule_months where restaurant = p_rest and venue_key = 'main' and month = mk for update;
    if pl is null then return false; end if;
    for x in select c from jsonb_array_elements(p_ch) c where to_char(_sa_chat_date(c->>'date'), 'YYYY-MM') = mk loop
      d := _sa_chat_date(x->>'date');
      pl := _sa_sh_put(pl, x->>'sid', extract(day from d)::int::text, x->>'k');
    end loop;
    update schedule_months set payload = pl, updated_by = p_who, updated_at = now() where restaurant = p_rest and venue_key = 'main' and month = mk;
  end loop;
  return true;
end; $$;
-- строка руководителям: «Передача смены пт 30, вечер: отдаёт Вера С., забирает Пётр О. · график обновлён» (как
-- shiftLogLine в lib/chat-smart.js)
create or replace function _sa_sh_line(p_card jsonb)
returns text language sql immutable as $$
  select case when p_card->>'mode' = 'need'   -- v97: «Смена пт 30, вечер (официант): выходит Пётр О.»
    then case when coalesce(p_card->'instead'->>'name', '') <> '' then 'Замена ' else 'Смена ' end ||
         coalesce(_sa_chat_dshort(_sa_chat_date(p_card->>'date')), '') || coalesce(', ' || nullif(_sa_chat_low(p_card->>'label'), ''), '') ||
         coalesce(' (' || nullif(_sa_chat_spos(p_card->>'posKey', false), '') || ')', '') || ': выходит ' || _sa_chat_nm(p_card->'took'->-1->>'name') ||
         case when coalesce(p_card->'instead'->>'name', '') <> '' then ', не выходит ' || _sa_chat_nm(p_card->'instead'->>'name') else '' end || ' · график обновлён'
    when p_card->>'mode' = 'swap'
    then 'Обмен сменами: ' || _sa_chat_nm(p_card->>'fromName') || ' (' || coalesce(_sa_chat_dshort(_sa_chat_date(p_card->>'date')), '') || ') и ' ||
         _sa_chat_nm(p_card->>'byName') || ' (' || coalesce(_sa_chat_dshort(_sa_chat_date(p_card->>'byDate')), '') || ') · график обновлён'
    else 'Передача смены ' || coalesce(_sa_chat_dshort(_sa_chat_date(p_card->>'date')), '') || coalesce(', ' || nullif(_sa_chat_low(p_card->>'label'), ''), '') ||
         ': отдаёт ' || _sa_chat_nm(p_card->>'fromName') || ', забирает ' || _sa_chat_nm(p_card->>'byName') || ' · график обновлён' end
$$;
-- смена перешла: строка в «Старших» (если карточка не там же), бот тому, кто отдал, и руководителям заведения
create or replace function _sa_sh_done(ch sa_chats, m sa_chat_msgs, c jsonb)
returns void language plpgsql security definer set search_path to public as $$
declare line text := _sa_sh_line(m.card); lc sa_chats; t record; tg bigint; who text := coalesce(c->>'who', ''); iid text;
begin
  insert into sa_chats (restaurant, kind) values (ch.restaurant, 'leads') on conflict (restaurant, kind) where kind in ('team', 'leads') do nothing;
  select * into lc from sa_chats where restaurant = ch.restaurant and kind = 'leads';
  if lc.id is not null and lc.id <> ch.id then
    insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
      values (lc.id, c->>'id', who, coalesce(c->>'restaurant', ''), line, 'sys', jsonb_build_object('t', 'log', 'mode', m.card->>'mode'));
  end if;
  if not _sa_tg_ready() then return; end if;
  tg := _sa_tg_chat(m.card->>'from', 'chat');
  if tg is not null then
    perform sa_tg_send(tg, case when m.card->>'mode' = 'swap'
      then _sa_chat_nm(who) || ' меняется с тобой: ты выходишь ' || coalesce(_sa_chat_dlong(_sa_chat_date(m.card->>'byDate')), '') || ', ' || _sa_chat_nm(who) || ' — ' || coalesce(_sa_chat_dlong(_sa_chat_date(m.card->>'date')), '') || '. График обновлён.'
      when m.card->>'mode' = 'need'
      then _sa_chat_nm(who) || ' выходит в смену: ' || coalesce(_sa_chat_dlong(_sa_chat_date(m.card->>'date')), '') || coalesce(' · ' || nullif(_sa_chat_low(m.card->>'label'), ''), '') || '. График обновлён.'
      else _sa_chat_nm(who) || ' забирает твою смену: ' || coalesce(_sa_chat_dlong(_sa_chat_date(m.card->>'date')), '') || '. График обновлён.' end, 'Открыть чат', 'chat');
  end if;
  -- v97: замена — тому, кто не сможет выйти: кто выходит вместо него
  if m.card->>'mode' = 'need' and coalesce(m.card->'instead'->>'name', '') <> '' and jsonb_array_length(coalesce(m.card->'took', '[]'::jsonb)) = 1 then
    select e.id::text into iid from employees e
     where e.restaurant is not distinct from ch.restaurant and coalesce(e.status, 'active') = 'active'
       and _sa_name_tokens(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) = _sa_name_tokens(m.card->'instead'->>'name') limit 1;
    tg := case when iid is not null and iid <> c->>'id' then _sa_tg_chat(iid, 'chat') end;
    if tg is not null then
      perform sa_tg_send(tg, _sa_chat_nm(who) || ' выходит вместо тебя: ' || coalesce(_sa_chat_dlong(_sa_chat_date(m.card->>'date')), '') || '. График обновлён.', 'Открыть чат', 'chat');
    end if;
  end if;
  for t in
    select e.id::text as id from employees e
     where e.restaurant is not distinct from ch.restaurant and coalesce(e.status, 'active') = 'active'
       and (coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any(_sa_chat_lead_pos()))
       and e.id::text <> c->>'id' and e.id::text <> coalesce(m.card->>'from', '')
  loop
    tg := _sa_tg_chat(t.id, 'chat');
    if tg is not null then perform sa_tg_send(tg, line, 'Открыть чат', 'chat'); end if;
  end loop;
end; $$;

-- ── карточки: подписи, что внутри, прогресс задания, голоса ──
-- коротко о карточке — текст сообщения (список чатов, цитата, бот); как cardSummary в lib/chat-smart.js
create or replace function _sa_chat_card_sum(p jsonb)
returns text language sql immutable as $$
  select case p->>'t'
    when 'shift' then case
        when p->>'mode' = 'need' and coalesce(p->'instead'->>'name', '') <> '' then 'Ищем замену: '
        when p->>'mode' = 'need' then 'Ищем ' || _sa_chat_spos_acc(p->>'posKey', case when p->>'n' ~ '^[0-9]$' then (p->>'n')::int else 1 end) || ': '
        when p->>'mode' = 'swap' then 'Меняю смену: ' else 'Отдаю смену: ' end || coalesce(_sa_chat_dlong(_sa_chat_date(p->>'date')), '') ||
      coalesce(' · ' || nullif(btrim(_sa_chat_low(p->>'label') || ' ' || coalesce(p->>'time', '')), ''), '') ||
      case when p->>'mode' = 'need' and coalesce(p->'instead'->>'name', '') <> '' then coalesce(' (' || nullif(_sa_chat_spos(p->>'posKey', false), '') || ')', '') else '' end
    when 'task' then 'Задание: ' || coalesce(p->'item'->>'title', '') || coalesce(', ' || _sa_chat_due(_sa_chat_date(p->>'due')), '')
    when 'share' then (case p->'item'->>'kind' when 'dish' then 'Блюдо' when 'cocktail' then 'Коктейль' when 'ref' then 'Справочник' when 'lesson' then 'Урок'
      when 'quiz' then 'Тест' when 'module' then 'Тема' else 'Карточка' end) || ': ' || coalesce(p->'item'->>'title', '')
    when 'poll' then 'Опрос: ' || coalesce(p->>'q', '')
    when 'stop' then case when p->>'st' = 'off' then 'Снова в меню: ' else 'В стоп-листе: ' end || coalesce(p->'dish'->>'name', '')
    when 'brief' then 'Брифинг смены, ' || coalesce(_sa_chat_dlong(_sa_chat_date(p->>'date')), '')
    -- v97: «График на ноябрь готов», «Пожелания на декабрь: до 20 ноября»
    when 'sched' then case when p->>'what' = 'wishes'
      then 'Пожелания на ' || coalesce(_sa_chat_mon(case when p->>'month' ~ '^\d{4}-(0[1-9]|1[0-2])$' then substr(p->>'month', 6, 2)::int end, false), 'месяц') ||
        coalesce(': до ' || extract(day from _sa_chat_date(p->>'until'))::int || ' ' || _sa_chat_mon(extract(month from _sa_chat_date(p->>'until'))::int, true), '')
      else 'График на ' || coalesce(_sa_chat_mon(case when p->>'month' ~ '^\d{4}-(0[1-9]|1[0-2])$' then substr(p->>'month', 6, 2)::int end, false), 'месяц') || ' готов' end
    else '' end
$$;
-- что приложение положило в карточку: вид из разрешённых, id, название, подпись, минуты, картинка (только https),
-- у темы — её уроки и тесты (по ним считается «прошёл»)
create or replace function _sa_chat_item(p jsonb, p_kinds text[])
returns jsonb language sql immutable as $$
  select case when jsonb_typeof(p) = 'object' and p->>'kind' = any(p_kinds) and coalesce(p->>'id', '') ~ '^[A-Za-z0-9_.:-]{1,80}$'
      and btrim(coalesce(p->>'title', '')) <> '' then
    jsonb_strip_nulls(jsonb_build_object('kind', p->>'kind', 'id', p->>'id', 'title', _sa_chat_cut(p->>'title', 120),
      'sub', nullif(_sa_chat_cut(p->>'sub', 140), ''),
      'mins', case when p->>'mins' ~ '^[0-9]{1,3}$' then (p->>'mins')::int end,
      'img', case when p->>'img' ~ '^https://[^\s"<>]+$' and char_length(p->>'img') <= 600 then p->>'img' end,
      'lessons', case when p->>'kind' = 'module' and jsonb_typeof(p->'lessons') = 'array' then
        (select jsonb_agg(v) from (select v from jsonb_array_elements_text(p->'lessons') v where v ~ '^[A-Za-z0-9_.:-]{1,80}$' limit 80) s) end,
      'quizzes', case when p->>'kind' = 'module' and jsonb_typeof(p->'quizzes') = 'array' then
        (select jsonb_agg(v) from (select v from jsonb_array_elements_text(p->'quizzes') v where v ~ '^[A-Za-z0-9_.:-]{1,80}$' limit 80) s) end)) end
$$;
-- кому задание: участники чата, кроме автора; в чатах заведения — без руководителей (они задают); to — должность
create or replace function _sa_chat_task_who(ch sa_chats, p_card jsonb, p_author text)
returns table (id text, name text) language sql stable security definer set search_path to public as $$
  select x.id, x.name from _sa_chat_members(ch) x
   where x.id <> coalesce(p_author, '')
     and (ch.kind in ('leads', 'net') or not (x.pos = any(_sa_chat_lead_pos())))
     and (coalesce(p_card->>'to', 'all') = 'all' or x.pos = any(_sa_chat_role_pos(p_card->>'to')))
$$;
-- кто из них прошёл: урок — progress, тест — quiz_done, тема — все её уроки и тесты; нет таблиц — никто
create or replace function _sa_chat_task_done(p_ids text[], p_item jsonb)
returns text[] language plpgsql stable security definer set search_path to public as $$
declare ls text[] := '{}'; qs text[] := '{}'; out text[]; q text;
begin
  if coalesce(cardinality(p_ids), 0) = 0 then return '{}'; end if;
  if p_item->>'kind' = 'lesson' then ls := array[p_item->>'id'];
  elsif p_item->>'kind' = 'quiz' then qs := array[p_item->>'id'];
  elsif p_item->>'kind' = 'module' then
    select coalesce(array_agg(distinct v), '{}') into ls from jsonb_array_elements_text(case when jsonb_typeof(p_item->'lessons') = 'array' then p_item->'lessons' else '[]'::jsonb end) v;
    select coalesce(array_agg(distinct v), '{}') into qs from jsonb_array_elements_text(case when jsonb_typeof(p_item->'quizzes') = 'array' then p_item->'quizzes' else '[]'::jsonb end) v;
  end if;
  if cardinality(ls) + cardinality(qs) = 0 then return '{}'; end if;
  if (cardinality(ls) > 0 and to_regclass('public.progress') is null) or (cardinality(qs) > 0 and to_regclass('public.quiz_done') is null) then return '{}'; end if;
  q := 'select coalesce(array_agg(u), ''{}'') from unnest($1) u where true';
  if cardinality(ls) > 0 then q := q || ' and (select count(distinct p.lesson_id::text) from progress p where p.user_id::text = u and p.lesson_id::text = any($2)) >= cardinality($2)'; end if;
  if cardinality(qs) > 0 then q := q || ' and (select count(distinct z.quiz_id::text) from quiz_done z where z.user_id::text = u and z.quiz_id::text = any($3)) >= cardinality($3)'; end if;
  execute q into out using p_ids, ls, qs;
  return coalesce(out, '{}');
end; $$;
-- задание в карточке: прошли n из of; руководителю — кто ещё нет (left)
create or replace function _sa_chat_task(ch sa_chats, p_card jsonb, p_author text, p_lead boolean)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare ids text[]; nms text[]; done text[]; lft text[];
begin
  select coalesce(array_agg(w.id order by w.name), '{}'), coalesce(array_agg(w.name order by w.name), '{}') into ids, nms from _sa_chat_task_who(ch, p_card, p_author) w;
  done := _sa_chat_task_done(ids, p_card->'item');
  select coalesce(array_agg(nms[i] order by i), '{}') into lft from generate_subscripts(ids, 1) i where not (ids[i] = any(done));
  return jsonb_build_object('n', cardinality(done), 'of', cardinality(ids)) || case when p_lead then jsonb_build_object('left', to_jsonb(lft)) else '{}'::jsonb end;
end; $$;
-- сообщения для того, кто смотрит: смена — может ли он взять (can, why), задание — прогресс, опрос — голоса
create or replace function _sa_chat_smart(c jsonb, ch sa_chats, p_msgs jsonb)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare out jsonb := '[]'::jsonb; x jsonb; cd jsonb; lead boolean := coalesce((c->>'lead')::boolean, false);
begin
  for x in select e from jsonb_array_elements(case when jsonb_typeof(p_msgs) = 'array' then p_msgs else '[]'::jsonb end) e loop
    cd := x->'card';
    if x->>'kind' = 'card' and jsonb_typeof(cd) = 'object' and not coalesce((x->>'del')::boolean, false) then
      if cd->>'t' = 'shift' then
        if cd->>'st' = 'open' and cd->>'from' is distinct from c->>'id' then
          cd := cd || case when cd->>'mode' = 'need' then _sa_sh_need_can(ch.restaurant, cd, c->>'id') else _sa_sh_can(ch.restaurant, cd, c->>'id') end;
        end if;
      elsif cd->>'t' = 'task' then
        cd := cd || _sa_chat_task(ch, cd, x->>'emp', lead);
      elsif cd->>'t' = 'poll' then
        cd := cd || jsonb_build_object('votes', (select coalesce(jsonb_agg(jsonb_build_object('o', v.o, 'emp', v.emp_id, 'name', v.emp_name) order by v.at), '[]'::jsonb)
                                                   from sa_chat_votes v where v.msg_id = (x->>'id')::bigint));
      end if;
      x := jsonb_set(x, '{card}', cd);
    end if;
    out := out || jsonb_build_array(x);
  end loop;
  return out;
end; $$;
create or replace function _sa_chat_smart1(c jsonb, ch sa_chats, m sa_chat_msgs)
returns jsonb language sql stable security definer set search_path to public as $$
  select _sa_chat_smart(c, ch, jsonb_build_array(_sa_chat_msg_json(m)))->0
$$;
-- не больше 20 сообщений в минуту у человека (как chat_send)
create or replace function _sa_chat_fast(c jsonb)
returns boolean language sql stable security definer set search_path to public as $$
  select (select count(*) from sa_chat_msgs x where x.emp_id = c->>'id' and x.created_at > now() - interval '1 minute') >= 20
$$;

-- ── смены ──
-- мои смены по графику на месяц вперёд (с сегодняшней), кроме уже предложенных
create or replace function chat_shift_mine(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; cfg jsonb; today date; d date; mk text := ''; ms jsonb; k text; sh jsonb; out jsonb := '[]'::jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  cfg := _sa_sh_cfg(rest);
  if cfg is null then return jsonb_build_object('ok', true, 'shifts', out, 'schedule', false); end if;
  today := (now() at time zone _sa_tz(rest))::date;
  for d in select g::date from generate_series(today, today + 31, interval '1 day') g loop
    if to_char(d, 'YYYY-MM') <> mk then mk := to_char(d, 'YYYY-MM'); ms := _sa_sh_staff(cfg, c->>'id', mk); end if;
    continue when ms is null;
    k := _sa_sh_code(rest, ms->>'id', d); sh := _sa_sh_def(cfg, k);
    continue when sh is null;
    continue when exists (select 1 from sa_chat_msgs x where x.emp_id = c->>'id' and x.kind = 'card' and not x.deleted and x.card->>'t' = 'shift'
                             and x.card->>'st' = 'open' and x.card->>'date' = to_char(d, 'YYYY-MM-DD'));
    out := out || jsonb_build_array(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'venue', 'main', 'k', k, 'label', coalesce(sh->>'name', k),
      'time', _sa_chat_hh(_sa_num(sh->>'from')) || '–' || _sa_chat_hh(_sa_num(sh->>'to')), 'pos', _sa_chat_spos(ms->>'pos', false)));
  end loop;
  return jsonb_build_object('ok', true, 'shifts', out, 'schedule', true);
end; $$;

-- предложить свою смену в чате: отдать (give) или поменяться (swap; p_want — какие дни взять взамен, пусто — любой)
create or replace function chat_shift_offer(p_token text, p_chat bigint, p_date text, p_mode text, p_want text[] default null, p_note text default '')
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats; rest text; cfg jsonb; d date; today date; ms jsonb; k text; sh jsonb; want text[] := '{}'; x text; xd date;
  card jsonb; m sa_chat_msgs; t record;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or ch.kind = 'net' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  rest := ch.restaurant;
  if coalesce(p_mode, '') not in ('give', 'swap') then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  cfg := _sa_sh_cfg(rest);
  if cfg is null then return jsonb_build_object('ok', false, 'error', 'no_schedule'); end if;
  d := _sa_chat_date(p_date); today := (now() at time zone _sa_tz(rest))::date;
  if d is null or d < today or d > today + 45 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  ms := _sa_sh_staff(cfg, c->>'id', to_char(d, 'YYYY-MM'));
  if ms is null then return jsonb_build_object('ok', false, 'error', 'not_in_schedule'); end if;
  k := _sa_sh_code(rest, ms->>'id', d); sh := _sa_sh_def(cfg, k);
  if sh is null then return jsonb_build_object('ok', false, 'error', 'no_shift'); end if;
  if exists (select 1 from sa_chat_msgs x where x.emp_id = c->>'id' and x.kind = 'card' and not x.deleted and x.card->>'t' = 'shift'
               and x.card->>'st' = 'open' and x.card->>'date' = to_char(d, 'YYYY-MM-DD')) then
    return jsonb_build_object('ok', false, 'error', 'already');
  end if;
  if _sa_chat_fast(c) then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;
  if p_mode = 'swap' then
    foreach x in array coalesce(p_want, '{}'::text[]) loop
      xd := _sa_chat_date(x);
      if xd is not null and xd >= today and xd <= today + 45 and xd <> d and not (to_char(xd, 'YYYY-MM-DD') = any(want)) then want := want || to_char(xd, 'YYYY-MM-DD'); end if;
    end loop;
    select coalesce(array_agg(s.v order by s.v), '{}') into want from (select v from unnest(want) v order by v limit 14) s;
  end if;
  card := jsonb_build_object('t', 'shift', 'mode', p_mode, 'date', to_char(d, 'YYYY-MM-DD'), 'k', k, 'label', coalesce(sh->>'name', k),
    'time', _sa_chat_hh(_sa_num(sh->>'from')) || '–' || _sa_chat_hh(_sa_num(sh->>'to')), 'pos', _sa_chat_spos(ms->>'pos', false), 'posKey', coalesce(ms->>'pos', ''),
    'from', c->>'id', 'fromName', coalesce(c->>'who', ''), 'sid', ms->>'id', 'want', to_jsonb(want), 'note', _sa_chat_cut(p_note, 120), 'st', 'open');
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), _sa_chat_card_sum(card), 'card', card) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  perform _sa_chat_notify(c, ch, m);
  -- отдаю: тем, кто может забрать (та же должность, свободен, правила графика), пишет бот
  if p_mode = 'give' and ch.kind <> 'dm' and _sa_tg_ready() then
    for t in select x2.id from _sa_chat_members(ch) x2 where x2.id <> c->>'id' loop
      if coalesce((_sa_sh_check(rest, card, t.id)->>'can')::boolean, false) then
        perform _sa_chat_pingk(ch, t.id, _sa_chat_nm(c->>'who') || ' отдаёт смену: ' || _sa_chat_dlong(d) || ' · ' || _sa_chat_low(card->>'label') || ' ' || (card->>'time') ||
          '. Забрать можно прямо здесь.', m.id, jsonb_build_array(jsonb_build_array(jsonb_build_object('text', 'Забрать', 'callback_data', 'ct:' || m.id))), true);   -- v97: кнопка в Telegram
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- «Забрать» (отдаю) и «Выйду» (ищем в смену, v97): смена переходит сразу (график, замок на клетках), руководители видят.
-- Общая часть для приложения и для кнопки в Telegram: c — кто нажал (как _sa_caller).
create or replace function _sa_sh_take_do(c jsonb, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare m sa_chat_msgs; ch sa_chats; v jsonb; d date; dk text; took jsonb; nn int; inst text;
begin
  select * into m from sa_chat_msgs where id = p_msg for update;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind <> 'card' or m.card->>'t' <> 'shift' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.card->>'st' <> 'open' then return jsonb_build_object('ok', false, 'error', 'taken', 'msg', _sa_chat_smart1(c, ch, m)); end if;
  if m.card->>'mode' not in ('give', 'need') or m.card->>'from' = c->>'id' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if _sa_sh_cfg(ch.restaurant) is null then return jsonb_build_object('ok', false, 'error', 'no_schedule'); end if;
  d := _sa_chat_date(m.card->>'date'); dk := to_char(d, 'YYYY-MM-DD');
  perform 1 from schedule_months x where x.restaurant = ch.restaurant and x.venue_key = 'main' and x.month = to_char(d, 'YYYY-MM') for update;
  if m.card->>'mode' = 'need' then
    v := _sa_sh_need_check(ch.restaurant, m.card, c->>'id');
    if not coalesce((v->>'can')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'not_allowed', 'why', coalesce(v->>'why', ''), 'msg', _sa_chat_smart1(c, ch, m)); end if;
    took := case when jsonb_typeof(m.card->'took') = 'array' then m.card->'took' else '[]'::jsonb end;
    inst := case when jsonb_array_length(took) = 0 then nullif(m.card->'instead'->>'sid', '') end;   -- вместо кого: с первым, кто вышел
    if not _sa_sh_apply(ch.restaurant, 'Чат: ' || coalesce(c->>'who', ''), jsonb_build_array(jsonb_build_object('date', dk, 'sid', v->'ts'->>'id', 'k', m.card->>'k')) ||
         case when inst is not null then jsonb_build_array(jsonb_build_object('date', dk, 'sid', inst, 'k', null)) else '[]'::jsonb end) then
      return jsonb_build_object('ok', false, 'error', 'no_schedule');
    end if;
    took := took || jsonb_build_array(jsonb_build_object('id', c->>'id', 'name', coalesce(c->>'who', ''), 'sid', v->'ts'->>'id', 'at', now()));
    nn := greatest(case when m.card->>'n' ~ '^[0-9]$' then (m.card->>'n')::int else 1 end, 1);
    update sa_chat_msgs set card = card || jsonb_build_object('took', took) ||
        case when jsonb_array_length(took) >= nn then jsonb_build_object('st', 'done', 'by', c->>'id', 'byName', coalesce(c->>'who', ''), 'at', now()) else '{}'::jsonb end,
        updated_at = now()
     where id = m.id returning * into m;
    perform _sa_sh_done(ch, m, c);
    return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
  end if;
  v := _sa_sh_check(ch.restaurant, m.card, c->>'id');
  if not coalesce((v->>'can')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'not_allowed', 'why', coalesce(v->>'why', '')); end if;
  if not _sa_sh_apply(ch.restaurant, 'Чат: ' || coalesce(c->>'who', ''), jsonb_build_array(
       jsonb_build_object('date', dk, 'sid', v->'gs'->>'id', 'k', null), jsonb_build_object('date', dk, 'sid', v->'ts'->>'id', 'k', m.card->>'k'))) then
    return jsonb_build_object('ok', false, 'error', 'no_schedule');
  end if;
  update sa_chat_msgs set card = card || jsonb_build_object('st', 'done', 'by', c->>'id', 'byName', coalesce(c->>'who', ''), 'at', now()), updated_at = now()
   where id = m.id returning * into m;
  perform _sa_sh_done(ch, m, c);
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;
create or replace function chat_shift_take(p_token text, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return _sa_sh_take_do(c, p_msg);
end; $$;

-- «Поменяться»: свои смены, которые подходят (правила графика для обоих), или почему нет
create or replace function chat_shift_options(p_token text, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind <> 'card' or m.card->>'t' <> 'shift' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.card->>'mode' <> 'swap' or m.card->>'st' <> 'open' or m.card->>'from' = c->>'id' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if _sa_sh_cfg(ch.restaurant) is null then return jsonb_build_object('ok', false, 'error', 'no_schedule'); end if;
  return jsonb_build_object('ok', true) || _sa_sh_options(ch.restaurant, m.card, c->>'id');
end; $$;

-- поменяться: моя смена p_date ↔ смена карточки; оба по правилам графика, сразу в графике
create or replace function chat_shift_swap(p_token text, p_msg bigint, p_date text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats; v jsonb; o jsonb; opt jsonb; d date; x date; dk text; xk text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg for update;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind <> 'card' or m.card->>'t' <> 'shift' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.card->>'st' <> 'open' then return jsonb_build_object('ok', false, 'error', 'taken', 'msg', _sa_chat_smart1(c, ch, m)); end if;
  if m.card->>'mode' <> 'swap' or m.card->>'from' = c->>'id' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if _sa_sh_cfg(ch.restaurant) is null then return jsonb_build_object('ok', false, 'error', 'no_schedule'); end if;
  d := _sa_chat_date(m.card->>'date'); x := _sa_chat_date(p_date);
  if x is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  dk := to_char(d, 'YYYY-MM-DD'); xk := to_char(x, 'YYYY-MM-DD');
  perform 1 from schedule_months s where s.restaurant = ch.restaurant and s.venue_key = 'main' and s.month in (to_char(d, 'YYYY-MM'), to_char(x, 'YYYY-MM')) order by s.month for update;
  o := _sa_sh_options(ch.restaurant, m.card, c->>'id');
  select e into opt from jsonb_array_elements(o->'shifts') e where e->>'date' = xk;
  if opt is null then return jsonb_build_object('ok', false, 'error', 'not_allowed', 'why', coalesce(nullif(o->>'why', ''), 'Эта смена не подходит для обмена')); end if;
  v := _sa_sh_check(ch.restaurant, m.card, c->>'id');
  if not _sa_sh_apply(ch.restaurant, 'Чат: ' || coalesce(c->>'who', ''), jsonb_build_array(
       jsonb_build_object('date', dk, 'sid', v->'gs'->>'id', 'k', null), jsonb_build_object('date', dk, 'sid', v->'ts'->>'id', 'k', m.card->>'k'),
       jsonb_build_object('date', xk, 'sid', v->'ts'->>'id', 'k', null), jsonb_build_object('date', xk, 'sid', v->'gs'->>'id', 'k', opt->>'k'))) then
    return jsonb_build_object('ok', false, 'error', 'no_schedule');
  end if;
  update sa_chat_msgs set card = card || jsonb_build_object('st', 'done', 'by', c->>'id', 'byName', coalesce(c->>'who', ''), 'byDate', xk, 'byK', opt->>'k',
      'byLabel', opt->>'label', 'at', now()), updated_at = now()
   where id = m.id returning * into m;
  perform _sa_sh_done(ch, m, c);
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- отменить своё предложение (пока его не взяли)
create or replace function chat_shift_cancel(p_token text, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg for update;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind <> 'card' or m.card->>'t' <> 'shift' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.card->>'from' is distinct from c->>'id' then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if m.card->>'st' <> 'open' then return jsonb_build_object('ok', false, 'error', 'taken', 'msg', _sa_chat_smart1(c, ch, m)); end if;
  update sa_chat_msgs set card = card || jsonb_build_object('st', 'off', 'at', now()), updated_at = now() where id = m.id returning * into m;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- ── задание, поделиться, опрос, брифинг ──
-- v97: кнопка в сообщении бота о задании: «Открыть урок» (тест — по той же ссылке); тема — без кнопки (есть «Открыть чат»)
create or replace function _sa_chat_task_kb(p_item jsonb)
returns jsonb language sql stable security definer set search_path to public as $$
  select case when p_item->>'kind' in ('lesson', 'quiz') and coalesce(p_item->>'id', '') ~ '^[A-Za-z0-9_-]{1,54}$'
    then jsonb_build_array(jsonb_build_array(_sa_chat_tg_btn(case when p_item->>'kind' = 'quiz' then 'Открыть тест' else 'Открыть урок' end, 'lesson_' || (p_item->>'id'))))
    else '[]'::jsonb end
$$;
-- p_chat null (v97) — «Вся команда» своего заведения: брифинг из экрана «Брифинг», «График готов» из графика
create or replace function chat_card_send(p_token text, p_chat bigint, p_card jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats; t text := p_card->>'t'; lead boolean; card jsonb; it jsonb; due date; today date; q text; opts text[]; lines text[];
  m sa_chat_msgs; what text; ids text[]; done text[]; e text; mk text; till date; nc jsonb; r record; kb jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_chat is null then
    perform _sa_chat_ensure(c);
    select * into ch from sa_chats x where x.restaurant = nullif(btrim(coalesce(c->>'restaurant', '')), '') and x.kind = 'team';
  else
    select * into ch from sa_chats where id = p_chat;
  end if;
  if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  lead := coalesce((c->>'lead')::boolean, false);
  today := (now() at time zone _sa_tz(coalesce(nullif(ch.restaurant, ''), c->>'restaurant')))::date;
  if t = 'task' then
    if not lead then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
    if ch.kind = 'net' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    it := _sa_chat_item(p_card->'item', array['lesson', 'quiz', 'module']);
    due := _sa_chat_date(p_card->>'due');
    if it is null or (p_card->>'due' is not null and (due is null or due < today or due > today + 60)) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    card := jsonb_strip_nulls(jsonb_build_object('t', 'task', 'item', it, 'due', to_char(due, 'YYYY-MM-DD'),
      'to', case when p_card->>'to' in ('waiter', 'bar', 'host') then p_card->>'to' else 'all' end));
  elsif t = 'share' then
    it := _sa_chat_item(p_card->'item', case when ch.kind = 'net' then array['lesson', 'quiz', 'module', 'ref'] else array['dish', 'cocktail', 'ref', 'lesson', 'quiz', 'module'] end);
    if it is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    card := jsonb_strip_nulls(jsonb_build_object('t', 'share', 'item', it, 'note', nullif(_sa_chat_cut(p_card->>'note', 200), '')));
  elsif t = 'poll' then
    if ch.kind = 'dm' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    q := _sa_chat_cut(p_card->>'q', 200);
    select coalesce(array_agg(s.v order by s.n), '{}') into opts
      from (select _sa_chat_cut(y.x, 60) v, y.n from jsonb_array_elements_text(case when jsonb_typeof(p_card->'opts') = 'array' then p_card->'opts' else '[]'::jsonb end) with ordinality y(x, n)) s
     where s.v <> '';
    if char_length(q) < 3 or cardinality(opts) < 2 or cardinality(opts) > 6
       or (select count(distinct _sa_chat_low(v)) from unnest(opts) v) <> cardinality(opts) then
      return jsonb_build_object('ok', false, 'error', 'bad_request');
    end if;
    card := jsonb_build_object('t', 'poll', 'q', q, 'opts', to_jsonb(opts));
  elsif t = 'brief' then
    if not lead then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
    if ch.kind <> 'team' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    select coalesce(array_agg(s.v order by s.n), '{}') into lines
      from (select _sa_chat_cut(y.x, 140) v, y.n from jsonb_array_elements_text(case when jsonb_typeof(p_card->'lines') = 'array' then p_card->'lines' else '[]'::jsonb end) with ordinality y(x, n)) s
     where s.v <> '';
    if cardinality(lines) = 0 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    card := jsonb_build_object('t', 'brief', 'date', to_char(today, 'YYYY-MM-DD'), 'title', coalesce(nullif(_sa_chat_cut(p_card->>'title', 80), ''), 'Брифинг смены'),
      'lines', to_jsonb(lines[1:8]));
    -- v97: брифинг дня уже в чате (отправили правку) — та же карточка, обновлённая, без второй
    select * into m from sa_chat_msgs x where x.chat_id = ch.id and x.kind = 'card' and not x.deleted and x.card->>'t' = 'brief'
       and x.card->>'date' = to_char(today, 'YYYY-MM-DD') order by x.id desc limit 1 for update;
    if m.id is not null then
      nc := card;
      update sa_chat_msgs x set card = nc, body = _sa_chat_card_sum(nc), emp_id = c->>'id', emp_name = coalesce(c->>'who', ''), updated_at = now()
       where x.id = m.id returning * into m;
      return jsonb_build_object('ok', true, 'again', true, 'msg', _sa_chat_smart1(c, ch, m));
    end if;
  elsif t = 'sched' then   -- v97: «График на ноябрь готов», «Пожелания на декабрь: до 20 ноября»
    if not lead then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
    if ch.kind <> 'team' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    mk := p_card->>'month';
    if coalesce(mk, '') !~ '^\d{4}-(0[1-9]|1[0-2])$' or to_date(mk || '-01', 'YYYY-MM-DD') < date_trunc('month', today)::date
       or to_date(mk || '-01', 'YYYY-MM-DD') > (date_trunc('month', today) + interval '3 months')::date then
      return jsonb_build_object('ok', false, 'error', 'bad_request');
    end if;
    if p_card->>'what' = 'wishes' then
      till := _sa_chat_date(p_card->>'until');
      if till is null or till < today or till > today + 62 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
      card := jsonb_build_object('t', 'sched', 'what', 'wishes', 'month', mk, 'until', to_char(till, 'YYYY-MM-DD'));
    else
      card := jsonb_build_object('t', 'sched', 'what', 'ready', 'month', mk);
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if _sa_chat_fast(c) then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), _sa_chat_card_sum(card), 'card', card) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  perform _sa_chat_notify(c, ch, m);
  -- задание: тем, кому оно и кто ещё не прошёл, пишет бот (кто сейчас не в чате); v97 — с кнопкой «Открыть урок»
  if t = 'task' and ch.kind <> 'dm' and _sa_tg_ready() then
    what := case it->>'kind' when 'quiz' then 'тест' when 'module' then 'тему' else 'урок' end || ' «' || (it->>'title') || '»' || coalesce(' ' || _sa_chat_due(due), '');
    select coalesce(array_agg(x.id), '{}') into ids from _sa_chat_task_who(ch, card, c->>'id') x;
    done := _sa_chat_task_done(ids, it);
    foreach e in array ids loop
      continue when e = any(done);
      perform _sa_chat_pingk(ch, e, _sa_chat_nm(c->>'who') || ' даёт задание: пройти ' || what || '. Открыть можно прямо из чата.', m.id, _sa_chat_task_kb(it), true);
    end loop;
  end if;
  -- v97: опрос руководителя — каждому в Telegram с вариантами-кнопками; «График готов» и «Пожелания» — с кнопкой в график
  if t in ('poll', 'sched') and lead and ch.kind in ('team', 'group') and _sa_tg_ready() then
    kb := case when t = 'poll'
      then (select jsonb_agg(jsonb_build_array(jsonb_build_object('text', o.v, 'callback_data', 'cv:' || m.id || ':' || (o.n - 1))) order by o.n) from unnest(opts) with ordinality o(v, n))
      else jsonb_build_array(jsonb_build_array(_sa_chat_tg_btn(case when card->>'what' = 'wishes' then 'Отметить пожелания' else 'Открыть график' end, 'schedule'))) end;
    for r in select x.id from _sa_chat_members(ch) x where x.id <> c->>'id' loop
      perform _sa_chat_pingk(ch, r.id, case when t = 'poll' then _sa_chat_nm(c->>'who') || ' спрашивает: ' || q
        else m.body || case when card->>'what' = 'wishes' then '. Отметь в графике, когда не можешь выйти.' else '. Проверь свои смены.' end end, m.id, kb, true);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- «Напомнить» по заданию: тем, кто ещё не прошёл, пишет бот (не чаще раза в 3 часа на задание)
create or replace function chat_task_remind(p_token text, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats; ids text[]; done text[]; e text; n int := 0; sent int := 0; tg bigint; what text; ready boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg for update;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind <> 'card' or m.card->>'t' <> 'task' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if m.card->>'reminded' is not null and (m.card->>'reminded')::timestamptz > now() - interval '3 hours' then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;
  select coalesce(array_agg(w.id), '{}') into ids from _sa_chat_task_who(ch, m.card, m.emp_id) w;
  done := _sa_chat_task_done(ids, m.card->'item');
  what := case m.card->'item'->>'kind' when 'quiz' then 'тест' when 'module' then 'тему' else 'урок' end || ' «' || (m.card->'item'->>'title') || '»' ||
    coalesce(' ' || _sa_chat_due(_sa_chat_date(m.card->>'due')), '');
  ready := _sa_tg_ready();
  foreach e in array ids loop
    continue when e = any(done);
    n := n + 1;
    if ready then
      tg := _sa_tg_chat(e, 'chat');
      if tg is not null then   -- v97: с кнопкой «Открыть урок»
        perform _sa_chat_tg(tg, _sa_chat_nm(c->>'who') || ' напоминает: пройди ' || what || '. Открыть можно прямо из чата.',
          _sa_chat_task_kb(m.card->'item') || jsonb_build_array(jsonb_build_array(_sa_chat_tg_open(ch.id, m.id))));
        sent := sent + 1;
      end if;
    end if;
  end loop;
  update sa_chat_msgs set card = card || jsonb_build_object('reminded', now()), updated_at = now() where id = m.id returning * into m;
  return jsonb_build_object('ok', true, 'n', n, 'sent', sent, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- голос в опросе: один вариант у человека; повторное нажатие на свой — снять
-- общая часть (v97: и кнопкой в Telegram — там повторное нажатие голос не снимает, p_toggle = false)
create or replace function _sa_poll_vote_do(c jsonb, m sa_chat_msgs, p_o int, p_toggle boolean)
returns sa_chat_msgs language plpgsql volatile security definer set search_path to public as $$
declare r sa_chat_msgs;
begin
  if exists (select 1 from sa_chat_votes v where v.msg_id = m.id and v.emp_id = c->>'id' and v.o = p_o) then
    if p_toggle then delete from sa_chat_votes where msg_id = m.id and emp_id = c->>'id'; end if;
  else
    insert into sa_chat_votes (msg_id, emp_id, emp_name, o) values (m.id, c->>'id', coalesce(c->>'who', ''), p_o)
      on conflict (msg_id, emp_id) do update set o = excluded.o, emp_name = excluded.emp_name, at = now();
  end if;
  update sa_chat_msgs set updated_at = now() where id = m.id returning * into r;
  return r;
end; $$;
create or replace function chat_poll_vote(p_token text, p_msg bigint, p_o int)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind <> 'card' or m.card->>'t' <> 'poll' or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_o is null or p_o < 0 or p_o >= jsonb_array_length(coalesce(m.card->'opts', '[]'::jsonb)) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  m := _sa_poll_vote_do(c, m, p_o, true);
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- ── стоп-лист: блюдо меню заведения (этап 4, restaurant_menu) — в стоп у всех; «Вернуть в меню» — по карточке ──
-- В блюде: stop = {since, by} или null и stopAt — когда меняли (Колода меню у руководителя берёт стоп с сервера,
-- если он новее своего).
create or replace function chat_stop_set(p_token text, p_chat bigint, p_dish text, p_on boolean, p_msg bigint default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats; ds jsonb; idx int; dish jsonb; ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; card jsonb; nc jsonb; m sa_chat_msgs; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or ch.kind not in ('team', 'leads', 'group') or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if to_regclass('public.restaurant_menu') is null then return jsonb_build_object('ok', false, 'error', 'no_menu'); end if;
  who := coalesce(c->>'who', '');
  if not coalesce(p_on, false) then
    select * into m from sa_chat_msgs where id = p_msg and chat_id = ch.id for update;
    if m.id is null or m.deleted or m.kind <> 'card' or m.card->>'t' <> 'stop' then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    if m.card->>'st' = 'off' then return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m)); end if;
  end if;
  select dishes into ds from restaurant_menu where restaurant = ch.restaurant for update;
  select y.i - 1, y.x into idx, dish from jsonb_array_elements(case when jsonb_typeof(ds) = 'array' then ds else '[]'::jsonb end) with ordinality y(x, i)
   where jsonb_typeof(y.x) = 'object' and y.x->>'id' = coalesce(case when coalesce(p_on, false) then p_dish else m.card->'dish'->>'id' end, '')
     and coalesce(y.x->>'kind', '') <> 'cocktail' and not coalesce((y.x->>'archived')::boolean, false)
   limit 1;
  if coalesce(p_on, false) then
    if dish is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    if _sa_chat_fast(c) then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;
    if jsonb_typeof(dish->'stop') is distinct from 'object' then
      update restaurant_menu set dishes = jsonb_set(ds, array[idx::text], dish || jsonb_build_object('stop', jsonb_build_object('since', ms, 'by', who), 'stopAt', ms)),
             updated_by = who, updated_at = now()
       where restaurant = ch.restaurant;
    end if;
    card := jsonb_build_object('t', 'stop', 'st', 'on', 'dish', jsonb_strip_nulls(jsonb_build_object('id', dish->>'id', 'name', _sa_chat_cut(dish->>'name', 120),
      'img', case when dish->>'img' ~ '^https://[^\s"<>]+$' and char_length(dish->>'img') <= 600 then dish->>'img' end)));
    insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
      values (ch.id, c->>'id', who, coalesce(c->>'restaurant', ''), _sa_chat_card_sum(card), 'card', card) returning * into m;
    perform _sa_chat_after_write(ch, c->>'id', m.id);
    return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
  end if;
  if dish is not null and jsonb_typeof(dish->'stop') = 'object' then
    update restaurant_menu set dishes = jsonb_set(ds, array[idx::text], dish || jsonb_build_object('stop', null, 'stopAt', ms)), updated_by = who, updated_at = now()
     where restaurant = ch.restaurant;
  end if;
  nc := m.card || jsonb_build_object('st', 'off', 'offBy', who, 'offAt', now());
  update sa_chat_msgs x set card = nc, body = _sa_chat_card_sum(nc), updated_at = now() where x.id = m.id returning * into m;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- ── Наставник в переписке ──
-- Ответ на «@Наставник …» (или «Наставник, …» в начале) — от приложения спросившего, через 10 минут уже нельзя, один на
-- вопрос; 30 ответов в день на заведение. p_body null — только проверить (до обращения к ИИ): {ok, check, left}.
create or replace function chat_ai_post(p_token text, p_chat bigint, p_reply bigint, p_body text default null, p_cards jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats; q sa_chat_msgs; rest text; tz text; used int; body text; cards jsonb := '[]'::jsonb; x jsonb; it jsonb; m sa_chat_msgs; low text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into ch from sa_chats where id = p_chat;
  if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  rest := coalesce(nullif(btrim(coalesce(c->>'restaurant', '')), ''), ch.restaurant);
  select * into q from sa_chat_msgs where id = p_reply and chat_id = ch.id;
  low := _sa_chat_low(q.body);
  if q.id is null or q.deleted or q.kind <> 'text' or q.emp_id <> c->>'id' or q.created_at < now() - interval '10 minutes'
     or not (low ~ '(^|[^а-яёa-z0-9_])@наставник([^а-яёa-z0-9_]|$)' or low ~ '^\s*наставник\s*[,:]') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if exists (select 1 from sa_chat_msgs y where y.chat_id = ch.id and y.kind = 'ai' and y.reply_to = q.id) then return jsonb_build_object('ok', false, 'error', 'already'); end if;
  tz := _sa_tz(rest);
  select count(*) into used from sa_chat_msgs y where y.kind = 'ai' and y.emp_rest = rest and y.created_at >= ((now() at time zone tz)::date)::timestamp at time zone tz;
  if used >= 30 then return jsonb_build_object('ok', false, 'error', 'ai_limit'); end if;
  if p_body is null then return jsonb_build_object('ok', true, 'check', true, 'left', 30 - used); end if;
  body := left(btrim(regexp_replace(regexp_replace(p_body, E'\r\n?', E'\n', 'g'), E'\n{3,}', E'\n\n', 'g')), 2000);
  if body = '' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  for x in select e from jsonb_array_elements(case when jsonb_typeof(p_cards) = 'array' then p_cards else '[]'::jsonb end) e limit 3 loop
    it := _sa_chat_item(x, array['dish', 'cocktail', 'ref', 'lesson', 'quiz', 'module']);
    if it is not null then cards := cards || jsonb_build_array(it); end if;
  end loop;
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, reply_to, card)
    values (ch.id, 'ai', 'Наставник', rest, body, 'ai', q.id, jsonb_build_object('t', 'ai', 'cards', cards)) returning * into m;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- ── 5г) Чат и приложение (v97) ─────────────────────────────────────────────────
-- Владелец: «что можно добавить в чат, что бы он был един с приложением» — «Да, давай»: кнопки «в чат» в приложении,
-- «Ищем в смену» из графика, стоп-лист из Меню и брифинг в чат, кнопки прямо в сообщениях бота и ответ из Telegram.

-- «Ищем в смену» из графика руководителя: должность, смена, сколько человек (1–5), записка; можно вместо того, кто не
-- сможет выйти (p_instead — его строка графика, тогда один человек). «Выйду» — у тех, кто может (та же должность, в этот
-- день без смены, правила графика), и сразу в графике (_sa_sh_take_do). p_chat null — «Вся команда».
create or replace function chat_shift_need(p_token text, p_chat bigint, p_date text, p_pos text, p_k text, p_n int default 1, p_note text default '', p_instead text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ch sa_chats; rest text; cfg jsonb; d date; today date; sh jsonb; cd jsonb; m sa_chat_msgs; t record; ist jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_chat is null then
    perform _sa_chat_ensure(c);
    select * into ch from sa_chats x where x.restaurant = nullif(btrim(coalesce(c->>'restaurant', '')), '') and x.kind = 'team';
  else
    select * into ch from sa_chats where id = p_chat;
  end if;
  if ch.id is null or ch.kind not in ('team', 'group') or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  rest := ch.restaurant;
  cfg := _sa_sh_cfg(rest);
  if cfg is null then return jsonb_build_object('ok', false, 'error', 'no_schedule'); end if;
  d := _sa_chat_date(p_date); today := (now() at time zone _sa_tz(rest))::date; n := coalesce(p_n, 1);
  if d is null or d < today or d > today + 45 or coalesce(p_pos, '') !~ '^[a-z_]{2,20}$' or n < 1 or n > 5 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  sh := _sa_sh_def(cfg, p_k);
  if sh is null then return jsonb_build_object('ok', false, 'error', 'no_shift'); end if;
  if p_instead is not null then
    ist := _sa_sh_row(cfg, p_instead);
    if ist is null or coalesce(ist->>'pos', '') <> p_pos or _sa_sh_code(rest, p_instead, d) is distinct from p_k then
      return jsonb_build_object('ok', false, 'error', 'bad_request');
    end if;
    n := 1;
  end if;
  if exists (select 1 from sa_chat_msgs x where x.chat_id = ch.id and x.kind = 'card' and not x.deleted and x.card->>'t' = 'shift' and x.card->>'mode' = 'need'
               and x.card->>'st' = 'open' and x.card->>'date' = to_char(d, 'YYYY-MM-DD') and x.card->>'posKey' = p_pos and x.card->>'k' = p_k
               and (x.card->'instead'->>'sid') is not distinct from p_instead) then
    return jsonb_build_object('ok', false, 'error', 'already');
  end if;
  if _sa_chat_fast(c) then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;
  cd := jsonb_strip_nulls(jsonb_build_object('t', 'shift', 'mode', 'need', 'date', to_char(d, 'YYYY-MM-DD'), 'k', p_k, 'label', coalesce(sh->>'name', p_k),
    'time', _sa_chat_hh(_sa_num(sh->>'from')) || '–' || _sa_chat_hh(_sa_num(sh->>'to')), 'pos', _sa_chat_spos(p_pos, false), 'posKey', p_pos, 'n', n,
    'from', c->>'id', 'fromName', coalesce(c->>'who', ''), 'note', nullif(_sa_chat_cut(p_note, 120), ''), 'st', 'open',
    'instead', case when ist is not null then jsonb_build_object('sid', ist->>'id', 'name', coalesce(ist->>'name', '')) end)) || jsonb_build_object('took', '[]'::jsonb);
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), _sa_chat_card_sum(cd), 'card', cd) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  -- тем, кто может выйти, — бот с кнопкой «Выйду»
  if _sa_tg_ready() then
    for t in select x.id from _sa_chat_members(ch) x where x.id <> c->>'id' loop
      if coalesce((_sa_sh_need_check(rest, cd, t.id)->>'can')::boolean, false) then
        perform _sa_chat_pingk(ch, t.id, _sa_chat_nm(c->>'who') || case when ist is not null then ' ищет замену в смену: ' else ' ищет ' || _sa_chat_spos_acc(p_pos, n) || ' в смену: ' end ||
          _sa_chat_dlong(d) || ' · ' || _sa_chat_low(cd->>'label') || ' ' || (cd->>'time') || '. Выйти можно прямо здесь.', m.id,
          jsonb_build_array(jsonb_build_array(jsonb_build_object('text', 'Выйду', 'callback_data', 'ct:' || m.id))), true);
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- предложения смен в чатах заведения на месяц — для экрана «График»: отдают, меняются, ищут в смену (открытые, с
-- сегодняшнего дня); тому, кто смотрит, — может ли он (can, why) и его ли это (mine)
create or replace function chat_shift_board(p_token text, p_month text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; today date; out jsonb := '[]'::jsonb; r record; cd jsonb; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null or coalesce(p_month, '') !~ '^\d{4}-(0[1-9]|1[0-2])$' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  today := (now() at time zone _sa_tz(rest))::date;
  for r in
    select x.id, x.chat_id, x.card from sa_chat_msgs x join sa_chats y on y.id = x.chat_id
     where y.restaurant = rest and y.kind in ('team', 'group') and x.kind = 'card' and not x.deleted and x.card->>'t' = 'shift'
       and x.card->>'st' = 'open' and left(x.card->>'date', 7) = p_month and x.card->>'date' >= to_char(today, 'YYYY-MM-DD')
     order by x.card->>'date', x.id
     limit 200
  loop
    select * into ch from sa_chats where id = r.chat_id;
    continue when not _sa_chat_ok(c, ch);
    cd := r.card;
    if cd->>'from' is distinct from c->>'id' then
      cd := cd || case when cd->>'mode' = 'need' then _sa_sh_need_can(rest, cd, c->>'id') else _sa_sh_can(rest, cd, c->>'id') end;
    end if;
    out := out || jsonb_build_array(jsonb_build_object('msg', r.id, 'chat', r.chat_id, 'mine', cd->>'from' = c->>'id', 'card', cd));
  end loop;
  return jsonb_build_object('ok', true, 'offers', out);
end; $$;

-- карточка коллеги (нажатие на имя в чате): должность, смена сегодня и следующая по графику (две недели вперёд);
-- коллега своего заведения, руководителю — и руководитель другого заведения (из «Руководителей сети»)
create or replace function chat_person(p_token text, p_emp text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; e record; cfg jsonb; today date; d date; mk text := ''; ms jsonb; k text; sh jsonb; tday jsonb; nxt jsonb; dm bigint; va text; vb text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select x.id::text as id, btrim(coalesce(x.name, '') || ' ' || coalesce(x.surname, '')) as name, lower(coalesce(x.position, '')) as pos, coalesce(x.restaurant, '') as rest,
         coalesce(x.is_admin, false) or lower(coalesce(x.position, '')) = any(_sa_chat_lead_pos()) as lead
    into e from employees x where x.id::text = p_emp and coalesce(x.status, 'active') = 'active';
  if e.id is null or not (e.rest = coalesce(c->>'restaurant', '') or (coalesce((c->>'lead')::boolean, false) and e.lead)) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  cfg := case when e.rest <> '' then _sa_sh_cfg(e.rest) end;
  if cfg is not null then
    today := (now() at time zone _sa_tz(e.rest))::date;
    for d in select g::date from generate_series(today, today + 14, interval '1 day') g loop
      if to_char(d, 'YYYY-MM') <> mk then mk := to_char(d, 'YYYY-MM'); ms := _sa_sh_staff(cfg, e.id, mk); end if;
      continue when ms is null;
      k := _sa_sh_code(e.rest, ms->>'id', d); sh := _sa_sh_def(cfg, k);
      continue when sh is null;
      if d = today then tday := jsonb_build_object('label', coalesce(sh->>'name', k), 'time', _sa_chat_hh(_sa_num(sh->>'from')) || '–' || _sa_chat_hh(_sa_num(sh->>'to')));
      else nxt := jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'label', coalesce(sh->>'name', k), 'time', _sa_chat_hh(_sa_num(sh->>'from')) || '–' || _sa_chat_hh(_sa_num(sh->>'to')));
      end if;
      exit when nxt is not null;
    end loop;
  end if;
  va := least(c->>'id', e.id); vb := greatest(c->>'id', e.id);
  select x.id into dm from sa_chats x where x.kind = 'dm' and x.restaurant = e.rest and x.a = va and x.b = vb;
  return jsonb_build_object('ok', true, 'person', jsonb_build_object('id', e.id, 'name', e.name, 'pos', e.pos, 'rest', e.rest, 'me', e.id = c->>'id',
    'same', e.rest = coalesce(c->>'restaurant', ''), 'today', tday, 'next', nxt, 'dm', dm));
end; $$;

-- стоп-лист из Меню: руководитель поставил блюдо в стоп в Меню — карточка в «Вся команда» (уже есть — вторую не ставим);
-- вернул в меню — открытые карточки этого блюда становятся «Снова в меню». Само меню здесь не трогаем: его публикует Меню.
create or replace function chat_stop_note(p_token text, p_dish text, p_on boolean)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; ch sa_chats; ds jsonb; dish jsonb; cd jsonb; m sa_chat_msgs; r record; n int := 0; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if to_regclass('public.restaurant_menu') is null then return jsonb_build_object('ok', false, 'error', 'no_menu'); end if;
  if coalesce(p_dish, '') = '' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  who := coalesce(c->>'who', '');
  perform _sa_chat_ensure(c);
  select * into ch from sa_chats x where x.restaurant = rest and x.kind = 'team';
  if coalesce(p_on, false) then
    select dishes into ds from restaurant_menu where restaurant = rest;
    select y.x into dish from jsonb_array_elements(case when jsonb_typeof(ds) = 'array' then ds else '[]'::jsonb end) y(x)
     where jsonb_typeof(y.x) = 'object' and y.x->>'id' = p_dish and coalesce(y.x->>'kind', '') <> 'cocktail' limit 1;
    if dish is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    select * into m from sa_chat_msgs x where x.chat_id = ch.id and x.kind = 'card' and not x.deleted and x.card->>'t' = 'stop' and x.card->>'st' = 'on'
       and x.card->'dish'->>'id' = p_dish order by x.id desc limit 1;
    if m.id is not null then return jsonb_build_object('ok', true, 'again', true, 'msg', _sa_chat_smart1(c, ch, m)); end if;
    if _sa_chat_fast(c) then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;
    cd := jsonb_build_object('t', 'stop', 'st', 'on', 'from', 'menu', 'dish', jsonb_strip_nulls(jsonb_build_object('id', dish->>'id', 'name', _sa_chat_cut(dish->>'name', 120),
      'img', case when dish->>'img' ~ '^https://[^\s"<>]+$' and char_length(dish->>'img') <= 600 then dish->>'img' end)));
    insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
      values (ch.id, c->>'id', who, coalesce(c->>'restaurant', ''), _sa_chat_card_sum(cd), 'card', cd) returning * into m;
    perform _sa_chat_after_write(ch, c->>'id', m.id);
    return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
  end if;
  for r in select x.id from sa_chat_msgs x join sa_chats y on y.id = x.chat_id
            where y.restaurant = rest and x.kind = 'card' and not x.deleted and x.card->>'t' = 'stop' and x.card->>'st' = 'on' and x.card->'dish'->>'id' = p_dish
  loop
    update sa_chat_msgs x set card = x.card || jsonb_build_object('st', 'off', 'offBy', who, 'offAt', now()), updated_at = now() where x.id = r.id returning * into m;
    update sa_chat_msgs x set body = _sa_chat_card_sum(x.card) where x.id = r.id returning * into m;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'n', n, 'msg', case when m.id is not null then _sa_chat_smart1(c, ch, m) end);
end; $$;

-- ── Telegram: кнопки в сообщениях бота и ответ в чат ──
-- кто нажал или ответил: сотрудник по связке Telegram (tg_links), как _sa_caller
create or replace function _sa_tg_caller(p_tg text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare e record;
begin
  if coalesce(p_tg, '') !~ '^\d{1,18}$' or to_regclass('public.tg_links') is null then return null; end if;
  select x.id::text as id, coalesce(x.name, '') as name, coalesce(x.surname, '') as surname, x.restaurant, lower(coalesce(x.position, '')) as pos, coalesce(x.is_admin, false) as adm
    into e from tg_links l join employees x on x.id::text = l.emp_id
   where l.chat_id = p_tg::bigint and coalesce(x.status, 'active') = 'active' order by l.updated_at desc nulls last limit 1;
  if e.id is null then return null; end if;
  return jsonb_build_object('id', e.id, 'name', e.name, 'surname', e.surname, 'who', btrim(e.name || ' ' || e.surname), 'restaurant', e.restaurant,
    'position', e.pos, 'admin', e.adm, 'network', e.adm or e.pos = 'senior', 'lead', e.adm or e.pos = any(_sa_chat_lead_pos()));
end; $$;

-- нажатие: cg:<вызов> — «Иду»; ct:<карточка> — «Забрать» или «Выйду»; cv:<опрос>:<вариант> — голос. Сообщение бота
-- дописывается итогом; кнопки действий уходят (у опроса остаются: голос можно поменять), «Открыть чат» остаётся.
create or replace function _sa_chat_tg_cb(cq jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare mm text[]; c jsonb; m sa_chat_msgs; ch sa_chats; r jsonb; done text; tip text; kb jsonb; msg jsonb; o int; ok boolean := true;
begin
  mm := regexp_match(coalesce(cq->>'data', ''), '^(cg|ct|cv):(\d{1,18})(?::(\d))?$');
  if mm is null then
    perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id'));
    return jsonb_build_object('ok', true, 'skip', 'data');
  end if;
  c := _sa_tg_caller(cq->'from'->>'id');
  if c is null then
    perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'show_alert', true,
      'text', 'Этот Telegram не связан с приложением. Открой приложение: «Смена» → «Напоминания в Telegram».'));
    return jsonb_build_object('ok', true, 'skip', 'who');
  end if;
  select * into m from sa_chat_msgs where id = mm[2]::bigint;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or not _sa_chat_ok(c, ch) then
    perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', 'Этого сообщения в чате уже нет'));
    return jsonb_build_object('ok', true, 'skip', 'row');
  end if;
  if mm[1] = 'cg' then
    if m.kind <> 'call' or m.emp_id = c->>'id' then
      perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id'));
      return jsonb_build_object('ok', true, 'skip', 'call');
    end if;
    m := _sa_chat_go_do(c, m);
    done := 'Ты идёшь.'; tip := 'Отметил: ты идёшь';
  elsif mm[1] = 'ct' then
    r := _sa_sh_take_do(c, m.id);
    ok := coalesce((r->>'ok')::boolean, false);
    done := case when ok and m.card->>'mode' = 'need' then 'Ты выходишь в эту смену. График обновлён.'
      when ok then 'Смена твоя. График обновлён.'
      when r->>'error' = 'taken' then case when m.card->>'mode' = 'need' then 'Уже нашли, кто выйдет.' else 'Смену уже забрали.' end
      when r->>'error' = 'not_allowed' then coalesce(nullif(regexp_replace(coalesce(r->>'why', ''), '\.?$', '.'), '.'), 'Эту смену взять нельзя.')
      when r->>'error' = 'no_schedule' then 'График смен ещё не заполнен.'
      else 'Не получилось. Открой чат.' end;
    tip := case when ok then 'Готово, график обновлён' else done end;
  else
    o := case when mm[3] is not null then mm[3]::int end;
    if m.kind <> 'card' or m.card->>'t' <> 'poll' or o is null or o >= jsonb_array_length(coalesce(m.card->'opts', '[]'::jsonb)) then
      perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id'));
      return jsonb_build_object('ok', true, 'skip', 'option');
    end if;
    m := _sa_poll_vote_do(c, m, o, false);
    done := 'Твой ответ: «' || (m.card->'opts'->>o) || '».'; tip := 'Голос учтён';
  end if;
  msg := cq->'message';
  if jsonb_typeof(msg) = 'object' and msg->'chat'->>'id' is not null and msg->>'message_id' is not null then
    select coalesce(jsonb_agg(rw), '[]'::jsonb) into kb
      from jsonb_array_elements(case when jsonb_typeof(msg->'reply_markup'->'inline_keyboard') = 'array' then msg->'reply_markup'->'inline_keyboard' else '[]'::jsonb end) rw
     where mm[1] = 'cv' or not exists (select 1 from jsonb_array_elements(rw) b where b ? 'callback_data');
    perform _sa_chat_tg_api('editMessageText', jsonb_build_object('chat_id', msg->'chat'->'id', 'message_id', msg->'message_id', 'disable_web_page_preview', true,
      'text', left(regexp_replace(coalesce(msg->>'text', ''), E'\n\n(Ты идёшь|Смена твоя|Ты выходишь|Твой ответ|Смену уже|Уже нашли|Не получится|Не получилось|Эту смену|График смен|Этот день|Тебя нет|Выйти могут|Забрать могут|В этот день)[^\n]*$', '') || E'\n\n' || done, 4000),
      'reply_markup', jsonb_build_object('inline_keyboard', kb)));
  end if;
  perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', left(tip, 190)));
  return jsonb_build_object('ok', true, 'act', mm[1], 'msg', m.id, 'done', ok);
end; $$;

-- ответ на сообщение бота: текст уходит в чат, о котором было сообщение (кнопка «Открыть чат»: go=chat_<чат>_<сообщение>;
-- с сообщением — ответом с цитатой). Только личная переписка с ботом и сотрудник со связкой Telegram.
create or replace function _sa_chat_tg_reply(p_msg jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rm jsonb; u text; mm text[]; ch sa_chats; body text; m sa_chat_msgs; q bigint; tgc bigint; place text;
begin
  tgc := case when coalesce(p_msg->'chat'->>'id', '') ~ '^\d{1,18}$' then (p_msg->'chat'->>'id')::bigint end;
  if tgc is null or coalesce(p_msg->'chat'->>'type', 'private') <> 'private' then return jsonb_build_object('ok', true, 'skip', 'chat'); end if;
  c := _sa_tg_caller(p_msg->'from'->>'id');
  if c is null then return jsonb_build_object('ok', true, 'skip', 'who'); end if;
  rm := p_msg->'reply_to_message';
  select coalesce(b->'web_app'->>'url', b->>'url') into u
    from jsonb_array_elements(case when jsonb_typeof(rm->'reply_markup'->'inline_keyboard') = 'array' then rm->'reply_markup'->'inline_keyboard' else '[]'::jsonb end) rw,
         jsonb_array_elements(case when jsonb_typeof(rw) = 'array' then rw else '[]'::jsonb end) b
   where coalesce(b->'web_app'->>'url', b->>'url', '') ~ 'chat_\d' limit 1;
  mm := regexp_match(coalesce(u, ''), 'chat_(\d{1,18})(?:_(\d{1,18}))?');
  if mm is null then
    perform _sa_chat_tg(tgc, 'Этот ответ в чат не уходит. Ответь на сообщение о переписке, и ответ придёт в чат.', null);
    return jsonb_build_object('ok', true, 'skip', 'link');
  end if;
  select * into ch from sa_chats where id = mm[1]::bigint;
  if ch.id is null or not _sa_chat_ok(c, ch) then
    perform _sa_chat_tg(tgc, 'Этого чата у тебя больше нет.', null);
    return jsonb_build_object('ok', true, 'skip', 'gone');
  end if;
  body := left(btrim(regexp_replace(regexp_replace(coalesce(p_msg->>'text', ''), E'\r\n?', E'\n', 'g'), E'\n{3,}', E'\n\n', 'g')), 1000);
  if body = '' then
    perform _sa_chat_tg(tgc, 'В чат из Telegram уходит только текст. Фото можно отправить из приложения.', jsonb_build_array(jsonb_build_array(_sa_chat_tg_open(ch.id, null))));
    return jsonb_build_object('ok', true, 'skip', 'text');
  end if;
  if (select count(*) from sa_chat_msgs x where x.emp_id = c->>'id' and x.created_at > now() - interval '1 minute') >= 20 then
    perform _sa_chat_tg(tgc, 'Слишком часто. Подожди минуту.', null);
    return jsonb_build_object('ok', true, 'skip', 'fast');
  end if;
  q := case when mm[2] is not null then _sa_chat_reply_ok(ch, mm[2]::bigint) end;
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, reply_to)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), body, q) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  perform _sa_chat_notify(c, ch, m);
  place := case ch.kind when 'team' then '«Вся команда»' when 'leads' then '«Старшие»' when 'net' then '«Руководители сети»'
    when 'group' then '«' || coalesce(ch.title, 'Чат') || '»' else 'личную переписку' end;
  perform _sa_chat_tg(tgc, 'Ушло в ' || place || '.', jsonb_build_array(jsonb_build_array(_sa_chat_tg_open(ch.id, m.id))),
    jsonb_build_object('reply_parameters', jsonb_build_object('message_id', p_msg->'message_id', 'allow_sending_without_reply', true)));
  return jsonb_build_object('ok', true, 'sent', m.id, 'chat', ch.id);
end; $$;

-- Вебхук бота (функция tg-bot, этап 31): «Вопрос дня» — как в этапе 31; v97 — кнопки чата, ответ на сообщение бота,
-- подсказка на просто текст. Этап 31 после этого запускать не нужно; если запустили — перезапусти этот файл.
create or replace function sa_tg_update(p_secret text, p_update jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare want text; cq jsonb; m text[]; v_id bigint; v_n int; nx record; v_from bigint; v_ok boolean; v_c int;
  txt text; msg jsonb; mt text; chat bigint;
begin
  select value into want from sa_settings where key = 'tg_webhook_secret';
  if coalesce(want, '') = '' or coalesce(p_secret, '') <> want then return jsonb_build_object('ok', false, 'error', 'secret'); end if;
  if p_update is null or jsonb_typeof(p_update) <> 'object' then return jsonb_build_object('ok', true, 'skip', 'empty'); end if;

  cq := p_update->'callback_query';
  if cq is not null and jsonb_typeof(cq) = 'object' then
    if coalesce(cq->>'data', '') ~ '^(cg|ct|cv):' then return _sa_chat_tg_cb(cq); end if;   -- v97: кнопки чата
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

  -- v97: ответ на сообщение бота — в чат
  msg := p_update->'message';
  if jsonb_typeof(msg) = 'object' and jsonb_typeof(msg->'reply_to_message') = 'object' and coalesce(msg->'reply_to_message'->'from'->>'is_bot', '') = 'true' then
    return _sa_chat_tg_reply(msg);
  end if;
  -- сообщение боту: на /start — что здесь приходит, и кнопка в приложение
  mt := coalesce(p_update->'message'->>'text', '');
  if mt ~ '^/start' and coalesce(p_update->'message'->'chat'->>'id', '') ~ '^-?\d{1,18}$' then
    chat := (p_update->'message'->'chat'->>'id')::bigint;
    perform sa_tg_send(chat, 'Здесь приходят сообщения академии: разминка перед сменой, вопрос дня, лига недели, чат смены. Уроки и тесты ждут в приложении. На сообщение из чата можно ответить прямо здесь.', 'Открыть академию', null);
    return jsonb_build_object('ok', true, 'start', true);
  end if;
  -- v97: просто текст боту от сотрудника — как ответить в чат
  if mt <> '' and coalesce(p_update->'message'->'chat'->>'type', '') = 'private' and coalesce(p_update->'message'->'chat'->>'id', '') ~ '^\d{1,18}$'
     and _sa_tg_caller(p_update->'message'->'from'->>'id') is not null then
    perform _sa_chat_tg((p_update->'message'->'chat'->>'id')::bigint, 'Чтобы написать в чат, ответь на сообщение о переписке: смахни его влево или нажми «Ответить».', null);
    return jsonb_build_object('ok', true, 'hint', true);
  end if;
  return jsonb_build_object('ok', true, 'skip', 'other');
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
grant execute on function chat_group_create(text, text, text[]) to anon, authenticated;
grant execute on function chat_group_edit(text, bigint, text, text[], text[]) to anon, authenticated;
grant execute on function chat_group_leave(text, bigint) to anon, authenticated;
grant execute on function chat_group_delete(text, bigint) to anon, authenticated;
grant execute on function chat_shift_mine(text) to anon, authenticated;
grant execute on function chat_shift_offer(text, bigint, text, text, text[], text) to anon, authenticated;
grant execute on function chat_shift_take(text, bigint) to anon, authenticated;
grant execute on function chat_shift_options(text, bigint) to anon, authenticated;
grant execute on function chat_shift_swap(text, bigint, text) to anon, authenticated;
grant execute on function chat_shift_cancel(text, bigint) to anon, authenticated;
grant execute on function chat_card_send(text, bigint, jsonb) to anon, authenticated;
grant execute on function chat_task_remind(text, bigint) to anon, authenticated;
grant execute on function chat_poll_vote(text, bigint, int) to anon, authenticated;
grant execute on function chat_stop_set(text, bigint, text, boolean, bigint) to anon, authenticated;
grant execute on function chat_ai_post(text, bigint, bigint, text, jsonb) to anon, authenticated;
grant execute on function chat_shift_need(text, bigint, text, text, text, int, text, text) to anon, authenticated;
grant execute on function chat_shift_board(text, text) to anon, authenticated;
grant execute on function chat_person(text, text) to anon, authenticated;
grant execute on function chat_stop_note(text, text, boolean) to anon, authenticated;
-- вебхук бота — только функция tg-bot (сервисный ключ)
revoke all on function sa_tg_update(text, jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function sa_tg_update(text, jsonb) to service_role'; end if;
end $$;
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
revoke all on function _sa_chat_title(text) from public, anon, authenticated;
revoke all on function _sa_chat_pick(jsonb, text[]) from public, anon, authenticated;
revoke all on function _sa_chat_added(jsonb, sa_chats, text[]) from public, anon, authenticated;
revoke all on function _sa_chat_group_out(jsonb, sa_chats) from public, anon, authenticated;
revoke all on function _sa_chat_low(text) from public, anon, authenticated;
revoke all on function _sa_chat_nm(text) from public, anon, authenticated;
revoke all on function _sa_chat_date(text) from public, anon, authenticated;
revoke all on function _sa_chat_dshort(date) from public, anon, authenticated;
revoke all on function _sa_chat_dlong(date) from public, anon, authenticated;
revoke all on function _sa_chat_due(date) from public, anon, authenticated;
revoke all on function _sa_chat_hh(numeric) from public, anon, authenticated;
revoke all on function _sa_chat_spos(text, boolean) from public, anon, authenticated;
revoke all on function _sa_sh_cfg(text) from public, anon, authenticated;
revoke all on function _sa_sh_defs(jsonb) from public, anon, authenticated;
revoke all on function _sa_sh_def(jsonb, text) from public, anon, authenticated;
revoke all on function _sa_sh_row(jsonb, text) from public, anon, authenticated;
revoke all on function _sa_sh_staff(jsonb, text, text) from public, anon, authenticated;
revoke all on function _sa_sh_code(text, text, date, jsonb) from public, anon, authenticated;
revoke all on function _sa_sh_why(text, jsonb, jsonb, date, text, jsonb) from public, anon, authenticated;
revoke all on function _sa_sh_check(text, jsonb, text) from public, anon, authenticated;
revoke all on function _sa_sh_can(text, jsonb, text) from public, anon, authenticated;
revoke all on function _sa_sh_options(text, jsonb, text) from public, anon, authenticated;
revoke all on function _sa_sh_put(jsonb, text, text, text) from public, anon, authenticated;
revoke all on function _sa_sh_apply(text, text, jsonb) from public, anon, authenticated;
revoke all on function _sa_sh_line(jsonb) from public, anon, authenticated;
revoke all on function _sa_sh_done(sa_chats, sa_chat_msgs, jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_card_sum(jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_item(jsonb, text[]) from public, anon, authenticated;
revoke all on function _sa_chat_task_who(sa_chats, jsonb, text) from public, anon, authenticated;
revoke all on function _sa_chat_task_done(text[], jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_task(sa_chats, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function _sa_chat_smart(jsonb, sa_chats, jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_smart1(jsonb, sa_chats, sa_chat_msgs) from public, anon, authenticated;
revoke all on function _sa_chat_fast(jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_tg_btn(text, text) from public, anon, authenticated;
revoke all on function _sa_chat_tg_open(bigint, bigint) from public, anon, authenticated;
revoke all on function _sa_chat_tg(bigint, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_tg_api(text, jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_pingk(sa_chats, text, text, bigint, jsonb, boolean) from public, anon, authenticated;
revoke all on function _sa_chat_go_do(jsonb, sa_chat_msgs) from public, anon, authenticated;
revoke all on function _sa_sh_take_do(jsonb, bigint) from public, anon, authenticated;
revoke all on function _sa_poll_vote_do(jsonb, sa_chat_msgs, int, boolean) from public, anon, authenticated;
revoke all on function _sa_sh_need_check(text, jsonb, text) from public, anon, authenticated;
revoke all on function _sa_sh_need_can(text, jsonb, text) from public, anon, authenticated;
revoke all on function _sa_chat_spos_acc(text, int) from public, anon, authenticated;
revoke all on function _sa_chat_mon(int, boolean) from public, anon, authenticated;
revoke all on function _sa_chat_task_kb(jsonb) from public, anon, authenticated;
revoke all on function _sa_tg_caller(text) from public, anon, authenticated;
revoke all on function _sa_chat_tg_cb(jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_tg_reply(jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'чат смены: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('chat_list', 'chat_unread', 'chat_open', 'chat_read', 'chat_send', 'chat_photo_send', 'chat_photo', 'chat_edit', 'chat_react', 'chat_pin',
                       'chat_dm', 'chat_people', 'chat_call', 'chat_go', 'chat_delete', 'chat_clear',
                       'chat_group_create', 'chat_group_edit', 'chat_group_leave', 'chat_group_delete',
                       'chat_shift_mine', 'chat_shift_offer', 'chat_shift_take', 'chat_shift_options', 'chat_shift_swap', 'chat_shift_cancel',
                       'chat_card_send', 'chat_task_remind', 'chat_poll_vote', 'chat_stop_set', 'chat_ai_post',
                       'chat_shift_need', 'chat_shift_board', 'chat_person', 'chat_stop_note')) ||
  ' функций из 35 · таблицы: ' || case when to_regclass('public.sa_chats') is not null and to_regclass('public.sa_chat_msgs') is not null
    and to_regclass('public.sa_chat_reads') is not null and to_regclass('public.sa_chat_reacts') is not null and to_regclass('public.sa_chat_photos') is not null
    and to_regclass('public.sa_chat_members') is not null and to_regclass('public.sa_chat_votes') is not null
    then 'есть' else 'НЕТ' end ||
  ' · вид «Чат» в напоминаниях: ' || case when 'chat' = any(_sa_notify_kinds()) then 'да' else 'нет' end ||
  ' · Telegram: ' || case when _sa_tg_ready() then 'бот на месте' else 'нет (чат работает, без сообщений)' end ||
  ' · кнопки в Telegram: ' || case when coalesce((select value from sa_settings where key = 'tg_webhook_secret'), '') <> '' then 'да'
    else 'нужен вебхук бота (этап 31: select sa_tg_setup_code();)' end as result;
