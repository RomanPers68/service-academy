// lib/org.js — v198 (Доп. 523): заведения и должности в приложении — общие списки с сервера (этап 61), а не из кода.
// Здесь — кэш на телефоне и запрос: списки встают сразу, сервер подтверждает фоном. Пока этапа 61 нет — запасной список
// (пять заведений и шесть должностей, как до v198). Разбор, выбор и подписи — lib/org-model.js.
// Вход «Демо» (токен demo, сервера нет): правки живут в памяти по тем же правилам, что у этапа 61.
// v199 (Доп. 524): взгляд руководства сети — какое заведение сейчас на экранах статистики (useLens, viewRpc).
import React from "react";
import { rpc, rpcMissing, saToken } from "../api/supabase";
import { normOrg, orgFallback, orgSeed, venueOp, positionOp, BASES, LENS_ALL, isNetwork, lensOf, cleanName, venuesWithMine } from "./org-model";

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

// ── v199 (Доп. 524): взгляд сети ────────────────────────────────────────────────────────────────────────────────────
// Сеть выбирает заведение на экране статистики, и выбор общий: выбрал «Порт» в аналитике — «Что дало обучение»,
// новички, кандидаты и график тоже открываются по «Порту». Живёт до закрытия приложения (sessionStorage): утром всё
// снова по своему заведению. Остальным выбора нет — своё заведение всегда.
export const LENS_KEY = "sa_lens_venue";
let _lens, lensSubs = new Set();
const readLens = () => { try { return sessionStorage.getItem(LENS_KEY) || null; } catch (e) { return null; } };
const lensRaw = () => (_lens === undefined ? (_lens = readLens()) : _lens);
/** Выбрать заведение (или LENS_ALL — «Вся сеть») для всех экранов статистики */
export function setLens(v) {
  _lens = v || null;
  try { if (_lens) sessionStorage.setItem(LENS_KEY, _lens); else sessionStorage.removeItem(LENS_KEY); } catch (e) {}
  lensSubs.forEach((f) => { try { f(_lens); } catch (e) {} });
}
/** Взгляд для экрана: { venue, all, own, mine, network, venues, withAll, pick }. all — есть ли «Вся сеть» */
export function lensFor(profile, org, raw, { all = false } = {}) {
  const network = isNetwork(profile);
  const own = cleanName(profile && profile.restaurant);
  const venues = network ? venuesWithMine(org, own) : [];
  const venue = lensOf(raw, { network, own, venues, all });
  return { venue, all: venue === LENS_ALL, own, mine: !network || venue === own, network, venues, withAll: !!all && network, pick: setLens };
}
export function useLens(profile, opt = {}) {
  const org = useOrg();
  const [raw, set] = React.useState(lensRaw);
  React.useEffect(() => { lensSubs.add(set); set(lensRaw()); return () => { lensSubs.delete(set); }; }, []);
  const network = isNetwork(profile);
  React.useEffect(() => { if (network) loadOrg(); }, [network]);
  return lensFor(profile, org, raw, opt);
}
/** Запрос так, как его видит руководитель заведения: своё — напрямую; чужое у сети — через org_view (этап 62).
 *  Ответы: как у самой функции; { ok: false, error: "stage62" } — этапа 62 нет; функции нет — как rpcMissing. */
export async function viewRpc(fn, args, lens) {
  const token = saToken();
  if (!lens || !lens.network || lens.mine || lens.all || !lens.venue || isDemoToken(token)) return rpc(fn, { p_token: token, ...(args || {}) });
  const { p_restaurant, ...rest } = args || {};   // заведение задаёт взгляд, а не экран
  let r;
  try { r = await rpc("org_view", { p_token: token, p_restaurant: lens.venue, p_fn: fn, p_args: rest }); } catch (e) { return { ok: false, error: "net" }; }
  if (rpcMissing(r)) return { ok: false, error: "stage62" };
  if (r && r.ok === false && r.error === "no_stage") return { code: "PGRST202", message: "no_stage" };   // нет самой функции — как без взгляда
  return r;
}

export function _resetOrg() { _org = null; _at = 0; _loading = null; _demo = null; subs.clear(); _lens = undefined; lensSubs = new Set(); }   // для проверок
