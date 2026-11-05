// lib/push.js — v137 (Доп. 450): уведомления на телефон (Web Push), как у приложений.
//
// Владелец (04.11): у «Плати по миру» ссылка на экране «Домой» присылает уведомления — «можно ли это реализовать в
// приложении?» Можно: сервис-воркер (public/sw.js) показывает уведомление, сервер (этап 48) отправляет его через функцию
// push-send. Здесь — где мы (iPhone только с экрана «Домой» и iOS 16.4+, в Telegram нет), включить и выключить на этом
// телефоне, проверить, куда присылать, число на иконке, тихое переподключение и экран, который открыть по касанию.
//
// Для демо и проверок: window.__saPushShim = { env?, reg: { pushManager: { getSubscription, subscribe } }, permission? }.
import { rpc, saToken, rpcMissing, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";

export const PUSH_FLAG = "sa_push_on";   // + uk: включал на этом телефоне («1»)
export const PUSH_EVENT = "sa-push-change";
export const CHANNELS = [["both", "Telegram и телефон"], ["push", "Только телефон"], ["tg", "Только Telegram"]];

const shim = (w) => { try { return (w || window).__saPushShim || null; } catch (e) { return null; } };
export const readPushFlag = (uk) => { try { return localStorage.getItem(PUSH_FLAG + (uk || "")) === "1"; } catch (e) { return false; } };
export function savePushFlag(uk, on) {
  try { localStorage.setItem(PUSH_FLAG + (uk || ""), on ? "1" : "0"); } catch (e) { /* приватный режим */ }
  try { window.dispatchEvent(new CustomEvent(PUSH_EVENT, { detail: { on: !!on } })); } catch (e) { /* */ }
}

/** Версия iOS из строки браузера: [16, 4] или null (не iPhone и не iPad). iPad с iPadOS 13+ — «Macintosh» и касания. */
export function iosVersion(ua, touch = 0) {
  const s = String(ua || "");
  const m = s.match(/(?:iPhone|iPad|iPod)[^)]*? OS (\d+)[_.](\d+)/) || (/Macintosh/.test(s) && touch > 1 ? s.match(/Version\/(\d+)\.(\d+)/) : null);
  if (m) return [Number(m[1]), Number(m[2])];
  return /iPhone|iPad|iPod/.test(s) || (/Macintosh/.test(s) && touch > 1) ? [0, 0] : null;
}

/**
 * Где мы: ok — можно включить; granted — уже разрешено (Notification.permission === "granted"); telegram — внутри Telegram
 * (уведомления присылает бот); ios-browser — iPhone, но не с экрана «Домой»; ios-old — iOS старше 16.4; no — браузер
 * не умеет; denied — запрещено в настройках телефона.
 */
export function pushEnv(w) {
  const win = w || (typeof window !== "undefined" ? window : null);
  if (!win) return "no";
  const sh = shim(win);
  if (sh && sh.env) return sh.env;
  try { if (win.Telegram && win.Telegram.WebApp && win.Telegram.WebApp.initData) return "telegram"; } catch (e) { /* */ }
  const nav = win.navigator || {};
  const ios = iosVersion(nav.userAgent, nav.maxTouchPoints || 0);
  let standalone = nav.standalone === true;
  try { standalone = standalone || !!(win.matchMedia && win.matchMedia("(display-mode: standalone)").matches); } catch (e) { /* */ }
  const api = !!sh || (!!nav.serviceWorker && "PushManager" in win && "Notification" in win);
  if (ios) {
    if (ios[0] && (ios[0] < 16 || (ios[0] === 16 && ios[1] < 4))) return "ios-old";
    if (!standalone) return "ios-browser";
  }
  if (!api) return "no";
  const perm = sh ? sh.permission || "default" : (() => { try { return win.Notification.permission; } catch (e) { return "default"; } })();
  if (perm === "denied") return "denied";
  return perm === "granted" ? "granted" : "ok";
}
export const pushCan = (env) => env === "ok" || env === "granted";

/** Что сказать человеку, если включить нельзя (env не ok/on). */
export function pushEnvNote(env) {
  if (env === "telegram") return "Здесь сообщения присылает бот Telegram. Чтобы уведомления приходили как у приложения, открой академию в Safari или Chrome, добавь на экран «Домой» и включи их там.";
  if (env === "ios-browser") return "На iPhone уведомления приходят, когда академия открыта с экрана «Домой». Как её туда добавить:";
  if (env === "ios-old") return "На iPhone уведомления работают с iOS 16.4. Обнови iOS в настройках, и кнопка появится здесь.";
  if (env === "denied") return "Уведомления запрещены в настройках телефона. iPhone: Настройки, Уведомления, Service Academy. Android: долгое нажатие на значок, «О приложении», «Уведомления».";
  if (env === "no") return "Этот браузер не умеет уведомления. На iPhone открой академию в Safari и добавь на экран «Домой», на Android подойдёт Chrome.";
  return "";
}

// ── ключ сервера (VAPID) ──
export function urlB64ToBytes(s) {
  const t = String(s || "").replace(/-/g, "+").replace(/_/g, "/").replace(/[\s=]+/g, "");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesToUrlB64(buf) {
  if (!buf) return "";
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const fnUrl = () => String(SUPABASE_URL || "").replace(/\/+$/, "") + "/functions/v1/push-send";
const keyHeaders = () => (/^eyJ/.test(SUPABASE_KEY || "") ? { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } : SUPABASE_KEY ? { apikey: SUPABASE_KEY } : {});

/** Ключ от функции push-send (создаёт, если его ещё нет): { ok, key } или { ok: false, error: no_fn | jwt | no_stage | keys | net }. */
export async function fetchPushKey(fetcher) {
  const f = fetcher || (typeof fetch !== "undefined" ? fetch : null);
  if (!f) return { ok: false, error: "net" };
  try {
    const r = await f(fnUrl() + "?init=1", { headers: keyHeaders() });
    if (r.status === 404) return { ok: false, error: "no_fn" };
    if (r.status === 401 || r.status === 403) return { ok: false, error: "jwt" };
    const j = await r.json().catch(() => null);
    if (j && j.ok && j.key) return { ok: true, key: String(j.key) };
    return { ok: false, error: (j && j.error) || "keys" };
  } catch (e) { return { ok: false, error: "net" }; }
}

// ── сервис-воркер и подписка ──
export async function pushReg(ms = 8000) {
  const sh = shim();
  if (sh) return sh.reg || null;
  try {
    const sw = navigator.serviceWorker;
    if (!sw) return null;
    let reg = await sw.getRegistration().catch(() => null);
    if (!reg) reg = await sw.register("/sw.js").catch(() => null);
    if (!reg) return null;
    if (reg.active) return reg;
    return await Promise.race([sw.ready, new Promise((res) => setTimeout(() => res(null), ms))]);
  } catch (e) { return null; }
}
export async function currentSub(reg) {
  try { return reg && reg.pushManager ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; }
}
const sameKey = (sub, key) => {
  try {
    const k = sub && sub.options && sub.options.applicationServerKey;
    return !k || bytesToUrlB64(k) === String(key || "").replace(/=+$/, "");
  } catch (e) { return true; }
};
const subJson = (sub) => { try { return typeof sub.toJSON === "function" ? sub.toJSON() : sub; } catch (e) { return sub; } };
const shortUa = () => { try { return String(navigator.userAgent || "").slice(0, 200); } catch (e) { return ""; } };

/** Состояние с сервера (этап 48). admin — ещё адрес Supabase и ключ anon (туда база зовёт push-send). */
export async function pushStatus({ endpoint = null, admin = false } = {}) {
  const r = await rpc("push_status", { p_token: saToken(), p_endpoint: endpoint, p_url: admin ? SUPABASE_URL : null, p_key: admin && /^eyJ/.test(SUPABASE_KEY || "") ? SUPABASE_KEY : null }).catch(() => null);
  if (rpcMissing(r)) return { ok: false, error: "missing" };
  if (!r) return { ok: false, error: "net" };
  return r;
}

/**
 * Включить на этом телефоне. Звать прямо из нажатия: на iPhone разрешение спрашивается только в ответ на касание,
 * поэтому сервис-воркер (reg) и ключ (key) готовят заранее — первым делом здесь идёт subscribe().
 * → состояние сервера или { ok: false, error: denied | no_sw | no_key | sub | auth | net | … }.
 */
export async function pushSubscribe({ reg, key, uk = "", old = null }) {
  if (!reg || !reg.pushManager) return { ok: false, error: "no_sw" };
  if (!key) return { ok: false, error: "no_key" };
  let sub = null;
  try {
    // old — подписка, найденная заранее: с другим ключом её сначала снимаем (ключ сервера сменился)
    if (old && !sameKey(old, key)) { try { await old.unsubscribe(); } catch (e) { /* */ } }
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(key) });
  } catch (e) {
    let perm = "default";
    try { perm = shim() ? shim().permission || "default" : Notification.permission; } catch (x) { /* */ }
    return { ok: false, error: perm === "denied" || (e && e.name === "NotAllowedError") ? "denied" : "sub" };
  }
  if (!sub) return { ok: false, error: "sub" };
  const r = await rpc("push_subscribe", { p_token: saToken(), p_sub: subJson(sub), p_ua: shortUa() }).catch(() => null);
  if (rpcMissing(r)) return { ok: false, error: "missing" };
  if (!r) return { ok: false, error: "net" };
  if (r.ok) savePushFlag(uk, true);
  return r;
}

/** Выключить на этом телефоне (и при выходе из аккаунта). */
export async function pushUnsubscribe({ reg = null, uk = "", token = null } = {}) {
  const rg = reg || await pushReg(3000);
  const sub = await currentSub(rg);
  let r = null;
  if (sub && sub.endpoint) r = await rpc("push_unsubscribe", { p_token: token || saToken(), p_endpoint: sub.endpoint }).catch(() => null);
  try { if (sub) await sub.unsubscribe(); } catch (e) { /* */ }
  savePushFlag(uk, false);
  return r && r.ok ? r : { ok: !!(r && r.ok) || !sub, n: r && r.n };
}

export async function pushChannel(ch) {
  const r = await rpc("push_channel", { p_token: saToken(), p_channel: ch }).catch(() => null);
  return r || { ok: false, error: "net" };
}
export async function pushTest() {
  const r = await rpc("push_test", { p_token: saToken() }).catch(() => null);
  return r || { ok: false, error: "net" };
}
export function pushError(e, admin = false) {
  if (e === "denied") return pushEnvNote("denied");
  if (e === "no_fn" || e === "jwt" || e === "keys" || e === "no_stage" || e === "no_key") return admin
    ? "Сервер уведомлений ещё не готов: «Команда», «Сервер», раздел «Уведомления на телефон»."
    : "Сервер уведомлений ещё не готов. Скажи руководителю.";
  if (e === "no_url") return admin ? "Открой «Команда», «Сервер»: экран запишет адрес сервера, и уведомления пойдут." : "Сервер уведомлений ещё не готов. Скажи руководителю.";
  if (e === "often") return "Пробное уже ушло. Следующее можно через 15 секунд.";
  if (e === "no_subs") return "На этом телефоне уведомления выключены.";
  if (e === "auth") return "Сессия устарела. Перезайди по коду.";
  if (e === "missing") return "Уведомления на телефон появятся, когда руководитель обновит сервер.";
  if (e === "no_sw") return "Телефон не дал включить уведомления. Закрой академию и открой заново с экрана «Домой».";
  if (e === "net") return "Нет связи. Попробуй ещё раз.";
  return "Не получилось включить. Попробуй ещё раз.";
}

/**
 * При запуске: на этом телефоне уведомления включали, разрешение есть, а сервер подписку не знает (Apple сменил адрес,
 * другой вошёл и вышел) — тихо отдаём её снова. → "ok" | "skip" | "gone".
 */
export async function pushRefresh(uk) {
  if (!readPushFlag(uk) || pushEnv() !== "granted") return "skip";
  const reg = await pushReg(5000);
  let sub = await currentSub(reg);
  if (!sub) {
    const st = await pushStatus();
    if (!st || !st.ok || !st.key || !reg) return "skip";
    try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(st.key) }); } catch (e) { sub = null; }
    if (!sub) { savePushFlag(uk, false); return "gone"; }
  }
  const st = await pushStatus({ endpoint: sub.endpoint });
  if (!st || !st.ok || st.here) return "skip";
  const r = await rpc("push_subscribe", { p_token: saToken(), p_sub: subJson(sub), p_ua: shortUa() }).catch(() => null);
  return r && r.ok ? "ok" : "skip";
}

/** Число на иконке приложения (экран «Домой»): непрочитанное в чатах. */
export function setAppBadge(n) {
  try {
    const nav = navigator;
    if (!nav || typeof nav.setAppBadge !== "function") return false;
    if (n > 0) nav.setAppBadge(Math.min(Number(n) || 0, 9999)).catch(() => {});
    else if (typeof nav.clearAppBadge === "function") nav.clearAppBadge().catch(() => {});
    return true;
  } catch (e) { return false; }
}

/** Строка в «Смене» и в «Я»: что включено. */
export function remindSub({ push = false, tg = false } = {}) {
  if (push && tg) return "На телефон и в Telegram: разминка, чат, вопрос дня";
  if (push) return "На телефон: разминка, чат, вопрос дня";
  if (tg) return "Включено: за час до смены зовёт на разминку";
  return "Разминка за час до смены, чат, вопрос дня";
}
export function pushRowSub(env, on) {
  if (on) return "Включены на этом телефоне";
  if (env === "telegram" || env === "ios-browser") return "Как у приложения: с экрана «Домой»";
  if (env === "denied") return "Запрещены в настройках телефона";
  if (env === "no" || env === "ios-old") return "Этот телефон или браузер не умеет";
  return "Чат, смены и вопрос дня на экране блокировки";
}

/** Сервер для экрана «Сервер»: функция push-send на месте? → { fn: ok | no_fn | jwt | no_stage | keys | net }. */
export async function pushServerCheck(fetcher) {
  const k = await fetchPushKey(fetcher);
  return { fn: k.ok ? "ok" : k.error, key: k.ok ? k.key : "" };
}
