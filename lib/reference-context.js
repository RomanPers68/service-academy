// lib/reference-context.js
// Ассистент ориентируется в Справочнике без изменения серверной функции:
// перед отправкой вопроса ищем релевантные главы прямо на клиенте и
// подмешиваем выдержки в текст вопроса. Сервер видит просто более
// подробное сообщение — совместимо с текущей Edge Function ai-chat.
//
// Экономия токенов: контекст добавляется только при внятном совпадении,
// максимум 2 главы, суммарно ~1300 символов, и только в отправляемую
// копию последнего сообщения (в историю чата не пишется).

import { REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE } from "../data/reference";
import { menuDishesFromStorage } from "./menu-dishes";   // v76: меню — по одному правилу с тренажёром и поиском
import { sharedOf } from "./menu-dishes";
import { readBarcard } from "./deck-extras";   // v149 (Доп. 473): сводка для советов в уроках
import { saveAvail, readAvail } from "./tip-avail.js";
import { COCKTAILS } from "../data/cocktails";
import { dishNutrition, nutritionLine } from "./nutrition";
import { COCKTAIL_STORIES } from "../data/cocktail-stories";
import { WINE, SPIRIT } from "./drinks.js";   // v130 (Доп. 443): вина и крепкое «Барной карты»
import { titleParts } from "./bar-view.js";
import { COLOR_RU, wineRecords } from "./wine.js";
import { CAT_RU, spiritRecords } from "./spirit.js";
import { conceptFromStorage, conceptAssistantContext } from "./concept.js";   // v139 (Доп. 454): «О нас»
import { goAssistantLine, cutWords } from "./golist-day.js";   // v141 (Доп. 458): гоу-лист дня для Наставника

const COURSES = [REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE];

const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е");
// v130: «нас», «вас», «них», «там», «тут» — не ключевые слова («у нас» подтягивало «Секс на пляже» по короткому «на»)
const STOP = new Set(["нас", "вас", "них", "там", "тут", "как", "что", "это", "для", "или", "чем", "при", "его", "она", "они", "оно", "мне", "нам", "вам", "надо", "нужно", "можно", "если", "чтобы", "какой", "какая", "какие", "почему", "зачем", "где", "когда", "есть", "быть", "такое", "расскажи", "скажи", "подскажи", "объясни", "привет", "приветик", "здравствуй", "здравствуйте", "спасибо", "пожалуйста", "помоги", "слушай", "окей"]);

function words(q) {
  return norm(q).split(/[^а-яa-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));
}

/** Выдержка: первый абзац главы со словом запроса + 📌-вывод главы. */
function excerpt(content, ws) {
  const paras = (content || "").split(/\n\n+/);
  let hit = null;
  for (const p of paras) {
    const np = norm(p);
    if (ws.some(w => np.includes(w))) { hit = p.trim(); break; }
  }
  const pin = paras.find(p => p.trim().startsWith("📌"));
  let out = (hit || paras[0] || "").slice(0, 420);
  if (pin && pin.trim() !== hit) out += "\n" + pin.trim().slice(0, 220);
  return out;
}

// ── Меню ресторана: состав, аллергены и пометки блюд ──
// v76 (Доп. 389): то же меню, что в «Колоде меню» и в поиске (lib/menu-dishes.js): свои + меню команды + примеры,
// пока у команды нет своего меню (или если их включили вручную), без скрытых и удалённых. Раньше примеры-заготовки
// шли Наставнику и живому гостю и рядом с настоящим меню: те могли посоветовать или «заказать» блюдо, которого
// в ресторане нет. Ассистент отвечает про блюда СВОЕГО заведения.
export function dishesOf(restaurant) {
  return menuDishesFromStorage(restaurant);
}

/** Сохранить меню команды в кэш для ассистента (вызывают тренажёр и экран ассистента). */
export function rememberSharedMenu(restaurant, dishes) {
  if (!restaurant || !Array.isArray(dishes)) return;
  let same = false;
  try {
    const shared = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}");
    const before = JSON.stringify(shared[restaurant] || null);
    // Доп. 174: фото-текст (data:) в кэш не кладём — он весит сотни КБ на блюдо и съедает память телефона
    shared[restaurant] = dishes.slice(0, 600).map(d => (typeof d.img === "string" && d.img.startsWith("data:")) ? { ...d, img: "" } : d);
    same = before === JSON.stringify(shared[restaurant]);   // v120: было 200 — с картой вин (140+) хвост меню пропадал из кэша
    localStorage.setItem("sa_menu_shared", JSON.stringify(shared));
  } catch (e) {}
  // v149 (Доп. 473): меню команды обновилось — сводка для советов в уроках (есть ли голоса, КБЖУ, вина, крепкое)
  if (!same || !readAvail(restaurant)) refreshAvail(restaurant);
}

// ── v149 (Доп. 473): что есть у заведения — для советов в уроках (lib/tip-avail.js) ─────────────────────────────
// Меню — то же, что видит «Колода меню» (свои + меню команды + примеры, пока своего нет); бар — записи карты.
export const AVAIL_VOICES = ["chef", "som"];   // как VOICE_KINDS в lib/voice-note.js (сверяет тест)
const voiceOf = (d, k) => !!(d && d.voice && d.voice[k] && d.voice[k].url);
export function availOf(dishes, shared) {
  const live = (dishes || []).filter((d) => d && d.name && !d.archived);
  const chefVoice = live.some((d) => voiceOf(d, "chef")), somVoice = live.some((d) => voiceOf(d, "som"));
  const kb = live.find((d) => { try { return !!dishNutrition(d); } catch (e) { return false; } });
  return {
    menu: live.length > 0,
    voices: chefVoice || somVoice, chefVoice, somVoice,
    kbju: kb && kb.id != null ? String(kb.id) : "",   // с какого блюда открыть колоду: у него на обороте есть «Пищевая ценность»
    wines: wineRecords(shared).some((w) => !w.archived),
    spirits: spiritRecords(shared).some((w) => !w.archived),
    barcard: readBarcard(shared || []) != null,
  };
}
export function refreshAvail(restaurant) {
  if (!restaurant) return null;
  try { const a = availOf(menuDishesFromStorage(restaurant), sharedOf(restaurant)); saveAvail(restaurant, a); return a; } catch (e) { return null; }
}

const MENU_TRIGGERS = /состав|аллерг|ингредиент|блюд|салат|суп|десерт|закуск|ролл|гарнир|меню|подач|выход|соус|котлет|паштет/i;

/** Стемы слова: «салата» находит «салат», «супов» — «супы». */
function stems(w) {
  const out = new Set();
  for (const cut of [w, w.slice(0, 6), w.slice(0, 5), w.slice(0, 4)]) if (cut.length >= 4) out.add(cut);
  if (w.length <= 5) out.add(w.slice(0, 3));   // короткие корни: суп/чай/ром
  return [...out];
}
/** Матч по началу слов поля: «краб» находит «крабовая», но не «скраб».
    minLen отсекает шумные короткие корни там, где они опасны: «мор» (из
    «моря») не должен цеплять «морепродукты» в названиях блюд. */
function fieldHit(field, st, minLen = 3) {
  const use = st.filter(x => x.length >= minLen);
  // Доп. 129: короткие слова названий («Том ям», «Кир») ловим точным совпадением
  // слова или когда слово поля — начало слова вопроса («яме» → «ям»), без порога длины.
  return norm(field).split(/[^а-яa-z0-9]+/).some(fw => fw && (
    use.some(x => fw.startsWith(x)) ||
    st.some(x => x === fw || (fw.length >= 2 && x.startsWith(fw) && x.length - fw.length <= 2))
  ));
}

// Доп. 264: КБЖУ — Наставник отвечает «сколько калорий», не выдумывая
const nutTxt = (d) => { const n = dishNutrition(d); return n ? ` Пищевая ценность порции: ${nutritionLine(n)}${!n.own && n.score < 1 ? ` (по позиции «${n.n}»)` : ""}.` : ""; };

export function menuAssistantContext(question, restaurant) {
  const ws = words(question);
  if (!ws.length) return null;
  const dishes = dishesOf(restaurant);
  if (!dishes.length) return null;
  const trig = MENU_TRIGGERS.test(norm(question));
  const scored = [];
  for (const d of dishes) {
    const extra = (d.ingredients || []).join(" ") + " " + (d.allergens || []).join(" ");
    let score = 0;
    for (const w of ws) {
      const st = stems(w);
      if (fieldHit(d.name || "", st, 4)) score += 4;      // имена: корни от 4 букв
      else if (fieldHit(d.cat || "", st)) score += 3;      // категории: «суп» нужен
      else if (fieldHit(extra, st)) score += 2;            // состав: «ром», «чай»
    }
    if (score >= (trig ? 2 : 4)) scored.push({ d, score });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const parts = scored.slice(0, 2).map(({ d }) => {
    const stopTxt = d.stop ? ` ВНИМАНИЕ: В СТОП-ЛИСТЕ${d.stop.since ? " с " + new Date(d.stop.since).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : ""} — сегодня не подаём, предложи замену.` : "";
    let card = `— Блюдо «${d.name}»${d.cat ? ` (${d.cat})` : ""}${d.id ? ` [id: ${d.id}]` : ""}.${stopTxt}${nutTxt(d)} Состав: ${(d.ingredients || []).join(", ") || "—"}. Аллергены: ${(d.allergens || []).join(", ") || "нет в списке"}.`;
    if (d.short) card += ` Одной фразой: «${String(d.short).trim().slice(0, 120)}».`;
    if (d.desc) card += ` Как описать гостю: ${String(d.desc).trim().slice(0, 200)}`; // Доп. 186: эталонное описание — в контекст
    if (d.note) card += ` Важно: ${d.note}`;
    if (d.pairing) card += ` Сочетание: ${d.pairing}`;
    // v80 (Доп. 393): своё ударение команды и записи шефа / сомелье — Наставник может на них сослаться
    if (String(d.say || "").trim()) card += ` Как произносить (ударение — «+» перед гласной): ${String(d.say).trim().slice(0, 80)}.`;
    if (d.voice && (d.voice.chef || d.voice.som)) card += ` В карточке блюда есть запись: ${[d.voice.chef && "шеф о блюде", d.voice.som && "сомелье, что налить"].filter(Boolean).join(", ")}.`;
    return card.slice(0, 640);
  });
  return parts.join("\n");
}

// ── Коктейли: спек, метод, бокал, шаги, совет, пара, история и фраза гостю ──
const CK_TRIGGERS = /коктейл|спек|рецепт|пропорц|шейк|стир|билд|бокал|гарнир|нали|смеша|бармен|аперитив|дижестив|тоник|джин|ром\b|виск|водк|текил|вермут|ликер|ликёр|сироп|биттер|кампари|просекко|мохито|негрони|маргарит/i;
const GLASS_RU = { rocks: "рокс", highball: "хайбол", martini: "коктейльная рюмка", flute: "флюте", hurricane: "харрикейн", margarita: "маргарита", sour: "сауэр", shot: "шот", irish: "бокал айриш", red: "винный" };

// Доп. 240: свои коктейли команды (записи kind:"cocktail" в кэше меню) — в контекст Наставника вместе с классикой
const houseFromCache = () => { try { const all = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); return Object.values(all).flat().filter(d => d && d.kind === "cocktail" && d.name && !d.archived).map(r => ({ id: r.id, name: r.name, glass: r.glass, method: r.method, ing: (r.ing || []).map(i => [i[0], i[1]]), steps: r.steps || [], tip: r.tip || "", story: r.story || "", note: r.note || "", house: true, stop: r.stop || null })); } catch (e) { return []; } };
export function cocktailAssistantContext(question) {
  const ws = words(question);
  if (!ws.length) return null;
  const trig = CK_TRIGGERS.test(norm(question));
  const scored = [];
  for (const c of [...houseFromCache(), ...COCKTAILS]) {
    const st0 = COCKTAIL_STORIES[c.id] || (c.house ? { story: c.story, tip: c.tip } : {});
    const ingText = (c.ing || []).map(i => i[0]).join(" ");
    let score = 0;
    for (const w of ws) {
      const st = stems(w);
      if (fieldHit(c.name || "", st, 4)) score += 5;
      else if (fieldHit(ingText, st, 3)) score += 2;
      else if (fieldHit(c.pair || "", st, 4)) score += 2;   // «что налить к тако» → пара коктейля
      else if (fieldHit((c.method || "") + " " + (GLASS_RU[c.glass] || ""), st, 4)) score += 1;
      else if (fieldHit(st0.story || "", st, 5)) score += 1;
    }
    if (score >= (trig ? 2 : 5)) scored.push({ c, score });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map(({ c }) => {
    const st0 = COCKTAIL_STORIES[c.id] || {};
    const spec = (c.ing || []).map(i => i[1] ? `${i[0]} ${i[1]}` : i[0]).join(", ");
    // Доп. 214: карта бара ресторана (из кэша меню команды) — Наставник знает, что у нас не наливают
    const bc = (() => { try { const all = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); const rest = Object.values(all).flat(); const rec = rest.find(x => x && x.id === "__barcard__"); return rec && Array.isArray(rec.cocktails) ? rec.cocktails : null; } catch (e) { return null; } })();
    const cardNote = c.house ? (c.stop ? " (свой коктейль бара · ВНИМАНИЕ: СЕГОДНЯ В СТОПЕ — не наливаем, предложи замену)" : " (свой коктейль бара)") : bc && !bc.includes(c.id) ? " ВНИМАНИЕ: НЕ В КАРТЕ БАРА — в этом ресторане не наливают." : "";
    let card = `— Коктейль «${c.name}» [id: ${c.id}] (${c.method || "—"}, ${GLASS_RU[c.glass] || c.glass || "—"}).${cardNote} Спек: ${spec}.`;
    if (c.steps && c.steps.length) card += ` Шаги: ${c.steps.slice(0, 3).join("; ")}.`;
    if (c.tip) card += ` Совет: ${c.tip}`;
    if (c.pair) card += ` Пара: ${c.pair}.`;
    if (st0.story) card += ` История: ${String(st0.story).slice(0, 220)}`;
    if (st0.guest) card += ` Гостю: «${st0.guest}».`;
    return card.slice(0, 640);
  }).join("\n");
}

// ── v130 (Доп. 443): вина и крепкое «Барной карты» ──
// Владелец (02.11): «Ассистент знает о сортимент барной карты? Его нужно учить?» — учить не нужно: Наставник читает карту
// в момент вопроса, как меню. Записи kind:"wine" и kind:"spirit" из кэша меню команды (sa_menu_shared): откуда, сорт и
// стиль, цена бокала и бутылки, бокалом ли, ноты, подача, фраза гостю, к каким блюдам; стоп — «СЕГОДНЯ НЕТ»; что дописал
// AI и ещё не проверили — с пометкой. Подходят по названию, производителю, региону и сорту, по блюду из «К блюдам» («что
// налить к рибаю»), по цвету и виду, по нотам; «бокалом» в вопросе — вина бокалом выше и списком.
const DRINK_TRIGGERS = /вин[оауеы]|винн|бокал|бутылк|игрист|шампанск|просекк|брют|сухое|сухого|полусух|полуслад|сладк|красн|белое|белого|розов|оранжев|десертн|креплен|сомелье|налить|налей|посоветуй|подобрать|виски|коньяк|бренди|\bром|джин|текил|мескал|водк|ликер|биттер|настойк|крепк|выдерж|бурбон|скотч|порци|аперитив|дижестив|барн/i;
// про коктейль спросили прямо — тогда и коктейли рядом с вином
const CK_STRONG = /коктейл|спек|рецепт|пропорц|шейк|стир|билд|мохито|негрони|маргарит|спритц|сауэр|мартини|дайкири|мул/i;
const drinksFromCache = (restaurant) => { try { const all = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); const list = Array.isArray(all[restaurant]) ? all[restaurant] : [];
  return list.filter((d) => d && (d.kind === "wine" || d.kind === "spirit") && d.id && d.name && !d.archived); } catch (e) { return []; } };
/** Вина и крепкое заведения из кэша — и для карточек под ответом (ui/assistant.jsx, lib/chat-ai.js). */
export const barDrinksOf = (restaurant) => drinksFromCache(restaurant);
const rubT = (n) => (n ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽" : "");
function drinkCard({ w, K, tp, pairs }) {
  let card = "— " + (K.kind === "spirit" ? "Крепкое" : "Вино") + " «" + tp.main + "»" + (tp.orig ? " (" + tp.orig + ")" : "") + (w.producer ? ", " + w.producer : "") + " [id: " + w.id + "].";
  if (w.stop) card += " ВНИМАНИЕ: СЕГОДНЯ НЕТ (стоп-лист), предложи другое из данных.";
  const line = [K.line(w), K.kind === "wine" && w.abv ? String(w.abv).replace(".", ",") + "%" : ""].filter(Boolean).join(" · ");
  if (line) card += " " + line + ".";
  const price = K.price(w);
  if (price) card += " Цена: " + price + ".";
  if (K.kind === "wine") card += w.byGlass ? " Есть бокалом." : " Только бутылкой.";
  if ((w.notes || []).length) card += " Ноты: " + w.notes.join(", ") + ".";
  const serve = K.cardServe(w);
  if (serve) card += " Подача: " + serve + ".";
  if (w.short) card += " Гостю: «" + String(w.short).trim().slice(0, 110) + "».";
  if (pairs.length) card += " К блюдам: " + pairs.join(", ") + ".";
  if (Array.isArray(w.ai) && w.ai.length) card += " Не проверено руководителем: " + w.ai.map((f) => K.FIELD_RU[f] || f).join(", ") + ".";
  return card.replace(/\u00a0/g, " ").slice(0, 400);
}
export function drinkAssistantContext(question, restaurant) {
  const ws = words(question);
  if (!ws.length) return null;
  const drinks = drinksFromCache(restaurant);
  if (!drinks.length) return null;
  const trig = DRINK_TRIGGERS.test(norm(question));
  const glassAsk = /бокал/i.test(norm(question));
  const dishes = (() => { try { return dishesOf(restaurant) || []; } catch (e) { return []; } })();
  const scored = [];
  for (const w of drinks) {
    const K = w.kind === "spirit" ? SPIRIT : WINE;
    const tp = titleParts(K, w);
    const pairs = (w.pair || []).map((id) => (dishes.find((d) => d && d.id === id) || {}).name || "").filter(Boolean);
    const kindText = K.kind === "wine" ? ["вино", COLOR_RU[w.color] || "", w.sweet || ""].join(" ") : [CAT_RU[w.cat] || "", w.style || ""].join(" ");
    let score = 0;
    for (const x of ws) {
      const st = stems(x);
      if (fieldHit(tp.main + " " + tp.orig, st, 4) || fieldHit(w.producer || "", st, 4)) score += 5;
      else if (fieldHit([w.region, w.country, (w.grapes || []).join(" ")].join(" "), st, 4)) score += 3;
      else if (pairs.some((n) => fieldHit(n, st, 4))) score += 3;
      else if (fieldHit(kindText, st, 4)) score += 2;
      else if (fieldHit((w.notes || []).join(" "), st, 4)) score += 2;
    }
    if (glassAsk && K.kind === "wine" && w.byGlass) score += 2;
    if (score >= (trig ? 2 : 5)) scored.push({ w, K, tp, pairs, score });
  }
  if (!scored.length && !trig) return null;
  // при равном счёте — бокалом и проверенные выше, стоп — ниже
  scored.sort((a, b) => b.score - a.score || (a.w.stop ? 1 : 0) - (b.w.stop ? 1 : 0) || (b.w.byGlass ? 1 : 0) - (a.w.byGlass ? 1 : 0) || ((a.w.ai || []).length ? 1 : 0) - ((b.w.ai || []).length ? 1 : 0));
  const nW = drinks.filter((d) => d.kind === "wine").length, nS = drinks.length - nW;
  let head = "— В «Барной карте» (Справочник → «Барная карта»): " + WINE.word(nW) + ", крепкого " + SPIRIT.word(nS) + ".";
  if (glassAsk) {
    const g = drinks.filter((d) => d.kind === "wine" && d.byGlass && !d.stop);
    if (g.length) head += " Бокалом: " + g.slice(0, 10).map((x) => titleParts(WINE, x).main + (x.priceGlass ? " " + rubT(x.priceGlass) : "")).join(", ") + ".";
  }
  return [head.replace(/\u00a0/g, " "), ...scored.slice(0, 3).map(drinkCard)].join("\n").slice(0, 1250);
}

/**
 * Возвращает текстовый блок контекста или null, если справочник не в тему.
 */
export function refAssistantContext(question, isLeader = false) {
  const ws = words(question);
  if (!ws.length) return null;
  const scored = [];
  for (const course of COURSES) {
    for (const l of course.lessons || []) {
      if (l.type !== "lesson") continue;
      if (l.leaderOnly && !isLeader) continue;   // глава руководителей — только им
      // Тот же стемминг, что у меню: «сменами» находит «смен», «поменяться» — «поменяются»
      const cw = norm(l.content || "").split(/[^а-яa-z0-9]+/);
      let score = 0;
      for (const w of ws) {
        const st = stems(w);
        if (fieldHit(l.title || "", st, 4)) score += 3;
        else {
          let n = 0;
          for (const fw of cw) { if (fw && st.some(x => fw.startsWith(x))) { n++; if (n >= 3) break; } }
          score += n;
        }
      }
      if (score >= 2) scored.push({ course, l, score });
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 2);
  const parts = top.map(({ course, l }) =>
    `— «${l.title}» (курс «${course.title}»):\n${excerpt(l.content, ws)}`);
  return parts.join("\n\n").slice(0, 1300);
}

// v141 (Доп. 458): вопрос про то, что советовать и продавать, или про позицию гоу-листа
const GO_ASK = /гоу|go.?list|посовет|совету|предлож|рекоменд|прода[тжвюе]|продвига|что взять|что выбрать|что заказ/;
function goAsked(q, list) {
  const t = norm(q);
  if (GO_ASK.test(t)) return true;
  return (Array.isArray(list) ? list : []).some((g) => { const w = norm(g && g.name).split(/[^a-zа-я0-9]+/).filter((x) => x.length >= 4)[0]; return !!w && t.includes(w.slice(0, Math.max(4, w.length - 2))); });
}

// v142 (Доп. 461): вопрос про приёмку, ЕГАИС, «Честный знак», марки, кеги, списание или хранение алкоголя — Наставник
// отвечает по стандарту холдинга (тема «Приём и хранение»: bar7, m8), а не по общим знаниям. Коротко: сообщение режется до 2000
export const RCV_ASK = /егаис|(^|[^а-я])утм|(^|[^а-я])ттн|накладн|акциз|(^|[^а-я])фсм|(без|нет|поврежд[а-я]*|надорв[а-я]*|скан[а-я]*|сканир[а-я]*) марк|маркиров|честн[а-я]* знак|(^|[^а-я])упд|(^|[^а-я])эдо(?![а-я])|(^|[^а-я])кег|вывод[а-я]* из оборота|списа[нтлв]|списыва|лиценз|(вскрыт|открыт)[а-я]* (бутыл|вин|игрист)|хран[а-я]* (алкогол|вин|игрист|пив|кег|крепк)|стикер/;
export const RCV_LINE = "[Стандарт холдинга, приём и хранение: до подписи пересчёт и скан марки каждой бутылки; ответ на ТТН в ЕГАИС в день " +
  "поставки (закон: не позднее следующего рабочего дня); без марки или с повреждённой маркой не принимаем, «принято с расхождениями» и акт; " +
  "УПД после пересчёта и проверки кодов; кега: скан кода до подключения, подключение не позднее следующего рабочего дня; коктейли, бой, порча: " +
  "акт в ЕГАИС не позднее следующего рабочего дня, маркированное: вывод из оборота за 3 рабочих дня; хранить только по адресу из лицензии; " +
  "вскрытая бутылка: стикер, тихое вино 3 суток, игристое 1, креплёное 14.]";
export const rcvAsked = (q) => RCV_ASK.test(norm(q));

// v143 (Доп. 463): вопрос про лёд, стекло, мойку оборудования, баллоны CO2 или поломку — Наставник отвечает по стандарту
// холдинга (тема «Инвентарь и оборудование бара»: bar8, m9). Меню, «Барная карта» и коктейли сюда не нужны; глава
// Справочника остаётся (в «Кофе» есть «Чистота машины»). «сколько» — не «скол», «кроссовки» — не «совок»
export const EQP_ASK = /льдогенер|бункер|(^|[^а-я])сов(ок|ка|ком|ке|ки)([^а-я]|$)|осколк|(^|[^а-я])скол(?!ь)|разбил[а-я]* (бокал|стекл|стакан)|(бокал|стекл)[а-я]* (разбил|лопнул|треснул)|бой стекл|полиров|стаканомо|посудомо|кофемашин|кофемолк|паров[а-я]* трубк|холдер|пивн[а-я]* (лини|кран)|насадк|блендер|соковыжим|баллон|углекисл|(^|[^a-z])co2|(^|[^а-я])со2|редуктор|журнал[а-я]* температ|температур[а-я]* (в )?холодил|термометр|рабоч[а-я]* раствор|дезинфиц|моющ[а-я]* средств|не работает|слома|поломк|неисправ|искрит|ремонт|гейзер|мерн[а-я]* стакан|недолив|недолил|(провер[а-я]*) объем|(набира|набрат|набер|брать|берем)[а-я]* лед|лед[а-я]* (рук|стакан|бокал)/;
export const EQP_LINE = "[Стандарт холдинга, оборудование бара: лёд только совком, совок вне льда; бой стекла у льда: весь лёд в утиль; " +
  "бокал со сколом в утиль, горячий не в лёд; кофемашина: группы с моющим средством каждую смену, трубка после каждого вспенивания, " +
  "кофемолка раз в неделю; стаканомойка: температура в начале смены, дезинфекция в конце дня; льдогенератор: бункер не реже раза в " +
  "месяц, первый лёд после мойки в утиль; пивные линии не реже раза в 14 дней и при смене сорта; температура холодильников в журнал " +
  "ежедневно; CO2 меняет только обученный, утечку ищем мыльным раствором, одышка или головокружение у баллонов: сразу выйти и вывести " +
  "всех; поломка: отключить, табличка «Не работает», администратору, " +
  "заявка в Битрикс24 в ту же смену, сами не чиним; остальное по инструкции производителя.]";
export const eqpAsked = (q) => EQP_ASK.test(norm(q));

/**
 * Обогащает копию последнего user-сообщения контекстом справочника.
 * История в UI остаётся чистой — обогащение живёт только в payload.
 */
export function withRefContext(messages, profile, learner) {
  if (!messages.length) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "user") return messages;
  const isLeader = !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));
  // v142 (Доп. 461): вопрос о приёмке и хранении — ответ по стандарту холдинга (RCV_LINE ниже); цены и описания меню и «Барной
  // карты» и главы Справочника (о приёмке там ничего нет) сюда не нужны, а место в 2000 знаках — нужно: их не берём
  const rcv = rcvAsked(last.content);
  // v143 (Доп. 463): лёд, стекло, мойка, CO2, поломки — по стандарту холдинга (EQP_LINE); меню и «Барная карта» не нужны
  const eqp = eqpAsked(last.content);
  // v130: вина и крепкое «Барной карты». Вопрос про вино или крепкое — карта первой (сервер режет сообщение до 2000
  // знаков: иначе её съедали блюдо и коктейли), блюдо — одно, коктейли — только если спросили про коктейль
  const drinkCtx = rcv || eqp ? null : drinkAssistantContext(last.content, profile?.restaurant);
  const drinkFirst = !!drinkCtx && DRINK_TRIGGERS.test(norm(last.content));
  const menuCtx0 = rcv || eqp ? null : menuAssistantContext(last.content, profile?.restaurant);
  const menuCtx = drinkFirst && menuCtx0 ? menuCtx0.split("\n")[0] : menuCtx0;
  const ckCtx = rcv || eqp || (drinkFirst && !CK_STRONG.test(norm(last.content))) ? null : cocktailAssistantContext(last.content);
  // Меню и коктейли в приоритете: если вопрос про блюдо/напиток, справочник берём одной главой
  let refCtx = rcv ? null : refAssistantContext(last.content, isLeader);
  if ((menuCtx || ckCtx || drinkCtx) && refCtx) refCtx = refCtx.split("\n\n")[0];
  // v139 (Доп. 454): «О нас» — концепция и стандарты сети, своего заведения и соседей (копия на телефоне); блоки «для кого» —
  // по треку сотрудника. Есть — справочник одной главой
  const cnCtx = conceptAssistantContext(last.content, conceptFromStorage(), learner && learner.track);
  if (cnCtx && refCtx) refCtx = refCtx.split("\n\n")[0];
  // Персональный контекст ученика (Доп. 77): наставник знает, с кем
  // говорит — должность, трек, прогресс и слабые места из банка ошибок.
  let who = "";
  if (learner) {
    const parts = [];
    if (learner.position) parts.push("должность: " + learner.position);
    if (learner.roleTitle) parts.push("трек: " + learner.roleTitle);
    if (learner.total > 0) parts.push("пройдено " + learner.done + " из " + learner.total + " уроков");
    if (learner.dueMistakes > 0) parts.push("ждут повтора " + learner.dueMistakes + " вопросов" + (learner.topics && learner.topics.length ? " (темы: " + learner.topics.join(", ") + ")" : ""));
    if (learner.todayShift && learner.todayShift !== "выходной") parts.push("сегодня в смене: " + learner.todayShift);
    if (learner.todayShift === "выходной") parts.push("сегодня выходной");
    // Доп. 310: ритм дня — свеча (серия), стакан (цель дня), разминка до смены
    if (learner.streak > 0) parts.push("серия занятий: " + learner.streak + " дн.");
    if (learner.goal > 0) parts.push("цель дня: " + Math.min(learner.steps || 0, 99) + " из " + learner.goal + " шагов");
    if (learner.warmup === "open") parts.push("разминка до смены сегодня ещё не сделана");
    if (learner.warmup === "done") parts.push("разминка до смены сегодня сделана");
    // v40: «Путь мастера» — значки, «Мастер роли ✦», шаг дня, первые шаги в академии (считает App: lib/mastery.js).
    // Коротко: каждое сообщение режется до 2000 знаков, а место нужно данным меню и справочника
    const ms = learner.mastery && typeof learner.mastery === "object" ? learner.mastery : null;
    if (ms) {
      const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
      parts.push("значков " + n(ms.bronze) + "/" + (n(ms.total) || 14) + ", " + (ms.master ? "мастер роли" : "до мастера роли " + n(ms.have) + "/" + (n(ms.need) || 13)));
      const step = String(ms.step || "").replace(/\s+/g, " ").trim().slice(0, 90);
      if (step) parts.push("шаг дня — " + step);
      if (ms.fw && ms.fw.active) parts.push("первые шаги в академии " + n(ms.fw.done) + "/" + (n(ms.fw.total) || 7));
    }
    if (parts.length) who = "[Твой собеседник — " + parts.join("; ") + ". Отвечай под его уровень; если уместно — мягко предложи повторить слабые темы." +
      (ms ? " Значки, мастер роли, шаг дня, первые шаги — кнопка [[go:mastery|Путь мастера]]." : "") + "]";
    // свои уроки ресторана в треке сотрудника (правка 165) — тоже его программа; кнопка по номеру
    const own = (learner.customLessons || []).slice(0, 25);
    if (own.length) who = (who ? who + "\n" : "") + "[Свои уроки ресторана в треке сотрудника — это тоже его программа: " +
      own.map(l => `[${l.id}] ${String(l.title || "").slice(0, 60)} (раздел «${String(l.section || "").slice(0, 40)}»)`).join("; ") +
      ". На них тоже можно давать кнопку [[lesson:ID]] — ID строго из этого списка.]";
    // v141 (Доп. 458): гоу-лист смены сегодня (из брифинга дня; App: goToday) — что смена советует гостям в первую очередь.
    // Только когда вопрос о том, что советовать и продавать, или о позиции из гоу-листа: место в 2000 знаках нужно данным
    const go = goAssistantLine(learner.golist);
    if (go && goAsked(last.content, learner.golist)) who = (who ? who + "\n" : "") + "[Гоу-лист смены на сегодня: " + cutWords(go, 300) + ". Советуя гостю, начни с него.]";
  }
  // v142 (Доп. 461): приёмка и хранение — по стандарту холдинга
  if (rcv) who = (who ? who + "\n" : "") + RCV_LINE;
  // v143 (Доп. 463): инвентарь и оборудование бара — по стандарту холдинга
  if (eqp) who = (who ? who + "\n" : "") + EQP_LINE;
  if (!menuCtx && !ckCtx && !drinkCtx && !refCtx && !cnCtx) {
    if (!who) return messages;
    return [...messages.slice(0, -1), { role: "user", content: last.content + "\n\n" + who }];
  }
  let instr = "\n\n[Данные из разделов приложения — отвечай по ним уверенно, это твой же ресторан. ";
  if (menuCtx) instr += "Состав и аллергены блюд взяты из раздела «Меню»; кнопка — [[go:menu|Открыть меню]]. Если у блюда пометка «В СТОП-ЛИСТЕ» — скажи об этом первым делом и предложи замену из тех же данных. ";
  if (ckCtx) instr += "Спеки коктейлей — из Колоды бармена: пропорции в мл называй точно как даны, ничего не округляй и не выдумывай; кнопка — [[go:cocktails|Открыть колоду]]. Если просят потренироваться, отработать руками или сдать сборку — кнопка [[go:barLab|Собрать руками]]. Если менеджер хочет добавить или поправить свой коктейль — кнопка [[go:ckEditor|Редактор коктейлей]]. Пометка «не в карте бара» значит: в этом ресторане коктейль не наливают — скажи об этом и предложи то, что в карте. ";
  if (drinkCtx) instr += "Вина и крепкое — из «Барной карты»: цены, «бокалом», подачу называй как даны, других вин и марок не придумывай, нет в данных — так и скажи; кнопка — [[go:wines|Открыть барную карту]]. «СЕГОДНЯ НЕТ» — скажи и предложи другое из данных; «Не проверено руководителем» — посоветуй уточнить. ";
  if (refCtx) instr += "По темам Справочника кнопка — [[go:reference|Открыть Справочник]] (не go:glossary). ";
  if (cnCtx) instr += "Концепция и стандарты заведений — из раздела «О нас» (их пишут руководители): пересказывай как даны, ничего не добавляй; кнопка — [[go:about|О нас]]. ";
  if ([menuCtx, ckCtx, drinkCtx, refCtx, cnCtx].filter(Boolean).length > 1) instr += "Выбери ОДНУ кнопку по теме вопроса. ";
  if (drinkCtx) instr += "Когда рассказываешь о конкретном коктейле, блюде, вине или крепком из данных, добавь отдельной строкой маркер с его id — ровно [[cocktail:ID]], [[dish:ID]], [[wine:ID]] или [[spirit:ID]], без подписи внутри скобок — приложение покажет карточку с картинкой. Не больше двух маркеров, только id из данных. ";
  else if (menuCtx || ckCtx) instr += "Когда рассказываешь о конкретном коктейле или блюде из данных, добавь отдельной строкой маркер с его id — ровно [[cocktail:ID]] или [[dish:ID]], без подписи внутри скобок — приложение покажет карточку с картинкой. Не больше двух маркеров, только id из данных. ";
  // Сервер режет каждое сообщение до 2000 символов — контекст подгоняем под остаток,
  // иначе обрежется самое ценное (данные в конце). Порядок важности: меню → вина и крепкое → коктейли → справочник.
  const head = last.content + (who ? "\n\n" + who : "") + instr + "\n";
  const budget = Math.max(400, 2000 - head.length - 2);
  const body = [cnCtx, ...(drinkFirst ? [drinkCtx, menuCtx, ckCtx, refCtx] : [menuCtx, drinkCtx, ckCtx, refCtx])].filter(Boolean).join("\n\n");
  const enriched = head + body.slice(0, budget) + "]";
  return [...messages.slice(0, -1), { role: "user", content: enriched }];
}
