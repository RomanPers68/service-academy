// lib/mastery.js — v40: «Путь мастера».
//
// Каждый инструмент приложения — семейство значков с тремя ступенями: бронза, серебро, золото
// (14 семейств, FAMILIES). Над ними — «Мастер роли ✦»: роль пройдена, 5 золотых тем, серия
// 14 дней и бронза в 10 семействах. Новичку — «Первые шаги в академии»: семь заданий по главным
// инструментам (FIRST_WEEK). Каждый день — «Шаг дня»: одно предложение, что сделать сегодня;
// выбирается при первом показе и не меняется до конца дня.
// Всё считается на телефоне из того, что приложение уже хранит, плюс счётчики за всё время
// (sa_life<uk>, lib/activity.js) — журнал дня держит только 75 дней.
//
// Хранится на телефоне:
//   sa_life<uk>         — счётчики за всё время (lib/activity.js: readLife, syncLife)
//   sa_mastery<uk>      — что уже отпраздновали: { tiers: { [семейство]: ступень }, fw, master: { [роль]: "ГГГГ-ММ-ДД" } }
//   sa_mastery_sum<uk>  — итог для копии на сервер и отчёта руководителя (saveSummary)
//   sa_step<uk>         — шаг дня: { day, id, kind, fam, text, sub, go, payload, base, at }
// Читает (не пишет): sa_activity, sa_gold, sa_streak, sa_quest_done, sa_fresh, sa_mistakes,
// sa_completed, sa_quiz_done (все с <uk>), sa_skills_<имя>|<фамилия> и копию графика.
//
// Чистые функции без React. Импорты — с «.js»: модуль нужен и отчёту на сервере
// (api/report.js → lib/report-model.js), а Node находит файлы только с расширением.

import { readLife, syncLife, mergeLife, readActivity, ACTIVITY_FIELDS } from "./activity.js";
import { moduleDone } from "./freshness.js";
import { ymd, myShiftOn } from "./streak.js";
import { ROLE_LABEL } from "../data/roles.js";

export { readLife, syncLife };

export const TIERS = ["", "бронза", "серебро", "золото"];
export const TIERS_OF = ["", "бронзы", "серебра", "золота"];   // «Ещё 2 разминки до серебра …»
export const FIRST_WEEK_DAYS = 14;                               // «Первые шаги» открыты 14 дней с первого занятия
export const MASTER_NEED = { gold: 5, streak: 14, bronze: 10 };  // «Мастер роли ✦», кроме самой роли

const STEP_KEY = "sa_step", EARNED_KEY = "sa_mastery", SUM_KEY = "sa_mastery_sum", SEEN_KEY = "sa_tools_seen";

export function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; }

const ls = (storage) => storage || (typeof localStorage !== "undefined" ? localStorage : null);
const readJSON = (st, key, d) => { try { const v = JSON.parse((st && st.getItem(key)) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const writeJSON = (st, key, v) => { try { if (st) st.setItem(key, JSON.stringify(v)); } catch (e) {} };
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const lifeOf = (x, f) => num(x && x.life && x.life[f]);
const realSteps = (m) => ((m && m.lessons) || []).filter((l) => l && l.type !== "result");
const dayDiff = (from, to) => {
  const p = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d, 12); };
  return Math.round((p(to) - p(from)) / 86400000);
};

// Ключ навыков, подтверждённых наставником (ui/mentor.jsx)
export const skillsKey = (profile) => `sa_skills_${(profile && profile.name) || "guest"}|${(profile && profile.surname) || ""}`.toLowerCase();

// ── Семейства ────────────────────────────────────────────────────────────────
// { id, title, icon, what, tiers, how, go } — как договорились с экраном. Сверх того:
//   value(facts) — что считается; unit — «Ещё N …» (1 / 2 / 5); forms — «N …» (1 / 2 / 5);
//   life — буква счётчика за всё время, по которой видно, что инструментом пользовались
//   (для «Не пользуется» в отчёте); tool — инструмент, который можно «попробовать» шагом дня;
//   can(ctx) — можно ли заняться им прямо сейчас (шаг дня не зовёт туда, где делать нечего).
export const FAMILIES = [
  { id: "track", title: "Трек", icon: "📚", what: "разделов пройдено",
    tiers: (x) => { const n = Math.max(1, Math.floor(num(x && x.sectionsTotal))); return [1, Math.ceil(n / 2), n]; },
    how: "Проходи разделы трека до конца: все шаги и тест в финале раздела.", go: "track",
    unit: ["раздел", "раздела", "разделов"], forms: ["раздел пройден", "раздела пройдены", "разделов пройдено"],
    life: "l", tool: false, value: (x) => num(x.sectionsDone), can: ({ x }) => num(x.sectionsDone) < num(x.sectionsTotal) },
  { id: "tests", title: "Тесты на отлично", icon: "🎯", what: "тестов на 100%", tiers: [1, 5, 10],
    how: "Готовься по урокам и сдавай тест раздела без единой ошибки: в значок идут тесты на 100%.", go: "track",
    unit: ["тест на 100%", "теста на 100%", "тестов на 100%"], forms: ["тест на 100%", "теста на 100%", "тестов на 100%"],
    life: "q", tool: false, value: (x) => num(x.perfectTests), can: ({ x }) => num(x.sectionsDone) < num(x.sectionsTotal) },
  { id: "table", title: "Практика у стола", icon: "🍽️", what: "ситуаций сыграно", tiers: [20, 100, 300],
    how: "Играй ситуации у стола в практике тем: выбери, как поступить, и сразу узнаешь почему.", go: "practice",
    unit: ["ситуация", "ситуации", "ситуаций"], forms: ["ситуация сыграна", "ситуации сыграны", "ситуаций сыграно"],
    life: "s", tool: true, value: (x) => lifeOf(x, "s"), can: () => true },
  { id: "dialogue", title: "Живой диалог", icon: "💬", what: "разговоров до конца", tiers: [1, 10, 25],
    how: "Доведи разговор с гостем до последней реплики в диалогах трека или с «Гостем недели».", go: "dialogue",
    unit: ["диалог", "диалога", "диалогов"], forms: ["разговор до конца", "разговора до конца", "разговоров до конца"],
    life: "d", tool: true, value: (x) => lifeOf(x, "d"), can: () => true },
  { id: "fresh", title: "Свежесть тем", icon: "🍷", what: "тем освежено", tiers: [3, 15, 40],
    how: "Когда номер темы в треке бледнеет, нажми «Освежить»: три задания, и тема снова свежая.", go: "refresh",
    unit: ["тема", "темы", "тем"], forms: ["тема освежена", "темы освежены", "тем освежено"],
    life: "u", tool: true, value: (x) => lifeOf(x, "u"), can: ({ faded }) => faded.length > 0 },
  { id: "gold", title: "Раунд мастера", icon: "👑", what: "золотых тем", tiers: [1, 5, 10],
    how: "Сыграй «Раунд мастера» по пройденной теме: 8 заданий на время, не больше одной ошибки.", go: "gold",
    unit: ["золотая тема", "золотые темы", "золотых тем"], forms: ["золотая тема", "золотые темы", "золотых тем"],
    life: "o", tool: true, value: (x) => num(x.gold), can: ({ goldable }) => goldable.length > 0 },
  { id: "warmup", title: "Разминка до смены", icon: "☕", what: "разминок", tiers: [3, 15, 40],
    how: "Перед сменой сделай разминку: три задания из пройденного за две минуты.", go: "warmup",
    unit: ["разминка", "разминки", "разминок"], forms: ["разминка", "разминки", "разминок"],
    life: "w", tool: true, value: (x) => lifeOf(x, "w"), can: ({ x }) => x.shiftToday !== false },
  { id: "radio", title: "Радио в дорогу", icon: "📻", what: "выпусков", tiers: [3, 15, 40],
    how: "Включи «Радио в дорогу» по пути на смену: три коротких выпуска из твоих уроков.", go: "radio",
    unit: ["выпуск", "выпуска", "выпусков"], forms: ["выпуск", "выпуска", "выпусков"],
    life: "r", tool: true, value: (x) => lifeOf(x, "r"), can: () => true },
  { id: "guest", title: "Живой гость", icon: "🙋", what: "визитов", tiers: [1, 10, 30],
    how: "Поговори с «Живым гостем»: он играет гостя под твою роль, а в конце даёт чек разбора.", go: "guest",
    unit: ["визит", "визита", "визитов"], forms: ["визит", "визита", "визитов"],
    life: "g", tool: true, value: (x) => lifeOf(x, "g"), can: () => true },
  { id: "fixes", title: "Работа над ошибками", icon: "🔧", what: "ошибок исправлено", tiers: [5, 30, 100],
    how: "Открой «Работу над ошибками» и ответь верно там, где раньше ошибся.", go: "mistakes",
    unit: ["исправленная ошибка", "исправленные ошибки", "исправленных ошибок"], forms: ["ошибка исправлена", "ошибки исправлены", "ошибок исправлено"],
    life: "f", tool: true, value: (x) => lifeOf(x, "f"), can: ({ x }) => num(x.mistakesDue) > 0 },
  { id: "decks", title: "Колоды и тренажёры", icon: "🃏", what: "тренировок", tiers: [10, 50, 150],
    how: "Тренируйся в колодах меню и бара: пять карточек «Знаю?», «Аллергены на скорость» или «Сборка руками».", go: "menu",
    unit: ["тренировка", "тренировки", "тренировок"], forms: ["тренировка", "тренировки", "тренировок"],
    life: "m", tool: true, value: (x) => lifeOf(x, "m"), can: () => true },
  { id: "streak", title: "Свеча", icon: "🕯️", what: "дней в лучшей серии", tiers: [3, 7, 30],
    how: "Занимайся каждый день хотя бы один шаг. Выходной по графику серию не гасит.", go: "track",
    unit: ["день серии", "дня серии", "дней серии"], forms: ["день подряд", "дня подряд", "дней подряд"],
    life: null, tool: false, value: (x) => num(x.streakBest), can: () => true },
  { id: "quest", title: "Квест смены", icon: "🤝", what: "квестов закрыто", tiers: [1, 10, 30],
    how: "Внеси свою часть в цель смены (разминки, шаги, живые гости), и закройте квест вместе.", go: "quest",
    unit: ["квест", "квеста", "квестов"], forms: ["квест закрыт", "квеста закрыты", "квестов закрыто"],
    life: null, tool: true, value: (x) => num(x.questsDone), can: ({ x }) => x.shiftToday === true },
  { id: "hall", title: "Навыки в зале", icon: "🎓", what: "навыков подтвердил наставник", tiers: [1, 5, 15],
    how: "Покажи навык в зале, и старший подтвердит его своим PIN или в «Наставничестве».", go: "mentor",
    unit: ["навык", "навыка", "навыков"], forms: ["навык подтверждён", "навыка подтверждены", "навыков подтверждено"],
    life: null, tool: true, value: (x) => num(x.hallSkills), can: () => true },
];
const FAM_BY = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
const FAM_IDS = new Set(FAMILIES.map((f) => f.id));

// «12 тем освежено», «1 раздел пройден»
export function familyCount(fam, n) {
  const f = typeof fam === "string" ? FAM_BY[fam] : FAM_BY[fam && fam.id] || fam;
  const v = Math.floor(num(n));
  return v + " " + (f && f.forms ? plural(v, ...f.forms) : "");
}

// ── «Первые шаги в академии»: семь заданий первых двух недель ───────────────────────────────────────
export const FIRST_WEEK = [
  { id: "warmup", title: "Разомнись до смены", how: "Три задания из пройденного за две минуты, лучше всего перед выходом в зал.", go: "warmup",
    test: (x) => lifeOf(x, "w") >= 1 },
  { id: "dialogue", title: "Проведи диалог с гостем", how: "Живой диалог: гость отвечает на каждую твою реплику. Доведи разговор до конца.", go: "dialogue",
    test: (x) => lifeOf(x, "d") >= 1 },
  { id: "practice", title: "Сыграй ситуацию у стола", how: "Практика темы: случаи из зала, где нужно выбрать, как поступить, и узнать почему.", go: "practice",
    test: (x) => lifeOf(x, "p") >= 1 || lifeOf(x, "s") >= 1 },
  { id: "radio", title: "Послушай «Радио в дорогу»", how: "Три коротких выпуска из твоих уроков, удобно слушать по пути на смену.", go: "radio",
    test: (x) => lifeOf(x, "r") >= 1 },
  { id: "guest", title: "Обслужи живого гостя", how: "Гость-ИИ под твою роль: говори голосом или текстом, в конце чек разбора.", go: "guest",
    test: (x) => lifeOf(x, "g") >= 1 },
  { id: "decks", title: "Потренируйся в колоде", how: "Колода меню или бара: пять карточек «Знаю?» или «Аллергены на скорость».", go: "menu",
    test: (x) => lifeOf(x, "m") >= 1 },
  { id: "quiz", title: "Сдай первый тест", how: "Тест в конце темы трека: проверь, что запомнилось из уроков.", go: "track",
    test: (x) => lifeOf(x, "q") >= 1 },
];
const passes = (m, x) => { try { return !!m.test(x || {}); } catch (e) { return false; } };

// ── Факты: всё, из чего считаются значки ─────────────────────────────────────
// modules — разделы роли; completed / quizDone — { id урока: true }; scores — результаты тестов
// сотрудника [{ lessonId, pct }] (годятся и строки приложения: quiz_id, score/total).
// Сверх договорённого: streakNow — текущая серия (жива, если последний день — сегодня, вчера или
// до него только выходные по графику), mistakesDue — вопросов ждут повтора, shiftToday — сегодня
// смена по графику (true / false / null — графика нет).
// role — ради единообразия вызова (разделы роли уже в modules)
export function masteryFacts({ uk = "", storage, modules = [], completed = {}, quizDone = {}, scores = [], profile = null, now = new Date() } = {}) {
  const st = ls(storage);
  const u = uk || "";
  const today = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const life = mergeLife(readLife(u, st), readActivity(u, st));   // не меньше журнала, даже если syncLife ещё не звали
  // освежения помнит и сама свежесть тем (n — сколько раз тему освежали целиком): так не теряются
  // освежённые раньше 75 дней журнала до v40
  const freshMap = obj(readJSON(st, "sa_fresh" + u, {}));
  life.u = Math.max(life.u, Object.keys(freshMap).reduce((a, k) => a + Math.floor(num(obj(freshMap[k]).n)), 0));
  const mods = arr(modules).filter((m) => m && m.id && realSteps(m).length);
  const sectionsTotal = mods.length;
  const sectionsDone = mods.filter((m) => moduleDone(m, obj(completed), obj(quizDone))).length;
  const perfect = new Set();
  arr(scores).forEach((r) => {
    if (!r || typeof r !== "object") return;
    const id = r.lessonId != null ? r.lessonId : r.quiz_id != null ? r.quiz_id : r.lesson_id != null ? r.lesson_id : r.lesson;
    const pct = r.pct != null && r.pct !== "" ? Number(r.pct) : Number(r.total) > 0 ? Math.round((Number(r.score) / Number(r.total)) * 100) : NaN;
    if (id != null && id !== "" && pct === 100) perfect.add(String(id));
  });
  const goldMap = obj(readJSON(st, "sa_gold" + u, {}));
  const gold = Object.keys(goldMap).filter((k) => goldMap[k] && typeof goldMap[k] === "object").length;
  const sk = obj(readJSON(st, "sa_streak" + u, {}));
  const streakBest = Math.floor(Math.max(num(sk.best), num(sk.count)));
  const qd = arr(readJSON(st, "sa_quest_done" + u, [])).filter(isDay);
  const skills = obj(readJSON(st, skillsKey(profile), {}));
  const hallSkills = Object.keys(skills).filter((id) => { const r = skills[id]; return !!(r && typeof r === "object" && (r.hall || r.verified)); }).length;
  const dates = [life.since, ...arr(sk.days), sk.last, ...qd].filter(isDay).sort();
  const mist = arr(readJSON(st, "sa_mistakes" + u, []));
  let shift = null;
  try { shift = profile ? myShiftOn(profile, today, st) : null; } catch (e) { shift = null; }
  return {
    life, sectionsDone, sectionsTotal, perfectTests: perfect.size, gold, streakBest, questsDone: new Set(qd).size, hallSkills,
    roleDone: sectionsTotal > 0 && sectionsDone === sectionsTotal, firstDay: dates[0] || null,
    streakNow: streakAlive(sk, today, profile, st) ? Math.floor(num(sk.count)) : 0,
    mistakesDue: mist.filter((m) => m && (!m.due || Number(m.due) <= today.getTime())).length,
    shiftToday: shift ? !shift.off : null,
  };
}

// Серия ещё жива: последний день — сегодня или вчера, или между ним и сегодня только выходные
// по графику (как в lib/streak.js nextStreak, не дольше недели)
function streakAlive(sk, now, profile, st) {
  if (!isDay(sk.last) || !num(sk.count)) return false;
  if (sk.last === ymd(now)) return true;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
  for (let i = 0; i < 8; i++) {
    const key = ymd(d);
    if (key === sk.last) return true;
    if (key < sk.last) return false;
    let off = null;
    try { off = profile ? myShiftOn(profile, new Date(d.getTime()), st) : null; } catch (e) { off = null; }
    if (!(off && off.off)) return false;
    d.setDate(d.getDate() - 1);
  }
  return false;
}

// ── Состояние семейства и всего пути ─────────────────────────────────────────
const famOf = (fam) => (typeof fam === "string" ? FAM_BY[fam] : fam && typeof fam === "object" ? fam : null);
const tiersOf = (f, x) => { const t = typeof f.tiers === "function" ? f.tiers(x) : f.tiers || (FAM_BY[f.id] && FAM_BY[f.id].tiers); return arr(typeof t === "function" ? t(x) : t).slice(0, 3).map((v) => Math.max(1, Math.floor(num(v)) || 1)); };
// value — функция фактов; у чужого объекта (например, готового familyState) — считаем по своему семейству
const valueOf = (f, x) => { try { return Math.floor(num(typeof f.value === "function" ? f.value(x) : FAM_BY[f.id] ? FAM_BY[f.id].value(x) : 0)); } catch (e) { return 0; } };

// → { id, title, icon, what, how, go, value, tiers:[b,s,g], tier: 0..3, next, left }
//   и сверх того: tierName («серебро»), from — порог текущей ступени, pct — путь до следующей (0…1)
export function familyState(fam, facts) {
  const f = famOf(fam);
  if (!f) return null;
  const x = facts || {};
  const tiers = tiersOf(f, x);
  const value = valueOf(f, x);
  let tier = 0;
  for (let i = 0; i < tiers.length; i++) { if (value >= tiers[i]) tier = i + 1; else break; }
  const next = tier < tiers.length ? tiers[tier] : null;
  const from = tier ? tiers[tier - 1] : 0;
  return {
    id: f.id, title: f.title, icon: f.icon, what: f.what, how: f.how, go: f.go, value, tiers, tier,
    next, left: next == null ? null : Math.max(0, next - value),
    tierName: TIERS[tier], from, pct: next == null ? 1 : next > from ? Math.max(0, Math.min(1, (value - from) / (next - from))) : 0,
  };
}

// → { families, bronze, total: 14, firstWeek: { items, done, total: 7, active, inWindow, daysLeft }, master }
export function masteryState(facts, role, { now } = {}) {
  const x = facts || {};
  const families = FAMILIES.map((f) => familyState(f, x));
  const bronze = families.filter((f) => f.tier >= 1).length;
  const items = FIRST_WEEK.map((m) => ({ id: m.id, title: m.title, how: m.how, go: m.go, done: passes(m, x) }));
  const done = items.filter((i) => i.done).length;
  const today = ymd(now instanceof Date && !isNaN(now.getTime()) ? now : new Date());
  const since = isDay(x.firstDay) ? Math.max(0, dayDiff(x.firstDay, today)) : null;
  const inWindow = since == null || since < FIRST_WEEK_DAYS;   // занятий ещё не было — неделя впереди
  const firstWeek = { items, done, total: items.length, active: inWindow && done < items.length, inWindow, daysLeft: inWindow ? FIRST_WEEK_DAYS - (since || 0) : 0 };
  const sTotal = Math.floor(num(x.sectionsTotal)), sDone = Math.min(Math.floor(num(x.sectionsDone)), sTotal);
  const roleDone = x.roleDone != null ? !!x.roleDone && sTotal > 0 : sTotal > 0 && sDone === sTotal;
  const gold = Math.floor(num(x.gold)), streak = Math.floor(num(x.streakBest));
  const parts = [
    { id: "role", label: "Роль пройдена", done: roleDone, value: sDone, need: sTotal },
    { id: "gold", label: MASTER_NEED.gold + " золотых тем", done: gold >= MASTER_NEED.gold, value: Math.min(gold, MASTER_NEED.gold), need: MASTER_NEED.gold },
    { id: "streak", label: "Серия " + MASTER_NEED.streak + " дней", done: streak >= MASTER_NEED.streak, value: Math.min(streak, MASTER_NEED.streak), need: MASTER_NEED.streak },
    { id: "bronze", label: "Бронза в " + MASTER_NEED.bronze + " значках", done: bronze >= MASTER_NEED.bronze, value: Math.min(bronze, MASTER_NEED.bronze), need: MASTER_NEED.bronze },
  ];
  const have = (roleDone ? 1 : 0) + (gold >= MASTER_NEED.gold ? 1 : 0) + (streak >= MASTER_NEED.streak ? 1 : 0) + Math.min(MASTER_NEED.bronze, bronze);
  const master = { role: role || null, ok: parts.every((p) => p.done), have, need: 3 + MASTER_NEED.bronze, parts };
  return { families, bronze, total: FAMILIES.length, firstWeek, master };
}

// ── Шаг дня ──────────────────────────────────────────────────────────────────
// Одно предложение на день. Порядок: 1) выдохшаяся тема → освежить; 2) задание «Первых шагов»
// (пока она открыта); 3) инструмент, которым ещё не пользовался, — «Попробуй: …»; 4) раунд мастера
// по пройденной теме; 5) семейство ближе всех к следующей ступени — «Ещё N … до серебра «…»»;
// 6) следующий урок или «Продолжи трек». Равные по важности — по очереди: от дня и сотрудника.
// faded / goldable — темы [{ id, title }] (годятся и записи fadedList: { mod }); next — следующий
// урок: { mod, lesson } (nextLessonOf) или { title }. Запоминается в sa_step<uk> на день; сделал —
// тот же шаг с done: true. → { id, text, sub, go, payload, done } и сверх того kind, fam, day.
function hash(s) { let h = 2166136261 >>> 0; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const topicList = (list) => {
  const out = [], seen = new Set();
  arr(list).forEach((t) => {
    const m = t && typeof t === "object" && t.mod && typeof t.mod === "object" ? t.mod : t;
    if (!m || typeof m !== "object" || m.id == null || m.id === "" || seen.has(String(m.id))) return;
    seen.add(String(m.id)); out.push({ id: String(m.id), title: String(m.title || m.id) });
  });
  return out;
};
function nextInfo(n) {
  if (!n || typeof n !== "object") return null;
  const lesson = n.lesson && typeof n.lesson === "object" ? n.lesson : n;
  const title = String(lesson.title || n.title || "").trim();
  if (!title) return null;
  const mod = n.mod && typeof n.mod === "object" ? n.mod.id : n.mod != null ? n.mod : n.modId;
  return { title, lesson: lesson.id != null ? String(lesson.id) : null, mod: mod != null && mod !== "" ? String(mod) : null };
}
// для «Ещё N …»: у свечи — текущая серия (ступень даёт лучшая, но дорасти можно только нынешней)
const progressOf = (fs, x) => (fs.id === "streak" ? Math.floor(num(x.streakNow)) : fs.value);

function pickStep({ x, s, faded, goldable, next, u, day, avail }) {
  const at = (key, n) => (n > 1 ? hash(day + "|" + u + "|" + key) % n : 0);
  const fs = (id) => (s.families || []).find((f) => f && f.id === id) || familyState(id, x);
  const ctx = { x, faded, goldable, next };
  // avail — что можно открыть прямо сейчас, по ключу перехода (go): { warmup: false } — разминать
  // пока нечего (нет пройденного), шаг дня туда не позовёт. Нет ключа — можно.
  const can = (f) => f.can(ctx) && !(avail && avail[f.go] === false);
  // 1) выдохшаяся тема
  if (faded.length) {
    const t = faded[at("fresh", faded.length)];
    return { id: "fresh:" + t.id, kind: "fresh", fam: "fresh", text: "Освежи тему «" + t.title + "»", sub: "3 ситуации · 1 мин, и тема снова свежая", go: "refresh", payload: { mod: t.id } };
  }
  // 2) «Первые шаги»
  const fw = s.firstWeek;
  if (fw && fw.active) {
    const open = arr(fw.items).filter((i) => i && !i.done && FIRST_WEEK.some((m) => m.id === i.id) && !(avail && avail[i.go] === false));
    if (open.length) {
      const m = FIRST_WEEK.find((q) => q.id === open[at("first", open.length)].id);
      return { id: "first:" + m.id, kind: "first", fam: null, text: m.title, sub: m.how, go: m.go, payload: null };
    }
  }
  // 3) инструмент, которым ещё не пользовался
  // (свежесть и золото — со своей темой в пунктах 1 и 4; ступень 0 при каком-то счёте — пункт 5: «Ещё N … до бронзы»)
  const untried = FAMILIES.filter((f) => f.tool && f.id !== "fresh" && f.id !== "gold" && can(f) && fs(f.id).tier === 0 && fs(f.id).value <= 0);
  if (untried.length) {
    const f = untried[at("try", untried.length)];
    return { id: "try:" + f.id, kind: "try", fam: f.id, text: "Попробуй: " + f.title, sub: f.how, go: f.go, payload: null, base: 0 };
  }
  // 4) раунд мастера
  if (goldable.length) {
    const t = goldable[at("gold", goldable.length)];
    return { id: "gold:" + t.id, kind: "gold", fam: "gold", text: "Раунд мастера: «" + t.title + "»", sub: "8 заданий → тема золотая", go: "gold", payload: { mod: t.id } };
  }
  // 5) ближе всех к следующей ступени
  const near = FAMILIES.map((f) => {
    const st = fs(f.id);
    if (!st || st.tier >= 3 || st.next == null || !can(f)) return null;
    const v = progressOf(st, x), left = Math.max(1, st.next - v);
    const pct = st.next > st.from ? Math.max(0, Math.min(1, (v - st.from) / (st.next - st.from))) : 0;
    return { f, st, v, left, pct: Math.round(pct * 1000) };
  }).filter(Boolean);
  if (near.length) {
    const best = Math.max(...near.map((c) => c.pct));
    const top = near.filter((c) => c.pct === best);
    const c = top[at("tier", top.length)];
    return { id: "tier:" + c.f.id, kind: "tier", fam: c.f.id,
      text: "Ещё " + c.left + " " + plural(c.left, ...c.f.unit) + " до " + TIERS_OF[c.st.tier + 1] + " «" + c.f.title + "»",
      sub: c.f.how, go: c.f.go, payload: null, base: c.v };
  }
  // 6) трек
  const nx = nextInfo(next);
  if (nx) return { id: "next:" + (nx.lesson || nx.title), kind: "next", fam: "track", text: "Следующий шаг: «" + nx.title + "»", sub: "Продолжи трек с того места, где остановился.", go: "track",
    payload: { mod: nx.mod, lesson: nx.lesson }, base: lifeOf(x, "st") };
  return { id: "track", kind: "track", fam: "track", text: "Продолжи трек", sub: "Открой трек и выбери тему, которую хочется повторить.", go: "track", payload: null, base: lifeOf(x, "st") };
}

// Сделан ли шаг: свой признак у каждого вида
function stepDone(rec, { x, st, u }) {
  const id = String(rec.id || ""), tail = id.slice(id.indexOf(":") + 1);
  switch (rec.kind) {
    case "fresh": { const r = obj(obj(readJSON(st, "sa_fresh" + u, {}))[tail]); return num(r.t) > num(rec.at); }
    case "first": { const m = FIRST_WEEK.find((q) => q.id === tail); return !!m && passes(m, x); }
    case "try": return valueOf(FAM_BY[rec.fam] || {}, x) > num(rec.base);
    case "gold": { const g = obj(readJSON(st, "sa_gold" + u, {}))[tail]; return !!(g && typeof g === "object"); }
    case "tier": { const fsx = familyState(rec.fam, x); return !!fsx && progressOf(fsx, x) > num(rec.base); }
    case "next": {
      const l = rec.payload && rec.payload.lesson;
      if (l) return !!(obj(readJSON(st, "sa_completed" + u, {}))[l] || obj(readJSON(st, "sa_quiz_done" + u, {}))[l]);
      return lifeOf(x, "st") > num(rec.base);
    }
    default: return lifeOf(x, "st") > num(rec.base);
  }
}

const stepView = (r, done) => ({ id: r.id, text: r.text, sub: r.sub || "", go: r.go || "track", payload: r.payload || null, done: !!done, kind: r.kind || "track", fam: r.fam || null, day: r.day });

export function stepOfDay({ state, facts, faded = [], goldable = [], next = null, uk = "", storage, day, avail = null, role } = {}) {
  const st = ls(storage);
  const u = uk || "";
  const d = isDay(day) ? day : ymd(new Date());
  const x = facts || {};
  const s = state && Array.isArray(state.families) ? state : masteryState(x, null);
  const saved = obj(readJSON(st, STEP_KEY + u, null));
  // сменил роль в тот же день — шаг выбирается заново: тема и урок прежнего шага — из другой роли
  // (запись без роли — старая, до этой проверки: считаем своей)
  const sameRole = role === undefined || saved.role === undefined || (saved.role || null) === (role || null);
  if (saved.day === d && saved.id && saved.text && sameRole) return stepView(saved, stepDone(saved, { x, st, u }));
  const pick = pickStep({ x, s, faded: topicList(faded), goldable: topicList(goldable), next, u, day: d, avail: obj(avail) });
  const rec = { day: d, ...pick, at: Date.now(), ...(role === undefined ? {} : { role: role || null }) };
  writeJSON(st, STEP_KEY + u, rec);
  return stepView(rec, stepDone(rec, { x, st, u }));
}

// Шаг дня одной строкой для напоминания бота («Шаг дня: …») и Наставника: со строчной буквы и без
// «Попробуй:» / «Следующий шаг:» перед кавычками — «Шаг дня: попробуй «Радио в дорогу»»
export function stepLineText(step) {
  if (!step || !step.text) return "";
  let t = String(step.text).replace(/\s+/g, " ").trim();
  const m = t.match(/^Попробуй: (.+)$/);
  if (m) t = "попробуй «" + m[1] + "»";
  else if (/^Следующий шаг: /.test(t)) t = "урок " + t.replace(/^Следующий шаг: /, "");
  else if (/^Раунд мастера: /.test(t)) t = "раунд мастера по теме " + t.replace(/^Раунд мастера: /, "");
  else if (t === "Продолжи трек") t = "продолжи трек";
  else t = t.charAt(0).toLowerCase() + t.slice(1);
  return t;
}

// ── Что уже отпраздновали ─────────────────────────────────────────────────────
// sa_mastery<uk> = { tiers: { [семейство]: ступень }, fw: bool, master: { [роль]: "ГГГГ-ММ-ДД" } }.
// Записи ещё нет — readEarned отдаёт и first: true: экран может молча запомнить то, что человек
// заработал до v40, вместо десятка поздравлений разом.
function normEarned(v) {
  const o = obj(v);
  const tiers = {};
  Object.keys(obj(o.tiers)).forEach((k) => { const t = Math.floor(num(o.tiers[k])); if (FAM_IDS.has(k) && t >= 1) tiers[k] = Math.min(3, t); });
  const master = {};
  Object.keys(obj(o.master)).forEach((r) => { const dd = o.master[r]; if (r && dd) master[r] = isDay(dd) ? dd : String(dd).slice(0, 10); });
  return { tiers, fw: !!o.fw, master };
}
export function readEarned(uk, storage) {
  const raw = readJSON(ls(storage), EARNED_KEY + (uk || ""), null);
  const e = normEarned(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) e.first = true;
  return e;
}
export function saveEarned(uk, data, storage) {
  const e = normEarned(data);
  writeJSON(ls(storage), EARNED_KEY + (uk || ""), e);
  return e;
}

// Новое со времени прошлого праздника (earned не меняется). Порядок: «Мастер роли», «Первая
// неделя», ступени — золото первым. Неделя засчитывается, пока она открыта (inWindow).
export function newlyEarned(state, earned) {
  const e = normEarned(earned);
  const out = [];
  const m = state && state.master;
  if (m && m.ok && m.role && !e.master[m.role]) out.push({ kind: "master", role: m.role });
  const fw = state && state.firstWeek;
  if (fw && fw.total && fw.done >= fw.total && fw.inWindow !== false && !e.fw) out.push({ kind: "firstWeek" });
  arr(state && state.families).filter((f) => f && FAM_IDS.has(f.id) && (f.tier | 0) > (e.tiers[f.id] || 0))
    .sort((a, b) => b.tier - a.tier)
    .forEach((f) => out.push({ kind: "tier", id: f.id, title: f.title, tier: Math.min(3, f.tier | 0) }));
  return out;
}

// Отметить отпразднованное: новая запись для saveEarned (earned не меняется)
export function mergeEarned(earned, news, day = ymd(new Date())) {
  const e = normEarned(earned);
  arr(news).forEach((n) => {
    if (!n) return;
    if (n.kind === "tier" && FAM_IDS.has(n.id)) e.tiers[n.id] = Math.max(e.tiers[n.id] || 0, Math.min(3, n.tier | 0));
    else if (n.kind === "firstWeek") e.fw = true;
    else if (n.kind === "master" && n.role && !e.master[n.role]) e.master[n.role] = isDay(day) ? day : ymd(new Date());
  });
  return e;
}

// ── Итог для копии на сервер (отчёт руководителя) ────────────────────────────
// sa_mastery_sum<uk> = { tiers: { [семейство]: ступень ≥ 1 }, vals: { [семейство]: сколько > 0 }, bronze, fw,
//   master: [роли], step: { day, t } }. Значки не отнимаются: ступень — большая из нынешней и
// отпразднованной, «Мастер роли» остаётся и после смены роли.
export function saveSummary(uk, state, step, storage) {
  const st = ls(storage);
  const u = uk || "";
  const e = normEarned(readJSON(st, EARNED_KEY + u, null));
  const prev = obj(readJSON(st, SUM_KEY + u, null));
  const tiers = {}, vals = {};
  arr(state && state.families).forEach((f) => {
    if (!f || !FAM_IDS.has(f.id)) return;
    const t = Math.min(3, Math.max(f.tier | 0, e.tiers[f.id] || 0));
    if (t > 0) tiers[f.id] = t;
    const v = Math.floor(num(f.value));
    if (v > 0) vals[f.id] = v;
  });
  Object.keys(e.tiers).forEach((k) => { if (!tiers[k]) tiers[k] = e.tiers[k]; });
  const fw0 = state && state.firstWeek;
  const fw = !!(fw0 && fw0.total && fw0.done >= fw0.total && fw0.inWindow !== false) || e.fw || !!prev.fw;
  const m = state && state.master;
  const master = [...new Set([...arr(prev.master), ...Object.keys(e.master), ...(m && m.ok && m.role ? [m.role] : [])])]
    .filter((r) => typeof r === "string" && r).slice(0, 12);
  const sum = { tiers, vals, bronze: Object.keys(tiers).length, fw, master };
  if (step && step.text) sum.step = { day: isDay(step.day) ? step.day : ymd(new Date()), t: String(step.text).slice(0, 160) };
  writeJSON(st, SUM_KEY + u, sum);
  return sum;
}
export function readSummary(uk, storage) { const v = readJSON(ls(storage), SUM_KEY + (uk || ""), null); return v && typeof v === "object" && !Array.isArray(v) ? v : null; }

// ── Для отчёта руководителя: из копии с телефона (learning.mastery, lib/learning-sync.js) ──
// null — копия старая, без «Пути мастера». «Не пользуется» — семейства без ступени, которыми
// не пользовались ни разу: по счётчику за всё время (и журналу дня), а свежесть, золото, свеча,
// квест и навыки — ещё и по самой копии.
export function masteryFromCopy(learning) {
  const L = obj(learning);
  const ms = L.mastery;
  if (!ms || typeof ms !== "object" || Array.isArray(ms)) return null;
  const life = mergeLife(ms.life, obj(L.activity));
  const tiers = obj(ms.tiers), vals = obj(ms.vals);
  const skills = obj(L.skills);
  const fresh = obj(L.fresh);
  const derived = {
    fresh: Object.keys(fresh).reduce((a, k) => a + num(obj(fresh[k]).n), 0),
    gold: Object.keys(obj(L.gold)).length, streak: num(obj(L.streak).best), quest: arr(L.quests).length,
    hall: Object.keys(skills).filter((k) => { const r = skills[k]; return !!(r && (r.hall || r.pin)); }).length,
  };
  const families = FAMILIES.map((f) => {
    const tier = Math.min(3, Math.floor(num(tiers[f.id])));
    return { id: f.id, title: f.title, tier, tierName: TIERS[tier], value: vals[f.id] != null ? Math.floor(num(vals[f.id])) : null };
  });
  const used = (f, i) => Math.max(num(families[i].value), f.life ? num(life[f.life]) : 0, num(derived[f.id]));
  const unused = FAMILIES.filter((f, i) => families[i].tier === 0 && used(f, i) === 0).map((f) => f.title);
  const badges = families.filter((f) => f.tier >= 1).sort((a, b) => b.tier - a.tier);
  const step = obj(ms.step);
  return {
    families, badges, bronze: Math.max(badges.length, Math.min(FAMILIES.length, Math.floor(num(ms.bronze)))), total: FAMILIES.length,
    master: arr(ms.master).filter((r) => typeof r === "string" && r).slice(0, 12), unused, fw: !!ms.fw,
    step: step.t ? { day: isDay(step.day) ? step.day : "", t: String(step.t).slice(0, 160) } : null, since: life.since || "",
  };
}

// ── v40: «новое» у инструментов, которыми ещё не пользовались ────────────────
// sa_tools_seen<uk> = { [ключ]: "ГГГГ-ММ-ДД" } — когда человек впервые открыл инструмент (ключ —
// id семейства или "mastery" для самого «Пути мастера»). «Новое» — инструмент-семейство (tool),
// у которого нет ни ступени, ни счёта и который ещё не открывали.
export function readSeen(uk, storage) { return obj(readJSON(ls(storage), SEEN_KEY + (uk || ""), {})); }
export function markSeen(uk, id, storage, day = ymd(new Date())) {
  if (!id) return readSeen(uk, storage);
  const st = ls(storage);
  const cur = readSeen(uk, st);
  if (cur[id]) return cur;
  const next = { ...cur, [id]: isDay(day) ? day : ymd(new Date()) };
  writeJSON(st, SEEN_KEY + (uk || ""), next);
  return next;
}
// fs — familyState (или его id и факты не нужны: смотрим только ступень и счёт)
export function isNewTool(fs, seen) {
  if (!fs || !fs.id) return false;
  const f = FAM_BY[fs.id];
  return !!(f && f.tool && !(fs.tier > 0) && !(Number(fs.value) > 0) && !obj(seen)[fs.id]);
}
// ids семейств с отметкой «новое»
export function newTools(state, seen) { return new Set(arr(state && state.families).filter((f) => isNewTool(f, seen)).map((f) => f.id)); }

// ── v40: мастера заведения (этап 26: mastery_list) ───────────────────────────
// Названия ролей — как в приложении (data/roles.js) и в сообщении бота (этап 26: _sa_role_title).
export const ROLE_TITLE = ROLE_LABEL;   // v59: названия ролей — из data/roles.js
// Ключ человека: слова имени без порядка и регистра, ё = е («Заяц Екатерина» = «Екатерина Заяц») —
// рейтинг хранит имя, как его записал сам человек, а список мастеров — как в «Команде»
export function masterKey(name, surname) {
  return String((name || "") + " " + (surname || "")).toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean).sort().join(" ");
}
// rows: [{ who: "Имя Фамилия", name, role, at, me }] → Map: ключ → [роли]
export function mastersIndex(rows) {
  const m = new Map();
  arr(rows).forEach((r) => {
    if (!r || typeof r !== "object" || !r.role) return;
    const k = masterKey(r.who || r.name || "", "");
    if (!k) return;
    const list = m.get(k) || [];
    if (!list.includes(r.role)) list.push(r.role);
    m.set(k, list);
  });
  return m;
}
// Роли мастера у человека (или null): index — mastersIndex(...)
export function masterRolesOf(index, name, surname) {
  if (!index || typeof index.get !== "function") return null;
  const list = index.get(masterKey(name, surname));
  return list && list.length ? list : null;
}
// «Мастер роли «Ядро» ✦» — подпись знака у имени
export function masterTitle(roles) {
  const list = arr(roles).map((r) => ROLE_TITLE[r] || "").filter(Boolean);
  if (!list.length) return "Мастер роли";
  return list.length === 1 ? "Мастер роли «" + list[0] + "»" : "Мастер ролей " + list.map((t) => "«" + t + "»").join(", ");
}

// ── v40: новый телефон или очищенный Telegram — «Путь мастера» из копии на сервере ──────
// ms — learning.mastery из копии (этап 23: report_person — своя карточка; формат — lib/learning-sync.js):
// { life: {буквы, since}, tiers: {семейство: ступень}, fw, master: [роли] }. Счётчики — большее из
// телефона и копии, первый день — самый ранний; отпразднованное — объединение (значки не отнимаются,
// повторных поздравлений нет). → true, если что-то записали.
export function restoreFromCopy(uk, ms, storage, day = ymd(new Date())) {
  if (!ms || typeof ms !== "object" || Array.isArray(ms)) return false;
  const st = ls(storage);
  const u = uk || "";
  let changed = false;
  if (ms.life && typeof ms.life === "object") {
    const cur = readLife(u, st), srv = mergeLife(ms.life, {});
    const next = { ...cur };
    ACTIVITY_FIELDS.forEach((f) => { next[f] = Math.max(num(cur[f]), num(srv[f])); });
    next.since = [cur.since, srv.since].filter(isDay).sort()[0] || "";
    if (JSON.stringify(next) !== JSON.stringify(cur)) { writeJSON(st, "sa_life" + u, next); changed = true; }
  }
  const raw = readJSON(st, EARNED_KEY + u, null);
  const e = normEarned(raw);
  const before = JSON.stringify(e);
  const tiers = obj(ms.tiers);
  Object.keys(tiers).forEach((k) => { const t = Math.min(3, Math.floor(num(tiers[k]))); if (FAM_IDS.has(k) && t > (e.tiers[k] || 0)) e.tiers[k] = t; });
  if (ms.fw) e.fw = true;
  arr(ms.master).forEach((r) => { if (typeof r === "string" && r && !e.master[r]) e.master[r] = isDay(day) ? day : ymd(new Date()); });
  if (JSON.stringify(e) !== before || (!raw && (Object.keys(e.tiers).length || e.fw || Object.keys(e.master).length))) { writeJSON(st, EARNED_KEY + u, e); changed = true; }
  return changed;
}
