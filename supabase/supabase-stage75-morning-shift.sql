-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 75 (Доп. 547): «Утро руководителя» менеджеру — только в дни его смен
--
-- После этапа 40 сводку на утро получали все руководители каждый день, и менеджеры тоже, в выходной в том числе.
-- Менеджерам это не нравилось. Теперь управляющему, директору и владельцу сводка приходит каждый день, как раньше,
-- а менеджеру — только когда у него сегодня смена по графику (кейтеринг тоже смена). В выходной и в отпуске — нет.
--
-- Это умолчание по должности. Каждый может выбрать сам: «Утро руководителя» → «Каждое утро в Telegram» → «Каждый
-- день» или «Только в мои смены» (sa_notify_prefs.morning_shift; пусто — по должности). Кого нет в графике этого
-- месяца (графика нет, имя не нашлось, месяц для него ещё не составлен), тому сводка приходит каждый день, как
-- раньше: лучше лишняя, чем пропавшая. «Прислать сейчас» работает всегда. Выходной, а смену поставили в окне
-- отправки (с выбранного часа и три часа после) — сводка придёт со следующего запуска.
--
-- _sa_morning_day(сотрудник, заведение, день) — что у человека в графике: shift (смена), vac (отпуск), off (выходной)
-- или пусто (не знаем); _sa_morning_due — кому пора, теперь с этой проверкой; _sa_morning_prefs — ещё shift
-- (только в смены) и today (что сегодня по графику) для приложения; morning_shift_set(p_token, p_shift) — выбор.
--
-- Нужны этапы 38 и 40. Ничего не удаляет. Безвреден повторно.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_morning_due(boolean,timestamptz)') is null or to_regprocedure('public._sa_morning_prefs(text)') is null then
    raise exception 'Сначала этап 40 (supabase-stage40-morning.sql): «Утро руководителя»';
  end if;
  if to_regprocedure('public._sa_sh_staff(jsonb,text,text)') is null or to_regprocedure('public._sa_sh_code(text,text,date,jsonb)') is null then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужен график';
  end if;
end $$;

-- ── 1) Свой выбор: только в дни смен или каждый день (пусто — по должности) ─────────────────────────────────────────
alter table sa_notify_prefs add column if not exists morning_shift boolean;

-- только в дни смен: как выбрал сам, а не выбирал — менеджеру да (если он не владелец), остальным нет
create or replace function _sa_morning_shift_only(p_pos text, p_admin boolean, p_pick boolean)
returns boolean language sql immutable set search_path to public as $$
  select coalesce(p_pick, lower(coalesce(p_pos, '')) = 'manager' and not coalesce(p_admin, false))
$$;

-- ── 2) Что у человека в графике в этот день ─────────────────────────────────────────────────────────────────────────
-- shift — смена (любая, кейтеринг тоже), vac — отпуск, off — выходной; пусто — не знаем: графика нет, имени в графике
-- нет или месяц для него ещё не составлен (ни одной смены за месяц). Строку графика ищет как очередь и чат (этап 38).
create or replace function _sa_morning_day(p_emp text, p_rest text, p_day date)
returns text language plpgsql stable security definer set search_path to public as $$
declare cfg jsonb; mk text := to_char(p_day, 'YYYY-MM'); dn int := extract(day from p_day)::int; s jsonb; r jsonb; pr jsonb;
begin
  cfg := _sa_sh_cfg(p_rest);
  if cfg is null or p_day is null then return ''; end if;
  s := _sa_sh_staff(cfg, p_emp, mk);
  if s is null then return ''; end if;
  if _sa_sh_def(cfg, _sa_sh_code(p_rest, s->>'id', p_day)) is not null then return 'shift'; end if;
  if jsonb_typeof(s->'vacs'->mk) = 'array' then
    for r in select x from jsonb_array_elements(s->'vacs'->mk) x loop
      if jsonb_typeof(r) = 'array' and _sa_num(r->>0) > 0 and dn >= _sa_num(r->>0) and dn <= greatest(_sa_num(r->>1), _sa_num(r->>0)) then return 'vac'; end if;
    end loop;
  elsif jsonb_typeof(s->'vac') = 'array' and s->'vac'->>2 = mk and _sa_num(s->'vac'->>0) > 0
        and dn >= _sa_num(s->'vac'->>0) and dn <= greatest(_sa_num(s->'vac'->>1), _sa_num(s->'vac'->>0)) then
    return 'vac';
  end if;
  select m.payload->'plan'->(s->>'id') into pr
    from schedule_months m where m.restaurant = p_rest and m.venue_key = 'main' and m.month = mk;
  if jsonb_typeof(pr) is distinct from 'object'
     or not exists (select 1 from jsonb_each(pr) x where jsonb_typeof(x.value) = 'string' and _sa_sh_def(cfg, x.value #>> '{}') is not null) then
    return '';
  end if;
  return 'off';
exception when others then
  return '';
end; $$;

-- ── 3) Настройки для приложения: ещё shift и today ──────────────────────────────────────────────────────────────────
create or replace function _sa_morning_prefs(p_emp text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare p sa_notify_prefs; e employees; linked boolean := false; on_ boolean := false;
begin
  select * into p from sa_notify_prefs where emp_id = p_emp;
  select true, remind into linked, on_ from tg_links where emp_id = p_emp;
  select * into e from employees em where em.id::text = p_emp;
  return jsonb_build_object('on', coalesce(p.morning, true), 'hour', coalesce(p.morning_hour, 9), 'linked', coalesce(linked, false) and coalesce(on_, false),
    'bot', _sa_tg_ready(), 'shift', _sa_morning_shift_only(e.position, e.is_admin, p.morning_shift),
    'today', case when e.id is null then '' else _sa_morning_day(p_emp, e.restaurant, (now() at time zone _sa_tz(e.restaurant))::date) end);
end; $$;

create or replace function morning_shift_set(p_token text, p_shift boolean default null)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  insert into sa_notify_prefs (emp_id) values (c->>'id') on conflict do nothing;
  update sa_notify_prefs set morning_shift = p_shift, updated_at = now() where emp_id = c->>'id';
  return jsonb_build_object('ok', true, 'prefs', _sa_morning_prefs(c->>'id'));
end; $$;

-- ── 4) По расписанию: кому пора — как этап 40, плюс дни смен ────────────────────────────────────────────────────────
-- Только в дни смен, а сегодня по графику выходной или отпуск — не шлём и отметку «отправлено» не ставим: смену
-- поставили позже, пока окно не кончилось, — сводка уйдёт со следующего запуска.
create or replace function _sa_morning_due(p_send boolean, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path to public as $$
declare e record; tz text; lnow timestamp; ld date; hr int; b jsonb; out jsonb := '[]'::jsonb;
begin
  if not _sa_tg_ready() then return out; end if;
  for e in select tl.emp_id, tl.chat_id, em.restaurant, em.name, coalesce(np.morning, true) as on_, coalesce(np.morning_hour, 9) as hr,
                  _sa_morning_shift_only(em.position, em.is_admin, np.morning_shift) as shift_only
             from tg_links tl join employees em on em.id::text = tl.emp_id left join sa_notify_prefs np on np.emp_id = tl.emp_id
            where tl.remind and coalesce(em.status, 'active') = 'active'
              and (coalesce(em.is_admin, false) or lower(coalesce(em.position, '')) = any (_sa_chat_lead_pos())) loop
    if not e.on_ then continue; end if;
    tz := _sa_tz(e.restaurant);
    lnow := p_now at time zone tz; ld := lnow::date; hr := extract(hour from lnow)::int;
    if hr < e.hr or hr >= e.hr + 3 then continue; end if;
    if _sa_tg_was(e.emp_id, ld, 'morning') then continue; end if;
    if e.shift_only and _sa_morning_day(e.emp_id, e.restaurant, ld) in ('off', 'vac') then continue; end if;
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

-- ── 5) Права ───────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function _sa_morning_shift_only(text, boolean, boolean), _sa_morning_day(text, text, date), _sa_morning_prefs(text),
  _sa_morning_due(boolean, timestamptz) from public, anon, authenticated;
revoke all on function morning_shift_set(text, boolean) from public;
grant execute on function morning_shift_set(text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

select 'Утро руководителя: менеджеру — в дни его смен по графику · руководители с Telegram: каждый день — '
  || count(*) filter (where not x.so) || ', только в дни смен — ' || count(*) filter (where x.so) as result
  from (select _sa_morning_shift_only(em.position, em.is_admin, np.morning_shift) as so
          from tg_links tl join employees em on em.id::text = tl.emp_id left join sa_notify_prefs np on np.emp_id = tl.emp_id
         where tl.remind and coalesce(em.status, 'active') = 'active'
           and (coalesce(em.is_admin, false) or lower(coalesce(em.position, '')) = any (_sa_chat_lead_pos()))) x;
