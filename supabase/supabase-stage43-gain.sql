-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 43 (v109, Доп. 422): «Что дало обучение» — итог месяца для владельца и руководителей.
--
--   • Итог заведения за месяц: чему команда училась (уроки, тесты, сколько человек занимались — по журналу занятий,
--     который присылают телефоны, этап 23) и что за это время изменилось в зале: «спасибо» гостей (этап 34), доля
--     ошибок в тестах (этап 7), за сколько дней новички выходят на самостоятельную смену (этап 41), «спасибо» от коллег
--     (этап 42). Всё — по сравнению с прошлым месяцем; пока месяц идёт — с теми же днями прошлого месяца. Кто вырос
--     больше всех (очков занятий больше, чем месяцем раньше) и кто не занимался ни разу;
--   • экран «Что дало обучение» («Команда» → «Управление»): gain_month — текущий и прошлый месяц; gain_send_now —
--     прислать итог себе в Telegram сейчас;
--   • 1-го числа, с 10:00 до 21:00 по часам заведения, бот присылает руководителям с напоминаниями в Telegram итог
--     прошлого месяца (кнопка «Открыть итог»), раз в месяц. Расписание pg_cron «sa-gain» — раз в 10 минут. Проверка без
--     отправки: select sa_gain_preview(); — кому и что ушло бы за прошлый месяц, пора ли (due) и ушло ли уже (sent).
--
-- Нужны этапы 21, 22б, 23, 24, 25, 31 и 38. Этапы 7, 34, 41 и 42 — по желанию: без них в итоге просто нет их строк.
-- Таблиц не создаёт, ничего не удаляет. Можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.emp_learning') is null then
    raise exception 'Сначала этап 23 (supabase-stage23-reports.sql): нужен журнал занятий emp_learning';
  end if;
  if to_regprocedure('public._sa_day_points(jsonb)') is null or to_regprocedure('public._sa_act(jsonb)') is null or to_regprocedure('public._sa_tz(text)') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужны очки занятий и часовой пояс заведения';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public._sa_tg_once(text,date,text)') is null or to_regprocedure('public._sa_tg_ready()') is null then
    raise exception 'Сначала этапы 22б и 25 (Telegram и живые сообщения бота)';
  end if;
  if to_regprocedure('public.sa_tg_api(text,jsonb)') is null then
    raise exception 'Сначала этап 31 (supabase-stage31-qday.sql): нужна отправка с кнопками (sa_tg_api)';
  end if;
  if to_regprocedure('public._sa_chat_tg_btn(text,text)') is null or to_regprocedure('public._sa_chat_nm(text)') is null then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужны кнопки бота и имена';
  end if;
end $$;

-- ── 1) Слова (как lib/gain.js) ───────────────────────────────────────────────────────
create or replace function _sa_gn_pl(n int, a text, b text, c text)
returns text language sql immutable as $$
  select case when n % 10 = 1 and n % 100 <> 11 then a when n % 10 between 2 and 4 and (n % 100 < 10 or n % 100 >= 20) then b else c end
$$;

-- «a», «a и b», «a, b и c»
create or replace function _sa_gn_and(p text[])
returns text language sql immutable as $$
  select case when coalesce(array_length(p, 1), 0) <= 1 then coalesce(p[1], '')
    else array_to_string(p[1:array_length(p, 1) - 1], ', ') || ' и ' || p[array_length(p, 1)] end
$$;

-- текст для Telegram (parse_mode HTML)
create or replace function _sa_gn_esc(p text)
returns text language sql immutable as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

-- месяц словами: low — «октябрь», gen — «октября», ins — «октябрём»
create or replace function _sa_gn_mon(p_day date, p_form text)
returns text language sql immutable as $$
  select (case p_form
    when 'gen' then array['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
    when 'ins' then array['январём', 'февралём', 'мартом', 'апрелем', 'маем', 'июнем', 'июлем', 'августом', 'сентябрём', 'октябрём', 'ноябрём', 'декабрём']
    else array['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'] end)[extract(month from p_day)::int]
$$;

-- «1–30 октября», «1 октября»
create or replace function _sa_gn_period(p_from date, p_to date)
returns text language sql immutable as $$
  select case when p_from = p_to then extract(day from p_to)::int || ' ' || _sa_gn_mon(p_to, 'gen')
    else extract(day from p_from)::int || '–' || extract(day from p_to)::int || ' ' || _sa_gn_mon(p_to, 'gen') end
$$;

-- ── 2) Данные ─────────────────────────────────────────────────────────────────────
-- день журнала: занимался (как _sa_day_mark этапа 24: шаги, исправленные ошибки или ситуации)
create or replace function _sa_gn_on(r jsonb)
returns boolean language sql immutable as $$
  select coalesce(jsonb_typeof(r) = 'object' and (_sa_num(r->>'st') + _sa_num(r->>'f') + _sa_num(r->>'s')) > 0, false)
$$;

-- команда заведения (без владельца и уволенных) и её занятия за дни [p_from; p_to], по человеку: дни занятий, уроки,
-- тесты (и экзамены), практика, «Живой гость», очки (как «Лига недели»: не больше 200 в день). Кто пришёл позже конца
-- периода (сотрудника завели позже или он появился в «Новичках» позже), в команде этого периода не считается.
create or replace function _sa_gn_rows(p_rest text, p_from date, p_to date)
returns table (id text, full_ text, days int, lessons int, tests int, practice int, guest int, pts int)
language plpgsql stable security definer set search_path to public as $$
declare cond text := '';
begin
  if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'employees' and c.column_name = 'created_at'
               and c.data_type like 'timestamp%') then
    cond := cond || ' and (e.created_at is null or (e.created_at at time zone $4)::date <= $3)';
  end if;
  if to_regclass('public.sa_newbies') is not null then
    cond := cond || ' and not exists (select 1 from sa_newbies nb where nb.emp_id = e.id::text and (nb.started_at at time zone $4)::date > $3)';
  end if;
  return query execute $q$
    select e.id::text, btrim(coalesce(e.name, '') || ' ' || coalesce(e.surname, '')),
      (count(*) filter (where _sa_gn_on(a.r)))::int,
      coalesce(sum(_sa_num(a.r->>'l')), 0)::int,
      coalesce(sum(_sa_num(a.r->>'q') + _sa_num(a.r->>'x')), 0)::int,
      coalesce(sum(_sa_num(a.r->>'p')), 0)::int,
      coalesce(sum(_sa_num(a.r->>'g')), 0)::int,
      coalesce(sum(_sa_day_points(a.r)), 0)::int
    from employees e
    left join emp_learning l on l.emp_id = e.id::text
    cross join lateral (select _sa_act(coalesce(l.data, '{}'::jsonb))->to_char(g, 'YYYY-MM-DD') as r
                          from generate_series($2::date, greatest($2::date, $3::date), interval '1 day') g) a
    where e.restaurant is not distinct from $1 and coalesce(e.status, 'active') = 'active' and not coalesce(e.is_admin, false)$q$ || cond ||
    ' group by e.id, e.name, e.surname'
    using p_rest, p_from, p_to, _sa_tz(p_rest);
end; $$;

-- тесты (этап 7, quiz_events) за дни [p_from; p_to] по часам заведения: ответов, неверных, по людям («Имя Фамилия» →
-- [ответов, неверных]), три урока, по которым сдавали больше всего людей, и по скольким урокам сдавали вообще
create or replace function _sa_gn_quiz(p_rest text, p_from date, p_to date, p_tz text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare r jsonb;
begin
  if to_regclass('public.quiz_events') is null then return null; end if;
  execute $q$
    with ev as (
      select q.employee, coalesce(q.lesson_id, '') as lesson, q.correct from quiz_events q
       where q.restaurant is not distinct from $1 and q.ts >= ($2::timestamp at time zone $4) and q.ts < (($3 + 1)::timestamp at time zone $4)
    )
    select jsonb_build_object('n', (select count(*) from ev), 'wrong', (select count(*) from ev where not ev.correct),
      'people', coalesce((select jsonb_object_agg(x.employee, jsonb_build_array(x.n, x.w)) from (
          select ev.employee, count(*) as n, count(*) filter (where not ev.correct) as w from ev where coalesce(ev.employee, '') <> '' group by ev.employee) x), '{}'::jsonb),
      'topics', coalesce((select jsonb_agg(jsonb_build_object('id', t.lesson, 'n', t.n, 'a', t.a, 'w', t.w) order by t.n desc, t.a desc, t.lesson collate "C") from (
          select ev.lesson, count(distinct ev.employee) as n, count(*) as a, count(*) filter (where not ev.correct) as w from ev
           where ev.lesson <> '' group by ev.lesson order by count(distinct ev.employee) desc, count(*) desc, ev.lesson collate "C" limit 3) t), '[]'::jsonb),
      'topicsN', (select count(distinct ev.lesson) from ev where ev.lesson <> ''))
  $q$ into r using p_rest, p_from, p_to, p_tz;
  return r;
end; $$;

-- сколько строк в таблице «спасибо» за дни [p_from; p_to] по часам заведения (sa_guest_thanks — без скрытых)
create or replace function _sa_gn_count(p_table text, p_rest text, p_from date, p_to date, p_tz text)
returns int language plpgsql stable security definer set search_path to public as $$
declare n int := 0;
begin
  if to_regclass('public.' || p_table) is null then return null; end if;
  execute format('select count(*) from %I t where t.restaurant is not distinct from $1 and t.created_at >= ($2::timestamp at time zone $4)
                    and t.created_at < (($3 + 1)::timestamp at time zone $4)%s', p_table, case when p_table = 'sa_guest_thanks' then ' and not t.hidden' else '' end)
    into n using p_rest, p_from, p_to, p_tz;
  return n;
end; $$;

-- новички (этап 41), вышедшие на самостоятельную смену в дни [p_from; p_to]: сколько и за сколько дней в среднем — с
-- первой смены по графику (как карточка «вышла на самостоятельную смену»), без графика — со дня прихода
create or replace function _sa_gn_newbies(p_rest text, p_from date, p_to date, p_tz text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare x record; sd date; so date; f jsonb; d0 date; n int := 0; tot int := 0;
begin
  if to_regclass('public.sa_newbies') is null then return null; end if;
  for x in execute 'select nb.emp_id, nb.started_at, nb.solo_at from sa_newbies nb where nb.restaurant is not distinct from $1 and nb.solo_at is not null
                      and (nb.solo_at at time zone $4)::date between $2 and $3 order by nb.emp_id' using p_rest, p_from, p_to, p_tz loop
    sd := (x.started_at at time zone p_tz)::date; so := (x.solo_at at time zone p_tz)::date; f := null;
    if to_regprocedure('public._sa_nb_first(text,text,date)') is not null then
      begin execute 'select _sa_nb_first($1, $2, $3)' into f using p_rest, x.emp_id, sd; exception when others then f := null; end;
    end if;
    d0 := case when f is not null and (f->>'day')::date <= so then (f->>'day')::date else sd end;
    n := n + 1; tot := tot + greatest(0, so - d0);
  end loop;
  return jsonb_build_object('n', n, 'days', case when n > 0 then round(tot::numeric / n)::int else 0 end);
end; $$;

-- ── 3) Итог заведения за месяц p_month (любой день месяца) на день p_today (по часам заведения) ─────────────────────
-- Месяц идёт — по сегодня, сравниваем с теми же днями прошлого месяца. Журнал занятий телефон хранит 75 дней: если
-- прошлый месяц уже за этой границей, занятия за него не сравниваем (plearn — null) и «выросли» не ищем.
create or replace function _sa_gain_at(p_rest text, p_month date, p_today date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare tz text := _sa_tz(p_rest); m0 date := date_trunc('month', p_month)::date; m1 date; vto date; pf date; pt date; part boolean; lok boolean;
  cur jsonb; prv jsonb; q jsonb; pq jsonb; th jsonb; pe jsonb; nb jsonb; pnb jsonb; grew jsonb := '[]'::jsonb; idle jsonb; more int;
  lrn jsonb; plrn jsonb;
begin
  m1 := (m0 + interval '1 month' - interval '1 day')::date;
  if p_today is null or p_today < m0 then return jsonb_build_object('ok', false, 'error', 'month'); end if;
  part := p_today <= m1; vto := least(m1, p_today);
  pf := (m0 - interval '1 month')::date; pt := case when part then least(m0 - 1, pf + (vto - m0)) else m0 - 1 end;
  lok := pf >= p_today - 74;
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into cur from _sa_gn_rows(p_rest, m0, vto) r;
  if lok then select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into prv from _sa_gn_rows(p_rest, pf, pt) r; end if;
  select jsonb_build_object('people', count(*) filter (where (x->>'days')::int > 0), 'lessons', coalesce(sum((x->>'lessons')::int), 0),
      'tests', coalesce(sum((x->>'tests')::int), 0), 'practice', coalesce(sum((x->>'practice')::int), 0), 'guest', coalesce(sum((x->>'guest')::int), 0),
      'days', coalesce(sum((x->>'days')::int), 0))
    into lrn from jsonb_array_elements(cur) x;
  if lok then
    select jsonb_build_object('people', count(*) filter (where (x->>'days')::int > 0), 'lessons', coalesce(sum((x->>'lessons')::int), 0),
        'tests', coalesce(sum((x->>'tests')::int), 0), 'practice', coalesce(sum((x->>'practice')::int), 0), 'guest', coalesce(sum((x->>'guest')::int), 0),
        'days', coalesce(sum((x->>'days')::int), 0))
      into plrn from jsonb_array_elements(prv) x;
  end if;
  q := _sa_gn_quiz(p_rest, m0, vto, tz); pq := _sa_gn_quiz(p_rest, pf, pt, tz);
  if to_regclass('public.sa_guest_thanks') is not null then
    th := jsonb_build_object('n', _sa_gn_count('sa_guest_thanks', p_rest, m0, vto, tz), 'prev', _sa_gn_count('sa_guest_thanks', p_rest, pf, pt, tz));
  end if;
  if to_regclass('public.sa_peer_thanks') is not null then
    pe := jsonb_build_object('n', _sa_gn_count('sa_peer_thanks', p_rest, m0, vto, tz), 'prev', _sa_gn_count('sa_peer_thanks', p_rest, pf, pt, tz));
  end if;
  nb := _sa_gn_newbies(p_rest, m0, vto, tz); pnb := _sa_gn_newbies(p_rest, pf, pt, tz);
  -- больше всех выросли: очков занятий не меньше 50 и больше, чем месяцем раньше; кто прибавил больше, потом у кого больше
  if lok then
    with s as (
      select c, coalesce((select (p->>'pts')::int from jsonb_array_elements(prv) p where p->>'id' = c->>'id'), 0) as pp,
        coalesce((select p from jsonb_array_elements(prv) p where p->>'id' = c->>'id'), '{}'::jsonb) as pr from jsonb_array_elements(cur) c
    ), r as (
      select s.c, s.pp, s.pr, row_number() over (order by (s.c->>'pts')::int - s.pp desc, (s.c->>'pts')::int desc, (s.c->>'full_') collate "C") as rn
        from s where (s.c->>'pts')::int >= 50 and (s.c->>'pts')::int > s.pp
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', r.c->>'id', 'n', _sa_chat_nm(r.c->>'full_'), 'pts', (r.c->>'pts')::int, 'ppts', r.pp,
        'lessons', (r.c->>'lessons')::int, 'tests', (r.c->>'tests')::int, 'plessons', coalesce((r.pr->>'lessons')::int, 0), 'ptests', coalesce((r.pr->>'tests')::int, 0),
        'qn', coalesce((q->'people'->(r.c->>'full_')->>0)::int, 0), 'qw', coalesce((q->'people'->(r.c->>'full_')->>1)::int, 0),
        'pqn', coalesce((pq->'people'->(r.c->>'full_')->>0)::int, 0), 'pqw', coalesce((pq->'people'->(r.c->>'full_')->>1)::int, 0)) order by r.rn), '[]'::jsonb)
      into grew from r where r.rn <= 3;
  end if;
  -- ни разу не занимались — пять имён по алфавиту и сколько ещё
  select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'n', _sa_chat_nm(x->>'full_')) order by x->>'full_' collate "C"), '[]'::jsonb) into idle
    from (select x from jsonb_array_elements(cur) x where (x->>'days')::int = 0 order by x->>'full_' collate "C" limit 5) s(x);
  select greatest(0, count(*) - 5) into more from jsonb_array_elements(cur) x where (x->>'days')::int = 0;
  return jsonb_build_object('ok', true, 'rest', coalesce(p_rest, ''), 'month', to_char(m0, 'YYYY-MM'), 'from', to_char(m0, 'YYYY-MM-DD'),
    'to', to_char(vto, 'YYYY-MM-DD'), 'partial', part, 'pfrom', to_char(pf, 'YYYY-MM-DD'), 'pto', to_char(pt, 'YYYY-MM-DD'),
    'team', jsonb_array_length(cur), 'learn', lrn, 'plearn', plrn,
    'quiz', case when q is not null then jsonb_build_object('n', q->'n', 'wrong', q->'wrong') end,
    'pquiz', case when pq is not null then jsonb_build_object('n', pq->'n', 'wrong', pq->'wrong') end,
    'topics', coalesce(q->'topics', '[]'::jsonb), 'topicsN', coalesce((q->>'topicsN')::int, 0),
    'thanks', th, 'peer', pe,
    'newbies', case when nb is not null then jsonb_build_object('n', nb->'n', 'days', nb->'days', 'pn', coalesce(pnb->'n', '0'::jsonb), 'pdays', coalesce(pnb->'days', '0'::jsonb)) end,
    'grew', grew, 'idle', idle, 'idleMore', more);
end; $$;

-- есть что сказать: занятия, тесты, «спасибо», новички
create or replace function _sa_gain_has(b jsonb)
returns boolean language sql immutable as $$
  select coalesce((b->>'ok')::boolean, false) and (
    coalesce((b->'learn'->>'days')::int, 0) > 0 or coalesce((b->'learn'->>'people')::int, 0) > 0 or coalesce((b->'quiz'->>'n')::int, 0) > 0
    or coalesce((b->'thanks'->>'n')::int, 0) > 0 or coalesce((b->'peer'->>'n')::int, 0) > 0 or coalesce((b->'newbies'->>'n')::int, 0) > 0)
$$;

-- ── 4) Текст сообщения и кнопка (как gainText и gainKb в lib/gain.js) ─────────────────────
create or replace function _sa_gain_text(b jsonb)
returns text language plpgsql stable set search_path to public as $$
declare lns text[] := '{}'; m0 date := (b->>'from')::date; part boolean := coalesce((b->>'partial')::boolean, false);
  pf date := nullif(b->>'pfrom', '')::date; pt date := nullif(b->>'pto', '')::date; cmp text := ''; head text;
  pl jsonb := case when jsonb_typeof(b->'plearn') = 'object' then b->'plearn' end; team int := coalesce((b->>'team')::int, 0);
  qn int; qw int; pqn int; pqw int; pct int; ppct int; t int; tp int; names text[]; more int;
begin
  if pf is null or pt is null then cmp := case when part then _sa_gn_period(m0, (b->>'to')::date) else '' end;
  elsif part then cmp := _sa_gn_period(m0, (b->>'to')::date) || ', сравниваем с ' || _sa_gn_period(pf, pt);
  else cmp := 'сравниваем с ' || _sa_gn_mon(pf, 'ins'); end if;
  lns := lns || ('<b>Что дало обучение · ' || _sa_gn_mon(m0, 'low') || '</b>');
  head := array_to_string(array_remove(array[nullif(_sa_gn_esc(b->>'rest'), ''), nullif(cmp, '')], null), ' · ');
  if head <> '' then lns := lns || head; end if;
  lns := lns || ''::text || '<b>Чему учились</b>'::text;
  lns := lns || ('Уроков: ' || coalesce((b->'learn'->>'lessons')::int, 0) || case when pl is not null then ', было ' || coalesce((pl->>'lessons')::int, 0) else '' end);
  lns := lns || ('Тестов: ' || coalesce((b->'learn'->>'tests')::int, 0) || case when pl is not null then ', было ' || coalesce((pl->>'tests')::int, 0) else '' end);
  lns := lns || ('Занимались: ' || coalesce((b->'learn'->>'people')::int, 0) || case when team > 0 then ' из ' || team else '' end
    || case when pl is not null then ', было ' || coalesce((pl->>'people')::int, 0) else '' end);
  -- что изменилось в зале
  head := '';
  t := coalesce((b->'thanks'->>'n')::int, 0); tp := coalesce((b->'thanks'->>'prev')::int, 0);
  if jsonb_typeof(b->'thanks') = 'object' and (t > 0 or tp > 0) then head := head || chr(10) || '«Спасибо» от гостей: ' || t || ', было ' || tp; end if;
  qn := coalesce((b->'quiz'->>'n')::int, 0); qw := coalesce((b->'quiz'->>'wrong')::int, 0);
  pqn := coalesce((b->'pquiz'->>'n')::int, 0); pqw := coalesce((b->'pquiz'->>'wrong')::int, 0);
  if jsonb_typeof(b->'quiz') = 'object' and qn >= 10 then
    pct := round(100.0 * qw / qn)::int;
    head := head || chr(10) || 'Ошибок в тестах: ' || pct || '%';
    if jsonb_typeof(b->'pquiz') = 'object' and pqn >= 10 then ppct := round(100.0 * pqw / pqn)::int; head := head || ', было ' || ppct || '%'; end if;
  end if;
  if jsonb_typeof(b->'newbies') = 'object' and coalesce((b->'newbies'->>'n')::int, 0) > 0 then
    t := coalesce((b->'newbies'->>'days')::int, 0);
    head := head || chr(10) || 'Новички до самостоятельной смены: ' || t || ' ' || _sa_gn_pl(t, 'день', 'дня', 'дней')
      || case when coalesce((b->'newbies'->>'pn')::int, 0) > 0 then ', было ' || coalesce((b->'newbies'->>'pdays')::int, 0) else '' end;
  end if;
  t := coalesce((b->'peer'->>'n')::int, 0); tp := coalesce((b->'peer'->>'prev')::int, 0);
  if jsonb_typeof(b->'peer') = 'object' and (t > 0 or tp > 0) then head := head || chr(10) || '«Спасибо» от коллег: ' || t || ', было ' || tp; end if;
  if head <> '' then lns := lns || ''::text || '<b>Что изменилось в зале</b>'::text || substr(head, 2); end if;
  names := array(select g->>'n' from jsonb_array_elements(coalesce(b->'grew', '[]'::jsonb)) with ordinality q(g, o) where coalesce(g->>'n', '') <> '' order by o);
  if coalesce(array_length(names, 1), 0) > 0 then lns := lns || ''::text || '<b>Больше всех выросли</b>'::text || _sa_gn_esc(_sa_gn_and(names)); end if;
  names := array(select g->>'n' from jsonb_array_elements(coalesce(b->'idle', '[]'::jsonb)) with ordinality q(g, o) where coalesce(g->>'n', '') <> '' order by o);
  more := coalesce((b->>'idleMore')::int, 0);
  if coalesce(array_length(names, 1), 0) > 0 then
    lns := lns || ''::text || '<b>Не занимались</b>'::text
      || _sa_gn_esc(case when more > 0 then array_to_string(names, ', ') || ' и ещё ' || more else _sa_gn_and(names) end);
  end if;
  return array_to_string(lns, chr(10));
end; $$;

create or replace function _sa_gain_kb(b jsonb)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_array(jsonb_build_array(_sa_chat_tg_btn('Открыть итог', 'gain_' || coalesce(b->>'month', ''))))
$$;

-- отправить итог p_b в чат p_chat
create or replace function _sa_gain_send(p_chat bigint, p_b jsonb)
returns bigint language plpgsql security definer set search_path to public as $$
begin
  if p_chat is null or coalesce((p_b->>'ok')::boolean, false) is not true then return null; end if;
  return sa_tg_api('sendMessage', jsonb_build_object('chat_id', p_chat, 'parse_mode', 'HTML', 'disable_web_page_preview', true,
    'text', _sa_gain_text(p_b), 'reply_markup', jsonb_build_object('inline_keyboard', _sa_gain_kb(p_b))));
end; $$;

-- ── 5) Из приложения ──────────────────────────────────────────────────────────────
-- Telegram руководителя: бот на месте, связка есть и напоминания включены
create or replace function _sa_gain_tg(p_emp text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare linked boolean := false;
begin
  select coalesce(tl.remind, false) into linked from tg_links tl where tl.emp_id = p_emp;
  return jsonb_build_object('bot', _sa_tg_ready(), 'linked', coalesce(linked, false));
end; $$;

-- какой месяц: пусто — первые семь дней прошлый, дальше текущий; «ГГГГ-ММ» — текущий или прошлый
create or replace function _sa_gain_month(p_month text, p_today date)
returns date language plpgsql immutable as $$
declare cur date := date_trunc('month', p_today)::date; m date;
begin
  if p_month is null or btrim(p_month) = '' then
    return case when extract(day from p_today) <= 7 then (cur - interval '1 month')::date else cur end;
  end if;
  if btrim(p_month) !~ '^\d{4}-(0[1-9]|1[0-2])$' then return null; end if;
  m := (btrim(p_month) || '-01')::date;
  if m > cur or m < (cur - interval '1 month')::date then return null; end if;
  return m;
end; $$;

create or replace function gain_month(p_token text, p_month text default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; today date; m date; cur date;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_rest'); end if;
  today := (now() at time zone _sa_tz(rest))::date; cur := date_trunc('month', today)::date;
  m := _sa_gain_month(p_month, today);
  if m is null then return jsonb_build_object('ok', false, 'error', 'month'); end if;
  return _sa_gain_at(rest, m, today) || jsonb_build_object('today', to_char(today, 'YYYY-MM-DD'),
    'months', jsonb_build_array(to_char(cur, 'YYYY-MM'), to_char(cur - interval '1 month', 'YYYY-MM')), 'tg', _sa_gain_tg(c->>'id'));
end; $$;

-- «Прислать в Telegram»: итог этого месяца себе сейчас (не чаще раза в минуту)
create or replace function gain_send_now(p_token text, p_month text default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; today date; m date; chat bigint; b jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', false, 'error', 'no_rest'); end if;
  today := (now() at time zone _sa_tz(rest))::date;
  m := _sa_gain_month(p_month, today);
  if m is null then return jsonb_build_object('ok', false, 'error', 'month'); end if;
  if not _sa_tg_ready() then return jsonb_build_object('ok', false, 'error', 'no_bot'); end if;
  select tl.chat_id into chat from tg_links tl where tl.emp_id = c->>'id' and tl.remind;
  if chat is null then return jsonb_build_object('ok', false, 'error', 'not_linked'); end if;
  if not _sa_tg_once(c->>'id', today, 'gain_now_' || to_char(now(), 'HH24MI')) then return jsonb_build_object('ok', false, 'error', 'too_fast'); end if;
  b := _sa_gain_at(rest, m, today);
  perform _sa_gain_send(chat, b);
  return jsonb_build_object('ok', true, 'sent', true, 'month', b->>'month');
end; $$;

-- ── 6) По расписанию: 1-го числа итог прошлого месяца ───────────────────────────────────
-- Руководители с Telegram (напоминания включены). Пора — 1-го числа с 10:00 до 21:00 по часам заведения; раз в месяц.
-- Итог заведения считается один раз на всех его руководителей. Не ушёл одному (ошибка) — остальным уходит, ему — со
-- следующего запуска, пока не кончилось окно. Нечего сказать (ни занятий, ни тестов, ни «спасибо») — не шлём.
-- p_all — просмотр владельца: все руководители с Telegram, в любой день, с отметками due (пора) и sent (уже ушло).
create or replace function _sa_gain_due(p_send boolean, p_now timestamptz, p_all boolean default false)
returns jsonb language plpgsql security definer set search_path to public as $$
declare e record; tz text; lnow timestamp; ld date; m0 date; due boolean; sent boolean; b jsonb; cache jsonb := '{}'::jsonb; out jsonb := '[]'::jsonb;
begin
  if p_send and not _sa_tg_ready() then return out; end if;
  for e in select tl.emp_id, tl.chat_id, em.restaurant, em.name from tg_links tl join employees em on em.id::text = tl.emp_id
            where tl.remind and coalesce(em.status, 'active') = 'active' and nullif(btrim(coalesce(em.restaurant, '')), '') is not null
              and (coalesce(em.is_admin, false) or lower(coalesce(em.position, '')) = any (_sa_chat_lead_pos()))
            order by em.restaurant, tl.emp_id loop
    begin
      tz := _sa_tz(e.restaurant); lnow := p_now at time zone tz; ld := lnow::date; m0 := date_trunc('month', ld)::date;
      due := extract(day from ld) = 1 and extract(hour from lnow) >= 10 and extract(hour from lnow) < 21;
      if not due and not p_all then continue; end if;
      sent := _sa_tg_was(e.emp_id, m0, 'gain');
      if sent and not p_all then continue; end if;
      if cache ? e.restaurant then b := cache->e.restaurant;
      else b := _sa_gain_at(e.restaurant, (m0 - interval '1 month')::date, ld); cache := cache || jsonb_build_object(e.restaurant, b); end if;
      if not _sa_gain_has(b) then continue; end if;
      if p_send then
        if not _sa_tg_once(e.emp_id, m0, 'gain') then continue; end if;
        perform _sa_gain_send(e.chat_id, b);
      end if;
      out := out || (jsonb_build_object('emp', e.emp_id, 'name', e.name, 'rest', e.restaurant, 'month', b->>'month', 'chat', e.chat_id, 'text', _sa_gain_text(b))
        || case when p_all then jsonb_build_object('due', due, 'sent', sent) else '{}'::jsonb end);
    exception when others then
      raise warning 'Что дало обучение: итог для % не ушёл: %', e.emp_id, sqlerrm;
    end;
  end loop;
  return out;
end; $$;

create or replace function sa_gain_tick()
returns int language plpgsql security definer set search_path to public as $$
begin
  return jsonb_array_length(_sa_gain_due(true, now()));
end; $$;

create or replace function sa_gain_preview()
returns jsonb language sql security definer set search_path to public as $$
  select _sa_gain_due(false, now(), true)
$$;

-- ── 7) Расписание (pg_cron) ────────────────────────────────────────────────────────
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron не включён: итог месяца в Telegram не придёт по расписанию, экран в приложении работает (включи pg_cron и запусти файл ещё раз)';
    return;
  end if;
  begin execute $c$select cron.unschedule('sa-gain')$c$; exception when others then null; end;
  execute $c$select cron.schedule('sa-gain', '*/10 * * * *', 'select public.sa_gain_tick()')$c$;
exception when others then
  raise notice 'Расписание «Что дало обучение» не создано: %', sqlerrm;
end $$;

-- ── 8) Права ───────────────────────────────────────────────────────────────────────
revoke all on function _sa_gn_pl(int, text, text, text) from public, anon, authenticated;
revoke all on function _sa_gn_and(text[]) from public, anon, authenticated;
revoke all on function _sa_gn_esc(text) from public, anon, authenticated;
revoke all on function _sa_gn_mon(date, text) from public, anon, authenticated;
revoke all on function _sa_gn_period(date, date) from public, anon, authenticated;
revoke all on function _sa_gn_on(jsonb) from public, anon, authenticated;
revoke all on function _sa_gn_rows(text, date, date) from public, anon, authenticated;
revoke all on function _sa_gn_quiz(text, date, date, text) from public, anon, authenticated;
revoke all on function _sa_gn_count(text, text, date, date, text) from public, anon, authenticated;
revoke all on function _sa_gn_newbies(text, date, date, text) from public, anon, authenticated;
revoke all on function _sa_gain_at(text, date, date) from public, anon, authenticated;
revoke all on function _sa_gain_has(jsonb) from public, anon, authenticated;
revoke all on function _sa_gain_text(jsonb) from public, anon, authenticated;
revoke all on function _sa_gain_kb(jsonb) from public, anon, authenticated;
revoke all on function _sa_gain_send(bigint, jsonb) from public, anon, authenticated;
revoke all on function _sa_gain_tg(text) from public, anon, authenticated;
revoke all on function _sa_gain_month(text, date) from public, anon, authenticated;
revoke all on function _sa_gain_due(boolean, timestamptz, boolean) from public, anon, authenticated;
revoke all on function sa_gain_tick() from public, anon, authenticated;
revoke all on function sa_gain_preview() from public, anon, authenticated;
revoke all on function gain_month(text, text), gain_send_now(text, text) from public;
grant execute on function gain_month(text, text), gain_send_now(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'что дало обучение: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('gain_month', 'gain_send_now')) || ' функции из 2' ||
  ' · расписание: ' || _sa_cron_status('sa-gain') ||
  ' · бот: ' || case when _sa_tg_ready() then 'на месте' else 'нет (итог будет только в приложении)' end ||
  ' · придёт 1-го числа руководителям с Telegram: ' || (select count(*) from tg_links tl join employees em on em.id::text = tl.emp_id
     where tl.remind and coalesce(em.status, 'active') = 'active' and (coalesce(em.is_admin, false) or lower(coalesce(em.position, '')) = any (_sa_chat_lead_pos()))) as result;
