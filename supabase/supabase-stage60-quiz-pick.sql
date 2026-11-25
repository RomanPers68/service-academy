-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 60 (v194, Доп. 519): «что выбрал» в тесте ложится в свою попытку. У ошибки больше не стоит верный ответ.
--
-- Владелец (25.11): «И у меня системная ошибка. За ошибку засчитал правильный ответ». На снимке «Аналитика → Люди»:
-- крестик, «Выбрал: Работаю чётко и быстро, без лишних вопросов» и «Верно: …» то же самое.
--
-- Почему так вышло. Ответ в тесте пишется двумя вызовами. log_quiz_answer (этап 7) добавляет запись «верно / неверно»,
-- log_quiz_pick (этап 15) дописывает к ней, что выбрал и что было верно: в последнюю запись этого вопроса, где «что
-- выбрал» ещё пусто. До v194 приложение слало оба вызова разом, и log_quiz_pick иногда приходил первым. Свежей записи
-- ещё нет, и текст ложился в прошлую попытку того же вопроса. Так верный ответ второй попытки оказался в ошибке первой.
-- Сама ошибка была настоящей, неверным был только текст «Выбрал».
--
-- Что меняется:
--   • log_quiz_pick ищет запись той же верности: выбранный ответ совпадает с верным — только среди верных ответов,
--     иначе — только среди ошибок. Не нашлось — ничего не пишет, запись ответа от этого не страдает. Так попытки
--     не путают и старые версии приложения на телефонах. С v194 приложение и само шлёт вызовы по очереди.
--   • Записи, уже испорченные так, чинятся: у ошибки «что выбрал» совпадает с верным — текст стирается (что человек
--     выбрал на самом деле, уже не узнать, ошибка остаётся); у верного ответа «что выбрал» другой — ставится верный.
--   • _sa_quiz_pick_row — поиск такой записи. По ней экран «Сервер» узнаёт, что этап на месте.
--
-- Нужны этапы 7 и 15. Если этап 15 запускали после этого, запусти этот файл ещё раз: этап 15 возвращает прежний
-- log_quiz_pick. Ничего не удаляет. Можно запускать повторно. Supabase → SQL Editor → New query → вставить → Run.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.quiz_events') is null then
    raise exception 'Сначала этап 7 (supabase-stage7-quiz-analytics.sql): нет таблицы quiz_events';
  end if;
  if to_regprocedure('public.log_quiz_pick(text, text, text, text, text)') is null then
    raise exception 'Сначала этап 15 (supabase-stage15-quiz-retries.sql): нет функции log_quiz_pick';
  end if;
end $$;

-- ── 1) Какая запись ждёт «что выбрал»: этот человек, тест, вопрос, «что выбрал» пусто, та же верность; самая свежая ──
-- Индекс по записям, где «что выбрал» ещё пусто: поиск после каждого ответа не перебирает всю таблицу
create index if not exists quiz_events_wait_pick on quiz_events (employee, lesson_id, question, ts desc) where answer is null;

create or replace function _sa_quiz_pick_row(p_emp text, p_lesson text, p_question text, p_ok boolean)
returns bigint language sql stable set search_path to 'public' as $$
  select id from quiz_events
   where employee = p_emp and lesson_id = p_lesson and question = p_question
     and answer is null and correct = p_ok
   order by ts desc, id desc
   limit 1
$$;

-- ── 2) log_quiz_pick: прежние параметры, приложение зовёт его как раньше ──────────────────────────────────────────
create or replace function log_quiz_pick(
  p_token text, p_lesson text, p_question text, p_answer text, p_right text
) returns json language plpgsql security definer set search_path to 'public' as $$
declare v jsonb; v_emp text; v_a text; v_r text; v_id bigint;
begin
  v := whoami_txt(p_token);   -- переходник, см. этап 7
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  v_emp := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));
  v_a := left(coalesce(p_answer, ''), 300);
  v_r := left(coalesce(p_right, ''), 300);
  -- выбрал то, что верно, — значит, ответ верный: ищем среди верных; иначе — среди ошибок
  v_id := _sa_quiz_pick_row(v_emp, p_lesson, left(coalesce(p_question, ''), 300), v_a = v_r);
  if v_id is not null then
    update quiz_events set answer = v_a, right_answer = v_r where id = v_id;
  end if;
  return json_build_object('ok', true, 'found', v_id is not null);
end; $$;

revoke all on function _sa_quiz_pick_row(text, text, text, boolean) from public, anon, authenticated;
grant execute on function log_quiz_pick(text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 3) Починка записей и проверка: ожидаем «что выбрал: своя попытка — да · починено записей: …» ─────────────────
-- Чинит в этом же запросе: при повторном запуске чинить уже нечего, будет «починено записей: 0».
with miss as (   -- ошибка, а «что выбрал» — верный ответ: текст другой попытки
  update quiz_events set answer = null
   where correct = false and answer is not null and right_answer is not null and answer = right_answer
  returning 1
), hit as (      -- верный ответ, а «что выбрал» — другой: тоже текст другой попытки
  update quiz_events set answer = right_answer
   where correct = true and answer is not null and right_answer is not null and answer <> right_answer
  returning 1
)
select 'что выбрал: своя попытка — ' ||
  case when pg_get_functiondef(to_regprocedure('public.log_quiz_pick(text, text, text, text, text)')) like '%_sa_quiz_pick_row%'
       then 'да' else 'НЕТ' end ||
  ' · починено записей: ' || ((select count(*) from miss) + (select count(*) from hit)) ||
  ' (у ошибки стоял верный ответ: ' || (select count(*) from miss) ||
  ', у верного ответа — другой: ' || (select count(*) from hit) || ')' as result;
