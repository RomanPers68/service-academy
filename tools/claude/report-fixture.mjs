// Тестовые данные отчёта: как ответ report_team с двумя сотрудниками
const SRC = "/home/claude/work/service-academy";
export const { MODULES_INDEX } = await import(SRC + "/data/modules-index.js");
export const { ROLES } = await import(SRC + "/data/roles.js");
export const { ROLE_SKILLS } = await import(SRC + "/data/skills.js");
const now = new Date();
const iso = (d) => new Date(now.getTime() - d * 86400000).toISOString();
const ymd = (d) => { const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const act = {}; [0, 1, 2, 4, 5, 8, 11, 13].forEach((d, i) => { act[ymd(d)] = { st: 1 + (i % 3), w: i % 2, f: i % 2 ? 2 : 0 }; });
export const anna = {
  person: { id: "a4", name: "Анна", surname: "Смирнова", restaurant: "Два моря, Океан", position: "waiter", is_admin: false, status: "active" },
  lessons: ["s0-1", "s0-2", "s0-3", "s0-4", "s0-p", "s1-1", "s1-2"], quiz: ["s0-q"], roles: [], last_role: "seasonal", stars: { "s0-p": 3, "s1-p": 1 },
  scores: [{ name: "Анна", surname: "Смирнова", quiz_id: "s0-q", score: 9, total: 12, updated_at: iso(3) }, { quiz_id: "s1-q", score: 5, total: 10, updated_at: iso(1) }],
  events: [
    { lesson_id: "s0-q", question: "Гость спрашивает о составе блюда, а ты не знаешь. Что делать?", correct: false, answer: "Сказать «кажется, без орехов»", right_answer: "Уточнить у шефа и вернуться с ответом", ts: iso(5) },
    { lesson_id: "s0-q", question: "Гость спрашивает о составе блюда, а ты не знаешь. Что делать?", correct: true, answer: "Уточнить у шефа и вернуться с ответом", right_answer: "Уточнить у шефа и вернуться с ответом", ts: iso(2) },
    { lesson_id: "s1-q", question: "С какой стороны подходить к столу?", correct: false, answer: "Сзади гостя", right_answer: "Со стороны гостя, в поле зрения", ts: iso(1) },
    { lesson_id: "s1-q", question: "С какой стороны подходить к столу?", correct: false, answer: "Сзади гостя", right_answer: "Со стороны гостя, в поле зрения", ts: iso(0.5) },
    { lesson_id: "s1-q", question: "Что важнее при встрече гостя?", correct: false, answer: "Сразу предложить меню", right_answer: "Контакт глазами и приветствие в первые 10 секунд", ts: iso(0.4) },
    { lesson_id: "s1-q", question: "Сколько секунд до первого контакта?", correct: true, answer: "10", right_answer: "10", ts: iso(0.3) },
  ],
  skips: [], menu: [],
  skills: [{ role_id: "seasonal", skill_id: "sea1", skill_label: "Встреча и приветствие", status: "approved", mentor_name: "Мария Ким", decided_at: iso(1) },
           { role_id: "seasonal", skill_id: "sea4", skill_label: "Вопрос об аллергиях", status: "pending", created_at: iso(0.2) }],
  learning: {
    v: 1, goal: 2, weekly: 1, warm: ymd(0),
    mistakes: [{ q: "Какой аллерген в соусе «Цезарь»?", a: "Анчоусы и яйцо", l: "s0-q", st: 0, due: now.getTime() - 1000 },
               { q: "Что сказать гостю, если блюдо задерживается?", a: "Предупредить заранее и предложить комплимент от кухни по согласованию", l: "s1-q", st: 1, due: now.getTime() - 5000 },
               { q: "Когда спрашивать об аллергиях?", a: "До отправки заказа на кухню", l: "s0-q", st: 2, due: now.getTime() + 3 * 86400000 }],
    exams: {}, streak: { count: 4, best: 6, last: ymd(0) }, activity: act,
    skills: { sea2: { by: "Пётр Иванов", date: ymd(3), hall: false, pin: true } },
    // v30
    guests: [{ d: ymd(2), s: 4, p: "rush", ai: true, fix: "Не спросил про аллергии до заказа" }, { d: ymd(9), s: 3, p: "late", ai: false }],
    credits: { s1: { d: ymd(5), s: 7, t: 7 } }, gold: { s0: { d: ymd(1), w: 0, sec: 61 } },
    fresh: { s0: { t: now.getTime() - 1 * 86400000, n: 2 }, s1: { t: now.getTime() - 20 * 86400000, n: 0 } }, quests: [ymd(0), ymd(3)],
  },
  learning_at: iso(0.1), tg: true, seen: iso(0.1),
};
export const ivan = {
  person: { id: "b2", name: "Иван", surname: "Петров", restaurant: "Два моря, Океан", position: "bartender", is_admin: false, status: "active" },
  lessons: ["bar0-1", "bar0-2"], quiz: [], roles: [], last_role: "bar", stars: {}, scores: [], events: [], skips: [], menu: [], skills: [],
  learning: {}, learning_at: null, tg: false, seen: iso(12),
};
export const team = { scope: "restaurant", restaurant: "Два моря, Океан", people: [anna, ivan] };
export const skillLabel = (id) => { for (const r of Object.keys(ROLE_SKILLS)) { const s = (ROLE_SKILLS[r] || []).find((x) => x.id === id); if (s) return s.label; } return ""; };
export const ctx = { index: MODULES_INDEX, roles: ROLES, skillLabel, now };
