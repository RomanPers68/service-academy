-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 67 (Доп. 537): КБЖУ заведения — в базе, а не в коде приложения
--
-- Что делает:
--   1. Таблица sa_nutrition — пищевая ценность блюд у каждого заведения:
--        items — строки ведомости: n (название), out (выход, г), kcal, p, f, c (на порцию),
--                k100, p100, f100, c100 (на 100 г), unit (если продаётся штукой);
--        alias — решения владельца там, где по названию не выбрать: «как зовут в меню» → «строка ведомости»;
--        tails — служебные хвосты названий в выгрузке ведомости (отрезаются при сравнении).
--      Напрямую таблица закрыта, читать — только через функцию.
--   2. nutrition_get(token, restaurant) — таблица своего заведения любому, кто вошёл; чужого — только сети
--      (владелец, старший). Нет таблицы — пустые списки. Без входа — auth, чужое заведение — forbidden.
--   Переименование заведения (этап 61) переносит и таблицу: у неё колонка restaurant.
--   Сами данные в этом файле не лежат: у каждого заведения своя ведомость, она загружается отдельно.
--
-- Нужны этапы 11c и 62 (кто спрашивает — _sa_caller). Безвреден повторно.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- Страховка: без этапа 62 не понять, кто спрашивает и из какого он заведения
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = '_sa_caller') then
    raise exception 'Сначала этап 62 (supabase-stage62-venue-walls.sql): нет функции _sa_caller';
  end if;
end $$;

-- ── 1) Таблица ─────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_nutrition (
  restaurant text primary key,
  items      jsonb not null default '[]'::jsonb,
  alias      jsonb not null default '{}'::jsonb,
  tails      jsonb not null default '[]'::jsonb,
  source     text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint sa_nutrition_items check (jsonb_typeof(items) = 'array'),
  constraint sa_nutrition_alias check (jsonb_typeof(alias) = 'object'),
  constraint sa_nutrition_tails check (jsonb_typeof(tails) = 'array')
);
alter table sa_nutrition enable row level security;
revoke all on table sa_nutrition from public, anon, authenticated;

-- ── 2) Чтение ──────────────────────────────────────────────────────────────────────────────────
create or replace function nutrition_get(p_token text, p_restaurant text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; r sa_nutrition%rowtype;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(p_restaurant, '')), '');
  if rest is null then rest := nullif(c->>'restaurant', ''); end if;
  if rest is null then
    return jsonb_build_object('ok', true, 'restaurant', null, 'rows', '[]'::jsonb, 'alias', '{}'::jsonb, 'tails', '[]'::jsonb);
  end if;
  if rest is distinct from c->>'restaurant' and rest is distinct from c->>'home'
     and not coalesce((c->>'network')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select * into r from sa_nutrition where restaurant = rest;
  return jsonb_build_object('ok', true, 'restaurant', rest,
    'rows', coalesce(r.items, '[]'::jsonb), 'alias', coalesce(r.alias, '{}'::jsonb), 'tails', coalesce(r.tails, '[]'::jsonb),
    'updated_at', r.updated_at);
end $$;

-- ── 3) Права ───────────────────────────────────────────────────────────────────────────────────
revoke all on function nutrition_get(text, text) from public;
grant execute on function nutrition_get(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'КБЖУ заведений: таблица закрыта, чтение — nutrition_get · с ведомостью: '
  || (select count(*) from sa_nutrition where jsonb_array_length(items) > 0) as result;
