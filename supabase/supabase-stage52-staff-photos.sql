-- ══════════════════════════════════════════════════════════════════════════════════════
-- Этап 52 (v158, Доп. 483): фото сотрудников.
--
-- Владелец (14.11) на «что ещё заметил»: «Давай все пять». Четвёртое из пяти: в «Смене», «Графике» и «Команде» люди —
-- кружки с буквами. Теперь в кружке может быть фото: каждый ставит своё сам (вкладка «Я» → кружок рядом с именем).
--   • Фото — сжатый на телефоне квадратный JPEG (512 точек, до 150 КБ) и превью для кружков (160 точек, до 30 КБ) в base64,
--     как фото уроков (этап 51). У сотрудника одно фото; замена — новая версия (отпечаток самого фото).
--   • Кто ставит и убирает: своё — сам сотрудник. Чужое — тот, кому можно трогать данные сотрудника (_sa_may_touch
--     этапа 21): руководитель — у своего заведения, владелец и руководящий состав — у любого. В приложении руководителю
--     дана только кнопка «Убрать» (неудачное фото); ставить фото за другого приложение не предлагает.
--   • Кто видит: все работающие сотрудники сети (имена коллег приложение и так показывает в рейтинге сети).
--     Уволенного в списке нет, и фото его не отдаётся.
--   • staff_photos — у кого есть фото (сотрудник, имя, заведение, версия), кто я и что мне можно; staff_photo — сами фото:
--     до 24 превью одним запросом или одно фото целиком; staff_photo_set — поставить или заменить; staff_photo_del — убрать.
-- v160 (Доп. 485): в списке staff_photos у каждого появилась должность (position) — приложение показывает её под
--   именем, когда фото открывают крупно. Остальное не менялось. Файл уже запускали — запустить ещё раз: фото на месте.
-- Нужен этап 21 (_sa_caller, _sa_may_touch). Можно запускать повторно: поставленные фото не стираются.
-- Supabase → SQL Editor → New query → вставить файл целиком → Run.
-- ══════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null or to_regprocedure('public._sa_may_touch(jsonb,jsonb)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна проверка входа и прав';
  end if;
end $$;

-- ── 1) Таблица ──────────────────────────────────────────────────────────────────────────
create table if not exists sa_staff_photos (
  emp_id text primary key,
  data text not null,
  thumb text not null,
  mime text not null default 'image/jpeg',
  ver text not null,
  by_id text,
  by_name text,
  updated_at timestamptz not null default now()
);
alter table sa_staff_photos enable row level security;   -- политик нет: только через функции ниже

-- ── 2) Сотрудник по номеру: {id, restaurant} или null (уволенного нет) ───────────────────────────────────────
create or replace function _sa_sp_person(p_id text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare r jsonb;
begin
  if coalesce(btrim(p_id), '') = '' then return null; end if;
  begin
    select jsonb_build_object('id', e.id::text, 'restaurant', e.restaurant) into r
      from employees e
     where e.id::text = btrim(p_id) and coalesce(e.status, 'active') = 'active'
     limit 1;
  exception when others then r := null; end;
  return r;
end; $$;

-- ── 3) У кого есть фото, кто я и что мне можно ────────────────────────────────────────────────────
create or replace function staff_photos(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; items jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('id', p.emp_id, 'name', coalesce(e.name, ''), 'surname', coalesce(e.surname, ''),
             'restaurant', coalesce(e.restaurant, ''), 'position', lower(coalesce(e.position, '')), 'ver', p.ver, 'at', p.updated_at)
             order by e.restaurant, e.name, e.surname, p.emp_id), '[]'::jsonb)
      into items
      from sa_staff_photos p
      join employees e on e.id::text = p.emp_id
     where coalesce(e.status, 'active') = 'active';
  exception when others then items := '[]'::jsonb; end;
  return jsonb_build_object('ok', true, 'me', c->>'id', 'restaurant', nullif(btrim(coalesce(c->>'restaurant', '')), ''), 'items', items,
    'can', jsonb_build_object('network', coalesce((c->>'network')::boolean, false), 'lead', coalesce((c->>'lead')::boolean, false)));
end; $$;

-- ── 4) Сами фото: до 24 превью разом или одно фото целиком ───────────────────────────────────────────────
create or replace function staff_photo(p_token text, p_ids text[], p_full boolean default false)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; ids text[]; items jsonb; f boolean := coalesce(p_full, false);
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  ids := coalesce(p_ids, '{}'::text[]);
  ids := ids[1:(case when f then 1 else 24 end)];
  if cardinality(ids) = 0 then return jsonb_build_object('ok', true, 'items', '[]'::jsonb); end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('id', p.emp_id, 'ver', p.ver, 'mime', p.mime,
             'data', case when f then p.data else p.thumb end) order by p.emp_id), '[]'::jsonb)
      into items
      from sa_staff_photos p
      join employees e on e.id::text = p.emp_id
     where p.emp_id = any(ids) and coalesce(e.status, 'active') = 'active';
  exception when others then items := '[]'::jsonb; end;
  return jsonb_build_object('ok', true, 'items', items);
end; $$;

-- ── 5) Поставить и убрать: своё — сам, чужое — кому можно трогать данные сотрудника (этап 21) ───────────────────
create or replace function staff_photo_set(p_token text, p_emp text, p_full text, p_thumb text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; target text; t jsonb; v text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  target := coalesce(nullif(btrim(coalesce(p_emp, '')), ''), c->>'id');
  if target <> c->>'id' then
    t := _sa_sp_person(target);
    if t is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    if not _sa_may_touch(c, t) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  end if;
  if coalesce(p_full, '') !~ '^[A-Za-z0-9+/]+={0,2}$' or coalesce(p_thumb, '') !~ '^[A-Za-z0-9+/]+={0,2}$'
     or length(p_full) > 200000 or length(p_thumb) > 40000 or length(p_full) < 100 or length(p_thumb) < 40 then
    return jsonb_build_object('ok', false, 'error', 'bad_photo');
  end if;
  v := left(md5(p_full), 12);
  insert into sa_staff_photos (emp_id, data, thumb, ver, by_id, by_name, updated_at)
  values (target, p_full, p_thumb, v, c->>'id', nullif(c->>'who', ''), now())
  on conflict (emp_id) do update
     set data = excluded.data, thumb = excluded.thumb, ver = excluded.ver,
         by_id = excluded.by_id, by_name = excluded.by_name, updated_at = now();
  return jsonb_build_object('ok', true, 'id', target, 'ver', v);
end; $$;

create or replace function staff_photo_del(p_token text, p_emp text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; target text; t jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  target := coalesce(nullif(btrim(coalesce(p_emp, '')), ''), c->>'id');
  if target <> c->>'id' then
    t := _sa_sp_person(target);
    -- сотрудника уже нет в списке (уволен, удалён): его фото убирает только сеть — как в _sa_may_touch
    if not _sa_may_touch(c, t) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  end if;
  delete from sa_staff_photos where emp_id = target;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'id', target, 'removed', n);
end; $$;

-- ── 6) Права на функции ────────────────────────────────────────────────────────────────────
revoke all on function _sa_sp_person(text) from public, anon, authenticated;
revoke all on function staff_photos(text), staff_photo(text, text[], boolean),
  staff_photo_set(text, text, text, text), staff_photo_del(text, text) from public;
grant execute on function staff_photos(text), staff_photo(text, text[], boolean),
  staff_photo_set(text, text, text, text), staff_photo_del(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'фото сотрудников: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('staff_photos', 'staff_photo', 'staff_photo_set', 'staff_photo_del')) || ' функции из 4' ||
  ' · фото: ' || (select count(*) from sa_staff_photos) as result;
