-- supabase-stage13-permanent-codes.sql — Этап 13: постоянные коды входа (Дополнение 176).
--
-- Было: любой код сгорает при первом входе (used_at) — правильно для сотрудников,
-- но владельцу нужен код, которым можно входить снова: Telegram, Safari на экране
-- «Домой», новый телефон.
-- Стало: у кода признак permanent. Постоянный код не гасится — каждый вход просто
-- создаёт новую сессию. Одноразовые работают как раньше.
-- Плюс две команды ТОЛЬКО для SQL Editor (anon-ключу недоступны — иначе любой мог бы
-- выпускать себе коды):
--   select owner_issue_code('Фамилия');           -- постоянный код сотруднику с такой фамилией
--   select owner_issue_code('Фамилия', false);    -- одноразовый
--   select owner_revoke_codes('Фамилия');         -- погасить ВСЕ коды сотрудника (если утёк)
-- Безвреден повторно.

alter table access_codes add column if not exists permanent boolean not null default false;

create or replace function redeem_code(p_code text)
returns json language plpgsql security definer
set search_path to 'public', 'extensions' as $$
declare v_code record; v_emp record; v_token uuid;
begin
  select ac.* into v_code
  from access_codes ac
  where (ac.used_at is null or ac.permanent)
    and ac.code_hash = crypt(upper(trim(p_code)), ac.code_hash)
  order by ac.permanent desc, ac.created_at desc
  limit 1;

  if v_code is null then
    return json_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_emp from employees
  where id = v_code.employee_id and status = 'active';
  if v_emp is null then
    return json_build_object('ok', false, 'error', 'disabled');
  end if;

  if not v_code.permanent then
    update access_codes set used_at = now() where id = v_code.id;
  end if;
  insert into sessions(employee_id) values (v_emp.id) returning token into v_token;
  update employees set last_seen_at = now() where id = v_emp.id;

  return json_build_object('ok', true, 'token', v_token,
    'employee', json_build_object(
      'id', v_emp.id, 'name', v_emp.name, 'surname', v_emp.surname,
      'restaurant', v_emp.restaurant, 'position', v_emp.position,
      'is_admin', v_emp.is_admin));
end $$;

-- Выдать код по фамилии (если однофамильцы — берёт владельца/менеджера первым; уточни именем: 'Фамилия Имя')
create or replace function owner_issue_code(p_who text, p_permanent boolean default true)
returns text language plpgsql security definer
set search_path to 'public', 'extensions' as $$
declare v_emp record; v_code text := ''; chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
        v_surname text; v_name text;
begin
  v_surname := lower(trim(split_part(trim(p_who), ' ', 1)));
  v_name := lower(trim(split_part(trim(p_who), ' ', 2)));
  select * into v_emp from employees
  where lower(surname) = v_surname and (v_name = '' or lower(name) = v_name) and status = 'active'
  order by is_admin desc, created_at asc limit 1;
  if v_emp is null then
    raise exception 'Активный сотрудник «%» не найден (пиши «Фамилия» или «Фамилия Имя»)', p_who;
  end if;
  for i in 1..8 loop
    v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
  insert into access_codes (id, employee_id, code_hash, used_at, created_at, permanent)
  values (gen_random_uuid(), v_emp.id, crypt(upper(v_code), gen_salt('bf')), null, now(), p_permanent);
  return v_emp.name || ' ' || v_emp.surname || ' → ' || v_code
    || case when p_permanent then '  (постоянный — не сгорает)' else '  (одноразовый)' end;
end $$;

-- Погасить все коды сотрудника (постоянные тоже). Сессии, где он уже вошёл, остаются.
create or replace function owner_revoke_codes(p_who text)
returns text language plpgsql security definer
set search_path to 'public', 'extensions' as $$
declare v_emp record; n int; v_surname text; v_name text;
begin
  v_surname := lower(trim(split_part(trim(p_who), ' ', 1)));
  v_name := lower(trim(split_part(trim(p_who), ' ', 2)));
  select * into v_emp from employees
  where lower(surname) = v_surname and (v_name = '' or lower(name) = v_name)
  order by is_admin desc, created_at asc limit 1;
  if v_emp is null then raise exception 'Сотрудник «%» не найден', p_who; end if;
  update access_codes set used_at = now(), permanent = false
  where employee_id = v_emp.id and (used_at is null or permanent);
  get diagnostics n = row_count;
  return v_emp.name || ' ' || v_emp.surname || ': погашено кодов — ' || n;
end $$;

-- Только из SQL Editor: снаружи (anon-ключом) эти две функции недоступны
revoke all on function owner_issue_code(text, boolean) from public, anon, authenticated;
revoke all on function owner_revoke_codes(text) from public, anon, authenticated;

select 'постоянные коды: ' || (select count(*) from access_codes where permanent) ||
       ' · функции: ' || (select count(*) from pg_proc where proname in ('redeem_code','owner_issue_code','owner_revoke_codes')) || ' из 3' as result;
