-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 33 (v83, Доп. 396): случаи из нашего зала.
--
-- Живые истории смены становятся тренировкой команды:
--   • case_submit — сотрудник рассказывает случай: что случилось, что сделал, чем закончилось (можно без своего
--     имени). Руководителям заведения бот пишет о новом случае (раз в день, вид «Случаи из зала»);
--   • case_review — руководитель или старший разбирает: превращает случай в ситуацию для тренировки (вопрос,
--     варианты, верный, разбор, «как было на самом деле») и публикует, отвечает «не для тренировки» с пояснением
--     или удаляет. Автору бот сообщает, что случай разобрали. Свой неразобранный случай автор может удалить сам;
--   • case_list — сотруднику: опубликованные случаи заведения (только ситуация, которую написал руководитель, без
--     исходного рассказа) и свои случаи с ответом руководителя; руководителю — ещё «Ждут разбора» и разобранные.
--     p_mode = 'counts' — только числа (для «Смены»: сколько случаев, сколько новых, сколько ждут разбора) и самый
--     свежий опубликованный случай (для брифинга смены, v82).
--
-- Нужны этапы 21, 22б, 24 и 25 (лучше и 32: тогда «Случаи из зала» появятся в «Напоминаниях в Telegram»).
-- Ничего не удаляет. Можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is null then
    raise exception 'Сначала этап 22б (supabase-stage22b-telegram-reminders.sql): нужен бот — таблица tg_links и sa_tg_send';
  end if;
  if to_regprocedure('public._sa_tz(text)') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужен часовой пояс заведения _sa_tz';
  end if;
  if to_regclass('public.sa_notify_prefs') is null or to_regprocedure('public._sa_tg_chat(text,text)') is null then
    raise exception 'Сначала этап 25 (supabase-stage25-live.sql): нужны настройки сообщений sa_notify_prefs и _sa_tg_chat';
  end if;
end $$;

-- ── 1) Таблица и вид сообщений ─────────────────────────────────────────────────
create table if not exists sa_cases (
  id           bigserial primary key,
  restaurant   text not null,
  author_id    text not null,
  author_name  text not null default '',
  anon         boolean not null default false,   -- автор попросил не показывать имя
  story        text not null,                    -- что случилось
  did          text not null default '',         -- что сделал(а)
  outcome      text not null default '',         -- ok | saved | bad | unsure
  status       text not null default 'new',      -- new | published | declined
  sit          jsonb,                            -- ситуация для тренировки (пишет руководитель)
  note         text not null default '',         -- слово руководителя автору
  reviewer_id  text,
  reviewer_name text,
  reviewed_at  timestamptz,
  published_at timestamptz,                      -- первая публикация: по ней «новые» в «Смене»
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists sa_cases_rest_idx on sa_cases (restaurant, status, created_at desc);
create index if not exists sa_cases_author_idx on sa_cases (author_id, created_at desc);
alter table sa_cases enable row level security;
revoke all on table sa_cases from public, anon, authenticated;
revoke all on sequence sa_cases_id_seq from public, anon, authenticated;

alter table sa_notify_prefs add column if not exists cases boolean not null default true;

-- ── 2) Как случай выглядит снаружи ─────────────────────────────────────────────
-- p_view: 'team' — ситуация для тренировки (без рассказа автора), 'mine' — свой случай, 'lead' — всё.
create or replace function _sa_case_json(c sa_cases, p_view text)
returns jsonb language sql stable security definer set search_path to public as $$
  select case p_view
    when 'team' then jsonb_build_object('id', c.id, 'sit', c.sit, 'at', c.published_at,
      'author', case when c.anon or not coalesce((c.sit->>'show_author')::boolean, true) then null else c.author_name end)
    when 'mine' then jsonb_build_object('id', c.id, 'story', c.story, 'did', c.did, 'outcome', c.outcome, 'anon', c.anon,
      'status', c.status, 'note', c.note, 'reviewer', c.reviewer_name, 'at', c.created_at, 'reviewed_at', c.reviewed_at,
      'sit', case when c.status = 'published' then c.sit end)
    else jsonb_build_object('id', c.id, 'story', c.story, 'did', c.did, 'outcome', c.outcome, 'anon', c.anon,
      'author', c.author_name, 'author_id', c.author_id, 'status', c.status, 'note', c.note, 'sit', c.sit,
      'reviewer', c.reviewer_name, 'at', c.created_at, 'reviewed_at', c.reviewed_at, 'published_at', c.published_at)
  end
$$;

-- ── 3) Рассказать случай ───────────────────────────────────────────────────────
create or replace function case_submit(p_token text, p_story text, p_did text, p_outcome text, p_anon boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; st text; dd text; oc text; n int; nid bigint; l record; chat bigint; sent int := 0; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  st := btrim(regexp_replace(coalesce(p_story, ''), '[[:space:]]+', ' ', 'g'));
  dd := btrim(regexp_replace(coalesce(p_did, ''), '[[:space:]]+', ' ', 'g'));
  oc := coalesce(nullif(btrim(coalesce(p_outcome, '')), ''), '');
  if length(st) < 20 then return jsonb_build_object('ok', false, 'error', 'short'); end if;
  if length(st) > 1000 or length(dd) > 800 or oc not in ('', 'ok', 'saved', 'bad', 'unsure') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  ld := (now() at time zone _sa_tz(rest))::date;
  select count(*) into n from sa_cases
   where author_id = c->>'id' and (created_at at time zone _sa_tz(rest))::date = ld;
  if n >= 5 then return jsonb_build_object('ok', false, 'error', 'limit'); end if;
  insert into sa_cases (restaurant, author_id, author_name, anon, story, did, outcome)
  values (rest, c->>'id', coalesce(c->>'who', ''), coalesce(p_anon, false), st, dd, oc)
  returning id into nid;
  -- Telegram: руководителям заведения, раз в день на человека (дальше — счётчик в приложении)
  if _sa_tg_ready() then
    who := case when coalesce(p_anon, false) then 'сотрудник (без имени)' else coalesce(nullif(c->>'who', ''), 'сотрудник') end;
    for l in select tl.emp_id from tg_links tl join employees e on e.id::text = tl.emp_id
              where tl.remind and tl.emp_id <> c->>'id' and tl.restaurant is not distinct from rest
                and lower(coalesce(to_jsonb(e)->>'position', '')) in ('senior', 'manager')
                and coalesce(to_jsonb(e)->>'status', 'active') = 'active'
              order by tl.emp_id loop
      chat := _sa_tg_chat(l.emp_id, 'cases');
      if chat is null then continue; end if;
      if not _sa_tg_once(l.emp_id, ld, 'case_new') then continue; end if;
      perform sa_tg_send(chat, 'Новый случай из зала. Рассказал' || case when coalesce(p_anon, false) then ' ' else '(а) ' end || who || ':' ||
        E'\n«' || left(st, 220) || case when length(st) > 220 then '…' else '' end || '»' ||
        E'\n\nРазобрать его для тренировки команды можно в приложении.', 'Разобрать', 'cases');
      sent := sent + 1;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'id', nid, 'sent', sent);
end; $$;

-- ── 4) Разобрать: опубликовать, не для тренировки, удалить ──────────────────────
-- p_sit для publish: { scene, question, options[2..4], correct, why, real, show_author }.
create or replace function case_review(p_token text, p_id bigint, p_action text, p_sit jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; r sa_cases; lead boolean; opts jsonb; n int; nd int; k int; sc text; why text; nt text; s jsonb;
  ld date; chat bigint; msg text; was text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  lead := coalesce((c->>'lead')::boolean, false);
  select * into r from sa_cases where id = p_id;
  if r.id is null or r.restaurant is distinct from rest then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  -- свой неразобранный случай автор может удалить сам; остальное — руководитель или старший
  if p_action = 'delete' and r.author_id = c->>'id' and r.status = 'new' then
    delete from sa_cases where id = r.id;
    return jsonb_build_object('ok', true, 'status', 'deleted');
  end if;
  if not lead then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  nt := left(btrim(coalesce(p_note, '')), 500);
  was := r.status;
  if p_action = 'delete' then
    delete from sa_cases where id = r.id;
    return jsonb_build_object('ok', true, 'status', 'deleted');
  elsif p_action = 'decline' then
    update sa_cases set status = 'declined', note = nt, reviewer_id = c->>'id', reviewer_name = c->>'who',
      reviewed_at = now(), updated_at = now() where id = r.id;
  elsif p_action = 'publish' then
    if p_sit is null or jsonb_typeof(p_sit) <> 'object' or jsonb_typeof(p_sit->'options') is distinct from 'array' then
      return jsonb_build_object('ok', false, 'error', 'bad_sit');
    end if;
    sc := btrim(coalesce(p_sit->>'scene', ''));
    why := btrim(coalesce(p_sit->>'why', ''));
    select jsonb_agg(left(btrim(x), 300) order by i), count(*), count(distinct lower(btrim(x)))
      into opts, n, nd
      from jsonb_array_elements_text(p_sit->'options') with ordinality as t(x, i);
    k := case when coalesce(p_sit->>'correct', '') ~ '^\d{1,2}$' then (p_sit->>'correct')::int else -1 end;
    if length(sc) < 10 or length(sc) > 1200 or length(why) < 5 or length(why) > 1200
       or coalesce(n, 0) < 2 or n > 4 or nd <> n or k < 0 or k >= n
       or exists (select 1 from jsonb_array_elements_text(opts) x where btrim(x) = '')
       or length(coalesce(p_sit->>'question', '')) > 200 or length(coalesce(p_sit->>'real', '')) > 1200 then
      return jsonb_build_object('ok', false, 'error', 'bad_sit');
    end if;
    s := jsonb_build_object('scene', sc, 'question', coalesce(nullif(btrim(coalesce(p_sit->>'question', '')), ''), 'Как поступить?'),
      'options', opts, 'correct', k, 'why', why, 'real', btrim(coalesce(p_sit->>'real', '')),
      'show_author', coalesce((p_sit->>'show_author')::boolean, true) and not r.anon);
    update sa_cases set status = 'published', sit = s, note = nt, reviewer_id = c->>'id', reviewer_name = c->>'who',
      reviewed_at = now(), published_at = coalesce(published_at, now()), updated_at = now() where id = r.id;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  -- автору — когда случай разобрали впервые (или ответили «не для тренировки»); правки опубликованного — без сообщений
  if was = 'new' and r.author_id <> c->>'id' and _sa_tg_ready() then
    chat := _sa_tg_chat(r.author_id, 'cases');
    ld := (now() at time zone _sa_tz(rest))::date;
    if chat is not null and _sa_tg_once(r.author_id, ld, 'case_' || r.id) then
      msg := case when p_action = 'publish'
        then 'Твой случай из зала разобрали: теперь на нём тренируется команда.'
        else 'Руководитель прочитал твой случай из зала. В тренировку команды он не пошёл.' end ||
        case when nt <> '' then E'\n' || coalesce(nullif(c->>'who', ''), 'Руководитель') || ': «' || nt || '»' else '' end;
      perform sa_tg_send(chat, msg, 'Открыть', 'cases');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'status', case when p_action = 'publish' then 'published' else 'declined' end);
end; $$;

-- ── 5) Списки ──────────────────────────────────────────────────────────────────
create or replace function case_list(p_token text, p_mode text default 'full', p_since timestamptz default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; lead boolean; out jsonb; top sa_cases;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  lead := coalesce((c->>'lead')::boolean, false);
  if rest is null then return jsonb_build_object('ok', true, 'lead', lead, 'team', 0, 'fresh', 0, 'inbox', 0, 'top', null); end if;
  if p_mode = 'counts' then
    select * into top from sa_cases where restaurant = rest and status = 'published' and published_at > now() - interval '14 days'
     order by published_at desc limit 1;
    return jsonb_build_object('ok', true, 'lead', lead,
      'team', (select count(*) from sa_cases where restaurant = rest and status = 'published'),
      'fresh', (select count(*) from sa_cases where restaurant = rest and status = 'published' and author_id <> c->>'id'
                 and (p_since is null or published_at > p_since)),
      'inbox', case when lead then (select count(*) from sa_cases where restaurant = rest and status = 'new') else 0 end,
      'mine_new', (select count(*) from sa_cases where author_id = c->>'id' and status <> 'new' and reviewed_at > coalesce(p_since, now() - interval '30 days')),
      'top', case when top.id is null then null else _sa_case_json(top, 'team') end);
  end if;
  out := jsonb_build_object('ok', true, 'lead', lead,
    'team', coalesce((select jsonb_agg(_sa_case_json(x, 'team') order by x.published_at desc)
                        from (select * from sa_cases where restaurant = rest and status = 'published' order by published_at desc limit 60) x), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(_sa_case_json(x, 'mine') order by x.created_at desc)
                        from (select * from sa_cases where author_id = c->>'id' and restaurant = rest order by created_at desc limit 30) x), '[]'::jsonb));
  if lead then
    out := out || jsonb_build_object(
      'inbox', coalesce((select jsonb_agg(_sa_case_json(x, 'lead') order by x.created_at)
                           from (select * from sa_cases where restaurant = rest and status = 'new' order by created_at limit 60) x), '[]'::jsonb),
      'done', coalesce((select jsonb_agg(_sa_case_json(x, 'lead') order by x.reviewed_at desc)
                          from (select * from sa_cases where restaurant = rest and status <> 'new' order by reviewed_at desc nulls last limit 60) x), '[]'::jsonb));
  end if;
  return out;
end; $$;

-- ── 6) Права ───────────────────────────────────────────────────────────────────
revoke all on function _sa_case_json(sa_cases, text) from public, anon, authenticated;
grant execute on function case_submit(text, text, text, text, boolean) to anon, authenticated;
grant execute on function case_review(text, bigint, text, jsonb, text) to anon, authenticated;
grant execute on function case_list(text, text, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';

select 'случаи из зала: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('case_submit', 'case_review', 'case_list', '_sa_case_json')) ||
  ' функции из 4 · таблица: ' || case when to_regclass('public.sa_cases') is not null then 'есть' else 'НЕТ' end ||
  ' · вид «Случаи из зала» в напоминаниях: ' ||
  case when to_regprocedure('public._sa_notify_kinds()') is null then 'после этапа 32'
       when 'cases' = any(_sa_notify_kinds()) then 'да' else 'нет' end ||
  ' · Telegram: ' || case when _sa_tg_ready() then 'бот на месте' else 'нет (случаи работают в приложении, без сообщений)' end as result;
