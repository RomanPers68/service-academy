-- supabase-stage14-achievements.sql — Этап 14: рекорды и ачивки команды (Дополнение 216).
-- Таблица рекордов: один рекорд на сотрудника и ключ. Ключи: sprint_best (больше — лучше),
-- rush_best (секунды, меньше — лучше), stamps (печати Сборки, больше), streak (серия дней, больше).
-- Пишет только владелец записи по своему токену; читает любой из ресторана (для Рейтинга).
-- Безвреден повторно.

create table if not exists achievements (
  employee_id uuid not null references employees(id) on delete cascade,
  key text not null,
  value numeric not null,
  updated_at timestamptz not null default now(),
  primary key (employee_id, key)
);
alter table achievements enable row level security; -- доступ только через функции ниже

create or replace function achievement_set(p_token text, p_key text, p_value numeric, p_better text default 'max')
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v jsonb; v_emp uuid; v_old numeric;
begin
  v := whoami_txt(p_token);
  if coalesce((v->>'ok')::boolean, false) is not true then return json_build_object('ok', false, 'error', 'auth'); end if;
  v_emp := (v->'employee'->>'id')::uuid;
  if p_key not in ('sprint_best', 'rush_best', 'stamps', 'streak') then return json_build_object('ok', false, 'error', 'bad_key'); end if;
  select value into v_old from achievements where employee_id = v_emp and key = p_key;
  if v_old is null or (p_better = 'min' and p_value < v_old) or (p_better <> 'min' and p_value > v_old) then
    insert into achievements (employee_id, key, value, updated_at) values (v_emp, p_key, p_value, now())
    on conflict (employee_id, key) do update set value = excluded.value, updated_at = now();
    return json_build_object('ok', true, 'record', true, 'value', p_value);
  end if;
  return json_build_object('ok', true, 'record', false, 'value', v_old);
end $$;

create or replace function achievements_list(p_restaurant text)
returns json language sql security definer set search_path to 'public', 'extensions' as $$
  select coalesce(json_agg(json_build_object('name', e.name, 'surname', e.surname, 'position', e.position, 'key', a.key, 'value', a.value, 'at', a.updated_at)), '[]'::json)
  from achievements a join employees e on e.id = a.employee_id
  where e.restaurant = p_restaurant and e.status = 'active';
$$;

grant execute on function achievement_set(text, text, numeric, text) to anon, authenticated;
grant execute on function achievements_list(text) to anon, authenticated;

select 'achievements: ' || (select count(*) from achievements) || ' записей · функции: ' ||
       (select count(*) from pg_proc where proname in ('achievement_set','achievements_list')) || ' из 2' as result;
