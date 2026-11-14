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
import { rpc, saToken, rpcMissing } from "../api/supabase";

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
    const id = l ? lessonPhotoId(l.id) : null, b = id ? photoOf(list, id) : null;
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
    if (n) { LIST = n; writeCache(n); emit(); }
    return n || lessonPhotoListNow();
  }).catch(() => lessonPhotoListNow()).finally(() => { if (LIST_P === p) LIST_P = null; });
  LIST_P = p;
  return p;
}

/** Фото урока как data: URL (full — целиком, иначе превью). Без сети и без фото — null */
export function lessonPhotoUrl(lessonId, ver, full = false, scope = null) {
  const k = lessonId + "|" + ver + "|" + (full ? 1 : 0);
  const have = PH.get(k);
  if (have) return typeof have === "string" ? Promise.resolve(have) : have;
  const tok = saToken();
  if (!tok) return Promise.resolve(null);
  const p = rpc("lesson_photo", { p_token: tok, p_lesson: lessonId, p_full: !!full, p_scope: scope }).then((r) => {
    if (!r || r.ok !== true || !r.data) { PH.delete(k); return null; }
    const url = "data:" + (r.mime || "image/jpeg") + ";base64," + r.data;
    PH.set(k, url);
    return url;
  }).catch(() => { PH.delete(k); return null; });
  PH.set(k, p);
  return p;
}
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
  if (photo.fullUrl) PH.set(id + "|" + ver + "|1", photo.fullUrl);
  if (photo.thumbUrl) PH.set(id + "|" + ver + "|0", photo.thumbUrl);
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
