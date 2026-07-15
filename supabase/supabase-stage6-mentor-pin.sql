-- supabase-stage6-mentor-pin.sql
-- Этап 6: PIN наставника — серверная проверка подтверждений навыков.
-- Применить: Supabase → SQL Editor → вставить целиком и выполнить (Run).
--
-- Зачем: раньше допуск подтверждался фамилией, вписанной в телефоне самого
-- сотрудника, — это легко накрутить. Теперь наставник вводит свой личный PIN,
-- сервер сам находит наставника по PIN и записывает подтверждение его именем.
-- Приложение работает и БЕЗ этого скрипта: пока функций нет, оно автоматически
-- откатывается на старый режим «по фамилии» (та же философия, что в stage 2).
--
-- ⚠️ Предположения о схеме (как в stage 5): таблица employees с колонками
-- id, name, surname, "position", is_admin, restaurant. Если колонка должности
-- называется иначе — поправь e."position" в двух местах ниже.

-- ── 1. PIN у сотрудника (храним только md5-хеш, не сам PIN) ──────────────────
alter table employees add column if not exists mentor_pin text;

-- ── 2. Отметка «заверено сервером» у подтверждений (таблица из stage 2) ─────
alter table skill_confirmations add column if not exists verified boolean default false;

-- ── 3. Наставник задаёт себе PIN из своего профиля в приложении ─────────────
-- Разрешено только руководящему составу: senior / manager / админ.
create or replace function set_mentor_pin(p_token text, p_pin text)
returns json language plpgsql security definer as $$
declare v jsonb; v_pos text; v_admin boolean; v_name text; v_surname text;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  v_pos     := v->'employee'->>'position';
  v_admin   := coalesce((v->'employee'->>'is_admin')::boolean, false);
  v_name    := v->'employee'->>'name';
  v_surname := coalesce(v->'employee'->>'surname', '');

  if not (v_admin or v_pos in ('senior', 'manager')) then
    return json_build_object('ok', false, 'error', 'not_mentor');
  end if;
  if p_pin !~ '^[0-9]{4,6}$' then
    return json_build_object('ok', false, 'error', 'bad_format');
  end if;

  update employees
     set mentor_pin = md5(p_pin)
   where name = v_name and coalesce(surname, '') = v_surname;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  return json_build_object('ok', true);
end; $$;

-- ── 4. Подтверждение навыка по PIN ───────────────────────────────────────────
-- Сотрудник передаёт телефон наставнику → наставник вводит PIN → сервер ищет
-- наставника по PIN в ТОМ ЖЕ ресторане (админ — в любом), проверяет, что это
-- не сам сотрудник, и записывает подтверждение именем наставника с verified=true.
create or replace function confirm_skill_pin(
  p_token text, p_role text, p_skill text, p_skill_label text, p_pin text, p_date date
) returns json language plpgsql security definer as $$
declare
  v jsonb; v_rest text; v_name text; v_surname text;
  m record;
begin
  v := to_jsonb(whoami(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  v_rest    := v->'employee'->>'restaurant';
  v_name    := v->'employee'->>'name';
  v_surname := coalesce(v->'employee'->>'surname', '');

  if p_pin !~ '^[0-9]{4,6}$' then
    return json_build_object('ok', false, 'error', 'bad_pin');
  end if;

  select e.name, e.surname into m
    from employees e
   where e.mentor_pin = md5(p_pin)
     and (coalesce(e.is_admin, false) or e."position" in ('senior', 'manager'))
     and (coalesce(e.is_admin, false) or e.restaurant = v_rest)
     and not (e.name = v_name and coalesce(e.surname, '') = v_surname)  -- сам себе не наставник
   limit 1;

  if m is null then
    return json_build_object('ok', false, 'error', 'bad_pin');
  end if;

  insert into skill_confirmations (session_token, role_id, skill_id, skill_label, mentor, confirmed_on, verified)
  values (p_token, p_role, p_skill, p_skill_label,
          trim(concat_ws(' ', m.name, m.surname)), p_date, true)
  on conflict (session_token, role_id, skill_id)
  do update set mentor = excluded.mentor,
                confirmed_on = excluded.confirmed_on,
                skill_label = excluded.skill_label,
                verified = true;

  return json_build_object('ok', true, 'mentor', trim(concat_ws(' ', m.name, m.surname)));
end; $$;
