-- ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 47 (v132, Доп. 445): «Сомелье» учится на том, что берут гости.
--
-- Владелец (03.11): «Как мы сомелье можем сделать умнее?» — на одиннадцать предложений «Берём все».
--
--   • Сомелье в «Барной карте» подобрал гостю 2–3 позиции. Официант одним касанием отмечает у позиции «Гость взял» или
--     «Не взял»: som_log_add(p_token, p_ev, p_item, p_dishes, p_ask). ev:
--       'run'      — подбор (сколько раз спрашивали);
--       'taken'    — гость взял позицию p_item («wine:…», «spirit:…», «cocktail:…»);
--       'declined' — не взял.
--     p_dishes — к каким блюдам меню подбирали (id, до шести), p_ask — просьба словами (до 300 знаков). Пишется только про
--     себя и своё заведение (по входу). «Взял / Не взял» по той же позиции в течение 10 минут — исправление: прежняя
--     отметка заменяется. Больше 300 записей сотрудника за сутки — нет (защита от потока).
--   • som_stats(p_token, p_days) — сводка своего заведения за p_days дней (по умолчанию 90): сколько подборов, сколько
--     раз взяли и не взяли; по позициям — взяли и не взяли; по парам «блюдо — позиция» — сколько раз взяли. Её читают все
--     сотрудники заведения: сомелье поднимает выше то, что у вас берут к этому блюду, а руководитель видит итог.
--   • Таблица sa_som_log закрыта: только через эти функции.
--
-- Нужен этап 21 (_sa_caller). Таблицу создаёт, ничего не удаляет. Можно запускать повторно.
-- ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
end $$;

-- ── 1) Журнал подборов ────────────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_som_log (
  id bigserial primary key,
  restaurant text not null,
  emp_id text not null,
  ev text not null check (ev in ('run', 'taken', 'declined')),
  item text not null default '',
  dishes text[] not null default '{}'::text[],
  ask text not null default '',
  at timestamptz not null default now()
);
create index if not exists sa_som_log_rest_at on sa_som_log (restaurant, at desc);
create index if not exists sa_som_log_emp_at on sa_som_log (restaurant, emp_id, at desc);
alter table sa_som_log enable row level security;
revoke all on table sa_som_log from public, anon, authenticated;
revoke all on sequence sa_som_log_id_seq from public, anon, authenticated;

-- ── 2) Отметка ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function som_log_add(p_token text, p_ev text, p_item text default '', p_dishes text[] default '{}'::text[], p_ask text default '')
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; me text; it text := left(btrim(coalesce(p_item, '')), 80); ds text[];
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := coalesce(c->>'restaurant', ''); me := c->>'id';
  if rest = '' then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_ev is null or p_ev not in ('run', 'taken', 'declined') then return jsonb_build_object('ok', false, 'error', 'ev'); end if;
  if p_ev <> 'run' and it !~ '^(wine|spirit|cocktail):.+' then return jsonb_build_object('ok', false, 'error', 'item'); end if;
  if (select count(*) from sa_som_log where restaurant = rest and emp_id = me and at > now() - interval '1 day') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;
  if p_ev <> 'run' then
    delete from sa_som_log where restaurant = rest and emp_id = me and item = it and ev in ('taken', 'declined') and at > now() - interval '10 minutes';
  end if;
  select coalesce(array_agg(x), '{}'::text[]) into ds
    from (select left(btrim(d), 60) as x from unnest(coalesce(p_dishes, '{}'::text[])) d where btrim(coalesce(d, '')) <> '' limit 6) t;
  insert into sa_som_log (restaurant, emp_id, ev, item, dishes, ask)
  values (rest, me, p_ev, case when p_ev = 'run' then '' else it end, ds, left(coalesce(p_ask, ''), 300));
  return jsonb_build_object('ok', true);
end; $$;

-- ── 3) Сводка заведения ───────────────────────────────────────────────────────────────────────────────────────
create or replace function som_stats(p_token text, p_days int default 90)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; d int := least(greatest(coalesce(p_days, 90), 1), 365); since timestamptz;
        runs int; tk int; dc int; items jsonb; pairs jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := coalesce(c->>'restaurant', '');
  if rest = '' then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  since := now() - make_interval(days => d);
  select count(*) filter (where ev = 'run'), count(*) filter (where ev = 'taken'), count(*) filter (where ev = 'declined')
    into runs, tk, dc from sa_som_log where restaurant = rest and at > since;
  select coalesce(jsonb_agg(jsonb_build_object('item', item, 'taken', t, 'declined', n) order by t desc, n asc, item), '[]'::jsonb) into items
    from (select item, (count(*) filter (where ev = 'taken'))::int as t, (count(*) filter (where ev = 'declined'))::int as n
            from sa_som_log where restaurant = rest and ev in ('taken', 'declined') and at > since
           group by item order by 2 desc, 3 asc, item limit 100) q;
  select coalesce(jsonb_agg(jsonb_build_object('dish', dish, 'item', item, 'taken', t) order by t desc, dish, item), '[]'::jsonb) into pairs
    from (select x.dish, l.item, count(*)::int as t
            from sa_som_log l cross join lateral unnest(l.dishes) as x(dish)
           where l.restaurant = rest and l.ev = 'taken' and l.at > since
           group by x.dish, l.item order by 3 desc, 1, 2 limit 200) q;
  return jsonb_build_object('ok', true, 'restaurant', rest, 'days', d, 'runs', runs, 'taken', tk, 'declined', dc, 'items', items, 'pairs', pairs);
end; $$;

-- ── 4) Права ──────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function som_log_add(text, text, text, text[], text), som_stats(text, int) from public;
grant execute on function som_log_add(text, text, text, text[], text), som_stats(text, int) to anon, authenticated;

notify pgrst, 'reload schema';

select 'сомелье: журнал «взял / не взял» готов · записей ' || (select count(*) from sa_som_log) as result;
