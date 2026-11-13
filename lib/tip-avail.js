// lib/tip-avail.js — v149 (Доп. 473): есть ли у заведения то, куда ведёт совет в уроке.
//
// Аудит v148: совет «Послушай, как рассказывает шеф» открывал пустой список, если записей нет; «Сомелье подберёт вина
// из вашей карты» — карту без вин; «Рассадка» — экран «Схемы зала ещё нет»; «График смен», «Опаздываю» и напоминания —
// тем, кого нет в графике; «Чат смены» — заведению без чата. Теперь совет показывается, только когда там есть что открыть.
//
// Этот модуль лёгкий (его читает App при каждом уроке): только сводка с телефона.
//   • sa_tip_avail = { <ресторан>: { menu, voices, chefVoice, somVoice, kbju: id блюда с КБЖУ, wines, spirits, barcard, at } } —
//     пишет lib/reference-context.js (rememberSharedMenu, availOfStorage) каждый раз, когда кэш меню команды обновился;
//   • sa_seat_plan = { <ресторан>: "1" | "0" } — есть ли схема зала (последний ответ seat_board);
//   • sa_tip_stage = { thanks: "1" | "0", cases: "1" | "0", chat: "1" | "0" } — есть ли на сервере «Спасибо от гостей»
//     (этап 34) и «Случаи» (этап 33): без этапа экран отвечает «На сервере ещё нет этапа…», и совет туда не ведёт; чат —
//     ответил ли chat_unread (App, раз в 20 с): так при следующем запуске чат известен сразу, а не через 4 секунды;
//   • тихая подгрузка раз в день — lib/tip-sync.js.
// Нет сводки — неизвестно, и совет молчит: лучше не показать, чем привести в пустоту.
export const AVAIL_KEY = "sa_tip_avail";
export const SEAT_KEY = "sa_seat_plan";
export const STAGE_KEY = "sa_tip_stage";

const ls = (st) => { if (st) return st; try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } };
const readMap = (key, st) => { try { const s = ls(st); const v = s ? JSON.parse(s.getItem(key) || "null") : null; return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } };
const writeMap = (key, m, st) => { try { const s = ls(st); if (s) s.setItem(key, JSON.stringify(m)); } catch (e) { /* место кончилось — не страшно */ } };

/** Сводка меню и бара заведения или null (ещё не знаем). */
export function readAvail(restaurant, st) {
  if (!restaurant) return null;
  const a = readMap(AVAIL_KEY, st)[restaurant];
  return a && typeof a === "object" ? a : null;
}
export function saveAvail(restaurant, a, st) {
  if (!restaurant || !a) return;
  const m = readMap(AVAIL_KEY, st);
  m[restaurant] = { ...a, at: Date.now() };
  writeMap(AVAIL_KEY, m, st);
}

/** Схема зала: "1" — есть, "0" — нет (этап есть, схему не рисовали), "" — неизвестно. */
export function readSeatPlan(restaurant, st) {
  if (!restaurant) return "";
  const v = readMap(SEAT_KEY, st)[restaurant];
  return v === "1" || v === "0" ? v : "";
}
/** Ответ seat_board → запомнить, есть ли схема. Ответ без ok — ничего не меняем; missing — этапа нет, забываем. */
export function rememberSeatPlan(restaurant, board, st, missing = false) {
  if (!restaurant) return;
  const m = readMap(SEAT_KEY, st);
  if (missing) { if (m[restaurant] != null) { delete m[restaurant]; writeMap(SEAT_KEY, m, st); } return; }
  if (!board || board.ok !== true) return;
  const has = !!(board.plan && Array.isArray(board.plan.tables) && board.plan.tables.length);
  const v = has ? "1" : "0";
  if (m[restaurant] === v) return;
  m[restaurant] = v;
  writeMap(SEAT_KEY, m, st);
}

/** Этапы сервера, которые знает подгрузка и App: { thanks, cases, chat } — "1" есть, "0" нет, "" неизвестно. */
export function readStages(st) {
  const m = readMap(STAGE_KEY, st), v = (x) => (x === "1" || x === "0" ? x : "");
  return { thanks: v(m.thanks), cases: v(m.cases), chat: v(m.chat) };
}
export function rememberStage(name, present, st) {
  if (!name) return;
  const m = readMap(STAGE_KEY, st), v = present ? "1" : "0";
  if (m[name] === v) return;
  m[name] = v;
  writeMap(STAGE_KEY, m, st);
}

/**
 * Флаги «можно открыть прямо сейчас» для советов (lib/lesson-tips.js, ctx.can). Чистая функция — проверяется тестом.
 * avail — сводка меню (readAvail), seatPlan — readSeatPlan, sched — человек есть в графике этого месяца,
 * chat — чат смены работает, about — в «О нас» есть что прочитать (или руководитель может вписать), thanks / cases — этапы есть.
 * Не знаем — false: лучше промолчать, чем привести в пустоту.
 */
export function availCan({ avail = null, seatPlan = "", isLead = false, sched = false, chat = false, about = false, thanks = false, cases = false } = {}) {
  const a = avail || {};
  return {
    menu: !!a.menu,
    voices: !!a.voices,
    chefVoice: !!a.chefVoice,
    somVoice: !!a.somVoice,
    kbju: !!a.kbju,
    wines: !!a.wines,
    spirits: !!a.spirits,
    noBarcard: !!avail && !a.barcard,            // «Своя карта бара»: только пока её не настроили
    seat: seatPlan === "1" || (!!isLead && seatPlan === "0"),   // руководителю пустая схема — повод её нарисовать
    sched: !!sched,
    chat: !!chat,
    about: !!about,
    thanks: !!thanks,
    cases: !!cases,
  };
}

/** След «этим уже пользовались» для советов (ключ на телефоне, см. used.keys в data/lesson-tips.js): раз — и хватит. */
export function traceUse(key, st) {
  try { const s = ls(st); if (s && key && !s.getItem(key)) s.setItem(key, "1"); } catch (e) { /* не страшно */ }
}
