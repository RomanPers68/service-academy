// lib/routine.js — v141 (Доп. 459): «Распорядок смены» у руководителя в «Смене».
//
// Урок «Админ на смене» учит распорядку: открытие по чек-листу, брифинг со стоп-листом и гоу-листом, закрытие по чек-листу,
// итог гоу-листа в отчёт. Здесь — те же четыре шага по тому, что уже сделано в приложении: чек-листы дня (checklist_get),
// брифинг дня (brief_today) и итог гоу-листа (этап 50, brief_go_get). Экран — ui/routine.jsx.
import { DEFAULT_CHECKLISTS } from "./checklists";
import { goNormalize, goSoldLine } from "./golist-day";

/** Что сделать дальше — словами для строки «Дальше: …» */
export const ROUTINE_NEXT = { open: "чек-лист открытия", brief: "брифинг с гоу-листом", close: "чек-лист закрытия", go: "итог гоу-листа" };
const hm = (iso) => { const t = new Date(iso || ""); return Number.isNaN(t.getTime()) ? "" : String(t.getHours()).padStart(2, "0") + ":" + String(t.getMinutes()).padStart(2, "0"); };
/** Гоу-лист брифинга дня (блок включён), иначе пусто */
export const briefGo = (brief) => { const d = brief && brief.data; return d && d.on && d.on.go && d.blocks ? goNormalize(d.blocks.go) : []; };

/** Шаги: { k, title, done, skip, sub, full? }. cl — ответ checklist_get за сегодня (или null: ещё не знаем), brief — брифинг дня
 *  (или null), go — ответ brief_go_get за сегодня (или null), briefKnown — сервер уже ответил про брифинг дня (до ответа
 *  не пишем «не отправлен»). Итога нет, когда нет гоу-листа: этот шаг пропускается. */
export function routineSteps({ cl = null, brief = null, go = null, briefKnown = true } = {}) {
  const tpl = (cl && cl.templates) || {}, log = (cl && cl.today) || {};
  const clStep = (k, title) => {
    const items = Array.isArray(tpl[k]) && tpl[k].length ? tpl[k] : DEFAULT_CHECKLISTS[k] || [];
    const l = log[k] || {};
    const n = Array.isArray(l.checked) ? l.checked.filter((id) => items.some((x) => x.id === id)).length : 0;
    const done = !!l.done_at;
    return { k, title, done, skip: false, sub: !cl ? "чек-лист" : done ? "готово" + (hm(l.done_at) ? " в " + hm(l.done_at) : "") : n ? n + " из " + items.length : "не начат" };
  };
  const list = briefGo(brief);
  const saved = !!(go && go.saved && list.length);
  return [
    clStep("open", "Открытие"),
    { k: "brief", title: "Брифинг", done: !!brief, skip: false, sub: !brief ? (briefKnown ? "не отправлен" : "брифинг") : list.length ? "гоу-лист: " + list.length : "без гоу-листа" },
    clStep("close", "Закрытие"),
    // под кружком места мало: «записан», а что продано — в подписи для экранного диктора (full) и в «Утре руководителя»
    { k: "go", title: "Итог", done: saved, skip: !list.length, sub: !list.length ? (brief || briefKnown ? "нет гоу-листа" : "гоу-лист") : saved ? "записан" : "не записан",
      full: saved && goSoldLine(list, go.sold) ? "записан, " + goSoldLine(list, go.sold) : "" },
  ];
}
/** Первый несделанный шаг (пропущенные — не в счёт) или null: всё сделано. */
export const routineNext = (steps) => (steps || []).find((s) => !s.done && !s.skip) || null;
/** Подпись под шагами: «Дальше: чек-лист закрытия» или итог дня. */
export function routineLine(steps) {
  const n = routineNext(steps);
  return n ? "Дальше: " + ROUTINE_NEXT[n.k] : "Все шаги распорядка на сегодня сделаны";
}
