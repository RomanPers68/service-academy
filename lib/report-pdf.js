// lib/report-pdf.js — Доп. 309: PDF-карточка сотрудника (и все карточки команды одним файлом).
// Для разговора один на один: что пройдено, где ошибается (что выбрал и как верно), с чем
// работать, что ждёт повтора, что не пройдено, тесты, навыки в зале, дни занятий.
// Светлая «бумажная» вёрстка — хорошо печатается. Шрифт — SA Report Serif (Lora).

import { PdfDoc, A4 } from "./pdf.js";
import { SA_SERIF_REGULAR, SA_SERIF_BOLD } from "./fonts/sa-serif.js";
import { pl, shortDate, masteryLines } from "./report-model.js";

const C = {
  ink: "#2A1F0E", muted: "#6B5B40", faint: "#E6DBC4", line: "#D9C9A6", gold: "#9A7430", goldLine: "#C8A96E",
  band: "#F6EFDF", tile: "#FBF7EE", warn: "#B0452C", warnBg: "#FBEAE4", good: "#3B7A53", goodBg: "#E7F1E8", info: "#6B5B40",
};
const M = 40;
const CW = A4.w - M * 2;

function flow(pdf, footer) {
  const f = { pdf, page: null, y: M, bottom: A4.h - 54 };
  f.newPage = () => { f.page = pdf.addPage(); f.page.footer = footer; f.y = M; return f.page; };
  f.need = (h) => { if (!f.page || f.y + h > f.bottom) { f.newPage(); return true; } return false; };
  f.newPage();
  return f;
}

function section(f, title, sub, minAfter = 56) {
  const { pdf } = f;
  f.need(41 + minAfter);   // заголовок не остаётся один внизу страницы
  f.y += 14;
  pdf.text(f.page, title, M, f.y + 10, { size: 12.5, font: "bold", color: C.ink });
  if (sub) pdf.text(f.page, sub, M, f.y + 10, { size: 8.5, color: C.muted, align: "right", width: CW });
  pdf.line(f.page, M, f.y + 17, M + CW, f.y + 17, { color: C.goldLine, lw: 0.8 });
  f.y += 27;
}

function para(f, text, { size = 9.5, color = C.muted, font = "regular", indent = 0, lh = 1.32 } = {}) {
  const { pdf } = f;
  const lines = pdf.wrap(text, CW - indent, size, font);
  lines.forEach((ln) => { f.need(size * lh + 1); pdf.text(f.page, ln, M + indent, f.y + size, { size, color, font }); f.y += size * lh; });
}

function tile(pdf, p, x, y, w, h, label, value, sub, opt = {}) {
  pdf.rect(p, x, y, w, h, { fill: C.tile, stroke: C.faint, lw: 0.7, r: 7 });
  pdf.text(p, pdf.fit(label, w - 18, 8, "regular"), x + 10, y + 16, { size: 8, color: C.muted });
  pdf.text(p, pdf.fit(value, w - 18, 18, "bold"), x + 10, y + 39, { size: 18, font: "bold", color: opt.color || C.ink });
  if (sub) pdf.text(p, pdf.fit(sub, w - 18, 7.8, "regular"), x + 10, y + 53, { size: 7.8, color: C.muted });
  if (opt.bar != null) {
    pdf.rect(p, x + 10, y + h - 9, w - 20, 3, { fill: C.faint, r: 1.5 });
    if (opt.bar > 0) pdf.rect(p, x + 10, y + h - 9, Math.max(3, (w - 20) * Math.min(1, opt.bar)), 3, { fill: opt.barColor || C.gold, r: 1.5 });
  }
}

// таблица: колонки [{ title, w (доля), align }], строки — массивы строк; перенос по словам
function table(f, cols, rows, { size = 8.8, head = true, zebra = true, max = 0, more = "" } = {}) {
  const { pdf } = f;
  const widths = cols.map((c) => c.w * CW);
  const pad = 5, lh = size * 1.28;
  const drawHead = () => {
    if (!head) return;
    f.need(18);
    let x = M;
    cols.forEach((c, i) => { pdf.text(f.page, c.title, x + pad, f.y + 10, { size: 7.6, color: C.muted, font: "bold", align: c.align === "right" ? "right" : c.align === "center" ? "center" : "left", width: widths[i] - pad * 2 }); x += widths[i]; });
    pdf.line(f.page, M, f.y + 15, M + CW, f.y + 15, { color: C.line, lw: 0.6 });
    f.y += 18;
  };
  drawHead();
  const list = max ? rows.slice(0, max) : rows;
  list.forEach((r, ri) => {
    const cells = r.map((cell, i) => {
      const v = cell && typeof cell === "object" ? cell : { t: cell };
      const font = v.bold ? "bold" : "regular";
      return { ...v, font, lines: pdf.wrap(String(v.t == null ? "" : v.t), widths[i] - pad * 2, size, font) };
    });
    const h = Math.max(...cells.map((c) => c.lines.length)) * lh + 6;
    if (f.need(h)) drawHead();
    if (zebra && ri % 2 === 1) pdf.rect(f.page, M, f.y, CW, h, { fill: "#FCF9F2" });
    let x = M;
    cells.forEach((c, i) => {
      if (c.check) pdf.check(f.page, x + widths[i] / 2 - 4, f.y + 4 + size, 8, C.good);
      else c.lines.forEach((ln, li) => pdf.text(f.page, ln, x + pad, f.y + 3 + size + li * lh, { size, color: c.color || C.ink, font: c.font, align: cols[i].align === "right" ? "right" : cols[i].align === "center" ? "center" : "left", width: widths[i] - pad * 2 }));
      x += widths[i];
    });
    f.y += h;
    pdf.line(f.page, M, f.y, M + CW, f.y, { color: C.faint, lw: 0.4 });
  });
  if (max && rows.length > max && more) { f.y += 4; para(f, more.replace("{n}", rows.length - max), { size: 8.5 }); }
}

function drawPerson(pdf, m, opts = {}) {
  const footer = "Service Academy · " + m.full + " · отчёт " + m.generatedLabel;
  const f = flow(pdf, footer);
  const p = f.page;
  // шапка
  pdf.rect(p, 0, 0, A4.w, 122, { fill: C.band });
  pdf.line(p, 0, 122, A4.w, 122, { color: C.goldLine, lw: 1 });
  pdf.text(p, "SERVICE ACADEMY", M, 36, { size: 8, font: "bold", color: C.gold, spacing: 1.6 });
  pdf.text(p, "ОТЧЁТ ПО СОТРУДНИКУ", M, 36, { size: 7.6, color: C.muted, align: "right", width: CW, spacing: 1.1 });
  pdf.text(p, pdf.fit(m.full || "Сотрудник", CW, 24, "bold"), M, 70, { size: 24, font: "bold", color: C.ink });
  const sub = [m.positionLabel, m.restaurant, m.seenDays == null ? "ещё не занимался" : "последнее занятие: " + m.seenLabel].filter(Boolean).join(" · ");
  pdf.text(p, pdf.fit(sub, CW, 10.5, "regular"), M, 92, { size: 10.5, color: C.muted });
  pdf.text(p, "сформирован " + m.generatedLabel + (m.phoneAt ? " · данные с телефона от " + shortDate(m.phoneAt) : ""), M, 110, { size: 7.8, color: C.muted });
  f.y = 138;

  // плитки
  const tw = (CW - 30) / 4, th = 64;
  const mt = m.main;
  const ex = m.exams.find((e) => mt && e.track === mt.id) || m.exams[0] || null;
  const tiles = [
    [mt ? "Трек «" + mt.label + "»" : "Трек", mt ? mt.pct + "%" : "—", mt ? mt.done + " из " + mt.total + " " + pl(mt.total, "шага", "шагов", "шагов") : "", { bar: mt && mt.total ? mt.done / mt.total : 0, barColor: (mt && mt.color) || C.gold }],
    ["Тесты", m.tests.avg == null ? "—" : m.tests.avg + "%", m.tests.passed + " " + pl(m.tests.passed, "сдан", "сдано", "сдано") + " · средний балл", { color: m.tests.avg != null && m.tests.avg < 70 ? C.warn : C.ink }],
    ["Ошибки в тестах", String(m.wrong30), "за 30 дней", { color: m.unfixed >= 3 ? C.warn : C.ink }],
    ["Ждут повтора", String(m.repeat.due), m.hasPhone ? "из " + m.repeat.total + " в банке ошибок" : "нет данных с телефона", { color: m.repeat.due >= 10 ? C.warn : C.ink }],
    ["Дней занятий", m.activity.active14 + " из 14", "разминок за 30 дней: " + m.activity.warm30, {}],
    ["Навыки в зале", String(m.skills.confirmed), m.skills.pending ? "+" + m.skills.pending + " ждёт старшего" : "подтверждено наставником", { color: m.skills.confirmed ? C.good : C.ink }],
    ["Серия", m.activity.streak.count + " " + pl(m.activity.streak.count, "день", "дня", "дней"), "лучшая — " + m.activity.streak.best, {}],
    ["Экзамен", ex ? (ex.passed ? "сдан" : "не сдан") : "—", ex ? ex.label + (ex.score ? " · " + ex.score + "%" : "") : "ещё не сдавал", { color: ex ? (ex.passed ? C.good : C.warn) : C.ink }],
  ];
  tiles.forEach((t, i) => tile(pdf, f.page, M + (i % 4) * (tw + 10), f.y + Math.floor(i / 4) * (th + 10), tw, th, t[0], t[1], t[2], t[3]));
  f.y += th * 2 + 10 + 14;

  // на что обратить внимание
  const flags = m.flags.filter((x) => x.level !== "info");
  const info = m.flags.filter((x) => x.level === "info");
  if (flags.length || info.length) {
    const lines = flags.map((x) => ({ t: x.text, level: x.level })).concat(info.map((x) => ({ t: x.text, level: "info" })));
    const wrapped = lines.map((l) => ({ ...l, ls: pdf.wrap(l.t, CW - 40, 9.2, "regular") }));
    const h = wrapped.reduce((a, l) => a + l.ls.length * 12.2, 0) + 28;
    f.need(h);
    const warnAny = flags.some((x) => x.level === "warn");
    pdf.rect(f.page, M, f.y, CW, h, { fill: warnAny ? C.warnBg : C.goodBg, r: 7 });
    pdf.text(f.page, "Обратить внимание", M + 12, f.y + 16, { size: 9.5, font: "bold", color: warnAny ? C.warn : C.good });
    let yy = f.y + 30;
    wrapped.forEach((l) => {
      if (l.level === "good") pdf.check(f.page, M + 13, yy + 1, 7, C.good, 1.2);
      else pdf.circle(f.page, M + 16, yy - 2.6, 2.2, { fill: l.level === "warn" ? C.warn : C.muted });
      l.ls.forEach((ln, i) => pdf.text(f.page, ln, M + 28, yy + i * 12.2, { size: 9.2, color: l.level === "info" ? C.muted : C.ink }));
      yy += l.ls.length * 12.2;
    });
    f.y += h + 4;
  }

  // где ошибается
  section(f, "Где ошибается", m.wrongQuestions ? m.wrongQuestions + " " + pl(m.wrongQuestions, "вопрос", "вопроса", "вопросов") + " с ошибкой за полгода" : "");
  if (!m.wrong.length) para(f, "Ошибок в тестах за последние полгода нет.");
  else table(f, [{ title: "Вопрос", w: 0.36 }, { title: "Ответил", w: 0.21 }, { title: "Как верно", w: 0.23 }, { title: "Ошибок", w: 0.1, align: "center" }, { title: "Исправил", w: 0.1, align: "center" }],
    m.wrong.map((w) => [{ t: w.q, bold: !w.fixed }, { t: w.chosen || "—", color: C.warn }, { t: w.right || "—", color: C.good }, { t: w.wrong + (w.total > w.wrong ? " из " + w.total : "") }, w.fixed ? { check: true } : { t: "нет", color: C.warn }]),
    { max: opts.maxWrong || 14, more: "И ещё {n} — полный список в Excel." });

  // с чем работать
  section(f, "С чем работать");
  if (!m.weak.length) para(f, "Слабых тем не видно: ошибок мало, практика пройдена хорошо.");
  m.weak.forEach((w) => {
    const ls = pdf.wrap(w.why, CW - 150, 8.8, "regular");
    const h = 16 + ls.length * 11.5 + 6;
    f.need(h);
    pdf.text(f.page, pdf.fit(w.topic, CW - 150, 10, "bold"), M, f.y + 11, { size: 10, font: "bold", color: C.ink });
    ls.forEach((ln, i) => pdf.text(f.page, ln, M, f.y + 24 + i * 11.5, { size: 8.8, color: C.muted }));
    if (w.total) {
      const bx = M + CW - 120;
      pdf.rect(f.page, bx, f.y + 8, 120, 5, { fill: C.faint, r: 2.5 });
      pdf.rect(f.page, bx, f.y + 8, Math.max(4, 120 * w.rate / 100), 5, { fill: w.rate >= 50 ? C.warn : C.gold, r: 2.5 });
      pdf.text(f.page, w.rate + "% ошибок", bx, f.y + 25, { size: 7.8, color: C.muted, align: "right", width: 120 });
    }
    f.y += h;
  });

  // ждут повтора
  if (m.repeat.total) {
    section(f, "Ждут повтора", m.repeat.due + " из " + m.repeat.total + " — сейчас");
    table(f, [{ title: "Вопрос", w: 0.5 }, { title: "Верный ответ", w: 0.36 }, { title: "Повтор", w: 0.14, align: "center" }],
      m.repeat.list.map((r) => [r.q, { t: r.a || "—", color: C.good }, { t: r.isDue ? "сейчас" : (r.stage + 1) + "-й", color: r.isDue ? C.warn : C.muted }]),
      { max: 10, more: "И ещё {n} — в Excel." });
  }

  // что не пройдено
  section(f, "Что не пройдено", mt ? "трек «" + mt.label + "» · осталось " + m.notDone.left + " " + pl(m.notDone.left, "шаг", "шага", "шагов") : "");
  if (!m.notDone.left) para(f, mt ? "Трек пройден целиком." : "Трек ещё не выбран.");
  else {
    let shown = 0;
    m.notDone.modules.slice(0, 3).forEach((mod) => {
      f.need(30);
      pdf.text(f.page, pdf.fit(mod.title, CW, 10, "bold"), M, f.y + 11, { size: 10, font: "bold", color: C.ink });
      f.y += 16;
      mod.steps.slice(0, 6).forEach((s) => {
        f.need(13);
        const label = new RegExp("^" + s.kind, "i").test(s.title) ? s.title : s.kind + " · " + s.title;   // «Тест: …» без «тест ·»
        pdf.text(f.page, "•", M + 4, f.y + 9, { size: 9, color: C.gold });
        pdf.text(f.page, pdf.fit(label, CW - 18, 9, "regular"), M + 14, f.y + 9, { size: 9, color: C.ink });
        f.y += 12.5; shown++;
      });
      if (mod.steps.length > 6) { pdf.text(f.page, "и ещё " + (mod.steps.length - 6) + " в этой теме", M + 14, f.y + 9, { size: 8.5, color: C.muted }); f.y += 12.5; }
      f.y += 4;
    });
    const restMods = m.notDone.modules.length - 3;
    if (restMods > 0) para(f, "Дальше ещё " + restMods + " " + pl(restMods, "тема", "темы", "тем") + " — список в Excel.", { size: 8.5 });
  }

  // тесты
  if (m.tests.list.length) {
    section(f, "Тесты", "лучший результат по каждому");
    table(f, [{ title: "Тест", w: 0.56 }, { title: "Тема", w: 0.24 }, { title: "Баллы", w: 0.1, align: "center" }, { title: "%", w: 0.1, align: "center" }],
      m.tests.list.map((t) => [t.title, t.topic, t.total ? t.score + "/" + t.total : "—", { t: t.pct + "%", color: t.pct < 70 ? C.warn : t.pct >= 90 ? C.good : C.ink, bold: true }]),
      { max: 14, more: "И ещё {n} — в Excel." });
  }

  // навыки
  section(f, "Навыки в зале", m.skills.confirmed + " подтверждено" + (m.skills.pending ? " · " + m.skills.pending + " ждёт" : ""));
  if (!m.skills.list.length) para(f, "Подтверждений навыков пока нет.");
  else table(f, [{ title: "Навык", w: 0.46 }, { title: "Статус", w: 0.22 }, { title: "Кто", w: 0.2 }, { title: "Когда", w: 0.12 }],
    m.skills.list.map((s) => [s.label, { t: s.status === "hall" ? "в зале" : s.status === "pin" ? "по PIN" : s.status === "pending" ? "ждёт старшего" : "ещё рано", color: s.status === "hall" || s.status === "pin" ? C.good : s.status === "pending" ? C.gold : C.warn, bold: true }, s.by || "—", shortDate(s.date) || s.date || ""]),
    { zebra: false });

  // v30: живая практика
  const lv = m.live;
  if (lv && (lv.guests.total || lv.credits.length || lv.gold.length || lv.fresh.total || lv.quests30)) {
    section(f, "Живая практика", "за 30 дней");
    const rows = [];
    if (lv.guests.total) rows.push(["Живой гость", lv.guests.n30 + " " + pl(lv.guests.n30, "разговор", "разговора", "разговоров") + (lv.guests.avg != null ? " · средний чек " + String(lv.guests.avg).replace(".", ",") + " из 5" : "") + (lv.guests.lastFix ? " · поправить: " + lv.guests.lastFix : "")]);
    if (lv.fresh.total) rows.push(["Свежесть тем", lv.fresh.fading ? lv.fresh.fading + " " + pl(lv.fresh.fading, "выдыхается", "выдыхаются", "выдыхаются") + ": " + lv.fresh.list.map((x) => "«" + x.title + "»").join(", ") : "все пройденные темы свежие"]);
    if (lv.credits.length) rows.push(["Зачтено по опыту", lv.credits.map((c) => "«" + c.title + "» " + c.s + "/" + c.t).join(", ")]);
    if (lv.gold.length) rows.push(["Золотые темы", lv.gold.map((g) => "«" + g.title + "»").join(", ")]);
    if (lv.quests30) rows.push(["Квест смены", "закрыт " + lv.quests30 + " " + pl(lv.quests30, "раз", "раза", "раз") + " вместе со сменой"]);
    table(f, [{ title: "Что", w: 0.24 }, { title: "Как", w: 0.76 }], rows.map((r) => [{ t: r[0], bold: true }, r[1]]), { zebra: false });
  }

  // v40: «Путь мастера» — значки по семействам, мастер роли, чем не пользуется (старая копия — раздела нет)
  const ms = m.mastery;
  if (ms) {
    const ln = masteryLines(ms);
    section(f, "Путь мастера", ln.count + " · бронза и выше");
    const rows = [["Значки", ms.badges.length ? ln.badges : "пока нет"]];
    if (ms.master.length) rows.push(["Мастер роли", { t: ln.master, color: C.good }]);
    if (ms.fw) rows.push(["Первые шаги", "все семь заданий первых двух недель сделаны"]);
    if (ms.unused.length) rows.push(["Не пользуется", { t: ln.unused, color: C.muted }]);
    table(f, [{ title: "Что", w: 0.24 }, { title: "Как", w: 0.76 }], rows.map((r) => [{ t: r[0], bold: true }, r[1]]), { zebra: false });
  }

  // дни занятий
  section(f, "Дни занятий", "последние 14 дней · шаги и разминки");
  const ch = 70;
  f.need(ch + 34);
  const days = m.activity.days;
  const max = Math.max(3, ...days.map((d) => d.steps + d.fix));
  const cw = CW / days.length;
  days.forEach((d, i) => {
    const x = M + i * cw + cw * 0.18, w = cw * 0.64;
    const v = d.steps + d.fix;
    pdf.rect(f.page, x, f.y, w, ch, { fill: "#F8F3E8", r: 3 });
    if (v > 0) { const h = Math.max(4, ch * v / max); pdf.rect(f.page, x, f.y + ch - h, w, h, { fill: (mt && mt.color) || C.gold, r: 3 }); pdf.text(f.page, String(v), x, f.y + ch - h - 3, { size: 7, color: C.muted, align: "center", width: w }); }
    if (d.warm) pdf.circle(f.page, x + w / 2, f.y + ch + 6, 2.3, { fill: C.gold });
    pdf.text(f.page, d.label, x - 4, f.y + ch + 18, { size: 7.4, color: C.muted, align: "center", width: w + 8 });
    pdf.text(f.page, String(d.date), x - 4, f.y + ch + 27, { size: 7.4, color: C.ink, align: "center", width: w + 8 });
  });
  f.y += ch + 34;
  pdf.circle(f.page, M + 3, f.y + 3, 2.3, { fill: C.gold });
  pdf.text(f.page, "— разминка до смены · столбик — шаги (уроки, практика, тесты) и исправленные ошибки", M + 10, f.y + 6, { size: 7.8, color: C.muted });
  f.y += 14;
  return f;
}

function footers(pdf) {
  const n = pdf.pages.length;
  pdf.pages.forEach((p, i) => {
    pdf.line(p, M, A4.h - 36, M + CW, A4.h - 36, { color: C.faint, lw: 0.5 });
    pdf.text(p, pdf.fit(p.footer || "Service Academy", CW - 80, 7.6, "regular"), M, A4.h - 24, { size: 7.6, color: C.muted });
    pdf.text(p, "стр. " + (i + 1) + " из " + n, M, A4.h - 24, { size: 7.6, color: C.muted, align: "right", width: CW });
  });
}

const newDoc = (title) => new PdfDoc({ fonts: { regular: SA_SERIF_REGULAR, bold: SA_SERIF_BOLD }, title, author: "Service Academy" });

export function personPdf(model) {
  const pdf = newDoc("Отчёт по сотруднику — " + (model.full || ""));
  drawPerson(pdf, model);
  footers(pdf);
  return pdf.save();
}

export function teamPdf(team) {
  const pdf = newDoc("Отчёт по команде — " + (team.scopeLabel || ""));
  // обложка: сводная таблица
  const f = flow(pdf, "Service Academy · отчёт по команде · " + team.generatedLabel);
  const p = f.page;
  pdf.rect(p, 0, 0, A4.w, 110, { fill: C.band });
  pdf.line(p, 0, 110, A4.w, 110, { color: C.goldLine, lw: 1 });
  pdf.text(p, "SERVICE ACADEMY", M, 36, { size: 8, font: "bold", color: C.gold, spacing: 1.6 });
  pdf.text(p, "ОТЧЁТ ПО КОМАНДЕ", M, 36, { size: 7.6, color: C.muted, align: "right", width: CW, spacing: 1.1 });
  pdf.text(p, pdf.fit(team.scopeLabel || "Команда", CW, 22, "bold"), M, 70, { size: 22, font: "bold", color: C.ink });
  pdf.text(p, team.people.length + " " + pl(team.people.length, "сотрудник", "сотрудника", "сотрудников") + " · сформирован " + team.generatedLabel, M, 92, { size: 10, color: C.muted });
  f.y = 128;
  section(f, "Сводка", "подробно — на страницах каждого");
  table(f, [{ title: "Сотрудник", w: 0.26 }, { title: "Трек", w: 0.16 }, { title: "Тесты", w: 0.09, align: "center" }, { title: "Ошибки", w: 0.09, align: "center" }, { title: "Повтор", w: 0.09, align: "center" }, { title: "Дни", w: 0.08, align: "center" }, { title: "Обратить внимание", w: 0.23 }],
    team.people.map((m) => {
      const warn = m.flags.filter((x) => x.level === "warn").map((x) => x.text);
      return [{ t: m.full + (team.scope !== "restaurant" && m.restaurant ? " · " + m.restaurant : ""), bold: true }, m.main ? m.main.label + " " + m.main.pct + "%" : "—", m.tests.avg == null ? "—" : m.tests.avg + "%", String(m.wrong30), String(m.repeat.due), m.activity.active14 + "/14", { t: warn.join("; ") || "—", color: warn.length ? C.warn : C.muted }];
    }), { size: 8.4 });
  team.people.forEach((m) => drawPerson(pdf, m, { maxWrong: 10 }));
  footers(pdf);
  return pdf.save();
}
