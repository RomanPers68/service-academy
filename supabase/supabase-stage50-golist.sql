-- ════════════════════════════════════════════════════════════════════════════════
-- Этап 50 (v141, Доп. 458): итог гоу-листа смены.
--
-- Владелец (06.11, план «Админ на смене»): гоу-лист — новым блоком брифинга. По «Стандартам холдинга» (модуль 09) это две-три
-- позиции, которые смена продвигает сегодня, а «в конце смены записываем в отчёт, сколько продано каждой позиции». Сам
-- гоу-лист едет в брифинге (этап 32: sa_briefs.data → blocks.go, приложение — lib/golist.js); здесь — только итог, отдельно,
-- чтобы запись итога не рассылала брифинг повторно.
--   • sa_briefs.go_sold — продано по позициям гоу-листа ({ id позиции: штук }), go_at и go_by — когда и кто записал.
--   • brief_go_save(p_token, p_day, p_sold) — руководитель или старший своего заведения. День — сегодня или вчера по часам
--     заведения (закрытие после полуночи, утро следующего дня). Только позиции гоу-листа этого дня, целые от 0 до 99 999.
--   • brief_go_get(p_token, p_day) — гоу-лист дня и итог своего заведения (любой сотрудник): брифинг, «Утро руководителя»,
--     «Распорядок смены», «Как вчера». День — за последний 31 день; без дня — сегодня.
-- Нужны этапы 21 (_sa_caller), 24 (_sa_tz) и 32 (sa_briefs). Можно запускать повторно.
-- Supabase → SQL Editor → New query → вставить файл целиком → Run.
-- ════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regprocedure('public._sa_tz(text)') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужен часовой пояс заведения _sa_tz';
  end if;
  if to_regclass('public.sa_briefs') is null then
    raise exception 'Сначала этап 32 (supabase-stage32-briefing.sql): нужен брифинг смены sa_briefs';
  end if;
end $$;

-- ── 1) Итог в брифинге дня ──────────────────────────────────────────────────────
alter table sa_briefs add column if not exists go_sold jsonb;
alter table sa_briefs add column if not exists go_at timestamptz;
alter table sa_briefs add column if not exists go_by text;

-- позиции гоу-листа брифинга: id включённых (блок выключен — пусто)
create or replace function _sa_go_ids(p_data jsonb)
returns text[] language sql immutable set search_path to public as $$
  select coalesce(array_agg(x->>'id' order by o), '{}')
    from jsonb_array_elements(case when jsonb_typeof(p_data->'blocks'->'go') = 'array' and coalesce((p_data->'on'->>'go')::boolean, false)
                                   then p_data->'blocks'->'go' else '[]'::jsonb end) with ordinality as t(x, o)
   where jsonb_typeof(x) = 'object' and coalesce(btrim(x->>'id'), '') <> '';
$$;

-- день из параметра: пусто — сегодня; не дата — null
create or replace function _sa_go_day(p_day text, p_today date)
returns date language plpgsql immutable set search_path to public as $$
begin
  if p_day is null or btrim(p_day) = '' then return p_today; end if;
  if btrim(p_day) !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return btrim(p_day)::date;
exception when others then return null;
end; $$;

-- ── 2) Записать итог ────────────────────────────────────────────────────────────
create or replace function brief_go_save(p_token text, p_day text, p_sold jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; today date; d date; b sa_briefs; ids text[]; out jsonb := '{}'::jsonb; r record; n numeric;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  today := (now() at time zone _sa_tz(rest))::date;
  d := _sa_go_day(p_day, today);
  if d is null or d > today or d < today - 1 then return jsonb_build_object('ok', false, 'error', 'bad_day'); end if;
  if p_sold is null or jsonb_typeof(p_sold) <> 'object' or length(p_sold::text) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  select * into b from sa_briefs where restaurant = rest and day = d;
  if b.restaurant is null then return jsonb_build_object('ok', false, 'error', 'no_brief'); end if;
  ids := _sa_go_ids(b.data);
  if coalesce(array_length(ids, 1), 0) = 0 then return jsonb_build_object('ok', false, 'error', 'no_go'); end if;
  for r in select key, value from jsonb_each(p_sold) loop
    if not (r.key = any(ids)) then continue; end if;   -- чужие позиции молча пропускаем
    if jsonb_typeof(r.value) <> 'number' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    n := (r.value #>> '{}')::numeric;
    if n < 0 or n > 99999 or n <> trunc(n) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
    out := out || jsonb_build_object(r.key, n::int);
  end loop;
  update sa_briefs set go_sold = out, go_at = now(), go_by = c->>'who' where restaurant = rest and day = d;
  return jsonb_build_object('ok', true, 'day', to_char(d, 'YYYY-MM-DD'), 'sold', out, 'at', now(), 'by', c->>'who');
end; $$;

-- ── 3) Гоу-лист дня и итог ──────────────────────────────────────────────────────
create or replace function brief_go_get(p_token text, p_day text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; today date; d date; b sa_briefs;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', true, 'go', null); end if;
  today := (now() at time zone _sa_tz(rest))::date;
  d := _sa_go_day(p_day, today);
  if d is null or d > today or d < today - 31 then return jsonb_build_object('ok', false, 'error', 'bad_day'); end if;
  select * into b from sa_briefs where restaurant = rest and day = d;
  if b.restaurant is null or coalesce(array_length(_sa_go_ids(b.data), 1), 0) = 0 then
    return jsonb_build_object('ok', true, 'day', to_char(d, 'YYYY-MM-DD'), 'go', null);
  end if;
  return jsonb_build_object('ok', true, 'day', to_char(d, 'YYYY-MM-DD'), 'go', b.data->'blocks'->'go', 'sold', coalesce(b.go_sold, '{}'::jsonb),
    'saved', b.go_at is not null, 'at', b.go_at, 'by', b.go_by, 'author', b.author_name);
end; $$;

-- ── 4) Права ────────────────────────────────────────────────────────────────────
revoke all on function _sa_go_ids(jsonb), _sa_go_day(text, date) from public, anon, authenticated;
revoke all on function brief_go_save(text, text, jsonb), brief_go_get(text, text) from public;
grant execute on function brief_go_save(text, text, jsonb), brief_go_get(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'гоу-лист: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('brief_go_save', 'brief_go_get')) || ' функции из 2' ||
  ' · брифингов с гоу-листом: ' || (select count(*) from sa_briefs where coalesce(array_length(_sa_go_ids(data), 1), 0) > 0) ||
  ' · с итогом: ' || (select count(*) from sa_briefs where go_at is not null) as result;
