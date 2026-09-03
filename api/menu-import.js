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

export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

import { verifySession, rateLimit } from "./_auth.js";

const ALLERGENS = ["Глютен", "Рыба", "Моллюски и ракообразные", "Яйца", "Молоко", "Орехи", "Соя", "Кунжут"];

const PROMPT = `Ты — методист ресторанной академии. В приложённом PDF — карточки блюд меню.
Верни ТОЛЬКО валидный JSON-массив (без markdown, без пояснений). Каждый элемент:
{
  "name": "название блюда",
  "cat": "категория — выбери одну: Закуски | Салаты | Супы | Горячие блюда | Десерты | Напитки",
  "desc": "продающее описание для гостя из PDF, дословно, если есть",
  "ingredients": ["массив", "ингредиентов/компонентов"],
  "allergens": [только точные значения из списка: ${ALLERGENS.join(", ")}],
  "note": "выход блюда в граммах, аллергены вне списка (мёд, горчица, чеснок, кокос, цитрус и т.п.) и КРИТИЧНЫЕ предупреждения (свинина, куриный бульон, алкоголь) — всё одной строкой",
  "pairing": "рекомендация сочетания/подачи, если есть в PDF, иначе пустая строка"
}
Важно: в allergens клади только то, что реально есть в блюде; устричный/рыбный соус — это «Моллюски и ракообразные»/«Рыба»; майонез — «Молоко» и «Яйца». Ничего не выдумывай сверх PDF.`;

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
async function viaOpenRouter(key, pdfBase64) {
  const headers = {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    "X-Title": "Service Academy menu import", // только латиница: HTTP-заголовок — ByteString (Доп. 153)
  };
  if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;

  let lastErr = "ни одна модель не ответила";
  for (const model of OPENROUTER_MODELS) {
    let r, data;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          temperature: 0,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "file", file: { filename: "menu.pdf", file_data: "data:application/pdf;base64," + pdfBase64 } },
            ],
          }],
        }),
      });
      data = await r.json();
    } catch (e) {
      lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown");
      continue;
    }

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
  return { ok: false, status: 502, error: "Ошибка OpenRouter — " + lastErr };
}

// ── Провайдер 2: Anthropic напрямую (старый путь, если задан только ANTHROPIC_API_KEY)
async function viaAnthropic(key, pdfBase64) {
  let r, data;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
    data = await r.json();
  } catch (e) {
    return { ok: false, status: 502, error: "Сеть до Anthropic: " + (e && e.message ? e.message : "unknown") };
  }
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

  const { pdfBase64, token } = req.body || {};

  // Защита дорогого эндпоинта: только для сотрудников с живой сессией,
  // не больше 8 импортов в час на пользователя. Проверки идут ДО обращения
  // к нейросети — неавторизованный запрос не тратит ни одного токена.
  const emp = await verifySession(token);
  if (!emp) return res.status(401).json({ error: "Сессия не найдена — войди в приложение заново и повтори импорт" });
  if (!rateLimit("menu:" + token, 8, 3600_000)) {
    return res.status(429).json({ error: "Слишком много импортов подряд — попробуй через час" });
  }

  if (!pdfBase64 || typeof pdfBase64 !== "string") return res.status(400).json({ error: "Файл не получен" });
  // На всякий случай снимаем префикс data:…;base64, если клиент прислал его целиком.
  const b64 = pdfBase64.replace(/^data:[^;]*;base64,/, "");

  try {
    const out = orKey ? await viaOpenRouter(orKey, b64) : await viaAnthropic(anKey, b64);
    if (!out.ok) return res.status(out.status || 502).json({ error: out.error });

    const dishes = parseDishes(out.text);
    if (!dishes) return res.status(422).json({ error: "Модель вернула не-JSON, попробуй ещё раз" });
    if (!Array.isArray(dishes)) return res.status(422).json({ error: "Ожидался массив блюд" });

    // Санитизация: только известные поля, аллергены — строго из списка
    const safe = dishes.slice(0, 60).map(d => ({
      name: String(d.name || "").slice(0, 120),
      cat: String(d.cat || "").slice(0, 40),
      desc: String(d.desc || "").slice(0, 1200),
      ingredients: Array.isArray(d.ingredients) ? d.ingredients.map(x => String(x).slice(0, 160)).slice(0, 40) : [],
      allergens: Array.isArray(d.allergens) ? d.allergens.filter(a => ALLERGENS.includes(a)) : [],
      note: String(d.note || "").slice(0, 600),
      pairing: String(d.pairing || "").slice(0, 300),
    })).filter(d => d.name);

    if (!safe.length) return res.status(422).json({ error: "В PDF не нашлось ни одного блюда — проверь файл и попробуй ещё раз" });

    return res.status(200).json({ dishes: safe, model: out.model });
  } catch (e) {
    return res.status(500).json({ error: "Сбой импорта: " + (e && e.message ? e.message : "unknown") });
  }
}
