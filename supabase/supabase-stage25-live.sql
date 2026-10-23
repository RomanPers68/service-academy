-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 25 (v31): «живая» академия — быстрее, честнее, вместе.
--
-- Нужны этапы 21 (личность по токену), 23 (копия с телефона emp_learning) и 24 (квест,
-- лига, свеча). Для сообщений в Telegram — этап 22б (бот, tg_links); без него всё остальное
-- работает, а кнопки «Подтолкнуть» и «Позвать» честно отвечают, что бот не подключён.
-- Ничего не ломает и ничего не удаляет. Можно запускать повторно.
--
--   sa_day_push(p_token, p_day, p_rec)   — быстрая отметка дня: квест и свеча видят занятие
--                                          через секунды, а не через 2 минуты
--   quest_today(p_token)                 — то же, что в этапе 24, плюс «спасибо команде»,
--                                          у кого включён Telegram и кто ещё не начинал
--   quest_thanks(p_token)                — «Спасибо команде» (раз в день)
--   quest_call(p_token)                  — старший зовёт на разминку тех, кто ещё не начал
--   league_week(p_token)                 — то же, что в этапе 24, плюс прошлая неделя (места,
--                                          стрелки), история кубка, победы; уроки и тесты
--                                          сверяются с записями сервера; коллеги других
--                                          заведений — с инициалом фамилии
--   pair_nudge(p_token)                  — «Подтолкнуть» напарника (раз в день, в Telegram)
--   notify_prefs(p_token) / notify_set   — что присылать в Telegram (каждый решает сам)
--   sa_nudges_tick() / sa_nudges_preview() — расписание подталкиваний (pg_cron, раз в 10 минут):
--                                          свеча на двоих вечером, итоги недели в понедельник,
--                                          выдыхающиеся темы в четверг, итоги месяца 1-го числа.
--                                          Только с 10 до 21 по часам заведения
--   gold_records(p_token, p_mod)         — рекорд заведения в «Раунде мастера» по теме
--   day_brief(p_token)                   — сводка дня одним запросом: квест, пара, место в лиге
--   guest_personas / guest_persona_save / guest_persona_delete / guest_persona_get
--                                        — свои гости заведения для «Живого гостя»
--   sa_tts_take(p_token, p_chars)        — счётчик «живых голосов» радио (только для функции
--                                          radio-tts: 400 новых фраз и 40 000 знаков в день)
-- И корзина radio-voice в Storage — для «живых голосов» радио (функция radio-tts, по желанию).
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.emp_learning') is null then
    raise exception 'Сначала этап 23 (supabase-stage23-reports.sql): нужна таблица emp_learning';
  end if;
  if to_regprocedure('public._sa_day_mark(jsonb,text,jsonb)') is null or to_regclass('public.sa_pairs') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужны квест, лига и свеча на двоих';
  end if;
end $$;

-- ── 0) Таблицы ─────────────────────────────────────────────────────────────────
-- «Спасибо команде»: кто сказал в этот день
create table if not exists sa_kudos (
  restaurant text not null default '',
  day        date not null,
  emp_id     text not null,
  created_at timestamptz not null default now(),
  primary key (restaurant, day, emp_id)
);
alter table sa_kudos enable row level security;
revoke all on sa_kudos from public, anon, authenticated;

-- Итоги недель лиги: место в заведении и в сети
create table if not exists sa_league_weeks (
  week_start date not null,
  emp_id     text not null,
  restaurant text,
  pts        int not null default 0,
  rank_rest  int,
  rank_net   int,
  primary key (week_start, emp_id)
);
create index if not exists sa_league_weeks_emp on sa_league_weeks (emp_id, week_start);
alter table sa_league_weeks enable row level security;
revoke all on sa_league_weeks from public, anon, authenticated;

-- Итоги недель кубка заведений
create table if not exists sa_cup_weeks (
  week_start date not null,
  restaurant text not null,
  avg        numeric not null default 0,
  people     int not null default 0,
  active     int not null default 0,
  rank       int,
  primary key (week_start, restaurant)
);
alter table sa_cup_weeks enable row level security;
revoke all on sa_cup_weeks from public, anon, authenticated;

-- Какие недели уже подведены (чтобы не считать заново)
create table if not exists sa_league_filled (
  week_start date primary key,
  filled_at  timestamptz not null default now()
);
alter table sa_league_filled enable row level security;
revoke all on sa_league_filled from public, anon, authenticated;

-- Что присылать в Telegram: по умолчанию всё включено (общий выключатель — tg_links.remind)
create table if not exists sa_notify_prefs (
  emp_id     text primary key,
  pair       boolean not null default true,
  quest      boolean not null default true,
  league     boolean not null default true,
  fresh      boolean not null default true,
  month      boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table sa_notify_prefs enable row level security;
revoke all on sa_notify_prefs from public, anon, authenticated;

-- Свои гости заведения («Живой гость»)
create table if not exists sa_guest_personas (
  id         text primary key default ('c-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
  restaurant text not null,
  place      text not null default 'hall' check (place in ('hall', 'door', 'bar')),
  name       text not null,
  age        int not null default 35,
  mood       int not null default 3,
  who        text not null default '',
  occasion   text not null default '',
  hidden     text not null default '',
  open       text not null default '',
  whisper    text not null default '',
  tags       text[] not null default '{}',
  active     boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sa_guest_personas_rest on sa_guest_personas (restaurant) where active;
alter table sa_guest_personas enable row level security;
revoke all on sa_guest_personas from public, anon, authenticated;

-- ── 1) Служебное ───────────────────────────────────────────────────────────────
-- текст без лишних пробелов, не длиннее n
create or replace function _sa_clip(p text, n int)
returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), greatest(n, 0))
$$;

-- склонение: 1 день, 2 дня, 5 дней
create or replace function _sa_plural(n int, a text, b text, c text)
returns text language sql immutable as $$
  select case when n % 10 = 1 and n % 100 <> 11 then a
              when n % 10 between 2 and 4 and (n % 100 < 10 or n % 100 >= 20) then b
              else c end
$$;

-- женское имя (для «сделала / сделал»): как в приложении — на -а/-я, кроме Никиты, Ильи и т. п.
create or replace function _sa_fem(p_name text)
returns boolean language sql immutable as $$
  select lower(split_part(btrim(coalesce(p_name, '')), ' ', 1)) ~ '[ая]$'
     and lower(split_part(btrim(coalesce(p_name, '')), ' ', 1)) !~ '^(никита|илья|кузьма|фома|лука|савва|данила|гаврила)$'
$$;

-- месяц в именительном / предложном падеже
create or replace function _sa_month_name(m int)
returns text language sql immutable as $$
  select (array['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'])[greatest(1, least(12, m))]
$$;
create or replace function _sa_month_gen(m int)
returns text language sql immutable as $$
  select (array['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'])[greatest(1, least(12, m))]
$$;

-- Telegram подключён (этап 22б) и бот есть
create or replace function _sa_tg_ready()
returns boolean language plpgsql stable security definer set search_path to public as $$
begin
  if to_regclass('public.tg_links') is null or to_regclass('public.tg_sent') is null
     or to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is null
     or to_regprocedure('public._sa_tg_token()') is null then return false; end if;
  return _sa_tg_token() is not null;
end; $$;

-- можно ли писать сотруднику этот вид сообщений: чат есть, общий выключатель включён, вид не выключен
create or replace function _sa_tg_chat(p_emp text, p_kind text)
returns bigint language plpgsql stable security definer set search_path to public as $$
declare chat bigint; on_ boolean; pref jsonb;
begin
  if to_regclass('public.tg_links') is null then return null; end if;
  execute 'select chat_id, remind from tg_links where emp_id = $1' into chat, on_ using p_emp;
  if chat is null or not coalesce(on_, false) then return null; end if;
  select to_jsonb(p) into pref from sa_notify_prefs p where p.emp_id = p_emp;
  if pref is not null and p_kind is not null and pref ? p_kind and not coalesce((pref->>p_kind)::boolean, true) then return null; end if;
  return chat;
end; $$;

-- отметить отправку (одна в день на вид); false — уже было
create or replace function _sa_tg_once(p_emp text, p_day date, p_kind text)
returns boolean language plpgsql security definer set search_path to public as $$
declare n int;
begin
  if to_regclass('public.tg_sent') is null then return false; end if;
  execute 'insert into tg_sent (emp_id, day, kind) values ($1, $2, $3) on conflict do nothing' using p_emp, p_day, p_kind;
  get diagnostics n = row_count;
  return n > 0;
end; $$;

-- уже отправляли?
create or replace function _sa_tg_was(p_emp text, p_day date, p_kind text)
returns boolean language plpgsql stable security definer set search_path to public as $$
declare n int := 0;
begin
  if to_regclass('public.tg_sent') is null then return false; end if;
  execute 'select count(*) from tg_sent where emp_id = $1 and day = $2 and kind = $3' into n using p_emp, p_day, p_kind;
  return n > 0;
end; $$;

-- ── 2) Быстрая отметка дня ─────────────────────────────────────────────────────
-- Телефон после разминки, урока или гостя присылает запись одного дня. Сервер берёт по каждому
-- полю наибольшее из того, что знал, и присланного (старая отметка не уменьшит новую), числа —
-- от 0 до 1000, день — сегодня или вчера/завтра по часам заведения (телефон мог перейти полночь).
create or replace function sa_day_push(p_token text, p_day text, p_rec jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; d date; ld date; rec jsonb := '{}'::jsonb; k text; v numeric; old jsonb; cur jsonb;
  fields constant text[] := array['st','l','p','q','d','b','w','m','x','g','r','u','o','k','f','s','c'];
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_day is null or p_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return jsonb_build_object('ok', false, 'error', 'bad'); end if;
  begin d := p_day::date; exception when others then return jsonb_build_object('ok', false, 'error', 'bad'); end;
  if to_char(d, 'YYYY-MM-DD') <> p_day then return jsonb_build_object('ok', false, 'error', 'bad'); end if;
  ld := (now() at time zone _sa_tz(c->>'restaurant'))::date;
  if d < ld - 1 or d > ld + 1 then return jsonb_build_object('ok', false, 'error', 'day'); end if;
  if p_rec is null or jsonb_typeof(p_rec) <> 'object' then return jsonb_build_object('ok', false, 'error', 'bad'); end if;
  foreach k in array fields loop
    v := _sa_num(p_rec->>k);
    if v > 0 then rec := rec || jsonb_build_object(k, floor(v)::int); end if;
  end loop;
  if rec = '{}'::jsonb then return jsonb_build_object('ok', true, 'skipped', true); end if;
  select data into old from emp_learning where emp_id = c->>'id' for update;
  if not found then
    insert into emp_learning (emp_id, emp_name, restaurant, data, updated_at)
    values (c->>'id', c->>'who', c->>'restaurant', jsonb_build_object('v', 2, 'activity', jsonb_build_object(p_day, rec)), now())
    on conflict (emp_id) do nothing;
    return jsonb_build_object('ok', true, 'day', p_day);
  end if;
  old := case when jsonb_typeof(old) = 'object' then old else '{}'::jsonb end;
  if jsonb_typeof(old->'activity') <> 'object' or old->'activity' is null then old := old || jsonb_build_object('activity', '{}'::jsonb); end if;
  cur := case when jsonb_typeof(old->'activity'->p_day) = 'object' then old->'activity'->p_day else '{}'::jsonb end;
  foreach k in array fields loop
    if rec ? k and _sa_num(cur->>k) < (rec->>k)::numeric then cur := cur || jsonb_build_object(k, (rec->>k)::int); end if;
  end loop;
  update emp_learning set data = jsonb_set(old, array['activity', p_day], cur), updated_at = now(),
         emp_name = c->>'who', restaurant = c->>'restaurant'
   where emp_id = c->>'id';
  return jsonb_build_object('ok', true, 'day', p_day);
end; $$;

-- ── 3) Квест смены: «спасибо команде», Telegram, кто ещё не начал ───────────────
-- тот же расчёт, что в этапе 24 (кто сегодня в графике, что сделал, цель), плюс новое
create or replace function quest_today(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; dkey text; ids text[]; known boolean; people jsonb := '[]'::jsonb; r record;
  n int; g_warm int; g_steps int; g_guest int; d_warm int := 0; d_steps int := 0; d_guest int := 0; me_on boolean := false;
  thanks jsonb; tg_ok boolean := _sa_tg_ready();
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := c->>'restaurant';
  ld := (now() at time zone _sa_tz(rest))::date; dkey := to_char(ld, 'YYYY-MM-DD');
  ids := _sa_on_shift(rest, ld);
  known := coalesce(array_length(ids, 1), 0) > 0;
  if not known then
    select coalesce(array_agg(em.id::text), '{}') into ids from employees em join emp_learning el on el.emp_id = em.id::text
     where em.restaurant is not distinct from rest and coalesce(em.status, 'active') = 'active'
       and _sa_num(_sa_act(el.data)->dkey->>'st') > 0;
    if not (c->>'id' = any(ids)) then ids := ids || (c->>'id'); end if;
  end if;
  me_on := c->>'id' = any(ids);
  for r in
    select em.id::text as id, em.name, coalesce(em.surname, '') as surname, lower(coalesce(em.position, '')) as position,
           coalesce(_sa_act(el.data)->dkey, '{}'::jsonb) as day, el.updated_at
      from employees em left join emp_learning el on el.emp_id = em.id::text
     where em.id::text = any(ids)
     order by em.name, em.surname
     limit 60
  loop
    people := people || jsonb_build_object('id', r.id, 'name', r.name, 'initial', left(r.surname, 1), 'position', r.position, 'me', r.id = c->>'id',
      'steps', _sa_num(r.day->>'st')::int, 'warm', _sa_num(r.day->>'w')::int, 'guest', _sa_num(r.day->>'g')::int, 'synced', r.updated_at is not null,
      'tg', tg_ok and _sa_tg_chat(r.id, 'quest') is not null,
      'called', _sa_tg_was(r.id, ld, 'quest_call'));
    d_steps := d_steps + _sa_num(r.day->>'st')::int; d_warm := d_warm + _sa_num(r.day->>'w')::int; d_guest := d_guest + _sa_num(r.day->>'g')::int;
  end loop;
  n := greatest(jsonb_array_length(people), 1);
  g_warm := n; g_steps := 2 * n; g_guest := greatest(1, round(n / 3.0)::int);
  select coalesce(jsonb_agg(jsonb_build_object('name', em.name, 'initial', left(coalesce(em.surname, ''), 1), 'me', k.emp_id = c->>'id') order by k.created_at), '[]'::jsonb)
    into thanks
    from sa_kudos k join employees em on em.id::text = k.emp_id
   where k.restaurant = coalesce(rest, '') and k.day = ld;
  return jsonb_build_object('ok', true, 'date', dkey, 'restaurant', rest, 'known', known, 'me_on', me_on, 'people', people,
    'goal', jsonb_build_object('warm', g_warm, 'steps', g_steps, 'guest', g_guest),
    'done', jsonb_build_object('warm', d_warm, 'steps', d_steps, 'guest', d_guest),
    'complete', d_warm >= g_warm and d_steps >= g_steps and d_guest >= g_guest,
    'thanks', thanks, 'lead', coalesce((c->>'lead')::boolean, false), 'tg', tg_ok);
end; $$;

-- «Спасибо команде»: один раз в день от каждого
create or replace function quest_thanks(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; ld date; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  ld := (now() at time zone _sa_tz(c->>'restaurant'))::date;
  insert into sa_kudos (restaurant, day, emp_id) values (coalesce(c->>'restaurant', ''), ld, c->>'id') on conflict do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'new', n > 0);
end; $$;

-- Старший смены зовёт на разминку тех, кто сегодня в смене и ещё не начинал (раз в день на человека)
create or replace function quest_call(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; q jsonb; p jsonb; ld date; chat bigint; sent int := 0; no_tg int := 0; already int := 0; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if not _sa_tg_ready() then return jsonb_build_object('ok', false, 'error', 'no_bot'); end if;
  q := quest_today(p_token);
  if not coalesce((q->>'ok')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'quest'); end if;
  ld := (q->>'date')::date;
  who := coalesce(nullif(c->>'name', ''), 'Старший смены');
  for p in select * from jsonb_array_elements(q->'people') loop
    if coalesce((p->>'me')::boolean, false) or _sa_num(p->>'steps') > 0 then continue; end if;
    chat := _sa_tg_chat(p->>'id', 'quest');
    if chat is null then no_tg := no_tg + 1; continue; end if;
    if not _sa_tg_once(p->>'id', ld, 'quest_call') then already := already + 1; continue; end if;
    perform sa_tg_send(chat, who || ' зовёт на разминку перед сменой: 2 минуты, 3 задания из того, что ты уже прошёл.' ||
      E'\n\nКвест смены закроем вместе.', 'Разминка', 'warmup');
    sent := sent + 1;
  end loop;
  return jsonb_build_object('ok', true, 'sent', sent, 'no_tg', no_tg, 'already', already);
end; $$;

-- ── 4) Лига недели: проверка по серверу, история, кубок ─────────────────────────
-- Записи прохождения уроков и тестов на сервере (progress, quiz_done) по людям за период.
-- Столбец времени ищется сам (created_at, inserted_at, updated_at, ts, done_at, completed_at);
-- нет такого — сверять не с чем, и лига верит телефону, как раньше.
create or replace function _sa_srv_ts_col(p_table text)
returns text language sql stable security definer set search_path to public as $$
  select c.column_name::text from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table
     and c.column_name in ('created_at', 'inserted_at', 'updated_at', 'ts', 'done_at', 'completed_at')
     and c.data_type like 'timestamp%'
     and exists (select 1 from information_schema.columns u where u.table_schema = 'public' and u.table_name = p_table and u.column_name = 'user_id')
   order by array_position(array['created_at', 'inserted_at', 'done_at', 'completed_at', 'ts', 'updated_at']::text[], c.column_name::text)
   limit 1
$$;

create or replace function _sa_srv_counts(p_table text, p_from date, p_to date, p_tz text)
returns table (uid text, n int) language plpgsql stable security definer set search_path to public as $$
declare col text;
begin
  if to_regclass('public.' || p_table) is null then return; end if;
  col := _sa_srv_ts_col(p_table);
  if col is null then return; end if;
  begin
    return query execute format('select user_id::text, count(*)::int from %I where %I >= ($1::timestamp at time zone $3) and %I < (($2 + 1)::timestamp at time zone $3) group by 1',
      p_table, col, col) using p_from, p_to, p_tz;
  exception when others then return;
  end;
end; $$;

-- очки уроков (урок, практика, диалог, сборка) и тестов за день — их сверяем с сервером
create or replace function _sa_lesson_points(r jsonb)
returns int language sql immutable as $$
  select case when jsonb_typeof(r) <> 'object' then 0 else least(200, round(
    _sa_num(r->>'l') * 10 + _sa_num(r->>'p') * 10 + _sa_num(r->>'d') * 15 + _sa_num(r->>'b') * 10))::int end
$$;
create or replace function _sa_quiz_points(r jsonb)
returns int language sql immutable as $$
  select case when jsonb_typeof(r) <> 'object' then 0 else least(200, round(_sa_num(r->>'q') * 15))::int end
$$;

-- Очки всех за период [p_from; p_to] по настоящим датам. Уроки — не больше 15 очков на каждую
-- запись прохождения на сервере за эти дни, тесты — так же (если сервер хранит время записи).
create or replace function _sa_league_rows(p_from date, p_to date, p_tz text)
returns table (emp_id text, name text, surname text, restaurant text, pos text, pts int, days int)
language plpgsql stable security definer set search_path to public as $$
declare prog_ok boolean := _sa_srv_ts_col('progress') is not null;
  quiz_ok boolean := _sa_srv_ts_col('quiz_done') is not null;
begin
  return query
  with base as (
    select em.id::text as id, em.name::text as nm, coalesce(em.surname, '')::text as sn, em.restaurant::text as rs,
           lower(coalesce(em.position, ''))::text as ps, el.data
      from employees em left join emp_learning el on el.emp_id = em.id::text
     where coalesce(em.status, 'active') = 'active' and not coalesce(em.is_admin, false)
  ), dd as (
    select b.id, _sa_act(b.data)->to_char(g, 'YYYY-MM-DD') as r
      from base b cross join generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  ), sums as (
    select dd.id,
           coalesce(sum(_sa_day_points(dd.r)), 0)::int as raw,
           coalesce(sum(_sa_lesson_points(dd.r)), 0)::int as lp,
           coalesce(sum(_sa_quiz_points(dd.r)), 0)::int as qp,
           (count(*) filter (where _sa_day_points(dd.r) > 0))::int as nd
      from dd group by dd.id
  ), srv_p as (select z.uid, z.n from _sa_srv_counts('progress', p_from, p_to, p_tz) z),
     srv_q as (select z.uid, z.n from _sa_srv_counts('quiz_done', p_from, p_to, p_tz) z)
  select b.id, b.nm, b.sn, b.rs, b.ps,
         greatest(0, s.raw
           - case when prog_ok then greatest(0, s.lp - coalesce(sp.n, 0) * 15) else 0 end
           - case when quiz_ok then greatest(0, s.qp - coalesce(sq.n, 0) * 15) else 0 end)::int,
         s.nd
    from base b join sums s on s.id = b.id
    left join srv_p sp on sp.uid = b.id
    left join srv_q sq on sq.uid = b.id;
end; $$;

-- неделя с понедельника p_ws закончилась везде: в каждом часовом поясе сети уже понедельник
-- после 6 утра (поздние копии с телефонов успевают прийти). Ревью v31: раньше неделю
-- подводил первый открывший лигу по своему поясу — на востоке, пока на западе ещё воскресенье.
create or replace function _sa_week_closed(p_ws date)
returns boolean language plpgsql stable security definer set search_path to public as $$
declare z text; zs text[] := array[_sa_tz(null::text)]; k text;
begin
  if p_ws is null then return false; end if;
  if to_regclass('public.sa_settings') is not null then
    begin
      for k in execute 'select substr(key, 4) from sa_settings where key like ''tz:%''' loop
        zs := zs || _sa_tz(k);
      end loop;
    exception when others then null;
    end;
  end if;
  foreach z in array zs loop
    if (now() at time zone z) < (p_ws + 7)::timestamp + interval '6 hours' then return false; end if;
  end loop;
  return true;
end; $$;

-- Подвести неделю: места в заведении и в сети, кубок. Один раз на неделю.
create or replace function _sa_league_fill(p_ws date, p_tz text)
returns boolean language plpgsql security definer set search_path to public as $$
declare base jsonb;
begin
  if p_ws is null or exists (select 1 from sa_league_filled where week_start = p_ws) then return false; end if;
  insert into sa_league_filled (week_start) values (p_ws) on conflict do nothing;
  if not found then return false; end if;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into base from _sa_league_rows(p_ws, p_ws + 6, p_tz) x;
  insert into sa_league_weeks (week_start, emp_id, restaurant, pts, rank_rest, rank_net)
  select p_ws, e.v->>'emp_id', e.v->>'restaurant', (e.v->>'pts')::int,
         rank() over (partition by coalesce(e.v->>'restaurant', '') order by (e.v->>'pts')::int desc)::int,
         rank() over (order by (e.v->>'pts')::int desc)::int
    from jsonb_array_elements(base) e(v)
   where (e.v->>'pts')::int > 0
  on conflict do nothing;
  insert into sa_cup_weeks (week_start, restaurant, avg, people, active, rank)
  select p_ws, r.rs, r.avg, r.people, r.active, rank() over (order by r.avg desc)::int
    from (select e.v->>'restaurant' as rs, round(sum((e.v->>'pts')::int)::numeric / greatest(count(*), 1), 1) as avg, count(*)::int as people,
                 (count(*) filter (where (e.v->>'pts')::int > 0))::int as active
            from jsonb_array_elements(base) e(v) where coalesce(e.v->>'restaurant', '') <> '' group by 1) r
   where r.active > 0
  on conflict do nothing;
  return true;
end; $$;

create or replace function league_week(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; tz text; lnow timestamp; ld date; ws date; pws date; base jsonb; rws jsonb; cup jsonb; hist jsonb; me_prev jsonb; wins jsonb; myrest text; k int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  myrest := c->>'restaurant';
  tz := _sa_tz(myrest);
  lnow := now() at time zone tz; ld := lnow::date;
  ws := ld - (extract(isodow from ld)::int - 1);
  pws := ws - 7;
  -- прошлая неделя закончилась во всей сети — подводим один раз (и добираем до 4 недель назад,
  -- если тогда лигу никто не открывал)
  if _sa_week_closed(pws) then
    for k in 0..4 loop perform _sa_league_fill(pws - 7 * k, tz); end loop;
  end if;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into base from _sa_league_rows(ws, ld, tz) x;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.v->>'emp_id', 'name', t.v->>'name',
           'surname', case when t.v->>'restaurant' is not distinct from myrest then t.v->>'surname'
                           else left(t.v->>'surname', 1) || case when coalesce(t.v->>'surname', '') <> '' then '.' else '' end end,
           'restaurant', t.v->>'restaurant', 'position', t.v->>'pos', 'pts', (t.v->>'pts')::int, 'days', (t.v->>'days')::int,
           'me', t.v->>'emp_id' = c->>'id',
           'prev_rest', lw.rank_rest, 'prev_net', lw.rank_net, 'prev_pts', lw.pts)
           order by (t.v->>'pts')::int desc, t.v->>'name', t.v->>'surname'), '[]'::jsonb)
    into rws
    from (select e.v from jsonb_array_elements(base) e(v)
           where (e.v->>'pts')::int > 0 or e.v->>'emp_id' = c->>'id'
           order by (e.v->>'pts')::int desc limit 500) t
    left join sa_league_weeks lw on lw.week_start = pws and lw.emp_id = t.v->>'emp_id';
  select coalesce(jsonb_agg(jsonb_build_object('restaurant', r.rs, 'people', r.people, 'active', r.active, 'pts', r.pts, 'avg', r.avg,
           'mine', r.rs is not distinct from myrest, 'prev_rank', cw.rank) order by r.avg desc, r.rs), '[]'::jsonb)
    into cup
    from (select e.v->>'restaurant' as rs, count(*)::int as people, (count(*) filter (where (e.v->>'pts')::int > 0))::int as active,
                 sum((e.v->>'pts')::int)::int as pts, round(sum((e.v->>'pts')::int)::numeric / greatest(count(*), 1), 1) as avg
            from jsonb_array_elements(base) e(v) where coalesce(e.v->>'restaurant', '') <> '' group by 1) r
    left join sa_cup_weeks cw on cw.week_start = pws and cw.restaurant = r.rs;
  select coalesce(jsonb_agg(jsonb_build_object('week_start', to_char(h.week_start, 'YYYY-MM-DD'), 'restaurant', h.restaurant, 'avg', h.avg) order by h.week_start desc), '[]'::jsonb)
    into hist
    from (select * from sa_cup_weeks where rank = 1 and week_start >= pws - 7 * 11 order by week_start desc, avg desc limit 12) h;
  select jsonb_build_object('pts', lw.pts, 'rank_rest', lw.rank_rest, 'rank_net', lw.rank_net) into me_prev
    from sa_league_weeks lw where lw.week_start = pws and lw.emp_id = c->>'id';
  select jsonb_build_object('rest', count(*) filter (where lw.rank_rest = 1), 'net', count(*) filter (where lw.rank_net = 1)) into wins
    from sa_league_weeks lw where lw.emp_id = c->>'id';
  return jsonb_build_object('ok', true, 'week_start', to_char(ws, 'YYYY-MM-DD'), 'today', to_char(ld, 'YYYY-MM-DD'), 'restaurant', myrest,
    'prev_week', to_char(pws, 'YYYY-MM-DD'), 'rows', rws, 'cup', cup, 'cup_hist', hist, 'me_prev', me_prev, 'wins', wins,
    'verified', _sa_srv_ts_col('progress') is not null);
end; $$;

-- ── 5) Свеча на двоих: «Подтолкнуть» ───────────────────────────────────────────
create or replace function pair_nudge(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; me text; r record; partner text; ld date; db jsonb; chat bigint; pname text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  me := c->>'id';
  perform _sa_pairs_tidy();
  select * into r from sa_pairs where status = 'active' and (a = me or b = me) order by id desc limit 1;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'no_pair'); end if;
  partner := case when r.a = me then r.b else r.a end;
  if not _sa_tg_ready() then return jsonb_build_object('ok', false, 'error', 'no_bot'); end if;
  ld := (now() at time zone _sa_tz(c->>'restaurant'))::date;
  select data into db from emp_learning where emp_id = partner;
  if _sa_day_mark(coalesce(db, '{}'::jsonb), to_char(ld, 'YYYY-MM-DD'), null) = 2 then return jsonb_build_object('ok', false, 'error', 'done'); end if;
  chat := _sa_tg_chat(partner, 'pair');
  if chat is null then return jsonb_build_object('ok', false, 'error', 'no_tg'); end if;
  if not _sa_tg_once(partner, ld, 'pair_nudge') then return jsonb_build_object('ok', false, 'error', 'already'); end if;
  pname := coalesce(nullif(c->>'name', ''), 'Напарник');
  perform sa_tg_send(chat, pname || ' зовёт: свеча на двоих ждёт твой шаг сегодня. Хватит одной разминки на 2 минуты.', 'Мой шаг', 'pair');
  return jsonb_build_object('ok', true, 'sent', true);
end; $$;

-- ── 6) Что присылать в Telegram ───────────────────────────────────────────────
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
    'fresh', coalesce(p.fresh, true), 'month', coalesce(p.month, true));
end; $$;

create or replace function notify_set(p_token text, p_kind text, p_on boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_kind is null or p_kind not in ('pair', 'quest', 'league', 'fresh', 'month') then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  insert into sa_notify_prefs (emp_id) values (c->>'id') on conflict do nothing;
  execute format('update sa_notify_prefs set %I = $1, updated_at = now() where emp_id = $2', p_kind) using coalesce(p_on, false), c->>'id';
  return notify_prefs(p_token);
end; $$;

-- ── 7) Подталкивания по расписанию ─────────────────────────────────────────────
-- p_send = false — только посмотреть, что ушло бы (ничего не отмечает и не отправляет).
-- p_now — «который час» (для проверки на тестовой базе; в жизни — now()).
create or replace function _sa_nudges_at(p_send boolean, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path to public as $$
declare out jsonb := '[]'::jsonb; e record; tz text; lnow timestamp; ld date; hr int; dow int; chat bigint;
  pr record; x text; y text; dx jsonb; dy jsonb; sx jsonb; sy jsonb; ynm text; txt text;
  pws date; me record; cupw text; nf int; nowms numeric; m0 date; m1 date; adays int; asteps int; wk date;
begin
  if not _sa_tg_ready() then return out; end if;
  if p_send then perform _sa_pairs_tidy(); end if;
  -- (а) свеча на двоих: вечером (18–21 по часам заведения), если напарник уже занимался, а ты — нет
  for pr in select p.id, p.a, p.b from sa_pairs p where p.status = 'active' loop
    foreach x in array array[pr.a, pr.b] loop
      y := case when x = pr.a then pr.b else pr.a end;
      select em.restaurant into e from employees em where em.id::text = x;
      tz := _sa_tz(e.restaurant);
      lnow := p_now at time zone tz; ld := lnow::date; hr := extract(hour from lnow)::int;
      if hr < 18 or hr >= 21 then continue; end if;
      chat := _sa_tg_chat(x, 'pair');
      if chat is null or _sa_tg_was(x, ld, 'pair_eve') then continue; end if;
      select data into dx from emp_learning where emp_id = x;
      select data into dy from emp_learning where emp_id = y;
      sx := _sa_emp_sched(x, ld, ld); sy := _sa_emp_sched(y, ld, ld);
      if _sa_day_mark(coalesce(dx, '{}'::jsonb), to_char(ld, 'YYYY-MM-DD'), sx) <> 0 then continue; end if;   -- уже занимался или выходной
      if _sa_day_mark(coalesce(dy, '{}'::jsonb), to_char(ld, 'YYYY-MM-DD'), sy) <> 2 then continue; end if;   -- напарник ещё не занимался
      select coalesce(nullif(em.name, ''), 'Напарник') into ynm from employees em where em.id::text = y;
      txt := ynm || case when _sa_fem(ynm) then ' уже сделала' else ' уже сделал' end ||
             ' свою часть, свеча на двоих ждёт тебя. Хватит одной разминки.';
      if p_send then
        if not _sa_tg_once(x, ld, 'pair_eve') then continue; end if;
        perform sa_tg_send(chat, txt, 'Мой шаг', 'pair');
      end if;
      out := out || jsonb_build_object('kind', 'pair', 'emp', x, 'text', txt);
    end loop;
  end loop;
  -- (б) итоги недели — в понедельник с 10 до 21; (в) выдыхающиеся темы — в четверг с 12 до 20;
  -- (г) итоги месяца — 1-го числа с 12 до 20
  for e in select tl.emp_id, em.name, em.restaurant from tg_links tl join employees em on em.id::text = tl.emp_id
            where tl.remind and coalesce(em.status, 'active') = 'active' loop
    tz := _sa_tz(e.restaurant);
    lnow := p_now at time zone tz; ld := lnow::date; hr := extract(hour from lnow)::int; dow := extract(isodow from ld)::int;
    wk := ld - (dow - 1);
    if dow = 1 and hr >= 10 and hr < 21 and _sa_tg_chat(e.emp_id, 'league') is not null and not _sa_tg_was(e.emp_id, wk - 7, 'league_week') then
      pws := wk - 7;
      -- подвести неделю — только при настоящей отправке (просмотр ничего не пишет, ревью v31)
      if p_send and _sa_week_closed(pws) then perform _sa_league_fill(pws, tz); end if;
      select lw.pts, lw.rank_rest, lw.rank_net,
             (select count(*) from sa_league_weeks z where z.week_start = pws and z.restaurant is not distinct from lw.restaurant) as n_rest,
             (select count(*) from sa_league_weeks z where z.week_start = pws) as n_net
        into me from sa_league_weeks lw where lw.week_start = pws and lw.emp_id = e.emp_id;
      select restaurant into cupw from sa_cup_weeks where week_start = pws and rank = 1 order by avg desc, restaurant limit 1;
      if me.pts is not null and me.pts > 0 then
        txt := 'Итоги недели в лиге: ' || me.rank_rest || '-е место в заведении (из ' || me.n_rest || ')' ||
               case when me.n_net > me.n_rest then ' и ' || me.rank_net || '-е в сети' else '' end || ', ' || me.pts || ' ' || _sa_plural(me.pts, 'очко', 'очка', 'очков') || '.' ||
               case when cupw is not null then E'\nКубок заведений у «' || cupw || '».' else '' end ||
               E'\n\nНовая неделя: все снова с нуля.';
        if p_send then
          if _sa_tg_once(e.emp_id, pws, 'league_week') then perform sa_tg_send(_sa_tg_chat(e.emp_id, 'league'), txt, 'Лига недели', 'league'); else txt := null; end if;
        end if;
        if txt is not null then out := out || jsonb_build_object('kind', 'league', 'emp', e.emp_id, 'text', txt); end if;
      end if;
    end if;
    if dow = 4 and hr >= 12 and hr < 20 and _sa_tg_chat(e.emp_id, 'fresh') is not null and not _sa_tg_was(e.emp_id, wk, 'fresh_week') then
      nowms := extract(epoch from p_now) * 1000;
      select count(*) into nf
        from emp_learning el, jsonb_each(case when jsonb_typeof(el.data->'fresh') = 'object' then el.data->'fresh' else '{}'::jsonb end) f
       where el.emp_id = e.emp_id and jsonb_typeof(f.value) = 'object'
         and (f.value->>'t') ~ '^[0-9]{10,15}(\.[0-9]+)?$'
         and nowms - (f.value->>'t')::numeric >= (array[3, 7, 14, 30, 60])[least(5, _sa_num(f.value->>'n')::int + 1)] * 86400000::numeric;
      if nf >= 3 then
        -- без точного числа: сервер видит свежесть всех треков, а «Погреб тем» — текущего (ревью v31)
        txt := 'Несколько тем начали выдыхаться' ||
               '. Освежить их можно разом за 3 минуты: «Погреб тем» → «Освежить всё».';
        if p_send then
          if _sa_tg_once(e.emp_id, wk, 'fresh_week') then perform sa_tg_send(_sa_tg_chat(e.emp_id, 'fresh'), txt, 'Освежить', 'cellar'); else txt := null; end if;
        end if;
        if txt is not null then out := out || jsonb_build_object('kind', 'fresh', 'emp', e.emp_id, 'text', txt); end if;
      end if;
    end if;
    if extract(day from ld)::int = 1 and hr >= 12 and hr < 20 and _sa_tg_chat(e.emp_id, 'month') is not null and not _sa_tg_was(e.emp_id, ld, 'month') then
      m1 := ld - 1; m0 := date_trunc('month', m1)::date;
      -- день в деле — как в приложении: шаги, исправленные ошибки, ситуации или день серии
      select count(*) filter (where _sa_num(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')->>'st') + _sa_num(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')->>'f')
                                    + _sa_num(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')->>'s') > 0
                                 or (jsonb_typeof(el.data->'streak'->'days') = 'array' and (el.data->'streak'->'days') ? to_char(g, 'YYYY-MM-DD')))::int,
             coalesce(sum(_sa_num(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')->>'st')), 0)::int
        into adays, asteps
        from emp_learning el cross join generate_series(m0::timestamp, m1::timestamp, interval '1 day') g
       where el.emp_id = e.emp_id;
      if coalesce(adays, 0) > 0 then
        txt := 'Итоги ' || _sa_month_gen(extract(month from m0)::int) || ' готовы: ' ||
               adays || ' ' || _sa_plural(adays, 'день', 'дня', 'дней') || ' в деле, ' || asteps || ' ' || _sa_plural(asteps, 'шаг', 'шага', 'шагов') || ' обучения.' ||
               E'\n\nКарточки лежат в «Я» → «Итоги месяца».';
        if p_send then
          if _sa_tg_once(e.emp_id, ld, 'month') then perform sa_tg_send(_sa_tg_chat(e.emp_id, 'month'), txt, 'Итоги месяца', 'month'); else txt := null; end if;
        end if;
        if txt is not null then out := out || jsonb_build_object('kind', 'month', 'emp', e.emp_id, 'text', txt); end if;
      end if;
    end if;
  end loop;
  return out;
end; $$;

create or replace function _sa_nudges_due(p_send boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
begin
  return _sa_nudges_at(p_send, now());
end; $$;

create or replace function sa_nudges_tick()
returns int language plpgsql security definer set search_path to public as $$
declare r jsonb;
begin
  if not _sa_tg_ready() then return 0; end if;
  r := _sa_nudges_due(true);
  return coalesce(jsonb_array_length(r), 0);
end; $$;

create or replace function sa_nudges_preview()
returns jsonb language plpgsql security definer set search_path to public as $$
begin
  return _sa_nudges_due(false);
end; $$;

-- ── 8) Рекорд заведения в «Раунде мастера» ─────────────────────────────────────
create or replace function gold_records(p_token text, p_mod text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; m text; best record; mine jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  m := left(coalesce(p_mod, ''), 60);
  if m = '' then return jsonb_build_object('ok', false, 'error', 'bad'); end if;
  with g as (
    select em.id::text as id, em.name, coalesce(em.surname, '') as surname,
           _sa_num(el.data->'gold'->m->>'sec')::int as sec, _sa_num(el.data->'gold'->m->>'w')::int as w
      from employees em join emp_learning el on el.emp_id = em.id::text
     where em.restaurant is not distinct from c->>'restaurant' and coalesce(em.status, 'active') = 'active'
       and jsonb_typeof(el.data->'gold'->m) = 'object' and _sa_num(el.data->'gold'->m->>'sec') > 0
  )
  select g.id, g.name, g.surname, g.sec, g.w, (select count(*) from g)::int as cnt into best from g order by g.w, g.sec, g.name limit 1;
  select jsonb_build_object('sec', _sa_num(el.data->'gold'->m->>'sec')::int, 'w', _sa_num(el.data->'gold'->m->>'w')::int) into mine
    from emp_learning el where el.emp_id = c->>'id' and jsonb_typeof(el.data->'gold'->m) = 'object';
  if best.id is null then return jsonb_build_object('ok', true, 'best', null, 'mine', mine, 'n', 0); end if;
  return jsonb_build_object('ok', true, 'n', best.cnt, 'mine', mine,
    'best', jsonb_build_object('sec', best.sec, 'w', best.w, 'name', best.name, 'initial', left(best.surname, 1), 'me', best.id = c->>'id'));
end; $$;

-- ── 9) Сводка дня одним запросом ───────────────────────────────────────────────
create or replace function day_brief(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; tz text; ld date; ws date; base jsonb; me record; n_rest int; n_net int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  tz := _sa_tz(c->>'restaurant');
  ld := (now() at time zone tz)::date;
  ws := ld - (extract(isodow from ld)::int - 1);
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into base from _sa_league_rows(ws, ld, tz) x;
  select t.pts, t.rr, t.rn into me
    from (select e.v->>'emp_id' as id, (e.v->>'pts')::int as pts,
                 rank() over (partition by coalesce(e.v->>'restaurant', '') order by (e.v->>'pts')::int desc)::int as rr,
                 rank() over (order by (e.v->>'pts')::int desc)::int as rn
            from jsonb_array_elements(base) e(v) where (e.v->>'pts')::int > 0) t
   where t.id = c->>'id';
  select count(*) filter (where e.v->>'restaurant' is not distinct from c->>'restaurant' and (e.v->>'pts')::int > 0),
         count(*) filter (where (e.v->>'pts')::int > 0)
    into n_rest, n_net from jsonb_array_elements(base) e(v);
  return jsonb_build_object('ok', true, 'quest', quest_today(p_token), 'pair', pair_status(p_token),
    'league', jsonb_build_object('pts', coalesce(me.pts, 0), 'rank_rest', me.rr, 'rank_net', me.rn, 'n_rest', n_rest, 'n_net', n_net));
end; $$;

-- ── 10) Свои гости заведения ───────────────────────────────────────────────────
create or replace function _sa_persona_json(p sa_guest_personas)
returns jsonb language sql immutable as $$
  select jsonb_build_object('id', p.id, 'place', p.place, 'name', p.name, 'age', p.age, 'mood', p.mood, 'who', p.who,
    'occasion', p.occasion, 'hidden', p.hidden, 'open', p.open, 'whisper', p.whisper, 'tags', to_jsonb(p.tags), 'custom', true)
$$;

create or replace function guest_personas(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rows jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select coalesce(jsonb_agg(_sa_persona_json(p) order by p.created_at), '[]'::jsonb) into rows
    from sa_guest_personas p where p.active and p.restaurant is not distinct from c->>'restaurant';
  return jsonb_build_object('ok', true, 'rows', rows, 'can_edit', coalesce((c->>'lead')::boolean, false) and coalesce(c->>'restaurant', '') <> '');
end; $$;

create or replace function guest_persona_save(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; d jsonb; pid text; nm text; pl text; tg text[]; r sa_guest_personas; cnt int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if coalesce(c->>'restaurant', '') = '' then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  d := case when jsonb_typeof(p_data) = 'object' then p_data else '{}'::jsonb end;
  nm := _sa_clip(d->>'name', 40);
  if nm = '' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if _sa_clip(d->>'open', 200) = '' then return jsonb_build_object('ok', false, 'error', 'open'); end if;
  pl := case when d->>'place' in ('hall', 'door', 'bar') then d->>'place' else 'hall' end;
  select coalesce(array_agg(_sa_clip(t, 24)) filter (where _sa_clip(t, 24) <> ''), '{}') into tg
    from (select jsonb_array_elements_text(case when jsonb_typeof(d->'tags') = 'array' then d->'tags' else '[]'::jsonb end) t limit 3) s;
  pid := nullif(_sa_clip(d->>'id', 40), '');
  if pid is not null then
    select * into r from sa_guest_personas where id = pid and active;
    if r.id is null or r.restaurant is distinct from c->>'restaurant' then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    update sa_guest_personas set place = pl, name = nm,
           age = greatest(16, least(90, coalesce(nullif(_sa_num(d->>'age')::int, 0), 35))),
           mood = greatest(1, least(5, coalesce(nullif(_sa_num(d->>'mood')::int, 0), 3))),
           who = _sa_clip(d->>'who', 200), occasion = _sa_clip(d->>'occasion', 120), hidden = _sa_clip(d->>'hidden', 300),
           open = _sa_clip(d->>'open', 200), whisper = _sa_clip(d->>'whisper', 160), tags = tg, updated_at = now()
     where id = pid returning * into r;
  else
    select count(*) into cnt from sa_guest_personas where active and restaurant is not distinct from c->>'restaurant';
    if cnt >= 30 then return jsonb_build_object('ok', false, 'error', 'limit'); end if;
    insert into sa_guest_personas (restaurant, place, name, age, mood, who, occasion, hidden, open, whisper, tags, created_by)
    values (c->>'restaurant', pl, nm, greatest(16, least(90, coalesce(nullif(_sa_num(d->>'age')::int, 0), 35))),
            greatest(1, least(5, coalesce(nullif(_sa_num(d->>'mood')::int, 0), 3))),
            _sa_clip(d->>'who', 200), _sa_clip(d->>'occasion', 120), _sa_clip(d->>'hidden', 300), _sa_clip(d->>'open', 200),
            _sa_clip(d->>'whisper', 160), tg, c->>'id')
    returning * into r;
  end if;
  return jsonb_build_object('ok', true, 'row', _sa_persona_json(r));
end; $$;

create or replace function guest_persona_delete(p_token text, p_id text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  update sa_guest_personas set active = false, updated_at = now()
   where id = p_id and active and restaurant is not distinct from c->>'restaurant';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end; $$;

-- для функции ai-chat: персонаж своего заведения по номеру (чужой или удалённый — нет)
create or replace function guest_persona_get(p_token text, p_id text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; r sa_guest_personas;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into r from sa_guest_personas where id = p_id and active and restaurant is not distinct from c->>'restaurant';
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'row', _sa_persona_json(r));
end; $$;

-- ── 10б) «Живые голоса» радио: счётчик на сотрудника в день ─────────────────────
-- Функция radio-tts спрашивает разрешение на каждую новую фразу (из кэша — без счёта).
-- Счёт атомарный: параллельные запросы не проскочат лимит (ревью v31). Вызывает только
-- сервер (сервисным ключом) — из приложения функция закрыта.
create table if not exists sa_tts_usage (
  emp_id text not null,
  day    date not null,
  n      int  not null default 0,
  chars  int  not null default 0,
  primary key (emp_id, day)
);
alter table sa_tts_usage enable row level security;
revoke all on sa_tts_usage from public, anon, authenticated;

create or replace function sa_tts_take(p_token text, p_chars int)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; r sa_tts_usage; lim_n int := 400; lim_c int := 40000; ch int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  ch := greatest(0, least(coalesce(p_chars, 0), 2000));
  insert into sa_tts_usage as u (emp_id, day, n, chars) values (c->>'id', current_date, 1, ch)
  on conflict (emp_id, day) do update set n = u.n + 1, chars = u.chars + excluded.chars
  returning * into r;
  if coalesce((c->>'admin')::boolean, false) then return jsonb_build_object('ok', true, 'n', r.n, 'chars', r.chars); end if;
  if r.n > lim_n or r.chars > lim_c then
    return jsonb_build_object('ok', false, 'error', 'daily_limit', 'limit', lim_n, 'limit_chars', lim_c);
  end if;
  return jsonb_build_object('ok', true, 'n', r.n, 'chars', r.chars, 'limit', lim_n, 'limit_chars', lim_c);
end; $$;

-- ── 11) Корзина для «живых голосов» радио (по желанию) ─────────────────────────
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('radio-voice', 'radio-voice', true, 2097152, array['audio/mpeg'])
    on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['audio/mpeg'];
    -- Политику чтения НЕ создаём: публичные ссылки работают и без неё, а с ней корзину можно
    -- было бы листать списком (в фразах — тексты уроков, в том числе своих уроков заведения).
    -- Пишет в корзину только функция radio-tts сервисным ключом.
    begin
      execute 'drop policy if exists "radio voice public read" on storage.objects';
    exception when others then null;
    end;
  end if;
exception when others then
  raise notice 'radio-voice: корзина не создана (%) — живые голоса радио выключены, всё остальное работает', sqlerrm;
end $$;

-- ── 12) Расписание подталкиваний (pg_cron) ─────────────────────────────────────
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: подталкивания в Telegram не пойдут по расписанию (включи pg_cron и запусти файл ещё раз)';
    return;
  end if;
  begin execute $c$select cron.unschedule('sa-nudges')$c$; exception when others then null; end;
  execute $c$select cron.schedule('sa-nudges', '*/10 * * * *', 'select public.sa_nudges_tick()')$c$;
exception when others then
  raise notice 'Расписание подталкиваний не создано: %', sqlerrm;
end $$;

-- ── 13) Права ─────────────────────────────────────────────────────────────────
revoke all on function _sa_clip(text, int) from public, anon, authenticated;
revoke all on function _sa_fem(text) from public, anon, authenticated;
revoke all on function _sa_plural(int, text, text, text) from public, anon, authenticated;
revoke all on function _sa_month_name(int) from public, anon, authenticated;
revoke all on function _sa_month_gen(int) from public, anon, authenticated;
revoke all on function _sa_tg_ready() from public, anon, authenticated;
revoke all on function _sa_tg_chat(text, text) from public, anon, authenticated;
revoke all on function _sa_tg_once(text, date, text) from public, anon, authenticated;
revoke all on function _sa_tg_was(text, date, text) from public, anon, authenticated;
revoke all on function _sa_srv_ts_col(text) from public, anon, authenticated;
revoke all on function _sa_srv_counts(text, date, date, text) from public, anon, authenticated;
revoke all on function _sa_lesson_points(jsonb) from public, anon, authenticated;
revoke all on function _sa_quiz_points(jsonb) from public, anon, authenticated;
revoke all on function _sa_league_rows(date, date, text) from public, anon, authenticated;
revoke all on function _sa_league_fill(date, text) from public, anon, authenticated;
revoke all on function _sa_nudges_at(boolean, timestamptz) from public, anon, authenticated;
revoke all on function _sa_nudges_due(boolean) from public, anon, authenticated;
revoke all on function sa_nudges_tick() from public, anon, authenticated;
revoke all on function sa_nudges_preview() from public, anon, authenticated;
revoke all on function _sa_persona_json(sa_guest_personas) from public, anon, authenticated;
revoke all on function _sa_week_closed(date) from public, anon, authenticated;
revoke all on function sa_tts_take(text, int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function sa_tts_take(text, int) to service_role'; end if;
end $$;
grant execute on function sa_day_push(text, text, jsonb) to anon, authenticated;
grant execute on function quest_today(text) to anon, authenticated;
grant execute on function quest_thanks(text) to anon, authenticated;
grant execute on function quest_call(text) to anon, authenticated;
grant execute on function league_week(text) to anon, authenticated;
grant execute on function pair_nudge(text) to anon, authenticated;
grant execute on function notify_prefs(text) to anon, authenticated;
grant execute on function notify_set(text, text, boolean) to anon, authenticated;
grant execute on function gold_records(text, text) to anon, authenticated;
grant execute on function day_brief(text) to anon, authenticated;
grant execute on function guest_personas(text) to anon, authenticated;
grant execute on function guest_persona_save(text, jsonb) to anon, authenticated;
grant execute on function guest_persona_delete(text, text) to anon, authenticated;
grant execute on function guest_persona_get(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 14) Проверка ──────────────────────────────────────────────────────────────
select 'живая академия: ' || (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname in ('sa_day_push', 'quest_thanks', 'quest_call', 'pair_nudge', 'notify_prefs', 'notify_set',
                         'gold_records', 'day_brief', 'guest_personas', 'guest_persona_save', 'guest_persona_delete', 'guest_persona_get', 'sa_tts_take'))
       || ' функций из 13, таблиц ' || (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                       where n.nspname = 'public' and c.relname in ('sa_kudos', 'sa_league_weeks', 'sa_cup_weeks', 'sa_league_filled', 'sa_notify_prefs', 'sa_guest_personas', 'sa_tts_usage'))
       || ' из 7'
       || case when _sa_tg_ready() then ' · Telegram: есть' else ' · Telegram: нет (этап 22б и токен бота — для подталкиваний)' end
       || case when to_regnamespace('cron') is null then ' · pg_cron: нет' else ' · расписание: каждые 10 минут' end as result;
