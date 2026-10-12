// e2e-editor.mjs — сквозная проверка нового редактора контента (правка 156)
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright");
const SITE = "/home/claude/preview/site", OUT = "/home/claude/preview/shots", PORT = 5231;
const { HINTS, HINTS_VERSION } = await import("/home/claude/work/service-academy/data/hints.js");
const server = http.createServer((q, r) => { const p = decodeURIComponent(q.url.split("?")[0]); let f = join(SITE, p);
  try { if (!statSync(f).isFile()) f = join(SITE, "index.html"); } catch (e) { f = join(SITE, "index.html"); }
  r.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" }[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); });
await new Promise(r => server.listen(PORT, r));
const results = []; const check = (n, c, x = "") => results.push(`${c ? "✓" : "✗"} ${n}${x ? " — " + x : ""}`);
const LESSONS = [
  { id: 11, role: "seasonal", module: "Субординация", title: "Кто кому подчиняется", content: "Старший смены отвечает за зал.", sort: 1, questions: [
      { q: "Кто главный?", options: ["Старший", "Повар"], correct: 0 },
      { kind: "situation", genre: "action", emoji: "🔥", scene: "Менеджера нет, гость требует скидку.", question: "Что делаешь?", options: ["Зову старшего смены", "Даю скидку сам"], correct: 0, win: "🎯 Верно", fail: "💡 Решает старший" },
      { kind: "situation", genre: "find", emoji: "⚠️", scene: "Новичок спорит со старшим при гостях.", question: "В чём ошибка?", options: ["Спор при гостях", "Ничего"], correct: 0, win: "🎯 Да", fail: "💡 Не при гостях" },
      { kind: "dialogue", guest: { name: "Ольга", avatar: "👩", context: "Недовольна и требует менеджера", mood: 3 }, steps: [
        { type: "guest", text: "Позовите менеджера!" },
        { type: "choice", prompt: "Что ответишь?", options: [{ text: "Сейчас позову старшего смены", correct: true, feedback: "Верно", moodDelta: 1 }, { text: "Менеджера нет", correct: false, feedback: "Холодно", moodDelta: -1 }] },
        { type: "action", text: "Старший смены подходит к столу." },
        { type: "choice", prompt: "Что скажешь старшему?", options: [{ text: "Коротко объясню суть", correct: true, feedback: "Да", moodDelta: 1 }, { text: "Уйду молча", correct: false, feedback: "Нет", moodDelta: -1 }] } ] } ] },
  { id: 12, role: "seasonal", module: "Субординация", title: "Если менеджера нет", content: "Решает старший смены.", questions: [], sort: 2 },
  { id: 13, role: "seasonal", module: "Стандарты зала", title: "Сервировка", content: "Нож справа.", questions: [], sort: 3 },
  { id: 21, role: "spg", module: "Встреча VIP", title: "Кого встречаем лично", content: "Постоянных гостей — по имени.", questions: [], sort: 1 },
  { id: 31, role: "bar", module: "Наши коктейли", title: "Фирменный сауэр", content: "Яичный белок — только пастеризованный. Сначала сухой шейк, потом со льдом.", sort: 1, questions: [
      { kind: "build", title: "Фирменный сауэр", glass: "coupe", tint: "#E8B04A", win: "Сауэр как надо", lose: "Ошибка тянет вкус", steps: [
        { label: "Бокал", q: "С чего начинаешь?", cost: "не тот бокал", options: [{ t: "Купе", ok: true, fb: "Да" }, { t: "Хайбол", fb: "Нет" }, { t: "Пинта", fb: "Нет" }, { t: "Флюте", fb: "Нет" }] },
        { label: "Метод", q: "Как смешиваешь?", cost: "без пены", options: [{ t: "Сухой шейк, потом со льдом", ok: true, fb: "Пена" }, { t: "Стир", fb: "Нет пены" }, { t: "Билд", fb: "Нет" }, { t: "Бленд", fb: "Нет" }] } ] } ] },
];
const AI = {
  lesson: { ok: true, title: "Наше вино", content: "**Три вина, которые спрашивают чаще всего**\n• Шабли — к морепродуктам\n• Кьянти — к пасте\n«Посоветую к вашему блюду…»\n✅ Сначала спроси, что гость любит" },
  situations: { ok: true, situations: [
    { genre: "action", emoji: "🍷", scene: "Гость просит вино к рыбе.", question: "Что делаешь?", options: ["Предлагаю Шабли", "Предлагаю портвейн", "Молчу", "Зову бармена"], correct: 0, win: "🎯 Лёгкое белое", fail: "💡 К рыбе — белое" },
    { genre: "find", emoji: "⚠️", scene: "Официант советует самое дорогое, не спросив гостя.", question: "В чём ошибка?", options: ["Не спросил о вкусах", "Всё верно"], correct: 0, win: "🎯 Сначала спроси", fail: "💡 Совет — под гостя" } ] },
  build: { ok: true, build: { title: "Птица джунглей", glass: "rocks", tint: "#B8352A", win: "Как надо", lose: "Мимо", steps: [
    { label: "Бокал", q: "С чего начинаешь?", cost: "не тот бокал", options: [{ t: "Рокс", ok: true, fb: "Да" }, { t: "Хайбол", fb: "Нет" }, { t: "Купе", fb: "Нет" }, { t: "Пинта", fb: "Нет" }] },
    { label: "Метод", q: "Как смешиваешь?", cost: "не та текстура", options: [{ t: "Шейк 10–12 секунд", ok: true, fb: "Да" }, { t: "Стир", fb: "Нет" }, { t: "Билд", fb: "Нет" }, { t: "Бленд", fb: "Нет" }] } ] } },
  dialogue: { ok: true, dialogue: { guest: { name: "Михаил", avatar: "👔", context: "Деловой ужин, ждёт коллегу", mood: 3 }, steps: [
    { type: "action", text: "Михаил входит в зал." }, { type: "guest", text: "Добрый вечер, жду коллегу." },
    { type: "choice", prompt: "Что ответишь?", options: [{ text: "Проведу вас к столу", correct: true, feedback: "Проводишь сам", moodDelta: 1 }, { text: "Садитесь где хотите", correct: false, feedback: "Гость не ищет стол", moodDelta: -1 }, { text: "Подождите", correct: false, feedback: "Ждать — плохо", moodDelta: 0 }] } ] } },
  improve: { ok: true, content: "**Суть**\nКороче и яснее: старший смены решает, пока менеджера нет." },
  questions: { ok: true, questions: [
    { q: "Что посоветовать к морепродуктам?", options: ["Шабли", "Кьянти", "Портвейн", "Пиво"], correct: 0, explanation: "Лёгкое белое." },
    { q: "С чего начать совет?", options: ["Спросить, что гость любит", "Назвать самое дорогое"], correct: 0, explanation: "Совет — под гостя." },
    { q: "Кьянти — к чему?", options: ["К пасте", "К десерту"], correct: 0, explanation: "Классика." } ] },
};
let saved = null, aiCalls = [], savedAll = [], wiped = null;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route("**/*", async (route) => {
  const req = route.request(), u = req.url();
  if (u.startsWith(`http://localhost:${PORT}`) && !u.includes("/api/")) return route.continue();
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (u.includes("/api/lesson-assist")) { const b = JSON.parse(req.postData() || "{}"); aiCalls.push(b); return json(AI[b.mode]); }
  if (u.includes("rpc/cms_list_lessons")) return json(LESSONS);
  if (u.includes("rpc/cms_save_lesson")) { saved = JSON.parse(req.postData() || "{}").p_lesson; savedAll.push(saved); return json({ ok: true }); }
  if (u.includes("rpc/admin_wipe_lesson_traces")) { wiped = JSON.parse(req.postData() || "{}").p_ids; return json({ ok: true, rows: 3 }); }
  if (u.includes("rpc/cms_delete_lesson")) return json({ ok: true });
  return route.abort();
});
const seed = { sa_session_token: "p", sa_profile: JSON.stringify({ id: "u", name: "Роман", surname: "Петров", restaurant: "Два моря, Океан", position: "manager", is_admin: true }),
  sa_a11y: "0", sa_welcome_seen_v11: "1", sa_last_role: JSON.stringify("seasonal") };
for (const k of Object.keys(HINTS)) seed[`sa_hint_v${HINTS_VERSION}_${k}`] = "1";
await ctx.addInitScript((s) => { if (localStorage.getItem("__s")) return; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.setItem("__s", "1"); }, seed);
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", e => errors.push("сбой: " + e.message)); // «a style property during rerender … conflicting property» — предупреждение React только в
// сборке для разработки: игра практики (старый код) меняет border при заданном borderTop.
// В сборке для пользователей его нет, на вид не влияет — известное, не ошибка.
page.on("console", async m => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|a style property during rerender/.test(m.text())) {
  let args = []; try { args = await Promise.all(m.args().slice(1, 4).map(a => a.jsonValue())); } catch (e) {}
  errors.push("console: " + m.text().slice(0, 60) + " → " + JSON.stringify(args).slice(0, 160)); } });
const btn = async (label) => { const ok = await page.evaluate((l) => { const b = [...document.querySelectorAll("button,label")].filter(x => x.offsetParent !== null && (x.innerText || "").trim().startsWith(l)).pop(); if (b && !b.disabled) { b.click(); return true; } return false; }, label); await page.waitForTimeout(350); return ok; };
const text = () => page.evaluate(() => document.body.innerText);
// v28 (Доп. 307): трек — меню тем, листаются; тема открывается номером в оглавлении
const openTopic = async (title) => { await page.evaluate((t) => { const b = document.querySelector('.tbp-num[aria-label*="' + t + '"]'); if (b) b.click(); }, title); await page.waitForTimeout(1300); };
const openEditor = async () => { await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(1600); await page.evaluate(() => window.__saNav && window.__saNav("contentEditor")); await page.waitForTimeout(1400); };

await openEditor();
let t = await text();
check("список: группы по трекам", /НОВИЧОК/.test(t) && /ХОСТЕС/.test(t) && /БАР/.test(t));
check("список: разделы с уроками, практика и тест раздельно", /Субординация/.test(t) && /Кто кому подчиняется/.test(t) && /уроков 2 · практика 2 · диалог · тест 1 вопр\./.test(t));
// старый урок с ситуациями и вопросом вместе — редактор разводит их по разделам
await page.evaluate(() => document.querySelector('[aria-label="Изменить"]').click()); await page.waitForTimeout(500);
t = await text();
check("открытие урока: 2 ситуации и 1 вопрос по своим разделам", /СИТУАЦИЯ 2/.test(t) && !/СИТУАЦИЯ 3/.test(t) && /ВОПРОС 1/.test(t) && !/ВОПРОС 2/.test(t));
check("открытие урока: диалог — гость и шаги по видам", /ГОСТЬ ГОВОРИТ/.test(t) && /ВЫБОР СОТРУДНИКА/.test(t) && /ДЕЙСТВИЕ/.test(t) && (await page.inputValue('input[placeholder^="Имя гостя"]')) === "Ольга");
// ── сжатие (правка 162) ──
check("сжатие: при открытии карточки свёрнуты в строки, раскрытых нет", await page.evaluate(() => document.querySelectorAll('[data-card]').length >= 6 && !document.querySelector('[aria-label="Удалить ситуацию"]') && !document.querySelector('[aria-label="Удалить вопрос"]')));
check("сжатие: «Сохранить» видна сразу, без прокрутки", await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => (x.innerText || "").trim() === "Сохранить урок"); const r = b && b.getBoundingClientRect(); return !!r && r.bottom <= innerHeight && r.top > innerHeight * 0.7; }));
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /^Тест(\s+(\d+|·))?$/.test((x.innerText || "").trim())); if (b) b.click(); }); await page.waitForTimeout(400);
check("сжатие: навигатор «Тест» — вопросы теста на экране", await page.evaluate(() => { const l = [...document.querySelectorAll("span")].find(x => (x.innerText || "").trim() === "ВОПРОСЫ ТЕСТА"); const r = l && l.getBoundingClientRect(); return !!r && r.top > 40 && r.bottom < innerHeight - 120; }));   // на экране, выше нижней полосы
await page.evaluate(() => { const r = document.querySelector('[data-card="sit"]'); if (r) r.click(); }); await page.waitForTimeout(250);
check("сжатие: тап по строке раскрывает карточку для правки", await page.evaluate(() => document.querySelectorAll('[aria-label="Удалить ситуацию"]').length === 1));
await btn("Отменить"); await page.waitForTimeout(300);
await page.screenshot({ path: OUT + "/ed-list-dark.png" });

// удаление с подтверждением: первый тап спрашивает, не удаляет
await page.evaluate(() => document.querySelector('[aria-label="Удалить"]').click()); await page.waitForTimeout(300);
check("удаление спрашивает подтверждение", /Удалить\s*Нет|Удалить\nНет/.test(await text()) || (await text()).includes("Нет"));
// подтверждаем: вместе с уроком сервер чистит следы его шагов (этап 20)
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => (x.innerText || "").trim() === "Удалить"); if (b) b.click(); }); await page.waitForTimeout(700);
check("удаление урока чистит следы его шагов на сервере", Array.isArray(wiped) && wiped.length === 5 && wiped.every(x => /^cms-[lpdbq]-\d+$/.test(x)), JSON.stringify(wiped));

// «+ Урок в раздел»: новый урок видит общие части раздела, сохраняется только своим текстом
savedAll = [];
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => (x.innerText || "").trim() === "Урок в раздел"); if (b) b.click(); }); await page.waitForTimeout(600);
t = await text();
check("«+ Урок в раздел»: общие части раздела видны сразу", /РАЗДЕЛ «СУБОРДИНАЦИЯ» — ДЛЯ ВСЕХ УРОКОВ/.test(t) && /СИТУАЦИЯ 2/.test(t) && /ВОПРОС 1/.test(t) && /ГОСТЬ ГОВОРИТ/.test(t));
check("порядок шагов раздела в предпросмотре: уроки, потом практика, диалог, тест", /ПОРЯДОК ШАГОВ РАЗДЕЛА/.test(t) && t.indexOf("Если менеджера нет") < t.indexOf("Практика: Субординация") && t.indexOf("Практика: Субординация") < t.indexOf("Тест: Субординация"));
await page.fill('input[placeholder^="Напр. «Базовые"]', "Что делать, если не знаешь?");
await page.fill('textarea[placeholder^="Напиши текст урока"]', "Не знаешь ответа — не выдумывай: «Уточню и вернусь».");
await btn("Сохранить урок"); await page.waitForTimeout(600);
check("урок в раздел: одна запись, без общих частей, встаёт последним", savedAll.length === 1 && savedAll[0].module === "Субординация" && savedAll[0].questions.length === 0 && savedAll[0].sort === 3, JSON.stringify(savedAll.map(x => ({ m: x.module, q: x.questions.length, s: x.sort }))));
saved = null;   // дальше проверки «не даёт сохранить» ждут, что сохранений ещё не было
// новый урок
await btn("Новый урок");
check("форма: хостес есть в «Для кого»", (await text()).includes("Хостес"));
await btn("Хостес");
check("разделы хостес — метками", (await text()).includes("Встреча VIP"));
check("у хостес раздела «Сборка» нет — только у бара", !/\nСБОРКА\n|СБОРКА\s*\n/.test(await text()) && !(await text()).includes("Найти коктейль"));
await btn("Новый"); await page.waitForTimeout(200);
await page.fill('input[placeholder^="Напр. «Наше вино»"]', "Наше вино");
await page.fill('input[placeholder^="Напр. «Базовые"]', "");
// форматирование
const ta = 'textarea[placeholder^="Напиши текст урока"]';
await page.fill(ta, "Советуй вино\nШабли к рыбе\nКьянти к пасте");
await page.evaluate((s) => { const el = document.querySelector(s); el.focus(); el.setSelectionRange(0, 12); }, ta); await btn("Заголовок");
let v = await page.inputValue(ta); check("«Заголовок» делает строку заголовком", v.startsWith("**Советуй вино**"), JSON.stringify(v.slice(0, 30)));
await page.evaluate((s) => { const el = document.querySelector(s); const v = el.value; const a = v.indexOf("Шабли"); el.focus(); el.setSelectionRange(a, v.length); }, ta); await btn("• Список");
v = await page.inputValue(ta); check("«• Список» ставит пункты на выделенные строки", v.includes("• Шабли к рыбе\n• Кьянти к пасте"), JSON.stringify(v));
await page.evaluate((s) => { const el = document.querySelector(s); const v = el.value; const a = v.indexOf("рыбе"); el.focus(); el.setSelectionRange(a, a + 4); }, ta); await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Жирный").click()); await page.waitForTimeout(300);
v = await page.inputValue(ta); check("«Ж» делает выделение жирным", v.includes("**рыбе**"), JSON.stringify(v));
await btn("Показать, как увидит сотрудник"); await page.waitForTimeout(300);
t = await text();
check("предпросмотр: карточка раздела и текст", /СВОЁ · ХОСТЕС/.test(t) && /Наше вино/.test(t) && /Советуй вино/.test(t));

// ассистент: урок из текста
await btn("Урок из текста");
await page.fill('textarea[placeholder^="Вставь регламент"]', "Шабли — к морепродуктам, Кьянти — к пасте. Сначала спроси гостя.");
await btn("Собрать урок");
t = await text(); check("урок из текста: результат показан", t.includes("Три вина, которые спрашивают чаще всего"));
check("урок из текста: ушли материал, трек и режим", aiCalls[0] && aiCalls[0].mode === "lesson" && aiCalls[0].role === "spg" && /Шабли/.test(aiCalls[0].text));
await btn("Заменить текст");
v = await page.inputValue(ta); check("урок из текста: текст заменён, название подставлено", v.startsWith("**Три вина") && (await page.inputValue('input[placeholder^="Напр. «Базовые"]')) === "Наше вино");
// улучшить
await btn("Улучшить текст"); t = await text(); check("улучшить: показано «стало»", t.includes("СТАЛО") && t.includes("Короче и яснее"));
await btn("Оставить как было"); v = await page.inputValue(ta); check("улучшить: «оставить как было» ничего не меняет", v.startsWith("**Три вина"));
// вопросы
await btn("Придумать ситуации"); t = await text(); check("ситуации: ассистент предложил две", t.includes("Гость просит вино к рыбе.") && t.includes("НАЙДИ ОШИБКУ"));
check("ситуации: ушёл режим situations с текстом урока", aiCalls[aiCalls.length - 1].mode === "situations" && /Три вина/.test(aiCalls[aiCalls.length - 1].text));
await btn("Добавить выбранные"); t = await text(); check("ситуации: добавлены карточками", /СИТУАЦИЯ 1/.test(t) && /СИТУАЦИЯ 2/.test(t));
await btn("Добавить ситуацию"); await btn("Сохранить урок");
check("пустая ситуация не даёт сохранить, объясняет", /Ситуация 3: нужна сцена/.test(await text()) && !saved);
await page.evaluate(() => ([...document.querySelectorAll('[aria-label="Удалить ситуацию"]')].pop() || { click() {} }).click()); await page.waitForTimeout(300);
check("предпросмотр: ситуация как в игре", /ЧТО ДЕЛАЕШЬ\?/.test(await text()) && /практика · 2/.test(await text()));
await btn("Собрать диалог"); await page.fill('input[placeholder^="О чём разговор"]', "Гость пришёл первым"); await btn("Собрать диалог"); await page.waitForTimeout(300);
t = await text(); check("диалог: ассистент собрал, показан гость и число шагов", /Михаил/.test(t) && /3 шагов · выборов: 1/.test(t));
check("диалог: ушли режим, текст урока и ситуация разговора", aiCalls[aiCalls.length - 1].mode === "dialogue" && aiCalls[aiCalls.length - 1].idea === "Гость пришёл первым");
await btn("Взять в урок"); t = await text(); check("диалог: в уроке — гость и шаги", /ВЫБОР СОТРУДНИКА/.test(t) && (await page.inputValue('input[placeholder^="Имя гостя"]')) === "Михаил");
await page.fill('input[placeholder^="Имя гостя"]', ""); await btn("Сохранить урок");
check("диалог без имени гостя не сохраняется, объясняет", /Живой диалог: как зовут гостя\?/.test(await text()) && !saved);
await page.fill('input[placeholder^="Имя гостя"]', "Михаил");
check("предпросмотр: мини-переписка диалога", /ЖИВОЙ ДИАЛОГ/.test(await text()) && /Добрый вечер, жду коллегу\./.test(await text()));
await btn("Придумать вопросы"); t = await text(); check("вопросы: предложены три", t.includes("Что посоветовать к морепродуктам?") && t.includes("Кьянти — к чему?"));
await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find(d => d.innerText && d.innerText.startsWith("Кьянти — к чему?") && d.parentElement && d.parentElement.style.cursor === "pointer"); (el ? el.parentElement : null)?.click(); }); await page.waitForTimeout(300);
check("вопросы: снял отметку — к добавлению два", (await text()).includes("Добавить выбранные (2)"));
await btn("Добавить выбранные"); t = await text();
check("вопросы: добавлены карточками", /ВОПРОС 1/.test(t) && /ВОПРОС 2/.test(t) && !/ВОПРОС 3/.test(t));
// порядок
// карточки свёрнуты в строку (правка 162): порядок — стрелкой прямо в строке
const firstQ = () => page.evaluate(() => { const r = document.querySelector('[data-card="q"]'); return r ? r.innerText : ""; });
const q1 = await firstQ(); await page.evaluate(() => { const b = document.querySelector('[data-card="q"] [aria-label="Ниже"]'); if (b) b.click(); }); await page.waitForTimeout(300);
check("порядок вопросов: «ниже» меняет местами", (await firstQ()) !== q1);
// проверка незаполненного вопроса
await btn("Добавить вопрос"); await btn("Сохранить урок");
check("незаполненный вопрос не даёт сохранить, объясняет", /Вопрос 3: нужен текст вопроса/.test(await text()) && !saved);
await page.evaluate(() => ([...document.querySelectorAll('[aria-label="Удалить вопрос"]')].pop() || { click() {} }).click()); await page.waitForTimeout(300);
await page.screenshot({ path: OUT + "/ed-form-dark.png", fullPage: false });
// черновик переживает перезагрузку
await page.waitForTimeout(900);
check("черновик записан на телефоне", await page.evaluate(() => !!localStorage.getItem("sa_cms_draft")));
await openEditor(); await btn("Новый урок");
t = await text(); check("после перезагрузки — «Восстановлен черновик»", /Восстановлен черновик от \d\d:\d\d/.test(t) && (await page.inputValue(ta)).startsWith("**Три вина"));
// сохранение
await btn("Сохранить урок"); await page.waitForTimeout(700);
check("сохранено: трек, раздел, название, текст", saved && saved.role === "spg" && saved.module === "Наше вино" && saved.title === "Наше вино" && saved.content.startsWith("**Три вина"));
const sq = saved ? saved.questions.filter(q => !q.kind) : [], ss = saved ? saved.questions.filter(q => q.kind === "situation") : [];
check("сохранено: вопросы без служебных id, верный на месте", sq.length === 2 && !("id" in sq[0]) && sq.every(q => q.options[q.correct]));
check("сохранено: ситуации в questions с пометкой, без лишних полей", ss.length === 2 && ss[0].scene && !("id" in ss[0]) && !("situations" in saved) && ss.every(x => x.options[x.correct]));
const sd = saved ? saved.questions.filter(q => q.kind === "dialogue") : [];
check("сохранено: диалог — один, с гостем, шаги без номеров, в выборе ровно один верный", sd.length === 1 && sd[0].guest.name === "Михаил" && sd[0].steps.length === 3 && sd[0].steps.every(x => !("id" in x)) && sd[0].steps.filter(x => x.type === "choice").every(x => x.options.filter(o => o.correct).length === 1) && !("dialogue" in saved));
const bar31 = async () => { await page.evaluate(() => { const rows = [...document.querySelectorAll("div")].filter(d => (d.innerText || "").trim() === "Фирменный сауэр"); let el = rows.pop();
  for (let i = 0; i < 5 && el && !el.querySelector('[aria-label="Изменить"]'); i++) el = el.parentElement;
  const b = el && el.querySelector('[aria-label="Изменить"]'); if (b) b.click(); }); await page.waitForTimeout(600); };
check("после сохранения черновик стёрт и снова список", await page.evaluate(() => !localStorage.getItem("sa_cms_draft")) && /Новый урок/.test(await text()));
let stars = null;
await ctx.route("**/rpc/save_practice_stars", (route) => { stars = JSON.parse(route.request().postData() || "{}"); route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(1600);
await page.evaluate(() => window.__saNav && window.__saNav("home")); await page.waitForTimeout(1400);
await openTopic("Субординация");
await page.waitForTimeout(1300); t = await text();
check("сотрудник: оба урока раздела подряд, потом практика и тест раздела", /Кто кому подчиняется/.test(t) && /Если менеджера нет/.test(t) && /Практика: Субординация/.test(t) && /Тест: Субординация/.test(t)
  && t.indexOf("Если менеджера нет") < t.indexOf("Практика: Субординация") && t.indexOf("Практика: Субординация") < t.indexOf("Тест: Субординация"));
await page.evaluate(() => { const c = [...document.querySelectorAll("div,span")].filter(d => d.offsetParent !== null && (d.innerText || "").trim() === "Практика: Субординация").pop(); (c && (c.closest("[role=button]") || c.parentElement) || c).click(); });
await page.waitForTimeout(1500); t = await text();
check("сотрудник: практика открылась, сцена своего урока", /Менеджера нет, гость требует скидку\.|Новичок спорит со старшим при гостях\./.test(t), t.slice(0, 120).replace(/\s+/g, " "));
for (let i = 0; i < 12; i++) {
  const st = await page.evaluate(() => {
    const vis = [...document.querySelectorAll("button,div,span")].filter(b => b.offsetParent !== null && !b.disabled);
    const next = vis.filter(b => b.tagName === "BUTTON").find(b => /^(Дальше|Далее|Продолжить|Финиш|Итоги|К итогам|Результат|Завершить|Готово)/.test((b.innerText || "").trim()));
    if (next) { next.click(); return "дальше"; }
    // варианты — блоки с нажатием, а не кнопки: берём самый внутренний с точным текстом
    const opt = vis.filter(b => /^(Зову старшего смены|Спор при гостях)$/.test((b.innerText || "").trim())).pop();
    if (opt) { opt.click(); return "ответ"; }
    return "нечего";
  });
  await page.waitForTimeout(700);
  if (stars) break;
  if (st === "нечего") break;
}
await page.waitForTimeout(800);
check("сотрудник: звёзды практики ушли на сервер под номером шага", stars && stars.p_lesson_id === "cms-p-11" && stars.p_stars >= 1, JSON.stringify(stars));
let prog = [];
await ctx.route("**/rpc/save_progress", (route) => { prog.push(JSON.parse(route.request().postData() || "{}")); route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
await page.evaluate(() => window.__saNav && window.__saNav("home")); await page.waitForTimeout(1200);
await openTopic("Субординация");
await page.waitForTimeout(1200); t = await text();
check("сотрудник: шаги раздела — практика → диалог → тест", /Живой диалог: Субординация/.test(t) && t.indexOf("Практика: Субординация") < t.indexOf("Живой диалог: Субординация") && t.indexOf("Живой диалог: Субординация") < t.indexOf("Тест: Субординация"));
await page.evaluate(() => { const c = [...document.querySelectorAll("div,span")].filter(d => d.offsetParent !== null && (d.innerText || "").trim() === "Живой диалог: Субординация").pop(); (c && (c.closest("[role=button]") || c.parentElement) || c).click(); });
await page.waitForTimeout(2500); t = await text();
check("сотрудник: диалог открылся — гость и его реплика", /Ольга/.test(t) && /Позовите менеджера!/.test(t), t.slice(0, 160).replace(/\s+/g, " "));
let seenBtns = "";
for (let i = 0; i < 24; i++) {
  const st = await page.evaluate(() => {
    const vis = [...document.querySelectorAll("button,div,span")].filter(b => b.offsetParent !== null && !b.disabled);
    // сначала — завершение/переход; варианты — только кнопки (выбранный ответ остаётся в переписке пузырём)
    const next = vis.filter(b => b.tagName === "BUTTON").find(b => /^(Закрыть|Дальше|Далее|Продолжить|Завершить|Готово|Закончить)/.test((b.innerText || "").trim()));
    if (next) { next.click(); return "дальше:" + next.innerText.trim().slice(0, 16); }
    window.__answered = window.__answered || {};
    const opt = vis.filter(b => /^(Сейчас позову старшего смены|Коротко объясню суть)$/.test((b.innerText || "").trim()) && !window.__answered[(b.innerText || "").trim()]).pop();
    if (opt) { window.__answered[opt.innerText.trim()] = 1; opt.click(); return "ответ"; }
    return "ждать:" + vis.filter(b => b.tagName === "BUTTON").map(b => (b.innerText || "").trim().slice(0, 14)).filter(Boolean).join("|").slice(0, 120);
  });
  seenBtns = st;
  await page.waitForTimeout(st.startsWith("ждать") ? 900 : 600);
  if (prog.some(x => x.p_lesson_id === "cms-d-11")) break;
}
check("сотрудник: диалог пройден — шаг засчитан на сервере", prog.some(x => x.p_lesson_id === "cms-d-11"), "последнее: " + seenBtns + " · " + JSON.stringify(prog.map(x => x.p_lesson_id)));
// ── сборка: урок бара ──
saved = null;
await openEditor(); await bar31(); t = await text();
check("у бара все метки навигатора на экране — «Просмотр» не уезжает", await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => (x.innerText || "").trim().startsWith("Просмотр")); const s = [...document.querySelectorAll("button")].find(x => (x.innerText || "").trim().startsWith("Сборка"));
  const r = b && b.getBoundingClientRect(); return !!r && !!s && r.left >= 0 && r.right <= innerWidth; }));
check("урок бара: сборка открылась — напиток и шаги", /НАПИТОК/.test(t) && (await page.inputValue('input[placeholder^="Название: «Негрони»"]', { timeout: 4000 }).catch(() => "")) === "Фирменный сауэр" && /ШАГ 2/.test(t) && !/ШАГ 3/.test(t));
await page.evaluate(() => document.querySelectorAll('button').forEach(b => { if ((b.innerText || "").trim() === "Убрать сборку из урока") b.click(); })); await page.waitForTimeout(300);
await page.fill('input[placeholder^="Найти коктейль"]', "птица", { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300);
t = await text(); check("поиск коктейля: «птица» → «Птица джунглей»", /Птица джунглей/.test(t));
await page.evaluate(() => { const r = [...document.querySelectorAll("div")].filter(d => (d.innerText || "").trim().startsWith("Птица джунглей") && d.style.cursor === "pointer").pop(); if (r) r.click(); }); await page.waitForTimeout(500);
const bc = aiCalls[aiCalls.length - 1];
check("рецепт коктейля ушёл ассистенту целиком", bc && bc.mode === "build" && /Тёмный ром 45 мл/.test(bc.text) && /Бокал: рокс/.test(bc.text), bc ? bc.text.slice(0, 90) : "нет");
await btn("Взять в урок"); t = await text();
check("сборка из рецепта — в уроке", (await page.inputValue('input[placeholder^="Название: «Негрони»"]')) === "Птица джунглей" && /ШАГ 2/.test(t));
await page.fill('input[placeholder^="Название: «Негрони»"]', ""); await btn("Сохранить урок");
check("сборка без названия не сохраняется, объясняет", /Сборка: как называется напиток\?/.test(await text()) && !saved);
await page.fill('input[placeholder^="Название: «Негрони»"]', "Птица джунглей"); await btn("Сохранить урок"); await page.waitForTimeout(600);
const sb = saved ? saved.questions.filter(q => q.kind === "build") : [];
check("сохранено: сборка — одна, бокал, цвет, шаги без номеров, ровно один верный", sb.length === 1 && sb[0].glass === "rocks" && sb[0].tint === "#B8352A" && sb[0].steps.length === 2 && sb[0].steps.every(x => !("id" in x) && x.options.filter(o => o.ok).length === 1) && !("build" in saved));
// ── глазами бармена: своя сборка до звёзд ──
stars = null;
await page.evaluate(() => { localStorage.setItem("sa_last_role", JSON.stringify("bar")); }); await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(1600);
await page.evaluate(() => window.__saNav && window.__saNav("home")); await page.waitForTimeout(1400);
await openTopic("Наши коктейли");
await page.waitForTimeout(1200); t = await text();
check("бармен: в своём модуле шаг «Сборка: Фирменный сауэр»", /Сборка: Фирменный сауэр/.test(t), t.slice(0, 120).replace(/\s+/g, " "));
await page.evaluate(() => { const c = [...document.querySelectorAll("div,span")].filter(d => d.offsetParent !== null && (d.innerText || "").trim() === "Сборка: Фирменный сауэр").pop(); (c && (c.closest("[role=button]") || c.parentElement) || c) && (c.closest("[role=button]") || c.parentElement || c).click(); });
await page.waitForTimeout(1800); t = await text();
check("бармен: сборка открылась — вопрос своего шага", /С чего начинаешь\?|Как смешиваешь\?/.test(t), t.slice(0, 140).replace(/\s+/g, " "));
let lastB = "";
await page.evaluate(() => { window.__answered = {}; });
for (let i = 0; i < 20; i++) {
  lastB = await page.evaluate(() => {
    const vis = [...document.querySelectorAll("button,div,span")].filter(b => b.offsetParent !== null && !b.disabled);
    const next = vis.filter(b => b.tagName === "BUTTON").find(b => /^(Дальше|Далее|Продолжить|Следующий|К следующему|Показать итог|Готово|Закрыть|Завершить|Итог)/.test((b.innerText || "").trim()));
    if (next) { next.click(); return "дальше:" + next.innerText.trim().slice(0, 14); }
    const opt = vis.filter(b => /^(Купе|Сухой шейк, потом со льдом)$/.test((b.innerText || "").trim()) && !window.__answered[(b.innerText || "").trim()]).pop();
    if (opt) { window.__answered[opt.innerText.trim()] = 1; opt.click(); return "ответ"; }
    return "ждать:" + vis.filter(b => b.tagName === "BUTTON").map(b => (b.innerText || "").trim().slice(0, 14)).filter(Boolean).join("|").slice(0, 120);
  });
  await page.waitForTimeout(lastB.startsWith("ждать") ? 800 : 600);
  if (stars) break;
}
check("бармен: сборка пройдена — звёзды на сервер под номером шага", stars && stars.p_lesson_id === "cms-b-31", "последнее: " + lastB + " · " + JSON.stringify(stars));
check("ошибок страницы нет", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(results.join("\n"));
await browser.close(); server.close();
