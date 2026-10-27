-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 39 (v99, Доп. 412): удобство каждый день.
--
--   • вход через Telegram без кода: tg_login(p_init_data) — приложение открыли в Telegram, сервер проверил подпись
--     Telegram (как у напоминаний, этап 22б) и узнал человека; tg_auth_bind(p_token, p_init_data) — запомнить этот
--     Telegram после входа по коду; tg_auth_off(p_token, p_init_data) — человек вышел сам: этот Telegram больше не входит
--     без кода. Таблица sa_tg_auth. Без связки сервер узнаёт и тех, кто подключал напоминания (tg_links);
--   • упоминания в чате: «@Имя» и «@все» (только руководитель и старший) — колонка sa_chat_msgs.mentions (разбирает
--     триггер, имена — как подсказки в приложении: имя, у тёзок — имя и буква фамилии). Упомянутому пишет бот, даже
--     если на сообщение не отвечали; «@все» — всем в чате, не чаще раза в 10 минут на чат. В списке чатов — число
--     непрочитанных упоминаний (ment);
--   • поиск по переписке: chat_search(p_token, p_q, p_chat) — по всем моим чатам или по одному, до 50 последних;
--   • «Опаздываю»: chat_late(p_token, p_chat, p_min, p_note) — карточка в «Вся команда» (или свой чат), руководителям
--     в смене пишет бот с кнопкой «Принято»; chat_late_ok(p_token, p_msg) — руководитель ответил «Принято», опоздавшему
--     пишет бот; late_month(p_token, p_month) — отметки для «Графика» (руководителю — все, остальным — свои).
--     Таблица sa_late (одна отметка на человека в день);
--   • смены в календаре телефона: cal_key(p_token, p_reset) — личная ссылка (сбросить — старая перестанет работать);
--     cal_feed(p_key, p_page) — смены по ссылке за месяц назад и два вперёд (её читает /api/cal на Vercel). Таблица sa_cal_keys;
--   • проверка сервера владельцем: server_check(p_token, p_fns, p_buckets, p_url) — какие функции и корзины на месте,
--     Telegram, расписания pg_cron; owner_tg_setup(p_token, p_app) — код подключения бота из приложения (вместо SQL);
--   • бот: /smena — ближайшие смены; отметка последнего события от Telegram (tg_last_update) для экрана «Сервер»;
--     sa_tg_setup_take отдаёт адрес приложения — функция tg-bot ставит кнопку «Академия» у поля ввода и список команд.
--
-- Нужны этапы 21, 22б, 24, 25, 31 и 38. Ничего не удаляет. Можно запускать повторно.
-- Этот файл заменяет sa_tg_update, _sa_chat_view, sa_tg_setup_take и sa_tg_setup_code: если после него снова запускали
-- этап 31 или 38, запусти и этот файл ещё раз.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public._sa_tg_check(text,text)') is null then
    raise exception 'Сначала этап 22б (supabase-stage22b-telegram-reminders.sql): нужны tg_links и проверка подписи Telegram';
  end if;
  if to_regprocedure('public.sa_tg_setup_take(text,boolean)') is null then
    raise exception 'Сначала этап 31 (supabase-stage31-qday.sql): нужно подключение бота (sa_tg_setup_take)';
  end if;
  if to_regprocedure('public.chat_person(text,text)') is null or to_regprocedure('public._sa_chat_pingk(sa_chats,text,text,bigint,jsonb,boolean)') is null then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql), версия v97 и новее: нужен чат смены';
  end if;
end $$;

-- ── 1) Таблицы ─────────────────────────────────────────────────────────────────
-- Вход через Telegram: какой Telegram (id пользователя) входит за какого сотрудника. off — человек вышел сам: этот
-- Telegram без кода больше не входит (до следующего входа по коду).
create table if not exists sa_tg_auth (
  tg_id bigint primary key,
  emp_id text,
  off boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists sa_tg_auth_emp on sa_tg_auth (emp_id);

-- Упоминания: id сотрудников и 'all' («@все»)
alter table sa_chat_msgs add column if not exists mentions text[];
create index if not exists sa_chat_msgs_ment on sa_chat_msgs using gin (mentions) where mentions is not null;

-- «Опаздываю»: одна отметка на человека в день (последняя); ok_* — кто из руководителей ответил «Принято»
create table if not exists sa_late (
  emp_id text not null,
  day date not null,
  restaurant text not null default '',
  emp_name text not null default '',
  min int not null,
  eta text,
  note text,
  msg_id bigint,
  ok_by text,
  ok_name text,
  ok_at timestamptz,
  at timestamptz not null default now(),
  primary key (emp_id, day)
);
create index if not exists sa_late_rest on sa_late (restaurant, day);

-- Календарь: личная ссылка сотрудника; used_at — когда телефон последний раз забирал смены
create table if not exists sa_cal_keys (
  emp_id text primary key,
  k text not null unique,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table sa_tg_auth enable row level security;
alter table sa_late enable row level security;
alter table sa_cal_keys enable row level security;
revoke all on table sa_tg_auth, sa_late, sa_cal_keys from public, anon, authenticated;

-- ── 2) Вход через Telegram ─────────────────────────────────────────────────────
-- время подписи (auth_date) из initData; нет — null
create or replace function _sa_tg_auth_date(p_init text)
returns bigint language sql immutable as $$
  select case when m is not null then m[1]::bigint end from (select regexp_match(coalesce(p_init, ''), '(?:^|&)auth_date=(\d{1,12})(?:&|$)') m) x
$$;

-- проверка initData для входа: подпись бота и не старше суток → Telegram id; иначе код ошибки
create or replace function _sa_tg_who(p_init text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare bot text; u jsonb; ad bigint;
begin
  bot := _sa_tg_token();
  if bot is null then return jsonb_build_object('error', 'no_bot'); end if;
  if coalesce(p_init, '') = '' or char_length(p_init) > 4096 then return jsonb_build_object('error', 'bad_init'); end if;
  u := _sa_tg_check(p_init, bot);
  if u is null then return jsonb_build_object('error', 'bad_init'); end if;
  ad := _sa_tg_auth_date(p_init);
  if u ? 'stale' or ad is null or ad < extract(epoch from now())::bigint - 86400 then return jsonb_build_object('error', 'stale'); end if;
  if coalesce(u->>'id', '') !~ '^\d{1,18}$' then return jsonb_build_object('error', 'bad_init'); end if;
  return jsonb_build_object('tg', (u->>'id')::bigint);
end; $$;

-- войти: Telegram узнан (связка sa_tg_auth или напоминания tg_links) → новая сессия, как у входа по коду (redeem_code)
create or replace function tg_login(p_init_data text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare w jsonb; tid bigint; a sa_tg_auth; emp text; e record; tok text;
begin
  w := _sa_tg_who(p_init_data);
  if w ? 'error' then return jsonb_build_object('ok', false, 'error', w->>'error'); end if;
  tid := (w->>'tg')::bigint;
  select * into a from sa_tg_auth where tg_id = tid;
  if a.tg_id is not null then
    if a.off or a.emp_id is null then return jsonb_build_object('ok', false, 'error', 'not_linked'); end if;
    emp := a.emp_id;
  else
    select l.emp_id into emp from tg_links l where l.chat_id = tid order by l.updated_at desc nulls last limit 1;
  end if;
  if emp is null then return jsonb_build_object('ok', false, 'error', 'not_linked'); end if;
  select x.id, x.name, x.surname, x.restaurant, x.position, coalesce(x.is_admin, false) as is_admin, coalesce(x.status, 'active') as st
    into e from employees x where x.id::text = emp;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_linked'); end if;
  if e.st <> 'active' then return jsonb_build_object('ok', false, 'error', 'disabled'); end if;
  insert into sessions (employee_id) values (e.id) returning token::text into tok;
  begin
    execute 'update employees set last_seen_at = now() where id = $1' using e.id;
  exception when others then null;
  end;
  insert into sa_tg_auth (tg_id, emp_id, off, at) values (tid, e.id::text, false, now())
    on conflict (tg_id) do update set emp_id = excluded.emp_id, off = false, at = now();
  return jsonb_build_object('ok', true, 'token', tok, 'employee', jsonb_build_object('id', e.id, 'name', e.name, 'surname', e.surname,
    'restaurant', e.restaurant, 'position', e.position, 'is_admin', e.is_admin));
end; $$;

-- запомнить: этот Telegram входит за меня (после входа по коду и при открытии приложения в Telegram)
create or replace function tg_auth_bind(p_token text, p_init_data text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; w jsonb; tid bigint;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  w := _sa_tg_who(p_init_data);
  if w ? 'error' then return jsonb_build_object('ok', false, 'error', w->>'error'); end if;
  tid := (w->>'tg')::bigint;
  insert into sa_tg_auth (tg_id, emp_id, off, at) values (tid, c->>'id', false, now())
    on conflict (tg_id) do update set emp_id = excluded.emp_id, off = false, at = now();
  return jsonb_build_object('ok', true);
end; $$;

-- вышел сам («Выйти с этого устройства» в Telegram): этот Telegram без кода больше не входит — и по связке
-- напоминаний (tg_links) тоже, до следующего входа по коду
create or replace function tg_auth_off(p_token text, p_init_data text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; bot text; u jsonb; tid bigint;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  bot := _sa_tg_token();
  if bot is null then return jsonb_build_object('ok', false, 'error', 'no_bot'); end if;
  -- выход — по токену сессии; подпись Telegram нужна, чтобы знать, какой это Telegram (до 7 дней, как у напоминаний)
  u := case when coalesce(p_init_data, '') <> '' and char_length(p_init_data) <= 4096 then _sa_tg_check(p_init_data, bot) end;
  if u is null or coalesce(u->>'id', '') !~ '^\d{1,18}$' then return jsonb_build_object('ok', false, 'error', 'bad_init'); end if;
  tid := (u->>'id')::bigint;
  insert into sa_tg_auth (tg_id, emp_id, off, at) values (tid, null, true, now())
    on conflict (tg_id) do update set emp_id = null, off = true, at = now();
  return jsonb_build_object('ok', true);
end; $$;

-- ── 3) Упоминания в чате ──────────────────────────────────────────────────────
-- спецсимволы регулярного выражения — буквально
create or replace function _sa_re_esc(p text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(p, ''), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
$$;
-- нижний регистр с ё как е (как в приложении)
create or replace function _sa_low_e(p text)
returns text language sql immutable as $$
  select replace(_sa_chat_low(p), 'ё', 'е')
$$;
-- имена для «@»: имя; у тёзок в этом чате — имя и буква фамилии («Анна С.»). Так же считает приложение (lib/chat-mention.js)
create or replace function _sa_chat_ment_names(ch sa_chats)
returns table (id text, disp text) language sql stable security definer set search_path to public as $$
  select x.id, case when count(*) over (partition by _sa_low_e(x.fn)) > 1 and x.sn <> '' then x.fn || ' ' || upper(left(x.sn, 1)) || '.' else x.fn end
    from (select m.id, split_part(w, ' ', 1) fn, split_part(w, ' ', 2) sn
            from (select y.id, btrim(regexp_replace(coalesce(y.name, ''), '\s+', ' ', 'g')) w from _sa_chat_members(ch) y) m) x
   where x.fn <> ''
$$;
-- кого упомянули в тексте: id сотрудников чата (кроме автора) и 'all' — «@все» руководителя или старшего; в личной — никого
create or replace function _sa_chat_ment_parse(ch sa_chats, p_body text, p_author text, p_lead boolean)
returns text[] language plpgsql stable security definer set search_path to public as $$
declare out text[] := '{}'; r record; b text;
begin
  if ch.id is null or ch.kind = 'dm' or position('@' in coalesce(p_body, '')) = 0 then return null; end if;
  b := _sa_low_e(p_body);
  for r in select * from _sa_chat_ment_names(ch) loop
    continue when r.id = coalesce(p_author, '');
    if b ~ ('(^|[^а-яеa-z0-9_])@' || _sa_re_esc(_sa_low_e(r.disp)) || '($|[^а-яеa-z0-9_])') then out := out || r.id; end if;
  end loop;
  if coalesce(p_lead, false) and b ~ '(^|[^а-яеa-z0-9_])@(все|всем|all)($|[^а-яеa-z0-9_])' then out := out || 'all'::text; end if;
  return case when cardinality(out) > 0 then out end;
end; $$;

-- триггер: упоминания разбираются при записи текста или фото с подписью (и при правке)
create or replace function _sa_chat_ment_trg()
returns trigger language plpgsql security definer set search_path to public as $$
declare ch sa_chats; lead boolean;
begin
  if NEW.kind not in ('text', 'photo') or NEW.deleted or position('@' in coalesce(NEW.body, '')) = 0 then
    NEW.mentions := null;
    return NEW;
  end if;
  select * into ch from sa_chats where id = NEW.chat_id;
  select coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any(_sa_chat_lead_pos()) into lead from employees e where e.id::text = NEW.emp_id;
  NEW.mentions := _sa_chat_ment_parse(ch, NEW.body, NEW.emp_id, coalesce(lead, false));
  return NEW;
end; $$;
drop trigger if exists sa_chat_ment on sa_chat_msgs;
create trigger sa_chat_ment before insert or update of body on sa_chat_msgs for each row execute function _sa_chat_ment_trg();

-- после записи нового сообщения: упомянутым пишет бот (даже если в Telegram недавно писали об этой переписке); «@все» —
-- всем участникам, не чаще раза в 10 минут на чат. Кто сейчас в чате (читал минуту назад), тому бот не пишет.
create or replace function _sa_chat_ment_ping_trg()
returns trigger language plpgsql security definer set search_path to public as $$
declare ch sa_chats; nm text; place text; what text; x text; ids text[];
begin
  if NEW.mentions is null or cardinality(NEW.mentions) = 0 or NEW.deleted then return null; end if;
  select * into ch from sa_chats where id = NEW.chat_id;
  if ch.id is null or not _sa_tg_ready() then return null; end if;
  nm := _sa_chat_nm(NEW.emp_name);
  place := case ch.kind when 'team' then 'Вся команда' when 'leads' then 'Старшие' when 'net' then 'Руководители сети' else coalesce(ch.title, 'Чат') end;
  what := case when NEW.kind = 'photo' then 'Фото' || case when NEW.body <> '' then ': ' || _sa_clip(NEW.body, 280) else '' end else _sa_clip(NEW.body, 300) end;
  ids := array(select v from unnest(NEW.mentions) v where v <> 'all' and v <> NEW.emp_id);
  foreach x in array ids loop
    perform _sa_chat_pingk(ch, x, nm || ' упоминает тебя в «' || place || '»:' || chr(10) || what, NEW.id, null, true);
  end loop;
  if 'all' = any(NEW.mentions) and not exists (select 1 from sa_chat_msgs y where y.chat_id = NEW.chat_id and y.id <> NEW.id and not y.deleted
       and y.mentions is not null and 'all' = any(y.mentions) and y.created_at > now() - interval '10 minutes') then
    for x in select m.id from _sa_chat_members(ch) m where m.id <> NEW.emp_id and not (m.id = any(ids)) loop
      perform _sa_chat_pingk(ch, x, nm || ' пишет всем в «' || place || '»:' || chr(10) || what, NEW.id, null, true);
    end loop;
  end if;
  return null;
end; $$;
drop trigger if exists sa_chat_ment_ping on sa_chat_msgs;
create trigger sa_chat_ment_ping after insert on sa_chat_msgs for each row when (NEW.mentions is not null) execute function _sa_chat_ment_ping_trg();

-- чат для списка и шапки (как в этапе 38) + ment — сколько непрочитанных сообщений с упоминанием меня или всех
create or replace function _sa_chat_view(c jsonb, ch sa_chats, p_today text[])
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare lm sa_chat_msgs; n int; sh int; peer jsonb; pid text; mn int; rd bigint;
begin
  select * into lm from sa_chat_msgs m where m.chat_id = ch.id and not m.deleted order by m.id desc limit 1;
  select count(*), count(*) filter (where p_today is not null and x.id = any(p_today)) into n, sh from _sa_chat_members(ch) x;
  if ch.kind = 'dm' then
    pid := case when ch.a = c->>'id' then ch.b else ch.a end;
    select jsonb_build_object('id', e.id::text, 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')), 'pos', lower(coalesce(e.position, '')),
      'shift', p_today is not null and e.id::text = any(p_today), 'active', coalesce(e.status, 'active') = 'active')
      into peer from employees e where e.id::text = pid;
  end if;
  rd := coalesce((select r.last_id from sa_chat_reads r where r.chat_id = ch.id and r.emp_id = c->>'id'), 0);
  select count(*)::int into mn from sa_chat_msgs m
   where m.chat_id = ch.id and m.id > rd and not m.deleted and m.emp_id <> c->>'id' and m.mentions is not null
     and ((c->>'id') = any(m.mentions) or 'all' = any(m.mentions));
  return jsonb_build_object('id', ch.id, 'kind', ch.kind, 'members', n, 'shift', case when p_today is not null and ch.kind in ('team', 'leads') then sh end,
    'peer', peer, 'last', case when lm.id is not null then _sa_chat_msg_json(lm) end, 'unread', _sa_chat_unread(ch.id, c->>'id'), 'cleared', ch.cleared_at,
    'title', case when ch.kind = 'group' then ch.title end, 'owner', case when ch.kind = 'group' then ch.created_by end, 'ment', mn);
end; $$;

-- ── 4) Поиск по переписке ─────────────────────────────────────────────────────
-- по тексту сообщений (и подписям, карточкам, ответам Наставника) во всех моих чатах или в одном; регистр и ё не важны
create or replace function chat_search(p_token text, p_q text, p_chat bigint default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; q text; pat text; ids bigint[]; out jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  q := btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g'));
  if char_length(q) < 2 or char_length(q) > 80 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  pat := '%' || replace(replace(replace(_sa_low_e(q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  select coalesce(array_agg(x.id), '{}') into ids from sa_chats x
   where (x.restaurant = rest or (x.kind = 'net' and _sa_chat_multi())) and _sa_chat_ok(c, x) and (p_chat is null or x.id = p_chat);
  select coalesce(jsonb_agg(_sa_chat_msg_json(m::sa_chat_msgs) order by m.id desc), '[]'::jsonb), count(*) into out, n
    from (select * from sa_chat_msgs x where x.chat_id = any(ids) and not x.deleted and x.kind in ('text', 'photo', 'card', 'ai')
            and _sa_low_e(x.body) like pat escape '\' order by x.id desc limit 50) m;
  return jsonb_build_object('ok', true, 'q', q, 'msgs', out, 'more', n >= 50);
end; $$;

-- ── 5) Смены сотрудника (для «Опаздываю», календаря и /smena) ─────────────────
-- по графику с p_from по p_to: дата, буква, название, часы (как в графике: 10, 18, 24, 26 — после полуночи), должность.
-- Графика нет — null; меня в графике нет — пусто.
create or replace function _sa_emp_shifts(p_emp text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare rest text; cfg jsonb; d date; mk text := ''; ms jsonb; k text; sh jsonb; out jsonb := '[]'::jsonb;
begin
  select coalesce(e.restaurant, '') into rest from employees e where e.id::text = p_emp;
  if coalesce(rest, '') = '' or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 120 then return out; end if;
  cfg := _sa_sh_cfg(rest);
  if cfg is null then return null; end if;
  for d in select g::date from generate_series(p_from, p_to, interval '1 day') g loop
    if to_char(d, 'YYYY-MM') <> mk then mk := to_char(d, 'YYYY-MM'); ms := _sa_sh_staff(cfg, p_emp, mk); end if;
    continue when ms is null;
    k := _sa_sh_code(rest, ms->>'id', d); sh := _sa_sh_def(cfg, k);
    continue when sh is null;
    out := out || jsonb_build_array(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'k', k, 'label', coalesce(sh->>'name', k),
      'from', _sa_num(sh->>'from'), 'to', _sa_num(sh->>'to'), 'time', _sa_chat_hh(_sa_num(sh->>'from')) || '–' || _sa_chat_hh(_sa_num(sh->>'to')),
      'pos', _sa_chat_spos(ms->>'pos', false), 'sid', ms->>'id'));
  end loop;
  return out;
end; $$;

-- ── 6) «Опаздываю» ─────────────────────────────────────────────────────────────
-- «15 минут», «1 минуту», «час», «полтора часа», «2 часа»
create or replace function _sa_late_min(n int)
returns text language sql immutable as $$
  select case when n = 60 then 'час' when n = 90 then 'полтора часа' when n > 0 and n % 60 = 0 then (n / 60)::text || ' ' ||
      case when (n / 60) % 10 between 2 and 4 and (n / 60) % 100 not between 12 and 14 then 'часа' when (n / 60) % 10 = 1 and (n / 60) % 100 <> 11 then 'час' else 'часов' end
    else coalesce(n, 0)::text || ' ' || case when n % 10 = 1 and n % 100 <> 11 then 'минуту'
      when n % 10 between 2 and 4 and n % 100 not between 12 and 14 then 'минуты' else 'минут' end end
$$;

-- руководителю «Принято»: в карточке — кто, опоздавшему пишет бот
create or replace function _sa_late_ok_do(c jsonb, ch sa_chats, m sa_chat_msgs)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
begin
  if m.card ? 'ok' then return jsonb_build_object('ok', true, 'again', true, 'msg', _sa_chat_smart1(c, ch, m)); end if;
  update sa_chat_msgs set card = card || jsonb_build_object('ok', jsonb_build_object('id', c->>'id', 'name', coalesce(c->>'who', ''), 'at', now())), updated_at = now()
   where id = m.id returning * into m;
  update sa_late set ok_by = c->>'id', ok_name = coalesce(c->>'who', ''), ok_at = now() where msg_id = m.id;
  if m.emp_id <> c->>'id' then
    perform _sa_chat_pingk(ch, m.emp_id, _sa_chat_nm(c->>'who') || ': принято, ждём к ' || coalesce(m.card->>'eta', '') || '.', m.id, null, true);
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- p_chat null — «Вся команда»; p_min — от 5 до 240 минут. До начала смены «на 15 минут» — от начала смены, после — от
-- сейчас. Чаще раза в 3 минуты нельзя (second — новая карточка, отметка в графике — последняя).
create or replace function chat_late(p_token text, p_chat bigint, p_min int, p_note text default '')
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; ch sa_chats; tz text; nowl timestamp; today date; sh jsonb; st numeric; base timestamp; eta timestamp; card jsonb; m sa_chat_msgs;
  note text; body text; leads text[]; onl text[]; who text[]; x text; txt text; kb jsonb; sent int := 0; etas text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_min is null or p_min < 5 or p_min > 240 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if p_chat is null then
    perform _sa_chat_ensure(c);
    select * into ch from sa_chats where restaurant = rest and kind = 'team';
  else
    select * into ch from sa_chats where id = p_chat;
  end if;
  if ch.id is null or not _sa_chat_ok(c, ch) or ch.kind not in ('team', 'group') or ch.restaurant is distinct from rest then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if _sa_chat_fast(c) or exists (select 1 from sa_chat_msgs y where y.emp_id = c->>'id' and y.kind = 'card' and not y.deleted
       and y.card->>'t' = 'late' and y.created_at > now() - interval '3 minutes') then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  tz := _sa_tz(rest); nowl := date_trunc('minute', now() at time zone tz); today := nowl::date;
  sh := (_sa_emp_shifts(c->>'id', today, today))->0;
  if sh is not null then
    st := (sh->>'from')::numeric;
    base := greatest(today + make_interval(mins => round(st * 60)::int), nowl);
  else
    base := nowl;
  end if;
  eta := base + make_interval(mins => p_min);
  etas := to_char(eta, 'HH24:MI');
  note := _sa_chat_cut(p_note, 80);
  card := jsonb_strip_nulls(jsonb_build_object('t', 'late', 'min', p_min, 'eta', etas, 'day', to_char(today, 'YYYY-MM-DD'),
    'from', case when sh is not null then _sa_chat_hh(st) end, 'label', case when sh is not null then _sa_chat_low(sh->>'label') end,
    'note', nullif(note, '')));
  body := 'Опаздываю на ' || _sa_late_min(p_min) || ': буду в ' || etas || coalesce('. ' || nullif(note, ''), '');
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), rest, body, 'card', card) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  insert into sa_late (emp_id, day, restaurant, emp_name, min, eta, note, msg_id, at)
    values (c->>'id', today, rest, coalesce(c->>'who', ''), p_min, etas, nullif(note, ''), m.id, now())
    on conflict (emp_id, day) do update set restaurant = excluded.restaurant, emp_name = excluded.emp_name, min = excluded.min, eta = excluded.eta,
      note = excluded.note, msg_id = excluded.msg_id, at = now(), ok_by = null, ok_name = null, ok_at = null;
  -- руководители и старшие этого чата: кто сегодня в графике; в графике никого из них нет — все
  select coalesce(array_agg(y.id), '{}') into leads from _sa_chat_members(ch) y
   where y.id <> c->>'id' and (y.pos = any(_sa_chat_lead_pos()) or exists (select 1 from employees e where e.id::text = y.id and coalesce(e.is_admin, false)));
  onl := array(select v from unnest(leads) v where v = any(coalesce(_sa_on_shift(rest, today), '{}')));
  who := case when cardinality(onl) > 0 then onl else leads end;
  txt := _sa_chat_nm(c->>'who') || ' опаздывает на ' || _sa_late_min(p_min) || ': будет в ' || etas ||
    case when sh is not null then ' (смена с ' || _sa_chat_hh(st) || ')' else '' end || '.' || coalesce(chr(10) || '«' || nullif(note, '') || '»', '');
  kb := jsonb_build_array(jsonb_build_array(jsonb_build_object('text', 'Принято', 'callback_data', 'cl:' || m.id)));
  foreach x in array who loop
    if _sa_chat_pingk(ch, x, txt, m.id, kb, true) then sent := sent + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m), 'sent', sent, 'leads', cardinality(who));
end; $$;

create or replace function chat_late_ok(p_token text, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind <> 'card' or coalesce(m.card->>'t', '') <> 'late' or not _sa_chat_ok(c, ch) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  return _sa_late_ok_do(c, ch, m);
end; $$;

-- отметки «Опаздываю» за месяц: руководителю и старшему — по заведению, остальным — свои. sid — строка графика.
create or replace function late_month(p_token text, p_month text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; cfg jsonb; d0 date; out jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', true, 'rows', '[]'::jsonb); end if;
  if coalesce(p_month, '') !~ '^\d{4}-(0[1-9]|1[0-2])$' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  d0 := (p_month || '-01')::date;
  cfg := _sa_sh_cfg(rest);
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('emp', l.emp_id, 'name', l.emp_name,
      'sid', case when cfg is not null then _sa_sh_staff(cfg, l.emp_id, p_month)->>'id' end,
      'day', extract(day from l.day)::int, 'min', l.min, 'eta', l.eta, 'note', l.note, 'ok', l.ok_name)) order by l.day, l.emp_name), '[]'::jsonb) into out
    from sa_late l
   where l.restaurant = rest and l.day >= d0 and l.day < (d0 + interval '1 month')::date
     and (coalesce((c->>'lead')::boolean, false) or l.emp_id = c->>'id');
  return jsonb_build_object('ok', true, 'rows', out);
end; $$;

-- ── 7) Смены в календаре телефона ─────────────────────────────────────────────
-- моя ссылка (p_reset — новая, старая перестаёт работать) и ближайшие смены для подсказки
create or replace function cal_key(p_token text, p_reset boolean default false)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; k text; u timestamptz; sh jsonb; today date;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if coalesce(p_reset, false) then delete from sa_cal_keys where emp_id = c->>'id'; end if;
  select x.k, x.used_at into k, u from sa_cal_keys x where x.emp_id = c->>'id';
  if k is null then
    k := replace(gen_random_uuid()::text, '-', '');
    insert into sa_cal_keys (emp_id, k) values (c->>'id', k);
  end if;
  today := (now() at time zone _sa_tz(c->>'restaurant'))::date;
  sh := _sa_emp_shifts(c->>'id', today, today + 13);
  return jsonb_build_object('ok', true, 'key', k, 'used', u, 'schedule', sh is not null,
    'next', coalesce((select jsonb_agg(y) from (select y from jsonb_array_elements(coalesce(sh, '[]'::jsonb)) y limit 3) s), '[]'::jsonb));
end; $$;

-- смены по ссылке: за месяц назад и два вперёд; телефон спрашивает сам (раз в час). p_page — для страницы «Подписаться»
-- (это ещё не календарь: «календарь забирал смены» не отмечается). Ссылки нет или человек уволен — нет.
drop function if exists cal_feed(text);
create or replace function cal_feed(p_key text, p_page boolean default false)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare e record; tz text; today date; sh jsonb;
begin
  if coalesce(p_key, '') !~ '^[0-9a-f]{32}$' then return jsonb_build_object('ok', false, 'error', 'key'); end if;
  select x.id::text as id, btrim(coalesce(x.name, '') || ' ' || coalesce(x.surname, '')) as name, coalesce(x.restaurant, '') as rest,
         lower(coalesce(x.position, '')) as pos, coalesce(x.status, 'active') as st
    into e from sa_cal_keys k join employees x on x.id::text = k.emp_id where k.k = p_key;
  if e.id is null or e.st <> 'active' then return jsonb_build_object('ok', false, 'error', 'key'); end if;
  if not coalesce(p_page, false) then update sa_cal_keys set used_at = now() where k = p_key; end if;
  tz := _sa_tz(e.rest); today := (now() at time zone tz)::date;
  sh := _sa_emp_shifts(e.id, today - 31, today + 62);
  return jsonb_build_object('ok', true, 'id', e.id, 'name', e.name, 'rest', e.rest, 'tz', tz, 'schedule', sh is not null, 'shifts', coalesce(sh, '[]'::jsonb),
    'app', (select value from sa_settings where key = 'app_url'));
end; $$;

-- ── 8) Сервер глазами владельца ───────────────────────────────────────────────
-- какие функции (p_fns) и корзины Storage (p_buckets) на месте, Telegram, расписания pg_cron, адрес приложения.
-- p_url — адрес проекта Supabase из приложения: по нему sa_tg_setup_code печатает готовую ссылку.
create or replace function server_check(p_token text, p_fns text[] default null, p_buckets text[] default null, p_url text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; have text[]; bk text[]; cron jsonb; nets boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'admin')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select coalesce(array_agg(distinct p.proname::text order by p.proname::text), '{}') into have
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = any(coalesce(p_fns, '{}'::text[]));
  begin
    execute 'select coalesce(array_agg(id::text order by id::text), ''{}'') from storage.buckets where id = any($1)' into bk using coalesce(p_buckets, '{}'::text[]);
  exception when others then bk := null;
  end;
  begin
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''name'', jobname, ''on'', active, ''when'', schedule) order by jobname), ''[]''::jsonb) from cron.job' into cron;
  exception when others then cron := null;
  end;
  nets := exists (select 1 from pg_extension where extname = 'pg_net');
  if coalesce(p_url, '') ~ '^https://[a-z0-9-]{3,64}\.supabase\.co/?$' then
    insert into sa_settings (key, value) values ('supabase_url', rtrim(p_url, '/'))
      on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'fns', to_jsonb(have), 'buckets', to_jsonb(bk), 'cron', cron, 'pg_net', nets,
    'tg', jsonb_build_object('bot', _sa_tg_token() is not null, 'name', (select value from sa_settings where key = 'bot_username'),
      -- вебхук стоит: функция tg-bot поставила его по коду (tg_hook_at) или от Telegram уже приходили события
      'hook', exists (select 1 from sa_settings where key in ('tg_hook_at', 'tg_last_update') and coalesce(value, '') <> '')
        and exists (select 1 from sa_settings where key = 'tg_webhook_secret' and coalesce(value, '') <> ''),
      'last', (select value from sa_settings where key = 'tg_last_update'),
      'linked', (select count(*) from tg_links l join employees e on e.id::text = l.emp_id where coalesce(e.status, 'active') = 'active' and coalesce(l.remind, false)),
      'auth', (select count(distinct a.emp_id) from sa_tg_auth a join employees e on e.id::text = a.emp_id where not a.off and coalesce(e.status, 'active') = 'active')),
    'app', (select value from sa_settings where key = 'app_url'),
    'staff', (select count(*) from employees where coalesce(status, 'active') = 'active'),
    'tz', _sa_tz(c->>'restaurant'), 'now', now());
end; $$;

-- подключить бота из приложения: код на 30 минут (как sa_tg_setup_code); p_app — адрес приложения (для кнопки бота),
-- записывается, только если его ещё нет
create or replace function owner_tg_setup(p_token text, p_app text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; code text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'admin')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if _sa_tg_token() is null then return jsonb_build_object('ok', false, 'error', 'no_bot'); end if;
  if coalesce(p_app, '') ~ '^https://[^\s"<>?#]{4,190}$' and not exists (select 1 from sa_settings where key = 'app_url' and btrim(coalesce(value, '')) <> '') then
    insert into sa_settings (key, value) values ('app_url', rtrim(p_app, '/'))
      on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  code := left(replace(gen_random_uuid()::text, '-', ''), 12);
  insert into sa_settings (key, value) values ('tg_setup_code', code || '|' || floor(extract(epoch from now()))::bigint)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into sa_settings (key, value) values ('tg_webhook_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
    on conflict (key) do nothing;
  return jsonb_build_object('ok', true, 'code', code, 'app', (select value from sa_settings where key = 'app_url'));
end; $$;

-- как в этапе 31, плюс адрес приложения: по нему функция tg-bot ставит кнопку «Академия» у поля ввода
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
  if coalesce(p_use, false) then
    -- функция tg-bot поставила вебхук и отметила код использованным: для экрана «Сервер» вебхук теперь стоит
    delete from sa_settings where key = 'tg_setup_code';
    insert into sa_settings (key, value) values ('tg_hook_at', now()::text) on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'token', _sa_tg_token(),
    'secret', (select value from sa_settings where key = 'tg_webhook_secret'),
    'app', nullif(btrim(coalesce((select value from sa_settings where key = 'app_url'), '')), ''));
end; $$;

-- как в этапе 31; адрес проекта известен (экран «Сервер» в приложении) — ссылка готовая
create or replace function sa_tg_setup_code()
returns text language plpgsql security definer set search_path to public as $$
declare code text; base text;
begin
  if _sa_tg_token() is null then
    return 'Сначала токен бота в Vault (этап 22б): select vault.create_secret(''ТОКЕН_ОТ_BOTFATHER'', ''sa_tg_bot_token'');';
  end if;
  code := left(replace(gen_random_uuid()::text, '-', ''), 12);
  insert into sa_settings (key, value) values ('tg_setup_code', code || '|' || floor(extract(epoch from now()))::bigint)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into sa_settings (key, value) values ('tg_webhook_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
  on conflict (key) do nothing;
  base := nullif(btrim(coalesce((select value from sa_settings where key = 'supabase_url'), '')), '');
  return 'Код на 30 минут: ' || code || E'\nОткрой в браузере: ' || coalesce(base, 'https://<проект>.supabase.co') || '/functions/v1/tg-bot?setup=' || code ||
    case when base is null then E'\n<проект> — адрес из Supabase: Project Settings → API → Project URL. Проще: в приложении «Команда» → «Сервер» → «Подключить бота».' else '' end;
end; $$;

-- ── 9) Бот: /smena, «Принято» на опоздание, отметка последнего события ─────────
-- ближайшие смены одним сообщением (две недели вперёд, до 6)
create or replace function _sa_tg_shifts_text(p_emp text)
returns text language plpgsql stable security definer set search_path to public as $$
declare rest text; today date; sh jsonb; x jsonb; out text := ''; n int := 0;
begin
  select coalesce(e.restaurant, '') into rest from employees e where e.id::text = p_emp;
  today := (now() at time zone _sa_tz(rest))::date;
  sh := _sa_emp_shifts(p_emp, today, today + 13);
  if sh is null then return 'График смен ещё не заполнен.'; end if;
  for x in select y from jsonb_array_elements(sh) y loop
    n := n + 1;
    exit when n > 6;
    out := out || E'\n' || case when x->>'date' = to_char(today, 'YYYY-MM-DD') then 'сегодня' when x->>'date' = to_char(today + 1, 'YYYY-MM-DD') then 'завтра'
      else (array['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'])[extract(dow from (x->>'date')::date)::int + 1] end ||
      ', ' || extract(day from (x->>'date')::date)::int || ' ' ||
      (array['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'])[extract(month from (x->>'date')::date)::int] ||
      ' · ' || _sa_chat_low(x->>'label') || ' ' || (x->>'time');
  end loop;
  if out = '' then return 'В графике на две недели вперёд смен нет.'; end if;
  return 'Твои смены:' || out;
end; $$;

-- «Принято» под сообщением об опоздании (cl:<сообщение>): только руководитель и старший
create or replace function _sa_late_tg_cb(cq jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare mm text[]; c jsonb; m sa_chat_msgs; ch sa_chats; r jsonb; msg jsonb; kb jsonb;
begin
  mm := regexp_match(coalesce(cq->>'data', ''), '^cl:(\d{1,18})$');
  c := _sa_tg_caller(cq->'from'->>'id');
  if mm is not null then select * into m from sa_chat_msgs where id = mm[1]::bigint; end if;
  if m.id is not null then select * into ch from sa_chats where id = m.chat_id; end if;
  if c is null or m.id is null or m.deleted or coalesce(m.card->>'t', '') <> 'late' or not _sa_chat_ok(c, ch) or not coalesce((c->>'lead')::boolean, false) then
    perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', 'Не получилось: открой чат'));
    return jsonb_build_object('ok', true, 'skip', 'late');
  end if;
  r := _sa_late_ok_do(c, ch, m);
  msg := cq->'message';
  if jsonb_typeof(msg) = 'object' and msg->'chat'->>'id' is not null and msg->>'message_id' is not null then
    select coalesce(jsonb_agg(rw), '[]'::jsonb) into kb
      from jsonb_array_elements(case when jsonb_typeof(msg->'reply_markup'->'inline_keyboard') = 'array' then msg->'reply_markup'->'inline_keyboard' else '[]'::jsonb end) rw
     where not exists (select 1 from jsonb_array_elements(rw) b where b ? 'callback_data');
    perform _sa_chat_tg_api('editMessageText', jsonb_build_object('chat_id', msg->'chat'->'id', 'message_id', msg->'message_id', 'disable_web_page_preview', true,
      'text', left(regexp_replace(coalesce(msg->>'text', ''), E'\n\nПринято[^\n]*$', '') || E'\n\nПринято' ||
        case when coalesce((r->>'again')::boolean, false) then ': ' || coalesce(m.card->'ok'->>'name', 'уже ответили') else '' end || '.', 4000),
      'reply_markup', jsonb_build_object('inline_keyboard', kb)));
  end if;
  perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', 'Принято'));
  return jsonb_build_object('ok', true, 'late', m.id);
end; $$;

-- Вебхук бота (функция tg-bot): как в этапе 38 («Вопрос дня», кнопки чата, ответ на сообщение бота) плюс «Принято» на
-- опоздание, /smena и отметка последнего события от Telegram (tg_last_update — для экрана «Сервер»).
-- После повторного запуска этапа 31 или 38 перезапусти этот файл.
create or replace function sa_tg_update(p_secret text, p_update jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare want text; cq jsonb; m text[]; v_id bigint; v_n int; nx record; v_from bigint; v_ok boolean; v_c int;
  txt text; msg jsonb; mt text; chat bigint; who jsonb;
begin
  select value into want from sa_settings where key = 'tg_webhook_secret';
  if coalesce(want, '') = '' or coalesce(p_secret, '') <> want then return jsonb_build_object('ok', false, 'error', 'secret'); end if;
  insert into sa_settings (key, value) values ('tg_last_update', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    on conflict (key) do update set value = excluded.value, updated_at = now();
  if p_update is null or jsonb_typeof(p_update) <> 'object' then return jsonb_build_object('ok', true, 'skip', 'empty'); end if;

  cq := p_update->'callback_query';
  if cq is not null and jsonb_typeof(cq) = 'object' then
    if coalesce(cq->>'data', '') ~ '^(cg|ct|cv):' then return _sa_chat_tg_cb(cq); end if;   -- v97: кнопки чата
    if coalesce(cq->>'data', '') ~ '^cl:' then return _sa_late_tg_cb(cq); end if;            -- v99: «Принято» на опоздание
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
  mt := coalesce(p_update->'message'->>'text', '');
  chat := case when coalesce(p_update->'message'->'chat'->>'id', '') ~ '^-?\d{1,18}$' then (p_update->'message'->'chat'->>'id')::bigint end;
  -- v99: /smena — ближайшие смены по графику
  if mt ~* '^/(smena|smeny|shifts)(@[a-z0-9_]+)?(\s|$)' and chat is not null then
    who := _sa_tg_caller(p_update->'message'->'from'->>'id');
    if who is null then
      perform sa_tg_send(chat, 'Этот Telegram не связан с приложением. Открой приложение: «Смена» → «Напоминания в Telegram».', 'Открыть академию', null);
    else
      perform sa_tg_send(chat, _sa_tg_shifts_text(who->>'id'), 'Открыть график', 'schedule');
    end if;
    return jsonb_build_object('ok', true, 'shifts', true);
  end if;
  -- сообщение боту: на /start — что здесь приходит, и кнопка в приложение
  if mt ~ '^/start' and chat is not null then
    perform sa_tg_send(chat, 'Здесь приходят сообщения академии: разминка перед сменой, вопрос дня, лига недели, чат смены. Уроки и тесты ждут в приложении. На сообщение из чата можно ответить прямо здесь.' ||
      E'\n\n/smena: твои ближайшие смены.', 'Открыть академию', null);
    return jsonb_build_object('ok', true, 'start', true);
  end if;
  -- v97: просто текст боту от сотрудника — как ответить в чат
  if mt <> '' and coalesce(p_update->'message'->'chat'->>'type', '') = 'private' and coalesce(p_update->'message'->'chat'->>'id', '') ~ '^\d{1,18}$'
     and _sa_tg_caller(p_update->'message'->'from'->>'id') is not null then
    perform _sa_chat_tg((p_update->'message'->'chat'->>'id')::bigint, 'Чтобы написать в чат, ответь на сообщение о переписке: смахни его влево или нажми «Ответить». Твои смены: /smena.', null);
    return jsonb_build_object('ok', true, 'hint', true);
  end if;
  return jsonb_build_object('ok', true, 'skip', 'other');
end; $$;

-- ── 10) Права ──────────────────────────────────────────────────────────────────
revoke all on function _sa_tg_auth_date(text) from public, anon, authenticated;
revoke all on function _sa_tg_who(text) from public, anon, authenticated;
revoke all on function _sa_re_esc(text) from public, anon, authenticated;
revoke all on function _sa_low_e(text) from public, anon, authenticated;
revoke all on function _sa_chat_ment_names(sa_chats) from public, anon, authenticated;
revoke all on function _sa_chat_ment_parse(sa_chats, text, text, boolean) from public, anon, authenticated;
revoke all on function _sa_chat_ment_trg() from public, anon, authenticated;
revoke all on function _sa_chat_ment_ping_trg() from public, anon, authenticated;
revoke all on function _sa_chat_view(jsonb, sa_chats, text[]) from public, anon, authenticated;
revoke all on function _sa_emp_shifts(text, date, date) from public, anon, authenticated;
revoke all on function _sa_late_min(int) from public, anon, authenticated;
revoke all on function _sa_late_ok_do(jsonb, sa_chats, sa_chat_msgs) from public, anon, authenticated;
revoke all on function _sa_tg_shifts_text(text) from public, anon, authenticated;
revoke all on function _sa_late_tg_cb(jsonb) from public, anon, authenticated;
revoke all on function sa_tg_setup_code() from public, anon, authenticated;
revoke all on function sa_tg_setup_take(text, boolean) from public, anon, authenticated;
grant execute on function sa_tg_setup_take(text, boolean) to service_role;
revoke all on function sa_tg_update(text, jsonb) from public, anon, authenticated;
grant execute on function sa_tg_update(text, jsonb) to service_role;
grant execute on function tg_login(text), tg_auth_bind(text, text), tg_auth_off(text, text), chat_search(text, text, bigint), chat_late(text, bigint, int, text),
  chat_late_ok(text, bigint), late_month(text, text), cal_key(text, boolean), cal_feed(text, boolean), server_check(text, text[], text[], text), owner_tg_setup(text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';

select 'удобство: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('tg_login', 'tg_auth_bind', 'tg_auth_off', 'chat_search', 'chat_late', 'chat_late_ok', 'late_month', 'cal_key', 'cal_feed', 'server_check', 'owner_tg_setup')) ||
  ' функций из 11 · таблицы: ' || case when to_regclass('public.sa_tg_auth') is not null and to_regclass('public.sa_late') is not null and to_regclass('public.sa_cal_keys') is not null
    then 'есть' else 'НЕТ' end ||
  ' · упоминания: ' || case when exists (select 1 from pg_trigger where tgname = 'sa_chat_ment_ping' and not tgisinternal) then 'да' else 'нет' end ||
  ' · вход через Telegram: ' || case when _sa_tg_token() is not null then 'бот на месте' else 'нет бота (вход по коду, как раньше)' end ||
  ' · бот: обнови функцию tg-bot (кнопка «Академия» и /smena), затем «Команда» → «Сервер» → «Подключить бота»' as result;
