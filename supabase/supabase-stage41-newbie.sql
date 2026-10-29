-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 41 (v107, Доп. 420): новичок — тёплый вход, наставник из команды, темы с собеседования.
--
--   • новый сотрудник (кроме руководителей) сам попадает в «Новички»: его видит руководитель («Команда» → «Новички»),
--     у новичка — «Первая неделя»: план по дням и первыми — темы, которые на собеседовании дались труднее всего
--     (собеседование находится само: «Берём» и то же имя и фамилия; руководитель может выбрать другое или «без
--     собеседования»);
--   • руководитель назначает наставника из команды: наставник видит план новичка и подтверждает «5 столов под
--     присмотром» и «Отработать смену самостоятельно»; в карточке коллеги в чате — «Наставник новичков»;
--   • «Памятка новичку» — одна на заведение: как найти и где вход, за сколько минут приходить, форма, кто встретит, ещё;
--   • накануне первой смены (по графику), в 19:00 по часам заведения, бот пишет новичку: когда и к какому времени
--     прийти, как найти, форма, кто встретит; наставнику — что завтра первая смена у его новичка;
--   • в «Вся команда» — карточка «Знакомьтесь: Анна Смирнова, официант» с кнопкой «Поздороваться» (руководитель
--     представляет сам или она появляется накануне первой смены), а когда наставник или руководитель подтвердил
--     самостоятельную смену — «Анна вышла на самостоятельную смену» с кнопкой «Поздравить»;
--   • RPC: newbie_me, newbie_check, newbie_list, newbie_set, newbie_confirm, newbie_memo_set, newbie_add, chat_greet,
--     chat_newbie_mark; расписание pg_cron «sa-newbie» — раз в 10 минут. Проверка без отправки:
--     select sa_newbie_preview(); — кому и что ушло бы прямо сейчас.
--
-- Нужны этапы 21, 22б, 24, 25, 31 и 38 (вход, Telegram, график, чат). Собеседования (этапы 8 и 28) — по желанию: без них
-- тем с собеседования нет. Ничего не удаляет. Можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public._sa_tz(text)') is null or to_regprocedure('public._sa_tg_chat(text,text)') is null then
    raise exception 'Сначала этапы 22б, 24 и 25 (Telegram и живые сообщения бота)';
  end if;
  if to_regprocedure('public.sa_tg_api(text,jsonb)') is null then
    raise exception 'Сначала этап 31 (supabase-stage31-qday.sql): нужна отправка с кнопками (sa_tg_api)';
  end if;
  if to_regprocedure('public._sa_sh_staff(jsonb,text,text)') is null or to_regprocedure('public._sa_chat_ensure(jsonb)') is null
     or to_regclass('public.sa_chat_msgs') is null then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужны график и чат';
  end if;
end $$;

-- ── 1) Новички и памятка ─────────────────────────────────────────────────────────
create table if not exists sa_newbies (
  emp_id      text primary key,                      -- employees.id
  restaurant  text not null default '',
  started_at  timestamptz not null default now(),    -- когда появился (сотрудника завели или руководитель добавил)
  added_by    text,                                  -- кто добавил (null — сам, когда сотрудника завели)
  cand_id     bigint,                                -- собеседование: null — ищем по имени, -1 — без собеседования
  cand_by     text,
  buddy_id    text,                                  -- наставник из команды
  buddy_by    text,
  buddy_at    timestamptz,
  checked     jsonb not null default '{}'::jsonb,    -- свои шаги: { "d1a": когда, "f:Тема": когда }
  confirm     jsonb not null default '{}'::jsonb,    -- шаги наставника: { "d2c": { by, name, at } }
  hello_msg   bigint,                                -- карточка «Знакомьтесь» в «Вся команда»
  hello_at    timestamptz,
  solo_at     timestamptz,                           -- первая самостоятельная смена (подтвердили)
  solo_by     text,
  solo_name   text,
  solo_msg    bigint,
  off         boolean not null default false,        -- руководитель убрал из «Новичков»
  updated_at  timestamptz not null default now()
);
create index if not exists sa_newbies_rest on sa_newbies (restaurant);
create index if not exists sa_newbies_buddy on sa_newbies (buddy_id) where buddy_id is not null;
alter table sa_newbies enable row level security;
revoke all on table sa_newbies from public, anon, authenticated;

create table if not exists sa_newbie_memo (
  restaurant text primary key,
  data       jsonb not null default '{}'::jsonb,     -- { addr, arrive, dress, meet, extra }
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table sa_newbie_memo enable row level security;
revoke all on table sa_newbie_memo from public, anon, authenticated;

-- ── 2) Слова ─────────────────────────────────────────────────────────────────────
-- текст для Telegram (parse_mode HTML)
create or replace function _sa_nb_esc(p text)
returns text language sql immutable as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;
-- одна строка, без лишних пробелов, не длиннее n
create or replace function _sa_nb_s(p text, n int)
returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), n)
$$;
-- должность словом (как posWord в lib/newbie.js)
create or replace function _sa_nb_posw(p text)
returns text language sql immutable as $$
  select case lower(coalesce(p, '')) when 'waiter' then 'официант' when 'hostess' then 'хостес' when 'bartender' then 'бармен'
    when 'senior_bartender' then 'старший бармен' when 'manager' then 'менеджер' when 'senior' then 'руководящий состав'
    when 'service_manager' then 'сервис-менеджер' when 'chef' then 'повар' when 'owner' then 'владелец' when 'admin' then 'владелец'
    when 'runner' then 'раннер' when 'barback' then 'барбек' else '' end
$$;
-- памятка: что задано, остальное пусто; приходить — за 15 минут, если не сказано иначе (как memoOf)
create or replace function _sa_nb_memo_norm(p jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'addr', _sa_nb_s(p->>'addr', 200),
    'arrive', case when coalesce(p->>'arrive', '') ~ '^\d{1,2}$' and (p->>'arrive')::int in (0, 10, 15, 20, 30) then (p->>'arrive')::int else 15 end,
    'dress', _sa_nb_s(p->>'dress', 200), 'meet', _sa_nb_s(p->>'meet', 100), 'extra', _sa_nb_s(p->>'extra', 300))
$$;
create or replace function _sa_nb_memo(p_rest text)
returns jsonb language sql stable security definer set search_path to public as $$
  select _sa_nb_memo_norm(coalesce((select m.data from sa_newbie_memo m where m.restaurant = p_rest), '{}'::jsonb))
$$;
-- к какому времени приходить: начало смены минус arrive минут → «11:45»
create or replace function _sa_nb_arrive(p_from numeric, p_arrive int)
returns text language sql immutable as $$
  select _sa_hh(greatest(0, coalesce(p_from, 0) - coalesce(p_arrive, 15) / 60.0))
$$;
-- смена словами: «День 12:00–20:00»
create or replace function _sa_nb_shift_label(f jsonb)
returns text language sql immutable as $$
  select coalesce(nullif(_sa_nb_s(f->>'name', 30), ''), _sa_nb_s(f->>'k', 4)) || ' ' || _sa_hh(_sa_num(f->>'from')) || '–' || _sa_hh(_sa_num(f->>'to'))
$$;

-- ── 3) Кто новичок, первая смена, собеседование ─────────────────────────────────────
-- новичок ещё в «Новичках»: не убран и не больше двух недель после самостоятельной смены
create or replace function _sa_nb_active(nb sa_newbies)
returns boolean language sql stable as $$
  select nb.emp_id is not null and not nb.off and (nb.solo_at is null or nb.solo_at > now() - interval '14 days')
$$;

-- смена сотрудника p_emp в день p_day по графику заведения: { k, name, from, to } или null (выходной, нет в графике)
create or replace function _sa_nb_shift(p_rest text, p_emp text, p_day date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare cfg jsonb := _sa_sh_cfg(p_rest); ms jsonb; k text; sh jsonb;
begin
  if cfg is null then return null; end if;
  ms := _sa_sh_staff(cfg, p_emp, to_char(p_day, 'YYYY-MM'));
  if ms is null then return null; end if;
  k := _sa_sh_code(p_rest, ms->>'id', p_day); sh := _sa_sh_def(cfg, k);
  if sh is null then return null; end if;
  return jsonb_build_object('k', k, 'name', coalesce(nullif(sh->>'name', ''), k), 'from', _sa_num(sh->>'from'), 'to', _sa_num(sh->>'to'));
end; $$;

-- первая смена с дня p_from (60 дней вперёд): { day, k, name, from, to } или null
create or replace function _sa_nb_first(p_rest text, p_emp text, p_from date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare cfg jsonb := _sa_sh_cfg(p_rest); d date; mk text := ''; ms jsonb; k text; sh jsonb;
begin
  if cfg is null or p_from is null then return null; end if;
  for d in select g::date from generate_series(p_from, p_from + 60, interval '1 day') g loop
    if to_char(d, 'YYYY-MM') <> mk then mk := to_char(d, 'YYYY-MM'); ms := _sa_sh_staff(cfg, p_emp, mk); end if;
    continue when ms is null;
    k := _sa_sh_code(p_rest, ms->>'id', d); sh := _sa_sh_def(cfg, k);
    continue when sh is null;
    return jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'k', k, 'name', coalesce(nullif(sh->>'name', ''), k),
      'from', _sa_num(sh->>'from'), 'to', _sa_num(sh->>'to'));
  end loop;
  return null;
end; $$;

-- слабые темы собеседования из записи (как focusFromPayload в lib/newbie.js): AI-интервью — баллы ниже 70, обычный тест —
-- меньше 70% верных; слабые первыми, не больше трёх
create or replace function _sa_nb_focus(p jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('topic', b.t, 'score', b.s) order by b.s, b.t collate "C"), '[]'::jsonb) from (
    select a.t, a.s from (
      select _sa_nb_s(x.k, 80) as t, round(_sa_num(x.v #>> '{}'))::int as s
        from jsonb_each(case when jsonb_typeof(p->'aiScores') = 'object' then p->'aiScores' else '{}'::jsonb end) x(k, v)
      union all
      select _sa_nb_s(y->>'topic', 80), round(_sa_num(y->>'ok') / _sa_num(y->>'n') * 100)::int
        from jsonb_array_elements(case when jsonb_typeof(p->'aiScores') = 'object' then '[]'::jsonb
                                       when jsonb_typeof(p->'topics') = 'array' then p->'topics' else '[]'::jsonb end) y
       where jsonb_typeof(y) = 'object' and _sa_num(y->>'n') > 0
    ) a where a.t <> '' and a.s < 70 order by a.s, a.t collate "C" limit 3) b
$$;

-- собеседование новичка: { id, name, date, how: set | auto, focus } или null. Само — «Берём», то же имя и фамилия, за
-- 120 дней до прихода (и неделю после), единственное такое.
create or replace function _sa_nb_cand(nb sa_newbies)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare rest text; full_ text; tk text[]; n int; cid bigint; pl jsonb; at_ timestamptz; how text := 'set';
begin
  if to_regclass('public.candidate_results') is null or coalesce(nb.cand_id, 0) < 0 then return null; end if;
  select e.restaurant, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) into rest, full_ from employees e where e.id::text = nb.emp_id;
  if nb.cand_id > 0 then
    execute 'select x.id, x.payload, x.created_at from candidate_results x where x.id = $1 and x.restaurant = $2' into cid, pl, at_ using nb.cand_id, rest;
  else
    tk := _sa_name_tokens(full_);
    if coalesce(array_length(tk, 1), 0) < 2 then return null; end if;
    execute 'select count(*), min(x.id) from candidate_results x where x.restaurant = $1 and x.payload->>''decision'' = ''hire''
               and x.created_at between $2 - interval ''120 days'' and $2 + interval ''7 days'' and _sa_name_tokens(x.payload->>''name'') = $3'
      into n, cid using rest, nb.started_at, tk;
    if n <> 1 then return null; end if;
    execute 'select x.payload, x.created_at from candidate_results x where x.id = $1' into pl, at_ using cid;
    how := 'auto';
  end if;
  if cid is null then return null; end if;
  return jsonb_build_object('id', cid, 'name', _sa_nb_s(pl->>'name', 80), 'date', to_char(at_ at time zone _sa_tz(rest), 'YYYY-MM-DD'),
    'how', how, 'focus', _sa_nb_focus(pl));
end; $$;

-- новичок для приложения: p_view — me (сам), lead (руководитель: и баллы, и какое собеседование), buddy (наставник)
create or replace function _sa_nb_row(nb sa_newbies, p_view text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare e record; tz text; today date; sd date; cand jsonb; bud jsonb; hello jsonb; g jsonb; foc jsonb;
begin
  select x.id::text as id, btrim(coalesce(x.name, '') || ' ' || coalesce(x.surname, '')) as full_, lower(coalesce(x.position, '')) as pos,
         coalesce(x.restaurant, '') as rest into e from employees x where x.id::text = nb.emp_id;
  if e.id is null then return null; end if;
  tz := _sa_tz(e.rest); today := (now() at time zone tz)::date; sd := (nb.started_at at time zone tz)::date;
  cand := _sa_nb_cand(nb);
  foc := coalesce(cand->'focus', '[]'::jsonb);
  if p_view <> 'lead' then
    foc := coalesce((select jsonb_agg(jsonb_build_object('topic', f->>'topic') order by o) from jsonb_array_elements(foc) with ordinality q(f, o)), '[]'::jsonb);
  end if;
  select jsonb_build_object('id', b.id::text, 'name', btrim(coalesce(b.name, '') || ' ' || coalesce(b.surname, '')), 'pos', lower(coalesce(b.position, '')))
    into bud from employees b where b.id::text = nb.buddy_id and coalesce(b.status, 'active') = 'active';
  if nb.hello_msg is not null then
    select m.card->'greet' into g from sa_chat_msgs m where m.id = nb.hello_msg and not m.deleted;
    hello := jsonb_build_object('msg', nb.hello_msg, 'at', nb.hello_at, 'n', case when jsonb_typeof(g) = 'array' then jsonb_array_length(g) else 0 end);
  end if;
  return jsonb_strip_nulls(jsonb_build_object('emp', e.id, 'name', e.full_, 'pos', e.pos, 'rest', e.rest, 'day', to_char(today, 'YYYY-MM-DD'),
    'started', to_char(sd, 'YYYY-MM-DD'), 'days', greatest(0, today - sd), 'first', _sa_nb_first(e.rest, e.id, sd), 'memo', _sa_nb_memo(e.rest),
    'buddy', bud, 'focus', foc, 'checked', nb.checked, 'confirm', nb.confirm, 'hello', hello,
    'solo', case when nb.solo_at is not null then jsonb_build_object('at', nb.solo_at, 'by', nb.solo_by, 'name', coalesce(nb.solo_name, '')) end,
    'tg', _sa_tg_chat(e.id, null) is not null,
    'cand', case when p_view = 'lead' and cand is not null then cand - 'focus' end,
    'no_cand', case when p_view = 'lead' then coalesce(nb.cand_id, 0) < 0 end));
end; $$;

-- ── 4) Тексты бота (как eveText и eveBuddyText в lib/newbie.js) ────────────────────────
create or replace function _sa_nb_eve_text(p_rest text, p_first jsonb, p_memo jsonb, p_buddy jsonb)
returns text language plpgsql stable set search_path to public as $$
declare m jsonb := _sa_nb_memo_norm(coalesce(p_memo, '{}'::jsonb)); lns text[] := '{}'; d date := (p_first->>'day')::date; dl text := _sa_chat_dlong(d);
begin
  lns := lns || '<b>Завтра твоя первая смена</b>'::text;
  lns := lns || _sa_nb_esc(upper(left(dl, 1)) || substr(dl, 2) || ' · ' || _sa_nb_shift_label(p_first));
  if _sa_nb_s(p_rest, 80) <> '' then lns := lns || _sa_nb_esc(_sa_nb_s(p_rest, 80)); end if;
  lns := lns || ''::text || ('Приходи к ' || _sa_nb_arrive(_sa_num(p_first->>'from'), (m->>'arrive')::int));
  if m->>'addr' <> '' then lns := lns || _sa_nb_esc('Как найти: ' || (m->>'addr')); end if;
  if m->>'dress' <> '' then lns := lns || _sa_nb_esc('Форма: ' || (m->>'dress')); end if;
  lns := lns || _sa_nb_esc(case when jsonb_typeof(p_buddy) = 'object' and _sa_nb_s(p_buddy->>'name', 80) <> ''
      then 'Тебя встретит ' || _sa_chat_nm(_sa_nb_s(p_buddy->>'name', 80)) || ', твой наставник'
    when m->>'meet' <> '' then 'Тебя встретит: ' || (m->>'meet') else 'Тебя встретит менеджер смены' end);
  if m->>'extra' <> '' then lns := lns || _sa_nb_esc(m->>'extra'); end if;
  lns := lns || ''::text || 'В «Первой неделе» план и с чего начать.'::text;
  return array_to_string(lns, E'\n');
end; $$;

create or replace function _sa_nb_buddy_text(p_name text, p_pos text, p_first jsonb, p_memo jsonb)
returns text language sql stable set search_path to public as $$
  select '<b>Завтра первая смена у новичка</b>' || E'\n' ||
    _sa_nb_esc(_sa_chat_nm(_sa_nb_s(p_name, 80)) || coalesce(', ' || nullif(_sa_nb_posw(p_pos), ''), '') || ' · ' || _sa_nb_shift_label(p_first)) || E'\n' ||
    'Ты наставник: встреть к ' || _sa_nb_arrive(_sa_num(p_first->>'from'), (_sa_nb_memo_norm(coalesce(p_memo, '{}'::jsonb))->>'arrive')::int) ||
    ' и покажи, где что.'
$$;

-- коротко о карточке — для списка чатов и поиска (как newbieCardSum)
create or replace function _sa_nb_card_sum(p jsonb)
returns text language sql immutable as $$
  select case p->>'t'
    when 'hello' then 'Знакомьтесь: ' || coalesce(p->>'name', '') || coalesce(', ' || nullif(_sa_nb_posw(p->>'pos'), ''), '')
    when 'solo' then 'Первая самостоятельная смена: ' || coalesce(p->>'name', '')
    else '' end
$$;

-- ── 5) Карточки в «Вся команда» ─────────────────────────────────────────────────────
-- автор: сотрудник p_emp (руководитель или наставник) как «тот, кто зовёт»
create or replace function _sa_nb_author(p_emp text)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('id', e.id::text, 'who', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')), 'restaurant', e.restaurant,
    'lead', coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any (_sa_chat_lead_pos()))
    from employees e where e.id::text = p_emp and coalesce(e.status, 'active') = 'active'
$$;

create or replace function _sa_nb_post(c jsonb, p_card jsonb)
returns bigint language plpgsql security definer set search_path to public as $$
declare ch sa_chats; m sa_chat_msgs;
begin
  if c is null or coalesce(c->>'restaurant', '') = '' then return null; end if;
  perform _sa_chat_ensure(c);
  select * into ch from sa_chats x where x.restaurant = c->>'restaurant' and x.kind = 'team';
  if ch.id is null then return null; end if;
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), _sa_nb_card_sum(p_card), 'card', p_card) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  return m.id;
end; $$;

-- «Знакомьтесь»: кто, должность, первая смена, наставник
create or replace function _sa_nb_hello(p_emp text, c jsonb)
returns bigint language plpgsql security definer set search_path to public as $$
declare nb sa_newbies; e record; f jsonb; bud jsonb; mid bigint; tz text;
begin
  select * into nb from sa_newbies where emp_id = p_emp for update;
  if nb.emp_id is null then return null; end if;
  if nb.hello_msg is not null and exists (select 1 from sa_chat_msgs m where m.id = nb.hello_msg and not m.deleted) then return nb.hello_msg; end if;
  select x.id::text as id, btrim(coalesce(x.name, '') || ' ' || coalesce(x.surname, '')) as full_, lower(coalesce(x.position, '')) as pos, x.restaurant as rest
    into e from employees x where x.id::text = p_emp;
  tz := _sa_tz(e.rest);
  f := _sa_nb_first(e.rest, p_emp, (nb.started_at at time zone tz)::date);
  select jsonb_build_object('id', b.id::text, 'name', btrim(coalesce(b.name, '') || ' ' || coalesce(b.surname, ''))) into bud
    from employees b where b.id::text = nb.buddy_id and coalesce(b.status, 'active') = 'active';
  mid := _sa_nb_post(c, jsonb_strip_nulls(jsonb_build_object('t', 'hello', 'emp', p_emp, 'name', e.full_, 'pos', e.pos,
    'first', case when f is not null then jsonb_build_object('day', f->>'day', 'from', (f->>'from')::numeric, 'name', f->>'name') end,
    'buddy', bud, 'greet', '[]'::jsonb)));
  if mid is not null then update sa_newbies set hello_msg = mid, hello_at = now(), updated_at = now() where emp_id = p_emp; end if;
  return mid;
end; $$;

-- «Первая самостоятельная смена»: сколько дней с первой смены (или с прихода), наставник
create or replace function _sa_nb_solo(p_emp text, c jsonb)
returns bigint language plpgsql security definer set search_path to public as $$
declare nb sa_newbies; e record; f jsonb; bud jsonb; mid bigint; tz text; today date; sd date; days int;
begin
  select * into nb from sa_newbies where emp_id = p_emp;
  select x.id::text as id, btrim(coalesce(x.name, '') || ' ' || coalesce(x.surname, '')) as full_, lower(coalesce(x.position, '')) as pos, x.restaurant as rest
    into e from employees x where x.id::text = p_emp;
  tz := _sa_tz(e.rest); today := (now() at time zone tz)::date; sd := (nb.started_at at time zone tz)::date;
  f := _sa_nb_first(e.rest, p_emp, sd);
  days := greatest(0, today - coalesce(case when f is not null and (f->>'day')::date <= today then (f->>'day')::date end, sd));
  select jsonb_build_object('id', b.id::text, 'name', btrim(coalesce(b.name, '') || ' ' || coalesce(b.surname, ''))) into bud
    from employees b where b.id::text = nb.buddy_id and coalesce(b.status, 'active') = 'active';
  mid := _sa_nb_post(c, jsonb_strip_nulls(jsonb_build_object('t', 'solo', 'emp', p_emp, 'name', e.full_, 'pos', e.pos, 'days', days,
    'buddy', bud, 'greet', '[]'::jsonb)));
  update sa_newbies set solo_msg = mid, updated_at = now() where emp_id = p_emp;
  return mid;
end; $$;

-- ── 6) Из приложения ──────────────────────────────────────────────────────────────
-- руководитель или наставник этого новичка
create or replace function _sa_nb_can(c jsonb, nb sa_newbies)
returns boolean language sql stable security definer set search_path to public as $$
  select nb.emp_id is not null and exists (select 1 from employees e where e.id::text = nb.emp_id and e.restaurant is not distinct from (c->>'restaurant'))
    and (coalesce((c->>'lead')::boolean, false) or nb.buddy_id = c->>'id')
$$;

-- кого ведёт p_emp: [{ emp, name }] — новички, которые ещё в «Новичках»
create or replace function _sa_nb_buddy_of(p_emp text)
returns jsonb language sql stable security definer set search_path to public as $$
  select coalesce(jsonb_agg(jsonb_build_object('emp', n.emp_id, 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, ''))) order by n.started_at), '[]'::jsonb)
    from sa_newbies n join employees e on e.id::text = n.emp_id
   where n.buddy_id = p_emp and _sa_nb_active(n) and coalesce(e.status, 'active') = 'active'
$$;

create or replace function newbie_me(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; nb sa_newbies; tz text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into nb from sa_newbies where emp_id = c->>'id';
  if nb.emp_id is null or not _sa_nb_active(nb) then
    tz := _sa_tz(c->>'restaurant');
    return jsonb_build_object('ok', true, 'newbie', false, 'lead', coalesce((c->>'lead')::boolean, false), 'buddy_of', _sa_nb_buddy_of(c->>'id'),
      'day', to_char((now() at time zone tz)::date, 'YYYY-MM-DD'));
  end if;
  return coalesce(_sa_nb_row(nb, 'me'), '{}'::jsonb) || jsonb_build_object('ok', true, 'newbie', true, 'lead', coalesce((c->>'lead')::boolean, false),
    'buddy_of', _sa_nb_buddy_of(c->>'id'));
end; $$;

-- новичок отмечает свои шаги (шаги наставника — нельзя)
create or replace function newbie_check(p_token text, p_steps text[], p_on boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; nb sa_newbies; s text; ch jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into nb from sa_newbies where emp_id = c->>'id' for update;
  if nb.emp_id is null or not _sa_nb_active(nb) then return jsonb_build_object('ok', false, 'error', 'not_newbie'); end if;
  ch := nb.checked;
  foreach s in array coalesce(p_steps[1:30], '{}'::text[]) loop
    continue when s is null or not (s = any (array['d1a', 'd1b', 'd1c', 'd1d', 'd2a', 'd2b', 'd2d', 'd3a']) or s ~ '^f:.{1,60}$');
    if coalesce(p_on, true) then ch := ch || jsonb_build_object(s, now()); else ch := ch - s; end if;
  end loop;
  update sa_newbies set checked = ch, updated_at = now() where emp_id = nb.emp_id;
  return jsonb_build_object('ok', true, 'checked', ch);
end; $$;

-- «Новички»: руководителю — все новички заведения, кого можно назначить наставником, собеседования «Берём»;
-- наставнику — свои новички; всем — кого ты уже вывел на самостоятельную смену
create or replace function newbie_list(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; lead boolean; rest text; tz text; out jsonb := '[]'::jsonb; nb sa_newbies; team jsonb := '[]'::jsonb; cands jsonb := '[]'::jsonb;
  led jsonb; r jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  lead := coalesce((c->>'lead')::boolean, false);
  rest := coalesce(c->>'restaurant', ''); tz := _sa_tz(rest);
  for nb in select n.* from sa_newbies n join employees e on e.id::text = n.emp_id
             where e.restaurant = rest and coalesce(e.status, 'active') = 'active' and _sa_nb_active(n) and (lead or n.buddy_id = c->>'id')
             order by n.started_at desc, n.emp_id loop
    r := _sa_nb_row(nb, case when lead then 'lead' else 'buddy' end);
    if r is not null then out := out || jsonb_build_array(r); end if;
  end loop;
  if lead then
    select coalesce(jsonb_agg(jsonb_build_object('id', e.id::text, 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
             'pos', lower(coalesce(e.position, '')),
             'leads', (select count(*) from sa_newbies n where n.buddy_id = e.id::text and _sa_nb_active(n)))
             order by e.name, e.surname), '[]'::jsonb) into team
      from employees e
     where e.restaurant = rest and coalesce(e.status, 'active') = 'active' and not coalesce(e.is_admin, false)
       and not exists (select 1 from sa_newbies n where n.emp_id = e.id::text and _sa_nb_active(n));
    if to_regclass('public.candidate_results') is not null then
      execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'', x.id, ''name'', _sa_nb_s(x.payload->>''name'', 80),
                 ''date'', to_char(x.created_at at time zone $2, ''YYYY-MM-DD''), ''focus'', _sa_nb_focus(x.payload)) order by x.created_at desc), ''[]''::jsonb)
                 from (select * from candidate_results y where y.restaurant = $1 and y.payload->>''decision'' = ''hire''
                         and y.created_at > now() - interval ''120 days'' order by y.created_at desc limit 30) x'
        into cands using rest, tz;
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
           'solo', to_char(n.solo_at at time zone tz, 'YYYY-MM-DD')) order by n.solo_at desc), '[]'::jsonb) into led
    from (select * from sa_newbies x where x.buddy_id = c->>'id' and x.solo_at is not null order by x.solo_at desc limit 20) n
    join employees e on e.id::text = n.emp_id;
  return jsonb_build_object('ok', true, 'lead', lead, 'day', to_char((now() at time zone tz)::date, 'YYYY-MM-DD'), 'memo', _sa_nb_memo(rest),
    'list', out, 'team', team, 'cands', cands, 'led', led);
end; $$;

-- руководитель: наставник (p_buddy: id, '' — снять), собеседование (p_cand: id, 0 — искать само, -1 — без собеседования),
-- представить команде (p_hello = true — карточка «Знакомьтесь», если её ещё нет)
create or replace function newbie_set(p_token text, p_emp text, p_buddy text default null, p_cand bigint default null, p_hello boolean default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; nb sa_newbies; ok_ boolean; mid bigint; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select * into nb from sa_newbies where emp_id = p_emp;
  if nb.emp_id is null or not _sa_nb_active(nb) or not _sa_nb_can(c, nb) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_buddy is not null then
    if p_buddy = '' then
      update sa_newbies set buddy_id = null, buddy_by = c->>'id', buddy_at = now(), updated_at = now() where emp_id = p_emp;
    else
      select exists (select 1 from employees e where e.id::text = p_buddy and e.restaurant is not distinct from (c->>'restaurant')
                       and coalesce(e.status, 'active') = 'active' and e.id::text <> p_emp
                       and not exists (select 1 from sa_newbies n where n.emp_id = e.id::text and _sa_nb_active(n))) into ok_;
      if not ok_ then return jsonb_build_object('ok', false, 'error', 'bad_buddy'); end if;
      update sa_newbies set buddy_id = p_buddy, buddy_by = c->>'id', buddy_at = now(), updated_at = now() where emp_id = p_emp;
    end if;
  end if;
  if p_cand is not null then
    if p_cand > 0 then
      if to_regclass('public.candidate_results') is null then return jsonb_build_object('ok', false, 'error', 'bad_cand'); end if;
      execute 'select exists (select 1 from candidate_results x where x.id = $1 and x.restaurant = $2)' into ok_ using p_cand, c->>'restaurant';
      if not ok_ then return jsonb_build_object('ok', false, 'error', 'bad_cand'); end if;
    end if;
    update sa_newbies set cand_id = case when p_cand = 0 then null when p_cand < 0 then -1 else p_cand end, cand_by = c->>'id', updated_at = now()
     where emp_id = p_emp;
  end if;
  if coalesce(p_hello, false) then mid := _sa_nb_hello(p_emp, c); end if;
  select * into nb from sa_newbies where emp_id = p_emp;
  if mid is not null then
    select * into m from sa_chat_msgs where id = mid;
    select * into ch from sa_chats where id = m.chat_id;
  end if;
  return jsonb_build_object('ok', true, 'item', _sa_nb_row(nb, 'lead'), 'msg', case when m.id is not null then _sa_chat_smart1(c, ch, m) end);
end; $$;

-- наставник или руководитель подтверждает «5 столов под присмотром» (d2c) и «Отработать смену самостоятельно» (d3b);
-- d3b — карточка «… вышла на самостоятельную смену» в «Вся команда»; снял — карточка уходит
create or replace function newbie_confirm(p_token text, p_emp text, p_step text, p_on boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; nb sa_newbies; cf jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if coalesce(p_step, '') not in ('d2c', 'd3b') then return jsonb_build_object('ok', false, 'error', 'bad_step'); end if;
  select * into nb from sa_newbies where emp_id = p_emp for update;
  if nb.emp_id is null or not _sa_nb_active(nb) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not _sa_nb_can(c, nb) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_emp = c->>'id' then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  cf := nb.confirm;
  if coalesce(p_on, true) then
    if not cf ? p_step then cf := cf || jsonb_build_object(p_step, jsonb_build_object('by', c->>'id', 'name', c->>'who', 'at', now())); end if;
    update sa_newbies set confirm = cf, updated_at = now() where emp_id = p_emp;
    if p_step = 'd3b' and nb.solo_at is null then
      update sa_newbies set solo_at = now(), solo_by = c->>'id', solo_name = c->>'who' where emp_id = p_emp;
      perform _sa_nb_solo(p_emp, c);
    end if;
  else
    cf := cf - p_step;
    update sa_newbies set confirm = cf, updated_at = now() where emp_id = p_emp;
    if p_step = 'd3b' then
      update sa_chat_msgs set deleted = true, updated_at = now() where id = nb.solo_msg;
      update sa_newbies set solo_at = null, solo_by = null, solo_name = null, solo_msg = null where emp_id = p_emp;
    end if;
  end if;
  select * into nb from sa_newbies where emp_id = p_emp;
  return jsonb_build_object('ok', true, 'item', _sa_nb_row(nb, case when coalesce((c->>'lead')::boolean, false) then 'lead' else 'buddy' end));
end; $$;

-- памятка новичку — одна на заведение (руководитель)
create or replace function newbie_memo_set(p_token text, p_memo jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; m jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  m := _sa_nb_memo_norm(case when jsonb_typeof(p_memo) = 'object' then p_memo else '{}'::jsonb end);
  insert into sa_newbie_memo (restaurant, data, updated_by, updated_at) values (rest, m, c->>'id', now())
    on conflict (restaurant) do update set data = excluded.data, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('ok', true, 'memo', m);
end; $$;

-- руководитель добавляет в «Новички» того, кто пришёл раньше этапа 41 (или убирает)
create or replace function newbie_add(p_token text, p_emp text, p_on boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; e record; nb sa_newbies;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select x.id::text as id, x.restaurant as rest, coalesce(x.is_admin, false) as adm into e from employees x
   where x.id::text = p_emp and coalesce(x.status, 'active') = 'active';
  if e.id is null or e.rest is distinct from (c->>'restaurant') or e.adm or e.id = c->>'id' then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(p_on, true) then
    insert into sa_newbies (emp_id, restaurant, added_by) values (e.id, coalesce(e.rest, ''), c->>'id')
      on conflict (emp_id) do update set off = false, started_at = case when sa_newbies.off then now() else sa_newbies.started_at end,
        added_by = coalesce(sa_newbies.added_by, excluded.added_by), updated_at = now();
  else
    update sa_newbies set off = true, updated_at = now() where emp_id = e.id;
  end if;
  select * into nb from sa_newbies where emp_id = e.id;
  return jsonb_build_object('ok', true, 'item', case when nb.emp_id is not null and _sa_nb_active(nb) then _sa_nb_row(nb, 'lead') end);
end; $$;

-- «Поздороваться» и «Поздравить» на карточках новичка — один раз; сам новичок — нет
create or replace function chat_greet(p_token text, p_msg bigint)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; m2 sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or m.kind <> 'card' or coalesce(m.card->>'t', '') not in ('hello', 'solo') or not _sa_chat_ok(c, ch) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if m.card->>'emp' = c->>'id' then return jsonb_build_object('ok', false, 'error', 'self', 'msg', _sa_chat_smart1(c, ch, m)); end if;
  update sa_chat_msgs x set card = jsonb_set(x.card, '{greet}',
      (case when jsonb_typeof(x.card->'greet') = 'array' then x.card->'greet' else '[]'::jsonb end)
      || jsonb_build_array(jsonb_build_object('id', c->>'id', 'n', c->>'who', 'at', now()))), updated_at = now()
   where x.id = m.id and jsonb_array_length(case when jsonb_typeof(x.card->'greet') = 'array' then x.card->'greet' else '[]'::jsonb end) < 300
     and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(x.card->'greet') = 'array' then x.card->'greet' else '[]'::jsonb end) y
                      where y->>'id' = c->>'id')
  returning * into m2;
  if m2.id is not null then m := m2; else select * into m from sa_chat_msgs where id = p_msg; end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- «Наставник новичков» в карточке коллеги: кого ведёт сейчас и кого вывел на самостоятельную смену
create or replace function chat_newbie_mark(p_token text, p_emp text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; tz text; now_ jsonb; led jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select e.restaurant into rest from employees e where e.id::text = p_emp and coalesce(e.status, 'active') = 'active';
  if rest is null or (rest is distinct from (c->>'restaurant') and not coalesce((c->>'lead')::boolean, false)) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  tz := _sa_tz(rest);
  select coalesce(jsonb_agg(jsonb_build_object('name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, ''))) order by n.started_at), '[]'::jsonb) into now_
    from sa_newbies n join employees e on e.id::text = n.emp_id where n.buddy_id = p_emp and n.solo_at is null and _sa_nb_active(n);
  select coalesce(jsonb_agg(jsonb_build_object('name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
           'solo', to_char(n.solo_at at time zone tz, 'YYYY-MM-DD')) order by n.solo_at desc), '[]'::jsonb) into led
    from (select * from sa_newbies x where x.buddy_id = p_emp and x.solo_at is not null order by x.solo_at desc limit 20) n
    join employees e on e.id::text = n.emp_id;
  return jsonb_build_object('ok', true, 'now', now_, 'led', led);
end; $$;

-- ── 7) Новый сотрудник — сам в «Новички» (кроме руководителей) ──────────────────────
-- Ошибка здесь не должна мешать завести сотрудника: всё в своём блоке.
create or replace function _sa_nb_on_emp()
returns trigger language plpgsql security definer set search_path to public as $$
begin
  begin
    if not coalesce(new.is_admin, false) and lower(coalesce(new.position, '')) <> all (_sa_chat_lead_pos())
       and coalesce(new.status, 'active') = 'active' then
      insert into sa_newbies (emp_id, restaurant) values (new.id::text, coalesce(new.restaurant, '')) on conflict (emp_id) do nothing;
    end if;
  exception when others then null;
  end;
  return new;
end; $$;
drop trigger if exists sa_newbie_on_emp on employees;
create trigger sa_newbie_on_emp after insert on employees for each row execute function _sa_nb_on_emp();

-- кто пришёл за последние три недели до этапа (если у сотрудников есть дата создания) — тоже новички
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'employees' and column_name = 'created_at') then
    execute $q$
      insert into sa_newbies (emp_id, restaurant, started_at)
      select e.id::text, coalesce(e.restaurant, ''), e.created_at from employees e
       where e.created_at > now() - interval '21 days' and coalesce(e.status, 'active') = 'active' and not coalesce(e.is_admin, false)
         and lower(coalesce(e.position, '')) <> all (_sa_chat_lead_pos())
      on conflict (emp_id) do nothing$q$;
  end if;
end $$;

-- ── 8) По расписанию: накануне первой смены, с 19:00 до 23:00 по часам заведения ─────────
create or replace function _sa_nb_due(p_send boolean, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path to public as $$
declare nb sa_newbies; e record; tz text; lnow timestamp; today date; f jsonb; memo jsonb; bud record; budj jsonb; chat bigint; bchat bigint;
  t1 text; t2 text; out jsonb := '[]'::jsonb; au jsonb;
begin
  if not _sa_tg_ready() then return out; end if;
  for nb in select n.* from sa_newbies n where not n.off and n.solo_at is null loop
    begin
      select x.id::text as id, btrim(coalesce(x.name, '') || ' ' || coalesce(x.surname, '')) as full_, lower(coalesce(x.position, '')) as pos,
             coalesce(x.restaurant, '') as rest into e from employees x where x.id::text = nb.emp_id and coalesce(x.status, 'active') = 'active';
      continue when e.id is null;
      tz := _sa_tz(e.rest); lnow := p_now at time zone tz; today := lnow::date;
      continue when extract(hour from lnow) < 19 or extract(hour from lnow) >= 23;
      continue when _sa_tg_was(e.id, today, 'newbie_eve');
      f := _sa_nb_first(e.rest, e.id, (nb.started_at at time zone tz)::date);
      continue when f is null or (f->>'day')::date <> today + 1;
      memo := _sa_nb_memo(e.rest);
      select b.id::text as id, btrim(coalesce(b.name, '') || ' ' || coalesce(b.surname, '')) as full_ into bud
        from employees b where b.id::text = nb.buddy_id and coalesce(b.status, 'active') = 'active';
      budj := case when bud.id is not null then jsonb_build_object('id', bud.id, 'name', bud.full_) end;
      chat := _sa_tg_chat(e.id, null);
      bchat := case when bud.id is not null then _sa_tg_chat(bud.id, null) end;
      t1 := _sa_nb_eve_text(e.rest, f, memo, budj);
      t2 := case when bud.id is not null then _sa_nb_buddy_text(e.full_, e.pos, f, memo) end;
      if p_send then
        continue when not _sa_tg_once(e.id, today, 'newbie_eve');
        if chat is not null then
          perform sa_tg_api('sendMessage', jsonb_build_object('chat_id', chat, 'parse_mode', 'HTML', 'disable_web_page_preview', true, 'text', t1,
            'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(_sa_chat_tg_btn('Первая неделя', 'newbie'))))));
        end if;
        if bchat is not null then
          perform sa_tg_api('sendMessage', jsonb_build_object('chat_id', bchat, 'parse_mode', 'HTML', 'disable_web_page_preview', true, 'text', t2,
            'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(_sa_chat_tg_btn('Новички', 'newbies'))))));
        end if;
        -- ещё не представили команде — представляет тот, кто назначил наставника или добавил новичка
        if nb.hello_msg is null and coalesce(nb.buddy_by, nb.added_by) is not null then
          au := _sa_nb_author(coalesce(nb.buddy_by, nb.added_by));
          if au is not null and au->>'restaurant' is not distinct from e.rest then perform _sa_nb_hello(e.id, au); end if;
        end if;
      end if;
      out := out || jsonb_build_object('emp', e.id, 'name', e.full_, 'chat', chat, 'buddy', bud.id, 'buddy_chat', bchat, 'text', t1, 'buddy_text', t2);
    exception when others then
      raise warning 'Новичок: сообщение накануне первой смены для % не ушло: %', nb.emp_id, sqlerrm;
    end;
  end loop;
  return out;
end; $$;

create or replace function sa_newbie_tick()
returns int language plpgsql security definer set search_path to public as $$
begin
  return jsonb_array_length(_sa_nb_due(true, now()));
end; $$;

create or replace function sa_newbie_preview()
returns jsonb language sql security definer set search_path to public as $$
  select _sa_nb_due(false, now())
$$;

do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: сообщение новичку накануне первой смены не придёт по расписанию (включи pg_cron и запусти файл ещё раз)';
    return;
  end if;
  begin execute $c$select cron.unschedule('sa-newbie')$c$; exception when others then null; end;
  execute $c$select cron.schedule('sa-newbie', '*/10 * * * *', 'select public.sa_newbie_tick()')$c$;
exception when others then
  raise notice 'Расписание «Новичок» не создано: %', sqlerrm;
end $$;

-- ── 9) Права ───────────────────────────────────────────────────────────────────────
revoke all on function _sa_nb_esc(text) from public, anon, authenticated;
revoke all on function _sa_nb_s(text, int) from public, anon, authenticated;
revoke all on function _sa_nb_posw(text) from public, anon, authenticated;
revoke all on function _sa_nb_memo_norm(jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_memo(text) from public, anon, authenticated;
revoke all on function _sa_nb_arrive(numeric, int) from public, anon, authenticated;
revoke all on function _sa_nb_shift_label(jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_active(sa_newbies) from public, anon, authenticated;
revoke all on function _sa_nb_shift(text, text, date) from public, anon, authenticated;
revoke all on function _sa_nb_first(text, text, date) from public, anon, authenticated;
revoke all on function _sa_nb_focus(jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_cand(sa_newbies) from public, anon, authenticated;
revoke all on function _sa_nb_row(sa_newbies, text) from public, anon, authenticated;
revoke all on function _sa_nb_eve_text(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_buddy_text(text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_card_sum(jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_author(text) from public, anon, authenticated;
revoke all on function _sa_nb_post(jsonb, jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_hello(text, jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_solo(text, jsonb) from public, anon, authenticated;
revoke all on function _sa_nb_can(jsonb, sa_newbies) from public, anon, authenticated;
revoke all on function _sa_nb_buddy_of(text) from public, anon, authenticated;
revoke all on function _sa_nb_on_emp() from public, anon, authenticated;
revoke all on function _sa_nb_due(boolean, timestamptz) from public, anon, authenticated;
revoke all on function sa_newbie_tick() from public, anon, authenticated;
revoke all on function sa_newbie_preview() from public, anon, authenticated;
revoke all on function newbie_me(text), newbie_check(text, text[], boolean), newbie_list(text), newbie_set(text, text, text, bigint, boolean),
  newbie_confirm(text, text, text, boolean), newbie_memo_set(text, jsonb), newbie_add(text, text, boolean), chat_greet(text, bigint),
  chat_newbie_mark(text, text) from public;
grant execute on function newbie_me(text), newbie_check(text, text[], boolean), newbie_list(text), newbie_set(text, text, text, bigint, boolean),
  newbie_confirm(text, text, text, boolean), newbie_memo_set(text, jsonb), newbie_add(text, text, boolean), chat_greet(text, bigint),
  chat_newbie_mark(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'новичок: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('newbie_me', 'newbie_check', 'newbie_list', 'newbie_set', 'newbie_confirm', 'newbie_memo_set', 'newbie_add', 'chat_greet',
                       'chat_newbie_mark')) || ' функций из 9' ||
  ' · новый сотрудник — сам в «Новичках»: ' || case when exists (select 1 from pg_trigger where tgname = 'sa_newbie_on_emp' and not tgisinternal) then 'да' else 'нет' end ||
  ' · расписание: ' || _sa_cron_status('sa-newbie') ||
  ' · бот: ' || case when _sa_tg_ready() then 'на месте' else 'нет (памятка будет только в приложении)' end ||
  ' · сейчас в «Новичках»: ' || (select count(*) from sa_newbies n join employees e on e.id::text = n.emp_id
     where _sa_nb_active(n) and coalesce(e.status, 'active') = 'active') as result;
