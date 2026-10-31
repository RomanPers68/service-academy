// api/wine-import.js — v120 (Доп. 433): AI для винной карты. Vercel превращает файл в функцию POST /api/wine-import.
//
// Владелец (31.10): «Вин более 140 позиций… PDF, к сожалению, нет. Но возможность добавления его нужно оставить».
// Четыре входа (mode):
//   "fill"  — { name } → одно вино по названию: что знает модель (сорт, регион, стиль, ноты, температура, бокал…);
//   "names" — { names: [...] } (до 15 за раз) → то же для списка названий (вставили столбиком из кассы, Word, переписки);
//   "photo" — { imageBase64, mime } → страница винной карты снимком телефона: позиции с листа + что знает модель;
//   "pdf"   — { pdfBase64 } → винная карта в PDF, как импорт меню.
// Ключ тот же, что у импорта меню: OPENROUTER_API_KEY (или старый ANTHROPIC_API_KEY) в Vercel → Environment Variables.
// Всё, что вернула модель, приложение помечает «не проверено», пока руководитель не подтвердит (lib/wine.js, ai[]).

export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

import { verifySession, rateLimit } from "./_auth.js";

const COLORS = ["sparkling", "white", "rose", "orange", "red", "dessert", "fortified"];
const GLASSES = ["универсальный", "бордо", "бургундия", "флюте", "тюльпан", "десертный"];

const SHAPE = `{
  "name": "название вина, как в карте",
  "producer": "производитель (хозяйство, дом)",
  "country": "страна по-русски",
  "region": "регион или апелласьон",
  "grapes": ["сорт винограда по-русски"],
  "color": "одно из: ${COLORS.join(" | ")}",
  "sweet": "сухое | полусухое | полусладкое | сладкое; у игристых: брют натюр | экстра брют | брют | экстра сухое | сухое | полусухое | сладкое",
  "vintage": "год урожая или пустая строка",
  "abv": "крепость, число, или пустая строка",
  "byGlass": true или false — есть ли подача бокалом,
  "priceGlass": "цена бокала числом или пустая строка",
  "priceBottle": "цена бутылки числом или пустая строка",
  "volume": "объём бутылки или бокала, как в карте",
  "temp": "температура подачи, например 8–10 °C",
  "glass": "одно из: ${GLASSES.join(" | ")}",
  "notes": ["3–5 коротких нот вкуса и аромата"],
  "short": "одна фраза для гостя, живо и без штампов, до 120 знаков",
  "story": "2–3 предложения о вине для официанта: стиль, чем интересно, как рассказать гостю"
}`;
const RULES = `Пиши по-русски. Если не уверен в факте (производитель, регион, сорт, год) — оставь поле пустым, ничего не выдумывай.
Цены и год бери только с листа или из названия. Верни ТОЛЬКО валидный JSON без markdown и пояснений.`;
const PROMPTS = {
  fill: (name) => `Ты — сомелье ресторанной академии. Помоги официанту с вином «${name}» из винной карты ресторана.
Верни один JSON-объект:\n${SHAPE}\n${RULES}`,
  names: (names) => `Ты — сомелье ресторанной академии. Ниже названия вин из винной карты ресторана, по одному в строке.
Для каждого верни объект — получится JSON-массив в том же порядке, поле "name" — как в строке:\n${SHAPE}\n${RULES}\n\nВина:\n${names.join("\n")}`,
  sheet: `Ты — сомелье ресторанной академии. На листе — страница винной карты ресторана (фото или PDF).
Найди все вина и верни JSON-массив объектов. С листа бери название, производителя, регион, год, объём, цены (бокал и
бутылку) и отметку «бокалом»; остальное (сорт, стиль, ноты, температура, бокал, фраза гостю, о вине) — из своих знаний,
только если уверен:\n${SHAPE}\n${RULES}`,
};

const OPENROUTER_MODELS = [process.env.OPENROUTER_WINE_MODEL, process.env.OPENROUTER_MENU_MODEL, "anthropic/claude-sonnet-4.6", "google/gemini-2.5-flash"].filter(Boolean);

function parse(text) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  const tryJ = (x) => { try { return JSON.parse(x); } catch (e) { return undefined; } };
  let v = tryJ(clean);
  if (v === undefined) { const a = clean.indexOf("["), b = clean.lastIndexOf("]"); if (a >= 0 && b > a) v = tryJ(clean.slice(a, b + 1)); }
  if (v === undefined) { const a = clean.indexOf("{"), b = clean.lastIndexOf("}"); if (a >= 0 && b > a) v = tryJ(clean.slice(a, b + 1)); }
  if (v && !Array.isArray(v) && Array.isArray(v.wines)) v = v.wines;
  if (v && !Array.isArray(v) && typeof v === "object") v = [v];
  return Array.isArray(v) ? v : null;
}
const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const arr = (v, n, each) => (Array.isArray(v) ? v : String(v || "").split(/[,;]/)).map((x) => str(x, each)).filter(Boolean).slice(0, n);
const money = (v) => { const x = Number(String(v == null ? "" : v).replace(",", ".").replace(/[^\d.]/g, "")); return isFinite(x) && x > 0 && x < 1e7 ? Math.round(x) : ""; };
function clean(w) {
  return {
    name: str(w.name, 120), producer: str(w.producer, 80), country: str(w.country, 40), region: str(w.region, 80),
    grapes: arr(w.grapes, 6, 40), color: COLORS.includes(w.color) ? w.color : "", sweet: str(w.sweet, 24), vintage: str(w.vintage, 12),
    abv: money(w.abv) && money(w.abv) < 80 ? Number(String(w.abv).replace(",", ".").replace(/[^\d.]/g, "")) : "",
    byGlass: w.byGlass === true, priceGlass: money(w.priceGlass), priceBottle: money(w.priceBottle), volume: str(w.volume, 12),
    temp: str(w.temp, 24), glass: GLASSES.includes(w.glass) ? w.glass : "", notes: arr(w.notes, 6, 32), short: str(w.short, 200), story: str(w.story, 900),
  };
}
const orText = (data) => { const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || "").join("") : ""; };

// content — части сообщения: текст и (для листа) картинка или PDF
async function viaOpenRouter(key, parts) {
  const headers = { Authorization: "Bearer " + key, "Content-Type": "application/json", "X-Title": "Service Academy wine import" };
  if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;
  const content = parts.map((p) => (p.text != null ? { type: "text", text: p.text }
    : p.pdf ? { type: "file", file: { filename: "wine.pdf", file_data: "data:application/pdf;base64," + p.pdf } }
    : { type: "image_url", image_url: { url: "data:" + p.mime + ";base64," + p.image } }));
  let lastErr = "ни одна модель не ответила";
  for (const model of OPENROUTER_MODELS) {
    let r, data;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers,
        body: JSON.stringify({ model, max_tokens: 8000, temperature: 0.2, messages: [{ role: "user", content }] }) });
      data = await r.json();
    } catch (e) { lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown"); continue; }
    const err = (data && data.error) || (data && data.choices && data.choices[0] && data.choices[0].error);
    if (r.ok && !err) { const text = orText(data); if (text.trim()) return { ok: true, text, model: (data && data.model) || model }; lastErr = model + ": пустой ответ"; continue; }
    const status = r.status || (err && err.code) || 0;
    if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel → Settings → Environment Variables и сделай Redeploy." };
    if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits." };
    lastErr = model + ": " + ((err && err.message) || "HTTP " + status);
  }
  return { ok: false, status: 502, error: "Ошибка OpenRouter: " + lastErr };
}
async function viaAnthropic(key, parts) {
  const content = parts.map((p) => (p.text != null ? { type: "text", text: p.text }
    : p.pdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.pdf } }
    : { type: "image", source: { type: "base64", media_type: p.mime, data: p.image } }));
  let r, data;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8000, messages: [{ role: "user", content }] }) });
    data = await r.json();
  } catch (e) { return { ok: false, status: 502, error: "Сеть до Anthropic: " + (e && e.message ? e.message : "unknown") }; }
  if (!r.ok) return { ok: false, status: 502, error: (data && data.error && data.error.message) || "Ошибка Claude API" };
  return { ok: true, text: (data.content || []).map((c) => c.text || "").join(""), model: data.model || "claude-sonnet-4-6" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });
  const orKey = process.env.OPENROUTER_API_KEY, anKey = process.env.ANTHROPIC_API_KEY;
  if (!orKey && !anKey) return res.status(500).json({ error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables → Add (после добавления нужен Redeploy)." });
  const b = req.body || {};
  const emp = await verifySession(b.token);
  if (!emp) return res.status(401).json({ error: "Сессия не найдена: войди в приложение заново и повтори" });
  // 140 вин списком — это 10 запросов по 15 названий; плюс фото страниц и «по названию» по одному
  if (!rateLimit("wine:" + b.token, 60, 3600_000)) return res.status(429).json({ error: "Слишком много запросов подряд: попробуй через час" });

  let parts;
  if (b.mode === "fill") {
    const name = str(b.name, 120);
    if (!name) return res.status(400).json({ error: "Нет названия" });
    parts = [{ text: PROMPTS.fill(name) }];
  } else if (b.mode === "names") {
    const names = (Array.isArray(b.names) ? b.names : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 15);
    if (!names.length) return res.status(400).json({ error: "Нет названий" });
    parts = [{ text: PROMPTS.names(names) }];
  } else if (b.mode === "photo") {
    const image = String(b.imageBase64 || "").replace(/^data:[^;]*;base64,/, "");
    const mime = /^image\/(jpeg|png|webp)$/.test(b.mime) ? b.mime : "image/jpeg";
    if (!image) return res.status(400).json({ error: "Снимок не получен" });
    parts = [{ text: PROMPTS.sheet }, { image, mime }];
  } else if (b.mode === "pdf") {
    const pdf = String(b.pdfBase64 || "").replace(/^data:[^;]*;base64,/, "");
    if (!pdf) return res.status(400).json({ error: "Файл не получен" });
    parts = [{ text: PROMPTS.sheet }, { pdf }];
  } else return res.status(400).json({ error: "Неизвестный режим" });

  try {
    const out = orKey ? await viaOpenRouter(orKey, parts) : await viaAnthropic(anKey, parts);
    if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
    const got = parse(out.text);
    if (!got) return res.status(422).json({ error: "Модель вернула не-JSON, попробуй ещё раз" });
    const wines = got.filter((w) => w && typeof w === "object").map(clean).filter((w) => w.name).slice(0, 120);
    if (!wines.length) return res.status(422).json({ error: b.mode === "fill" ? "Модель не узнала это вино: заполни руками" : "На листе не нашлось ни одного вина: проверь снимок и попробуй ещё раз" });
    return res.status(200).json({ wines, model: out.model });
  } catch (e) {
    return res.status(500).json({ error: "Сбой: " + (e && e.message ? e.message : "unknown") });
  }
}
