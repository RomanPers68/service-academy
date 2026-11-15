-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 53 (v167, Доп. 492): редактор справочника.
--
-- Владелец (15.11): «Мы можем сделать редактор справочника по типу как в меню, карте бара, контента и т.д.? Уверен, что
-- инфа будет добавляться и хочется это делать с приложения». Решения: справочник общий для всех заведений; править
-- можно всё, включая штатные главы («Сервировка», «Вина», «Кофе», «Бар»); редактор только у владельца.
--   • Штатные разделы и главы живут в приложении. Здесь хранится только то, что владелец изменил или добавил:
--     строка на раздел или главу. У штатного пустое поле значит «как в приложении», строку можно убрать — вернётся
--     исходное. Свои разделы (id «rs-…») и главы («rc-…») живут только здесь.
--   • ref_book — весь список правок и его версия; читают все, кто вошёл. С версией, которая уже есть на телефоне,
--     отвечает коротко: «то же самое».
--   • ref_book_save — записать и убрать строки одним вызовом (правка главы, порядок, «скрыть», «вернуть как было»);
--     только владелец.
--   • Фото в тексте глав и обложки своих разделов — этап 51 (фото уроков), здесь их нет.
-- Нужен этап 21 (_sa_caller). Можно запускать повторно. Supabase → SQL Editor → New query → вставить файл целиком → Run.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна проверка входа';
  end if;
end $$;

-- ── 1) Таблицы ──────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_ref_items (
  id text primary key,                 -- штатный («serving», «srv-basics») или свой («rs-…» раздел, «rc-…» глава)
  kind text not null,                  -- 'sec' — раздел, 'ch' — глава
  parent text not null default '',     -- у главы — её раздел; у штатной главы пусто значит «в своём разделе»
  title text,                          -- пусто — как в приложении (для штатного)
  sub text,                            -- подзаголовок раздела
  body text,                           -- текст главы; пусто — как в приложении
  hidden boolean not null default false,
  sort int,                            -- место в списке; пусто — как в приложении
  by_id text,
  by_name text,
  updated_at timestamptz not null default now()
);
create table if not exists sa_ref_meta (
  k text primary key,
  ver bigint not null default 0
);
insert into sa_ref_meta (k, ver) values ('book', 0) on conflict (k) do nothing;
alter table sa_ref_items enable row level security;   -- политик нет: только через функции ниже
alter table sa_ref_meta enable row level security;

-- ── 2) Весь список правок и его версия ──────────────────────────────────────────────────────────────────────
create or replace function ref_book(p_token text, p_have text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; v bigint; items jsonb; can jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select m.ver into v from sa_ref_meta m where m.k = 'book';
  v := coalesce(v, 0);
  can := jsonb_build_object('edit', coalesce((c->>'admin')::boolean, false));
  if p_have is not null and p_have = v::text then
    return jsonb_build_object('ok', true, 'ver', v::text, 'same', true, 'can', can);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'parent', i.parent, 'title', i.title, 'sub', i.sub,
           'body', i.body, 'hidden', i.hidden, 'sort', i.sort, 'at', i.updated_at) order by i.kind desc, i.sort nulls last, i.id), '[]'::jsonb)
    into items
    from sa_ref_items i;
  return jsonb_build_object('ok', true, 'ver', v::text, 'items', items, 'can', can);
end; $$;

-- ── 3) Записать и убрать: только владелец ───────────────────────────────────────────────────────────────────
-- p_items — [{id, kind, parent, title, sub, body, hidden, sort}]: строка заменяется целиком (пустое поле — «как в
-- приложении»); p_del — [id, …]: строки убрать (своё — удалить, штатное — вернуть как было).
create or replace function ref_book_save(p_token text, p_items jsonb default '[]'::jsonb, p_del jsonb default '[]'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; it jsonb; v bigint; n int; v_id text; v_kind text; v_sort int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if coalesce((c->>'admin')::boolean, false) is not true then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_del, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 400 or jsonb_array_length(coalesce(p_del, '[]'::jsonb)) > 400 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;
  -- сначала проверяем всё, потом пишем: половина правки не должна лечь на сервер
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_id := coalesce(it->>'id', ''); v_kind := coalesce(it->>'kind', '');
    if v_id !~ '^[A-Za-z0-9_.:-]{1,60}$' or v_kind not in ('sec', 'ch')
       or coalesce(it->>'parent', '') !~ '^[A-Za-z0-9_.:-]{0,60}$'
       or length(coalesce(it->>'title', '')) > 160 or length(coalesce(it->>'sub', '')) > 240
       or length(coalesce(it->>'body', '')) > 60000
       or (it ? 'sort' and jsonb_typeof(it->'sort') not in ('number', 'null'))
       or (it ? 'hidden' and jsonb_typeof(it->'hidden') not in ('boolean', 'null')) then
      return jsonb_build_object('ok', false, 'error', 'bad_item', 'id', v_id);
    end if;
  end loop;
  for it in select * from jsonb_array_elements(coalesce(p_del, '[]'::jsonb)) loop
    if jsonb_typeof(it) <> 'string' or (it #>> '{}') !~ '^[A-Za-z0-9_.:-]{1,60}$' then
      return jsonb_build_object('ok', false, 'error', 'bad_item');
    end if;
  end loop;

  -- сколько строк станет: больше 800 не храним (проверка до записи — ответом, а не ошибкой)
  select count(*) into n from (
    select i.id from sa_ref_items i
     where i.id not in (select x #>> '{}' from jsonb_array_elements(coalesce(p_del, '[]'::jsonb)) x)
    union
    select y->>'id' from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) y) t;
  if n > 800 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;

  -- свой раздел убирают вместе с его главами (у штатного раздела строку убирают, чтобы вернуть как было, — главы остаются)
  delete from sa_ref_items i
   where i.kind = 'ch' and i.parent like 'rs-%'
     and i.parent in (select x #>> '{}' from jsonb_array_elements(coalesce(p_del, '[]'::jsonb)) x);
  delete from sa_ref_items i where i.id in (select x #>> '{}' from jsonb_array_elements(coalesce(p_del, '[]'::jsonb)) x);
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_sort := case when jsonb_typeof(it->'sort') = 'number' then (it->>'sort')::numeric::int end;
    insert into sa_ref_items (id, kind, parent, title, sub, body, hidden, sort, by_id, by_name, updated_at)
    values (it->>'id', it->>'kind', coalesce(it->>'parent', ''), nullif(it->>'title', ''), nullif(it->>'sub', ''), it->>'body',
            coalesce((it->>'hidden')::boolean, false), v_sort, c->>'id', nullif(c->>'who', ''), now())
    on conflict (id) do update
       set kind = excluded.kind, parent = excluded.parent, title = excluded.title, sub = excluded.sub, body = excluded.body,
           hidden = excluded.hidden, sort = excluded.sort, by_id = excluded.by_id, by_name = excluded.by_name, updated_at = now();
  end loop;
  update sa_ref_meta set ver = ver + 1 where k = 'book' returning ver into v;
  if v is null then insert into sa_ref_meta (k, ver) values ('book', 1) returning ver into v; end if;
  return jsonb_build_object('ok', true, 'ver', v::text);
end; $$;

-- ── 4) Права на функции ─────────────────────────────────────────────────────────────────────────────────────
revoke all on function ref_book(text, text), ref_book_save(text, jsonb, jsonb) from public;
grant execute on function ref_book(text, text), ref_book_save(text, jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

select 'редактор справочника: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('ref_book', 'ref_book_save')) || ' функции из 2' ||
  ' · строк правок: ' || (select count(*) from sa_ref_items) as result;
