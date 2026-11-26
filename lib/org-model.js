// lib/org-model.js — v198 (Доп. 523): заведения и должности — разбор ответа сервера (этап 61), выбор для экранов,
// подписи должностей и те же правила, что у этапа 61, для демо (сервер демо, вход «Демо») и проверок. Без сети и React:
// это берут и приложение (lib/org.js), и сервер демо в Node.
//
// Владелец (26.11): «Нужно добавить возможность добавлять заведения. И исключить привязанные. И что бы заведения
// появлялись после добавления в приложение… Так же нужно добавить возможность добавлять … должность». Списки — на
// сервере (sa_venues, sa_positions), правит только владелец. Прежние заведения скрыты, кроме «Два моря, Океан»: их
// сотрудники, меню и история остаются, вернуть — одним нажатием. Своя должность «работает как» одна из шести встроенных:
// от неё права и курс (у сотрудника position — встроенная, job_title — своя). Пока этапа 61 нет — запасной список:
// пять заведений и шесть должностей из data/, всё как до v198.
import { RESTAURANTS } from "../data/roles.js";
import { POSITION_LABEL, POSITIONS } from "../data/positions.js";

export const BASES = ["waiter", "hostess", "bartender", "senior_bartender", "manager", "senior"];
export const VENUE_MAX = 60;
export const POSITION_MAX = 40;

/** «Работает как»: что даёт новая должность — подсказка в окне «Новая должность» */
export const BASE_HINT = {
  waiter: "Права сотрудника зала, курс «Новичок»",
  hostess: "Права сотрудника зала, курс «Хостес»",
  bartender: "Права сотрудника зала, курс «Бар», чат бара",
  senior_bartender: "Как у бармена: курс «Бар», чат бара",
  manager: "Руководит своим заведением: команда, график, меню; курс «Менеджер»",
  senior: "Видит всю сеть, как руководящий состав; курс «Сервис-менеджер»",
};

/** Ответы сервера → текст для человека */
export const ORG_ERR = {
  forbidden: "Списки меняет только владелец.",
  exists: "Такое название уже есть в списке.",
  too_long: "Слишком длинное название.",
  bad_request: "Напиши название.",
  bad_base: "Выбери, как работает должность.",
  busy: "Это название уже встречается в старых данных. Выбери другое.",
  builtin: "У встроенной должности права не меняются.",
  not_found: "Этого уже нет в списке. Обнови экран.",
  no_venue: "Этого заведения нет в списке.",
  no_position: "Этой должности нет в списке.",
  stage: "Нужен этап базы 61: подскажет экран «Сервер».",
  auth: "Вход устарел. Войди заново.",
  net: "Нет связи. Попробуй ещё раз.",
};
export const orgErr = (code) => ORG_ERR[code] || ORG_ERR.net;

/** Название: без пробелов по краям и двойных внутри (как _sa_org_name) */
export const cleanName = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const low = (s) => cleanName(s).toLowerCase();
const num = (v) => (Number.isFinite(v) ? v : 0);

/** Запасной список: этапа 61 ещё нет — как до v198 */
export const orgFallback = () => ({
  stage: false, canEdit: false, titles: {}, me: null,
  venues: RESTAURANTS.map((name, i) => ({ name, hidden: false, sort: i, staff: null })),
  positions: POSITIONS.map((id, i) => ({ id, label: POSITION_LABEL[id], base: id, builtin: true, hidden: false, sort: i, staff: null })),
});

/** Ответ org_lists (и сохранений) → списки; не тот ответ — null */
export function normOrg(r) {
  if (!r || r.ok !== true || !Array.isArray(r.venues) || !Array.isArray(r.positions)) return null;
  const venues = r.venues.filter((v) => v && typeof v.name === "string" && cleanName(v.name))
    .map((v) => ({ name: v.name, hidden: v.hidden === true, sort: num(v.sort), staff: Number.isFinite(v.staff) ? v.staff : null }));
  const positions = r.positions.filter((p) => p && typeof p.id === "string" && p.id && typeof p.label === "string" && cleanName(p.label) && BASES.includes(p.base))
    .map((p) => ({ id: p.id, label: p.label, base: p.base, builtin: p.builtin === true, hidden: p.hidden === true, sort: num(p.sort),
      staff: Number.isFinite(p.staff) ? p.staff : null }));
  const titles = {};
  if (r.titles && typeof r.titles === "object" && !Array.isArray(r.titles)) {
    for (const [k, v] of Object.entries(r.titles)) if (typeof v === "string" && v) titles[k] = v;
  }
  const me = r.me && typeof r.me === "object" ? { title: typeof r.me.title === "string" && r.me.title ? r.me.title : null } : null;
  return { stage: true, canEdit: r.can_edit === true, venues, positions, titles, me };
}

const bySort = (a, b) => (a.sort - b.sort) || String(a.name || a.label).localeCompare(String(b.name || b.label), "ru");
/** Видимые заведения по порядку — названия */
export const venueNames = (o) => (o && o.venues ? o.venues.filter((v) => !v.hidden).sort(bySort).map((v) => v.name) : []);
/** Скрытые заведения (вернуть) */
export const hiddenVenues = (o) => (o && o.venues ? o.venues.filter((v) => v.hidden).sort(bySort) : []);
/** Для меню, концепции и формы: видимые и своё заведение — всегда, даже скрытое (меню своего ресторана нужно всем) */
export const venuesWithMine = (o, mine) => {
  const list = venueNames(o);
  return mine && !list.includes(mine) ? [mine, ...list] : list;
};
/** Должности для выбора (видимые), по порядку */
export const pickPositions = (o) => (o && o.positions ? o.positions.filter((p) => !p.hidden).sort(bySort) : []);
export const hiddenPositions = (o) => (o && o.positions ? o.positions.filter((p) => p.hidden).sort(bySort) : []);
export const positionById = (o, id) => (o && o.positions && id ? o.positions.find((p) => p.id === id) || null : null);
/** Название встроенной должности по её id (владелец мог переименовать) — для «работает как» */
export const baseLabel = (o, base) => (positionById(o, base) || {}).label || POSITION_LABEL[base] || base;

/** Подпись должности сотрудника: своя (job_title или из titles) → её название; встроенная → из списка → словарь */
export function titleOf(o, emp) {
  if (!emp) return "";
  const t = emp.job_title || (o && o.titles && emp.id != null ? o.titles[String(emp.id)] : null);
  const own = t ? positionById(o, t) : null;
  if (own) return own.label;
  const b = positionById(o, String(emp.position || "").toLowerCase());
  return b ? b.label : (POSITION_LABEL[emp.position] || emp.position || "");
}
/** id должности сотрудника в списке: своя или встроенная */
export const titleIdOf = (o, emp) => {
  const t = emp && (emp.job_title || (o && o.titles && emp.id != null ? o.titles[String(emp.id)] : null));
  return t && positionById(o, t) ? t : String((emp && emp.position) || "waiter").toLowerCase();
};

// ── Правила этапа 61 — для демо и проверок (st: { venues, positions }, меняется на месте) ───────────────────────
/** org_venue_save: добавить (то же название у скрытого — вернуть), переименовать, скрыть. Ответ без списков. */
export function venueOp(st, { name = null, newName = null, hidden = null } = {}) {
  const oldN = cleanName(name) || null, newN = cleanName(newName) || null;
  if ((newN || "").length > VENUE_MAX) return { ok: false, error: "too_long" };
  const twin = (n, not) => st.venues.find((v) => low(v.name) === low(n) && v.name !== not) || null;
  if (!oldN) {
    if (!newN) return { ok: false, error: "bad_request" };
    const t = twin(newN, null);
    if (t) { const was = t.hidden; t.hidden = false; return { ok: true, done: was ? "returned" : "exists", name: t.name }; }
    const vis = st.venues.filter((v) => !v.hidden);
    st.venues.push({ name: newN, hidden: false, sort: vis.length ? Math.max(...vis.map((v) => v.sort)) + 1 : 0, staff: 0 });
    return { ok: true, done: "added", name: newN };
  }
  const row = st.venues.find((v) => v.name === oldN);
  if (!row) return { ok: false, error: "not_found" };
  let done = "same", from = null;
  if (newN && newN !== row.name) {
    const t = twin(newN, row.name);
    if (t) return { ok: false, error: "exists", name: t.name };
    from = row.name; row.name = newN; done = "renamed";
  }
  if (hidden != null && hidden !== row.hidden) { row.hidden = !!hidden; done = hidden ? "hidden" : "returned"; }
  return { ok: true, done, name: row.name, ...(from ? { from } : {}) };
}

/** org_position_save: добавить с «работает как» (то же название у скрытой — вернуть), переименовать, «работает как»
 *  своей, скрыть. newId — id для новой (как на сервере: p + 8 знаков). */
export function positionOp(st, { id = null, label = null, base = null, hidden = null } = {}, newId = null) {
  const lab = cleanName(label) || null, b = base ? String(base).trim().toLowerCase() : null;
  if ((lab || "").length > POSITION_MAX) return { ok: false, error: "too_long" };
  if (b && !BASES.includes(b)) return { ok: false, error: "bad_base" };
  if (!id) {
    if (!lab || !b) return { ok: false, error: "bad_request" };
    const t = st.positions.find((p) => low(p.label) === low(lab));
    if (t) { if (!t.hidden) return { ok: false, error: "exists", id: t.id }; t.hidden = false; return { ok: true, done: "returned", id: t.id }; }
    const nid = newId || "p" + Math.random().toString(16).slice(2, 10).padEnd(8, "0");
    st.positions.push({ id: nid, label: lab, base: b, builtin: false, hidden: false, sort: st.positions.length ? Math.max(...st.positions.map((p) => p.sort)) + 1 : 0, staff: 0 });
    return { ok: true, done: "added", id: nid };
  }
  const row = st.positions.find((p) => p.id === id);
  if (!row) return { ok: false, error: "not_found" };
  let done = "same";
  if (lab && lab !== row.label) {
    if (st.positions.some((p) => p.id !== row.id && low(p.label) === low(lab))) return { ok: false, error: "exists" };
    row.label = lab; done = "renamed";
  }
  if (b && b !== row.base) {
    if (row.builtin) return { ok: false, error: "builtin" };
    row.base = b; done = "based";
  }
  if (hidden != null && hidden !== row.hidden) { row.hidden = !!hidden; done = hidden ? "hidden" : "returned"; }
  return { ok: true, done, id: row.id };
}

/** Первый запуск этапа 61: «Два моря, Океан» видно, остальные прежние и названия из сотрудников — скрыты */
export function orgSeed(extraNames = []) {
  const keep = "Два моря, Океан";
  const venues = RESTAURANTS.map((name, i) => ({ name, hidden: name !== keep, sort: i, staff: 0 }));
  for (const n of extraNames) if (n && !venues.some((v) => v.name === n)) venues.push({ name: n, hidden: true, sort: 10, staff: 0 });
  return { venues, positions: orgFallback().positions.map((p) => ({ ...p, staff: 0 })) };
}

/** Сообщение после сохранения: что произошло */
export function doneText(kind, r) {
  if (!r || !r.ok) return "";
  const n = r.name ? "«" + r.name + "»" : "";
  if (kind === "venue") {
    return { added: "Заведение " + n + " добавлено: уже есть в меню и в выборе.", returned: n + " снова в списке: сотрудники, меню и история на месте.",
      exists: n + " уже в списке.", renamed: "Теперь " + n + ": название поменялось везде.", hidden: n + " скрыто. Вернуть можно в «Скрытых».",
      same: "Без изменений." }[r.done] || "Готово.";
  }
  return { added: "Должность добавлена.", returned: "Должность снова в списке.", renamed: "Название поменялось.",
    based: "Права и курс поменялись у всех, у кого эта должность.", hidden: "Должность скрыта: у кого она есть, у тех остаётся.",
    same: "Без изменений." }[r.done] || "Готово.";
}

// ── v199 (Доп. 524): у каждого заведения своя статистика; руководство сети смотрит по заведениям ────────────────────
// Владелец (26.11): «у каждого заведения своя статистика. Но, руководитель всей сети мог по заведениям увидеть
// статистику, а вот руководитель конкретного заведения, к примеру управляющий, только то, за которым он прикреплен».
// Сеть — владелец и «Руководящий состав» (и своя должность, которая работает как он), как на сервере (_sa_caller).
// Остальные, менеджер тоже, видят только своё заведение. Выбор сети — «взгляд»: одно заведение или «Вся сеть».
export const LENS_ALL = "*";
/** Видит всю сеть: владелец или «Руководящий состав» */
export const isNetwork = (p) => !!p && (!!p.is_admin || p.position === "senior");
/** Какое заведение показать. Не сеть — всегда своё. Сеть — выбранное, если оно ещё в списке; иначе «Вся сеть»
 *  (где она есть: аналитика, отчёт) или своё заведение (где смотрят одно: итог месяца, новички, кандидаты, график). */
export function lensOf(raw, { network = false, own = "", venues = [], all = false } = {}) {
  const mine = cleanName(own);
  if (!network) return mine;
  if (raw === LENS_ALL && all) return LENS_ALL;
  if (raw && raw !== LENS_ALL && venues.includes(raw)) return raw;
  return all ? LENS_ALL : (mine || venues[0] || "");
}
/** Почему чужое заведение не открылось — текст для человека; владельцу — что сделать */
export function lensErr(code, admin = false) {
  if (code === "stage62") return admin ? "Другое заведение откроется после обновления сервера: нужен этап базы 62, подскажет экран «Сервер»."
    : "Другое заведение откроется, когда владелец обновит сервер.";
  if (code === "no_venue") return "Этого заведения нет в списке. Обнови экран.";
  if (code === "forbidden") return "Другие заведения видит только руководство сети.";
  if (code === "auth") return ORG_ERR.auth;
  return ORG_ERR.net;
}
/** Строки отчётов «по людям» и результаты тестов — только выбранного заведения («Вся сеть» — все) */
export const inLens = (venue, rest) => !venue || venue === LENS_ALL || cleanName(rest) === cleanName(venue);
/** Вкладки меню: сеть — все видимые заведения и своё; остальные — только своё (без своего — все, как раньше) */
export const menuVenues = (o, profile) => {
  const own = profile && profile.restaurant;
  return isNetwork(profile) || !own ? venuesWithMine(o, own) : [own];
};
