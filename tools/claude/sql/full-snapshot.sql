-- Снимок устройства базы одной строкой JSON: функции (хеш тела без \r, права, настройки), таблицы (колонки, RLS,
-- доступ клиента, правила, индексы, ограничения, триггеры), задачи pg_cron (без текста команд — только хеш),
-- хранилище. Одинаково для рабочей базы и для сборки с нуля (full-build.sh) — чтобы сравнить их (full-compare.py).
-- Данных не читает.
select jsonb_build_object(
  'functions', (select jsonb_object_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', jsonb_build_object(
      'h', md5(replace(p.prosrc, E'\r\n', E'\n')), 'sd', p.prosecdef, 'cfg', array_to_string(p.proconfig, ';'), 'vol', p.provolatile::text,
      'lang', l.lanname, 'ret', pg_get_function_result(p.oid),
      'x', (select string_agg(r, ',' order by r) from unnest(array['anon', 'authenticated', 'service_role']) r
             where has_function_privilege(r, p.oid, 'execute'))))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  'tables', (select jsonb_object_agg(c.relname, jsonb_build_object(
      'cols', (select jsonb_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' NN' else '' end
                 || coalesce(' D:' || pg_get_expr(ad.adbin, ad.adrelid), '') || case when a.attidentity <> '' then ' ID' else '' end order by a.attname)
               from pg_attribute a left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
              where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
      'rls', c.relrowsecurity,
      'anon', (select string_agg(pv, ',' order by pv) from unnest(array['select', 'insert', 'update', 'delete']) pv where has_table_privilege('anon', c.oid, pv)),
      'auth', (select string_agg(pv, ',' order by pv) from unnest(array['select', 'insert', 'update', 'delete']) pv where has_table_privilege('authenticated', c.oid, pv)),
      'pol', (select jsonb_agg(policyname || ':' || cmd || ':' || array_to_string(roles, ',') || ':' || coalesce(qual, '') || '/' || coalesce(with_check, '') order by policyname)
                from pg_policies where schemaname = 'public' and tablename = c.relname),
      'idx', (select jsonb_agg(pg_get_indexdef(i.indexrelid) order by 1) from pg_index i where i.indrelid = c.oid),
      'cons', (select jsonb_agg(k.contype::text || ':' || k.conname || ':' || pg_get_constraintdef(k.oid) order by 1) from pg_constraint k where k.conrelid = c.oid and k.contype <> 'n'),
      'trg', (select jsonb_agg(t.tgname || ':' || t.tgfoid::regproc::text order by 1) from pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal)))
     from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')),
  'cron', (select jsonb_agg(jobname || ' | ' || schedule || ' | ' || md5(command) order by jobname) from cron.job),
  'buckets', (select jsonb_agg(id || ' public=' || public::text order by id) from storage.buckets),
  'storage_pol', (select jsonb_agg(policyname order by policyname) from pg_policies where schemaname = 'storage')
) as doc;
