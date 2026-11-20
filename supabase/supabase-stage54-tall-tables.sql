-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 54 (v180, Доп. 505): длинные столы вертикально на схеме зала.
--
-- Владелец (20.11), распознав план зала по фото: «Но почему то не учитывает длинные столы по вертикали, а только
-- горизонт». До этапа 54 форма стола — квадрат (sq), круг (rd) или длинный (long, две клетки в ширину).
--
--   • floor_save(p_token, p_plan) — как в этапе 37, плюс форма tall: длинный стол вертикально, две клетки в глубину
--     (клетка x до 7, y до 28). Такой стол тоже не встаёт на другой стол, бар или вход — ни одной из двух клеток;
--   • seat_board — как в этапе 37, плюс признак tall: true (приложение показывает вертикальные длинные столы в выборе
--     вида стола, кнопку «Повернуть» у длинного стола, и ИИ по фото ставит такие столы вертикально).
--
-- Нужен этап 37. Ничего не удаляет. Можно запускать повторно.
-- Этап 54 заменяет floor_save и seat_board этапа 37: если перезапускаешь этап 37 (или 35) — после него снова этап 54.
-- Старое приложение (до v180) схему с вертикальными столами показывает, но такой стол у него — квадрат в одну клетку.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.sa_floor') is null or to_regclass('public.sa_seat') is null then
    raise exception 'Сначала этап 35 (supabase-stage35-seating.sql): нужна рассадка — таблицы sa_floor и sa_seat';
  end if;
  if to_regprocedure('public.floor_save(text,jsonb)') is null
     or pg_get_functiondef('public.floor_save(text,jsonb)'::regprocedure) not like '%''zones''%' then
    raise exception 'Сначала этап 37 (supabase-stage37-halls-qday.sql): нужны залы и стены на схеме зала';
  end if;
end $$;

-- ── 1) Схема зала: столы { id, n, seats, shape, x, y, z }; shape — sq, rd, long или tall ────────────────────────
create or replace function floor_save(p_token text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; n int; ni int; nz int; bad int; plan jsonb; zones jsonb; items jsonb; old jsonb; zids text[]; z1 text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' or jsonb_typeof(p_plan->'tables') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'bad_plan');
  end if;

  -- залы; нет — схема старого вида: один зал. Старое приложение не затирает второй зал и стены
  zones := p_plan->'zones';
  if zones is null or jsonb_typeof(zones) = 'null' then
    select f.plan into old from sa_floor f where f.restaurant = rest;
    if old is not null and (
         (jsonb_typeof(old->'zones') = 'array' and jsonb_array_length(old->'zones') > 1)
      or (jsonb_typeof(old->'items') = 'array' and jsonb_array_length(old->'items') > 0)) then
      return jsonb_build_object('ok', false, 'error', 'old_app');
    end if;
    zones := jsonb_build_array(jsonb_build_object('id', 'z1', 'name', 'Зал'));
  end if;
  if jsonb_typeof(zones) <> 'array' then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  nz := jsonb_array_length(zones);
  if nz < 1 or nz > 6 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  select count(*) into bad from jsonb_array_elements(zones) z
   where jsonb_typeof(z) <> 'object' or coalesce(z->>'id', '') !~ '^z[0-9a-z]{1,8}$'
      or length(btrim(coalesce(z->>'name', ''))) not between 1 and 24;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  if (select count(distinct z->>'id') from jsonb_array_elements(zones) z) <> nz
     or (select count(distinct lower(btrim(z->>'name'))) from jsonb_array_elements(zones) z) <> nz then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;
  select array_agg(z->>'id' order by i) into zids from jsonb_array_elements(zones) with ordinality as q(z, i);
  z1 := zids[1];

  -- столы (как в этапе 35) и зал стола; стол без зала — в первом зале
  n := jsonb_array_length(p_plan->'tables');
  if n > 80 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  select count(*) into bad from jsonb_array_elements(p_plan->'tables') t
   where jsonb_typeof(t) <> 'object'
      or coalesce(t->>'id', '') !~ '^t[0-9a-z]{1,12}$'
      or length(btrim(coalesce(t->>'n', ''))) not between 1 and 6
      or coalesce(t->>'shape', '') not in ('sq', 'rd', 'long', 'tall')
      -- числа — через case: порядок проверок в or не гарантирован, а «abc»::int — ошибка
      or (case when coalesce(t->>'seats', '') ~ '^\d{1,2}$' then (t->>'seats')::int else 0 end) not between 1 and 20
      or (case when coalesce(t->>'x', '') ~ '^\d{1,2}$' then (t->>'x')::int else 99 end) > case when t->>'shape' = 'long' then 6 else 7 end
      or (case when coalesce(t->>'y', '') ~ '^\d{1,2}$' then (t->>'y')::int else 99 end) > case when t->>'shape' = 'tall' then 28 else 29 end
      or not (coalesce(t->>'z', z1) = any (zids));
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  if (select count(distinct t->>'id') from jsonb_array_elements(p_plan->'tables') t) <> n
     or (select count(distinct lower(btrim(t->>'n'))) from jsonb_array_elements(p_plan->'tables') t) <> n then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  -- стены, бар, вход
  items := coalesce(p_plan->'items', '[]'::jsonb);
  if jsonb_typeof(items) <> 'array' then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  ni := jsonb_array_length(items);
  if ni > 60 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  select count(*) into bad from jsonb_array_elements(items) it
   where jsonb_typeof(it) <> 'object'
      or coalesce(it->>'id', '') !~ '^i[0-9a-z]{1,12}$'
      or coalesce(it->>'kind', '') not in ('wall', 'bar', 'door')
      or not (coalesce(it->>'z', z1) = any (zids))
      or coalesce(it->>'x', '') !~ '^\d{1,2}$' or coalesce(it->>'y', '') !~ '^\d{1,2}$'
      or case it->>'kind'
           when 'wall' then coalesce(it->>'x2', '') !~ '^\d{1,2}$' or coalesce(it->>'y2', '') !~ '^\d{1,2}$'
           when 'bar' then coalesce(it->>'w', '') !~ '^\d{1,2}$' or coalesce(it->>'h', '') !~ '^\d{1,2}$'
           else false end;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  -- числа уже проверены — границы
  select count(*) into bad from jsonb_array_elements(items) it
   where case it->>'kind'
           when 'wall' then (it->>'x')::int > 8 or (it->>'x2')::int > 8 or (it->>'y')::int > 30 or (it->>'y2')::int > 30
                         or ((it->>'x')::int <> (it->>'x2')::int and (it->>'y')::int <> (it->>'y2')::int)
                         or ((it->>'x')::int = (it->>'x2')::int and (it->>'y')::int = (it->>'y2')::int)
           when 'bar' then (it->>'w')::int < 1 or (it->>'h')::int < 1 or (it->>'x')::int + (it->>'w')::int > 8 or (it->>'y')::int + (it->>'h')::int > 30
           else (it->>'x')::int > 7 or (it->>'y')::int > 29 end;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  if (select count(distinct it->>'id') from jsonb_array_elements(items) it) <> ni then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  -- стол не встаёт на стол, бар или вход того же зала (стены клеток не занимают); длинный — двумя клетками в ширину,
  -- вертикальный (tall) — двумя в глубину
  with cells as (
    select coalesce(t->>'z', z1) as z, (t->>'x')::int + g.dx as cx, (t->>'y')::int + v.dy as cy, 't' as src
      from jsonb_array_elements(p_plan->'tables') t, lateral generate_series(0, case when t->>'shape' = 'long' then 1 else 0 end) as g(dx),
           lateral generate_series(0, case when t->>'shape' = 'tall' then 1 else 0 end) as v(dy)
    union all
    select coalesce(it->>'z', z1), (it->>'x')::int + gx, (it->>'y')::int + gy, 'i'
      from jsonb_array_elements(items) it,
           lateral generate_series(0, case when it->>'kind' = 'bar' then (it->>'w')::int - 1 else 0 end) as gx,
           lateral generate_series(0, case when it->>'kind' = 'bar' then (it->>'h')::int - 1 else 0 end) as gy
     where it->>'kind' in ('bar', 'door')
  )
  select count(*) into bad from (select 1 from cells group by z, cx, cy having count(*) filter (where src = 't') >= 1 and count(*) > 1) d;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'overlap'); end if;

  plan := jsonb_build_object('v', 2,
    'zones', (select jsonb_agg(jsonb_build_object('id', z->>'id', 'name', btrim(z->>'name')) order by i) from jsonb_array_elements(zones) with ordinality as q(z, i)),
    'tables', coalesce((select jsonb_agg(jsonb_build_object('id', t->>'id', 'n', btrim(t->>'n'), 'seats', (t->>'seats')::int,
            'shape', t->>'shape', 'x', (t->>'x')::int, 'y', (t->>'y')::int, 'z', coalesce(t->>'z', z1)) order by i)
          from jsonb_array_elements(p_plan->'tables') with ordinality as q(t, i)), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(case it->>'kind'
            when 'wall' then jsonb_build_object('id', it->>'id', 'kind', 'wall', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'x2', (it->>'x2')::int, 'y2', (it->>'y2')::int, 'z', coalesce(it->>'z', z1))
            when 'bar' then jsonb_build_object('id', it->>'id', 'kind', 'bar', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'w', (it->>'w')::int, 'h', (it->>'h')::int, 'z', coalesce(it->>'z', z1))
            else jsonb_build_object('id', it->>'id', 'kind', 'door', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'z', coalesce(it->>'z', z1)) end order by i)
          from jsonb_array_elements(items) with ordinality as q(it, i)), '[]'::jsonb));
  insert into sa_floor (restaurant, plan, updated_by) values (rest, plan, c->>'id')
  on conflict (restaurant) do update set plan = excluded.plan, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true, 'v', 2, 'tables', n, 'items', ni, 'zones', nz);
end; $$;

-- как в этапе 37 (floor: 2 — залы и стены), плюс tall: true — сервер знает вертикальные длинные столы
create or replace function seat_board(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; pl jsonb; staff jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select plan into pl from sa_floor where restaurant = rest;
  begin
    execute $q$select coalesce(jsonb_agg(jsonb_build_object('id', e.id::text, 'name', e.name, 'surname', coalesce(e.surname, ''),
                 'position', lower(coalesce(to_jsonb(e)->>'position', ''))) order by e.name, e.surname), '[]'::jsonb)
                from employees e where e.restaurant = $1 and coalesce(to_jsonb(e)->>'status', 'active') = 'active'
                 and lower(coalesce(to_jsonb(e)->>'position', '')) in ('waiter', 'senior', 'bartender', 'senior_bartender', 'manager', 'runner', 'sommelier')$q$
      into staff using rest;
  exception when others then staff := '[]'::jsonb; end;
  return jsonb_build_object('ok', true, 'floor', 2, 'tall', true, 'day', to_char(ld, 'YYYY-MM-DD'), 'now', now(), 'lead', coalesce((c->>'lead')::boolean, false),
    'plan', pl, 'staff', coalesce(staff, '[]'::jsonb),
    'tables', coalesce((select jsonb_agg(_sa_seat_json(s) order by s.tid) from sa_seat s where s.restaurant = rest and s.day = ld), '[]'::jsonb));
end; $$;

-- ── 2) Признак этапа для экрана «Сервер» (там этапы узнаются по функции): формы стола на схеме ─────────────────────
create or replace function _sa_floor_shapes() returns text[] language sql immutable set search_path to public as $$
  select array['sq', 'rd', 'long', 'tall']
$$;

-- ── 3) Права ───────────────────────────────────────────────────────────────────
grant execute on function floor_save(text, jsonb) to anon, authenticated;
grant execute on function seat_board(text) to anon, authenticated;
revoke all on function _sa_floor_shapes() from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'длинные столы вертикально: ' ||
  case when pg_get_functiondef('public.floor_save(text,jsonb)'::regprocedure) like '%''tall''%' then 'да' else 'НЕТ' end ||
  ' · доска знает: ' || case when pg_get_functiondef('public.seat_board(text)'::regprocedure) like '%''tall'', true%' then 'да' else 'НЕТ' end ||
  ' · схем заведений: ' || (select count(*) from sa_floor) as result;
