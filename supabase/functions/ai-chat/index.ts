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

// ── Живой список бесплатных моделей ──────────────────────────────────
// Спрашиваем у самого OpenRouter, какие free-модели существуют СЕЙЧАС
// (их регулярно переименовывают). Кэш на час. Приоритет — сильные в
// русском семейства: DeepSeek → Qwen → Gemini → Llama/Mistral → прочие.
let freeCache: { ids: string[]; at: number } | null = null;
let winner: string | null = null; // модель, ответившая в прошлый раз — её пробуем первой
async function liveFreeModels(): Promise<string[]> {
  if (freeCache && Date.now() - freeCache.at < 3600_000) return freeCache.ids;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models");
    const j = await r.json();
    const items = Array.isArray(j?.data) ? j.data : [];
    const score = (id: string) =>
      /deepseek/.test(id) ? 0 : /qwen/.test(id) ? 1 : /gemini/.test(id) ? 2 :
      /llama|mistral/.test(id) ? 3 : 4;
    const ids = items
      .map((m: { id?: string }) => String(m?.id || ""))
      .filter((id: string) => id.endsWith(":free"))
      .sort((a: string, b: string) => score(a) - score(b));
    if (ids.length) freeCache = { ids, at: Date.now() };
    return ids;
  } catch (_e) {
    return [];
  }
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

    // Кандидаты: секрет OPENROUTER_MODEL (строго он) → живой список с
    // OpenRouter → статический запас на случай, если каталог не ответил.
    const MODEL = Deno.env.get("OPENROUTER_MODEL");
    let candidates = MODEL ? [MODEL] : await liveFreeModels();
    if (!MODEL && winner) candidates = [winner, ...candidates.filter((id) => id !== winner)];
    if (!candidates.length) candidates = [
      "deepseek/deepseek-r1-0528:free",
      "qwen/qwen3-235b-a22b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ];

    // ── История: последние 14 реплик, каждая не длиннее 2000 символов ──
    const history = messages
      .filter((m: { role?: string; content?: string }) =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-14)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content.slice(0, 2000),
      }));

    // Пробуем до четырёх моделей подряд: живой каталог не гарантирует,
    // что у конкретной модели прямо сейчас есть свободные мощности.
    let lastErr = "provider";
    for (const m of candidates.slice(0, 4)) {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://service-academy.app",
          "X-Title": "Service Academy",
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "system", content: buildSystem(emp) }, ...history],
          max_tokens: 520,
          temperature: 0.6,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (reply) { winner = m; return json({ ok: true, reply, model: data?.model || m }); }
        console.error("openrouter", m, "empty_reply");
        lastErr = "empty";
        continue;
      }
      const detail = await resp.text().catch(() => "");
      console.error("openrouter", m, resp.status, detail.slice(0, 200));
      if (m === winner) winner = null; // прошлый чемпион пал — забываем
      // 402/429 = лимит; 404 = модель ушла из free — в любом случае пробуем следующую
      if (resp.status === 429 || resp.status === 402) lastErr = "rate_limit";
      else lastErr = "provider";
    }
    return json({ ok: false, error: lastErr });
  } catch (e) {
    console.error("ai-chat", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
