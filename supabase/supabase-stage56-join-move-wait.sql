-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 56 (v187, Доп. 512): объединить столы, пересадить гостей, лист ожидания.
--
-- Владелец спросил, как сделать рассадку удобнее и красивее, и на семь предложений ответил «Давай все». Этап 56 —
-- серверная часть трёх из них (и сдвиг стола в четверть клетки для v188, чтобы там обойтись без SQL):
--   • seat_join(p_token, p_tid, p_with) — к столу с гостями, со «Счётом» или с бронью приставить свободные столы того
--     же зала: p_with — массив id, у одного стола всего до шести. У приставленного тот же статус, официант и время,
--     гостей 0 и ссылка на главный (main); у главного — список приставленных (joined);
--   • seat_unjoin(p_token, p_tid) — отделить: приставленный — только его, главный — все его. Сидели гости — на уборку,
--     была бронь — свободны;
--   • seat_move(p_token, p_from, p_to) — пересадить гостей (или перенести бронь) за свободный стол, можно в другой зал:
--     гости, официант и время посадки — за новым столом; старый и приставленные к нему — на уборку (бронь — свободны).
--     Официанту — сообщение в Telegram (если пересадил не он сам);
--   • wait_add(p_token, p_name, p_cnt, p_note), wait_done(p_token, p_id, p_how, p_tid) — лист ожидания на сегодня: на
--     кого, сколько, заметка; отметка «посадили» (seat, за какой стол) или «ушли» (left). Вести может любой сотрудник;
--   • seat_set — как в этапе 36, плюс приставленные столы: статус главного — и у них; освободили главный или на уборку —
--     и они так же, без ссылок. Приставленный стол, которому ставят статус сам по себе (так делает и приложение до
--     v187), отделяется. В ответе ещё tables — все столы, которые изменились;
--   • seat_board — как в этапе 55, плюс seat2: true (сервер умеет всё это), wait — кто ждёт, и fine: true;
--   • floor_save — как в этапе 55, плюс у стола необязательные ox, oy: сдвиг от клетки от −0.5 до 0.5 с шагом 0.25.
--     Приложение до v188 их не знает и не шлёт: у стола с тем же id, формой и клеткой сдвиг остаётся (новое пишет в
--     схему fine: true — у него стол без ox, oy стоит ровно в клетке).
--
-- Нужен этап 55. Ничего не удаляет. Можно запускать повторно.
-- Этап 56 заменяет floor_save и seat_board этапа 55 и seat_set этапа 36: если перезапускаешь их (или 54, 37, 35) —
-- после них снова 56.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.sa_floor') is null or to_regclass('public.sa_seat') is null then
    raise exception 'Сначала этап 35 (supabase-stage35-seating.sql): нужна рассадка — таблицы sa_floor и sa_seat';
  end if;
  if to_regprocedure('public._sa_floor_sides()') is null then
    raise exception 'Сначала этап 55 (supabase-stage55-chair-sides.sql): нужны стулья по сторонам';
  end if;
end $$;

-- ── 1) Таблицы ─────────────────────────────────────────────────────────────────
alter table sa_seat add column if not exists main text;                                   -- приставлен к столу (id)
alter table sa_seat add column if not exists joined jsonb not null default '[]'::jsonb;   -- у главного: приставленные

create table if not exists sa_wait (
  id           bigserial primary key,
  restaurant   text not null,
  day          date not null,                   -- день по часам заведения
  name         text not null default '',        -- на кого (можно без имени)
  cnt          int not null default 2,          -- сколько гостей
  note         text not null default '',        -- заметка: «у бара», «с коляской»
  created_by   text,
  created_name text not null default '',
  created_at   timestamptz not null default now(),
  done         text,                            -- seat | left; пусто — ещё ждут
  done_tid     text,                            -- seat: за какой стол
  done_by      text,
  done_at      timestamptz
);
create index if not exists sa_wait_rest_day on sa_wait (restaurant, day);
alter table sa_wait enable row level security;
revoke all on table sa_wait from public, anon, authenticated;
revoke all on sequence sa_wait_id_seq from public, anon, authenticated;

-- ── 2) Помощники ───────────────────────────────────────────────────────────────
create or replace function _sa_seat_json(s sa_seat)
returns jsonb language sql stable as $$
  select jsonb_build_object('tid', s.tid, 'status', s.status, 'cnt', s.cnt, 'name', s.name, 'rtime', s.rtime, 'since', s.since,
    'waiter_id', s.waiter_id, 'waiter_name', s.waiter_name, 'updated_name', s.updated_name, 'updated_at', s.updated_at,
    'main', s.main, 'joined', coalesce(s.joined, '[]'::jsonb))
$$;

create or replace function _sa_wait_json(w sa_wait)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', w.id, 'name', w.name, 'cnt', w.cnt, 'note', w.note, 'at', w.created_at, 'by', w.created_name)
$$;

-- столы доски по списку id — для ответа: что изменилось
create or replace function _sa_seat_rows(p_rest text, p_day date, p_tids text[])
returns jsonb language sql stable set search_path to public as $$
  select coalesce(jsonb_agg(_sa_seat_json(s) order by s.tid), '[]'::jsonb) from sa_seat s
   where s.restaurant = p_rest and s.day = p_day and s.tid = any (p_tids)
$$;

-- столы — в статус p_status без гостей, брони, официанта и ссылок (освободили, на уборку, отделили)
create or replace function _sa_seat_reset(p_rest text, p_day date, p_tids text[], p_status text, p_by text, p_name text)
returns void language sql security definer set search_path to public as $$
  update sa_seat set status = p_status, cnt = 0, name = '', rtime = '', since = null, waiter_id = null, waiter_name = '',
         main = null, joined = '[]'::jsonb, updated_by = p_by, updated_name = p_name, updated_at = now()
   where restaurant = p_rest and day = p_day and tid = any (p_tids)
$$;

-- приставленные столы — за главным: тот же статус, официант, время посадки и брони
create or replace function _sa_seat_follow(p_rest text, p_day date, p_main text, p_by text, p_name text)
returns void language plpgsql security definer set search_path to public as $$
declare m sa_seat;
begin
  select * into m from sa_seat where restaurant = p_rest and day = p_day and tid = p_main;
  if m.tid is null or jsonb_array_length(coalesce(m.joined, '[]'::jsonb)) = 0 then return; end if;
  update sa_seat s set status = m.status, cnt = 0, name = '', rtime = m.rtime, since = m.since, waiter_id = m.waiter_id,
         waiter_name = m.waiter_name, main = m.tid, joined = '[]'::jsonb, updated_by = p_by, updated_name = p_name, updated_at = now()
   where s.restaurant = p_rest and s.day = p_day and s.tid in (select jsonb_array_elements_text(m.joined));
end; $$;

-- ── 3) Схема зала: столы { id, n, seats, shape, x, y, z, sides?, ox?, oy? } ───────────────────────────────────
create or replace function floor_save(p_token text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; n int; ni int; nz int; bad int; plan jsonb; zones jsonb; items jsonb; old jsonb; zids text[]; z1 text; knows boolean; fine boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' or jsonb_typeof(p_plan->'tables') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'bad_plan');
  end if;

  -- прежняя схема — нужна старому приложению (залы, стены), стульям по сторонам (v183) и сдвигу стола (v188);
  -- приложение, которое знает стулья по сторонам, пишет в схему sides: true, знает сдвиг — fine: true
  select f.plan into old from sa_floor f where f.restaurant = rest;
  knows := coalesce(p_plan->'sides' = 'true'::jsonb, false);
  fine := coalesce(p_plan->'fine' = 'true'::jsonb, false);

  -- залы; нет — схема старого вида: один зал. Старое приложение не затирает второй зал и стены
  zones := p_plan->'zones';
  if zones is null or jsonb_typeof(zones) = 'null' then
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
  -- стулья по сторонам (этап 55) — [верх, низ, лево, право]; число — стулья, со знаком минус — диван на столько мест
  select count(*) into bad from jsonb_array_elements(p_plan->'tables') t
   where t ? 'sides' and jsonb_typeof(t->'sides') <> 'null'
     and case when t->>'shape' not in ('sq', 'long', 'tall') or jsonb_typeof(t->'sides') <> 'array' then true
              when jsonb_array_length(t->'sides') <> 4 then true
              else exists (select 1 from jsonb_array_elements_text(t->'sides') with ordinality as s(v, k)
                            where v !~ '^-?\d{1,2}$'
                               or abs(case when v ~ '^-?\d{1,2}$' then v::int else 99 end)
                                  > case when t->>'shape' = 'sq' then 3 when (t->>'shape' = 'long') = (k <= 2) then 8 else 2 end)
                   or (select sum(abs(case when v ~ '^-?\d{1,2}$' then v::int else 99 end)) from jsonb_array_elements_text(t->'sides') v)
                      <> (t->>'seats')::int end;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;
  -- v187: сдвиг от клетки — ox, oy: число от −0.5 до 0.5 с шагом 0.25 (четверть клетки); через case — по порядку
  select count(*) into bad from jsonb_array_elements(p_plan->'tables') t, lateral (values ('ox'), ('oy')) as k(f)
   where t ? k.f and jsonb_typeof(t->k.f) <> 'null'
     and case when jsonb_typeof(t->k.f) <> 'number' then true
              when abs((t->>k.f)::numeric) > 0.5 then true
              else (t->>k.f)::numeric * 4 <> round((t->>k.f)::numeric * 4) end;
  if bad > 0 then return jsonb_build_object('ok', false, 'error', 'bad_plan'); end if;

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
  -- вертикальный (tall) — двумя в глубину. Сдвиг ox, oy клеток не меняет: стол занимает свою клетку
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
    -- sides (этап 55) и сдвиг (ox, oy) — как прислали; приложение, которое их не знает, не шлёт — у того же стола
    -- остаётся то, что было (иначе один старый телефон стёр бы всем стулья по сторонам и сдвиги)
    'tables', coalesce((select jsonb_agg(jsonb_build_object('id', t->>'id', 'n', btrim(t->>'n'), 'seats', (t->>'seats')::int,
            'shape', t->>'shape', 'x', (t->>'x')::int, 'y', (t->>'y')::int, 'z', coalesce(t->>'z', z1))
            || case when sd.v is null then '{}'::jsonb else jsonb_build_object('sides', sd.v) end
            || case when coalesce(fo.ox, 0) = 0 then '{}'::jsonb else jsonb_build_object('ox', fo.ox) end
            || case when coalesce(fo.oy, 0) = 0 then '{}'::jsonb else jsonb_build_object('oy', fo.oy) end order by i)
          from jsonb_array_elements(p_plan->'tables') with ordinality as q(t, i)
          cross join lateral (select case
            when jsonb_typeof(t->'sides') = 'array' then (select jsonb_agg(v::int order by k) from jsonb_array_elements_text(t->'sides') with ordinality as s(v, k))
            when not knows and not (t ? 'sides') and jsonb_typeof(old->'tables') = 'array' then
              (select o->'sides' from jsonb_array_elements(old->'tables') o
                where o->>'id' = t->>'id' and o->>'shape' = t->>'shape' and o->>'seats' = (t->>'seats')::int::text and jsonb_typeof(o->'sides') = 'array' limit 1)
            end as v) sd
          -- тот же стол в прежней схеме (id, форма, клетка) — если приложение сдвига не знает и сдвиг не прислало
          left join lateral (select o from jsonb_array_elements(case when not fine and not (t ? 'ox') and not (t ? 'oy') and jsonb_typeof(old->'tables') = 'array'
                                                                    then old->'tables' else '[]'::jsonb end) o
                              where o->>'id' = t->>'id' and o->>'shape' = t->>'shape' and o->>'x' = (t->>'x')::int::text and o->>'y' = (t->>'y')::int::text
                              limit 1) ot on true
          cross join lateral (select
            case when jsonb_typeof(t->'ox') = 'number' then (t->>'ox')::numeric when jsonb_typeof(ot.o->'ox') = 'number' then (ot.o->>'ox')::numeric end as ox,
            case when jsonb_typeof(t->'oy') = 'number' then (t->>'oy')::numeric when jsonb_typeof(ot.o->'oy') = 'number' then (ot.o->>'oy')::numeric end as oy) fo), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(case it->>'kind'
            when 'wall' then jsonb_build_object('id', it->>'id', 'kind', 'wall', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'x2', (it->>'x2')::int, 'y2', (it->>'y2')::int, 'z', coalesce(it->>'z', z1))
            when 'bar' then jsonb_build_object('id', it->>'id', 'kind', 'bar', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'w', (it->>'w')::int, 'h', (it->>'h')::int, 'z', coalesce(it->>'z', z1))
            else jsonb_build_object('id', it->>'id', 'kind', 'door', 'x', (it->>'x')::int, 'y', (it->>'y')::int, 'z', coalesce(it->>'z', z1)) end order by i)
          from jsonb_array_elements(items) with ordinality as q(it, i)), '[]'::jsonb));
  insert into sa_floor (restaurant, plan, updated_by) values (rest, plan, c->>'id')
  on conflict (restaurant) do update set plan = excluded.plan, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true, 'v', 2, 'tables', n, 'items', ni, 'zones', nz);
end; $$;

-- ── 4) Доска: как в этапе 55, плюс seat2, fine и лист ожидания ──────────────────────────────────────────────────
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
  return jsonb_build_object('ok', true, 'floor', 2, 'tall', true, 'sides', true, 'seat2', true, 'fine', true,
    'day', to_char(ld, 'YYYY-MM-DD'), 'now', now(), 'lead', coalesce((c->>'lead')::boolean, false),
    'plan', pl, 'staff', coalesce(staff, '[]'::jsonb),
    'tables', coalesce((select jsonb_agg(_sa_seat_json(s) order by s.tid) from sa_seat s where s.restaurant = rest and s.day = ld), '[]'::jsonb),
    'wait', coalesce((select jsonb_agg(_sa_wait_json(w) order by w.created_at, w.id) from sa_wait w
                       where w.restaurant = rest and w.day = ld and w.done is null), '[]'::jsonb));
end; $$;

-- ── 5) Стол: как в этапе 36, плюс приставленные ────────────────────────────────
create or replace function seat_set(p_token text, p_tid text, p_status text, p_cnt int, p_name text, p_rtime text, p_waiter text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; pl jsonb; tn text; old sa_seat; r sa_seat; st text; wn text; wid text; chat bigint; busy boolean;
        kept jsonb; touched text[]; who text;
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
  who := coalesce(c->>'who', '');
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into old from sa_seat where restaurant = rest and day = ld and tid = p_tid for update;
  touched := array[p_tid];
  -- v187: приставленному столу ставят статус сам по себе — он отделяется (главный его больше не держит) и считается
  -- свободным: посадили за него — новое время посадки и сообщение официанту
  if old.main is not null then
    update sa_seat set joined = joined - p_tid, updated_at = now() where restaurant = rest and day = ld and tid = old.main;
    touched := touched || old.main;
    old.status := 'free'; old.waiter_id := null; old.since := null;
  end if;
  -- приставленные остаются, пока за столом гости, счёт или бронь; освободили или на уборку — отпускаем
  kept := case when st in ('seat', 'bill', 'res') then coalesce(old.joined, '[]'::jsonb) else '[]'::jsonb end;
  insert into sa_seat (restaurant, day, tid, status, cnt, name, rtime, since, waiter_id, waiter_name, main, joined, updated_by, updated_name, updated_at)
  values (rest, ld, p_tid, st,
    case when busy or st = 'res' then coalesce(p_cnt, 0) else 0 end,
    case when st = 'res' then btrim(coalesce(p_name, '')) else '' end,
    case when st = 'res' then coalesce(p_rtime, '') else '' end,
    case when busy then case when coalesce(old.status, '') in ('seat', 'bill') then old.since else now() end end,
    case when busy then wid end, case when busy then coalesce(wn, '') else '' end,
    null, kept, c->>'id', who, now())
  on conflict (restaurant, day, tid) do update set status = excluded.status, cnt = excluded.cnt, name = excluded.name, rtime = excluded.rtime,
    since = excluded.since, waiter_id = excluded.waiter_id, waiter_name = excluded.waiter_name, main = null, joined = excluded.joined,
    updated_by = excluded.updated_by, updated_name = excluded.updated_name, updated_at = now()
  returning * into r;
  if jsonb_array_length(coalesce(old.joined, '[]'::jsonb)) > 0 then
    touched := touched || array(select jsonb_array_elements_text(old.joined));
    if jsonb_array_length(kept) > 0 then perform _sa_seat_follow(rest, ld, p_tid, c->>'id', who);
    else perform _sa_seat_reset(rest, ld, array(select jsonb_array_elements_text(old.joined)), st, c->>'id', who); end if;
  end if;
  -- официанту — когда ему посадили гостей (новая посадка или стол передали ему); «Счёт» и возврат из него — без сообщения
  if st = 'seat' and wid is not null and wid <> c->>'id' and (coalesce(old.status, '') not in ('seat', 'bill') or old.waiter_id is distinct from wid) and _sa_tg_ready() then
    chat := _sa_tg_chat(wid, 'seat');
    if chat is not null then
      perform sa_tg_send(chat, 'Стол ' || tn || ': посадили ' || r.cnt || ' ' ||
        case when r.cnt % 10 = 1 and r.cnt % 100 <> 11 then 'гостя' else 'гостей' end || '. Посадил(а): ' || coalesce(nullif(who, ''), 'хостес') || '.',
        'Рассадка', 'seat');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'table', _sa_seat_json(r), 'tables', _sa_seat_rows(rest, ld, touched));
end; $$;

-- ── 6) Объединить и разъединить ────────────────────────────────────────────────
create or replace function seat_join(p_token text, p_tid text, p_with jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; pl jsonb; m sa_seat; ws text[]; w text; z1 text; zm text; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_with is null or jsonb_typeof(p_with) <> 'array' or jsonb_array_length(p_with) not between 1 and 6
     or exists (select 1 from jsonb_array_elements(p_with) v where jsonb_typeof(v) <> 'string') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  -- без повторов, в том порядке, в каком выбрали
  select array_agg(v order by i) into ws from (select v, min(i) as i from jsonb_array_elements_text(p_with) with ordinality as q(v, i) group by v) d;
  if p_tid = any (ws) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  select plan into pl from sa_floor where restaurant = rest;
  z1 := coalesce(pl->'zones'->0->>'id', 'z1');
  select coalesce(t->>'z', z1) into zm from jsonb_array_elements(coalesce(pl->'tables', '[]'::jsonb)) t where t->>'id' = p_tid;
  if zm is null or (select count(*) from jsonb_array_elements(coalesce(pl->'tables', '[]'::jsonb)) t where t->>'id' = any (ws)) <> cardinality(ws) then
    return jsonb_build_object('ok', false, 'error', 'no_table');
  end if;
  if exists (select 1 from jsonb_array_elements(pl->'tables') t where t->>'id' = any (ws) and coalesce(t->>'z', z1) <> zm) then
    return jsonb_build_object('ok', false, 'error', 'other_zone');
  end if;
  who := coalesce(c->>'who', '');
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into m from sa_seat where restaurant = rest and day = ld and tid = p_tid for update;
  if m.tid is null or m.status not in ('seat', 'bill', 'res') then return jsonb_build_object('ok', false, 'error', 'not_busy'); end if;
  if m.main is not null then return jsonb_build_object('ok', false, 'error', 'joined'); end if;
  -- приставить можно только свободный стол, ни к кому не приставленный
  select s.tid into w from sa_seat s where s.restaurant = rest and s.day = ld and s.tid = any (ws) and (s.status <> 'free' or s.main is not null)
   order by array_position(ws, s.tid) limit 1;
  if w is not null then return jsonb_build_object('ok', false, 'error', 'busy', 'tid', w); end if;
  if jsonb_array_length(coalesce(m.joined, '[]'::jsonb)) + cardinality(ws) > 6 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  insert into sa_seat (restaurant, day, tid, status, updated_by, updated_name, updated_at)
  select rest, ld, x, 'free', c->>'id', who, now() from unnest(ws) as x
  on conflict (restaurant, day, tid) do nothing;
  update sa_seat set joined = coalesce(joined, '[]'::jsonb) || to_jsonb(ws), updated_by = c->>'id', updated_name = who, updated_at = now()
   where restaurant = rest and day = ld and tid = p_tid;
  perform _sa_seat_follow(rest, ld, p_tid, c->>'id', who);
  return jsonb_build_object('ok', true, 'tables', _sa_seat_rows(rest, ld, array[p_tid] || ws));
end; $$;

create or replace function seat_unjoin(p_token text, p_tid text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; x sa_seat; ws text[]; mt text; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  who := coalesce(c->>'who', '');
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into x from sa_seat where restaurant = rest and day = ld and tid = p_tid for update;
  if x.tid is not null and x.main is not null then
    -- приставленный — только его
    mt := x.main; ws := array[p_tid];
    update sa_seat set joined = joined - p_tid, updated_by = c->>'id', updated_name = who, updated_at = now()
     where restaurant = rest and day = ld and tid = mt;
  elsif x.tid is not null and jsonb_array_length(coalesce(x.joined, '[]'::jsonb)) > 0 then
    -- главный — все его
    mt := p_tid; ws := array(select jsonb_array_elements_text(x.joined));
    update sa_seat set joined = '[]'::jsonb, updated_by = c->>'id', updated_name = who, updated_at = now()
     where restaurant = rest and day = ld and tid = mt;
  else
    return jsonb_build_object('ok', false, 'error', 'not_joined');
  end if;
  -- сидели гости — на уборку; бронь — свободны
  perform _sa_seat_reset(rest, ld, ws, case when x.status in ('seat', 'bill') then 'clean' else 'free' end, c->>'id', who);
  return jsonb_build_object('ok', true, 'tables', _sa_seat_rows(rest, ld, array[mt] || ws));
end; $$;

-- ── 7) Пересадить ──────────────────────────────────────────────────────────────
create or replace function seat_move(p_token text, p_from text, p_to text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; pl jsonb; a sa_seat; r sa_seat; src text; fn text; tn text; ws text[]; chat bigint; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  who := coalesce(c->>'who', '');
  ld := (now() at time zone _sa_tz(rest))::date;
  select plan into pl from sa_floor where restaurant = rest;
  select * into a from sa_seat where restaurant = rest and day = ld and tid = p_from for update;
  -- с приставленного — пересаживаем компанию главного
  src := coalesce(a.main, p_from);
  if a.main is not null then select * into a from sa_seat where restaurant = rest and day = ld and tid = src for update; end if;
  select t->>'n' into fn from jsonb_array_elements(coalesce(pl->'tables', '[]'::jsonb)) t where t->>'id' = src;
  select t->>'n' into tn from jsonb_array_elements(coalesce(pl->'tables', '[]'::jsonb)) t where t->>'id' = p_to;
  if fn is null or tn is null then return jsonb_build_object('ok', false, 'error', 'no_table'); end if;
  if a.tid is null or a.status not in ('seat', 'bill', 'res') then return jsonb_build_object('ok', false, 'error', 'not_busy'); end if;
  if p_to = src or coalesce(a.joined, '[]'::jsonb) ? p_to then return jsonb_build_object('ok', false, 'error', 'same'); end if;
  if exists (select 1 from sa_seat s where s.restaurant = rest and s.day = ld and s.tid = p_to and (s.status <> 'free' or s.main is not null)) then
    return jsonb_build_object('ok', false, 'error', 'busy', 'tid', p_to);
  end if;
  insert into sa_seat (restaurant, day, tid, status, cnt, name, rtime, since, waiter_id, waiter_name, main, joined, updated_by, updated_name, updated_at)
  values (rest, ld, p_to, a.status, a.cnt, a.name, a.rtime, a.since, a.waiter_id, a.waiter_name, null, '[]'::jsonb, c->>'id', who, now())
  on conflict (restaurant, day, tid) do update set status = excluded.status, cnt = excluded.cnt, name = excluded.name, rtime = excluded.rtime,
    since = excluded.since, waiter_id = excluded.waiter_id, waiter_name = excluded.waiter_name, main = null, joined = '[]'::jsonb,
    updated_by = excluded.updated_by, updated_name = excluded.updated_name, updated_at = now()
  returning * into r;
  -- старый стол и приставленные к нему: сидели гости — на уборку, бронь — свободны
  ws := array[src] || array(select jsonb_array_elements_text(coalesce(a.joined, '[]'::jsonb)));
  perform _sa_seat_reset(rest, ld, ws, case when a.status in ('seat', 'bill') then 'clean' else 'free' end, c->>'id', who);
  -- официанту — куда пересадили его гостей (себе — нет; бронь — без сообщения)
  if a.status in ('seat', 'bill') and a.waiter_id is not null and a.waiter_id <> c->>'id' and _sa_tg_ready() then
    chat := _sa_tg_chat(a.waiter_id, 'seat');
    if chat is not null then
      perform sa_tg_send(chat, 'Гостей со стола ' || fn || ' пересадили за стол ' || tn || '. Пересадил(а): ' || coalesce(nullif(who, ''), 'хостес') || '.',
        'Рассадка', 'seat');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'table', _sa_seat_json(r), 'tables', _sa_seat_rows(rest, ld, array[p_to] || ws));
end; $$;

-- ── 8) Лист ожидания ───────────────────────────────────────────────────────────
create or replace function wait_add(p_token text, p_name text, p_cnt int, p_note text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; w sa_wait; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if coalesce(p_cnt, 0) not between 1 and 40 or length(btrim(coalesce(p_name, ''))) > 40 or length(btrim(coalesce(p_note, ''))) > 60 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select count(*) into n from sa_wait where restaurant = rest and day = ld and done is null;
  if n >= 40 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  insert into sa_wait (restaurant, day, name, cnt, note, created_by, created_name)
  values (rest, ld, btrim(coalesce(p_name, '')), p_cnt, btrim(coalesce(p_note, '')), c->>'id', coalesce(c->>'who', ''))
  returning * into w;
  return jsonb_build_object('ok', true, 'item', _sa_wait_json(w));
end; $$;

create or replace function wait_done(p_token text, p_id bigint, p_how text, p_tid text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if coalesce(p_how, '') not in ('seat', 'left') then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  update sa_wait set done = p_how, done_tid = case when p_how = 'seat' then nullif(btrim(coalesce(p_tid, '')), '') end,
         done_by = c->>'id', done_at = now()
   where id = p_id and restaurant = rest and done is null;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end; $$;

-- ── 9) Права ───────────────────────────────────────────────────────────────────
grant execute on function floor_save(text, jsonb) to anon, authenticated;
grant execute on function seat_board(text) to anon, authenticated;
grant execute on function seat_set(text, text, text, int, text, text, text) to anon, authenticated;
grant execute on function seat_join(text, text, jsonb) to anon, authenticated;
grant execute on function seat_unjoin(text, text) to anon, authenticated;
grant execute on function seat_move(text, text, text) to anon, authenticated;
grant execute on function wait_add(text, text, int, text) to anon, authenticated;
grant execute on function wait_done(text, bigint, text, text) to anon, authenticated;
revoke all on function _sa_seat_json(sa_seat) from public, anon, authenticated;
revoke all on function _sa_wait_json(sa_wait) from public, anon, authenticated;
revoke all on function _sa_seat_rows(text, date, text[]) from public, anon, authenticated;
revoke all on function _sa_seat_reset(text, date, text[], text, text, text) from public, anon, authenticated;
revoke all on function _sa_seat_follow(text, date, text, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'объединение, пересадка, лист ожидания: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('seat_join', 'seat_unjoin', 'seat_move', 'wait_add', 'wait_done')) || ' функций из 5' ||
  ' · доска знает: ' || case when pg_get_functiondef('public.seat_board(text)'::regprocedure) like '%''seat2'', true%' then 'да' else 'НЕТ' end ||
  ' · стулья по сторонам: ' || case when pg_get_functiondef('public.floor_save(text,jsonb)'::regprocedure) like '%''sides''%' then 'да' else 'НЕТ' end ||
  ' · сдвиг стола: ' || case when pg_get_functiondef('public.floor_save(text,jsonb)'::regprocedure) like '%''ox''%' then 'да' else 'НЕТ' end ||
  ' · Telegram: ' || case when _sa_tg_ready() then 'бот на месте' else 'нет (доска работает, без сообщений)' end as result;
