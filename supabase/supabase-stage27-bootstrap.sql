-- supabase-stage27-bootstrap.sql — этап 27 (v64, Доп. 377): старт приложения одним запросом.
--
-- Зачем. При открытии приложение делало 10–12 запросов: whoami, my_state, my_reset_at, my_mentors, quiz_key_rank,
-- team_profiles, team_scores, pair_status, day_brief, cms_list_lessons… — и все, кроме whoami, только после того,
-- как нарисует главную. На 3G каждый круг — 300–800 мс. («Путь мастера» и «Жизнь команды» — mastery_list,
-- team_achievements — сюда не входят: их приложение спрашивает, только когда человек туда заходит.)
-- Теперь приложение зовёт одну функцию app_bootstrap(p_token), которая собирает ответы всех этих функций
-- в один JSON. Каждая часть считается отдельно: если какая-то функция ещё не установлена или упала,
-- остальные части всё равно приедут, а приложение дозапросит недостающее само, как раньше.
--
-- Права: функция работает с правами того, кто её зовёт (security invoker). Каждая часть — ровно то, что приложение
-- получило бы, позвав функцию само, с той же проверкой токена; новых путей к данным бутстрап не открывает.
--
-- Что делает скрипт:
--   1) создаёт (или обновляет) функцию app_bootstrap(p_token text) → jsonb;
--   2) даёт на неё право anon и authenticated (как у остальных функций приложения);
--   3) печатает отчёт одной таблицей: какие части соберутся, и видит ли роль anon таблицы напрямую (этап 21б должен был
--      закрыть).
--
-- Запускать в Supabase → SQL Editor. Повторный запуск безопасен. Без этого этапа приложение работает как раньше
-- (отдельными запросами) — порядок выкладки кода и базы не важен.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.app_bootstrap(p_token text)
returns jsonb
language plpgsql
security invoker
set search_path to public
as $$
declare
  parts jsonb := '{}'::jsonb;
  v     jsonb;
  fn    text;
  key   text;
  -- whoami на этой базе может принимать токен не текстом (см. этап 11c) — тогда есть переходник whoami_txt;
  -- в ответе часть лежит под именем whoami, как её ждёт приложение
  list  text[] := array['whoami','my_state','my_reset_at','my_mentors','quiz_key_rank','team_profiles',
                        'team_scores','pair_status','day_brief','cms_list_lessons'];
begin
  foreach key in array list loop
    -- берём функцию с одним текстовым параметром и ответом json/jsonb (одной строкой) — ровно то, что зовёт
    -- приложение; whoami: сначала переходник whoami_txt, иначе сам whoami(text)
    select p.proname into fn
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.proname = any (case when key = 'whoami' then array['whoami_txt','whoami'] else array[key] end)
       and p.pronargs = 1 and not p.proretset
       and p.proargtypes[0] = 'text'::regtype
       and p.prorettype in ('json'::regtype, 'jsonb'::regtype)
     order by case when p.proname = 'whoami_txt' then 0 else 1 end
     limit 1;
    -- функции может не быть (этап ещё не применён) — тогда части просто нет, приложение дозапросит само
    if fn is null then
      continue;
    end if;
    begin
      execute format('select to_jsonb(public.%I($1))', fn) into v using p_token;
      parts := parts || jsonb_build_object(key, coalesce(v, 'null'::jsonb));
    exception when others then
      -- ошибка одной части не валит остальные; приложение увидит error = "boot" и спросит функцию напрямую
      parts := parts || jsonb_build_object(key, jsonb_build_object('ok', false, 'error', 'boot', 'message', sqlerrm));
    end;
  end loop;
  return jsonb_build_object('ok', true, 'v', 1, 'at', now(), 'parts', parts);
end;
$$;

grant execute on function public.app_bootstrap(text) to anon, authenticated;

-- Разбудить сервер API, чтобы приложение увидело новую функцию сразу (см. этап 9)
notify pgrst, 'reload schema';

-- ── Отчёт ────────────────────────────────────────────────────────────────────────────────────────────────
-- Одна таблица (SQL Editor показывает результат только последнего запроса):
--   «часть старта» — какая функция отвечает за часть (whoami — переходник whoami_txt или сам whoami). «нет» — не страшно:
--     эту часть приложение спросит отдельно, как раньше. «нет» у whoami или my_state — пришли строку разработчику.
--   «anon видит таблицу» — должно быть «нет» везде (этап 21б; приложение с v59 к таблицам не ходит). Если где-то «ДА» —
--     пришли эту строку разработчику: закроем отдельным скриптом, ничего не ломая.
select r.что, r.имя, r.значение from (
  select 1 as n, 'часть старта' as что, key as имя,
         coalesce((select p.proname
                     from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                    where ns.nspname = 'public'
                      and p.proname = any (case when key = 'whoami' then array['whoami_txt','whoami'] else array[key] end)
                      and p.pronargs = 1 and not p.proretset
                      and p.proargtypes[0] = 'text'::regtype
                      and p.prorettype in ('json'::regtype, 'jsonb'::regtype)
                    order by case when p.proname = 'whoami_txt' then 0 else 1 end
                    limit 1)::text, 'нет') as значение,
         ord
    from unnest(array['whoami','my_state','my_reset_at','my_mentors','quiz_key_rank','team_profiles',
                      'team_scores','pair_status','day_brief','cms_list_lessons']) with ordinality as u(key, ord)
  union all
  select 2, 'anon видит таблицу', c.relname::text,
         case when has_table_privilege('anon', format('public.%I', c.relname), 'select') then 'ДА — пришли разработчику' else 'нет' end,
         0
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('profiles','scores','progress','quiz_done','practice_stars','completed_roles','mistakes','employees','sessions')
) r
order by r.n, r.ord, r.имя;
