// lib/live-check-api.js — v200 (Доп. 525): запросы живой проверки (этап 63) и отметки «старше менеджера» у должностей.
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
/** Сохранить проверку модуля */
export const lcSave = ({ emp, track, module, marks, note = "" }) =>
  call("live_check_save", { p_emp: emp, p_track: track, p_module: module, p_marks: marks, p_note: note || null });
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
