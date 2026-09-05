-- supabase-stage12b-bucket-only.sql — только корзина для фото (Дополнение 188).
-- Прежний stage12 падал на create policy (в новых проектах политики storage
-- из SQL не создаются) и откатывался целиком — корзина не появлялась.
-- Публичной корзине политика чтения не нужна: ссылки /object/public/… работают сами.

insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do update set public = true;

select id, name, public, created_at from storage.buckets order by created_at;
