-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 68 (Доп. 538): «Позвать» подряд — без «подожди минуту»
--
-- Владелец: «Бывает такое, что приходит несколько столов подряд, и хостес должен всех оповестить, а
-- приложение не дает это сделать сразу, просит подождать минуту».
--
-- Что делает: пересоздаёт chat_call (этап 38) с другим ограничением.
--   Было: после любого вызова 30 секунд нельзя было позвать никого ('too_fast').
--   Стало:
--     • тот же вызов второй раз за 30 секунд не уходит: тот же, кого зовут (должность или человек), та же
--       причина, тот же стол или свой текст. Ответ { ok: false, error: 'already', msg: прошлый вызов },
--       приложение пишет «Анну к столу 7 уже позвали, ждём ответа» (или «Анна уже идёт», если ответили);
--     • другой вызов уходит сразу: к другому столу, другому человеку, с другой причиной;
--     • от лавины нажатий — не больше 15 вызовов за 5 минут от одного человека: дальше 'too_many' и wait —
--       через сколько секунд можно снова.
--   Остальное как в этапе 38: проверки, сообщение в «Вся команда», Telegram с кнопкой «Иду».
--
-- Нужен этап 38 (чат смены). Безвреден повторно.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- Страховка: без этапа 38 нет чата, вызовов и сообщений
do $$
begin
  if to_regclass('public.sa_chat_msgs') is null
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = '_sa_chat_msg_json') then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нет чата смены';
  end if;
end $$;

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
  -- v212: тот же вызов за 30 секунд второй раз не уходит (кого, зачем, стол, свой текст — те же)
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
          ': ' || _sa_chat_call_why(call), jsonb_build_array(jsonb_build_array(jsonb_build_object('text', 'Иду', 'callback_data', 'cg:' || m.id)),
          jsonb_build_array(_sa_chat_tg_open(ch.id, m.id))));
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'msg', _sa_chat_msg_json(m));
end; $$;

revoke all on function chat_call(text, text, text, text, text, text) from public;
grant execute on function chat_call(text, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'Позвать подряд: тот же вызов — раз в 30 секунд, всего — 15 за 5 минут · вызовов за сутки: '
  || (select count(*) from sa_chat_msgs where kind = 'call' and created_at > now() - interval '1 day') as result;
