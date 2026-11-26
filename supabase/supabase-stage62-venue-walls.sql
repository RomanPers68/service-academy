-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- Этап 62 (v199, Доп. 524): стены между заведениями и взгляд руководства сети по заведениям.
--
-- Владелец (26.11): «я не хочу, что бы что-то перекликалось и у каждого заведения была своя статистика. Но,
-- руководитель всей сети мог по заведениям увидеть статистику, а вот руководитель конкретного заведения, к примеру
-- управляющий, только то, за которым он прикреплен». Решили: рейтинг и лига у сотрудников — только своё заведение;
-- при переводе прошлые результаты остаются в старом заведении; у человека одно заведение.
--
-- Сеть — владелец и руководящий состав (и свои должности, которые «работают как» руководящий состав). Остальные —
-- только своё заведение, и это проверяет сервер, а не только экран:
--   • team_scores — результаты тестов: сеть — все заведения, остальные — своё и свои прежние (после перевода);
--   • league_week — лига: у сети как было (все заведения и кубок), у остальных — только своё заведение, без кубка;
--     в итогах недели от бота — место в заведении, без «в сети» и «Кубок заведений у…» (_sa_nudges_at);
--   • staff_photos — список фото сотрудников: сеть — все, остальные — своё заведение;
--   • menu_set — меню, вина, коктейли: сохранять может руководитель, менеджер — только своё заведение (раньше любой
--     вошедший и в любое); menu_progress_set — «меню выучено» пишется в своё заведение;
--   • schedule_load, schedule_publications_list, schedule_set_wish — график: сеть — любое заведение, остальные — своё.
-- Взгляд руководства сети по заведениям:
--   • _sa_caller и _sa_hire_staff узнают выбранное заведение на время одного запроса (настройка sa.lens) — только для
--     сети; всем остальным оно ничего не меняет;
--   • org_view(p_token, p_restaurant, p_fn, p_args) — «Что дало обучение», новички, мастера, рекорды, кандидаты AI HR
--     и проверка AI HR так, как их видит руководитель выбранного заведения. Только сеть;
--   • quiz_hard_questions_at(p_token, p_restaurant) — трудные вопросы одного заведения (сеть — любого, менеджер — своего).
-- Нужен этап 21 (_sa_caller); список заведений — этап 61 (без него выбранное заведение по списку не сверяется).
-- Остальные этапы не обязательны: чего нет, то пропускается. После повторного запуска этапов 4, 9, 21, 25, 28, 29 или
-- 52 — запусти этот файл ещё раз. Ничего не удаляет. Supabase → SQL Editor → New query → вставить → Run.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
end $$;

-- ── 1) Кто зовёт — с выбранным заведением у сети ─────────────────────────────────────────────────────────────────
-- Как в этапе 21, плюс: если запрос пришёл через org_view (sa.lens), у сети restaurant — выбранное заведение, а
-- своё — в home. У остальных sa.lens ничего не меняет.
create or replace function _sa_caller(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare w jsonb; v jsonb; e_admin boolean; e_pos text; e_rest text; e_status text;
  v_admin boolean; v_pos text; v_rest text; v_home text; v_net boolean; v_lens text;
begin
  if p_token is null or btrim(p_token) = '' then return null; end if;
  begin w := whoami_txt(p_token); exception when others then return null; end;   -- whoami_txt — этап 11c
  if w is null then return null; end if;
  -- отозванный токен: whoami отвечает {ok:false} — это не личность, даже если рядом есть employee
  if w ? 'ok' and coalesce((w->>'ok')::boolean, false) is not true then return null; end if;
  v := coalesce(w->'employee', w);
  if coalesce(v->>'id', '') = '' then return null; end if;

  begin
    select coalesce(e.is_admin, false), lower(coalesce(e.position, '')), e.restaurant, coalesce(e.status, 'active')
      into e_admin, e_pos, e_rest, e_status
      from employees e where e.id::text = v->>'id' limit 1;
  exception when others then e_admin := null; end;
  if e_status is not null and e_status <> 'active' then return null; end if;

  v_admin := coalesce((v->>'is_admin')::boolean, false) or coalesce(e_admin, false);
  v_pos   := coalesce(nullif(lower(v->>'position'), ''), e_pos, '');
  v_rest  := coalesce(nullif(v->>'restaurant', ''), e_rest);
  v_home  := v_rest;
  v_net   := v_admin or v_pos = 'senior';
  v_lens  := nullif(btrim(coalesce(current_setting('sa.lens', true), '')), '');
  if v_net and v_lens is not null then v_rest := v_lens; end if;
  return jsonb_build_object(
    'id', v->>'id',
    'name', v->>'name',
    'surname', coalesce(v->>'surname', ''),
    'who', btrim(coalesce(v->>'name', '') || ' ' || coalesce(v->>'surname', '')),
    'restaurant', v_rest,
    'home', v_home,
    'lens', v_net and v_lens is not null,
    'position', v_pos,
    'admin', v_admin,
    'network', v_net,
    'lead', v_admin or v_pos in ('manager', 'senior', 'owner', 'head', 'admin', 'service_manager'));
end; $$;
revoke all on function _sa_caller(text) from public, anon, authenticated;

-- найм (этап 28): как было, плюс выбранное заведение у сети
create or replace function public._sa_hire_staff(p_token text)
returns jsonb language plpgsql stable security definer set search_path to public as $$
declare v jsonb; v_rest text; v_lens text;
begin
  v := to_jsonb(whoami_txt(p_token));
  if coalesce((v->>'ok')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'auth');
  end if;
  if not ( coalesce((v->'employee'->>'is_admin')::boolean, false)
          or coalesce(v->'employee'->>'position', '') in ('manager', 'senior') ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  v_rest := v->'employee'->>'restaurant';
  v_lens := nullif(btrim(coalesce(current_setting('sa.lens', true), '')), '');
  if v_lens is not null and (coalesce((v->'employee'->>'is_admin')::boolean, false) or coalesce(v->'employee'->>'position', '') = 'senior') then
    v_rest := v_lens;
  end if;
  return jsonb_build_object('ok', true,
    'restaurant', v_rest,
    'name', trim(concat_ws(' ', v->'employee'->>'name', v->'employee'->>'surname')));
exception when others then
  return jsonb_build_object('ok', false, 'error', 'auth');
end $$;
revoke all on function public._sa_hire_staff(text) from public, anon, authenticated;

-- своё ли заведение: сеть — любое, остальные — только своё (c — _sa_caller)
create or replace function _sa_rest_ok(c jsonb, p_rest text)
returns boolean language sql immutable as $$
  select c is not null and (coalesce((c->>'network')::boolean, false) or coalesce(p_rest, '') = coalesce(c->>'restaurant', ''))
$$;
revoke all on function _sa_rest_ok(jsonb, text) from public, anon, authenticated;

-- ── 2) Результаты тестов: сети — вся сеть, остальным — своё заведение ────────────────────────────────────────────
create or replace function team_scores(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rows jsonb := '[]'::jsonb; net boolean;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  net := coalesce((c->>'network')::boolean, false);
  if to_regclass('public.scores') is not null then
    if net then
      execute 'select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from scores s' into rows;
    else
      -- своё заведение и свои прежние результаты (после перевода они остались в старом заведении, но «Моя статистика» —
      -- с человеком); в рейтинг прежние не попадают: экран рейтинга показывает только своё заведение
      execute 'select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from scores s where coalesce(s.restaurant, '''') = $1
                 or (s.name = $2 and coalesce(s.surname, '''') = $3)'
        into rows using coalesce(c->>'restaurant', ''), coalesce(c->>'name', ''), coalesce(c->>'surname', '');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'rows', rows, 'scope', case when net then 'all' else 'restaurant' end);
end; $$;

-- ── 3) Лига: у сети как было, у остальных — своё заведение, без кубка ────────────────────────────────────────────
-- прежняя лига этапа 25 — под новым именем (_sa_league_week_all), сверху — обёртка
do $$
declare src text;
begin
  if to_regprocedure('public.league_week(text)') is null then return; end if;
  src := pg_get_functiondef('public.league_week(text)'::regprocedure);
  if position('_sa_league_week_all' in src) = 0 then   -- ещё лига этапа 25, а не обёртка
    src := replace(src, 'FUNCTION public.league_week(', 'FUNCTION public._sa_league_week_all(');
    execute src;
    execute 'revoke all on function public._sa_league_week_all(text) from public, anon, authenticated';
  end if;
  execute $f$
create or replace function league_week(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $w$
declare c jsonb; r jsonb; rest text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  r := _sa_league_week_all(p_token);
  if coalesce((c->>'network')::boolean, false) or coalesce((r->>'ok')::boolean, false) is not true then return r; end if;
  rest := coalesce(c->>'restaurant', '');
  -- только своё заведение: место «в сети» — это место в заведении, кубка нет
  return r || jsonb_build_object(
    'rows', coalesce((select jsonb_agg(x || jsonb_build_object('prev_net', x->'prev_rest'))
                        from jsonb_array_elements(r->'rows') x where coalesce(x->>'restaurant', '') = rest), '[]'::jsonb),
    'cup', '[]'::jsonb, 'cup_hist', '[]'::jsonb, 'scope', 'restaurant',
    'me_prev', case when jsonb_typeof(r->'me_prev') = 'object' then (r->'me_prev') || jsonb_build_object('rank_net', r->'me_prev'->'rank_rest') else r->'me_prev' end,
    'wins', case when jsonb_typeof(r->'wins') = 'object' then (r->'wins') || jsonb_build_object('net', r->'wins'->'rest') else r->'wins' end);
end; $w$;
$f$;
end $$;

-- итоги недели от бота (этапы 25, 29): место в заведении, без «в сети» и кубка
do $$
declare src text; was text;
begin
  if to_regprocedure('public._sa_nudges_at(boolean, timestamp with time zone)') is null then return; end if;
  src := pg_get_functiondef('public._sa_nudges_at(boolean, timestamp with time zone)'::regprocedure);
  was := src;
  src := replace(src, $x$case when me.n_net > me.n_rest then ' и ' || me.rank_net || '-е в сети' else '' end || ', '$x$, $x$', '$x$);
  src := replace(src, $x$case when cupw is not null then E'\nКубок заведений у «' || cupw || '».' else '' end ||$x$, '');
  if src <> was then execute src; end if;
end $$;

-- ── 4) Фото сотрудников: список — сети все, остальным своё заведение ─────────────────────────────────────────────
do $$
declare src text;
begin
  if to_regprocedure('public.staff_photos(text)') is null then return; end if;
  src := pg_get_functiondef('public.staff_photos(text)'::regprocedure);
  if position('_sa_staff_photos_all' in src) = 0 then
    src := replace(src, 'FUNCTION public.staff_photos(', 'FUNCTION public._sa_staff_photos_all(');
    execute src;
    execute 'revoke all on function public._sa_staff_photos_all(text) from public, anon, authenticated';
  end if;
  execute $f$
create or replace function staff_photos(p_token text)
returns jsonb language plpgsql volatile security definer set search_path to public as $w$
declare c jsonb; r jsonb; rest text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  r := _sa_staff_photos_all(p_token);
  if coalesce((c->>'network')::boolean, false) or coalesce((r->>'ok')::boolean, false) is not true then return r; end if;
  rest := coalesce(c->>'restaurant', '');
  return r || jsonb_build_object('items', coalesce((select jsonb_agg(x) from jsonb_array_elements(r->'items') x
    where coalesce(x->>'restaurant', '') = rest or x->>'id' = c->>'id'), '[]'::jsonb));
end; $w$;
$f$;
end $$;

-- ── 5) Меню, вина, коктейли: сохраняет руководитель; менеджер — своё заведение ───────────────────────────────────
do $$
begin
  if to_regclass('public.restaurant_menu') is null then return; end if;
  execute $f$
create or replace function menu_set(p_token text, p_restaurant text, p_dishes text)
returns json language plpgsql security definer set search_path to public as $w$
declare c jsonb; v_rest text := nullif(btrim(coalesce(p_restaurant, '')), '');
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return json_build_object('ok', false, 'error', 'forbidden'); end if;
  if v_rest is null then return json_build_object('ok', false, 'error', 'bad_request'); end if;
  if not _sa_rest_ok(c, v_rest) then return json_build_object('ok', false, 'error', 'forbidden'); end if;
  insert into restaurant_menu (restaurant, dishes, updated_by, updated_at)
  values (v_rest, p_dishes::jsonb, c->>'who', now())
  on conflict (restaurant) do update
    set dishes = excluded.dishes, updated_by = excluded.updated_by, updated_at = now();
  return json_build_object('ok', true);
end; $w$;
$f$;
end $$;

do $$
begin
  if to_regclass('public.menu_progress') is null then return; end if;
  execute $f$
create or replace function menu_progress_set(p_token text, p_restaurant text, p_wave text, p_status text, p_score int)
returns json language plpgsql security definer set search_path to public as $w$
declare c jsonb; v_rest text;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  -- своё «меню выучено» — в своё заведение; сеть учит меню любого
  v_rest := case when coalesce((c->>'network')::boolean, false) and coalesce(btrim(p_restaurant), '') <> '' then p_restaurant
                 else c->>'restaurant' end;
  if coalesce(v_rest, '') = '' then return json_build_object('ok', false, 'error', 'no_rest'); end if;
  insert into menu_progress (restaurant, employee, wave, status, score)
  values (v_rest, c->>'who', p_wave, p_status, p_score)
  on conflict (restaurant, employee, wave, status)
    do update set ts = now(), score = excluded.score;
  return json_build_object('ok', true);
end; $w$;
$f$;
end $$;

-- ── 6) График: сеть — любое заведение, остальные — своё ──────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.schedule_months') is null then return; end if;
  execute $f$
create or replace function schedule_load(p_token text, p_restaurant text, p_month text)
returns json language plpgsql security definer set search_path to public as $w$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  if not _sa_rest_ok(c, p_restaurant) then return json_build_object('ok', false, 'error', 'forbidden'); end if;
  return json_build_object(
    'ok', true,
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object('venue_key', venue_key, 'title', title, 'config', config) order by venue_key)
      from schedule_venues where restaurant = p_restaurant
    ), '[]'::jsonb),
    'months', coalesce((
      select jsonb_agg(jsonb_build_object('venue_key', venue_key, 'month', month, 'payload', payload,
        'updated_by', updated_by, 'updated_at', updated_at))
      from schedule_months where restaurant = p_restaurant and month = p_month
    ), '[]'::jsonb)
  );
exception when others then
  return json_build_object('ok', false, 'error', SQLERRM);
end; $w$;
$f$;
  execute $f$
create or replace function schedule_publications_list(p_token text, p_restaurant text, p_venue_key text, p_month text)
returns json language plpgsql security definer set search_path to public as $w$
declare c jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  if not _sa_rest_ok(c, p_restaurant) then return json_build_object('ok', false, 'error', 'forbidden'); end if;
  return json_build_object('ok', true, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'file_url', file_url, 'published_by', published_by, 'published_at', published_at)
      order by published_at desc)
    from schedule_publications
    where restaurant = p_restaurant and venue_key = p_venue_key and month = p_month
  ), '[]'::jsonb));
end; $w$;
$f$;
  -- пожелание к графику — своё и в своё заведение; владелец — любому и в любое (как было)
  execute $f$
create or replace function schedule_set_wish(p_token text, p_restaurant text, p_venue_key text, p_month text,
  p_staff_id text, p_day text, p_wish text)
returns json language plpgsql security definer set search_path to public as $w$
declare c jsonb; v_cur jsonb;
begin
  c := _sa_caller(p_token);
  if c is null then return json_build_object('ok', false, 'error', 'auth'); end if;
  if coalesce(c->>'id', '') <> coalesce(p_staff_id, '') and not coalesce((c->>'admin')::boolean, false) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if not _sa_rest_ok(c, p_restaurant) then return json_build_object('ok', false, 'error', 'forbidden'); end if;
  select payload into v_cur from schedule_months where restaurant = p_restaurant and venue_key = p_venue_key and month = p_month;
  if v_cur is null then return json_build_object('ok', false, 'error', 'no_month'); end if;
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
end; $w$;
$f$;
end $$;

-- ── 7) Взгляд сети: выбранное заведение для одного запроса ───────────────────────────────────────────────────────
create or replace function org_view(p_token text, p_restaurant text, p_fn text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb := _sa_caller(p_token); a jsonb := coalesce(p_args, '{}'::jsonb); r jsonb;
  v_rest text := nullif(regexp_replace(btrim(coalesce(p_restaurant, '')), '\s+', ' ', 'g'), '');
begin
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'network')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if v_rest is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  if to_regclass('public.sa_venues') is not null and not exists (select 1 from sa_venues where name = v_rest) then
    return jsonb_build_object('ok', false, 'error', 'no_venue');
  end if;
  perform set_config('sa.lens', v_rest, true);
  case p_fn
    when 'gain_month' then r := to_jsonb(gain_month(p_token, a->>'p_month'));
    when 'newbie_list' then r := to_jsonb(newbie_list(p_token));
    when 'mastery_list' then r := to_jsonb(mastery_list(p_token));
    when 'team_achievements' then r := to_jsonb(team_achievements(p_token));
    when 'candidate_list' then r := to_jsonb(candidate_list(p_token, v_rest));
    when 'candidate_save' then r := to_jsonb(candidate_save(p_token, v_rest, a->>'p_result'));
    when 'candidate_decide' then r := to_jsonb(candidate_decide(p_token, v_rest, (a->>'p_id')::bigint, a->>'p_decision'));
    when 'candidate_delete' then r := to_jsonb(candidate_delete(p_token, v_rest, (a->>'p_id')::bigint));
    when 'hr_quality_get' then r := to_jsonb(hr_quality_get(p_token, v_rest));
    when 'hr_quality_save' then r := to_jsonb(hr_quality_save(p_token, v_rest, a->>'p_payload'));
    else r := jsonb_build_object('ok', false, 'error', 'bad_fn');
  end case;
  perform set_config('sa.lens', '', true);
  return r;
exception when undefined_function then
  perform set_config('sa.lens', '', true);
  return jsonb_build_object('ok', false, 'error', 'no_stage');
end $$;

-- трудные вопросы одного заведения (этап 7): сеть — любого, менеджер — своего
do $$
begin
  if to_regclass('public.quiz_events') is null then return; end if;
  execute $f$
create or replace function quiz_hard_questions_at(p_token text, p_restaurant text)
returns table (question text, lesson_id text, total bigint, fails bigint, fail_pct int)
language plpgsql security definer set search_path to public as $w$
declare c jsonb; v_rest text;
begin
  c := _sa_caller(p_token);
  if c is null or not (coalesce((c->>'admin')::boolean, false) or c->>'position' in ('senior', 'manager')) then return; end if;
  v_rest := case when coalesce((c->>'network')::boolean, false) and coalesce(btrim(p_restaurant), '') <> '' then p_restaurant
                 else c->>'restaurant' end;
  return query
  select q.question, max(q.lesson_id) as lesson_id, count(*) as total,
         count(*) filter (where not q.correct) as fails,
         (count(*) filter (where not q.correct) * 100 / count(*))::int as fail_pct
    from quiz_events q
   where q.ts > now() - interval '30 days' and q.restaurant = v_rest
   group by q.question
  having count(*) >= 3 and count(*) filter (where not q.correct) > 0
   order by fail_pct desc, fails desc
   limit 15;
end; $w$;
$f$;
  execute 'grant execute on function quiz_hard_questions_at(text, text) to anon, authenticated';
end $$;

grant execute on function org_view(text, text, text, jsonb) to anon, authenticated;
grant execute on function team_scores(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 8) Проверка: ожидаем «стены между заведениями: … · бот: без «в сети» · взгляд сети: да» ───────────────────────
select 'стены между заведениями: ' ||
  concat_ws(', ',
    case when pg_get_functiondef('public.team_scores(text)'::regprocedure) like '%network%' then 'тесты' end,
    case when to_regprocedure('public._sa_league_week_all(text)') is not null then 'лига' end,
    case when to_regprocedure('public._sa_staff_photos_all(text)') is not null then 'фото' end,
    case when to_regprocedure('public.menu_set(text, text, text)') is not null
          and pg_get_functiondef('public.menu_set(text, text, text)'::regprocedure) like '%_sa_rest_ok%' then 'меню' end,
    case when to_regprocedure('public.schedule_load(text, text, text)') is not null
          and pg_get_functiondef('public.schedule_load(text, text, text)'::regprocedure) like '%_sa_rest_ok%' then 'график' end) ||
  ' · бот: ' || case when to_regprocedure('public._sa_nudges_at(boolean, timestamp with time zone)') is null then 'нет этапа'
                     when pg_get_functiondef('public._sa_nudges_at(boolean, timestamp with time zone)'::regprocedure) like '%-е в сети%' then 'ещё «в сети»'
                     else 'без «в сети»' end ||
  ' · взгляд сети: ' || case when pg_get_functiondef('public._sa_caller(text)'::regprocedure) like '%sa.lens%'
                              and to_regprocedure('public.org_view(text, text, text, jsonb)') is not null then 'да' else 'НЕТ' end as result;
