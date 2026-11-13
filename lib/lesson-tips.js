// lib/lesson-tips.js — v148 (Доп. 472): какой совет показать в конце урока (тексты и «свои» уроки — data/lesson-tips.js).
//
// Правила (владелец: «не навязчиво, в виде совета, но чтобы ничего не было упущено; в тему урока, логично и полезно»):
//   • только в «своих» уроках функции и только обычных (не тест, не практика, не диалог);
//   • только то, чем человек ещё не пользовался: открывал экран, есть след на телефоне, инструмент «Пути мастера» уже
//     не нулевой или нажал кнопку совета;
//   • только то, что можно сделать прямо сейчас: квест — в день смены, «Раунд мастера» — когда есть пройденная тема,
//     «Свежесть» — когда тема побледнела, «Работа над ошибками» — когда есть что повторить; руководителю — его функции;
//   • v149 (Доп. 473): и только туда, где есть что открыть: записи шефа, вина и крепкое в карте, схема зала, график,
//     чат, «О нас» (флаги — lib/tip-avail.js availCan); у функции can — строка или список, у совета — свой can сверху;
//   • не больше одного совета в день: показан в одном уроке — в других сегодня молчим (в том же уроке — тот же совет);
//   • «Не сейчас» убирает функцию на 14 дней; если совет просто прошли мимо три раза, он больше не показывается;
//   • пропущенный совет вернётся в следующем «своём» уроке этой функции — у каждой их несколько в каждом треке.
// Состояние — на телефоне: sa_tips_<uk> = { day, lesson, f, shown: { f: n }, later: { f: "YYYY-MM-DD" }, used: { f: день }, fresh }.
// v156 (Доп. 480): fresh — день, когда нажали «Показать советы снова» («Гид» → «Советы в уроках»): прежние следы (экраны до
// этого дня, ключи на телефоне, «Путь мастера») больше не прячут советы — только то, что открыли после.
import { TIP_FEATURES, LESSON_TIPS } from "../data/lesson-tips.js";

export const TIP_KEY = "sa_tips_";
export const TIP_LATER_DAYS = 14;
export const TIP_MAX_SHOWS = 3;

const ls = (st) => { if (st) return st; try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } };
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
export const ymdOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (day, n) => { const [y, m, d] = String(day).split("-").map(Number); return ymdOf(new Date(y, m - 1, d + n, 12)); };

export function readTipState(uk, st) {
  try { const s = ls(st); const v = s ? JSON.parse(s.getItem(TIP_KEY + (uk || "")) || "null") : null; const o = obj(v);
    return { day: o.day || "", lesson: o.lesson || "", f: o.f || "", shown: obj(o.shown), later: obj(o.later), used: obj(o.used), ...(o.fresh ? { fresh: String(o.fresh) } : {}) };
  } catch (e) { return { day: "", lesson: "", f: "", shown: {}, later: {}, used: {} }; }
}
export function saveTipState(uk, v, st) { try { const s = ls(st); if (s) s.setItem(TIP_KEY + (uk || ""), JSON.stringify(v)); } catch (e) {} }

// экраны и слои, открыв которые человек «уже пользовался» функцией
export const SCREEN_TIPS = (() => {
  const m = {};
  for (const [id, F] of Object.entries(TIP_FEATURES)) for (const s of (F.used && F.used.screens) || []) (m[s] = m[s] || []).push(id);
  return m;
})();
export const LAYER_TIPS = (() => {
  const m = {};
  for (const [id, F] of Object.entries(TIP_FEATURES)) for (const s of (F.used && F.used.layers) || []) (m[s] = m[s] || []).push(id);
  return m;
})();

// ключи на телефоне (localStorage) — следы прежнего использования, у части — с суффиксом пользователя
export function storageKeys(st) {
  const s = ls(st); const out = [];
  try { if (s) for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k) { const v = s.getItem(k); if (v && v !== "[]" && v !== "{}" && v !== "0" && v !== "null") out.push(k); } } } catch (e) {}
  return out;
}

// ctx: { seen: { id: день } — «Путь мастера» (lib/mastery.js markSeen), famUsed: Set — инструменты со значением > 0,
//        keys: [] — ключи на телефоне }
export function featureUsed(fid, state, ctx = {}) {
  const F = TIP_FEATURES[fid];
  if (!F) return true;
  if (state && state.used && state.used[fid]) return true;
  if (state && state.fresh) return false;   // v156: после «Показать советы снова» — только открытое после этого
  const u = F.used || {};
  if (u.seen && ctx.seen && ctx.seen[u.seen]) return true;
  if (u.family && ctx.famUsed && ctx.famUsed.has(u.family)) return true;
  if (u.keys && ctx.keys && u.keys.some((p) => ctx.keys.some((k) => k.startsWith(p)))) return true;
  return false;
}

const laterActive = (state, fid, today) => !!(state.later && state.later[fid] && state.later[fid] > today);
const needs = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// Совет для урока: { id, name, icon, fam, text, cta, open, ask, ref, tab, lesson } или null.
// ctx.can: { mistakes, faded, goldable, warmup, shift, passed } и v149 — menu, voices, chefVoice, somVoice, kbju, wines, spirits,
// noBarcard, seat, sched, chat, about, thanks, cases — можно ли сделать прямо сейчас; ctx.isLead — руководитель
export function pickLessonTip({ lessonId, lessonType = "lesson", state, ctx = {}, today = ymdOf() }) {
  if (!lessonId || (lessonType && lessonType !== "lesson")) return null;
  const list = LESSON_TIPS[lessonId];
  if (!list || !list.length || !state) return null;
  // не больше одного в день: сегодня совет уже был в другом уроке
  if (state.day === today && state.lesson && state.lesson !== lessonId) return null;
  const can = ctx.can || {};
  const fits = ([f, , x]) => {
    const F = TIP_FEATURES[f];
    if (!F) return false;
    if (F.staff && !ctx.isLead) return false;
    if (featureUsed(f, state, ctx)) return false;
    if (laterActive(state, f, today)) return false;
    if (needs(F.can).some((k) => !can[k])) return false;
    if (needs(obj(x).can).some((k) => !can[k])) return false;   // v149: «Вина вашей карты» — только если вина в карте есть
    return true;
  };
  const build = ([f, text, x]) => {
    const F = TIP_FEATURES[f], extra = obj(x);
    return { id: f, name: (ctx.isLead && F.nameStaff) || F.name, icon: extra.icon || F.icon, fam: F.fam || null, text, cta: extra.cta || F.cta,
      open: extra.open || F.open,   // v149: «Наоборот» у бармена — в «Колоде бармена», у официанта — в «Колоде меню»
      ask: extra.ask || null, ref: extra.ref || null, tab: extra.tab || null, lesson: lessonId };
  };
  // в том же уроке в тот же день — тот же совет (если он ещё уместен)
  if (state.day === today && state.lesson === lessonId && state.f) {
    const same = list.find(([f]) => f === state.f);
    if (same && fits(same)) return build(same);
    return null;
  }
  for (const item of list) {
    if (!fits(item)) continue;
    if ((Number((state.shown || {})[item[0]]) || 0) >= TIP_MAX_SHOWS) continue;
    return build(item);
  }
  return null;
}

// совет увиден (карточка показана): день, урок и функция дня; счётчик показов — раз на день и урок
export function markTipShown(uk, lessonId, fid, today = ymdOf(), st) {
  const v = readTipState(uk, st);
  if (v.day === today && v.lesson === lessonId && v.f === fid) return v;
  v.day = today; v.lesson = lessonId; v.f = fid;
  v.shown = { ...v.shown, [fid]: (Number(v.shown[fid]) || 0) + 1 };
  saveTipState(uk, v, st);
  return v;
}
// «Не сейчас» — функция прячется на 14 дней (в этом уроке сегодня совета больше нет)
export function tipLater(uk, fid, today = ymdOf(), st) {
  const v = readTipState(uk, st);
  v.later = { ...v.later, [fid]: addDays(today, TIP_LATER_DAYS) };
  saveTipState(uk, v, st);
  return v;
}
// функцией воспользовались (нажал кнопку совета или открыл экран) — совета про неё больше нет
export function markTipUsed(uk, fids, today = ymdOf(), st) {
  const ids = (Array.isArray(fids) ? fids : [fids]).filter((f) => TIP_FEATURES[f]);
  if (!ids.length) return null;
  const v = readTipState(uk, st);
  if (ids.every((f) => v.used[f])) return v;
  v.used = { ...v.used };
  for (const f of ids) if (!v.used[f]) v.used[f] = today;
  saveTipState(uk, v, st);
  return v;
}

// ── v156 (Доп. 480): «Гид» → «Советы в уроках» (руководителю). Владелец (14.11): «Прошел уже 2 урока, и пока не одной
// подсказки не увидел🥺»; на «добавлю руководителю в «Гид» список советов: какие скрыты и почему, и кнопку «Показать
// снова»» — «Да, давай добавим😉». Список — советы уроков трека по функциям: что ещё покажется и почему остальное скрыто.

// почему советом сейчас нечего открыть (флаги can — lib/tip-avail.js availCan и App)
export const TIP_NEED = {
  menu: "в заведении ещё нет меню", voices: "нет записей шефа и сомелье", chefVoice: "шеф ещё не записал рассказ", somVoice: "сомелье ещё не записал рассказ",
  kbju: "у блюд нет КБЖУ", wines: "в карте нет вин", spirits: "в карте нет крепкого", noBarcard: "своя карта бара уже настроена", seat: "нет схемы зала",
  sched: "тебя нет в графике этого месяца", chat: "чат смены ещё не работает", about: "в «О нас» пока пусто", thanks: "на сервере нет этапа «Спасибо от гостей»",
  cases: "на сервере нет этапа «Случаи»", mistakes: "нет ошибок, которые ждут повтора", faded: "нет побледневших тем", goldable: "нет темы для «Раунда мастера»",
  warmup: "разминка бывает только в день смены", shift: "квест бывает только в день смены", passed: "ещё нет пройденных тем",
};

/** Что с советом о функции: { kind: "ok" | "used" | "later" | "missed" | "cant" | "staff", on, until, need }. */
export function tipStatus(fid, state, ctx = {}, today = ymdOf()) {
  const F = TIP_FEATURES[fid];
  if (!F) return { kind: "none" };
  if (F.staff && !ctx.isLead) return { kind: "staff" };
  const st = state || { shown: {}, later: {}, used: {} };
  if (st.used && st.used[fid]) return { kind: "used", on: String(st.used[fid]) };
  if (featureUsed(fid, st, ctx)) return { kind: "used", on: "" };
  if (laterActive(st, fid, today)) return { kind: "later", until: st.later[fid] };
  if ((Number((st.shown || {})[fid]) || 0) >= TIP_MAX_SHOWS) return { kind: "missed" };
  const can = ctx.can || {}, need = needs(F.can).filter((k) => !can[k]);
  return need.length ? { kind: "cant", need } : { kind: "ok" };
}

const GROUP_ORDER = ["ok", "later", "cant", "missed", "used"];
/**
 * Советы уроков трека по функциям. lessons — уроки трека по порядку ({ id, title, type }). → { rows, today, total }:
 * rows — [{ id, name, icon, fam, status, lessons: [{ id, title, text }] }] по группам (покажутся, «Не сейчас», нечего
 * открыть, прошёл мимо, уже пользовался), внутри — по первому уроку; today — совет, который сегодня уже был (урок, функция).
 */
export function tipOverview({ lessons, state, ctx = {}, today = ymdOf(), titleOf = null }) {   // titleOf(id) — заголовок урока из другого трека
  const st = state || readTipState("");
  const by = new Map(), titles = new Map();
  let n = 0;
  for (const l of Array.isArray(lessons) ? lessons : []) {
    if (!l || !l.id) continue;
    titles.set(l.id, String(l.title || ""));
    if (l.type && l.type !== "lesson") continue;
    for (const [f, text, x] of LESSON_TIPS[l.id] || []) {
      const F = TIP_FEATURES[f];
      if (!F || (F.staff && !ctx.isLead)) continue;
      if (!by.has(f)) by.set(f, { id: f, name: (ctx.isLead && F.nameStaff) || F.name, icon: obj(x).icon || F.icon, fam: F.fam || null, first: n, lessons: [] });
      by.get(f).lessons.push({ id: l.id, title: String(l.title || ""), text, can: needs(obj(x).can) });
    }
    n++;
  }
  const can = ctx.can || {};
  const rows = [...by.values()].map((r) => {
    let status = tipStatus(r.id, st, ctx, today);
    // у совета бывает свой флаг («Вина вашей карты» — только если вина есть): нет ни одного урока, где он подходит, — нечего открыть
    if (status.kind === "ok") {
      const fit = r.lessons.filter((l) => l.can.every((k) => can[k]));
      if (!fit.length) status = { kind: "cant", need: [...new Set(r.lessons.flatMap((l) => l.can.filter((k) => !can[k])))] };
      else r = { ...r, lessons: [...fit, ...r.lessons.filter((l) => !fit.includes(l))] };
    }
    return { id: r.id, name: r.name, icon: r.icon, fam: r.fam, first: r.first, status, lessons: r.lessons.map(({ id, title, text }) => ({ id, title, text })) };
  }).sort((a, b) => GROUP_ORDER.indexOf(a.status.kind) - GROUP_ORDER.indexOf(b.status.kind) || a.first - b.first);
  // совет дня мог быть и в уроке другого трека (открыли поиском или из ленты) — заголовок тогда из titleOf
  const TF = TIP_FEATURES[st.f] || {};
  const todayTip = st.day === today && st.lesson ? { lesson: st.lesson, title: titles.get(st.lesson) || (typeof titleOf === "function" ? String(titleOf(st.lesson) || "") : ""), f: st.f,
    name: (ctx.isLead && TF.nameStaff) || TF.name || "" } : null;
  return { rows: rows.map(({ first, ...r }) => r), today: todayTip, total: rows.length };
}

const dm = (day) => { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(day || "")); return m ? m[2] + "." + m[1] : ""; };
const inLessons = (n) => "в " + n + " " + (n % 10 === 1 && n % 100 !== 11 ? "уроке" : "уроках");
// группы списка — словами (без «прошёл / пользовался»: и для неё, и для него)
export const TIP_GROUP = { ok: "Покажутся", later: "«Не сейчас»", cant: "Пока нечего открыть", missed: "Пропущены три раза", used: "Уже знакомо" };
/** Строка под названием функции в «Гиде»: где совет покажется или почему скрыт. */
export function tipReason(row) {
  const s = (row && row.status) || {}, l = (row && row.lessons) || [];
  if (s.kind === "ok") return l.length ? "в конце урока «" + l[0].title + "»" + (l.length > 1 ? " и ещё " + inLessons(l.length - 1) : "") : "";
  if (s.kind === "used") return "уже открывали" + (dm(s.on) ? " · " + dm(s.on) : "");
  if (s.kind === "later") return "вернётся " + dm(s.until);
  if (s.kind === "missed") return TIP_MAX_SHOWS + " раза без нажатия, больше не покажется";
  if (s.kind === "cant") return (s.need || []).map((k) => TIP_NEED[k] || k).join(", ");
  return "";
}

/** «Показать советы снова»: отметки «пользовался», «Не сейчас», счётчики и совет дня — с нуля; прежние следы не в счёт. */
export function resetTips(uk, today = ymdOf(), st) {
  const v = { day: "", lesson: "", f: "", shown: {}, later: {}, used: {}, fresh: today };
  saveTipState(uk, v, st);
  return v;
}
