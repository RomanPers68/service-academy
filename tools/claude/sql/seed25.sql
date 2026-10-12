-- Этап 25: Telegram у Ильи, Марии и Петра (у Анны — из seed.sql), сотрудник без связки — Иван
insert into tg_links (emp_id, chat_id, restaurant, full_name, remind) values
  ('00000000-0000-0000-0000-0000000000a5', 222, 'Два моря, Океан', 'Илья Бармен', true),
  ('00000000-0000-0000-0000-0000000000a2', 333, 'Два моря, Океан', 'Мария Ким', true),
  ('00000000-0000-0000-0000-0000000000a3', 444, 'Два моря, Океан', 'Пётр Иванов', true)
on conflict (emp_id) do nothing;
update tg_links set restaurant = 'Два моря, Океан', full_name = 'Анна Смирнова', remind = true where emp_id = '00000000-0000-0000-0000-0000000000a4';
