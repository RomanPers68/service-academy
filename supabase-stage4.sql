-- supabase-stage4.sql — Этап 4: общее меню ресторана + «кто выучил новинки».
-- Версия под вашу базу: связка токен→сотрудник через вашу же функцию whoami(p_token),
-- которой приложение уже пользуется при входе. Ничего адаптировать не нужно.

create table if not exists restaurant_menu (
  restaurant text primary key,
  dishes jsonb not null default '[]',
  updated_by text,
  updated_at timestamptz default now()
);

create or replace function menu_get(p_restaurant text)
returns jsonb language sql stable as $$
  select coalesce((select dishes from restaurant_menu
    where restaurant = p_restaurant), '[]'::jsonb);
$$;

create or replace function menu_set(p_token text, p_restaurant text, p_dishes text)
returns json language plpgsql security definer as $$
declare v jsonb; v_employee text;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  v_employee := trim((v->'employee'->>'name') || ' ' || coalesce(v->'employee'->>'surname', ''));

  insert into restaurant_menu (restaurant, dishes, updated_by, updated_at)
  values (p_restaurant, p_dishes::jsonb, v_employee, now())
  on conflict (restaurant) do update
    set dishes = excluded.dishes,
        updated_by = excluded.updated_by,
        updated_at = now();
  return json_build_object('ok', true);
end; $$;

create table if not exists menu_progress (
  id bigserial primary key,
  restaurant text not null,
  employee text not null,
  wave text not null,
  status text not null check (status in ('opened','passed')),
  score int,
  ts timestamptz default now(),
  unique (restaurant, employee, wave, status)
);

create or replace function menu_progress_set(p_token text, p_restaurant text,
  p_wave text, p_status text, p_score int)
returns json language plpgsql security definer as $$
declare v jsonb; v_employee text;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  v_employee := trim((v->'employee'->>'name') || ' ' || coalesce(v->'employee'->>'surname', ''));

  insert into menu_progress (restaurant, employee, wave, status, score)
  values (p_restaurant, v_employee, p_wave, p_status, p_score)
  on conflict (restaurant, employee, wave, status)
    do update set ts = now(), score = excluded.score;
  return json_build_object('ok', true);
end; $$;

create or replace function menu_progress_list(p_restaurant text)
returns table (employee text, status text, score int, ts timestamptz, wave text)
language sql stable as $$
  with latest_wave as (
    select max(wave) w from menu_progress where restaurant = p_restaurant
  )
  select distinct on (mp.employee)
    mp.employee, mp.status, mp.score, mp.ts, mp.wave
  from menu_progress mp, latest_wave lw
  where mp.restaurant = p_restaurant and mp.wave = lw.w
  order by mp.employee, (mp.status = 'passed') desc, mp.ts desc;
$$;
