-- supabase-stage11-rollback.sql — откат Этапа 11 (вернуть всё как было до замка).
-- Применять ТОЛЬКО если после stage11 что-то перестало грузиться и нужно
-- быстро вернуть работу, пока разбираемся. Открывает базу anon-ключу заново.

grant all on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('schedule_venues','schedule_months','schedule_publications') -- у графика RLS был и раньше
  loop
    execute format('alter table public.%I disable row level security', r.relname);
  end loop;
end $$;

select 'откат выполнен: база снова открыта anon-ключу' as result;
