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
// v217 (Доп. 543): очередь опирается на часы смены из графика. Владелец: «он не будет давать стол человеку которого
//   нет в период с 11 до 17? В общем он будет опираться на часы работы официанта, смотря на график?». С сервера
//   (этап 73) у каждого — from и to (час начала и конца смены сегодня; после полуночи — 25, 26), stay («Остался» после
//   смены) и min — минуты рабочего дня заведения сейчас (день заведения меняется в 6 утра: бар до двух ночи — всё ещё
//   «сегодня»). Смена кончилась — очередь его не подсвечивает и «передать дальше» пропускает, пока хостес не нажмёт
//   «Остался»; «Все, кто на смене» ставит только тех, у кого смена началась или начнётся в ближайшие полчаса;
//   вечерние ждут «с 17:00», а когда их время пришло, хостес видит «по графику уже на смене» и добавляет одним нажатием.
// v218 (Доп. 544): и до начала смены. В очереди с утра стоял вечерний официант (добавили раньше), и до 17:00 ему всё
//   ещё могли дать стол. Теперь кто в очереди, а смена по графику начнётся больше чем через полчаса, — бледный «с 17:00»
//   и следующим не подсвечивается, пока хостес не нажмёт «Пришёл» (here). Добавила его сама из «Позже по графику» —
//   значит, пришёл: here ставится сразу.
// «.js» в путях — модуль читают и тесты в Node.
import { accName, bubbleName } from "./chat.js";

const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";
const hFrom = (v) => (Number.isInteger(v) && v >= 0 && v < 30 ? v : null);
const hTo = (v) => (Number.isInteger(v) && v > 0 && v <= 48 ? v : null);
const ent = (x) => ({ id: String(x.id), name: String(x.name || "").trim(), away: !!x.away, out: !!x.out, stay: !!x.stay, here: !!x.here, from: hFrom(x.from), to: hTo(x.to) });

/** День заведения начинается в 6 утра: смена до двух ночи — всё ещё сегодняшняя (как _sa_queue_day, этап 73). */
export const DAY_START = 6;
/** За сколько минут до начала смены человек уже «на смене»: приходят заранее, к подготовке зала. */
export const EARLY_MIN = 30;

/** Ответ queue_get или queue_set → { list, others, edit, day, min, at }; не очередь — null. at — когда пришёл ответ. */
export function queueOf(r, at = Date.now()) {
  if (!r || r.ok !== true || !Array.isArray(r.list)) return null;
  const seen = new Set(), list = [];
  for (const x of r.list) if (x && x.id != null && !seen.has(String(x.id))) { seen.add(String(x.id)); list.push(ent(x)); }
  const others = (Array.isArray(r.others) ? r.others : []).filter((x) => x && x.id != null && !seen.has(String(x.id)))
    .map((x) => ({ id: String(x.id), name: String(x.name || "").trim(), from: hFrom(x.from), to: hTo(x.to) }));
  const min = Number.isInteger(r.min) && r.min >= 0 && r.min < 2880 ? r.min : null;
  return { list, others, edit: !!r.edit, day: r.day || null, min, at };
}
/** Минуты дня заведения сейчас: от его полуночи, после полуночи до 6 утра — 24:00 и дальше. С сервера (min) плюс
 *  сколько прошло с ответа; сервер старый — по часам телефона. */
export function queueNow(q, t = Date.now()) {
  if (q && q.min != null && q.at) return q.min + Math.max(0, Math.floor((t - q.at) / 60000));
  const d = new Date(t), m = d.getHours() * 60 + d.getMinutes();
  return m < DAY_START * 60 ? m + 1440 : m;
}
/** Смена по графику закончилась, и хостес не отметила «Остался». */
export const shiftOver = (x, m) => !!x && x.to != null && !x.stay && m >= x.to * 60;
/** Смена по графику ещё не началась. */
export const shiftLater = (x, m) => !!x && x.from != null && m < x.from * 60;
/** Смена начнётся больше чем через полчаса, и хостес не отметила «Пришёл»: столы ему пока не идут. */
export const shiftEarly = (x, m) => !!x && x.from != null && !x.here && m < x.from * 60 - EARLY_MIN;
/** Вне смены по графику сейчас: ещё рано или уже кончилась. */
export const shiftOff = (x, m) => shiftEarly(x, m) || shiftOver(x, m);
/** Час в подписи: 24 — «24:00», после полуночи 26 — «2:00». */
const hh = (h) => (h > 24 ? h - 24 : h) + ":00";
/** «до 19:00» — конец смены по графику. */
export const toLabel = (x) => (x && x.to != null ? "до " + hh(x.to) : "");
/** Кто в очереди сегодня (не убран), по порядку. */
export const queueLive = (q) => (q ? q.list.filter((x) => !x.out) : []);
/** Кому сейчас дают столы: в очереди и по графику на смене (или «Пришёл», «Остался»). */
export const queueOn = (q, m = queueNow(q)) => queueLive(q).filter((x) => !shiftOff(x, m));
/** Следующий: первый не на перерыве, не убранный, не из skip и по графику на смене. */
export function queueNext(q, skip = [], m = queueNow(q)) {
  const sk = new Set((skip || []).map(String));
  return queueOn(q, m).find((x) => !x.away && !sk.has(x.id)) || null;
}
/** Место в очереди (с 1) среди тех, кому сейчас дают столы; нет — 0. */
export function queuePos(q, id, m = queueNow(q)) {
  const i = queueOn(q, m).findIndex((x) => x.id === String(id));
  return i < 0 ? 0 : i + 1;
}

const withList = (q, list) => ({ ...q, list, others: q.others.filter((o) => !list.some((x) => x.id === o.id)) });
/** Позвали лично к столу или посадили гостей: в конец, с перерыва и из убранных — обратно (как сервер, этап 69). Кого
 *  в очереди нет — не дописываем: очередь составляет хостес. Часы смены и «Остался» остаются (этап 73). */
export function queueAfterCall(q, id) {
  if (!q) return q;
  const k = String(id), cur = q.list.find((x) => x.id === k);
  if (!cur) return q;
  return withList(q, [...q.list.filter((x) => x.id !== k), { ...cur, away: false, out: false }]);
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
/** На перерыв и обратно (away), убрать и вернуть (out), «Остался» после смены (stay), «Пришёл» до смены (here).
 *  Вернули — в конец очереди. */
export function queueFlag(q, id, key, on) {
  if (!q || !["away", "out", "stay", "here"].includes(key)) return q;
  const k = String(id), cur = q.list.find((x) => x.id === k);
  if (!cur) return q;
  const next = { ...cur, [key]: !!on, ...(key === "out" ? { away: false } : {}) };
  if (key === "out" && !on) return withList(q, [...q.list.filter((x) => x.id !== k), next]);
  return withList(q, q.list.map((x) => (x.id === k ? next : x)));
}
// добавили до смены (больше чем за полчаса) — хостес видит его в зале: «Пришёл» сразу
const fresh = (o, m) => ({ id: o.id, name: o.name, away: false, out: false, stay: false, here: o.from != null && m < o.from * 60 - EARLY_MIN, from: o.from, to: o.to });
/** Добавить официанта, которого нет в очереди (others), — в конец. */
export function queueAdd(q, id, m = queueNow(q)) {
  if (!q) return q;
  const o = q.others.find((x) => x.id === String(id));
  return o ? withList(q, [...q.list, fresh(o, m)]) : q;
}
/** Очередь на сегодня ещё не составлена (или все убраны). */
export const queueEmpty = (q) => !queueLive(q).length;
/** Кто сегодня по графику, а в очереди его нет и смена ещё не кончилась: по началу смены, потом по имени. */
export const queueToday = (q, m = queueNow(q)) => (q ? q.others.filter((x) => x.from != null && !shiftOver(x, m))
  .sort((a, b) => a.from - b.from || a.name.localeCompare(b.name, "ru")) : []);
/** Из них уже на смене по графику: смена началась или начнётся в ближайшие полчаса. */
export const queueDue = (q, m = queueNow(q)) => queueToday(q, m).filter((x) => x.from * 60 - EARLY_MIN <= m);
/** Из них позже: вечерние «с 17:00» — пока их нет, в очередь сами не встают. */
export const queueLater = (q, m = queueNow(q)) => queueToday(q, m).filter((x) => x.from * 60 - EARLY_MIN > m);
/** «Все, кто на смене»: тех, кто по графику уже на смене, — в конец очереди по началу смены. Вечерних не трогаем:
 *  их добавляют, когда пришли. Кто убран сегодня — тоже не трогаем. */
export function queueBySchedule(q, m = queueNow(q)) {
  const add = queueDue(q, m);
  return add.length ? withList(q, [...q.list, ...add.map((o) => fresh(o, m))]) : q;
}
/** «с 12:00» у кнопки официанта, который сегодня в графике. */
export const fromLabel = (x) => (x && x.from != null ? "с " + (x.from > 24 ? x.from - 24 : x.from) + ":00" : "");
/** Строка очереди в чате: «Очередь к столам: Анна С. → Илья Б. → Мария К.» и моё место. В строке — кому сейчас дают
 *  столы; кто вне смены по графику — не в строке (over — у кого кончилась, early — у кого ещё не началась); у меня
 *  самого — meOver «смена закончилась» или meEarly «смена с 17:00». */
export function queueLine(q, meId, m = queueNow(q)) {
  const live = queueLive(q);
  if (!live.length) return null;
  const on = queueOn(q, m), pos = meId != null ? queuePos(q, meId, m) : 0, me = pos ? on[pos - 1] : null;
  const mine = meId != null ? live.find((x) => x.id === String(meId)) : null;
  return { names: queueLabels(on), next: queueNext(q, [], m), pos, away: !!(me && me.away), n: on.length,
    over: live.filter((x) => shiftOver(x, m)).length, early: live.filter((x) => shiftEarly(x, m)).length,
    meOver: !!(mine && shiftOver(mine, m)), meEarly: !!(mine && shiftEarly(mine, m)), meFrom: mine && shiftEarly(mine, m) ? fromLabel(mine) : "" };
}
/** Для queue_set: [{ id, away, out, stay, here }] по порядку. */
export const queueOrd = (q) => (q ? q.list.map((x) => ({ id: x.id, away: x.away, out: x.out, stay: !!x.stay, here: !!x.here })) : []);
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
