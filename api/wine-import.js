// api/wine-import.js — v120 (Доп. 433): AI для винной карты. Vercel превращает файл в функцию POST /api/wine-import.
//
// Владелец (31.10): «Вин более 140 позиций… PDF, к сожалению, нет. Но возможность добавления его нужно оставить».
// Четыре входа (mode):
//   "fill"  — { name } → одно вино по названию: что знает модель (сорт, регион, стиль, ноты, температура, бокал…);
//   "names" — { names: [...] } (до 15 за раз) → то же для списка названий (вставили столбиком из кассы, Word, переписки);
//   "photo" — { imageBase64, mime } → страница винной карты снимком телефона: позиции с листа + что знает модель;
//   "pdf"   — { pdfBase64 } → винная карта в PDF, как импорт меню;
//   "label" — { imageBase64, mime } → v122 (Доп. 435): бутылка снимком — модель читает этикетку (название, производитель,
//             регион, год, сорт, крепость, объём), стиль и подачу — из своих знаний; цены и «бокалом» не заполняет.
// v122 (Доп. 435), владелец (31.10, снимок): «У меня редактор pdf-ку не принял» — «Модель вернула не-JSON». Карта на 140+
// вин: на каждое вино модель писала и ноты, и рассказ, ответ упирался в предел длины и обрывался на середине. Теперь с
// листа и из PDF — только то, что написано в карте (компактно, в 5–6 раз короче); оборванный ответ не выбрасывается:
// целые вина сохраняются, а ответ помечен cut — приложение просит продолжение с вина после последнего прочитанного
// (after). Ноты и рассказ приложение добавляет потом режимом names, пачками по 15. Не JSON — в ошибке начало ответа.
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
// с листа и из PDF — только факты из карты (компактно: длинная карта должна уместиться в ответ)
const SHEET_SHAPE = `{
  "name": "название вина, как в карте",
  "producer": "производитель",
  "country": "страна по-русски",
  "region": "регион или апелласьон",
  "grapes": ["сорт, если указан"],
  "color": "одно из: ${COLORS.join(" | ")}",
  "sweet": "сладость, если указана",
  "vintage": "год или пустая строка",
  "volume": "объём, как в карте",
  "byGlass": true или false,
  "priceGlass": "цена бокала числом или пустая строка",
  "priceBottle": "цена бутылки числом или пустая строка"
}`;
const RULES = `Пиши по-русски. Если не уверен в факте (производитель, регион, сорт, год) — оставь поле пустым, ничего не выдумывай.
Цены и год бери только с листа или из названия. Верни ТОЛЬКО валидный JSON без markdown и пояснений.`;
const PROMPTS = {
  fill: (name) => `Ты — сомелье ресторанной академии. Помоги официанту с вином «${name}» из винной карты ресторана.
Верни один JSON-объект:\n${SHAPE}\n${RULES}`,
  names: (names) => `Ты — сомелье ресторанной академии. Ниже названия вин из винной карты ресторана, по одному в строке.
Для каждого верни объект — получится JSON-массив в том же порядке, поле "name" — как в строке:\n${SHAPE}\n${RULES}\n\nВина:\n${names.join("\n")}`,
  label: `Ты — сомелье ресторанной академии. На фото — бутылка вина из погреба ресторана, снята телефоном.
Прочитай этикетку и верни один JSON-объект. С этикетки бери название, производителя, страну, регион или апелласьон, год,
сорт (если указан), крепость и объём; в "name" — как назвать вино в карте: название и производитель, без года.
Остальное (цвет, сладость, ноты, температура, бокал, фраза гостю, о вине) — из своих знаний, только если уверен.
Цены не заполняй, "byGlass" — false. Если на фото нет бутылки вина или этикетку не прочитать, верни {"name": ""}:\n${SHAPE}\n${RULES}`,
  sheet: (after) => `Ты — сомелье ресторанной академии. На листе — винная карта ресторана (фото страницы или PDF).
Перепиши все вина по порядку, как в карте, JSON-массивом объектов. Бери только то, что написано в карте; цвет — по разделу
карты или по названию. Ноты, описания и подачу не пиши: их добавят отдельно. Пиши компактно, без пробелов и переносов
между полями.\n${SHEET_SHAPE}\n${after ? "Начало карты уже прочитано: начни с вина, которое идёт сразу после «" + after + "», и продолжай до конца карты.\n" : ""}${RULES}`,
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
// оборванный ответ (упёрся в предел длины): целые объекты верхнего уровня массива — по одному, обрывок в конце — мимо
export function parseLoose(text) {
  const t = String(text || ""), out = [];
  let i = t.indexOf("[");
  if (i < 0) return out;
  let depth = 0, start = -1, inStr = false, esc = false;
  for (i = i + 1; i < t.length; i++) {
    const ch = t[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start >= 0) { try { const o = JSON.parse(t.slice(start, i + 1)); if (o && typeof o === "object") out.push(o); } catch (e) {} start = -1; } if (depth < 0) depth = 0; }
    else if (ch === "]" && depth === 0) break;
  }
  return out;
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
async function viaOpenRouter(key, parts, maxTokens = 8000) {
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
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: "user", content }] }) });
      data = await r.json();
    } catch (e) { lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown"); continue; }
    const err = (data && data.error) || (data && data.choices && data.choices[0] && data.choices[0].error);
    if (r.ok && !err) { const text = orText(data); const fin = data && data.choices && data.choices[0] && data.choices[0].finish_reason;
      if (text.trim()) return { ok: true, text, model: (data && data.model) || model, cut: fin === "length" }; lastErr = model + ": пустой ответ"; continue; }
    const status = r.status || (err && err.code) || 0;
    if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel → Settings → Environment Variables и сделай Redeploy." };
    if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits." };
    lastErr = model + ": " + ((err && err.message) || "HTTP " + status);
  }
  return { ok: false, status: 502, error: "Ошибка OpenRouter: " + lastErr };
}
async function viaAnthropic(key, parts, maxTokens = 8000) {
  const content = parts.map((p) => (p.text != null ? { type: "text", text: p.text }
    : p.pdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.pdf } }
    : { type: "image", source: { type: "base64", media_type: p.mime, data: p.image } }));
  let r, data;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content }] }) });
    data = await r.json();
  } catch (e) { return { ok: false, status: 502, error: "Сеть до Anthropic: " + (e && e.message ? e.message : "unknown") }; }
  if (!r.ok) return { ok: false, status: 502, error: (data && data.error && data.error.message) || "Ошибка Claude API" };
  return { ok: true, text: (data.content || []).map((c) => c.text || "").join(""), model: data.model || "claude-sonnet-4-6", cut: data.stop_reason === "max_tokens" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Только POST" });
  const orKey = process.env.OPENROUTER_API_KEY, anKey = process.env.ANTHROPIC_API_KEY;
  if (!orKey && !anKey) return res.status(500).json({ error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables → Add (после добавления нужен Redeploy)." });
  const b = req.body || {};
  const emp = await verifySession(b.token);
  if (!emp) return res.status(401).json({ error: "Сессия не найдена: войди в приложение заново и повтори" });
  // 140 вин списком — это 10 запросов по 15 названий; плюс фото страниц и «по названию» по одному. v122: этикетки —
  // по бутылке за запрос (обход погреба — 140 снимков), поэтому 200 в час
  if (!rateLimit("wine:" + b.token, 200, 3600_000)) return res.status(429).json({ error: "Слишком много запросов подряд: попробуй через час" });

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
    parts = [{ text: PROMPTS.sheet(str(b.after, 120)) }, { image, mime }];
  } else if (b.mode === "label") {
    const image = String(b.imageBase64 || "").replace(/^data:[^;]*;base64,/, "");
    const mime = /^image\/(jpeg|png|webp)$/.test(b.mime) ? b.mime : "image/jpeg";
    if (!image) return res.status(400).json({ error: "Снимок не получен" });
    parts = [{ text: PROMPTS.label }, { image, mime }];
  } else if (b.mode === "pdf") {
    const pdf = String(b.pdfBase64 || "").replace(/^data:[^;]*;base64,/, "");
    if (!pdf) return res.status(400).json({ error: "Файл не получен" });
    parts = [{ text: PROMPTS.sheet(str(b.after, 120)) }, { pdf }];
  } else return res.status(400).json({ error: "Неизвестный режим" });

  try {
    const sheet = b.mode === "photo" || b.mode === "pdf";
    const max = sheet ? 16000 : 8000;
    const out = orKey ? await viaOpenRouter(orKey, parts, max) : await viaAnthropic(anKey, parts, max);
    if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
    let got = out.cut ? null : parse(out.text), cut = !!out.cut;
    if (!got) { const loose = parseLoose(out.text); if (loose.length) { got = loose; cut = cut || !/\]\s*(```)?\s*$/.test(String(out.text).trim()); } }
    if (!got) return res.status(422).json({ error: "Модель ответила не списком: «" + String(out.text || "").replace(/\s+/g, " ").trim().slice(0, 140) + "…». Попробуй ещё раз или «Фото страницы» по одной" });
    let wines = got.filter((w) => w && typeof w === "object").map(clean).filter((w) => w.name).slice(0, 120);
    // с этикетки — одно вино, без цен и подачи бокалом (их на бутылке нет)
    if (b.mode === "label") wines = wines.slice(0, 1).map((w) => ({ ...w, byGlass: false, priceGlass: "", priceBottle: "" }));
    if (!wines.length) return res.status(422).json({ error: b.mode === "fill" ? "Модель не узнала это вино: заполни руками"
      : b.mode === "label" ? "Этикетку не прочитать: сними бутылку ближе, при свете, этикеткой к камере"
      : "На листе не нашлось ни одного вина: проверь снимок и попробуй ещё раз" });
    return res.status(200).json({ wines, model: out.model, cut: sheet && cut });
  } catch (e) {
    return res.status(500).json({ error: "Сбой: " + (e && e.message ? e.message : "unknown") });
  }
}
