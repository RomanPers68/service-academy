-- ════════════════════════════════════════════════════════════════════════════
-- Этап 20в — «мой прогресс» одним ответом
--
-- Приложение читает прогресс прямо из таблиц ключом anon. Такой запрос не
-- различает «сервер сказал: пусто» и «сервер не отдал данные» (например, если
-- политика доступа закрыла таблицу — PostgREST вернёт пустой список и код 200).
-- Поэтому в коде стоит защита «пришёл пустой список — не обнуляем». Она спасает
-- от сбоев, но из-за неё:
--   • «Открыть тест заново» не срабатывает, если этот тест был у сотрудника
--     единственным сданным;
--   • любое точечное удаление на сервере не доходит до телефона.
--
-- Функция my_state(p_token) отвечает по токену: список сданных тестов и
-- пройденных уроков. Пустой список здесь означает именно «пусто», и приложение
-- может спокойно привести телефон в соответствие.
--
-- Запускать в SQL Editor. Повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function my_state(p_token text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v jsonb; uid text; quiz jsonb := '[]'::jsonb; lessons jsonb := '[]'::jsonb;
begin
  v := _sa_who(p_token);                                  -- из этапа 20
  if v is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  uid := v->>'id';
  if uid is null then
    begin
      select e.id::text into uid from employees e
       where e.name = v->>'name' and coalesce(e.surname, '') = coalesce(v->>'surname', '') limit 1;
    exception when others then uid := null; end;
  end if;
  if uid is null then return jsonb_build_object('ok', false, 'error', 'employee'); end if;

  if to_regclass('public.quiz_done') is not null then
    execute 'select coalesce(jsonb_agg(quiz_id), ''[]''::jsonb) from quiz_done where user_id::text = $1'
      into quiz using uid;
  end if;
  if to_regclass('public.progress') is not null then
    execute 'select coalesce(jsonb_agg(lesson_id), ''[]''::jsonb) from progress where user_id::text = $1'
      into lessons using uid;
  end if;

  return jsonb_build_object('ok', true, 'quiz', quiz, 'lessons', lessons);
end; $$;

grant execute on function my_state(text) to anon, authenticated;
notify pgrst, 'reload schema';

-- Проверка: функция создана
select (select count(*) from pg_proc where proname = 'my_state') as "функция my_state (ожидаем 1)";
