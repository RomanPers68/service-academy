// api/lesson-assist.js — ассистент редактора контента (правка 156).
// Vercel превращает файл в серверную функцию POST /api/lesson-assist.
//
// Три режима — всё приходит ЧЕРНОВИКОМ, сохраняет только человек в редакторе:
//   lesson    — урок из материала: текст регламента/заметок и/или PDF → { title, content }
//   improve   — улучшить текст урока: яснее, короче, без ошибок, факты те же → { content }
//   questions — вопросы к тесту по тексту урока → { questions: [{ q, options, correct, explanation }] }
//   situations — «Практика ситуаций» по тексту урока (правка 158; v40 — все шесть видов, как в приложении) →
//                { situations: [{ genre, emoji, …поля вида, win, fail }] }:
//                action / find / timer — scene, question, options, correct;
//                empathy — guestThought, scene, question, options, correct;
//                truefalse — statement, isTrue, correct, question «Это верно?», options [«✅ Верно», «❌ Неверно»];
//                complete — start, options (продолжения), correct, question «Выбери правильное продолжение:»
//   build      — «Сборка» напитка по рецепту (правка 160) →
//                { build: { title, glass, tint, win, lose, steps: [{ label, q, cost, options: [{ t, ok, fb }] }] } }
//   dialogue   — «Живой диалог» по тексту урока (правка 159) →
//                { dialogue: { guest: { name, avatar, context, mood }, steps: [action|guest|choice] } }
//
// Ключ — тот же OPENROUTER_API_KEY, что у импорта меню (Vercel → Settings →
// Environment Variables); отдельный не нужен. Модель по умолчанию —
// google/gemini-2.5-flash: дешёвая, хорошо пишет по-русски и читает PDF; запасная —
// anthropic/claude-sonnet-4.6. Сменить без правки кода — OPENROUTER_LESSON_MODEL.
//
// Защита как у импорта меню: живая сессия (whoami), только руководители
// (как и сам редактор), не больше 40 обращений в час на человека.
import { verifySession, rateLimit } from "./_auth.js";

const MODELS = [process.env.OPENROUTER_LESSON_MODEL, "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"]
  .filter((m, i, a) => m && a.indexOf(m) === i);

const ROLE_RU = {
  seasonal: "новички-официанты в первые недели", core: "официанты", spg: "хостес (служба приёма гостей)",
  bar: "бармены", manager: "менеджеры зала", service_manager: "сервис-менеджеры",
};

// Стиль — как у штатных уроков приложения: так их рисует экран урока
// v41 (Доп. 354): фраза договорена до конца — как «…хотелось бы потише и чтоб малышу было где.» (где что?)
const WHOLE = "Каждая фраза договорена до конца: не обрывай мысль на предлоге, союзе, «во время», «вместо» или «было где / чем» — «чтобы малышу было где устроиться», а не «чтобы малышу было где».";
const STYLE = [
  "Стиль уроков приложения Service Academy (ресторан «Два моря»):",
  "— на «ты», живо и по делу, без канцелярита и воды; короткие абзацы;",
  "— подзаголовок — отдельной строкой целиком в **двойных звёздочках**;",
  "— список — каждая строка начинается с «• »;",
  "— точная фраза гостю — отдельной строкой в «ёлочках»;",
  "— хорошо/плохо — строки, начинающиеся с «✅ » и «❌ »;",
  "— никаких других разметок (#, _, таблиц, HTML).",
  "Не выдумывай фактов, цен, блюд, имён и правил, которых нет в исходном материале.",
  WHOLE,
].join("\n");

export const PROMPT = {
  lesson: (role, material) => [
    `Сделай один урок для сотрудников ресторана — ${ROLE_RU[role] || "сотрудники зала"} — из материала ниже.`,
    "Объём текста урока — 150–450 слов. Название — коротко, 2–6 слов.",
    STYLE,
    'Ответ — строго JSON без пояснений и без ```: {"title": "…", "content": "…"} (переносы строк в content — \\n).',
    material ? "\nМАТЕРИАЛ:\n" + material : "\nМАТЕРИАЛ — во вложенном PDF.",
  ].join("\n"),
  improve: (role, text) => [
    "Улучши текст урока: яснее, короче, без ошибок и повторов, в стиле ниже.",
    "Смысл, факты, цифры и правила не меняй и ничего не добавляй от себя.",
    STYLE,
    'Ответ — строго JSON без пояснений и без ```: {"content": "…"}',
    "\nТЕКСТ УРОКА:\n" + text,
  ].join("\n"),
  questions: (role, text, title) => [
    `Составь 4 вопроса для теста по уроку «${title || "без названия"}» для: ${ROLE_RU[role] || "сотрудники зала"}.`,
    "Каждый вопрос — ситуация из работы или проверка важного правила из урока. 4 варианта ответа,",
    "ровно один верный; неверные — правдоподобные ошибки новичка, не абсурд. Опирайся только на текст урока.",
    "Все варианты — примерно одной длины и одинаково уверенные: верный не должен выделяться ни длиной, ни подробностью (иначе его угадывают, не читая).",
    "Пояснение — одной фразой: почему верный ответ верный.",
    WHOLE,
    'Ответ — строго JSON без пояснений и без ```: {"questions": [{"q": "…", "options": ["…","…","…","…"], "correct": 0, "explanation": "…"}]}',
    "\nТЕКСТ УРОКА:\n" + text,
  ].join("\n"),
  review: (role, text, title) => [
    `Напиши отзыв гостя для «Книги отзывов» ресторана по разделу обучения «${title || "раздел"}» (${ROLE_RU[role] || "сотрудники зала"}).`,
    "2–4 предложения от лица гостя: тепло, живо и конкретно — что сотрудник сделал так, что захотелось вернуться; опирайся на уроки раздела ниже. Без имён сотрудников, без цен и блюд, которых нет в тексте.",
    "guest — кто гость, 2–4 слова («Пара на годовщине», «Семья с детьми»); table — «стол N».",
    'Ответ — строго JSON без пояснений и без ```: {"review": {"guest": "…", "table": "стол 5", "text": "…"}}',
    "\nУРОКИ РАЗДЕЛА:\n" + text,
  ].join("\n"),
  build: (role, recipe) => [
    "Составь «Сборку» — пошаговый тренажёр приготовления напитка для барменов по рецепту ниже.",
    "5–7 шагов по порядку приготовления: бокал, основа, лёд, алкоголь, долив или метод, гарниш — только то, что есть в рецепте.",
    "Шаг: label — 1–2 слова («Бокал», «Лёд»…); q — вопрос бармену; ровно 4 варианта: один верный (ok: true) — строго по рецепту, с объёмами в мл; три неверных — правдоподобные ошибки (на глаз, не тот бокал, не тот лёд, не тот метод); fb — объяснение к каждому варианту одной фразой; cost — цена ошибки на этом шаге, коротко («напиток выдохнется до второго глотка»).",
    "glass — форма бокала для картинки, одна из: high (хайбол, коллинз), rocks (олд фэшн), coupe (купе, мартини), wine (винный), pint (пинта). tint — цвет готового напитка в HEX (#RRGGBB).",
    "win — фраза при чистой сборке, lose — при ошибках, по одной. Опирайся строго на рецепт — дозы, бокал, лёд, метод, гарниш как в нём, ничего не выдумывай.",
    'Ответ — строго JSON без пояснений и без ```: {"build": {"title": "…", "glass": "rocks", "tint": "#B8352A", "win": "…", "lose": "…", "steps": [{"label": "Бокал", "q": "…", "cost": "…", "options": [{"t": "…", "ok": true, "fb": "…"}, {"t": "…", "fb": "…"}]}]}}',
    "\nРЕЦЕПТ:\n" + recipe,
  ].join("\n"),
  dialogue: (role, text, title, idea) => [
    `Составь «Живой диалог» — тренажёр разговора с гостем по уроку «${title || "без названия"}» для: ${ROLE_RU[role] || "сотрудники зала"}.`,
    idea ? "Ситуация разговора: " + idea : "Ситуацию выбери сам — самую жизненную для этого урока.",
    "Гость: имя, аватар (один эмодзи человека), контекст — кто он, зачем пришёл, в каком настроении (1–2 предложения), начальное настроение mood от 1 до 5 (3 — нейтрально).",
    "Шаги по порядку, 8–12 штук: action — что происходит (коротко, от третьего лица); guest — реплика гостя (живая, разговорная); choice — вопрос сотруднику и ровно 3 варианта ответа.",
    "В choice: один вариант верный (correct: true, moodDelta: 1), два неверных — правдоподобные ошибки (correct: false, moodDelta: 0 или -1); feedback — почему так, одной фразой. Сделай 3–4 choice.",
    "Все три варианта — одной длины (разница не больше пятой части), одинаково вежливые и уверенные: верный НЕ выделяется ни длиной, ни тоном. Неверный — ловушка: звучит профессионально, но в нём одна ошибка по уроку (пообещал, не проверив; решил за гостя; верное действие не вовремя; перестарался; переложил на другого). feedback неверного — что в нём подкупает и в чём ошибка («Звучит заботливо, но…»).",
    "Опирайся на текст урока. Реплики сотрудника — на «вы» к гостю.",
    "tip — итог разговора: главная мысль урока одной фразой, покажется в конце.",
    'Ответ — строго JSON без пояснений и без ```: {"dialogue": {"tip": "…", "guest": {"name": "…", "avatar": "👔", "context": "…", "mood": 3}, "steps": [{"type": "action", "text": "…"}, {"type": "guest", "text": "…"}, {"type": "choice", "prompt": "…", "options": [{"text": "…", "correct": true, "feedback": "…", "moodDelta": 1}]}]}}',
    "\nТЕКСТ УРОКА:\n" + text,
  ].join("\n"),
  // v40: все шесть видов практики — как в приложении и по правилам docs/ОТВЕТЫ-С-ПОДВОХОМ.md (v37–v39)
  situations: (role, text, title) => [
    `Составь 6 ситуаций для «Практики ситуаций» по уроку «${title || "без названия"}» для: ${ROLE_RU[role] || "сотрудники зала"} — по одной каждого вида (genre), в таком порядке: action, find, empathy, truefalse, complete, timer. Если для вида в уроке нет материала — вместо него сделай ещё одну action.`,
    "Виды и их поля:",
    "— action («Что делаешь?»): scene — короткая сцена из смены, 1–3 предложения, от второго лица («Ты…», «Гость…»); question — «Что делаешь?»; options — 4 действия.",
    "— find («Найди ошибку»): в scene сотрудник ошибается; question спрашивает, что не так («Что не так?»), а не «что делаешь?»; options — 4 варианта того, в чём ошибка.",
    "— empathy («Глазами гостя»): guestThought — мысли гостя от первого лица, 1–2 предложения, и они совпадают со сценой (то, что гость видит и чувствует в ней); scene — что происходит; question — про чувства гостя и про то, что их создаёт или что сделать («Что чувствует гость и что сделать?»); options — 4 варианта.",
    "— truefalse («Правда или миф»): statement — одно утверждение, которое по тексту урока однозначно верно или однозначно неверно, без «иногда» и «зависит»; isTrue — true, если верно, false — если миф. Полей scene и options у этого вида нет.",
    "— complete («Собери правило»): start — начало правила из урока; options — 4 продолжения. start и любой вариант вместе читаются как одно грамотное предложение: start не заканчивается вопросом и не обрывается двоеточием после «а», «в», «он»; варианты продолжают фразу со строчной буквы. Поля scene у этого вида нет.",
    "— timer («Быстрое решение»): как action, но решать надо за 12 секунд — сцена и варианты короче.",
    "Мысли гостя (guestThought) — только в empathy; мысли сотрудника пиши прямо в сцену.",
    "Во всех видах с вариантами ровно один верный (correct — его номер, с нуля). Неверные — правдоподобные ошибки новичка именно по теме урока: верное действие не вовремя, полуправда, соседняя цифра из урока, переложил на другого, перестарался, решил за гостя. Не абсурд и не шутка; эксперт не должен суметь защитить неверный по тексту урока: каждый неверный — ловушка, а не пустышка.",
    "Все варианты одной ситуации — одной длины (самый длинный длиннее самого короткого не больше чем на четверть), одной формы и одинаково уверенные: верный не должен выделяться ни длиной, ни подробностью, ни тоном. Верный стоит на разных местах.",
    "win — реакция при верном ответе, одна фраза, можно начать с 🎯; fail — подсказка при ошибке, одна фраза, можно начать с 💡, и она подходит к любому неверному варианту; emoji — один эмодзи к ситуации.",
    "Опирайся только на текст урока, ничего не выдумывай: всё, на чём держится верный ответ, должно быть в уроке. Кавычки — «ёлочки», тире — длинное.",
    WHOLE,
    'Ответ — строго JSON без пояснений и без ```: {"situations": ['
      + '{"genre": "action", "emoji": "🔥", "scene": "…", "question": "Что делаешь?", "options": ["…","…","…","…"], "correct": 1, "win": "…", "fail": "…"}, '
      + '{"genre": "find", "emoji": "🔍", "scene": "…", "question": "Что не так?", "options": ["…","…","…","…"], "correct": 3, "win": "…", "fail": "…"}, '
      + '{"genre": "empathy", "emoji": "🎭", "guestThought": "…", "scene": "…", "question": "Что чувствует гость и что сделать?", "options": ["…","…","…","…"], "correct": 0, "win": "…", "fail": "…"}, '
      + '{"genre": "truefalse", "emoji": "🃏", "statement": "…", "isTrue": false, "win": "…", "fail": "…"}, '
      + '{"genre": "complete", "emoji": "🔗", "start": "…", "options": ["…","…","…","…"], "correct": 2, "win": "…", "fail": "…"}, '
      + '{"genre": "timer", "emoji": "⚡", "scene": "…", "question": "Что делаешь?", "options": ["…","…","…","…"], "correct": 1, "win": "…", "fail": "…"}]}',
    "\nТЕКСТ УРОКА:\n" + text,
  ].join("\n"),
};

// JSON-объект из ответа модели: снимаем ```, а если вокруг есть слова — вырезаем {…}
export function parseObject(text) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  try { const o = JSON.parse(clean); if (o && typeof o === "object") return o; } catch (e) { /* ниже */ }
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(clean.slice(a, b + 1)); } catch (e) { /* ниже */ } }
  return null;
}

const cut = (s, n) => String(s == null ? "" : s).replace(/\r/g, "").slice(0, n);

// v40: виды практики и их служебные поля — как у штатных ситуаций (data/modules-*.js)
export const SIT_GENRES = ["action", "find", "empathy", "truefalse", "complete", "timer"];
const SIT_Q = { action: "Что делаешь?", find: "Что не так?", empathy: "Что чувствует гость и что сделать?", timer: "Что делаешь?" };
const TF_OPTIONS = ["✅ Верно", "❌ Неверно"];
const CUT_COLON = /(^|[\s,])(а|в|он|на|о|в течение)\s*:\s*$/iu;   // «…, а:» — начало правила обрывается
// эмодзи: не длиннее 4 знаков и без половинки суррогатной пары
const emojiOf = (v) => { let out = ""; for (const ch of String(v == null ? "" : v).trim()) { if ((out + ch).length > 4) break; out += ch; } return out.replace(/\u200d+$/, ""); };
const unquote = (s) => /^«[^«»]*»$/.test(s) ? s.slice(1, -1).trim() : s;
// isTrue: true / false, «true» / «false»; нет — по correct (0 — «Верно», 1 — «Неверно»)
const truthOf = (x) => typeof x.isTrue === "boolean" ? x.isTrue : x.isTrue === "true" ? true : x.isTrue === "false" ? false
  : String(x.correct) === "0" ? true : String(x.correct) === "1" ? false : null;
function sanitizeSituation(x) {
  if (!x || typeof x !== "object") return null;
  const genre = SIT_GENRES.includes(x.genre) ? x.genre : "action";
  const head = { genre, emoji: emojiOf(x.emoji) }, tail = { win: cut(x.win, 240).trim(), fail: cut(x.fail, 240).trim() };
  if (genre === "truefalse") {
    const statement = unquote(cut(x.statement, 300).trim()), isTrue = truthOf(x);
    if (!statement || isTrue === null) return null;
    return { ...head, statement, isTrue, correct: isTrue ? 0 : 1, question: "Это верно?", options: [...TF_OPTIONS], ...tail };
  }
  // варианты: пустые убираются, верный — тот же, что назвала модель (вне списка — первый)
  const raw = Array.isArray(x.options) ? x.options : [];
  const rc = Number.isInteger(x.correct) ? x.correct : parseInt(x.correct, 10);
  const keep = raw.map((v, i) => ({ v: cut(v, 200).trim(), i })).filter(y => y.v).slice(0, 4);
  if (keep.length < 2) return null;
  const options = keep.map(y => y.v), correct = Math.max(0, keep.findIndex(y => y.i === rc));
  if (genre === "complete") {
    const start = cut(x.start, 300).trim().replace(CUT_COLON, "$1$2");   // «…, а:» → «…, а»: начало и вариант — одно предложение
    if (!start || /\?\s*$/.test(start)) return null;
    return { ...head, start, options, correct, question: "Выбери правильное продолжение:", ...tail };
  }
  const scene = cut(x.scene, 400).trim();
  if (!scene) return null;
  const guestThought = genre === "empathy" ? unquote(cut(x.guestThought, 300).trim()) : "";
  if (genre === "empathy" && !guestThought) return null;   // «глазами гостя» без мыслей гостя — не тот вид
  let question = cut(x.question, 160).trim() || SIT_Q[genre];
  if (genre === "find" && /что делаешь/i.test(question)) question = "Что не так?";   // в «найди ошибку» спрашиваем, что не так
  return { ...head, ...(genre === "empathy" ? { guestThought } : {}), scene, question, options, correct, ...tail };
}

// Только известные поля и разумные длины — что бы модель ни прислала
export function sanitize(mode, o) {
  if (!o) return null;
  if (mode === "lesson") {
    const content = cut(o.content, 12000).trim();
    return content ? { title: cut(o.title, 120).trim(), content } : null;
  }
  if (mode === "improve") {
    const content = cut(o.content, 12000).trim();
    return content ? { content } : null;
  }
  if (mode === "review") {
    const v = (o && o.review) || o || {};
    const text = cut(v.text, 600).trim();
    return text ? { review: { guest: cut(v.guest, 40).trim() || "Гость", table: cut(v.table, 20).trim(), text } } : null;
  }
  if (mode === "build") {
    const b = (o && o.build) || o || {};
    const steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 8).map(st => {
      const options = (Array.isArray(st && st.options) ? st.options : []).slice(0, 4).map(op => ({ t: cut(op && op.t, 160).trim(), ok: !!(op && op.ok), fb: cut(op && op.fb, 200).trim() })).filter(op => op.t);
      if (options.length < 2) return null;
      let seen = false; options.forEach(op => { if (op.ok) { if (seen) op.ok = false; seen = true; } });   // ровно один верный
      if (!seen) options[0].ok = true;
      const q = cut(st && st.q, 160).trim(); if (!q) return null;
      return { label: cut(st && st.label, 24).trim() || "Шаг", q, cost: cut(st && st.cost, 120).trim(), options: options.map(op => op.ok ? op : { t: op.t, fb: op.fb }) };
    }).filter(Boolean);
    if (steps.length < 2) return null;
    const glass = ["high", "rocks", "coupe", "wine", "pint"].includes(b.glass) ? b.glass : "rocks";
    const tint = /^#[0-9a-f]{6}$/i.test(String(b.tint || "")) ? b.tint : "#C8A96E";
    return { build: { title: cut(b.title, 60).trim() || "Сборка", glass, tint, win: cut(b.win, 200).trim(), lose: cut(b.lose, 200).trim(), steps } };
  }
  if (mode === "dialogue") {
    const d = (o && o.dialogue) || o || {}; const g = d.guest || {};
    const steps = (Array.isArray(d.steps) ? d.steps : []).slice(0, 16).map(st => {
      const type = st && ["action", "guest", "choice"].includes(st.type) ? st.type : null;
      if (!type) return null;
      if (type !== "choice") { const text = cut(st.text, 300).trim(); return text ? { type, text } : null; }
      const options = (Array.isArray(st.options) ? st.options : []).slice(0, 3).map(op => ({
        text: cut(op && op.text, 200).trim(), correct: !!(op && op.correct), feedback: cut(op && op.feedback, 240).trim(),
        moodDelta: Math.max(-1, Math.min(1, parseInt(op && op.moodDelta, 10) || 0)) })).filter(op => op.text);
      if (options.length < 2) return null;
      let seen = false; options.forEach(op => { if (op.correct) { if (seen) op.correct = false; seen = true; } });   // ровно один верный
      if (!seen) options[0].correct = true;
      return { type, prompt: cut(st.prompt, 200).trim() || "Что ответишь?", options };
    }).filter(Boolean);
    if (!steps.some(st => st.type === "choice")) return null;
    return { dialogue: { tip: cut(d.tip, 200).trim(), guest: { name: cut(g.name, 40).trim() || "Гость", avatar: cut(g.avatar, 4).trim() || "🙂",
      context: cut(g.context, 300).trim(), mood: Math.max(1, Math.min(5, parseInt(g.mood, 10) || 3)) }, steps } };
  }
  if (mode === "situations") {
    // v40: каждый вид — только свои поля, разумные длины, ровно один верный; у правды/мифа варианты служебные
    const ss = (Array.isArray(o.situations) ? o.situations : []).slice(0, 8).map(sanitizeSituation).filter(Boolean);
    return ss.length ? { situations: ss } : null;
  }
  const qs = (Array.isArray(o.questions) ? o.questions : []).slice(0, 8).map(q => {
    const options = (Array.isArray(q && q.options) ? q.options : []).map(x => cut(x, 200).trim()).filter(Boolean).slice(0, 4);
    let correct = Number.isInteger(q && q.correct) ? q.correct : parseInt(q && q.correct, 10);
    if (!(correct >= 0 && correct < options.length)) correct = 0;
    return { q: cut(q && q.q, 300).trim(), options, correct, explanation: cut(q && q.explanation, 300).trim() };
  }).filter(q => q.q && q.options.length >= 2);
  return qs.length ? { questions: qs } : null;
}

function openRouterText(data) {
  const msg = data && data.choices && data.choices[0] && data.choices[0].message;
  const c = msg && msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(p => (p && p.text) || "").join("");
  return "";
}

async function ask(key, prompt, pdfBase64) {
  const headers = { Authorization: "Bearer " + key, "Content-Type": "application/json", "X-Title": "Service Academy lesson assist" };
  if (process.env.VERCEL_URL) headers["HTTP-Referer"] = "https://" + process.env.VERCEL_URL;
  const content = [{ type: "text", text: prompt }];
  if (pdfBase64) content.push({ type: "file", file: { filename: "material.pdf", file_data: "data:application/pdf;base64," + pdfBase64 } });
  let lastErr = "ни одна модель не ответила";
  for (const model of MODELS) {
    let r, data;
    try {
      r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers,
        body: JSON.stringify({ model, max_tokens: 4000, temperature: 0.3, messages: [{ role: "user", content }] }),
      });
      data = await r.json();
    } catch (e) { lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown"); continue; }
    const err = (data && data.error) || (data && data.choices && data.choices[0] && data.choices[0].error);
    if (r.ok && !err) {
      const text = openRouterText(data);
      if (text.trim()) return { ok: true, text, model: (data && data.model) || model };
      lastErr = model + ": пустой ответ"; continue;
    }
    const status = r.status || (err && err.code) || 0;
    if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel и сделай Redeploy." };
    if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402) — пополни баланс: openrouter.ai → Credits." };
    lastErr = model + ": " + ((err && err.message) || ("HTTP " + status));
  }
  return { ok: false, status: 502, error: "Ассистент не ответил — " + lastErr };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Только POST" });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables (тот же ключ, что у импорта меню), затем Redeploy." });

  const { token, mode, role, title, text, pdfBase64, idea } = req.body || {};
  if (!["lesson", "improve", "questions", "situations", "dialogue", "build", "review"].includes(mode)) return res.status(400).json({ ok: false, error: "Неизвестный режим" });

  // Проверки — ДО обращения к модели: чужой запрос не тратит ни одного токена
  const emp = await verifySession(token);
  if (!emp) return res.status(401).json({ ok: false, error: "Сессия не найдена — войди в приложение заново" });
  const boss = !!(emp.is_admin || ["manager", "senior"].includes(emp.position));
  if (!boss) return res.status(403).json({ ok: false, error: "Редактор контента — только для руководителей" });
  if (!rateLimit("lesson:" + token, 40, 3600_000)) return res.status(429).json({ ok: false, error: "Слишком много запросов подряд — попробуй через час" });

  const material = cut(text, 30000).trim();
  const b64 = typeof pdfBase64 === "string" && pdfBase64 ? pdfBase64.replace(/^data:[^;]*;base64,/, "") : "";
  if (b64.length > 14_000_000) return res.status(413).json({ ok: false, error: "PDF слишком большой — до 10 МБ" });
  if (mode === "lesson" && !material && !b64) return res.status(400).json({ ok: false, error: "Вставь текст или прикрепи PDF" });
  if (mode !== "lesson" && material.length < 40) return res.status(400).json({ ok: false, error: "Сначала нужен текст урока — хотя бы пара предложений" });

  const prompt = mode === "lesson" ? PROMPT.lesson(role, material) : mode === "improve" ? PROMPT.improve(role, material)
    : mode === "situations" ? PROMPT.situations(role, material, cut(title, 120))
    : mode === "dialogue" ? PROMPT.dialogue(role, material, cut(title, 120), cut(idea, 400).trim())
    : mode === "build" ? PROMPT.build(role, material) : mode === "review" ? PROMPT.review(role, material, cut(title, 120)) : PROMPT.questions(role, material, cut(title, 120));
  try {
    const out = await ask(key, prompt, mode === "lesson" ? b64 : "");
    if (!out.ok) return res.status(out.status || 502).json({ ok: false, error: out.error });
    const result = sanitize(mode, parseObject(out.text));
    if (!result) return res.status(422).json({ ok: false, error: "Ассистент ответил не по формату — попробуй ещё раз" });
    return res.status(200).json({ ok: true, ...result, model: out.model });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Сбой ассистента: " + (e && e.message ? e.message : "unknown") });
  }
}
