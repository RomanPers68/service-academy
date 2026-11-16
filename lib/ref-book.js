// lib/ref-book.js — v167 (Доп. 492): справочник с правками владельца.
// Владелец (15.11): «Мы можем сделать редактор справочника по типу как в меню, карте бара, контента и т.д.? Уверен, что
// инфа будет добавляться и хочется это делать с приложения». Решения: справочник общий для всех заведений; править можно
// всё, включая штатные главы; редактор только у владельца.
//   • Штатные разделы и главы живут в приложении (data/reference.js). На сервере (этап 53, ref_book / ref_book_save) —
//     только то, что владелец изменил или добавил: строка на раздел или главу. У штатного пустое поле значит «как в
//     приложении»; убрать строку — вернуть исходное. Свои разделы — «rs-…», свои главы — «rc-…».
//   • Здесь — память и копия на телефоне, загрузка и слияние штатного с правками (mergeRefBook). Сам текст справочника
//     сюда не подключён: модуль лёгкий и грузится при запуске, а справочник — когда его открывают. Запись, дерево
//     для редактора и кнопки оформления — в lib/ref-edit.js: он грузится вместе с редактором.
//   • Без этапа 53 (функции на сервере нет) или без правок слияние отдаёт штатное как есть — те же объекты.
// «Гид по приложению» не правится: он обновляется вместе со сборками.
import { rpc, saToken, rpcMissing } from "../api/supabase";

export const RB_CACHE = "sa_ref_book_v1";
export const RB_FIXED = ["app"];
export const RB_LIMITS = { title: 160, sub: 240, body: 60000, rows: 800 };
const ID_RE = /^[A-Za-z0-9_.:-]{1,60}$/;

export const isOwnSec = (id) => /^rs-/.test(String(id || ""));
export const isOwnCh = (id) => /^rc-/.test(String(id || ""));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const str = (v, max) => (typeof v === "string" && v ? v.slice(0, max) : null);

/** Строки правок, как их отдаёт сервер, → только годные: { id, kind, parent, title, sub, body, hidden, sort } */
export function normRefItems(raw) {
  const out = [], seen = new Set();
  (Array.isArray(raw) ? raw : []).forEach((r) => {
    if (!r || typeof r.id !== "string" || !ID_RE.test(r.id) || seen.has(r.id)) return;
    if (r.kind !== "sec" && r.kind !== "ch") return;
    seen.add(r.id);
    out.push({ id: r.id, kind: r.kind, parent: typeof r.parent === "string" && ID_RE.test(r.parent) ? r.parent : "",
      title: str(r.title, RB_LIMITS.title), sub: str(r.sub, RB_LIMITS.sub), body: typeof r.body === "string" ? r.body.slice(0, RB_LIMITS.body) : null,
      hidden: r.hidden === true, sort: num(r.sort) });
  });
  return out;
}

// ── память, копия на телефоне, подписка ──────────────────────────────────────────────────────────────────
const EMPTY = Object.freeze({ ver: "0", items: Object.freeze([]), can: false, missing: false, loaded: false });
let BOOK = undefined;   // undefined — ещё не читали; иначе { ver, items, can, missing, loaded }
let LOAD_P = null;
let LOAD_AT = 0;   // когда последний раз получили ответ сервера
const subs = new Set();
const emit = () => { for (const f of subs) { try { f(BOOK); } catch (e) { /* */ } } };
export const refBookSubscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const readCache = () => { try { const v = JSON.parse(localStorage.getItem(RB_CACHE) || "null"); return v && typeof v.ver === "string" && Array.isArray(v.items) ? v : null; } catch (e) { return null; } };
// Копия на телефоне — пока правки умещаются в меру (RB_CACHE_MAX знаков): память телефона общая с остальным приложением.
// Больше — копию не держим, правки приходят с сервера при запуске.
export const RB_CACHE_MAX = 1500000;
const writeCache = (b) => { try { const s = JSON.stringify({ ver: b.ver, items: b.items }); if (s.length <= RB_CACHE_MAX) localStorage.setItem(RB_CACHE, s); else localStorage.removeItem(RB_CACHE); } catch (e) { /* */ } };

/** То, что уже известно, без запроса: из памяти или с телефона. Всегда объект. */
export function refBookNow() {
  if (BOOK !== undefined) return BOOK;
  const c = readCache();
  BOOK = c ? { ver: c.ver, items: normRefItems(c.items), can: false, missing: false, loaded: false } : EMPTY;
  return BOOK;
}
export const refItemsNow = () => refBookNow().items;

/**
 * Правки с сервера (раз за заход; force — заново). Телефон называет версию, которая у него есть: та же — сервер
 * отвечает коротко. Обещание: то же, что refBookNow(). Нет этапа 53 — missing: true и пустые правки.
 */
export function loadRefBook(force = false) {
  const cur = refBookNow();
  if (!force && cur.loaded) return Promise.resolve(cur);
  if (LOAD_P && !force) return LOAD_P;
  const tok = saToken();
  if (!tok) return Promise.resolve(cur);
  const have = cur.items.length || cur.ver !== "0" ? cur.ver : null;
  const p = rpc("ref_book", { p_token: tok, p_have: have }).then((raw) => {
    if (rpcMissing(raw)) { BOOK = { ...EMPTY, missing: true, loaded: true }; try { localStorage.removeItem(RB_CACHE); } catch (e) { /* */ } emit(); return BOOK; }
    if (!raw || raw.ok !== true || typeof raw.ver !== "string") return refBookNow();
    const can = !!(raw.can && raw.can.edit);
    const now = refBookNow();
    LOAD_AT = Date.now();
    if (raw.same === true) BOOK = { ...now, can, missing: false, loaded: true };
    else { BOOK = { ver: raw.ver, items: normRefItems(raw.items), can, missing: false, loaded: true }; writeCache(BOOK); }
    emit();
    return BOOK;
  }).catch(() => refBookNow()).finally(() => { if (LOAD_P === p) LOAD_P = null; });
  LOAD_P = p;
  return p;
}

/**
 * Свежие правки: человек открыл справочник — спросим сервер ещё раз, если спрашивали давно (maxAge, мс). Ответ короткий,
 * когда версия та же. Так правку владельца команда видит, как только откроет справочник, а не при следующем запуске.
 */
export const RB_FRESH = 60000;
export function refreshRefBook(maxAge = RB_FRESH) {
  const cur = refBookNow();
  if (cur.missing || (cur.loaded && Date.now() - LOAD_AT < maxAge)) return Promise.resolve(cur);
  return loadRefBook(cur.loaded);
}

/** Для записи из редактора (lib/ref-edit.js): правки записаны на сервер — они же в памяти и на телефоне */
export function commitRefBook(ver, items) {
  BOOK = { ver: String(ver || refBookNow().ver), items, can: true, missing: false, loaded: true };
  LOAD_AT = Date.now();
  writeCache(BOOK);
  emit();
  return BOOK;
}

export const _resetRefBook = () => { BOOK = undefined; LOAD_P = null; LOAD_AT = 0; };   // для тестов

// ── слияние штатного справочника с правками ──────────────────────────────────────────────────────────────
const sortOf = (it, i) => (it && it.sort !== null && it.sort !== undefined ? it.sort : (i + 1) * 10);
const LAST = 1000000;   // своё без места — в конец, по порядку создания (номер растёт со временем)
const byPlace = (a, b) => a.sort - b.sort || a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const fixed = (id) => RB_FIXED.includes(id);

// Раскладка: разделы по местам и главы по разделам. → { secs: [{ id, base, it, own, sort, at, ch: [{ id, l, it, own, sort, at, home }] }], touched }
// Одна на обычный вид (mergeRefBook) и на редактор (refEditTree): что видит владелец в редакторе, то и получит команда.
export function refLayout(courses, rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const baseSec = new Set(courses.map((c) => c.id));
  const baseCh = new Set();
  courses.forEach((c) => (c.lessons || []).forEach((l) => baseCh.add(l.id)));

  const secs = courses.map((c, i) => {
    const r = fixed(c.id) ? null : byId.get(c.id), it = r && r.kind === "sec" ? r : null;
    return { id: c.id, base: c, it, own: false, sort: sortOf(it, i), at: i, ch: [] };
  });
  rows.forEach((r) => { if (r.kind === "sec" && isOwnSec(r.id) && !baseSec.has(r.id)) secs.push({ id: r.id, base: null, it: r, own: true, sort: r.sort !== null ? r.sort : LAST, at: LAST, ch: [] }); });
  secs.sort(byPlace);
  const open = new Set(secs.filter((s) => !fixed(s.id)).map((s) => s.id));
  const at = new Map(secs.map((s) => [s.id, s]));
  const touched = new Set();
  courses.forEach((c) => (c.lessons || []).forEach((l, i) => {
    const r = fixed(c.id) ? null : byId.get(l.id), it = r && r.kind === "ch" ? r : null;
    const to = it && it.parent && it.parent !== c.id && open.has(it.parent) ? it.parent : c.id;
    if (it) { touched.add(c.id); touched.add(to); }
    at.get(to).ch.push({ id: l.id, l, it, own: false, sort: sortOf(it, i), at: i, home: c.id });
  }));
  rows.forEach((r) => {
    if (r.kind !== "ch" || !isOwnCh(r.id) || baseCh.has(r.id) || !open.has(r.parent)) return;
    touched.add(r.parent);
    at.get(r.parent).ch.push({ id: r.id, l: null, it: r, own: true, sort: r.sort !== null ? r.sort : LAST, at: LAST, home: r.parent });
  });
  secs.forEach((s) => s.ch.sort(byPlace));
  return { secs, touched };
}
export const refSecTitle = (s) => (s.it && s.it.title) || (s.base ? s.base.title : "Раздел");
export const refSecSub = (s) => (s.it && s.it.sub) || (s.base ? s.base.subtitle : "") || "";

/**
 * Справочник, каким его видят: штатные разделы (base — массив курсов из data/reference.js по порядку) и правки владельца.
 *   • раздел: название и подзаголовок — из правки, иначе штатные; свой раздел встаёт по своему месту (без места — в конец);
 *   • глава: название и текст — из правки, иначе штатные; своя глава — в разделе parent; штатную можно перенести в
 *     другой раздел (parent);
 *   • скрытое в обычном виде не отдаётся; раздел без видимых глав тоже. all: true — всё, со скрытым;
 *   • у изменённого — changed, у своего — own, у скрытого — hidden.
 * Правок нет — возвращается base как есть; нетронутый раздел остаётся тем же объектом. «Гид по приложению» не правится.
 */
export function mergeRefBook(base, items, { all = false } = {}) {
  const courses = (Array.isArray(base) ? base : []).filter((c) => c && c.id);
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return courses;
  const { secs, touched } = refLayout(courses, rows);
  const lessonOf = (x) => {
    if (!x.it) return x.l;
    if (x.own) { const o = { id: x.id, title: x.it.title || "Без названия", type: "lesson", content: x.it.body || "", own: true }; if (x.it.hidden) o.hidden = true; return o; }
    const o = { ...x.l, title: x.it.title || x.l.title, content: x.it.body !== null ? x.it.body : x.l.content, changed: true };
    if (x.it.hidden) o.hidden = true;
    return o;
  };
  const out = [];
  secs.forEach((s) => {
    if (!s.own && !s.it && !touched.has(s.id)) { out.push(s.base); return; }   // раздел не тронут — тот же объект
    const lessons = s.ch.map(lessonOf).filter((l) => all || !l.hidden);
    const o = { ...(s.base || {}), id: s.id, title: refSecTitle(s), subtitle: refSecSub(s), lessons };
    if (s.own) o.own = true; else if (s.it) o.changed = true;
    if (s.it && s.it.hidden) o.hidden = true;
    if (!all && (o.hidden || !lessons.length)) return;
    out.push(o);
  });
  return out;
}

// ── свои фото в тексте главы ────────────────────────────────────────────────────────────────────────────────
// Строка [photo:номер] или [photo:номер|подпись]: фото ставит владелец в редакторе, хранится как фото урока на всю сеть
// (этап 51) под номером «rp:…». В тексте главы — только эта строка.
export const REF_PHOTO_RE = /^\[photo:([A-Za-z0-9_.:-]{1,80})(?:\|(.*))?\]$/;
/** Номера своих фото в тексте главы, по порядку, без повторов */
export function refPhotoIds(text) {
  const out = [];
  for (const ln of String(text || "").split("\n")) { const m = ln.trim().match(REF_PHOTO_RE); if (m && !out.includes(m[1])) out.push(m[1]); }
  return out;
}
/** Текст главы без строк с картинками — для поиска и Наставника */
export const refPlain = (text) => String(text || "").replace(/^[ \t]*\[(?:img|photo):[^\n]*\][ \t]*$/gm, "");

/**
 * Лёгкий индекс глав (data/reference-index.js: id, title, course, cid, type, leaderOnly) с правками владельца — для
 * «главы дня» и карточек в чате: скрытое убрано, названия свои, свои главы добавлены. Правок нет — тот же индекс.
 */
export function mergeRefIndex(index, items) {
  const list = Array.isArray(index) ? index : [];
  if (!Array.isArray(items) || !items.length) return list;
  const courses = [], at = new Map();
  list.forEach((e) => {
    const cid = e.cid || e.course || "";
    if (!at.has(cid)) { at.set(cid, courses.length); courses.push({ id: cid, title: e.course || "Справочник", subtitle: "", lessons: [] }); }
    courses[at.get(cid)].lessons.push({ ...e, content: "" });
  });
  const out = [];
  mergeRefBook(courses, items).forEach((c) => (c.lessons || []).forEach((l) => {
    const row = { id: l.id, title: l.title, course: c.title, cid: c.id };
    if (l.type) row.type = l.type;
    if (l.leaderOnly) row.leaderOnly = true;
    if (l.own) row.own = true;
    out.push(row);
  }));
  return out;
}
