-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 73 (Доп. 543): очередь к столам по часам смены из графика
--
-- Владелец: «Он же учитывает в очереди людей, которые работают с вечера? Имею ввиду он не будет давать стол человеку
-- которого нет в период с 11 до 17? В общем он будет опираться на часы работы официанта, смотря на график?».
--
-- Очередь (этапы 69 и 71) знала только начало смены, и то для подсказки хостес. Теперь у каждого в ответе queue_get —
-- часы смены сегодня по графику (from, to; после полуночи — 25, 26), «Остался» (stay) и min — минуты дня заведения
-- сейчас. Смена по графику кончилась — следующим его не подсвечиваем и «Занят, передать дальше» его пропускает
-- (_sa_queue_next), пока хостес не отметит «Остался» (на продление). Позвали к столу или посадили гостей — «Остался»
-- сохраняется. Кто ещё не пришёл (вечерние), в очередь сам не встаёт: приложение ставит «Все, кто на смене» только
-- тех, у кого смена началась, а вечерних хостес добавляет, когда пришли.
--
-- День заведения теперь меняется в 6 утра, а не в полночь: бар до двух ночи — всё ещё «сегодня», очередь не обнуляется
-- в 00:00 посреди смены, и часы смены «до 2:00» (26) сравниваются с минутами того же дня (после полуночи — 1440 и
-- дальше).
--
-- Нужен этап 71. Безвреден повторно.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_queue_waiter(text,text)') is null
     or not exists (select 1 from pg_proc where proname = '_sa_queue_waiter' and prosrc like '%_sa_sh_staff%') then
    raise exception 'Сначала этап 71 (supabase-stage71-queue-by-schedule.sql): официанты в очереди по графику';
  end if;
end $$;

-- день заведения: с 6 утра до 6 утра следующего дня
create or replace function _sa_queue_day(p_rest text)
returns date language sql stable security definer set search_path to public as $$
  select ((now() at time zone _sa_tz(p_rest)) - interval '6 hours')::date
$$;

-- минуты дня заведения сейчас, от его полуночи: в 14:30 — 870, после полуночи в 1:15 — 1515
create or replace function _sa_queue_now(p_rest text)
returns int language sql stable security definer set search_path to public as $$
  select floor(extract(epoch from (now() at time zone _sa_tz(p_rest)) - _sa_queue_day(p_rest)::timestamp) / 60)::int
$$;

-- часы смены сегодня по графику: { from, to }, to после полуночи — 25, 26; не в графике, выходной, кейтеринг — null
create or replace function _sa_queue_hrs(p_rest text, p_emp text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare cfg jsonb := _sa_sh_cfg(p_rest); d date := _sa_queue_day(p_rest); s jsonb; def jsonb; f int; t int;
begin
  if cfg is null then return null; end if;
  s := _sa_sh_staff(cfg, p_emp, to_char(d, 'YYYY-MM'));
  if s is null then return null; end if;
  def := _sa_sh_def(cfg, _sa_sh_code(p_rest, s->>'id', d));
  if def is null or coalesce(def->>'extra', '') in ('1', 'true') or coalesce(def->>'from', '') !~ '^[0-9]{1,2}$' then return null; end if;
  f := (def->>'from')::int;
  t := case when coalesce(def->>'to', '') ~ '^[0-9]{1,2}$' then (def->>'to')::int end;
  if t is not null and t <= f then t := t + 24; end if;
  return jsonb_build_object('from', f, 'to', t);
end; $$;

-- начало смены сегодня (подсказка хостес «с 16:00») — как в этапе 69, через _sa_queue_hrs
create or replace function _sa_queue_from(p_rest text, p_emp text)
returns int language sql stable security definer set search_path to public as $$
  select (_sa_queue_hrs(p_rest, p_emp)->>'from')::int
$$;

-- смена по графику кончилась и хостес не отметила «Остался»: e — запись очереди, m — минуты дня заведения
create or replace function _sa_queue_over(p_rest text, e jsonb, m int)
returns boolean language sql stable security definer set search_path to public as $$
  select not coalesce(e->>'stay' = 'true', false) and coalesce((_sa_queue_hrs(p_rest, e->>'id')->>'to')::int * 60 <= m, false)
$$;

-- очередь дня — как этап 69, у записи ещё stay («Остался» после смены)
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
           'out', coalesce(cur.e->>'out' = 'true', false), 'stay', coalesce(cur.e->>'stay' = 'true', false)) order by cur.o), '[]'::jsonb)
    into nq from cur where cur.k = 1;
  if nq is distinct from q then
    update sa_queue set ord = nq, updated_at = now() where restaurant = p_rest and day = d;
  end if;
  delete from sa_queue where restaurant = p_rest and day < d - 7;
  return nq;
end; $$;

-- в конец или первым — как этап 69; «Остался» не теряется
create or replace function _sa_queue_move(p_rest text, p_emp text, p_first boolean)
returns void language plpgsql volatile security definer set search_path to public as $$
declare q jsonb; others jsonb; e jsonb;
begin
  if p_emp is null or not _sa_queue_waiter(p_rest, p_emp) then return; end if;
  q := _sa_queue_ord(p_rest);
  select x into e from jsonb_array_elements(q) x where x->>'id' = p_emp limit 1;
  if e is null then return; end if;
  e := jsonb_build_object('id', p_emp, 'away', false, 'out', false, 'stay', coalesce(e->>'stay' = 'true', false));
  select coalesce(jsonb_agg(x.e order by x.o), '[]'::jsonb) into others from jsonb_array_elements(q) with ordinality x(e, o) where x.e->>'id' <> p_emp;
  update sa_queue set ord = case when p_first then jsonb_build_array(e) || others else others || jsonb_build_array(e) end, updated_at = now()
   where restaurant = p_rest and day = _sa_queue_day(p_rest);
end; $$;

-- следующий в очереди: не на перерыве, не убран, не из p_skip и смена по графику не кончилась (или «Остался»)
create or replace function _sa_queue_next(p_rest text, p_skip text[])
returns text language sql volatile security definer set search_path to public as $$
  select x.e->>'id' from jsonb_array_elements(_sa_queue_ord(p_rest)) with ordinality x(e, o)
   where not coalesce(x.e->>'away' = 'true', false) and not coalesce(x.e->>'out' = 'true', false)
     and not (x.e->>'id' = any(coalesce(p_skip, array[]::text[])))
     and not _sa_queue_over(p_rest, x.e, _sa_queue_now(p_rest))
   order by x.o limit 1
$$;

-- ответ очереди — как этап 71, плюс часы смены (from, to), «Остался» и минуты дня заведения (min)
create or replace function _sa_queue_json(c jsonb, p_rest text, q jsonb)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('ok', true, 'day', _sa_queue_day(p_rest), 'edit', _sa_queue_can(c), 'min', _sa_queue_now(p_rest),
    'list', coalesce((select jsonb_agg(jsonb_build_object('id', x.e->>'id', 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
        'away', coalesce(x.e->>'away' = 'true', false), 'out', coalesce(x.e->>'out' = 'true', false), 'stay', coalesce(x.e->>'stay' = 'true', false))
        || coalesce(_sa_queue_hrs(p_rest, x.e->>'id'), '{}'::jsonb) order by x.o)
      from jsonb_array_elements(q) with ordinality x(e, o) join employees e on e.id::text = x.e->>'id'), '[]'::jsonb),
    'others', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.nm, 'from', w.h->'from', 'to', w.h->'to')
        order by w.h->'from' is null, (w.h->>'from')::int, w.nm, w.id)
      from (select e.id::text as id, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) as nm, _sa_queue_hrs(p_rest, e.id::text) as h
              from employees e where e.restaurant is not distinct from p_rest and coalesce(e.status, 'active') = 'active'
               and _sa_queue_waiter(p_rest, e.id::text)
               and not exists (select 1 from jsonb_array_elements(q) y where y->>'id' = e.id::text)) w), '[]'::jsonb))
$$;

-- изменить очередь — как этап 69; p_ord — [{ id, away, out, stay }]
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
           'stay', coalesce(x.e->>'stay' = 'true', false)) order by x.o), '[]'::jsonb)
    into nq from x where x.k = 1;
  nq := nq || coalesce((select jsonb_agg(y.e order by y.o) from jsonb_array_elements(q) with ordinality y(e, o)
          where not exists (select 1 from jsonb_array_elements(nq) z where z->>'id' = y.e->>'id')), '[]'::jsonb);
  update sa_queue set ord = nq, updated_at = now(), updated_by = c->>'id' where restaurant = rest and day = _sa_queue_day(rest);
  return _sa_queue_json(c, rest, nq);
end; $$;

revoke all on function _sa_queue_day(text), _sa_queue_now(text), _sa_queue_hrs(text, text), _sa_queue_from(text, text), _sa_queue_over(text, jsonb, int),
  _sa_queue_ord(text), _sa_queue_move(text, text, boolean), _sa_queue_next(text, text[]), _sa_queue_json(jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function queue_set(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

select 'Очередь по часам смены: from, to, «Остался», день заведения с 6 утра · очередей за сутки: '
  || (select count(*) from sa_queue where day >= current_date - 1) as result;
