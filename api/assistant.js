// api/assistant.js — Этап 5 (СПЯЩИЙ): AI-наставник для сотрудников.
// Корень заложен, но UI к нему ещё не подключён. Как включить, когда придёт время:
//   1. Vercel → Environment Variables → ANTHROPIC_API_KEY (тот же, что для menu-import)
//   2. Добавить экран чата в приложение (см. lib/assistant.js — клиентская обвязка готова)
// Без ключа функция честно отвечает 501 и ничего не стоит.
//
// Актуальные модели и цены: https://docs.claude.com/en/api/overview
// На старте — claude-sonnet-4-6; при росте нагрузки простые вопросы можно
// уводить на haiku (см. docs/UPGRADE_NOTES.md, раздел «Корни под AI»).

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const SYSTEM = `Ты — «Наставник» академии сервиса ресторанной группы. Ты помогаешь официантам,
хостес и менеджерам прямо в смене. Правила, которые нельзя нарушать:
1. Отвечай ТОЛЬКО на основе переданных фрагментов базы знаний (уроки, глоссарий, меню).
2. Аллергены называй строго по карточкам блюд. Если блюда или аллергена нет в данных —
   отвечай: «В базе этого нет — уточни у шефа или менеджера». НИКОГДА не угадывай аллергены.
3. Отвечай коротко и практично, как старший коллега в зале: 2-5 предложений, по-русски.
4. Не обсуждай темы вне сервиса, меню и стандартов ресторана.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: "Ассистент ещё не включён (нет ANTHROPIC_API_KEY)" });

  const { question, context, history } = req.body || {};
  if (!question) return res.status(400).json({ error: "Пустой вопрос" });

  try {
    const messages = [
      ...(Array.isArray(history) ? history.slice(-8) : []), // короткая память диалога
      { role: "user", content: `База знаний (фрагменты, отобранные приложением):\n${String(context || "").slice(0, 12000)}\n\nВопрос сотрудника: ${String(question).slice(0, 1000)}` },
    ];
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 700, system: SYSTEM, messages }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data && data.error && data.error.message) || "Ошибка API" });
    const text = (data.content || []).map(c => c.text || "").join("");
    return res.status(200).json({ answer: text });
  } catch (e) {
    return res.status(500).json({ error: "Сбой ассистента: " + (e && e.message ? e.message : "unknown") });
  }
}
