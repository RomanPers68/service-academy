-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 57 (v191, Доп. 516): раздел «О нас» в треках — своё название, «для ознакомления» или «в зачёт», зачёт по роли.
--
-- Владелец (21.11): «Добавил концепцию холдинга, а приложение тему назвало «Наш ресторан». Мы можем добавить
-- возможность дописывать название блока?»; про зачёт: «Он должен учитывать только роль, в которой его прошли.
-- Единственное, вопрос! Может концепцию сделаем как ознакомительный блок?»
--   • Раздел из «О нас» стоит первым в каждом треке и по умолчанию называется «Наш ресторан» с подзаголовком
--     «Концепция и стандарты». Теперь название и подзаголовок можно задать: для всей сети (владелец и руководящий
--     состав) и для своего заведения (его руководители; владелец и руководящий состав — для любого). У сотрудника
--     название заведения главнее названия сети, пусто — как у сети, у сети пусто — «Наш ресторан».
--   • Как проходить раздел: mode 'info' — для ознакомления (в прогресс трека, отчёт и экзамен не идёт, тест —
--     самопроверка), 'credit' — в зачёт; пусто — как у сети, у сети пусто — для ознакомления.
--   • sa_concept_meta: scope ('' — вся сеть, иначе заведение), title (до 40 знаков), sub (до 60), mode.
--   • concept_meta_set(token, scope, title, sub, mode) — задать; null — не трогать, всё пусто — вернуть как было.
--   • concept_get отдаёт ещё meta: { net: { title, sub, mode }, venue: { … } | null }. Остальное — как в этапе 49.
--   • Зачёт по роли: уроки раздела раньше были одни на все треки (cms-l-cn-idea), с v191 у каждого трека свои
--     (cms-l-cn-spg-idea). Пройденное раньше переезжает в ту роль, в которой его прошли: progress и scores — по их
--     роли, quiz_events — по role_id, quiz_done (тест раздела) — по роли, в которой человек проходил уроки раздела.
-- Нужен этап 49 (концепция). Можно запускать повторно. Supabase → SQL Editor → New query → вставить файл → Run.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_cn_can(jsonb,text)') is null or to_regclass('public.sa_concept_blocks') is null then
    raise exception 'Сначала этап 49 (supabase-stage49-concept.sql): «О нас», концепция и стандарты';
  end if;
end $$;

-- ── 1) Таблица ───────────────────────────────────────────────────────────────────────────────────
create table if not exists sa_concept_meta (
  scope text primary key,
  title text not null default '',
  sub text not null default '',
  mode text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text,
  updated_name text
);
alter table sa_concept_meta add column if not exists mode text not null default '';
alter table sa_concept_meta enable row level security;
revoke all on table sa_concept_meta from anon, authenticated;

-- ── 2) Раздел одной части: { title, sub, mode } (пусто — не задано) ─────────────────────────────────
create or replace function _sa_cn_meta(p_scope text)
returns jsonb language sql stable security definer set search_path to public as $$
  select coalesce((select jsonb_build_object('title', m.title, 'sub', m.sub, 'mode', m.mode) from sa_concept_meta m where m.scope = coalesce(p_scope, '')),
                  jsonb_build_object('title', '', 'sub', '', 'mode', ''))
$$;

-- ── 3) Задать: сеть — владелец и руководящий состав, заведение — ещё и его руководители. null — не трогать ─────
drop function if exists concept_meta_set(text, text, text, text);   -- было в черновике этапа: без mode
create or replace function concept_meta_set(p_token text, p_scope text, p_title text default null, p_sub text default null, p_mode text default null)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; sc text; t text; s text; md text; old sa_concept_meta;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  sc := btrim(coalesce(p_scope, ''));
  if not _sa_cn_can(c, sc) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_mode is not null and p_mode not in ('', 'info', 'credit') then return jsonb_build_object('ok', false, 'error', 'bad_mode'); end if;
  select * into old from sa_concept_meta where scope = sc;
  t := case when p_title is null then coalesce(old.title, '') else left(btrim(regexp_replace(p_title, '\s+', ' ', 'g')), 40) end;
  s := case when p_sub is null then coalesce(old.sub, '') else left(btrim(regexp_replace(p_sub, '\s+', ' ', 'g')), 60) end;
  md := coalesce(p_mode, old.mode, '');
  if t = '' and s = '' and md = '' then
    delete from sa_concept_meta where scope = sc;   -- как было: «Наш ресторан», для ознакомления (или как у сети)
  else
    insert into sa_concept_meta (scope, title, sub, mode, updated_at, updated_by, updated_name)
    values (sc, t, s, md, now(), c->>'id', c->>'who')
    on conflict (scope) do update set title = excluded.title, sub = excluded.sub, mode = excluded.mode, updated_at = now(),
      updated_by = excluded.updated_by, updated_name = excluded.updated_name;
  end if;
  return jsonb_build_object('ok', true, 'meta', _sa_cn_meta(sc));
end; $$;

-- ── 4) concept_get — как в этапе 49, плюс meta ─────────────────────────────────────────────────────
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
    'venues', venues,
    'meta', jsonb_build_object('net', _sa_cn_meta(''), 'venue', case when rest is null then null else _sa_cn_meta(rest) end));
end; $$;

-- ── 5) Зачёт по роли: пройденное раньше — в ту роль, в которой его прошли ───────────────────────────────
-- Старый номер: cms-l-cn-<вид> (cms-q-cn-<вид> у теста); новый: cms-l-cn-<трек>-<вид>. Трогаются только старые номера,
-- поэтому повторный запуск ничего не меняет. Таблицы и столбцы — какие есть (как в my_state): чего нет, то пропускаем.
do $$
declare tr text := '^(seasonal|core|spg|bar|manager|service_manager)-'; n int; k int := 0;
begin
  if to_regclass('public.progress') is not null then
    begin
      -- уже есть новый номер для той же роли — старый просто лишний
      execute $q$delete from progress p where p.lesson_id ~ '^cms-l-cn-' and substr(p.lesson_id, 10) !~ $1
        and exists (select 1 from progress x where x.user_id = p.user_id and x.lesson_id = 'cms-l-cn-' || p.role || '-' || substr(p.lesson_id, 10))$q$ using tr;
      execute $q$update progress set lesson_id = 'cms-l-cn-' || role || '-' || substr(lesson_id, 10)
        where lesson_id ~ '^cms-l-cn-' and substr(lesson_id, 10) !~ $1 and (role || '-') ~ $1$q$ using tr;
      get diagnostics n = row_count; k := k + n;
    exception when others then raise notice 'progress: %', sqlerrm; end;
  end if;
  if to_regclass('public.scores') is not null then
    begin
      execute $q$update scores set quiz_id = 'cms-q-cn-' || role || '-' || substr(quiz_id, 10)
        where quiz_id ~ '^cms-q-cn-' and substr(quiz_id, 10) !~ $1 and (role || '-') ~ $1$q$ using tr;
    exception when others then raise notice 'scores: %', sqlerrm; end;
  end if;
  if to_regclass('public.quiz_events') is not null then
    begin
      execute $q$update quiz_events set lesson_id = 'cms-q-cn-' || role_id || '-' || substr(lesson_id, 10)
        where lesson_id ~ '^cms-q-cn-' and substr(lesson_id, 10) !~ $1 and (role_id || '-') ~ $1$q$ using tr;
    exception when others then raise notice 'quiz_events: %', sqlerrm; end;
  end if;
  if to_regclass('public.quiz_done') is not null and to_regclass('public.progress') is not null then
    begin
      -- тест раздела: роль — та, в которой человек раньше всего проходил уроки раздела
      execute $q$update quiz_done d set quiz_id = 'cms-q-cn-' || r.role || '-' || substr(d.quiz_id, 10)
        from (select distinct on (p.user_id) p.user_id, p.role from progress p
               where p.lesson_id ~ '^cms-l-cn-' and (p.role || '-') ~ $1 order by p.user_id, p.updated_at, p.id) r
        where r.user_id = d.user_id and d.quiz_id ~ '^cms-q-cn-' and substr(d.quiz_id, 10) !~ $1
          and not exists (select 1 from quiz_done x where x.user_id = d.user_id and x.quiz_id = 'cms-q-cn-' || r.role || '-' || substr(d.quiz_id, 10))$q$ using tr;
    exception when others then raise notice 'quiz_done: %', sqlerrm; end;
  end if;
  raise notice 'зачёт по роли: уроков раздела перенесено %', k;
end $$;

-- ── 6) Права ─────────────────────────────────────────────────────────────────────────────────────
revoke all on function _sa_cn_meta(text) from public, anon, authenticated;
revoke all on function concept_meta_set(text, text, text, text, text), concept_get(text, text) from public;
grant execute on function concept_meta_set(text, text, text, text, text), concept_get(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'название раздела: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('concept_meta_set', '_sa_cn_meta')) || ' функции из 2' ||
  ' · concept_get отдаёт название: ' || case when pg_get_functiondef('public.concept_get(text,text)'::regprocedure) like '%''meta''%' then 'да' else 'НЕТ' end ||
  ' · задано: ' || coalesce((select string_agg(case when m.scope = '' then 'сеть' else m.scope end || ' — «' || m.title || '»'
       || case m.mode when 'credit' then ' (в зачёт)' when 'info' then ' (для ознакомления)' else '' end, ', ' order by m.scope) from sa_concept_meta m), 'пока нигде') ||
  ' · старых номеров уроков раздела: ' || case when to_regclass('public.progress') is null then 'нет таблицы'
       else (select count(*)::text from progress where lesson_id ~ '^cms-l-cn-' and substr(lesson_id, 10) !~ '^(seasonal|core|spg|bar|manager|service_manager)-') end as result;
