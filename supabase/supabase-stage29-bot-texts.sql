-- ════════════════════════════════════════════════════════════════════════════
-- Этап 29 — тексты бота без «примет нейросети» (v74, Доп. 387)
--
-- Что меняет: только слова в сообщениях бота и подписи кнопок. Логика, расписание, окна отправки,
-- «не чаще раза в день» и права — те же, что в этапах 22б, 25 и 26.
--   • убрана шапка «✦ SERVICE ACADEMY» — от кого сообщение, Telegram и так показывает над чатом;
--   • убраны звёздочки ✦ в конце фраз и на кнопках («Разминка ✦» → «Разминка» и т. п.);
--   • тире «—» в середине фраз заменены точкой, двоеточием или запятой там, где фраза от этого проще.
-- Пример: было «✦ SERVICE ACADEMY / Через час смена: Вечер · 16:00–24:00 / Разминка до смены — 2 минуты,
-- 3 задания из того, что уже прошёл. Хорошей смены ✦», стало «Через час смена: Вечер · 16:00–24:00 /
-- Разминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!»
--
-- Каждую функцию файл меняет, только если она уже есть (соответствующий этап выполнен), — иначе пишет
-- об этом в «Messages» и идёт дальше. Запускать в SQL Editor целиком. Повторный запуск безопасен.
-- В конце — проверка: сколько функций бота ещё со звёздочкой (ожидаем 0).
-- Сами этапы 22б, 25 и 26 в v74 уже с новыми текстами: запустишь какой-то из них заново — звёздочки
-- не вернутся. Этот файл нужен базе, где эти этапы выполнены раньше.
--
-- Отдельно от этого файла: две старые edge-функции — «Вопрос дня» (daily-reminder) и «Завтра смена»
-- (shift-reminder) — пишут свои тексты сами. Новые тексты для них — в supabase/functions/*/index.ts
-- (v74); чтобы они вступили в силу, функции надо развернуть заново: supabase functions deploy
-- daily-reminder и supabase functions deploy shift-reminder (или в панели Supabase: Edge Functions →
-- функция → Code → вставить файл → Deploy).
-- ════════════════════════════════════════════════════════════════════════════

-- ── tg_link (этап 22б) ─────────────────────────────────────────────
do $do$
begin
  if to_regprocedure('public.tg_link(text,text,boolean)') is null then
    raise notice 'tg_link: функции нет (этап 22б не выполнен) — пропускаю';
    return;
  end if;
  execute $fn$
create or replace function tg_link(p_token text, p_init_data text, p_remind boolean default true)
returns json language plpgsql security definer set search_path to public as $$
declare c jsonb; bot text; u jsonb; chat bigint; mins int;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  bot := _sa_tg_token();
  if bot is null then return json_build_object('ok', false, 'error', 'no_bot'); end if;
  u := _sa_tg_check(p_init_data, bot);
  if u is null then return json_build_object('ok', false, 'error', 'bad_init'); end if;
  if u ? 'stale' then return json_build_object('ok', false, 'error', 'stale'); end if;
  chat := (u->>'id')::bigint;
  delete from tg_links where chat_id = chat and emp_id <> c->>'id';   -- общий телефон: чат — у того, кто вошёл
  insert into tg_links (emp_id, chat_id, tg_user, restaurant, full_name, remind, updated_at)
  values (c->>'id', chat, u - 'photo_url', c->>'restaurant', c->>'who', coalesce(p_remind, true), now())
  on conflict (emp_id) do update
     set chat_id = excluded.chat_id, tg_user = excluded.tg_user, restaurant = excluded.restaurant,
         full_name = excluded.full_name, remind = excluded.remind, updated_at = now();
  mins := coalesce((select value::int from sa_settings where key = 'remind_minutes'), 60);
  if coalesce(p_remind, true) then
    perform sa_tg_send(chat, 'Готово! За ' ||
      case when mins = 60 then 'час' else mins || ' мин' end ||
      ' до смены по графику напомню о разминке: 2 минуты, 3 ситуации.' ||
      E'\n\nВыключить можно в «Смена» → «Напоминания в Telegram».', null, null);
  end if;
  return json_build_object('ok', true, 'linked', true, 'remind', coalesce(p_remind, true));
end; $$
$fn$;
  execute 'grant execute on function tg_link(text, text, boolean) to anon, authenticated';
end $do$;

-- ── _sa_warmup_due (этап 22б; с этапом 26 — со строкой «Шаг дня») ─────────────────────────────────────────────
do $do$
begin
  if to_regprocedure('public._sa_warmup_due(boolean)') is null then
    raise notice '_sa_warmup_due: функции нет (этап 22б не выполнен) — пропускаю';
    return;
  end if;
  if exists (select 1 from pg_proc where oid = to_regprocedure('public._sa_warmup_due(boolean)') and prosrc like '%Шаг дня%') then
    execute $fn$
create or replace function _sa_warmup_due(p_send boolean)
returns jsonb language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare tzdef text; mins int; v record; tz text; lnow timestamp; ld date; mkey text; dnum int;
  pl jsonb; days jsonb; shifts jsonb; st jsonb; k text; sh jsonb; start_ts timestamp; target tg_links;
  stoks text[]; note text; txt text; out jsonb := '[]'::jsonb; nmatch int;
  stp jsonb; stxt text;
  def_shifts constant jsonb := '[{"k":"У","name":"Утро","from":10,"to":18},{"k":"Д","name":"День","from":12,"to":20},{"k":"В","name":"Вечер","from":16,"to":24},{"k":"К","name":"Кейтеринг","from":10,"to":22}]';
begin
  tzdef := coalesce((select value from sa_settings where key = 'tz'), 'Asia/Kamchatka');
  mins := coalesce((select value::int from sa_settings where key = 'remind_minutes'), 60);
  for v in select sv.restaurant, sv.venue_key, sv.config from schedule_venues sv
            where exists (select 1 from tg_links l where l.remind and l.restaurant is not distinct from sv.restaurant) loop
    tz := coalesce((select value from sa_settings where key = 'tz:' || v.restaurant), tzdef);
    begin lnow := now() at time zone tz; exception when others then lnow := now() at time zone tzdef; end;
    ld := lnow::date;
    mkey := to_char(ld, 'YYYY-MM');
    dnum := extract(day from ld)::int;
    select m.payload into pl from schedule_months m
     where m.restaurant = v.restaurant and m.venue_key = v.venue_key and m.month = mkey;
    if pl is null then continue; end if;
    days := coalesce(pl->'days', '{}'::jsonb);
    shifts := case when jsonb_typeof(v.config->'shifts') = 'array' and jsonb_array_length(v.config->'shifts') > 0 then v.config->'shifts' else def_shifts end;
    for st in select * from jsonb_array_elements(case when jsonb_typeof(v.config->'staff') = 'array' then v.config->'staff' else '[]'::jsonb end) loop
      if coalesce(st->>'till', '') <> '' and mkey > st->>'till' then continue; end if;   -- закрыт месяцем (как в графике)
      k := pl->'plan'->(st->>'id')->>(dnum::text);
      if k is null or k = '' then continue; end if;
      select x into sh from jsonb_array_elements(shifts) x where x->>'k' = k limit 1;
      if sh is null or coalesce(sh->>'from', '') !~ '^[0-9]+(\.[0-9]+)?$' then continue; end if;
      start_ts := ld + make_interval(mins => round((sh->>'from')::numeric * 60)::int);
      if p_send then
        -- окно отправки: от «за час» до «за час + 15 минут» (расписание — каждые 10 минут)
        if not (lnow >= start_ts - make_interval(mins => mins) and lnow < start_ts - make_interval(mins => mins) + interval '15 minutes'
                and lnow < start_ts) then continue; end if;
      else
        -- просмотр: смены, которые начнутся в ближайшие «час + 10 минут»
        if not (lnow >= start_ts - make_interval(mins => mins + 10) and lnow < start_ts) then continue; end if;
      end if;
      -- кто это в Telegram: то же правило имён, что в приложении (все слова совпали или одно внутри другого, единственный)
      stoks := _sa_name_tokens(st->>'name');
      if coalesce(array_length(stoks, 1), 0) = 0 then continue; end if;
      select count(*) into nmatch from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant and _sa_name_tokens(l.full_name) = stoks;
      if nmatch = 1 then
        select * into target from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant and _sa_name_tokens(l.full_name) = stoks;
      else
        select count(*) into nmatch from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant
           and (_sa_name_tokens(l.full_name) <@ stoks or stoks <@ _sa_name_tokens(l.full_name));
        if nmatch <> 1 then continue; end if;
        select * into target from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant
           and (_sa_name_tokens(l.full_name) <@ stoks or stoks <@ _sa_name_tokens(l.full_name));
      end if;
      note := nullif(btrim(coalesce(days->(dnum::text)->>'note', '')), '');
      txt := 'Через ' || case when mins = 60 then 'час' else mins || ' мин' end ||
             ' смена: ' || coalesce(sh->>'name', 'смена') || ' · ' || _sa_hh((sh->>'from')::numeric) || '–' ||
             _sa_hh(coalesce((sh->>'to')::numeric, 24)) ||
             coalesce(E'\n✎ ' || note, '') ||
             E'\n\nРазминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!';
      -- «Шаг дня» из «Пути мастера» (этап 26): телефон кладёт его в копию — mastery.step = {day, t}.
      -- Только на сегодня по часам заведения, одной строкой, не длиннее 140 знаков.
      select el.data->'mastery'->'step' into stp from emp_learning el where el.emp_id = target.emp_id;
      if jsonb_typeof(stp) = 'object' and stp->>'day' = to_char(ld, 'YYYY-MM-DD') and jsonb_typeof(stp->'t') = 'string' then
        stxt := btrim(regexp_replace(stp->>'t', '[[:space:][:cntrl:]]+', ' ', 'g'));
        if length(stxt) > 140 then stxt := rtrim(left(stxt, 139)) || '…'; end if;
        if stxt <> '' then txt := txt || E'\n\nШаг дня: ' || stxt; end if;
      end if;
      if p_send then
        insert into tg_sent (emp_id, day, kind) values (target.emp_id, ld, 'warmup') on conflict do nothing;
        if not found then continue; end if;   -- уже напоминали сегодня
        perform sa_tg_send(target.chat_id, txt, 'Разминка', 'warmup');
      end if;
      out := out || jsonb_build_object('restaurant', v.restaurant, 'name', st->>'name', 'shift', sh->>'name',
        'starts', to_char(start_ts, 'HH24:MI'), 'local_now', to_char(lnow, 'YYYY-MM-DD HH24:MI'), 'text', txt);
    end loop;
  end loop;
  return out;
end; $$
$fn$;
  else
    execute $fn$
create or replace function _sa_warmup_due(p_send boolean)
returns jsonb language plpgsql security definer set search_path to public, extensions, pg_catalog as $$
declare tzdef text; mins int; v record; tz text; lnow timestamp; ld date; mkey text; dnum int;
  pl jsonb; days jsonb; shifts jsonb; st jsonb; k text; sh jsonb; start_ts timestamp; target tg_links;
  stoks text[]; note text; txt text; out jsonb := '[]'::jsonb; nmatch int;
  def_shifts constant jsonb := '[{"k":"У","name":"Утро","from":10,"to":18},{"k":"Д","name":"День","from":12,"to":20},{"k":"В","name":"Вечер","from":16,"to":24},{"k":"К","name":"Кейтеринг","from":10,"to":22}]';
begin
  tzdef := coalesce((select value from sa_settings where key = 'tz'), 'Asia/Kamchatka');
  mins := coalesce((select value::int from sa_settings where key = 'remind_minutes'), 60);
  for v in select sv.restaurant, sv.venue_key, sv.config from schedule_venues sv
            where exists (select 1 from tg_links l where l.remind and l.restaurant is not distinct from sv.restaurant) loop
    tz := coalesce((select value from sa_settings where key = 'tz:' || v.restaurant), tzdef);
    begin lnow := now() at time zone tz; exception when others then lnow := now() at time zone tzdef; end;
    ld := lnow::date;
    mkey := to_char(ld, 'YYYY-MM');
    dnum := extract(day from ld)::int;
    select m.payload into pl from schedule_months m
     where m.restaurant = v.restaurant and m.venue_key = v.venue_key and m.month = mkey;
    if pl is null then continue; end if;
    days := coalesce(pl->'days', '{}'::jsonb);
    shifts := case when jsonb_typeof(v.config->'shifts') = 'array' and jsonb_array_length(v.config->'shifts') > 0 then v.config->'shifts' else def_shifts end;
    for st in select * from jsonb_array_elements(case when jsonb_typeof(v.config->'staff') = 'array' then v.config->'staff' else '[]'::jsonb end) loop
      if coalesce(st->>'till', '') <> '' and mkey > st->>'till' then continue; end if;   -- закрыт месяцем (как в графике)
      k := pl->'plan'->(st->>'id')->>(dnum::text);
      if k is null or k = '' then continue; end if;
      select x into sh from jsonb_array_elements(shifts) x where x->>'k' = k limit 1;
      if sh is null or coalesce(sh->>'from', '') !~ '^[0-9]+(\.[0-9]+)?$' then continue; end if;
      start_ts := ld + make_interval(mins => round((sh->>'from')::numeric * 60)::int);
      if p_send then
        -- окно отправки: от «за час» до «за час + 15 минут» (расписание — каждые 10 минут)
        if not (lnow >= start_ts - make_interval(mins => mins) and lnow < start_ts - make_interval(mins => mins) + interval '15 minutes'
                and lnow < start_ts) then continue; end if;
      else
        -- просмотр: смены, которые начнутся в ближайшие «час + 10 минут»
        if not (lnow >= start_ts - make_interval(mins => mins + 10) and lnow < start_ts) then continue; end if;
      end if;
      -- кто это в Telegram: то же правило имён, что в приложении (все слова совпали или одно внутри другого, единственный)
      stoks := _sa_name_tokens(st->>'name');
      if coalesce(array_length(stoks, 1), 0) = 0 then continue; end if;
      select count(*) into nmatch from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant and _sa_name_tokens(l.full_name) = stoks;
      if nmatch = 1 then
        select * into target from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant and _sa_name_tokens(l.full_name) = stoks;
      else
        select count(*) into nmatch from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant
           and (_sa_name_tokens(l.full_name) <@ stoks or stoks <@ _sa_name_tokens(l.full_name));
        if nmatch <> 1 then continue; end if;
        select * into target from tg_links l where l.remind and l.restaurant is not distinct from v.restaurant
           and (_sa_name_tokens(l.full_name) <@ stoks or stoks <@ _sa_name_tokens(l.full_name));
      end if;
      note := nullif(btrim(coalesce(days->(dnum::text)->>'note', '')), '');
      txt := 'Через ' || case when mins = 60 then 'час' else mins || ' мин' end ||
             ' смена: ' || coalesce(sh->>'name', 'смена') || ' · ' || _sa_hh((sh->>'from')::numeric) || '–' ||
             _sa_hh(coalesce((sh->>'to')::numeric, 24)) ||
             coalesce(E'\n✎ ' || note, '') ||
             E'\n\nРазминка до смены: 2 минуты, 3 задания из того, что уже прошёл. Хорошей смены!';
      if p_send then
        insert into tg_sent (emp_id, day, kind) values (target.emp_id, ld, 'warmup') on conflict do nothing;
        if not found then continue; end if;   -- уже напоминали сегодня
        perform sa_tg_send(target.chat_id, txt, 'Разминка', 'warmup');
      end if;
      out := out || jsonb_build_object('restaurant', v.restaurant, 'name', st->>'name', 'shift', sh->>'name',
        'starts', to_char(start_ts, 'HH24:MI'), 'local_now', to_char(lnow, 'YYYY-MM-DD HH24:MI'), 'text', txt);
    end loop;
  end loop;
  return out;
end; $$
$fn$;
  end if;
  execute 'revoke all on function _sa_warmup_due(boolean) from public, anon, authenticated';
end $do$;

-- ── _sa_skill_req_notify (этап 22б) ─────────────────────────────────────────────
do $do$
begin
  if to_regprocedure('public._sa_skill_req_notify()') is null then
    raise notice '_sa_skill_req_notify: функции нет (этап 22б не выполнен) — пропускаю';
    return;
  end if;
  execute $fn$
create or replace function _sa_skill_req_notify()
returns trigger language plpgsql security definer set search_path to public as $$
declare l record; lbl text;
begin
  if _sa_tg_token() is null then return new; end if;
  lbl := coalesce(nullif(new.skill_label, ''), new.skill_id);
  if tg_op = 'INSERT' and new.status = 'pending' then
    for l in select tl.chat_id from tg_links tl join employees e on e.id::text = tl.emp_id
              where tl.remind and tl.emp_id <> new.emp_id
                and tl.restaurant is not distinct from new.restaurant
                and lower(coalesce(to_jsonb(e)->>'position', '')) in ('senior', 'manager')
                and coalesce(to_jsonb(e)->>'status', 'active') = 'active' loop
      perform sa_tg_send(l.chat_id, new.emp_name || ' просит подтвердить навык в зале:' ||
        E'\n«' || lbl || '»' || E'\n\nПосмотри, как это получается на смене, и ответь в «Наставничестве».', 'Открыть', 'mentor');
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'declined') then
    for l in select tl.chat_id from tg_links tl where tl.emp_id = new.emp_id and tl.remind loop
      perform sa_tg_send(l.chat_id,
        case when new.status = 'approved'
          then 'Навык подтверждён: «' || lbl || '». ' || coalesce(new.mentor_name, 'Наставник') || ' видел(а) в зале ✓'
          else 'Пока не подтверждено: «' || lbl || '»' || coalesce(E'\n' || coalesce(new.mentor_name, 'Старший') || ': «' || new.note || '»', '') ||
               E'\nПопроси ещё раз, когда будешь готов(а).' end, 'Открыть', 'mentor');
    end loop;
  end if;
  return new;
exception when others then
  return new;   -- уведомление не должно мешать записи
end; $$
$fn$;
  execute 'revoke all on function _sa_skill_req_notify() from public, anon, authenticated';
end $do$;

-- ── quest_call (этап 25) ─────────────────────────────────────────────
do $do$
begin
  if to_regprocedure('public.quest_call(text)') is null then
    raise notice 'quest_call: функции нет (этап 25 не выполнен) — пропускаю';
    return;
  end if;
  execute $fn$
create or replace function quest_call(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; q jsonb; p jsonb; ld date; chat bigint; sent int := 0; no_tg int := 0; already int := 0; who text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if not _sa_tg_ready() then return jsonb_build_object('ok', false, 'error', 'no_bot'); end if;
  q := quest_today(p_token);
  if not coalesce((q->>'ok')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'quest'); end if;
  ld := (q->>'date')::date;
  who := coalesce(nullif(c->>'name', ''), 'Старший смены');
  for p in select * from jsonb_array_elements(q->'people') loop
    if coalesce((p->>'me')::boolean, false) or _sa_num(p->>'steps') > 0 then continue; end if;
    chat := _sa_tg_chat(p->>'id', 'quest');
    if chat is null then no_tg := no_tg + 1; continue; end if;
    if not _sa_tg_once(p->>'id', ld, 'quest_call') then already := already + 1; continue; end if;
    perform sa_tg_send(chat, who || ' зовёт на разминку перед сменой: 2 минуты, 3 задания из того, что ты уже прошёл.' ||
      E'\n\nКвест смены закроем вместе.', 'Разминка', 'warmup');
    sent := sent + 1;
  end loop;
  return jsonb_build_object('ok', true, 'sent', sent, 'no_tg', no_tg, 'already', already);
end; $$
$fn$;
  execute 'grant execute on function quest_call(text) to anon, authenticated';
end $do$;

-- ── pair_nudge (этап 25) ─────────────────────────────────────────────
do $do$
begin
  if to_regprocedure('public.pair_nudge(text)') is null then
    raise notice 'pair_nudge: функции нет (этап 25 не выполнен) — пропускаю';
    return;
  end if;
  execute $fn$
create or replace function pair_nudge(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; me text; r record; partner text; ld date; db jsonb; chat bigint; pname text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  me := c->>'id';
  perform _sa_pairs_tidy();
  select * into r from sa_pairs where status = 'active' and (a = me or b = me) order by id desc limit 1;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'no_pair'); end if;
  partner := case when r.a = me then r.b else r.a end;
  if not _sa_tg_ready() then return jsonb_build_object('ok', false, 'error', 'no_bot'); end if;
  ld := (now() at time zone _sa_tz(c->>'restaurant'))::date;
  select data into db from emp_learning where emp_id = partner;
  if _sa_day_mark(coalesce(db, '{}'::jsonb), to_char(ld, 'YYYY-MM-DD'), null) = 2 then return jsonb_build_object('ok', false, 'error', 'done'); end if;
  chat := _sa_tg_chat(partner, 'pair');
  if chat is null then return jsonb_build_object('ok', false, 'error', 'no_tg'); end if;
  if not _sa_tg_once(partner, ld, 'pair_nudge') then return jsonb_build_object('ok', false, 'error', 'already'); end if;
  pname := coalesce(nullif(c->>'name', ''), 'Напарник');
  perform sa_tg_send(chat, pname || ' зовёт: свеча на двоих ждёт твой шаг сегодня. Хватит одной разминки на 2 минуты.', 'Мой шаг', 'pair');
  return jsonb_build_object('ok', true, 'sent', true);
end; $$
$fn$;
  execute 'grant execute on function pair_nudge(text) to anon, authenticated';
end $do$;

-- ── _sa_nudges_at (этап 25) ─────────────────────────────────────────────
do $do$
begin
  if to_regprocedure('public._sa_nudges_at(boolean,timestamp with time zone)') is null then
    raise notice '_sa_nudges_at: функции нет (этап 25 не выполнен) — пропускаю';
    return;
  end if;
  execute $fn$
create or replace function _sa_nudges_at(p_send boolean, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path to public as $$
declare out jsonb := '[]'::jsonb; e record; tz text; lnow timestamp; ld date; hr int; dow int; chat bigint;
  pr record; x text; y text; dx jsonb; dy jsonb; sx jsonb; sy jsonb; ynm text; txt text;
  pws date; me record; cupw text; nf int; nowms numeric; m0 date; m1 date; adays int; asteps int; wk date;
begin
  if not _sa_tg_ready() then return out; end if;
  if p_send then perform _sa_pairs_tidy(); end if;
  -- (а) свеча на двоих: вечером (18–21 по часам заведения), если напарник уже занимался, а ты — нет
  for pr in select p.id, p.a, p.b from sa_pairs p where p.status = 'active' loop
    foreach x in array array[pr.a, pr.b] loop
      y := case when x = pr.a then pr.b else pr.a end;
      select em.restaurant into e from employees em where em.id::text = x;
      tz := _sa_tz(e.restaurant);
      lnow := p_now at time zone tz; ld := lnow::date; hr := extract(hour from lnow)::int;
      if hr < 18 or hr >= 21 then continue; end if;
      chat := _sa_tg_chat(x, 'pair');
      if chat is null or _sa_tg_was(x, ld, 'pair_eve') then continue; end if;
      select data into dx from emp_learning where emp_id = x;
      select data into dy from emp_learning where emp_id = y;
      sx := _sa_emp_sched(x, ld, ld); sy := _sa_emp_sched(y, ld, ld);
      if _sa_day_mark(coalesce(dx, '{}'::jsonb), to_char(ld, 'YYYY-MM-DD'), sx) <> 0 then continue; end if;   -- уже занимался или выходной
      if _sa_day_mark(coalesce(dy, '{}'::jsonb), to_char(ld, 'YYYY-MM-DD'), sy) <> 2 then continue; end if;   -- напарник ещё не занимался
      select coalesce(nullif(em.name, ''), 'Напарник') into ynm from employees em where em.id::text = y;
      txt := ynm || case when _sa_fem(ynm) then ' уже сделала' else ' уже сделал' end ||
             ' свою часть, свеча на двоих ждёт тебя. Хватит одной разминки.';
      if p_send then
        if not _sa_tg_once(x, ld, 'pair_eve') then continue; end if;
        perform sa_tg_send(chat, txt, 'Мой шаг', 'pair');
      end if;
      out := out || jsonb_build_object('kind', 'pair', 'emp', x, 'text', txt);
    end loop;
  end loop;
  -- (б) итоги недели — в понедельник с 10 до 21; (в) выдыхающиеся темы — в четверг с 12 до 20;
  -- (г) итоги месяца — 1-го числа с 12 до 20
  for e in select tl.emp_id, em.name, em.restaurant from tg_links tl join employees em on em.id::text = tl.emp_id
            where tl.remind and coalesce(em.status, 'active') = 'active' loop
    tz := _sa_tz(e.restaurant);
    lnow := p_now at time zone tz; ld := lnow::date; hr := extract(hour from lnow)::int; dow := extract(isodow from ld)::int;
    wk := ld - (dow - 1);
    if dow = 1 and hr >= 10 and hr < 21 and _sa_tg_chat(e.emp_id, 'league') is not null and not _sa_tg_was(e.emp_id, wk - 7, 'league_week') then
      pws := wk - 7;
      -- подвести неделю — только при настоящей отправке (просмотр ничего не пишет, ревью v31)
      if p_send and _sa_week_closed(pws) then perform _sa_league_fill(pws, tz); end if;
      select lw.pts, lw.rank_rest, lw.rank_net,
             (select count(*) from sa_league_weeks z where z.week_start = pws and z.restaurant is not distinct from lw.restaurant) as n_rest,
             (select count(*) from sa_league_weeks z where z.week_start = pws) as n_net
        into me from sa_league_weeks lw where lw.week_start = pws and lw.emp_id = e.emp_id;
      select restaurant into cupw from sa_cup_weeks where week_start = pws and rank = 1 order by avg desc, restaurant limit 1;
      if me.pts is not null and me.pts > 0 then
        txt := 'Итоги недели в лиге: ' || me.rank_rest || '-е место в заведении (из ' || me.n_rest || ')' ||
               case when me.n_net > me.n_rest then ' и ' || me.rank_net || '-е в сети' else '' end || ', ' || me.pts || ' ' || _sa_plural(me.pts, 'очко', 'очка', 'очков') || '.' ||
               case when cupw is not null then E'\nКубок заведений у «' || cupw || '».' else '' end ||
               E'\n\nНовая неделя: все снова с нуля.';
        if p_send then
          if _sa_tg_once(e.emp_id, pws, 'league_week') then perform sa_tg_send(_sa_tg_chat(e.emp_id, 'league'), txt, 'Лига недели', 'league'); else txt := null; end if;
        end if;
        if txt is not null then out := out || jsonb_build_object('kind', 'league', 'emp', e.emp_id, 'text', txt); end if;
      end if;
    end if;
    if dow = 4 and hr >= 12 and hr < 20 and _sa_tg_chat(e.emp_id, 'fresh') is not null and not _sa_tg_was(e.emp_id, wk, 'fresh_week') then
      nowms := extract(epoch from p_now) * 1000;
      select count(*) into nf
        from emp_learning el, jsonb_each(case when jsonb_typeof(el.data->'fresh') = 'object' then el.data->'fresh' else '{}'::jsonb end) f
       where el.emp_id = e.emp_id and jsonb_typeof(f.value) = 'object'
         and (f.value->>'t') ~ '^[0-9]{10,15}(\.[0-9]+)?$'
         and nowms - (f.value->>'t')::numeric >= (array[3, 7, 14, 30, 60])[least(5, _sa_num(f.value->>'n')::int + 1)] * 86400000::numeric;
      if nf >= 3 then
        -- без точного числа: сервер видит свежесть всех треков, а «Погреб тем» — текущего (ревью v31)
        txt := 'Несколько тем начали выдыхаться' ||
               '. Освежить их можно разом за 3 минуты: «Погреб тем» → «Освежить всё».';
        if p_send then
          if _sa_tg_once(e.emp_id, wk, 'fresh_week') then perform sa_tg_send(_sa_tg_chat(e.emp_id, 'fresh'), txt, 'Освежить', 'cellar'); else txt := null; end if;
        end if;
        if txt is not null then out := out || jsonb_build_object('kind', 'fresh', 'emp', e.emp_id, 'text', txt); end if;
      end if;
    end if;
    if extract(day from ld)::int = 1 and hr >= 12 and hr < 20 and _sa_tg_chat(e.emp_id, 'month') is not null and not _sa_tg_was(e.emp_id, ld, 'month') then
      m1 := ld - 1; m0 := date_trunc('month', m1)::date;
      -- день в деле — как в приложении: шаги, исправленные ошибки, ситуации или день серии
      select count(*) filter (where _sa_num(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')->>'st') + _sa_num(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')->>'f')
                                    + _sa_num(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')->>'s') > 0
                                 or (jsonb_typeof(el.data->'streak'->'days') = 'array' and (el.data->'streak'->'days') ? to_char(g, 'YYYY-MM-DD')))::int,
             coalesce(sum(_sa_num(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')->>'st')), 0)::int
        into adays, asteps
        from emp_learning el cross join generate_series(m0::timestamp, m1::timestamp, interval '1 day') g
       where el.emp_id = e.emp_id;
      if coalesce(adays, 0) > 0 then
        txt := 'Итоги ' || _sa_month_gen(extract(month from m0)::int) || ' готовы: ' ||
               adays || ' ' || _sa_plural(adays, 'день', 'дня', 'дней') || ' в деле, ' || asteps || ' ' || _sa_plural(asteps, 'шаг', 'шага', 'шагов') || ' обучения.' ||
               E'\n\nКарточки лежат в «Я» → «Итоги месяца».';
        if p_send then
          if _sa_tg_once(e.emp_id, ld, 'month') then perform sa_tg_send(_sa_tg_chat(e.emp_id, 'month'), txt, 'Итоги месяца', 'month'); else txt := null; end if;
        end if;
        if txt is not null then out := out || jsonb_build_object('kind', 'month', 'emp', e.emp_id, 'text', txt); end if;
      end if;
    end if;
  end loop;
  return out;
end; $$
$fn$;
  execute 'revoke all on function _sa_nudges_at(boolean, timestamptz) from public, anon, authenticated';
end $do$;

-- ── mastery_claim (этап 26) ─────────────────────────────────────────────
do $do$
begin
  if to_regprocedure('public.mastery_claim(text,text,integer,integer)') is null then
    raise notice 'mastery_claim: функции нет (этап 26 не выполнен) — пропускаю';
    return;
  end if;
  execute $fn$
create or replace function mastery_claim(p_token text, p_role text, p_have int, p_need int)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; r text; title text; n int; rest text; ld date; nm text; txt text; e record; chat bigint; sent int := 0;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  r := lower(btrim(coalesce(p_role, '')));
  title := _sa_role_title(r);
  if title is null then return jsonb_build_object('ok', false, 'error', 'role'); end if;
  if p_have is null or p_need is null or p_need <= 0 then return jsonb_build_object('ok', false, 'error', 'bad'); end if;
  if p_have < p_need then return jsonb_build_object('ok', false, 'error', 'not_yet'); end if;
  rest := case when coalesce(btrim(c->>'restaurant'), '') <> '' then c->>'restaurant' end;   -- без заведения писать некому
  -- запись одна на человека и роль; после сброса прогресса (player_resets новее записи) — заново,
  -- с новой датой и сообщением команде
  insert into sa_masters (emp_id, role, restaurant, have, need)
  values (c->>'id', r, c->>'restaurant', p_have, p_need)
  on conflict (emp_id, role) do update set at = now(), restaurant = excluded.restaurant, have = excluded.have, need = excluded.need
    where exists (select 1 from player_resets pr
                   where pr.employee = btrim(coalesce(c->>'name', '') || ' ' || coalesce(c->>'surname', ''))
                     and (pr.restaurant is null or pr.restaurant = c->>'restaurant')
                     and pr.reset_at > sa_masters.at);
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', true, 'new', false, 'sent', 0); end if;
  if rest is not null and _sa_tg_ready() then
    ld := (now() at time zone _sa_tz(rest))::date;
    nm := nullif(btrim(coalesce(c->>'name', '')), '');
    txt := coalesce(nm, 'Коллега') ||
           case when nm is null then ' стал(а)' when _sa_fem(nm) then ' стала' else ' стал' end ||
           ' мастером роли «' || title || '».' ||
           E'\n\nЗагляни в «Путь мастера»: сколько осталось тебе?';
    for e in select em.id::text as id from employees em
              where em.restaurant = rest and coalesce(em.status, 'active') = 'active' and em.id::text <> c->>'id'
              order by em.name, em.surname, em.id loop
      chat := _sa_tg_chat(e.id, 'master');
      if chat is null then continue; end if;
      if not _sa_tg_once(e.id, ld, 'master') then continue; end if;   -- сегодня уже писали о мастере
      perform sa_tg_send(chat, txt, 'Путь мастера', 'mastery');
      sent := sent + 1;
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'new', true, 'sent', sent);
end; $$
$fn$;
  execute 'grant execute on function mastery_claim(text, text, int, int) to anon, authenticated';
end $do$;

notify pgrst, 'reload schema';

-- ── Проверка: ожидаем «функций бота со звёздочкой: 0 из 7 (есть 7)» — или меньше «есть», если какие-то этапы не выполнены
select 'функций бота со звёздочкой: ' || count(*) filter (where p.prosrc like '%✦%' or p.prosrc like '%SERVICE ACADEMY%')
       || ' из 7 (есть ' || count(*) || ')' as "проверка этапа 29"
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('tg_link', '_sa_warmup_due', '_sa_skill_req_notify', 'quest_call', 'pair_nudge', '_sa_nudges_at', 'mastery_claim');
