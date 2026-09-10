// lib/deck-extras.js — общее для колод (Дополнение 210): своя карта бара, свои коктейли из меню,
// «Гость спрашивает», мосты между колодами, ежедневные пять и режим дня. Без React.
import { COCKTAILS } from "../data/cocktails";

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");

// ── Своя карта бара — хранится в меню команды псевдозаписью (едет через menu_get/menu_set вместе с блюдами)
export const BARCARD_ID = "__barcard__";
export const isBarcard = (d) => d && d.id === BARCARD_ID;
export function readBarcard(shared) { const r = (shared || []).find(isBarcard); return r && Array.isArray(r.cocktails) ? r.cocktails : null; } // null — карта не настроена
export function withBarcard(shared, ids) { const rest = (shared || []).filter(d => d && !isBarcard(d)); return [...rest, { id: BARCARD_ID, cocktails: ids, updatedAt: Date.now() }]; }
export function cachedShared(restaurant) { try { const all = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); return Array.isArray(all[restaurant]) ? all[restaurant] : []; } catch (e) { return []; } }

// ── Свои коктейли из меню ресторана (раздел «Коктейли»/«Бар») → карточки колоды
const GLASS_GUESS = [["хайбол", "highball"], ["рокс", "rocks"], ["олд", "rocks"], ["купе", "martini"], ["мартини", "martini"], ["флют", "flute"], ["шампан", "flute"], ["харрикейн", "hurricane"], ["шот", "shot"], ["сауэр", "sour"], ["маргарит", "margarita"], ["айриш", "irish"], ["винн", "red"]];
export function houseCocktails(dishes) {
  return (dishes || []).filter(d => d && d.name && !d.archived && /коктейл|бар|напит/.test(norm(d.cat))).map(d => {
    const text = norm([d.desc, d.note, d.short].join(" "));
    const glass = (GLASS_GUESS.find(([k]) => text.includes(k)) || [null, "rocks"])[1];
    const method = /шейк/.test(text) ? "шейк" : /стир|смесит/.test(text) ? "стир" : /слоя|слои/.test(text) ? "слои" : "билд";
    return { id: "house:" + d.id, house: true, menuId: d.id, name: d.name, glass, color: ["#D6B266", "#A8823A"], ice: !/без льда/.test(text), garnish: "none", strength: 3, sweet: 2, method,
      ing: (d.ingredients || []).map(x => [x, ""]), steps: [d.desc || "Спек — у бармена"].filter(Boolean), tip: d.note || "", pair: d.pairing || "", short: d.short || "", stop: d.stop || null, img: d.img || "" };
  });
}

// ── «Гость спрашивает»: типичные вопросы с ответами
const AL_Q = { "Глютен": "А тут есть глютен?", "Рыба": "Есть рыба?", "Моллюски и ракообразные": "Морепродукты есть?", "Яйца": "Яйца есть?", "Молоко": "Молочное есть?", "Орехи": "Орехи есть?", "Соя": "Соя есть?", "Кунжут": "Кунжут есть?" };
const ALL_AL = Object.keys(AL_Q);
export function dishFaq(d) {
  const out = [];
  const als = d.allergens || []; const ings = norm((d.ingredients || []).join(" "));
  // явные вопросы менеджера: строки «Вопрос — ответ»
  String(d.faq || "").split("\n").map(x => x.trim()).filter(Boolean).forEach(line => { const m = line.split(/\s[—–-]\s/); if (m.length >= 2) out.push({ q: m[0], a: m.slice(1).join(" — ") }); });
  if (/чили|остр|халапен|перец чили|табаско|шрирач|кимчи/.test(ings)) out.push({ q: "Это острое?", a: "Да, с остринкой — " + ((d.ingredients || []).find(x => /чили|остр|халапен|табаско|шрирач|кимчи/.test(norm(x))) || "перец") + ". Можно попросить мягче." });
  else out.push({ q: "Это острое?", a: "Нет, без остроты." });
  const askAl = als.length ? als[0] : ALL_AL.find(a => !als.includes(a));
  if (askAl) out.push({ q: AL_Q[askAl], a: als.includes(askAl) ? `Да, есть — ${askAl.toLowerCase()}. Предложи замену, если гость ограничен.` : `Нет, ${askAl.toLowerCase()} в составе нет.` });
  if (d.note && /выход|г\b|грамм/.test(norm(d.note))) out.push({ q: "Большая порция?", a: d.note });
  return out.slice(0, 3);
}
export function cocktailFaq(c) {
  const out = [];
  const str = c.strength || 0, sw = c.sweet || 0;
  out.push({ q: "Крепкий?", a: str >= 4 ? "Да, крепкий — почти чистый алкоголь, пьётся медленно." : str === 3 ? "Средний: чувствуется, но не бьёт." : "Лёгкий, освежающий — можно и не один." });
  out.push({ q: "Сладкий?", a: sw >= 3 ? "Да, заметно сладкий — десертный характер." : sw === 2 ? "Баланс: сладость есть, но кислота её держит." : "Сухой, скорее горьковатый — для тех, кто не любит сладкое." });
  const m = c.method || "";
  out.push({ q: "Долго ждать?", a: /шейк|стир/.test(m) ? "Минуту-полторы — его собирают и охлаждают." : /блендер/.test(m) ? "Пару минут — блендер и подача." : "Быстро, собирается в бокале." });
  if (c.note) out.push({ q: "А это точно тот самый?", a: c.note });
  return out.slice(0, 3);
}

// ── Мосты: напитки в тексте сочетания блюда → карточки коктейлей; блюда к коктейлю → карточки меню
export function cocktailLinks(text) {
  const t = norm(text); if (!t) return [];
  return COCKTAILS.filter(c => { const n = norm(c.name).replace(/\s·.*$/, ""); return n.length > 3 && t.includes(n); }).map(c => ({ id: c.id, name: c.name }));
}
const PAIR_KEYS = [["морепродукт", /креветк|краб|мид|устриц|кальмар|гребеш|морепродукт/], ["рыб", /лосос|тунец|сибас|дорад|треск|рыб|сельд|палтус/], ["стейк|мясо|говядин|копчён", /говядин|стейк|рибай|бекон|копчен/], ["сыр", /сыр|пармезан|моцарел|страчател|буррат/], ["десерт|сладк", /десерт|шоколад|тирамису|чизкейк|мусс/], ["салат|лёгк|легк", /салат/], ["острое|тако|азиат", /тако|чили|кимчи|азиат|том ям/], ["бургер|крыль", /бургер|крыл/], ["утин", /утк|утин/], ["устриц", /устриц/]];
export function dishLinks(pairText, dishes) {
  const t = norm(pairText); if (!t || !dishes?.length) return [];
  const hits = PAIR_KEYS.filter(([k]) => new RegExp(k).test(t)).map(([, re]) => re);
  if (!hits.length) return [];
  return dishes.filter(d => d && d.name && !d.archived && hits.some(re => re.test(norm([d.name, d.cat, ...(d.ingredients || [])].join(" "))))).slice(0, 3).map(d => ({ id: d.id, name: d.name }));
}

// ── Ежедневные пять и режим дня
export const dayKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const D5 = (uk) => "sa_daily5" + (uk || "");
export function dailyCount(uk) { try { const j = JSON.parse(localStorage.getItem(D5(uk)) || "{}"); return j.day === dayKey() ? (j.n || 0) : 0; } catch (e) { return 0; } }
export function bumpDaily(uk) { try { const j = JSON.parse(localStorage.getItem(D5(uk)) || "{}"); const n = (j.day === dayKey() ? (j.n || 0) : 0) + 1; const streak = j.day === dayKey() ? (j.streak || 0) : (j.last === dayKey(new Date(Date.now() - 86400000)) ? (j.streak || 0) + 1 : 1); localStorage.setItem(D5(uk), JSON.stringify({ day: dayKey(), n, streak, last: n >= 5 ? dayKey() : j.last })); return n; } catch (e) { return 0; } }
export function dailyStreak(uk) { try { const j = JSON.parse(localStorage.getItem(D5(uk)) || "{}"); return j.streak || 0; } catch (e) { return 0; } }
export const MODES = [
  { key: "allergens", title: "Аллергены на скорость", sub: "30 секунд, свайп «есть / нет»", go: "menu" },
  { key: "reverse-menu", title: "Наоборот: угадай блюдо", sub: "Состав и фото без названия", go: "menu" },
  { key: "know-bar", title: "Знаю? · Колода бармена", sub: "Пять карточек на повтор", go: "cocktails" },
  { key: "reverse-bar", title: "Наоборот: угадай коктейль", sub: "Спек без названия", go: "cocktails" },
  { key: "rush", title: "Час пик", sub: "Три заказа на время", go: "barLab" },
  { key: "know-menu", title: "Знаю? · Колода меню", sub: "Пять карточек на повтор", go: "menu" },
];
export function modeOfDay(d = new Date(), role) {
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const pool = role === "bar" ? MODES : MODES.filter(m => !/bar|rush/.test(m.key)); // официантам — без барных
  return pool[day % pool.length];
}
