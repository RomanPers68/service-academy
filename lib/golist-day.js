// lib/golist-day.js — v141 (Доп. 458): лёгкая часть гоу-листа — без данных меню и коктейлей, чтобы главный код приложения
// не тянул их ради метки «гоу-лист» и контекста Наставника. Нормализация, строки для чтения и Telegram, итог смены,
// гоу-лист дня на телефоне и «Как вчера». Выбор из меню и подсказка Наставника — lib/golist.js.

export const GO_MAX = 3;
export const GO_LIMITS = { name: 60, why: 90, pair: 90, say: 160 };
/** Вкладки выбора: что можно поставить в гоу-лист */
export const GO_KINDS = [["dish", "Блюда"], ["cocktail", "Коктейли"], ["wine", "Вина"], ["spirit", "Крепкое"]];
export const GO_KIND_WORD = { dish: "блюдо", cocktail: "коктейль", wine: "вино", spirit: "крепкое" };
const KINDS = GO_KINDS.map((k) => k[0]);

const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
/** Обрезка по слову, с многоточием */
export const cutWords = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "").replace(/[,;:]$/, "") + "…" : t; };
const nrm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").trim();

/** Гоу-лист из данных (сервер, черновик, вчерашний): чужой формат не роняет экран — только понятные позиции, не больше трёх. */
export function goNormalize(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const name = str(x.name, GO_LIMITS.name);
    if (!name) continue;
    const id = str(x.id, 80) || name;
    if (out.some((o) => o.id === id)) continue;
    out.push({ id, name, kind: KINDS.includes(x.kind) ? x.kind : "dish", why: str(x.why, GO_LIMITS.why), pair: str(x.pair, GO_LIMITS.pair), say: str(x.say, GO_LIMITS.say) });
    if (out.length >= GO_MAX) break;
  }
  return out;
}

/** Позиции, которых сейчас нет в меню (в стопе, в архиве): их в брифинг не отправляем. Классики «Барной карты» в меню нет — она остаётся. */
export function goBlocked(go, menu) {
  const byId = new Map((menu || []).filter((d) => d && d.id).map((d) => [String(d.id), d]));
  return goNormalize(go).filter((g) => { const d = byId.get(g.id); return !!(d && (d.stop || d.archived)); }).map((g) => g.id);
}
export function goActive(go, menu) {
  const bad = new Set(goBlocked(go, menu));
  return goNormalize(go).filter((g) => !bad.has(g.id));
}

/** «Тартар, Негрони» */
export const goNames = (go) => goNormalize(go).map((g) => g.name).join(", ");

/** Строки позиции для чтения и Telegram: «Чем хорошо: …», «С чем предложить: …», «Фраза гостю: «…»». */
const noDot = (v) => String(v).replace(/([^.])\.$/, "$1");   // одна точка в конце не нужна, многоточие остаётся
export function goRows(g) {
  const out = [];
  if (g.why) out.push(["Чем хорошо", noDot(g.why)]);
  if (g.pair) out.push(["С чем предложить", noDot(g.pair)]);
  if (g.say) out.push(["Фраза гостю", "«" + g.say.replace(/^[«"]+|[»"]+$/g, "").replace(/\.+$/, "") + "»"]);   // точка — после кавычек, не внутри
  return out;
}

/** Текст блока для Telegram: «Гоу-лист:\n1. Тартар. Чем хорошо: … С чем предложить: … Фраза гостю: «…»». */
export function goText(go) {
  const list = goNormalize(go);
  if (!list.length) return "";
  const clip = (v) => String(v).replace(/[.!?…]+$/, "");   // точка — между строками, своя в конце строки не нужна
  return "Гоу-лист:\n" + list.map((g, i) => (i + 1) + ". " + g.name + goRows(g).map(([k, v]) => ". " + k + ": " + clip(v)).join("")).join("\n");
}

// ── Итог смены: сколько продано ───────────────────────────────────────────────────────────────
/** Продано по позициям гоу-листа: целые 0–99 999, только позиции этого гоу-листа. */
export function goSoldNormalize(sold, go) {
  const ids = new Set(goNormalize(go).map((g) => g.id));
  const out = {};
  if (!sold || typeof sold !== "object" || Array.isArray(sold)) return out;
  for (const [k, v] of Object.entries(sold)) {
    if (!ids.has(k) || v === "" || v == null) continue;
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0 && n <= 99999) out[k] = n;
  }
  return out;
}
/** «Тартар: 12 · Негрони: 7»; не записано — пусто. */
export function goSoldLine(go, sold) {
  const s = goSoldNormalize(sold, go);
  return goNormalize(go).filter((g) => s[g.id] != null).map((g) => g.name + ": " + s[g.id]).join(" · ");
}
export const goSoldDone = (go, sold) => { const list = goNormalize(go), s = goSoldNormalize(sold, go); return list.length > 0 && list.every((g) => s[g.id] != null); };

// ── Гоу-лист дня на телефоне: метка «гоу-лист» в меню и «Барной карте», контекст Наставника ─────────────
const TODAY_KEY = "sa_go_today";
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
/** Брифинг дня (brief_today) → запомнить его гоу-лист; нет гоу-листа или выключен — забыть. */
export function rememberGoToday(brief, restaurant) {
  try {
    const d = brief && brief.data, b = d && d.blocks;
    const go = d && d.on && d.on.go && b ? goNormalize(b.go) : [];
    if (!go.length) { localStorage.removeItem(TODAY_KEY); return; }
    localStorage.setItem(TODAY_KEY, JSON.stringify({ day: String(d.day || ""), restaurant: String(restaurant || ""), items: go.map((g) => ({ id: g.id, name: g.name, kind: g.kind, say: g.say })) }));
  } catch (e) { /* хранилище недоступно: метки просто не будет */ }
  finally { try { window.dispatchEvent(new Event("sa-go-today")); } catch (e) { /* без окна (тесты) */ } }
}
/** Гоу-лист сегодня (своего заведения): [{ id, name, kind, say }]; вчерашний и чужой — пусто. */
export function goToday(restaurant, now = new Date()) {
  try {
    const r = JSON.parse(localStorage.getItem(TODAY_KEY) || "null");
    if (!r || r.day !== ymd(now) || (restaurant && r.restaurant && r.restaurant !== restaurant) || !Array.isArray(r.items)) return [];
    return goNormalize(r.items);
  } catch (e) { return []; }
}
export const goTodayIds = (restaurant, now = new Date()) => new Set(goToday(restaurant, now).map((g) => g.id));
/** Позиция в гоу-листе сегодня: по id, а для классики и старых записей — по названию. */
export function inGoToday(item, restaurant, now = new Date()) {
  if (!item) return false;
  const list = goToday(restaurant, now);
  const id = String(item.id || ""), nm = nrm(item.name);
  return list.some((g) => (id && g.id === id) || (nm && nrm(g.name) === nm));
}
/** Для Наставника: «Тартар (фраза: «…»), Негрони» — коротко, сервер режет сообщение до 2000 знаков. */
export function goAssistantLine(list) {
  const go = goNormalize(list);
  if (!go.length) return "";
  return go.map((g) => g.name + (g.say ? " (фраза гостю: «" + cutWords(g.say, 90) + "»)" : "")).join("; ");
}

// ── «Как вчера»: последний отправленный гоу-лист на этом телефоне (без этапа 50 — запасной путь) ─────────
const LAST_KEY = "sa_go_last";
export function rememberGoLast(restaurant, day, go) {
  try {
    const list = goNormalize(go);
    if (!list.length) return;
    const all = JSON.parse(localStorage.getItem(LAST_KEY) || "{}") || {};
    all[restaurant || ""] = { day: String(day || ""), items: list };
    localStorage.setItem(LAST_KEY, JSON.stringify(all));
  } catch (e) { /* без хранилища — только с сервера */ }
}
/** Последний гоу-лист раньше сегодняшнего дня: { day, items } или null. */
export function goLast(restaurant, today) {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_KEY) || "{}") || {};
    const r = all[restaurant || ""];
    if (!r || !Array.isArray(r.items) || !r.items.length || !(String(r.day) < String(today))) return null;
    return { day: String(r.day), items: goNormalize(r.items) };
  } catch (e) { return null; }
}
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
/** Подпись кнопки: вчерашний — «Как вчера», раньше — «Как 4 ноября». */
export function goAgainLabel(day, today) {
  if (!day) return "";
  const [y, m, d] = String(today).split("-").map(Number);
  const yd = ymd(new Date(y, m - 1, d - 1));
  if (day === yd) return "Как вчера";
  const [, mm, dd] = String(day).split("-").map(Number);
  return mm && dd ? "Как " + dd + " " + MONTHS[mm - 1] : "Как в прошлый раз";
}
/** Вчерашний день для дня «ГГГГ-ММ-ДД» */
export const dayBefore = (day) => { const [y, m, d] = String(day).split("-").map(Number); return ymd(new Date(y, m - 1, d - 1)); };
