-- supabase-stage9-schedule.sql — Этап 9: график смен.
--
-- Хранит две вещи:
--   1) настройки заведения (смены, потребность, правила, штат) — одна запись на заведение;
--   2) сам график на месяц (расстановка, замки, пожелания, календарь) — запись на месяц.
--
-- Права намеренно разведены:
--   • читать график своего ресторана может любой сотрудник — иначе человек не увидит свои смены;
--   • менять график и настройки может только админ (менеджер/управляющий);
--   • пожелание на день сотрудник ставит себе сам, но чужое тронуть не может.
--
-- Личность берётся из вашей же функции whoami(p_token uuid) — она принимает
-- именно uuid, поэтому токен приводим к нему явно и аккуратно: кривая строка
-- вернёт понятный bad_token, а не ошибку приведения типа.
-- Запускается один раз в SQL-редакторе Supabase. Адаптировать ничего не нужно.

-- ── Настройки заведения ─────────────────────────────────────────────
create table if not exists schedule_venues (
  id          bigserial primary key,
  restaurant  text not null,
  venue_key   text not null,             -- стабильный ключ заведения внутри ресторана
  title       text not null,             -- название (дублирует профиль, нужно для печати)
  config      jsonb not null,            -- часы, смены, потребность, правила, штат
  updated_by  text,
  updated_at  timestamptz default now(),
  unique (restaurant, venue_key)
);

-- ── График на месяц ─────────────────────────────────────────────────
create table if not exists schedule_months (
  id          bigserial primary key,
  restaurant  text not null,
  venue_key   text not null,
  month       text not null,             -- 'YYYY-MM'
  payload     jsonb not null,            -- plan, locks, wishes, days
  updated_by  text,
  updated_at  timestamptz default now(),
  unique (restaurant, venue_key, month)
);
create index if not exists schedule_months_idx
  on schedule_months (restaurant, venue_key, month);

-- ── Чтение: доступно любому сотруднику своего ресторана ─────────────
create or replace function schedule_load(p_token text, p_restaurant text, p_month text)
returns json language plpgsql security definer as $$
declare v jsonb; v_tok uuid;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  return json_build_object(
    'ok', true,
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'venue_key', venue_key, 'title', title, 'config', config
      ) order by venue_key)
      from schedule_venues where restaurant = p_restaurant
    ), '[]'::jsonb),
    'months', coalesce((
      select jsonb_agg(jsonb_build_object(
        'venue_key', venue_key, 'month', month, 'payload', payload,
        'updated_by', updated_by, 'updated_at', updated_at
      ))
      from schedule_months
      where restaurant = p_restaurant and month = p_month
    ), '[]'::jsonb)
  );
exception when others then
  -- Без этого любая ошибка уходит наружу в формате PostgREST,
  -- и приложение видит не наш ответ, а служебный код.
  return json_build_object('ok', false, 'error', SQLERRM);
end; $$;

-- ── Запись настроек заведения: только админ ─────────────────────────
create or replace function schedule_save_venue(
  p_token text, p_restaurant text, p_venue_key text, p_title text, p_config text)
returns json language plpgsql security definer as $$
declare v jsonb; v_who text; v_tok uuid;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if coalesce((v->'employee'->>'is_admin')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  v_who := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));

  insert into schedule_venues (restaurant, venue_key, title, config, updated_by, updated_at)
  values (p_restaurant, p_venue_key, p_title, p_config::jsonb, v_who, now())
  on conflict (restaurant, venue_key) do update
    set title = excluded.title, config = excluded.config,
        updated_by = excluded.updated_by, updated_at = now();
  return json_build_object('ok', true);
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end; $$;

-- ── Запись графика на месяц: только админ ───────────────────────────
create or replace function schedule_save_month(
  p_token text, p_restaurant text, p_venue_key text, p_month text, p_payload text)
returns json language plpgsql security definer as $$
declare v jsonb; v_who text; v_tok uuid;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if coalesce((v->'employee'->>'is_admin')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  v_who := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));

  insert into schedule_months (restaurant, venue_key, month, payload, updated_by, updated_at)
  values (p_restaurant, p_venue_key, p_month, p_payload::jsonb, v_who, now())
  on conflict (restaurant, venue_key, month) do update
    set payload = excluded.payload, updated_by = excluded.updated_by, updated_at = now();
  return json_build_object('ok', true);
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end; $$;

-- ── Пожелание сотрудника на день: правит только своё ─────────────────
-- Отдельная функция нужна, чтобы человек мог просить выходной,
-- не получая права переписывать весь график.
create or replace function schedule_set_wish(
  p_token text, p_restaurant text, p_venue_key text, p_month text,
  p_staff_id text, p_day text, p_wish text)
returns json language plpgsql security definer as $$
declare v jsonb; v_cur jsonb; v_self text; v_tok uuid;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  -- сопоставляем сотрудника графика с вошедшим по внешнему ключу профиля
  v_self := coalesce(v->'employee'->>'id', '');
  if v_self = '' or v_self <> p_staff_id then
    if coalesce((v->'employee'->>'is_admin')::boolean, false) is not true then
      return json_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  select payload into v_cur from schedule_months
   where restaurant = p_restaurant and venue_key = p_venue_key and month = p_month;
  if v_cur is null then
    return json_build_object('ok', false, 'error', 'no_month');
  end if;

  if p_wish = '' then
    v_cur := v_cur #- array['wishes', p_staff_id, p_day];
  else
    v_cur := jsonb_set(v_cur, array['wishes', p_staff_id, p_day], to_jsonb(p_wish), true);
  end if;

  update schedule_months set payload = v_cur, updated_at = now()
   where restaurant = p_restaurant and venue_key = p_venue_key and month = p_month;
  return json_build_object('ok', true);
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end; $$;

-- ── Архив публикаций ────────────────────────────────────────────────
-- Снимок графика в момент публикации: кто, когда, что именно опубликовал.
-- Нужен не для красоты: если человек говорит «у меня было по-другому»,
-- спор решается открытием снимка, а не памятью.
create table if not exists schedule_publications (
  id          bigserial primary key,
  restaurant  text not null,
  venue_key   text not null,
  month       text not null,
  snapshot    jsonb not null,          -- график целиком на момент публикации
  file_url    text,                    -- ссылка на PDF, когда он собран
  published_by text,
  published_at timestamptz default now()
);
create index if not exists schedule_pub_idx
  on schedule_publications (restaurant, venue_key, month, published_at desc);

-- Опубликовать: сохраняет снимок и возвращает его id.
-- PDF собирается отдельно и дописывается в file_url — так публикация
-- не падает, если сборка файла почему-то не удалась.
create or replace function schedule_publish(
  p_token text, p_restaurant text, p_venue_key text, p_month text)
returns json language plpgsql security definer as $$
declare v jsonb; v_who text; v_payload jsonb; v_id bigint; v_tok uuid;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if coalesce((v->'employee'->>'is_admin')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  v_who := trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname'));

  select payload into v_payload from schedule_months
   where restaurant = p_restaurant and venue_key = p_venue_key and month = p_month;
  if v_payload is null then
    return json_build_object('ok', false, 'error', 'no_month');
  end if;

  insert into schedule_publications (restaurant, venue_key, month, snapshot, published_by)
  values (p_restaurant, p_venue_key, p_month, v_payload, v_who)
  returning id into strict v_id;
  return json_build_object('ok', true, 'id', v_id, 'published_by', v_who);
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end; $$;

-- Дописать ссылку на собранный PDF к публикации
create or replace function schedule_publication_file(p_token text, p_id bigint, p_url text)
returns json language plpgsql security definer as $$
declare v jsonb; v_tok uuid;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if coalesce((v->'employee'->>'is_admin')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  update schedule_publications set file_url = p_url where id = p_id;
  return json_build_object('ok', true);
end; $$;

-- История публикаций месяца: доступна любому сотруднику ресторана.
-- Человек должен видеть, по какой версии он выходит.
create or replace function schedule_publications_list(
  p_token text, p_restaurant text, p_venue_key text, p_month text)
returns json language plpgsql security definer as $$
declare v jsonb; v_tok uuid;
begin
  begin v_tok := p_token::uuid; exception when others then
    return json_build_object('ok', false, 'error', 'bad_token'); end;
  v := to_jsonb(whoami(v_tok));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  return json_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'file_url', file_url,
      'published_by', published_by, 'published_at', published_at
    ) order by published_at desc)
    from schedule_publications
    where restaurant = p_restaurant and venue_key = p_venue_key and month = p_month
  ), '[]'::jsonb));
end; $$;

-- ── Доступ ──────────────────────────────────────────────────────────
alter table schedule_venues enable row level security;
alter table schedule_months enable row level security;
alter table schedule_publications enable row level security;
-- Политик нет намеренно: таблицы закрыты, вся работа идёт через функции
-- security definer, где права проверяются через whoami. Тот же подход,
-- что в этапе 8 с результатами собеседований.

grant execute on function schedule_load(text,text,text)                       to anon, authenticated;
grant execute on function schedule_save_venue(text,text,text,text,text)       to anon, authenticated;
grant execute on function schedule_save_month(text,text,text,text,text)       to anon, authenticated;
grant execute on function schedule_set_wish(text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function schedule_publish(text,text,text,text)               to anon, authenticated;
grant execute on function schedule_publication_file(text,bigint,text)         to anon, authenticated;
grant execute on function schedule_publications_list(text,text,text,text)     to anon, authenticated;

-- ── Проверка после запуска ──────────────────────────────────────────
-- Выполни отдельно и убедись, что все семь функций на месте:
--
--   select proname from pg_proc where proname like 'schedule%' order by 1;
--
-- Если PostgREST ещё не увидел новые функции, разбудить его:
--
--   notify pgrst, 'reload schema';
--
-- Быстрая проверка прав и связи (подставь свой токен и ресторан):
--
--   select schedule_load('ТОКЕН', 'НАЗВАНИЕ_РЕСТОРАНА', '2026-08');
--
-- Ответ должен быть {"ok": true, "venues": [], "months": []}.
-- Пустые массивы — это нормально: заведение ещё не настроено.
