-- supabase-stage8-candidates.sql — Этап 8: облако результатов собеседований.
-- Результаты кандидатов больше не живут только в localStorage телефона:
-- каждый сохраняется на сервер (в рамках ресторана менеджера), история
-- переживает смену телефона и видна всем админам этого ресторана.
-- Связка токен→сотрудник — через вашу же функцию whoami_txt(p_token).
-- Запускается один раз в SQL-редакторе Supabase. Ничего адаптировать не нужно.

create table if not exists candidate_results (
  id bigserial primary key,
  restaurant text not null,
  payload jsonb not null,          -- запись целиком в формате приложения
  created_by text,                 -- кто проводил собеседование
  created_at timestamptz default now()
);
create index if not exists candidate_results_rest_idx
  on candidate_results (restaurant, created_at desc);

-- Сохранить результат собеседования (только админ своего ресторана)
-- ── Переходник whoami_txt(text) — как в этапе 11c ────────────────────────────
-- На этой базе whoami принимает токен не текстом (например, uuid), и прямой вызов
-- whoami(p_token) с текстом падает: «function whoami(text) does not exist» (Доп. 155,
-- этап 11c; в этом файле вызовы переведены на переходник в правке 151,
-- чтобы повторный запуск не ломал функции, уже починенные этапом 11c). Все функции ниже зовут
-- whoami_txt(p_token). Если переходника нет — создаём по фактической подписи whoami;
-- если есть — не трогаем.
do $$
declare t0 text;
begin
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
              where ns.nspname = 'public' and p.proname = 'whoami_txt') then
    return;
  end if;
  select format_type(p.proargtypes[0], null) into t0
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'whoami'
   order by p.pronargs limit 1;
  if t0 is null then
    raise exception 'whoami в схеме public не найдена — пришли это сообщение разработчику';
  end if;
  execute format('create or replace function public.whoami_txt(p_token text) returns jsonb '
                 'language sql stable security definer as $f$ select to_jsonb(public.whoami(p_token::%s)) $f$', t0);
end $$;

create or replace function candidate_save(p_token text, p_restaurant text, p_result text)
returns json language plpgsql security definer as $$
declare v jsonb; v_employee text; v_id bigint;
begin
  v := to_jsonb(whoami_txt(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if coalesce((v->'employee'->>'is_admin')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  v_employee := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));

  insert into candidate_results (restaurant, payload, created_by)
  values (p_restaurant, p_result::jsonb, v_employee)
  returning id into strict v_id;
  return json_build_object('ok', true, 'id', v_id);
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end; $$;

-- Список результатов ресторана (только админ)
create or replace function candidate_list(p_token text, p_restaurant text)
returns json language plpgsql security definer as $$
declare v jsonb;
begin
  v := to_jsonb(whoami_txt(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if coalesce((v->'employee'->>'is_admin')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  return json_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'payload', payload, 'created_by', created_by, 'created_at', created_at
    ) order by created_at desc)
    from (
      select * from candidate_results
      where restaurant = p_restaurant
      order by created_at desc
      limit 100
    ) t
  ), '[]'::jsonb));
end; $$;

-- Удалить запись (только админ, только своего ресторана)
create or replace function candidate_delete(p_token text, p_restaurant text, p_id bigint)
returns json language plpgsql security definer as $$
declare v jsonb;
begin
  v := to_jsonb(whoami_txt(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if coalesce((v->'employee'->>'is_admin')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  delete from candidate_results where id = p_id and restaurant = p_restaurant;
  return json_build_object('ok', true);
end; $$;
