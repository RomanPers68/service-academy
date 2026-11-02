-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 46 (v130, Доп. 443): «Поделиться в чат» — вина и крепкое из «Барной карты».
--
-- Владелец (02.11): «И нужна ещё функция «поделиться в чат». В колоде коктейлей вроде и есть. А вот вина и крепкие не
-- имеют такой возможности». Карточка вина или крепкого из «Барной карты» уходит в чат так же, как блюдо и коктейль:
--   • _sa_chat_item пропускает виды 'wine' и 'spirit' везде, где пропускает 'cocktail' (_sa_chat_bar_kinds): «Поделиться
--     в чат» в чатах заведения (в сетевой чат — нет, как и блюда с коктейлями) и карточки в ответе Наставника;
--   • _sa_chat_card_sum — в списке чатов, в цитате и у бота «Вино: Шабли 2022», «Крепкое: Glenfiddich 12 лет».
-- Обе функции — из этапа 38 (supabase-stage38-chat.sql), всё прочее в них прежнее; по новой _sa_chat_bar_kinds экран
-- «Сервер» у владельца видит, что этап на месте. Таблицы не меняются. Нужен этап 38.
-- Можно запускать повторно.
-- Supabase → SQL Editor → New query → вставить файл целиком → Run.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_chat_item(jsonb, text[])') is null or to_regprocedure('public._sa_chat_card_sum(jsonb)') is null then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужен чат команды';
  end if;
end $$;

-- коротко о карточке — текст сообщения (список чатов, цитата, бот); как cardSummary в lib/chat-smart.js
create or replace function _sa_chat_card_sum(p jsonb)
returns text language sql immutable as $$
  select case p->>'t'
    when 'shift' then case
        when p->>'mode' = 'need' and coalesce(p->'instead'->>'name', '') <> '' then 'Ищем замену: '
        when p->>'mode' = 'need' then 'Ищем ' || _sa_chat_spos_acc(p->>'posKey', case when p->>'n' ~ '^[0-9]$' then (p->>'n')::int else 1 end) || ': '
        when p->>'mode' = 'swap' then 'Меняю смену: ' else 'Отдаю смену: ' end || coalesce(_sa_chat_dlong(_sa_chat_date(p->>'date')), '') ||
      coalesce(' · ' || nullif(btrim(_sa_chat_low(p->>'label') || ' ' || coalesce(p->>'time', '')), ''), '') ||
      case when p->>'mode' = 'need' and coalesce(p->'instead'->>'name', '') <> '' then coalesce(' (' || nullif(_sa_chat_spos(p->>'posKey', false), '') || ')', '') else '' end
    when 'task' then 'Задание: ' || coalesce(p->'item'->>'title', '') || coalesce(', ' || _sa_chat_due(_sa_chat_date(p->>'due')), '')
    when 'share' then (case p->'item'->>'kind' when 'dish' then 'Блюдо' when 'cocktail' then 'Коктейль' when 'wine' then 'Вино' when 'spirit' then 'Крепкое'
      when 'ref' then 'Справочник' when 'lesson' then 'Урок' when 'quiz' then 'Тест' when 'module' then 'Тема' else 'Карточка' end) || ': ' || coalesce(p->'item'->>'title', '')
    when 'poll' then 'Опрос: ' || coalesce(p->>'q', '')
    when 'stop' then case when p->>'st' = 'off' then 'Снова в меню: ' else 'В стоп-листе: ' end || coalesce(p->'dish'->>'name', '')
    when 'brief' then 'Брифинг смены, ' || coalesce(_sa_chat_dlong(_sa_chat_date(p->>'date')), '')
    -- v97: «График на ноябрь готов», «Пожелания на декабрь: до 20 ноября»
    when 'sched' then case when p->>'what' = 'wishes'
      then 'Пожелания на ' || coalesce(_sa_chat_mon(case when p->>'month' ~ '^\d{4}-(0[1-9]|1[0-2])$' then substr(p->>'month', 6, 2)::int end, false), 'месяц') ||
        coalesce(': до ' || extract(day from _sa_chat_date(p->>'until'))::int || ' ' || _sa_chat_mon(extract(month from _sa_chat_date(p->>'until'))::int, true), '')
      else 'График на ' || coalesce(_sa_chat_mon(case when p->>'month' ~ '^\d{4}-(0[1-9]|1[0-2])$' then substr(p->>'month', 6, 2)::int end, false), 'месяц') || ' готов' end
    else '' end
$$;
-- вино и крепкое — карта своего заведения: пропускаются там же, где коктейль
create or replace function _sa_chat_bar_kinds(p_kinds text[])
returns text[] language sql immutable as $$
  select coalesce(p_kinds, '{}'::text[]) || case when 'cocktail' = any(coalesce(p_kinds, '{}'::text[])) then array['wine', 'spirit'] else '{}'::text[] end
$$;
-- что приложение положило в карточку: вид из разрешённых (и вино с крепким там, где коктейль), id, название, подпись,
-- минуты, картинка (только https), у темы — её уроки и тесты (по ним считается «прошёл»)
create or replace function _sa_chat_item(p jsonb, p_kinds text[])
returns jsonb language sql immutable as $$
  select case when jsonb_typeof(p) = 'object'
      and p->>'kind' = any(_sa_chat_bar_kinds(p_kinds))
      and coalesce(p->>'id', '') ~ '^[A-Za-z0-9_.:-]{1,80}$'
      and btrim(coalesce(p->>'title', '')) <> '' then
    jsonb_strip_nulls(jsonb_build_object('kind', p->>'kind', 'id', p->>'id', 'title', _sa_chat_cut(p->>'title', 120),
      'sub', nullif(_sa_chat_cut(p->>'sub', 140), ''),
      'mins', case when p->>'mins' ~ '^[0-9]{1,3}$' then (p->>'mins')::int end,
      'img', case when p->>'img' ~ '^https://[^\s"<>]+$' and char_length(p->>'img') <= 600 then p->>'img' end,
      'lessons', case when p->>'kind' = 'module' and jsonb_typeof(p->'lessons') = 'array' then
        (select jsonb_agg(v) from (select v from jsonb_array_elements_text(p->'lessons') v where v ~ '^[A-Za-z0-9_.:-]{1,80}$' limit 80) s) end,
      'quizzes', case when p->>'kind' = 'module' and jsonb_typeof(p->'quizzes') = 'array' then
        (select jsonb_agg(v) from (select v from jsonb_array_elements_text(p->'quizzes') v where v ~ '^[A-Za-z0-9_.:-]{1,80}$' limit 80) s) end)) end
$$;

revoke all on function _sa_chat_card_sum(jsonb) from public, anon, authenticated;
revoke all on function _sa_chat_item(jsonb, text[]) from public, anon, authenticated;
revoke all on function _sa_chat_bar_kinds(text[]) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'чат: вина и крепкое — ' ||
  case when _sa_chat_item('{"kind":"wine","id":"wn-1","title":"Шабли"}'::jsonb, array['dish', 'cocktail']) is not null
        and _sa_chat_item('{"kind":"spirit","id":"sp-1","title":"Glenfiddich 12"}'::jsonb, array['dish', 'cocktail']) is not null
        and _sa_chat_item('{"kind":"wine","id":"wn-1","title":"Шабли"}'::jsonb, array['lesson', 'quiz', 'module', 'ref']) is null
       then 'можно делиться' else 'не включилось' end ||
  ' · подпись: ' || _sa_chat_card_sum('{"t":"share","item":{"kind":"wine","title":"Шабли"}}'::jsonb) as result;
