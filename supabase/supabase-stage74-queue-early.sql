-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 74 (Доп. 544): очередь к столам и до начала смены
--
-- После этапа 73 очередь пропускала тех, у кого смена по графику кончилась. А в живой очереди с утра стоял вечерний
-- официант (смена с 17:00, добавили раньше), и до 17:00 «Занят, передать дальше» всё ещё мог отдать стол ему — то, о
-- чём спрашивал владелец: «он не будет давать стол человеку которого нет в период с 11 до 17?».
--
-- Теперь вне смены по графику — и до неё: кто в очереди, а смена начнётся больше чем через полчаса, следующим не
-- становится, пока хостес не отметит «Пришёл» (here у записи очереди). Полчаса — запас на подготовку зала: в 16:30
-- вечерний уже в зале. Приложение ставит «Пришёл» само, когда хостес добавляет человека из «Позже по графику».
-- _sa_queue_over — «вне смены сейчас»: кончилась (и не «Остался») или ещё рано (и не «Пришёл»).
--
-- Нужен этап 73. Безвреден повторно.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_queue_hrs(text,text)') is null then
    raise exception 'Сначала этап 73 (supabase-stage73-queue-hours.sql): очередь по часам смены';
  end if;
end $$;

-- вне смены по графику сейчас: кончилась и не «Остался», или начнётся больше чем через полчаса и не «Пришёл»
create or replace function _sa_queue_over(p_rest text, e jsonb, m int)
returns boolean language sql stable security definer set search_path to public as $$
  select coalesce((not coalesce(e->>'stay' = 'true', false) and (z.h->>'to')::int * 60 <= m)
      or (not coalesce(e->>'here' = 'true', false) and (z.h->>'from')::int * 60 - 30 > m), false)
    from (select _sa_queue_hrs(p_rest, e->>'id') as h) z
$$;

-- очередь дня — как этап 73, у записи ещё here («Пришёл» до смены)
create or replace function _sa_queue_ord(p_rest text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare d date := _sa_queue_day(p_rest); q jsonb; nq jsonb;
begin
  insert into sa_queue (restaurant, day) values (p_rest, d) on conflict (restaurant, day) do nothing;
  select ord into q from sa_queue where restaurant = p_rest and day = d for update;
  with cur as (
    select x.e, x.o, row_number() over (partition by x.e->>'id' order by x.o) as k
      from jsonb_array_elements(q) with ordinality x(e, o) where _sa_queue_waiter(p_rest, x.e->>'id')
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', cur.e->>'id', 'away', coalesce(cur.e->>'away' = 'true', false),
           'out', coalesce(cur.e->>'out' = 'true', false), 'stay', coalesce(cur.e->>'stay' = 'true', false),
           'here', coalesce(cur.e->>'here' = 'true', false)) order by cur.o), '[]'::jsonb)
    into nq from cur where cur.k = 1;
  if nq is distinct from q then
    update sa_queue set ord = nq, updated_at = now() where restaurant = p_rest and day = d;
  end if;
  delete from sa_queue where restaurant = p_rest and day < d - 7;
  return nq;
end; $$;

-- в конец или первым — как этап 73; «Остался» и «Пришёл» не теряются
create or replace function _sa_queue_move(p_rest text, p_emp text, p_first boolean)
returns void language plpgsql volatile security definer set search_path to public as $$
declare q jsonb; others jsonb; e jsonb;
begin
  if p_emp is null or not _sa_queue_waiter(p_rest, p_emp) then return; end if;
  q := _sa_queue_ord(p_rest);
  select x into e from jsonb_array_elements(q) x where x->>'id' = p_emp limit 1;
  if e is null then return; end if;
  e := jsonb_build_object('id', p_emp, 'away', false, 'out', false, 'stay', coalesce(e->>'stay' = 'true', false), 'here', coalesce(e->>'here' = 'true', false));
  select coalesce(jsonb_agg(x.e order by x.o), '[]'::jsonb) into others from jsonb_array_elements(q) with ordinality x(e, o) where x.e->>'id' <> p_emp;
  update sa_queue set ord = case when p_first then jsonb_build_array(e) || others else others || jsonb_build_array(e) end, updated_at = now()
   where restaurant = p_rest and day = _sa_queue_day(p_rest);
end; $$;

-- ответ очереди — как этап 73, у записи ещё here
create or replace function _sa_queue_json(c jsonb, p_rest text, q jsonb)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('ok', true, 'day', _sa_queue_day(p_rest), 'edit', _sa_queue_can(c), 'min', _sa_queue_now(p_rest),
    'list', coalesce((select jsonb_agg(jsonb_build_object('id', x.e->>'id', 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
        'away', coalesce(x.e->>'away' = 'true', false), 'out', coalesce(x.e->>'out' = 'true', false), 'stay', coalesce(x.e->>'stay' = 'true', false),
        'here', coalesce(x.e->>'here' = 'true', false))
        || coalesce(_sa_queue_hrs(p_rest, x.e->>'id'), '{}'::jsonb) order by x.o)
      from jsonb_array_elements(q) with ordinality x(e, o) join employees e on e.id::text = x.e->>'id'), '[]'::jsonb),
    'others', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.nm, 'from', w.h->'from', 'to', w.h->'to')
        order by w.h->'from' is null, (w.h->>'from')::int, w.nm, w.id)
      from (select e.id::text as id, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) as nm, _sa_queue_hrs(p_rest, e.id::text) as h
              from employees e where e.restaurant is not distinct from p_rest and coalesce(e.status, 'active') = 'active'
               and _sa_queue_waiter(p_rest, e.id::text)
               and not exists (select 1 from jsonb_array_elements(q) y where y->>'id' = e.id::text)) w), '[]'::jsonb))
$$;

-- изменить очередь — как этап 73; p_ord — [{ id, away, out, stay, here }]
create or replace function queue_set(p_token text, p_ord jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; q jsonb; nq jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if not _sa_queue_can(c) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if jsonb_typeof(p_ord) is distinct from 'array' or jsonb_array_length(p_ord) > 80 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  q := _sa_queue_ord(rest);
  with x as (
    select y.e, y.o, row_number() over (partition by y.e->>'id' order by y.o) as k
      from jsonb_array_elements(p_ord) with ordinality y(e, o)
     where jsonb_typeof(y.e) = 'object' and _sa_queue_waiter(rest, y.e->>'id')
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', x.e->>'id', 'away', coalesce(x.e->>'away' = 'true', false), 'out', coalesce(x.e->>'out' = 'true', false),
           'stay', coalesce(x.e->>'stay' = 'true', false), 'here', coalesce(x.e->>'here' = 'true', false)) order by x.o), '[]'::jsonb)
    into nq from x where x.k = 1;
  nq := nq || coalesce((select jsonb_agg(y.e order by y.o) from jsonb_array_elements(q) with ordinality y(e, o)
          where not exists (select 1 from jsonb_array_elements(nq) z where z->>'id' = y.e->>'id')), '[]'::jsonb);
  update sa_queue set ord = nq, updated_at = now(), updated_by = c->>'id' where restaurant = rest and day = _sa_queue_day(rest);
  return _sa_queue_json(c, rest, nq);
end; $$;

revoke all on function _sa_queue_over(text, jsonb, int), _sa_queue_ord(text), _sa_queue_move(text, text, boolean), _sa_queue_json(jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function queue_set(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

select 'Очередь до начала смены: «Пришёл», вне смены по графику столы не идут · очередей за сутки: '
  || (select count(*) from sa_queue where day >= current_date - 1) as result;
