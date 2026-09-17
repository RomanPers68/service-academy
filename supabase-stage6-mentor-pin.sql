-- supabase-stage6-mentor-pin-FIX.sql
-- Самодостаточная версия этапа 6: включает в себя таблицу подтверждений
-- из этапа 2 (create table if not exists — если stage 2 когда-нибудь
-- применялся, ничего не задублируется). Вставить целиком → Run.

-- ── 0. Таблица подтверждений навыков (из stage 2, сразу с колонкой verified) ─
create table if not exists skill_confirmations (
  id bigint generated always as identity primary key,
  session_token text,          -- токен сессии сотрудника (sa_session_token)
  role_id text not null,       -- spg / seasonal / core / manager / service_manager
  skill_id text not null,      -- id навыка из data/skills.js
  skill_label text,            -- название навыка (на момент подтверждения)
  mentor text not null,        -- имя наставника
  confirmed_on date not null,
  verified boolean default false,  -- true = заверено PIN через сервер
  created_at timestamptz default now()
);

create unique index if not exists skill_conf_uniq
  on skill_confirmations (session_token, role_id, skill_id);

-- На случай, если таблица уже существовала со времён stage 2 без verified:
alter table skill_confirmations add column if not exists verified boolean default false;

-- ── 0б. Запасной RPC «по фамилии» (из stage 2) — его использует старый режим ─
create or replace function confirm_skill(
  p_token text, p_role text, p_skill text, p_skill_label text, p_mentor text, p_date date
) returns json
language plpgsql security definer as $$
begin
  insert into skill_confirmations (session_token, role_id, skill_id, skill_label, mentor, confirmed_on)
  values (p_token, p_role, p_skill, p_skill_label, p_mentor, p_date)
  on conflict (session_token, role_id, skill_id)
  do update set mentor = excluded.mentor, confirmed_on = excluded.confirmed_on, skill_label = excluded.skill_label;
  return json_build_object('ok', true);
end; $$;

-- ── 1. PIN у сотрудника (храним только md5-хеш, не сам PIN) ──────────────────
alter table employees add column if not exists mentor_pin text;

-- ── 2. Наставник задаёт себе PIN из своего профиля в приложении ─────────────
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

-- ── 3. Подтверждение навыка по PIN ───────────────────────────────────────────
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
