-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 72 (Доп. 542): сколько людей нужно по дням недели, в утренней сводке
--
-- В «Сколько людей нужно» (раздел 3 настроек графика, v216) теперь два способа. По типу дня — как было: обычный,
-- высокий, пиковый (config.need по уровню). По дням недели — своё число на каждый день: rules.needMode = 'dows',
-- config.needDow = { должность: [пн, вт, ср, чт, пт, сб, вс] }. Пятница и суббота у многих разные, а тип дня у них
-- один, «пик».
--
-- Здесь то же для «Утра руководителя» (этап 40): _sa_mo_holes берёт потребность дня недели. Закрытый день (уровень 0
-- из _sa_mo_lvl, этап 70) — без дыр; своё число людей из «Особых дней» (dates[день].need) — поверх, как в этапе 70.
-- По типу дня сводка считает как раньше.
--
-- Нужен этап 70. Безвреден повторно.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_mo_holes(text, jsonb, date)') is null or to_regprocedure('public._sa_mo_lvl(jsonb, jsonb, date)') is null
     or not exists (select 1 from pg_proc where proname = '_sa_mo_lvl' and prosrc like '%closedDows%') then
    raise exception 'Сначала этап 70 (supabase-stage70-closed-days.sql): закрытые и особые дни';
  end if;
end $$;

-- сколько людей нужно в день p_day по должностям: по дням недели или по типу дня, «Особые дни» поверх. Закрыто — {}
create or replace function _sa_mo_need(p_cfg jsonb, p_days jsonb, p_day date)
returns jsonb language plpgsql immutable as $$
declare lv int := _sa_mo_lvl(p_cfg, p_days, p_day); w int := extract(isodow from p_day)::int - 1; nd jsonb := p_cfg->'needDow';
  need jsonb := '{}'::jsonb; p text; dd jsonb;
begin
  if lv = 0 then return need; end if;
  if p_cfg->'rules'->>'needMode' = 'dows' and jsonb_typeof(nd) = 'object' then
    foreach p in array _sa_mo_pos() loop
      if jsonb_typeof(nd->p) = 'array' and _sa_num(nd->p->>w) > 0 then need := need || jsonb_build_object(p, _sa_num(nd->p->>w)::int); end if;
    end loop;
  elsif jsonb_typeof(p_cfg->'need'->(lv::text)) = 'object' then
    need := p_cfg->'need'->(lv::text);
  end if;
  dd := case when jsonb_typeof(p_cfg->'dates') = 'object' then p_cfg->'dates'->to_char(p_day, 'YYYY-MM-DD') end;
  if jsonb_typeof(dd) = 'object' and jsonb_typeof(dd->'need') = 'object' then need := need || (dd->'need'); end if;   -- в скобках: || и -> равны по старшинству
  return need;
end; $$;

-- где в день p_day не хватает людей — как этап 70, потребность — из _sa_mo_need
create or replace function _sa_mo_holes(p_rest text, p_cfg jsonb, p_day date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare mk text := to_char(p_day, 'YYYY-MM'); dn text := extract(day from p_day)::int::text; pl jsonb; need jsonb; p text; n int; have int;
  out jsonb := '[]'::jsonb; staff jsonb := case when jsonb_typeof(p_cfg->'staff') = 'array' then p_cfg->'staff' else '[]'::jsonb end;
begin
  if p_cfg is null then return out; end if;
  select m.payload into pl from schedule_months m where m.restaurant = p_rest and m.venue_key = 'main' and m.month = mk;
  if pl is null or jsonb_typeof(pl->'plan') is distinct from 'object' then return out; end if;
  if not exists (select 1 from jsonb_each(pl->'plan') e where jsonb_typeof(e.value) = 'object' and coalesce(e.value->>dn, '') <> '') then return out; end if;
  need := _sa_mo_need(p_cfg, pl->'days', p_day);
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

revoke all on function _sa_mo_need(jsonb, jsonb, date), _sa_mo_holes(text, jsonb, date) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'Люди по дням недели в утренней сводке: _sa_mo_need · заведений, где считают по дням недели: '
  || (select count(*) from schedule_venues v where v.config->'rules'->>'needMode' = 'dows' and jsonb_typeof(v.config->'needDow') = 'object') as result;
