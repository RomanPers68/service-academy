// lib/wine.js — v120 (Доп. 433): винная карта заведения. Без React.
//
// Владелец (31.10): «Вин более 140 позиций, поэтому и пришла в голову идея о редакторе, чтобы их все добавить. PDF, к
// сожалению, нет. Но возможность добавления его нужно оставить» и «Сделаем такой же умный редактор, чтобы не только AI
// добавлял, а ещё и человек ручками всё это мог добавить». Вина хранятся в меню команды записями kind:"wine" (едут
// через menu_get/menu_set вместе с блюдами и коктейлями, сервер не меняется). Каждое поле можно заполнить руками; AI
// помогает (по названию, фото страницы карты, списком названий, PDF), и всё, что он дописал, помечено в ai[] —
// «не проверено», пока руководитель не подтвердит. Вписанное человеком — проверено сразу.
// v122 (Доп. 435), владелец (31.10): «может в редактор добавим возможность загрузки фото бутылок?» — фото бутылки (img,
// ссылка хранилища), чтение этикетки AI, импорт пачкой снимков (bottlePlan, applyBottles).

export const WINE_COLORS = [
  ["sparkling", "Игристое"], ["white", "Белое"], ["rose", "Розовое"], ["orange", "Оранжевое"],
  ["red", "Красное"], ["dessert", "Десертное"], ["fortified", "Креплёное"],
];
export const COLOR_RU = Object.fromEntries(WINE_COLORS);
// группа в карте: «Игристые», «Белые»…
export const COLOR_GROUP = { sparkling: "Игристые", white: "Белые", rose: "Розовые", orange: "Оранжевые", red: "Красные", dessert: "Десертные", fortified: "Креплёные", other: "Другие" };
export const SWEET_STILL = ["сухое", "полусухое", "полусладкое", "сладкое"];
export const SWEET_SPARK = ["брют натюр", "экстра брют", "брют", "экстра сухое", "сухое", "полусухое", "сладкое"];
export const sweetsOf = (color) => (color === "sparkling" ? SWEET_SPARK : color === "dessert" || color === "fortified" ? ["сладкое", "полусладкое", "сухое"] : SWEET_STILL);
export const GLASS_TYPES = ["универсальный", "бордо", "бургундия", "флюте", "тюльпан", "десертный"];
// подсказка температуры подачи по цвету (руками можно любую)
export const TEMP_HINT = { sparkling: "6–8 °C", white: "8–10 °C", rose: "8–10 °C", orange: "12–14 °C", red: "16–18 °C", dessert: "8–12 °C", fortified: "14–16 °C" };
// поля, которые может дописать AI (и которые тогда ждут проверки)
export const AI_FIELDS = ["producer", "country", "region", "grapes", "color", "sweet", "vintage", "abv", "byGlass", "priceGlass", "priceBottle", "volume", "temp", "glass", "notes", "short", "story"];
export const FIELD_RU = { producer: "производитель", country: "страна", region: "регион", grapes: "сорт", color: "цвет", sweet: "сладость", vintage: "год",
  abv: "крепость", byGlass: "бокалом", priceGlass: "цена бокала", priceBottle: "цена бутылки", volume: "объём", temp: "температура", glass: "бокал",
  notes: "ноты", short: "фраза гостю", story: "о вине" };

const s = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const list = (v, n, each) => (Array.isArray(v) ? v : String(v || "").split(/[,;\n]/)).map((x) => s(x, each)).filter(Boolean).slice(0, n);
const num = (v) => { const x = Number(String(v == null ? "" : v).replace(",", ".").replace(/[^\d.]/g, "")); return isFinite(x) && x > 0 ? x : ""; };
export const normName = (t) => String(t || "").toLowerCase().replace(/ё/g, "е").replace(/[«»"'’`.,:;!?()\-–—]/g, " ").replace(/\s+/g, " ").trim();

// v122 (Доп. 435): фото бутылки. В записи — только ссылка хранилища (функция photo-upload, та же, что у фото блюд и
// коктейлей): меню команды едет целиком и кэшируется в телефоне, снимок base64 в нём раздул бы его. data:image — только
// у демо (там хранилища нет) и не больше ~200 КБ; всё прочее отбрасывается.
export const imgOf = (v) => {
  const t = String(v == null ? "" : v).trim();
  return /^https:\/\/[^\s"'<>()]{8,500}$/.test(t) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]{100,270000}={0,2}$/.test(t) ? t : "";
};

export const isWineRec = (d) => !!(d && d.kind === "wine" && d.id);
export const wineRecords = (shared) => (shared || []).filter(isWineRec);
/** Вино в меню команды: заменить по id или добавить в конец. */
export function withWine(shared, rec) {
  const w = { ...rec, kind: "wine", updatedAt: Date.now() };
  const rest = shared || [];
  return rest.some((d) => isWineRec(d) && d.id === w.id) ? rest.map((d) => (isWineRec(d) && d.id === w.id ? w : d)) : [...rest, w];
}
/** Пакет вин (импорт): новые — в конец, с тем же id — заменить. */
export function withWines(shared, recs) {
  let out = shared || [];
  for (const r of recs || []) out = withWine(out, r);
  return out;
}
export const withoutWine = (shared, id) => (shared || []).filter((d) => !(isWineRec(d) && d.id === id));

/** Запись из формы, импорта или ответа AI → чистое вино: только известные поля, длины ограничены. */
export function normWine(raw, { id, ai } = {}) {
  const r = raw || {};
  const color = COLOR_RU[r.color] ? r.color : (WINE_COLORS.find(([, ru]) => normName(ru) === normName(r.color)) || [""])[0];
  const out = {
    id: s(id || r.id, 40) || "wn-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), kind: "wine",
    name: s(r.name, 120), producer: s(r.producer, 80), country: s(r.country, 40), region: s(r.region, 80),
    grapes: list(r.grapes, 6, 40), color, sweet: s(r.sweet, 24), vintage: s(r.vintage, 12), abv: num(r.abv),
    byGlass: !!r.byGlass, priceGlass: num(r.priceGlass), priceBottle: num(r.priceBottle), volume: s(r.volume, 12),
    temp: s(r.temp, 24), glass: s(r.glass, 24), notes: list(r.notes, 6, 32), short: s(r.short, 200), story: s(r.story, 900),
    pair: Array.isArray(r.pair) ? r.pair.map((x) => s(x, 60)).filter(Boolean).slice(0, 12) : [], pairNote: s(r.pairNote, 200),
    stop: r.stop || null, archived: !!r.archived, img: imgOf(r.img),
    ai: (Array.isArray(ai) ? ai : Array.isArray(r.ai) ? r.ai : []).filter((f) => AI_FIELDS.includes(f)),
    checkedBy: s(r.checkedBy, 60), checkedAt: Number(r.checkedAt) || 0,
  };
  // AI-пометка только у заполненных полей
  out.ai = out.ai.filter((f, i, a) => a.indexOf(f) === i && filled(out[f]));
  return out;
}
const filled = (v) => (Array.isArray(v) ? v.length > 0 : v !== "" && v != null && v !== false);

/** Дополнить вино ответом AI: заполняются только пустые поля, они и уходят в ai[]. Вписанное руками не трогается. */
export function mergeAi(wine, got) {
  const w = { ...wine }, ai = new Set(w.ai || []);
  const g = normWine({ ...got, name: wine.name });
  for (const f of AI_FIELDS) if (!filled(w[f]) && filled(g[f])) { w[f] = g[f]; ai.add(f); }
  w.ai = [...ai];
  return w;
}
/** Поле правят руками — оно больше не «от AI». */
export const touched = (wine, field) => ({ ...wine, ai: (wine.ai || []).filter((f) => f !== field) });
/** «Подтвердить»: всё проверено человеком. */
export const confirmWine = (wine, who) => ({ ...wine, ai: [], checkedBy: s(who, 60), checkedAt: Date.now() });
export const unchecked = (w) => !!(w && Array.isArray(w.ai) && w.ai.length);

// год — к названию, если его там ещё нет («Бароло Pio Cesare 2018» не станет «… 2018 2018»)
export const wineTitle = (w) => (w ? s(w.name, 120) + (w.vintage && !String(w.name || "").includes(String(w.vintage)) ? " " + w.vintage : "") : "");
/** «Франция, Бургундия · шардоне · белое сухое» */
export function wineLine(w) {
  if (!w) return "";
  const place = [w.country, w.region].filter(Boolean).join(", ");
  const style = [w.color ? COLOR_RU[w.color].toLowerCase() : "", w.sweet].filter(Boolean).join(" ");
  return [place, (w.grapes || []).join(", "), style].filter(Boolean).join(" · ");
}
const rub = (n) => (n ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽" : "");
/** «бокал 650 ₽ · бутылка 3 900 ₽» */
export const winePrice = (w) => [w && w.byGlass && w.priceGlass ? "бокал " + rub(w.priceGlass) : "", w && w.priceBottle ? "бутылка " + rub(w.priceBottle) : ""].filter(Boolean).join(" · ");

/** Группы карты по цвету — в порядке WINE_COLORS, без цвета — «Другие» в конце. */
export function groupByColor(wines) {
  const by = {};
  for (const w of wines || []) (by[w.color && COLOR_RU[w.color] ? w.color : "other"] = by[w.color && COLOR_RU[w.color] ? w.color : "other"] || []).push(w);
  for (const k of Object.keys(by)) by[k].sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
  return [...WINE_COLORS.map(([k]) => k), "other"].filter((k) => by[k]).map((k) => [k, by[k]]);
}
/** Поиск: по названию, производителю, региону, сорту, нотам. */
export function findWines(wines, q) {
  const t = normName(q);
  if (!t) return wines || [];
  const parts = t.split(" ");
  return (wines || []).filter((w) => { const hay = normName([w.name, w.producer, w.country, w.region, (w.grapes || []).join(" "), (w.notes || []).join(" "), w.vintage].join(" ")); return parts.every((p) => hay.includes(p)); });
}
/** То же вино уже есть в карте? По названию; год — если он указан у обоих («Шабли» из списка — то же, что «Шабли» 2022). */
export const sameWine = (a, b) => !!(a && b && normName(wineTitle(a)) && (normName(a.name) === normName(b.name) || normName(wineTitle(a)) === normName(wineTitle(b)))
  && (!a.vintage || !b.vintage || String(a.vintage) === String(b.vintage)));

/** Импорт фото бутылок: что делать с вином, прочитанным с этикетки. Нет в карте — новое вино с фото; есть, но без фото —
 *  фото (и пустые поля с этикетки) добавятся к нему; есть с фото — не отмечено, отметишь — фото заменится. */
export function bottlePlan(found, live) {
  const m = (live || []).find((x) => !x.archived && sameWine(x, found));
  if (!m) return { kind: "new", keep: true, to: "" };
  return m.img ? { kind: "replace", keep: false, to: m.id } : { kind: "attach", keep: true, to: m.id };
}
/** Отмеченные бутылки → меню команды. entries: [{ w, plan, url }] (url — ссылка загруженного фото; нет — без фото). */
export function applyBottles(shared, entries) {
  let out = shared || [];
  for (const e of entries || []) {
    if (!e || !e.w) continue;
    const img = imgOf(e.url);
    const cur = e.plan && e.plan.to ? wineRecords(out).find((x) => x.id === e.plan.to) : null;
    if (cur) out = withWine(out, normWine({ ...mergeAi(cur, e.w), ...(img ? { img } : {}) }));
    else out = withWine(out, normWine({ ...e.w, img }));
  }
  return out;
}

/** Список названий из вставленного текста: строка — вино; номера, маркеры, цены и объёмы отрезаются. */
export function splitNames(text) {
  const seen = new Set(), out = [];
  for (const raw of String(text || "").split(/\n+/)) {
    let t = raw.replace(/^\s*(\d+[.)]|[•·*\-–—])\s*/, "")
      .replace(/\s+\d[\d\s]*(?:[.,]\d+)?\s*(?:₽|руб\.?|р\.?)(?=\s|$).*$/i, "")      // цена и всё после неё
      .replace(/\s+\d[.,]\d{1,3}\s*(?:л|l)(?=\s|$|\.).*$/i, "").replace(/\s+\d{2,4}\s*(?:мл|ml)(?=\s|$|\.).*$/i, "")   // объём (\b с кириллицей не работает)
      .replace(/\s+/g, " ").trim().replace(/[.,;:—–-]+$/, "").trim();
    if (t.length < 3 || !/[A-Za-zА-Яа-яЁё]/.test(t)) continue;
    const k = normName(t);
    if (seen.has(k)) continue;
    seen.add(k); out.push(t.slice(0, 120));
    if (out.length >= 200) break;
  }
  return out;
}

/** Ответ AI (JSON-массив или объект, даже в тексте или ```json) → массив сырых записей. */
export function parseAiWines(text) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  const tryParse = (x) => { try { return JSON.parse(x); } catch (e) { return undefined; } };
  let v = tryParse(clean);
  if (v === undefined) { const a = clean.indexOf("["), b = clean.lastIndexOf("]"); if (a >= 0 && b > a) v = tryParse(clean.slice(a, b + 1)); }
  if (v === undefined) { const a = clean.indexOf("{"), b = clean.lastIndexOf("}"); if (a >= 0 && b > a) v = tryParse(clean.slice(a, b + 1)); }
  if (v && !Array.isArray(v) && Array.isArray(v.wines)) v = v.wines;
  if (v && !Array.isArray(v) && typeof v === "object") v = [v];
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
}
