// scripts/check-content.mjs — автопроверка контента перед выкаткой.
// Запуск: npm run check:content
// Проверяет всё, что раньше ловилось вручную:
//  1. Синтаксис и загрузка всех файлов данных (битый файл = падение сборки)
//  2. Структуру вопросов: варианты, индекс правильного, дубликаты
//  3. Банк собеседования: длины вариантов (правильный не должен выдавать
//     себя длиной), компетенции, вопросы-приоритеты
//  4. Типовые опечатки: «в течении», тся/ться, двойные пробелы,
//     пробел перед знаком, дефис вместо тире
//  5. Согласованность стандартов времени: контакт — 10 секунд,
//     подход к столу — 2 минуты
// Выход с кодом 1, если есть ошибки (для CI); предупреждения не валят сборку.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warns = [];
const ok = (msg) => console.log("  ✓", msg);

// ── 1. Загрузка данных ──────────────────────────────────────────────
console.log("1. Загрузка файлов данных");
let MODULES, SPG, CAND, GLOSSARY, DIALOGUES;
try {
  ({ MODULES } = await import(join(ROOT, "data/modules.js")));
  ({ SPG_MODULES: SPG } = await import(join(ROOT, "data/modules-spg.js")));
  ({ CANDIDATE_QUESTIONS: CAND } = await import(join(ROOT, "data/candidate-questions.js")));
  ({ GLOSSARY } = await import(join(ROOT, "data/glossary.js")));
  ({ DIALOGUES_DATA: DIALOGUES } = await import(join(ROOT, "data/dialogues.js")));
  await import(join(ROOT, "data/reference.js"));
  await import(join(ROOT, "data/menu.js"));
  // reviews.js использует Vite-импорт без расширения (node так не умеет) —
  // проверяем баланс скобок вместо загрузки; сборка Vite проверит остальное.
  {
    const src = readFileSync(join(ROOT, "data/reviews.js"), "utf-8")
      .replace(/`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/[^\n]*/gs, "");
    for (const [a, b] of [["{", "}"], ["(", ")"], ["[", "]"]])
      if (src.split(a).length !== src.split(b).length)
        errors.push(`data/reviews.js: дисбаланс скобок ${a}${b}`);
  }
  ok("все файлы данных импортируются/валидны");
} catch (e) {
  errors.push("данные не загружаются: " + e.message);
}

// ── 2. Структура вопросов уроков ───────────────────────────────────
console.log("2. Структура вопросов уроков");
if (MODULES) {
  const roles = { ...MODULES, spg: SPG || MODULES.spg };
  let nQuiz = 0, nPractice = 0;
  for (const [rid, mods] of Object.entries(roles)) {
    const seen = new Map();
    for (const m of mods || []) {
      for (const l of m.lessons || []) {
        if (l.type === "quiz") {
          for (const q of l.questions || []) {
            nQuiz++;
            if (!q.q || !Array.isArray(q.options) || q.options.length < 2)
              errors.push(`[${rid}/${m.id}/${l.id}] вопрос без вариантов: ${String(q.q).slice(0, 50)}`);
            else if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= q.options.length)
              errors.push(`[${rid}/${m.id}/${l.id}] индекс correct вне диапазона: ${q.q.slice(0, 50)}`);
            const key = (q.q || "").trim().toLowerCase();
            if (seen.has(key)) warns.push(`[${rid}] дубликат вопроса в ${l.id} и ${seen.get(key)}: «${q.q.slice(0, 60)}»`);
            else seen.set(key, l.id);
          }
        }
        {
          for (const it of l.situations || []) {
            nPractice++;
            if ((it.genre === "action" || it.genre === "find") &&
                (!Array.isArray(it.options) || typeof it.correct !== "number" ||
                 it.correct < 0 || it.correct >= it.options.length))
              errors.push(`[${rid}/${m.id}/${l.id}] практика с битым correct: ${(it.question || it.scene || "").slice(0, 50)}`);
          }
        }
      }
    }
  }
  ok(`проверено ${nQuiz} вопросов и ${nPractice} практик`);
}

// ── 3. Банк собеседования ──────────────────────────────────────────
console.log("3. Банк собеседования кандидатов");
if (CAND) {
  const COMPS = new Set([
    "Сервис и гость", "Конфликты и сложные ситуации", "Приоритеты и организация",
    "Честность и деньги", "Команда", "Команда и люди", "Гигиена и стандарты",
    "Гигиена и безопасность", "Продукт и подача", "Расчёт и деньги", "Общие стандарты",
  ]);
  for (const [role, arr] of Object.entries(CAND)) {
    for (const [i, q] of arr.entries()) {
      const tag = `[собеседование/${role}#${i}]`;
      if (!Array.isArray(q.options) || q.options.length !== 4)
        errors.push(`${tag} должно быть ровно 4 варианта`);
      if (!q.comp || !COMPS.has(q.comp)) warns.push(`${tag} неизвестная компетенция: ${q.comp}`);
      if (!["base", "pro"].includes(q.level)) errors.push(`${tag} level должен быть base|pro`);
      if (q.type === "order") {
        const sorted = [...(q.order || [])].sort().join(",");
        if (sorted !== "0,1,2,3") errors.push(`${tag} order должен быть перестановкой 0..3`);
      } else {
        if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3)
          errors.push(`${tag} индекс correct вне диапазона`);
        // Правильный ответ не должен вычисляться длиной
        const lens = q.options.map(o => o.length);
        if (lens[q.correct] === Math.max(...lens) && Math.max(...lens) - Math.min(...lens) > 15)
          errors.push(`${tag} правильный ответ заметно длиннее остальных — переформулируй`);
      }
    }
    ok(`${role}: ${arr.length} вопросов в порядке`);
  }
}

// ── 4. Типовые опечатки в текстах данных ───────────────────────────
console.log("4. Типовые опечатки");
{
  const CHECKS = [
    [/\bв течении\b/gi, "«в течении» → «в течение»"],
    [/\b(может|должен|должна|нужно|надо|чтобы|будет|хочет)\s+\p{L}+тся\b/giu, "возможная ошибка тся/ться"],
    [/\p{L}  +\p{L}/gu, "двойной пробел"],
    [/[а-яё] [,.!?;:](?![.)])/g, "пробел перед знаком препинания"],
    [/[а-яё] - [а-яё]/g, "дефис вместо тире (нужно « — »)"],
  ];
  let found = 0;
  for (const f of readdirSync(join(ROOT, "data")).filter(f => f.endsWith(".js"))) {
    const lines = readFileSync(join(ROOT, "data", f), "utf-8").split("\n");
    lines.forEach((line, i) => {
      for (const [rx, label] of CHECKS) {
        rx.lastIndex = 0;
        const m = rx.exec(line);
        if (m) { warns.push(`data/${f}:${i + 1} ${label}: …${line.slice(Math.max(0, m.index - 25), m.index + 35)}…`); found++; }
      }
    });
  }
  found ? console.log(`  ! найдено подозрительных мест: ${found}`) : ok("опечаток по шаблонам не найдено");
}

// ── 5. Стандарты времени: контакт 10 сек, подход 2 мин ─────────────
console.log("5. Согласованность стандартов времени");
{
  let bad = 0;
  for (const f of ["modules.js", "modules-spg.js", "dialogues.js"]) {
    const lines = readFileSync(join(ROOT, "data", f), "utf-8").split("\n");
    lines.forEach((line, i) => {
      // «первый контакт … 2 минут» или «подход … 10 секунд» — признак путаницы
      if (/(первый|зрительный) контакт(?![^.»"]{0,60}10 секунд)[^.»"]{0,60}2 минут/i.test(line) ||
          /подход(?![^.»"]{0,60}2 минут)[^.»"]{0,60}10 секунд/i.test(line)) {
        warns.push(`data/${f}:${i + 1} возможная путаница стандартов времени: …${line.trim().slice(0, 90)}…`);
        bad++;
      }
    });
  }
  bad ? console.log(`  ! подозрительных мест: ${bad}`) : ok("контакт — 10 сек, подход — 2 мин: противоречий нет");
}

// ── Итог ────────────────────────────────────────────────────────────
console.log("\n──────────────────────────────");
if (warns.length) {
  console.log(`Предупреждения (${warns.length}):`);
  warns.slice(0, 30).forEach(w => console.log("  ⚠", w));
  if (warns.length > 30) console.log(`  … и ещё ${warns.length - 30}`);
}
if (errors.length) {
  console.log(`ОШИБКИ (${errors.length}):`);
  errors.forEach(e => console.log("  ✗", e));
  console.log("\nПроверка НЕ пройдена — исправь ошибки перед выкаткой.");
  process.exit(1);
}
console.log(warns.length ? "Проверка пройдена (просмотри предупреждения)." : "Проверка пройдена — контент чист. ✨");
