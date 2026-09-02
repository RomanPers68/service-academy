-- supabase-stage10-backup.sql — Этап 10: резервная копия базы одним тапом (Дополнение 125).
-- Free-план Supabase не делает бэкапов. Владелец (is_admin) в Аналитике нажимает
-- «Скачать копию» → приложение берёт одноразовый билет (3 минуты, одно скачивание)
-- → серверная функция Vercel /api/backup?t=… отдаёт JSON со ВСЕМИ таблицами public.
-- Связка токен→сотрудник — через вашу же функцию whoami(p_token).
-- Безвреден при повторном запуске. В конце печатает строку-подтверждение.

create table if not exists backup_tickets (
  ticket text primary key,
  employee text,
  expires_at timestamptz not null
);

-- Билет выдаётся только владельцу (is_admin). Менеджерам — нет: копия содержит все рестораны.
create or replace function backup_ticket(p_token text)
returns json language plpgsql security definer as $$
declare v jsonb; v_employee text; t text;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if not coalesce((v->'employee'->>'is_admin')::boolean, false) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  v_employee := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));
  delete from backup_tickets where expires_at < now();
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into backup_tickets (ticket, employee, expires_at) values (t, v_employee, now() + interval '3 minutes');
  return json_build_object('ok', true, 'ticket', t);
end; $$;

-- Обмен билета на данные: билет гасится сразу, второй раз не сработает.
create or replace function backup_take(p_ticket text)
returns jsonb language plpgsql security definer as $$
declare r record; v_employee text; part jsonb; tables jsonb := '{}'::jsonb; total int := 0;
begin
  delete from backup_tickets where ticket = p_ticket and expires_at >= now()
    returning employee into v_employee;
  if v_employee is null then
    return jsonb_build_object('ok', false, 'error', 'ticket');
  end if;
  for r in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'backup_tickets'
    order by table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %I t', r.table_name) into part;
    tables := tables || jsonb_build_object(r.table_name, part);
    total := total + jsonb_array_length(part);
  end loop;
  return jsonb_build_object('ok', true, 'app', 'Service Academy', 'created_at', now(),
    'by', v_employee, 'rows', total, 'tables', tables);
end; $$;

-- Подтверждение: ожидаем «бэкап: 2 функции из 2».
select 'бэкап: ' || count(*) || ' функции из 2' as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('backup_ticket', 'backup_take');
