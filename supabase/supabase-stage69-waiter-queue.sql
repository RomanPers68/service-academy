-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 69 (Доп. 539): очередь официантов и «Занят, передать дальше»
--
-- Владелец: «Столы у нас не закрепляются за официантом, так как работает система очередности» и «Бывает такое,
-- что официант чуть дольше принимает заказ, так как гость задает много вопросов. В общем, нужно что-то добавить в
-- виде передачи стола дальше по очереди».
--
-- Что делает:
--   1. Таблица sa_queue — очередь официантов заведения на день: ord — [{ id, away, out }] по порядку (away — на
--      перерыве, очередь его пропускает; out — убран из очереди на сегодня). Напрямую закрыта, старше недели стирается.
--   2. queue_get(token) — очередь на сегодня. Составляет её хостес или руководитель, по приходу: кто пришёл первым,
--      тот первый (владелец: «она составляется в том порядке, в какое время сотрудник зашел на работу»). Сама не
--      собирается: утром она пустая. Уволенных и сменивших должность в ней нет. Видят все в заведении; others —
--      официанты, которых в очереди нет: сначала сегодняшние по графику, по времени начала смены (from), потом
--      остальные по имени.
--   3. queue_set(token, ord) — порядок, «на перерыве», убрать и вернуть. Руководитель, старший и хостес.
--   4. chat_call (этап 68) — как был, плюс: официанта позвали лично к столу — он уходит в конец очереди. В Telegram у
--      такого вызова две кнопки: «Иду» и «Занят, передать дальше».
--   5. chat_pass(token, msg) — «Занят, передать дальше»: стол уходит следующему в очереди (не на перерыве и не из
--      тех, кто этот стол уже передал); занятый становится первым (стол ему не достался), следующий уходит в конец.
--      Передать может тот, кого позвали, тот, кто позвал (официант не отвечает), и руководитель. В чате — новый
--      вызов «Ольга зовёт Петра: к столу 13» (from — от кого передали), у прежнего — passed: кому передали.
--      Следующему — Telegram с кнопками, позвавшему — «Анна передаёт стол 13 дальше: позвали Петра.».
--      Передать некому — nobody; на вызов уже идут — going; уже передан — passed; старше 10 минут — stale.
--   6. «Иду» на переданный вызов — passed (и в приложении, и в Telegram); в «вызовах мне» переданных нет.
--   7. seat_set (этап 56) — как был, плюс: в «Рассадке» посадили гостей официанту — он уходит в конец очереди, как
--      после «Позвать» к столу. Двигается только тот, кто в очереди: добавляет в неё хостес.
--   8. chat_call_state(token, ids) — колокольчики на схеме: что с вызовами к столам — ждём ответа, «Иду» (кто и
--      когда), «на месте», передали дальше (кому). По каждому вызову — последний в цепочке передач.
--   9. chat_call_done(token, msg) — «На месте»: официант подошёл, не нажав «Иду» (владелец: «чаще всего официант
--      подходит сразу не нажимая «иду»»). Отмечает тот, кто позвал, хостес, старший или руководитель; вызов пропадает у
--      официанта, передать его дальше уже нельзя (going).
--
-- Нужны этапы 38, 56 и 68. Безвреден повторно.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- Страховка: очередь живёт в вызовах этапа 68
do $$
begin
  if to_regprocedure('public.chat_call(text,text,text,text,text,text)') is null
     or position('''already''' in pg_get_functiondef('public.chat_call(text,text,text,text,text,text)'::regprocedure)) = 0 then
    raise exception 'Сначала этап 68 (supabase-stage68-call-series.sql): «Позвать» подряд';
  end if;
  if to_regprocedure('public._sa_seat_follow(text,date,text,text,text)') is null then
    raise exception 'Сначала этап 56 (supabase-stage56-join-move-wait.sql): объединить столы, пересадить гостей, лист ожидания';
  end if;
end $$;

-- ── 1) Таблица ────────────────────────────────────────────────────────────────
create table if not exists sa_queue (
  restaurant text not null,
  day        date not null,
  ord        jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (restaurant, day),
  constraint sa_queue_ord check (jsonb_typeof(ord) = 'array')
);
alter table sa_queue enable row level security;
revoke all on table sa_queue from public, anon, authenticated;

-- ── 2) Очередь на сегодня ──────────────────────────────────────────────────────
-- день заведения — в его часовом поясе, как график «на сегодня»
create or replace function _sa_queue_day(p_rest text)
returns date language sql stable security definer set search_path to public as $$
  select (now() at time zone _sa_tz(p_rest))::date
$$;

-- официант заведения (работает, должность — официант)
create or replace function _sa_queue_waiter(p_rest text, p_emp text)
returns boolean language sql stable security definer set search_path to public as $$
  select exists (select 1 from employees e where e.id::text = p_emp and e.restaurant is not distinct from p_rest
                   and coalesce(e.status, 'active') = 'active' and lower(coalesce(e.position, '')) = 'waiter')
$$;

-- очередь дня: строка на сегодня; уволенных, сменивших должность и повторы — убрать. Сама очередь не собирается:
-- её составляет хостес или руководитель по приходу (queue_set)
create or replace function _sa_queue_ord(p_rest text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare d date := _sa_queue_day(p_rest); q jsonb; nq jsonb;
begin
  insert into sa_queue (restaurant, day) values (p_rest, d) on conflict (restaurant, day) do nothing;
  select ord into q from sa_queue where restaurant = p_rest and day = d for update;
  with cur as (
    select x.e, x.o, row_number() over (partition by x.e->>'id' order by x.o) as k
      from jsonb_array_elements(q) with ordinality x(e, o) where _sa_queue_waiter(p_rest, x.e->>'id')
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', cur.e->>'id', 'away', coalesce(cur.e->>'away' = 'true', false),
           'out', coalesce(cur.e->>'out' = 'true', false)) order by cur.o), '[]'::jsonb)
    into nq from cur where cur.k = 1;
  if nq is distinct from q then
    update sa_queue set ord = nq, updated_at = now() where restaurant = p_rest and day = d;
  end if;
  delete from sa_queue where restaurant = p_rest and day < d - 7;
  return nq;
end; $$;

-- переставить официанта: в конец (позвали к столу, посадили гостей) или первым (занят, передал стол); вернуть в
-- очередь, если убирали, и снять «на перерыве» — раз зовут, он работает. Кого в очереди нет, не трогаем: в неё
-- добавляет хостес
create or replace function _sa_queue_move(p_rest text, p_emp text, p_first boolean)
returns void language plpgsql volatile security definer set search_path to public as $$
declare q jsonb; others jsonb; e jsonb;
begin
  if p_emp is null or not _sa_queue_waiter(p_rest, p_emp) then return; end if;
  q := _sa_queue_ord(p_rest);
  if not exists (select 1 from jsonb_array_elements(q) x where x->>'id' = p_emp) then return; end if;
  e := jsonb_build_object('id', p_emp, 'away', false, 'out', false);
  select coalesce(jsonb_agg(x.e order by x.o), '[]'::jsonb) into others from jsonb_array_elements(q) with ordinality x(e, o) where x.e->>'id' <> p_emp;
  update sa_queue set ord = case when p_first then jsonb_build_array(e) || others else others || jsonb_build_array(e) end, updated_at = now()
   where restaurant = p_rest and day = _sa_queue_day(p_rest);
end; $$;

-- следующий в очереди: не на перерыве, не убран, не из p_skip
create or replace function _sa_queue_next(p_rest text, p_skip text[])
returns text language sql volatile security definer set search_path to public as $$
  select x.e->>'id' from jsonb_array_elements(_sa_queue_ord(p_rest)) with ordinality x(e, o)
   where not coalesce(x.e->>'away' = 'true', false) and not coalesce(x.e->>'out' = 'true', false)
     and not (x.e->>'id' = any(coalesce(p_skip, array[]::text[])))
   order by x.o limit 1
$$;

-- менять очередь: руководитель, старший и хостес
create or replace function _sa_queue_can(c jsonb)
returns boolean language sql immutable as $$
  select coalesce((c->>'lead')::boolean, false) or coalesce((c->>'admin')::boolean, false) or lower(coalesce(c->>'position', '')) in ('hostess', 'senior')
$$;

-- во сколько у официанта сегодня начинается смена по графику (null — сегодня не в графике): подсказка хостес, кто
-- скоро придёт. Строка графика — по словам имени, как у смен в чате (этап 38)
create or replace function _sa_queue_from(p_rest text, p_emp text)
returns int language plpgsql stable security definer set search_path to public as $$
declare cfg jsonb := _sa_sh_cfg(p_rest); d date := _sa_queue_day(p_rest); s jsonb; def jsonb;
begin
  if cfg is null then return null; end if;
  s := _sa_sh_staff(cfg, p_emp, to_char(d, 'YYYY-MM'));
  if s is null then return null; end if;
  def := _sa_sh_def(cfg, _sa_sh_code(p_rest, s->>'id', d));
  if def is null or coalesce(def->>'extra', '') in ('1', 'true') or coalesce(def->>'from', '') !~ '^[0-9]{1,2}$' then return null; end if;
  return (def->>'from')::int;
end; $$;

-- ответ: list — очередь по порядку с именами; others — официанты, которых в ней нет (сначала сегодняшние по графику,
-- по времени начала смены; from — час начала); edit — можно ли менять
create or replace function _sa_queue_json(c jsonb, p_rest text, q jsonb)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('ok', true, 'day', _sa_queue_day(p_rest), 'edit', _sa_queue_can(c),
    'list', coalesce((select jsonb_agg(jsonb_build_object('id', x.e->>'id', 'name', btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
        'away', coalesce(x.e->>'away' = 'true', false), 'out', coalesce(x.e->>'out' = 'true', false)) order by x.o)
      from jsonb_array_elements(q) with ordinality x(e, o) join employees e on e.id::text = x.e->>'id'), '[]'::jsonb),
    'others', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.nm, 'from', w.f) order by w.f is null, w.f, w.nm, w.id)
      from (select e.id::text as id, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) as nm, _sa_queue_from(p_rest, e.id::text) as f
              from employees e where e.restaurant is not distinct from p_rest and coalesce(e.status, 'active') = 'active' and lower(coalesce(e.position, '')) = 'waiter'
               and not exists (select 1 from jsonb_array_elements(q) y where y->>'id' = e.id::text)) w), '[]'::jsonb))
$$;

create or replace function queue_get(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  return _sa_queue_json(c, rest, _sa_queue_ord(rest));
end; $$;

-- ── 3) Изменить очередь ──────────────────────────────────────────────────────────
-- p_ord — [{ id, away, out }] в нужном порядке. Чужие и не официанты отбрасываются, повторы — тоже; кого в присланном
-- нет, но в очереди был (с другого телефона дописали), остаётся в конце, как был.
create or replace function queue_set(p_token text, p_ord jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; rest text; q jsonb; nq jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if not _sa_queue_can(c) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if jsonb_typeof(p_ord) is distinct from 'array' or jsonb_array_length(p_ord) > 80 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  q := _sa_queue_ord(rest);
  with x as (
    select y.e, y.o, row_number() over (partition by y.e->>'id' order by y.o) as k
      from jsonb_array_elements(p_ord) with ordinality y(e, o)
     where jsonb_typeof(y.e) = 'object' and _sa_queue_waiter(rest, y.e->>'id')
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', x.e->>'id', 'away', coalesce(x.e->>'away' = 'true', false), 'out', coalesce(x.e->>'out' = 'true', false)) order by x.o), '[]'::jsonb)
    into nq from x where x.k = 1;
  nq := nq || coalesce((select jsonb_agg(y.e order by y.o) from jsonb_array_elements(q) with ordinality y(e, o)
          where not exists (select 1 from jsonb_array_elements(nq) z where z->>'id' = y.e->>'id')), '[]'::jsonb);
  update sa_queue set ord = nq, updated_at = now(), updated_by = c->>'id' where restaurant = rest and day = _sa_queue_day(rest);
  return _sa_queue_json(c, rest, nq);
end; $$;

-- ── 4) «Позвать»: у вызова к столу в Telegram — «Иду» и «Занят, передать дальше» ─────────────────
-- кнопки вызова: cg:<вызов> — «Иду», cg:<вызов>:1 — «Занят, передать дальше» (разбирает _sa_chat_tg_cb)
create or replace function _sa_chat_call_kb(p_msg bigint, p_chat bigint, p_pass boolean)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_array(
    case when p_pass then jsonb_build_array(jsonb_build_object('text', 'Иду', 'callback_data', 'cg:' || p_msg),
                                            jsonb_build_object('text', 'Занят, передать дальше', 'callback_data', 'cg:' || p_msg || ':1'))
         else jsonb_build_array(jsonb_build_object('text', 'Иду', 'callback_data', 'cg:' || p_msg)) end,
    jsonb_build_array(_sa_chat_tg_open(p_chat, p_msg)))
$$;

-- вызов — как этап 68; официанта позвали лично к столу — он в конец очереди; кнопки Telegram — _sa_chat_call_kb
create or replace function chat_call(p_token text, p_who text, p_emp text, p_why text, p_table text, p_text text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ch sa_chats; to_name text := ''; call jsonb; line text; m sa_chat_msgs; prev sa_chat_msgs;
  today text[]; t record; chat bigint; tbl text; txt text; emp text; n int; first_at timestamptz;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  if p_who is null or p_who not in ('lead', 'host', 'bar', 'waiter', 'person') or p_why is null or p_why not in ('table', 'help', 'come', 'guest', 'own') then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  if p_who = 'person' then
    select btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) into to_name from employees e
     where e.id::text = p_emp and e.restaurant is not distinct from rest and coalesce(e.status, 'active') = 'active' and e.id::text <> c->>'id';
    if to_name is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  end if;
  tbl := btrim(coalesce(p_table, '')); txt := _sa_clip(p_text, 200);
  if p_why = 'table' and tbl !~ '^[0-9A-Za-zА-Яа-яЁё]{1,6}$' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if p_why = 'own' and (txt = '' or char_length(txt) > 80) then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if p_why <> 'table' then tbl := ''; end if;
  if p_why <> 'own' then txt := ''; end if;
  emp := case when p_who = 'person' then p_emp else '' end;
  -- v212 (этап 68): тот же вызов за 30 секунд второй раз не уходит (кого, зачем, стол, свой текст — те же)
  select x.* into prev from sa_chat_msgs x
   where x.emp_id = c->>'id' and x.kind = 'call' and not x.deleted and x.created_at > now() - interval '30 seconds'
     and x.call->>'who' = p_who and coalesce(x.call->>'emp', '') = emp and x.call->>'why' = p_why
     and coalesce(x.call->>'table', '') = tbl and coalesce(x.call->>'text', '') = txt
   order by x.created_at desc limit 1;
  if prev.id is not null then
    return jsonb_build_object('ok', false, 'error', 'already', 'msg', _sa_chat_msg_json(prev));
  end if;
  -- от лавины нажатий: не больше 15 вызовов за 5 минут; wait — через сколько секунд можно снова
  select count(*), min(x.created_at) into n, first_at from sa_chat_msgs x
   where x.emp_id = c->>'id' and x.kind = 'call' and x.created_at > now() - interval '5 minutes';
  if n >= 15 then
    return jsonb_build_object('ok', false, 'error', 'too_many',
      'wait', greatest(1, ceil(extract(epoch from (first_at + interval '5 minutes' - now()))))::int);
  end if;
  perform _sa_chat_ensure(c);
  select * into ch from sa_chats x where x.restaurant = rest and x.kind = 'team';
  call := jsonb_build_object('who', p_who, 'emp', case when p_who = 'person' then p_emp end, 'to_name', to_name, 'why', p_why,
    'table', tbl, 'text', txt, 'going', '[]'::jsonb);
  line := split_part(coalesce(c->>'who', ''), ' ', 1) || ' зовёт ' || _sa_chat_call_who(call) || ': ' || _sa_chat_call_why(call);
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, call) values (ch.id, c->>'id', coalesce(c->>'who', ''), coalesce(c->>'restaurant', ''), line, 'call', call) returning * into m;
  perform _sa_chat_after_write(ch, c->>'id', m.id);
  -- v213: позвали официанта лично к столу — он уходит в конец очереди
  if p_who = 'person' and p_why = 'table' then perform _sa_queue_move(rest, p_emp, false); end if;
  -- кого зовут: человека; по должности — кто сегодня в графике (графика нет — все с этой должностью)
  if _sa_tg_ready() then
    today := _sa_chat_today(rest);
    for t in
      select e.id::text as id from employees e
       where e.restaurant is not distinct from rest and coalesce(e.status, 'active') = 'active' and e.id::text <> c->>'id'
         and case when p_who = 'person' then e.id::text = p_emp
                  when p_who = 'lead' then coalesce(e.is_admin, false) or lower(coalesce(e.position, '')) = any(_sa_chat_lead_pos())
                  else lower(coalesce(e.position, '')) = any(_sa_chat_role_pos(p_who)) end
         and (p_who = 'person' or today is null or cardinality(today) = 0 or e.id::text = any(today))
    loop
      chat := _sa_tg_chat(t.id, 'chat');
      if chat is not null then   -- v97: «Иду» прямо в Telegram
        perform _sa_chat_tg(chat, split_part(coalesce(c->>'who', ''), ' ', 1) || ' зовёт ' || case when p_who = 'person' then 'тебя' else _sa_chat_call_who(call) end ||
          ': ' || _sa_chat_call_why(call), _sa_chat_call_kb(m.id, ch.id, p_who = 'person' and p_why = 'table'));
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;
-- вызовы мне — без переданных дальше
create or replace function _sa_chat_calls(c jsonb)
returns jsonb language sql stable security definer set search_path to public as $$
  select coalesce(jsonb_agg(_sa_chat_msg_json(m) order by m.id), '[]'::jsonb)
    from sa_chat_msgs m join sa_chats ch on ch.id = m.chat_id
   where ch.restaurant is not distinct from (c->>'restaurant') and ch.kind = 'team' and m.kind = 'call' and not m.deleted
     and m.created_at > now() - interval '10 minutes' and coalesce(jsonb_array_length(m.call->'going'), 0) = 0
     and not (m.call ? 'passed') and not (m.call ? 'done')
     and _sa_chat_call_for(m, c)
$$;

-- «Иду» — как в этапе 38; стол уже передали дальше — passed
create or replace function chat_go(p_token text, p_msg bigint)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.kind <> 'call' or m.deleted or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.emp_id = c->>'id' then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if m.call ? 'passed' then return jsonb_build_object('ok', false, 'error', 'passed', 'msg', _sa_chat_msg_json(m)); end if;
  m := _sa_chat_go_do(c, m);
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

-- ── 5) «Занят, передать дальше» ─────────────────────────────────────────────────────
create or replace function _sa_chat_pass_do(c jsonb, m sa_chat_msgs)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare ch sa_chats; target text; tname text; skip text[]; nxt text; nname text; call2 jsonb; m2 sa_chat_msgs; line text; tgc bigint;
  caller1 text; by_target boolean;
begin
  select * into ch from sa_chats where id = m.chat_id;
  if m.kind <> 'call' or m.deleted or m.call->>'who' is distinct from 'person' or m.call->>'why' is distinct from 'table' then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  target := m.call->>'emp'; tname := btrim(coalesce(m.call->>'to_name', ''));
  by_target := target = c->>'id';
  if not by_target and m.emp_id <> c->>'id' and not coalesce((c->>'lead')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if m.call ? 'passed' then return jsonb_build_object('ok', false, 'error', 'passed', 'msg', _sa_chat_msg_json(m)); end if;
  if coalesce(jsonb_array_length(m.call->'going'), 0) > 0 or m.call ? 'done' then return jsonb_build_object('ok', false, 'error', 'going', 'msg', _sa_chat_msg_json(m)); end if;
  if m.created_at < now() - interval '10 minutes' then return jsonb_build_object('ok', false, 'error', 'stale'); end if;
  -- кому нельзя: тот, кого звали, и все, кто этот стол уже передал
  select coalesce(array_agg(distinct z.s), array[]::text[]) into skip
    from (select target as s union all select jsonb_array_elements_text(case when jsonb_typeof(m.call->'skip') = 'array' then m.call->'skip' else '[]'::jsonb end)) z
   where z.s is not null and z.s <> '';
  nxt := _sa_queue_next(ch.restaurant, skip);
  if nxt is null then return jsonb_build_object('ok', false, 'error', 'nobody'); end if;
  select btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')) into nname from employees e where e.id::text = nxt;
  -- занятый — первым (стол ему не достался), следующий — в конец
  perform _sa_queue_move(ch.restaurant, target, true);
  perform _sa_queue_move(ch.restaurant, nxt, false);
  call2 := jsonb_build_object('who', 'person', 'emp', nxt, 'to_name', nname, 'why', 'table', 'table', coalesce(m.call->>'table', ''), 'text', '',
    'going', '[]'::jsonb, 'skip', to_jsonb(skip), 'from', jsonb_build_object('id', target, 'name', tname, 'self', by_target));
  caller1 := split_part(btrim(coalesce(m.emp_name, '')), ' ', 1);
  line := caller1 || ' зовёт ' || _sa_chat_call_who(call2) || ': ' || _sa_chat_call_why(call2);
  insert into sa_chat_msgs (chat_id, emp_id, emp_name, emp_rest, body, kind, call)
    values (m.chat_id, m.emp_id, m.emp_name, m.emp_rest, line, 'call', call2) returning * into m2;
  perform _sa_chat_after_write(ch, m.emp_id, m2.id);
  update sa_chat_msgs set call = call || jsonb_build_object('passed', jsonb_build_object('by', c->>'id', 'by_name', coalesce(c->>'who', ''),
      'to', nxt, 'to_name', nname, 'at', now(), 'msg', m2.id)), updated_at = now()
   where id = m.id returning * into m;
  if _sa_tg_ready() then
    tgc := _sa_tg_chat(nxt, 'chat');
    if tgc is not null then
      perform _sa_chat_tg(tgc, caller1 || ' зовёт тебя: ' || _sa_chat_call_why(call2) || '. ' || split_part(tname, ' ', 1)
        || case when by_target then ' передаёт этот стол тебе.' else ' не отвечает, стол передали тебе.' end,
        _sa_chat_call_kb(m2.id, ch.id, true));
    end if;
    if m.emp_id <> c->>'id' then
      tgc := _sa_tg_chat(m.emp_id, 'chat');
      if tgc is not null then
        perform sa_tg_send(tgc, split_part(tname, ' ', 1) || ' передаёт стол ' || coalesce(m.call->>'table', '') || ' дальше: позвали '
          || _sa_chat_acc(split_part(nname, ' ', 1)) || '.', null, null);
      end if;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m), 'next', _sa_chat_msg_json(m2));
end; $$;

create or replace function chat_pass(p_token text, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.kind <> 'call' or m.deleted or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return _sa_chat_pass_do(c, m);
end; $$;

-- ── 6) Кнопки бота ────────────────────────────────────────────────────────────────
-- нажатие: cg:<вызов> — «Иду»; cg:<вызов>:1 — «Занят, передать дальше»; ct:<карточка> — «Забрать» или «Выйду»;
-- cv:<опрос>:<вариант> — голос. Стол уже передали дальше — «Иду» не ставим. Остальное — как в этапе 38.
create or replace function _sa_chat_tg_cb(cq jsonb)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare mm text[]; c jsonb; m sa_chat_msgs; ch sa_chats; r jsonb; done text; tip text; kb jsonb; msg jsonb; o int; ok boolean := true;
begin
  mm := regexp_match(coalesce(cq->>'data', ''), '^(cg|ct|cv):(\d{1,18})(?::(\d))?$');
  if mm is null then
    perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id'));
    return jsonb_build_object('ok', true, 'skip', 'data');
  end if;
  c := _sa_tg_caller(cq->'from'->>'id');
  if c is null then
    perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'show_alert', true,
      'text', 'Этот Telegram не связан с приложением. Открой приложение: «Смена» → «Напоминания в Telegram».'));
    return jsonb_build_object('ok', true, 'skip', 'who');
  end if;
  select * into m from sa_chat_msgs where id = mm[2]::bigint;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.deleted or not _sa_chat_ok(c, ch) then
    perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', 'Этого сообщения в чате уже нет'));
    return jsonb_build_object('ok', true, 'skip', 'row');
  end if;
  if mm[1] = 'cg' then
    -- v213: cg:<вызов>:1 — «Занят, передать дальше»; переданный дальше стол — уже не твой: «Иду» не ставим
    if m.kind = 'call' and mm[3] = '1' then
      r := _sa_chat_pass_do(c, m);
      ok := coalesce((r->>'ok')::boolean, false);
      if not ok and r->>'error' = 'nobody' then
        perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'show_alert', true,
          'text', 'Передать некому: остальные в очереди на перерыве или уже передали этот стол.'));
        return jsonb_build_object('ok', true, 'act', 'cp', 'msg', m.id, 'done', false);
      end if;
      done := case when ok then 'Стол передан дальше: позвали ' || _sa_chat_acc(split_part(coalesce(r->'next'->'call'->>'to_name', ''), ' ', 1)) || '.'
        when r->>'error' = 'going' then 'На этот вызов уже идут.'
        when r->>'error' = 'passed' then 'Этот стол уже передали дальше.'
        when r->>'error' = 'stale' then 'Вызов устарел.'
        else 'Не получилось. Открой чат.' end;
      tip := case when ok then 'Стол передан' else done end;
    elsif m.kind <> 'call' or m.emp_id = c->>'id' then
      perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id'));
      return jsonb_build_object('ok', true, 'skip', 'call');
    elsif m.call ? 'passed' then
      ok := false; done := 'Этот стол уже передали дальше.'; tip := done;
    else
      m := _sa_chat_go_do(c, m);
      done := 'Ты идёшь.'; tip := 'Отметил: ты идёшь';
    end if;
  elsif mm[1] = 'ct' then
    r := _sa_sh_take_do(c, m.id);
    ok := coalesce((r->>'ok')::boolean, false);
    done := case when ok and m.card->>'mode' = 'need' then 'Ты выходишь в эту смену. График обновлён.'
      when ok then 'Смена твоя. График обновлён.'
      when r->>'error' = 'taken' then case when m.card->>'mode' = 'need' then 'Уже нашли, кто выйдет.' else 'Смену уже забрали.' end
      when r->>'error' = 'not_allowed' then coalesce(nullif(regexp_replace(coalesce(r->>'why', ''), '\.?$', '.'), '.'), 'Эту смену взять нельзя.')
      when r->>'error' = 'no_schedule' then 'График смен ещё не заполнен.'
      else 'Не получилось. Открой чат.' end;
    tip := case when ok then 'Готово, график обновлён' else done end;
  else
    o := case when mm[3] is not null then mm[3]::int end;
    if m.kind <> 'card' or m.card->>'t' <> 'poll' or o is null or o >= jsonb_array_length(coalesce(m.card->'opts', '[]'::jsonb)) then
      perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id'));
      return jsonb_build_object('ok', true, 'skip', 'option');
    end if;
    m := _sa_poll_vote_do(c, m, o, false);
    done := 'Твой ответ: «' || (m.card->'opts'->>o) || '».'; tip := 'Голос учтён';
  end if;
  msg := cq->'message';
  if jsonb_typeof(msg) = 'object' and msg->'chat'->>'id' is not null and msg->>'message_id' is not null then
    select coalesce(jsonb_agg(rw), '[]'::jsonb) into kb
      from jsonb_array_elements(case when jsonb_typeof(msg->'reply_markup'->'inline_keyboard') = 'array' then msg->'reply_markup'->'inline_keyboard' else '[]'::jsonb end) rw
     where mm[1] = 'cv' or not exists (select 1 from jsonb_array_elements(rw) b where b ? 'callback_data');
    perform _sa_chat_tg_api('editMessageText', jsonb_build_object('chat_id', msg->'chat'->'id', 'message_id', msg->'message_id', 'disable_web_page_preview', true,
      'text', left(regexp_replace(coalesce(msg->>'text', ''), E'\n\n(Ты идёшь|Стол передан|Этот стол уже|На этот вызов|Вызов устарел|Смена твоя|Ты выходишь|Твой ответ|Смену уже|Уже нашли|Не получится|Не получилось|Эту смену|График смен|Этот день|Тебя нет|Выйти могут|Забрать могут|В этот день)[^\n]*$', '') || E'\n\n' || done, 4000),
      'reply_markup', jsonb_build_object('inline_keyboard', kb)));
  end if;
  perform _sa_chat_tg_api('answerCallbackQuery', jsonb_build_object('callback_query_id', cq->>'id', 'text', left(tip, 190)));
  return jsonb_build_object('ok', true, 'act', mm[1], 'msg', m.id, 'done', ok);
end; $$;
-- ── 7) «Рассадка»: посадили гостей — официант в конец очереди ──────────────────────────────────────
-- seat_set этапа 56 слово в слово, плюс очередь в конце
create or replace function seat_set(p_token text, p_tid text, p_status text, p_cnt int, p_name text, p_rtime text, p_waiter text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; pl jsonb; tn text; old sa_seat; r sa_seat; st text; wn text; wid text; chat bigint; busy boolean;
        kept jsonb; touched text[]; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_restaurant'); end if;
  select plan into pl from sa_floor where restaurant = rest;
  select t->>'n' into tn from jsonb_array_elements(coalesce(pl->'tables', '[]'::jsonb)) t where t->>'id' = p_tid;
  if tn is null then return jsonb_build_object('ok', false, 'error', 'no_table'); end if;
  st := coalesce(p_status, '');
  if st not in ('free', 'res', 'seat', 'bill', 'clean') or coalesce(p_cnt, 0) not between 0 and 40
     or length(coalesce(p_name, '')) > 60 or coalesce(p_rtime, '') !~ '^(([01]\d|2[0-3]):[0-5]\d)?$' then
    return jsonb_build_object('ok', false, 'error', 'bad_request');
  end if;
  busy := st in ('seat', 'bill');
  wid := nullif(btrim(coalesce(p_waiter, '')), '');
  if wid is not null then
    begin
      execute 'select btrim(e.name || '' '' || coalesce(e.surname, '''')) from employees e where e.id::text = $1 and e.restaurant = $2 and coalesce(to_jsonb(e)->>''status'', ''active'') = ''active'''
        into wn using wid, rest;
    exception when others then wn := null; end;
    if wn is null then return jsonb_build_object('ok', false, 'error', 'bad_waiter'); end if;
  end if;
  who := coalesce(c->>'who', '');
  ld := (now() at time zone _sa_tz(rest))::date;
  select * into old from sa_seat where restaurant = rest and day = ld and tid = p_tid for update;
  touched := array[p_tid];
  -- v187: приставленному столу ставят статус сам по себе — он отделяется (главный его больше не держит) и считается
  -- свободным: посадили за него — новое время посадки и сообщение официанту
  if old.main is not null then
    update sa_seat set joined = joined - p_tid, updated_at = now() where restaurant = rest and day = ld and tid = old.main;
    touched := touched || old.main;
    old.status := 'free'; old.waiter_id := null; old.since := null;
  end if;
  -- приставленные остаются, пока за столом гости, счёт или бронь; освободили или на уборку — отпускаем
  kept := case when st in ('seat', 'bill', 'res') then coalesce(old.joined, '[]'::jsonb) else '[]'::jsonb end;
  insert into sa_seat (restaurant, day, tid, status, cnt, name, rtime, since, waiter_id, waiter_name, main, joined, updated_by, updated_name, updated_at)
  values (rest, ld, p_tid, st,
    case when busy or st = 'res' then coalesce(p_cnt, 0) else 0 end,
    case when st = 'res' then btrim(coalesce(p_name, '')) else '' end,
    case when st = 'res' then coalesce(p_rtime, '') else '' end,
    case when busy then case when coalesce(old.status, '') in ('seat', 'bill') then old.since else now() end end,
    case when busy then wid end, case when busy then coalesce(wn, '') else '' end,
    null, kept, c->>'id', who, now())
  on conflict (restaurant, day, tid) do update set status = excluded.status, cnt = excluded.cnt, name = excluded.name, rtime = excluded.rtime,
    since = excluded.since, waiter_id = excluded.waiter_id, waiter_name = excluded.waiter_name, main = null, joined = excluded.joined,
    updated_by = excluded.updated_by, updated_name = excluded.updated_name, updated_at = now()
  returning * into r;
  if jsonb_array_length(coalesce(old.joined, '[]'::jsonb)) > 0 then
    touched := touched || array(select jsonb_array_elements_text(old.joined));
    if jsonb_array_length(kept) > 0 then perform _sa_seat_follow(rest, ld, p_tid, c->>'id', who);
    else perform _sa_seat_reset(rest, ld, array(select jsonb_array_elements_text(old.joined)), st, c->>'id', who); end if;
  end if;
  -- официанту — когда ему посадили гостей (новая посадка или стол передали ему); «Счёт» и возврат из него — без сообщения
  if st = 'seat' and wid is not null and wid <> c->>'id' and (coalesce(old.status, '') not in ('seat', 'bill') or old.waiter_id is distinct from wid) and _sa_tg_ready() then
    chat := _sa_tg_chat(wid, 'seat');
    if chat is not null then
      perform sa_tg_send(chat, 'Стол ' || tn || ': посадили ' || r.cnt || ' ' ||
        case when r.cnt % 10 = 1 and r.cnt % 100 <> 11 then 'гостя' else 'гостей' end || '. Посадил(а): ' || coalesce(nullif(who, ''), 'хостес') || '.',
        'Рассадка', 'seat');
    end if;
  end if;
  -- этап 69: посадили гостей официанту — он уходит в конец очереди, как после «Позвать» к столу
  if st = 'seat' and wid is not null and (coalesce(old.status, '') not in ('seat', 'bill') or old.waiter_id is distinct from wid) then
    perform _sa_queue_move(rest, wid, false);
  end if;
  return jsonb_build_object('ok', true, 'table', _sa_seat_json(r), 'tables', _sa_seat_rows(rest, ld, touched));
end; $$;

-- ── 8) Колокольчики на схеме: что с вызовами к столам ───────────────────────────────────────────
-- p_ids — вызовы с телефона хостес за 10 минут. По каждому — последний в цепочке «передали дальше»: msg — его id,
-- st — wait (ждём ответа), going (нажали «Иду»: by — кто, going_at — когда), done («На месте» отметила хостес: by — кто
-- отметил, going_at — когда) или gone (10 минут без ответа, удалён);
-- emp и name — кого зовут сейчас, at — когда позвали, hops — сколько раз передавали. Чужие и не вызовы — пропуск.
create or replace function chat_call_state(p_token text, p_ids bigint[])
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; out jsonb := '[]'::jsonb; i bigint; m sa_chat_msgs; m2 sa_chat_msgs; ch sa_chats; hops int; g jsonb; st text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_ids is null or cardinality(p_ids) > 40 then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  foreach i in array p_ids loop
    m := null;
    select * into m from sa_chat_msgs where id = i;
    if m.id is null or m.kind <> 'call' then continue; end if;
    select * into ch from sa_chats where id = m.chat_id;
    if not _sa_chat_ok(c, ch) then continue; end if;
    hops := 0;
    while m.call ? 'passed' and hops < 8 loop
      m2 := null;
      select * into m2 from sa_chat_msgs where id = case when coalesce(m.call->'passed'->>'msg', '') ~ '^[0-9]{1,18}$' then (m.call->'passed'->>'msg')::bigint end;
      exit when m2.id is null;
      m := m2; hops := hops + 1;
    end loop;
    g := case when jsonb_typeof(m.call->'going') = 'array' and jsonb_array_length(m.call->'going') > 0 then m.call->'going'->0 end;
    if g is null and jsonb_typeof(m.call->'done') = 'object' then g := jsonb_build_object('name', m.call->'done'->>'by_name', 'at', m.call->'done'->>'at'); st := 'done';
    else st := case when g is not null then 'going' when m.deleted or m.created_at < now() - interval '10 minutes' then 'gone' else 'wait' end; end if;
    out := out || jsonb_build_object('id', i, 'msg', m.id, 'st', st, 'who', m.call->>'who', 'emp', m.call->>'emp', 'name', coalesce(m.call->>'to_name', ''),
      'table', coalesce(m.call->>'table', ''), 'at', m.created_at, 'by', g->>'name', 'going_at', g->>'at', 'hops', hops);
  end loop;
  return jsonb_build_object('ok', true, 'list', out);
end; $$;

-- ── 9) «На месте»: официант подошёл, не нажав «Иду» ──────────────────────────────────────────
create or replace function chat_call_done(p_token text, p_msg bigint)
returns jsonb language plpgsql volatile security definer set search_path to public as $$
declare c jsonb; m sa_chat_msgs; ch sa_chats;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into m from sa_chat_msgs where id = p_msg;
  select * into ch from sa_chats where id = m.chat_id;
  if m.id is null or m.kind <> 'call' or m.deleted or not _sa_chat_ok(c, ch) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if m.emp_id <> c->>'id' and not _sa_queue_can(c) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if m.call ? 'passed' then return jsonb_build_object('ok', false, 'error', 'passed', 'msg', _sa_chat_msg_json(m)); end if;
  if not (m.call ? 'done') then
    update sa_chat_msgs set call = call || jsonb_build_object('done', jsonb_build_object('by', c->>'id', 'by_name', coalesce(c->>'who', ''), 'at', now())),
           updated_at = now()
     where id = m.id returning * into m;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

-- ── 10) Права ──────────────────────────────────────────────────────────────────
revoke all on function _sa_queue_day(text), _sa_queue_waiter(text, text), _sa_queue_ord(text), _sa_queue_move(text, text, boolean),
  _sa_queue_next(text, text[]), _sa_queue_can(jsonb), _sa_queue_json(jsonb, text, jsonb), _sa_chat_call_kb(bigint, bigint, boolean),
  _sa_chat_pass_do(jsonb, sa_chat_msgs), _sa_chat_calls(jsonb), _sa_chat_tg_cb(jsonb), _sa_queue_from(text, text) from public, anon, authenticated;
revoke all on function queue_get(text), queue_set(text, jsonb), chat_pass(text, bigint), chat_call(text, text, text, text, text, text), chat_go(text, bigint),
  chat_call_state(text, bigint[]), chat_call_done(text, bigint), seat_set(text, text, text, int, text, text, text) from public;
grant execute on function queue_get(text), queue_set(text, jsonb), chat_pass(text, bigint), chat_call(text, text, text, text, text, text), chat_go(text, bigint),
  chat_call_state(text, bigint[]), chat_call_done(text, bigint), seat_set(text, text, text, int, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'Очередь официантов: sa_queue закрыта, queue_get, queue_set, chat_pass, chat_call_state, chat_call_done, seat_set двигает очередь · очередей сегодня: '
  || (select count(*) from sa_queue where day >= current_date - 1) as result;
