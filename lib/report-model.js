// lib/report-model.js — Доп. 309: отчёт по сотруднику для руководителя.
// Из того, что вернул сервер (этап 23: report_person / report_team), собирает понятную
// картину: что пройдено и что нет, где ошибается (что выбрал и как верно), с чем работать,
// что ждёт повтора, навыки в зале, дни занятий. Одна модель — для экрана, PDF и Excel.
// Чистые функции без React и без браузера: работают и в приложении, и на сервере.

import { freshOf } from "./freshness.js";   // v30: свежесть тем (Доп. 313)
import { masteryFromCopy } from "./mastery.js";   // v40: «Путь мастера»
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MON3 = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export const POSITION_LABEL = {
  waiter: "Официант", hostess: "Хостес", bartender: "Бармен", senior_bartender: "Старший бармен",
  manager: "Менеджер", senior: "Руководящий состав", owner: "Владелец", admin: "Владелец",
};
const POS_TRACK = { waiter: "seasonal", hostess: "spg", bartender: "bar", senior_bartender: "bar", manager: "manager", senior: "service_manager" };
const KIND_LABEL = { lesson: "урок", quiz: "тест", practice: "практика", dialogue: "диалог", build: "сборка" };

const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; };
export const pl = plural;
const pad = (n) => String(n).padStart(2, "0");
const toDate = (v) => { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? null : d; };
const ymdOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const dateLabel = (v, withYear = false) => { const d = toDate(v); if (!d) return ""; return d.getDate() + " " + MONTHS[d.getMonth()] + (withYear ? " " + d.getFullYear() : ""); };
export const shortDate = (v) => { const d = toDate(v); return d ? pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() : ""; };
export const stampLabel = (v) => { const d = toDate(v); return d ? dateLabel(d, true) + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : ""; };
const dayDiff = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
export function agoLabel(v, now = new Date()) {
  const d = toDate(v); if (!d) return "ещё не занимался";
  const n = dayDiff(d, now);
  if (n <= 0) return "сегодня";
  if (n === 1) return "вчера";
  if (n < 7) return n + " " + plural(n, "день", "дня", "дней") + " назад";
  if (n < 60) { const w = Math.round(n / 7); return w + " " + plural(w, "неделю", "недели", "недель") + " назад"; }
  return dateLabel(d, d.getFullYear() !== now.getFullYear());
}

// ── Справочник шагов: номер шага → название, тип, тема, трек ─────────────────
export function stepIndex(index, customByRole = {}) {
  const map = {};
  const tracks = {};
  const add = (track, mods, custom) => {
    (mods || []).forEach((m, mi) => {
      const steps = (m.lessons || []).filter((l) => l && l.type !== "result");
      steps.forEach((l, li) => { map[l.id] = { id: l.id, title: l.title || l.id, type: l.type || "lesson", topic: m.title || "", topicId: m.id, track, mi, li, custom: !!custom }; });
      (tracks[track] = tracks[track] || []).push({ id: m.id, title: m.title || "", custom: !!custom, steps: steps.map((l) => ({ id: l.id, title: l.title || l.id, type: l.type || "lesson" })) });
    });
  };
  Object.keys(index || {}).forEach((t) => add(t, index[t], false));
  Object.keys(customByRole || {}).forEach((t) => add(t, customByRole[t], true));
  return { map, tracks };
}

const scoreRow = (r) => {
  if (!r || typeof r !== "object") return null;
  const id = r.quiz_id || r.lesson_id || r.quiz || r.test_id || r.lesson || null;
  const score = Number(r.score != null ? r.score : r.correct) || 0;
  const total = Number(r.total != null ? r.total : r.max) || 0;
  const date = r.updated_at || r.created_at || r.ts || r.date || null;
  return id ? { id: String(id), score, total, date, role: r.role || r.role_id || null } : null;
};

// ── Модель одного сотрудника ─────────────────────────────────────────────────
export function personModel(raw, ctx = {}) {
  const now = ctx.now ? toDate(ctx.now) : new Date();
  const roles = ctx.roles || [];
  const roleOf = (id) => roles.find((r) => r.id === id) || { id, label: id, color: "#C8A96E" };
  const idx = ctx.steps || stepIndex(ctx.index || {}, ctx.customByRole || {});
  const info = (id) => idx.map[id] || null;
  const skillLabel = ctx.skillLabel || (() => "");
  const p = (raw && raw.person) || {};
  const learning = (raw && raw.learning && typeof raw.learning === "object") ? raw.learning : {};
  const lessons = new Set((raw && raw.lessons) || []);
  const quizDone = new Set((raw && raw.quiz) || []);
  const isDone = (s) => (s.type === "quiz" ? quizDone.has(s.id) : lessons.has(s.id));
  const exams = learning.exams && typeof learning.exams === "object" ? learning.exams : {};

  // треки: где начал, где экзамен, главный — последний открытый или по должности
  const trackIds = Object.keys(idx.tracks);
  const tr = trackIds.map((t) => {
    const steps = idx.tracks[t].flatMap((m) => m.steps);
    const done = steps.filter(isDone).length;
    const quizzes = steps.filter((s) => s.type === "quiz");
    const ex = exams[t] || null;
    const r = roleOf(t);
    return { id: t, label: r.label || t, color: r.color || "#C8A96E", done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0,
      quizDone: quizzes.filter(isDone).length, quizTotal: quizzes.length,
      exam: ex ? { passed: !!ex.passed, score: Number(ex.score) || 0, date: ex.date || "" } : null };
  });
  let mainId = raw && raw.last_role && idx.tracks[raw.last_role] ? raw.last_role : null;
  if (!mainId) { const best = tr.filter((t) => t.done > 0).sort((a, b) => b.done - a.done)[0]; mainId = best ? best.id : (POS_TRACK[p.position] || "seasonal"); }
  if (!idx.tracks[mainId]) mainId = trackIds[0] || null;
  const tracks = tr.filter((t) => t.done > 0 || t.exam || t.id === mainId).map((t) => ({ ...t, main: t.id === mainId }))
    .sort((a, b) => (b.main - a.main) || (b.pct - a.pct));
  const main = tracks.find((t) => t.main) || null;

  // что не пройдено в главном треке: темы с оставшимися шагами
  let notDone = { left: 0, modules: [] };
  if (mainId && idx.tracks[mainId]) {
    const mods = idx.tracks[mainId].map((m) => ({ title: m.title, custom: m.custom, steps: m.steps.filter((s) => !isDone(s)).map((s) => ({ title: s.title, type: s.type, kind: KIND_LABEL[s.type] || "урок" })) }))
      .filter((m) => m.steps.length);
    notDone = { left: mods.reduce((a, m) => a + m.steps.length, 0), modules: mods };
  }
  const nextStep = notDone.modules.length ? { ...notDone.modules[0].steps[0], topic: notDone.modules[0].title } : null;
  if (main) main.next = nextStep;

  // тесты: результаты с названиями
  const rows = ((raw && raw.scores) || []).map(scoreRow).filter(Boolean);
  const bestById = new Map();
  rows.forEach((r) => {
    const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
    const cur = bestById.get(r.id);
    if (!cur || pct > cur.pct || (pct === cur.pct && String(r.date || "") > String(cur.date || ""))) bestById.set(r.id, { ...r, pct });
  });
  const testList = [...bestById.values()].map((r) => { const i = info(r.id); return { id: r.id, title: (i && i.title) || r.id, topic: (i && i.topic) || "", track: (i && i.track) || r.role || "", score: r.score, total: r.total, pct: r.pct, date: r.date }; })
    .sort((a, b) => a.pct - b.pct);
  const avg = testList.length ? Math.round(testList.reduce((a, t) => a + t.pct, 0) / testList.length) : null;

  // ответы с ошибками: по вопросу — сколько раз, что выбрал, как верно, исправил ли потом
  const events = ((raw && raw.events) || []).filter((e) => e && e.question);
  const byQ = new Map();
  events.slice().sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || ""))).forEach((e) => {
    const k = String(e.question);
    const g = byQ.get(k) || { q: k, lessonId: e.lesson_id || e.lesson || "", wrong: 0, total: 0, chosen: "", right: "", last: null, lastOk: false };
    g.total++;
    if (e.correct === false || e.correct === "false" || e.correct === 0) { g.wrong++; if (e.answer) g.chosen = String(e.answer); g.last = e.ts || g.last; g.lastOk = false; }
    else g.lastOk = true;
    if (e.right_answer) g.right = String(e.right_answer);
    byQ.set(k, g);
  });
  const wrongAll = [...byQ.values()].filter((g) => g.wrong > 0).map((g) => {
    const i = info(g.lessonId);
    return { q: g.q, topic: (i && i.topic) || (i && i.title) || "", track: (i && i.track) || "", chosen: g.chosen, right: g.right, wrong: g.wrong, total: g.total, last: g.last, fixed: g.lastOk };
  }).sort((a, b) => (a.fixed - b.fixed) || (b.wrong - a.wrong) || String(b.last || "").localeCompare(String(a.last || "")));
  const t30 = now.getTime() - 30 * 86400000;
  const wrongEvents = events.filter((e) => e.correct === false || e.correct === "false" || e.correct === 0);
  const wrong30 = wrongEvents.filter((e) => { const d = toDate(e.ts); return d && d.getTime() >= t30; }).length;

  // банк ошибок с телефона: что ждёт повтора
  const nowMs = now.getTime();
  const mist = Array.isArray(learning.mistakes) ? learning.mistakes : [];
  const mistItems = mist.map((m) => { const i = info(m.l); return { q: m.q, a: m.a || "", topic: m.t || (i && i.topic) || "", track: (i && i.track) || "", stage: Number(m.st) || 0, due: Number(m.due) || 0, isDue: !m.due || Number(m.due) <= nowMs }; });
  const repeat = { total: mistItems.length, due: mistItems.filter((m) => m.isDue).length,
    list: mistItems.slice().sort((a, b) => (b.isDue - a.isDue) || (a.stage - b.stage)).slice(0, 25) };

  // с чем работать: темы с долей ошибок + ошибки из банка + слабая практика
  const topicAgg = new Map();
  const bump = (topic, track, f, n = 1) => { if (!topic) return; const k = track + "|" + topic; const g = topicAgg.get(k) || { topic, track, wrong: 0, total: 0, mist: 0, low: 0 }; g[f] += n; topicAgg.set(k, g); };
  events.forEach((e) => { const i = info(e.lesson_id || e.lesson); if (!i) return; bump(i.topic, i.track, "total"); if (e.correct === false || e.correct === "false" || e.correct === 0) bump(i.topic, i.track, "wrong"); });
  mistItems.forEach((m) => bump(m.topic, m.track, "mist"));
  const stars = (raw && raw.stars) || {};
  const practice = Object.keys(stars).map((id) => { const i = info(id); return { id, title: (i && i.title) || id, topic: (i && i.topic) || "", track: (i && i.track) || "", stars: Number(stars[id]) || 0 }; })
    .sort((a, b) => a.stars - b.stars);
  practice.filter((x) => x.stars <= 1).forEach((x) => bump(x.topic, x.track, "low"));
  const weak = [...topicAgg.values()].map((g) => ({ ...g, rate: g.total ? Math.round((g.wrong / g.total) * 100) : 0, score: g.wrong * 2 + g.mist + g.low * 2 + (g.total ? (g.wrong / g.total) * 4 : 0) }))
    .filter((g) => g.wrong + g.mist + g.low > 0).sort((a, b) => b.score - a.score).slice(0, 6)
    .map((g) => ({ ...g, why: [g.wrong ? g.wrong + " " + plural(g.wrong, "ошибка", "ошибки", "ошибок") + " в тестах" + (g.total ? " (" + g.rate + "% ответов)" : "") : "", g.mist ? g.mist + " на повторе" : "", g.low ? "слабая практика" : ""].filter(Boolean).join(" · ") }));

  // навыки: подтверждения в зале (сервер) + по PIN (телефон)
  const skillMap = new Map();
  ((raw && raw.skills) || []).forEach((s) => {
    const k = s.skill_id || s.skill_label;
    if (skillMap.has(k)) return;   // свежие первыми
    skillMap.set(k, { id: s.skill_id, label: s.skill_label || skillLabel(s.skill_id) || s.skill_id, status: s.status === "approved" ? "hall" : s.status, by: s.mentor_name || "", date: s.decided_at || s.created_at || "", note: s.note || "" });
  });
  const localSk = learning.skills && typeof learning.skills === "object" ? learning.skills : {};
  Object.keys(localSk).forEach((id) => {
    const r = localSk[id] || {};
    const cur = skillMap.get(id);
    if (cur && cur.status === "hall") return;
    skillMap.set(id, { id, label: skillLabel(id) || r.label || (cur && cur.label) || id, status: r.hall ? "hall" : "pin", by: r.by || "", date: r.date || "", note: "" });
  });
  const skillList = [...skillMap.values()].sort((a, b) => ["hall", "pin", "pending", "declined"].indexOf(a.status) - ["hall", "pin", "pending", "declined"].indexOf(b.status));
  const skills = { confirmed: skillList.filter((s) => s.status === "hall" || s.status === "pin").length, pending: skillList.filter((s) => s.status === "pending").length, list: skillList };

  // дни занятий: 14 дней, разминки и шаги за 30
  const act = learning.activity && typeof learning.activity === "object" ? learning.activity : {};
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const r = act[ymdOf(d)] || {};
    days.push({ day: ymdOf(d), label: WD[d.getDay()], date: d.getDate(), steps: Number(r.st) || 0, warm: Number(r.w) || 0, fix: Number(r.f) || 0, other: (Number(r.m) || 0) + (Number(r.s) || 0) });
  }
  let steps30 = 0, warm30 = 0, active30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const r = act[ymdOf(d)] || {};
    const s = Number(r.st) || 0; steps30 += s; warm30 += Number(r.w) || 0;
    if (s + (Number(r.f) || 0) + (Number(r.m) || 0) > 0) active30++;
  }
  const streak = learning.streak && typeof learning.streak === "object" ? { count: Number(learning.streak.count) || 0, best: Number(learning.streak.best) || 0, last: learning.streak.last || "" } : { count: 0, best: 0, last: "" };
  const activity = { days, active14: days.filter((d) => d.steps + d.fix + d.other > 0).length, steps30, warm30, active30, streak, goal: Number(learning.goal) || 2, weekly: Number(learning.weekly) || 0 };

  const examList = Object.keys(exams).map((t) => ({ track: t, label: roleOf(t).label || t, passed: !!(exams[t] && exams[t].passed), score: Number(exams[t] && exams[t].score) || 0, date: (exams[t] && exams[t].date) || "" }));

  // v30: живой гость, зачёты на опыт, золотые темы, свежесть, квесты смены (копия с телефона)
  const modTitle = {};
  Object.keys(idx.tracks || {}).forEach((t) => (idx.tracks[t] || []).forEach((md) => { modTitle[md.id] = md.title; }));
  const gl = Array.isArray(learning.guests) ? learning.guests : [];
  const g30 = gl.filter((g) => { const d = toDate(g && g.d); return d && d.getTime() >= t30; });
  const guests = { n30: g30.length, total: gl.length, avg: g30.length ? Math.round((g30.reduce((a, g) => a + (Number(g.s) || 0), 0) / g30.length) * 10) / 10 : null,
    best: g30.reduce((a, g) => Math.max(a, Number(g.s) || 0), 0), ai: g30.filter((g) => g.ai).length, lastFix: (gl.slice().reverse().find((g) => g && g.fix) || {}).fix || "" };
  const marksOf = (o) => Object.keys(o && typeof o === "object" ? o : {}).map((id) => ({ id, title: modTitle[id] || id, ...(o[id] || {}) }));
  const credits = marksOf(learning.credits);
  const gold = marksOf(learning.gold);
  const freshRecs = Object.keys(learning.fresh && typeof learning.fresh === "object" ? learning.fresh : {}).map((id) => ({ id, title: modTitle[id] || id, f: freshOf(learning.fresh[id], now.getTime()) })).filter((x) => x.f);
  const fading = freshRecs.filter((x) => x.f.level !== "fresh").sort((a, b) => a.f.k - b.f.k);
  const quests30 = (Array.isArray(learning.quests) ? learning.quests : []).filter((d) => { const x = toDate(d); return x && x.getTime() >= t30; }).length;
  const practiceLive = { guests, credits, gold, fresh: { total: freshRecs.length, fading: fading.length, list: fading.slice(0, 8).map((x) => ({ title: x.title, level: x.f.level, days: x.f.days })) }, quests30,
    radio30: 0, refresh30: 0 };
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const r = act[ymdOf(d)] || {};
    practiceLive.radio30 += Number(r.r) || 0; practiceLive.refresh30 += Number(r.u) || 0;
  }

  // v40: «Путь мастера» — значки по семействам, «Мастер роли ✦», чем не пользуется (копия с телефона;
  // в старой копии его нет — mastery: null, раздел не показывается)
  const ms = masteryFromCopy(learning);
  const mastery = ms ? { ...ms, master: ms.master.map((id) => ({ id, label: roleOf(id).label || id })) } : null;

  // когда занимался
  const seen = toDate(raw && raw.seen) || null;
  const seenDays = seen ? dayDiff(seen, now) : null;

  // на что обратить внимание
  const flags = [];
  if (seenDays == null) flags.push({ level: "warn", text: "Ещё не занимался" });
  else if (seenDays >= 7) flags.push({ level: "warn", text: "Не занимался " + seenDays + " " + plural(seenDays, "день", "дня", "дней") });
  const unfixed = wrongAll.filter((w) => !w.fixed).length;
  if (unfixed >= 3) flags.push({ level: "warn", text: unfixed + " " + plural(unfixed, "вопрос", "вопроса", "вопросов") + " с ошибкой не исправлены" });
  if (repeat.due >= 10) flags.push({ level: "warn", text: repeat.due + " " + plural(repeat.due, "вопрос ждёт", "вопроса ждут", "вопросов ждут") + " повтора" });
  examList.filter((e) => !e.passed).forEach((e) => flags.push({ level: "warn", text: "Экзамен «" + e.label + "» не сдан" }));
  if (avg != null && avg < 70 && testList.length >= 2) flags.push({ level: "warn", text: "Средний балл тестов " + avg + "%" });
  if (main && main.pct >= 100) flags.push({ level: "good", text: "Трек «" + main.label + "» пройден" });
  if (skills.confirmed >= 3) flags.push({ level: "good", text: skills.confirmed + " " + plural(skills.confirmed, "навык подтверждён", "навыка подтверждены", "навыков подтверждены") + " в зале" });
  if (activity.active14 >= 7) flags.push({ level: "good", text: "Занимался " + activity.active14 + " из 14 дней" });
  // v30
  if (gold.length) flags.push({ level: "good", text: "Золотых тем: " + gold.length });
  if (fading.length >= 3) flags.push({ level: "warn", text: fading.length + " " + plural(fading.length, "тема выдыхается", "темы выдыхаются", "тем выдыхаются") + " — пора освежить" });
  if (credits.length) flags.push({ level: "info", text: "Зачтено по опыту: " + credits.map((c) => "«" + c.title + "»").join(", ") });
  if (mastery && mastery.master.length) flags.push({ level: "good", text: "Мастер роли: " + mastery.master.map((r) => "«" + r.label + "»").join(", ") });   // v40
  const hasPhone = !!(raw && raw.learning_at);
  if (!hasPhone) flags.push({ level: "info", text: "Телефон ещё не прислал данные (ошибки на повторе, дни занятий) — появятся, когда сотрудник откроет новую версию" });

  const name = String(p.name || "").trim(), surname = String(p.surname || "").trim();
  return {
    kind: "person", v: 1, id: p.id || "", name, surname, full: (name + " " + surname).trim(),
    restaurant: p.restaurant || "", position: p.position || "", positionLabel: POSITION_LABEL[p.position] || (p.is_admin ? "Владелец" : (p.position || "Сотрудник")),
    generatedAt: now.toISOString(), generatedLabel: stampLabel(now),
    seenAt: seen ? seen.toISOString() : null, seenLabel: agoLabel(seen, now), seenDays,
    phoneAt: (raw && raw.learning_at) || null, hasPhone, tg: !!(raw && raw.tg),
    main, tracks, notDone,
    tests: { passed: quizDone.size, avg, list: testList },
    wrong: wrongAll.slice(0, 40), wrongQuestions: wrongAll.length, unfixed, wrong30,
    weak, repeat, practice: { list: practice, low: practice.filter((x) => x.stars <= 1).length },
    skills, activity, exams: examList, flags, live: practiceLive, mastery,
  };
}

// v40: строки «Пути мастера» для PDF и Excel — одни и те же слова
export function masteryLines(ms) {
  if (!ms) return null;
  return {
    badges: ms.badges.map((b) => b.title + " — " + b.tierName).join(", "),
    master: ms.master.map((r) => "«" + r.label + "»").join(", "),
    unused: ms.unused.join(", "),
    count: ms.bronze + " из " + ms.total + " " + plural(ms.total, "значка", "значков", "значков"),
  };
}

// ── Команда: модели всех, кого видно ─────────────────────────────────────────
export function teamModel(rawTeam, ctx = {}) {
  const now = ctx.now ? toDate(ctx.now) : new Date();
  const steps = ctx.steps || stepIndex(ctx.index || {}, ctx.customByRole || {});
  const people = ((rawTeam && rawTeam.people) || []).filter(Boolean).map((r) => personModel(r, { ...ctx, steps, now }));
  const scope = rawTeam && rawTeam.scope;
  const scopeLabel = scope === "restaurant" ? (rawTeam.restaurant || "Мой ресторан") : scope === "network" || scope === "all" ? "Все рестораны" : "Только я";
  return { kind: "team", v: 1, scope, scopeLabel, restaurant: (rawTeam && rawTeam.restaurant) || "", generatedAt: now.toISOString(), generatedLabel: stampLabel(now), people, cut: !!(rawTeam && rawTeam.cut) };
}

// Строка списка (report_people): лёгкие цифры без подробностей
export function listRow(r, ctx = {}) {
  const now = ctx.now ? toDate(ctx.now) : new Date();
  const roles = ctx.roles || [];
  const total = ctx.totals && r.last_role ? ctx.totals[r.last_role] || 0 : 0;
  const role = roles.find((x) => x.id === r.last_role) || null;
  const seen = toDate(r.seen);
  const seenDays = seen ? dayDiff(seen, now) : null;
  const attention = (seenDays == null || seenDays >= 7) || (Number(r.wrong30) || 0) >= 5 || (Number(r.due) || 0) >= 10;
  return {
    id: r.id, name: r.name || "", surname: r.surname || "", full: ((r.name || "") + " " + (r.surname || "")).trim(), restaurant: r.restaurant || "",
    position: r.position || "", positionLabel: POSITION_LABEL[r.position] || "Сотрудник", self: !!r.self,
    track: role ? role.label : "", color: role ? role.color : "#C8A96E",
    lessons: Number(r.lessons) || 0, quiz: Number(r.quiz) || 0, total, pct: total ? Math.min(100, Math.round(((Number(r.lessons) || 0) + (Number(r.quiz) || 0)) / total * 100)) : null,
    wrong30: Number(r.wrong30) || 0, mistakes: Number(r.mistakes) || 0, due: Number(r.due) || 0, days14: Number(r.days14) || 0,
    seenLabel: agoLabel(seen, now), seenDays, hasPhone: !!r.learning_at, attention,
  };
}

// сколько шагов в каждом треке (для полосок в списке)
export function trackTotals(index) {
  const out = {};
  Object.keys(index || {}).forEach((t) => { out[t] = (index[t] || []).reduce((a, m) => a + (m.lessons || []).filter((l) => l && l.type !== "result").length, 0); });
  return out;
}
