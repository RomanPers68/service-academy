// lib/call-queue.js — v213 (Доп. 539): очередь официантов к столам и «Занят, передать дальше».
// Владелец: «Столы у нас не закрепляются за официантом, так как работает система очередности» и «Бывает такое, что
// официант чуть дольше принимает заказ, так как гость задает много вопросов. В общем, нужно что-то добавить в виде
// передачи стола дальше по очереди».
//   • очередь с сервера (queue_get, этап 69): list — по порядку { id, name, away, out } (away — на перерыве, out — убран
//     на сегодня), others — официанты, которых в ней нет, edit — можно ли менять (руководитель, старший, хостес);
//   • следующий — первый не на перерыве, не убранный и не пропущенный хостес в этот раз;
//   • правки хостес — новый порядок для queue_set: выше и ниже, на перерыв и обратно, убрать, вернуть, добавить;
//   • позвали к столу — на телефоне сразу в конец (сервер делает так же), не дожидаясь ответа;
//   • вызов передали дальше: кто, кому; можно ли мне передать этот вызов; ошибки словами.
// v215 (Доп. 541): очередь составляет хостес или руководитель по приходу («она составляется в том порядке, в какое
//   время сотрудник зашел на работу»), сама утром не собирается. others — сначала сегодняшние по графику, по началу
//   смены (from); «Все по графику» ставит их разом в этом порядке. Позвали к столу или посадили гостей — в конец
//   уходит только тот, кто в очереди: дописывает хостес.
// «.js» в путях — модуль читают и тесты в Node.
import { accName, bubbleName } from "./chat.js";

const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";
const ent = (x) => ({ id: String(x.id), name: String(x.name || "").trim(), away: !!x.away, out: !!x.out });

/** Ответ queue_get или queue_set → { list, others, edit, day }; не очередь — null. */
export function queueOf(r) {
  if (!r || r.ok !== true || !Array.isArray(r.list)) return null;
  const seen = new Set(), list = [];
  for (const x of r.list) if (x && x.id != null && !seen.has(String(x.id))) { seen.add(String(x.id)); list.push(ent(x)); }
  const others = (Array.isArray(r.others) ? r.others : []).filter((x) => x && x.id != null && !seen.has(String(x.id)))
    .map((x) => ({ id: String(x.id), name: String(x.name || "").trim(), from: Number.isInteger(x.from) && x.from >= 0 && x.from < 30 ? x.from : null }));
  return { list, others, edit: !!r.edit, day: r.day || null };
}
/** Кто в очереди сегодня (не убран), по порядку. */
export const queueLive = (q) => (q ? q.list.filter((x) => !x.out) : []);
/** Следующий: первый не на перерыве, не убранный и не из skip. */
export function queueNext(q, skip = []) {
  const sk = new Set((skip || []).map(String));
  return queueLive(q).find((x) => !x.away && !sk.has(x.id)) || null;
}
/** Место в очереди (с 1), среди тех, кто в ней сегодня; нет — 0. */
export function queuePos(q, id) {
  const i = queueLive(q).findIndex((x) => x.id === String(id));
  return i < 0 ? 0 : i + 1;
}

const withList = (q, list) => ({ ...q, list, others: q.others.filter((o) => !list.some((x) => x.id === o.id)) });
/** Позвали лично к столу или посадили гостей: в конец, с перерыва и из убранных — обратно (как сервер, этап 69). Кого
 *  в очереди нет — не дописываем: очередь составляет хостес. */
export function queueAfterCall(q, id) {
  if (!q) return q;
  const k = String(id), cur = q.list.find((x) => x.id === k);
  if (!cur) return q;
  return withList(q, [...q.list.filter((x) => x.id !== k), { id: k, name: cur.name, away: false, out: false }]);
}
/** Выше (d = -1) или ниже (d = 1) среди тех, кто в очереди; убранные остаются на своих местах. */
export function queueMove(q, id, d) {
  if (!q) return q;
  const live = queueLive(q), i = live.findIndex((x) => x.id === String(id)), j = i + d;
  if (i < 0 || j < 0 || j >= live.length) return q;
  const swap = [...live];
  [swap[i], swap[j]] = [swap[j], swap[i]];
  let k = 0;
  return withList(q, q.list.map((x) => (x.out ? x : swap[k++])));
}
/** На перерыв и обратно (away), убрать и вернуть (out). Вернули — в конец очереди. */
export function queueFlag(q, id, key, on) {
  if (!q || (key !== "away" && key !== "out")) return q;
  const k = String(id), cur = q.list.find((x) => x.id === k);
  if (!cur) return q;
  const next = { ...cur, [key]: !!on, ...(key === "out" ? { away: false } : {}) };
  if (key === "out" && !on) return withList(q, [...q.list.filter((x) => x.id !== k), next]);
  return withList(q, q.list.map((x) => (x.id === k ? next : x)));
}
/** Добавить официанта, которого нет в очереди (others), — в конец. */
export function queueAdd(q, id) {
  if (!q) return q;
  const o = q.others.find((x) => x.id === String(id));
  return o ? withList(q, [...q.list, { id: o.id, name: o.name, away: false, out: false }]) : q;
}
/** Очередь на сегодня ещё не составлена (или все убраны). */
export const queueEmpty = (q) => !queueLive(q).length;
/** Кто сегодня по графику, а в очереди его нет: по началу смены (так пришлёт сервер), потом по имени. */
export const queueToday = (q) => (q ? q.others.filter((x) => x.from != null).sort((a, b) => a.from - b.from || a.name.localeCompare(b.name, "ru")) : []);
/** «Все по графику»: сегодняшних — в конец очереди по началу смены; кто убран сегодня — не трогаем. */
export function queueBySchedule(q) {
  const add = queueToday(q);
  return add.length ? withList(q, [...q.list, ...add.map((x) => ({ id: x.id, name: x.name, away: false, out: false }))]) : q;
}
/** «с 12:00» у кнопки официанта, который сегодня в графике. */
export const fromLabel = (x) => (x && x.from != null ? "с " + (x.from > 24 ? x.from - 24 : x.from) + ":00" : "");
/** Строка очереди в чате: «Очередь к столам: Анна С. → Илья Б. → Мария К.» и моё место. */
export function queueLine(q, meId) {
  const live = queueLive(q);
  if (!live.length) return null;
  const labels = queueLabels(live), pos = meId != null ? queuePos(q, meId) : 0, me = pos ? live[pos - 1] : null;
  return { names: labels, next: queueNext(q), pos, away: !!(me && me.away), n: live.length };
}
/** Для queue_set: [{ id, away, out }] по порядку. */
export const queueOrd = (q) => (q ? q.list.map((x) => ({ id: x.id, away: x.away, out: x.out })) : []);
/** Подпись в кнопке: «Пётр О.»; одинаковые — полным именем. */
export function queueLabels(list) {
  const short = (list || []).map((x) => bubbleName(x.name) || x.name);
  return short.map((s, i) => (short.filter((t) => t === s).length > 1 ? list[i].name : s));
}

// ── передать дальше ───────────────────────────────────────────────────────────────
const CALL_MS = 10 * 60e3;   // вызов без ответа «гаснет» через 10 минут (как CALL_TTL_MIN в lib/chat.js)
/** Можно ли мне передать этот вызов дальше: лично к столу, без ответа, не передан, моложе 10 минут; передаёт тот, кого
 *  позвали, кто позвал (официант не отвечает) или руководитель. */
export function canPass(msg, me, now = Date.now()) {
  const c = msg && msg.call;
  if (!c || msg.kind !== "call" || msg.del || c.who !== "person" || c.why !== "table" || c.passed || c.done) return false;
  if (Array.isArray(c.going) && c.going.length) return false;
  if (now - Date.parse(msg.at || 0) >= CALL_MS) return false;
  const id = me && String(me.id);
  return !!id && (String(c.emp) === id || String(msg.emp) === id || !!(me && me.lead));
}
/** Вызов передали: «Анна передаёт стол дальше: позвали Петра»; передал позвавший — «Стол передан дальше: позвали Петра». */
export function passedLine(call) {
  const p = call && call.passed;
  if (!p) return "";
  const to = "позвали " + (accName(first(p.to_name)) || "следующего");
  return String(p.by) === String(call.emp) ? first(p.by_name || call.to_name) + " передаёт стол дальше: " + to : "Стол передан дальше: " + to;
}
/** Вызов пришёл передачей: «Анна передаёт этот стол»; передал позвавший — «Анна не отвечает, стол передали». */
export function fromLine(call) {
  const f = call && call.from;
  if (!f || !f.name) return "";
  return first(f.name) + (f.self === false ? " не отвечает, стол передали" : " передаёт этот стол");
}
/** Ответ chat_pass словами. */
export function passErrText(r) {
  const e = r && r.error;
  if (e === "nobody") return "Передать некому: остальные в очереди на перерыве или уже передали этот стол.";
  if (e === "going") return "На этот вызов уже идут.";
  if (e === "passed") return "Этот стол уже передали дальше.";
  if (e === "stale") return "Вызов устарел.";
  if (e === "missing") return "Передать дальше пока нельзя: на сервере нет очереди официантов.";
  if (e === "net") return "Нет связи. Попробуй ещё раз.";
  return "Не получилось. Проверь связь и попробуй ещё раз.";
}
