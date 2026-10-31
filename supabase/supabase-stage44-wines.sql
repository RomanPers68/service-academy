-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 44 (v125, Доп. 438): «Кто выучил новые вина» — тренировка по винной карте на сервере.
--
-- Владелец (31.10): «Да, давай сделаем» — про «Кто выучил новые вина», как «Кто выучил новинки» у меню.
--
--   • Телефон сообщает о своей тренировке по винам (v123–v124: колода «Знаю?», «Новые вина», путь новичка «вина
--     бокалом», викторина): wine_progress_set(p_token, p_kind, p_data). kind:
--       'opened' — открыл «Новые вина» (p_data.ids — какие новые вина были в колоде);
--       'passed' — «Выучил новые вина» (p_data.ids — какие);
--       'stats'  — только счёт «Знаю?»;
--       'quiz'   — прошёл викторину (p_data.quiz = {right, of}).
--     С любым kind можно прислать счёт «Знаю?»: p_data.stats = {known, total, glassKnown, glassTotal} — сколько
--     проверенных вин выучено из скольких и сколько из вин бокалом. Пишется только про себя и своё заведение (по токену).
--   • Руководителю (менеджер, старший, владелец) — «Кто выучил новые вина»: wine_progress_team(p_token, p_restaurant) —
--     все сотрудники заведения (без владельца) и что каждый прислал; кто прислал — выше, дальше по имени. Выучил ли
--     сотрудник ТЕКУЩИЕ новые вина, решает приложение: сравнивает список выученных с новыми винами карты (добавили вино —
--     его нет в списке, и сотрудник снова «учит»). Другие заведения — только сеть (старший, владелец), как у меню.
--   • Таблица sa_wine_progress закрыта: только через эти функции.
--
-- Нужен этап 21 (_sa_caller). Таблицу создаёт, ничего не удаляет. Можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
end $$;

-- ── 1) Таблица: одна строка на сотрудника в заведении ───────────────────────────
create table if not exists sa_wine_progress (
  restaurant   text not null,
  emp_id       text not null,                          -- employees.id
  passed_ids   text[] not null default '{}',            -- «Выучил новые вина»: какие
  passed_at    timestamptz,
  opened_ids   text[] not null default '{}',            -- открывал «Новые вина»: какие были в колоде
  opened_at    timestamptz,
  known        int, total int,                          -- «Знаю?»: выучено из проверенных вин
  glass_known  int, glass_total int,                    -- путь новичка: вина бокалом
  stats_at     timestamptz,
  quiz_right   int, quiz_of int, quiz_at timestamptz,   -- последняя викторина по винам
  updated_at   timestamptz not null default now(),
  primary key (restaurant, emp_id)
);
alter table sa_wine_progress enable row level security;
revoke all on table sa_wine_progress from public, anon, authenticated;

-- ── 2) Разбор того, что прислал телефон ─────────────────────────────────────────
-- id вин: только строки, без пустых, до 60 знаков, до 300 штук, без повторов (в порядке присланного)
create or replace function _sa_wp_ids(j jsonb)
returns text[] language sql immutable set search_path to public as $$
  select coalesce(array_agg(x order by o), '{}'::text[])
    from (select distinct on (x) x, o
            from (select left(btrim(e #>> '{}'), 60) x, o
                    from jsonb_array_elements(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end) with ordinality t(e, o)
                   where jsonb_typeof(e) = 'string' and btrim(e #>> '{}') <> '') a
           order by x, o) s
   where o <= 300;
$$;
-- число: целое от 0 до 100000; не число — пусто
create or replace function _sa_wp_int(v jsonb)
returns int language sql immutable set search_path to public as $$
  select case when jsonb_typeof(v) = 'number' then greatest(0, least(100000, floor((v #>> '{}')::numeric)))::int else null end;
$$;

-- «из скольких» не меньше «сколько»: a не больше b (пустое остаётся пустым; least() пустое пропустил бы)
create or replace function _sa_wp_cap(a int, b int)
returns int language sql immutable set search_path to public as $$
  select case when a is null then null when b is null then a else least(a, b) end;
$$;

-- ── 3) Телефон → сервер ────────────────────────────────────────────────────────
create or replace function wine_progress_set(p_token text, p_kind text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; me text; d jsonb := coalesce(p_data, '{}'::jsonb); st jsonb; qz jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := coalesce(c->>'restaurant', ''); me := c->>'id';
  if rest = '' then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_kind is null or p_kind not in ('opened', 'passed', 'stats', 'quiz') then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  if jsonb_typeof(d) <> 'object' then d := '{}'::jsonb; end if;
  qz := case when jsonb_typeof(d->'quiz') = 'object' then d->'quiz' else '{}'::jsonb end;
  -- викторина без «из скольких» — не пишем ничего (и строку сотрудника не заводим)
  if p_kind = 'quiz' and coalesce(_sa_wp_int(qz->'of'), 0) = 0 then return jsonb_build_object('ok', false, 'error', 'quiz'); end if;
  insert into sa_wine_progress (restaurant, emp_id) values (rest, me) on conflict (restaurant, emp_id) do nothing;
  if p_kind = 'opened' then
    update sa_wine_progress set opened_ids = _sa_wp_ids(d->'ids'), opened_at = now() where restaurant = rest and emp_id = me;
  elsif p_kind = 'passed' then
    update sa_wine_progress set passed_ids = _sa_wp_ids(d->'ids'), passed_at = now() where restaurant = rest and emp_id = me;
  elsif p_kind = 'quiz' then
    update sa_wine_progress set quiz_right = coalesce(_sa_wp_cap(_sa_wp_int(qz->'right'), _sa_wp_int(qz->'of')), 0), quiz_of = _sa_wp_int(qz->'of'), quiz_at = now()
     where restaurant = rest and emp_id = me;
  end if;
  st := case when jsonb_typeof(d->'stats') = 'object' then d->'stats' else null end;
  if st is not null and _sa_wp_int(st->'total') is not null then
    update sa_wine_progress set known = coalesce(_sa_wp_cap(_sa_wp_int(st->'known'), _sa_wp_int(st->'total')), 0), total = _sa_wp_int(st->'total'),
           glass_known = _sa_wp_cap(_sa_wp_int(st->'glassKnown'), _sa_wp_int(st->'glassTotal')), glass_total = _sa_wp_int(st->'glassTotal'), stats_at = now()
     where restaurant = rest and emp_id = me;
  end if;
  update sa_wine_progress set updated_at = now() where restaurant = rest and emp_id = me;
  return jsonb_build_object('ok', true);
end; $$;

-- ── 4) Руководителю: кто как учит вина ─────────────────────────────────────────
create or replace function wine_progress_team(p_token text, p_restaurant text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; rows_ jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden', 'restaurant', c->>'restaurant'); end if;
  rest := coalesce(nullif(btrim(coalesce(p_restaurant, '')), ''), c->>'restaurant');
  if rest is distinct from c->>'restaurant' and not coalesce((c->>'network')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'restaurant', c->>'restaurant');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id::text, 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')), 'pos', lower(coalesce(e.position, '')),
           'passed', to_jsonb(coalesce(p.passed_ids, '{}'::text[])), 'passedAt', p.passed_at,
           'opened', to_jsonb(coalesce(p.opened_ids, '{}'::text[])), 'openedAt', p.opened_at,
           'known', p.known, 'total', p.total, 'glassKnown', p.glass_known, 'glassTotal', p.glass_total, 'statsAt', p.stats_at,
           'quizRight', p.quiz_right, 'quizOf', p.quiz_of, 'quizAt', p.quiz_at, 'at', p.updated_at)
           order by (p.updated_at is null), e.name, e.surname, e.id::text), '[]'::jsonb)
    into rows_
    from employees e
    left join sa_wine_progress p on p.restaurant = rest and p.emp_id = e.id::text
   where e.restaurant = rest and coalesce(e.status, 'active') = 'active' and not coalesce(e.is_admin, false);
  return jsonb_build_object('ok', true, 'restaurant', rest, 'rows', rows_);
end; $$;

-- ── 5) Права ───────────────────────────────────────────────────────────────────
revoke all on function _sa_wp_ids(jsonb) from public, anon, authenticated;
revoke all on function _sa_wp_int(jsonb) from public, anon, authenticated;
revoke all on function _sa_wp_cap(int, int) from public, anon, authenticated;
revoke all on function wine_progress_set(text, text, jsonb), wine_progress_team(text, text) from public;
grant execute on function wine_progress_set(text, text, jsonb), wine_progress_team(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'вина: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('wine_progress_set', 'wine_progress_team')) || ' функции из 2' ||
  ' · таблица: ' || case when to_regclass('public.sa_wine_progress') is not null then 'есть' else 'нет' end ||
  ' · уже прислали: ' || (select count(*) from sa_wine_progress) as result;
