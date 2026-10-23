// lib/month-recap.js — Доп. 320: «Итоги месяца».
//
// Месяц в карточках: дни в деле (календарь свечей), шаги и из чего они, лучший день и самая
// длинная серия, живые гости, свежие и золотые темы, закрытые квесты смены. Всё — с телефона
// (журнал дня хранит 75 дней — хватает на текущий и прошлый месяц). Можно «поделиться» текстом.
// v31: сравнение с прошлым месяцем (идущий месяц — «к этому же числу»), подписи с числом
// («9 уроков»), картинка для «поделиться» (lib/recap-image.js).
import { pointsOf, ACTIVITY_KEEP_DAYS } from "./activity";
import { MONTH_NOM, MONTH_GEN, MONTH_PREP, MONTH_INS } from "./dates.js";

// v59 (Доп. 372): словарь месяцев — общий (lib/dates.js); имена оставлены прежние
export const MONTH = MONTH_NOM; export { MONTH_GEN, MONTH_PREP, MONTH_INS };
const pad = (n) => String(n).padStart(2, "0");
export const monthKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
const T_KEYS = ["st", "l", "p", "q", "d", "b", "w", "m", "x", "g", "r", "u", "o", "k", "s", "f"];

// Какой месяц показывать: первые три дня месяца — прошлый (если в нём занимался), иначе текущий
export function recapMonth(act, now = new Date()) {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pk = monthKey(prev);
  const hasPrev = Object.keys(act || {}).some((k) => k.slice(0, 7) === pk && ((act[k] || {}).st || 0) > 0);
  return now.getDate() <= 3 && hasPrev ? { key: pk, prev: true } : { key: monthKey(now), prev: false };
}

// v31: дни в деле, шаги и очки лиги за первые upto дней месяца key — для сравнения месяцев
export function spanStats(act, streak, key, upto) {
  const days = new Set((streak && streak.days) || []);
  let active = 0, st = 0, points = 0;
  for (let d = 1; d <= upto; d++) {
    const k = key + "-" + pad(d);
    const r = (act && act[k]) || {};
    st += Number(r.st) || 0;
    points += pointsOf(r);
    if ((Number(r.st) || 0) + (Number(r.f) || 0) + (Number(r.s) || 0) > 0 || days.has(k)) active++;
  }
  return { active, st, points };
}

// Подписи к числам: «9 уроков», «1 тест», «3 разминки»
export const PART_WORDS = {
  l: ["урок", "урока", "уроков"], q: ["тест", "теста", "тестов"], p: ["практика", "практики", "практик"],
  d: ["диалог", "диалога", "диалогов"], b: ["сборка", "сборки", "сборок"], w: ["разминка", "разминки", "разминок"],
  g: ["живой гость", "живых гостя", "живых гостей"], r: ["выпуск радио", "выпуска радио", "выпусков радио"],
  u: ["тема освежена", "темы освежены", "тем освежено"], o: ["раунд мастера", "раунда мастера", "раундов мастера"],
  k: ["зачёт на опыт", "зачёта на опыт", "зачётов на опыт"], m: ["тренажёр", "тренажёра", "тренажёров"],
  x: ["экзамен", "экзамена", "экзаменов"], f: ["ошибка исправлена", "ошибки исправлены", "ошибок исправлено"],
  s: ["ситуация у стола", "ситуации у стола", "ситуаций у стола"],
};
const PART_ORDER = ["l", "q", "p", "d", "b", "w", "g", "r", "u", "o", "k", "m", "x", "f", "s"];
export function recapParts(totals) {
  return PART_ORDER.filter((k) => (Number(totals && totals[k]) || 0) > 0).map((k) => {
    const n = Number(totals[k]) || 0, w = PART_WORDS[k];
    return { k, n, word: plural(n, w[0], w[1], w[2]) };
  });
}

export function monthRecap({ act = {}, streak = {}, quests = [], guests = [], gold = {}, credits = {}, fresh = {}, month, now = new Date() } = {}) {
  const key = month || monthKey(now);
  const [y, m] = key.split("-").map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const isCur = key === monthKey(now);
  const upto = isCur ? now.getDate() : daysIn;
  const days = new Set((streak && streak.days) || []);
  const frozen = new Set((streak && streak.frozen) || []);
  const totals = {}; T_KEYS.forEach((k) => { totals[k] = 0; });
  const calendar = [];
  let active = 0, off = 0, best = null, run = 0, longest = 0, points = 0;
  for (let d = 1; d <= daysIn; d++) {
    const k = key + "-" + pad(d);
    if (d > upto) { calendar.push({ d, state: null }); continue; }
    const r = act[k] || {};
    T_KEYS.forEach((f) => { totals[f] += Number(r[f]) || 0; });
    points += pointsOf(r);
    const on = (Number(r.st) || 0) + (Number(r.f) || 0) + (Number(r.s) || 0) > 0 || days.has(k);
    const fr = !on && frozen.has(k);
    calendar.push({ d, state: on ? 2 : fr ? 1 : 0 });
    if (on) { active++; run++; longest = Math.max(longest, run); }
    else if (fr) { off++; }
    else if (d < upto || !isCur) run = 0;   // сегодняшний день ещё не потерян
    if ((Number(r.st) || 0) > 0 && (!best || r.st > best.steps)) best = { d, steps: Number(r.st) };
  }
  const inMonth = (s) => String(s || "").slice(0, 7) === key;
  const g = (guests || []).filter((x) => inMonth(x.d));
  // v31: прошлый месяц — целиком; идущий сравниваем «к этому же числу». Только если журнал
  // на телефоне ещё хранит прошлый месяц целиком (75 дней) и в нём что-то было.
  let prev = null;
  const pd = new Date(y, m - 2, 1);
  const pDaysIn = new Date(pd.getFullYear(), pd.getMonth() + 1, 0).getDate();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const age = Math.round((today - pd) / 864e5);
  if (age >= 0 && age <= ACTIVITY_KEEP_DAYS - 1) {
    const pUpto = isCur ? Math.min(upto, pDaysIn) : pDaysIn;
    const ps = spanStats(act, streak, monthKey(pd), pUpto);
    if (ps.st > 0 || ps.active > 0) {
      const pm = pd.getMonth();
      prev = { key: monthKey(pd), title: MONTH[pm], gen: MONTH_GEN[pm], prep: MONTH_PREP[pm], ins: MONTH_INS[pm], upto: pUpto, partial: isCur && pUpto < pDaysIn, ...ps };
    }
  }
  return {
    key, year: y, month: m, title: MONTH[m - 1], gen: MONTH_GEN[m - 1], prep: MONTH_PREP[m - 1], current: isCur, daysIn, upto,
    active, off, calendar, totals, points, best: best ? { ...best, label: best.d + " " + MONTH_GEN[m - 1] } : null, longest,
    guests: { n: g.length, best: g.reduce((a, x) => Math.max(a, Number(x.s) || 0), 0) },
    quests: (quests || []).filter(inMonth).length,
    gold: Object.keys(gold || {}).filter((id) => inMonth(gold[id] && gold[id].d)).length,
    credits: Object.keys(credits || {}).filter((id) => inMonth(credits[id] && credits[id].d)).length,
    goldAll: Object.keys(gold || {}).length,
    freshAll: Object.keys(fresh || {}).length,
    prev,
  };
}

// v31: короткий вывод сравнения — заголовок карточки и строка для «поделиться»
export function compareLine(r) {
  const p = r && r.prev;
  if (!p) return null;
  const cur = r.totals.st, was = p.st, d = cur - was;
  if (d === 0 || (was > 0 && cur >= was * 0.9 && cur <= was * 1.1)) return { tone: "eq", d, title: "Вровень с " + p.ins, share: was > 0 ? "вровень с " + p.ins : null };
  if (d > 0) return { tone: "up", d, title: "Шагов больше, чем в " + p.prep, share: "к " + MONTH_GEN_DAT(p) + ": +" + d + " " + plural(d, "шаг", "шага", "шагов") };
  return { tone: "down", d, title: r.current ? "В " + p.prep + " шагов было больше. Догонишь?" : "В " + p.prep + " шагов было больше", share: null };
}
// «к сентябрю» — дательный падеж
const MONTH_DAT = ["январю", "февралю", "марту", "апрелю", "маю", "июню", "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю"];
function MONTH_GEN_DAT(p) { const i = MONTH.indexOf(p.title); return i >= 0 ? MONTH_DAT[i] : p.title.toLowerCase(); }

// Текст «поделиться» — без личного, кроме имени
export function recapShareText(r, name) {
  const lines = ["Итоги за " + r.title.toLowerCase() + (name ? ", " + name : "")];
  lines.push("Дней в деле: " + r.active + (r.current ? " из " + r.upto : " из " + r.daysIn) + " · шагов: " + r.totals.st);
  const extra = [];
  if (r.best) extra.push("лучший день: " + r.best.label + " (" + r.best.steps + ")");
  if (r.longest > 1) extra.push("серия " + r.longest + " " + plural(r.longest, "день", "дня", "дней"));
  if (extra.length) lines.push(extra.join(" · "));
  const more = [];
  if (r.guests.n) more.push("живых гостей: " + r.guests.n);
  if (r.gold) more.push("золотых тем: " + r.gold);
  if (r.quests) more.push("квестов смены: " + r.quests);
  if (more.length) lines.push(more.join(" · "));
  const cmp = compareLine(r);
  if (cmp && cmp.share) lines.push(cmp.share);
  lines.push("Service Academy");
  return lines.join("\n");
}

export function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; }
