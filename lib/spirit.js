// lib/spirit.js — v127 (Доп. 440): крепкое в барной карте заведения. Без React.
//
// Владелец (01.11): «Так как мы набили руку на винном редакторе, может добавим и редактор по крепкому алкоголю?», потом
// «Общая карта, вина и крепкое. По поводу порций, давай сделаем на выбор, или же ручной ввод. Делаем сразу все, как у
// вин» и «Да, делаем» — про общую «Барную карту» с коктейлями, винами и крепким. Крепкое хранится, как вина, в меню
// команды записями kind:"spirit" (menu_get/menu_set; сервер не меняется). Поля — свои: вид (виски, коньяк…), стиль,
// выдержка, крепость, порция (25, 40, 50 мл или своё число) и её цена, подача (чистым, со льдом…), «ходовое» (учить
// первым). Всё остальное — как у вин: AI помогает и помечает дописанное в ai[], пока руководитель не подтвердит.

import { placeText } from "./bar-view.js";   // v128: страна и регион без повтора
import { normTaste } from "./taste.js";   // v132: вкус по шкалам

export const SPIRIT_CATS = [
  ["whisky", "Виски"], ["cognac", "Коньяк и бренди"], ["rum", "Ром"], ["gin", "Джин"], ["agave", "Текила и мескаль"],
  ["vodka", "Водка"], ["liqueur", "Ликёр"], ["bitter", "Биттер и настойка"], ["other", "Другое"],
];
export const CAT_RU = Object.fromEntries(SPIRIT_CATS);
// группа в карте: «Виски», «Коньяк и бренди»…; «Другое» (кальвадос, граппа, писко) — в конце
export const CAT_GROUP = { whisky: "Виски", cognac: "Коньяк и бренди", rum: "Ром", gin: "Джин", agave: "Текила и мескаль", vodka: "Водка",
  liqueur: "Ликёры", bitter: "Биттеры и настойки", other: "Другое" };
// вид словом в строке карточки: «виски», «ром»… (у «Другого» — стиль или ничего)
const CAT_WORD = { whisky: "виски", cognac: "коньяк", rum: "ром", gin: "джин", agave: "текила", vodka: "водка", liqueur: "ликёр", bitter: "биттер", other: "" };
// подсказки стиля по виду (в форме — чипами, руками можно любой)
export const STYLE_HINTS = {
  whisky: ["односолодовый", "купажированный", "бурбон", "ржаной", "торфяной", "зерновой"],
  cognac: ["VS", "VSOP", "XO", "бренди", "арманьяк"],
  rum: ["белый", "золотой", "тёмный", "пряный", "выдержанный", "агриколь"],
  gin: ["London Dry", "Old Tom", "Plymouth", "цитрусовый", "травяной"],
  agave: ["бланко", "репосадо", "аньехо", "мескаль"],
  vodka: ["классическая", "пшеничная", "ржаная", "настоянная"],
  liqueur: ["апельсиновый", "кофейный", "сливочный", "травяной", "ореховый", "ягодный"],
  bitter: ["аперитив", "дижестив", "коктейльный"],
  other: ["кальвадос", "граппа", "писко", "абсент", "саке", "чача"],
};
export const SERVE_MODES = ["чистым", "со льдом", "с каплей воды", "охлаждённым", "в коктейле"];
export const SPIRIT_GLASSES = ["тюльпан", "гленкерн", "снифтер", "рокс", "шот", "хайбол"];
export const PORTIONS = [25, 40, 50];
// подсказка подачи по виду (руками можно любую)
export const TEMP_HINT_SP = { whisky: "комнатная, 18–20 °C", cognac: "комнатная, 18–20 °C", rum: "комнатная или со льдом", gin: "охлаждённым", agave: "комнатная",
  vodka: "охлаждённой, 4–6 °C", liqueur: "охлаждённым или со льдом", bitter: "со льдом", other: "комнатная" };
// поля, которые может дописать AI (и которые тогда ждут проверки)
export const AI_FIELDS_SP = ["producer", "cat", "style", "country", "region", "age", "abv", "portion", "pricePortion", "priceBottle", "volume", "serve", "glass", "temp", "notes", "short", "story"];
export const FIELD_RU_SP = { producer: "производитель", cat: "вид", style: "стиль", country: "страна", region: "регион", age: "выдержка", abv: "крепость",
  portion: "порция", pricePortion: "цена порции", priceBottle: "цена бутылки", volume: "объём", serve: "подача", glass: "бокал", temp: "температура",
  notes: "ноты", short: "фраза гостю", story: "о напитке" };

const s = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const list = (v, n, each) => (Array.isArray(v) ? v : String(v || "").split(/[,;\n]/)).map((x) => s(x, each)).filter(Boolean).slice(0, n);
const num = (v) => { const x = Number(String(v == null ? "" : v).replace(",", ".").replace(/[^\d.]/g, "")); return isFinite(x) && x > 0 ? x : ""; };
export const normName = (t) => String(t || "").toLowerCase().replace(/ё/g, "е").replace(/[«»"'’`.,:;!?()\-–—]/g, " ").replace(/\s+/g, " ").trim();
const imgOk = (v) => {
  const t = String(v == null ? "" : v).trim();
  return /^https:\/\/[^\s"'<>()]{8,500}$/.test(t) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]{100,270000}={0,2}$/.test(t) ? t : "";
};
// вид по слову (AI или импорт мог написать «Виски», «коньяк», «Tequila»)
const CAT_WORDS = [["whisky", /виски|whisk|бурбон|bourbon|скотч|scotch/], ["cognac", /коньяк|cognac|бренди|brandy|арманьяк|armagnac/], ["rum", /(^|\s)ром(\s|$)|(^|\s)rum(\s|$)/],
  ["gin", /(^|\s)джин(\s|$)|(^|\s)gin(\s|$)/], ["agave", /текил|tequila|мескал|mezcal/], ["vodka", /водк|vodka/], ["liqueur", /ликер|liqueur|ликёр/],
  ["bitter", /биттер|bitter|настойк|аперитив|дижестив/], ["other", /кальвадос|calvados|граппа|grappa|писко|pisco|абсент|absinth|саке|чача/]];
export const catOf = (v) => { const t = String(v || "").trim(); if (CAT_RU[t]) return t; const n = normName(t); if (!n) return ""; const hit = CAT_WORDS.find(([, re]) => re.test(n)); return hit ? hit[0] : ""; };

export const isSpiritRec = (d) => !!(d && d.kind === "spirit" && d.id);
export const spiritRecords = (shared) => (shared || []).filter(isSpiritRec);
/** Позиция в меню команды: заменить по id или добавить в конец. */
export function withSpirit(shared, rec) {
  const w = { ...rec, kind: "spirit", updatedAt: Date.now() };
  const rest = shared || [];
  return rest.some((d) => isSpiritRec(d) && d.id === w.id) ? rest.map((d) => (isSpiritRec(d) && d.id === w.id ? w : d)) : [...rest, w];
}
export function withSpirits(shared, recs) { let out = shared || []; for (const r of recs || []) out = withSpirit(out, r); return out; }
export const withoutSpirit = (shared, id) => (shared || []).filter((d) => !(isSpiritRec(d) && d.id === id));

const filled = (v) => (Array.isArray(v) ? v.length > 0 : v !== "" && v != null && v !== false);
/** Запись из формы, импорта или ответа AI → чистая позиция: только известные поля, длины ограничены. */
export function normSpirit(raw, { id, ai } = {}) {
  const r = raw || {};
  const portion = num(r.portion);
  const out = {
    id: s(id || r.id, 40) || "sp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), kind: "spirit",
    name: s(r.name, 120), producer: s(r.producer, 80), cat: catOf(r.cat), style: s(r.style, 40), country: s(r.country, 40), region: s(r.region, 80),
    age: s(r.age, 24), abv: num(r.abv), portion: portion && portion <= 500 ? Math.round(portion) : "", pricePortion: num(r.pricePortion), priceBottle: num(r.priceBottle),
    volume: s(r.volume, 12), serve: list(r.serve, 4, 24), glass: s(r.glass, 24), temp: s(r.temp, 32), hot: !!r.hot,
    notes: list(r.notes, 6, 32), short: s(r.short, 200), story: s(r.story, 900),
    pair: Array.isArray(r.pair) ? r.pair.map((x) => s(x, 60)).filter(Boolean).slice(0, 12) : [], pairNote: s(r.pairNote, 200),
    stop: r.stop || null, archived: !!r.archived, img: imgOk(r.img),
    ai: (Array.isArray(ai) ? ai : Array.isArray(r.ai) ? r.ai : []).filter((f) => AI_FIELDS_SP.includes(f)),
    checkedBy: s(r.checkedBy, 60), checkedAt: Number(r.checkedAt) || 0, addedAt: Number(r.addedAt) || 0,
  };
  out.ai = out.ai.filter((f, i, a) => a.indexOf(f) === i && filled(out[f]));
  const tt = normTaste(r.taste, "spirit"); if (tt) out.taste = tt;   // v132: вкус по шкалам
  return out;
}

// выдержка — к названию, если её там ещё нет («Glenfiddich 12» с «12 лет» не станет «… 12 12 лет», «Hennessy» с «VS» — «Hennessy VS»)
export const spiritTitle = (w) => {
  if (!w) return "";
  const name = s(w.name, 120), key = normName(w.age).split(" ")[0];
  return name + (key && !normName(name).split(" ").includes(key) ? " " + s(w.age, 24) : "");
};
const placeOf = (w) => placeText(w.country, w.region);
/** Вид и стиль словами: «виски, односолодовый»; у «Другого» — только стиль. */
export const spiritKind = (w) => (w ? [CAT_WORD[w.cat] || "", w.style].filter(Boolean).join(", ") : "");
const pct = (v) => (v ? String(v).replace(".", ",") + "%" : "");
/** «Шотландия, Спейсайд · виски, односолодовый · 40%» */
export function spiritLine(w) {
  if (!w) return "";
  return [placeOf(w), spiritKind(w), pct(w.abv)].filter(Boolean).join(" · ");
}
const rub = (n) => (n ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽" : "");   // неразрывные, как у вин
/** «50 мл 650 ₽ · бутылка 9 800 ₽»; порция без объёма — «порция 650 ₽» */
export const spiritPrice = (w) => [w && w.pricePortion ? (w.portion ? w.portion + " мл " : "порция ") + rub(w.pricePortion) : "", w && w.priceBottle ? "бутылка " + rub(w.priceBottle) : ""].filter(Boolean).join(" · ");
/** Подача словами: «чистым, со льдом · бокал «тюльпан» · комнатная» */
export const spiritServe = (w) => (w ? [(w.serve || []).join(", "), w.glass ? "бокал «" + w.glass + "»" : "", w.temp].filter(Boolean).join(" · ") : "");

/** Группы карты по виду — в порядке SPIRIT_CATS; без вида — в «Другое». */
export function groupByCat(items) {
  const by = {};
  for (const w of items || []) { const k = w.cat && CAT_RU[w.cat] ? w.cat : "other"; (by[k] = by[k] || []).push(w); }
  for (const k of Object.keys(by)) by[k].sort((a, b) => String(a.name).localeCompare(String(b.name), "ru", { numeric: true }));   // v128: «Вино 2» раньше «Вино 10», 12 лет раньше 18
  return SPIRIT_CATS.map(([k]) => k).filter((k) => by[k]).map((k) => [k, by[k]]);
}
/** Поиск: по названию, производителю, стране, региону, виду, стилю, нотам. */
export function findSpirits(items, q) {
  const t = normName(q);
  if (!t) return items || [];
  const parts = t.split(" ");
  return (items || []).filter((w) => { const hay = normName([w.name, w.producer, w.country, w.region, CAT_RU[w.cat], w.style, w.age, (w.notes || []).join(" ")].join(" ")); return parts.every((p) => hay.includes(p)); });
}
/** То же в карте? По названию с выдержкой («Glenfiddich 12» и «Glenfiddich», 12 лет, — одно; «Hennessy» VS и XO — разные);
 *  у кого выдержка не указана — по названию. */
const idKey = (w) => { const n = normName(w.name), k = normName(w.age).split(" ")[0]; return k && !n.split(" ").includes(k) ? n + " " + k : n; };
export const sameSpirit = (a, b) => !!(a && b && normName(a.name) && normName(b.name)
  && (idKey(a) === idKey(b) || (normName(a.name) === normName(b.name) && (!a.age || !b.age))));

const REVIEW_ROWS_SP = [
  ["producer", "Производитель", ["producer"]], ["place", "Страна и регион", ["country", "region"]], ["kind", "Вид и стиль", ["cat", "style"]],
  ["age", "Выдержка", ["age"]], ["abv", "Крепость", ["abv"]], ["price", "Порция и цена", ["portion", "pricePortion", "priceBottle", "volume"]],
  ["serve", "Подача", ["serve", "glass", "temp"]], ["notes", "Ноты", ["notes"]], ["short", "Фраза гостю", ["short"]], ["story", "О напитке", ["story"]],
];
/** Строки карточки проверки: только заполненное; ai — эту строку (хоть одно её поле) дописал AI. */
export function reviewRowsSp(w) {
  if (!w) return [];
  const ai = new Set(w.ai || []);
  const val = { producer: w.producer, place: placeOf(w), kind: [CAT_RU[w.cat] ? CAT_RU[w.cat].toLowerCase() : "", w.style].filter(Boolean).join(", "), age: w.age, abv: pct(w.abv),
    price: [spiritPrice(w), w.volume].filter(Boolean).join(" · "), serve: spiritServe(w), notes: (w.notes || []).join(", "), short: w.short ? "«" + w.short + "»" : "", story: w.story };
  return REVIEW_ROWS_SP.filter(([k]) => val[k]).map(([key, label, fields]) => ({ key, label, value: val[key], ai: fields.some((f) => ai.has(f)), fields }));
}

/** «Что дописать»: пробелы в карте — фильтры списка редактора. */
export const GAPS_SP = [
  ["nophoto", "Без фото", (w) => !w.img],
  ["noprice", "Без цены", (w) => !w.pricePortion && !w.priceBottle],
  ["noshort", "Без фразы гостю", (w) => !w.short],
  ["noserve", "Без подачи", (w) => !(w.serve || []).length && !w.glass],
];
/** Разделы формы и что в них считается заполненным («заполнено 3 из 5»). */
export const FORM_PARTS_SP = [
  ["origin", "Что это и откуда", () => ["producer", "cat", "style", "country", "region", "age", "abv"]],
  ["serve", "Подача и цена", () => ["portion", "pricePortion", "priceBottle", "volume", "serve", "glass", "temp"]],
  ["guest", "Как рассказать гостю", () => ["notes", "short", "story"]],
  ["pair", "К блюдам", () => ["pair"]],
];

// подсказки в форме: сначала то, что уже есть в своей карте (чаще — раньше), потом частые для этого вида
const COUNTRIES_SP = {
  whisky: ["Шотландия", "Ирландия", "США", "Япония", "Канада", "Индия"], cognac: ["Франция", "Армения", "Испания", "Россия", "Грузия"],
  rum: ["Куба", "Ямайка", "Барбадос", "Гватемала", "Венесуэла", "Доминикана", "Мартиника", "Пуэрто-Рико"], gin: ["Великобритания", "Испания", "Германия", "Нидерланды", "Шотландия"],
  agave: ["Мексика"], vodka: ["Россия", "Польша", "Швеция", "Франция", "Финляндия"], liqueur: ["Италия", "Франция", "Нидерланды", "Ирландия", "Германия"],
  bitter: ["Италия", "Германия", "Чехия", "Тринидад и Тобаго"], other: ["Франция", "Италия", "Перу", "Чили", "Япония", "Грузия"],
};
const REGIONS_SP = {
  "Шотландия": ["Спейсайд", "Айла", "Хайленд", "Лоуленд", "Кэмпбелтаун", "Острова"], "США": ["Кентукки", "Теннесси"], "Ирландия": ["Корк", "Антрим"],
  "Франция": ["Коньяк", "Арманьяк", "Нормандия", "Гран Шампань", "Пти Шампань"], "Мексика": ["Халиско", "Оахака"], "Япония": ["Хоккайдо", "Ямадзаки"],
  "Италия": ["Пьемонт", "Ломбардия", "Венето", "Сицилия"], "Армения": ["Ереван", "Арарат"],
};
const byCount = (vals) => { const c = new Map(); for (const v of vals) { const t = String(v || "").trim(); if (t) c.set(t, (c.get(t) || 0) + 1); } return [...c.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]); };
const uniq = (arr, n) => { const seen = new Set(), out = []; for (const v of arr) { const k = normName(v); if (!k || seen.has(k)) continue; seen.add(k); out.push(v); if (out.length >= n) break; } return out; };
/** Подсказки поля формы: страна (для вида), регион (той страны), стиль (того вида). До n штук. */
export function fieldHintsSp(items, field, form = {}, n = 8) {
  const live = (items || []).filter((w) => w && !w.archived && w.id !== form.id);
  const cat = catOf(form.cat), same = live.filter((w) => !cat || w.cat === cat);
  if (field === "country") return uniq([...byCount(same.map((w) => w.country)), ...(COUNTRIES_SP[cat] || [...COUNTRIES_SP.whisky.slice(0, 3), ...COUNTRIES_SP.cognac.slice(0, 2), "Мексика", "Куба"])], n);
  if (field === "region") {
    const c = String(form.country || "").trim(), here = live.filter((w) => !c || normName(w.country) === normName(c));
    return uniq([...byCount(here.map((w) => w.region)), ...(REGIONS_SP[Object.keys(REGIONS_SP).find((k) => normName(k) === normName(c))] || [])], n);
  }
  if (field === "style") return uniq([...byCount(same.map((w) => w.style)), ...(STYLE_HINTS[cat] || [])], n);
  return [];
}

// связь с коктейлями бара («В коктейлях нашего бара», «Из нашей карты») — в lib/spirit-cocktails.js
