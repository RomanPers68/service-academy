-- ═══════════════════════════════════════════════════════════════════════════════
-- Этап 76 (v225, Доп. 551): фото и голос в базе — путём к файлу, а не полным адресом.
--
-- Владелец (28.11) на разбор «что улучшить»: «остальное делаем». Пункт 4 разбора: фото и голос лежали в меню полными
-- адресами Supabase («https://<проект>.supabase.co/storage/v1/object/public/menu-photos/…»), и в v223, когда приложение
-- пошло к базе через свой сайт, их пришлось переводить на лету. С путём («/storage/v1/object/public/menu-photos/…»)
-- смена адреса базы или сайта данных не трогает: адрес достраивает приложение (lib/supabase.js, sbIn), а сайт сам
-- отдаёт такие пути (vercel.json: /storage/v1/object/public/… → хранилище), так что и прежние версии приложения
-- показывают фото.
--   1) Карточки в чате («Поделиться в чат», стоп-лист): фото пропускались, только если ссылка начинается с https://.
--      Теперь и путь хранилища. Функции _sa_chat_item, chat_stop_note, chat_stop_set берутся из базы как есть (этапы 38
--      и 46), в них меняется только эта проверка.
--   2) Меню (restaurant_menu.dishes): полные адреса хранилища этого проекта (gvxhgdynjuaisswplroh) — путём. Адреса
--      других проектов Supabase не трогаем: путь к ним вёл бы в наше хранилище, где такого файла нет. В копии
--      приложения на другом проекте этот шаг ничего не меняет — там пути пишет само приложение.
-- Можно запускать повторно. Нужен этап 38 (и, если стоит, этап 46 — проверка в нём та же).
-- Supabase → SQL Editor → New query → вставить файл целиком → Run.
-- ═══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._sa_chat_item(jsonb, text[])') is null
     or to_regprocedure('public.chat_stop_set(text, bigint, text, boolean, bigint)') is null
     or to_regprocedure('public.chat_stop_note(text, text, boolean)') is null then
    raise exception 'Сначала этап 38 (supabase-stage38-chat.sql): нужен чат команды';
  end if;
end $$;

-- 1) проверка ссылки на фото в карточках: полный адрес https или путь хранилища
do $$
declare
  f record;
  d text;
  old_re constant text := $q$'^https://[^\s"<>]+$'$q$;
  new_re constant text := $q$'^(https://[^\s"<>]+|/storage/v1/object/public/[^\s"<>]+)$'$q$;
begin
  for f in select p.oid from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
            where ns.nspname = 'public' and p.proname in ('_sa_chat_item', 'chat_stop_note', 'chat_stop_set') loop
    d := pg_get_functiondef(f.oid);
    if strpos(d, old_re) > 0 then
      execute replace(d, old_re, new_re);
    end if;
  end loop;
end $$;

-- 2) меню: полные адреса хранилища — путём (меню команды — этап 4; его нет — менять нечего)
do $$
begin
  if to_regclass('public.restaurant_menu') is not null then
    update restaurant_menu
       set dishes = regexp_replace(dishes::text, 'https://gvxhgdynjuaisswplroh\.supabase\.co(/storage/v1/object/public/)', '\1', 'g')::jsonb
     where dishes::text ~ 'https://gvxhgdynjuaisswplroh\.supabase\.co/storage/v1/object/public/';
  end if;
end $$;

-- признак этапа: путь, с которого начинаются ссылки хранилища в базе
create or replace function _sa_storage_path()
returns text language sql immutable set search_path to public as $$ select '/storage/v1/object/public/'::text $$;
