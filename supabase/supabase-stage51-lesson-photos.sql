-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 51 (v146, Доп. 467): фото урока.
--
-- Владелец (12.11) на идею «фото и главная мысль крупно — и тот же урок смотрится совсем иначе»: «Давай все», и вопрос:
-- «Её можно будет менять? … можно было вставить фото либо ресторана, либо персонала на фоне ресторана». Можно: руководитель
-- ставит фото к любому уроку прямо с телефона (урок → кнопка с фотоаппаратом → «Выбрать фото»).
--   • Фото — сжатый на телефоне JPEG (до 450 КБ) и превью (до 80 КБ) в base64, как фото «О нас» (этап 49) и в чате (этап 38).
--   • Куда: scope '' — вся сеть (ставят владелец и руководящий состав), иначе название заведения, как у сотрудников (ставят
--     его руководители; владелец и руководящий состав — любое). У урока одно фото на сеть и по одному на заведение.
--   • Кто что видит: сотрудник — фото своего заведения, а если его нет — фото сети. Чужие заведения не видны.
--   • lesson_photos — какие уроки с фото (урок, чьё, версия, размер, кто поставил) и что можно мне; lesson_photo — само фото
--     (превью или целиком); lesson_photo_set — поставить или заменить; lesson_photo_del — убрать.
-- Нужен этап 21 (_sa_caller). Можно запускать повторно. Supabase → SQL Editor → New query → вставить файл целиком → Run.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна проверка входа';
  end if;
end $$;

-- ── 1) Таблица ─────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_lesson_photos (
  scope text not null default '',
  lesson text not null,
  data text not null,
  thumb text not null,
  mime text not null default 'image/jpeg',
  w int,
  h int,
  ver text not null,
  by_id text,
  by_name text,
  updated_at timestamptz not null default now(),
  primary key (scope, lesson)
);
alter table sa_lesson_photos enable row level security;   -- политик нет: только через функции ниже

-- ── 2) Права ──────────────────────────────────────────────────────────────────────────────────────────────────
-- сеть — владелец и руководящий состав; заведение — ещё и его руководители (как _sa_cn_can этапа 49)
create or replace function _sa_lp_can(c jsonb, p_scope text)
returns boolean language sql immutable as $$
  select c is not null and (
    coalesce((c->>'network')::boolean, false)
    or (coalesce(p_scope, '') <> '' and coalesce((c->>'lead')::boolean, false) and p_scope = c->>'restaurant'))
$$;

-- ── 3) Что с фото и что можно мне ─────────────────────────────────────────────────────────────────────────────────
create or replace function lesson_photos(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; items jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  select coalesce(jsonb_agg(jsonb_build_object('lesson', p.lesson, 'scope', p.scope, 'ver', p.ver, 'w', p.w, 'h', p.h,
           'by', p.by_name, 'at', p.updated_at) order by p.lesson, p.scope), '[]'::jsonb)
    into items
    from sa_lesson_photos p
   where p.scope = '' or p.scope = rest;
  return jsonb_build_object('ok', true, 'restaurant', rest, 'items', items,
    'can', jsonb_build_object('net', _sa_lp_can(c, ''), 'venue', rest is not null and _sa_lp_can(c, rest)));
end; $$;

-- ── 4) Само фото: своё заведение, иначе сеть (p_scope — именно это место: '' или своё заведение) ───────────────────────
create or replace function lesson_photo(p_token text, p_lesson text, p_full boolean default false, p_scope text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; sc text; p sa_lesson_photos;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if p_scope is not null then
    sc := btrim(p_scope);
    if sc <> '' and sc is distinct from rest then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    select * into p from sa_lesson_photos x where x.lesson = coalesce(p_lesson, '') and x.scope = sc;
  else
    select * into p from sa_lesson_photos x
     where x.lesson = coalesce(p_lesson, '') and (x.scope = '' or x.scope = rest)
     order by (x.scope = '') limit 1;   -- false раньше true: своё заведение важнее сети
  end if;
  if p.lesson is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'lesson', p.lesson, 'scope', p.scope, 'ver', p.ver,
    'data', case when coalesce(p_full, false) then p.data else p.thumb end, 'mime', p.mime, 'w', p.w, 'h', p.h);
end; $$;

-- ── 5) Поставить и убрать ──────────────────────────────────────────────────────────────────────────────────────
create or replace function lesson_photo_set(p_token text, p_lesson text, p_scope text, p_full text, p_thumb text,
  p_w int default null, p_h int default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; n int; v text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  sc := btrim(coalesce(p_scope, ''));
  if not _sa_lp_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if coalesce(p_lesson, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if coalesce(p_full, '') !~ '^[A-Za-z0-9+/]+={0,2}$' or coalesce(p_thumb, '') !~ '^[A-Za-z0-9+/]+={0,2}$'
     or length(p_full) > 640000 or length(p_thumb) > 110000 or length(p_full) < 100 then
    return jsonb_build_object('ok', false, 'error', 'bad_photo');
  end if;
  select count(*) into n from sa_lesson_photos where scope = sc and lesson <> p_lesson;
  if n >= 600 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  v := left(md5(p_full), 12);
  insert into sa_lesson_photos (scope, lesson, data, thumb, w, h, ver, by_id, by_name, updated_at)
  values (sc, p_lesson, p_full, p_thumb, case when p_w between 1 and 10000 then p_w end, case when p_h between 1 and 10000 then p_h end,
          v, c->>'id', nullif(c->>'who', ''), now())
  on conflict (scope, lesson) do update
     set data = excluded.data, thumb = excluded.thumb, w = excluded.w, h = excluded.h, ver = excluded.ver,
         by_id = excluded.by_id, by_name = excluded.by_name, updated_at = now();
  return jsonb_build_object('ok', true, 'ver', v, 'scope', sc);
end; $$;

create or replace function lesson_photo_del(p_token text, p_lesson text, p_scope text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  sc := btrim(coalesce(p_scope, ''));
  if not _sa_lp_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  delete from sa_lesson_photos where scope = sc and lesson = coalesce(p_lesson, '');
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'removed', n);
end; $$;

-- ── 6) Права на функции ────────────────────────────────────────────────────────────────────────────────────────
revoke all on function _sa_lp_can(jsonb, text) from public, anon, authenticated;
revoke all on function lesson_photos(text), lesson_photo(text, text, boolean, text),
  lesson_photo_set(text, text, text, text, text, int, int), lesson_photo_del(text, text, text) from public;
grant execute on function lesson_photos(text), lesson_photo(text, text, boolean, text),
  lesson_photo_set(text, text, text, text, text, int, int), lesson_photo_del(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'фото уроков: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('lesson_photos', 'lesson_photo', 'lesson_photo_set', 'lesson_photo_del')) || ' функции из 4' ||
  ' · фото: ' || (select count(*) from sa_lesson_photos) as result;
