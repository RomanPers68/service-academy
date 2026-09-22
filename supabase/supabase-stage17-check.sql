-- ════════════════════════════════════════════════════════════════════════════
-- Этап 17 — проверка и починка: совпадает ли база с тем, что ждёт приложение
--
-- Зачем. Часть серверных функций создавалась прямо на сервере и в проект не входит
-- (чек-листы, онбординг, настроение, обмены сменами, пожелания к графику и др.) —
-- из кода их не проверить. А на этой базе whoami принимает токен не текстом, и любая
-- функция, созданная после этапа 11c и зовущая whoami(p_token) напрямую, падает с
-- «function whoami(text) does not exist» — так было с этапами 15–16.
--
-- Что делает (безвреден повторно):
--   1) переходник whoami_txt(text) — если его нет, создаёт по подписи whoami (как 11c);
--   2) функции с токеном-ТЕКСТОМ, где встречается прямой whoami(p_token), переводит
--      на whoami_txt(p_token) — как 11c, но только их;
--   2б) функции с токеном НЕ текстом (uuid), где стоит whoami_txt(p_token), чинит на
--      whoami_txt(p_token::text). Так их сломал 11c: он переводил на переходник все
--      функции подряд, а переходник принимает только текст — «function
--      whoami_txt(uuid) does not exist». Так не сохранялись чек-листы (правка 155);
--   3) будит сервер API (notify pgrst);
--   4) сверяет каждую функцию, которую зовёт приложение: есть ли она и принимает ли
--      параметры, которые шлёт приложение.
-- Результат — одна таблица: что починено, где расхождения, и итог.
-- ════════════════════════════════════════════════════════════════════════════

create temp table if not exists sa_check_log (n serial, что text, статус text, подробности text);
truncate sa_check_log;

do $$
declare t0 text; fn record; def text;
begin
  -- 1) переходник
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = 'whoami_txt') then
    select format_type(p.proargtypes[0], null) into t0
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = 'whoami' order by p.pronargs limit 1;
    if t0 is null then
      insert into sa_check_log(что, статус, подробности) values ('whoami', 'НЕТ НА СЕРВЕРЕ', 'пришли это разработчику');
      return;
    end if;
    execute format('create or replace function public.whoami_txt(p_token text) returns jsonb '
                   'language sql stable security definer as $f$ select to_jsonb(public.whoami(p_token::%s)) $f$', t0);
    insert into sa_check_log(что, статус, подробности) values ('whoami_txt', 'создан переходник', 'whoami(' || t0 || ')');
  end if;
  -- 2) прямые вызовы whoami(p_token) → переходник
  for fn in
    select p.oid, p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname not in ('whoami', 'whoami_txt')
       and p.prosrc ~ '(^|[^_a-z])whoami\(p_token\)'
       -- только токен-текст: у токена uuid прямой whoami(p_token) и так работает
       and pg_get_function_identity_arguments(p.oid) ~ '(^|, )p_token text(,|$)'
     order by p.proname
  loop
    def := regexp_replace(pg_get_functiondef(fn.oid), '(^|[^_a-z])whoami\(p_token\)', '\1whoami_txt(p_token)', 'g');
    begin
      execute def;
      insert into sa_check_log(что, статус, подробности) values (fn.proname, 'ПОЧИНЕНА', 'звала whoami напрямую → whoami_txt');
    exception when others then
      insert into sa_check_log(что, статус, подробности) values (fn.proname, 'НЕ УДАЛОСЬ ПОЧИНИТЬ', sqlerrm);
    end;
  end loop;
  -- 2б) токен не текст (uuid), а зовёт переходник. Если тип токена тот же, что
  --     принимает whoami, — возвращаем функции её исходный вызов whoami(p_token), как
  --     было до 11c; иначе — переходник с текстом: whoami_txt(p_token::text).
  select format_type(p.proargtypes[0], null) into t0
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'whoami' order by p.pronargs limit 1;
  for fn in
    select p.oid, p.proname,
           format_type(p.proargtypes[array_position(p.proargnames, 'p_token') - 1], null) as tok
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname not in ('whoami', 'whoami_txt')
       and p.prosrc ~ 'whoami_txt\(p_token\)'
       and array_position(p.proargnames, 'p_token') is not null
     order by p.proname
  loop
    continue when fn.tok = 'text';   -- токен-текст и переходник — это правильно
    if fn.tok = t0 then
      def := regexp_replace(pg_get_functiondef(fn.oid), 'whoami_txt\(p_token\)', 'whoami(p_token)', 'g');
    else
      def := regexp_replace(pg_get_functiondef(fn.oid), 'whoami_txt\(p_token\)', 'whoami_txt(p_token::text)', 'g');
    end if;
    begin
      execute def;
      insert into sa_check_log(что, статус, подробности) values (fn.proname, 'ПОЧИНЕНА',
        'токен ' || fn.tok || ': 11c перевёл на переходник, а тот принимает текст → '
        || case when fn.tok = t0 then 'вернул whoami(p_token), как было' else 'whoami_txt(p_token::text)' end);
    exception when others then
      insert into sa_check_log(что, статус, подробности) values (fn.proname, 'НЕ УДАЛОСЬ ПОЧИНИТЬ', sqlerrm);
    end;
  end loop;
end $$;

-- 3) разбудить сервер API
notify pgrst, 'reload schema';

-- 4) сверка: всё, что зовёт приложение
with need(fn, params) as (values
  ('achievement_set', array['p_better', 'p_key', 'p_token', 'p_value']::text[]),
  ('achievements_list', array['p_restaurant']::text[]),
  ('admin_create_employee', array['p_name', 'p_position', 'p_restaurant', 'p_surname', 'p_token']::text[]),
  ('admin_delete_employee', array['p_employee_id', 'p_token']::text[]),
  ('admin_issue_permanent_code', array['p_employee_id', 'p_token']::text[]),
  ('admin_list_employees', array['p_token']::text[]),
  ('admin_reset_code', array['p_employee_id', 'p_token']::text[]),
  ('admin_reset_player', array['p_name', 'p_surname', 'p_token']::text[]),
  ('admin_set_status', array['p_employee_id', 'p_status', 'p_token']::text[]),
  ('admin_unlock_quiz', array['p_name', 'p_surname', 'p_token']::text[]),
  ('admin_update_employee', array['p_employee_id', 'p_name', 'p_surname', 'p_token']::text[]),
  ('backup_ticket', array['p_token']::text[]),
  ('candidate_delete', array['p_id', 'p_restaurant', 'p_token']::text[]),
  ('candidate_list', array['p_restaurant', 'p_token']::text[]),
  ('candidate_save', array['p_restaurant', 'p_result', 'p_token']::text[]),
  ('checklist_check', array['p_checked', 'p_day', 'p_kind', 'p_token', 'p_total']::text[]),
  ('checklist_get', array['p_day', 'p_token']::text[]),
  ('checklist_save', array['p_items', 'p_kind', 'p_token']::text[]),
  ('cms_delete_lesson', array['p_id', 'p_token']::text[]),
  ('cms_list_lessons', array['p_token']::text[]),
  ('cms_save_lesson', array['p_lesson', 'p_token']::text[]),
  ('confirm_skill', array['p_date', 'p_mentor', 'p_role', 'p_skill', 'p_skill_label', 'p_token']::text[]),
  ('confirm_skill_pin', array['p_date', 'p_pin', 'p_role', 'p_skill', 'p_skill_label', 'p_token']::text[]),
  ('log_quiz_answer', array['p_correct', 'p_lesson', 'p_question', 'p_role', 'p_token']::text[]),
  ('log_quiz_key', array['p_lesson', 'p_token']::text[]),
  ('log_quiz_pick', array['p_answer', 'p_lesson', 'p_question', 'p_right', 'p_token']::text[]),
  ('log_quiz_skip', array['p_answered', 'p_lesson', 'p_token', 'p_total', 'p_wrong']::text[]),
  ('menu_get', array['p_restaurant']::text[]),
  ('menu_progress_list', array['p_restaurant']::text[]),
  ('menu_progress_set', array['p_restaurant', 'p_score', 'p_status', 'p_token', 'p_wave']::text[]),
  ('menu_set', array['p_dishes', 'p_restaurant', 'p_token']::text[]),
  ('mood_summary', array['p_today', 'p_token']::text[]),
  ('onboarding_check', array['p_checked', 'p_token', 'p_total']::text[]),
  ('onboarding_get', array['p_token']::text[]),
  ('onboarding_list', array['p_token']::text[]),
  ('quiz_hard_questions', array['p_token']::text[]),
  ('quiz_key_rank', array['p_token']::text[]),
  ('quiz_people', array['p_token']::text[]),
  ('quiz_skips_list', array['p_token']::text[]),
  ('redeem_code', array['p_code']::text[]),
  ('sa_set_tg', array['p_tg_id', 'p_token']::text[]),
  ('save_completed_role', array['p_role', 'p_token']::text[]),
  ('save_last_role', array['p_role', 'p_token']::text[]),
  ('save_mood', array['p_day', 'p_mood', 'p_token']::text[]),
  ('save_practice_stars', array['p_lesson_id', 'p_stars', 'p_token']::text[]),
  ('save_progress', array['p_lesson_id', 'p_role', 'p_token']::text[]),
  ('save_quiz_done', array['p_quiz_id', 'p_token']::text[]),
  ('save_score', array['p_quiz_id', 'p_role', 'p_score', 'p_token', 'p_total']::text[]),
  ('schedule_load', array['p_month', 'p_restaurant', 'p_token']::text[]),
  ('schedule_save_month', array['p_month', 'p_payload', 'p_restaurant', 'p_token', 'p_venue_key']::text[]),
  ('schedule_save_venue', array['p_config', 'p_restaurant', 'p_title', 'p_token', 'p_venue_key']::text[]),
  ('schedule_wish_set', array['p_day', 'p_month', 'p_on', 'p_restaurant', 'p_staff_id', 'p_token', 'p_venue_key']::text[]),
  ('schedule_wishes_get', array['p_month', 'p_restaurant', 'p_token', 'p_venue_key']::text[]),
  ('set_mentor_pin', array['p_pin', 'p_token']::text[]),
  ('swap_list', array['p_month', 'p_restaurant', 'p_token', 'p_venue']::text[]),
  ('swap_resolve', array['p_approve', 'p_id', 'p_restaurant', 'p_token']::text[]),
  ('whoami', array['p_token']::text[])
), fx as (
  select p.oid, p.proname, coalesce(p.proargnames, '{}'::text[]) as names, p.prosrc
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public'
), rep as (
  select need.fn,
         case when not exists (select 1 from fx where fx.proname = need.fn) then 'НЕТ НА СЕРВЕРЕ'
              when not exists (select 1 from fx where fx.proname = need.fn and fx.names @> need.params) then 'ДРУГИЕ ПАРАМЕТРЫ'
              when exists (select 1 from fx where fx.proname = need.fn and fx.prosrc ~ '(^|[^_a-z])whoami\(p_token\)'
                             and pg_get_function_identity_arguments(fx.oid) ~ '(^|, )p_token text(,|$)') then 'ЗОВЁТ whoami НАПРЯМУЮ'
              when exists (select 1 from fx where fx.proname = need.fn and fx.prosrc ~ 'whoami_txt\(p_token\)'
                             and pg_get_function_identity_arguments(fx.oid) !~ '(^|, )p_token text(,|$)') then 'ТОКЕН uuid → ПЕРЕХОДНИК'
              else 'ok' end as st,
         coalesce((select string_agg(pg_get_function_identity_arguments(fx.oid), ' | ') from fx where fx.proname = need.fn), '—') as srv,
         array_to_string(need.params, ', ') as want
    from need
)
insert into sa_check_log(что, статус, подробности)
select fn, st, case when st = 'ДРУГИЕ ПАРАМЕТРЫ' then 'приложение шлёт: ' || want || ' · на сервере: ' || srv else srv end
  from rep where st <> 'ok'
union all
select 'ИТОГО', format('в порядке %s из %s', count(*) filter (where st = 'ok'), count(*)), 'функций, которые зовёт приложение' from rep;

select что, статус, подробности from sa_check_log order by n;
