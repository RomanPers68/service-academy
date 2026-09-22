// api/lesson-assist.js — ассистент редактора контента (правка 156).
// Vercel превращает файл в серверную функцию POST /api/lesson-assist.
//
// Три режима — всё приходит ЧЕРНОВИКОМ, сохраняет только человек в редакторе:
//   lesson    — урок из материала: текст регламента/заметок и/или PDF → { title, content }
//   improve   — улучшить текст урока: яснее, короче, без ошибок, факты те же → { content }
//   questions — вопросы к тесту по тексту урока → { questions: [{ q, options, correct, explanation }] }
//   situations — «Практика ситуаций» по тексту урока (правка 158) →
//                { situations: [{ genre, emoji, scene, question, options, correct, win, fail }] }
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
const STYLE = [
  "Стиль уроков приложения Service Academy (ресторан «Два моря»):",
  "— на «ты», живо и по делу, без канцелярита и воды; короткие абзацы;",
  "— подзаголовок — отдельной строкой целиком в **двойных звёздочках**;",
  "— список — каждая строка начинается с «• »;",
  "— точная фраза гостю — отдельной строкой в «ёлочках»;",
  "— хорошо/плохо — строки, начинающиеся с «✅ » и «❌ »;",
  "— никаких других разметок (#, _, таблиц, HTML).",
  "Не выдумывай фактов, цен, блюд, имён и правил, которых нет в исходном материале.",
].join("\n");

const PROMPT = {
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
    "Пояснение — одной фразой: почему верный ответ верный.",
    'Ответ — строго JSON без пояснений и без ```: {"questions": [{"q": "…", "options": ["…","…","…","…"], "correct": 0, "explanation": "…"}]}',
    "\nТЕКСТ УРОКА:\n" + text,
  ].join("\n"),
  dialogue: (role, text, title, idea) => [
    `Составь «Живой диалог» — тренажёр разговора с гостем по уроку «${title || "без названия"}» для: ${ROLE_RU[role] || "сотрудники зала"}.`,
    idea ? "Ситуация разговора: " + idea : "Ситуацию выбери сам — самую жизненную для этого урока.",
    "Гость: имя, аватар (один эмодзи человека), контекст — кто он, зачем пришёл, в каком настроении (1–2 предложения), начальное настроение mood от 1 до 5 (3 — нейтрально).",
    "Шаги по порядку, 8–12 штук: action — что происходит (коротко, от третьего лица); guest — реплика гостя (живая, разговорная); choice — вопрос сотруднику и ровно 3 варианта ответа.",
    "В choice: один вариант верный (correct: true, moodDelta: 1), два неверных — правдоподобные ошибки (correct: false, moodDelta: 0 или -1); feedback — почему так, одной фразой. Сделай 3–4 choice.",
    "Опирайся на текст урока. Реплики сотрудника — на «вы» к гостю.",
    "tip — итог разговора: главная мысль урока одной фразой, покажется в конце.",
    'Ответ — строго JSON без пояснений и без ```: {"dialogue": {"tip": "…", "guest": {"name": "…", "avatar": "👔", "context": "…", "mood": 3}, "steps": [{"type": "action", "text": "…"}, {"type": "guest", "text": "…"}, {"type": "choice", "prompt": "…", "options": [{"text": "…", "correct": true, "feedback": "…", "moodDelta": 1}]}]}}',
    "\nТЕКСТ УРОКА:\n" + text,
  ].join("\n"),
  situations: (role, text, title) => [
    `Составь 4 ситуации для «Практики ситуаций» по уроку «${title || "без названия"}» для: ${ROLE_RU[role] || "сотрудники зала"}.`,
    "Ситуация — короткая сцена из смены, 1–3 предложения, от второго лица («Ты…», «Гость…»), вопрос и 4 варианта действия, ровно один верный.",
    "Неверные — правдоподобные ошибки новичка, не абсурд. Вид genre: «action» — вопрос «Что делаешь?»; «find» — в сцене сотрудник ошибается, вопрос «В чём ошибка?». Сделай 2–3 action и 1–2 find.",
    "win — реакция при верном ответе, одна фраза, можно начать с 🎯; fail — подсказка при ошибке, одна фраза, можно начать с 💡; emoji — один эмодзи к сцене.",
    "Опирайся только на текст урока, ничего не выдумывай.",
    'Ответ — строго JSON без пояснений и без ```: {"situations": [{"genre": "action", "emoji": "🔥", "scene": "…", "question": "Что делаешь?", "options": ["…","…","…","…"], "correct": 0, "win": "…", "fail": "…"}]}',
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
    const ss = (Array.isArray(o.situations) ? o.situations : []).slice(0, 8).map(x => {
      const options = (Array.isArray(x && x.options) ? x.options : []).map(v => cut(v, 200).trim()).filter(Boolean).slice(0, 4);
      let correct = Number.isInteger(x && x.correct) ? x.correct : parseInt(x && x.correct, 10);
      if (!(correct >= 0 && correct < options.length)) correct = 0;
      const genre = x && x.genre === "find" ? "find" : "action";
      return { genre, emoji: cut(x && x.emoji, 4).trim(), scene: cut(x && x.scene, 400).trim(),
        question: cut(x && x.question, 160).trim() || (genre === "find" ? "В чём ошибка?" : "Что делаешь?"),
        options, correct, win: cut(x && x.win, 240).trim(), fail: cut(x && x.fail, 240).trim() };
    }).filter(x => x.scene && x.options.length >= 2);
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
  if (!["lesson", "improve", "questions", "situations", "dialogue"].includes(mode)) return res.status(400).json({ ok: false, error: "Неизвестный режим" });

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
    : mode === "dialogue" ? PROMPT.dialogue(role, material, cut(title, 120), cut(idea, 400).trim()) : PROMPT.questions(role, material, cut(title, 120));
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
