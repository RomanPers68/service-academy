-- ════════════════════════════════════════════════════════════════════════════
-- Этап 15 — аналитика по людям: кто, где и как ошибается; «Лазейки»
--
-- Кто кого видит (решение владельца):
--   менеджер          — линейный персонал своего ресторана
--                       (официанты, хостес, бармены, старшие бармены);
--   руководящий состав — линейный персонал и менеджеров всех ресторанов;
--   админ             — всех.
-- Разграничение — здесь, на сервере: лишнего телефону просто не отдаётся.
--
-- Тест сдаётся один раз: он запирается, когда пройден с результатом 70%+ и
-- нажато «Продолжить ✓». Провал (меньше 70% или три ошибки) — официальная
-- пересдача, это не лазейка. Лазейка — выйти ДО конца («‹» посреди теста,
-- закрыть приложение) или уйти с проходного результата, не нажав «Продолжить»:
-- так ошибки не сохраняются, и тест можно пройти заново, уже зная ответы.
--
-- Отличить одно от другого может только приложение — оно знает, где кончился
-- тест. Поэтому выход фиксирует оно само и присылает сюда одним событием:
-- сколько вопросов прошёл, где ошибся, что выбрал и что было верно.
-- Сотрудник, который потом сдаст тест, получает секретную ачивку «Находчивая
-- жопка» — у себя на телефоне; руководители видят всех в «Аналитике».
--
-- Запускать в SQL Editor после этапа 14. Повторный запуск безопасен.
-- Нужна функция whoami (этапы 2 и 11c).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Лестница видимости ─────────────────────────────────────────────────────
-- 0 — линейный персонал, 1 — менеджер, 2 — руководящий состав, 3 — админ.
-- Смотрящий видит тех, кто ниже его; админ — всех.
create or replace function sa_rank(p_pos text, p_admin boolean) returns int
language sql immutable as $$
  select case when coalesce(p_admin, false) then 3
              when p_pos = 'senior' then 2
              when p_pos = 'manager' then 1
              else 0 end
$$;

-- ── Как ошибся: что выбрал и что было верно ────────────────────────────────
alter table quiz_events add column if not exists answer text;
alter table quiz_events add column if not exists right_answer text;

-- Приложение зовёт это сразу после log_quiz_answer (этап 7), в той же очереди:
-- запись ответа уже есть, здесь к ней дописываются выбранный и верный варианты.
-- Пока этап 15 не применён, вызов тихо отклоняется, а запись ответов работает.
create or replace function log_quiz_pick(
  p_token text, p_lesson text, p_question text, p_answer text, p_right text
) returns json language plpgsql security definer set search_path to 'public' as $$
declare v jsonb; v_emp text;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  v_emp := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));
  update quiz_events set answer = left(coalesce(p_answer, ''), 300), right_answer = left(coalesce(p_right, ''), 300)
   where id = (select id from quiz_events
                where employee = v_emp and lesson_id = p_lesson
                  and question = left(coalesce(p_question, ''), 300)
                  and answer is null
                order by ts desc limit 1);
  return json_build_object('ok', true);
end; $$;

create table if not exists quiz_skips (
  id bigint generated always as identity primary key,
  restaurant text,
  employee text,          -- «Имя Фамилия», как в quiz_events
  lesson_id text,
  answered int,           -- на скольких вопросах вышел
  total int,              -- сколько вопросов в тесте
  wrong json,             -- [{q: вопрос, a: что выбрал, r: что верно}]
  ts timestamptz default now()
);
create index if not exists quiz_skips_rest_ts on quiz_skips (restaurant, ts desc);
alter table quiz_skips enable row level security; -- доступ только через функции

-- Запись выхода. Зовётся приложением; личность — из токена, не из параметров.
create or replace function log_quiz_skip(
  p_token text, p_lesson text, p_answered int, p_total int, p_wrong json
) returns json language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  insert into quiz_skips (restaurant, employee, lesson_id, answered, total, wrong)
  values (v->'employee'->>'restaurant',
          trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname')),
          left(coalesce(p_lesson, ''), 80),
          greatest(coalesce(p_answered, 0), 0),
          greatest(coalesce(p_total, 0), 0),
          coalesce(p_wrong, '[]'::json));
  return json_build_object('ok', true);
end; $$;

-- Отчёт для «Аналитика → Лазейки» — по лестнице видимости.
create or replace function quiz_skips_list(p_token text)
returns table (employee text, restaurant text, emp_position text, lesson_id text, answered int, total int, wrong json, ts timestamptz)
language plpgsql security definer set search_path to 'public' as $$
declare v jsonb; v_rank int; v_rest text;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return; -- пустой результат = нет доступа
  end if;
  v_rank := sa_rank(v->'employee'->>'position', (v->'employee'->>'is_admin')::boolean);
  v_rest := v->'employee'->>'restaurant';
  if v_rank = 0 then return; end if; -- рядовым сотрудникам отчёт не отдаём
  return query
  select s.employee, s.restaurant, e.position::text, s.lesson_id, s.answered, s.total, s.wrong, s.ts
    from quiz_skips s
    left join employees e on trim(concat_ws(' ', e.name, e.surname)) = s.employee and e.restaurant = s.restaurant
   where (v_rank >= 2 or s.restaurant = v_rest)
     and (v_rank = 3 or sa_rank(e.position::text, e.is_admin) < v_rank)
   order by s.ts desc
   limit 300;
end; $$;

-- ── Отчёт «Люди»: кто, где и как ошибается (за 90 дней) ───────────────────
-- Строка — сотрудник × вопрос: сколько раз ошибся, сколько всего отвечал, что
-- выбрал в последний раз и что было верно (с этапа 15; раньше не писалось).
create or replace function quiz_people(p_token text)
returns table (employee text, restaurant text, emp_position text, lesson_id text, question text,
               fails int, total int, last_answer text, right_answer text, last_ts timestamptz)
language plpgsql security definer set search_path to 'public' as $$
declare v jsonb; v_rank int; v_rest text;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return;
  end if;
  v_rank := sa_rank(v->'employee'->>'position', (v->'employee'->>'is_admin')::boolean);
  v_rest := v->'employee'->>'restaurant';
  if v_rank = 0 then return; end if;
  return query
  with ev as (
    select q.employee, q.restaurant, q.lesson_id, q.question, q.correct, q.answer, q.right_answer, q.ts,
           e.position::text as epos, coalesce(e.is_admin, false) as eadm
      from quiz_events q
      left join employees e on trim(concat_ws(' ', e.name, e.surname)) = q.employee and e.restaurant = q.restaurant
     where q.ts > now() - interval '90 days'
       and (v_rank >= 2 or q.restaurant = v_rest)
  )
  select ev.employee, max(ev.restaurant), max(ev.epos), ev.lesson_id, ev.question,
         (count(*) filter (where not ev.correct))::int,
         count(*)::int,
         (array_agg(ev.answer order by ev.ts desc) filter (where not ev.correct and ev.answer is not null))[1],
         (array_agg(ev.right_answer order by ev.ts desc) filter (where ev.right_answer is not null))[1],
         max(ev.ts)
    from ev
   where (v_rank = 3 or sa_rank(ev.epos, ev.eadm) < v_rank)
   group by ev.employee, ev.lesson_id, ev.question
  having count(*) filter (where not ev.correct) > 0
   order by 6 desc, 10 desc
   limit 3000;
end; $$;

grant execute on function log_quiz_pick(text, text, text, text, text) to anon, authenticated;
grant execute on function log_quiz_skip(text, text, int, int, json) to anon, authenticated;
grant execute on function quiz_skips_list(text) to anon, authenticated;
grant execute on function quiz_people(text) to anon, authenticated;

-- ── Проверка: должно быть 5 функций, 1 таблица и 2 новые колонки ──────────
select
  (select count(*) from pg_proc where proname in ('sa_rank', 'log_quiz_pick', 'log_quiz_skip', 'quiz_skips_list', 'quiz_people')) as functions,
  (select count(*) from information_schema.tables where table_name = 'quiz_skips') as tables,
  (select count(*) from information_schema.columns where table_name = 'quiz_events' and column_name in ('answer', 'right_answer')) as new_columns;
