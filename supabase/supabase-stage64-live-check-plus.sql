-- ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 64 (v201, Доп. 526): живая проверка точнее и удобнее.
--
-- Владелец (26.11) на десять предложений, как сделать живую проверку удобнее и точнее: «Да, давай сделаем все».
--   • Отметка по пунктам: руководитель отмечает, какие пункты из «что должно прозвучать» человек назвал сам. С телефона
--     приходят items: [{ k: «модуль#номер вопроса», g: названо пунктов, o: всего пунктов }], процент = названо / всего.
--     Отметки 0/1/2 (marks) пишутся как раньше: из них читают экраны версий до v201.
--   • Блиц: kind = 'blitz', модуль 'blitz', три вопроса из разных пройденных модулей. Итог модуля блиц не меняет.
--   • Без сети: cid — номер проверки с телефона. Проверка, отправленная повторно, не задваивается.
--   • Итог сотруднику: бот (и уведомление на телефон, этап 48) пишет человеку процент и уроки, которые стоит повторить,
--     с кнопкой «Открыть урок» (go lesson_<урок>) или «Мои проверки» (go lc_me). Названия модуля и уроков приходят с
--     телефона проверяющего (title, repeat).
--   • Пересдача: модуль не зачтён и за 3 дня его не пересдали — проверявшему один раз приходит напоминание (с 10 до 20
--     по времени заведения), кнопка «Живая проверка» (go lc). Расписание pg_cron «sa-live-check» раз в 30 минут
--     (sa_lc_tick).
--   • live_check_person — ещё лучшие результаты тестов в приложении (tests: { тест: % }) для пометки «тест сдал, вживую
--     нет»; итоги — с пунктами (it), видом (k), названием (ti) и уроками для повтора (rp).
--   • live_check_people — у каждого ещё пройденные тесты (quiz): из них экран собирает «Кого проверить сегодня».
--   • live_check_summary(p_token, p_restaurant, p_days) — сводка за 30 дней: по заведениям (проверок, людей, зачтено,
--     средний процент, кто сколько проверил), модули и вопросы, которые чаще не сдают. Руководство сети — вся сеть или
--     одно заведение, менеджер и управляющий — своё заведение, остальным нельзя.
-- Нужен этап 63. Ничего не удаляет. Если после этого этапа снова запускали этап 63, запусти этот ещё раз.
-- Supabase → SQL Editor → New query → вставить → Run.
-- ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.sa_live_checks') is null or to_regprocedure('public._sa_lc_me(text)') is null then
    raise exception 'Сначала этап 63 (supabase-stage63-live-check.sql): нужна живая проверка';
  end if;
end $$;

-- ── 1) Новые поля итогов ───────────────────────────────────────────────────────────────────────────────────────
alter table sa_live_checks add column if not exists kind text not null default 'module';   -- module | blitz
alter table sa_live_checks add column if not exists items jsonb;                            -- [{ k, g, o }] по вопросам
alter table sa_live_checks add column if not exists cid text;                               -- номер проверки с телефона
alter table sa_live_checks add column if not exists title text;                             -- название модуля для сообщения
alter table sa_live_checks add column if not exists repeat jsonb;                           -- [{ l, t }] уроки для повтора
alter table sa_live_checks add column if not exists reminded_at timestamptz;                -- напомнили о пересдаче
create unique index if not exists sa_live_checks_cid on sa_live_checks (checker_id, cid) where cid is not null;
create index if not exists sa_live_checks_rest on sa_live_checks (restaurant, created_at desc);

-- ── 2) Служебное ───────────────────────────────────────────────────────────────────────────────────────────────
-- лучшие результаты тестов человека в приложении: { "s0-q": 92, … } (строки scores — как в отчёте по сотруднику)
create or replace function _sa_lc_tests(p_id text, p_name text, p_surname text, p_rest text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v_rows jsonb := '[]'::jsonb; res jsonb;
begin
  if to_regprocedure('public._sa_person_rows(text,text,text,text,text,text)') is null then return '{}'::jsonb; end if;
  begin
    v_rows := _sa_person_rows('scores', p_id, p_name, p_surname, btrim(coalesce(p_name, '') || ' ' || coalesce(p_surname, '')), p_rest);
  exception when others then return '{}'::jsonb; end;
  select coalesce(jsonb_object_agg(x.q, x.best), '{}'::jsonb) into res
    from (select r->>'quiz_id' as q, max(round(100 * (r->>'score')::numeric / nullif((r->>'total')::numeric, 0)))::int as best
            from jsonb_array_elements(coalesce(v_rows, '[]'::jsonb)) r
           where coalesce(r->>'quiz_id', '') <> '' and coalesce(r->>'score', '') ~ '^[0-9]+(\.[0-9]+)?$'
             and coalesce(r->>'total', '') ~ '^[0-9]+(\.[0-9]+)?$'
           group by 1) x
   where x.best is not null;
  return coalesce(res, '{}'::jsonb);
end $$;

-- короткое имя для сообщений: «Мария К.»
create or replace function _sa_lc_short(p_name text, p_surname text)
returns text language sql immutable as $$
  select btrim(coalesce(p_name, '') || case when btrim(coalesce(p_surname, '')) <> '' then ' ' || left(btrim(p_surname), 1) || '.' else '' end)
$$;

-- расписание напоминаний: для итоговой строки и экрана «Сервер»
create or replace function _sa_lc_cron()
returns text language plpgsql security definer set search_path to public as $$
declare n int := 0;
begin
  if to_regnamespace('cron') is null then return 'нет pg_cron'; end if;
  execute 'select count(*) from cron.job where jobname = $1' into n using 'sa-live-check';
  return case when n > 0 then 'раз в 30 минут' else 'не создано' end;
exception when others then return 'не создано';
end $$;

revoke all on function _sa_lc_tests(text, text, text, text) from public, anon, authenticated;
revoke all on function _sa_lc_short(text, text) from public, anon, authenticated;
revoke all on function _sa_lc_cron() from public, anon, authenticated;

-- ── 3) Кого я могу проверить: ещё пройденные тесты и вид проверки ────────────────────────────────────────────────
create or replace function live_check_people(p_token text, p_restaurant text default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_rest text; v_rows jsonb; v_quiz jsonb := '{}'::jsonb; v_ids text[];
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (me->>'level')::int < 20 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  v_rest := case when (me->>'net')::boolean and nullif(btrim(coalesce(p_restaurant, '')), '') is not null
                 then regexp_replace(btrim(p_restaurant), '\s+', ' ', 'g') else me->>'restaurant' end;
  select array_agg(em.id::text) into v_ids from employees em where coalesce(em.restaurant, '') = v_rest;
  if to_regclass('public.quiz_done') is not null and v_ids is not null then
    begin
      execute 'select coalesce(jsonb_object_agg(x.u, x.qs), ''{}''::jsonb) from (select user_id::text as u, jsonb_agg(distinct quiz_id::text) as qs
                 from quiz_done where user_id::text = any($1) and quiz_id is not null group by 1) x' into v_quiz using v_ids;
    exception when others then v_quiz := '{}'::jsonb; end;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'surname', t.surname, 'restaurant', t.restaurant,
           'position', t.position, 'title', t.job_title, 'level', t.lvl, 'quiz', coalesce(v_quiz->t.id, '[]'::jsonb),
           'checks', coalesce((select jsonb_agg(jsonb_build_object('m', x.module_id, 't', x.track, 'k', x.kind, 's', x.score, 'p', x.passed,
                                 'at', x.created_at, 'by', x.checker_name) order by x.created_at desc)
                               from (select distinct on (k.module_id) k.* from sa_live_checks k where k.emp_id = t.id
                                      order by k.module_id, k.created_at desc) x), '[]'::jsonb))
           order by t.lvl desc, t.name, t.surname), '[]'::jsonb)
    into v_rows
    from (select em.id::text as id, coalesce(em.name, '') as name, coalesce(em.surname, '') as surname, coalesce(em.restaurant, '') as restaurant,
                 lower(coalesce(em.position, '')) as position, em.job_title, coalesce(em.status, 'active') = 'active' as active,
                 _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) as lvl
            from employees em where coalesce(em.restaurant, '') = v_rest) t
   where _sa_lc_can((me->>'level')::int, me->>'family', me->>'restaurant', (me->>'net')::boolean, me->>'id',
                    t.lvl, _sa_lc_family(t.position), t.restaurant, t.id, t.active);
  return jsonb_build_object('ok', true, 'restaurant', v_rest, 'me', jsonb_build_object('level', (me->>'level')::int, 'title', me->>'title'),
    'people', v_rows);
end $$;

-- ── 4) Человек: ещё лучшие тесты в приложении и подробности итогов ──────────────────────────────────────────────
create or replace function live_check_person(p_token text, p_emp text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); t record; v_can boolean; v_lessons jsonb := '[]'::jsonb; v_quiz jsonb := '[]'::jsonb;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select em.id::text as id, coalesce(em.name, '') as name, coalesce(em.surname, '') as surname, coalesce(em.restaurant, '') as restaurant,
         lower(coalesce(em.position, '')) as position, em.job_title, coalesce(em.status, 'active') = 'active' as active,
         _sa_lc_level(coalesce(em.is_admin, false), em.position, em.job_title) as lvl
    into t from employees em where em.id::text = coalesce(nullif(btrim(coalesce(p_emp, '')), ''), me->>'id');
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_can := _sa_lc_can((me->>'level')::int, me->>'family', me->>'restaurant', (me->>'net')::boolean, me->>'id',
                      t.lvl, _sa_lc_family(t.position), t.restaurant, t.id, t.active);
  if not (t.id = me->>'id' or v_can or (me->>'net')::boolean) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if to_regclass('public.progress') is not null then
    begin
      execute 'select coalesce(jsonb_agg(distinct lesson_id::text), ''[]''::jsonb) from progress where user_id::text = $1 and lesson_id is not null'
        into v_lessons using t.id;
    exception when others then v_lessons := '[]'::jsonb; end;
  end if;
  if to_regclass('public.quiz_done') is not null then
    begin
      execute 'select coalesce(jsonb_agg(distinct quiz_id::text), ''[]''::jsonb) from quiz_done where user_id::text = $1 and quiz_id is not null'
        into v_quiz using t.id;
    exception when others then v_quiz := '[]'::jsonb; end;
  end if;
  return jsonb_build_object('ok', true, 'can', v_can,
    'person', jsonb_build_object('id', t.id, 'name', t.name, 'surname', t.surname, 'restaurant', t.restaurant, 'position', t.position,
      'title', t.job_title, 'level', t.lvl),
    'lessons', coalesce(v_lessons, '[]'::jsonb), 'quiz', coalesce(v_quiz, '[]'::jsonb),
    'tests', _sa_lc_tests(t.id, t.name, t.surname, t.restaurant),
    'checks', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 't', k.track, 'm', k.module_id, 'k', k.kind, 'marks', k.marks,
                         'it', k.items, 's', k.score, 'p', k.passed, 'note', k.note, 'ti', k.title, 'rp', k.repeat, 'by', k.checker_name,
                         'at', k.created_at, 'mine', k.checker_id = me->>'id')
                         order by k.created_at desc)
                       from (select * from sa_live_checks where emp_id = t.id order by created_at desc limit 300) k), '[]'::jsonb));
end $$;

-- ── 5) Сохранить: по пунктам, блиц, без сети, итог человеку ─────────────────────────────────────────────────────
drop function if exists live_check_save(text, text, text, text, jsonb, text);
create or replace function live_check_save(p_token text, p_emp text, p_track text, p_module text, p_marks jsonb default null,
  p_note text default null, p_items jsonb default null, p_kind text default null, p_cid text default null,
  p_title text default null, p_repeat jsonb default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); t record; v_kind text := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), 'module');
  v_g int; v_o int; n int; s int; v_score int; v_marks jsonb; v_id bigint; v_at timestamptz; v_title text; v_rep jsonb;
  v_chat bigint; v_txt text; v_sent boolean := false; v_name text; v_dup record;
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
     or coalesce(p_module, '') !~ '^[a-z0-9_-]{1,40}$' or v_kind not in ('module', 'blitz')
     or (v_kind = 'blitz') <> (p_module = 'blitz') or length(coalesce(p_note, '')) > 500 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if p_items is not null then
    -- по пунктам: k — «модуль#номер», g — названо, o — всего пунктов (1–6); у проверки модуля — вопросы этого модуля
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 8
       or exists (select 1 from jsonb_array_elements(p_items) x
                   where jsonb_typeof(x) <> 'object' or coalesce(x->>'k', '') !~ '^[a-z0-9_-]{1,40}#[0-9]{1,3}$'
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
    if p_marks is null or jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) not between 1 and 8
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
  -- итог человеку: бот и телефон (этап 48). Ошибка отправки не мешает сохранению
  begin
    if to_regprocedure('public._sa_tg_ready()') is not null and to_regprocedure('public._sa_tg_chat(text,text)') is not null
       and to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is not null then
      if _sa_tg_ready() then
        v_chat := _sa_tg_chat(t.id, null);
        if v_chat is not null then
          select _sa_lc_short(em.name, em.surname) into v_name from employees em where em.id::text = me->>'id';
          v_txt := 'Живая проверка' || case when v_kind = 'blitz' then ', блиц' else ' «' || coalesce(v_title, p_module) || '»' end ||
            ': ' || v_score || '%, ' || case when v_score >= 75 then 'зачтено.' else 'не зачтено.' end ||
            coalesce(E'\n' || 'Повторить: ' || (select string_agg('«' || (x->>'t') || '»', ', ' order by i)
                                                  from jsonb_array_elements(v_rep) with ordinality as e(x, i) where coalesce(x->>'t', '') <> '') || '.', '') ||
            E'\n' || 'Проверка: ' || regexp_replace(coalesce(nullif(v_name, ''), 'руководитель'), '\.$', '') || '.';
          if v_rep is not null and jsonb_array_length(v_rep) > 0 then
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

-- ── 6) Сводка: заведения, модули и вопросы, которые чаще не сдают ────────────────────────────────────────────────
create or replace function live_check_summary(p_token text, p_restaurant text default null, p_days int default 30)
returns jsonb language plpgsql security definer set search_path to public as $$
declare me jsonb := _sa_lc_me(p_token); v_net boolean; v_rest text; v_days int := least(greatest(coalesce(p_days, 30), 7), 365);
  v_from timestamptz; v_tot jsonb; v_venues jsonb; v_mods jsonb; v_qs jsonb;
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if (me->>'level')::int < 30 then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  v_net := (me->>'net')::boolean;
  v_rest := case when not v_net then me->>'restaurant'
                 when nullif(btrim(coalesce(p_restaurant, '')), '') is not null then regexp_replace(btrim(p_restaurant), '\s+', ' ', 'g')
                 else null end;   -- null — вся сеть
  v_from := now() - make_interval(days => v_days);
  select jsonb_build_object('checks', count(*) filter (where k.kind = 'module'), 'blitz', count(*) filter (where k.kind = 'blitz'),
           'people', count(distinct k.emp_id), 'passed', count(*) filter (where k.kind = 'module' and k.passed),
           'avg', coalesce(round(avg(k.score) filter (where k.kind = 'module'))::int, 0))
    into v_tot from sa_live_checks k where k.created_at >= v_from and (v_rest is null or k.restaurant = v_rest);
  select coalesce(jsonb_agg(jsonb_build_object('name', v.restaurant, 'checks', v.n, 'blitz', v.b, 'people', v.people, 'passed', v.passed,
           'avg', v.avg, 'checkers', v.checkers) order by v.n desc, v.restaurant), '[]'::jsonb)
    into v_venues
    from (select k.restaurant, count(*) filter (where k.kind = 'module') as n, count(*) filter (where k.kind = 'blitz') as b,
                 count(distinct k.emp_id) as people, count(*) filter (where k.kind = 'module' and k.passed) as passed,
                 coalesce(round(avg(k.score) filter (where k.kind = 'module'))::int, 0) as avg,
                 (select coalesce(jsonb_agg(jsonb_build_object('name', c.checker_name, 'n', c.n) order by c.n desc, c.checker_name), '[]'::jsonb)
                    from (select k2.checker_name, count(*) as n from sa_live_checks k2
                           where k2.created_at >= v_from and k2.restaurant = k.restaurant group by k2.checker_name) c) as checkers
            from sa_live_checks k where k.created_at >= v_from and (v_rest is null or k.restaurant = v_rest)
           group by k.restaurant) v;
  select coalesce(jsonb_agg(jsonb_build_object('t', m.track, 'm', m.module_id, 'n', m.n, 'avg', m.avg, 'failed', m.failed)
           order by m.avg, m.n desc, m.module_id), '[]'::jsonb)
    into v_mods
    from (select k.track, k.module_id, count(*) as n, round(avg(k.score))::int as avg, count(*) filter (where not k.passed) as failed
            from sa_live_checks k where k.kind = 'module' and k.created_at >= v_from and (v_rest is null or k.restaurant = v_rest)
           group by 1, 2 having count(*) >= 2 order by avg(k.score), count(*) desc, k.module_id limit 8) m;
  select coalesce(jsonb_agg(jsonb_build_object('k', q.k, 'n', q.n, 'pct', q.pct) order by q.pct, q.n desc, q.k), '[]'::jsonb)
    into v_qs
    from (select it->>'k' as k, count(*) as n, round(100 * sum((it->>'g')::int)::numeric / nullif(sum((it->>'o')::int), 0))::int as pct
            from sa_live_checks k
            cross join lateral jsonb_array_elements(case when jsonb_typeof(k.items) = 'array' then k.items else '[]'::jsonb end) it
           where k.created_at >= v_from and (v_rest is null or k.restaurant = v_rest)
           group by 1 having count(*) >= 3 order by 3, 2 desc, 1 limit 10) q;
  return jsonb_build_object('ok', true, 'days', v_days, 'net', v_net, 'restaurant', v_rest, 'totals', v_tot,
    'venues', v_venues, 'modules', v_mods, 'questions', v_qs);
end $$;

-- ── 7) Напоминание о пересдаче (pg_cron) ─────────────────────────────────────────────────────────────────────────
-- последний итог модуля у человека не зачтён, ему 3–30 дней, не напоминали — проверявшему одно сообщение со списком,
-- с 10 до 20 по времени его заведения. p_now — для проверок
create or replace function sa_lc_tick(p_now timestamptz default now())
returns int language plpgsql security definer set search_path to public as $$
declare c record; v_chat bigint; v_tz text; v_ids bigint[]; v_lines text; n int := 0;
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
  return n;
end $$;
revoke all on function sa_lc_tick(timestamptz) from public, anon, authenticated;

do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: напоминания о пересдаче не придут по расписанию, приложение работает (включи pg_cron и запусти файл ещё раз)';
    return;
  end if;
  begin execute $c$select cron.unschedule('sa-live-check')$c$; exception when others then null; end;
  execute $c$select cron.schedule('sa-live-check', '*/30 * * * *', 'select public.sa_lc_tick()')$c$;
exception when others then
  raise notice 'Расписание «Живая проверка» не создано: %', sqlerrm;
end $$;

-- ── 8) Права ───────────────────────────────────────────────────────────────────────────────────────────────────
grant execute on function live_check_people(text, text) to anon, authenticated;
grant execute on function live_check_person(text, text) to anon, authenticated;
grant execute on function live_check_save(text, text, text, text, jsonb, text, jsonb, text, text, text, jsonb) to anon, authenticated;
grant execute on function live_check_summary(text, text, int) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 9) Проверка: ожидаем «живая проверка, этап 64: функций 4 из 4 · старый вызов сохранения: убран · пересдача: … · проверок N»
select 'живая проверка, этап 64: функций ' ||
  (select count(*) from unnest(array['live_check_people(text,text)', 'live_check_person(text,text)',
     'live_check_save(text,text,text,text,jsonb,text,jsonb,text,text,text,jsonb)', 'live_check_summary(text,text,integer)']) f
    where to_regprocedure('public.' || f) is not null) || ' из 4' ||
  ' · старый вызов сохранения: ' || case when to_regprocedure('public.live_check_save(text,text,text,text,jsonb,text)') is null then 'убран' else 'остался' end ||
  ' · пересдача: ' || _sa_lc_cron() ||
  ' · проверок ' || (select count(*) from sa_live_checks) as result;
