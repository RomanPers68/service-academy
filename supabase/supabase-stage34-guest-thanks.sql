-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 34 (v84, Доп. 397): «Спасибо» от гостей по QR.
--
-- У каждого сотрудника — свой QR-код со ссылкой <приложение>/?thanks=<код>. Гость наводит камеру, видит имя и
-- заведение, отмечает, за что спасибо (внимание, скорость, совет, улыбка, помог с просьбой) и, если хочет, пишет пару
-- слов. Входа и регистрации у гостя нет:
--   • guest_thanks_card(p_code) — имя (только имя), должность и заведение по коду; уволенный или старый код — not_found;
--   • guest_thanks_send(p_code, p_tags, p_text, p_device) — спасибо записывается; с одного телефона гостя одному
--     сотруднику — раз в 12 часов (p_device — случайный номер браузера гостя, не личные данные), одному сотруднику —
--     не больше 40 в сутки. Сотруднику бот пишет о первых трёх за день (вид «Спасибо от гостей»).
-- Сотрудник и руководитель:
--   • my_thanks(p_token) — свой код (создаётся при первом открытии), счётчики за неделю, месяц и всего, последние 50;
--   • thanks_rotate(p_token) — новый код: старый QR перестаёт работать (если ссылкой стали баловаться);
--   • thanks_team(p_token) — руководителю и старшему: кого и за что благодарят в заведении (неделя, месяц), последние 60;
--   • thanks_hide(p_token, p_id, p_hidden) — руководитель прячет неуместный текст (такое спасибо не считается и не видно).
--
-- Нужны этапы 21, 22б, 24 и 25 (лучше и 32: тогда «Спасибо от гостей» появится в «Напоминаниях в Telegram»).
-- Ничего не удаляет. Можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_caller(text)') is null then
    raise exception 'Сначала этап 21 (supabase-stage21-private-data.sql): нужна функция _sa_caller';
  end if;
  if to_regclass('public.tg_links') is null or to_regprocedure('public.sa_tg_send(bigint,text,text,text)') is null then
    raise exception 'Сначала этап 22б (supabase-stage22b-telegram-reminders.sql): нужен бот — таблица tg_links и sa_tg_send';
  end if;
  if to_regprocedure('public._sa_tz(text)') is null then
    raise exception 'Сначала этап 24 (supabase-stage24-together.sql): нужен часовой пояс заведения _sa_tz';
  end if;
  if to_regclass('public.sa_notify_prefs') is null or to_regprocedure('public._sa_tg_chat(text,text)') is null then
    raise exception 'Сначала этап 25 (supabase-stage25-live.sql): нужны настройки сообщений sa_notify_prefs и _sa_tg_chat';
  end if;
end $$;

-- ── 1) Таблицы и вид сообщений ─────────────────────────────────────────────────
create table if not exists sa_thanks_codes (
  code       text primary key,                 -- 10 знаков 0-9a-f: в QR и ссылке
  emp_id     text not null unique,             -- один действующий код на человека
  restaurant text not null default '',
  name       text not null default '',          -- для гостя — только имя
  pos        text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists sa_guest_thanks (
  id         bigserial primary key,
  emp_id     text not null,
  restaurant text not null default '',
  tags       text[] not null default '{}',
  text       text not null default '',
  device     text not null default '',          -- случайный номер браузера гостя (от повторов)
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sa_guest_thanks_emp_idx on sa_guest_thanks (emp_id, created_at desc);
create index if not exists sa_guest_thanks_rest_idx on sa_guest_thanks (restaurant, created_at desc);
alter table sa_thanks_codes enable row level security;
alter table sa_guest_thanks enable row level security;
revoke all on table sa_thanks_codes, sa_guest_thanks from public, anon, authenticated;
revoke all on sequence sa_guest_thanks_id_seq from public, anon, authenticated;

alter table sa_notify_prefs add column if not exists thanks boolean not null default true;

-- за что спасибо: ключи — как в приложении (lib/guest-thanks.js)
create or replace function _sa_thanks_tags()
returns text[] language sql immutable as $$ select array['care', 'speed', 'advice', 'smile', 'special'] $$;
create or replace function _sa_thanks_tag_ru(p_tag text)
returns text language sql immutable as $$
  select case p_tag when 'care' then 'внимание' when 'speed' then 'быстро' when 'advice' then 'совет по меню'
                    when 'smile' then 'улыбка и настроение' when 'special' then 'помог(ла) с просьбой' else p_tag end
$$;

create or replace function _sa_thanks_new_code()
returns text language plpgsql volatile security definer set search_path to public as $$
declare c text;
begin
  loop   -- 10 шестнадцатеричных знаков: 16¹⁰ вариантов, подобрать чужой код перебором нельзя
    c := left(replace(gen_random_uuid()::text, '-', ''), 10);
    exit when not exists (select 1 from sa_thanks_codes where code = c);
  end loop;
  return c;
end; $$;

-- ── 2) Гостю: карточка и «спасибо» ─────────────────────────────────────────────
create or replace function _sa_thanks_emp(p_code text)
returns sa_thanks_codes language plpgsql stable security definer set search_path to public as $$
declare r sa_thanks_codes; st text;
begin
  if coalesce(p_code, '') !~ '^[a-z0-9]{10}$' then return null; end if;
  select * into r from sa_thanks_codes where code = p_code;
  if r.code is null then return null; end if;
  begin
    execute 'select coalesce(to_jsonb(e)->>''status'', ''active'') from employees e where e.id::text = $1' into st using r.emp_id;
  exception when others then st := 'active'; end;
  if st is not null and st <> 'active' then return null; end if;   -- уволенный: код не работает
  return r;
end; $$;

create or replace function guest_thanks_card(p_code text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare r sa_thanks_codes;
begin
  r := _sa_thanks_emp(p_code);
  if r.code is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'name', r.name, 'pos', r.pos, 'restaurant', r.restaurant);
end; $$;

create or replace function guest_thanks_send(p_code text, p_tags text[], p_text text, p_device text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare r sa_thanks_codes; tg text[]; tx text; dev text; ld date; n int; chat bigint; msg text;
begin
  r := _sa_thanks_emp(p_code);
  if r.code is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  tg := coalesce((select array_agg(distinct t order by t) from unnest(coalesce(p_tags, '{}')) t where t = any(_sa_thanks_tags())), '{}');
  tx := left(btrim(regexp_replace(coalesce(p_text, ''), '[[:space:]]+', ' ', 'g')), 300);
  dev := left(regexp_replace(coalesce(p_device, ''), '[^A-Za-z0-9_-]', '', 'g'), 64);
  if dev <> '' and exists (select 1 from sa_guest_thanks where emp_id = r.emp_id and device = dev and created_at > now() - interval '12 hours') then
    return jsonb_build_object('ok', true, 'dup', true, 'name', r.name);
  end if;
  ld := (now() at time zone _sa_tz(r.restaurant))::date;
  select count(*) into n from sa_guest_thanks where emp_id = r.emp_id and (created_at at time zone _sa_tz(r.restaurant))::date = ld;
  if n >= 40 then return jsonb_build_object('ok', false, 'error', 'limit'); end if;
  insert into sa_guest_thanks (emp_id, restaurant, tags, text, device) values (r.emp_id, r.restaurant, tg, tx, dev);
  -- сотруднику — о первых трёх за день, дальше — в приложении
  if n < 3 and _sa_tg_ready() then
    chat := _sa_tg_chat(r.emp_id, 'thanks');
    if chat is not null and _sa_tg_once(r.emp_id, ld, 'gthanks_' || (n + 1)) then
      msg := 'Гость сказал тебе спасибо' ||
        case when array_length(tg, 1) > 0 then ': ' || (select string_agg(_sa_thanks_tag_ru(t), ', ') from unnest(tg) t) || '.' else '.' end ||
        case when tx <> '' then E'\n«' || tx || '»' else '' end;
      perform sa_tg_send(chat, msg, 'Открыть', 'thanks');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'name', r.name);
end; $$;

-- ── 3) Сотруднику: свой код и спасибо ──────────────────────────────────────────
create or replace function my_thanks(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; r sa_thanks_codes; rest text; tz text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  rest := coalesce(nullif(btrim(coalesce(c->>'restaurant', '')), ''), '');
  select * into r from sa_thanks_codes where emp_id = c->>'id';
  if r.code is null then
    insert into sa_thanks_codes (code, emp_id, restaurant, name, pos) values (_sa_thanks_new_code(), c->>'id', rest, coalesce(c->>'name', ''), coalesce(c->>'position', ''))
    returning * into r;
  elsif r.restaurant is distinct from rest or r.name is distinct from coalesce(c->>'name', '') or r.pos is distinct from coalesce(c->>'position', '') then
    update sa_thanks_codes set restaurant = rest, name = coalesce(c->>'name', ''), pos = coalesce(c->>'position', ''), updated_at = now()
     where emp_id = c->>'id' returning * into r;
  end if;
  tz := _sa_tz(rest);
  return jsonb_build_object('ok', true, 'code', r.code, 'name', r.name, 'restaurant', r.restaurant,
    'week', (select count(*) from sa_guest_thanks where emp_id = c->>'id' and not hidden and created_at > now() - interval '7 days'),
    'month', (select count(*) from sa_guest_thanks where emp_id = c->>'id' and not hidden and created_at > now() - interval '30 days'),
    'total', (select count(*) from sa_guest_thanks where emp_id = c->>'id' and not hidden),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'tags', to_jsonb(x.tags), 'text', x.text, 'at', x.created_at) order by x.created_at desc)
                         from (select * from sa_guest_thanks where emp_id = c->>'id' and not hidden order by created_at desc limit 50) x), '[]'::jsonb));
end; $$;

create or replace function thanks_rotate(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; nc text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  nc := _sa_thanks_new_code();
  insert into sa_thanks_codes (code, emp_id, restaurant, name, pos)
  values (nc, c->>'id', coalesce(nullif(btrim(coalesce(c->>'restaurant', '')), ''), ''), coalesce(c->>'name', ''), coalesce(c->>'position', ''))
  on conflict (emp_id) do update set code = excluded.code, updated_at = now();
  return jsonb_build_object('ok', true, 'code', nc);
end; $$;

-- ── 4) Руководителю: кого благодарят и скрыть неуместное ───────────────────────
create or replace function thanks_team(p_token text)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; rest text;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  rest := nullif(btrim(coalesce(c->>'restaurant', '')), '');
  if rest is null then return jsonb_build_object('ok', true, 'rows', '[]'::jsonb, 'items', '[]'::jsonb); end if;
  return jsonb_build_object('ok', true,
    'rows', coalesce((select jsonb_agg(jsonb_build_object('emp_id', t.emp_id, 'name', coalesce(k.name, ''), 'week', t.week, 'month', t.month,
                        'tags', coalesce(t.tags, '{}'::jsonb)) order by t.week desc, t.month desc, k.name)
                        from (select g.emp_id,
                                     count(*) filter (where g.created_at > now() - interval '7 days') as week,
                                     count(*) as month,
                                     (select jsonb_object_agg(tt, cnt) from (select tt, count(*) cnt from sa_guest_thanks g2, unnest(g2.tags) tt
                                         where g2.emp_id = g.emp_id and not g2.hidden and g2.created_at > now() - interval '30 days' group by tt) z) as tags
                                from sa_guest_thanks g
                               where g.restaurant = rest and not g.hidden and g.created_at > now() - interval '30 days'
                               group by g.emp_id) t
                        left join sa_thanks_codes k on k.emp_id = t.emp_id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'emp_id', x.emp_id, 'name', coalesce(k.name, ''), 'tags', to_jsonb(x.tags),
                        'text', x.text, 'hidden', x.hidden, 'at', x.created_at) order by x.created_at desc)
                        from (select * from sa_guest_thanks where restaurant = rest order by created_at desc limit 60) x
                        left join sa_thanks_codes k on k.emp_id = x.emp_id), '[]'::jsonb));
end; $$;

create or replace function thanks_hide(p_token text, p_id bigint, p_hidden boolean)
returns jsonb language plpgsql security definer set search_path to public as $$
declare c jsonb; n int;
begin
  c := _sa_caller(p_token);
  if c is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if not coalesce((c->>'lead')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  update sa_guest_thanks set hidden = coalesce(p_hidden, true)
   where id = p_id and restaurant is not distinct from nullif(btrim(coalesce(c->>'restaurant', '')), '');
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'hidden', coalesce(p_hidden, true));
end; $$;

-- ── 5) Права ───────────────────────────────────────────────────────────────────
revoke all on function _sa_thanks_new_code() from public, anon, authenticated;
revoke all on function _sa_thanks_emp(text) from public, anon, authenticated;
grant execute on function guest_thanks_card(text) to anon, authenticated;
grant execute on function guest_thanks_send(text, text[], text, text) to anon, authenticated;
grant execute on function my_thanks(text) to anon, authenticated;
grant execute on function thanks_rotate(text) to anon, authenticated;
grant execute on function thanks_team(text) to anon, authenticated;
grant execute on function thanks_hide(text, bigint, boolean) to anon, authenticated;

notify pgrst, 'reload schema';

select 'спасибо от гостей: ' ||
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('guest_thanks_card', 'guest_thanks_send', 'my_thanks', 'thanks_rotate', 'thanks_team', 'thanks_hide')) ||
  ' функций из 6 · таблицы: ' || case when to_regclass('public.sa_guest_thanks') is not null and to_regclass('public.sa_thanks_codes') is not null then 'есть' else 'НЕТ' end ||
  ' · вид «Спасибо от гостей» в напоминаниях: ' ||
  case when to_regprocedure('public._sa_notify_kinds()') is null then 'после этапа 32'
       when 'thanks' = any(_sa_notify_kinds()) then 'да' else 'нет' end ||
  ' · Telegram: ' || case when _sa_tg_ready() then 'бот на месте' else 'нет (спасибо видно в приложении, без сообщений)' end as result;
