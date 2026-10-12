-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 24 (v30): «Квест смены», «Лига недели» и «Кубок заведений», «Свеча на двоих».
--
-- Нужны этапы 21 (личность по токену, _sa_caller) и 23 (копия «телефонных» данных —
-- таблица emp_learning: журнал дня, серия, выходные по графику). График смен — этап 9.
-- Ничего не ломает и ничего не меняет в старых функциях. Можно запускать повторно.
--
--   quest_today(p_token)            — квест смены: кто сегодня в графике твоего заведения,
--                                     что каждый уже сделал за день, общая цель
--   league_week(p_token)            — лига недели (очки с понедельника) по всей сети
--                                     и «Кубок заведений» (средние очки на человека)
--   pair_candidates(p_token)        — с кем можно зажечь «Свечу на двоих» (своё заведение)
--   pair_invite(p_token, p_emp)     — позвать в пару
--   pair_answer(p_token, p_id, p_accept) — принять или отклонить приглашение
--   pair_end(p_token)               — погасить свою свечу (или отозвать приглашение)
--   pair_status(p_token)            — моя пара: напарник, кто что сделал сегодня, серия на двоих
--
-- Очки лиги — те же, что считает телефон (lib/activity.js, POINTS): урок 10, практика 10,
-- тест 15, диалог 15, сборка 10, разминка 10, тренажёр 5, экзамен 30, живой гость 20,
-- радио 5, освежённая тема 10, золото 25, зачёт на опыт 15, исправленная ошибка 3,
-- ситуация 1, проверка 2. Не больше 200 очков в день.
-- Данные приходят с телефона копией этапа 23 (не чаще раза в пару минут) — квест и лига
-- обновляются с той же задержкой. Копии не верим на слово: каждое число — от 0 до 1000,
-- считаются только настоящие даты недели, не больше 200 очков в день.
-- Часовой пояс — свой у заведения (sa_settings 'tz:<заведение>', этап 22б), иначе общий.
-- Выходной по графику заведения (этап 9) свечу на двоих не гасит, даже если человек
-- после него ещё не открывал приложение.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 0) Служебное ─────────────────────────────────────────────────────────────
-- часовой пояс: как у напоминаний (этап 22б): свой у заведения (ключ 'tz:<заведение>'),
-- иначе общий ('tz'), иначе Камчатка. Неизвестное название пояса не роняет квест и лигу —
-- берётся следующий по порядку.
create or replace function _sa_tz(p_rest text)
returns text language plpgsql stable security definer set search_path to public as $$
declare tz text; def text; t timestamp;
begin
  if to_regclass('public.sa_settings') is not null then
    begin
      execute 'select value from sa_settings where key = $1' into def using 'tz';
      if coalesce(btrim(p_rest), '') <> '' then
        execute 'select value from sa_settings where key = $1' into tz using 'tz:' || p_rest;
      end if;
    exception when others then tz := null; def := null;
    end;
  end if;
  tz := nullif(btrim(coalesce(tz, '')), '');
  if tz is not null then begin t := now() at time zone tz; exception when others then tz := null; end; end if;
  if tz is not null then return tz; end if;
  def := nullif(btrim(coalesce(def, '')), '');
  if def is not null then begin t := now() at time zone def; exception when others then def := null; end; end if;
  return coalesce(def, 'Asia/Kamchatka');
end; $$;

-- без заведения — общий пояс (как было)
create or replace function _sa_tz()
returns text language sql stable security definer set search_path to public as $$
  select _sa_tz(null::text)
$$;

-- число из копии с телефона: от 0 до 1000; мусор, минус и огромные числа — ноль.
-- Копию присылает телефон, поэтому ей не верим на слово (ревью v30): иначе одно
-- «999999999999» роняло квест ошибкой, а минус уменьшал чужие очки.
create or replace function _sa_num(p text)
returns numeric language sql immutable as $$
  select case when p ~ '^[0-9]{1,9}(\.[0-9]{1,6})?$' then least(1000, p::numeric) else 0 end
$$;

-- слова имени: нижний регистр, ё → е, по алфавиту, без повторов (то же, что в этапе 22б)
create or replace function _sa_name_tokens(p text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct w order by w), '{}')
    from unnest(regexp_split_to_array(btrim(regexp_replace(replace(lower(coalesce(p, '')), 'ё', 'е'), '\s+', ' ', 'g')), ' ')) w
   where w <> ''
$$;

-- очки одного дня журнала
create or replace function _sa_day_points(r jsonb)
returns int language sql immutable as $$
  select case when jsonb_typeof(r) <> 'object' then 0 else least(200, greatest(0, round(
      _sa_num(r->>'l') * 10 + _sa_num(r->>'p') * 10 + _sa_num(r->>'q') * 15 + _sa_num(r->>'d') * 15 +
      _sa_num(r->>'b') * 10 + _sa_num(r->>'w') * 10 + _sa_num(r->>'m') * 5 + _sa_num(r->>'x') * 30 +
      _sa_num(r->>'g') * 20 + _sa_num(r->>'r') * 5 + _sa_num(r->>'u') * 10 + _sa_num(r->>'o') * 25 +
      _sa_num(r->>'k') * 15 + _sa_num(r->>'f') * 3 + _sa_num(r->>'s') * 1 + _sa_num(r->>'c') * 2)))::int end
$$;

-- журнал дня из копии с телефона
create or replace function _sa_act(d jsonb)
returns jsonb language sql immutable as $$
  select case when jsonb_typeof(d->'activity') = 'object' then d->'activity' else '{}'::jsonb end
$$;

-- очки за дни [p_from; p_to]: идём по настоящим датам и берём ровно их записи. Ключи журнала
-- не перебираем — иначе «2026-09-31», «2026-10-45» или «2026-10-12#1» сошли бы за лишние дни
-- (ревью v30)
create or replace function _sa_points_between(d jsonb, p_from text, p_to text)
returns int language sql stable as $$
  select coalesce(sum(_sa_day_points(_sa_act(d)->to_char(g, 'YYYY-MM-DD'))), 0)::int
    from generate_series(p_from::date, p_to::date, interval '1 day') g
$$;

-- день человека: 2 — занимался, 1 — выходной по графику (серия не гаснет), 0 — пропуск.
-- Выходной берётся с телефона (серия отметила его «замороженным») или из графика заведения
-- (p_sched — ответ _sa_emp_sched): так выходной не считается пропуском, даже если человек
-- после него ещё не открывал приложение (ревью v30).
create or replace function _sa_day_mark(d jsonb, k text, p_sched jsonb)
returns int language sql immutable as $$
  select case
    when jsonb_typeof(_sa_act(d)->k) = 'object'
         and (_sa_num(_sa_act(d)->k->>'st') + _sa_num(_sa_act(d)->k->>'f') + _sa_num(_sa_act(d)->k->>'s')) > 0 then 2
    when jsonb_typeof(d->'streak'->'days') = 'array' and (d->'streak'->'days') ? k then 2
    when jsonb_typeof(d->'streak'->'frozen') = 'array' and (d->'streak'->'frozen') ? k then 1
    when jsonb_typeof(p_sched) = 'object' and p_sched->>k = '0' then 1
    else 0 end
$$;

create or replace function _sa_day_state(d jsonb, k text)
returns int language sql immutable as $$
  select _sa_day_mark(d, k, null::jsonb)
$$;

-- серия на двоих: дни подряд, когда занимались оба. Сегодня ещё не потеряно — счёт со вчера.
-- У одного выходной по графику — день не считается, но и свечу не гасит. Как у личной
-- серии (lib/streak.js): не дольше недели подряд без общего дня.
create or replace function _sa_pair_run(da jsonb, db jsonb, sa jsonb, sb jsonb, p_since date, p_today date)
returns int language plpgsql immutable as $$
declare d date := p_today; n int := 0; x int; y int; gap int := 0;
begin
  if p_today is null then return 0; end if;
  x := _sa_day_mark(da, to_char(d, 'YYYY-MM-DD'), sa); y := _sa_day_mark(db, to_char(d, 'YYYY-MM-DD'), sb);
  if x = 2 and y = 2 then n := 1; end if;
  d := d - 1;
  while d >= coalesce(p_since, p_today) and n < 400 loop
    x := _sa_day_mark(da, to_char(d, 'YYYY-MM-DD'), sa); y := _sa_day_mark(db, to_char(d, 'YYYY-MM-DD'), sb);
    exit when x = 0 or y = 0;
    if x = 2 and y = 2 then n := n + 1; gap := 0;
    else gap := gap + 1; exit when gap > 7;
    end if;
    d := d - 1;
  end loop;
  return n;
end; $$;

create or replace function _sa_pair_streak(da jsonb, db jsonb, p_since date, p_today date)
returns int language sql immutable as $$
  select _sa_pair_run(da, db, null::jsonb, null::jsonb, p_since, p_today)
$$;

-- кто сегодня в графике заведения: id сотрудников (то же правило имён, что в приложении)
create or replace function _sa_on_shift(p_rest text, p_day date)
returns text[] language plpgsql stable security definer set search_path to public as $$
declare mkey text := to_char(p_day, 'YYYY-MM'); dnum int := extract(day from p_day)::int;
  v record; pl jsonb; shifts jsonb; st jsonb; k text; stoks text[]; hit text; nmatch int; out text[] := '{}';
  def_shifts constant jsonb := '[{"k":"У"},{"k":"Д"},{"k":"В"},{"k":"К"}]';
begin
  if to_regclass('public.schedule_venues') is null or to_regclass('public.schedule_months') is null then return null; end if;
  for v in select sv.venue_key, sv.config from schedule_venues sv where sv.restaurant is not distinct from p_rest loop
    select m.payload into pl from schedule_months m where m.restaurant is not distinct from p_rest and m.venue_key = v.venue_key and m.month = mkey;
    if pl is null then continue; end if;
    shifts := case when jsonb_typeof(v.config->'shifts') = 'array' and jsonb_array_length(v.config->'shifts') > 0 then v.config->'shifts' else def_shifts end;
    for st in select * from jsonb_array_elements(case when jsonb_typeof(v.config->'staff') = 'array' then v.config->'staff' else '[]'::jsonb end) loop
      if coalesce(st->>'till', '') <> '' and mkey > st->>'till' then continue; end if;
      k := pl->'plan'->(st->>'id')->>(dnum::text);
      if k is null or k = '' or not exists (select 1 from jsonb_array_elements(shifts) x where x->>'k' = k) then continue; end if;
      stoks := _sa_name_tokens(st->>'name');
      if coalesce(array_length(stoks, 1), 0) = 0 then continue; end if;
      select count(*), min(em.id::text) into nmatch, hit from employees em
       where em.restaurant is not distinct from p_rest and coalesce(em.status, 'active') = 'active'
         and _sa_name_tokens(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) = stoks;
      if nmatch <> 1 then
        select count(*), min(em.id::text) into nmatch, hit from employees em
         where em.restaurant is not distinct from p_rest and coalesce(em.status, 'active') = 'active'
           and (_sa_name_tokens(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) <@ stoks
                or stoks <@ _sa_name_tokens(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')));
      end if;
      if nmatch = 1 and not (hit = any(out)) then out := out || hit; end if;
    end loop;
  end loop;
  return out;
end; $$;

-- График человека за период: {"ГГГГ-ММ-ДД": 1 — смена, 0 — выходной}. Дней, где графика нет
-- (месяц не составлен, человека в нём не нашли, его строка пуста), в ответе нет — «неизвестно».
-- Человек ищется по имени так же, как на телефоне (lib/streak.js, myShiftOn): точное совпадение
-- слов имени, иначе единственный похожий. Не дальше 400 дней назад.
create or replace function _sa_emp_sched(p_emp text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare rest text; ptk text[]; outj jsonb := '{}'::jsonb; m date; mkey text; dmax int; dnum int; d date;
  v record; pl jsonb; shifts jsonb; codes text[]; me jsonb; me1 jsonb; nc int; prow jsonb; days jsonb; code text;
  def_shifts constant jsonb := '[{"k":"У"},{"k":"Д"},{"k":"В"},{"k":"К"}]';
begin
  if p_emp is null or p_from is null or p_to is null or p_from > p_to then return outj; end if;
  if to_regclass('public.schedule_venues') is null or to_regclass('public.schedule_months') is null then return outj; end if;
  select em.restaurant, _sa_name_tokens(coalesce(em.name, '') || ' ' || coalesce(em.surname, '')) into rest, ptk
    from employees em where em.id::text = p_emp limit 1;
  if not found or coalesce(array_length(ptk, 1), 0) = 0 then return outj; end if;
  m := date_trunc('month', greatest(p_from, p_to - 400))::date;
  while m <= p_to loop
    mkey := to_char(m, 'YYYY-MM');
    dmax := extract(day from (m + interval '1 month' - interval '1 day'))::int;
    days := null;
    for v in select sv.venue_key, sv.config from schedule_venues sv where sv.restaurant is not distinct from rest order by sv.venue_key loop
      pl := null;
      select mm.payload into pl from schedule_months mm where mm.restaurant is not distinct from rest and mm.venue_key = v.venue_key and mm.month = mkey;
      if pl is null or jsonb_typeof(pl->'plan') <> 'object' then continue; end if;
      shifts := case when jsonb_typeof(v.config->'shifts') = 'array' and jsonb_array_length(v.config->'shifts') > 0 then v.config->'shifts' else def_shifts end;
      select coalesce(array_agg(x->>'k'), '{}') into codes from jsonb_array_elements(shifts) x where coalesce(x->>'k', '') <> '';
      select count(*), (array_agg(s.x) filter (where s.t = ptk))[1], (array_agg(s.x))[1]
        into nc, me, me1
        from (select x, _sa_name_tokens(x->>'name') as t
                from jsonb_array_elements(case when jsonb_typeof(v.config->'staff') = 'array' then v.config->'staff' else '[]'::jsonb end) x
               where jsonb_typeof(x) = 'object' and (coalesce(x->>'till', '') = '' or mkey <= x->>'till')) s
       where coalesce(array_length(s.t, 1), 0) > 0 and (s.t <@ ptk or ptk <@ s.t);
      if me is null and nc = 1 then me := me1; end if;
      if me is null then continue; end if;
      prow := pl->'plan'->(me->>'id');
      if jsonb_typeof(prow) <> 'object' or prow = '{}'::jsonb then continue; end if;
      if days is null then days := '{}'::jsonb; end if;
      for dnum in 1..dmax loop
        code := prow->>(dnum::text);
        if code is not null and code = any(codes) then days := days || jsonb_build_object(dnum::text, 1);
        elsif not (days ? dnum::text) then days := days || jsonb_build_object(dnum::text, 0);
        end if;
      end loop;
    end loop;
    if days is not null then
      for dnum in 1..dmax loop
        d := m + (dnum - 1);
        if d >= p_from and d <= p_to then outj := outj || jsonb_build_object(to_char(d, 'YYYY-MM-DD'), (days->>(dnum::text))::int); end if;
      end loop;
    end if;
    m := (m + interval '1 month')::date;
  end loop;
  return outj;
end; $$;

-- ── 1) Квест смены ───────────────────────────────────────────────────────────
create or replace function quest_today(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text; ld date; dkey text; ids text[]; known boolean; people jsonb := '[]'::jsonb; r record;
  n int; g_warm int; g_steps int; g_guest int; d_warm int := 0; d_steps int := 0; d_guest int := 0; me_on boolean := false;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := c->>'restaurant';
  ld := (now() at time zone _sa_tz(rest))::date; dkey := to_char(ld, 'YYYY-MM-DD');
  ids := _sa_on_shift(rest, ld);
  known := coalesce(array_length(ids, 1), 0) > 0;
  if not known then
    -- графика на сегодня нет — квест заведения: кто сегодня уже занимался, и я
    select coalesce(array_agg(em.id::text), '{}') into ids from employees em join emp_learning el on el.emp_id = em.id::text
     where em.restaurant is not distinct from rest and coalesce(em.status, 'active') = 'active'
       and _sa_num(_sa_act(el.data)->dkey->>'st') > 0;
    if not (c->>'id' = any(ids)) then ids := ids || (c->>'id'); end if;
  end if;
  me_on := c->>'id' = any(ids);
  for r in
    select em.id::text as id, em.name, coalesce(em.surname, '') as surname, lower(coalesce(em.position, '')) as position,
           coalesce(_sa_act(el.data)->dkey, '{}'::jsonb) as day, el.updated_at
      from employees em left join emp_learning el on el.emp_id = em.id::text
     where em.id::text = any(ids)
     order by em.name, em.surname
     limit 60
  loop
    people := people || jsonb_build_object('id', r.id, 'name', r.name, 'initial', left(r.surname, 1), 'position', r.position, 'me', r.id = c->>'id',
      'steps', _sa_num(r.day->>'st')::int, 'warm', _sa_num(r.day->>'w')::int, 'guest', _sa_num(r.day->>'g')::int, 'synced', r.updated_at is not null);
    d_steps := d_steps + _sa_num(r.day->>'st')::int; d_warm := d_warm + _sa_num(r.day->>'w')::int; d_guest := d_guest + _sa_num(r.day->>'g')::int;
  end loop;
  n := greatest(jsonb_array_length(people), 1);
  g_warm := n; g_steps := 2 * n; g_guest := greatest(1, round(n / 3.0)::int);
  return jsonb_build_object('ok', true, 'date', dkey, 'restaurant', rest, 'known', known, 'me_on', me_on, 'people', people,
    'goal', jsonb_build_object('warm', g_warm, 'steps', g_steps, 'guest', g_guest),
    'done', jsonb_build_object('warm', d_warm, 'steps', d_steps, 'guest', d_guest),
    'complete', d_warm >= g_warm and d_steps >= g_steps and d_guest >= g_guest);
end; $$;

-- ── 2) Лига недели и Кубок заведений ─────────────────────────────────────────
create or replace function league_week(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; ld date; ws date; f text; t text; base jsonb; rows jsonb; cup jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  ld := (now() at time zone _sa_tz(c->>'restaurant'))::date;
  ws := ld - (extract(isodow from ld)::int - 1);
  f := to_char(ws, 'YYYY-MM-DD'); t := to_char(ld, 'YYYY-MM-DD');
  select coalesce(jsonb_agg(jsonb_build_object('id', em.id::text, 'name', em.name, 'surname', coalesce(em.surname, ''),
           'restaurant', em.restaurant, 'position', lower(coalesce(em.position, '')),
           'pts', _sa_points_between(el.data, f, t),
           'days', (select count(*) from generate_series(ws, ld, interval '1 day') g
                     where _sa_day_points(_sa_act(el.data)->to_char(g, 'YYYY-MM-DD')) > 0),
           'me', em.id::text = c->>'id')), '[]'::jsonb)
    into base
    from employees em left join emp_learning el on el.emp_id = em.id::text
   where coalesce(em.status, 'active') = 'active' and not coalesce(em.is_admin, false);
  select coalesce(jsonb_agg(x order by (x->>'pts')::int desc, x->>'name', x->>'surname'), '[]'::jsonb) into rows
    from (select x from jsonb_array_elements(base) x where (x->>'pts')::int > 0 or (x->>'me')::boolean
           order by (x->>'pts')::int desc limit 500) s;
  select coalesce(jsonb_agg(jsonb_build_object('restaurant', r.restaurant, 'people', r.people, 'active', r.active, 'pts', r.pts, 'avg', r.avg,
           'mine', r.restaurant is not distinct from c->>'restaurant') order by r.avg desc, r.restaurant), '[]'::jsonb)
    into cup
    from (select x->>'restaurant' as restaurant, count(*) as people, count(*) filter (where (x->>'pts')::int > 0) as active,
                 sum((x->>'pts')::int)::int as pts, round(sum((x->>'pts')::int)::numeric / greatest(count(*), 1), 1) as avg
            from jsonb_array_elements(base) x where coalesce(x->>'restaurant', '') <> '' group by 1) r;
  return jsonb_build_object('ok', true, 'week_start', f, 'today', t, 'restaurant', c->>'restaurant', 'rows', rows, 'cup', cup);
end; $$;

-- ── 3) Свеча на двоих ────────────────────────────────────────────────────────
create table if not exists sa_pairs (
  id          bigserial primary key,
  a           text not null,                 -- кто позвал
  b           text not null,                 -- кого позвали
  restaurant  text,
  status      text not null default 'invited' check (status in ('invited', 'active', 'declined', 'ended', 'cancelled')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  ended_at    timestamptz
);
create index if not exists sa_pairs_a on sa_pairs (a, status);
create index if not exists sa_pairs_b on sa_pairs (b, status);
alter table sa_pairs enable row level security;
revoke all on sa_pairs from public, anon, authenticated;

-- Пары, где кого-то из двоих больше нет в команде (удалён, уволен, в архиве), гаснут сами:
-- иначе второй навсегда остался бы «в паре» и не мог позвать никого другого (ревью v30).
create or replace function _sa_pairs_tidy()
returns void language sql security definer set search_path to public as $$
  update sa_pairs p
     set status = case when p.status = 'active' then 'ended' else 'cancelled' end, ended_at = now()
   where p.status in ('active', 'invited')
     and (not exists (select 1 from employees em where em.id::text = p.a and coalesce(em.status, 'active') = 'active')
       or not exists (select 1 from employees em where em.id::text = p.b and coalesce(em.status, 'active') = 'active'));
$$;

create or replace function _sa_emp_brief(p_id text)
returns jsonb language sql stable security definer set search_path to public as $$
  select jsonb_build_object('id', em.id::text, 'name', em.name, 'surname', coalesce(em.surname, ''), 'position', lower(coalesce(em.position, '')),
                            'lead', coalesce(em.is_admin, false) or lower(coalesce(em.position, '')) in ('manager', 'senior'))
    from employees em where em.id::text = p_id limit 1
$$;

create or replace function pair_candidates(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rows jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  perform _sa_pairs_tidy();
  select coalesce(jsonb_agg(jsonb_build_object('id', em.id::text, 'name', em.name, 'surname', coalesce(em.surname, ''),
           'position', lower(coalesce(em.position, '')),
           'lead', lower(coalesce(em.position, '')) in ('manager', 'senior'),
           'busy', exists (select 1 from sa_pairs p where p.status = 'active' and (p.a = em.id::text or p.b = em.id::text)))
           order by em.name, em.surname), '[]'::jsonb)
    into rows
    from employees em
   where em.restaurant is not distinct from c->>'restaurant' and coalesce(em.status, 'active') = 'active'
     and not coalesce(em.is_admin, false) and em.id::text <> c->>'id';
  return jsonb_build_object('ok', true, 'rows', rows);
end; $$;

create or replace function pair_invite(p_token text, p_emp text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; me text; e record; back record; nid bigint;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  me := c->>'id';
  perform _sa_pairs_tidy();
  if exists (select 1 from sa_pairs where status = 'active' and (a = me or b = me)) then return jsonb_build_object('ok', false, 'error', 'have_pair'); end if;
  select em.id::text as id, em.restaurant, coalesce(em.status, 'active') as status, coalesce(em.is_admin, false) as adm into e
    from employees em where em.id::text = btrim(coalesce(p_emp, '')) limit 1;
  if e.id is null or e.status <> 'active' or e.adm then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if e.id = me then return jsonb_build_object('ok', false, 'error', 'self'); end if;
  if e.restaurant is distinct from c->>'restaurant' then return jsonb_build_object('ok', false, 'error', 'other_restaurant'); end if;
  if exists (select 1 from sa_pairs where status = 'active' and (a = e.id or b = e.id)) then return jsonb_build_object('ok', false, 'error', 'busy'); end if;
  -- встречное приглашение — сразу пара
  select * into back from sa_pairs where status = 'invited' and a = e.id and b = me order by id desc limit 1;
  if back.id is not null then
    update sa_pairs set status = 'active', answered_at = now() where id = back.id;
    update sa_pairs set status = 'cancelled', ended_at = now() where status = 'invited' and id <> back.id and (a in (me, e.id) or b in (me, e.id));
    return jsonb_build_object('ok', true, 'id', back.id, 'status', 'active');
  end if;
  -- своё прежнее приглашение — отзываем, одно за раз
  update sa_pairs set status = 'cancelled', ended_at = now() where status = 'invited' and a = me;
  insert into sa_pairs (a, b, restaurant) values (me, e.id, c->>'restaurant') returning id into nid;
  return jsonb_build_object('ok', true, 'id', nid, 'status', 'invited');
end; $$;

create or replace function pair_answer(p_token text, p_id bigint, p_accept boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; me text; r record;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  me := c->>'id';
  perform _sa_pairs_tidy();
  select * into r from sa_pairs where id = p_id;
  if r.id is null or r.b <> me then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if r.status <> 'invited' then return jsonb_build_object('ok', false, 'error', 'already', 'status', r.status); end if;
  if not coalesce(p_accept, false) then
    update sa_pairs set status = 'declined', answered_at = now() where id = r.id;
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;
  if exists (select 1 from sa_pairs where status = 'active' and (a in (r.a, r.b) or b in (r.a, r.b))) then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;
  update sa_pairs set status = 'active', answered_at = now() where id = r.id;
  update sa_pairs set status = 'cancelled', ended_at = now() where status = 'invited' and id <> r.id and (a in (r.a, r.b) or b in (r.a, r.b));
  return jsonb_build_object('ok', true, 'status', 'active');
end; $$;

create or replace function pair_end(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; me text; n int; m int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  me := c->>'id';
  update sa_pairs set status = 'ended', ended_at = now() where status = 'active' and (a = me or b = me);
  get diagnostics n = row_count;
  update sa_pairs set status = 'cancelled', ended_at = now() where status = 'invited' and a = me;
  get diagnostics m = row_count;
  return jsonb_build_object('ok', true, 'ended', n, 'cancelled', m);
end; $$;

create or replace function pair_status(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; me text; r record; partner text; da jsonb; db jsonb; ld date; dkey text; days jsonb := '[]'::jsonb; i int;
  pair jsonb := null; ins jsonb; outv jsonb := null; tz text; since date; sa jsonb; sb jsonb; k text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  me := c->>'id';
  perform _sa_pairs_tidy();
  tz := _sa_tz(c->>'restaurant');
  ld := (now() at time zone tz)::date; dkey := to_char(ld, 'YYYY-MM-DD');
  select * into r from sa_pairs where status = 'active' and (a = me or b = me) order by id desc limit 1;
  if r.id is not null then
    partner := case when r.a = me then r.b else r.a end;
    select data into da from emp_learning where emp_id = me;
    select data into db from emp_learning where emp_id = partner;
    da := coalesce(da, '{}'::jsonb); db := coalesce(db, '{}'::jsonb);
    since := least(ld, (coalesce(r.answered_at, r.created_at) at time zone tz)::date);
    -- выходные по графику заведения: за неделю на экране и за всю серию
    sa := _sa_emp_sched(me, least(since, ld - 6), ld);
    sb := _sa_emp_sched(partner, least(since, ld - 6), ld);
    for i in reverse 6..0 loop
      k := to_char(ld - i, 'YYYY-MM-DD');
      days := days || jsonb_build_object('d', k, 'me', _sa_day_mark(da, k, sa), 'partner', _sa_day_mark(db, k, sb));
    end loop;
    pair := jsonb_build_object('id', r.id, 'since', to_char(since, 'YYYY-MM-DD'), 'inviter', r.a = me,
      'partner', _sa_emp_brief(partner),
      'partner_today', jsonb_build_object('steps', _sa_num(_sa_act(db)->dkey->>'st')::int, 'warm', _sa_num(_sa_act(db)->dkey->>'w')::int,
                                          'state', _sa_day_mark(db, dkey, sb), 'shift', sb->dkey),
      'me_today', jsonb_build_object('steps', _sa_num(_sa_act(da)->dkey->>'st')::int, 'state', _sa_day_mark(da, dkey, sa), 'shift', sa->dkey),
      'streak', _sa_pair_run(da, db, sa, sb, since, ld),
      'days', days);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'from', _sa_emp_brief(p.a), 'created_at', p.created_at) order by p.id desc), '[]'::jsonb)
    into ins from sa_pairs p where p.status = 'invited' and p.b = me;
  select jsonb_build_object('id', p.id, 'to', _sa_emp_brief(p.b), 'created_at', p.created_at) into outv
    from sa_pairs p where p.status = 'invited' and p.a = me order by p.id desc limit 1;
  return jsonb_build_object('ok', true, 'today', dkey, 'pair', pair, 'invites', ins, 'outgoing', outv);
end; $$;

-- ── 4) Права ─────────────────────────────────────────────────────────────────
revoke all on function _sa_tz() from public, anon, authenticated;
revoke all on function _sa_tz(text) from public, anon, authenticated;
revoke all on function _sa_num(text) from public, anon, authenticated;
revoke all on function _sa_day_mark(jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function _sa_pair_run(jsonb, jsonb, jsonb, jsonb, date, date) from public, anon, authenticated;
revoke all on function _sa_emp_sched(text, date, date) from public, anon, authenticated;
revoke all on function _sa_pairs_tidy() from public, anon, authenticated;
revoke all on function _sa_day_points(jsonb) from public, anon, authenticated;
revoke all on function _sa_act(jsonb) from public, anon, authenticated;
revoke all on function _sa_points_between(jsonb, text, text) from public, anon, authenticated;
revoke all on function _sa_day_state(jsonb, text) from public, anon, authenticated;
revoke all on function _sa_pair_streak(jsonb, jsonb, date, date) from public, anon, authenticated;
revoke all on function _sa_on_shift(text, date) from public, anon, authenticated;
revoke all on function _sa_emp_brief(text) from public, anon, authenticated;
grant execute on function quest_today(text) to anon, authenticated;
grant execute on function league_week(text) to anon, authenticated;
grant execute on function pair_candidates(text) to anon, authenticated;
grant execute on function pair_invite(text, text) to anon, authenticated;
grant execute on function pair_answer(text, bigint, boolean) to anon, authenticated;
grant execute on function pair_end(text) to anon, authenticated;
grant execute on function pair_status(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 5) Проверка ──────────────────────────────────────────────────────────────
select 'вместе: ' || (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname in ('quest_today', 'league_week', 'pair_candidates', 'pair_invite', 'pair_answer', 'pair_end', 'pair_status'))
       || ' функций из 7, таблица пар: ' || (case when to_regclass('public.sa_pairs') is not null then 'есть' else 'нет' end)
       || case when to_regclass('public.emp_learning') is null then ' · ВНИМАНИЕ: нет этапа 23 (emp_learning)' else '' end as result;
