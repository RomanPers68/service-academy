-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 36 (v86, Доп. 399): удобнее — брифинг «Прочитал(а)», рассадка «Счёт», ссылка на отзывы, тихие часы.
--
--   • brief_read(p_token) — сотрудник отмечает, что прочитал брифинг дня своего заведения; brief_reads(p_token) — отметил
--     ли я сам и сколько прочитали (руководителю — кто именно). Правка брифинга (новая отправка того же дня) делает
--     прежние отметки устаревшими: прочитать нужно ещё раз;
--   • seat_set — статус «Счёт» (bill): гости попросили счёт, стол скоро освободится. Время посадки, гости и официант
--     остаются; сообщение официанту — только о новой посадке (как в этапе 35);
--   • review_links(p_token) / review_links_set(p_token, p_links) — ссылки заведения на отзывы (Яндекс Карты, 2ГИС,
--     Google Карты, до двух); задаёт руководитель или старший. guest_review_links(p_code) — их видит гость на странице
--     «Спасибо передано» (код QR сотрудника, как в этапе 34);
--   • notify_quiet(p_token) / notify_quiet_set(p_token, p_from, p_to) — тихие часы: в это время бот не присылает
--     «что ещё присылать» (напоминание о смене приходит всегда). Проверку делает _sa_tg_chat (этап 25, здесь — заново).
--
-- Нужны этапы 21, 22б, 24, 25, 32, 34 и 35. Ничего не удаляет. Можно запускать повторно.
-- Если перезапускаешь этапы 25 или 35 — после них снова этап 36 (он заменяет _sa_tg_chat и seat_set).
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
  if to_regclass('public.sa_briefs') is null then
    raise exception 'Сначала этап 32 (supabase-stage32-briefing.sql): нужен брифинг смены — таблица sa_briefs';
  end if;
  if to_regclass('public.sa_thanks_codes') is null or to_regprocedure('public._sa_thanks_emp(text)') is null then
    raise exception 'Сначала этап 34 (supabase-stage34-guest-thanks.sql): нужны QR сотрудников — sa_thanks_codes';
  end if;
  if to_regclass('public.sa_seat') is null or to_regclass('public.sa_floor') is null then
    raise exception 'Сначала этап 35 (supabase-stage35-seating.sql): нужна рассадка — таблицы sa_floor и sa_seat';
  end if;
end $$;

-- ── 1) Брифинг: «Прочитал(а)» ──────────────────────────────────────────────────
create table if not exists sa_brief_reads (
  restaurant text not null,
  day        date not null,                   -- день брифинга по часам заведения
  emp_id     text not null,
  name       text not null default '',
  surname    text not null default '',
  read_at    timestamptz not null default now(),
  primary key (restaurant, day, emp_id)
);
alter table sa_brief_reads enable row level security;
revoke all on table sa_brief_reads from public, anon, authenticated;

create or replace function brief_read(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; b sa_briefs;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into b from sa_briefs where restaurant = rest and day = ld;
  if b.restaurant is null then return jsonb_build_object('ok', false, 'error', 'no_brief'); end if;
  insert into sa_brief_reads (restaurant, day, emp_id, name, surname, read_at)
  values (rest, ld, c->>'id', coalesce(c->>'name', ''), coalesce(c->>'surname', ''), now())
  on conflict (restaurant, day, emp_id) do update set read_at = now(), name = excluded.name, surname = excluded.surname;
  return jsonb_build_object('ok', true, 'at', now());
end; $$;

-- Отметка считается, если она позже последней правки брифинга (updated_at): после правки — «прочитать ещё раз».
create or replace function brief_reads(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; b sa_briefs; mine timestamptz; n int; rows jsonb := '[]'::jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', true, 'brief', false, 'me', false, 'n', 0, 'rows', rows); end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into b from sa_briefs where restaurant = rest and day = ld;
  if b.restaurant is null then return jsonb_build_object('ok', true, 'brief', false, 'me', false, 'n', 0, 'rows', rows); end if;
  select read_at into mine from sa_brief_reads where restaurant = rest and day = ld and emp_id = c->>'id';
  select count(*) into n from sa_brief_reads r where r.restaurant = rest and r.day = ld and r.read_at >= b.updated_at
     and r.emp_id is distinct from b.author_id;
  if coalesce((c->>'lead')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('emp_id', r.emp_id, 'name', r.name, 'surname', r.surname, 'at', r.read_at)
             order by r.read_at), '[]'::jsonb) into rows
      from sa_brief_reads r where r.restaurant = rest and r.day = ld and r.read_at >= b.updated_at and r.emp_id is distinct from b.author_id;
  end if;
  return jsonb_build_object('ok', true, 'brief', true, 'me', mine is not null and mine >= b.updated_at, 'n', n, 'rows', rows,
    'lead', coalesce((c->>'lead')::boolean, false), 'updated_at', b.updated_at);
end; $$;

-- ── 2) Рассадка: статус «Счёт» ─────────────────────────────────────────────────
-- Как seat_set этапа 35, плюс bill: гости и официант остаются, время посадки — прежнее.
create or replace function seat_set(p_token text, p_tid text, p_status text, p_cnt int, p_name text, p_rtime text, p_waiter text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; pl jsonb; tn text; old sa_seat; r sa_seat; st text; wn text; wid text; chat bigint; busy boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  select plan into pl from sa_floor where restaurant = rest;
  select t->>'n' into tn from jsonb_array_elements(coalesce(pl->'tables', '[]'::jsonb)) t where t->>'id' = p_tid;
  if tn is null then return jsonb_build_object('ok', false, 'error', 'no_table'); end if;
  st := coalesce(p_status, '');
  if st not in ('free', 'res', 'seat', 'bill', 'clean') or coalesce(p_cnt, 0) not between 0 and 40
     or length(coalesce(p_name, '')) > 60 or coalesce(p_rtime, '') !~ '^(([01]\d|2[0-3]):[0-5]\d)?$' then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  busy := st in ('seat', 'bill');
  wid := nullif(btrim(coalesce(p_waiter, '')), '');
  if wid is not null then
    begin
      execute 'select btrim(e.name || '' '' || coalesce(e.surname, '''')) from employees e where e.id::text = $1 and e.restaurant = $2 and coalesce(to_jsonb(e)->>''status'', ''active'') = ''active'''
        into wn using wid, rest;
    exception when others then wn := null; end;
    if wn is null then return jsonb_build_object('ok', false, 'error', 'bad_waiter'); end if;
  end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into old from sa_seat where restaurant = rest and day = ld and tid = p_tid;
  insert into sa_seat (restaurant, day, tid, status, cnt, name, rtime, since, waiter_id, waiter_name, updated_by, updated_name, updated_at)
  values (rest, ld, p_tid, st,
    case when busy or st = 'res' then coalesce(p_cnt, 0) else 0 end,
    case when st = 'res' then btrim(coalesce(p_name, '')) else '' end,
    case when st = 'res' then coalesce(p_rtime, '') else '' end,
    case when busy then case when coalesce(old.status, '') in ('seat', 'bill') then old.since else now() end end,
    case when busy then wid end, case when busy then coalesce(wn, '') else '' end,
    c->>'id', coalesce(c->>'who', ''), now())
  on conflict (restaurant, day, tid) do update set status = excluded.status, cnt = excluded.cnt, name = excluded.name, rtime = excluded.rtime,
    since = excluded.since, waiter_id = excluded.waiter_id, waiter_name = excluded.waiter_name, updated_by = excluded.updated_by,
    updated_name = excluded.updated_name, updated_at = now()
  returning * into r;
  -- официанту — когда ему посадили гостей (новая посадка или стол передали ему); «Счёт» и возврат из него — без сообщения
  if st = 'seat' and wid is not null and wid <> c->>'id' and (coalesce(old.status, '') not in ('seat', 'bill') or old.waiter_id is distinct from wid) and _sa_tg_ready() then
    chat := _sa_tg_chat(wid, 'seat');
    if chat is not null then
      perform sa_tg_send(chat, 'Стол ' || tn || ': посадили ' || r.cnt || ' ' ||
        case when r.cnt % 10 = 1 and r.cnt % 100 <> 11 then 'гостя' else 'гостей' end || '. Посадил(а): ' || coalesce(nullif(c->>'who', ''), 'хостес') || '.',
        'Рассадка', 'seat');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'table', _sa_seat_json(r));
end; $$;

-- ── 3) Ссылки на отзывы ────────────────────────────────────────────────────────
create table if not exists sa_review_links (
  restaurant text primary key,
  links      jsonb not null default '[]'::jsonb,   -- [{ kind: yandex | 2gis | google, url }] до двух
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table sa_review_links enable row level security;
revoke all on table sa_review_links from public, anon, authenticated;

-- Чья это ссылка: только карты с отзывами, только https — гостю не уйдёт ссылка «куда угодно»
create or replace function _sa_review_kind(p_url text)
returns text language sql immutable as $$
  select case
    when p_url is null or length(p_url) > 300 or p_url ~ '[[:space:]<>"]' then null
    when p_url ~* '^https://(www\.)?(yandex\.(ru|com|kz|by|uz)|ya\.ru)/(maps|profile)(/|\?|$)' then 'yandex'
    when p_url ~* '^https://(www\.)?(2gis\.(ru|com|kz|kg|ae)|go\.2gis\.com)/' then '2gis'
    when p_url ~* '^https://((www\.)?google\.[a-z.]{2,6}/maps|maps\.google\.[a-z.]{2,6}/|maps\.app\.goo\.gl/|goo\.gl/maps/|g\.page/|search\.google\.com/local/writereview)' then 'google'
  end
$$;

create or replace function review_links(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; l jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  select links into l from sa_review_links where restaurant = rest;
  return jsonb_build_object('ok', true, 'links', coalesce(l, '[]'::jsonb), 'lead', coalesce((c->>'lead')::boolean, false));
end; $$;

create or replace function review_links_set(p_token text, p_links jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; x jsonb; u text; k text; out jsonb := '[]'::jsonb; kinds text[] := '{}';
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_links is null or jsonb_typeof(p_links) <> 'array' or jsonb_array_length(p_links) > 2 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  for x in select * from jsonb_array_elements(p_links) loop
    u := btrim(case when jsonb_typeof(x) = 'string' then x #>> '{}' when jsonb_typeof(x) = 'object' then coalesce(x->>'url', '') else '' end);
    if u = '' then continue; end if;
    k := _sa_review_kind(u);
    if k is null then return jsonb_build_object('ok', false, 'error', 'bad_url', 'url', left(u, 80)); end if;
    if k = any(kinds) then return jsonb_build_object('ok', false, 'error', 'duplicate', 'kind', k); end if;
    kinds := kinds || k;
    out := out || jsonb_build_array(jsonb_build_object('kind', k, 'url', u));
  end loop;
  insert into sa_review_links (restaurant, links, updated_by) values (rest, out, c->>'id')
  on conflict (restaurant) do update set links = excluded.links, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true, 'links', out);
end; $$;

-- Гостю на странице «Спасибо передано»: ссылки заведения сотрудника по коду его QR
create or replace function guest_review_links(p_code text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare r sa_thanks_codes; l jsonb;
begin
  r := _sa_thanks_emp(p_code);
  if r.code is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select links into l from sa_review_links where restaurant = r.restaurant;
  return jsonb_build_object('ok', true, 'links', coalesce(l, '[]'::jsonb));
end; $$;

-- ── 4) Тихие часы ──────────────────────────────────────────────────────────────
-- Часы — по времени заведения; с 23 до 9 — через полночь. Колонки не булевы: в «виды сообщений» (этап 32) не попадают.
alter table sa_notify_prefs add column if not exists quiet_from smallint;
alter table sa_notify_prefs add column if not exists quiet_to smallint;

create or replace function _sa_quiet_now(p_from int, p_to int, p_hour int)
returns boolean language sql immutable as $$
  select p_from is not null and p_to is not null and p_from <> p_to and p_hour is not null
     and case when p_from < p_to then p_hour >= p_from and p_hour < p_to else p_hour >= p_from or p_hour < p_to end
$$;

-- Как в этапе 25, плюс тихие часы: вид сообщения задан (p_kind) — в тихие часы чата нет. Без вида (напоминание о смене,
-- подтверждение навыков) — чат есть всегда.
create or replace function _sa_tg_chat(p_emp text, p_kind text)
returns bigint language plpgsql stable security definer set search_path to public as $$
declare chat bigint; on_ boolean; pref jsonb; rest text; hh int;
begin
  if to_regclass('public.tg_links') is null then return null; end if;
  execute 'select chat_id, remind, restaurant from tg_links where emp_id = $1' into chat, on_, rest using p_emp;
  if chat is null or not coalesce(on_, false) then return null; end if;
  select to_jsonb(p) into pref from sa_notify_prefs p where p.emp_id = p_emp;
  if pref is not null and p_kind is not null and pref ? p_kind and not coalesce((pref->>p_kind)::boolean, true) then return null; end if;
  if pref is not null and p_kind is not null and pref->>'quiet_from' is not null and pref->>'quiet_to' is not null then
    hh := extract(hour from now() at time zone _sa_tz(rest))::int;
    if _sa_quiet_now((pref->>'quiet_from')::int, (pref->>'quiet_to')::int, hh) then return null; end if;
  end if;
  return chat;
end; $$;

create or replace function notify_quiet(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; f int; t int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select quiet_from, quiet_to into f, t from sa_notify_prefs where emp_id = c->>'id';
  return jsonb_build_object('ok', true, 'from', f, 'to', t);
end; $$;

-- p_from и p_to — часы 0–23; оба null — тихих часов нет
create or replace function notify_quiet_set(p_token text, p_from int, p_to int)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (p_from is null) <> (p_to is null) or (p_from is not null and (p_from not between 0 and 23 or p_to not between 0 and 23 or p_from = p_to)) then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  insert into sa_notify_prefs (emp_id, quiet_from, quiet_to) values (c->>'id', p_from, p_to)
  on conflict (emp_id) do update set quiet_from = excluded.quiet_from, quiet_to = excluded.quiet_to, updated_at = now();
  return jsonb_build_object('ok', true, 'from', p_from, 'to', p_to);
end; $$;

-- ── 5) Права ───────────────────────────────────────────────────────────────────
grant execute on function brief_read(text) to anon, authenticated;
grant execute on function brief_reads(text) to anon, authenticated;
grant execute on function seat_set(text, text, text, int, text, text, text) to anon, authenticated;
grant execute on function review_links(text) to anon, authenticated;
grant execute on function review_links_set(text, jsonb) to anon, authenticated;
grant execute on function guest_review_links(text) to anon, authenticated;
grant execute on function notify_quiet(text) to anon, authenticated;
grant execute on function notify_quiet_set(text, int, int) to anon, authenticated;
revoke all on function _sa_tg_chat(text, text) from public, anon, authenticated;
revoke all on function _sa_review_kind(text) from public, anon, authenticated;
revoke all on function _sa_quiet_now(int, int, int) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'удобнее: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('brief_read', 'brief_reads', 'review_links', 'review_links_set', 'guest_review_links', 'notify_quiet', 'notify_quiet_set')) ||
  ' функций из 7 · таблицы: ' || case when to_regclass('public.sa_brief_reads') is not null and to_regclass('public.sa_review_links') is not null then 'есть' else 'НЕТ' end ||
  ' · «Счёт» в рассадке: ' || case when pg_get_functiondef('public.seat_set(text,text,text,int,text,text,text)'::regprocedure) like '%''bill''%' then 'да' else 'нет' end ||
  ' · тихие часы: ' || case when pg_get_functiondef('public._sa_tg_chat(text,text)'::regprocedure) like '%_sa_quiet_now%' then 'да' else 'нет' end as result;
