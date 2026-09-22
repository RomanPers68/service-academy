-- ════════════════════════════════════════════════════════════════════════════
-- Этап 16 — тайный зачёт ключей
--
-- Ключ — тест, пройденный через лазейку (этап 15) и потом сданный. Один тест —
-- один ключ навсегда: сброс и повторный трюк нового ключа не дадут. Зачёт идёт
-- внутри каждого заведения (решение владельца). Сотрудник видит только числа —
-- свои ключи, своё место, ключи лидера, сколько всего хитрецов; имён не видит.
-- Имена видят руководители в «Аналитике → Лазейки».
--
-- Запускать в SQL Editor после этапа 15. Повторный запуск безопасен.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Переходник whoami_txt(text) — как в этапе 11c ────────────────────────────
-- На этой базе whoami принимает токен не текстом (например, uuid), и прямой вызов
-- whoami(p_token) с текстом падает: «function whoami(text) does not exist» (Доп. 155,
-- этап 11c; то же случилось с этапами 15–16 до этой правки). Все функции ниже зовут
-- whoami_txt(p_token). Если переходника нет — создаём по фактической подписи whoami;
-- если есть — не трогаем.
do $$
declare t0 text;
begin
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
              where ns.nspname = 'public' and p.proname = 'whoami_txt') then
    return;
  end if;
  select format_type(p.proargtypes[0], null) into t0
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'whoami'
   order by p.pronargs limit 1;
  if t0 is null then
    raise exception 'whoami в схеме public не найдена — пришли это сообщение разработчику';
  end if;
  execute format('create or replace function public.whoami_txt(p_token text) returns jsonb '
                 'language sql stable security definer as $f$ select to_jsonb(public.whoami(p_token::%s)) $f$', t0);
end $$;

create table if not exists quiz_keys (
  id bigint generated always as identity primary key,
  restaurant text,
  employee text,          -- «Имя Фамилия», как в quiz_events и quiz_skips
  lesson_id text,
  ts timestamptz default now(),
  unique (employee, lesson_id)
);
create index if not exists quiz_keys_rest on quiz_keys (restaurant);
alter table quiz_keys enable row level security; -- доступ только через функции

-- Место в зачёте своего заведения. Только числа, без имён.
create or replace function quiz_key_rank(p_token text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v jsonb; v_emp text; v_rest text; r json;
begin
  v := whoami_txt(p_token);   -- переходник, см. выше
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  v_emp  := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));
  v_rest := v->'employee'->>'restaurant';
  with t as (
    select k.employee as who, count(*)::int as keys
      from quiz_keys k
     where k.restaurant = v_rest
     group by k.employee
  ), me as (
    select coalesce((select t.keys from t where t.who = v_emp), 0) as keys
  ), top as (
    select coalesce(max(t.keys), 0) as keys from t
  )
  select json_build_object(
           'ok', true,
           'mine', me.keys,
           'leader', top.keys,
           'players', (select count(*) from t),
           'place', 1 + (select count(*) from t where t.keys > me.keys),
           'tied', (select count(*) from t where t.keys = top.keys) > 1)
    into r
    from me, top;
  return r;
end; $$;

-- Ключ за тест, сданный после выхода. Сразу возвращает место — одним запросом.
create or replace function log_quiz_key(p_token text, p_lesson text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  v := whoami_txt(p_token);   -- переходник, см. выше
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  insert into quiz_keys (restaurant, employee, lesson_id)
  values (v->'employee'->>'restaurant',
          trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname')),
          left(coalesce(p_lesson, ''), 80))
  on conflict (employee, lesson_id) do nothing;
  return quiz_key_rank(p_token);
end; $$;

grant execute on function quiz_key_rank(text) to anon, authenticated;
grant execute on function log_quiz_key(text, text) to anon, authenticated;

-- Разбудить PostgREST, чтобы приложение сразу увидело новые функции (см. этап 9)
notify pgrst, 'reload schema';

-- ── Проверка: должно быть 2 функции и 1 таблица ────────────────────────────
select
  (select count(*) from pg_proc where proname in ('quiz_key_rank', 'log_quiz_key')) as functions,
  (select count(*) from information_schema.tables where table_name = 'quiz_keys') as tables;
