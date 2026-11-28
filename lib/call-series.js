// lib/call-series.js — v212 (Доп. 538): «Позвать» подряд и короче.
// Владелец: «Бывает такое, что приходит несколько столов подряд, и хостес должен всех оповестить, а приложение не дает
// это сделать сразу, просит подождать минуту. Да и сам путь, позвать к столу довольно длинный».
//   • тексты листа «Позвать» (ui/call-sheet.jsx): что уйдёт («Позвать Анну к столу 13»), чего не хватает, что ушло,
//     «уже позвали» (этап 68: тот же вызов за 30 секунд второй раз не уходит), ошибки сервера;
//   • кого показать кнопками под схемой: кто сегодня в смене, официанты первыми;
//   • что стало с листом после ответа сервера (afterCall): позвали — стол и человек сброшены, лист открыт дальше;
//   • кого и к какому столу звали с этого телефона за 10 минут — метки «позвали» на схеме;
//   • команда и схема зала из копии на телефоне: лист открывается сразу, свежие приходят следом.
// «.js» в путях — модуль читают и тесты в Node.
import { CALL_TTL_MIN, callWhoText, callWhyText, callProblem, bubbleName, accName } from "./chat.js";

const TABLE_RE = /^[0-9A-Za-zА-Яа-яЁё]{1,6}$/;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
// длинный свой текст на кнопке — по целому слову: «принеси детский стульчик к шестому…»
const clip = (s, n) => {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1), sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + "…";
};
const pl = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
const firstName = (s) => String(s || "").trim().split(/\s+/)[0] || "";
const andList = (xs) => (xs.length <= 2 ? xs.join(" и ") : xs.slice(0, -1).join(", ") + " и " + xs[xs.length - 1]);

/** Что уйдёт: «Позвать Анну к столу 13», «Позвать менеджера: нужна помощь»; verb «Позвали» — что ушло. */
export function callAction(call, verb = "Позвать") {
  const c = call || {};
  const who = callWhoText(c);
  if (c.why === "table") return verb + " " + who + " к столу " + String(c.table || "").trim();
  const why = c.why === "own" ? clip(c.text, 40) : callWhyText(c);
  return verb + " " + who + (why ? ": " + why : "");
}
/** Что ушло: «Позвали Анну к столу 13». */
export const sentLine = (call) => callAction(call, "Позвали");

/** Чего не хватает до вызова — подпись на кнопке вместо «Позвать…»; всё есть — "". plan — стол выбирают на схеме. */
export function callHint(call, plan = false) {
  const c = call || {}, p = callProblem(c);
  if (!p) return "";
  const noWho = p === "Выбери, кого позвать";
  const noTable = c.why === "table" && !TABLE_RE.test(String(c.table || "").trim());
  if (noWho && noTable) return plan ? "Выбери стол и кого позвать" : "Впиши стол и выбери, кого позвать";
  if (noTable) return plan ? "Выбери стол на схеме" : "Впиши номер стола";
  return p;
}

/** Тот же вызов уже ушёл (этап 68, already): «Анну к столу 13 уже позвали, ждём ответа»; ответили — «Анна уже идёт». */
export function againText(call, msg) {
  const c = call || {};
  const going = msg && msg.call && Array.isArray(msg.call.going) ? msg.call.going : [];
  const at = c.why === "table" && String(c.table || "").trim() ? " к столу " + String(c.table).trim() : "";
  if (going.length) {
    const names = going.map((g) => firstName(g && g.name)).filter(Boolean);
    return (names.length ? andList(names) : "Уже") + (names.length > 1 ? " уже идут" : " уже идёт") + at;
  }
  return cap(callWhoText(c)) + at + " уже позвали, ждём ответа";
}

const waitText = (s) => {
  const n = Math.max(1, Math.ceil(Number(s) || 0));
  if (n < 60) return n + " " + pl(n, "секунду", "секунды", "секунд");
  const m = Math.ceil(n / 60);
  return m + " " + pl(m, "минуту", "минуты", "минут");
};
/** Ошибка сервера словами. too_fast — сервер без этапа 68 (полминуты после любого вызова). */
export function callErrText(r) {
  const e = r && r.error;
  if (e === "too_many") return "Слишком много вызовов подряд. " + (Number(r.wait) > 0 ? "Следующий можно через " + waitText(r.wait) + "." : "Подожди пару минут.");
  if (e === "too_fast") return "Только что был вызов: подожди полминуты.";
  if (e === "net") return "Нет связи. Попробуй ещё раз.";
  return "Не отправилось. Проверь связь и попробуй ещё раз.";
}

/**
 * После ответа сервера. pick — что выбрано в листе: { who, person, tid, table, own }.
 * Позвали (ok) или уже звали (already): строка над кнопкой, стол и свой текст сброшены, человек — тоже (следующий стол
 * обычно другому), должность («Официанта») остаётся. Иначе — ошибка словами, выбор как был.
 */
export function afterCall(pick, call, r) {
  if (r && (r.ok || r.error === "already")) {
    const again = !r.ok;
    const next = { ...pick, tid: null, table: "", own: "" };
    if (pick && pick.who === "person") { next.who = ""; next.person = null; }
    return { done: true, again, line: again ? againText(call, r.msg) : sentLine(call), pick: next };
  }
  return { done: false, again: false, err: callErrText(r), pick };
}

// ── кнопки «Кого» под схемой ─────────────────────────────────────────────────────
const RANK = { waiter: 0, bartender: 2, senior_bartender: 2, hostess: 3, host: 3, manager: 4, senior: 4, service_manager: 4, owner: 5, admin: 5 };
/**
 * Кто сегодня в смене (chat_people: shift), кроме меня: официанты первыми, потом остальные, по имени. Графика на сегодня
 * нет (в смене никого) — все официанты. { list: [{ id, name, pos, label }], shift: в смене ли это }.
 * label — «Анна С.»; два одинаковых — полное имя.
 */
export function shiftChips(people, meId) {
  const all = (Array.isArray(people) ? people : []).filter((p) => p && p.id != null && String(p.id) !== String(meId));
  const on = all.filter((p) => p.shift);
  const base = on.length ? on : all.filter((p) => String(p.pos || "") === "waiter");
  const rank = (p) => (RANK[String(p.pos || "")] ?? 1);
  const list = [...base].sort((a, b) => rank(a) - rank(b) || String(a.name || "").localeCompare(String(b.name || ""), "ru"));
  const short = list.map((p) => bubbleName(p.name) || String(p.name || "").trim());
  return {
    shift: on.length > 0,
    list: list.map((p, i) => ({ id: String(p.id), name: String(p.name || "").trim(), pos: String(p.pos || ""),
      label: short.filter((s) => s === short[i]).length > 1 ? String(p.name || "").trim() : short[i] })),
  };
}

// ── хранилище на телефоне ───────────────────────────────────────────────────────
const store = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } };
const readJson = (k) => { try { const s = store(); const v = s && s.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
const writeJson = (k, v) => { try { const s = store(); if (s) s.setItem(k, JSON.stringify(v)); } catch (e) { /* место кончилось — без копии */ } };

// ── кого звали за 10 минут — метки на схеме ─────────────────────────────────────────
export const RECENT_KEY = "sa_call_recent";
const RECENT_MS = CALL_TTL_MIN * 60e3;   // столько вызов «живой» (без ответа он гаснет через 10 минут)
const fresh = (x, now) => x && now - Number(x.at) < RECENT_MS && now - Number(x.at) > -60e3;
/** Вызовы с этого телефона в этом заведении за 10 минут, по времени. */
export function recentCalls(rest, now = Date.now()) {
  const all = readJson(RECENT_KEY);
  return (Array.isArray(all) ? all : []).filter((x) => fresh(x, now) && x.rest === rest).sort((a, b) => a.at - b.at);
}
/** Запомнить вызов: { key, tid, table, who, emp, toName, why, text }. Старое (больше 10 минут) уходит, хранится до 30. */
export function rememberCall(rest, entry, now = Date.now()) {
  const e = { ...entry, rest, at: now };
  const all = (readJson(RECENT_KEY) || []).filter((x) => fresh(x, now) && !(x.rest === rest && x.key === e.key));
  writeJson(RECENT_KEY, [...all, e].slice(-30));
  return e;
}
// v215 (Доп. 541): колокольчик говорит, что с вызовом. Ждём ответа — золотой и покачивается; нажали «Иду» — зелёный с
// галочкой; две минуты без ответа — красный: хостес видит, что официант молчит, и сама решает, передать ли стол
// дальше (владелец: «Давай не будем делать переход через 2 мин автоматически»). Что с вызовом — с сервера
// (chat_call_state, этап 69) по id сообщения; пока ответа нет — «ждём».
export const LATE_MS = 2 * 60e3;
/** Ответ chat_call_state → { [id вызова]: { st, msg, who, emp, name, by, at, going_at, hops } }. */
export function callStates(r) {
  const out = {};
  for (const x of (r && r.ok && Array.isArray(r.list) ? r.list : [])) if (x && x.id != null) out[String(x.id)] = x;
  return out;
}
const first1 = (s) => String(s || "").trim().split(/\s+/)[0] || "";
/** Метка одного вызова: { st: wait | late | going, label, at, msg, who, emp, name }; вызов погас — null. */
export function markOf(r, s, now = Date.now()) {
  if (s && s.st === "gone") return null;
  const who = s && s.who ? s.who : r.who, name = s && s.name ? s.name : r.toName || "";
  const callAt = (s && Date.parse(s.at)) || Number(r.at) || now;
  const base = { msg: (s && s.msg) || r.msg || null, who, emp: s && s.emp ? String(s.emp) : r.emp ? String(r.emp) : null, name, hops: (s && s.hops) || 0 };
  if (s && s.st === "going") return { ...base, st: "going", label: (first1(s.by) || first1(name) || "Официант") + " идёт", at: Date.parse(s.going_at) || callAt };
  // «На месте»: официант подошёл, не нажав «Иду», хостес отметила сама
  if (s && s.st === "done") return { ...base, st: "done", label: (who === "person" ? first1(name) || "Официант" : "Официант") + " на месте", at: Date.parse(s.going_at) || callAt };
  if (now - callAt >= LATE_MS) return { ...base, st: "late", label: who === "person" ? (first1(name) || "Официант") + " не отвечает" : "Никто не ответил", at: callAt };
  const whom = s && s.hops ? accName(first1(name)) || "следующего" : callWhoText(r);
  return { ...base, st: "wait", label: "позвали " + whom + ", ждём", at: callAt };
}
/** Метки на схеме: { [id стола]: метка }; к одному столу звали дважды — последний. states — callStates(…). */
export function tableMarks(recent, plan, states = {}, now = Date.now()) {
  const tables = plan && Array.isArray(plan.tables) ? plan.tables : [];
  const out = {};
  for (const r of recent || []) {
    if (!r || r.why !== "table") continue;
    const t = (r.tid && tables.find((q) => q.id === r.tid)) || tables.find((q) => String(q.n) === String(r.table || "").trim());
    if (!t) continue;
    const m = markOf(r, r.msg != null ? (states || {})[String(r.msg)] : null, now);
    if (m) out[t.id] = m; else delete out[t.id];
  }
  return out;
}
/** Под схемой, когда выбран такой стол: «позвали Анну, ждём · 1 мин», «Анна идёт · 2 мин назад», «Анна не отвечает 3 мин». */
export function markLine(mark, now = Date.now()) {
  if (!mark) return "";
  const min = Math.max(0, Math.floor((now - mark.at) / 60000));
  if (mark.st === "late") return mark.label + " " + min + " мин";
  if (mark.st === "going" || mark.st === "done") return mark.label + (min < 1 ? ", только что" : " · " + min + " мин назад");
  return mark.label + (min < 1 ? "" : " · " + min + " мин");
}
/** Id вызовов, по которым спросить сервер: моложе 10 минут, с id сообщения. */
export const markIds = (recent) => [...new Set((recent || []).filter((r) => r && r.why === "table" && r.msg != null).map((r) => Number(r.msg)).filter((x) => x > 0))];

// ── команда и схема зала: копия на телефоне ───────────────────────────────────────
export const CACHE_KEY = "sa_call_cache";
const cache = () => { const c = readJson(CACHE_KEY); return c && typeof c === "object" && !Array.isArray(c) ? c : {}; };
const keep = (rest, k, v) => {
  if (!rest) return;
  const all = cache();
  all[rest] = { ...(all[rest] || {}), [k]: v, [k + "At"]: Date.now() };
  writeJson(CACHE_KEY, all);
};
const hasTables = (b) => !!(b && b.ok && b.plan && Array.isArray(b.plan.tables) && b.plan.tables.length);
// для листа нужна только схема и что за столами: без фото плана и служебного
const slim = (b) => ({ ok: true, plan: { v: b.plan.v, zones: b.plan.zones || [], items: b.plan.items || [], tables: b.plan.tables },
  tables: Array.isArray(b.tables) ? b.tables : [], now: b.now || null });
/** Команда из копии (chat_people) или null. */
export function cachedTeam(rest) { const c = cache()[rest]; return c && Array.isArray(c.team) ? c.team : null; }
/** Схема из копии (seat_board, только со столами) или null. */
export function cachedBoard(rest) { const c = cache()[rest]; return c && hasTables(c.board) ? c.board : null; }
/** Сколько миллисекунд копии: команды (k = "team") или схемы ("board"); копии нет — Infinity. */
export function cacheAge(rest, k, now = Date.now()) { const c = cache()[rest]; const at = c && Number(c[k + "At"]); return at ? now - at : Infinity; }
export const keepTeam = (rest, list) => { if (Array.isArray(list)) keep(rest, "team", list); };
/** Схему со столами — в копию; доска без столов (схемы нет) — копия схемы стирается. */
export function keepBoard(rest, board) {
  if (!rest || !board || board.ok !== true) return;
  if (hasTables(board)) keep(rest, "board", slim(board));
  else { const all = cache(); if (all[rest] && all[rest].board) { delete all[rest].board; delete all[rest].boardAt; writeJson(CACHE_KEY, all); } }
}
/** Свежая команда: список или null (не пришла — остаётся копия). */
export function freshTeam(api, rest) {
  if (!api || !api.people) return Promise.resolve(null);
  return Promise.resolve().then(() => api.people()).then((r) => {
    if (r && r.ok && Array.isArray(r.people)) { keepTeam(rest, r.people); return r.people; }
    return null;
  }).catch(() => null);
}
/** Свежая схема: доска; false — схемы нет (или нет этапа 35) и копия стёрта; null — не пришла, остаётся копия. */
export function freshBoard(api, rest) {
  if (!api || !api.board) return Promise.resolve(null);
  return Promise.resolve().then(() => api.board()).then((r) => {
    if (r && r.ok) { keepBoard(rest, r); return hasTables(r) ? slim(r) : false; }
    if (r && r.error === "missing") { keepBoard(rest, { ok: true }); return false; }
    return null;
  }).catch(() => null);
}
/** Хостес на «Смене» и на главной: команда в копию заранее, не чаще раза в 5 минут. */
export function prefetchTeam(api, rest) {
  if (!rest || cacheAge(rest, "team") < 5 * 60e3) return Promise.resolve(cachedTeam(rest));
  return freshTeam(api, rest);
}
/** Выход из приложения: копии и метки прошлого человека с телефона уходят. */
export function forgetCalls() {
  try { const s = store(); if (s) { s.removeItem(CACHE_KEY); s.removeItem(RECENT_KEY); } } catch (e) { /* */ }
}
