-- ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 65 (v202, Доп. 527): живая проверка встраивается в смену.
--
-- Владелец (27.11) на предложения, как ещё упростить живую проверку: «Давай все, кроме 10-го и 2-го».
--   • Брифинг: на пятиминутке руководитель задаёт двоим-троим со смены по одному вопросу и отмечает пункты прямо
--     в показе. Такой ответ — kind = 'brief', модуль 'brief': итог модуля он не меняет. Человеку бот пишет, только если
--     назвал не всё, и что повторить.
--   • Просьбы: сотрудник сам зовёт на проверку («Готов к живой проверке», после незачёта «Готов к пересдаче») —
--     sa_live_check_requests. Руководитель видит просьбы первыми. Проверка модуля закрывает просьбу сама.
--   • Меню заведения: вопросы о блюдах собирает телефон из карточек меню, модуль 'menu', ключ вопроса «menu#блюдо».
--     Ключи вопросов теперь «модуль#номер» или «модуль#имя» (до 40 знаков: буквы, цифры, «-», «_»).
--   • Свои вопросы: руководство сети правит формулировки и пункты, добавляет вопросы, прячет лишние —
--     sa_live_check_questions (n — номер вопроса из приложения или «c<номер>» у своего). Проверяющий отмечает неудачный
--     вопрос — sa_live_check_flags; правка вопроса снимает отметки с него.
--   • План: норма «каждого раз в N дней» (sa_live_check_plan) и в сводке «проверено столько-то из стольких»; у каждого
--     проверяющего средний процент рядом со средним по сети.
--   • Итог недели: руководству сети по понедельникам (с 10 до 12 по времени заведения, раз в неделю) — проверки по
--     заведениям, процент зачёта, слабый модуль, просьбы, кто из менеджеров никого не проверил. Расписание то же,
--     «sa-live-check» (sa_lc_tick).
--   • live_check_requests(p_token, p_restaurant) — мои просьбы и просьбы тех, кого я проверяю, и норма плана;
--     live_check_request(p_token, p_track, p_module, p_title, p_cancel) — попросить проверку или отменить просьбу;
--     live_check_flag(p_token, p_track, p_module, p_key, p_note) — отметить неудачный вопрос;
--     live_check_questions(p_token) — правки вопросов (всем) и отметки (тем, кто правит);
--     live_check_question_save(p_token, p_track, p_module, p_n, p_q, p_a, p_lesson, p_hidden) — править вопрос;
--     live_check_flag_done(p_token, p_key) — оставить вопрос как есть; live_check_plan_set(p_token, p_days) — норма.
-- Нужен этап 64. Ничего не удаляет. Если после этого этапа снова запускали этап 63 или 64, запусти этот ещё раз.
-- Supabase → SQL Editor → New query → вставить → Run.
-- ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.sa_live_checks') is null or to_regprocedure('public.live_check_summary(text,text,integer)') is null then
    raise exception 'Сначала этап 64 (supabase-stage64-live-check-plus.sql): нужна живая проверка по пунктам';
  end if;
end $$;

-- ── 1) Таблицы ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_live_check_requests (
  id          bigserial primary key,
  emp_id      text not null,
  emp_name    text,
  restaurant  text,
  track       text not null,
  module_id   text not null,
  title       text,
  kind        text not null default 'check',   -- check | retake
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,
  closed_by   text,
  check_id    bigint
);
create unique index if not exists sa_lc_req_open on sa_live_check_requests (emp_id, module_id) where closed_at is null;
create index if not exists sa_lc_req_rest on sa_live_check_requests (restaurant, created_at desc) where closed_at is null;
alter table sa_live_check_requests enable row level security;
revoke all on table sa_live_check_requests from public, anon, authenticated;
revoke all on sequence sa_live_check_requests_id_seq from public, anon, authenticated;

create table if not exists sa_live_check_questions (
  module_id        text not null,
  n                text not null,              -- номер вопроса из приложения («3») или свой («c12»)
  track            text not null,
  q                text,                       -- null — только спрятан
  a                jsonb,                      -- пункты «что должно прозвучать»
  lesson           text,
  hidden           boolean not null default false,
  updated_by       text,
  updated_by_name  text,
  updated_at       timestamptz not null default now(),
  primary key (module_id, n)
);
create sequence if not exists sa_live_check_questions_c;
alter table sa_live_check_questions enable row level security;
revoke all on table sa_live_check_questions from public, anon, authenticated;
revoke all on sequence sa_live_check_questions_c from public, anon, authenticated;

create table if not exists sa_live_check_flags (
  id           bigserial primary key,
  qkey         text not null,                  -- «модуль#номер»
  track        text,
  module_id    text,
  note         text,
  by_id        text not null,
  by_name      text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  text
);
create unique index if not exists sa_lc_flags_open on sa_live_check_flags (qkey, by_id) where resolved_at is null;
alter table sa_live_check_flags enable row level security;
revoke all on table sa_live_check_flags from public, anon, authenticated;
revoke all on sequence sa_live_check_flags_id_seq from public, anon, authenticated;

create table if not exists sa_live_check_plan (
  id          int primary key default 1 check (id = 1),
  days        int not null default 30,
  updated_by  text,
  updated_at  timestamptz not null default now()
);
insert into sa_live_check_plan (id, days, updated_by) values (1, 30, 'этап 65') on conflict (id) do nothing;
alter table sa_live_check_plan enable row level security;
revoke all on table sa_live_check_plan from public, anon, authenticated;

create table if not exists sa_live_check_digest (
  emp_id   text not null,
  week     text not null,                      -- «2026-48»
  sent_at  timestamptz not null default now(),
  primary key (emp_id, week)
);
alter table sa_live_check_digest enable row level security;
revoke all on table sa_live_check_digest from public, anon, authenticated;

-- ── 2) Служебное ───────────────────────────────────────────────────────────────────────────────────────────────
create or replace function _sa_lc_qkey_ok(p_key text)
returns boolean language sql immutable as $$
  select coalesce(p_key, '') ~ '^[a-z0-9_-]{1,40}#[a-z0-9_-]{1,40}$'
$$;

-- «1 проверка», «2 проверки», «5 проверок»
create or replace function _sa_lc_pl(p_n int, p_a text, p_b text, p_c text)
returns text language sql immutable as $$
  select case when p_n % 10 = 1 and p_n % 100 <> 11 then p_a
              when p_n % 10 between 2 and 4 and (p_n % 100 < 12 or p_n % 100 > 14) then p_b else p_c end
$$;

create or replace function _sa_lc_plan_days()
returns int language sql stable security definer set search_path to public as $$
  select coalesce((select days from sa_live_check_plan where id = 1), 30)
$$;

revoke all on function _sa_lc_qkey_ok(text) from public, anon, authenticated;
revoke all on function _sa_lc_pl(int, text, text, text) from public, anon, authenticated;
revoke all on function _sa_lc_plan_days() from public, anon, authenticated;

-- ── 3) Сохранить: ещё ответы на брифинге, вопросы о блюдах и свои, просьба закрывается ─────────────────────────────────
create or replace function live_check_save(p_token text, p_emp text, p_track text, p_module text, p_marks jsonb default null,
  p_note text default null, p_items jsonb default null, p_kind text default null, p_cid text default null,
  p_title text default null, p_repeat jsonb default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); t record; v_kind text := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), 'module');
  v_g int; v_o int; n int; s int; v_score int; v_marks jsonb; v_id bigint; v_at timestamptz; v_title text; v_rep jsonb;
  v_chat bigint; v_txt text; v_sent boolean := false; v_name text; v_dup record; v_list text;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select em.id::text as id, coalesce(em.name, '') as name, coalesce(em.surname, '') as surname,
         btrim(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) as who, coalesce(em.restaurant, '') as restaurant,
         lower(coalesce(em.position, '')) as position, coalesce(em.status, 'active') = 'active' as active,
         _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) as lvl
    into t from employees em where em.id::text = btrim(coalesce(p_emp, ''));
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not _sa_lc_can((me->>'level')::int, me->>'family', me->>'restaurant', (me->>'net')::boolean, me->>'id',
                    t.lvl, _sa_lc_family(t.position), t.restaurant, t.id, t.active) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  -- проверка, отправленная с телефона ещё раз (не было сети), — та же самая
  if p_cid is not null then
    if p_cid !~ '^[A-Za-z0-9_-]{6,40}$' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    select id, score, passed, created_at into v_dup from sa_live_checks where checker_id = me->>'id' and cid = p_cid;
    if found then return jsonb_build_object('ok', true, 'id', v_dup.id, 'score', v_dup.score, 'passed', v_dup.passed, 'at', v_dup.created_at, 'dup', true); end if;
  end if;
  if coalesce(p_track, '') not in ('seasonal', 'core', 'spg', 'bar', 'manager', 'service_manager')
     or coalesce(p_module, '') !~ '^[a-z0-9_-]{1,40}$' or v_kind not in ('module', 'blitz', 'brief')
     or (case when v_kind = 'module' then p_module in ('blitz', 'brief') else p_module <> v_kind end)
     or length(coalesce(p_note, '')) > 500 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if p_items is not null then
    -- по пунктам: k — «модуль#номер» или «модуль#имя», g — названо, o — всего пунктов (1–6); у проверки модуля — его вопросы
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 8
       or exists (select 1 from jsonb_array_elements(p_items) x
                   where jsonb_typeof(x) <> 'object' or not _sa_lc_qkey_ok(x->>'k')
                      or coalesce(x->>'g', '') !~ '^[0-9]$' or coalesce(x->>'o', '') !~ '^[1-6]$' or (x->>'g')::int > (x->>'o')::int
                      or (v_kind = 'module' and split_part(x->>'k', '#', 1) <> p_module))
       or (select count(distinct x->>'k') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then
      return jsonb_build_object('ok', false, 'error', 'bad_request');
    end if;
    select sum((x->>'g')::int), sum((x->>'o')::int) into v_g, v_o from jsonb_array_elements(p_items) x;
    v_score := round(v_g * 100.0 / v_o);
    select jsonb_agg(case when (x->>'g')::int = (x->>'o')::int then 2 when (x->>'g')::int > 0 then 1 else 0 end order by i)
      into v_marks from jsonb_array_elements(p_items) with ordinality as e(x, i);
  else
    -- как до v201: отметки 0/1/2 по вопросам
    if v_kind = 'brief' or p_marks is null or jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) not between 1 and 8
       or exists (select 1 from jsonb_array_elements(p_marks) x where x::text !~ '^[012]$') then
      return jsonb_build_object('ok', false, 'error', 'bad_request');
    end if;
    n := jsonb_array_length(p_marks);
    select sum((x::text)::int) into s from jsonb_array_elements(p_marks) x;
    v_score := round(s * 100.0 / (2 * n));
    v_marks := p_marks;
  end if;
  v_title := nullif(left(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), 80), '');
  if p_repeat is not null then
    if jsonb_typeof(p_repeat) <> 'array' or jsonb_array_length(p_repeat) > 6
       or exists (select 1 from jsonb_array_elements(p_repeat) x
                   where jsonb_typeof(x) <> 'object' or coalesce(x->>'l', '') !~ '^[a-z0-9_-]{1,40}$' or length(coalesce(x->>'t', '')) > 90) then
      return jsonb_build_object('ok', false, 'error', 'bad_request');
    end if;
    select jsonb_agg(jsonb_build_object('l', x->>'l', 't', btrim(coalesce(x->>'t', ''))) order by i) into v_rep
      from jsonb_array_elements(p_repeat) with ordinality as e(x, i);
  end if;
  insert into sa_live_checks (emp_id, emp_name, restaurant, track, module_id, marks, score, passed, note, checker_id, checker_name, checker_level,
                              kind, items, cid, title, repeat)
    values (t.id, t.who, t.restaurant, p_track, p_module, v_marks, v_score, v_score >= 75, nullif(btrim(coalesce(p_note, '')), ''),
            me->>'id', me->>'who', (me->>'level')::int, v_kind, p_items, p_cid, v_title, v_rep)
    on conflict (checker_id, cid) where cid is not null do nothing
    returning id, created_at into v_id, v_at;
  if v_id is null then   -- та же проверка пришла одновременно дважды
    select id, score, passed, created_at into v_dup from sa_live_checks where checker_id = me->>'id' and cid = p_cid;
    return jsonb_build_object('ok', true, 'id', v_dup.id, 'score', v_dup.score, 'passed', v_dup.passed, 'at', v_dup.created_at, 'dup', true);
  end if;
  -- проверка модуля закрывает просьбу человека об этом модуле
  if v_kind = 'module' then
    update sa_live_check_requests set closed_at = now(), closed_by = me->>'id', check_id = v_id
     where emp_id = t.id and module_id = p_module and closed_at is null;
  end if;
  -- итог человеку: бот и телефон (этап 48). Ответ на брифинге — только если назвал не всё. Ошибка отправки не мешает
  begin
    if to_regprocedure('public._sa_tg_ready()') is not null and to_regprocedure('public._sa_tg_chat(text,text)') is not null
       and to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is not null and not (v_kind = 'brief' and v_score >= 100) then
      if _sa_tg_ready() then
        v_chat := _sa_tg_chat(t.id, null);
        if v_chat is not null then
          select _sa_lc_short(em.name, em.surname) into v_name from employees em where em.id::text = me->>'id';
          select string_agg('«' || (x->>'t') || '»', ', ' order by i) into v_list
            from jsonb_array_elements(coalesce(v_rep, '[]'::jsonb)) with ordinality as e(x, i) where coalesce(x->>'t', '') <> '';
          if v_kind = 'brief' then
            v_txt := 'Вопрос на брифинге: названо ' || coalesce(v_g, 0) || ' из ' || coalesce(v_o, 0) || ' ' || _sa_lc_pl(coalesce(v_o, 0), 'пункта', 'пунктов', 'пунктов') || '.';
          else
            v_txt := 'Живая проверка' || case when v_kind = 'blitz' then ', блиц' else ' «' || coalesce(v_title, p_module) || '»' end ||
              ': ' || v_score || '%, ' || case when v_score >= 75 then 'зачтено.' else 'не зачтено.' end;
          end if;
          v_txt := v_txt || coalesce(E'\n' || case when p_module = 'menu' then 'Повторить блюда: ' else 'Повторить: ' end || v_list || '.', '') ||
            E'\n' || 'Проверка: ' || regexp_replace(coalesce(nullif(v_name, ''), 'руководитель'), '\.$', '') || '.';
          if p_module <> 'menu' and v_rep is not null and jsonb_array_length(v_rep) > 0 then
            perform sa_tg_send(v_chat, v_txt, 'Открыть урок', 'lesson_' || (v_rep->0->>'l'));
          else
            perform sa_tg_send(v_chat, v_txt, 'Мои проверки', 'lc_me');
          end if;
          v_sent := true;
        end if;
      end if;
    end if;
  exception when others then v_sent := false; end;
  return jsonb_build_object('ok', true, 'id', v_id, 'score', v_score, 'passed', v_score >= 75, 'at', v_at, 'sent', v_sent);
end $$;

-- ── 4) Просьбы о проверке ──────────────────────────────────────────────────────────────────────────────────────
create or replace function live_check_request(p_token text, p_track text, p_module text, p_title text default null, p_cancel boolean default false)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_kind text := 'check'; v_last record; v_id bigint; v_old bigint; v_rest text; v_who text;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if coalesce(p_track, '') not in ('seasonal', 'core', 'spg', 'bar', 'manager', 'service_manager')
     or coalesce(p_module, '') !~ '^[a-z0-9_-]{1,40}$' or p_module in ('blitz', 'brief') or length(coalesce(p_title, '')) > 120 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if coalesce(p_cancel, false) then
    update sa_live_check_requests set closed_at = now(), closed_by = me->>'id'
     where emp_id = me->>'id' and module_id = p_module and closed_at is null;
    get diagnostics v_id = row_count;
    return jsonb_build_object('ok', true, 'cancelled', v_id > 0);
  end if;
  if (select count(*) from sa_live_check_requests where emp_id = me->>'id' and closed_at is null and module_id <> p_module) >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;
  select passed into v_last from sa_live_checks where emp_id = me->>'id' and module_id = p_module and kind = 'module' order by created_at desc limit 1;
  if found and not v_last.passed then v_kind := 'retake'; end if;
  select id into v_old from sa_live_check_requests where emp_id = me->>'id' and module_id = p_module and closed_at is null;
  if v_old is not null then
    update sa_live_check_requests set kind = v_kind, title = coalesce(nullif(btrim(coalesce(p_title, '')), ''), title) where id = v_old;
    return jsonb_build_object('ok', true, 'id', v_old, 'kind', v_kind, 'again', true);
  end if;
  select btrim(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')), coalesce(em.restaurant, '') into v_who, v_rest
    from employees em where em.id::text = me->>'id';
  insert into sa_live_check_requests (emp_id, emp_name, restaurant, track, module_id, title, kind)
    values (me->>'id', v_who, v_rest, p_track, p_module, nullif(left(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), 80), ''), v_kind)
    on conflict (emp_id, module_id) where closed_at is null do nothing
    returning id into v_id;
  if v_id is null then select id into v_id from sa_live_check_requests where emp_id = me->>'id' and module_id = p_module and closed_at is null; end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'kind', v_kind, 'again', false);
end $$;

-- мои просьбы; руководителю — ещё просьбы тех, кого он проверяет (у сети — в выбранном заведении); норма плана
create or replace function live_check_requests(p_token text, p_restaurant text default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_rest text; v_mine jsonb; v_people jsonb := '[]'::jsonb;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 't', r.track, 'm', r.module_id, 'ti', r.title, 'k', r.kind, 'at', r.created_at)
           order by r.created_at), '[]'::jsonb)
    into v_mine from sa_live_check_requests r where r.emp_id = me->>'id' and r.closed_at is null;
  if (me->>'level')::int >= 20 then
    v_rest := case when (me->>'net')::boolean and nullif(btrim(coalesce(p_restaurant, '')), '') is not null
                   then regexp_replace(btrim(p_restaurant), '\s+', ' ', 'g') else me->>'restaurant' end;
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'emp', r.emp_id, 'name', coalesce(em.name, ''), 'surname', coalesce(em.surname, ''),
             't', r.track, 'm', r.module_id, 'ti', r.title, 'k', r.kind, 'at', r.created_at) order by r.created_at), '[]'::jsonb)
      into v_people
      from sa_live_check_requests r join employees em on em.id::text = r.emp_id
     where r.closed_at is null and coalesce(em.restaurant, '') = v_rest
       and _sa_lc_can((me->>'level')::int, me->>'family', me->>'restaurant', (me->>'net')::boolean, me->>'id',
                      _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title), _sa_lc_family(lower(coalesce(em.position, ''))),
                      coalesce(em.restaurant, ''), em.id::text, coalesce(em.status, 'active') = 'active');
  end if;
  return jsonb_build_object('ok', true, 'plan_days', _sa_lc_plan_days(), 'level', (me->>'level')::int, 'mine', v_mine, 'people', v_people);
end $$;

-- ── 5) Неудачный вопрос: отметка проверяющего ─────────────────────────────────────────────────────────────────────
create or replace function live_check_flag(p_token text, p_track text, p_module text, p_key text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_note text := nullif(left(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), 300), '');
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (me->>'level')::int < 20 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if coalesce(p_track, '') not in ('seasonal', 'core', 'spg', 'bar', 'manager', 'service_manager') or not _sa_lc_qkey_ok(p_key)
     or split_part(p_key, '#', 1) <> coalesce(p_module, '') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  insert into sa_live_check_flags (qkey, track, module_id, note, by_id, by_name) values (p_key, p_track, p_module, v_note, me->>'id', me->>'who')
    on conflict (qkey, by_id) where resolved_at is null do update set note = coalesce(excluded.note, sa_live_check_flags.note), created_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- ── 6) Свои вопросы: правки читают все, правит руководство сети ─────────────────────────────────────────────────
create or replace function live_check_questions(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_edit boolean; v_rows jsonb; v_flags jsonb := '[]'::jsonb;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_edit := (me->>'level')::int >= 50;
  select coalesce(jsonb_agg(jsonb_build_object('t', x.track, 'm', x.module_id, 'n', x.n, 'q', x.q, 'a', x.a, 'l', x.lesson, 'h', x.hidden,
           'at', x.updated_at, 'by', x.updated_by_name) order by x.module_id, x.n), '[]'::jsonb)
    into v_rows from sa_live_check_questions x;
  if v_edit then
    select coalesce(jsonb_agg(jsonb_build_object('k', f.qkey, 't', f.track, 'm', f.module_id, 'n', f.n, 'at', f.at, 'notes', f.notes)
             order by f.n desc, f.at desc), '[]'::jsonb)
      into v_flags
      from (select qkey, max(track) as track, max(module_id) as module_id, count(*) as n, max(created_at) as at,
                   jsonb_agg(jsonb_build_object('note', note, 'by', by_name, 'at', created_at) order by created_at desc) as notes
              from sa_live_check_flags where resolved_at is null group by qkey) f;
  end if;
  return jsonb_build_object('ok', true, 'can_edit', v_edit, 'rows', v_rows, 'flags', v_flags);
end $$;

create or replace function live_check_question_save(p_token text, p_track text, p_module text, p_n text default null, p_q text default null,
  p_a jsonb default null, p_lesson text default null, p_hidden boolean default false)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_n text := nullif(btrim(coalesce(p_n, '')), ''); v_q text; v_a jsonb; v_at timestamptz; v_res int;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (me->>'level')::int < 50 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if coalesce(p_track, '') not in ('seasonal', 'core', 'spg', 'bar', 'manager', 'service_manager')
     or coalesce(p_module, '') !~ '^[a-z0-9_-]{1,40}$' or p_module in ('blitz', 'brief', 'menu')
     or (v_n is not null and v_n !~ '^([0-9]{1,3}|c[0-9]{1,9})$')
     or (p_lesson is not null and p_lesson !~ '^[A-Za-z0-9_.:-]{1,60}$') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  v_q := nullif(btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')), '');
  if p_a is not null then
    if jsonb_typeof(p_a) <> 'array' or jsonb_array_length(p_a) not between 1 and 6
       or exists (select 1 from jsonb_array_elements(p_a) x where jsonb_typeof(x) <> 'string' or length(btrim(x #>> '{}')) not between 1 and 200) then
      return jsonb_build_object('ok', false, 'error', 'bad_request');
    end if;
    select jsonb_agg(btrim(regexp_replace(x #>> '{}', '\s+', ' ', 'g')) order by i) into v_a from jsonb_array_elements(p_a) with ordinality as e(x, i);
  end if;
  -- спрятать можно и без текста; новый или правленый вопрос — с текстом от 8 до 300 знаков и пунктами
  if not coalesce(p_hidden, false) and (v_q is null or length(v_q) not between 8 and 300 or v_a is null) then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if v_q is not null and length(v_q) > 300 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if v_n is null then
    if coalesce(p_hidden, false) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    v_n := 'c' || nextval('sa_live_check_questions_c');
  elsif v_n like 'c%' and not exists (select 1 from sa_live_check_questions where module_id = p_module and n = v_n) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  insert into sa_live_check_questions (module_id, n, track, q, a, lesson, hidden, updated_by, updated_by_name, updated_at)
    values (p_module, v_n, p_track, v_q, v_a, p_lesson, coalesce(p_hidden, false), me->>'id', me->>'who', now())
    on conflict (module_id, n) do update set track = excluded.track, q = coalesce(excluded.q, sa_live_check_questions.q),
      a = coalesce(excluded.a, sa_live_check_questions.a), lesson = coalesce(excluded.lesson, sa_live_check_questions.lesson),
      hidden = excluded.hidden, updated_by = excluded.updated_by, updated_by_name = excluded.updated_by_name, updated_at = now()
    returning updated_at into v_at;
  update sa_live_check_flags set resolved_at = now(), resolved_by = me->>'id' where qkey = p_module || '#' || v_n and resolved_at is null;
  get diagnostics v_res = row_count;
  return jsonb_build_object('ok', true, 'n', v_n, 'at', v_at, 'resolved', v_res);
end $$;

create or replace function live_check_flag_done(p_token text, p_key text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_res int;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (me->>'level')::int < 50 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if not _sa_lc_qkey_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  update sa_live_check_flags set resolved_at = now(), resolved_by = me->>'id' where qkey = p_key and resolved_at is null;
  get diagnostics v_res = row_count;
  return jsonb_build_object('ok', true, 'resolved', v_res);
end $$;

-- ── 7) План: норма «каждого раз в N дней» ────────────────────────────────────────────────────────────────────────
create or replace function live_check_plan_set(p_token text, p_days int)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token);
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (me->>'level')::int < 50 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if coalesce(p_days, 0) not in (14, 30, 60, 90) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  insert into sa_live_check_plan (id, days, updated_by, updated_at) values (1, p_days, me->>'who', now())
    on conflict (id) do update set days = excluded.days, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true, 'days', p_days);
end $$;

-- ── 8) Сводка: ещё брифинг, план, средний у проверяющих и по сети, просьбы, отметки ───────────────────────────────
create or replace function live_check_summary(p_token text, p_restaurant text default null, p_days int default 30)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_net boolean; v_rest text; v_days int := least(greatest(coalesce(p_days, 30), 7), 365);
  v_from timestamptz; v_tot jsonb; v_venues jsonb; v_mods jsonb; v_qs jsonb; v_plan int := _sa_lc_plan_days(); v_pfrom timestamptz;
  v_pv jsonb; v_due int; v_done int; v_netavg int; v_req int; v_flags int := 0;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (me->>'level')::int < 30 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  v_net := (me->>'net')::boolean;
  v_rest := case when not v_net then me->>'restaurant'
                 when nullif(btrim(coalesce(p_restaurant, '')), '') is not null then regexp_replace(btrim(p_restaurant), '\s+', ' ', 'g')
                 else null end;   -- null — вся сеть
  v_from := now() - make_interval(days => v_days);
  v_pfrom := now() - make_interval(days => v_plan);
  select jsonb_build_object('checks', count(*) filter (where k.kind = 'module'), 'blitz', count(*) filter (where k.kind = 'blitz'),
           'brief', count(*) filter (where k.kind = 'brief'),
           'people', count(distinct k.emp_id), 'passed', count(*) filter (where k.kind = 'module' and k.passed),
           'avg', coalesce(round(avg(k.score) filter (where k.kind = 'module'))::int, 0))
    into v_tot from sa_live_checks k where k.created_at >= v_from and (v_rest is null or k.restaurant = v_rest);
  select round(avg(k.score))::int into v_netavg from sa_live_checks k where k.kind = 'module' and k.created_at >= v_from;
  select coalesce(jsonb_agg(jsonb_build_object('name', v.restaurant, 'checks', v.n, 'blitz', v.b, 'brief', v.br, 'people', v.people, 'passed', v.passed,
           'avg', v.avg, 'checkers', v.checkers) order by v.n desc, v.restaurant), '[]'::jsonb)
    into v_venues
    from (select k.restaurant, count(*) filter (where k.kind = 'module') as n, count(*) filter (where k.kind = 'blitz') as b,
                 count(*) filter (where k.kind = 'brief') as br,
                 count(distinct k.emp_id) as people, count(*) filter (where k.kind = 'module' and k.passed) as passed,
                 coalesce(round(avg(k.score) filter (where k.kind = 'module'))::int, 0) as avg,
                 (select coalesce(jsonb_agg(jsonb_build_object('name', c.checker_name, 'n', c.n, 'm', c.m, 'avg', c.avg) order by c.n desc, c.checker_name), '[]'::jsonb)
                    from (select k2.checker_name, count(*) as n, count(*) filter (where k2.kind = 'module') as m,
                                 round(avg(k2.score) filter (where k2.kind = 'module'))::int as avg
                            from sa_live_checks k2
                           where k2.created_at >= v_from and k2.restaurant = k.restaurant group by k2.checker_name) c) as checkers
            from sa_live_checks k where k.created_at >= v_from and (v_rest is null or k.restaurant = v_rest)
           group by k.restaurant) v;
  select coalesce(jsonb_agg(jsonb_build_object('t', m.track, 'm', m.module_id, 'n', m.n, 'avg', m.avg, 'failed', m.failed, 'ti', m.ti)
           order by m.avg, m.n desc, m.module_id), '[]'::jsonb)
    into v_mods
    from (select k.track, k.module_id, count(*) as n, round(avg(k.score))::int as avg, count(*) filter (where not k.passed) as failed,
                 (array_agg(k.title order by k.created_at desc) filter (where k.title is not null))[1] as ti
            from sa_live_checks k where k.kind = 'module' and k.created_at >= v_from and (v_rest is null or k.restaurant = v_rest)
           group by 1, 2 having count(*) >= 2 order by avg(k.score), count(*) desc, k.module_id limit 8) m;
  select coalesce(jsonb_agg(jsonb_build_object('k', q.k, 'n', q.n, 'pct', q.pct) order by q.pct, q.n desc, q.k), '[]'::jsonb)
    into v_qs
    from (select it->>'k' as k, count(*) as n, round(100 * sum((it->>'g')::int)::numeric / nullif(sum((it->>'o')::int), 0))::int as pct
            from sa_live_checks k
            cross join lateral jsonb_array_elements(case when jsonb_typeof(k.items) = 'array' then k.items else '[]'::jsonb end) it
           where k.created_at >= v_from and (v_rest is null or k.restaurant = v_rest)
           group by 1 having count(*) >= 3 order by 3, 2 desc, 1 limit 10) q;
  -- план: кого можно проверить (до управляющего), у кого за N дней была проверка модуля
  select coalesce(jsonb_agg(jsonb_build_object('name', p.r, 'due', p.due, 'done', p.done) order by p.r), '[]'::jsonb),
         coalesce(sum(p.due), 0)::int, coalesce(sum(p.done), 0)::int
    into v_pv, v_due, v_done
    from (select coalesce(em.restaurant, '') as r, count(*) as due,
                 count(*) filter (where exists (select 1 from sa_live_checks k where k.emp_id = em.id::text and k.kind = 'module' and k.created_at >= v_pfrom)) as done
            from employees em
           where coalesce(em.status, 'active') = 'active' and coalesce(em.restaurant, '') <> ''
             and _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) < 50
             and (v_rest is null or em.restaurant = v_rest)
           group by 1) p;
  select count(*) into v_req from sa_live_check_requests r where r.closed_at is null and (v_rest is null or r.restaurant = v_rest);
  if (me->>'level')::int >= 50 then select count(distinct qkey) into v_flags from sa_live_check_flags where resolved_at is null; end if;
  return jsonb_build_object('ok', true, 'days', v_days, 'net', v_net, 'restaurant', v_rest, 'totals', v_tot, 'net_avg', v_netavg,
    'venues', v_venues, 'modules', v_mods, 'questions', v_qs,
    'plan', jsonb_build_object('days', v_plan, 'due', v_due, 'done', v_done, 'venues', v_pv, 'edit', (me->>'level')::int >= 50),
    'requests', v_req, 'flags', v_flags);
end $$;

-- ── 9) Итог недели руководству сети (текст) и расписание: пересдачи и итог недели ─────────────────────────────────
-- p_now — конец недели (неделя — 7 дней до него), p_tz — пояс получателя для дат
create or replace function _sa_lc_week_text(p_now timestamptz, p_tz text)
returns text language plpgsql stable security definer set search_path to public as $$
declare v_from timestamptz := p_now - interval '7 days'; v_txt text; v_lines text; v_tot int; v_weak record; v_req int; v_idle text;
begin
  select count(*) into v_tot from sa_live_checks k where k.kind = 'module' and k.created_at >= v_from and k.created_at < p_now;
  v_txt := 'Живая проверка за неделю (' || to_char(v_from at time zone p_tz, 'DD.MM') || '–' || to_char((p_now - interval '1 day') at time zone p_tz, 'DD.MM') || '):';
  if v_tot = 0 then
    v_txt := v_txt || E'\n' || 'проверок модулей не было.';
  else
    select string_agg('• ' || coalesce(nullif(v.r, ''), 'Без заведения') || ': ' || v.n || ' ' || _sa_lc_pl(v.n::int, 'проверка', 'проверки', 'проверок') ||
             ', зачтено ' || round(100.0 * v.p / v.n)::int || '%, средний ' || v.a || '%', E'\n' order by v.n desc, v.r)
      into v_lines
      from (select k.restaurant as r, count(*) as n, count(*) filter (where k.passed) as p, round(avg(k.score))::int as a
              from sa_live_checks k where k.kind = 'module' and k.created_at >= v_from and k.created_at < p_now group by k.restaurant) v;
    v_txt := v_txt || E'\n' || v_lines;
    select k.module_id, round(avg(k.score))::int as a, (array_agg(k.title order by k.created_at desc) filter (where k.title is not null))[1] as ti
      into v_weak
      from sa_live_checks k where k.kind = 'module' and k.created_at >= v_from and k.created_at < p_now
     group by k.module_id having count(*) >= 2 order by avg(k.score), count(*) desc limit 1;
    if found and v_weak.a < 75 then v_txt := v_txt || E'\n' || 'Слабый модуль: «' || coalesce(v_weak.ti, v_weak.module_id) || '», средний ' || v_weak.a || '%.'; end if;
  end if;
  select count(*) into v_req from sa_live_check_requests where closed_at is null;
  if v_req > 0 then v_txt := v_txt || E'\n' || 'Просят проверку: ' || v_req || '.'; end if;
  select string_agg(x.who, ', ' order by x.who) into v_idle
    from (select _sa_lc_short(em.name, em.surname) || coalesce(' (' || nullif(em.restaurant, '') || ')', '') as who
            from employees em
           where coalesce(em.status, 'active') = 'active' and coalesce(em.restaurant, '') <> ''
             and _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) between 30 and 35
             and not exists (select 1 from sa_live_checks k where k.checker_id = em.id::text and k.created_at >= v_from and k.created_at < p_now)
           order by 1 limit 8) x;
  if v_idle is not null then v_txt := v_txt || E'\n' || 'Никого не проверили: ' || v_idle || '.'; end if;
  return v_txt;
end $$;
revoke all on function _sa_lc_week_text(timestamptz, text) from public, anon, authenticated;

-- пересдача (как этап 64) и итог недели: руководству сети по понедельникам с 10 до 12 по времени заведения, раз в неделю.
-- Живой проверкой ещё не пользовались — итог не шлём
create or replace function sa_lc_tick(p_now timestamptz default now())
returns int language plpgsql security definer set search_path to public as $$
declare c record; v_chat bigint; v_tz text; v_ids bigint[]; v_lines text; n int := 0; v_loc timestamp; v_week text;
begin
  if to_regprocedure('public._sa_tg_ready()') is null or to_regprocedure('public._sa_tg_chat(text,text)') is null
     or to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is null then return 0; end if;
  if not _sa_tg_ready() then return 0; end if;
  for c in
    select l.checker_id, coalesce(max(ch.restaurant), '') as rest
      from (select distinct on (k.emp_id, k.module_id) k.* from sa_live_checks k where k.kind = 'module'
             order by k.emp_id, k.module_id, k.created_at desc) l
      join employees ch on ch.id::text = l.checker_id and coalesce(ch.status, 'active') = 'active'
     where not l.passed and l.reminded_at is null and l.created_at <= p_now - interval '3 days' and l.created_at > p_now - interval '30 days'
     group by l.checker_id
  loop
    v_tz := 'UTC';
    if to_regprocedure('public._sa_tz(text)') is not null then v_tz := coalesce(_sa_tz(c.rest), 'UTC'); end if;
    if extract(hour from p_now at time zone v_tz) < 10 or extract(hour from p_now at time zone v_tz) >= 20 then continue; end if;
    select array_agg(l.id order by l.created_at),
           string_agg('• ' || coalesce(nullif(_sa_lc_short(e.name, e.surname), ''), l.emp_name, '') || ', «' || coalesce(l.title, l.module_id) || '», ' ||
                      l.score || '% (' || to_char(l.created_at at time zone v_tz, 'DD.MM') || ')', E'\n' order by l.created_at)
      into v_ids, v_lines
      from (select distinct on (k.emp_id, k.module_id) k.* from sa_live_checks k where k.kind = 'module'
             order by k.emp_id, k.module_id, k.created_at desc) l
      join employees e on e.id::text = l.emp_id and coalesce(e.status, 'active') = 'active'
     where l.checker_id = c.checker_id and not l.passed and l.reminded_at is null
       and l.created_at <= p_now - interval '3 days' and l.created_at > p_now - interval '30 days';
    if v_ids is null then continue; end if;
    v_chat := _sa_tg_chat(c.checker_id, null);
    if v_chat is not null then
      perform sa_tg_send(v_chat, 'Пора пересдать живую проверку:' || E'\n' || v_lines, 'Живая проверка', 'lc');
      n := n + 1;
    end if;
    update sa_live_checks set reminded_at = p_now where id = any(v_ids);
  end loop;
  -- итог недели
  if exists (select 1 from sa_live_checks) then
    for c in
      select em.id::text as id, coalesce(em.restaurant, '') as rest from employees em
       where coalesce(em.status, 'active') = 'active' and _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) >= 50
    loop
      v_tz := 'UTC';
      if to_regprocedure('public._sa_tz(text)') is not null then v_tz := coalesce(_sa_tz(nullif(c.rest, '')), 'UTC'); end if;
      v_loc := p_now at time zone v_tz;
      if extract(isodow from v_loc) <> 1 or extract(hour from v_loc) < 10 or extract(hour from v_loc) >= 12 then continue; end if;
      v_week := to_char(v_loc, 'IYYY-IW');
      if exists (select 1 from sa_live_check_digest d where d.emp_id = c.id and d.week = v_week) then continue; end if;
      v_chat := _sa_tg_chat(c.id, null);
      if v_chat is null then continue; end if;
      perform sa_tg_send(v_chat, _sa_lc_week_text(p_now, v_tz), 'Сводка', 'lc_sum');
      insert into sa_live_check_digest (emp_id, week, sent_at) values (c.id, v_week, p_now) on conflict do nothing;
      n := n + 1;
    end loop;
  end if;
  return n;
end $$;
revoke all on function sa_lc_tick(timestamptz) from public, anon, authenticated;

do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: напоминания о пересдаче и итог недели не придут по расписанию, приложение работает (включи pg_cron и запусти файл ещё раз)';
    return;
  end if;
  begin execute $c$select cron.unschedule('sa-live-check')$c$; exception when others then null; end;
  execute $c$select cron.schedule('sa-live-check', '*/30 * * * *', 'select public.sa_lc_tick()')$c$;
exception when others then
  raise notice 'Расписание «Живая проверка» не создано: %', sqlerrm;
end $$;

-- ── 10) Права ──────────────────────────────────────────────────────────────────────────────────────────────────
grant execute on function live_check_save(text, text, text, text, jsonb, text, jsonb, text, text, text, jsonb) to anon, authenticated;
grant execute on function live_check_summary(text, text, int) to anon, authenticated;
grant execute on function live_check_request(text, text, text, text, boolean) to anon, authenticated;
grant execute on function live_check_requests(text, text) to anon, authenticated;
grant execute on function live_check_flag(text, text, text, text, text) to anon, authenticated;
grant execute on function live_check_questions(text) to anon, authenticated;
grant execute on function live_check_question_save(text, text, text, text, text, jsonb, text, boolean) to anon, authenticated;
grant execute on function live_check_flag_done(text, text) to anon, authenticated;
grant execute on function live_check_plan_set(text, int) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 11) Проверка: ожидаем «живая проверка, этап 65: функций 7 из 7 · план: каждого раз в 30 дней · расписание: … · просьб N · своих вопросов N»
select 'живая проверка, этап 65: функций ' ||
  (select count(*) from unnest(array['live_check_request(text,text,text,text,boolean)', 'live_check_requests(text,text)',
     'live_check_flag(text,text,text,text,text)', 'live_check_questions(text)', 'live_check_question_save(text,text,text,text,text,jsonb,text,boolean)',
     'live_check_flag_done(text,text)', 'live_check_plan_set(text,integer)']) f
    where to_regprocedure('public.' || f) is not null) || ' из 7' ||
  ' · план: каждого раз в ' || _sa_lc_plan_days() || ' дней' ||
  ' · расписание: ' || _sa_lc_cron() ||
  ' · просьб ' || (select count(*) from sa_live_check_requests where closed_at is null) ||
  ' · своих вопросов ' || (select count(*) from sa_live_check_questions) as result;
