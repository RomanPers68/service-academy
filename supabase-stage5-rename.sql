-- supabase-stage5-rename.sql
-- Редактирование имени и фамилии сотрудника из экрана «Команда».
-- Применить: Supabase → SQL Editor → вставить и выполнить.
--
-- ⚠️ Предположение: таблица сотрудников называется employees и содержит
-- колонки id, name, surname (как в admin_list_employees). Если у тебя
-- таблица называется иначе — поправь имя в двух местах ниже.

create or replace function admin_update_employee(
  p_token text, p_employee_id uuid, p_name text, p_surname text
) returns json
language plpgsql security definer as $$
begin
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) < 2 then
    return json_build_object('ok', false, 'error', 'bad_name');
  end if;

  update employees
     set name = trim(p_name),
         surname = trim(coalesce(p_surname, ''))
   where id = p_employee_id;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  return json_build_object('ok', true);
end;
$$;

-- Если id сотрудника не uuid, а bigint — замени тип параметра:
-- create or replace function admin_update_employee(
--   p_token text, p_employee_id bigint, p_name text, p_surname text
-- ) ...
