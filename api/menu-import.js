// api/menu-import.js — Этап 4: AI-импорт меню из PDF.
// Vercel автоматически превращает этот файл в серверную функцию POST /api/menu-import.
// Настройка: Vercel → Project → Settings → Environment Variables → ANTHROPIC_API_KEY
// (ключ берётся на https://console.anthropic.com). Актуальная документация API:
// https://docs.claude.com/en/api/overview

export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY не задан в переменных окружения Vercel" });

  const { pdfBase64 } = req.body || {};
  if (!pdfBase64) return res.status(400).json({ error: "Файл не получен" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
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
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data && data.error && data.error.message) || "Ошибка Claude API" });

    const text = (data.content || []).map(c => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    let dishes;
    try { dishes = JSON.parse(clean); } catch (e) {
      return res.status(422).json({ error: "Модель вернула не-JSON, попробуй ещё раз" });
    }
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

    return res.status(200).json({ dishes: safe });
  } catch (e) {
    return res.status(500).json({ error: "Сбой импорта: " + (e && e.message ? e.message : "unknown") });
  }
}
