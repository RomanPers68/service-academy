// lib/ref-ai.js — v168 (Доп. 493): ассистент редактора справочника. Здесь то, что общее у сервера (api/lesson-assist.js),
// редактора (ui/ref-assist.jsx) и демо: режимы, просьбы к модели, разбор ответа, сохранность картинок в тексте главы,
// работа с выделенным фрагментом. Модуль ни от чего не зависит: его подключает и серверная функция Vercel.
//
// Владелец (15.11): «Редактор должен быть гибким и удобным. Включая все фишки и ai-ассистента». Что умеет ассистент:
//   ref_chapter — глава из материала (текст, заметки или PDF) или по теме без материала → { title, content };
//   ref_improve — улучшить текст главы или выделенный фрагмент: яснее, без ошибок, факты те же → { content };
//   ref_shorten — сократить примерно на треть, правила и цифры остаются → { content }.
// Всё приходит черновиком: в главу текст берёт владелец, записывает тоже он.
//
// Картинки. Строки [img:ключ] и [photo:номер|подпись] в тексте главы — это схемы и фото. Модель может их потерять или
// выдумать, а потерянная строка фото при записи главы убирает и само фото с сервера (ui/ref-editor.jsx, dropPhotos).
// Поэтому после ответа модели строки сверяются с исходным текстом (keepRefMarks): выдуманные убираются, потерянные
// возвращаются в конец текста, и редактор говорит об этом владельцу.

export const REF_AI_MODES = ["ref_chapter", "ref_improve", "ref_shorten"];
/** Пределы: тема, материал для главы, текст для правки за один раз, ответ, наименьший текст для правки */
// (правка за один раз — 6000 знаков: ответ такой длины с запасом умещается в предел ответа модели, 4000 токенов)
export const REF_AI_LIMITS = { topic: 160, material: 30000, text: 6000, out: 20000, min: 40 };

// Разметка — та, что рисует экран главы (ui/ReferenceSection.jsx, Content). Пометка PURE — для сборщика: просьбы к
// модели нужны только серверу, и в кусок редактора (в телефон владельца) этот текст попадать не должен.
export const REF_STYLE = /* @__PURE__ */ [
  "Стиль глав справочника приложения Service Academy (ресторан):",
  "— справочный тон: спокойно, точно и по делу, на «ты»; без воды и канцелярита; короткие абзацы;",
  "— подзаголовок — отдельной строкой целиком в **двойных звёздочках**;",
  "— список — каждая строка начинается с «• »; шаги по порядку — строки «1. », «2. », «3. »;",
  "— важное правило — отдельной строкой, начинается с «\u{1F4CC} »;",
  "— как правильно и как неправильно — строки, начинающиеся с «\u2705 » и «\u274C »;",
  "— ключевое слово внутри строки можно выделить **двойными звёздочками**;",
  "— никаких других разметок (#, _, таблиц, HTML);",
  "— строки вида [img:…] и [photo:…] — это картинки: переноси их без изменений, каждую отдельной строкой, рядом с тем же текстом; новых не придумывай.",
  "Каждая фраза договорена до конца.",
].join("\n");

const JSON_CONTENT = 'Ответ — строго JSON без пояснений и без ```: {"content": "…"} (переносы строк в content — \\n).';
export const REF_PROMPT = {
  chapter: (topic, material, hasPdf) => [
    `Напиши одну главу справочника для сотрудников ресторана${topic ? ` на тему «${topic}»` : ""}.`,
    material || hasPdf
      ? "Опирайся только на материал: правила, цифры, названия и порядок действий — как в нём. Ничего не придумывай и ничего важного не выбрасывай."
      : "Материала нет: пиши по общепринятым правилам ресторанного сервиса. Не придумывай правил конкретного заведения, цен, имён и названий блюд; где в разных ресторанах принято по-разному, так и скажи.",
    "Объём — 150–450 слов: в справочнике важны детали, но без воды. Название главы — коротко, 2–7 слов, без кавычек и точки.",
    REF_STYLE,
    'Ответ — строго JSON без пояснений и без ```: {"title": "…", "content": "…"} (переносы строк в content — \\n).',
    material ? "\nМАТЕРИАЛ:\n" + material : hasPdf ? "\nМАТЕРИАЛ — во вложенном PDF." : "",
  ].filter(Boolean).join("\n"),
  improve: (text) => [
    "Улучши текст главы справочника: яснее, без ошибок и повторов; подзаголовки, списки и пометки — там, где они помогают читать.",
    "Смысл, факты, цифры и правила не меняй и ничего не добавляй от себя. Объём — примерно тот же.",
    REF_STYLE, JSON_CONTENT,
    "\nТЕКСТ ГЛАВЫ:\n" + text,
  ].join("\n"),
  shorten: (text) => [
    "Сократи текст главы справочника примерно на треть: убери повторы, воду и очевидное.",
    "Все правила, цифры, шаги и предупреждения сохрани. Ничего не добавляй от себя.",
    REF_STYLE, JSON_CONTENT,
    "\nТЕКСТ ГЛАВЫ:\n" + text,
  ].join("\n"),
};
/** Просьба к модели для режима; topic — тема главы, text — материал или текст главы */
export const refPrompt = (mode, topic, text, hasPdf) => (mode === "ref_chapter" ? REF_PROMPT.chapter(topic, text, hasPdf) : mode === "ref_shorten" ? REF_PROMPT.shorten(text) : REF_PROMPT.improve(text));

/**
 * Чего не хватает, чтобы позвать ассистента: строка для человека или null. Одна проверка у редактора (кнопка не жмётся,
 * под ней причина) и у сервера (до обращения к модели). len — длина текста до обрезки.
 */
export function refAiCheck(mode, { topic = "", text = "", hasPdf = false, len = null } = {}) {
  const n = len == null ? String(text || "").length : len;
  if (mode === "ref_chapter") {
    if (n > REF_AI_LIMITS.material) return "Текст слишком большой. Дай его частями, одна тема за раз.";
    if (!String(text || "").trim() && !hasPdf && String(topic || "").trim().length < 3) return "Напиши тему, вставь текст или прикрепи PDF.";
    return null;
  }
  if (String(text || "").trim().length < REF_AI_LIMITS.min) return "Сначала нужен текст главы, хотя бы пара предложений.";
  if (n > REF_AI_LIMITS.text) return "Текст длинный для одного раза. Выдели часть, и ассистент поправит её.";
  return null;
}

// ── картинки в тексте ──
export const REF_MARK_LINE = /^[ \t]*\[(?:img|photo):[^\n]*\][ \t]*$/;   // как у экрана главы: подпись фото может содержать скобки
/** Строки картинок в тексте, по порядку (обрезанные по краям) */
export const refMarkLines = (text) => String(text == null ? "" : text).split("\n").filter((l) => REF_MARK_LINE.test(l)).map((l) => l.trim());
/**
 * Картинки после ответа модели — как в исходном тексте src: выдуманные строки убираются, потерянные возвращаются в конец
 * (каждая своей строкой). Повтор строки сверх исходного числа тоже убирается. → { text, lost } (lost — сколько вернули).
 */
export function keepRefMarks(src, out) {
  const marks = refMarkLines(src), room = new Map(), have = new Map();
  for (const m of marks) room.set(m, (room.get(m) || 0) + 1);
  const lines = [];
  for (const l of String(out == null ? "" : out).replace(/\r/g, "").split("\n")) {
    if (!REF_MARK_LINE.test(l)) { lines.push(l); continue; }
    const k = l.trim(), n = have.get(k) || 0;
    if (n < (room.get(k) || 0)) { have.set(k, n + 1); lines.push(k); }   // выдуманная или лишний повтор — не берём
  }
  const back = [];   // потерянные — в том порядке, в каком стояли в исходном тексте
  for (const m of marks) { const n = have.get(m) || 0; if (n > 0) have.set(m, n - 1); else back.push(m); }
  let text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (back.length) text = (text ? text + "\n\n" : "") + back.join("\n");
  return { text, lost: back.length };
}

const cut = (s, n) => String(s == null ? "" : s).replace(/\r/g, "").slice(0, n);
/**
 * Ответ модели → только то, что нужно редактору: { title?, content, lost } или null. src — исходный текст главы (для
 * правки и сокращения): его картинки сохраняются. У новой главы картинок нет — выдуманные убираются.
 */
export function refAiClean(mode, o, src = "") {
  if (!o || typeof o !== "object" || !REF_AI_MODES.includes(mode) || typeof o.content !== "string") return null;
  const raw = cut(o.content, REF_AI_LIMITS.out).trim();
  if (!raw) return null;
  const kept = keepRefMarks(mode === "ref_chapter" ? "" : src, raw);
  if (!kept.text) return null;
  const out = { content: kept.text, lost: kept.lost };
  if (mode === "ref_chapter") out.title = cut(o.title, REF_AI_LIMITS.topic).replace(/\s+/g, " ").trim().replace(/^[«"]+|[»".]+$/g, "").trim();
  return out;
}

// ── выделенный фрагмент ──
/**
 * Что отдать ассистенту: выделение, доведённое до целых строк, если в нём хватает текста, иначе вся глава.
 * → { text, s, e, part } (s, e — границы в тексте главы; part — это фрагмент, а не всё).
 */
export function refFragment(body, s, e) {
  const t = String(body == null ? "" : body);
  const a = Math.max(0, Math.min(t.length, Math.min(s, e) || 0)), b = Math.max(a, Math.min(t.length, Math.max(s, e) || 0));
  const all = { text: t, s: 0, e: t.length, part: false };
  if (b - a < REF_AI_LIMITS.min) return all;
  const ls = a === 0 ? 0 : t.lastIndexOf("\n", a - 1) + 1;
  const eb = t[b - 1] === "\n" ? b - 1 : b;
  let le = t.indexOf("\n", eb); if (le < 0) le = t.length;
  const text = t.slice(ls, le);
  if (text.trim().length < REF_AI_LIMITS.min || (ls === 0 && le === t.length)) return all;
  return { text, s: ls, e: le, part: true };
}
/**
 * Поставить ответ на место фрагмента. Текст главы за время ожидания могли поправить: фрагмент ищется на прежнем месте,
 * потом по содержимому; не нашёлся — null (редактор скажет, что текст изменился).
 */
export function refApplyFragment(body, frag, result) {
  const t = String(body == null ? "" : body), r = String(result == null ? "" : result).trim();
  if (!frag || !frag.part) return r;
  if (t.slice(frag.s, frag.e) === frag.text) return t.slice(0, frag.s) + r + t.slice(frag.e);
  const i = t.indexOf(frag.text);
  if (i < 0 || t.indexOf(frag.text, i + 1) >= 0) return null;
  return t.slice(0, i) + r + t.slice(i + frag.text.length);
}

/**
 * Что станет с текстом главы, когда владелец берёт ответ ассистента. fixed — это правка (улучшить, сократить), иначе
 * новая глава; how — "replace" или "append" (для новой главы). → { body, pics } или null (фрагмент не найден: текст
 * главы успели поменять). Когда меняется весь текст, картинки того, что сейчас в главе, остаются — в конце нового
 * (pics — сколько их перенесено): фото прежнего текста, или вставленное, пока ассистент думал, иначе пропало бы из
 * главы, а при записи и с сервера. Убранную за это время картинку ответ не возвращает.
 */
export function refTake(body, { fixed = false, frag = null, content = "", how = "replace" } = {}) {
  const was = String(body == null ? "" : body), res = String(content == null ? "" : content).trim();
  let next, whole;
  if (fixed) {
    next = refApplyFragment(was, frag, res);
    if (next === null) return null;
    whole = !frag || !frag.part;
  } else {
    whole = how !== "append" || !was.trim();
    next = whole ? res : was.replace(/\s+$/, "") + "\n\n" + res;
  }
  if (!whole) return { body: next, pics: 0 };
  const kept = keepRefMarks(was, next);
  return { body: kept.text, pics: kept.lost };
}
