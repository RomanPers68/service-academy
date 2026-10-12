// lib/table-pick.js — какие ситуации раздела проверить «у стола» после урока (Доп. 289).
// Источник — практика того же раздела (lesson.type === "practice"): своих ситуаций
// у текстовых уроков нет, а писать их заново не нужно. Берём те, что ближе всего
// к тексту урока: совпадение основ слов, редкие слова весят больше (IDF), название
// урока — в несколько раз больше текста. Порядок детерминированный: один и тот же
// урок даёт те же ситуации (seed сдвигает выбор, если нужно разнообразие).

const STOP = new Set([
  "гость", "гостя", "гостю", "гостем", "гости", "гостей", "гостям", "гостями",
  "официант", "официанта", "официанту", "официантом", "официанты",
  "этот", "этого", "этому", "этом", "эта", "эту", "этой", "эти", "этих", "это",
  "чтобы", "когда", "если", "тоже", "также", "только", "очень", "уже", "есть", "быть",
  "было", "была", "были", "будет", "может", "можно", "нельзя", "нужно", "надо", "просто",
  "сразу", "всегда", "никогда", "после", "перед", "потом", "сейчас", "здесь", "там",
  "твой", "твоя", "твоё", "твое", "твои", "тебе", "тебя", "себя", "свой", "своя", "свои",
  "делаешь", "делать", "сделать", "говорит", "сказал", "сказать", "спрашивает",
  "правильно", "верно", "неверно", "ответ", "вопрос", "вариант", "ситуация", "ситуации",
  "который", "которая", "которые", "какой", "какая", "какие", "каждый", "каждая",
  "всё", "все", "всех", "всем", "весь", "вся", "него", "нему", "неё", "нее", "них",
]);

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");

// Основы слов: короткая (4 буквы — «стол/столик», «зака/заказа») и длинная (6 букв —
// различает «провер-» и «провож-»). Короткая весит вдвое меньше.
export function tokensOf(text) {
  const out = new Map();
  const words = norm(text).match(/[а-яa-z]{4,}/g) || [];
  for (const w of words) {
    if (STOP.has(w)) continue;
    const a = "4:" + w.slice(0, 4);
    out.set(a, (out.get(a) || 0) + 1);
    if (w.length >= 6) { const b = "6:" + w.slice(0, 6); out.set(b, (out.get(b) || 0) + 1); }
  }
  return out;
}

export function situationText(s) {
  if (!s) return "";
  const right = Array.isArray(s.options) && typeof s.correct === "number" ? s.options[s.correct] : "";
  return [s.scene, s.statement, s.start, s.guestThought, s.question, right, s.win].filter(Boolean).join(" ");
}

// Все ситуации практик раздела (по порядку)
export function practicePool(mod) {
  const out = [];
  for (const l of (mod && mod.lessons) || []) {
    if (l && l.type === "practice" && Array.isArray(l.situations)) {
      for (const s of l.situations) if (s && Array.isArray(s.options) && s.options.length > 1 && typeof s.correct === "number") out.push({ ...s, _from: l.id, _fromTitle: l.title, _mod: mod && mod.id });
    }
  }
  return out;
}

// Доп. 310: в треках без практики (бар, хостес) «у стола» и разминка — из вопросов тестов.
// Вопрос теста становится заданием «у стола» (жанр quiz): тот же текст, те же варианты,
// пояснение — как разбор. Ошибка уходит в «Работу над ошибками» тем же вопросом теста.
export function quizPool(mod, onlyIds = null) {
  const out = [];
  for (const l of (mod && mod.lessons) || []) {
    if (!l || l.type !== "quiz" || !Array.isArray(l.questions)) continue;
    if (onlyIds && !onlyIds.has(l.id)) continue;
    for (const q of l.questions) {
      if (!q || q.kind || !q.q || !Array.isArray(q.options) || q.options.length < 2 || typeof q.correct !== "number") continue;
      const ex = String(q.explanation || "").trim();
      out.push({ genre: "quiz", emoji: "📝", question: String(q.q), options: q.options.slice(), correct: q.correct,
        win: ex ? "🎯 " + ex : "🎯 Верно.", fail: ex ? "💡 " + ex : "", _from: l.id, _fromTitle: l.title, _mod: mod && mod.id, _quiz: true });
    }
  }
  return out;
}

// Что дать «у стола» по разделу: ситуации практики, а если их нет — вопросы тестов
export function tablePool(mod) {
  const p = practicePool(mod);
  return p.length ? p : quizPool(mod);
}

export function rankSituations(lesson, pool) {
  const list = pool || [];
  if (!list.length) return [];
  const sitTok = list.map((s) => tokensOf(situationText(s)));
  const df = new Map();
  sitTok.forEach((m) => { for (const k of m.keys()) df.set(k, (df.get(k) || 0) + 1); });
  const N = list.length;
  const idf = (k) => Math.log((N + 1) / ((df.get(k) || 0) + 1)) + 0.15;
  const title = tokensOf(lesson && lesson.title);
  const body = tokensOf(lesson && lesson.content);
  const lw = (k) => Math.min(3, body.get(k) || 0) + (title.has(k) ? 4 : 0);
  return list.map((s, i) => {
    let score = 0, size = 0;
    for (const k of sitTok[i].keys()) {
      size++;
      const w = lw(k);
      if (w) score += idf(k) * w * (k[0] === "4" ? 0.5 : 1);
    }
    return { s, i, score: size ? score / Math.sqrt(size) : 0 };
  }).sort((a, b) => (b.score - a.score) || (a.i - b.i));
}

// n ситуаций: самая близкая к уроку, дальше — по возможности другого жанра
// (не два «верно/неверно» подряд), если она не сильно слабее.
export function pickForLesson(lesson, pool, n = 2, seed = 0) {
  const ranked = rankSituations(lesson, pool);
  if (!ranked.length) return [];
  const shift = ranked.length > n ? (Math.abs(seed | 0) % Math.min(ranked.length - n + 1, 3)) : 0;
  const cand = ranked.slice(shift).concat(ranked.slice(0, shift));
  const genre = (x) => x.s.genre || x.s.type || "action";
  const out = [cand[0]];
  const rest = cand.slice(1);
  while (out.length < n && rest.length) {
    const used = new Set(out.map(genre));
    const best = rest[0];
    const other = rest.find((x) => !used.has(genre(x)));
    const take = other && other.score >= best.score * 0.7 ? other : best;
    out.push(take);
    rest.splice(rest.indexOf(take), 1);
  }
  return out.map((x) => x.s);
}
