-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 42 (v108, Доп. 421): тепло в команде — «Спасибо коллеге», дни рождения и годовщины.
--
--   • «Спасибо коллеге»: карточка в «Вся команда» — кому и за что («Пётр Орлов: выручил на банкете»), к ней можно
--     присоединиться («Тоже спасибо»). Тому, кому спасибо, бот пишет в Telegram. Такие «спасибо» копятся у человека
--     («Я» → «Спасибо от коллег», рядом с благодарностями гостей) и добавляют очки в «Сотруднике недели» (рейтинг:
--     одно «спасибо» от человека в день — 5 очков). Тому же коллеге — раз в день, от себя — до 15 в день;
--   • дни рождения и годовщины: в день праздника, с 9:00 до 21:00 по часам заведения, в «Вся команда» карточка
--     «У Ильи сегодня день рождения» или «Вера год с нами» с кнопкой «Поздравить»; самому — сообщение бота. Даты — из
--     графика: «Д.р.» (дд.мм) и «В команде с» (дд.мм.гггг) в карточке сотрудника; кто пришёл через «Новички»
--     (этап 41), у того годовщина — от дня прихода, если «В команде с» не указано;
--   • RPC: chat_thanks, chat_cheer, thanks_peer, thanks_week, thanks_of, cheer_poke; расписание pg_cron «sa-cheer» —
--     раз в 10 минут. Проверка без отправки: select sa_cheer_preview(); — у кого сегодня праздник, что пишет бот и
--     ушла ли уже карточка (posted).
--
-- Нужны этапы 21, 22б, 24, 25, 31 и 38 (вход, Telegram, график, чат). Этап 41 — по желанию (годовщины новичков).
-- Ничего не удаляет. Можно запускать повторно.
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

-- ── 1) Таблицы ─────────────────────────────────────────────────────────────────────
-- «спасибо»: одна строка на карточку от автора (own) и по строке на каждого, кто присоединился
create table if not exists sa_peer_thanks (
  id          bigserial primary key,
  msg_id      bigint not null,                       -- карточка в «Вся команда»
  restaurant  text not null default '',
  from_id     text not null,
  from_name   text not null default '',
  to_id       text not null,
  to_name     text not null default '',
  text        text not null default '',              -- за что (у присоединившихся — то же)
  own         boolean not null default true,         -- автор карточки (false — «Тоже спасибо»)
  created_at  timestamptz not null default now()
);
create unique index if not exists sa_peer_thanks_one on sa_peer_thanks (msg_id, from_id);
create index if not exists sa_peer_thanks_to on sa_peer_thanks (to_id, created_at desc);
create index if not exists sa_peer_thanks_at on sa_peer_thanks (created_at);

-- праздники: карточка в чате — раз в день на человека и повод
create table if not exists sa_cheers (
  emp_id      text not null,
  day         date not null,
  kind        text not null check (kind in ('bday', 'anniv')),
  restaurant  text not null default '',
  years       int,
  msg_id      bigint,
  created_at  timestamptz not null default now(),
  primary key (emp_id, day, kind)
);

alter table sa_peer_thanks enable row level security;
alter table sa_cheers enable row level security;
revoke all on sa_peer_thanks, sa_cheers from anon, authenticated;
revoke all on sequence sa_peer_thanks_id_seq from anon, authenticated;

-- ── 2) Слова (как lib/team-warm.js) ─────────────────────────────────────────────────
-- «год», «2 года», «5 лет»
create or replace function _sa_ty_years(n int)
returns text language sql immutable as $$
  select case when n = 1 then 'год' else n::text || ' ' ||
    case when n % 10 = 1 and n % 100 <> 11 then 'год' when n % 10 between 2 and 4 and (n % 100 < 10 or n % 100 >= 20) then 'года' else 'лет' end end
$$;

-- коротко о карточке — для списка чатов и поиска (как warmCardSum)
create or replace function _sa_ty_sum(p jsonb)
returns text language sql immutable as $$
  select case p->>'t'
    when 'thx' then 'Спасибо: ' || coalesce(p->'to'->>'name', '') || coalesce(', ' || nullif(p->>'text', ''), '')
    when 'bday' then 'День рождения: ' || coalesce(p->>'name', '')
    when 'anniv' then coalesce(p->>'name', '') || ': ' || _sa_ty_years(greatest(1, coalesce((p->>'years')::int, 1))) || ' с нами'
    else '' end
$$;

-- тому, кому спасибо (Telegram, как thxPing)
create or replace function _sa_ty_ping(p_from text, p_text text)
returns text language sql immutable as $$
  select _sa_chat_nm(p_from) || ' говорит тебе спасибо' || coalesce(': «' || nullif(btrim(coalesce(p_text, '')), '') || '»', '')
$$;

-- тому, у кого праздник (как cheerDm)
create or replace function _sa_ty_dm(p jsonb)
returns text language sql immutable as $$
  select split_part(btrim(coalesce(p->>'name', '')), ' ', 1) ||
    case when p->>'t' = 'anniv' then ', сегодня ' || _sa_ty_years(greatest(1, coalesce((p->>'years')::int, 1))) || ', как ты с нами'
         else ', с днём рождения' end || chr(10) || 'В «Вся команда» тебя поздравляют.'
$$;

-- ── 3) Даты из графика ──────────────────────────────────────────────────────────────
-- «Д.р.»: «15.03» (можно «15.3», «15.03.1990») → {день, месяц}
create or replace function _sa_ty_bday(p text)
returns int[] language plpgsql immutable as $$
declare x text[];
begin
  x := regexp_match(btrim(coalesce(p, '')), '^(\d{1,2})\.(\d{1,2})(\.(\d{2}|\d{4}))?$');
  if x is null then return null; end if;
  perform make_date(2000, x[2]::int, x[1]::int);
  return array[x[1]::int, x[2]::int];
exception when others then return null;
end; $$;

-- «В команде с»: «29.10.2025» или «2025-10-29»
create or replace function _sa_ty_joined(p text)
returns date language plpgsql immutable as $$
declare s text := btrim(coalesce(p, '')); x text[];
begin
  x := regexp_match(s, '^(\d{1,2})\.(\d{1,2})\.(\d{4})$');
  if x is not null then return make_date(x[3]::int, x[2]::int, x[1]::int); end if;
  if s ~ '^\d{4}-\d{2}-\d{2}$' then return make_date(left(s, 4)::int, substr(s, 6, 2)::int, substr(s, 9, 2)::int); end if;
  return null;
exception when others then return null;
end; $$;

-- тот же день в году; 29 февраля в невисокосный год — 28-го
create or replace function _sa_ty_same(p_m int, p_d int, p_day date)
returns boolean language sql immutable as $$
  select (extract(month from p_day)::int = p_m and extract(day from p_day)::int = p_d)
      or (p_m = 2 and p_d = 29 and extract(month from p_day)::int = 2 and extract(day from p_day)::int = 28
          and not ((extract(year from p_day)::int % 4 = 0 and extract(year from p_day)::int % 100 <> 0) or extract(year from p_day)::int % 400 = 0))
$$;

-- что праздновать в день p_day (как cheersDue): [{kind: bday}, {kind: anniv, years, since}]
create or replace function _sa_ty_due_of(p_day date, p_bday text, p_joined date)
returns jsonb language plpgsql immutable as $$
declare b int[]; out jsonb := '[]'::jsonb; yrs int;
begin
  b := _sa_ty_bday(p_bday);
  if b is not null and _sa_ty_same(b[2], b[1], p_day) then out := out || jsonb_build_array(jsonb_build_object('kind', 'bday')); end if;
  if p_joined is not null then
    yrs := extract(year from p_day)::int - extract(year from p_joined)::int;
    if yrs >= 1 and _sa_ty_same(extract(month from p_joined)::int, extract(day from p_joined)::int, p_day) then
      out := out || jsonb_build_array(jsonb_build_object('kind', 'anniv', 'years', yrs, 'since', to_char(p_joined, 'YYYY-MM-DD')));
    end if;
  end if;
  return out;
end; $$;

-- ── 4) «Спасибо коллеге» ────────────────────────────────────────────────────────────
-- карточка в «Вся команда» своего заведения: кому (действующий сотрудник того же заведения, не себе) и за что (до 140
-- знаков, можно без слов); тому же коллеге — раз в день (второй раз — та же карточка, again), от себя — до 15 в день
create or replace function chat_thanks(p_token text, p_to text, p_text text default '')
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; ch sa_chats; e record; t text; card jsonb; m sa_chat_msgs; old bigint; tz text; day0 timestamptz; sent boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if coalesce(p_to, '') = c->>'id' then return jsonb_build_object('ok', false, 'error', 'self'); end if;
  select x.id::text as id, btrim(coalesce(x.name, '') || ' ' || coalesce(x.surname, '')) as full_, lower(coalesce(x.position, '')) as pos into e
    from employees x where x.id::text = coalesce(p_to, '') and coalesce(x.status, 'active') = 'active' and x.restaurant is not distinct from rest;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform _sa_chat_ensure(c);
  select * into ch from sa_chats where restaurant = rest and kind = 'team';
  if ch.id is null or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if _sa_chat_fast(c) then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;
  tz := _sa_tz(rest);
  day0 := ((now() at time zone tz)::date)::timestamp at time zone tz;
  select p.msg_id into old from sa_peer_thanks p join sa_chat_msgs x on x.id = p.msg_id and not x.deleted
   where p.from_id = c->>'id' and p.to_id = e.id and p.own and p.created_at >= day0 order by p.id desc limit 1;
  if old is not null then
    select * into m from sa_chat_msgs where id = old;
    return jsonb_build_object('ok', false, 'error', 'again', 'msg', _sa_chat_smart1(c, ch, m));
  end if;
  if (select count(*) from sa_peer_thanks p where p.from_id = c->>'id' and p.own and p.created_at >= day0) >= 15 then
    return jsonb_build_object('ok', false, 'error', 'limit');
  end if;
  t := _sa_chat_cut(p_text, 140);
  card := jsonb_build_object('t', 'thx', 'to', jsonb_build_object('id', e.id, 'name', e.full_, 'pos', e.pos), 'text', t, 'plus', '[]'::jsonb);
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
    values (ch.id, c->>'id', coalesce(c->>'who', ''), rest, _sa_ty_sum(card), 'card', card) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  insert into sa_peer_thanks (msg_id, restaurant, from_id, from_name, to_id, to_name, text, own)
    values (m.id, rest, c->>'id', coalesce(c->>'who', ''), e.id, e.full_, t, true);
  sent := _sa_chat_pingk(ch, e.id, _sa_ty_ping(c->>'who', t), m.id, null, true);
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m), 'tg', coalesce(sent, false));
end; $$;

-- «Тоже спасибо» на карточке «спасибо» и «Поздравить» на дне рождения и годовщине — раз; себе и автору «спасибо» — нет
create or replace function chat_cheer(p_token text, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; m2 sa_chat_msgs; ch sa_chats; t text; k text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  t := coalesce(m.card->>'t', '');
  if m.id is null or m.deleted or m.kind <> 'card' or t not in ('thx', 'bday', 'anniv') or not _sa_chat_ok(c, ch) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if (t = 'thx' and m.card->'to'->>'id' = c->>'id') or (t <> 'thx' and m.card->>'emp' = c->>'id') then
    return jsonb_build_object('ok', false, 'error', 'self', 'msg', _sa_chat_smart1(c, ch, m));
  end if;
  if t = 'thx' and m.emp_id = c->>'id' then return jsonb_build_object('ok', false, 'error', 'own', 'msg', _sa_chat_smart1(c, ch, m)); end if;
  k := case when t = 'thx' then 'plus' else 'greet' end;
  update sa_chat_msgs x set card = jsonb_set(x.card, array[k],
      (case when jsonb_typeof(x.card->k) = 'array' then x.card->k else '[]'::jsonb end)
      || jsonb_build_array(jsonb_build_object('id', c->>'id', 'n', c->>'who', 'at', now()))), updated_at = now()
   where x.id = m.id and jsonb_array_length(case when jsonb_typeof(x.card->k) = 'array' then x.card->k else '[]'::jsonb end) < 300
     and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(x.card->k) = 'array' then x.card->k else '[]'::jsonb end) y
                      where y->>'id' = c->>'id')
  returning * into m2;
  if m2.id is not null then
    m := m2;
    if t = 'thx' then
      insert into sa_peer_thanks (msg_id, restaurant, from_id, from_name, to_id, to_name, text, own)
        values (m.id, coalesce(ch.restaurant, ''), c->>'id', coalesce(c->>'who', ''), coalesce(m.card->'to'->>'id', ''), coalesce(m.card->'to'->>'name', ''),
                coalesce(m.card->>'text', ''), false)
        on conflict (msg_id, from_id) do nothing;
    end if;
  else
    select * into m from sa_chat_msgs where id = p_msg;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_smart1(c, ch, m));
end; $$;

-- мои «спасибо» от коллег: за неделю (с понедельника), за месяц, всего; карточки — новые сверху, до 50: кто, за что,
-- кто присоединился, чат (если карточка ещё в чате)
create or replace function thanks_peer(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; me text; tz text; today date; wk timestamptz; mo timestamptz; items jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  me := c->>'id';
  tz := _sa_tz(coalesce(c->>'restaurant', ''));
  today := (now() at time zone tz)::date;
  wk := (today - (extract(isodow from today)::int - 1))::timestamp at time zone tz;
  mo := (today - (extract(day from today)::int - 1))::timestamp at time zone tz;
  select coalesce(jsonb_agg(x.j order by x.at desc, x.id desc), '[]'::jsonb) into items from (
    select o.created_at as at, o.id, jsonb_build_object('msg', o.msg_id, 'chat', (select m.chat_id from sa_chat_msgs m where m.id = o.msg_id and not m.deleted),
      'from', o.from_id, 'name', o.from_name, 'text', o.text, 'at', o.created_at,
      'plus', coalesce((select jsonb_agg(q.from_name order by q.created_at, q.id) from sa_peer_thanks q where q.msg_id = o.msg_id and not q.own), '[]'::jsonb)) as j
      from sa_peer_thanks o where o.to_id = me and o.own order by o.created_at desc, o.id desc limit 50) x;
  return jsonb_build_object('ok', true, 'day', to_char(today, 'YYYY-MM-DD'),
    'week', (select count(*) from sa_peer_thanks p where p.to_id = me and p.created_at >= wk),
    'month', (select count(*) from sa_peer_thanks p where p.to_id = me and p.created_at >= mo),
    'total', (select count(*) from sa_peer_thanks p where p.to_id = me), 'items', items);
end; $$;

-- для «Сотрудника недели»: «спасибо» за 8 дней по людям сети — когда (одно от человека тому же коллеге в день)
create or replace function thanks_week(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; list jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(e.name, ''), 'surname', coalesce(e.surname, ''), 'restaurant', coalesce(e.restaurant, ''),
           'position', lower(coalesce(e.position, '')), 'at', x.ats) order by x.to_id), '[]'::jsonb) into list
    from (select p.to_id, jsonb_agg(p.first_at order by p.first_at) as ats
            from (select q.to_id, q.from_id, (q.created_at at time zone _sa_tz(q.restaurant))::date as d, min(q.created_at) as first_at
                    from sa_peer_thanks q where q.created_at > now() - interval '8 days' group by 1, 2, 3) p
           group by p.to_id) x
    join employees e on e.id::text = x.to_id and coalesce(e.status, 'active') = 'active';
  return jsonb_build_object('ok', true, 'list', list);
end; $$;

-- в карточке коллеги: сколько «спасибо» от коллег (всего и за месяц); своё заведение, руководителю — любое
create or replace function thanks_of(p_token text, p_emp text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; tz text; mo timestamptz;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select e.restaurant into rest from employees e where e.id::text = coalesce(p_emp, '') and coalesce(e.status, 'active') = 'active';
  if rest is null or (rest is distinct from (c->>'restaurant') and not coalesce((c->>'lead')::boolean, false)) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  tz := _sa_tz(rest);
  mo := ((now() at time zone tz)::date - (extract(day from (now() at time zone tz)::date)::int - 1))::timestamp at time zone tz;
  return jsonb_build_object('ok', true, 'n', (select count(*) from sa_peer_thanks p where p.to_id = p_emp),
    'month', (select count(*) from sa_peer_thanks p where p.to_id = p_emp and p.created_at >= mo));
end; $$;

-- ── 5) Дни рождения и годовщины ───────────────────────────────────────────────────────
-- «Вся команда» заведения (заводится, если её ещё нет)
create or replace function _sa_ty_team(p_rest text)
returns sa_chats language plpgsql security definer set search_path to public as $$
declare ch sa_chats;
begin
  insert into sa_chats (restaurant, kind) values (p_rest, 'team') on conflict (restaurant, kind) where kind in ('team', 'leads') do nothing;
  select * into ch from sa_chats where restaurant = p_rest and kind = 'team';
  return ch;
end; $$;

-- карточка от «Академии» (автора нет: id пустой)
create or replace function _sa_ty_post(ch sa_chats, p_card jsonb)
returns bigint language plpgsql security definer set search_path to public as $$
declare mid bigint;
begin
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, card)
    values (ch.id, '', 'Академия', coalesce(ch.restaurant, ''), _sa_ty_sum(p_card), 'card', p_card) returning id into mid;
  return mid;
end; $$;

-- у кого сегодня праздник (p_rest — одно заведение, null — все): день рождения по «Д.р.» графика, годовщина по
-- «В команде с» графика или дню прихода в «Новички»; с 9:00 до 21:00 по часам заведения, раз в день на человека и
-- повод. p_send — карточка в «Вся команда» и сообщение бота самому; без — только список. p_all — весь сегодняшний
-- день, вместе с уже отмеченными (posted) — для просмотра владельцем
create or replace function _sa_ty_due(p_send boolean, p_now timestamptz, p_rest text default null, p_all boolean default false)
returns jsonb language plpgsql security definer set search_path to public as $$
declare r record; e record; tz text; lnow timestamp; today date; cfg jsonb; st jsonb; joined date; ns timestamptz; x jsonb; card jsonb;
  ch sa_chats; mid bigint; out jsonb := '[]'::jsonb; nbt boolean := to_regclass('public.sa_newbies') is not null; done boolean;
begin
  for r in select distinct e0.restaurant as rest from employees e0
            where coalesce(e0.status, 'active') = 'active' and coalesce(e0.restaurant, '') <> '' and (p_rest is null or e0.restaurant = p_rest)
            order by 1 loop
    begin
      tz := _sa_tz(r.rest); lnow := p_now at time zone tz; today := lnow::date;
      continue when not (p_all and not p_send) and (extract(hour from lnow) < 9 or extract(hour from lnow) >= 21);
      cfg := _sa_sh_cfg(r.rest);
      for e in select y.id::text as id, btrim(coalesce(y.name, '') || ' ' || coalesce(y.surname, '')) as full_, lower(coalesce(y.position, '')) as pos
                 from employees y where y.restaurant = r.rest and coalesce(y.status, 'active') = 'active' order by y.id::text loop
        st := case when cfg is not null then _sa_sh_staff(cfg, e.id, to_char(today, 'YYYY-MM')) end;
        joined := _sa_ty_joined(st->>'joined');
        if joined is null and nbt then
          ns := null;
          execute 'select started_at from sa_newbies where emp_id = $1 and not off' into ns using e.id;
          joined := (ns at time zone tz)::date;
        end if;
        for x in select * from jsonb_array_elements(_sa_ty_due_of(today, st->>'bday', joined)) loop
          done := exists (select 1 from sa_cheers q where q.emp_id = e.id and q.day = today and q.kind = x->>'kind');
          continue when done and not (p_all and not p_send);
          card := jsonb_strip_nulls(jsonb_build_object('t', x->>'kind', 'emp', e.id, 'name', e.full_, 'pos', e.pos,
            'years', case when x->>'kind' = 'anniv' then (x->>'years')::int end, 'since', x->>'since', 'day', to_char(today, 'YYYY-MM-DD'),
            'greet', '[]'::jsonb));
          if p_send then
            insert into sa_cheers (emp_id, day, kind, restaurant, years) values (e.id, today, x->>'kind', r.rest, (x->>'years')::int)
              on conflict do nothing;
            continue when not found;
            ch := _sa_ty_team(r.rest);
            mid := _sa_ty_post(ch, card);
            update sa_cheers set msg_id = mid where emp_id = e.id and day = today and kind = x->>'kind';
            perform _sa_chat_pingk(ch, e.id, _sa_ty_dm(card), mid, null, true);
          end if;
          out := out || jsonb_strip_nulls(jsonb_build_object('emp', e.id, 'name', e.full_, 'rest', r.rest, 'kind', x->>'kind', 'years', (x->>'years')::int,
            'card', card, 'text', _sa_ty_dm(card), 'posted', case when p_all and not p_send then done end));
        end loop;
      end loop;
    exception when others then
      raise warning 'Поздравления: заведение % — %', r.rest, sqlerrm;
    end;
  end loop;
  return out;
end; $$;

-- приложение открыло чат: праздники своего заведения — сразу (если расписания нет или оно ещё не дошло)
create or replace function cheer_poke(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', true, 'n', 0); end if;
  return jsonb_build_object('ok', true, 'n', jsonb_array_length(_sa_ty_due(true, now(), rest)));
end; $$;

create or replace function sa_cheer_tick()
returns int language plpgsql security definer set search_path to public as $$
begin
  return jsonb_array_length(_sa_ty_due(true, now()));
end; $$;

create or replace function sa_cheer_preview()
returns jsonb language sql security definer set search_path to public as $$
  select _sa_ty_due(false, now(), null, true)
$$;

do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: карточки дней рождения и годовщин появятся, когда кто-нибудь откроет чат (включи pg_cron и запусти файл ещё раз)';
    return;
  end if;
  begin execute $c$select cron.unschedule('sa-cheer')$c$; exception when others then null; end;
  execute $c$select cron.schedule('sa-cheer', '*/10 * * * *', 'select public.sa_cheer_tick()')$c$;
exception when others then
  raise notice 'Расписание «Поздравления» не создано: %', sqlerrm;
end $$;

-- ── 6) Права ───────────────────────────────────────────────────────────────────────
revoke all on function _sa_ty_years(int) from public, anon, authenticated;
revoke all on function _sa_ty_sum(jsonb) from public, anon, authenticated;
revoke all on function _sa_ty_ping(text, text) from public, anon, authenticated;
revoke all on function _sa_ty_dm(jsonb) from public, anon, authenticated;
revoke all on function _sa_ty_bday(text) from public, anon, authenticated;
revoke all on function _sa_ty_joined(text) from public, anon, authenticated;
revoke all on function _sa_ty_same(int, int, date) from public, anon, authenticated;
revoke all on function _sa_ty_due_of(date, text, date) from public, anon, authenticated;
revoke all on function _sa_ty_team(text) from public, anon, authenticated;
revoke all on function _sa_ty_post(sa_chats, jsonb) from public, anon, authenticated;
revoke all on function _sa_ty_due(boolean, timestamptz, text, boolean) from public, anon, authenticated;
revoke all on function sa_cheer_tick() from public, anon, authenticated;
revoke all on function sa_cheer_preview() from public, anon, authenticated;
revoke all on function chat_thanks(text, text, text), chat_cheer(text, bigint), thanks_peer(text), thanks_week(text), thanks_of(text, text),
  cheer_poke(text) from public;
grant execute on function chat_thanks(text, text, text), chat_cheer(text, bigint), thanks_peer(text), thanks_week(text), thanks_of(text, text),
  cheer_poke(text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'тепло в команде: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('chat_thanks', 'chat_cheer', 'thanks_peer', 'thanks_week', 'thanks_of', 'cheer_poke')) || ' функций из 6' ||
  ' · расписание: ' || _sa_cron_status('sa-cheer') ||
  ' · бот: ' || case when _sa_tg_ready() then 'на месте' else 'нет (карточки в чате будут, сообщений в Telegram — нет)' end ||
  ' · сегодня праздник: ' || jsonb_array_length(_sa_ty_due(false, now(), null, true)) ||
  ' · «спасибо» от коллег всего: ' || (select count(*) from sa_peer_thanks) as result;
