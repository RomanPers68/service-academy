-- График «Два моря, Океан» на последние 12 дней (текущий и, если нужно, прошлый месяц):
-- Анна — вечер каждый день; Илья — день, но позавчера выходной; Мария — утро;
-- Пётр — сегодня выходной, в другие дни день; «Кто-то Неизвестный» — сегодня вечер.
do $$
declare ld date := (now() at time zone 'Asia/Kamchatka')::date; d date; i int; mk text; dn text;
  plans jsonb := '{}'::jsonb; m text; pl jsonb;
begin
  insert into schedule_venues (restaurant, venue_key, title, config) values ('Два моря, Океан', 'main', 'Океан',
    jsonb_build_object('staff', jsonb_build_array(
      jsonb_build_object('id', 's1', 'name', 'Анна Смирнова'), jsonb_build_object('id', 's2', 'name', 'Илья Бармен'),
      jsonb_build_object('id', 's3', 'name', 'Мария'), jsonb_build_object('id', 's4', 'name', 'Пётр Иванов'),
      jsonb_build_object('id', 's5', 'name', 'Кто-то Неизвестный')),
      'shifts', '[{"k":"У","name":"Утро","from":10,"to":18},{"k":"Д","name":"День","from":12,"to":20},{"k":"В","name":"Вечер","from":16,"to":24}]'::jsonb));
  for i in 0..12 loop
    d := ld - i; mk := to_char(d, 'YYYY-MM'); dn := extract(day from d)::int::text;
    if not plans ? mk then plans := plans || jsonb_build_object(mk, '{"s1":{},"s2":{},"s3":{},"s4":{},"s5":{}}'::jsonb); end if;
    plans := jsonb_set(plans, array[mk, 's1', dn], to_jsonb('В'::text));
    plans := jsonb_set(plans, array[mk, 's2', dn], to_jsonb(case when i = 2 then 'О' else 'Д' end));
    plans := jsonb_set(plans, array[mk, 's3', dn], to_jsonb('У'::text));
    plans := jsonb_set(plans, array[mk, 's4', dn], to_jsonb(case when i = 0 then 'О' else 'Д' end));
    if i = 0 then plans := jsonb_set(plans, array[mk, 's5', dn], to_jsonb('В'::text)); end if;
  end loop;
  for m, pl in select key, value from jsonb_each(plans) loop
    insert into schedule_months (restaurant, venue_key, month, payload) values ('Два моря, Океан', 'main', m, jsonb_build_object('plan', pl));
  end loop;
end $$;
-- настройки поясов (этап 22б) — пустая таблица, тесты заполняют сами
create table if not exists sa_settings (key text primary key, value text not null, updated_at timestamptz default now());
