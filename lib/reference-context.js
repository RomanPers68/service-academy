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
import { RESTAURANT_MENUS } from "../data/menu";
import { COCKTAILS } from "../data/cocktails";
import { COCKTAIL_STORIES } from "../data/cocktail-stories";

const COURSES = [REFERENCE_COURSE, REFERENCE_WINE_COURSE, REFERENCE_COFFEE_COURSE, REFERENCE_BAR_COURSE, REFERENCE_APP_COURSE];

const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е");
const STOP = new Set(["как", "что", "это", "для", "или", "чем", "при", "его", "она", "они", "оно", "мне", "нам", "вам", "надо", "нужно", "можно", "если", "чтобы", "какой", "какая", "какие", "почему", "зачем", "где", "когда", "есть", "быть", "такое", "расскажи", "скажи", "подскажи", "объясни", "привет", "приветик", "здравствуй", "здравствуйте", "спасибо", "пожалуйста", "помоги", "слушай", "окей"]);

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
// Тот же принцип, что и dishesFor в поиске: примеры + добавленные менеджером
// блюда из localStorage. Ассистент отвечает про блюда СВОЕГО заведения.
export function dishesOf(restaurant) {
  if (!restaurant) return [];
  let hide = {}, custom = {};
  try { hide = JSON.parse(localStorage.getItem("sa_menu_hide_samples") || "{}"); } catch (e) {}
  try { custom = JSON.parse(localStorage.getItem("sa_menu_custom") || "{}"); } catch (e) {}
  // Дополнение 129: меню, опубликованное менеджером (menu_get), тоже видно
  // ассистенту — кэш пишут тренажёр меню и сам экран ассистента при открытии.
  let shared = {};
  try { shared = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}"); } catch (e) {}
  const ownAll = custom[restaurant] || [];
  const ownIds = new Set(ownAll.map(d => d.id));
  const own = ownAll.filter(d => !d.archived);            // Доп. 167: архив ассистенту не показываем
  const team = (shared[restaurant] || []).filter(d => d && d.name && !ownIds.has(d.id) && !d.archived);
  const samples = hide[restaurant] ? [] : (RESTAURANT_MENUS[restaurant] || []);
  return [...own, ...team, ...samples];
}

/** Сохранить меню команды в кэш для ассистента (вызывают тренажёр и экран ассистента). */
export function rememberSharedMenu(restaurant, dishes) {
  if (!restaurant || !Array.isArray(dishes)) return;
  try {
    const shared = JSON.parse(localStorage.getItem("sa_menu_shared") || "{}");
    // Доп. 174: фото-текст (data:) в кэш не кладём — он весит сотни КБ на блюдо и съедает память телефона
    shared[restaurant] = dishes.slice(0, 200).map(d => (typeof d.img === "string" && d.img.startsWith("data:")) ? { ...d, img: "" } : d);
    localStorage.setItem("sa_menu_shared", JSON.stringify(shared));
  } catch (e) {}
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
    const stopTxt = d.stop ? ` ⚠ В СТОП-ЛИСТЕ${d.stop.since ? " с " + new Date(d.stop.since).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : ""} — сегодня не подаём, предложи замену.` : "";
    let card = `— Блюдо «${d.name}»${d.cat ? ` (${d.cat})` : ""}${d.id ? ` [id: ${d.id}]` : ""}.${stopTxt} Состав: ${(d.ingredients || []).join(", ") || "—"}. Аллергены: ${(d.allergens || []).join(", ") || "нет в списке"}.`;
    if (d.note) card += ` Важно: ${d.note}`;
    if (d.pairing) card += ` Сочетание: ${d.pairing}`;
    return card.slice(0, 480);
  });
  return parts.join("\n");
}

// ── Коктейли: спек, метод, бокал, шаги, совет, пара, история и фраза гостю ──
const CK_TRIGGERS = /коктейл|спек|рецепт|пропорц|шейк|стир|билд|бокал|гарнир|нали|смеша|бармен|аперитив|дижестив|тоник|джин|ром\b|виск|водк|текил|вермут|ликер|ликёр|сироп|биттер|кампари|просекко|мохито|негрони|маргарит/i;
const GLASS_RU = { rocks: "рокс", highball: "хайбол", martini: "коктейльная рюмка", flute: "флюте", hurricane: "харрикейн", margarita: "маргарита", sour: "сауэр", shot: "шот", irish: "бокал айриш", red: "винный" };

export function cocktailAssistantContext(question) {
  const ws = words(question);
  if (!ws.length) return null;
  const trig = CK_TRIGGERS.test(norm(question));
  const scored = [];
  for (const c of COCKTAILS) {
    const st0 = COCKTAIL_STORIES[c.id] || {};
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
    let card = `— Коктейль «${c.name}» [id: ${c.id}] (${c.method || "—"}, ${GLASS_RU[c.glass] || c.glass || "—"}). Спек: ${spec}.`;
    if (c.steps && c.steps.length) card += ` Шаги: ${c.steps.slice(0, 3).join("; ")}.`;
    if (c.tip) card += ` Совет: ${c.tip}`;
    if (c.pair) card += ` Пара: ${c.pair}.`;
    if (st0.story) card += ` История: ${String(st0.story).slice(0, 220)}`;
    if (st0.guest) card += ` Гостю: «${st0.guest}».`;
    return card.slice(0, 640);
  }).join("\n");
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

/**
 * Обогащает копию последнего user-сообщения контекстом справочника.
 * История в UI остаётся чистой — обогащение живёт только в payload.
 */
export function withRefContext(messages, profile, learner) {
  if (!messages.length) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "user") return messages;
  const isLeader = !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));
  const menuCtx = menuAssistantContext(last.content, profile?.restaurant);
  const ckCtx = cocktailAssistantContext(last.content);
  // Меню и коктейли в приоритете: если вопрос про блюдо/напиток, справочник берём одной главой
  let refCtx = refAssistantContext(last.content, isLeader);
  if ((menuCtx || ckCtx) && refCtx) refCtx = refCtx.split("\n\n")[0];
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
    if (parts.length) who = "[Твой собеседник — " + parts.join("; ") + ". Отвечай под его уровень; если уместно — мягко предложи повторить слабые темы.]";
  }
  if (!menuCtx && !ckCtx && !refCtx) {
    if (!who) return messages;
    return [...messages.slice(0, -1), { role: "user", content: last.content + "\n\n" + who }];
  }
  let instr = "\n\n[Данные из разделов приложения — отвечай по ним уверенно, это твой же ресторан. ";
  if (menuCtx) instr += "Состав и аллергены блюд взяты из раздела «Меню»; кнопка — [[go:menu|Открыть меню]]. Если у блюда пометка «В СТОП-ЛИСТЕ» — скажи об этом первым делом и предложи замену из тех же данных. ";
  if (ckCtx) instr += "Спеки коктейлей — из Колоды бармена: пропорции в мл называй точно как даны, ничего не округляй и не выдумывай; кнопка — [[go:cocktails|Открыть колоду]]. ";
  if (refCtx) instr += "По темам Справочника кнопка — [[go:reference|Открыть Справочник]] (не go:glossary). ";
  if ([menuCtx, ckCtx, refCtx].filter(Boolean).length > 1) instr += "Выбери ОДНУ кнопку по теме вопроса. ";
  if (menuCtx || ckCtx) instr += "Когда рассказываешь о конкретном коктейле или блюде из данных, добавь отдельной строкой маркер с его id — ровно [[cocktail:ID]] или [[dish:ID]], без подписи внутри скобок — приложение покажет карточку с картинкой. Не больше двух маркеров, только id из данных. ";
  // Сервер режет каждое сообщение до 2000 символов — контекст подгоняем под остаток,
  // иначе обрежется самое ценное (данные в конце). Порядок важности: меню → коктейли → справочник.
  const head = last.content + (who ? "\n\n" + who : "") + instr + "\n";
  const budget = Math.max(400, 2000 - head.length - 2);
  const body = [menuCtx, ckCtx, refCtx].filter(Boolean).join("\n\n");
  const enriched = head + body.slice(0, budget) + "]";
  return [...messages.slice(0, -1), { role: "user", content: enriched }];
}
