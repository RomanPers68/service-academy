-- supabase-stage12-storage.sql — Этап 12: фото блюд в Supabase Storage (Дополнение 135).
-- Было: фото сжимались в base64 и жили в localStorage телефона менеджера —
-- лимит ~5 МБ, на других устройствах фото нет. Стало: публичная корзина
-- menu-photos (1 ГБ бесплатно), фото — по ссылке, видны всем.
-- Загрузка идёт через Edge Function photo-upload сервисным ключом после
-- проверки сессии — anon-ключу писать в корзину не разрешено.
-- Безвреден повторно.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-photos', 'menu-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Публичное чтение объектов корзины (для public-bucket ссылка /object/public/… работает и без
-- политики, но явная политика не помешает и делает намерение видимым).
drop policy if exists "menu photos public read" on storage.objects;
create policy "menu photos public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'menu-photos');

select 'storage: корзина menu-photos ' || case when public then 'публичная' else 'ЗАКРЫТА' end as result
from storage.buckets where id = 'menu-photos';
