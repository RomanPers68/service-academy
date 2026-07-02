// supabase/functions/daily-reminder/index.ts
// Этап 3 — «Вопрос дня» в Telegram перед сменой.
//
// Что делает: берёт всех сотрудников с сохранённым tg_chat_id и присылает им
// короткое сообщение с вопросом дня и кнопкой, открывающей приложение.
//
// Как развернуть — см. UPGRADE_NOTES.md в корне проекта (шаги 1–5).
// Секреты (Dashboard → Edge Functions → Secrets):
//   TG_BOT_TOKEN  — токен бота от @BotFather
//   APP_URL       — ссылка на приложение (например, https://your-app.vercel.app)

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

// Пул «вопросов дня» — можно расширять или заменить выборкой из своей таблицы
const QUESTIONS = [
  "Через сколько секунд гость должен получить первый контакт после входа? 🤝",
  "Что означает L.A.S.T. при работе с жалобой? 🛡️",
  "Когда предлагать повтор напитка по «правилу двух пальцев»? 🥂",
  "Что обязательно уточнить у гостя ДО отправки заказа на кухню? ⚠️",
  "Чем check back отличается от простого «всё нормально?» 💬",
  "Что такое стоп-лист и где его узнают перед сменой? 📋",
  "Почему нельзя убирать нетронутое блюдо без вопроса? 🍽️",
  "Какая прожарка не рекомендуется для филе-миньона и почему? 🥩",
  "Что делать, если не знаешь ответа на вопрос гостя? 🤔",
  "В чём суть «эффекта края» и как он влияет на прощание с гостем? ✨",
];

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role — функция работает на сервере
  );
  const botToken = Deno.env.get("TG_BOT_TOKEN");
  const appUrl = Deno.env.get("APP_URL") || "";
  if (!botToken) return new Response("TG_BOT_TOKEN не задан", { status: 500 });

  // Все, кто открывал приложение в Telegram и у кого сохранён chat id
  const { data: users, error } = await supabase
    .from("profiles")
    .select("tg_chat_id")
    .not("tg_chat_id", "is", null);
  if (error) return new Response("DB error: " + error.message, { status: 500 });

  const q = QUESTIONS[new Date().getDate() % QUESTIONS.length];
  const text = `✦ SERVICE ACADEMY\n\nВопрос дня:\n${q}\n\nПроверь себя за 2 минуты 👇`;

  let sent = 0;
  for (const u of users ?? []) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: u.tg_chat_id,
          text,
          reply_markup: appUrl ? { inline_keyboard: [[{ text: "Открыть академию ✦", url: appUrl }]] } : undefined,
        }),
      });
      if (res.ok) sent++;
    } catch (_e) { /* один недоступный чат не должен ломать рассылку */ }
  }
  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
