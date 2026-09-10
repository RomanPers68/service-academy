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

// ── «Гость спрашивает»: вопросы под конкретное блюдо (Доп. 215) ─────────────────
const AL_Q = { "Глютен": "А тут есть глютен?", "Рыба": "Есть рыба?", "Моллюски и ракообразные": "Морепродукты есть?", "Яйца": "Яйца есть?", "Молоко": "Лактоза есть?", "Орехи": "Орехи есть?", "Соя": "Соя есть?", "Кунжут": "Кунжут есть?" };
export const AL_LABEL = { "Молоко": "Лактоза (молоко)", "Моллюски и ракообразные": "Морепродукты", "Глютен": "Глютен", "Рыба": "Рыба", "Яйца": "Яйца", "Орехи": "Орехи", "Соя": "Соя", "Кунжут": "Кунжут" };
export const allergenLabel = (a) => AL_LABEL[a] || a;
const ALL_AL = Object.keys(AL_Q);
const HOT_STRONG = /чили|халапен|табаско|шрирач|перец чили|острый|острая|острое|карри|харисс|кимчи|спайси|васаби|хрен/;
const HOT_LIGHT = /битый огурец|битые огурцы|имбир|горчиц|перец|паприк|дижон|чеснок|редис|руккол|редьк|дайкон/;
const GLOSS = [["понзу", "понзу — японский цитрусовый соус на соевой основе"], ["вакаме", "вакаме — мягкие морские водоросли"], ["юдзу", "юдзу — японский цитрус, между лаймом и мандарином"], ["страчател", "страчателла — сливочная сердцевина бурраты"], ["буррат", "буррата — моцарелла со сливочной начинкой"], ["кремет", "креметто — мягкий сливочный сыр"], ["мисо", "мисо — паста из ферментированной сои"], ["тобико", "тобико — икра летучей рыбы"], ["унаги", "унаги — копчёный угорь"], ["гребеш", "гребешок — морской моллюск с нежным сладковатым мясом"], ["стригун", "краб-стригун — дальневосточный краб с тонким сладким мясом"], ["крудо", "крудо — сырая рыба или моллюск в масле и цитрусе, по-итальянски"], ["севиче", "севиче — сырая рыба, «сваренная» соком лайма"], ["тартар", "тартар — мелко рубленное сырое мясо или рыба"], ["конфи", "конфи — долго томлённое в жире при низкой температуре"], ["су-вид", "су-вид — приготовлено в вакууме при точной температуре"], ["демигляс", "демигляс — густой соус на крепком мясном бульоне"], ["бешамель", "бешамель — белый соус на молоке и муке"], ["песто", "песто — соус из базилика, кедровых орехов и пармезана"], ["айоли", "айоли — чесночный майонез"], ["гуакамол", "гуакамоле — пюре из авокадо с лаймом"], ["хумус", "хумус — паста из нута с тахини"], ["тахини", "тахини — кунжутная паста"], ["кимчи", "кимчи — корейская острая квашеная капуста"], ["терияки", "терияки — сладко-солёный соевый соус"], ["булгур", "булгур — дроблёная пшеница"], ["кускус", "кускус — пшеничная крупа мелкими шариками"], ["полент", "полента — кукурузная каша"], ["ризотто", "ризотто — сливочный рис арборио"]];
const hash = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

export function dishFaq(d) {
  const out = [];
  const als = d.allergens || []; const ingsArr = d.ingredients || []; const ings = norm(ingsArr.join(" ")); const cat = norm(d.cat); const note = norm(d.note || ""); const desc = norm(d.desc || "");
  // 1) свои вопросы менеджера — всегда первыми
  String(d.faq || "").split("\n").map(x => x.trim()).filter(Boolean).forEach(line => { const m = line.split(/\s[—–-]\s/); if (m.length >= 2) out.push({ q: m[0], a: m.slice(1).join(" — ") }); });
  const pool = [];
  // 2) острота — с градацией, битый огурец и имбирь дают «остринку»
  const strong = ingsArr.find(x => HOT_STRONG.test(norm(x))); const light = ingsArr.find(x => HOT_LIGHT.test(norm(x)));
  if (strong) pool.push({ q: "Это острое?", a: `Да, ощутимо острое — остроту даёт ${strong.toLowerCase()}. Можно попросить мягче, если гость сомневается.` });
  else if (light) pool.push({ q: "Это острое?", a: `Не острое, но с лёгкой остринкой — её даёт ${light.toLowerCase()}. Большинству гостей в самый раз.` });
  else pool.push({ q: "Это острое?", a: "Нет, совсем не острое." });
  // 3) аллергены: один «есть», один «нет» — с правильной формулировкой
  if (als.length) { const a = als[hash(d.id) % als.length]; pool.push({ q: AL_Q[a], a: `Да, есть — ${allergenLabel(a).toLowerCase()}. Если у гостя ограничение — предложи замену.` }); }
  const absent = ALL_AL.filter(a => !als.includes(a)); if (absent.length) { const a = absent[hash(d.name) % absent.length]; pool.push({ q: AL_Q[a], a: `Нет. ${allergenLabel(a)} — в составе нет.` }); }
  // 4) вегетарианцу / веган
  const meat = /говядин|свинин|курин|куриц|утк|утин|баран|бекон|телят|индейк|мяс|колбас|ветчин|прошутто|хамон/.test(ings);
  const fishy = /рыб|лосос|тунец|креветк|краб|гребеш|устриц|кальмар|мид|осьминог|сельд|сибас|дорад|треск|угор|икр/.test(ings) || als.includes("Рыба") || als.includes("Моллюски и ракообразные");
  if (!meat && !fishy) pool.push({ q: "Подойдёт вегетарианцу?", a: als.includes("Молоко") || als.includes("Яйца") ? "Да, мяса и рыбы нет. Веганам — нет: есть молочное или яйца." : "Да, без мяса и рыбы; похоже, подойдёт и веганам — уточни у кухни." });
  else pool.push({ q: "Подойдёт вегетарианцу?", a: `Нет — ${meat ? "в блюде мясо" : "это рыба или морепродукты"}. Предложи из растительного раздела.` });
  if (/свинин|бекон|прошутто|хамон|сало/.test(ings)) pool.push({ q: "Свинина есть?", a: "Да, есть. Для гостей, кто не ест свинину, — предложи другое." });
  // 5) сырое?
  if (/крудо|тартар|севиче|устриц|сашими|карпаччо|сырой|сырая/.test(ings + " " + norm(d.name) + " " + desc)) pool.push({ q: "Это сырое?", a: "Да, подача сырая или слабомаринованная — так задумано; продукт дневной свежести. Беременным и осторожным гостям лучше предложить приготовленное." });
  // 6) порция и «на двоих»
  const gr = (note.match(/(\d{2,4})\s*(г|гр|грамм)/) || [])[1];
  if (gr) pool.push({ q: "Большая порция?", a: Number(gr) >= 350 ? `Щедрая — ${gr} г, вполне на двоих как закуска.` : Number(gr) >= 200 ? `Полноценная — ${gr} г, на одного.` : `Небольшая — ${gr} г, как закуска или к напиткам.` });
  // 7) температура / раздел
  if (/холодн|салат|крудо|сашими|устриц/.test(cat + " " + norm(d.name))) pool.push({ q: "Это холодное?", a: "Да, подаётся холодным — так раскрывается вкус." });
  else if (/горяч|суп|стейк|гриль|паст/.test(cat)) pool.push({ q: "Это подаётся горячим?", a: "Да, горячим, прямо с кухни." });
  // 8) сколько готовить
  if (/стейк|гриль|запеч|томлён/.test(cat + " " + desc + " " + ings)) pool.push({ q: "Долго ждать?", a: "Минут 20–25 — готовится под заказ." });
  else if (/суп|горяч|паст/.test(cat)) pool.push({ q: "Долго ждать?", a: "Минут 12–15." });
  else if (/холодн|закуск|салат|десерт/.test(cat)) pool.push({ q: "Долго ждать?", a: "Быстро, 7–10 минут — собирается, не готовится." });
  // 9) незнакомый ингредиент — объяснить
  const g = GLOSS.find(([k]) => (ings + " " + norm(d.name)).includes(k)); if (g) pool.push({ q: `А что такое ${ingsArr.find(x => norm(x).includes(g[0])) ? ingsArr.find(x => norm(x).includes(g[0])).toLowerCase() : g[0]}?`, a: g[1][0].toUpperCase() + g[1].slice(1) + "." });
  // 10) сахар в десерте, лук/кинза, замена гарнира
  if (/десерт/.test(cat)) pool.push({ q: "Очень сладкий?", a: /горьк|тёмн|темн|кофе|цитрус|лайм/.test(ings) ? "Сбалансированный — сладость держит горчинка или кислота." : "Да, десертная сладость." });
  if (/кинз/.test(ings)) pool.push({ q: "Можно без кинзы?", a: "Да — скажи кухне при заказе, уберут." });
  else if (/лук/.test(ings)) pool.push({ q: "Можно без лука?", a: "Можно — предупреди кухню при заказе." });
  if (d.pairing) pool.push({ q: "Что к нему взять?", a: d.pairing });
  // выбор: свои вопросы + до пяти из пула, стабильно для блюда (не скачут при каждом открытии)
  const seed = hash(d.id + d.name); const picked = pool.slice(); 
  for (let i = picked.length - 1; i > 0; i--) { const j = (seed + i * 7919) % (i + 1); [picked[i], picked[j]] = [picked[j], picked[i]]; }
  const hot = picked.find(x => x.q === "Это острое?"); const rest = picked.filter(x => x !== hot);
  return [...out, ...(hot ? [hot] : []), ...rest].slice(0, out.length + 5);
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
