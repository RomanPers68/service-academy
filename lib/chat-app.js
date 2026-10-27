// lib/chat-app.js — v93 (Доп. 406): что умный чат знает о приложении. Уроки, тесты и темы всех ролей (лёгкий индекс
// MODULES_INDEX и свои курсы), блюда меню заведения, коктейли карты бара, главы Справочника — для «Задание»,
// «Поделиться», «Стоп-лист» и карточек в ответе Наставника; пройдено ли; ответ ИИ — текстом и карточками.
// Живёт в части чата (грузится вместе с ним): App.jsx отдаёт только лёгкий контекст (makeChatApp).
import { MODULES_INDEX } from "../data/modules-index";
import { REFERENCE_DAILY_INDEX } from "../data/reference-index";
import { roleLabel } from "../data/roles";
import { menuDishesFromStorage, barCocktails, sharedOf } from "./menu-dishes";
import { briefLines } from "./briefing";

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const ROLE_ORDER = ["seasonal", "core", "spg", "bar", "manager", "service_manager"];
const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const httpsImg = (s) => (/^https:\/\/[^\s"<>]+$/.test(String(s || "")) && String(s).length <= 600 ? String(s) : "");

/** Карточка блюда и коктейля — для «Поделиться», стоп-листа и ответа Наставника. */
export const dishItem = (d) => ({ kind: "dish", id: String(d.id), title: String(d.name || ""), sub: [d.cat, (d.ingredients || []).slice(0, 3).join(", ")].filter(Boolean).join(" · "), img: httpsImg(d.img), stop: !!d.stop });
export const cocktailItem = (c) => ({ kind: "cocktail", id: String(c.id), title: String(c.name || ""), sub: (c.ing || []).slice(0, 3).map((i) => (Array.isArray(i) ? i[0] : i)).filter(Boolean).join(", ") });

/**
 * Всё, что можно выбрать в чате: темы, уроки и тесты (по ролям: сначала новичок и ядро), свои курсы, блюда, коктейли,
 * главы Справочника (главы руководителей — только им). Повторы (тот же вид и id) — один раз.
 */
export function chatItems({ index = {}, custom = [], dishes = [], cocktails = [], refs = [], leader = false, label = roleLabel } = {}) {
  const out = [], seen = new Set();
  const add = (x) => { const k = x.kind + ":" + x.id; if (!x.id || !x.title || seen.has(k)) return; seen.add(k); out.push(x); };
  const mods = [...ROLE_ORDER.filter((r) => Array.isArray(index[r])).flatMap((r) => index[r].map((m) => [r, m])),
    ...Object.keys(index).filter((r) => !ROLE_ORDER.includes(r) && Array.isArray(index[r])).flatMap((r) => index[r].map((m) => [r, m])),
    ...(Array.isArray(custom) ? custom : []).map((m) => ["custom", m])];
  for (const [r, m] of mods) {
    if (!m || !m.id) continue;
    const ls = (m.lessons || []).filter((l) => l && l.id);
    const lid = ls.filter((l) => l.type === "lesson").map((l) => String(l.id)), qid = ls.filter((l) => l.type === "quiz").map((l) => String(l.id));
    const rl = r === "custom" ? "Свой курс" : label(r);
    if (lid.length + qid.length) add({ kind: "module", id: String(m.id), title: String(m.title || ""), sub: [rl, lid.length + " " + pl(lid.length, "урок", "урока", "уроков")].filter(Boolean).join(" · "), lessons: lid, quizzes: qid });
    ls.forEach((l) => { if (l.type === "lesson" || l.type === "quiz") add({ kind: l.type, id: String(l.id), title: String(l.title || ""), sub: [rl, m.title].filter(Boolean).join(" · ") }); });
  }
  (dishes || []).filter((d) => d && d.id != null && d.name && !d.archived).forEach((d) => add(dishItem(d)));
  (cocktails || []).filter((c) => c && c.id && c.name).forEach((c) => add(cocktailItem(c)));
  (refs || []).filter((x) => x && x.type === "lesson" && (leader || !x.leaderOnly)).forEach((x) => add({ kind: "ref", id: String(x.id), title: String(x.title || ""), sub: x.course || "" }));
  return out;
}

/** Поиск: нужные виды; название с начала, потом внутри, потом подпись; пусто — первые по порядку. */
export function searchItems(items, q, kinds = null, limit = 40) {
  const ks = kinds ? new Set(kinds) : null, nq = norm(q);
  const list = (items || []).filter((x) => !ks || ks.has(x.kind));
  if (!nq) return list.slice(0, limit);
  const hits = [];
  list.forEach((x, i) => { const t = norm(x.title), s = norm(x.sub); const r = t.startsWith(nq) ? 0 : t.includes(nq) ? 1 : s.includes(nq) ? 2 : -1; if (r >= 0) hits.push([r, i, x]); });
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return hits.slice(0, limit).map((h) => h[2]);
}

/** Пройдено ли мной: урок, тест, тема (все её уроки и тесты). */
export function itemDone(item, { completed = {}, quizDone = {} } = {}) {
  if (!item) return false;
  if (item.kind === "lesson") return !!completed[item.id];
  if (item.kind === "quiz") return !!quizDone[item.id];
  if (item.kind === "module") {
    const ls = item.lessons || [], qs = item.quizzes || [];
    return ls.length + qs.length > 0 && ls.every((id) => !!completed[id]) && qs.every((id) => !!quizDone[id]);
  }
  return false;
}

/** Названия уроков и тестов по id — для карточек в ответе Наставника. */
export function lessonTitles(index = MODULES_INDEX) {
  const out = {};
  Object.values(index || {}).forEach((mods) => (mods || []).forEach((m) => (m.lessons || []).forEach((l) => { if (l && l.id && !out[l.id]) out[l.id] = l.title; })));
  return out;
}

/**
 * Ответ ИИ для переписки: метки [[dish:id]], [[cocktail:id]], [[lesson:id|подпись]] — карточками (до трёх), [[go:…]] —
 * убрать; меток нет — карточки по названиям, которые есть в ответе (до двух, как в «Наставнике»). Переписка разметку
 * не показывает: **жирный** — просто текстом.
 */
export function aiReply(raw, { dishes = [], cocktails = [], lessons = {} } = {}) {
  const cards = [], seen = new Set();
  const add = (c) => { const k = c.kind + ":" + c.id; if (c.id && c.title && !seen.has(k) && cards.length < 3) { seen.add(k); cards.push(c); } };
  let text = String(raw || "").replace(/\[\[(dish|cocktail|lesson):([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, kind, id) => {
    if (kind === "dish") { const d = dishes.find((x) => x && String(x.id) === id); if (d) add(dishItem(d)); }
    else if (kind === "cocktail") { const c = cocktails.find((x) => x && String(x.id) === id); if (c) add(cocktailItem(c)); }
    else if (lessons[id]) add({ kind: "lesson", id, title: lessons[id] });
    return "";
  }).replace(/\[\[go:[a-z]+(?:\|[^\]]*)?\]\]/gi, "");
  if (!cards.length) {
    const low = norm(text);
    for (const c of cocktails) { if (cards.length >= 2) break; if (c && c.name && c.name.length >= 4 && low.includes(norm(c.name))) add(cocktailItem(c)); }
    for (const d of dishes) { if (cards.length >= 2) break; if (d && d.name && d.name.length >= 4 && low.includes(norm(d.name))) add(dishItem(d)); }
  }
  return { text: text.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/[ \t]{2,}/g, " ").replace(/ +([.,!?:;])/g, "$1").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), cards };
}

/** Брифинг дня (brief_today: { data }) — для карточки: дата, «Брифинг смены · 27 октября», строки. */
export function briefCard(tb, today = null) {
  const d = tb && tb.data;
  if (!d || !d.blocks || (today && d.day && d.day !== today)) return null;
  const lines = briefLines(d);
  return lines.length ? { date: d.day, title: "Брифинг смены · " + (d.dayLabel || ""), lines } : null;
}

/**
 * То, что чат знает о приложении (app в ui/chat-cards.jsx), из лёгкого контекста App.jsx: ctx = { restaurant, leader,
 * custom() — свои курсы, progress() — { completed, quizDone }, brief() — брифинг дня (brief_today) или null,
 * open(item) — открыть }. Список для поиска собирается один раз за открытие чата.
 */
export function makeChatApp(ctx) {
  let idx = null;
  const index = () => idx || (idx = chatItems({ index: MODULES_INDEX, custom: (ctx.custom && ctx.custom()) || [], dishes: menuDishesFromStorage(ctx.restaurant),
    cocktails: barCocktails(sharedOf(ctx.restaurant || "")), refs: REFERENCE_DAILY_INDEX, leader: !!ctx.leader }));
  return {
    search: (q, kinds) => searchItems(index(), q, kinds),
    open: (item) => (ctx.open ? ctx.open(item) : null),
    done: (item) => itemDone(item, (ctx.progress && ctx.progress()) || {}),
    brief: () => briefCard(ctx.brief ? ctx.brief() : null),
  };
}
