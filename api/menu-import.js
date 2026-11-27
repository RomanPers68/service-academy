// api/menu-import.js — Этап 4: AI-импорт меню из PDF.
// Vercel автоматически превращает этот файл в серверную функцию POST /api/menu-import.
//
// Ключ (Дополнение 122): OPENROUTER_API_KEY — тот же OpenRouter, что у HR-бота,
// AI-чата и голоса в Supabase. Настройка одним действием:
//   Vercel → Project → Settings → Environment Variables → Add
//   Key: OPENROUTER_API_KEY   Value: sk-or-v1-…   → Save → Deployments → Redeploy.
// Совместимость: если задан только старый ANTHROPIC_API_KEY — функция, как раньше,
// ходит напрямую в Anthropic. Если заданы оба — приоритет у OpenRouter.
//
// Модель по умолчанию — anthropic/claude-sonnet-4.6 (читает PDF целиком, включая
// сканы и карточки-картинки; аллергены — вопрос безопасности гостя, тут нужна
// сильная модель). Запасная — google/gemini-2.5-flash. Сменить модель без
// правки кода: переменная OPENROUTER_MENU_MODEL в Vercel.
// Документация: https://openrouter.ai/docs/features/multimodal/pdfs
//
// v204 (Доп. 530): по частям. Одним запросом модель писала все блюда сразу — дольше минуты, и хостинг обрывал запрос
// своей страницей (у владельца зимнее меню, 2 страницы, 10 позиций, — «Сеть недоступна…»). Теперь режимы:
//   mode: "names"   → { names: [{ name, cat }], model } — только список позиций, ответ за секунды;
//   mode: "details" → { dishes, missing, model } — подробности для names (до 6 названий), по порядку запроса;
//   без mode — как раньше, всё сразу (старая сборка приложения).
// Каждый запрос не дольше MENU_AI_TOTAL_MS (по умолчанию 50 с; модель, что молчит дольше MENU_AI_EACH_MS — 40 с, не держит
// запрос): не успел никто — ответ 504 словами, а не страницей хостинга. Импорты считаются по запросам списка (8 в час),
// подробности — свой счёт (120 в час). Общее с приложением и демо — lib/menu-import.js.

export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

import { verifySession, rateLimit } from "./_auth.js";
import { cleanNames, askNames, pickRequested } from "../lib/menu-import.js";   // v204

const ALLERGENS = ["Глютен", "Рыба", "Моллюски и ракообразные", "Яйца", "Молоко", "Орехи", "Соя", "Кунжут"];

const PROMPT = `Ты — методист ресторанной академии. В приложённом PDF — карточки блюд меню.
Верни ТОЛЬКО валидный JSON-массив (без markdown, без пояснений). Каждый элемент:
{
  "name": "название блюда",
  "cat": "раздел меню — выбери один: Холодные закуски | Закуски | Горячие закуски | Салаты | Супы | Горячие блюда | Стейки | Гриль | Паста | Роллы | Сашими | Морепродукты | Гарниры | Десерты | Напитки (если в PDF есть свой раздел — используй его название как есть)",
  "desc": "продающее описание для гостя из PDF, дословно, если есть",
  "ingredients": ["массив", "ингредиентов/компонентов"],
  "allergens": [только точные значения из списка: ${ALLERGENS.join(", ")}],
  "note": "выход блюда в граммах, аллергены вне списка (мёд, горчица, чеснок, кокос, цитрус и т.п.) и КРИТИЧНЫЕ предупреждения (свинина, куриный бульон, алкоголь) — всё одной строкой",
  "pairing": "рекомендация сочетания/подачи, если есть в PDF, иначе пустая строка"
}
Важно: в allergens клади только то, что реально есть в блюде; устричный/рыбный соус — это «Моллюски и ракообразные»/«Рыба»; майонез — «Молоко» и «Яйца». Ничего не выдумывай сверх PDF.`;

// v204: список позиций — коротко и по порядку меню
const NAMES_PROMPT = `Ты — методист ресторанной академии. В приложённом PDF — меню ресторана.
Перечисли ВСЕ позиции меню по порядку, как в PDF: блюда, десерты, напитки, коктейли — ничего не пропускай.
Верни ТОЛЬКО валидный JSON-массив (без markdown, без пояснений), каждый элемент:
{"name": "название позиции, как в PDF", "cat": "раздел меню — выбери один: Холодные закуски | Закуски | Горячие закуски | Салаты | Супы | Горячие блюда | Стейки | Гриль | Паста | Роллы | Сашими | Морепродукты | Гарниры | Десерты | Напитки (если в PDF есть свой раздел — используй его название как есть)"}
Ничего не выдумывай сверх PDF.`;
// v204: подробности — только для названных позиций
export const detailsPrompt = (names) => PROMPT + "\nВерни записи ТОЛЬКО для этих позиций меню, в этом порядке: "
  + names.map((n) => "«" + n + "»").join(", ") + ". Название бери из PDF. Остальные позиции не включай.";

// v204: сколько ждать модель в одном запросе — меньше, чем ждёт хостинг
const SLOW = "AI не успел прочитать меню за отведённое время. Нажми «Из PDF» ещё раз; если повторится — раздели меню на части";
const lim = () => ({ each: Number(process.env.MENU_AI_EACH_MS) || 40000, total: Number(process.env.MENU_AI_TOTAL_MS) || 50000 });

// Модели OpenRouter по порядку: первая, что ответила, — победитель.
const OPENROUTER_MODELS = [
  process.env.OPENROUTER_MENU_MODEL,
  "anthropic/claude-sonnet-4.6",
  "google/gemini-2.5-flash",
].filter(Boolean);

// ── Разбор ответа ────────────────────────────────────────────────────────────
// Достаём JSON-массив, даже если модель обернула его в текст или ```json.
function parseDishes(text) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch (e) { /* пробуем вырезать массив */ }
  const a = clean.indexOf("["), b = clean.lastIndexOf("]");
  if (a >= 0 && b > a) {
    try { return JSON.parse(clean.slice(a, b + 1)); } catch (e) { /* ниже — 422 */ }
  }
  return null;
}

// Текст ответа в формате OpenAI/OpenRouter: content — строка или массив частей.
function openRouterText(data) {
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  const c = msg && msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(p => (p && p.text) || "").join("");
  return "";
}

// ── Провайдер 1: OpenRouter (основной) ───────────────────────────────────────
async function viaOpenRouter(key, pdfBase64, prompt = PROMPT, maxTokens = 8000) {
  const headers = {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    "X-Title": "Service Academy menu import", // только латиница: HTTP-заголовок — ByteString (Доп. 153)
  };
  if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;

  let lastErr = "ни одна модель не ответила", late = 0;
  const L = lim(), t0 = Date.now();
  for (let i = 0; i < OPENROUTER_MODELS.length; i++) {
    const model = OPENROUTER_MODELS[i];
    const left = L.total - (Date.now() - t0);
    if (left < 3000) break;
    // v204: последней модели — всё, что осталось; остальным — не больше each
    const wait = i === OPENROUTER_MODELS.length - 1 ? left : Math.min(L.each, left);
    const ac = new AbortController();
    const tm = setTimeout(() => ac.abort(), wait);
    let r, data;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        signal: ac.signal,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "file", file: { filename: "menu.pdf", file_data: "data:application/pdf;base64," + pdfBase64 } },
            ],
          }],
        }),
      });
      data = await r.json();
    } catch (e) {
      clearTimeout(tm);
      if (ac.signal.aborted) { late++; lastErr = model + ": не ответила за " + Math.round(wait / 1000) + " с"; continue; }
      lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown");
      continue;
    }
    clearTimeout(tm);

    const err = (data && data.error) || (data && data.choices && data.choices[0] && data.choices[0].error);
    if (r.ok && !err) {
      const text = openRouterText(data);
      if (text.trim()) return { ok: true, text, model: (data && data.model) || model };
      lastErr = model + ": пустой ответ";
      continue;
    }

    const status = r.status || (err && err.code) || 0;
    const msg = (err && err.message) || ("HTTP " + status);
    // Ключ не принят или кончились кредиты — другая модель не поможет, выходим сразу.
    if (status === 401) {
      return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel → Settings → Environment Variables и сделай Redeploy." };
    }
    if (status === 402) {
      return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402) — пополни баланс: openrouter.ai → Credits." };
    }
    console.error("menu-import openrouter", model, status, String(msg).slice(0, 200));
    lastErr = model + ": " + msg;
  }
  if (late) { console.error("menu-import slow", lastErr); return { ok: false, status: 504, error: SLOW }; }
  return { ok: false, status: 502, error: "Ошибка OpenRouter — " + lastErr };
}

// ── Провайдер 2: Anthropic напрямую (старый путь, если задан только ANTHROPIC_API_KEY)
async function viaAnthropic(key, pdfBase64, prompt = PROMPT, maxTokens = 8000) {
  let r, data;
  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), lim().total);
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ac.signal,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });
    data = await r.json();
  } catch (e) {
    clearTimeout(tm);
    if (ac.signal.aborted) return { ok: false, status: 504, error: SLOW };
    return { ok: false, status: 502, error: "Сеть до Anthropic: " + (e && e.message ? e.message : "unknown") };
  }
  clearTimeout(tm);
  if (!r.ok) return { ok: false, status: 502, error: (data && data.error && data.error.message) || "Ошибка Claude API" };
  return { ok: true, text: (data.content || []).map(c => c.text || "").join(""), model: data.model || "claude-sonnet-4-6" };
}

// ── Обработчик ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });

  const orKey = process.env.OPENROUTER_API_KEY;
  const anKey = process.env.ANTHROPIC_API_KEY;
  if (!orKey && !anKey) {
    return res.status(500).json({
      error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables → Add (после добавления нужен Redeploy).",
    });
  }

  const body = req.body || {};
  const { pdfBase64, token } = body;
  // v204: names — список позиций, details — подробности для части списка, без mode — всё сразу (старая сборка)
  const mode = body.mode === "names" || body.mode === "details" ? body.mode : "full";
  // v204: строка в Runtime Logs Vercel на каждый запрос — режим, ответ, время, сколько позиций или ошибка
  const started = Date.now(); let info = "";
  if (res && typeof res.on === "function") {
    res.on("finish", () => console.log("menu-import", mode, res.statusCode, (Date.now() - started) + "ms", info));
  }

  // Защита дорогого эндпоинта: только для сотрудников с живой сессией,
  // не больше 8 импортов в час на пользователя. Проверки идут ДО обращения
  // к нейросети — неавторизованный запрос не тратит ни одного токена.
  // v204: импорт — это запрос списка (или старый «всё сразу»); подробности по частям — свой счёт, 120 в час.
  const emp = await verifySession(token);
  if (!emp) return res.status(401).json({ error: "Сессия не найдена — войди в приложение заново и повтори импорт" });
  if (!(mode === "details" ? rateLimit("menud:" + token, 120, 3600_000) : rateLimit("menu:" + token, 8, 3600_000))) {
    return res.status(429).json({ error: "Слишком много импортов подряд — попробуй через час" });
  }

  if (!pdfBase64 || typeof pdfBase64 !== "string") return res.status(400).json({ error: "Файл не получен" });
  const want = mode === "details" ? askNames(body.names) : null;
  if (mode === "details" && !want) return res.status(400).json({ error: "Не понял, какие блюда читать: нажми «Из PDF» ещё раз" });
  // На всякий случай снимаем префикс data:…;base64, если клиент прислал его целиком.
  const b64 = pdfBase64.replace(/^data:[^;]*;base64,/, "");
  const prompt = mode === "names" ? NAMES_PROMPT : mode === "details" ? detailsPrompt(want) : PROMPT;
  const maxTokens = mode === "names" ? 3000 : mode === "details" ? 4000 : 8000;

  try {
    const out = orKey ? await viaOpenRouter(orKey, b64, prompt, maxTokens) : await viaAnthropic(anKey, b64, prompt, maxTokens);
    if (!out.ok) { info = String(out.error || "").slice(0, 160); return res.status(out.status || 502).json({ error: out.error }); }

    const dishes = parseDishes(out.text);
    if (!dishes) return res.status(422).json({ error: "Модель вернула не-JSON, попробуй ещё раз" });
    if (!Array.isArray(dishes)) return res.status(422).json({ error: "Ожидался массив блюд" });

    if (mode === "names") {
      const names = cleanNames(dishes);
      if (!names.length) return res.status(422).json({ error: "В PDF не нашлось ни одного блюда — проверь файл и попробуй ещё раз" });
      info = "names=" + names.length + " " + out.model;
      return res.status(200).json({ names, model: out.model });
    }

    // Санитизация: только известные поля, аллергены — строго из списка
    const safe = dishes.slice(0, mode === "details" ? 12 : 60).map(d => ({
      name: String((d && d.name) || "").slice(0, 120),
      cat: String((d && d.cat) || "").slice(0, 40),
      desc: String((d && d.desc) || "").slice(0, 1200),
      ingredients: d && Array.isArray(d.ingredients) ? d.ingredients.map(x => String(x).slice(0, 160)).slice(0, 40) : [],
      allergens: d && Array.isArray(d.allergens) ? d.allergens.filter(a => ALLERGENS.includes(a)) : [],
      note: String((d && d.note) || "").slice(0, 600),
      pairing: String((d && d.pairing) || "").slice(0, 300),
    })).filter(d => d.name);

    if (mode === "details") {
      const { dishes: got, missing } = pickRequested(safe, want);
      info = "dishes=" + got.length + " missing=" + missing.length + " " + out.model;
      return res.status(200).json({ dishes: got, missing, model: out.model });
    }

    if (!safe.length) return res.status(422).json({ error: "В PDF не нашлось ни одного блюда — проверь файл и попробуй ещё раз" });

    info = "dishes=" + safe.length + " " + out.model;
    return res.status(200).json({ dishes: safe, model: out.model });
  } catch (e) {
    info = "crash " + String(e && e.message ? e.message : "unknown").slice(0, 160);
    return res.status(500).json({ error: "Сбой импорта: " + (e && e.message ? e.message : "unknown") });
  }
}
