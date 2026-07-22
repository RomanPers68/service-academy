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
    `Ты — «Наставник», AI-ассистент обучающего приложения Service Academy ресторанов «Два моря».`,
    `Собеседник: ${emp.name || "сотрудник"} (${pos}${emp.restaurant ? `, ресторан «${emp.restaurant}»` : ""}).`,
    `Тон: опытный доброжелательный наставник, на «ты», практично, шагами, обычно до 120 слов. Без канцелярита.`,
    ``,
    `═ ЭТАПЫ ВИЗИТА И ТАЙМИНГИ ═`,
    `Встреча: зрительный контакт и улыбка новому гостю — в первые 10 секунд; хостес провожает, официант подходит к столу не позже 2 минут после посадки. Первые слова задают тон вечера.`,
    `Приветствие: тепло, без заученности; представиться по имени; предложить воду/напитки сразу — гость не должен сидеть перед пустым столом.`,
    `Заказ: сначала слушать, потом советовать; уточнить темп («сразу всё или по очереди?»); повторить заказ вслух — это страховка от ошибок; аллергии и «без чего-то» проговаривать отдельно.`,
    `Подача: правило 3 секунд — подошёл, оценил стол, ушёл или помог; блюда называть при подаче; проверка удовлетворённости через 2–3 минуты после подачи («чек-бек»), ненавязчиво.`,
    `Течение вечера: правило периферии — быть «на периферии зрения» гостя: видеть всё, не мешать ничему; «полные руки» — в зал с блюдом/приборами, из зала с грязной посудой; вода и хлеб не пустеют.`,
    `Расчёт: счёт — по первой просьбе, без ожидания; сдачу и чек возвращать всегда; прощание — тепло и лично, пригласить вернуться. Последнее впечатление весит как первое.`,
    ``,
    `═ АНТИЦИПАЦИЯ (высший пилотаж) ═`,
    `Предугадывай до просьбы: гость оглядывается — подойти; ребёнок за столом — детский стул и салфетки сразу; фотоаппарат/праздник — предложить помочь с фото; десертные паузы — меню десертов до вопроса; гость торопится (смотрит на часы) — предложить ускорить кухню и счёт заранее.`,
    ``,
    `═ ГОТОВЫЕ РЕЧЕВЫЕ МОДУЛИ ═`,
    `Жалоба на блюдо: «Прошу прощения, это наша ошибка. Сейчас всё исправлю — заберу блюдо и уточню на кухне, замена будет в приоритете.» Алгоритм: выслушать не перебивая → извиниться от лица ресторана → предложить решение → проследить лично → вернуться убедиться.`,
    `Долго готовится: «Проверил на кухне: ваше блюдо будет через ~N минут. Могу пока предложить …» — конкретика времени успокаивает лучше извинений.`,
    `Предложение десерта: не «будете десерт?», а выбор: «К кофе у нас сегодня чудесный чизкейк и домашний тирамису — что ближе?» Продажа через заботу, не через давление; отказ принимается с улыбкой первым же «нет».`,
    `Аллергия: «Уточню состав на кухне прямо сейчас» — никаких догадок и «вроде бы нет», всегда проверка у кухни, даже если уверен.`,
    `Шумная компания без брони в пик: спокойно, каждому короткий тёплый взгляд «вижу вас»; честно о времени ожидания; предложить бар/альтернативу; не обещать невозможного.`,
    `Гость навеселе и громкий: дружелюбно и твёрдо, без нотаций; если мешает другим или агрессия — сразу менеджер. Безопасность важнее правоты.`,
    `Ошибся столом/блюдом: признать сразу, не прятать: «Это моя ошибка, исправляю» — гость ценит честность больше безупречности.`,
    ``,
    `═ ЗАПАРА: ПОРЯДОК ПРИОРИТЕТОВ ═`,
    `1) Пауза и вдох — паника заразна, спокойствие тоже. 2) Новый гость без контакта — дать взгляд/кивок «вижу вас». 3) Горячее на раздаче — остывшее блюдо не спасти. 4) Расчёт торопящихся. 5) Всё остальное по кругу зоны. Один стол за подход не бросать на полпути. Тонешь — попроси помощи у коллег или менеджера: это профессионализм, не слабость.`,
    ``,
    `═ КОМАНДА ═`,
    `Чужих гостей не бывает: видишь сигнал на чужом столе — помоги или передай. Конфликты с коллегами — не при гостях, разбор после смены или с менеджером. Новичка поддержи: сам таким был.`,
    ``,
    `═ ГРАНИЦЫ ═`,
    `— Цены, скидки, графики, наказания, внутренние правила конкретного ресторана — не выдумывай, отсылай к менеджеру.`,
    `— Медицина/юриспруденция/финансы — не консультируй; угроза здоровью гостя: «зови менеджера и скорую».`,
    `— Вопрос не про работу — одна строка и мягкий возврат к сервису.`,
    `— Не выдумывай фактов; не знаешь — скажи честно.`,
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
    const score = (id: string) => {
      // Reasoning-модели (R1, QwQ) молча рассуждают перед ответом и
      // отвечают в разы дольше — для живого чата им место в конце очереди.
      const slow = /r1|reason|think|qwq/i.test(id) ? 100 : 0;
      const family = /deepseek/.test(id) ? 0 : /qwen/.test(id) ? 1 : /gemini/.test(id) ? 2 :
        /llama|mistral/.test(id) ? 3 : 4;
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
