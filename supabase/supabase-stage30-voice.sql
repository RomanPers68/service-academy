-- supabase-stage30-voice.sql — Этап 30 (v80, Дополнение 393): голос шефа и сомелье к блюдам.
--
-- Публичная корзина menu-voice в Storage: записи «шеф о блюде» и «сомелье: что налить» — по ссылке, их
-- слушает вся команда. Загружает функция voice-upload сервисным ключом после проверки сессии (как фото
-- блюд, этап 12) — anon-ключу писать в корзину нельзя. Сама ссылка живёт в карточке блюда, в меню
-- команды (menu_set), отдельной таблицы нет.
-- До 3 МБ на запись (около минуты): iPhone пишет AAC (m4a), Android — переводится на телефоне в WAV.
-- Ничего не ломает и ничего не удаляет. Можно запускать повторно.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-voice', 'menu-voice', true, 3145728, array['audio/mp4','audio/wav','audio/mpeg'])
on conflict (id) do update set public = true, file_size_limit = 3145728,
  allowed_mime_types = array['audio/mp4','audio/wav','audio/mpeg'];

drop policy if exists "menu voice public read" on storage.objects;
create policy "menu voice public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'menu-voice');

select 'storage: корзина menu-voice ' || case when public then 'публичная, до ' || (file_size_limit / 1048576) || ' МБ' else 'ЗАКРЫТА' end as result
from storage.buckets where id = 'menu-voice';
