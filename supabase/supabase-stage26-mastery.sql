-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 26 (v40): «Путь мастера» — мастера заведения, приз от руководителя, «Шаг дня».
--
-- Нужны этапы 21 (личность по токену), 23 (копия с телефона emp_learning, права отчётов),
-- 24 (часовой пояс заведения) и 25 (настройки сообщений, помощники Telegram). Для сообщений
-- в Telegram и «Шага дня» в напоминании — этап 22б (бот, tg_links); без него всё остальное
-- работает, а коллегам просто ничего не уходит. Ничего не удаляет. Можно запускать повторно.
--
--   mastery_claim(p_token, p_role, p_have, p_need)
--                          — телефон сообщает: роль пройдена (p_have из p_need, p_have ≥ p_need > 0).
--                            Запись одна на человека и роль (после сброса прогресса руководителем —
--                            заново, с новой датой). В первый раз коллеги заведения
--                            получают в Telegram «<Имя> стал(а) мастером роли «…» ✦» с кнопкой
--                            «Путь мастера» — каждому не больше одного такого сообщения в день.
--                            Ответ: {ok, new, sent}
--   mastery_list(p_token)  — мастера своего заведения (только действующие сотрудники; сброшенный
--                            руководителем после того, как стал мастером, — не в списке), новые сверху:
--                            {ok, rows: [{who, name, role, at, me}], prize, can_prize}
--   mastery_prize_set(p_token, p_text)
--                          — приз заведения для мастеров (менеджер, старший, владелец): до 200 знаков,
--                            пустой текст — убрать приз. Ответ: {ok, prize}
--   notify_prefs / notify_set — то же, что в этапе 25, плюс вид «master» (мастера заведения)
--   «Шаг дня»              — напоминание за час до смены (этап 22б) заканчивается строкой
--                            «Шаг дня: …», если телефон прислал шаг на сегодня
--                            (emp_learning.data → mastery.step = {"day": "ГГГГ-ММ-ДД", "t": "…"})
--
-- ВАЖНО: этапы 22б и 25 пересоздают напоминание и настройки сообщений по-своему. Если
-- запускаешь один из них заново ПОСЛЕ этого файла — запусти потом и этот ещё раз.
-- Если этап 22б (напоминания) включаешь впервые после этого файла — тоже.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.emp_learning') is null or to_regprocedure('public._sa_report_rank(jsonb)') is null then
    raise exception 'Сначала этап 23 (supabase-stage23-reports.sql): нужны таблица emp_learning и права отчётов';
  end if;
  if to_regprocedure('public._sa_tz(text)') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужен часовой пояс заведения';
  end if;
  if to_regclass('public.sa_notify_prefs') is null or to_regprocedure('public._sa_tg_chat(text,text)') is null
     or to_regprocedure('public._sa_tg_once(text,date,text)') is null or to_regprocedure('public._sa_tg_ready()') is null
     or to_regprocedure('public._sa_fem(text)') is null then
    raise exception 'Сначала этап 25 (supabase-stage25-live.sql): нужны настройки сообщений и помощники Telegram';
  end if;
end $$;

-- ── 0) Таблицы ─────────────────────────────────────────────────────────────────
-- Кто стал мастером какой роли (одна запись на человека и роль)
create table if not exists sa_masters (
  emp_id     text not null,                  -- employees.id
  role       text not null,                  -- seasonal | core | manager | service_manager | spg | bar
  restaurant text,                           -- заведение в момент, когда стал мастером
  at         timestamptz not null default now(),
  have       int,                            -- сколько пройдено (как посчитал телефон)
  need       int,                            -- сколько нужно
  primary key (emp_id, role)
);
alter table sa_masters enable row level security;      -- политик нет: напрямую не читается
revoke all on sa_masters from public, anon, authenticated;

-- Сбросы прогресса (этап 20 создаёт ту же таблицу; без него — создаём здесь). Руководитель сбросил
-- сотрудника — его «Мастер роли» тоже обнуляется: в списке мастеров не виден, пока он не станет
-- мастером заново (запись мастера старше сброса не считается)
create table if not exists player_resets (
  restaurant text,
  employee   text not null,          -- «Имя Фамилия», как в quiz_events
  reset_at   timestamptz not null default now(),
  primary key (employee, restaurant)
);
alter table player_resets enable row level security;
revoke all on player_resets from anon, authenticated;

-- Настройки (этап 22б создаёт ту же таблицу; без него — создаём здесь: приз хранится в ней)
create table if not exists sa_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);
alter table sa_settings enable row level security;
revoke all on table sa_settings from anon, authenticated;

-- Новый вид сообщений в «Что ещё присылать»: мастера заведения
alter table sa_notify_prefs add column if not exists master boolean not null default true;

-- ── 1) Служебное ───────────────────────────────────────────────────────────────
-- название роли по-русски (как в приложении, data/roles.js); чужая роль — null
create or replace function _sa_role_title(p_role text)
returns text language sql immutable as $$
  select case p_role
    when 'seasonal' then 'Новичок'
    when 'core' then 'Ядро'
    when 'manager' then 'Менеджер'
    when 'service_manager' then 'Сервис-менеджер'
    when 'spg' then 'Хостес'
    when 'bar' then 'Бар'
  end
$$;

-- ── 2) Стал мастером роли ──────────────────────────────────────────────────────
-- Телефон сам считает, пройдена ли роль, и сообщает один раз. Повтор ничего не меняет и
-- никому не пишет. Коллегам заведения — сообщение в Telegram (у кого подключён бот, включены
-- напоминания и не выключен вид «master»), каждому не больше одного такого в день.
create or replace function mastery_claim(p_token text, p_role text, p_have int, p_need int)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; r text; title text; n int; rest text; ld date; nm text; txt text; e record; chat bigint; sent int := 0;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  r := lower(btrim(coalesce(p_role, '')));
  title := _sa_role_title(r);
  if title is null then return jsonb_build_object('ok', false, 'error', 'role'); end if;
  if p_have is null or p_need is null or p_need <= 0 then return jsonb_build_object('ok', false, 'error', 'bad'); end if;
  if p_have < p_need then return jsonb_build_object('ok', false, 'error', 'not_yet'); end if;
  rest := case when coalesce(btrim(c->>'restaurant'), '') <> '' then c->>'restaurant' end;   -- без заведения писать некому
  -- запись одна на человека и роль; после сброса прогресса (player_resets новее записи) — заново,
  -- с новой датой и сообщением команде
  insert into sa_masters (emp_id, role, restaurant, have, need)
  values (c->>'id', r, c->>'restaurant', p_have, p_need)
  on conflict (emp_id, role) do update set at = now(), restaurant = excluded.restaurant, have = excluded.have, need = excluded.need
    where exists (select 1 from player_resets pr
                   where pr.employee = btrim(coalesce(c->>'name', '') || ' ' || coalesce(c->>'surname', ''))
                     and (pr.restaurant is null or pr.restaurant = c->>'restaurant')
                     and pr.reset_at > sa_masters.at);
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', true, 'new', false, 'sent', 0); end if;
  if rest is not null and _sa_tg_ready() then
    ld := (now() at time zone _sa_tz(rest))::date;
    nm := nullif(btrim(coalesce(c->>'name', '')), '');
    txt := '✦ SERVICE ACADEMY' || E'\n\n' || coalesce(nm, 'Коллега') ||
           case when nm is null then ' стал(а)' when _sa_fem(nm) then ' стала' else ' стал' end ||
           ' мастером роли «' || title || '» ✦' ||
           E'\n\nЗагляни в «Путь мастера» — сколько осталось тебе?';
    for e in select em.id::text as id from employees em
              where em.restaurant = rest and coalesce(em.status, 'active') = 'active' and em.id::text <> c->>'id'
              order by em.name, em.surname, em.id loop
      chat := _sa_tg_chat(e.id, 'master');
      if chat is null then continue; end if;
      if not _sa_tg_once(e.id, ld, 'master') then continue; end if;   -- сегодня уже писали о мастере
      perform sa_tg_send(chat, txt, 'Путь мастера ✦', 'mastery');
      sent := sent + 1;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'new', true, 'sent', sent);
end; $$;

-- ── 3) Мастера заведения и приз ────────────────────────────────────────────────
create or replace function mastery_list(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; rows jsonb; prize text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := case when coalesce(btrim(c->>'restaurant'), '') <> '' then c->>'restaurant' end;
  select coalesce(jsonb_agg(jsonb_build_object('who', t.who, 'name', t.name, 'role', t.role, 'at', t.at, 'me', t.me)
           order by t.at desc, t.who, t.role), '[]'::jsonb)
    into rows
    from (select btrim(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) as who, em.name, m.role, m.at,
                 m.emp_id = c->>'id' as me
            from sa_masters m join employees em on em.id::text = m.emp_id
           where rest is not null and em.restaurant = rest and coalesce(em.status, 'active') = 'active'
             -- сброшенный руководителем после того, как стал мастером, — не мастер (пока не станет снова)
             and not exists (select 1 from player_resets pr
                              where pr.employee = btrim(coalesce(em.name, '') || ' ' || coalesce(em.surname, ''))
                                and (pr.restaurant is null or pr.restaurant = em.restaurant)
                                and pr.reset_at > m.at)
           order by m.at desc
           limit 300) t;
  if rest is not null then
    select s.value into prize from sa_settings s where s.key = 'master_prize:' || rest;
  end if;
  return jsonb_build_object('ok', true, 'rows', rows, 'prize', nullif(btrim(coalesce(prize, '')), ''),
    'can_prize', rest is not null and _sa_report_rank(c) >= 1);
end; $$;

-- Приз своего заведения: менеджер, старший или владелец (та же лестница, что в отчётах).
-- Текст — без лишних пробелов и переводов строки, до 200 знаков; пустой — приза нет.
create or replace function mastery_prize_set(p_token text, p_text text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; t text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if _sa_report_rank(c) < 1 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := case when coalesce(btrim(c->>'restaurant'), '') <> '' then c->>'restaurant' end;
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  t := btrim(left(btrim(regexp_replace(coalesce(p_text, ''), '[[:space:][:cntrl:]]+', ' ', 'g')), 200));
  if t = '' then
    delete from sa_settings where key = 'master_prize:' || rest;
    return jsonb_build_object('ok', true, 'prize', null);
  end if;
  insert into sa_settings (key, value, updated_at) values ('master_prize:' || rest, t, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true, 'prize', t);
end; $$;

-- ── 4) Что присылать в Telegram: то же, что в этапе 25, плюс «master» ──────────
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
    'fresh', coalesce(p.fresh, true), 'month', coalesce(p.month, true), 'master', coalesce(p.master, true));
end; $$;

create or replace function notify_set(p_token text, p_kind text, p_on boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_kind is null or p_kind not in ('pair', 'quest', 'league', 'fresh', 'month', 'master') then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  insert into sa_notify_prefs (emp_id) values (c->>'id') on conflict do nothing;
  execute format('update sa_notify_prefs set %I = $1, updated_at = now() where emp_id = $2', p_kind) using coalesce(p_on, false), c->>'id';
  return notify_prefs(p_token);
end; $$;

-- ── 5) «Шаг дня» в напоминании за час до смены (этап 22б) ─────────────────────
-- Та же функция, что в этапе 22б (окно, «одно напоминание на смену», просмотр — без изменений),
-- плюс строка «Шаг дня: …», если в копии с телефона есть шаг на сегодняшнюю дату заведения.
-- Только если этап 22б уже выполнен (иначе напоминаний нет — нечего дополнять).
do $do$
begin
  if to_regprocedure('public._sa_warmup_due(boolean)') is null or to_regclass('public.tg_links') is null then
    raise notice 'Этап 22б (напоминания в Telegram) ещё не выполнен — «Шаг дня» появится, если запустить этот файл после него';
    return;
  end if;
  execute $fn$
create or replace function _sa_warmup_due(p_send boolean)
returns jsonb language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare tzdef text; mins int; v record; tz text; lnow timestamp; ld date; mkey text; dnum int;
  pl jsonb; days jsonb; shifts jsonb; st jsonb; k text; sh jsonb; start_ts timestamp; target tg_links;
  stoks text[]; note text; txt text; out jsonb := '[]'::jsonb; nmatch int;
  stp jsonb; stxt text;
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
      -- «Шаг дня» из «Пути мастера» (этап 26): телефон кладёт его в копию — mastery.step = {day, t}.
      -- Только на сегодня по часам заведения, одной строкой, не длиннее 140 знаков.
      select el.data->'mastery'->'step' into stp from emp_learning el where el.emp_id = target.emp_id;
      if jsonb_typeof(stp) = 'object' and stp->>'day' = to_char(ld, 'YYYY-MM-DD') and jsonb_typeof(stp->'t') = 'string' then
        stxt := btrim(regexp_replace(stp->>'t', '[[:space:][:cntrl:]]+', ' ', 'g'));
        if length(stxt) > 140 then stxt := rtrim(left(stxt, 139)) || '…'; end if;
        if stxt <> '' then txt := txt || E'\n\nШаг дня: ' || stxt; end if;
      end if;
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
end; $$
$fn$;
  execute 'revoke all on function _sa_warmup_due(boolean) from public, anon, authenticated';
end $do$;

-- ── 6) Права ─────────────────────────────────────────────────────────────────
revoke all on function _sa_role_title(text) from public, anon, authenticated;
grant execute on function mastery_claim(text, text, int, int) to anon, authenticated;
grant execute on function mastery_list(text) to anon, authenticated;
grant execute on function mastery_prize_set(text, text) to anon, authenticated;
grant execute on function notify_prefs(text) to anon, authenticated;
grant execute on function notify_set(text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 7) Проверка: ожидаем «путь мастера: функции 3 из 3, таблица мастеров: есть, вид «master»: есть · …» ──
select 'путь мастера: функции ' || (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname in ('mastery_claim', 'mastery_list', 'mastery_prize_set'))
       || ' из 3, таблица мастеров: ' || case when to_regclass('public.sa_masters') is not null then 'есть' else 'нет' end
       || ', вид «master»: ' || case when exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'sa_notify_prefs' and column_name = 'master') then 'есть' else 'нет' end
       || case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.proname = '_sa_warmup_due' and p.prosrc like '%Шаг дня%')
               then ' · «Шаг дня» в напоминании: есть'
               else ' · «Шаг дня» в напоминании: нет (нужен этап 22б — потом запусти этот файл ещё раз)' end
       || case when _sa_tg_ready() then ' · Telegram: есть' else ' · Telegram: нет (мастеров видно в приложении, сообщений не будет)' end as result;
