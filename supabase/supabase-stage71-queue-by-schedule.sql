-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 71 (Доп. 542): в очереди к столам — кто официант по графику, а не по должности в приложении
--
-- Владелец: «По поводу очереди. Он не видит меня, хотя я на смене. И почему то добавляет в выбор очереди Раннера.
-- Хотя раннер со столами не работает, он только помогает».
--
-- Очередь (этап 69) брала официантов по должности в приложении (employees.position = 'waiter'). А в графике у людей
-- своя роль на месяц: старший и менеджер выходят в зал официантами, официант по должности месяц работает раннером.
-- Теперь главное — график: в графике месяца официант — в очереди; раннер, бар, хостес, менеджер — нет. Кого в графике
-- нет совсем, решает должность в приложении, как раньше. Строка графика — по словам имени (_sa_sh_staff, этап 38).
-- Кто уже стоит в сегодняшней очереди, а по графику не официант, уходит из неё при следующем открытии.
--
-- Нужен этап 69. Безвреден повторно.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_queue_from(text,text)') is null then
    raise exception 'Сначала этап 69 (supabase-stage69-waiter-queue.sql): очередь официантов';
  end if;
end $$;

-- официант для очереди: по графику месяца, а если в графике его нет — по должности в приложении
create or replace function _sa_queue_waiter(p_rest text, p_emp text)
returns boolean language plpgsql stable security definer set search_path to public as $$
declare pos text; sp text; cfg jsonb;
begin
  select lower(coalesce(e.position, '')) into pos from employees e
   where e.id::text = p_emp and e.restaurant is not distinct from p_rest and coalesce(e.status, 'active') = 'active';
  if pos is null then return false; end if;
  cfg := _sa_sh_cfg(p_rest);
  if cfg is not null then
    sp := lower(coalesce(_sa_sh_staff(cfg, p_emp, to_char(_sa_queue_day(p_rest), 'YYYY-MM'))->>'pos', ''));
  end if;
  if coalesce(sp, '') <> '' then return sp = 'waiter'; end if;
  return pos = 'waiter';
end; $$;

-- ответ очереди — как этап 69; others — официанты по тому же правилу (график, потом должность)
create or replace function _sa_queue_json(c jsonb, p_rest text, q jsonb)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('ok', true, 'day', _sa_queue_day(p_rest), 'edit', _sa_queue_can(c),
    'list', coalesce((select jsonb_agg(jsonb_build_object('id', x.e->>'id', 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
        'away', coalesce(x.e->>'away' = 'true', false), 'out', coalesce(x.e->>'out' = 'true', false)) order by x.o)
      from jsonb_array_elements(q) with ordinality x(e, o) join employees e on e.id::text = x.e->>'id'), '[]'::jsonb),
    'others', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.nm, 'from', w.f) order by w.f is null, w.f, w.nm, w.id)
      from (select e.id::text as id, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) as nm, _sa_queue_from(p_rest, e.id::text) as f
              from employees e where e.restaurant is not distinct from p_rest and coalesce(e.status, 'active') = 'active'
               and _sa_queue_waiter(p_rest, e.id::text)
               and not exists (select 1 from jsonb_array_elements(q) y where y->>'id' = e.id::text)) w), '[]'::jsonb))
$$;

revoke all on function _sa_queue_waiter(text, text), _sa_queue_json(jsonb, text, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'Очередь по графику: официант — по роли в графике месяца, без графика — по должности · официантов в очередях сегодня: '
  || (select coalesce(sum(jsonb_array_length(ord)), 0) from sa_queue where day >= current_date - 1) as result;
