// lib/concept-pitch.js — v192 (Доп. 517): тренажёр «Рассказ гостю за 30 секунд» в «О нас».
//
// Владелец (23.11), про семь идей для «О нас»: «Ты правильно понял. Делаем все 7». Сотрудник рассказывает о ресторане
// своими словами, голосом или текстом, за 30 секунд; помощник сравнивает с образцом из блока «Рассказ гостю за 30 секунд»
// и фактами раздела (концепция, гость, кухня, атмосфера) и говорит, что получилось, что упущено, один совет и как это
// могло звучать (/api/lesson-assist, режим concept_pitch, — для всех сотрудников). Помощник не ответил — разбор здесь же,
// по словам образца (pitchLocal): какие его мысли прозвучали, какие нет. Без React.

export const PITCH_SECS = 30;
export const PITCH_LIMITS = { said: 1500, ref: 1500, facts: 3000, item: 200, items: 4, tip: 300, better: 900 };
/** Сколько слов успевают сказать за 30 секунд спокойным темпом: меньше — коротко, больше — гость устанет. */
export const PITCH_WORDS = { min: 25, max: 95 };

const STOP = new Set(["который", "которая", "которые", "потому", "сейчас", "можно", "нужно", "очень", "всегда", "здесь", "также", "тоже", "только",
  "через", "после", "перед", "между", "когда", "чтобы", "этого", "этому", "этот", "эта", "это", "наш", "наша", "наше", "наши", "нашего", "нашей",
  "нашем", "вас", "вам", "нас", "нам", "для", "или", "как", "что", "где", "при", "под", "над", "про", "без", "его", "её", "они", "она", "оно",
  "гость", "гостю", "гостя", "гостей", "гости", "ресторан", "ресторана", "ресторане", "рады", "добро", "пожаловать", "приходите", "будет", "есть"]);
const words = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/).filter(Boolean);
// грубая основа слова: первые 5 букв, у коротких — без окончания («морепродукты» и «морепродуктов», «рыба» и «рыбу» — одно)
const stem = (w) => (w.length > 5 ? w.slice(0, 5) : w.slice(0, Math.max(3, w.length - 1)));
const keys = (s) => [...new Set(words(s).filter((w) => w.length >= 4 && !STOP.has(w)).map(stem))];
// слово прозвучало, если сказанное слово начинается с его основы («утро» — «утреннего»)
const heardIn = (said) => { const ws = words(said).filter((w) => w.length >= 3); return (k) => ws.some((w) => w.startsWith(k)); };

/** Сколько слов сказано. */
export const pitchWordCount = (s) => words(s).length;

// приветствие — не мысль о ресторане: «Добрый вечер!» можно сказать по-своему
const GREET = /^(добр(ый|ое|ого)\s+(вечер|день|утро|дня|утра)|здравствуйте|приветствую|привет)[\s!.,]*$/i;
/** Мысли образца: предложения и строки «ёлочками», без пустых, служебных и приветствия. */
export function pitchIdeas(ref) {
  return String(ref || "").replace(/\r/g, "").replace(/([.!?…][»"]?)\s+/g, "$1\n").split(/\n+/)
    .map((x) => x.replace(/^[«"\s]+|[»"\s]+$/g, "").trim())
    .filter((x) => keys(x).length >= 2 && !GREET.test(x)).slice(0, 12);
}

/** Сократить мысль для списка: до n слов с многоточием. */
export const shortIdea = (s, n = 9) => { const w = String(s || "").split(/\s+/).filter(Boolean); return w.length > n ? w.slice(0, n).join(" ") + "…" : w.join(" "); };

/**
 * Разбор без помощника: какие мысли образца прозвучали (по словам), какие нет, совет по длине. → { good, missed, tip,
 * better: "", score 1–5, local: true }.
 */
export function pitchLocal(ref, said, secs = 0) {
  const heard = heardIn(said);
  const ideas = pitchIdeas(ref).map((s) => { const k = keys(s); const hit = k.filter(heard).length; return { s, ok: k.length ? hit / k.length >= 0.4 : false }; });
  const n = pitchWordCount(said);
  const good = ideas.filter((x) => x.ok).slice(0, 3).map((x) => "Прозвучало: «" + shortIdea(x.s) + "»");
  const missed = ideas.filter((x) => !x.ok).slice(0, 3).map((x) => "Не прозвучало: «" + shortIdea(x.s) + "»");
  if (!good.length && n >= PITCH_WORDS.min) good.push("Рассказ своими словами: так звучит живее, чем по бумажке.");
  const tip = n < PITCH_WORDS.min ? "Коротковато. Добавь, чем мы отличаемся и что гостю попробовать."
    : n > PITCH_WORDS.max || secs > 40 ? "Длинновато для 30 секунд. Оставь главное: кто мы, чем отличаемся и что попробовать."
    : missed.length ? "В следующий раз добавь то, что не прозвучало. Хватит одной фразы на каждое."
    : "Хорошо. Закончи предложением гостю: что попробовать или с чего начать.";
  const share = ideas.length ? ideas.filter((x) => x.ok).length / ideas.length : 0;
  const score = Math.max(1, Math.min(5, Math.round(1 + share * 3 + (n >= PITCH_WORDS.min && n <= PITCH_WORDS.max ? 1 : 0))));
  return { good, missed, tip, better: "", score, local: true };
}

const cut = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const list = (v) => (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : []).map((x) => cut(x, PITCH_LIMITS.item)).filter(Boolean).slice(0, PITCH_LIMITS.items);

/** Ответ помощника → { good, missed, tip, better, score } или null (не по формату). */
export function pitchClean(o) {
  if (!o || typeof o !== "object") return null;
  const good = list(o.good), missed = list(o.missed), tip = cut(o.tip, PITCH_LIMITS.tip), better = cut(o.better, PITCH_LIMITS.better);
  if (!good.length && !missed.length && !tip) return null;
  const sc = Math.round(Number(o.score));
  return { good, missed, tip, better, score: sc >= 1 && sc <= 5 ? sc : 0 };
}

/** Задание помощнику (api/lesson-assist.js, режим concept_pitch). */
export function pitchPrompt({ where = "", ref = "", facts = "", said = "", secs = 0 } = {}) {
  return [
    `Ты наставник сотрудников ресторана${where ? " «" + cut(where, 80) + "»" : ""}. Сотрудник тренирует «Рассказ гостю за 30 секунд»: гость впервые у нас и спрашивает, что это за место, а сотрудник рассказывает своими словами${secs > 0 ? " (уложился в " + Math.round(secs) + " с)" : ""}.`,
    "Сравни его рассказ с образцом и фактами о ресторане. Говори на «ты», по-доброму и по делу, без канцелярита и громких слов.",
    "good — что получилось: 1–3 коротких пункта, что именно он сказал хорошо;",
    "missed — что важное из образца и фактов не прозвучало или прозвучало неверно: 0–4 коротких пункта, неверные факты первыми;",
    "tip — один совет на следующий раз, одно-два предложения;",
    "better — как мог бы звучать его рассказ: его же мысли плюс упущенное, 3–5 предложений от «мы», на 25–30 секунд речи;",
    "score — от 1 до 5: насколько рассказ готов для гостя.",
    "Не выдумывай фактов, цен, блюд и имён, которых нет в образце и фактах.",
    'Ответ — строго JSON без пояснений и без ```: {"good": ["…"], "missed": ["…"], "tip": "…", "better": "…", "score": 4}',
    "\nОБРАЗЕЦ:\n" + cut(ref, PITCH_LIMITS.ref),
    facts ? "\nФАКТЫ О РЕСТОРАНЕ:\n" + String(facts).slice(0, PITCH_LIMITS.facts) : "",
    "\nРАССКАЗ СОТРУДНИКА:\n" + cut(said, PITCH_LIMITS.said),
  ].filter(Boolean).join("\n");
}
