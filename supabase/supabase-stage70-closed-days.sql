-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 70 (Доп. 540, 542): закрытые и особые дни заведения в утренней сводке
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
-- v216 (Доп. 542): «Особые дни» в настройках заведения — config.dates: { "ГГГГ-ММ-ДД": { closed, hours, lvl, need } }
-- (владелец: «ресторан не работает только 31 декабря и 1-го января. А 2-го не с 11, а с 16 ти работает»). Дата из
-- «Особых дней» главнее пометки дня в месяце, та — главнее дней недели; need — сколько людей нужно в этот день по
-- должностям, поверх обычной потребности (_sa_mo_holes).
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
  dd jsonb := case when jsonb_typeof(p_cfg->'dates') = 'object' then p_cfg->'dates'->to_char(p_day, 'YYYY-MM-DD') end;
  w int := extract(isodow from p_day)::int - 1; ol numeric;
begin
  -- закрыто: «Особые дни» главнее пометки в месяце, та — главнее недели (банкет в выходной понедельник — открыто)
  if jsonb_typeof(dd) = 'object' and jsonb_typeof(dd->'closed') = 'boolean' then
    if (dd->>'closed')::boolean then return 0; end if;
  elsif jsonb_typeof(o) = 'object' and jsonb_typeof(o->'closed') = 'boolean' then
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
  ol := case when jsonb_typeof(dd) = 'object' and _sa_num(dd->>'lvl') in (1, 2, 3) then _sa_num(dd->>'lvl')
             when jsonb_typeof(o) = 'object' then _sa_num(o->>'lvl') else 0 end;
  if ol in (1, 2, 3) then return case when ol = 2 and lv = 2 then 3 else ol::int end; end if;
  if to_char(p_day, 'MM-DD') = any (array['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04'])
     and coalesce(r->>'holidayPeak', 'false') = 'true' then return 3; end if;
  if jsonb_typeof(r->'peakDows') = 'array' and (r->'peakDows') @> to_jsonb(w) then return 3; end if;
  if lv = 3 and jsonb_typeof(r->'highDows') = 'array' and (r->'highDows') @> to_jsonb(w) then return 2; end if;
  return 1;
end; $$;

-- где в день p_day не хватает людей — как этап 40, плюс «Особые дни»: need даты поверх потребности уровня дня
create or replace function _sa_mo_holes(p_rest text, p_cfg jsonb, p_day date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare mk text := to_char(p_day, 'YYYY-MM'); dn text := extract(day from p_day)::int::text; pl jsonb; need jsonb; p text; n int; have int;
  out jsonb := '[]'::jsonb; staff jsonb := case when jsonb_typeof(p_cfg->'staff') = 'array' then p_cfg->'staff' else '[]'::jsonb end; dd jsonb;
begin
  if p_cfg is null then return out; end if;
  select m.payload into pl from schedule_months m where m.restaurant = p_rest and m.venue_key = 'main' and m.month = mk;
  if pl is null or jsonb_typeof(pl->'plan') is distinct from 'object' then return out; end if;
  if not exists (select 1 from jsonb_each(pl->'plan') e where jsonb_typeof(e.value) = 'object' and coalesce(e.value->>dn, '') <> '') then return out; end if;
  need := p_cfg->'need'->(_sa_mo_lvl(p_cfg, pl->'days', p_day)::text);
  if jsonb_typeof(need) is distinct from 'object' then return out; end if;
  dd := case when jsonb_typeof(p_cfg->'dates') = 'object' then p_cfg->'dates'->to_char(p_day, 'YYYY-MM-DD') end;
  if jsonb_typeof(dd) = 'object' and jsonb_typeof(dd->'need') = 'object' then need := need || (dd->'need'); end if;
  foreach p in array _sa_mo_pos() loop
    n := _sa_num(need->>p)::int;
    if n <= 0 then continue; end if;
    select count(*) into have from jsonb_array_elements(staff) s
     where jsonb_typeof(s) = 'object' and s->>'pos' = p
       and (coalesce(s->>'till', '') = '' or mk <= s->>'till') and (coalesce(s->>'since', '') = '' or mk >= s->>'since')
       and exists (select 1 from jsonb_array_elements(_sa_sh_defs(p_cfg)) x
                    where jsonb_typeof(x) = 'object' and x->>'k' = pl->'plan'->(s->>'id')->>dn and coalesce(x->>'extra', '') in ('', '0', 'false'));
    if have < n then out := out || jsonb_build_object('pos', p, 'miss', n - have); end if;
  end loop;
  return out;
end; $$;

revoke all on function _sa_mo_lvl(jsonb, jsonb, date), _sa_mo_holes(text, jsonb, date) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'Закрытые и особые дни в утренней сводке: _sa_mo_lvl знает closedDows, days[d].closed и dates · заведений с выходными днями: '
  || (select count(*) from schedule_venues v where jsonb_typeof(v.config->'rules'->'closedDows') = 'array'
        and jsonb_array_length(v.config->'rules'->'closedDows') > 0)
  || ' · с особыми днями: ' || (select count(*) from schedule_venues v where jsonb_typeof(v.config->'dates') = 'object' and v.config->'dates' <> '{}'::jsonb) as result;
