// lib/lesson-tips.js — v148 (Доп. 472): какой совет показать в конце урока (тексты и «свои» уроки — data/lesson-tips.js).
//
// Правила (владелец: «не навязчиво, в виде совета, но чтобы ничего не было упущено; в тему урока, логично и полезно»):
//   • только в «своих» уроках функции и только обычных (не тест, не практика, не диалог);
//   • только то, чем человек ещё не пользовался: открывал экран, есть след на телефоне, инструмент «Пути мастера» уже
//     не нулевой или нажал кнопку совета;
//   • только то, что можно сделать прямо сейчас: квест — в день смены, «Раунд мастера» — когда есть пройденная тема,
//     «Свежесть» — когда тема побледнела, «Работа над ошибками» — когда есть что повторить; руководителю — его функции;
//   • не больше одного совета в день: показан в одном уроке — в других сегодня молчим (в том же уроке — тот же совет);
//   • «Не сейчас» убирает функцию на 14 дней; если совет просто прошли мимо три раза, он больше не показывается;
//   • пропущенный совет вернётся в следующем «своём» уроке этой функции — у каждой их несколько в каждом треке.
// Состояние — на телефоне: sa_tips_<uk> = { day, lesson, f, shown: { f: n }, later: { f: "YYYY-MM-DD" }, used: { f: день } }.
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
    return { day: o.day || "", lesson: o.lesson || "", f: o.f || "", shown: obj(o.shown), later: obj(o.later), used: obj(o.used) };
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
  const u = F.used || {};
  if (u.seen && ctx.seen && ctx.seen[u.seen]) return true;
  if (u.family && ctx.famUsed && ctx.famUsed.has(u.family)) return true;
  if (u.keys && ctx.keys && u.keys.some((p) => ctx.keys.some((k) => k.startsWith(p)))) return true;
  return false;
}

const laterActive = (state, fid, today) => !!(state.later && state.later[fid] && state.later[fid] > today);

// Совет для урока: { id, name, icon, fam, text, cta, open, ask, ref, tab, lesson } или null.
// ctx.can: { mistakes, faded, goldable, warmup, shift, passed } — можно ли сделать прямо сейчас; ctx.isLead — руководитель
export function pickLessonTip({ lessonId, lessonType = "lesson", state, ctx = {}, today = ymdOf() }) {
  if (!lessonId || (lessonType && lessonType !== "lesson")) return null;
  const list = LESSON_TIPS[lessonId];
  if (!list || !list.length || !state) return null;
  // не больше одного в день: сегодня совет уже был в другом уроке
  if (state.day === today && state.lesson && state.lesson !== lessonId) return null;
  const can = ctx.can || {};
  const fits = ([f]) => {
    const F = TIP_FEATURES[f];
    if (!F) return false;
    if (F.staff && !ctx.isLead) return false;
    if (featureUsed(f, state, ctx)) return false;
    if (laterActive(state, f, today)) return false;
    if (F.can && !can[F.can]) return false;
    return true;
  };
  const build = ([f, text, x]) => {
    const F = TIP_FEATURES[f], extra = obj(x);
    return { id: f, name: (ctx.isLead && F.nameStaff) || F.name, icon: F.icon, fam: F.fam || null, text, cta: extra.cta || F.cta, open: F.open,
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
