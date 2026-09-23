-- ════════════════════════════════════════════════════════════════════════════
-- Этап 20д — «Разблокировать тесты»
--
-- Кнопка в «Управлении данными» зовёт admin_unlock_quiz. В проекте этой функции
-- нет (она упоминалась только в списке проверок этапа 17), поэтому запрос падал,
-- а приложение ошибку не показывало — выглядело как «кнопка не работает».
--
-- Функция убирает отметки о сдаче тестов у сотрудника: сами результаты (scores)
-- остаются как история, но тесты снова можно пройти. Поле, по которому в таблице
-- записан человек, определяется на месте — через _sa_wipe_person из этапа 20г.
--
-- Телефон сотрудника подхватит это при следующем запуске: приложение спрашивает
-- my_state (этап 20в) и приводит отметки в соответствие с сервером.
--
-- Требует этапы 20, 20в и 20г. Запускать в SQL Editor, повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function admin_unlock_quiz(p_token text, p_name text, p_surname text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare v jsonb; v_pos text; v_admin boolean; v_me text; who text; target text; uid text; n bigint;
begin
  v := _sa_who(p_token);
  if v is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_pos   := lower(coalesce(v->>'position', ''));
  v_admin := coalesce((v->>'is_admin')::boolean, false);
  v_me    := btrim(coalesce(v->>'name', '') || ' ' || coalesce(v->>'surname', ''));
  if not v_admin then
    begin
      select coalesce(e.is_admin, false) into v_admin from employees e
       where e.name = v->>'name' and coalesce(e.surname, '') = coalesce(v->>'surname', '') limit 1;
    exception when others then null; end;
  end if;
  who := btrim(coalesce(p_name, '') || ' ' || coalesce(p_surname, ''));
  if who = '' then return jsonb_build_object('ok', false, 'error', 'name'); end if;
  if not (coalesce(v_admin, false)
          or v_pos in ('manager', 'senior', 'owner', 'head', 'admin', 'service_manager')
          or who = v_me) then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'position', v_pos);
  end if;

  begin
    select e.restaurant, e.id::text into target, uid from employees e
     where e.name = p_name and coalesce(e.surname, '') = coalesce(p_surname, '') limit 1;
  exception when others then target := null; uid := null; end;
  target := coalesce(target, v->>'restaurant');

  n := _sa_wipe_person('quiz_done', uid, who, p_name, p_surname, target);
  return jsonb_build_object('ok', true, 'employee', who, 'rows', n);
end; $$;

grant execute on function admin_unlock_quiz(text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';

-- Проверка: функция на месте и сколько отметок о сдаче у сотрудника сейчас
select (select count(*) from pg_proc where proname = 'admin_unlock_quiz')                      as "функция (ожидаем 1)",
       (select count(*) from quiz_done qd
          join employees e on e.id::text = qd.user_id::text
         where e.name = 'Иван' and coalesce(e.surname, '') = 'Иванов')                          as "отметок у Ивана Иванова";
