-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 70 (Доп. 540): закрытые дни заведения в утренней сводке
--
-- Владелец: «Столкнулся с тем, что я в настройках не могу указать дни, в которые ресторан не работает. И из-за этого
-- правила графика мне выдают ошибку и дни, в которых мне не хватает сотрудников».
--
-- В приложении (v214) закрытый день задаётся двумя способами: каждую неделю (rules.closedDows в настройках заведения,
-- дни недели с понедельника, 0–6) и отдельной датой (пометка дня месяца days[d].closed: true закрывает дату, false
-- открывает день, который по неделе выходной). У закрытого дня уровень 0, потребности нет. Здесь то же для сводки
-- «Утро руководителя» (этап 40): _sa_mo_lvl возвращает 0, и _sa_mo_holes в закрытый день дыр не ищет, даже если в
-- графике стоит кейтеринг или уборка. Раньше в такой день сводка требовала полную смену.
--
-- Нужен этап 40. Безвреден повторно.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_mo_lvl(jsonb, jsonb, date)') is null then
    raise exception 'Сначала этап 40 (supabase-stage40-morning.sql): утренняя сводка';
  end if;
end $$;

-- уровень дня: 0 — закрыто, 1 — обычный, 2 — высокий, 3 — пиковый (lib/schedule-days.js dayLevel). Дни недели — с
-- понедельника (0) по воскресенье (6); праздники — федеральные с фиксированной датой, как HOLIDAYS в ui/schedule.jsx.
create or replace function _sa_mo_lvl(p_cfg jsonb, p_days jsonb, p_day date)
returns int language plpgsql immutable as $$
declare r jsonb := p_cfg->'rules'; lv int; l2 boolean := false; p text; a numeric; b numeric; c numeric;
  o jsonb := case when jsonb_typeof(p_days) = 'object' then p_days->(extract(day from p_day)::int::text) end;
  w int := extract(isodow from p_day)::int - 1; ol numeric;
begin
  -- закрыто: пометка даты главнее недели (банкет в выходной понедельник — открыто)
  if jsonb_typeof(o) = 'object' and jsonb_typeof(o->'closed') = 'boolean' then
    if (o->>'closed')::boolean then return 0; end if;
  elsif jsonb_typeof(r->'closedDows') = 'array' and (r->'closedDows') @> to_jsonb(w) then
    return 0;
  end if;
  if r->>'levels' in ('2', '3') then lv := (r->>'levels')::int;
  else
    foreach p in array _sa_mo_pos() loop
      a := _sa_num(p_cfg->'need'->'1'->>p); b := _sa_num(p_cfg->'need'->'2'->>p); c := _sa_num(p_cfg->'need'->'3'->>p);
      if b <> a and b <> c then l2 := true; end if;
    end loop;
    lv := case when l2 then 3 else 2 end;
  end if;
  ol := case when jsonb_typeof(o) = 'object' then _sa_num(o->>'lvl') else 0 end;
  if ol in (1, 2, 3) then return case when ol = 2 and lv = 2 then 3 else ol::int end; end if;
  if to_char(p_day, 'MM-DD') = any (array['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04'])
     and coalesce(r->>'holidayPeak', 'false') = 'true' then return 3; end if;
  if jsonb_typeof(r->'peakDows') = 'array' and (r->'peakDows') @> to_jsonb(w) then return 3; end if;
  if lv = 3 and jsonb_typeof(r->'highDows') = 'array' and (r->'highDows') @> to_jsonb(w) then return 2; end if;
  return 1;
end; $$;

revoke all on function _sa_mo_lvl(jsonb, jsonb, date) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'Закрытые дни в утренней сводке: _sa_mo_lvl знает closedDows и days[d].closed · заведений с выходными днями: '
  || (select count(*) from schedule_venues v where jsonb_typeof(v.config->'rules'->'closedDows') = 'array'
        and jsonb_array_length(v.config->'rules'->'closedDows') > 0) as result;
