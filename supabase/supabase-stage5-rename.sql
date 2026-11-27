-- supabase-stage5-rename.sql
-- Редактирование имени и фамилии сотрудника из экрана «Команда».
-- Применить: Supabase → SQL Editor → вставить и выполнить.
--
-- Доп. 529: здесь версия из рабочей базы. Первая версия этого файла меняла имя без проверки,
-- кто зовёт; в базе её давно заменили на эту — с проверкой токена и прав руководителя
-- (ошибки по шагам: token, whoami, auth, rights, validate, update).

create or replace function admin_update_employee(
  p_token text, p_employee_id uuid, p_name text, p_surname text
) returns json
language plpgsql security definer set search_path to public as $$
DECLARE
  v_tok uuid;
  v jsonb;
  v_name text;
  v_surname text;
BEGIN
  BEGIN
    v_tok := p_token::uuid;
  EXCEPTION WHEN others THEN
    RETURN json_build_object('ok', false, 'error', 'токен не uuid', 'step', 'token');
  END;

  BEGIN
    v := to_jsonb(whoami(v_tok));
  EXCEPTION WHEN others THEN
    RETURN json_build_object('ok', false, 'error', 'whoami: ' || SQLERRM, 'step', 'whoami');
  END;

  IF coalesce((v->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN json_build_object('ok', false, 'error', 'сессия не подтверждена', 'step', 'auth');
  END IF;
  IF coalesce((v->'employee'->>'is_admin')::boolean, false) IS NOT TRUE THEN
    RETURN json_build_object('ok', false, 'error', 'нет прав администратора', 'step', 'rights');
  END IF;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  v_surname := trim(coalesce(p_surname, ''));
  IF v_name IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'пустое имя', 'step', 'validate');
  END IF;

  BEGIN
    UPDATE public.employees
       SET name = v_name,
           surname = v_surname
     WHERE id = p_employee_id;
  EXCEPTION WHEN others THEN
    RETURN json_build_object('ok', false, 'error', 'update: ' || SQLERRM, 'step', 'update');
  END;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'сотрудник с таким id не найден', 'step', 'update');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;
