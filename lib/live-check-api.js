// lib/live-check-api.js — v200 (Доп. 525): запросы живой проверки (этап 63) и отметки «старше менеджера» у должностей.
// v201 (Доп. 526): сохранение по пунктам и блиц (этап 64), очередь без сети, сводка, график на сегодня.
// Ответ rpcMissing (этапа нет) → { ok: false, error: "stage" }: экраны говорят, что нужен этап, а не «нет связи».
import React from "react";
import { rpc, rpcMissing, saToken } from "../api/supabase";

const call = async (fn, params) => {
  let r;
  try { r = await rpc(fn, { p_token: saToken(), ...params }); } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) return { ok: false, error: "stage" };
  if (!r || typeof r !== "object") return { ok: false, error: "net" };
  return r;
};

/** Кого я могу проверить; venue — заведение, выбранное сетью (остальным сервер всё равно даёт своё) */
export const lcPeople = (venue = null) => call("live_check_people", { p_restaurant: venue || null });
/** Человек: пройденное в приложении и итоги; emp — id (пусто — я сам) */
export const lcPerson = (emp) => call("live_check_person", { p_emp: emp || "" });
/** Сохранить проверку модуля (как до v201: отметки 0/1/2) */
export const lcSaveMarks = ({ emp, track, module, marks, note = "" }) =>
  call("live_check_save", { p_emp: emp, p_track: track, p_module: module, p_marks: marks, p_note: note || null });

// ── v201 (Доп. 526): по пунктам, блиц, без сети ────────────────────────────────────────────────────────────────────
export const LC_QUEUE_KEY = "sa_lc_queue_v1";
const lsGet = () => { try { const a = JSON.parse(localStorage.getItem(LC_QUEUE_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const lsSet = (a) => { try { if (a.length) localStorage.setItem(LC_QUEUE_KEY, JSON.stringify(a.slice(-50))); else localStorage.removeItem(LC_QUEUE_KEY); } catch (e) {} };
/** Номер проверки с телефона: повтор после обрыва связи сервер узнаёт и не задваивает */
export const newCid = () => "lc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const marksOfItems = (items) => (items || []).map((x) => (x.g === x.o ? 2 : x.g > 0 ? 1 : 0));
const localScore = (items) => { const g = items.reduce((a, x) => a + x.g, 0), o = items.reduce((a, x) => a + x.o, 0); const s = o ? Math.round((g * 100) / o) : 0; return { score: s, passed: s >= 75 }; };

/** Сохранить по пунктам: items [{ k, g, o }], kind module | blitz. Нет связи — проверка ждёт на телефоне (queued);
 *  сервер без этапа 64 — проверка модуля уходит прежним вызовом (отметки 0/1/2), блиц — error stage64 */
export async function lcSave({ emp, track, module, items, note = "", kind = "module", cid = newCid(), title = "", repeat = [] }) {
  const params = { p_emp: emp, p_track: track, p_module: module, p_items: items, p_note: note || null, p_kind: kind, p_cid: cid,
    p_title: title || null, p_repeat: repeat && repeat.length ? repeat : null, p_marks: marksOfItems(items) };
  const r = await call("live_check_save", params);
  if (r && r.ok) return r;
  if (r && r.error === "stage") {
    if (kind !== "module") return { ok: false, error: "stage64" };
    const r2 = await lcSaveMarks({ emp, track, module, marks: marksOfItems(items), note });
    return r2 && r2.ok ? { ...r2, old: true } : r2;
  }
  if (r && r.error === "net") {
    lsSet([...lsGet().filter((x) => x.cid !== cid), { cid, tok: saToken(), p: params, at: Date.now() }]);
    return { ok: true, queued: true, id: null, ...localScore(items) };
  }
  return r;
}
/** Сколько проверок ждёт связи */
export const lcQueued = () => lsGet().length;
/** Отправить ждущие проверки. Ответ сервера (принял, отказал) — убрать из очереди; нет связи — оставить */
export async function lcFlush() {
  let sent = 0;
  for (const x of lsGet()) {
    let r;
    try { r = await rpc("live_check_save", { p_token: x.tok || saToken(), ...x.p }); } catch (e) { r = null; }
    if (!r || typeof r !== "object") break;   // связи всё ещё нет
    if (rpcMissing(r)) {
      try { r = await rpc("live_check_save", { p_token: x.tok || saToken(), p_emp: x.p.p_emp, p_track: x.p.p_track, p_module: x.p.p_module, p_marks: x.p.p_marks, p_note: x.p.p_note }); } catch (e) { r = null; }
      if (!r || typeof r !== "object") break;
    }
    if (r.ok) sent++;
    lsSet(lsGet().filter((q) => q.cid !== x.cid));
  }
  return sent;
}
/** Сводка: заведения, слабые модули и вопросы; venue — у сети выбранное заведение (null — вся сеть) */
export async function lcSummary(venue = null, days = 30) {
  const r = await call("live_check_summary", { p_restaurant: venue || null, p_days: days });
  return r && r.error === "stage" ? { ok: false, error: "stage64" } : r;
}
/** График заведения на этот месяц (как экран «График»): кто сегодня на смене */
export async function lcSchedule(restaurant, date = new Date()) {
  const mkey = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  try { const r = await rpc("schedule_load", { p_token: saToken(), p_restaurant: restaurant || "", p_month: mkey }); return r && r.ok ? r : null; } catch (e) { return null; }
}
/** Убрать ошибочную проверку (свою за сутки или владелец) */
export const lcDelete = (id) => call("live_check_delete", { p_id: id });

// ── «Старше менеджера»: какие свои должности стоят на ступень выше (для «Заведения и должности») ──────────────────
let _lv = { stage: null, ups: [], level: 0 };
const subs = new Set();
const setLv = (v) => { _lv = v; subs.forEach((f) => { try { f(v); } catch (e) {} }); };
export async function loadLevels() {
  const r = await call("live_check_levels", {});
  if (r.error === "stage") setLv({ stage: false, ups: [], level: 0 });
  else if (r.ok) setLv({ stage: true, ups: Array.isArray(r.ups) ? r.ups : [], level: Number(r.level) || 0 });
  return _lv;
}
export function useLevels() {
  const [v, set] = React.useState(_lv);
  React.useEffect(() => { subs.add(set); set(_lv); return () => { subs.delete(set); }; }, []);
  return v;
}
/** Отметить или снять «старше менеджера» у своей должности. Только владелец */
export async function setPositionUp(id, up) {
  const r = await call("org_position_level", { p_id: id, p_up: !!up });
  if (r.ok) setLv({ ..._lv, stage: true, ups: up ? [...new Set([..._lv.ups, id])] : _lv.ups.filter((x) => x !== id) });
  return r;
}
export function _resetLevels() { _lv = { stage: null, ups: [], level: 0 }; subs.clear(); }   // для проверок
