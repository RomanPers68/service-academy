-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 40 (v106, Доп. 419): «Утро руководителя».
--
--   • каждое утро бот присылает руководителю (менеджер, старший, владелец) сводку заведения на сегодня: кто в смене
--     и когда, где на неделе не хватает людей и какие смены ищут замену, стоп-лист, вчерашние «спасибо» гостей,
--     прочтения брифинга и занятия, кто давно не занимался, собран ли брифинг на сегодня. Кнопки: «Открыть утро»,
--     «Собрать брифинг» (если не собран), «График» (если где-то не хватает людей);
--   • время у каждого своё, с 7 до 12 по часам заведения (сначала 9:00), выключается в приложении: «Смена» → «Утро
--     руководителя»; приходит тем, кто подключил Telegram («Смена» → «Напоминания в Telegram»);
--   • morning_brief(p_token) — та же сводка для экрана «Утро» (только руководителям); morning_set(p_token, p_on,
--     p_hour) — присылать ли и во сколько; morning_send_now(p_token) — прислать сейчас, посмотреть, как выглядит (не
--     чаще раза в минуту); morning_nudge(p_token, p_emp) — «Напомнить» тому, кто давно не занимался: бот пишет ему
--     коротко, с кнопкой «Разминка» (одно напоминание в день на человека);
--   • расписание pg_cron «sa-morning» — раз в 10 минут. Проверка без отправки: select sa_morning_preview(); — кому и что
--     ушло бы прямо сейчас.
--
-- Где не хватает людей — как «Требует внимания» в графике (ui/schedule.jsx): потребность дня по уровню (обычный,
-- высокий, пиковый: пометка дня, праздник, дни недели из настроек) против тех, кто стоит в смене; дни, где в графике
-- ещё никого нет (месяц не составлен), не считаются.
--
-- Нужны этапы 21, 22б, 24, 25, 31 и 38 (вход, Telegram, график, чат). Брифинг (32, 36), «спасибо» гостей (34) и
-- опоздания (39) — по желанию: без них этих строк в сводке просто нет. Ничего не удаляет. Можно запускать повторно.
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
  if to_regprocedure('public._sa_sh_cfg(text)') is null or to_regprocedure('public._sa_chat_tg_btn(text,text)') is null then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужны график и кнопки бота из чата';
  end if;
end $$;

-- ── 1) Присылать ли и во сколько (у каждого руководителя своё) ─────────────────────
alter table sa_notify_prefs add column if not exists morning boolean not null default true;
alter table sa_notify_prefs add column if not exists morning_hour smallint not null default 9;

-- ── 2) Слова ─────────────────────────────────────────────────────────────────────
-- должности графика по порядку (ui/schedule.jsx, POS)
create or replace function _sa_mo_pos()
returns text[] language sql immutable as $$ select array['manager', 'host', 'call', 'bar', 'barback', 'waiter', 'runner'] $$;

-- «a», «a и b», «a, b и c»
create or replace function _sa_mo_and(p text[])
returns text language sql immutable as $$
  select case when coalesce(array_length(p, 1), 0) <= 1 then coalesce(p[1], '')
    else array_to_string(p[1:array_length(p, 1) - 1], ', ') || ' и ' || p[array_length(p, 1)] end
$$;

-- текст для Telegram (parse_mode HTML)
create or replace function _sa_mo_esc(p text)
returns text language sql immutable as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

-- сотрудник коротко: «Анна С.»
create or replace function _sa_mo_nm(p_emp text)
returns text language sql stable security definer set search_path to public as $$
  select nullif(_sa_chat_nm(btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, ''))), '') from employees e where e.id::text = p_emp limit 1
$$;

-- строка графика → сотрудник: слова имени совпали; иначе единственный похожий (как _sa_on_shift)
create or replace function _sa_mo_emp(p_rest text, p_name text)
returns text language plpgsql stable security definer set search_path to public as $$
declare stoks text[] := _sa_name_tokens(p_name); nmatch int; hit text;
begin
  if coalesce(array_length(stoks, 1), 0) = 0 then return null; end if;
  select count(*), min(em.id::text) into nmatch, hit from employees em
   where em.restaurant is not distinct from p_rest and coalesce(em.status, 'active') = 'active'
     and _sa_name_tokens(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) = stoks;
  if nmatch = 1 then return hit; end if;
  select count(*), min(em.id::text) into nmatch, hit from employees em
   where em.restaurant is not distinct from p_rest and coalesce(em.status, 'active') = 'active'
     and (_sa_name_tokens(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) <@ stoks
          or stoks <@ _sa_name_tokens(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')));
  return case when nmatch = 1 then hit end;
end; $$;

-- ── 3) График: настройки с умолчаниями, уровень дня, где не хватает людей ─────────────
-- как mergeCfg в ui/schedule.jsx: правила и потребность — поверх умолчаний по ключам
create or replace function _sa_mo_cfg(p_rest text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v jsonb := _sa_sh_cfg(p_rest);
begin
  if v is null then return null; end if;
  return v || jsonb_build_object(
    'rules', '{"peakDows":[4,5],"highDows":[3,6],"holidayPeak":true}'::jsonb || case when jsonb_typeof(v->'rules') = 'object' then v->'rules' else '{}'::jsonb end,
    'need', '{"1":{"manager":1,"host":1,"call":1,"bar":1,"barback":1,"waiter":6,"runner":1},"2":{"manager":1,"host":1,"call":1,"bar":1,"barback":1,"waiter":6,"runner":2},"3":{"manager":1,"host":1,"call":1,"bar":2,"barback":1,"waiter":6,"runner":2}}'::jsonb
      || case when jsonb_typeof(v->'need') = 'object' then v->'need' else '{}'::jsonb end);
end; $$;

-- уровень дня: 1 — обычный, 2 — высокий, 3 — пиковый (lvlOf в ui/schedule.jsx). Дни недели — с понедельника (0) по
-- воскресенье (6); праздники — федеральные с фиксированной датой, как HOLIDAYS там же.
create or replace function _sa_mo_lvl(p_cfg jsonb, p_days jsonb, p_day date)
returns int language plpgsql immutable as $$
declare r jsonb := p_cfg->'rules'; lv int; l2 boolean := false; p text; a numeric; b numeric; c numeric;
  o jsonb := case when jsonb_typeof(p_days) = 'object' then p_days->(extract(day from p_day)::int::text) end;
  w int := extract(isodow from p_day)::int - 1; ol numeric;
begin
  if r->>'levels' in ('2', '3') then lv := (r->>'levels')::int;
  else
    foreach p in array _sa_mo_pos() loop
      a := _sa_num(p_cfg->'need'->'1'->>p); b := _sa_num(p_cfg->'need'->'2'->>p); c := _sa_num(p_cfg->'need'->'3'->>p);
      if b <> a and b <> c then l2 := true; end if;
    end loop;
    lv := case when l2 then 3 else 2 end;
  end if;
  ol := case when jsonb_typeof(o) = 'object' then _sa_num(o->>'lvl') else 0 end;
  if ol in (1, 2, 3) then return case when ol = 2 and lv = 2 then 3 else ol::int end; end if;
  if to_char(p_day, 'MM-DD') = any (array['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04'])
     and coalesce(r->>'holidayPeak', 'false') = 'true' then return 3; end if;
  if jsonb_typeof(r->'peakDows') = 'array' and (r->'peakDows') @> to_jsonb(w) then return 3; end if;
  if lv = 3 and jsonb_typeof(r->'highDows') = 'array' and (r->'highDows') @> to_jsonb(w) then return 2; end if;
  return 1;
end; $$;

-- где в день p_day не хватает людей: [{pos, miss}] по порядку должностей. Месяц не составлен или в этот день в графике
-- никого — пусто (это не дыра, а незаполненный лист). Дополнительные смены (кейтеринг) не в счёт — как в таблице.
create or replace function _sa_mo_holes(p_rest text, p_cfg jsonb, p_day date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare mk text := to_char(p_day, 'YYYY-MM'); dn text := extract(day from p_day)::int::text; pl jsonb; need jsonb; p text; n int; have int;
  out jsonb := '[]'::jsonb; staff jsonb := case when jsonb_typeof(p_cfg->'staff') = 'array' then p_cfg->'staff' else '[]'::jsonb end;
begin
  if p_cfg is null then return out; end if;
  select m.payload into pl from schedule_months m where m.restaurant = p_rest and m.venue_key = 'main' and m.month = mk;
  if pl is null or jsonb_typeof(pl->'plan') is distinct from 'object' then return out; end if;
  if not exists (select 1 from jsonb_each(pl->'plan') e where jsonb_typeof(e.value) = 'object' and coalesce(e.value->>dn, '') <> '') then return out; end if;
  need := p_cfg->'need'->(_sa_mo_lvl(p_cfg, pl->'days', p_day)::text);
  if jsonb_typeof(need) is distinct from 'object' then return out; end if;
  foreach p in array _sa_mo_pos() loop
    n := _sa_num(need->>p)::int;
    if n <= 0 then continue; end if;
    select count(*) into have from jsonb_array_elements(staff) s
     where jsonb_typeof(s) = 'object' and s->>'pos' = p
       and (coalesce(s->>'till', '') = '' or mk <= s->>'till') and (coalesce(s->>'since', '') = '' or mk >= s->>'since')
       and exists (select 1 from jsonb_array_elements(_sa_sh_defs(p_cfg)) x
                    where jsonb_typeof(x) = 'object' and x->>'k' = pl->'plan'->(s->>'id')->>dn and coalesce(x->>'extra', '') in ('', '0', 'false'));
    if have < n then out := out || jsonb_build_object('pos', p, 'miss', n - have); end if;
  end loop;
  return out;
end; $$;

-- дата из ключа журнала «ГГГГ-ММ-ДД»; «2026-09-31» и прочий мусор с телефона — null, а не ошибка
create or replace function _sa_mo_date(p text)
returns date language plpgsql immutable as $$
begin
  if coalesce(p, '') !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p::date;
exception when others then return null;
end; $$;

-- последний день, когда человек занимался (как _sa_day_mark: журнал дня или серия), null — ни разу
create or replace function _sa_mo_last(d jsonb)
returns date language sql immutable as $$
  select max(x) from (
    select _sa_mo_date(k) as x from jsonb_object_keys(_sa_act(coalesce(d, '{}'::jsonb))) k
     where _sa_day_mark(d, k, null::jsonb) = 2
    union all
    select _sa_mo_date(v #>> '{}') from jsonb_array_elements(case when jsonb_typeof(d->'streak'->'days') = 'array' then d->'streak'->'days' else '[]'::jsonb end) v
  ) s
$$;

-- ── 4) Сводка: заведение руководителя p_emp на «сейчас» p_now (в жизни — now()) ──────────
create or replace function _sa_morning_at(p_emp text, p_now timestamptz)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare rest text; tz text; ld date; cfg jsonb; mk text; dn text; pl jsonb; sh jsonb; st jsonb; eid text; ppl jsonb;
  shifts jsonb := '[]'::jsonb; cnt int := 0; holes jsonb := '[]'::jsonb; h jsonb; i int; open jsonb := '[]'::jsonb;
  stop jsonb := jsonb_build_object('n', 0, 'names', '[]'::jsonb); th jsonb; tn int; tp jsonb; tq text; tqe text; ybrief jsonb; learn jsonb;
  yon text[]; ldone int; idle jsonb := jsonb_build_object('list', '[]'::jsonb, 'more', 0); brief jsonb := jsonb_build_object('done', false);
  late jsonb := '[]'::jsonb; latej jsonb := '{}'::jsonb; week text[] := '{}'; staff jsonb; n int; bat timestamptz;
begin
  select e.restaurant into rest from employees e where e.id::text = p_emp;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  tz := _sa_tz(rest);
  ld := (p_now at time zone tz)::date;
  -- опоздания сегодня (этап 39)
  if to_regclass('public.sa_late') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'', l.emp_id, ''n'', _sa_chat_nm(l.emp_name), ''min'', l.min, ''eta'', coalesce(l.eta, '''')) order by l.at), ''[]''::jsonb),
                    coalesce(jsonb_object_agg(l.emp_id, jsonb_build_object(''min'', l.min, ''eta'', coalesce(l.eta, ''''))), ''{}''::jsonb)
               from sa_late l where l.restaurant = $1 and l.day = $2' into late, latej using rest, ld;
  end if;
  -- кто сегодня в смене и где на неделе не хватает людей
  cfg := _sa_mo_cfg(rest);
  if cfg is not null then
    mk := to_char(ld, 'YYYY-MM'); dn := extract(day from ld)::int::text;
    staff := case when jsonb_typeof(cfg->'staff') = 'array' then cfg->'staff' else '[]'::jsonb end;
    select m.payload into pl from schedule_months m where m.restaurant = rest and m.venue_key = 'main' and m.month = mk;
    for sh in select x from jsonb_array_elements(_sa_sh_defs(cfg)) x where jsonb_typeof(x) = 'object' order by _sa_num(x->>'from'), x->>'k' loop
      ppl := '[]'::jsonb;
      if pl is not null then
        for st in select s from jsonb_array_elements(staff) s
                   where jsonb_typeof(s) = 'object' and pl->'plan'->(s->>'id')->>dn = sh->>'k'
                     and (coalesce(s->>'till', '') = '' or mk <= s->>'till') and (coalesce(s->>'since', '') = '' or mk >= s->>'since')
                   order by coalesce(array_position(_sa_mo_pos(), s->>'pos'), 99), s->>'name' loop
          eid := _sa_mo_emp(rest, st->>'name');
          ppl := ppl || jsonb_build_object('id', eid, 'n', coalesce(_sa_mo_nm(eid), _sa_chat_nm(st->>'name')), 'late', case when eid is not null then latej->eid end);
        end loop;
      end if;
      if jsonb_array_length(ppl) > 0 then
        shifts := shifts || jsonb_build_object('k', sh->>'k', 'name', coalesce(sh->>'name', sh->>'k'), 'from', _sa_num(sh->>'from'), 'to', _sa_num(sh->>'to'), 'people', ppl);
        cnt := cnt + jsonb_array_length(ppl);
      end if;
    end loop;
    for i in 0..6 loop
      for h in select x from jsonb_array_elements(_sa_mo_holes(rest, cfg, ld + i)) x loop
        holes := holes || (h || jsonb_build_object('day', to_char(ld + i, 'YYYY-MM-DD')));
      end loop;
    end loop;
  end if;
  -- карточки смен в чате, которые ещё ищут человека (этап 38): отдаю, поменяюсь, «Ищем в смену» — сегодня и неделя
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'chat', m.chat_id, 'mode', m.card->>'mode', 'day', m.card->>'date',
           'who', _sa_chat_nm(m.card->>'fromName'), 'pos', coalesce(m.card->>'posKey', ''),
           'n', greatest(1, _sa_num(m.card->>'n')::int - coalesce(jsonb_array_length(case when jsonb_typeof(m.card->'took') = 'array' then m.card->'took' end), 0)))
         order by m.card->>'date', m.id), '[]'::jsonb) into open
    from sa_chat_msgs m join sa_chats c on c.id = m.chat_id
   where c.restaurant = rest and m.kind = 'card' and not m.deleted and m.card->>'t' = 'shift' and m.card->>'st' = 'open'
     and m.card->>'mode' in ('give', 'swap', 'need') and m.card->>'date' between to_char(ld, 'YYYY-MM-DD') and to_char(ld + 6, 'YYYY-MM-DD');
  -- стоп-лист (меню команды, этап 4)
  if to_regclass('public.restaurant_menu') is not null then
    select jsonb_build_object('n', count(*), 'names', coalesce(jsonb_agg(x.nm order by x.nm) filter (where x.rn <= 8), '[]'::jsonb)) into stop
      from (select btrim(d->>'name') as nm, row_number() over (order by btrim(d->>'name')) rn
              from restaurant_menu rm, jsonb_array_elements(case when jsonb_typeof(rm.dishes) = 'array' then rm.dishes else '[]'::jsonb end) d
             where rm.restaurant = rest and jsonb_typeof(d) = 'object' and jsonb_typeof(d->'stop') = 'object'
               and coalesce(d->>'archived', '') not in ('true', '1') and coalesce(btrim(d->>'name'), '') <> '') x;
  end if;
  -- вчера: «спасибо» гостей (этап 34)
  if to_regclass('public.sa_guest_thanks') is not null then
    execute 'select count(*) from sa_guest_thanks g where g.restaurant = $1 and not g.hidden and (g.created_at at time zone $2)::date = $3' into tn using rest, tz, ld - 1;
    if tn > 0 then
      execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'', x.emp_id, ''n'', x.n, ''k'', x.k) order by x.k desc, x.n), ''[]''::jsonb)
                 from (select g.emp_id, _sa_mo_nm(g.emp_id) as n, count(*)::int as k from sa_guest_thanks g
                        where g.restaurant = $1 and not g.hidden and (g.created_at at time zone $2)::date = $3 group by g.emp_id) x where x.n is not null'
        into tp using rest, tz, ld - 1;
      execute 'select regexp_replace(btrim(g.text), ''\s+'', '' '', ''g''), g.emp_id from sa_guest_thanks g
                where g.restaurant = $1 and not g.hidden and (g.created_at at time zone $2)::date = $3 and length(btrim(g.text)) >= 12
                order by length(btrim(g.text)) <= 160 desc, length(btrim(g.text)) desc, g.created_at desc limit 1' into tq, tqe using rest, tz, ld - 1;
      th := jsonb_build_object('n', tn, 'people', tp, 'quote', case when tq is null then '' when length(tq) > 160 then left(tq, 159) || '…' else tq end,
        'by', coalesce(_sa_mo_nm(tqe), ''));
    end if;
  end if;
  -- вчера: брифинг прочитали (этапы 32 и 36) и занимались — из тех, кто был в смене
  yon := coalesce(_sa_on_shift(rest, ld - 1), '{}');
  if to_regclass('public.sa_briefs') is not null and to_regclass('public.sa_brief_reads') is not null then
    execute 'select count(*) from sa_brief_reads r where r.restaurant = $1 and r.day = $2 and (cardinality($3) = 0 or r.emp_id = any ($3))
               and exists (select 1 from sa_briefs b where b.restaurant = $1 and b.day = $2)' into n using rest, ld - 1, yon;
    if n > 0 then ybrief := jsonb_build_object('reads', n, 'of', coalesce(array_length(yon, 1), 0)); end if;
    execute 'select b.updated_at from sa_briefs b where b.restaurant = $1 and b.day = $2' into bat using rest, ld;
    if bat is not null then brief := jsonb_build_object('done', true, 'at', to_char(bat at time zone tz, 'HH24:MI')); end if;
  end if;
  if coalesce(array_length(yon, 1), 0) > 0 and to_regclass('public.emp_learning') is not null then
    select count(*) into ldone from unnest(yon) x join emp_learning l on l.emp_id = x
     where _sa_day_mark(l.data, to_char(ld - 1, 'YYYY-MM-DD'), null::jsonb) = 2;
    learn := jsonb_build_object('done', ldone, 'of', array_length(yon, 1));
  end if;
  -- давно не занимались: у кого на этой неделе смены (сегодня и шесть дней вперёд), без руководителей; шесть дней и
  -- больше без единого занятия, «ни разу» — первыми, дальше — кто дольше
  if to_regclass('public.emp_learning') is not null then
  with wk as (
    select distinct x as id from generate_series(0, 6) g(i), unnest(coalesce(_sa_on_shift(rest, ld + g.i), '{}')) x
  ), rows as (
    select w.id, _sa_mo_nm(w.id) as n, _sa_mo_last(l.data) as last
      from wk w join employees em on em.id::text = w.id left join emp_learning l on l.emp_id = w.id
     where not coalesce(em.is_admin, false) and lower(coalesce(em.position, '')) <> all (_sa_chat_lead_pos())
  ), slow as (
    select r.id, r.n, case when r.last is null then null else (ld - r.last) end as days from rows r
     where r.n is not null and (r.last is null or ld - r.last >= 6)
  )
  select jsonb_build_object('list', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'n', s.n, 'days', s.days, 'tg', _sa_tg_chat(s.id, null) is not null)
                                                order by s.days desc nulls first, s.n)
                                                from (select * from slow order by slow.days desc nulls first, slow.n limit 3) s), '[]'::jsonb),
                            'more', greatest(0, (select count(*) from slow) - 3)) into idle;
  end if;
  return jsonb_build_object('ok', true, 'day', to_char(ld, 'YYYY-MM-DD'), 'rest', coalesce(rest, ''), 'sched', cfg is not null,
    'shifts', shifts, 'count', cnt, 'holes', holes, 'open', open, 'stop', stop, 'thanks', th, 'ybrief', ybrief, 'learn', learn,
    'idle', idle, 'brief', brief, 'late', late);
end; $$;

-- ── 5) Текст сообщения и кнопки (как morningText и morningKb в lib/morning.js) ──────────
create or replace function _sa_morning_text(b jsonb, p_name text)
returns text language plpgsql stable set search_path to public as $$
declare lns text[] := '{}'; yy text[] := '{}'; wk text[] := '{}'; g jsonb; d text; first text := split_part(btrim(coalesce(p_name, '')), ' ', 1);
  day date := (b->>'day')::date; t text; names text[]; nn int; shown int; give text[]; swap text[]; need text[]; nth int;
begin
  lns := lns || ('<b>Доброе утро' || case when first <> '' then ', ' || _sa_mo_esc(first) else '' end || '</b>');
  lns := lns || (upper(left(_sa_chat_dlong(day), 1)) || substr(_sa_chat_dlong(day), 2) || case when coalesce(b->>'rest', '') <> '' then ' · ' || _sa_mo_esc(b->>'rest') else '' end);
  if coalesce((b->>'sched')::boolean, false) then
    lns := lns || ''::text || case when coalesce((b->>'count')::int, 0) > 0 then '<b>Сегодня в смене ' || (b->>'count') || '</b>' else '<b>Сегодня по графику смен нет</b>' end;
    for g in select v from jsonb_array_elements(b->'shifts') v loop
      lns := lns || (_sa_mo_esc(g->>'name') || ' ' || _sa_hh((g->>'from')::numeric) || '–' || _sa_hh((g->>'to')::numeric) || ': ' ||
        _sa_mo_esc((select string_agg(p->>'n', ', ' order by o) from jsonb_array_elements(g->'people') with ordinality q(p, o))));
    end loop;
    t := _sa_mo_and(array(select _sa_chat_spos_acc(h->>'pos', (h->>'miss')::int) from jsonb_array_elements(b->'holes') with ordinality q(h, o) where h->>'day' = b->>'day' order by o));
    if t <> '' then lns := lns || ('Не хватает: ' || t); end if;
    nn := jsonb_array_length(coalesce(b->'late', '[]'::jsonb));
    if nn > 0 then
      lns := lns || (case when nn = 1 then 'Опаздывает: ' else 'Опаздывают: ' end ||
        _sa_mo_esc((select string_agg((z->>'n') || ', будет в ' || (z->>'eta'), '; ' order by o) from jsonb_array_elements(b->'late') with ordinality q(z, o))));
    end if;
    for d in select distinct h->>'day' from jsonb_array_elements(b->'holes') h where h->>'day' > b->>'day' order by 1 loop
      wk := wk || (_sa_chat_dshort(d::date) || ': не хватает ' ||
        _sa_mo_and(array(select _sa_chat_spos_acc(h->>'pos', (h->>'miss')::int) from jsonb_array_elements(b->'holes') with ordinality q(h, o) where h->>'day' = d order by o)));
    end loop;
    select array_agg((c->>'who') || ' (' || _sa_chat_dshort((c->>'day')::date) || ')' order by c->>'day', o) filter (where c->>'mode' = 'give'),
           array_agg((c->>'who') || ' (' || _sa_chat_dshort((c->>'day')::date) || ')' order by c->>'day', o) filter (where c->>'mode' = 'swap'),
           array_agg(_sa_chat_spos_acc(c->>'pos', greatest((c->>'n')::int, 1)) || ' на ' || _sa_chat_dshort((c->>'day')::date) order by c->>'day', o) filter (where c->>'mode' = 'need')
      into give, swap, need from jsonb_array_elements(coalesce(b->'open', '[]'::jsonb)) with ordinality q(c, o);
    if give is not null then wk := wk || _sa_mo_esc('Отдают смену: ' || array_to_string(give, ', ')); end if;
    if swap is not null then wk := wk || _sa_mo_esc('Ищут обмен: ' || array_to_string(swap, ', ')); end if;
    if need is not null then wk := wk || _sa_mo_esc('Ищем в смену: ' || array_to_string(need, '; ')); end if;
    if coalesce(array_length(wk, 1), 0) > 0 then lns := lns || ''::text || '<b>На неделе</b>'::text || wk;
    else lns := lns || 'На неделе людей хватает'::text; end if;
  end if;
  nn := coalesce((b->'stop'->>'n')::int, 0);
  if nn > 0 then
    names := array(select v #>> '{}' from jsonb_array_elements(coalesce(b->'stop'->'names', '[]'::jsonb)) with ordinality q(v, o) order by o);
    shown := least(6, coalesce(array_length(names, 1), 0));
    lns := lns || ''::text || ('<b>Стоп-лист: ' || nn || '</b>') ||
      (_sa_mo_esc(array_to_string(names[1:shown], ', ')) || case when nn > shown then ' и ещё ' || (nn - shown) else '' end);
  end if;
  if jsonb_typeof(b->'thanks') = 'object' then
    nth := (b->'thanks'->>'n')::int;
    t := (select string_agg((p->>'n') || case when (p->>'k')::int > 1 then ' (' || (p->>'k') || ')' else '' end, ', ' order by o)
            from jsonb_array_elements(coalesce(b->'thanks'->'people', '[]'::jsonb)) with ordinality q(p, o));
    yy := yy || case when nth = 1 then 'Гость сказал спасибо: ' || _sa_mo_esc(coalesce(t, ''))
      else 'Гости сказали спасибо ' || nth || ' ' || _sa_plural(nth, 'раз', 'раза', 'раз') || ': ' || _sa_mo_esc(coalesce(t, '')) end;
    if coalesce(b->'thanks'->>'quote', '') <> '' then yy := yy || ('«' || _sa_mo_esc(b->'thanks'->>'quote') || '»'); end if;
  end if;
  if jsonb_typeof(b->'ybrief') = 'object' then
    yy := yy || ('Брифинг прочитали ' || (b->'ybrief'->>'reads') || case when coalesce((b->'ybrief'->>'of')::int, 0) > 0 then ' из ' || (b->'ybrief'->>'of') else '' end);
  end if;
  if jsonb_typeof(b->'learn') = 'object' then
    yy := yy || ('Занимались ' || (b->'learn'->>'done') || ' из ' || (b->'learn'->>'of') || ', кто был в смене');
  end if;
  if coalesce(array_length(yy, 1), 0) > 0 then lns := lns || ''::text || '<b>Вчера</b>'::text || yy; end if;
  if jsonb_array_length(coalesce(b->'idle'->'list', '[]'::jsonb)) > 0 then
    lns := lns || ''::text || '<b>Давно не занимались</b>'::text || _sa_mo_esc(
      (select string_agg((v->>'n') || ' (' || case when v->'days' is null or jsonb_typeof(v->'days') = 'null' then 'ещё ни разу'
         else (v->>'days') || ' ' || _sa_plural((v->>'days')::int, 'день', 'дня', 'дней') end || ')', ', ' order by o)
         from jsonb_array_elements(b->'idle'->'list') with ordinality q(v, o)) ||
      case when coalesce((b->'idle'->>'more')::int, 0) > 0 then ' и ещё ' || (b->'idle'->>'more') else '' end);
  end if;
  if not coalesce((b->'brief'->>'done')::boolean, false) then lns := lns || ''::text || 'Брифинг на сегодня ещё не собран'::text; end if;
  return array_to_string(lns, E'\n');
end; $$;

create or replace function _sa_morning_kb(b jsonb)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare row2 jsonb := '[]'::jsonb;
begin
  if not coalesce((b->'brief'->>'done')::boolean, false) then row2 := row2 || _sa_chat_tg_btn('Собрать брифинг', 'briefing'); end if;
  if jsonb_array_length(coalesce(b->'holes', '[]'::jsonb)) > 0 or jsonb_array_length(coalesce(b->'open', '[]'::jsonb)) > 0 then
    row2 := row2 || _sa_chat_tg_btn('График', 'schedule');
  end if;
  return jsonb_build_array(jsonb_build_array(_sa_chat_tg_btn('Открыть утро', 'morning'))) ||
    case when jsonb_array_length(row2) > 0 then jsonb_build_array(row2) else '[]'::jsonb end;
end; $$;

-- отправить сводку p_b руководителю p_emp в чат p_chat
create or replace function _sa_morning_send(p_emp text, p_chat bigint, p_b jsonb)
returns bigint language plpgsql security definer set search_path to public as $$
begin
  if p_chat is null or coalesce((p_b->>'ok')::boolean, false) is not true then return null; end if;
  return sa_tg_api('sendMessage', jsonb_build_object('chat_id', p_chat, 'parse_mode', 'HTML', 'disable_web_page_preview', true,
    'text', _sa_morning_text(p_b, (select e.name from employees e where e.id::text = p_emp)),
    'reply_markup', jsonb_build_object('inline_keyboard', _sa_morning_kb(p_b))));
end; $$;

-- ── 6) Из приложения ──────────────────────────────────────────────────────────────
create or replace function _sa_morning_prefs(p_emp text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare p sa_notify_prefs; linked boolean := false; on_ boolean := false;
begin
  select * into p from sa_notify_prefs where emp_id = p_emp;
  select true, remind into linked, on_ from tg_links where emp_id = p_emp;
  return jsonb_build_object('on', coalesce(p.morning, true), 'hour', coalesce(p.morning_hour, 9), 'linked', coalesce(linked, false) and coalesce(on_, false),
    'bot', _sa_tg_ready());
end; $$;

create or replace function morning_brief(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  return _sa_morning_at(c->>'id', now()) || jsonb_build_object('prefs', _sa_morning_prefs(c->>'id'));
end; $$;

create or replace function morning_set(p_token text, p_on boolean default null, p_hour int default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if p_hour is not null and (p_hour < 6 or p_hour > 12) then return jsonb_build_object('ok', false, 'error', 'hour'); end if;
  insert into sa_notify_prefs (emp_id) values (c->>'id') on conflict do nothing;
  update sa_notify_prefs set morning = coalesce(p_on, morning), morning_hour = coalesce(p_hour, morning_hour), updated_at = now()
   where emp_id = c->>'id';
  return jsonb_build_object('ok', true, 'prefs', _sa_morning_prefs(c->>'id'));
end; $$;

create or replace function morning_send_now(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; chat bigint;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if not _sa_tg_ready() then return jsonb_build_object('ok', false, 'error', 'no_bot'); end if;
  select tl.chat_id into chat from tg_links tl where tl.emp_id = c->>'id' and tl.remind;
  if chat is null then return jsonb_build_object('ok', false, 'error', 'not_linked'); end if;
  -- не чаще раза в минуту
  if not _sa_tg_once(c->>'id', (now() at time zone _sa_tz(c->>'restaurant'))::date, 'morning_now_' || to_char(now(), 'HH24MI')) then
    return jsonb_build_object('ok', false, 'error', 'too_fast');
  end if;
  perform _sa_morning_send(c->>'id', chat, _sa_morning_at(c->>'id', now()));
  return jsonb_build_object('ok', true, 'sent', true);
end; $$;

-- «Напомнить»: тому, кто давно не занимался, бот пишет от имени руководителя (раз в день на человека)
create or replace function morning_nudge(p_token text, p_emp text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; e employees; chat bigint; ld date;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select * into e from employees em where em.id::text = p_emp;
  if not found or e.restaurant is distinct from c->>'restaurant' or coalesce(e.status, 'active') <> 'active' or e.id::text = c->>'id' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  chat := _sa_tg_chat(p_emp, null);
  if chat is null then return jsonb_build_object('ok', false, 'error', 'no_tg'); end if;
  ld := (now() at time zone _sa_tz(e.restaurant))::date;
  if not _sa_tg_once(p_emp, ld, 'learn_nudge') then return jsonb_build_object('ok', false, 'error', 'already'); end if;
  perform sa_tg_send(chat, coalesce(_sa_chat_nm(c->>'who'), 'Руководитель') || ' напоминает про разминку: 2 минуты, три ситуации из зала.', 'Разминка', 'warmup');
  return jsonb_build_object('ok', true, 'sent', true);
end; $$;

-- ── 7) По расписанию: кому пора ───────────────────────────────────────────────────
-- Руководители с Telegram (напоминания включены), у кого «Утро» не выключено. Пора — с выбранного часа и три часа после
-- (сервер лежал утром — вечером сводку не шлём); одна сводка в день. Сводка одного не собралась или не ушла (ошибка) —
-- остальным она всё равно уходит, а ему — со следующего запуска, пока не кончилось его окно.
create or replace function _sa_morning_due(p_send boolean, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path to public as $$
declare e record; tz text; lnow timestamp; ld date; hr int; b jsonb; out jsonb := '[]'::jsonb;
begin
  if not _sa_tg_ready() then return out; end if;
  for e in select tl.emp_id, tl.chat_id, em.restaurant, em.name, coalesce(np.morning, true) as on_, coalesce(np.morning_hour, 9) as hr
             from tg_links tl join employees em on em.id::text = tl.emp_id left join sa_notify_prefs np on np.emp_id = tl.emp_id
            where tl.remind and coalesce(em.status, 'active') = 'active'
              and (coalesce(em.is_admin, false) or lower(coalesce(em.position, '')) = any (_sa_chat_lead_pos())) loop
    if not e.on_ then continue; end if;
    tz := _sa_tz(e.restaurant);
    lnow := p_now at time zone tz; ld := lnow::date; hr := extract(hour from lnow)::int;
    if hr < e.hr or hr >= e.hr + 3 then continue; end if;
    if _sa_tg_was(e.emp_id, ld, 'morning') then continue; end if;
    begin
      b := _sa_morning_at(e.emp_id, p_now);
      if coalesce((b->>'ok')::boolean, false) is not true then continue; end if;
      if p_send then
        if not _sa_tg_once(e.emp_id, ld, 'morning') then continue; end if;
        perform _sa_morning_send(e.emp_id, e.chat_id, b);
      end if;
      out := out || jsonb_build_object('emp', e.emp_id, 'name', e.name, 'chat', e.chat_id, 'text', _sa_morning_text(b, e.name));
    exception when others then
      raise warning 'Утро руководителя: сводка для % не ушла: %', e.emp_id, sqlerrm;
    end;
  end loop;
  return out;
end; $$;

create or replace function sa_morning_tick()
returns int language plpgsql security definer set search_path to public as $$
begin
  return jsonb_array_length(_sa_morning_due(true, now()));
end; $$;

create or replace function sa_morning_preview()
returns jsonb language sql security definer set search_path to public as $$
  select _sa_morning_due(false, now())
$$;

-- ── 8) Расписание (pg_cron) ────────────────────────────────────────────────────────
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: «Утро руководителя» не придёт по расписанию (включи pg_cron и запусти файл ещё раз)';
    return;
  end if;
  begin execute $c$select cron.unschedule('sa-morning')$c$; exception when others then null; end;
  execute $c$select cron.schedule('sa-morning', '*/10 * * * *', 'select public.sa_morning_tick()')$c$;
exception when others then
  raise notice 'Расписание «Утро руководителя» не создано: %', sqlerrm;
end $$;

-- ── 9) Права ───────────────────────────────────────────────────────────────────────
revoke all on function _sa_mo_pos() from public, anon, authenticated;
revoke all on function _sa_mo_and(text[]) from public, anon, authenticated;
revoke all on function _sa_mo_esc(text) from public, anon, authenticated;
revoke all on function _sa_mo_nm(text) from public, anon, authenticated;
revoke all on function _sa_mo_emp(text, text) from public, anon, authenticated;
revoke all on function _sa_mo_cfg(text) from public, anon, authenticated;
revoke all on function _sa_mo_lvl(jsonb, jsonb, date) from public, anon, authenticated;
revoke all on function _sa_mo_holes(text, jsonb, date) from public, anon, authenticated;
revoke all on function _sa_mo_date(text) from public, anon, authenticated;
revoke all on function _sa_mo_last(jsonb) from public, anon, authenticated;
revoke all on function _sa_morning_at(text, timestamptz) from public, anon, authenticated;
revoke all on function _sa_morning_text(jsonb, text) from public, anon, authenticated;
revoke all on function _sa_morning_kb(jsonb) from public, anon, authenticated;
revoke all on function _sa_morning_send(text, bigint, jsonb) from public, anon, authenticated;
revoke all on function _sa_morning_prefs(text) from public, anon, authenticated;
revoke all on function _sa_morning_due(boolean, timestamptz) from public, anon, authenticated;
revoke all on function sa_morning_tick() from public, anon, authenticated;
revoke all on function sa_morning_preview() from public, anon, authenticated;
revoke all on function morning_brief(text), morning_set(text, boolean, int), morning_send_now(text), morning_nudge(text, text) from public;
grant execute on function morning_brief(text), morning_set(text, boolean, int), morning_send_now(text), morning_nudge(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'утро руководителя: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('morning_brief', 'morning_set', 'morning_send_now', 'morning_nudge')) || ' функции из 4' ||
  ' · расписание: ' || _sa_cron_status('sa-morning') ||
  ' · бот: ' || case when _sa_tg_ready() then 'на месте' else 'нет (сводка будет только в приложении)' end ||
  ' · придёт руководителям с Telegram: ' || (select count(*) from tg_links tl join employees em on em.id::text = tl.emp_id
     where tl.remind and coalesce(em.status, 'active') = 'active' and (coalesce(em.is_admin, false) or lower(coalesce(em.position, '')) = any (_sa_chat_lead_pos()))) as result;
