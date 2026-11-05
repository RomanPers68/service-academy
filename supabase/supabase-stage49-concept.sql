-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 49 (v139, Доп. 454): «О нас» — концепция и стандарты сети и каждого заведения.
--
-- Владелец (05.11), про таблицу обучения холдинга: «По поводу концепции, можно оставить редактор, чтобы каждое заведение
-- могло вписать свою концепцию, а руководитель сети общую», и на вопрос про другие стандарты заведения: «да. Я про
-- дресс-код, фото и т.д.». Главное: «чтобы это было дополнением к имеющемуся. И чтобы все функции приложения с этим
-- взаимодействовали».
--   • Блоки: scope '' — вся сеть (пишут владелец и руководящий состав), иначе название заведения, как у сотрудников
--     (пишут его руководители; владелец и руководящий состав — любое). Вид блока: idea (концепция и история), values,
--     structure (кто за что отвечает), guest, kitchen (кухня и бар), mood (атмосфера), pitch (рассказ гостю за 30 секунд),
--     dress (внешний вид и дресс-код), setting (сервировка залов), check (правильный чек), day (распорядок дня менеджера),
--     numbers (цифры смены), own (свой блок). У блока: заголовок, текст, фото с подписями, «для кого» (треки; пусто —
--     все), вопросы теста, порядок.
--   • Фото — сжатый на телефоне JPEG (до 450 КБ) и превью (до 80 КБ) в base64, как фото в чате (этап 38).
--   • concept_get — сеть, своё заведение (сети — любое), соседние заведения (только концепция: идея, гость, кухня и бар,
--     атмосфера, рассказ гостю), версии и что я уже прочитал; concept_save, concept_delete, concept_order — правка;
--     concept_photo_put, concept_photo — фото; concept_read — «Прочитал(а)»; concept_reads — руководителю: кто прочитал;
--     concept_notify — «Сообщить команде»: бот в Telegram (и на телефон, этап 48), раз в день на человека.
-- Нужен этап 21 (_sa_caller); для «Сообщить команде» — этап 25 (бот), без него сообщения не уходят.
-- Можно запускать повторно. Supabase → SQL Editor → New query → вставить файл целиком → Run.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна проверка входа';
  end if;
end $$;

-- ── 1) Таблицы ───────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_concept_blocks (
  id bigserial primary key,
  scope text not null default '',
  kind text not null,
  title text not null default '',
  body text not null default '',
  photos jsonb not null default '[]'::jsonb,
  tracks text[] not null default '{}'::text[],
  questions jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  updated_name text
);
create index if not exists sa_concept_blocks_scope on sa_concept_blocks (scope, sort, id);

create table if not exists sa_concept_photos (
  id bigserial primary key,
  scope text not null default '',
  data text not null,
  thumb text not null,
  mime text not null default 'image/jpeg',
  w int,
  h int,
  emp_id text,
  created_at timestamptz not null default now()
);
create index if not exists sa_concept_photos_scope on sa_concept_photos (scope, created_at);

create table if not exists sa_concept_reads (
  emp_id text not null,
  scope text not null,
  ver text not null,
  read_at timestamptz not null default now(),
  primary key (emp_id, scope)
);

alter table sa_concept_blocks enable row level security;
alter table sa_concept_photos enable row level security;
alter table sa_concept_reads enable row level security;

-- ── 2) Помощники ─────────────────────────────────────────────────────────────────────────────────
create or replace function _sa_cn_kinds()
returns text[] language sql immutable as $$
  select array['idea', 'values', 'structure', 'guest', 'kitchen', 'mood', 'pitch', 'dress', 'setting', 'check', 'day', 'numbers', 'own']
$$;
create or replace function _sa_cn_tracks()
returns text[] language sql immutable as $$
  select array['seasonal', 'core', 'spg', 'bar', 'manager', 'service_manager']
$$;
-- соседям видна только концепция заведения, не его внутренние стандарты
create or replace function _sa_cn_public()
returns text[] language sql immutable as $$
  select array['idea', 'guest', 'kitchen', 'mood', 'pitch']
$$;

-- может ли c править scope: сеть — владелец и руководящий состав; заведение — ещё и его руководители
create or replace function _sa_cn_can(c jsonb, p_scope text)
returns boolean language sql immutable as $$
  select c is not null and (
    coalesce((c->>'network')::boolean, false)
    or (coalesce(p_scope, '') <> '' and coalesce((c->>'lead')::boolean, false) and p_scope = c->>'restaurant'))
$$;

-- версия текста: меняется, когда меняют текст, фото, заголовок или «для кого»; порядок и вопросы теста — не в счёт
create or replace function _sa_cn_ver(p_scope text)
returns text language sql stable security definer set search_path to public as $$
  select coalesce(left(md5(string_agg(b.id::text || '|' || b.kind || '|' || b.title || '|' || b.body || '|' || b.photos::text || '|' ||
           array_to_string(b.tracks, ','), '#' order by b.id)), 12), '')
    from sa_concept_blocks b where b.scope = coalesce(p_scope, '')
$$;

create or replace function _sa_cn_block(b sa_concept_blocks)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', b.id, 'scope', b.scope, 'kind', b.kind, 'title', b.title, 'body', b.body, 'photos', b.photos,
    'tracks', to_jsonb(b.tracks), 'questions', b.questions, 'sort', b.sort, 'at', b.updated_at, 'by', b.updated_name)
$$;

create or replace function _sa_cn_list(p_scope text, p_kinds text[] default null)
returns jsonb language sql stable security definer set search_path to public as $$
  select coalesce(jsonb_agg(_sa_cn_block(b) order by b.sort, b.id), '[]'::jsonb)
    from sa_concept_blocks b
   where b.scope = coalesce(p_scope, '') and (p_kinds is null or b.kind = any(p_kinds))
$$;

create or replace function _sa_cn_cut(p text, n int)
returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '\r', '', 'g')), n)
$$;

-- вопросы теста: только целые (вопрос, 2–4 варианта, верный — один из них), не больше 12
create or replace function _sa_cn_questions(p jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('q', _sa_cn_cut(x->>'q', 400),
           'options', (select jsonb_agg(_sa_cn_cut(o, 200) order by i) from jsonb_array_elements_text(x->'options') with ordinality z(o, i)),
           'correct', (x->>'correct')::int,
           'explanation', _sa_cn_cut(x->>'explanation', 500)) order by n), '[]'::jsonb)
    from (select x, n from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality y(x, n)
           where jsonb_typeof(x) = 'object'
             and _sa_cn_cut(x->>'q', 400) <> ''
             and jsonb_typeof(x->'options') = 'array'
             and jsonb_array_length(x->'options') between 2 and 4
             and not exists (select 1 from jsonb_array_elements(x->'options') o where jsonb_typeof(o) <> 'string' or _sa_cn_cut(o #>> '{}', 200) = '')
             and case when coalesce(x->>'correct', '') ~ '^[0-3]$' then (x->>'correct')::int < jsonb_array_length(x->'options') else false end
           order by n limit 12) q
$$;

-- ── 3) Прочитать: сеть, своё заведение (сети — любое), соседи ──────────────────────────────────────
create or replace function concept_get(p_token text, p_restaurant text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; mine text; rest text; net_ boolean; others jsonb; venues jsonb; rn text; rv text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  net_ := coalesce((c->>'network')::boolean, false);
  mine := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  rest := coalesce(nullif(btrim(coalesce(p_restaurant, '')), ''), mine);
  if rest is distinct from mine and not net_ then rest := mine; end if;   -- чужое заведение целиком — только сети
  select coalesce(jsonb_agg(jsonb_build_object('name', s.scope, 'blocks', _sa_cn_list(s.scope, _sa_cn_public())) order by s.scope), '[]'::jsonb)
    into others
    from (select distinct b.scope from sa_concept_blocks b where b.scope <> '' and b.scope is distinct from rest and b.kind = any(_sa_cn_public())) s;
  if net_ then
    select coalesce(jsonb_agg(x order by x), '[]'::jsonb) into venues
      from (select distinct e.restaurant x from employees e where coalesce(e.status, 'active') = 'active' and coalesce(e.restaurant, '') <> ''
            union select distinct b.scope from sa_concept_blocks b where b.scope <> '') v;
  end if;
  select r.ver into rn from sa_concept_reads r where r.emp_id = c->>'id' and r.scope = '';
  if rest is not null then select r.ver into rv from sa_concept_reads r where r.emp_id = c->>'id' and r.scope = rest; end if;
  return jsonb_build_object('ok', true, 'mine', mine, 'restaurant', rest,
    'net', jsonb_build_object('blocks', _sa_cn_list(''), 'ver', _sa_cn_ver('')),
    'venue', case when rest is null then null else jsonb_build_object('name', rest, 'blocks', _sa_cn_list(rest), 'ver', _sa_cn_ver(rest)) end,
    'others', others,
    'read', jsonb_build_object('net', rn, 'venue', rv),
    'can', jsonb_build_object('net', _sa_cn_can(c, ''), 'venue', rest is not null and _sa_cn_can(c, rest)),
    'venues', venues);
end; $$;

-- ── 4) Правка блока ──────────────────────────────────────────────────────────────────────────────
create or replace function concept_save(p_token text, p_block jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; kd text; ttl text; bd text; ph jsonb := '[]'::jsonb; tr text[]; qs jsonb; so int; bid bigint; b sa_concept_blocks; x jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_block is null or jsonb_typeof(p_block) <> 'object' or length(p_block::text) > 60000 then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  sc := btrim(coalesce(p_block->>'scope', ''));
  if not _sa_cn_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  kd := coalesce(p_block->>'kind', '');
  if not (kd = any(_sa_cn_kinds())) then return jsonb_build_object('ok', false, 'error', 'bad_kind'); end if;
  ttl := _sa_cn_cut(p_block->>'title', 80);
  bd := _sa_cn_cut(p_block->>'body', 6000);
  if ttl = '' then return jsonb_build_object('ok', false, 'error', 'no_title'); end if;
  -- фото: только загруженные для этого же заведения (или сети), не больше восьми
  if jsonb_typeof(p_block->'photos') = 'array' then
    for x in select y from jsonb_array_elements(p_block->'photos') y limit 8 loop
      if jsonb_typeof(x) = 'object' and coalesce(x->>'id', '') ~ '^[0-9]{1,15}$'
         and exists (select 1 from sa_concept_photos p where p.id = (x->>'id')::bigint and p.scope = sc)
         and not ph @> jsonb_build_array(jsonb_build_object('id', (x->>'id')::bigint)) then
        ph := ph || jsonb_build_array(jsonb_build_object('id', (x->>'id')::bigint, 'cap', _sa_cn_cut(x->>'cap', 120)));
      end if;
    end loop;
  end if;
  if bd = '' and jsonb_array_length(ph) = 0 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  select coalesce(array_agg(distinct t order by t), '{}'::text[]) into tr
    from jsonb_array_elements_text(case when jsonb_typeof(p_block->'tracks') = 'array' then p_block->'tracks' else '[]'::jsonb end) t
   where t = any(_sa_cn_tracks());
  qs := _sa_cn_questions(p_block->'questions');
  so := case when coalesce(p_block->>'sort', '') ~ '^-?[0-9]{1,6}$' then (p_block->>'sort')::int end;
  if coalesce(p_block->>'id', '') ~ '^[0-9]{1,15}$' then
    bid := (p_block->>'id')::bigint;
    update sa_concept_blocks set kind = kd, title = ttl, body = bd, photos = ph, tracks = tr, questions = qs, sort = coalesce(so, sort),
           updated_at = now(), updated_by = c->>'id', updated_name = c->>'who'
     where id = bid and scope = sc
    returning * into b;
    if b.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  else
    select count(*) into n from sa_concept_blocks where scope = sc;
    if n >= 40 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
    insert into sa_concept_blocks (scope, kind, title, body, photos, tracks, questions, sort, updated_by, updated_name)
    values (sc, kd, ttl, bd, ph, tr, qs, coalesce(so, (select coalesce(max(sort), 0) + 1 from sa_concept_blocks where scope = sc)), c->>'id', c->>'who')
    returning * into b;
  end if;
  return jsonb_build_object('ok', true, 'block', _sa_cn_block(b), 'ver', _sa_cn_ver(sc));
end; $$;

create or replace function concept_delete(p_token text, p_id bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; b sa_concept_blocks;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into b from sa_concept_blocks where id = p_id;
  if b.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not _sa_cn_can(c, b.scope) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  delete from sa_concept_blocks where id = b.id;
  -- фото этого блока, которые больше нигде не стоят
  delete from sa_concept_photos p
   where p.scope = b.scope
     and p.id in (select (x->>'id')::bigint from jsonb_array_elements(b.photos) x where coalesce(x->>'id', '') ~ '^[0-9]{1,15}$')
     and not exists (select 1 from sa_concept_blocks o, jsonb_array_elements(o.photos) y where o.scope = b.scope and (y->>'id')::bigint = p.id);
  return jsonb_build_object('ok', true, 'ver', _sa_cn_ver(b.scope));
end; $$;

-- порядок блоков: ids — в нужном порядке; чужие и лишние номера пропускаются
create or replace function concept_order(p_token text, p_scope text, p_ids bigint[])
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  sc := btrim(coalesce(p_scope, ''));
  if not _sa_cn_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_ids is null or cardinality(p_ids) > 60 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  update sa_concept_blocks b set sort = o.i
    from unnest(p_ids) with ordinality o(id, i)
   where b.id = o.id and b.scope = sc;
  return jsonb_build_object('ok', true);
end; $$;

-- ── 5) Фото ──────────────────────────────────────────────────────────────────────────────────────
create or replace function concept_photo_put(p_token text, p_scope text, p_full text, p_thumb text, p_w int default null, p_h int default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; pid bigint; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  sc := btrim(coalesce(p_scope, ''));
  if not _sa_cn_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if coalesce(p_full, '') !~ '^[A-Za-z0-9+/]+={0,2}$' or coalesce(p_thumb, '') !~ '^[A-Za-z0-9+/]+={0,2}$'
     or length(p_full) > 640000 or length(p_thumb) > 110000 or length(p_full) < 100 then
    return jsonb_build_object('ok', false, 'error', 'bad_photo');
  end if;
  -- загруженные, но так и не сохранённые в блок фото этого заведения — через два дня в корзину
  delete from sa_concept_photos p
   where p.scope = sc and p.created_at < now() - interval '2 days'
     and not exists (select 1 from sa_concept_blocks o, jsonb_array_elements(o.photos) y where o.scope = sc and (y->>'id')::bigint = p.id);
  select count(*) into n from sa_concept_photos where scope = sc;
  if n >= 200 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  insert into sa_concept_photos (scope, data, thumb, w, h, emp_id)
  values (sc, p_full, p_thumb, case when p_w between 1 and 10000 then p_w end, case when p_h between 1 and 10000 then p_h end, c->>'id')
  returning id into pid;
  return jsonb_build_object('ok', true, 'id', pid);
end; $$;

create or replace function concept_photo(p_token text, p_id bigint, p_full boolean default false)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; p sa_concept_photos;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into p from sa_concept_photos where id = p_id;
  if p.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'data', case when coalesce(p_full, false) then p.data else p.thumb end, 'mime', p.mime, 'w', p.w, 'h', p.h);
end; $$;

-- ── 6) «Прочитал(а)» и кто прочитал ──────────────────────────────────────────────────────────────
create or replace function concept_read(p_token text, p_scope text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; v text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  sc := btrim(coalesce(p_scope, ''));
  if sc <> '' and sc is distinct from c->>'restaurant' then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  v := _sa_cn_ver(sc);
  if v = '' then return jsonb_build_object('ok', true, 'ver', ''); end if;
  insert into sa_concept_reads (emp_id, scope, ver) values (c->>'id', sc, v)
  on conflict (emp_id, scope) do update set ver = excluded.ver, read_at = now();
  return jsonb_build_object('ok', true, 'ver', v);
end; $$;

create or replace function concept_reads(p_token text, p_restaurant text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; vn text; vv text; rows_ jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := coalesce(nullif(btrim(coalesce(p_restaurant, '')), ''), c->>'restaurant');
  if rest is distinct from c->>'restaurant' and not coalesce((c->>'network')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  vn := _sa_cn_ver(''); vv := _sa_cn_ver(rest);
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id::text, 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
           'pos', lower(coalesce(e.position, '')),
           'net', vn = '' or coalesce(rn.ver = vn, false), 'venue', vv = '' or coalesce(rv.ver = vv, false),
           'at', greatest(rn.read_at, rv.read_at))
           order by (vn = '' or coalesce(rn.ver = vn, false)) and (vv = '' or coalesce(rv.ver = vv, false)), e.name, e.surname, e.id::text), '[]'::jsonb)
    into rows_
    from employees e
    left join sa_concept_reads rn on rn.emp_id = e.id::text and rn.scope = ''
    left join sa_concept_reads rv on rv.emp_id = e.id::text and rv.scope = rest
   where e.restaurant = rest and coalesce(e.status, 'active') = 'active' and not coalesce(e.is_admin, false)
     and e.id::text <> c->>'id';   -- себя в списке не показываем: «Ещё нет: …» — про команду
  return jsonb_build_object('ok', true, 'restaurant', rest, 'net_ver', vn, 'venue_ver', vv, 'rows', rows_);
end; $$;

-- ── 7) «Сообщить команде»: бот в Telegram (этап 48 — и на телефон), раз в день на человека ────────
create or replace function concept_notify(p_token text, p_scope text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; txt text; e record; chat bigint; n int := 0; m int := 0; ready boolean := false;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  sc := btrim(coalesce(p_scope, ''));
  if not _sa_cn_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if _sa_cn_ver(sc) = '' then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  txt := 'Обновили «О нас»: ' || case when sc = '' then 'концепция и стандарты сети.' else 'концепция и стандарты «' || sc || '».' end ||
    E'\n' || 'Открой и отметь «Прочитал(а)».';
  if to_regprocedure('public._sa_tg_ready()') is not null and to_regprocedure('public._sa_tg_chat(text,text)') is not null
     and to_regprocedure('public._sa_tg_once(text,date,text)') is not null and to_regprocedure('public._sa_tz(text)') is not null then
    ready := _sa_tg_ready();
  end if;
  for e in select x.id::text id, x.restaurant from employees x
            where coalesce(x.status, 'active') = 'active' and x.id::text <> c->>'id'
              and (sc = '' or x.restaurant = sc)
            order by x.id::text loop
    m := m + 1;
    if not ready then continue; end if;
    chat := _sa_tg_chat(e.id, 'about');
    if chat is null then continue; end if;
    if not _sa_tg_once(e.id, (now() at time zone _sa_tz(e.restaurant))::date, 'about') then continue; end if;
    perform sa_tg_send(chat, txt, 'О нас', 'about');
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'sent', n, 'people', m, 'bot', ready);
end; $$;

-- ── 8) Права ─────────────────────────────────────────────────────────────────────────────────────
revoke all on function _sa_cn_kinds(), _sa_cn_tracks(), _sa_cn_public(), _sa_cn_can(jsonb, text), _sa_cn_ver(text),
  _sa_cn_block(sa_concept_blocks), _sa_cn_list(text, text[]), _sa_cn_cut(text, int), _sa_cn_questions(jsonb) from public, anon, authenticated;
revoke all on function concept_get(text, text), concept_save(text, jsonb), concept_delete(text, bigint), concept_order(text, text, bigint[]),
  concept_photo_put(text, text, text, text, int, int), concept_photo(text, bigint, boolean), concept_read(text, text),
  concept_reads(text, text), concept_notify(text, text) from public;
grant execute on function concept_get(text, text), concept_save(text, jsonb), concept_delete(text, bigint), concept_order(text, text, bigint[]),
  concept_photo_put(text, text, text, text, int, int), concept_photo(text, bigint, boolean), concept_read(text, text),
  concept_reads(text, text), concept_notify(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'о нас: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('concept_get', 'concept_save', 'concept_delete', 'concept_order', 'concept_photo_put', 'concept_photo',
                       'concept_read', 'concept_reads', 'concept_notify')) || ' функций из 9' ||
  ' · блоков: ' || (select count(*) from sa_concept_blocks) ||
  ' · бот: ' || case when to_regprocedure('public._sa_tg_ready()') is not null then 'сообщает команде' else 'нет (этап 25)' end as result;
