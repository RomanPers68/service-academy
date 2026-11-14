// lib/shift-mates.js — v157 (Доп. 481): «кто сегодня со мной» на вкладке «Смена». Без интерфейса и без сервера: копия
// графика на телефоне (та же, из которой lib/streak.js берёт свою смену).
//
// Владелец (14.11) на набросок «Смена: кто сегодня со мной» (вместо строки «Тап покажет, кто в смене с тобой и кто
// старший» — кружки коллег и кто старший): «Да, все прекрасно, мне нравится».
//   • С тобой — все, у кого сегодня смена в том же заведении и она пересекается с твоей по часам. Выездная смена
//     (extra, «Кейтеринг») — не с тобой, если только ты не в ней же.
//   • Старший — как в «Графике» (ui/schedule.jsx, leadObj): первый менеджер, у которого сегодня обычная смена.
//   • В строках графика имя пишут «Фамилия Имя», но правилом это не закреплено. Порядок слов узнаём по своей строке:
//     начинается с фамилии из профиля — у всех первым идёт имя второе слово, иначе первое.
import { myScheduleCopies, ymd } from "./streak";
import { isFemaleName } from "./utils";

const nrm = (x) => String(x || "").toLowerCase().replace(/ё/g, "е").trim();
const words = (x) => String(x || "").trim().split(/\s+/).filter(Boolean);
const up = (w) => (w ? w[0].toUpperCase() : "");

/** Фамилия первой? null — по своей строке не понять (одно слово или ни имя, ни фамилия не узнаны). */
export function surnameFirst(myRowName, profile) {
  const w = words(myRowName);
  if (w.length < 2 || !profile) return null;
  const name = nrm(profile.name), sur = nrm(profile.surname);
  if (sur && nrm(w[0]) === sur) return true;
  if (name && nrm(w[0]) === name) return false;
  if (name && nrm(w[1]) === name) return true;
  if (sur && nrm(w[1]) === sur) return false;
  return null;
}
/** Имя, фамилия и буквы для кружка из строки графика: «Ким Мария» → { first: "Мария", sur: "Ким", ini: "МК" } */
export function mateName(rowName, surFirst = true) {
  const w = words(rowName);
  if (!w.length) return { first: "", sur: "", ini: "?" };
  if (w.length === 1) return { first: w[0], sur: "", ini: up(w[0]) };
  const first = surFirst === false ? w[0] : w[1], sur = surFirst === false ? w[1] : w[0];
  return { first, sur, ini: up(first) + up(sur) };
}
const span = (sh) => (sh && typeof sh.from === "number" && typeof sh.to === "number" ? [sh.from, sh.to > sh.from ? sh.to : sh.to + 24] : null);
const overlap = (a, b) => { const x = span(a), y = span(b); return !x || !y ? true : Math.max(x[0], y[0]) < Math.min(x[1], y[1]); };

/**
 * Кто сегодня со мной: null — неизвестно (нет копии графика, себя в ней нет, сегодня выходной);
 * иначе { mates: [{ id, full, first, ini, lead, same }], lead: имя старшего | null, leadF: старший — женщина, leadMe: старший — я }.
 * Порядок: старший, потом та же смена, потом остальные — по началу смены, дальше как в графике.
 */
export function shiftMates(profile, date, storage) {
  try {
    const day = date.getDate(), today = ymd(date);
    for (const { c, me } of myScheduleCopies(profile, date, storage)) {
      // целая копия (экран «График») — как есть; своя строка из тихой подгрузки — с сегодняшним составом рядом (today)
      const full = (c.cfg.staff || []).length > 1;
      const t = !full && c.today && c.today.date === today && Array.isArray(c.today.staff) ? c.today : null;
      if (!full && !t) continue;
      const src = full ? c : { cfg: { staff: t.staff, shifts: c.cfg.shifts }, plan: Object.fromEntries(Object.entries(t.plan || {}).map(([id, k]) => [id, { [day]: k }])) };
      const mine = full ? me : t.staff.find((x) => String(x.id) === String(me.id)) || me;
      const r = matesIn(src, mine, profile, date);
      if (r) return r;
    }
  } catch (e) { /* */ }
  return null;
}
function matesIn(c, me, profile, date) {
  const plan = c.plan || {}, day = date.getDate();
  const mkey = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  const shifts = Array.isArray(c.cfg.shifts) ? c.cfg.shifts : [];
  const shiftOf = (id) => { const k = (plan[id] || {})[day]; return k ? shifts.find((q) => q.k === k) || null : null; };
  const mine = shiftOf(me.id);
  if (!mine) return null;
  const staff = (c.cfg.staff || []).filter((q) => q && (!q.till || mkey <= q.till) && (!q.since || mkey >= q.since));
  const sf = surnameFirst(me.name, profile);
  const leadRow = staff.find((s) => s.pos === "manager" && shiftOf(s.id) && !shiftOf(s.id).extra) || null;
  const rows = staff.map((x, i) => ({ x, i, sh: String(x.id) === String(me.id) ? null : shiftOf(x.id) }))
    .filter((o) => o.sh && (o.sh.extra ? !!mine.extra && o.sh.k === mine.k : !mine.extra) && overlap(mine, o.sh));
  const rank = (o) => (leadRow && o.x.id === leadRow.id ? 0 : o.sh.k === mine.k ? 1 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || (Number(a.sh.from) || 0) - (Number(b.sh.from) || 0) || a.i - b.i);
  const mates = rows.map((o) => { const n = mateName(o.x.name, sf !== false);
    return { id: o.x.id, full: String(o.x.name || ""), first: n.first, ini: n.ini, lead: !!leadRow && o.x.id === leadRow.id, same: o.sh.k === mine.k }; });
  const leadMate = mates.find((m) => m.lead) || null;
  const ln = leadMate ? mateName(leadMate.full, sf !== false) : null;
  return { mates, lead: ln ? ln.first : null, leadF: ln ? isFemaleName(ln.first, ln.sur) : false, leadMe: !!leadRow && String(leadRow.id) === String(me.id) };
}

/** «Мария, Дарья и Ксения» · «Мария, Дарья и ещё 2» — имена в одну строку, не длиннее трёх */
export function matesLine(mates) {
  const n = (mates || []).map((m) => m.first).filter(Boolean);
  if (!n.length) return "";
  if (n.length === 1) return n[0];
  if (n.length === 2) return n[0] + " и\u00A0" + n[1];
  if (n.length === 3) return n[0] + ", " + n[1] + " и\u00A0" + n[2];
  return n[0] + ", " + n[1] + " и\u00A0ещё\u00A0" + (n.length - 2);   // хвост не отрывается: «…и ещё 2» переносится целиком
}
/** Подпись под именами: «с тобой сегодня · Мария старшая»; старший — я: «… · ты за старшего» */
export function matesNote(info) {
  if (!info || !info.mates || !info.mates.length) return "";
  if (info.leadMe) return "с тобой сегодня · ты\u00A0за\u00A0старшего";
  if (!info.lead) return "с тобой сегодня";
  return "с тобой сегодня · " + info.lead + (info.leadF ? "\u00A0старшая" : "\u00A0старший");
}
