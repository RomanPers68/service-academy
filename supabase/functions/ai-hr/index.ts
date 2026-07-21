// supabase/functions/ai-hr/index.ts
// ─────────────────────────────────────────────────────────────────────
// AI HR Service Academy: ИИ-интервьюер для собеседования кандидатов.
// Два режима: "chat" — ведёт структурированное интервью по компетенциям
// (по одному вопросу-ситуации), "assess" — по транскрипту возвращает
// строгий JSON с оценками по компетенциям и вердиктом.
// Авторизация через whoami; ключ и выбор модели — как в ai-chat
// (живой каталог free-моделей, память победителя). Секрет OPENROUTER_API_KEY
// уже задан на проекте — отдельный для этой функции не нужен.
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

// Компетенции интервью по ролям (совпадают с банком собеседования)
const ROLE_COMPS: Record<string, string[]> = {
  waiter: ["Сервис и гость", "Конфликты и сложные ситуации", "Приоритеты и организация", "Честность и деньги", "Команда"],
  hostess: ["Сервис и гость", "Конфликты и сложные ситуации", "Приоритеты и организация", "Команда", "Общие стандарты"],
  manager: ["Команда и люди", "Конфликты и сложные ситуации", "Приоритеты и организация", "Честность и деньги", "Общие стандарты"],
};
const ROLE_LABEL: Record<string, string> = { waiter: "официант", hostess: "хостес", manager: "менеджер" };

function buildInterviewer(roleId: string, cand: { name?: string; expLabel?: string; place?: string }) {
  const comps = ROLE_COMPS[roleId] ?? ROLE_COMPS.waiter;
  const roleRu = ROLE_LABEL[roleId] ?? "сотрудник зала";
  return [
    `Ты — доброжелательный интервьюер ресторанов «Два моря» (Service Academy). Проводишь собеседование кандидата на позицию «${roleRu}».`,
    `Кандидат: ${cand.name || "кандидат"}${cand.expLabel ? `, опыт: ${cand.expLabel}` : ""}${cand.place ? ` (${cand.place})` : ""}.`,
    ``,
    `Протокол интервью (соблюдай строго):`,
    `1. Всего 5 основных вопросов — по одному на каждую компетенцию, в этом порядке: ${comps.join("; ")}.`,
    `2. Каждый вопрос — конкретная рабочая ситуация из жизни ресторана под роль «${roleRu}» (2–3 предложения максимум). Не абстрактные «расскажите о себе», а «представьте: …— что делаете?».`,
    `3. Задавай СТРОГО по одному вопросу за сообщение. Дождись ответа.`,
    `4. Если ответ пустой, односложный или уклончивый — задай ОДИН короткий уточняющий вопрос по той же ситуации, затем переходи дальше. Не больше одного уточнения на тему.`,
    `5. Не оценивай ответы вслух, не подсказывай «правильный» ответ, не учи. Нейтрально-тепло: «понял», «спасибо» — и следующий вопрос.`,
    `6. Первое сообщение: поздоровайся по имени, одна фраза о формате («несколько рабочих ситуаций, отвечайте как поступили бы на самом деле») и сразу вопрос №1.`,
    `7. После ответа на пятую тему поблагодари и скажи ровно: «У меня всё — нажмите „Завершить интервью", чтобы получить результат.»`,
    `8. Пиши на «вы», по-русски, без смайликов, каждое сообщение до 60 слов.`,
    `9. Если кандидат уходит от темы или задаёт встречные вопросы о зарплате/графике — вежливо скажи, что это обсудит менеджер после, и вернись к вопросу.`,
  ].join("\n");
}

function buildAssessor(roleId: string) {
  const comps = ROLE_COMPS[roleId] ?? ROLE_COMPS.waiter;
  return [
    `Ты — опытный HR-эксперт ресторанной сферы. Тебе дан транскрипт собеседования кандидата.`,
    `Оцени ответы кандидата по компетенциям. Критерии: клиентоориентированность, спокойствие в конфликте, здравые приоритеты, честность, командность; конкретика и реализм ответов ценятся выше красивых слов; пустые/уклончивые ответы — низкий балл.`,
    `Ответь ТОЛЬКО валидным JSON без пояснений, без markdown, ровно такой структуры:`,
    `{"scores":{${comps.map((c) => `"${c}":0`).join(",")}},"verdict":"2–3 предложения общего вывода о кандидате","strengths":["сильная сторона 1","сильная сторона 2"],"risks":["риск или зона роста 1","риск 2"]}`,
    `Каждый score — целое число 0–100. Если по компетенции ответа не было — ставь 35 и упомяни это в risks.`,
  ].join("\n");
}

// ── Выбор модели: живой каталог free + память победителя (как в ai-chat) ──
let freeCache: { ids: string[]; at: number } | null = null;
let winner: string | null = null;
async function liveFreeModels(): Promise<string[]> {
  if (freeCache && Date.now() - freeCache.at < 3600_000) return freeCache.ids;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models");
    const j = await r.json();
    const items = Array.isArray(j?.data) ? j.data : [];
    const score = (id: string) => {
      const slow = /r1|reason|think|qwq/i.test(id) ? 100 : 0;
      const family = /deepseek/.test(id) ? 0 : /qwen/.test(id) ? 1 : /gemini/.test(id) ? 2 : /llama|mistral/.test(id) ? 3 : 4;
      return slow + family;
    };
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
    const { token, mode, role, candidate, messages } = await req.json();
    if (!token || !Array.isArray(messages)) return json({ ok: false, error: "bad_request" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const who = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whoami`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    }).then((r) => r.json()).catch(() => null);
    if (!who || who.ok !== true) return json({ ok: false, error: "auth" }, 401);

    const API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!API_KEY) return json({ ok: false, error: "not_configured" });

    const assess = mode === "assess";
    const system = assess ? buildAssessor(role) : buildInterviewer(role, candidate || {});
    const history = messages
      .filter((m: { role?: string; content?: string }) =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-30)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 1500) }));

    const MODEL = Deno.env.get("OPENROUTER_MODEL");
    let candidates = MODEL ? [MODEL] : await liveFreeModels();
    if (!MODEL && winner) candidates = [winner, ...candidates.filter((id) => id !== winner)];
    if (!candidates.length) candidates = ["deepseek/deepseek-chat-v3-0324:free", "qwen/qwen3-235b-a22b:free"];

    let lastErr = "provider";
    for (const m of candidates.slice(0, 4)) {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://service-academy.app",
          "X-Title": "Service Academy HR",
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "system", content: system }, ...history],
          max_tokens: assess ? 650 : 260,
          temperature: assess ? 0.2 : 0.7,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (!reply) { lastErr = "empty"; continue; }
        winner = m;
        if (!assess) return json({ ok: true, reply, model: data?.model || m });
        // ── режим оценки: парсим строгий JSON ──
        try {
          const clean = reply.replace(/```json|```/g, "").trim();
          const start = clean.indexOf("{");
          const end = clean.lastIndexOf("}");
          const parsed = JSON.parse(clean.slice(start, end + 1));
          const comps = ROLE_COMPS[role] ?? ROLE_COMPS.waiter;
          const scores: Record<string, number> = {};
          for (const c of comps) {
            const v = Number(parsed?.scores?.[c]);
            scores[c] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 35;
          }
          return json({
            ok: true,
            scores,
            verdict: String(parsed?.verdict || "").slice(0, 600),
            strengths: (Array.isArray(parsed?.strengths) ? parsed.strengths : []).slice(0, 3).map((s: unknown) => String(s).slice(0, 160)),
            risks: (Array.isArray(parsed?.risks) ? parsed.risks : []).slice(0, 3).map((s: unknown) => String(s).slice(0, 160)),
            model: data?.model || m,
          });
        } catch (_e) {
          console.error("ai-hr parse fail", reply.slice(0, 200));
          lastErr = "parse";
          continue; // пробуем следующую модель — вдруг она вернёт чистый JSON
        }
      }
      const detail = await resp.text().catch(() => "");
      console.error("ai-hr", m, resp.status, detail.slice(0, 200));
      if (m === winner) winner = null;
      lastErr = resp.status === 429 || resp.status === 402 ? "rate_limit" : "provider";
    }
    return json({ ok: false, error: lastErr });
  } catch (e) {
    console.error("ai-hr", e);
    return json({ ok: false, error: "server" }, 500);
  }
});
