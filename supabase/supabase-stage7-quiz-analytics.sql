-- supabase-stage7-quiz-analytics.sql
-- Этап 7: аналитика ошибок на уровне конкретных вопросов.
-- Применить: Supabase → SQL Editor → вставить целиком и выполнить (Run).
--
-- Зачем: экран «Аналитика» уже показывает слабые ТЕМЫ по средним баллам.
-- Этот этап добавляет уровень глубже — какие именно ВОПРОСЫ команда чаще
-- всего заваливает. Каждый такой вопрос — готовая тема для брифинга.
-- Приложение работает и БЕЗ этого скрипта: события тихо отбрасываются
-- офлайн-очередью (как в stage 2), а вкладка честно сообщает,
-- что серверная часть ещё не включена.

-- ── 1. События ответов ───────────────────────────────────────────────────────
create table if not exists quiz_events (
  id bigint generated always as identity primary key,
  restaurant text,
  employee text,
  role_id text,
  lesson_id text,
  question text,
  correct boolean not null,
  ts timestamptz default now()
);

create index if not exists quiz_events_rest_ts on quiz_events (restaurant, ts desc);

-- ── 2. Запись события (вызывается приложением после каждого ответа в тесте) ──
create or replace function log_quiz_answer(
  p_token text, p_role text, p_lesson text, p_question text, p_correct boolean
) returns json language plpgsql security definer as $$
declare v jsonb;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;

  insert into quiz_events (restaurant, employee, role_id, lesson_id, question, correct)
  values (
    v->'employee'->>'restaurant',
    trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname')),
    p_role,
    p_lesson,
    left(coalesce(p_question, ''), 300),
    p_correct
  );
  return json_build_object('ok', true);
end; $$;

-- ── 3. Отчёт «трудные вопросы» за 30 дней (для экрана «Аналитика») ──────────
-- Доступ: менеджер видит свой ресторан, senior и админ — все.
-- Показываются вопросы минимум с 3 ответами, отсортированные по доле ошибок.
create or replace function quiz_hard_questions(p_token text)
returns table (question text, lesson_id text, total bigint, fails bigint, fail_pct int)
language plpgsql security definer as $$
declare v jsonb; v_pos text; v_admin boolean; v_rest text; v_all boolean;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return; -- пустой результат = нет доступа
  end if;
  v_pos   := v->'employee'->>'position';
  v_admin := coalesce((v->'employee'->>'is_admin')::boolean, false);
  v_rest  := v->'employee'->>'restaurant';

  if not (v_admin or v_pos in ('senior', 'manager')) then
    return; -- рядовым сотрудникам отчёт не отдаём
  end if;
  v_all := v_admin or v_pos = 'senior';

  return query
  select q.question, max(q.lesson_id) as lesson_id,
         count(*) as total,
         count(*) filter (where not q.correct) as fails,
         (count(*) filter (where not q.correct) * 100 / count(*))::int as fail_pct
    from quiz_events q
   where q.ts > now() - interval '30 days'
     and (v_all or q.restaurant = v_rest)
   group by q.question
  having count(*) >= 3
     and count(*) filter (where not q.correct) > 0
   order by fail_pct desc, fails desc
   limit 15;
end; $$;

-- ── 4. Гигиена: события старше 120 дней можно чистить (по желанию, вручную) ──
-- delete from quiz_events where ts < now() - interval '120 days';
