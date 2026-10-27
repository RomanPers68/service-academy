// lib/tg-login.js — v99 (Доп. 412): вход через Telegram без кода.
// Приложение открыто в Telegram: Telegram сам подписывает данные о том, кто открыл (initData), сервер проверяет подпись
// ключом бота (этап 39: tg_login) и узнаёт человека, если этот Telegram уже входил по коду (tg_auth_bind) или подключал
// напоминания. Новый телефон, Telegram на компьютере, очищенный кэш — код больше не нужен.
// Сам вышел («Выйти с этого устройства») — tg_auth_off: этот Telegram снова входит только по коду.
// Без Telegram (браузер) и без этапа 39 всё как раньше: вход по коду.
import { rpc, rpcMissing } from "../api/supabase";

/**
 * Подписанные данные Telegram о том, кто открыл приложение (пусто — не в Telegram). window.__saDemoTg — только демо и
 * проверки: «как будто открыли в Telegram»; подпись всё равно проверяет сервер.
 */
export function tgInitData() {
  try {
    if (typeof window === "undefined") return "";
    const tg = window.Telegram && window.Telegram.WebApp;
    const d = tg && tg.initData;
    if (d) return String(d);
    return window.__saDemoTg ? String(window.__saDemoTg) : "";
  } catch (e) { return ""; }
}

/** Telegram id того, кто открыл (для отметки «этот Telegram уже запомнен»), или "". */
export function tgUserId(init = tgInitData()) {
  try {
    const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
    const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (u && u.id != null) return String(u.id);
    const m = /(?:^|&)user=([^&]*)/.exec(String(init || ""));
    if (m) { const o = JSON.parse(decodeURIComponent(m[1])); if (o && o.id != null) return String(o.id); }
  } catch (e) { /* */ }
  return "";
}

const call = (fn, args) => Promise.resolve()
  .then(() => rpc(fn, args))
  .then((r) => (rpcMissing(r) ? { ok: false, error: "missing" } : r && typeof r === "object" ? r : { ok: false, error: "empty" }))
  .catch(() => ({ ok: false, error: "net" }));

// отметка «этот Telegram уже запомнен за этой сессией» — чтобы не звать сервер при каждом открытии
const BOUND = "sa_tg_bound";
const boundKey = (token, tgId) => tgId + "|" + String(token || "").slice(-12);
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* */ } };

/** Войти по Telegram: { ok, token, employee } или { ok: false, error: not_linked | disabled | no_bot | stale | bad_init | missing | net }. */
export function tgLogin(init = tgInitData(), { timeout = 6000 } = {}) {
  if (!init) return Promise.resolve({ ok: false, error: "no_tg" });
  return Promise.race([
    call("tg_login", { p_init_data: init }),
    new Promise((res) => setTimeout(() => res({ ok: false, error: "net" }), timeout)),
  ]).then((r) => {
    if (!(r && r.ok && r.token && r.employee && r.employee.id)) return { ok: false, error: (r && r.error) || "empty" };
    const tgId = tgUserId(init);
    if (tgId) lsSet(BOUND, boundKey(r.token, tgId));   // сервер уже запомнил этот Telegram
    return r;
  });
}

/** Запомнить этот Telegram за собой (после входа по коду и при открытии в Telegram). Один раз на сессию и Telegram. */
export function tgBind(token, { force = false, init = tgInitData() } = {}) {
  const tgId = tgUserId(init);
  if (!token || !init || !tgId) return Promise.resolve({ ok: false, error: "no_tg" });
  const k = boundKey(token, tgId);
  if (!force && lsGet(BOUND) === k) return Promise.resolve({ ok: true, again: true });
  return call("tg_auth_bind", { p_token: token, p_init_data: init }).then((r) => { if (r && r.ok) lsSet(BOUND, k); return r; });
}

/** Сам вышел: этот Telegram без кода больше не входит; на этом экране входа — без попытки (до перезапуска). */
export function tgOff(token, init = tgInitData()) {
  lsDel(BOUND);
  try { sessionStorage.setItem("sa_tg_skip", "1"); } catch (e) { /* */ }
  if (!token || !init) return Promise.resolve({ ok: false, error: "no_tg" });
  return call("tg_auth_off", { p_token: token, p_init_data: init });
}

/** Пробовать ли вход по Telegram на экране входа: в Telegram, не сразу после своего выхода, не по ссылке-приглашению. */
export function tgTryLogin({ init = tgInitData(), startParam = "" } = {}) {
  if (!init) return false;
  let skip = false;
  try { skip = sessionStorage.getItem("sa_tg_skip") === "1"; } catch (e) { skip = false; }
  return !skip && !String(startParam || "").trim();
}

/** Что сказать на экране входа после неудачной попытки (пусто — ничего). */
export function tgLoginNote(error) {
  if (error === "not_linked") return "Войди по коду один раз, дальше приложение будет узнавать тебя по Telegram.";
  if (error === "disabled") return "Доступ отключён. Обратись к руководителю.";
  return "";
}
