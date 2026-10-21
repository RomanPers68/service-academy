-- supabase-stage28-ai-hr.sql — Этап 28 (v66, Дополнение 379): AI HR без «беты».
--
-- Что добавляет:
--   1) candidate_decide — «Ваше решение» по кандидату (Берём / Подумаю / Не берём) прямо в записи собеседования.
--      По этим отметкам приложение считает, насколько ИИ совпадает с руководителем (условие снятия «беты»:
--      на последних 20 собеседованиях с решением — совпадение 80% и больше).
--   2) hr_quality_save / hr_quality_get — итог «Проверки AI HR» на эталонных собеседованиях, один на ресторан:
--      кто бы из руководителей ни запустил проверку, «бета» снимается у всех.
--   3) candidate_save / candidate_list / candidate_delete — ресторан теперь сверяется с профилем того, кто зовёт.
--      Раньше функции верили ресторану из запроса: руководитель другого заведения сети мог прочитать или удалить
--      чужую историю собеседований, подставив название. Для своих — всё как было.
-- Права — как в этапе 8б: владелец (is_admin) или должность manager / senior.
-- Запусти целиком в SQL Editor. Повторный запуск безопасен. Этапы 8 и 8б перезапускать после этого не нужно
-- (иначе они вернут прежние функции без сверки ресторана — тогда просто запусти этот этап ещё раз).

-- ── Переходник whoami_txt(text) — как в этапах 8 и 11c (если его нет) ──────────────────────────
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

-- таблица истории собеседований — та же, что в этапе 8 (если этап 8 не запускали)
create table if not exists public.candidate_results (
  id bigserial primary key,
  restaurant text not null,
  payload jsonb not null,
  created_by text,
  created_at timestamptz default now()
);
create index if not exists candidate_results_rest_idx on public.candidate_results (restaurant, created_at desc);
alter table public.candidate_results enable row level security;
revoke all on public.candidate_results from public, anon, authenticated;

-- итог «Проверки AI HR»: одна строка на ресторан, напрямую не читается — только через функции ниже
create table if not exists public.hr_quality (
  restaurant text primary key,
  payload jsonb not null,
  updated_by text,
  updated_at timestamptz default now()
);
alter table public.hr_quality enable row level security;
revoke all on public.hr_quality from public, anon, authenticated;

-- ── кто зовёт: руководитель (владелец, manager, senior) → его ресторан и имя ────────────────────
create or replace function public._sa_hire_staff(p_token text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v jsonb;
begin
  v := to_jsonb(whoami_txt(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'auth');
  end if;
  if not ( coalesce((v->'employee'->>'is_admin')::boolean, false)
          or coalesce(v->'employee'->>'position', '') in ('manager', 'senior') ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  return jsonb_build_object('ok', true,
    'restaurant', v->'employee'->>'restaurant',
    'name', trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname')));
exception when others then
  return jsonb_build_object('ok', false, 'error', 'auth');
end $$;
revoke all on function public._sa_hire_staff(text) from public, anon, authenticated;

-- ── история собеседований: прежние функции + сверка ресторана ───────────────────────────────────
create or replace function public.candidate_save(p_token text, p_restaurant text, p_result text)
returns json language plpgsql security definer set search_path to public as $$
declare w jsonb; v_id bigint;
begin
  w := _sa_hire_staff(p_token);
  if (w->>'ok')::boolean is not true then return w::json; end if;
  if p_restaurant is distinct from (w->>'restaurant') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  insert into candidate_results (restaurant, payload, created_by)
  values (p_restaurant, (p_result::jsonb) - 'decSync' - 'srvId', w->>'name')
  returning id into strict v_id;
  return json_build_object('ok', true, 'id', v_id);
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end $$;

create or replace function public.candidate_list(p_token text, p_restaurant text)
returns json language plpgsql security definer set search_path to public as $$
declare w jsonb;
begin
  w := _sa_hire_staff(p_token);
  if (w->>'ok')::boolean is not true then return w::json; end if;
  if p_restaurant is distinct from (w->>'restaurant') then
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
end $$;

create or replace function public.candidate_delete(p_token text, p_restaurant text, p_id bigint)
returns json language plpgsql security definer set search_path to public as $$
declare w jsonb;
begin
  w := _sa_hire_staff(p_token);
  if (w->>'ok')::boolean is not true then return w::json; end if;
  if p_restaurant is distinct from (w->>'restaurant') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  delete from candidate_results where id = p_id and restaurant = p_restaurant;
  return json_build_object('ok', true);
end $$;

-- ── «Ваше решение» по кандидату: hire | maybe | reject, null — снять отметку ────────────────────
create or replace function public.candidate_decide(p_token text, p_restaurant text, p_id bigint, p_decision text)
returns json language plpgsql security definer set search_path to public as $$
declare w jsonb; n int;
begin
  w := _sa_hire_staff(p_token);
  if (w->>'ok')::boolean is not true then return w::json; end if;
  if p_restaurant is distinct from (w->>'restaurant') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_decision is not null and p_decision not in ('hire', 'maybe', 'reject') then
    return json_build_object('ok', false, 'error', 'bad_decision');
  end if;
  update candidate_results
     set payload = case
       when p_decision is null then payload - 'decision' - 'decidedAt' - 'decidedBy' - 'decSync'
       else (payload - 'decSync') || jsonb_build_object(
              'decision', p_decision,
              'decidedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'decidedBy', w->>'name')
     end
   where id = p_id and restaurant = p_restaurant;
  get diagnostics n = row_count;
  if n = 0 then return json_build_object('ok', false, 'error', 'not_found'); end if;
  return json_build_object('ok', true, 'decision', p_decision, 'by', w->>'name');
end $$;

-- ── «Проверка AI HR»: сохранить итог и прочитать последний ──────────────────────────────────────
create or replace function public.hr_quality_save(p_token text, p_restaurant text, p_payload text)
returns json language plpgsql security definer set search_path to public as $$
declare w jsonb; v jsonb;
begin
  w := _sa_hire_staff(p_token);
  if (w->>'ok')::boolean is not true then return w::json; end if;
  if p_restaurant is distinct from (w->>'restaurant') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if length(coalesce(p_payload, '')) > 20000 then
    return json_build_object('ok', false, 'error', 'too_big');
  end if;
  begin
    v := p_payload::jsonb;
  exception when others then
    return json_build_object('ok', false, 'error', 'bad_payload');
  end;
  if v is null or jsonb_typeof(v) <> 'object' then
    return json_build_object('ok', false, 'error', 'bad_payload');
  end if;
  insert into hr_quality (restaurant, payload, updated_by, updated_at)
  values (p_restaurant, v, w->>'name', now())
  on conflict (restaurant) do update set payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  return json_build_object('ok', true);
end $$;

create or replace function public.hr_quality_get(p_token text, p_restaurant text)
returns json language plpgsql stable security definer set search_path to public as $$
declare w jsonb; r record;
begin
  w := _sa_hire_staff(p_token);
  if (w->>'ok')::boolean is not true then return w::json; end if;
  if p_restaurant is distinct from (w->>'restaurant') then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  select * into r from hr_quality where restaurant = p_restaurant;
  if r is null then return json_build_object('ok', true, 'item', null); end if;
  return json_build_object('ok', true, 'item', json_build_object(
    'payload', r.payload, 'updated_by', r.updated_by, 'updated_at', r.updated_at));
end $$;

grant execute on function public.candidate_save(text, text, text) to anon, authenticated;
grant execute on function public.candidate_list(text, text) to anon, authenticated;
grant execute on function public.candidate_delete(text, text, bigint) to anon, authenticated;
grant execute on function public.candidate_decide(text, text, bigint, text) to anon, authenticated;
grant execute on function public.hr_quality_save(text, text, text) to anon, authenticated;
grant execute on function public.hr_quality_get(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- отчёт: какие функции этапа на месте
select 'этап 28: ' || string_agg(p.proname, ', ' order by p.proname) as result
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
   and p.proname in ('candidate_save', 'candidate_list', 'candidate_delete', 'candidate_decide', 'hr_quality_save', 'hr_quality_get');
