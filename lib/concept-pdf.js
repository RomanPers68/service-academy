// lib/concept-pdf.js — v192 (Доп. 517): «О нас» одним файлом для печати и лист ознакомления (PDF).
//
// Владелец (23.11), про семь идей для «О нас»: «Ты правильно понял. Делаем все 7». Документы для холдинга — как будто их
// сделал человек: без значков приложения и без подписи «сделано в приложении»; бумажная вёрстка, как у отчётов
// (lib/report-pdf.js), шрифт тот же (Lora с кириллицей), фото — JPEG как есть (lib/pdf.js).
//   • conceptPdf(model) — обложка (название раздела, заведение, фото зала, редакция), содержание со страницами, блоки
//     тем же видом, что в уроках: главная мысль крупно, подзаголовки, пункты, «как надо» и «нельзя» значками, шаги в
//     кружках, вывод в рамке, фраза гостю с чертой слева, фото с подписями.
//   • acksPdf(model) — «Лист ознакомления»: №, фамилия и имя, должность, дата ознакомления в приложении (кто ещё не
//     отметил — пусто, дату ставят рукой), подпись; внизу — строки для руководителя.
// Модель собирает приложение (ui/concept-print.js): даты уже словами — по часам телефона, фото — base64 JPEG.
// В Telegram файл рисует /api/report по билету (этап 58, concept_ticket), поэтому модель проверяется здесь (cleanConceptModel,
// cleanAcksModel): что бы ни пришло, лишнего и длинного не будет.
import { PdfDoc, A4, b64Bytes } from "./pdf.js";
import { SA_SERIF_REGULAR, SA_SERIF_BOLD } from "./fonts/sa-serif.js";
import { lineKind } from "./lesson-look.js";

const C = { ink: "#2A1F0E", text: "#3A2C16", muted: "#6B5B40", faint: "#E6DBC4", line: "#D9C9A6", gold: "#9A7430", goldLine: "#C8A96E",
  band: "#F7F0E0", tile: "#FBF7EE", green: "#3B7A53", red: "#B0452C", blue: "#4F79B8" };
const M = 52, CW = A4.w - M * 2, TOP = 56, BOTTOM = A4.h - 64;

const str = (v, n) => String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);
// значки в тексте (эмодзи) в шрифте не нарисовать — их место занимают рисунки или ничего
const noEmoji = (s) => String(s || "").replace(/\p{Extended_Pictographic}/gu, "").replace(/[️⃣‍]/g, "").replace(/[ \t]{2,}/g, " ");
const photoOf = (p) => (p && typeof p.b64 === "string" && p.b64.length > 100 && p.b64.length < 900000 && /^[A-Za-z0-9+/=]+$/.test(p.b64)
  ? { b64: p.b64, cap: str(p.cap, 120) } : null);

/** Модель «О нас» для печати: только известные поля и разумные длины. */
export function cleanConceptModel(x) {
  const m = x && typeof x === "object" ? x : {};
  return {
    title: str(m.title, 60) || "Наш ресторан", sub: str(m.sub, 80), where: str(m.where, 80), edition: str(m.edition, 40), made: str(m.made, 40),
    hero: photoOf(m.hero),
    parts: arr(m.parts).slice(0, 2).map((p) => ({ where: str(p && p.where, 80),
      blocks: arr(p && p.blocks).slice(0, 40).map((b) => ({ label: str(b && b.label, 60), title: str(b && b.title, 80) || "Без заголовка",
        body: str(b && b.body, 6000), photos: arr(b && b.photos).slice(0, 8).map(photoOf).filter(Boolean) })) })).filter((p) => p.blocks.length),
  };
}

/** Модель листа ознакомления. */
export function cleanAcksModel(x) {
  const m = x && typeof x === "object" ? x : {};
  const b = Math.round(Number(m.blanks));
  return { title: str(m.title, 60) || "Наш ресторан", sub: str(m.sub, 80), where: str(m.where, 80), edition: str(m.edition, 40), made: str(m.made, 40),
    rows: arr(m.rows).slice(0, 300).map((r) => ({ name: str(r && r.name, 80), pos: str(r && r.pos, 40), at: str(r && r.at, 20) })).filter((r) => r.name),
    blanks: Number.isFinite(b) ? Math.max(0, Math.min(20, b)) : 4 };
}

const newDoc = (title, author) => new PdfDoc({ fonts: { regular: SA_SERIF_REGULAR, bold: SA_SERIF_BOLD }, title, author: author || "" });

// ── текст с **жирным** внутри строки: перенос по словам, у каждого слова свой шрифт ───────────────────────
function richLines(pdf, text, width, size, baseBold = false) {
  const words = [];
  for (const part of String(text).split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    const bold = baseBold || (part.startsWith("**") && part.endsWith("**") && part.length > 4);
    const t = bold && part.startsWith("**") ? part.slice(2, -2) : part.replace(/\*\*/g, "");
    for (const w of t.split(/\s+/).filter(Boolean)) words.push({ t: w, bold });
  }
  const sp = pdf.measure(" ", size, "regular");
  const lines = [];
  let cur = [], cw = 0;
  for (const w of words) {
    const ww = pdf.measure(w.t, size, w.bold ? "bold" : "regular");
    if (cur.length && cw + sp + ww > width) { lines.push(cur); cur = []; cw = 0; }
    if (!cur.length && ww > width) {   // слово длиннее строки — режем
      lines.push([{ ...w, t: pdf.fit(w.t, width, size, w.bold ? "bold" : "regular"), w: width }]);
      continue;
    }
    cur.push({ ...w, w: ww }); cw += (cur.length > 1 ? sp : 0) + ww;
  }
  if (cur.length) lines.push(cur);
  return { lines, sp };
}
function drawRich(f, text, x, width, { size = 10.5, lh = 1.45, color = C.text, bold = false } = {}) {
  const { pdf } = f;
  const { lines, sp } = richLines(pdf, text, width, size, bold);
  for (const ln of lines) {
    f.need(size * lh);
    let xx = x;
    ln.forEach((w, i) => { if (i) xx += sp; pdf.text(f.page, w.t, xx, f.y + size, { size, font: w.bold ? "bold" : "regular", color }); xx += w.w; });
    f.y += size * lh;
  }
}
const richHeight = (pdf, text, width, size, lh, bold) => richLines(pdf, text, width, size, bold).lines.length * size * lh;

function flowOf(pdf, foot) {
  const f = { pdf, page: null, y: TOP };
  f.newPage = () => { f.page = pdf.addPage(); f.page.foot = foot; f.y = TOP; return f.page; };
  f.need = (h) => { if (!f.page || f.y + h > BOTTOM) { f.newPage(); return true; } return false; };
  return f;
}

// значки строк уроков рисунком (в шрифте их нет): y — середина первой строки
function mark(pdf, p, kind, x, y, n) {
  if (kind === "check") { pdf.rect(p, x, y - 4.5, 9, 9, { stroke: C.gold, lw: 0.9, r: 1.5 }); pdf.check(p, x + 1.8, y + 1.6, 5.6, C.gold, 1.2); }
  else if (kind === "good") { pdf.circle(p, x + 4.5, y, 4.8, { fill: C.green }); pdf.check(p, x + 2.3, y + 1.4, 4.6, "#FFFFFF", 1.1); }
  else if (kind === "ban") { pdf.circle(p, x + 4.5, y, 4.4, { stroke: C.red, lw: 1.1 }); pdf.line(p, x + 1.5, y + 3, x + 7.5, y - 3, { color: C.red, lw: 1.1 }); }
  else if (kind === "bad") { pdf.circle(p, x + 4.5, y, 4.4, { stroke: C.red, lw: 1.1 }); pdf.line(p, x + 2.5, y - 2, x + 6.5, y + 2, { color: C.red, lw: 1 }); pdf.line(p, x + 2.5, y + 2, x + 6.5, y - 2, { color: C.red, lw: 1 }); }
  else if (kind === "step") { pdf.circle(p, x + 5, y, 6, { stroke: C.gold, lw: 0.9 }); pdf.text(p, String(n || ""), x - 1, y + 2.8, { size: 7.6, font: "bold", color: C.gold, align: "center", width: 12 }); }
  else if (kind === "level") pdf.circle(p, x + 4, y, 3, { fill: { blue: C.blue, green: C.green, yellow: "#C9B13E", orange: "#D98A3E", red: C.red }[n] || C.gold });
  else pdf.circle(p, x + 4, y, 2.4, { fill: C.gold });   // star, diamond и прочее — золотая точка
}

const isLead = (t) => t.length >= 30 && !t.startsWith("**") && !t.startsWith("•") && !t.startsWith("«") && !lineKind(t);

/** Текст блока (разметка уроков) — строками, как их рисует урок. */
function drawBody(f, body) {
  const { pdf } = f;
  let first = true;
  for (const raw of String(body || "").split("\n")) {
    const t0 = raw.trim();
    if (!t0) { f.y += 5; continue; }
    const mk = lineKind(t0);
    // строка из одних значков — разделитель
    if (!noEmoji(t0).trim()) { f.need(16); pdf.line(f.page, M + CW / 2 - 40, f.y + 8, M + CW / 2 + 40, f.y + 8, { color: C.goldLine, lw: 0.7 }); f.y += 16; continue; }
    const t = noEmoji(mk && mk.k === "step" ? t0.replace(/^[1-9]️?⃣\s*/u, "") : mk ? t0.replace(/^\S+\s*/u, "") : t0).trim();
    if (first && isLead(t0)) {
      first = false;
      f.y += 2; drawRich(f, t, M, CW, { size: 12.8, lh: 1.42, color: C.ink, bold: true }); f.y += 6;
      continue;
    }
    first = false;
    if (t0.startsWith("**") && t0.endsWith("**") && t0.length > 4) {
      f.need(34); f.y += 7;
      drawRich(f, t.replace(/\*\*/g, ""), M, CW, { size: 11.6, lh: 1.35, color: C.ink, bold: true }); f.y += 2;
      continue;
    }
    if (t0.startsWith("•")) {
      const h = richHeight(pdf, t.replace(/^•\s*/, ""), CW - 14, 10.5, 1.45);
      f.need(Math.min(h, 32));
      pdf.circle(f.page, M + 4, f.y + 6.6, 1.8, { fill: C.gold });
      drawRich(f, t.replace(/^•\s*/, ""), M + 14, CW - 14); f.y += 1.5;
      continue;
    }
    if (mk && mk.k === "pin") {
      // вывод — в рамке, как в уроке
      const h = richHeight(pdf, t, CW - 30, 10.5, 1.45, true) + 16;
      f.need(h + 4); f.y += 4;
      pdf.rect(f.page, M, f.y, CW, h, { fill: C.band, r: 5 });
      pdf.rect(f.page, M, f.y, 2.6, h, { fill: C.goldLine });
      f.y += 8; drawRich(f, t, M + 16, CW - 30, { bold: true, color: C.ink }); f.y += 12;
      continue;
    }
    if (mk) {
      const k = mk.k, n = k === "step" ? mk.n : k === "level" ? mk.level : "";
      f.need(16);
      mark(pdf, f.page, k, M, f.y + 6.8, n);
      drawRich(f, t, M + 17, CW - 17, { color: k === "ban" || k === "bad" ? "#6B2E1E" : C.text }); f.y += 1.5;
      continue;
    }
    if (t0.startsWith("«") && t0.includes("»")) {
      // фраза гостю — с золотой чертой слева
      const h = richHeight(pdf, t, CW - 18, 10.8, 1.45);
      f.need(Math.min(h, 32) + 4);
      const y0 = f.y + 1;
      drawRich(f, t, M + 14, CW - 18, { size: 10.8, color: C.ink });
      pdf.rect(f.page, M + 2, y0, 2, Math.max(10, f.y - y0 - 2), { fill: C.goldLine });
      f.y += 3;
      continue;
    }
    drawRich(f, t, M, CW); f.y += 2;
  }
}

// фото блока: одно — во всю ширину, больше — по два в ряд; подписи под фото
function drawPhotos(f, photos) {
  const { pdf } = f;
  const list = photos.map((p) => ({ ...p, bytes: b64Bytes(p.b64) }));
  const one = list.length === 1;
  const gap = 12, w = one ? CW : (CW - gap) / 2, h = one ? Math.round(CW * 0.5) : Math.round(w * 0.68);
  for (let i = 0; i < list.length; i += one ? 1 : 2) {
    const row = list.slice(i, i + (one ? 1 : 2));
    const capH = Math.max(...row.map((p) => (p.cap ? Math.min(2, pdf.wrap(p.cap, w, 8.4, "regular").length) * 11 + 4 : 0)));
    f.need(h + capH + 10);
    f.y += 6;
    row.forEach((p, k) => {
      const x = M + k * (w + gap);
      if (!pdf.image(f.page, p.bytes, x, f.y, w, h, { r: 4 })) pdf.rect(f.page, x, f.y, w, h, { fill: C.tile, stroke: C.faint, r: 4 });
      if (p.cap) pdf.wrap(p.cap, w, 8.4, "regular").slice(0, 2).forEach((ln, j) => pdf.text(f.page, ln, x, f.y + h + 12 + j * 11, { size: 8.4, color: C.muted }));
    });
    f.y += h + capH + 4;
  }
}

function footers(pdf, skipFirst) {
  const n = pdf.pages.length;
  pdf.pages.forEach((p, i) => {
    if (skipFirst && i === 0) return;
    pdf.line(p, M, A4.h - 40, M + CW, A4.h - 40, { color: C.faint, lw: 0.5 });
    if (p.foot) pdf.text(p, pdf.fit(p.foot, CW - 90, 7.8, "regular"), M, A4.h - 27, { size: 7.8, color: C.muted });
    pdf.text(p, (i + 1) + " / " + n, M, A4.h - 27, { size: 7.8, color: C.muted, align: "right", width: CW });
  });
}

/** «О нас» для печати → байты PDF. */
export function conceptPdf(model) {
  const m = cleanConceptModel(model);
  const pdf = newDoc(m.title + (m.where ? ", " + m.where : ""), m.where || m.title);
  const foot = "«" + m.title + "»" + (m.where ? " · " + m.where : "") + (m.edition ? " · редакция от " + m.edition : "");
  const blocksN = m.parts.reduce((a, p) => a + p.blocks.length, 0);

  // ── обложка
  const cover = pdf.addPage();
  pdf.rect(cover, M - 16, M - 16, CW + 32, A4.h - (M - 16) * 2, { stroke: C.goldLine, lw: 0.8 });
  pdf.rect(cover, M - 11, M - 11, CW + 22, A4.h - (M - 11) * 2, { stroke: C.faint, lw: 0.5 });
  let y = 92;
  if (m.sub) { pdf.text(cover, m.sub.toUpperCase(), M, y, { size: 8.6, font: "bold", color: C.gold, align: "center", width: CW, spacing: 1.6 }); y += 30; }
  const tl = pdf.wrap(m.title, CW - 40, 30, "bold").slice(0, 3);
  tl.forEach((ln) => { pdf.text(cover, ln, M, y + 24, { size: 30, font: "bold", color: C.ink, align: "center", width: CW }); y += 38; });
  if (m.where) { pdf.text(cover, m.where, M, y + 16, { size: 12.5, color: C.muted, align: "center", width: CW }); y += 26; }
  y += 14;
  pdf.line(cover, M + CW / 2 - 70, y, M + CW / 2 - 8, y, { color: C.goldLine, lw: 0.8 });
  pdf.circle(cover, M + CW / 2, y, 2.6, { fill: C.goldLine });
  pdf.line(cover, M + CW / 2 + 8, y, M + CW / 2 + 70, y, { color: C.goldLine, lw: 0.8 });
  y += 26;
  const heroH = Math.min(360, BOTTOM - 70 - y);
  if (m.hero && pdf.image(cover, b64Bytes(m.hero.b64), M, y, CW, heroH, { r: 6 })) {
    y += heroH + 8;
    if (m.hero.cap) { pdf.text(cover, pdf.fit(m.hero.cap, CW, 8.6, "regular"), M, y + 9, { size: 8.6, color: C.muted, align: "center", width: CW }); y += 14; }
  } else {
    // без фото — оглавление на обложке крупно
    pdf.rect(cover, M + 30, y, CW - 60, heroH, { fill: C.tile, stroke: C.faint, r: 6 });
    let yy = y + 34;
    m.parts.flatMap((p) => p.blocks).slice(0, 14).forEach((b) => { pdf.text(cover, pdf.fit(b.title, CW - 120, 12, "regular"), M, yy, { size: 12, color: C.text, align: "center", width: CW }); yy += 21; });
  }
  const meta = [m.edition ? "Редакция от " + m.edition : "", blocksN + " " + (blocksN % 10 === 1 && blocksN % 100 !== 11 ? "раздел" : blocksN % 10 >= 2 && blocksN % 10 <= 4 && (blocksN % 100 < 10 || blocksN % 100 >= 20) ? "раздела" : "разделов")].filter(Boolean).join(" · ");
  pdf.text(cover, meta, M, A4.h - M - 6, { size: 9.4, color: C.muted, align: "center", width: CW });

  // ── содержание (страницы впишем, когда разложим блоки)
  const toc = pdf.addPage(); toc.foot = foot;
  const where = [];
  const f = flowOf(pdf, foot);
  const two = m.parts.length > 1;
  m.parts.forEach((part) => {
    part.blocks.forEach((b, bi) => {
      f.need(120);
      if (f.y > TOP + 4) f.y += 22;
      const p = f.page;
      if (two && bi === 0) { pdf.text(p, part.where.toUpperCase(), M, f.y + 8, { size: 8.4, font: "bold", color: C.muted, spacing: 1.4 }); f.y += 18; }
      where.push({ title: b.title, part: part.where, first: bi === 0, page: pdf.pages.indexOf(p) + 1 });
      if (b.label) { pdf.text(p, pdf.fit(b.label.toUpperCase(), CW, 8, "bold"), M, f.y + 8, { size: 8, font: "bold", color: C.gold, spacing: 1.3 }); f.y += 14; }
      pdf.wrap(b.title, CW, 18, "bold").slice(0, 3).forEach((ln) => { pdf.text(f.page, ln, M, f.y + 18, { size: 18, font: "bold", color: C.ink }); f.y += 23; });
      pdf.line(f.page, M, f.y + 6, M + 46, f.y + 6, { color: C.goldLine, lw: 1.1 });
      f.y += 18;
      drawBody(f, b.body);
      if (b.photos.length) drawPhotos(f, b.photos);
    });
  });
  // содержание
  let ty = TOP + 10;
  pdf.text(toc, "Содержание", M, ty + 20, { size: 20, font: "bold", color: C.ink });
  ty += 46;
  const lh = where.length > 30 ? 17 : 21;
  for (const w of where) {
    if (ty > BOTTOM - 10) break;
    if (two && w.first) { ty += 6; pdf.text(toc, w.part.toUpperCase(), M, ty + 8, { size: 8.2, font: "bold", color: C.muted, spacing: 1.3 }); ty += 18; }
    const title = pdf.fit(w.title, CW - 60, 11.5, "regular"), tw = pdf.measure(title, 11.5, "regular");
    pdf.text(toc, title, M, ty + 11, { size: 11.5, color: C.text });
    pdf.line(toc, M + tw + 6, ty + 10, M + CW - 24, ty + 10, { color: C.line, lw: 0.6, dash: [1, 2.4] });
    pdf.text(toc, String(w.page), M, ty + 11, { size: 11.5, color: C.ink, align: "right", width: CW });
    ty += lh;
  }
  footers(pdf, true);
  return pdf.save();
}

/** «Лист ознакомления» → байты PDF. */
export function acksPdf(model) {
  const m = cleanAcksModel(model);
  const pdf = newDoc("Лист ознакомления, " + (m.where || m.title), m.where || m.title);
  const foot = "Лист ознакомления · «" + m.title + "»" + (m.where ? " · " + m.where : "");
  const f = flowOf(pdf, foot);
  f.newPage();
  const p = f.page;
  pdf.text(p, "ЛИСТ ОЗНАКОМЛЕНИЯ", M, f.y + 16, { size: 16, font: "bold", color: C.ink, align: "center", width: CW, spacing: 1.2 });
  f.y += 30;
  const what = "с концепцией и стандартами «" + m.title + "»" + (m.sub && m.sub.toLowerCase() !== "концепция и стандарты" ? " (" + m.sub.toLowerCase() + ")" : "");
  pdf.wrap(what, CW - 40, 11.5, "regular").forEach((ln) => { pdf.text(p, ln, M, f.y + 12, { size: 11.5, color: C.text, align: "center", width: CW }); f.y += 16; });
  const sub = [m.where, m.edition ? "редакция от " + m.edition : ""].filter(Boolean).join(", ");
  if (sub) { pdf.text(p, sub, M, f.y + 12, { size: 10, color: C.muted, align: "center", width: CW }); f.y += 16; }
  f.y += 14;
  pdf.wrap("Подписывая лист, сотрудник подтверждает, что ознакомлен с концепцией и стандартами и обязуется их соблюдать.", CW, 9.6, "regular")
    .forEach((ln) => { pdf.text(p, ln, M, f.y + 10, { size: 9.6, color: C.text }); f.y += 13.5; });
  f.y += 12;

  // таблица: № · фамилия и имя · должность · дата · подпись
  const cols = [{ t: "№", w: 26, a: "center" }, { t: "Фамилия, имя", w: 168 }, { t: "Должность", w: 104 }, { t: "Дата", w: 70, a: "center" }, { t: "Подпись", w: CW - 26 - 168 - 104 - 70 }];
  const rowH = 24;
  const head = () => {
    let x = M;
    pdf.rect(f.page, M, f.y, CW, 22, { fill: C.band });
    cols.forEach((c) => { pdf.text(f.page, c.t, x + (c.a === "center" ? 0 : 6), f.y + 14.5, { size: 8.8, font: "bold", color: C.ink, align: c.a === "center" ? "center" : "left", width: c.w }); x += c.w; });
    pdf.rect(f.page, M, f.y, CW, 22, { stroke: C.line, lw: 0.7 });
    f.y += 22;
  };
  head();
  // фамилия первой: «Анна Смирнова» → «Смирнова Анна»
  const fio = (n) => { const w = n.split(/\s+/).filter(Boolean); return w.length >= 2 ? [w[w.length - 1], ...w.slice(0, -1)].join(" ") : n; };
  const all = [...m.rows.map((r) => ({ ...r, name: fio(r.name) })).sort((a, b) => a.name.localeCompare(b.name, "ru")), ...Array.from({ length: m.blanks }, () => ({ name: "", pos: "", at: "" }))];
  all.forEach((r, i) => {
    if (f.y + rowH > BOTTOM - 70) { f.newPage(); head(); }
    let x = M;
    const cells = [String(i + 1), r.name, r.pos, r.at, ""];
    cols.forEach((c, k) => {
      if (cells[k]) pdf.text(f.page, pdf.fit(cells[k], c.w - 10, 9.6, "regular"), x + (c.a === "center" ? 0 : 6), f.y + 15.5, { size: 9.6, color: k === 0 ? C.muted : C.text, align: c.a === "center" ? "center" : "left", width: c.w });
      x += c.w;
      if (k < cols.length - 1) pdf.line(f.page, x, f.y, x, f.y + rowH, { color: C.line, lw: 0.5 });
    });
    pdf.line(f.page, M, f.y + rowH, M + CW, f.y + rowH, { color: C.line, lw: 0.5 });
    pdf.line(f.page, M, f.y, M, f.y + rowH, { color: C.line, lw: 0.7 });
    pdf.line(f.page, M + CW, f.y, M + CW, f.y + rowH, { color: C.line, lw: 0.7 });
    f.y += rowH;
  });
  // подпись руководителя
  f.need(70); f.y += 34;
  // подпись и расшифровка слева, дата справа — не заходят друг на друга
  pdf.text(f.page, "Руководитель", M, f.y, { size: 10, color: C.text });
  pdf.line(f.page, M + 80, f.y + 2, M + 196, f.y + 2, { color: C.ink, lw: 0.6 });
  pdf.text(f.page, "/", M + 202, f.y, { size: 10, color: C.text });
  pdf.line(f.page, M + 212, f.y + 2, M + 318, f.y + 2, { color: C.ink, lw: 0.6 });
  pdf.text(f.page, "«____» __________ 20___ г.", M, f.y, { size: 10, color: C.text, align: "right", width: CW });
  pdf.text(f.page, "подпись", M + 80, f.y + 13, { size: 7.4, color: C.muted, align: "center", width: 116 });
  pdf.text(f.page, "расшифровка", M + 212, f.y + 13, { size: 7.4, color: C.muted, align: "center", width: 106 });
  footers(pdf, false);
  return pdf.save();
}

/** Имена файлов. */
export const conceptFileName = (m) => ("О нас, " + (str(m && m.where, 60) || str(m && m.title, 60) || "концепция")).replace(/[\\/:*?"<>|«»]+/g, "").trim() + ".pdf";
export const acksFileName = (m) => ("Лист ознакомления, " + (str(m && m.where, 60) || str(m && m.title, 60) || "концепция")).replace(/[\\/:*?"<>|«»]+/g, "").trim() + ".pdf";
