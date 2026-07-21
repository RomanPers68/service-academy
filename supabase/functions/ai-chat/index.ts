// supabase/functions/ai-chat/index.ts
// ─────────────────────────────────────────────────────────────────────
// AI-ассистент Service Academy: серверная прослойка между приложением
// и OpenRouter. Ключ провайдера живёт только здесь, в секретах Supabase.
// Авторизация — через вашу же функцию whoami(p_token): отвечаем только
// реальным сотрудникам. Секреты: OPENROUTER_API_KEY (обязательный),
// OPENROUTER_MODEL (необязательный, по умолчанию бесплатный DeepSeek).
// ─────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Системный промпт: кто такой ассистент и по каким стандартам он живёт.
function buildSystem(emp: { name?: string; position?: string; restaurant?: string }) {
  const posLabel: Record<string, string> = {
    waiter: "официант", hostess: "хостес", manager: "менеджер",
    senior: "руководитель", spg: "хостес (СПГ)",
  };
  const pos = posLabel[emp.position ?? ""] ?? "сотрудник зала";
  return [
    `Ты — «Наставник», AI-ассистент обучающего приложения Service Academy для ресторанов «Два моря».`,
    `Сейчас с тобой говорит ${emp.name || "сотрудник"} (${pos}${emp.restaurant ? `, ресторан «${emp.restaurant}»` : ""}).`,
    ``,
    `Твоя роль: опытный, доброжелательный наставник по сервису. Отвечай на «ты», по-дружески, коротко и практично — обычно до 120 слов, шагами или короткими абзацами. Без канцелярита.`,
    ``,
    `Стандарты Service Academy (опирайся на них):`,
    `— Зрительный контакт с новым гостем — в первые 10 секунд; подход к столу — не позже 2 минут после посадки.`,
    `— «Полные руки»: в зал — с блюдом или приборами, из зала — с грязной посудой.`,
    `— Правило периферии: официант всегда «на периферии зрения» гостя — видит всё, не мешает ничему.`,
    `— Антиципация: предугадывай потребности гостя до просьбы — высший уровень сервиса.`,
    `— Жалоба: выслушать не перебивая → извиниться от лица ресторана → предложить решение → проследить и вернуться к гостю.`,
    `— Аллергии: никаких догадок — состав уточняется у кухни всегда.`,
    `— Конфликт с агрессией: спокойствие и сразу менеджер; безопасность важнее правоты.`,
    ``,
    `Границы:`,
    `— Внутренние правила конкретного ресторана (цены, скидки, графики, наказания) не выдумывай — честно отсылай к менеджеру.`,
    `— Не давай медицинских, юридических и финансовых советов; при угрозе здоровью гостя — «зови менеджера и скорую».`,
    `— Если вопрос совсем не про работу в ресторане — ответь в одну строку и мягко верни к теме сервиса.`,
    `— Не выдумывай фактов. Не знаешь — так и скажи.`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  try {
    const { token, messages } = await req.json();
    if (!token || !Array.isArray(messages)) return json({ ok: false, error: "bad_request" }, 400);

    // ── Авторизация через whoami: только реальные сотрудники ──
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const who = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whoami`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    }).then((r) => r.json()).catch(() => null);
    if (!who || who.ok !== true) return json({ ok: false, error: "auth" }, 401);
    const emp = who.employee || {};

    // ── Ключ провайдера ──
    const API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!API_KEY) return json({ ok: false, error: "not_configured" });
    const MODEL = Deno.env.get("OPENROUTER_MODEL") || "deepseek/deepseek-chat-v3-0324:free";

    // ── История: последние 14 реплик, каждая не длиннее 2000 символов ──
    const history = messages
      .filter((m: { role?: string; content?: string }) =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-14)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content.slice(0, 2000),
      }));

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://service-academy.app",
        "X-Title": "Service Academy",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: buildSystem(emp) }, ...history],
        max_tokens: 700,
        temperature: 0.6,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      // 402/429 у бесплатных моделей = кончился дневной лимит
      const err = resp.status === 429 || resp.status === 402 ? "rate_limit" : "provider";
      console.error("openrouter", resp.status, detail.slice(0, 300));
      return json({ ok: false, error: err });
    }
    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ ok: false, error: "empty" });
    return json({ ok: true, reply, model: MODEL });
  } catch (e) {
    console.error("ai-chat", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
