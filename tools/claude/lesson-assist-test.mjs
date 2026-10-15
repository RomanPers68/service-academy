const results = []; const check = (n, c, x = "") => results.push(`${c ? "✓" : "✗"} ${n}${x ? " — " + x : ""}`);
let script = [];   // очередь ответов fetch: whoami, затем OpenRouter
globalThis.fetch = async (url, opt) => {
  const next = script.shift() || { status: 500, body: { error: { message: "нет ответа в сценарии" } } };
  if (next.check) next.check(url, JSON.parse(opt.body || "{}"));
  return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body };
};
const mkRes = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const who = (emp) => ({ status: 200, body: emp ? { ok: true, employee: emp } : { ok: false } });
const or = (content, status = 200) => ({ status, body: status === 200 ? { model: "m", choices: [{ message: { content } }] } : { error: { message: "упала", code: status } } });
const boss = { is_admin: true, position: "manager" };
const call = async (body) => { const { default: handler } = await import("../../api/lesson-assist.js?" + Math.random()); const res = mkRes(); await handler({ method: "POST", body }, res); return res; };

delete process.env.OPENROUTER_API_KEY;
let r = await call({ token: "t", mode: "lesson", text: "x" }); check("нет ключа → 500 с подсказкой", r.code === 500 && /OPENROUTER_API_KEY/.test(r.body.error));
process.env.OPENROUTER_API_KEY = "k";
r = await call({ token: "t", mode: "hack" }); check("чужой режим → 400", r.code === 400);
script = [who(null)]; r = await call({ token: "t", mode: "lesson", text: "Регламент" }); check("нет сессии → 401", r.code === 401);
script = [who({ position: "waiter" })]; r = await call({ token: "t2", mode: "lesson", text: "Регламент" }); check("сотрудник → 403", r.code === 403);
script = [who(boss)]; r = await call({ token: "t3", mode: "improve", text: "коротко" }); check("короткий текст для улучшения → 400", r.code === 400);
let sent = null;
script = [who(boss), { ...or('```json\n{"title":"Субординация","content":"**Кто главный**\\n• Старший смены"}\n```'), check: (u, b) => { sent = b; } }];
r = await call({ token: "t4", mode: "lesson", role: "seasonal", text: "Старший смены отвечает за зал." });
check("урок из текста → 200, название и текст", r.code === 200 && r.body.ok && r.body.title === "Субординация" && r.body.content.includes("• Старший смены"));
check("в модель ушёл материал и стиль", sent && /Старший смены отвечает/.test(sent.messages[0].content[0].text) && /двойных звёздочках/.test(sent.messages[0].content[0].text));
script = [who(boss), { ...or('{"title":"Из PDF","content":"Текст"}'), check: (u, b) => { sent = b; } }];
r = await call({ token: "t5", mode: "lesson", role: "spg", pdfBase64: "data:application/pdf;base64,QUJD" });
check("урок из PDF: файл приложен, префикс снят", r.code === 200 && sent.messages[0].content[1].file.file_data === "data:application/pdf;base64,QUJD");
script = [who(boss), or('Вот вопросы: {"questions":[{"q":"Кто главный в смене?","options":["Старший смены","Повар","Гость","Бармен","Лишний"],"correct":7,"explanation":"Он отвечает за зал"},{"q":"","options":["a","b"]},{"q":"Один вариант","options":["a"]}]} Удачи!')];
r = await call({ token: "t6", mode: "questions", title: "Субординация", text: "Старший смены отвечает за зал и принимает решения, когда менеджера нет рядом." });
const q = r.body && r.body.questions;
check("вопросы: вырезаны из текста вокруг, битые отброшены", r.code === 200 && q && q.length === 1, q ? `вопросов ${q.length}` : JSON.stringify(r.body));
check("вопросы: не больше 4 вариантов, верный в пределах", q && q[0].options.length === 4 && q[0].correct === 0);
script = [who(boss), or("", 500), or('{"content":"Улучшенный текст урока"}')];
r = await call({ token: "t7", mode: "improve", text: "Текст урока, который нужно улучшить: длинный и с повторами, повторами." });
check("первая модель упала → запасная ответила", r.code === 200 && r.body.content === "Улучшенный текст урока");
script = [who(boss), or("", 401)];
r = await call({ token: "t8", mode: "improve", text: "Текст урока, который нужно улучшить: длинный и с повторами, повторами." });
check("ключ не принят → понятная ошибка", r.code === 502 && /401/.test(r.body.error));
script = [who(boss), or("не JSON вообще")];
r = await call({ token: "t9", mode: "improve", text: "Текст урока, который нужно улучшить: длинный и с повторами, повторами." });
check("ответ не по формату → 422", r.code === 422);
script = [who(boss), or('{"situations":[{"genre":"find","emoji":"⚠️🔥🔥","scene":"Официант ставит бокал за вилками.","question":"","options":["Бокал на месте","Бокал ставят справа над ножом","Бокал не нужен","Лишний","Ещё лишний"],"correct":9,"win":"🎯 Верно","fail":"💡 Бокал — справа"},{"genre":"??","scene":"","options":["a","b"]},{"genre":"action","scene":"Гость зовёт.","options":["Подойти"]}]}')];
r = await call({ token: "t10", mode: "situations", title: "Сервировка", text: "Бокал ставят справа над ножом. Вилки слева, нож справа лезвием к тарелке." });
const ss = r.body && r.body.situations;
check("ситуации: пустые и с одним вариантом отброшены", r.code === 200 && ss && ss.length === 1, ss ? `ситуаций ${ss.length}` : JSON.stringify(r.body));
check("ситуации: вид, вопрос по умолчанию, 4 варианта, верный в пределах", ss && ss[0].genre === "find" && ss[0].question === "Что не так?" && ss[0].options.length === 4 && ss[0].correct === 0);
check("ситуации: эмодзи не длиннее 4 знаков", ss && ss[0].emoji.length <= 4);
script = [who(boss), { ...or(JSON.stringify({ dialogue: { guest: { name: "Михаил", avatar: "👔👔👔", context: "Деловой ужин", mood: 9 }, steps: [
  { type: "action", text: "Михаил входит." }, { type: "guest", text: "" }, { type: "hack", text: "x" },
  { type: "choice", prompt: "", options: [{ text: "Добрый вечер!", correct: true, feedback: "Тепло", moodDelta: 5 }, { text: "Минуту", correct: true, moodDelta: -3 }, { text: "Бронь?", moodDelta: 0 }, { text: "Лишний" }] },
  { type: "choice", prompt: "Дальше?", options: [{ text: "Один" }] } ] } })), check: (u, b) => { sent = b; } }];
r = await call({ token: "t11", mode: "dialogue", title: "Встреча", idea: "Гость пришёл первым и ждёт коллегу", text: "Встречаем гостя в первые 10 секунд: тёплое приветствие и вопрос." });
const dd = r.body && r.body.dialogue;
check("диалог: пустые и чужие шаги отброшены, выбор с одним вариантом — тоже", r.code === 200 && dd && dd.steps.length === 2 && dd.steps[1].type === "choice", dd ? JSON.stringify(dd.steps.map(x => x.type)) : JSON.stringify(r.body));
check("диалог: ровно один верный, настроение ±1, не больше 3 вариантов", dd && dd.steps[1].options.length === 3 && dd.steps[1].options.filter(x => x.correct).length === 1 && dd.steps[1].options[0].moodDelta === 1 && dd.steps[1].options[1].moodDelta === -1);
check("диалог: гость — настроение в 1–5, аватар не длиннее 4, вопрос по умолчанию", dd && dd.guest.mood === 5 && dd.guest.avatar.length <= 4 && dd.steps[1].prompt === "Что ответишь?");
check("диалог: ситуация разговора ушла в модель", sent && /Гость пришёл первым и ждёт коллегу/.test(sent.messages[0].content[0].text));
script = [who(boss), { ...or(JSON.stringify({ build: { title: "Негрони", glass: "tumbler", tint: "red", win: "Ок", lose: "Нет", steps: [
  { label: "Бокал", q: "С чего начинаешь?", cost: "не тот бокал", options: [{ t: "Рокс", ok: true, fb: "Да" }, { t: "Хайбол", ok: true, fb: "Нет" }, { t: "Купе" }, { t: "Флюте" }, { t: "Лишний" }] },
  { label: "", q: "", options: [{ t: "a" }, { t: "b" }] },
  { label: "Метод", q: "Как смешиваешь?", options: [{ t: "Стир 20 секунд" }, { t: "Шейк" }] } ] } })), check: (u, b) => { sent = b; } }];
r = await call({ token: "t12", mode: "build", role: "bar", text: "Негрони. Бокал: рокс. Лёд: да. Метод: стир. Джин 30 мл, Кампари 30 мл, красный вермут 30 мл." });
const bb = r.body && r.body.build;
check("сборка: шаг без вопроса отброшен, остальные на месте", r.code === 200 && bb && bb.steps.length === 2, bb ? JSON.stringify(bb.steps.map(x => x.label)) : JSON.stringify(r.body));
check("сборка: не больше 4 вариантов, ровно один верный (и в шаге без отметки — первый)", bb && bb.steps[0].options.length === 4 && bb.steps[0].options.filter(o => o.ok).length === 1 && bb.steps[1].options[0].ok === true);
check("сборка: чужой бокал → рокс, чужой цвет → золото", bb && bb.glass === "rocks" && bb.tint === "#C8A96E");
check("сборка: рецепт ушёл в модель целиком", sent && /Джин 30 мл, Кампари 30 мл/.test(sent.messages[0].content[0].text));
script = [who(boss), or('{"review":{"guest":"","table":"стол 7","text":"Нас встретили как родных: объяснили, кто решит вопрос, и через минуту всё было улажено."}}')];
r = await call({ token: "t13", mode: "review", title: "Субординация", text: "Старший смены отвечает за зал, пока менеджера нет. Решения при гостях принимает он." });
check("отзыв гостя: текст на месте, пустой гость → «Гость»", r.code === 200 && r.body.review && /встретили как родных/.test(r.body.review.text) && r.body.review.guest === "Гость" && r.body.review.table === "стол 7");
console.log(results.join("\n"));
