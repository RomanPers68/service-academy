-- ════════════════════════════════════════════════════════════════════════════
-- Этап 22 — подтверждение навыка в зале и подпись наставника (версия v28)
--
-- Что добавляет:
--   1) «Подтверждение в зале». Раньше навык подтверждали только в телефоне сотрудника
--      (PIN наставника или фамилия). Теперь сотрудник может отправить запрос старшему,
--      а тот подтверждает у себя в телефоне — когда своими глазами увидел навык в зале.
--      PIN и «по фамилии» работают как раньше.
--        skill_request(p_token, p_role, p_skill, p_skill_label)   сотрудник: попросить
--        skill_requests_mine(p_token)                             сотрудник: мои запросы
--        skill_request_cancel(p_token, p_id)                      сотрудник: отозвать
--        skill_requests_inbox(p_token)                            старший: ждут меня
--        skill_request_decide(p_token, p_id, p_approve, p_note)   старший: да / ещё рано
--   2) Подпись в записках «у стола»: my_mentors(p_token) — имена старших и менеджеров
--      своего ресторана («— Мария, наставник» вместо безымянного «наставник»).
--
-- Кто решает: менеджер, старший, владелец — как в подтверждении по PIN (этап 6).
-- Руководитель ресторана видит запросы своего ресторана, сеть (владелец и
-- руководящий состав) — все. Себе подтвердить нельзя.
--
-- Нужен этап 21 (функция _sa_caller). Таблица закрыта для прямого чтения — только
-- через функции с токеном. Запускать в SQL Editor целиком. Повторный запуск безопасен.
-- Без этого этапа приложение работает как раньше: кнопка «Отправить старшему»
-- честно скажет, что сервер ещё не обновлён, а подпись останется «наставник».
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала выполни этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
end $$;

-- ── 1) Запросы на подтверждение ──────────────────────────────────────────────
create table if not exists skill_requests (
  id          bigint generated always as identity primary key,
  emp_id      text not null,                 -- сотрудник (employees.id)
  emp_name    text not null,                 -- «Имя Фамилия» на момент запроса
  restaurant  text,                          -- ресторан сотрудника
  role_id     text not null,                 -- роль (data/skills.js)
  skill_id    text not null,                 -- навык (data/skills.js)
  skill_label text,                          -- название навыка на момент запроса
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  note        text,                          -- слово старшего при «ещё рано»
  mentor_id   text,                          -- кто решил
  mentor_name text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
-- один открытый запрос на навык
create unique index if not exists skill_requests_open on skill_requests (emp_id, role_id, skill_id) where status = 'pending';
create index if not exists skill_requests_rest on skill_requests (restaurant, status, created_at desc);
create index if not exists skill_requests_emp  on skill_requests (emp_id, created_at desc);
alter table skill_requests enable row level security;      -- политик нет: напрямую не читается
revoke all on table skill_requests from anon, authenticated;

-- ── 2) Сотрудник: попросить подтверждение ────────────────────────────────────
create or replace function skill_request(p_token text, p_role text, p_skill text, p_skill_label text)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb; r skill_requests; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  if coalesce(btrim(p_role), '') = '' or coalesce(btrim(p_skill), '') = '' then
    return json_build_object('ok', false, 'error', 'bad_args');
  end if;
  select * into r from skill_requests
   where emp_id = c->>'id' and role_id = p_role and skill_id = p_skill and status = 'pending' limit 1;
  if found then return json_build_object('ok', true, 'id', r.id, 'status', 'pending', 'again', true); end if;
  select count(*) into n from skill_requests where emp_id = c->>'id' and created_at > now() - interval '1 day';
  if n >= 40 then return json_build_object('ok', false, 'error', 'too_many'); end if;
  insert into skill_requests (emp_id, emp_name, restaurant, role_id, skill_id, skill_label)
  values (c->>'id', coalesce(nullif(c->>'who', ''), 'Сотрудник'), c->>'restaurant', left(p_role, 40), left(p_skill, 80), left(coalesce(p_skill_label, ''), 200))
  returning * into r;
  return json_build_object('ok', true, 'id', r.id, 'status', 'pending');
exception when unique_violation then
  return json_build_object('ok', true, 'status', 'pending', 'again', true);
end; $$;

-- ── 3) Сотрудник: мои запросы (последние 200) ────────────────────────────────
create or replace function skill_requests_mine(p_token text)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  return json_build_object('ok', true, 'rows', coalesce((
    select json_agg(x order by x.created_at desc) from (
      select id, role_id, skill_id, skill_label, status, note, mentor_name, created_at, decided_at
        from skill_requests where emp_id = c->>'id'
       order by created_at desc limit 200) x), '[]'::json));
end; $$;

-- ── 4) Сотрудник: отозвать свой открытый запрос ──────────────────────────────
create or replace function skill_request_cancel(p_token text, p_id bigint)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  update skill_requests set status = 'cancelled', decided_at = now()
   where id = p_id and emp_id = c->>'id' and status = 'pending';
  return json_build_object('ok', true, 'cancelled', found);
end; $$;

-- ── 5) Старший: запросы, которые ждут решения ────────────────────────────────
create or replace function skill_requests_inbox(p_token text)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb; net_ok boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return json_build_object('ok', false, 'error', 'not_mentor'); end if;
  net_ok := coalesce((c->>'network')::boolean, false);
  return json_build_object('ok', true, 'rows', coalesce((
    select json_agg(x order by x.mine desc, x.created_at) from (
      select id, emp_name, restaurant, role_id, skill_id, skill_label, created_at,
             (restaurant is not distinct from c->>'restaurant') as mine
        from skill_requests
       where status = 'pending' and emp_id <> c->>'id'
         and created_at > now() - interval '30 days'
         and (net_ok or restaurant is not distinct from c->>'restaurant')
       order by created_at limit 100) x), '[]'::json));
end; $$;

-- ── 6) Старший: подтвердить или «ещё рано» ──────────────────────────────────
create or replace function skill_request_decide(p_token text, p_id bigint, p_approve boolean, p_note text)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb; r skill_requests; st text;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return json_build_object('ok', false, 'error', 'not_mentor'); end if;
  select * into r from skill_requests where id = p_id for update;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if r.emp_id = c->>'id' then return json_build_object('ok', false, 'error', 'self'); end if;
  if not coalesce((c->>'network')::boolean, false) and r.restaurant is distinct from c->>'restaurant' then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if r.status <> 'pending' then
    return json_build_object('ok', false, 'error', 'already', 'status', r.status, 'mentor_name', r.mentor_name);
  end if;
  st := case when coalesce(p_approve, false) then 'approved' else 'declined' end;
  update skill_requests
     set status = st, note = nullif(left(btrim(coalesce(p_note, '')), 200), ''),
         mentor_id = c->>'id', mentor_name = coalesce(nullif(c->>'who', ''), 'Наставник'), decided_at = now()
   where id = p_id;
  return json_build_object('ok', true, 'status', st);
end; $$;

-- ── 7) Подпись наставника: старшие и менеджеры своего ресторана ──────────────
-- Только имена (без фамилий и контактов). Уволенные (status не active) не попадают.
create or replace function my_mentors(p_token text)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  return json_build_object('ok', true, 'rows', coalesce((
    select json_agg(json_build_object('name', x.name) order by x.ord, x.name) from (
      select btrim(e.name) as name, case lower(coalesce(to_jsonb(e)->>'position', '')) when 'senior' then 0 else 1 end as ord
        from employees e
       where e.restaurant is not distinct from c->>'restaurant'
         and lower(coalesce(to_jsonb(e)->>'position', '')) in ('senior', 'manager')
         and coalesce(to_jsonb(e)->>'status', 'active') = 'active'
         and e.id::text <> c->>'id'
         and coalesce(btrim(e.name), '') <> ''
       limit 6) x), '[]'::json));
end; $$;

-- ── 8) Права: функции с токеном — наружу, таблица — нет ──────────────────────
grant execute on function skill_request(text, text, text, text)            to anon, authenticated;
grant execute on function skill_requests_mine(text)                         to anon, authenticated;
grant execute on function skill_request_cancel(text, bigint)                to anon, authenticated;
grant execute on function skill_requests_inbox(text)                        to anon, authenticated;
grant execute on function skill_request_decide(text, bigint, boolean, text) to anon, authenticated;
grant execute on function my_mentors(text)                                  to anon, authenticated;

notify pgrst, 'reload schema';

-- ── Итог: сколько функций этапа на месте (ожидаем 6 из 6) ──────────────────────
select 'функции этапа 22: ' || count(*) || ' из 6' as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('skill_request', 'skill_requests_mine', 'skill_request_cancel', 'skill_requests_inbox', 'skill_request_decide', 'my_mentors');

-- ── Проверка (подставь токен из приложения: localStorage sa_session_token) ─────
--   select skill_request('ТОКЕН', 'seasonal', 'greet', 'Встреча гостя');
--   select skill_requests_mine('ТОКЕН');
--   select my_mentors('ТОКЕН');
-- Откат (если понадобится): drop function skill_request(text,text,text,text), skill_requests_mine(text),
--   skill_request_cancel(text,bigint), skill_requests_inbox(text), skill_request_decide(text,bigint,boolean,text),
--   my_mentors(text); drop table skill_requests;
