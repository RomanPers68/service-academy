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
//   concept    — v139 (Доп. 454): «О нас», документ о сети или заведении (текст и/или PDF) → блоки
//                { blocks: [{ kind, title, body }] }, kind — вид блока (lib/concept.js, CN_KINDS)
//   concept_plan, concept_block, concept_style — v191 (Доп. 516): «Из документа» в два шага и вид как у уроков.
//                concept_plan: документ (текст или PDF) → план { blocks: [{ kind, title, about, src }] } (src — выдержка
//                из документа для блока, по ней пишется блок без повторной отправки PDF); concept_block: один блок по
//                материалу → { title, body, questions } (qn вопросов теста, 0 — без них); concept_style: текст блока →
//                { body } в виде уроков, факты те же. Текст ответа приводится к разметке уроков (lib/lesson-look.js)
//   concept_pitch — v192 (Доп. 517): тренажёр «Рассказ гостю за 30 секунд» в «О нас» — для всех сотрудников, не только
//                руководителей, свой счёт обращений (30 в час). title — заведение, src — образец (блок «Рассказ гостю»),
//                facts — факты раздела, text — что сказал сотрудник, secs — за сколько секунд → { good, missed, tip,
//                better, score } (lib/concept-pitch.js)
//   live       — v202 (Доп. 527): вопросы живой проверки по текстам уроков модуля (редактор «Вопросы живой проверки»):
//                руководитель спрашивает вслух, человек отвечает своими словами → { questions: [{ q, a: [пункты] }] };
//                others — вопросы, которые в модуле уже есть (не повторять)
//   dialogue   — «Живой диалог» по тексту урока (правка 159) →
//                { dialogue: { guest: { name, avatar, context, mood }, steps: [action|guest|choice] } }
//   ref_chapter, ref_improve, ref_shorten — v168 (Доп. 493): ассистент редактора справочника (lib/ref-ai.js): глава из
//                материала, PDF или по теме → { title, content, lost }; улучшить или сократить текст главы →
//                { content, lost } (lost — сколько строк картинок модель потеряла и они возвращены в конец текста)
//   ref_plan, ref_part — v169 (Доп. 494): большой документ (текст или PDF) → список глав { chapters: [{ title, about }] };
//                потом каждая глава отдельным обращением → { title, content, lost }
//   ref_check, ref_amend — v169: проверить факты главы в интернете → { summary, notes: [{ quote, note }], sources, searched };
//                поправить текст по отмеченным замечаниям → { content, lost }. ref_chapter с web: true — глава по теме с
//                поиском → ещё и { sources, searched }. Поиск — тот же, что у Наставника (api/_web.js); отказ на этом
//                пути помечен web: true, и редактор пишет главу без поиска
//
// Ключ — тот же OPENROUTER_API_KEY, что у импорта меню (Vercel → Settings →
// Environment Variables); отдельный не нужен. Модель по умолчанию —
// google/gemini-2.5-flash: дешёвая, хорошо пишет по-русски и читает PDF; запасная —
// anthropic/claude-sonnet-4.6. Сменить без правки кода — OPENROUTER_LESSON_MODEL.
//
// Защита как у импорта меню: живая сессия (whoami), только руководители
// (как и сам редактор), не больше 40 обращений в час на человека.
import { verifySession, rateLimit } from "./_auth.js";
import { pitchPrompt, pitchClean, PITCH_LIMITS } from "../lib/concept-pitch.js";   // v192 (Доп. 517): тренажёр «Рассказ гостю за 30 секунд»
import { lessonize } from "../lib/lesson-look.js";   // v191 (Доп. 516): текст блоков «О нас» — разметкой уроков
import { webCall } from "./_web.js";   // v169: поиск в интернете для ассистента справочника
// v168 (Доп. 493): ассистент редактора справочника — режимы ref_chapter, ref_improve, ref_shorten. Просьбы к модели и
// разбор ответа — в lib/ref-ai.js (общие с редактором и демо). Только владелец, как и сам редактор справочника.
// v169 (Доп. 494): ещё ref_plan, ref_part (документ на несколько глав), ref_check, ref_amend (проверка фактов в интернете).
import { REF_AI_MODES, REF_AI_LIMITS, REF_WEB_SYSTEM, refPrompt, refAiCheck, refAiClean, refPlanClean, refCheckClean } from "../lib/ref-ai.js";

const MODELS = [process.env.OPENROUTER_LESSON_MODEL, "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"]
  .filter((m, i, a) => m && a.indexOf(m) === i);
// v169: модели и сроки для режимов с поиском — как у Наставника (api/web-answer.js)
const WEB_MODELS = () => [process.env.OPENROUTER_WEB_MODEL, "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.6"].filter((m, i, a) => m && a.indexOf(m) === i);
const webLim = () => ({ each: Number(process.env.WEB_ANSWER_EACH_MS) || 40000, total: Number(process.env.WEB_ANSWER_TOTAL_MS) || 50000 });

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

// v191 (Доп. 516): режимы «О нас»
export const CN_MODES = ["concept", "concept_plan", "concept_block", "concept_style"];
// v139 (Доп. 454): виды блоков «О нас» — как CN_KINDS в lib/concept.js
export const CONCEPT_KINDS = {
  idea: "Концепция и история", values: "Ценности", structure: "Структура: кто за что отвечает", guest: "Наш гость",
  kitchen: "Кухня и бар", mood: "Атмосфера", pitch: "Рассказ гостю за 30 секунд", dress: "Внешний вид и дресс-код",
  setting: "Сервировка залов", check: "Правильный чек: к чему стремимся", day: "Распорядок дня менеджера",
  numbers: "Цифры смены: на что смотрим", own: "Свой блок",
};

// v191 (Доп. 516): владелец — «давай сделаем так, что бы он красиво составлял текст, по типу того, что у нас уже
// собранно в уроках. А то выглядит инородно». Вид — как у 246 штатных уроков (data/modules-*.js): так их рисует экран урока.
export const LOOK = [
  "Вид — как у уроков приложения (экран урока рисует эти строки по-своему):",
  "— первая строка — главная мысль одним-двумя предложениями (30–170 знаков), без подзаголовка перед ней: экран покажет её крупно;",
  "— дальше 2–4 части: подзаголовок отдельной строкой в **двойных звёздочках** (можно с двоеточием внутри: **Что важно:**), под ним 1–3 коротких абзаца по 1–3 предложения или список;",
  "— части и абзацы разделяй пустой строкой (в JSON — \\n\\n): по пустым строкам урок делится на карточки;",
  "— список — строки с «• »; что проверить или сделать — «☑ »; принципы и ценности — «🔹 »; шаги по порядку — 1️⃣ 2️⃣ 3️⃣ (до девяти);",
  "— как правильно — строки с «✅ », так нельзя — «🚫 »;",
  "— главный вывод — строка с «📌 » в конце (одна, самое большее две на блок);",
  "— точная фраза гостю — отдельной строкой в «ёлочках»;",
  "— **жирным** — только ключевые слова внутри строки, не целые предложения;",
  "— других значков, #, _, таблиц и HTML нет.",
].join("\n");
const VOICE = [
  "Пишешь сотрудникам ресторанов на «ты», живо и по делу, без канцелярита, воды и громких слов.",
  "Не выдумывай фактов, цен, блюд, имён, цифр и правил, которых нет в материале.",
  WHOLE,
].join("\n");
// что хорошо выходит у каждого вида блока (lib/concept.js, CN_KINDS)
export const CONCEPT_LOOK = {
  idea: "кто мы, с чего начинали и чем отличаемся; в конце — «📌 » суть одной фразой",
  values: "каждая ценность — строкой «🔹 Ценность — как это видно в работе»",
  structure: "кто за что отвечает — строки «• Должность (имя, если есть в материале) — за что отвечает, с каким вопросом идти»",
  guest: "кто к нам приходит и за чем; кому что посоветовать",
  kitchen: "что готовим и наливаем, наше фирменное — списком; цены — только если они есть в материале",
  mood: "интерьер, музыка, свет, настроение — как гость это чувствует",
  pitch: "сначала одна строка — когда это говорить; дальше готовая речь гостю 3–5 предложений от «мы», каждая фраза — строкой в «ёлочках»",
  dress: "по пунктам — форма, обувь, волосы, украшения, ногти: «✅ » как надо и «🚫 » так нельзя",
  setting: "как накрыт стол — по порядку 1️⃣ 2️⃣ 3️⃣",
  check: "из чего складывается чек и к какому стремимся — списком, цифры как в материале",
  day: "распорядок по времени — 1️⃣ 2️⃣ 3️⃣, время в начале строки",
  numbers: "на какие цифры смотрим — строки «• Показатель — норма или цель»",
  own: "по смыслу материала",
};
const QUIZ_RULES = [
  "Вопрос — ситуация из работы или проверка важного правила из блока. 4 варианта, ровно один верный; неверные — правдоподобные ошибки новичка, не абсурд.",
  "Все варианты — примерно одной длины и одинаково уверенные: верный не выделяется ни длиной, ни подробностью. Пояснение — одной фразой: почему верный ответ верный.",
].join("\n");

export const PROMPT = {
  // v202 (Доп. 527): вопросы живой проверки — руководитель спрашивает вслух, отмечает пункты, которые человек назвал сам
  live: (role, text, title, others) => [
    `Ты помогаешь руководителю ресторана проверить, читал ли сотрудник уроки модуля «${title || "модуль"}» (курс: ${role || "сервис"}).`,
    "Составь 4 вопроса для живой проверки: руководитель задаёт их вслух, сотрудник отвечает своими словами.",
    "К каждому вопросу — от 2 до 5 пунктов «что должно прозвучать»: коротко, по 3–12 слов, только то, что есть в тексте уроков, без общих слов.",
    "Вопросы — о главном и о том, что пригодится в зале завтра. Один вопрос можно сделать ситуацией: начни его словами «Ситуация:» и опиши, что происходит, а в пунктах — что сделать.",
    "Не повторяй вопросы, которые уже есть." + (others && others.length ? " Уже есть:\n" + others.map((x) => "• " + x).join("\n") : ""),
    "Пиши по-русски, просто и конкретно, без длинных тире и без канцелярита.",
    'Ответ — строго JSON без пояснений и без ```: {"questions": [{"q": "…", "a": ["…", "…"]}]}',
    "\nТЕКСТ УРОКОВ:\n" + text,
  ].join("\n"),
  // v191: план раздела по документу — какие блоки получаются и выдержка для каждого
  concept_plan: (where, material) => [
    `Прочитай материал о ${where || "сети ресторанов"} и составь план раздела «О нас» в приложении для сотрудников ресторанов: какие блоки-уроки из него получаются.`,
    "Виды блоков (kind — название):",
    Object.entries(CONCEPT_KINDS).map(([k, t]) => `• ${k} — ${t}`).join("\n"),
    "Бери только то, о чём в материале есть содержание. Один вид — один блок; own — важное, что не подошло к другим видам (не больше пяти).",
    "Для каждого блока: kind; title — заголовок урока 2–6 слов, живой и конкретный, можно с названием компании («Кто мы: …», «Наш гость: кому что советовать»); about — что войдёт, одним предложением;",
    "src — выдержка из материала для этого блока: все факты, цифры, имена, правила и формулировки, которые в него войдут, близко к тексту материала, до 900 знаков.",
    "Порядок блоков — как в списке видов.",
    // v192 (Доп. 517): картинки из Word — метки «[фото N]» на их месте в тексте
    "Строки «[фото N]» в материале — картинки документа на своём месте. photos — номера картинок, которые относятся к блоку (по месту в тексте и смыслу: зал — к атмосфере, форма — к внешнему виду, стол — к сервировке); одна картинка — одному блоку; нет картинок — пустой список. В src метки оставляй.",
    'Ответ — строго JSON без пояснений и без ```: {"blocks": [{"kind": "idea", "title": "…", "about": "…", "src": "…", "photos": [1]}]}',
    material ? "\nМАТЕРИАЛ:\n" + material : "\nМАТЕРИАЛ — во вложенном PDF.",
  ].join("\n"),
  // v191: один блок по материалу — в виде уроков и с вопросами теста
  concept_block: (where, kind, title, about, others, qn, material, src = "") => [
    `Напиши блок-урок «${title || CONCEPT_KINDS[kind] || "О нас"}» для раздела «О нас» приложения сотрудников (${where || "сеть ресторанов"}). Вид блока — ${CONCEPT_KINDS[kind] || "свой блок"}: ${CONCEPT_LOOK[kind] || CONCEPT_LOOK.own}.`,
    about ? "Что в нём: " + about : "",
    src ? "Выдержка из материала для этого блока (остальной материал — ниже, бери из него только то, что относится к блоку):\n" + src : "",
    others && others.length ? "Другие блоки раздела — их содержание не повторяй: " + others.map((x) => "«" + x + "»").join(", ") + "." : "",
    "Объём — 120–320 слов, строго по материалу ниже. Строки «[фото N]» — картинки документа: в текст блока их не переноси.",
    LOOK,
    VOICE,
    qn > 0 ? `Ещё ${qn} вопрос${qn === 1 ? "" : "а"} для теста по этому блоку.\n` + QUIZ_RULES : "",
    qn > 0
      ? 'Ответ — строго JSON без пояснений и без ```: {"title": "…", "body": "…", "questions": [{"q": "…", "options": ["…","…","…","…"], "correct": 0, "explanation": "…"}]}'
      : 'Ответ — строго JSON без пояснений и без ```: {"title": "…", "body": "…"}',
    material ? "\nМАТЕРИАЛ:\n" + material : "\nМАТЕРИАЛ — во вложенном PDF.",
  ].filter(Boolean).join("\n"),
  // v191: оформить готовый текст блока как урок — смысл и факты те же
  concept_style: (kind, title, text) => [
    `Оформи текст блока «${title || CONCEPT_KINDS[kind] || "О нас"}» раздела «О нас» как урок приложения (вид блока — ${CONCEPT_KINDS[kind] || "свой блок"}: ${CONCEPT_LOOK[kind] || CONCEPT_LOOK.own}).`,
    "Смысл, факты, цифры, имена и правила — те же: ничего не добавляй от себя и ничего важного не теряй; повторы и воду убери.",
    LOOK,
    VOICE,
    'Ответ — строго JSON без пояснений и без ```: {"body": "…"}',
    "\nТЕКСТ БЛОКА:\n" + text,
  ].join("\n"),
  concept: (where, material) => [
    `Разложи материал о ресторане (${where || "сеть ресторанов"}) по блокам раздела «О нас» приложения для сотрудников.`,
    "Виды блоков (kind — название):",
    Object.entries(CONCEPT_KINDS).map(([k, t]) => `• ${k} — ${t}`).join("\n"),
    "pitch — готовая речь гостю: 3–5 предложений от «мы», без цен. own — всё важное, что не подошло к другим видам; заголовок — свой, 2–5 слов.",
    "Бери только то, что есть в материале: о чём материал молчит, того блока не пиши. Один вид — один блок (own — сколько нужно, но не больше пяти).",
    "Объём текста блока — до 300 слов. Цифры, имена, правила — как в материале, ничего не придумывай.",
    LOOK,   // v191: вид как у уроков
    VOICE,
    'Ответ — строго JSON без пояснений и без ```: {"blocks": [{"kind": "idea", "title": "…", "body": "…"}]} (переносы строк в body — \\n).',
    material ? "\nМАТЕРИАЛ:\n" + material : "\nМАТЕРИАЛ — во вложенном PDF.",
  ].join("\n"),
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

// v191: вопросы теста блока «О нас» — как их принимает сервер (_sa_cn_questions): вопрос, 2–4 непустых варианта, верный из них
export function cnQuestions(arr) {
  return (Array.isArray(arr) ? arr : []).map((q) => {
    if (!q || typeof q !== "object") return null;
    // пустые варианты убираются, верный — тот же вариант, что назвала модель (его номер мог сдвинуться)
    const rc = Number.isInteger(q.correct) ? q.correct : parseInt(q.correct, 10);
    const keep = (Array.isArray(q.options) ? q.options : []).map((x, i) => ({ v: cut(x, 200).trim(), i })).filter((x) => x.v).slice(0, 4);
    const correct = keep.findIndex((x) => x.i === rc);
    const text = cut(q.q, 400).trim();
    if (!text || keep.length < 2 || correct < 0) return null;
    return { q: text, options: keep.map((x) => x.v), correct, explanation: cut(q.explanation, 500).trim() };
  }).filter(Boolean).slice(0, 4);
}

// Только известные поля и разумные длины — что бы модель ни прислала
export function sanitize(mode, o) {
  if (mode === "live") {   // v202: вопрос 8–300 знаков, пунктов 2–5 по 200 знаков, вопросов до четырёх
    const list = (Array.isArray(o && o.questions) ? o.questions : []).map((x) => {
      const q = cut(x && x.q, 300).replace(/\s+/g, " ").trim();
      const a = (Array.isArray(x && x.a) ? x.a : []).filter((p) => typeof p === "string").map((p) => cut(p, 200).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 5);
      return q.length >= 8 && a.length >= 2 ? { q, a } : null;
    }).filter(Boolean).slice(0, 4);
    return list.length ? { questions: list } : null;
  }
  if (!o) return null;
  if (mode === "concept") {
    const seen = new Set();
    const blocks = (Array.isArray(o.blocks) ? o.blocks : []).filter((b) => b && typeof b === "object" && CONCEPT_KINDS[b.kind]).map((b) => ({
      kind: b.kind, title: cut(b.title, 80).trim() || CONCEPT_KINDS[b.kind], body: lessonize(cut(b.body, 6000)) }))   // v191: разметкой уроков
      .filter((b) => b.body && (b.kind === "own" || (!seen.has(b.kind) && seen.add(b.kind)))).slice(0, 17);
    return blocks.length ? { blocks } : null;
  }
  // v191 (Доп. 516): план, блок, оформление
  if (mode === "concept_plan") {
    const seen = new Set();
    let own = 0;
    const blocks = (Array.isArray(o.blocks) ? o.blocks : []).filter((b) => b && typeof b === "object" && CONCEPT_KINDS[b.kind]).map((b) => ({
      kind: b.kind, title: cut(b.title, 80).trim() || CONCEPT_KINDS[b.kind], about: cut(b.about, 300).trim(), src: cut(b.src, 1500).trim(),
      photos: [...new Set((Array.isArray(b.photos) ? b.photos : []).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 60))].slice(0, 8) }))   // v192: картинки из Word
      .filter((b) => (b.kind === "own" ? ++own <= 5 : !seen.has(b.kind) && seen.add(b.kind))).slice(0, 17);
    return blocks.length ? { blocks } : null;
  }
  if (mode === "concept_block") {
    const body = lessonize(cut(o.body, 6000).replace(/^[ \t]*\[фото \d+\][ \t]*$/gm, "").replace(/ ?\[фото \d+\]/g, ""));   // v192: метки картинок — не текст
    if (!body) return null;
    return { title: cut(o.title, 80).trim(), body, questions: cnQuestions(o.questions) };
  }
  if (mode === "concept_style") {
    const body = lessonize(cut(o.body != null ? o.body : o.content, 6000));
    return body ? { body } : null;
  }
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

async function ask(key, prompt, pdfBase64, maxTokens = 4000) {
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
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.3, messages: [{ role: "user", content }] }),
      });
      data = await r.json();
    } catch (e) { lastErr = model + ": сеть — " + (e && e.message ? e.message : "unknown"); continue; }
    const err = (data && data.error) || (data && data.choices && data.choices[0] && data.choices[0].error);
    if (r.ok && !err) {
      const text = openRouterText(data);
      // cut — модель упёрлась в предел длины ответа (v168: ассистент справочника говорит об этом, а не отдаёт обрывок)
      if (text.trim()) return { ok: true, text, model: (data && data.model) || model, cut: !!(data && data.choices && data.choices[0] && data.choices[0].finish_reason === "length") };
      lastErr = model + ": пустой ответ"; continue;
    }
    const status = r.status || (err && err.code) || 0;
    if (status === 401) return { ok: false, status: 502, error: "OpenRouter не принял ключ (401). Проверь OPENROUTER_API_KEY в Vercel и сделай Redeploy." };
    if (status === 402) return { ok: false, status: 502, error: "На OpenRouter закончились кредиты (402) — пополни баланс: openrouter.ai → Credits." };
    lastErr = model + ": " + ((err && err.message) || ("HTTP " + status));
  }
  return { ok: false, status: 502, error: "Ассистент не ответил — " + lastErr };
}

// v202 (Доп. 527): «Ассистент предложит» в редакторе «Вопросы живой проверки». Проверки — до обращения к модели, как у
// уроков: живая сессия, руководитель, тот же счёт обращений (40 в час), текст уроков модуля не короче пары предложений.
async function liveAssist(res, key, { token, role, title, text, others }) {
  const emp = await verifySession(token);
  if (!emp) return res.status(401).json({ ok: false, error: "Сессия не найдена — войди в приложение заново" });
  if (!(emp.is_admin || ["manager", "senior"].includes(emp.position))) return res.status(403).json({ ok: false, error: "Редактор контента — только для руководителей" });
  if (!rateLimit("lesson:" + token, 40, 3600_000)) return res.status(429).json({ ok: false, error: "Слишком много запросов подряд — попробуй через час" });
  const material = cut(text, 30000).trim();
  if (material.length < 40) return res.status(400).json({ ok: false, error: "Сначала нужен текст урока — хотя бы пара предложений" });
  const oth = (Array.isArray(others) ? others : []).filter((x) => typeof x === "string").map((x) => cut(x, 200).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 16);
  try {
    const out = await ask(key, PROMPT.live(cut(role, 40), material, cut(title, 120), oth), "", 3000);
    if (!out.ok) return res.status(out.status || 502).json({ ok: false, error: out.error });
    const result = sanitize("live", parseObject(out.text));
    if (!result) return res.status(422).json({ ok: false, error: "Ассистент ответил не по формату — попробуй ещё раз" });
    return res.status(200).json({ ok: true, ...result, model: out.model });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Сбой ассистента: " + (e && e.message ? e.message : "unknown") });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Только POST" });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: "OPENROUTER_API_KEY не задан: Vercel → Settings → Environment Variables (тот же ключ, что у импорта меню), затем Redeploy." });

  const { token, mode, role, title, text, pdfBase64, idea, about, others, fixes, web, kind, qn, where, src, facts, secs } = req.body || {};
  const isRef = REF_AI_MODES.includes(mode);   // v168: ассистент редактора справочника
  const isCn = CN_MODES.includes(mode);        // v191: «О нас» — свой счёт обращений: документ — план и по обращению на блок
  const isPitch = mode === "concept_pitch";   // v192: тренажёр рассказа гостю — для всех сотрудников
  if (mode === "live") return liveAssist(res, key, req.body || {});   // v202 (Доп. 527): вопросы живой проверки — свой путь
  if (!isRef && !isPitch && !["lesson", "improve", "questions", "situations", "dialogue", "build", "review", ...CN_MODES].includes(mode)) return res.status(400).json({ ok: false, error: "Неизвестный режим" });

  // Проверки — ДО обращения к модели: чужой запрос не тратит ни одного токена
  const emp = await verifySession(token);
  if (!emp) return res.status(401).json({ ok: false, error: "Сессия не найдена — войди в приложение заново" });
  const boss = !!(emp.is_admin || ["manager", "senior"].includes(emp.position));
  if (isPitch) {
    // v192 (Доп. 517): «Рассказ гостю за 30 секунд» — свой счёт, проверки до обращения к модели
    if (!rateLimit("pitch:" + token, 30, 3600_000)) return res.status(429).json({ ok: false, error: "Много попыток подряд. Отдохни и попробуй через час." });
    const said = cut(text, PITCH_LIMITS.said).trim(), ref = cut(src, PITCH_LIMITS.ref).trim();
    if (!ref) return res.status(400).json({ ok: false, error: "В «О нас» нет образца рассказа гостю" });
    if (said.length < 15) return res.status(400).json({ ok: false, error: "Расскажи хотя бы пару предложений" });
    try {
      const out = await ask(key, pitchPrompt({ where: cut(title, 80), ref, facts: cut(facts, PITCH_LIMITS.facts), said, secs: Number(secs) || 0 }), "", 1500);
      if (!out.ok) return res.status(out.status || 502).json({ ok: false, error: out.error });
      const result = pitchClean(parseObject(out.text));
      if (!result) return res.status(422).json({ ok: false, error: "Помощник ответил не по формату. Попробуй ещё раз." });
      return res.status(200).json({ ok: true, ...result, model: out.model });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Сбой помощника: " + (e && e.message ? e.message : "unknown") });
    }
  }
  if (!boss) return res.status(403).json({ ok: false, error: "Редактор контента — только для руководителей" });
  if (isRef && !emp.is_admin) return res.status(403).json({ ok: false, error: "Редактор справочника доступен только владельцу" });
  // v169: у режимов справочника свой счёт — раскладка документа на главы тратит по обращению на главу
  if (!(isRef ? rateLimit("ref:" + token, 80, 3600_000) : isCn ? rateLimit("cn:" + token, 150, 3600_000) : rateLimit("lesson:" + token, 40, 3600_000))) return res.status(429).json({ ok: false, error: "Слишком много запросов подряд — попробуй через час" });

  const material = cut(text, 30000).trim();
  const b64 = typeof pdfBase64 === "string" && pdfBase64 ? pdfBase64.replace(/^data:[^;]*;base64,/, "") : "";
  // v169: хостинг принимает запрос до 4,5 МБ — PDF крупнее до функции не доходит; предел честный, 3 МБ файла
  if (b64.length > 4_300_000) return res.status(413).json({ ok: false, error: "PDF слишком большой: до 3 МБ" });
  if (isRef) {
    // Тема или название главы — в title; материал, документ или текст главы — в text. Проверка та же, что у кнопок
    // редактора, и до обращения к модели.
    const big = mode === "ref_plan" || mode === "ref_part";   // v169: документ на несколько глав
    const topic = cut(title, REF_AI_LIMITS.topic).trim(), src = cut(text, big ? REF_AI_LIMITS.doc : REF_AI_LIMITS.material).trim(), pdf = mode === "ref_chapter" || big ? b64 : "";
    const extra = { about: cut(about, REF_AI_LIMITS.about).trim(), fixes: cut(fixes, REF_AI_LIMITS.fixes).trim(),
      others: (Array.isArray(others) ? others : []).filter((x) => typeof x === "string").map((x) => cut(x, REF_AI_LIMITS.topic).trim()).filter(Boolean).slice(0, REF_AI_LIMITS.parts) };
    const miss = refAiCheck(mode, { topic, text: src, hasPdf: !!pdf, len: String(text == null ? "" : text).length, fixes: extra.fixes });
    if (miss) return res.status(400).json({ ok: false, error: miss });
    // v169: с поиском в интернете — проверка фактов и «Глава по теме» (не из материала: своему документу интернет не указ)
    const useWeb = mode === "ref_check" || (mode === "ref_chapter" && web === true && !pdf);
    const bad = (status, error) => res.status(status).json({ ok: false, error, ...(useWeb ? { web: true } : {}) });   // web: true — отказал путь с поиском
    try {
      let out;
      if (useWeb) out = await webCall({ orKey: key, models: WEB_MODELS(), system: REF_WEB_SYSTEM, user: refPrompt(mode, topic, src, false, { web: true }), maxTokens: 3500, lim: webLim() });
      else out = await ask(key, refPrompt(mode, topic, src, !!pdf, extra), pdf);
      if (!out.ok) return bad(out.status || 502, out.error);
      if (out.cut) return bad(422, "Ответ не уместился. Выдели часть текста или дай материал частями.");
      const o = parseObject(out.text);
      const result = mode === "ref_plan" ? refPlanClean(o) : mode === "ref_check" ? refCheckClean(o) : refAiClean(mode, o, src, useWeb);
      if (!result) return bad(422, "Ассистент ответил не по формату. Попробуй ещё раз.");
      return res.status(200).json({ ok: true, ...result, ...(useWeb ? { sources: out.sources || [], searched: out.searches || 0 } : {}), model: out.model });
    } catch (e) {
      return bad(500, "Сбой ассистента: " + (e && e.message ? e.message : "unknown"));
    }
  }
  // v139: «Из документа» в «О нас» — тоже текст или PDF; v191: и план, и блок (блок — обычно по выдержке из плана)
  const withPdf = mode === "lesson" || mode === "concept" || mode === "concept_plan" || mode === "concept_block";
  if (withPdf && !material && !b64) return res.status(400).json({ ok: false, error: "Вставь текст или прикрепи PDF" });
  if (!withPdf && material.length < 40) return res.status(400).json({ ok: false, error: "Сначала нужен текст урока — хотя бы пара предложений" });
  if ((mode === "concept_block" || mode === "concept_style") && !CONCEPT_KINDS[kind]) return res.status(400).json({ ok: false, error: "Неизвестный вид блока" });
  const nq = Math.max(0, Math.min(4, Number.isInteger(qn) ? qn : parseInt(qn, 10) || 0));
  const oth = (Array.isArray(others) ? others : []).filter((x) => typeof x === "string").map((x) => cut(x, 80).trim()).filter(Boolean).slice(0, 16);

  const prompt = mode === "concept_plan" ? PROMPT.concept_plan(cut(title, 80).trim(), material)
    : mode === "concept_block" ? PROMPT.concept_block(cut(where, 80).trim(), kind, cut(title, 80).trim(), cut(about, 300).trim(), oth, nq, material, cut(src, 1500).trim())
    : mode === "concept_style" ? PROMPT.concept_style(kind, cut(title, 80).trim(), material)
    : mode === "concept" ? PROMPT.concept(cut(title, 80).trim(), material) : mode === "lesson" ? PROMPT.lesson(role, material) : mode === "improve" ? PROMPT.improve(role, material)
    : mode === "situations" ? PROMPT.situations(role, material, cut(title, 120))
    : mode === "dialogue" ? PROMPT.dialogue(role, material, cut(title, 120), cut(idea, 400).trim())
    : mode === "build" ? PROMPT.build(role, material) : mode === "review" ? PROMPT.review(role, material, cut(title, 120)) : PROMPT.questions(role, material, cut(title, 120));
  try {
    const out = await ask(key, prompt, withPdf ? b64 : "", mode === "concept_plan" ? 8000 : 4000);   // v191: план с выдержками длиннее
    if (out.ok && out.cut && isCn) return res.status(422).json({ ok: false, error: "Документ слишком большой для одного раза. Вставь его частями." });
    if (!out.ok) return res.status(out.status || 502).json({ ok: false, error: out.error });
    const result = sanitize(mode, parseObject(out.text));
    if (!result) return res.status(422).json({ ok: false, error: "Ассистент ответил не по формату — попробуй ещё раз" });
    return res.status(200).json({ ok: true, ...result, model: out.model });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Сбой ассистента: " + (e && e.message ? e.message : "unknown") });
  }
}
