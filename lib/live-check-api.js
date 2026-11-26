// lib/live-check-api.js — v200 (Доп. 525): запросы живой проверки (этап 63) и отметки «старше менеджера» у должностей.
// v201 (Доп. 526): сохранение по пунктам и блиц (этап 64), очередь без сети, сводка, график на сегодня.
// v202 (Доп. 527): вопрос на брифинге, меню и свои вопросы, просьбы о проверке, отметки, правки вопросов, план (этап 65).
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

// ключи этапа 64 — только «модуль#номер»; вопросы о блюдах («menu#…») и свои («s0#c3») — с этапа 65
const numKey = (k) => /^[a-z0-9_-]{1,40}#[0-9]{1,3}$/.test(String(k || ""));
/** Вопрос на брифинге на сервере без этапа 65: блицем «Брифинг» (только вопросы по урокам); нечего — error stage65 */
const briefAsBlitz = (params) => {
  const it = (params.p_items || []).filter((x) => numKey(x.k));
  return it.length ? { ...params, p_kind: "blitz", p_module: "blitz", p_items: it, p_marks: marksOfItems(it), p_title: "Брифинг" } : null;
};

/** Сохранить по пунктам: items [{ k, g, o }], kind module | blitz | brief. Нет связи — проверка ждёт на телефоне (queued);
 *  сервер без этапа 64 — проверка модуля уходит прежним вызовом (отметки 0/1/2), блиц — error stage64; без этапа 65 —
 *  брифинг блицем «Брифинг», вопросы о блюдах и свои — error stage65 */
export async function lcSave({ emp, track, module, items, note = "", kind = "module", cid = newCid(), title = "", repeat = [] }) {
  const params = { p_emp: emp, p_track: track, p_module: module, p_items: items, p_note: note || null, p_kind: kind, p_cid: cid,
    p_title: title || null, p_repeat: repeat && repeat.length ? repeat : null, p_marks: marksOfItems(items) };
  const r = await call("live_check_save", params);
  if (r && r.ok) return r;
  if (r && r.error === "bad_request" && kind === "brief") {
    const p2 = briefAsBlitz(params);
    if (!p2) return { ok: false, error: "stage65" };
    const r2 = await call("live_check_save", p2);
    return r2 && r2.error === "stage" ? { ok: false, error: "stage64" } : r2 && r2.ok ? { ...r2, asBlitz: true } : r2;
  }
  if (r && r.error === "bad_request" && (items || []).some((x) => !numKey(x.k))) return { ok: false, error: "stage65" };
  if (r && r.error === "stage") {
    if (kind !== "module") return { ok: false, error: "stage64" };
    if ((items || []).some((x) => !numKey(x.k))) return { ok: false, error: "stage65" };
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
    } else if (r.error === "bad_request" && x.p.p_kind === "brief" && briefAsBlitz(x.p)) {   // v202: брифинг на сервере без этапа 65
      try { r = await rpc("live_check_save", { p_token: x.tok || saToken(), ...briefAsBlitz(x.p) }); } catch (e) { r = null; }
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

// ── v202 (Доп. 527): этап 65 ─────────────────────────────────────────────────────────────────────────────────────────
const call65 = async (fn, params) => { const r = await call(fn, params); return r && r.error === "stage" ? { ok: false, error: "stage65" } : r; };
/** Просьбы о проверке: мои и тех, кого я проверяю (у сети — в выбранном заведении); норма плана */
export const lcRequests = (venue = null) => call65("live_check_requests", { p_restaurant: venue || null });
/** Позвать на проверку модуля («Готов к живой проверке», после незачёта — к пересдаче) или отменить просьбу */
export const lcRequest = ({ track, module, title = "", cancel = false }) =>
  call65("live_check_request", { p_track: track, p_module: module, p_title: title || null, p_cancel: !!cancel });
/** Отметить неудачный вопрос (видит руководство в «Вопросах живой проверки») */
export const lcFlag = ({ track, module, key, note = "" }) => call65("live_check_flag", { p_track: track, p_module: module, p_key: key, p_note: note || null });
/** Оставить отмеченный вопрос как есть */
export const lcFlagDone = (key) => call65("live_check_flag_done", { p_key: key });
/** Норма плана: каждого раз в N дней (14, 30, 60, 90) */
export const lcPlanSet = (days) => call65("live_check_plan_set", { p_days: days });
/** Правка вопроса: n — номер вопроса из приложения или «c12» (свой), пусто — новый свой; hidden — спрятать */
export async function lcQuestionSave({ track, module, n = null, q = null, a = null, lesson = null, hidden = false }) {
  const r = await call65("live_check_question_save", { p_track: track, p_module: module, p_n: n == null || n === "" ? null : String(n), p_q: q || null,
    p_a: Array.isArray(a) && a.length ? a : null, p_lesson: lesson || null, p_hidden: !!hidden });
  if (r && r.ok) loadQuestions(true);
  return r;
}

// Правки вопросов: с сервера при первом запросе за сессию, копия на телефоне — чтобы вопросы были те же и без сети
export const LCQ_KEY = "sa_lcq_v1";
const qRead = () => { try { const v = JSON.parse(localStorage.getItem(LCQ_KEY) || "null"); return v && Array.isArray(v.rows) ? v : null; } catch (e) { return null; } };
let _q = { rows: (qRead() || {}).rows || [], flags: [], canEdit: false, stage: null, loaded: false };
const qSubs = new Set();
const setQ = (v) => { _q = v; qSubs.forEach((f) => { try { f(v); } catch (e) {} }); };
let _qWait = null;
/** Правки вопросов и отметки (тем, кто правит). force — заново с сервера */
export function loadQuestions(force = false) {
  if (_qWait && !force) return _qWait;
  if (_q.loaded && !force) return Promise.resolve(_q);
  _qWait = call65("live_check_questions", {}).then((r) => {
    _qWait = null;
    if (r && r.ok) {
      const rows = Array.isArray(r.rows) ? r.rows : [];
      try { localStorage.setItem(LCQ_KEY, JSON.stringify({ at: Date.now(), rows })); } catch (e) {}
      setQ({ rows, flags: Array.isArray(r.flags) ? r.flags : [], canEdit: !!r.can_edit, stage: true, loaded: true });
    } else setQ({ ..._q, stage: r && r.error === "stage65" ? false : _q.stage, loaded: true });   // пробовали: правки — из копии на телефоне
    return _q;
  });
  return _qWait;
}
export function useLcQuestions() {
  const [v, set] = React.useState(_q);
  React.useEffect(() => { qSubs.add(set); set(_q); loadQuestions(); return () => { qSubs.delete(set); }; }, []);
  return v;
}
export function _resetQuestions() { _q = { rows: [], flags: [], canEdit: false, stage: null, loaded: false }; _qWait = null; qSubs.clear(); }   // для проверок

/** Свои живые проверки — на телефоне, для «Пути мастера» и допуска к залу без сети: { at, passed: [модули], checks } */
export const LC_MINE_KEY = "sa_lc_mine";
export function saveMine(uk, checks) {
  try {
    const list = (Array.isArray(checks) ? checks : []).slice(0, 80);
    const last = {};
    for (const c of list) if (c && c.m && c.k !== "blitz" && c.k !== "brief" && c.m !== "blitz" && c.m !== "brief" && (!last[c.m] || String(c.at || "") > String(last[c.m].at || ""))) last[c.m] = c;
    localStorage.setItem(LC_MINE_KEY + (uk || ""), JSON.stringify({ at: Date.now(), passed: Object.keys(last).filter((m) => last[m].p).sort(), checks: list }));
  } catch (e) {}
}
export function readMine(uk, storage) {
  try { const st = storage || localStorage; const v = JSON.parse(st.getItem(LC_MINE_KEY + (uk || "")) || "null"); return v && typeof v === "object" ? v : null; } catch (e) { return null; }
}

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

/** «Повтори вслух» (v202): какие вопросы живой проверки человек уже повторил после проверки — { ключ: когда (ISO) } */
export const LC_PRACTICE_KEY = "sa_lc_practice";
export function practiceDone(uk) {
  try { const v = JSON.parse(localStorage.getItem(LC_PRACTICE_KEY + (uk || "")) || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
export function practiceMark(uk, key, at = new Date().toISOString()) {
  const v = { ...practiceDone(uk), [key]: at };
  const keys = Object.keys(v).sort((a, b) => String(v[b]).localeCompare(String(v[a]))).slice(0, 200);   // не копить бесконечно
  try { localStorage.setItem(LC_PRACTICE_KEY + (uk || ""), JSON.stringify(Object.fromEntries(keys.map((k) => [k, v[k]])))); } catch (e) {}
  return v;
}
