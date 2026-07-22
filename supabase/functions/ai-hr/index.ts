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

// Эталонные вопросы-ситуации: по 2 варианта на компетенцию (ротация между
// кандидатами). Модель выбирает из банка, а не сочиняет — качество и
// логичность вопросов детерминированы.
const QUESTION_BANK: Record<string, Record<string, string[]>> = {
  waiter: {
    "Сервис и гость": [
      "Гость сел за ваш стол 5 минут назад, а вы были заняты другим столом и только освободились. Подходите — гость выглядит недовольным. Что скажете?",
      "Гость долго смотрит в меню и говорит: «Даже не знаю, всё какое-то непонятное». Ваши действия?",
    ],
    "Конфликты и сложные ситуации": [
      "Гость попробовал блюдо и говорит: «Это несъедобно, унесите». Ваши действия по шагам?",
      "Гость утверждает, что заказывал без лука, а в блюде лук. Вы помните, что про лук он не говорил. Что делаете?",
    ],
    "Приоритеты и организация": [
      "Одновременно: новые гости сели за стол, на раздаче остывает горячее, а третий стол просит счёт. В каком порядке действуете и почему?",
      "Вы несёте заказ, и по пути другой гость просит вас принести воды. Как поступите?",
    ],
    "Честность и деньги": [
      "Вы принесли счёт, гость расплатился и ушёл, а потом вы заметили, что в счёт не попало одно блюдо. Ваши действия?",
      "Гость оставил на столе телефон и ушёл. Что делаете?",
    ],
    "Команда": [
      "Вы видите, что у коллеги «горит» зона: гости ждут, он не успевает. У вас относительно спокойно. Ваши действия?",
      "Кухня отдала блюдо с опозданием, гость высказал претензию вам. Повар говорит «не моя проблема». Как поступите с гостем и с поваром?",
    ],
  },
  hostess: {
    "Сервис и гость": [
      "Гости зашли, а вы говорите по телефону с бронью. Как поступите в первые секунды?",
      "Гость спрашивает: «А у вас тут вообще вкусно?» Что ответите?",
    ],
    "Конфликты и сложные ситуации": [
      "Гость с бронью пришёл, а его стол ещё занят — предыдущие гости засиделись. Гость раздражён. Ваши действия?",
      "Компания хочет именно стол у окна, но он забронирован на ближайшее время. Гости настаивают. Что скажете?",
    ],
    "Приоритеты и организация": [
      "Одновременно: звонит телефон с бронью, у стойки ждут новые гости, и уходящая пара хочет попрощаться. Порядок действий?",
      "В пик подходят два потока: пара и шумная компания из восьми человек без брони. Как рассадите и что скажете каждым?",
    ],
    "Команда": [
      "Официант просит «не сажать пока» в его зону — не успевает, а свободные столы только там. Гости ждут. Ваши действия?",
      "Вы заметили, что новенькая хостес путается со схемой залов при гостях. Что сделаете?",
    ],
    "Общие стандарты": [
      "Гость с маленьким ребёнком заходит в зал. Что сделаете сверх обычной рассадки?",
      "Постоянный гость пришёл в час пик без брони. Свободных столов нет. Что предложите?",
    ],
  },
  manager: {
    "Команда и люди": [
      "Официант второй раз за неделю опаздывает на смену. Хороший работник, гости его любят. Ваши действия?",
      "Два сотрудника конфликтуют между собой, атмосфера в смене портится. Как будете разбираться?",
    ],
    "Конфликты и сложные ситуации": [
      "Гость требует жалобную книгу и кричит на официанта в зале. Ваши действия по шагам?",
      "Гость утверждает, что отравился у вас вчера, и требует компенсацию. Что делаете?",
    ],
    "Приоритеты и организация": [
      "Пятница, пик: заболел один официант, кухня задерживает отдачу, и пришла проверка постановки на учёт. Что делаете в первую очередь?",
      "Вы видите, что один официант системно перегружен, а другой простаивает. Ваши действия сейчас и на будущее?",
    ],
    "Честность и деньги": [
      "Кассовый отчёт не сходится на небольшую сумму, подозрение на ошибку конкретного сотрудника. Ваши действия?",
      "Сотрудник предлагает «пробивать мимо кассы» постоянным гостям для скорости. Ваша реакция?",
    ],
    "Общие стандарты": [
      "Вы заметили, что вечером команда «срезает» стандарты: не повторяет заказ, забывает чек-бек. Как вернёте стандарты, не убив мотивацию?",
      "Новичок вышел на первую смену в пятницу. Как организуете его вечер?",
    ],
  },
};

function buildInterviewer(roleId: string, cand: { name?: string; expLabel?: string; place?: string }) {
  const comps = ROLE_COMPS[roleId] ?? ROLE_COMPS.waiter;
  const roleRu = ROLE_LABEL[roleId] ?? "сотрудник зала";
  const bank = QUESTION_BANK[roleId] ?? QUESTION_BANK.waiter;
  const bankText = comps.map((c, i) => `Тема ${i + 1} «${c}»:\n  а) ${bank[c]?.[0] ?? ""}\n  б) ${bank[c]?.[1] ?? ""}`).join("\n");
  return [
    `Ты — доброжелательный интервьюер ресторанов «Два моря». Собеседуешь кандидата на позицию «${roleRu}».`,
    `Кандидат: ${cand.name || "кандидат"}${cand.expLabel ? `, опыт: ${cand.expLabel}` : ""}${cand.place ? ` (${cand.place})` : ""}.`,
    ``,
    `БАНК ВОПРОСОВ (задавай СТРОГО отсюда — по одному вопросу на тему, выбери вариант «а» или «б», можно чуть подстроить под опыт, но суть ситуации не меняй):`,
    bankText,
    ``,
    `ПРОТОКОЛ:`,
    `1. Первое сообщение: поздоровайся по имени, одна фраза о формате («задам несколько рабочих ситуаций — отвечайте, как поступили бы на самом деле, можно коротко и своими словами») и сразу вопрос Темы 1.`,
    `2. Строго один вопрос за сообщение. Формат вопроса: ситуация в 1–2 простых предложениях + прямой вопрос «Ваши действия?» или «Что скажете гостю?». Никаких двойных вопросов, вложенных условий и «а также».`,
    `3. Ответ получен → короткое нейтральное «понял, спасибо» → вопрос следующей темы. Не оценивай вслух, не подсказывай, не учи.`,
    `4. Только если ответ пустой или «не знаю» — ОДНО простое уточнение по той же ситуации, затем дальше. Краткий, но содержательный ответ — норм, уточнение не нужно.`,
    `5. После ответа на Тему 5 поблагодари и скажи ровно: «У меня всё — нажмите „Завершить интервью", чтобы получить результат.»`,
    `6. На «вы», по-русски, без смайликов, каждое сообщение до 50 слов.`,
    `7. Встречные вопросы про зарплату/график: «это обсудите с менеджером после» — и вернись к текущему вопросу.`,
  ].join("\n");
}


function buildAssessor(roleId: string) {
  const comps = ROLE_COMPS[roleId] ?? ROLE_COMPS.waiter;
  return [
    `Ты — опытный и СПРАВЕДЛИВЫЙ HR-эксперт ресторанной сферы. Дан транскрипт собеседования. Оцени кандидата по фактам его ответов — не выдумывай недостатков и не требуй эссе: это чат с телефона, краткий ответ с верными действиями — это ХОРОШИЙ ответ.`,
    ``,
    `КАЛИБРОВКА НА ПРИМЕРАХ (вопрос: «гость говорит, блюдо несъедобно — ваши действия?»):`,
    `≈90: «Извинюсь от лица ресторана, сразу заберу блюдо, уточню у гостя, что именно не так, предложу замену или другое блюдо в приоритете, потом вернусь убедиться, что всё ок» — конкретные шаги + забота + контроль результата.`,
    `≈75: «Извинюсь, заберу блюдо и предложу замену» — верные действия, коротко, без деталей. Это уверенный профессиональный ответ, НЕ занижай его за краткость.`,
    `≈55: «Позову менеджера, пусть решает» — не ошибка, но перекладывание; направление есть, самостоятельности нет.`,
    `≈35: «Ну скажу, что так готовим, не нравится — не ешьте» / «не знаю» — уклонение или анти-сервис без агрессии.`,
    `≈10: ответ с грубостью, матом, «сам виноват», враньём гостю.`,
    ``,
    `ПРАВИЛА:`,
    `— Верные действия + забота о госте = 70+. Плюс детали/тайминги/предусмотрительность = 85+. Требовать больше — придирка.`,
    `— Краткость НЕ штраф. Штраф — пустота, уклончивость, «не знаю», красивые слова без единого действия (такое ≤55).`,
    `— Если было уточнение интервьюера — оценивай сумму двух ответов.`,
    `— КРАСНЫЕ ФЛАГИ (0–20 по компетенции + обязательно в risks): мат, грубость, пренебрежение к гостям/коллегам даже «в шутку», агрессия, готовность обмануть гостя или ресторан, «пусть ждут / не моя проблема». Более одного флага — вердикт начинается с «Не рекомендован».`,
    `— Нет ответа по теме — 35 и пометка в risks.`,
    ``,
    `Вердикт начинай с одного из: «Рекомендован» (средний балл 70+ без флагов), «Рекомендован с оговорками» (55–69 или один слабый ответ), «Не рекомендован» (ниже 55 или флаги) — и кратко почему, по-человечески.`,
    `Ответь ТОЛЬКО валидным JSON без пояснений и markdown, ровно такой структуры:`,
    `{"scores":{${comps.map((c) => `"${c}":0`).join(",")}},"verdict":"...","strengths":["...","..."],"risks":["...","..."]}`,
    `Каждый score — целое 0–100.`,
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
