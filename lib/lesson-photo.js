// lib/lesson-photo.js — v146 (Доп. 467): фото урока и «главная мысль» крупно. Без интерфейса: список фото с сервера,
// выбор своего (заведение важнее сети), память, загрузка и снятие, тексты ошибок, первая мысль урока.
//
// Владелец (12.11) на идею «фото и главная мысль крупно — и тот же урок смотрится совсем иначе»: «Давай все» и вопрос
// «Её можно будет менять? В твоём демо показан салат к истории «Два моря», а можно было вставить фото ресторана или
// персонала на фоне ресторана». Да: руководитель ставит фото к любому уроку прямо с телефона (ui/lesson-photo.jsx).
//   • Сервер — этап 51 (supabase/supabase-stage51-lesson-photos.sql): фото лежат в базе, как фото «О нас» (этап 49):
//     JPEG до 300 КБ и превью до 48 КБ в base64 (сжимает телефон — lib/chat-photo.js). Права — как у «О нас»: для всей
//     сети ставят владелец и руководящий состав, для своего заведения — его руководители. Сотрудник видит фото своего
//     заведения, а если его нет — фото сети.
//   • lesson_photos — какие уроки с фото (номер, чьё, версия) и что можно мне; lesson_photo — само фото (превью или
//     целиком); lesson_photo_set, lesson_photo_del — поставить и убрать.
//   • Нет этапа 51 — фото нет ни у кого, руководителю в листе «Фото урока» — как обновить сервер.
import { rpc, saToken, rpcMissing } from "./supabase";
import { photoGet, photoPut, photoAll, photoPrune } from "./photo-store";   // v158 (Доп. 483): фото остаются на телефоне

export const LP_CACHE = "sa_lesson_photos_v1";   // список (урок → версия) на телефоне: обложка не мигает при входе
export const LP_LIMITS = { full: 640000, thumb: 110000, perScope: 600 };
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
export const lessonPhotoId = (id) => (ID_RE.test(String(id == null ? "" : id)) ? String(id) : null);

/**
 * Ответ lesson_photos → { restaurant, can: { net, venue }, map: { урок: { best, net, venue } } } или null.
 * best — что показать: фото своего заведения, а если его нет — фото сети.
 */
export function normLessonPhotos(r) {
  if (!r || r.ok !== true) return null;
  const restaurant = r.restaurant ? String(r.restaurant) : null;
  const map = {};
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const id = it && lessonPhotoId(it.lesson);
    if (!id || !it.ver) continue;
    const sc = String(it.scope || "");
    if (sc && sc !== restaurant) continue;   // чужие заведения сюда не попадают (сервер и так их не шлёт)
    const one = { scope: sc, ver: String(it.ver), w: Number(it.w) || null, h: Number(it.h) || null, by: it.by ? String(it.by) : "", at: it.at || null };
    const e = map[id] || (map[id] = { best: null, net: null, venue: null });
    if (sc === "") e.net = one; else e.venue = one;
    e.best = e.venue || e.net;
  }
  return { restaurant, can: { net: !!(r.can && r.can.net), venue: !!(r.can && r.can.venue) && !!restaurant }, map };
}

/** Фото, которое увидит сотрудник у урока, или null */
export const photoOf = (list, lessonId) => (list && list.map && list.map[lessonId] ? list.map[lessonId].best : null);
// ── v157 (Доп. 481): обложки разделов ───────────────────────────────────────────────────────────────────
// Владелец (14.11) на наброски «Справочник с фотографиями» и «то же у раздела в треке»: «Да, все прекрасно, мне нравится»
// и «Фото которые ты показал в идее, их можно будет самому загрузить, верно?». Можно: это те же фото, что у уроков
// (этап 51, сервер не меняется) — у раздела свой номер: «ref:<раздел Справочника>» и «mod:<раздел трека>». Сервер
// номер урока не сверяет с уроками (только вид: буквы, цифры, «_ . : -»), права и «сеть или своё заведение» — те же.
export const refCoverId = (id) => lessonPhotoId("ref:" + (id == null ? "" : id));
export const modCoverId = (id) => lessonPhotoId("mod:" + (id == null ? "" : id));
/** Фото из приложения для разделов Справочника, пока своего не поставили (public/reference) */
export const REF_COVER_DEFAULT = {
  serving: { src: "/reference/school_french_2.jpg", pos: "50% 58%" },
  wine: { src: "/reference/wine_pour.jpg", pos: "62% 50%" },
};
/**
 * Обложка раздела трека: своё фото раздела, а нет — фото первого урока раздела, у которого оно есть.
 * → { id, info, own, lesson } или null (фото нет, списка нет, нет этапа 51)
 */
export function moduleCover(list, mod) {
  if (!list || list === "missing" || !list.map || !mod) return null;
  const own = modCoverId(mod.id), a = own ? photoOf(list, own) : null;
  if (a) return { id: own, info: a, own: true, lesson: "" };
  for (const l of Array.isArray(mod.lessons) ? mod.lessons : []) {
    const id = l ? lessonPhotoId(l.photoKey || l.id) : null, b = id ? photoOf(list, id) : null;   // v191: у уроков «О нас» обложка общая
    if (b) return { id, info: b, own: false, lesson: String(l.title || "") };
  }
  return null;
}

/** Может ли человек ставить фото (хоть куда-нибудь) */
export const canEditPhotos = (list) => !!(list && list.can && (list.can.net || list.can.venue));
/** Куда ставить по умолчанию: правим уже стоящее — туда же; иначе сеть, если можно, иначе своё заведение */
export function defaultScope(list, lessonId) {
  if (!list) return null;
  const e = list.map[lessonId];
  if (e && e.venue && list.can.venue) return list.restaurant;
  if (e && e.net && list.can.net) return "";
  if (list.can.net) return "";
  return list.can.venue ? list.restaurant : null;
}
export const scopeName = (sc) => (sc ? "только «" + sc + "»" : "вся сеть");

// ── память и подписка ───────────────────────────────────────────────────────────────────────────────────
let LIST = undefined;            // нормализованный список; null — нет входа; "missing" — нет этапа 51
let LIST_P = null;
let LIST_TOK = null;             // чей список: вошёл другой человек — список и права заново
const tokNow = () => { try { return saToken() || ""; } catch (e) { return ""; } };
const sameUser = () => { const t = tokNow(); if (LIST_TOK !== t) { LIST_TOK = t; LIST = undefined; LIST_P = null; } return t; };
// на телефоне — у каждого входа свой список (права у руководителя и официанта разные)
const cacheKey = () => LP_CACHE + ":" + tokNow().slice(-12);
const PH = new Map();            // "урок|версия|0/1" → data: URL или обещание
const subs = new Set();
const emit = () => { for (const f of subs) { try { f(LIST); } catch (e) { /* */ } } };
export const lessonPhotoSubscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

const readCache = () => { try { const v = JSON.parse(localStorage.getItem(cacheKey()) || "null"); return v && v.map ? v : null; } catch (e) { return null; } };
const writeCache = (v) => { try { if (v && v.map) localStorage.setItem(cacheKey(), JSON.stringify(v)); } catch (e) { /* */ } };

/** То, что уже известно, без запроса: из памяти или с телефона */
export function lessonPhotoListNow() {
  sameUser();
  if (LIST !== undefined) return LIST;
  const c = readCache();
  return c || null;
}

/** Список с сервера (раз за заход; force — заново). Обещание: список, "missing" или null */
export function loadLessonPhotos(force = false) {
  sameUser();
  if (!force && LIST !== undefined && LIST !== null) return Promise.resolve(LIST);
  if (LIST_P && !force) return LIST_P;
  const tok = saToken();
  if (!tok) return Promise.resolve(null);
  const p = rpc("lesson_photos", { p_token: tok }).then((raw) => {
    if (tok !== tokNow()) return lessonPhotoListNow();   // пока ехал ответ, вошёл другой человек
    if (rpcMissing(raw)) { LIST = "missing"; emit(); return LIST; }
    const n = normLessonPhotos(raw);
    if (n) { LIST = n; writeCache(n); emit(); pruneLessonPhotos(n); }
    return n || lessonPhotoListNow();
  }).catch(() => lessonPhotoListNow()).finally(() => { if (LIST_P === p) LIST_P = null; });
  LIST_P = p;
  return p;
}

// ── v158 (Доп. 483): фото на телефоне (lib/photo-store.js) ───────────────────────────────────────────────
// Ключ на телефоне — «lp:<урок>|<версия>»: версия — отпечаток самого фото, сменили фото — ключ другой.
const storeKey = (lessonId, ver) => "lp:" + lessonId + "|" + ver;
let warmP = null;
/**
 * Превью с телефона — в память, разом (зовётся при запуске): обложка встаёт сразу, без серой заглушки и без сети.
 * Целые фото в память заранее не тянем (они большие) — их читает lessonPhotoUrl, когда нужны. → сколько подняли.
 */
export function warmLessonPhotos() {
  if (warmP) return warmP;
  const hot = warmHot();   // v163: и несколько целых фото, которые человек видит первыми (см. «фото готовы заранее» ниже)
  warmP = photoAll(false).then((rows) => {
    let n = 0;
    for (const [key, url] of rows) {
      if (!key.startsWith("lp:")) continue;
      const k = key.slice(3) + "|0";
      if (!PH.has(k)) { PH.set(k, url); n++; }
    }
    return n;
  }).catch(() => 0).then((n) => hot.then(() => n));
  return warmP;
}
/** Пришёл свежий список — старые версии и снятые фото с телефона убираем (сами фото в списке — остаются) */
export function pruneLessonPhotos(list) {
  if (!list || list === "missing" || !list.map) return Promise.resolve(0);
  const live = new Set();
  for (const id of Object.keys(list.map)) {
    const e = list.map[id] || {};
    for (const one of [e.net, e.venue]) if (one && one.ver) live.add(storeKey(id, one.ver));
  }
  return photoPrune("lp", (key) => live.has(key));
}

/** Фото урока как data: URL (full — целиком, иначе превью). Без сети и без фото — null */
export function lessonPhotoUrl(lessonId, ver, full = false, scope = null) {
  const k = lessonId + "|" + ver + "|" + (full ? 1 : 0);
  const have = PH.get(k);
  if (have) return typeof have === "string" ? Promise.resolve(have) : have;
  const tok = saToken();
  if (!tok) return Promise.resolve(null);
  // v158: сначала телефон (фото этой версии уже скачивали), и только потом сервер
  const p = photoGet(full, storeKey(lessonId, ver)).then((saved) => {
    if (saved) { PH.set(k, saved); return saved; }
    return rpc("lesson_photo", { p_token: tok, p_lesson: lessonId, p_full: !!full, p_scope: scope }).then((r) => {
      if (!r || r.ok !== true || !r.data) { PH.delete(k); return null; }
      const url = "data:" + (r.mime || "image/jpeg") + ";base64," + r.data;
      PH.set(k, url);
      // на телефон — только если сервер отдал именно ту версию, что просили (фото могли сменить минуту назад)
      if (!r.ver || String(r.ver) === String(ver)) photoPut(full, storeKey(lessonId, ver), url);
      return url;
    });
  }).catch(() => { PH.delete(k); return null; });
  PH.set(k, p);
  return p;
}

// ── v163 (Доп. 488): фото готовы заранее ─────────────────────────────────────────────────────────────────
// Владелец (15.11): «добавленные фото разделов подгружаются, это выглядит не очень. Я понимаю, что это из-за того, что
// фото уходят на сервер, но мы можем эту подгрузку сделать менее заметной?» Можем, с двух сторон.
//   1. Заранее (здесь). Пока человек на главной, приложение тихо, по одному, готовит то, что он откроет дальше: превью
//      фото из списка (они маленькие) и целые фото обложек: раздел из билета «Начать» и его урок, разделы своего трека,
//      разделы «Справочника». Что уже лежит на телефоне, поднимается в память, остальное один раз скачивается и остаётся
//      на телефоне (lib/photo-store.js). Открыл раздел, а фото уже стоит: без заглушки и без смены «мутно → чётко».
//      То, что на телефоне уже есть, поднимается сразу (liftLessonPhotos); за остальным идём чуть позже, после главной.
//   2. Плавно (ui/lesson-photo.jsx, CoverPhoto). То, что всё же приехало позже, проявляется, а не выскакивает.
// При запуске в память поднимаются ещё и несколько целых фото, которые человек видит первыми (LP_HOT: их номера с
// прошлого захода): фото в билете на главной стоит чётким сразу. Сервер не меняется: это те же запросы этапа 51.
// Телефон просит экономить трафик или связь совсем слабая (lean): целые фото заранее не качаем, только берём с телефона.
export const LP_HOT = "sa_lesson_photos_hot_v1";   // какие целые фото поднять в память при запуске: ["номер|версия", …]
export const HOT_MAX = 4;          // столько целых фото в память при запуске
export const WARM_HOLD = 300;      // столько заставка ждёт фото с телефона при запуске (App.jsx), не дольше, мс
export const AHEAD_FULL = 14;      // целых фото заранее за заход (до 300 КБ каждое, качаются один раз на телефон)
export const AHEAD_THUMBS = 72;    // превью заранее за заход (до 48 КБ каждое)
/**
 * Разделы «Справочника», у которых бывает обложка (ui/ReferenceSection.jsx, Hub). v172 (Доп. 497): карточки «Барная карта»
 * (barcard) в Справочнике больше нет, на её месте раздел «Бар: Основы» (bar); обложка, которую владелец ставил «Барной
 * карте», достаётся ему (refCoverPick), поэтому её номер остаётся в списке.
 */
export const REF_COVER_IDS = ["serving", "wine", "coffee", "bar", "barcard"];
/**
 * Номер обложки раздела Справочника в списке фото list. У «Бар: Основы», пока своей обложки нет, это обложка прежней
 * карточки «Барная карта»: карточка ушла на главную значком, а фото владельца пропасть не должно. Поставит разделу
 * свою — встанет она.
 */
export function refCoverPick(list, secId) {
  const id = refCoverId(secId);
  if (secId !== "bar" || !list || list === "missing" || photoOf(list, id)) return id;
  const old = refCoverId("barcard");
  return photoOf(list, old) ? old : id;
}
const hotKey = () => LP_HOT + ":" + tokNow().slice(-12);
const readHot = () => {
  try {
    const v = JSON.parse(localStorage.getItem(hotKey()) || "[]");
    return (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x.length > 2 && x.length < 180).slice(0, HOT_MAX);
  } catch (e) { return []; }
};
const writeHot = (keys) => { try { localStorage.setItem(hotKey(), JSON.stringify(keys.slice(0, HOT_MAX))); } catch (e) { /* */ } };
/** Фото с телефона в память, без сервера (full — целое, иначе превью). → data: URL или null */
const fromPhone = (id, ver, full) => {
  const k = id + "|" + ver + "|" + (full ? 1 : 0);
  const have = PH.get(k);
  if (have) return typeof have === "string" ? Promise.resolve(have) : have;
  return photoGet(!!full, storeKey(id, ver)).then((url) => { if (url && !PH.has(k)) PH.set(k, url); return url || null; }).catch(() => null);
};
const fullFromPhone = (id, ver) => fromPhone(id, ver, true);
// Что на этом телефоне уже готовили заранее: { t: [«номер|версия», …], f: […] } — превью и целые. Одно и то же фото заранее
// с сервера берётся один раз: если телефон его не сберёг (нет хранилища, его почистили), второй раз заранее не качаем —
// оно приедет, когда человек откроет экран, как раньше. Иначе при неработающем хранилище каждый запуск тянул бы всё заново.
export const LP_GOT = "sa_lesson_photos_got_v1";
const gotKey = () => LP_GOT + ":" + tokNow().slice(-12);
const readGot = () => {
  const ok = (a) => new Set((Array.isArray(a) ? a : []).filter((x) => typeof x === "string" && x.length > 2 && x.length < 180));
  try { const v = JSON.parse(localStorage.getItem(gotKey()) || "{}") || {}; return { t: ok(v.t), f: ok(v.f) }; } catch (e) { return { t: new Set(), f: new Set() }; }
};
const writeGot = (g, live) => { try { localStorage.setItem(gotKey(), JSON.stringify({ t: [...g.t].filter((k) => live.has(k)), f: [...g.f].filter((k) => live.has(k)) })); } catch (e) { /* */ } };
function warmHot() {
  if (!tokNow()) return Promise.resolve(0);
  return Promise.all(readHot().map((key) => { const i = key.lastIndexOf("|"); return i > 0 ? fullFromPhone(key.slice(0, i), key.slice(i + 1)) : null; }))
    .then((a) => a.filter(Boolean).length).catch(() => 0);
}
/** Телефон просит экономить трафик или связь 2G (где телефон это сообщает; iPhone не сообщает) */
export const leanNet = () => {
  try { const c = typeof navigator !== "undefined" ? navigator.connection : null; return !!(c && (c.saveData || /(^|-)2g$/.test(String(c.effectiveType || "")))); } catch (e) { return false; }
};
/**
 * Что человек откроет скорее всего. first — раздел из билета «Начать», lesson — его урок, mods — разделы своего трека,
 * refs — разделы «Справочника». → { full, thumbs }: номера фото по порядку важности, без повторов и не больше меры.
 *   full — обложки целиком: раздел из билета, его урок, разделы трека начиная с этого раздела (за ними те, что до него),
 *   разделы «Справочника»; thumbs — превью: всё из full, уроки своего трека в том же порядке, потом остальное из списка.
 */
export function aheadPlan(list, { first = null, lesson = null, mods = [], refs = REF_COVER_IDS } = {}) {
  if (!list || list === "missing" || !list.map) return { full: [], thumbs: [] };
  const full = [], thumbs = [];
  const add = (arr, id) => { if (id && photoOf(list, id) && !arr.includes(id)) arr.push(id); };
  const cover = (m) => { const c = m ? moduleCover(list, m) : null; if (c) add(full, c.id); };
  cover(first);
  add(full, lesson ? lessonPhotoId(lesson.photoKey || lesson.id) : null);   // v191: у уроков «О нас» обложка общая (photoKey)
  const all = (Array.isArray(mods) ? mods : []).filter(Boolean);
  const i = first ? all.findIndex((m) => m.id === first.id) : -1;
  const ms = i > 0 ? [...all.slice(i), ...all.slice(0, i)] : all;
  for (const m of ms) cover(m);
  for (const r of refs || []) add(full, refCoverId(r));
  for (const id of Object.keys(list.map)) if (id.startsWith("ref:")) add(full, id);   // v167 (Доп. 492): обложки своих разделов владельца
  for (const id of full) add(thumbs, id);
  for (const m of ms) for (const l of Array.isArray(m.lessons) ? m.lessons : []) add(thumbs, l ? lessonPhotoId(l.photoKey || l.id) : null);
  for (const id of Object.keys(list.map)) add(thumbs, id);
  return { full: full.slice(0, AHEAD_FULL), thumbs: thumbs.slice(0, AHEAD_THUMBS) };
}
/**
 * Целые фото плана — с телефона в память, без сервера. Зовётся сразу, как открылась главная (сеть подождёт): если фото
 * уже скачивали, раздел трека и «Справочник» откроются с ним, даже когда человек ушёл с главной в первую же секунду.
 * → сколько фото поднято.
 */
export async function liftLessonPhotos(list, plan) {
  const tok = tokNow();
  if (!tok || !list || list === "missing" || !list.map || !plan) return 0;
  await warmLessonPhotos();
  let n = 0;
  for (const id of plan.full || []) {
    const p = photoOf(list, id);
    if (tok !== tokNow()) break;
    if (!p || lessonPhotoCached(id, p.ver, true)) continue;
    if (await fullFromPhone(id, p.ver)) n++;
  }
  return n;
}
let aheadSig = "", aheadP = null;
/**
 * Приготовить фото по плану (aheadPlan): по одному, друг за другом, чтобы не мешать остальным запросам. Порядок: первые
 * HOT_MAX из плана (превью, потом целиком), превью остальных, остальные целиком. Тот же план второй раз не идёт.
 * lean — целые фото только с телефона. → { thumbs, full }: сколько фото приготовлено в этот раз.
 * Что-то не приехало (нет связи): план считается невыполненным и пойдёт заново, когда его попросят снова.
 * Каждое фото заранее берётся с сервера один раз на телефон (LP_GOT): пропало с телефона — приедет при показе, не заранее.
 */
export function aheadLessonPhotos(list, plan, { lean = false } = {}) {
  const none = { thumbs: 0, full: 0 };
  const tok = tokNow();
  if (!tok || !list || list === "missing" || !list.map || !plan) return Promise.resolve(none);
  const verOf = (id) => { const p = photoOf(list, id); return p ? p.ver : ""; };
  const full = (plan.full || []).filter(verOf), thumbs = (plan.thumbs || []).filter(verOf);
  const key = (id) => id + "|" + verOf(id);
  const sig = tok.slice(-12) + (lean ? "#l#" : "#f#") + full.map(key).join(",") + "#" + thumbs.map(key).join(",");
  if (sig === aheadSig && aheadP) return aheadP;
  aheadSig = sig;
  writeHot(full.slice(0, HOT_MAX).map(key));   // в следующий запуск эти фото встанут в память сразу
  const out = { thumbs: 0, full: 0 };
  let missed = 0;
  const alive = () => tok === tokNow() && sig === aheadSig;
  // уже готовили заранее (LP_GOT) — только с телефона; впервые — телефон, потом сервер, и запись в LP_GOT
  const got = readGot(), live = new Set(Object.keys(list.map).map(key));
  const note = (set, k) => { if (set.has(k) || tok !== tokNow()) return; set.add(k); writeGot(got, live); };
  const thumb = async (id) => {
    const v = verOf(id), k = key(id);
    if (!alive() || lessonPhotoCached(id, v, false)) return;
    const once = got.t.has(k);
    if (await (once ? fromPhone(id, v, false) : lessonPhotoUrl(id, v, false))) { out.thumbs++; note(got.t, k); } else if (!once) missed++;
  };
  const whole = async (id) => {
    const v = verOf(id), k = key(id);
    if (!alive() || lessonPhotoCached(id, v, true)) return;
    const once = lean || got.f.has(k);
    if (await (once ? fromPhone(id, v, true) : lessonPhotoUrl(id, v, true))) { out.full++; if (!lean) note(got.f, k); } else if (!once) missed++;
  };
  const p = (async () => {
    await warmLessonPhotos();
    const head = full.slice(0, HOT_MAX);
    for (const id of head) await thumb(id);
    for (const id of head) await whole(id);
    for (const id of thumbs) await thumb(id);
    for (const id of full.slice(HOT_MAX)) await whole(id);
    return out;
  })().catch(() => { missed++; return out; }).then((r) => { if (missed && sig === aheadSig) aheadSig = ""; return r; });
  aheadP = p;
  return p;
}

/** Для проверок: забыть всё, что в памяти (как новый запуск приложения; телефон — lib/photo-store.js — не трогает) */
export function _resetLessonPhotos() { LIST = undefined; LIST_P = null; LIST_TOK = null; PH.clear(); warmP = null; aheadSig = ""; aheadP = null; }
/** Уже загруженное (без запроса) или null */
export const lessonPhotoCached = (lessonId, ver, full = false) => { const v = PH.get(lessonId + "|" + ver + "|" + (full ? 1 : 0)); return typeof v === "string" ? v : null; };

const upd = (lessonId, scope, one) => {
  const base = LIST && LIST !== "missing" ? LIST : null;
  if (!base) return;
  const map = { ...base.map };
  const e = { ...(map[lessonId] || { best: null, net: null, venue: null }) };
  if (scope === "") e.net = one; else e.venue = one;
  e.best = e.venue || e.net;
  if (e.best) map[lessonId] = e; else delete map[lessonId];
  LIST = { ...base, map };
  writeCache(LIST);
  emit();
  pruneLessonPhotos(LIST);   // v158: сменили или сняли фото — прежняя версия на телефоне больше не нужна
};

/**
 * Поставить фото. photo — то, что вернул compressPhoto (lib/chat-photo.js): { full, thumb, fullUrl, thumbUrl, w, h }.
 * Ответ: { ok: true, ver } или { ok: false, error } (error: missing, auth, forbidden, bad_photo, too_many, net, …)
 */
export async function saveLessonPhoto(lessonId, scope, photo, who = "") {
  const id = lessonPhotoId(lessonId);
  if (!id || !photo || !photo.full || !photo.thumb) return { ok: false, error: "bad_request" };
  let r;
  try {
    r = await rpc("lesson_photo_set", { p_token: saToken(), p_lesson: id, p_scope: scope || "", p_full: photo.full, p_thumb: photo.thumb, p_w: photo.w || null, p_h: photo.h || null });
  } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) { LIST = "missing"; emit(); return { ok: false, error: "missing" }; }
  if (!r || r.ok !== true || !r.ver) return { ok: false, error: (r && r.error) || "net" };
  const ver = String(r.ver);
  if (photo.fullUrl) { PH.set(id + "|" + ver + "|1", photo.fullUrl); photoPut(true, storeKey(id, ver), photo.fullUrl); }
  if (photo.thumbUrl) { PH.set(id + "|" + ver + "|0", photo.thumbUrl); photoPut(false, storeKey(id, ver), photo.thumbUrl); }
  upd(id, scope || "", { scope: scope || "", ver, w: photo.w || null, h: photo.h || null, by: who, at: new Date().toISOString() });
  return { ok: true, ver };
}

/** Убрать фото урока там, где его ставили (scope: "" — сеть, иначе заведение) */
export async function removeLessonPhoto(lessonId, scope) {
  const id = lessonPhotoId(lessonId);
  if (!id) return { ok: false, error: "bad_request" };
  let r;
  try { r = await rpc("lesson_photo_del", { p_token: saToken(), p_lesson: id, p_scope: scope || "" }); } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) { LIST = "missing"; emit(); return { ok: false, error: "missing" }; }
  if (!r || r.ok !== true) return { ok: false, error: (r && r.error) || "net" };
  upd(id, scope || "", null);
  return { ok: true };
}

/** Текст ошибки для листа «Фото урока» */
export function lessonPhotoErr(code, owner = false) {
  switch (code) {
    case "missing": return owner
      ? "На сервере нет этапа 51. Supabase → SQL Editor → файл supabase-stage51-lesson-photos.sql → Run, и фото заработают."
      : "Фото уроков заработают, когда владелец обновит сервер (этап 51).";
    case "forbidden": return "Ставить фото к урокам могут руководители.";
    case "auth": return "Вход устарел — открой приложение заново.";
    case "bad_photo": return "Фото не подошло. Попробуй другое (JPEG или PNG).";
    case "too_many": return "Фото уроков уже слишком много. Убери ненужные и попробуй снова.";
    case "type": return "Это не картинка. Выбери фото.";
    case "decode": return "Телефон не смог открыть это фото. Попробуй другое.";
    case "big": return "Фото слишком большое даже после сжатия. Попробуй другое.";
    default: return "Не получилось: нет связи с сервером. Попробуй ещё раз.";
  }
}

// ── «Главная мысль» урока: первый абзац крупно ───────────────────────────────────────────────────────────
const LIST_RE = /^(•|-\s|—\s|\d+[.)]\s|>)/;   // строки с маркером-значком (галочка, крестик, булавка) ловит проверка «значок в начале» ниже
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\s️‍]+$/u;
const LEAD_MAX = 190;
/**
 * Первая мысль урока — первый обычный абзац (не заголовок, не список, не фраза гостю, не значок) в первых строках.
 * Длинный абзац — только первое предложение (если оно от 30 до 170 знаков). Ответ: { line, lead, rest } или null:
 * line — строка урока целиком (по ней экран узнаёт абзац), lead — что крупно, rest — что дальше обычным текстом.
 */
export function lessonLead(content) {
  const lines = String(content || "").split("\n");
  let seen = 0;
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    seen++;
    if (seen > 4) return null;
    if (EMOJI_ONLY.test(t) && t.length <= 12) continue;          // строка-разделитель со значком
    if (t.startsWith("[mm:")) continue;                            // картинка-эмоция
    if (t.startsWith("**") && t.endsWith("**")) return null;       // урок начинается с заголовка — без крупной мысли
    if (LIST_RE.test(t) || t.startsWith("«")) return null;          // со списка или фразы гостю
    if (/^\p{Extended_Pictographic}/u.test(t)) return null;          // строка со значком в начале — у неё свой вид
    if (t.length < 30) return null;
    if (t.length <= LEAD_MAX) return { line: raw, lead: t, rest: "" };
    const m = t.match(/^(.{30,170}?[.!?…])\s+(\S.*)$/u);
    return m ? { line: raw, lead: m[1], rest: m[2] } : null;
  }
  return null;
}
