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
// v169 (Доп. 494). Владелец (16.11): «Да, давай научим 😉» — раскладывать большой документ сразу на несколько глав; и
// «давай тоже ему дадим выход в сеть, что бы он если что мог найти или проверить информацию😉».
//   ref_plan  — документ (текст или PDF) → список глав { chapters: [{ title, about }] }: одна тема, одна глава;
//   ref_part  — одна глава из этого списка по тому же документу → { title, content };
//   ref_check — проверить факты главы в интернете → { summary, notes: [{ quote, note }] } и ссылки (их отдаёт сервер);
//   ref_amend — поправить текст по отмеченным замечаниям проверки → { content };
//   ref_chapter с web — «Глава по теме» с поиском в интернете (api/_web.js): факты ищутся и сверяются, ссылки видны.
//
// Картинки. Строки [img:ключ] и [photo:номер|подпись] в тексте главы — это схемы и фото. Модель может их потерять или
// выдумать, а потерянная строка фото при записи главы убирает и само фото с сервера (ui/ref-editor.jsx, dropPhotos).
// Поэтому после ответа модели строки сверяются с исходным текстом (keepRefMarks): выдуманные убираются, потерянные
// возвращаются в конец текста, и редактор говорит об этом владельцу.

export const REF_AI_MODES = ["ref_chapter", "ref_improve", "ref_shorten", "ref_plan", "ref_part", "ref_check", "ref_amend"];
/** Пределы: тема, материал для главы, текст для правки за один раз, ответ, наименьший текст для правки */
// (правка за один раз — 6000 знаков: ответ такой длины с запасом умещается в предел ответа модели, 4000 токенов)
// v169: doc — документ для раскладки на главы, docMin — меньше этого на несколько глав не хватит, parts — глав за раз,
// about — «что войдёт в главу», notes — замечаний проверки, quote и note — их длина, fixes — замечания для правки
export const REF_AI_LIMITS = { topic: 160, material: 30000, text: 6000, out: 20000, min: 40,
  doc: 60000, docMin: 200, parts: 8, about: 300, notes: 6, quote: 200, note: 400, fixes: 3000 };

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
const JSON_CHAPTER = 'Ответ — строго JSON без пояснений и без ```: {"title": "…", "content": "…"} (переносы строк в content — \\n).';
// v169: у ассистента есть поиск в интернете (api/_web.js). Это вводная для режимов с поиском; ссылки показывает приложение
export const REF_WEB_SYSTEM = "Ты помогаешь владельцу ресторанной группы вести справочник для сотрудников зала и бара. У тебя есть поиск в интернете: "
  + "ищи на сайтах производителей, в профессиональных справочниках, у школ сервиса и сомелье, в текстах законов и норм. Пиши только то, что "
  + "подтверждают найденные страницы или общепринятые правила ресторанного сервиса; не нашёл подтверждения, так и скажи, без догадок. "
  + "Пиши по-русски. Ссылок, сносок и адресов сайтов в ответ не ставь: ссылки приложение покажет само.";
const WEB_TOPIC = "Найди и проверь в интернете факты по теме: температуры, сроки, пропорции, термины, нормы, классические правила. Хватит одного-трёх поисков. "
  + "Не придумывай правил конкретного заведения, цен, имён и названий блюд; где в разных ресторанах принято по-разному, так и скажи.";
const WEB_NOTES = " Заметки владельца ниже учти обязательно: это правила его ресторана, они важнее найденного в интернете.";
// документ для раскладки на главы: текст, PDF или и то и другое
const DOC = (material, hasPdf) => (material ? "\nДОКУМЕНТ:\n" + material + (hasPdf ? "\n\nПродолжение документа — во вложенном PDF." : "") : "\nДОКУМЕНТ — во вложенном PDF.");
export const REF_PROMPT = {
  // web (v169) — «Глава по теме» с поиском: факты ищутся в интернете, заметки владельца важнее найденного
  chapter: (topic, material, hasPdf, web = false) => [
    `Напиши одну главу справочника для сотрудников ресторана${topic ? ` на тему «${topic}»` : ""}.`,
    web ? WEB_TOPIC + (material ? WEB_NOTES : "") : material || hasPdf
      ? "Опирайся только на материал: правила, цифры, названия и порядок действий — как в нём. Ничего не придумывай и ничего важного не выбрасывай."
      : "Материала нет: пиши по общепринятым правилам ресторанного сервиса. Не придумывай правил конкретного заведения, цен, имён и названий блюд; где в разных ресторанах принято по-разному, так и скажи.",
    "Объём — 150–450 слов: в справочнике важны детали, но без воды. Название главы — коротко, 2–7 слов, без кавычек и точки.",
    REF_STYLE,
    JSON_CHAPTER,
    material ? (web ? "\nЗАМЕТКИ ВЛАДЕЛЬЦА:\n" : "\nМАТЕРИАЛ:\n") + material : hasPdf ? "\nМАТЕРИАЛ — во вложенном PDF." : "",
  ].filter(Boolean).join("\n"),
  // v169: большой документ → список глав; потом каждая глава пишется отдельным обращением (part)
  plan: (material, hasPdf) => [
    "Разложи документ на главы справочника для сотрудников ресторана: одна тема, одна глава.",
    "Глава — законченная тема, которую удобно прочитать за раз (в справочнике это 150–450 слов). Мелкие пункты об одном объединяй, большую тему дели на две-три главы.",
    `Обычно выходит от 2 до ${REF_AI_LIMITS.parts} глав; документ об одном — одна глава. Больше ${REF_AI_LIMITS.parts} не предлагай: бери самое нужное в работе.`,
    "Порядок глав — как в документе. Название — коротко, 2–7 слов, без кавычек, номера и точки.",
    "about — одна-две фразы: что именно из документа войдёт в главу (какие правила, шаги, цифры), так, чтобы главы не пересекались.",
    "Бери только то, что есть в документе. Вступление, реквизиты, подписи, оглавление и лист согласования — не главы.",
    'Ответ — строго JSON без пояснений и без ```: {"chapters": [{"title": "…", "about": "…"}]}',
    DOC(material, hasPdf),
  ].join("\n"),
  part: (title, about, others, material, hasPdf) => [
    `Напиши одну главу справочника для сотрудников ресторана: «${title}». Она пишется по документу ниже.`,
    about ? "Что входит в главу: " + about : "",
    others && others.length ? "Документ разложен на несколько глав. Остальные главы: " + others.map((t) => "«" + t + "»").join(", ") + ". Их содержание сюда не бери: только то, что относится к этой главе." : "",
    "Опирайся только на документ: правила, цифры, названия и порядок действий — как в нём. Ничего не придумывай и ничего важного по теме главы не выбрасывай.",
    "Объём — 150–450 слов: в справочнике важны детали, но без воды. Название оставь как дано.",
    REF_STYLE,
    JSON_CHAPTER,
    DOC(material, hasPdf),
  ].filter(Boolean).join("\n"),
  // v169: проверка фактов в интернете. Правила самого ресторана ассистент не оценивает: это решение владельца
  check: (text) => [
    "Проверь по интернету факты в тексте главы справочника для сотрудников ресторана.",
    "Что проверять: то, что можно сверить с источниками. Температуры и сроки, граммовки и пропорции классических рецептов, термины и названия, происхождение продуктов и напитков, нормы закона, этикета и безопасности.",
    "Что не проверять: порядок работы самого ресторана (кто что делает, когда и как у них принято), цены, внутренние стандарты, тон. Это решение владельца, с ним не спорь.",
    "Найди подтверждение спорным местам: хватит одного-трёх поисков. Замечание пиши только там, где текст расходится с надёжными источниками или сами источники расходятся. Расхождений нет — замечаний нет.",
    `Не больше ${REF_AI_LIMITS.notes} замечаний, самые важные первыми.`,
    'Ответ — строго JSON без пояснений и без ```: {"summary": "…", "notes": [{"quote": "…", "note": "…"}]}',
    "summary — одна-две фразы: что проверено и общий вывод. quote — слова из текста, о которых замечание: дословно и коротко, до 12 слов. note — что не так и как верно по источникам, одна-две фразы.",
    "\nТЕКСТ ГЛАВЫ:\n" + text,
  ].join("\n"),
  amend: (text, fixes) => [
    "Поправь текст главы справочника по замечаниям проверки фактов.",
    "Меняй только то, чего касаются замечания. Остальной текст, его порядок, оформление и объём оставь как есть и ничего не добавляй от себя.",
    REF_STYLE, JSON_CONTENT,
    "\nЗАМЕЧАНИЯ:\n" + fixes,
    "\nТЕКСТ ГЛАВЫ:\n" + text,
  ].join("\n"),
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
/**
 * Просьба к модели для режима; topic — тема или название главы, text — материал, документ или текст главы;
 * x (v169) — { web, about, others, fixes }: поиск в интернете, «что войдёт в главу», остальные главы плана, замечания.
 */
export const refPrompt = (mode, topic, text, hasPdf, x = {}) => (
  mode === "ref_chapter" ? REF_PROMPT.chapter(topic, text, hasPdf, !!(x && x.web))
    : mode === "ref_plan" ? REF_PROMPT.plan(text, hasPdf)
    : mode === "ref_part" ? REF_PROMPT.part(topic, (x && x.about) || "", (x && x.others) || [], text, hasPdf)
    : mode === "ref_check" ? REF_PROMPT.check(text)
    : mode === "ref_amend" ? REF_PROMPT.amend(text, (x && x.fixes) || "")
    : mode === "ref_shorten" ? REF_PROMPT.shorten(text) : REF_PROMPT.improve(text));

/**
 * Чего не хватает, чтобы позвать ассистента: строка для человека или null. Одна проверка у редактора (кнопка не жмётся,
 * под ней причина) и у сервера (до обращения к модели). len — длина текста до обрезки.
 */
export function refAiCheck(mode, { topic = "", text = "", hasPdf = false, len = null, fixes = "" } = {}) {
  const n = len == null ? String(text || "").length : len;
  if (mode === "ref_chapter") {
    if (n > REF_AI_LIMITS.material) return "Текст слишком большой. Дай его частями, одна тема за раз.";
    if (!String(text || "").trim() && !hasPdf && String(topic || "").trim().length < 3) return "Напиши тему, вставь текст или прикрепи PDF.";
    return null;
  }
  if (mode === "ref_plan" || mode === "ref_part") {   // v169: документ на несколько глав
    const has = String(text || "").trim().length;
    if (n > REF_AI_LIMITS.doc) return "Документ слишком большой. Дай его частями.";
    if (!has && !hasPdf) return "Вставь текст документа или прикрепи PDF.";
    if (mode === "ref_plan" && !hasPdf && has < REF_AI_LIMITS.docMin) return "Текста мало для нескольких глав. Одну главу ассистент соберёт в редакторе главы.";
    if (mode === "ref_part" && String(topic || "").trim().length < 3) return "У главы нет названия.";
    return null;
  }
  if (String(text || "").trim().length < REF_AI_LIMITS.min) return "Сначала нужен текст главы, хотя бы пара предложений.";
  if (n > REF_AI_LIMITS.text) return mode === "ref_check" ? "Текст длинный для одной проверки. Выдели часть, и ассистент проверит её." : "Текст длинный для одного раза. Выдели часть, и ассистент поправит её.";
  if (mode === "ref_amend" && !String(fixes || "").trim()) return "Отметь хотя бы одно замечание.";
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
const one = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const bareTitle = (t) => cut(t, REF_AI_LIMITS.topic).replace(/\s+/g, " ").trim().replace(/^[«"]+|[»".]+$/g, "").trim();
/** Режимы, у которых ответ — новая глава с названием (картинок у неё нет) */
export const REF_NEW_MODES = ["ref_chapter", "ref_part"];
/**
 * v169: следы ссылок из ответа с поиском — [слово](адрес) → слово; сноски [1], 【…】, (адрес) и голые адреса убираются.
 * В главе ссылок нет: их показывает приложение под ответом. Строки картинок не трогаются.
 */
export function refNoLinks(text) {
  return String(text == null ? "" : text).split("\n").map((l) => (REF_MARK_LINE.test(l) ? l : l
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^)\s]+\)/g, "$1")
    .replace(/[ \t]*\((?:https?:\/\/[^)\s]+|\[\d{1,2}\])\)/g, "")
    .replace(/[ \t]*(?:\[\d{1,2}\]|【[^】\n]*】)/g, "")
    .replace(/[ \t]*https?:\/\/[^\s)»"]+/g, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1"))).join("\n");
}
/**
 * Ответ модели → только то, что нужно редактору: { title?, content, lost } или null. src — исходный текст главы (для
 * правки и сокращения): его картинки сохраняются. У новой главы картинок нет — выдуманные убираются. web (v169) —
 * ответ с поиском: из текста убираются следы ссылок.
 */
export function refAiClean(mode, o, src = "", web = false) {
  if (!o || typeof o !== "object" || !REF_AI_MODES.includes(mode) || mode === "ref_plan" || mode === "ref_check" || typeof o.content !== "string") return null;
  const raw = cut(web ? refNoLinks(o.content) : o.content, REF_AI_LIMITS.out).trim();
  if (!raw) return null;
  const fresh = REF_NEW_MODES.includes(mode);
  const kept = keepRefMarks(fresh ? "" : src, raw);
  if (!kept.text) return null;
  const out = { content: kept.text, lost: kept.lost };
  if (fresh) out.title = bareTitle(o.title);
  return out;
}

// ── v169: документ на несколько глав ──
const tkey = (t) => String(t == null ? "" : t).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();
/** Ответ модели на «разложи документ» → { chapters: [{ title, about }] } (без повторов названий, не больше parts) или null */
export function refPlanClean(o) {
  const list = o && typeof o === "object" ? (Array.isArray(o) ? o : Array.isArray(o.chapters) ? o.chapters : null) : null;
  if (!list) return null;
  const seen = new Set(), chapters = [];
  for (const c of list) {
    // «1. Встреча гостя» и «Глава 2: Подача» — без номера; «5 шагов сервиса» — название, цифра остаётся
    const title = bareTitle(typeof c === "string" ? c : c && c.title).replace(/^(?:глава\s*\d+[.):]?\s+|\d+[.)]\s+)/i, "").trim();
    const k = tkey(title);
    if (title.length < 3 || !k || seen.has(k)) continue;
    seen.add(k);
    chapters.push({ title, about: one(c && typeof c === "object" ? c.about : "", REF_AI_LIMITS.about) });
    if (chapters.length >= REF_AI_LIMITS.parts) break;
  }
  return chapters.length ? { chapters } : null;
}
/** Строки плана для редактора: глава, название которой в разделе уже есть, приходит без галочки (dup) */
export function refPlanRows(chapters, existing = []) {
  const have = new Set((Array.isArray(existing) ? existing : []).map(tkey).filter(Boolean));
  return (Array.isArray(chapters) ? chapters : []).filter((c) => c && c.title).map((c) => { const dup = have.has(tkey(c.title)); return { title: String(c.title), about: String(c.about || ""), on: !dup, dup }; });
}

// ── v169: проверка фактов в интернете ──
/** Ответ модели на «проверь факты» → { summary, notes: [{ quote, note }] } или null (ни вывода, ни замечаний) */
export function refCheckClean(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const notes = [];
  for (const x of Array.isArray(o.notes) ? o.notes : []) {
    if (!x || typeof x !== "object") continue;
    const note = one(refNoLinks(x.note), REF_AI_LIMITS.note), quote = one(x.quote, REF_AI_LIMITS.quote).replace(/^[«"]+|[»"]+$/g, "").trim();
    if (!note) continue;
    notes.push({ quote, note });
    if (notes.length >= REF_AI_LIMITS.notes) break;
  }
  const summary = one(refNoLinks(o.summary), 300);
  return notes.length || summary ? { summary, notes } : null;
}
/** Отмеченные замечания → текст для просьбы «поправь по замечаниям»: «1. «слова из текста»: что не так» */
export const refFixesText = (notes) => (Array.isArray(notes) ? notes : []).filter((x) => x && x.note)
  .map((x, i) => (i + 1) + ". " + (x.quote ? "«" + x.quote + "»: " : "") + x.note).join("\n").slice(0, REF_AI_LIMITS.fixes);
const okUrl = (u) => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "")) && String(u).length <= 400;
/** Ссылки из ответа сервера: только http(s), не больше шести → [{ url, title }] */
export const refSources = (list) => (Array.isArray(list) ? list : []).filter((x) => x && typeof x === "object" && okUrl(x.url)).slice(0, 6)
  .map((x) => ({ url: String(x.url), title: one(x.title, 100) }));

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
