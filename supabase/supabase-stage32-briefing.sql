-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 32 (v82, Доп. 395): брифинг смены — из приложения команде.
--
-- Руководитель собирает пятиминутку в приложении (кто сегодня в графике, стоп-лист и новинки, фокус смены по
-- ошибкам команды, вопрос команде, «спасибо» лидерам недели, своё) и нажимает «Отправить команде»:
--   • brief_publish — брифинг сохраняется на сегодня (по часам заведения; повторная отправка — правка того же дня),
--     а сотрудникам заведения с подключённым Telegram бот присылает его текст и кнопку «Брифинг смены»
--     (раз в день на человека; кто не хочет — «Смена» → «Напоминания в Telegram» → «Брифинг смены»);
--   • brief_today — сегодняшний брифинг своего заведения: его видит каждый в «Смене», даже без Telegram.
-- Заодно notify_prefs / notify_set знают все виды сообщений сами (колонки таблицы sa_notify_prefs): следующему этапу
-- с новым видом больше не нужно переписывать эти функции.
--
-- Нужны этапы 21 (_sa_caller), 22б (бот), 24 (_sa_tz) и 25 (настройки сообщений). Ничего не удаляет.
-- Можно запускать повторно. Если перезапускаешь этапы 25, 26 или 31 — после них снова этот.
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

-- ── 1) Таблица и вид сообщений ─────────────────────────────────────────────────
create table if not exists sa_briefs (
  restaurant  text not null,
  day         date not null,                 -- день по часам заведения
  data        jsonb not null,                -- блоки брифинга (lib/briefing.js)
  text        text not null default '',      -- он же текстом — для Telegram
  author_id   text,
  author_name text,
  sent        int not null default 0,        -- скольким ушёл в Telegram (за день)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (restaurant, day)
);
alter table sa_briefs enable row level security;
revoke all on table sa_briefs from public, anon, authenticated;

alter table sa_notify_prefs add column if not exists master boolean not null default true;   -- этап 26
alter table sa_notify_prefs add column if not exists qday boolean not null default true;     -- этап 31
alter table sa_notify_prefs add column if not exists brief boolean not null default true;

-- ── 2) Опубликовать брифинг ────────────────────────────────────────────────────
-- p_data — объект брифинга от приложения; p_text — он же текстом (приложение собирает его само: lib/briefing.js).
create or replace function brief_publish(p_token text, p_data jsonb, p_text text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; tz text; ld date; txt text; l record; chat bigint; n int := 0; was int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 30000 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  txt := left(btrim(coalesce(p_text, '')), 3500);
  if txt = '' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  tz := _sa_tz(rest);
  ld := (now() at time zone tz)::date;
  select sent into was from sa_briefs where restaurant = rest and day = ld;
  insert into sa_briefs (restaurant, day, data, text, author_id, author_name)
  values (rest, ld, p_data, txt, c->>'id', c->>'who')
  on conflict (restaurant, day) do update
     set data = excluded.data, text = excluded.text, author_id = excluded.author_id, author_name = excluded.author_name, updated_at = now();
  -- Telegram: сотрудникам этого заведения, раз в день на человека; автору — нет
  if _sa_tg_ready() then
    for l in select t.emp_id from tg_links t where t.remind and t.restaurant is not distinct from rest and t.emp_id <> c->>'id' order by t.emp_id loop
      chat := _sa_tg_chat(l.emp_id, 'brief');
      if chat is null then continue; end if;
      if not _sa_tg_once(l.emp_id, ld, 'brief') then continue; end if;
      perform sa_tg_send(chat, txt, 'Брифинг смены', 'brief');
      n := n + 1;
    end loop;
  end if;
  update sa_briefs set sent = sent + n where restaurant = rest and day = ld;
  return jsonb_build_object('ok', true, 'day', to_char(ld, 'YYYY-MM-DD'), 'sent', n, 'again', was is not null,
    'bot', _sa_tg_ready());
end; $$;

-- ── 3) Сегодняшний брифинг своего заведения ────────────────────────────────────
create or replace function brief_today(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; b sa_briefs;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', true, 'brief', null); end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into b from sa_briefs where restaurant = rest and day = ld;
  if b.restaurant is null then return jsonb_build_object('ok', true, 'brief', null, 'day', to_char(ld, 'YYYY-MM-DD')); end if;
  return jsonb_build_object('ok', true, 'day', to_char(ld, 'YYYY-MM-DD'), 'brief', jsonb_build_object('data', b.data, 'author', b.author_name,
    'mine', b.author_id = c->>'id', 'sent', b.sent, 'at', b.updated_at));
end; $$;

-- ── 4) Настройки сообщений: все виды — колонки sa_notify_prefs ─────────────────
-- Виды — булевы колонки таблицы (pair, quest, league, fresh, month, master, qday, brief и те, что добавят следующие
-- этапы). Ответ — как прежде: ok, bot, linked, remind, по ключу на вид; час «Вопроса дня» — если этап 31 выполнен.
create or replace function _sa_notify_kinds()
returns text[] language sql stable security definer set search_path to public as $$
  select coalesce(array_agg(column_name::text order by ordinal_position), '{}')
    from information_schema.columns
   where table_schema = 'public' and table_name = 'sa_notify_prefs' and data_type = 'boolean'
$$;

create or replace function notify_prefs(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; pj jsonb; linked boolean := false; on_ boolean := false; out jsonb; k text; hh int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select to_jsonb(p) into pj from sa_notify_prefs p where p.emp_id = c->>'id';
  if to_regclass('public.tg_links') is not null then
    execute 'select true, remind from tg_links where emp_id = $1' into linked, on_ using c->>'id';
  end if;
  out := jsonb_build_object('ok', true, 'bot', _sa_tg_ready(), 'linked', coalesce(linked, false), 'remind', coalesce(on_, false));
  foreach k in array _sa_notify_kinds() loop
    out := out || jsonb_build_object(k, coalesce((pj->>k)::boolean, true));
  end loop;
  if to_regprocedure('public._sa_qday_hour()') is not null then
    execute 'select _sa_qday_hour()' into hh;
    out := out || jsonb_build_object('qday_hour', hh);
  end if;
  return out;
end; $$;

create or replace function notify_set(p_token text, p_kind text, p_on boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_kind is null or not (p_kind = any(_sa_notify_kinds())) then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  insert into sa_notify_prefs (emp_id) values (c->>'id') on conflict do nothing;
  execute format('update sa_notify_prefs set %I = $1, updated_at = now() where emp_id = $2', p_kind) using coalesce(p_on, false), c->>'id';
  return notify_prefs(p_token);
end; $$;

-- ── 5) Права ───────────────────────────────────────────────────────────────────
revoke all on function _sa_notify_kinds() from public, anon, authenticated;
grant execute on function brief_publish(text, jsonb, text) to anon, authenticated;
grant execute on function brief_today(text) to anon, authenticated;
grant execute on function notify_prefs(text) to anon, authenticated;
grant execute on function notify_set(text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

select 'брифинг: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('brief_publish', 'brief_today', '_sa_notify_kinds', 'notify_prefs', 'notify_set')) ||
  ' функций из 5 · таблица: ' || case when to_regclass('public.sa_briefs') is not null then 'есть' else 'НЕТ' end ||
  ' · виды сообщений: ' || array_to_string(_sa_notify_kinds(), ', ') ||
  ' · Telegram: ' || case when _sa_tg_ready() then 'бот на месте' else 'нет (брифинг виден в приложении, без сообщений)' end as result;
