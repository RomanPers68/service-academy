// lib/org.js — v198 (Доп. 523): заведения и должности в приложении — общие списки с сервера (этап 61), а не из кода.
// Здесь — кэш на телефоне и запрос: списки встают сразу, сервер подтверждает фоном. Пока этапа 61 нет — запасной список
// (пять заведений и шесть должностей, как до v198). Разбор, выбор и подписи — lib/org-model.js.
// Вход «Демо» (токен demo, сервера нет): правки живут в памяти по тем же правилам, что у этапа 61.
import React from "react";
import { rpc, rpcMissing, saToken } from "../api/supabase";
import { normOrg, orgFallback, orgSeed, venueOp, positionOp, BASES } from "./org-model";

export const ORG_KEY = "sa_org_v1";
const FRESH_MS = 30 * 1000;   // чаще не спрашиваем: экраны зовут loadOrg при каждом открытии

let _org = null, _at = 0, _loading = null;
const subs = new Set();

function readCache() {
  try { const j = JSON.parse(localStorage.getItem(ORG_KEY) || "null"); return j && j.stage === true && Array.isArray(j.venues) && Array.isArray(j.positions) ? j : null; }
  catch (e) { return null; }
}
/** Списки сейчас: с сервера, из кэша или запасные */
export const orgNow = () => _org || (_org = readCache() || orgFallback());

function setOrg(o, cache = true) {
  _org = o; _at = Date.now();
  if (cache) { try { if (o.stage) localStorage.setItem(ORG_KEY, JSON.stringify(o)); else localStorage.removeItem(ORG_KEY); } catch (e) {} }
  subs.forEach((f) => { try { f(o); } catch (e) {} });
}

/** Подписка экрана на списки: новое заведение появляется везде сразу после добавления */
export function useOrg() {
  const [o, set] = React.useState(orgNow);
  React.useEffect(() => { subs.add(set); if (_org && _org !== o) set(_org); return () => { subs.delete(set); }; }, []);
  return o;
}

// вход «Демо» (токена нет или demo): сервера нет — списки как после этапа 61, правки в памяти, в кэш не пишем
const isDemoToken = (t) => !t || t === "demo";
let _demo = null;
const demoOrg = () => {
  if (!_demo) _demo = orgSeed();
  return { stage: true, canEdit: true, titles: {}, me: null, venues: _demo.venues.map((v) => ({ ...v })), positions: _demo.positions.map((p) => ({ ...p })) };
};

/** Спросить сервер (не чаще раза в 30 секунд, force — сейчас) */
export function loadOrg(force = false) {
  const token = saToken();
  if (isDemoToken(token)) { if (!_demo) setOrg(demoOrg(), false); return Promise.resolve(orgNow()); }
  if (!force && _org && Date.now() - _at < FRESH_MS) return Promise.resolve(_org);
  if (_loading && !force) return _loading;
  const p = Promise.resolve().then(() => rpc("org_lists", { p_token: token })).then((r) => {
    if (rpcMissing(r)) { setOrg(orgFallback()); return orgNow(); }   // этапа 61 нет — как до v198
    const o = normOrg(r);
    if (o) setOrg(o);
    return orgNow();
  }).catch(() => orgNow()).finally(() => { if (_loading === p) _loading = null; });
  _loading = p;
  return p;
}

// ответ сохранения: { ok, done, name|id } или { ok: false, error }; списки из ответа — сразу всем экранам
async function save(fn, params, local) {
  const token = saToken();
  if (isDemoToken(token)) {
    if (!_demo) _demo = orgSeed();
    const r = local(_demo);
    if (r.ok) setOrg(demoOrg(), false);
    return r;
  }
  let r;
  try { r = await rpc(fn, { p_token: token, ...params }); } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) return { ok: false, error: "stage" };
  if (!r || r.ok !== true) return { ok: false, error: (r && r.error) || "net", name: r && r.name };
  const o = normOrg(r);
  if (o) setOrg(o);
  return r;
}

/** Заведение: добавить ({ newName }), переименовать ({ name, newName }), скрыть и вернуть ({ name, hidden }) */
export const saveVenue = ({ name = null, newName = null, hidden = null } = {}) =>
  save("org_venue_save", { p_name: name, p_new: newName, p_hidden: hidden }, (st) => venueOp(st, { name, newName, hidden }));

/** Должность: добавить ({ label, base }), переименовать, «работает как» своей, скрыть и вернуть */
export const savePosition = ({ id = null, label = null, base = null, hidden = null } = {}) =>
  save("org_position_save", { p_id: id, p_label: label, p_base: base, p_hidden: hidden }, (st) => positionOp(st, { id, label, base, hidden }));

/** Перевести сотрудника: заведение и должность из списка. Ответ: { ok, employee } */
export async function placeEmployee(empId, restaurant, title) {
  const token = saToken();
  if (isDemoToken(token)) {
    const o = orgNow();
    const p = o.positions.find((x) => x.id === title);
    return p ? { ok: true, employee: { id: empId, restaurant, position: p.base, job_title: p.builtin ? null : p.id } } : { ok: false, error: "no_position" };
  }
  let r;
  try { r = await rpc("admin_employee_place", { p_token: token, p_employee_id: empId, p_restaurant: restaurant, p_title: title }); } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) return { ok: false, error: "stage" };
  if (!r || r.ok !== true) return { ok: false, error: (r && r.error) || "net" };
  loadOrg(true);   // свои должности руководителю — новые
  return r;
}

/** Новый сотрудник: с этапом 61 — должность из списка (admin_create_employee_t), без него — как раньше */
export async function createEmployee({ token, name, surname, restaurant, title }) {
  const o = orgNow();
  if (o.stage) {
    const r = await rpc("admin_create_employee_t", { p_token: token, p_name: name, p_surname: surname, p_restaurant: restaurant, p_title: title });
    if (r && r.ok && r.job_title) loadOrg(true);
    return r;
  }
  return rpc("admin_create_employee", { p_token: token, p_name: name, p_surname: surname, p_restaurant: restaurant, p_position: BASES.includes(title) ? title : "waiter" });
}

export function _resetOrg() { _org = null; _at = 0; _loading = null; _demo = null; subs.clear(); }   // для проверок
