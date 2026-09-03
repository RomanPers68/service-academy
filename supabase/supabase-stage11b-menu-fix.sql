-- supabase-stage11b-menu-fix.sql — заплатка к Этапу 11 (Дополнение 141).
-- После замка (stage11) меню команды не грузилось: «permission denied for table
-- restaurant_menu». Причина: menu_get и menu_progress_list были единственными
-- функциями без security definer — работали от имени anon и упёрлись в RLS.
-- Пересоздаём их как security definer, тела не менялись. Безвреден повторно.

create or replace function menu_get(p_restaurant text)
returns jsonb language sql stable security definer as $$
  select coalesce((select dishes from restaurant_menu
    where restaurant = p_restaurant), '[]'::jsonb);
$$;

create or replace function menu_progress_list(p_restaurant text)
returns table (employee text, status text, score int, ts timestamptz, wave text)
language sql stable security definer as $$
  with latest_wave as (
    select max(wave) w from menu_progress where restaurant = p_restaurant
  )
  select distinct on (mp.employee)
    mp.employee, mp.status, mp.score, mp.ts, mp.wave
  from menu_progress mp, latest_wave lw
  where mp.restaurant = p_restaurant and mp.wave = lw.w
  order by mp.employee, (mp.status = 'passed') desc, mp.ts desc;
$$;

-- Диагностика: какие ещё функции public работают БЕЗ security definer.
-- В репозитории таких больше нет; если список не пуст — это функции старых этапов,
-- которых нет в архиве. Пришли список разработчику — сделаем такую же заплатку.
select 'без security definer: ' || coalesce(string_agg(p.proname, ', ' order by p.proname), '— (всё в порядке)') as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and not p.prosecdef and p.prokind = 'f'
  and p.proname not like 'pg_%';
