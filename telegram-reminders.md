# Telegram-напоминания о повторении (этап 3 → включение)

Корни уже заложены в приложении: при входе через Telegram сохраняется
`tg_id` пользователя (RPC `sa_set_tg`, вызывается из App.jsx). Осталось
серверное звено: раз в день пройтись по пользователям и написать тем,
у кого накопились вопросы на повторение.

ВАЖНО: код ниже — заготовка. Я не могу проверить его на твоём Supabase,
поэтому перед включением прогони на тестовом пользователе.

## Шаг 1. Таблица (если RPC sa_set_tg ещё не создан)

```sql
alter table profiles add column if not exists tg_id bigint;

create or replace function sa_set_tg(p_token text, p_tg_id bigint)
returns json language plpgsql security definer as $$
declare emp record;
begin
  select e.* into emp from sessions s join employees e on e.id = s.employee_id
    where s.token = p_token limit 1;
  if emp is null then return json_build_object('ok', false); end if;
  update profiles set tg_id = p_tg_id where user_id = emp.id;
  return json_build_object('ok', true);
end $$;
```
(Подстрой имена таблиц под свою схему — sessions/employees/profiles.)

## Шаг 2. Edge Function `remind` (supabase/functions/remind/index.ts)

```ts
// Ежедневное напоминание: «N вопросов ждут повторения».
// Банк ошибок живёт на устройстве (localStorage), поэтому серверу
// известна только активность. Стратегия: пишем тем, кто был активен,
// но не заходил 2+ дня — мягкий возврат без давления.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BOT = Deno.env.get("TG_BOT_TOKEN")!; // токен бота из @BotFather
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async () => {
  // Кто не заходил 2–7 дней (за пределами недели не тревожим)
  const { data: rows } = await sb.rpc("sa_reminder_targets"); // см. шаг 3
  let sent = 0;
  for (const r of rows ?? []) {
    if (!r.tg_id) continue;
    const text =
      `Привет, ${r.name}! 👋 В «Работе над ошибками» тебя ждут вопросы ` +
      `на повторение — интервалы подошли. 5 минут — и они закрепятся.`;
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: r.tg_id, text }),
    });
    sent++;
  }
  return new Response(JSON.stringify({ ok: true, sent }));
});
```

## Шаг 3. RPC выборки адресатов

```sql
create or replace function sa_reminder_targets()
returns table(name text, tg_id bigint) language sql security definer as $$
  select p.name, p.tg_id
  from profiles p
  where p.tg_id is not null
    and p.last_seen between now() - interval '7 days'
                        and now() - interval '2 days';
$$;
```
Если колонки `last_seen` нет — добавь и обновляй её в `whoami`.

## Шаг 4. Расписание

Supabase → Edge Functions → remind → Schedule: `0 9 * * *` (9:00 UTC ≈
полдень по Москве — до вечерней смены). Секреты: TG_BOT_TOKEN.

## Шаг 5. Кнопка в сообщении (опционально)

Добавь в sendMessage `reply_markup` с кнопкой-ссылкой на мини-апп:
`{"inline_keyboard":[[{"text":"Повторить сейчас","url":"https://t.me/ВАШ_БОТ/app"}]]}`
