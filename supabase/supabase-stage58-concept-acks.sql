-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 58 (v192, Доп. 517): «О нас» — лист ознакомления, «Что изменилось», история блоков и «Вернуть»,
-- концепция одним файлом, шаг новичка «Знакомство с компанией».
--
-- Владелец (23.11), про семь идей для «О нас»: «Ты правильно понял. Делаем все 7».
--   • «Ознакомлен(а)»: concept_read помнит, когда человек впервые отметил нынешнюю редакцию (раньше дата сдвигалась
--     при каждом нажатии). concept_get отдаёт ещё read_at — когда отметил, и net.at / venue.at — когда редакцию
--     меняли последний раз.
--   • concept_reads — для листа ознакомления: у каждого at — когда ознакомился с нынешней редакцией, was — последняя
--     отметка вообще (если нынешнюю ещё не видел, это дата прошлой), me — сам руководитель (в лист он тоже входит);
--     net_at и venue_at — даты редакций.
--   • История блоков: sa_concept_hist. Каждая правка текста, заголовка, фото, «для кого», вопросов или вида кладёт
--     прежнюю версию в историю (порядок блоков — не в счёт), удаление — весь блок. Пишет триггер, поэтому в историю
--     попадает правка из любой функции. На блок — 20 последних версий, удалённые блоки — полгода.
--   • concept_history(token, scope, id) — версии блока, новые первыми; без id — удалённые блоки части (сеть или
--     заведение). concept_revert(token, hid) — вернуть версию или удалённый блок (с тем же номером; фото — какие
--     сохранились). Править историю может тот же, кто правит блоки.
--   • concept_get отдаёт changes: что поменялось у сотрудника после его последнего «Ознакомлен(а)». Для блоков, которые
--     с тех пор правили, — текст, который он тогда видел (was), новые блоки (fresh), убранные (gone).
--   • Фото удалённых блоков и прежних версий не удаляются, пока на них ссылается история (concept_delete,
--     concept_photo_put).
--   • concept_ticket(token, kind, payload) — файл для Telegram, как у отчётов (этап 23, /api/report): concept_pdf —
--     «О нас» для печати (любой сотрудник), concept_acks_pdf — лист ознакомления (руководитель).
--   • concept_notify просит отметить «Ознакомлен(а)»; newbie_check принимает шаг d1e «Знакомство с компанией» (этап 41).
-- Нужны этапы 49 и 57. Можно запускать повторно. Supabase → SQL Editor → New query → вставить файл → Run.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_cn_can(jsonb,text)') is null or to_regclass('public.sa_concept_blocks') is null then
    raise exception 'Сначала этап 49 (supabase-stage49-concept.sql): «О нас», концепция и стандарты';
  end if;
  if to_regprocedure('public._sa_cn_meta(text)') is null then
    raise exception 'Сначала этап 57 (supabase-stage57-concept-title.sql): название раздела «О нас»';
  end if;
end $$;

-- ── 1) История блоков ────────────────────────────────────────────────────────────────────────────
create table if not exists sa_concept_hist (
  id bigserial primary key,
  block_id bigint not null,
  scope text not null default '',
  op text not null default 'edit',          -- edit — прежняя версия, delete — удалённый блок
  kind text not null,
  title text not null default '',
  body text not null default '',
  photos jsonb not null default '[]'::jsonb,
  tracks text[] not null default '{}'::text[],
  questions jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  created_at timestamptz,                   -- когда блок появился
  made_at timestamptz,                      -- когда сохранили эту версию
  made_by text,
  made_name text,
  gone_at timestamptz not null default now(),   -- когда её сменила следующая или блок удалили
  gone_by text,
  gone_name text
);
create index if not exists sa_concept_hist_block on sa_concept_hist (block_id, gone_at desc, id desc);
create index if not exists sa_concept_hist_scope on sa_concept_hist (scope, op, gone_at desc);
alter table sa_concept_hist enable row level security;
revoke all on table sa_concept_hist from anon, authenticated;

create or replace function _sa_cn_hist_trg()
returns trigger language plpgsql security definer set search_path to public as $$
begin
  if tg_op = 'UPDATE' then
    -- поменяли только порядок — не версия
    if (old.kind, old.title, old.body, old.photos, old.tracks, old.questions)
       is not distinct from (new.kind, new.title, new.body, new.photos, new.tracks, new.questions) then
      return new;
    end if;
    insert into sa_concept_hist (block_id, scope, op, kind, title, body, photos, tracks, questions, sort, created_at, made_at, made_by, made_name, gone_by, gone_name)
    values (old.id, old.scope, 'edit', old.kind, old.title, old.body, old.photos, old.tracks, old.questions, old.sort, old.created_at,
            old.updated_at, old.updated_by, old.updated_name, new.updated_by, new.updated_name);
    delete from sa_concept_hist h
     where h.block_id = old.id and h.op = 'edit'
       and h.id not in (select x.id from sa_concept_hist x where x.block_id = old.id and x.op = 'edit' order by x.gone_at desc, x.id desc limit 20);
    return new;
  end if;
  insert into sa_concept_hist (block_id, scope, op, kind, title, body, photos, tracks, questions, sort, created_at, made_at, made_by, made_name, gone_by, gone_name)
  values (old.id, old.scope, 'delete', old.kind, old.title, old.body, old.photos, old.tracks, old.questions, old.sort, old.created_at,
          old.updated_at, old.updated_by, old.updated_name,
          nullif(current_setting('sa.cn_by', true), ''), nullif(current_setting('sa.cn_name', true), ''));
  -- удалённые блоки — полгода, вместе с их прежними версиями
  delete from sa_concept_hist h
   where h.gone_at < now() - interval '180 days' and (h.op = 'delete' or not exists (select 1 from sa_concept_blocks x where x.id = h.block_id));
  return old;
end; $$;

drop trigger if exists sa_concept_blocks_hist on sa_concept_blocks;
create trigger sa_concept_blocks_hist before update or delete on sa_concept_blocks
  for each row execute function _sa_cn_hist_trg();

-- строка истории для экрана
create or replace function _sa_cn_hrow(h sa_concept_hist)
returns jsonb language sql stable as $$
  select jsonb_build_object('hid', h.id, 'id', h.block_id, 'scope', h.scope, 'op', h.op, 'kind', h.kind, 'title', h.title, 'body', h.body,
    'photos', h.photos, 'tracks', to_jsonb(h.tracks), 'questions', h.questions, 'made_at', h.made_at, 'made_name', h.made_name,
    'gone_at', h.gone_at, 'gone_name', h.gone_name)
$$;

-- когда редакцию части меняли последний раз: правка блока или удаление
create or replace function _sa_cn_at(p_scope text)
returns timestamptz language sql stable security definer set search_path to public as $$
  select greatest(
    (select max(b.updated_at) from sa_concept_blocks b where b.scope = coalesce(p_scope, '')),
    (select max(h.gone_at) from sa_concept_hist h
      where h.scope = coalesce(p_scope, '') and h.op = 'delete' and not exists (select 1 from sa_concept_blocks x where x.id = h.block_id)))
$$;

-- что поменялось в части после p_at: блоки, которые с тех пор правили (текст, который тогда был), новые и убранные
create or replace function _sa_cn_changes(p_scope text, p_at timestamptz)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('at', p_at,
    'was', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'kind', h.kind, 'title', h.title, 'body', h.body, 'photos', h.photos, 'tracks', to_jsonb(h.tracks))
             order by b.sort, b.id)
        from sa_concept_blocks b
        cross join lateral (select x.* from sa_concept_hist x where x.block_id = b.id and x.op = 'edit' and x.gone_at > p_at
                             order by x.gone_at, x.id limit 1) h
       where b.scope = coalesce(p_scope, '') and coalesce(b.created_at, p_at) <= p_at
         and (h.kind, h.title, h.body, h.photos, h.tracks) is distinct from (b.kind, b.title, b.body, b.photos, b.tracks)), '[]'::jsonb),
    'fresh', coalesce((
      select jsonb_agg(b.id order by b.sort, b.id) from sa_concept_blocks b where b.scope = coalesce(p_scope, '') and b.created_at > p_at), '[]'::jsonb),
    'gone', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.block_id, 'kind', h.kind, 'title', h.title, 'tracks', to_jsonb(h.tracks), 'at', h.gone_at)
             order by h.gone_at, h.id)
        from sa_concept_hist h
       where h.scope = coalesce(p_scope, '') and h.op = 'delete' and h.gone_at > p_at and coalesce(h.created_at, p_at) <= p_at
         and not exists (select 1 from sa_concept_blocks x where x.id = h.block_id)), '[]'::jsonb))
$$;

-- ── 2) «Ознакомлен(а)»: дата — первая отметка этой редакции ─────────────────────────────────────────
create or replace function concept_read(p_token text, p_scope text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; v text; at_ timestamptz;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  sc := btrim(coalesce(p_scope, ''));
  if sc <> '' and sc is distinct from c->>'restaurant' then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  v := _sa_cn_ver(sc);
  if v = '' then return jsonb_build_object('ok', true, 'ver', ''); end if;
  insert into sa_concept_reads (emp_id, scope, ver) values (c->>'id', sc, v)
  on conflict (emp_id, scope) do update set ver = excluded.ver,
    read_at = case when sa_concept_reads.ver = excluded.ver then sa_concept_reads.read_at else now() end
  returning read_at into at_;
  return jsonb_build_object('ok', true, 'ver', v, 'at', at_);
end; $$;

-- ── 3) concept_get — как в этапе 57, плюс read_at, даты редакций и changes ───────────────────────────
create or replace function concept_get(p_token text, p_restaurant text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; mine text; rest text; net_ boolean; others jsonb; venues jsonb; rn text; rv text; an timestamptz; av timestamptz;
  vn text; vv text := '';
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
  select r.ver, r.read_at into rn, an from sa_concept_reads r where r.emp_id = c->>'id' and r.scope = '';
  if rest is not null then select r.ver, r.read_at into rv, av from sa_concept_reads r where r.emp_id = c->>'id' and r.scope = rest; end if;
  vn := _sa_cn_ver('');
  if rest is not null then vv := _sa_cn_ver(rest); end if;
  return jsonb_build_object('ok', true, 'mine', mine, 'restaurant', rest,
    'net', jsonb_build_object('blocks', _sa_cn_list(''), 'ver', vn, 'at', _sa_cn_at('')),
    'venue', case when rest is null then null else jsonb_build_object('name', rest, 'blocks', _sa_cn_list(rest), 'ver', vv, 'at', _sa_cn_at(rest)) end,
    'others', others,
    'read', jsonb_build_object('net', rn, 'venue', rv),
    'read_at', jsonb_build_object('net', an, 'venue', av),
    'changes', jsonb_build_object(
      'net', case when an is not null and vn <> '' and rn is distinct from vn then _sa_cn_changes('', an) end,
      'venue', case when av is not null and vv <> '' and rv is distinct from vv then _sa_cn_changes(rest, av) end),
    'can', jsonb_build_object('net', _sa_cn_can(c, ''), 'venue', rest is not null and _sa_cn_can(c, rest)),
    'venues', venues,
    'meta', jsonb_build_object('net', _sa_cn_meta(''), 'venue', case when rest is null then null else _sa_cn_meta(rest) end));
end; $$;

-- ── 4) Лист ознакомления: все сотрудники заведения, у каждого — дата ───────────────────────────────
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
  select coalesce(jsonb_agg(x.j order by x.ok, x.nm, x.id), '[]'::jsonb) into rows_
    from (select e.id::text id, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) nm,
                 (vn = '' or coalesce(rn.ver = vn, false)) and (vv = '' or coalesce(rv.ver = vv, false)) ok,
                 jsonb_build_object('id', e.id::text, 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
                   'pos', lower(coalesce(e.position, '')),
                   'net', vn = '' or coalesce(rn.ver = vn, false), 'venue', vv = '' or coalesce(rv.ver = vv, false),
                   'at', case when (vn = '' or coalesce(rn.ver = vn, false)) and (vv = '' or coalesce(rv.ver = vv, false))
                              then greatest(case when vn <> '' then rn.read_at end, case when vv <> '' then rv.read_at end) end,
                   'was', greatest(rn.read_at, rv.read_at),
                   'me', e.id::text = c->>'id') j
            from employees e
            left join sa_concept_reads rn on rn.emp_id = e.id::text and rn.scope = ''
            left join sa_concept_reads rv on rv.emp_id = e.id::text and rv.scope = rest
           where e.restaurant = rest and coalesce(e.status, 'active') = 'active' and not coalesce(e.is_admin, false)) x;
  return jsonb_build_object('ok', true, 'restaurant', rest, 'net_ver', vn, 'venue_ver', vv, 'net_at', _sa_cn_at(''), 'venue_at', _sa_cn_at(rest), 'rows', rows_);
end; $$;

-- ── 5) История блока и «Вернуть» ───────────────────────────────────────────────────────────────────
create or replace function concept_history(p_token text, p_scope text default '', p_id bigint default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; out_ jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_id is not null then
    sc := coalesce((select b.scope from sa_concept_blocks b where b.id = p_id),
                   (select h.scope from sa_concept_hist h where h.block_id = p_id order by h.gone_at desc, h.id desc limit 1));
    if sc is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    if not _sa_cn_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
    select coalesce(jsonb_agg(_sa_cn_hrow(h) order by h.gone_at desc, h.id desc), '[]'::jsonb) into out_
      from (select * from sa_concept_hist x where x.block_id = p_id and x.op = 'edit' order by x.gone_at desc, x.id desc limit 20) h;
    return jsonb_build_object('ok', true, 'id', p_id, 'scope', sc, 'versions', out_);
  end if;
  sc := btrim(coalesce(p_scope, ''));
  if not _sa_cn_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select coalesce(jsonb_agg(_sa_cn_hrow(h) order by h.gone_at desc, h.id desc), '[]'::jsonb) into out_
    from (select * from sa_concept_hist x
           where x.scope = sc and x.op = 'delete' and not exists (select 1 from sa_concept_blocks b where b.id = x.block_id)
           order by x.gone_at desc, x.id desc limit 30) h;
  return jsonb_build_object('ok', true, 'scope', sc, 'gone', out_);
end; $$;

create or replace function concept_revert(p_token text, p_hid bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; h sa_concept_hist; b sa_concept_blocks; ph jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into h from sa_concept_hist where id = p_hid;
  if h.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not _sa_cn_can(c, h.scope) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  -- фото — только те, что ещё лежат в базе
  select coalesce(jsonb_agg(x order by i), '[]'::jsonb) into ph
    from jsonb_array_elements(case when jsonb_typeof(h.photos) = 'array' then h.photos else '[]'::jsonb end) with ordinality y(x, i)
   where coalesce(x->>'id', '') ~ '^[0-9]{1,15}$'
     and exists (select 1 from sa_concept_photos p where p.id = (x->>'id')::bigint and p.scope = h.scope);
  if btrim(h.body) = '' and jsonb_array_length(ph) = 0 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  select * into b from sa_concept_blocks where id = h.block_id;
  if b.id is not null then
    if b.scope is distinct from h.scope then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    update sa_concept_blocks set kind = h.kind, title = h.title, body = h.body, photos = ph, tracks = h.tracks, questions = h.questions,
           updated_at = now(), updated_by = c->>'id', updated_name = c->>'who'
     where id = b.id
    returning * into b;
  else
    select count(*) into n from sa_concept_blocks where scope = h.scope;
    if n >= 40 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
    insert into sa_concept_blocks (id, scope, kind, title, body, photos, tracks, questions, sort, created_at, updated_at, updated_by, updated_name)
    values (h.block_id, h.scope, h.kind, h.title, h.body, ph, h.tracks, h.questions, h.sort, coalesce(h.created_at, now()), now(), c->>'id', c->>'who')
    returning * into b;
    delete from sa_concept_hist where block_id = h.block_id and op = 'delete';   -- блок снова на месте
  end if;
  return jsonb_build_object('ok', true, 'block', _sa_cn_block(b), 'ver', _sa_cn_ver(b.scope));
end; $$;

-- ── 6) Удаление и фото: история держит фото, пока на них ссылается ─────────────────────────────────
create or replace function concept_delete(p_token text, p_id bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; b sa_concept_blocks;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into b from sa_concept_blocks where id = p_id;
  if b.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not _sa_cn_can(c, b.scope) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  -- кто удалил — для истории (триггер)
  perform set_config('sa.cn_by', coalesce(c->>'id', ''), true);
  perform set_config('sa.cn_name', coalesce(c->>'who', ''), true);
  delete from sa_concept_blocks where id = b.id;
  -- фото блока остаются: блок можно вернуть. Когда истории о нём не станет, их уберёт concept_photo_put
  return jsonb_build_object('ok', true, 'ver', _sa_cn_ver(b.scope));
end; $$;

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
  -- загруженные, но так и не сохранённые в блок фото этого заведения — через два дня в корзину (кроме тех, что в истории)
  delete from sa_concept_photos p
   where p.scope = sc and p.created_at < now() - interval '2 days'
     and not exists (select 1 from sa_concept_blocks o, jsonb_array_elements(o.photos) y where o.scope = sc and y->>'id' = p.id::text)
     and not exists (select 1 from sa_concept_hist o, jsonb_array_elements(o.photos) y where o.scope = sc and y->>'id' = p.id::text);
  select count(*) into n from sa_concept_photos where scope = sc;
  if n >= 200 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  insert into sa_concept_photos (scope, data, thumb, w, h, emp_id)
  values (sc, p_full, p_thumb, case when p_w between 1 and 10000 then p_w end, case when p_h between 1 and 10000 then p_h end, c->>'id')
  returning id into pid;
  return jsonb_build_object('ok', true, 'id', pid);
end; $$;

-- ── 7) «Сообщить команде»: теперь просим «Ознакомлен(а)» ────────────────────────────────────────────
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
    E'\n' || 'Посмотри, что изменилось, и отметь «Ознакомлен(а)».';
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

-- ── 8) Файл для Telegram: «О нас» для печати и лист ознакомления (билет, как у отчётов — этап 23) ────
create or replace function concept_ticket(p_token text, p_kind text, p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; t text; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_kind is null or p_kind not in ('concept_pdf', 'concept_acks_pdf') then return jsonb_build_object('ok', false, 'error', 'kind'); end if;
  if p_kind = 'concept_acks_pdf' and not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if to_regclass('public.report_tickets') is null then return jsonb_build_object('ok', false, 'error', 'no_reports'); end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return jsonb_build_object('ok', false, 'error', 'bad'); end if;
  n := octet_length(p_payload::text);
  if n > 3500000 then return jsonb_build_object('ok', false, 'error', 'too_big', 'size', n); end if;
  delete from report_tickets where expires_at < now();
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into report_tickets (ticket, emp_id, kind, payload, expires_at)
  values (t, c->>'id', p_kind, p_payload, now() + interval '3 minutes');
  return jsonb_build_object('ok', true, 'ticket', t);
end; $$;

-- ── 9) Новичок: шаг d1e «Знакомство с компанией» (этап 41) ─────────────────────────────────────────
do $outer$
begin
  if to_regclass('public.sa_newbies') is null or to_regprocedure('public._sa_nb_active(sa_newbies)') is null then
    raise notice 'Этапа 41 нет: шаг «Знакомство с компанией» сервер запомнит после этапа 41 и повтора этого этапа';
    return;
  end if;
  execute $fn$
create or replace function newbie_check(p_token text, p_steps text[], p_on boolean)
returns jsonb language plpgsql security definer set search_path to public as $body$
declare c jsonb; nb sa_newbies; s text; ch jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into nb from sa_newbies where emp_id = c->>'id' for update;
  if nb.emp_id is null or not _sa_nb_active(nb) then return jsonb_build_object('ok', false, 'error', 'not_newbie'); end if;
  ch := nb.checked;
  foreach s in array coalesce(p_steps[1:30], '{}'::text[]) loop
    continue when s is null or not (s = any (array['d1a', 'd1b', 'd1c', 'd1d', 'd1e', 'd2a', 'd2b', 'd2d', 'd3a']) or s ~ '^f:.{1,60}$');
    if coalesce(p_on, true) then ch := ch || jsonb_build_object(s, now()); else ch := ch - s; end if;
  end loop;
  update sa_newbies set checked = ch, updated_at = now() where emp_id = nb.emp_id;
  return jsonb_build_object('ok', true, 'checked', ch);
end; $body$
$fn$;
  execute 'grant execute on function newbie_check(text, text[], boolean) to anon, authenticated';
end $outer$;

-- ── 10) Права ────────────────────────────────────────────────────────────────────────────────────
revoke all on function _sa_cn_hist_trg(), _sa_cn_hrow(sa_concept_hist), _sa_cn_at(text), _sa_cn_changes(text, timestamptz)
  from public, anon, authenticated;
revoke all on function concept_read(text, text), concept_get(text, text), concept_reads(text, text), concept_history(text, text, bigint),
  concept_revert(text, bigint), concept_delete(text, bigint), concept_photo_put(text, text, text, text, int, int), concept_notify(text, text),
  concept_ticket(text, text, jsonb) from public;
grant execute on function concept_read(text, text), concept_get(text, text), concept_reads(text, text), concept_history(text, text, bigint),
  concept_revert(text, bigint), concept_delete(text, bigint), concept_photo_put(text, text, text, text, int, int), concept_notify(text, text),
  concept_ticket(text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

select 'лист ознакомления: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('concept_history', 'concept_revert', 'concept_ticket', '_sa_cn_changes', '_sa_cn_at', '_sa_cn_hrow', '_sa_cn_hist_trg')) || ' функций из 7' ||
  ' · история пишется: ' || case when exists (select 1 from pg_trigger where tgname = 'sa_concept_blocks_hist' and not tgisinternal) then 'да' else 'НЕТ' end ||
  ' · версий в истории: ' || (select count(*) from sa_concept_hist where op = 'edit') ||
  ', удалённых блоков: ' || (select count(*) from sa_concept_hist h where h.op = 'delete' and not exists (select 1 from sa_concept_blocks b where b.id = h.block_id)) ||
  ' · шаг новичка: ' || case when to_regprocedure('public.newbie_check(text,text[],boolean)') is null then 'нет этапа 41'
       when pg_get_functiondef('public.newbie_check(text,text[],boolean)'::regprocedure) like '%d1e%' then 'да' else 'НЕТ' end ||
  ' · файл в Telegram: ' || case when to_regclass('public.report_tickets') is null then 'нет этапа 23' else 'да' end as result;
