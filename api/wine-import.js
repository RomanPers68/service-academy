// api/wine-import.js — v120 (Доп. 433): AI для винной карты. Vercel превращает файл в функцию POST /api/wine-import.
//
// Владелец (31.10): «Вин более 140 позиций… PDF, к сожалению, нет. Но возможность добавления его нужно оставить».
// Четыре входа (mode):
//   "fill"  — { name } → одно вино по названию: что знает модель (сорт, регион, стиль, ноты, температура, бокал…);
//   "names" — { names: [...] } (до 15 за раз) → то же для списка названий (вставили столбиком из кассы, Word, переписки);
//   "photo" — { imageBase64, mime } → страница винной карты снимком телефона: позиции с листа + что знает модель;
//   "pdf"   — { pdfBase64 } → винная карта в PDF, как импорт меню;
//   "taste" — v132 (Доп. 445): { items: [...] } (до 25) → { tastes } — вкус по шкалам для Сомелье;
//   "label" — { imageBase64, mime } → v122 (Доп. 435): бутылка снимком — модель читает этикетку (название, производитель,
//             регион, год, сорт, крепость, объём), стиль и подачу — из своих знаний; цены и «бокалом» не заполняет.
// v122 (Доп. 435), владелец (31.10, снимок): «У меня редактор pdf-ку не принял» — «Модель вернула не-JSON». Карта на 140+
// вин: на каждое вино модель писала и ноты, и рассказ, ответ упирался в предел длины и обрывался на середине. Теперь с
// листа и из PDF — только то, что написано в карте (компактно, в 5–6 раз короче); оборванный ответ не выбрасывается:
// целые вина сохраняются, а ответ помечен cut — приложение просит продолжение с вина после последнего прочитанного
// (after). Ноты и рассказ приложение добавляет потом режимом names, пачками по 15. Не JSON — в ошибке начало ответа.
// Ключ тот же, что у импорта меню: OPENROUTER_API_KEY (или старый ANTHROPIC_API_KEY) в Vercel → Environment Variables.
// Всё, что вернула модель, приложение помечает «не проверено», пока руководитель не подтвердит (lib/wine.js, ai[]).
// v127 (Доп. 440): «Барная карта» — kind: "spirit" — то же для крепкого (виски, коньяк, ром, джин…): свои поля (вид,
// стиль, выдержка, крепость, порция и её цена, как подают), свои подсказки модели; ответ — тот же { wines, cut }.
// v134 (Доп. 447), владелец (03.11, снимок «Правки позиции» «Аберфелди 12» с красной строкой «Не получилось, попробуй ещё
// раз»): «если уже что-то заполнено, то AI не может дополнить?». Может, но запрос не дождался ответа: модель думала дольше,
// чем ждёт Vercel, Vercel оборвал запрос своей страницей (не JSON), и приложение не знало причины. Теперь «по названию» и
// «по этикетке» (одна позиция): модель, что молчит дольше 30 с, не держит запрос, спрашиваем следующую; на всё 50 с, и если
// не ответил никто, то ответ 504 словами. «По названию» получает known: что уже вписано в карточку (факты, их держаться) и
// пишет только недостающее: ответ короче и быстрее, с картой не спорит.
// v151 (Доп. 475): "gaps" — { items: [{ name, known, missing }] } (до 6 за раз) → «Дописать пустое» на всю барную карту:
// у каждой позиции — что вписано (факты) и чего не хватает; модель пишет только недостающее, ответ — { wines: [{ i, …поля }] }
// (i — номер позиции в запросе). Год урожая, объём, цены, порцию и «бокалом» не спрашиваем и не берём (владелец: «без года
// урожая, его уже вручную вобью»). Позицию модель не узнала — её нет в ответе или у неё только i и name.

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
  fill: (name, facts = "") => `Ты — сомелье ресторанной академии. Помоги официанту с вином «${name}» из винной карты ресторана.${facts}
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

// ── v127: крепкое ──
const SP_CATS = ["whisky", "cognac", "rum", "gin", "agave", "vodka", "liqueur", "bitter", "other"];
const SP_GLASSES = ["тюльпан", "гленкерн", "снифтер", "рокс", "шот", "хайбол"];
const SP_SERVE = ["чистым", "со льдом", "с каплей воды", "охлаждённым", "в коктейле"];
const SP_SHAPE = `{
  "name": "название, как в карте (марка и выдержка, если она в названии)",
  "producer": "производитель: дом, дистиллерия или бренд",
  "cat": "одно из: ${SP_CATS.join(" | ")} (other: кальвадос, граппа, писко, абсент, саке)",
  "style": "стиль: односолодовый, купажированный, бурбон, VSOP, XO, London Dry, бланко, репосадо, тёмный ром и т. п.",
  "country": "страна по-русски",
  "region": "регион, если известен",
  "age": "выдержка, как принято писать: 12 лет, VSOP, XO; или пустая строка",
  "abv": "крепость, число",
  "portion": "порция в мл числом, если указана в карте (обычно 25, 40 или 50), или пустая строка",
  "pricePortion": "цена порции числом или пустая строка",
  "priceBottle": "цена бутылки числом или пустая строка",
  "volume": "объём бутылки, как в карте",
  "serve": ["как подают: ${SP_SERVE.join(" | ")}"],
  "glass": "одно из: ${SP_GLASSES.join(" | ")}",
  "temp": "температура подачи словами, например: комнатная, охлаждённым",
  "notes": ["3–5 коротких нот вкуса и аромата"],
  "short": "одна фраза для гостя, живо и без штампов, до 120 знаков",
  "story": "2–3 предложения для официанта: что это, чем интересно, как рассказать гостю"
}`;
const SP_SHEET_SHAPE = `{
  "name": "название, как в карте",
  "producer": "производитель, если указан",
  "cat": "одно из: ${SP_CATS.join(" | ")}",
  "style": "стиль, если указан",
  "country": "страна, если указана",
  "age": "выдержка, если указана",
  "portion": "порция в мл числом, если указана",
  "pricePortion": "цена порции числом или пустая строка",
  "priceBottle": "цена бутылки числом или пустая строка",
  "volume": "объём бутылки, как в карте"
}`;
const SP_RULES = `Пиши по-русски, названия марок оставляй как в карте. Если не уверен в факте (производитель, страна, выдержка) — оставь поле
пустым, ничего не выдумывай. Цены, порцию и выдержку бери только с листа, из названия или с этикетки. Верни ТОЛЬКО валидный JSON без
markdown и пояснений.`;
const SP_PROMPTS = {
  fill: (name, facts = "") => `Ты — бармен ресторанной академии. Помоги официанту с крепким напитком «${name}» из барной карты ресторана.${facts}
Верни один JSON-объект:\n${SP_SHAPE}\n${SP_RULES}`,
  names: (names) => `Ты — бармен ресторанной академии. Ниже крепкие напитки из барной карты ресторана, по одному в строке.
Для каждого верни объект — получится JSON-массив в том же порядке, поле "name" — как в строке:\n${SP_SHAPE}\n${SP_RULES}\n\nНапитки:\n${names.join("\n")}`,
  label: `Ты — бармен ресторанной академии. На фото — бутылка крепкого напитка из бара ресторана, снята телефоном.
Прочитай этикетку и верни один JSON-объект. С этикетки бери название, производителя, страну, регион, выдержку, крепость и объём;
в "name" — как назвать напиток в карте: марка и выдержка. Остальное (вид, стиль, подача, бокал, ноты, фраза гостю) — из своих
знаний, только если уверен. Цены и порцию не заполняй. Если на фото нет бутылки или этикетку не прочитать, верни {"name": ""}:\n${SP_SHAPE}\n${SP_RULES}`,
  sheet: (after) => `Ты — бармен ресторанной академии. На листе — барная карта ресторана (фото страницы или PDF).
Перепиши по порядку все крепкие напитки (виски, коньяк и бренди, ром, джин, текила и мескаль, водка, ликёры, биттеры,
кальвадос, граппа и прочее) JSON-массивом объектов. Вина, пиво, коктейли и безалкогольное не бери. Бери только то, что написано
в карте; вид — по разделу карты или по названию. Ноты, описания и подачу не пиши: их добавят отдельно. Пиши компактно, без
пробелов и переносов между полями.\n${SP_SHEET_SHAPE}\n${after ? "Начало карты уже прочитано: начни с напитка, который идёт сразу после «" + after + "», и продолжай до конца карты.\n" : ""}${SP_RULES}`,
};

// v134 (Доп. 447): «по названию» — что уже вписано в карточку (known), фактами в подсказку; цен, порции и «бокалом» здесь нет:
// по названию модель их не пишет
const FILL_KEYS = ["producer", "country", "region", "grapes", "color", "sweet", "vintage", "abv", "volume", "temp", "glass", "notes", "short", "story"];
const SP_FILL_KEYS = ["producer", "cat", "style", "country", "region", "age", "abv", "volume", "serve", "glass", "temp", "notes", "short", "story"];
export function knownFacts(known, keys) {
  const k = known && typeof known === "object" && !Array.isArray(known) ? known : {}, out = {};
  for (const f of keys) {
    const v = k[f], t = Array.isArray(v) ? v.map((x) => str(x, 40)).filter(Boolean).slice(0, 6).join(", ") : str(v, 120);
    if (t) out[f] = t;
  }
  return out;
}
export function factsText(known, keys) {
  if (!Object.keys(known).length) return "";
  const rest = keys.filter((f) => !known[f]);
  return "\nУже вписано в карточку (это верно, держись этого и не меняй): " + JSON.stringify(known) + "."
    + (rest.length ? "\nЗаполни только недостающее: " + rest.join(", ") + ". Вписанные поля в ответе оставь пустыми." : "");
}
// v134: сколько ждать модель, когда позиция одна («по названию», «по этикетке»): каждую до 30 с, все вместе до 50 с
const SLOW = "AI не успел ответить: нажми ещё раз. Если повторится, подожди минуту";
const quickLim = () => ({ each: Number(process.env.WINE_AI_EACH_MS) || 30000, total: Number(process.env.WINE_AI_TOTAL_MS) || 50000 });
// v151: пачка «Дописать пустое» — тоже не дольше, чем ждёт Vercel: первой модели до 45 с, на всё 50 с
const gapLim = () => ({ each: Number(process.env.WINE_AI_GAPS_EACH_MS) || 45000, total: Number(process.env.WINE_AI_GAPS_TOTAL_MS) || 50000 });

// ── v151 (Доп. 475): «Дописать пустое» ──
export const GAP_SKIP = ["vintage", "volume", "byGlass", "priceGlass", "priceBottle", "portion", "pricePortion"];
export const GAP_MAX = 6;
/** Позиции из запроса: название, что вписано (факты), чего не хватает (только из полей «по названию», без GAP_SKIP).
 *  Номера сохраняются: позиция без названия или без пустых полей остаётся в списке, но в подсказку модели не идёт. */
export function gapItems(raw, sp) {
  const keys = sp ? SP_FILL_KEYS : FILL_KEYS, ask = keys.filter((f) => !GAP_SKIP.includes(f));
  return (Array.isArray(raw) ? raw : []).slice(0, GAP_MAX).map((x) => ({
    name: str(x && x.name, 120), known: knownFacts(x && x.known, keys),
    missing: (Array.isArray(x && x.missing) ? x.missing : []).filter((f, i, a) => ask.includes(f) && a.indexOf(f) === i),
  }));
}
export function gapsPrompt(items, sp) {
  const rows = items.map((x, i) => (x.name && x.missing.length
    ? i + ". «" + x.name + "»" + (Object.keys(x.known).length ? " — вписано: " + JSON.stringify(x.known) : "") + "; не хватает: " + x.missing.join(", ") : "")).filter(Boolean);
  return `Ты — ${sp ? "бармен" : "сомелье"} ресторанной академии. Ниже ${sp ? "крепкие напитки из барной карты ресторана" : "вина из винной карты ресторана"}: номер,
название, что уже вписано в карточку и каких полей не хватает. Вписанное — верно: по нему пойми, о какой позиции речь, держись его и не
повторяй. Для каждой позиции верни объект: "i" — номер, "name" — название, как в строке, и только недостающие поля из её списка,
по образцу:
${sp ? SP_SHAPE : SHAPE}
${sp ? SP_RULES : RULES}
Год урожая, объём, цены${sp ? " и порцию" : " и подачу бокалом"} не пиши. Позицию не узнаёшь — верни для неё только "i" и "name".
Ответ — JSON-массив в том же порядке.

${sp ? "Напитки" : "Вина"}:
${rows.join("\n")}`;
}
const hasV = (v) => (Array.isArray(v) ? v.length > 0 : v !== "" && v != null && v !== false);
const nameKey = (x) => String(x || "").toLowerCase().replace(/[^a-zа-яё0-9]+/gi, " ").trim();
/** Ответ модели → [{ i, name, …только недостающие поля этой позиции }]: позиция — по "i", иначе по названию, иначе по порядку. */
export function gapsPick(got, items, sp) {
  const byName = new Map();
  items.forEach((x, i) => { const k = nameKey(x.name); if (k && !byName.has(k)) byName.set(k, i); });
  const ok = (i) => Number.isInteger(i) && i >= 0 && i < items.length && !!items[i].name && items[i].missing.length > 0;
  const seen = new Set(), out = [];
  (Array.isArray(got) ? got : []).forEach((g, j) => {
    if (!g || typeof g !== "object") return;
    // номер есть, но чужой (повтор, позиция без названия) — только по названию; номера нет — по названию, иначе по порядку
    const hasI = !(g.i === "" || g.i == null);
    let i = hasI ? Number(g.i) : NaN;
    if (!ok(i) || seen.has(i)) { const k = nameKey(g.name); i = k && byName.has(k) ? byName.get(k) : hasI ? NaN : j; }
    if (!ok(i) || seen.has(i)) return;
    seen.add(i);
    const c = (sp ? cleanSpirit : clean)({ ...g, name: items[i].name }), w = { i, name: items[i].name };
    for (const f of items[i].missing) if (hasV(c[f])) w[f] = c[f];
    out.push(w);
  });
  return out.sort((a, b) => a.i - b.i);
}

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
function cleanSpirit(w) {
  const abv = money(w.abv) && money(w.abv) < 100 ? Number(String(w.abv).replace(",", ".").replace(/[^\d.]/g, "")) : "";
  const portion = money(w.portion) && money(w.portion) <= 500 ? money(w.portion) : "";
  return {
    name: str(w.name, 120), producer: str(w.producer, 80), cat: SP_CATS.includes(w.cat) ? w.cat : str(w.cat, 24), style: str(w.style, 40), country: str(w.country, 40), region: str(w.region, 80),
    age: str(w.age, 24), abv, portion, pricePortion: money(w.pricePortion), priceBottle: money(w.priceBottle), volume: str(w.volume, 12),
    serve: arr(w.serve, 4, 24).filter((x) => SP_SERVE.includes(x)), glass: SP_GLASSES.includes(w.glass) ? w.glass : "", temp: str(w.temp, 32),
    notes: arr(w.notes, 6, 32), short: str(w.short, 200), story: str(w.story, 900),
  };
}
const orText = (data) => { const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (p && p.text) || "").join("") : ""; };

// content — части сообщения: текст и (для листа) картинка или PDF
async function viaOpenRouter(key, parts, maxTokens = 8000, lim = null) {
  const headers = { Authorization: "Bearer " + key, "Content-Type": "application/json", "X-Title": "Service Academy wine import" };
  if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;
  const content = parts.map((p) => (p.text != null ? { type: "text", text: p.text }
    : p.pdf ? { type: "file", file: { filename: "wine.pdf", file_data: "data:application/pdf;base64," + p.pdf } }
    : { type: "image_url", image_url: { url: "data:" + p.mime + ";base64," + p.image } }));
  let lastErr = "ни одна модель не ответила", tried = 0, late = 0;
  const t0 = Date.now();
  for (let i = 0; i < OPENROUTER_MODELS.length; i++) {
    const model = OPENROUTER_MODELS[i];
    // v134: срок — каждой до lim.each, последней всё, что осталось от lim.total; осталось меньше 3 с (десятой доли) — не начинаем
    let r, data, wait = 0;
    if (lim) { const left = lim.total - (Date.now() - t0); if (left < Math.min(3000, lim.total / 10)) break; wait = i === OPENROUTER_MODELS.length - 1 ? left : Math.min(lim.each, left); }
    const ac = wait ? new AbortController() : null, timer = ac ? setTimeout(() => ac.abort(), wait) : null;
    tried++;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers, signal: ac ? ac.signal : undefined,
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: "user", content }] }) });
      data = await r.json();
    } catch (e) {
      if (ac && ac.signal.aborted) { late++; lastErr = model + ": не ответила за " + Math.round(wait / 1000) + " с"; continue; }
      lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown"); continue;
    } finally { if (timer) clearTimeout(timer); }
    const err = (data && data.error) || (data && data.choices && data.choices[0] && data.choices[0].error);
    if (r.ok && !err) { const text = orText(data); const fin = data && data.choices && data.choices[0] && data.choices[0].finish_reason;
      if (text.trim()) return { ok: true, text, model: (data && data.model) || model, cut: fin === "length" }; lastErr = model + ": пустой ответ"; continue; }
    const status = r.status || (err && err.code) || 0;
    if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel → Settings → Environment Variables и сделай Redeploy." };
    if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402): пополни баланс на openrouter.ai → Credits." };
    lastErr = model + ": " + ((err && err.message) || "HTTP " + status);
  }
  if (late && late === tried) return { ok: false, status: 504, error: SLOW };
  return { ok: false, status: 502, error: "Ошибка OpenRouter: " + lastErr };
}
async function viaAnthropic(key, parts, maxTokens = 8000, lim = null) {
  const content = parts.map((p) => (p.text != null ? { type: "text", text: p.text }
    : p.pdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.pdf } }
    : { type: "image", source: { type: "base64", media_type: p.mime, data: p.image } }));
  let r, data;
  const ac = lim ? new AbortController() : null, timer = ac ? setTimeout(() => ac.abort(), lim.total) : null;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ac ? ac.signal : undefined,
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content }] }) });
    data = await r.json();
  } catch (e) {
    if (ac && ac.signal.aborted) return { ok: false, status: 504, error: SLOW };
    return { ok: false, status: 502, error: "Сеть до Anthropic: " + (e && e.message ? e.message : "unknown") };
  } finally { if (timer) clearTimeout(timer); }
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

  // v132 (Доп. 445): «Вкус по шкалам» для Сомелье — items (до 25 позиций) → { tastes: [{ i, body, acid, tannin, sweet, oak }] }
  // (у крепкого — body, sweet, smoke, oak, spice) от 1 до 5. Приложение помечает шкалы «от ИИ», пока руководитель не проверит.
  if (b.mode === "taste") {
    const spT = b.kind === "spirit";
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 25).map((x) => ({ name: str(x && x.name, 120), producer: str(x && x.producer, 80), country: str(x && x.country, 40),
      region: str(x && x.region, 80), grapes: (Array.isArray(x && x.grapes) ? x.grapes : []).map((g) => str(g, 40)).filter(Boolean).slice(0, 6), color: str(x && x.color, 20),
      sweet: str(x && x.sweet, 24), cat: str(x && x.cat, 20), style: str(x && x.style, 40), age: str(x && x.age, 24), abv: str(x && x.abv, 8) })).filter((x) => x.name);
    if (!items.length) return res.status(400).json({ error: "Нет позиций" });
    const keys = spT ? ["body", "sweet", "smoke", "oak", "spice"] : ["body", "acid", "tannin", "sweet", "oak"];
    const axes = spT ? "body (тело), sweet (сладость), smoke (дым и торф), oak (дуб), spice (пряность)" : "body (тело), acid (кислотность), tannin (танины), sweet (сладость), oak (дуб)";
    const text = "Ты сомелье. Для каждой позиции " + (spT ? "крепкого" : "вина") + " оцени вкус по шкалам от 1 до 5: " + axes
      + ". Опирайся на то, что знаешь о самом вине, производителе, сорте и регионе; не знаешь — оцени по стилю. Ответ — только JSON-массив без пояснений: [{\"i\": номер, "
      + keys.map((k) => "\"" + k + "\": 1-5").join(", ") + "}]. Позиции:\n" + items.map((x, i) => i + ". " + JSON.stringify(x)).join("\n");
    try {
      const out = orKey ? await viaOpenRouter(orKey, [{ text }], 3000) : await viaAnthropic(anKey, [{ text }], 3000);
      if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
      const got = parse(out.text) || parseLoose(out.text) || [];
      const lv = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 0; };
      const tastes = (Array.isArray(got) ? got : []).filter((t) => t && Number.isInteger(Number(t.i)) && Number(t.i) >= 0 && Number(t.i) < items.length)
        .map((t) => Object.assign({ i: Number(t.i) }, ...keys.map((k) => ({ [k]: lv(t[k]) })))).filter((t) => keys.some((k) => t[k]));
      return res.status(200).json({ tastes, model: out.model });
    } catch (e) {
      return res.status(500).json({ error: "Сбой: " + (e && e.message ? e.message : "unknown") });
    }
  }

  let parts;
  const sp = b.kind === "spirit", P = sp ? SP_PROMPTS : PROMPTS;   // v127: крепкое
  // v151 (Доп. 475): «Дописать пустое» — пачка позиций, ответ с номерами; ничего не узнал — пустой список, а не ошибка
  if (b.mode === "gaps") {
    const items = gapItems(b.items, sp);
    if (!items.some((x) => x.name && x.missing.length)) return res.status(400).json({ error: "Нечего дописывать" });
    try {
      const text = gapsPrompt(items, sp);
      const out = orKey ? await viaOpenRouter(orKey, [{ text }], 6000, gapLim()) : await viaAnthropic(anKey, [{ text }], 6000, gapLim());
      if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
      let got = out.cut ? null : parse(out.text);
      if (!got) { const loose = parseLoose(out.text); if (loose.length || /^\s*(```(json)?)?\s*\[\s*\]/.test(String(out.text || ""))) got = loose;
        else return res.status(422).json({ error: "Модель ответила не списком: «" + String(out.text || "").replace(/\s+/g, " ").trim().slice(0, 140) + "…». Нажми ещё раз" }); }
      return res.status(200).json({ wines: gapsPick(got, items, sp), model: out.model });
    } catch (e) {
      return res.status(500).json({ error: "Сбой: " + (e && e.message ? e.message : "unknown") });
    }
  }
  if (b.mode === "fill") {
    const name = str(b.name, 120);
    if (!name) return res.status(400).json({ error: "Нет названия" });
    const keys = sp ? SP_FILL_KEYS : FILL_KEYS;   // v134: что уже вписано — фактами, модель пишет только недостающее
    parts = [{ text: P.fill(name, factsText(knownFacts(b.known, keys), keys)) }];
  } else if (b.mode === "names") {
    const names = (Array.isArray(b.names) ? b.names : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 15);
    if (!names.length) return res.status(400).json({ error: "Нет названий" });
    parts = [{ text: P.names(names) }];
  } else if (b.mode === "photo") {
    const image = String(b.imageBase64 || "").replace(/^data:[^;]*;base64,/, "");
    const mime = /^image\/(jpeg|png|webp)$/.test(b.mime) ? b.mime : "image/jpeg";
    if (!image) return res.status(400).json({ error: "Снимок не получен" });
    parts = [{ text: P.sheet(str(b.after, 120)) }, { image, mime }];
  } else if (b.mode === "label") {
    const image = String(b.imageBase64 || "").replace(/^data:[^;]*;base64,/, "");
    const mime = /^image\/(jpeg|png|webp)$/.test(b.mime) ? b.mime : "image/jpeg";
    if (!image) return res.status(400).json({ error: "Снимок не получен" });
    parts = [{ text: P.label }, { image, mime }];
  } else if (b.mode === "pdf") {
    const pdf = String(b.pdfBase64 || "").replace(/^data:[^;]*;base64,/, "");
    if (!pdf) return res.status(400).json({ error: "Файл не получен" });
    parts = [{ text: P.sheet(str(b.after, 120)) }, { pdf }];
  } else return res.status(400).json({ error: "Неизвестный режим" });

  try {
    const sheet = b.mode === "photo" || b.mode === "pdf";
    const max = sheet ? 16000 : 8000;
    const lim = b.mode === "fill" || b.mode === "label" ? quickLim() : null;   // v134: одна позиция — модель не держит запрос дольше 30 с
    const out = orKey ? await viaOpenRouter(orKey, parts, max, lim) : await viaAnthropic(anKey, parts, max, lim);
    if (!out.ok) return res.status(out.status || 502).json({ error: out.error });
    let got = out.cut ? null : parse(out.text), cut = !!out.cut;
    if (!got) { const loose = parseLoose(out.text); if (loose.length) { got = loose; cut = cut || !/\]\s*(```)?\s*$/.test(String(out.text).trim()); } }
    if (!got) return res.status(422).json({ error: "Модель ответила не списком: «" + String(out.text || "").replace(/\s+/g, " ").trim().slice(0, 140) + "…». Попробуй ещё раз или «Фото страницы» по одной" });
    let wines = got.filter((w) => w && typeof w === "object").map(sp ? cleanSpirit : clean).filter((w) => w.name).slice(0, 120);
    // с этикетки — одно вино, без цен и подачи бокалом (их на бутылке нет); у крепкого — без цен и порции
    if (b.mode === "label") wines = wines.slice(0, 1).map((w) => (sp ? { ...w, portion: "", pricePortion: "", priceBottle: "" } : { ...w, byGlass: false, priceGlass: "", priceBottle: "" }));
    if (!wines.length) return res.status(422).json({ error: b.mode === "fill" ? (sp ? "Модель не узнала этот напиток: заполни руками" : "Модель не узнала это вино: заполни руками")
      : b.mode === "label" ? "Этикетку не прочитать: сними бутылку ближе, при свете, этикеткой к камере"
      : sp ? "На листе не нашлось ни одного крепкого напитка: проверь снимок и попробуй ещё раз" : "На листе не нашлось ни одного вина: проверь снимок и попробуй ещё раз" });
    return res.status(200).json({ wines, model: out.model, cut: sheet && cut });
  } catch (e) {
    return res.status(500).json({ error: "Сбой: " + (e && e.message ? e.message : "unknown") });
  }
}
